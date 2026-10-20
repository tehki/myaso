//! Deterministic, read-only Ember combat handoff proposal.
//!
//! This DOES NOT apply damage, collision, interrupts, deaths or loot drops.
//! Gameplay projectile motion, obstruction tests, range, target filters and
//! combat balance remain owned by Combat. This isolated targeting prototype
//! must be replaced/reviewed before any live magic effect is enabled.
//!
//! Caller must source the World, ZoneAuthority, identity and loot authority
//! from one trusted, serialized simulation tick. No client-supplied fighter
//! state, positions or target IDs are accepted as authoritative.
use crate::character_identity::{CharacterId, SessionIdentityRegistry, SessionLease};
use crate::loot::LootAuthority;
use crate::magic::{EmberEffectStatus, MagicAuthority};
use crate::simulation::{Action, World};
use crate::zone::{ZoneAuthority, ZoneId};

/// Provisional deterministic geometry, not final gameplay balance.
pub const EMBER_PREVIEW_MAX_RANGE: f32 = 260.0;
pub const EMBER_PREVIEW_CORRIDOR_RADIUS: f32 = 28.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmberPreviewError {
    UnverifiedSession,
    MissingCaster,
    WrongCaster,
    MissingIntent,
    NotPending,
    UncommittedIntent,
    CasterDead,
    WrongZone,
    InvalidCaster,
    StaleWorldTick,
    InvalidWorldTime,
    ChangedTarget,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EmberTargetProposal {
    pub character: CharacterId,
    pub sequence: u64,
    pub zone: ZoneId,
    pub target_net_id: u32,
    pub target_character: CharacterId,
    pub target_lease: SessionLease,
    pub world_tick: u32,
    pub distance_along_ray: f32,
}

/// Exactly one authoritative session and world view per preview.
pub struct EmberCombatContext<'a> {
    pub lease: SessionLease,
    pub sequence: u64,
    pub identity: &'a SessionIdentityRegistry,
    pub loot: &'a LootAuthority,
    pub magic: &'a MagicAuthority,
    pub zones: &'a ZoneAuthority,
    pub world: &'a World,
}

/// Resolve ONE potential target by deterministic ray/corridor projection.
/// No collision with terrain, PvP permissions or defenses are modeled.
/// Ordering: nearest forward distance, then lowest stable character ID.
/// Only targets with a verified active lease and registered live inventory
/// qualify. A target lease is a server-side binding, not a client capability.
/// Returns None when no valid target intersects the temporary corridor.
///
/// A preview is NOT an effect-resolution receipt; any later Combat application
/// needs a fresh server-side snapshot and one transactional effect+world commit.
pub fn preview_ember_target(
    ctx: EmberCombatContext<'_>,
) -> Result<Option<EmberTargetProposal>, EmberPreviewError> {
    let character = ctx
        .identity
        .resolve_session(ctx.lease)
        .ok_or(EmberPreviewError::UnverifiedSession)?;
    let caster_id = ctx.lease.server_session();
    let caster = ctx
        .world
        .fighter(caster_id)
        .ok_or(EmberPreviewError::MissingCaster)?;
    if caster.net_id != caster_id {
        return Err(EmberPreviewError::WrongCaster);
    }
    if caster.action == Action::Dead || caster.hp <= 0.0 || ctx.loot.is_dead(caster_id) {
        return Err(EmberPreviewError::CasterDead);
    }
    if !caster.x.is_finite() || !caster.y.is_finite() || !caster.facing.is_finite() {
        return Err(EmberPreviewError::InvalidCaster);
    }
    let intent = ctx
        .magic
        .ember_intent(character, ctx.sequence)
        .ok_or(EmberPreviewError::MissingIntent)?;
    if intent.status != EmberEffectStatus::Pending {
        return Err(EmberPreviewError::NotPending);
    }
    if ctx
        .loot
        .committed_operation_sequence(character)
        .is_none_or(|sequence| sequence < ctx.sequence)
    {
        return Err(EmberPreviewError::UncommittedIntent);
    }
    if ctx.zones.zone_of(caster_id) != Some(intent.zone) {
        return Err(EmberPreviewError::WrongZone);
    }

    let direction_x = intent.facing().cos();
    let direction_y = intent.facing().sin();
    let origin_x = intent.origin_x();
    let origin_y = intent.origin_y();
    let mut best: Option<(u32, CharacterId, SessionLease, f32)> = None;
    for target in ctx.world.fighters() {
        if target.net_id == caster_id
            || target.action == Action::Dead
            || target.hp <= 0.0
            || !target.x.is_finite()
            || !target.y.is_finite()
            || ctx.zones.zone_of(target.net_id) != Some(intent.zone)
        {
            continue;
        }
        let Some((target_lease, target_character)) = ctx.identity.verified_fighter(target.net_id)
        else {
            continue;
        };
        if ctx.loot.inventory(target.net_id).is_none() || ctx.loot.is_dead(target.net_id) {
            continue;
        }
        let dx = target.x - origin_x;
        let dy = target.y - origin_y;
        let forward = dx * direction_x + dy * direction_y;
        let lateral = (dy * direction_x - dx * direction_y).abs();
        if !forward.is_finite()
            || !lateral.is_finite()
            || forward <= 0.0
            || forward > EMBER_PREVIEW_MAX_RANGE
            || lateral > EMBER_PREVIEW_CORRIDOR_RADIUS
        {
            continue;
        }
        if best.is_none_or(|(_, selected_character, _, distance)| {
            forward < distance || (forward == distance && target_character < selected_character)
        }) {
            best = Some((target.net_id, target_character, target_lease, forward));
        }
    }
    Ok(best.map(
        |(target_net_id, target_character, target_lease, distance_along_ray)| EmberTargetProposal {
            character,
            sequence: ctx.sequence,
            zone: intent.zone,
            target_net_id,
            target_character,
            target_lease,
            world_tick: ctx.world.tick,
            distance_along_ray,
        },
    ))
}

