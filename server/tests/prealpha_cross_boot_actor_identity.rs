//! Core8B NEGATIVE cross-process identity witness against experimental #841.
//! No runtime behavior is changed or remotely accessible by these fixtures.
use std::process::Command;

use myaso_server::prealpha_authenticated_gesture::SessionGestureWorldPath;
use myaso_server::simulation::World;

const SOURCE_PROOF_PREFIX: &str = "CORE8B_BOOT_LOCAL_BINDING=";

fn same_source_boot_local_binding() -> (u32, u64, u64, u64) {
    // This deliberate first World of a fresh process shows why local World
    // incarnation counters + session epoch are NOT boot-unique auth tokens.
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    let lease = SessionGestureWorldPath::from_admitted_world(&world, 1, 1)
        .expect("server-side fixture admits its own fighter");
    let binding = lease.binding();
    (
        binding.player_id,
        binding.lease_epoch,
        binding.world_instance,
        binding.incarnation,
    )
}

#[test]
fn emit_single_boot_local_binding_for_subprocess_probe() {
    let (fighter, lease, world, life) = same_source_boot_local_binding();
    println!("{SOURCE_PROOF_PREFIX}{fighter}:{lease}:{world}:{life}");
}

fn run_fresh_process_probe() -> String {
    let exe = std::env::current_exe().expect("real integration test binary path");
    let child = Command::new(exe)
        .args([
            "--exact",
            "emit_single_boot_local_binding_for_subprocess_probe",
            "--nocapture",
            "--test-threads=1",
        ])
        .output()
        .expect("launch independent Rust process");
    let stdout = String::from_utf8(child.stdout).expect("UTF-8 Rust test output");
    assert!(
        child.status.success(),
        "fixture child failed: stdout={stdout}, stderr={}",
        String::from_utf8_lossy(&child.stderr)
    );
    assert!(stdout.contains("1 passed"), "fixture did not run: {stdout}");
    let value = stdout
        .lines()
        .find_map(|line| line.split_once(SOURCE_PROOF_PREFIX).map(|(_, value)| value))
        .expect("binding witness logged")
        .trim();
    assert!(
        value.split(':').count() == 4 && value.split(':').all(|field| field.parse::<u64>().is_ok()),
        "invalid numeric witness: {value}"
    );
    value.to_owned()
}

#[test]
fn two_fresh_server_processes_can_reissue_identical_numeric_lease_and_actor_binding() {
    // Demonstrates actual source-local counter *nonuniqueness across boots*.
    // It does NOT demonstrate replay of an old QUIC socket or receipt of
    // packets on the next server; no authentication exists in this fixture.
    let first_process = run_fresh_process_probe();
    let second_process = run_fresh_process_probe();
    assert_eq!(first_process, second_process);
    assert_eq!(first_process, "1:1:1:1");
}
