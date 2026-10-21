//! Dormant Core8B → IDR P0 canonical actor adapter.
//!
//! Every SubjectId is derived losslessly from the SAME authenticated Core
//! CharacterId, never a reused net slot, item ID, appearance ID, or client
//! chosen subject. Only a current Core session lease may speak as a player.
//! No live packet, evidence verification, DB schema, checkpoint or writer is
//! introduced. NPC IDs must be reserved by the trusted server actor factory.

use std::collections::BTreeMap;

use crate::{
    identity::{CharacterId, SessionLease, SessionLeaseRegistry},
    identity_disguise::{
        IdentityError, IdentityRegistry, ObservedIdentity, PrivateController, SubjectId,
    },
};

/// No truncation, hashing, tag-dependent remapping, or network ID alias:
/// both canonical domains use nonzero, full-width u128 in Core 8B.
pub fn subject_for_authenticated_canonical_character(character: CharacterId) -> SubjectId {
    SubjectId::new(character.get()).expect("Core CharacterId is always nonzero")
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum PrivateCanonicalActor {
    Player { last_generation: u64 },
    Sentinel,
}

/// This adapter deliberately returns NO actor-controller kind, canonical ID,
/// session generation or true-name audit field in any observer projection.
#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub enum CanonicalIdrError {
    NotCurrentCanonicalLease,
    UnknownCanonicalActor,
    DuplicateCanonicalActor,
    ActorIsNotAuthenticatedPlayer,
    StaleCanonicalGeneration,
    DormantIdr(IdentityError),
}

#[derive(Default)]
pub struct CanonicalIdrBridge {
    subjects: IdentityRegistry,
    canonical: BTreeMap<CharacterId, PrivateCanonicalActor>,
}

impl CanonicalIdrBridge {
    /// The caller has already committed a trusted Core CharacterRecord and
    /// activated its generation in SessionLeaseRegistry. The adapter checks
    /// the exact canonical CharacterId/current lease again; it DOES NOT
    /// authenticate account credentials or accept raw browser net IDs.
    pub fn register_authenticated_player(
        &mut self,
        character: CharacterId,
        lease: SessionLease,
        leases: &SessionLeaseRegistry,
        private_true_name: &str,
        appearance: &str,
    ) -> Result<(), CanonicalIdrError> {
        if lease.character_id() != character || !leases.is_current(lease) {
            return Err(CanonicalIdrError::NotCurrentCanonicalLease);
        }
        if self.canonical.contains_key(&character) {
            return Err(CanonicalIdrError::DuplicateCanonicalActor);
        }
        self.subjects
            .register(
                subject_for_authenticated_canonical_character(character),
                private_true_name,
                PrivateController::Human,
                appearance,
            )
            .map_err(CanonicalIdrError::DormantIdr)?;
        self.canonical.insert(
            character,
            PrivateCanonicalActor::Player {
                last_generation: lease.generation(),
            },
        );
        Ok(())
    }

    /// For trusted NPC actor factories, NOT any browser/message handler.
    /// Sentinels and humans occupy ONE collision-resistant CharacterId domain
    /// but have no public controller-kind bit; reuse/collision is forbidden.
    pub fn register_trusted_sentinel(
        &mut self,
        canonical_actor: CharacterId,
        private_true_name: &str,
        appearance: &str,
    ) -> Result<(), CanonicalIdrError> {
        if self.canonical.contains_key(&canonical_actor) {
            return Err(CanonicalIdrError::DuplicateCanonicalActor);
        }
        self.subjects
            .register(
                subject_for_authenticated_canonical_character(canonical_actor),
                private_true_name,
                PrivateController::Sentinel,
                appearance,
            )
            .map_err(CanonicalIdrError::DormantIdr)?;
        self.canonical
            .insert(canonical_actor, PrivateCanonicalActor::Sentinel);
        Ok(())
    }

