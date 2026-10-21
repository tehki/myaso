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
