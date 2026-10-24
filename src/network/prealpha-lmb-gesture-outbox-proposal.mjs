// Core 8A REVIEW-ONLY v2 gesture transport outbox. NEVER imported by gameplay.
// This queues fast DOM edges independently of the existing 30Hz sampled v1 input.
// It does not negotiate a real QUIC stream, authenticate a connection, authorize
// combat damage, or convert a transport ACK into a Combat hit confirmation.
import {
  PROPOSED_GESTURE_VERSION, GESTURE_ACTION, GESTURE_ACK_STATUS,
  encodeProposedGestureEvent, decodeProposedGestureAck,
} from "./prealpha-lmb-gesture-proposal.mjs";
import {ProposedSharedSourceGestureAllocator} from "./prealpha-shared-source-allocator-proposal.mjs";

const U32_MAX = 0xffff_ffff;
// Retain only a finite number of same-lease settled typed edge identities.
// Older ACKs remain unrecognized and fail closed; no hit authorization here.
const MAX_SETTLED_TYPED_ACKS = 64;
const validTick = tick => Number.isInteger(tick) && tick >= 0 && tick <= U32_MAX;
function requireTick(tick) {
  if (!validTick(tick)) throw new RangeError("clientTick must be a diagnostic u32");
}
function requireUsable(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new RangeError(name+" out of bounds");
}

// Callers MUST supply the private object identifying the authenticated
// WebTransport connection lease (not a client claim and never sent on wire).
// Reconnect allocates a NEW token and a NEW outbox; v2 ACKs are multiplexed
// ONLY from that connection. This class CANNOT itself prove authentication.
export class ProposedLmbGestureOutbox {
  #trustedLease;
  #pending = new Map();
  #active = null;
  #nextSequence = 1;
  #nextGestureId = 1;
  #maxPending;
  #maxAttempts;
  #closed = false;

  constructor({ negotiatedVersion, trustedLease, maxPending = 16, maxAttempts = 3 } = {}) {
    if (negotiatedVersion !== PROPOSED_GESTURE_VERSION)
      throw new Error("v2 transport not explicitly negotiated");
    if (trustedLease === null || typeof trustedLease !== "object")
      throw new TypeError("an opaque current authenticated-connection lease is required");
    requireUsable(maxPending, 4, 256, "maxPending");
    requireUsable(maxAttempts, 1, 8, "maxAttempts");
    this.#trustedLease = trustedLease;
    this.#maxPending = maxPending;
    this.#maxAttempts = maxAttempts;
  }

  #requireOpen() {
    if (this.#closed) throw new Error("gesture outbox lease closed; reconnect to recover");
  }

