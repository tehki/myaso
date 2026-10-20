//! D3: dormant, read-only collision geometry shadow for server-side parity.
//! Generated authored map data is checked against the local preview in tests.
//! NOT wired into live movement, snapshots, portals, hit tests, or production.
//! Core & Multiplayer owns any future authoritative activation and migration.

pub const GEOMETRY_MANIFEST_VERSION: u16 = 1;
pub const FIGHTER_RADIUS: f32 = 18.0;
const MAX_VALID_RADIUS: f32 = 32.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GeometryMap {
    Moonvale,
    RedLionInn,
}

#[derive(Clone, Copy, Debug)]
pub(super) struct Rect {
    x: f32,
    y: f32,
    w: f32,
    h: f32,
}

#[derive(Clone, Copy, Debug)]
pub(super) struct Point {
    x: f32,
    y: f32,
}

include!("world_geometry_data.rs");

#[inline]
fn touches_rect(x: f32, y: f32, radius: f32, l: f32, t: f32, r: f32, b: f32) -> bool {
    let px = x.clamp(l, r);
    let py = y.clamp(t, b);
    let dx = x - px;
    let dy = y - py;
    dx * dx + dy * dy <= radius * radius
}

#[inline]
fn touches_solid(x: f32, y: f32, radius: f32, rect: &Rect) -> bool {
    touches_rect(
        x,
        y,
        radius,
        rect.x,
        rect.y,
        rect.x + rect.w,
        rect.y + rect.h,
    )
}

fn touches_greyhaven_wall(x: f32, y: f32, radius: f32) -> bool {
    let left = GREYHAVEN_CITY.x;
    let right = left + GREYHAVEN_CITY.w;
    let top = GREYHAVEN_CITY.y;
    let bottom = top + GREYHAVEN_CITY.h;
    let t = WALL_HALF_THICKNESS;
    let gx = GATE_X;
    let gy = GATE_Y;
    touches_rect(
        x,
        y,
        radius,
        left - t,
        top - t,
        gx - GATE_X_HALF_WIDTH,
        top + t,
    ) || touches_rect(
        x,
        y,
        radius,
        gx + GATE_X_HALF_WIDTH,
        top - t,
        right + t,
        top + t,
    ) || touches_rect(
        x,
        y,
        radius,
        left - t,
        bottom - t,
        gx - GATE_X_HALF_WIDTH,
        bottom + t,
    ) || touches_rect(
        x,
        y,
        radius,
        gx + GATE_X_HALF_WIDTH,
        bottom - t,
        right + t,
        bottom + t,
    ) || touches_rect(
        x,
        y,
        radius,
        left - t,
        top - t,
        left + t,
        gy - GATE_Y_HALF_HEIGHT,
    ) || touches_rect(
        x,
        y,
        radius,
        left - t,
        gy + GATE_Y_HALF_HEIGHT,
        left + t,
        bottom + t,
    ) || touches_rect(
        x,
        y,
        radius,
        right - t,
        top - t,
        right + t,
        gy - GATE_Y_HALF_HEIGHT,
    ) || touches_rect(
        x,
        y,
        radius,
        right - t,
        gy + GATE_Y_HALF_HEIGHT,
        right + t,
        bottom + t,
    )
}

#[inline]
fn dist_sq_to_segment(x: f32, y: f32, a: Point, b: Point) -> f32 {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let len_sq = dx * dx + dy * dy;
    let t = if len_sq > 0.0 {
        (((x - a.x) * dx + (y - a.y) * dy) / len_sq).clamp(0.0, 1.0)
    } else {
        0.0
    };
    let px = x - (a.x + t * dx);
    let py = y - (a.y + t * dy);
    px * px + py * py
}

fn in_walkable_bridge_lane(x: f32, y: f32, radius: f32) -> bool {
    for bridge in BRIDGES {
        let half_clear_height = bridge.h / 2.0 - radius;
        if half_clear_height > 0.0
            && (y - bridge.y).abs() <= half_clear_height
            && x >= bridge.x - bridge.w / 2.0 - 3.0 * radius
            && x <= bridge.x + bridge.w / 2.0 + 3.0 * radius
        {
            return true;
        }
    }
    false
}

