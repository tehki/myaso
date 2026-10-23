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
