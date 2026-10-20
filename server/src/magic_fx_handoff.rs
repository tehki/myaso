//! P8: inactive, server-only authenticated FX transport handoff contract.
//!
//! This module owns **no socket** and accepts no client packet or client
//! player ID. The future Core integration must call register_trusted from
//! already admitted connection state and sample positions from the server.
//! All outputs are optional cosmetics; gameplay paths never enter this code.

use std::collections::{BTreeMap, BTreeSet};

use crate::magic_fx_delivery::{
    FxDeliverySession, ShardError, ShardedMagicFxHub, MAX_FX_SCHEDULED_SESSIONS,
};
use crate::magic_fx_events::{ViewerInterest, MAGIC_FX_PACKET_BYTES};

pub const MAX_REGISTERED_FX_CONNECTIONS: usize = 1_024;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct FxRoute {
    pub connection_id: u64,
    /// Generation is minted only by the server adapter, never the browser.
    pub generation: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FxQueueGate {
    pub gameplay_pending: bool,
    pub writer_backpressured: bool,
    /// Space remaining in an independently limited cosmetic-only queue.
    pub cosmetic_slots: u8,
}

impl FxQueueGate {
    pub fn allows_fx(self) -> bool {
        !self.gameplay_pending && !self.writer_backpressured && self.cosmetic_slots != 0
    }
}

#[derive(Debug, Clone, Copy)]
pub struct TrustedFxViewer {
    pub route: FxRoute,
    pub view: ViewerInterest,
    /// Supplied ONLY by Core-owned writer/priority queue state.
    pub gate: FxQueueGate,
}

#[derive(Debug, PartialEq, Eq)]
pub enum FxHandoffError {
    InvalidConnection,
    DuplicateConnection,
    DuplicateNetId,
    Capacity,
    GenerationExhausted,
    StaleRoute,
    UnknownRoute,
    DuplicateViewer,
    WrongZone,
    TooManyViewers,
    Scheduler(ShardError),
}

#[derive(Debug, PartialEq, Eq)]
pub struct FxRoutedBatch {
    pub route: FxRoute,
    pub packets: Vec<[u8; MAGIC_FX_PACKET_BYTES]>,
}

#[derive(Debug, PartialEq, Eq)]
pub struct FxHandoffPlan {
    /// Caller must revalidate route generation immediately before actual
    /// enqueue. The adapter cannot infer whether a socket is still open.
    pub routes: Vec<FxRoutedBatch>,
    pub registered: usize,
    pub eligible: usize,
    pub suppressed_by_gameplay_or_backpressure: usize,
    pub cosmetic_payload_bytes: usize,
}

#[derive(Debug)]
struct Registration {
    generation: u64,
    session: FxDeliverySession,
}

/// This registry is per-process and bounded. It does not authenticate a
/// connection by itself, nor does it expose any method callable from a client.
#[derive(Debug)]
pub struct TrustedFxHandoff {
    routes: BTreeMap<u64, Registration>,
    connections_by_net_id: BTreeMap<u32, u64>,
    next_generation: u64,
}

impl Default for TrustedFxHandoff {
    fn default() -> Self {
        Self::new()
    }
}

impl TrustedFxHandoff {
    pub fn new() -> Self {
        Self {
            routes: BTreeMap::new(),
            connections_by_net_id: BTreeMap::new(),
            next_generation: 1,
        }
    }

    fn mint_generation(&mut self) -> Result<u64, FxHandoffError> {
        if self.next_generation == u64::MAX {
            return Err(FxHandoffError::GenerationExhausted);
        }
        let generation = self.next_generation;
        self.next_generation += 1;
        Ok(generation)
    }

    /// Only Core may register an already-authenticated server connection.
    pub fn register_trusted(
        &mut self,
        server_connection_id: u64,
        authenticated_net_id: u32,
        server_zone_id: u32,
    ) -> Result<FxRoute, FxHandoffError> {
        if server_connection_id == 0 || authenticated_net_id == 0 || server_zone_id == 0 {
            return Err(FxHandoffError::InvalidConnection);
        }
        if self.routes.contains_key(&server_connection_id) {
            return Err(FxHandoffError::DuplicateConnection);
        }
        if self.connections_by_net_id.contains_key(&authenticated_net_id) {
            return Err(FxHandoffError::DuplicateNetId);
        }
        if self.routes.len() >= MAX_REGISTERED_FX_CONNECTIONS {
            return Err(FxHandoffError::Capacity);
        }
        let session = FxDeliverySession::new(authenticated_net_id, server_zone_id)
            .map_err(FxHandoffError::Scheduler)?;
        let generation = self.mint_generation()?;
        self.routes.insert(server_connection_id, Registration {
            generation,
            session,
        });
        self.connections_by_net_id
            .insert(authenticated_net_id, server_connection_id);
        Ok(FxRoute {
            connection_id: server_connection_id,
            generation,
        })
    }

    pub fn registered(&self) -> usize {
        self.routes.len()
    }

    /// Validate just before Core queues optional datagrams. Stale batches are
    /// discarded, never re-routed to the next occupant of a recycled socket.
    pub fn route_current(&self, route: FxRoute) -> bool {
        self.routes
            .get(&route.connection_id)
            .is_some_and(|entry| entry.generation == route.generation)
    }

    fn get_current(&self, route: FxRoute) -> Result<&Registration, FxHandoffError> {
        let entry = self
            .routes
            .get(&route.connection_id)
            .ok_or(FxHandoffError::UnknownRoute)?;
        if entry.generation != route.generation {
            return Err(FxHandoffError::StaleRoute);
        }
        Ok(entry)
    }

    /// Re-issue an opaque route generation on an authorized zone transfer.
    /// Previously planned cosmetic batches must never cross that boundary.
    pub fn transfer_trusted(
        &mut self,
        route: FxRoute,
        server_zone_id: u32,
    ) -> Result<FxRoute, FxHandoffError> {
        self.get_current(route)?;
        if server_zone_id == 0 {
            return Err(FxHandoffError::WrongZone);
        }
        let generation = self.mint_generation()?;
        let entry = self.routes.get_mut(&route.connection_id).expect("checked");
        entry
            .session
            .reset_authorized_zone(server_zone_id)
            .map_err(FxHandoffError::Scheduler)?;
        entry.generation = generation;
        Ok(FxRoute {
            connection_id: route.connection_id,
            generation,
        })
    }

    /// Only called on trusted disconnect, not by an untrusted FX message.
    pub fn unregister_trusted(&mut self, route: FxRoute) -> Result<(), FxHandoffError> {
        self.get_current(route)?;
        let entry = self.routes.remove(&route.connection_id).expect("checked");
        self.connections_by_net_id
            .remove(&entry.session.authenticated_net_id);
        Ok(())
    }

    /// Atomic preflight for active views, including those whose cosmetic
    /// writer is saturated. Every viewer must be a registered, current route.
    ///
    /// We do not attempt delivery when gameplay is pending, when the writer
    /// is backpressured, or when no cosmetic queue slot is available. This
    /// means pending combat/snapshot traffic always takes priority.
    ///
    /// Delivery planner advances only cosmetic cursors and FX byte counters;
    /// socket queue reservations / flush are a future Core responsibility.
    pub fn plan_trusted_tick(
        &mut self,
        hub: &mut ShardedMagicFxHub,
        tick: u64,
        active_views: &[TrustedFxViewer],
    ) -> Result<FxHandoffPlan, FxHandoffError> {
        if active_views.len() > MAX_REGISTERED_FX_CONNECTIONS {
            return Err(FxHandoffError::TooManyViewers);
        }
        let mut seen = BTreeSet::new();
        for source in active_views {
            if !seen.insert(source.route.connection_id) {
                return Err(FxHandoffError::DuplicateViewer);
            }
            let registration = self.get_current(source.route)?;
            if source.view.zone_id != registration.session.zone_id {
                return Err(FxHandoffError::WrongZone);
            }
            if !source.view.x.is_finite()
                || !source.view.y.is_finite()
                || source.view.x.abs() > 1_000_000.0
                || source.view.y.abs() > 1_000_000.0
                || !source.view.radius.is_finite()
                || !(0.0..=crate::magic_fx_events::MAX_VIEWER_RADIUS).contains(&source.view.radius)
            {
                return Err(FxHandoffError::Scheduler(ShardError::InvalidViewer));
            }
        }

        let mut current_sessions = Vec::new();
        let mut current_views = Vec::new();
        let mut route_by_id = BTreeMap::new();
        let mut suppressed = 0;
        for source in active_views {
            if !source.gate.allows_fx() {
                suppressed += 1;
                continue;
            }
            let registration = self.get_current(source.route)?;
            route_by_id.insert(registration.session.authenticated_net_id, source.route);
            current_sessions.push(registration.session);
            current_views.push(source.view);
        }
        if current_sessions.len() > MAX_FX_SCHEDULED_SESSIONS {
            return Err(FxHandoffError::TooManyViewers);
        }
        let report = hub
            .schedule_fair_tick(tick, &mut current_sessions, &current_views)
            .map_err(FxHandoffError::Scheduler)?;
        for session in current_sessions {
            let connection_id = self.connections_by_net_id[&session.authenticated_net_id];
            self.routes
                .get_mut(&connection_id)
                .expect("preflight registered")
                .session = session;
        }
        let routes = report
            .batches
            .into_iter()
            .map(|batch| FxRoutedBatch {
                route: route_by_id[&batch.authenticated_net_id],
                packets: batch.packets,
            })
            .collect();
        Ok(FxHandoffPlan {
            routes,
            registered: self.routes.len(),
            eligible: report.considered_sessions,
            suppressed_by_gameplay_or_backpressure: suppressed,
            cosmetic_payload_bytes: report.payload_bytes,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::elemental_physics::Element;
    use crate::magic_fx_events::TrustedEffectSpec;

    fn setup(zones: u32) -> (ShardedMagicFxHub, TrustedFxHandoff) {
        let mut hub = ShardedMagicFxHub::new();
        for zone in 1..=zones {
            hub.register_zone(zone).unwrap();
        }
        for tick in 1..=4 {
            hub.advance(tick).unwrap();
            for zone in 1..=zones {
                for n in 0..12 {
                    hub.admit_trusted(tick, TrustedEffectSpec {
                        zone_id: zone,
                        x: n as f32 * 5.0,
                        y: 20.0,
                        element: Element::Fire,
                        seed: n,
                        intensity: 170,
                        ttl_ticks: 120,
                    }).unwrap();
                }
            }
        }
        (hub, TrustedFxHandoff::new())
    }

    fn view(route: FxRoute, zone_id: u32, gate: FxQueueGate) -> TrustedFxViewer {
        TrustedFxViewer {
            route,
            view: ViewerInterest {
                zone_id,
                x: 10.0,
                y: 20.0,
                radius: 700.0,
            },
            gate,
        }
    }

    const READY: FxQueueGate = FxQueueGate {
        gameplay_pending: false,
        writer_backpressured: false,
        cosmetic_slots: 1,
    };

    #[test]
    fn recycled_connection_and_zone_transfer_invalidate_queued_routes() {
        let (mut hub, mut handoff) = setup(2);
        let old = handoff.register_trusted(11, 42, 1).unwrap();
        let planned = handoff.plan_trusted_tick(&mut hub, 4, &[view(old, 1, READY)]).unwrap();
        assert_eq!(planned.routes.len(), 1);
        let batch = &planned.routes[0];
        assert!(handoff.route_current(batch.route));

        let moved = handoff.transfer_trusted(old, 2).unwrap();
        assert!(!handoff.route_current(batch.route));
        assert_eq!(handoff.unregister_trusted(old), Err(FxHandoffError::StaleRoute));
        assert_eq!(handoff.plan_trusted_tick(&mut hub, 4, &[view(old, 1, READY)]),
            Err(FxHandoffError::StaleRoute));
        handoff.unregister_trusted(moved).unwrap();
        let next = handoff.register_trusted(11, 42, 1).unwrap();
        assert_ne!(next.generation, old.generation);
        assert!(!handoff.route_current(moved));
        let other = handoff.plan_trusted_tick(&mut hub, 4, &[view(next, 1, READY)]).unwrap();
        assert_eq!(other.routes.len(), 1);
    }

    #[test]
    fn gameplay_and_backpressure_gates_skip_optional_fx_without_advancing_cursor() {
        let (mut hub, mut handoff) = setup(1);
        let a = handoff.register_trusted(100, 1, 1).unwrap();
        let b = handoff.register_trusted(101, 2, 1).unwrap();
        let block = FxQueueGate { gameplay_pending: true, ..READY };
        let pressure = FxQueueGate { writer_backpressured: true, ..READY };
        let empty = FxQueueGate { cosmetic_slots: 0, ..READY };
        let skipped = handoff.plan_trusted_tick(&mut hub, 4,
            &[view(a, 1, block), view(b, 1, pressure)]).unwrap();
        assert_eq!(skipped.eligible, 0);
        assert_eq!(skipped.suppressed_by_gameplay_or_backpressure, 2);
        assert_eq!(skipped.cosmetic_payload_bytes, 0);
        hub.advance(5).unwrap();
        let second = handoff.plan_trusted_tick(&mut hub, 5,
            &[view(a, 1, empty), view(b, 1, READY)]).unwrap();
        assert_eq!(second.routes.len(), 1);
        assert_eq!(second.routes[0].route, b);
        hub.advance(6).unwrap();
        let third = handoff.plan_trusted_tick(&mut hub, 6,
            &[view(a, 1, READY), view(b, 1, READY)]).unwrap();
        assert_eq!(third.routes.len(), 2);
        assert_eq!(third.routes[0].route, a);
        assert_eq!(third.routes[0].packets[0][8..12], [1, 0, 0, 0]);
    }

    #[test]
    fn invalid_batches_cannot_spend_fx_or_mutate_connections() {
        let (mut hub, mut handoff) = setup(1);
        let a = handoff.register_trusted(1, 1, 1).unwrap();
        let b = handoff.register_trusted(2, 2, 1).unwrap();
        assert_eq!(handoff.register_trusted(1, 3, 1), Err(FxHandoffError::DuplicateConnection));
        assert_eq!(handoff.register_trusted(3, 2, 1), Err(FxHandoffError::DuplicateNetId));
        assert_eq!(handoff.register_trusted(0, 3, 1), Err(FxHandoffError::InvalidConnection));
        assert_eq!(handoff.transfer_trusted(a, 0), Err(FxHandoffError::WrongZone));
        let mut forged = view(b, 1, READY);
        forged.view.x = f32::NAN;
        assert_eq!(
            handoff.plan_trusted_tick(&mut hub, 4, &[view(a, 1, READY), forged]),
            Err(FxHandoffError::Scheduler(ShardError::InvalidViewer))
        );
        assert_eq!(
            handoff.plan_trusted_tick(&mut hub, 4, &[view(a, 1, READY), view(a, 1, READY)]),
            Err(FxHandoffError::DuplicateViewer)
        );
        assert_eq!(
            handoff.plan_trusted_tick(&mut hub, 4, &[view(a, 2, READY)]),
            Err(FxHandoffError::WrongZone)
        );
        assert_eq!(hub.stats().global_payload_bytes_this_tick, 0);
        let good = handoff.plan_trusted_tick(&mut hub, 4, &[view(a, 1, READY), view(b, 1, READY)]).unwrap();
        assert_eq!(good.routes.len(), 2);
    }

    #[test]
    fn synthetic_512_connections_consume_only_budgeted_cosmetic_bytes() {
        let (mut hub, mut handoff) = setup(4);
        let mut active = Vec::new();
        for id in 1..=512u32 {
            let zone = 1 + (id - 1) % 4;
            let handle = handoff.register_trusted(u64::from(id), id, zone).unwrap();
            let gate = if id % 8 == 0 {
                FxQueueGate { gameplay_pending: true, ..READY }
            } else {
                READY
            };
            active.push(view(handle, zone, gate));
        }
        let first = handoff.plan_trusted_tick(&mut hub, 4, &active).unwrap();
        assert_eq!(first.registered, 512);
        assert_eq!(first.eligible, 448);
        assert_eq!(first.suppressed_by_gameplay_or_backpressure, 64);
        assert_eq!(first.routes.len(), 448);
        assert_eq!(first.cosmetic_payload_bytes, 448 * MAGIC_FX_PACKET_BYTES);
        for route in &first.routes {
            assert!(handoff.route_current(route.route));
        }
        hub.advance(5).unwrap();
        for entry in &mut active {
            entry.gate = READY;
        }
        let second = handoff.plan_trusted_tick(&mut hub, 5, &active).unwrap();
        assert_eq!(second.routes.len(), 512);
        assert_eq!(second.cosmetic_payload_bytes, 512 * MAGIC_FX_PACKET_BYTES);
        assert!(second.routes.iter().take(64).all(|batch| {
            let id = batch.route.connection_id as u32;
            id % 8 == 0
        }));
    }
}
