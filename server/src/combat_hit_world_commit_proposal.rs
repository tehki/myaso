//! NONRELEASE Core8C review adapter: take M147 HIT provenance from the
//! ORIGINAL World::step_into, never from client data or a retrospective HP diff.
//!
//! This adapter is deliberately NOT called from main.rs. Its admission map
//! must be populated ONLY by a future server-authenticated QUIC/actor/lease
//! owner under the same authoritative GameState lock. Here tests inject the
//! admissions; this is NOT a live session-authentication or HIT delivery path.
//! No proposed 5/6 packet types are registered.
use std::collections::BTreeMap;

use crate::combat_hit_delivery_proposal::{ActorIncarnation, CommittedHitIdentity};
use crate::simulation::{Action, CombatEvent, World};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OriginError {
    InvalidBootOrWorld,
    WrongWorldInstance,
    InvalidAdmittedLease,
    AlreadyAdmitted(u32),
    DuplicateLease,
    MissingActor(u32),
    DeadActor(u32),
    UnadmittedActor(u32),
    StaleActor(u32),
    NoCompletedWorldTick,
    WrongCommittedTick,
    // The only extra World stepping operation is a test-only fixture.
    #[cfg(test)]
    TickExhausted,
    OrdinalExhausted,
}

pub struct ProposedWorldHitOrigin {
    boot: u128,
    world_generation: u64,
    // This is a review-only representation of server-accepted authenticated
    // sessions, NOT evidence that any remote principal was authenticated.
    accepted: BTreeMap<u32, ActorIncarnation>,
}

impl std::fmt::Debug for ProposedWorldHitOrigin {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ProposedWorldHitOrigin")
            .field("boot_and_bindings", &"[REDACTED]")
            .field("admitted_count", &self.accepted.len())
            .finish()
    }
}

// Test-only structure: no second production World stepping interface.
#[cfg(test)]
#[derive(Debug)]
pub struct OriginalWorldTick {
    pub tick: u32,
    pub events: Vec<CombatEvent>,
    pub committed_hits: Vec<(CombatEvent, CommittedHitIdentity)>,
}

impl ProposedWorldHitOrigin {
    pub fn new(world: &World, server_boot_nonce: u128) -> Result<Self, OriginError> {
        if server_boot_nonce == 0 || world.world_instance() == 0 {
            return Err(OriginError::InvalidBootOrWorld);
        }
        Ok(Self {
            boot: server_boot_nonce,
            world_generation: world.world_instance(),
            accepted: BTreeMap::new(),
        })
    }

    fn ensure_world(&self, world: &World) -> Result<(), OriginError> {
        if self.world_generation != world.world_instance() {
            return Err(OriginError::WrongWorldInstance);
        }
        Ok(())
    }

    /// Called only *after* a future real QUIC session's actor ID and lease
    /// epoch are established by trusted server allocation under World lock.
    pub fn bind_admitted(
        &mut self,
        world: &World,
        net_id: u32,
        lease_epoch: u64,
    ) -> Result<ActorIncarnation, OriginError> {
        self.ensure_world(world)?;
        if lease_epoch == 0 || net_id == 0 {
            return Err(OriginError::InvalidAdmittedLease);
        }
        if self.accepted.contains_key(&net_id) {
            return Err(OriginError::AlreadyAdmitted(net_id));
        }
        if self
            .accepted
            .values()
            .any(|existing| existing.lease_epoch == lease_epoch)
        {
            return Err(OriginError::DuplicateLease);
        }
        let fighter = world
            .fighter(net_id)
            .ok_or(OriginError::MissingActor(net_id))?;
        if fighter.action == Action::Dead {
            return Err(OriginError::DeadActor(net_id));
        }
        let life = fighter.world_incarnation();
        if life == 0 {
            return Err(OriginError::InvalidAdmittedLease);
        }
        let bound = ActorIncarnation {
            player_id: net_id,
            boot_nonce: self.boot,
            lease_epoch,
            world_instance: self.world_generation,
            incarnation: life,
        };
        self.accepted.insert(net_id, bound);
        Ok(bound)
    }

    /// Retire only the EXACT old server session; a delayed close cannot
    /// remove a newly admitted same-number actor/lease.
    pub fn retire_exact(&mut self, bound: ActorIncarnation) -> Result<(), OriginError> {
        match self.accepted.get(&bound.player_id) {
            None => Err(OriginError::UnadmittedActor(bound.player_id)),
            Some(current) if *current != bound => Err(OriginError::StaleActor(bound.player_id)),
            Some(_) => {
                self.accepted.remove(&bound.player_id);
                Ok(())
            }
        }
    }

