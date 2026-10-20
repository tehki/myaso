//! C4d dormant server-side typed contract for a PostgreSQL world-mutation
//! transaction. This module DOES NOT connect to a database or prove worker
//! credentials; a production verifier and DB driver must be installed first.
//! Never construct a verified context from client-asserted worker/epoch IDs.

use crate::zone_lease::{OwnedEntity, WorkerId, ZoneKey};
use std::num::{NonZeroU128, NonZeroU64};

pub const MAX_WORLD_MUTATION_BYTES: usize = 4096;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WorldMutationContractError {
    InvalidIdentity,
    InvalidWorkerOrZone,
    EpochOutOfRange,
    RevisionOutOfRange,
    InvalidPayloadLength,
    UntrustedRequest,
    InvalidReceipt,
}

/// Trusted verification is deliberately separate from the network packet.
/// This trait must be implemented by a server-installed authenticated worker
/// admission module. No default/accept-all implementation is provided.
pub trait TrustedWorkerVerifier {
    type Claim;
    fn verify_worker(
        &self,
        claim: &Self::Claim,
    ) -> Result<VerifiedWorldAuthority, WorldMutationContractError>;
}

/// Construction is crate-restricted. The future *server-authentication*
/// adapter must verify worker credentials, character/zone admission and
/// active lease generation before emitting any of these claims.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct VerifiedWorldAuthority {
    entity: OwnedEntity,
    worker: WorkerId,
    zone: ZoneKey,
    epoch: NonZeroU64,
}

impl VerifiedWorldAuthority {
    /// Only server-installed admission code may construct this after resolving
    /// the actual authenticated session and trusted authority snapshot.
    /// The PostgreSQL transactional fence MUST still check live ownership.
    pub(crate) fn from_admitted_authority(
        entity: OwnedEntity,
        worker: WorkerId,
        zone: ZoneKey,
        epoch: NonZeroU64,
    ) -> Self {
        Self {
            entity,
            worker,
            zone,
            epoch,
        }
    }

    #[cfg(test)]
    pub(crate) fn from_trusted_authority(
        entity: OwnedEntity,
        worker: WorkerId,
        zone: ZoneKey,
        epoch: NonZeroU64,
    ) -> Self {
        Self {
            entity,
            worker,
            zone,
            epoch,
        }
    }
}

/// Fully validated input to a prepared PostgreSQL function CALL. A future
/// driver MUST bind every parameter, never interpolate user-controlled text.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorldMutationCommand {
    mutation_id: [u8; 16],
    entity_kind: i16,
    entity_id: [u8; 16],
    worker: i64,
    zone: i64,
    epoch: i64,
    expected_revision: i64,
    payload: Vec<u8>,
}

impl WorldMutationCommand {
    pub fn admit<V: TrustedWorkerVerifier>(
        verifier: &V,
        claim: &V::Claim,
        mutation: NonZeroU128,
        expected_revision: u64,
        payload: &[u8],
    ) -> Result<Self, WorldMutationContractError> {
        let verified = verifier.verify_worker(claim)?;
        if payload.is_empty() || payload.len() > MAX_WORLD_MUTATION_BYTES {
            return Err(WorldMutationContractError::InvalidPayloadLength);
        }
        let worker = i64::try_from(verified.worker.get())
            .map_err(|_| WorldMutationContractError::InvalidWorkerOrZone)?;
        let zone = i64::try_from(verified.zone.get())
            .map_err(|_| WorldMutationContractError::InvalidWorkerOrZone)?;
        let epoch = i64::try_from(verified.epoch.get())
            .map_err(|_| WorldMutationContractError::EpochOutOfRange)?;
        let expected_revision = i64::try_from(expected_revision)
            .map_err(|_| WorldMutationContractError::RevisionOutOfRange)?;
        // Canonical network/storage form for 128-bit identifiers is big-endian
        // octet order, not architecture-native little-endian bytes.
        let (entity_kind, entity_number) = match verified.entity {
            OwnedEntity::Character(character) => (1, character.get()),
            OwnedEntity::GroundItem(item) => (2, item.get()),
        };
        Ok(Self {
            mutation_id: mutation.get().to_be_bytes(),
            entity_kind,
            entity_id: entity_number.to_be_bytes(),
            worker,
            zone,
            epoch,
            expected_revision,
            payload: payload.to_vec(),
        })
    }

    pub fn bind(&self) -> WorldMutationBind<'_> {
        WorldMutationBind {
            mutation_id: &self.mutation_id,
            entity_kind: self.entity_kind,
            entity_id: &self.entity_id,
            worker: self.worker,
            zone: self.zone,
            epoch: self.epoch,
            expected_revision: self.expected_revision,
            payload: &self.payload,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct WorldMutationBind<'a> {
    pub mutation_id: &'a [u8; 16],
    pub entity_kind: i16,
    pub entity_id: &'a [u8; 16],
    pub worker: i64,
    pub zone: i64,
    pub epoch: i64,
    pub expected_revision: i64,
    pub payload: &'a [u8],
}

/// The result may be historical (replayed=true). Historical replay never
/// grants current gameplay authority, irrespective of receipt validity.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct WorldMutationReceipt {
    pub world_revision: NonZeroU64,
    pub outbox_sequence: NonZeroU64,
    pub replayed: bool,
}

