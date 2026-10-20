//! Isolated, non-activated mapping of server sessions to durable characters.
//! This module does NOT authenticate an account or persist inventory.
//! A trusted server admission layer must verify CharacterId independently.
use std::collections::BTreeMap;
use std::num::NonZeroU64;

/// Stable character ID supplied by an external, trusted identity provider.
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdentityError {
    InvalidSession,
    SessionAlreadyBound,
    CharacterAlreadyActive,
}

/// Each live character has at most one server-issued session, and vice versa.
/// Methods must be called by serialized server admission/disconnect handlers,
/// NEVER in response to untrusted client-supplied account or fighter IDs.
#[derive(Debug, Default)]
pub struct SessionIdentityRegistry {
    by_session: BTreeMap<u32, CharacterId>,
    by_character: BTreeMap<CharacterId, u32>,
}

impl SessionIdentityRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Requires proof of identity from a separate authenticated admission
    /// service; the registry does not itself verify a player's identity.
    pub fn bind_verified(
        &mut self,
        server_session: u32,
        character: CharacterId,
    ) -> Result<(), IdentityError> {
        if server_session == 0 {
            return Err(IdentityError::InvalidSession);
        }
        if self.by_session.contains_key(&server_session) {
            return Err(IdentityError::SessionAlreadyBound);
        }
        if self.by_character.contains_key(&character) {
            return Err(IdentityError::CharacterAlreadyActive);
        }
        self.by_session.insert(server_session, character);
        self.by_character.insert(character, server_session);
        Ok(())
    }

    /// Resolve only the authenticated connection's server-issued session ID.
    pub fn resolve_session(&self, server_session: u32) -> Option<CharacterId> {
        self.by_session.get(&server_session).copied()
    }

    pub fn active_session(&self, character: CharacterId) -> Option<u32> {
        self.by_character.get(&character).copied()
    }

    /// Called only after the server verifies that this session has ended.
    /// Clients must not be allowed to evict another player's binding.
    pub fn release_session(&mut self, server_session: u32) -> Option<CharacterId> {
        let character = self.by_session.remove(&server_session)?;
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

    #[test]
    fn identity_is_distinct_from_session_id() {
        assert_eq!(CharacterId::new(0), None);
        assert_eq!(character(55).get(), 55);
        let mut registry = SessionIdentityRegistry::new();
        registry.bind_verified(100, character(55)).unwrap();
        registry.bind_verified(200, character(66)).unwrap();
        assert_eq!(registry.resolve_session(100), Some(character(55)));
        assert_eq!(registry.active_session(character(66)), Some(200));
        assert_eq!(registry.resolve_session(55), None);
        assert_eq!(registry.active_count(), 2);
    }

    #[test]
    fn invalid_and_duplicate_claims_fail_closed() {
        let mut registry = SessionIdentityRegistry::new();
        assert_eq!(
            registry.bind_verified(0, character(10)),
            Err(IdentityError::InvalidSession)
        );
        registry.bind_verified(1, character(10)).unwrap();
        assert_eq!(
            registry.bind_verified(2, character(10)),
            Err(IdentityError::CharacterAlreadyActive)
        );
        assert_eq!(
            registry.bind_verified(1, character(11)),
            Err(IdentityError::SessionAlreadyBound)
        );
        assert_eq!(registry.active_count(), 1);
        assert_eq!(registry.resolve_session(2), None);
        assert_eq!(registry.active_session(character(11)), None);
    }

    #[test]
    fn verified_disconnect_prevents_stale_session_reuse() {
        let mut registry = SessionIdentityRegistry::new();
        registry.bind_verified(100, character(500)).unwrap();
        assert_eq!(registry.release_session(101), None);
        assert_eq!(registry.active_session(character(500)), Some(100));
        assert_eq!(registry.release_session(100), Some(character(500)));
        assert_eq!(registry.release_session(100), None);
        registry.bind_verified(101, character(500)).unwrap();
        assert_eq!(registry.resolve_session(100), None);
        assert_eq!(registry.resolve_session(101), Some(character(500)));
        assert_eq!(registry.active_count(), 1);
    }
}
