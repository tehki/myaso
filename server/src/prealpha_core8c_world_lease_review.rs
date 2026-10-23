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
    prealpha_lmb_gesture_proposal::{GestureAction, GestureEvent},
    prealpha_lmb_ingress_review::{IngressResult, ReviewLmbIngress, TrustedLeaseKey},
    simulation::{Action, CombatEvent, InputIntent, World},
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

// Dormant server-side ownership wrapper. The single process-wide allocator is
// authoritative ONLY for review fixtures in this Rust process. A real cluster
// needs the Core8B/zone owner authority and nonreusable session epoch.
use std::sync::atomic::{AtomicU64, Ordering};

static NEXT_REVIEW_WORLD_OWNER_EPOCH: AtomicU64 = AtomicU64::new(1);

fn reserve_review_world_owner_epoch() -> Option<u64> {
    NEXT_REVIEW_WORLD_OWNER_EPOCH
        .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |next| {
            next.checked_add(1)
        })
        .ok()
}

/// A review owner that couples the genuine World and a nonzero epoch.
/// Its World is never exposed mutably: replacing the whole World MUST retire
/// its old epoch, including if actor IDs, life counters and ticks repeat.
pub struct ReviewOwnedWorld {
    world: World,
    owner_epoch: u64,
}

impl ReviewOwnedWorld {
    pub fn review_new(world: World) -> Option<Self> {
        Some(Self {
            world,
            owner_epoch: reserve_review_world_owner_epoch()?,
        })
    }

    pub fn world(&self) -> &World {
        &self.world
    }

    pub fn owner_epoch(&self) -> u64 {
        self.owner_epoch
    }

    /// Fail closed before replacement if the process-local token space ends.
    pub fn review_replace_world(&mut self, replacement: World) -> bool {
        let Some(next) = reserve_review_world_owner_epoch() else {
            return false;
        };
        self.world = replacement;
        self.owner_epoch = next;
        true
    }

    pub fn review_step(&mut self) {
        let _ = self.world.step();
    }

    /// Only for review acceptance: observe genuine original Combat events.
    pub fn review_step_events(&mut self) -> Vec<CombatEvent> {
        self.world.step()
    }

    pub fn review_remove_player(&mut self, actor: u32) -> bool {
        self.world.remove_player(actor)
    }

    pub fn review_add_player(&mut self, actor: u32) -> bool {
        self.world.add_player(actor)
    }
}

/// Extra ownership layer over the existing Core8C incarnation/actor fence.
/// Does not send an ACK, mutate Combat or create an authenticated connection.
pub struct ReviewWorldOwnerLease {
    bound_owner_epoch: u64,
    actor: ReviewActorLease,
    inner: ReviewWorldLease,
    review_active_light_gesture: Option<u32>,
}

impl ReviewWorldOwnerLease {
    pub fn review_from_current_owner(
        owner: &ReviewOwnedWorld,
        actor: ReviewActorLease,
    ) -> Option<Self> {
        let inner = ReviewWorldLease::review_from_admitted_world(owner.world(), actor)?;
        Some(Self {
            bound_owner_epoch: owner.owner_epoch(),
            actor,
            inner,
            review_active_light_gesture: None,
        })
    }

    fn verify_owner(&mut self, owner: &ReviewOwnedWorld) -> bool {
        if self.inner.is_retired() {
            return false;
        }
        if self.bound_owner_epoch != owner.owner_epoch() {
            self.inner.retire();
            return false;
        }
        self.inner.observe_world_tick(owner.world())
    }

    pub fn is_retired(&self) -> bool {
        self.inner.is_retired()
    }

    pub fn pending_count(&self) -> usize {
        self.inner.pending_count()
    }

    pub fn review_ingest(
        &mut self,
        owner: &ReviewOwnedWorld,
        presented_actor: ReviewActorLease,
        packet: &[u8],
    ) -> ReviewEdgeStatus {
        if !self.verify_owner(owner) {
            return ReviewEdgeStatus::Retired;
        }
        self.inner
            .review_ingest(owner.world(), presented_actor, packet)
    }

