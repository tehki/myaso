//! Isolated, non-activated mapping of server connection incarnations to
//! durable characters. NOT an account authenticator or persistent store.
//!
//! The admission service must mint SessionLease from server-owned connection
//! state after verifying the character; never parse it from client packets.
//! The epoch must increase whenever a numeric session ID is reused.
use std::collections::BTreeMap;
use std::num::{NonZeroU32, NonZeroU64};

/// Stable character ID supplied by a trusted account authority, not a name.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct CharacterId(NonZeroU64);

impl CharacterId {
    pub const fn new(raw: u64) -> Option<Self> {
        match NonZeroU64::new(raw) {
            Some(value) => Some(Self(value)),
            None => None,
        }
    }

    pub const fn get(self) -> u64 {
        self.0.get()
    }
}

/// A specific server-issued session incarnation. Two connections may reuse a
/// numeric fighter ID, but never its epoch. This blocks stale disconnects
/// and stale lookups from taking over the new connection's character.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct SessionLease {
    server_session: NonZeroU32,
    epoch: NonZeroU64,
}

impl SessionLease {
    pub const fn new(server_session: u32, epoch: u64) -> Option<Self> {
        match (NonZeroU32::new(server_session), NonZeroU64::new(epoch)) {
            (Some(server_session), Some(epoch)) => Some(Self {
                server_session,
                epoch,
            }),
            _ => None,
        }
    }

    pub const fn server_session(self) -> u32 {
        self.server_session.get()
    }