    fn current(&self, world: &World, net_id: u32) -> Result<ActorIncarnation, OriginError> {
        let bound = *self
            .accepted
            .get(&net_id)
            .ok_or(OriginError::UnadmittedActor(net_id))?;
        let fighter = world
            .fighter(net_id)
            .ok_or(OriginError::MissingActor(net_id))?;
        if fighter.world_incarnation() != bound.incarnation {
            return Err(OriginError::StaleActor(net_id));
        }
        Ok(bound)
    }

    /// NONRELEASE read-only extraction from a completed authoritative World tick.
    /// The existing GameState owner MUST supply the actual immutable events
    /// returned by its single original World::step_into under the SAME lock.
    /// The caller MUST preserve the tick of that completed original step:
    /// delayed old event slices must not be relabeled with a later World tick.
    /// This helper never steps or mutates World, and does not authenticate an
    /// arbitrary caller-supplied event slice by itself. Never expose it as an
    /// alternate path for clients to claim HIT or damage.
    pub fn capture_committed_hits_from_step(
        &self,
        world: &World,
        completed_tick: u32,
        original_events: &[CombatEvent],
    ) -> Result<Vec<(CombatEvent, CommittedHitIdentity)>, OriginError> {
        self.ensure_world(world)?;
        if world.tick == 0 {
            return Err(OriginError::NoCompletedWorldTick);
        }
        if completed_tick != world.tick {
            return Err(OriginError::WrongCommittedTick);
        }
        let mut committed_hits = Vec::new();
        for (index, event) in original_events.iter().enumerate() {
            if let CombatEvent::Hit {
                attacker, target, ..
            } = event
            {
                let within_tick_ordinal =
                    u32::try_from(index).map_err(|_| OriginError::OrdinalExhausted)?;
                let identity = CommittedHitIdentity {
                    server_tick: world.tick,
                    within_tick_ordinal,
                    attacker: self.current(world, *attacker)?,
                    victim: self.current(world, *target)?,
                };
                committed_hits.push((event.clone(), identity));
            }
        }
        Ok(committed_hits)
    }

