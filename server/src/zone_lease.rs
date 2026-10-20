//! C4a: dormant, single-authority, epoch-fenced entity/zone ownership.
//!
//! In-process proof only. No durable CAS, authentication, distributed quorum,
//! RPC, world migration, or live simulation integration exists here.
//! Every call is by the trusted authoritative server, never a browser.

use crate::identity::CharacterId;
use std::{
    collections::BTreeMap,
    num::{NonZeroU128, NonZeroU64},
};

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Hash)]
pub struct WorkerId(NonZeroU64);
impl WorkerId {
    pub fn new(value: u64) -> Option<Self> {
        NonZeroU64::new(value).map(Self)
    }
    pub fn get(self) -> u64 { self.0.get() }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Hash)]
pub struct ZoneKey(NonZeroU64);
impl ZoneKey {
    pub fn new(value: u64) -> Option<Self> {
        NonZeroU64::new(value).map(Self)
    }
    pub fn get(self) -> u64 { self.0.get() }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Hash)]
pub enum OwnedEntity {
    Character(CharacterId),
    GroundItem(NonZeroU128),
}
impl OwnedEntity {
    pub fn ground_item(id: u128) -> Option<Self> {
        NonZeroU128::new(id).map(Self::GroundItem)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AuthorityLease {
    entity: OwnedEntity,
    worker: WorkerId,
    zone: ZoneKey,
    epoch: u64,
}
impl AuthorityLease {
    pub fn entity(self) -> OwnedEntity {
        self.entity
    }
    pub fn worker(self) -> WorkerId {
        self.worker
    }
    pub fn zone(self) -> ZoneKey {
        self.zone
    }
    pub fn epoch(self) -> u64 {
        self.epoch
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct HandoffTicket {
    source: AuthorityLease,
    target_worker: WorkerId,
    target_zone: ZoneKey,
    operation: NonZeroU128,
}
impl HandoffTicket {
    pub fn operation(self) -> NonZeroU128 { self.operation }
    pub fn source(self) -> AuthorityLease {
        self.source
    }
    pub fn destination(self) -> (WorkerId, ZoneKey) {
        (self.target_worker, self.target_zone)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuthorityError {
    EntityAlreadyRegistered,
    UnknownEntity,
    EntityRetired,
    StaleLease,
    TransferInProgress,
    TransferConflict,
    SameDestination,
    StaleHandoff,
    EpochExhausted,
}
#[derive(Clone, Copy, Debug)]
struct Slot {
    lease: AuthorityLease,
    pending: Option<HandoffTicket>,
    recent_commit: Option<(HandoffTicket, AuthorityLease)>,
    retired: bool,
}

/// Exactly one authoritative lease per entity within this registry.
/// The pending state freezes writes by *both* workers. A durable cross-host
/// coordinator is required before using this with independent workers.
#[derive(Clone, Default, Debug)]
pub struct ZoneLeaseRegistry {
    slots: BTreeMap<OwnedEntity, Slot>,
}
impl ZoneLeaseRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Server-provisioned and immutable identity only; never from client input.
    pub fn register(
        &mut self,
        entity: OwnedEntity,
        worker: WorkerId,
        zone: ZoneKey,
    ) -> Result<AuthorityLease, AuthorityError> {
        if self.slots.contains_key(&entity) {
            return Err(AuthorityError::EntityAlreadyRegistered);
        }
        let lease = AuthorityLease {
            entity,
            worker,
            zone,
            epoch: 1,
        };
        self.slots.insert(
            entity,
            Slot {
                lease,
                pending: None,
                recent_commit: None,
                retired: false,
            },
        );
        Ok(lease)
    }

    pub fn current(&self, entity: OwnedEntity) -> Option<AuthorityLease> {
        self.slots
            .get(&entity)
            .and_then(|slot| (!slot.retired).then_some(slot.lease))
    }

    /// Read-only pending proof for replay validation. No commit record may
    /// materialize a handoff that was not previously durably prepared.
    pub fn pending(&self, entity: OwnedEntity) -> Option<HandoffTicket> {
        self.slots.get(&entity).and_then(|slot| {
            if slot.retired { None } else { slot.pending }
        })
    }

    /// Pending handoff denies source and destination all game mutations,
    /// so no two workers are ever authorized by this registry concurrently.
    pub fn can_mutate(&self, lease: AuthorityLease) -> bool {
        self.slots
            .get(&lease.entity)
            .is_some_and(|slot| !slot.retired && slot.pending.is_none() && slot.lease == lease)
    }

    /// Preparing NEVER advances ownership. The source must stop applying
    /// world changes until an authorized coordinator either aborts or commits.
    pub fn prepare(
        &mut self,
        source: AuthorityLease,
        target_worker: WorkerId,
        target_zone: ZoneKey,
        operation: NonZeroU128,
    ) -> Result<HandoffTicket, AuthorityError> {
        let slot = self
            .slots
            .get_mut(&source.entity)
            .ok_or(AuthorityError::UnknownEntity)?;
        if slot.retired {
            return Err(AuthorityError::EntityRetired);
        }
        if slot.lease != source {
            return Err(AuthorityError::StaleLease);
        }
        if target_worker == source.worker && target_zone == source.zone {
            return Err(AuthorityError::SameDestination);
        }
        if source.epoch.checked_add(1).is_none() {
            return Err(AuthorityError::EpochExhausted);
        }
        let ticket = HandoffTicket {
            source,
            target_worker,
            target_zone,
            operation,
        };
        if let Some(pending) = slot.pending {
            return if pending == ticket {
                Ok(ticket)
            } else if pending.operation == operation {
                Err(AuthorityError::TransferConflict)
            } else {
                Err(AuthorityError::TransferInProgress)
            };
        }
        slot.pending = Some(ticket);
        slot.recent_commit = None;
        Ok(ticket)
    }

    /// This models the post-commit application to a single in-memory registry.
    /// A REAL cross-worker system must persist this transition with atomic CAS
    /// and fence both workers before invoking this method.
    pub fn commit(&mut self, ticket: HandoffTicket) -> Result<AuthorityLease, AuthorityError> {
        let slot = self
            .slots
            .get_mut(&ticket.source.entity)
            .ok_or(AuthorityError::UnknownEntity)?;
        if slot.retired {
            return Err(AuthorityError::EntityRetired);
        }
        // Identical ACK retry is safe only while the new lease is current.
        if let Some((committed_ticket, lease)) = slot.recent_commit {
            if committed_ticket == ticket && slot.pending.is_none() && slot.lease == lease {
                return Ok(lease);
            }
        }
        if slot.lease != ticket.source {
            return Err(AuthorityError::StaleLease);
        }
        if slot.pending != Some(ticket) {
            return Err(AuthorityError::StaleHandoff);
        }
        let epoch = slot
            .lease
            .epoch
            .checked_add(1)
            .ok_or(AuthorityError::EpochExhausted)?;
        let next = AuthorityLease {
            entity: ticket.source.entity,
            worker: ticket.target_worker,
            zone: ticket.target_zone,
            epoch,
        };
        slot.lease = next;
        slot.pending = None;
        slot.recent_commit = Some((ticket, next));
        Ok(next)
    }

    /// Abort is safe only before a durable transaction has committed.
    /// Production coordinator must decide from the transaction authority.
    pub fn abort(&mut self, ticket: HandoffTicket) -> Result<(), AuthorityError> {
        let slot = self
            .slots
            .get_mut(&ticket.source.entity)
            .ok_or(AuthorityError::UnknownEntity)?;
        if slot.retired {
            return Err(AuthorityError::EntityRetired);
        }
        if slot.lease != ticket.source {
            return Err(AuthorityError::StaleLease);
        }
        if slot.pending != Some(ticket) {
            return Err(AuthorityError::StaleHandoff);
        }
        slot.pending = None;
        Ok(())
    }

    /// Never recycle a retired entity ID: this leaves a tombstone to fence
    /// delayed messages even after logical despawn within the process.
    pub fn retire(&mut self, lease: AuthorityLease) -> Result<(), AuthorityError> {
        let slot = self
            .slots
            .get_mut(&lease.entity)
            .ok_or(AuthorityError::UnknownEntity)?;
        if slot.retired {
            return Err(AuthorityError::EntityRetired);
        }
        if slot.lease != lease {
            return Err(AuthorityError::StaleLease);
        }
        if slot.pending.is_some() {
            return Err(AuthorityError::TransferInProgress);
        }
        slot.retired = true;
        slot.recent_commit = None;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Barrier, Mutex};

    fn worker(n: u64) -> WorkerId {
        WorkerId::new(n).expect("worker")
    }
    fn zone(n: u64) -> ZoneKey {
        ZoneKey::new(n).expect("zone")
    }
    fn op(n: u128) -> NonZeroU128 {
        NonZeroU128::new(n).expect("operation")
    }
    fn character(n: u128) -> OwnedEntity {
        OwnedEntity::Character(CharacterId::new(n).expect("character"))
    }
    fn item(n: u128) -> OwnedEntity {
        OwnedEntity::ground_item(n).expect("item")
    }

    #[test]
    fn identity_types_require_nonzero_values() {
        assert!(WorkerId::new(0).is_none());
        assert!(ZoneKey::new(0).is_none());
        assert!(OwnedEntity::ground_item(0).is_none());
    }

    #[test]
    fn handoff_freezes_both_workers_until_commit_then_fences_source() {
        let mut r = ZoneLeaseRegistry::new();
        let before = r
            .register(character(11), worker(1), zone(1))
            .expect("register");
        assert!(r.can_mutate(before));
        let ticket = r
            .prepare(before, worker(2), zone(3), op(30))
            .expect("prepare");
        assert_eq!(r.current(character(11)), Some(before));
        assert!(!r.can_mutate(before));
        let after = r.commit(ticket).expect("commit");
        assert_eq!(after.epoch(), 2);
        assert_eq!(after.worker(), worker(2));
        assert_eq!(after.zone(), zone(3));
        assert!(!r.can_mutate(before));
        assert!(r.can_mutate(after));
        assert_eq!(r.current(character(11)), Some(after));
    }

    #[test]
    fn prepare_retry_is_idempotent_and_conflicts_do_not_change_state() {
        let mut r = ZoneLeaseRegistry::new();
        let a = r.register(item(55), worker(1), zone(1)).expect("register");
        let ticket = r.prepare(a, worker(2), zone(2), op(50)).expect("prepare");
        assert_eq!(r.prepare(a, worker(2), zone(2), op(50)), Ok(ticket));
        assert_eq!(
            r.prepare(a, worker(3), zone(3), op(50)),
            Err(AuthorityError::TransferConflict)
        );
        assert_eq!(
            r.prepare(a, worker(3), zone(3), op(51)),
            Err(AuthorityError::TransferInProgress)
        );
        assert!(!r.can_mutate(a));
        r.abort(ticket).expect("abort pending");
        assert!(r.can_mutate(a));
        let new = r
            .prepare(a, worker(3), zone(3), op(51))
            .expect("fresh prepare");
        assert_eq!(r.commit(new).expect("commit").worker(), worker(3));
    }

    #[test]
    fn stale_and_delayed_ticket_cannot_rollback_new_authority() {
        let mut r = ZoneLeaseRegistry::new();
        let first = r
            .register(item(13), worker(1), zone(1))
            .expect("registered");
        let old = r.prepare(first, worker(2), zone(2), op(1)).expect("old");
        let second = r.commit(old).expect("commit");
        assert_eq!(r.commit(old), Ok(second));
        assert_eq!(r.abort(old), Err(AuthorityError::StaleLease));
        assert_eq!(
            r.prepare(first, worker(3), zone(3), op(2)),
            Err(AuthorityError::StaleLease)
        );
        let next = r.prepare(second, worker(3), zone(3), op(2)).expect("new");
        assert_eq!(r.commit(old), Err(AuthorityError::StaleLease));
        assert!(!r.can_mutate(second));
        let third = r.commit(next).expect("next commit");
        assert_eq!(third.epoch(), 3);
        assert_eq!(r.current(item(13)), Some(third));
    }

    #[test]
    fn forged_or_cross_entity_ticket_cannot_claim_another_entity() {
        let mut r = ZoneLeaseRegistry::new();
        let player = r
            .register(character(13), worker(1), zone(1))
            .expect("player");
        let ground = r.register(item(13), worker(3), zone(3)).expect("ground");
        let ticket = r
            .prepare(player, worker(2), zone(2), op(4))
            .expect("player move");
        assert!(!r.can_mutate(player));
        assert!(r.can_mutate(ground));
        assert_eq!(
            r.commit(ticket).expect("player commit").entity(),
            character(13)
        );
        assert_eq!(r.current(item(13)), Some(ground));
        assert_eq!(r.retire(ground), Ok(()));
        assert!(!r.can_mutate(ground));
        assert_eq!(
            r.register(item(13), worker(4), zone(5)),
            Err(AuthorityError::EntityAlreadyRegistered)
        );
    }

    #[test]
    fn retirement_blocked_during_prepare_and_stale_retire_rejected() {
        let mut r = ZoneLeaseRegistry::new();
        let first = r.register(item(25), worker(1), zone(1)).expect("item");
        let ticket = r
            .prepare(first, worker(2), zone(2), op(1))
            .expect("prepare");
        assert_eq!(r.retire(first), Err(AuthorityError::TransferInProgress));
        r.abort(ticket).expect("abort");
        let next = r
            .prepare(first, worker(2), zone(2), op(2))
            .expect("prepare again");
        let second = r.commit(next).expect("new");
        assert_eq!(r.retire(first), Err(AuthorityError::StaleLease));
        r.retire(second).expect("retire");
        assert_eq!(r.current(item(25)), None);
        assert_eq!(
            r.prepare(second, worker(1), zone(1), op(3)),
            Err(AuthorityError::EntityRetired)
        );
    }

    #[test]
    fn epoch_exhaustion_does_not_freeze_or_mutate_entity() {
        let mut r = ZoneLeaseRegistry::new();
        let original = r.register(character(1), worker(1), zone(1)).expect("first");
        let slot = r.slots.get_mut(&character(1)).expect("slot");
        slot.lease.epoch = u64::MAX;
        let current = slot.lease;
        assert_eq!(
            r.prepare(current, worker(2), zone(2), op(2)),
            Err(AuthorityError::EpochExhausted)
        );
        assert_eq!(r.current(character(1)), Some(current));
        assert!(r.can_mutate(current));
        assert!(!r.can_mutate(original));
    }

    #[test]
    fn isolated_512_characters_handoff_without_cross_zone_mutations() {
        let mut r = ZoneLeaseRegistry::new();
        let mut leases = Vec::new();
        for i in 1..=512_u128 {
            leases.push(
                r.register(character(i), worker(1), zone(1))
                    .expect("register"),
            );
        }
        for (i, original) in leases.iter().copied().enumerate() {
            if i % 2 == 0 {
                let ticket = r
                    .prepare(original, worker(2), zone(2), op(i as u128 + 1))
                    .expect("prepare");
                assert!(!r.can_mutate(original));
                let next = r.commit(ticket).expect("handoff");
                assert!(r.can_mutate(next));
            }
        }
        for (i, original) in leases.iter().copied().enumerate() {
            assert_eq!(r.can_mutate(original), i % 2 == 1);
        }
        assert_eq!(r.slots.len(), 512);
    }

    #[test]
    fn concurrent_contenders_serialized_by_one_registry_have_one_winner() {
        let registry = Arc::new(Mutex::new(ZoneLeaseRegistry::new()));
        let first = registry
            .lock()
            .expect("registry")
            .register(item(1), worker(1), zone(1))
            .expect("register");
        let gate = Arc::new(Barrier::new(3));
        let mut handles = Vec::new();
        for (n, target) in [(10_u128, worker(2)), (20, worker(3))] {
            let registry = Arc::clone(&registry);
            let gate = Arc::clone(&gate);
            handles.push(std::thread::spawn(move || {
                gate.wait();
                registry
                    .lock()
                    .expect("lock")
                    .prepare(first, target, zone(2), op(n))
            }));
        }
        gate.wait();
        let successes = handles
            .into_iter()
            .map(|handle| handle.join().expect("worker"))
            .filter(Result::is_ok)
            .count();
        assert_eq!(successes, 1);
        assert!(!registry.lock().expect("registry").can_mutate(first));
    }
}
