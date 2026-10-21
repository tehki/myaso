//! Test-only cross-source parity: the actual World #521/Core #571 embedded
//! 23 authored static solids versus Physics #544's read-only LOS verifier.
//!
//! This MUST NOT be used by /game: the static set lacks river, actors, and
//! dynamic doors. The "complete=true" below is a LOCAL TEST FICTION for
//! deterministic static-only point-ray expectations, never a production lease.
use myaso_server::alpha_armory_physics::{
    verify_pickup_geometry_at_completed_tick, GeometryFence, GeometryWindow, PickupGeometryReject,
    PickupTickFence, SolidRect, WorldPoint,
};
use myaso_server::alpha_greyhaven_geometry::{
    overlaps_known_static_solid, STATIC_LAYOUT_ID, STATIC_SOLIDS, STATIC_SOLIDS_SHA256,
};

const TEST_ONLY_FENCE: GeometryFence = GeometryFence {
    zone_id: 7,
    worker_epoch: 11,
    map_revision: 23,
};
const TEST_ONLY_TICKS: PickupTickFence = PickupTickFence {
    operation_tick: 900,
    actor_tick: 900,
    sword_tick: 900,
    geometry_tick: 900,
};
const ITEMS_PROTOTYPE_PICKUP_REACH: f32 = 56.0;
const TEST_WORLD_BOUNDS: SolidRect = SolidRect {
    min_x: 0.0,
    min_y: 0.0,
    max_x: 8192.0,
    max_y: 8192.0,
};

fn p(x: f32, y: f32) -> WorldPoint {
    WorldPoint {
        zone_id: TEST_ONLY_FENCE.zone_id,
        x,
        y,
    }
}

fn authored_static_solids() -> Vec<SolidRect> {
    STATIC_SOLIDS
        .iter()
        .map(|source| SolidRect {
            min_x: source.min_x,
            min_y: source.min_y,
            max_x: source.max_x,
            max_y: source.max_y,
        })
        .collect()
}

fn test_only_static_window(solids: &[SolidRect], complete: bool) -> GeometryWindow<'_> {
    GeometryWindow {
        fence: TEST_ONLY_FENCE,
        complete,
        bounds: TEST_WORLD_BOUNDS,
        solids,
    }
}

#[test]
fn current_embedded_world_static_table_matches_all_four_rack_reach56_rays() {
    assert_eq!(STATIC_LAYOUT_ID, "moonvale-greyhaven-v10-solids-v1");
    assert_eq!(
        STATIC_SOLIDS_SHA256,
        "9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43"
    );
    assert_eq!(STATIC_SOLIDS.len(), 23);
    let smith = STATIC_SOLIDS
        .iter()
        .find(|r| r.id == "building:smith")
        .expect("World/Core real smith solid must exist");
    assert_eq!(
        (smith.min_x, smith.min_y, smith.max_x, smith.max_y),
        (3710.0, 3850.0, 3892.0, 4012.0)
    );

    let solids = authored_static_solids();
    let incomplete = test_only_static_window(&solids, false);
    assert_eq!(
        verify_pickup_geometry_at_completed_tick(
            p(3740.0, 4088.0),
            p(3740.0, 4038.0),
            &incomplete,
            TEST_ONLY_FENCE,
            ITEMS_PROTOTYPE_PICKUP_REACH,
            TEST_ONLY_TICKS,
        ),
        Err(PickupGeometryReject::IncompleteGeometry),
        "even the correct 23-static source MUST fail closed without Core's complete current obstacle evidence"
    );

    // Local simulated complete fixture ONLY to test real source static rays.
    // Complete live World geometry is impossible to infer from this set.
    let fixture = test_only_static_window(&solids, true);
    for (owner, stand_x) in [3740.0, 3780.0, 3820.0, 3860.0].into_iter().enumerate() {
        assert_eq!(
            overlaps_known_static_solid(stand_x, 4088.0, 18.0),
            Ok(false),
            "player {owner} authored approach collides with Core's real solids"
        );
        for (sword_index, sword_x) in [3740.0, 3780.0, 3820.0, 3860.0].into_iter().enumerate() {
            assert_eq!(
                verify_pickup_geometry_at_completed_tick(
                    p(stand_x, 4088.0),
                    p(sword_x, 4038.0),
                    &fixture,
                    TEST_ONLY_FENCE,
                    ITEMS_PROTOTYPE_PICKUP_REACH,
                    TEST_ONLY_TICKS,
                ),
                if owner == sword_index {
                    Ok(())
                } else {
                    Err(PickupGeometryReject::OutOfRange)
                },
                "real World/Core geometry diverged at actor {owner}, clicked sword {sword_index}"
            );
        }
    }

    // Each 56-unit midpoint legitimately sees two selectable physical swords.
    // A pointer+item binding must still be authenticated by Items/Core, not
    // selected by distance, index or Physics.
    for sword_x in [3740.0, 3780.0] {
        assert_eq!(
            verify_pickup_geometry_at_completed_tick(
                p(3760.0, 4088.0),
                p(sword_x, 4038.0),
                &fixture,
                TEST_ONLY_FENCE,
                ITEMS_PROTOTYPE_PICKUP_REACH,
                TEST_ONLY_TICKS,
            ),
            Ok(())
        );
    }

    // A point on the INSIDE of the real smith footprint is under range, but
    // the World-authoritative static shop must not allow reaching through it.
    assert_eq!(
        verify_pickup_geometry_at_completed_tick(
            p(3740.0, 4005.0),
            p(3740.0, 4038.0),
            &fixture,
            TEST_ONLY_FENCE,
            ITEMS_PROTOTYPE_PICKUP_REACH,
            TEST_ONLY_TICKS,
        ),
        Err(PickupGeometryReject::Occluded)
    );

    // Identical coordinates are not sufficient when the item state is older.
    assert_eq!(
        verify_pickup_geometry_at_completed_tick(
            p(3740.0, 4088.0),
            p(3740.0, 4038.0),
            &fixture,
            TEST_ONLY_FENCE,
            ITEMS_PROTOTYPE_PICKUP_REACH,
            PickupTickFence {
                sword_tick: 899,
                ..TEST_ONLY_TICKS
            },
        ),
        Err(PickupGeometryReject::StaleWorldTick)
    );
}

#[test]
fn current_embedded_world_west_gate_is_open_but_neighbour_wall_occludes() {
    let solids = authored_static_solids();
    let fixture = test_only_static_window(&solids, true);

    // This 84-unit visibility probe checks STATIC LOS geometry only, not an
    // authorized Items pickup (actual Items gameplay reach is 56).
    for y in [4000.0, 4180.0] {
        for x in [3478.0, 3562.0] {
            assert_eq!(
                overlaps_known_static_solid(x, y, 18.0),
                Ok(false),
                "west gate fixture endpoint itself must be outside solid collision"
            );
        }
        assert_eq!(
            verify_pickup_geometry_at_completed_tick(
                p(3478.0, y),
                p(3562.0, y),
                &fixture,
                TEST_ONLY_FENCE,
                96.0, // geometry ceiling; NOT Items/Alpha pickup authorization
                TEST_ONLY_TICKS,
            ),
            if y == 4180.0 {
                Ok(())
            } else {
                Err(PickupGeometryReject::Occluded)
            },
            "authored west gap vs intact wall source changed at y={y}"
        );
    }
}
