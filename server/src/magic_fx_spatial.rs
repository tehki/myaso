//! P5: bounded zone+cell interest index for inactive server-owned magic FX.
//!
//! Cells contain *semantic events*, never particles or authoritative combat.
//! Index input comes only from P4's already-validated trusted event broker.
//! Query results preserve global monotonic event ID order.

use std::collections::BTreeMap;

use crate::magic_fx_events::{SemanticEffect, ViewerInterest, MAX_VIEWER_FX_EVENTS};

pub const FX_SPATIAL_CELL_SIZE: f32 = 512.0;
pub const MAX_SPATIAL_QUERY_CELLS: usize = 64;

type CellKey = (u32, i32, i32);

fn cell_coordinate(world_position: f32) -> i32 {
    (world_position / FX_SPATIAL_CELL_SIZE).floor() as i32
}

fn cell_key(event: &SemanticEffect) -> CellKey {
    (
        event.spec.zone_id,
        cell_coordinate(event.spec.x),
        cell_coordinate(event.spec.y),
    )
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct FxQueryStats {
    /// Includes empty candidate cells, but never cells in other zones.
    pub visited_cells: usize,
    /// Semantic candidates read from actual bucket allocations.
    pub examined_events: usize,
    /// Hits after circular distance and cursor filtering, before output cap.
    pub in_radius: usize,
}

/// This is a bounded, per-broker reference index, not a world-scale shard.
/// It can only hold events the P4 broker has admitted.
#[derive(Debug, Default)]
pub struct MagicFxSpatialIndex {
    cells: BTreeMap<CellKey, Vec<SemanticEffect>>,
    zone_counts: BTreeMap<u32, usize>,
}

impl MagicFxSpatialIndex {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&mut self, event: SemanticEffect) {
        self.cells.entry(cell_key(&event)).or_default().push(event);
        *self.zone_counts.entry(event.spec.zone_id).or_default() += 1;
    }

    pub fn count_zone(&self, zone_id: u32) -> usize {
        self.zone_counts.get(&zone_id).copied().unwrap_or(0)
    }

    pub fn count_all(&self) -> usize {
        self.zone_counts.values().copied().sum()
    }

    pub fn active_cells(&self) -> usize {
        self.cells.len()
    }

    /// Prune without re-sorting the event stream, including sparse cells and
    /// empty zones. P4 advances once on a strictly increasing trusted tick.
    pub fn retain_live(&mut self, tick: u64) {
        self.cells.retain(|_, bucket| {
            bucket.retain(|event| event.expires_at > tick);
            !bucket.is_empty()
        });
        self.zone_counts.clear();
        for ((zone_id, _, _), bucket) in &self.cells {
            *self.zone_counts.entry(*zone_id).or_default() += bucket.len();
        }
    }

    /// Input is already validated by the broker. The returned list is sorted
    /// by event ID, not cell order, preserving P4's linear-scan semantics.
    ///
    /// The maximum trusted radius is 1500u, so at 512u/cell this probes at
    /// most 7x7 cells. Cross-zone buckets are never visited.
    pub fn query(
        &self,
        viewer: ViewerInterest,
        after_id: u32,
        limit: usize,
    ) -> (Vec<SemanticEffect>, FxQueryStats) {
        let mut stats = FxQueryStats::default();
        if limit == 0 {
            return (Vec::new(), stats);
        }
        let lo_x = cell_coordinate(viewer.x - viewer.radius);
        let hi_x = cell_coordinate(viewer.x + viewer.radius);
        let lo_y = cell_coordinate(viewer.y - viewer.radius);
        let hi_y = cell_coordinate(viewer.y + viewer.radius);
        let count_x = (i64::from(hi_x) - i64::from(lo_x) + 1) as usize;
        let count_y = (i64::from(hi_y) - i64::from(lo_y) + 1) as usize;
        if count_x.saturating_mul(count_y) > MAX_SPATIAL_QUERY_CELLS {
            return (Vec::new(), stats);
        }

        let radius_sq = viewer.radius * viewer.radius;
        let mut hits = Vec::new();
        for x in lo_x..=hi_x {
            for y in lo_y..=hi_y {
                stats.visited_cells += 1;
                if let Some(bucket) = self.cells.get(&(viewer.zone_id, x, y)) {
                    for event in bucket {
                        stats.examined_events += 1;
                        if event.event_id <= after_id {
                            continue;
                        }
                        let dx = event.spec.x - viewer.x;
                        let dy = event.spec.y - viewer.y;
                        if dx.abs() <= viewer.radius
                            && dy.abs() <= viewer.radius
                            && dx * dx + dy * dy <= radius_sq
                        {
                            hits.push(*event);
                        }
                    }
                }
            }
        }
        stats.in_radius = hits.len();
        hits.sort_unstable_by_key(|event| event.event_id);
        hits.truncate(limit.min(MAX_VIEWER_FX_EVENTS));
        (hits, stats)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::elemental_physics::Element;
    use crate::magic_fx_events::{SemanticEffectBroker, TrustedEffectSpec};

    fn spec(zone_id: u32, x: f32, y: f32) -> TrustedEffectSpec {
        TrustedEffectSpec {
            zone_id,
            x,
            y,
            element: Element::Wind,
            seed: 9,
            intensity: 127,
            ttl_ticks: 120,
        }
    }

    fn viewer(zone_id: u32, x: f32, y: f32, radius: f32) -> ViewerInterest {
        ViewerInterest {
            zone_id,
            x,
            y,
            radius,
        }
    }

    #[test]
    fn indexes_negative_and_positive_cell_boundaries_without_false_negatives() {
        let mut broker = SemanticEffectBroker::new();
        broker.advance(1).unwrap();
        for x in [-513.0, -512.0, -511.9, -0.1, 0.0, 511.9, 512.0] {
            broker.admit_trusted(1, spec(7, x, -512.0)).unwrap();
        }
        for at_x in [-512.0, -1.0, 0.0, 512.0] {
            let q = viewer(7, at_x, -512.0, 512.0);
            let (actual, stats) = broker.interest_snapshot_with_stats(q, 0, 16);
            let expected = broker.linear_reference(q, 0, 16);
            assert_eq!(actual, expected);
            assert!(stats.visited_cells <= MAX_SPATIAL_QUERY_CELLS);
        }
    }

    #[test]
    fn global_order_and_cursor_are_preserved_across_distant_cells() {
        let mut broker = SemanticEffectBroker::new();
        broker.advance(1).unwrap();
        broker.admit_trusted(1, spec(7, 1024.0, 0.0)).unwrap();
        broker.admit_trusted(1, spec(7, -1024.0, 0.0)).unwrap();
        broker.admit_trusted(1, spec(7, 0.0, 0.0)).unwrap();
        let q = viewer(7, 0.0, 0.0, 1500.0);
        let results = broker.interest_snapshot(q, 0, 16);
        assert_eq!(results.iter().map(|e| e.event_id).collect::<Vec<_>>(), [1, 2, 3]);
        assert_eq!(broker.interest_snapshot(q, 1, 16).len(), 2);
        assert_eq!(broker.interest_snapshot(q, 0, 2).len(), 2);
    }

    #[test]
    fn expired_events_clear_buckets_and_update_zone_counts() {
        let mut broker = SemanticEffectBroker::new();
        broker.advance(100).unwrap();
        let mut spec_a = spec(7, 100.0, 200.0);
        spec_a.ttl_ticks = 1;
        broker.admit_trusted(100, spec_a).unwrap();
        broker.admit_trusted(100, spec(8, -100.0, -200.0)).unwrap();
        assert_eq!(broker.index_stats().total_events, 2);
        assert_eq!(broker.index_stats().active_cells, 2);
        broker.advance(101).unwrap();
        assert_eq!(broker.index_stats().total_events, 1);
        assert_eq!(broker.index_stats().active_cells, 1);
        assert_eq!(broker.interest_snapshot(viewer(7, 100.0, 200.0, 700.0), 0, 16).len(), 0);
        assert_eq!(broker.interest_snapshot(viewer(8, -100.0, -200.0, 700.0), 0, 16).len(), 1);
        broker.advance(220).unwrap();
        assert_eq!(broker.index_stats().total_events, 0);
        assert_eq!(broker.index_stats().active_cells, 0);
    }

    #[test]
    fn indexed_query_matches_linear_reference_under_512_viewers_and_churn() {
        let mut broker = SemanticEffectBroker::new();
        // 5 zones, 240 events, 48 per zone: a packed multi-zone reference.
        for tick in 1u64..=20 {
            broker.advance(tick).unwrap();
            for j in 0..12 {
                let index = ((tick - 1) * 12 + j) as u32;
                let zone_id = 1 + index % 5;
                let x = (index.wrapping_mul(257) % 8192) as f32 - 4096.0;
                let y = (index.wrapping_mul(461) % 8192) as f32 - 4096.0;
                broker.admit_trusted(tick, spec(zone_id, x, y)).unwrap();
            }
        }
        assert_eq!(broker.pending(), 240);
        let mut total_candidates = 0usize;
        let mut total_visits = 0usize;
        for viewer_id in 0u32..512 {
            let zone_id = 1 + viewer_id % 5;
            let x = (viewer_id.wrapping_mul(577) % 8192) as f32 - 4096.0;
            let y = (viewer_id.wrapping_mul(337) % 8192) as f32 - 4096.0;
            let q = viewer(zone_id, x, y, 700.0);
            let after_id = viewer_id % 50;
            let (indexed, stats) = broker.interest_snapshot_with_stats(q, after_id, 16);
            assert_eq!(indexed, broker.linear_reference(q, after_id, 16));
            assert!(stats.visited_cells <= MAX_SPATIAL_QUERY_CELLS);
            assert!(stats.examined_events <= 48);
            total_candidates += stats.examined_events;
            total_visits += stats.visited_cells;
        }
        assert!(total_candidates < 512 * broker.pending() / 3);
        assert!(total_visits <= 512 * MAX_SPATIAL_QUERY_CELLS);
        broker.advance(140).unwrap();
        assert_eq!(broker.index_stats().total_events, 0);
    }
}
