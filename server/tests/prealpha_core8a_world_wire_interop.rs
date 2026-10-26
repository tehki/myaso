//! Dormant Core8A exact byte-vector -> Combat4 server reducer -> original
//! Rust World proof. The vectors are the unchanged source output of the
//! Core8A outbox, not a real authenticated QUIC packet or client simulation.
use myaso_server::prealpha_lmb_gesture_authority::{Command, Disposition, GestureAuthority};
use myaso_server::prealpha_lmb_gesture_proposal::{decode_event, GestureAction, GestureEvent};
use myaso_server::simulation::{Action, CombatEvent, World};

const LEASE: u64 = 0xAABB_3344;
const OUTBOX_PRESS_TICK42: [u8; 16] = [2, 0x11, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 42, 0, 0, 0];
const OUTBOX_RELEASE_TICK42: [u8; 16] = [2, 0x11, 3, 0, 2, 0, 0, 0, 1, 0, 0, 0, 42, 0, 0, 0];
const OUTBOX_UPGRADE_TICK43: [u8; 16] = [2, 0x11, 2, 0, 2, 0, 0, 0, 1, 0, 0, 0, 43, 0, 0, 0];
const OUTBOX_HEAVY_RELEASE_TICK63: [u8; 16] = [2, 0x11, 3, 0, 3, 0, 0, 0, 1, 0, 0, 0, 63, 0, 0, 0];

struct LinkLab {
    world: World,
    authority: GestureAuthority,
    hits: Vec<(u8, u8)>,
}
impl LinkLab {
    fn new() -> Self {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
        assert!(world.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
        Self {
            world,
            authority: GestureAuthority::new(LEASE),
            hits: vec![],
        }
    }
    fn accept(&mut self, bytes: &[u8]) -> (Disposition, Command) {
        let event = decode_event(bytes).expect("genuine proposed Core8A source wire, Rust decode");
        let decision = self
            .authority
            .process(LEASE, event, self.world.now_ms.round() as u64);
        if decision.disposition == Disposition::Accepted
            && !matches!(decision.command, Command::None)
        {
            assert!(self
                .world
                .apply_review_only_lmb_gesture_command(1, decision.command));
        }
        (decision.disposition, decision.command)
    }
    fn step(&mut self) {
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
        if let Some(cmd) = self
            .authority
            .advance(LEASE, self.world.now_ms.round() as u64)
        {
            assert!(self.world.apply_review_only_lmb_gesture_command(1, cmd));
        }
    }
    fn steps(&mut self, count: usize) {
        for _ in 0..count {
            self.step();
        }
    }
}
#[test]
fn core8a_two_fast_events_in_one_client_tick_cross_rust_authority_and_hit_once() {
    let mut lab = LinkLab::new();
    assert_eq!(
        lab.accept(&OUTBOX_PRESS_TICK42),
        (Disposition::Accepted, Command::BeginLightWindup)
    );
    assert_eq!(lab.world.fighter(1).unwrap().action, Action::AttackWindup);
    assert_eq!(
        lab.accept(&OUTBOX_RELEASE_TICK42),
        (Disposition::Accepted, Command::None)
    );
    lab.steps(55);
    assert_eq!(lab.hits, vec![(34, 66)]);
    assert_eq!(lab.world.fighter(2).unwrap().hp, 66.0);
    assert_eq!(
        lab.accept(&OUTBOX_RELEASE_TICK42),
        (Disposition::Duplicate, Command::None)
    );
    assert_eq!(lab.hits.len(), 1);
}
#[test]
fn core8a_three_ordered_events_upgrade_and_release_after_320_server_ms_one_heavy() {
    let mut lab = LinkLab::new();
    assert_eq!(
        lab.accept(&OUTBOX_PRESS_TICK42).1,
        Command::BeginLightWindup
    );
    lab.steps(4);
    assert!(matches!(
        lab.accept(&OUTBOX_UPGRADE_TICK43).1,
        Command::UpgradeHeldHeavy { .. }
    ));
    lab.steps(27); // 516ms > READY threshold, no unsolicited hit
    assert!(lab.hits.is_empty());
    assert_eq!(
        lab.accept(&OUTBOX_HEAVY_RELEASE_TICK63).1,
        Command::ReleaseHeavy
    );
    lab.steps(55);
    assert_eq!(lab.hits, vec![(46, 54)]);
    assert_eq!(lab.world.fighter(2).unwrap().hp, 54.0);
}
#[test]
fn incompatible_unnegotiated_core8c_envelope_is_not_misparsed_as_combat4_events() {
    // Core8C's independently proposed 48-byte v2/type 0x52 envelope.
    // It MUST be negotiated and adapted, never fed straight into 0x11 decoder.
    let core8c: [u8; 48] = [
        2, 0x52, 2, 0, 8, 7, 6, 5, 4, 3, 2, 1, 9, 0, 0, 0, 1, 0, 0, 0, 7, 0, 0, 0, 100, 0, 0, 0, 1,
        1, 0, 0, 2, 0, 0, 0, 7, 0, 0, 0, 100, 0, 0, 0, 3, 1, 0, 0,
    ];
    assert!(decode_event(&core8c).is_err());
    assert!(decode_event(&core8c[..16]).is_err());
    let mut core8a_wrong = OUTBOX_PRESS_TICK42;
    core8a_wrong[1] = 0x52;
    assert!(decode_event(&core8a_wrong).is_err());
}
#[test]
fn core8a_wire_never_contains_client_authorized_damage_target_or_actor() {
    let e = decode_event(&OUTBOX_PRESS_TICK42).unwrap();
    assert_eq!(
        e,
        GestureEvent {
            action: GestureAction::Press,
            sequence: 1,
            gesture_id: 1,
            client_tick: 42
        }
    );
    let mut lab = LinkLab::new();
    assert_eq!(lab.world.fighter(2).unwrap().hp, 100.0);
    assert_eq!(
        lab.accept(&OUTBOX_PRESS_TICK42).1,
        Command::BeginLightWindup
    );
    assert_eq!(
        lab.world.fighter(2).unwrap().hp,
        100.0,
        "press is windup, not HP"
    );
}
