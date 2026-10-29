import { createFrameBudget } from "../src/browser/frame-budget.mjs";
import { recordM233RecoveryHandoff } from "../src/browser/m233-recovery-handoff-trace.mjs";
import { installRightButtonGesture } from "../src/browser/right-button-gesture.mjs";
import { createDirectionalDash } from "../src/browser/dash-input.mjs";
import { createLeftButtonCharge } from "../src/browser/left-button-charge.mjs";
import { createM147InputChronology } from "../src/browser/m147-input-chronology.mjs";
import { createM41PhysicalInputChronology } from "../src/browser/m41-physical-input-chronology.mjs";
import { createAfterSource0Audio } from "../src/browser/after-source0-audio.mjs";
import { authoritativeWindupHudHint } from "../src/browser/authoritative-windup-hud.mjs";
import { captureLightAttackMovement, resolveLightAttackReleaseMovement } from "../src/browser/light-attack-movement.mjs";
import { createCombatImpactController } from "../src/browser/combat-impact.mjs";
import { createGameAudio, installGameAudioControls, soundForCombatFeedback, createRemoteActionAudioTracker } from "../src/browser/game-audio.mjs";
import { COMBAT_ACTION, blockSpatialPresentation, combatActionHint, combatOverlayPresentation, createCombatReadabilityTracker, createRemoteDamageTracker, fighterFocusNetId, fighterGuardBreakPunishNetId, guardBreakPunishRangeCue, fighterKnockdownPunishNetId, knockdownPunishRangeCue, fighterParryPunishNetId, parryPunishRangeCue, fighterRecoveryNetId, recoveryPunishRangeCue, punishRangeCueIntent, fighterIdentityPresentation, fighterThreatBearingLabel, fighterThreatGuardArcLabel, fighterThreatNetId, fighterThreatPhaseLabel, fighterThreatPhaseState, fighterMatchPointPresentation, fighterMatchPresentation, fighterScoreboardPresentation, FFA_KILL_TARGET, fighterVitalsPresentation, guardBreakSpatialPresentation, killFeedPresentation, opponentRecoveryPresentation, parrySpatialPresentation, staminaDenialPresentation, ownCombatReadinessPresentation } from "../src/browser/combat-readability.mjs";
import { COMBAT } from "../src/combat/model.mjs";
import { isTickNewer32, reconcilePrediction } from "../src/browser/reconciliation.mjs";
import { createReconciliationCamera, createSnapshotRenderClock } from "../src/browser/smooth-motion.mjs";
import { createRenderGapTelemetry } from "../src/browser/render-gap-telemetry.mjs";
import { ARENA_VIEW_ZOOM, nearbyOffscreenPointers, projectArenaPoint } from "../src/browser/arena-viewport.mjs";
import { NETWORK } from "../src/network/constants.mjs";
import { createKnightSpriteRenderer, showPrototypeWeaponStroke } from "./knight-sprites.mjs";
import { paintArenaLiteFloor } from "../src/browser/prealpha-arena-lite-floor.mjs";
import { createWorldAnchoredArenaFloor } from "../src/browser/arena-world-floor.mjs";
import { connectAuthoritativeClient, parseSha256Hex } from "./authoritative-client.mjs";
import { activateLoopbackGestureLab } from "./prealpha-gesture-live-lab.mjs";

const canvas = document.querySelector("#arena");
const chargeHud = {
  root: document.querySelector("#heavy-charge-indicator"),
  value: document.querySelector("#heavy-charge-value"),
  fill: document.querySelector("#heavy-charge-fill"),
};
function updateChargeHud() {
  const progress = leftButtonCharge.progress();
  chargeHud.root.hidden = progress <= 0;
  if (progress <= 0) return;
  const percent = Math.min(100, Math.round(progress * 100));
  chargeHud.value.textContent = percent === 100 ? "READY" : `${percent}%`;
  chargeHud.root.dataset.ready = String(percent === 100);
  chargeHud.fill.style.transform = `scaleX(${progress})`;
}

const ctx = canvas.getContext("2d", { alpha: false });
const eventText = document.querySelector("#event-text");
const arenaStage = document.querySelector(".arena-stage");
const scoreboardList = document.querySelector("#scoreboard-list");
const scoreboardTitle = document.querySelector("#scoreboard-title");
const matchPoint = document.querySelector("#match-point");
const killFeedList = document.querySelector("#kill-feed-list");
const hud = {
  playerHp: document.querySelector("#player-hp"),
  playerHpValue: document.querySelector("#player-hp-value"),
  playerGuard: document.querySelector("#player-guard"),
  playerGuardValue: document.querySelector("#player-guard-value"),
  playerStamina: document.querySelector("#player-stamina"),
  playerStaminaValue: document.querySelector("#player-stamina-value"),
  botHp: document.querySelector("#bot-hp"),
  botHpValue: document.querySelector("#bot-hp-value"),
  botGuard: document.querySelector("#bot-guard"),
  botGuardValue: document.querySelector("#bot-guard-value"),
  focusLabel: document.querySelector("#focus-label"),
};
const hudCache = { playerHp: null, playerGuard: null, playerStamina: null, botHp: null, botGuard: null, focusNetId: null, focusMode: null, status: null, scoreboard: null, matchPoint: null };
const ownReadiness = {
  root: document.querySelector("#own-readiness"),
  label: document.querySelector("#own-readiness-label"),
  detail: document.querySelector("#own-readiness-detail"),
  state: "",
  text: "",
  detailText: "",
};
const combatOverlay = {
  root: document.querySelector("#combat-overlay"),
  title: document.querySelector("#combat-overlay-title"),
  detail: document.querySelector("#combat-overlay-detail"),
};
const opponentRecovery = {
  root: document.querySelector("#opponent-recovery"),
  label: document.querySelector("#opponent-recovery-label"),
  detail: document.querySelector("#opponent-recovery-detail"),
  rangeCue: document.querySelector("#punish-range"),
};
const threatCue = {
  root: document.querySelector("#threat-cue"),
  label: document.querySelector("#threat-label"),
  phase: document.querySelector("#threat-phase"),
  countLabel: document.querySelector("#threat-count"),
  secondaryLabel: document.querySelector("#threat-secondary"),
  secondaryBearingLabel: document.querySelector("#threat-secondary-bearing"),
  secondaryPhaseLabel: document.querySelector("#threat-secondary-phase"),
  secondaryGuardArcLabel: document.querySelector("#threat-secondary-guard-arc"),
  bearingLabel: document.querySelector("#threat-bearing"),
  guardArcLabel: document.querySelector("#threat-guard-arc"),
  netId: 0,
  state: "",
  phaseText: "",
  count: 0,
  secondaryNetId: 0,
  secondaryBearing: "",
  secondaryPhase: "",
  secondaryGuardArc: "",
  bearing: "",
  guardArc: "",
  jumpCommittedNetId: 0,
  jumpCommittedPrimary: false,
};
const threatScan = { count: 0, secondaryNetId: 0 };
const threatCommitmentScan = { count: 0, secondaryNetId: 0 };
const combatReadability = createCombatReadabilityTracker();
const combatImpact = createCombatImpactController();
const remoteDamage = createRemoteDamageTracker();
let networkStatus = "Connecting to authoritative server...";
let combatMessage = null;
let combatMessageUntil = 0;
// A distinct authenticated LightWindup must remain readable even if an earlier
// attack left the same status string on screen. Never create a client attack.
let lastWorldStatusAction = null;
let lastWorldStatusActorId = null;
let combatFeedbackTimer = 0;
let authoritativeStamina = null;
let pendingStaminaDenial = null;
let matchOver = false;
const killFeedEntries = [];
const killFeedSequences = new Set();

const params = new URLSearchParams(window.location.search);
// Graphics 3 P1 REVIEW ONLY: World9 authored visuals are loaded lazily, solely
// after BOTH explicit switches. P0 arena/Combat/Chat never imports this stack.
// This grants no collision, door, item, portal, spawn or zone authority.
const greyhavenPreviewRequested = params.get("world") === "1"
  && params.get("greyhaven") === "1" && !params.has("scenario");
let greyhavenPreview = null;
if (greyhavenPreviewRequested) {
  void Promise.all([
    import("../src/browser/authored-world-renderer.mjs"),
    import("../src/world/authored-maps.mjs"),
  ]).then(([{createAuthoredWorldRenderer}, {MAP_IDS}]) => {
    greyhavenPreview = {renderer: createAuthoredWorldRenderer(), mapId: MAP_IDS.overworld};
  }).catch(() => { greyhavenPreview = null; });
}
// Separate original 3B A2.32 review: source SHA/size are verified before
// World9 may suppress its one approved "red-lion" placeholder. Never load
// these optional image assets in the Combat/Chat default or acceptance lab.
let redLionPreview = null;
if (greyhavenPreviewRequested && params.get("redlion") === "1") {
  void import("../src/browser/red-lion-live-art.mjs").then(async module => {
    const art = module.createOriginalRedLionLiveArt();
    if (await art.load()) {
      redLionPreview = {art, draw: module.drawScreenLayerInZoomedGame};
    }
  }).catch(() => { redLionPreview = null; });
}
// Combat Pre-Alpha 0.1: all authenticated arena fighters are human Silver
// Knights via the official lobby knights=1. Direct legacy Combat test URLs
// and rollback without this flag keep original Combat-circle visuals.
// Every official Silver Knight uses the real Blender-relit atlas by default;
// a deliberate ?knightArt=original permits comparison/visual rollback. Roll
// remains the original source clip. Combat state/tells remain authoritative.
const knightSprites = params.get("knights") === "1"
  ? createKnightSpriteRenderer({sourceArtVariant: params.get("knightArt") === "original" ? "original" : "relit"})
  : null;
const diagnosticsVisible = params.get("netstats") === "1";
const renderGapTelemetry = diagnosticsVisible ? createRenderGapTelemetry() : null;
const diagnosticsPanel = document.querySelector("#network-diagnostics");
if (diagnosticsPanel) diagnosticsPanel.hidden = !diagnosticsVisible;
let lastDiagnosticsDrawMs = 0;
function updateNetworkDiagnostics(nowMs) {
  if (!diagnosticsVisible || !diagnosticsPanel || !networkClient || nowMs - lastDiagnosticsDrawMs < 500) return;
  lastDiagnosticsDrawMs = nowMs;
  const s = networkClient.diagnostics.snapshot();
  const renderGap = renderGapTelemetry.snapshot();
  const time = (ms) => ms === null ? "collecting…" : `${Math.round(ms)}ms`;
  // textContent only: measurements never enter HTML, storage or network logs.
  diagnosticsPanel.textContent =
    `Input→ACK p50 ${time(s.inputAckP50Ms)} · p95 ${time(s.inputAckP95Ms)}`
    + ` | Jitter p95 ${time(s.ackJitterP95Ms)}`
    + ` | Snapshots p50 ${time(s.snapshotGapP50Ms)} · p95 ${time(s.snapshotGapP95Ms)}`
    + ` | Camera correction p95 ${s.cameraCorrectionP95 === null ? "collecting…" : s.cameraCorrectionP95 + "u"}`
    + ` | Stale-own ACKs ${s.staleOwnAtAckCount}`
    + ` | Deferred reconciles ${networkClient.ackGateMetrics.deferred}`
    + ` | Render catch-ups ${snapshotRenderClock.metrics().boundedCatchups}`
    + ` | Extra render lag p50 ${time(renderGap.p50Ms)} · p95 ${time(renderGap.p95Ms)}`
    + ` | >33ms ${renderGap.overThresholdPct === null ? "collecting…" : renderGap.overThresholdPct + "%"} (${renderGap.samples} samples)`
    + ` | Samples ${s.inputAckSamples}`;
}
const acceptanceScenario = params.get("scenario");
// REVIEW ONLY: bounded, read-only legacy v1 M111 input-plane chronology.
// The observer NEVER sends Combat input, changes request latches or grants HIT.
const m111InputProbe = (acceptanceScenario === "uiheavyguardbreakpunish"
  || acceptanceScenario === "uirollknockdownffahit")
  && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
  ? (window.__MYASO_M111_INPUT_PLANE__ = {
      physicalTerminals: [], lightReleases: [], submitted: [],
    })
  : null;
const server = params.get("server");
if (!server) throw new Error("online mode requires ?server=https://host:port/game");
// Original M147, genuine Firefox only: bounded local browser-stage timestamps.
// Both the page and authoritative server must be loopback. No public telemetry.
const m147InputProbe = acceptanceScenario === "uijumppunishffa"
  && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
  && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(server).hostname)
  ? createM147InputChronology() : null;
if (m147InputProbe) window.__MYASO_M147_INPUT_PLANE__ = m147InputProbe.events;
const cert = params.get("cert");
// Opt-in NONRELEASE: the actual game page and the ORIGINAL pinned Rust World
// must both be loopback. Public /web/ and official lobby never select v2.
const gestureLabRequested = params.get("gestureLab") === "1";
// P0 extension only: requires explicit opt-in on both localhost endpoints.
const jumpCombatReviewRequested = params.get("jumpCombatReview") === "1";
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const reviewedGestureLab = gestureLabRequested
  && loopbackHosts.has(window.location.hostname)
  && loopbackHosts.has(new URL(server).hostname);
