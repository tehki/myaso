//! Deterministic LW-1D NPC pilot navigation over explicitly authored test obstacles.
//! These rectangles are *not* live Greyhaven/world combat collision geometry.
//! The paths are computed on a bounded grid once per process; no user inputs.
pub use crate::npc_collision_contract::GRID_STEP;
use crate::npc_collision_contract::{Collider, CollisionWindow, NavBounds};
use crate::PROTOCOL_VERSION;
use std::sync::OnceLock;

pub const OBSTACLE_PACKET_TYPE: u8 = 10;
const MIN_X: i32 = 60;
const MIN_Y: i32 = 30;
const MAX_X: i32 = 460;
const MAX_Y: i32 = 320;
pub const WALK_TICKS: u32 = 600;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Barrier {
    pub x: u16,
    pub y: u16,
    pub width: u16,
    pub height: u16,
}
/// Explicit miniature route blockers for reproducible loopback QA only.
/// They must be replaced with map-manifest colliders before shared deployment.
pub const PILOT_BARRIERS: [Barrier; 3] = [
    Barrier {
        x: 195,
        y: 180,
        width: 35,
        height: 35,
    }, // watch barricade
    Barrier {
        x: 345,
        y: 105,
        width: 30,
        height: 45,
    }, // market stall
    Barrier {
        x: 294,
        y: 216,
        width: 24,
        height: 31,
    }, // supply crate
];

type GridPoint = (i32, i32);
type AuthoredRoute = (u8, GridPoint, GridPoint);
const ROUTES: [AuthoredRoute; 3] = [
    (3, (155, 205), (275, 190)),
    (4, (315, 110), (395, 150)),
    (5, (270, 220), (340, 255)),
];
type Path = Vec<(i32, i32)>;
static PATHS: OnceLock<[Option<Path>; 3]> = OnceLock::new();

fn pilot_window() -> CollisionWindow {
    let colliders = PILOT_BARRIERS.map(|rect| Collider {
        x: i32::from(rect.x),
        y: i32::from(rect.y),
        width: i32::from(rect.width),
        height: i32::from(rect.height),
    });
    CollisionWindow::pilot(
        NavBounds {
            min_x: MIN_X,
            min_y: MIN_Y,
            max_x: MAX_X,
            max_y: MAX_Y,
        },
        &colliders,
    )
    .expect("authored pilot rectangle geometry is valid")
}

#[cfg(test)]
fn blocked(x: i32, y: i32) -> bool {
    pilot_window().contains_obstacle(x, y)
}

fn shortest_route(start: GridPoint, end: GridPoint) -> Option<Path> {
    // The navigation contract can plan validated, bounded server-owned
    // collision windows. Runtime staging still uses its own pilot geometry.
    pilot_window().plan(start, end).ok()
}

fn routes() -> &'static [Option<Path>; 3] {
    PATHS.get_or_init(|| ROUTES.map(|(_, start, end)| shortest_route(start, end)))
}

fn path_point(path: &[(i32, i32)], progress: u32) -> (u16, u16) {
    if path.len() < 2 {
        return (path[0].0 as u16, path[0].1 as u16);
    }
    let length = path.len() - 1;
    // Grid edges are not all equal: travel at uniform world speed.
    let total: f32 = path
        .windows(2)
        .map(|pair| {
            let dx = (pair[1].0 - pair[0].0) as f32;
            let dy = (pair[1].1 - pair[0].1) as f32;
            dx.hypot(dy)
        })
        .sum();
    let mut remaining = total * progress.min(WALK_TICKS) as f32 / WALK_TICKS as f32;
    for step in path.windows(2) {
        let from = step[0];
        let to = step[1];
        let segment = ((to.0 - from.0) as f32).hypot((to.1 - from.1) as f32);
        if remaining <= segment {
            let ratio = remaining / segment;
            return (
                (from.0 as f32 + (to.0 - from.0) as f32 * ratio).round() as u16,
                (from.1 as f32 + (to.1 - from.1) as f32 * ratio).round() as u16,
            );
        }
        remaining -= segment;
    }
    let destination = path[length];
    (destination.0 as u16, destination.1 as u16)
}

