//! P4: inactive, server-to-client-only semantic magic FX envelope.
//!
//! A trusted game-server spell integrator may *eventually* call admit_trusted.
//! No player command, spell authorization, mana, collision, network socket or
//! production cast path calls this module. Particles are NEVER server objects.

use std::collections::VecDeque;

use crate::elemental_physics::Element;

pub const MAGIC_FX_WIRE_VERSION: u8 = 1;
pub const MAGIC_FX_PACKET_BYTES: usize = 32;
pub const MAX_PENDING_FX_EVENTS: usize = 256;
pub const MAX_FX_EVENTS_PER_TICK: usize = 12;
pub const MAX_FX_EVENTS_PER_ZONE: usize = 48;
pub const MAX_VIEWER_FX_EVENTS: usize = 16;
pub const MAX_VIEWER_RADIUS: f32 = 1_500.0;
pub const MAX_EFFECT_TTL_TICKS: u8 = 120;
const MAX_COORDINATE: f32 = 1_000_000.0;
const COORD_SCALE: f32 = 4.0;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TrustedEffectSpec {
    pub zone_id: u32,
    pub x: f32,
    pub y: f32,
    pub element: Element,
    pub seed: u32,
    /// Quantized visual-only intensity from 1 to 255.
    pub intensity: u8,
    pub ttl_ticks: u8,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SemanticEffect {
    pub event_id: u32,
    pub server_tick: u32,
    pub expires_at: u64,
    pub spec: TrustedEffectSpec,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ViewerInterest {
    pub zone_id: u32,
    pub x: f32,
    pub y: f32,
    pub radius: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FxError {
    InvalidTick,
    InvalidEffect,
    OverloadedTick,
    OverloadedZone,
    OverloadedRealm,
    IdExhausted,
}

fn valid_coordinate(value: f32) -> bool {
    value.is_finite() && value.abs() <= MAX_COORDINATE
}

fn valid_spec(spec: &TrustedEffectSpec) -> bool {
    spec.zone_id != 0
        && valid_coordinate(spec.x)
        && valid_coordinate(spec.y)
        && spec.intensity != 0
        && (1..=MAX_EFFECT_TTL_TICKS).contains(&spec.ttl_ticks)
}

fn valid_viewer(view: &ViewerInterest) -> bool {
    view.zone_id != 0
        && valid_coordinate(view.x)
        && valid_coordinate(view.y)
        && view.radius.is_finite()
        && (0.0..=MAX_VIEWER_RADIUS).contains(&view.radius)
}

/// A compact server-owned, bounded store. This is deliberately not an actual
/// networking queue; real delivery needs reviewed interest + tick integration.
#[derive(Debug)]
pub struct SemanticEffectBroker {
    events: VecDeque<SemanticEffect>,
    now_tick: Option<u64>,
    next_event_id: u32,
    emitted_this_tick: usize,
}

impl Default for SemanticEffectBroker {
    fn default() -> Self {
        Self::new()
    }
}

impl SemanticEffectBroker {
    pub fn new() -> Self {
        Self {
            events: VecDeque::new(),
            now_tick: None,
            next_event_id: 1,
            emitted_this_tick: 0,
        }
    }

    /// The caller supplies a strictly increasing, trusted authoritative tick.
    /// At this boundary no browser clock or untrusted tick is accepted.
    pub fn advance(&mut self, tick: u64) -> Result<(), FxError> {
        if tick == 0 || self.now_tick.is_some_and(|previous| tick <= previous) {
            return Err(FxError::InvalidTick);
        }
        self.now_tick = Some(tick);
        self.emitted_this_tick = 0;
        self.events.retain(|effect| effect.expires_at > tick);
        Ok(())
    }

    /// Only a future server-authenticated, fully validated cast/impact may
    /// supply TrustedEffectSpec. This method does NOT authenticate the caster.
    pub fn admit_trusted(&mut self, tick: u64, spec: TrustedEffectSpec) -> Result<u32, FxError> {
        if self.now_tick != Some(tick) {
            return Err(FxError::InvalidTick);
        }
        if !valid_spec(&spec) {
            return Err(FxError::InvalidEffect);
        }
        if self.emitted_this_tick >= MAX_FX_EVENTS_PER_TICK {
            return Err(FxError::OverloadedTick);
        }
        if self.events.len() >= MAX_PENDING_FX_EVENTS {
            return Err(FxError::OverloadedRealm);
        }
        if self
            .events
            .iter()
            .filter(|effect| effect.spec.zone_id == spec.zone_id)
            .count()
            >= MAX_FX_EVENTS_PER_ZONE
        {
            return Err(FxError::OverloadedZone);
        }
        if self.next_event_id == u32::MAX {
            return Err(FxError::IdExhausted);
        }
        let expires_at = tick
            .checked_add(u64::from(spec.ttl_ticks))
            .ok_or(FxError::InvalidTick)?;
        let event_id = self.next_event_id;
        self.next_event_id += 1;
        self.events.push_back(SemanticEffect {
            event_id,
            server_tick: tick as u32,
            expires_at,
            spec,
        });
        self.emitted_this_tick += 1;
        Ok(event_id)
    }

    pub fn pending(&self) -> usize {
        self.events.len()
    }

    /// All filters run BEFORE any future serialization/transmission.
    /// Caller must derive ViewerInterest.zone_id / position from server-owned
    /// authenticated player state, never from a client request.
    ///
    /// after_id is a monotonic per-session delivery cursor, *not* an
    /// authorization token. Delivery semantics/ack/replay are not wired.
    pub fn interest_snapshot(
        &self,
        viewer: ViewerInterest,
        after_id: u32,
        limit: usize,
    ) -> Vec<SemanticEffect> {
        if !valid_viewer(&viewer) || limit == 0 {
            return Vec::new();
        }
        let limit = limit.min(MAX_VIEWER_FX_EVENTS);
        let radius_sq = viewer.radius * viewer.radius;
        self.events
            .iter()
            .filter(|effect| {
                if effect.event_id <= after_id || effect.spec.zone_id != viewer.zone_id {
                    return false;
                }
                let dx = effect.spec.x - viewer.x;
                let dy = effect.spec.y - viewer.y;
                dx.abs() <= viewer.radius && dy.abs() <= viewer.radius
                    && dx * dx + dy * dy <= radius_sq
            })
            .take(limit)
            .copied()
            .collect()
    }
}

fn element_wire(element: Element) -> u8 {
    match element {
        Element::Fire => 0,
        Element::Ice => 1,
        Element::Lightning => 2,
        Element::Wind => 3,
        Element::Arcane => 4,
    }
}

/// An explicit 32-byte **proposed** P4 framing. Not registered in live
/// PROTOCOL_VERSION / PACKET_TYPE, and no transport currently uses it.
///
/// Layout LE: "ME", version=1, kind, zone_id:u32, event_id:u32,
/// server_tick:u32, seed:u32, x_i32*4, y_i32*4, intensity:u8,
/// ttl_ticks:u8, reserved:u16=0.
pub fn encode_magic_fx(event: &SemanticEffect) -> Option<[u8; MAGIC_FX_PACKET_BYTES]> {
    if event.event_id == 0
        || event.spec.zone_id == 0
        || !valid_spec(&event.spec)
        || event.expires_at == 0
    {
        return None;
    }
    let x = (event.spec.x * COORD_SCALE).round() as i32;
    let y = (event.spec.y * COORD_SCALE).round() as i32;
    let mut bytes = [0u8; MAGIC_FX_PACKET_BYTES];
    bytes[0] = b'M';
    bytes[1] = b'E';
    bytes[2] = MAGIC_FX_WIRE_VERSION;
    bytes[3] = element_wire(event.spec.element);
    bytes[4..8].copy_from_slice(&event.spec.zone_id.to_le_bytes());
    bytes[8..12].copy_from_slice(&event.event_id.to_le_bytes());
    bytes[12..16].copy_from_slice(&event.server_tick.to_le_bytes());
    bytes[16..20].copy_from_slice(&event.spec.seed.to_le_bytes());
    bytes[20..24].copy_from_slice(&x.to_le_bytes());
    bytes[24..28].copy_from_slice(&y.to_le_bytes());
    bytes[28] = event.spec.intensity;
    bytes[29] = event.spec.ttl_ticks;
    Some(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fire(zone_id: u32, x: f32) -> TrustedEffectSpec {
        TrustedEffectSpec {
            zone_id,
            x,
            y: -7.25,
            element: Element::Fire,
            seed: 0x1122_3344,
            intensity: 128,
            ttl_ticks: 45,
        }
    }

    fn viewer(zone_id: u32, x: f32) -> ViewerInterest {
        ViewerInterest {
            zone_id,
            x,
            y: -7.25,
            radius: 700.0,
        }
    }

    #[test]
    fn portable_protocol_vector_uses_exact_32_byte_layout() {
        let mut broker = SemanticEffectBroker::new();
        broker.advance(100).unwrap();
        let id = broker.admit_trusted(100, fire(7, 12.5)).unwrap();
        assert_eq!(id, 1);
        let event = broker.interest_snapshot(viewer(7, 12.5), 0, 5)[0];
        assert_eq!(
            encode_magic_fx(&event).unwrap(),
            [
                0x4d, 0x45, 1, 0, 7, 0, 0, 0, 1, 0, 0, 0, 100, 0, 0, 0,
                0x44, 0x33, 0x22, 0x11, 50, 0, 0, 0, 0xe3, 0xff, 0xff, 0xff,
                128, 45, 0, 0,
            ]
        );
    }

    #[test]
    fn filters_before_delivery_by_zone_distance_and_delivery_cursor() {
        let mut broker = SemanticEffectBroker::new();
        broker.advance(200).unwrap();
        let first = broker.admit_trusted(200, fire(7, 100.0)).unwrap();
        broker.admit_trusted(200, fire(8, 100.0)).unwrap();
        broker.admit_trusted(200, fire(7, 1_000.0)).unwrap();
        let found = broker.interest_snapshot(viewer(7, 100.0), 0, 16);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].event_id, first);
        assert_eq!(broker.interest_snapshot(viewer(7, 100.0), first, 16).len(), 0);
        assert!(broker.interest_snapshot(viewer(0, 100.0), 0, 16).is_empty());
        assert!(broker.interest_snapshot(viewer(7, f32::NAN), 0, 16).is_empty());
        assert!(broker.interest_snapshot(viewer(7, 100.0), 0, 0).is_empty());
    }

    #[test]
    fn maximum_per_viewer_budget_is_enforced_in_crowd() {
        let mut broker = SemanticEffectBroker::new();
        for tick in 1..=3 {
            broker.advance(tick).unwrap();
            for offset in 0..MAX_FX_EVENTS_PER_TICK {
                broker.admit_trusted(tick, fire(7, offset as f32)).unwrap();
            }
        }
        assert_eq!(broker.interest_snapshot(viewer(7, 0.0), 0, 900).len(), MAX_VIEWER_FX_EVENTS);
        assert_eq!(broker.pending(), 36);
    }

    #[test]
    fn per_tick_zone_and_realm_budgets_reject_work_without_eviction() {
        let mut broker = SemanticEffectBroker::new();
        for tick in 1..=4 {
            broker.advance(tick).unwrap();
            for i in 0..MAX_FX_EVENTS_PER_TICK {
                broker.admit_trusted(tick, fire(7, i as f32)).unwrap();
            }
        }
        assert_eq!(broker.pending(), MAX_FX_EVENTS_PER_ZONE);
        broker.advance(5).unwrap();
        assert_eq!(broker.admit_trusted(5, fire(7, 0.0)), Err(FxError::OverloadedZone));
        assert_eq!(broker.pending(), MAX_FX_EVENTS_PER_ZONE);
        broker.admit_trusted(5, fire(8, 0.0)).unwrap();
    }

    #[test]
    fn rejects_stale_ticks_invalid_coordinates_and_malformed_event_intensity() {
        let mut broker = SemanticEffectBroker::new();
        assert_eq!(broker.admit_trusted(1, fire(7, 0.0)), Err(FxError::InvalidTick));
        assert_eq!(broker.advance(0), Err(FxError::InvalidTick));
        broker.advance(12).unwrap();
        assert_eq!(broker.advance(11), Err(FxError::InvalidTick));
        assert_eq!(broker.advance(12), Err(FxError::InvalidTick));
        assert_eq!(broker.admit_trusted(11, fire(7, 0.0)), Err(FxError::InvalidTick));
        let mut invalid = fire(7, f32::NAN);
        assert_eq!(broker.admit_trusted(12, invalid), Err(FxError::InvalidEffect));
        invalid = fire(0, 10.0);
        assert_eq!(broker.admit_trusted(12, invalid), Err(FxError::InvalidEffect));
        invalid = fire(7, 10.0);
        invalid.intensity = 0;
        assert_eq!(broker.admit_trusted(12, invalid), Err(FxError::InvalidEffect));
        invalid.intensity = 1;
        invalid.ttl_ticks = 121;
        assert_eq!(broker.admit_trusted(12, invalid), Err(FxError::InvalidEffect));
        assert_eq!(broker.pending(), 0);
    }

    #[test]
    fn expiry_removes_stale_fx_and_cannot_persist_after_tick_resume() {
        let mut broker = SemanticEffectBroker::new();
        broker.advance(100).unwrap();
        broker.admit_trusted(100, fire(7, 0.0)).unwrap();
        broker.advance(144).unwrap();
        assert_eq!(broker.pending(), 1);
        broker.advance(145).unwrap();
        assert_eq!(broker.pending(), 0);
        broker.advance(99999).unwrap();
        assert_eq!(broker.pending(), 0);
    }

    #[test]
    fn broker_returns_read_only_copies_and_does_not_affect_authoritative_state() {
        let mut broker = SemanticEffectBroker::new();
        broker.advance(10).unwrap();
        broker.admit_trusted(10, fire(7, 0.0)).unwrap();
        let mut copies = broker.interest_snapshot(viewer(7, 0.0), 0, 16);
        copies[0].spec.x = 999.0;
        assert_eq!(broker.interest_snapshot(viewer(7, 0.0), 0, 16)[0].spec.x, 0.0);
    }
}