/// Revalidate a provisional handoff using the exact, current authoritative
/// World tick. A fighter ID may be reused after reconnect, so the target's
/// verified CharacterId AND SessionLease must still match. No effect executes.
/// Combat must hold its single-writer world lock through revalidation and the
/// eventual *durable* resolution transaction; this API alone grants no hit.
pub fn revalidate_ember_target(
    ctx: EmberCombatContext<'_>,
    proposal: EmberTargetProposal,
) -> Result<(), EmberPreviewError> {
    if ctx.world.tick != proposal.world_tick {
        return Err(EmberPreviewError::StaleWorldTick);
    }
    if preview_ember_target(ctx)? != Some(proposal) {
        return Err(EmberPreviewError::ChangedTarget);
    }
    Ok(())
}

/// Read-only authoritative World-tick boundary for a future Combat adapter.
/// Core MUST hold a single writer lock on World, identity, zones, loot and
/// magic throughout admission, preview/revalidation, and any later Combat
/// transaction. This function cannot itself verify caller lock provenance.
/// The tick number is from the *server* tick loop, never a client message.
///
/// The result is a candidate only; it does not establish terrain visibility,
/// projectile collision, PvP permissions, damage, or a durable hit receipt.
pub fn preview_ember_target_for_completed_tick(
    ctx: EmberCombatContext<'_>,
    completed_tick: u32,
) -> Result<Option<EmberTargetProposal>, EmberPreviewError> {
    validate_completed_tick(ctx.world, completed_tick)?;
    preview_ember_target(ctx)
}

/// Check that the target binding, selection, and complete World tick are
/// unchanged before Combat considers an effect. No state is ever mutated.
/// Combat owns all further authoritative hit and defense validation.
pub fn revalidate_ember_target_for_completed_tick(
    ctx: EmberCombatContext<'_>,
    completed_tick: u32,
    proposal: EmberTargetProposal,
) -> Result<(), EmberPreviewError> {
    validate_completed_tick(ctx.world, completed_tick)?;
    revalidate_ember_target(ctx, proposal)
}

