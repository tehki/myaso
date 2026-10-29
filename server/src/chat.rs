//! Chat C1: opt-in, server-authoritative local chat on separate WebTransport
//! streams. No player-controlled sender IDs, coordinates, Worlds, NPC/system
//! identities, transcripts or combat datagrams.
use std::{
    collections::{BTreeMap, VecDeque},
    time::{Duration, Instant},
};
use tokio::sync::mpsc;

pub const CHAT_VERSION: u8 = 1;
pub const CHAT_CHANNEL_LOCAL: u8 = 1;
pub const CHAT_SEND: u8 = 0x31;
pub const CHAT_RECEIVED: u8 = 0x32;
pub const CHAT_RESULT: u8 = 0x33;
pub const MAX_TEXT_BYTES: usize = 240;
pub const MAX_CHAT_FRAME: usize = 512; // Oversized text still gets a bounded TooLong result.
pub const OUTBOUND_QUEUE: usize = 8;
const MAX_DEDUP: usize = 32;
const BURST: u8 = 4;
const REFILL_INTERVAL: Duration = Duration::from_millis(600);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum ChatCode {
    Accepted = 0,
    NotConnected = 1,
    Unauthorized = 2,
    Invalid = 3,
    TooLong = 4,
    RateLimited = 5,
    ChannelUnavailable = 6,
    Unavailable = 7,
    Duplicate = 8,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChatRequest {
    pub correlation: u32,
    pub text: String,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ChatResult {
    pub correlation: u32,
    pub code: ChatCode,
    pub message_id: u64,
}

pub fn decode_send(frame: &[u8]) -> Result<ChatRequest, ChatCode> {
    if frame.len() < 9 || frame[0] != CHAT_SEND || frame[1] != CHAT_VERSION {
        return Err(ChatCode::Invalid);
    }
    if frame[2] != CHAT_CHANNEL_LOCAL {
        return Err(ChatCode::ChannelUnavailable);
    }
    let correlation = u32::from_le_bytes(frame[3..7].try_into().expect("length checked"));
    if correlation == 0 {
        return Err(ChatCode::Invalid);
    }
    let bytes = u16::from_le_bytes(frame[7..9].try_into().expect("length checked")) as usize;
    if bytes > MAX_TEXT_BYTES {
        return Err(ChatCode::TooLong);
    }
    if bytes == 0 || frame.len() != 9 + bytes {
        return Err(ChatCode::Invalid);
    }
    let text = std::str::from_utf8(&frame[9..]).map_err(|_| ChatCode::Invalid)?;
    if text.trim().is_empty()
        || text.chars().any(|ch| {
            ch.is_control() || matches!(ch, '\u{202a}'..='\u{202e}' | '\u{2066}'..='\u{2069}')
        })
    {
        return Err(ChatCode::Invalid);
    }
    Ok(ChatRequest {
        correlation,
        text: text.to_owned(),
    })
}

/// Every response carries the client correlation and a stable reason.
/// Acceptance means the server authorized and attempted bounded fanout;
/// it does not prove presentation or reading by another client.
pub fn encode_result(result: ChatResult) -> Vec<u8> {
    let mut out = Vec::with_capacity(15);
    out.extend_from_slice(&[CHAT_RESULT, CHAT_VERSION]);
    out.extend_from_slice(&result.correlation.to_le_bytes());
    out.push(result.code as u8);
    out.extend_from_slice(&result.message_id.to_le_bytes());
    out
}

pub fn encode_received(message_id: u64, sender_id: u32, tick: u32, text: &str) -> Vec<u8> {
    let mut out = Vec::with_capacity(21 + text.len());
    out.extend_from_slice(&[CHAT_RECEIVED, CHAT_VERSION, CHAT_CHANNEL_LOCAL]);
    out.extend_from_slice(&message_id.to_le_bytes());
    out.extend_from_slice(&sender_id.to_le_bytes());
    out.extend_from_slice(&tick.to_le_bytes());
    out.extend_from_slice(&(text.len() as u16).to_le_bytes());
    out.extend_from_slice(text.as_bytes());
    out
}
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ChatPosition {
    pub player_id: u32,
    pub world_instance: u64,
    pub lease_epoch: u64,
    pub alive: bool,
    pub x: f32,
    pub y: f32,
}

struct ChatPeer {
    lease_epoch: u64,
    world_instance: u64,
    outgoing: mpsc::Sender<Vec<u8>>,
    tokens: u8,
    last_refill: Instant,
    recent: VecDeque<ChatResult>,
}
impl ChatPeer {
    fn new(
        lease_epoch: u64,
        world_instance: u64,
        outgoing: mpsc::Sender<Vec<u8>>,
        now: Instant,
    ) -> Self {
        Self {
            lease_epoch,
            world_instance,
            outgoing,
            tokens: BURST,
            last_refill: now,
            recent: VecDeque::with_capacity(MAX_DEDUP),
        }
    }
    fn take_token(&mut self, now: Instant) -> bool {
        let elapsed = now.saturating_duration_since(self.last_refill);
        let refill = elapsed.as_millis() / REFILL_INTERVAL.as_millis();
        if refill > 0 {
            self.tokens = (u128::from(self.tokens) + refill).min(u128::from(BURST)) as u8;
            self.last_refill = now;
        }
        if self.tokens == 0 {
            return false;
        }
        self.tokens -= 1;
        true
    }
    fn remember(&mut self, result: ChatResult) {
        if self.recent.len() == MAX_DEDUP {
            self.recent.pop_front();
        }
        self.recent.push_back(result);
    }
}

/// Only current connected players with an active chat stream can receive.
/// This prototype uses a bounded scan of the existing capped 512-player
/// authoritative World; realm scale needs World-partitioned spatial buckets.
#[derive(Default)]
pub struct LocalChatHub {
    peers: BTreeMap<u32, ChatPeer>,
    next_message_id: u64,
}
impl LocalChatHub {
    pub fn register(
        &mut self,
        player_id: u32,
        lease_epoch: u64,
        world_instance: u64,
        outgoing: mpsc::Sender<Vec<u8>>,
        now: Instant,
    ) -> bool {
        if player_id == 0
            || lease_epoch == 0
            || world_instance == 0
            || self.peers.contains_key(&player_id)
        {
            return false;
        }
        self.peers.insert(
            player_id,
            ChatPeer::new(lease_epoch, world_instance, outgoing, now),
        );
        true
    }
    // A late task from an older QUIC connection must never unsubscribe its
    // successor. A new session owns a different server-issued lease.
    pub fn unregister(&mut self, player_id: u32, lease_epoch: u64) {
        if self
            .peers
            .get(&player_id)
            .is_some_and(|p| p.lease_epoch == lease_epoch)
        {
            self.peers.remove(&player_id);
        }
    }
    pub fn route(
        &mut self,
        sender: (u32, u64),
        request: &ChatRequest,
        positions: &[ChatPosition],
        radius: f32,
        tick: u32,
        now: Instant,
    ) -> ChatResult {
        // Both fields come only from current server-owned connection admission.
        let (sender_id, sender_lease) = sender;
        let rejected = |code| ChatResult {
            correlation: request.correlation,
            code,
            message_id: 0,
        };
        let Some(peer) = self.peers.get_mut(&sender_id) else {
            return rejected(ChatCode::Unauthorized);
        };
        if peer.lease_epoch != sender_lease {
            return rejected(ChatCode::Unauthorized);
        }
        if let Some(previous) = peer
            .recent
            .iter()
            .find(|record| record.correlation == request.correlation)
        {
            // Never route a repeated correlation, even when the text differs.
            return ChatResult {
                correlation: previous.correlation,
                code: ChatCode::Duplicate,
                message_id: previous.message_id,
            };
        }
        let Some(sender) = positions
            .iter()
            .find(|position| {
                position.player_id == sender_id
                    && position.lease_epoch == sender_lease
                    && position.world_instance == peer.world_instance
                    && position.alive
            })
            .copied()
        else {
            return rejected(ChatCode::NotConnected);
        };
        if !radius.is_finite() || radius <= 0.0 || !sender.x.is_finite() || !sender.y.is_finite() {
            return rejected(ChatCode::Unavailable);
        }
        if !peer.take_token(now) {
            return rejected(ChatCode::RateLimited);
        }
        let Some(message_id) = self.next_message_id.checked_add(1) else {
            return rejected(ChatCode::Unavailable);
        };
        self.next_message_id = message_id;
        let received = encode_received(message_id, sender_id, tick, &request.text);
        let distance_squared = radius * radius;
        for position in positions {
            if position.player_id == sender_id
                || position.world_instance != sender.world_instance
                || !position.alive
                || !position.x.is_finite()
                || !position.y.is_finite()
            {
                continue;
            }
            let dx = position.x - sender.x;
            let dy = position.y - sender.y;
            if dx * dx + dy * dy <= distance_squared {
                if let Some(recipient) = self.peers.get(&position.player_id).filter(|p| {
                    p.world_instance == sender.world_instance
                        && p.lease_epoch == position.lease_epoch
                }) {
                    // A congested chat consumer loses this low-priority event.
                    // Never block simulation, steal combat queue, or allocate an
                    // unbounded buffer to preserve chat.
                    let _ = recipient.outgoing.try_send(received.clone());
                }
            }
        }
        let result = ChatResult {
            correlation: request.correlation,
            code: ChatCode::Accepted,
            message_id,
        };
        if let Some(peer) = self.peers.get_mut(&sender_id) {
            peer.remember(result);
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn packet(correlation: u32, text: &[u8]) -> Vec<u8> {
        let mut p = vec![CHAT_SEND, CHAT_VERSION, CHAT_CHANNEL_LOCAL];
        p.extend_from_slice(&correlation.to_le_bytes());
        p.extend_from_slice(&(text.len() as u16).to_le_bytes());
        p.extend_from_slice(text);
        p
    }
    fn positions() -> [ChatPosition; 4] {
        [
            ChatPosition {
                player_id: 1,
                world_instance: 1,
                lease_epoch: 1,
                alive: true,
                x: 50.0,
                y: 50.0,
            },
            ChatPosition {
                player_id: 2,
                world_instance: 1,
                lease_epoch: 2,
                alive: true,
                x: 90.0,
                y: 70.0,
            },
            ChatPosition {
                player_id: 3,
                world_instance: 1,
                lease_epoch: 3,
                alive: true,
                x: 800.0,
                y: 800.0,
            },
            ChatPosition {
                player_id: 4,
                world_instance: 2,
                lease_epoch: 4,
                alive: true,
                x: 51.0,
                y: 50.0,
            },
        ]
    }
    #[test]
    fn rejects_malformed_utf8_controls_and_oversized_without_panic() {
        for sample in [
            vec![],
            vec![4],
            packet(1, b""),
            packet(1, b"   "),
            packet(1, b"x\ny"),
            packet(1, &[0xff]),
            packet(1, &vec![b'x'; 241]),
        ] {
            assert!(decode_send(&sample).is_err(), "should reject {sample:?}");
        }
        assert_eq!(decode_send(&packet(0, b"x")), Err(ChatCode::Invalid));
        let mut invalid = packet(1, b"hello");
        invalid[2] = 4;
        assert_eq!(decode_send(&invalid), Err(ChatCode::ChannelUnavailable));
        invalid = packet(1, b"hi");
        invalid[1] = 12;
        assert_eq!(decode_send(&invalid), Err(ChatCode::Invalid));
        assert_eq!(
            decode_send(&packet(2, "Привет 🌕".as_bytes()))
                .unwrap()
                .text,
            "Привет 🌕"
        );
    }
    #[test]
    fn local_fanout_excludes_distant_and_other_zone() {
        let now = Instant::now();
        let mut hub = LocalChatHub::default();
        let mut receivers = Vec::new();
        for id in 1..=4 {
            let (tx, rx) = mpsc::channel(OUTBOUND_QUEUE);
            assert!(hub.register(id, id as u64, if id == 4 { 2 } else { 1 }, tx, now));
            receivers.push(rx);
        }
        let request = decode_send(&packet(10, b"Greetings!")).unwrap();
        let result = hub.route((1, 1), &request, &positions(), 160.0, 123, now);
        assert_eq!(result.code, ChatCode::Accepted);
        let received = receivers[1].try_recv().unwrap();
        assert_eq!(received[0], CHAT_RECEIVED);
        assert_eq!(u32::from_le_bytes(received[11..15].try_into().unwrap()), 1);
        assert!(receivers[2].try_recv().is_err());
        assert!(receivers[3].try_recv().is_err());
    }
    #[test]
    fn retry_never_duplicates_and_per_sender_token_bucket_is_bounded() {
        let now = Instant::now();
        let mut hub = LocalChatHub::default();
        let (a, _) = mpsc::channel(OUTBOUND_QUEUE);
        let (b, mut rx) = mpsc::channel(OUTBOUND_QUEUE);
        assert!(hub.register(1, 1, 1, a, now) && hub.register(2, 2, 1, b, now));
        let req = ChatRequest {
            correlation: 1,
            text: "hello".into(),
        };
        assert_eq!(
            hub.route((1, 1), &req, &positions(), 160.0, 1, now).code,
            ChatCode::Accepted
        );
        assert_eq!(
            hub.route((1, 1), &req, &positions(), 160.0, 1, now).code,
            ChatCode::Duplicate
        );
        assert!(rx.try_recv().is_ok());
        assert!(rx.try_recv().is_err());
        for id in 2..=4 {
            let q = ChatRequest {
                correlation: id,
                text: "spam".into(),
            };
            assert_eq!(
                hub.route((1, 1), &q, &positions(), 160.0, 1, now).code,
                ChatCode::Accepted
            );
        }
        let q = ChatRequest {
            correlation: 5,
            text: "spam".into(),
        };
        assert_eq!(
            hub.route((1, 1), &q, &positions(), 160.0, 1, now).code,
            ChatCode::RateLimited
        );
        assert_eq!(
            hub.route(
                (1, 1),
                &q,
                &positions(),
                160.0,
                1,
                now + Duration::from_millis(600)
            )
            .code,
            ChatCode::Accepted
        );
    }
    #[test]
    fn disconnect_revokes_sender_and_slow_receiver_cannot_block_other_players() {
        let now = Instant::now();
        let mut hub = LocalChatHub::default();
        let (a, _) = mpsc::channel(OUTBOUND_QUEUE);
        let (b, _slow) = mpsc::channel(1);
        let (c, mut quick) = mpsc::channel(OUTBOUND_QUEUE);
        hub.register(1, 1, 1, a, now);
        hub.register(2, 2, 1, b, now);
        hub.register(3, 3, 1, c, now);
        let positions = [
            ChatPosition {
                player_id: 1,
                world_instance: 1,
                lease_epoch: 1,
                alive: true,
                x: 0.0,
                y: 0.0,
            },
            ChatPosition {
                player_id: 2,
                world_instance: 1,
                lease_epoch: 2,
                alive: true,
                x: 1.0,
                y: 1.0,
            },
            ChatPosition {
                player_id: 3,
                world_instance: 1,
                lease_epoch: 3,
                alive: true,
                x: 1.0,
                y: 1.0,
            },
        ];
        for id in 1..=2 {
            let q = ChatRequest {
                correlation: id,
                text: "hi".into(),
            };
            assert_eq!(
                hub.route((1, 1), &q, &positions, 10.0, 1, now).code,
                ChatCode::Accepted
            );
        }
        assert!(quick.try_recv().is_ok() && quick.try_recv().is_ok());
        hub.unregister(1, 1);
        assert_eq!(
            hub.route(
                (1, 1),
                &ChatRequest {
                    correlation: 3,
                    text: "stale".into()
                },
                &positions,
                10.0,
                1,
                now
            )
            .code,
            ChatCode::Unauthorized
        );
    }

    #[test]
    fn server_world_lease_and_membership_are_mandatory_even_with_reused_player_id() {
        let now = Instant::now();
        let mut hub = LocalChatHub::default();
        let (a, _) = mpsc::channel(OUTBOUND_QUEUE);
        let (b, mut near) = mpsc::channel(OUTBOUND_QUEUE);
        let (c, mut other_world) = mpsc::channel(OUTBOUND_QUEUE);
        assert!(hub.register(1, 11, 17, a, now));
        assert!(hub.register(2, 22, 17, b, now));
        assert!(hub.register(3, 33, 18, c, now));
        let request = ChatRequest {
            correlation: 1,
            text: "hello".to_string(),
        };
        let mut positions = [
            ChatPosition {
                player_id: 1,
                world_instance: 17,
                lease_epoch: 11,
                alive: true,
                x: 0.0,
                y: 0.0,
            },
            ChatPosition {
                player_id: 2,
                world_instance: 17,
                lease_epoch: 22,
                alive: true,
                x: 160.0,
                y: 0.0,
            },
            ChatPosition {
                player_id: 3,
                world_instance: 18,
                lease_epoch: 33,
                alive: true,
                x: 0.0,
                y: 0.0,
            },
        ];
        assert_eq!(
            hub.route((1, 11), &request, &positions, 160.0, 1, now).code,
            ChatCode::Accepted
        );
        assert!(near.try_recv().is_ok());
        assert!(other_world.try_recv().is_err());
        positions[1].x = 160.01;
        assert_eq!(
            hub.route(
                (1, 11),
                &ChatRequest {
                    correlation: 2,
                    text: "far".into()
                },
                &positions,
                160.0,
                2,
                now
            )
            .code,
            ChatCode::Accepted
        );
        assert!(near.try_recv().is_err());
        positions[1].x = 0.0;
        positions[1].alive = false; // Dead players do not receive local chat.
        assert_eq!(
            hub.route(
                (1, 11),
                &ChatRequest {
                    correlation: 3,
                    text: "dead".into()
                },
                &positions,
                160.0,
                3,
                now
            )
            .code,
            ChatCode::Accepted
        );
        assert!(near.try_recv().is_err());
        positions[1].alive = true; // Same authenticated session after respawn.
        assert_eq!(
            hub.route(
                (1, 11),
                &ChatRequest {
                    correlation: 4,
                    text: "respawned".into()
                },
                &positions,
                160.0,
                4,
                now
            )
            .code,
            ChatCode::Accepted
        );
        assert!(near.try_recv().is_ok());
        assert_eq!(
            hub.route(
                (1, 999),
                &ChatRequest {
                    correlation: 5,
                    text: "spoof".into()
                },
                &positions,
                160.0,
                5,
                now
            )
            .code,
            ChatCode::Unauthorized
        );
        assert!(near.try_recv().is_err());
        hub.unregister(1, 11);
        let (next, _) = mpsc::channel(OUTBOUND_QUEUE);
        assert!(hub.register(1, 44, 17, next, now));
        hub.unregister(1, 11); // Late old task cannot remove new subscription.
        positions[0].lease_epoch = 44;
        assert_eq!(
            hub.route(
                (1, 11),
                &ChatRequest {
                    correlation: 6,
                    text: "old".into()
                },
                &positions,
                160.0,
                6,
                now
            )
            .code,
            ChatCode::Unauthorized
        );
        assert_eq!(
            hub.route(
                (1, 44),
                &ChatRequest {
                    correlation: 6,
                    text: "new".into()
                },
                &positions,
                160.0,
                6,
                now
            )
            .code,
            ChatCode::Accepted
        );
        assert!(near.try_recv().is_ok());
        positions[0].world_instance = 19; // Teleport to a different World.
        assert_eq!(
            hub.route(
                (1, 44),
                &ChatRequest {
                    correlation: 7,
                    text: "crossworld".into()
                },
                &positions,
                160.0,
                7,
                now
            )
            .code,
            ChatCode::NotConnected
        );
        assert!(near.try_recv().is_err());
    }

    #[test]
    fn all_encoder_sizes_bounded() {
        let txt = "z".repeat(240);
        assert!(encode_received(1, 7, 1, &txt).len() <= MAX_CHAT_FRAME);
        assert_eq!(
            encode_result(ChatResult {
                correlation: 1,
                code: ChatCode::Accepted,
                message_id: 1
            })
            .len(),
            15
        );
    }
}