if (gestureLabRequested && !reviewedGestureLab) {
  throw new Error("experimental server-authoritative gestures are loopback-only");
}
if (jumpCombatReviewRequested && !reviewedGestureLab) {
  throw new Error("JumpAttack review requires original loopback gestureLab");
}
const privateHitLabRequested = params.get("hitDeliveryLab") === "1";
// Private receipts require the actor proven by an actual processed-input ACK.
// The first sender frame runs only after module initialization; awaiting that
// ACK during module startup would deadlock real online admission.
let resolvePrivateHitActor = null;
let privateHitProcessedAckActor = null;
const privateHitActorReady = privateHitLabRequested
  ? new Promise(resolve => { resolvePrivateHitActor = resolve; }) : null;
if (privateHitLabRequested && !reviewedGestureLab) {
  throw new Error("private HIT delivery requires the reviewed loopback gesture lab");
}

const webTransportOptions = cert
  ? { serverCertificateHashes: [{ algorithm: "sha-256", value: parseSha256Hex(cert) }] }
  : undefined;

const keys = new Set();
const audio = createGameAudio();
// Presentation may warm up only AFTER the real original combat input is authored.
const afterSource0Audio = createAfterSource0Audio({ audio });
// Acceptance-only physical wheel -> sampled Block -> original v1 invocation.
const m41PhysicalChronology = acceptanceScenario === "uiparrytell"
  || acceptanceScenario === "uistun" ? createM41PhysicalInputChronology() : null;
installGameAudioControls(audio);
const remoteActionAudio = createRemoteActionAudioTracker();
const dashGesture = createDirectionalDash();
let dashRequested = false;
let dashMove = null;
let predictedDashDir = { x: 0, y: 0 };
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
const local = { x: 0, y: 0, facing: 0, hp: 100, guard: 100, stamina: 100, action: 0, initialized: false };
const currentInput = {
  moveX: 0, moveY: 0, facing: 0, attack: false, heavyAttack: false, dash: false,
  dodge: false, block: false, kick: false, run: false, jump: false,
};
const arenaLayer = createArenaLayer();
const arenaFloorRenderer = params.get("arenaGrid") !== "1"
  ? createWorldAnchoredArenaFloor(ctx, arenaLayer)
  : null;
function drawArenaGround(camera) {
  if (arenaFloorRenderer) {
    arenaFloorRenderer.draw(camera, canvas.width, canvas.height);
  } else {
    // Unchanged owner-accessible debug-grid visual rollback.
    ctx.drawImage(arenaLayer, 0, 0);
  }
}
const remoteScratch = new Map();
const visibleEnemyPositions = [];
const snapshotRenderClock = createSnapshotRenderClock();
const visualCamera = createReconciliationCamera();
const visualCameraPosition = { x: 0, y: 0 };
const fixedStepMs = 1000 / NETWORK.clientPredictionHz;
const frameBudget = createFrameBudget({ stepMs: fixedStepMs, maxFrameDeltaMs: 50, maxStepsPerFrame: 6 });
let networkClient = null;
let experimentalGestureLab = null;
let privateHitDeliveryLab = null;
let animationFrameId = 0;
let predictionStep = 0;
let clientTick = 0;
let attackRequested = false;
let runningAttackRequested = false;
let committedLightMove = null;
let leftButtonPressMovement = null;
let leftButtonDown = false;
let heavyAttackRequested = false;
let rollRequested = false;
let kickRequested = false;
let jumpRequested = false;
let shortBlockUntil = 0;
let middleBlockHeld = false;
const leftButtonCharge = createLeftButtonCharge({
  onLight() {
    attackRequested = true;
    if (typeof m147InputProbe !== "undefined") m147InputProbe?.onLight();
    committedLightMove = resolveLightAttackReleaseMovement(
      captureLightAttackMovement(keys), leftButtonPressMovement);
    leftButtonPressMovement = null;
    // Read-only M111 observation stays after the original movement latch.
    // Original R1 requires that no instrumentation intervene between the
    // onLight edge and this release-direction capture.
    if (m111InputProbe) {
      m111InputProbe.lightReleases.push({
        epochMs: Date.now(), actionAtRelease: local.action,
      });
      if (m111InputProbe.lightReleases.length > 32) m111InputProbe.lightReleases.shift();
    }
    if (local.action === COMBAT_ACTION.jump) queueStaminaDenial("jump-attack");
    else if (!pendingStaminaDenial && (jumpRequested || keys.has("Space"))) queueStaminaDenial("jump-attack-chord");
    else if (rightButtonGesture.isRunning() && ["KeyW", "KeyA", "KeyS", "KeyD"].some((code) => keys.has(code))) {
      runningAttackRequested = true;
      queueStaminaDenial("running-attack");
    }
    audio.play("light");
  },
  onHeavy() { heavyAttackRequested = true; leftButtonPressMovement = null; audio.play("heavy"); },
});
const rightButtonGesture = installRightButtonGesture(canvas, {
  onKick: () => {
    kickRequested = true;
    audio.play("kick");
    queueStaminaDenial("kick");
  },
});
let staminaRegenBlockedUntil = 0;

canvas.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("auxclick", (event) => {
  if (event.button === 1) event.preventDefault();
});
canvas.addEventListener("pointerdown", (event) => {
  canvas.focus();
  updateMouse(event);
  if (event.button === 1) {
    event.preventDefault();
    middleBlockHeld = true;
    return;
  }
  if (event.button === 0) {
    if (reviewedGestureLab) return; // v2 capture owns edge, no sampled attack
    leftButtonDown = true;
    leftButtonPressMovement = captureLightAttackMovement(keys);
    leftButtonCharge.press(event.pointerId, {
      immediate: local.action === COMBAT_ACTION.jump || jumpRequested || keys.has("Space"),
    });
    return;
  }
});
function onLeftPointerUp(event) {
  if (event.button === 1) {
    middleBlockHeld = false;
    return;
  }
  if (event.button !== 0) return;
  if (reviewedGestureLab) return; // v2 capture owns physical terminal
  if (typeof m147InputProbe !== "undefined") m147InputProbe?.pointerUp(event);
  updateMouse(event);
  if (typeof m147InputProbe !== "undefined") m147InputProbe?.releaseInvocation();
  const committed = leftButtonCharge.release(event.pointerId);
  // Only the matching physical pointer may retire the current gesture.
  if (committed === null) return;
  if (typeof m147InputProbe !== "undefined") m147InputProbe?.release(committed);
  leftButtonDown = false;
  leftButtonPressMovement = null;
  if (m111InputProbe && committed) {
    m111InputProbe.physicalTerminals.push({
      epochMs: Date.now(), trusted: event.isTrusted,
      pointerId: event.pointerId, classification: committed,
    });
    if (m111InputProbe.physicalTerminals.length > 32) m111InputProbe.physicalTerminals.shift();
  }
  // Initial AudioContext construction consumed 410ms inside real M147
  // pointerUP. Keep genuine release/Light synchronous; defer first-use audio
  // until AFTER the unmodified original v1 sender accepts its release sample.
  if (typeof afterSource0Audio !== "undefined") afterSource0Audio?.noteRelease(committed);
  if (typeof m147InputProbe !== "undefined") m147InputProbe?.pointerHandlerEnd();
}
canvas.addEventListener("pointerup", onLeftPointerUp);
// W3C Pointer Events fire pointerdown/up only on transitions between zero
// and any pressed mouse button. With RMB held, additional LMB down/up
// produces mouse events but no pointer events: preserve running attacks.
const CHORDED_LEFT_POINTER_ID = -1;
let chordedLeftDown = false;
canvas.addEventListener("mousedown", (event) => {
  if (reviewedGestureLab || event.button !== 0 || !(event.buttons & 2) || leftButtonCharge.isPressed()) return;
  canvas.focus();
  updateMouse(event);
  leftButtonDown = true;
  leftButtonPressMovement = captureLightAttackMovement(keys);
  chordedLeftDown = true;
  leftButtonCharge.press(CHORDED_LEFT_POINTER_ID, {
    immediate: local.action === COMBAT_ACTION.jump || jumpRequested || keys.has("Space"),
  });
});
function onChordedLeftMouseUp(event) {
  if (reviewedGestureLab || event.button !== 0 || !chordedLeftDown) return;
  chordedLeftDown = false;
  leftButtonDown = false;
  updateMouse(event);
  leftButtonCharge.release(CHORDED_LEFT_POINTER_ID);
  leftButtonPressMovement = null;
}
canvas.addEventListener("mouseup", onChordedLeftMouseUp);
window.addEventListener("mouseup", onChordedLeftMouseUp);

window.addEventListener("pointerup", onLeftPointerUp);
// One pointer-owned cancellation path; pointercancel may report button=-1.
// Never clear a newer LMB gesture for stale pointer capture loss.
function cancelActiveLeftPointer(pointerId) {
  if (reviewedGestureLab) return false; // selected v2 gate owns its own input
  if (!leftButtonCharge.cancel(pointerId)) return false;
  leftButtonDown = false;
  leftButtonPressMovement = null;
  chordedLeftDown = false;
  return true;
}
canvas.addEventListener("pointercancel", (event) => {
  if (event.button === 1) middleBlockHeld = false;
  cancelActiveLeftPointer(event.pointerId);
});
canvas.addEventListener("lostpointercapture", (event) => {
  if (event.button === 1) middleBlockHeld = false;
  if (event.pointerId !== undefined && !(event.buttons & 1)) {
    cancelActiveLeftPointer(event.pointerId);
  }
});
canvas.addEventListener("wheel", (event) => {
  const m41WheelToken = typeof m41PhysicalChronology !== "undefined"
    ? m41PhysicalChronology?.wheelStart(event) : null;
  event.preventDefault();
  if (event.deltaY < 0) {
    canvas.focus();
    rollRequested = true;
    audio.play("roll");
    queueStaminaDenial("roll");
  } else if (event.deltaY > 0) {
    shortBlockUntil = Math.max(shortBlockUntil, performance.now() + COMBAT.block.shortBlockMs);
    // Submit the true Block edge before focus/layout or audio can stall it.
    // Focus still happens in the same physical callback for keyboard controls.
    sendImmediatePhysicalBlockEdge(event.isTrusted === true);
    canvas.focus();
    audio.play("guard");
  } else {
    canvas.focus();
  }
  if (typeof m41PhysicalChronology !== "undefined") m41PhysicalChronology?.wheelEnd(m41WheelToken);
}, { passive: false });
canvas.addEventListener("pointermove", updateMouse);
canvas.addEventListener("keydown", (event) => {
  // E is reserved for future Use interaction. Combat never consumes it.
  if (event.code === "KeyE") return;
  const firstAudioGesture = !audio.isUnlocked();
  if (["KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(event.code)) event.preventDefault();
  if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code) && !keys.has(event.code)) {
    const direction = dashGesture.press(event.code, performance.now(), event.repeat);
    if (direction && local.action === COMBAT_ACTION.idle
      && local.stamina >= COMBAT.dash.staminaCost) {
      dashRequested = true; dashMove = direction;
      audio.play("roll");
    }
  }
  keys.add(event.code);
  if (event.code === "Space" && !event.repeat) {
    jumpRequested = true;
    audio.play("jump");
    queueStaminaDenial("jump");
    if (leftButtonDown) leftButtonCharge.commitLight();
  }
  // Keyboard input also wins over the one-time audio unlock.
  audio.unlock();
  if (firstAudioGesture && !event.repeat && event.code === "Space") audio.play("jump");
});
// Key release can occur after focus moves to an in-page control.
// Canvas keydown remains focus scoped; window observes real bubbling keyup.
window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", releaseInputs);
// Chat composer focus must release held game inputs, not trap a charge.
canvas.addEventListener("blur", releaseInputs);
document.addEventListener("visibilitychange", handleVisibilityChange);
// A voluntary tab/navigation exit should promptly retire its server-owned
// gameplay admission lease. Losing OS/browser process still uses QUIC timeout.
window.addEventListener("pagehide", () => networkClient?.close("pagehide"));
// The closed transport cannot be reused if the browser restores a BFCache page.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) window.location.reload();
});



