//! Component only; does not replace genuine browser/QUIC qualification.
use myaso_server::simulation::{Action, InputIntent, World};

fn recovery_ticks(dx: f32, dy: f32, rx: f32, ry: f32) -> (u32, u32) {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 200.0 + rx, 200.0 + ry, 0.0));
    assert!(world.add_player_at(2, 200.0, 200.0, 0.0));
    assert!(world.add_player_at(3, 200.0 + dx, 200.0 + dy, 0.0));
    assert!(world.set_input(
        1,
        InputIntent {
            dodge: true,
            ..InputIntent::default()
        }
    ));
    let mut down = [None; 2];
    let mut up = [None; 2];
    for _ in 0..55 {
        world.step();
        for (i, id) in [2, 3].into_iter().enumerate() {
            let f = world.fighter(id).unwrap();
            assert_eq!(f.hp, 100.0);
            assert_eq!(f.guard, 100.0);
            if f.action == Action::Knockdown && down[i].is_none() {
                down[i] = Some(world.tick);
            }
            if down[i].is_some() && f.action == Action::Idle && up[i].is_none() {
                up[i] = Some(world.tick);
            }
        }
    }
    assert!(
        down[0].unwrap() < down[1].unwrap(),
        "one roll must hit primary first"
    );
    (up[0].unwrap(), up[1].unwrap())
}

#[test]
fn old_cluster_can_expose_secondary_only_in_one_snapshot() {
    let (first, second) = recovery_ticks(34.0, 24.0, -62.0, 0.0);
    let samples: Vec<_> = (first..second).filter(|tick| tick % 3 == 0).collect();
    assert!(
        samples.len() <= 2,
        "retain the genuinely short old recovery window"
    );
}

#[test]
fn staged_single_roll_preserves_order_and_multiple_secondary_snapshots_at_all_tolerance_extremes() {
    for ex in [-5.0, 0.0, 5.0] {
        for ey in [-5.0, 0.0, 5.0] {
            for erx in [-5.0, 0.0, 5.0] {
                for ery in [-5.0, 0.0, 5.0] {
                    let (first, second) =
                        recovery_ticks(90.0 + ex, 26.0 + ey, -46.0 + erx, 18.0 + ery);
                    assert!(
                        second - first >= 7,
                        "original World recovery gap: {first}..{second}"
                    );
                    let snapshots = (first..second).filter(|tick| tick % 3 == 0).count();
                    assert!(
                        snapshots >= 2,
                        "one skipped20Hz snapshot cannot erase the window"
                    );
                }
            }
        }
    }
}
