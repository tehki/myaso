// Regression tests for separate E and LMB input sources.
use myaso_server::prealpha_lmb_gesture_authority::Command;
use myaso_server::prealpha_lmb_gesture_proposal::{decode_event, DecodeError};
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};

fn arena() -> World {
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    w
}
fn attacks(w: &mut World, count: usize) -> Vec<u8> {
    let mut damage = vec![];
    for _ in 0..count {
        for e in w.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage: hp,
                ..
            } = e
            {
                damage.push(hp);
            }
        }
    }
    damage
}

#[test]
fn original_e_input_cannot_upgrade_a_separate_review_lmb_light() {
    let mut w = arena();
    assert!(w.apply_review_only_lmb_gesture_command(1, Command::BeginLightWindup));
    assert_eq!(w.fighter(1).unwrap().action, Action::AttackWindup);
    assert!(attacks(&mut w, 3).is_empty());
    assert!(w.set_input(
        1,
        InputIntent {
            heavy_attack: true,
            ..InputIntent::default()
        }
    ));
    assert!(attacks(&mut w, 1).is_empty());
    assert_eq!(w.fighter(1).unwrap().action, Action::AttackWindup);
    assert!(w.set_input(1, InputIntent::default()));
    assert_eq!(attacks(&mut w, 55), vec![34]);
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
}
#[test]
fn original_e_from_idle_still_auto_commits_only_one_heavy() {
    let mut w = arena();
    assert!(w.set_input(
        1,
        InputIntent {
            heavy_attack: true,
            ..InputIntent::default()
        }
    ));
    assert!(attacks(&mut w, 1).is_empty());
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert!(w.set_input(1, InputIntent::default()));
    assert_eq!(attacks(&mut w, 65), vec![46]);
    assert_eq!(w.fighter(2).unwrap().hp, 54.0);
}

#[test]
fn review_lmb_heavy_stays_ready_even_when_original_e_is_pressed() {
    let mut w = arena();
    assert!(w.apply_review_only_lmb_gesture_command(1, Command::BeginLightWindup));
    assert!(attacks(&mut w, 4).is_empty());
    let ms = w.fighter(1).unwrap().action_elapsed_ms as u64;
    assert!(w.apply_review_only_lmb_gesture_command(
        1,
        Command::UpgradeHeldHeavy {
            server_elapsed_ms: ms
        }
    ));
    assert!(w.set_input(
        1,
        InputIntent {
            heavy_attack: true,
            ..InputIntent::default()
        }
    ));
    assert!(attacks(&mut w, 30).is_empty());
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert_eq!(w.fighter(1).unwrap().action_elapsed_ms, 320.0);
    assert!(w.set_input(1, InputIntent::default()));
    assert!(attacks(&mut w, 20).is_empty());
    assert!(w.apply_review_only_lmb_gesture_command(1, Command::ReleaseHeavy));
    assert_eq!(attacks(&mut w, 45), vec![46]);
}
#[test]
fn proposed_keye_source_bit_remains_refused_until_723_approval() {
    const FUTURE_E: [u8; 16] = [2, 0x11, 1, 1, 3, 0, 0, 0, 2, 0, 0, 0, 43, 0, 0, 0];
    const ORIGINAL_LMB: [u8; 16] = [2, 0x11, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 42, 0, 0, 0];
    assert_eq!(decode_event(&FUTURE_E), Err(DecodeError::Reserved));
    assert!(decode_event(&ORIGINAL_LMB).is_ok());
}
