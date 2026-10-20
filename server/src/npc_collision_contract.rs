//! LW-1E: bounded server-owned collider contract for NPC route planning.
//!
//! No client-supplied rectangles or visual-only map data may enter this module.
//! World/door collision authority must expose an approved manifest before
//! NavigationSpace::Zone is wired to a running NPC. This module does not
//! integrate the still-unmerged World & Buildings Phase A/B/C branches.
use crate::zone::ZoneId;
use std::cmp::Reverse;
use std::collections::BinaryHeap;

pub const GRID_STEP: i32 = 5;
const MAX_WINDOW_CELLS: usize = 10_201;
const MAX_BLOCKERS: usize = 48;
const MAX_AXIS_CELLS: i32 = 101;
const AGENT_CLEARANCE: i32 = 8;
const COLLISION_MANIFEST_VERSION: u16 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NavigationSpace {
    /// Explicitly isolated loopback pilot; not map-manifest geometry.
    Pilot,
    /// Reserved for trusted authoritative collision manifest integration.
    Zone(ZoneId),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NavBounds {
    pub min_x: i32,
    pub min_y: i32,
    pub max_x: i32,
    pub max_y: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Collider {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

impl Collider {
    fn expanded_contains(self, x: i32, y: i32) -> bool {
        // Constructor validates 32-bit coordinate/width constraints before use.
        x >= self.x - AGENT_CLEARANCE
            && x <= self.x + self.width + AGENT_CLEARANCE
            && y >= self.y - AGENT_CLEARANCE
            && y <= self.y + self.height + AGENT_CLEARANCE
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NavigationError {
    InvalidVersion,
    InvalidRevision,
    InvalidBounds,
    TooManyBlockers,
    InvalidCollider,
    InvalidEndpoint,
    BlockedEndpoint,
    Unreachable,
}

#[derive(Debug, Clone)]
pub struct CollisionWindow {
    space: NavigationSpace,
    revision: u32,
    bounds: NavBounds,
    blockers: Vec<Collider>,
    width: usize,
    height: usize,
}

impl CollisionWindow {
    fn checked(
        space: NavigationSpace,
        version: u16,
        revision: u32,
        bounds: NavBounds,
        blockers: &[Collider],
    ) -> Result<Self, NavigationError> {
        if version != COLLISION_MANIFEST_VERSION {
            return Err(NavigationError::InvalidVersion);
        }
        if revision == 0 {
            return Err(NavigationError::InvalidRevision);
        }
        if bounds.min_x < 0
            || bounds.min_y < 0
            || bounds.max_x <= bounds.min_x
            || bounds.max_y <= bounds.min_y
        {
            return Err(NavigationError::InvalidBounds);
        }
        let dx = bounds.max_x - bounds.min_x;
        let dy = bounds.max_y - bounds.min_y;
        if dx % GRID_STEP != 0 || dy % GRID_STEP != 0 {
            return Err(NavigationError::InvalidBounds);
        }
        let cells_x = dx / GRID_STEP + 1;
        let cells_y = dy / GRID_STEP + 1;
        if cells_x > MAX_AXIS_CELLS
            || cells_y > MAX_AXIS_CELLS
            || (cells_x as usize) * (cells_y as usize) > MAX_WINDOW_CELLS
        {
            return Err(NavigationError::InvalidBounds);
        }
        if let NavigationSpace::Zone(zone) = space {
            let (max_zone_x, max_zone_y) = zone.bounds();
            // Leave authoritative fighter/NPC safety margin at world edges.
            if bounds.min_x < 18
                || bounds.min_y < 18
                || bounds.max_x > max_zone_x as i32 - 18
                || bounds.max_y > max_zone_y as i32 - 18
            {
                return Err(NavigationError::InvalidBounds);
            }
        }
        if blockers.len() > MAX_BLOCKERS {
            return Err(NavigationError::TooManyBlockers);
        }
        for barrier in blockers {
            if barrier.width <= 0
                || barrier.height <= 0
                || barrier.width > dx
                || barrier.height > dy
                || barrier.x < bounds.min_x
                || barrier.y < bounds.min_y
                || barrier
                    .x
                    .checked_add(barrier.width)
                    .is_none_or(|end| end > bounds.max_x)
                || barrier
                    .y
                    .checked_add(barrier.height)
                    .is_none_or(|end| end > bounds.max_y)
            {
                return Err(NavigationError::InvalidCollider);
            }
        }
        Ok(Self {
            space,
            revision,
            bounds,
            blockers: blockers.to_vec(),
            width: cells_x as usize,
            height: cells_y as usize,
        })
    }

    /// Only the trusted Rust zone/collision pipeline may call this with
    /// authoritative server-side colliders, never from browser scenery.
    pub fn from_server_collision_manifest(
        zone: ZoneId,
        version: u16,
        revision: u32,
        local_bounds: NavBounds,
        server_colliders: &[Collider],
    ) -> Result<Self, NavigationError> {
        Self::checked(
            NavigationSpace::Zone(zone),
            version,
            revision,
            local_bounds,
            server_colliders,
        )
    }

    pub(crate) fn pilot(bounds: NavBounds, blockers: &[Collider]) -> Result<Self, NavigationError> {
        Self::checked(NavigationSpace::Pilot, 1, 1, bounds, blockers)
    }

    pub fn space(&self) -> NavigationSpace {
        self.space
    }
    pub fn revision(&self) -> u32 {
        self.revision
    }

    fn grid_index(&self, x: i32, y: i32) -> Option<usize> {
        if x < self.bounds.min_x
            || x > self.bounds.max_x
            || y < self.bounds.min_y
            || y > self.bounds.max_y
            || (x - self.bounds.min_x) % GRID_STEP != 0
            || (y - self.bounds.min_y) % GRID_STEP != 0
        {
            return None;
        }
        Some(
            ((y - self.bounds.min_y) / GRID_STEP) as usize * self.width
                + ((x - self.bounds.min_x) / GRID_STEP) as usize,
        )
    }
    fn grid_position(&self, index: usize) -> (i32, i32) {
        (
            self.bounds.min_x + (index % self.width) as i32 * GRID_STEP,
            self.bounds.min_y + (index / self.width) as i32 * GRID_STEP,
        )
    }
    pub fn contains_obstacle(&self, x: i32, y: i32) -> bool {
        self.blockers
            .iter()
            .any(|barrier| barrier.expanded_contains(x, y))
    }

    pub fn plan(
        &self,
        source: (i32, i32),
        target: (i32, i32),
    ) -> Result<Vec<(i32, i32)>, NavigationError> {
        let first = self
            .grid_index(source.0, source.1)
            .ok_or(NavigationError::InvalidEndpoint)?;
        let last = self
            .grid_index(target.0, target.1)
            .ok_or(NavigationError::InvalidEndpoint)?;
        if self.contains_obstacle(source.0, source.1) || self.contains_obstacle(target.0, target.1)
        {
            return Err(NavigationError::BlockedEndpoint);
        }
        let size = self.width * self.height;
        let mut distance = vec![u32::MAX; size];
        let mut previous = vec![None; size];
        let mut frontier = BinaryHeap::new();
        distance[first] = 0;
        frontier.push(Reverse((0_u32, first)));
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
            if index == last {
                break;
            }
            if cost != distance[index] {
                continue;
            }
            let (x, y) = self.grid_position(index);
            for (dx, dy, step) in STEPS {
                let (next_x, next_y) = (x + dx * GRID_STEP, y + dy * GRID_STEP);
                let Some(neighbor) = self.grid_index(next_x, next_y) else {
                    continue;
                };
                if self.contains_obstacle(next_x, next_y)
                    || (dx != 0
                        && dy != 0
                        && (self.contains_obstacle(x + dx * GRID_STEP, y)
                            || self.contains_obstacle(x, y + dy * GRID_STEP)))
                {
                    continue;
                }
                let next_cost = cost + step;
                if next_cost < distance[neighbor] {
                    distance[neighbor] = next_cost;
                    previous[neighbor] = Some(index);
                    frontier.push(Reverse((next_cost, neighbor)));
                }
            }
        }
        if distance[last] == u32::MAX {
            return Err(NavigationError::Unreachable);
        }
        let mut path = vec![target];
        let mut cursor = last;
        while cursor != first {
            cursor = previous[cursor].ok_or(NavigationError::Unreachable)?;
            path.push(self.grid_position(cursor));
            if path.len() > size {
                return Err(NavigationError::Unreachable);
            }
        }
        path.reverse();
        Ok(path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const BOUNDS: NavBounds = NavBounds {
        min_x: 4100,
        min_y: 3900,
        max_x: 4500,
        max_y: 4200,
    };
    const BLOCKER: Collider = Collider {
        x: 4290,
        y: 3990,
        width: 70,
        height: 70,
    };
    fn trusted() -> CollisionWindow {
        CollisionWindow::from_server_collision_manifest(ZoneId::Moonvale, 1, 4, BOUNDS, &[BLOCKER])
            .unwrap()
    }

    #[test]
    fn builds_real_coordinate_windows_but_never_claims_live_map_integration() {
        let nav = trusted();
        assert_eq!(nav.space(), NavigationSpace::Zone(ZoneId::Moonvale));
        assert_eq!(nav.revision(), 4);
        let path = nav.plan((4250, 4025), (4390, 4025)).unwrap();
        assert!(path.len() > 29);
        assert!(path.iter().all(|p| !nav.contains_obstacle(p.0, p.1)));
        assert!(path
            .iter()
            .all(|p| p.0 >= 4100 && p.0 <= 4500 && p.1 >= 3900 && p.1 <= 4200));
    }

    #[test]
    fn rejects_stale_or_unversioned_and_invalid_world_windows() {
        assert_eq!(
            CollisionWindow::from_server_collision_manifest(ZoneId::Moonvale, 2, 4, BOUNDS, &[])
                .unwrap_err(),
            NavigationError::InvalidVersion
        );
        assert_eq!(
            CollisionWindow::from_server_collision_manifest(ZoneId::Moonvale, 1, 0, BOUNDS, &[])
                .unwrap_err(),
            NavigationError::InvalidRevision
        );
        assert_eq!(
            CollisionWindow::from_server_collision_manifest(ZoneId::RedLionInn, 1, 4, BOUNDS, &[])
                .unwrap_err(),
            NavigationError::InvalidBounds
        );
        let broad = NavBounds {
            min_x: 10,
            min_y: 20,
            max_x: 7000,
            max_y: 7100,
        };
        assert_eq!(
            CollisionWindow::from_server_collision_manifest(ZoneId::Moonvale, 1, 4, broad, &[])
                .unwrap_err(),
            NavigationError::InvalidBounds
        );
    }

    #[test]
    fn rejects_invalid_colliders_and_blocked_endpoints() {
        let outside = Collider {
            x: 4490,
            y: 4100,
            width: 60,
            height: 20,
        };
        assert_eq!(
            CollisionWindow::from_server_collision_manifest(
                ZoneId::Moonvale,
                1,
                4,
                BOUNDS,
                &[outside]
            )
            .unwrap_err(),
            NavigationError::InvalidCollider
        );
        assert_eq!(
            CollisionWindow::from_server_collision_manifest(
                ZoneId::Moonvale,
                1,
                4,
                BOUNDS,
                &[Collider {
                    width: 0,
                    ..BLOCKER
                }]
            )
            .unwrap_err(),
            NavigationError::InvalidCollider
        );
        let nav = trusted();
        assert_eq!(
            nav.plan((4300, 4010), (4390, 4025)).unwrap_err(),
            NavigationError::BlockedEndpoint
        );
        assert_eq!(
            nav.plan((4251, 4025), (4390, 4025)).unwrap_err(),
            NavigationError::InvalidEndpoint
        );
    }

    #[test]
    fn completely_blocked_corridor_is_unreachable_never_crosses_wall() {
        let stripe = Collider {
            x: 4320,
            y: 3900,
            width: 20,
            height: 300,
        };
        let nav = CollisionWindow::from_server_collision_manifest(
            ZoneId::Moonvale,
            1,
            5,
            BOUNDS,
            &[stripe],
        )
        .unwrap();
        assert_eq!(
            nav.plan((4250, 4050), (4400, 4050)).unwrap_err(),
            NavigationError::Unreachable
        );
    }

    #[test]
    fn fixed_budget_and_diagonal_corner_cut_prevention() {
        let blockers = vec![BLOCKER; MAX_BLOCKERS + 1];
        assert_eq!(
            CollisionWindow::from_server_collision_manifest(
                ZoneId::Moonvale,
                1,
                4,
                BOUNDS,
                &blockers
            )
            .unwrap_err(),
            NavigationError::TooManyBlockers
        );
        let corner = [
            Collider {
                x: 4180,
                y: 3990,
                width: 5,
                height: 5,
            },
            Collider {
                x: 4190,
                y: 4000,
                width: 5,
                height: 5,
            },
        ];
        let nav = CollisionWindow::from_server_collision_manifest(
            ZoneId::Moonvale,
            1,
            5,
            BOUNDS,
            &corner,
        )
        .unwrap();
        let path = nav.plan((4160, 4000), (4205, 4010)).unwrap();
        for pair in path.windows(2) {
            let (a, b) = (pair[0], pair[1]);
            if a.0 != b.0 && a.1 != b.1 {
                assert!(!nav.contains_obstacle(a.0, b.1));
                assert!(!nav.contains_obstacle(b.0, a.1));
            }
        }
    }
}
