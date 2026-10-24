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
    TickExhausted,
    OrdinalExhausted,
}

#[derive(Debug)]
pub struct ProposedWorldHitOrigin {
    boot: u128,
    world_generation: u64,
    // This is a review-only representation of server-accepted authenticated
    // sessions, NOT evidence that any remote principal was authenticated.
    accepted: BTreeMap<u32, ActorIncarnation>,
}

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

    /// The caller must hold the same original GameState mutex while invoking
    /// this method and subsequently handing off the immutable tick evidence.
    /// The *only* possible HIT input is the actual World.step_into event list;
    /// callers cannot inject a self-claimed HIT or pick a client tick.
    pub fn step_and_capture(&self, world: &mut World) -> Result<OriginalWorldTick, OriginError> {
        self.ensure_world(world)?;
        if world.tick == u32::MAX {
            return Err(OriginError::TickExhausted);
        }
        let mut events = Vec::new();
        world.step_into(&mut events);
        let mut committed_hits = Vec::new();
        for (index, event) in events.iter().enumerate() {
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
    use crate::combat_hit_delivery_proposal::ProposedRecipientHitDelivery;
    use crate::simulation::InputIntent;

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
}
