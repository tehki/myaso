//! D4 dormant "walking only" collision step, cross-tested against D2 preview.
//!
//! This routine is NOT connected to live movement or network state. When Core
//! eventually integrates it, the zone, origin, tick and speed allowance must
//! come from trusted server state, never from a client-requested position.

use crate::world_geometry::{is_walkable, GeometryMap};

pub const MAX_SHADOW_WALK_DELTA: f32 = 16.0;
pub const SHADOW_STEP_UNITS: f32 = 4.0;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct GeometryPosition {
    pub x: f32,
    pub y: f32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ShadowMoveError {
    InvalidStart,
    InvalidDelta,
}

/// Computes a bounded collision-aware step without touching World, zones,
/// combat, stamina, net ID or authoritative simulation. Movement never leaves
/// a known-walkable starting location and resolves blocked diagonals via
/// independent axis sliding. The 4-unit substeps are *not* a generic high-
/// speed physics sweep and must not be reused for rolls/knockback.
pub fn shadow_resolve_walk(
    map: GeometryMap,
    origin: GeometryPosition,
    displacement: GeometryPosition,
    radius: f32,
) -> Result<GeometryPosition, ShadowMoveError> {
    if !is_walkable(map, origin.x, origin.y, radius) {
        return Err(ShadowMoveError::InvalidStart);
    }
    if !displacement.x.is_finite()
        || !displacement.y.is_finite()
        || displacement.x.hypot(displacement.y) > MAX_SHADOW_WALK_DELTA
    {
        return Err(ShadowMoveError::InvalidDelta);
    }

    let steps = (displacement.x.abs().max(displacement.y.abs()) / SHADOW_STEP_UNITS)
        .ceil()
        .max(1.0) as u32;
    let sx = displacement.x / steps as f32;
    let sy = displacement.y / steps as f32;
    let mut result = origin;
    for _ in 0..steps {
        if is_walkable(map, result.x + sx, result.y + sy, radius) {
            result.x += sx;
            result.y += sy;
        } else {
            if is_walkable(map, result.x + sx, result.y, radius) {
                result.x += sx;
            }
            if is_walkable(map, result.x, result.y + sy, radius) {
                result.y += sy;
            }
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::world_geometry::FIGHTER_RADIUS;

    #[test]
    fn shared_d4_golden_movement_parity() {
        const GOLDEN: &str = include_str!("../../tests/fixtures/world-movement-parity-v1.csv");
        let mut cases = 0;
        let mut sliding = 0;
        let mut blocked = 0;
        for line in GOLDEN
            .lines()
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
        {
            let fields: Vec<&str> = line.split(',').collect();
            assert_eq!(fields.len(), 9, "malformed movement fixture {line}");
            let map = match fields[0] {
                "moonvale-overworld" => GeometryMap::Moonvale,
                "red-lion-inn" => GeometryMap::RedLionInn,
                value => panic!("unknown fixture map {value}"),
            };
            let origin = GeometryPosition {
                x: fields[1].parse().unwrap(),
                y: fields[2].parse().unwrap(),
            };
            let delta = GeometryPosition {
                x: fields[3].parse().unwrap(),
                y: fields[4].parse().unwrap(),
            };
            let radius: f32 = fields[5].parse().unwrap();
            let actual = shadow_resolve_walk(map, origin, delta, radius);
            match fields[8] {
                "ok" => {
                    let expected_x: f32 = fields[6].parse().unwrap();
                    let expected_y: f32 = fields[7].parse().unwrap();
                    let position = actual.expect(line);
                    assert!(
                        (position.x - expected_x).abs() <= 0.006
                            && (position.y - expected_y).abs() <= 0.006,
                        "Rust/JS movement divergence: {line} vs {position:?}"
                    );
                    assert!(
                        is_walkable(map, position.x, position.y, radius),
                        "movement entered blocked geometry: {line}"
                    );
                    if (position.x - origin.x).abs() < delta.x.abs() - 0.01
                        || (position.y - origin.y).abs() < delta.y.abs() - 0.01
                    {
                        blocked += 1;
                    }
                    if (position.x - origin.x).abs() > 0.01
                        && (position.y - origin.y).abs() < delta.y.abs() - 0.01
                    {
                        sliding += 1;
                    }
                }
                "invalid-start" => assert_eq!(actual, Err(ShadowMoveError::InvalidStart), "{line}"),
                "invalid-delta" => assert_eq!(actual, Err(ShadowMoveError::InvalidDelta), "{line}"),
                value => panic!("unknown fixture outcome {value}"),
            }
            cases += 1;
        }
        assert!(cases >= 300, "lost most movement fixtures");
        assert!(blocked >= 10, "insufficient collision movement cases");
        assert!(sliding >= 1, "missing evidence of axis movement");
    }

    #[test]
    fn invalid_requests_fail_closed_without_mutating_origin() {
        let origin = GeometryPosition { x: 4365.0, y: 4150.0 };
        for delta in [
            GeometryPosition { x: f32::NAN, y: 0.0 },
            GeometryPosition { x: f32::INFINITY, y: 0.0 },
            GeometryPosition { x: 17.0, y: 0.0 },
            GeometryPosition { x: 12.0, y: 12.0 },
        ] {
            assert_eq!(
                shadow_resolve_walk(GeometryMap::Moonvale, origin, delta, FIGHTER_RADIUS),
                Err(ShadowMoveError::InvalidDelta)
            );
        }
        assert_eq!(origin.x, 4365.0);
        assert_eq!(origin.y, 4150.0);
    }

    #[test]
    fn repeated_steps_do_not_tunnel_through_red_lion_wall_or_river() {
        let mut at = GeometryPosition { x: 4365.0, y: 4150.0 };
        for _ in 0..40 {
            at = shadow_resolve_walk(
                GeometryMap::Moonvale,
                at,
                GeometryPosition { x: 0.0, y: -10.0 },
                FIGHTER_RADIUS,
            )
            .unwrap();
        }
        assert!(at.y >= 4068.0 && at.y < 4095.0, "Red Lion roof bypass: {at:?}");

        let mut across = GeometryPosition { x: 2250.0, y: 3600.0 };
        for _ in 0..80 {
            across = shadow_resolve_walk(
                GeometryMap::Moonvale,
                across,
                GeometryPosition { x: -10.0, y: 0.0 },
                FIGHTER_RADIUS,
            )
            .unwrap();
        }
        assert!(across.x > 2000.0, "unbridged river crossing: {across:?}");
    }

    #[test]
    fn bridge_and_inn_paths_remain_walkable() {
        let mut at = GeometryPosition { x: 2200.0, y: 4250.0 };
        for _ in 0..50 {
            at = shadow_resolve_walk(
                GeometryMap::Moonvale,
                at,
                GeometryPosition { x: -10.0, y: 0.0 },
                FIGHTER_RADIUS,
            )
            .unwrap();
        }
        assert!(at.x < 1900.0, "west bridge unexpectedly obstructed: {at:?}");
        assert!(shadow_resolve_walk(
            GeometryMap::RedLionInn,
            GeometryPosition { x: 390.0, y: 480.0 },
            GeometryPosition { x: 0.0, y: -10.0 },
            FIGHTER_RADIUS
        )
        .is_ok());
    }
}
