//! World #509's version-pinned Greyhaven static authored solids, embedded in the
//! server binary. This is **not** a complete live obstacle set (river, moving
//! actors and dynamic doors are missing) and **not** a zone/epoch authority.
//! A negative query is NOT proof of a currently walkable or pickup-valid path.
//! Core 8C must establish a current authoritative map revision and complete
//! relevant geometry before Physics/8B can commit any game mutation.

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct StaticSolid {
    pub id: &'static str,
    pub kind: &'static str,
    pub min_x: f32,
    pub min_y: f32,
    pub max_x: f32,
    pub max_y: f32,
}

include!("alpha_greyhaven_solids_generated.rs");

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StaticGeometryError {
    InvalidQuery,
}

/// Read-only query against *only* 23 known buildings and city-wall spans.
/// `false` means no overlap with these static shapes, NOT "walkable".
/// Never trust a client-supplied circle, zone, worker epoch or map revision.
pub fn overlaps_known_static_solid(
    x: f32,
    y: f32,
    radius: f32,
) -> Result<bool, StaticGeometryError> {
    if !x.is_finite()
        || !y.is_finite()
        || !radius.is_finite()
        || radius <= 0.0
        || radius > 1024.0
        || x < 0.0
        || y < 0.0
        || x > 8192.0
        || y > 8192.0
    {
        return Err(StaticGeometryError::InvalidQuery);
    }
    Ok(STATIC_SOLIDS.iter().any(|r| {
        let cx = x.clamp(r.min_x, r.max_x);
        let cy = y.clamp(r.min_y, r.max_y);
        let dx = x - cx;
        let dy = y - cy;
        dx * dx + dy * dy <= radius * radius
    }))
}

/// Conservative swept-circle vs every reviewed *static* AABB, including
/// endpoints and grazing contact. An inflated AABB is intentionally more
/// restrictive than an exact rounded-corner Minkowski shape: false-positive
/// blocking is acceptable; tunneling through a wall is not.
/// This does NOT cover the river, actors or dynamic obstacles.
pub fn swept_circle_hits_known_static_solid(
    from: (f32, f32),
    to: (f32, f32),
    radius: f32,
) -> Result<bool, StaticGeometryError> {
    if !radius.is_finite()
        || radius <= 0.0
        || radius > 1024.0
        || [from.0, from.1, to.0, to.1]
            .iter()
            .any(|v| !v.is_finite() || !(0.0..=8192.0).contains(v))
    {
        return Err(StaticGeometryError::InvalidQuery);
    }
    Ok(STATIC_SOLIDS.iter().any(|rect| {
        let mut entry = 0.0_f32;
        let mut exit = 1.0_f32;
        for (origin, delta, low, high) in [
            (
                from.0,
                to.0 - from.0,
                rect.min_x - radius,
                rect.max_x + radius,
            ),
            (
                from.1,
                to.1 - from.1,
                rect.min_y - radius,
                rect.max_y + radius,
            ),
        ] {
            if delta == 0.0 {
                if origin < low || origin > high {
                    return false;
                }
            } else {
                let t0 = (low - origin) / delta;
                let t1 = (high - origin) / delta;
                entry = entry.max(t0.min(t1));
                exit = exit.min(t0.max(t1));
                if entry > exit {
                    return false;
                }
            }
        }
        true
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn embedded_solids_have_unique_reviewed_ids_and_nonzero_rectangles() {
        assert_eq!(STATIC_SOLIDS.len(), 23);
        assert_eq!(STATIC_LAYOUT_ID, "moonvale-greyhaven-v10-solids-v1");
        assert_eq!(STATIC_SOLIDS_SHA256.len(), 64);
        let mut ids = HashSet::new();
        for r in STATIC_SOLIDS {
            assert!(ids.insert(r.id));
            assert!(r.kind == "building" || r.kind == "city-wall");
            assert!(r.min_x.is_finite() && r.min_y.is_finite());
            assert!(r.max_x.is_finite() && r.max_y.is_finite());
            assert!(r.min_x < r.max_x && r.min_y < r.max_y);
        }
    }

    #[test]
    fn four_core_staging_spawns_and_four_blacksmith_stands_clear_known_solids() {
        for (x, y) in [
            (4110.0, 4160.0),
            (4206.0, 4160.0),
            (4110.0, 4256.0),
            (4206.0, 4256.0),
            (3740.0, 4088.0),
            (3780.0, 4088.0),
            (3820.0, 4088.0),
            (3860.0, 4088.0),
        ] {
            assert_eq!(
                overlaps_known_static_solid(x, y, 18.0),
                Ok(false),
                "{x},{y}"
            );
        }
    }

    #[test]
    fn smith_footprint_and_real_west_wall_gap_have_precise_collision() {
        assert_eq!(overlaps_known_static_solid(3800.0, 3920.0, 18.0), Ok(true));
        assert_eq!(overlaps_known_static_solid(3520.0, 4000.0, 18.0), Ok(true));
        assert_eq!(overlaps_known_static_solid(3520.0, 4180.0, 18.0), Ok(false));
    }

    #[test]
    fn continuous_sweep_blocks_fast_wall_tunneling_but_preserves_real_gate() {
        // A fast >100-unit displacement must not jump the 37-unit wall.
        assert_eq!(
            swept_circle_hits_known_static_solid((3450.0, 4000.0), (3600.0, 4000.0), 18.0),
            Ok(true)
        );
        assert_eq!(
            swept_circle_hits_known_static_solid((3450.0, 4180.0), (3600.0, 4180.0), 18.0),
            Ok(false)
        );
        // South exterior Blacksmith rack: walking into the solid is forbidden.
        assert_eq!(
            swept_circle_hits_known_static_solid((3740.0, 4088.0), (3740.0, 3930.0), 18.0),
            Ok(true)
        );
        assert_eq!(
            swept_circle_hits_known_static_solid((3740.0, 4088.0), (3860.0, 4088.0), 18.0),
            Ok(false)
        );
    }

    #[test]
    fn swept_tangent_closed_endpoint_and_invalid_values_fail_closed() {
        assert_eq!(
            swept_circle_hits_known_static_solid((3650.0, 4030.0), (3950.0, 4030.0), 18.0),
            Ok(true)
        );
        assert_eq!(
            swept_circle_hits_known_static_solid((3740.0, 4030.0), (3740.0, 4088.0), 18.0),
            Ok(true)
        );
        assert_eq!(
            swept_circle_hits_known_static_solid((3450.0, 4180.0), (f32::NAN, 4180.0), 18.0),
            Err(StaticGeometryError::InvalidQuery)
        );
        assert_eq!(
            swept_circle_hits_known_static_solid((3450.0, 4180.0), (3600.0, 4180.0), 0.0),
            Err(StaticGeometryError::InvalidQuery)
        );
    }

    #[test]
    fn static_circle_input_must_be_finite_positive_and_bounded() {
        for (x, y, r) in [
            (f32::NAN, 4180.0, 18.0),
            (3520.0, f32::INFINITY, 18.0),
            (3520.0, 4180.0, 0.0),
            (3520.0, 4180.0, -1.0),
            (3520.0, 4180.0, 1025.0),
            (-1.0, 4180.0, 18.0),
            (8193.0, 4180.0, 18.0),
        ] {
            assert_eq!(
                overlaps_known_static_solid(x, y, r),
                Err(StaticGeometryError::InvalidQuery)
            );
        }
    }
}
