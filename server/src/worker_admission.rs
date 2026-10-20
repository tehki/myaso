//! C4f dormant admission boundary: derive a worker from a server-authenticated
//! transport session, then compare it with an authoritative zone snapshot.
//!
//! This does NOT authenticate remote peers, contact PostgreSQL, or grant writes.
//! Both sources must be independently trusted server implementations.
//! A read-only snapshot may become stale immediately: the SAME-PG-TRANSACTION
//! row lock and epoch/revision checks in C4d remain the final mutation fence.

use crate::{
    world_mutation_contract::{
        TrustedWorkerVerifier, VerifiedWorldAuthority, WorldMutationContractError,
    },
    zone_lease::{OwnedEntity, WorkerId, ZoneKey},
};
use std::num::NonZeroU64;

/// The handle MUST come from the live, authenticated 8A transport session.
/// It is never a client-controlled worker ID, username, or connection string.
#[derive(Debug)]
pub struct WorkerAdmissionClaim<Connection> {
    connection: Connection,
    entity: OwnedEntity,
    zone: ZoneKey,
    epoch: NonZeroU64,
    session_generation: NonZeroU64,
}

impl<Connection> WorkerAdmissionClaim<Connection> {
    pub fn from_server_session(
        connection: Connection,
        entity: OwnedEntity,
        zone: ZoneKey,
        epoch: NonZeroU64,
        session_generation: NonZeroU64,
    ) -> Self {
        Self {
            connection,
            entity,
            zone,
            epoch,
            session_generation,
        }
    }
}

/// Implemented by the trusted transport/auth infrastructure (Core 8A/8B).
/// Its output is derived from the *actual* authenticated live connection.
/// The backend MUST reject revoked sessions, stale generations, and entities
/// that connection has not been admitted to mutate. No default is provided.
pub trait AuthenticatedWorkerSessions {
    type Connection;

    fn authorized_worker_for_entity(
        &self,
        connection: &Self::Connection,
        entity: OwnedEntity,
        session_generation: NonZeroU64,
    ) -> Result<WorkerId, WorldMutationContractError>;
}

/// A read-only view of trusted durable entity authority. Not a write permit.
/// The service must NOT accept an unauthenticated worker/epoch as a lookup key.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct EntityAuthoritySnapshot {
    pub worker: WorkerId,
    pub zone: ZoneKey,
    pub epoch: NonZeroU64,
    pub frozen: bool,
    pub retired: bool,
}

/// Implemented by the authoritative storage adapter (Core 8B/8C).
/// Database outages, ambiguous recovery or unverifiable state MUST return Err.
pub trait AuthoritativeZoneReader {
    fn snapshot(
        &self,
        entity: OwnedEntity,
    ) -> Result<Option<EntityAuthoritySnapshot>, WorldMutationContractError>;
}

/// Server-side admission only. This verifier never authorizes a mutation
/// independently of the C4d transactional PostgreSQL function.
pub struct WorkerAdmissionVerifier<S, R> {
    sessions: S,
    authority: R,
}

impl<S, R> WorkerAdmissionVerifier<S, R> {
    pub fn new(sessions: S, authority: R) -> Self {
        Self {
            sessions,
            authority,
        }
    }
}

