//! Proposed authenticated Combat4 LMB -> REAL original World action + HP proof.
//! Dormant test adapter exercises the actual World and its existing HIT events,
//! never fabricated CombatEvents, HP edits, client hit claims or browser hooks.
use myaso_server::prealpha_lmb_gesture_authority::{Command, Disposition, GestureAuthority};
use myaso_server::prealpha_lmb_gesture_proposal::{GestureAction, GestureEvent};
use myaso_server::simulation::{Action, CombatEvent, World};

const LEASE: u64 = 0x1199;
struct Lab {
    world: World,
    reducer: GestureAuthority,
    next_sequence: u32,
    hits: Vec<(u8, u8)>,
}
impl Lab {
    fn new() -> Self {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
        assert!(world.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
        Self {
            world,
            reducer: GestureAuthority::new(LEASE),
            next_sequence: 1,
            hits: Vec::new(),
        }
    }
    fn ms(&self) -> u64 {
        self.world.now_ms.round() as u64
    }
    fn event(&mut self, kind: GestureAction, id: u32) -> Command {
        let event = GestureEvent {
            action: kind,
            sequence: self.next_sequence,
            gesture_id: id,
            client_tick: u32::MAX,
        };
        self.next_sequence += 1;
        let decision = self.reducer.process(LEASE, event, self.ms());
        assert_eq!(
            decision.disposition,
            Disposition::Accepted,
            "{kind:?} rejected"
        );
        if decision.command != Command::None
            && !matches!(
                decision.command,
                Command::ActivateLight | Command::HeavyReady
            )
        {
            assert!(
                self.world
                    .apply_review_only_lmb_gesture_command(1, decision.command),
                "real World refused {kind:?} command {:?}",
                decision.command
            );
        }
        decision.command
    }
    fn tick(&mut self) {
        for event in self.world.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = event
            {
                self.hits.push((damage, hp));
            }
        }
        if let Some(command) = self.reducer.advance(LEASE, self.ms()) {
            if matches!(command, Command::ActivateLight | Command::HeavyReady) {
                assert!(
                    self.world.apply_review_only_lmb_gesture_command(1, command),
                    "real World phase disagrees with reducer at tick {}",
                    self.world.tick
                );
            }
        }
    }
    fn ticks(&mut self, count: usize) {
        for _ in 0..count {
            self.tick();
        }
    }
}

#[test]
fn press_without_release_causes_genuine_authoritative_light_hit_once() {
    let mut lab = Lab::new();
    assert_eq!(
        lab.event(GestureAction::Press, 1),
        Command::BeginLightWindup
    );
    assert_eq!(
        lab.world.fighter(1).unwrap().action,
        Action::AttackWindup,
        "server World must begin unlanded windup on PRESS not pointerUP"
    );
    assert!(
        lab.hits.is_empty(),
        "input command must never bypass authoritative hit phase"
    );
    lab.ticks(7);
    assert_eq!(lab.world.fighter(1).unwrap().action, Action::AttackWindup);
    assert!(lab.hits.is_empty());
    lab.ticks(4);
    assert_eq!(
        lab.hits,
        vec![(34, 66)],
        "only the real 34HP server HIT event qualifies"
    );
    assert_eq!(lab.world.fighter(2).unwrap().hp, 66.0);
    lab.ticks(65);
    assert_eq!(
        lab.hits.len(),
        1,
        "long held same LMB cannot auto-repeat a second light"
    );
}

#[test]
fn server_80ms_upgrade_ready_indefinite_and_release_causes_one_46hp_heavy_only() {
    let mut lab = Lab::new();
    lab.event(GestureAction::Press, 1);
    lab.ticks(5); // 83ms on actual World clock, safely inside 135ms
    assert_eq!(
        lab.event(GestureAction::Upgrade, 1),
        Command::UpgradeHeldHeavy {
            server_elapsed_ms: lab.ms()
        }
    );
    assert_eq!(
        lab.world.fighter(1).unwrap().action,
        Action::HeavyAttackWindup
    );
    lab.ticks(30);
    assert!(
        lab.hits.is_empty(),
        "held heavy must not auto hit across READY"
    );
    assert_eq!(
        lab.world.fighter(1).unwrap().action,
        Action::HeavyAttackWindup
    );
    assert_eq!(lab.world.fighter(1).unwrap().action_elapsed_ms, 320.0);
    lab.ticks(30);
    assert!(lab.hits.is_empty());
    assert_eq!(lab.event(GestureAction::Release, 1), Command::ReleaseHeavy);
    assert_eq!(
        lab.world.fighter(1).unwrap().action,
        Action::HeavyAttackActive
    );
    lab.ticks(60);
    assert_eq!(lab.hits, vec![(46, 54)]);
    assert_eq!(lab.world.fighter(2).unwrap().hp, 54.0);
}

