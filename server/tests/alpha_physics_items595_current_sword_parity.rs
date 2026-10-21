//! Read-only cross-owner integration test using ACTUAL World/Core static
//! source, Physics range/LOS, and Items' real in-memory ground projection.
//! Intentionally test-only: no Core signed zone lease, current complete
//! river/dynamic geometry or durable global u128 writer exists in this tree.
use myaso_server::alpha_armory_physics::{
    verify_pickup_geometry_at_completed_tick, GeometryFence, GeometryWindow, PickupGeometryReject,
    PickupTickFence, SolidRect, WorldPoint,
};
use myaso_server::alpha_greyhaven_geometry::{STATIC_SOLIDS, STATIC_SOLIDS_SHA256};
use myaso_server::loot::{
    CurrentRackSword, ItemKind, LootAuthority, LootError, Point, ProposedRackSocket, PICKUP_REACH,
};
use myaso_server::simulation::World;
use myaso_server::zone::ZoneId;

const SOCKET_X: [f32; 4] = [3740.0, 3780.0, 3820.0, 3860.0];
const TEST_FENCE: GeometryFence = GeometryFence {
    zone_id: 7,
    worker_epoch: 11,
    map_revision: 23,
};
const TEST_TICKS: PickupTickFence = PickupTickFence {
    operation_tick: 900,
    actor_tick: 900,
    sword_tick: 900,
    geometry_tick: 900,
};
const CITY_BOUNDS: SolidRect = SolidRect {
    min_x: 0.0,
    min_y: 0.0,
    max_x: 8192.0,
    max_y: 8192.0,
};

fn p(x: f32, y: f32) -> WorldPoint {
    WorldPoint {
        zone_id: TEST_FENCE.zone_id,
        x,
        y,
    }
}

fn core_solids() -> Vec<SolidRect> {
    STATIC_SOLIDS
        .iter()
        .map(|solid| SolidRect {
            min_x: solid.min_x,
            min_y: solid.min_y,
            max_x: solid.max_x,
            max_y: solid.max_y,
        })
        .collect()
}

fn test_window(solids: &[SolidRect], complete: bool) -> GeometryWindow<'_> {
    GeometryWindow {
        fence: TEST_FENCE,
        complete,
        bounds: CITY_BOUNDS,
        solids,
    }
}

// The setup grants four DIFFERENT Items physical IDs through their public
// server-domain allocator, then drops them at the exact World rack anchors.
// It neither patches Loot internal private state nor simulates item receipts.
fn create_real_items_world() -> (
    World,
    LootAuthority,
    [ProposedRackSocket; 4],
    [CurrentRackSword; 4],
) {
    let zone = ZoneId::Moonvale;
    let sockets = SOCKET_X.map(|x| ProposedRackSocket {
        at: Point { x, y: 4038.0 },
    });
    let mut world = World::new(8192.0, 8192.0);
    let mut loot = LootAuthority::new();
    for (index, x) in SOCKET_X.into_iter().enumerate() {
        let source_id = index as u32 + 1;
        let buyer_id = index as u32 + 5;
        assert!(world.add_player_at(source_id, x, 4038.0, 0.0));
        assert!(world.add_player_at(buyer_id, x, 4088.0, 0.0));
        loot.register(source_id).unwrap();
        loot.register(buyer_id).unwrap();
        let item_id = loot
            .grant(
                source_id,
                if index % 2 == 0 {
                    ItemKind::RustySword
                } else {
                    ItemKind::IronSword
                },
                1,
            )
            .unwrap();
        let drop_entity_id = loot
            .drop_backpack(
                source_id,
                world.fighter(source_id).unwrap(),
                zone,
                item_id,
                10,
            )
            .unwrap();
        assert_ne!(drop_entity_id, item_id);
    }
    let projected = loot
        .proposed_current_rack_swords(zone, sockets, 11)
        .unwrap()
        .map(|slot| slot.expect("four truly present swords"));
    let items = projected.map(|s| s.item_id);
    let entities = projected.map(|s| s.ground_entity_id);
    for a in 0..4 {
        for b in a + 1..4 {
            assert_ne!(items[a], items[b]);
            assert_ne!(entities[a], entities[b]);
        }
    }
    (world, loot, sockets, projected)
}

