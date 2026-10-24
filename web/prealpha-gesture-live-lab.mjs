// ORIGINAL GAME-PAGE EXPERIMENT ONLY, never public admission or a release toggle.
// The caller has already confirmed both the page and its pinned Rust QUIC host
// are loopback. Only the existing original GameClient transport owns v2.
// A source event is not a hit; the original World alone applies damage.
import { ProposedSharedTypedGestureOutbox } from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import { createDormantSharedUi10Sources, attachDormantSharedUi10Sources } from "../src/browser/prealpha-shared-ui10-sources-review.mjs";

export async function activateLoopbackGestureLab({
  gameClient, canvas, windowObj, documentObj, getClientTick,
} = {}) {
  if (!gameClient || !canvas || !windowObj || !documentObj
      || typeof getClientTick !== "function") {
    throw new TypeError("original canvas, WebTransport client and current tick required");
  }
  const loopback = new Set(["127.0.0.1","localhost","[::1]"]);
  if (!loopback.has(windowObj.location.hostname)
      || !loopback.has(new URL(gameClient.transport.webTransportUrl).hostname)) {
    throw new Error("real game v2 gesture lab cannot activate on public hosts");
  }
  // The native original Rust session may grant only ONCE; do not infer
  // admission from a query flag or a client-selected actor/boot epoch.
  await gameClient.negotiateExperimentalGestureV2();
  const lease = gameClient.transport;
  const outbox = new ProposedSharedTypedGestureOutbox({reviewVersion:2, trustedLease:lease});
  let failed = false, detached = false, retryTimer = null;
  const removeListeners = [];
  let gates = null, detachGates = null;

  function close(reason = "experimental gesture lease retired") {
    if (detached) return;
    detached = true;
    if (retryTimer !== null) clearInterval(retryTimer);
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
    if (failed || detached || outbox.snapshot.closed) return;
    let packets;
    try {
      // Physical input events flush NEW edges only. Retries are triggered
      // solely by the bounded 170ms timer; repeated DOM notifications must
      // never consume the three-attempt budget before an actual server ACK.
      packets = outbox.nextSendBatch(4, {onlyUnsent});
    } catch {
      fail("bounded gesture sequence/retry state exhausted");
      return;
    }
    for (const packet of packets) {
      // One same-session QUIC datagram writer serializes all physical edges.
      // Never put an edge on latest-wins sampled movement transport.
      try {
        void gameClient.sendExperimentalGestureEdge(packet.bytes)
          .catch(() => fail("typed gesture QUIC delivery failed"));
      } catch {
        fail("typed gesture lease no longer current");
        return;
      }
    }
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
      isJumpAttackChord:() => false, // Rust World owns validity; never fake an action
      hasGameplayFocus:() => documentObj.activeElement === canvas,
      isTextEditing:() => Boolean(documentObj.activeElement?.matches?.("input,textarea,[contenteditable]")),
    });
    detachGates = attachDormantSharedUi10Sources(gates, {canvas, windowObj, documentObj});
    add(canvas,"pointerdown",event => {
      drain(true); // native capture already admitted real mouse pointer DOWN
      if (event.button !== 0 || !gates.lmb.snapshot.active) return;
      const {pointerId,gestureId} = gates.lmb.snapshot;
      // This is only an UPGRADE *intent*. Rust checks <135ms on ITS clock
      // and refuses late upgrades; READY320ms and hits are never client timers.
      setTimeout(() => {
        if (detached || failed || !gates.lmb.snapshot.active
            || gates.lmb.snapshot.pointerId !== pointerId
            || gates.lmb.snapshot.gestureId !== gestureId) return;
        if (gates.lmb.approvedHoldUpgrade(pointerId)) drain(true);
      },85);
    });
    add(windowObj,"pointerup",() => drain(true));
    add(windowObj,"pointercancel",() => drain(true));
    add(canvas,"lostpointercapture",() => drain(true));
    add(windowObj,"keydown",() => drain(true));
    add(windowObj,"keyup",() => drain(true));
    add(windowObj,"blur",() => drain(true));
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
      acknowledged:receipts.map(x=>({...x})),
    });
    Object.defineProperty(windowObj,"__MYASO_LOCAL_GESTURE_PROOF__",{
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