    /// Reconnection reuses the permanent canonical identity, never the
    /// temporary connection/packet slot. A newer committed session generation
    /// is mandatory for a changed lease, and prior leases lose authority.
    pub fn resume_authenticated_player(
        &mut self,
        character: CharacterId,
        lease: SessionLease,
        leases: &SessionLeaseRegistry,
    ) -> Result<(), CanonicalIdrError> {
        if lease.character_id() != character || !leases.is_current(lease) {
            return Err(CanonicalIdrError::NotCurrentCanonicalLease);
        }
        let actor = self
            .canonical
            .get_mut(&character)
            .ok_or(CanonicalIdrError::UnknownCanonicalActor)?;
        match actor {
            PrivateCanonicalActor::Player { last_generation } => {
                if lease.generation() <= *last_generation {
                    return Err(CanonicalIdrError::StaleCanonicalGeneration);
                }
                *last_generation = lease.generation();
                Ok(())
            }
            PrivateCanonicalActor::Sentinel => {
                Err(CanonicalIdrError::ActorIsNotAuthenticatedPlayer)
            }
        }
    }

    fn require_current_player(
        &self,
        canonical: CharacterId,
        lease: SessionLease,
        leases: &SessionLeaseRegistry,
    ) -> Result<(), CanonicalIdrError> {
        if lease.character_id() != canonical || !leases.is_current(lease) {
            return Err(CanonicalIdrError::NotCurrentCanonicalLease);
        }
        match self.canonical.get(&canonical) {
            Some(PrivateCanonicalActor::Player { last_generation })
                if *last_generation == lease.generation() =>
            {
                Ok(())
            }
            Some(PrivateCanonicalActor::Player { .. }) => {
                Err(CanonicalIdrError::StaleCanonicalGeneration)
            }
            Some(PrivateCanonicalActor::Sentinel) => {
                Err(CanonicalIdrError::ActorIsNotAuthenticatedPlayer)
            }
            None => Err(CanonicalIdrError::UnknownCanonicalActor),
        }
    }

    /// Offline-only typed claim preflight for the dormant MYID WAL.
    /// Requires the CURRENT authenticated canonical lease and a known
    /// recipient. The named claim is NEVER verified evidence. The World/LOS
    /// recipient check is a missing future trusted-server integration gate.
    pub(crate) fn preflight_offline_unverified_claim(
        &self,
        speaker: CharacterId,
        lease: SessionLease,
        leases: &SessionLeaseRegistry,
        observer: CharacterId,
        claimed_name: &str,
    ) -> Result<u64, CanonicalIdrError> {
        self.require_current_player(speaker, lease, leases)?;
        if !self.canonical.contains_key(&observer) {
            return Err(CanonicalIdrError::UnknownCanonicalActor);
        }
        if speaker == observer || !crate::identity_disguise::valid_name(claimed_name) {
            return Err(CanonicalIdrError::DormantIdr(
                crate::identity_disguise::IdentityError::InvalidName,
            ));
        }
        // Read only the *subject's* server-owned presentation epoch. A
        // caller cannot choose a future epoch and invalidate every previous
        // observer's knowledge before any actual appearance transition.
        self.subjects
            .observe(
                subject_for_authenticated_canonical_character(observer),
                subject_for_authenticated_canonical_character(speaker),
            )
            .map(|view| view.presentation_epoch)
            .map_err(CanonicalIdrError::DormantIdr)
    }

    /// Test ONLY: emulate a transition that will require actual trusted
    /// World8C+Physics validated witnesses and a durable appearance event.
    /// This cannot be compiled into the production server.
    #[cfg(test)]
    pub(crate) fn advance_server_appearance_for_claim_journal_test(
        &mut self,
        canonical: CharacterId,
    ) -> Result<(), CanonicalIdrError> {
        self.subjects
            .change_appearance(
                subject_for_authenticated_canonical_character(canonical),
                "different-appearance",
                true,
                &[],
            )
            .map_err(CanonicalIdrError::DormantIdr)
    }

    /// Optional verbal self-introduction: a player may lie, and no observer
    /// becomes Verified. LOS/recipient selection remain trusted 8C duties.
    pub fn propose_unverified_introduction(
        &mut self,
        speaker: CharacterId,
        lease: SessionLease,
        leases: &SessionLeaseRegistry,
        listener: CharacterId,
        claimed_name: &str,
    ) -> Result<(), CanonicalIdrError> {
        self.require_current_player(speaker, lease, leases)?;
        if !self.canonical.contains_key(&listener) {
            return Err(CanonicalIdrError::UnknownCanonicalActor);
        }
        self.subjects
            .introduce(
                subject_for_authenticated_canonical_character(speaker),
                subject_for_authenticated_canonical_character(listener),
                claimed_name,
            )
            .map_err(CanonicalIdrError::DormantIdr)
    }

