//! Core8B P0: CSPRNG server boot identity must not repeat after process exit.
//! Experimental session-owned QUIC path; not external account authentication.
use myaso_server::prealpha_authenticated_gesture::{
    new_server_boot_nonce, SessionGestureWorldPath,
};
use myaso_server::prealpha_lmb_gesture_proposal::{
    encode_event, AckStatus, GestureAction, GestureEvent,
};
use myaso_server::simulation::{Action, World};
use std::process::Command;

const LEASE: u64 = 1;

#[test]
fn subprocess_emits_real_server_boot_nonce_and_same_numeric_local_actor() {
    // This fixture executes both as test and in a NEW OS process. Each subprocess
    // uses exactly the same Rust source CSPRNG path as the real server.
    let boot = new_server_boot_nonce().expect("OS random boot token");
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    let binding = SessionGestureWorldPath::from_admitted_world(&world, 1, LEASE, boot)
        .expect("trusted fixture actor")
        .binding();
    assert_eq!(binding.boot_nonce, boot);
    println!(
        "CORE8_BOOT_BINDING={:032x}:{}:{}:{}:{}",
        binding.boot_nonce,
        binding.player_id,
        binding.lease_epoch,
        binding.world_instance,
        binding.incarnation
    );
}

fn fresh_child_output() -> (String, String) {
    let binary = std::env::current_exe().expect("Rust integration test binary");
    let child = Command::new(binary)
        .args([
            "--exact",
            "subprocess_emits_real_server_boot_nonce_and_same_numeric_local_actor",
            "--nocapture",
            "--test-threads=1",
        ])
        .output()
        .expect("spawn fresh OS test subprocess");
    let stdout = String::from_utf8(child.stdout).expect("subprocess UTF8 stdout");
    assert!(
        child.status.success(),
        "subprocess failed: {stdout} {}",
        String::from_utf8_lossy(&child.stderr)
    );
    let binding = stdout
        .lines()
        .find_map(|line| {
            line.split_once("CORE8_BOOT_BINDING=")
                .map(|(_, rest)| rest.trim())
        })
        .expect("real Rust binding output");
    let fields: Vec<_> = binding.split(':').collect();
    assert_eq!(fields.len(), 5);
    let nonce = fields[0];
    assert_eq!(nonce.len(), 32);
    assert!(u128::from_str_radix(nonce, 16).expect("valid nonce") != 0);
    (nonce.to_owned(), fields[1..].join(":"))
}

#[test]
fn two_fresh_os_processes_reissue_local_numbers_but_never_the_same_boot_nonce() {
    let first = fresh_child_output();
    let second = fresh_child_output();
    assert_eq!(first.1, "1:1:1:1");
    assert_eq!(second.1, "1:1:1:1");
    assert_ne!(
        first.0, second.0,
        "fresh processes MUST have new CSPRNG boot identities"
    );
}

#[test]
fn foreign_boot_cannot_apply_new_press_to_identical_actor_in_current_world() {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    let boot = new_server_boot_nonce().unwrap();
    let foreign = boot.checked_add(1).unwrap_or(1);
    assert_ne!(foreign, boot);
    let mut path = SessionGestureWorldPath::from_admitted_world(&world, 1, LEASE, boot).unwrap();
    let packet = encode_event(GestureEvent {
        action: GestureAction::Press,
        sequence: 1,
        gesture_id: 1,
        client_tick: u32::MAX,
    })
    .unwrap();
    let ack = path
        .accept_under_world_lock(&mut world, LEASE, foreign, &packet)
        .unwrap();
    assert_eq!(ack.status, AckStatus::Stale);
    assert_eq!(world.fighter(1).unwrap().action, Action::Idle);
    assert!(path.retired());
    assert_eq!(ack.server_tick, world.tick);
}

#[test]
fn nonzero_boot_nonce_required_even_for_valid_local_actor_and_lease() {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player(1));
    assert!(SessionGestureWorldPath::from_admitted_world(&world, 1, LEASE, 0).is_none());
    assert_ne!(new_server_boot_nonce().unwrap(), 0);
}

#[test]
fn four_concurrent_ephemeral_seats_deny_fifth_and_recover_after_disconnect() {
    // Exercise the same atomic AdmissionGate used by the live WebTransport
    // accept loop. This is a thread-level capacity check, not multi-host QA.
    let gate = myaso_server::AdmissionGate::new(4);
    let seated = std::sync::Arc::new(std::sync::Barrier::new(5));
    let release = std::sync::Arc::new(std::sync::Barrier::new(5));
    let workers: Vec<_> = (0..4)
        .map(|_| {
            let gate = std::sync::Arc::clone(&gate);
            let seated = std::sync::Arc::clone(&seated);
            let release = std::sync::Arc::clone(&release);
            std::thread::spawn(move || {
                let permit = gate.try_acquire().expect("one of four permitted seats");
                seated.wait();
                release.wait();
                drop(permit);
            })
        })
        .collect();
    seated.wait(); // Four simultaneous accepted seats are held.
    assert_eq!(gate.current(), 4);
    assert!(gate.try_acquire().is_none(), "fifth seat must fail closed");
    release.wait();
    for worker in workers {
        worker.join().expect("seat worker");
    }
    assert_eq!(gate.current(), 0, "disconnect returns all seat capacity");
    let replacement = gate.try_acquire().expect("seat reusable after leave");
    assert_eq!(gate.current(), 1);
    drop(replacement);
    assert_eq!(gate.current(), 0);
}

