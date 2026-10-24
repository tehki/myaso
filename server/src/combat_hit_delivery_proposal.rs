//! DORMANT proposal: per-recipient contiguous HIT delivery projection.
//!
//! Source is ONLY a completed authoritative CombatEvent::Hit plus a Core8C
//! SAME-WORLD-COMMIT attribution captured under the original World lock.
//! The caller is responsible for proving that attribution and the accepted
//! QUIC actor/connection; this module cannot authenticate the injected values.
//! No runtime wire, packet registration, session mint, writer or reader.
//!
//! In contrast to the donor 256-entry *global* HitReceiptJournal, this
//! projector gives each exact actor/session incarnation its own contiguous
//! sequence, so unrelated FFA hits cannot cause phantom missing ACKs.
use std::collections::VecDeque;

use crate::combat_hit_receipt::{HitReceipt, HitReceiptError};
use crate::simulation::CombatEvent;

pub const MAX_PER_RECIPIENT_PENDING: usize = 64;

// Reuse the existing original server-authoritative actor lifetime binding.
// This is a type alias, never an independently minted Core8A principal.
pub type ActorIncarnation = crate::prealpha_authenticated_gesture::ServerActorBinding;

fn valid_binding(identity: ActorIncarnation) -> bool {
    identity.boot_nonce != 0
        && identity.world_instance != 0
        && identity.player_id != 0
        && identity.incarnation != 0
        && identity.lease_epoch != 0
}

