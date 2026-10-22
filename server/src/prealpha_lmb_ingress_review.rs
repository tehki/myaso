//! Core 8A DORMANT review-only server gate for the Combat4 v2 gesture ABI.
//!
//! No caller in the actual QUIC server, World tick, UI, or Combat runtime.
//! In particular this does NOT authenticate a connection or send real ACKs.
//! Future 8C ingress must create LeaseKey ONLY after a trusted admitted QUIC
//! actor/session/epoch check, recheck the lease at World dispatch, and fence
//! death/respawn/disconnect. Client bytes NEVER contain this LeaseKey.
//! This model consumes Combat4's 16-byte v2 EVENT 0x11 and would produce its
//! 16-byte ACK 0x12. It does NOT support alternative 8C proposal type 0x52.
use crate::prealpha_lmb_gesture_proposal::{
    decode_event, AckStatus, GestureAck, GestureAction, GestureEvent,
};
use std::collections::{BTreeMap, VecDeque};

const MAX_GAP: u32 = 16;
const MAX_BUFFERED: usize = 16;
const MAX_ACCEPTED_HISTORY: usize = 128;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TrustedLeaseKey {
    actor_net_id: u32,
    generation: u64,
    connection_nonce: u64,
}
impl TrustedLeaseKey {
    /// REVIEW ONLY. Real authority must come from Core8C connection admission,
    /// NOT from this constructor, a packet field, or a browser-supplied ID.
    pub fn review_from_admission(
        actor_net_id: u32,
        generation: u64,
        connection_nonce: u64,
    ) -> Option<Self> {
        if actor_net_id == 0 || generation == 0 || connection_nonce == 0 {
            return None;
        }
        Some(Self {
            actor_net_id,
            generation,
            connection_nonce,
        })
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AcceptedEdge {
    /// Still transport-only. Combat4 alone decides legal action/hit/damage.
    pub event: GestureEvent,
    pub ack: GestureAck,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum IngressResult {
    /// Original events in contiguous sequence order; do not infer combat HIT.
    Accepted(Vec<AcceptedEdge>),
    /// Missing lower sequence. Intentionally no ACK until the gap is resolved.
    Deferred,
    Duplicate(GestureAck),
    Stale(GestureAck),
    Rejected(Option<GestureAck>),
}
#[derive(Clone, Copy, Debug)]
struct ActiveGesture {
    id: u32,
    upgraded: bool,
}
/// Bounded, in-memory, single-QUIC-lease REVIEW MODEL; not durable / not live.
pub struct ReviewLmbIngress {
    lease: TrustedLeaseKey,
    expected_seq: u64,
    latest_gesture_id: u32,
    active: Option<ActiveGesture>,
    buffered: BTreeMap<u32, GestureEvent>,
    seen: VecDeque<GestureEvent>,
    closed: bool,
}
impl ReviewLmbIngress {
    pub fn new_from_trusted_admission(lease: TrustedLeaseKey) -> Self {
        Self {
            lease,
            expected_seq: 1,
            latest_gesture_id: 0,
            active: None,
            buffered: BTreeMap::new(),
            seen: VecDeque::new(),
            closed: false,
        }
    }
    pub fn is_closed(&self) -> bool {
        self.closed
    }
    pub fn buffered_count(&self) -> usize {
        self.buffered.len()
    }
    pub fn accepted_count(&self) -> usize {
        self.seen.len()
    }
    pub fn close(&mut self) {
        self.closed = true;
        self.buffered.clear();
        self.active = None;
    }
    fn ack(event: GestureEvent, status: AckStatus, server_tick: u32) -> GestureAck {
        GestureAck {
            status,
            sequence: event.sequence,
            gesture_id: event.gesture_id,
            server_tick,
        }
    }

    /// Only called after an externally authenticated connection+actor lease
    /// check. `server_tick` must come from the true World authority; this model
    /// does not verify a tick or dispatch actions. No live ingress is attached.
    pub fn review_ingest(
        &mut self,
        current_trusted_lease: TrustedLeaseKey,
        packet: &[u8],
        server_tick: u32,
    ) -> IngressResult {
        if self.closed {
            return IngressResult::Rejected(None);
        }
        let event = match decode_event(packet) {
            Ok(event) => event,
            Err(_) => {
                self.close();
                return IngressResult::Rejected(None);
            }
        };
        if current_trusted_lease != self.lease {
            return IngressResult::Stale(Self::ack(event, AckStatus::Stale, server_tick));
        }

        let seq = u64::from(event.sequence);
        if seq < self.expected_seq {
            // An ACK for a replay is safe only if its FULL original event
            // (including action and diagnostic clock) is byte-equivalent.
            // Never affirm an equivocal same-sequence mutation as duplicate.
            if self.seen.iter().any(|saved| {
                saved.sequence == event.sequence && *saved != event
            }) {
                self.close();
                return IngressResult::Rejected(Some(Self::ack(
                    event, AckStatus::Rejected, server_tick,
                )));
            }
            let previously_accepted = self.seen.contains(&event);
            let status = if previously_accepted {
                AckStatus::Duplicate
            } else {
                AckStatus::Stale
            };
            let ack = Self::ack(event, status, server_tick);
            return if previously_accepted {
                IngressResult::Duplicate(ack)
            } else {
                IngressResult::Stale(ack)
            };
        }
        if seq > self.expected_seq {
            // Missing seq must be replayed: no speculative ACCEPTED ACK.
            if seq - self.expected_seq > u64::from(MAX_GAP)
                || (self.buffered.len() >= MAX_BUFFERED
                    && !self.buffered.contains_key(&event.sequence))
            {
                self.close();
                return IngressResult::Rejected(Some(Self::ack(
                    event,
                    AckStatus::Rejected,
                    server_tick,
                )));
            }
            if let Some(previous) = self.buffered.get(&event.sequence) {
                if *previous != event {
                    self.close();
                    return IngressResult::Rejected(Some(Self::ack(
                        event,
                        AckStatus::Rejected,
                        server_tick,
                    )));
                }
                return IngressResult::Deferred;
            }
            self.buffered.insert(event.sequence, event);
            return IngressResult::Deferred;
        }

        // Stage the entire immediately contiguous batch BEFORE emitting any
        // accepted edge: an invalid buffered RELEASE must not partially apply.
        let mut batch = vec![event];
        let mut following = self.expected_seq + 1;
        while following <= u64::from(u32::MAX) {
            if let Some(next) = self.buffered.get(&(following as u32)) {
                batch.push(*next);
                following += 1;
            } else {
                break;
            }
        }

        let mut active = self.active;
        let mut last_id = self.latest_gesture_id;
        for edge in &batch {
            let legal = match edge.action {
                GestureAction::Press => {
                    if active.is_none() && edge.gesture_id > last_id {
                        last_id = edge.gesture_id;
                        active = Some(ActiveGesture {
                            id: edge.gesture_id,
                            upgraded: false,
                        });
                        true
                    } else {
                        false
                    }
                }
                GestureAction::Upgrade => match &mut active {
                    Some(gesture) if gesture.id == edge.gesture_id && !gesture.upgraded => {
                        gesture.upgraded = true;
                        true
                    }
                    _ => false,
                },
                GestureAction::Release | GestureAction::Cancel => {
                    if active.is_some_and(|gesture| gesture.id == edge.gesture_id) {
                        active = None;
                        true
                    } else {
                        false
                    }
                }
            };
            if !legal {
                let rejected = Self::ack(*edge, AckStatus::Rejected, server_tick);
                self.close();
                return IngressResult::Rejected(Some(rejected));
            }
        }

        self.active = active;
        self.latest_gesture_id = last_id;
        let mut accepted = Vec::with_capacity(batch.len());
        for edge in batch {
            self.buffered.remove(&edge.sequence);
            self.seen.push_back(edge);
            if self.seen.len() > MAX_ACCEPTED_HISTORY {
                self.seen.pop_front();
            }
            accepted.push(AcceptedEdge {
                event: edge,
                ack: Self::ack(edge, AckStatus::Accepted, server_tick),
            });
            self.expected_seq += 1;
        }
        // A full u32 sequence may not roll to 1 within this lease.
        if self.expected_seq > u64::from(u32::MAX) {
            self.closed = true;
        }
        IngressResult::Accepted(accepted)
    }
}
