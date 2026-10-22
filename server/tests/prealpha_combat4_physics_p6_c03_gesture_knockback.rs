//! Combat4 review gesture -> original World hit -> Physics6 actual completed-tick
//! four-fighter separation. Single-process TEST-OWNED fixture only. Real v2
//! WebTransport is not negotiated or enabled; no fabricated damage/positions.
use myaso_server::prealpha_lmb_gesture_authority::Command;
use myaso_server::simulation::{Action, CombatEvent, World};

const MIN_CENTER_DISTANCE: f32 = 36.0;
fn arena() -> World {
    let mut w = World::new(800.0, 600.0);
    // #2 is reachable by source-owned light/heavy, #3/#4 are bystanders
    // next to the attack knockback landing zone.
    for (id, x) in [(1, 200.0), (2, 272.0), (3, 308.0), (4, 344.0)] {
        assert!(w.add_player_at(id, x, 200.0, 0.0));
    }
    w
}
fn assert_all_fighter_pairs_separated(w: &World) {
    for first in 1..=4 {
        for second in first + 1..=4 {
            let a = w.fighter(first).unwrap();
            let b = w.fighter(second).unwrap();
            let distance = (a.x - b.x).hypot(a.y - b.y);
            assert!(
                distance+0.01>=MIN_CENTER_DISTANCE,
                "post-hit World tick {} real fighters {first}/{second} penetrate: {distance}, ({},{})/({},{})",
                w.tick,a.x,a.y,b.x,b.y);
        }
    }
}
#[test]
fn review_owned_instant_light_hits_one_real_34hp_and_no_four_body_overlap_on_hit_tick() {
    let mut w = arena();
    assert_all_fighter_pairs_separated(&w);
    assert!(w.apply_review_only_lmb_gesture_command(1, Command::BeginLightWindup));
    assert_eq!(w.fighter(1).unwrap().action, Action::AttackWindup);
    let mut hits = vec![];
    for _ in 0..50 {
        let events = w.step();
        for event in events {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = event
            {
                hits.push((damage, hp));
                assert_all_fighter_pairs_separated(&w);
                assert_eq!(w.fighter(3).unwrap().hp, 100.0);
                assert_eq!(w.fighter(4).unwrap().hp, 100.0);
            }
        }
    }
    assert_eq!(hits, vec![(34, 66)]);
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
}
#[test]
fn held_review_ready_never_hits_until_release_and_real_46hp_knockback_is_separated_same_tick() {
    let mut w = arena();
    assert!(w.apply_review_only_lmb_gesture_command(1, Command::BeginLightWindup));
    for _ in 0..4 {
        w.step();
    }
    let ms = w.fighter(1).unwrap().action_elapsed_ms as u64;
    assert!(w.apply_review_only_lmb_gesture_command(
        1,
        Command::UpgradeHeldHeavy {
            server_elapsed_ms: ms
        }
    ));
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    for _ in 0..42 {
        // Beyond 320ms READY, no auto-hit.
        assert!(w
            .step()
            .into_iter()
            .all(|e| !matches!(e, CombatEvent::Hit { .. })));
    }
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert_eq!(w.fighter(1).unwrap().action_elapsed_ms, 320.0);
    assert_eq!(w.fighter(2).unwrap().hp, 100.0);
    assert!(w.apply_review_only_lmb_gesture_command(1, Command::ReleaseHeavy));
    let mut hits = vec![];
    for _ in 0..50 {
        for event in w.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = event
            {
                hits.push((damage, hp));
                assert_all_fighter_pairs_separated(&w);
                assert_eq!(w.fighter(3).unwrap().hp, 100.0);
                assert_eq!(w.fighter(4).unwrap().hp, 100.0);
            }
        }
    }
    assert_eq!(hits, vec![(46, 54)]);
    assert_eq!(w.fighter(2).unwrap().hp, 54.0);
}