#[test]
fn current_items_ids_match_core_static_physics_without_a_pickup_authority_claim() {
    assert_eq!(PICKUP_REACH, 56.0);
    assert_eq!(STATIC_SOLIDS.len(), 23);
    assert_eq!(
        STATIC_SOLIDS_SHA256,
        "9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43"
    );
    let (world, loot, sockets, projected) = create_real_items_world();
    let before = loot.export_state().unwrap();
    let solids = core_solids();
    let known_incomplete = test_window(&solids, false);

    // Never confuse a genuinely existing item ID with proof of COMPLETE World
    // obstacles. This must fail even though all actor/selected ID facts exist.
    assert_eq!(
        verify_pickup_geometry_at_completed_tick(
            p(3740.0, 4088.0),
            p(3740.0, 4038.0),
            &known_incomplete,
            TEST_FENCE,
            PICKUP_REACH,
            TEST_TICKS
        ),
        Err(PickupGeometryReject::IncompleteGeometry)
    );

    // For STATIC parity only, fake completeness inside this isolated test.
    // NEVER copy this fixture to a runtime handler; the source lacks river,
    // actors and all dynamic door/obstacle authoritative state.
    let static_only_fixture = test_window(&solids, true);
    for (actor_i, stand_x) in SOCKET_X.into_iter().enumerate() {
        let buyer_id = actor_i as u32 + 5;
        let fighter = world.fighter(buyer_id).unwrap();
        let actor = p(fighter.x, fighter.y);
        assert_eq!((actor.x, actor.y), (stand_x, 4088.0));
        for (sword_i, selected) in projected.into_iter().enumerate() {
            let drop = loot
                .ground()
                .get(&selected.ground_entity_id)
                .expect("current item from Items domain must still exist");
            assert_eq!(drop.item.id, selected.item_id);
            assert_eq!(drop.zone, ZoneId::Moonvale);
            let source_point = p(drop.at.x, drop.at.y);
            assert_eq!(
                verify_pickup_geometry_at_completed_tick(
                    actor,
                    source_point,
                    &static_only_fixture,
                    TEST_FENCE,
                    PICKUP_REACH,
                    TEST_TICKS
                ),
                if actor_i == sword_i {
                    Ok(())
                } else {
                    Err(PickupGeometryReject::OutOfRange)
                },
                "actor {actor_i} exact Items-selected ground entity {sword_i}"
            );
        }
    }
    // Equal caller tick numbers are NOT authenticated or locked. Here only
    // equality is checked. A real signed lease, zone, revision and writer is
    // still required separately.
    assert_eq!(
        verify_pickup_geometry_at_completed_tick(
            p(3740.0, 4088.0),
            p(3740.0, 4038.0),
            &static_only_fixture,
            TEST_FENCE,
            PICKUP_REACH,
            PickupTickFence {
                sword_tick: 899,
                ..TEST_TICKS
            }
        ),
        Err(PickupGeometryReject::StaleWorldTick)
    );
    assert_eq!(
        loot.export_state().unwrap(),
        before,
        "all geometry checks must be read-only"
    );
    assert_eq!(
        loot.proposed_current_rack_swords(ZoneId::Moonvale, sockets, 11)
            .unwrap()
            .map(|x| x.unwrap()),
        projected
    );
}

