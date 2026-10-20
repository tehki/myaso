//! Deterministic LW-1D NPC pilot navigation over explicitly authored test obstacles.
//! These rectangles are *not* live Greyhaven/world combat collision geometry.
//! The paths are computed on a bounded grid once per process; no user inputs.
use crate::PROTOCOL_VERSION;
use std::cmp::Reverse;
use std::collections::BinaryHeap;
use std::sync::OnceLock;

pub const OBSTACLE_PACKET_TYPE: u8 = 10;
pub const GRID_STEP: i32 = 5;
const MIN_X: i32 = 60;
const MIN_Y: i32 = 30;
const MAX_X: i32 = 460;
const MAX_Y: i32 = 320;
const GRID_WIDTH: usize = ((MAX_X - MIN_X) / GRID_STEP + 1) as usize;
const GRID_HEIGHT: usize = ((MAX_Y - MIN_Y) / GRID_STEP + 1) as usize;
const GRID_SIZE: usize = GRID_WIDTH * GRID_HEIGHT;
const PERSONAL_SPACE: i32 = 8;
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

fn position_for(index: usize) -> (i32, i32) {
    (
        MIN_X + (index % GRID_WIDTH) as i32 * GRID_STEP,
        MIN_Y + (index / GRID_WIDTH) as i32 * GRID_STEP,
    )
}
fn index_for(x: i32, y: i32) -> Option<usize> {
    if !(MIN_X..=MAX_X).contains(&x)
        || !(MIN_Y..=MAX_Y).contains(&y)
        || (x - MIN_X) % GRID_STEP != 0
        || (y - MIN_Y) % GRID_STEP != 0
    {
        return None;
    }
    Some(((y - MIN_Y) / GRID_STEP) as usize * GRID_WIDTH + ((x - MIN_X) / GRID_STEP) as usize)
}
fn blocked(x: i32, y: i32) -> bool {
    PILOT_BARRIERS.iter().any(|barrier| {
        x >= i32::from(barrier.x) - PERSONAL_SPACE
            && y >= i32::from(barrier.y) - PERSONAL_SPACE
            && x <= i32::from(barrier.x + barrier.width) + PERSONAL_SPACE
            && y <= i32::from(barrier.y + barrier.height) + PERSONAL_SPACE
    })
}

fn shortest_route(start: (i32, i32), end: (i32, i32)) -> Option<Path> {
    let source = index_for(start.0, start.1)?;
    let target = index_for(end.0, end.1)?;
    if blocked(start.0, start.1) || blocked(end.0, end.1) {
        return None;
    }

    let mut distance = vec![u32::MAX; GRID_SIZE];
    let mut previous = vec![None; GRID_SIZE];
    let mut frontier = BinaryHeap::new();
    distance[source] = 0;
    frontier.push(Reverse((0_u32, source)));
    const STEPS: [(i32, i32, u32); 8] = [
        (1, 0, 10),
        (0, 1, 10),
        (-1, 0, 10),
        (0, -1, 10),
        (1, 1, 14),
        (-1, 1, 14),
        (-1, -1, 14),
        (1, -1, 14),
    ];
    while let Some(Reverse((cost, index))) = frontier.pop() {
        if index == target {
            break;
        }
        if cost != distance[index] {
            continue;
        }
        let (x, y) = position_for(index);
        for (dx, dy, step_cost) in STEPS {
            let next_x = x + dx * GRID_STEP;
            let next_y = y + dy * GRID_STEP;
            let Some(neighbor) = index_for(next_x, next_y) else {
                continue;
            };
            if blocked(next_x, next_y)
                || (dx != 0
                    && dy != 0
                    && (blocked(x + dx * GRID_STEP, y) || blocked(x, y + dy * GRID_STEP)))
            {
                continue;
            }
            let next_cost = cost + step_cost;
            if next_cost < distance[neighbor] {
                distance[neighbor] = next_cost;
                previous[neighbor] = Some(index);
                frontier.push(Reverse((next_cost, neighbor)));
            }
        }
    }
    if distance[target] == u32::MAX {
        return None;
    }
    let mut path = vec![end];
    let mut cursor = target;
    while cursor != source {
        cursor = previous[cursor]?;
        path.push(position_for(cursor));
        if path.len() > GRID_SIZE {
            return None;
        }
    }
    path.reverse();
    Some(path)
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
pub fn valid_route(id: u8) -> bool {
    ROUTES
        .iter()
        .position(|route| route.0 == id)
        .is_some_and(|slot| routes()[slot].is_some())
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
    fn packet_is_strict_compact_and_coordinate_bounded() {
        let packet = obstacle_packet();
        assert_eq!(packet.len(), 4 + 3 * 8);
        assert_eq!(&packet[..4], &[1, 10, 3, 0]);
        assert_eq!(&packet[4..8], &[195, 0, 180, 0]);
    }
}
