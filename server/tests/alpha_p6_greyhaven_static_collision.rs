//! P6 Alpha Phase A: authoritative 8192² opt-in geometry, no client movement authority.
use myaso_server::alpha_greyhaven_geometry::{
    overlaps_known_static_solid, swept_circle_hits_known_static_solid,
};
use myaso_server::simulation::{InputIntent, World};

fn greyhaven() -> World {
    let mut world = World::new(8192.0, 8192.0);
    assert!(world.enable_greyhaven_static_collisions());
    world
}

#[test]
fn alpha_p6_default_arena_and_unflagged_world_preserve_original_motion() {
    let mut arena = World::new(800.0, 600.0);
    assert!(!arena.enable_greyhaven_static_collisions());
    assert!(arena.add_player_at(1, 200.0, 200.0, 0.0));
    assert!(arena.set_input(
        1,
        InputIntent {
            move_x: 1.0,
            ..Default::default()
        }
    ));
    arena.step_by(100.0);
    assert!(arena.fighter(1).unwrap().x > 200.0);

    let mut baseline = World::new(8192.0, 8192.0);
    let mut guarded = greyhaven();
    for world in [&mut baseline, &mut guarded] {
        assert!(world.add_player_at(1, 3740.0, 4088.0, 0.0));
        assert!(world.set_input(
            1,
            InputIntent {
                move_y: -1.0,
                ..Default::default()
            }
        ));
        for _ in 0..3 {
            world.step_by(100.0);
        }
    }
    assert!(baseline.fighter(1).unwrap().y < 4030.0);
    assert!(guarded.fighter(1).unwrap().y >= 4030.0);
}

#[test]
fn alpha_p6_two_authoritative_players_share_wall_and_real_gate() {
    let mut world = greyhaven();
    assert!(world.add_player_at(1, 3470.0, 4000.0, 0.0));
    assert!(world.add_player_at(2, 3470.0, 4180.0, 0.0));
    let east_dash = InputIntent {
        move_x: 1.0,
        dash: true,
        ..Default::default()
    };
    for id in [1, 2] {
        assert!(world.set_input(id, east_dash));
    }
    world.step_by(100.0);
    world.step_by(100.0);
    let blocked = world.fighter(1).unwrap();
    let gate = world.fighter(2).unwrap();
    assert!(
        blocked.x <= 3501.5 - 18.0 + 0.01,
        "crossed west wall: {}",
        blocked.x
    );
    assert!(gate.x > 3538.5 + 18.0, "gate inaccessible: {}", gate.x);
    for fighter in world.fighters() {
        assert_eq!(
            overlaps_known_static_solid(fighter.x, fighter.y, 18.0),
            Ok(false)
        );
    }
}

#[test]
fn alpha_p6_spawn_admission_fails_closed_and_clone_retains_guard() {
    let mut world = World::new(8192.0, 8192.0);
    assert!(world.add_player_at(1, 3800.0, 3920.0, 0.0));
    assert!(!world.enable_greyhaven_static_collisions());
    assert!(world.remove_player(1));
    assert!(world.enable_greyhaven_static_collisions());
    assert!(!world.add_player_at(2, 3800.0, 3920.0, 0.0));
    assert!(!world.add_player_at(2, 4365.0, 3950.0, 0.0));
    assert!(world.add_player_at(2, 4365.0, 4088.0, 0.0));
    let mut copy = world.clone();
    assert!(!copy.add_player_at(3, 3800.0, 3920.0, 0.0));
}

#[test]
fn alpha_p6_swept_wall_tunneling_and_approved_facade_approach() {
    assert_eq!(
        swept_circle_hits_known_static_solid((3450.0, 4000.0), (3600.0, 4000.0), 18.0),
        Ok(true)
    );
    assert_eq!(
        swept_circle_hits_known_static_solid((3450.0, 4180.0), (3600.0, 4180.0), 18.0),
        Ok(false)
    );
    assert_eq!(
        swept_circle_hits_known_static_solid((4365.0, 4088.0), (4365.0, 4070.0), 18.0),
        Ok(false)
    );
    assert_eq!(
        swept_circle_hits_known_static_solid((4365.0, 4088.0), (4365.0, 4020.0), 18.0),
        Ok(true)
    );
}