    pub const fn epoch(self) -> u64 {
        self.epoch.get()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdentityError {
    SessionAlreadyBound,
    CharacterAlreadyActive,
    StaleLease,
}

/// Fail-closed, in-memory active-session registry. The trusted admission
/// layer serializes mutations, verifies accounts and mints unique leases.
/// This module cannot prevent takeover if that caller lies about identity.
#[derive(Debug, Default)]
pub struct SessionIdentityRegistry {
    by_session: BTreeMap<u32, (SessionLease, CharacterId)>,
    by_character: BTreeMap<CharacterId, SessionLease>,
    highest_epoch: BTreeMap<u32, u64>,
}

impl SessionIdentityRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Bind only an independently verified character and server-owned lease.
    /// Failed attempts leave all maps unchanged.
    pub fn bind_verified(
        &mut self,
        lease: SessionLease,
        character: CharacterId,
    ) -> Result<(), IdentityError> {
        let session = lease.server_session();
        if self.by_session.contains_key(&session) {
            return Err(IdentityError::SessionAlreadyBound);
        }
        if self.by_character.contains_key(&character) {
            return Err(IdentityError::CharacterAlreadyActive);
        }
        if self
            .highest_epoch
            .get(&session)
            .is_some_and(|epoch| lease.epoch() <= *epoch)
        {
            return Err(IdentityError::StaleLease);
        }
        self.by_session.insert(session, (lease, character));
        self.by_character.insert(character, lease);
        self.highest_epoch.insert(session, lease.epoch());
        Ok(())
    }

    /// Only the current, exact server-issued lease resolves to the character.
    pub fn resolve_session(&self, lease: SessionLease) -> Option<CharacterId> {
        self.by_session
            .get(&lease.server_session())
            .and_then(|(active, character)| (*active == lease).then_some(*character))
    }

    pub fn active_session(&self, character: CharacterId) -> Option<SessionLease> {
        self.by_character.get(&character).copied()
    }

    /// Server-controlled verified disconnect. An old connection cannot
    /// release a newer binding even when the numeric session ID was reused.
    pub fn release_session(&mut self, lease: SessionLease) -> Option<CharacterId> {
        let character = self.resolve_session(lease)?;
        self.by_session.remove(&lease.server_session());
        self.by_character.remove(&character);
        Some(character)
    }

    pub fn active_count(&self) -> usize {
        self.by_session.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn character(id: u64) -> CharacterId {
        CharacterId::new(id).unwrap()
    }

    fn lease(id: u32, epoch: u64) -> SessionLease {
        SessionLease::new(id, epoch).unwrap()
    }

    #[test]
    fn character_id_and_session_lease_have_distinct_identity() {
        assert_eq!(CharacterId::new(0), None);
        assert_eq!(SessionLease::new(0, 1), None);
        assert_eq!(SessionLease::new(1, 0), None);
        assert_eq!(character(55).get(), 55);
        assert_eq!(lease(100, 4).server_session(), 100);
        assert_eq!(lease(100, 4).epoch(), 4);
        let mut registry = SessionIdentityRegistry::new();
        registry.bind_verified(lease(100, 4), character(55)).unwrap();
        registry.bind_verified(lease(200, 1), character(66)).unwrap();
        assert_eq!(registry.resolve_session(lease(100, 4)), Some(character(55)));
        assert_eq!(registry.resolve_session(lease(100, 3)), None);
        assert_eq!(registry.active_session(character(66)), Some(lease(200, 1)));
        assert_eq!(registry.active_count(), 2);
    }

    #[test]
    fn duplicate_character_and_session_claims_fail_without_state_change() {
        let mut registry = SessionIdentityRegistry::new();
        registry.bind_verified(lease(1, 1), character(10)).unwrap();
        assert_eq!(
            registry.bind_verified(lease(2, 1), character(10)),
            Err(IdentityError::CharacterAlreadyActive)
        );
        assert_eq!(
            registry.bind_verified(lease(1, 2), character(11)),
            Err(IdentityError::SessionAlreadyBound)
        );
        assert_eq!(registry.active_count(), 1);
        assert_eq!(registry.resolve_session(lease(1, 1)), Some(character(10)));
        assert_eq!(registry.resolve_session(lease(2, 1)), None);
        assert_eq!(registry.active_session(character(11)), None);
    }

    #[test]
    fn stale_disconnect_cannot_evict_reused_numeric_session_id() {
        let mut registry = SessionIdentityRegistry::new();
        let old = lease(100, 1);
        let current = lease(100, 2);
        registry.bind_verified(old, character(500)).unwrap();
        assert_eq!(registry.release_session(old), Some(character(500)));
        registry.bind_verified(current, character(500)).unwrap();
        assert_eq!(registry.release_session(old), None);
        assert_eq!(registry.resolve_session(old), None);
        assert_eq!(registry.resolve_session(current), Some(character(500)));
        assert_eq!(registry.active_session(character(500)), Some(current));
        assert_eq!(registry.active_count(), 1);
    }

    #[test]
    fn replayed_old_lease_cannot_bind_again_after_disconnect() {
        let mut registry = SessionIdentityRegistry::new();
        registry.bind_verified(lease(100, 10), character(10)).unwrap();
        assert_eq!(registry.release_session(lease(100, 10)), Some(character(10)));
        assert_eq!(
            registry.bind_verified(lease(100, 9), character(10)),
            Err(IdentityError::StaleLease)
        );
        assert_eq!(
            registry.bind_verified(lease(100, 10), character(10)),
            Err(IdentityError::StaleLease)
        );
        registry.bind_verified(lease(100, 11), character(10)).unwrap();
        assert_eq!(
            registry.bind_verified(lease(100, 12), character(20)),
            Err(IdentityError::SessionAlreadyBound)
        );
        assert_eq!(registry.release_session(lease(100, 11)), Some(character(10)));
        assert_eq!(registry.active_count(), 0);
    }

    #[test]
    fn wrong_generation_release_does_not_unbind_a_different_character() {
        let mut registry = SessionIdentityRegistry::new();
        registry.bind_verified(lease(99, 7), character(1)).unwrap();
        assert_eq!(registry.release_session(lease(99, 6)), None);
        assert_eq!(registry.release_session(lease(99, 8)), None);
        assert_eq!(registry.active_session(character(1)), Some(lease(99, 7)));
        assert_eq!(registry.release_session(lease(99, 7)), Some(character(1)));
        registry.bind_verified(lease(99, 8), character(2)).unwrap();
        assert_eq!(registry.resolve_session(lease(99, 7)), None);
        assert_eq!(registry.resolve_session(lease(99, 8)), Some(character(2)));
    }
}