/// Returns the safe position along the outwards route or its reverse.
/// If the small authored test map becomes inconsistent, fail closed at start.
pub fn position(id: u8, outward_progress: u32) -> Option<(u16, u16)> {
    let slot = ROUTES.iter().position(|route| route.0 == id)?;
    let (start, _) = (ROUTES[slot].1, ROUTES[slot].2);
    Some(match &routes()[slot] {
        Some(path) => path_point(path, outward_progress),
        None => (start.0 as u16, start.1 as u16),
    })
}
/// Pilot ONLY, for a guarded detour from a current server NPC position
/// to an immutable server worksite. It uses the same bounded authored Rust
/// collision window as baseline staging, never browser art or player input.
/// Snapping by <= 2 units is permitted only if the short join is unobstructed.
pub fn pilot_inspection_route(from: (u16, u16), to: (u16, u16)) -> Option<Vec<(u16, u16)>> {
    let snap = (
        (i32::from(from.0) + GRID_STEP / 2) / GRID_STEP * GRID_STEP,
        (i32::from(from.1) + GRID_STEP / 2) / GRID_STEP * GRID_STEP,
    );
    if (i32::from(from.0) - snap.0).abs() > 2
        || (i32::from(from.1) - snap.1).abs() > 2
        || snap.0 < 0
        || snap.1 < 0
        || !pilot_line_of_sight(from, (snap.0 as u16, snap.1 as u16))
    {
        return None;
    }
    let path = pilot_window()
        .plan(snap, (i32::from(to.0), i32::from(to.1)))
        .ok()?;
    if path.len() > 128 {
        return None;
    }
    let mut result = Vec::with_capacity(path.len() + 1);
    result.push(from);
    for (x, y) in path {
        let next = (u16::try_from(x).ok()?, u16::try_from(y).ok()?);
        if result.last().copied() != Some(next) {
            result.push(next);
        }
    }
    if !result
        .windows(2)
        .all(|points| pilot_line_of_sight(points[0], points[1]))
    {
        return None;
    }
    Some(result)
}

/// Follow immutable pilot route over 600 simulation ticks. Reversing its
/// progress produces precisely the same safe waypoints in reverse.
pub fn pilot_inspection_position(path: &[(u16, u16)], progress: u32) -> Option<(u16, u16)> {
    let first = *path.first()?;
    if path.len() == 1 {
        return Some(first);
    }
    let total: f32 = path
        .windows(2)
        .map(|p| {
            let dx = f32::from(p[1].0) - f32::from(p[0].0);
            let dy = f32::from(p[1].1) - f32::from(p[0].1);
            dx.hypot(dy)
        })
        .sum();
    if total <= f32::EPSILON {
        return Some(first);
    }
    let mut remain = total * progress.min(WALK_TICKS) as f32 / WALK_TICKS as f32;
    for pair in path.windows(2) {
        let dx = f32::from(pair[1].0) - f32::from(pair[0].0);
        let dy = f32::from(pair[1].1) - f32::from(pair[0].1);
        let segment = dx.hypot(dy);
        if remain <= segment {
            let amount = if segment <= f32::EPSILON {
                0.0
            } else {
                remain / segment
            };
            return Some((
                (f32::from(pair[0].0) + dx * amount).round() as u16,
                (f32::from(pair[0].1) + dy * amount).round() as u16,
            ));
        }
        remain -= segment;
    }
    path.last().copied()
}

pub fn valid_route(id: u8) -> bool {
    ROUTES
        .iter()
        .position(|route| route.0 == id)
        .is_some_and(|slot| routes()[slot].is_some())
}

/// Tiny, allocation-free line check through authored *pilot* obstacles only.
/// Meeting events must not pass through the staged wall/crate. This is not
/// production zone visibility or combat line-of-sight.
pub fn pilot_line_of_sight(from: (u16, u16), to: (u16, u16)) -> bool {
    let dx = i32::from(to.0) - i32::from(from.0);
    let dy = i32::from(to.1) - i32::from(from.1);
    let steps = ((dx.abs().max(dy.abs()) + GRID_STEP - 1) / GRID_STEP).max(1);
    for step in 0..=steps {
        let x = i32::from(from.0) + dx * step / steps;
        let y = i32::from(from.1) + dy * step / steps;
        if PILOT_BARRIERS.iter().any(|rect| {
            x >= i32::from(rect.x)
                && y >= i32::from(rect.y)
                && x <= i32::from(rect.x + rect.width)
                && y <= i32::from(rect.y + rect.height)
        }) {
            return false;
        }
    }
    true
}

