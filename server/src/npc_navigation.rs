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
// One fixed-point arc-length index per trusted, authored route. Read-only
// after first construction, shared among all five NPCs and all sessions.
static CACHED_ROUTES: OnceLock<[Option<PilotInspectionPath>; 3]> = OnceLock::new();

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

#[cfg(test)]
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

/// Build and validate a bounded, integer-only movement index once for each
/// authored route. If the source route is unavailable or outside the bounded
/// pilot sampler, fail closed at the NPC's authored start location.
fn cached_routes() -> &'static [Option<PilotInspectionPath>; 3] {
    CACHED_ROUTES.get_or_init(|| {
        routes().each_ref().map(|path| {
            let points: Vec<_> = path
                .as_ref()?
                .iter()
                .map(|&(x, y)| Some((u16::try_from(x).ok()?, u16::try_from(y).ok()?)))
                .collect::<Option<_>>()?;
            PilotInspectionPath::prepare(points)
        })
    })
}

/// Returns a pure read-only position along the existing pilot route.
/// Includes Tomas/Elara's fixed pickup/dropoff endpoints at ticks 600/1800.
pub fn position(id: u8, outward_progress: u32) -> Option<(u16, u16)> {
    let slot = ROUTES.iter().position(|route| route.0 == id)?;
    let (start, _) = (ROUTES[slot].1, ROUTES[slot].2);
    Some(
        cached_routes()[slot]
            .as_ref()
            .map_or((start.0 as u16, start.1 as u16), |route| {
                route.position(outward_progress)
            }),
    )
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

/// LW-1U: an immutable deterministic, bounded pilot path prepared once,
/// never allocating or summing floating-point distances on each world tick.
/// Fixed 1/1024-world-unit arc lengths are derived using integer square root.
#[derive(Debug, Clone)]
pub struct PilotInspectionPath {
    points: Vec<(u16, u16)>,
    cumulative: Vec<u32>,
    total: u32,
}

impl std::ops::Deref for PilotInspectionPath {
    type Target = [(u16, u16)];
    fn deref(&self) -> &Self::Target {
        &self.points
    }
}

impl PilotInspectionPath {
    fn prepare(points: Vec<(u16, u16)>) -> Option<Self> {
        if points.is_empty() || points.len() > 128 {
            return None;
        }
        let mut cumulative = Vec::with_capacity(points.len());
        cumulative.push(0_u32);
        let mut total = 0_u32;
        for pair in points.windows(2) {
            let dx = (i64::from(pair[1].0) - i64::from(pair[0].0)) * 1024;
            let dy = (i64::from(pair[1].1) - i64::from(pair[0].1)) * 1024;
            let squared = u64::try_from(dx * dx + dy * dy).ok()?;
            let distance = u32::try_from(squared.isqrt()).ok()?;
            if distance == 0 {
                return None;
            }
            total = total.checked_add(distance)?;
            cumulative.push(total);
        }
        Some(Self {
            points,
            cumulative,
            total,
        })
    }

    /// One binary search + integer interpolation per query. A reversed
    /// detour simply decreases the same committed progress, not a new path.
    pub fn position(&self, progress: u32) -> (u16, u16) {
        if progress == 0 || self.total == 0 {
            return self.points[0];
        }
        if progress >= WALK_TICKS {
            return *self.points.last().expect("bounded path");
        }
        let target = (u64::from(self.total) * u64::from(progress) / u64::from(WALK_TICKS)) as u32;
        let index = self
            .cumulative
            .partition_point(|&v| v < target)
            .max(1)
            .min(self.points.len() - 1);
        let start = self.points[index - 1];
        let end = self.points[index];
        let distance = u64::from(self.cumulative[index] - self.cumulative[index - 1]);
        let travelled = u64::from(target - self.cumulative[index - 1]);
        let coordinate = |a: u16, b: u16| -> u16 {
            let numerator = (i64::from(b) - i64::from(a)) * travelled as i64;
            let magnitude = (numerator.unsigned_abs() + distance / 2) / distance;
            let displacement = magnitude as i64 * if numerator < 0 { -1 } else { 1 };
            (i64::from(a) + displacement) as u16
        };
        (coordinate(start.0, end.0), coordinate(start.1, end.1))
    }
}

/// Construct exclusively from the same trusted pilot collision/LOS planner.
/// This is not a gateway for client-authored geometry or live world maps.
pub fn pilot_inspection_plan(from: (u16, u16), to: (u16, u16)) -> Option<PilotInspectionPath> {
    PilotInspectionPath::prepare(pilot_inspection_route(from, to)?)
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
        .is_some_and(|slot| cached_routes()[slot].is_some())
}

/// Exact player/NPC conversation visibility for *authored pilot* rectangles.
///
/// Unlike the coarse 5-unit navigation/social sampling, this checks the
/// continuous segment in f64 (f32 server fighter coordinates are exact on
/// promotion). Grazing a rectangle edge or corner counts as obstructed.
/// O(3), allocation-free; no authoritative Greyhaven world/door claims.
pub fn pilot_chat_line_of_sight(from: (f32, f32), to: (u16, u16)) -> bool {
    if !from.0.is_finite()
        || !from.1.is_finite()
        || from.0 < 0.0
        || from.1 < 0.0
        || from.0 > f32::from(u16::MAX)
        || from.1 > f32::from(u16::MAX)
    {
        return false;
    }
    let (x, y) = (f64::from(from.0), f64::from(from.1));
    let (dx, dy) = (f64::from(to.0) - x, f64::from(to.1) - y);
    !PILOT_BARRIERS.iter().any(|r| {
        // Slab intersection of t in [0,1] with the CLOSED rectangle.
        let mut entry = 0.0_f64;
        let mut exit = 1.0_f64;
        for (start, delta, min, max) in [
            (x, dx, f64::from(r.x), f64::from(r.x + r.width)),
            (y, dy, f64::from(r.y), f64::from(r.y + r.height)),
        ] {
            if delta == 0.0 {
                if start < min || start > max {
                    return false;
                }
            } else {
                let a = (min - start) / delta;
                let b = (max - start) / delta;
                entry = entry.max(a.min(b));
                exit = exit.min(a.max(b));
                if entry > exit {
                    return false;
                }
            }
        }
        entry <= exit
    })
}

/// Inter-NPC encounters and guard lookout checks use the identical
/// closed-rectangle obstruction rule as authenticated player/NPC chat,
/// but only inside this isolated authored pilot geometry.
pub fn pilot_social_line_of_sight(from: (u16, u16), to: (u16, u16)) -> bool {
    pilot_chat_line_of_sight((f32::from(from.0), f32::from(from.1)), to)
}

/// Coarse sampling retained ONLY for existing staged navigation path checks;
/// never authorize a conversation, rumor, acquaintance or watch with it.
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

    #[test]
    fn prepared_pilot_detour_is_deterministic_and_stays_clear_at_every_tick() {
        let start = crate::npc_routines::NpcRoutines::position(3, 1380).unwrap();
        let planned = pilot_inspection_plan((start.x, start.y), (270, 220)).unwrap();
        assert_eq!(planned.cumulative.len(), planned.points.len());
        assert_eq!(planned.first().copied(), Some((start.x, start.y)));
        assert_eq!(planned.last().copied(), Some((270, 220)));
        assert!(planned.total > 0);
        assert!(planned.cumulative.windows(2).all(|part| part[1] > part[0]));
        assert_eq!(planned.position(0), (start.x, start.y));
        assert_eq!(planned.position(WALK_TICKS), (270, 220));
        assert_eq!(planned.position(WALK_TICKS + 1), (270, 220));
        for tick in 0..=WALK_TICKS {
            let sampled = planned.position(tick);
            let again = planned.position(tick);
            let old = pilot_inspection_position(&planned, tick).unwrap();
            assert_eq!(sampled, again);
            assert!(pilot_line_of_sight(sampled, sampled));
            assert!((i32::from(sampled.0) - i32::from(old.0)).abs() <= 1);
            assert!((i32::from(sampled.1) - i32::from(old.1)).abs() <= 1);
            if tick > 0 {
                let prev = planned.position(tick - 1);
                assert!((i32::from(sampled.0) - i32::from(prev.0)).abs() <= 2);
                assert!((i32::from(sampled.1) - i32::from(prev.1)).abs() <= 2);
            }
        }
    }

    #[test]
    fn fixed_point_precomputation_rejects_bad_and_unbounded_routes() {
        assert!(PilotInspectionPath::prepare(Vec::new()).is_none());
        assert!(PilotInspectionPath::prepare(vec![(10, 10), (10, 10)]).is_none());
        assert!(PilotInspectionPath::prepare(vec![(10, 10); 129]).is_none());
        // Extreme but individually representable steps exceed bounded
        // aggregate u32 distance; construction must fail without wrapping.
        let huge: Vec<_> = (0..128)
            .map(|i| {
                if i % 2 == 0 {
                    (0, 0)
                } else {
                    (u16::MAX, u16::MAX)
                }
            })
            .collect();
        assert!(PilotInspectionPath::prepare(huge).is_none());
        let still = PilotInspectionPath::prepare(vec![(270, 220)]).unwrap();
        assert_eq!(still.position(0), (270, 220));
        assert_eq!(still.position(600), (270, 220));
        let diagonal = PilotInspectionPath::prepare(vec![(100, 100), (105, 105)]).unwrap();
        assert_eq!(diagonal.position(300), (103, 103));
        assert_eq!(diagonal.position(600), (105, 105));
        assert!(pilot_inspection_plan((270, 220), (300, 230)).is_none());
    }

    #[test]
    fn all_authored_npc_routes_use_cached_integer_positions_without_changing_stops() {
        let prepared = cached_routes();
        assert!(std::ptr::eq(prepared, cached_routes()));
        for (slot, &(id, start, end)) in ROUTES.iter().enumerate() {
            let fixed = prepared[slot].as_ref().expect("authored route");
            let reference = routes()[slot].as_ref().expect("authored reference");
            assert_eq!(
                fixed.first().copied(),
                Some((start.0 as u16, start.1 as u16))
            );
            assert_eq!(fixed.last().copied(), Some((end.0 as u16, end.1 as u16)));
            assert!(fixed.len() <= 128);
            assert!(fixed
                .cumulative
                .windows(2)
                .all(|window| window[0] < window[1]));
            assert_eq!(position(id, 0), Some((start.0 as u16, start.1 as u16)));
            assert_eq!(position(id, WALK_TICKS), Some((end.0 as u16, end.1 as u16)));
            for tick in 0..=WALK_TICKS {
                let actual = position(id, tick).unwrap();
                let baseline = path_point(reference, tick);
                assert!(
                    (i32::from(actual.0) - i32::from(baseline.0)).abs() <= 1,
                    "id={id} tick={tick} x"
                );
                assert!(
                    (i32::from(actual.1) - i32::from(baseline.1)).abs() <= 1,
                    "id={id} tick={tick} y"
                );
                assert_eq!(Some(actual), position(id, tick));
                assert!(!blocked(i32::from(actual.0), i32::from(actual.1)));
                if tick > 0 {
                    let previous = position(id, tick - 1).unwrap();
                    assert!((i32::from(actual.0) - i32::from(previous.0)).abs() <= 2);
                    assert!((i32::from(actual.1) - i32::from(previous.1)).abs() <= 2);
                }
            }
        }
    }

    #[test]
    fn worker_pickup_delivery_and_forge_posts_remain_exact_at_authorized_ticks() {
        // Supply execution is gated by each trusted worksite's fixed reach.
        // Cached-route rounding must preserve exact pilot end positions.
        assert_eq!(position(5, 600), Some((340, 255)));
        assert_eq!(position(5, 0), Some((270, 220)));
        assert_eq!(position(4, 600), Some((395, 150)));
        assert_eq!(position(4, 0), Some((315, 110)));
        assert_eq!(position(3, 600), Some((275, 190)));
        assert_eq!(position(3, 0), Some((155, 205)));
        assert!(pilot_line_of_sight(position(5, 600).unwrap(), (340, 255)));
        assert!(pilot_line_of_sight(position(4, 600).unwrap(), (395, 150)));
        assert!(valid_route(3) && valid_route(4) && valid_route(5));
        assert!(!valid_route(1) && !valid_route(2) && !valid_route(99));
    }

    #[test]
    fn continuous_chat_rays_reject_corner_grazes_missed_by_five_unit_sampling() {
        // These narrow crossings are between the old 5-unit samples, so
        // previously an unobstructed *false positive* could be authorized.
        // Every endpoint is inside the established 180-unit speak circle.
        let cases = [
            ((257.174_f32, 142.377_f32), (155_u16, 205_u16)), // watch barricade
            ((178.291, 129.519), (270, 220)),                 // same barricade
            ((369.496, 182.511), (315, 110)),                 // market stall
            ((283.455, 223.230), (395, 150)),                 // supply crate
        ];
        for (from, to) in cases {
            assert!(
                pilot_line_of_sight((from.0.round() as u16, from.1.round() as u16), to),
                "test fixture must expose coarse-sampling miss: {from:?} -> {to:?}"
            );
            assert!(
                !pilot_chat_line_of_sight(from, to),
                "continuous collision must block: {from:?} -> {to:?}"
            );
        }
    }

    #[test]
    fn exact_chat_rays_preserve_clear_approaches_and_boundary_denials() {
        assert!(pilot_chat_line_of_sight((270.0, 45.0), (270, 220)));
        assert!(pilot_chat_line_of_sight((155.0, 100.0), (155, 205)));
        assert!(pilot_chat_line_of_sight((315.0, 65.0), (315, 110)));
        assert!(pilot_chat_line_of_sight((270.0, 220.0), (270, 220)));
        // Closed rectangle: exactly touching a corner counts as obstructed,
        // including if the source begins on the obstacle's edge.
        assert!(!pilot_chat_line_of_sight((195.0, 180.0), (155, 205)));
        assert!(!pilot_chat_line_of_sight((230.0, 215.0), (155, 205)));
        assert!(!pilot_chat_line_of_sight((210.0, 195.0), (210, 195)));
        // Outside our pilot integer world, invalid fighter floats fail closed.
        for from in [
            (-1.0, 205.0),
            (f32::NAN, 205.0),
            (155.0, f32::INFINITY),
            (65536.0, 205.0),
        ] {
            assert!(!pilot_chat_line_of_sight(from, (155, 205)));
        }
    }

    #[test]
    fn exact_social_visibility_rejects_corner_grazing_old_pilot_gossip_allowed() {
        // These *integer* staging positions can be near enough for NPC
        // gossip, yet the old five-unit sampler misses a closed corner.
        let cases = [
            ((293, 245), (314, 272)), // supply crate
            ((315, 187), (402, 133)), // market stall
            ((229, 179), (290, 257)), // watch barricade
            ((320, 276), (270, 220)), // guard-to-work-yard lookout
        ];
        for (from, to) in cases {
            assert!(
                pilot_line_of_sight(from, to),
                "coarse reference should miss corner: {from:?}->{to:?}"
            );
            assert!(
                !pilot_social_line_of_sight(from, to),
                "new social check must block corner: {from:?}->{to:?}"
            );
            assert!(
                !pilot_social_line_of_sight(to, from),
                "contact must not depend on direction: {to:?}->{from:?}"
            );
        }
        assert!(pilot_social_line_of_sight((270, 275), (270, 220)));
        assert!(pilot_social_line_of_sight((120, 95), (210, 65)));
        assert!(!pilot_social_line_of_sight((275, 190), (340, 255)));
    }
}
