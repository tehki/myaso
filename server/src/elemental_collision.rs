//! P3: inactive swept-circle/AABB resolution for server-proposed magic impulses.
//! Only a trusted map-revision owner may supply a *complete* collision window.
//! No live world, player position, damage, inventory or transport is mutated.

use crate::elemental_physics::{ImpulseTarget, ProposedDisplacement};

pub const MAX_COLLIDERS_PER_WINDOW: usize = 64;
pub const COLLISION_MARGIN: f32 = 0.125;
const MAX_WORLD_COORD: f32 = 1_000_000.0;
const MAX_MOTION: f32 = 64.0;
const MAX_BODY_RADIUS: f32 = 128.0;

#[derive(Debug, Clone, Copy)]
pub struct StaticBarrier {
    pub min_x: f32,
    pub min_y: f32,
    pub max_x: f32,
    pub max_y: f32,
}

#[derive(Debug, Clone, Copy)]
pub struct CollisionWindow<'a> {
    pub zone_id: u32,
    pub revision: u64,
    /// The manifest producer, not a player, must assert all blocking geometry
    /// within these bounds is included in the barriers slice.
    pub complete: bool,
    pub min_x: f32,
    pub min_y: f32,
    pub max_x: f32,
    pub max_y: f32,
    pub barriers: &'a [StaticBarrier],
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ResolvedDisplacement {
    pub entity_id: u32,
    pub dx: f32,
    pub dy: f32,
    pub blocked: bool,
}

fn coord(value: f32) -> bool {
    value.is_finite() && value.abs() <= MAX_WORLD_COORD
}

fn rect_valid(min_x: f32, min_y: f32, max_x: f32, max_y: f32) -> bool {
    coord(min_x) && coord(min_y) && coord(max_x) && coord(max_y)
        && min_x < max_x && min_y < max_y
}

fn inside_bounds(x: f32, y: f32, r: f32, window: &CollisionWindow<'_>) -> bool {
    x >= window.min_x + r
        && y >= window.min_y + r
        && x <= window.max_x - r
        && y <= window.max_y - r
}

// Slab raycast of a point center against the barrier inflated by body radius.
// A starting overlap fails closed at time 0; a grazing touch is also a collision.
fn entry_fraction(
    x: f32,
    y: f32,
    dx: f32,
    dy: f32,
    radius: f32,
    barrier: &StaticBarrier,
) -> Option<f32> {
    let min_x = barrier.min_x - radius;
    let min_y = barrier.min_y - radius;
    let max_x = barrier.max_x + radius;
    let max_y = barrier.max_y + radius;

    if x >= min_x && x <= max_x && y >= min_y && y <= max_y {
        return Some(0.0);
    }

    let mut enter: f32 = 0.0;
    let mut exit: f32 = 1.0;
    for (position, delta, low, high) in [
        (x, dx, min_x, max_x),
        (y, dy, min_y, max_y),
    ] {
        if delta == 0.0 {
            if position < low || position > high {
                return None;
            }
        } else {
            let a = (low - position) / delta;
            let b = (high - position) / delta;
            enter = enter.max(a.min(b));
            exit = exit.min(a.max(b));
            if enter > exit {
                return None;
            }
        }
    }
    (exit >= 0.0 && enter <= 1.0).then_some(enter)
}

