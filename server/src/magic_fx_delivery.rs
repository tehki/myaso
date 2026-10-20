//! P6: inactive multi-zone semantic FX sharding and payload-only delivery budgets.
//!
//! A trusted Core & Multiplayer integration must supply registered zone IDs,
//! authenticated session state, viewer positions and the authoritative tick.
//! This planner NEVER writes to sockets, processes input, or changes combat.
//! Gameplay messages remain outside all FX budgets.

use std::collections::BTreeMap;

use crate::magic_fx_events::{
    encode_magic_fx, FxError, SemanticEffectBroker, TrustedEffectSpec, ViewerInterest,
    MAGIC_FX_PACKET_BYTES, MAX_VIEWER_RADIUS,
};

pub const MAX_FX_ZONE_SHARDS: usize = 16;
pub const MAX_FX_DELIVERY_PER_VIEWER: usize = 6;
pub const MAX_FX_PAYLOAD_BYTES_PER_VIEWER_TICK: usize =
    MAX_FX_DELIVERY_PER_VIEWER * MAGIC_FX_PACKET_BYTES;
pub const MAX_FX_PAYLOAD_BYTES_PER_ZONE_TICK: usize = 4_096;
pub const MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK: usize = 16_384;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShardError {
    InvalidZone,
    ZoneExists,
    ZoneCapacity,
    UnknownZone,
    InvalidTick,
    InvalidViewer,
    InvalidSession,
    WrongSessionZone,
    SessionAlreadyPolled,
    UnencodableEvent,
    Broker(FxError),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FxDeliverySession {
    pub authenticated_net_id: u32,
    pub zone_id: u32,
    /// Monotonic zone-local event cursor. Never interpret as an auth token.
    pub last_event_id: u32,
    last_poll_tick: Option<u64>,
}

impl FxDeliverySession {
    /// The caller must validate that authenticated_net_id and zone ownership
    /// are derived from the existing server connection, not from this struct.
    pub fn new(authenticated_net_id: u32, server_owned_zone_id: u32) -> Result<Self, ShardError> {
        if authenticated_net_id == 0 || server_owned_zone_id == 0 {
            return Err(ShardError::InvalidSession);
        }
        Ok(Self {
            authenticated_net_id,
            zone_id: server_owned_zone_id,
            last_event_id: 0,
            last_poll_tick: None,
        })
    }

    /// ONLY call after trusted server admission/portal transition or a
    /// verified reconnect. IDs are zone-local and reset at this boundary.
    pub fn reset_authorized_zone(&mut self, server_owned_zone_id: u32) -> Result<(), ShardError> {
        if server_owned_zone_id == 0 {
            return Err(ShardError::InvalidZone);
        }
        self.zone_id = server_owned_zone_id;
        self.last_event_id = 0;
        self.last_poll_tick = None;
        Ok(())
    }
}

#[derive(Debug, Default)]
struct ZoneShard {
    broker: SemanticEffectBroker,
    payload_bytes_this_tick: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ShardBudgetStats {
    pub zone_shards: usize,
    pub pending_fx: usize,
    pub global_payload_bytes_this_tick: usize,
    pub max_global_payload_bytes_per_tick: usize,
}

#[derive(Debug, Default)]
pub struct ShardedMagicFxHub {
    shards: BTreeMap<u32, ZoneShard>,
    current_tick: Option<u64>,
    global_payload_bytes_this_tick: usize,
}

impl ShardedMagicFxHub {
    pub fn new() -> Self {
        Self::default()
    }

    /// Zone allocation is explicit. This does not register or transfer a
    /// player; a zone ID cannot originate in an FX packet/client request.
    pub fn register_zone(&mut self, server_zone_id: u32) -> Result<(), ShardError> {
        if server_zone_id == 0 {
            return Err(ShardError::InvalidZone);
        }
        if self.shards.contains_key(&server_zone_id) {
            return Err(ShardError::ZoneExists);
        }
        if self.shards.len() >= MAX_FX_ZONE_SHARDS {
            return Err(ShardError::ZoneCapacity);
        }
        let mut shard = ZoneShard::default();
        if let Some(tick) = self.current_tick {
            shard.broker.advance(tick).map_err(ShardError::Broker)?;
        }
        self.shards.insert(server_zone_id, shard);
        Ok(())
    }

    /// Per-process server tick, monotonic and shared across registered zones.
    pub fn advance(&mut self, trusted_tick: u64) -> Result<(), ShardError> {
        if trusted_tick == 0
            || self
                .current_tick
                .is_some_and(|previous| trusted_tick <= previous)
        {
            return Err(ShardError::InvalidTick);
        }
        for shard in self.shards.values_mut() {
            shard.broker.advance(trusted_tick).map_err(ShardError::Broker)?;
            shard.payload_bytes_this_tick = 0;
        }
        self.current_tick = Some(trusted_tick);
        self.global_payload_bytes_this_tick = 0;
        Ok(())
    }

    /// Only called by a separately authenticated game-server cast or impact.
    /// P4's per-tick, per-zone and expiry caps remain enforced per shard.
    pub fn admit_trusted(
        &mut self,
        trusted_tick: u64,
        effect: TrustedEffectSpec,
    ) -> Result<u32, ShardError> {
        if self.current_tick != Some(trusted_tick) {
            return Err(ShardError::InvalidTick);
        }
        let shard = self
            .shards
            .get_mut(&effect.zone_id)
            .ok_or(ShardError::UnknownZone)?;
        shard
            .broker
            .admit_trusted(trusted_tick, effect)
            .map_err(ShardError::Broker)
    }

    /// Return (not send) server-to-client-only, strictly bounded FX packets.
    /// Each session may be polled once per tick. No gameplay bytes are owned
    /// or sent by this planner. The cursor only advances for encoded events.
    ///
    /// For fairness the future Core integration must rotate polling order
    /// under global saturation. A single ordered pass does not guarantee it.
    pub fn plan_delivery(
        &mut self,
        trusted_tick: u64,
        session: &mut FxDeliverySession,
        trusted_viewer: ViewerInterest,
    ) -> Result<Vec<[u8; MAGIC_FX_PACKET_BYTES]>, ShardError> {
        if self.current_tick != Some(trusted_tick) {
            return Err(ShardError::InvalidTick);
        }
        if session.authenticated_net_id == 0 || session.zone_id == 0 {
            return Err(ShardError::InvalidSession);
        }
        if trusted_viewer.zone_id == 0
            || trusted_viewer.zone_id != session.zone_id
        {
            return Err(ShardError::WrongSessionZone);
        }
        if !trusted_viewer.x.is_finite()
            || !trusted_viewer.y.is_finite()
            || trusted_viewer.x.abs() > 1_000_000.0
            || trusted_viewer.y.abs() > 1_000_000.0
            || !trusted_viewer.radius.is_finite()
            || !(0.0..=MAX_VIEWER_RADIUS).contains(&trusted_viewer.radius)
        {
            return Err(ShardError::InvalidViewer);
        }
        if session
            .last_poll_tick
            .is_some_and(|previous| trusted_tick <= previous)
        {
            return Err(ShardError::SessionAlreadyPolled);
        }
        let shard = self
            .shards
            .get_mut(&session.zone_id)
            .ok_or(ShardError::UnknownZone)?;

        let per_zone_remaining =
            MAX_FX_PAYLOAD_BYTES_PER_ZONE_TICK - shard.payload_bytes_this_tick;
        let global_remaining =
            MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK - self.global_payload_bytes_this_tick;
        let limit = (per_zone_remaining / MAGIC_FX_PACKET_BYTES)
            .min(global_remaining / MAGIC_FX_PACKET_BYTES)
            .min(MAX_FX_DELIVERY_PER_VIEWER);

        let mut packets = Vec::with_capacity(limit);
        let mut newest = session.last_event_id;
        for effect in shard
            .broker
            .interest_snapshot(trusted_viewer, session.last_event_id, limit)
        {
            let packet = encode_magic_fx(&effect).ok_or(ShardError::UnencodableEvent)?;
            packets.push(packet);
            newest = effect.event_id;
        }
        let bytes = packets.len() * MAGIC_FX_PACKET_BYTES;
        shard.payload_bytes_this_tick += bytes;
        self.global_payload_bytes_this_tick += bytes;
        session.last_event_id = newest;
        session.last_poll_tick = Some(trusted_tick);
        Ok(packets)
    }

    pub fn zone_payload_bytes_this_tick(&self, zone_id: u32) -> Option<usize> {
        self.shards.get(&zone_id).map(|shard| shard.payload_bytes_this_tick)
    }

    pub fn stats(&self) -> ShardBudgetStats {
        ShardBudgetStats {
            zone_shards: self.shards.len(),
            pending_fx: self.shards.values().map(|shard| shard.broker.pending()).sum(),
            global_payload_bytes_this_tick: self.global_payload_bytes_this_tick,
            max_global_payload_bytes_per_tick: MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::elemental_physics::Element;
    use crate::magic_fx_events::MAX_FX_EVENTS_PER_TICK;

    fn spec(zone_id: u32, x: f32) -> TrustedEffectSpec {
        TrustedEffectSpec {
            zone_id,
            x,
            y: 20.0,
            element: Element::Wind,
            seed: 78,
            intensity: 200,
            ttl_ticks: 120,
        }
    }

    fn viewer(zone_id: u32) -> ViewerInterest {
        ViewerInterest {
            zone_id,
            x: 10.0,
            y: 20.0,
            radius: 700.0,
        }
    }

    fn crowded_hub() -> ShardedMagicFxHub {
        let mut hub = ShardedMagicFxHub::new();
        for zone in 1..=4 {
            hub.register_zone(zone).unwrap();
        }
        for tick in 1..=4u64 {
            hub.advance(tick).unwrap();
            for zone in 1..=4 {
                for index in 0..MAX_FX_EVENTS_PER_TICK {
                    hub.admit_trusted(tick, spec(zone, index as f32)).unwrap();
                }
            }
        }
        hub
    }

    #[test]
    fn zones_have_independent_admission_budgets_and_event_ids() {
        let mut hub = crowded_hub();
        assert_eq!(hub.stats().pending_fx, 4 * 48);
        assert_eq!(hub.stats().zone_shards, 4);
        assert_eq!(
            hub.admit_trusted(4, spec(1, 0.0)),
            Err(ShardError::Broker(FxError::OverloadedTick))
        );
        let mut left = FxDeliverySession::new(1, 1).unwrap();
        let mut right = FxDeliverySession::new(2, 2).unwrap();
        let a = hub.plan_delivery(4, &mut left, viewer(1)).unwrap();
        let b = hub.plan_delivery(4, &mut right, viewer(2)).unwrap();
        assert_eq!(a.len(), MAX_FX_DELIVERY_PER_VIEWER);
        assert_eq!(b.len(), MAX_FX_DELIVERY_PER_VIEWER);
        assert_eq!(&a[0][8..12], &[1, 0, 0, 0]);
        assert_eq!(&b[0][8..12], &[1, 0, 0, 0]);
        assert_eq!(&a[0][4..8], &[1, 0, 0, 0]);
        assert_eq!(&b[0][4..8], &[2, 0, 0, 0]);
    }

    #[test]
    fn strict_zone_ownership_duplicate_tick_and_reconnect_reset() {
        let mut hub = crowded_hub();
        let mut session = FxDeliverySession::new(77, 1).unwrap();
        assert_eq!(
            hub.plan_delivery(4, &mut session, viewer(2)),
            Err(ShardError::WrongSessionZone)
        );
        assert_eq!(
            hub.plan_delivery(3, &mut session, viewer(1)),
            Err(ShardError::InvalidTick)
        );
        assert_eq!(hub.plan_delivery(4, &mut session, viewer(1)).unwrap().len(), 6);
        assert_eq!(
            hub.plan_delivery(4, &mut session, viewer(1)),
            Err(ShardError::SessionAlreadyPolled)
        );
        hub.advance(5).unwrap();
        assert_eq!(hub.plan_delivery(5, &mut session, viewer(1)).unwrap().len(), 6);
        session.reset_authorized_zone(2).unwrap();
        assert_eq!(session.last_event_id, 0);
        assert_eq!(hub.plan_delivery(5, &mut session, viewer(2)).unwrap().len(), 6);
        assert_eq!(session.zone_id, 2);
        assert_eq!(hub.plan_delivery(5, &mut session, viewer(1)), Err(ShardError::WrongSessionZone));
        assert_eq!(session.reset_authorized_zone(0), Err(ShardError::InvalidZone));
    }

    #[test]
    fn zone_registration_is_bounded_and_never_reset_by_duplicate() {
        let mut hub = ShardedMagicFxHub::new();
        assert_eq!(hub.register_zone(0), Err(ShardError::InvalidZone));
        hub.register_zone(1).unwrap();
        assert_eq!(hub.register_zone(1), Err(ShardError::ZoneExists));
        hub.advance(1).unwrap();
        for zone in 2..=MAX_FX_ZONE_SHARDS as u32 {
            hub.register_zone(zone).unwrap();
        }
        assert_eq!(hub.stats().zone_shards, MAX_FX_ZONE_SHARDS);
        assert_eq!(hub.register_zone(17), Err(ShardError::ZoneCapacity));
        assert_eq!(hub.admit_trusted(1, spec(20, 0.0)), Err(ShardError::UnknownZone));
        assert_eq!(hub.advance(1), Err(ShardError::InvalidTick));
        assert_eq!(hub.advance(0), Err(ShardError::InvalidTick));
    }

    #[test]
    fn crowded_512_viewer_single_tick_respects_all_byte_budgets() {
        let mut hub = crowded_hub();
        let mut sessions: Vec<_> = (1..=512u32)
            .map(|id| FxDeliverySession::new(id, 1 + id % 4).unwrap())
            .collect();
        let mut total = 0usize;
        let mut served = 0usize;
        for session in &mut sessions {
            let packets = hub.plan_delivery(4, session, viewer(session.zone_id)).unwrap();
            assert!(packets.len() * MAGIC_FX_PACKET_BYTES <= MAX_FX_PAYLOAD_BYTES_PER_VIEWER_TICK);
            if !packets.is_empty() {
                served += 1;
            }
            total += packets.len() * MAGIC_FX_PACKET_BYTES;
            for packet in packets {
                let zone = u32::from_le_bytes(packet[4..8].try_into().unwrap());
                assert_eq!(zone, session.zone_id);
            }
        }
        assert!(served > 0 && served < sessions.len());
        assert_eq!(total, hub.stats().global_payload_bytes_this_tick);
        assert!(total <= MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK);
        for zone in 1..=4 {
            assert!(hub.zone_payload_bytes_this_tick(zone).unwrap()
                <= MAX_FX_PAYLOAD_BYTES_PER_ZONE_TICK);
        }
        hub.advance(5).unwrap();
        assert_eq!(hub.stats().global_payload_bytes_this_tick, 0);
        assert_eq!(hub.zone_payload_bytes_this_tick(1), Some(0));
    }

    #[test]
    fn invalid_viewers_and_unknown_shards_cannot_debit_budget() {
        let mut hub = crowded_hub();
        let mut session = FxDeliverySession::new(11, 9).unwrap();
        assert_eq!(
            hub.plan_delivery(4, &mut session, viewer(9)),
            Err(ShardError::UnknownZone)
        );
        session.reset_authorized_zone(1).unwrap();
        let mut invalid = viewer(1);
        invalid.x = f32::NAN;
        assert_eq!(
            hub.plan_delivery(4, &mut session, invalid),
            Err(ShardError::InvalidViewer)
        );
        invalid = viewer(1);
        invalid.radius = 1_501.0;
        assert_eq!(
            hub.plan_delivery(4, &mut session, invalid),
            Err(ShardError::InvalidViewer)
        );
        assert_eq!(hub.stats().global_payload_bytes_this_tick, 0);
        assert_eq!(session.last_event_id, 0);
        assert_eq!(FxDeliverySession::new(0, 1), Err(ShardError::InvalidSession));
    }

    #[test]
    fn expiry_and_zone_late_registration_use_strict_server_ticks() {
        let mut hub = ShardedMagicFxHub::new();
        hub.advance(5).unwrap();
        hub.register_zone(7).unwrap();
        let mut effect = spec(7, 1.0);
        effect.ttl_ticks = 1;
        hub.admit_trusted(5, effect).unwrap();
        assert_eq!(hub.stats().pending_fx, 1);
        hub.advance(6).unwrap();
        assert_eq!(hub.stats().pending_fx, 0);
        let mut session = FxDeliverySession::new(10, 7).unwrap();
        assert!(hub.plan_delivery(6, &mut session, viewer(7)).unwrap().is_empty());
    }
}