#[test]
fn press_and_release_inside_one_60hz_tick_preserve_one_real_34hp_hit() {
    let mut lab = Lab::new();
    lab.event(GestureAction::Press, 1);
    assert_eq!(lab.event(GestureAction::Release, 1), Command::None);
    lab.ticks(40);
    assert_eq!(lab.hits, vec![(34, 66)]);
    assert_eq!(lab.world.fighter(2).unwrap().hp, 66.0);
}

#[test]
fn focus_cancel_before_hit_prevents_a_phantom_server_hp_delta() {
    let mut lab = Lab::new();
    lab.event(GestureAction::Press, 1);
    lab.ticks(3);
    assert_eq!(
        lab.event(GestureAction::Cancel, 1),
        Command::CancelUnlandedLight
    );
    lab.ticks(50);
    assert!(lab.hits.is_empty());
    assert_eq!(lab.world.fighter(2).unwrap().hp, 100.0);
    assert_eq!(lab.world.fighter(1).unwrap().action, Action::Idle);
}

#[test]
fn release_while_held_heavy_is_undercharged_resumes_exactly_one_light() {
    let mut lab = Lab::new();
    lab.event(GestureAction::Press, 1);
    lab.ticks(4);
    lab.event(GestureAction::Upgrade, 1);
    lab.ticks(7); // <320ms
    assert!(matches!(
        lab.event(GestureAction::Release, 1),
        Command::ResumeLight { .. }
    ));
    lab.ticks(55);
    assert_eq!(lab.hits, vec![(34, 66)]);
    assert_eq!(lab.world.fighter(2).unwrap().hp, 66.0);
}

#[test]
fn cancelled_heavy_ready_and_late_upgrade_cannot_hit_original_target_twice() {
    let mut cancel = Lab::new();
    cancel.event(GestureAction::Press, 1);
    cancel.ticks(3);
    cancel.event(GestureAction::Upgrade, 1);
    cancel.ticks(25);
    assert_eq!(
        cancel.event(GestureAction::Cancel, 1),
        Command::CancelUnlandedLight
    );
    cancel.ticks(65);
    assert!(cancel.hits.is_empty());
    assert_eq!(cancel.world.fighter(2).unwrap().hp, 100.0);

    let mut late = Lab::new();
    late.event(GestureAction::Press, 1);
    late.ticks(20);
    let e = GestureEvent {
        action: GestureAction::Upgrade,
        sequence: late.next_sequence,
        gesture_id: 1,
        client_tick: 0,
    };
    let decision = late.reducer.process(LEASE, e, late.ms());
    assert_eq!(decision.disposition, Disposition::Accepted);
    assert_eq!(
        decision.command,
        Command::None,
        "late upgrade cannot authorize a heavy or second hit"
    );
    late.ticks(60);
    assert_eq!(late.hits, vec![(34, 66)]);
}