#[test]
fn domain_only_pickup_removes_exact_selected_item_and_preserves_unselected() {
    let (world, mut loot, sockets, projected) = create_real_items_world();
    let solids = core_solids();
    let static_only_fixture = test_window(&solids, true);

    // Midpoint is legitimate 56-unit range to TWO different actual Items IDs.
    let midpoint = p(3760.0, 4088.0);
    for index in [0usize, 1] {
        let drop = loot
            .ground()
            .get(&projected[index].ground_entity_id)
            .unwrap();
        assert_eq!(
            verify_pickup_geometry_at_completed_tick(
                midpoint,
                p(drop.at.x, drop.at.y),
                &static_only_fixture,
                TEST_FENCE,
                PICKUP_REACH,
                TEST_TICKS
            ),
            Ok(())
        );
    }

    // Specifically select *second* entity. Geometry deliberately cannot
    // select one automatically. This Items domain API is NOT a checked,
    // authenticated Core8B transaction nor a live browser TryPickup.
    let selected = projected[1];
    let taken = loot
        .take_ground(
            6,
            world.fighter(6).unwrap(),
            ZoneId::Moonvale,
            selected.ground_entity_id,
            20,
        )
        .unwrap();
    assert_eq!(taken.id, selected.item_id);
    assert!(!loot.ground().contains_key(&selected.ground_entity_id));
    assert!(loot.ground().contains_key(&projected[0].ground_entity_id));
    assert_eq!(loot.inventory(6).unwrap().backpack().len(), 1);
    assert_eq!(
        loot.inventory(6).unwrap().backpack()[0].id,
        selected.item_id
    );
    let current = loot
        .proposed_current_rack_swords(ZoneId::Moonvale, sockets, 21)
        .unwrap();
    assert!(current[1].is_none());
    for (i, source) in projected.into_iter().enumerate() {
        if i != 1 {
            assert_eq!(current[i], Some(source));
        }
    }
    // A replayed claim of the physically absent ground entity fails closed.
    assert_eq!(
        loot.take_ground(
            6,
            world.fighter(6).unwrap(),
            ZoneId::Moonvale,
            selected.ground_entity_id,
            22
        ),
        Err(LootError::NotFound)
    );
}
#[test]
fn known_current_dynamic_door_blocks_selected_live_sword_despite_valid_range() {
    let (world, loot, _, current) = create_real_items_world();
    let buyer = world.fighter(5).unwrap();
    let selected = current[0];
    let ground = loot.ground().get(&selected.ground_entity_id).unwrap();
    assert_eq!(ground.item.id, selected.item_id);
    let actor = p(buyer.x, buyer.y);
    let sword = p(ground.at.x, ground.at.y);

    // The exact original 23 authored STATIC solids do not include this
    // closed dynamic door. A caller claiming "complete" based on only the
    // static table returns OK: this is why static hashes never prove pickup.
    let static_solids = core_solids();
    assert_eq!(
        verify_pickup_geometry_at_completed_tick(
            actor,
            sword,
            &test_window(&static_solids, true),
            TEST_FENCE,
            PICKUP_REACH,
            TEST_TICKS
        ),
        Ok(())
    );

    // The new blocker intersects the 50-unit actor→actual-item ray, but no
    // current source-owned item identity, reach, tick or revision changed.
    let mut current_with_door = static_solids;
    current_with_door.push(SolidRect {
        min_x: 3738.0,
        min_y: 4058.0,
        max_x: 3742.0,
        max_y: 4068.0,
    });
    assert_eq!(
        verify_pickup_geometry_at_completed_tick(
            actor,
            sword,
            &test_window(&current_with_door, true),
            TEST_FENCE,
            PICKUP_REACH,
            TEST_TICKS
        ),
        Err(PickupGeometryReject::Occluded),
        "a current blocker must override apparently valid live sword reach"
    );

    // Unknown dynamic coverage is NOT an empty blocker list. Keep DENIED
    // even though the static geometry contains a fully clear ray.
    assert_eq!(
        verify_pickup_geometry_at_completed_tick(
            actor,
            sword,
            &test_window(&core_solids(), false),
            TEST_FENCE,
            PICKUP_REACH,
            TEST_TICKS
        ),
        Err(PickupGeometryReject::IncompleteGeometry)
    );
}

#[test]
fn previously_taken_or_expired_sword_cannot_be_authorized_by_stale_geometry() {
    let (world, mut loot, sockets, initial) = create_real_items_world();
    let selected = initial[1];
    let actor = world.fighter(6).unwrap();
    let original_ground = loot
        .ground()
        .get(&selected.ground_entity_id)
        .unwrap()
        .clone();
    let actor_point = p(actor.x, actor.y);
    let stale_sword_point = p(original_ground.at.x, original_ground.at.y);
    let static_solids = core_solids();
    let static_fixture = test_window(&static_solids, true);

    // Before actual removal, Items' CURRENT selected rack binding exists.
    assert_eq!(
        loot.proposed_current_rack_swords(ZoneId::Moonvale, sockets, 11)
            .unwrap()[1],
        Some(selected)
    );
    assert_eq!(
        verify_pickup_geometry_at_completed_tick(
            actor_point,
            stale_sword_point,
            &static_fixture,
            TEST_FENCE,
            PICKUP_REACH,
            TEST_TICKS
        ),
        Ok(())
    );

    let taken = loot
        .take_ground(6, actor, ZoneId::Moonvale, selected.ground_entity_id, 20)
        .unwrap();
    assert_eq!(taken.id, selected.item_id);

    // The attacker still remembers valid old coordinates, and the geometry
    // helper correctly remains READ-ONLY: it cannot detect an absent item.
    assert_eq!(
        verify_pickup_geometry_at_completed_tick(
            actor_point,
            stale_sword_point,
            &static_fixture,
            TEST_FENCE,
            PICKUP_REACH,
            TEST_TICKS
        ),
        Ok(()),
        "geometry-only YES is explicitly NOT an ownership authorization"
    );

    // A trusted ONE-TRANSACTION consumer MUST re-read the selected current
    // ground entity/physical item/mutation sequence while holding its writer
    // fence. That source is now absent; an old successful LOS must not grant.
    let current = loot
        .proposed_current_rack_swords(ZoneId::Moonvale, sockets, 21)
        .unwrap();
    assert_eq!(current[1], None);
    assert_ne!(current[1], Some(selected));
    assert_eq!(
        loot.take_ground(6, actor, ZoneId::Moonvale, selected.ground_entity_id, 22),
        Err(LootError::NotFound)
    );

    // Independently, an untouched source item can expire while its old
    // coordinates are still LOS-clear; caller time is not signed authority.
    assert_eq!(
        loot.proposed_current_rack_swords(ZoneId::Moonvale, sockets, u64::MAX)
            .unwrap(),
        [None; 4]
    );
    assert_eq!(
        verify_pickup_geometry_at_completed_tick(
            p(3740.0, 4088.0),
            p(3740.0, 4038.0),
            &static_fixture,
            TEST_FENCE,
            PICKUP_REACH,
            TEST_TICKS
        ),
        Ok(())
    );
    assert!(
        loot.ground().get(&initial[0].ground_entity_id).is_some(),
        "expired data can exist physically in storage and MUST be filtered at query"
    );
}