/// Resolve a *trusted* server-generated P1 impulse against a complete,
/// revision-pinned collision window. None = invalid/stale/incomplete geometry;
/// blocked movement instead returns an explicit zero/short displacement.
///
/// This MUST NOT be called with client-provided barriers or as an authority
/// decision for a player spell; source authentication, cooldown and mana are
/// separate prerequisites. No broadphase/zone paging is present in P3.
pub fn clip_radial_impulse(
    proposal: &ProposedDisplacement,
    target: &ImpulseTarget,
    window: &CollisionWindow<'_>,
    expected_revision: u64,
) -> Option<ResolvedDisplacement> {
    if target.entity_id == 0
        || target.entity_id != proposal.entity_id
        || target.zone_id == 0
        || target.zone_id != window.zone_id
        || !target.mobile
        || expected_revision == 0
        || window.revision != expected_revision
        || !window.complete
        || window.barriers.len() > MAX_COLLIDERS_PER_WINDOW
        || !rect_valid(window.min_x, window.min_y, window.max_x, window.max_y)
        || !coord(target.x)
        || !coord(target.y)
        || !target.collider_radius.is_finite()
        || !(0.0..=MAX_BODY_RADIUS).contains(&target.collider_radius)
        || !proposal.dx.is_finite()
        || !proposal.dy.is_finite()
    {
        return None;
    }
    let radius = target.collider_radius;
    let distance = proposal.dx.hypot(proposal.dy);
    if !distance.is_finite() || distance > MAX_MOTION {
        return None;
    }
    // Refuse incomplete collision coverage: no speculative edge crossings.
    if !inside_bounds(target.x, target.y, radius, window)
        || !inside_bounds(target.x + proposal.dx, target.y + proposal.dy, radius, window)
    {
        return None;
    }

    let mut hit_at: Option<f32> = None;
    for barrier in window.barriers {
        if !rect_valid(barrier.min_x, barrier.min_y, barrier.max_x, barrier.max_y) {
            return None;
        }
        if let Some(entry) = entry_fraction(
            target.x,
            target.y,
            proposal.dx,
            proposal.dy,
            radius,
            barrier,
        ) {
            hit_at = Some(hit_at.map_or(entry, |earlier| earlier.min(entry)));
        }
    }

    let fraction = hit_at
        .map(|t| (t - COLLISION_MARGIN / distance.max(COLLISION_MARGIN)).max(0.0))
        .unwrap_or(1.0);
    Some(ResolvedDisplacement {
        entity_id: target.entity_id,
        dx: proposal.dx * fraction,
        dy: proposal.dy * fraction,
        blocked: hit_at.is_some(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const WALL: StaticBarrier = StaticBarrier {
        min_x: 152.0,
        min_y: 80.0,
        max_x: 162.0,
        max_y: 120.0,
    };

    fn target() -> ImpulseTarget {
        ImpulseTarget {
            entity_id: 3,
            zone_id: 7,
            x: 140.0,
            y: 100.0,
            collider_radius: 4.0,
            mobile: true,
        }
    }

    fn window<'a>(barriers: &'a [StaticBarrier]) -> CollisionWindow<'a> {
        CollisionWindow {
            zone_id: 7,
            revision: 91,
            complete: true,
            min_x: 0.0,
            min_y: 0.0,
            max_x: 400.0,
            max_y: 400.0,
            barriers,
        }
    }

    fn impulse(dx: f32, dy: f32) -> ProposedDisplacement {
        ProposedDisplacement {
            entity_id: 3,
            dx,
            dy,
        }
    }

    #[test]
    fn clear_corridor_keeps_server_proposed_displacement() {
        assert_eq!(
            clip_radial_impulse(&impulse(24.0, 0.0), &target(), &window(&[]), 91),
            Some(ResolvedDisplacement {
                entity_id: 3,
                dx: 24.0,
                dy: 0.0,
                blocked: false,
            })
        );
    }

    #[test]
    fn swept_body_stops_before_wall_instead_of_tunneling_through_it() {
        let result = clip_radial_impulse(&impulse(24.0, 0.0), &target(), &window(&[WALL]), 91)
            .unwrap();
        assert!(result.blocked);
        assert!(result.dx >= 0.0 && result.dx < 8.0);
        assert_eq!(result.dy, 0.0);
        assert!(target().x + result.dx + target().collider_radius < WALL.min_x);
    }

    #[test]
    fn starting_inside_collider_does_not_teleport_player() {
        let mut t = target();
        t.x = 153.0;
        assert_eq!(
            clip_radial_impulse(&impulse(24.0, 0.0), &t, &window(&[WALL]), 91),
            Some(ResolvedDisplacement {
                entity_id: 3,
                dx: 0.0,
                dy: 0.0,
                blocked: true,
            })
        );
    }

    #[test]
    fn diagonal_path_checks_obstacles_across_both_axes() {
        let diagonal_barrier = StaticBarrier {
            min_x: 145.0,
            min_y: 105.0,
            max_x: 175.0,
            max_y: 135.0,
        };
        let resolved = clip_radial_impulse(
            &impulse(30.0, 30.0),
            &target(),
            &window(&[diagonal_barrier]),
            91,
        )
        .unwrap();
        assert!(resolved.blocked);
        assert!(resolved.dx < 30.0);
        assert!(resolved.dy < 30.0);
    }

    #[test]
    fn expired_revision_unknown_zone_and_incomplete_window_refuse_motion() {
        assert!(clip_radial_impulse(&impulse(10.0, 0.0), &target(), &window(&[]), 90).is_none());
        let mut window = window(&[]);
        window.complete = false;
        assert!(clip_radial_impulse(&impulse(10.0, 0.0), &target(), &window, 91).is_none());
        window.complete = true;
        window.zone_id = 8;
        assert!(clip_radial_impulse(&impulse(10.0, 0.0), &target(), &window, 91).is_none());
    }

    #[test]
    fn edges_and_invalid_geometry_fail_closed() {
        let near_edge = impulse(-150.0, 0.0);
        assert!(clip_radial_impulse(&near_edge, &target(), &window(&[]), 91).is_none());
        let bad = impulse(f32::NAN, 0.0);
        assert!(clip_radial_impulse(&bad, &target(), &window(&[]), 91).is_none());
        let big = impulse(65.0, 0.0);
        assert!(clip_radial_impulse(&big, &target(), &window(&[]), 91).is_none());
        let invalid_barrier = StaticBarrier {
            min_x: 10.0,
            min_y: 10.0,
            max_x: f32::INFINITY,
            max_y: 20.0,
        };
        assert!(clip_radial_impulse(
            &impulse(4.0, 0.0),
            &target(),
            &window(&[invalid_barrier]),
            91,
        )
        .is_none());
    }

    #[test]
    fn collider_budget_rejects_unbounded_collision_windows() {
        let too_many = [WALL; MAX_COLLIDERS_PER_WINDOW + 1];
        assert!(clip_radial_impulse(&impulse(10.0, 0.0), &target(), &window(&too_many), 91).is_none());
    }

    #[test]
    fn p1_radial_impulse_can_be_clipped_without_changing_fighter_state() {
        use crate::elemental_physics::{radial_impulse, AuthoritativeImpulse, Element};

        let source = AuthoritativeImpulse {
            zone_id: 7,
            origin_x: 100.0,
            origin_y: 100.0,
            radius: 90.0,
            displacement: 40.0,
            seed: 1,
            element: Element::Wind,
        };
        let t = target();
        let before = (t.x, t.y);
        let proposal = radial_impulse(&source, &t).unwrap();
        let resolved = clip_radial_impulse(&proposal, &t, &window(&[WALL]), 91).unwrap();
        assert!(resolved.blocked);
        assert!(resolved.dx > 0.0);
        assert!(resolved.dx < proposal.dx);
        assert_eq!((t.x, t.y), before);
    }

    #[test]
    fn target_and_proposal_must_refer_to_same_mobile_entity() {
        let mut target = target();
        target.mobile = false;
        assert!(clip_radial_impulse(&impulse(10.0, 0.0), &target, &window(&[]), 91).is_none());
        target.mobile = true;
        assert!(clip_radial_impulse(
            &ProposedDisplacement { entity_id: 99, dx: 10.0, dy: 0.0 },
            &target,
            &window(&[]),
            91,
        ).is_none());
    }
}