setStatus("Connecting to authoritative server…");
networkClient = await connectAuthoritativeClient({
  webTransportUrl: server,
  webTransportOptions,
  onExperimentalGestureAck(bytes, lease) {
    if (!experimentalGestureLab || experimentalGestureLab.lease !== lease) {
      networkClient?.close("late gesture ACK has no current owner");
      throw new Error("typed ACK without same-connection gesture owner");
    }
    const result = experimentalGestureLab.outbox.receiveAck(bytes, lease);
    experimentalGestureLab.noteAck(result);
    if (!result.transportSettled) {
      experimentalGestureLab.fail("World rejected or retired typed gesture edge");
    }
  },
  onProtocolError(error) {
    console.warn("authoritative protocol error", error);
    networkStatus = "Protocol error - invalid realtime packet ignored.";
  },
  onSnapshot(_result, state) {
    const ownId = networkClient?.playerNetId;
    if (!ownId) return;
    const own = state.get(ownId);
    if (own) {
      // Reconciliation's onAck can legally wait for a later snapshot. The
      // original processed-input ACK plus this matching World snapshot is
      // sufficient to prove the session-assigned actor without faking ACKs.
      if (resolvePrivateHitActor && privateHitProcessedAckActor === ownId) {
        const resolve = resolvePrivateHitActor;
        resolvePrivateHitActor = null;
        resolve(ownId);
      }
      // Initial player state is available before the first aligned input ACK.
      if (networkStatus.startsWith("Connecting")) {
        networkStatus = `Online - player #${ownId} - server tick ${networkClient.latestServerTick}`;
      }
      if (Number.isFinite(own.stamina)) authoritativeStamina = own.stamina;
      if (!local.initialized) restoreAuthoritative(own);
      else if (Number.isFinite(own.stamina)) local.stamina = own.stamina;
    }
    observeCombatState(state);
  },
  onReliableSnapshot(_result, state) {
    observeCombatState(state);
  },
  onKillEvent(event) {
    recordKillEvent(event);
  },
  onProcessedAck(ack) {
    // Native 0x03 comes from the original pinned server, not client input.
    // It is observed before the transport stores its own playerNetId; the
    // next real World snapshot must confirm the same actor before HIT grant.
    if (privateHitLabRequested && Number.isInteger(ack.playerNetId)
        && ack.playerNetId > 0) privateHitProcessedAckActor = ack.playerNetId;
  },
  onAck(ack) {
    const ownId = networkClient?.playerNetId;
    const own = ownId ? networkClient.state.get(ownId) : null;
    if (!own) return;
    // Only an original processed-input ACK for this connection and a genuine
    // replicated own actor can establish the private recipient actor binding.
    if (resolvePrivateHitActor && privateHitProcessedAckActor === ownId) {
      const resolve = resolvePrivateHitActor;
      resolvePrivateHitActor = null;
      resolve(ownId);
    }
    const preReconcileX = local.x;
    const preReconcileY = local.y;
    reconcilePrediction({
      history: networkClient.predictionHistory,
      processedClientTick: networkClient.processedClientTick,
      authoritativeState: own,
      restoreAuthoritative,
      replayInput(entry) { predictMovement(entry, 1000 / NETWORK.inputSendHz); },
    });
    if (Number.isFinite(preReconcileX) && Number.isFinite(preReconcileY)) {
      const before = { x: preReconcileX, y: preReconcileY };
      const correction = visualCamera.absorb(before, local, performance.now());
      networkClient.diagnostics.noteReconciliation(ack, own, correction.distance);
    }
    confirmStaminaDenial(own);
    networkStatus = `Online - player #${ownId} - server tick ${networkClient.latestServerTick}`;
  },
});

// Original first-party game-page v2 lab: this is the ONLY experimental
// source0 LMB-only Combat gesture path. Key E is reserved for Use. A denied grant
// closes the connection: there is NEVER a fallback phantom v1 attack.
if (reviewedGestureLab) {
  try {
    experimentalGestureLab = await activateLoopbackGestureLab({
      gameClient: networkClient, canvas, windowObj: window,
      documentObj: document, getClientTick: () => clientTick >>> 0,
      isJumpAttackChord: () => jumpRequested || keys.has("Space")
        || local.action === COMBAT_ACTION.jump,
      enableJumpAttackReview: jumpCombatReviewRequested,
    });
    if (privateHitLabRequested) {
      // Real input ACKs are produced by the 60Hz original sender, which starts
      // only after this module returns to requestAnimationFrame. Negotiate in
      // parallel with rendering rather than await a not-yet-admitted actor here.
      // No fabricated actor ID, online status, receipt or token is permitted.
      void (async () => {
        let timeoutId;
        try {
          const actorId = await Promise.race([
            privateHitActorReady,
            new Promise((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error(
                "private HIT requires a genuine current World actor and processed-input ACK"
              )), 3000);
            }),
          ]);
          if (!actorId || networkClient.transport.closed
              || networkClient.playerNetId !== actorId) {
            throw new Error("private HIT actor no longer owns the original QUIC transport");
          }
          privateHitDeliveryLab = await networkClient.transport.negotiatePrivateHitDeliveryLab({
            pageUrl: window.location.href, actorId,
            onReceipt(_receipt, presentation) {
              combatMessage = presentation.text;
              combatMessageUntil = performance.now() + presentation.durationMs;
              setStatus(combatMessage);
              showCombatFeedback(presentation.feedback);
            },
          });
          Object.defineProperty(window, "__MYASO_PRIVATE_HIT_PROOF__", {
            configurable: true, value: () => privateHitDeliveryLab.snapshot,
          });
        } catch (error) {
          // Only in the explicitly opted-in loopback laboratory: preserve the
          // actual browser rejection class for native CI without ever exposing
          // private capability bytes, lease tokens or synthetic online state.
          Object.defineProperty(window, "__MYASO_PRIVATE_HIT_FAILURE__", {
            configurable: true, value: Object.freeze({
              message: String(error?.message ?? error),
              boundActor: networkClient?.playerNetId ?? null,
              gestureGrant: networkClient?.transport?.experimentalGestureState ?? null,
            }),
          });
          console.error("private HIT original admission/negotiation failed", error);
          networkClient?.close("private HIT original admission/negotiation failed");
          networkStatus = "Private HIT laboratory admission rejected.";
          setStatus(networkStatus);
        } finally {
          clearTimeout(timeoutId);
        }
      })();
    }
  } catch (error) {
    networkClient?.close("original World gesture grant rejected");
    throw error;
  }
}

// Authenticated World speech bubbles are read-only render labels, mounted
// only when the real Chat C1 stream is admitted and bound by its adapter.
let chatBubbleController = null;

// Chat C1 uses the current authenticated WebTransport connection and separate
// bounded reliable streams. Public requests require the operator-served
// chatC1=1 config; localhost chatC1Preview=1 remains nonproduction-only.
// Never let a missing/failed chat stream block damage, input or rendering.
void import("../src/browser/chat-c1-activation.mjs")
  .then(({ isChatC1Eligible, activateChatC1Preview }) =>
    isChatC1Eligible(window.location)
      ? activateChatC1Preview({
          doc: document, location: window.location, gameClient: networkClient,
          onBubblesReady(controller) { chatBubbleController = controller; },
        })
      : null)
  .catch(() => { /* Chat is optional, authoritative Combat continues. */ });

function observeCombatState(state) {
  const ownId = networkClient?.playerNetId;
  if (!ownId) return;
  const ownActor = state.get(ownId);
  const freshWorldLightWindup = ownActor?.action === COMBAT_ACTION.attackWindup
    && (lastWorldStatusAction !== COMBAT_ACTION.attackWindup
      || lastWorldStatusActorId !== ownId);
  lastWorldStatusAction = ownActor?.action ?? null;
  lastWorldStatusActorId = ownId;
  recordAcceptanceState(state, ownId);
  // M41: a real authenticated original World snapshot can arrive between
  // render frames. Surface ONLY its own actor's committed windup immediately,
  // never a prediction/client-owned action; the same HUD is redrawn in RAF.
  // A newly committed ORIGINAL World LightWindup is later gameplay than a
  // previous 980ms parry feedback banner. Surface this ONE genuine actor-bound
  // transition even while that prior message is still visible; otherwise a
  // second real Light can have no fresh HUD cue and native Firefox cannot
  // react. Ordinary snapshots retain the existing message-priority contract.
  const originalWindupHint = authoritativeWindupHudHint(ownActor, {
    now: performance.now(),
    combatMessage: freshWorldLightWindup ? null : combatMessage,
    combatMessageUntil,
  });
  if (originalWindupHint) setStatus(originalWindupHint, {
    force: freshWorldLightWindup,
  });
  observeThreatCommitment(state, ownId);
  const match = fighterMatchPresentation(state.values(), ownId);
  if (match.visible && !matchOver) {
    matchOver = true;
    releaseInputs();
  } else if (!match.visible && matchOver) {
    const rows = fighterScoreboardPresentation(state.values(), ownId);
    if (rows.length > 0 && rows.every((row) => row.kills === 0)) {
      matchOver = false;
      clearKillFeed();
    }
  }
  const now = performance.now();
  remoteDamage.observe(state, ownId, now);
  remoteActionAudio.observe(state, ownId, (cue, options) => audio.play(cue, options));
  const event = combatReadability.observe(state, ownId);
  if (!event) return;
  // This private recipient scope credits damage only from its authenticated,
  // contiguous World receipt. Snapshot HP alone cannot name the attacker.
  if (privateHitLabRequested && ["hit-confirm", "damage-taken"].includes(event.feedback)) return;
  combatMessage = event.text;
  combatMessageUntil = now + event.durationMs;
  setStatus(combatMessage);
  showCombatFeedback(event.feedback);
}

function observeThreatCommitment(state, ownId) {
  const primaryNetId = fighterThreatNetId(state, ownId, threatCommitmentScan);
  const candidateIds = [primaryNetId, threatCommitmentScan.secondaryNetId];
  for (const netId of candidateIds) {
    if (!netId) continue;
    const attacker = state.get(netId);
    if (attacker?.action !== COMBAT_ACTION.jumpAttackWindup) continue;
    threatCue.jumpCommittedNetId = netId;
    threatCue.jumpCommittedPrimary = netId === primaryNetId;
    break;
  }
}

function recordAcceptanceState(state, ownId) {
  if (!["uirollbuffer", "uijumpbuffer", "uijumpattack", "uijumpattackinputloss", "uijumpattackpunish", "uijumpattacktelegraph", "uijumprecoveryffa", "uijumppunishffa", "uimultirecoveryffa", "uimultirecoveryspatial", "uimultirecoverypunish", "uiparrytell", "uistun", "uiparrypunishwindow", "uiparrypunishffa", "uiparrypunishffahit", "uiguardbreakpunishffa", "uiguardbreakpunishffahit", "uikickknockdownffa", "uikickknockdownffahit", "uikickknockdownbounded", "uirollknockdownbounded", "uirollknockdownffahit", "uimultiknockdownffa", "uimultiknockdownffahit", "uirollknockdownffa", "uidirectionallight", "uistaminaauth", "uistaminaexhaustion", "uistaminafeedback", "uistaminaconfirmed", "uifeint", "uiheavyblock", "uiheavyparry", "uijumpffaprimary", "uijumpffasecondary", "uijumpattackblock", "uijumpattackparry", "uijumpattackdodge", "uijumpattackbuffer", "uikickbuffer"].includes(acceptanceScenario)) return;
  const focusNetId = fighterGuardBreakPunishNetId(state, ownId)
    || fighterParryPunishNetId(state, ownId)
    || fighterKnockdownPunishNetId(state, ownId)
    || fighterRecoveryNetId(state, ownId)
    || fighterFocusNetId(state, ownId);
  const acceptance = window.__MYASO_ACCEPTANCE_STATE__ ??= {
    scenario: acceptanceScenario,
    ownActionTransitions: [],
    focusActionTransitions: [],
    staminaTransitions: [],
  };
  acceptance.playerNetId = ownId;
  acceptance.focusNetId = focusNetId;
  acceptance.serverTick = networkClient?.latestServerTick ?? 0;
  if (acceptanceScenario === "uimultiknockdownffa") {
    acceptance.knockdownSnapshots ??= [];
    acceptance.knockdownSnapshots.push({
      serverTick: acceptance.serverTick, epochMs: Date.now(), focusNetId,
      actors: [...state.values()].map(({netId, action}) => ({netId, action})),
    });
    if (acceptance.knockdownSnapshots.length > 120) acceptance.knockdownSnapshots.shift();
  }
  if (acceptanceScenario === "uimultirecoveryspatial") {
    acceptance.m233RecoveryHandoff ??= [];
    recordM233RecoveryHandoff(acceptance.m233RecoveryHandoff, {
      source: "ingress",
      state,
      ownId,
      focusNetId,
      focusMode: "replicated",
      serverTick: acceptance.serverTick,
      epochMs: Date.now(),
      isRecovery: (entity) => opponentRecoveryPresentation(entity).visible,
    });
  }
  const own = state.get(ownId);
  if (Number.isFinite(own?.stamina)) {
    acceptance.authoritativeStamina = own.stamina;
    recordAcceptanceStamina(
      acceptance.staminaTransitions,
      own.stamina,
      Date.now(),
      acceptance.serverTick,
    );
  }
  if (acceptanceScenario === "uidirectionallight"
    || acceptanceScenario === "uijumppunishffa"
    || acceptanceScenario === "uijumprecoveryffa"
    || acceptanceScenario === "uiparrypunishffahit"
    || acceptanceScenario === "uirollknockdownbounded"
    || acceptanceScenario === "uimultiknockdownffa"
    || acceptanceScenario === "uimultiknockdownffahit"
    || acceptanceScenario === "uijumpffaprimary"
    || acceptanceScenario === "uijumpffasecondary") {
    acceptance.fighters = [...state.values()].map((fighter) => ({
      netId: fighter.netId,
      x: fighter.x,
      y: fighter.y,
      action: fighter.action,
    }));
  }
  const epochMs = Date.now();
  recordAcceptanceAction(
    acceptance.ownActionTransitions,
    state.get(ownId)?.action,
    epochMs,
    acceptance.serverTick,
  );
  recordAcceptanceAction(
    acceptance.focusActionTransitions,
    focusNetId ? state.get(focusNetId)?.action : null,
    epochMs,
    acceptance.serverTick,
  );
}

function recordAcceptanceAction(transitions, action, epochMs, serverTick) {
  if (!Number.isInteger(action) || transitions.at(-1)?.action === action) return;
  transitions.push({ action, epochMs, serverTick });
}

function recordAcceptanceStamina(transitions, stamina, epochMs, serverTick) {
  if (!Number.isFinite(stamina)) return;
  const rounded = Math.max(0, Math.min(100, Math.round(stamina)));
  if (transitions.at(-1)?.stamina === rounded) return;
  transitions.push({ stamina: rounded, epochMs, serverTick });
}