impl<S, R> TrustedWorkerVerifier for WorkerAdmissionVerifier<S, R>
where
    S: AuthenticatedWorkerSessions,
    R: AuthoritativeZoneReader,
{
    type Claim = WorkerAdmissionClaim<S::Connection>;

    fn verify_worker(
        &self,
        claim: &Self::Claim,
    ) -> Result<VerifiedWorldAuthority, WorldMutationContractError> {
        // This backend looks up the session and entity admission. The claim
        // itself does not contain a claimed worker identity.
        let worker = self.sessions.authorized_worker_for_entity(
            &claim.connection,
            claim.entity,
            claim.session_generation,
        )?;
        let snapshot = self
            .authority
            .snapshot(claim.entity)?
            .ok_or(WorldMutationContractError::UntrustedRequest)?;

        if snapshot.retired
            || snapshot.frozen
            || snapshot.worker != worker
            || snapshot.zone != claim.zone
            || snapshot.epoch != claim.epoch
        {
            return Err(WorldMutationContractError::UntrustedRequest);
        }

        Ok(VerifiedWorldAuthority::from_admitted_authority(
            claim.entity,
            worker,
            snapshot.zone,
            snapshot.epoch,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        identity::CharacterId,
        world_mutation_contract::WorldMutationCommand,
    };
    use std::{collections::BTreeMap, num::NonZeroU128};

    fn worker(id: u64) -> WorkerId {
        WorkerId::new(id).unwrap()
    }
    fn zone(id: u64) -> ZoneKey {
        ZoneKey::new(id).unwrap()
    }
    fn nz(id: u64) -> NonZeroU64 {
        NonZeroU64::new(id).unwrap()
    }
    fn entity() -> OwnedEntity {
        OwnedEntity::Character(CharacterId::new(101).unwrap())
    }

    /// Only a transport backend may map handles to authenticated identity,
    /// allowed entity, current session generation and revocation status.
    struct Sessions {
        by_handle: BTreeMap<u64, (WorkerId, OwnedEntity, NonZeroU64, bool)>,
    }
    impl AuthenticatedWorkerSessions for Sessions {
        type Connection = u64;
        fn authorized_worker_for_entity(
            &self,
            connection: &u64,
            requested: OwnedEntity,
            generation: NonZeroU64,
        ) -> Result<WorkerId, WorldMutationContractError> {
            match self.by_handle.get(connection) {
                Some((worker, allowed_entity, current_generation, false))
                    if *allowed_entity == requested && *current_generation == generation =>
                {
                    Ok(*worker)
                }
                _ => Err(WorldMutationContractError::UntrustedRequest),
            }
        }
    }
    struct Authority {
        current: Option<EntityAuthoritySnapshot>,
        available: bool,
    }
    impl AuthoritativeZoneReader for Authority {
        fn snapshot(
            &self,
            _entity: OwnedEntity,
        ) -> Result<Option<EntityAuthoritySnapshot>, WorldMutationContractError> {
            if !self.available {
                return Err(WorldMutationContractError::UntrustedRequest);
            }
            Ok(self.current)
        }
    }
    fn rig() -> (WorkerAdmissionVerifier<Sessions, Authority>, WorkerAdmissionClaim<u64>) {
        let mut by_handle = BTreeMap::new();
        by_handle.insert(21, (worker(5), entity(), nz(8), false));
        by_handle.insert(22, (worker(6), entity(), nz(8), false));
        by_handle.insert(23, (worker(5), entity(), nz(9), true));
        let auth = Authority {
            current: Some(EntityAuthoritySnapshot {
                worker: worker(5),
                zone: zone(7),
                epoch: nz(11),
                frozen: false,
                retired: false,
            }),
            available: true,
        };
        (
            WorkerAdmissionVerifier::new(Sessions { by_handle }, auth),
            WorkerAdmissionClaim::from_server_session(21, entity(), zone(7), nz(11), nz(8)),
        )
    }
    fn mutate(
        verifier: &WorkerAdmissionVerifier<Sessions, Authority>,
        claim: &WorkerAdmissionClaim<u64>,
    ) -> Result<WorldMutationCommand, WorldMutationContractError> {
        WorldMutationCommand::admit(
            verifier,
            claim,
            NonZeroU128::new(600).unwrap(),
            4,
            b"world state",
        )
    }

    #[test]
    fn live_authenticated_owner_is_bound_to_canonical_sql_command() {
        let (verifier, claim) = rig();
        let command = mutate(&verifier, &claim).unwrap();
        let bind = command.bind();
        assert_eq!(bind.worker, 5);
        assert_eq!(bind.zone, 7);
        assert_eq!(bind.epoch, 11);
        assert_eq!(bind.expected_revision, 4);
        assert_eq!(bind.entity_kind, 1);
        assert_eq!(bind.entity_id[15], 101);
    }

    #[test]
    fn different_authenticated_worker_cannot_spoof_owner() {
        let (verifier, mut claim) = rig();
        claim.connection = 22;
        assert!(matches!(
            mutate(&verifier, &claim),
            Err(WorldMutationContractError::UntrustedRequest)
        ));
    }

    #[test]
    fn missing_revoked_and_expired_sessions_fail_closed() {
        let (verifier, mut claim) = rig();
        for connection in [999, 23] {
            claim.connection = connection;
            assert!(mutate(&verifier, &claim).is_err());
        }
        claim.connection = 21;
        claim.session_generation = nz(7);
        assert!(mutate(&verifier, &claim).is_err());
    }

    #[test]
    fn session_must_be_admitted_to_requested_entity() {
        let (verifier, mut claim) = rig();
        claim.entity = OwnedEntity::GroundItem(NonZeroU128::new(5).unwrap());
        assert!(mutate(&verifier, &claim).is_err());
    }

    #[test]
    fn wrong_zone_and_stale_epoch_are_rejected() {
        let (verifier, mut claim) = rig();
        claim.zone = zone(8);
        assert!(mutate(&verifier, &claim).is_err());
        claim.zone = zone(7);
        claim.epoch = nz(10);
        assert!(mutate(&verifier, &claim).is_err());
    }

    #[test]
    fn pending_or_retired_authority_never_admits_mutations() {
        let (mut verifier, claim) = rig();
        verifier.authority.current.as_mut().unwrap().frozen = true;
        assert!(mutate(&verifier, &claim).is_err());
        verifier.authority.current.as_mut().unwrap().frozen = false;
        verifier.authority.current.as_mut().unwrap().retired = true;
        assert!(mutate(&verifier, &claim).is_err());
    }

    #[test]
    fn absent_or_unavailable_authority_never_falls_back_to_client_claim() {
        let (mut verifier, claim) = rig();
        verifier.authority.current = None;
        assert!(mutate(&verifier, &claim).is_err());
        verifier.authority.available = false;
        assert!(mutate(&verifier, &claim).is_err());
    }

    #[test]
    fn source_worker_handoff_is_fenced_after_epoch_change() {
        let (mut verifier, claim) = rig();
        verifier.authority.current.as_mut().unwrap().worker = worker(6);
        verifier.authority.current.as_mut().unwrap().epoch = nz(12);
        assert!(mutate(&verifier, &claim).is_err());
    }
}
