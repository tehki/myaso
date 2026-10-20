//! D5: exact reproducible precision probes across the shadow Rust and JS
//! occupancy queries. This file compiles ONLY in Rust tests.
use super::*;

const EXPECTED: &str = include_str!("../../tests/fixtures/world-boundary-digests-v1.csv");

fn next(state: &mut u32) -> u32 {
    *state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
    *state
}

fn q(value: f32) -> f32 {
    (value * 4.0).round() / 4.0
}

#[test]
fn d5_twenty_thousand_edge_biased_queries_match_browser_digests() {
    let mut state = 0x5a17_d00d_u32;
    let mut totals = [0_u32; 5];
    let mut blocked = [0_u32; 5];
    let mut hashes = [2_166_136_261_u32; 5];
    const RADII: [f32; 4] = [8.0, 18.0, 24.0, 32.0];

    for i in 0..20_000 {
        let a = next(&mut state);
        let b = next(&mut state);
        let c = next(&mut state);
        let d = next(&mut state);
        let e = next(&mut state);
        let bucket = i % 5;
        let radius = RADII[(e % 4) as usize];
        let (map, x, y): (GeometryMap, f32, f32);
        match bucket {
            0 => {
                let side = a % 4;
                let off = ((c % 321) as i32 - 160) as f32 / 4.0;
                let along = ((d % 1001) as i32 - 500) as f32 / 4.0;
                map = GeometryMap::Moonvale;
                (x, y) = match side {
                    0 => (GREYHAVEN_CITY.x + off, 4180.0 + along),
                    1 => (GREYHAVEN_CITY.x + GREYHAVEN_CITY.w + off, 4180.0 + along),
                    2 => (4130.0 + along, GREYHAVEN_CITY.y + off),
                    _ => (4130.0 + along, GREYHAVEN_CITY.y + GREYHAVEN_CITY.h + off),
                };
            }
            1 => {
                let building = BUILDINGS[(a as usize) % BUILDINGS.len()];
                let side = b % 4;
                let off = ((c % 401) as i32 - 200) as f32 / 4.0;
                let length_y = (building.h * 4.0) as u32 + 1;
                let length_x = (building.w * 4.0) as u32 + 1;
                map = GeometryMap::Moonvale;
                (x, y) = match side {
                    0 => (building.x + off, building.y + (d % length_y) as f32 / 4.0),
                    1 => (building.x + building.w + off, building.y + (d % length_y) as f32 / 4.0),
                    2 => (building.x + (d % length_x) as f32 / 4.0, building.y + off),
                    _ => (building.x + (d % length_x) as f32 / 4.0, building.y + building.h + off),
                };
            }
            2 => {
                let idx = (a as usize) % (RIVER_POINTS.len() - 1);
                let first = RIVER_POINTS[idx];
                let last = RIVER_POINTS[idx + 1];
                let t = (b % 257) as f32 / 256.0;
                map = GeometryMap::Moonvale;
                x = q(first.x + (last.x - first.x) * t) + ((c % 1001) as i32 - 500) as f32 / 4.0;
                y = q(first.y + (last.y - first.y) * t) + ((d % 401) as i32 - 200) as f32 / 4.0;
            }
            3 => {
                let furniture = INN_SOLIDS[(a as usize) % INN_SOLIDS.len()];
                let side = b % 4;
                let off = ((c % 401) as i32 - 200) as f32 / 4.0;
                let length_y = (furniture.h * 4.0) as u32 + 1;
                let length_x = (furniture.w * 4.0) as u32 + 1;
                map = GeometryMap::RedLionInn;
                (x, y) = match side {
                    0 => (furniture.x + off, furniture.y + (d % length_y) as f32 / 4.0),
                    1 => (furniture.x + furniture.w + off, furniture.y + (d % length_y) as f32 / 4.0),
                    2 => (furniture.x + (d % length_x) as f32 / 4.0, furniture.y + off),
                    _ => (furniture.x + (d % length_x) as f32 / 4.0, furniture.y + furniture.h + off),
                };
            }
            _ => {
                map = GeometryMap::Moonvale;
                x = (a % 32769) as f32 / 4.0;
                y = (b % 32769) as f32 / 4.0;
            }
        }
        let walk = is_walkable(map, x, y, radius);
        totals[bucket] += 1;
        if !walk { blocked[bucket] += 1; }
        hashes[bucket] = (hashes[bucket] ^ u32::from(walk)).wrapping_mul(16_777_619);
    }

    const NAMES: [&str; 5] = [
        "city-walls", "building-edges", "river-bridges", "inn-furniture", "world-uniform",
    ];
    let lines: Vec<&str> = EXPECTED.lines().filter(|line| !line.starts_with('#') && !line.is_empty()).collect();
    assert_eq!(lines.len(), NAMES.len(), "missing D5 boundary categories");
    for (bucket, line) in lines.iter().enumerate() {
        let parts: Vec<&str> = line.split(',').collect();
        assert_eq!(parts.len(), 4, "invalid hash fixture row: {line}");
        assert_eq!(parts[0], NAMES[bucket], "unexpected sample category");
        let count = parts[1].parse::<u32>().expect("count");
        let expected_blocked = parts[2].parse::<u32>().expect("blocked");
        let expected_hash = u32::from_str_radix(parts[3], 16).expect("FNV32");
        assert_eq!(totals[bucket], count, "query count changed in {}", NAMES[bucket]);
        assert_eq!(blocked[bucket], expected_blocked, "Rust/browser classification mismatch in {}", NAMES[bucket]);
        assert_eq!(hashes[bucket], expected_hash, "Rust/browser sequence divergence in {}", NAMES[bucket]);
        assert_eq!(totals[bucket], 4_000);
    }
}
