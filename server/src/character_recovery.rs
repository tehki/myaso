//! Dormant verified-login recovery ordering. Not wired to any network path.
//!
//! Neither real authentication nor multi-host transactional storage is here.
//! The installed verifier MUST validate signature, expiry, replay and account
//! ownership; never treat a client-provided CharacterId as an authorization.

use crate::{
    character_store::{CharacterRecordStore, CharacterStoreError},
    identity::{CharacterId, LeaseError, SessionLease, SessionLeaseRegistry},
};
use std::num::NonZeroU64;

pub trait TrustedIdentityVerifier {
    type Claim;
    fn verify(&self, claim: &Self::Claim) -> Result<CharacterId, AuthenticationError>;
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AuthenticationError {
    Rejected,
}

/// Internal errors only. Do not expose missing character / corrupt record
/// distinctions to clients; map them to a uniform denied response.
#[derive(Debug)]
pub enum RecoveryError {
    AuthenticationFailed,
    ConnectionAlreadyActive,
    Storage(CharacterStoreError),
    Lease(LeaseError),
}

/// Single-writer coordinator. This cannot prevent another process from
/// modifying the file store and does not yet restore world or inventory state.
pub struct CharacterRecoveryCoordinator<V> {
    verifier: V,
    records: CharacterRecordStore,
    leases: SessionLeaseRegistry,
}

impl<V: TrustedIdentityVerifier> CharacterRecoveryCoordinator<V> {
    pub fn new(verifier: V, records: CharacterRecordStore) -> Self {
        Self {
            verifier,
            records,
            leases: SessionLeaseRegistry::default(),
        }
    }

    /// Authenticate, refuse double-binding, then commit the incremented epoch
    /// to disk BEFORE issuing a connection lease. Storage failures have an
    /// uncertain commit outcome: no lease is issued; retry via fresh login.
    pub fn recover(
        &mut self,
        claim: &V::Claim,
        connection: NonZeroU64,
    ) -> Result<SessionLease, RecoveryError> {
        let id = self
            .verifier
            .verify(claim)
            .map_err(|_| RecoveryError::AuthenticationFailed)?;
        if self.leases.connection_active(connection) {
            return Err(RecoveryError::ConnectionAlreadyActive);
        }
        // No auto-provisioning on login; character must already exist.
        let current = self.records.load(id).map_err(RecoveryError::Storage)?;
        let committed = self
            .records
            .advance_generation(current)
            .map_err(RecoveryError::Storage)?;
        self.leases
            .activate_committed(committed, connection)
            .map_err(RecoveryError::Lease)
    }

    /// Every future gameplay mutation must check this lease. The live server
    /// is NOT connected to this coordinator by this change.
    pub fn is_current(&self, lease: SessionLease) -> bool {
        self.leases.is_current(lease)
    }

    pub fn disconnect(&mut self, lease: SessionLease) -> bool {
        self.leases.release(lease)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        path::PathBuf,
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };
    static TEST_ID: AtomicU64 = AtomicU64::new(0);

    struct Root(PathBuf);
    impl Root {
        fn new() -> Self {
            let n = TEST_ID.fetch_add(1, Ordering::Relaxed);
            let t = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos();
            let dir = std::env::temp_dir().join(format!("myaso-c2c-{}-{t}-{n}", std::process::id()));
            fs::create_dir(&dir).expect("create test directory");
            Self(dir)
        }
        fn store(&self) -> CharacterRecordStore {
            CharacterRecordStore::open(&self.0).expect("store")
        }
        fn provision(&self, n: u128) {
            self.store()
                .create(CharacterId::new(n).expect("nonzero"))
                .expect("provision");
        }
        fn generation(&self, n: u128) -> u64 {
            self.store()
                .load(CharacterId::new(n).expect("nonzero"))
                .expect("load")
                .session_generation
        }
    }
    impl Drop for Root {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    enum Claim {
        First,
        Second,
        Denied,
        Missing,
    }
    struct TestVerifier;
    impl TrustedIdentityVerifier for TestVerifier {
        type Claim = Claim;
        fn verify(&self, claim: &Claim) -> Result<CharacterId, AuthenticationError> {
            let id = match claim {
                Claim::First => 10,
                Claim::Second => 20,
                Claim::Missing => 30,
                Claim::Denied => return Err(AuthenticationError::Rejected),
            };
            Ok(CharacterId::new(id).expect("known"))
        }
    }
    fn conn(n: u64) -> NonZeroU64 {
        NonZeroU64::new(n).expect("nonzero")
    }

