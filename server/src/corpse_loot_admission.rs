//! Core C3n: DORMANT typed boundary between trusted player/worker admission
//! and C3l/C3m's PostgreSQL two-item corpse-loot function.
//!
//! No production authenticator, death-event verifier, grant issuer or DB
//! driver exists. A browser packet MUST NOT manufacture verified identities.
//! A SQL grant ID is NOT a bearer credential or proof of a logged-in player.

use crate::{
    identity::CharacterId,
    world_mutation_contract::{
        TrustedWorkerVerifier, WorldMutationCommand, WorldMutationContractError,
    },
};
use std::num::{NonZeroU128, NonZeroU64};

/// Only a server-installed trusted verifier may resolve a network/session
/// request to a currently entitled character and issued DB grant.
/// A verifier must independently check active session generation, character
/// ownership, death/corpse provenance, loot rules, and stored grant scope.
/// Do not implement this as an echo of browser-provided character/item IDs.
pub trait TrustedCorpseLootVerifier {
    type Claim;

    fn verify_loot(&self, claim: &Self::Claim) -> Result<VerifiedCorpseLoot, LootAdmissionError>;
}

/// A claim issued by a trusted admission adapter, not by the HTTP handler.
/// Its fields are private; no production constructor exists in this module.
/// The only constructor is compiled in test mode for regression fixtures.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct VerifiedCorpseLoot {
    character: CharacterId,
    corpse: NonZeroU128,
    grant: NonZeroU128,
    item_a: NonZeroU128,
    item_b: NonZeroU128,
}

impl VerifiedCorpseLoot {
    #[cfg(test)]
    pub(crate) fn test_fixture(
        character: CharacterId,
        corpse: NonZeroU128,
        grant: NonZeroU128,
        item_a: NonZeroU128,
        item_b: NonZeroU128,
    ) -> Self {
        Self {
            character,
            corpse,
            grant,
            item_a,
            item_b,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LootAdmissionError {
    UntrustedSessionOrEntitlement,
    MismatchedWorkerCharacter,
    NonCanonicalItemOrder,
    ConflictingOperationId,
    ItemRevisionOutOfRange,
    World(WorldMutationContractError),
}

impl From<WorldMutationContractError> for LootAdmissionError {
    fn from(value: WorldMutationContractError) -> Self {
        Self::World(value)
    }
}

/// Fully bound, *dormant* server-side call to the 14-argument C3l SQL function.
/// The opaque identities and scope come only from the two trusted verifiers;
/// numeric client-supplied claims cannot replace the verified scope.
///
/// IMPORTANT: the caller must use parameter binding, not SQL string assembly.
/// PostgreSQL MUST revalidate live grant, item revision and C4d authority at
/// commit; passing this typed admission is NOT transaction authorization.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CorpseLootCommand {
    world: WorldMutationCommand,
    operation_id: [u8; 16],
    corpse_id: [u8; 16],
    grant_id: [u8; 16],
    item_a: [u8; 16],
    item_b: [u8; 16],
    expected_a_revision: i64,
    expected_b_revision: i64,
}

impl CorpseLootCommand {
    #[allow(clippy::too_many_arguments)]
    pub fn admit<W, L>(
        worker_verifier: &W,
        worker_claim: &W::Claim,
        loot_verifier: &L,
        loot_claim: &L::Claim,
        operation_id: NonZeroU128,
        world_mutation_id: NonZeroU128,
        expected_world_revision: u64,
        expected_a_revision: NonZeroU64,
        expected_b_revision: NonZeroU64,
        world_payload: &[u8],
    ) -> Result<Self, LootAdmissionError>
    where
        W: TrustedWorkerVerifier,
        L: TrustedCorpseLootVerifier,
    {
        // Never trust raw network IDs as grant scope. A real verifier must
        // resolve both the actor's session and immutable DB grant separately.
        let granted = loot_verifier.verify_loot(loot_claim)?;
        if granted.item_a >= granted.item_b {
            return Err(LootAdmissionError::NonCanonicalItemOrder);
        }
        if operation_id == world_mutation_id {
            return Err(LootAdmissionError::ConflictingOperationId);
        }

        // The C4d worker verifier is separate. Require both verified contexts
        // to resolve to EXACTLY the same character, rather than selecting it
        // from either caller's packet.
        let world = WorldMutationCommand::admit(
            worker_verifier,
            worker_claim,
            world_mutation_id,
            expected_world_revision,
            world_payload,
        )?;
        let world_binding = world.bind();
        if world_binding.entity_kind != 1
            || world_binding.entity_id != &granted.character.get().to_be_bytes()
        {
            return Err(LootAdmissionError::MismatchedWorkerCharacter);
        }
        let expected_a_revision = i64::try_from(expected_a_revision.get())
            .map_err(|_| LootAdmissionError::ItemRevisionOutOfRange)?;
        let expected_b_revision = i64::try_from(expected_b_revision.get())
            .map_err(|_| LootAdmissionError::ItemRevisionOutOfRange)?;

        Ok(Self {
            world,
            operation_id: operation_id.get().to_be_bytes(),
            corpse_id: granted.corpse.get().to_be_bytes(),
            grant_id: granted.grant.get().to_be_bytes(),
            item_a: granted.item_a.get().to_be_bytes(),
            item_b: granted.item_b.get().to_be_bytes(),
            expected_a_revision,
            expected_b_revision,
        })
    }

    pub fn bind(&self) -> CorpseLootBind<'_> {
        let world = self.world.bind();
        CorpseLootBind {
            operation_id: &self.operation_id,
            world_mutation_id: world.mutation_id,
            character_id: world.entity_id,
            corpse_id: &self.corpse_id,
            worker: world.worker,
            zone: world.zone,
            epoch: world.epoch,
            expected_world_revision: world.expected_revision,
            world_payload: world.payload,
            item_a: &self.item_a,
            expected_a_revision: self.expected_a_revision,
            item_b: &self.item_b,
            expected_b_revision: self.expected_b_revision,
            grant_id: &self.grant_id,
        }
    }
}

/// Exact 14 parameter types/order for C3l's grant-aware SQL function.
/// ID bytes are big-endian, matching C4d and C3f. No MYTX LE file bytes.
#[derive(Clone, Copy, Debug)]
pub struct CorpseLootBind<'a> {
    pub operation_id: &'a [u8; 16],
    pub world_mutation_id: &'a [u8; 16],
    pub character_id: &'a [u8; 16],
    pub corpse_id: &'a [u8; 16],
    pub worker: i64,
    pub zone: i64,
    pub epoch: i64,
    pub expected_world_revision: i64,
    pub world_payload: &'a [u8],
    pub item_a: &'a [u8; 16],
    pub expected_a_revision: i64,
    pub item_b: &'a [u8; 16],
    pub expected_b_revision: i64,
    pub grant_id: &'a [u8; 16],
}