    /// Ordered review intent only. Live code MUST recheck under its actual
    /// World mutation lock while converting intent to authoritative Combat.
    pub fn review_drain_for_owner(
        &mut self,
        owner: &ReviewOwnedWorld,
        presented_actor: ReviewActorLease,
    ) -> Vec<GestureEvent> {
        if !self.verify_owner(owner) || presented_actor != self.actor {
            return Vec::new();
        }
        self.inner
            .review_drain_for_world(owner.world(), presented_actor)
    }
}

/// Review-only per-actor input commitment. The operation is not a transport
/// ACK and never claims a Combat HIT until an actual World.step() reports one.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ReviewLightWorldDispatch {
    NoReadyEdges,
    LightPressStaged { gesture_id: u32 },
    LightTerminalObserved { gesture_id: u32 },
    ForeignActor,
    RejectedAndRetired,
    Retired,
}

impl ReviewOwnedWorld {
    /// REVIEW ONLY: consume exactly one already-ordered source=0 light PRESS,
    /// optionally paired with its matching RELEASE in the same 60Hz tick.
    ///
    /// The exclusive &mut self borrow spans current owner/life verification,
    /// event drainage and the ACTUAL World::set_input mutation. Thus the World
    /// cannot be replaced, respawned or reassigned by another safe Rust caller
    /// between these steps. The original server's tokio Mutex<SharedGame> is
    /// NOT wired here; the QUIC actor lease is a fixture, not authenticated.
    ///
    /// CANCEL also remains unsupported: original Combat4 must decide if and
    /// when an unlanded attack may be aborted under the World lock.
    /// This small bridge intentionally does NOT implement LMB UPGRADE/HEAVY
    /// or KeyE. Unsupported multi-press batches retire instead of silently
    /// merging independent attacks into one World 60Hz edge.
    pub fn review_apply_one_lmb_light(
        &mut self,
        gate: &mut ReviewWorldOwnerLease,
        presented_actor: ReviewActorLease,
    ) -> ReviewLightWorldDispatch {
        if presented_actor != gate.actor {
            return ReviewLightWorldDispatch::ForeignActor;
        }
        if !gate.verify_owner(self) {
            return ReviewLightWorldDispatch::Retired;
        }
        let accepted = gate
            .inner
            .review_drain_for_world(self.world(), presented_actor);
        if accepted.is_empty() {
            return ReviewLightWorldDispatch::NoReadyEdges;
        }
        let reject = |gate: &mut ReviewWorldOwnerLease| {
            gate.inner.retire();
            gate.review_active_light_gesture = None;
            ReviewLightWorldDispatch::RejectedAndRetired
        };
        let (press, terminal) = match accepted.as_slice() {
            [edge]
                if edge.action == GestureAction::Press
                    && gate.review_active_light_gesture.is_none() =>
            {
                (Some(*edge), None)
            }
            [edge]
                if edge.action == GestureAction::Release
                    && gate.review_active_light_gesture == Some(edge.gesture_id) =>
            {
                (None, Some(*edge))
            }
            [first, last]
                if first.action == GestureAction::Press
                    && last.action == GestureAction::Release
                    && first.gesture_id == last.gesture_id
                    && first.sequence.checked_add(1) == Some(last.sequence)
                    && gate.review_active_light_gesture.is_none() =>
            {
                (Some(*first), Some(*last))
            }
            _ => return reject(gate),
        };
        // A subsequent matching RELEASE is bookkeeping, never another
        // attack and never client-authorized damage.
        if press.is_none() {
            gate.review_active_light_gesture = None;
            return ReviewLightWorldDispatch::LightTerminalObserved {
                gesture_id: terminal.expect("validated terminal").gesture_id,
            };
        }
        let gesture_id = press.expect("validated press").gesture_id;
        // Server-owned facing, zero movement, one real original light edge:
        // PRESS/neutral latches exactly one pending attack even when both
        // arrive before a single World::step(). No client tick is consulted.
        let attack = InputIntent {
            attack: true,
            ..InputIntent::default()
        };
        let actor = presented_actor.actor_net_id;
        if !self.world.set_input(actor, attack)
            || !self.world.set_input(actor, InputIntent::default())
        {
            gate.inner.retire();
            gate.review_active_light_gesture = None;
            return ReviewLightWorldDispatch::Retired;
        }
        gate.review_active_light_gesture = if terminal.is_some() {
            None
        } else {
            Some(gesture_id)
        };
        ReviewLightWorldDispatch::LightPressStaged { gesture_id }
    }
}