/// Core8C must create this inside the original World lock AT hit commit.
/// This isn't a client-visible packet or client-provided identity.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CommittedHitIdentity {
    pub server_tick: u32,
    pub within_tick_ordinal: u32,
    pub attacker: ActorIncarnation,
    pub victim: ActorIncarnation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeliveryError {
    InvalidScope,
    InvalidWorldIdentity,
    InvalidWorldEvent(HitReceiptError),
    ReplayedOrReorderedWorldHit,
    ScopeGapped,
    ScopeRetired,
    SequenceExhaustion,
    PendingOverflow { first_missing: u32 },
    ForeignScope,
    ForeignToken,
    WrongWriteOrder,
    NotSent,
    FutureAck,
    StaleAck,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AckOutcome {
    Advanced { next: u32 },
    Duplicate { next: u32 },
}

/// Enqueue means pending, NOT written or acknowledged.
#[derive(Debug, Clone)]
pub struct ProposedRecipientHitDelivery {
    recipient: ActorIncarnation,
    token: [u8; 16],
    pending: VecDeque<HitReceipt>,
    max_pending: usize,
    next_sequence: u32,
    written_next: u32,
    acknowledged_next: u32,
    last_world_hit: Option<(u32, u32)>,
    last_committed_batch_tick: Option<u32>,
    gapped_at: Option<u32>,
    retired: bool,
}

impl ProposedRecipientHitDelivery {
    pub fn new(
        recipient: ActorIncarnation,
        token: [u8; 16],
        max_pending: usize,
    ) -> Result<Self, DeliveryError> {
        if !valid_binding(recipient)
            || token.iter().all(|byte| *byte == 0)
            || !(1..=MAX_PER_RECIPIENT_PENDING).contains(&max_pending)
        {
            return Err(DeliveryError::InvalidScope);
        }
        Ok(Self {
            recipient,
            token,
            pending: VecDeque::with_capacity(max_pending),
            max_pending,
            next_sequence: 0,
            written_next: 0,
            acknowledged_next: 0,
            last_world_hit: None,
            last_committed_batch_tick: None,
            gapped_at: None,
            retired: false,
        })
    }

    pub fn next_sequence(&self) -> u32 {
        self.next_sequence
    }

    pub fn pending(&self) -> usize {
        self.pending.len()
    }

    pub fn gap(&self) -> Option<u32> {
        self.gapped_at
    }

    pub fn acknowledged_next(&self) -> u32 {
        self.acknowledged_next
    }

    pub fn retire(&mut self) {
        self.token.fill(0);
        self.pending.clear();
        self.retired = true;
    }

    fn ready(&self) -> Result<(), DeliveryError> {
        if self.retired {
            return Err(DeliveryError::ScopeRetired);
        }
        if self.gapped_at.is_some() {
            return Err(DeliveryError::ScopeGapped);
        }
        Ok(())
    }

    /// Feed each original, committed World HIT in deterministic tick+ordinal
    /// order. Actor identities are IMMUTABLE values captured on the same
    /// authoritative World tick; never look up a historical net_id later.
    ///
    /// An unrelated HIT advances source provenance but does NOT consume
    /// the recipient's contiguous delivery sequence.
    pub fn project_hit(
        &mut self,
        hit: &CombatEvent,
        identity: CommittedHitIdentity,
    ) -> Result<Option<HitReceipt>, DeliveryError> {
        self.ready()?;
        if !valid_binding(identity.attacker)
            || !valid_binding(identity.victim)
            || identity.attacker.player_id == identity.victim.player_id
            || identity.attacker.boot_nonce != identity.victim.boot_nonce
            || identity.attacker.world_instance != identity.victim.world_instance
        {
            return Err(DeliveryError::InvalidWorldIdentity);
        }
        let CombatEvent::Hit {
            attacker,
            target,
            damage: _,
            hp: _,
        } = hit
        else {
            return Ok(None);
        };
        if *attacker != identity.attacker.player_id || *target != identity.victim.player_id {
            return Err(DeliveryError::InvalidWorldIdentity);
        }
        let key = (identity.server_tick, identity.within_tick_ordinal);
        if self
            .last_committed_batch_tick
            .is_some_and(|tick| identity.server_tick <= tick)
            || self.last_world_hit.is_some_and(|previous| key <= previous)
        {
            return Err(DeliveryError::ReplayedOrReorderedWorldHit);
        }
        // Validate the actual event BEFORE any receipt gets appended or a
        // World-event provenance cursor is advanced.
        let candidate =
            HitReceipt::from_combat_event(self.next_sequence, identity.server_tick, hit)
                .map_err(DeliveryError::InvalidWorldEvent)?
                .ok_or(DeliveryError::InvalidWorldIdentity)?;

        let entitled = self.recipient == identity.attacker || self.recipient == identity.victim;
        if !entitled {
            self.last_world_hit = Some(key);
            return Ok(None);
        }
        // Lease has no sequence wrap: retire and re-authenticate before it.
        if self.next_sequence == u32::MAX {
            return Err(DeliveryError::SequenceExhaustion);
        }
        if self.pending.len() == self.max_pending {
            let first_missing = self.next_sequence;
            self.gapped_at = Some(first_missing);
            return Err(DeliveryError::PendingOverflow { first_missing });
        }
        self.pending.push_back(candidate);
        self.next_sequence += 1;
        self.last_world_hit = Some(key);
        Ok(Some(candidate))
    }

    /// Atomic review-only projection for all original HIT events of one
    /// completed authoritative World tick. The trusted World-lock owner must
    /// supply every original committed HIT with its captured immutable actor
    /// identities and original within-tick ordinal. There is no network send.
    ///
    /// A malformed *later* HIT must not expose earlier HITs from the same
    /// batch to the client. Overflow is still a terminal, explicit GAP; no
    /// part of an overflowing batch is published or treated as ACKed.
    /// Callers must not combine this method with per-event publication for
    /// the same tick; the production writer must use only one atomic API.
    pub fn project_committed_tick_batch(
        &mut self,
        server_tick: u32,
        committed: &[(CombatEvent, CommittedHitIdentity)],
    ) -> Result<Vec<HitReceipt>, DeliveryError> {
        self.ready()?;
        if self
            .last_committed_batch_tick
            .is_some_and(|previous| server_tick <= previous)
            || self
                .last_world_hit
                .is_some_and(|(prior_tick, _)| server_tick <= prior_tick)
        {
            return Err(DeliveryError::ReplayedOrReorderedWorldHit);
        }
        let mut staged = self.clone();
        let mut entitled = Vec::new();
        for (event, identity) in committed {
            if identity.server_tick != server_tick || !matches!(event, CombatEvent::Hit { .. }) {
                return Err(DeliveryError::InvalidWorldIdentity);
            }
            match staged.project_hit(event, *identity) {
                Ok(Some(receipt)) => entitled.push(receipt),
                Ok(None) => {}
                Err(DeliveryError::PendingOverflow { .. }) => {
                    // No part of this tick is committed; the first LOST
                    // local sequence is the original, not staged cursor.
                    let first_missing = self.next_sequence;
                    self.gapped_at = Some(first_missing);
                    return Err(DeliveryError::PendingOverflow { first_missing });
                }
                Err(error) => return Err(error),
            }
        }
        staged.last_committed_batch_tick = Some(server_tick);
        *self = staged;
        Ok(entitled)
    }

    fn check_authenticated_lease(
        &self,
        session: ActorIncarnation,
        token: &[u8; 16],
    ) -> Result<(), DeliveryError> {
        self.ready()?;
        if session != self.recipient {
            return Err(DeliveryError::ForeignScope);
        }
        if *token != self.token {
            return Err(DeliveryError::ForeignToken);
        }
        Ok(())
    }

    /// Only the SINGLE actual original reliable writer calls this after the
    /// length-framed bytes have been written successfully. Enqueue is NOT ACK.
    /// A same-sequence resend after prior successful write is idempotent.
    pub fn mark_written(
        &mut self,
        session: ActorIncarnation,
        token: &[u8; 16],
        sequence: u32,
    ) -> Result<(), DeliveryError> {
        self.check_authenticated_lease(session, token)?;
        if sequence < self.written_next {
            if sequence < self.acknowledged_next {
                return Err(DeliveryError::StaleAck);
            }
            return Ok(()); // byte-exact retry of an unacknowledged receipt
        }
        if sequence != self.written_next || sequence >= self.next_sequence {
            return Err(DeliveryError::WrongWriteOrder);
        }
        self.written_next += 1;
        Ok(())
    }

    /// Application-level cumulative ACK is the NEXT contiguous *presented*
    /// receipt on this authenticated QUIC+actor incarnation, never the global
    /// World journal cursor, an enqueue, or a QUIC transport write receipt.
    pub fn ack_next(
        &mut self,
        session: ActorIncarnation,
        token: &[u8; 16],
        next: u32,
    ) -> Result<AckOutcome, DeliveryError> {
        self.check_authenticated_lease(session, token)?;
        if next > self.written_next {
            return Err(DeliveryError::FutureAck);
        }
        if next < self.acknowledged_next {
            return Err(DeliveryError::StaleAck);
        }
        if next == self.acknowledged_next {
            return Ok(AckOutcome::Duplicate { next });
        }
        while self.pending.front().is_some_and(|r| r.sequence < next) {
            self.pending.pop_front();
        }
        self.acknowledged_next = next;
        Ok(AckOutcome::Advanced { next })
    }

    pub fn replay_unacknowledged(
        &self,
        session: ActorIncarnation,
        token: &[u8; 16],
        requested: u32,
    ) -> Result<HitReceipt, DeliveryError> {
        self.check_authenticated_lease(session, token)?;
        if requested < self.acknowledged_next {
            return Err(DeliveryError::StaleAck);
        }
        if requested >= self.written_next {
            return Err(DeliveryError::NotSent);
        }
        self.pending
            .iter()
            .find(|r| r.sequence == requested)
            .copied()
            .ok_or(DeliveryError::NotSent)
    }
}

/// DORMANT original-World tick boundary over the EXISTING bounded recipient
/// scopes; no second journal, actor authentication, World step or live wire.
/// Callers must prove CURRENT admitted actor bindings under the GameState lock
/// and retain the exact original committed HIT batch until publication returns.
///
/// Only participants in the committed HIT(s) are cloned/staged (<= recipient
/// count), not the entire 512-player snapshot and 64 receipts per spectator.
/// On capacity overflow, ALL affected participants are terminal-GAPed for an
/// explicit authoritative resync; otherwise their committed damage would be
/// silently omitted when the next World tick advances. Unrelated retired or
/// gapped spectators cannot block valid players. Invalid source/retired actors
/// fail closed, without committing a receipt; caller must resolve the
/// admission snapshot or resync, never replay guessed damage.
pub fn project_world_tick_for_recipients(
    server_tick: u32,
    committed: &[(CombatEvent, CommittedHitIdentity)],
    recipients: &mut [ProposedRecipientHitDelivery],
) -> Result<Vec<(ActorIncarnation, Vec<HitReceipt>)>, DeliveryError> {
    let Some(first) = recipients.first() else {
        return Err(DeliveryError::InvalidScope);
    };
    let boot = first.recipient.boot_nonce;
    let world = first.recipient.world_instance;
    for (index, scope) in recipients.iter().enumerate() {
        if !valid_binding(scope.recipient)
            || recipients[..index]
                .iter()
                .any(|prior| prior.recipient.player_id == scope.recipient.player_id)
        {
            return Err(DeliveryError::InvalidScope);
        }
        if scope.recipient.boot_nonce != boot || scope.recipient.world_instance != world {
            return Err(DeliveryError::InvalidWorldIdentity);
        }
    }

    // A participant must be represented by EXACTLY its current server actor
    // lifetime. No absent or old same-number lease can silently miss a HIT.
    let mut touched = vec![false; recipients.len()];
    for (_, identity) in committed {
        if !valid_binding(identity.attacker)
            || !valid_binding(identity.victim)
            || identity.attacker.player_id == identity.victim.player_id
            || identity.attacker.boot_nonce != boot
            || identity.victim.boot_nonce != boot
            || identity.attacker.world_instance != world
            || identity.victim.world_instance != world
        {
            return Err(DeliveryError::InvalidWorldIdentity);
        }
        for bound in [identity.attacker, identity.victim] {
            let index = recipients
                .iter()
                .position(|scope| scope.recipient.player_id == bound.player_id)
                .ok_or(DeliveryError::InvalidScope)?;
            if recipients[index].recipient != bound {
                return Err(DeliveryError::InvalidWorldIdentity);
            }
            touched[index] = true;
        }
    }

    // Stage only affected scopes. No observer's 64-entry inbox is cloned.
    // We do not publish any bytes or change any scope until every validation
    // and capacity check has passed.
    let mut staged: Vec<Option<(ProposedRecipientHitDelivery, Vec<HitReceipt>)>> =
        (0..recipients.len()).map(|_| None).collect();
    let mut overflow = None;
    for (index, scope) in recipients.iter().enumerate() {
        if !touched[index] {
            // A disconnected/gapped uninvolved spectator cannot veto
            // another actor's real HIT, but receives no false credit.
            if scope.retired || scope.gapped_at.is_some() {
                continue;
            }
            if scope
                .last_committed_batch_tick
                .is_some_and(|tick| server_tick <= tick)
                || scope
                    .last_world_hit
                    .is_some_and(|(tick, _)| server_tick <= tick)
            {
                return Err(DeliveryError::ReplayedOrReorderedWorldHit);
            }
            continue;
        }
        let mut candidate = scope.clone();
        match candidate.project_committed_tick_batch(server_tick, committed) {
            Ok(receipts) => staged[index] = Some((candidate, receipts)),
            Err(DeliveryError::PendingOverflow { first_missing }) => {
                if overflow.is_none() {
                    overflow = Some(first_missing);
                }
            }
            Err(error) => return Err(error),
        }
    }
    if let Some(first_missing) = overflow {
        // One original HIT batch was already committed in World. If any
        // affected scope overflows, none can receive a partial confirmation:
        // force explicit GAP/resync for every actual attacker/victim scope.
        for (index, scope) in recipients.iter_mut().enumerate() {
            if touched[index] {
                scope.gapped_at = Some(scope.next_sequence);
            }
        }
        return Err(DeliveryError::PendingOverflow { first_missing });
    }

    let mut projected = Vec::with_capacity(recipients.len());
    for (index, scope) in recipients.iter_mut().enumerate() {
        if let Some((candidate, receipts)) = staged[index].take() {
            *scope = candidate;
            projected.push((scope.recipient, receipts));
        } else {
            // Closing a completed World tick for a still-current spectator
            // prevents an old per-event callback from inventing later HITs.
            if !scope.retired && scope.gapped_at.is_none() {
                scope.last_committed_batch_tick = Some(server_tick);
            }
            projected.push((scope.recipient, Vec::new()));
        }
    }
    Ok(projected)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::combat_hit_receipt::encode_hit_receipt;

    const TOKEN: [u8; 16] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

    fn actor(id: u32, actor_generation: u64, epoch: u64) -> ActorIncarnation {
        // Construct the existing original server's authoritative binding
        // type, not a second HIT-only representation of actor lifetime.
        ActorIncarnation {
            boot_nonce: 55,
            world_instance: 77,
            player_id: id,
            incarnation: actor_generation,
            lease_epoch: epoch,
        }
    }
    fn scope(id: u32) -> ProposedRecipientHitDelivery {
        ProposedRecipientHitDelivery::new(actor(id, 1, id as u64), TOKEN, 64).unwrap()
    }
    fn commit(tick: u32, ordinal: u32, attacker: u32, victim: u32) -> CommittedHitIdentity {
        CommittedHitIdentity {
            server_tick: tick,
            within_tick_ordinal: ordinal,
            attacker: actor(attacker, 1, attacker as u64),
            victim: actor(victim, 1, victim as u64),
        }
    }
    fn event(a: u32, v: u32) -> CombatEvent {
        CombatEvent::Hit {
            attacker: a,
            target: v,
            damage: 34,
            hp: 66,
        }
    }

    #[test]
    fn unrelated_hits_do_not_create_phantom_gap_in_actor2_contiguous_delivery() {
        let mut actual_attacker = scope(2);
        // Another fight occurs first. Global journal sequence would be 0.
        assert_eq!(
            actual_attacker.project_hit(&event(3, 4), commit(100, 0, 3, 4)),
            Ok(None)
        );
        // Legitimate Firefox actor2->Chrome actor1 appears at global seq1,
        // but the bounded attacker inbox MUST assign its OWN sequence 0.
        let first = actual_attacker
            .project_hit(&event(2, 1), commit(100, 1, 2, 1))
            .unwrap()
            .unwrap();
        assert_eq!(
            (
                first.sequence,
                first.server_tick,
                first.attacker,
                first.target,
                first.damage,
                first.target_hp
            ),
            (0, 100, 2, 1, 34.0, 66.0)
        );
        assert_eq!(encode_hit_receipt(first).unwrap()[4..8], [0, 0, 0, 0]);
        assert_eq!(actual_attacker.pending(), 1);
        assert_eq!(actual_attacker.next_sequence(), 1);
        // Same tick further unrelated HIT then another actual actor2 strike.
        assert_eq!(
            actual_attacker.project_hit(&event(3, 4), commit(100, 2, 3, 4)),
            Ok(None)
        );
        let second = actual_attacker
            .project_hit(&event(2, 1), commit(100, 3, 2, 1))
            .unwrap()
            .unwrap();
        assert_eq!((first.sequence, second.sequence), (0, 1));
        assert_eq!(
            actual_attacker.project_hit(&event(2, 1), commit(100, 3, 2, 1)),
            Err(DeliveryError::ReplayedOrReorderedWorldHit)
        );
    }

    #[test]
    fn true_three_roles_each_get_owned_local_seq0_no_spectator_credit() {
        let mut attacker = scope(2);
        let mut victim = scope(1);
        let mut bystander = scope(3);
        let true_hit = event(2, 1);
        let id = commit(101, 0, 2, 1);
        assert_eq!(
            attacker
                .project_hit(&true_hit, id)
                .unwrap()
                .unwrap()
                .sequence,
            0
        );
        assert_eq!(
            victim.project_hit(&true_hit, id).unwrap().unwrap().sequence,
            0
        );
        assert_eq!(bystander.project_hit(&true_hit, id).unwrap(), None);
        assert_eq!(bystander.pending(), 0);
        assert_eq!(bystander.next_sequence(), 0);
    }

    #[test]
    fn fake_old_actor_id_reuse_does_not_claim_new_connection_or_resurrect_old_credit() {
        let mut old = scope(2);
        let true_hit = event(2, 1);
        old.project_hit(&true_hit, commit(101, 0, 2, 1)).unwrap();
        old.mark_written(actor(2, 1, 2), &TOKEN, 0).unwrap();
        let replacement = actor(2, 2, 999);
        assert_eq!(
            old.ack_next(replacement, &TOKEN, 1),
            Err(DeliveryError::ForeignScope)
        );
        let mut fresh = ProposedRecipientHitDelivery::new(replacement, [7; 16], 64).unwrap();
        assert_eq!(
            fresh.project_hit(&event(2, 1), commit(102, 0, 2, 1)),
            Ok(None),
            "old same numeric player identity lacks fresh actor+QUIC epoch"
        );
        old.retire();
        assert_eq!(
            old.replay_unacknowledged(actor(2, 1, 2), &TOKEN, 0),
            Err(DeliveryError::ScopeRetired)
        );
        // A real new event must be bound at its actual new World tick.
        let new_identity = CommittedHitIdentity {
            server_tick: 103,
            within_tick_ordinal: 0,
            attacker: replacement,
            victim: actor(1, 1, 1),
        };
        assert_eq!(
            fresh
                .project_hit(&true_hit, new_identity)
                .unwrap()
                .unwrap()
                .sequence,
            0
        );
    }

    #[test]
    fn queue_insertion_and_reliable_write_are_not_application_acks() {
        let mut delivery = scope(2);
        delivery
            .project_hit(&event(2, 1), commit(100, 0, 2, 1))
            .unwrap();
        assert_eq!(
            delivery.ack_next(actor(2, 1, 2), &TOKEN, 1),
            Err(DeliveryError::FutureAck)
        );
        assert_eq!(
            delivery.replay_unacknowledged(actor(2, 1, 2), &TOKEN, 0),
            Err(DeliveryError::NotSent)
        );
        delivery.mark_written(actor(2, 1, 2), &TOKEN, 0).unwrap();
        assert_eq!(
            delivery.ack_next(actor(2, 1, 2), &TOKEN, 1),
            Ok(AckOutcome::Advanced { next: 1 })
        );
        assert_eq!(delivery.pending(), 0);
        assert_eq!(
            delivery.ack_next(actor(2, 1, 2), &TOKEN, 1),
            Ok(AckOutcome::Duplicate { next: 1 })
        );
        assert_eq!(
            delivery.ack_next(actor(2, 1, 2), &TOKEN, 0),
            Err(DeliveryError::StaleAck)
        );
    }

    #[test]
    fn genuine_retransmit_is_byte_identical_and_no_second_world_damage() {
        let mut delivery = scope(2);
        let receipt = delivery
            .project_hit(&event(2, 1), commit(100, 0, 2, 1))
            .unwrap()
            .unwrap();
        delivery.mark_written(actor(2, 1, 2), &TOKEN, 0).unwrap();
        let replay = delivery
            .replay_unacknowledged(actor(2, 1, 2), &TOKEN, 0)
            .unwrap();
        assert_eq!(encode_hit_receipt(receipt), encode_hit_receipt(replay));
        delivery.mark_written(actor(2, 1, 2), &TOKEN, 0).unwrap();
        assert_eq!(delivery.pending(), 1);
        assert_eq!(
            delivery.ack_next(actor(2, 1, 2), &TOKEN, 1),
            Ok(AckOutcome::Advanced { next: 1 })
        );
        assert_eq!(
            delivery.replay_unacknowledged(actor(2, 1, 2), &TOKEN, 0),
            Err(DeliveryError::StaleAck)
        );
    }

    #[test]
    fn wrong_token_future_ack_unsent_and_delivery_order_are_hard_rejected() {
        let mut delivery = scope(2);
        for i in 0..2 {
            delivery
                .project_hit(&event(2, 1), commit(100, i, 2, 1))
                .unwrap();
        }
        assert_eq!(
            delivery.mark_written(actor(2, 1, 2), &[8; 16], 0),
            Err(DeliveryError::ForeignToken)
        );
        assert_eq!(
            delivery.mark_written(actor(2, 1, 2), &TOKEN, 1),
            Err(DeliveryError::WrongWriteOrder)
        );
        delivery.mark_written(actor(2, 1, 2), &TOKEN, 0).unwrap();
        assert_eq!(
            delivery.ack_next(actor(2, 1, 2), &TOKEN, 2),
            Err(DeliveryError::FutureAck)
        );
        assert_eq!(
            delivery.ack_next(actor(2, 1, 2), &TOKEN, 1),
            Ok(AckOutcome::Advanced { next: 1 })
        );
        assert_eq!(
            delivery.mark_written(actor(2, 1, 2), &TOKEN, 0),
            Err(DeliveryError::StaleAck)
        );
        delivery.mark_written(actor(2, 1, 2), &TOKEN, 1).unwrap();
        assert_eq!(
            delivery.ack_next(actor(2, 1, 2), &TOKEN, 2),
            Ok(AckOutcome::Advanced { next: 2 })
        );
    }

    #[test]
    fn bounded_64_pending_terminal_gap_never_silently_claims_success() {
        let mut delivery = scope(2);
        for i in 0..MAX_PER_RECIPIENT_PENDING {
            assert!(delivery
                .project_hit(&event(2, 1), commit(100, i as u32, 2, 1))
                .unwrap()
                .is_some());
        }
        assert_eq!(delivery.pending(), 64);
        assert_eq!(
            delivery.project_hit(&event(2, 1), commit(101, 0, 2, 1)),
            Err(DeliveryError::PendingOverflow { first_missing: 64 })
        );
        assert_eq!(delivery.gap(), Some(64));
        assert_eq!(
            delivery.ack_next(actor(2, 1, 2), &TOKEN, 64),
            Err(DeliveryError::ScopeGapped)
        );
        assert_eq!(
            delivery.project_hit(&event(2, 1), commit(102, 0, 2, 1)),
            Err(DeliveryError::ScopeGapped)
        );
    }

    #[test]
    fn malformed_commit_or_mismatch_does_not_poison_valid_following_hit() {
        let mut delivery = scope(2);
        let c = commit(100, 0, 2, 1);
        assert_eq!(
            delivery.project_hit(&event(3, 1), c),
            Err(DeliveryError::InvalidWorldIdentity)
        );
        let broken = CommittedHitIdentity {
            victim: actor(1, 0, 1),
            ..c
        };
        assert_eq!(
            delivery.project_hit(&event(2, 1), broken),
            Err(DeliveryError::InvalidWorldIdentity)
        );
        let bad = CommittedHitIdentity {
            victim: ActorIncarnation {
                boot_nonce: 99,
                ..c.victim
            },
            ..c
        };
        assert_eq!(
            delivery.project_hit(&event(2, 1), bad),
            Err(DeliveryError::InvalidWorldIdentity)
        );
        assert_eq!(delivery.next_sequence(), 0);
        assert!(delivery.project_hit(&event(2, 1), c).unwrap().is_some());
    }

    #[test]
    fn five_hundred_twelve_independent_authenticated_scopes_do_not_share_cursors() {
        let scopes: Vec<_> = (1..=512)
            .map(|id| {
                ProposedRecipientHitDelivery::new(actor(id, 1, id as u64), TOKEN, 64).unwrap()
            })
            .collect();
        assert_eq!(scopes.len(), 512);
        assert!(scopes
            .iter()
            .all(|s| s.pending() == 0 && s.next_sequence() == 0));
        assert_eq!(
            ProposedRecipientHitDelivery::new(actor(1, 1, 1), TOKEN, 65).err(),
            Some(DeliveryError::InvalidScope)
        );
    }
    #[test]
    fn committed_batch_rejects_invalid_second_hit_without_partial_credit() {
        let mut delivery = scope(2);
        let good = (event(2, 1), commit(100, 0, 2, 1));
        let invalid = (event(2, 1), commit(101, 1, 2, 1));
        assert_eq!(
            delivery.project_committed_tick_batch(100, &[good, invalid]),
            Err(DeliveryError::InvalidWorldIdentity)
        );
        assert_eq!(delivery.pending(), 0);
        assert_eq!(delivery.next_sequence(), 0);
        assert_eq!(delivery.acknowledged_next(), 0);
        // The same authoritative tick can be safely retried only if no
        // prior partial batch was published.
        let valid = [
            (event(3, 4), commit(100, 0, 3, 4)),
            (event(2, 1), commit(100, 1, 2, 1)),
        ];
        let committed = delivery.project_committed_tick_batch(100, &valid).unwrap();
        assert_eq!(committed.len(), 1);
        assert_eq!(committed[0].sequence, 0);
        assert_eq!(delivery.next_sequence(), 1);
        assert_eq!(
            delivery.project_committed_tick_batch(100, &valid),
            Err(DeliveryError::ReplayedOrReorderedWorldHit)
        );
    }

    #[test]
    fn committed_batch_retains_real_same_tick_ordinal_and_local_delivery_order() {
        let mut delivery = scope(2);
        let batch = [
            (event(3, 4), commit(200, 0, 3, 4)),
            (event(2, 1), commit(200, 1, 2, 1)),
            (event(1, 2), commit(200, 3, 1, 2)),
        ];
        let actual = delivery.project_committed_tick_batch(200, &batch).unwrap();
        assert_eq!(actual.len(), 2);
        assert_eq!((actual[0].sequence, actual[0].attacker), (0, 2));
        assert_eq!((actual[1].sequence, actual[1].attacker), (1, 1));
        assert_eq!(delivery.pending(), 2);
        assert_eq!(
            delivery.ack_next(actor(2, 1, 2), &TOKEN, 2),
            Err(DeliveryError::FutureAck),
            "enqueued batch is never a processed client ACK"
        );
    }

    #[test]
    fn committed_batch_capacity_overflow_is_terminal_without_partial_enqueue() {
        let mut delivery = ProposedRecipientHitDelivery::new(actor(2, 1, 2), TOKEN, 1).unwrap();
        let batch = [
            (event(2, 1), commit(300, 0, 2, 1)),
            (event(2, 3), commit(300, 1, 2, 3)),
        ];
        assert_eq!(
            delivery.project_committed_tick_batch(300, &batch),
            Err(DeliveryError::PendingOverflow { first_missing: 0 })
        );
        assert_eq!(delivery.pending(), 0);
        assert_eq!(delivery.next_sequence(), 0);
        assert_eq!(delivery.gap(), Some(0));
        assert_eq!(
            delivery.project_committed_tick_batch(301, &[]),
            Err(DeliveryError::ScopeGapped)
        );
    }

    #[test]
    fn committed_empty_tick_is_fenced_against_delayed_same_tick_credit() {
        let mut delivery = scope(2);
        assert!(delivery
            .project_committed_tick_batch(400, &[])
            .unwrap()
            .is_empty());
        assert_eq!(
            delivery.project_committed_tick_batch(400, &[(event(2, 1), commit(400, 0, 2, 1))]),
            Err(DeliveryError::ReplayedOrReorderedWorldHit)
        );
        assert_eq!(delivery.next_sequence(), 0);
        assert_eq!(
            delivery
                .project_committed_tick_batch(401, &[(event(2, 1), commit(401, 0, 2, 1))])
                .unwrap()[0]
                .sequence,
            0
        );
    }

    #[test]
    fn batch_and_incremental_publication_cannot_recredit_same_world_tick() {
        // Empty authoritative tick is still an irrevocable publication
        // boundary. A second legacy per-event call cannot add a HIT later.
        let mut after_empty = scope(2);
        assert!(after_empty
            .project_committed_tick_batch(100, &[])
            .unwrap()
            .is_empty());
        assert_eq!(
            after_empty.project_hit(&event(2, 1), commit(100, 0, 2, 1)),
            Err(DeliveryError::ReplayedOrReorderedWorldHit)
        );
        assert_eq!((after_empty.pending(), after_empty.next_sequence()), (0, 0));
        assert_eq!(
            after_empty
                .project_committed_tick_batch(101, &[(event(2, 1), commit(101, 0, 2, 1))])
                .unwrap()[0]
                .sequence,
            0,
            "a subsequent genuinely later World tick still works"
        );
        assert_eq!(
            after_empty.project_hit(&event(2, 1), commit(101, 1, 2, 1)),
            Err(DeliveryError::ReplayedOrReorderedWorldHit)
        );
        assert_eq!((after_empty.pending(), after_empty.next_sequence()), (1, 1));

        // The reverse path is equally fenced: a previously appended
        // incremental HIT cannot be followed by an atomic batch of that tick.
        let mut after_incremental = scope(2);
        assert!(after_incremental
            .project_hit(&event(2, 1), commit(200, 0, 2, 1))
            .unwrap()
            .is_some());
        assert_eq!(
            after_incremental
                .project_committed_tick_batch(200, &[(event(2, 1), commit(200, 1, 2, 1))]),
            Err(DeliveryError::ReplayedOrReorderedWorldHit)
        );
        assert_eq!(
            (
                after_incremental.pending(),
                after_incremental.next_sequence()
            ),
            (1, 1)
        );
        assert_eq!(
            after_incremental
                .project_committed_tick_batch(201, &[(event(2, 1), commit(201, 0, 2, 1))])
                .unwrap()[0]
                .sequence,
            1
        );
        assert_eq!(
            after_incremental.project_hit(&event(2, 1), commit(200, 2, 2, 1)),
            Err(DeliveryError::ReplayedOrReorderedWorldHit),
            "late old World ticks cannot be reinserted after a newer batch"
        );
    }

    #[test]
    fn all_recipients_reject_invalid_later_victim_before_any_credit() {
        let mut scopes = vec![scope(1), scope(2), scope(3), scope(4)];
        let committed = [
            (event(2, 1), commit(500, 0, 2, 1)),
            (event(2, 3), commit(500, 1, 2, 3)),
        ];
        let mut corrupt = committed.clone();
        corrupt[1].1.victim = actor(4, 1, 4);
        assert_eq!(
            project_world_tick_for_recipients(500, &corrupt, &mut scopes),
            Err(DeliveryError::InvalidWorldIdentity)
        );
        assert!(scopes
            .iter()
            .all(|s| s.pending() == 0 && s.next_sequence() == 0));
        let published = project_world_tick_for_recipients(500, &committed, &mut scopes).unwrap();
        assert_eq!(
            published
                .iter()
                .map(|(a, receipts)| (a.player_id, receipts.len()))
                .collect::<Vec<_>>(),
            vec![(1, 1), (2, 2), (3, 1), (4, 0)]
        );
        assert_eq!(
            (published[1].1[0].sequence, published[1].1[1].sequence),
            (0, 1)
        );
        assert_eq!((published[1].1[0].target, published[1].1[1].target), (1, 3));
        assert_eq!(
            scopes[1].ack_next(actor(2, 1, 2), &TOKEN, 2),
            Err(DeliveryError::FutureAck),
            "recipient enqueue is not a successful writer or application ACK"
        );
        assert_eq!(
            project_world_tick_for_recipients(500, &committed, &mut scopes),
            Err(DeliveryError::ReplayedOrReorderedWorldHit)
        );
        assert_eq!(scopes[3].pending(), 0, "bystander never gets credit");
    }

    #[test]
    fn all_recipients_overflow_gaps_bottleneck_but_publishes_no_peer() {
        let bottleneck = ProposedRecipientHitDelivery::new(actor(1, 1, 1), TOKEN, 1).unwrap();
        let mut scopes = vec![scope(2), bottleneck, scope(3), scope(4)];
        let committed = [
            (event(1, 2), commit(600, 0, 1, 2)),
            (event(1, 3), commit(600, 1, 1, 3)),
        ];
        assert_eq!(
            project_world_tick_for_recipients(600, &committed, &mut scopes),
            Err(DeliveryError::PendingOverflow { first_missing: 0 })
        );
        assert_eq!(scopes[1].gap(), Some(0));
        assert!(scopes
            .iter()
            .all(|s| s.pending() == 0 && s.next_sequence() == 0));
        assert_eq!(
            scopes[0].gap(),
            Some(0),
            "victim must resync after lost receipt"
        );
        assert_eq!(scopes[2].gap(), Some(0), "second victim must resync too");
        assert!(
            scopes[3].gap().is_none(),
            "uninvolved observer keeps current lease"
        );
        // An unrelated empty tick is safe to close. An affected actor's
        // next actual World HIT remains blocked until authoritative resync.
        assert!(project_world_tick_for_recipients(601, &[], &mut scopes)
            .unwrap()
            .iter()
            .all(|(_, receipts)| receipts.is_empty()));
        assert_eq!(
            project_world_tick_for_recipients(
                602,
                &[(event(1, 2), commit(602, 0, 1, 2))],
                &mut scopes,
            ),
            Err(DeliveryError::ScopeGapped)
        );
    }

    #[test]
    fn all_recipients_fail_closed_on_reused_id_or_duplicate_scope() {
        let committed = [(event(2, 1), commit(700, 0, 2, 1))];
        let old_actor = ProposedRecipientHitDelivery::new(actor(2, 2, 22), TOKEN, 64).unwrap();
        let mut stale = vec![scope(1), old_actor, scope(3)];
        assert_eq!(
            project_world_tick_for_recipients(700, &committed, &mut stale),
            Err(DeliveryError::InvalidWorldIdentity)
        );
        assert!(stale.iter().all(|s| s.next_sequence() == 0));
        let mut duplicates = vec![scope(1), scope(1)];
        assert_eq!(
            project_world_tick_for_recipients(700, &committed, &mut duplicates),
            Err(DeliveryError::InvalidScope)
        );
        let mut none: Vec<ProposedRecipientHitDelivery> = Vec::new();
        assert_eq!(
            project_world_tick_for_recipients(700, &committed, &mut none),
            Err(DeliveryError::InvalidScope)
        );
    }

    #[test]
    fn absent_hit_participant_fails_closed_rather_than_silently_missing_credit() {
        let mut scopes = vec![scope(1), scope(4)];
        let hit = [(event(2, 1), commit(900, 0, 2, 1))];
        assert_eq!(
            project_world_tick_for_recipients(900, &hit, &mut scopes),
            Err(DeliveryError::InvalidScope)
        );
        assert!(scopes.iter().all(|s| s.pending() == 0));
        assert!(scopes.iter().all(|s| s.gap().is_none()));
    }

    #[test]
    fn disconnected_irrelevant_spectator_does_not_veto_valid_world_hit() {
        let mut scopes = vec![scope(1), scope(2), scope(4)];
        scopes[2].retire();
        let hit = [(event(2, 1), commit(901, 0, 2, 1))];
        let delivered = project_world_tick_for_recipients(901, &hit, &mut scopes).unwrap();
        assert_eq!((delivered[0].1.len(), delivered[1].1.len()), (1, 1));
        assert!(delivered[2].1.is_empty());
        assert_eq!(scopes[2].pending(), 0);
        assert_eq!(scopes[2].next_sequence(), 0);
    }

    #[test]
    fn large_512_recipient_backlog_keeps_unrelated_queues_unchanged() {
        // Bound cloning to affected actor scopes, not 512 * 64 entries
        // on every 60Hz original World step. This is correctness coverage,
        // NOT a performance benchmark or live-World-lock latency sign-off.
        let mut scopes = (1..=512).map(scope).collect::<Vec<_>>();
        for (index, recipient) in scopes.iter_mut().enumerate() {
            let id = (index + 1) as u32;
            if id <= 2 {
                continue;
            }
            for ordinal in 0..64 {
                recipient
                    .project_hit(&event(id, 800), commit(1, ordinal, id, 800))
                    .unwrap();
            }
            assert_eq!(recipient.pending(), 64);
        }
        let hit = [(event(1, 2), commit(902, 0, 1, 2))];
        let result = project_world_tick_for_recipients(902, &hit, &mut scopes).unwrap();
        assert_eq!(result.iter().filter(|(_, rs)| !rs.is_empty()).count(), 2);
        assert_eq!(scopes[0].pending(), 1);
        assert_eq!(scopes[1].pending(), 1);
        assert!(scopes[2..].iter().all(|s| s.pending() == 64));
        assert!(scopes[2..].iter().all(|s| s.gap().is_none()));
    }

    #[test]
    fn all_recipients_retired_later_scope_does_not_commit_first_scope() {
        let mut scopes = vec![scope(1), scope(2)];
        scopes[1].retire();
        assert_eq!(
            project_world_tick_for_recipients(
                800,
                &[(event(1, 2), commit(800, 0, 1, 2))],
                &mut scopes,
            ),
            Err(DeliveryError::ScopeRetired)
        );
        assert_eq!(scopes[0].pending(), 0);
        assert_eq!(scopes[0].next_sequence(), 0);
    }
}
