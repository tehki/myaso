//! Department 9 P0: actual Core 8C SERVER static-solver verification of the
//! reviewed World #579 Blacksmith courtyard. This test calls the production
//! Rust geometry query; it NEVER authenticates item ownership, actor movement,
//! live revision/zone/epoch/LOS or dynamic collisions. No production code change.

use myaso_server::alpha_greyhaven_geometry::{
    overlaps_known_static_solid, swept_circle_hits_known_static_solid, STATIC_LAYOUT_ID,
    STATIC_SOLIDS, STATIC_SOLIDS_SHA256,
};

type Point = (f32, f32);
const FIGHTER_RADIUS: f32 = 18.0;
const WORLD9_SPAWNS: [Point; 4] = [
    (4110.0, 4160.0),
    (4206.0, 4160.0),
    (4110.0, 4256.0),
    (4206.0, 4256.0),
];
const WORLD9_RACK_STANDS: [Point; 4] = [
    (3740.0, 4088.0),
    (3780.0, 4088.0),
    (3820.0, 4088.0),
    (3860.0, 4088.0),
];
const WORLD9_COURTYARD_QA_STATIONS: [Point; 4] = [
    (3740.0, 4200.0),
    (3860.0, 4200.0),
    (3740.0, 4290.0),
    (3860.0, 4290.0),
];

fn assert_static_segment_clear(from: Point, to: Point, context: &str) {
    for point in [from, to] {
        assert_eq!(
            overlaps_known_static_solid(point.0, point.1, FIGHTER_RADIUS),
            Ok(false),
            "{context}: endpoint {point:?} intersects an authored solid"
        );
    }
    for (a, b) in [(from, to), (to, from)] {
        assert_eq!(
            swept_circle_hits_known_static_solid(a, b, FIGHTER_RADIUS),
            Ok(false),
            "{context}: swept server collider blocks {a:?} -> {b:?}"
        );
    }
}

#[test]
fn actual_core_static_solver_accepts_all_32_world9_courtyard_route_pairs() {
    assert_eq!(STATIC_SOLIDS.len(), 23);
    assert_eq!(STATIC_LAYOUT_ID, "moonvale-greyhaven-v10-solids-v1");
    assert_eq!(
        STATIC_SOLIDS_SHA256,
        "9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43"
    );
    let mut pairs = 0;
    for (i, spawn) in WORLD9_SPAWNS.into_iter().enumerate() {
        for (j, destination) in WORLD9_COURTYARD_QA_STATIONS.into_iter().enumerate() {
            assert_static_segment_clear(
                spawn,
                destination,
                &format!("Core spawn {i} -> station {j}"),
            );
            pairs += 1;
        }
    }
    for (i, stand) in WORLD9_RACK_STANDS.into_iter().enumerate() {
        for (j, destination) in WORLD9_COURTYARD_QA_STATIONS.into_iter().enumerate() {
            assert_static_segment_clear(
                stand,
                destination,
                &format!("World rack {i} -> station {j}"),
            );
            pairs += 1;
        }
    }
    assert_eq!(pairs, 32);

    // Static QA fixtures are pinned against the ACTUAL World 9 module, not
    // created by an unrelated test-only alternative map.
    let source = include_str!("../../src/world/alpha-combat-space.mjs");
    assert!(source.contains("greyhaven-smith-south-courtyard"));
    assert!(source.contains("point(3740,4200),point(3860,4200)"));
    assert!(source.contains("point(3740,4290),point(3860,4290)"));
    let spawn_source = include_str!("../src/alpha_spawn.rs");
    assert!(spawn_source.contains("(4110.0, 4160.0)"));
    assert!(spawn_source.contains("(4206.0, 4256.0)"));
}

#[test]
fn server_static_solver_checks_world9_eight_directional_clearance_probes() {
    let origin: Point = (3820.0, 4240.0);
    for i in 0..8 {
        let angle = i as f32 * std::f32::consts::FRAC_PI_4;
        let target = (origin.0 + 64.0 * angle.cos(), origin.1 + 64.0 * angle.sin());
        assert!(
            target.0 - FIGHTER_RADIUS >= 3700.0
                && target.0 + FIGHTER_RADIUS <= 3940.0
                && target.1 - FIGHTER_RADIUS >= 4120.0
                && target.1 + FIGHTER_RADIUS <= 4360.0,
            "direction {i} exits the reviewed World courtyard"
        );
        assert_static_segment_clear(origin, target, &format!("direction {i}"));
    }
}

#[test]
fn server_static_solver_still_rejects_smith_wall_and_invalid_sweeps() {
    assert_eq!(
        swept_circle_hits_known_static_solid((3740.0, 4088.0), (3740.0, 3930.0), FIGHTER_RADIUS),
        Ok(true),
        "the open rack approach must not permit travel through the solid Blacksmith"
    );
    assert!(
        swept_circle_hits_known_static_solid((3740.0, 4200.0), (f32::NAN, 4200.0), FIGHTER_RADIUS)
            .is_err(),
        "invalid server collision queries must fail closed"
    );
}

#[test]
fn actual_core_static_solver_preserves_four_native_west_first_armory_routes() {
    // The genuine four-browser Core 8A #608 test observed an actor wedged
    // against Smith's east wall on a north-first route. This is a WORLD
    // source regression on the safe cardinal approach, not a browser input
    // script, dynamic pathfinder, signed location or item interaction.
    assert_eq!(STATIC_SOLIDS.len(), 23);
    let spawn_source = include_str!("../src/alpha_spawn.rs");
    let socket_source = include_str!("../../src/world/alpha-armory.mjs");
    for (x, y) in WORLD9_SPAWNS {
        assert!(
            spawn_source.contains(&format!("({x:.1}, {y:.1})")),
            "staging spawn changed: refresh World/Core reviewed route together"
        );
    }
    for (i, stand) in WORLD9_RACK_STANDS.into_iter().enumerate() {
        assert!(
            socket_source.contains(&format!("makeSocket({},{})", i + 1, stand.0 as i32)),
            "authored physical socket changed: review path before accepting"
        );
        assert!(
            socket_source.contains("approach:Object.freeze({x,y:4088})"),
            "Blacksmith standing Y contract changed"
        );
        let spawn = WORLD9_SPAWNS[i];
        let west_then_north_corner: Point = (stand.0, spawn.1);
        assert!(spawn.0 > stand.0 && spawn.1 > stand.1);
        assert_static_segment_clear(
            spawn,
            west_then_north_corner,
            &format!("native browser {} west-first southern leg", i + 1),
        );
        assert_static_segment_clear(
            west_then_north_corner,
            stand,
            &format!("native browser {} northward rack approach", i + 1),
        );
        // assert_static_segment_clear verifies both directions, including
        // touch/overlap at each end. A static pass does not prove true
        // time-stepped input arrival or any sword authorization.
    }
    assert_eq!(
        swept_circle_hits_known_static_solid(
            (4110.0, 4020.0),
            (3820.0, 4020.0),
            FIGHTER_RADIUS,
        ),
        Ok(true),
        "north-first Smith wall shortcut MUST remain blocked"
    );
}
