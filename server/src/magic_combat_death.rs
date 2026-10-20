//! Experimental Combat-death to full-loot + Magic cancellation checkpoint.
//!
//! This does NOT apply damage or change World/Fighter state. Call ONLY from
//! a trusted Combat Death event in a serialized world tick, with an actual
//! dead Fighter and the server-issued exact SessionLease. The caller must
//! lock World, ZoneAuthority, SessionIdentityRegistry, LootAuthority and
//! MagicAuthority for the ENTIRE transaction.
//!
//! Combat health, damage and the tick state themselves are not persisted in
//! MYWLD003. Recovery after a post-rename I/O error is still indeterminate;
//! this is not a complete live or production-safe Combat death transaction.

use std::path::Path;

use crate::character_identity::{CharacterId, SessionIdentityRegistry, SessionLease};
use crate::loot::{LootAuthority, LootError};
use crate::loot_persistence::{atomic_write, CheckpointError};
use crate::magic::{EmberEffectStatus, MagicAuthority, MagicError};
use crate::magic_checkpoint::{bundle, JointCheckpointError};
use crate::simulation::{Action, CombatEvent, Fighter, World};
use crate::zone::ZoneAuthority;

#[derive(Debug)]
pub enum CombatDeathCheckpointError {
    UnverifiedSession,
    WrongDeathEvent,
    WrongFighter,
    NotDead,
    UnknownZone,
    WrongPosition,
    StaleWorldTick,
    MissingWorldFighter,
    MissingDeathEvent,
    DuplicateDeathEvent,
    InvalidWorldTime,
    Loot(LootError),
    Magic(MagicError),
    Checkpoint(JointCheckpointError),
    Io(CheckpointError),
}

/// All fields must come from the server-owned, locked world tick. In
/// particular, packets must NEVER create a CombatEvent or Fighter snapshot.
pub struct CombatDeathContext<'a> {
    pub lease: SessionLease,
    pub event: &'a CombatEvent,
    pub fighter: &'a Fighter,
    pub zones: &'a ZoneAuthority,
    pub now_ms: u64,
}

/// Proof that the physical full-loot death transfer and pending-spell
/// cancellation were checkpointed together. It is NOT a Combat damage
/// receipt, kill confirmation, or an authoritative persisted World state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CommittedDeathLoot {
    pub character: CharacterId,
    pub corpse_entity_id: u64,
    pub cancelled_ember_intents: usize,
}