fn validate_completed_tick(world: &World, completed_tick: u32) -> Result<(), EmberPreviewError> {
    if completed_tick == 0 || world.tick != completed_tick {
        return Err(EmberPreviewError::StaleWorldTick);
    }
    if !world.now_ms.is_finite() || world.now_ms < 0.0 || world.now_ms >= u64::MAX as f32 {
        return Err(EmberPreviewError::InvalidWorldTime);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character_identity::CharacterId;
    use crate::magic::{Lesson, LessonAward, LessonSource, Rune, Spell};
    use std::num::NonZeroU64;

    fn lease(session: u32, epoch: u64) -> SessionLease {
        SessionLease::new(session, epoch).unwrap()
    }

    struct Fixture {
        world: World,
        identity: SessionIdentityRegistry,
        loot: LootAuthority,
        magic: MagicAuthority,
        zones: ZoneAuthority,
        character: CharacterId,
    }

    impl Fixture {
        fn new() -> Self {
            let mut world = World::new(800.0, 600.0);
            world.add_player_at(1, 200.0, 200.0, 0.0);
            world.add_player_at(2, 325.0, 200.0, 0.0);
            world.add_player_at(3, 290.0, 200.0, 0.0);
            let character = CharacterId::new(700).unwrap();
            let mut identity = SessionIdentityRegistry::new();
            identity.bind_verified(lease(1, 1), character).unwrap();
            identity
                .bind_verified(lease(2, 1), CharacterId::new(702).unwrap())
                .unwrap();
            identity
                .bind_verified(lease(3, 1), CharacterId::new(703).unwrap())
                .unwrap();
            let mut zones = ZoneAuthority::new();
            for id in [1, 2, 3] {
                zones.register(id).unwrap();
            }
            let mut loot = LootAuthority::new();
            for id in [1, 2, 3] {
                loot.register(id).unwrap();
            }
            loot.record_operation(character, 10).unwrap();
            let mut magic = MagicAuthority::new();
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
            magic
                .stage_ember_intent(character, 10, ZoneId::Moonvale, 200.0, 200.0, 0.0)
                .unwrap();
            Self {
                world,
                identity,
                loot,
                magic,
                zones,
                character,
            }
        }

        fn preview(
            &self,
            session: SessionLease,
            sequence: u64,
        ) -> Result<Option<EmberTargetProposal>, EmberPreviewError> {
            preview_ember_target(EmberCombatContext {
                lease: session,
                sequence,
                identity: &self.identity,
                loot: &self.loot,
                magic: &self.magic,
                zones: &self.zones,
                world: &self.world,
            })
        }
    }

    #[test]
    fn completed_tick_handoff_is_read_only_and_revalidates_real_world_target() {
        let mut fixture = Fixture::new();
        fixture.world.step();
        let hp_before = fixture.world.fighter(3).unwrap().hp;
        let mana_before = fixture.magic.mana(fixture.character);
        let pending_before = fixture.magic.pending_ember_intents().count();
        let context = || EmberCombatContext {
            lease: lease(1, 1),
            sequence: 10,
            identity: &fixture.identity,
            loot: &fixture.loot,
            magic: &fixture.magic,
            zones: &fixture.zones,
            world: &fixture.world,
        };
        let proposal =
            preview_ember_target_for_completed_tick(context(), fixture.world.tick)
                .unwrap()
                .unwrap();
        assert_eq!(proposal.world_tick, fixture.world.tick);
        assert_eq!(proposal.target_net_id, 3);
        assert_eq!(
            revalidate_ember_target_for_completed_tick(
                context(),
                fixture.world.tick,
                proposal,
            ),
            Ok(())
        );
        assert_eq!(fixture.world.fighter(3).unwrap().hp, hp_before);
        assert_eq!(fixture.magic.mana(fixture.character), mana_before);
        assert_eq!(fixture.magic.pending_ember_intents().count(), pending_before);
        assert_eq!(
            fixture.loot.committed_operation_sequence(fixture.character),
            Some(10)
        );
    }

    #[test]
    fn completed_tick_handoff_rejects_zero_stale_and_invalid_world_time() {
        let mut fixture = Fixture::new();
        fixture.world.step();
        for completed_tick in [0, fixture.world.tick + 1] {
            assert_eq!(
                preview_ember_target_for_completed_tick(
                    EmberCombatContext {
                        lease: lease(1, 1),
                        sequence: 10,
                        identity: &fixture.identity,
                        loot: &fixture.loot,
                        magic: &fixture.magic,
                        zones: &fixture.zones,
                        world: &fixture.world,
                    },
                    completed_tick,
                ),
                Err(EmberPreviewError::StaleWorldTick)
            );
        }
        for invalid_time in [f32::NAN, f32::INFINITY, -1.0, f32::MAX] {
            let mut invalid_world = fixture.world.clone();
            invalid_world.now_ms = invalid_time;
            assert_eq!(
                preview_ember_target_for_completed_tick(
                    EmberCombatContext {
                        lease: lease(1, 1),
                        sequence: 10,
                        identity: &fixture.identity,
                        loot: &fixture.loot,
                        magic: &fixture.magic,
                        zones: &fixture.zones,
                        world: &invalid_world,
                    },
                    invalid_world.tick,
                ),
                Err(EmberPreviewError::InvalidWorldTime)
            );
        }
        let current = preview_ember_target_for_completed_tick(
            EmberCombatContext {
                lease: lease(1, 1),
                sequence: 10,
                identity: &fixture.identity,
                loot: &fixture.loot,
                magic: &fixture.magic,
                zones: &fixture.zones,
                world: &fixture.world,
            },
            fixture.world.tick,
        )
        .unwrap()
        .unwrap();
        fixture.world.step();
        assert_eq!(
            revalidate_ember_target_for_completed_tick(
                EmberCombatContext {
                    lease: lease(1, 1),
                    sequence: 10,
                    identity: &fixture.identity,
                    loot: &fixture.loot,
                    magic: &fixture.magic,
                    zones: &fixture.zones,
                    world: &fixture.world,
                },
                fixture.world.tick,
                current,
            ),
            Err(EmberPreviewError::StaleWorldTick)
        );
        assert_eq!(fixture.magic.pending_ember_intents().count(), 1);
    }

    #[test]
    fn completed_tick_revalidation_denies_reused_target_session_without_damage() {
        let mut fixture = Fixture::new();
        fixture.world.step();
        let old = preview_ember_target_for_completed_tick(
            EmberCombatContext {
                lease: lease(1, 1),
                sequence: 10,
                identity: &fixture.identity,
                loot: &fixture.loot,
                magic: &fixture.magic,
                zones: &fixture.zones,
                world: &fixture.world,
            },
            fixture.world.tick,
        )
        .unwrap()
        .unwrap();
        fixture.identity.release_session(lease(3, 1)).unwrap();
        fixture
            .identity
            .bind_verified(lease(3, 2), CharacterId::new(730).unwrap())
            .unwrap();
        assert_eq!(
            revalidate_ember_target_for_completed_tick(
                EmberCombatContext {
                    lease: lease(1, 1),
                    sequence: 10,
                    identity: &fixture.identity,
                    loot: &fixture.loot,
                    magic: &fixture.magic,
                    zones: &fixture.zones,
                    world: &fixture.world,
                },
                fixture.world.tick,
                old,
            ),
            Err(EmberPreviewError::ChangedTarget)
        );
        assert_eq!(fixture.world.fighter(3).unwrap().hp, 100.0);
        assert_eq!(fixture.magic.pending_ember_intents().count(), 1);
    }

    #[test]
    fn closest_valid_forward_target_is_deterministic_without_dealing_damage() {
        let fixture = Fixture::new();
        let proposal = fixture.preview(lease(1, 1), 10).unwrap().unwrap();
        assert_eq!(proposal.character, fixture.character);
        assert_eq!(proposal.target_net_id, 3);
        assert_eq!(proposal.target_character, CharacterId::new(703).unwrap());
        assert_eq!(proposal.target_lease, lease(3, 1));
        assert_eq!(proposal.world_tick, fixture.world.tick);
        assert_eq!(proposal.distance_along_ray, 90.0);
        assert_eq!(
            revalidate_ember_target(
                EmberCombatContext {
                    lease: lease(1, 1),
                    sequence: 10,
                    identity: &fixture.identity,
                    loot: &fixture.loot,
                    magic: &fixture.magic,
                    zones: &fixture.zones,
                    world: &fixture.world,
                },
                proposal,
            ),
            Ok(())
        );
        assert_eq!(fixture.world.fighter(3).unwrap().hp, 100.0);
        assert_eq!(fixture.magic.pending_ember_intents().count(), 1);
        assert_eq!(
            fixture.loot.committed_operation_sequence(fixture.character),
            Some(10)
        );
    }

    #[test]
    fn old_lease_and_uncommitted_or_terminal_intents_cannot_select_targets() {
        let mut fixture = Fixture::new();
        assert_eq!(
            fixture.preview(lease(1, 2), 10),
            Err(EmberPreviewError::UnverifiedSession)
        );
        assert_eq!(
            fixture.preview(lease(1, 1), 11),
            Err(EmberPreviewError::MissingIntent)
        );
        fixture
            .magic
            .resolve_ember_without_effect(fixture.character, 10, EmberEffectStatus::Cancelled)
            .unwrap();
        assert_eq!(
            fixture.preview(lease(1, 1), 10),
            Err(EmberPreviewError::NotPending)
        );
    }

    #[test]
    fn rejects_uncommitted_effect_and_cross_zone_or_absent_caster() {
        let mut fixture = Fixture::new();
        fixture
            .loot
            .record_operation(fixture.character, 11)
            .unwrap();
        fixture
            .magic
            .stage_ember_intent(fixture.character, 12, ZoneId::Moonvale, 200.0, 200.0, 0.0)
            .unwrap();
        assert_eq!(
            fixture.preview(lease(1, 1), 12),
            Err(EmberPreviewError::UncommittedIntent)
        );

        fixture.zones.unregister(1);
        assert_eq!(
            fixture.preview(lease(1, 1), 10),
            Err(EmberPreviewError::WrongZone)
        );
        fixture.world.remove_player(1);
        assert_eq!(
            fixture.preview(lease(1, 1), 10),
            Err(EmberPreviewError::MissingCaster)
        );
    }

    #[test]
    fn unverified_nearby_target_is_skipped_even_with_valid_world_geometry() {
        let mut fixture = Fixture::new();
        assert_eq!(
            fixture.identity.release_session(lease(3, 1)),
            Some(CharacterId::new(703).unwrap())
        );
        let proposed = fixture.preview(lease(1, 1), 10).unwrap().unwrap();
        assert_eq!(proposed.target_net_id, 2);
        assert_eq!(proposed.target_character, CharacterId::new(702).unwrap());
    }

    #[test]
    fn old_target_proposal_is_rejected_when_session_id_is_reused() {
        let mut fixture = Fixture::new();
        let old = fixture.preview(lease(1, 1), 10).unwrap().unwrap();
        fixture.identity.release_session(lease(3, 1)).unwrap();
        fixture
            .identity
            .bind_verified(lease(3, 2), CharacterId::new(730).unwrap())
            .unwrap();
        let changed = fixture.preview(lease(1, 1), 10).unwrap().unwrap();
        assert_eq!(changed.target_net_id, old.target_net_id);
        assert_eq!(changed.target_lease, lease(3, 2));
        assert_eq!(changed.target_character, CharacterId::new(730).unwrap());
        assert_eq!(
            revalidate_ember_target(
                EmberCombatContext {
                    lease: lease(1, 1),
                    sequence: 10,
                    identity: &fixture.identity,
                    loot: &fixture.loot,
                    magic: &fixture.magic,
                    zones: &fixture.zones,
                    world: &fixture.world,
                },
                old,
            ),
            Err(EmberPreviewError::ChangedTarget)
        );
        assert_eq!(fixture.world.fighter(3).unwrap().hp, 100.0);
    }

    #[test]
    fn stale_world_tick_and_modified_target_proposals_fail_closed() {
        let mut fixture = Fixture::new();
        let proposal = fixture.preview(lease(1, 1), 10).unwrap().unwrap();
        let mut forged = proposal;
        forged.target_character = CharacterId::new(999).unwrap();
        assert_eq!(
            revalidate_ember_target(
                EmberCombatContext {
                    lease: lease(1, 1),
                    sequence: 10,
                    identity: &fixture.identity,
                    loot: &fixture.loot,
                    magic: &fixture.magic,
                    zones: &fixture.zones,
                    world: &fixture.world,
                },
                forged,
            ),
            Err(EmberPreviewError::ChangedTarget)
        );
        fixture.world.tick += 1;
        assert_eq!(
            revalidate_ember_target(
                EmberCombatContext {
                    lease: lease(1, 1),
                    sequence: 10,
                    identity: &fixture.identity,
                    loot: &fixture.loot,
                    magic: &fixture.magic,
                    zones: &fixture.zones,
                    world: &fixture.world,
                },
                proposal,
            ),
            Err(EmberPreviewError::StaleWorldTick)
        );
    }

    #[test]
    fn off_axis_and_out_of_range_targets_are_not_inferred_as_hits() {
        let mut fixture = Fixture::new();
        fixture.world.remove_player(2);
        fixture.world.remove_player(3);
        fixture.world.add_player_at(2, 300.0, 300.0, 0.0);
        fixture.world.add_player_at(3, 500.0, 200.0, 0.0);
        assert_eq!(fixture.preview(lease(1, 1), 10), Ok(None));
    }

    #[test]
    fn dead_or_unregistered_targets_are_not_selected() {
        let mut fixture = Fixture::new();
        fixture.zones.unregister(3);
        let proposal = fixture.preview(lease(1, 1), 10).unwrap().unwrap();
        assert_eq!(proposal.target_net_id, 2);
        fixture.world.remove_player(2);
        assert_eq!(fixture.preview(lease(1, 1), 10), Ok(None));
    }
}
