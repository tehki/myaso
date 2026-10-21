//! World 9 / IDR #655 specialist authoring proof. This executes the actual
//! Core 8C embedded 23-solid Rust static geometry query. It cannot certify
//! live witnesses, completed ticks, liveness, dynamic bodies/river, zone,
//! network identity, appearance epochs or actual Physics 6 current LOS.
//! The three reviewed NPC positions are NOT inserted into any runtime.

use myaso_server::alpha_greyhaven_geometry::{
    overlaps_known_static_solid, swept_circle_hits_known_static_solid, STATIC_LAYOUT_ID,
    STATIC_SOLIDS, STATIC_SOLIDS_SHA256,
};

type Point = (f32, f32);
const R: f32 = 18.0;
const THIN_STATIC_RAY: f32 = 0.25;
const SENTINEL_EAST: Point = (3908.0, 4072.0);
const SENTINEL_NORTH: Point = (3800.0, 3810.0);
const SENTINEL_DISTANT: Point = (4250.0, 4260.0);
const SUBJECT: Point = (3860.0, 4068.0);

fn distance(a: Point, b: Point) -> f32 {
    (a.0 - b.0).hypot(a.1 - b.1)
}

fn distance_to_segment(p: Point, a: Point, b: Point) -> f32 {
    let dx = b.0 - a.0;
    let dy = b.1 - a.1;
    let len_sq = dx * dx + dy * dy;
    if len_sq == 0.0 {
        return distance(p, a);
    }
    let projection = ((p.0 - a.0) * dx + (p.1 - a.1) * dy) / len_sq;
    let t = projection.clamp(0.0, 1.0);
    distance(p, (a.0 + t * dx, a.1 + t * dy))
}

#[test]
fn immutable_world9_source_and_safe_review_only_sentinel_points() {
    assert_eq!(STATIC_SOLIDS.len(), 23);
    assert_eq!(STATIC_LAYOUT_ID, "moonvale-greyhaven-v10-solids-v1");
    assert_eq!(
        STATIC_SOLIDS_SHA256,
        "9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43"
    );
    for (name, (x, y)) in [
        ("near Smith east", SENTINEL_EAST),
        ("north of Smith", SENTINEL_NORTH),
        ("distant city", SENTINEL_DISTANT),
        ("subject original rack", SUBJECT),
        ("Smith east corner side", (3911.0, 3992.0)),
        ("Smith south corner side", (3872.0, 4031.0)),
    ] {
        assert_eq!(
            overlaps_known_static_solid(x, y, R),
            Ok(false),
            "{name} intersects a known static collider"
        );
    }
}

#[test]
fn original_blacksmith_has_positive_and_negative_static_observation_rays() {
    let smith = STATIC_SOLIDS
        .iter()
        .find(|r| r.id == "building:smith")
        .unwrap();
    assert_eq!(
        (smith.min_x, smith.min_y, smith.max_x, smith.max_y),
        (3710.0, 3850.0, 3892.0, 4012.0)
    );
    assert!(distance(SENTINEL_EAST, SUBJECT) < 56.0);
    assert_eq!(
        swept_circle_hits_known_static_solid(SENTINEL_EAST, SUBJECT, THIN_STATIC_RAY),
        Ok(false),
        "near eastern Sentinel has clear fixed-static sightline"
    );
    assert_eq!(
        swept_circle_hits_known_static_solid(SENTINEL_NORTH, SUBJECT, THIN_STATIC_RAY),
        Ok(true),
        "north observer is occluded by actual Smith, not client claim"
    );
    let east = (3911.0, 3992.0);
    let south = (3872.0, 4031.0);
    let actual_distance = distance(east, south);
    assert!(actual_distance > R * 2.0 && actual_distance < 56.0);
    for (a, b) in [(east, south), (south, east)] {
        assert_eq!(
            swept_circle_hits_known_static_solid(a, b, THIN_STATIC_RAY),
            Ok(true),
            "even an in-range witness cannot see through a real solid corner"
        );
    }
}

#[test]
fn reviewed_static_sentinel_positions_preserve_four_real_alpha_cardinal_routes() {
    let spawns = [
        (4110.0, 4160.0),
        (4206.0, 4160.0),
        (4110.0, 4256.0),
        (4206.0, 4256.0),
    ];
    let stands = [
        (3740.0, 4088.0),
        (3780.0, 4088.0),
        (3820.0, 4088.0),
        (3860.0, 4088.0),
    ];
    let anchors = [SENTINEL_EAST, SENTINEL_NORTH, SENTINEL_DISTANT];
    for (i, (spawn, stand)) in spawns.into_iter().zip(stands).enumerate() {
        let west = (stand.0, spawn.1);
        let closer_candidate = (stand.0, 4068.0);
        for (a, b) in [(spawn, west), (west, stand), (stand, closer_candidate)] {
            assert_eq!(
                swept_circle_hits_known_static_solid(a, b, R),
                Ok(false),
                "original radius18 P0 lane {} unexpectedly blocked",
                i + 1
            );
            for anchor in anchors {
                assert!(
                    distance_to_segment(anchor, a, b) > 2.0 * R,
                    "static Sentinel anchor would crowd P0 lane {}",
                    i + 1
                );
            }
        }
    }
}