#[test]
fn delayed_old_lease_release_cannot_attack_replacement_with_reused_numeric_actor() {
    // Original Rust World: same numeric actor slot, new actor incarnation and
    // session lease. An old pending RELEASE must not hijack the new occupant.
    let boot = new_server_boot_nonce().expect("OS boot nonce");
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(world.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    let mut old = SessionGestureWorldPath::from_admitted_world(&world, 1, LEASE, boot)
        .expect("old admitted actor");
    let old_life = old.binding().incarnation;
    let press = encode_event(GestureEvent {
        action: GestureAction::Press,
        sequence: 1,
        gesture_id: 1,
        client_tick: u32::MAX,
    })
    .unwrap();
    let release = encode_event(GestureEvent {
        action: GestureAction::Release,
        sequence: 2,
        gesture_id: 1,
        client_tick: u32::MAX,
    })
    .unwrap();
    assert_eq!(
        old.accept_under_world_lock(&mut world, LEASE, boot, &press)
            .unwrap()
            .status,
        AckStatus::Accepted
    );
    assert_eq!(world.fighter(1).unwrap().action, Action::AttackWindup);

    assert!(world.remove_player(1));
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    assert_ne!(world.fighter(1).unwrap().world_incarnation(), old_life);
    let new_lease = LEASE + 1;
    let mut current = SessionGestureWorldPath::from_admitted_world(&world, 1, new_lease, boot)
        .expect("freshly admitted replacement");

    let stale = old
        .accept_under_world_lock(&mut world, LEASE, boot, &release)
        .expect("stale receipt");
    assert_eq!(stale.status, AckStatus::Stale);
    assert!(old.retired());
    assert_eq!(world.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(world.fighter(2).unwrap().hp, 100.0);

    assert_eq!(
        current
            .accept_under_world_lock(&mut world, new_lease, boot, &press)
            .unwrap()
            .status,
        AckStatus::Accepted
    );
    assert_eq!(
        current
            .accept_under_world_lock(&mut world, new_lease, boot, &release)
            .unwrap()
            .status,
        AckStatus::Accepted
    );
    let mut legitimate_hits = 0;
    for _ in 0..55 {
        for event in world.step() {
            if let myaso_server::simulation::CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage: 34,
                hp: 66,
            } = event
            {
                legitimate_hits += 1;
            }
        }
        current.advance_under_world_lock(&mut world, new_lease, boot);
    }
    assert_eq!(
        legitimate_hits, 1,
        "only replacement's current attack lands"
    );
    assert_eq!(world.fighter(2).unwrap().hp, 66.0);
}

#[test]
fn four_distinct_current_leases_isolate_identical_gesture_sequence_numbers() {
    // Each legitimate ephemeral seat owns its actor even when all four clients
    // independently start with sequence=1 and gesture_id=1.
    let boot = new_server_boot_nonce().expect("OS boot nonce");
    let mut world = World::new(800.0, 600.0);
    let seats = [(1_u32, 101_u64), (2, 102), (3, 103), (4, 104)];
    for (index, (actor, _)) in seats.iter().enumerate() {
        assert!(world.add_player_at(*actor, 100.0 + index as f32 * 160.0, 300.0, 0.0));
    }
    let mut paths: Vec<_> = seats
        .iter()
        .map(|(actor, lease)| {
            SessionGestureWorldPath::from_admitted_world(&world, *actor, *lease, boot)
                .expect("authorized current actor")
        })
        .collect();
    let press = encode_event(GestureEvent {
        action: GestureAction::Press,
        sequence: 1,
        gesture_id: 1,
        client_tick: u32::MAX,
    })
    .unwrap();
    let release = encode_event(GestureEvent {
        action: GestureAction::Release,
        sequence: 2,
        gesture_id: 1,
        client_tick: u32::MAX,
    })
    .unwrap();

    // An attacker cannot substitute another actor's lease at the World gate.
    let mut foreign = SessionGestureWorldPath::from_admitted_world(&world, 4, 104, boot)
        .expect("fixture current actor");
    assert_eq!(
        foreign
            .accept_under_world_lock(&mut world, 101, boot, &press)
            .unwrap()
            .status,
        AckStatus::Stale
    );
    assert!(foreign.retired());
    for (index, (actor, lease)) in seats.iter().enumerate() {
        assert_eq!(
            paths[index]
                .accept_under_world_lock(&mut world, *lease, boot, &press)
                .unwrap()
                .status,
            AckStatus::Accepted
        );
        assert_eq!(world.fighter(*actor).unwrap().action, Action::AttackWindup);
    }

    // Disconnect/pagehide retires one owner while all three others remain
    // authorized, without accidentally consuming their sequence numbers.
    paths[0].retire();
    assert_eq!(
        paths[0]
            .accept_under_world_lock(&mut world, 101, boot, &release)
            .unwrap()
            .status,
        AckStatus::Stale
    );
    for (index, (_, lease)) in seats.iter().enumerate().skip(1) {
        assert_eq!(
            paths[index]
                .accept_under_world_lock(&mut world, *lease, boot, &release)
                .unwrap()
                .status,
            AckStatus::Accepted
        );
    }
    for _ in 0..55 {
        let events = world.step();
        assert!(
            !events
                .iter()
                .any(|event| matches!(event, myaso_server::simulation::CombatEvent::Hit { .. })),
            "distant actors must not gain fabricated damage"
        );
        for (index, (_, lease)) in seats.iter().enumerate().skip(1) {
            paths[index].advance_under_world_lock(&mut world, *lease, boot);
        }
    }
    assert!(paths[0].retired());
    for (actor, _) in seats.iter() {
        assert_eq!(world.fighter(*actor).unwrap().hp, 100.0);
    }
}

#[test]
fn genuine_combat_death_and_respawn_revoke_prior_actor_session_authority() {
    // Three real original-World 34 HP hits kill fighter #2; no fixture
    // mutation of HP, Action or actor incarnation may substitute for death.
    // Start at 36 units so two genuine 18-unit hit knockbacks still leave
    // the third attack in the original World's authoritative light reach.
    let boot = new_server_boot_nonce().expect("OS boot nonce");
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(world.add_player_at(2, 286.0, 300.0, std::f32::consts::PI));
    let attacker_lease = LEASE;
    let defender_lease = LEASE + 1;
    let mut attacker =
        SessionGestureWorldPath::from_admitted_world(&world, 1, attacker_lease, boot).unwrap();
    let mut defender =
        SessionGestureWorldPath::from_admitted_world(&world, 2, defender_lease, boot).unwrap();
    let old_life = defender.binding().incarnation;
    let mut real_hits = 0;
    let mut real_deaths = 0;

    for gesture_id in 1..=3_u32 {
        for (action, sequence) in [
            (GestureAction::Press, gesture_id * 2 - 1),
            (GestureAction::Release, gesture_id * 2),
        ] {
            let packet = encode_event(GestureEvent {
                action,
                sequence,
                gesture_id,
                client_tick: u32::MAX,
            })
            .unwrap();
            assert_eq!(
                attacker
                    .accept_under_world_lock(&mut world, attacker_lease, boot, &packet)
                    .unwrap()
                    .status,
                AckStatus::Accepted
            );
        }
        for _ in 0..55 {
            for event in world.step() {
                match event {
                    myaso_server::simulation::CombatEvent::Hit {
                        attacker: 1,
                        target: 2,
                        damage: 34,
                        ..
                    } => real_hits += 1,
                    myaso_server::simulation::CombatEvent::Death {
                        fighter: 2,
                        killer: 1,
                    } => real_deaths += 1,
                    _ => {}
                }
            }
            attacker.advance_under_world_lock(&mut world, attacker_lease, boot);
        }
    }
    assert_eq!(real_hits, 3, "only original Combat World hits qualify");
    assert_eq!(real_deaths, 1, "original Combat World must kill victim");
    assert_eq!(world.fighter(2).unwrap().action, Action::Dead);

    let old_press = encode_event(GestureEvent {
        action: GestureAction::Press,
        sequence: 1,
        gesture_id: 1,
        client_tick: u32::MAX,
    })
    .unwrap();
    assert_eq!(
        defender
            .accept_under_world_lock(&mut world, defender_lease, boot, &old_press)
            .unwrap()
            .status,
        AckStatus::Stale
    );
    assert!(defender.retired());

    let mut respawned = false;
    for _ in 0..100 {
        for event in world.step() {
            if let myaso_server::simulation::CombatEvent::Respawn { fighter: 2 } = event {
                respawned = true;
            }
        }
        attacker.advance_under_world_lock(&mut world, attacker_lease, boot);
        if respawned {
            break;
        }
    }
    assert!(respawned, "original World must complete timed respawn");
    assert_ne!(world.fighter(2).unwrap().world_incarnation(), old_life);
    assert_eq!(world.fighter(2).unwrap().hp, 100.0);
    assert_eq!(world.fighter(2).unwrap().action, Action::Idle);
    assert_eq!(
        defender
            .accept_under_world_lock(&mut world, defender_lease, boot, &old_press)
            .unwrap()
            .status,
        AckStatus::Stale,
        "old session must not resurrect when actor numeric ID respawns"
    );
    assert_eq!(world.fighter(2).unwrap().action, Action::Idle);

    // A new post-respawn session must be granted a fresh server-side lease.
    let fresh_lease = defender_lease + 1;
    let mut fresh = SessionGestureWorldPath::from_admitted_world(&world, 2, fresh_lease, boot)
        .expect("respawned actor admits a fresh seat");
    assert_eq!(
        fresh
            .accept_under_world_lock(&mut world, fresh_lease, boot, &old_press)
            .unwrap()
            .status,
        AckStatus::Accepted
    );
    assert_eq!(world.fighter(2).unwrap().action, Action::AttackWindup);
}