function recordKillEvent(event) {
  if (!killFeedList || killFeedSequences.has(event?.sequence)) return;
  const ownId = networkClient?.playerNetId ?? 0;
  const presentation = killFeedPresentation(event, ownId);
  if (!presentation.visible) return;
  killFeedSequences.add(event.sequence);
  killFeedEntries.unshift({ sequence: event.sequence, ...presentation });
  if (presentation.victimOwn) audio.play("death");
  while (killFeedEntries.length > 4) {
    const removed = killFeedEntries.pop();
    killFeedSequences.delete(removed.sequence);
  }
  renderKillFeed();
}

function renderKillFeed() {
  if (!killFeedList) return;
  killFeedList.replaceChildren(...killFeedEntries.map((entry) => {
    const item = document.createElement("li");
    item.dataset.sequence = String(entry.sequence);
    item.dataset.killerOwn = String(entry.killerOwn);
    item.dataset.victimOwn = String(entry.victimOwn);
    item.textContent = entry.text;
    return item;
  }));
}

function clearKillFeed() {
  killFeedEntries.length = 0;
  killFeedSequences.clear();
  renderKillFeed();
}

function showCombatFeedback(feedback) {
  if (!feedback || !arenaStage) return;
  const cue = soundForCombatFeedback(feedback);
  if (cue) audio.play(cue);
  combatImpact.trigger(feedback, performance.now());
  if (combatFeedbackTimer) clearTimeout(combatFeedbackTimer);
  delete arenaStage.dataset.combatFeedback;
  void arenaStage.offsetWidth;
  arenaStage.dataset.combatFeedback = feedback;
  const durationMs = feedback === "guard-broken" || feedback === "guard-break-confirm" ? 420
    : feedback === "parry-success" || feedback === "parried" ? 380
      : 320;
  combatFeedbackTimer = window.setTimeout(() => {
    if (arenaStage.dataset.combatFeedback === feedback) delete arenaStage.dataset.combatFeedback;
    combatFeedbackTimer = 0;
  }, durationMs);
}

function recordStaminaDenialStage(stage, details = {}) {
  if (acceptanceScenario !== "uistaminaconfirmed" && acceptanceScenario !== "uijumpattack") return;
  const acceptance = window.__MYASO_ACCEPTANCE_STATE__;
  if (!acceptance) return;
  const transitions = acceptance.staminaDenialTransitions ??= [];
  transitions.push({ stage, epochMs: Date.now(), ...details });
}

function queueStaminaDenial(action) {
  const eligibleAction = action === "jump-attack"
    ? local.action === COMBAT_ACTION.jump
    : local.action === COMBAT_ACTION.idle;
  if (matchOver || !eligibleAction) return;
  const presentation = staminaDenialPresentation(action, authoritativeStamina);
  if (!presentation) return;
  pendingStaminaDenial = {
    action,
    presentation,
    baselineStamina: authoritativeStamina,
    submittedClientTick: null,
  };
  recordStaminaDenialStage("queued", {
    action,
    baselineStamina: authoritativeStamina,
  });
}

function markStaminaDenialSubmitted(tick, input) {
  if (!pendingStaminaDenial || pendingStaminaDenial.submittedClientTick !== null) return;
  const included = pendingStaminaDenial.action === "roll" ? input.dodge
    : pendingStaminaDenial.action === "kick" ? input.kick
      : pendingStaminaDenial.action === "jump" ? input.jump
        : pendingStaminaDenial.action === "jump-attack" ? input.attack
          : pendingStaminaDenial.action === "jump-attack-chord" ? input.jump && input.attack
            : pendingStaminaDenial.action === "running-attack"
            ? input.attack && input.run && Math.hypot(input.moveX, input.moveY) >= 0.5
            : false;
  if (included) {
    pendingStaminaDenial.submittedClientTick = tick >>> 0;
    recordStaminaDenialStage("submitted", {
      action: pendingStaminaDenial.action,
      clientTick: pendingStaminaDenial.submittedClientTick,
    });
  }
}

function staminaActionAccepted(action, authoritativeAction) {
  if (action === "roll") {
    return authoritativeAction === COMBAT_ACTION.dodge
      || authoritativeAction === COMBAT_ACTION.dodgeRecovery;
  }
  if (action === "kick") {
    return authoritativeAction === COMBAT_ACTION.kickWindup
      || authoritativeAction === COMBAT_ACTION.kickActive
      || authoritativeAction === COMBAT_ACTION.kickRecovery;
  }
  if (action === "jump") {
    return authoritativeAction === COMBAT_ACTION.jump
      || authoritativeAction === COMBAT_ACTION.jumpAttackWindup
      || authoritativeAction === COMBAT_ACTION.jumpAttackActive
      || authoritativeAction === COMBAT_ACTION.jumpAttackRecovery;
  }
  if (action === "jump-attack" || action === "jump-attack-chord") {
    return authoritativeAction === COMBAT_ACTION.jumpAttackWindup
      || authoritativeAction === COMBAT_ACTION.jumpAttackActive
      || authoritativeAction === COMBAT_ACTION.jumpAttackRecovery;
  }
  if (action === "running-attack") {
    return authoritativeAction === COMBAT_ACTION.runningAttackWindup
      || authoritativeAction === COMBAT_ACTION.runningAttackActive
      || authoritativeAction === COMBAT_ACTION.runningAttackRecovery;
  }
  return false;
}

function confirmStaminaDenial(own) {
  const pending = pendingStaminaDenial;
  if (!pending || pending.submittedClientTick === null || !networkClient) return;
  const processed = networkClient.processedClientTick;
  if (!Number.isInteger(processed)) return;
  if (processed !== pending.submittedClientTick
    && !isTickNewer32(processed, pending.submittedClientTick)) return;

  pendingStaminaDenial = null;
  const currentStamina = Number.isFinite(own?.stamina) ? own.stamina : authoritativeStamina;
  const cost = pending.presentation.cost;
  const spentEnough = Number.isFinite(pending.baselineStamina)
    && Number.isFinite(currentStamina)
    && pending.baselineStamina - currentStamina >= cost - 1;
  const accepted = staminaActionAccepted(pending.action, own?.action)
    || (pending.action !== "running-attack" && spentEnough);
  if (accepted) {
    recordStaminaDenialStage("confirmed-accepted", {
      action: pending.action,
      clientTick: pending.submittedClientTick,
      processedClientTick: processed,
      authoritativeAction: own?.action ?? null,
      authoritativeStamina: currentStamina,
    });
    return;
  }

  const presentation = staminaDenialPresentation(pending.action, currentStamina);
  if (!presentation) {
    recordStaminaDenialStage("confirmed-not-stamina", {
      action: pending.action,
      clientTick: pending.submittedClientTick,
      processedClientTick: processed,
      authoritativeAction: own?.action ?? null,
      authoritativeStamina: currentStamina,
    });
    return;
  }
  recordStaminaDenialStage("confirmed-rejected", {
    action: pending.action,
    clientTick: pending.submittedClientTick,
    processedClientTick: processed,
    authoritativeAction: own?.action ?? null,
    authoritativeStamina: currentStamina,
  });
  combatMessage = presentation.text;
  combatMessageUntil = performance.now() + presentation.durationMs;
  setStatus(combatMessage);
  showCombatFeedback(presentation.feedback);
  recordStaminaDenialStage("shown", {
    action: pending.action,
    clientTick: pending.submittedClientTick,
    processedClientTick: processed,
    authoritativeStamina: currentStamina,
  });
}

function updateMouse(event) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
}

function releaseInputs() {
  keys.clear();
  if (typeof afterSource0Audio !== "undefined") afterSource0Audio?.reset();
  if (typeof m41PhysicalChronology !== "undefined") m41PhysicalChronology?.reset();
  dashGesture.clearTaps();
  dashRequested = false;
  dashMove = null;
  attackRequested = false;
  runningAttackRequested = false;
  committedLightMove = null;
  leftButtonDown = false;
  leftButtonPressMovement = null;
  leftButtonCharge.cancel();
  chordedLeftDown = false;
  heavyAttackRequested = false;
  rollRequested = false;
  kickRequested = false;
  jumpRequested = false;
  shortBlockUntil = 0;
  middleBlockHeld = false;
  rightButtonGesture.cancel();
  pendingStaminaDenial = null;
}

