//! Review-only proposed action 5: original authenticated QUIC lease + original World.
use myaso_server::prealpha_authenticated_gesture::SessionGestureWorldPath;
use myaso_server::prealpha_lmb_gesture_proposal::{
    encode_typed_event, AckStatus, GestureAction, GestureEvent, GestureSource, TypedGestureEvent,
};
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};
const LEASE: u64 = 0x4455;
const BOOT: u128 = 0x1122_3344_7788_99aa;

fn arena() -> World {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(world.add_player_at(2, 298.0, 300.0, std::f32::consts::PI));
    world
}
fn admit(
    p: &mut SessionGestureWorldPath,
    world: &mut World,
    lease: u64,
    action: GestureAction,
    seq: u32,
    id: u32,
) -> AckStatus {
    let bytes = encode_typed_event(TypedGestureEvent {
        source: GestureSource::Lmb,
        event: GestureEvent {
            action,
            sequence: seq,
            gesture_id: id,
            client_tick: u32::MAX,
        },
    })
    .unwrap();
    p.accept_under_world_lock(world, lease, BOOT, &bytes)
        .unwrap()
        .status
}
fn step(p: &mut SessionGestureWorldPath, world: &mut World) -> Vec<(u8, u8)> {
    let mut hits = vec![];
    for event in world.step() {
        if let CombatEvent::Hit {
            attacker: 1,
            target: 2,
            damage,
            hp,
        } = event
        {
            hits.push((damage, hp));
        }
    }
    p.advance_under_world_lock(world, LEASE, BOOT);
    hits
}
#[test]
fn chord_before_jumping_queues_without_hit_then_original_world_commits_once() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    p.enable_jump_review();
    assert_eq!(
        admit(&mut p, &mut w, LEASE, GestureAction::JumpAttack, 1, 1),
        AckStatus::Accepted
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(w.fighter(1).unwrap().stamina, 100.0);
    assert_eq!(
        admit(&mut p, &mut w, LEASE, GestureAction::Release, 2, 1),
        AckStatus::Accepted
    );
    assert!(step(&mut p, &mut w).is_empty()); // no spoofed jump bit
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    w.set_input(
        1,
        InputIntent {
            jump: true,
            ..InputIntent::default()
        },
    );
    assert!(step(&mut p, &mut w).is_empty());
    assert_eq!(w.fighter(1).unwrap().action, Action::JumpAttackWindup);
    assert!((w.fighter(1).unwrap().stamina - 74.0).abs() < 0.01);
    assert_eq!(
        admit(&mut p, &mut w, LEASE, GestureAction::JumpAttack, 1, 1),
        AckStatus::Duplicate
    );
    let mut hits = vec![];
    for _ in 0..65 {
        hits.extend(step(&mut p, &mut w));
    }
    assert_eq!(hits, vec![(42, 58)]);
}
#[test]
fn cancel_before_server_jump_prevents_future_attack_and_stays_connected() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    p.enable_jump_review();
    assert_eq!(
        admit(&mut p, &mut w, LEASE, GestureAction::JumpAttack, 1, 1),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(&mut p, &mut w, LEASE, GestureAction::Cancel, 2, 1),
        AckStatus::Accepted
    );
    w.set_input(
        1,
        InputIntent {
            jump: true,
            ..InputIntent::default()
        },
    );
    assert!(step(&mut p, &mut w).is_empty());
    assert_eq!(w.fighter(1).unwrap().action, Action::Jump);
    assert!(!p.retired());
}
#[test]
fn missing_world_jump_expires_without_attack_or_lease_death_and_next_light_works() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    p.enable_jump_review();
    assert_eq!(
        admit(&mut p, &mut w, LEASE, GestureAction::JumpAttack, 1, 1),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(&mut p, &mut w, LEASE, GestureAction::Release, 2, 1),
        AckStatus::Accepted
    );
    for _ in 0..18 {
        assert!(step(&mut p, &mut w).is_empty());
    }
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert!(!p.retired());
    assert_eq!(
        admit(&mut p, &mut w, LEASE, GestureAction::Press, 3, 2),
        AckStatus::Accepted
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::AttackWindup);
    assert_eq!(
        admit(&mut p, &mut w, LEASE, GestureAction::Release, 4, 2),
        AckStatus::Accepted
    );
    let mut hits = vec![];
    for _ in 0..52 {
        hits.extend(step(&mut p, &mut w));
    }
    assert_eq!(hits, vec![(34, 66)]);
}
#[test]
fn stolen_lease_never_admits_or_spends_jump_stamina() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    p.enable_jump_review();
    let status = admit(&mut p, &mut w, LEASE + 1, GestureAction::JumpAttack, 1, 1);
    assert_eq!(status, AckStatus::Stale);
    assert_eq!(w.fighter(1).unwrap().stamina, 100.0);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
}

#[test]
fn delayed_genuine_world_jump_after_original_12_tick_window_cannot_resurrect_chord() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    p.enable_jump_review();
    assert_eq!(
        admit(&mut p, &mut w, LEASE, GestureAction::JumpAttack, 1, 1),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(&mut p, &mut w, LEASE, GestureAction::Release, 2, 1),
        AckStatus::Accepted
    );
    for _ in 0..18 {
        assert!(step(&mut p, &mut w).is_empty());
    }
    w.set_input(
        1,
        InputIntent {
            jump: true,
            ..InputIntent::default()
        },
    );
    assert!(step(&mut p, &mut w).is_empty());
    assert_eq!(w.fighter(1).unwrap().action, Action::Jump);
    assert!(
        (w.fighter(1).unwrap().stamina - 86.0).abs() < 0.01,
        "expired source0 chord must not spend attack stamina"
    );
    assert!(
        !p.retired(),
        "harmless expired intent does not force QUIC disconnect"
    );
}
#[test]
fn old_key_e_source1_cannot_spoof_new_jump_attack_opcode() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    p.enable_jump_review();
    let bytes = encode_typed_event(TypedGestureEvent {
        source: GestureSource::KeyE,
        event: GestureEvent {
            action: GestureAction::JumpAttack,
            sequence: 1,
            gesture_id: 1,
            client_tick: u32::MAX,
        },
    })
    .unwrap();
    let ack = p
        .accept_under_world_lock(&mut w, LEASE, BOOT, &bytes)
        .unwrap();
    assert_eq!(ack.status, AckStatus::Rejected);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(w.fighter(1).unwrap().stamina, 100.0);
    assert!(
        !p.retired(),
        "denied retired Use source must not damage original actor"
    );
}

#[test]
fn default_original_v2_session_rejects_unapproved_action5_without_touching_world() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    w.set_input(
        1,
        InputIntent {
            jump: true,
            ..InputIntent::default()
        },
    );
    assert!(step(&mut p, &mut w).is_empty());
    assert_eq!(w.fighter(1).unwrap().action, Action::Jump);
    assert_eq!(
        admit(&mut p, &mut w, LEASE, GestureAction::JumpAttack, 1, 1),
        AckStatus::Rejected
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::Jump);
    assert!((w.fighter(1).unwrap().stamina - 86.0).abs() < 0.01);
    assert!(!p.retired());
}