#[test]
fn legacy_v1_lmb_and_retired_key_e_bits_cannot_be_modified_by_review_v2_commands() {
    use myaso_server::simulation::InputIntent;
    let mut legacy_light = World::new(800.0, 600.0);
    legacy_light.add_player_at(1, 250.0, 300.0, 0.0);
    legacy_light.set_input(
        1,
        InputIntent {
            attack: true,
            ..InputIntent::default()
        },
    );
    legacy_light.step();
    assert_eq!(
        legacy_light.fighter(1).unwrap().action,
        Action::AttackWindup
    );
    assert!(!legacy_light.apply_review_only_lmb_gesture_command(
        1,
        Command::UpgradeHeldHeavy {
            server_elapsed_ms: 17
        }
    ));
    assert!(!legacy_light.apply_review_only_lmb_gesture_command(1, Command::CancelUnlandedLight));
    assert_eq!(
        legacy_light.fighter(1).unwrap().action,
        Action::AttackWindup
    );

    let mut key_e = World::new(800.0, 600.0);
    key_e.add_player_at(1, 250.0, 300.0, 0.0);
    key_e.set_input(
        1,
        InputIntent {
            heavy_attack: true,
            ..InputIntent::default()
        },
    );
    // The obsolete keyboard-heavy-only v1 bit is now inert. Retired E
    // cannot invent a World heavy or borrow the typed LMB review owner.
    assert!(key_e.step().is_empty());
    assert_eq!(key_e.fighter(1).unwrap().action, Action::Idle);
    assert!(!key_e.apply_review_only_lmb_gesture_command(1, Command::ReleaseHeavy));
    assert!(!key_e.apply_review_only_lmb_gesture_command(1, Command::CancelUnlandedLight));
    for _ in 0..24 {
        assert!(key_e.step().is_empty());
    }
    assert_eq!(key_e.fighter(1).unwrap().action, Action::Idle);
}
#[test]
fn non_owner_cannot_press_against_active_block_or_force_ready_with_elapsed_claim() {
    use myaso_server::simulation::InputIntent;
    let mut defending = World::new(800.0, 600.0);
    defending.add_player_at(1, 250.0, 300.0, 0.0);
    defending.set_input(
        1,
        InputIntent {
            block: true,
            ..InputIntent::default()
        },
    );
    defending.step();
    assert_eq!(defending.fighter(1).unwrap().action, Action::Block);
    assert!(!defending.apply_review_only_lmb_gesture_command(1, Command::BeginLightWindup));

    let mut lab = Lab::new();
    lab.event(GestureAction::Press, 1);
    lab.ticks(3);
    let before = lab.world.fighter(1).unwrap().action_elapsed_ms;
    assert!(!lab.world.apply_review_only_lmb_gesture_command(
        1,
        Command::UpgradeHeldHeavy {
            server_elapsed_ms: 320
        }
    ));
    assert_eq!(lab.world.fighter(1).unwrap().action, Action::AttackWindup);
    assert!(
        !lab.world
            .apply_review_only_lmb_gesture_command(2, Command::ReleaseHeavy),
        "no cross-player stolen heavy"
    );
    assert!(
        !lab.world
            .apply_review_only_lmb_gesture_command(99, Command::BeginLightWindup),
        "unknown actor must not spawn from a packet"
    );
    assert!(before > 20.0 && before < 100.0);
}
#[test]
fn removal_and_rejoin_prevent_old_heavy_command_from_hitting_new_fighter() {
    let mut lab = Lab::new();
    lab.event(GestureAction::Press, 1);
    lab.ticks(4);
    lab.event(GestureAction::Upgrade, 1);
    lab.ticks(30);
    assert!(lab.world.remove_player(1));
    assert!(lab.world.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(!lab
        .world
        .apply_review_only_lmb_gesture_command(1, Command::ReleaseHeavy));
    assert!(!lab
        .world
        .apply_review_only_lmb_gesture_command(1, Command::CancelUnlandedLight));
    lab.ticks(35);
    assert!(lab.hits.is_empty());
    assert_eq!(lab.world.fighter(2).unwrap().hp, 100.0);
}

#[test]
fn four_server_owned_fighters_preserve_real_combat_targeting_and_single_hit() {
    let mut lab = Lab::new();
    assert!(lab
        .world
        .add_player_at(3, 500.0, 300.0, std::f32::consts::PI));
    assert!(lab
        .world
        .add_player_at(4, 650.0, 300.0, std::f32::consts::PI));
    assert_eq!(lab.world.fighters().len(), 4);
    lab.event(GestureAction::Press, 1);
    lab.ticks(5);
    lab.event(GestureAction::Upgrade, 1);
    lab.ticks(35);
    assert!(lab.hits.is_empty());
    lab.event(GestureAction::Release, 1);
    lab.ticks(60);
    assert_eq!(
        lab.hits,
        vec![(46, 54)],
        "one authoritative heavy HIT to in-range opponent"
    );
    assert_eq!(lab.world.fighter(2).unwrap().hp, 54.0);
    assert_eq!(
        lab.world.fighter(3).unwrap().hp,
        100.0,
        "out-of-range original player untouched"
    );
    assert_eq!(lab.world.fighter(4).unwrap().hp, 100.0);
}
#[test]
fn actual_world_does_not_apply_duplicated_network_release_to_second_heavy() {
    let mut lab = Lab::new();
    lab.event(GestureAction::Press, 1);
    lab.ticks(5);
    lab.event(GestureAction::Upgrade, 1);
    lab.ticks(30);
    let sequence = lab.next_sequence;
    assert_eq!(lab.event(GestureAction::Release, 1), Command::ReleaseHeavy);
    let duplicate = GestureEvent {
        action: GestureAction::Release,
        sequence,
        gesture_id: 1,
        client_tick: u32::MAX,
    };
    let decision = lab.reducer.process(LEASE, duplicate, lab.ms());
    assert_eq!(decision.disposition, Disposition::Duplicate);
    assert_eq!(decision.command, Command::None);
    lab.ticks(60);
    assert_eq!(lab.hits, vec![(46, 54)]);
}