impl WorldMutationReceipt {
    pub fn from_sql(
        world_revision: i64,
        outbox_sequence: i64,
        replayed: bool,
    ) -> Result<Self, WorldMutationContractError> {
        let world_revision = u64::try_from(world_revision)
            .ok()
            .and_then(NonZeroU64::new)
            .ok_or(WorldMutationContractError::InvalidReceipt)?;
        let outbox_sequence = u64::try_from(outbox_sequence)
            .ok()
            .and_then(NonZeroU64::new)
            .ok_or(WorldMutationContractError::InvalidReceipt)?;
        Ok(Self {
            world_revision,
            outbox_sequence,
            replayed,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::identity::CharacterId;

    struct FakeVerifier;
    #[derive(Clone, Copy)]
    struct Claim {
        entity: OwnedEntity,
        worker: WorkerId,
        zone: ZoneKey,
        epoch: NonZeroU64,
        trusted: bool,
    }
    impl TrustedWorkerVerifier for FakeVerifier {
        type Claim = Claim;
        fn verify_worker(
            &self,
            claim: &Claim,
        ) -> Result<VerifiedWorldAuthority, WorldMutationContractError> {
            if !claim.trusted {
                return Err(WorldMutationContractError::UntrustedRequest);
            }
            Ok(VerifiedWorldAuthority::from_trusted_authority(
                claim.entity,
                claim.worker,
                claim.zone,
                claim.epoch,
            ))
        }
    }
    fn claim() -> Claim {
        Claim {
            entity: OwnedEntity::Character(
                CharacterId::new(0x1020_3040_5060_7080_90a0_b0c0_d0e0_f001).unwrap(),
            ),
            worker: WorkerId::new(17).unwrap(),
            zone: ZoneKey::new(99).unwrap(),
            epoch: NonZeroU64::new(2).unwrap(),
            trusted: true,
        }
    }
    fn mutation(n: u128) -> NonZeroU128 {
        NonZeroU128::new(n).unwrap()
    }

    #[test]
    fn canonical_big_endian_character_and_operation_parameters() {
        let mut c = claim();
        c.entity = OwnedEntity::Character(
            CharacterId::new(0x0102_0304_0506_0708_090a_0b0c_0d0e_0f10).unwrap(),
        );
        let op = mutation(0x1011_1213_1415_1617_1819_1a1b_1c1d_1e1f);
        let command = WorldMutationCommand::admit(&FakeVerifier, &c, op, 15, b"snapshot")
            .expect("verified parameters");
        let bind = command.bind();
        assert_eq!(bind.entity_kind, 1);
        assert_eq!(
            bind.entity_id,
            &[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
        );
        assert_eq!(
            bind.mutation_id,
            &[16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]
        );
        assert_eq!(
            (bind.worker, bind.zone, bind.epoch, bind.expected_revision),
            (17, 99, 2, 15)
        );
        assert_eq!(bind.payload, b"snapshot");
    }

    #[test]
    fn ground_item_namespace_and_max_payload_are_supported() {
        let mut c = claim();
        c.entity = OwnedEntity::ground_item(4).unwrap();
        let payload = vec![0xfa; MAX_WORLD_MUTATION_BYTES];
        let cmd = WorldMutationCommand::admit(&FakeVerifier, &c, mutation(3), 0, &payload).unwrap();
        assert_eq!(cmd.bind().entity_kind, 2);
        assert_eq!(cmd.bind().entity_id[15], 4);
        assert_eq!(cmd.bind().payload.len(), MAX_WORLD_MUTATION_BYTES);
    }

    #[test]
    fn invalid_claim_and_payload_bounds_fail_closed() {
        let mut c = claim();
        c.trusted = false;
        assert!(matches!(
            WorldMutationCommand::admit(&FakeVerifier, &c, mutation(1), 0, b"ok"),
            Err(WorldMutationContractError::UntrustedRequest)
        ));
        c.trusted = true;
        assert!(matches!(
            WorldMutationCommand::admit(&FakeVerifier, &c, mutation(1), 0, &[]),
            Err(WorldMutationContractError::InvalidPayloadLength)
        ));
        assert!(matches!(
            WorldMutationCommand::admit(&FakeVerifier, &c, mutation(1), 0, &vec![0; 4097]),
            Err(WorldMutationContractError::InvalidPayloadLength)
        ));
    }

    #[test]
    fn sql_signed_bigint_overflow_is_explicitly_rejected() {
        let mut c = claim();
        c.worker = WorkerId::new(u64::MAX).unwrap();
        assert!(matches!(
            WorldMutationCommand::admit(&FakeVerifier, &c, mutation(1), 0, b"x"),
            Err(WorldMutationContractError::InvalidWorkerOrZone)
        ));
        c = claim();
        c.epoch = NonZeroU64::new(u64::MAX).unwrap();
        assert!(matches!(
            WorldMutationCommand::admit(&FakeVerifier, &c, mutation(1), 0, b"x"),
            Err(WorldMutationContractError::EpochOutOfRange)
        ));
        c = claim();
        assert!(matches!(
            WorldMutationCommand::admit(&FakeVerifier, &c, mutation(1), u64::MAX, b"x"),
            Err(WorldMutationContractError::RevisionOutOfRange)
        ));
    }

    #[test]
    fn receipt_cannot_contain_zero_or_negative_sequence() {
        assert!(WorldMutationReceipt::from_sql(1, 2, false).is_ok());
        assert_eq!(
            WorldMutationReceipt::from_sql(1, 0, false),
            Err(WorldMutationContractError::InvalidReceipt)
        );
        assert_eq!(
            WorldMutationReceipt::from_sql(-1, 2, true),
            Err(WorldMutationContractError::InvalidReceipt)
        );
        let receipt = WorldMutationReceipt::from_sql(6, 7, true).unwrap();
        assert!(receipt.replayed);
    }
}
