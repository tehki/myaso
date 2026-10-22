// Core 8A REVIEW-ONLY v2 gesture transport outbox. NEVER imported by gameplay.
// This queues fast DOM edges independently of the existing 30Hz sampled v1 input.
// It does not negotiate a real QUIC stream, authenticate a connection, authorize
// combat damage, or convert a transport ACK into a Combat hit confirmation.
import {
  PROPOSED_GESTURE_VERSION, GESTURE_ACTION, GESTURE_ACK_STATUS,
  encodeProposedGestureEvent, decodeProposedGestureAck,
} from "./prealpha-lmb-gesture-proposal.mjs";

const U32_MAX = 0xffff_ffff;
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
    // Fair first-send: no queued RELEASE/CANCEL/UPGRADE may be starved by
    // retrying an older unACKed PRESS when the owner requests tiny batches.
    // All first attempts go out in their original order before retry selection.
    // Sort the final batch by original sequence for its wire presentation;
    // the future authoritative Rust ingress separately buffers genuine gaps.
    const pending = [...this.#pending.values()];
    const firstAttempts = pending.filter(e=>e.attempts===0);
    const retransmits = pending.filter(e=>e.attempts>0);
    const selected = [...firstAttempts,...retransmits]
      .slice(0,limit)
      .sort((a,b)=>a.sequence-b.sequence);
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
    // An event enqueued but NOT YET returned in any send batch has never
    // been offered to the trusted transport owner. Even an ACK on the same
    // opaque connection cannot settle that unscheduled event. This is not
    // proof bytes were sent: only a future authenticated QUIC stream can
    // establish that. Keep the event queued on refusal.
    if (existing.attempts === 0)
      throw new Error("ACK for an unscheduled gesture event rejected");
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
