//! Combat 4C independent original-World qualification of Core8A #868.
//! Only a regression fixture: no actor, World, protocol, hit or client change.
//! ACK is a transport receipt, never proof that an opposing actor took HP.
use myaso_server::prealpha_authenticated_gesture::SessionGestureWorldPath;
use myaso_server::prealpha_lmb_gesture_proposal::{
    encode_typed_event, AckStatus, GestureAction, GestureEvent, GestureSource, TypedGestureEvent,
};
use myaso_server::simulation::{Action, CombatEvent, World};

const LEASE: u64 = 0x4c_4c;
const BOOT: u128 = 0xabc1_1234_5678_9def;

fn arena() -> World {
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    w
}

fn edge(source: GestureSource, action: GestureAction, sequence: u32, id: u32) -> [u8; 16] {
    encode_typed_event(TypedGestureEvent {
        source,
        event: GestureEvent {
            action,
            sequence,
            gesture_id: id,
            client_tick: u32::MAX, // not authoritative, even for maximum diagnostic value
        },
    })
    .expect("existing canonical typed 0x11 event")
}

fn ack(
    path: &mut SessionGestureWorldPath,
    w: &mut World,
    source: GestureSource,
    action: GestureAction,
    sequence: u32,
    id: u32,
) -> AckStatus {
    let receipt = path
        .accept_under_world_lock(w, LEASE, BOOT, &edge(source, action, sequence, id))
        .expect("valid contiguous edge has a genuine original World receipt");
    assert_eq!(receipt.sequence, sequence);
    assert_eq!(receipt.gesture_id, id);
    assert_eq!(receipt.server_tick, w.tick);
    receipt.status
}

fn step_hits(path: &mut SessionGestureWorldPath, w: &mut World, ticks: usize) -> Vec<(u8, u8)> {
    let mut hits = Vec::new();
    for _ in 0..ticks {
        for event in w.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = event
            {
                hits.push((damage, hp));
            }
        }
        path.advance_under_world_lock(w, LEASE, BOOT);
    }
    hits
}

#[test]
fn late_busy_keye_terminal_after_original_light_recovery_never_poison_next_light() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::KeyE,
            GestureAction::Press,
            2,
            2
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            3,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(step_hits(&mut p, &mut w, 55), vec![(34, 66)]);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);

    // This physically delayed terminal comes AFTER original combat recovered.
    // It must acknowledge the earlier suppressed KeyE without launching an
    // auto-heavy (or retiring the shared typed sender as fatal REJECTED).
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::KeyE,
            GestureAction::Release,
            4,
            2
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::KeyE,
            GestureAction::Release,
            4,
            2
        ),
        AckStatus::Duplicate
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    assert!(step_hits(&mut p, &mut w, 8).is_empty());

    // A busy receipt must not overwrite the identity of the *real* LMB
    // World action, so the next distinct same-lease light remains possible.
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            5,
            3
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            6,
            3
        ),
        AckStatus::Accepted
    );
    assert_eq!(step_hits(&mut p, &mut w, 55), vec![(34, 32)]);
    assert_eq!(w.fighter(2).unwrap().hp, 32.0);
}

#[test]
fn late_busy_lmb_terminal_after_original_keye_autoheavy_cannot_create_light() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    // The #858/#868 isolated lineage preserves original standalone KeyE
    // auto-commit at server 320ms. This does NOT change release-only held LMB.
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::KeyE,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            2,
            2
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Upgrade,
            3,
            2
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Upgrade,
            3,
            2
        ),
        AckStatus::Duplicate
    );
    assert_eq!(step_hits(&mut p, &mut w, 55), vec![(46, 54)]);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(w.fighter(2).unwrap().hp, 54.0);

    // Physically delayed LMB release after KeyE committed must remain an
    // ordered no-combat receipt; KeyE's own terminal is not another hit.
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            4,
            2
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            4,
            2
        ),
        AckStatus::Duplicate
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::KeyE,
            GestureAction::Release,
            5,
            1
        ),
        AckStatus::Accepted
    );
    assert!(step_hits(&mut p, &mut w, 8).is_empty());
    assert_eq!(w.fighter(2).unwrap().hp, 54.0);

    // After the accepted but discarded LMB hold, a fresh LMB source0
    // PRESS/RELEASE can legitimately land its sole original 34HP contact.
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            6,
            3
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            7,
            3
        ),
        AckStatus::Accepted
    );
    assert_eq!(step_hits(&mut p, &mut w, 55), vec![(34, 20)]);
    assert_eq!(w.fighter(2).unwrap().hp, 20.0);
}