/// Atomically checkpoint the dying victim's full-loot transfer and the
/// cancellation of all their still-pending Ember outbox entries. Learned
/// rune/spell knowledge and spent resources are never refunded or dropped.
///
/// On any pre-commit error the caller's in-memory loot and magic are unchanged.
/// A second Death event fails on the persisted dead/inventory state rather
/// than duplicating a corpse or scattering more items.
pub(crate) fn commit_combat_death_loot(
    path: &Path,
    loot: &mut LootAuthority,
    magic: &mut MagicAuthority,
    identity: &SessionIdentityRegistry,
    ctx: CombatDeathContext<'_>,
) -> Result<CommittedDeathLoot, CombatDeathCheckpointError> {
    let character = identity
        .resolve_session(ctx.lease)
        .ok_or(CombatDeathCheckpointError::UnverifiedSession)?;
    let actor = ctx.lease.server_session();
    match ctx.event {
        CombatEvent::Death { fighter, .. } if *fighter == actor => {}
        _ => return Err(CombatDeathCheckpointError::WrongDeathEvent),
    }
    if ctx.fighter.net_id != actor {
        return Err(CombatDeathCheckpointError::WrongFighter);
    }
    if ctx.fighter.action != Action::Dead || ctx.fighter.hp > 0.0 {
        return Err(CombatDeathCheckpointError::NotDead);
    }
    if !ctx.fighter.hp.is_finite() {
        return Err(CombatDeathCheckpointError::WrongPosition);
    }
    let zone = ctx
        .zones
        .zone_of(actor)
        .ok_or(CombatDeathCheckpointError::UnknownZone)?;
    let (width, height) = zone.bounds();
    if !ctx.fighter.x.is_finite()
        || !ctx.fighter.y.is_finite()
        || ctx.fighter.x < 18.0
        || ctx.fighter.y < 18.0
        || ctx.fighter.x > width - 18.0
        || ctx.fighter.y > height - 18.0
    {
        return Err(CombatDeathCheckpointError::WrongPosition);
    }

    let mut staged_loot = LootAuthority::restore_state(
        loot.export_state()
            .map_err(CombatDeathCheckpointError::Loot)?,
    )
    .map_err(CombatDeathCheckpointError::Loot)?;
    let mut staged_magic = magic.clone();
    let corpse_entity_id = staged_loot
        .death(actor, ctx.fighter, zone, ctx.now_ms)
        .map_err(CombatDeathCheckpointError::Loot)?;
    let pending: Vec<u64> = staged_magic
        .pending_ember_intents()
        .filter(|intent| intent.character == character)
        .map(|intent| intent.sequence)
        .collect();
    for sequence in &pending {
        staged_magic
            .resolve_ember_without_effect(character, *sequence, EmberEffectStatus::Cancelled)
            .map_err(CombatDeathCheckpointError::Magic)?;
    }
    let bytes = bundle(&staged_loot, identity, &staged_magic)
        .map_err(CombatDeathCheckpointError::Checkpoint)?;
    atomic_write(path, &bytes).map_err(CombatDeathCheckpointError::Io)?;
    *loot = staged_loot;
    *magic = staged_magic;
    Ok(CommittedDeathLoot {
        character,
        corpse_entity_id,
        cancelled_ember_intents: pending.len(),
    })
}

/// A narrow authoritative server-tick handoff. The caller provides the
/// World AND the CombatEvent batch obtained from that SAME completed step.
/// Neither the Fighter, timestamp nor the event victim is client-supplied.
/// This API cannot cryptographically attest to event-batch provenance: the
/// world caller must hold its single writer lock through the disk commit.
pub struct WorldDeathTick<'a> {
    pub lease: SessionLease,
    pub world: &'a World,
    pub completed_tick: u32,
    pub combat_events: &'a [CombatEvent],
    pub zones: &'a ZoneAuthority,
}