  #enqueue(action, gestureId, clientTick) {
    requireTick(clientTick);
    if (this.#nextSequence > U32_MAX || this.#pending.size >= this.#maxPending) {
      this.#closed = true;
      throw new Error("gesture sequence or bounded outbox capacity exhausted");
    }
    const sequence = this.#nextSequence++;
    const bytes = new Uint8Array(encodeProposedGestureEvent({
      action, sequence, gestureId, clientTick,
    }));
    this.#pending.set(sequence, {gestureId, sequence, action, bytes, attempts:0});
    return Object.freeze({sequence, gestureId, action});
  }

  begin(clientTick = 0) {
    this.#requireOpen();
    requireTick(clientTick);
    if (this.#active) throw new Error("one real LMB gesture must terminate before another begins");
    // Reserve room for PRESS+UPGRADE+RELEASE/CANCEL. Never allow a new PRESS
    // that strands a fast RELEASE because unACKed edges filled the outbox.
    if (this.#pending.size + 3 > this.#maxPending ||
        this.#nextSequence > U32_MAX - 2 ||
        this.#nextGestureId > U32_MAX) {
      this.#closed = true;
      throw new Error("no bounded edge capacity or fresh lease-scoped gesture identity");
    }
    const gestureId = this.#nextGestureId++;
    const event = this.#enqueue(GESTURE_ACTION.PRESS,gestureId,clientTick);
    this.#active = {gestureId,upgraded:false};
    return event;
  }

  upgrade(clientTick = 0) {
    this.#requireOpen();
    if (!this.#active || this.#active.upgraded)
      throw new Error("upgrade requires a uniquely active, not-yet-upgraded LMB gesture");
    const event = this.#enqueue(GESTURE_ACTION.UPGRADE,this.#active.gestureId,clientTick);
    this.#active.upgraded = true;
    return event;
  }

  release(clientTick = 0) { return this.#terminal(GESTURE_ACTION.RELEASE,clientTick); }
  cancel(clientTick = 0) { return this.#terminal(GESTURE_ACTION.CANCEL,clientTick); }
  #terminal(action,clientTick) {
    this.#requireOpen();
    if (!this.#active) throw new Error("no active matching LMB gesture");
    const event = this.#enqueue(action,this.#active.gestureId,clientTick);
    this.#active = null;
    return event;
  }

  // One bounded batch of independent byte COPIES, never a mutable queue Map.
  // Caller sends over a future approved reliable, negotiated, connection-owned
  // stream. A returned batch DOES NOT mean a single byte was sent or accepted.
  nextSendBatch(limit=4) {
    this.#requireOpen();
    requireUsable(limit,1,this.#maxPending,"send limit");
    const selected = [...this.#pending.values()].slice(0,limit);
    if (selected.some(e=>e.attempts>=this.#maxAttempts)) {
      this.#closed = true;
      throw new Error("bounded gesture retransmission exhausted; no silent edge loss");
    }
    for (const e of selected) e.attempts++;
    return selected.map(e=>Object.freeze({
      sequence:e.sequence, gestureId:e.gestureId,
      bytes:new Uint8Array(e.bytes), attempt:e.attempts,
    }));
  }

  // The future connection owner MUST route ACK bytes only from the authenticated
  // same-lease stream; caller supplies its private token, never client input.
  // Accepted/Duplicate settle EDGE transport only, NOT Combat outcome/damage.
  receiveAck(bytes, trustedLease) {
    this.#requireOpen();
    if (trustedLease !== this.#trustedLease)
      throw new Error("cross-lease ACK rejected");
    const ack = decodeProposedGestureAck(bytes);
    const existing = this.#pending.get(ack.sequence);
    if (!existing) throw new Error("unexpected, old or replayed gesture ACK");
    if (existing.gestureId !== ack.gestureId)
      throw new Error("ACK gesture identity does not match pending event");
    // A queued edge is not a sent edge. A same-lease 0x12 ACK must not
    // erase a PRESS or terminal that has never been scheduled for delivery.
    if (existing.attempts === 0)
      throw new Error("unscheduled gesture ACK rejected");
    this.#pending.delete(ack.sequence);
    const acceptedEdge = ack.status === GESTURE_ACK_STATUS.ACCEPTED;
    const duplicateEdge = ack.status === GESTURE_ACK_STATUS.DUPLICATE;
    if (!acceptedEdge && !duplicateEdge) {
      // A stale/rejected edge makes any outstanding later edges unsafe.
      this.#closed = true;
      this.#active = null;
    }
    return Object.freeze({
      sequence:ack.sequence,gestureId:ack.gestureId,status:ack.status,
      serverTick:ack.serverTick,transportSettled:acceptedEdge||duplicateEdge,
      combatCommitted:false,
    });
  }

  closeLease() {
    this.#closed = true;
    this.#active = null;
    this.#pending.clear();
  }

  get snapshot() {
    return Object.freeze({
      pending:this.#pending.size,activeGestureId:this.#active?.gestureId??null,
      closed:this.#closed,
      nextSequence:this.#nextSequence,nextGestureId:this.#nextGestureId,
    });
  }
}

// DORMANT / REVIEW-ONLY candidate for ONE future per-connection typed edge
// outbox. Reuses the existing Core8A outbox's bounded resend and ACK semantics
// and the Main #723 shared LMB+KeyE identifier allocator, not a new codec or
// second independently numbered KeyE queue. No gameplay or QUIC imports.
export class ProposedSharedTypedGestureOutbox {
  #trustedLease;
  #allocator;
  #pending = new Map();
  #settled = new Map();
  #reservations = new Map();
  #maxPending;
  #maxAttempts;
  #closed = false;

  constructor({reviewVersion, trustedLease, maxPending = 16, maxAttempts = 3} = {}) {
    // reviewVersion != authenticated QUIC handshake/capability grant.
    this.#allocator = new ProposedSharedSourceGestureAllocator({
      reviewVersion, trustedLease,
    });
    requireUsable(maxPending,4,256,"maxPending");
    requireUsable(maxAttempts,1,8,"maxAttempts");
    this.#trustedLease = trustedLease;
    this.#maxPending = maxPending;
    this.#maxAttempts = maxAttempts;
  }
  #requireOpen() {
    if (this.#closed) throw new Error("typed gesture review lease closed");
  }
  #reservedCount() {
    return [...this.#reservations.values()].reduce((total,n)=>total+n,0);
  }
  #track(event) {
    const {source, action, sequence, gestureId, bytes} = event;
    if (this.#pending.has(sequence) || this.#pending.size >= this.#maxPending) {
      this.retire();
      throw new Error("typed review queue cannot safely admit an edge");
    }
    this.#pending.set(sequence, {
      source, action, sequence, gestureId, bytes:new Uint8Array(bytes), attempts:0,
    });
    return Object.freeze({source, action, sequence, gestureId});
  }

  begin(source, clientTick = 0) {
    this.#requireOpen();
    // Reject retired source1 BEFORE any queue-capacity checks or state updates.
    // Key E is reserved for Use and cannot claim Combat sequence/capacity.
    if (source !== 0)
      throw new RangeError("Combat permits only physical LMB; Key E reserved for Use");
    if (this.#reservations.has(source))
      throw new Error("source already owns an active typed gesture");
    // A valid LMB reserves PRESS, optional UPGRADE and terminal capacity.
    const newSlots = 3;
    if (newSlots && this.#pending.size + this.#reservedCount() + newSlots > this.#maxPending)
      throw new Error("bounded typed queue lacks terminal capacity");
    const event = this.#allocator.begin(source,clientTick);
    this.#reservations.set(source,newSlots-1);
    return this.#track(event);
  }
  upgrade(clientTick = 0) {
    this.#requireOpen();
    if (this.#reservations.get(0) !== 2)
      throw new Error("LMB upgrade must be once, with preserved terminal reservation");
    const event = this.#allocator.upgrade(clientTick);
    this.#reservations.set(0,1);
    return this.#track(event);
  }
  release(source, clientTick = 0) {
    return this.#terminal(source,false,clientTick);
  }
  cancel(source, clientTick = 0) {
    return this.#terminal(source,true,clientTick);
  }
  #terminal(source, cancel, clientTick) {
    this.#requireOpen();
    if (!this.#reservations.has(source))
      throw new Error("terminal requires an active matching source");
    // One guaranteed reserved queue slot exists for each active source.
    const event = cancel ? this.#allocator.cancel(source,clientTick)
      : this.#allocator.release(source,clientTick);
    this.#reservations.delete(source);
    return this.#track(event);
  }

  // Preserve Core8A first-send priority: a legitimate RELEASE cannot be
  // indefinitely hidden behind repeated older PRESS retries in limit=1.
  // Returning a COPY is NOT confirmation that future QUIC sent it.
  nextSendBatch(limit = 4, {onlyUnsent = false} = {}) {
    this.#requireOpen();
    requireUsable(limit,1,this.#maxPending,"send limit");
    if (typeof onlyUnsent !== "boolean") throw new TypeError("onlyUnsent must be boolean");
    const pending = [...this.#pending.values()];
    const first = pending.filter(e=>e.attempts===0);
    const retry = pending.filter(e=>e.attempts>0);
    // A genuine physical edge sends each previously unsent byte ONCE.
    // Retransmission of older unACKed edges is reserved for the fixed retry
    // interval, never for rapid pointer/key event floods (M156/M33 safety).
    const selected = (onlyUnsent ? first : [...first,...retry]).slice(0,limit)
      .sort((a,b)=>a.sequence-b.sequence);
    if (selected.some(e=>e.attempts>=this.#maxAttempts)) {
      this.retire();
      throw new Error("typed review retransmission attempts exhausted");
    }
    for (const e of selected) e.attempts++;
    return selected.map(e=>Object.freeze({
      source:e.source, action:e.action, sequence:e.sequence,
      gestureId:e.gestureId, attempt:e.attempts,
      bytes:new Uint8Array(e.bytes),
    }));
  }

  // Only the future authenticated connection owner may call this with its
  // PRIVATE lease object. An opaque JS token by itself proves no identity.
  // 0x12 ACK has NO source byte: sequence+gesture identify pending source
  // within the trusted connection. Never interpret ACK as a Combat hit.
  receiveAck(bytes, trustedLease) {
    this.#requireOpen();
    if (trustedLease !== this.#trustedLease)
      throw new Error("foreign connection lease ACK denied");
    const ack = decodeProposedGestureAck(bytes);
    const event = this.#pending.get(ack.sequence);
    if (!event) {
      // The original QUIC server can send ACCEPTED for an initial PRESS and
      // DUPLICATE for its already-dispatched retry. Both replies may arrive
      // after the first has settled. Correlate only authenticated same-lease
      // previously SENT and settled (sequence, gestureId) tuples.
      const settled = this.#settled.get(ack.sequence);
      if (!settled) throw new Error("replayed, unexpected or retired typed ACK");
      if (settled.gestureId !== ack.gestureId)
        throw new Error("typed ACK does not identify settled gesture");
      if (ack.status !== GESTURE_ACK_STATUS.ACCEPTED
          && ack.status !== GESTURE_ACK_STATUS.DUPLICATE)
        throw new Error("settled typed ACK status rejected");
      return Object.freeze({
        source:settled.source,action:settled.action,
        sequence:ack.sequence,gestureId:ack.gestureId,status:ack.status,
        serverTick:ack.serverTick,transportSettled:true,
        alreadySettled:true,combatCommitted:false,
      });
    }
    if (event.gestureId !== ack.gestureId)
      throw new Error("typed ACK does not identify pending gesture");
    if (event.attempts === 0)
      throw new Error("unscheduled typed edge cannot be ACKed");
    this.#pending.delete(event.sequence);
    const transportSettled = ack.status === GESTURE_ACK_STATUS.ACCEPTED
      || ack.status === GESTURE_ACK_STATUS.DUPLICATE;
    if (!transportSettled) this.retire();
    else {
      this.#settled.set(event.sequence,Object.freeze({
        source:event.source,action:event.action,gestureId:event.gestureId,
      }));
      if (this.#settled.size > MAX_SETTLED_TYPED_ACKS)
        this.#settled.delete(this.#settled.keys().next().value);
    }
    return Object.freeze({
      source:event.source,action:event.action,sequence:event.sequence,
      gestureId:event.gestureId,status:ack.status,serverTick:ack.serverTick,
      transportSettled,alreadySettled:false,combatCommitted:false,
    });
  }
  retire() {
    this.#closed = true;
    this.#allocator.retire();
    this.#pending.clear();
    this.#settled.clear();
    this.#reservations.clear();
  }
  get snapshot() {
    return Object.freeze({
      pending:this.#pending.size,
      settledReceipts:this.#settled.size,
      reservedTerminalCapacity:this.#reservedCount(),
      activeSources:Object.freeze([...this.#reservations.keys()]),
      closed:this.#closed,
      nextSequence:this.#allocator.snapshot.nextSequence,
      nextGestureId:this.#allocator.snapshot.nextGestureId,
    });
  }
}