pub fn obstacle_packet() -> Vec<u8> {
    let mut bytes = vec![
        PROTOCOL_VERSION,
        OBSTACLE_PACKET_TYPE,
        PILOT_BARRIERS.len() as u8,
        0,
    ];
    for barrier in PILOT_BARRIERS {
        for field in [barrier.x, barrier.y, barrier.width, barrier.height] {
            bytes.extend_from_slice(&field.to_le_bytes());
        }
    }
    bytes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_routes_are_reachable_and_avoid_every_expanded_obstacle() {
        for (index, (_, start, end)) in ROUTES.iter().enumerate() {
            let path = routes()[index]
                .as_ref()
                .expect("authored route is reachable");
            assert_eq!(path.first(), Some(start));
            assert_eq!(path.last(), Some(end));
            assert!(path.iter().all(|&(x, y)| !blocked(x, y)));
            for pair in path.windows(2) {
                assert!((pair[0].0 - pair[1].0).abs() <= GRID_STEP);
                assert!((pair[0].1 - pair[1].1).abs() <= GRID_STEP);
            }
        }
        assert!(valid_route(3) && valid_route(4) && valid_route(5));
        assert!(!valid_route(2));
    }

    #[test]
    fn movement_is_repeatable_collision_free_and_reversible() {
        for (id, start, end) in ROUTES {
            assert_eq!(position(id, 0), Some((start.0 as u16, start.1 as u16)));
            assert_eq!(position(id, WALK_TICKS), Some((end.0 as u16, end.1 as u16)));
            for t in 0..=WALK_TICKS {
                let a = position(id, t).unwrap();
                let b = position(id, WALK_TICKS - t).unwrap();
                assert!(!blocked(i32::from(a.0), i32::from(a.1)));
                assert!(!blocked(i32::from(b.0), i32::from(b.1)));
                assert_eq!(position(id, t), Some(a));
            }
        }
        assert!(position(0, 100).is_none());
    }

    #[test]
    fn straight_line_would_cross_authored_barriers() {
        for (_, start, end) in ROUTES {
            assert!((0..=100).any(|step| {
                let x = start.0 + (end.0 - start.0) * step / 100;
                let y = start.1 + (end.1 - start.1) * step / 100;
                blocked(x, y)
            }));
        }
    }

    #[test]
    fn pilot_social_encounter_line_of_sight_does_not_cross_crates() {
        assert!(pilot_line_of_sight((120, 95), (210, 65)));
        assert!(!pilot_line_of_sight((275, 190), (340, 255)));
        assert!(!pilot_line_of_sight((340, 255), (275, 190)));
        assert!(pilot_line_of_sight((120, 95), (120, 95)));
    }

    #[test]
    fn packet_is_strict_compact_and_coordinate_bounded() {
        let packet = obstacle_packet();
        assert_eq!(packet.len(), 4 + 3 * 8);
        assert_eq!(&packet[..4], &[1, 10, 3, 0]);
        assert_eq!(&packet[4..8], &[195, 0, 180, 0]);
    }

    #[test]
    fn inspection_route_uses_trusted_pilot_window_and_reversible_points() {
        let start = crate::npc_routines::NpcRoutines::position(3, 1380).unwrap();
        let path = pilot_inspection_route((start.x, start.y), (270, 220)).unwrap();
        assert!(path.len() < 128);
        assert_eq!(path.first().copied(), Some((start.x, start.y)));
        assert_eq!(path.last().copied(), Some((270, 220)));
        assert_eq!(
            pilot_inspection_position(&path, 0),
            Some((start.x, start.y))
        );
        assert_eq!(pilot_inspection_position(&path, 600), Some((270, 220)));
        for tick in 0..=600 {
            let point = pilot_inspection_position(&path, tick).unwrap();
            assert!(pilot_line_of_sight(point, point));
            if tick > 0 {
                let previous = pilot_inspection_position(&path, tick - 1).unwrap();
                assert!((i32::from(point.0) - i32::from(previous.0)).abs() <= 2);
                assert!((i32::from(point.1) - i32::from(previous.1)).abs() <= 2);
            }
        }
        assert_eq!(pilot_inspection_position(&path, 6000), Some((270, 220)));
    }

    #[test]
    fn inspection_paths_fail_closed_for_blocked_or_unreachable_endpoints() {
        assert!(pilot_inspection_route((270, 220), (300, 230)).is_none()); // supply crate
        assert!(pilot_inspection_route((0, 0), (270, 220)).is_none());
        assert!(pilot_inspection_route((270, 220), (500, 500)).is_none());
        assert_eq!(pilot_inspection_position(&[], 120), None);
        assert_eq!(
            pilot_inspection_position(&[(270, 220)], 120),
            Some((270, 220))
        );
    }
}
