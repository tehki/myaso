//! P6-C02 fail-first source-level test: four fighters must reconcile after
//! one authoritative simulation tick. Not a substitute for native 4-browser
//! acceptance; the current single pair-pass leaves overlapping bodies.
use myaso_server::simulation::{Action, InputIntent, World};

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

#[test]
fn p6_c03_kick_knockback_does_not_leave_four_fighters_penetrating_after_tick() {
    // Kick target #2 at 254 toward the stationary #3 at 306. The kick's
    // authoritative 52-unit knockback lands exactly on #3; #4 is adjacent.
    // Combat resolves this displacement after ordinary movement collision.
    let mut world = World::new(800.0, 600.0);
    for (id, x) in [(1, 200.0), (2, 254.0), (3, 306.0), (4, 342.0)] {
        assert!(world.add_player_at(id, x, 200.0, 0.0));
    }
    assert_separated(&world, &[1, 2, 3, 4]);

    let mut kick_hit_tick = None;
    for _ in 0..36 {
        assert!(world.set_input(
            1,
            InputIntent {
                kick: true,
                facing_radians: 0.0,
                ..InputIntent::default()
            },
        ));
        world.step_by(5.0);
        if world.fighter(2).expect("kick target").action == Action::Knockdown {
            kick_hit_tick = Some(world.tick);
            // The completed server tick must not leave the struck fighter
            // inside a bystander until a future client input/snapshot.
            assert_separated(&world, &[1, 2, 3, 4]);
            break;
        }
    }
    assert!(
        kick_hit_tick.is_some(),
        "actual kick never knocked target down"
    );
    assert_eq!(world.fighter(2).unwrap().hp, 100.0, "kick is non-damaging");
    assert_eq!(world.fighter(3).unwrap().hp, 100.0);
    assert_eq!(world.fighter(4).unwrap().hp, 100.0);
}

#[test]
fn p6_c03_light_hit_knockback_does_not_leave_four_fighters_penetrating_after_tick() {
    // The only reachable victim (#2) starts at x272. A genuine 34HP light
    // moves them 18 units toward #3 at x308, leaving just 18 center units
    // unless collision is reconciled after the authoritative hit.
    let mut world = World::new(800.0, 600.0);
    for (id, x) in [(1, 200.0), (2, 272.0), (3, 308.0), (4, 344.0)] {
        assert!(world.add_player_at(id, x, 200.0, 0.0));
    }
    assert_separated(&world, &[1, 2, 3, 4]);

    let mut hit_tick = None;
    for _ in 0..45 {
        assert!(world.set_input(
            1,
            InputIntent {
                attack: true,
                facing_radians: 0.0,
                ..InputIntent::default()
            },
        ));
        world.step_by(5.0);
        if world.fighter(2).expect("light victim").hp < 100.0 {
            hit_tick = Some(world.tick);
            assert_eq!(world.fighter(2).unwrap().hp, 66.0);
            assert_eq!(world.fighter(3).unwrap().hp, 100.0);
            // Source of truth: verify every genuine fighter pair on the
            // SAME completed tick as the server-authoritative hit.
            assert_separated(&world, &[1, 2, 3, 4]);
            break;
        }
    }
    assert!(hit_tick.is_some(), "genuine light hit did not resolve");
}
