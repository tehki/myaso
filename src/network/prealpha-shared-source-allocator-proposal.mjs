// DORMANT / REVIEW ONLY. Main #723 selected ONE 0x11 EVENT / 0x12 ACK
// family, but no authenticated source-tagged transport has been approved.
// This is an identifier allocator ONLY, not an outbox/QUIC sender or hit grant.
// Every connection MUST use one allocator for both LMB and standalone KeyE.
// An opaque object token here is a test lease handle, NOT proof of admission.
import {
  PROPOSED_GESTURE_VERSION,
  PROPOSED_GESTURE_SOURCE as SOURCE,
  GESTURE_ACTION as ACTION,
  encodeProposedTypedGestureEvent,
} from "./prealpha-lmb-gesture-proposal.mjs";

const MAX_U32 = 0xffff_ffff;
const validTick = value =>
  Number.isInteger(value) && value >= 0 && value <= MAX_U32;

export class ProposedSharedSourceGestureAllocator {
  #trustedLease;
  #sequence = 1;
  #gestureId = 1;
  #active = new Map();
  #closed = false;

  constructor({reviewVersion, trustedLease, testOnlyInitialSequence = 1} = {}) {
    if (reviewVersion !== PROPOSED_GESTURE_VERSION)
      throw new Error("review version 2 explicitly required; NOT live negotiation");
    if (trustedLease === null || typeof trustedLease !== "object")
      throw new TypeError("opaque current review lease object required");
    if (!Number.isInteger(testOnlyInitialSequence)
        || testOnlyInitialSequence < 1 || testOnlyInitialSequence > MAX_U32)
      throw new RangeError("test-only initial sequence must be a nonzero u32");
    // Test seam ONLY: simulate nearing u32 exhaustion without billions of
    // events. This dormant review class is not imported by live game code.
    this.#sequence = testOnlyInitialSequence;
    this.#trustedLease = trustedLease;
  }

  #requireOpen() {
    if (this.#closed) throw new Error("review lease retired or identifiers exhausted");
  }
  #checkSource(source) {
    // Legacy source1 (Key E) is no longer a Combat input.
    if (source !== SOURCE.LMB)
      throw new RangeError("Combat permits only the physical LMB gesture source");
  }
  #checkTick(clientTick) {
    if (!validTick(clientTick)) throw new RangeError("diagnostic clientTick must be u32");
  }
  #requireAvailable(count, preserveActive = false) {
    if (this.#sequence > MAX_U32 || MAX_U32 - this.#sequence + 1 < count) {
      // Refusing a prospective second source must NOT retire an existing
      // well-reserved source and strand its valid UPGRADE/RELEASE/CANCEL.
      if (!preserveActive) this.retire();
      throw new Error("review sequence capacity exhausted; obtain fresh connection lease");
    }
  }
  #remainingActiveEdges() {
    let required = 0;
    for (const [source, state] of this.#active) {
      required += 1; // one eventual RELEASE or CANCEL for each active source
      if (source === SOURCE.LMB && !state.upgraded)
        required += 1; // optional future UPGRADE, before its terminal
    }
    return required;
  }
  #event(source, action, gestureId, clientTick) {
    // Validations are performed before any counters change. Every event gets
    // exactly one globally monotonic ID across BOTH sources on this lease.
    this.#requireOpen();
    this.#checkSource(source);
    this.#checkTick(clientTick);
    this.#requireAvailable(1);
    const sequence = this.#sequence;
    const bytes = new Uint8Array(encodeProposedTypedGestureEvent({
      source, action, sequence, gestureId, clientTick,
    }));
    this.#sequence++;
    return Object.freeze({source, action, sequence, gestureId, clientTick, bytes});
  }

  begin(source, clientTick = 0) { return this.#begin(source, clientTick, ACTION.PRESS); }
  beginJumpAttack(source, clientTick = 0) { return this.#begin(source, clientTick, ACTION.JUMP_ATTACK); }
  #begin(source, clientTick, action) {
    this.#requireOpen();
    this.#checkSource(source);
    this.#checkTick(clientTick);
    if (this.#active.has(source))
      throw new Error("active gesture of this source must terminate first");
    if (this.#gestureId > MAX_U32) {
      this.retire();
      throw new Error("review gesture IDs exhausted; fresh lease required");
    }
    // Reserve every outstanding edge in BOTH active sources. In particular,
    // starting KeyE must ALSO reserve the pre-existing unupgraded LMB's
    // optional UPGRADE, not just its terminal (Core8C #723 review finding).
    // This is COUNTER headroom, not pending/outbox packet capacity.
    this.#requireAvailable(
      this.#remainingActiveEdges() + 1 + (source === SOURCE.LMB ? 2 : 1),
      this.#active.size > 0, // only retire if no valid older source exists
    );
    const gestureId = this.#gestureId;
    const event = this.#event(source, action, gestureId, clientTick);
    this.#gestureId++;
    // Chord never supports Heavy upgrade; only a physical terminal.
    this.#active.set(source, {gestureId, upgraded:action===ACTION.JUMP_ATTACK});
    return event;
  }

  upgrade(clientTick = 0) {
    this.#requireOpen();
    const active = this.#active.get(SOURCE.LMB);
    if (!active || active.upgraded)
      throw new Error("only one upgrade of an active LMB gesture is permitted");
    this.#checkTick(clientTick);
    this.#requireAvailable(1 + this.#active.size);
    const event = this.#event(SOURCE.LMB, ACTION.UPGRADE, active.gestureId, clientTick);
    active.upgraded = true;
    return event;
  }

  release(source, clientTick = 0) {
    return this.#end(source, ACTION.RELEASE, clientTick);
  }
  cancel(source, clientTick = 0) {
    return this.#end(source, ACTION.CANCEL, clientTick);
  }
  #end(source, action, clientTick) {
    this.#requireOpen();
    this.#checkSource(source);
    this.#checkTick(clientTick);
    const active = this.#active.get(source);
    if (!active) throw new Error("no active gesture of this source");
    // Until this terminal commits, preserve the OTHER source's optional
    // LMB upgrade and all still-active terminals at the u32 boundary.
    this.#requireAvailable(this.#remainingActiveEdges());
    const event = this.#event(source, action, active.gestureId, clientTick);
    this.#active.delete(source);
    return event;
  }

  retire() {
    this.#closed = true;
    this.#active.clear();
  }
  get snapshot() {
    return Object.freeze({
      nextSequence:this.#sequence,
      nextGestureId:this.#gestureId,
      activeSources:Object.freeze([...this.#active.keys()]),
      closed:this.#closed,
    });
  }
}