    /// Viewer-bound in-memory presentation ONLY: true controller, canonical
    /// identity and authentication material never enter ObservedIdentity.
    /// There is no server-validated 8C perception/LOS or signed 8A wire yet.
    pub fn observe_for_current_player(
        &self,
        viewer: CharacterId,
        lease: SessionLease,
        leases: &SessionLeaseRegistry,
        target: CharacterId,
    ) -> Result<ObservedIdentity, CanonicalIdrError> {
        self.require_current_player(viewer, lease, leases)?;
        if !self.canonical.contains_key(&target) {
            return Err(CanonicalIdrError::UnknownCanonicalActor);
        }
        self.subjects
            .observe(
                subject_for_authenticated_canonical_character(viewer),
                subject_for_authenticated_canonical_character(target),
            )
            .map_err(CanonicalIdrError::DormantIdr)
    }

    /// Tombstoning a canonical character removes every observation both OF
    /// and BY that subject. Recovery must preserve tombstone/high-water state
    /// across restart before any new actor can re-register this raw ID.
    pub fn tombstone_canonical_actor(&mut self, character: CharacterId) {
        self.canonical.remove(&character);
        self.subjects
            .remove(subject_for_authenticated_canonical_character(character));
    }

    // Intentional NON-API: no function accepts client "verified evidence",
    // client controller type, arbitrary SubjectId, or raw connection ID.
    // Trusted evidence must be persisted/validated before a future method
    // may call IdentityRegistry::verified_evidence.
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        identity::{CharacterRecord, SessionLeaseRegistry},
        identity_disguise::{Certainty, UNKNOWN_LABEL},
    };
    use std::num::NonZeroU64;

    fn id(n: u128) -> CharacterId {
        CharacterId::new(n).unwrap()
    }

    // Test-only fixture: in real use the committed CharacterRecord MUST have
    // been fsynced by Core authentication's canonical persistence authority.
    fn activate(
        registry: &mut SessionLeaseRegistry,
        actor: CharacterId,
        generation: u64,
        connection: u64,
    ) -> SessionLease {
        registry
            .activate_committed(
                CharacterRecord {
                    character_id: actor,
                    session_generation: generation,
                },
                NonZeroU64::new(connection).unwrap(),
            )
            .unwrap()
    }

    #[test]
    fn canonical_subject_is_same_nonzero_u128_not_network_id_or_truncated_alias() {
        let actor = id(0xfeed_0123_4567_89ab_cdef_0112_2233_4455);
        assert_eq!(
            subject_for_authenticated_canonical_character(actor),
            SubjectId::new(actor.get()).unwrap()
        );
        assert_ne!(
            subject_for_authenticated_canonical_character(actor),
            SubjectId::new(7).unwrap()
        );
    }

    #[test]
    fn false_claim_from_current_player_only_reaches_selected_observer_and_never_verifies() {
        let alice = id(0x0001_u128 << 64 | 88);
        let guard = id(0x0002_u128 << 64 | 88);
        let other = id(0x0003_u128 << 64 | 88);
        let nonwitness = id(0x0004_u128 << 64 | 88);
        let mut leases = SessionLeaseRegistry::default();
        let la = activate(&mut leases, alice, 1, 5);
        let lo = activate(&mut leases, other, 1, 6);
        let ln = activate(&mut leases, nonwitness, 1, 9);
        let mut bridge = CanonicalIdrBridge::default();
        bridge
            .register_authenticated_player(alice, la, &leases, "Aldric", "hooded-figure")
            .unwrap();
        bridge
            .register_authenticated_player(other, lo, &leases, "Elara", "hooded-figure")
            .unwrap();
        bridge
            .register_authenticated_player(nonwitness, ln, &leases, "Yara", "hooded-figure")
            .unwrap();
        bridge
            .register_trusted_sentinel(guard, "Sentinel", "hooded-figure")
            .unwrap();
        assert_eq!(
            bridge
                .observe_for_current_player(other, lo, &leases, alice)
                .unwrap()
                .certainty,
            Certainty::Unknown
        );
        bridge
            .propose_unverified_introduction(alice, la, &leases, other, "Tomas")
            .unwrap();
        let view = bridge
            .observe_for_current_player(other, lo, &leases, alice)
            .unwrap();
        assert_eq!(view.label, "Calls themselves Tomas");
        assert_eq!(view.certainty, Certainty::Claimed);
        let unrelated_view = bridge
            .observe_for_current_player(nonwitness, ln, &leases, alice)
            .unwrap();
        assert_eq!(unrelated_view.label, UNKNOWN_LABEL);
        assert_eq!(unrelated_view.certainty, Certainty::Unknown);
        let sentinel = bridge
            .observe_for_current_player(other, lo, &leases, guard)
            .unwrap();
        assert_eq!(sentinel.label, UNKNOWN_LABEL);
        assert_eq!(sentinel.certainty, Certainty::Unknown);
        assert_eq!(sentinel.appearance, "hooded-figure");
        assert_eq!(
            bridge.register_trusted_sentinel(alice, "Counterfeit", "hooded-figure"),
            Err(CanonicalIdrError::DuplicateCanonicalActor)
        );
    }

    #[test]
    fn stale_previous_lease_and_reused_connection_id_never_claim_reconnected_actor() {
        let alice = id(88);
        let other = id(99);
        let mut leases = SessionLeaseRegistry::default();
        let lease1 = activate(&mut leases, alice, 1, 7);
        let mut bridge = CanonicalIdrBridge::default();
        bridge
            .register_authenticated_player(alice, lease1, &leases, "Aldric", "hooded-figure")
            .unwrap();
        bridge
            .register_trusted_sentinel(other, "Sentinel", "hooded-figure")
            .unwrap();
        let lease2 = activate(&mut leases, alice, 2, 8);
        assert!(!leases.is_current(lease1));
        assert_eq!(
            bridge.propose_unverified_introduction(alice, lease1, &leases, other, "Aldric"),
            Err(CanonicalIdrError::NotCurrentCanonicalLease)
        );
        assert_eq!(
            bridge.observe_for_current_player(alice, lease2, &leases, other),
            Err(CanonicalIdrError::StaleCanonicalGeneration)
        );
        bridge
            .resume_authenticated_player(alice, lease2, &leases)
            .unwrap();
        assert_eq!(
            bridge.resume_authenticated_player(alice, lease1, &leases),
            Err(CanonicalIdrError::NotCurrentCanonicalLease)
        );
        assert_eq!(
            bridge
                .observe_for_current_player(alice, lease2, &leases, other)
                .unwrap()
                .certainty,
            Certainty::Unknown
        );
        assert!(leases.release(lease2));
        let next = activate(&mut leases, id(77), 1, 8);
        assert_eq!(next.character_id(), id(77));
        assert_eq!(
            bridge.observe_for_current_player(alice, lease2, &leases, other),
            Err(CanonicalIdrError::NotCurrentCanonicalLease)
        );
        assert_eq!(
            bridge.observe_for_current_player(alice, next, &leases, other),
            Err(CanonicalIdrError::NotCurrentCanonicalLease),
            "reused net connection must never inherit Alice canonical subject"
        );
    }

    #[test]
    fn tombstoned_character_loses_identity_and_all_observer_knowledge() {
        let alice = id(88);
        let bob = id(99);
        let mut leases = SessionLeaseRegistry::default();
        let la = activate(&mut leases, alice, 1, 11);
        let lb = activate(&mut leases, bob, 1, 12);
        let mut bridge = CanonicalIdrBridge::default();
        bridge
            .register_authenticated_player(alice, la, &leases, "Aldric", "hooded-figure")
            .unwrap();
        bridge
            .register_authenticated_player(bob, lb, &leases, "Elara", "hooded-figure")
            .unwrap();
        bridge
            .propose_unverified_introduction(alice, la, &leases, bob, "Fake Name")
            .unwrap();
        bridge.tombstone_canonical_actor(alice);
        assert_eq!(
            bridge.observe_for_current_player(bob, lb, &leases, alice),
            Err(CanonicalIdrError::UnknownCanonicalActor)
        );
        // Registering a replacement ID in this in-memory dormant fixture
        // intentionally does not prove durable tombstone anti-resurrection.
        let newer = activate(&mut leases, alice, 2, 13);
        bridge
            .register_authenticated_player(alice, newer, &leases, "New Person", "hooded-figure")
            .unwrap();
        let view = bridge
            .observe_for_current_player(bob, lb, &leases, alice)
            .unwrap();
        assert_eq!(view.certainty, Certainty::Unknown);
        assert_eq!(view.label, UNKNOWN_LABEL);
    }
}
