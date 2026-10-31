//! Trust-boundary bridge: derive no-damage Ember interruptions from Combat.
//!
//! This domain is not invoked by the live server. Caller MUST obtain Fighter,
//! zone membership and identity from one trusted authoritative world tick and
//! hold a single writer lock across this preflight and the checkpoint write.
//! A packet cannot choose whether its own cast was interrupted or cancelled.
//! No damage, loot transfer, projectile or spell effect occurs in this code.

use std::path::Path;

use crate::character_identity::{SessionIdentityRegistry, SessionLease};
use crate::loot::LootAuthority;
use crate::magic::{EmberEffectStatus, MagicAuthority};
use crate::magic_checkpoint::{
    resolve_ember_without_damage, EmberNoEffectDecision, JointCheckpointError,
};
use crate::simulation::{Action, Fighter};
use crate::zone::ZoneAuthority;

#[derive(Debug)]
pub enum CombatInterruptionError {
    UnverifiedSession,
    WrongFighter,
    MissingInventory,
    MissingIntent,
    IntentAlreadyResolved,
    UncommittedIntent,
    WrongZone,
    InvalidFighter,
    NotInterrupted,
    Commit(JointCheckpointError),
}

/// Parameters originate in the authenticated World simulation, not a packet.
/// SessionLease must identify the exact live connection incarnation.
pub struct CombatInterruption<'a> {
    pub lease: SessionLease,
    pub sequence: u64,
    pub fighter: &'a Fighter,
}