function sampleInput({ playStepAudio = true } = {}) {
  if (matchOver) {
    currentInput.moveX = 0;
    currentInput.moveY = 0;
    currentInput.attack = false;
    currentInput.heavyAttack = false;
    currentInput.dodge = false;
    currentInput.block = false;
    currentInput.kick = false;
    currentInput.run = false;
    currentInput.jump = false;
    currentInput.dash = false;
    return;
  }
  currentInput.moveX = dashRequested && dashMove ? dashMove.x : attackRequested && committedLightMove
    ? committedLightMove.moveX : (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  currentInput.moveY = dashRequested && dashMove ? dashMove.y : attackRequested && committedLightMove
    ? committedLightMove.moveY : (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
  currentInput.facing = Math.atan2(mouse.y - canvas.height / 2, mouse.x - canvas.width / 2);
  const leftChargeHeld = leftButtonCharge.isCharging();
  currentInput.attack = !reviewedGestureLab && (attackRequested || leftChargeHeld);
  currentInput.heavyAttack = !reviewedGestureLab && (heavyAttackRequested || leftChargeHeld);
  currentInput.dodge = rollRequested;
  currentInput.dash = dashRequested;
  currentInput.block = middleBlockHeld || performance.now() < shortBlockUntil;
  currentInput.kick = kickRequested;
  currentInput.run = rightButtonGesture.isRunning() || runningAttackRequested;
  currentInput.jump = jumpRequested;
  if (playStepAudio && local.action === COMBAT_ACTION.idle && (currentInput.moveX || currentInput.moveY)) {
    audio.play("step", { level: currentInput.run ? .90 : .55 });
  }
}

// A real wheel-back is a latency-sensitive 240ms Block / 125ms Parry edge.
// The normal source0 sender is driven by RAF prediction ticks; genuine Firefox
// wheel callbacks have waited ~73ms for that render loop under native load.
// Submit ONE fresh, original v1 sample immediately from the trusted DOM edge,
// with the SAME monotonic client tick and the SAME authoritative QUIC writer.
// No synthetic input, alternate combat engine, protocol or server clock.
function sendImmediatePhysicalBlockEdge(trusted) {
  if (!trusted || document.hidden || matchOver || !networkClient?.playerNetId) return;
  sampleInput({ playStepAudio: false });
  if (!currentInput.block) return;
  const outgoingTick = clientTick;
  markStaminaDenialSubmitted(outgoingTick, currentInput);
  networkClient.sendInput({ tick: outgoingTick, ...currentInput });
  if (typeof afterSource0Audio !== "undefined") afterSource0Audio?.afterOriginalSend(currentInput);
  clientTick = (clientTick + 1) >>> 0;
  // A physical edge can also coincide with an authentic one-shot attack/jump.
  // It must never be replayed again at the next RAF-driven source0 tick.
  attackRequested = false;
  runningAttackRequested = false;
  committedLightMove = null;
  heavyAttackRequested = false;
  rollRequested = false;
  kickRequested = false;
  jumpRequested = false;
  dashRequested = false;
  dashMove = null;
  if (typeof m41PhysicalChronology !== "undefined" && m41PhysicalChronology) {
    const submission = m41PhysicalChronology.immediateSendInvocation(outgoingTick, currentInput);
    const debug = window.__MYASO_ACCEPTANCE_STATE__;
    if (debug) {
      debug.inputSubmissions ??= [];
      debug.inputSubmissions.push({
        clientTick: outgoingTick, epochMs: Date.now(),
        block: true, source: "physical-wheel-original-v1",
        m41PhysicalInput: submission,
      });
      if (debug.inputSubmissions.length > 32) debug.inputSubmissions.shift();
    }
  }
}

function simulatePrediction(stepMs) {
  sampleInput();
  if (typeof m41PhysicalChronology !== "undefined") m41PhysicalChronology?.sampled(currentInput, predictionStep + 1);
  if (typeof m147InputProbe !== "undefined") m147InputProbe?.sampled(currentInput, predictionStep + 1);
  if (!matchOver && local.initialized) predictMovement(currentInput, stepMs);
  predictionStep += 1;
  if (predictionStep % 2 === 0 && networkClient) {
    const outgoingTick = clientTick;
    markStaminaDenialSubmitted(outgoingTick, currentInput);
    // M121: read-only source-of-truth on the nominal 60Hz v1 sender. W3C
    // keydown in a browser does not prove a movement bit left the client or
    // reached the Rust World. Preserve attack/release and quiet samples too.
    // QA only, original packet/World/render path remains byte-for-byte intact.
    if ((acceptanceScenario === "uidirectionallight"
      || acceptanceScenario === "uijumppunishffa") && !reviewedGestureLab) {
      const debug = window.__MYASO_ACCEPTANCE_STATE__;
      if (debug) {
        debug.m121SentSamples ??= [];
        debug.m121SentSamples.push({
          clientTick: outgoingTick, epochMs: Date.now(),
          moveX: currentInput.moveX, moveY: currentInput.moveY,
          attack: Boolean(currentInput.attack),
          heavyAttack: Boolean(currentInput.heavyAttack),
          keyD: keys.has("KeyD"), keyA: keys.has("KeyA"),
          keyW: keys.has("KeyW"), keyS: keys.has("KeyS"),
          focus: document.activeElement?.id ?? null,
          predictedAction: local.action,
        });
        if (debug.m121SentSamples.length > 96) debug.m121SentSamples.shift();
      }
    }
    // M336/M144: read-only, scenario-scoped input-plane provenance. A real DOM
    // Space+LMB without authoritative action may mean no 60Hz input sampled
    // during the genuine W3C hold. Record what the production sender actually
    // submitted, with no replay, network payload or gameplay change.
    // Combat4A M41/M35: observed real wheel -> actual original v1 BLOCK
    // sample provenance, scoped to native acceptance only. Never forge input.
    const m41InputProbe = acceptanceScenario === "uiparrytell"
      || acceptanceScenario === "uistun";
    if (acceptanceScenario === "uimultirecoveryspatial"
      || acceptanceScenario === "uijumprecoveryffa"
      || acceptanceScenario === "uijumppunishffa"
      || acceptanceScenario === "uimultirecoveryffa"
      || m41InputProbe) {
      const debug = window.__MYASO_ACCEPTANCE_STATE__;
      if (debug) {
        debug.lastSubmittedClientTick = outgoingTick;
        debug.lastSubmittedAtEpochMs = Date.now();
        if (currentInput.attack || currentInput.jump || currentInput.heavyAttack
          || (m41InputProbe && currentInput.block)) {
          debug.inputSubmissions ??= [];
          debug.inputSubmissions.push({
            clientTick: outgoingTick, epochMs: debug.lastSubmittedAtEpochMs,
            attack: Boolean(currentInput.attack),
            jump: Boolean(currentInput.jump),
            heavyAttack: Boolean(currentInput.heavyAttack),
            block: Boolean(currentInput.block),
            // Trust and callback timestamps originate in the game listener;
            // actual World Block/PARRY still requires independent Rust proof.
            m41PhysicalInput: m41InputProbe && currentInput.block
              && typeof m41PhysicalChronology !== "undefined"
              ? m41PhysicalChronology?.sendInvocation(outgoingTick, currentInput) : null,
          });
          if (debug.inputSubmissions.length > 32) debug.inputSubmissions.shift();
        }
      }
    }
    if (m111InputProbe) {
      // Exactly the final original 60Hz frame that will be passed to the
      // unchanged v1 sender below; no synthetic latching or packet mutation.
      m111InputProbe.submitted.push({
        epochMs: Date.now(), clientTick: outgoingTick,
        attack: Boolean(currentInput.attack),
        heavyAttack: Boolean(currentInput.heavyAttack),
        jump: Boolean(currentInput.jump),
        localPredictedAction: local.action,
      });
      if (m111InputProbe.submitted.length > 96) {
        m111InputProbe.submitted.shift();
      }
    }
    if (typeof m147InputProbe !== "undefined") m147InputProbe?.sendInput(currentInput, outgoingTick);
    networkClient.sendInput({ tick: outgoingTick, ...currentInput });
    // No synchronous audio startup is permitted before this genuine v1 send.
    if (typeof afterSource0Audio !== "undefined") afterSource0Audio?.afterOriginalSend(currentInput);
    clientTick = (clientTick + 1) >>> 0;
    attackRequested = false;
    runningAttackRequested = false;
    committedLightMove = null;
    heavyAttackRequested = false;
    rollRequested = false;
    kickRequested = false;
    jumpRequested = false;
    dashRequested = false;
    dashMove = null;
  }
}

function predictMovement(input, dtMs) {
  let moveX = Number.isFinite(input.moveX) ? input.moveX : 0;
  let moveY = Number.isFinite(input.moveY) ? input.moveY : 0;
  const length = Math.hypot(moveX, moveY);
  if (length > 1) {
    moveX /= length;
    moveY /= length;
  }
  if (local.action !== COMBAT_ACTION.knockdown) {
    local.facing = Number.isFinite(input.facing) ? input.facing : local.facing;
  }
  let speed = COMBAT.moveSpeed;
  const now = performance.now();
  const moving = Math.hypot(moveX, moveY) > 1e-6;
  if (input.run && local.action === COMBAT_ACTION.idle && moving && local.stamina > 0) {
    speed *= COMBAT.stamina.runMoveMultiplier;
    local.stamina = Math.max(0, local.stamina - COMBAT.stamina.runDrainPerSecond * dtMs / 1000);
    staminaRegenBlockedUntil = now + COMBAT.stamina.regenDelayMs;
  } else if (now >= staminaRegenBlockedUntil) {
    local.stamina = Math.min(COMBAT.stamina.max, local.stamina + COMBAT.stamina.regenPerSecond * dtMs / 1000);
  }
  if (input.dash) predictedDashDir = { x: input.moveX, y: input.moveY };
  if (local.action === COMBAT_ACTION.dash) {
    moveX = predictedDashDir.x;
    moveY = predictedDashDir.y;
    speed = COMBAT.dash.speed;
  } else if (input.dodge || local.action === COMBAT_ACTION.dodge) {
    moveX = Math.cos(local.facing);
    moveY = Math.sin(local.facing);
    speed = COMBAT.dodge.speed;
  } else if (local.action === 6 || input.block) speed *= COMBAT.block.moveMultiplier;
  else if (local.action === COMBAT_ACTION.attackWindup
    || local.action === COMBAT_ACTION.attackLeftWindup
    || local.action === COMBAT_ACTION.attackRightWindup) speed *= 0.35;
  else if (local.action === COMBAT_ACTION.runningAttackWindup) speed *= COMBAT.runningAttack.windupMoveMultiplier;
  else if (local.action === COMBAT_ACTION.runningAttackActive) speed *= COMBAT.runningAttack.activeMoveMultiplier;
  else if (local.action === COMBAT_ACTION.heavyAttackWindup) speed *= 0.20;
  else if (local.action === COMBAT_ACTION.attackActive
    || local.action === COMBAT_ACTION.attackLeftActive
    || local.action === COMBAT_ACTION.attackRightActive
    || local.action === COMBAT_ACTION.heavyAttackActive
    || local.action === COMBAT_ACTION.stunned
    || local.action === COMBAT_ACTION.knockdown
    || local.action === COMBAT_ACTION.dead) speed = 0;
  else if (local.action === COMBAT_ACTION.attackRecovery
    || local.action === COMBAT_ACTION.attackLeftRecovery
    || local.action === COMBAT_ACTION.attackRightRecovery
    || local.action === COMBAT_ACTION.dodgeRecovery) speed *= 0.48;
  else if (local.action === COMBAT_ACTION.heavyAttackRecovery) speed *= 0.35;
  else if (local.action === COMBAT_ACTION.runningAttackRecovery) speed *= COMBAT.runningAttack.recoveryMoveMultiplier;
  else if (local.action === COMBAT_ACTION.jump) speed *= COMBAT.jump.moveMultiplier;
  else if (local.action === COMBAT_ACTION.jumpAttackWindup) speed *= 0.9;
  else if (local.action === COMBAT_ACTION.jumpAttackActive) speed *= 0.55;
  else if (local.action === COMBAT_ACTION.kickWindup) speed *= 0.45;
  else if (local.action === COMBAT_ACTION.kickActive) speed *= 0.2;
  else if (local.action === COMBAT_ACTION.kickRecovery || local.action === COMBAT_ACTION.jumpAttackRecovery) speed *= 0.42;
  else if (local.action === COMBAT_ACTION.feintRecovery) speed *= COMBAT.feint.moveMultiplier;
  const seconds = dtMs / 1000;
  local.x = clamp(local.x + moveX * speed * seconds, COMBAT.fighterRadius, NETWORK.worldWidth - COMBAT.fighterRadius);
  local.y = clamp(local.y + moveY * speed * seconds, COMBAT.fighterRadius, NETWORK.worldHeight - COMBAT.fighterRadius);
}

function restoreAuthoritative(own) {
  local.x = own.x;
  local.y = own.y;
  local.facing = own.facing;
  local.hp = own.hp;
  local.guard = own.guard;
  if (Number.isFinite(own.stamina)) {
    authoritativeStamina = own.stamina;
    local.stamina = own.stamina;
  }
  local.action = own.action;
  local.initialized = true;
}

function render(nowMs = performance.now(), impact = combatImpact.sample(nowMs)) {
  ctx.save();
  ctx.translate(impact.shakeX, impact.shakeY);
  if (!networkClient) {
    drawArenaGround({x: 0, y: 0});
    ctx.restore();
    drawImpactBurst(impact);
    return;
  }
  const ownId = networkClient.playerNetId;
  if (ownId && !local.initialized) {
    const own = networkClient.state.get(ownId);
    if (own) restoreAuthoritative(own);
  }
  // 20Hz packets alone cannot drive smooth 60Hz remote motion. Interpolate
  // with an advancing render-only clock; cap extrapolation on missing packets.
  const renderServerTick = snapshotRenderClock.sample(networkClient.latestServerTick, nowMs);
  // Opt-in read-only sampling never feeds back into the clock or gameplay.
  if (renderGapTelemetry) renderGapTelemetry.noteFrame(nowMs,
    snapshotRenderClock.metrics().targetGapTicks, NETWORK.serverSimulationHz);
  visualCamera.sample(local, nowMs, visualCameraPosition);
  drawArenaGround(visualCameraPosition);
  updateNetworkDiagnostics(nowMs);
  const recoveryFocusNetId = fighterRecoveryNetId(networkClient.state, ownId);
  visibleEnemyPositions.length = 0;
  // Apply the zoom to *rendering* only. Local prediction, sampled mouse aim,
  // network packets, combat arcs and authoritative hitboxes stay in world units.
  // Keep HUD and edge pointers outside this transform at readable pixel size.
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(ARENA_VIEW_ZOOM, ARENA_VIEW_ZOOM);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);

  // The real original Blender A2.32 Red Lion facade may replace only the
  // canonical World9 "red-lion" placeholder, AFTER all source hashes decode.
  // Prepare world+facade offscreen, or retain the regular authored placeholder.
  let redLionFrame = null;
  if (redLionPreview && local.initialized) {
    try {
      redLionFrame = redLionPreview.art.prepare(visualCameraPosition,
        canvas.width, canvas.height, ARENA_VIEW_ZOOM,
        params.get("dusk") === "1" ? "dusk" : "day");
      if (redLionFrame)
        redLionPreview.draw(ctx, redLionFrame.world,
          canvas.width, canvas.height, ARENA_VIEW_ZOOM);
    } catch {
      // No partial authoring contract can take over real Combat or Chat.
      redLionPreview = null;
      redLionFrame = null;
    }
  }
  if (!redLionFrame && greyhavenPreview && local.initialized) {
    try {
      greyhavenPreview.renderer.draw(ctx, greyhavenPreview.mapId,
        visualCameraPosition, canvas.width, canvas.height, ARENA_VIEW_ZOOM);
    } catch {
      greyhavenPreview = null;
    }
  }
  const redLionActorsInFront = redLionFrame ? [] : null;

  for (const entity of networkClient.state.values()) {
    if (entity.netId === ownId) continue;
    let scratch = remoteScratch.get(entity.netId);
    if (!scratch) {
      scratch = { netId: entity.netId };
      remoteScratch.set(entity.netId, scratch);
    }
    const sampled = networkClient.remoteInterpolator.sample(entity.netId, renderServerTick, scratch) ?? entity;
    // Do not reveal a genuine remote name/HP or offscreen marker THROUGH the
    // verified opaque Red Lion facade. The default arena list stays identical.
    const inFront = !redLionFrame || !redLionPreview.art.behindFacade(sampled);
    if (inFront) visibleEnemyPositions.push(sampled);
    const damageTell = remoteDamage.visible(entity.netId, nowMs);
    const recoveryTell = entity.netId === recoveryFocusNetId;
    if (redLionFrame && inFront) {
      redLionActorsInFront.push({sampled, damageTell, recoveryTell});
    } else {
      drawFighterWorld(sampled, "#b96350", "#47251f", damageTell, recoveryTell);
    }
  }
  // Presentation only: keep exact real actor identity and Silver source art.
  const ownBehindRedLion = !!(redLionFrame && redLionPreview.art.behindFacade(local));
  if (ownId && local.initialized) {
    local.netId = ownId;
    if (!redLionFrame || ownBehindRedLion)
      drawFighterScreen(canvas.width / 2, canvas.height / 2, local, "#e2d5b4", "#51452d");
  }
  if (redLionFrame) {
    // Validated World9 y=4075 depth, not a gameplay collision/portal rule.
    redLionPreview.draw(ctx, redLionFrame.facade,
      canvas.width, canvas.height, ARENA_VIEW_ZOOM);
    for (const {sampled, damageTell, recoveryTell} of redLionActorsInFront)
      drawFighterWorld(sampled, "#b96350", "#47251f", damageTell, recoveryTell);
    if (ownId && local.initialized && !ownBehindRedLion)
      drawFighterScreen(canvas.width / 2, canvas.height / 2, local, "#e2d5b4", "#51452d");
  }
  ctx.restore();
  // R1 wider view: health/guard bars and player identity badges are UI,
  // not world geometry. Keep their original unscaled 42px/34px readability
  // while placing them above their zoom-projected remote fighter positions.
  // This also preserves strict M46 66/100 vitals and M47 identity pixels.
  if (local.initialized) {
    for (const enemy of visibleEnemyPositions) {
      const projected = projectArenaPoint(enemy.x, enemy.y,
        visualCameraPosition.x, visualCameraPosition.y, canvas.width, canvas.height);
      if (projected.x < -64 || projected.x > canvas.width + 64
        || projected.y < -64 || projected.y > canvas.height + 64) continue;
      drawRemoteVitals(projected.x, projected.y, enemy);
      drawRemoteIdentity(projected.x, projected.y, enemy.netId);
    }
  }
  // Same reconciled World camera and interpolated Knight positions as the
  // real renderer; no client-generated player coordinates or Combat edits.
  chatBubbleController?.frame({
    ownId, own: local.initialized ? local : null,
    remotes: visibleEnemyPositions, camera: visualCameraPosition,
    width: canvas.width, height: canvas.height, zoom: ARENA_VIEW_ZOOM,
    deadAction: COMBAT_ACTION.dead, nowMs,
  });
  updateHud(ownId);
  drawThreatMarkers();
  if (local.initialized) drawOffscreenEnemyPointers(visibleEnemyPositions, ownId);
  ctx.restore();
  drawImpactBurst(impact);
}

function drawImpactBurst(impact) {
  if (!impact?.active || impact.rays <= 0) return;
  const feedback = impact.feedback;
  const remoteOwned = feedback === "hit-confirm"
    || feedback === "block-confirm"
    || feedback === "guard-break-confirm"
    || feedback === "kick-confirm"
    || feedback === "roll-impact"
    || feedback === "dodge-evaded";
  let x = canvas.width / 2;
  let y = canvas.height / 2;
  if (remoteOwned && networkClient?.playerNetId) {
    const focusNetId = fighterFocusNetId(networkClient.state, networkClient.playerNetId);
    const focus = focusNetId ? networkClient.state.get(focusNetId) : null;
    if (focus && local.initialized) {
      const projected = projectArenaPoint(focus.x, focus.y,
        visualCameraPosition.x, visualCameraPosition.y, canvas.width, canvas.height);
      x = projected.x;
      y = projected.y;
    }
  }

  const radius = 18 + impact.progress * 42;
  const alpha = Math.max(0, (1 - impact.progress) * 0.9);
  const parry = feedback === "parry-success" || feedback === "parried";
  const guard = feedback === "guard-pressure" || feedback === "block-confirm"
    || feedback === "guard-broken" || feedback === "guard-break-confirm";
  const roll = feedback === "roll-impact" || feedback === "rolled-over"
    || feedback === "dodge-success" || feedback === "dodge-evaded";
  const tone = parry ? "174, 209, 147" : guard ? "224, 187, 91" : roll ? "150, 194, 190" : "255, 170, 104";

  ctx.save();
  ctx.strokeStyle = `rgba(${tone}, ${alpha})`;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < impact.rays; i += 1) {
    const angle = (i / impact.rays) * Math.PI * 2 + impact.progress * 0.45;
    const inner = radius * 0.42;
    const outer = radius;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
    ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(${tone}, ${impact.flashAlpha})`;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(4, radius * 0.34), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawOffscreenEnemyPointers(positions, ownId) {
  const pointers = nearbyOffscreenPointers(positions, ownId, visualCameraPosition,
    canvas.width, canvas.height, { deadAction: COMBAT_ACTION.dead });
  if (!pointers.length) return;
  ctx.save();
  ctx.fillStyle = "#dcae83";
  ctx.strokeStyle = "#4d302a";
  ctx.lineWidth = 1;
  ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const pointer of pointers) {
    // Subtle 9px pointer, not a threatening attack indicator. Existing
    // parry/attack red markers have independent meaning and remain intact.
    ctx.save();
    ctx.translate(pointer.x, pointer.y);
    ctx.rotate(pointer.angle);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-3, -4.5);
    ctx.lineTo(-3, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#edd9b5";
    ctx.fillText(`#${pointer.netId}`, pointer.x - Math.cos(pointer.angle) * 15,
      pointer.y - Math.sin(pointer.angle) * 15);
    ctx.fillStyle = "#dcae83";
  }
  ctx.restore();
}