/// Immutable historical SQL receipt; replayed=true is NOT permission for a
/// new loot attempt or proof the issuing player remains authenticated.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CorpseLootReceipt {
    pub world_revision: NonZeroU64,
    pub item_a_revision: NonZeroU64,
    pub item_b_revision: NonZeroU64,
    pub outbox_sequence: NonZeroU64,
    pub replayed: bool,
}

impl CorpseLootReceipt {
    pub fn from_sql(
        world_revision: i64,
        item_a_revision: i64,
        item_b_revision: i64,
        outbox_sequence: i64,
        replayed: bool,
    ) -> Result<Self, LootAdmissionError> {
        let nonzero = |raw: i64| {
            u64::try_from(raw)
                .ok()
                .and_then(NonZeroU64::new)
                .ok_or(LootAdmissionError::World(
                    WorldMutationContractError::InvalidReceipt,
                ))
        };
        Ok(Self {
            world_revision: nonzero(world_revision)?,
            item_a_revision: nonzero(item_a_revision)?,
            item_b_revision: nonzero(item_b_revision)?,
            outbox_sequence: nonzero(outbox_sequence)?,
            replayed,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        world_mutation_contract::VerifiedWorldAuthority,
        zone_lease::{OwnedEntity, WorkerId, ZoneKey},
    };

    #[derive(Clone, Copy)]
    struct WorkerClaim {
        entity: OwnedEntity,
        authorized: bool,
        epoch: NonZeroU64,
    }

    struct TestWorkerVerifier;
    impl TrustedWorkerVerifier for TestWorkerVerifier {
        type Claim = WorkerClaim;

        fn verify_worker(
            &self,
            claim: &Self::Claim,
        ) -> Result<VerifiedWorldAuthority, WorldMutationContractError> {
            if !claim.authorized {
                return Err(WorldMutationContractError::UntrustedRequest);
            }
            Ok(VerifiedWorldAuthority::from_trusted_authority(
                claim.entity,
                WorkerId::new(5).unwrap(),
                ZoneKey::new(7).unwrap(),
                claim.epoch,
            ))
        }
    }

    #[derive(Clone, Copy)]
    struct LootClaim {
        character: CharacterId,
        session_generation: u64,
        corpse: NonZeroU128,
        grant: NonZeroU128,
        item_a: NonZeroU128,
        item_b: NonZeroU128,
        known_death_ticket: bool,
    }

    struct TestLootVerifier {
        current_generation: u64,
        owning_character: CharacterId,
    }

    impl TrustedCorpseLootVerifier for TestLootVerifier {
        type Claim = LootClaim;

        fn verify_loot(
            &self,
            claim: &Self::Claim,
        ) -> Result<VerifiedCorpseLoot, LootAdmissionError> {
            if claim.session_generation != self.current_generation
                || claim.character != self.owning_character
                || !claim.known_death_ticket
            {
                return Err(LootAdmissionError::UntrustedSessionOrEntitlement);
            }
            Ok(VerifiedCorpseLoot::test_fixture(
                claim.character,
                claim.corpse,
                claim.grant,
                claim.item_a,
                claim.item_b,
            ))
        }
    }

    fn id(n: u128) -> NonZeroU128 {
        NonZeroU128::new(n).unwrap()
    }

    fn fixture() -> (WorkerClaim, LootClaim, TestLootVerifier) {
        let c = CharacterId::new(0x0102_0304_0506_0708_090a_0b0c_0d0e_0f10).unwrap();
        (
            WorkerClaim {
                entity: OwnedEntity::Character(c),
                authorized: true,
                epoch: NonZeroU64::new(3).unwrap(),
            },
            LootClaim {
                character: c,
                session_generation: 9,
                corpse: id(0x1122_3344_5566_7788_99aa_bbcc_ddee_ff01),
                grant: id(0x2233_4455_6677_8899_aabb_ccdd_eeff_0011),
                item_a: id(0x0405_0607_0809_0a0b_0c0d_0e0f_1011_1213),
                item_b: id(0x1415_1617_1819_1a1b_1c1d_1e1f_2021_2223),
                known_death_ticket: true,
            },
            TestLootVerifier {
                current_generation: 9,
                owning_character: c,
            },
        )
    }

    fn admit(
        worker: &WorkerClaim,
        loot: &LootClaim,
        verifier: &TestLootVerifier,
    ) -> Result<CorpseLootCommand, LootAdmissionError> {
        CorpseLootCommand::admit(
            &TestWorkerVerifier,
            worker,
            verifier,
            loot,
            id(1001),
            id(2001),
            42,
            NonZeroU64::new(2).unwrap(),
            NonZeroU64::new(3).unwrap(),
            b"two-item-corpse-loot",
        )
    }

    #[test]
    fn validated_entitlement_and_world_worker_bind_exact_c3l_order() {
        let (worker, loot, verifier) = fixture();
        let cmd = admit(&worker, &loot, &verifier).unwrap();
        let b = cmd.bind();
        assert_eq!(b.operation_id, &id(1001).get().to_be_bytes());
        assert_eq!(b.world_mutation_id, &id(2001).get().to_be_bytes());
        assert_eq!(b.character_id, &loot.character.get().to_be_bytes());
        assert_eq!(b.corpse_id, &loot.corpse.get().to_be_bytes());
        assert_eq!(b.item_a, &loot.item_a.get().to_be_bytes());
        assert_eq!(b.item_b, &loot.item_b.get().to_be_bytes());
        assert_eq!(b.grant_id, &loot.grant.get().to_be_bytes());
        assert_eq!(
            (b.worker, b.zone, b.epoch, b.expected_world_revision),
            (5, 7, 3, 42)
        );
        assert_eq!((b.expected_a_revision, b.expected_b_revision), (2, 3));
        assert_eq!(b.world_payload, b"two-item-corpse-loot");
        assert_ne!(b.corpse_id, &loot.corpse.get().to_le_bytes());
    }

    #[test]
    fn stale_session_wrong_principal_and_unauthenticated_death_rejected() {
        let (worker, mut loot, verifier) = fixture();
        loot.session_generation = 8;
        assert!(matches!(
            admit(&worker, &loot, &verifier),
            Err(LootAdmissionError::UntrustedSessionOrEntitlement)
        ));
        loot.session_generation = 9;
        loot.character = CharacterId::new(777).unwrap();
        assert!(matches!(
            admit(&worker, &loot, &verifier),
            Err(LootAdmissionError::UntrustedSessionOrEntitlement)
        ));
        loot.character = verifier.owning_character;
        loot.known_death_ticket = false;
        assert!(matches!(
            admit(&worker, &loot, &verifier),
            Err(LootAdmissionError::UntrustedSessionOrEntitlement)
        ));
    }

    #[test]
    fn untrusted_worker_or_character_mismatch_never_admitted() {
        let (mut worker, loot, verifier) = fixture();
        worker.authorized = false;
        assert!(matches!(
            admit(&worker, &loot, &verifier),
            Err(LootAdmissionError::World(
                WorldMutationContractError::UntrustedRequest
            ))
        ));
        worker.authorized = true;
        worker.entity = OwnedEntity::Character(CharacterId::new(999).unwrap());
        assert!(matches!(
            admit(&worker, &loot, &verifier),
            Err(LootAdmissionError::MismatchedWorkerCharacter)
        ));
        worker.entity = OwnedEntity::ground_item(loot.item_a.get()).unwrap();
        assert!(matches!(
            admit(&worker, &loot, &verifier),
            Err(LootAdmissionError::MismatchedWorkerCharacter)
        ));
    }

    #[test]
    fn swapped_or_duplicate_item_scope_fails_closed() {
        let (worker, mut loot, verifier) = fixture();
        loot.item_a = loot.item_b;
        assert!(matches!(
            admit(&worker, &loot, &verifier),
            Err(LootAdmissionError::NonCanonicalItemOrder)
        ));
        loot.item_a = id(200);
        loot.item_b = id(100);
        assert!(matches!(
            admit(&worker, &loot, &verifier),
            Err(LootAdmissionError::NonCanonicalItemOrder)
        ));
    }

    #[test]
    fn reject_reused_operation_id_and_out_of_sql_range_values() {
        let (worker, loot, verifier) = fixture();
        let result = CorpseLootCommand::admit(
            &TestWorkerVerifier,
            &worker,
            &verifier,
            &loot,
            id(1001),
            id(1001),
            1,
            NonZeroU64::new(1).unwrap(),
            NonZeroU64::new(1).unwrap(),
            b"payload",
        );
        assert!(matches!(
            result,
            Err(LootAdmissionError::ConflictingOperationId)
        ));
        let result = CorpseLootCommand::admit(
            &TestWorkerVerifier,
            &worker,
            &verifier,
            &loot,
            id(1001),
            id(2001),
            1,
            NonZeroU64::new(i64::MAX as u64 + 1).unwrap(),
            NonZeroU64::new(1).unwrap(),
            b"payload",
        );
        assert!(matches!(
            result,
            Err(LootAdmissionError::ItemRevisionOutOfRange)
        ));
        let result = CorpseLootCommand::admit(
            &TestWorkerVerifier,
            &worker,
            &verifier,
            &loot,
            id(1001),
            id(2001),
            1,
            NonZeroU64::new(1).unwrap(),
            NonZeroU64::new(1).unwrap(),
            &vec![8; 4097],
        );
        assert!(matches!(
            result,
            Err(LootAdmissionError::World(
                WorldMutationContractError::InvalidPayloadLength
            ))
        ));
    }

    #[test]
    fn sql_receipts_require_all_four_positive_versions() {
        let good = CorpseLootReceipt::from_sql(5, 3, 3, 19, true).unwrap();
        assert!(good.replayed);
        assert_eq!(good.world_revision.get(), 5);
        for invalid in [
            (0, 3, 3, 19),
            (-1, 3, 3, 19),
            (5, 0, 3, 19),
            (5, 3, -1, 19),
            (5, 3, 3, 0),
        ] {
            assert!(matches!(
                CorpseLootReceipt::from_sql(invalid.0, invalid.1, invalid.2, invalid.3, false),
                Err(LootAdmissionError::World(
                    WorldMutationContractError::InvalidReceipt
                ))
            ));
        }
    }
}