#[test]
fn items_pickup_reach_matches_physics_for_dense_original_sword_boundary() {
    let (world, loot, _, projected) = create_real_items_world();
    let selected = projected[0];
    let ground = loot.ground().get(&selected.ground_entity_id).unwrap();
    let sword = p(ground.at.x, ground.at.y);
    let actor = world.fighter(5).unwrap().clone();
    let original_loot = loot.export_state().unwrap();
    let statics = core_solids();
    // Deliberate STATIC-ONLY fixture. Real Core must verify dynamic, river,
    // current item source and signed same-tick lease before live interaction.
    let geometry = test_window(&statics, true);
    let mut accepted = 0usize;
    let mut denied = 0usize;

    // Dense fixed grid in the physically open southern Blacksmith approach.
    // Every candidate is tested against a fresh genuine Items-owned domain
    // snapshot. Never let a successful earlier claim remove the source for
    // the next independent boundary comparison.
    for dx in -56..=56 {
        for dy in 0..=58 {
            let mut sample_actor = actor.clone();
            sample_actor.x = sword.x + dx as f32;
            sample_actor.y = sword.y + dy as f32;
            let physics = verify_pickup_geometry_at_completed_tick(
                p(sample_actor.x, sample_actor.y),
                sword,
                &geometry,
                TEST_FENCE,
                PICKUP_REACH,
                TEST_TICKS,
            );
            let mut independent_items =
                LootAuthority::restore_state(original_loot.clone()).unwrap();
            let item = independent_items.take_ground(
                5,
                &sample_actor,
                ZoneId::Moonvale,
                selected.ground_entity_id,
                20,
            );
            assert_eq!(
                physics.is_ok(),
                item.is_ok(),
                "actual Items/Physics float boundary differs at actor ({}, {}) from original world sword ({}, {})",
                sample_actor.x,
                sample_actor.y,
                sword.x,
                sword.y
            );
            if physics.is_ok() {
                assert_eq!(item.unwrap().id, selected.item_id);
                accepted += 1;
            } else {
                assert_eq!(physics, Err(PickupGeometryReject::OutOfRange));
                assert_eq!(item, Err(LootError::OutOfReach));
                denied += 1;
            }
        }
    }

    // The original 1-ULP reach mismatch from Physics #544 occurred around
    // this exact real World sword. Probe both sides of its f32 coordinate
    // bits to catch reintroduction of fused multiplication or altered order.
    const EDGE_X_BITS: u32 = 3748.1265_f32.to_bits();
    const EDGE_Y_BITS: u32 = 4093.4072_f32.to_bits();
    for delta_x in -4_i32..=4 {
        for delta_y in -4_i32..=4 {
            let mut sample_actor = actor.clone();
            sample_actor.x = f32::from_bits(EDGE_X_BITS.checked_add_signed(delta_x).unwrap());
            sample_actor.y = f32::from_bits(EDGE_Y_BITS.checked_add_signed(delta_y).unwrap());
            let physics = verify_pickup_geometry_at_completed_tick(
                p(sample_actor.x, sample_actor.y),
                sword,
                &geometry,
                TEST_FENCE,
                PICKUP_REACH,
                TEST_TICKS,
            );
            let mut independent_items =
                LootAuthority::restore_state(original_loot.clone()).unwrap();
            let item = independent_items.take_ground(
                5,
                &sample_actor,
                ZoneId::Moonvale,
                selected.ground_entity_id,
                20,
            );
            assert_eq!(
                physics.is_ok(),
                item.is_ok(),
                "ULP boundary parity failed at original sword actor ({},{})",
                sample_actor.x,
                sample_actor.y
            );
        }
    }
    assert!(
        accepted > 2_000,
        "must exercise many legitimate source points"
    );
    assert!(
        denied > 1_000,
        "must exercise many just-outside source points"
    );
    assert_eq!(loot.export_state().unwrap(), original_loot);
}