function drawThreatMarkers() {
  if (!threatCue.netId || !threatCue.bearing) return;
  drawThreatMarker(threatCue.bearing, false);
  if (threatCue.count > 1 && threatCue.secondaryNetId > 0 && threatCue.secondaryBearing) {
    drawThreatMarker(threatCue.secondaryBearing, true);
  }
}

function drawThreatMarker(bearing, secondary) {
  let dx = 0;
  let dy = 0;
  if (bearing === "FROM LEFT") dx = -1;
  else if (bearing === "FROM RIGHT") dx = 1;
  else if (bearing === "FROM ABOVE") dy = -1;
  else if (bearing === "FROM BELOW") dy = 1;
  else return;

  const radius = secondary ? 78 : 62;
  const x = canvas.width / 2 + dx * radius;
  const y = canvas.height / 2 + dy * radius;
  ctx.save();
  ctx.strokeStyle = secondary ? "#f7e1b0" : "#ff8f72";
  ctx.lineWidth = secondary ? 3 : 4;
  ctx.beginPath();
  if (dx < 0) {
    ctx.moveTo(x - 6, y - 7);
    ctx.lineTo(x + 3, y);
    ctx.lineTo(x - 6, y + 7);
  } else if (dx > 0) {
    ctx.moveTo(x + 6, y - 7);
    ctx.lineTo(x - 3, y);
    ctx.lineTo(x + 6, y + 7);
  } else if (dy < 0) {
    ctx.moveTo(x - 7, y - 6);
    ctx.lineTo(x, y + 3);
    ctx.lineTo(x + 7, y - 6);
  } else {
    ctx.moveTo(x - 7, y + 6);
    ctx.lineTo(x, y - 3);
    ctx.lineTo(x + 7, y + 6);
  }
  ctx.stroke();
  ctx.restore();
}

function drawFighterWorld(fighter, body, shadow, damageTell = false, recoveryTell = false) {
  if (!local.initialized) return;
  const screenX = canvas.width / 2 + fighter.x - visualCameraPosition.x;
  const screenY = canvas.height / 2 + fighter.y - visualCameraPosition.y;
  const projected = projectArenaPoint(fighter.x, fighter.y,
    visualCameraPosition.x, visualCameraPosition.y, canvas.width, canvas.height);
  if (projected.x < -64 || projected.x > canvas.width + 64
    || projected.y < -64 || projected.y > canvas.height + 64) return;
  drawFighterScreen(screenX, screenY, fighter, body, shadow, true, damageTell, recoveryTell);
}

function drawFighterScreen(x, y, fighter, body, shadow, remote = false, damageTell = false, recoveryTell = false) {
  ctx.save();
  const action = fighter.action ?? COMBAT_ACTION.idle;
  const airborne = action === COMBAT_ACTION.jump
    || action === COMBAT_ACTION.jumpAttackWindup
    || action === COMBAT_ACTION.jumpAttackActive
    || action === COMBAT_ACTION.jumpAttackRecovery;
  const knockedDown = action === COMBAT_ACTION.knockdown;
  const lift = airborne ? 18 : 0;
  ctx.translate(x, y - lift);
  const presentationRotation = (fighter.facing ?? 0)
    + (action === COMBAT_ACTION.dodge ? Math.PI * 0.35 : 0)
    + (knockedDown ? Math.PI / 2 : 0);
  ctx.rotate(presentationRotation);
  const localCharge = remote ? 0 : leftButtonCharge.progress();
  const heavyWindup = action === COMBAT_ACTION.heavyAttackWindup;
  const heavyActive = action === COMBAT_ACTION.heavyAttackActive;
  // Visually load up and pitch into the mouse-directed blow. World position,
  // hitbox, reach, collision and server authority are deliberately unchanged.
  if (localCharge > 0 || heavyWindup || heavyActive) {
    const lean = heavyActive ? 16 : heavyWindup ? 9 : localCharge * 8;
    ctx.translate(lean, 0);
    ctx.scale(1 + (heavyActive ? 0.22 : localCharge * 0.09), heavyActive ? 0.89 : 1);
  }
  if (knockedDown) ctx.scale(1.38, 0.62);
  if (localCharge > 0) drawLmbChargeTell(localCharge);
  ctx.globalAlpha = action === COMBAT_ACTION.dead ? 0.28 : 1;
  if (action === COMBAT_ACTION.attackWindup || action === COMBAT_ACTION.attackActive) drawAttackTell(action, remote);
  if (action === COMBAT_ACTION.attackLeftWindup || action === COMBAT_ACTION.attackLeftActive
    || action === COMBAT_ACTION.attackRightWindup || action === COMBAT_ACTION.attackRightActive) drawDirectionalAttackTell(action, remote);
  if (action === COMBAT_ACTION.runningAttackWindup || action === COMBAT_ACTION.runningAttackActive) drawRunningAttackTell(action, remote);
  if (action === COMBAT_ACTION.heavyAttackWindup || action === COMBAT_ACTION.heavyAttackActive) drawHeavyAttackTell(action, remote);
  if (action === COMBAT_ACTION.jumpAttackWindup || action === COMBAT_ACTION.jumpAttackActive) drawJumpAttackTell(action, remote);
  if (action === COMBAT_ACTION.kickWindup || action === COMBAT_ACTION.kickActive) drawKickTell(action);
  drawWeaponTrail(action);
  if (action === COMBAT_ACTION.block) drawBlockTell(remote, fighter);
  if (action === COMBAT_ACTION.dodge) drawDodgeTell(remote);
  if (action === COMBAT_ACTION.stunned) drawStunTell();
  if (action === COMBAT_ACTION.knockdown) drawKnockdownTell();
  if (remote && parrySpatialPresentation(fighter).visible) {
    drawParryTell();
    // Acceptance-only renderer diagnostics, NOT a substitute for strict pixels.
    if (acceptanceScenario === "uiparrytell") {
      const trace = window.__MYASO_M41_DRAW_TRACE__ ??= { draws: 0, latest: null };
      trace.draws += 1;
      trace.latest = { netId: fighter.netId, x, y, action, guard: fighter.guard,
        atMs: performance.now() };
    }
  }
  if (remote && guardBreakSpatialPresentation(fighter).visible) drawGuardBreakTell();
  if (remote && recoveryTell) drawRecoveryTell();
  // Only the already-authenticated player roster is passed here. Remote
  // is a viewpoint, never an NPC role. No costume or weapon ownership is
  // generated; source-missing actions retain the original honest Combat tell.
  const drewKnight = knightSprites?.draw(ctx, fighter, {
    remote, actorKind: "player", rotation: presentationRotation,
    visualLift: lift, nowMs: performance.now(),
  }) ?? false;
  if (!drewKnight && !knightSprites) {
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(-2, 8, 20, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, COMBAT.fighterRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#13110d";
    ctx.beginPath();
    ctx.arc(7, -5, 3, 0, Math.PI * 2);
    ctx.fill();
    // No physical sword exists in this release; omit the legacy prototype
    // sword-shaped rectangle while the Silver Knight feature is enabled.
    if (showPrototypeWeaponStroke(Boolean(knightSprites))) {
      ctx.fillStyle = "#c8b684";
      ctx.fillRect(12, -2, 26, 4);
    }
  }
  if (remote && action !== COMBAT_ACTION.dead && damageTell) {
    drawDamageTell();
  }
  if (remote && action === COMBAT_ACTION.dead) {
    ctx.globalAlpha = 1;
    drawDeathTell();
  }
  ctx.restore();
}

function drawRemoteVitals(x, y, fighter) {
  const presentation = fighterVitalsPresentation(fighter);
  if (!presentation.visible) return;
  const width = 42;
  const left = Math.round(x - width / 2);
  const hpTop = Math.round(y - 38);
  const guardTop = hpTop + 6;
  ctx.fillStyle = "#231b19";
  ctx.fillRect(left - 1, hpTop - 1, width + 2, 5);
  ctx.fillRect(left - 1, guardTop - 1, width + 2, 5);
  ctx.fillStyle = "#f25f5c";
  ctx.fillRect(left, hpTop, Math.round(width * presentation.hp / 100), 3);
  ctx.fillStyle = "#59c98b";
  ctx.fillRect(left, guardTop, Math.round(width * presentation.guard / 100), 3);
}

function drawRemoteIdentity(x, y, netId) {
  const presentation = fighterIdentityPresentation(netId);
  if (!presentation.visible) return;
  const width = 34;
  const height = 14;
  const left = Math.round(x - width / 2);
  const top = Math.round(y - 58);
  ctx.fillStyle = "#34445c";
  ctx.fillRect(left, top, width, height);
  ctx.fillStyle = "#f7f1de";
  ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(presentation.label, Math.round(x), top + height / 2 + 0.5);
}

function drawAttackTell(action, remote) {
  const radius = COMBAT.attack.reach + COMBAT.fighterRadius;
  const halfArc = COMBAT.attack.arcRadians / 2;
  const alpha = action === COMBAT_ACTION.attackActive ? 0.34 : 0.14;
  ctx.fillStyle = `rgba(214, 187, 112, ${alpha})`;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radius, -halfArc, halfArc);
  ctx.closePath();
  ctx.fill();
  if (remote && action === COMBAT_ACTION.attackWindup) {
    ctx.strokeStyle = "#f3d68f";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 5]);
    ctx.stroke();
  }
}

