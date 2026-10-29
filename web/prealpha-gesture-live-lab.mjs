// One original game-page physical source0 owner on its server-granted lease.
// The experimental wrapper stays loopback-only. The instant-LMB wrapper also
// supports an explicitly enabled first-party pinned release configuration.
// A source event is not a hit; the original World alone applies damage.
import { ProposedSharedTypedGestureOutbox } from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import { createDormantSharedUi10Sources, attachDormantSharedUi10Sources } from "../src/browser/prealpha-shared-ui10-sources-review.mjs";
import { resolveInstantLmbProfile } from "../src/browser/instant-lmb-activation.mjs";

export async function activateLoopbackGestureLab(options) {
  return activateNegotiatedLmb(options, false);
}

export async function activateInstantLmb(options) {
  return activateNegotiatedLmb(options, true);
}

async function activateNegotiatedLmb({
  gameClient, canvas, windowObj, documentObj, getClientTick,
  isJumpAttackChord = () => false,
  enableJumpAttackReview = false,
  fetchConfig = globalThis.fetch,
} = {}, instantProfile = false) {
  if (!gameClient || !canvas || !windowObj || !documentObj
      || typeof getClientTick !== "function") {
    throw new TypeError("original canvas, WebTransport client and current tick required");
  }
  const loopback = new Set(["127.0.0.1","localhost","[::1]"]);
  const local = loopback.has(windowObj.location.hostname)
      && loopback.has(new URL(gameClient.transport.webTransportUrl).hostname);
  if (instantProfile) {
    if (!(await resolveInstantLmbProfile(windowObj.location,fetchConfig)).enabled
        || new URLSearchParams(windowObj.location.search).get("server") !== gameClient.transport.webTransportUrl) {
      throw new Error("instant LMB requires the trusted release profile or loopback preview");
    }
  } else if (!loopback.has(windowObj.location.hostname)
      || !loopback.has(new URL(gameClient.transport.webTransportUrl).hostname)) {
    throw new Error("real game v2 gesture lab cannot activate on public hosts");
  }
  // The native original Rust session may grant only ONCE; do not infer
  // admission from a query flag or a client-selected actor/boot epoch.
  if (instantProfile) await gameClient.negotiateInstantLmb();
  else await gameClient.negotiateExperimentalGestureV2({reliableStream:true});
  const lease = gameClient.transport;
  const outbox = new ProposedSharedTypedGestureOutbox({reviewVersion:2, trustedLease:lease});
  let failed = false, detached = false, retryTimer = null;
  const removeListeners = [];
  const upgradeTimers = new Set();
  // Bounded loopback-only attempted-write evidence, never an ACK or a hit.
  const attemptedTransmissions = [];
  let writeBatchPending = false, writeWatchdog = null;
  let gates = null, detachGates = null;

  function close(reason = "experimental gesture lease retired") {
    if (detached) return;
    detached = true;
    if (retryTimer !== null) clearInterval(retryTimer);
    if (writeWatchdog !== null) clearTimeout(writeWatchdog);
    writeWatchdog = null;
    for (const timer of upgradeTimers) clearTimeout(timer);
    upgradeTimers.clear();
    for (const [target,type,listener] of removeListeners) {
      target.removeEventListener(type,listener);
    }
    detachGates?.();
    gates?.closeLease();
    outbox.retire();
    gameClient.close(reason);
  }
  function fail(reason) {
    failed = true;
    close(reason || "typed gesture World/ACK rejected");
  }
  function drain(onlyUnsent = false) {
    // The one original outbox keeps new edges while the canonical transport
    // waits for writer readiness. Never consume another retry batch in flight.
    if (failed || detached || outbox.snapshot.closed || writeBatchPending) return;
    let packets;
    try {
      // First-send priority and maxAttempts are enforced by the original
      // Core8A queue, not by this original game-page event listener.
      // Physical changes spend only FIRST-send attempts; the fixed 170ms timer owns all retries.
      packets = outbox.nextSendBatch(4, {onlyUnsent});
    } catch {
      fail("bounded gesture sequence/retry state exhausted");
      return;
    }
    if (packets.length === 0) return;
    writeBatchPending = true;
    // This is a bounded transport stall, not the gameplay 135/320ms clock
    // and not evidence of admission or a HIT. Retire the original lease on
    // timeout so an old writer continuation cannot escape after reconnect.
    writeWatchdog = setTimeout(() => fail("typed gesture writer stalled for 1500ms"),1500);
    try {
      const writes = packets.map(packet => {
        attemptedTransmissions.push(Object.freeze({
          source:packet.source, action:packet.action, sequence:packet.sequence,
          gestureId:packet.gestureId, attempt:packet.attempt,
          currentLease:gameClient.transport === lease,
        }));
        if (attemptedTransmissions.length > 16) attemptedTransmissions.shift();
        try { return Promise.resolve(gameClient.sendExperimentalGestureEdge(packet.bytes)); }
        catch (error) { return Promise.reject(error); }
      });
      void Promise.all(writes).then(() => {
        if (writeWatchdog !== null) clearTimeout(writeWatchdog);
        writeWatchdog = null;
        writeBatchPending = false;
        // Physical releases authored while blocked stay in the SAME outbox.
        // Flush only previously unsent edges; the 170ms timer owns retries.
        if (!failed && !detached) drain(true);
      }).catch(() => fail("typed gesture QUIC delivery failed"));
    } catch {
      fail("typed gesture lease no longer current");
    }
  }

  // W3C may deliver pointerup then mouseup for ONE physical left release,
  // or only mouseup for RMB-held LMB. Only freshly authored sequences should
  // cause an immediate send. Retries remain solely on the existing timer.
  let lastFirstSendSequence = outbox.snapshot.nextSequence;
  function drainNewEdges() {
    if (failed || detached) return;
    const next = outbox.snapshot.nextSequence;
    if (next === lastFirstSendSequence) return;
    lastFirstSendSequence = next;
    drain(true);
  }
  function add(target,type,handler) {
    target.addEventListener(type,handler);
    removeListeners.push([target,type,handler]);
  }
  try {
    gates = createDormantSharedUi10Sources({
      outbox, getClientTick,
      isCanvasTarget:e => e.target === canvas,
      isChatFocused:() => Boolean(documentObj.activeElement?.closest?.("[data-local-chat]")),
      // Space+LMB is NOT an ordinary typed Light. Until Main0 approves an
      // exclusive authoritative JumpAttack route, fail closed rather than
      // inventing a second v1 attack writer or a false World Light.
      isJumpAttackChord,
      enableJumpAttackReview:enableJumpAttackReview || instantProfile,
      hasGameplayFocus:() => documentObj.activeElement === canvas,
      isTextEditing:() => Boolean(documentObj.activeElement?.matches?.("input,textarea,[contenteditable]")),
    });
    detachGates = attachDormantSharedUi10Sources(gates, {canvas, windowObj, documentObj});
    let lastUpgradeScheduledGestureId = null;
    function scheduleSource0Upgrade() {
      if (!gates.lmb.snapshot.active) return;
      const {pointerId,gestureId,jump} = gates.lmb.snapshot;
      if (jump) return; // no Heavy upgrade follows an admitted Space chord
      // PointerEvents (normal LMB) and RMB-held MouseEvents share ONE source0
      // gesture and exactly ONE upgrade timer. Server alone arbitrates 135ms
      // light and 320ms charge; this timer is merely a hold-intent edge.
      if (lastUpgradeScheduledGestureId === gestureId) return;
      lastUpgradeScheduledGestureId = gestureId;
      const timer = setTimeout(() => {
        upgradeTimers.delete(timer);
        if (detached || failed || !gates.lmb.snapshot.active
            || gates.lmb.snapshot.pointerId !== pointerId
            || gates.lmb.snapshot.gestureId !== gestureId) return;
        if (gates.lmb.approvedHoldUpgrade(pointerId)) drainNewEdges();
      },85);
      upgradeTimers.add(timer);
    }
    add(canvas,"pointerdown",event => {
      if (event.button !== 0) return;
      drainNewEdges(); // original capture already admitted the real physical edge
      scheduleSource0Upgrade();
    });
    add(canvas,"mousedown",event => {
      if (event.button !== 0 || (event.buttons & 2) === 0) return;
      drainNewEdges(); // no pointerdown occurs for LMB while RMB is already held
      scheduleSource0Upgrade();
    });
    add(windowObj,"pointerup",drainNewEdges);
    add(windowObj,"mouseup",drainNewEdges);
    add(windowObj,"pointercancel",drainNewEdges);
    add(canvas,"lostpointercapture",drainNewEdges);
    add(windowObj,"keydown",event => {
      // Space pressed after physical LMB: terminal is a genuine CANCEL,
      // never a phantom RELEASE or a second Light. A previously landed
      // original World Light cannot be undone by a later keypress.
      if (event.code === "Space" && !event.repeat) gates.jumpChord();
      drainNewEdges();
    });
    add(windowObj,"keyup",drainNewEdges);
    add(windowObj,"blur",drainNewEdges);
    // Element blur does not bubble to the window drain listener. The real
    // canvas losing focus (including Chat Enter) must flush its CANCEL now.
    add(canvas,"blur",() => { gates.blur(); drainNewEdges(); });
    // Capture already queued CANCEL; do not defer a hidden-page terminal to
    // the170ms retry timer, beyond the original135ms Light contact deadline.
    add(documentObj,"visibilitychange",drainNewEdges);
    add(windowObj,"pagehide",() => close("pagehide retires experimental actor lease"));
    // Bound retries; no dropped terminal and no private cross-lease replay.
    retryTimer = setInterval(() => {
      if (outbox.snapshot.closed) { fail("typed gesture lease was retired"); return; }
      if (outbox.snapshot.pending > 0) drain();
    },170);
    // Original-page localhost-only diagnostic: read-only physical edge/ACK
    // witness; never a user identity, hit, source of authority, or public UI.
    const receipts = [];
    const proof = () => Object.freeze({
      failed,closed:detached,transportState:lease.experimentalGestureState,
      pending:outbox.snapshot.pending,
      activeSources:outbox.snapshot.activeSources,
      nextSequence:outbox.snapshot.nextSequence,
      attemptedTransmissions:Object.freeze(attemptedTransmissions.slice()),
      acknowledged:receipts.map(x=>({...x})),
      // Actual replicated fields only: no prediction, inferred damage,
      // allocation or gameplay writes. Each read returns detached snapshots.
      ownPlayerNetId:gameClient.playerNetId,
      serverTick:gameClient.latestServerTick,
      replicatedFighters:Object.freeze(gameClient.state instanceof Map
        ? [...gameClient.state.values()].map(fighter=>Object.freeze({
          netId:fighter.netId,x:fighter.x,y:fighter.y,action:fighter.action,
          hp:fighter.hp,guard:fighter.guard,stamina:fighter.stamina,
        })) : []),
    });
    if (local) Object.defineProperty(windowObj,"__MYASO_LOCAL_GESTURE_PROOF__",{
      configurable:true,value:proof,
    });
    return Object.freeze({outbox,lease,close,fail,
      noteAck(receipt) {
        receipts.push(Object.freeze({
          sequence:receipt.sequence,gestureId:receipt.gestureId,
          source:receipt.source,action:receipt.action,status:receipt.status,
          serverTick:receipt.serverTick,transportSettled:receipt.transportSettled,
        }));
        if (receipts.length > 16) receipts.shift();
      },
      get snapshot() { return Object.freeze({failed,closed:detached,pending:outbox.snapshot.pending}); },
    });
  } catch (error) {
    fail("failed to initialize actual physical source0/source1 owners");
    throw error;
  }
}
