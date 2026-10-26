//! M173 original World regression: sparse client stamina snapshots cannot replace
//! a same-tick authoritative debit when normal 60 Hz regeneration intervenes.
//! Uses only real production World, input and stamina rules; no mock ledger.

use myaso_server::simulation::{Action, InputIntent, World};

#[test]
fn m173_stale_14_to_2_replica_is_a_real_14_point_jump_after_regeneration() {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 300.0, 300.0, 0.0));
    assert!(world.add_player_at(2, 700.0, 500.0, 0.0));

    // A genuine movement+run input drains the original World to the
    // low-stamina baseline represented as 14 by the compact client snapshot.
    let run = InputIntent {
        run: true,
        move_x: -1.0,
        ..InputIntent::default()
    };
    let mut run_ticks = 0;
    while world.fighter(1).expect("actor").stamina >= 13.99 && run_ticks < 300 {
        assert!(world.set_input(1, run));
        world.step();
        run_ticks += 1;
    }
    let stale_snapshot = world.fighter(1).expect("actor").stamina;
    assert_eq!(
        stale_snapshot.round() as i32,
        14,
        "original low-stamina baseline"
    );

    // A physical input can arrive several frames later. Normal World
    // regeneration increases the actual pre-spend stamina in the meantime.
    assert!(world.set_input(1, InputIntent::default()));
    for _ in 0..26 {
        world.step();
    }
    let actual_pre_spend = world.fighter(1).expect("actor").stamina;
    assert!(
        actual_pre_spend > stale_snapshot + 1.0 && actual_pre_spend < 26.0,
        "the jump is affordable, but combined Jump Attack is not"
    );

    // Genuine simultaneous Space+LMB is denied as a Jump Attack and falls
    // back to exactly one ordinary Jump on the original authoritative tick.
    let preceding_tick = world.tick;
    assert!(world.set_input(
        1,
        InputIntent {
            jump: true,
            attack: true,
            ..InputIntent::default()
        }
    ));
    world.step();
    let fighter = world.fighter(1).expect("actor");
    assert_eq!(world.tick, preceding_tick + 1);
    assert_eq!(
        fighter.action,
        Action::Jump,
        "unaffordable Jump Attack never starts"
    );
    assert!(
        (actual_pre_spend - fighter.stamina - 14.0).abs() < 0.01,
        "authoritative pre/post must debit exactly 14, not 12"
    );
    assert_eq!(fighter.stamina.round() as i32, 2, "late replica can show 2");
    assert!(
        (stale_snapshot - fighter.stamina - 14.0).abs() > 1.0,
        "stale 14-to-2 client arithmetic is not authoritative debit evidence"
    );
    assert_eq!(world.fighter(2).expect("spectator").hp, 100.0);
}