function drawWeaponTrail(action) {
  const light = action === COMBAT_ACTION.attackWindup || action === COMBAT_ACTION.attackActive;
  const leftSweep = action === COMBAT_ACTION.attackLeftWindup || action === COMBAT_ACTION.attackLeftActive;
  const rightSweep = action === COMBAT_ACTION.attackRightWindup || action === COMBAT_ACTION.attackRightActive;
  const running = action === COMBAT_ACTION.runningAttackWindup || action === COMBAT_ACTION.runningAttackActive;
  const heavy = action === COMBAT_ACTION.heavyAttackWindup || action === COMBAT_ACTION.heavyAttackActive;
  const jump = action === COMBAT_ACTION.jumpAttackWindup || action === COMBAT_ACTION.jumpAttackActive;
  if (!light && !leftSweep && !rightSweep && !running && !heavy && !jump) return;

  const active = action === COMBAT_ACTION.attackActive
    || action === COMBAT_ACTION.attackLeftActive
    || action === COMBAT_ACTION.attackRightActive
    || action === COMBAT_ACTION.runningAttackActive
    || action === COMBAT_ACTION.heavyAttackActive
    || action === COMBAT_ACTION.jumpAttackActive;
  const radius = heavy ? 44 : running ? 42 : jump ? 40 : 36;
  const sweepOffset = leftSweep
    ? -COMBAT.directionalAttack.arcOffsetRadians
    : rightSweep
      ? COMBAT.directionalAttack.arcOffsetRadians
      : 0;
  const start = (heavy ? -1.05 : running ? -0.54 : jump ? -0.34 : -0.72) + sweepOffset;
  const end = (heavy ? 0.72 : running ? 0.34 : jump ? 0.30 : 0.48) + sweepOffset;
  ctx.save();
  ctx.strokeStyle = heavy
    ? (active ? "rgba(255, 105, 58, .88)" : "rgba(255, 173, 92, .42)")
    : running
      ? (active ? "rgba(113, 214, 255, .92)" : "rgba(126, 193, 222, .42)")
    : jump
      ? (active ? "rgba(255, 150, 72, .9)" : "rgba(255, 195, 102, .42)")
      : (active ? "rgba(238, 219, 160, .82)" : "rgba(214, 195, 148, .34)");
  ctx.lineWidth = heavy ? 8 : running ? 6 : jump ? 6 : 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, radius, start, end);
  ctx.stroke();
  ctx.globalAlpha = 0.34;
  ctx.lineWidth *= 1.75;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 4, start + 0.10, end - 0.08);
  ctx.stroke();
  ctx.restore();
}

