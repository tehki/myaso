//! World9 authored Greyhaven spawn anchors for isolated loopback Alpha trials.
//! This chooses one free spawn for an original Rust World actor. It does NOT
//! activate fixed-building collision, portals, item authority, or zone transfer.
use myaso_server::simulation::World;

pub const SPAWNS: [(f32, f32); 4] = [
    (4110.0, 4160.0),
    (4206.0, 4160.0),
    (4110.0, 4256.0),
    (4206.0, 4256.0),
];

pub fn free_spawn(world: &World) -> Option<(f32, f32)> {
    SPAWNS.iter().copied().find(|candidate| {
        !world
            .fighters()
            .iter()
            .any(|f| (f.spawn_x, f.spawn_y) == *candidate)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn four_distinct_original_greyhaven_staging_spawns_and_no_fifth_slot() {
        let mut world = World::default();
        for (i, expected) in SPAWNS.iter().copied().enumerate() {
            assert_eq!(free_spawn(&world), Some(expected));
            assert!(world.add_player_at((i + 1) as u32, expected.0, expected.1, 0.0));
        }
        assert_eq!(free_spawn(&world), None);
        for (i, a) in SPAWNS.iter().enumerate() {
            for b in SPAWNS.iter().skip(i + 1) {
                assert!((a.0 - b.0).hypot(a.1 - b.1) >= 36.0);
            }
        }
    }

    #[test]
    fn spawn_reservation_uses_original_actor_life_not_untrusted_net_slot() {
        let mut world = World::default();
        assert!(world.add_player_at(9, SPAWNS[0].0, SPAWNS[0].1, 0.0));
        assert_eq!(free_spawn(&world), Some(SPAWNS[1]));
    }
}