fn in_unbridged_river(x: f32, y: f32, radius: f32) -> bool {
    if in_walkable_bridge_lane(x, y, radius) {
        return false;
    }
    let clearance = RIVER_WIDTH / 2.0 + radius;
    let limit = clearance * clearance;
    for pair in RIVER_POINTS.windows(2) {
        let a = pair[0];
        let b = pair[1];
        if x < a.x.min(b.x) - clearance
            || x > a.x.max(b.x) + clearance
            || y < a.y.min(b.y) - clearance
            || y > a.y.max(b.y) + clearance
        {
            continue;
        }
        if dist_sq_to_segment(x, y, a, b) <= limit {
            return true;
        }
    }
    false
}

/// Pure read-only geometry query. Inputs are authoritative only if supplied
/// by the server from its own fighter and zone state (not a client claim).
/// Even then this function is NOT yet called by the actual game simulation.
pub fn is_walkable(map: GeometryMap, x: f32, y: f32, radius: f32) -> bool {
    let (width, height) = match map {
        GeometryMap::Moonvale => MOONVALE_BOUNDS,
        GeometryMap::RedLionInn => RED_LION_BOUNDS,
    };
    if !x.is_finite()
        || !y.is_finite()
        || !radius.is_finite()
        || radius <= 0.0
        || radius > MAX_VALID_RADIUS
        || x < radius
        || y < radius
        || x > width - radius
        || y > height - radius
    {
        return false;
    }

    match map {
        GeometryMap::RedLionInn => {
            for solid in INN_SOLIDS {
                if touches_solid(x, y, radius, &solid) {
                    return false;
                }
            }
            true
        }
        GeometryMap::Moonvale => {
            for building in BUILDINGS {
                if touches_solid(x, y, radius, &building) {
                    return false;
                }
            }
            !touches_greyhaven_wall(x, y, radius) && !in_unbridged_river(x, y, radius)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_golden_fixture_matches_d3_world_geometry() {
        const GOLDEN: &str = include_str!("../../tests/fixtures/world-geometry-parity-v1.csv");
        let mut checked = 0;
        for line in GOLDEN
            .lines()
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
        {
            let mut parts = line.split(',');
            let map = match parts.next().unwrap() {
                "moonvale-overworld" => GeometryMap::Moonvale,
                "red-lion-inn" => GeometryMap::RedLionInn,
                other => panic!("Unknown test fixture map {other}"),
            };
            let x: f32 = parts.next().unwrap().parse().unwrap();
            let y: f32 = parts.next().unwrap().parse().unwrap();
            let radius: f32 = parts.next().unwrap().parse().unwrap();
            let expected = match parts.next().unwrap() {
                "1" => true,
                "0" => false,
                other => panic!("Invalid expected state {other}"),
            };
            assert_eq!(
                parts.next(),
                None,
                "fixture must contain exactly five fields"
            );
            assert_eq!(is_walkable(map, x, y, radius), expected, "fixture: {line}");
            checked += 1;
        }
        assert!(checked >= 24, "unexpectedly small parity fixture");
        assert_eq!(GEOMETRY_MANIFEST_VERSION, 1);
        assert_eq!(FIGHTER_RADIUS, 18.0);
    }

    #[test]
    fn forged_and_nonfinite_positions_are_not_walkable() {
        for map in [GeometryMap::Moonvale, GeometryMap::RedLionInn] {
            assert!(!is_walkable(map, f32::NAN, 50.0, 18.0));
            assert!(!is_walkable(map, 50.0, f32::INFINITY, 18.0));
            assert!(!is_walkable(map, 50.0, 50.0, f32::NAN));
            assert!(!is_walkable(map, 50.0, 50.0, 0.0));
            assert!(!is_walkable(map, 50.0, 50.0, 33.0));
        }
    }

    #[test]
    fn player_can_use_only_the_two_authored_moonvale_bridge_corridors() {
        assert!(is_walkable(
            GeometryMap::Moonvale,
            1980.0,
            4240.0,
            FIGHTER_RADIUS
        ));
        assert!(is_walkable(
            GeometryMap::Moonvale,
            2100.0,
            5500.0,
            FIGHTER_RADIUS
        ));
        assert!(!is_walkable(
            GeometryMap::Moonvale,
            1940.0,
            3840.0,
            FIGHTER_RADIUS
        ));
        assert!(!is_walkable(
            GeometryMap::Moonvale,
            4365.0,
            4000.0,
            FIGHTER_RADIUS
        ));
    }
}
