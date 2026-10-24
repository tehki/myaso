//! Core8A NONRELEASE M147 control ingress review: no actual QUIC receive loop.
//!
//! This bounded pure state machine parses only proposed v1 HIT_CONTROL type6
//! on a caller-supplied *already authenticated* server actor binding. It never
//! accepts client-authored HIT type5, never opens a socket or registers types,
//! and never creates an authoritative HIT from a control packet.
//!
//! The actual server must authenticate the connection, mint a unique CSPRNG
//! token, bind original World/actor incarnation, preserve single-writer
//! reliability and invoke these functions from its permitted Core owner.
//! This pure helper does NONE of those production operations.
use crate::combat_hit_control_proposal::{
    decode_hit_control, encode_hit_control, HitControl, HitControlError, HitControlOp,
    HIT_CONTROL_BYTES,
};
#[cfg(test)]
use crate::combat_hit_delivery_proposal::MAX_PER_RECIPIENT_PENDING;
use crate::combat_hit_delivery_proposal::{
    AckOutcome, CommittedHitIdentity, DeliveryError, ProposedRecipientHitDelivery,
};
use crate::combat_hit_receipt::{encode_hit_receipt, HitReceiptError, HIT_RECEIPT_BYTES};
use crate::prealpha_authenticated_gesture::ServerActorBinding;
use crate::simulation::CombatEvent;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IngressError {
    Disabled,
    Retired,
    ForeignConnection,
    InvalidConfiguration,
    InvalidControl(HitControlError),
    InvalidReliableFrame,
    WrongDirection,
    DuplicateHello,
    MissingGrant,
    InvalidDelivery(DeliveryError),
    InvalidReceipt(HitReceiptError),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClientControlResult {
    ServerGrant([u8; HIT_CONTROL_BYTES]),
    Acknowledged(AckOutcome),
    Replay([u8; HIT_RECEIPT_BYTES]),
}

/// A scoped offline fixture. A live QUIC stream must never be instantiated
/// from this type until Main0 authorizes the proposed wire namespace.
pub struct ProposedHitControlIngress {
    admitted: ServerActorBinding,
    secret: [u8; 16],
    cap: usize,
    enabled: bool,
    retired: bool,
    inbox: Option<ProposedRecipientHitDelivery>,
}

impl ProposedHitControlIngress {
    fn valid(admitted: ServerActorBinding) -> bool {
        admitted.player_id != 0
            && admitted.boot_nonce != 0
            && admitted.lease_epoch != 0
            && admitted.world_instance != 0
            && admitted.incarnation != 0
    }

    /// Explicitly OFF by default. No implicit enablement from a packet.
    pub fn new_disabled(admitted: ServerActorBinding) -> Result<Self, IngressError> {
        if !Self::valid(admitted) {
            return Err(IngressError::InvalidConfiguration);
        }
        Ok(Self {
            admitted,
            secret: [0; 16],
            cap: 0,
            enabled: false,
            retired: false,
            inbox: None,
        })
    }

    /// Test-only injection of a grant token. This DOES NOT mint or authenticate
    /// a CSPRNG server token, and must not be used by a live listener.
    #[cfg(test)]
    fn for_offline_test(
        admitted: ServerActorBinding,
        token: [u8; 16],
        cap: usize,
    ) -> Result<Self, IngressError> {
        if !Self::valid(admitted)
            || token.iter().all(|b| *b == 0)
            || !(1..=MAX_PER_RECIPIENT_PENDING).contains(&cap)
        {
            return Err(IngressError::InvalidConfiguration);
        }
        Ok(Self {
            admitted,
            secret: token,
            cap,
            enabled: true,
            retired: false,
            inbox: None,
        })
    }

    fn check_connection(&self, current: ServerActorBinding) -> Result<(), IngressError> {
        if self.retired {
            return Err(IngressError::Retired);
        }
        if !self.enabled {
            return Err(IngressError::Disabled);
        }
        if current != self.admitted {
            return Err(IngressError::ForeignConnection);
        }
        Ok(())
    }

    /// Offline validation of ONE already-reassembled original u16LE
    /// length-framed reliable message. Does not read from a live QUIC stream,
    /// handle fragmented writes, buffer multiple frames, or mutate gameplay.
    pub fn receive_review_frame(
        &mut self,
        current: ServerActorBinding,
        frame: &[u8],
    ) -> Result<ClientControlResult, IngressError> {
        self.check_connection(current)?;
        if frame.len() != HIT_CONTROL_BYTES + 2 {
            return Err(IngressError::InvalidReliableFrame);
        }
        let declared = u16::from_le_bytes([frame[0], frame[1]]) as usize;
        if declared != HIT_CONTROL_BYTES {
            return Err(IngressError::InvalidReliableFrame);
        }
        self.receive_client_control(current, &frame[2..])
    }

    /// Parse proposed type6 ONLY, from one *externally authenticated* stream.
    /// Actual server/client login, TLS, QUIC and HELLO read loop are NOT here.
    pub fn receive_client_control(
        &mut self,
        current: ServerActorBinding,
        bytes: &[u8],
    ) -> Result<ClientControlResult, IngressError> {
        self.check_connection(current)?;
        let cmd = decode_hit_control(bytes).map_err(IngressError::InvalidControl)?;
        match cmd.op {
            HitControlOp::ClientHello => {
                if self.inbox.is_some() {
                    return Err(IngressError::DuplicateHello);
                }
                // Only server-owned current admission can mint and send GRANT.
                // The token is injected solely by the fixture; never client
                // supplied or derived from untrusted bytes.
                let inbox = ProposedRecipientHitDelivery::new(self.admitted, self.secret, self.cap)
                    .map_err(IngressError::InvalidDelivery)?;
                let grant = encode_hit_control(HitControl {
                    op: HitControlOp::ServerGrant,
                    cursor: 0,
                    token: self.secret,
                    aux: self.cap as u32,
                })
                .map_err(IngressError::InvalidControl)?;
                self.inbox = Some(inbox);
                Ok(ClientControlResult::ServerGrant(grant))
            }
            HitControlOp::ClientAck => {
                let inbox = self.inbox.as_mut().ok_or(IngressError::MissingGrant)?;
                let ack = inbox
                    .ack_next(current, &cmd.token, cmd.cursor)
                    .map_err(IngressError::InvalidDelivery)?;
                Ok(ClientControlResult::Acknowledged(ack))
            }
            HitControlOp::ClientNack => {
                let inbox = self.inbox.as_ref().ok_or(IngressError::MissingGrant)?;
                let replay = inbox
                    .replay_unacknowledged(current, &cmd.token, cmd.cursor)
                    .map_err(IngressError::InvalidDelivery)?;
                let encoded = encode_hit_receipt(replay).map_err(IngressError::InvalidReceipt)?;
                Ok(ClientControlResult::Replay(encoded))
            }
            // All other valid frames are strictly SERVER→CLIENT. A peer must
            // never trick the reader into granting itself a new lease.
            HitControlOp::ServerGrant | HitControlOp::ServerGap | HitControlOp::ServerRetired => {
                Err(IngressError::WrongDirection)
            }
        }
    }

    /// Offline deterministic producer: only an externally proven committed
    /// World HIT and its exact same-lock actor incarnations may reach here.
    pub fn propose_committed_hit(
        &mut self,
        current: ServerActorBinding,
        event: &CombatEvent,
        identity: CommittedHitIdentity,
    ) -> Result<Option<[u8; HIT_RECEIPT_BYTES]>, IngressError> {
        self.check_connection(current)?;
        let inbox = self.inbox.as_mut().ok_or(IngressError::MissingGrant)?;
        let result = inbox
            .project_hit(event, identity)
            .map_err(IngressError::InvalidDelivery)?;
        result
            .map(encode_hit_receipt)
            .transpose()
            .map_err(IngressError::InvalidReceipt)
    }

    /// Called only after the ONE original reliable writer has actually written
    /// the original bytes. This does NOT mean the client processed the HIT.
    pub fn mark_writer_success(
        &mut self,
        current: ServerActorBinding,
        sequence: u32,
    ) -> Result<(), IngressError> {
        self.check_connection(current)?;
        let inbox = self.inbox.as_mut().ok_or(IngressError::MissingGrant)?;
        inbox
            .mark_written(current, &self.secret, sequence)
            .map_err(IngressError::InvalidDelivery)
    }

    pub fn retire(&mut self) {
        if let Some(inbox) = self.inbox.as_mut() {
            inbox.retire();
        }
        self.secret.fill(0);
        self.retired = true;
        self.enabled = false;
    }

    #[cfg(test)]
    fn cursor(&self) -> (u32, u32) {
        let inbox = self.inbox.as_ref().expect("test grant");
        (inbox.next_sequence(), inbox.acknowledged_next())
    }
}

/// Review-only bounded incremental decoder for the proposed 32-byte control
/// protocol. Byte-at-a-time framing survives arbitrarily fragmented or
/// concatenated reliable reads without assuming one QUIC read is one packet.
/// This does NOT open a socket, mint a lease, or activate proposed packet 6.
///
/// The callback must only enqueue outputs for the authorized, nonblocking
/// reliable writer; it must not perform writes while holding the World lock.
pub struct ProposedHitControlChunkReader {
    binding: ServerActorBinding,
    frame: [u8; HIT_CONTROL_BYTES + 2],
    filled: usize,
    retired: bool,
}

impl ProposedHitControlChunkReader {
    pub fn new_review_only(binding: ServerActorBinding) -> Result<Self, IngressError> {
        if !ProposedHitControlIngress::valid(binding) {
            return Err(IngressError::InvalidConfiguration);
        }
        Ok(Self {
            binding,
            frame: [0; HIT_CONTROL_BYTES + 2],
            filled: 0,
            retired: false,
        })
    }

    fn close(&mut self) {
        self.retired = true;
        self.filled = 0;
        self.frame.fill(0);
    }

    /// Reject any malformed frame, foreign actor, retired lease or callback
    /// failure by retiring the entire review connection; never resynchronize
    /// untrusted bytes after a framing error or carry a partial frame across
    /// an actor-incarnation change. Memory is exactly one 34-byte frame.
    pub fn feed_review_chunk(
        &mut self,
        ingress: &mut ProposedHitControlIngress,
        current: ServerActorBinding,
        chunk: &[u8],
        mut publish: impl FnMut(ClientControlResult) -> Result<(), IngressError>,
    ) -> Result<(), IngressError> {
        if self.retired {
            return Err(IngressError::Retired);
        }
        if current != self.binding {
            self.close();
            ingress.retire();
            return Err(IngressError::ForeignConnection);
        }
        if let Err(err) = ingress.check_connection(current) {
            self.close();
            ingress.retire();
            return Err(err);
        }
        for &byte in chunk {
            self.frame[self.filled] = byte;
            self.filled += 1;
            if self.filled == 2 {
                let declared = u16::from_le_bytes([self.frame[0], self.frame[1]]) as usize;
                if declared != HIT_CONTROL_BYTES {
                    self.close();
                    ingress.retire();
                    return Err(IngressError::InvalidReliableFrame);
                }
            }
            if self.filled == HIT_CONTROL_BYTES + 2 {
                let completed = self.frame;
                self.frame.fill(0);
                self.filled = 0;
                let response = match ingress.receive_review_frame(current, &completed) {
                    Ok(response) => response,
                    Err(err) => {
                        self.close();
                        ingress.retire();
                        return Err(err);
                    }
                };
                if let Err(err) = publish(response) {
                    self.close();
                    ingress.retire();
                    return Err(err);
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::combat_hit_control_proposal::encode_hit_control;
    use crate::combat_hit_receipt::decode_hit_receipt;

    const TOKEN: [u8; 16] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    fn binding(id: u32, generation: u64) -> ServerActorBinding {
        ServerActorBinding {
            player_id: id,
            boot_nonce: 83,
            lease_epoch: id as u64,
            world_instance: 19,
            incarnation: generation,
        }
    }
    fn hello() -> [u8; HIT_CONTROL_BYTES] {
        encode_hit_control(HitControl {
            op: HitControlOp::ClientHello,
            cursor: 0,
            token: [0; 16],
            aux: 0,
        })
        .unwrap()
    }
    fn ctl(op: HitControlOp, cursor: u32, token: [u8; 16]) -> [u8; HIT_CONTROL_BYTES] {
        encode_hit_control(HitControl {
            op,
            cursor,
            token,
            aux: 0,
        })
        .unwrap()
    }
    fn hit(a: u32, v: u32) -> CombatEvent {
        CombatEvent::Hit {
            attacker: a,
            target: v,
            damage: 34,
            hp: 66,
        }
    }
    fn proof(tick: u32, ordinal: u32, a: u32, v: u32) -> CommittedHitIdentity {
        CommittedHitIdentity {
            server_tick: tick,
            within_tick_ordinal: ordinal,
            attacker: binding(a, 1),
            victim: binding(v, 1),
        }
    }
    fn granted() -> ProposedHitControlIngress {
        let mut gate =
            ProposedHitControlIngress::for_offline_test(binding(2, 1), TOKEN, 64).unwrap();
        let result = gate
            .receive_client_control(binding(2, 1), &hello())
            .unwrap();
        let ClientControlResult::ServerGrant(wire) = result else {
            panic!("no grant");
        };
        let decoded = decode_hit_control(&wire).unwrap();
        assert_eq!(decoded.op, HitControlOp::ServerGrant);
        assert_eq!(decoded.token, TOKEN);
        assert_eq!(decoded.aux, 64);
        gate
    }

    fn framed_control(control: [u8; HIT_CONTROL_BYTES]) -> [u8; HIT_CONTROL_BYTES + 2] {
        let mut frame = [0; HIT_CONTROL_BYTES + 2];
        frame[..2].copy_from_slice(&(HIT_CONTROL_BYTES as u16).to_le_bytes());
        frame[2..].copy_from_slice(&control);
        frame
    }

    #[test]
    fn chunk_reader_accepts_one_byte_at_a_time_hello_and_complete_grant_once() {
        let actor = binding(2, 1);
        let mut gate = ProposedHitControlIngress::for_offline_test(actor, TOKEN, 64).unwrap();
        let mut reader = ProposedHitControlChunkReader::new_review_only(actor).unwrap();
        let frame = framed_control(hello());
        let mut results = Vec::new();
        for byte in frame {
            reader
                .feed_review_chunk(&mut gate, actor, &[byte], |response| {
                    results.push(response);
                    Ok(())
                })
                .unwrap();
        }
        assert_eq!(results.len(), 1);
        let ClientControlResult::ServerGrant(grant) = results[0] else {
            panic!("one server grant expected");
        };
        assert_eq!(decode_hit_control(&grant).unwrap().token, TOKEN);
        assert_eq!(reader.filled, 0);
    }

    #[test]
    fn chunk_reader_delivers_concatenated_hello_and_duplicate_ack_in_order() {
        let actor = binding(2, 1);
        let mut gate = ProposedHitControlIngress::for_offline_test(actor, TOKEN, 64).unwrap();
        let mut reader = ProposedHitControlChunkReader::new_review_only(actor).unwrap();
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&framed_control(hello()));
        bytes.extend_from_slice(&framed_control(ctl(HitControlOp::ClientAck, 0, TOKEN)));
        let mut results = Vec::new();
        reader
            .feed_review_chunk(&mut gate, actor, &bytes, |response| {
                results.push(response);
                Ok(())
            })
            .unwrap();
        assert_eq!(results.len(), 2);
        assert!(matches!(results[0], ClientControlResult::ServerGrant(_)));
        assert!(matches!(
            results[1],
            ClientControlResult::Acknowledged(AckOutcome::Duplicate { next: 0 })
        ));
        assert_eq!(reader.filled, 0);
    }

    #[test]
    fn chunk_reader_bad_prefix_fails_closed_without_resynchronizing() {
        let actor = binding(2, 1);
        let mut gate = ProposedHitControlIngress::for_offline_test(actor, TOKEN, 64).unwrap();
        let mut reader = ProposedHitControlChunkReader::new_review_only(actor).unwrap();
        assert_eq!(
            reader.feed_review_chunk(&mut gate, actor, &[255, 255], |_| Ok(())),
            Err(IngressError::InvalidReliableFrame)
        );
        assert_eq!(reader.filled, 0);
        assert!(reader.frame.iter().all(|byte| *byte == 0));
        assert_eq!(
            reader.feed_review_chunk(&mut gate, actor, &framed_control(hello()), |_| Ok(())),
            Err(IngressError::Retired)
        );
    }

    #[test]
    fn chunk_reader_cannot_join_partial_frame_across_new_actor_incarnation() {
        let actor = binding(2, 1);
        let mut gate = ProposedHitControlIngress::for_offline_test(actor, TOKEN, 64).unwrap();
        let mut reader = ProposedHitControlChunkReader::new_review_only(actor).unwrap();
        let frame = framed_control(hello());
        reader
            .feed_review_chunk(&mut gate, actor, &frame[..9], |_| Ok(()))
            .unwrap();
        assert_eq!(
            reader.feed_review_chunk(&mut gate, binding(2, 2), &frame[9..], |_| Ok(())),
            Err(IngressError::ForeignConnection)
        );
        assert!(reader.frame.iter().all(|byte| *byte == 0));
        assert_eq!(
            reader.feed_review_chunk(&mut gate, actor, &frame, |_| Ok(())),
            Err(IngressError::Retired)
        );
    }

    #[test]
    fn chunk_reader_rejects_callback_failure_and_cannot_repeat_delivery() {
        let actor = binding(2, 1);
        let mut gate = ProposedHitControlIngress::for_offline_test(actor, TOKEN, 64).unwrap();
        let mut reader = ProposedHitControlChunkReader::new_review_only(actor).unwrap();
        assert_eq!(
            reader.feed_review_chunk(&mut gate, actor, &framed_control(hello()), |_| Err(
                IngressError::InvalidReliableFrame
            ),),
            Err(IngressError::InvalidReliableFrame)
        );
        assert_eq!(
            reader.feed_review_chunk(&mut gate, actor, &framed_control(hello()), |_| Ok(())),
            Err(IngressError::Retired)
        );
    }

    #[test]
    fn legacy_default_off_cannot_negotiate_any_hit_capability() {
        let mut gate = ProposedHitControlIngress::new_disabled(binding(2, 1)).unwrap();
        assert_eq!(
            gate.receive_client_control(binding(2, 1), &hello()),
            Err(IngressError::Disabled)
        );
        assert_eq!(
            gate.receive_client_control(binding(2, 1), &ctl(HitControlOp::ClientAck, 1, TOKEN)),
            Err(IngressError::Disabled)
        );
        assert_eq!(
            ProposedHitControlIngress::new_disabled(binding(0, 1)).err(),
            Some(IngressError::InvalidConfiguration)
        );
    }

    #[test]
    fn bounded_u16le_original_reliable_frame_rejects_truncated_extra_or_hit_type5() {
        let mut gate =
            ProposedHitControlIngress::for_offline_test(binding(2, 1), TOKEN, 64).unwrap();
        let mut framed = vec![HIT_CONTROL_BYTES as u8, 0];
        framed.extend_from_slice(&hello());
        assert!(matches!(
            gate.receive_review_frame(binding(2, 1), &framed),
            Ok(ClientControlResult::ServerGrant(_))
        ));
        let mut next = granted();
        assert_eq!(
            next.receive_review_frame(binding(2, 1), &framed[..33]),
            Err(IngressError::InvalidReliableFrame)
        );
        let mut extra = framed.clone();
        extra.push(0);
        assert_eq!(
            next.receive_review_frame(binding(2, 1), &extra),
            Err(IngressError::InvalidReliableFrame)
        );
        let mut bad_length = framed.clone();
        bad_length[0] = 31;
        assert_eq!(
            next.receive_review_frame(binding(2, 1), &bad_length),
            Err(IngressError::InvalidReliableFrame)
        );
        let mut malicious_hit = framed.clone();
        malicious_hit[3] = 5;
        assert_eq!(
            next.receive_review_frame(binding(2, 1), &malicious_hit),
            Err(IngressError::InvalidControl(HitControlError::WrongType))
        );
    }

    #[test]
    fn strict_direction_no_client_hit_packet_or_unauthorized_grant() {
        let mut gate = granted();
        assert_eq!(
            gate.receive_client_control(binding(2, 1), &hello()),
            Err(IngressError::DuplicateHello)
        );
        let raw_hit = [1u8, 5, 0, 0, 0, 0, 0, 0];
        assert_eq!(
            gate.receive_client_control(binding(2, 1), &raw_hit),
            Err(IngressError::InvalidControl(HitControlError::InvalidLength))
        );
        for op in [
            HitControlOp::ServerGrant,
            HitControlOp::ServerGap,
            HitControlOp::ServerRetired,
        ] {
            let frame = encode_hit_control(HitControl {
                op,
                cursor: 0,
                token: TOKEN,
                aux: if op == HitControlOp::ServerGrant {
                    64
                } else {
                    0
                },
            })
            .unwrap();
            assert_eq!(
                gate.receive_client_control(binding(2, 1), &frame),
                Err(IngressError::WrongDirection)
            );
        }
    }

    #[test]
    fn only_written_contiguous_world_hit_is_acked_and_same_lease_replayed() {
        let mut gate = granted();
        // Original unrelated actor3→4 global HIT gets NO actor2 sequence.
        assert_eq!(
            gate.propose_committed_hit(binding(2, 1), &hit(3, 4), proof(200, 0, 3, 4))
                .unwrap(),
            None
        );
        let wire = gate
            .propose_committed_hit(binding(2, 1), &hit(2, 1), proof(200, 1, 2, 1))
            .unwrap()
            .unwrap();
        let actual = decode_hit_receipt(&wire).unwrap();
        assert_eq!(
            (
                actual.sequence,
                actual.server_tick,
                actual.attacker,
                actual.target,
                actual.damage,
                actual.target_hp
            ),
            (0, 200, 2, 1, 34.0, 66.0)
        );
        assert_eq!(gate.cursor(), (1, 0));
        assert_eq!(
            gate.receive_client_control(binding(2, 1), &ctl(HitControlOp::ClientAck, 1, TOKEN)),
            Err(IngressError::InvalidDelivery(DeliveryError::FutureAck))
        );
        assert_eq!(
            gate.receive_client_control(binding(2, 1), &ctl(HitControlOp::ClientNack, 0, TOKEN)),
            Err(IngressError::InvalidDelivery(DeliveryError::NotSent))
        );
        gate.mark_writer_success(binding(2, 1), 0).unwrap();
        assert_eq!(
            gate.receive_client_control(binding(2, 1), &ctl(HitControlOp::ClientNack, 0, TOKEN)),
            Ok(ClientControlResult::Replay(wire))
        );
        assert_eq!(
            gate.receive_client_control(binding(2, 1), &ctl(HitControlOp::ClientAck, 1, TOKEN)),
            Ok(ClientControlResult::Acknowledged(AckOutcome::Advanced {
                next: 1
            }))
        );
        assert_eq!(
            gate.receive_client_control(binding(2, 1), &ctl(HitControlOp::ClientAck, 1, TOKEN)),
            Ok(ClientControlResult::Acknowledged(AckOutcome::Duplicate {
                next: 1
            }))
        );
        assert_eq!(
            gate.receive_client_control(binding(2, 1), &ctl(HitControlOp::ClientNack, 0, TOKEN)),
            Err(IngressError::InvalidDelivery(DeliveryError::StaleAck))
        );
    }

    #[test]
    fn old_life_wrong_token_and_future_or_stale_messages_denied() {
        let mut gate = granted();
        gate.propose_committed_hit(binding(2, 1), &hit(2, 1), proof(200, 0, 2, 1))
            .unwrap();
        gate.mark_writer_success(binding(2, 1), 0).unwrap();
        let oldlife = binding(2, 2);
        assert_eq!(
            gate.receive_client_control(oldlife, &ctl(HitControlOp::ClientAck, 1, TOKEN)),
            Err(IngressError::ForeignConnection)
        );
        assert_eq!(
            gate.receive_client_control(binding(2, 1), &ctl(HitControlOp::ClientAck, 1, [7; 16])),
            Err(IngressError::InvalidDelivery(DeliveryError::ForeignToken))
        );
        assert_eq!(
            gate.receive_client_control(binding(2, 1), &ctl(HitControlOp::ClientAck, 2, TOKEN)),
            Err(IngressError::InvalidDelivery(DeliveryError::FutureAck))
        );
        assert_eq!(
            gate.receive_client_control(binding(2, 1), &ctl(HitControlOp::ClientNack, 1, TOKEN)),
            Err(IngressError::InvalidDelivery(DeliveryError::NotSent))
        );
        gate.retire();
        assert_eq!(
            gate.receive_client_control(binding(2, 1), &hello()),
            Err(IngressError::Retired)
        );
        assert_eq!(
            gate.receive_client_control(binding(2, 1), &ctl(HitControlOp::ClientAck, 1, TOKEN)),
            Err(IngressError::Retired)
        );
    }

    #[test]
    fn spectator_no_receipt_and_64_pending_overflow_terminal() {
        let mut gate = granted();
        for i in 0..64 {
            gate.propose_committed_hit(binding(2, 1), &hit(2, 1), proof(200, i, 2, 1))
                .unwrap();
        }
        assert_eq!(gate.cursor(), (64, 0));
        assert_eq!(
            gate.propose_committed_hit(binding(2, 1), &hit(2, 1), proof(201, 0, 2, 1)),
            Err(IngressError::InvalidDelivery(
                DeliveryError::PendingOverflow { first_missing: 64 }
            ))
        );
        assert_eq!(
            gate.receive_client_control(binding(2, 1), &ctl(HitControlOp::ClientAck, 0, TOKEN)),
            Err(IngressError::InvalidDelivery(DeliveryError::ScopeGapped))
        );
        let mut bystander =
            ProposedHitControlIngress::for_offline_test(binding(3, 1), [8; 16], 64).unwrap();
        bystander
            .receive_client_control(binding(3, 1), &hello())
            .unwrap();
        assert_eq!(
            bystander
                .propose_committed_hit(binding(3, 1), &hit(2, 1), proof(201, 0, 2, 1))
                .unwrap(),
            None
        );
    }
}