/// Fail closed on mismatched world ticks or duplicate/missing Death events,
/// and read the actual dying Fighter and time from the authoritative World.
///
/// The persisted joint checkpoint STILL DOES NOT store the World or its HP,
/// so crash recovery cannot yet reconstruct a complete Combat tick.
pub fn commit_world_death_loot(
    path: &Path,
    loot: &mut LootAuthority,
    magic: &mut MagicAuthority,
    identity: &SessionIdentityRegistry,
    tick: WorldDeathTick<'_>,
) -> Result<CommittedDeathLoot, CombatDeathCheckpointError> {
    if tick.world.tick != tick.completed_tick {
        return Err(CombatDeathCheckpointError::StaleWorldTick);
    }
    let victim = tick.lease.server_session();
    let mut events = tick
        .combat_events
        .iter()
        .filter(|event| matches!(event, CombatEvent::Death { fighter, .. } if *fighter == victim));
    let event = events
        .next()
        .ok_or(CombatDeathCheckpointError::MissingDeathEvent)?;
    if events.next().is_some() {
        return Err(CombatDeathCheckpointError::DuplicateDeathEvent);
    }
    let fighter = tick
        .world
        .fighter(victim)
        .ok_or(CombatDeathCheckpointError::MissingWorldFighter)?;
    // An out-of-range f32 otherwise saturates when cast to u64 and can
    // produce effectively immortal corpse/ground expiry timestamps.
    if !tick.world.now_ms.is_finite()
        || tick.world.now_ms < 0.0
        || tick.world.now_ms >= u64::MAX as f32
    {
        return Err(CombatDeathCheckpointError::InvalidWorldTime);
    }
    commit_combat_death_loot(
        path,
        loot,
        magic,
        identity,
        CombatDeathContext {
            lease: tick.lease,
            event,
            fighter,
            zones: tick.zones,
            now_ms: tick.world.now_ms as u64,
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character_identity::CharacterId;
    use crate::loot::{EquipmentSlot, ItemKind};
    use crate::magic::{Lesson, LessonAward, LessonSource, Rune, Spell};
    use crate::magic_checkpoint::load_joint;
    use crate::simulation::World;
    use crate::zone::{ZoneAuthority, ZoneId};
    use std::fs;
    use std::num::NonZeroU64;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_SEQUENCE: AtomicU64 = AtomicU64::new(1);

    fn path() -> std::path::PathBuf {
        let number = TEST_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!(
            "myaso-ember-death-{}-{number}.bin",
            std::process::id()
        ))
    }

    struct Fixture {
        loot: LootAuthority,
        magic: MagicAuthority,
        identity: SessionIdentityRegistry,
        zones: ZoneAuthority,
        character: CharacterId,
        victim: Fighter,
    }

    impl Fixture {
        fn new() -> Self {
            let mut loot = LootAuthority::new();
            let mut magic = MagicAuthority::new();
            let mut identity = SessionIdentityRegistry::new();
            let mut zones = ZoneAuthority::new();
            let character = CharacterId::new(830).unwrap();
            identity
                .bind_verified(SessionLease::new(1, 1).unwrap(), character)
                .unwrap();
            zones.register(1).unwrap();
            loot.register(1).unwrap();
            loot.record_operation(character, 22).unwrap();
            let book = loot.grant(1, ItemKind::Spellbook, 1).unwrap();
            loot.equip(1, book, EquipmentSlot::OffHand).unwrap();
            for (receipt, lesson) in [
                (1, Lesson::Rune(Rune::Fire)),
                (2, Lesson::Spell(Spell::Ember)),
            ] {
                magic
                    .grant_lesson(LessonAward {
                        receipt: NonZeroU64::new(receipt).unwrap(),
                        character,
                        source: LessonSource::NpcTeacher,
                        lesson,
                    })
                    .unwrap();
            }
            for sequence in [21, 22] {
                magic
                    .stage_ember_intent(character, sequence, ZoneId::Moonvale, 200.0, 200.0, 0.0)
                    .unwrap();
            }
            let mut world = World::new(800.0, 600.0);
            world.add_player_at(1, 200.0, 200.0, 0.0);
            let mut victim = world.fighter(1).unwrap().clone();
            victim.action = Action::Dead;
            victim.hp = 0.0;
            Self {
                loot,
                magic,
                identity,
                zones,
                character,
                victim,
            }
        }

        fn death_event() -> CombatEvent {
            CombatEvent::Death {
                fighter: 1,
                killer: 2,
            }
        }
    }

    #[test]
    fn world_tick_adapter_rejects_stale_and_missing_or_duplicate_death_events() {
        let mut state = Fixture::new();
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        let death = Fixture::death_event();
        let events = [death.clone(), death];
        let checkpoint = path();
        let lease = SessionLease::new(1, 1).unwrap();
        assert!(matches!(
            commit_world_death_loot(
                &checkpoint,
                &mut state.loot,
                &mut state.magic,
                &state.identity,
                WorldDeathTick {
                    lease,
                    world: &world,
                    completed_tick: 1,
                    combat_events: &events,
                    zones: &state.zones,
                },
            ),
            Err(CombatDeathCheckpointError::StaleWorldTick)
        ));
        assert!(matches!(
            commit_world_death_loot(
                &checkpoint,
                &mut state.loot,
                &mut state.magic,
                &state.identity,
                WorldDeathTick {
                    lease,
                    world: &world,
                    completed_tick: world.tick,
                    combat_events: &[],
                    zones: &state.zones,
                },
            ),
            Err(CombatDeathCheckpointError::MissingDeathEvent)
        ));
        assert!(matches!(
            commit_world_death_loot(
                &checkpoint,
                &mut state.loot,
                &mut state.magic,
                &state.identity,
                WorldDeathTick {
                    lease,
                    world: &world,
                    completed_tick: world.tick,
                    combat_events: &events,
                    zones: &state.zones,
                },
            ),
            Err(CombatDeathCheckpointError::DuplicateDeathEvent)
        ));
        assert_eq!(state.loot.corpses().len(), 0);
        assert_eq!(state.magic.pending_ember_intents().count(), 2);
        assert!(!checkpoint.exists());
    }

    #[test]
    fn world_tick_adapter_rejects_overflowing_world_time_before_loot_changes() {
        let mut state = Fixture::new();
        let checkpoint = path();
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        let death = [Fixture::death_event()];
        let lease = SessionLease::new(1, 1).unwrap();
        for invalid_time in [u64::MAX as f32, f32::MAX] {
            world.now_ms = invalid_time;
            assert!(matches!(
                commit_world_death_loot(
                    &checkpoint,
                    &mut state.loot,
                    &mut state.magic,
                    &state.identity,
                    WorldDeathTick {
                        lease,
                        world: &world,
                        completed_tick: world.tick,
                        combat_events: &death,
                        zones: &state.zones,
                    },
                ),
                Err(CombatDeathCheckpointError::InvalidWorldTime)
            ));
        }
        world.now_ms = 1_000.0;
        assert!(matches!(
            commit_world_death_loot(
                &checkpoint,
                &mut state.loot,
                &mut state.magic,
                &state.identity,
                WorldDeathTick {
                    lease,
                    world: &world,
                    completed_tick: world.tick,
                    combat_events: &death,
                    zones: &state.zones,
                },
            ),
            Err(CombatDeathCheckpointError::NotDead)
        ));
        assert!(state.loot.corpses().is_empty());
        assert_eq!(state.magic.pending_ember_intents().count(), 2);
        assert!(!checkpoint.exists());
    }

    #[test]
    fn world_tick_adapter_rejects_unmatched_live_fighter_and_absent_victim() {
        let mut state = Fixture::new();
        let checkpoint = path();
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        let death = [Fixture::death_event()];
        let lease = SessionLease::new(1, 1).unwrap();
        assert!(matches!(
            commit_world_death_loot(
                &checkpoint,
                &mut state.loot,
                &mut state.magic,
                &state.identity,
                WorldDeathTick {
                    lease,
                    world: &world,
                    completed_tick: world.tick,
                    combat_events: &death,
                    zones: &state.zones,
                },
            ),
            Err(CombatDeathCheckpointError::NotDead)
        ));
        world.remove_player(1);
        assert!(matches!(
            commit_world_death_loot(
                &checkpoint,
                &mut state.loot,
                &mut state.magic,
                &state.identity,
                WorldDeathTick {
                    lease,
                    world: &world,
                    completed_tick: world.tick,
                    combat_events: &death,
                    zones: &state.zones,
                },
            ),
            Err(CombatDeathCheckpointError::MissingWorldFighter)
        ));
        assert!(state.loot.corpses().is_empty());
        assert_eq!(state.magic.pending_ember_intents().count(), 2);
        assert!(!checkpoint.exists());
    }

    #[test]
    fn death_moves_physical_spellbook_to_corpse_and_cancels_pending_magic() {
        let mut state = Fixture::new();
        let path = path();
        let equipped_id = state
            .loot
            .inventory(1)
            .unwrap()
            .equipped(EquipmentSlot::OffHand)
            .unwrap()
            .id;
        let death = Fixture::death_event();
        let receipt = commit_combat_death_loot(
            &path,
            &mut state.loot,
            &mut state.magic,
            &state.identity,
            CombatDeathContext {
                lease: SessionLease::new(1, 1).unwrap(),
                event: &death,
                fighter: &state.victim,
                zones: &state.zones,
                now_ms: 1_000,
            },
        )
        .unwrap();
        assert_eq!(receipt.character, state.character);
        assert_eq!(receipt.cancelled_ember_intents, 2);
        assert_eq!(state.magic.pending_ember_intents().count(), 0);
        assert_eq!(state.magic.resolved_ember_intents().count(), 2);
        assert!(state.loot.inventory(1).unwrap().backpack().is_empty());
        assert!(state.loot.is_dead(1));
        let (persisted_loot, persisted_magic) = load_joint(&path).unwrap();
        assert_eq!(
            persisted_loot.corpses()[&receipt.corpse_entity_id].items[0].id,
            equipped_id
        );
        assert_eq!(persisted_magic.pending_ember_intents().count(), 0);
        assert_eq!(persisted_magic.resolved_ember_intents().count(), 2);
        assert!(persisted_magic.knows_spell(state.character, Spell::Ember));
        assert_eq!(
            persisted_loot.committed_operation_sequence(state.character),
            Some(22)
        );
        let repeat = commit_combat_death_loot(
            &path,
            &mut state.loot,
            &mut state.magic,
            &state.identity,
            CombatDeathContext {
                lease: SessionLease::new(1, 1).unwrap(),
                event: &death,
                fighter: &state.victim,
                zones: &state.zones,
                now_ms: 1_000,
            },
        );
        assert!(matches!(
            repeat,
            Err(CombatDeathCheckpointError::Loot(LootError::AlreadyDead))
        ));
        assert_eq!(state.loot.corpses().len(), 1);
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn wrong_session_death_event_or_alive_fighter_never_drops_items() {
        let mut state = Fixture::new();
        let path = path();
        let death = Fixture::death_event();
        assert!(matches!(
            commit_combat_death_loot(
                &path,
                &mut state.loot,
                &mut state.magic,
                &state.identity,
                CombatDeathContext {
                    lease: SessionLease::new(1, 2).unwrap(),
                    event: &death,
                    fighter: &state.victim,
                    zones: &state.zones,
                    now_ms: 1_000,
                },
            ),
            Err(CombatDeathCheckpointError::UnverifiedSession)
        ));
        let wrong = CombatEvent::Respawn { fighter: 1 };
        assert!(matches!(
            commit_combat_death_loot(
                &path,
                &mut state.loot,
                &mut state.magic,
                &state.identity,
                CombatDeathContext {
                    lease: SessionLease::new(1, 1).unwrap(),
                    event: &wrong,
                    fighter: &state.victim,
                    zones: &state.zones,
                    now_ms: 1_000,
                },
            ),
            Err(CombatDeathCheckpointError::WrongDeathEvent)
        ));
        let mut alive = state.victim.clone();
        alive.action = Action::Idle;
        alive.hp = 100.0;
        assert!(matches!(
            commit_combat_death_loot(
                &path,
                &mut state.loot,
                &mut state.magic,
                &state.identity,
                CombatDeathContext {
                    lease: SessionLease::new(1, 1).unwrap(),
                    event: &death,
                    fighter: &alive,
                    zones: &state.zones,
                    now_ms: 1_000,
                },
            ),
            Err(CombatDeathCheckpointError::NotDead)
        ));
        assert!(!path.exists());
        assert_eq!(state.loot.corpses().len(), 0);
        assert_eq!(state.magic.pending_ember_intents().count(), 2);
    }

    #[test]
    fn failed_checkpoint_does_not_publish_corpse_or_cancel_magic() {
        let mut state = Fixture::new();
        let path = path();
        let impossible = path.with_extension("missing").join("state.bin");
        let death = Fixture::death_event();
        assert!(matches!(
            commit_combat_death_loot(
                &impossible,
                &mut state.loot,
                &mut state.magic,
                &state.identity,
                CombatDeathContext {
                    lease: SessionLease::new(1, 1).unwrap(),
                    event: &death,
                    fighter: &state.victim,
                    zones: &state.zones,
                    now_ms: 1_000,
                },
            ),
            Err(CombatDeathCheckpointError::Io(CheckpointError::Io(_)))
        ));
        assert!(!state.loot.is_dead(1));
        assert!(state.loot.corpses().is_empty());
        assert!(state
            .loot
            .inventory(1)
            .unwrap()
            .equipped(EquipmentSlot::OffHand)
            .is_some());
        assert_eq!(state.magic.pending_ember_intents().count(), 2);
        assert!(!path.exists());
    }
}
