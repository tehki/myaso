//! P6-C02 fail-first source-level test: four fighters must reconcile after
//! one authoritative simulation tick. Not a substitute for native 4-browser
//! acceptance; the current single pair-pass leaves overlapping bodies.
use myaso_server::simulation::World;

const FIGHTER_DIAMETER: f32 = 36.0;
const TOLERANCE: f32 = 0.01;

fn assert_separated(world: &World, ids: &[u32]) {
    for (index, id) in ids.iter().enumerate() {
        let first = world.fighter(*id).expect("first fighter");
        for other_id in &ids[index + 1..] {
            let second = world.fighter(*other_id).expect("second fighter");
            let dx = first.x - second.x;
            let dy = first.y - second.y;
            let distance = dx.hypot(dy);
            assert!(
                distance + TOLERANCE >= FIGHTER_DIAMETER,
                "server tick {} left fighter {} and fighter {} overlapping: distance {distance}, positions ({}, {}) and ({}, {})",
                world.tick,
                id,
                other_id,
                first.x,
                first.y,
                second.x,
                second.y,
            );
        }
    }
}

#[test]
fn p6_c02_four_fighters_in_crowd_do_not_retain_overlap_after_tick() {
    let mut world = World::new(800.0, 600.0);
    for (id, x) in [(1, 100.0), (2, 110.0), (3, 120.0), (4, 130.0)] {
        assert!(world.add_player_at(id, x, 200.0, 0.0));
    }
    world.step();
    assert_eq!(world.tick, 1);
    assert_separated(&world, &[1, 2, 3, 4]);
}

#[test]
fn p6_c02_four_fighters_at_arena_wall_separate_within_bounds() {
    let mut world = World::new(800.0, 600.0);
    for id in 1..=4 {
        assert!(world.add_player_at(id, 18.0, 200.0, 0.0));
    }
    world.step();
    for id in 1..=4 {
        let fighter = world.fighter(id).expect("fighter");
        assert!((18.0..=782.0).contains(&fighter.x));
        assert!((18.0..=582.0).contains(&fighter.y));
    }
    assert_separated(&world, &[1, 2, 3, 4]);
}
