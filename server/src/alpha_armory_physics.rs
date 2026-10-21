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
    pub zone_id: u64,
    pub worker_epoch: u64,
    pub map_revision: u64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct WorldPoint {
    pub zone_id: u64,
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
    StaleWorldTick,
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
    if expected_current.zone_id > MAX_AUTHORITY_COUNTER
        || expected_current.worker_epoch == 0
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


/// Source-tick equality prerequisite from the one trusted Core/Items writer.
///
/// Each tick MUST be sampled from the committed server-owned state while
/// holding the SAME operation boundary, never copied from browser input.
/// Matching numbers alone do not authenticate that lock or the source.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PickupTickFence {
    pub operation_tick: u32,
    pub actor_tick: u32,
    pub sword_tick: u32,
    pub geometry_tick: u32,
}

/// Stronger geometry prerequisite for the checked Items sword transaction.
///
/// Core 8C / Items must bind operation_tick to PickupWorldTick.completed_tick,
/// and obtain the actual Fighter, GroundDrop and complete LOS window from that
/// exact server tick *under the same exclusive mutation lock*. A visual
/// preview's older completed_tick cannot authorize a later pickup. A static
/// map can be stamped with the operation tick only after verifying its current
/// map revision and complete dynamic blocker coverage. These caller witnesses
/// are NOT authentication or proof of mutex/lease ownership.
pub fn verify_pickup_geometry_at_completed_tick(
    actor: WorldPoint,
    sword: WorldPoint,
    window: &GeometryWindow<'_>,
    expected_current: GeometryFence,
    reach: f32,
    ticks: PickupTickFence,
) -> Result<(), PickupGeometryReject> {
    if ticks.operation_tick == 0
        || ticks.actor_tick != ticks.operation_tick
        || ticks.sword_tick != ticks.operation_tick
        || ticks.geometry_tick != ticks.operation_tick
    {
        return Err(PickupGeometryReject::StaleWorldTick);
    }
    verify_pickup_geometry(actor, sword, window, expected_current, reach)
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
        WorldPoint {
            zone_id: 7,
            x: 3700.0,
            y: 3940.0,
        }
    }
    fn sword() -> WorldPoint {
        WorldPoint {
            zone_id: 7,
            x: 3752.0,
            y: 3940.0,
        }
    }
    fn window<'a>(solids: &'a [SolidRect]) -> GeometryWindow<'a> {
        GeometryWindow {
            fence: CURRENT,
            complete: true,
            bounds: BOUNDS,
            solids,
        }
    }

    #[test]
    fn same_zone_visible_rack_sword_is_in_reach() {
        let empty = window(&[]);
        assert_eq!(
            verify_pickup_geometry(actor(), sword(), &empty, CURRENT, 64.0),
            Ok(())
        );
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
        let top = SolidRect {
            min_x: 3724.0,
            min_y: 3900.0,
            max_x: 3734.0,
            max_y: 3922.0,
        };
        let bottom = SolidRect {
            min_x: 3724.0,
            min_y: 3958.0,
            max_x: 3734.0,
            max_y: 3980.0,
        };
        assert_eq!(
            verify_pickup_geometry(actor(), sword(), &window(&[top, bottom]), CURRENT, 64.0),
            Ok(())
        );
        let mut below_gap = actor();
        below_gap.y = 3978.0;
        assert_eq!(
            verify_pickup_geometry(below_gap, sword(), &window(&[top, bottom]), CURRENT, 96.0),
            Err(PickupGeometryReject::Occluded)
        );
    }

    #[test]
    fn close_corner_touch_and_wall_endpoint_fail_closed() {
        let tangent = SolidRect {
            min_x: 3724.0,
            min_y: 3940.0,
            max_x: 3734.0,
            max_y: 3950.0,
        };
        assert_eq!(
            verify_pickup_geometry(actor(), sword(), &window(&[tangent]), CURRENT, 64.0),
            Err(PickupGeometryReject::Occluded)
        );
        let on_wall = WorldPoint {
            x: 3724.0,
            ..sword()
        };
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
        let wrong = WorldPoint {
            zone_id: 8,
            ..sword()
        };
        assert_eq!(
            verify_pickup_geometry(actor(), wrong, &window(&[]), CURRENT, 64.0),
            Err(PickupGeometryReject::StaleAuthority)
        );
        let zero_epoch = GeometryFence {
            worker_epoch: 0,
            ..CURRENT
        };
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
        let bad = SolidRect {
            max_x: f32::INFINITY,
            ..WALL
        };
        assert_eq!(
            verify_pickup_geometry(actor(), sword(), &window(&[bad]), CURRENT, 64.0),
            Err(PickupGeometryReject::InvalidGeometry)
        );
        let nan_actor = WorldPoint {
            x: f32::NAN,
            ..actor()
        };
        assert_eq!(
            verify_pickup_geometry(nan_actor, sword(), &window(&[]), CURRENT, 64.0),
            Err(PickupGeometryReject::InvalidInput)
        );
        let out_of_bounds = WorldPoint {
            x: 4101.0,
            ..sword()
        };
        assert_eq!(
            verify_pickup_geometry(actor(), out_of_bounds, &window(&[]), CURRENT, 64.0),
            Err(PickupGeometryReject::InvalidInput)
        );
    }

    #[test]
    fn world_p0_greyhaven_open_front_four_swords_match_server_los() {
        // Cross-department snapshot ONLY from World #493 / v1:
        // smith at (3710,3850) 182x162; four rack sockets y=4038,
        // walkable pickup stands y=4088. The authoritative server must
        // still ingest a complete, revision-fenced World solid manifest.
        let smith = SolidRect {
            min_x: 3710.0,
            min_y: 3850.0,
            max_x: 3892.0,
            max_y: 4012.0,
        };
        let bounds = SolidRect {
            min_x: 3650.0,
            min_y: 3800.0,
            max_x: 4000.0,
            max_y: 4200.0,
        };
        let fixture = GeometryWindow {
            fence: CURRENT,
            complete: true,
            bounds,
            solids: &[smith],
        };
        let socket_x = [3740.0, 3780.0, 3820.0, 3860.0];
        for x in socket_x {
            let stand = WorldPoint {
                zone_id: CURRENT.zone_id,
                x,
                y: 4088.0,
            };
            let item_anchor = WorldPoint {
                zone_id: CURRENT.zone_id,
                x,
                y: 4038.0,
            };
            assert_eq!(
                verify_pickup_geometry(stand, item_anchor, &fixture, CURRENT, 64.0),
                Ok(()),
                "World #493 intended open-front sword must be physically reachable"
            );
            // An actor *inside* the solid smith footprint must not grab
            // the identical sword through a wall, even at short range.
            let invalid_inside_smith = WorldPoint {
                zone_id: CURRENT.zone_id,
                x,
                y: 4000.0,
            };
            assert_eq!(
                verify_pickup_geometry(invalid_inside_smith, item_anchor, &fixture, CURRENT, 64.0,),
                Err(PickupGeometryReject::Occluded)
            );
        }
        // A test fixture does NOT establish a live authoritative collision map.
        assert_eq!(socket_x[1] - socket_x[0], 40.0);
        assert_eq!(socket_x[2] - socket_x[1], 40.0);
        assert_eq!(socket_x[3] - socket_x[2], 40.0);
    }

    #[test]
    fn world_p0_four_rack_stands_can_reach_only_their_own_sword_at_64() {
        // World #493 / #502 candidate. A 64-unit server reach admits a 50-unit
        // own-socket ray but rejects a neighbor: sqrt(40^2 + 50^2) > 64.
        // The 96-unit API cap is NOT the selected gameplay reach.
        let smith = SolidRect {
            min_x: 3710.0,
            min_y: 3850.0,
            max_x: 3892.0,
            max_y: 4012.0,
        };
        let bounds = SolidRect {
            min_x: 3650.0,
            min_y: 3800.0,
            max_x: 4000.0,
            max_y: 4200.0,
        };
        let fixture = GeometryWindow {
            fence: CURRENT,
            complete: true,
            bounds,
            solids: &[smith],
        };
        let xs = [3740.0, 3780.0, 3820.0, 3860.0];
        for (i, stand_x) in xs.iter().copied().enumerate() {
            let stand = WorldPoint {
                zone_id: CURRENT.zone_id,
                x: stand_x,
                y: 4088.0,
            };
            for (j, sword_x) in xs.iter().copied().enumerate() {
                let sword = WorldPoint {
                    zone_id: CURRENT.zone_id,
                    x: sword_x,
                    y: 4038.0,
                };
                assert_eq!(
                    verify_pickup_geometry(stand, sword, &fixture, CURRENT, 64.0),
                    if i == j {
                        Ok(())
                    } else {
                        Err(PickupGeometryReject::OutOfRange)
                    },
                    "a rack stand must not geometrically authorize its neighboring sword"
                );
            }
        }
    }

    #[test]
    fn world_p0_greyhaven_west_gate_remains_open_without_phasing_through_wall() {
        // Two exact authored wall spans from World #502 (static design).
        // This is NOT a complete authoritative city/river/dynamic manifest.
        let north = SolidRect {
            min_x: 3501.5,
            min_y: 3441.5,
            max_x: 3538.5,
            max_y: 4112.0,
        };
        let south = SolidRect {
            min_x: 3501.5,
            min_y: 4248.0,
            max_x: 3538.5,
            max_y: 4768.5,
        };
        let fixture = GeometryWindow {
            fence: CURRENT,
            complete: true,
            bounds: SolidRect {
                min_x: 3400.0,
                min_y: 3900.0,
                max_x: 3650.0,
                max_y: 4400.0,
            },
            solids: &[north, south],
        };
        let origin = WorldPoint {
            zone_id: CURRENT.zone_id,
            x: 3480.0,
            y: 4180.0,
        };
        let destination = WorldPoint {
            zone_id: CURRENT.zone_id,
            x: 3560.0,
            y: 4180.0,
        };
        assert_eq!(
            verify_pickup_geometry(origin, destination, &fixture, CURRENT, 96.0),
            Ok(()),
            "do not fill the real west city-gate gap with an opaque wall"
        );
        let closed_origin = WorldPoint {
            y: 4000.0,
            ..origin
        };
        let closed_destination = WorldPoint {
            y: 4000.0,
            ..destination
        };
        assert_eq!(
            verify_pickup_geometry(closed_origin, closed_destination, &fixture, CURRENT, 96.0,),
            Err(PickupGeometryReject::Occluded),
            "the solid wall beside the gate must block pickup line of sight"
        );
    }

    #[test]
    fn core_8c_corner_skirt_has_disjoint_slab_intervals_and_must_stay_open() {
        // Core 8C #519 separately inflates the World #502 smith solid by
        // fighter radius=18. This is the exact inflated AABB. A swept actor
        // past its south-east corner has disjoint x/y intersection intervals,
        // despite each coordinate range overlapping an AABB axis separately.
        // No diagonal false-positive wall should block an otherwise safe route.
        let inflated_smith = SolidRect {
            min_x: 3692.0,
            min_y: 3832.0,
            max_x: 3910.0,
            max_y: 4030.0,
        };
        let clear_from = WorldPoint {
            zone_id: CURRENT.zone_id,
            x: 3900.0,
            y: 4038.0,
        };
        let clear_to = WorldPoint {
            zone_id: CURRENT.zone_id,
            x: 3960.0,
            y: 4000.0,
        };
        let fixture = GeometryWindow {
            fence: CURRENT,
            complete: true,
            bounds: SolidRect {
                min_x: 3850.0,
                min_y: 3950.0,
                max_x: 4000.0,
                max_y: 4100.0,
            },
            solids: &[inflated_smith],
        };
        assert!(!crosses_solid(clear_from, clear_to, &inflated_smith));
        assert_eq!(
            verify_pickup_geometry(clear_from, clear_to, &fixture, CURRENT, 96.0),
            Ok(())
        );
        // Conversely, real radius-inflated intersections and closed tangency
        // must still block, exactly as the active 8C movement kernel should.
        let colliding_to = WorldPoint {
            x: 3905.0,
            y: 4000.0,
            ..clear_to
        };
        assert_eq!(
            verify_pickup_geometry(clear_from, colliding_to, &fixture, CURRENT, 96.0),
            Err(PickupGeometryReject::Occluded)
        );
        let grazing_from = WorldPoint {
            y: 4030.0,
            ..clear_from
        };
        let grazing_to = WorldPoint {
            y: 4030.0,
            ..clear_to
        };
        assert_eq!(
            verify_pickup_geometry(grazing_from, grazing_to, &fixture, CURRENT, 96.0),
            Err(PickupGeometryReject::Occluded)
        );
    }

    #[test]
    fn core_8c_u64_zone_key_is_not_truncated_to_32_bits() {
        // Core C4d #393 stores ZoneKey(NonZeroU64) in a positive signed
        // 63-bit SQL bigint, not an ephemeral u32 network actor ID.
        let high_zone = u64::from(u32::MAX) + 17;
        let current = GeometryFence {
            zone_id: high_zone,
            worker_epoch: 11,
            map_revision: 23,
        };
        let trusted_actor = WorldPoint {
            zone_id: high_zone,
            ..actor()
        };
        let trusted_sword = WorldPoint {
            zone_id: high_zone,
            ..sword()
        };
        let fixture = GeometryWindow {
            fence: current,
            ..window(&[])
        };
        assert_eq!(
            verify_pickup_geometry(trusted_actor, trusted_sword, &fixture, current, 64.0),
            Ok(())
        );

        // A stale u32-truncated/low-bits session must NOT match Core's zone.
        let truncated_actor = WorldPoint {
            zone_id: high_zone & u64::from(u32::MAX),
            ..trusted_actor
        };
        assert_eq!(
            verify_pickup_geometry(truncated_actor, trusted_sword, &fixture, current, 64.0),
            Err(PickupGeometryReject::StaleAuthority)
        );
    }

    #[test]
    fn core_8c_signed_bigint_zone_overflow_is_fail_closed() {
        // Core C4d's zone SQL binding rejects >i64::MAX. The pure Physics
        // geometry primitive must reject it even if all inputs agree.
        let invalid = GeometryFence {
            zone_id: u64::MAX,
            ..CURRENT
        };
        let fixture = GeometryWindow {
            fence: invalid,
            ..window(&[])
        };
        let trusted_actor = WorldPoint {
            zone_id: invalid.zone_id,
            ..actor()
        };
        let trusted_sword = WorldPoint {
            zone_id: invalid.zone_id,
            ..sword()
        };
        assert_eq!(
            verify_pickup_geometry(trusted_actor, trusted_sword, &fixture, invalid, 64.0),
            Err(PickupGeometryReject::StaleAuthority)
        );
        let largest = GeometryFence {
            zone_id: i64::MAX as u64,
            ..CURRENT
        };
        let largest_actor = WorldPoint {
            zone_id: largest.zone_id,
            ..actor()
        };
        let largest_sword = WorldPoint {
            zone_id: largest.zone_id,
            ..sword()
        };
        let largest_window = GeometryWindow {
            fence: largest,
            ..window(&[])
        };
        assert_eq!(
            verify_pickup_geometry(largest_actor, largest_sword, &largest_window, largest, 64.0,),
            Ok(())
        );
    }

    #[test]
    fn same_completed_tick_must_bind_actor_sword_geometry_and_operation() {
        // Core's authoritative PickupWorldTick.completed_tick is u32.
        // A stale visual preview may have valid IDs but must not be reused.
        let ticks = PickupTickFence {
            operation_tick: 123,
            actor_tick: 123,
            sword_tick: 123,
            geometry_tick: 123,
        };
        let empty = window(&[]);
        assert_eq!(
            verify_pickup_geometry_at_completed_tick(
                actor(), sword(), &empty, CURRENT, 64.0, ticks,
            ),
            Ok(())
        );
        for stale in [
            PickupTickFence {
                actor_tick: 122,
                ..ticks
            },
            PickupTickFence {
                sword_tick: 122,
                ..ticks
            },
            PickupTickFence {
                geometry_tick: 122,
                ..ticks
            },
            PickupTickFence {
                operation_tick: 124,
                ..ticks
            },
            PickupTickFence {
                operation_tick: 0,
                actor_tick: 0,
                sword_tick: 0,
                geometry_tick: 0,
            },
        ] {
            assert_eq!(
                verify_pickup_geometry_at_completed_tick(
                    actor(), sword(), &empty, CURRENT, 64.0, stale,
                ),
                Err(PickupGeometryReject::StaleWorldTick)
            );
        }
    }

    #[test]
    fn current_completed_tick_does_not_override_los_or_current_map_fence() {
        let ticks = PickupTickFence {
            operation_tick: 222,
            actor_tick: 222,
            sword_tick: 222,
            geometry_tick: 222,
        };
        let blocked = window(&[WALL]);
        assert_eq!(
            verify_pickup_geometry_at_completed_tick(
                actor(), sword(), &blocked, CURRENT, 64.0, ticks,
            ),
            Err(PickupGeometryReject::Occluded)
        );
        let incomplete = GeometryWindow {
            complete: false,
            ..window(&[])
        };
        assert_eq!(
            verify_pickup_geometry_at_completed_tick(
                actor(), sword(), &incomplete, CURRENT, 64.0, ticks,
            ),
            Err(PickupGeometryReject::IncompleteGeometry)
        );
        let previous_revision = GeometryFence {
            map_revision: CURRENT.map_revision - 1,
            ..CURRENT
        };
        assert_eq!(
            verify_pickup_geometry_at_completed_tick(
                actor(), sword(), &window(&[]), previous_revision, 64.0, ticks,
            ),
            Err(PickupGeometryReject::StaleAuthority)
        );
    }

    #[test]
    fn legacy_zone_zero_and_new_world_revision_zero_are_supported() {
        let legacy = GeometryFence {
            zone_id: 0,
            worker_epoch: 1,
            map_revision: 0,
        };
        let mut empty = window(&[]);
        empty.fence = legacy;
        let zero_actor = WorldPoint {
            zone_id: 0,
            ..actor()
        };
        let zero_sword = WorldPoint {
            zone_id: 0,
            ..sword()
        };
        assert_eq!(
            verify_pickup_geometry(zero_actor, zero_sword, &empty, legacy, 64.0),
            Ok(())
        );
    }
}
