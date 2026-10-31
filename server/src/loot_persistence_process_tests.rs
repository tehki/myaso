//! Test-only Unix multi-process negative witness for the legacy MYASOL03
//! checkpoint writer. This deliberately proves the missing cross-process
//! revision fence; it does not introduce or activate a second writer.
use super::*;
use crate::character_identity::{SessionIdentityRegistry, SessionLease};
use crate::loot::{EquipmentSlot, ItemKind, LootAuthority};
use crate::simulation::World;
use crate::zone::ZoneId;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

static TEST_SEQUENCE: AtomicU64 = AtomicU64::new(1);

fn checkpoint_path() -> PathBuf {
    let number = TEST_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!(
        "myaso-two-process-checkpoint-{}-{number}.bin",
        std::process::id()
    ))
}

#[cfg(unix)]
#[test]
fn two_process_atomic_checkpoint_writes_accept_stale_sibling_snapshots_and_lose_one_owner() {
    // Both independent processes start from the SAME valid source snapshot.
    // Each makes a legitimate claim of the same physical sword for a
    // different owner, then atomically replaces the same checkpoint.
    // Atomic rename prevents torn bytes; it does NOT provide writer fencing
    // or compare-and-swap against the source revision.
    let mut world = World::new(800.0, 600.0);
    let mut identity = SessionIdentityRegistry::new();
    let mut initial = LootAuthority::new();
    for (actor, x) in [(1_u32, 200.0), (2, 212.0), (3, 224.0)] {
        assert!(world.add_player_at(actor, x, 200.0, 0.0));
        identity
            .bind_verified(
                SessionLease::new(actor, 1).unwrap(),
                CharacterId::new(100 + u64::from(actor)).unwrap(),
            )
            .unwrap();
        initial.register(actor).unwrap();
    }
    let item_id = initial.grant(3, ItemKind::IronSword, 1).unwrap();
    let entity_id = initial
        .drop_backpack(
            3,
            world.fighter(3).unwrap(),
            ZoneId::Moonvale,
            item_id,
            0,
        )
        .unwrap();
    for actor in 1..=3 {
        initial
            .park_inventory(&identity, SessionLease::new(actor, 1).unwrap())
            .unwrap();
    }
    let common_base = initial.export_state().unwrap();

    let mut writer_a = LootAuthority::restore_state(common_base.clone()).unwrap();
    writer_a
        .resume_inventory(&identity, SessionLease::new(1, 1).unwrap())
        .unwrap();
    let claimed_a = writer_a
        .take_ground(
            1,
            world.fighter(1).unwrap(),
            ZoneId::Moonvale,
            entity_id,
            1,
        )
        .unwrap();
    assert_eq!(claimed_a.id, item_id);
    writer_a.equip(1, item_id, EquipmentSlot::MainHand).unwrap();
    writer_a
        .park_inventory(&identity, SessionLease::new(1, 1).unwrap())
        .unwrap();
    let state_a = writer_a.export_state().unwrap();
    let bytes_a = encode(&state_a).unwrap();

    let mut writer_b = LootAuthority::restore_state(common_base).unwrap();
    writer_b
        .resume_inventory(&identity, SessionLease::new(2, 1).unwrap())
        .unwrap();
    let claimed_b = writer_b
        .take_ground(
            2,
            world.fighter(2).unwrap(),
            ZoneId::Moonvale,
            entity_id,
            1,
        )
        .unwrap();
    assert_eq!(claimed_b.id, item_id);
    writer_b.equip(2, item_id, EquipmentSlot::MainHand).unwrap();
    writer_b
        .park_inventory(&identity, SessionLease::new(2, 1).unwrap())
        .unwrap();
    let state_b = writer_b.export_state().unwrap();
    let bytes_b = encode(&state_b).unwrap();
    assert_ne!(state_a, state_b);
    assert_ne!(bytes_a, bytes_b);

    let path = checkpoint_path();
    save_quiescent(&path, &initial).unwrap();
    let input_a = path.with_extension("writer-a.input");
    let input_b = path.with_extension("writer-b.input");
    let ready_a = path.with_extension("writer-a.ready");
    let ready_b = path.with_extension("writer-b.ready");
    let gate = path.with_extension("writers.go");
    fs::write(&input_a, &bytes_a).unwrap();
    fs::write(&input_b, &bytes_b).unwrap();

    fn spawn_writer(target: &Path, input: &Path, ready: &Path, gate: &Path) -> Child {
        Command::new(std::env::current_exe().unwrap())
            .arg("--exact")
            .arg("loot_persistence::process_tests::subprocess_atomic_write_stale_snapshot")
            .arg("--nocapture")
            .env("MYASO_ITEMS_TEST_ATOMIC_TARGET", target)
            .env("MYASO_ITEMS_TEST_ATOMIC_INPUT", input)
            .env("MYASO_ITEMS_TEST_ATOMIC_READY", ready)
            .env("MYASO_ITEMS_TEST_ATOMIC_GATE", gate)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap()
    }
    fn wait_for_marker(path: &Path) {
        let deadline = Instant::now() + Duration::from_secs(15);
        while !path.exists() {
            assert!(
                Instant::now() < deadline,
                "writer subprocess did not reach barrier: {}",
                path.display()
            );
            std::thread::sleep(Duration::from_millis(2));
        }
    }

    let mut child_a = spawn_writer(&path, &input_a, &ready_a, &gate);
    let mut child_b = spawn_writer(&path, &input_b, &ready_b, &gate);
    wait_for_marker(&ready_a);
    wait_for_marker(&ready_b);
    // Release both OS processes only after each has loaded its stale,
    // mutually exclusive snapshot into private memory.
    fs::write(&gate, b"GO").unwrap();
    let status_a = child_a.wait().unwrap();
    let status_b = child_b.wait().unwrap();
    assert!(status_a.success(), "first independent writer failed: {status_a}");
    assert!(status_b.success(), "second independent writer failed: {status_b}");

    // Both independent processes reported success, but only one complete
    // branch can remain. There is no conflict error or merged ownership.
    let recovered = load_quiescent(&path).unwrap();
    let recovered_state = recovered.export_state().unwrap();
    assert!(
        recovered_state == state_a || recovered_state == state_b,
        "atomic rename must leave one whole snapshot, not torn bytes"
    );
    let a_owner = recovered
        .parked_inventory(CharacterId::new(101).unwrap())
        .unwrap()
        .equipped(EquipmentSlot::MainHand)
        .map(|stack| stack.id);
    let b_owner = recovered
        .parked_inventory(CharacterId::new(102).unwrap())
        .unwrap()
        .equipped(EquipmentSlot::MainHand)
        .map(|stack| stack.id);
    assert_ne!(a_owner, b_owner, "one physical sword cannot have two owners");
    assert!(
        (a_owner == Some(item_id) && b_owner.is_none())
            || (b_owner == Some(item_id) && a_owner.is_none())
    );
    assert!(
        !recovered.ground().contains_key(&entity_id),
        "the final writer's snapshot has consumed the original ground entity"
    );

    for temporary in [path, input_a, input_b, ready_a, ready_b, gate] {
        let _ = fs::remove_file(temporary);
    }
}

#[cfg(unix)]
#[test]
fn subprocess_atomic_write_stale_snapshot() {
    let Some(target) = std::env::var_os("MYASO_ITEMS_TEST_ATOMIC_TARGET") else {
        // Normal cargo test discovery: this helper is inert unless spawned
        // by the parent regression with its private environment contract.
        return;
    };
    let input = std::env::var_os("MYASO_ITEMS_TEST_ATOMIC_INPUT").unwrap();
    let ready = std::env::var_os("MYASO_ITEMS_TEST_ATOMIC_READY").unwrap();
    let gate = std::env::var_os("MYASO_ITEMS_TEST_ATOMIC_GATE").unwrap();
    let bytes = fs::read(input).unwrap();
    fs::write(ready, b"READY").unwrap();
    let deadline = Instant::now() + Duration::from_secs(15);
    while !Path::new(&gate).exists() {
        assert!(
            Instant::now() < deadline,
            "parent did not release stale writer barrier"
        );
        std::thread::sleep(Duration::from_millis(2));
    }
    atomic_write(Path::new(&target), &bytes).unwrap();
}