/// Stage and durably record a no-damage terminal outcome when authoritative
/// fighter state proves a spell interruption. Dead/HP-zero fighters cancel;
/// Stunned/Knockdown fighters interrupt. Other actions are not evidence of
/// an interruption, so an Idle/Block/Dodge request cannot cancel a spell.
///
/// A successful call retains the paid mana/reagents and operation ID; it does
/// not refund or reverse them. A failed pre-commit write leaves RAM unchanged.
/// Errors after the checkpoint rename are indeterminate until recovery.
pub fn record_ember_combat_interruption(
    path: &Path,
    loot: &LootAuthority,
    magic: &mut MagicAuthority,
    identity: &SessionIdentityRegistry,
    zones: &ZoneAuthority,
    event: CombatInterruption<'_>,
) -> Result<EmberEffectStatus, CombatInterruptionError> {
    let character = identity
        .resolve_session(event.lease)
        .ok_or(CombatInterruptionError::UnverifiedSession)?;
    let actor = event.lease.server_session();
    if event.fighter.net_id != actor {
        return Err(CombatInterruptionError::WrongFighter);
    }
    if loot.inventory(actor).is_none() {
        return Err(CombatInterruptionError::MissingInventory);
    }
    let intent = magic
        .ember_intent(character, event.sequence)
        .ok_or(CombatInterruptionError::MissingIntent)?;
    if intent.status != EmberEffectStatus::Pending {
        return Err(CombatInterruptionError::IntentAlreadyResolved);
    }
    if loot
        .committed_operation_sequence(character)
        .is_none_or(|sequence| sequence < event.sequence)
    {
        return Err(CombatInterruptionError::UncommittedIntent);
    }
    if zones.zone_of(actor) != Some(intent.zone) {
        return Err(CombatInterruptionError::WrongZone);
    }
    let (width, height) = intent.zone.bounds();
    if !event.fighter.x.is_finite()
        || !event.fighter.y.is_finite()
        || !event.fighter.hp.is_finite()
        || event.fighter.x < 18.0
        || event.fighter.y < 18.0
        || event.fighter.x > width - 18.0
        || event.fighter.y > height - 18.0
    {
        return Err(CombatInterruptionError::InvalidFighter);
    }
    let outcome =
        if event.fighter.action == Action::Dead || event.fighter.hp <= 0.0 || loot.is_dead(actor) {
            EmberEffectStatus::Cancelled
        } else if matches!(event.fighter.action, Action::Stunned | Action::Knockdown) {
            EmberEffectStatus::Interrupted
        } else {
            return Err(CombatInterruptionError::NotInterrupted);
        };

    resolve_ember_without_damage(
        path,
        loot,
        magic,
        identity,
        zones,
        EmberNoEffectDecision {
            lease: event.lease,
            sequence: event.sequence,
            outcome,
        },
    )
    .map_err(CombatInterruptionError::Commit)?;
    Ok(outcome)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character_identity::CharacterId;
    use crate::loot::{EquipmentSlot, ItemKind};
    use crate::magic::{Lesson, LessonAward, LessonSource, Rune, Spell};
    use crate::magic_checkpoint::{load_joint, save_joint};
    use crate::simulation::World;
    use std::fs;
    use std::num::NonZeroU64;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_SEQUENCE: AtomicU64 = AtomicU64::new(1);

    fn path() -> std::path::PathBuf {
        let number = TEST_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!(
            "myaso-combat-interrupt-{}-{number}.bin",
            std::process::id()
        ))
    }

    fn fixture() -> (
        LootAuthority,
        MagicAuthority,
        SessionIdentityRegistry,
        ZoneAuthority,
        CharacterId,
        Fighter,
    ) {
        let mut loot = LootAuthority::new();
        let mut magic = MagicAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        let mut zones = ZoneAuthority::new();
        let hero = CharacterId::new(803).unwrap();
        let lease = SessionLease::new(1, 1).unwrap();
        identity.bind_verified(lease, hero).unwrap();
        zones.register(1).unwrap();
        loot.register(1).unwrap();
        let spellbook = loot.grant(1, ItemKind::Spellbook, 1).unwrap();
        loot.equip(1, spellbook, EquipmentSlot::OffHand).unwrap();
        loot.grant(1, ItemKind::SulfurAsh, 1).unwrap();
        for (receipt, lesson) in [
            (1, Lesson::Rune(Rune::Fire)),
            (2, Lesson::Spell(Spell::Ember)),
        ] {
            magic
                .grant_lesson(LessonAward {
                    receipt: NonZeroU64::new(receipt).unwrap(),
                    character: hero,
                    source: LessonSource::NpcTeacher,
                    lesson,
                })
                .unwrap();
        }
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        let fighter = world.fighter(1).unwrap().clone();
        let staged_checkpoint = path();
        crate::magic_cast::commit_ember_cost(
            &staged_checkpoint,
            &mut loot,
            &mut magic,
            &identity,
            &zones,
            crate::loot_transaction::VerifiedLootOperation {
                lease,
                sequence: 30,
            },
            &fighter,
        )
        .unwrap();
        assert_eq!(magic.mana(hero), 85);
        let _ = fs::remove_file(staged_checkpoint);
        (loot, magic, identity, zones, hero, fighter)
    }

    fn event(fighter: &Fighter) -> CombatInterruption<'_> {
        CombatInterruption {
            lease: SessionLease::new(1, 1).unwrap(),
            sequence: 30,
            fighter,
        }
    }

    #[test]
    fn stunned_interrupt_is_checkpointed_and_cannot_restart() {
        let (loot, mut magic, identity, zones, hero, mut fighter) = fixture();
        fighter.action = Action::Stunned;
        let checkpoint = path();
        save_joint(&checkpoint, &loot, &identity, &magic).unwrap();
        assert!(matches!(
            record_ember_combat_interruption(
                &checkpoint,
                &loot,
                &mut magic,
                &identity,
                &zones,
                event(&fighter),
            ),
            Ok(EmberEffectStatus::Interrupted)
        ));
        let (recovered_loot, mut recovered) = load_joint(&checkpoint).unwrap();
        assert_eq!(recovered_loot.committed_operation_sequence(hero), Some(30));
        assert_eq!(recovered.pending_ember_intents().count(), 0);
        assert_eq!(
            recovered.ember_intent(hero, 30).unwrap().status,
            EmberEffectStatus::Interrupted
        );
        assert!(matches!(
            record_ember_combat_interruption(
                &checkpoint,
                &loot,
                &mut recovered,
                &identity,
                &zones,
                event(&fighter),
            ),
            Err(CombatInterruptionError::IntentAlreadyResolved)
        ));
        let _ = fs::remove_file(&checkpoint);
    }

    #[test]
    fn authoritative_death_cancels_but_never_refunds_resources() {
        let (loot, mut magic, identity, zones, hero, mut fighter) = fixture();
        assert_eq!(magic.mana(hero), 85);
        let checkpoint = path();
        fighter.action = Action::Dead;
        assert!(matches!(
            record_ember_combat_interruption(
                &checkpoint,
                &loot,
                &mut magic,
                &identity,
                &zones,
                event(&fighter),
            ),
            Ok(EmberEffectStatus::Cancelled)
        ));
        assert_eq!(magic.mana(hero), 85);
        assert_eq!(magic.resolved_ember_intents().count(), 1);
        let (_, restored) = load_joint(&checkpoint).unwrap();
        assert_eq!(restored.mana(hero), 85);
        assert_eq!(restored.pending_ember_intents().count(), 0);
        assert_eq!(
            restored.ember_intent(hero, 30).unwrap().status,
            EmberEffectStatus::Cancelled
        );
        let _ = fs::remove_file(&checkpoint);
    }

    #[test]
    fn idle_and_wrong_session_or_zone_never_write_a_checkpoint() {
        let (loot, mut magic, mut identity, mut zones, _hero, fighter) = fixture();
        let checkpoint = path();
        assert!(matches!(
            record_ember_combat_interruption(
                &checkpoint,
                &loot,
                &mut magic,
                &identity,
                &zones,
                event(&fighter),
            ),
            Err(CombatInterruptionError::NotInterrupted)
        ));
        let mut stunned = fighter.clone();
        stunned.action = Action::Stunned;
        assert_eq!(
            identity.release_session(SessionLease::new(1, 1).unwrap()),
            CharacterId::new(803)
        );
        assert!(matches!(
            record_ember_combat_interruption(
                &checkpoint,
                &loot,
                &mut magic,
                &identity,
                &zones,
                event(&stunned),
            ),
            Err(CombatInterruptionError::UnverifiedSession)
        ));
        identity
            .bind_verified(
                SessionLease::new(1, 2).unwrap(),
                CharacterId::new(803).unwrap(),
            )
            .unwrap();
        zones.unregister(1);
        assert!(matches!(
            record_ember_combat_interruption(
                &checkpoint,
                &loot,
                &mut magic,
                &identity,
                &zones,
                CombatInterruption {
                    lease: SessionLease::new(1, 2).unwrap(),
                    sequence: 30,
                    fighter: &stunned,
                },
            ),
            Err(CombatInterruptionError::WrongZone)
        ));
        assert!(!checkpoint.exists());
        assert_eq!(magic.pending_ember_intents().count(), 1);
    }

    #[test]
    fn failed_write_leaves_pending_intent_unresolved() {
        let (loot, mut magic, identity, zones, _hero, mut fighter) = fixture();
        fighter.action = Action::Knockdown;
        let checkpoint = path();
        let impossible = checkpoint.with_extension("missing").join("state");
        assert!(matches!(
            record_ember_combat_interruption(
                &impossible,
                &loot,
                &mut magic,
                &identity,
                &zones,
                event(&fighter),
            ),
            Err(CombatInterruptionError::Commit(
                JointCheckpointError::Checkpoint(crate::loot_persistence::CheckpointError::Io(_))
            ))
        ));
        assert_eq!(magic.pending_ember_intents().count(), 1);
        assert!(!checkpoint.exists());
    }
}
