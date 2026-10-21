//! First Playable P0: inactive, read-only pickup range and line-of-sight kernel.
//!
//! The caller MUST supply same-tick, server-authenticated actor/item locations and
//! a complete World-owned solid-geometry window fenced by Core 8C. This module
//! neither authenticates an item nor authorizes a pickup transaction, and is NOT
//! registered with /game until its consumers are reviewed. Rendering is never
//! a geometry authority.

pub const MAX_PICKUP_REACH: f32 = 96.0;
pub const MAX_SOLIDS_PER_WINDOW: usize = 128;
const MAX_WORLD_COORDINATE: f32 = 1_000_000.0;
const MAX_AUTHORITY_COUNTER: u64 = i64::MAX as u64;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GeometryFence {
    pub zone_id: u32,
    pub worker_epoch: u64,
    pub map_revision: u64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct WorldPoint {
    pub zone_id: u32,
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SolidRect {
    pub min_x: f32,
    pub min_y: f32,
    pub max_x: f32,
    pub max_y: f32,
}

#[derive(Debug, Clone, Copy)]
pub struct GeometryWindow<'a> {
    pub fence: GeometryFence,
    /// Asserted by the trusted World/Core provider, never by the client.
    /// Must include EVERY solid intersecting the actor-to-item segment.
    pub complete: bool,
    pub bounds: SolidRect,
    /// Only physically solid authored objects; never decorative sprites or
    /// a whole building footprint that includes an open doorway.
    pub solids: &'a [SolidRect],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PickupGeometryReject {
    StaleAuthority,
    IncompleteGeometry,
    InvalidGeometry,
    InvalidInput,
    OutOfRange,
    Occluded,
}

fn valid_coord(n: f32) -> bool {
    n.is_finite() && n.abs() <= MAX_WORLD_COORDINATE
}

fn valid_rect(rect: &SolidRect) -> bool {
    valid_coord(rect.min_x)
        && valid_coord(rect.min_y)
        && valid_coord(rect.max_x)
        && valid_coord(rect.max_y)
        && rect.min_x < rect.max_x
        && rect.min_y < rect.max_y
}

fn within_bounds(point: WorldPoint, bounds: &SolidRect) -> bool {
    point.x >= bounds.min_x
        && point.x <= bounds.max_x
        && point.y >= bounds.min_y
        && point.y <= bounds.max_y
}

/// Closed segment vs closed solid AABB. Wall grazing and endpoints on a solid
/// are blocked (never assume the sword is reachable through a thin barrier).
fn crosses_solid(from: WorldPoint, to: WorldPoint, solid: &SolidRect) -> bool {
    let mut enter = 0.0_f32;
    let mut exit = 1.0_f32;
    for (start, delta, low, high) in [
        (from.x, to.x - from.x, solid.min_x, solid.max_x),
        (from.y, to.y - from.y, solid.min_y, solid.max_y),
    ] {
        if delta == 0.0 {
            if start < low || start > high {
                return false;
            }
        } else {
            let a = (low - start) / delta;
            let b = (high - start) / delta;
            enter = enter.max(a.min(b));
            exit = exit.min(a.max(b));
            if enter > exit {
                return false;
            }
        }
    }
    exit >= 0.0 && enter <= 1.0
}

/// Read-only geometry prerequisite for an authoritative TryPickup operation.
///
/// Only Core 8C can determine the *current* zone/epoch/map revision. The caller
/// MUST revalidate its current fence and the actor/item's committed positions
/// inside the same authoritative operation that decides item ownership; passing
/// a forged or stale "expected_current" does not confer authority. Combat owns
/// alive/action validity, 8B/Items owns item identity and exclusive commit, 8A
/// owns session authentication. No client coordinates or rendering hitboxes.
///
/// A zone_id of 0 is permitted for the legacy single-zone arena; worker epoch
/// must be positive. Revision 0 is valid for an initial Core world-state record.
pub fn verify_pickup_geometry(
    actor: WorldPoint,
    sword: WorldPoint,
    window: &GeometryWindow<'_>,
    expected_current: GeometryFence,
    reach: f32,
) -> Result<(), PickupGeometryReject> {
    if expected_current.worker_epoch == 0
        || expected_current.worker_epoch > MAX_AUTHORITY_COUNTER
        || expected_current.map_revision > MAX_AUTHORITY_COUNTER
        || window.fence != expected_current
        || actor.zone_id != expected_current.zone_id
        || sword.zone_id != expected_current.zone_id
    {
        return Err(PickupGeometryReject::StaleAuthority);
    }
    if !window.complete || window.solids.len() > MAX_SOLIDS_PER_WINDOW {
        return Err(PickupGeometryReject::IncompleteGeometry);
    }
    if !valid_rect(&window.bounds) || window.solids.iter().any(|r| !valid_rect(r)) {
        return Err(PickupGeometryReject::InvalidGeometry);
    }
    if !valid_coord(actor.x)
        || !valid_coord(actor.y)
        || !valid_coord(sword.x)
        || !valid_coord(sword.y)
        || !reach.is_finite()
        || !(0.0..=MAX_PICKUP_REACH).contains(&reach)
        || reach == 0.0
        || !within_bounds(actor, &window.bounds)
        || !within_bounds(sword, &window.bounds)
    {
        return Err(PickupGeometryReject::InvalidInput);
    }
    let dx = sword.x - actor.x;
    let dy = sword.y - actor.y;
    if dx.mul_add(dx, dy * dy) > reach * reach {
        return Err(PickupGeometryReject::OutOfRange);
    }
    if window
        .solids
        .iter()
        .any(|solid| crosses_solid(actor, sword, solid))
    {
        return Err(PickupGeometryReject::Occluded);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const CURRENT: GeometryFence = GeometryFence {
        zone_id: 7,
        worker_epoch: 11,
        map_revision: 23,
    };
    const BOUNDS: SolidRect = SolidRect {
        min_x: 3600.0,
        min_y: 3800.0,
        max_x: 4000.0,
        max_y: 4100.0,
    };
    const WALL: SolidRect = SolidRect {
        min_x: 3724.0,
        min_y: 3900.0,
        max_x: 3734.0,
        max_y: 3980.0,
    };
    fn actor() -> WorldPoint {
        WorldPoint { zone_id: 7, x: 3700.0, y: 3940.0 }
    }
    fn sword() -> WorldPoint {
        WorldPoint { zone_id: 7, x: 3752.0, y: 3940.0 }
    }
    fn window<'a>(solids: &'a [SolidRect]) -> GeometryWindow<'a> {
        GeometryWindow {
            fence: CURRENT, complete: true, bounds: BOUNDS, solids
        }
    }

    #[test]
    fn same_zone_visible_rack_sword_is_in_reach() {
        let empty = window(&[]);
        assert_eq!(verify_pickup_geometry(actor(), sword(), &empty, CURRENT, 64.0), Ok(()));
        // The kernel only reads positions; pickup / equipment remain unchanged.
        let before = (actor(), sword());
        let _ = verify_pickup_geometry(actor(), sword(), &empty, CURRENT, 64.0);
        assert_eq!(before, (actor(), sword()));
    }

    #[test]
    fn same_sword_through_a_wall_is_not_reachable() {
        assert_eq!(
            verify_pickup_geometry(actor(), sword(), &window(&[WALL]), CURRENT, 64.0),
            Err(PickupGeometryReject::Occluded)
        );
    }

    #[test]
    fn genuinely_open_doorway_allows_pickup_and_solid_panels_do_not() {
        let top = SolidRect { min_x: 3724.0, min_y: 3900.0, max_x: 3734.0, max_y: 3922.0 };
        let bottom = SolidRect { min_x: 3724.0, min_y: 3958.0, max_x: 3734.0, max_y: 3980.0 };
        assert_eq!(
            verify_pickup_geometry(actor(), sword(), &window(&[top, bottom]), CURRENT, 64.0),
            Ok(())
        );
        let mut below_gap = actor();
        below_gap.y = 3966.0;
        assert_eq!(
            verify_pickup_geometry(below_gap, sword(), &window(&[top, bottom]), CURRENT, 64.0),
            Err(PickupGeometryReject::Occluded)
        );
    }

    #[test]
    fn close_corner_touch_and_wall_endpoint_fail_closed() {
        let tangent = SolidRect { min_x: 3724.0, min_y: 3940.0, max_x: 3734.0, max_y: 3950.0 };
        assert_eq!(
            verify_pickup_geometry(actor(), sword(), &window(&[tangent]), CURRENT, 64.0),
            Err(PickupGeometryReject::Occluded)
        );
        let on_wall = WorldPoint { x: 3724.0, ..sword() };
        assert_eq!(
            verify_pickup_geometry(actor(), on_wall, &window(&[WALL]), CURRENT, 64.0),
            Err(PickupGeometryReject::Occluded)
        );
    }

    #[test]
    fn range_is_server_bounded_even_if_client_claims_a_long_reach() {
        assert_eq!(
            verify_pickup_geometry(actor(), sword(), &window(&[]), CURRENT, 50.0),
            Err(PickupGeometryReject::OutOfRange)
        );
        assert_eq!(
            verify_pickup_geometry(actor(), sword(), &window(&[]), CURRENT, 500.0),
            Err(PickupGeometryReject::InvalidInput)
        );
        assert_eq!(
            verify_pickup_geometry(actor(), sword(), &window(&[]), CURRENT, f32::NAN),
            Err(PickupGeometryReject::InvalidInput)
        );
    }

    #[test]
    fn stale_epoch_revision_or_wrong_zone_are_rejected() {
        let mut old = CURRENT;
        old.worker_epoch -= 1;
        assert_eq!(
            verify_pickup_geometry(actor(), sword(), &window(&[]), old, 64.0),
            Err(PickupGeometryReject::StaleAuthority)
        );
        let mut old = CURRENT;
        old.map_revision -= 1;
        assert_eq!(
            verify_pickup_geometry(actor(), sword(), &window(&[]), old, 64.0),
            Err(PickupGeometryReject::StaleAuthority)
        );
        let wrong = WorldPoint { zone_id: 8, ..sword() };
        assert_eq!(
            verify_pickup_geometry(actor(), wrong, &window(&[]), CURRENT, 64.0),
            Err(PickupGeometryReject::StaleAuthority)
        );
        let zero_epoch = GeometryFence { worker_epoch: 0, ..CURRENT };
        assert_eq!(
            verify_pickup_geometry(actor(), sword(), &window(&[]), zero_epoch, 64.0),
            Err(PickupGeometryReject::StaleAuthority)
        );
    }

    #[test]
    fn incomplete_or_oversized_solid_manifest_fails_closed() {
        let mut missing = window(&[]);
        missing.complete = false;
        assert_eq!(
            verify_pickup_geometry(actor(), sword(), &missing, CURRENT, 64.0),
            Err(PickupGeometryReject::IncompleteGeometry)
        );
        let solids = [WALL; MAX_SOLIDS_PER_WINDOW + 1];
        assert_eq!(
            verify_pickup_geometry(actor(), sword(), &window(&solids), CURRENT, 64.0),
            Err(PickupGeometryReject::IncompleteGeometry)
        );
    }

    #[test]
    fn malformed_geometry_or_nonfinite_positions_are_rejected() {
        let bad = SolidRect { max_x: f32::INFINITY, ..WALL };
        assert_eq!(
            verify_pickup_geometry(actor(), sword(), &window(&[bad]), CURRENT, 64.0),
            Err(PickupGeometryReject::InvalidGeometry)
        );
        let nan_actor = WorldPoint { x: f32::NAN, ..actor() };
        assert_eq!(
            verify_pickup_geometry(nan_actor, sword(), &window(&[]), CURRENT, 64.0),
            Err(PickupGeometryReject::InvalidInput)
        );
        let out_of_bounds = WorldPoint { x: 4101.0, ..sword() };
        assert_eq!(
            verify_pickup_geometry(actor(), out_of_bounds, &window(&[]), CURRENT, 64.0),
            Err(PickupGeometryReject::InvalidInput)
        );
    }

    #[test]
    fn legacy_zone_zero_and_new_world_revision_zero_are_supported() {
        let legacy = GeometryFence { zone_id: 0, worker_epoch: 1, map_revision: 0 };
        let mut empty = window(&[]);
        empty.fence = legacy;
        let zero_actor = WorldPoint { zone_id: 0, ..actor() };
        let zero_sword = WorldPoint { zone_id: 0, ..sword() };
        assert_eq!(
            verify_pickup_geometry(zero_actor, zero_sword, &empty, legacy, 64.0),
            Ok(())
        );
    }
}