    /// OFFLINE fixture only: drives the original World once, then delegates
    /// attribution to the same non-stepping capture used by future integration.
    /// Production's existing GameState clock MUST NEVER call this step helper.
    #[cfg(test)]
    pub fn step_and_capture(&self, world: &mut World) -> Result<OriginalWorldTick, OriginError> {
        self.ensure_world(world)?;
        if world.tick == u32::MAX {
            return Err(OriginError::TickExhausted);
        }
        let mut events = Vec::new();
        world.step_into(&mut events);
        let committed_hits = self.capture_committed_hits_from_step(world, world.tick, &events)?;
        Ok(OriginalWorldTick {
            tick: world.tick,
            events,
            committed_hits,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::combat_hit_delivery_proposal::{
        project_world_tick_for_recipients, DeliveryError, ProposedRecipientHitDelivery,
    };
    use crate::simulation::InputIntent;

    #[test]
    fn origin_debug_redacts_boot_entropy_and_accepted_private_bindings() {
        let world = arena();
        let mut first = ProposedWorldHitOrigin::new(&world, 987654321).unwrap();
        let mut second = ProposedWorldHitOrigin::new(&world, 123456789).unwrap();
        first.bind_admitted(&world, 1, 7).unwrap();
        second.bind_admitted(&world, 1, 8).unwrap();
        let debug = format!("{first:?}");
        assert!(debug.contains("[REDACTED]"));
        assert!(!debug.contains("987654321"));
        assert_eq!(debug, format!("{second:?}"));
    }

    fn arena() -> World {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        assert!(world.add_player_at(2, 260.0, 200.0, std::f32::consts::PI));
        assert!(world.add_player_at(3, 620.0, 400.0, std::f32::consts::PI));
        world
    }

    fn attack(world: &mut World) {
        assert!(world.set_input(
            1,
            InputIntent {
                attack: true,
                facing_radians: 0.0,
                ..InputIntent::default()
            }
        ));
    }

    fn first_real_hit(
        owner: &ProposedWorldHitOrigin,
        world: &mut World,
    ) -> (CombatEvent, CommittedHitIdentity) {
        for _ in 0..40 {
            let step = owner.step_and_capture(world).expect("original World tick");
            if let Some(hit) = step.committed_hits.into_iter().next() {
                return hit;
            }
        }
        panic!("original World must commit a genuine 34HP light hit");
    }

    #[test]
    fn actual_world_tick_projects_34hp_to_both_actors_and_never_spectator() {
        let mut world = arena();
        let mut owner = ProposedWorldHitOrigin::new(&world, 91).unwrap();
        let attacker = owner.bind_admitted(&world, 1, 101).unwrap();
        let victim = owner.bind_admitted(&world, 2, 102).unwrap();
        let spectator = owner.bind_admitted(&world, 3, 103).unwrap();
        attack(&mut world);
        let (hit, identity) = first_real_hit(&owner, &mut world);
        assert_eq!(
            hit,
            CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage: 34,
                hp: 66
            }
        );
        assert_eq!(identity.server_tick, world.tick);
        assert_eq!(identity.attacker, attacker);
        assert_eq!(identity.victim, victim);
        let mut a = ProposedRecipientHitDelivery::new(attacker, [1; 16], 64).unwrap();
        let mut v = ProposedRecipientHitDelivery::new(victim, [2; 16], 64).unwrap();
        let mut s = ProposedRecipientHitDelivery::new(spectator, [3; 16], 64).unwrap();
        assert_eq!(a.project_hit(&hit, identity).unwrap().unwrap().sequence, 0);
        assert_eq!(v.project_hit(&hit, identity).unwrap().unwrap().sequence, 0);
        assert_eq!(s.project_hit(&hit, identity), Ok(None));
        assert_eq!(s.pending(), 0);
    }

    #[test]
    fn removed_and_reused_actor_id_cannot_claim_new_life_until_exact_retire_and_bind() {
        let mut world = arena();
        let mut owner = ProposedWorldHitOrigin::new(&world, 91).unwrap();
        owner.bind_admitted(&world, 1, 101).unwrap();
        let old = owner.bind_admitted(&world, 2, 102).unwrap();
        owner.bind_admitted(&world, 3, 103).unwrap();
        attack(&mut world);
        let _ = first_real_hit(&owner, &mut world);
        assert!(world.remove_player(2));
        assert!(world.add_player_at(2, 260.0, 200.0, std::f32::consts::PI));
        assert_ne!(
            world.fighter(2).unwrap().world_incarnation(),
            old.incarnation
        );
        assert_eq!(
            owner.bind_admitted(&world, 2, 104),
            Err(OriginError::AlreadyAdmitted(2))
        );

        // Let the original light recovery finish; the old lease remains
        // stale even when the numeric player ID and event damage look valid.
        assert!(world.set_input(1, InputIntent::default()));
        for _ in 0..40 {
            owner.step_and_capture(&mut world).unwrap();
        }
        attack(&mut world);
        let mut rejected = None;
        for _ in 0..40 {
            if let Err(error) = owner.step_and_capture(&mut world) {
                rejected = Some(error);
                break;
            }
        }
        assert_eq!(rejected, Some(OriginError::StaleActor(2)));

        owner.retire_exact(old).unwrap();
        let fresh = owner.bind_admitted(&world, 2, 104).unwrap();
        assert_ne!(fresh, old);
        assert_eq!(owner.retire_exact(old), Err(OriginError::StaleActor(2)));
        assert_eq!(owner.current(&world, 2), Ok(fresh));
    }

    #[test]
    fn cloned_world_same_ids_and_ticks_never_cross_owner_boundary() {
        let mut original = arena();
        let mut owner = ProposedWorldHitOrigin::new(&original, 91).unwrap();
        owner.bind_admitted(&original, 1, 101).unwrap();
        owner.bind_admitted(&original, 2, 102).unwrap();
        let mut clone = original.clone();
        let before = clone.tick;
        assert_ne!(clone.world_instance(), original.world_instance());
        assert_eq!(
            owner.step_and_capture(&mut clone).unwrap_err(),
            OriginError::WrongWorldInstance
        );
        assert_eq!(clone.tick, before, "reject before mutating cloned World");
        attack(&mut original);
        let (hit, _) = first_real_hit(&owner, &mut original);
        assert!(matches!(hit, CombatEvent::Hit { damage: 34, .. }));
    }

    #[test]
    fn missing_admission_and_reused_lease_fail_closed_without_fake_hit_credit() {
        let mut world = arena();
        let mut owner = ProposedWorldHitOrigin::new(&world, 91).unwrap();
        owner.bind_admitted(&world, 1, 101).unwrap();
        assert_eq!(
            owner.bind_admitted(&world, 2, 101),
            Err(OriginError::DuplicateLease)
        );
        attack(&mut world);
        let mut rejected = None;
        for _ in 0..40 {
            if let Err(error) = owner.step_and_capture(&mut world) {
                rejected = Some(error);
                break;
            }
        }
        assert_eq!(rejected, Some(OriginError::UnadmittedActor(2)));
    }

    #[test]
    fn original_one_light_swing_commits_two_same_tick_hits_with_distinct_ordinals() {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        assert!(world.add_player_at(2, 255.0, 180.0, std::f32::consts::PI));
        assert!(world.add_player_at(3, 255.0, 220.0, std::f32::consts::PI));
        assert!(world.add_player_at(4, 700.0, 500.0, std::f32::consts::PI));
        let mut origin = ProposedWorldHitOrigin::new(&world, 91).unwrap();
        let attacker = origin.bind_admitted(&world, 1, 101).unwrap();
        let victim2 = origin.bind_admitted(&world, 2, 102).unwrap();
        let victim3 = origin.bind_admitted(&world, 3, 103).unwrap();
        let bystander = origin.bind_admitted(&world, 4, 104).unwrap();
        attack(&mut world);
        let hits = (0..40)
            .find_map(|_| {
                let step = origin.step_and_capture(&mut world).unwrap();
                (step.committed_hits.len() == 2).then_some(step.committed_hits)
            })
            .expect("one original World LightActive must strike two in-arc distinct actors");
        assert_eq!(hits[0].1.server_tick, hits[1].1.server_tick);
        assert!(hits[0].1.within_tick_ordinal < hits[1].1.within_tick_ordinal);
        assert_eq!(
            hits[0].0,
            CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage: 34,
                hp: 66,
            }
        );
        assert_eq!(
            hits[1].0,
            CombatEvent::Hit {
                attacker: 1,
                target: 3,
                damage: 34,
                hp: 66,
            }
        );
        let mut a = ProposedRecipientHitDelivery::new(attacker, [1; 16], 64).unwrap();
        let mut v2 = ProposedRecipientHitDelivery::new(victim2, [2; 16], 64).unwrap();
        let mut v3 = ProposedRecipientHitDelivery::new(victim3, [3; 16], 64).unwrap();
        let mut s = ProposedRecipientHitDelivery::new(bystander, [4; 16], 64).unwrap();
        for (event, identity) in &hits {
            a.project_hit(event, *identity).unwrap();
            v2.project_hit(event, *identity).unwrap();
            v3.project_hit(event, *identity).unwrap();
            assert_eq!(s.project_hit(event, *identity), Ok(None));
        }
        assert_eq!(a.next_sequence(), 2);
        assert_eq!(v2.next_sequence(), 1);
        assert_eq!(v3.next_sequence(), 1);
        assert_eq!(s.next_sequence(), 0);
    }

    #[test]
    fn actual_existing_core8_gesture_admission_and_hit_scope_share_identical_binding() {
        use crate::prealpha_authenticated_gesture::SessionGestureWorldPath;

        let mut world = arena();
        let mut origin = ProposedWorldHitOrigin::new(&world, 91).unwrap();
        let original = SessionGestureWorldPath::from_admitted_world(&world, 2, 102, 91)
            .expect("real Core8 source1 gesture actor must be admitted");
        let hit_scope = origin.bind_admitted(&world, 2, 102).unwrap();
        assert_eq!(hit_scope, original.binding());
        // The originally returned actor/lease isn't authority over a new
        // occupant with an identical numeric player ID.
        assert!(world.remove_player(2));
        assert!(world.add_player_at(2, 260.0, 200.0, std::f32::consts::PI));
        let replacement = SessionGestureWorldPath::from_admitted_world(&world, 2, 104, 91)
            .expect("different authenticated lease on fresh original World actor");
        assert_ne!(replacement.binding(), original.binding());
        assert_eq!(
            origin.bind_admitted(&world, 2, 104),
            Err(OriginError::AlreadyAdmitted(2))
        );
        origin.retire_exact(original.binding()).unwrap();
        let new_hit_scope = origin.bind_admitted(&world, 2, 104).unwrap();
        assert_eq!(new_hit_scope, replacement.binding());
        assert_eq!(
            origin.retire_exact(original.binding()),
            Err(OriginError::StaleActor(2)),
            "delayed old disconnect cannot evict fresh current actor scope"
        );
    }

    #[test]
    fn two_genuine_world_hits_publish_one_atomic_recipient_batch_without_ghost_ack() {
        // Same original World multi-target geometry as the existing source
        // provenance test. This executes real World::step_into, not fabricated
        // client HITs, and keeps recipient queue publication separate.
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        assert!(world.add_player_at(2, 255.0, 180.0, std::f32::consts::PI));
        assert!(world.add_player_at(3, 255.0, 220.0, std::f32::consts::PI));
        assert!(world.add_player_at(4, 700.0, 500.0, std::f32::consts::PI));
        let mut origin = ProposedWorldHitOrigin::new(&world, 91).unwrap();
        let attacker = origin.bind_admitted(&world, 1, 101).unwrap();
        let victim2 = origin.bind_admitted(&world, 2, 102).unwrap();
        let victim3 = origin.bind_admitted(&world, 3, 103).unwrap();
        let bystander = origin.bind_admitted(&world, 4, 104).unwrap();
        attack(&mut world);
        let committed = (0..40)
            .find_map(|_| {
                let result = origin.step_and_capture(&mut world).unwrap();
                (result.committed_hits.len() == 2).then_some(result.committed_hits)
            })
            .expect("one real World light must HIT two original actors in the same tick");
        let original_tick = committed[0].1.server_tick;
        assert_eq!(committed[1].1.server_tick, original_tick);
        assert!(committed[0].1.within_tick_ordinal < committed[1].1.within_tick_ordinal);

        let mut delivery = ProposedRecipientHitDelivery::new(attacker, [1; 16], 64).unwrap();
        // A forged/stale later victim binding must reject the entire genuine
        // source batch BEFORE publishing first recipient credit. It cannot
        // change the already-applied original World damage.
        let mut malformed = committed.clone();
        malformed[1].1.victim = attacker;
        assert_eq!(
            delivery.project_committed_tick_batch(original_tick, &malformed),
            Err(DeliveryError::InvalidWorldIdentity)
        );
        assert_eq!(delivery.pending(), 0);
        assert_eq!(delivery.next_sequence(), 0);
        assert_eq!(delivery.acknowledged_next(), 0);

        // Correct immutable original batch is published once, local seq0/1
        // to attacker; each victim only gets its own local seq0, spectator none.
        let published = delivery
            .project_committed_tick_batch(original_tick, &committed)
            .unwrap();
        assert_eq!(published.len(), 2);
        assert_eq!((published[0].sequence, published[1].sequence), (0, 1));
        assert_eq!((published[0].damage, published[1].damage), (34.0, 34.0));
        let mut v2 = ProposedRecipientHitDelivery::new(victim2, [2; 16], 64).unwrap();
        let mut v3 = ProposedRecipientHitDelivery::new(victim3, [3; 16], 64).unwrap();
        let mut spectator = ProposedRecipientHitDelivery::new(bystander, [4; 16], 64).unwrap();
        assert_eq!(
            v2.project_committed_tick_batch(original_tick, &committed)
                .unwrap()
                .iter()
                .map(|r| r.sequence)
                .collect::<Vec<_>>(),
            vec![0]
        );
        assert_eq!(
            v3.project_committed_tick_batch(original_tick, &committed)
                .unwrap()
                .iter()
                .map(|r| r.sequence)
                .collect::<Vec<_>>(),
            vec![0]
        );
        assert!(spectator
            .project_committed_tick_batch(original_tick, &committed)
            .unwrap()
            .is_empty());
        assert_eq!(spectator.pending(), 0);
        assert_eq!(
            delivery.ack_next(attacker, &[1; 16], 2),
            Err(DeliveryError::FutureAck),
            "enqueue under World authority is neither reliable stream write nor app ACK"
        );
        assert_eq!(
            delivery.project_committed_tick_batch(original_tick, &committed),
            Err(DeliveryError::ReplayedOrReorderedWorldHit),
            "a delayed second callback must not double-credit a committed World tick"
        );
    }

    #[test]
    fn one_original_two_target_world_tick_publishes_only_after_every_recipient_validates() {
        // Four actual original Rust actors; true server World::step_into emits
        // two distinct 34-HP HITs and immutable within-tick ordinals.
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        assert!(world.add_player_at(2, 255.0, 180.0, std::f32::consts::PI));
        assert!(world.add_player_at(3, 255.0, 220.0, std::f32::consts::PI));
        assert!(world.add_player_at(4, 700.0, 500.0, std::f32::consts::PI));
        let mut origin = ProposedWorldHitOrigin::new(&world, 91).unwrap();
        let attacker = origin.bind_admitted(&world, 1, 101).unwrap();
        let victim_a = origin.bind_admitted(&world, 2, 102).unwrap();
        let victim_b = origin.bind_admitted(&world, 3, 103).unwrap();
        let spectator = origin.bind_admitted(&world, 4, 104).unwrap();
        attack(&mut world);
        let committed = (0..40)
            .find_map(|_| {
                let original = origin.step_and_capture(&mut world).unwrap();
                (original.committed_hits.len() == 2).then_some(original.committed_hits)
            })
            .expect("original 60Hz LightActive hits both live World victims");
        let tick = committed[0].1.server_tick;
        assert_eq!(committed[1].1.server_tick, tick);
        assert!(committed[0].1.within_tick_ordinal < committed[1].1.within_tick_ordinal);
        assert!(committed.iter().all(|(event, _)| matches!(
            event,
            CombatEvent::Hit {
                damage: 34,
                hp: 66,
                ..
            }
        )));

        let fresh = || {
            vec![
                ProposedRecipientHitDelivery::new(attacker, [1; 16], 64).unwrap(),
                ProposedRecipientHitDelivery::new(victim_a, [2; 16], 64).unwrap(),
                ProposedRecipientHitDelivery::new(victim_b, [3; 16], 64).unwrap(),
                ProposedRecipientHitDelivery::new(spectator, [4; 16], 64).unwrap(),
            ]
        };
        let mut scopes = fresh();
        // A corrupt second original HIT must not grant even the attacker
        // or first victim an observable earlier receipt.
        let mut bad = committed.clone();
        bad[1].1.victim = attacker;
        assert_eq!(
            project_world_tick_for_recipients(tick, &bad, &mut scopes),
            Err(DeliveryError::InvalidWorldIdentity)
        );
        assert!(scopes
            .iter()
            .all(|scope| scope.pending() == 0 && scope.next_sequence() == 0));

        // If attacker capacity cannot cover both original World HITs,
        // publish none and GAP-fence every actual HIT participant. All
        // already-committed World damage remains authoritative; uninvolved
        // spectators must neither gain credit nor lose their good lease.
        let mut full = fresh();
        full[0] = ProposedRecipientHitDelivery::new(attacker, [1; 16], 1).unwrap();
        assert_eq!(
            project_world_tick_for_recipients(tick, &committed, &mut full),
            Err(DeliveryError::PendingOverflow { first_missing: 0 })
        );
        assert_eq!(full[0].gap(), Some(0));
        assert!(full
            .iter()
            .all(|scope| scope.pending() == 0 && scope.next_sequence() == 0));
        assert!(
            full.iter().take(3).all(|scope| scope.gap() == Some(0)),
            "all original attacker/victim scopes must request resync on lost tick"
        );
        assert_eq!(full[3].gap(), None, "spectator never claimed the HIT");

        // Successful canonical tick publication is contiguous for the source
        // and each involved victim, with no unrelated spectator receipt.
        let actual = project_world_tick_for_recipients(tick, &committed, &mut scopes).unwrap();
        assert_eq!(
            actual
                .iter()
                .map(|(recipient, receipts)| (recipient.player_id, receipts.len()))
                .collect::<Vec<_>>(),
            vec![(1, 2), (2, 1), (3, 1), (4, 0)]
        );
        assert_eq!((actual[0].1[0].sequence, actual[0].1[1].sequence), (0, 1));
        assert_eq!((actual[0].1[0].damage, actual[0].1[1].damage), (34.0, 34.0));
        assert_eq!(scopes[3].pending(), 0);
        assert_eq!(
            scopes[0].ack_next(attacker, &[1; 16], 2),
            Err(DeliveryError::FutureAck),
            "a staged original World HIT is not a reliable network write or app ACK"
        );
        assert_eq!(
            project_world_tick_for_recipients(tick, &committed, &mut scopes),
            Err(DeliveryError::ReplayedOrReorderedWorldHit),
            "the complete original World tick cannot be recredited"
        );
    }
    #[test]
    fn read_only_original_world_capture_never_steps_or_reapplies_damage() {
        // Capture real original two-victim HIT events after the ONE World step,
        // as the existing production 60Hz GameState clock would supply them.
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        assert!(world.add_player_at(2, 255.0, 180.0, std::f32::consts::PI));
        assert!(world.add_player_at(3, 255.0, 220.0, std::f32::consts::PI));
        assert!(world.add_player_at(4, 700.0, 500.0, std::f32::consts::PI));
        let mut origin = ProposedWorldHitOrigin::new(&world, 91).unwrap();
        let attacker = origin.bind_admitted(&world, 1, 101).unwrap();
        let victim_a = origin.bind_admitted(&world, 2, 102).unwrap();
        let victim_b = origin.bind_admitted(&world, 3, 103).unwrap();
        let spectator = origin.bind_admitted(&world, 4, 104).unwrap();

        assert_eq!(
            origin.capture_committed_hits_from_step(&world, world.tick, &[]),
            Err(OriginError::NoCompletedWorldTick),
            "an unstepped World cannot invent a committed HIT"
        );

        attack(&mut world);
        let mut events = Vec::new();
        for _ in 0..40 {
            let before_tick = world.tick;
            world.step_into(&mut events);
            assert_eq!(
                world.tick,
                before_tick + 1,
                "only original World step advances"
            );
            let hp2 = world.fighter(2).unwrap().hp;
            let hp3 = world.fighter(3).unwrap().hp;
            let tick = world.tick;
            let immutable_hits = origin
                .capture_committed_hits_from_step(&world, tick, &events)
                .unwrap();
            assert_eq!(world.tick, tick, "HIT extraction cannot step World");
            assert_eq!(world.fighter(2).unwrap().hp, hp2);
            assert_eq!(world.fighter(3).unwrap().hp, hp3);
            if immutable_hits.len() == 2 {
                assert_eq!((hp2, hp3), (66.0, 66.0));
                assert_eq!(immutable_hits[0].1.server_tick, tick);
                assert_eq!(immutable_hits[1].1.server_tick, tick);
                assert!(
                    immutable_hits[0].1.within_tick_ordinal
                        < immutable_hits[1].1.within_tick_ordinal
                );
                assert_eq!(
                    origin
                        .capture_committed_hits_from_step(&world, tick, &events)
                        .unwrap(),
                    immutable_hits,
                    "read-only recapture cannot reexecute damage"
                );
                let mut recipients = vec![
                    ProposedRecipientHitDelivery::new(attacker, [1; 16], 64).unwrap(),
                    ProposedRecipientHitDelivery::new(victim_a, [2; 16], 64).unwrap(),
                    ProposedRecipientHitDelivery::new(victim_b, [3; 16], 64).unwrap(),
                    ProposedRecipientHitDelivery::new(spectator, [4; 16], 64).unwrap(),
                ];
                let published =
                    project_world_tick_for_recipients(tick, &immutable_hits, &mut recipients)
                        .unwrap();
                assert_eq!(
                    published
                        .iter()
                        .map(|(scope, events)| (scope.player_id, events.len()))
                        .collect::<Vec<_>>(),
                    vec![(1, 2), (2, 1), (3, 1), (4, 0)]
                );
                assert_eq!(
                    (published[0].1[0].sequence, published[0].1[1].sequence),
                    (0, 1)
                );
                assert_eq!(published[1].1[0].sequence, 0);
                assert_eq!(published[2].1[0].sequence, 0);
                assert_eq!(recipients[3].pending(), 0);
                assert_eq!(
                    project_world_tick_for_recipients(tick, &immutable_hits, &mut recipients),
                    Err(DeliveryError::ReplayedOrReorderedWorldHit),
                    "re-reading original World events cannot yield second global credit"
                );
                assert_eq!(world.tick, tick);
                assert_eq!(
                    (world.fighter(2).unwrap().hp, world.fighter(3).unwrap().hp),
                    (66.0, 66.0)
                );
                return;
            }
        }
        panic!("original World did not produce expected two-victim 34 HP HIT");
    }

    #[test]
    fn actual_original_world_guard_block_never_creates_m147_hit_credit() {
        // A genuine World Block is a resolved authoritative defense, NOT a HIT.
        // The delayed M188 heavy-parry case may correctly commit a 64-guard
        // BLOCK, but neither a client ACK nor an HP snapshot can mint a receipt.
        let mut world = arena();
        let mut origin = ProposedWorldHitOrigin::new(&world, 91).unwrap();
        let attacker = origin.bind_admitted(&world, 1, 101).unwrap();
        let victim = origin.bind_admitted(&world, 2, 102).unwrap();
        let spectator = origin.bind_admitted(&world, 3, 103).unwrap();
        let mut recipients = vec![
            ProposedRecipientHitDelivery::new(attacker, [1; 16], 64).unwrap(),
            ProposedRecipientHitDelivery::new(victim, [2; 16], 64).unwrap(),
            ProposedRecipientHitDelivery::new(spectator, [3; 16], 64).unwrap(),
        ];
        // A real defender, facing the original attacker, holds the existing
        // server-side block input while the original light windup resolves.
        assert!(world.set_input(
            2,
            InputIntent {
                block: true,
                facing_radians: std::f32::consts::PI,
                ..InputIntent::default()
            }
        ));
        attack(&mut world);

        let mut events = Vec::new();
        for _ in 0..40 {
            let before = world.tick;
            world.step_into(&mut events); // exactly ONE production World step
            assert_eq!(world.tick, before + 1);
            let tick = world.tick;
            let hp = world.fighter(2).unwrap().hp;
            let actual_hits = origin
                .capture_committed_hits_from_step(&world, tick, &events)
                .expect("current under-lock original World event slice");
            // Even the original non-HIT World event must advance each scope's
            // tick fence; there is no phantom app ACK or publishable damage.
            let delivered = project_world_tick_for_recipients(tick, &actual_hits, &mut recipients)
                .expect("current World block/no-HIT tick is valid");
            assert!(delivered.iter().all(|(_, receipts)| receipts.is_empty()));
            assert!(recipients.iter().all(|r| r.pending() == 0));
            assert_eq!(world.fighter(2).unwrap().hp, hp);
            if events.iter().any(|event| {
                matches!(
                    event,
                    CombatEvent::Block {
                        attacker: 1,
                        target: 2
                    }
                )
            }) {
                assert!(actual_hits.is_empty(), "guard BLOCK is not a HIT");
                assert_eq!(hp, 100.0, "actual World block preserves victim HP");
                assert!(world.fighter(2).unwrap().guard < 100.0);
                assert!(recipients
                    .iter()
                    .all(|r| r.pending() == 0 && r.next_sequence() == 0));
                assert_eq!(
                    project_world_tick_for_recipients(tick, &actual_hits, &mut recipients),
                    Err(DeliveryError::ReplayedOrReorderedWorldHit),
                    "even an empty completed original World tick is not reusable"
                );
                return;
            }
        }
        panic!("original World must actually commit a guard BLOCK, not a fake HIT");
    }

    #[test]
    fn stale_original_world_hit_slice_cannot_be_relabelled_as_later_tick() {
        // Only the existing original World may commit HIT. If an adapter
        // releases its tick boundary, old events cannot acquire a newer tick.
        let mut world = arena();
        let mut origin = ProposedWorldHitOrigin::new(&world, 91).unwrap();
        let attacker = origin.bind_admitted(&world, 1, 101).unwrap();
        let victim = origin.bind_admitted(&world, 2, 102).unwrap();
        origin.bind_admitted(&world, 3, 103).unwrap();
        attack(&mut world);

        let mut events = Vec::new();
        let mut prior = None;
        for _ in 0..40 {
            world.step_into(&mut events);
            if events.iter().any(|event| {
                matches!(
                    event,
                    CombatEvent::Hit {
                        attacker: 1,
                        target: 2,
                        damage: 34,
                        hp: 66
                    }
                )
            }) {
                prior = Some((world.tick, events.clone()));
                break;
            }
        }
        let (committed_tick, immutable_events) =
            prior.expect("one genuine original World light HIT at 34 HP");
        let current = origin
            .capture_committed_hits_from_step(&world, committed_tick, &immutable_events)
            .unwrap();
        assert_eq!(current.len(), 1);
        assert_eq!(current[0].1.server_tick, committed_tick);
        assert_eq!(current[0].1.attacker, attacker);
        assert_eq!(current[0].1.victim, victim);

        // The original World advances once more; holding the old event slice
        // must not create false future identity or any new damage/receipt.
        let inbox = ProposedRecipientHitDelivery::new(attacker, [1; 16], 64).unwrap();
        world.step_into(&mut events);
        assert_eq!(world.tick, committed_tick + 1);
        assert_eq!(world.fighter(2).unwrap().hp, 66.0);
        assert_eq!(
            origin.capture_committed_hits_from_step(&world, committed_tick, &immutable_events),
            Err(OriginError::WrongCommittedTick)
        );
        assert_eq!(inbox.pending(), 0);
        assert_eq!(inbox.next_sequence(), 0);
        assert_eq!(
            world.fighter(2).unwrap().world_incarnation(),
            victim.incarnation
        );
    }
}
