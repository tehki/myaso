//! Core 8C REVIEW-ONLY World actor lease and gesture retirement boundary.
//!
//! DORMANT: not called by server/src/main.rs, not a live QUIC authentication
//! or protocol route, and does not mutate World, Combat, HP or timing.
//! It consumes Core 8A's existing reviewed 0x11 EVENT ingress model and never
//! creates an alternative packet ABI. A future live caller must issue a fresh
//! non-reusable connection lease at authenticated admission, observe EVERY World
//! tick under the authoritative World lock, and retire at disconnect, death,
//! respawn, actor replacement and match reset before further dispatch.
//!
//! WARNING: this review constructor does NOT prove authentication, and observing
//! a World only intermittently cannot prove that no life transition was missed.
//! The model therefore closes on any gap larger than one World tick.
use crate::{
    prealpha_lmb_gesture_proposal::GestureEvent,
    prealpha_lmb_ingress_review::{IngressResult, ReviewLmbIngress, TrustedLeaseKey},
    simulation::{Action, World},
};
use std::collections::VecDeque;

const MAX_PENDING_WORLD_EDGES: usize = 16;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ReviewActorLease {
    actor_net_id: u32,
    generation: u64,
    connection_nonce: u64,
}

impl ReviewActorLease {
    /// Fixture-only identity. Never construct this from client packet fields.
    pub fn review_from_server_values(
        actor_net_id: u32,
        generation: u64,
        connection_nonce: u64,
    ) -> Option<Self> {
        TrustedLeaseKey::review_from_admission(actor_net_id, generation, connection_nonce)?;
        Some(Self {
            actor_net_id,
            generation,
            connection_nonce,
        })
    }

    fn core_lease(self) -> TrustedLeaseKey {
        TrustedLeaseKey::review_from_admission(
            self.actor_net_id,
            self.generation,
            self.connection_nonce,
        )
        .expect("validated fixture identity")
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ReviewEdgeStatus {
    Accepted(usize),
    Deferred,
    Duplicate,
    Stale,
    Rejected,
    Retired,
}

/// An uninvoked review adapter between Core 8A ordering and Core 8C World
/// membership. It deliberately only emits validated *intent*, never a HIT.
pub struct ReviewWorldLease {
    actor: ReviewActorLease,
    // Captured from the original World fighter, not fabricated by the client.
    world_incarnation: u64,
    ingress: ReviewLmbIngress,
    pending: VecDeque<GestureEvent>,
    observed_world_tick: u32,
    retired: bool,
}

impl ReviewWorldLease {
    pub fn review_from_admitted_world(world: &World, actor: ReviewActorLease) -> Option<Self> {
        // No new gesture lease may enter a completed match or span its reset.
        if world.match_over() {
            return None;
        }
        let fighter = world.fighter(actor.actor_net_id)?;
        if fighter.action == Action::Dead || fighter.hp <= 0.0 {
            return None;
        }
        Some(Self {
            actor,
            world_incarnation: fighter.world_incarnation(),
            ingress: ReviewLmbIngress::new_from_trusted_admission(actor.core_lease()),
            pending: VecDeque::new(),
            observed_world_tick: world.tick,
            retired: false,
        })
    }

    pub fn is_retired(&self) -> bool {
        self.retired
    }

    pub fn pending_count(&self) -> usize {
        self.pending.len()
    }

    pub fn retire(&mut self) {
        self.retired = true;
        self.pending.clear();
        self.ingress.close();
    }

    /// Must be called on *every* true World simulation tick while this lease
    /// is active, even without ingress. Skipping a tick is a fail-closed
    /// retirement, because a dead/respawned generation may have gone unseen.
    pub fn observe_world_tick(&mut self, world: &World) -> bool {
        if self.retired {
            return false;
        }
        if world.tick != self.observed_world_tick
            && world.tick != self.observed_world_tick.wrapping_add(1)
        {
            self.retire();
            return false;
        }
        let current = world.fighter(self.actor.actor_net_id);
        // World::reset_match revives living fighters without a Dead interval.
        // Revoke ALL old-round queued input on the authoritative winning tick.
        if world.match_over()
            || current.is_none_or(|fighter| {
                fighter.action == Action::Dead
                    || fighter.hp <= 0.0
                    || fighter.world_incarnation() != self.world_incarnation
            })
        {
            self.retire();
            return false;
        }
        self.observed_world_tick = world.tick;
        true
    }

    /// A fixture gateway only. Status does not imply ACK transmission or
    /// Combat commitment. A caller mismatch cannot consume current lease state.
    pub fn review_ingest(
        &mut self,
        world: &World,
        presented_lease: ReviewActorLease,
        packet: &[u8],
    ) -> ReviewEdgeStatus {
        if !self.observe_world_tick(world) {
            return ReviewEdgeStatus::Retired;
        }
        if presented_lease != self.actor {
            return ReviewEdgeStatus::Stale;
        }
        match self
            .ingress
            .review_ingest(self.actor.core_lease(), packet, world.tick)
        {
            IngressResult::Accepted(edges) => {
                if edges.len() + self.pending.len() > MAX_PENDING_WORLD_EDGES {
                    self.retire();
                    return ReviewEdgeStatus::Retired;
                }
                let count = edges.len();
                self.pending
                    .extend(edges.into_iter().map(|accepted| accepted.event));
                ReviewEdgeStatus::Accepted(count)
            }
            IngressResult::Deferred => ReviewEdgeStatus::Deferred,
            IngressResult::Duplicate(_) => ReviewEdgeStatus::Duplicate,
            IngressResult::Stale(_) => ReviewEdgeStatus::Stale,
            IngressResult::Rejected(_) => {
                if self.ingress.is_closed() {
                    self.retire();
                }
                ReviewEdgeStatus::Rejected
            }
        }
    }

    /// The caller must hold the same authoritative World lock at verification
    /// and command application; otherwise a death/disconnect race is possible.
    /// The returned ordered events are NOT applied to Combat by this model.
    pub fn review_drain_for_world(
        &mut self,
        world: &World,
        presented_lease: ReviewActorLease,
    ) -> Vec<GestureEvent> {
        if !self.observe_world_tick(world) || presented_lease != self.actor {
            return Vec::new();
        }
        self.pending.drain(..).collect()
    }
}