    #[test]
    fn verified_takeover_fences_old_input_and_delayed_disconnect() {
        let root = Root::new();
        root.provision(10);
        let mut coordinator = CharacterRecoveryCoordinator::new(TestVerifier, root.store());
        let old = coordinator.recover(&Claim::First, conn(1)).expect("login");
        assert_eq!(root.generation(10), 1);
        assert!(coordinator.is_current(old));
        let new = coordinator.recover(&Claim::First, conn(2)).expect("takeover");
        assert_eq!(root.generation(10), 2);
        assert_eq!(new.generation(), 2);
        assert!(!coordinator.is_current(old));
        assert!(!coordinator.disconnect(old));
        assert!(coordinator.is_current(new));
        assert!(coordinator.disconnect(new));
        assert!(!coordinator.is_current(new));
    }

    #[test]
    fn rejected_and_missing_login_never_auto_provision() {
        let root = Root::new();
        root.provision(10);
        let mut coordinator = CharacterRecoveryCoordinator::new(TestVerifier, root.store());
        assert!(matches!(
            coordinator.recover(&Claim::Denied, conn(3)),
            Err(RecoveryError::AuthenticationFailed)
        ));
        assert!(matches!(
            coordinator.recover(&Claim::Missing, conn(4)),
            Err(RecoveryError::Storage(CharacterStoreError::Missing))
        ));
        assert_eq!(root.generation(10), 0);
    }

    #[test]
    fn second_character_cannot_reuse_a_live_connection_or_spend_epoch() {
        let root = Root::new();
        root.provision(10);
        root.provision(20);
        let mut coordinator = CharacterRecoveryCoordinator::new(TestVerifier, root.store());
        let lease = coordinator.recover(&Claim::First, conn(5)).expect("first");
        assert!(matches!(
            coordinator.recover(&Claim::Second, conn(5)),
            Err(RecoveryError::ConnectionAlreadyActive)
        ));
        assert_eq!(root.generation(20), 0);
        assert!(coordinator.is_current(lease));
    }

    #[test]
    fn restart_requires_a_fresh_epoch_and_rejects_prior_lease() {
        let root = Root::new();
        root.provision(10);
        let old = CharacterRecoveryCoordinator::new(TestVerifier, root.store())
            .recover(&Claim::First, conn(6))
            .expect("login");
        let mut after = CharacterRecoveryCoordinator::new(TestVerifier, root.store());
        let new = after.recover(&Claim::First, conn(7)).expect("restart login");
        assert_eq!(root.generation(10), 2);
        assert_eq!(new.generation(), 2);
        assert!(!after.is_current(old));
        assert!(!after.disconnect(old));
        assert!(after.is_current(new));
    }

    #[test]
    fn crash_after_commit_but_before_activation_spends_epoch_safely() {
        let root = Root::new();
        root.provision(10);
        let mut store = root.store();
        let id = CharacterId::new(10).expect("id");
        let original = store.load(id).expect("load");
        let committed = store
            .advance_generation(original)
            .expect("simulated pre-activation commit");
        assert_eq!(committed.session_generation, 1);
        let mut coordinator = CharacterRecoveryCoordinator::new(TestVerifier, root.store());
        let lease = coordinator.recover(&Claim::First, conn(8)).expect("retry verified");
        assert_eq!(lease.generation(), 2);
        assert!(coordinator.is_current(lease));
    }

    #[test]
    fn corrupt_disk_record_never_activates_a_session() {
        let root = Root::new();
        root.provision(10);
        let filename = format!("{:032x}.mych", 10_u128);
        fs::write(root.0.join(filename), [0_u8; 3]).expect("corrupt");
        let mut coordinator = CharacterRecoveryCoordinator::new(TestVerifier, root.store());
        assert!(matches!(
            coordinator.recover(&Claim::First, conn(9)),
            Err(RecoveryError::Storage(CharacterStoreError::InvalidRecord(_)))
        ));
    }
}
