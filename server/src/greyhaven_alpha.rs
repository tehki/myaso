//! World9 authored Greyhaven spawn anchors for isolated loopback Alpha trials.
//! This chooses one free spawn for an original Rust World actor. It does NOT
//! activate fixed-building collision, portals, item authority, or zone transfer.
use myaso_server::simulation::{World, DEFAULT_WORLD_HEIGHT, DEFAULT_WORLD_WIDTH};

// The original Physics6 actor radius is 18 World units. Never mint an
// arriving actor inside an already admitted actor's current body.
const FIGHTER_DIAMETER_SQUARED: f32 = 36.0 * 36.0;

pub const SPAWNS: [(f32, f32); 4] = [
    (4110.0, 4160.0),
    (4206.0, 4160.0),
    (4110.0, 4256.0),
    (4206.0, 4256.0),
];

pub fn free_spawn(world: &World) -> Option<(f32, f32)> {
    // The authoring preview or a different World instance may not turn its
    // coordinates into authoritative actor admission by clamping to an edge.
    if world.width != DEFAULT_WORLD_WIDTH
        || world.height != DEFAULT_WORLD_HEIGHT
        || world.match_over()
    {
        return None;
    }
    SPAWNS.iter().copied().find(|candidate| {
        world.fighters().iter().all(|f| {
            // Preserve the current session's original respawn reservation
            // even if its living actor has walked away from that anchor.
            if (f.spawn_x, f.spawn_y) == *candidate {
                return false;
            }
            // The same actor may walk onto *another* unreserved anchor.
            // Test its current server-owned position before admitting a
            // new actor, not just its immutable respawn position.
            let dx = f.x - candidate.0;
            let dy = f.y - candidate.1;
            let distance_squared = dx * dx + dy * dy;
            distance_squared.is_finite() && distance_squared >= FIGHTER_DIAMETER_SQUARED
        })
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

    #[test]
    fn moving_current_actor_must_not_be_overlapped_by_new_spawn() {
        use myaso_server::simulation::InputIntent;
        let mut world = World::default();
        assert!(world.add_player_at(9, SPAWNS[0].0, SPAWNS[0].1, 0.0));
        assert!(world.set_input(
            9,
            InputIntent {
                move_x: 1.0,
                ..InputIntent::default()
            }
        ));
        for _ in 0..27 {
            assert!(world.step().is_empty());
        }
        let x = world.fighter(9).unwrap().x;
        assert!(
            (x - SPAWNS[1].0).abs() < 5.0,
            "real original World movement x={x}"
        );
        // Socket 0 belongs to the existing actor's respawn. Socket 1 is
        // occupied by its current position, despite never being a spawn.
        assert_eq!(free_spawn(&world), Some(SPAWNS[2]));
    }

    #[test]
    fn wrong_sized_world_must_not_clamp_greyhaven_spawn_to_arena_edge() {
        let world = World::new(800.0, 600.0);
        assert_eq!(free_spawn(&world), None);
    }
}
