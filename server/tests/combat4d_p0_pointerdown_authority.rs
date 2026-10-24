//! Combat 4D independent, fail-first source-level acceptance for #1011.
//!
//! The currently deployed v1 intent uses attack+heavy_attack while genuine
//! LMB is held; standalone KeyE uses heavy_attack without attack.  The
//! approved Pre-Alpha contract requires pointerDOWN to start an *unlanded*
//! 135ms light windup, which may later be upgraded before any light HIT.
//!
//! These tests exercise the ORIGINAL Rust World, not browser/QUIC provenance.
//! The first is deliberately RED on the 2026-10-24 protected main baseline.
//! Keep it RED until 4A/4B/4C/Core8 jointly land the one-path correction.
//! Do not weaken the strict assertion, alter game constants, or treat a
//! source-level green result as native-browser/multiplayer release approval.

use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};

#[test]
fn p0_genuine_lmb_hold_intent_begins_light_windup_before_pointerup() {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 220.0, 260.0, 0.0));
    assert!(world.add_player_at(2, 290.0, 260.0, std::f32::consts::PI,));

    // This is the original v1 charge bit pattern emitted on physical LMB
    // DOWN. No release packet or client clock has been supplied.
    assert!(world.set_input(
        1,
        InputIntent {
            attack: true,
            heavy_attack: true,
            ..InputIntent::default()
        },
    ));
    let events = world.step();

    assert_eq!(
        world.fighter(1).expect("admitted attacker").action,
        Action::AttackWindup,
        "P0 FAIL-FIRST: LMB pointerDOWN must initiate server-owned light windup; \
         holding to charge cannot postpone the first light until pointerUP",
    );
    assert_eq!(
        world.fighter(2).expect("live victim").hp,
        100.0,
        "135ms windup cannot instantly deal light or heavy damage",
    );
    assert!(
        events
            .iter()
            .all(|event| !matches!(event, CombatEvent::Hit { .. })),
        "no committed World HIT may occur on the initial 60Hz windup tick",
    );
}

#[test]
fn p0_standalone_keye_still_has_its_own_server_heavy_origin() {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 220.0, 260.0, 0.0));
    assert!(world.set_input(
        1,
        InputIntent {
            heavy_attack: true,
            ..InputIntent::default()
        },
    ));

    let events = world.step();
    assert_eq!(
        world.fighter(1).expect("admitted KeyE actor").action,
        Action::HeavyAttackWindup,
        "KeyE must remain a distinct server-owned heavy gesture, not LMB",
    );
    assert!(
        events
            .iter()
            .all(|event| !matches!(event, CombatEvent::Hit { .. })),
        "standalone KeyE windup cannot commit immediate damage",
    );
}
