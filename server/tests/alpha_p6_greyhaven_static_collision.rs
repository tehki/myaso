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

#[test]
fn alpha_p6_ground_footprint_rejects_invalid_actor_origins_instead_of_teleport_clamping() {
    // World9 authoring is a flat XY overworld. Do not claim a non-existent z heightfield.
    // An invalid ground footprint cannot be silently clamped to a new spawn.
    let mut world = greyhaven();
    for (id, x, y) in [
        (1, -100.0, 4160.0),
        (2, 10.0, 4160.0),
        (3, 8190.0, 4160.0),
        (4, 4110.0, -5.0),
        (5, 4110.0, 8190.0),
        (6, f32::NAN, 4160.0),
        (7, 4110.0, f32::INFINITY),
    ] {
        assert!(
            !world.add_player_at(id, x, y, 0.0),
            "invalid ground spawn admitted: {id}"
        );
        assert!(world.fighter(id).is_none());
    }
    // The original arena still follows its prior source policy, including clamping.
    let mut arena = World::new(800.0, 600.0);
    assert!(arena.add_player_at(1, -100.0, 200.0, 0.0));
    assert_eq!(arena.fighter(1).unwrap().x, 18.0);
}

#[test]
fn alpha_p6_building_wall_advances_to_actual_contact_not_previous_frame_position() {
    let mut world = greyhaven();
    // Smith's west face is x3710, so a radius18 actor must stop just before x3692.
    assert!(world.add_player_at(1, 3680.0, 3990.0, 0.0));
    assert!(world.set_input(
        1,
        InputIntent {
            move_x: 1.0,
            ..Default::default()
        }
    ));
    world.step_by(100.0);
    let first = world.fighter(1).unwrap();
    assert!(
        first.x >= 3691.95 && first.x < 3692.0,
        "wall contact should advance safely, got {}",
        first.x
    );
    assert_eq!(
        overlaps_known_static_solid(first.x, first.y, 18.0),
        Ok(false)
    );

    // Genuine lateral motion along the same physical wall must remain available.
    assert!(world.set_input(
        1,
        InputIntent {
            move_y: 1.0,
            ..Default::default()
        }
    ));
    world.step_by(100.0);
    let slid = world.fighter(1).unwrap();
    assert!(slid.y >= 4011.0, "tangent movement trapped at y={}", slid.y);
    assert!(slid.x < 3692.0);
}

#[test]
fn alpha_p6_authored_world9_streets_are_continuously_navigable_on_server() {
    // Exactly the World9 Phase A suggested outside route, never a portal or teleport.
    let points = [
        (4110.0, 4160.0),
        (4000.0, 4160.0),
        (4000.0, 4088.0),
        (3820.0, 4088.0),
        (4000.0, 4088.0),
        (4110.0, 4088.0),
        (4110.0, 4160.0),
        (4365.0, 4160.0),
        (4365.0, 4080.0),
        (4365.0, 4160.0),
        (4230.0, 4160.0),
        (4230.0, 4380.0),
        (4230.0, 4160.0),
        (4590.0, 4160.0),
        (4590.0, 3850.0),
    ];
    let mut world = greyhaven();
    assert!(world.add_player_at(1, points[0].0, points[0].1, 0.0));
    for &(x, y) in points.iter().skip(1) {
        let mut arrived = false;
        for _ in 0..300 {
            let f = world.fighter(1).unwrap();
            let old = (f.x, f.y);
            let dx = x - old.0;
            let dy = y - old.1;
            let distance = dx.hypot(dy);
            if distance <= 2.2 {
                arrived = true;
                break;
            }
            assert!(world.set_input(
                1,
                InputIntent {
                    move_x: dx / distance,
                    move_y: dy / distance,
                    ..Default::default()
                }
            ));
            world.step_by(10.0);
            let f = world.fighter(1).unwrap();
            assert!(f.x.is_finite() && f.y.is_finite());
            assert!(f.x >= 18.0 && f.x <= 8192.0 - 18.0);
            assert!(f.y >= 18.0 && f.y <= 8192.0 - 18.0);
            assert_eq!(overlaps_known_static_solid(f.x, f.y, 18.0), Ok(false));
            assert!(
                (f.x - old.0).hypot(f.y - old.1) < 2.151,
                "source movement snapped beyond its original speed"
            );
        }
        assert!(
            arrived,
            "server route blocked before ({x},{y}); actual={:?}",
            world.fighter(1).map(|f| (f.x, f.y))
        );
    }
}