function drawDirectionalAttackTell(action, remote) {
  const left = action === COMBAT_ACTION.attackLeftWindup || action === COMBAT_ACTION.attackLeftActive;
  const active = action === COMBAT_ACTION.attackLeftActive || action === COMBAT_ACTION.attackRightActive;
  const offset = left ? -COMBAT.directionalAttack.arcOffsetRadians : COMBAT.directionalAttack.arcOffsetRadians;
  ctx.save();
  ctx.strokeStyle = active ? "#fae29a" : "#dec67a";
  ctx.fillStyle = active ? "rgba(224, 198, 122, 0.24)" : "rgba(224, 198, 122, 0.11)";
  ctx.lineWidth = remote ? 4 : 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(
    0,
    0,
    COMBAT.directionalAttack.reach + COMBAT.fighterRadius,
    offset - COMBAT.directionalAttack.arcRadians / 2,
    offset + COMBAT.directionalAttack.arcRadians / 2,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawRunningAttackTell(action, remote) {
  const active = action === COMBAT_ACTION.runningAttackActive;
  ctx.save();
  ctx.strokeStyle = active ? "#71d6ff" : "#7ec1de";
  ctx.fillStyle = active ? "rgba(92, 190, 228, 0.24)" : "rgba(92, 190, 228, 0.12)";
  ctx.lineWidth = remote ? 4 : 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(
    0,
    0,
    COMBAT.runningAttack.reach + COMBAT.fighterRadius,
    -COMBAT.runningAttack.arcRadians / 2,
    COMBAT.runningAttack.arcRadians / 2,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawLmbChargeTell(progress) {
  ctx.save();
  ctx.strokeStyle = progress >= 1 ? "#ffe49b" : "rgba(255, 172, 82, 0.88)";
  ctx.lineWidth = 3 + progress * 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, COMBAT.heavyAttack.reach + COMBAT.fighterRadius, -0.68, -0.68 + progress * 1.36);
  ctx.stroke();
  ctx.restore();
}

function drawHeavyAttackTell(action, remote) {
  const active = action === COMBAT_ACTION.heavyAttackActive;
  ctx.save();
  ctx.strokeStyle = active ? "#ff4d2e" : "#ffad5c";
  ctx.fillStyle = active ? "rgba(255, 77, 46, 0.20)" : "rgba(255, 173, 92, 0.13)";
  ctx.lineWidth = remote ? 4 : 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(
    0,
    0,
    COMBAT.heavyAttack.reach + COMBAT.fighterRadius,
    -COMBAT.heavyAttack.arcRadians / 2,
    COMBAT.heavyAttack.arcRadians / 2,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(0, 0, COMBAT.fighterRadius + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBlockTell(remote, fighter) {
  ctx.strokeStyle = "rgba(241, 218, 142, .72)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 32, -COMBAT.block.halfAngleRadians, COMBAT.block.halfAngleRadians);
  ctx.stroke();
  if (!remote || !blockSpatialPresentation(fighter).visible) return;
  ctx.strokeStyle = "#9ad7a7";
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, 42, -COMBAT.block.halfAngleRadians, COMBAT.block.halfAngleRadians);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawJumpAttackTell(action, remote) {
  const active = action === COMBAT_ACTION.jumpAttackActive;
  ctx.save();
  ctx.strokeStyle = active ? "#ff7040" : "#ffc06a";
  ctx.fillStyle = active ? "rgba(255, 112, 64, 0.24)" : "rgba(255, 192, 106, 0.12)";
  ctx.lineWidth = remote ? 4 : 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(
    0,
    0,
    COMBAT.jumpAttack.reach + COMBAT.fighterRadius,
    -COMBAT.jumpAttack.arcRadians / 2,
    COMBAT.jumpAttack.arcRadians / 2,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawKickTell(action) {
  ctx.strokeStyle = action === COMBAT_ACTION.kickActive ? "rgba(255, 214, 120, .95)" : "rgba(255, 214, 120, .48)";
  ctx.lineWidth = action === COMBAT_ACTION.kickActive ? 6 : 3;
  ctx.beginPath();
  ctx.arc(0, 0, COMBAT.kick.reach + COMBAT.fighterRadius, -COMBAT.kick.arcRadians / 2, COMBAT.kick.arcRadians / 2);
  ctx.stroke();
}

function drawDodgeTell(remote) {
  ctx.strokeStyle = "rgba(216, 202, 160, .58)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.stroke();
  if (!remote) return;
  ctx.strokeStyle = "#c7b5ff";
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawKnockdownTell() {
  ctx.strokeStyle = "rgba(224, 163, 89, .92)";
  ctx.lineWidth = 4;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 18, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawStunTell() {
  ctx.strokeStyle = "rgba(185, 99, 80, .9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.stroke();
}

function drawParryTell() {
  ctx.strokeStyle = "#7fcff4";
  ctx.lineWidth = 3;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawGuardBreakTell() {
  ctx.strokeStyle = "#f47f5f";
  ctx.lineWidth = 4;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawRecoveryTell() {
  ctx.strokeStyle = "#efcf73";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.stroke();
}

function drawDamageTell() {
  ctx.strokeStyle = "#ffad66";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.stroke();
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const inner = 34;
    const outer = 42;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }
}

function drawDeathTell() {
  ctx.strokeStyle = "#ff6f91";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 31, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-10, -10);
  ctx.lineTo(10, 10);
  ctx.moveTo(10, -10);
  ctx.lineTo(-10, 10);
  ctx.stroke();
}

function updateHud(ownId) {
  const own = ownId ? networkClient.state.get(ownId) : null;
  const nearestFocusNetId = fighterFocusNetId(networkClient.state, ownId);
  const guardBreakPunishNetId = fighterGuardBreakPunishNetId(networkClient.state, ownId);
  const parryPunishNetId = fighterParryPunishNetId(networkClient.state, ownId);
  const knockdownPunishNetId = fighterKnockdownPunishNetId(networkClient.state, ownId);
  const recoveryFocusNetId = fighterRecoveryNetId(networkClient.state, ownId);
  const focusNetId = guardBreakPunishNetId || parryPunishNetId || knockdownPunishNetId || recoveryFocusNetId || nearestFocusNetId;
  const remote = focusNetId ? networkClient.state.get(focusNetId) : null;
  setMeter("playerHp", hud.playerHp, hud.playerHpValue, own?.hp ?? local.hp);
  setMeter("playerGuard", hud.playerGuard, hud.playerGuardValue, own?.guard ?? local.guard);
  setMeter("playerStamina", hud.playerStamina, hud.playerStaminaValue, own?.stamina ?? local.stamina);
  setMeter("botHp", hud.botHp, hud.botHpValue, remote?.hp ?? 0);
  setMeter("botGuard", hud.botGuard, hud.botGuardValue, remote?.guard ?? 0);
  const focusMode = guardBreakPunishNetId ? "guard-break"
    : parryPunishNetId ? "parry"
      : knockdownPunishNetId ? "knockdown"
        : recoveryFocusNetId ? "recovery" : "nearest";
  setFocusTarget(focusNetId, focusMode);
  if (acceptanceScenario === "uimultirecoveryspatial"
    && window.__MYASO_ACCEPTANCE_STATE__?.scenario === acceptanceScenario) {
    const acceptance = window.__MYASO_ACCEPTANCE_STATE__;
    acceptance.m233RecoveryHandoff ??= [];
    recordM233RecoveryHandoff(acceptance.m233RecoveryHandoff, {
      source: "hud",
      state: networkClient.state,
      ownId,
      focusNetId,
      focusMode,
      serverTick: networkClient.latestServerTick,
      epochMs: Date.now(),
      isRecovery: (entity) => opponentRecoveryPresentation(entity).visible,
    });
  }
  updateOwnReadiness(own);
  updateThreatCue(ownId);
  updateCombatOverlay(own, ownId);
  updateOpponentRecovery(remote, focusMode, own);
  updateScoreboard(ownId);
  const now = performance.now();
  if (combatMessage && now <= combatMessageUntil) {
    setStatus(combatMessage);
  } else {
    combatMessage = null;
    setStatus(combatActionHint(own) ?? networkStatus);
  }
}

function updateOwnReadiness(own) {
  if (!ownReadiness.root) return;
  const presentation = ownCombatReadinessPresentation(own);
  if (ownReadiness.root.hidden === presentation.visible) {
    ownReadiness.root.hidden = !presentation.visible;
  }
  if (!presentation.visible) {
    ownReadiness.state = "";
    ownReadiness.text = "";
    ownReadiness.detailText = "";
    if (ownReadiness.root.dataset.state) delete ownReadiness.root.dataset.state;
    return;
  }
  if (ownReadiness.state !== presentation.state) {
    ownReadiness.state = presentation.state;
    ownReadiness.root.dataset.state = presentation.state;
  }
  if (ownReadiness.text !== presentation.label) {
    ownReadiness.text = presentation.label;
    ownReadiness.label.textContent = presentation.label;
  }
  if (ownReadiness.detailText !== presentation.detail) {
    ownReadiness.detailText = presentation.detail;
    ownReadiness.detail.textContent = presentation.detail;
  }
}

function updateThreatCue(ownId) {
  if (!threatCue.root || !networkClient) return;
  let netId = fighterThreatNetId(networkClient.state, ownId, threatScan);
  let threatCount = threatScan.count;
  let secondaryNetId = threatScan.secondaryNetId;
  const committedJump = threatCue.jumpCommittedNetId
    ? networkClient.state.get(threatCue.jumpCommittedNetId)
    : null;
  if (threatCue.jumpCommittedNetId
    && committedJump?.action !== COMBAT_ACTION.jumpAttackWindup
    && committedJump?.action !== COMBAT_ACTION.jumpAttackActive) {
    threatCue.jumpCommittedNetId = 0;
    threatCue.jumpCommittedPrimary = false;
  }

  // Snapshot observation owns the jump commitment latch so a loaded renderer
  // cannot skip the entire 105 ms windup. Once a spatially valid jump commits,
  // preserve its primary/secondary rank through the active hit frame even if
  // the hit knockback moves the defender outside the narrow 48 px cone before
  // the next animation frame. Off-axis jumps never acquire the latch.
  if (threatCue.jumpCommittedNetId
    && committedJump?.action === COMBAT_ACTION.jumpAttackActive
    && netId !== threatCue.jumpCommittedNetId
    && secondaryNetId !== threatCue.jumpCommittedNetId) {
    if (netId === 0) {
      netId = threatCue.jumpCommittedNetId;
      secondaryNetId = 0;
      threatCount = Math.max(1, threatCount);
    } else {
      threatCount = Math.max(2, threatCount);
      if (threatCue.jumpCommittedPrimary) {
        secondaryNetId = netId;
        netId = threatCue.jumpCommittedNetId;
      } else {
        secondaryNetId = threatCue.jumpCommittedNetId;
      }
    }
  }
  const attacker = netId ? networkClient.state.get(netId) : null;
  const secondaryAttacker = secondaryNetId ? networkClient.state.get(secondaryNetId) : null;
  const own = ownId ? networkClient.state.get(ownId) : null;
  const bearing = fighterThreatBearingLabel(own, attacker);
  const guardArc = fighterThreatGuardArcLabel(own, attacker);
  const secondaryBearing = fighterThreatBearingLabel(own, secondaryAttacker);
  const secondaryGuardArc = fighterThreatGuardArcLabel(own, secondaryAttacker);
  const phase = fighterThreatPhaseLabel(attacker);
  const secondaryPhase = fighterThreatPhaseLabel(secondaryAttacker);
  const state = fighterThreatPhaseState(phase);
  const shouldHide = netId === 0 || !state;
  if (threatCue.root.hidden !== shouldHide) threatCue.root.hidden = shouldHide;
  if (shouldHide) {
    threatCue.netId = 0;
    threatCue.state = "";
    threatCue.phaseText = "";
    threatCue.count = 0;
    threatCue.secondaryNetId = 0;
    threatCue.secondaryBearing = "";
    threatCue.secondaryPhase = "";
    threatCue.secondaryGuardArc = "";
    threatCue.bearing = "";
    threatCue.guardArc = "";
    if (threatCue.countLabel) threatCue.countLabel.hidden = true;
    if (threatCue.secondaryLabel) threatCue.secondaryLabel.hidden = true;
    if (threatCue.secondaryBearingLabel) threatCue.secondaryBearingLabel.hidden = true;
    if (threatCue.secondaryPhaseLabel) threatCue.secondaryPhaseLabel.hidden = true;
    if (threatCue.secondaryGuardArcLabel) threatCue.secondaryGuardArcLabel.hidden = true;
    if (threatCue.bearingLabel) threatCue.bearingLabel.hidden = true;
    if (threatCue.guardArcLabel) threatCue.guardArcLabel.hidden = true;
    delete threatCue.root.dataset.state;
    return;
  }
  threatCue.root.dataset.state = state;
  if (threatCue.netId !== netId) {
    threatCue.netId = netId;
    threatCue.label.textContent = `#${netId}`;
  }
  if (threatCue.state !== state) {
    threatCue.state = state;
  }
  // Primary identity/phase can change while both threats remain in the same
  // coarse state (for example JUMP WINDUP -> WINDUP). Keep the visible phase
  // keyed to the exact authoritative phase instead of only to state changes.
  if (threatCue.phaseText !== phase) {
    threatCue.phaseText = phase;
    threatCue.phase.textContent = phase;
  }
  if (threatCue.countLabel) {
    const showCount = threatCount > 1;
    if (threatCue.countLabel.hidden === showCount) threatCue.countLabel.hidden = !showCount;
    if (showCount && threatCue.count !== threatCount) threatCue.countLabel.textContent = `${threatCount} THREATS`;
  }
  if (threatCue.secondaryLabel) {
    const showSecondary = threatCount > 1 && secondaryNetId > 0;
    if (threatCue.secondaryLabel.hidden === showSecondary) threatCue.secondaryLabel.hidden = !showSecondary;
    if (showSecondary && threatCue.secondaryNetId !== secondaryNetId) {
      threatCue.secondaryLabel.textContent = `NEXT #${secondaryNetId}`;
    }
  }
  if (threatCue.secondaryPhaseLabel) {
    const showSecondaryPhase = threatCount > 1 && secondaryNetId > 0 && Boolean(secondaryPhase);
    if (threatCue.secondaryPhaseLabel.hidden === showSecondaryPhase) threatCue.secondaryPhaseLabel.hidden = !showSecondaryPhase;
    if (showSecondaryPhase && threatCue.secondaryPhase !== secondaryPhase) {
      threatCue.secondaryPhaseLabel.textContent = secondaryPhase;
    }
  }
  if (threatCue.secondaryBearingLabel) {
    const showSecondaryBearing = threatCount > 1 && secondaryNetId > 0 && Boolean(secondaryBearing);
    if (threatCue.secondaryBearingLabel.hidden === showSecondaryBearing) threatCue.secondaryBearingLabel.hidden = !showSecondaryBearing;
    if (showSecondaryBearing && threatCue.secondaryBearing !== secondaryBearing) {
      threatCue.secondaryBearingLabel.textContent = secondaryBearing;
    }
  }
  if (threatCue.secondaryGuardArcLabel) {
    const showSecondaryGuardArc = threatCount > 1 && secondaryNetId > 0 && Boolean(secondaryGuardArc);
    if (threatCue.secondaryGuardArcLabel.hidden === showSecondaryGuardArc) threatCue.secondaryGuardArcLabel.hidden = !showSecondaryGuardArc;
    if (showSecondaryGuardArc && threatCue.secondaryGuardArc !== secondaryGuardArc) {
      threatCue.secondaryGuardArcLabel.textContent = secondaryGuardArc;
    }
  }
  if (threatCue.guardArcLabel) {
    const showGuardArc = Boolean(guardArc);
    if (threatCue.guardArcLabel.hidden === showGuardArc) threatCue.guardArcLabel.hidden = !showGuardArc;
    if (showGuardArc && threatCue.guardArc !== guardArc) threatCue.guardArcLabel.textContent = guardArc;
  }
  if (threatCue.bearingLabel) {
    const showBearing = Boolean(bearing);
    if (threatCue.bearingLabel.hidden === showBearing) threatCue.bearingLabel.hidden = !showBearing;
    if (showBearing && threatCue.bearing !== bearing) threatCue.bearingLabel.textContent = bearing;
  }
  threatCue.count = threatCount;
  threatCue.secondaryNetId = secondaryNetId;
  threatCue.secondaryBearing = secondaryBearing;
  threatCue.secondaryPhase = secondaryPhase;
  threatCue.secondaryGuardArc = secondaryGuardArc;
  threatCue.bearing = bearing;
  threatCue.guardArc = guardArc;
}

function updateCombatOverlay(own, ownId) {
  const matchPresentation = networkClient ? fighterMatchPresentation(networkClient.state.values(), ownId) : null;
  const presentation = matchPresentation?.visible ? matchPresentation : combatOverlayPresentation(own);
  const shouldHide = !presentation.visible;
  if (combatOverlay.root.hidden !== shouldHide) combatOverlay.root.hidden = shouldHide;
  if (!presentation.visible) return;
  if (combatOverlay.title.textContent !== presentation.title) combatOverlay.title.textContent = presentation.title;
  if (combatOverlay.detail.textContent !== presentation.detail) combatOverlay.detail.textContent = presentation.detail;
}

function updateOpponentRecovery(remote, focusMode = "nearest", own = null) {
  const rangeLabel = focusMode === "parry"
    ? parryPunishRangeCue(own, remote)
    : focusMode === "guard-break"
      ? guardBreakPunishRangeCue(own, remote)
      : focusMode === "knockdown"
        ? knockdownPunishRangeCue(own, remote)
        : focusMode === "recovery"
          ? recoveryPunishRangeCue(own, remote) : "";
  if (opponentRecovery.rangeCue) {
    const shouldHideRange = !rangeLabel;
    if (opponentRecovery.rangeCue.hidden !== shouldHideRange) opponentRecovery.rangeCue.hidden = shouldHideRange;
    if (rangeLabel && opponentRecovery.rangeCue.textContent !== rangeLabel) opponentRecovery.rangeCue.textContent = rangeLabel;
    const intent = punishRangeCueIntent(rangeLabel);
    if (intent) {
      if (opponentRecovery.rangeCue.dataset.intent !== intent) opponentRecovery.rangeCue.dataset.intent = intent;
    } else if (opponentRecovery.rangeCue.dataset.intent) {
      delete opponentRecovery.rangeCue.dataset.intent;
    }
  }
  const presentation = focusMode === "guard-break"
    ? { visible: true, state: "guard-break-stun", label: "PUNISH", detail: "Guard break stun" }
    : focusMode === "parry"
      ? { visible: true, state: "parry-stun", label: "PUNISH", detail: "Parry stun" }
      : opponentRecoveryPresentation(remote);
  const shouldHide = !presentation.visible;
  if (opponentRecovery.root.hidden !== shouldHide) opponentRecovery.root.hidden = shouldHide;
  if (!presentation.visible) {
    delete opponentRecovery.root.dataset.state;
    return;
  }
  opponentRecovery.root.dataset.state = presentation.state;
  if (opponentRecovery.label.textContent !== presentation.label) opponentRecovery.label.textContent = presentation.label;
  if (opponentRecovery.detail.textContent !== presentation.detail) opponentRecovery.detail.textContent = presentation.detail;
}

function updateScoreboard(ownId) {
  if (!scoreboardList || !networkClient) return;
  const rows = fighterScoreboardPresentation(networkClient.state.values(), ownId);
  const point = fighterMatchPointPresentation(networkClient.state.values(), ownId);
  const signature = rows.map((row) => `${row.netId}:${row.kills}:${row.own ? 1 : 0}`).join("|");
  if (scoreboardTitle && scoreboardTitle.textContent !== `FIRST TO ${FFA_KILL_TARGET}`) {
    scoreboardTitle.textContent = `FIRST TO ${FFA_KILL_TARGET}`;
  }
  const pointSignature = point.visible ? `${point.leaderId}:${point.detail}` : "";
  if (matchPoint && hudCache.matchPoint !== pointSignature) {
    hudCache.matchPoint = pointSignature;
    matchPoint.hidden = !point.visible;
    if (point.visible) matchPoint.textContent = `${point.title} · ${point.detail}`;
  }
  if (hudCache.scoreboard === signature) return;
  hudCache.scoreboard = signature;
  scoreboardList.replaceChildren(...rows.map((row) => {
    const item = document.createElement("li");
    item.dataset.own = String(row.own);
    const label = document.createElement("span");
    label.textContent = row.label;
    const score = document.createElement("b");
    score.textContent = String(row.kills);
    item.append(label, score);
    return item;
  }));
}

function setFocusTarget(netId, mode = "nearest") {
  if (!hud.focusLabel || (hudCache.focusNetId === netId && hudCache.focusMode === mode)) return;
  hudCache.focusNetId = netId;
  hudCache.focusMode = mode;
  hud.focusLabel.textContent = netId
    ? (mode === "guard-break"
      ? `GUARD BREAK #${netId}`
      : mode === "parry"
        ? `PARRY PUNISH #${netId}`
        : mode === "knockdown"
          ? `KNOCKDOWN #${netId}`
          : mode === "recovery"
            ? `PUNISH TARGET #${netId}`
            : `NEAREST #${netId}`)
    : "NO RIVAL";
}

function setMeter(cacheKey, bar, label, value) {
  const rounded = Math.max(0, Math.min(100, Math.round(value)));
  if (hudCache[cacheKey] === rounded) return;
  hudCache[cacheKey] = rounded;
  bar.style.transform = `scaleX(${rounded / 100})`;
  label.textContent = String(rounded);
}

function setStatus(text, { force = false } = {}) {
  if (!force && hudCache.status === text) return;
  hudCache.status = text;
  eventText.textContent = text;
}

function createArenaLayer() {
  const layer = document.createElement("canvas");
  layer.width = canvas.width;
  layer.height = canvas.height;
  const layerContext = layer.getContext("2d", { alpha: false });
  // Graphics 3C's seamless tile is pre-painted ONCE. The renderer later
  // repeats it in world coordinates using the existing reconciled camera.
  // ?arenaGrid=1 keeps the unchanged original static debug-floor fallback.
  if (params.get("arenaGrid") !== "1") {
    paintArenaLiteFloor(layerContext, {tileable: true});
    return layer;
  }
  layerContext.fillStyle = "#1c1913";
  layerContext.fillRect(0, 0, layer.width, layer.height);
  layerContext.strokeStyle = "rgba(214, 195, 148, .065)";
  layerContext.lineWidth = 1;
  for (let x = 0; x <= layer.width; x += 48) {
    layerContext.beginPath();
    layerContext.moveTo(x, 0);
    layerContext.lineTo(x, layer.height);
    layerContext.stroke();
  }
  for (let y = 0; y <= layer.height; y += 48) {
    layerContext.beginPath();
    layerContext.moveTo(0, y);
    layerContext.lineTo(layer.width, y);
    layerContext.stroke();
  }
  layerContext.strokeStyle = "rgba(214, 195, 148, .22)";
  layerContext.lineWidth = 3;
  layerContext.strokeRect(12, 12, layer.width - 24, layer.height - 24);
  return layer;
}

function frame(now) {
  if (document.hidden) return;
  if (typeof m147InputProbe !== "undefined") m147InputProbe?.raf(now);
  frameBudget.advance(now, simulatePrediction);
  updateChargeHud();
  const impact = combatImpact.sample(now);
  if (impact.freeze) {
    const ownId = networkClient?.playerNetId;
    if (ownId) updateHud(ownId);
  } else {
    render(now, impact);
  }
  animationFrameId = requestAnimationFrame(frame);
}

function handleVisibilityChange() {
  releaseInputs();
  if (document.hidden) {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
    frameBudget.reset();
    snapshotRenderClock.reset();
    if (renderGapTelemetry) renderGapTelemetry.reset();
    visualCamera.reset();
    return;
  }
  frameBudget.reset(performance.now());
  snapshotRenderClock.reset();
  if (renderGapTelemetry) renderGapTelemetry.reset();
  visualCamera.reset();
  if (!animationFrameId) animationFrameId = requestAnimationFrame(frame);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

render();
frameBudget.reset(performance.now());
animationFrameId = requestAnimationFrame(frame);
