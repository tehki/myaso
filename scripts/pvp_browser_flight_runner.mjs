import { hasM147PunishFeedback, isM147RenderedRecoveryCue } from "./m147-recovery-feedback-convergence.mjs";
import { verifyM147WorldRecoveryProof } from "./m147-world-recovery-proof.mjs";
import { verifyM173WorldJumpSpend } from "./m173-world-stamina-proof.mjs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { COMBAT_ACTION, FFA_KILL_TARGET, fighterThreatPhaseState } from "../src/browser/combat-readability.mjs";
import { COMBAT } from "../src/combat/model.mjs";
import { DASH_DOUBLE_TAP_MS } from "../src/browser/dash-input.mjs";
import { planM198GuardBreakW3cExchange } from "./m198-guardbreak-input-plan.mjs";
import { measureM200WheelFeedbackLatency } from "./m200-feedback-latency.mjs";
import { summarizeM214ConfirmedFeedback } from "./m214-confirmed-feedback-latency.mjs";
import { summarizeM215SuccessfulRollLatency } from "./m215-successful-roll-latency.mjs";
import { summarizeM216ParryPunishLatency } from "./m216-successful-parry-punish-latency.mjs";
import { summarizeM217SuccessfulKickLatency } from "./m217-successful-kick-latency.mjs";
import { correlateM230HeavyReplayEvidence } from "./m230-heavy-replay-correlation.mjs";
import { withM231M108FailureEvidence } from "./m231-m108-failure-path.mjs";
import { summarizeM232SpatialHandoffFailure } from "./m232-spatial-handoff-failure.mjs";
import { summarizeM233RecoveryHandoff } from "../src/browser/m233-recovery-handoff-trace.mjs";
import { summarizeM218JumpAttackLatency } from "./m218-successful-jump-attack-latency.mjs";
import { observeM219RollBufferIngress } from "./m219-buffered-roll-ingress-evidence.mjs";
import { summarizeM220KnockdownFocusTimeline } from "./m220-knockdown-focus-timeline.mjs";
import { mustAwaitM202GuardConvergence } from "./m202-guardbreak-convergence.mjs";
import { verifyM201ServerPunishProof } from "./m201-authoritative-phase-proof.mjs";
import { classifyGuardBreakPunishWorld } from "./combat4d-world-chronology.mjs";
import { verifyM206ServerKnockdownPunish } from "./m206-knockdown-punish-proof.mjs";
import { verifyM209DualKnockdownServerPunish } from "./m209-dual-knockdown-proof.mjs";
import { verifyM211DualRecoveryServerProof } from "./m211-dual-recovery-phase-proof.mjs";
import { planM203W3cPointerPause } from "./m203-w3c-wheel-ack.mjs";
import { planM225ThreatDistanceStaging } from "./m225-ffa-threat-distance.mjs";
import { qualifyM150ParryGeometry } from "./m150-replicated-geometry.mjs";
import { awaitM223HeavyWindup, planM223WheelDelay } from "./m223-server-heavy-windup.mjs";
import { planM121DirectionalW3cActions } from "./m121-native-directional-gesture.mjs";
import { selectM121NativeRoles } from "./m121-native-direction-roles.mjs";
import { planM147NativeFocusKeyActions } from "./m147-native-focus-stage.mjs";
import { dispatchR2ReleaseLedShortBlock } from "./r2-release-led-short-block.mjs";
import { createM221TrustedWheelRegistry } from "./m221-trusted-wheel-attestation.mjs";
import { attachM325TrustedWheelSocket } from "./m325-trusted-wheel-socket.mjs";
import { requiresM338GuardBreakWheelSocket } from "./m338-guard-break-wheel-scenarios.mjs";
import { createM227TrustedLightRegistry } from "./m227-trusted-light-pointer.mjs";
import { planM197KnockdownClusterNudge } from "./m197-knockdown-cluster.mjs";
import { isTickNewer32 } from "../src/browser/reconciliation.mjs";
import { requireM188NativeHeldLmb } from "./m188-native-heavy-control.mjs";
import { dispatchM41ObservedParry, m41NativeAsyncCueScript } from "./m41-native-observed-parry.mjs";
import { planM41ViewportWheel } from "./m41-viewport-wheel.mjs";
import { createM35CueRegistry, m35PrearmedCueScript } from "./m35-prearmed-windup-cue.mjs";
import { inspectM35ParryFirstRed } from "./m35-original-world-first-red.mjs";

const root = process.cwd();
const durationMs = Number(process.env.MYASO_PVP_FLIGHT_DURATION_MS ?? 7000);
const scenario = process.env.MYASO_PVP_SCENARIO ?? "damage";
// Initialized before the top-level native flight dispatcher invokes M110/M111.
const M110_LMB_HEAVY_HOLD_MS = 450;
// A full M62 threat chevron paints dozens of exact-tone pixels; a handful can
// arise from raster overlap. Use one significance floor for positive and leak proof.
const threatMarkerMinPixels = 8;
if (!new Set(["damage", "inputloss", "parry", "dodge", "block", "guardbreak", "backblock", "respawn", "ui", "uirespawn", "uifeedback", "uihittell", "uivitals", "uiidentity", "uiscore", "uimatch", "uirematch", "uiffa3", "uikillfeed", "uifocus", "uithreat", "uithreatbearing", "uimultithreat", "uisecondarythreat", "uisecondarybearing", "uisecondaryphase", "uiguardarc", "uisecondaryguardarc", "uithreatmarkers", "uijumpffaprimary", "uijumpffasecondary", "uijumprecoveryffa", "uijumppunishffa", "uimultirecoveryffa", "uimultirecoveryspatial", "uimultirecoverypunish", "uiparry", "uiparrypunishwindow", "uiparrypunishffa", "uiparrypunishffahit", "uiguardbreakpunishffa", "uiguardbreakpunishffahit", "uikickknockdownffa", "uikickknockdownffahit", "uikickknockdownbounded", "uirollknockdownbounded", "uirollknockdownffahit", "uimultiknockdownffa", "uimultiknockdownffahit", "uirollknockdownffa", "uistaminaauth", "uistaminaexhaustion", "uistaminafeedback", "uistaminaconfirmed", "uistun", "uiguardbreak", "uimiddleblockpressure", "uidodge", "uirecovery", "uirecoverytell", "uiattackintent", "uiheavy", "uiheavyinputloss", "uiheavyinputlossgap", "uiheavyblock", "uiheavyparry", "uiheavydodge", "uiheavypunish", "uiheavyguardbreak", "uiheavyguardbreakpunish", "uifeint", "uirunningattack", "uidirectionallight", "uirollbuffer", "uijumpbuffer", "uijumpattack", "uijumpattackinputloss", "uijumpattackpunish", "uijumpattacktelegraph", "uijumpattackblock", "uijumpattackparry", "uijumpattackdodge", "uijumpattackbuffer", "uikickbuffer", "uiguardbreaktell", "uiparrytell", "uiblockfacingtell", "uidodgetell", "uideathtell"]).has(scenario)) throw new Error(`unsupported MYASO_PVP_SCENARIO: ${scenario}`);
const staticPort = Number(process.env.MYASO_PVP_FLIGHT_HTTP_PORT ?? 4174);
const browsers = [
  {
    name: "chrome",
    port: 9515,
    executable: process.env.CHROMEWEBDRIVER ? path.join(process.env.CHROMEWEBDRIVER, "chromedriver") : "chromedriver",
    args: ["--port=9515"],
    capabilities: {
      browserName: "chrome",
      "goog:chromeOptions": {
        args: [
          "--headless=new",
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--window-size=1280,720",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
        ],
      },
    },
  },
  {
    name: "firefox",
    port: 9516,
    executable: process.env.GECKOWEBDRIVER ? path.join(process.env.GECKOWEBDRIVER, "geckodriver") : "geckodriver",
    args: ["--host", "127.0.0.1", "--port", "9516"],
    capabilities: {
      browserName: "firefox",
      "moz:firefoxOptions": {
        args: ["-headless"],
        prefs: {
          "dom.min_background_timeout_value": 4,
          "dom.timeout.enable_budget_timer_throttling": false,
          "layout.frame_rate": 60,
        },
      },
    },
  },
];
if (scenario === "uiffa3" || scenario === "uikillfeed" || scenario === "uifocus" || scenario === "uithreat" || scenario === "uithreatbearing" || scenario === "uimultithreat" || scenario === "uisecondarythreat" || scenario === "uisecondarybearing" || scenario === "uisecondaryphase" || scenario === "uiguardarc" || scenario === "uisecondaryguardarc" || scenario === "uithreatmarkers" || scenario === "uijumpffaprimary" || scenario === "uijumpffasecondary" || scenario === "uijumprecoveryffa" || scenario === "uijumppunishffa" || scenario === "uimultirecoveryffa" || scenario === "uimultirecoveryspatial" || scenario === "uimultirecoverypunish" || scenario === "uiparrypunishffa" || scenario === "uiparrypunishffahit" || scenario === "uiguardbreakpunishffa" || scenario === "uiguardbreakpunishffahit" || scenario === "uikickknockdownffa" || scenario === "uikickknockdownffahit" || scenario === "uikickknockdownbounded" || scenario === "uirollknockdownbounded" || scenario === "uirollknockdownffahit" || scenario === "uimultiknockdownffa" || scenario === "uimultiknockdownffahit" || scenario === "uirollknockdownffa") {
  browsers.push({
    name: "chrome2",
    port: 9517,
    executable: process.env.CHROMEWEBDRIVER ? path.join(process.env.CHROMEWEBDRIVER, "chromedriver") : "chromedriver",
    args: ["--port=9517"],
    capabilities: {
      browserName: "chrome",
      "goog:chromeOptions": {
        args: [
          "--headless=new",
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--window-size=1280,720",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
        ],
      },
    },
  });
}

if (scenario === "uimultiknockdownffahit") {
  browsers.push({
    name: "chrome3",
    port: 9518,
    executable: process.env.CHROMEWEBDRIVER ? path.join(process.env.CHROMEWEBDRIVER, "chromedriver") : "chromedriver",
    args: ["--port=9518"],
    capabilities: {
      browserName: "chrome",
      "goog:chromeOptions": {
        args: [
          "--headless=new",
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--window-size=1280,720",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
        ],
      },
    },
  });
}

const children = new Set();
const sessions = [];
let staticServer;
let m325Dispose = () => {};
let gameServer;
let m201ServerOutput = () => "";
const m221Registry = createM221TrustedWheelRegistry();
const m227Registry = createM227TrustedLightRegistry();
const m35CueRegistry = createM35CueRegistry();

try {
  staticServer = await startStaticServer();
  const game = await startGameServer();
  gameServer = game.child;
  m201ServerOutput = game.output;
  for (const browser of browsers) sessions.push(await startBrowser(browser));
  if (scenario === "uimultithreat" || scenario === "uisecondarythreat" || scenario === "uisecondarybearing" || scenario === "uisecondaryphase" || scenario === "uiguardarc" || scenario === "uisecondaryguardarc" || scenario === "uithreatmarkers" || scenario === "uijumpffaprimary" || scenario === "uijumpffasecondary" || scenario === "uijumprecoveryffa" || scenario === "uijumppunishffa" || scenario === "uimultirecoveryffa" || scenario === "uimultirecoveryspatial" || scenario === "uimultirecoverypunish" || scenario === "uiparrypunishffa" || scenario === "uiparrypunishffahit" || scenario === "uiguardbreakpunishffa" || scenario === "uiguardbreakpunishffahit" || scenario === "uikickknockdownffa" || scenario === "uikickknockdownffahit" || scenario === "uikickknockdownbounded" || scenario === "uirollknockdownbounded" || scenario === "uirollknockdownffahit" || scenario === "uimultiknockdownffa" || scenario === "uimultiknockdownffahit" || scenario === "uirollknockdownffa") {
    const expected = [
      ["chrome", 1],
      ["firefox", 2],
      ["chrome2", 3],
    ];
    if (scenario === "uimultiknockdownffahit") expected.push(["chrome3", 4]);
    for (const [name, expectedNetId] of expected) {
      const entry = sessions.find((candidate) => candidate.name === name);
      if (!entry) throw new Error(`${scenario} missing deterministic browser role ${name}`);
      await navigate(entry, game.url, game.certificateHash);
      const actualNetId = await waitForOnlinePlayerNetId(entry, 5000);
      if (actualNetId !== expectedNetId) {
        throw new Error(`${scenario} expected ${name} as authoritative #${expectedNetId}, received #${actualNetId}`);
      }
    }
  } else {
    await Promise.all(sessions.map((entry) => navigate(entry, game.url, game.certificateHash)));
  }
  if (scenario === "ui") {
    const results = await runOnlineUiFlight(sessions);
    console.log(`M30_ONLINE_UI_READABILITY ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uirespawn") {
    const results = await runOnlineUiRespawnFlight(sessions);
    console.log(`M31_ONLINE_UI_DEATH_RESPAWN ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uifeedback") {
    const results = await runOnlineUiFeedbackFlight(sessions);
    console.log(`M32_ONLINE_HIT_FEEDBACK ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uihittell") {
    const results = await runOnlineUiHitTellFlight(sessions);
    console.log(`M45_FFA_DAMAGE_TELL ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uivitals") {
    const results = await runOnlineUiVitalsFlight(sessions);
    console.log(`M46_FFA_SPATIAL_VITALS ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiidentity") {
    const results = await runOnlineUiIdentityFlight(sessions);
    console.log(`M47_FFA_PLAYER_IDENTITY ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiscore") {
    const results = await runOnlineUiScoreFlight(sessions);
    console.log(`M48_FFA_KILL_SCORE ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uimatch") {
    const results = await runOnlineUiMatchFlight(sessions);
    console.log(`M49_FFA_MATCH_WINNER ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uirematch") {
    const results = await runOnlineUiRematchFlight(sessions);
    console.log(`M50_FFA_REMATCH_LIFECYCLE ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiffa3") {
    const results = await runOnlineUiThreePlayerFfaFlight(sessions);
    console.log(`M51_THREE_PLAYER_FFA ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uikillfeed") {
    const results = await runOnlineUiKillFeedFlight(sessions);
    console.log(`M52_AUTHORITATIVE_KILL_FEED ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uifocus") {
    const results = await runOnlineUiFocusHudFlight(sessions);
    console.log(`M53_FFA_FOCUS_HUD ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uithreat") {
    const results = await runOnlineUiThreatAwarenessFlight(sessions);
    console.log(`M54_FFA_INCOMING_THREAT ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uithreatbearing") {
    const results = await runOnlineUiThreatAwarenessFlight(sessions, true);
    console.log(`M57_FFA_THREAT_BEARING ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uimultithreat") {
    const results = await runOnlineUiMultiThreatFlight(sessions);
    console.log(`M55_FFA_MULTI_THREAT ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uisecondarythreat") {
    const results = await runOnlineUiMultiThreatFlight(sessions, true);
    console.log(`M56_FFA_SECONDARY_THREAT ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uisecondarybearing") {
    const results = await runOnlineUiMultiThreatFlight(sessions, true, true);
    console.log(`M58_FFA_SECONDARY_THREAT_BEARING ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uisecondaryphase") {
    const results = await runOnlineUiMultiThreatFlight(sessions, true, true, true);
    console.log(`M59_FFA_SECONDARY_THREAT_PHASE ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiguardarc") {
    const results = await runOnlineUiMultiThreatFlight(sessions, true, true, true, true);
    console.log(`M60_FFA_PRIMARY_GUARD_ARC ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uisecondaryguardarc") {
    const results = await runOnlineUiMultiThreatFlight(sessions, true, true, true, true, true);
    console.log(`M61_FFA_SECONDARY_GUARD_ARC ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uithreatmarkers") {
    // M59 has its own fail-closed secondary-phase gate immediately before this
    // scenario in CI. M62 proves the spatial rendering contract without requiring
    // both secondary phase transitions to fit inside the same two-threat overlap.
    const results = await runOnlineUiMultiThreatFlight(sessions, true, true, false, true, true, true);
    console.log(`M62_FFA_SPATIAL_THREAT_MARKERS ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uijumpffaprimary") {
    const results = await runOnlineUiJumpFfaThreatFlight(sessions, "primary");
    console.log(`M142_JUMP_FFA_PRIMARY_THREAT ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uijumpffasecondary") {
    const results = await runOnlineUiJumpFfaThreatFlight(sessions, "secondary");
    console.log(`M142_JUMP_FFA_SECONDARY_THREAT ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uijumprecoveryffa") {
    const results = await runOnlineUiJumpRecoveryFfaFocusFlight(sessions);
    console.log(`M143_JUMP_RECOVERY_FFA_FOCUS ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uijumppunishffa") {
    const results = await runOnlineUiJumpRecoveryFfaPunishFlight(sessions);
    console.log(`M147_ACTIONABLE_FFA_PUNISH ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uimultirecoveryffa") {
    const results = await runOnlineUiMultiRecoveryFfaFocusFlight(sessions);
    console.log(`M144_MULTI_RECOVERY_FFA_FOCUS ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uimultirecoveryspatial") {
    const results = await runOnlineUiMultiRecoveryFfaFocusFlight(sessions, true);
    console.log(`M145_SPATIAL_RECOVERY_HANDOFF ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uimultirecoverypunish") {
    const results = await runOnlineUiMultiRecoveryPunishFlight(sessions);
    console.log(`M149_SELECTED_RECOVERY_PUNISH ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiparry") {
    const results = await runOnlineUiParryFlight(sessions);
    console.log(`M176_BLOCK_ATTACK_ARBITRATION ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiparrypunishwindow") {
    const results = await runOnlineUiParryPunishWindowFlight(sessions);
    console.log(`M146_PARRY_PUNISH_WINDOW ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiparrypunishffa") {
    const results = await runOnlineUiParryPunishFfaFocusFlight(sessions);
    console.log(`M147_PARRY_PUNISH_FFA_FOCUS ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiparrypunishffahit") {
    const results = await runOnlineUiParryPunishFfaFocusFlight(sessions, true);
    console.log(`M150_ACTIONABLE_FFA_PARRY_PUNISH ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiguardbreakpunishffa") {
    const results = await runOnlineUiGuardBreakPunishFfaFocusFlight(sessions);
    console.log(`M151_GUARD_BREAK_PUNISH_FFA_FOCUS ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiguardbreakpunishffahit") {
    const results = await runOnlineUiGuardBreakPunishFfaFocusFlight(sessions, true);
    console.log(`M152_ACTIONABLE_FFA_GUARD_BREAK_PUNISH ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiparrytell") {
    const results = await runOnlineUiParryTellFlight(sessions);
    console.log(`M41_FFA_PARRY_TELL ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiblockfacingtell") {
    const results = await runOnlineUiBlockFacingTellFlight(sessions);
    console.log(`M42_FFA_BLOCK_FACING_TELL ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uidodgetell") {
    const results = await runOnlineUiDodgeTellFlight(sessions);
    console.log(`M43_FFA_DODGE_TELL ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uideathtell") {
    const results = await runOnlineUiDeathTellFlight(sessions);
    console.log(`M44_FFA_DEATH_TELL ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uistun") {
    const results = await runOnlineUiStunOverlayFlight(sessions);
    console.log(`M35_ONLINE_STUN_OVERLAY ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uidodge") {
    const results = await runOnlineUiDodgeFeedbackFlight(sessions);
    console.log(`M36_ONLINE_DODGE_FEEDBACK ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uirecovery") {
    const results = await runOnlineUiRecoveryReadabilityFlight(sessions);
    console.log(`M37_ONLINE_RECOVERY_READABILITY ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uirecoverytell") {
    const results = await runOnlineUiRecoveryTellFlight(sessions);
    console.log(`M38_FFA_RECOVERY_TELL ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiattackintent") {
    const results = await runOnlineUiAttackIntentFlight(sessions);
    console.log(`M39_FFA_ATTACK_INTENT ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiheavy") {
    const results = await runOnlineUiHeavyStrikeFlight(sessions);
    console.log(`M106_ONLINE_HEAVY_STRIKE ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiheavyinputloss") {
    // On a RED M108 flight, emit bounded server-ingress provenance then
    // rethrow the identical error. The original real-browser hit check is
    // executed exactly once, with no replay or synthetic DOM event.
    const results = await withM231M108FailureEvidence(
      async () => await runOnlineUiHeavyStrikeFlight(sessions),
      () => game.output(),
      (diagnostic) => console.error("M231_M108_FAILURE_PATH_EVIDENCE " + JSON.stringify(diagnostic)),
    );
    const droppedActionDatagrams = (game.output().match(/M63_INPUT_ACTION_PACKET_DROPPED/g) ?? []).length;
    if (droppedActionDatagrams < 1) {
      throw new Error(`M108 expected a deliberately dropped first-send heavy-action datagram, observed ${droppedActionDatagrams}`);
    }
    // M229: require real server-side acceptance proof, in addition to the
    // unchanged authentic 46HP Chrome/Firefox M108 hit assertions above.
    // This is loopback-only evidence, never a forged input or a retry.
    const acceptedHeavyInputs = (game.output().match(/M229_LOOPBACK_HEAVY_INPUT_ACCEPTED/g) ?? []).length;
    if (acceptedHeavyInputs < 1) {
      throw new Error(`M229 missing server-accepted heavy after genuine held-LMB and deliberate first drop: ${JSON.stringify({ droppedActionDatagrams, acceptedHeavyInputs })}`);
    }
    // M230: counts alone may accept an unrelated heavy from another session
    // or a later action edge. Require the *same* first-dropped sample tick.
    const exactReplay = correlateM230HeavyReplayEvidence(game.output());
    if (exactReplay.droppedActionDatagrams !== droppedActionDatagrams
      || exactReplay.acceptedHeavyInputs !== acceptedHeavyInputs) {
      throw new Error("M230 strict one-shot count mismatch after exact replay correlation");
    }
    console.log("M230_EXACT_HEAVY_REPLAY_EVIDENCE " + JSON.stringify(exactReplay));
    console.log(`M229_HEAVY_LOSS_INGRESS_EVIDENCE ${JSON.stringify({ ok: true, droppedActionDatagrams, acceptedHeavyInputs })}`);
    console.log(`M108_HEAVY_INPUT_LOSS_RECOVERY ${JSON.stringify({ ok: true, droppedActionDatagrams, results })}`);
  } else if (scenario === "uiheavyinputlossgap") {
    // Same genuine W3C/World M108 flight, with one additional original input
    // datagram dropped at the loopback server ingress after the first edge loss.
    // This does not forge input, ACK, World events, or damage.
    const results = await withM231M108FailureEvidence(
      async () => await runOnlineUiHeavyStrikeFlight(sessions),
      () => game.output(),
      (diagnostic) => console.error("M231_M108_FAILURE_PATH_EVIDENCE " + JSON.stringify(diagnostic)),
    );
    const output = game.output();
    const droppedActionDatagrams = (output.match(/M63_INPUT_ACTION_PACKET_DROPPED/g) ?? []).length;
    const acceptedHeavyInputs = (output.match(/M229_LOOPBACK_HEAVY_INPUT_ACCEPTED/g) ?? []).length;
    const firstDrop = output.match(/CORE8A_FIRST_LOSS_DROP session=(\S+) action_tick=(\d+) packet_tick=(\d+) mask=(\d+) attack=(\d+) heavy=(\d+)/);
    const followupDrops = [...output.matchAll(/CORE8A_FOLLOWING_INPUT_DATAGRAM_DROPPED session=(\S+) packet_tick=(\d+) remaining_after=(\d+)/g)];
    const recovered = output.match(/M229_LOOPBACK_HEAVY_INPUT_ACCEPTED session=(\S+) action_tick=(\d+) client_tick=(\d+) packet_tick=(\d+) accepted_samples=(\d+)/);
    if (droppedActionDatagrams !== 1 || acceptedHeavyInputs !== 1) {
      throw new Error("CORE8A gap flight must prove exactly one original dropped edge and one server recovery: " + JSON.stringify({ droppedActionDatagrams, acceptedHeavyInputs }));
    }
    if (!firstDrop || firstDrop[4] !== "3" || firstDrop[5] !== "1" || firstDrop[6] !== "1") {
      throw new Error("CORE8A two-packet gap missing genuine original attack+heavy edge: " + JSON.stringify({ firstDrop }));
    }
    if (followupDrops.length !== 1 || followupDrops.some((entry) => entry[1] !== firstDrop[1])) {
      throw new Error("CORE8A two-packet gap did not drop exactly two following input datagrams on the same session: " + JSON.stringify({ firstDrop, followupDrops: followupDrops.map(x => x.slice(1)) }));
    }
    if (!recovered || recovered[1] !== firstDrop[1] || recovered[2] !== firstDrop[2]
      || output.indexOf(recovered[0]) <= Math.max(...followupDrops.map((entry) => entry.index))) {
      throw new Error("CORE8A two-packet gap did not recover the same original heavy tick after both drops: " + JSON.stringify({ firstDrop, followupDrops: followupDrops.map(x => x.slice(1)), recovered: recovered?.slice(1) }));
    }
    console.log("CORE8A_TWO_PACKET_GAP_NATIVE_PASS " + JSON.stringify({
      ok: true, actionTick: Number(firstDrop[2]), firstDroppedPacketTick: Number(firstDrop[3]),
      followingDroppedPacketTicks: followupDrops.map((entry) => Number(entry[2])),
      recoveredPacketTick: Number(recovered[4]), acceptedSamples: Number(recovered[5]), results,
    }));
  } else if (scenario === "uiheavyblock") {
    const results = await runOnlineUiHeavyBlockFlight(sessions);
    console.log(`M107_HEAVY_BLOCK ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiheavyparry") {
    const results = await runOnlineUiHeavyParryFlight(sessions);
    console.log(`M107_HEAVY_PARRY ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiheavydodge") {
    const results = await runOnlineUiHeavyDodgeFlight(sessions);
    console.log(`M107_HEAVY_DODGE ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiheavypunish") {
    const results = await runOnlineUiHeavyWhiffPunishFlight(sessions);
    console.log(`M109_HEAVY_WHIFF_PUNISH ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiheavyguardbreak") {
    const results = await runOnlineUiHeavyGuardBreakFlight(sessions);
    console.log(`M110_HEAVY_GUARD_BREAK ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiheavyguardbreakpunish") {
    const results = await runOnlineUiHeavyGuardBreakPunishFlight(sessions);
    console.log(`M111_HEAVY_GUARD_BREAK_PUNISH ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uifeint") {
    const results = await runOnlineUiFeintFlight(sessions);
    console.log(`M171_EXHAUSTED_HEAVY_FEINT_COMMITMENT ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uirunningattack") {
    const results = await runOnlineUiRunningAttackFlight(sessions);
    console.log(`M119_REAL_RUNNING_STRIKE ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uidirectionallight") {
    const results = await runOnlineUiDirectionalLightFlight(sessions);
    console.log(`M121_REAL_DIRECTIONAL_LIGHT ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uirollbuffer") {
    const results = await runOnlineUiRollBufferFlight(sessions);
    console.log(`M129_REAL_RECOVERY_ROLL_BUFFER ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uijumpbuffer") {
    const results = await runOnlineUiJumpBufferFlight(sessions);
    console.log(`M131_REAL_RECOVERY_JUMP_BUFFER ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uijumpattack") {
    const results = await runOnlineUiJumpAttackFlight(sessions);
    console.log(`M173_CONFIRMED_JUMP_ATTACK_CHORD_DENIAL ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uijumpattackinputloss") {
    const results = await runOnlineUiJumpAttackFlight(sessions, "uijumpattackinputloss");
    const droppedActionDatagrams = (game.output().match(/M63_INPUT_ACTION_PACKET_DROPPED/g) ?? []).length;
    if (droppedActionDatagrams < 1) {
      throw new Error(`M139 expected a deliberately dropped first-send jump-attack datagram, observed ${droppedActionDatagrams}`);
    }
    console.log(`M139_JUMP_ATTACK_INPUT_LOSS_RECOVERY ${JSON.stringify({ ok: true, droppedActionDatagrams, results })}`);
  } else if (scenario === "uijumpattackpunish") {
    const results = await runOnlineUiJumpAttackWhiffPunishFlight(sessions);
    console.log(`M140_JUMP_ATTACK_WHIFF_PUNISH ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uijumpattacktelegraph") {
    const results = await runOnlineUiJumpAttackTelegraphFlight(sessions);
    console.log(`M141_JUMP_ATTACK_TELEGRAPH ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uijumpattackblock") {
    const results = await runOnlineUiJumpAttackCounterplayFlight(sessions, "block");
    console.log(`M138_REAL_JUMP_ATTACK_BLOCK ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uijumpattackparry") {
    const results = await runOnlineUiJumpAttackCounterplayFlight(sessions, "parry");
    console.log(`M138_REAL_JUMP_ATTACK_PARRY ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uijumpattackdodge") {
    const results = await runOnlineUiJumpAttackCounterplayFlight(sessions, "dodge");
    console.log(`M138_REAL_JUMP_ATTACK_DODGE ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uijumpattackbuffer") {
    const results = await runOnlineUiJumpAttackBufferFlight(sessions);
    console.log(`M137_REAL_RECOVERY_JUMP_ATTACK_BUFFER ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uikickbuffer") {
    const results = await runOnlineUiKickBufferFlight(sessions);
    console.log(`M133_REAL_RECOVERY_KICK_BUFFER ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uikickknockdownffa") {
    const results = await runOnlineUiKickKnockdownFfaFocusFlight(sessions);
    console.log(`M153_KICK_KNOCKDOWN_FFA_FOCUS ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uikickknockdownffahit") {
    const results = await runOnlineUiKickKnockdownFfaHitFlight(sessions);
    console.log("M155_ACTIONABLE_THIRD_PARTY_KNOCKDOWN_PUNISH " + JSON.stringify({ ok: true, results }));
  } else if (scenario === "uikickknockdownbounded") {
    const results = await runOnlineUiBoundedKickKnockdownFlight(sessions);
    console.log("M161_BOUNDED_KICK_KNOCKDOWN_BROWSER " + JSON.stringify({ ok: true, results }));
  } else if (scenario === "uirollknockdownbounded") {
    const results = await runOnlineUiBoundedRollKnockdownFlight(sessions);
    console.log("M162_BOUNDED_ROLL_KNOCKDOWN_BROWSER " + JSON.stringify({ ok: true, results }));
  } else if (scenario === "uimultiknockdownffa") {
    const results = await runOnlineUiMultiKnockdownFfaFlight(sessions);
    console.log("M158_MULTI_KNOCKDOWN_FFA_ARBITRATION " + JSON.stringify({ ok: true, results }));
  } else if (scenario === "uimultiknockdownffahit") {
    const results = await runOnlineUiMultiKnockdownFfaHitFlight(sessions);
    console.log("M159_ACTIONABLE_MULTI_KNOCKDOWN_PUNISH " + JSON.stringify({ ok: true, results }));
  } else if (scenario === "uirollknockdownffahit") {
    const results = await runOnlineUiRollKnockdownFfaHitFlight(sessions);
    console.log("M156_ACTIONABLE_THIRD_PARTY_ROLL_KNOCKDOWN_PUNISH " + JSON.stringify({ ok: true, results }));
  } else if (scenario === "uirollknockdownffa") {
    const results = await runOnlineUiRollKnockdownFfaFocusFlight(sessions);
    console.log(`M154_ROLL_KNOCKDOWN_FFA_FOCUS ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uistaminaauth") {
    const results = await runOnlineUiAuthoritativeStaminaFlight(sessions);
    console.log("M164_AUTHORITATIVE_STAMINA_BROWSER " + JSON.stringify({ ok: true, results }));
  } else if (scenario === "uistaminaexhaustion") {
    const results = await runOnlineUiStaminaExhaustionFlight(sessions);
    console.log("M165_AUTHORITATIVE_STAMINA_EXHAUSTION " + JSON.stringify({ ok: true, results }));
  } else if (scenario === "uistaminafeedback") {
    const results = await runOnlineUiStaminaFeedbackFlight(sessions);
    console.log("M166_AUTHORITATIVE_STAMINA_FEEDBACK " + JSON.stringify({ ok: true, results }));
  } else if (scenario === "uistaminaconfirmed") {
    const results = await runOnlineUiConfirmedStaminaActionsFlight(sessions);
    console.log("M175_CONFIRMED_KICK_ATTACK_ARBITRATION " + JSON.stringify({ ok: true, results }));
  } else if (scenario === "uiguardbreaktell") {
    const results = await runOnlineUiGuardBreakTellFlight(sessions);
    console.log(`M40_FFA_GUARD_BREAK_TELL ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uimiddleblockpressure") {
    const results = await runOnlineUiMiddleBlockPressureFlight(sessions);
    console.log("R2_GENUINE_MIDDLE_HOLD_GUARD_PRESSURE " + JSON.stringify({ ok: true, results }));
  } else if (scenario === "uiguardbreak") {
    const results = await runOnlineUiGuardBreakFlight(sessions);
    console.log(`M34_ONLINE_GUARD_BREAK_FEEDBACK ${JSON.stringify({ ok: true, results })}`);
  } else {
    const results = await Promise.all(sessions.map(waitForResult));
    assertPairedResults(results);
    let droppedActionDatagrams = 0;
    if (scenario === "inputloss") {
      droppedActionDatagrams = (game.output().match(/M63_INPUT_ACTION_PACKET_DROPPED/g) ?? []).length;
      if (droppedActionDatagrams < 2) {
        throw new Error(`M63 expected first-send action datagram loss on both real clients, observed ${droppedActionDatagrams}`);
      }
    }
    const label = scenario === "inputloss" ? "M63_PVP_REDUNDANT_ACTION_RECOVERY" : scenario === "parry" ? "M23_PVP_PARRY" : scenario === "dodge" ? "M24_PVP_DODGE" : scenario === "block" ? "M25_PVP_BLOCK" : scenario === "guardbreak" ? "M26_PVP_GUARD_BREAK" : scenario === "backblock" ? "M27_PVP_DIRECTIONAL_BLOCK" : scenario === "respawn" ? "M28_PVP_RESPAWN" : "M22_PVP_BROWSER_COMBAT";
    console.log(`${label} ${JSON.stringify({ ok: true, droppedActionDatagrams, results })}`);
  }
} finally {
  for (const session of sessions) {
    try { await webdriver(session.base, "DELETE", `/session/${session.sessionId}`); } catch {}
  }
  for (const child of children) terminate(child);
  m325Dispose(); // Drain upgraded localhost browser proof sockets before HTTP close.
  if (staticServer) await new Promise((resolve) => staticServer.close(resolve));
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
      // Same-origin loopback QA observation only; never a Combat input endpoint.
      if (url.pathname === "/__myaso_m35_rendered_windup" && request.method === "POST") {
        const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress);
        if (!local || request.headers.origin !== `http://${request.headers.host}`) return send(response, 403, "forbidden");
        let body = "";
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 1024) return send(response, 413, "payload too large");
        }
        if (!m35CueRegistry.receive(JSON.parse(body))) return send(response, 422, "stale/invalid rendered cue");
        response.writeHead(204); response.end(); return;
      }
      // Acceptance-only localhost receipt. No input is generated here.
      if (url.pathname === "/__myaso_m221_trusted_wheel" && request.method === "POST") {
        let body = "";
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 1024) return send(response, 413, "payload too large");
        }
        const packet = JSON.parse(body);
        if (!m221Registry.receive(packet)) return send(response, 422, "untrusted/stale wheel");
        response.writeHead(204);
        response.end();
        return;
      }
      // M227: read-only trusted browser pointerdown notification, never input.
      if (url.pathname === "/__myaso_m227_trusted_light" && request.method === "POST") {
        let body = "";
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 1024) return send(response, 413, "payload too large");
        }
        const packet = JSON.parse(body);
        if (!m227Registry.receive(packet)) return send(response, 422, "untrusted/stale light pointerdown");
        response.writeHead(204);
        response.end();
        return;
      }
      let relative = decodeURIComponent(url.pathname);
      if (relative === "/") relative = "/web/pvp-flight.html";
      const absolute = path.resolve(root, `.${relative}`);
      if (!absolute.startsWith(`${root}${path.sep}`)) return send(response, 403, "forbidden");
      const info = await stat(absolute);
      if (!info.isFile()) return send(response, 404, "not found");
      const data = await readFile(absolute);
      response.statusCode = 200;
      response.setHeader("cache-control", "no-store");
      response.setHeader("content-type", contentType(absolute));
      response.end(data);
    } catch (error) {
      send(response, error?.code === "ENOENT" ? 404 : 500, "not found");
    }
  });
  // M325: receive a genuine Firefox wheel from a pre-connected local socket.
  // Unlike a per-wheel fetch, it does not need to establish HTTP transport.
  m325Dispose = attachM325TrustedWheelSocket(server, m221Registry);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(staticPort, "127.0.0.1", resolve);
  });
  return server;
}

async function startGameServer() {
  const child = spawn("cargo", ["run", "--locked", "--manifest-path", "server/Cargo.toml", "--bin", "myaso-server", "--quiet"], {
    cwd: root,
    env: {
      ...process.env,
      MYASO_BIND: "127.0.0.1:0",
      MYASO_FLIGHT_ACTION_PROOF: (scenario === "uiguardbreakpunishffahit"
        || scenario === "uiguardbreakpunishffa"
        // M173 exact original World same-tick Jump stamina-spend evidence.
        // The existing server flag is fail-closed on nonloopback listeners.
        || scenario === "uijumpattack"
        || scenario === "uidirectionallight"
        // Original loopback-only 60Hz real World M111 ACTION/BREAK/HIT trace.
        || scenario === "uiheavyguardbreakpunish"
        || scenario === "uiguardbreak" || scenario === "uiguardbreaktell"
        || scenario === "uiheavyblock" || scenario === "uiheavyparry"
        // QA-only original-World proof for physical M35/M41 short-LMB parry:
        // W3C wheel receipt and browser-local clocks cannot prove whether
        // defender Block preceded server contact within the 125ms window.
        // Read-only M201_AUTH_ACTION and CORE8C_WORLD_CONTACT on loopback;
        // no World stepping, input synthesis, HIT recipient, or protocol change.
        || scenario === "uistun" || scenario === "uiparrytell"
        || scenario === "uiheavydodge"
        || scenario === "uijumprecoveryffa"
        || scenario === "uikickknockdownffahit"
        || scenario === "uirollknockdownffahit" || scenario === "uijumppunishffa"
        || scenario === "uimultiknockdownffahit"
        || scenario === "uimultirecoveryffa"
        || scenario === "uimultirecoveryspatial") ? "1" : "0",
      // Existing M121/M156 original-v1 ingress evidence is never enabled for
      // v2 or other production paths; the Rust server rejects nonloopback.
      MYASO_FLIGHT_M121_INPUT_PROOF: scenario === "uidirectionallight" || scenario === "uirollknockdownffahit" || scenario === "uijumppunishffa" ? "1" : "0",
      MYASO_FLIGHT_DROP_NEW_ACTION_DATAGRAMS:
        scenario === "inputloss" || scenario === "uiheavyinputloss" || scenario === "uiheavyinputlossgap" || scenario === "uijumpattackinputloss" ? "1" : "0",
      MYASO_FLIGHT_DROP_FOLLOWING_INPUT_DATAGRAMS:
        scenario === "uiheavyinputlossgap" ? "1" : "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);
  let listeningUrl = null;
  let certificateHash = null;
  let buffer = "";
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; process.stderr.write(chunk); });
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
    buffer += chunk;
    for (const line of buffer.split(/\r?\n/)) {
      const address = line.match(/listening on (https:\/\/[^\s]+)/)?.[1];
      if (address) listeningUrl = address;
      if (line.includes("development certificate SHA-256:")) {
        const candidate = line.split("development certificate SHA-256:").at(-1).trim().replace(/[^0-9a-fA-F]/g, "");
        if (candidate.length === 64) certificateHash = candidate.toLowerCase();
      }
    }
  });

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && (!listeningUrl || !certificateHash)) {
    if (child.exitCode !== null) throw new Error(`game server exited early (${child.exitCode}): ${stderr}`);
    await sleep(100);
  }
  if (!listeningUrl || !certificateHash) {
    throw new Error(`game server did not publish flight endpoint/hash: ${buffer}\n${stderr}`);
  }
  return { child, url: listeningUrl, certificateHash, output: () => buffer };
}

async function startBrowser(browser) {
  const child = spawn(browser.executable, browser.args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  children.add(child);
  child.stdout?.on("data", (chunk) => process.stdout.write(`[${browser.name}-driver] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[${browser.name}-driver] ${chunk}`));
  const base = `http://127.0.0.1:${browser.port}`;
  await waitForDriver(base, child, browser.name);
  const created = await webdriver(base, "POST", "/session", {
    capabilities: { alwaysMatch: browser.capabilities },
  });
  const sessionId = created.sessionId ?? created.value?.sessionId;
  if (!sessionId) throw new Error(`${browser.name} WebDriver did not return a session id: ${JSON.stringify(created)}`);
  // Make runner timing explicit across Chrome/Firefox instead of inheriting
  // driver-specific defaults. This changes only WebDriver command tolerance.
  await webdriver(base, "POST", `/session/${sessionId}/timeouts`, {
    script: 15_000,
    pageLoad: 30_000,
    implicit: 0,
  });
  if (scenario === "uiparry" || scenario === "uistun" || scenario === "uiguardbreak" || scenario === "uimiddleblockpressure" || scenario === "uidodge" || scenario === "uiattackintent" || scenario === "uiheavy" || scenario === "uiheavyinputloss" || scenario === "uiheavyinputlossgap" || scenario === "uiheavyblock" || scenario === "uiheavyparry" || scenario === "uiheavydodge" || scenario === "uiheavypunish" || scenario === "uiheavyguardbreak" || scenario === "uiheavyguardbreakpunish" || scenario === "uifeint" || scenario === "uirunningattack" || scenario === "uidirectionallight" || scenario === "uirollbuffer" || scenario === "uijumpbuffer" || scenario === "uijumpattack" || scenario === "uijumpattackinputloss" || scenario === "uijumpattackpunish" || scenario === "uijumpattacktelegraph" || scenario === "uijumpffaprimary" || scenario === "uijumpffasecondary" || scenario === "uijumprecoveryffa" || scenario === "uijumppunishffa" || scenario === "uimultirecoveryffa" || scenario === "uimultirecoveryspatial" || scenario === "uimultirecoverypunish" || scenario === "uiparrypunishwindow" || scenario === "uiparrypunishffa" || scenario === "uiparrypunishffahit" || scenario === "uiguardbreakpunishffa" || scenario === "uiguardbreakpunishffahit" || scenario === "uikickknockdownffa" || scenario === "uikickknockdownffahit" || scenario === "uikickknockdownbounded" || scenario === "uirollknockdownbounded" || scenario === "uirollknockdownffahit" || scenario === "uimultiknockdownffa" || scenario === "uimultiknockdownffahit" || scenario === "uirollknockdownffa" || scenario === "uistaminaauth" || scenario === "uistaminaexhaustion" || scenario === "uistaminafeedback" || scenario === "uistaminaconfirmed" || scenario === "uijumpattackblock" || scenario === "uijumpattackparry" || scenario === "uijumpattackdodge" || scenario === "uijumpattackbuffer" || scenario === "uikickbuffer" || scenario === "uiguardbreaktell" || scenario === "uiparrytell" || scenario === "uiblockfacingtell" || scenario === "uidodgetell") {
    await webdriver(base, "POST", `/session/${sessionId}/window/rect`, { x: 0, y: 0, width: 1280, height: 900 });
  }
  return { ...browser, child, base, sessionId };
}

async function navigate(session, gameUrl, certificateHash) {
  const page = scenario === "ui" || scenario === "uirespawn" || scenario === "uifeedback" || scenario === "uihittell" || scenario === "uivitals" || scenario === "uiidentity" || scenario === "uiscore" || scenario === "uimatch" || scenario === "uirematch" || scenario === "uiffa3" || scenario === "uikillfeed" || scenario === "uifocus" || scenario === "uithreat" || scenario === "uithreatbearing" || scenario === "uimultithreat" || scenario === "uisecondarythreat" || scenario === "uisecondarybearing" || scenario === "uisecondaryphase" || scenario === "uiguardarc" || scenario === "uisecondaryguardarc" || scenario === "uithreatmarkers" || scenario === "uijumpffaprimary" || scenario === "uijumpffasecondary" || scenario === "uijumprecoveryffa" || scenario === "uijumppunishffa" || scenario === "uimultirecoveryffa" || scenario === "uimultirecoveryspatial" || scenario === "uimultirecoverypunish" || scenario === "uiparry" || scenario === "uiparrypunishwindow" || scenario === "uiparrypunishffa" || scenario === "uiparrypunishffahit" || scenario === "uiguardbreakpunishffa" || scenario === "uiguardbreakpunishffahit" || scenario === "uikickknockdownffa" || scenario === "uikickknockdownffahit" || scenario === "uikickknockdownbounded" || scenario === "uirollknockdownbounded" || scenario === "uirollknockdownffahit" || scenario === "uimultiknockdownffa" || scenario === "uimultiknockdownffahit" || scenario === "uirollknockdownffa" || scenario === "uistaminaauth" || scenario === "uistaminaexhaustion" || scenario === "uistaminafeedback" || scenario === "uistaminaconfirmed" || scenario === "uistun" || scenario === "uiguardbreak" || scenario === "uimiddleblockpressure" || scenario === "uidodge" || scenario === "uirecovery" || scenario === "uirecoverytell" || scenario === "uiattackintent" || scenario === "uiheavy" || scenario === "uiheavyinputloss" || scenario === "uiheavyinputlossgap" || scenario === "uiheavyblock" || scenario === "uiheavyparry" || scenario === "uiheavydodge" || scenario === "uiheavypunish" || scenario === "uiheavyguardbreak" || scenario === "uiheavyguardbreakpunish" || scenario === "uifeint" || scenario === "uirunningattack" || scenario === "uidirectionallight" || scenario === "uirollbuffer" || scenario === "uijumpbuffer" || scenario === "uijumpattack" || scenario === "uijumpattackinputloss" || scenario === "uijumpattackpunish" || scenario === "uijumpattacktelegraph" || scenario === "uijumpattackblock" || scenario === "uijumpattackparry" || scenario === "uijumpattackdodge" || scenario === "uijumpattackbuffer" || scenario === "uikickbuffer" || scenario === "uiguardbreaktell" || scenario === "uiparrytell" || scenario === "uiblockfacingtell" || scenario === "uidodgetell" || scenario === "uideathtell" ? "index.html" : "pvp-flight.html";
  const url = new URL(`http://127.0.0.1:${staticPort}/web/${page}`);
  url.searchParams.set("server", gameUrl);
  url.searchParams.set("cert", certificateHash);
  if (scenario !== "ui") {
    url.searchParams.set("duration", String(durationMs));
    url.searchParams.set("scenario", scenario);
  }
  await webdriver(session.base, "POST", `/session/${session.sessionId}/url`, { url: url.toString() });
}

async function waitForOnlinePlayerNetId(session, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await execute(session.base, session.sessionId, `
      const text = document.querySelector('#event-text')?.textContent?.trim() ?? '';
      const match = text.match(/^Online - player #(\\d+) - server tick \\d+$/);
      return match ? Number(match[1]) : 0;
    `);
    if (value > 0) return value;
    await sleep(25);
  }
  throw new Error(`${session.name} did not publish an authoritative player id after navigation`);
}

async function runOnlineUiFlight(entries) {
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const ordered = ready.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const attacker = entries.find((entry) => entry.name === ordered[0].browser);
  const defender = entries.find((entry) => entry.name === ordered[1].browser);
  if (!attacker || !defender) throw new Error(`could not resolve UI roles from ${JSON.stringify(ready)}`);

  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));

  const arena = await webdriver(attacker.base, "POST", `/session/${attacker.sessionId}/element`, {
    using: "css selector",
    value: "#arena",
  });
  const elementId = arena?.["element-6066-11e4-a52e-4f735466cecf"];
  if (!elementId) throw new Error(`${attacker.name} did not resolve the real arena canvas`);

  let evidence = null;
  await pulseMovementKey(attacker, "d", 120);
  for (let attempt = 0; attempt < 5 && !evidence; attempt += 1) {
    await performArenaAttack(attacker, elementId);
    evidence = await waitForUiCombatEvidence(entries, 700, false);
  }
  if (!evidence) evidence = await waitForUiCombatEvidence(entries, 1000, true);
  await sleep(100);
  evidence = await Promise.all(entries.map(readUiEvidence));
  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser !== attacker.name);
  if (!attackerResult || !defenderResult) throw new Error(`incomplete UI evidence: ${JSON.stringify(evidence)}`);
  if (!attackerResult.keys.includes("keydown:KeyD") || !attackerResult.keys.includes("keyup:KeyD")) {
    throw new Error(`real attacker movement control was not delivered to the arena: ${JSON.stringify(attackerResult)}`);
  }
  const primaryDown = attackerResult.pointers.find((event) => event.type === "pointerdown" && event.button === 0);
  const primaryUp = attackerResult.pointers.find((event) => event.type === "pointerup" && event.button === 0);
  if (!primaryDown || !primaryUp || primaryDown.x < 0.6 || Math.abs(primaryDown.y - 0.5) > 0.15) {
    throw new Error(`real rightward attack aim was not delivered to the attacker arena: ${JSON.stringify(attackerResult)}`);
  }
  if (attackerResult.playerHp !== 100 || attackerResult.opponentHp !== 66) {
    throw new Error(`attacker HUD did not render authoritative damage: ${JSON.stringify(attackerResult)}`);
  }
  if (defenderResult.playerHp !== 66 || defenderResult.opponentHp !== 100) {
    throw new Error(`defender HUD did not render authoritative damage: ${JSON.stringify(defenderResult)}`);
  }
  if (!attackerResult.events.includes("Opponent hit - 34 HP.")) {
    throw new Error(`attacker never rendered the M29 hit message: ${JSON.stringify(attackerResult.events)}`);
  }
  if (!defenderResult.events.includes("Hit taken - 34 HP.")) {
    throw new Error(`defender never rendered the M29 damage message: ${JSON.stringify(defenderResult.events)}`);
  }
  if (!attackerResult.events.some((text) => text.startsWith("Attack committed") || text.startsWith("Strike active") || text.startsWith("Recovery"))) {
    throw new Error(`attacker never rendered an authoritative action commitment hint: ${JSON.stringify(attackerResult.events)}`);
  }
  return evidence;
}

async function runOnlineUiFeedbackFlight(entries) {
  const evidence = await runOnlineUiFlight(entries);
  const attacker = evidence.find((entry) => entry.feedbackTransitions.includes("hit-confirm"));
  const defender = evidence.find((entry) => entry.feedbackTransitions.includes("damage-taken"));
  if (!attacker || !defender || attacker.browser === defender.browser) {
    throw new Error(`M32 authoritative hit feedback was not rendered on opposite clients: ${JSON.stringify(evidence)}`);
  }
  return evidence;
}

async function runOnlineUiHitTellFlight(entries) {
  await Promise.all(entries.map(armHitTellSampler));
  let evidence;
  let maxima;
  try {
    evidence = await runOnlineUiFeedbackFlight(entries);
    maxima = await Promise.all(entries.map(async (entry) => ({
      browser: entry.name,
      pixels: await readHitTellSampler(entry),
    })));
  } finally {
    await Promise.allSettled(entries.map(stopHitTellSampler));
  }

  const attacker = evidence.find((entry) => entry.feedbackTransitions.includes("hit-confirm"));
  const defender = evidence.find((entry) => entry.feedbackTransitions.includes("damage-taken"));
  if (!attacker || !defender || attacker.browser === defender.browser) {
    throw new Error(`M45 could not resolve authoritative hit roles: ${JSON.stringify(evidence)}`);
  }
  const attackerPixels = maxima.find((entry) => entry.browser === attacker.browser)?.pixels ?? 0;
  const defenderPixels = maxima.find((entry) => entry.browser === defender.browser)?.pixels ?? 0;
  if (attackerPixels < 24) {
    throw new Error(`M45 attacker never painted the damaged remote fighter tell: ${attackerPixels}`);
  }
  if (defenderPixels !== 0) {
    throw new Error(`M45 defender painted the remote-only damage tell around local damage: ${defenderPixels}`);
  }
  return evidence.map((entry) => ({
    ...entry,
    hitTellMaxPixels: entry.browser === attacker.browser ? attackerPixels : defenderPixels,
  }));
}

async function runOnlineUiVitalsFlight(entries) {
  const evidence = await runOnlineUiFeedbackFlight(entries);
  const attacker = evidence.find((entry) => entry.feedbackTransitions.includes("hit-confirm"));
  const defender = evidence.find((entry) => entry.feedbackTransitions.includes("damage-taken"));
  if (!attacker || !defender || attacker.browser === defender.browser) {
    throw new Error(`M46 could not resolve authoritative hit roles: ${JSON.stringify(evidence)}`);
  }
  const attackerSession = entries.find((entry) => entry.name === attacker.browser);
  const defenderSession = entries.find((entry) => entry.name === defender.browser);
  if (!attackerSession || !defenderSession) throw new Error("M46 could not resolve browser sessions");

  await sleep(40);
  const [attackerVitals, defenderVitals] = await Promise.all([
    sampleRemoteVitalsPixels(attackerSession),
    sampleRemoteVitalsPixels(defenderSession),
  ]);
  const ratioCloseTo = (hpPixels, guardPixels, expected, tolerance = 0.08) =>
    guardPixels >= 40 && Math.abs(hpPixels / guardPixels - expected) <= tolerance;
  if (!ratioCloseTo(attackerVitals.hpPixels, attackerVitals.guardPixels, 0.66)
    || attackerVitals.hpPixels >= attackerVitals.guardPixels) {
    throw new Error(`M46 damaged remote vitals were not spatially rendered at the authoritative 66/100 ratio: ${JSON.stringify(attackerVitals)}`);
  }
  if (!ratioCloseTo(defenderVitals.hpPixels, defenderVitals.guardPixels, 1.0)) {
    throw new Error(`M46 undamaged remote vitals were not spatially rendered at the authoritative 100/100 ratio: ${JSON.stringify(defenderVitals)}`);
  }
  return evidence.map((entry) => ({
    ...entry,
    spatialVitals: entry.browser === attacker.browser ? attackerVitals : defenderVitals,
  }));
}

async function runOnlineUiIdentityFlight(entries) {
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  if (ready.length !== 2 || ready.some((entry) => !entry.playerNetId)) {
    throw new Error(`M47 did not resolve both authoritative player identities: ${JSON.stringify(ready)}`);
  }
  await sleep(80);
  const evidence = await Promise.all(entries.map(readUiEvidence));
  const results = [];
  for (const entry of entries) {
    const pixels = await sampleIdentityBadgePixels(entry);
    if (pixels < 280 || pixels > 650) {
      throw new Error(`M47 expected exactly one remote identity badge on ${entry.name}: pixels=${pixels} evidence=${JSON.stringify(evidence)}`);
    }
    const state = evidence.find((candidate) => candidate.browser === entry.name);
    if (!state || state.playerHp !== 100 || state.playerGuard !== 100 || state.opponentHp !== 100 || state.opponentGuard !== 100) {
      throw new Error(`M47 identity flight changed authoritative vitals: ${JSON.stringify(evidence)}`);
    }
    results.push({ ...state, identityBadgePixels: pixels });
  }
  return results;
}

async function runOnlineUiRecoveryReadabilityFlight(entries) {
  let evidence = await runOnlineUiFeedbackFlight(entries);
  let attacker = evidence.find((entry) => entry.feedbackTransitions.includes("hit-confirm"));
  let defender = evidence.find((entry) => entry.feedbackTransitions.includes("damage-taken"));
  if (!attacker || !defender || attacker.browser === defender.browser) {
    throw new Error(`M37 could not resolve attacker / defender: ${JSON.stringify(evidence)}`);
  }
  const attackerBrowser = attacker.browser;
  const defenderBrowser = defender.browser;
  const observedRecovery = (entry) => entry?.recoveryTransitions.some((transition) => transition.visible
    && transition.state === "attack-recovery"
    && transition.label === "PUNISH"
    && transition.detail === "Attack recovery") ?? false;

  // A hit-confirm can arrive one render/snapshot ahead of the opponent
  // recovery cue on loaded CI browsers. Require the same recovery frame, but
  // poll for it instead of sampling only the first post-hit evidence.
  let showedRecovery = observedRecovery(defender);
  const recoveryDeadline = Date.now() + 700;
  while (!showedRecovery && Date.now() < recoveryDeadline) {
    await sleep(20);
    evidence = await Promise.all(entries.map(readUiEvidence));
    attacker = evidence.find((entry) => entry.browser === attackerBrowser);
    defender = evidence.find((entry) => entry.browser === defenderBrowser);
    showedRecovery = observedRecovery(defender);
  }
  if (!showedRecovery) {
    throw new Error(`M37 defender never rendered opponent attack recovery: ${JSON.stringify(defender?.recoveryTransitions ?? [])}`);
  }
  if (attacker?.recoveryTransitions.some((entry) => entry.visible && entry.state === "attack-recovery")) {
    throw new Error(`M37 attacker incorrectly rendered its own recovery as opponent recovery: ${JSON.stringify(attacker.recoveryTransitions)}`);
  }

  const deadline = Date.now() + 1200;
  while (Date.now() < deadline) {
    evidence = await Promise.all(entries.map(readUiEvidence));
    defender = evidence.find((entry) => entry.browser === defenderBrowser);
    if (defender && !defender.recoveryVisible) break;
    await sleep(30);
  }
  evidence = await Promise.all(entries.map(readUiEvidence));
  defender = evidence.find((entry) => entry.browser === defenderBrowser);
  if (!defender || defender.recoveryVisible || defender.recoveryTransitions.at(-1)?.visible !== false) {
    throw new Error(`M37 recovery cue did not clear after authoritative recovery: ${JSON.stringify(defender)}`);
  }
  return evidence;
}

async function runOnlineUiRecoveryTellFlight(entries) {
  // M38's former post-hit pixel polling started after the 255 ms attack
  // recovery had often ended on a loaded runner. Capture every painted
  // frame from before the genuine attack, as in the M45 damage-tell gate.
  await Promise.all(entries.map(armRecoveryTellSampler));
  let evidence;
  let pixels;
  try {
    evidence = await runOnlineUiFeedbackFlight(entries);
    pixels = await Promise.all(entries.map(async (entry) => ({
      browser: entry.name,
      max: await readRecoveryTellSampler(entry),
    })));
  } finally {
    await Promise.allSettled(entries.map(stopRecoveryTellSampler));
  }
  const attacker = evidence.find((entry) => entry.feedbackTransitions.includes("hit-confirm"));
  const defender = evidence.find((entry) => entry.feedbackTransitions.includes("damage-taken"));
  if (!attacker || !defender || attacker.browser === defender.browser) {
    throw new Error(`M38 could not resolve attacker / defender: ${JSON.stringify(evidence)}`);
  }
  const attackerSession = entries.find((entry) => entry.name === attacker.browser);
  const defenderSession = entries.find((entry) => entry.name === defender.browser);
  if (!attackerSession || !defenderSession) throw new Error(`M38 could not resolve browser sessions`);

  const observerMax = pixels.find((entry) => entry.browser === defender.browser)?.max ?? 0;
  const localMax = pixels.find((entry) => entry.browser === attacker.browser)?.max ?? 0;
  if (observerMax < 24 || localMax !== 0) {
    throw new Error(`M38 recovery-tell pixels violated remote-only evidence: observer=${observerMax} local=${localMax}`);
  }
  evidence = await Promise.all(entries.map(readUiEvidence));
  evidence = evidence.map((entry) => ({
    ...entry,
    recoveryTellMaxPixels: entry.browser === defender.browser ? observerMax : localMax,
  }));
  const finalAttacker = evidence.find((entry) => entry.browser === attacker.browser);
  const finalDefender = evidence.find((entry) => entry.browser === defender.browser);
  if (!finalAttacker || !finalDefender) throw new Error(`M38 incomplete final evidence: ${JSON.stringify(evidence)}`);
  if (finalDefender.recoveryTellMaxPixels < 24) {
    throw new Error(`M38 defender never painted the remote recovery ring: ${JSON.stringify(finalDefender)}`);
  }
  if (finalAttacker.recoveryTellMaxPixels !== 0) {
    throw new Error(`M38 attacker painted a recovery ring around a non-recovering remote: ${JSON.stringify(finalAttacker)}`);
  }
  return evidence;
}

async function runOnlineUiAttackIntentFlight(entries) {
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const attacker = entries.find((entry) => entry.name === "chrome");
  const defender = entries.find((entry) => entry.name === "firefox");
  const attackerReady = ready.find((entry) => entry.browser === attacker?.name);
  const defenderReady = ready.find((entry) => entry.browser === defender?.name);
  if (!attacker || !defender || !attackerReady || !defenderReady) throw new Error(`could not resolve M39 UI roles from ${JSON.stringify(ready)}`);
  const attackRight = attackerReady.playerNetId < defenderReady.playerNetId;
  const movementKey = attackRight ? "d" : "a";
  const movementCode = attackRight ? "KeyD" : "KeyA";
  const attackOffset = attackRight ? 200 : -200;

  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const attackerElementId = await resolveArenaElement(attacker, "M39 attacker");
  await Promise.all(entries.map(centerArenaInViewport));
  await pulseMovementKey(attacker, movementKey, 120);
  await armWindupTellSampler(defender);
  let evidence = null;
  try {
    for (let attempt = 0; attempt < 3 && !evidence; attempt += 1) {
      // M240: short LMB is committed on genuine pointerUP (R1). The former
      // DOWN -> wait up to 600ms for windup -> UP deadlocked the windup
      // itself. Arm the passive Firefox frame sampler BEFORE the real
      // 65ms Chrome W3C down/up so the 135ms server windup is captured
      // without delaying the release behind the observer WebDriver polls.
      // Promise.all still fails closed for either genuine W3C input failure
      // or the missing 24-pixel remote-only authoritative tell.
      const [observed] = await Promise.all([
        waitForRemoteWindupTell(entries, attacker, defender, 600, false),
        performArenaAttackHold(attacker, attackerElementId, attackOffset, 65),
      ]);
      evidence = observed;
      if (!evidence) await sleep(520);
    }
    if (!evidence) evidence = await waitForRemoteWindupTell(entries, attacker, defender, 300, true);
  } finally {
    await stopWindupTellSampler(defender);
  }
  await waitForWindupTellClear(defender, 500);
  // Read authentic pointerUP AFTER the W3C transaction has completed.
  // The earlier captured pixel values remain mandatory positive/negative
  // evidence and are not replaced with a fabricated later canvas sample.
  const completed = await Promise.all(entries.map(readUiEvidence));
  evidence = evidence.map((entry) => ({
    ...completed.find((item) => item.browser === entry.browser),
    windupTellMaxPixels: entry.windupTellMaxPixels,
  }));
  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) throw new Error(`incomplete M39 UI evidence: ${JSON.stringify(evidence)}`);
  if (!attackerResult.keys.includes(`keydown:${movementCode}`) || !attackerResult.keys.includes(`keyup:${movementCode}`)) {
    throw new Error(`M39 real attacker movement was not delivered: ${JSON.stringify(attackerResult)}`);
  }
  const attackDown = attackerResult.pointers.find((event) => event.type === "pointerdown" && event.button === 0);
  const attackUp = attackerResult.pointers.find((event) => event.type === "pointerup" && event.button === 0);
  const aimValid = attackDown && Math.abs(attackDown.y - 0.5) <= 0.15 && (attackRight ? attackDown.x >= 0.6 : attackDown.x <= 0.4);
  if (!aimValid || !attackUp || attackUp.t <= attackDown.t || attackUp.t - attackDown.t >= 320) {
    throw new Error(`M240 genuine short-LMB pointerUP or M39 aimed attack missing: ${JSON.stringify(attackerResult)}`);
  }
  if (defenderResult.windupTellMaxPixels < 24 || attackerResult.windupTellMaxPixels !== 0) {
    throw new Error(`M39 remote-only authoritative windup pixel proof changed: ${JSON.stringify(evidence)}`);
  }
  return evidence;
}

async function runOnlineUiHeavyStrikeFlight(entries) {
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const attacker = entries.find((entry) => entry.name === "chrome");
  const defender = entries.find((entry) => entry.name === "firefox");
  const attackerReady = ready.find((entry) => entry.browser === attacker?.name);
  const defenderReady = ready.find((entry) => entry.browser === defender?.name);
  if (!attacker || !defender || !attackerReady || !defenderReady) {
    throw new Error(`could not resolve M106 UI roles from ${JSON.stringify(ready)}`);
  }
  const attackRight = attackerReady.playerNetId < defenderReady.playerNetId;
  const movementKey = attackRight ? "d" : "a";
  const movementCode = attackRight ? "KeyD" : "KeyA";
  const attackOffset = attackRight ? 200 : -200;

  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  const attackerElementId = await resolveArenaElement(attacker, "M106 attacker");
  await Promise.all(entries.map(centerArenaInViewport));
  await pulseMovementKey(attacker, movementKey, 120);
  await aimArena(attacker, attackerElementId, attackOffset);
  await sleep(60);

  await performM110NativeHeldLmb(attacker, attackerElementId, attackOffset);
  await sleep(1100);

  const evidence = await Promise.all(entries.map(readUiEvidence));
  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) {
    throw new Error(`M106 incomplete heavy-strike evidence: ${JSON.stringify(evidence)}`);
  }

  if (!attackerResult.keys.includes(`keydown:${movementCode}`) || !attackerResult.keys.includes(`keyup:${movementCode}`)) {
    throw new Error(`M106 real attacker movement was not delivered: ${JSON.stringify(attackerResult)}`);
  }
  requireM188NativeHeldLmb(attackerResult.pointers, attackRight, "M106");
  if (attackerResult.keys.some(event => event.endsWith(":KeyE"))) throw new Error("M106 retired E cannot produce heavy Combat");
  if (attackerResult.playerHp !== 100 || attackerResult.opponentHp !== 54) {
    throw new Error(`M106 attacker HUD did not render one authoritative 46-damage heavy hit: ${JSON.stringify(attackerResult)}`);
  }
  if (defenderResult.playerHp !== 54 || defenderResult.opponentHp !== 100) {
    throw new Error(`M106 defender HUD did not render one authoritative 46-damage heavy hit: ${JSON.stringify(defenderResult)}`);
  }
  if (!attackerResult.events.includes("Opponent hit - 46 HP.")) {
    throw new Error(`M106 attacker never rendered the 46 HP heavy-hit message: ${JSON.stringify(attackerResult.events)}`);
  }
  if (!defenderResult.events.includes("Hit taken - 46 HP.")) {
    throw new Error(`M106 defender never rendered the 46 HP heavy-damage message: ${JSON.stringify(defenderResult.events)}`);
  }

  const heavyThreat = defenderResult.threatTransitions.some((entry) =>
    entry.visible && (entry.phase === "HEAVY WINDUP" || entry.phase === "HEAVY STRIKE"));
  if (!heavyThreat) {
    throw new Error(`M106 defender never rendered a heavy threat phase: ${JSON.stringify(defenderResult.threatTransitions)}`);
  }
  const heavyRecovery = defenderResult.recoveryTransitions.some((entry) =>
    entry.visible && entry.state === "heavy-attack-recovery"
      && entry.label === "PUNISH" && entry.detail === "Heavy recovery");
  if (!heavyRecovery) {
    throw new Error(`M106 defender never rendered heavy recovery as punishable: ${JSON.stringify(defenderResult.recoveryTransitions)}`);
  }
  if (!attackerResult.events.some((text) => text.startsWith("Heavy strike committed")
    || text.startsWith("Heavy strike active") || text.startsWith("Heavy recovery"))) {
    throw new Error(`M106 attacker never rendered a heavy commitment hint: ${JSON.stringify(attackerResult.events)}`);
  }
  return evidence;
}

async function prepareHeavyCounterplayFlight(
  entries,
  label,
  { attackerName = "chrome", defenderName = "firefox", movementMs = 180,
    nativeBoundedApproach = false, m121Direction = null } = {},
) {
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  // Genuine actor order is authoritative. For M121 alone, bind W3C roles
  // from the observed player IDs instead of assuming Chrome must be #1.
  const nativeRoles = m121Direction === null
    ? null : selectM121NativeRoles(ready, m121Direction);
  const attacker = entries.find((entry) =>
    entry.name === (nativeRoles?.attackerName ?? attackerName));
  const defender = entries.find((entry) =>
    entry.name === (nativeRoles?.defenderName ?? defenderName));
  const attackerReady = ready.find((entry) => entry.browser === attacker?.name);
  const defenderReady = ready.find((entry) => entry.browser === defender?.name);
  if (!attacker || !defender || !attackerReady || !defenderReady) {
    throw new Error(`${label} could not resolve browser roles from ${JSON.stringify(ready)}`);
  }
  const attackRight = attackerReady.playerNetId < defenderReady.playerNetId;
  const movementKey = attackRight ? "d" : "a";
  const movementCode = attackRight ? "KeyD" : "KeyA";
  const attackOffset = attackRight ? 200 : -200;
  const blockOffset = attackRight ? -200 : 200;

  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  const attackerElementId = await resolveArenaElement(attacker, `${label} attacker`);
  const defenderElementId = await resolveArenaElement(defender, `${label} defender`);
  await Promise.all(entries.map(centerArenaInViewport));
  if (nativeBoundedApproach) {
    // M121 independent read-only forensic. Observe original accepted world
    // positions and actual W3C keydown/up durations around ONE unchanged
    // native keyboard transaction, before any combat click is sent.
    const before = await readUiEvidence(attacker);
    await pulseMovementKeyBoundedW3c(attacker, movementKey, movementMs);
    const after = await readUiEvidence(attacker);
    const preActors = before.acceptance?.fighters ?? [];
    const postActors = after.acceptance?.fighters ?? [];
    const ownBefore = preActors.find((entry) => entry.netId === attackerReady.playerNetId);
    const targetBefore = preActors.find((entry) => entry.netId === defenderReady.playerNetId);
    const ownAfter = postActors.find((entry) => entry.netId === attackerReady.playerNetId);
    const targetAfter = postActors.find((entry) => entry.netId === defenderReady.playerNetId);
    const distance = (a, b) => a && b
      ? Math.hypot(b.x - a.x, b.y - a.y) : null;
    const keyEvents = after.keyTransitions.filter((event) => event.code === movementCode);
    const keyDown = keyEvents.filter((event) => event.type === "keydown").at(-1);
    const keyUp = keyEvents.filter((event) => event.type === "keyup").at(-1);
    console.log("M121_NATIVE_APPROACH_WORLD " + JSON.stringify({
      attackerId: attackerReady.playerNetId,
      targetId: defenderReady.playerNetId,
      movementKey: movementCode,
      requestedHoldMs: movementMs,
      observedHoldMs: keyDown && keyUp ? keyUp.t - keyDown.t : null,
      originalKeyEvents: keyEvents.slice(-4),
      serverTickBefore: before.acceptance?.serverTick ?? null,
      serverTickAfter: after.acceptance?.serverTick ?? null,
      ownBefore, targetBefore, ownAfter, targetAfter,
      distanceBefore: distance(ownBefore, targetBefore),
      distanceAfter: distance(ownAfter, targetAfter),
      originalLightReach: COMBAT.attack.reach,
      unchangedCollisionRadius: COMBAT.fighterRadius,
      // Sender samples are exact original 60Hz sendInput payload fields.
      // Do not equate a DOM KeyD event with admitted server movement.
      sampledOriginalV1: (after.acceptance?.m121SentSamples ?? [])
        .filter((sample) => Number.isFinite(before.acceptance?.m121SentSamples?.at(-1)?.clientTick)
          ? sample.clientTick >= before.acceptance.m121SentSamples.at(-1).clientTick
          : true)
        .slice(-64),
    }));
  } else {
    await pulseMovementKey(attacker, movementKey, movementMs);
  }
  await Promise.all([
    aimArena(attacker, attackerElementId, attackOffset),
    aimArena(defender, defenderElementId, blockOffset),
  ]);
  await sleep(60);
  return {
    attacker,
    defender,
    attackerElementId,
    defenderElementId,
    movementCode,
  };
}

function assertHeavyControlDelivered(attackerResult, movementCode, label, pointerAttackRight = movementCode === "KeyD") {
  if (!attackerResult.keys.includes(`keydown:${movementCode}`)
    || !attackerResult.keys.includes(`keyup:${movementCode}`)) {
    throw new Error(`${label} real attacker movement was not delivered: ${JSON.stringify(attackerResult)}`);
  }
  requireM188NativeHeldLmb(attackerResult.pointers, pointerAttackRight, label);
  if (attackerResult.keys.some(event => event.endsWith(":KeyE"))) throw new Error(label + " retired E cannot produce heavy Combat");
}

// M195: three independent native held-LMB and wheel-back ingress calibrations replace
// the one-shot sample that over-delayed post-merge heavy parry.
// Read-only server action transitions prove every clean calibration.
async function calibrateHeavyIngress(
  attacker, defender, attackerElementId, defenderElementId,
  attackOffset, blockOffset,
) {
  const eIngressSamples = [];
  const wheelIngressSamples = [];
  let windupTick = null;
  let blockTick = null;
  await aimArena(attacker, attackerElementId, -attackOffset);
  await sleep(45);
  for (let sample = 0; sample < 3; sample += 1) {
    const before = await readUiEvidence(attacker);
    const offset = before.acceptance?.ownActionTransitions?.length ?? 0;
    const started = Date.now();
    await performM110NativeHeldLmb(attacker, attackerElementId, -attackOffset);
    await sleep(COMBAT.heavyAttack.windupMs + COMBAT.heavyAttack.activeMs
      + COMBAT.heavyAttack.recoveryMs + 210);
    const whiff = await Promise.all([readUiEvidence(attacker), readUiEvidence(defender)]);
    const actions = whiff[0].acceptance?.ownActionTransitions?.slice(offset) ?? [];
    const windup = actions.find(x => x.action === COMBAT_ACTION.heavyAttackWindup);
    const recovered = actions.some(x => x.action === COMBAT_ACTION.idle
      && Number.isFinite(windup?.epochMs) && x.epochMs > windup.epochMs);
    const ingress = windup?.epochMs - started;
    if (!windup || !recovered || !Number.isFinite(ingress)
      || ingress < 0 || ingress > 750
      || whiff.some(x => x.playerHp !== 100 || x.playerGuard !== 100)) {
      throw new Error("M195 genuine heavy whiff calibration failed: "
        + JSON.stringify({ sample, ingress, actions, hp: whiff.map(x => x.playerHp),
          guard: whiff.map(x => x.playerGuard) }));
    }
    eIngressSamples.push(ingress);
    windupTick = windup.serverTick;
  }
  // Genuine isolated wheel inputs occur after full heavy recovery; each
  // 240ms short-block expires before the next wheel or actual exchange.
  for (let sample = 0; sample < 3; sample += 1) {
    const before = await readUiEvidence(defender);
    const offset = before.acceptance?.ownActionTransitions?.length ?? 0;
    const started = Date.now();
    await scrollArenaWheel(defender, defenderElementId, 120, 0);
    await sleep(COMBAT.block.shortBlockMs + 210);
    const after = await Promise.all([readUiEvidence(attacker), readUiEvidence(defender)]);
    const actions = after[1].acceptance?.ownActionTransitions?.slice(offset) ?? [];
    const block = actions.find(x => x.action === COMBAT_ACTION.block);
    const ingress = block?.epochMs - started;
    if (!Number.isFinite(ingress) || ingress < 0 || ingress > 750
      || after.some(x => x.playerHp !== 100 || x.playerGuard !== 100)) {
      throw new Error("M195 genuine wheel calibration failed: "
        + JSON.stringify({ sample, ingress, actions, hp: after.map(x => x.playerHp),
          guard: after.map(x => x.playerGuard) }));
    }
    wheelIngressSamples.push(ingress);
    blockTick = block.serverTick;
  }
  await Promise.all([
    aimArena(attacker, attackerElementId, attackOffset),
    aimArena(defender, defenderElementId, blockOffset),
  ]);
  await sleep(55);
  const median = xs => [...xs].sort((a, b) => a - b)[1];
  const eIngressMs = median(eIngressSamples);
  const wheelIngressMs = median(wheelIngressSamples);
  console.log("M195_REAL_INGRESS_SAMPLES " + JSON.stringify({
    scenario, eIngressSamples, wheelIngressSamples, eIngressMs, wheelIngressMs,
  }));
  return { eIngressMs, wheelIngressMs, eIngressSamples,
    wheelIngressSamples, windupTick, blockTick };
}

// One real Chrome held-LMB gesture and one real Firefox wheel-back remain the entire
// measured exchange. The W3C-native wheel pause compensates for observed
// held-LMB-to-server-windup and wheel-to-server-block latency.
// Any wrong result is still a terminal failure in the block/parry callers.
async function performHeavyCounterplayWindowWheel(
  attacker, defender, attackerElementId, defenderElementId,
  attackOffset, blockOffset, targetAfterWindupMs,
) {
  const calibration = await calibrateHeavyIngress(
    attacker, defender, attackerElementId, defenderElementId,
    attackOffset, blockOffset,
  );
  const before = await Promise.all([readUiEvidence(attacker), readUiEvidence(defender)]);
  const attackActionOffset = before[0].acceptance?.ownActionTransitions?.length ?? 0;
  const defendActionOffset = before[1].acceptance?.ownActionTransitions?.length ?? 0;
  const wheelOffset = before[1].wheels.length;
  // Bound the correction from sampled held-LMB/wheel ingress to avoid
  // path-dependent skew pushing the sole parry wheel past impact.
  const rawSkewMs = calibration.eIngressMs - calibration.wheelIngressMs;
  // A large negative compensation pre-arms heavy parry too early and
  // turns the genuine parry into an ordinary -64 guard block. Use a narrower
  // 25ms bound for parry while preserving the 40ms block-only calibration.
  const skewLimitMs = targetAfterWindupMs >= 240 ? 25 : 40;
  const appliedSkewMs = Math.max(-skewLimitMs, Math.min(skewLimitMs, rawSkewMs));
  const wheelDelayMs = Math.round(targetAfterWindupMs + appliedSkewMs);
  if (wheelDelayMs < 0 || wheelDelayMs > 450) {
    throw new Error("M192 calibrated wheel timing outside admissible W3C pause: "
      + JSON.stringify({ ...calibration, targetAfterWindupMs, wheelDelayMs }));
  }
  console.log("M192_REAL_INGRESS_PLAN " + JSON.stringify({
    scenario, ...calibration, targetAfterWindupMs, rawSkewMs, appliedSkewMs, wheelDelayMs,
  }));
  if (scenario === "uiheavyblock" || scenario === "uiheavyparry") {
    // M223: stage the real wheel from a fresh server-observed heavy windup.
    // Do not predict charging acceptance from W3C ACK or inject synthetic events.
    const logOffset = m201ServerOutput().length;
    const fighterId = before[0].playerNetId;
    const eIssuedAtMs = Date.now();
    const eOutcome = Promise.resolve().then(() =>
      performM110NativeHeldLmb(attacker, attackerElementId, attackOffset)).then(
      () => ({ ok: true }),
      error => ({ ok: false, error }),
    );
    let windup;
    try {
      windup = await awaitM223HeavyWindup({
        readOutput: m201ServerOutput, afterOffset: logOffset,
        fighterId, sleep, timeoutMs: 800,
      });
    } catch (error) {
      const eResult = await eOutcome;
      if (!eResult.ok) throw eResult.error;
      throw error;
    }
    // M223.1: calibration can contain ~100ms wheel-driver outliers while
    // the actual live W3C wheel arrives in ~30ms. Subtracting the outlier
    // schedules block too early, causing its unchanged 240ms timer to expire
    // before impact. Bound ONLY the CI harness delay estimator.
    const m223Plan = planM223WheelDelay({
      targetAfterWindupMs,
      sampledWheelIngressMs: calibration.wheelIngressMs,
    });
    // Combat4B M188: actual original-World protected CI on e1f2f9a
    // still BLOCKED a genuine held-LMB heavy at tick619 after Firefox
    // Block tick611 (8 ticks / 133ms > unchanged 125ms parry window).
    // Exact original World CI e6f5c079: 3/3 real heavy BLOCK, 2/3 real
    // heavy PARRY at contact age 116.7ms. Third parry BLOCK age150.0ms.
    // Stage the SAME one physical W3C parry wheel 30ms later (+110ms
    // total), seeking >=2 World ticks' contact-phase headroom without
    // extending 125ms server parry. For M223 wheelIngress >=65ms, the
    // physical pause stays within unchanged 450ms fixture bound.
    // Keep strict 100HP, full guard, stun and no-fake-HIT assertions;
    // heavy BLOCK 395ms and all original World/balance values unchanged.
    const m188HeldLmbParryOffsetMs = scenario === "uiheavyparry" ? 110 : 0;
    const m223WheelDelayMs = m223Plan.wheelDelayMs + m188HeldLmbParryOffsetMs;
    if (!Number.isSafeInteger(m223WheelDelayMs)
      || m223WheelDelayMs < 0 || m223WheelDelayMs > 450) {
      throw new Error("M188 genuine wheel timing outside bounded native pause");
    }
    const wheelIssuedAtMs = Date.now();
    const [eResult, wheelResult] = await Promise.all([
      eOutcome,
      scrollArenaWheel(defender, defenderElementId, 120, m223WheelDelayMs).then(
        () => ({ ok: true }),
        error => ({ ok: false, error }),
      ),
    ]);
    console.log("M223_SERVER_WINDUP_PLAN " + JSON.stringify({
      scenario, fighterId, serverWindupTick: windup.serverTick,
      observedWindupAfterMs: windup.observedAfterMs,
      eCommandToWheelDispatchMs: wheelIssuedAtMs - eIssuedAtMs,
      wheelIngressCalibrationMs: calibration.wheelIngressMs,
      boundedWheelIngressMs: m223Plan.boundedWheelIngressMs,
      wheelDelayMs: m223WheelDelayMs, targetAfterWindupMs,
      m188HeldLmbParryOffsetMs,
      physicalHeavySource: "held-lmb", requestedHoldMs: M110_LMB_HEAVY_HOLD_MS,
      lmbW3cAck: eResult.ok, wheelW3cAck: wheelResult.ok,
    }));
    if (!eResult.ok) throw eResult.error;
    if (!wheelResult.ok) throw wheelResult.error;
  } else {
    // Preserve legacy scheduling outside strict M188 heavy defense.
    await Promise.all([
      performM110NativeHeldLmb(attacker, attackerElementId, attackOffset),
      scrollArenaWheel(defender, defenderElementId, 120, wheelDelayMs),
    ]);
  }
  const [afterAttack, afterDefend] = await Promise.all([
    readUiEvidence(attacker), readUiEvidence(defender),
  ]);
  if (afterDefend.wheels.length !== wheelOffset + 1) {
    throw new Error("M192 expected exactly one real exchange wheel after calibration: "
      + JSON.stringify(afterDefend.wheels.slice(wheelOffset)));
  }
  const committed = afterAttack.acceptance?.ownActionTransitions?.slice(attackActionOffset)
    .find(entry => entry.action === COMBAT_ACTION.heavyAttackWindup);
  const blocked = afterDefend.acceptance?.ownActionTransitions?.slice(defendActionOffset)
    .find(entry => entry.action === COMBAT_ACTION.block);
  console.log("M192_REAL_INGRESS_OUTCOME " + JSON.stringify({
    scenario,
    committedTick: committed?.serverTick ?? null,
    blockTick: blocked?.serverTick ?? null,
    blockAfterWindupMs: committed && blocked
      ? blocked.epochMs - committed.epochMs : null,
  }));
}

async function runOnlineUiHeavyBlockFlight(entries) {
  // R2 restored heavy reach 130 -> 82 with a physical 24px active lunge.
  // The old 180ms approach left the victim outside the restored 82px arc;
  // the server completed 240ms Block before the late physically lunged hit.
  // A 290ms approach was also insufficient (second native M188 red confirmed
  // the same 46HP contact just after block expiry). Close the FULL 48px
  // difference between old 130 and current 82 reach with genuine 215px/s
  // movement before the exchange, to hit in the early active phase.
  // A genuine two-browser CI trace (M223 windup tick 2635, block tick 2643,
  // heavy hit tick 2660) proved the 155ms lead expires the unchanged 240ms
  // block before contact: block ended at tick 2656 and 46HP leaked.
  // Unified M188 original World evidence at 94797f19: target 255ms yielded
  // block tick 704, expiry tick 719, and 46HP HIT tick 724 (windup tick 691).
  // The block expired five ticks before impact. Shift the same genuine wheel
  // objective 110ms later to 365ms: approximately 13 ticks / 217ms of block
  // lead, within unchanged 125-240ms block-only timing, beyond parry.
  // Recent exact-head 31ea9d3: measured BLOCK tick735 and 46HP HIT tick749
  // (14 World ticks / ~233ms); the guard expired on the impact boundary.
  // Shift only the genuine W3C wheel aim 30ms later to target ~12 ticks
  // (~200ms) before contact: strictly >125ms parry, <240ms block. The
  // original exact -64 guard, HP100, no-parry assertions still decide PASS.
  // This changes only physical test staging, NOT server timing or balance.
  // Keep M223 genuine server-windup timing, exact -64 guard, 100HP and
  // parry/late-block failure gates unchanged.
  const staged = await prepareHeavyCounterplayFlight(
    entries, "M107 heavy block", { movementMs: 400 },
  );
  const { attacker, defender, attackerElementId, defenderElementId, movementCode } = staged;
  const attackRight = movementCode === "KeyD";
  const attackOffset = attackRight ? 200 : -200;
  const blockOffset = attackRight ? -200 : 200;
  let evidence = null;
  let lastObserved = null;

  // Browser action edges can occasionally miss the real input latch even though
  // WebDriver delivered the key. Retry only when the authoritative exchange is
  // completely unresolved: pristine HP/guard and no parry feedback. Any resolved
  // or partially resolved exchange fails closed instead of being retried.
  for (let attempt = 1; attempt <= 3 && !evidence; attempt += 1) {
    // Calibrate genuine browser delivery before committing real held-LMB + wheel.
    // Aim for a short block at heavy impact, outside the 125ms parry interval.
    // A parry, missed block, or HP leak remains a terminal CI failure.
    await performHeavyCounterplayWindowWheel(
      attacker, defender, attackerElementId, defenderElementId,
      attackOffset, blockOffset, 395,
    );
    await sleep(470);

    lastObserved = await Promise.all(entries.map(readUiEvidence));
    const attackerResult = lastObserved.find((entry) => entry.browser === attacker.name);
    const defenderResult = lastObserved.find((entry) => entry.browser === defender.name);
    if (!attackerResult || !defenderResult) {
      throw new Error(`M107 heavy block incomplete evidence on attempt ${attempt}: ${JSON.stringify(lastObserved)}`);
    }

    const blockPressureObserved = attackerResult.events.includes("Opponent blocked - guard -64.")
      && defenderResult.events.includes("Block held - guard -64.");
    const attackerReplicaGuardInWindow = attackerResult.opponentGuard >= 36
      && attackerResult.opponentGuard <= 40;
    const defenderGuardInWindow = defenderResult.playerGuard >= 36
      && defenderResult.playerGuard <= 40;
    const resolvedBlock = attackerResult.playerHp === 100 && attackerResult.playerGuard === 100
      && attackerResult.opponentHp === 100
      && defenderResult.playerHp === 100
      && blockPressureObserved
      && attackerReplicaGuardInWindow
      && defenderGuardInWindow;
    if (resolvedBlock) {
      evidence = lastObserved;
      break;
    }

    const cleanMiss = attackerResult.playerHp === 100 && attackerResult.playerGuard === 100
      && attackerResult.opponentHp === 100 && attackerResult.opponentGuard === 100
      && defenderResult.playerHp === 100 && defenderResult.playerGuard === 100
      && !attackerResult.feedbackTransitions.includes("parried")
      && !defenderResult.feedbackTransitions.includes("parry-success");
    if (!cleanMiss) {
      throw new Error(`M107 heavy block attempt ${attempt} resolved unexpectedly: ${JSON.stringify(lastObserved)}`);
    }
    if (attempt < 3) {
      // A delivered-but-unresolved heavy may still be in recovery. Let the full
      // commitment settle, then restore exact aim before the next genuine edge.
      await sleep(380);
      await Promise.all([
        aimArena(attacker, attackerElementId, attackOffset),
        aimArena(defender, defenderElementId, blockOffset),
      ]);
      await sleep(40);
    }
  }

  if (!evidence) {
    throw new Error(`M107 heavy block did not resolve after bounded clean retries: ${JSON.stringify(lastObserved)}`);
  }
  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  assertHeavyControlDelivered(attackerResult, movementCode, "M107 heavy block");
  const blockWheel = defenderResult.wheels.find((event) => event.deltaY > 0);
  if (!blockWheel) {
    throw new Error(`M107 heavy block real wheel-back block/parry control was not delivered: ${JSON.stringify(defenderResult)}`);
  }
  if (!attackerResult.events.includes("Opponent blocked - guard -64.")
    || !defenderResult.events.includes("Block held - guard -64.")) {
    throw new Error(`M107 heavy block feedback was not authoritative 64 guard pressure: ${JSON.stringify(evidence)}`);
  }
  if (attackerResult.feedbackTransitions.includes("parried")
    || defenderResult.feedbackTransitions.includes("parry-success")) {
    throw new Error(`M107 heavy block accidentally resolved as parry: ${JSON.stringify(evidence)}`);
  }
  return evidence;
}

async function runOnlineUiHeavyParryFlight(entries) {
  // Parry likewise needs the target within restored 82px impact reach at the
  // *start* of heavy active; do not silently compensate via old 130px radius.
  const staged = await prepareHeavyCounterplayFlight(
    entries, "M107 heavy parry", { movementMs: 400 },
  );
  const { attacker, defender, attackerElementId, defenderElementId, movementCode } = staged;
  const attackRight = movementCode === "KeyD";
  const attackOffset = attackRight ? 200 : -200;
  const blockOffset = attackRight ? -200 : 200;
  let evidence = null;
  let lastObserved = null;

  // As with the heavy-block flight, WebDriver can deliver the native edge while the
  // browser input latch misses the outbound sample. Retry only that completely
  // pristine case. Any evidence that a heavy actually committed, hit, blocked,
  // or otherwise resolved makes the attempt terminal and therefore fail-closed.
  for (let attempt = 1; attempt <= 3 && !evidence; attempt += 1) {
    // Restored 82px heavy reach moves actual contact to the lunge's late
    // active phase. Genuine CI: windup tick 590, wheel block tick 605, hit
    // tick 615 = 167ms block-to-contact, outside the unchanged 125ms parry.
    // On exact-head native CI the 365ms lead still resolved as guard:
    // windup tick 522, block tick 540, 46HP hit replaced by an authoritative
    // BLOCK tick 547. Seven ticks (about 117ms) straddle the strict 125ms
    // parry edge due to server input/impact phase. Move the genuine wheel
    // dispatch 40ms later toward a five-tick parry gap. Keep authentic
    // server-confirmed stun, zero HP/guard change, and all failure gates.
    await performHeavyCounterplayWindowWheel(
      attacker, defender, attackerElementId, defenderElementId,
      attackOffset, blockOffset, 405,
    );
    await sleep(220);

    lastObserved = await Promise.all(entries.map(readUiEvidence));
    const attackerResult = lastObserved.find((entry) => entry.browser === attacker.name);
    const defenderResult = lastObserved.find((entry) => entry.browser === defender.name);
    if (!attackerResult || !defenderResult) {
      throw new Error(`M107 heavy parry incomplete evidence on attempt ${attempt}: ${JSON.stringify(lastObserved)}`);
    }

    const resolvedParry = attackerResult.playerHp === 100 && attackerResult.playerGuard === 100
      && defenderResult.playerHp === 100 && defenderResult.playerGuard === 100
      && attackerResult.feedbackTransitions.includes("parried")
      && defenderResult.feedbackTransitions.includes("parry-success");
    if (resolvedParry) {
      evidence = lastObserved;
      break;
    }

    const heavyCommitted = attackerResult.events.some((text) =>
      text.startsWith("Heavy strike committed") || text.startsWith("Heavy strike active")
        || text.startsWith("Heavy recovery"))
      || defenderResult.threatTransitions.some((entry) =>
        entry.visible && (entry.phase === "HEAVY WINDUP" || entry.phase === "HEAVY STRIKE"))
      || defenderResult.recoveryTransitions.some((entry) =>
        entry.visible && entry.state === "heavy-attack-recovery");
    const cleanLatchMiss = attackerResult.playerHp === 100 && attackerResult.playerGuard === 100
      && attackerResult.opponentHp === 100 && attackerResult.opponentGuard === 100
      && defenderResult.playerHp === 100 && defenderResult.playerGuard === 100
      && !heavyCommitted
      && !attackerResult.feedbackTransitions.includes("parried")
      && !defenderResult.feedbackTransitions.includes("parry-success");
    if (!cleanLatchMiss) {
      throw new Error(`M107 heavy parry attempt ${attempt} resolved unexpectedly: ${JSON.stringify(lastObserved)}`);
    }
    if (attempt < 3) {
      await sleep(380);
      await Promise.all([
        aimArena(attacker, attackerElementId, attackOffset),
        aimArena(defender, defenderElementId, blockOffset),
      ]);
      await sleep(40);
    }
  }

  if (!evidence) {
    throw new Error(`M107 heavy parry did not resolve after bounded clean latch retries: ${JSON.stringify(lastObserved)}`);
  }
  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  assertHeavyControlDelivered(attackerResult, movementCode, "M107 heavy parry");
  const blockWheel = defenderResult.wheels.find((event) => event.deltaY > 0);
  if (!blockWheel) {
    throw new Error(`M107 heavy parry real wheel-back block/parry control was not delivered: ${JSON.stringify(defenderResult)}`);
  }
  if (attackerResult.playerHp !== 100 || attackerResult.playerGuard !== 100
    || defenderResult.playerHp !== 100 || defenderResult.playerGuard !== 100) {
    throw new Error(`M107 heavy parry changed authoritative vitals: ${JSON.stringify(evidence)}`);
  }
  const stunned = attackerResult.overlayTransitions.some((entry) =>
    entry.visible && entry.title === "STUNNED");
  if (!stunned) {
    throw new Error(`M107 heavy parry never exposed attacker stun: ${JSON.stringify(attackerResult.overlayTransitions)}`);
  }
  return evidence;
}
async function runOnlineUiHeavyDodgeFlight(entries) {
  // Match the M36 browser roles but preserve enough starting separation that
  // the Wilds roll does not immediately trigger its own collision knockdown.
  const staged = await prepareHeavyCounterplayFlight(
    entries,
    "M107 heavy dodge",
    // Preserve heavy-strike reach while retaining roll collision clearance:
    // the old 200 ms approach occasionally put the fighters into the roll's
    // authoritative collision radius before the perpendicular dodge began.
    { attackerName: "firefox", defenderName: "chrome", movementMs: 120 },
  );
  const { attacker, defender, attackerElementId, defenderElementId, movementCode } = staged;
  const attackOffset = movementCode === "KeyD" ? 200 : -200;

  let committedObserved = false;
  let lastCommitEvidence = null;
  for (let attempt = 1; attempt <= 3 && !committedObserved; attempt += 1) {
    const before = await Promise.all(entries.map(readUiEvidence));
    const beforeAttacker = before.find((entry) => entry.browser === attacker.name);
    // M204: server-confirm the exact FIRST heavy windup before the sole
    // genuine Chrome wheel. R2's 130-unit reach proved static host sleeps
    // unreliable (#39213856621: wheel too late, #39215007573: wheel early).
    // The loopback-only M201_ACTION proof binds this to the authoritative
    // fighter and 60Hz tick; never infer commitment from a WebDriver ACK.
    const serverLogOffset = m201ServerOutput().length;
    const lmbOutcome = performM110NativeHeldLmb(attacker, attackerElementId, attackOffset).then(
      () => ({ ok: true }), error => ({ ok: false, error }),
    );
    let dodgeError = null;
    try {
      let windup;
      try {
        windup = await awaitM223HeavyWindup({
          readOutput: m201ServerOutput, afterOffset: serverLogOffset,
          fighterId: beforeAttacker.playerNetId, sleep, timeoutMs: 550,
        });
      } catch (error) {
        const delivered = await lmbOutcome;
        if (!delivered.ok) throw delivered.error;
        throw error;
      }
      const windupObservedEpochMs = Date.now();
      committedObserved = true;
      // Shift the native choreography by the extra physical charging hold,
      // not the server's125ms iframe or320ms READY rule. Keep the original
      //170ms perpendicular movement lead by waiting before KeyS begins.
      const releaseHoldShiftMs = M110_LMB_HEAVY_HOLD_MS - COMBAT.heavyAttack.windupMs;
      const wheelTargetEpochMs = windupObservedEpochMs + 170 + releaseHoldShiftMs;
      await sleep(releaseHoldShiftMs);
      await setMovementKey(defender, "s", true);
      try {
        const remainingMs = wheelTargetEpochMs - Date.now();
        if (remainingMs > 0) await sleep(remainingMs);
        const wheelIssuedEpochMs = Date.now();
        await performArenaTimedPointerDodge(defender, defenderElementId, 15);
        console.log("M204_SERVER_WINDUP_NATIVE_DODGE " + JSON.stringify({
          fighterId: beforeAttacker.playerNetId, serverWindupTick: windup.serverTick,
          windupObservedAfterMs: windup.observedAfterMs,
          plannedAfterWindupMs: 170 + releaseHoldShiftMs,
          wheelIssuedAfterObservedMs: wheelIssuedEpochMs - windupObservedEpochMs,
        }));
      } finally {
        await setMovementKey(defender, "s", false);
      }
    } catch (error) {
      dodgeError = error;
      throw error;
    } finally {
      const delivered = await lmbOutcome;
      if (!delivered.ok) {
        if (dodgeError && dodgeError !== delivered.error) throw new AggregateError([dodgeError, delivered.error], "native dodge and held-LMB commands failed");
        throw delivered.error;
      }
    }
    if (committedObserved) break;

    lastCommitEvidence = await Promise.all(entries.map(readUiEvidence));
    const attackerState = lastCommitEvidence.find((entry) => entry.browser === attacker.name);
    const defenderState = lastCommitEvidence.find((entry) => entry.browser === defender.name);
    if (!attackerState || !defenderState) {
      throw new Error(`M107 heavy dodge incomplete latch evidence on attempt ${attempt}: ${JSON.stringify(lastCommitEvidence)}`);
    }
    const heavyCommitted = attackerState.events.some((text) =>
      text.startsWith("Heavy strike committed") || text.startsWith("Heavy strike active")
        || text.startsWith("Heavy recovery"))
      || defenderState.threatTransitions.some((entry) =>
        entry.visible && (entry.phase === "HEAVY WINDUP" || entry.phase === "HEAVY STRIKE"))
      || defenderState.recoveryTransitions.some((entry) =>
        entry.visible && entry.state === "heavy-attack-recovery");
    const cleanLatchMiss = attackerState.playerHp === 100 && attackerState.playerGuard === 100
      && attackerState.opponentHp === 100 && attackerState.opponentGuard === 100
      && defenderState.playerHp === 100 && defenderState.playerGuard === 100
      && !heavyCommitted;
    if (!cleanLatchMiss) {
      throw new Error(`M107 heavy dodge attempt ${attempt} resolved unexpectedly before dodge: ${JSON.stringify(lastCommitEvidence)}`);
    }
    if (attempt < 3) await sleep(900);
  }
  if (!committedObserved) {
    throw new Error(`M107 heavy dodge did not latch after bounded clean retries: ${JSON.stringify(lastCommitEvidence)}`);
  }

  // M204 issued exactly one genuine Chrome pointer-owned wheel and S control
  // before Firefox's physical LMB release, while the heavy was charging.
  // Let authoritative active/recovery settle without polling inside iframe.
  await sleep(360);

  const evidence = await Promise.all(entries.map(readUiEvidence));
  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) {
    throw new Error(`M107 heavy dodge incomplete evidence: ${JSON.stringify(evidence)}`);
  }
  assertHeavyControlDelivered(attackerResult, movementCode, "M107 heavy dodge");
  const rollWheel = defenderResult.wheels.find((event) => event.deltaY < 0);
  if (!defenderResult.keys.includes("keydown:KeyS") || !defenderResult.keys.includes("keyup:KeyS")
    || !rollWheel) {
    throw new Error(`M107 heavy dodge real wheel-forward/perpendicular controls were not delivered: ${JSON.stringify(defenderResult)}`);
  }
  if (attackerResult.playerHp !== 100 || attackerResult.playerGuard !== 100
    || defenderResult.playerHp !== 100 || defenderResult.playerGuard !== 100) {
    throw new Error(`M107 heavy dodge changed authoritative vitals: ${JSON.stringify(evidence)}`);
  }
  if (!attackerResult.feedbackTransitions.includes("dodge-evaded")
    || !defenderResult.feedbackTransitions.includes("dodge-success")) {
    throw new Error(`M107 heavy dodge feedback never resolved: ${JSON.stringify(evidence)}`);
  }
  if (attackerResult.feedbackTransitions.includes("parried")
    || defenderResult.feedbackTransitions.includes("parry-success")) {
    throw new Error(`M107 heavy dodge accidentally resolved as parry: ${JSON.stringify(evidence)}`);
  }
  return evidence;
}

async function runOnlineUiDirectionalLightFlight(entries) {
  const requestedDirection = process.env.MYASO_M121_DIRECTION ?? "right";
  const staged = await prepareHeavyCounterplayFlight(
    entries,
    "M121 directional light",
    { movementMs: 150, nativeBoundedApproach: true,
      m121Direction: requestedDirection },
  );
  const { attacker, defender, attackerElementId, movementCode } = staged;
  const attackRight = movementCode === "KeyD";
  // In screen-space coordinates, left of a right-facing fighter is W/up; left
  // of a left-facing fighter is S/down. Strictly fail if actual observed
  // server-assigned roles do not match this trial's demanded direction.
  const strafeKey = attackRight ? "w" : "s";
  const strafeCode = attackRight ? "KeyW" : "KeyS";
  const attackOffset = attackRight ? 200 : -200;
  if (attackRight !== (requestedDirection === "right")
    || strafeCode !== (requestedDirection === "left" ? "KeyS" : "KeyW")) {
    throw new Error("M121 native requested direction disagrees with actual actor geometry");
  }
  console.log("M121_NATIVE_DIRECTION_REQUIREMENT " + JSON.stringify({
    requestedDirection, attacker: attacker.name, defender: defender.name,
    movementCode, strafeCode, attackRight,
  }));

  const { planM121NativeGeometry } = await import("./m121-native-geometry-plan.mjs");
  // The original fixed approach can leave a real 94.15px separation, beyond
  // unchanged 76+18px light reach. Qualify actual replicas before the genuine
  // directional chord, with room for its later ~20px lateral displacement.
  const readM121Geometry = async () => {
    const state = await readUiEvidence(attacker);
    if (state.playerHp !== 100 || state.opponentHp !== 100
        || state.playerGuard !== 100 || state.opponentGuard !== 100) {
      throw new Error("M121 pre-strike native staging changed actual HP or guard: " + JSON.stringify(state));
    }
    const ownId = state.playerNetId;
    const fighters = state.acceptance?.fighters ?? [];
    const own = fighters.find(f => f.netId === ownId);
    const target = fighters.find(f => f.netId !== ownId);
    if (fighters.length !== 2 || !own || !target || !Number.isFinite(state.acceptance?.serverTick)) {
      throw new Error("M121 missing two real authoritative staging replicas: " + JSON.stringify(state.acceptance));
    }
    return { own, target, serverTick: state.acceptance.serverTick };
  };
  let geometryReady = false;
  const nativeGeometry = [];
  await sleep(310); // separate additional physical WASD from the original approach's double-tap window
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const before = await readM121Geometry();
    const plan = planM121NativeGeometry(before.own, before.target, attackRight);
    if (!plan) {
      await sleep(110);
      const stable = await readM121Geometry();
      if (isTickNewer32(stable.serverTick, before.serverTick)
          && Math.hypot(stable.own.x - before.own.x, stable.own.y - before.own.y) <= 2
          && Math.hypot(stable.target.x - before.target.x, stable.target.y - before.target.y) <= 2
          && !planM121NativeGeometry(stable.own, stable.target, attackRight)) {
        nativeGeometry.push({ before, stable, qualified: true });
        geometryReady = true;
        break;
      }
      nativeGeometry.push({ before, stable, qualified: false });
    } else {
      await pulseMovementKeyBoundedW3c(attacker, plan.key, plan.durationMs);
      await sleep(310); // native pulses must not accidentally request directional dash
      const after = await readM121Geometry();
      nativeGeometry.push({ before, requestedNativePulse: plan, after });
    }
  }
  console.log("M121_NATIVE_INTERIOR_GEOMETRY " + JSON.stringify({ attackRight, nativeGeometry }));
  if (!geometryReady) throw new Error("M121 actual replica geometry did not converge before the single directional light");

  await performArenaDirectionalLight(attacker, attackerElementId, strafeKey, attackOffset);

  const deadline = Date.now() + 900;
  let evidence = null;
  while (Date.now() < deadline) {
    const current = await Promise.all(entries.map(readUiEvidence));
    const attackerResult = current.find((entry) => entry.browser === attacker.name);
    const defenderResult = current.find((entry) => entry.browser === defender.name);
    const hit = attackerResult?.events.includes("Opponent hit - 34 HP.")
      && defenderResult?.events.includes("Hit taken - 34 HP.")
      && attackerResult?.opponentHp === 66
      && defenderResult?.playerHp === 66;
    const sideThreat = defenderResult?.threatTransitions.some((entry) =>
      entry.visible && (entry.phase === "LEFT WINDUP" || entry.phase === "LEFT SWEEP"));
    const recovery = defenderResult?.recoveryTransitions.some((entry) =>
      entry.visible
      && entry.state === "directional-attack-recovery"
      && entry.label === "PUNISH"
      && entry.detail === "Sweep recovery");
    if (hit && sideThreat && recovery) {
      evidence = current;
      break;
    }
    await sleep(20);
  }
  if (!evidence) evidence = await Promise.all(entries.map(readUiEvidence));

  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) {
    throw new Error(`M121 directional light incomplete evidence: ${JSON.stringify(evidence)}`);
  }
  // This chronology is recorded BEFORE untouched strict HP / LEFT SWEEP
  // checks, even when genuine attack hits in the wrong directional phase.
  console.log("M121_ACTUAL_SENDER_WORLD_CHRONOLOGY " + JSON.stringify({
    attacker: attackerResult.playerNetId,
    defender: defenderResult.playerNetId,
    physical: { keys: attackerResult.keyTransitions, pointers: attackerResult.pointers },
    actualSent: (attackerResult.acceptance?.m121SentSamples ?? [])
      .filter((sample) => sample.moveX || sample.moveY || sample.attack || sample.heavyAttack)
      .slice(-64),
    attackerWorld: attackerResult.acceptance?.ownActionTransitions?.slice(-12) ?? [],
    defenderWorldView: defenderResult.acceptance?.focusActionTransitions?.slice(-12) ?? [],
    defenderThreat: defenderResult.threatTransitions.slice(-12),
    defenderRecovery: defenderResult.recoveryTransitions.slice(-12),
    serverInputAcceptance: m201ServerOutput().split(/\r?\n/)
      .filter((line) => line.startsWith("M121_V1_SERVER_INPUT ")
        && line.includes(` actor=${attackerResult.playerNetId} `))
      .slice(-96),
    serverWorldActionEvents: m201ServerOutput().split(/\r?\n/)
      .filter((line) => line.startsWith("M201_AUTH_ACTION ")
        && line.includes(` fighter=${attackerResult.playerNetId} `))
      .slice(-32),
    hp: { attacker: attackerResult.playerHp, victim: defenderResult.playerHp },
  }));

  // Combat 4A: a genuine short physical LMB can reach the 60Hz sender
  // but be absent from the original authenticated v1 accepted batch.
  // Diagnostic only: never replay a click or treat transport acceptance as HIT.
  const releaseSentTicks = (attackerResult.acceptance?.m121SentSamples ?? [])
    .filter((sample) => sample.attack && !sample.heavyAttack)
    .map((sample) => sample.clientTick);
  const releaseAdmittedTicks = m201ServerOutput().split(/\r?\n/)
    .filter((line) => line.startsWith("M121_V1_SERVER_INPUT ")
      && line.includes(` actor=${attackerResult.playerNetId} `))
    .flatMap((line) => {
      const accepted = line.match(/accepted=\[([^\]]*)\]/)?.[1] ?? "";
      return [...accepted.matchAll(/(?:^|,)(\d+):1:0:/g)]
        .map((match) => Number(match[1]));
    });
  if (releaseSentTicks.length
      && !releaseSentTicks.some((tick) => releaseAdmittedTicks.includes(tick))) {
    console.error("M121_ORIGINAL_V1_SHORT_RELEASE_INGRESS_GAP " + JSON.stringify({
      actor: attackerResult.playerNetId,
      releaseClientTicks: releaseSentTicks,
      acceptedReleaseClientTicks: releaseAdmittedTicks,
      physicalLmbEvents: attackerResult.pointers.filter((event) => event.button === 0),
      originalWorldActions: attackerResult.acceptance?.ownActionTransitions?.slice(-10) ?? [],
    }));
  }

  const lightDown = attackerResult.pointers.find((event) =>
    event.type === "pointerdown" && event.button === 0);
  const lightUp = attackerResult.pointers.find((event) =>
    event.type === "pointerup" && event.button === 0);
  if (!lightDown || !lightUp
    || !attackerResult.keys.includes(`keydown:${strafeCode}`)
    || !attackerResult.keys.includes(`keyup:${strafeCode}`)) {
    throw new Error(`M121 real strafe + LMB controls were not delivered: ${JSON.stringify(attackerResult)}`);
  }
  if (attackerResult.playerHp !== 100 || attackerResult.playerGuard !== 100
    || attackerResult.opponentHp !== 66
    || defenderResult.playerHp !== 66 || defenderResult.playerGuard !== 100) {
    throw new Error(`M121 directional light did not resolve as one 34 HP hit: ${JSON.stringify(evidence)}`);
  }
  if (!attackerResult.events.includes("Opponent hit - 34 HP.")
    || !defenderResult.events.includes("Hit taken - 34 HP.")) {
    throw new Error(`M121 directional light damage feedback was incomplete: ${JSON.stringify(evidence)}`);
  }
  const leftThreat = defenderResult.threatTransitions.some((entry) =>
    entry.visible && (entry.phase === "LEFT WINDUP" || entry.phase === "LEFT SWEEP"));
  const sweepRecovery = defenderResult.recoveryTransitions.some((entry) =>
    entry.visible && entry.state === "directional-attack-recovery"
      && entry.label === "PUNISH" && entry.detail === "Sweep recovery");
  if (!leftThreat || !sweepRecovery) {
    throw new Error(`M121 left-sweep readability was incomplete: ${JSON.stringify(defenderResult)}`);
  }
  if (!attackerResult.events.some((text) =>
    text.startsWith("Left sweep committed")
    || text.startsWith("Left sweep active")
    || text.startsWith("Left sweep recovery"))) {
    throw new Error(`M121 attacker never rendered left-sweep commitment: ${JSON.stringify(attackerResult.events)}`);
  }
  return evidence;
}


async function runOnlineUiAuthoritativeStaminaFlight(entries) {
  const milestone = "M164 authoritative stamina browser";
  if (entries.length !== 2) {
    throw new Error(milestone + " expected two real browser clients, received " + entries.length);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const actor = entries.find((entry) => entry.name === "chrome");
  const peer = entries.find((entry) => entry.name === "firefox");
  const actorReady = ready.find((entry) => entry.browser === actor?.name);
  const peerReady = ready.find((entry) => entry.browser === peer?.name);
  if (!actor || !peer || !actorReady || !peerReady) {
    throw new Error(milestone + " could not resolve deterministic browser roles: " + JSON.stringify(ready));
  }

  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  await Promise.all(entries.map(centerArenaInViewport));

  const actorElementId = await resolveArenaElement(actor, milestone + " actor");
  const actorId = actorReady.playerNetId;
  const peerId = peerReady.playerNetId;
  const awayOffset = actorId < peerId ? -200 : 200;
  const awayKey = actorId < peerId ? "a" : "d";
  await aimArena(actor, actorElementId, awayOffset);
  await sleep(40);

  const staminaMatchesHud = (state, expected = null) => {
    const authoritative = state?.acceptance?.authoritativeStamina;
    if (!Number.isFinite(authoritative) || !Number.isFinite(state?.playerStamina)) return false;
    if (Math.round(authoritative) !== state.playerStamina) return false;
    return expected === null || Math.round(authoritative) === expected;
  };

  const waitForStamina = async (predicate, timeoutMs, label) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const state = await readUiEvidence(actor);
      if (predicate(state)) return state;
      await sleep(12);
    }
    throw new Error(milestone + " timed out waiting for " + label + ": "
      + JSON.stringify(await readUiEvidence(actor)));
  };

  const assertCleanVitals = async (label) => {
    const states = await Promise.all(entries.map(readUiEvidence));
    for (const state of states) {
      if (state.playerHp !== 100 || state.playerGuard !== 100) {
        throw new Error(milestone + " " + label + " changed health/guard: " + JSON.stringify(states));
      }
    }
    return states;
  };

  const baseline = await waitForStamina(
    (state) => staminaMatchesHud(state, 100)
      && state.acceptance?.scenario === "uistaminaauth",
    1800,
    "authoritative full stamina baseline",
  );
  const baselineStaminaOffset = baseline.acceptance.staminaTransitions.length;
  const baselineActionOffset = baseline.acceptance.ownActionTransitions.length;
  const baselineWheelOffset = baseline.wheels.length;

  // One genuine wheel-forward roll away from the peer. The server cost is an
  // exact 28, so the owner snapshot and visible HUD must both settle at 72.
  await scrollArenaWheel(actor, actorElementId, -120, 0);
  const rollState = await waitForStamina(
    (state) => {
      const staminaTransitions = state.acceptance?.staminaTransitions?.slice(baselineStaminaOffset) ?? [];
      const actionTransitions = state.acceptance?.ownActionTransitions?.slice(baselineActionOffset) ?? [];
      return staminaMatchesHud(state, 72)
        && staminaTransitions.some((entry) => entry.stamina === 72 && Number.isFinite(entry.serverTick))
        && actionTransitions.some((entry) => entry.action === COMBAT_ACTION.dodge && Number.isFinite(entry.serverTick));
    },
    1000,
    "28-point authoritative roll cost",
  );
  const rollWheels = rollState.wheels.slice(baselineWheelOffset).filter((entry) => entry.deltaY < 0);
  if (rollWheels.length !== 1 || !Number.isFinite(rollWheels[0]?.epochMs)) {
    throw new Error(milestone + " did not deliver exactly one genuine wheel-forward roll: "
      + JSON.stringify(rollState.wheels.slice(baselineWheelOffset)));
  }
  await assertCleanVitals("roll stamina proof");

  const rollRecovered = await waitForStamina(
    (state) => staminaMatchesHud(state, 100)
      && state.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle,
    2400,
    "post-roll authoritative regeneration",
  );
  const kickStaminaOffset = rollRecovered.acceptance.staminaTransitions.length;
  const kickActionOffset = rollRecovered.acceptance.ownActionTransitions.length;
  const kickPointerOffset = rollRecovered.pointers.length;

  // Short RMB remains a genuine kick because it is held below the 180 ms run
  // threshold. The exact server stamina cost is 18, so 100 -> 82.
  await performArenaRecoveryBufferedKick(actor, actorElementId, awayOffset, 45);
  const kickState = await waitForStamina(
    (state) => {
      const staminaTransitions = state.acceptance?.staminaTransitions?.slice(kickStaminaOffset) ?? [];
      const actionTransitions = state.acceptance?.ownActionTransitions?.slice(kickActionOffset) ?? [];
      return staminaMatchesHud(state, 82)
        && staminaTransitions.some((entry) => entry.stamina === 82 && Number.isFinite(entry.serverTick))
        && actionTransitions.some((entry) => entry.action === COMBAT_ACTION.kickWindup && Number.isFinite(entry.serverTick));
    },
    1000,
    "18-point authoritative kick cost",
  );
  const kickPointers = kickState.pointers.slice(kickPointerOffset);
  const rightDown = kickPointers.find((entry) => entry.type === "pointerdown" && entry.button === 2);
  const rightUp = kickPointers.find((entry) => entry.type === "pointerup" && entry.button === 2);
  if (!rightDown || !rightUp
    || !Number.isFinite(rightDown.epochMs) || !Number.isFinite(rightUp.epochMs)
    || rightUp.epochMs <= rightDown.epochMs
    || rightUp.epochMs - rightDown.epochMs >= 180) {
    throw new Error(milestone + " kick cost lacked genuine short-RMB provenance: "
      + JSON.stringify(kickPointers));
  }
  await assertCleanVitals("kick stamina proof");

  const kickRecovered = await waitForStamina(
    (state) => staminaMatchesHud(state, 100)
      && state.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle,
    2400,
    "post-kick authoritative regeneration",
  );
  const runStaminaOffset = kickRecovered.acceptance.staminaTransitions.length;
  const runKeyOffset = kickRecovered.keyTransitions.length;
  const runPointerOffset = kickRecovered.pointers.length;

  // Hold RMB past the production threshold while genuinely moving away from
  // the peer. Run drain is continuous (24/sec), so prove a substantial server
  // decrease rather than depending on one exact scheduler duration.
  await performArenaRunHold(actor, actorElementId, awayKey, awayOffset, 900);
  const runState = await waitForStamina(
    (state) => {
      const transitions = state.acceptance?.staminaTransitions?.slice(runStaminaOffset) ?? [];
      const minimum = transitions.reduce(
        (value, entry) => Number.isFinite(entry.stamina) ? Math.min(value, entry.stamina) : value,
        100,
      );
      return Number.isFinite(state.acceptance?.authoritativeStamina)
        && state.playerStamina === Math.round(state.acceptance.authoritativeStamina)
        && minimum <= 90
        && state.acceptance.authoritativeStamina <= 92;
    },
    800,
    "continuous authoritative run drain",
  );

  const runPointers = runState.pointers.slice(runPointerOffset);
  const runKeys = runState.keyTransitions.slice(runKeyOffset);
  const runDown = runPointers.find((entry) => entry.type === "pointerdown" && entry.button === 2);
  const runUp = runPointers.find((entry) => entry.type === "pointerup" && entry.button === 2);
  const moveDown = runKeys.find((entry) => entry.type === "keydown"
    && (entry.code === "KeyA" || entry.code === "KeyD"));
  const moveUp = runKeys.find((entry) => entry.type === "keyup"
    && (entry.code === "KeyA" || entry.code === "KeyD"));
  if (!runDown || !runUp || !moveDown || !moveUp
    || !Number.isFinite(runDown.epochMs) || !Number.isFinite(runUp.epochMs)
    || runUp.epochMs - runDown.epochMs < 700
    || runUp.epochMs - runDown.epochMs > 1150) {
    throw new Error(milestone + " run drain lacked genuine held-RMB movement provenance: "
      + JSON.stringify({ runPointers, runKeys }));
  }
  const runActions = runState.acceptance?.ownActionTransitions?.slice(kickRecovered.acceptance.ownActionTransitions.length) ?? [];
  if (runActions.some((entry) =>
    entry.action === COMBAT_ACTION.kickWindup
    || entry.action === COMBAT_ACTION.kickActive
    || entry.action === COMBAT_ACTION.kickRecovery)) {
    throw new Error(milestone + " held RMB accidentally resolved as a kick: " + JSON.stringify(runActions));
  }
  await assertCleanVitals("run stamina proof");

  const finalState = await waitForStamina(
    (state) => staminaMatchesHud(state, 100),
    2400,
    "authoritative stamina regeneration back to full",
  );
  const finalStates = await assertCleanVitals("final stamina proof");

  return finalStates.map((entry) => ({
    ...entry,
    m164ActorId: actorId,
    m164PeerId: peerId,
    m164RollStamina: rollState.acceptance?.staminaTransitions
      ?.slice(baselineStaminaOffset)
      ?.find((item) => item.stamina === 72)?.stamina ?? null,
    m164KickStamina: kickState.acceptance?.staminaTransitions
      ?.slice(kickStaminaOffset)
      ?.find((item) => item.stamina === 82)?.stamina ?? null,
    m164RunMinimumStamina: runState.acceptance?.staminaTransitions
      ?.slice(runStaminaOffset)
      ?.reduce((value, item) => Number.isFinite(item.stamina) ? Math.min(value, item.stamina) : value, 100) ?? null,
    m164FinalStamina: entry.browser === actor.name ? finalState.acceptance?.authoritativeStamina ?? null : null,
  }));
}

async function runOnlineUiStaminaExhaustionFlight(entries) {
  const milestone = "M165 authoritative stamina exhaustion";
  if (entries.length !== 2) {
    throw new Error(milestone + " expected two real browser clients, received " + entries.length);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const actor = entries.find((entry) => entry.name === "chrome");
  const peer = entries.find((entry) => entry.name === "firefox");
  const actorReady = ready.find((entry) => entry.browser === actor?.name);
  const peerReady = ready.find((entry) => entry.browser === peer?.name);
  if (!actor || !peer || !actorReady || !peerReady) {
    throw new Error(milestone + " could not resolve deterministic browser roles: " + JSON.stringify(ready));
  }

  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  await Promise.all(entries.map(centerArenaInViewport));

  const actorElementId = await resolveArenaElement(actor, milestone + " actor");
  const actorId = actorReady.playerNetId;
  const peerId = peerReady.playerNetId;
  const awayOffset = actorId < peerId ? -200 : 200;
  const awayKey = actorId < peerId ? "a" : "d";
  await aimArena(actor, actorElementId, awayOffset);
  await sleep(40);

  const staminaMatchesHud = (state, expected = null) => {
    const authoritative = state?.acceptance?.authoritativeStamina;
    if (!Number.isFinite(authoritative) || !Number.isFinite(state?.playerStamina)) return false;
    if (Math.round(authoritative) !== state.playerStamina) return false;
    return expected === null || Math.round(authoritative) === expected;
  };

  const waitForActor = async (predicate, timeoutMs, label) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const state = await readUiEvidence(actor);
      if (predicate(state)) return state;
      await sleep(12);
    }
    throw new Error(milestone + " timed out waiting for " + label + ": "
      + JSON.stringify(await readUiEvidence(actor)));
  };

  const baseline = await waitForActor(
    (state) => staminaMatchesHud(state, 100)
      && state.acceptance?.scenario === "uistaminaexhaustion",
    1800,
    "full authoritative stamina baseline",
  );

  // Drain through genuine held-RMB movement until authority is safely below
  // the unchanged 28-point roll cost. A fixed three holds can bottom out near
  // 33 on a loaded runner because short WebDriver gaps allow regeneration.
  // Sample after a short input-release settle and continue, bounded, until
  // there is enough margin that the rejected wheel cannot cross the threshold
  // while the next browser command is delivered.
  let exhausted = null;
  let drainHolds = 0;
  for (let index = 0; index < 5 && !exhausted; index += 1) {
    await performArenaRunHold(actor, actorElementId, awayKey, awayOffset, 1100);
    drainHolds += 1;
    // Let the released RMB + movement sample become authoritative before
    // establishing the exhausted baseline. This remains well inside the
    // unchanged 360 ms stamina regen delay, so any later stamina change can be
    // attributed to the tested action instead of a stale sprint packet.
    await sleep(140);
    const state = await readUiEvidence(actor);
    if (staminaMatchesHud(state)
      && state.acceptance.authoritativeStamina < COMBAT.dodge.staminaCost - 6
      && state.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle) {
      exhausted = state;
    }
  }
  if (!exhausted) {
    throw new Error(milestone + " could not drain below the roll threshold with genuine running: "
      + JSON.stringify(await readUiEvidence(actor)));
  }
  const exhaustedStamina = Math.round(exhausted.acceptance.authoritativeStamina);
  const failedActionOffset = exhausted.acceptance.ownActionTransitions.length;
  const failedStaminaOffset = exhausted.acceptance.staminaTransitions.length;
  const failedWheelOffset = exhausted.wheels.length;

  // This wheel-forward is genuine browser input, but authority must reject it
  // because stamina is below the unchanged 28-point roll cost.
  await scrollArenaWheel(actor, actorElementId, -120, 0);
  await sleep(180);
  const rejected = await readUiEvidence(actor);
  const failedWheels = rejected.wheels.slice(failedWheelOffset).filter((entry) => entry.deltaY < 0);
  const failedActions = rejected.acceptance?.ownActionTransitions?.slice(failedActionOffset) ?? [];
  const failedStamina = rejected.acceptance?.staminaTransitions?.slice(failedStaminaOffset) ?? [];
  if (failedWheels.length !== 1 || !Number.isFinite(failedWheels[0]?.epochMs)) {
    throw new Error(milestone + " did not record exactly one exhausted wheel-forward input: "
      + JSON.stringify(rejected.wheels.slice(failedWheelOffset)));
  }
  if (failedActions.some((entry) =>
    entry.action === COMBAT_ACTION.dodge || entry.action === COMBAT_ACTION.dodgeRecovery)) {
    throw new Error(milestone + " exhausted wheel-forward incorrectly started a roll: "
      + JSON.stringify(failedActions));
  }
  const minimumAfterRejected = failedStamina.reduce(
    (value, entry) => Number.isFinite(entry.stamina) ? Math.min(value, entry.stamina) : value,
    exhaustedStamina,
  );
  if (minimumAfterRejected < exhaustedStamina - 1) {
    throw new Error(milestone + " rejected roll spent stamina: "
      + JSON.stringify({ exhaustedStamina, failedStamina }));
  }

  // Let authority regenerate all the way back to full. The rejected edge must
  // stay consumed rather than auto-firing when stamina later crosses 28.
  const regenerated = await waitForActor(
    (state) => staminaMatchesHud(state, 100)
      && state.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle,
    4200,
    "full regeneration after rejected roll",
  );
  const actionsBeforeRetry = regenerated.acceptance?.ownActionTransitions?.slice(failedActionOffset) ?? [];
  if (actionsBeforeRetry.some((entry) =>
    entry.action === COMBAT_ACTION.dodge || entry.action === COMBAT_ACTION.dodgeRecovery)) {
    throw new Error(milestone + " rejected roll auto-fired after regeneration: "
      + JSON.stringify(actionsBeforeRetry));
  }

  const retryActionOffset = regenerated.acceptance.ownActionTransitions.length;
  const retryStaminaOffset = regenerated.acceptance.staminaTransitions.length;
  const retryWheelOffset = regenerated.wheels.length;
  await scrollArenaWheel(actor, actorElementId, -120, 0);

  const accepted = await waitForActor(
    (state) => {
      const actions = state.acceptance?.ownActionTransitions?.slice(retryActionOffset) ?? [];
      const stamina = state.acceptance?.staminaTransitions?.slice(retryStaminaOffset) ?? [];
      return staminaMatchesHud(state, 72)
        && actions.some((entry) => entry.action === COMBAT_ACTION.dodge && Number.isFinite(entry.serverTick))
        && stamina.some((entry) => entry.stamina === 72 && Number.isFinite(entry.serverTick));
    },
    1200,
    "fresh roll after regeneration",
  );
  const retryWheels = accepted.wheels.slice(retryWheelOffset).filter((entry) => entry.deltaY < 0);
  if (retryWheels.length !== 1 || !Number.isFinite(retryWheels[0]?.epochMs)) {
    throw new Error(milestone + " regenerated retry lacked one genuine wheel-forward: "
      + JSON.stringify(accepted.wheels.slice(retryWheelOffset)));
  }

  const states = await Promise.all(entries.map(readUiEvidence));
  for (const state of states) {
    if (state.playerHp !== 100 || state.playerGuard !== 100) {
      throw new Error(milestone + " exhaustion proof changed health/guard: " + JSON.stringify(states));
    }
  }

  return states.map((entry) => ({
    ...entry,
    m165ActorId: actorId,
    m165PeerId: peerId,
    m165DrainHolds: entry.browser === actor.name ? drainHolds : null,
    m165RejectedAtStamina: entry.browser === actor.name ? exhaustedStamina : null,
    m165RejectedWheelEpochMs: entry.browser === actor.name ? failedWheels[0].epochMs : null,
    m165RetryWheelEpochMs: entry.browser === actor.name ? retryWheels[0].epochMs : null,
    m165AcceptedStamina: entry.browser === actor.name ? 72 : null,
  }));
}

async function runOnlineUiStaminaFeedbackFlight(
  entries,
  {
    milestone = "M166 authoritative stamina feedback",
    scenarioName = "uistaminafeedback",
    requireConfirmed = false,
  } = {},
) {
  if (entries.length !== 2) {
    throw new Error(milestone + " expected two real browser clients, received " + entries.length);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const actor = entries.find((entry) => entry.name === "chrome");
  const peer = entries.find((entry) => entry.name === "firefox");
  const actorReady = ready.find((entry) => entry.browser === actor?.name);
  const peerReady = ready.find((entry) => entry.browser === peer?.name);
  if (!actor || !peer || !actorReady || !peerReady) {
    throw new Error(milestone + " could not resolve deterministic browser roles: " + JSON.stringify(ready));
  }

  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  await Promise.all(entries.map(centerArenaInViewport));

  const actorElementId = await resolveArenaElement(actor, milestone + " actor");
  const actorId = actorReady.playerNetId;
  const peerId = peerReady.playerNetId;
  const awayOffset = actorId < peerId ? -200 : 200;
  const awayKey = actorId < peerId ? "a" : "d";
  await aimArena(actor, actorElementId, awayOffset);
  await sleep(40);

  const staminaMatchesHud = (state) => {
    const authoritative = state?.acceptance?.authoritativeStamina;
    return Number.isFinite(authoritative)
      && Number.isFinite(state?.playerStamina)
      && Math.round(authoritative) === state.playerStamina;
  };

  const waitForActor = async (predicate, timeoutMs, label) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const state = await readUiEvidence(actor);
      if (predicate(state)) return state;
      await sleep(12);
    }
    throw new Error(milestone + " timed out waiting for " + label + ": "
      + JSON.stringify(await readUiEvidence(actor)));
  };

  await waitForActor(
    (state) => staminaMatchesHud(state)
      && Math.round(state.acceptance.authoritativeStamina) === 100
      && state.acceptance?.scenario === scenarioName,
    1800,
    "full authoritative stamina baseline",
  );

  let exhausted = null;
  let drainHolds = 0;
  for (let index = 0; index < 5 && !exhausted; index += 1) {
    await performArenaRunHold(actor, actorElementId, awayKey, awayOffset, 1100);
    drainHolds += 1;
    // Let the released RMB + movement sample become authoritative before
    // establishing the exhausted baseline. This remains well inside the
    // unchanged 360 ms stamina regen delay, so any later stamina change can be
    // attributed to the tested action instead of a stale sprint packet.
    await sleep(140);
    const state = await readUiEvidence(actor);
    if (staminaMatchesHud(state)
      && state.acceptance.authoritativeStamina < COMBAT.dodge.staminaCost - 6
      && state.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle) {
      exhausted = state;
    }
  }
  if (!exhausted) {
    throw new Error(milestone + " could not drain below the roll threshold with genuine running: "
      + JSON.stringify(await readUiEvidence(actor)));
  }

  const exhaustedStamina = Math.round(exhausted.acceptance.authoritativeStamina);
  const actionOffset = exhausted.acceptance.ownActionTransitions.length;
  const staminaOffset = exhausted.acceptance.staminaTransitions.length;
  const wheelOffset = exhausted.wheels.length;
  const eventOffset = exhausted.events.length;
  const feedbackOffset = exhausted.feedbackTransitions.length;
  const denialOffset = exhausted.acceptance?.staminaDenialTransitions?.length ?? 0;

  // Preserve M165's authority contract: the genuine wheel-forward still reaches
  // the server. M166 adds only a client readability cue based on the latest
  // replicated authoritative stamina value.
  await scrollArenaWheel(actor, actorElementId, -120, 0);

  const rejected = await waitForActor(
    (state) => {
      const newEvents = state.events.slice(eventOffset);
      const newFeedback = state.feedbackTransitions.slice(feedbackOffset);
      return newEvents.includes("Low stamina — roll needs 28.")
        && newFeedback.includes("stamina-denied");
    },
    1000,
    "visible low-stamina roll denial",
  );

  const failedWheels = rejected.wheels.slice(wheelOffset).filter((entry) => entry.deltaY < 0);
  const failedActions = rejected.acceptance?.ownActionTransitions?.slice(actionOffset) ?? [];
  const failedStamina = rejected.acceptance?.staminaTransitions?.slice(staminaOffset) ?? [];
  if (failedWheels.length !== 1 || !Number.isFinite(failedWheels[0]?.epochMs)) {
    throw new Error(milestone + " did not record exactly one denied wheel-forward input: "
      + JSON.stringify(rejected.wheels.slice(wheelOffset)));
  }
  if (failedActions.some((entry) =>
    entry.action === COMBAT_ACTION.dodge || entry.action === COMBAT_ACTION.dodgeRecovery)) {
    throw new Error(milestone + " readability cue masked a real roll: " + JSON.stringify(failedActions));
  }
  const minimumAfterDenied = failedStamina.reduce(
    (value, entry) => Number.isFinite(entry.stamina) ? Math.min(value, entry.stamina) : value,
    exhaustedStamina,
  );
  if (minimumAfterDenied < exhaustedStamina - 1) {
    throw new Error(milestone + " denied roll spent stamina: "
      + JSON.stringify({ exhaustedStamina, failedStamina }));
  }

  let confirmedProof = null;
  if (requireConfirmed) {
    const transitions = rejected.acceptance?.staminaDenialTransitions?.slice(denialOffset) ?? [];
    const queuedIndex = transitions.findIndex((entry) => entry.stage === "queued" && entry.action === "roll");
    const submittedIndex = transitions.findIndex((entry, index) =>
      index > queuedIndex && entry.stage === "submitted" && entry.action === "roll");
    const rejectedIndex = transitions.findIndex((entry, index) =>
      index > submittedIndex && entry.stage === "confirmed-rejected" && entry.action === "roll");
    const shownIndex = transitions.findIndex((entry, index) =>
      index > rejectedIndex && entry.stage === "shown" && entry.action === "roll");
    if (queuedIndex < 0 || submittedIndex <= queuedIndex || rejectedIndex <= submittedIndex || shownIndex <= rejectedIndex) {
      throw new Error(milestone + " did not preserve denial lifecycle ordering: " + JSON.stringify(transitions));
    }
    const queued = transitions[queuedIndex];
    const submitted = transitions[submittedIndex];
    const confirmed = transitions[rejectedIndex];
    const shown = transitions[shownIndex];
    const ackIncludesInput = Number.isInteger(submitted.clientTick)
      && Number.isInteger(confirmed.processedClientTick)
      && (confirmed.processedClientTick === submitted.clientTick
        || isTickNewer32(confirmed.processedClientTick, submitted.clientTick));
    if (!ackIncludesInput
      || !Number.isFinite(queued.epochMs)
      || !Number.isFinite(submitted.epochMs)
      || !Number.isFinite(confirmed.epochMs)
      || !Number.isFinite(shown.epochMs)
      || submitted.epochMs < queued.epochMs
      || confirmed.epochMs < submitted.epochMs
      || shown.epochMs < confirmed.epochMs) {
      throw new Error(milestone + " did not tie visible denial to an acknowledged input tick: "
        + JSON.stringify(transitions));
    }
    if (!Number.isFinite(confirmed.authoritativeStamina)
      || confirmed.authoritativeStamina >= COMBAT.dodge.staminaCost) {
      throw new Error(milestone + " confirmed denial lacked sub-cost authoritative stamina: "
        + JSON.stringify(confirmed));
    }
    confirmedProof = { queued, submitted, confirmed, shown };
  }

  const states = await Promise.all(entries.map(readUiEvidence));
  for (const state of states) {
    if (state.playerHp !== 100 || state.playerGuard !== 100) {
      throw new Error(milestone + " feedback proof changed health/guard: " + JSON.stringify(states));
    }
  }

  return states.map((entry) => ({
    ...entry,
    m166ActorId: actorId,
    m166PeerId: peerId,
    m166DrainHolds: entry.browser === actor.name ? drainHolds : null,
    m166DeniedAtStamina: entry.browser === actor.name ? exhaustedStamina : null,
    m166DeniedWheelEpochMs: entry.browser === actor.name ? failedWheels[0].epochMs : null,
    m166FeedbackSeen: entry.browser === actor.name
      ? entry.feedbackTransitions.includes("stamina-denied")
      : null,
    m167SubmittedClientTick: entry.browser === actor.name && requireConfirmed
      ? confirmedProof?.submitted?.clientTick ?? null
      : null,
    m167ProcessedClientTick: entry.browser === actor.name && requireConfirmed
      ? confirmedProof?.confirmed?.processedClientTick ?? null
      : null,
    m167ConfirmedShown: entry.browser === actor.name && requireConfirmed
      ? confirmedProof?.shown?.stage === "shown"
      : null,
  }));
}

async function runOnlineUiConfirmedStaminaActionsFlight(entries) {
  const milestone = "M175 kick/attack arbitration";
  if (entries.length !== 2) {
    throw new Error(milestone + " expected two real browser clients, received " + entries.length);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const actor = entries.find((entry) => entry.name === "chrome");
  const peer = entries.find((entry) => entry.name === "firefox");
  const actorReady = ready.find((entry) => entry.browser === actor?.name);
  const peerReady = ready.find((entry) => entry.browser === peer?.name);
  if (!actor || !peer || !actorReady || !peerReady) {
    throw new Error(milestone + " could not resolve deterministic browser roles: " + JSON.stringify(ready));
  }

  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  await Promise.all(entries.map(centerArenaInViewport));

  const actorElementId = await resolveArenaElement(actor, milestone + " actor");
  const actorId = actorReady.playerNetId;
  const peerId = peerReady.playerNetId;
  const awayOffset = actorId < peerId ? -200 : 200;
  const awayKey = actorId < peerId ? "a" : "d";
  await aimArena(actor, actorElementId, awayOffset);
  await sleep(40);

  const staminaMatchesHud = (state) => {
    const authoritative = state?.acceptance?.authoritativeStamina;
    return Number.isFinite(authoritative)
      && Number.isFinite(state?.playerStamina)
      && Math.round(authoritative) === state.playerStamina;
  };

  const waitForActor = async (predicate, timeoutMs, label) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const state = await readUiEvidence(actor);
      if (predicate(state)) return state;
      await sleep(12);
    }
    throw new Error(milestone + " timed out waiting for " + label + ": "
      + JSON.stringify(await readUiEvidence(actor)));
  };

  await waitForActor(
    (state) => staminaMatchesHud(state)
      && Math.round(state.acceptance.authoritativeStamina) === 100
      && state.acceptance?.scenario === "uistaminaconfirmed",
    1800,
    "full authoritative stamina baseline",
  );

  let drainHolds = 0;
  const ensureExhausted = async () => {
    let state = await readUiEvidence(actor);
    for (let index = 0; index < 6; index += 1) {
      if (staminaMatchesHud(state)
        && state.acceptance.authoritativeStamina < COMBAT.runningAttack.staminaCost - 2
        && state.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle) {
        return state;
      }
      await performArenaRunHold(actor, actorElementId, awayKey, awayOffset, 1100);
      drainHolds += 1;
      await sleep(140);
      state = await readUiEvidence(actor);
    }
    throw new Error(milestone + " could not establish sub-running-attack-cost authoritative stamina: "
      + JSON.stringify(state));
  };

  const actionCases = [
    {
      action: "roll",
      cost: COMBAT.dodge.staminaCost,
      text: "Low stamina — roll needs 28.",
      accepted: new Set([COMBAT_ACTION.dodge, COMBAT_ACTION.dodgeRecovery]),
      perform: () => scrollArenaWheel(actor, actorElementId, -120, 0),
      captureOffset: (state) => state.wheels.length,
      inputEvidence: (state, offset) => {
        const wheels = state.wheels.slice(offset).filter((entry) => entry.deltaY < 0);
        if (wheels.length !== 1 || !Number.isFinite(wheels[0]?.epochMs)) {
          throw new Error(milestone + " roll did not record one genuine wheel-forward: "
            + JSON.stringify(state.wheels.slice(offset)));
        }
        return { epochMs: wheels[0].epochMs, detail: wheels[0] };
      },
    },
    {
      action: "roll",
      proofName: "roll+light",
      cost: COMBAT.dodge.staminaCost,
      text: "Low stamina — roll needs 28.",
      // W3C wheel and pointer sources are not dispatched atomically by
      // ChromeDriver: one source can precede the other by tens of milliseconds.
      // Kernel tests own the true same-input-tick no-light guarantee; this real
      // browser phase proves both genuine controls and confirmed roll denial.
      accepted: new Set([
        COMBAT_ACTION.dodge,
        COMBAT_ACTION.dodgeRecovery,
      ]),
      requireEventText: false,
      settleToIdle: true,
      perform: () => performArenaRollAttackChord(actor, actorElementId, awayOffset, 70),
      captureOffset: (state) => ({
        wheels: state.wheels.length,
        pointers: state.pointers.length,
      }),
      inputEvidence: (state, offset) => {
        const wheels = state.wheels.slice(offset.wheels).filter((entry) => entry.deltaY < 0);
        const pointers = state.pointers.slice(offset.pointers).filter((entry) => entry.button === 0);
        const downs = pointers.filter((entry) => entry.type === "pointerdown");
        const ups = pointers.filter((entry) => entry.type === "pointerup");
        if (wheels.length !== 1 || downs.length !== 1 || ups.length !== 1
          || !Number.isFinite(wheels[0]?.epochMs)
          || !Number.isFinite(downs[0]?.epochMs) || !Number.isFinite(ups[0]?.epochMs)
          || ups[0].epochMs <= downs[0].epochMs
          || downs[0].epochMs < wheels[0].epochMs
          || downs[0].epochMs - wheels[0].epochMs > 260) {
          throw new Error(milestone + " roll+light did not record one genuine staged wheel-forward + LMB gesture: "
            + JSON.stringify({
              wheels: state.wheels.slice(offset.wheels),
              pointers: state.pointers.slice(offset.pointers),
            }));
        }
        return {
          epochMs: Math.max(wheels[0].epochMs, downs[0].epochMs),
          detail: { wheel: wheels[0], down: downs[0], up: ups[0] },
        };
      },
    },
    {
      action: "kick",
      cost: COMBAT.kick.staminaCost,
      text: "Low stamina — kick needs 18.",
      accepted: new Set([COMBAT_ACTION.kickWindup, COMBAT_ACTION.kickActive, COMBAT_ACTION.kickRecovery]),
      perform: () => performArenaRecoveryBufferedKick(actor, actorElementId, awayOffset, 45),
      captureOffset: (state) => state.pointers.length,
      inputEvidence: (state, offset) => {
        const pointers = state.pointers.slice(offset).filter((entry) => entry.button === 2);
        const downs = pointers.filter((entry) => entry.type === "pointerdown");
        const ups = pointers.filter((entry) => entry.type === "pointerup");
        if (downs.length !== 1 || ups.length !== 1
          || !Number.isFinite(downs[0]?.epochMs) || !Number.isFinite(ups[0]?.epochMs)
          || ups[0].epochMs <= downs[0].epochMs || ups[0].epochMs - downs[0].epochMs >= 180) {
          throw new Error(milestone + " kick did not record one genuine short RMB gesture: "
            + JSON.stringify(pointers));
        }
        return { epochMs: downs[0].epochMs, detail: { down: downs[0], up: ups[0] } };
      },
    },
    {
      action: "kick",
      proofName: "kick+light",
      cost: COMBAT.kick.staminaCost,
      text: "Low stamina — kick needs 18.",
      // WebDriver serializes mouse-button transitions; kernel tests own the
      // true same-input-tick no-light guarantee. This phase proves the real
      // short-RMB + LMB gesture and authority-confirmed kick denial.
      accepted: new Set([
        COMBAT_ACTION.kickWindup,
        COMBAT_ACTION.kickActive,
        COMBAT_ACTION.kickRecovery,
      ]),
      requireEventText: false,
      settleToIdle: true,
      perform: () => performArenaKickAttackChord(actor, actorElementId, awayOffset, 90),
      captureOffset: (state) => state.pointers.length,
      inputEvidence: (state, offset) => {
        const pointers = state.pointers.slice(offset);
        const right = pointers.filter((entry) => entry.button === 2);
        const left = pointers.filter((entry) => entry.button === 0);
        const rightDowns = right.filter((entry) => entry.type === "pointerdown");
        const rightUps = right.filter((entry) => entry.type === "pointerup");
        const leftDowns = left.filter((entry) => entry.type === "pointerdown");
        const leftUps = left.filter((entry) => entry.type === "pointerup");
        const rightDown = rightDowns[0];
        const rightUp = rightUps[0];
        const leftDown = leftDowns[0];
        const leftUp = leftUps[0];
        const complete = rightDowns.length === 1 && rightUps.length === 1
          && leftDowns.length === 1 && leftUps.length === 1
          && [rightDown, rightUp, leftDown, leftUp].every((entry) => Number.isFinite(entry?.epochMs))
          && rightUp.epochMs > rightDown.epochMs
          && rightUp.epochMs - rightDown.epochMs < 180
          && leftDown.epochMs >= rightDown.epochMs
          && leftDown.epochMs - rightUp.epochMs >= 0
          && leftDown.epochMs - rightUp.epochMs <= 80
          && leftUp.epochMs > leftDown.epochMs;
        if (!complete) {
          throw new Error(milestone + " kick+light did not record one genuine short-RMB + LMB gesture: "
            + JSON.stringify(pointers));
        }
        return {
          epochMs: rightUp.epochMs,
          detail: { rightDown, rightUp, leftDown, leftUp },
        };
      },
    },
    {
      action: "jump",
      cost: COMBAT.jump.staminaCost,
      text: "Low stamina — jump needs 14.",
      accepted: new Set([
        COMBAT_ACTION.jump,
        COMBAT_ACTION.jumpAttackWindup,
        COMBAT_ACTION.jumpAttackActive,
        COMBAT_ACTION.jumpAttackRecovery,
      ]),
      perform: () => performArenaJumpPress(actor, 45),
      captureOffset: (state) => state.keyTransitions.length,
      inputEvidence: (state, offset) => {
        const keys = state.keyTransitions.slice(offset).filter((entry) => entry.code === "Space");
        const downs = keys.filter((entry) => entry.type === "keydown");
        const ups = keys.filter((entry) => entry.type === "keyup");
        if (downs.length !== 1 || ups.length !== 1
          || !Number.isFinite(downs[0]?.epochMs) || !Number.isFinite(ups[0]?.epochMs)
          || ups[0].epochMs <= downs[0].epochMs || ups[0].epochMs - downs[0].epochMs >= 180) {
          throw new Error(milestone + " jump did not record one genuine short Space gesture: "
            + JSON.stringify(keys));
        }
        return { epochMs: downs[0].epochMs, detail: { down: downs[0], up: ups[0] } };
      },
    },
    {
      action: "running-attack",
      cost: COMBAT.runningAttack.staminaCost,
      text: "Low stamina — running attack needs 10.",
      // A denied running-strike chord must not degrade into either the running
      // strike itself or any ordinary/directional light attack.
      accepted: new Set([
        COMBAT_ACTION.runningAttackWindup,
        COMBAT_ACTION.runningAttackActive,
        COMBAT_ACTION.runningAttackRecovery,
        COMBAT_ACTION.attackWindup,
        COMBAT_ACTION.attackActive,
        COMBAT_ACTION.attackRecovery,
        COMBAT_ACTION.attackLeftWindup,
        COMBAT_ACTION.attackLeftActive,
        COMBAT_ACTION.attackLeftRecovery,
        COMBAT_ACTION.attackRightWindup,
        COMBAT_ACTION.attackRightActive,
        COMBAT_ACTION.attackRightRecovery,
      ]),
      allowContinuousDrain: true,
      // Hold real sprint movement longer before LMB so any stamina regenerated
      // while crossing the 180 ms RMB threshold is drained back below 10.
      perform: () => performArenaRunningAttack(actor, actorElementId, awayKey, awayOffset, 520),
      captureOffset: (state) => ({
        pointers: state.pointers.length,
        keys: state.keyTransitions.length,
      }),
      inputEvidence: (state, offset) => {
        const pointers = state.pointers.slice(offset.pointers);
        const keys = state.keyTransitions.slice(offset.keys);
        const rightDown = pointers.find((entry) => entry.type === "pointerdown" && entry.button === 2);
        const rightUp = pointers.find((entry) => entry.type === "pointerup" && entry.button === 2);
        const lightDown = pointers.find((entry) => entry.type === "pointerdown" && entry.button === 0);
        const lightUp = pointers.find((entry) => entry.type === "pointerup" && entry.button === 0);
        const movementCode = "Key" + awayKey.toUpperCase();
        const moveDown = keys.find((entry) => entry.type === "keydown" && entry.code === movementCode);
        const moveUp = keys.find((entry) => entry.type === "keyup" && entry.code === movementCode);
        const complete = rightDown && rightUp && lightDown && lightUp && moveDown && moveUp
          && [rightDown, rightUp, lightDown, lightUp, moveDown, moveUp]
            .every((entry) => Number.isFinite(entry.epochMs))
          && lightDown.epochMs - rightDown.epochMs >= 180
          && moveDown.epochMs > rightDown.epochMs
          && moveDown.epochMs < lightDown.epochMs
          && lightUp.epochMs > lightDown.epochMs
          && rightUp.epochMs > lightUp.epochMs
          && moveUp.epochMs > lightUp.epochMs;
        if (!complete) {
          throw new Error(milestone + " running attack did not record one genuine run+LMB chord: "
            + JSON.stringify({ pointers, keys }));
        }
        return {
          epochMs: lightDown.epochMs,
          detail: { rightDown, rightUp, lightDown, lightUp, moveDown, moveUp },
        };
      },
    },
  ];

  const proofs = [];
  for (const actionCase of actionCases) {
    const exhausted = await ensureExhausted();
    const baselineStamina = Math.round(exhausted.acceptance.authoritativeStamina);
    const actionOffset = exhausted.acceptance.ownActionTransitions.length;
    const staminaOffset = exhausted.acceptance.staminaTransitions.length;
    const denialOffset = exhausted.acceptance?.staminaDenialTransitions?.length ?? 0;
    const eventOffset = exhausted.events.length;
    const feedbackOffset = exhausted.feedbackTransitions.length;
    const inputOffset = actionCase.captureOffset(exhausted);

    await actionCase.perform();

    const rejected = await waitForActor(
      (state) => {
        const transitions = state.acceptance?.staminaDenialTransitions?.slice(denialOffset) ?? [];
        const hasShownDenial = transitions.some(
          (entry) => entry.stage === "shown" && entry.action === actionCase.action,
        );
        const hasExpectedEvent = actionCase.requireEventText === false
          || state.events.slice(eventOffset).includes(actionCase.text);
        return hasShownDenial
          && hasExpectedEvent
          && state.feedbackTransitions.slice(feedbackOffset).includes("stamina-denied");
      },
      1200,
      actionCase.action + " confirmed stamina denial",
    );

    const input = actionCase.inputEvidence(rejected, inputOffset);
    const newActions = rejected.acceptance?.ownActionTransitions?.slice(actionOffset) ?? [];
    if (newActions.some((entry) => actionCase.accepted.has(entry.action))) {
      throw new Error(milestone + " " + actionCase.action + " was accepted despite confirmed denial: "
        + JSON.stringify(newActions));
    }

    const staminaTransitions = rejected.acceptance?.staminaTransitions?.slice(staminaOffset) ?? [];
    const minimumStamina = staminaTransitions.reduce(
      (value, entry) => Number.isFinite(entry.stamina) ? Math.min(value, entry.stamina) : value,
      baselineStamina,
    );
    if (!actionCase.allowContinuousDrain && minimumStamina < baselineStamina - 1) {
      throw new Error(milestone + " denied " + actionCase.action + " spent stamina: "
        + JSON.stringify({ baselineStamina, staminaTransitions }));
    }

    const transitions = rejected.acceptance?.staminaDenialTransitions?.slice(denialOffset) ?? [];
    const queuedIndex = transitions.findIndex((entry) =>
      entry.stage === "queued" && entry.action === actionCase.action);
    const submittedIndex = transitions.findIndex((entry, index) =>
      index > queuedIndex && entry.stage === "submitted" && entry.action === actionCase.action);
    const rejectedIndex = transitions.findIndex((entry, index) =>
      index > submittedIndex && entry.stage === "confirmed-rejected" && entry.action === actionCase.action);
    const shownIndex = transitions.findIndex((entry, index) =>
      index > rejectedIndex && entry.stage === "shown" && entry.action === actionCase.action);
    if (queuedIndex < 0 || submittedIndex <= queuedIndex
      || rejectedIndex <= submittedIndex || shownIndex <= rejectedIndex) {
      throw new Error(milestone + " " + actionCase.action
        + " did not preserve queued/submitted/rejected/shown ordering: "
        + JSON.stringify(transitions));
    }

    const queued = transitions[queuedIndex];
    const submitted = transitions[submittedIndex];
    const confirmed = transitions[rejectedIndex];
    const shown = transitions[shownIndex];
    const ackIncludesInput = Number.isInteger(submitted.clientTick)
      && Number.isInteger(confirmed.processedClientTick)
      && (confirmed.processedClientTick === submitted.clientTick
        || isTickNewer32(confirmed.processedClientTick, submitted.clientTick));
    if (!ackIncludesInput
      || !Number.isFinite(queued.epochMs)
      || !Number.isFinite(submitted.epochMs)
      || !Number.isFinite(confirmed.epochMs)
      || !Number.isFinite(shown.epochMs)
      || submitted.epochMs < queued.epochMs
      || confirmed.epochMs < submitted.epochMs
      || shown.epochMs < confirmed.epochMs
      || !Number.isFinite(confirmed.authoritativeStamina)
      || confirmed.authoritativeStamina >= actionCase.cost) {
      throw new Error(milestone + " " + actionCase.action
        + " denial was not tied to acknowledged sub-cost authority: "
        + JSON.stringify(transitions));
    }

    proofs.push({
      proof: actionCase.proofName ?? actionCase.action,
      action: actionCase.action,
      serializedLightObserved: Boolean(actionCase.settleToIdle
        && newActions.some((entry) => entry.action === COMBAT_ACTION.attackWindup
          || entry.action === COMBAT_ACTION.attackActive
          || entry.action === COMBAT_ACTION.attackRecovery
          || entry.action === COMBAT_ACTION.attackLeftWindup
          || entry.action === COMBAT_ACTION.attackLeftActive
          || entry.action === COMBAT_ACTION.attackLeftRecovery
          || entry.action === COMBAT_ACTION.attackRightWindup
          || entry.action === COMBAT_ACTION.attackRightActive
          || entry.action === COMBAT_ACTION.attackRightRecovery)),
      cost: actionCase.cost,
      baselineStamina,
      inputEpochMs: input.epochMs,
      // These phases were all recorded by the same actor browser observer.
      sameBrowserClock: true,
      queuedEpochMs: queued.epochMs,
      submittedEpochMs: submitted.epochMs,
      confirmedEpochMs: confirmed.epochMs,
      submittedClientTick: submitted.clientTick,
      processedClientTick: confirmed.processedClientTick,
      authoritativeStamina: confirmed.authoritativeStamina,
      shownEpochMs: shown.epochMs,
    });

    if (actionCase.settleToIdle) {
      // The denial ACK can arrive before a serialized companion LMB has been
      // reflected in the next authoritative snapshot. Give that real browser
      // input one replication interval to surface before accepting Idle;
      // otherwise a stale-idle read can start the next proof inside a light
      // attack that is only just beginning on the server.
      await sleep(120);
      await waitForActor(
        (state) => state.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle,
        900,
        actionCase.action + " serialized browser chord recovery",
      );
    } else {
      await sleep(120);
    }
  }

  const states = await Promise.all(entries.map(readUiEvidence));
  for (const state of states) {
    if (state.playerHp !== 100 || state.playerGuard !== 100) {
      throw new Error(milestone + " denial proof changed health/guard: " + JSON.stringify(states));
    }
  }

  // Diagnostic only. This log happens after the original strict
  // authority/health/guard checks, and can never turn a failed proof green.
  console.log("M214_CONFIRMED_DENIAL_FEEDBACK_LATENCY " + JSON.stringify(
    summarizeM214ConfirmedFeedback(proofs),
  ));
  return states.map((entry) => ({
    ...entry,
    m169ActorId: actorId,
    m169PeerId: peerId,
    m169DrainHolds: entry.browser === actor.name ? drainHolds : null,
    m169Proofs: entry.browser === actor.name ? proofs : [],
  }));
}

async function runOnlineUiRollBufferFlight(entries) {
  const staged = await prepareHeavyCounterplayFlight(
    entries,
    "M129 recovery roll buffer",
    { attackerName: "chrome", defenderName: "firefox", movementMs: 150 },
  );
  const { attacker, defender, attackerElementId, movementCode } = staged;
  const attackOffset = movementCode === "KeyD" ? 200 : -200;
  const beforeAttacker = await readUiEvidence(attacker);
  const pointerOffset = beforeAttacker.pointers.length;
  const wheelOffset = beforeAttacker.wheels.length;

  // First prove a normal committed light with genuine LMB. Do not retarget the
  // pointer until Firefox has independently observed the authoritative recovery.
  await performArenaAttack(attacker, attackerElementId, attackOffset);

  const recoveryDeadline = Date.now() + 900;
  let recoveryWitness = null;
  while (Date.now() < recoveryDeadline) {
    const current = await readUiEvidence(defender);
    const attackRecoveryIndex = current.recoveryTransitions.findIndex((entry) =>
      entry.visible && entry.state === "attack-recovery"
        && entry.label === "PUNISH" && entry.detail === "Attack recovery"
        && Number.isFinite(entry.epochMs));
    if (attackRecoveryIndex >= 0) {
      recoveryWitness = { evidence: current, attackRecoveryIndex };
      break;
    }
    await sleep(10);
  }
  if (!recoveryWitness) {
    throw new Error("M129 Firefox never observed authoritative light recovery before the real wheel");
  }

  // Once recovery is real, retarget the pointer and send one genuine
  // wheel-forward after a browser-owned pause. Whether it was truly bufferable
  // is proved below from cross-browser epoch timestamps, not requested timings.
  const recoveryStartEpochMs = recoveryWitness.evidence.recoveryTransitions[recoveryWitness.attackRecoveryIndex].epochMs;
  await performArenaRecoveryBufferedRoll(attacker, attackerElementId, recoveryStartEpochMs);

  const deadline = Date.now() + 1200;
  let evidence = null;
  while (Date.now() < deadline) {
    const current = await Promise.all(entries.map(readUiEvidence));
    const defenderResult = current.find((entry) => entry.browser === defender.name);
    const attackRecoveryIndex = defenderResult?.recoveryTransitions.findIndex((entry) =>
      entry.visible && entry.state === "attack-recovery"
        && entry.label === "PUNISH" && entry.detail === "Attack recovery"
        && Number.isFinite(entry.epochMs)) ?? -1;
    const dodgeRecoveryIndex = defenderResult?.recoveryTransitions.findIndex((entry, index) =>
      index > attackRecoveryIndex && entry.visible && entry.state === "dodge-recovery"
        && entry.label === "PUNISH" && entry.detail === "Dodge recovery"
        && Number.isFinite(entry.epochMs)) ?? -1;
    if (attackRecoveryIndex >= 0 && dodgeRecoveryIndex > attackRecoveryIndex) {
      evidence = current;
      break;
    }
    await sleep(20);
  }
  if (!evidence) evidence = await Promise.all(entries.map(readUiEvidence));

  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) {
    throw new Error(`M129 incomplete roll-buffer evidence: ${JSON.stringify(evidence)}`);
  }

  const pointers = attackerResult.pointers.slice(pointerOffset);
  const wheels = attackerResult.wheels.slice(wheelOffset);
  const lightDown = pointers.find((entry) => entry.type === "pointerdown" && entry.button === 0);
  const lightUp = pointers.find((entry) => entry.type === "pointerup" && entry.button === 0);
  const perpendicularAim = pointers.find((entry) =>
    entry.type === "pointermove" && Number.isFinite(entry.epochMs)
      && Math.abs(entry.x - 0.5) <= 0.12 && entry.y >= 0.68);
  const rollWheels = wheels.filter((entry) => entry.deltaY < 0);
  const rollWheel = rollWheels[0];
  if (!lightDown || !lightUp || !perpendicularAim || rollWheels.length !== 1
    || !rollWheel || !Number.isFinite(rollWheel.epochMs)) {
    throw new Error(`M129 real LMB + perpendicular pointer aim + single wheel-forward controls were not delivered: ${JSON.stringify(attackerResult)}`);
  }
  if (perpendicularAim.epochMs > rollWheel.epochMs) {
    throw new Error(`M129 pointer retarget happened after wheel-forward: aim=${perpendicularAim.epochMs} wheel=${rollWheel.epochMs}`);
  }

  const attackRecoveryIndex = defenderResult.recoveryTransitions.findIndex((entry) =>
    entry.visible && entry.state === "attack-recovery"
      && entry.label === "PUNISH" && entry.detail === "Attack recovery"
      && Number.isFinite(entry.epochMs));
  const attackRecoveryExitIndex = defenderResult.recoveryTransitions.findIndex((entry, index) =>
    index > attackRecoveryIndex
      && Number.isFinite(entry.epochMs)
      && !(entry.visible && entry.state === "attack-recovery"));
  const dodgeRecoveryIndex = defenderResult.recoveryTransitions.findIndex((entry, index) =>
    index > attackRecoveryIndex && entry.visible && entry.state === "dodge-recovery"
      && entry.label === "PUNISH" && entry.detail === "Dodge recovery"
      && Number.isFinite(entry.epochMs));
  if (attackRecoveryIndex < 0 || attackRecoveryExitIndex <= attackRecoveryIndex
    || dodgeRecoveryIndex <= attackRecoveryIndex) {
    throw new Error(`M129 remote authority did not show a complete attack-recovery -> dodge-recovery sequence: ${JSON.stringify(defenderResult.recoveryTransitions)}`);
  }

  const attackRecovery = defenderResult.recoveryTransitions[attackRecoveryIndex];
  const attackRecoveryExit = defenderResult.recoveryTransitions[attackRecoveryExitIndex];

  // Prove buffering from the attacker's authoritative action stream using the
  // same browser clock as the real wheel event. Snapshot sampling can expose a
  // single idle sample at the exact recovery boundary even when the buffered
  // dodge is already queued for the next authoritative update. Accept that
  // one-sample boundary only when dodge appears within 3 server ticks.
  const ownActions = attackerResult.acceptance?.ownActionTransitions ?? [];
  const ownAttackRecoveryIndex = ownActions.findIndex((entry) =>
    entry.action === COMBAT_ACTION.attackRecovery
      && Number.isFinite(entry.epochMs)
      && Number.isFinite(entry.serverTick));
  const ownDodgeIndex = ownActions.findIndex((entry, index) =>
    index > ownAttackRecoveryIndex
      && entry.action === COMBAT_ACTION.dodge
      && Number.isFinite(entry.epochMs)
      && Number.isFinite(entry.serverTick));
  const unexpectedBetween = ownActions.find((entry, index) =>
    index > ownAttackRecoveryIndex
      && index < ownDodgeIndex
      && entry.action !== COMBAT_ACTION.idle);
  if (ownAttackRecoveryIndex < 0 || ownDodgeIndex <= ownAttackRecoveryIndex || unexpectedBetween) {
    throw new Error(`M129 authoritative buffered roll left the expected recovery->idle->dodge path: ${JSON.stringify(ownActions)}`);
  }

  const ownAttackRecovery = ownActions[ownAttackRecoveryIndex];
  const ownDodge = ownActions[ownDodgeIndex];
  const expectedRecoveryEndEpochMs = ownAttackRecovery.epochMs + COMBAT.attack.recoveryMs;
  const recoveryToDodgeDelayMs = ownDodge.epochMs - expectedRecoveryEndEpochMs;
  // Read-only M219 evidence, including when the original strict bound fails.
  // This log is not an alternate success condition or input-buffer proof.
  console.log("M219_BUFFERED_ROLL_INGRESS " + JSON.stringify(observeM219RollBufferIngress({
    sameBrowserClock: true,
    wheel: rollWheel,
    recovery: ownAttackRecovery,
    dodge: ownDodge,
    recoveryMs: COMBAT.attack.recoveryMs,
    bufferWindowMs: COMBAT.inputBuffer.dodgeWindowMs,
  })));
  // Snapshot epochs are sampled on the 60 Hz authoritative timeline. The
  // first legal dodge tick can therefore appear up to one frame before the
  // nominal millisecond sum of recoveryStart + recoveryMs.
  if (recoveryToDodgeDelayMs < -20 || recoveryToDodgeDelayMs > 140) {
    throw new Error(`M129 authoritative buffered roll exceeded bounded post-recovery delivery latency: ${JSON.stringify({
      ownAttackRecovery,
      ownDodge,
      expectedRecoveryEndEpochMs,
      recoveryToDodgeDelayMs,
      ownActions,
    })}`);
  }
  const bufferOpenEpochMs = ownAttackRecovery.epochMs
    + COMBAT.attack.recoveryMs - COMBAT.inputBuffer.dodgeWindowMs;
  // Firefox can observe the shared authoritative recovery snapshot one
  // replication sample before Chrome records its own recovery transition.
  // Pointer retargeting is not an action edge, so tolerate at most one 60 Hz
  // authoritative frame of that cross-browser observation skew. Keep the real
  // wheel-forward strict: it must still land after buffer-open and before the
  // buffered Dodge becomes authoritative.
  const recoveryAimSkewMs = 20;
  if (perpendicularAim.epochMs < ownAttackRecovery.epochMs - recoveryAimSkewMs
    || rollWheel.epochMs < bufferOpenEpochMs
    || rollWheel.epochMs > ownDodge.epochMs) {
    throw new Error(`M129 genuine wheel was not inside the attacker's authoritative dodge-buffer interval: ${JSON.stringify({
      ownAttackRecovery,
      ownDodge,
      bufferOpenEpochMs,
      perpendicularAim,
      rollWheel,
      ownActions,
    })}`);
  }

  if (attackerResult.playerHp !== 100 || attackerResult.playerGuard !== 100
    || attackerResult.opponentHp !== 66
    || defenderResult.playerHp !== 66 || defenderResult.playerGuard !== 100) {
    throw new Error(`M129 buffered roll changed the one-hit authoritative exchange: ${JSON.stringify(evidence)}`);
  }
  if (attackerResult.feedbackTransitions.includes("parried")
    || defenderResult.feedbackTransitions.includes("parry-success")) {
    throw new Error(`M129 roll-buffer flight accidentally resolved as parry: ${JSON.stringify(evidence)}`);
  }

  return evidence.map((entry) => ({
    ...entry,
    rollBufferWheelEpochMs: entry.browser === attacker.name ? rollWheel.epochMs : null,
    rollBufferRecoveryStartEpochMs: entry.browser === defender.name ? attackRecovery.epochMs : null,
    rollBufferRecoveryExitEpochMs: entry.browser === defender.name ? attackRecoveryExit.epochMs : null,
  }));
}

async function runOnlineUiJumpBufferFlight(entries) {
  const staged = await prepareHeavyCounterplayFlight(
    entries,
    "M131 recovery jump buffer",
    { attackerName: "chrome", defenderName: "firefox", movementMs: 150 },
  );
  const { attacker, defender, attackerElementId, movementCode } = staged;
  const attackOffset = movementCode === "KeyD" ? 200 : -200;
  const beforeAttacker = await readUiEvidence(attacker);
  const keyTransitionOffset = beforeAttacker.keyTransitions.length;

  // Commit one genuine light first. The acceptance hook below is fed only from
  // authoritative snapshots; it does not observe local prediction.
  await performArenaAttack(attacker, attackerElementId, attackOffset);

  const recoveryDeadline = Date.now() + 900;
  let recoveryStart = null;
  while (Date.now() < recoveryDeadline) {
    const current = await readUiEvidence(attacker);
    const transitions = current.acceptance?.ownActionTransitions ?? [];
    recoveryStart = transitions.find((entry) =>
      entry.action === COMBAT_ACTION.attackRecovery && Number.isFinite(entry.epochMs)) ?? null;
    if (recoveryStart) break;
    await sleep(10);
  }
  if (!recoveryStart) {
    throw new Error("M131 Chrome never observed its authoritative light recovery before Space");
  }

  // Aim inside the late 90 ms buffer window, not just before it. Scheduling
  // the real Space edge 20 ms into the valid window keeps the acceptance proof
  // deterministic across fast and loaded headless browsers while preserving
  // the unchanged authoritative 90 ms gameplay rule.
  const targetOffsetMs = Math.max(
    0,
    COMBAT.attack.recoveryMs - COMBAT.inputBuffer.jumpWindowMs + 20,
  );
  const waitMs = Math.max(0, recoveryStart.epochMs + targetOffsetMs - Date.now());
  if (waitMs > 0) await sleep(waitMs);
  await performArenaRecoveryBufferedJump(attacker, 760);
  await sleep(220);

  const evidence = await Promise.all(entries.map(readUiEvidence));
  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) {
    throw new Error(`M131 incomplete jump-buffer evidence: ${JSON.stringify(evidence)}`);
  }
  if (attackerResult.acceptance?.scenario !== "uijumpbuffer"
    || defenderResult.acceptance?.scenario !== "uijumpbuffer") {
    throw new Error(`M131 authoritative acceptance hook was not active: ${JSON.stringify(evidence)}`);
  }

  const keyTransitions = attackerResult.keyTransitions.slice(keyTransitionOffset);
  const jumpDowns = keyTransitions.filter((entry) => entry.type === "keydown" && entry.code === "Space");
  const jumpUps = keyTransitions.filter((entry) => entry.type === "keyup" && entry.code === "Space");
  const jumpDown = jumpDowns[0];
  const jumpUp = jumpUps[0];
  if (jumpDowns.length !== 1 || jumpUps.length !== 1
    || !Number.isFinite(jumpDown?.epochMs) || !Number.isFinite(jumpUp?.epochMs)
    || jumpUp.epochMs <= jumpDown.epochMs) {
    throw new Error(`M131 genuine held Space controls were not delivered exactly once: ${JSON.stringify(attackerResult.keyTransitions)}`);
  }

  const ownTransitions = attackerResult.acceptance.ownActionTransitions;
  const ownRecoveryIndex = ownTransitions.findIndex((entry) =>
    entry.action === COMBAT_ACTION.attackRecovery && Number.isFinite(entry.epochMs));
  const ownJumpIndex = ownTransitions.findIndex((entry, index) =>
    index > ownRecoveryIndex && entry.action === COMBAT_ACTION.jump && Number.isFinite(entry.epochMs));
  const ownIdleIndex = ownTransitions.findIndex((entry, index) =>
    index > ownJumpIndex && entry.action === COMBAT_ACTION.idle && Number.isFinite(entry.epochMs));
  if (ownRecoveryIndex < 0 || ownJumpIndex <= ownRecoveryIndex || ownIdleIndex <= ownJumpIndex) {
    throw new Error(`M131 authority did not show attack-recovery -> jump -> idle: ${JSON.stringify(ownTransitions)}`);
  }
  const ownRecovery = ownTransitions[ownRecoveryIndex];
  const ownJump = ownTransitions[ownJumpIndex];
  const ownIdle = ownTransitions[ownIdleIndex];
  const ownJumpCount = ownTransitions.slice(ownRecoveryIndex + 1)
    .filter((entry) => entry.action === COMBAT_ACTION.jump).length;
  if (ownJumpCount !== 1) {
    throw new Error(`M131 held Space repeated authoritative jump: ${JSON.stringify(ownTransitions)}`);
  }

  const observedRecoveryBeforeKeyMs = jumpDown.epochMs - ownRecovery.epochMs;
  const observedKeyToJumpMs = ownJump.epochMs - jumpDown.epochMs;
  const lateRecoveryFloorMs = Math.max(
    0,
    COMBAT.attack.recoveryMs - COMBAT.inputBuffer.jumpWindowMs - 55,
  );
  if (observedRecoveryBeforeKeyMs < lateRecoveryFloorMs
    || observedKeyToJumpMs <= 0
    || observedKeyToJumpMs > COMBAT.inputBuffer.jumpWindowMs + 110) {
    throw new Error(`M131 Space was not a late recovery input before authoritative jump: ${JSON.stringify({
      ownRecovery,
      jumpDown,
      ownJump,
      observedRecoveryBeforeKeyMs,
      observedKeyToJumpMs,
    })}`);
  }
  if (ownIdle.epochMs >= jumpUp.epochMs) {
    throw new Error(`M131 Space was released before authoritative jump finished, so no-repeat proof is invalid: ${JSON.stringify({
      ownJump,
      ownIdle,
      jumpUp,
    })}`);
  }

  const focusTransitions = defenderResult.acceptance.focusActionTransitions;
  const focusRecoveryIndex = focusTransitions.findIndex((entry) =>
    entry.action === COMBAT_ACTION.attackRecovery && Number.isFinite(entry.epochMs));
  const focusJumpIndex = focusTransitions.findIndex((entry, index) =>
    index > focusRecoveryIndex && entry.action === COMBAT_ACTION.jump && Number.isFinite(entry.epochMs));
  const focusIdleIndex = focusTransitions.findIndex((entry, index) =>
    index > focusJumpIndex && entry.action === COMBAT_ACTION.idle && Number.isFinite(entry.epochMs));
  if (focusRecoveryIndex < 0 || focusJumpIndex <= focusRecoveryIndex || focusIdleIndex <= focusJumpIndex) {
    throw new Error(`M131 Firefox did not replicate attack-recovery -> jump -> idle for Chrome: ${JSON.stringify(focusTransitions)}`);
  }
  const focusJumpCount = focusTransitions.slice(focusRecoveryIndex + 1)
    .filter((entry) => entry.action === COMBAT_ACTION.jump).length;
  if (focusJumpCount !== 1) {
    throw new Error(`M131 Firefox observed repeated jump while Space remained held: ${JSON.stringify(focusTransitions)}`);
  }

  if (attackerResult.playerHp !== 100 || attackerResult.playerGuard !== 100
    || attackerResult.opponentHp !== 66
    || defenderResult.playerHp !== 66 || defenderResult.playerGuard !== 100) {
    throw new Error(`M131 buffered jump changed the one-hit authoritative exchange: ${JSON.stringify(evidence)}`);
  }
  if (attackerResult.feedbackTransitions.includes("parried")
    || defenderResult.feedbackTransitions.includes("parry-success")) {
    throw new Error(`M131 jump-buffer flight accidentally resolved as parry: ${JSON.stringify(evidence)}`);
  }

  return evidence.map((entry) => ({
    ...entry,
    jumpBufferKeyDownEpochMs: entry.browser === attacker.name ? jumpDown.epochMs : null,
    jumpBufferRecoveryEpochMs: entry.browser === attacker.name ? ownRecovery.epochMs : null,
    jumpBufferJumpEpochMs: entry.browser === attacker.name ? ownJump.epochMs : null,
    jumpBufferIdleEpochMs: entry.browser === attacker.name ? ownIdle.epochMs : null,
  }));
}

async function runOnlineUiJumpAttackFlight(entries, expectedScenario = "uijumpattack") {
  const staged = await prepareHeavyCounterplayFlight(
    entries,
    "M136 real jump attack chord",
    { attackerName: "chrome", defenderName: "firefox", movementMs: 180 },
  );
  const { attacker, defender, attackerElementId, movementCode } = staged;
  const attackOffset = movementCode === "KeyD" ? 200 : -200;
  const beforeAttacker = await readUiEvidence(attacker);
  const keyTransitionOffset = beforeAttacker.keyTransitions.length;
  const pointerOffset = beforeAttacker.pointers.length;

  // M136 first-red: an in-command W3C pointerMove allowed 138ms between
  // physical Space DOWN and LMB DOWN on a loaded Chrome driver. Pre-aim
  // while still Idle, then reuse the already-qualified M335 pointer-first
  // single native W3C chord. The strict <=60ms physical timing, 42HP World
  // HIT, both browser replicas and phase/guard checks remain unchanged.
  await aimArena(attacker, attackerElementId, attackOffset);
  await performArenaPreAimedJumpAttackChord(attacker, 90);

  const deadline = Date.now() + 1800;
  let evidence = null;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerResult = states.find((entry) => entry.browser === attacker.name);
    const defenderResult = states.find((entry) => entry.browser === defender.name);
    const ownTransitions = attackerResult?.acceptance?.ownActionTransitions ?? [];
    const windupIndex = ownTransitions.findIndex((entry) => entry.action === COMBAT_ACTION.jumpAttackWindup);
    const activeIndex = ownTransitions.findIndex((entry, index) =>
      index > windupIndex && entry.action === COMBAT_ACTION.jumpAttackActive);
    const recoveryIndex = ownTransitions.findIndex((entry, index) =>
      index > activeIndex && entry.action === COMBAT_ACTION.jumpAttackRecovery);
    const idleIndex = ownTransitions.findIndex((entry, index) =>
      index > recoveryIndex && entry.action === COMBAT_ACTION.idle);
    const focusTransitions = defenderResult?.acceptance?.focusActionTransitions ?? [];
    const focusWindupIndex = focusTransitions.findIndex((entry) => entry.action === COMBAT_ACTION.jumpAttackWindup);
    const focusActiveIndex = focusTransitions.findIndex((entry, index) =>
      index > focusWindupIndex && entry.action === COMBAT_ACTION.jumpAttackActive);
    const focusRecoveryIndex = focusTransitions.findIndex((entry, index) =>
      index > focusActiveIndex && entry.action === COMBAT_ACTION.jumpAttackRecovery);
    const focusIdleIndex = focusTransitions.findIndex((entry, index) =>
      index > focusRecoveryIndex && entry.action === COMBAT_ACTION.idle);
    if (attackerResult?.opponentHp === 58
      && defenderResult?.playerHp === 58
      && windupIndex >= 0
      && activeIndex > windupIndex
      && recoveryIndex > activeIndex
      && idleIndex > recoveryIndex
      && focusWindupIndex >= 0
      && focusActiveIndex > focusWindupIndex
      && focusRecoveryIndex > focusActiveIndex
      && focusIdleIndex > focusRecoveryIndex) {
      evidence = states;
      break;
    }
    if ((Number.isFinite(defenderResult?.playerHp) && defenderResult.playerHp < 58)
      || (Number.isFinite(attackerResult?.playerHp) && attackerResult.playerHp < 100)) {
      throw new Error(`M136 resolved an unexpected exchange: ${JSON.stringify(states)}`);
    }
    await sleep(20);
  }
  if (!evidence) {
    throw new Error(`M136 did not observe the real authoritative jump-attack lifecycle: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
  }

  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) {
    throw new Error(`M136 incomplete jump-attack evidence: ${JSON.stringify(evidence)}`);
  }
  if (attackerResult.acceptance?.scenario !== expectedScenario
    || defenderResult.acceptance?.scenario !== expectedScenario) {
    throw new Error(`M136 authoritative acceptance hook was not active: ${JSON.stringify(evidence)}`);
  }

  const keyTransitions = attackerResult.keyTransitions.slice(keyTransitionOffset);
  const pointerTransitions = attackerResult.pointers.slice(pointerOffset);
  const jumpDowns = keyTransitions.filter((entry) => entry.type === "keydown" && entry.code === "Space");
  const jumpUps = keyTransitions.filter((entry) => entry.type === "keyup" && entry.code === "Space");
  const attackDowns = pointerTransitions.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
  const attackUps = pointerTransitions.filter((entry) => entry.type === "pointerup" && entry.button === 0);
  const jumpDown = jumpDowns[0];
  const attackDown = attackDowns[0];
  if (jumpDowns.length !== 1 || jumpUps.length !== 1
    || attackDowns.length !== 1 || attackUps.length !== 1
    || !Number.isFinite(jumpDown?.epochMs) || !Number.isFinite(attackDown?.epochMs)
    || Math.abs(jumpDown.epochMs - attackDown.epochMs) > 60) {
    throw new Error(`M136 did not deliver one genuine same-tick Space + LMB chord: ${JSON.stringify({
      keyTransitions,
      pointerTransitions,
    })}`);
  }

  const ownTransitions = attackerResult.acceptance.ownActionTransitions;
  const ownWindupIndex = ownTransitions.findIndex((entry) =>
    entry.action === COMBAT_ACTION.jumpAttackWindup && Number.isFinite(entry.epochMs));
  const ownActiveIndex = ownTransitions.findIndex((entry, index) =>
    index > ownWindupIndex && entry.action === COMBAT_ACTION.jumpAttackActive && Number.isFinite(entry.epochMs));
  const ownRecoveryIndex = ownTransitions.findIndex((entry, index) =>
    index > ownActiveIndex && entry.action === COMBAT_ACTION.jumpAttackRecovery && Number.isFinite(entry.epochMs));
  const ownIdleIndex = ownTransitions.findIndex((entry, index) =>
    index > ownRecoveryIndex && entry.action === COMBAT_ACTION.idle && Number.isFinite(entry.epochMs));
  const ownPlainJumpIndex = ownTransitions.findIndex((entry) => entry.action === COMBAT_ACTION.jump);
  if (ownWindupIndex < 0 || ownActiveIndex <= ownWindupIndex
    || ownRecoveryIndex <= ownActiveIndex || ownIdleIndex <= ownRecoveryIndex
    || (ownPlainJumpIndex >= 0 && ownPlainJumpIndex < ownWindupIndex)) {
    throw new Error(`M136 authority did not execute direct jump-attack commitment: ${JSON.stringify(ownTransitions)}`);
  }

  const focusTransitions = defenderResult.acceptance.focusActionTransitions;
  const focusWindupIndex = focusTransitions.findIndex((entry) => entry.action === COMBAT_ACTION.jumpAttackWindup);
  const focusActiveIndex = focusTransitions.findIndex((entry, index) =>
    index > focusWindupIndex && entry.action === COMBAT_ACTION.jumpAttackActive);
  const focusRecoveryIndex = focusTransitions.findIndex((entry, index) =>
    index > focusActiveIndex && entry.action === COMBAT_ACTION.jumpAttackRecovery);
  const focusIdleIndex = focusTransitions.findIndex((entry, index) =>
    index > focusRecoveryIndex && entry.action === COMBAT_ACTION.idle);
  if (focusWindupIndex < 0 || focusActiveIndex <= focusWindupIndex
    || focusRecoveryIndex <= focusActiveIndex || focusIdleIndex <= focusRecoveryIndex) {
    throw new Error(`M136 Firefox did not replicate the jump-attack lifecycle: ${JSON.stringify(focusTransitions)}`);
  }

  const chordEpochMs = Math.max(jumpDown.epochMs, attackDown.epochMs);
  const authoritativeWindup = ownTransitions[ownWindupIndex];
  if (authoritativeWindup.epochMs < chordEpochMs
    || authoritativeWindup.epochMs - chordEpochMs > 220) {
    throw new Error(`M136 authoritative jump attack did not follow the real chord promptly: ${JSON.stringify({
      jumpDown,
      attackDown,
      authoritativeWindup,
    })}`);
  }

  if (attackerResult.playerHp !== 100 || attackerResult.playerGuard !== 100
    || attackerResult.opponentHp !== 58
    || defenderResult.playerHp !== 58 || defenderResult.playerGuard !== 100) {
    throw new Error(`M136 jump attack did not resolve as one clean 42 HP hit: ${JSON.stringify(evidence)}`);
  }
  if (attackerResult.feedbackTransitions.includes("parried")
    || defenderResult.feedbackTransitions.includes("parry-success")) {
    throw new Error(`M136 jump-attack flight accidentally resolved as parry: ${JSON.stringify(evidence)}`);
  }

  // Diagnostic only, after existing strict real Space+LMB chord,
  // authoritative direct jumpAttack, exactly one 42HP hit and no parry.
  // All timestamps below come from the same Chrome actor browser observer.
  console.log("M218_SUCCESSFUL_JUMP_ATTACK_LATENCY " + JSON.stringify(
    summarizeM218JumpAttackLatency({
      sameBrowserClock: true,
      jumpDown,
      attackDown,
      observedWindup: authoritativeWindup,
      eventTransitions: attackerResult.eventTransitions,
    }),
  ));

  let finalEvidence = evidence;
  if (expectedScenario === "uijumpattack") {
    await runM172AirborneDenialPhase(entries, attacker, defender, attackerElementId, movementCode);
    finalEvidence = await runM173JumpAttackChordDenialPhase(
      entries,
      attacker,
      defender,
      attackerElementId,
      movementCode,
    );
  }
  return finalEvidence.map((entry) => ({
    ...entry,
    jumpAttackChordEpochMs: entry.browser === attacker.name ? chordEpochMs : null,
    jumpAttackWindupEpochMs: entry.browser === attacker.name ? authoritativeWindup.epochMs : null,
  }));
}

async function runM172AirborneDenialPhase(entries, attacker, defender, attackerElementId, movementCode) {
  const milestone = "M172 confirmed airborne jump-attack denial";
  const attackOffset = movementCode === "KeyD" ? 200 : -200;
  const awayKey = movementCode === "KeyD" ? "a" : "d";
  const awayOffset = -attackOffset;
  await aimArena(attacker, attackerElementId, awayOffset);

  const waitForAttacker = async (predicate, timeoutMs, label) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const state = await readUiEvidence(attacker);
      if (predicate(state)) return state;
      await sleep(12);
    }
    throw new Error(milestone + " timed out waiting for " + label + ": "
      + JSON.stringify(await readUiEvidence(attacker)));
  };

  await waitForAttacker(
    (state) => state.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle,
    900,
    "idle after the successful jump attack",
  );

  // Leave half the conversion cost as headroom for regeneration while the
  // processed ACK waits for a fresh own snapshot. A 23 -> 9 setup can become
  // 12 at confirmation; the client correctly refuses that stamina claim.
  const setupStaminaExclusiveMax = COMBAT.jump.staminaCost
    + Math.floor(COMBAT.jumpAttack.staminaCost / 2);
  let ready = null;
  let drainHolds = 0;
  for (let index = 0; index < 8 && !ready; index += 1) {
    const state = await readUiEvidence(attacker);
    const stamina = state.acceptance?.authoritativeStamina;
    const idle = state.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle;
    if (Number.isFinite(stamina)
      && stamina >= COMBAT.jump.staminaCost
      && stamina < setupStaminaExclusiveMax
      && idle) {
      ready = state;
      break;
    }
    if (Number.isFinite(stamina) && stamina < COMBAT.jump.staminaCost) {
      ready = await waitForAttacker(
        (candidate) => Number.isFinite(candidate.acceptance?.authoritativeStamina)
          && candidate.acceptance.authoritativeStamina >= COMBAT.jump.staminaCost + 2
          && candidate.acceptance.authoritativeStamina
            < setupStaminaExclusiveMax
          && candidate.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle,
        1600,
        "regen into the jump-only stamina window",
      );
      break;
    }
    const holdMs = !Number.isFinite(stamina) || stamina > 48 ? 1100
      : stamina > 34 ? 750
        : stamina > 27 ? 480
          : 330;
    await performArenaRunHold(attacker, attackerElementId, awayKey, awayOffset, holdMs);
    drainHolds += 1;
    await sleep(140);
  }
  if (!ready) {
    throw new Error(milestone + " could not establish 14-19 authoritative stamina: "
      + JSON.stringify(await readUiEvidence(attacker)));
  }

  const staminaBeforeJump = Math.round(ready.acceptance.authoritativeStamina);
  const jumpActionOffset = ready.acceptance.ownActionTransitions.length;
  const keyOffset = ready.keyTransitions.length;
  const defenderBefore = await readUiEvidence(defender);
  const focusOffset = defenderBefore.acceptance?.focusActionTransitions?.length ?? 0;

  await performArenaJumpPress(attacker, 45);
  const airborne = await waitForAttacker(
    (state) => {
      const actions = state.acceptance?.ownActionTransitions?.slice(jumpActionOffset) ?? [];
      return actions.at(-1)?.action === COMBAT_ACTION.jump
        && Number.isFinite(state.acceptance?.authoritativeStamina)
        && state.acceptance.authoritativeStamina < COMBAT.jumpAttack.staminaCost;
    },
    700,
    "ordinary jump with sub-conversion stamina",
  );
  const airborneStamina = Math.round(airborne.acceptance.authoritativeStamina);
  const jumpKeys = airborne.keyTransitions.slice(keyOffset).filter((entry) => entry.code === "Space");
  const jumpDown = jumpKeys.find((entry) => entry.type === "keydown");
  const jumpUp = jumpKeys.find((entry) => entry.type === "keyup");
  if (!jumpDown || !jumpUp || !Number.isFinite(jumpDown.epochMs) || !Number.isFinite(jumpUp.epochMs)
    || jumpUp.epochMs <= jumpDown.epochMs) {
    throw new Error(milestone + " did not record one genuine Space jump: " + JSON.stringify(jumpKeys));
  }

  const conversionActionOffset = airborne.acceptance.ownActionTransitions.length;
  const staminaOffset = airborne.acceptance.staminaTransitions.length;
  const denialOffset = airborne.acceptance?.staminaDenialTransitions?.length ?? 0;
  const pointerOffset = airborne.pointers.length;
  const eventOffset = airborne.events.length;
  const feedbackOffset = airborne.feedbackTransitions.length;
  // The pointer is already aimed away. Keep a positive 5ms hold for strict down/up chronology;
  // another pointer move and hold consume the short airborne denial window.
  await performArenaM221GuardBreakClick(attacker, 5);

  const rejected = await waitForAttacker(
    (state) => {
      const transitions = state.acceptance?.staminaDenialTransitions?.slice(denialOffset) ?? [];
      return transitions.some((entry) => entry.stage === "shown" && entry.action === "jump-attack")
        && state.events.slice(eventOffset).includes("Low stamina — jump attack needs 12.")
        && state.feedbackTransitions.slice(feedbackOffset).includes("stamina-denied");
    },
    900,
    "confirmed low-stamina airborne conversion denial",
  );

  const pointers = rejected.pointers.slice(pointerOffset);
  const lightDown = pointers.find((entry) => entry.type === "pointerdown" && entry.button === 0);
  const lightUp = pointers.find((entry) => entry.type === "pointerup" && entry.button === 0);
  if (!lightDown || !lightUp || !Number.isFinite(lightDown.epochMs) || !Number.isFinite(lightUp.epochMs)
    || lightUp.epochMs <= lightDown.epochMs) {
    throw new Error(milestone + " did not record one genuine airborne LMB: " + JSON.stringify(pointers));
  }

  const actions = rejected.acceptance?.ownActionTransitions?.slice(conversionActionOffset) ?? [];
  if (actions.some((entry) => entry.action === COMBAT_ACTION.jumpAttackWindup
    || entry.action === COMBAT_ACTION.jumpAttackActive
    || entry.action === COMBAT_ACTION.jumpAttackRecovery)) {
    throw new Error(milestone + " rejected conversion entered jump attack: " + JSON.stringify(actions));
  }
  const staminaTransitions = rejected.acceptance?.staminaTransitions?.slice(staminaOffset) ?? [];
  const minimumStamina = staminaTransitions.reduce(
    (value, entry) => Number.isFinite(entry.stamina) ? Math.min(value, entry.stamina) : value,
    airborneStamina,
  );
  if (minimumStamina < airborneStamina - 1) {
    throw new Error(milestone + " rejected conversion spent jump-attack stamina: "
      + JSON.stringify({ airborneStamina, staminaTransitions }));
  }

  const transitions = rejected.acceptance?.staminaDenialTransitions?.slice(denialOffset) ?? [];
  const queuedIndex = transitions.findIndex((entry) => entry.stage === "queued" && entry.action === "jump-attack");
  const submittedIndex = transitions.findIndex((entry, index) =>
    index > queuedIndex && entry.stage === "submitted" && entry.action === "jump-attack");
  const rejectedIndex = transitions.findIndex((entry, index) =>
    index > submittedIndex && entry.stage === "confirmed-rejected" && entry.action === "jump-attack");
  const shownIndex = transitions.findIndex((entry, index) =>
    index > rejectedIndex && entry.stage === "shown" && entry.action === "jump-attack");
  if (queuedIndex < 0 || submittedIndex <= queuedIndex || rejectedIndex <= submittedIndex || shownIndex <= rejectedIndex) {
    throw new Error(milestone + " did not preserve denial lifecycle ordering: " + JSON.stringify(transitions));
  }
  const submitted = transitions[submittedIndex];
  const confirmed = transitions[rejectedIndex];
  if (!Number.isInteger(submitted.clientTick)
    || !Number.isInteger(confirmed.processedClientTick)
    || (confirmed.processedClientTick !== submitted.clientTick
      && !isTickNewer32(confirmed.processedClientTick, submitted.clientTick))
    || !Number.isFinite(confirmed.authoritativeStamina)
    || confirmed.authoritativeStamina >= COMBAT.jumpAttack.staminaCost) {
    throw new Error(milestone + " did not tie rejection to acknowledged sub-cost authority: "
      + JSON.stringify(transitions));
  }

  await waitForAttacker(
    (state) => state.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle,
    COMBAT.jump.durationMs + 700,
    "ordinary jump recovery to idle",
  );
  const states = await Promise.all(entries.map(readUiEvidence));
  const attackerFinal = states.find((entry) => entry.browser === attacker.name);
  const defenderFinal = states.find((entry) => entry.browser === defender.name);
  if (!attackerFinal || !defenderFinal) {
    throw new Error(milestone + " incomplete final evidence: " + JSON.stringify(states));
  }
  const focusActions = defenderFinal.acceptance?.focusActionTransitions?.slice(focusOffset) ?? [];
  if (focusActions.some((entry) => entry.action === COMBAT_ACTION.jumpAttackWindup
    || entry.action === COMBAT_ACTION.jumpAttackActive
    || entry.action === COMBAT_ACTION.jumpAttackRecovery)) {
    throw new Error(milestone + " remote client observed a rejected jump attack: " + JSON.stringify(focusActions));
  }
  if (attackerFinal.playerHp !== ready.playerHp
    || attackerFinal.playerGuard !== ready.playerGuard
    || attackerFinal.opponentHp !== ready.opponentHp
    || attackerFinal.opponentGuard !== ready.opponentGuard
    || defenderFinal.playerHp !== defenderBefore.playerHp
    || defenderFinal.playerGuard !== defenderBefore.playerGuard) {
    throw new Error(milestone + " denial phase changed combat vitals: " + JSON.stringify(states));
  }

  return states.map((entry) => ({
    ...entry,
    m172DrainHolds: entry.browser === attacker.name ? drainHolds : null,
    m172StaminaBeforeJump: entry.browser === attacker.name ? staminaBeforeJump : null,
    m172AirborneStamina: entry.browser === attacker.name ? airborneStamina : null,
    m172SubmittedTick: entry.browser === attacker.name ? submitted.clientTick : null,
    m172ProcessedTick: entry.browser === attacker.name ? confirmed.processedClientTick : null,
    m172Denied: entry.browser === attacker.name ? true : null,
  }));
}

async function runM173JumpAttackChordDenialPhase(entries, attacker, defender, attackerElementId, movementCode) {
  const milestone = "M173 confirmed jump-attack chord denial";
  const attackOffset = movementCode === "KeyD" ? 200 : -200;
  const awayKey = movementCode === "KeyD" ? "a" : "d";
  const awayOffset = -attackOffset;
  await aimArena(attacker, attackerElementId, awayOffset);

  const waitForAttacker = async (predicate, timeoutMs, label) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const state = await readUiEvidence(attacker);
      if (predicate(state)) return state;
      await sleep(12);
    }
    throw new Error(milestone + " timed out waiting for " + label + ": "
      + JSON.stringify(await readUiEvidence(attacker)));
  };

  await waitForAttacker(
    (state) => state.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle,
    900,
    "idle before low-stamina chord",
  );

  let ready = null;
  let drainHolds = 0;
  for (let index = 0; index < 8 && !ready; index += 1) {
    const state = await readUiEvidence(attacker);
    const stamina = state.acceptance?.authoritativeStamina;
    const idle = state.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle;
    if (Number.isFinite(stamina)
      && stamina >= COMBAT.jump.staminaCost
      && stamina < COMBAT.jump.staminaCost + COMBAT.jumpAttack.staminaCost
      && idle) {
      ready = state;
      break;
    }
    if (Number.isFinite(stamina) && stamina < COMBAT.jump.staminaCost) {
      ready = await waitForAttacker(
        (candidate) => Number.isFinite(candidate.acceptance?.authoritativeStamina)
          && candidate.acceptance.authoritativeStamina >= COMBAT.jump.staminaCost + 2
          && candidate.acceptance.authoritativeStamina
            < COMBAT.jump.staminaCost + COMBAT.jumpAttack.staminaCost
          && candidate.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle,
        1800,
        "regen into the jump-only chord window",
      );
      break;
    }
    const holdMs = !Number.isFinite(stamina) || stamina > 48 ? 1100
      : stamina > 34 ? 750
        : stamina > 27 ? 480
          : 330;
    await performArenaRunHold(attacker, attackerElementId, awayKey, awayOffset, holdMs);
    drainHolds += 1;
    await sleep(140);
  }
  if (!ready) {
    throw new Error(milestone + " could not establish 14-25 authoritative stamina: "
      + JSON.stringify(await readUiEvidence(attacker)));
  }

  const baselineStamina = ready.acceptance.authoritativeStamina;
  // Only World events after this physical attempt may qualify its jump cost.
  const worldStaminaProofOffset = m201ServerOutput().length;
  const actionOffset = ready.acceptance.ownActionTransitions.length;
  const staminaOffset = ready.acceptance.staminaTransitions.length;
  const denialOffset = ready.acceptance?.staminaDenialTransitions?.length ?? 0;
  const keyOffset = ready.keyTransitions.length;
  const pointerOffset = ready.pointers.length;
  const eventOffset = ready.events.length;
  const feedbackOffset = ready.feedbackTransitions.length;
  const defenderBefore = await readUiEvidence(defender);
  const focusOffset = defenderBefore.acceptance?.focusActionTransitions?.length ?? 0;

  await performArenaPreAimedJumpAttackChord(attacker, 90);

  const rejected = await waitForAttacker(
    (state) => {
      const transitions = state.acceptance?.staminaDenialTransitions?.slice(denialOffset) ?? [];
      const actions = state.acceptance?.ownActionTransitions?.slice(actionOffset) ?? [];
      return transitions.some((entry) => entry.stage === "shown" && entry.action === "jump-attack-chord")
        && actions.some((entry) => entry.action === COMBAT_ACTION.jump)
        && state.events.slice(eventOffset).includes("Low stamina — jump attack needs 26.")
        && state.feedbackTransitions.slice(feedbackOffset).includes("stamina-denied");
    },
    1000,
    "confirmed low-stamina same-tick jump-attack chord denial",
  );

  const keys = rejected.keyTransitions.slice(keyOffset).filter((entry) => entry.code === "Space");
  const pointers = rejected.pointers.slice(pointerOffset).filter((entry) => entry.button === 0);
  const jumpDowns = keys.filter((entry) => entry.type === "keydown");
  const jumpUps = keys.filter((entry) => entry.type === "keyup");
  const attackDowns = pointers.filter((entry) => entry.type === "pointerdown");
  const attackUps = pointers.filter((entry) => entry.type === "pointerup");
  const jumpDown = jumpDowns[0];
  const attackDown = attackDowns[0];
  if (jumpDowns.length !== 1 || jumpUps.length !== 1 || attackDowns.length !== 1 || attackUps.length !== 1
    || !Number.isFinite(jumpDown?.epochMs) || !Number.isFinite(attackDown?.epochMs)
    || Math.abs(jumpDown.epochMs - attackDown.epochMs) > 60) {
    throw new Error(milestone + " did not record one genuine same-tick Space + LMB chord: "
      + JSON.stringify({ keys, pointers }));
  }

  const actions = rejected.acceptance?.ownActionTransitions?.slice(actionOffset) ?? [];
  const jumpIndex = actions.findIndex((entry) => entry.action === COMBAT_ACTION.jump);
  if (jumpIndex < 0 || actions.some((entry) =>
    entry.action === COMBAT_ACTION.jumpAttackWindup
    || entry.action === COMBAT_ACTION.jumpAttackActive
    || entry.action === COMBAT_ACTION.jumpAttackRecovery)) {
    throw new Error(milestone + " did not degrade exclusively to ordinary Jump: " + JSON.stringify(actions));
  }

  const staminaTransitions = rejected.acceptance?.staminaTransitions?.slice(staminaOffset) ?? [];
  let minimumStamina = baselineStamina;
  let minimumIndex = -1;
  for (let index = 0; index < staminaTransitions.length; index += 1) {
    const stamina = staminaTransitions[index]?.stamina;
    if (Number.isFinite(stamina) && stamina < minimumStamina) {
      minimumStamina = stamina;
      minimumIndex = index;
    }
  }
  // A snapshot taken several World ticks before the chord is not a valid
  // pre-spend baseline: the server may regenerate stamina in the meantime.
  // Require exact original-World same-tick before/after proof instead.
  const worldJumpSpend = verifyM173WorldJumpSpend(
    m201ServerOutput().slice(worldStaminaProofOffset),
    ready.acceptance.playerNetId,
    COMBAT.jump.staminaCost,
  );
  const expectedAfterJump = worldJumpSpend.after;
  if (minimumIndex < 0 || minimumStamina < expectedAfterJump - 1
      || minimumStamina > expectedAfterJump + 1) {
    throw new Error(milestone + " replicated stamina disagrees with exact original World cost: "
      + JSON.stringify({ baselineStamina, worldJumpSpend, minimumStamina, staminaTransitions }));
  }
  console.log("M173_ORIGINAL_WORLD_JUMP_SPEND_PROOF " + JSON.stringify({
    actor: ready.acceptance.playerNetId,
    baselineStamina,
    worldJumpSpend,
    minimumStamina,
    staminaTransitions,
  }));

  const transitions = rejected.acceptance?.staminaDenialTransitions?.slice(denialOffset) ?? [];
  const queuedIndex = transitions.findIndex((entry) =>
    entry.stage === "queued" && entry.action === "jump-attack-chord");
  const submittedIndex = transitions.findIndex((entry, index) =>
    index > queuedIndex && entry.stage === "submitted" && entry.action === "jump-attack-chord");
  const rejectedIndex = transitions.findIndex((entry, index) =>
    index > submittedIndex && entry.stage === "confirmed-rejected" && entry.action === "jump-attack-chord");
  const shownIndex = transitions.findIndex((entry, index) =>
    index > rejectedIndex && entry.stage === "shown" && entry.action === "jump-attack-chord");
  if (queuedIndex < 0 || submittedIndex <= queuedIndex || rejectedIndex <= submittedIndex || shownIndex <= rejectedIndex) {
    throw new Error(milestone + " did not preserve denial lifecycle ordering: " + JSON.stringify(transitions));
  }
  const queued = transitions[queuedIndex];
  const submitted = transitions[submittedIndex];
  const confirmed = transitions[rejectedIndex];
  const shown = transitions[shownIndex];
  if (!Number.isInteger(submitted.clientTick)
    || !Number.isInteger(confirmed.processedClientTick)
    || (confirmed.processedClientTick !== submitted.clientTick
      && !isTickNewer32(confirmed.processedClientTick, submitted.clientTick))
    || !Number.isFinite(confirmed.authoritativeStamina)
    || baselineStamina >= COMBAT.jump.staminaCost + COMBAT.jumpAttack.staminaCost
    || shown.epochMs < confirmed.epochMs) {
    throw new Error(milestone + " did not tie visible downgrade to acknowledged sub-cost authority: "
      + JSON.stringify({ baselineStamina, transitions }));
  }

  await waitForAttacker(
    (state) => state.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle,
    COMBAT.jump.durationMs + 700,
    "fallback jump recovery to idle",
  );

  const states = await Promise.all(entries.map(readUiEvidence));
  const attackerFinal = states.find((entry) => entry.browser === attacker.name);
  const defenderFinal = states.find((entry) => entry.browser === defender.name);
  if (!attackerFinal || !defenderFinal) {
    throw new Error(milestone + " incomplete final evidence: " + JSON.stringify(states));
  }
  const focusActions = defenderFinal.acceptance?.focusActionTransitions?.slice(focusOffset) ?? [];
  if (!focusActions.some((entry) => entry.action === COMBAT_ACTION.jump)
    || focusActions.some((entry) =>
      entry.action === COMBAT_ACTION.jumpAttackWindup
      || entry.action === COMBAT_ACTION.jumpAttackActive
      || entry.action === COMBAT_ACTION.jumpAttackRecovery)) {
    throw new Error(milestone + " remote client did not replicate only the fallback Jump: "
      + JSON.stringify(focusActions));
  }
  if (attackerFinal.playerHp !== ready.playerHp
    || attackerFinal.playerGuard !== ready.playerGuard
    || attackerFinal.opponentHp !== ready.opponentHp
    || attackerFinal.opponentGuard !== ready.opponentGuard
    || defenderFinal.playerHp !== defenderBefore.playerHp
    || defenderFinal.playerGuard !== defenderBefore.playerGuard) {
    throw new Error(milestone + " chord downgrade changed combat vitals: " + JSON.stringify(states));
  }

  return states.map((entry) => ({
    ...entry,
    m173DrainHolds: entry.browser === attacker.name ? drainHolds : null,
    m173BaselineStamina: entry.browser === attacker.name ? Math.round(baselineStamina) : null,
    m173SubmittedTick: entry.browser === attacker.name ? submitted.clientTick : null,
    m173ProcessedTick: entry.browser === attacker.name ? confirmed.processedClientTick : null,
    m173DeniedChord: entry.browser === attacker.name ? true : null,
    m173QueuedEpochMs: entry.browser === attacker.name ? queued.epochMs : null,
    m173ShownEpochMs: entry.browser === attacker.name ? shown.epochMs : null,
  }));
}

async function runOnlineUiJumpAttackCounterplayFlight(entries, defense) {
  const scenarioName = `uijumpattack${defense}`;
  // Keep the latency-sensitive parry/dodge wheel input on Chrome. Firefox
  // remains the genuine jump attacker, preserving cross-browser counterplay,
  // while avoiding highly variable Marionette wheel-command latency after
  // authoritative windup replication. Block retains the opposite direction.
  const attackerName = defense === "block" ? "chrome" : "firefox";
  const defenderName = defense === "block" ? "firefox" : "chrome";
  // Keep dodge slightly farther apart so its wheel-forward can establish
  // overlap without forcing a first-tick collision. Parry uses a small inward
  // staging margin: 140 ms leaves the 48 + 18 unit jump-hit boundary almost
  // exact under browser timing variance, which can turn a valid parry into a
  // pure geometric whiff even when Block is authoritative before JUMP STRIKE.
  // This changes acceptance setup only; gameplay reach and timing stay fixed.
  const movementMs = defense === "block" ? 180 : defense === "parry" ? 170 : 140;
  const label = `M138 jump attack ${defense}`;
  const staged = await prepareHeavyCounterplayFlight(
    entries,
    label,
    { attackerName, defenderName, movementMs },
  );
  const { attacker, defender, attackerElementId, defenderElementId, movementCode } = staged;
  const attackOffset = movementCode === "KeyD" ? 200 : -200;
  // M138's 105ms windup is shorter than ordinary M33 light. The previous
  // hardcoded 70ms Chrome wheel pause reached the game after jump impact
  // on all 3 genuine CI tries (#39180123977). Before the real exchange,
  // measure each browser's trusted pointer and wheel latency, target wheel
  // ~25ms after jump chord pointerDOWN, and reset strict evidence afterward.
  const jumpParryIngress = defense === "parry"
    ? await calibrateNativeParryIngress(
      attacker, defender, attackerElementId, defenderElementId, attackOffset, 25,
    )
    : null;
  if (jumpParryIngress) await Promise.all(entries.map(installUiObserver));
  const beforeAttacker = await readUiEvidence(attacker);
  const keyTransitionOffset = beforeAttacker.keyTransitions.length;
  const pointerOffset = beforeAttacker.pointers.length;
  const beforeDefender = await readUiEvidence(defender);
  const wheelOffset = beforeDefender.wheels.length;
  const hasReplicatedDodgeOverlap = (attackerState, defenderState) => {
    const attackerOwn = attackerState?.acceptance?.ownActionTransitions ?? [];
    const attackerFocus = attackerState?.acceptance?.focusActionTransitions ?? [];
    const defenderOwn = defenderState?.acceptance?.ownActionTransitions ?? [];
    const defenderFocus = defenderState?.acceptance?.focusActionTransitions ?? [];

    const intervalContains = (transitions, action, recoveryAction, tick) => {
      const startIndex = transitions.findIndex((entry) =>
        entry.action === action && Number.isFinite(entry.serverTick));
      if (startIndex < 0 || !Number.isFinite(tick)) return false;
      const start = transitions[startIndex];
      const recovery = transitions.find((entry, index) =>
        index > startIndex && entry.action === recoveryAction && Number.isFinite(entry.serverTick));
      return Number.isFinite(recovery?.serverTick)
        && start.serverTick <= tick
        && tick < recovery.serverTick;
    };

    const attackerActive = attackerOwn.find((entry) =>
      entry.action === COMBAT_ACTION.jumpAttackActive && Number.isFinite(entry.serverTick));
    const defenderSeesActive = defenderFocus.find((entry) =>
      entry.action === COMBAT_ACTION.jumpAttackActive && Number.isFinite(entry.serverTick));
    return intervalContains(
      attackerFocus,
      COMBAT_ACTION.dodge,
      COMBAT_ACTION.dodgeRecovery,
      attackerActive?.serverTick,
    ) && intervalContains(
      defenderOwn,
      COMBAT_ACTION.dodge,
      COMBAT_ACTION.dodgeRecovery,
      defenderSeesActive?.serverTick,
    );
  };

  if (defense === "block") {
    // Two real wheel-back pulses 100 ms apart overlap the unchanged 240 ms
    // client short-block window. The second pulse extends input delivery
    // without restarting the authoritative Block action, so by jump-attack
    // impact its 125 ms parry opening has expired while block is still held.
    // This mirrors the proven M107 heavy-block strategy and removes a flaky
    // WebDriver read round-trip from the timing boundary.
    await scrollArenaWheelPair(defender, defenderElementId, 120, 20, 100);
    await performArenaJumpAttackChord(attacker, attackerElementId, attackOffset, 90);
  } else if (defense === "parry") {
    // Reuse per-browser real W3C ingress calibration, targeting one genuine
    // wheel ~25ms after the authentic Space+LMB pointerDOWN. The unchanged
    // 105ms jump windup and 125ms parry are narrow enough that hardcoded
    // 70ms wheel pause reached authoritative Active on 3/3 CI attempts.
    // Neither genuine input nor the strict stun/100HP/100guard proof changes.
    let chordHeld = false;
    const chordPromise = (async () => {
      if (jumpParryIngress.attackLeadMs > 0) await sleep(jumpParryIngress.attackLeadMs);
      await pressArenaJumpAttackChord(attacker, attackerElementId, attackOffset);
      chordHeld = true;
    })();
    try {
      await Promise.all([
        chordPromise,
        (async () => {
          if (jumpParryIngress.wheelLeadMs > 0) await sleep(jumpParryIngress.wheelLeadMs);
          await scrollArenaWheel(defender, defenderElementId, 120, 0);
        })(),
      ]);
      await sleep(20);
    } finally {
      await chordPromise.catch(() => {});
      if (chordHeld) await releaseArenaJumpAttackChord(attacker);
    }
  } else if (defense === "dodge") {
    // Keep the real Chrome wheel-forward independent of Firefox WebDriver's
    // chord-command response. CI observed Firefox's acknowledgment arriving
    // after jump impact, despite a genuine wheel being delivered. Dispatch
    // concurrently with a 20 ms pause in Chrome's own wheel action source;
    // the authoritative dodge/active-overlap and zero-damage assertions below
    // still reject premature roll collisions and late dodges. No combat
    // timings, iframes, geometry, or packet formats change.
    await aimArena(defender, defenderElementId, 0, 180);
    let chordHeld = false;
    const chordPromise = pressArenaJumpAttackChord(
      attacker, attackerElementId, attackOffset,
    ).then(() => { chordHeld = true; });
    try {
      await Promise.all([
        chordPromise,
        scrollArenaWheel(defender, defenderElementId, -120, 20),
      ]);
      await sleep(20);
    } finally {
      await chordPromise.catch(() => {});
      if (chordHeld) await releaseArenaJumpAttackChord(attacker);
    }
  } else {
    throw new Error(`unsupported M138 jump-attack defense: ${defense}`);
  }

  const deadline = Date.now() + 1600;
  let evidence = null;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerResult = states.find((entry) => entry.browser === attacker.name);
    const defenderResult = states.find((entry) => entry.browser === defender.name);
    if (!attackerResult || !defenderResult) {
      throw new Error(`${label} incomplete evidence: ${JSON.stringify(states)}`);
    }
    const ownTransitions = attackerResult.acceptance?.ownActionTransitions ?? [];
    const focusTransitions = defenderResult.acceptance?.focusActionTransitions ?? [];
    const ownWindupIndex = ownTransitions.findIndex((entry) => entry.action === COMBAT_ACTION.jumpAttackWindup);
    const ownActiveIndex = ownTransitions.findIndex((entry, index) =>
      index > ownWindupIndex && entry.action === COMBAT_ACTION.jumpAttackActive);
    const focusWindupIndex = focusTransitions.findIndex((entry) => entry.action === COMBAT_ACTION.jumpAttackWindup);
    const focusActiveIndex = focusTransitions.findIndex((entry, index) =>
      index > focusWindupIndex && entry.action === COMBAT_ACTION.jumpAttackActive);
    const windupSeen = ownWindupIndex >= 0 && focusWindupIndex >= 0;
    const activeSeen = ownActiveIndex > ownWindupIndex && focusActiveIndex > focusWindupIndex;
    const ownRecoveryIndex = ownTransitions.findIndex((entry, index) =>
      index > ownActiveIndex && entry.action === COMBAT_ACTION.jumpAttackRecovery);
    const focusRecoveryIndex = focusTransitions.findIndex((entry, index) =>
      index > focusActiveIndex && entry.action === COMBAT_ACTION.jumpAttackRecovery);
    const ownStunnedIndex = ownTransitions.findIndex((entry, index) =>
      index > ownWindupIndex && entry.action === COMBAT_ACTION.stunned);
    const focusStunnedIndex = focusTransitions.findIndex((entry, index) =>
      index > focusWindupIndex && entry.action === COMBAT_ACTION.stunned);
    const ownKnockdownIndex = ownTransitions.findIndex((entry) =>
      entry.action === COMBAT_ACTION.knockdown);
    const focusKnockdownIndex = focusTransitions.findIndex((entry, index) =>
      index > focusWindupIndex && entry.action === COMBAT_ACTION.knockdown);
    // The roll can replace jump windup before the attacker's own observer
    // samples that transient state. The defender focus stream still proves
    // authoritative jump commitment before the resulting knockdown.
    const rollCounter = defense === "dodge"
      && attackerResult.feedbackTransitions.includes("rolled-over")
      && defenderResult.feedbackTransitions.includes("roll-impact")
      && ownKnockdownIndex >= 0
      && focusWindupIndex >= 0
      && focusKnockdownIndex > focusWindupIndex;
    // A successful parry or roll collision can replace jump-attack-active before
    // it is replicated. The latter is an intended Wilds-style counter: the real
    // pointer roll reaches the attacker first and knocks the commitment down.
    const attackSeen = defense === "parry"
      ? windupSeen && ownStunnedIndex > ownWindupIndex && focusStunnedIndex > focusWindupIndex
      : defense === "dodge" && rollCounter
        ? focusWindupIndex >= 0
        : windupSeen && activeSeen;
    const terminalReplicated = defense === "parry"
      ? ownStunnedIndex > ownWindupIndex && focusStunnedIndex > focusWindupIndex
      : defense === "dodge" && rollCounter
        ? ownKnockdownIndex >= 0 && focusKnockdownIndex > focusWindupIndex
        : ownRecoveryIndex > ownActiveIndex && focusRecoveryIndex > focusActiveIndex;

    let resolved = false;
    if (defense === "block") {
      resolved = attackSeen
        && attackerResult.events.includes("Opponent blocked - guard -52.")
        && defenderResult.events.includes("Block held - guard -52.")
        && attackerResult.playerHp === 100
        && defenderResult.playerHp === 100
        && attackerResult.opponentHp === 100
        && defenderResult.playerGuard <= 48
        && defenderResult.playerGuard >= 46;
    } else if (defense === "parry") {
      const stunOverlaySeen = attackerResult.overlayTransitions.some((entry) =>
        entry.visible && entry.title === "STUNNED");
      resolved = attackSeen
        && attackerResult.feedbackTransitions.includes("parried")
        && defenderResult.feedbackTransitions.includes("parry-success")
        && stunOverlaySeen
        && attackerResult.playerHp === 100
        && attackerResult.playerGuard === 100
        && defenderResult.playerHp === 100
        && defenderResult.playerGuard === 100;
    } else {
      const iframeEvade = attackerResult.feedbackTransitions.includes("dodge-evaded")
        && defenderResult.feedbackTransitions.includes("dodge-success");
      const replicatedOverlap = hasReplicatedDodgeOverlap(attackerResult, defenderResult);
      resolved = attackSeen
        && (iframeEvade || replicatedOverlap || rollCounter)
        && attackerResult.playerHp === 100
        && attackerResult.playerGuard === 100
        && defenderResult.playerHp === 100
        && defenderResult.playerGuard === 100;
    }
    if (resolved && terminalReplicated) {
      evidence = states;
      break;
    }
    if (attackerResult.playerHp < 100 || defenderResult.playerHp < 100) {
      throw new Error(`${label} took unexpected HP damage: ${JSON.stringify(states)}`);
    }
    await sleep(20);
  }
  if (!evidence) {
    throw new Error(`${label} did not resolve: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
  }

  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (attackerResult.acceptance?.scenario !== scenarioName
    || defenderResult.acceptance?.scenario !== scenarioName) {
    throw new Error(`${label} authoritative acceptance hook was not active: ${JSON.stringify(evidence)}`);
  }

  const keyTransitions = attackerResult.keyTransitions.slice(keyTransitionOffset);
  const pointerTransitions = attackerResult.pointers.slice(pointerOffset);
  const jumpDowns = keyTransitions.filter((entry) => entry.type === "keydown" && entry.code === "Space");
  const jumpUps = keyTransitions.filter((entry) => entry.type === "keyup" && entry.code === "Space");
  const attackDowns = pointerTransitions.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
  const attackUps = pointerTransitions.filter((entry) => entry.type === "pointerup" && entry.button === 0);
  const jumpDown = jumpDowns[0];
  const attackDown = attackDowns[0];
  if (jumpDowns.length !== 1 || jumpUps.length !== 1
    || attackDowns.length !== 1 || attackUps.length !== 1
    || !Number.isFinite(jumpDown?.epochMs) || !Number.isFinite(attackDown?.epochMs)
    || Math.abs(jumpDown.epochMs - attackDown.epochMs) > 60) {
    throw new Error(`${label} did not deliver one genuine same-tick Space + LMB chord: ${JSON.stringify({
      keyTransitions,
      pointerTransitions,
    })}`);
  }

  const ownTransitions = attackerResult.acceptance.ownActionTransitions;
  const focusTransitions = defenderResult.acceptance.focusActionTransitions;
  const ownWindupIndex = ownTransitions.findIndex((entry) => entry.action === COMBAT_ACTION.jumpAttackWindup);
  const ownActiveIndex = ownTransitions.findIndex((entry, index) =>
    index > ownWindupIndex && entry.action === COMBAT_ACTION.jumpAttackActive);
  const focusWindupIndex = focusTransitions.findIndex((entry) => entry.action === COMBAT_ACTION.jumpAttackWindup);
  const focusActiveIndex = focusTransitions.findIndex((entry, index) =>
    index > focusWindupIndex && entry.action === COMBAT_ACTION.jumpAttackActive);
  const ownKnockdownIndex = ownTransitions.findIndex((entry) =>
    entry.action === COMBAT_ACTION.knockdown);
  const focusKnockdownIndex = focusTransitions.findIndex((entry, index) =>
    index > focusWindupIndex && entry.action === COMBAT_ACTION.knockdown);
  const rollCounter = defense === "dodge"
    && attackerResult.feedbackTransitions.includes("rolled-over")
    && defenderResult.feedbackTransitions.includes("roll-impact")
    && ownKnockdownIndex >= 0
    && focusWindupIndex >= 0
    && focusKnockdownIndex > focusWindupIndex;
  if ((!rollCounter && ownWindupIndex < 0) || focusWindupIndex < 0
    || (defense !== "parry" && !rollCounter
      && (ownActiveIndex <= ownWindupIndex || focusActiveIndex <= focusWindupIndex))) {
    throw new Error(`${label} did not preserve authoritative jump-attack commitment: ${JSON.stringify({
      ownTransitions,
      focusTransitions,
    })}`);
  }

  if (defense === "parry") {
    const ownStunnedIndex = ownTransitions.findIndex((entry, index) =>
      index > ownWindupIndex && entry.action === COMBAT_ACTION.stunned);
    const focusStunnedIndex = focusTransitions.findIndex((entry, index) =>
      index > focusWindupIndex && entry.action === COMBAT_ACTION.stunned);
    if (ownStunnedIndex <= ownWindupIndex || focusStunnedIndex <= focusWindupIndex) {
      throw new Error(`${label} did not replicate jump-attack windup -> stunned on parry: ${JSON.stringify({
        ownTransitions,
        focusTransitions,
      })}`);
    }
    if (!attackerResult.overlayTransitions.some((entry) => entry.visible && entry.title === "STUNNED")) {
      throw new Error(`${label} never exposed the parried attacker stun overlay`);
    }
  } else if (defense === "dodge" && rollCounter) {
    if (ownKnockdownIndex < 0 || focusKnockdownIndex <= focusWindupIndex) {
      throw new Error(`${label} did not preserve focused jump-windup -> knockdown roll counter evidence: ${JSON.stringify({
        ownTransitions,
        focusTransitions,
      })}`);
    }
  } else {
    const ownRecoveryIndex = ownTransitions.findIndex((entry, index) =>
      index > ownActiveIndex && entry.action === COMBAT_ACTION.jumpAttackRecovery);
    const focusRecoveryIndex = focusTransitions.findIndex((entry, index) =>
      index > focusActiveIndex && entry.action === COMBAT_ACTION.jumpAttackRecovery);
    if (ownRecoveryIndex <= ownActiveIndex || focusRecoveryIndex <= focusActiveIndex) {
      throw new Error(`${label} did not replicate jump-attack active -> recovery: ${JSON.stringify({
        ownTransitions,
        focusTransitions,
      })}`);
    }
  }

  const defenseWheels = defenderResult.wheels.slice(wheelOffset);
  if (defense === "block") {
    const blockWheels = defenseWheels.filter((event) => event.deltaY > 0);
    if (blockWheels.length < 2
      || !defenderResult.acceptance.ownActionTransitions.some((entry) => entry.action === COMBAT_ACTION.block)) {
      throw new Error(`${label} overlapping real wheel-back block was not delivered: ${JSON.stringify(defenderResult)}`);
    }
  } else if (defense === "parry") {
    if (!defenseWheels.some((event) => event.deltaY > 0)) {
      throw new Error(`${label} real wheel-back parry was not delivered: ${JSON.stringify(defenderResult)}`);
    }
  } else {
    if (!defenseWheels.some((event) => event.deltaY < 0)) {
      throw new Error(`${label} real pointer-owned wheel-forward dodge was not delivered: ${JSON.stringify(defenderResult)}`);
    }
    const iframeEvade = attackerResult.feedbackTransitions.includes("dodge-evaded")
      && defenderResult.feedbackTransitions.includes("dodge-success");
    if (!iframeEvade && !hasReplicatedDodgeOverlap(attackerResult, defenderResult) && !rollCounter) {
      throw new Error(`${label} lacked iframe feedback, authoritative roll overlap, or roll-counter knockdown: ${JSON.stringify(evidence)}`);
    }
  }

  if (defense !== "parry"
    && (attackerResult.feedbackTransitions.includes("parried")
      || defenderResult.feedbackTransitions.includes("parry-success"))) {
    throw new Error(`${label} accidentally resolved as parry: ${JSON.stringify(evidence)}`);
  }

  return evidence.map((entry) => ({
    ...entry,
    jumpAttackCounterplay: defense,
    jumpAttackChordEpochMs: entry.browser === attacker.name
      ? Math.max(jumpDown.epochMs, attackDown.epochMs)
      : null,
  }));
}

async function runOnlineUiJumpAttackWhiffPunishFlight(entries) {
  const staged = await prepareHeavyCounterplayFlight(
    entries,
    "M140 jump attack whiff punish",
    { attackerName: "firefox", defenderName: "chrome", movementMs: 180 },
  );
  const { attacker, defender, attackerElementId, defenderElementId, movementCode } = staged;
  const attackRight = movementCode === "KeyD";
  const whiffOffset = attackRight ? -200 : 200;
  const punishOffset = attackRight ? -200 : 200;

  const attackerBefore = await readUiEvidence(attacker);
  const attackerKeyOffset = attackerBefore.keyTransitions.length;
  const attackerPointerOffset = attackerBefore.pointers.length;

  // Keep the fighters in the same close spacing that lets M136 connect, but
  // deliberately turn the narrow jump attack 180 degrees away. This proves a
  // directional whiff instead of manufacturing extra distance.
  await aimArena(attacker, attackerElementId, whiffOffset);
  await sleep(40);
  await performArenaJumpAttackChord(attacker, attackerElementId, whiffOffset, 90);

  let recoveryEvidence = null;
  const recoveryDeadline = Date.now() + 900;
  while (Date.now() < recoveryDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerResult = states.find((entry) => entry.browser === attacker.name);
    const defenderResult = states.find((entry) => entry.browser === defender.name);
    const ownTransitions = attackerResult?.acceptance?.ownActionTransitions ?? [];
    const focusTransitions = defenderResult?.acceptance?.focusActionTransitions ?? [];

    const ownWindup = ownTransitions.findIndex((entry) => entry.action === COMBAT_ACTION.jumpAttackWindup);
    const ownActive = ownTransitions.findIndex((entry, index) =>
      index > ownWindup && entry.action === COMBAT_ACTION.jumpAttackActive);
    const ownRecovery = ownTransitions.findIndex((entry, index) =>
      index > ownActive && entry.action === COMBAT_ACTION.jumpAttackRecovery);
    const focusWindup = focusTransitions.findIndex((entry) => entry.action === COMBAT_ACTION.jumpAttackWindup);
    const focusActive = focusTransitions.findIndex((entry, index) =>
      index > focusWindup && entry.action === COMBAT_ACTION.jumpAttackActive);
    const focusRecovery = focusTransitions.findIndex((entry, index) =>
      index > focusActive && entry.action === COMBAT_ACTION.jumpAttackRecovery);
    const recoveryCue = defenderResult?.recoveryTransitions.find((entry) =>
      entry.visible
      && entry.state === "jump-attack-recovery"
      && entry.label === "PUNISH"
      && entry.detail === "Jump attack recovery");

    const pristineWhiff = attackerResult?.playerHp === 100
      && attackerResult?.playerGuard === 100
      && attackerResult?.opponentHp === 100
      && attackerResult?.opponentGuard === 100
      && defenderResult?.playerHp === 100
      && defenderResult?.playerGuard === 100
      && defenderResult?.opponentHp === 100
      && defenderResult?.opponentGuard === 100;

    if (ownWindup >= 0 && ownActive > ownWindup && ownRecovery > ownActive
      && focusWindup >= 0 && focusActive > focusWindup && focusRecovery > focusActive
      && recoveryCue && pristineWhiff) {
      recoveryEvidence = states;
      break;
    }
    if (!pristineWhiff && Number.isFinite(attackerResult?.playerHp)) {
      throw new Error(`M140 jump attack failed to whiff cleanly: ${JSON.stringify(states)}`);
    }
    await sleep(10);
  }
  if (!recoveryEvidence) {
    throw new Error(`M140 defender never observed punishable jump-attack recovery: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
  }

  const defenderBeforePunish = await readUiEvidence(defender);
  const punishPointerOffset = defenderBeforePunish.pointers.length;
  // Fire a genuine LMB as soon as the remote recovery cue becomes visible.
  // M140 proves the player's commitment starts inside the owner-approved
  // 450ms jump-attack recovery window. The original 135ms light windup and
  // authoritative hit/phase checks remain unchanged.
  await performArenaAttackHold(defender, defenderElementId, punishOffset, 90);

  let evidence = null;
  const punishDeadline = Date.now() + 650;
  while (Date.now() < punishDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerResult = states.find((entry) => entry.browser === attacker.name);
    const defenderResult = states.find((entry) => entry.browser === defender.name);
    if (!attackerResult || !defenderResult) {
      throw new Error(`M140 incomplete punish evidence: ${JSON.stringify(states)}`);
    }

    if (attackerResult.playerHp === 66 && defenderResult.opponentHp === 66) {
      evidence = states;
      break;
    }

    const unexpectedVitals = attackerResult.playerHp < 66
      || attackerResult.playerGuard !== 100
      || defenderResult.playerHp !== 100
      || defenderResult.playerGuard !== 100;
    if (unexpectedVitals) {
      throw new Error(`M140 punish resolved unexpected combat: ${JSON.stringify(states)}`);
    }
    await sleep(10);
  }
  if (!evidence) {
    throw new Error(`M140 real light did not punish jump-attack recovery: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
  }

  // The damage confirmation can arrive before both clients have replicated the
  // attacker's recovery -> idle edge. Wait only for that authoritative lifecycle
  // completion so we can prove the real LMB started before recovery ended.
  const lifecycleDeadline = Date.now() + 600;
  let lifecycleEvidence = null;
  while (Date.now() < lifecycleDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerState = states.find((entry) => entry.browser === attacker.name);
    const defenderState = states.find((entry) => entry.browser === defender.name);
    const ownTransitions = attackerState?.acceptance?.ownActionTransitions ?? [];
    const focusTransitions = defenderState?.acceptance?.focusActionTransitions ?? [];
    const ownRecoveryIndex = ownTransitions.findIndex((entry) =>
      entry.action === COMBAT_ACTION.jumpAttackRecovery && Number.isFinite(entry.epochMs));
    const ownIdleIndex = ownTransitions.findIndex((entry, index) =>
      index > ownRecoveryIndex && entry.action === COMBAT_ACTION.idle && Number.isFinite(entry.epochMs));
    const focusRecoveryIndex = focusTransitions.findIndex((entry) =>
      entry.action === COMBAT_ACTION.jumpAttackRecovery && Number.isFinite(entry.epochMs));
    const focusIdleIndex = focusTransitions.findIndex((entry, index) =>
      index > focusRecoveryIndex && entry.action === COMBAT_ACTION.idle && Number.isFinite(entry.epochMs));
    if (ownRecoveryIndex >= 0 && ownIdleIndex > ownRecoveryIndex
      && focusRecoveryIndex >= 0 && focusIdleIndex > focusRecoveryIndex) {
      lifecycleEvidence = states;
      break;
    }
    await sleep(10);
  }
  if (!lifecycleEvidence) {
    throw new Error(`M140 jump-attack recovery -> idle lifecycle did not fully replicate after punish: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
  }
  evidence = lifecycleEvidence;

  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (attackerResult.acceptance?.scenario !== "uijumpattackpunish"
    || defenderResult.acceptance?.scenario !== "uijumpattackpunish") {
    throw new Error(`M140 authoritative acceptance hook was not active: ${JSON.stringify(evidence)}`);
  }

  const chordKeys = attackerResult.keyTransitions.slice(attackerKeyOffset);
  const chordPointers = attackerResult.pointers.slice(attackerPointerOffset);
  const jumpDowns = chordKeys.filter((entry) => entry.type === "keydown" && entry.code === "Space");
  const jumpUps = chordKeys.filter((entry) => entry.type === "keyup" && entry.code === "Space");
  const attackDowns = chordPointers.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
  const attackUps = chordPointers.filter((entry) => entry.type === "pointerup" && entry.button === 0);
  const jumpDown = jumpDowns[0];
  const attackDown = attackDowns[0];
  if (jumpDowns.length !== 1 || jumpUps.length !== 1
    || attackDowns.length !== 1 || attackUps.length !== 1
    || !Number.isFinite(jumpDown?.epochMs) || !Number.isFinite(attackDown?.epochMs)
    || Math.abs(jumpDown.epochMs - attackDown.epochMs) > 60) {
    throw new Error(`M140 did not deliver one genuine same-tick Space + LMB whiff chord: ${JSON.stringify({ chordKeys, chordPointers })}`);
  }

  const punishPointers = defenderResult.pointers.slice(punishPointerOffset);
  const punishDown = punishPointers.find((entry) => entry.type === "pointerdown" && entry.button === 0);
  const punishUp = punishPointers.find((entry) => entry.type === "pointerup" && entry.button === 0);
  const recoveryCue = defenderResult.recoveryTransitions.find((entry) =>
    entry.visible && entry.state === "jump-attack-recovery");
  const punishAimValid = punishDown
    && Math.abs(punishDown.y - 0.5) <= 0.15
    && (attackRight ? punishDown.x <= 0.4 : punishDown.x >= 0.6);
  if (!punishDown || !punishUp || !punishAimValid
    || !Number.isFinite(punishDown.epochMs) || !Number.isFinite(recoveryCue?.epochMs)
    || punishDown.epochMs < recoveryCue.epochMs
    || punishDown.epochMs - recoveryCue.epochMs > 180) {
    throw new Error(`M140 real punish input did not promptly follow the visible recovery cue: ${JSON.stringify({ recoveryCue, punishPointers })}`);
  }

  const attackerLifecycle = attackerResult.acceptance?.ownActionTransitions ?? [];
  const defenderView = defenderResult.acceptance?.focusActionTransitions ?? [];
  const attackerRecoveryIndex = attackerLifecycle.findIndex((entry) =>
    entry.action === COMBAT_ACTION.jumpAttackRecovery && Number.isFinite(entry.epochMs));
  const attackerIdleIndex = attackerLifecycle.findIndex((entry, index) =>
    index > attackerRecoveryIndex && entry.action === COMBAT_ACTION.idle && Number.isFinite(entry.epochMs));
  const defenderRecoveryIndex = defenderView.findIndex((entry) =>
    entry.action === COMBAT_ACTION.jumpAttackRecovery && Number.isFinite(entry.epochMs));
  const defenderIdleIndex = defenderView.findIndex((entry, index) =>
    index > defenderRecoveryIndex && entry.action === COMBAT_ACTION.idle && Number.isFinite(entry.epochMs));
  const attackerRecovery = attackerLifecycle[attackerRecoveryIndex];
  const attackerIdle = attackerLifecycle[attackerIdleIndex];
  const defenderRecovery = defenderView[defenderRecoveryIndex];
  const defenderIdle = defenderView[defenderIdleIndex];
  if (attackerRecoveryIndex < 0 || attackerIdleIndex <= attackerRecoveryIndex
    || defenderRecoveryIndex < 0 || defenderIdleIndex <= defenderRecoveryIndex
    || punishDown.epochMs < attackerRecovery.epochMs
    || punishDown.epochMs >= attackerIdle.epochMs
    || punishDown.epochMs < defenderRecovery.epochMs
    || punishDown.epochMs >= defenderIdle.epochMs) {
    throw new Error(`M140 real light was not committed inside authoritative jump-attack recovery: ${JSON.stringify({
      punishDown,
      attackerRecovery,
      attackerIdle,
      defenderRecovery,
      defenderIdle,
    })}`);
  }

  if (attackerResult.playerHp !== 66 || attackerResult.playerGuard !== 100
    || attackerResult.opponentHp !== 100 || attackerResult.opponentGuard !== 100
    || defenderResult.playerHp !== 100 || defenderResult.playerGuard !== 100
    || defenderResult.opponentHp !== 66 || defenderResult.opponentGuard !== 100) {
    throw new Error(`M140 whiff punish did not resolve as exactly one 34-damage light hit: ${JSON.stringify(evidence)}`);
  }
  if (attackerResult.events.includes("Opponent hit - 42 HP.")
    || defenderResult.events.includes("Hit taken - 42 HP.")) {
    throw new Error(`M140 deliberately whiffed jump attack unexpectedly connected: ${JSON.stringify(evidence)}`);
  }
  if (!defenderResult.events.includes("Opponent hit - 34 HP.")
    || !attackerResult.events.includes("Hit taken - 34 HP.")) {
    throw new Error(`M140 light punish feedback was not authoritative: ${JSON.stringify(evidence)}`);
  }
  if (!defenderResult.recoveryTransitions.some((entry) =>
    entry.visible
      && entry.state === "jump-attack-recovery"
      && entry.label === "PUNISH"
      && entry.detail === "Jump attack recovery")) {
    throw new Error(`M140 defender never rendered jump-attack recovery as punishable: ${JSON.stringify(defenderResult.recoveryTransitions)}`);
  }

  return evidence.map((entry) => ({
    ...entry,
    jumpAttackWhiffChordEpochMs: entry.browser === attacker.name
      ? Math.max(jumpDown.epochMs, attackDown.epochMs)
      : null,
    jumpAttackPunishEpochMs: entry.browser === defender.name ? punishDown.epochMs : null,
  }));
}

async function runOnlineUiJumpAttackTelegraphFlight(entries) {
  const staged = await prepareHeavyCounterplayFlight(
    entries,
    "M141 jump attack telegraph",
    { attackerName: "chrome", defenderName: "firefox", movementMs: 180 },
  );
  const { attacker, defender, attackerElementId, movementCode } = staged;
  const attackRight = movementCode === "KeyD";
  const attackOffset = attackRight ? 200 : -200;
  const whiffOffset = -attackOffset;

  const before = await Promise.all(entries.map(readUiEvidence));
  const attackerBefore = before.find((entry) => entry.browser === attacker.name);
  const defenderBefore = before.find((entry) => entry.browser === defender.name);
  if (!attackerBefore || !defenderBefore) {
    throw new Error(`M141 incomplete initial evidence: ${JSON.stringify(before)}`);
  }
  const keyOffset = attackerBefore.keyTransitions.length;
  const pointerOffset = attackerBefore.pointers.length;
  const offAxisThreatOffset = defenderBefore.threatTransitions.length;

  // First prove the telegraph honors the existing narrow attack cone: at the
  // same close spacing as M136, turn 180 degrees away and send a genuine chord.
  await aimArena(attacker, attackerElementId, whiffOffset);
  await sleep(40);
  await Promise.all([
    performArenaJumpAttackChord(attacker, attackerElementId, whiffOffset, 90),
    sampleUiEvidenceWhileActive([defender], 360, 12),
  ]);

  let offAxisSettled = null;
  const offAxisDeadline = Date.now() + 900;
  while (Date.now() < offAxisDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerResult = states.find((entry) => entry.browser === attacker.name);
    const own = attackerResult?.acceptance?.ownActionTransitions ?? [];
    const recoveryIndex = own.findIndex((entry) => entry.action === COMBAT_ACTION.jumpAttackRecovery);
    const idleIndex = own.findIndex((entry, index) => index > recoveryIndex && entry.action === COMBAT_ACTION.idle);
    if (recoveryIndex >= 0 && idleIndex > recoveryIndex) {
      offAxisSettled = states;
      break;
    }
    await sleep(15);
  }
  if (!offAxisSettled) {
    throw new Error(`M141 off-axis jump attack never completed: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
  }

  const offAxisAttacker = offAxisSettled.find((entry) => entry.browser === attacker.name);
  const offAxisDefender = offAxisSettled.find((entry) => entry.browser === defender.name);
  const leakedJumpThreat = offAxisDefender?.threatTransitions.slice(offAxisThreatOffset).some((entry) =>
    entry.visible && (entry.phase === "JUMP WINDUP" || entry.phase === "JUMP STRIKE"));
  if (leakedJumpThreat) {
    throw new Error(`M141 off-axis narrow jump attack leaked a threat cue: ${JSON.stringify(offAxisDefender?.threatTransitions)}`);
  }
  if (offAxisAttacker?.playerHp !== 100 || offAxisAttacker?.opponentHp !== 100
    || offAxisDefender?.playerHp !== 100 || offAxisDefender?.opponentHp !== 100) {
    throw new Error(`M141 off-axis narrow jump attack unexpectedly connected: ${JSON.stringify(offAxisSettled)}`);
  }

  // Now aim inside the same narrow cone. The opponent must see both committed
  // phases before the unchanged 42-damage hit resolves.
  await aimArena(attacker, attackerElementId, attackOffset);
  await sleep(60);
  const beforeInAxis = await readUiEvidence(defender);
  const inAxisThreatOffset = beforeInAxis.threatTransitions.length;
  await Promise.all([
    performArenaJumpAttackChord(attacker, attackerElementId, attackOffset, 90),
    sampleUiEvidenceWhileActive([defender], 380, 10),
  ]);

  let evidence = null;
  const hitDeadline = Date.now() + 700;
  while (Date.now() < hitDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerResult = states.find((entry) => entry.browser === attacker.name);
    const defenderResult = states.find((entry) => entry.browser === defender.name);
    if (attackerResult?.opponentHp === 58 && defenderResult?.playerHp === 58) {
      evidence = states;
      break;
    }
    await sleep(12);
  }
  if (!evidence) {
    throw new Error(`M141 in-axis jump attack did not resolve one 42-damage hit: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
  }

  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) {
    throw new Error(`M141 incomplete final evidence: ${JSON.stringify(evidence)}`);
  }
  if (attackerResult.acceptance?.scenario !== "uijumpattacktelegraph"
    || defenderResult.acceptance?.scenario !== "uijumpattacktelegraph") {
    throw new Error(`M141 authoritative acceptance hook was not active: ${JSON.stringify(evidence)}`);
  }

  const jumpThreats = defenderResult.threatTransitions.slice(inAxisThreatOffset);
  const windupIndex = jumpThreats.findIndex((entry) =>
    entry.visible && entry.phase === "JUMP WINDUP" && entry.state === "windup");
  const strikeIndex = jumpThreats.findIndex((entry, index) =>
    index > windupIndex && entry.visible && entry.phase === "JUMP STRIKE" && entry.state === "strike");
  if (windupIndex < 0 || strikeIndex <= windupIndex) {
    throw new Error(`M141 defender did not render JUMP WINDUP -> JUMP STRIKE: ${JSON.stringify(jumpThreats)}`);
  }

  const keys = attackerResult.keyTransitions.slice(keyOffset);
  const pointers = attackerResult.pointers.slice(pointerOffset);
  const spaceDowns = keys.filter((entry) => entry.type === "keydown" && entry.code === "Space");
  const spaceUps = keys.filter((entry) => entry.type === "keyup" && entry.code === "Space");
  const attackDowns = pointers.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
  const attackUps = pointers.filter((entry) => entry.type === "pointerup" && entry.button === 0);
  if (spaceDowns.length !== 2 || spaceUps.length !== 2 || attackDowns.length !== 2 || attackUps.length !== 2) {
    throw new Error(`M141 expected exactly two genuine jump-attack chords: ${JSON.stringify({ keys, pointers })}`);
  }
  for (let index = 0; index < 2; index += 1) {
    if (!Number.isFinite(spaceDowns[index]?.epochMs) || !Number.isFinite(attackDowns[index]?.epochMs)
      || Math.abs(spaceDowns[index].epochMs - attackDowns[index].epochMs) > 60) {
      throw new Error(`M141 chord ${index + 1} was not same-tick Space + LMB: ${JSON.stringify({ spaceDowns, attackDowns })}`);
    }
  }
  const firstAimValid = attackRight ? attackDowns[0].x <= 0.4 : attackDowns[0].x >= 0.6;
  const secondAimValid = attackRight ? attackDowns[1].x >= 0.6 : attackDowns[1].x <= 0.4;
  if (!firstAimValid || !secondAimValid) {
    throw new Error(`M141 did not deliver off-axis then in-axis pointer ownership: ${JSON.stringify(attackDowns)}`);
  }

  if (attackerResult.playerHp !== 100 || attackerResult.playerGuard !== 100
    || attackerResult.opponentHp !== 58 || attackerResult.opponentGuard !== 100
    || defenderResult.playerHp !== 58 || defenderResult.playerGuard !== 100
    || defenderResult.opponentHp !== 100 || defenderResult.opponentGuard !== 100) {
    throw new Error(`M141 telegraph flight changed combat balance or resolved extra contact: ${JSON.stringify(evidence)}`);
  }
  if (!attackerResult.events.includes("Opponent hit - 42 HP.")
    || !defenderResult.events.includes("Hit taken - 42 HP.")) {
    throw new Error(`M141 in-axis jump hit feedback was not authoritative: ${JSON.stringify(evidence)}`);
  }

  return evidence.map((entry) => ({
    ...entry,
    jumpTelegraphWindupSeen: entry.browser === defender.name ? windupIndex >= 0 : null,
    jumpTelegraphStrikeSeen: entry.browser === defender.name ? strikeIndex > windupIndex : null,
  }));
}

async function runOnlineUiJumpAttackBufferFlight(entries) {
  const staged = await prepareHeavyCounterplayFlight(
    entries,
    "M137 recovery jump attack buffer",
    { attackerName: "chrome", defenderName: "firefox", movementMs: 300 },
  );
  const { attacker, defender, attackerElementId, movementCode } = staged;
  const attackOffset = movementCode === "KeyD" ? 200 : -200;
  const beforeAttacker = await readUiEvidence(attacker);
  const keyTransitionOffset = beforeAttacker.keyTransitions.length;
  const pointerOffset = beforeAttacker.pointers.length;

  // First commit a genuine light so the chord has to survive its full recovery.
  await performArenaAttack(attacker, attackerElementId, attackOffset);

  const recoveryDeadline = Date.now() + 900;
  let recoveryStart = null;
  while (Date.now() < recoveryDeadline) {
    const current = await readUiEvidence(attacker);
    const transitions = current.acceptance?.ownActionTransitions ?? [];
    recoveryStart = transitions.find((entry) =>
      entry.action === COMBAT_ACTION.attackRecovery && Number.isFinite(entry.epochMs)) ?? null;
    if (recoveryStart) break;
    await sleep(10);
  }
  if (!recoveryStart) {
    throw new Error("M137 Chrome never observed its authoritative light recovery before Space + LMB");
  }

  const targetOffsetMs = Math.max(
    0,
    COMBAT.attack.recoveryMs - COMBAT.inputBuffer.jumpAttackWindowMs - 20,
  );
  const waitMs = Math.max(0, recoveryStart.epochMs + targetOffsetMs - Date.now());
  if (waitMs > 0) await sleep(waitMs);
  await performArenaJumpAttackChord(attacker, attackerElementId, attackOffset, 90);

  const completedSequence = (transitions = []) => {
    const lightRecoveryIndex = transitions.findIndex((entry) =>
      entry.action === COMBAT_ACTION.attackRecovery && Number.isFinite(entry.epochMs));
    const windupIndex = transitions.findIndex((entry, index) =>
      index > lightRecoveryIndex
      && entry.action === COMBAT_ACTION.jumpAttackWindup
      && Number.isFinite(entry.epochMs));
    const activeIndex = transitions.findIndex((entry, index) =>
      index > windupIndex
      && entry.action === COMBAT_ACTION.jumpAttackActive
      && Number.isFinite(entry.epochMs));
    const jumpRecoveryIndex = transitions.findIndex((entry, index) =>
      index > activeIndex
      && entry.action === COMBAT_ACTION.jumpAttackRecovery
      && Number.isFinite(entry.epochMs));
    const idleIndex = transitions.findIndex((entry, index) =>
      index > jumpRecoveryIndex
      && entry.action === COMBAT_ACTION.idle
      && Number.isFinite(entry.epochMs));
    return {
      lightRecoveryIndex,
      windupIndex,
      activeIndex,
      jumpRecoveryIndex,
      idleIndex,
      complete: lightRecoveryIndex >= 0
        && windupIndex > lightRecoveryIndex
        && activeIndex > windupIndex
        && jumpRecoveryIndex > activeIndex
        && idleIndex > jumpRecoveryIndex,
    };
  };

  const deadline = Date.now() + 2200;
  let evidence = null;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerResult = states.find((entry) => entry.browser === attacker.name);
    const defenderResult = states.find((entry) => entry.browser === defender.name);
    const ownSequence = completedSequence(attackerResult?.acceptance?.ownActionTransitions);
    const focusSequence = completedSequence(defenderResult?.acceptance?.focusActionTransitions);
    if (attackerResult?.opponentHp === 24
      && defenderResult?.playerHp === 24
      && ownSequence.complete
      && focusSequence.complete) {
      evidence = states;
      break;
    }
    if ((Number.isFinite(defenderResult?.playerHp) && defenderResult.playerHp < 24)
      || (Number.isFinite(attackerResult?.playerHp) && attackerResult.playerHp < 100)) {
      throw new Error(`M137 resolved an unexpected exchange: ${JSON.stringify(states)}`);
    }
    await sleep(20);
  }
  if (!evidence) {
    throw new Error(`M137 did not observe buffered authoritative jump-attack completion: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
  }

  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) {
    throw new Error(`M137 incomplete jump-attack buffer evidence: ${JSON.stringify(evidence)}`);
  }
  if (attackerResult.acceptance?.scenario !== "uijumpattackbuffer"
    || defenderResult.acceptance?.scenario !== "uijumpattackbuffer") {
    throw new Error(`M137 authoritative acceptance hook was not active: ${JSON.stringify(evidence)}`);
  }

  const keyTransitions = attackerResult.keyTransitions.slice(keyTransitionOffset);
  const pointerTransitions = attackerResult.pointers.slice(pointerOffset);
  const jumpDowns = keyTransitions.filter((entry) => entry.type === "keydown" && entry.code === "Space");
  const jumpUps = keyTransitions.filter((entry) => entry.type === "keyup" && entry.code === "Space");
  const attackDowns = pointerTransitions.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
  const attackUps = pointerTransitions.filter((entry) => entry.type === "pointerup" && entry.button === 0);
  const jumpDown = jumpDowns[0];
  const setupAttackDown = attackDowns[0];
  const attackDown = attackDowns[1];
  if (jumpDowns.length !== 1 || jumpUps.length !== 1
    || attackDowns.length !== 2 || attackUps.length !== 2
    || !Number.isFinite(setupAttackDown?.epochMs)
    || !Number.isFinite(jumpDown?.epochMs) || !Number.isFinite(attackDown?.epochMs)
    || setupAttackDown.epochMs >= attackDown.epochMs
    || Math.abs(jumpDown.epochMs - attackDown.epochMs) > 60) {
    throw new Error(`M137 did not deliver one setup light followed by one genuine late-recovery Space + LMB chord: ${JSON.stringify({
      keyTransitions,
      pointerTransitions,
    })}`);
  }

  const ownTransitions = attackerResult.acceptance.ownActionTransitions;
  const ownSequence = completedSequence(ownTransitions);
  const focusTransitions = defenderResult.acceptance.focusActionTransitions;
  const focusSequence = completedSequence(focusTransitions);
  if (!ownSequence.complete || !focusSequence.complete) {
    throw new Error(`M137 did not preserve the buffered sequence on both replicas: ${JSON.stringify({
      ownTransitions,
      focusTransitions,
    })}`);
  }

  const plainJumpAfterRecovery = ownTransitions.findIndex((entry, index) =>
    index > ownSequence.lightRecoveryIndex && entry.action === COMBAT_ACTION.jump);
  if (plainJumpAfterRecovery >= 0 && plainJumpAfterRecovery < ownSequence.windupIndex) {
    throw new Error(`M137 buffered chord degraded into plain jump before jump attack: ${JSON.stringify(ownTransitions)}`);
  }

  const chordEpochMs = Math.max(jumpDown.epochMs, attackDown.epochMs);
  const authoritativeWindup = ownTransitions[ownSequence.windupIndex];
  const observedRecoveryBeforeChordMs = chordEpochMs - recoveryStart.epochMs;
  const observedChordToWindupMs = authoritativeWindup.epochMs - chordEpochMs;
  const lateRecoveryFloorMs = Math.max(
    0,
    COMBAT.attack.recoveryMs - COMBAT.inputBuffer.jumpAttackWindowMs - 55,
  );
  if (observedRecoveryBeforeChordMs < lateRecoveryFloorMs
    || observedChordToWindupMs <= 0
    || observedChordToWindupMs > COMBAT.inputBuffer.jumpAttackWindowMs + 120) {
    throw new Error(`M137 chord was not buffered late in recovery before authoritative jump attack: ${JSON.stringify({
      recoveryStart,
      jumpDown,
      attackDown,
      authoritativeWindup,
      observedRecoveryBeforeChordMs,
      observedChordToWindupMs,
    })}`);
  }

  if (attackerResult.playerHp !== 100 || attackerResult.playerGuard !== 100
    || attackerResult.opponentHp !== 24
    || defenderResult.playerHp !== 24 || defenderResult.playerGuard !== 100) {
    throw new Error(`M137 did not resolve exactly one 34 HP light plus one 42 HP jump attack: ${JSON.stringify(evidence)}`);
  }
  if (attackerResult.feedbackTransitions.includes("parried")
    || defenderResult.feedbackTransitions.includes("parry-success")) {
    throw new Error(`M137 recovery jump-attack flight accidentally resolved as parry: ${JSON.stringify(evidence)}`);
  }

  return evidence.map((entry) => ({
    ...entry,
    jumpAttackBufferChordEpochMs: entry.browser === attacker.name ? chordEpochMs : null,
    jumpAttackBufferRecoveryEpochMs: entry.browser === attacker.name ? recoveryStart.epochMs : null,
    jumpAttackBufferWindupEpochMs: entry.browser === attacker.name ? authoritativeWindup.epochMs : null,
  }));
}


async function runOnlineUiKickKnockdownFfaHitFlight(entries) {
  const milestone = "M155 actionable third-party kick knockdown punish";
  if (entries.length !== 3) {
    throw new Error(milestone + " expected three real browser clients, received " + entries.length);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const kicker = entries.find((entry) => entry.name === "chrome");
  const defender = entries.find((entry) => entry.name === "firefox");
  const punisher = entries.find((entry) => entry.name === "chrome2");
  const kickerReady = ready.find((entry) => entry.browser === kicker?.name);
  const defenderReady = ready.find((entry) => entry.browser === defender?.name);
  const punisherReady = ready.find((entry) => entry.browser === punisher?.name);
  if (!kicker || !defender || !punisher || !kickerReady || !defenderReady || !punisherReady) {
    throw new Error(milestone + " could not resolve deterministic FFA roles: " + JSON.stringify(ready));
  }

  const kickerId = kickerReady.playerNetId;
  const defenderId = defenderReady.playerNetId;
  const punisherId = punisherReady.playerNetId;
  await waitForUiThreePlayerReady(entries, [kickerId, defenderId, punisherId], 2500);
  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  await Promise.all(entries.map(centerArenaInViewport));

  const kickerElementId = await resolveArenaElement(kicker, milestone + " kicker");
  const punisherElementId = await resolveArenaElement(punisher, milestone + " punisher");
  const kickRight = kickerId < defenderId;
  const movementKey = kickRight ? "d" : "a";
  const kickOffset = kickRight ? 200 : -200;
  const punishOffset = punisherId < defenderId ? 200 : -200;

  // #3 starts on the far side of #2. The unchanged 52-unit kick knockback
  // moves #2 into #3's unchanged 76-unit light reach, so a third fighter can
  // convert the 360 ms knockdown without widening any gameplay timing.
  await pulseMovementKey(kicker, movementKey, 180);
  await aimArena(kicker, kickerElementId, kickOffset);
  await aimArena(punisher, punisherElementId, punishOffset);
  await sleep(60);

  const readDefenderOwnActions = () => execute(
    defender.base,
    defender.sessionId,
    "return (window.__MYASO_ACCEPTANCE_STATE__?.ownActionTransitions ?? []).map((entry) => ({ ...entry }));",
  );

  let conversion = null;
  for (let attempt = 1; attempt <= 3 && !conversion; attempt += 1) {
    const [kickerBefore, defenderBefore, punisherBefore] = await Promise.all([
      readUiEvidence(kicker),
      readUiEvidence(defender),
      readUiEvidence(punisher),
    ]);
    const kickerPointerOffset = kickerBefore.pointers.length;
    const defenderActionOffset = defenderBefore.acceptance?.ownActionTransitions?.length ?? 0;
    const punishPointerOffset = punisherBefore.pointers.length;

    await performArenaRecoveryBufferedKick(kicker, kickerElementId, kickOffset, 45);

    // Poll only #2's authoritative action stream so the real LMB can start on
    // the first knockdown snapshot. Kick phase/HUD provenance may replicate a
    // frame later and is validated after the punish has already been committed.
    const setupDeadline = Date.now() + COMBAT.kick.windupMs + COMBAT.kick.activeMs
      + COMBAT.kick.knockdownMs + 160;
    let knockdownTransition = null;
    while (!knockdownTransition && Date.now() < setupDeadline) {
      const defenderActions = (await readDefenderOwnActions()).slice(defenderActionOffset);
      knockdownTransition = defenderActions.find((entry) =>
        entry.action === COMBAT_ACTION.knockdown && Number.isFinite(entry.epochMs)) ?? null;
      if (!knockdownTransition) await sleep(2);
    }

    if (knockdownTransition) {
      conversion = {
        attempt,
        punishPointerOffset,
        knockdownTransition,
      };
      await performArenaAttack(punisher, punisherElementId, punishOffset);

      const provenanceDeadline = Date.now() + 280;
      while (Date.now() < provenanceDeadline) {
        const states = await Promise.all(entries.map(readUiEvidence));
        const kickerState = states.find((entry) => entry.browser === kicker.name);
        const defenderState = states.find((entry) => entry.browser === defender.name);
        const punisherState = states.find((entry) => entry.browser === punisher.name);
        const kickerActions = kickerState?.acceptance?.ownActionTransitions ?? [];
        const kickWindup = kickerActions
          .filter((entry) => entry.action === COMBAT_ACTION.kickWindup && Number.isFinite(entry.epochMs))
          .at(-1);
        const kickActive = kickerActions
          .filter((entry) => entry.action === COMBAT_ACTION.kickActive && Number.isFinite(entry.epochMs))
          .at(-1);
        const kickRecovery = kickerActions
          .filter((entry) => entry.action === COMBAT_ACTION.kickRecovery && Number.isFinite(entry.epochMs))
          .at(-1);
        const kickPointers = kickerState?.pointers?.slice(kickerPointerOffset) ?? [];
        const rightDowns = kickPointers.filter((entry) => entry.type === "pointerdown" && entry.button === 2);
        const rightUps = kickPointers.filter((entry) => entry.type === "pointerup" && entry.button === 2);
        const rightDown = rightDowns[0];
        const rightUp = rightUps[0];
        const focusSeen = punisherState?.focusTransitions?.some((entry) =>
          entry.label === "KNOCKDOWN #" + defenderId);
        const cueSeen = punisherState?.recoveryTransitions?.some((entry) =>
          entry.visible
          && entry.state === "knockdown"
          && entry.label === "PUNISH"
          && entry.detail === "Knockdown recovery");
        const vitalsClean = kickerState?.playerHp === 100 && kickerState?.playerGuard === 100
          && (defenderState?.playerHp === 100 || defenderState?.playerHp === 66)
          && defenderState?.playerGuard === 100
          && punisherState?.playerHp === 100 && punisherState?.playerGuard === 100;
        const bracketedKick = !kickActive
          && kickWindup && kickRecovery
          && Number.isFinite(kickWindup.serverTick)
          && Number.isFinite(kickRecovery.serverTick)
          && Number.isFinite(knockdownTransition.serverTick)
          && kickWindup.serverTick <= knockdownTransition.serverTick
          && knockdownTransition.serverTick <= kickRecovery.serverTick;

        if ((kickActive || bracketedKick) && rightDowns.length === 1 && rightUps.length === 1
          && focusSeen && cueSeen && vitalsClean) {
          if (!Number.isFinite(rightDown?.epochMs) || !Number.isFinite(rightUp?.epochMs)
            || rightUp.epochMs <= rightDown.epochMs || rightUp.epochMs - rightDown.epochMs >= 180) {
            throw new Error(milestone + " did not deliver one genuine short RMB kick: "
              + JSON.stringify(kickPointers));
          }
          if (kickActive
            && (knockdownTransition.epochMs + 80 < kickActive.epochMs
              || knockdownTransition.epochMs > kickActive.epochMs + COMBAT.kick.activeMs + 140)) {
            throw new Error(milestone + " could not tie knockdown to the authoritative kick active phase: "
              + JSON.stringify({ kickActive, knockdownTransition }));
          }
          conversion.kickProvenance = { kickWindup, kickActive, kickRecovery, bracketedKick };
          break;
        }
        await sleep(6);
      }

      if (!conversion.kickProvenance) {
        throw new Error(milestone + " did not validate kick/readability provenance after early LMB: "
          + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
      }
      break;
    }

    if (attempt < 3) {
      await sleep(COMBAT.kick.knockdownMs + COMBAT.kick.recoveryMs + 120);
      await pulseMovementKey(kicker, movementKey, 70);
      await aimArena(kicker, kickerElementId, kickOffset);
      await aimArena(punisher, punisherElementId, punishOffset);
      await sleep(50);
    }
  }

  if (!conversion) {
    throw new Error(milestone + " never produced a third-party KNOCKDOWN target from the real kick: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  let hitEvidence = null;
  const hitDeadline = Date.now() + COMBAT.attack.windupMs + COMBAT.attack.activeMs + 260;
  while (Date.now() < hitDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const kickerState = states.find((entry) => entry.browser === kicker.name);
    const defenderState = states.find((entry) => entry.browser === defender.name);
    const punisherState = states.find((entry) => entry.browser === punisher.name);
    if (defenderState?.playerHp === 66 && defenderState?.playerGuard === 100
      && kickerState?.playerHp === 100 && kickerState?.playerGuard === 100
      && punisherState?.playerHp === 100 && punisherState?.playerGuard === 100) {
      hitEvidence = states;
      break;
    }
    if ((Number.isFinite(defenderState?.playerHp) && defenderState.playerHp < 66)
      || (Number.isFinite(defenderState?.playerGuard) && defenderState.playerGuard < 100)
      || (Number.isFinite(kickerState?.playerHp) && kickerState.playerHp < 100)
      || (Number.isFinite(kickerState?.playerGuard) && kickerState.playerGuard < 100)
      || (Number.isFinite(punisherState?.playerHp) && punisherState.playerHp < 100)
      || (Number.isFinite(punisherState?.playerGuard) && punisherState.playerGuard < 100)) {
      throw new Error(milestone + " punish damaged the wrong fighter, guard, or hit more than once: "
        + JSON.stringify(states));
    }
    await sleep(8);
  }
  if (!hitEvidence) {
    throw new Error(milestone + " did not land exactly one 34 HP third-party light during #"
      + defenderId + "'s knockdown conversion window: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  let kickerState = hitEvidence.find((entry) => entry.browser === kicker.name);
  let defenderState = hitEvidence.find((entry) => entry.browser === defender.name);
  let punisherState = hitEvidence.find((entry) => entry.browser === punisher.name);
  const punishPointers = punisherState.pointers.slice(conversion.punishPointerOffset);
  const punishDowns = punishPointers.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
  const punishUps = punishPointers.filter((entry) => entry.type === "pointerup" && entry.button === 0);
  const punishDown = punishDowns[0];
  const punishAimValid = punishDown
    && Math.abs(punishDown.y - 0.5) <= 0.15
    && (punisherId < defenderId ? punishDown.x >= 0.6 : punishDown.x <= 0.4);
  const knockdownEndEpochMs = conversion.knockdownTransition.epochMs + COMBAT.kick.knockdownMs;
  if (punishDowns.length !== 1 || punishUps.length !== 1 || !punishAimValid
    || !Number.isFinite(punishDown?.epochMs)
    || punishDown.epochMs < conversion.knockdownTransition.epochMs
    || punishDown.epochMs >= knockdownEndEpochMs) {
    throw new Error(milestone + " genuine third-party LMB missed the authoritative knockdown window: "
      + JSON.stringify({ punishPointers, knockdownTransition: conversion.knockdownTransition, knockdownEndEpochMs }));
  }

  // M206: the normal 50ms snapshots can miss the unchanged 80ms
  // light active state even though the real Chrome2 W3C LMB hit landed.
  // M201's loopback-only 60Hz server trace is now also enabled for this
  // three-player kick-knockdown scenario. Prove actual same-strike action
  // windup->active and the exact server-authored victim hit in server ticks.
  const sampledPunisherActions = punisherState.acceptance?.ownActionTransitions ?? [];
  const sampledWindup = sampledPunisherActions.find(entry =>
    entry.action === COMBAT_ACTION.attackWindup
    && Number.isFinite(entry.epochMs)
    && entry.epochMs >= punishDown.epochMs - 40) ?? null;
  const sampledActive = sampledWindup
    ? sampledPunisherActions.find(entry =>
      entry.action === COMBAT_ACTION.attackActive
      && Number.isFinite(entry.epochMs)
      && entry.epochMs >= sampledWindup.epochMs) ?? null
    : null;
  let authoritativePunish = null;
  let serverProofFailure = null;
  const proofDeadline = Date.now() + 180;
  while (!authoritativePunish && Date.now() < proofDeadline) {
    try {
      authoritativePunish = verifyM206ServerKnockdownPunish(m201ServerOutput(), {
        kickerId, defenderId, punisherId,
      });
    } catch (error) {
      serverProofFailure = error?.message ?? String(error);
      await sleep(8);
    }
  }
  if (!authoritativePunish) {
    throw new Error(milestone + " did not prove the true third-party server attack active/hit inside knockdown: "
      + JSON.stringify({ punishDown, sampledWindup, sampledActive, serverProofFailure }));
  }
  console.log("M206_SERVER_KNOCKDOWN_PUNISH_PROOF " + JSON.stringify({
    kickerId, defenderId, punisherId,
    genuinePunishDowns: punishDowns.length,
    genuinePunishUps: punishUps.length,
    sampledActiveObserved: !!sampledActive,
    ...authoritativePunish,
  }));
  // Three-player observers can receive the generic attacker-side hit event on
  // a different spectator frame. The authoritative proof above already ties
  // the only real LMB to #3 and the 34 HP loss to knocked-down #2, so require
  // the victim-local damage event without treating observer routing as source attribution.
  if (!defenderState.events.includes("Hit taken - 34 HP.")) {
    throw new Error(milestone + " victim feedback did not confirm the 34 HP punish on #"
      + defenderId + ": " + JSON.stringify(hitEvidence));
  }

  const clearDeadline = Date.now() + COMBAT.kick.knockdownMs + COMBAT.attack.recoveryMs + 520;
  let finalEvidence = null;
  while (Date.now() < clearDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const currentKicker = states.find((entry) => entry.browser === kicker.name);
    const currentDefender = states.find((entry) => entry.browser === defender.name);
    const currentPunisher = states.find((entry) => entry.browser === punisher.name);
    const defenderAction = currentDefender?.acceptance?.ownActionTransitions?.at(-1)?.action;
    if (currentPunisher
      && currentPunisher.focusLabel !== "KNOCKDOWN #" + defenderId
      && !currentPunisher.recoveryVisible
      && defenderAction === COMBAT_ACTION.idle
      && currentDefender?.playerHp === 66 && currentDefender?.playerGuard === 100
      && currentKicker?.playerHp === 100 && currentKicker?.playerGuard === 100
      && currentPunisher?.playerHp === 100 && currentPunisher?.playerGuard === 100) {
      finalEvidence = states;
      break;
    }
    await sleep(16);
  }
  if (!finalEvidence) {
    throw new Error(milestone + " KNOCKDOWN focus did not clear after the punished fighter recovered: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  return finalEvidence.map((entry) => ({
    ...entry,
    m155KickerId: kickerId,
    m155KnockedDownId: defenderId,
    m155PunisherId: punisherId,
    m155KickAttempt: conversion.attempt,
    m155KnockdownEpochMs: conversion.knockdownTransition.epochMs,
    m155PunishPointerEpochMs: punishDown.epochMs,
    m155PunishActiveEpochMs: sampledActive?.epochMs ?? null,
    m206PunishActiveServerTick: authoritativePunish.active.tick,
  }));
}

async function runOnlineUiMultiKnockdownFfaFlight(entries) {
  const milestone = "M158 simultaneous FFA knockdown arbitration";
  if (entries.length !== 3) {
    throw new Error(milestone + " expected three real browser clients, received " + entries.length);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const roller = entries.find((entry) => entry.name === "chrome");
  const firstVictim = entries.find((entry) => entry.name === "firefox");
  const secondVictim = entries.find((entry) => entry.name === "chrome2");
  const rollerReady = ready.find((entry) => entry.browser === roller?.name);
  const firstReady = ready.find((entry) => entry.browser === firstVictim?.name);
  const secondReady = ready.find((entry) => entry.browser === secondVictim?.name);
  if (!roller || !firstVictim || !secondVictim || !rollerReady || !firstReady || !secondReady) {
    throw new Error(milestone + " could not resolve deterministic FFA roles: " + JSON.stringify(ready));
  }

  const rollerId = rollerReady.playerNetId;
  const firstVictimId = firstReady.playerNetId;
  const secondVictimId = secondReady.playerNetId;
  await waitForUiThreePlayerReady(entries, [rollerId, firstVictimId, secondVictimId], 2500);
  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  await Promise.all(entries.map(centerArenaInViewport));

  const rollerElementId = await resolveArenaElement(roller, milestone + " roller");
  const rollRight = rollerId < firstVictimId;
  const rollOffset = rollRight ? 200 : -200;

  const positionRelativeToAuthoritativeTarget = async (
    entry,
    ownNetId,
    targetNetId,
    desiredDx,
    desiredDy,
    label,
  ) => {
    const tolerance = 5;
    let last = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const state = await readUiEvidence(entry);
      const fighters = state.acceptance?.fighters ?? [];
      const own = fighters.find((fighter) => fighter.netId === ownNetId);
      const target = fighters.find((fighter) => fighter.netId === targetNetId);
      if (!own || !target
        || !Number.isFinite(own.x) || !Number.isFinite(own.y)
        || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
        await sleep(35);
        continue;
      }

      const errorX = target.x + desiredDx - own.x;
      const errorY = target.y + desiredDy - own.y;
      last = { own: { ...own }, target: { ...target }, errorX, errorY };
      if (Math.abs(errorX) <= tolerance && Math.abs(errorY) <= tolerance) {
        return last;
      }

      const useX = Math.abs(errorX) >= Math.abs(errorY);
      const distance = Math.abs(useX ? errorX : errorY);
      const key = useX
        ? (errorX > 0 ? "d" : "a")
        : (errorY > 0 ? "s" : "w");
      // Move only part of the measured error. Each iteration closes the loop on
      // fresh replicated coordinates, so browser/input scheduler jitter cannot
      // accumulate into a different contact geometry.
      const durationMs = Math.max(
        35,
        Math.min(140, Math.round((distance / COMBAT.moveSpeed) * 1000 * 0.72)),
      );
      await pulseMovementKey(entry, key, durationMs);
      // M158 staging is walking, not double-tap dashing. A repeated genuine
      // W3C WASD down within 240ms can trigger the 750px/s authoritative dash
      // and overshoot the measured target. Keep the real keys, then let the
      // gesture window expire before deciding the next correction.
      await sleep(DASH_DOUBLE_TAP_MS + 20);
    }
    throw new Error(milestone + " could not stage authoritative " + label + " geometry: "
      + JSON.stringify(last));
  };

  // Stage from replicated world coordinates instead of assuming a WebDriver
  // key-hold duration equals a fixed authoritative distance. #3 sits 40 px
  // ahead of #2 and 31 px off-axis. This restores the proven M158 cluster shape:
  // #2's unchanged 34 px knockback cannot eject #3 beyond the roll corridor,
  // while one unchanged 170 ms roll still reaches both victims in order.
  // A deterministic tolerance sweep over every +/-5 px staging extreme produces
  // both contacts with 67-117 ms stagger and the second contact by 150 ms.
  // Production geometry/timing is untouched.
  // R2 3-second WASD dash can legitimately fire during repeated real staging
  // pulses. Re-measure both actual fighter positions, and stage the second
  // opponent firmly inside the SAME 170ms mouse-roll collision corridor.
  // Old (40,31) was at the farthest edge: exact-head 39153033803 showed a
  // genuine roll knocking #2 down but entirely missing #3 at 42/36 offset.
  // Keep both server-owned contacts, #2-first ordering and untouched HP gates.
  const secondaryDx = rollRight ? 34 : -34;
  const secondaryDy = 24;
  const rollerDx = rollRight ? -62 : 62;
  let stagedGeometry = null;
  for (let pass = 0; pass < 5; pass += 1) {
    await positionRelativeToAuthoritativeTarget(
      secondVictim,
      secondVictimId,
      firstVictimId,
      secondaryDx,
      secondaryDy,
      "secondary victim",
    );
    await positionRelativeToAuthoritativeTarget(
      roller,
      rollerId,
      firstVictimId,
      rollerDx,
      0,
      "roller",
    );
    await sleep(70);

    const state = await readUiEvidence(roller);
    const fighters = state.acceptance?.fighters ?? [];
    const rollerFighter = fighters.find((fighter) => fighter.netId === rollerId);
    const firstFighter = fighters.find((fighter) => fighter.netId === firstVictimId);
    const secondFighter = fighters.find((fighter) => fighter.netId === secondVictimId);
    if (rollerFighter && firstFighter && secondFighter) {
      const geometry = {
        rollerDx: rollerFighter.x - firstFighter.x,
        rollerDy: rollerFighter.y - firstFighter.y,
        secondaryDx: secondFighter.x - firstFighter.x,
        secondaryDy: secondFighter.y - firstFighter.y,
      };
      const stable = Math.abs(geometry.rollerDx - rollerDx) <= 5
        && Math.abs(geometry.rollerDy) <= 5
        && Math.abs(geometry.secondaryDx - secondaryDx) <= 5
        && Math.abs(geometry.secondaryDy - secondaryDy) <= 5;
      if (stable) {
        stagedGeometry = {
          pass: pass + 1,
          roller: { ...rollerFighter },
          first: { ...firstFighter },
          second: { ...secondFighter },
          ...geometry,
        };
        break;
      }
    }
  }
  if (!stagedGeometry) {
    throw new Error(milestone + " could not stabilize authoritative three-fighter roll geometry");
  }

  await aimArena(roller, rollerElementId, rollOffset);
  await sleep(60);

  const beforeStates = await Promise.all(entries.map(readUiEvidence));
  const rollerBefore = beforeStates.find((entry) => entry.browser === roller.name);
  const firstBefore = beforeStates.find((entry) => entry.browser === firstVictim.name);
  const secondBefore = beforeStates.find((entry) => entry.browser === secondVictim.name);
  const wheelOffset = rollerBefore.wheels.length;
  const firstActionOffset = firstBefore.acceptance?.ownActionTransitions?.length ?? 0;
  const secondActionOffset = secondBefore.acceptance?.ownActionTransitions?.length ?? 0;
  await scrollArenaWheel(roller, rollerElementId, -120, 0);

  let overlap = null;
  const overlapDeadline = Date.now() + COMBAT.dodge.durationMs + COMBAT.dodge.collisionKnockdownMs + 520;
  while (Date.now() < overlapDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const rollerState = states.find((entry) => entry.browser === roller.name);
    const firstState = states.find((entry) => entry.browser === firstVictim.name);
    const secondState = states.find((entry) => entry.browser === secondVictim.name);
    const rollerActions = rollerState?.acceptance?.ownActionTransitions ?? [];
    const firstActions = (firstState?.acceptance?.ownActionTransitions ?? []).slice(firstActionOffset);
    const secondActions = (secondState?.acceptance?.ownActionTransitions ?? []).slice(secondActionOffset);
    const rollTransition = rollerActions
      .filter((entry) => entry.action === COMBAT_ACTION.dodge && Number.isFinite(entry.epochMs))
      .at(-1);
    const firstKnockdown = firstActions.find((entry) =>
      entry.action === COMBAT_ACTION.knockdown && Number.isFinite(entry.epochMs));
    const secondKnockdown = secondActions.find((entry) =>
      entry.action === COMBAT_ACTION.knockdown && Number.isFinite(entry.epochMs));
    const firstCurrentAction = firstState?.acceptance?.ownActionTransitions?.at(-1)?.action;
    const secondCurrentAction = secondState?.acceptance?.ownActionTransitions?.at(-1)?.action;
    const rollWheels = rollerState?.wheels?.slice(wheelOffset)?.filter((entry) => entry.deltaY < 0) ?? [];
    const vitalsClean = rollerState?.playerHp === 100 && rollerState?.playerGuard === 100
      && firstState?.playerHp === 100 && firstState?.playerGuard === 100
      && secondState?.playerHp === 100 && secondState?.playerGuard === 100;
    const primaryRendered = rollerState?.focusLabel === "KNOCKDOWN #" + firstVictimId
      && rollerState?.recoveryVisible
      && rollerState?.recoveryState === "knockdown"
      && rollerState?.recoveryLabel === "PUNISH"
      && rollerState?.recoveryDetail === "Knockdown recovery";

    if (rollTransition && firstKnockdown && secondKnockdown
      && firstCurrentAction === COMBAT_ACTION.knockdown
      && secondCurrentAction === COMBAT_ACTION.knockdown
      && rollWheels.length === 1 && vitalsClean && primaryRendered) {
      if (!Number.isFinite(rollWheels[0].epochMs)) {
        throw new Error(milestone + " genuine wheel-forward roll lacked epoch evidence: "
          + JSON.stringify(rollWheels));
      }
      if (firstKnockdown.epochMs >= secondKnockdown.epochMs) {
        throw new Error(milestone + " did not hit #"
          + firstVictimId + " before #" + secondVictimId + ": "
          + JSON.stringify({ firstKnockdown, secondKnockdown }));
      }
      for (const transition of [firstKnockdown, secondKnockdown]) {
        if (transition.epochMs + 80 < rollTransition.epochMs
          || transition.epochMs > rollTransition.epochMs + COMBAT.dodge.durationMs + 140) {
          throw new Error(milestone + " could not tie both knockdowns to the same authoritative roll: "
            + JSON.stringify({ rollTransition, firstKnockdown, secondKnockdown }));
        }
      }
      overlap = {
        states,
        rollTransition,
        rollWheel: rollWheels[0],
        firstKnockdown,
        secondKnockdown,
      };
      break;
    }

    if ((Number.isFinite(rollerState?.playerHp) && rollerState.playerHp < 100)
      || (Number.isFinite(firstState?.playerHp) && firstState.playerHp < 100)
      || (Number.isFinite(secondState?.playerHp) && secondState.playerHp < 100)
      || (Number.isFinite(firstState?.playerGuard) && firstState.playerGuard < 100)
      || (Number.isFinite(secondState?.playerGuard) && secondState.playerGuard < 100)) {
      throw new Error(milestone + " roll arbitration setup changed health/guard: " + JSON.stringify(states));
    }
    await sleep(8);
  }

  if (!overlap) {
    throw new Error(milestone + " never produced two overlapping roll knockdowns with #"
      + firstVictimId + " selected first: "
      + JSON.stringify({
        stagedGeometry,
        beforeStates,
        finalStates: await Promise.all(entries.map(readUiEvidence)),
      }));
  }

  let handoff = null;
  const handoffDeadline = Date.now() + COMBAT.dodge.collisionKnockdownMs + 520;
  while (Date.now() < handoffDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const rollerState = states.find((entry) => entry.browser === roller.name);
    const firstState = states.find((entry) => entry.browser === firstVictim.name);
    const secondState = states.find((entry) => entry.browser === secondVictim.name);
    const firstTransitions = firstState?.acceptance?.ownActionTransitions ?? [];
    const secondTransitions = secondState?.acceptance?.ownActionTransitions ?? [];
    const firstRecovery = firstTransitions.find((entry) =>
      entry.action === COMBAT_ACTION.idle
      && Number.isFinite(entry.epochMs)
      && entry.epochMs > overlap.firstKnockdown.epochMs);
    const secondRecovery = secondTransitions.find((entry) =>
      entry.action === COMBAT_ACTION.idle
      && Number.isFinite(entry.epochMs)
      && entry.epochMs > overlap.secondKnockdown.epochMs);
    const handoffTransition = rollerState?.focusTransitions
      ?.find((entry) =>
        entry.label === "KNOCKDOWN #" + secondVictimId
        && Number.isFinite(entry.epochMs)
        && (!firstRecovery || entry.epochMs >= firstRecovery.epochMs - 80));
    const vitalsClean = rollerState?.playerHp === 100 && rollerState?.playerGuard === 100
      && firstState?.playerHp === 100 && firstState?.playerGuard === 100
      && secondState?.playerHp === 100 && secondState?.playerGuard === 100;

    // The handoff window can be shorter than one three-browser polling round.
    // Prove it from ordered authoritative/UI transition history instead of
    // requiring one sampled snapshot to catch #3 still knocked down.
    if (firstRecovery && secondRecovery && handoffTransition && vitalsClean) {
      // Cross-browser UI transition timestamps can trail the authoritative
      // recovery stream by one render frame. Keep the existing 80 ms tolerance
      // on the first-recovery edge and mirror it on the second-recovery edge;
      // the ordered knockdown/recovery histories still prove the bounded window.
      if (handoffTransition.epochMs < firstRecovery.epochMs - 80
        || handoffTransition.epochMs >= secondRecovery.epochMs + 80) {
        throw new Error(milestone + " handoff was not ordered around the two recoveries: "
          + JSON.stringify({
            firstRecovery,
            handoffTransition,
            secondRecovery,
            focusTransitions: rollerState.focusTransitions,
          }));
      }
      handoff = { states, firstRecovery, secondRecovery, handoffTransition };
      break;
    }
    await sleep(8);
  }

  if (!handoff) {
    const diagnostics = await Promise.all(entries.map(readUiEvidence));
    // Diagnostic only. The genuine M158 handoff still fails closed here.
    // Compare only shared server tick IDs across clients, not epochMs.
    console.log("M220_KNOCKDOWN_FOCUS_TIMELINE " + JSON.stringify(
      summarizeM220KnockdownFocusTimeline({
        roller: diagnostics.find((entry) => entry.browser === roller.name),
        firstVictim: diagnostics.find((entry) => entry.browser === firstVictim.name),
        secondVictim: diagnostics.find((entry) => entry.browser === secondVictim.name),
        firstId: firstVictimId,
        secondId: secondVictimId,
        knockdownAction: COMBAT_ACTION.knockdown,
        idleAction: COMBAT_ACTION.idle,
        strictHandoffPassed: false,
      }),
    ));
    throw new Error(milestone + " did not hand KNOCKDOWN focus from #"
      + firstVictimId + " to still-downed #" + secondVictimId + ": "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  const clearDeadline = Date.now() + COMBAT.dodge.collisionKnockdownMs + 520;
  let finalEvidence = null;
  while (Date.now() < clearDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const rollerState = states.find((entry) => entry.browser === roller.name);
    const firstState = states.find((entry) => entry.browser === firstVictim.name);
    const secondState = states.find((entry) => entry.browser === secondVictim.name);
    const firstAction = firstState?.acceptance?.ownActionTransitions?.at(-1)?.action;
    const secondAction = secondState?.acceptance?.ownActionTransitions?.at(-1)?.action;
    if (firstAction === COMBAT_ACTION.idle
      && secondAction === COMBAT_ACTION.idle
      && !rollerState?.focusLabel?.startsWith("KNOCKDOWN #")
      && !rollerState?.recoveryVisible
      && rollerState?.playerHp === 100 && rollerState?.playerGuard === 100
      && firstState?.playerHp === 100 && firstState?.playerGuard === 100
      && secondState?.playerHp === 100 && secondState?.playerGuard === 100) {
      finalEvidence = states;
      break;
    }
    await sleep(16);
  }

  if (!finalEvidence) {
    throw new Error(milestone + " knockdown arbitration did not clear after both recoveries: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  return finalEvidence.map((entry) => ({
    ...entry,
    m158RollerId: rollerId,
    m158PrimaryKnockdownId: firstVictimId,
    m158SecondaryKnockdownId: secondVictimId,
    m158RollEpochMs: overlap.rollTransition.epochMs,
    m158RollWheelEpochMs: overlap.rollWheel.epochMs,
    m158PrimaryKnockdownEpochMs: overlap.firstKnockdown.epochMs,
    m158SecondaryKnockdownEpochMs: overlap.secondKnockdown.epochMs,
    m158PrimaryRecoveryEpochMs: handoff.firstRecovery.epochMs,
    m158HandoffEpochMs: handoff.handoffTransition.epochMs,
  }));
}


async function runOnlineUiMultiKnockdownFfaHitFlight(entries) {
  const milestone = "M159 actionable simultaneous FFA knockdown punish";
  if (entries.length !== 4) {
    throw new Error(milestone + " expected four real browser clients, received " + entries.length);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const roller = entries.find((entry) => entry.name === "chrome");
  const firstVictim = entries.find((entry) => entry.name === "firefox");
  const secondVictim = entries.find((entry) => entry.name === "chrome2");
  const punisher = entries.find((entry) => entry.name === "chrome3");
  const rollerReady = ready.find((entry) => entry.browser === roller?.name);
  const firstReady = ready.find((entry) => entry.browser === firstVictim?.name);
  const secondReady = ready.find((entry) => entry.browser === secondVictim?.name);
  const punisherReady = ready.find((entry) => entry.browser === punisher?.name);
  if (!roller || !firstVictim || !secondVictim || !punisher
    || !rollerReady || !firstReady || !secondReady || !punisherReady) {
    throw new Error(milestone + " could not resolve deterministic FFA roles: " + JSON.stringify(ready));
  }

  const rollerId = rollerReady.playerNetId;
  const firstVictimId = firstReady.playerNetId;
  const secondVictimId = secondReady.playerNetId;
  const punisherId = punisherReady.playerNetId;
  const ids = [rollerId, firstVictimId, secondVictimId, punisherId];
  const labels = ids.map((id) => "#" + id);
  const rosterDeadline = Date.now() + 3200;
  let rosterReady = null;
  while (Date.now() < rosterDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const converged = states.every((entry) =>
      entry.playerHp === 100
      && entry.playerGuard === 100
      && entry.scoreboardRows?.length === 4
      && entry.scoreboardRows.every((row, index) => row.label === labels[index] && row.kills === 0)
      && entry.scoreboardRows.filter((row) => row.own).length === 1
      && !entry.overlayVisible);
    if (converged) {
      rosterReady = states;
      break;
    }
    await sleep(40);
  }
  if (!rosterReady) {
    throw new Error(milestone + " four-player roster never converged: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  await Promise.all(entries.map(centerArenaInViewport));

  const rollerElementId = await resolveArenaElement(roller, milestone + " roller");
  const punisherElementId = await resolveArenaElement(punisher, milestone + " punisher");
  const rollRight = rollerId < firstVictimId;
  const rollKey = rollRight ? "d" : "a";
  // Roll direction remains pointer-owned. Hold downward movement so that once
  // dodge recovery starts, #1 leaves #4's upper punish lane vertically instead
  // of crossing the selected #2 light cone horizontally.
  const retreatKey = "s";
  const secondClusterKey = secondVictimId > firstVictimId ? "a" : "d";
  const rollOffset = rollRight ? 200 : -200;

  // Shift the roll corridor down so #4 can remain safely above it. Stage #1
  // closer to #2 before the roll so the unchanged 117 px dodge travel carries
  // the roller clearly past #2 after impact. Put #4 near the midpoint between
  // their eventual x positions but keep it >44 px above the roll corridor.
  // A shallow down-left aim then includes selected #2 while excluding both
  // the farther-right roller and the lower #3 by the unchanged light arc.
  // Pull #4 to the top boundary, then farther left than the old staging.
  // This creates center-distance exclusivity in addition to arc exclusivity:
  // after #2's unchanged roll knockback, #2 remains inside the unchanged
  // 94 px light center-distance reach while roller #1 and lower #3 are both
  // outside it. The >70 px vertical gap still keeps #4 outside the 44 px roll
  // collision threshold.
  await pulseMovementKey(punisher, "w", 120);
  await Promise.all([
    pulseMovementKey(roller, "s", 235),
    pulseMovementKey(firstVictim, "s", 235),
    pulseMovementKey(secondVictim, "s", 365),
    pulseMovementKey(punisher, "a", 870),
  ]);
  await pulseMovementKey(secondVictim, secondClusterKey, 340);
  await pulseMovementKey(roller, rollKey, 210);

  // M197: the browser/driver skew is not safely solved by weakening the
  // 260ms authoritative knockdown overlap assertion. Align the SECOND
  // victim's projected x contact point ~18px after the first BEFORE the
  // roll, using only true W3C key events and read-only server snapshots.
  // This reduces second contact lag while retaining distinct victims,
  // genuine wheel/LMB provenance and first-victim-only target selection.
  const readM197Cluster = async () => {
    const evidence = await readUiEvidence(punisher);
    const fighters = evidence.acceptance?.fighters ?? [];
    const first = fighters.find(fighter => fighter.netId === firstVictimId);
    const second = fighters.find(fighter => fighter.netId === secondVictimId);
    if (!Number.isFinite(first?.x) || !Number.isFinite(second?.x)) {
      throw new Error(milestone + " M197 staging missing genuine authoritative victim positions: "
        + JSON.stringify({ first, second, fighters }));
    }
    return { first, second };
  };
  const clusterPlans = [];
  let clusterAligned = null;
  for (let adjustment = 0; adjustment < 3; adjustment += 1) {
    const { first, second } = await readM197Cluster();
    const plan = planM197KnockdownClusterNudge({
      rollRight, firstX: first.x, secondX: second.x,
      moveSpeed: COMBAT.moveSpeed, targetLeadPx: 18, tolerancePx: 8,
    });
    clusterPlans.push({ adjustment, firstX: first.x, secondX: second.x, ...plan });
    if (plan.aligned) {
      clusterAligned = plan;
      break;
    }
    await pulseMovementKey(secondVictim, plan.key, plan.pulseMs);
    await sleep(90);
  }
  if (!clusterAligned) {
    const { first, second } = await readM197Cluster();
    const plan = planM197KnockdownClusterNudge({
      rollRight, firstX: first.x, secondX: second.x,
      moveSpeed: COMBAT.moveSpeed, targetLeadPx: 18, tolerancePx: 8,
    });
    clusterPlans.push({ adjustment: 3, firstX: first.x, secondX: second.x, ...plan });
    if (!plan.aligned) {
      throw new Error(milestone + " M197 could not stage genuine ordered roll contacts: "
        + JSON.stringify(clusterPlans));
    }
  }
  console.log("M197_GENUINE_CLUSTER_STAGING " + JSON.stringify({
    milestone, rollRight, clusterPlans,
  }));
  await aimArena(roller, rollerElementId, rollOffset);
  await sleep(50);

  const beforeStates = await Promise.all(entries.map(readUiEvidence));
  const rollerBefore = beforeStates.find((entry) => entry.browser === roller.name);
  const firstBefore = beforeStates.find((entry) => entry.browser === firstVictim.name);
  const secondBefore = beforeStates.find((entry) => entry.browser === secondVictim.name);
  const punisherBefore = beforeStates.find((entry) => entry.browser === punisher.name);
  const wheelOffset = rollerBefore.wheels.length;
  const rollerActionOffset = rollerBefore.acceptance?.ownActionTransitions?.length ?? 0;
  const firstActionOffset = firstBefore.acceptance?.ownActionTransitions?.length ?? 0;
  const secondActionOffset = secondBefore.acceptance?.ownActionTransitions?.length ?? 0;
  const punishPointerOffset = punisherBefore.pointers.length;

  // Pre-aim before the roll so no target-selection/geometry round trip consumes
  // the unchanged 260 ms knockdown window. The windup still re-aims after #3
  // joins the overlap, preserving exclusive target proof against live positions.
  const punishAim = await aimArenaForExclusiveAuthoritativeTarget(
    punisher,
    punisherElementId,
    firstVictimId,
    [rollerId, secondVictimId],
    COMBAT.attack,
    milestone + " selected punish pre-aim",
  );
  const readRollerOwnActions = () => execute(
    roller.base,
    roller.sessionId,
    "return (window.__MYASO_ACCEPTANCE_STATE__?.ownActionTransitions ?? []).map((entry) => ({ ...entry }));",
  );

  await setMovementKey(roller, retreatKey, true);
  await scrollArenaWheel(roller, rollerElementId, -120, 0);

  let rollTrigger = null;
  const rollTriggerDeadline = Date.now() + COMBAT.dodge.durationMs + 180;
  while (Date.now() < rollTriggerDeadline && !rollTrigger) {
    const rollerActions = await readRollerOwnActions();
    rollTrigger = rollerActions.slice(rollerActionOffset).find((entry) =>
      entry.action === COMBAT_ACTION.dodge && Number.isFinite(entry.epochMs)) ?? null;
    if (!rollTrigger) await sleep(1);
  }
  if (!rollTrigger) {
    await setMovementKey(roller, retreatKey, false);
    throw new Error(milestone + " never observed the authoritative roll before punish staging");
  }

  // R1 short LMB commits on authentic pointerUP, not pointerDOWN.
  // Keep the genuine press synchronized to the observed authoritative dodge
  // and RELEASE after 5ms, before cross-browser #3-knockdown observation or
  // retargeting latency can postpone the 135ms light windup beyond the
  // unchanged 260ms shared knockdown. A fresh genuine mouse move re-aims
  // during the already-committed windup after #3's actual knockdown.
  // The unchanged strict M209 60Hz server proof must still show active AND
  // the exact single 34HP hit strictly before either victim recovers.
  await setArenaAttackButton(punisher, true);
  // M252 integrates M246: real R1 short-LMB triggers on pointerUP.
  // Use an authentic 5ms W3C down/up tap to preserve the strict unchanged
  // 260ms BOTH-knockdown overlap under cross-browser driver scheduling.
  await sleep(5);
  await setArenaAttackButton(punisher, false);
  let windupReaim = null;
  const reaimDeadline = Date.now() + Math.max(80, COMBAT.attack.windupMs - 20);
  while (!windupReaim && Date.now() < reaimDeadline) {
    const secondState = await readUiEvidence(secondVictim);
    const secondActions = (secondState?.acceptance?.ownActionTransitions ?? []).slice(secondActionOffset);
    const secondKnockdown = secondActions.find((entry) =>
      entry.action === COMBAT_ACTION.knockdown && Number.isFinite(entry.epochMs));
    if (secondKnockdown) {
      const aim = await aimArenaForExclusiveAuthoritativeTarget(
        punisher,
        punisherElementId,
        firstVictimId,
        [rollerId, secondVictimId],
        COMBAT.attack,
        milestone + " windup re-aim",
      );
      windupReaim = { secondKnockdown, aim };
      break;
    }
    await sleep(2);
  }
  if (!windupReaim) {
    await setMovementKey(roller, retreatKey, false);
    throw new Error(milestone + " did not refresh #4 aim on #3 knockdown before light active: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  let hitEvidence = null;
  let provenance = null;
  const hitDeadline = Date.now() + COMBAT.attack.windupMs + COMBAT.attack.activeMs + 360;
  while (Date.now() < hitDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const rollerState = states.find((entry) => entry.browser === roller.name);
    const firstState = states.find((entry) => entry.browser === firstVictim.name);
    const secondState = states.find((entry) => entry.browser === secondVictim.name);
    const punisherState = states.find((entry) => entry.browser === punisher.name);
    const rollerActions = rollerState?.acceptance?.ownActionTransitions ?? [];
    const firstActions = (firstState?.acceptance?.ownActionTransitions ?? []).slice(firstActionOffset);
    const secondActions = (secondState?.acceptance?.ownActionTransitions ?? []).slice(secondActionOffset);
    const rollTransition = rollerActions
      .filter((entry) => entry.action === COMBAT_ACTION.dodge && Number.isFinite(entry.epochMs))
      .at(-1);
    const firstKnockdown = firstActions.find((entry) =>
      entry.action === COMBAT_ACTION.knockdown && Number.isFinite(entry.epochMs));
    const secondKnockdown = secondActions.find((entry) =>
      entry.action === COMBAT_ACTION.knockdown && Number.isFinite(entry.epochMs));
    const rollWheels = rollerState?.wheels?.slice(wheelOffset)?.filter((entry) => entry.deltaY < 0) ?? [];
    const primaryFocusSeen = punisherState?.focusTransitions?.some((entry) =>
      entry.label === "KNOCKDOWN #" + firstVictimId);

    if (rollTransition && firstKnockdown && secondKnockdown && rollWheels.length === 1 && primaryFocusSeen) {
      provenance = { rollTransition, firstKnockdown, secondKnockdown, rollWheel: rollWheels[0] };
    }

    if (firstState?.playerHp === 66 && firstState?.playerGuard === 100
      && secondState?.playerHp === 100 && secondState?.playerGuard === 100
      && rollerState?.playerHp === 100 && rollerState?.playerGuard === 100
      && punisherState?.playerHp === 100 && punisherState?.playerGuard === 100) {
      hitEvidence = states;
      break;
    }

    const wrongDamage = (Number.isFinite(secondState?.playerHp) && secondState.playerHp < 100)
      || (Number.isFinite(rollerState?.playerHp) && rollerState.playerHp < 100)
      || (Number.isFinite(punisherState?.playerHp) && punisherState.playerHp < 100)
      || (Number.isFinite(firstState?.playerGuard) && firstState.playerGuard < 100)
      || (Number.isFinite(secondState?.playerGuard) && secondState.playerGuard < 100)
      || (Number.isFinite(rollerState?.playerGuard) && rollerState.playerGuard < 100)
      || (Number.isFinite(punisherState?.playerGuard) && punisherState.playerGuard < 100)
      || (Number.isFinite(firstState?.playerHp) && firstState.playerHp < 66);
    if (wrongDamage) {
      await setMovementKey(roller, retreatKey, false);
      throw new Error(milestone + " damaged the wrong fighter/guard or hit more than once: "
        + JSON.stringify(states));
    }
    await sleep(6);
  }
  await setMovementKey(roller, retreatKey, false);

  if (!hitEvidence || !provenance) {
    throw new Error(milestone + " did not land exactly one selected 34 HP punish with roll provenance: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  const rollerState = hitEvidence.find((entry) => entry.browser === roller.name);
  const firstState = hitEvidence.find((entry) => entry.browser === firstVictim.name);
  const secondState = hitEvidence.find((entry) => entry.browser === secondVictim.name);
  const punisherState = hitEvidence.find((entry) => entry.browser === punisher.name);

  const firstKnockdownTick = provenance.firstKnockdown.serverTick;
  const secondKnockdownTick = provenance.secondKnockdown.serverTick;
  if (!Number.isFinite(provenance.rollWheel.epochMs)
    || !Number.isFinite(firstKnockdownTick)
    || !Number.isFinite(secondKnockdownTick)
    || firstKnockdownTick > secondKnockdownTick) {
    throw new Error(milestone + " did not prove authoritative ordered/same-tick roll knockdowns: "
      + JSON.stringify(provenance));
  }
  for (const transition of [provenance.firstKnockdown, provenance.secondKnockdown]) {
    if (transition.epochMs + 80 < provenance.rollTransition.epochMs
      || transition.epochMs > provenance.rollTransition.epochMs + COMBAT.dodge.durationMs + 140) {
      throw new Error(milestone + " could not tie both knockdowns to the same authoritative roll: "
        + JSON.stringify(provenance));
    }
  }

  const punishPointers = punisherState.pointers.slice(punishPointerOffset);
  const punishDowns = punishPointers.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
  const punishUps = punishPointers.filter((entry) => entry.type === "pointerup" && entry.button === 0);
  const punishDown = punishDowns[0];
  const punishUp = punishUps[0];
  if (punishDowns.length !== 1 || punishUps.length !== 1
    || !Number.isFinite(punishDown?.epochMs) || !Number.isFinite(punishUp?.epochMs)
    || punishUp.epochMs <= punishDown.epochMs
    || punishUp.epochMs - punishDown.epochMs >= 320
    || punishDown.epochMs < provenance.rollTransition.epochMs
    || punishDown.epochMs < provenance.firstKnockdown.epochMs - 40
    || punishDown.epochMs >= provenance.firstKnockdown.epochMs + COMBAT.dodge.collisionKnockdownMs) {
    throw new Error(milestone + " genuine #4 LMB did not target the selected overlap window: "
      + JSON.stringify({ punishPointers, provenance, punishAim }));
  }

  // M209: 50ms replicated browser snapshots can miss the true 80ms light
  // active phase. Require the *actual* 60Hz authoritative roll, both
  // knockdowns, punisher windup->active and selected victim hit instead.
  // A genuinely late active at or after FIRST recovery remains invalid.
  const sampledActions = punisherState.acceptance?.ownActionTransitions ?? [];
  const punishWindup = sampledActions.find(entry =>
    entry.action === COMBAT_ACTION.attackWindup
    && Number.isFinite(entry.epochMs)
    && entry.epochMs >= punishDown.epochMs - 40) ?? null;
  const sampledPunishActive = punishWindup
    ? sampledActions.find(entry =>
      entry.action === COMBAT_ACTION.attackActive
      && Number.isFinite(entry.epochMs)
      && entry.epochMs >= punishWindup.epochMs) ?? null
    : null;
  let authoritativePunish = null;
  let proofError = null;
  const m209ProofDeadline = Date.now() + 180;
  while (!authoritativePunish && Date.now() < m209ProofDeadline) {
    try {
      authoritativePunish = verifyM209DualKnockdownServerPunish(m201ServerOutput(), {
        rollerId, firstVictimId, secondVictimId, punisherId,
      });
    } catch (error) {
      proofError = error?.message ?? String(error);
      await sleep(8);
    }
  }
  if (!authoritativePunish) {
    throw new Error(milestone + " server attack-active/hit was not inside BOTH authentic knockdowns: "
      + JSON.stringify({
        punishDown, sampledWindup: punishWindup,
        sampledPunishActive, firstKnockdown: provenance.firstKnockdown,
        secondKnockdown: provenance.secondKnockdown, proofError,
      }));
  }
  console.log("M209_SERVER_DUAL_KNOCKDOWN_PUNISH " + JSON.stringify({
    rollerId, firstVictimId, secondVictimId, punisherId,
    genuineLmbDowns: punishDowns.length, genuineLmbUps: punishUps.length,
    sampledActiveObserved: !!sampledPunishActive,
    ...authoritativePunish,
  }));
  const focusTransition = punisherState.focusTransitions.find((entry) =>
    entry.label === "KNOCKDOWN #" + firstVictimId && Number.isFinite(entry.epochMs));
  const cueTransition = punisherState.recoveryTransitions.find((entry) =>
    entry.visible
    && entry.state === "knockdown"
    && entry.label === "PUNISH"
    && entry.detail === "Knockdown recovery");
  if (!focusTransition || !cueTransition
    || !firstState.events.includes("Hit taken - 34 HP.")) {
    throw new Error(milestone + " selected-target readability/victim feedback was incomplete: "
      + JSON.stringify({ focusTransition, cueTransition, firstEvents: firstState.events }));
  }

  // Let all actions settle and prove the secondary knockdown never took damage.
  const settleDeadline = Date.now() + COMBAT.attack.recoveryMs + COMBAT.dodge.collisionKnockdownMs + 520;
  let finalEvidence = null;
  while (Date.now() < settleDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const currentRoller = states.find((entry) => entry.browser === roller.name);
    const currentFirst = states.find((entry) => entry.browser === firstVictim.name);
    const currentSecond = states.find((entry) => entry.browser === secondVictim.name);
    const currentPunisher = states.find((entry) => entry.browser === punisher.name);
    const firstAction = currentFirst?.acceptance?.ownActionTransitions?.at(-1)?.action;
    const secondAction = currentSecond?.acceptance?.ownActionTransitions?.at(-1)?.action;
    const punishAction = currentPunisher?.acceptance?.ownActionTransitions?.at(-1)?.action;
    if (firstAction === COMBAT_ACTION.idle
      && secondAction === COMBAT_ACTION.idle
      && punishAction === COMBAT_ACTION.idle
      && currentFirst?.playerHp === 66 && currentFirst?.playerGuard === 100
      && currentSecond?.playerHp === 100 && currentSecond?.playerGuard === 100
      && currentRoller?.playerHp === 100 && currentRoller?.playerGuard === 100
      && currentPunisher?.playerHp === 100 && currentPunisher?.playerGuard === 100) {
      finalEvidence = states;
      break;
    }
    await sleep(16);
  }
  if (!finalEvidence) {
    throw new Error(milestone + " did not settle with only selected #"
      + firstVictimId + " damaged: " + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  return finalEvidence.map((entry) => ({
    ...entry,
    m159RollerId: rollerId,
    m159PrimaryKnockdownId: firstVictimId,
    m159SecondaryKnockdownId: secondVictimId,
    m159PunisherId: punisherId,
    m159RollEpochMs: provenance.rollTransition.epochMs,
    m159PrimaryKnockdownEpochMs: provenance.firstKnockdown.epochMs,
    m159SecondaryKnockdownEpochMs: provenance.secondKnockdown.epochMs,
    m159PunishPointerEpochMs: punishDown.epochMs,
    m159PunishActiveEpochMs: sampledPunishActive?.epochMs ?? null,
    m209ServerPunishActiveTick: authoritativePunish.active.tick,
    m209ServerFirstRecoveryTick: authoritativePunish.firstRecovery?.tick ?? null,
    m159WindupReaimDistance: windupReaim.aim.targetDistance,
  }));
}

async function runOnlineUiRollKnockdownFfaHitFlight(entries) {
  const milestone = "M156 actionable third-party roll knockdown punish";
  if (entries.length !== 3) {
    throw new Error(milestone + " expected three real browser clients, received " + entries.length);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const roller = entries.find((entry) => entry.name === "chrome");
  const defender = entries.find((entry) => entry.name === "firefox");
  const punisher = entries.find((entry) => entry.name === "chrome2");
  const rollerReady = ready.find((entry) => entry.browser === roller?.name);
  const defenderReady = ready.find((entry) => entry.browser === defender?.name);
  const punisherReady = ready.find((entry) => entry.browser === punisher?.name);
  if (!roller || !defender || !punisher || !rollerReady || !defenderReady || !punisherReady) {
    throw new Error(milestone + " could not resolve deterministic FFA roles: " + JSON.stringify(ready));
  }

  const rollerId = rollerReady.playerNetId;
  const defenderId = defenderReady.playerNetId;
  const punisherId = punisherReady.playerNetId;
  await waitForUiThreePlayerReady(entries, [rollerId, defenderId, punisherId], 2500);
  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  await Promise.all(entries.map(centerArenaInViewport));

  const rollerElementId = await resolveArenaElement(roller, milestone + " roller");
  const punisherElementId = await resolveArenaElement(punisher, milestone + " punisher");
  const rollRight = rollerId < defenderId;
  const movementKey = rollRight ? "d" : "a";
  const retreatKey = rollRight ? "a" : "d";
  const rollOffset = rollRight ? 200 : -200;
  const punishOffset = punisherId < defenderId ? 200 : -200;

  // Subscribe to the first authoritative knockdown within Firefox instead
  // of serially polling WebDriver HTTP across this 260 ms conversion window.
  const waitForDefenderKnockdown = (offset, timeoutMs) => webdriver(
    defender.base,
    "POST",
    `/session/${defender.sessionId}/execute/async`,
    {
      script: `
        const [offset, knockdownAction, timeoutMs] = arguments;
        const done = arguments[arguments.length - 1];
        const started = performance.now();
        let watcher;
        const check = () => {
          const events = window.__MYASO_ACCEPTANCE_STATE__?.ownActionTransitions ?? [];
          const found = events.slice(offset).find((event) =>
            event.action === knockdownAction && Number.isFinite(event.epochMs));
          if (found || performance.now() - started >= timeoutMs) {
            clearInterval(watcher);
            done(found ? { ...found, observedEpochMs: Date.now() } : null);
          }
        };
        watcher = setInterval(check, 4);
        check();
      `,
      args: [offset, COMBAT_ACTION.knockdown, timeoutMs],
    },
  );

  // Separate the two possible light targets without changing combat reach.
  // Keep #3 at neutral spacing so the unchanged 34-unit roll knockback can
  // bring #2 into the unchanged 76-unit light reach. #1 backs away briefly
  // and keeps that opposite movement held; dodge recovery then continues
  // pulling #1 out of #3's strike lane.
  await aimArena(roller, rollerElementId, rollOffset);
  await aimArena(punisher, punisherElementId, punishOffset);
  await sleep(50);

  const worldProofOffset = m201ServerOutput().length;
  let conversion = null;
  for (let attempt = 1; attempt <= 3 && !conversion; attempt += 1) {
    await setMovementKey(roller, retreatKey, true);
    await sleep(80);

    const [rollerBefore, defenderBefore, punisherBefore] = await Promise.all([
      readUiEvidence(roller),
      readUiEvidence(defender),
      readUiEvidence(punisher),
    ]);
    const rollerWheelOffset = rollerBefore.wheels.length;
    const defenderActionOffset = defenderBefore.acceptance?.ownActionTransitions?.length ?? 0;
    const punishPointerOffset = punisherBefore.pointers.length;

    // Begin observing Firefox before sending the genuine Chrome wheel-forward.
    // Awaiting that WebDriver wheel response first can consume a meaningful
    // fraction of the 260 ms knockdown before the observer is even armed.
    // Parallel sessions retain real wheel and pointer provenance; neither
    // action nor authoritative state is synthesized or modified here.
    const knockdownTimeoutMs = COMBAT.dodge.durationMs
      + COMBAT.dodge.collisionKnockdownMs + 220;
    const knockdownWatcher = waitForDefenderKnockdown(
      defenderActionOffset,
      knockdownTimeoutMs,
    );
    // Do not await the independent roller WebDriver wheel ACK before Chrome2
    // can react to Firefox's already-observed authoritative knockdown.
    // The wheel transport and victim watcher are concurrent, and any wheel
    // error still fails the flight at the explicitly awaited completion.
    const rollCompletion = scrollArenaWheel(roller, rollerElementId, -120, 0)
      .then(() => ({ ok: true }), (error) => ({ ok: false, error }));
    const knockdownTransition = await knockdownWatcher;
    const watcherReturnedAt = Date.now();

    if (knockdownTransition) {
      // R1 light is committed on pointerUP. M237: a genuine 35ms hold
      // still left attack-active at the exact same 60Hz tick as #2 recovery
      // in quality #39035692849 (231/231). Use a genuine 5ms W3C click at
      // the pre-staged mouse aim to recover 30ms of INPUT release headroom.
      // This is one real down/up, not a fabricated or early synthetic hit.
      // Do not await the roller's unrelated driver wheel ACK, lengthen the
      // 260ms knockdown, shorten the 135ms server windup, or permit a
      // same-tick active/recovery without the original strict checks.
      const clickDispatchedAt = Date.now();
      await performArenaM221GuardBreakClick(punisher, 5);
      const clickCompletedAt = Date.now();
      console.log("M156_NATIVE_DISPATCH_DIAGNOSTIC " + JSON.stringify({
        attempt, knockdownTransition, watcherReturnedAt,
        clickDispatchedAt, clickCompletedAt,
        nodeDispatchDelayMs: clickDispatchedAt - watcherReturnedAt,
        nodeClickCommandMs: clickCompletedAt - clickDispatchedAt,
        world: m201ServerOutput().slice(worldProofOffset),
      }));
      const rollResult = await rollCompletion;
      if (!rollResult.ok) throw rollResult.error;
      conversion = {
        attempt,
        punishPointerOffset,
        knockdownTransition,
      };

      // Roll provenance and the rendered knockdown cue may trail the victim's
      // first authoritative knockdown snapshot by one or more browser frames.
      // Validate them after the LMB has already been committed.
      const provenanceDeadline = Date.now() + 320;
      while (Date.now() < provenanceDeadline) {
        const states = await Promise.all(entries.map(readUiEvidence));
        const rollerState = states.find((entry) => entry.browser === roller.name);
        const defenderState = states.find((entry) => entry.browser === defender.name);
        const punisherState = states.find((entry) => entry.browser === punisher.name);
        const rollerActions = rollerState?.acceptance?.ownActionTransitions ?? [];
        const rollTransition = rollerActions
          .filter((entry) => entry.action === COMBAT_ACTION.dodge && Number.isFinite(entry.epochMs))
          .at(-1);
        const rollWheels = rollerState?.wheels
          ?.slice(rollerWheelOffset)
          ?.filter((event) => event.deltaY < 0) ?? [];
        const vitalsClean = rollerState?.playerHp === 100 && rollerState?.playerGuard === 100
          && defenderState?.playerHp === 100 && defenderState?.playerGuard === 100
          && punisherState?.playerHp === 100 && punisherState?.playerGuard === 100;
        const focusSeen = punisherState?.focusTransitions?.some((entry) =>
          entry.label === "KNOCKDOWN #" + defenderId);
        const cueSeen = punisherState?.recoveryTransitions?.some((entry) =>
          entry.visible
          && entry.state === "knockdown"
          && entry.label === "PUNISH"
          && entry.detail === "Knockdown recovery");

        if (rollTransition && rollWheels.length === 1 && vitalsClean && focusSeen && cueSeen) {
          if (!Number.isFinite(rollWheels[0].epochMs)) {
            throw new Error(milestone + " genuine wheel-forward roll lacked epoch evidence: "
              + JSON.stringify(rollWheels));
          }
          if (knockdownTransition.epochMs + 80 < rollTransition.epochMs
            || knockdownTransition.epochMs > rollTransition.epochMs + COMBAT.dodge.durationMs + 140) {
            throw new Error(milestone + " could not tie knockdown to the authoritative roll: "
              + JSON.stringify({ rollTransition, knockdownTransition }));
          }
          conversion.rollTransition = rollTransition;
          conversion.rollWheel = rollWheels[0];
          break;
        }
        await sleep(6);
      }

      if (!conversion.rollTransition || !conversion.rollWheel) {
        throw new Error(milestone + " did not validate roll provenance/readability after early LMB: "
          + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
      }
      break;
    }

    const rollResult = await rollCompletion;
    if (!rollResult.ok) throw rollResult.error;
    if (attempt < 3) {
      await setMovementKey(roller, retreatKey, false);
      await sleep(COMBAT.dodge.recoveryMs + COMBAT.dodge.collisionKnockdownMs + 140);
      await pulseMovementKey(roller, movementKey, 80);
      await aimArena(roller, rollerElementId, rollOffset);
      await aimArena(punisher, punisherElementId, punishOffset);
      await sleep(40);
    }
  }

  if (!conversion) {
    throw new Error(milestone + " never produced a third-party KNOCKDOWN target from the real roll: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  let hitEvidence = null;
  const hitDeadline = Date.now() + COMBAT.attack.windupMs + COMBAT.attack.activeMs + 260;
  while (Date.now() < hitDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const rollerState = states.find((entry) => entry.browser === roller.name);
    const defenderState = states.find((entry) => entry.browser === defender.name);
    const punisherState = states.find((entry) => entry.browser === punisher.name);
    if (defenderState?.playerHp === 66 && defenderState?.playerGuard === 100
      && rollerState?.playerHp === 100 && rollerState?.playerGuard === 100
      && punisherState?.playerHp === 100 && punisherState?.playerGuard === 100) {
      hitEvidence = states;
      break;
    }
    if ((Number.isFinite(defenderState?.playerHp) && defenderState.playerHp < 66)
      || (Number.isFinite(defenderState?.playerGuard) && defenderState.playerGuard < 100)
      || (Number.isFinite(rollerState?.playerHp) && rollerState.playerHp < 100)
      || (Number.isFinite(rollerState?.playerGuard) && rollerState.playerGuard < 100)
      || (Number.isFinite(punisherState?.playerHp) && punisherState.playerHp < 100)
      || (Number.isFinite(punisherState?.playerGuard) && punisherState.playerGuard < 100)) {
      throw new Error(milestone + " punish damaged the wrong fighter, guard, or hit more than once: "
        + JSON.stringify(states));
    }
    await sleep(8);
  }
  await setMovementKey(roller, retreatKey, false);
  if (!hitEvidence) {
    throw new Error(milestone + " did not land exactly one 34 HP third-party light during #"
      + defenderId + "'s knockdown conversion window: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  let rollerState = hitEvidence.find((entry) => entry.browser === roller.name);
  let defenderState = hitEvidence.find((entry) => entry.browser === defender.name);
  let punisherState = hitEvidence.find((entry) => entry.browser === punisher.name);
  const knockdownFocusSeen = punisherState.focusTransitions.some((entry) =>
    entry.label === "KNOCKDOWN #" + defenderId);
  const knockdownCueSeen = punisherState.recoveryTransitions.some((entry) =>
    entry.visible
    && entry.state === "knockdown"
    && entry.label === "PUNISH"
    && entry.detail === "Knockdown recovery");
  if (!knockdownFocusSeen || !knockdownCueSeen) {
    throw new Error(milestone + " third fighter never rendered the knockdown punish cue: "
      + JSON.stringify({ focusTransitions: punisherState.focusTransitions, recoveryTransitions: punisherState.recoveryTransitions }));
  }
  const punishPointers = punisherState.pointers.slice(conversion.punishPointerOffset);
  const punishDowns = punishPointers.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
  const punishUps = punishPointers.filter((entry) => entry.type === "pointerup" && entry.button === 0);
  const punishDown = punishDowns[0];
  const punishUp = punishUps[0];
  const punishAimValid = punishDown
    && Math.abs(punishDown.y - 0.5) <= 0.15
    && (punisherId < defenderId ? punishDown.x >= 0.6 : punishDown.x <= 0.4);
  const knockdownEndEpochMs = conversion.knockdownTransition.epochMs + COMBAT.dodge.collisionKnockdownMs;
  // Record the real input and original World before any strict timing rejection.
  // Browser epochs and Node timings remain separate; neither qualifies a HIT.
  console.log("M156_PRE_GATE_CHRONOLOGY " + JSON.stringify({
    knockdownTransition: conversion.knockdownTransition, punishPointers,
    browserInputChronology: (punisherState.m147InputPlane ?? []).slice(-32),
    source0Samples: (punisherState.acceptance?.m121SentSamples ?? []).slice(-24),
    inputSubmissions: (punisherState.acceptance?.inputSubmissions ?? []).slice(-24),
    world: m201ServerOutput().slice(worldProofOffset),
  }));
  if (punishDowns.length !== 1 || punishUps.length !== 1 || !punishAimValid
    || !Number.isFinite(punishDown?.epochMs) || !Number.isFinite(punishUp?.epochMs)
    || punishUp.epochMs <= punishDown.epochMs
    || punishUp.epochMs - punishDown.epochMs >= 320
    || punishDown.epochMs < conversion.knockdownTransition.epochMs
    || punishDown.epochMs >= knockdownEndEpochMs) {
    throw new Error(milestone + " genuine third-party LMB missed the authoritative knockdown window: "
      + JSON.stringify({ punishPointers, knockdownTransition: conversion.knockdownTransition, knockdownEndEpochMs }));
  }

  let punisherActions = punisherState.acceptance?.ownActionTransitions ?? [];
  let punishWindup = punisherActions.find((entry) =>
    entry.action === COMBAT_ACTION.attackWindup
    && Number.isFinite(entry.epochMs)
    && entry.epochMs >= punishDown.epochMs - 40);
  let punishActive = punishWindup
    ? punisherActions.find((entry) =>
      entry.action === COMBAT_ACTION.attackActive
      && Number.isFinite(entry.epochMs)
      && entry.epochMs >= punishWindup.epochMs)
    : null;

  // The HP=66 snapshot above already proves the authoritative hit landed
  // while #2 was still in knockdown. The attacker's own action replication can
  // trail that victim snapshot by a network frame, so give it a short bounded
  // observation window instead of requiring attackActive in the same read.
  const activeObservationDeadline = Date.now() + 220;
  while ((!punishWindup || !punishActive) && Date.now() < activeObservationDeadline) {
    await sleep(8);
    const currentPunisher = await readUiEvidence(punisher);
    punisherActions = currentPunisher.acceptance?.ownActionTransitions ?? [];
    punishWindup = punisherActions.find((entry) =>
      entry.action === COMBAT_ACTION.attackWindup
      && Number.isFinite(entry.epochMs)
      && entry.epochMs >= punishDown.epochMs - 40) ?? punishWindup;
    punishActive = punishWindup
      ? punisherActions.find((entry) =>
        entry.action === COMBAT_ACTION.attackActive
        && Number.isFinite(entry.epochMs)
        && entry.epochMs >= punishWindup.epochMs)
      : null;
  }
  if (!punishWindup || !punishActive) {
    throw new Error(milestone + " did not observe the third fighter's authoritative light conversion: "
      + JSON.stringify({ punishDown, punishWindup, punishActive, punisherActions }));
  }
  const defenderTransitions = defenderState.acceptance?.ownActionTransitions ?? [];
  const defenderRecovery = defenderTransitions.find((entry) =>
    entry.action === COMBAT_ACTION.idle
    && Number.isFinite(entry.epochMs)
    && entry.epochMs > conversion.knockdownTransition.epochMs);
  // The two independent browser snapshots can attach epochMs timestamps
  // 10–20 ms apart to actions processed in the *same authoritative tick*.
  // Compare server ticks for cross-fighter ordering. A same-tick boundary is
  // valid only if the server confirms exactly one 34 HP victim hit, while the
  // attack must still precede the original knockdown's 260 ms end bound.
  const verifiedSameTickHit = defenderRecovery
    && Number.isFinite(punishActive.serverTick)
    && punishActive.serverTick === defenderRecovery.serverTick
    && defenderState.playerHp === 66
    && defenderState.events.includes("Hit taken - 34 HP.");
  const attackPrecedesRecovery = !defenderRecovery
    || (Number.isFinite(punishActive.serverTick) && Number.isFinite(defenderRecovery.serverTick)
      ? punishActive.serverTick < defenderRecovery.serverTick || verifiedSameTickHit
      : punishActive.epochMs < defenderRecovery.epochMs);
  if (punishActive.epochMs >= knockdownEndEpochMs || !attackPrecedesRecovery) {
    throw new Error(milestone + " authoritative ordering did not prove #"
      + punisherId + " became active before #" + defenderId + " recovered: "
      + JSON.stringify({
        knockdownTransition: conversion.knockdownTransition,
        knockdownEndEpochMs,
        punishWindup,
        punishActive,
        defenderRecovery,
      }));
  }
  // Keep source attribution on authoritative input/action/vitals evidence.
  // In three-player flights the generic attacker-side event can surface on a
  // spectator observer, while the victim-local 34 HP event remains stable.
  if (!defenderState.events.includes("Hit taken - 34 HP.")) {
    throw new Error(milestone + " victim feedback did not confirm the 34 HP punish on #"
      + defenderId + ": " + JSON.stringify(hitEvidence));
  }

  const clearDeadline = Date.now() + COMBAT.dodge.collisionKnockdownMs + COMBAT.attack.recoveryMs + 520;
  let finalEvidence = null;
  while (Date.now() < clearDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const currentKicker = states.find((entry) => entry.browser === roller.name);
    const currentDefender = states.find((entry) => entry.browser === defender.name);
    const currentPunisher = states.find((entry) => entry.browser === punisher.name);
    const defenderAction = currentDefender?.acceptance?.ownActionTransitions?.at(-1)?.action;
    if (currentPunisher
      && currentPunisher.focusLabel !== "KNOCKDOWN #" + defenderId
      && !currentPunisher.recoveryVisible
      && defenderAction === COMBAT_ACTION.idle
      && currentDefender?.playerHp === 66 && currentDefender?.playerGuard === 100
      && currentKicker?.playerHp === 100 && currentKicker?.playerGuard === 100
      && currentPunisher?.playerHp === 100 && currentPunisher?.playerGuard === 100) {
      finalEvidence = states;
      break;
    }
    await sleep(16);
  }
  if (!finalEvidence) {
    throw new Error(milestone + " KNOCKDOWN focus did not clear after the punished fighter recovered: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  return finalEvidence.map((entry) => ({
    ...entry,
    m156RollerId: rollerId,
    m156KnockedDownId: defenderId,
    m156PunisherId: punisherId,
    m156RollAttempt: conversion.attempt,
    m156RollEpochMs: conversion.rollTransition.epochMs,
    m156RollWheelEpochMs: conversion.rollWheel.epochMs,
    m156KnockdownEpochMs: conversion.knockdownTransition.epochMs,
    m156PunishPointerEpochMs: punishDown.epochMs,
    m156PunishActiveEpochMs: punishActive.epochMs,
  }));
}

async function runOnlineUiRollKnockdownFfaFocusFlight(entries) {
  const milestone = "M154 roll knockdown FFA focus";
  if (entries.length !== 3) {
    throw new Error(milestone + " expected three real browser clients, received " + entries.length);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const roller = entries.find((entry) => entry.name === "chrome");
  const defender = entries.find((entry) => entry.name === "firefox");
  const bystander = entries.find((entry) => entry.name === "chrome2");
  const rollerReady = ready.find((entry) => entry.browser === roller?.name);
  const defenderReady = ready.find((entry) => entry.browser === defender?.name);
  const bystanderReady = ready.find((entry) => entry.browser === bystander?.name);
  if (!roller || !defender || !bystander || !rollerReady || !defenderReady || !bystanderReady) {
    throw new Error(milestone + " could not resolve deterministic FFA roles: " + JSON.stringify(ready));
  }

  const rollerId = rollerReady.playerNetId;
  const defenderId = defenderReady.playerNetId;
  const bystanderId = bystanderReady.playerNetId;
  await waitForUiThreePlayerReady(entries, [rollerId, defenderId, bystanderId], 2500);
  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  await Promise.all(entries.map(centerArenaInViewport));

  const rollerElementId = await resolveArenaElement(roller, milestone + " roller");
  const rollRight = rollerId < defenderId;
  const movementKey = rollRight ? "d" : "a";
  const rollOffset = rollRight ? 200 : -200;
  await pulseMovementKey(roller, movementKey, 120);
  await aimArena(roller, rollerElementId, rollOffset);
  await sleep(40);

  const before = await readUiEvidence(roller);
  const wheelOffset = before.wheels.length;
  await scrollArenaWheel(roller, rollerElementId, -120, 0);

  let evidence = null;
  const deadline = Date.now() + COMBAT.dodge.durationMs + COMBAT.dodge.recoveryMs
    + COMBAT.dodge.collisionKnockdownMs + 500;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const rollerState = states.find((entry) => entry.browser === roller.name);
    const defenderState = states.find((entry) => entry.browser === defender.name);
    const bystanderState = states.find((entry) => entry.browser === bystander.name);
    const rollerActions = rollerState?.acceptance?.ownActionTransitions ?? [];
    const defenderActions = defenderState?.acceptance?.ownActionTransitions ?? [];
    const rollSeen = rollerActions.some((entry) =>
      entry.action === COMBAT_ACTION.dodge && Number.isFinite(entry.epochMs));
    const knockdownSeen = defenderActions.some((entry) =>
      entry.action === COMBAT_ACTION.knockdown && Number.isFinite(entry.epochMs));
    const focusSeen = rollerState?.focusTransitions.some((entry) =>
      entry.label === "KNOCKDOWN #" + defenderId);
    const cueSeen = rollerState?.recoveryTransitions.some((entry) =>
      entry.visible
      && entry.state === "knockdown"
      && entry.label === "PUNISH"
      && entry.detail === "Knockdown recovery");
    const vitalsClean = rollerState?.playerHp === 100 && rollerState?.playerGuard === 100
      && defenderState?.playerHp === 100 && defenderState?.playerGuard === 100
      && bystanderState?.playerHp === 100 && bystanderState?.playerGuard === 100;
    if (rollSeen && knockdownSeen && focusSeen && cueSeen && vitalsClean) {
      const rollWheels = rollerState.wheels.slice(wheelOffset).filter((event) => event.deltaY < 0);
      if (rollWheels.length !== 1 || !Number.isFinite(rollWheels[0].epochMs)) {
        throw new Error(milestone + " did not deliver exactly one genuine wheel-forward roll: "
          + JSON.stringify(rollerState.wheels.slice(wheelOffset)));
      }
      evidence = states;
      break;
    }
    if ((Number.isFinite(rollerState?.playerHp) && rollerState.playerHp < 100)
      || (Number.isFinite(defenderState?.playerHp) && defenderState.playerHp < 100)
      || (Number.isFinite(defenderState?.playerGuard) && defenderState.playerGuard < 100)
      || (Number.isFinite(bystanderState?.playerHp) && bystanderState.playerHp < 100)
      || (Number.isFinite(bystanderState?.playerGuard) && bystanderState.playerGuard < 100)) {
      throw new Error(milestone + " roll collision changed health/guard instead of pure knockdown: "
        + JSON.stringify(states));
    }
    await sleep(12);
  }

  if (!evidence) {
    throw new Error(milestone + " never produced authoritative roll knockdown focus: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  const clearDeadline = Date.now() + COMBAT.dodge.collisionKnockdownMs + 500;
  let finalEvidence = null;
  while (Date.now() < clearDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const rollerState = states.find((entry) => entry.browser === roller.name);
    const defenderState = states.find((entry) => entry.browser === defender.name);
    const bystanderState = states.find((entry) => entry.browser === bystander.name);
    const defenderAction = defenderState?.acceptance?.ownActionTransitions?.at(-1)?.action;
    if (rollerState
      && rollerState.focusLabel !== "KNOCKDOWN #" + defenderId
      && !rollerState.recoveryVisible
      && defenderAction === COMBAT_ACTION.idle
      && defenderState?.playerHp === 100 && defenderState?.playerGuard === 100
      && bystanderState?.playerHp === 100 && bystanderState?.playerGuard === 100) {
      finalEvidence = states;
      break;
    }
    await sleep(16);
  }
  if (!finalEvidence) {
    throw new Error(milestone + " knockdown focus did not clear after roll victim recovered: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  return finalEvidence.map((entry) => ({
    ...entry,
    m154RollerId: rollerId,
    m154KnockedDownId: defenderId,
    m154BystanderId: bystanderId,
  }));
}



async function runOnlineUiBoundedRollKnockdownFlight(entries) {
  const milestone = "M162 bounded roll knockdown browser";
  if (entries.length !== 3) {
    throw new Error(milestone + " expected three real browser clients, received " + entries.length);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const opener = entries.find((entry) => entry.name === "chrome");
  const defender = entries.find((entry) => entry.name === "firefox");
  const suppressor = entries.find((entry) => entry.name === "chrome2");
  const openerReady = ready.find((entry) => entry.browser === opener?.name);
  const defenderReady = ready.find((entry) => entry.browser === defender?.name);
  const suppressorReady = ready.find((entry) => entry.browser === suppressor?.name);
  if (!opener || !defender || !suppressor || !openerReady || !defenderReady || !suppressorReady) {
    throw new Error(milestone + " could not resolve deterministic FFA roles: " + JSON.stringify(ready));
  }

  const openerId = openerReady.playerNetId;
  const defenderId = defenderReady.playerNetId;
  const suppressorId = suppressorReady.playerNetId;
  await waitForUiThreePlayerReady(entries, [openerId, defenderId, suppressorId], 2500);
  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  await Promise.all(entries.map(centerArenaInViewport));

  const openerElementId = await resolveArenaElement(opener, milestone + " opener");
  const suppressorElementId = await resolveArenaElement(suppressor, milestone + " suppressor");
  const rollRight = openerId < defenderId;
  const openerMovementKey = rollRight ? "d" : "a";
  const openerOffset = rollRight ? 200 : -200;
  const suppressorHorizontalKey = suppressorId > defenderId ? "a" : "d";
  const suppressorInitialX = suppressorId > defenderId ? -120 : 120;

  const aimAtAuthoritativeTarget = async (
    entry,
    elementId,
    targetNetId,
    targetDeltaX = 0,
    targetDeltaY = 0,
  ) => {
    const offset = await execute(entry.base, entry.sessionId, `
      const a = window.__MYASO_ACCEPTANCE_STATE__;
      const own = a?.fighters?.find((fighter) => fighter.netId === a.playerNetId);
      const target = a?.fighters?.find((fighter) => fighter.netId === ${targetNetId});
      const canvas = document.querySelector('#arena');
      const rect = canvas.getBoundingClientRect();
      if (!own || !target || !canvas || rect.width <= 0 || rect.height <= 0) return null;
      return {
        x: (target.x + ${targetDeltaX} - own.x) * (rect.width / canvas.width),
        y: (target.y + ${targetDeltaY} - own.y) * (rect.height / canvas.height),
      };
    `);
    if (!offset || !Number.isFinite(offset.x) || !Number.isFinite(offset.y)) {
      throw new Error(milestone + " could not resolve authoritative target vector for #" + targetNetId);
    }
    await aimArena(entry, elementId, offset.x, offset.y);
    return offset;
  };

  // Browser spawns are 96 px apart. Move #3 down first, then horizontally
  // beside #2 so it cannot body-block the opener. Move #1 into body-spacing
  // range before the first roll so the unchanged 34 px knockback leaves #2
  // almost directly above #3. #1 keeps moving through roll recovery, clearing
  // the lane before #3's suppression roll begins.
  await pulseMovementKey(suppressor, "s", 255);
  await pulseMovementKey(suppressor, suppressorHorizontalKey, 285);
  await pulseMovementKey(opener, openerMovementKey, 280);
  await aimArena(opener, openerElementId, openerOffset);
  // Pre-aim #3 near #2's deterministic post-impact position, from a
  // lower flank. The additional 24 px Y offset keeps the real roll's lane
  // away from #1 while preserving collision proximity to the downed #2.
  // This avoids a WebDriver re-aim round trip inside the unchanged 260 ms
  // knockdown window and still requires a genuine suppression roll.
  await aimAtAuthoritativeTarget(
    suppressor,
    suppressorElementId,
    defenderId,
    rollRight ? COMBAT.dodge.collisionKnockback : -COMBAT.dodge.collisionKnockback,
    24,
  );
  await sleep(50);

  const readOwnActions = (entry) => execute(
    entry.base,
    entry.sessionId,
    "return (window.__MYASO_ACCEPTANCE_STATE__?.ownActionTransitions ?? []).map((item) => ({ ...item }));",
  );
  const readAcceptance = (entry) => execute(
    entry.base,
    entry.sessionId,
    "const a=window.__MYASO_ACCEPTANCE_STATE__; return { ownActionTransitions:(a?.ownActionTransitions ?? []).map((item)=>({...item})), focusActionTransitions:(a?.focusActionTransitions ?? []).map((item)=>({...item})) };",
  );

  const [defenderBefore, openerBefore, suppressorBefore] = await Promise.all([
    readOwnActions(defender),
    readOwnActions(opener),
    readOwnActions(suppressor),
  ]);
  const defenderOffset = defenderBefore.length;
  const openerOffsetActions = openerBefore.length;
  const suppressorOffsetActions = suppressorBefore.length;
  const openerWheelOffset = (await readUiEvidence(opener)).wheels.length;
  const suppressorWheelOffset = (await readUiEvidence(suppressor)).wheels.length;

  // Keep #1's ordinary movement held. Dodge direction is pointer-owned, so the
  // roll still travels toward #2; once dodge ends, the held movement carries
  // #1 away from the collision lane. Schedule #3's genuine wheel-forward from
  // its own browser clock 215 ms after #1's wheel edge: just beyond the
  // unchanged 170 ms opener roll, leaving time for #1's authoritative
  // dodgeRecovery to appear before #3 can collide with #1. At 185 ms,
  // #3 repeatedly knocked down #1 on its recovery tick 369 and prevented
  // the strict original-recovery proof, while the passing main trial had
  // #1 dodgeRecovery at 369 before its knockdown at 372.
  // The single genuine #3 wheel must STILL contact already-downed #2
  // before its unchanged 260 ms recovery. No gameplay timing or geometry
  // is altered, and server-tick recovery/HP/guard gates below stay strict.
  await setMovementKey(opener, openerMovementKey, true);
  await Promise.all([
    scrollArenaWheel(opener, openerElementId, -120, 0),
    scrollArenaWheel(suppressor, suppressorElementId, -120, 215),
  ]);

  let firstKnockdown = null;
  let openerDodge = null;
  const firstDeadline = Date.now() + COMBAT.dodge.durationMs + 240;
  while (Date.now() < firstDeadline && (!firstKnockdown || !openerDodge)) {
    const [defenderActions, openerActions] = await Promise.all([
      readOwnActions(defender),
      readOwnActions(opener),
    ]);
    firstKnockdown = firstKnockdown ?? defenderActions.slice(defenderOffset).find((entry) =>
      entry.action === COMBAT_ACTION.knockdown && Number.isFinite(entry.epochMs)) ?? null;
    openerDodge = openerDodge ?? openerActions.slice(openerOffsetActions).find((entry) =>
      entry.action === COMBAT_ACTION.dodge && Number.isFinite(entry.epochMs)) ?? null;
    if (!firstKnockdown || !openerDodge) await sleep(1);
  }
  if (!firstKnockdown || !openerDodge) {
    await setMovementKey(opener, openerMovementKey, false);
    throw new Error(milestone + " opener never produced the first authoritative roll knockdown: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  // Both wheel inputs have already been delivered. The remaining proof uses
  // only persisted authoritative transitions, so runner load cannot move the
  // suppression input later in the downed window.
  let openerDodgeRecovery = null;
  let suppressedDodge = null;
  let suppressorDodgeRecovery = null;
  let originalRecovery = null;
  const recoveryDeadline = Date.now() + COMBAT.dodge.collisionKnockdownMs + COMBAT.dodge.durationMs + 320;
  while (Date.now() < recoveryDeadline
    && (!openerDodgeRecovery || !suppressedDodge || !suppressorDodgeRecovery || !originalRecovery)) {
    const [defenderAcceptance, openerActions, suppressorActions] = await Promise.all([
      readAcceptance(defender),
      readOwnActions(opener),
      readOwnActions(suppressor),
    ]);
    openerDodgeRecovery = openerActions.slice(openerOffsetActions).find((entry) =>
      entry.action === COMBAT_ACTION.dodgeRecovery
      && Number.isFinite(entry.epochMs)
      && entry.epochMs > openerDodge.epochMs) ?? openerDodgeRecovery;
    suppressedDodge = suppressorActions.slice(suppressorOffsetActions).find((entry) =>
      entry.action === COMBAT_ACTION.dodge
      && Number.isFinite(entry.epochMs)
      && entry.epochMs >= firstKnockdown.epochMs) ?? suppressedDodge;
    if (suppressedDodge) {
      suppressorDodgeRecovery = suppressorActions.find((entry) =>
        entry.action === COMBAT_ACTION.dodgeRecovery
        && Number.isFinite(entry.epochMs)
        && entry.epochMs > suppressedDodge.epochMs) ?? suppressorDodgeRecovery;
    }
    originalRecovery = defenderAcceptance.ownActionTransitions.slice(defenderOffset).find((entry) =>
      entry.action === COMBAT_ACTION.idle
      && Number.isFinite(entry.epochMs)
      && entry.epochMs > firstKnockdown.epochMs) ?? originalRecovery;
    if (!openerDodgeRecovery || !suppressedDodge || !suppressorDodgeRecovery || !originalRecovery) await sleep(2);
  }

  await setMovementKey(opener, openerMovementKey, false);

  if (!openerDodgeRecovery || !suppressedDodge || !suppressorDodgeRecovery || !originalRecovery) {
    throw new Error(milestone + " did not observe suppression roll plus original recovery: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  const originalDurationObserved = originalRecovery.epochMs - firstKnockdown.epochMs;
  const recoveryAfterSuppressedDodge = originalRecovery.epochMs - suppressedDodge.epochMs;
  if (suppressedDodge.epochMs <= firstKnockdown.epochMs
    || suppressedDodge.epochMs >= originalRecovery.epochMs
    || (Number.isFinite(suppressedDodge.serverTick)
      && Number.isFinite(openerDodgeRecovery.serverTick)
      && suppressedDodge.serverTick < openerDodgeRecovery.serverTick)
    || (Number.isFinite(suppressedDodge.serverTick)
      && Number.isFinite(originalRecovery.serverTick)
      && suppressedDodge.serverTick > originalRecovery.serverTick)
    || originalDurationObserved < COMBAT.dodge.collisionKnockdownMs - 90
    || originalDurationObserved > COMBAT.dodge.collisionKnockdownMs + 110
    // R2 doubled original knockdown (520ms). It is valid for the suppressing
    // roller's 350ms dodge+recovery to finish BEFORE the downed victim rises.
    // Preserve strict original 520ms +/- bounds and genuine second-roll
    // ordering instead of retaining obsolete pre-R2 recovery ordering.
    || recoveryAfterSuppressedDodge >= COMBAT.dodge.collisionKnockdownMs - 60) {
    throw new Error(milestone + " suppression roll appears to have refreshed or re-caught the bounded knockdown: "
      + JSON.stringify({
        firstKnockdown,
        suppressedDodge,
        suppressorDodgeRecovery,
        originalRecovery,
        originalDurationObserved,
        recoveryAfterSuppressedDodge,
      }));
  }

  let states = await Promise.all(entries.map(readUiEvidence));
  const openerState = states.find((entry) => entry.browser === opener.name);
  const defenderState = states.find((entry) => entry.browser === defender.name);
  const suppressorState = states.find((entry) => entry.browser === suppressor.name);
  if (openerState?.playerHp !== 100 || openerState?.playerGuard !== 100
    || defenderState?.playerHp !== 100 || defenderState?.playerGuard !== 100
    || suppressorState?.playerHp !== 100 || suppressorState?.playerGuard !== 100) {
    throw new Error(milestone + " control-only sequence changed health/guard: " + JSON.stringify(states));
  }

  const openerWheels = openerState.wheels.slice(openerWheelOffset).filter((entry) => entry.deltaY < 0);
  const suppressorWheels = suppressorState.wheels.slice(suppressorWheelOffset).filter((entry) => entry.deltaY < 0);
  if (openerWheels.length !== 1 || suppressorWheels.length !== 1
    || !Number.isFinite(openerWheels[0].epochMs)
    || !Number.isFinite(suppressorWheels[0].epochMs)
    || suppressorWheels[0].epochMs < firstKnockdown.epochMs
    || suppressorWheels[0].epochMs >= originalRecovery.epochMs) {
    throw new Error(milestone + " lacked two genuine wheel-forward rolls in the bounded window: "
      + JSON.stringify({ openerWheels, suppressorWheels, firstKnockdown }));
  }

  // Wait until #3 is fully idle. While its original roll is finishing, #2 must
  // remain idle—M160 consumed the downed contact in rollHitTargets, so the same
  // active roll cannot re-catch #2 on the recovery frame.
  let suppressorIdle = null;
  const idleDeadline = Date.now() + COMBAT.dodge.recoveryMs + 420;
  while (Date.now() < idleDeadline && !suppressorIdle) {
    const [defenderActions, suppressorActions] = await Promise.all([
      readOwnActions(defender),
      readOwnActions(suppressor),
    ]);
    const dodgeIndex = suppressorActions.findIndex((entry) =>
      entry.action === COMBAT_ACTION.dodge
      && Number.isFinite(entry.epochMs)
      && entry.epochMs === suppressedDodge.epochMs);
    suppressorIdle = suppressorActions.find((entry, index) =>
      index > dodgeIndex
      && entry.action === COMBAT_ACTION.idle
      && Number.isFinite(entry.epochMs)) ?? null;
    const recaught = defenderActions.slice(defenderOffset).find((entry) =>
      entry.action === COMBAT_ACTION.knockdown
      && Number.isFinite(entry.epochMs)
      && entry.epochMs > originalRecovery.epochMs);
    if (recaught) {
      throw new Error(milestone + " same suppression roll re-caught #"
        + defenderId + " after original recovery: " + JSON.stringify({ recaught, originalRecovery }));
    }
    if (!suppressorIdle) await sleep(4);
  }
  if (!suppressorIdle) {
    throw new Error(milestone + " suppressor never returned idle after bounded roll");
  }

  // Move #1 vertically away from the verification lane. #3 ended above/left of
  // #2 after its first diagonal roll; a real opposite-direction wheel-forward
  // from that endpoint must knock the now-standing #2 down normally.
  await pulseMovementKey(opener, "s", 300);
  await aimAtAuthoritativeTarget(suppressor, suppressorElementId, defenderId);
  await sleep(40);

  const defenderBeforeVerify = await readOwnActions(defender);
  const verifyDefenderOffset = defenderBeforeVerify.length;
  const suppressorBeforeVerify = await readOwnActions(suppressor);
  const verifySuppressorOffset = suppressorBeforeVerify.length;
  const verifyWheelOffset = (await readUiEvidence(suppressor)).wheels.length;

  await scrollArenaWheel(suppressor, suppressorElementId, -120, 0);

  let verificationKnockdown = null;
  let verificationDodge = null;
  const verifyDeadline = Date.now() + COMBAT.dodge.durationMs + COMBAT.dodge.collisionKnockdownMs + 280;
  while (Date.now() < verifyDeadline && (!verificationKnockdown || !verificationDodge)) {
    const [defenderAcceptance, suppressorActions] = await Promise.all([
      readAcceptance(defender),
      readOwnActions(suppressor),
    ]);
    verificationKnockdown = defenderAcceptance.ownActionTransitions.slice(verifyDefenderOffset).find((entry) =>
      entry.action === COMBAT_ACTION.knockdown && Number.isFinite(entry.epochMs)) ?? verificationKnockdown;
    verificationDodge = suppressorActions.slice(verifySuppressorOffset).find((entry) =>
      entry.action === COMBAT_ACTION.dodge && Number.isFinite(entry.epochMs)) ?? verificationDodge;
    if (!verificationKnockdown || !verificationDodge) await sleep(2);
  }

  states = await Promise.all(entries.map(readUiEvidence));
  const finalOpener = states.find((entry) => entry.browser === opener.name);
  const finalDefender = states.find((entry) => entry.browser === defender.name);
  const finalSuppressor = states.find((entry) => entry.browser === suppressor.name);
  const verifyWheels = finalSuppressor?.wheels.slice(verifyWheelOffset).filter((entry) => entry.deltaY < 0) ?? [];
  if (!verificationKnockdown || !verificationDodge
    || verificationKnockdown.epochMs <= originalRecovery.epochMs
    || verifyWheels.length !== 1 || !Number.isFinite(verifyWheels[0].epochMs)
    || finalOpener?.playerHp !== 100 || finalOpener?.playerGuard !== 100
    || finalDefender?.playerHp !== 100 || finalDefender?.playerGuard !== 100
    || finalSuppressor?.playerHp !== 100 || finalSuppressor?.playerGuard !== 100) {
    throw new Error(milestone + " post-recovery roll did not create a fresh clean knockdown: "
      + JSON.stringify(states));
  }

  // This diagnostic never qualifies a failed M162 proof: read-only after
  // genuine single wheels, server knockdown/recovery, no re-catch and 100HP
  // guards. Browser-epoch wheel/action and browser-performance wheel/cue
  // durations are kept separate; no cross-browser/server clock subtraction.
  console.log("M215_SUCCESSFUL_ROLL_LATENCY " + JSON.stringify(
    summarizeM215SuccessfulRollLatency([
      {
        browser: opener.name, phase: "opening", sameBrowserClock: true,
        wheel: openerWheels[0], observedAction: openerDodge,
        eventTransitions: finalOpener.eventTransitions,
      },
      {
        browser: suppressor.name, phase: "suppression", sameBrowserClock: true,
        wheel: suppressorWheels[0], observedAction: suppressedDodge,
        eventTransitions: finalSuppressor.eventTransitions,
        nextWheelT: verifyWheels[0].t,
      },
      {
        browser: suppressor.name, phase: "verification", sameBrowserClock: true,
        wheel: verifyWheels[0], observedAction: verificationDodge,
        eventTransitions: finalSuppressor.eventTransitions,
      },
    ]),
  ));

  return states.map((entry) => ({
    ...entry,
    m162OpenerId: openerId,
    m162DefenderId: defenderId,
    m162SuppressorId: suppressorId,
    m162FirstKnockdownEpochMs: firstKnockdown.epochMs,
    m162SuppressedDodgeEpochMs: suppressedDodge.epochMs,
    m162OriginalRecoveryEpochMs: originalRecovery.epochMs,
    m162SuppressorDodgeRecoveryEpochMs: suppressorDodgeRecovery.epochMs,
    m162OriginalDurationObservedMs: originalDurationObserved,
    m162VerificationKnockdownEpochMs: verificationKnockdown.epochMs,
  }));
}

async function runOnlineUiBoundedKickKnockdownFlight(entries) {
  const milestone = "M161 bounded kick knockdown browser";
  if (entries.length !== 3) {
    throw new Error(milestone + " expected three real browser clients, received " + entries.length);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const opener = entries.find((entry) => entry.name === "chrome");
  const defender = entries.find((entry) => entry.name === "firefox");
  const suppressor = entries.find((entry) => entry.name === "chrome2");
  const openerReady = ready.find((entry) => entry.browser === opener?.name);
  const defenderReady = ready.find((entry) => entry.browser === defender?.name);
  const suppressorReady = ready.find((entry) => entry.browser === suppressor?.name);
  if (!opener || !defender || !suppressor || !openerReady || !defenderReady || !suppressorReady) {
    throw new Error(milestone + " could not resolve deterministic FFA roles: " + JSON.stringify(ready));
  }

  const openerId = openerReady.playerNetId;
  const defenderId = defenderReady.playerNetId;
  const suppressorId = suppressorReady.playerNetId;
  await waitForUiThreePlayerReady(entries, [openerId, defenderId, suppressorId], 2500);
  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  await Promise.all(entries.map(centerArenaInViewport));

  const openerElementId = await resolveArenaElement(opener, milestone + " opener");
  const suppressorElementId = await resolveArenaElement(suppressor, milestone + " suppressor");
  const attackRight = openerId < defenderId;
  const openerMovementKey = attackRight ? "d" : "a";
  const openerOffset = attackRight ? 200 : -200;
  const suppressorOffset = suppressorId > defenderId ? -200 : 200;

  // Reuse the proven M153 opener geometry. The unchanged 52-unit kick
  // knockback naturally moves #2 toward idle #3, so #3 needs no extra
  // movement to test a second kick against the active knockdown.
  await pulseMovementKey(opener, openerMovementKey, 180);
  await Promise.all([
    aimArena(opener, openerElementId, openerOffset),
    aimArena(suppressor, suppressorElementId, suppressorOffset),
  ]);
  await sleep(50);

  const readOwnActions = (entry) => execute(
    entry.base,
    entry.sessionId,
    "return (window.__MYASO_ACCEPTANCE_STATE__?.ownActionTransitions ?? []).map((item) => ({ ...item }));",
  );
  const readAcceptance = (entry) => execute(
    entry.base,
    entry.sessionId,
    "const a=window.__MYASO_ACCEPTANCE_STATE__; return { focusNetId:a?.focusNetId ?? 0, ownActionTransitions:(a?.ownActionTransitions ?? []).map((item)=>({...item})), focusActionTransitions:(a?.focusActionTransitions ?? []).map((item)=>({...item})) };",
  );

  const [defenderBefore, openerBefore, suppressorBefore] = await Promise.all([
    readOwnActions(defender),
    readOwnActions(opener),
    readOwnActions(suppressor),
  ]);
  const defenderOffset = defenderBefore.length;
  const openerOffsetActions = openerBefore.length;
  const suppressorOffsetActions = suppressorBefore.length;
  const suppressorPointerOffset = (await readUiEvidence(suppressor)).pointers.length;

  await performArenaRecoveryBufferedKick(opener, openerElementId, openerOffset, 45);

  let firstKnockdown = null;
  let openerKickActive = null;
  const firstDeadline = Date.now() + COMBAT.kick.windupMs + COMBAT.kick.activeMs + 320;
  while (Date.now() < firstDeadline && (!firstKnockdown || !openerKickActive)) {
    const [defenderActions, openerActions] = await Promise.all([
      readOwnActions(defender),
      readOwnActions(opener),
    ]);
    firstKnockdown = defenderActions.slice(defenderOffset).find((entry) =>
      entry.action === COMBAT_ACTION.knockdown && Number.isFinite(entry.epochMs)) ?? null;
    openerKickActive = openerActions.slice(openerOffsetActions).find((entry) =>
      entry.action === COMBAT_ACTION.kickActive && Number.isFinite(entry.epochMs)) ?? openerKickActive;
    if (!firstKnockdown) await sleep(2);
  }
  if (!firstKnockdown || !openerKickActive) {
    throw new Error(milestone + " opener never produced the first authoritative kick knockdown: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  // Emit one genuine short RMB from #3 while #2 is already down. M160 must
  // consume this control contact without resetting #2's original 360 ms timer.
  await performArenaRecoveryBufferedKick(suppressor, suppressorElementId, suppressorOffset, 45);

  let suppressedKickActive = null;
  let originalRecovery = null;
  const recoveryDeadline = Date.now() + COMBAT.kick.knockdownMs + 260;
  while (Date.now() < recoveryDeadline && (!suppressedKickActive || !originalRecovery)) {
    const [defenderAcceptance, suppressorActions] = await Promise.all([
      readAcceptance(defender),
      readOwnActions(suppressor),
    ]);
    // The short kick-active phase can fall between #3's own sampled snapshots.
    // #2's focus stream is victim-local authoritative evidence and reliably
    // captures #3's active phase while #2 remains knocked down.
    const victimObservedKickActive = defenderAcceptance.focusActionTransitions.find((entry) =>
      entry.action === COMBAT_ACTION.kickActive
      && Number.isFinite(entry.epochMs)
      && entry.epochMs >= firstKnockdown.epochMs);
    suppressedKickActive = suppressorActions.slice(suppressorOffsetActions).find((entry) =>
      entry.action === COMBAT_ACTION.kickActive
      && Number.isFinite(entry.epochMs)
      && entry.epochMs >= firstKnockdown.epochMs)
      ?? victimObservedKickActive
      ?? suppressedKickActive;
    originalRecovery = defenderAcceptance.ownActionTransitions.slice(defenderOffset).find((entry) =>
      entry.action === COMBAT_ACTION.idle
      && Number.isFinite(entry.epochMs)
      && entry.epochMs > firstKnockdown.epochMs) ?? originalRecovery;
    if (!suppressedKickActive || !originalRecovery) await sleep(3);
  }

  if (!suppressedKickActive || !originalRecovery) {
    throw new Error(milestone + " did not observe suppressed kick plus original recovery: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  const originalDurationObserved = originalRecovery.epochMs - firstKnockdown.epochMs;
  const recoveryAfterSuppressedActive = originalRecovery.epochMs - suppressedKickActive.epochMs;
  if (suppressedKickActive.epochMs <= firstKnockdown.epochMs
    || suppressedKickActive.epochMs >= firstKnockdown.epochMs + COMBAT.kick.knockdownMs
    || originalDurationObserved < COMBAT.kick.knockdownMs - 100
    || originalDurationObserved > COMBAT.kick.knockdownMs + 120
    || recoveryAfterSuppressedActive >= COMBAT.kick.knockdownMs - 60) {
    throw new Error(milestone + " second kick appears to have refreshed the bounded knockdown: "
      + JSON.stringify({
        firstKnockdown,
        suppressedKickActive,
        originalRecovery,
        originalDurationObserved,
        recoveryAfterSuppressedActive,
      }));
  }

  let states = await Promise.all(entries.map(readUiEvidence));
  const openerState = states.find((entry) => entry.browser === opener.name);
  const defenderState = states.find((entry) => entry.browser === defender.name);
  const suppressorState = states.find((entry) => entry.browser === suppressor.name);
  if (openerState?.playerHp !== 100 || openerState?.playerGuard !== 100
    || defenderState?.playerHp !== 100 || defenderState?.playerGuard !== 100
    || suppressorState?.playerHp !== 100 || suppressorState?.playerGuard !== 100) {
    throw new Error(milestone + " control-only sequence changed health/guard: " + JSON.stringify(states));
  }

  const suppressedPointers = suppressorState.pointers.slice(suppressorPointerOffset);
  const suppressedDown = suppressedPointers.find((entry) => entry.type === "pointerdown" && entry.button === 2);
  const suppressedUp = suppressedPointers.find((entry) => entry.type === "pointerup" && entry.button === 2);
  if (!suppressedDown || !suppressedUp
    || !Number.isFinite(suppressedDown.epochMs) || !Number.isFinite(suppressedUp.epochMs)
    || suppressedUp.epochMs <= suppressedDown.epochMs
    || suppressedUp.epochMs - suppressedDown.epochMs >= 180) {
    throw new Error(milestone + " did not deliver a genuine short RMB suppression kick: "
      + JSON.stringify(suppressedPointers));
  }

  // Wait for #3's first kick recovery to finish, then repeat the exact same
  // short RMB from the same position. Once #2 is standing, this must create a
  // new knockdown, proving the suppressed attempt used real hittable geometry.
  let suppressorIdle = null;
  const idleDeadline = Date.now() + COMBAT.kick.recoveryMs + 500;
  while (Date.now() < idleDeadline && !suppressorIdle) {
    const actions = await readOwnActions(suppressor);
    // A short #3 KickActive can fall between #3's sampled own frames.
    // activeIndex=-1 used to admit the INITIAL Idle (before suppression)
    // and send the verification RMB during the first kick's recovery.
    // Match the same authoritative World tick across actor replicas,
    // never unrelated browser-local epoch clocks or stale Idle snapshots.
    const suppressedTick = suppressedKickActive.serverTick;
    if (!Number.isSafeInteger(suppressedTick) || suppressedTick < 1) {
      throw new Error(milestone + " suppressed kick lacks original World tick");
    }
    suppressorIdle = actions.find((entry) =>
      entry.action === COMBAT_ACTION.idle
      && Number.isSafeInteger(entry.serverTick)
      && entry.serverTick > suppressedTick
      && Number.isFinite(entry.epochMs)) ?? null;
    if (!suppressorIdle) await sleep(5);
  }
  if (!suppressorIdle) {
    throw new Error(milestone + " suppressor never returned idle before verification kick");
  }

  const defenderActionsBeforeVerify = await readOwnActions(defender);
  const verifyDefenderOffset = defenderActionsBeforeVerify.length;
  const suppressorActionsBeforeVerify = await readOwnActions(suppressor);
  const verifySuppressorOffset = suppressorActionsBeforeVerify.length;
  const verifyPointerOffset = (await readUiEvidence(suppressor)).pointers.length;

  await performArenaRecoveryBufferedKick(suppressor, suppressorElementId, suppressorOffset, 45);

  let verificationKnockdown = null;
  let verificationKickActive = null;
  const verifyDeadline = Date.now() + COMBAT.kick.windupMs + COMBAT.kick.activeMs + 360;
  while (Date.now() < verifyDeadline && (!verificationKnockdown || !verificationKickActive)) {
    const [defenderAcceptance, suppressorActions] = await Promise.all([
      readAcceptance(defender),
      readOwnActions(suppressor),
    ]);
    verificationKnockdown = defenderAcceptance.ownActionTransitions.slice(verifyDefenderOffset).find((entry) =>
      entry.action === COMBAT_ACTION.knockdown && Number.isFinite(entry.epochMs)) ?? verificationKnockdown;
    const victimObservedVerifyActive = defenderAcceptance.focusActionTransitions.find((entry) =>
      entry.action === COMBAT_ACTION.kickActive
      && Number.isFinite(entry.epochMs)
      && entry.epochMs > originalRecovery.epochMs);
    verificationKickActive = suppressorActions.slice(verifySuppressorOffset).find((entry) =>
      entry.action === COMBAT_ACTION.kickActive && Number.isFinite(entry.epochMs))
      ?? victimObservedVerifyActive
      ?? verificationKickActive;
    if (!verificationKnockdown || !verificationKickActive) await sleep(3);
  }

  states = await Promise.all(entries.map(readUiEvidence));
  const finalOpener = states.find((entry) => entry.browser === opener.name);
  const finalDefender = states.find((entry) => entry.browser === defender.name);
  const finalSuppressor = states.find((entry) => entry.browser === suppressor.name);
  if (!verificationKnockdown || !verificationKickActive
    || verificationKnockdown.epochMs <= originalRecovery.epochMs
    || finalOpener?.playerHp !== 100 || finalOpener?.playerGuard !== 100
    || finalDefender?.playerHp !== 100 || finalDefender?.playerGuard !== 100
    || finalSuppressor?.playerHp !== 100 || finalSuppressor?.playerGuard !== 100) {
    throw new Error(milestone + " identical post-recovery kick did not create a fresh clean knockdown: "
      + JSON.stringify(states));
  }

  const verifyPointers = finalSuppressor.pointers.slice(verifyPointerOffset);
  const verifyDown = verifyPointers.find((entry) => entry.type === "pointerdown" && entry.button === 2);
  const verifyUp = verifyPointers.find((entry) => entry.type === "pointerup" && entry.button === 2);
  if (!verifyDown || !verifyUp
    || !Number.isFinite(verifyDown.epochMs) || !Number.isFinite(verifyUp.epochMs)
    || verifyUp.epochMs <= verifyDown.epochMs
    || verifyUp.epochMs - verifyDown.epochMs >= 180) {
    throw new Error(milestone + " verification kick lacked genuine short RMB provenance: "
      + JSON.stringify(verifyPointers));
  }

  return states.map((entry) => ({
    ...entry,
    m161OpenerId: openerId,
    m161DefenderId: defenderId,
    m161SuppressorId: suppressorId,
    m161FirstKnockdownEpochMs: firstKnockdown.epochMs,
    m161SuppressedKickActiveEpochMs: suppressedKickActive.epochMs,
    m161OriginalRecoveryEpochMs: originalRecovery.epochMs,
    m161OriginalDurationObservedMs: originalDurationObserved,
    m161VerificationKnockdownEpochMs: verificationKnockdown.epochMs,
  }));
}

async function runOnlineUiKickKnockdownFfaFocusFlight(entries) {
  const milestone = "M153 kick knockdown FFA focus";
  if (entries.length !== 3) {
    throw new Error(milestone + " expected three real browser clients, received " + entries.length);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const attacker = entries.find((entry) => entry.name === "chrome");
  const defender = entries.find((entry) => entry.name === "firefox");
  const bystander = entries.find((entry) => entry.name === "chrome2");
  const attackerReady = ready.find((entry) => entry.browser === attacker?.name);
  const defenderReady = ready.find((entry) => entry.browser === defender?.name);
  const bystanderReady = ready.find((entry) => entry.browser === bystander?.name);
  if (!attacker || !defender || !bystander || !attackerReady || !defenderReady || !bystanderReady) {
    throw new Error(milestone + " could not resolve deterministic FFA roles: " + JSON.stringify(ready));
  }

  const attackerId = attackerReady.playerNetId;
  const defenderId = defenderReady.playerNetId;
  const bystanderId = bystanderReady.playerNetId;
  await waitForUiThreePlayerReady(entries, [attackerId, defenderId, bystanderId], 2500);
  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  await Promise.all(entries.map(centerArenaInViewport));

  const attackerElementId = await resolveArenaElement(attacker, milestone + " attacker");
  const attackRight = attackerId < defenderId;
  const movementKey = attackRight ? "d" : "a";
  const attackOffset = attackRight ? 200 : -200;
  await pulseMovementKey(attacker, movementKey, 180);
  await aimArena(attacker, attackerElementId, attackOffset);
  await sleep(60);

  let evidence = null;
  let successfulAttempt = 0;
  let successfulPointerOffset = null;
  for (let attempt = 1; attempt <= 3 && !evidence; attempt += 1) {
    const before = await readUiEvidence(attacker);
    const pointerOffset = before.pointers.length;
    await performArenaRecoveryBufferedKick(attacker, attackerElementId, attackOffset, 45);

    const deadline = Date.now() + COMBAT.kick.knockdownMs + 360;
    while (Date.now() < deadline) {
      const states = await Promise.all(entries.map(readUiEvidence));
      const attackerState = states.find((entry) => entry.browser === attacker.name);
      const defenderState = states.find((entry) => entry.browser === defender.name);
      const bystanderState = states.find((entry) => entry.browser === bystander.name);
      const attackerActions = attackerState?.acceptance?.ownActionTransitions ?? [];
      const defenderActions = defenderState?.acceptance?.ownActionTransitions ?? [];
      const knockdownSeen = defenderActions.some((entry) =>
        entry.action === COMBAT_ACTION.knockdown && Number.isFinite(entry.epochMs));
      const kickWindupSeen = attackerActions.some((entry) =>
        entry.action === COMBAT_ACTION.kickWindup && Number.isFinite(entry.epochMs));
      const kickActiveSeen = attackerActions.some((entry) =>
        entry.action === COMBAT_ACTION.kickActive && Number.isFinite(entry.epochMs));
      const kickRecoverySeen = attackerActions.some((entry) =>
        entry.action === COMBAT_ACTION.kickRecovery && Number.isFinite(entry.epochMs));
      const kickProvenanceSeen = kickWindupSeen && kickActiveSeen && kickRecoverySeen;
      const focusSeen = attackerState?.focusTransitions.some((entry) =>
        entry.label === "KNOCKDOWN #" + defenderId);
      const cueSeen = attackerState?.recoveryTransitions.some((entry) =>
        entry.visible
        && entry.state === "knockdown"
        && entry.label === "PUNISH"
        && entry.detail === "Knockdown recovery");
      const vitalsClean = attackerState?.playerHp === 100 && attackerState?.playerGuard === 100
        && defenderState?.playerHp === 100 && defenderState?.playerGuard === 100
        && bystanderState?.playerHp === 100 && bystanderState?.playerGuard === 100;
      if (knockdownSeen && kickProvenanceSeen && focusSeen && cueSeen && vitalsClean) {
        const kickPointers = attackerState.pointers.slice(pointerOffset);
        const rightDown = kickPointers.find((entry) => entry.type === "pointerdown" && entry.button === 2);
        const rightUp = kickPointers.find((entry) => entry.type === "pointerup" && entry.button === 2);
        if (!rightDown || !rightUp || !Number.isFinite(rightDown.epochMs) || !Number.isFinite(rightUp.epochMs)
          || rightUp.epochMs <= rightDown.epochMs || rightUp.epochMs - rightDown.epochMs >= 180) {
          throw new Error(milestone + " did not deliver one genuine short RMB kick: " + JSON.stringify(kickPointers));
        }
        evidence = states;
        successfulAttempt = attempt;
        successfulPointerOffset = pointerOffset;
        break;
      }
      if ((Number.isFinite(attackerState?.playerHp) && attackerState.playerHp < 100)
        || (Number.isFinite(defenderState?.playerHp) && defenderState.playerHp < 100)
        || (Number.isFinite(defenderState?.playerGuard) && defenderState.playerGuard < 100)
        || (Number.isFinite(bystanderState?.playerHp) && bystanderState.playerHp < 100)
        || (Number.isFinite(bystanderState?.playerGuard) && bystanderState.playerGuard < 100)) {
        throw new Error(milestone + " kick exchange changed health/guard instead of pure knockdown: " + JSON.stringify(states));
      }
      await sleep(12);
    }

    if (!evidence && attempt < 3) {
      await sleep(COMBAT.kick.recoveryMs + 100);
      await pulseMovementKey(attacker, movementKey, 70);
      await aimArena(attacker, attackerElementId, attackOffset);
      await sleep(50);
    }
  }

  if (!evidence) {
    throw new Error(milestone + " never produced authoritative kick knockdown focus: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  const clearDeadline = Date.now() + COMBAT.kick.knockdownMs + 500;
  let finalEvidence = null;
  while (Date.now() < clearDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerState = states.find((entry) => entry.browser === attacker.name);
    const defenderState = states.find((entry) => entry.browser === defender.name);
    const bystanderState = states.find((entry) => entry.browser === bystander.name);
    const defenderAction = defenderState?.acceptance?.ownActionTransitions?.at(-1)?.action;
    if (attackerState
      && attackerState.focusLabel !== "KNOCKDOWN #" + defenderId
      && !attackerState.recoveryVisible
      && defenderAction === COMBAT_ACTION.idle
      && defenderState?.playerHp === 100 && defenderState?.playerGuard === 100
      && bystanderState?.playerHp === 100 && bystanderState?.playerGuard === 100) {
      finalEvidence = states;
      break;
    }
    await sleep(16);
  }
  if (!finalEvidence) {
    throw new Error(milestone + " knockdown focus did not clear after control returned: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  // M217 is diagnostic only. Original M153 genuine 3-player kick,
  // no-damage knockdown, focus cue and full recovery must already pass.
  const finalAttacker = finalEvidence.find((entry) => entry.browser === attacker.name);
  console.log("M217_SUCCESSFUL_KICK_FEEDBACK_LATENCY " + JSON.stringify(
    summarizeM217SuccessfulKickLatency({
      sameBrowserClock: true,
      pointers: finalAttacker?.pointers,
      successfulPointerOffset,
      actionTransitions: finalAttacker?.acceptance?.ownActionTransitions,
      focusTransitions: finalAttacker?.focusTransitions,
      kickWindupAction: COMBAT_ACTION.kickWindup,
      victimId: defenderId,
    }),
  ));

  return finalEvidence.map((entry) => ({
    ...entry,
    m153AttackerId: attackerId,
    m153KnockedDownId: defenderId,
    m153BystanderId: bystanderId,
    m153KickAttempt: successfulAttempt,
  }));
}

async function runOnlineUiKickBufferFlight(entries) {
  const staged = await prepareHeavyCounterplayFlight(
    entries,
    "M133 recovery kick buffer",
    { attackerName: "chrome", defenderName: "firefox", movementMs: 150 },
  );
  const { attacker, defender, attackerElementId, movementCode } = staged;
  const attackOffset = movementCode === "KeyD" ? 200 : -200;
  const beforeAttacker = await readUiEvidence(attacker);
  const pointerOffset = beforeAttacker.pointers.length;

  // Commit one genuine light first. The acceptance hook is fed only from
  // authoritative snapshots; local prediction is not acceptance evidence.
  await performArenaAttack(attacker, attackerElementId, attackOffset);

  const recoveryDeadline = Date.now() + 900;
  let recoveryStart = null;
  while (Date.now() < recoveryDeadline) {
    const current = await readUiEvidence(attacker);
    const transitions = current.acceptance?.ownActionTransitions ?? [];
    recoveryStart = transitions.find((entry) =>
      entry.action === COMBAT_ACTION.attackRecovery && Number.isFinite(entry.epochMs)) ?? null;
    if (recoveryStart) break;
    await sleep(10);
  }
  if (!recoveryStart) {
    throw new Error("M133 Chrome never observed its authoritative light recovery before RMB tap");
  }

  // The kick request is emitted on short RMB release. Start the real gesture
  // late enough that pointerup lands inside the final recovery window while
  // leaving margin for hosted WebDriver scheduling.
  const targetOffsetMs = Math.max(
    0,
    COMBAT.attack.recoveryMs - COMBAT.inputBuffer.kickWindowMs - 35,
  );
  const waitMs = Math.max(0, recoveryStart.epochMs + targetOffsetMs - Date.now());
  if (waitMs > 0) await sleep(waitMs);
  await performArenaRecoveryBufferedKick(attacker, attackerElementId, attackOffset, 45);

  // Hosted Firefox can briefly stall UI observation under software rendering
  // even after the authoritative kick phases have replicated. Keep the full
  // attack-recovery -> kick -> kick-recovery -> idle requirement, but poll
  // until both browsers have actually observed the terminal idle instead of
  // assuming a single fixed post-input sleep is enough.
  const hasCompletedKickSequence = (transitions = []) => {
    const recoveryIndex = transitions.findIndex((entry) =>
      entry.action === COMBAT_ACTION.attackRecovery && Number.isFinite(entry.epochMs));
    const kickIndex = transitions.findIndex((entry, index) =>
      index > recoveryIndex && entry.action === COMBAT_ACTION.kickWindup && Number.isFinite(entry.epochMs));
    const kickRecoveryIndex = transitions.findIndex((entry, index) =>
      index > kickIndex && entry.action === COMBAT_ACTION.kickRecovery && Number.isFinite(entry.epochMs));
    const idleIndex = transitions.findIndex((entry, index) =>
      index > kickRecoveryIndex && entry.action === COMBAT_ACTION.idle && Number.isFinite(entry.epochMs));
    return recoveryIndex >= 0 && kickIndex > recoveryIndex
      && kickRecoveryIndex > kickIndex && idleIndex > kickRecoveryIndex;
  };

  const observationDeadline = Date.now() + 1600;
  let evidence = null;
  while (Date.now() < observationDeadline) {
    evidence = await Promise.all(entries.map(readUiEvidence));
    const attackerProbe = evidence.find((entry) => entry.browser === attacker.name);
    const defenderProbe = evidence.find((entry) => entry.browser === defender.name);
    if (hasCompletedKickSequence(attackerProbe?.acceptance?.ownActionTransitions)
      && hasCompletedKickSequence(defenderProbe?.acceptance?.focusActionTransitions)) {
      break;
    }
    await sleep(40);
  }

  const attackerResult = evidence?.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence?.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) {
    throw new Error(`M133 incomplete kick-buffer evidence: ${JSON.stringify(evidence)}`);
  }
  if (attackerResult.acceptance?.scenario !== "uikickbuffer"
    || defenderResult.acceptance?.scenario !== "uikickbuffer") {
    throw new Error(`M133 authoritative acceptance hook was not active: ${JSON.stringify(evidence)}`);
  }

  const pointers = attackerResult.pointers.slice(pointerOffset);
  const rightDowns = pointers.filter((entry) => entry.type === "pointerdown" && entry.button === 2);
  const rightUps = pointers.filter((entry) => entry.type === "pointerup" && entry.button === 2);
  const rightDown = rightDowns[0];
  const rightUp = rightUps[0];
  if (rightDowns.length !== 1 || rightUps.length !== 1
    || !Number.isFinite(rightDown?.epochMs) || !Number.isFinite(rightUp?.epochMs)
    || rightUp.epochMs <= rightDown.epochMs) {
    throw new Error(`M133 genuine short RMB controls were not delivered exactly once: ${JSON.stringify(pointers)}`);
  }
  const tapHoldMs = rightUp.epochMs - rightDown.epochMs;
  if (tapHoldMs >= 180) {
    throw new Error(`M133 RMB gesture crossed the hold-to-run threshold: ${JSON.stringify({ rightDown, rightUp, tapHoldMs })}`);
  }

  const ownTransitions = attackerResult.acceptance.ownActionTransitions;
  const ownRecoveryIndex = ownTransitions.findIndex((entry) =>
    entry.action === COMBAT_ACTION.attackRecovery && Number.isFinite(entry.epochMs));
  const ownKickIndex = ownTransitions.findIndex((entry, index) =>
    index > ownRecoveryIndex && entry.action === COMBAT_ACTION.kickWindup && Number.isFinite(entry.epochMs));
  const ownKickRecoveryIndex = ownTransitions.findIndex((entry, index) =>
    index > ownKickIndex && entry.action === COMBAT_ACTION.kickRecovery && Number.isFinite(entry.epochMs));
  const ownIdleIndex = ownTransitions.findIndex((entry, index) =>
    index > ownKickRecoveryIndex && entry.action === COMBAT_ACTION.idle && Number.isFinite(entry.epochMs));
  if (ownRecoveryIndex < 0 || ownKickIndex <= ownRecoveryIndex
    || ownKickRecoveryIndex <= ownKickIndex || ownIdleIndex <= ownKickRecoveryIndex) {
    throw new Error(`M133 authority did not show attack-recovery -> kick -> kick-recovery -> idle: ${JSON.stringify(ownTransitions)}`);
  }
  const ownRecovery = ownTransitions[ownRecoveryIndex];
  const ownKick = ownTransitions[ownKickIndex];
  const ownKickCount = ownTransitions.slice(ownRecoveryIndex + 1)
    .filter((entry) => entry.action === COMBAT_ACTION.kickWindup).length;
  if (ownKickCount !== 1) {
    throw new Error(`M133 short RMB produced repeated authoritative kick: ${JSON.stringify(ownTransitions)}`);
  }
  if (ownTransitions.slice(ownRecoveryIndex + 1)
    .some((entry) => entry.action === COMBAT_ACTION.runningAttackWindup)) {
    throw new Error(`M133 short RMB accidentally entered running attack semantics: ${JSON.stringify(ownTransitions)}`);
  }

  const observedRecoveryBeforeTapMs = rightUp.epochMs - ownRecovery.epochMs;
  const observedTapToKickMs = ownKick.epochMs - rightUp.epochMs;
  const lateRecoveryFloorMs = Math.max(
    0,
    COMBAT.attack.recoveryMs - COMBAT.inputBuffer.kickWindowMs - 65,
  );
  if (observedRecoveryBeforeTapMs < lateRecoveryFloorMs
    || observedTapToKickMs <= 0
    || observedTapToKickMs > COMBAT.inputBuffer.kickWindowMs + 140) {
    throw new Error(`M133 RMB release was not a late recovery input before authoritative kick: ${JSON.stringify({
      ownRecovery,
      rightUp,
      ownKick,
      observedRecoveryBeforeTapMs,
      observedTapToKickMs,
    })}`);
  }

  const focusTransitions = defenderResult.acceptance.focusActionTransitions;
  const focusRecoveryIndex = focusTransitions.findIndex((entry) =>
    entry.action === COMBAT_ACTION.attackRecovery && Number.isFinite(entry.epochMs));
  const focusKickIndex = focusTransitions.findIndex((entry, index) =>
    index > focusRecoveryIndex && entry.action === COMBAT_ACTION.kickWindup && Number.isFinite(entry.epochMs));
  const focusKickRecoveryIndex = focusTransitions.findIndex((entry, index) =>
    index > focusKickIndex && entry.action === COMBAT_ACTION.kickRecovery && Number.isFinite(entry.epochMs));
  const focusIdleIndex = focusTransitions.findIndex((entry, index) =>
    index > focusKickRecoveryIndex && entry.action === COMBAT_ACTION.idle && Number.isFinite(entry.epochMs));
  if (focusRecoveryIndex < 0 || focusKickIndex <= focusRecoveryIndex
    || focusKickRecoveryIndex <= focusKickIndex || focusIdleIndex <= focusKickRecoveryIndex) {
    throw new Error(`M133 Firefox did not replicate attack-recovery -> kick -> kick-recovery -> idle for Chrome: ${JSON.stringify(focusTransitions)}`);
  }
  const focusKickCount = focusTransitions.slice(focusRecoveryIndex + 1)
    .filter((entry) => entry.action === COMBAT_ACTION.kickWindup).length;
  if (focusKickCount !== 1) {
    throw new Error(`M133 Firefox observed repeated kick from one short RMB tap: ${JSON.stringify(focusTransitions)}`);
  }

  if (attackerResult.playerHp !== 100 || attackerResult.playerGuard !== 100
    || attackerResult.opponentHp !== 66
    || defenderResult.playerHp !== 66 || defenderResult.playerGuard !== 100) {
    throw new Error(`M133 buffered kick changed the one-hit authoritative exchange: ${JSON.stringify(evidence)}`);
  }
  if (attackerResult.feedbackTransitions.includes("parried")
    || defenderResult.feedbackTransitions.includes("parry-success")) {
    throw new Error(`M133 kick-buffer flight accidentally resolved as parry: ${JSON.stringify(evidence)}`);
  }

  return evidence.map((entry) => ({
    ...entry,
    kickBufferPointerDownEpochMs: entry.browser === attacker.name ? rightDown.epochMs : null,
    kickBufferPointerUpEpochMs: entry.browser === attacker.name ? rightUp.epochMs : null,
    kickBufferRecoveryEpochMs: entry.browser === attacker.name ? ownRecovery.epochMs : null,
    kickBufferKickEpochMs: entry.browser === attacker.name ? ownKick.epochMs : null,
  }));
}

async function runOnlineUiRunningAttackFlight(entries) {
  const staged = await prepareHeavyCounterplayFlight(
    entries,
    "M119 running strike",
    { attackerName: "chrome", defenderName: "firefox", movementMs: 0 },
  );
  const { attacker, defender, attackerElementId, movementCode } = staged;
  const movementKey = movementCode === "KeyD" ? "d" : "a";
  const attackOffset = movementCode === "KeyD" ? 200 : -200;

  let evidence = null;
  let lastObserved = null;
  let successfulPointerOffset = 0;
  let successfulKeyOffset = 0;
  for (let attempt = 1; attempt <= 3 && !evidence; attempt += 1) {
    const beforeAttempt = await readUiEvidence(attacker);
    const attemptPointerOffset = beforeAttempt.pointers.length;
    const attemptKeyOffset = beforeAttempt.keys.length;
    await performArenaRunningAttack(attacker, attackerElementId, movementKey, attackOffset);

    const deadline = Date.now() + 1200;
    while (Date.now() < deadline) {
      const current = await Promise.all(entries.map(readUiEvidence));
      const attackerResult = current.find((entry) => entry.browser === attacker.name);
      const defenderResult = current.find((entry) => entry.browser === defender.name);
      const hit = attackerResult?.events.includes("Opponent hit - 30 HP.")
        && defenderResult?.events.includes("Hit taken - 30 HP.")
        && attackerResult?.opponentHp === 70
        && defenderResult?.playerHp === 70;
      const recovery = defenderResult?.recoveryTransitions.some((entry) =>
        entry.visible
        && entry.state === "running-attack-recovery"
        && entry.label === "PUNISH"
        && entry.detail === "Running recovery");
      if (hit && recovery) {
        successfulPointerOffset = attemptPointerOffset;
        successfulKeyOffset = attemptKeyOffset;
        evidence = current;
        break;
      }
      await sleep(20);
    }
    if (evidence) break;

    lastObserved = await Promise.all(entries.map(readUiEvidence));
    const attemptAttacker = lastObserved.find((entry) => entry.browser === attacker.name);
    const attemptDefender = lastObserved.find((entry) => entry.browser === defender.name);
    if (!attemptAttacker || !attemptDefender) {
      throw new Error(`M119 running strike incomplete latch evidence on attempt ${attempt}: ${JSON.stringify(lastObserved)}`);
    }
    const attemptPointers = attemptAttacker.pointers.slice(attemptPointerOffset);
    const attemptKeys = attemptAttacker.keys.slice(attemptKeyOffset);
    const attemptRightDown = attemptPointers.find((event) => event.type === "pointerdown" && event.button === 2);
    const attemptRightUp = attemptPointers.find((event) => event.type === "pointerup" && event.button === 2);
    const attemptLightDown = attemptPointers.find((event) => event.type === "pointerdown" && event.button === 0);
    const attemptLightUp = attemptPointers.find((event) => event.type === "pointerup" && event.button === 0);
    const completeGesture = Boolean(attemptRightDown && attemptRightUp && attemptLightDown && attemptLightUp)
      && attemptKeys.includes(`keydown:${movementCode}`)
      && attemptKeys.includes(`keyup:${movementCode}`)
      && attemptLightDown.t - attemptRightDown.t >= 180
      && attemptLightUp.t > attemptLightDown.t
      && attemptRightUp.t > attemptLightUp.t;
    if (!completeGesture) {
      throw new Error(`M119 retry attempt ${attempt} lacked a complete real running gesture: ${JSON.stringify(attemptAttacker)}`);
    }
    const runningCommitted = attemptAttacker.events.some((text) =>
      text.startsWith("Running strike committed") || text.startsWith("Running strike active")
        || text.startsWith("Running strike recovery"))
      || attemptDefender.threatTransitions.some((entry) =>
        entry.visible && (entry.phase === "RUNNING WINDUP" || entry.phase === "RUNNING STRIKE"))
      || attemptDefender.recoveryTransitions.some((entry) =>
        entry.visible && entry.state === "running-attack-recovery");
    const cleanLatchMiss = attemptAttacker.playerHp === 100 && attemptAttacker.playerGuard === 100
      && attemptAttacker.opponentHp === 100 && attemptAttacker.opponentGuard === 100
      && attemptDefender.playerHp === 100 && attemptDefender.playerGuard === 100
      && !runningCommitted
      && !attemptAttacker.feedbackTransitions.includes("hit-confirm")
      && !attemptDefender.feedbackTransitions.includes("damage-taken");
    if (!cleanLatchMiss) {
      throw new Error(`M119 running strike attempt ${attempt} resolved unexpectedly: ${JSON.stringify(lastObserved)}`);
    }
    if (attempt < 3) await sleep(500);
  }
  if (!evidence) {
    throw new Error(`M119 running strike did not latch after bounded clean retries: ${JSON.stringify(lastObserved)}`);
  }

  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) {
    throw new Error(`M119 running strike incomplete evidence: ${JSON.stringify(evidence)}`);
  }

  const committedPointers = attackerResult.pointers.slice(successfulPointerOffset);
  const committedKeys = attackerResult.keys.slice(successfulKeyOffset);
  const rightDown = committedPointers.find((event) => event.type === "pointerdown" && event.button === 2);
  const rightUp = committedPointers.find((event) => event.type === "pointerup" && event.button === 2);
  const lightDown = committedPointers.find((event) => event.type === "pointerdown" && event.button === 0);
  const lightUp = committedPointers.find((event) => event.type === "pointerup" && event.button === 0);
  if (!rightDown || !rightUp || !lightDown || !lightUp
    || !committedKeys.includes(`keydown:${movementCode}`)
    || !committedKeys.includes(`keyup:${movementCode}`)) {
    throw new Error(`M119 committed attempt lacked real run + movement + LMB controls: ${JSON.stringify({ committedPointers, committedKeys })}`);
  }
  if (lightDown.t - rightDown.t < 180 || lightUp.t <= lightDown.t || rightUp.t <= lightUp.t) {
    throw new Error(`M119 committed running gesture violated hold/release ordering: ${JSON.stringify(committedPointers)}`);
  }
  if (attackerResult.playerHp !== 100 || attackerResult.playerGuard !== 100
    || attackerResult.opponentHp !== 70
    || defenderResult.playerHp !== 70 || defenderResult.playerGuard !== 100) {
    throw new Error(`M119 running strike did not resolve as one 30 HP hit: ${JSON.stringify(evidence)}`);
  }
  if (!attackerResult.events.includes("Opponent hit - 30 HP.")
    || !defenderResult.events.includes("Hit taken - 30 HP.")) {
    throw new Error(`M119 running strike damage feedback was incomplete: ${JSON.stringify(evidence)}`);
  }
  const runningThreat = defenderResult.threatTransitions.some((entry) =>
    entry.visible && (entry.phase === "RUNNING WINDUP" || entry.phase === "RUNNING STRIKE"));
  const runningRecovery = defenderResult.recoveryTransitions.some((entry) =>
    entry.visible && entry.state === "running-attack-recovery"
      && entry.label === "PUNISH" && entry.detail === "Running recovery");
  if (!runningThreat || !runningRecovery) {
    throw new Error(`M119 running strike readability was incomplete: ${JSON.stringify(defenderResult)}`);
  }
  if (!attackerResult.events.some((text) =>
    text.startsWith("Running strike committed")
    || text.startsWith("Running strike active")
    || text.startsWith("Running strike recovery"))) {
    throw new Error(`M119 attacker never rendered running-strike commitment: ${JSON.stringify(attackerResult.events)}`);
  }
  return evidence;
}

async function runOnlineUiFeintFlight(entries) {
  const staged = await prepareHeavyCounterplayFlight(
    entries,
    "M117 wheel-back feint",
    { attackerName: "chrome", defenderName: "firefox", movementMs: 150 },
  );
  const { attacker, defender, attackerElementId, movementCode } = staged;
  const attackRight = movementCode === "KeyD";
  const attackOffset = attackRight ? 200 : -200;

  let defenderObservedRecovery = false;
  let evidence = null;
  for (let attempt = 1; attempt <= 3 && !defenderObservedRecovery; attempt += 1) {
    const before = await Promise.all(entries.map(readUiEvidence));
    const beforeAttacker = before.find((entry) => entry.browser === attacker.name);
    const beforeDefender = before.find((entry) => entry.browser === defender.name);
    if (!beforeAttacker || !beforeDefender) {
      throw new Error(`M117 feint missing baseline evidence on attempt ${attempt}: ${JSON.stringify(before)}`);
    }
    const feintsBefore = beforeAttacker.events.filter((text) =>
      text.startsWith("Feint recovery")).length;
    const pointerOffset = beforeAttacker.pointers.length;
    const wheelOffset = beforeAttacker.wheels.length;
    const remoteRecoveriesBefore = beforeDefender.recoveryTransitions.filter((entry) =>
      entry.visible && entry.state === "feint-recovery").length;

    await performArenaFeint(attacker, attackerElementId, attackOffset);

    const deadline = Date.now() + 900;
    while (Date.now() < deadline) {
      const state = await readUiEvidence(defender);
      const remoteRecoveries = state.recoveryTransitions.filter((entry) =>
        entry.visible
        && entry.state === "feint-recovery"
        && entry.label === "PUNISH"
        && entry.detail === "Feint recovery").length;
      if (remoteRecoveries > remoteRecoveriesBefore) {
        defenderObservedRecovery = true;
        break;
      }
      await sleep(20);
    }

    evidence = await Promise.all(entries.map(readUiEvidence));
    const attemptAttacker = evidence.find((entry) => entry.browser === attacker.name);
    const attemptDefender = evidence.find((entry) => entry.browser === defender.name);
    if (!attemptAttacker || !attemptDefender) {
      throw new Error(`M117 feint incomplete evidence on attempt ${attempt}: ${JSON.stringify(evidence)}`);
    }
    if (defenderObservedRecovery) break;

    const feintsAfter = attemptAttacker.events.filter((text) =>
      text.startsWith("Feint recovery")).length;
    const attemptPointers = attemptAttacker.pointers.slice(pointerOffset);
    const attemptWheels = attemptAttacker.wheels.slice(wheelOffset);
    const lightDown = attemptPointers.find((event) => event.type === "pointerdown" && event.button === 0);
    const lightUp = attemptPointers.find((event) => event.type === "pointerup" && event.button === 0);
    const wheelBack = attemptWheels.find((event) => event.deltaY > 0);
    const completeGesture = Boolean(lightDown && lightUp && wheelBack && lightUp.t > lightDown.t);
    const pristine = attemptAttacker.playerHp === 100 && attemptAttacker.playerGuard === 100
      && attemptAttacker.opponentHp === 100 && attemptAttacker.opponentGuard === 100
      && attemptDefender.playerHp === 100 && attemptDefender.playerGuard === 100;
    const noContact = !attemptAttacker.feedbackTransitions.includes("hit-confirm")
      && !attemptDefender.feedbackTransitions.includes("damage-taken")
      && !attemptAttacker.feedbackTransitions.includes("block-confirm")
      && !attemptDefender.feedbackTransitions.includes("parry-success");
    const cleanRemoteObservationMiss = feintsAfter > feintsBefore && pristine && noContact;
    const cleanGestureLatchMiss = completeGesture
      && feintsAfter === feintsBefore
      && pristine
      && noContact;
    if (!cleanRemoteObservationMiss && !cleanGestureLatchMiss) {
      throw new Error(`M117 feint attempt ${attempt} did not qualify for clean observation retry: ${JSON.stringify(evidence)}`);
    }
    if (attempt < 3) await sleep(340);
  }

  if (!evidence) evidence = await Promise.all(entries.map(readUiEvidence));
  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) {
    throw new Error(`M117 feint incomplete evidence: ${JSON.stringify(evidence)}`);
  }

  const lightDown = attackerResult.pointers.find((event) =>
    event.type === "pointerdown" && event.button === 0);
  const lightUp = attackerResult.pointers.find((event) =>
    event.type === "pointerup" && event.button === 0);
  const wheelBack = attackerResult.wheels.find((event) => event.deltaY > 0);
  if (!lightDown || !lightUp || !wheelBack) {
    throw new Error(`M117 real LMB + wheel-back controls were not delivered: ${JSON.stringify(attackerResult)}`);
  }
  if (!defenderObservedRecovery) {
    throw new Error(`M117 defender never observed authoritative feint recovery: ${JSON.stringify(defenderResult)}`);
  }
  if (attackerResult.playerHp !== 100 || attackerResult.playerGuard !== 100
    || attackerResult.opponentHp !== 100 || attackerResult.opponentGuard !== 100
    || defenderResult.playerHp !== 100 || defenderResult.playerGuard !== 100) {
    throw new Error(`M117 feint changed authoritative vitals: ${JSON.stringify(evidence)}`);
  }
  // The remote replicated FeintRecovery state above is the authoritative proof.
  // Attacker event-text is intentionally not required here: it is transient
  // presentation and can be overwritten by the next online status frame.
  if (attackerResult.feedbackTransitions.includes("hit-confirm")
    || defenderResult.feedbackTransitions.includes("damage-taken")
    || attackerResult.feedbackTransitions.includes("block-confirm")
    || defenderResult.feedbackTransitions.includes("parry-success")) {
    throw new Error(`M117 feint accidentally resolved combat contact: ${JSON.stringify(evidence)}`);
  }

  // M170 extends the same real-browser gesture into exhaustion. First wait for
  // the successful feint recovery to return authority to idle, then drain
  // stamina through genuine RMB-hold running while moving away from the rival.
  // Reusing performArenaFeint below is important: sufficient stamina above just
  // proved this exact browser-owned LMB+wheel-back schedule lands in the early
  // 70 ms feint window.
  const awayKey = movementCode === "KeyD" ? "a" : "d";
  const awayOffset = -attackOffset;
  await aimArena(attacker, attackerElementId, awayOffset);
  const waitForAttacker = async (predicate, timeoutMs, label) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const state = await readUiEvidence(attacker);
      if (predicate(state)) return state;
      await sleep(12);
    }
    throw new Error("M170 exhausted feint timed out waiting for " + label + ": "
      + JSON.stringify(await readUiEvidence(attacker)));
  };

  await waitForAttacker(
    (state) => state.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle,
    COMBAT.feint.recoveryMs + 700,
    "idle after successful feint",
  );

  let exhausted = null;
  let drainHolds = 0;
  for (let index = 0; index < 6 && !exhausted; index += 1) {
    const state = await readUiEvidence(attacker);
    if (Number.isFinite(state.acceptance?.authoritativeStamina)
      && state.acceptance.authoritativeStamina < COMBAT.feint.staminaCost - 2
      && state.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle) {
      exhausted = state;
      break;
    }
    await performArenaRunHold(attacker, attackerElementId, awayKey, awayOffset, 1100);
    drainHolds += 1;
    await sleep(140);
  }
  if (!exhausted) {
    exhausted = await readUiEvidence(attacker);
    if (!Number.isFinite(exhausted.acceptance?.authoritativeStamina)
      || exhausted.acceptance.authoritativeStamina >= COMBAT.feint.staminaCost - 2
      || exhausted.acceptance?.ownActionTransitions?.at(-1)?.action !== COMBAT_ACTION.idle) {
      throw new Error("M170 exhausted feint could not establish sub-feint-cost stamina: "
        + JSON.stringify(exhausted));
    }
  }

  const baselineStamina = Math.round(exhausted.acceptance.authoritativeStamina);
  const actionOffset = exhausted.acceptance.ownActionTransitions.length;
  const staminaOffset = exhausted.acceptance.staminaTransitions.length;
  const pointerOffset = exhausted.pointers.length;
  const exhaustedWheelOffset = exhausted.wheels.length;
  await performArenaFeint(attacker, attackerElementId, awayOffset);

  const committed = await waitForAttacker(
    (state) => {
      const actions = state.acceptance?.ownActionTransitions?.slice(actionOffset) ?? [];
      return actions.some((entry) =>
        entry.action === COMBAT_ACTION.attackActive
        || entry.action === COMBAT_ACTION.attackLeftActive
        || entry.action === COMBAT_ACTION.attackRightActive)
        && !actions.some((entry) => entry.action === COMBAT_ACTION.feintRecovery);
    },
    900,
    "original light commitment after rejected feint",
  );

  const exhaustedPointers = committed.pointers.slice(pointerOffset);
  const exhaustedWheels = committed.wheels.slice(exhaustedWheelOffset);
  const exhaustedLightDown = exhaustedPointers.find((entry) =>
    entry.type === "pointerdown" && entry.button === 0);
  const exhaustedLightUp = exhaustedPointers.find((entry) =>
    entry.type === "pointerup" && entry.button === 0);
  const exhaustedWheelBack = exhaustedWheels.find((entry) => entry.deltaY > 0);
  if (!exhaustedLightDown || !exhaustedLightUp || !exhaustedWheelBack
    || !Number.isFinite(exhaustedLightDown.epochMs)
    || !Number.isFinite(exhaustedLightUp.epochMs)
    || !Number.isFinite(exhaustedWheelBack.epochMs)
    || exhaustedLightUp.epochMs <= exhaustedLightDown.epochMs
    // M331 sends a genuine wheel in the first W3C tick after pointerDOWN,
    // before the 20ms held-pointer release. Check the actual DOM ordering;
    // do not require the former wheel-after-pointerUP choreography.
    || exhaustedWheelBack.epochMs < exhaustedLightDown.epochMs
    || exhaustedWheelBack.epochMs > exhaustedLightUp.epochMs
    || exhaustedWheelBack.epochMs - exhaustedLightDown.epochMs > COMBAT.feint.lightWindowMs) {
    throw new Error("M170 exhausted feint did not deliver the same genuine early LMB+wheel-back chord: "
      + JSON.stringify({ pointers: exhaustedPointers, wheels: exhaustedWheels }));
  }

  const exhaustedActions = committed.acceptance.ownActionTransitions.slice(actionOffset);
  if (exhaustedActions.some((entry) => entry.action === COMBAT_ACTION.feintRecovery)) {
    throw new Error("M170 exhausted wheel-back incorrectly entered feint recovery: "
      + JSON.stringify(exhaustedActions));
  }
  const staminaTransitions = committed.acceptance.staminaTransitions.slice(staminaOffset);
  const minimumStamina = staminaTransitions.reduce(
    (value, entry) => Number.isFinite(entry.stamina) ? Math.min(value, entry.stamina) : value,
    baselineStamina,
  );
  if (minimumStamina < baselineStamina - 1) {
    throw new Error("M170 rejected feint spent the 12-stamina feint cost: "
      + JSON.stringify({ baselineStamina, staminaTransitions }));
  }

  const exhaustedEvidence = await Promise.all(entries.map(readUiEvidence));
  for (const state of exhaustedEvidence) {
    if (state.playerHp !== 100 || state.playerGuard !== 100) {
      throw new Error("M170 exhausted feint proof changed health/guard: "
        + JSON.stringify(exhaustedEvidence));
    }
  }

  // M171 repeats the same authority rule for the distinct heavy-feint window.
  // Wait for the rejected light to finish, refresh exhaustion while moving away,
  // then deliver one browser-owned held-LMB + wheel-back chord inside160ms.
  await waitForAttacker(
    (state) => state.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle,
    COMBAT.attack.activeMs + COMBAT.attack.recoveryMs + 900,
    "idle after exhausted light commitment",
  );

  let heavyExhausted = null;
  for (let index = 0; index < 6 && !heavyExhausted; index += 1) {
    const state = await readUiEvidence(attacker);
    if (Number.isFinite(state.acceptance?.authoritativeStamina)
      && state.acceptance.authoritativeStamina < COMBAT.feint.staminaCost - 2
      && state.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle) {
      heavyExhausted = state;
      break;
    }
    await performArenaRunHold(attacker, attackerElementId, awayKey, awayOffset, 1100);
    drainHolds += 1;
    await sleep(140);
  }
  if (!heavyExhausted) {
    heavyExhausted = await readUiEvidence(attacker);
    if (!Number.isFinite(heavyExhausted.acceptance?.authoritativeStamina)
      || heavyExhausted.acceptance.authoritativeStamina >= COMBAT.feint.staminaCost - 2
      || heavyExhausted.acceptance?.ownActionTransitions?.at(-1)?.action !== COMBAT_ACTION.idle) {
      throw new Error("M171 exhausted heavy feint could not establish sub-feint-cost stamina: "
        + JSON.stringify(heavyExhausted));
    }
  }

  const heavyBaselineStamina = Math.round(heavyExhausted.acceptance.authoritativeStamina);
  const heavyActionOffset = heavyExhausted.acceptance.ownActionTransitions.length;
  const heavyStaminaOffset = heavyExhausted.acceptance.staminaTransitions.length;
  const heavyPointerOffset = heavyExhausted.pointers.length;
  const heavyWheelOffset = heavyExhausted.wheels.length;
  await performArenaHeavyFeint(attacker, attackerElementId, awayOffset);

  const heavyCommitted = await waitForAttacker(
    (state) => {
      const actions = state.acceptance?.ownActionTransitions?.slice(heavyActionOffset) ?? [];
      return actions.some((entry) => entry.action === COMBAT_ACTION.heavyAttackActive)
        && !actions.some((entry) => entry.action === COMBAT_ACTION.feintRecovery);
    },
    COMBAT.heavyAttack.windupMs + 900,
    "original heavy commitment after rejected heavy feint",
  );

  const heavyPointers = heavyCommitted.pointers.slice(heavyPointerOffset);
  const heavyWheels = heavyCommitted.wheels.slice(heavyWheelOffset);
  const { down: heavyDown, up: heavyUp } = requireM188NativeHeldLmb(heavyPointers, awayOffset > 0, "M171");
  const heavyWheelBack = heavyWheels.find((entry) => entry.deltaY > 0);
  if (!heavyDown || !heavyUp || !heavyWheelBack
    || !Number.isFinite(heavyDown.epochMs)
    || !Number.isFinite(heavyUp.epochMs)
    || !Number.isFinite(heavyWheelBack.epochMs)
    || heavyUp.epochMs <= heavyDown.epochMs
    || heavyWheelBack.epochMs < heavyDown.epochMs
    || heavyWheelBack.epochMs - heavyDown.epochMs > COMBAT.feint.heavyWindowMs - 10) {
    throw new Error("M171 exhausted heavy feint did not deliver a genuine early held-LMB+wheel-back chord: "
      + JSON.stringify({ pointers: heavyPointers, wheels: heavyWheels }));
  }

  const heavySettled = await waitForAttacker(
    state => {
      const actions = state.acceptance?.ownActionTransitions?.slice(heavyActionOffset) ?? [];
      const active = actions.find(entry => entry.action === COMBAT_ACTION.heavyAttackActive);
      return active && actions.some(entry => entry.action === COMBAT_ACTION.idle && entry.epochMs > active.epochMs);
    },
    COMBAT.heavyAttack.activeMs + COMBAT.heavyAttack.recoveryMs + 700,
    "completed original heavy recovery after rejected feint, without phantom release attack",
  );
  const heavyActions = heavySettled.acceptance.ownActionTransitions.slice(heavyActionOffset);
  if (heavyActions.some((entry) => entry.action === COMBAT_ACTION.feintRecovery)) {
    throw new Error("M171 exhausted heavy wheel-back incorrectly entered feint recovery: "
      + JSON.stringify(heavyActions));
  }
  if (heavyActions.filter(entry => entry.action === COMBAT_ACTION.heavyAttackActive).length !== 1
      || heavyActions.some(entry => [COMBAT_ACTION.attackWindup, COMBAT_ACTION.attackActive,
        COMBAT_ACTION.attackLeftWindup, COMBAT_ACTION.attackLeftActive, COMBAT_ACTION.attackRightWindup,
        COMBAT_ACTION.attackRightActive].includes(entry.action))) {
    throw new Error("M171 physical LMB release produced a phantom light or duplicate heavy after rejected feint: " + JSON.stringify(heavyActions));
  }
  if (heavyCommitted.keys.some(event => event.endsWith(":KeyE"))) throw new Error("M171 retired E cannot author heavy feint");
  const heavyStaminaTransitions = heavySettled.acceptance.staminaTransitions.slice(heavyStaminaOffset);
  const heavyMinimumStamina = heavyStaminaTransitions.reduce(
    (value, entry) => Number.isFinite(entry.stamina) ? Math.min(value, entry.stamina) : value,
    heavyBaselineStamina,
  );
  if (heavyMinimumStamina < heavyBaselineStamina - 1) {
    throw new Error("M171 rejected heavy feint spent the 12-stamina feint cost: "
      + JSON.stringify({ heavyBaselineStamina, heavyStaminaTransitions }));
  }

  const heavyEvidence = await Promise.all(entries.map(readUiEvidence));
  for (const state of heavyEvidence) {
    if (state.playerHp !== 100 || state.playerGuard !== 100) {
      throw new Error("M171 exhausted heavy feint proof changed health/guard: "
        + JSON.stringify(heavyEvidence));
    }
  }

  return heavyEvidence.map((entry) => ({
    ...entry,
    m170AttackerId: attackerResult.playerNetId,
    m170DrainHolds: entry.browser === attacker.name ? drainHolds : null,
    m170DeniedAtStamina: entry.browser === attacker.name ? baselineStamina : null,
    m170WheelEpochMs: entry.browser === attacker.name ? exhaustedWheelBack.epochMs : null,
    m170CommittedWithoutFeint: entry.browser === attacker.name
      ? !exhaustedActions.some((item) => item.action === COMBAT_ACTION.feintRecovery)
      : null,
    m171HeavyDeniedAtStamina: entry.browser === attacker.name ? heavyBaselineStamina : null,
    m171HeavyWheelEpochMs: entry.browser === attacker.name ? heavyWheelBack.epochMs : null,
    m171HeavyCommittedWithoutFeint: entry.browser === attacker.name
      ? !heavyActions.some((item) => item.action === COMBAT_ACTION.feintRecovery)
      : null,
  }));
}

async function runOnlineUiHeavyWhiffPunishFlight(entries) {
  const staged = await prepareHeavyCounterplayFlight(
    entries,
    "M109 heavy whiff punish",
    { attackerName: "firefox", defenderName: "chrome", movementMs: 160 },
  );
  const { attacker, defender, attackerElementId, defenderElementId, movementCode } = staged;
  const attackRight = movementCode === "KeyD";
  const attackOffset = attackRight ? 200 : -200;
  const whiffOffset = -attackOffset;
  const punishMoveKey = attackRight ? "a" : "d";
  const punishMoveCode = attackRight ? "KeyA" : "KeyD";
  const punishOffset = attackRight ? -200 : 200;

  // Stage inside punish range, then deliberately face the heavy away from
  // the defender. This creates a deterministic directional whiff without making
  // the acceptance depend on sub-frame distance thresholds.
  await aimArena(attacker, attackerElementId, whiffOffset);
  await sleep(40);

  // A genuine WebDriver LMB gesture can occasionally miss the client's one-shot
  // outbound action latch. Retry only when the entire authoritative exchange
  // proves that no heavy ever committed. Any threat/recovery/commit evidence or
  // any vital change makes the attempt terminal and fail-closed.
  let recoveryObserved = false;
  let lastMiss = null;
  for (let attempt = 1; attempt <= 3 && !recoveryObserved; attempt += 1) {
    const before = await Promise.all(entries.map(readUiEvidence));
    const beforeAttacker = before.find((entry) => entry.browser === attacker.name);
    if (!beforeAttacker) throw new Error(`M109 missing attacker baseline on attempt ${attempt}: ${JSON.stringify(before)}`);
    const commitsBefore = beforeAttacker.events.filter((text) =>
      text.startsWith("Heavy strike committed")).length;

    await performM110NativeHeldLmb(attacker, attackerElementId, whiffOffset);
    // React to the actual remote recovery cue instead of a wall-clock guess.
    // This both proves the punish window was readable to the defender and avoids
    // coupling the counter to cross-browser snapshot/WebDriver delivery skew.
    const recoveryDeadline = Date.now() + 600;
    while (Date.now() < recoveryDeadline) {
      const state = await readUiEvidence(defender);
      recoveryObserved = state.recoveryVisible
        && state.recoveryState === "heavy-attack-recovery"
        && state.recoveryLabel === "PUNISH"
        && state.recoveryDetail === "Heavy recovery";
      if (recoveryObserved) break;
      await sleep(20);
    }
    if (recoveryObserved) break;

    lastMiss = await Promise.all(entries.map(readUiEvidence));
    const attackerState = lastMiss.find((entry) => entry.browser === attacker.name);
    const defenderState = lastMiss.find((entry) => entry.browser === defender.name);
    if (!attackerState || !defenderState) {
      throw new Error(`M109 incomplete retry evidence on attempt ${attempt}: ${JSON.stringify(lastMiss)}`);
    }
    const commitsAfter = attackerState.events.filter((text) =>
      text.startsWith("Heavy strike committed")).length;
    const heavyCommitted = commitsAfter > commitsBefore
      || defenderState.threatTransitions.some((entry) =>
        entry.visible && (entry.phase === "HEAVY WINDUP" || entry.phase === "HEAVY STRIKE"))
      || defenderState.recoveryTransitions.some((entry) =>
        entry.visible && entry.state === "heavy-attack-recovery");
    const cleanVitals = attackerState.playerHp === 100 && attackerState.playerGuard === 100
      && attackerState.opponentHp === 100 && attackerState.opponentGuard === 100
      && defenderState.playerHp === 100 && defenderState.playerGuard === 100
      && defenderState.opponentHp === 100 && defenderState.opponentGuard === 100;
    if (heavyCommitted || !cleanVitals) {
      throw new Error(`M109 heavy attempt ${attempt} committed without a readable recovery or resolved unexpectedly: ${JSON.stringify(lastMiss)}`);
    }
    if (attempt < 3) {
      await aimArena(attacker, attackerElementId, whiffOffset);
      await sleep(80);
    }
  }
  if (!recoveryObserved) {
    throw new Error(`M109 defender never observed live punishable heavy recovery after bounded clean latch retries: ${JSON.stringify(lastMiss)}`);
  }
  // Start the genuine light while the closing movement is still held instead
  // of serializing 160 ms of movement before LMB. The old sequence could spend
  // ~320 ms of the unchanged 420 ms recovery on WebDriver calls before the
  // 135 ms light windup even began. This keeps the same real movement + LMB
  // proof while starting the punish near the observed recovery edge.
  let punishMoveHeld = false;
  let punishAttackHeld = false;
  let punishCommitted = false;
  let successfulPunishPointerOffset = 0;
  let lastPunishMiss = null;
  const lightCommitCount = (state) => state?.events.filter((text) =>
    text.startsWith("Attack committed")
      || text.startsWith("Left sweep committed")
      || text.startsWith("Right sweep committed")).length ?? 0;
  const lightThreatCount = (state) => state?.threatTransitions.filter((entry) =>
    entry.visible && (entry.phase === "WINDUP" || entry.phase === "STRIKE"
      || entry.phase === "LEFT WINDUP" || entry.phase === "LEFT SWEEP"
      || entry.phase === "RIGHT WINDUP" || entry.phase === "RIGHT SWEEP")).length ?? 0;
  try {
    await setMovementKey(defender, punishMoveKey, true);
    punishMoveHeld = true;
    await aimArena(defender, defenderElementId, punishOffset);
    await sleep(35);

    for (let attempt = 1; attempt <= 3 && !punishCommitted; attempt += 1) {
      const before = await Promise.all(entries.map(readUiEvidence));
      const beforeAttacker = before.find((entry) => entry.browser === attacker.name);
      const beforeDefender = before.find((entry) => entry.browser === defender.name);
      if (!beforeAttacker || !beforeDefender) {
        throw new Error(`M109 punish missing baseline evidence on attempt ${attempt}: ${JSON.stringify(before)}`);
      }
      const pointerOffset = beforeDefender.pointers.length;
      const commitsBefore = lightCommitCount(beforeDefender);
      const threatsBefore = lightThreatCount(beforeAttacker);

      await setArenaAttack(defender, defenderElementId, true, punishOffset);
      punishAttackHeld = true;
      await sleep(35);
      await setArenaAttack(defender, defenderElementId, false, punishOffset);
      punishAttackHeld = false;

      const commitDeadline = Date.now() + 105;
      while (Date.now() < commitDeadline) {
        const current = await Promise.all(entries.map(readUiEvidence));
        const currentAttacker = current.find((entry) => entry.browser === attacker.name);
        const currentDefender = current.find((entry) => entry.browser === defender.name);
        const committed = lightCommitCount(currentDefender) > commitsBefore
          || lightThreatCount(currentAttacker) > threatsBefore
          || (currentAttacker?.playerHp ?? 100) < 100
          || (currentDefender?.opponentHp ?? 100) < 100;
        if (committed) {
          successfulPunishPointerOffset = pointerOffset;
          punishCommitted = true;
          break;
        }
        await sleep(10);
      }
      if (punishCommitted) break;

      lastPunishMiss = await Promise.all(entries.map(readUiEvidence));
      const missAttacker = lastPunishMiss.find((entry) => entry.browser === attacker.name);
      const missDefender = lastPunishMiss.find((entry) => entry.browser === defender.name);
      if (!missAttacker || !missDefender) {
        throw new Error(`M109 punish incomplete latch evidence on attempt ${attempt}: ${JSON.stringify(lastPunishMiss)}`);
      }
      const attemptPointers = missDefender.pointers.slice(pointerOffset);
      const down = attemptPointers.find((event) => event.type === "pointerdown" && event.button === 0);
      const up = attemptPointers.find((event) => event.type === "pointerup" && event.button === 0);
      if (!down || !up || up.t <= down.t) {
        throw new Error(`M109 punish retry ${attempt} lacked a complete real LMB gesture: ${JSON.stringify(missDefender)}`);
      }
      // R1 light commits on real pointerup. The additional evidence read
      // after the bounded 105ms poll can be the FIRST read to confirm a
      // genuinely committed light or remote threat. Accept that evidence
      // as this attempt's commit; never classify it as a clean latch miss
      // or send a duplicate LMB. The strict 34HP/no-heavy-hit final gates
      // below still reject any failed punish.
      const lateCommitted = lightCommitCount(missDefender) > commitsBefore
        || lightThreatCount(missAttacker) > threatsBefore
        || missAttacker.playerHp < 100 || missDefender.opponentHp < 100;
      if (lateCommitted) {
        successfulPunishPointerOffset = pointerOffset;
        punishCommitted = true;
        break;
      }
      const cleanLatchMiss = missAttacker.playerHp === 100 && missAttacker.playerGuard === 100
        && missAttacker.opponentHp === 100 && missAttacker.opponentGuard === 100
        && missDefender.playerHp === 100 && missDefender.playerGuard === 100
        && missDefender.opponentHp === 100 && missDefender.opponentGuard === 100
        && lightCommitCount(missDefender) === commitsBefore
        && lightThreatCount(missAttacker) === threatsBefore
        && !missDefender.feedbackTransitions.includes("hit-confirm")
        && !missAttacker.feedbackTransitions.includes("damage-taken");
      if (!cleanLatchMiss) {
        throw new Error(`M109 punish attempt ${attempt} resolved unexpectedly: ${JSON.stringify(lastPunishMiss)}`);
      }
      if (attempt < 3) await sleep(20);
    }
    if (!punishCommitted) {
      throw new Error(`M109 punish did not latch after bounded complete LMB retries: ${JSON.stringify(lastPunishMiss)}`);
    }
    await sleep(80);
  } finally {
    if (punishAttackHeld) {
      await setArenaAttack(defender, defenderElementId, false, punishOffset);
    }
    if (punishMoveHeld) {
      await setMovementKey(defender, punishMoveKey, false);
    }
  }
  await sleep(260);

  const evidence = await Promise.all(entries.map(readUiEvidence));
  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) {
    throw new Error(`M109 heavy whiff punish incomplete evidence: ${JSON.stringify(evidence)}`);
  }

  assertHeavyControlDelivered(attackerResult, movementCode, "M109 heavy whiff punish", !attackRight);
  const authoritativeHeavyCommits = attackerResult.events.filter((text) =>
    text.startsWith("Heavy strike committed")).length;
  if (authoritativeHeavyCommits !== 1) {
    throw new Error(`M109 expected exactly one authoritative heavy commitment: ${JSON.stringify(attackerResult)}`);
  }
  if (!defenderResult.keys.includes(`keydown:${punishMoveCode}`)
    || !defenderResult.keys.includes(`keyup:${punishMoveCode}`)) {
    throw new Error(`M109 punish closing movement was not delivered: ${JSON.stringify(defenderResult)}`);
  }
  const committedPunishPointers = defenderResult.pointers.slice(successfulPunishPointerOffset);
  const punishDown = committedPunishPointers.find((event) => event.type === "pointerdown" && event.button === 0);
  const punishUp = committedPunishPointers.find((event) => event.type === "pointerup" && event.button === 0);
  const punishAimValid = punishDown && Math.abs(punishDown.y - 0.5) <= 0.15
    && (attackRight ? punishDown.x <= 0.4 : punishDown.x >= 0.6);
  if (!punishDown || !punishUp || !punishAimValid) {
    throw new Error(`M109 real light-punish pointer control was not delivered: ${JSON.stringify(defenderResult)}`);
  }

  if (attackerResult.playerHp !== 66 || attackerResult.playerGuard !== 100
    || attackerResult.opponentHp !== 100 || attackerResult.opponentGuard !== 100
    || defenderResult.playerHp !== 100 || defenderResult.playerGuard !== 100
    || defenderResult.opponentHp !== 66 || defenderResult.opponentGuard !== 100) {
    throw new Error(`M109 whiff punish did not resolve as exactly one 34-damage light hit: ${JSON.stringify(evidence)}`);
  }
  if (attackerResult.events.includes("Opponent hit - 46 HP.")
    || defenderResult.events.includes("Hit taken - 46 HP.")) {
    throw new Error(`M109 directional whiff unexpectedly connected the heavy strike: ${JSON.stringify(evidence)}`);
  }
  if (!defenderResult.events.includes("Opponent hit - 34 HP.")
    || !attackerResult.events.includes("Hit taken - 34 HP.")) {
    throw new Error(`M109 light punish feedback was not authoritative: ${JSON.stringify(evidence)}`);
  }
  const heavyRecovery = defenderResult.recoveryTransitions.some((entry) =>
    entry.visible && entry.state === "heavy-attack-recovery"
      && entry.label === "PUNISH" && entry.detail === "Heavy recovery");
  if (!heavyRecovery) {
    throw new Error(`M109 defender never observed the punishable heavy recovery: ${JSON.stringify(defenderResult.recoveryTransitions)}`);
  }
  if (!defenderResult.feedbackTransitions.includes("hit-confirm")
    || !attackerResult.feedbackTransitions.includes("damage-taken")) {
    throw new Error(`M109 punish hit feedback did not resolve on opposite clients: ${JSON.stringify(evidence)}`);
  }
  return evidence;
}

async function runOnlineUiDodgeFeedbackFlight(entries) {
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const attacker = entries.find((entry) => entry.name === "firefox");
  const defender = entries.find((entry) => entry.name === "chrome");
  const attackerReady = ready.find((entry) => entry.browser === attacker?.name);
  const defenderReady = ready.find((entry) => entry.browser === defender?.name);
  if (!attacker || !defender || !attackerReady || !defenderReady) throw new Error(`could not resolve M36 UI roles from ${JSON.stringify(ready)}`);
  const attackRight = attackerReady.playerNetId < defenderReady.playerNetId;
  const movementKey = attackRight ? "d" : "a";
  const movementCode = attackRight ? "KeyD" : "KeyA";
  const attackOffset = attackRight ? 200 : -200;

  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const attackerElementId = await resolveArenaElement(attacker, "M36 attacker");
  const defenderElementId = await resolveArenaElement(defender, "M36 defender");
  await Promise.all(entries.map(centerArenaInViewport));
  await aimArena(defender, defenderElementId, attackRight ? -200 : 200);
  // M24 owns exact dodge timing/geometry proof. M36 needs a deterministic
  // authoritative dodge-evade UI exchange, so stage the attacker deeper inside
  // unchanged attack reach. That keeps a correctly early perpendicular dodge in
  // potential hit geometry through the strike instead of letting movement alone
  // turn the exchange into a clean spatial miss.
  await pulseMovementKey(attacker, movementKey, 260);
  await aimArena(attacker, attackerElementId, attackOffset);
  await sleep(50);

  let evidence = null;
  let lastAttemptBaseline = null;
  // M24 owns reaction-timing/geometry proof. M36 owns the real-control readability
  // path. Each attempt uses one genuine Firefox LMB hold and one genuine Chrome
  // pointer-directed roll with explicit delivered-edge ordering; combat timing and
  // acceptance thresholds stay unchanged.
  for (let attempt = 1; attempt <= 3 && !evidence; attempt += 1) {
    lastAttemptBaseline = await Promise.all(entries.map(readUiEvidence));
    if (!lastAttemptBaseline.every((entry) => entry.playerHp === 100 && entry.playerGuard === 100)) {
      throw new Error(`M36 retry ${attempt} did not start from clean authoritative vitals: ${JSON.stringify(lastAttemptBaseline)}`);
    }

    let rollIssued = false;
    let defenderMovementHeld = false;

    // R2: genuine LMB commits the light on pointerDOWN, NOT on UP.
    // M36 #39158029761 showed first authoritative 34HP contact before
    // Chrome's dodge i-frames, followed by genuine dodge-success. With
    // actual Firefox down/up separated by 44ms, an obsolete 35ms host wait
    // AFTER the W3C click ACK delayed the Chrome wheel until just 38ms
    // before the first hit. Submit the one genuine perpendicular roll
    // IMMEDIATELY after the full Firefox W3C click; do not add a host
    // timer. Retain the real UP-before-wheel cross-browser epoch proof,
    // unchanged 135ms light windup, 125ms iframe and strict zero-HP
    // damage/parry gates. No fake input or replay of a resolved exchange.
    try {
      await aimArena(defender, defenderElementId, 0, 180);
      defenderMovementHeld = true;
      await setMovementKey(defender, "s", true);

      await performArenaAttackHold(attacker, attackerElementId, attackOffset, 65);
      await scrollArenaWheel(defender, defenderElementId, -120);
      rollIssued = true;
      console.log("M238_GENUINE_RELEASED_LIGHT_DODGE " + JSON.stringify({
        attempt, requestedLightHoldMs: 65, postClickHostWaitMs: 0,
      }));

      await sleep(60);
      defenderMovementHeld = false;
      await setMovementKey(defender, "s", false);
    } finally {
      if (defenderMovementHeld) await setMovementKey(defender, "s", false);
    }
    await sleep(180);
    evidence = await waitForUiDodgeEvidence(entries, attacker, defender, 520, false, lastAttemptBaseline);
    if (evidence) break;

    const missed = await Promise.all(entries.map(readUiEvidence));
    const vitalsClean = missed.every((entry) => entry.playerHp === 100 && entry.playerGuard === 100);
    const parrySeen = missed.some((entry) => entry.feedbackTransitions.includes("parried") || entry.feedbackTransitions.includes("parry-success"));
    if (!vitalsClean || parrySeen) {
      throw new Error(`M36 retry ${attempt} failed closed after a resolved exchange: ${JSON.stringify(missed)}`);
    }
    if (attempt < 3) {
      // Let authoritative recovery settle. Only unwind geometry when a real roll
      // was actually issued; a clean missed attack latch must not move the defender.
      await sleep(430);
      if (rollIssued) {
        // A 170 ms roll at 690 units/s can travel about 117.3 units; 550 ms at
        // the normal 215 units/s restores about 118.3 units.
        await pulseMovementKey(defender, "w", 550);
      }
      await aimArena(defender, defenderElementId, attackRight ? -200 : 200);
    }
  }
  if (!evidence) evidence = await waitForUiDodgeEvidence(entries, attacker, defender, 600, true, lastAttemptBaseline);
  await sleep(80);
  evidence = await Promise.all(entries.map(readUiEvidence));

  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) throw new Error(`incomplete M36 UI evidence: ${JSON.stringify(evidence)}`);
  const attackDown = attackerResult.pointers.find((event) => event.type === "pointerdown" && event.button === 0);
  const attackUp = attackerResult.pointers.find((event) => event.type === "pointerup" && event.button === 0);
  const movementDelivered = attackerResult.keys.includes(`keydown:${movementCode}`) && attackerResult.keys.includes(`keyup:${movementCode}`);
  const aimDelivered = attackDown && Math.abs(attackDown.y - 0.5) <= 0.15 && (attackRight ? attackDown.x >= 0.6 : attackDown.x <= 0.4);
  if (!movementDelivered || !aimDelivered) throw new Error(`M36 real attacker movement/aim was not delivered: ${JSON.stringify(attackerResult)}`);
  const rollWheel = defenderResult.wheels.find((event) => event.deltaY < 0);
  if (!defenderResult.keys.includes("keydown:KeyS") || !defenderResult.keys.includes("keyup:KeyS") || !rollWheel) throw new Error(`M36 real pointer-directed wheel-roll controls were not delivered: ${JSON.stringify(defenderResult)}`);
  if (!Number.isFinite(attackDown?.epochMs) || !Number.isFinite(attackUp?.epochMs)
    || !Number.isFinite(rollWheel.epochMs)
    || attackDown.epochMs >= attackUp.epochMs
    || attackUp.epochMs - attackDown.epochMs >= 320
    || rollWheel.epochMs <= attackUp.epochMs
    || rollWheel.epochMs - attackUp.epochMs >= COMBAT.attack.windupMs) {
    throw new Error(`M238 dodge never proved one genuine R1 light release BEFORE real wheel inside unchanged windup: ${JSON.stringify({
      attackDown, attackUp, rollWheel,
    })}`);
  }
  if (attackerResult.playerHp !== 100 || attackerResult.playerGuard !== 100 || defenderResult.playerHp !== 100 || defenderResult.playerGuard !== 100) throw new Error(`M36 dodge exchange changed authoritative vitals: ${JSON.stringify(evidence)}`);
  if (attackerResult.feedbackTransitions.includes("parried") || defenderResult.feedbackTransitions.includes("parry-success")) throw new Error(`M36 dodge exchange accidentally resolved as parry: ${JSON.stringify(evidence)}`);
  return evidence;
}

async function runM176BlockAttackArbitrationPhase(
  entries,
  actor,
  peer,
  actorElementId,
  awayOffset,
) {
  const milestone = "M176 block/light arbitration";
  const attackStates = new Set([
    COMBAT_ACTION.attackWindup,
    COMBAT_ACTION.attackActive,
    COMBAT_ACTION.attackRecovery,
    COMBAT_ACTION.attackLeftWindup,
    COMBAT_ACTION.attackLeftActive,
    COMBAT_ACTION.attackLeftRecovery,
    COMBAT_ACTION.attackRightWindup,
    COMBAT_ACTION.attackRightActive,
    COMBAT_ACTION.attackRightRecovery,
  ]);

  const waitForBothIdle = async (timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const states = await Promise.all(entries.map(readUiEvidence));
      const actorState = states.find((entry) => entry.browser === actor.name);
      const peerState = states.find((entry) => entry.browser === peer.name);
      if (actorState?.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle
        && peerState?.acceptance?.ownActionTransitions?.at(-1)?.action === COMBAT_ACTION.idle) {
        return states;
      }
      await sleep(12);
    }
    throw new Error(milestone + " timed out waiting for both clients to recover: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  };

  const baseline = await waitForBothIdle(1500);
  const actorBefore = baseline.find((entry) => entry.browser === actor.name);
  const peerBefore = baseline.find((entry) => entry.browser === peer.name);
  if (!actorBefore || !peerBefore) {
    throw new Error(milestone + " could not resolve browser roles: " + JSON.stringify(baseline));
  }

  const ownOffset = actorBefore.acceptance?.ownActionTransitions?.length ?? 0;
  const focusOffset = peerBefore.acceptance?.focusActionTransitions?.length ?? 0;
  const wheelOffset = actorBefore.wheels.length;
  const pointerOffset = actorBefore.pointers.length;

  await aimArena(actor, actorElementId, awayOffset);
  await performArenaBlockAttackChord(actor, actorElementId, awayOffset, 70);

  const deadline = Date.now() + 700;
  let observed = null;
  while (Date.now() < deadline && !observed) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const actorState = states.find((entry) => entry.browser === actor.name);
    const peerState = states.find((entry) => entry.browser === peer.name);
    const ownActions = actorState?.acceptance?.ownActionTransitions?.slice(ownOffset) ?? [];
    const focusActions = peerState?.acceptance?.focusActionTransitions?.slice(focusOffset) ?? [];
    const localBlock = ownActions.some((entry) => entry.action === COMBAT_ACTION.block);
    const remoteBlock = focusActions.some((entry) => entry.action === COMBAT_ACTION.block);
    if (localBlock && remoteBlock) observed = states;
    else await sleep(12);
  }
  if (!observed) {
    throw new Error(milestone + " did not replicate Block on both browsers: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  const actorObserved = observed.find((entry) => entry.browser === actor.name);
  const peerObserved = observed.find((entry) => entry.browser === peer.name);
  const ownActions = actorObserved?.acceptance?.ownActionTransitions?.slice(ownOffset) ?? [];
  const focusActions = peerObserved?.acceptance?.focusActionTransitions?.slice(focusOffset) ?? [];
  if (ownActions.some((entry) => attackStates.has(entry.action))
    || focusActions.some((entry) => attackStates.has(entry.action))) {
    throw new Error(milestone + " leaked a light attack behind wheel-back: "
      + JSON.stringify({ ownActions, focusActions }));
  }

  const wheels = actorObserved.wheels.slice(wheelOffset).filter((entry) => entry.deltaY > 0);
  const pointers = actorObserved.pointers.slice(pointerOffset).filter((entry) => entry.button === 0);
  const downs = pointers.filter((entry) => entry.type === "pointerdown");
  const ups = pointers.filter((entry) => entry.type === "pointerup");
  if (wheels.length !== 1 || downs.length !== 1 || ups.length !== 1) {
    throw new Error(milestone + " did not record one genuine wheel-back + LMB gesture: "
      + JSON.stringify({ wheels, pointers }));
  }

  await sleep(COMBAT.block.shortBlockMs + 120);
  const finalStates = await waitForBothIdle(900);
  const actorFinal = finalStates.find((entry) => entry.browser === actor.name);
  const peerFinal = finalStates.find((entry) => entry.browser === peer.name);
  const finalOwnActions = actorFinal?.acceptance?.ownActionTransitions?.slice(ownOffset) ?? [];
  const finalFocusActions = peerFinal?.acceptance?.focusActionTransitions?.slice(focusOffset) ?? [];
  if (finalOwnActions.some((entry) => attackStates.has(entry.action))
    || finalFocusActions.some((entry) => attackStates.has(entry.action))) {
    throw new Error(milestone + " serialized a late light attack after block recovery: "
      + JSON.stringify({ finalOwnActions, finalFocusActions }));
  }
  if (actorFinal.playerHp !== actorBefore.playerHp
    || actorFinal.playerGuard !== actorBefore.playerGuard
    || actorFinal.opponentHp !== actorBefore.opponentHp
    || actorFinal.opponentGuard !== actorBefore.opponentGuard
    || peerFinal.playerHp !== peerBefore.playerHp
    || peerFinal.playerGuard !== peerBefore.playerGuard) {
    throw new Error(milestone + " changed combat vitals: " + JSON.stringify(finalStates));
  }

  return finalStates.map((entry) => ({
    ...entry,
    m176BlockAttackArbitration: entry.browser === actor.name ? true : null,
  }));
}


async function calibrateNativeParryIngress(
  attacker, defender, attackerElementId, defenderElementId, attackOffset,
  targetAfterPointerDownMs = 50,
) {
  // Measure only trusted input delivery, never synthesize game controls.
  // Three harmless mouse moves and real isolated wheel-back blocks before
  // the live combat exchange; each 240ms block expires before next probe.
  const measure = async (session, eventKind, issue) => {
    const listener = "const arena=document.querySelector('#arena');"
      + "const probe={receivedEpochMs:null};window.__MYASO_M33_CALIBRATION__=probe;"
      + "arena.addEventListener(" + JSON.stringify(eventKind) + ",event=>{"
      + "if(event.isTrusted && probe.receivedEpochMs===null"
      + (eventKind === "wheel" ? " && event.deltaY>0" : "")
      + ")probe.receivedEpochMs=Date.now();},{capture:true,once:true});";
    await execute(session.base, session.sessionId, listener);
    const issuedAtMs = Date.now();
    await issue();
    let received = null;
    for (let poll = 0; poll < 5 && received === null; poll += 1) {
      received = await execute(session.base, session.sessionId,
        "return window.__MYASO_M33_CALIBRATION__?.receivedEpochMs ?? null;");
      if (received === null) await sleep(10);
    }
    const latencyMs = received - issuedAtMs;
    if (!Number.isFinite(received) || !Number.isFinite(latencyMs)
      || latencyMs < 0 || latencyMs >= 400) {
      throw new Error("M33 trusted input calibration lacked bounded receipt: "
        + JSON.stringify({ browser: session.name, eventKind, issuedAtMs, received }));
    }
    return latencyMs;
  };
  const pointerSamples = [];
  const wheelSamples = [];
  for (let sample = 0; sample < 3; sample += 1) {
    await aimArena(attacker, attackerElementId, attackOffset + (sample % 2 ? -32 : 32));
    const [pointerMs, wheelMs] = await Promise.all([
      measure(attacker, "pointermove",
        () => aimArena(attacker, attackerElementId, attackOffset)),
      measure(defender, "wheel",
        () => scrollArenaWheel(defender, defenderElementId, 120, 0)),
    ]);
    pointerSamples.push(pointerMs);
    wheelSamples.push(wheelMs);
    await sleep(COMBAT.block.shortBlockMs + 130);
  }
  const median = samples => [...samples].sort((a, b) => a - b)[1];
  const pointerMs = median(pointerSamples);
  const wheelMs = median(wheelSamples);
  // M332: The #348 exact-head M41 run #39318597410 recorded genuine
  // Chrome pointerDOWN at 182.9ms and Firefox wheel at 331ms: 148ms
  // later, after the 135ms authoritative light windup. It resolved as
  // 34 HP damage, not a parry, despite the prior 100ms nominal target.
  // The two browser W3C drivers have additional unmodeled latency;
  // aim M33's real wheel 50ms after light pointerDOWN to recover ingress
  // headroom without touching the 125ms server parry or 240ms block.
  // Keep a strict 85ms maximum native calibration target. M138's genuine
  // jump parry still uses its separate 25ms target and 105ms windup.
  // This is browser-acceptance timing only, no synthetic input or retries.
  if (!Number.isFinite(targetAfterPointerDownMs) || targetAfterPointerDownMs < 0
    || targetAfterPointerDownMs > 85) {
    throw new RangeError("native parry arrival target outside strict window");
  }
  const skewMs = Math.max(-180, Math.min(180,
    Math.round(pointerMs + 12 + targetAfterPointerDownMs - wheelMs)));
  const result = { attacker: attacker.name, defender: defender.name,
    pointerSamples, wheelSamples, pointerMs, wheelMs,
    targetAfterPointerDownMs,
    attackLeadMs: Math.max(0, -skewMs), wheelLeadMs: Math.max(0, skewMs) };
  console.log("M33_TRUSTED_W3C_INGRESS_CALIBRATION " + JSON.stringify(result));
  return result;
}

async function waitForM41WorldWindup(attacker, timeoutMs, baselineEventCount, expectedActorId, allowHeavy = false) {
  if (!Number.isInteger(baselineEventCount) || baselineEventCount < 0
      || !Number.isSafeInteger(expectedActorId) || expectedActorId < 1) {
    throw new TypeError("M41 requires a fresh current-attempt actor-bound World cue baseline");
  }
  // M41 source0/native CI: let Chrome observe its OWN unchanged actor-bound
  // production World cue every 4ms. Repeated WebDriver HTTP scalar round
  // trips previously arrived as late as one original 60Hz World contact tick.
  // The ONE genuine Firefox wheel is still dispatched only after a fresh cue,
  // and all native W3C ACK, HP, guard, parry and World assertions remain.
  const cue = await webdriver(attacker.base, "POST",
    `/session/${attacker.sessionId}/execute/async`, {
      script: m41NativeAsyncCueScript(),
      args: [baselineEventCount, expectedActorId, allowHeavy, timeoutMs],
    });
  if (cue?.actorId === expectedActorId
    && Number.isInteger(cue.eventIndex) && cue.eventIndex >= baselineEventCount
    && Number.isFinite(cue.t) && cue.t >= 0 && cue.eventCount > cue.eventIndex
    && (cue.text === "Attack committed - your windup is readable."
      || (allowHeavy && cue.text === "Heavy strike committed - the long windup is readable."))
    && cue.latestText === cue.text) return cue;
  // Preserve the original fail-closed gate; only emit a bounded read-only
  // snapshot when the browser never observed an admissible fresh World cue.
  if (!cue) {
    // Failure-only W3C read; never use this bounded history to authorize a
    // late wheel. Retain the original null timeout and fatal native gate.
    try {
      const diagnostic = await execute(attacker.base, attacker.sessionId,
        "return window.__MYASO_M41_LAST_TIMEOUT__ ?? null;");
      if (diagnostic?.timedOut === true) {
        console.log("M41_NATIVE_CUE_TIMEOUT " + JSON.stringify(diagnostic));
      }
    } catch (error) {
      console.log("M41_NATIVE_CUE_TIMEOUT_READ_ERROR "
        + JSON.stringify({ message: String(error).slice(0, 160) }));
    }
  }
  throw new Error("M41 native attacker never exposed a fresh current-attempt light windup");
}

async function runOnlineUiParryFlight(entries, postParrySleepMs = 80, roles = null) {
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const attackerName = roles?.attackerName ?? "chrome";
  const defenderName = roles?.defenderName ?? "firefox";
  const attacker = entries.find((entry) => entry.name === attackerName);
  const defender = entries.find((entry) => entry.name === defenderName);
  const attackerReady = ready.find((entry) => entry.browser === attacker?.name);
  const defenderReady = ready.find((entry) => entry.browser === defender?.name);
  if (!attacker || !defender || !attackerReady || !defenderReady) throw new Error(`could not resolve M33 UI roles from ${JSON.stringify(ready)}`);
  const attackRight = attackerReady.playerNetId < defenderReady.playerNetId;
  const movementKey = attackRight ? "d" : "a";
  const movementCode = attackRight ? "KeyD" : "KeyA";
  const attackOffset = attackRight ? 200 : -200;

  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const attackerElementId = await resolveArenaElement(attacker, "M33 attacker");
  const defenderElementId = await resolveArenaElement(defender, "M33 defender");
  const visibleArenas = await Promise.all(entries.map(centerArenaInViewport));
  const defenderViewport = visibleArenas[entries.indexOf(defender)];
  await aimArena(defender, defenderElementId, attackRight ? -200 : 200);
  // Calibration is performed in the genuine browser prior to combat,
  // while neither fighter is attacking. Reset observer records afterward so
  // the M33/M41/M146 exchange still has exactly ONE trusted parry wheel.
  const parryIngress = await calibrateNativeParryIngress(
    attacker, defender, attackerElementId, defenderElementId, attackOffset,
  );
  await Promise.all(entries.map(installUiObserver));
  let evidence = null;
  let lastAttemptBaseline = null;
  for (let attempt = 0; attempt < 4 && !evidence; attempt += 1) {
    await pulseMovementKey(attacker, movementKey, attempt === 0 ? 120 : 80);
    lastAttemptBaseline = await Promise.all(entries.map(readUiEvidence));
    // M33/M41/M146: use the same genuinely observed browser latencies that
    // are sampled before combat, not hard-coded Chrome/Firefox host delays.
    // Trusted pointermove and wheel-back are real W3C events; no synthetic
    // event may enter the arena. Stagger the live Firefox/Chrome actions
    // around the measured delivery time, placing the ONE genuine wheel
    // ~50ms nominal after genuine pointerDOWN to leave W3C driver
    // ingress margin before the unchanged 135ms light active transition.
    // M138 retains its separate 25ms jump-attack parry target.
    // R2's light windup begins on authentic LMB RELEASE, not pointerDOWN.
    // Native M146 #39422438963 confirmed Firefox LMB-up at epoch 2749 and
    // Chrome wheel at 2763, yet the hit at server tick 264 arrived ~180ms
    // after wheel: a valid -38 block, outside unchanged 125ms parry window.
    // Move the genuine wheel 95ms later (target ~85ms before impact);
    // continue to reject every block, HP hit, missed/parried input or
    // changed 650ms stun/punish contract as before.
    // M41 e31994b9 native World contact 1691 was BLOCK at 133.3ms defender
    // age: the old 35ms special wait armed its one real wheel too early for
    // the unchanged 125ms parry window. Reuse M35's existing 95ms wait;
    // this shifts ONLY M41's wheel 60ms later. Actual World parry and the
    // exact remote raster/source-frame assertions still qualify the run.
    const releaseToStrikeParryDelayMs = 95;
    // Any actual -38 guard block or 34 HP hit remains a terminal failure.
    if (scenario === "uiparrytell" || scenario === "uistun" || scenario === "uiparry") {
      const attemptAttackerBaseline = lastAttemptBaseline.find((entry) => entry.browser === attacker.name);
      if (!Number.isInteger(attemptAttackerBaseline?.events?.length)) {
        throw new Error("M41 could not record current-attempt original World cue baseline");
      }
      // Aim before the measured exchange. The original 125ms parry is
      // evaluated from the server's REAL Block admission, not the wheel ACK.
      // With physical-wheel source0 submitted directly before RAF, M41's
      // earlier Heavy-charging cue armed Block 133.3ms before HIT (genuine
      // original World BLOCK, outside Parry125). Prearm the SAME actor-bound
      // native watcher, but dispatch the one real wheel only on the actual
      // subsequent Light Windup; never forge a delayed Block admission.
      // No full-click ACK or evidence serialization gates this wheel.
      await aimArena(attacker, attackerElementId, attackOffset);
      const prearmed = (scenario === "uiparrytell" || scenario === "uistun" || scenario === "uiparry")
        ? m35CueRegistry.issue(attemptAttackerBaseline.events.length, attackerReady.playerNetId,
          {allowHeavy: false}) : null;
      if (prearmed) {
        const armed = await webdriver(attacker.base, "POST", `/session/${attacker.sessionId}/execute/sync`, {
          script: m35PrearmedCueScript(),
          args: [prearmed.token, attemptAttackerBaseline.events.length, attackerReady.playerNetId, 180,
            false],
        });
        if (armed !== true) { prearmed.close(); throw new Error("M35 could not arm native Windup observer before physical click"); }
      }
      let observed;
      try {
        observed = await dispatchM41ObservedParry({
          sendAttack: () => performArenaM221GuardBreakClick(attacker, 35),
          awaitWorldCue: () => prearmed ? prearmed.wait() : waitForM41WorldWindup(
            attacker, 180, attemptAttackerBaseline.events.length, attackerReady.playerNetId,
            false,
          ),
          // M33/M41 retain the viewport wheel; M35 retains its element wheel.
          sendWheel: () => (scenario === "uiparrytell" || scenario === "uiparry")
            ? scrollM41ViewportWheel(defender, defenderViewport)
            : setArenaBlock(defender, defenderElementId, true),
        });
      } finally {
        if (prearmed) {
          prearmed.close();
          const diagnostic = await execute(attacker.base, attacker.sessionId,
            "window.__MYASO_M35_CUE_WATCH__?.close(); return window.__MYASO_M41_LAST_TIMEOUT__ ?? null;");
          if (diagnostic?.timedOut === true) console.log("M35_NATIVE_CUE_TIMEOUT " + JSON.stringify(diagnostic));
        }
      }
      console.log("M41_ORIGINAL_WORLD_WINDUP_STAGE " + JSON.stringify({
        scenario, attacker: attacker.name, ...observed,
      }));
    } else {
      await Promise.all([
        (async () => {
          if (parryIngress.attackLeadMs > 0) await sleep(parryIngress.attackLeadMs);
          await performArenaAttackHold(attacker, attackerElementId, attackOffset, 35);
        })(),
        (async () => {
          if (parryIngress.wheelLeadMs > 0) await sleep(parryIngress.wheelLeadMs);
          await sleep(releaseToStrikeParryDelayMs);
          await setArenaBlock(defender, defenderElementId, true);
        })(),
      ]);
    }
    evidence = await waitForUiParryEvidence(entries, attacker, defender, 350, false, lastAttemptBaseline);
    if (!evidence) {
      const after = await Promise.all(entries.map(readUiEvidence));
      const stagedAttacker = after.find((entry) => entry.browser === attacker.name);
      const stagedDefender = after.find((entry) => entry.browser === defender.name);
      const attackerBefore = lastAttemptBaseline.find((entry) => entry.browser === attacker.name);
      const defenderBefore = lastAttemptBaseline.find((entry) => entry.browser === defender.name);
      // Never replay a resolved but unsuccessful parry: any real HP/guard
      // change, a heavy commitment, or death remains a fatal red gate.
      const pristine = stagedAttacker?.playerHp === attackerBefore?.playerHp
        && stagedAttacker?.playerGuard === attackerBefore?.playerGuard
        && stagedDefender?.playerHp === defenderBefore?.playerHp
        && stagedDefender?.playerGuard === defenderBefore?.playerGuard
        && !stagedAttacker?.events.some((entry) => entry.startsWith("Heavy strike committed"))
        && !stagedDefender?.events.some((entry) => entry.startsWith("Hit taken"))
        && !stagedAttacker?.events.some((entry) => entry.startsWith("Opponent hit"));
      if (!pristine) {
        // Failure-only original-World provenance; no changes to the physical
        // W3C wheel, 125ms Parry window, fatal gate or replay policy.
        const diagnostic = inspectM35ParryFirstRed({
          worldLog: m201ServerOutput(),
          attackerId: attackerReady.playerNetId,
          defenderId: defenderReady.playerNetId,
          inputSubmissions: stagedDefender?.acceptance?.inputSubmissions,
        });
        console.error("M35_ORIGINAL_WORLD_FIRST_RED " + JSON.stringify(diagnostic));
        throw new Error("M33 genuine short-click parry resolved unexpectedly: " + JSON.stringify(after));
      }
      await sleep(260);
    }
  }
  if (!evidence) evidence = await waitForUiParryEvidence(entries, attacker, defender, 800, true, lastAttemptBaseline);

  if (postParrySleepMs > 0) await sleep(postParrySleepMs);
  evidence = await Promise.all(entries.map(readUiEvidence));
  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) throw new Error(`incomplete M33 UI evidence: ${JSON.stringify(evidence)}`);
  const attackDown = attackerResult.pointers.find((event) => event.type === "pointerdown" && event.button === 0);
  const blockWheel = defenderResult.wheels.find((event) => event.deltaY > 0);
  if (!attackerResult.keys.includes(`keydown:${movementCode}`) || !attackerResult.keys.includes(`keyup:${movementCode}`)) {
    throw new Error(`M33 real attacker movement control was not delivered: ${JSON.stringify(attackerResult)}`);
  }
  const attackAimValid = attackDown && Math.abs(attackDown.y - 0.5) <= 0.15 && (attackRight ? attackDown.x >= 0.6 : attackDown.x <= 0.4);
  if (!attackAimValid) throw new Error(`M33 real attacker aim was not delivered: ${JSON.stringify(attackerResult)}`);
  if (!blockWheel) throw new Error(`M33 real wheel-back directional parry input was not delivered: ${JSON.stringify(defenderResult)}`);
  return evidence;
}

async function runOnlineUiParryPunishFfaFocusFlight(entries, convert = false) {
  const milestone = convert ? "M150 actionable FFA parry punish" : "M147 parry punish FFA focus";
  const expectedScenario = convert ? "uiparrypunishffahit" : "uiparrypunishffa";
  if (entries.length !== 3) {
    throw new Error(`${milestone} expected three real browser clients, received ${entries.length}`);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const ordered = ready.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const attacker = entries.find((entry) => entry.name === ordered[0]?.browser);
  const defender = entries.find((entry) => entry.name === ordered[1]?.browser);
  const closerIdle = entries.find((entry) => entry.name === ordered[2]?.browser);
  if (!attacker || !defender || !closerIdle) {
    throw new Error(`${milestone} could not map deterministic FFA roles: ${JSON.stringify(ready)}`);
  }

  const attackerId = ordered[0].playerNetId;
  const defenderId = ordered[1].playerNetId;
  const closerId = ordered[2].playerNetId;
  await waitForUiThreePlayerReady(entries, [attackerId, defenderId, closerId], 2500);
  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  await Promise.all(entries.map(centerArenaInViewport));

  // Stage #3 mostly below #2 instead of directly between #1 and #2. This
  // keeps #3 as Firefox's ordinary nearest rival while placing it outside
  // #1's unchanged 94-unit light-hit radius (76 reach + 18 fighter radius).
  await pulseMovementKey(closerIdle, "s", 380);
  await pulseMovementKey(closerIdle, "a", 450);
  await sleep(80);
  let baseline = await Promise.all(entries.map(readUiEvidence));
  let defenderBefore = baseline.find((entry) => entry.browser === defender.name);
  for (let attempt = 0; attempt < (convert ? 0 : 4) && defenderBefore?.focusLabel !== `NEAREST #${closerId}`; attempt += 1) {
    // M321: genuine W3C correction must not activate the R2 240ms dash,
    // including across the two nearest-focus staging correction loops.
    await sleep(300);
    await pulseMovementKey(closerIdle, "w", 30);
    await sleep(60);
    baseline = await Promise.all(entries.map(readUiEvidence));
    defenderBefore = baseline.find((entry) => entry.browser === defender.name);
  }
  if (!convert && defenderBefore?.focusLabel !== `NEAREST #${closerId}`) {
    throw new Error(`${milestone} did not establish #${closerId} as ordinary nearest focus: ${JSON.stringify(baseline)}`);
  }

  // Install fresh observers only after staging so the focus transition proof
  // begins from NEAREST #3 rather than recording setup movement noise.
  await Promise.all(entries.map(installUiObserver));
  const attackerElementId = await resolveArenaElement(attacker, milestone);
  const defenderElementId = await resolveArenaElement(defender, milestone);
  const attackRight = attackerId < defenderId;
  const movementKey = attackRight ? "d" : "a";
  const movementCode = attackRight ? "KeyD" : "KeyA";
  const attackOffset = attackRight ? 200 : -200;
  await aimArena(defender, defenderElementId, attackRight ? -200 : 200);

  // Close #1 into parry range. If that movement would make #1 geometrically
  // nearer than #3, pull #3 inward again before the parry commitment.
  // Keep #1 just inside the unchanged 94-unit light-hit envelope rather
  // than over-closing the lane. This leaves a larger perpendicular safety
  // margin for the nearer idle #3, which must remain focusable by #2 without
  // entering #1's light cone under loaded browser scheduling.
  await pulseMovementKey(attacker, movementKey, 60);
  await sleep(60);
  let staged = await Promise.all(entries.map(readUiEvidence));
  let stagedDefender = staged.find((entry) => entry.browser === defender.name);
  for (let attempt = 0; attempt < (convert ? 0 : 3) && stagedDefender?.focusLabel !== `NEAREST #${closerId}`; attempt += 1) {
    // M321: genuine W3C correction must not activate the R2 240ms dash,
    // including across the two nearest-focus staging correction loops.
    await sleep(300);
    await pulseMovementKey(closerIdle, "w", 30);
    await sleep(50);
    staged = await Promise.all(entries.map(readUiEvidence));
    stagedDefender = staged.find((entry) => entry.browser === defender.name);
  }
  if (!convert && stagedDefender?.focusLabel !== `NEAREST #${closerId}`) {
    throw new Error(`${milestone} could not preserve #${closerId} as nearer idle rival before parry: ${JSON.stringify(staged)}`);
  }

  // M150: use server-replicated positions, not an assumed 30ms/key pulse,
  // for the authentic three-player conversion. No injected world positions:
  // each correction is one real W3C WASD press; samples arrive via ordinary
  // authoritative WebTransport snapshots. Leave M147's original staging alone.
  if (convert) {
    const relativeTarget = (defenderFighter, id) => ({
      x: defenderFighter.x + (id === attackerId ? (attackRight ? -88 : 88) : 0),
      y: defenderFighter.y + (id === attackerId ? 0 : 60),
    });
    const moveToReplicatedTarget = async (client, ownId, label) => {
      let last = null;
      for (let step = 0; step < 18; step += 1) {
        const sample = await readUiEvidence(defender);
        const fighters = sample.acceptance?.fighters ?? [];
        const own = fighters.find((f) => f.netId === ownId);
        const anchor = fighters.find((f) => f.netId === defenderId);
        if (!own || !anchor || ![own.x, own.y, anchor.x, anchor.y].every(Number.isFinite)) {
          throw new Error(`${milestone} missing authoritative geometry for ${label}: ${JSON.stringify(sample.acceptance)}`);
        }
        const target = relativeTarget(anchor, ownId);
        const dx = target.x - own.x;
        const dy = target.y - own.y;
        last = { own, anchor, target, dx, dy, step };
        if (Math.abs(dx) <= 4 && Math.abs(dy) <= 4) return last;
        const horizontal = Math.abs(dx) >= Math.abs(dy);
        const delta = horizontal ? dx : dy;
        const key = horizontal ? (delta > 0 ? "d" : "a") : (delta > 0 ? "s" : "w");
        const holdMs = Math.max(35, Math.min(175,
          Math.round(Math.abs(delta) / COMBAT.moveSpeed * 1000 * 0.75)));
        await pulseMovementKey(client, key, holdMs);
        // Deliberately beyond the 240ms genuine R2 double-tap dash window;
        // a staging correction must not secretly become a combat dash.
        await sleep(260);
      }
      throw new Error(`${milestone} could not stage ${label} against replicated fighter coordinates: ${JSON.stringify(last)}`);
    };
    await moveToReplicatedTarget(attacker, attackerId, "parried attacker");
    await moveToReplicatedTarget(closerIdle, closerId, "closer idle rival");
    await sleep(75);
    staged = await Promise.all(entries.map(readUiEvidence));
    stagedDefender = staged.find((entry) => entry.browser === defender.name);
    const fighters = stagedDefender?.acceptance?.fighters ?? [];
    const defenderFighter = fighters.find((f) => f.netId === defenderId);
    const attackerFighter = fighters.find((f) => f.netId === attackerId);
    const closerFighter = fighters.find((f) => f.netId === closerId);
    const geometry = qualifyM150ParryGeometry({
      attacker: attackerFighter, defender: defenderFighter, closer: closerFighter,
      reach: COMBAT.attack.reach, radius: COMBAT.fighterRadius,
    });
    if (!geometry.qualified || stagedDefender?.focusLabel !== `NEAREST #${closerId}`) {
      throw new Error(`${milestone} authoritative three-way spacing not qualified: ${JSON.stringify({
        ...geometry, fighters, focus: stagedDefender?.focusLabel,
      })}`);
    }
  }

  const attackerBefore = staged.find((entry) => entry.browser === attacker.name);
  const closerBefore = staged.find((entry) => entry.browser === closerIdle.name);
  if (!attackerBefore || !closerBefore) {
    throw new Error(`${milestone} incomplete staged evidence: ${JSON.stringify(staged)}`);
  }
  const attackPointerOffset = attackerBefore.pointers.length;
  const defenderWheelOffset = stagedDefender.wheels.length;
  const focusOffset = stagedDefender.focusTransitions.length;
  const recoveryOffset = stagedDefender.recoveryTransitions.length;

  // R1 shared controls: a short left click commits its genuine light on
  // pointerUP; the old M150 down -> wheel -> 190ms -> up sequence could
  // miss the commitment or charge a HEAVY on a delayed W3C release.
  // Keep the exact three-player geometry, parry cue and strict 34HP
  // target isolation checks. No synthetic events or second attack.
  await performArenaAttackHold(attacker, attackerElementId, attackOffset, 75);
  await sleep(55);
  await setArenaBlock(defender, defenderElementId, true);
  const parryEvidence = await waitForUiParryEvidence(entries, attacker, defender, 520, true, staged);

  let attackerState = parryEvidence.find((entry) => entry.browser === attacker.name);
  let defenderState = parryEvidence.find((entry) => entry.browser === defender.name);
  let closerState = parryEvidence.find((entry) => entry.browser === closerIdle.name);
  if (!attackerState || !defenderState || !closerState) {
    throw new Error(`${milestone} incomplete parry evidence: ${JSON.stringify(parryEvidence)}`);
  }

  let focusTransitions = defenderState.focusTransitions.slice(focusOffset);
  let recoveryTransitions = defenderState.recoveryTransitions.slice(recoveryOffset);
  let parryFocusIndex = focusTransitions.findIndex((entry) => entry.label === `PARRY PUNISH #${attackerId}`);
  let parryCue = recoveryTransitions.find((entry) =>
    entry.visible
    && entry.state === "parry-stun"
    && entry.label === "PUNISH"
    && entry.detail === "Parry stun");

  const parryDeadline = Date.now() + 220;
  while ((parryFocusIndex < 0 || !parryCue) && Date.now() < parryDeadline) {
    await sleep(12);
    const states = await Promise.all(entries.map(readUiEvidence));
    defenderState = states.find((entry) => entry.browser === defender.name);
    attackerState = states.find((entry) => entry.browser === attacker.name);
    closerState = states.find((entry) => entry.browser === closerIdle.name);
    focusTransitions = defenderState.focusTransitions.slice(focusOffset);
    recoveryTransitions = defenderState.recoveryTransitions.slice(recoveryOffset);
    parryFocusIndex = focusTransitions.findIndex((entry) => entry.label === `PARRY PUNISH #${attackerId}`);
    parryCue = recoveryTransitions.find((entry) =>
      entry.visible
      && entry.state === "parry-stun"
      && entry.label === "PUNISH"
      && entry.detail === "Parry stun");
  }
  if (parryFocusIndex < 0 || !parryCue) {
    throw new Error(`${milestone} did not override the closer idle rival with the parried attacker: ${JSON.stringify({
      focusTransitions,
      recoveryTransitions,
      defenderState,
    })}`);
  }
  if (focusTransitions.some((entry) => entry.label === `PARRY PUNISH #${closerId}`)) {
    throw new Error(`${milestone} falsely marked idle #${closerId} as a parry punish target: ${JSON.stringify(focusTransitions)}`);
  }

  let stunTransition = null;
  let punishPointerOffset = -1;
  if (convert) {
    stunTransition = (attackerState.acceptance?.ownActionTransitions ?? [])
      .filter((entry) => entry.action === COMBAT_ACTION.stunned)
      .at(-1);
    if (!Number.isFinite(stunTransition?.epochMs) || COMBAT.block.parryStunMs !== 650) {
      throw new Error(`${milestone} did not capture the unchanged authoritative parry stun: ${JSON.stringify({ stunTransition, parryStunMs: COMBAT.block.parryStunMs })}`);
    }

    const beforePunish = await readUiEvidence(defender);
    punishPointerOffset = beforePunish.pointers.length;
    const punishOffset = attackRight ? -200 : 200;
    await aimArena(defender, defenderElementId, punishOffset);
    const targetInputEpochMs = stunTransition.epochMs + 250;
    const waitMs = Math.max(0, targetInputEpochMs - Date.now());
    if (waitMs > 0) await sleep(waitMs);

    // Commit one genuine LMB early enough in the unchanged 650 ms parry stun
    // that the normal light windup can resolve before #1 returns to idle.
    await performArenaAttackHold(defender, defenderElementId, punishOffset, 90);

    let hitEvidence = null;
    const hitDeadline = Date.now() + 520;
    while (Date.now() < hitDeadline) {
      const states = await Promise.all(entries.map(readUiEvidence));
      const currentAttacker = states.find((entry) => entry.browser === attacker.name);
      const currentDefender = states.find((entry) => entry.browser === defender.name);
      const currentCloser = states.find((entry) => entry.browser === closerIdle.name);
      if (currentAttacker?.playerHp === 66
        && currentDefender?.playerHp === 100
        && currentCloser?.playerHp === 100) {
        hitEvidence = states;
        break;
      }
      if ((Number.isFinite(currentAttacker?.playerHp) && currentAttacker.playerHp < 66)
        || (Number.isFinite(currentDefender?.playerHp) && currentDefender.playerHp < 100)
        || (Number.isFinite(currentCloser?.playerHp) && currentCloser.playerHp < 100)) {
        throw new Error(`${milestone} punish damaged the wrong fighter or hit more than once: ${JSON.stringify(states)}`);
      }
      await sleep(12);
    }
    if (!hitEvidence) {
      throw new Error(`${milestone} did not convert the selected parry target into exactly one 34 HP punish: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
    }
    attackerState = hitEvidence.find((entry) => entry.browser === attacker.name);
    defenderState = hitEvidence.find((entry) => entry.browser === defender.name);
    closerState = hitEvidence.find((entry) => entry.browser === closerIdle.name);
  }

  // Wait for the unchanged 650 ms parry stun to expire. The HUD must restore
  // the ordinary closer rival and clear the parry-punish cue.
  const clearDeadline = Date.now() + COMBAT.block.parryStunMs + 320;
  let finalEvidence = null;
  while (Date.now() < clearDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const currentDefender = states.find((entry) => entry.browser === defender.name);
    const currentAttacker = states.find((entry) => entry.browser === attacker.name);
    const currentCloser = states.find((entry) => entry.browser === closerIdle.name);
    if (currentDefender?.focusLabel === `NEAREST #${closerId}`
      && !currentDefender.recoveryVisible
      && currentAttacker?.acceptance?.ownActionTransitions?.some((entry) =>
        entry.action === COMBAT_ACTION.idle
        && Number.isFinite(entry.epochMs))
      && currentCloser?.playerHp === 100) {
      finalEvidence = states;
      break;
    }
    await sleep(16);
  }
  if (!finalEvidence) {
    throw new Error(`${milestone} did not restore ordinary nearest focus after parry stun: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
  }

  attackerState = finalEvidence.find((entry) => entry.browser === attacker.name);
  defenderState = finalEvidence.find((entry) => entry.browser === defender.name);
  closerState = finalEvidence.find((entry) => entry.browser === closerIdle.name);
  focusTransitions = defenderState.focusTransitions.slice(focusOffset);
  const returnIndex = focusTransitions.findIndex((entry, index) =>
    index > parryFocusIndex && entry.label === `NEAREST #${closerId}`);
  if (returnIndex <= parryFocusIndex) {
    throw new Error(`${milestone} focus did not return from parry target to closer idle rival: ${JSON.stringify(focusTransitions)}`);
  }

  const attackPointers = attackerState.pointers.slice(attackPointerOffset);
  const attackDowns = attackPointers.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
  const attackUps = attackPointers.filter((entry) => entry.type === "pointerup" && entry.button === 0);
  const attackDown = attackDowns[0];
  const attackUp = attackUps[0];
  const blockWheel = defenderState.wheels.slice(defenderWheelOffset).find((entry) => entry.deltaY > 0);
  const attackAimValid = attackDown
    && Math.abs(attackDown.y - 0.5) <= 0.15
    && (attackRight ? attackDown.x >= 0.6 : attackDown.x <= 0.4);
  const authenticShortLight = attackDowns.length === 1 && attackUps.length === 1
    && Number.isFinite(attackDown?.epochMs) && Number.isFinite(attackUp?.epochMs)
    && attackUp.epochMs > attackDown.epochMs
    && attackUp.epochMs - attackDown.epochMs < 320;
  if (!attackerState.keys.includes(`keydown:${movementCode}`)
    || !attackerState.keys.includes(`keyup:${movementCode}`)
    || !attackAimValid || !authenticShortLight || !blockWheel) {
    throw new Error(`${milestone} lacked genuine attack / wheel-back parry provenance: ${JSON.stringify({ attackerState, defenderState })}`);
  }

  if (!attackerState.feedbackTransitions.includes("parried")
    || !defenderState.feedbackTransitions.includes("parry-success")) {
    throw new Error(`${milestone} lost authoritative parry feedback: ${JSON.stringify(finalEvidence)}`);
  }
  if (closerState.acceptance?.scenario !== expectedScenario
    || closerState.acceptance.playerNetId !== closerId) {
    throw new Error(`${milestone} third-client acceptance hook was not active: ${JSON.stringify(closerState.acceptance)}`);
  }

  if (convert) {
    if (attackerState.playerHp !== 66 || attackerState.playerGuard !== 100
      || defenderState.playerHp !== 100 || defenderState.playerGuard !== 100
      || closerState.playerHp !== 100 || closerState.playerGuard !== 100) {
      throw new Error(`${milestone} did not land exactly one 34 HP punish on the selected parried fighter: ${JSON.stringify(finalEvidence)}`);
    }
    const punishPointers = defenderState.pointers.slice(punishPointerOffset);
    const punishDowns = punishPointers.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
    const punishUps = punishPointers.filter((entry) => entry.type === "pointerup" && entry.button === 0);
    const punishDown = punishDowns[0];
    const punishAimValid = punishDown
      && Math.abs(punishDown.y - 0.5) <= 0.15
      && (attackRight ? punishDown.x <= 0.4 : punishDown.x >= 0.6);
    if (punishDowns.length !== 1 || punishUps.length !== 1 || !punishAimValid
      || !Number.isFinite(punishDown?.epochMs)
      || punishDown.epochMs < stunTransition.epochMs
      || punishDown.epochMs - stunTransition.epochMs > 500) {
      throw new Error(`${milestone} genuine punish input was not aimed at #${attackerId} inside the parry stun: ${JSON.stringify({ punishPointers, stunTransition })}`);
    }
    if (!defenderState.events.includes("Opponent hit - 34 HP.")
      || !attackerState.events.includes("Hit taken - 34 HP.")
      || closerState.events.includes("Hit taken - 34 HP.")) {
      throw new Error(`${milestone} authoritative damage feedback did not identify only the parried fighter: ${JSON.stringify(finalEvidence)}`);
    }
  } else if (finalEvidence.some((entry) => entry.playerHp !== 100 || entry.playerGuard !== 100)) {
    throw new Error(`${milestone} did not preserve a clean authoritative parry with untouched vitals: ${JSON.stringify(finalEvidence)}`);
  }

  return finalEvidence.map((entry) => ({
    ...entry,
    ...(convert
      ? { m150ParriedId: attackerId, m150DefenderId: defenderId, m150CloserIdleId: closerId }
      : { m147ParriedId: attackerId, m147DefenderId: defenderId, m147CloserIdleId: closerId }),
  }));
}

async function runOnlineUiParryPunishWindowFlight(entries) {
  const milestone = "M146 delayed parry punish";
  // Keep the latency-sensitive wheel defender on Chrome. M33 retains its
  // established Chrome-attacker / Firefox-defender path; M146 only needs a
  // clean authoritative parry before proving the late punish window.
  const attacker = entries.find((entry) => entry.name === "firefox");
  const defender = entries.find((entry) => entry.name === "chrome");
  if (!attacker || !defender) throw new Error(`${milestone} could not resolve Firefox attacker / Chrome defender`);

  const parryEvidence = await runOnlineUiParryFlight(entries, 0, {
    attackerName: "firefox",
    defenderName: "chrome",
  });
  let attackerState = parryEvidence.find((entry) => entry.browser === attacker.name);
  let defenderState = parryEvidence.find((entry) => entry.browser === defender.name);
  if (!attackerState || !defenderState) {
    throw new Error(`${milestone} incomplete parry evidence: ${JSON.stringify(parryEvidence)}`);
  }

  const attackerTransitions = attackerState.acceptance?.ownActionTransitions ?? [];
  const stunTransition = attackerTransitions.filter((entry) => entry.action === COMBAT_ACTION.stunned).at(-1);
  if (attackerState.acceptance?.scenario !== "uiparrypunishwindow"
    || defenderState.acceptance?.scenario !== "uiparrypunishwindow"
    || !Number.isFinite(stunTransition?.epochMs)) {
    throw new Error(`${milestone} did not capture authoritative stun timing: ${JSON.stringify(parryEvidence)}`);
  }
  if (COMBAT.block.parryStunMs !== 650) {
    throw new Error(`${milestone} expected unchanged 650 ms parry stun, observed ${COMBAT.block.parryStunMs}`);
  }

  const baselineAttackerHp = attackerState.playerHp;
  const baselineAttackerGuard = attackerState.playerGuard;
  const baselineDefenderHp = defenderState.playerHp;
  const baselineDefenderGuard = defenderState.playerGuard;
  const expectedAttackerHp = baselineAttackerHp - COMBAT.attack.damage;
  const defenderElementId = await resolveArenaElement(defender, milestone);
  await centerArenaInViewport(defender);
  const attackRight = attackerState.acceptance.playerNetId < defenderState.acceptance.playerNetId;
  const punishOffset = attackRight ? -200 : 200;
  await aimArena(defender, defenderElementId, punishOffset);

  const beforePunish = await readUiEvidence(defender);
  const pointerOffset = beforePunish.pointers.length;
  const targetInputEpochMs = stunTransition.epochMs + 370;
  const waitMs = Math.max(0, targetInputEpochMs - Date.now());
  if (waitMs > 0) await sleep(waitMs);

  // This is intentionally not an immediate parry punish. A real LMB begins
  // roughly 370 ms into the unchanged 650 ms stun, leaving the normal 135 ms
  // light windup enough room to connect while the attacker is still committed.
  await performArenaAttackHold(defender, defenderElementId, punishOffset, 90);

  let evidence = null;
  const deadline = Date.now() + 650;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const currentAttacker = states.find((entry) => entry.browser === attacker.name);
    const currentDefender = states.find((entry) => entry.browser === defender.name);
    if (currentAttacker?.playerHp === expectedAttackerHp
      && currentDefender?.opponentHp === expectedAttackerHp) {
      evidence = states;
      break;
    }
    if ((Number.isFinite(currentAttacker?.playerHp) && currentAttacker.playerHp < expectedAttackerHp)
      || (Number.isFinite(currentDefender?.playerHp) && currentDefender.playerHp !== baselineDefenderHp)
      || (Number.isFinite(currentAttacker?.playerGuard) && currentAttacker.playerGuard !== baselineAttackerGuard)
      || (Number.isFinite(currentDefender?.playerGuard) && currentDefender.playerGuard !== baselineDefenderGuard)) {
      throw new Error(`${milestone} resolved unexpected combat while waiting for delayed punish: ${JSON.stringify(states)}`);
    }
    await sleep(12);
  }
  if (!evidence) {
    throw new Error(`${milestone} delayed real LMB did not land before stun expired: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
  }

  attackerState = evidence.find((entry) => entry.browser === attacker.name);
  defenderState = evidence.find((entry) => entry.browser === defender.name);
  const punishPointers = defenderState.pointers.slice(pointerOffset);
  const punishDowns = punishPointers.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
  const punishUps = punishPointers.filter((entry) => entry.type === "pointerup" && entry.button === 0);
  const punishDown = punishDowns[0];
  const punishDelayMs = Number.isFinite(punishDown?.epochMs)
    ? punishDown.epochMs - stunTransition.epochMs
    : NaN;
  const punishAimValid = punishDown
    && Math.abs(punishDown.y - 0.5) <= 0.15
    && (attackRight ? punishDown.x <= 0.4 : punishDown.x >= 0.6);
  if (punishDowns.length !== 1 || punishUps.length !== 1 || !punishAimValid
    || !Number.isFinite(punishDelayMs) || punishDelayMs < 340 || punishDelayMs > 470) {
    throw new Error(`${milestone} punish was not one genuine late-window LMB: ${JSON.stringify({
      stunTransition,
      punishDelayMs,
      punishPointers,
    })}`);
  }

  const finalTransitions = attackerState.acceptance?.ownActionTransitions ?? [];
  const prematureIdle = finalTransitions.find((entry) =>
    entry.action === COMBAT_ACTION.idle
    && Number.isFinite(entry.epochMs)
    && entry.epochMs > stunTransition.epochMs
    && entry.epochMs <= punishDown.epochMs);
  if (prematureIdle) {
    throw new Error(`${milestone} punish input arrived only after authoritative stun ended: ${JSON.stringify({
      stunTransition,
      punishDown,
      prematureIdle,
      finalTransitions,
    })}`);
  }

  const latestStunned = finalTransitions.findIndex((entry) =>
    entry.action === COMBAT_ACTION.stunned && entry.epochMs === stunTransition.epochMs);
  if (latestStunned < 0) {
    throw new Error(`${milestone} lost the authoritative parry-stun transition: ${JSON.stringify(finalTransitions)}`);
  }
  if (attackerState.playerHp !== expectedAttackerHp
    || attackerState.playerGuard !== baselineAttackerGuard
    || attackerState.opponentHp !== baselineDefenderHp
    || attackerState.opponentGuard !== baselineDefenderGuard
    || defenderState.playerHp !== baselineDefenderHp
    || defenderState.playerGuard !== baselineDefenderGuard
    || defenderState.opponentHp !== expectedAttackerHp
    || defenderState.opponentGuard !== baselineAttackerGuard) {
    throw new Error(`${milestone} did not resolve exactly one additional 34-damage punish with unchanged defender/guard state: ${JSON.stringify({
      baselineAttackerHp,
      baselineAttackerGuard,
      baselineDefenderHp,
      baselineDefenderGuard,
      expectedAttackerHp,
      evidence,
    })}`);
  }
  if (!defenderState.events.includes("Opponent hit - 34 HP.")
    || !attackerState.events.includes("Hit taken - 34 HP.")) {
    throw new Error(`${milestone} delayed punish feedback was not authoritative: ${JSON.stringify(evidence)}`);
  }
  if (!attackerState.feedbackTransitions.includes("parried")
    || !defenderState.feedbackTransitions.includes("parry-success")) {
    throw new Error(`${milestone} lost the authoritative parry proof before the punish: ${JSON.stringify(evidence)}`);
  }

  // Read-only M216: record only after M146 proves the real wheel parry,
  // server-authoritative 650ms stun, one late LMB, exact 34HP and both cues.
  // All subtractions below involve the same Chrome defender browser observer.
  console.log("M216_PARRY_PUNISH_FEEDBACK_LATENCY " + JSON.stringify(
    summarizeM216ParryPunishLatency({
      sameBrowserClock: true,
      wheels: defenderState.wheels,
      eventTransitions: defenderState.eventTransitions,
      pointers: defenderState.pointers,
      focusActionTransitions: defenderState.acceptance?.focusActionTransitions,
      stunnedAction: COMBAT_ACTION.stunned,
    }),
  ));

  return evidence.map((entry) => ({
    ...entry,
    m146ParryStunEpochMs: entry.browser === attacker.name ? stunTransition.epochMs : null,
    m146PunishEpochMs: entry.browser === defender.name ? punishDown.epochMs : null,
    m146PunishDelayMs: entry.browser === defender.name ? punishDelayMs : null,
  }));
}

// M255: M41's native parry can finish one animation frame before its raster
// effect becomes visible. Sample the actual completed canvas frames for a
// bounded 350ms; never substitute an action/HUD label for >=24 real pixels.
async function awaitParryTellRaster(observer, parriedLocal, timeoutMs = 350) {
  const deadline = Date.now() + timeoutMs;
  let observerMax = 0;
  let localMax = 0;
  do {
    const [observedPixels, localPixels] = await Promise.all([
      readParryTellSampler(observer),
      readParryTellSampler(parriedLocal),
    ]);
    observerMax = Math.max(observerMax, observedPixels);
    localMax = Math.max(localMax, localPixels);
    if (observerMax >= 24) break;
    if (Date.now() >= deadline) break;
    await sleep(20);
  } while (true);
  return [observerMax, localMax];
}

async function runOnlineUiParryTellFlight(entries) {
  const observer = entries.find((entry) => entry.name === "firefox");
  const parriedLocal = entries.find((entry) => entry.name === "chrome");
  if (!observer || !parriedLocal) throw new Error("M41 could not resolve Firefox observer / Chrome parried fighter");

  const armed = await Promise.all([
    armParryTellSampler(observer),
    armParryTellSampler(parriedLocal),
  ]);
  if (armed.some((status) => status !== true)) {
    throw new Error("M41 failed to arm real canvas observers: " + JSON.stringify(armed));
  }
  let evidence;
  let tell;
  try {
    evidence = await runOnlineUiParryFlight(entries);
    const [observerMax, localMax] = await awaitParryTellRaster(observer, parriedLocal);
    if (observerMax < 24) {
      // M254: fail with read-only frame sampling and authentic combat/HUD
      // state; do not substitute HUD labels for >=24 actual raster pixels.
      const [observerSampler, localSampler, currentEvidence] = await Promise.all([
        readParryTellSamplerDiagnostics(observer),
        readParryTellSamplerDiagnostics(parriedLocal),
        Promise.all(entries.map(readUiEvidence)),
      ]);
      const summary = currentEvidence.map((state) => ({
        browser: state.browser,
        playerNetId: state.playerNetId,
        playerHp: state.playerHp,
        playerGuard: state.playerGuard,
        feedbackTransitions: state.feedbackTransitions?.slice(-6),
        focusTransitions: state.focusTransitions?.slice(-6),
        recoveryTransitions: state.recoveryTransitions?.slice(-6),
        eventTransitions: state.eventTransitions?.slice(-8),
      }));
      throw new Error(`M41 remote parry-stun tell never appeared: observer=${observerMax} local=${localMax} diagnostics=${JSON.stringify({ observerSampler, localSampler, summary })}`);
    }
    if (localMax !== 0) {
      throw new Error(`M41 local parried fighter painted the remote-only tell: ${localMax}`);
    }
    tell = { observerMax, localMax };
  } finally {
    await Promise.all(entries.map(stopParryTellSampler));
  }
  await waitForParryTellClear(observer, 1200);
  return evidence.map((entry) => ({
    ...entry,
    parryTellMaxPixels: entry.browser === observer.name ? tell.observerMax : tell.localMax,
  }));
}

async function runOnlineUiBlockFacingTellFlight(entries) {
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const observer = entries.find((entry) => entry.name === "chrome");
  const defender = entries.find((entry) => entry.name === "firefox");
  const observerReady = ready.find((entry) => entry.browser === observer?.name);
  const defenderReady = ready.find((entry) => entry.browser === defender?.name);
  if (!observer || !defender || !observerReady || !defenderReady) throw new Error(`M42 could not resolve Chrome observer / Firefox blocker: ${JSON.stringify(ready)}`);

  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const defenderElementId = await resolveArenaElement(defender, "M42 defender");
  await Promise.all(entries.map(centerArenaInViewport));
  const aimOffset = defenderReady.playerNetId > observerReady.playerNetId ? -200 : 200;
  await aimArena(defender, defenderElementId, aimOffset);

  // The wheel-back short block lasts 240 ms, often less than several
  // headless WebDriver round trips. Start canvas-frame capture before the
  // genuine wheel and preserve the original remote-only pixel assertion.
  await Promise.all(entries.map(armBlockFacingTellSampler));
  let tell;
  try {
    await setArenaBlock(defender, defenderElementId, true);
    await sleep(COMBAT.block.shortBlockMs + 100);
    const [observerMax, localMax] = await Promise.all([
      readBlockFacingTellSampler(observer),
      readBlockFacingTellSampler(defender),
    ]);
    if (observerMax < 24 || localMax !== 0) {
      throw new Error(`M42 remote-only block-facing pixels incorrect: observer=${observerMax} local=${localMax}`);
    }
    tell = { observerMax, localMax };
  } finally {
    await setArenaBlock(defender, defenderElementId, false);
    await Promise.allSettled(entries.map(stopBlockFacingTellSampler));
  }
  await waitForBlockFacingTellClear(observer, 1000);

  const evidence = await Promise.all(entries.map(readUiEvidence));
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  const blockWheel = defenderResult?.wheels.find((event) => event.deltaY > 0);
  if (!blockWheel) throw new Error(`M42 real wheel-back directional block input was not delivered: ${JSON.stringify(defenderResult)}`);
  return evidence.map((entry) => ({ ...entry, blockFacingTellMaxPixels: entry.browser === observer.name ? tell.observerMax : tell.localMax }));
}

async function runOnlineUiDodgeTellFlight(entries) {
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const observer = entries.find((entry) => entry.name === "chrome");
  const dodger = entries.find((entry) => entry.name === "firefox");
  const observerReady = ready.find((entry) => entry.browser === observer?.name);
  const dodgerReady = ready.find((entry) => entry.browser === dodger?.name);
  if (!observer || !dodger || !observerReady || !dodgerReady) throw new Error(`M43 could not resolve Chrome observer / Firefox dodger: ${JSON.stringify(ready)}`);

  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  await Promise.all(entries.map(centerArenaInViewport));
  await Promise.all([armDodgeTellSampler(observer, true), armDodgeTellSampler(dodger, false)]);
  let tell = null;
  try {
    // Reuse the exact real-input choreography already proven by M36. Headless
    // Firefox can occasionally deliver the DOM key events while its animation
    // frame is stalled, so retry the real Dodge request rather than injecting
    // state or weakening the spatial-pixel requirement.
    for (let attempt = 0; attempt < 3 && !tell; attempt += 1) {
      await pressArenaPerpendicularDodgeAfterPause(dodger, 0);
      tell = await waitForRemoteDodgeTell(entries, observer, dodger, 700, false);
      if (!tell) await sleep(120);
    }
    if (!tell) tell = await waitForRemoteDodgeTell(entries, observer, dodger, 300, true);
  } finally {
    await Promise.all(entries.map(stopDodgeTellSampler));
  }
  await waitForDodgeTellClear(observer, 1000);

  const evidence = await Promise.all(entries.map(readUiEvidence));
  const observerResult = evidence.find((entry) => entry.browser === observer.name);
  const dodgerResult = evidence.find((entry) => entry.browser === dodger.name);
  if (!observerResult || !dodgerResult) throw new Error(`M43 incomplete UI evidence: ${JSON.stringify(evidence)}`);
  const controlsDelivered = dodgerResult.keys.includes("keydown:KeyS") && dodgerResult.keys.includes("keyup:KeyS")
    && dodgerResult.wheels.some((event) => event.deltaY < 0);
  if (!controlsDelivered) throw new Error(`M43 real wheel-roll controls were not delivered: ${JSON.stringify(dodgerResult)}`);
  if (observerResult.playerHp !== 100 || observerResult.playerGuard !== 100 || dodgerResult.playerHp !== 100 || dodgerResult.playerGuard !== 100) {
    throw new Error(`M43 dodge tell flight changed authoritative vitals: ${JSON.stringify(evidence)}`);
  }
  return evidence.map((entry) => ({ ...entry, dodgeTellMaxPixels: entry.browser === observer.name ? tell.observerMax : tell.localMax }));
}

async function runOnlineUiStunOverlayFlight(entries) {
  let evidence = await runOnlineUiParryFlight(entries);
  let attacker = evidence.find((entry) => entry.feedbackTransitions.includes("parried"));
  let defender = evidence.find((entry) => entry.feedbackTransitions.includes("parry-success"));
  if (!attacker || !defender || attacker.browser === defender.browser) {
    throw new Error(`M35 could not resolve parried attacker / parrying defender: ${JSON.stringify(evidence)}`);
  }
  const showedStun = attacker.overlayTransitions.some((entry) => entry.visible && entry.title === "STUNNED" && entry.detail === "Punish window open.");
  if (!showedStun) throw new Error(`M35 attacker never rendered authoritative stunned overlay: ${JSON.stringify(attacker.overlayTransitions)}`);
  if (defender.overlayTransitions.some((entry) => entry.visible && entry.title === "STUNNED")) {
    throw new Error(`M35 defender incorrectly rendered stunned overlay: ${JSON.stringify(defender.overlayTransitions)}`);
  }
  if (attacker.overlayTransitions.some((entry) => entry.visible && entry.title === "DEFEATED")) {
    throw new Error(`M35 stun lifecycle was confused with defeat: ${JSON.stringify(attacker.overlayTransitions)}`);
  }

  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    evidence = await Promise.all(entries.map(readUiEvidence));
    attacker = evidence.find((entry) => entry.browser === attacker.browser);
    if (attacker && !attacker.overlayVisible) break;
    await sleep(40);
  }
  evidence = await Promise.all(entries.map(readUiEvidence));
  attacker = evidence.find((entry) => entry.feedbackTransitions.includes("parried"));
  if (!attacker || attacker.overlayVisible || attacker.overlayTransitions.at(-1)?.visible !== false) {
    throw new Error(`M35 stunned overlay did not clear on authoritative recovery: ${JSON.stringify(attacker)}`);
  }
  return evidence;
}

// The original M110/M111 test must generate a real LMB release-heavy, never
// resurrect the retired Key E producer. This hold clears browser + server
// READY320ms; the original World still decides actual damage and guard loss.
async function performM110NativeHeldLmb(session, elementId, xOffset) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "pointer", id: `mouse-${session.name}`,
      parameters: { pointerType: "mouse" },
      actions: [
        { type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 },
        { type: "pointerDown", button: 0 },
        { type: "pause", duration: M110_LMB_HEAVY_HOLD_MS },
        { type: "pointerUp", button: 0 },
      ],
    }],
  });
}

async function runOnlineUiHeavyGuardBreakFlight(entries, { returnTiming = false, onAcceptedLiveBreak = null } = {}) {
  const staged = await prepareHeavyCounterplayFlight(
    entries,
    "M110 heavy guard break",
    { attackerName: "chrome", defenderName: "firefox", movementMs: 180 },
  );
  const { attacker, defender, attackerElementId, defenderElementId, movementCode } = staged;
  const attackRight = movementCode === "KeyD";
  const attackOffset = attackRight ? 200 : -200;
  const blockOffset = attackRight ? -200 : 200;
  let firstEvidence = null;
  let finalEvidence = null;
  let blockHeld = false;
  let secondHeavyIssuedAt = null;

  const heavyCommitCount = (state) => state.events.filter((text) =>
    text.startsWith("Heavy strike committed")).length;
  const heavyWindupCount = (state) => state.threatTransitions.filter((entry) =>
    entry.visible && entry.phase === "HEAVY WINDUP").length;
  const performHeavyIntoObservedShortBlock = async (windupsBefore) => {
    // Genuine physical LMB is held beyond 320ms READY and deliberately released.
    // Retain TWO genuine wheel-back events and their original 240ms short-block
    // windows. Place the second early enough to age past the 125ms parry phase
    // before the release-led heavy impact, while the guard window remains live.
    // The original World, not these W3C ACKs, decides all HIT/guard outcomes.
    const heavyPulse = performM110NativeHeldLmb(attacker, attackerElementId, attackOffset);
    const blockPulse = scrollArenaWheelPair(defender, defenderElementId, 120, 220, 100);
    let observed = false;
    try {
      const deadline = Date.now() + 420;
      while (Date.now() < deadline) {
        const state = await readUiEvidence(defender);
        if (heavyWindupCount(state) > windupsBefore) {
          observed = true;
          break;
        }
        await sleep(10);
      }
    } finally {
      await Promise.all([heavyPulse, blockPulse]);
    }
    return observed;
  };

  try {
    blockHeld = true;

    for (let attempt = 1; attempt <= 3 && !firstEvidence; attempt += 1) {
      const before = await Promise.all(entries.map(readUiEvidence));
      const beforeAttacker = before.find((entry) => entry.browser === attacker.name);
      const beforeDefender = before.find((entry) => entry.browser === defender.name);
      if (!beforeAttacker || !beforeDefender) {
        throw new Error(`M110 first heavy missing baseline: ${JSON.stringify(before)}`);
      }
      const commitsBefore = heavyCommitCount(beforeAttacker);
      const windupsBefore = heavyWindupCount(beforeDefender);

      await performHeavyIntoObservedShortBlock(windupsBefore);
      await sleep(300);
      const states = await Promise.all(entries.map(readUiEvidence));
      const attackerState = states.find((entry) => entry.browser === attacker.name);
      const defenderState = states.find((entry) => entry.browser === defender.name);
      if (!attackerState || !defenderState) {
        throw new Error(`M110 first heavy incomplete evidence on attempt ${attempt}: ${JSON.stringify(states)}`);
      }
      const commitsAfter = heavyCommitCount(attackerState);
      const firstBlocked = attackerState.playerHp === 100 && attackerState.playerGuard === 100
        && defenderState.playerHp === 100 && defenderState.playerGuard === 36
        && attackerState.opponentHp === 100 && attackerState.opponentGuard === 36
        && commitsAfter === commitsBefore + 1;
      if (firstBlocked) {
        firstEvidence = states;
        break;
      }

      const cleanLatchMiss = attackerState.playerHp === 100 && attackerState.playerGuard === 100
        && defenderState.playerHp === 100 && defenderState.playerGuard === 100
        && attackerState.opponentHp === 100 && attackerState.opponentGuard === 100
        && commitsAfter === commitsBefore
        && !attackerState.feedbackTransitions.includes("parried")
        && !defenderState.feedbackTransitions.includes("parry-success");
      if (!cleanLatchMiss) {
        throw new Error(`M110 first heavy attempt ${attempt} resolved unexpectedly: ${JSON.stringify(states)}`);
      }
      if (attempt < 3) {
        await Promise.all([
          aimArena(attacker, attackerElementId, attackOffset),
          aimArena(defender, defenderElementId, blockOffset),
        ]);
        await sleep(60);
      }
    }

    if (!firstEvidence) {
      throw new Error("M110 first blocked heavy did not resolve after bounded clean latch retries");
    }
    const firstAttacker = firstEvidence.find((entry) => entry.browser === attacker.name);
    const firstDefender = firstEvidence.find((entry) => entry.browser === defender.name);
    if (!firstAttacker?.events.includes("Opponent blocked - guard -64.")
      || !firstDefender?.events.includes("Block held - guard -64.")) {
      throw new Error(`M110 first heavy was not authoritative 64 guard pressure: ${JSON.stringify(firstEvidence)}`);
    }
    if (firstAttacker.feedbackTransitions.includes("parried")
      || firstDefender.feedbackTransitions.includes("parry-success")) {
      throw new Error(`M110 first heavy accidentally resolved as parry: ${JSON.stringify(firstEvidence)}`);
    }

    // Await original heavy active/recovery after the physical LMB release;
    // never reissue during the single server-owned charged gesture.
    await sleep(500);
    await Promise.all([
      aimArena(attacker, attackerElementId, attackOffset),
      aimArena(defender, defenderElementId, blockOffset),
    ]);
    await sleep(40);

    for (let attempt = 1; attempt <= 3 && !finalEvidence; attempt += 1) {
      const before = await Promise.all(entries.map(readUiEvidence));
      const beforeAttacker = before.find((entry) => entry.browser === attacker.name);
      const beforeDefender = before.find((entry) => entry.browser === defender.name);
      if (!beforeAttacker || !beforeDefender
        || beforeDefender.playerGuard <= 0 || beforeDefender.playerGuard >= 64) {
        throw new Error(`M110 short-block sequence did not preserve breakable guard pressure before second heavy: ${JSON.stringify(before)}`);
      }
      const guardBeforeSecond = beforeDefender.playerGuard;
      const commitsBefore = heavyCommitCount(beforeAttacker);
      const windupsBefore = heavyWindupCount(beforeDefender);

      const attemptIssuedAt = Date.now();
      await performHeavyIntoObservedShortBlock(windupsBefore);
      await sleep(300);
      let states = await Promise.all(entries.map(readUiEvidence));
      let attackerState = states.find((entry) => entry.browser === attacker.name);
      let defenderState = states.find((entry) => entry.browser === defender.name);
      if (!attackerState || !defenderState) {
        throw new Error(`M110 second heavy incomplete evidence on attempt ${attempt}: ${JSON.stringify(states)}`);
      }

      // The defender can render authoritative guard break one snapshot before the
      // attacker's remote view converges to guard 0. Once the local defender is
      // already broken, wait a bounded interval for the opposite client rather
      // than misclassifying that mixed snapshot as an impossible resolution.
      if (defenderState.playerGuard === 0 && attackerState.opponentGuard !== 0) {
        const convergenceDeadline = Date.now() + 240;
        while (Date.now() < convergenceDeadline) {
          await sleep(20);
          const converged = await Promise.all(entries.map(readUiEvidence));
          const nextAttacker = converged.find((entry) => entry.browser === attacker.name);
          const nextDefender = converged.find((entry) => entry.browser === defender.name);
          if (!nextAttacker || !nextDefender) break;
          states = converged;
          attackerState = nextAttacker;
          defenderState = nextDefender;
          if (attackerState.opponentGuard === 0 && defenderState.playerGuard === 0) break;
        }
      }

      const commitsAfter = heavyCommitCount(attackerState);
      const guardBroken = attackerState.playerHp === 100 && attackerState.playerGuard === 100
        && defenderState.playerHp === 100 && defenderState.playerGuard === 0
        && attackerState.opponentHp === 100 && attackerState.opponentGuard === 0
        && commitsAfter === commitsBefore + 1;
      if (guardBroken) {
        // Anchor punish timing to a *real* native LMB pointerDOWN, not a
        // retired Key E event, a WebDriver ACK or an invented server HIT.
        if (returnTiming) {
          const downs = (attackerState.pointers ?? []).filter((event) =>
            event.type === "pointerdown" && event.button === 0
            && Number.isFinite(event.epochMs)
            && event.epochMs >= attemptIssuedAt - 100);
          if (downs.length !== 1) {
            throw new Error("M111 requires exactly one newly trusted physical LMB DOWN: "
              + JSON.stringify({ attemptIssuedAt, downs }));
          }
          secondHeavyIssuedAt = downs[0].epochMs;
          console.log("M111_NATIVE_HEAVY_ORIGIN " + JSON.stringify({
            downEpochMs: secondHeavyIssuedAt, physicalSource: "LMB",
          }));
        }
        finalEvidence = states;
        break;
      }

      const cleanLatchMiss = attackerState.playerHp === 100 && attackerState.playerGuard === 100
        && defenderState.playerHp === 100 && defenderState.playerGuard >= guardBeforeSecond
        && attackerState.opponentHp === 100 && attackerState.opponentGuard >= guardBeforeSecond
        && commitsAfter === commitsBefore
        && !attackerState.feedbackTransitions.includes("parried")
        && !defenderState.feedbackTransitions.includes("parry-success");
      if (!cleanLatchMiss) {
        throw new Error(`M110 second heavy attempt ${attempt} resolved unexpectedly: ${JSON.stringify(states)}`);
      }
      if (attempt < 3) {
        await Promise.all([
          aimArena(attacker, attackerElementId, attackOffset),
          aimArena(defender, defenderElementId, blockOffset),
        ]);
        await sleep(60);
      }
    }

    if (!finalEvidence) {
      throw new Error("M110 second blocked heavy did not break guard after bounded clean latch retries");
    }

    // Keep sampling while the authoritative guard-break stun is live so both
    // the feedback and visible STUNNED transition are captured.
    const deadline = Date.now() + 260;
    while (Date.now() < deadline) {
      const states = await Promise.all(entries.map(readUiEvidence));
      const attackerState = states.find((entry) => entry.browser === attacker.name);
      const defenderState = states.find((entry) => entry.browser === defender.name);
      const feedbackReady = attackerState?.events.includes("Opponent guard broken - punish.")
        && defenderState?.events.includes("Guard broken - you are vulnerable.")
        && attackerState?.feedbackTransitions.includes("guard-break-confirm")
        && defenderState?.feedbackTransitions.includes("guard-broken");
      const defenderStunned = defenderState?.overlayTransitions.some((entry) =>
        entry.visible && entry.title === "STUNNED");
      if (feedbackReady && defenderStunned) {
        finalEvidence = states;
        // Genuine server guard break + defender STUNNED already attested.
        // Pre-arm exactly one real Chrome W3C action before slow extra reads.
        if (returnTiming && typeof onAcceptedLiveBreak === "function") {
          onAcceptedLiveBreak(secondHeavyIssuedAt);
        }
        break;
      }
      await sleep(20);
    }
  } finally {
    if (blockHeld) await setArenaBlock(defender, defenderElementId, false);
  }

  // In pre-armed M111 only, preserve the actual attested LIVE M110 snapshot
  // rather than queue another Chrome WebDriver read behind its genuine click.
  // Standalone M110 remains unchanged and re-reads both real browsers.
  const evidence = returnTiming && onAcceptedLiveBreak
    ? finalEvidence : await Promise.all(entries.map(readUiEvidence));
  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) {
    throw new Error(`M110 heavy guard break incomplete final evidence: ${JSON.stringify(evidence)}`);
  }
  if (!attackerResult.keys.includes(`keydown:${movementCode}`)
    || !attackerResult.keys.includes(`keyup:${movementCode}`)) {
    throw new Error("M110 actual movement keys not observed: " + JSON.stringify(attackerResult.keys));
  }
  const heavyDowns = attackerResult.pointers.filter((event) =>
    event.type === "pointerdown" && event.button === 0).length;
  const heavyUps = attackerResult.pointers.filter((event) =>
    event.type === "pointerup" && event.button === 0).length;
  const retiredKeyE = attackerResult.keys.some((key) => key.includes("KeyE"));
  const authoritativeCommits = heavyCommitCount(attackerResult);
  const blockWheels = defenderResult.wheels.filter((event) => event.deltaY > 0);
  if (retiredKeyE || heavyDowns !== 2 || heavyUps !== 2
    || authoritativeCommits !== 2 || blockWheels.length < 2) {
    throw new Error(`M110 did not prove two real heavies into timed wheel-back blocks: ${JSON.stringify(evidence)}`);
  }
  if (attackerResult.playerHp !== 100 || attackerResult.playerGuard !== 100
    || defenderResult.playerHp !== 100 || defenderResult.playerGuard !== 0) {
    throw new Error(`M110 guard break did not preserve HP and exhaust guard: ${JSON.stringify(evidence)}`);
  }
  if (!attackerResult.events.includes("Opponent blocked - guard -64.")
    || !defenderResult.events.includes("Block held - guard -64.")
    || !attackerResult.events.includes("Opponent guard broken - punish.")
    || !defenderResult.events.includes("Guard broken - you are vulnerable.")) {
    throw new Error(`M110 authoritative heavy guard-pressure feedback was incomplete: ${JSON.stringify(evidence)}`);
  }
  if (!attackerResult.feedbackTransitions.includes("block-confirm")
    || !defenderResult.feedbackTransitions.includes("guard-pressure")
    || !attackerResult.feedbackTransitions.includes("guard-break-confirm")
    || !defenderResult.feedbackTransitions.includes("guard-broken")) {
    throw new Error(`M110 heavy guard-break readability was incomplete: ${JSON.stringify(evidence)}`);
  }
  const defenderStunned = defenderResult.overlayTransitions.some((entry) =>
    entry.visible && entry.title === "STUNNED");
  const attackerStunned = attackerResult.overlayTransitions.some((entry) =>
    entry.visible && entry.title === "STUNNED");
  if (!defenderStunned || attackerStunned) {
    throw new Error(`M110 authoritative stun ownership was wrong: ${JSON.stringify(evidence)}`);
  }
  if (attackerResult.feedbackTransitions.includes("parried")
    || defenderResult.feedbackTransitions.includes("parry-success")) {
    throw new Error(`M110 held block accidentally resolved as parry: ${JSON.stringify(evidence)}`);
  }
  if (returnTiming) {
    if (!Number.isFinite(secondHeavyIssuedAt)) {
      throw new Error("M110 timing metadata missing accepted second-heavy issuance");
    }
    return { evidence, secondHeavyIssuedAt };
  }
  return evidence;
}

async function runOnlineUiHeavyGuardBreakPunishFlight(entries) {
  const attacker = entries.find((entry) => entry.name === "chrome");
  const defender = entries.find((entry) => entry.name === "firefox");
  if (!attacker || !defender) throw new Error("M111 could not resolve fixed heavy guard-break roles");
  let genuineNativePunish = null;
  const guardBreakResult = await runOnlineUiHeavyGuardBreakFlight(entries, {
    returnTiming: true,
    onAcceptedLiveBreak: (trustedSecondLmbDownEpoch) => {
      if (genuineNativePunish || !Number.isFinite(trustedSecondLmbDownEpoch)) {
        throw new Error("M111 requires exactly one native held-LMB heavy before W3C punish");
      }
      // Physical held LMB remains READY until real release; recovery starts
      // afterwards. Keep the full World recovery and original 60ms margin.
      const secondHeavyIssuedAt = trustedSecondLmbDownEpoch;
      const elapsedSinceHeavyIssue = Date.now() - secondHeavyIssuedAt;
      const firstClickTargetMs = M110_LMB_HEAVY_HOLD_MS
        + COMBAT.heavyAttack.activeMs + COMBAT.heavyAttack.recoveryMs + 60;
      const initialPauseMs = Math.max(0, firstClickTargetMs - elapsedSinceHeavyIssue);
      genuineNativePunish = performArenaAttackBurst(attacker, 1, initialPauseMs, 0)
        .then(() => ({ ok: true }), error => ({ ok: false, error }));
    },
  });
  const { evidence: guardBreakEvidence, secondHeavyIssuedAt } = guardBreakResult;

  const baselineAttacker = guardBreakEvidence.find((entry) => entry.browser === attacker.name);
  const baselineDefender = guardBreakEvidence.find((entry) => entry.browser === defender.name);
  if (!baselineAttacker || !baselineDefender
    || baselineDefender.playerHp !== 100 || baselineDefender.playerGuard !== 0
    || !baselineDefender.overlayVisible || baselineDefender.overlayTitle !== "STUNNED") {
    throw new Error(`M111 did not inherit a live clean M110 guard break: ${JSON.stringify(guardBreakEvidence)}`);
  }

  const lightHitsBefore = baselineAttacker.events.filter((text) =>
    text === "Opponent hit - 34 HP.").length;
  const damageBefore = baselineDefender.events.filter((text) =>
    text === "Hit taken - 34 HP.").length;
  const lightThreatsBefore = baselineDefender.threatTransitions.filter((entry) =>
    entry.visible && (entry.phase === "WINDUP" || entry.phase === "STRIKE")).length;

  // M111 pre-armed exactly one real WebDriver click from accepted M110 while
  // defender's live guard-break STUNNED state is still authoritatively visible.
  if (!genuineNativePunish || !Number.isFinite(secondHeavyIssuedAt)) {
    throw new Error("M111 could not pre-arm genuine W3C after attested guard break");
  }
  // The in-page observer timestamps both event-text and overlay mutations. That
  // provides stronger ordering evidence than repeated WebDriver reads and does
  // not perturb Firefox while the real Chrome action sequence is executing.
  // A single authentic short LMB release must hit exactly once. The former
  // nine-tap burst mixed repeated charged-hold flags with releases and CI
  // #39412048012 resolved an unintended 46HP heavy instead of 34HP light.
  // Preserve all stun, HP, parry and recovery fail-closed proofs below.
  const genuineNativeResult = await genuineNativePunish;
  if (!genuineNativeResult.ok) throw genuineNativeResult.error;

  const attackerDeadline = Date.now() + 260;
  let attackerResult = null;
  while (Date.now() < attackerDeadline) {
    const state = await readUiEvidence(attacker);
    const hit = state.events.filter((text) =>
      text === "Opponent hit - 34 HP.").length === lightHitsBefore + 1;
    if (hit && state.opponentHp === 66) {
      attackerResult = state;
      break;
    }
    await sleep(5);
  }

  let defenderResult = await readUiEvidence(defender);
  if (!attackerResult) {
    const failed = await readUiEvidence(attacker);
    const guardBreak = [...(failed.eventTransitions ?? [])].reverse()
      .find((event) => event.text === "Opponent guard broken - punish.");
    const pointerUp = [...(failed.pointers ?? [])].reverse()
      .find((event) => event.button === 0 && event.type === "pointerup");
    const originalSend = failed.m111InputPlane?.submitted ?? [];
    const physicalUpEpoch = pointerUp?.epochMs ?? null;
    // Original M111 34HP/66HP/real stun/punish requirements remain strict.
    // This diagnostic never claims a HIT or changes original W3C action timing.
    const forensic = {
      guardBreakObservedAtEpochMs: guardBreak?.epochMs ?? null,
      physicalPointerUpEpochMs: physicalUpEpoch,
      guardBreakToPointerUpMs: Number.isFinite(physicalUpEpoch)
        && Number.isFinite(guardBreak?.epochMs)
        ? physicalUpEpoch - guardBreak.epochMs : null,
      originalWorldGuardBreakStunMs: COMBAT.block.guardBreakStunMs,
      originalWorldLightWindupMs: COMBAT.attack.windupMs,
      originalClickHoldMs: 10,
      physicalTerminals: failed.m111InputPlane?.physicalTerminals ?? [],
      originalLightReleases: failed.m111InputPlane?.lightReleases ?? [],
      actual30HzAttackSubmissionsNearLightRelease: originalSend.filter((item) =>
        item.attack && Number.isFinite(physicalUpEpoch)
        && item.epochMs >= physicalUpEpoch - 70
        && item.epochMs <= physicalUpEpoch + 220),
      sampledClientFramesNearPointerUp: Number.isFinite(physicalUpEpoch)
        ? originalSend.filter((item) =>
            Math.abs(item.epochMs - physicalUpEpoch) <= 220)
        : originalSend.slice(-18),
      originalObserverHasWorldHit: failed.events.includes("Opponent hit - 34 HP."),
    };
    throw new Error(`M111 attacker never confirmed exactly one real 34 HP light punish: ${JSON.stringify({ forensic, ui: failed })}`);
  }

  // Let the defender receive the same authoritative damage snapshot before
  // evaluating its persistent transition history. The observer timestamps are
  // recorded in-page when each UI mutation occurs, so this bounded wait does
  // not blur the ordering between the hit and the STUNNED interval.
  const defenderConvergenceDeadline = Date.now() + 260;
  while (Date.now() < defenderConvergenceDeadline) {
    const damageCount = defenderResult.events.filter((text) =>
      text === "Hit taken - 34 HP.").length;
    const damageTransitionReady = defenderResult.eventTransitions.some((entry) =>
      entry.text === "Hit taken - 34 HP." && Number.isFinite(entry.t) && entry.t > 0);
    if (damageCount === damageBefore + 1 && defenderResult.playerHp === 66 && damageTransitionReady) break;
    await sleep(5);
    defenderResult = await readUiEvidence(defender);
  }
  const defenderDamageCount = defenderResult.events.filter((text) =>
    text === "Hit taken - 34 HP.").length;
  const damageTransition = [...defenderResult.eventTransitions].reverse().find((entry) =>
    entry.text === "Hit taken - 34 HP." && Number.isFinite(entry.t) && entry.t > 0);
  if (defenderDamageCount !== damageBefore + 1 || defenderResult.playerHp !== 66 || !damageTransition) {
    throw new Error(`M111 defender did not converge to one timestamped 34 HP punish: ${JSON.stringify(defenderResult)}`);
  }

  const stunStarts = defenderResult.overlayTransitions.filter((entry) =>
    entry.visible && entry.title === "STUNNED" && Number.isFinite(entry.t));
  const stunStart = stunStarts.at(-1);
  const stunEnd = stunStart
    ? defenderResult.overlayTransitions.find((entry) =>
      !entry.visible && entry.title === "STUNNED" && Number.isFinite(entry.t) && entry.t >= stunStart.t)
    : null;
  const hitDuringStun = Boolean(stunStart
    && damageTransition.t >= stunStart.t
    && (!stunEnd || damageTransition.t <= stunEnd.t));
  if (!hitDuringStun) {
    throw new Error(`M111 timestamped browser evidence placed the 34 HP punish outside STUNNED: ${JSON.stringify({ damageTransition, stunStart, stunEnd, eventTransitions: defenderResult.eventTransitions, overlayTransitions: defenderResult.overlayTransitions })}`);
  }

  // Never count client HUD damage as a real punish if original Rust World
  // delivered the same 34HP after victim Stunned7 -> Idle0. Combat4D's
  // independent exact server tick classifier is fail-closed; leave ALL
  // existing browser STUNNED/HP/pointer/W3C predicates unchanged.
  // Wait only for passive original loopback M201 stun-exit log if the hit
  // landed legitimately BEFORE exit; no extra inputs or simulation writes.
  console.log("M111_NATIVE_INPUT_CHRONOLOGY " + JSON.stringify({
    secondHeavyIssuedAt,
    keyTransitions: attackerResult.keyTransitions,
    pointers: attackerResult.pointers,
    ownActionTransitions: attackerResult.acceptance?.ownActionTransitions,
    inputPlane: attackerResult.m111InputPlane,
  }));
  const worldDeadline = Date.now() + 950;
  let originalWorld = { status: "INDETERMINATE", reason: "waiting for original World exit" };
  while (Date.now() < worldDeadline) {
    originalWorld = classifyGuardBreakPunishWorld(m201ServerOutput());
    if (originalWorld.status !== "INDETERMINATE") break;
    await sleep(15);
  }
  console.log("M111_ORIGINAL_WORLD_STUN_PROOF " + JSON.stringify(originalWorld));
  if (originalWorld.status !== "WITHIN_STUN") {
    throw new Error("M111 real original World 34HP was not inside server STUNNED: " + JSON.stringify(originalWorld));
  }

  const lightThreatsAfter = defenderResult.threatTransitions.filter((entry) =>
    entry.visible && (entry.phase === "WINDUP" || entry.phase === "STRIKE")).length;
  if (lightThreatsAfter <= lightThreatsBefore) {
    throw new Error(`M111 defender never observed the real light threat before the punish: ${JSON.stringify(defenderResult.threatTransitions)}`);
  }
  if (attackerResult.playerHp !== 100 || attackerResult.playerGuard !== 100
    || attackerResult.opponentHp !== 66 || defenderResult.playerHp !== 66) {
    throw new Error(`M111 post-break punish did not preserve exact HP ownership: ${JSON.stringify([attackerResult, defenderResult])}`);
  }

  const lightDowns = attackerResult.pointers.filter((event) =>
    event.type === "pointerdown" && event.button === 0);
  if (lightDowns.length < 1) {
    throw new Error(`M111 real light pointer control was not delivered: ${JSON.stringify(attackerResult)}`);
  }
  const heavyRecoverySeen = defenderResult.recoveryTransitions.some((entry) =>
    entry.visible && entry.state === "heavy-attack-recovery"
      && entry.label === "PUNISH" && entry.detail === "Heavy recovery");
  if (!heavyRecoverySeen) {
    throw new Error(`M111 defender never observed the second heavy recovery: ${JSON.stringify(defenderResult.recoveryTransitions)}`);
  }
  if (attackerResult.feedbackTransitions.includes("parried")
    || defenderResult.feedbackTransitions.includes("parry-success")
    || defenderResult.feedbackTransitions.includes("dodge-success")) {
    throw new Error(`M111 punish resolved through an unintended defensive fallback: ${JSON.stringify([attackerResult, defenderResult])}`);
  }

  return [
    attackerResult,
    {
      ...defenderResult,
      punishObservedWhileStunned: true,
      punishDamageAtMs: damageTransition.t,
      punishStunStartedAtMs: stunStart.t,
      punishStunClearedAtMs: stunEnd?.t ?? null,
      punishLightThreatTransitions: lightThreatsAfter - lightThreatsBefore,
    },
  ];
}

async function runOnlineUiGuardBreakPunishFfaFocusFlight(entries, convert = false) {
  const milestone = convert ? "M152 actionable FFA guard-break punish" : "M151 guard-break punish FFA focus";
  const expectedScenario = convert ? "uiguardbreakpunishffahit" : "uiguardbreakpunishffa";
  if (entries.length !== 3) {
    throw new Error(milestone + " expected three real browser clients, received " + entries.length);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const attacker = entries.find((entry) => entry.name === "chrome");
  const defender = entries.find((entry) => entry.name === "firefox");
  const closerIdle = entries.find((entry) => entry.name === "chrome2");
  const attackerReady = ready.find((entry) => entry.browser === attacker?.name);
  const defenderReady = ready.find((entry) => entry.browser === defender?.name);
  const closerReady = ready.find((entry) => entry.browser === closerIdle?.name);
  if (!attacker || !defender || !closerIdle || !attackerReady || !defenderReady || !closerReady) {
    throw new Error(milestone + " could not resolve deterministic FFA roles: " + JSON.stringify(ready));
  }
  const attackerId = attackerReady.playerNetId;
  const defenderId = defenderReady.playerNetId;
  const closerId = closerReady.playerNetId;
  await waitForUiThreePlayerReady(entries, [attackerId, defenderId, closerId], 2500);
  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  await Promise.all(entries.map(centerArenaInViewport));

  // Keep #3 idle and uninvolved. Deterministic closer-rival override is covered
  // by the unit gate; this real-browser flight proves three-player attribution.
  // M152 injects its single punish press from the first guard=0 snapshot, before
  // the slower readability convergence path consumes the 90 ms recovery buffer.
  let conversionPlan = null;
  const evidence = await runOnlineUiGuardBreakFlight(entries, {
    onGuardBroken: convert ? async ({ states, attackerElementId, attackOffset }) => {
      let timingStates = states;
      let liveAttacker = timingStates.find((entry) => entry.browser === attacker.name);
      let liveDefender = timingStates.find((entry) => entry.browser === defender.name);
      let attackerActions = liveAttacker?.acceptance?.ownActionTransitions ?? [];
      let defenderActions = liveDefender?.acceptance?.ownActionTransitions ?? [];
      let guardBreakStunTransition = defenderActions
        .filter((entry) => entry.action === COMBAT_ACTION.stunned && Number.isFinite(entry.epochMs))
        .at(-1);
      let guardBreakRecovery = guardBreakStunTransition
        ? attackerActions
          .filter((entry) => entry.action === COMBAT_ACTION.attackRecovery
            && Number.isFinite(entry.epochMs)
            && entry.epochMs >= guardBreakStunTransition.epochMs)
          .at(-1)
        : null;

      // Authority can expose the defender's zero-guard stun a few ticks before
      // the guard-breaking light itself reaches attackRecovery on the attacker.
      // Wait for that *same* strike's recovery transition instead of reusing the
      // previous attack recovery and firing the buffered punish too early.
      const recoveryDeadline = Date.now() + 240;
      while ((!guardBreakStunTransition || !guardBreakRecovery) && Date.now() < recoveryDeadline) {
        await sleep(8);
        timingStates = await Promise.all(entries.map(readUiEvidence));
        liveAttacker = timingStates.find((entry) => entry.browser === attacker.name);
        liveDefender = timingStates.find((entry) => entry.browser === defender.name);
        attackerActions = liveAttacker?.acceptance?.ownActionTransitions ?? [];
        defenderActions = liveDefender?.acceptance?.ownActionTransitions ?? [];
        guardBreakStunTransition = defenderActions
          .filter((entry) => entry.action === COMBAT_ACTION.stunned && Number.isFinite(entry.epochMs))
          .at(-1);
        guardBreakRecovery = guardBreakStunTransition
          ? attackerActions
            .filter((entry) => entry.action === COMBAT_ACTION.attackRecovery
              && Number.isFinite(entry.epochMs)
              && entry.epochMs >= guardBreakStunTransition.epochMs)
            .at(-1)
          : null;
      }
      if (!liveAttacker || !liveDefender || !guardBreakRecovery || !guardBreakStunTransition) {
        throw new Error(milestone + " did not capture the guard-breaking strike recovery timing: "
          + JSON.stringify({ attackerActions, defenderActions }));
      }

      const bufferLeadMs = Math.max(10, COMBAT.inputBuffer.lightAttackWindowMs - 5);
      const targetInputEpochMs = guardBreakRecovery.epochMs + COMBAT.attack.recoveryMs - bufferLeadMs;
      conversionPlan = {
        punishPointerOffset: liveAttacker.pointers.length,
        guardBreakRecovery,
        guardBreakStunTransition,
        targetInputEpochMs,
      };

      const waitMs = Math.max(0, targetInputEpochMs - Date.now());
      if (waitMs > 0) await sleep(waitMs);
      if (Date.now() >= guardBreakStunTransition.epochMs + COMBAT.block.guardBreakStunMs - COMBAT.attack.windupMs) {
        throw new Error(milestone + " missed the buffered light-punish input window: "
          + JSON.stringify(conversionPlan));
      }

      // A single genuine LMB edge inside the last 90 ms of attack recovery is
      // buffered by the combat model and begins as soon as recovery completes.
      await performArenaAttackHold(attacker, attackerElementId, attackOffset, 60);
    } : null,
  });
  let attackerState = evidence.find((entry) => entry.browser === attacker.name);
  let defenderState = evidence.find((entry) => entry.browser === defender.name);
  let closerState = evidence.find((entry) => entry.browser === closerIdle.name);
  if (!attackerState || !defenderState || !closerState) {
    throw new Error(milestone + " incomplete guard-break evidence: " + JSON.stringify(evidence));
  }
  if (COMBAT.block.guardBreakStunMs !== 650) {
    throw new Error(milestone + " expected the actionable 650 ms guard-break stun, observed " + COMBAT.block.guardBreakStunMs);
  }

  let focusTransitions = attackerState.focusTransitions;
  let recoveryTransitions = attackerState.recoveryTransitions;
  let targetIndex = focusTransitions.findIndex((entry) => entry.label === "GUARD BREAK #" + defenderId);
  let breakCue = recoveryTransitions.find((entry) =>
    entry.visible
    && entry.state === "guard-break-stun"
    && entry.label === "PUNISH"
    && entry.detail === "Guard break stun");

  const cueDeadline = Date.now() + 220;
  while ((targetIndex < 0 || !breakCue) && Date.now() < cueDeadline) {
    await sleep(12);
    const states = await Promise.all(entries.map(readUiEvidence));
    attackerState = states.find((entry) => entry.browser === attacker.name);
    defenderState = states.find((entry) => entry.browser === defender.name);
    closerState = states.find((entry) => entry.browser === closerIdle.name);
    focusTransitions = attackerState.focusTransitions;
    recoveryTransitions = attackerState.recoveryTransitions;
    targetIndex = focusTransitions.findIndex((entry) => entry.label === "GUARD BREAK #" + defenderId);
    breakCue = recoveryTransitions.find((entry) =>
      entry.visible
      && entry.state === "guard-break-stun"
      && entry.label === "PUNISH"
      && entry.detail === "Guard break stun");
  }
  if (targetIndex < 0 || !breakCue) {
    throw new Error(milestone + " did not expose the broken fighter as the punish target: " + JSON.stringify({
      focusTransitions,
      recoveryTransitions,
      attackerState,
    }));
  }
  if (focusTransitions.some((entry) => entry.label === "GUARD BREAK #" + closerId)) {
    throw new Error(milestone + " falsely marked idle #" + closerId + " as guard-broken: " + JSON.stringify(focusTransitions));
  }
  if (!attackerState.feedbackTransitions.includes("guard-break-confirm")
    || !defenderState.feedbackTransitions.includes("guard-broken")
    || closerState.playerHp !== 100 || closerState.playerGuard !== 100) {
    throw new Error(milestone + " lost authoritative guard-break attribution or touched the idle rival: " + JSON.stringify(evidence));
  }
  if (attackerState.acceptance?.scenario !== expectedScenario
    || defenderState.acceptance?.scenario !== expectedScenario
    || closerState.acceptance?.scenario !== expectedScenario) {
    throw new Error(milestone + " authoritative acceptance hook was not active: "
      + JSON.stringify([attackerState.acceptance, defenderState.acceptance, closerState.acceptance]));
  }

  let punishPointerOffset = -1;
  let guardBreakStunTransition = null;
  let guardBreakRecovery = null;
  if (convert) {
    if (!conversionPlan) {
      throw new Error(milestone + " did not schedule the buffered punish from the live guard-break snapshot");
    }
    punishPointerOffset = conversionPlan.punishPointerOffset;
    guardBreakStunTransition = conversionPlan.guardBreakStunTransition;
    guardBreakRecovery = conversionPlan.guardBreakRecovery;

    let hitEvidence = null;
    // The buffered light has a genuine 135 ms windup after attack recovery,
    // and real Chrome/Firefox snapshots can arrive a frame after the 34 HP
    // result. The older 320 ms poll occasionally expired even when the
    // authoritative hit landed inside the unchanged 650 ms guard-break stun.
    // Wait for evidence only; never extend the stun or synthesize an attack.
    const hitDeadline = Date.now() + COMBAT.block.guardBreakStunMs + 120;
    while (Date.now() < hitDeadline) {
      const states = await Promise.all(entries.map(readUiEvidence));
      const currentAttacker = states.find((entry) => entry.browser === attacker.name);
      const currentDefender = states.find((entry) => entry.browser === defender.name);
      const currentCloser = states.find((entry) => entry.browser === closerIdle.name);
      // Polling can observe the 34 HP result one replication frame after the
      // 650 ms stun has expired. Treat the HP result as the hit snapshot here;
      // below, authoritative attack-active ordering proves the punish itself
      // became active before the guard-break stun ended.
      if (currentDefender?.playerHp === 66
        && currentAttacker?.playerHp === 100
        && currentCloser?.playerHp === 100
        && currentCloser?.playerGuard === 100) {
        hitEvidence = states;
        break;
      }
      if ((Number.isFinite(currentDefender?.playerHp) && currentDefender.playerHp < 66)
        || (Number.isFinite(currentAttacker?.playerHp) && currentAttacker.playerHp < 100)
        || (Number.isFinite(currentCloser?.playerHp) && currentCloser.playerHp < 100)) {
        throw new Error(milestone + " punish damaged the wrong fighter or hit more than once: " + JSON.stringify(states));
      }
      await sleep(8);
    }
    if (!hitEvidence) {
      throw new Error(milestone + " did not convert the guard-break target into exactly one 34 HP punish: "
        + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
    }
    attackerState = hitEvidence.find((entry) => entry.browser === attacker.name);
    defenderState = hitEvidence.find((entry) => entry.browser === defender.name);
    closerState = hitEvidence.find((entry) => entry.browser === closerIdle.name);

    const punishPointers = attackerState.pointers.slice(punishPointerOffset);
    const punishDowns = punishPointers.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
    const punishUps = punishPointers.filter((entry) => entry.type === "pointerup" && entry.button === 0);
    const punishDown = punishDowns[0];
    const punishAimValid = punishDown
      && Math.abs(punishDown.y - 0.5) <= 0.15
      && (attackerId < defenderId ? punishDown.x >= 0.6 : punishDown.x <= 0.4);
    const recoveryBufferOpenEpochMs = guardBreakRecovery.epochMs
      + COMBAT.attack.recoveryMs - COMBAT.inputBuffer.lightAttackWindowMs;
    const recoveryExitEpochMs = guardBreakRecovery.epochMs + COMBAT.attack.recoveryMs;
    // Browser snapshots are sampled every 50ms, so the unchanged 80ms light
    // active phase is occasionally absent from ownActionTransitions. Keep the
    // original real W3C pointer/aim/recovery window checks, but require exact
    // phase and damage provenance from the 60Hz authoritative server's own
    // loopback-only, read-only transition record instead of inferring success.
    const sampledActions = attackerState.acceptance?.ownActionTransitions ?? [];
    const sampledWindup = sampledActions.find(entry =>
      entry.action === COMBAT_ACTION.attackWindup
      && Number.isFinite(entry.epochMs)
      && entry.epochMs >= punishDown?.epochMs - 40) ?? null;
    const sampledActive = sampledWindup
      ? sampledActions.find(entry =>
        entry.action === COMBAT_ACTION.attackActive
        && Number.isFinite(entry.epochMs)
        && entry.epochMs >= sampledWindup.epochMs) ?? null
      : null;
    let authoritativePunish = null;
    let proofFailure = null;
    const proofDeadline = Date.now() + 180;
    while (!authoritativePunish && Date.now() < proofDeadline) {
      try {
        authoritativePunish = verifyM201ServerPunishProof(m201ServerOutput(), {
          attackerId, defenderId, closerId,
        });
      } catch (error) {
        proofFailure = error?.message ?? String(error);
        await sleep(8);
      }
    }
    const guardBreakStunEndEpochMs = guardBreakStunTransition.epochMs + COMBAT.block.guardBreakStunMs;
    if (punishDowns.length !== 1 || punishUps.length !== 1 || !punishAimValid
      || !Number.isFinite(punishDown?.epochMs)
      || punishDown.epochMs < guardBreakStunTransition.epochMs
      || punishDown.epochMs >= guardBreakStunEndEpochMs
      || punishDown.epochMs < recoveryBufferOpenEpochMs
      || punishDown.epochMs > recoveryExitEpochMs + 25
      || !authoritativePunish
      || (Number.isInteger(guardBreakRecovery.serverTick)
        && authoritativePunish.windup.tick <= guardBreakRecovery.serverTick)) {
      throw new Error(milestone + " genuine input / authoritative server active phase failed: "
        + JSON.stringify({
          punishPointers, guardBreakStunTransition, guardBreakRecovery,
          recoveryBufferOpenEpochMs, recoveryExitEpochMs, guardBreakStunEndEpochMs,
          sampledWindup, sampledActive, authoritativePunish, proofFailure,
        }));
    }
    console.log("M201_SERVER_AUTH_PUNISH_PROOF " + JSON.stringify({
      attackerId, defenderId, closerId,
      punishPointerCount: punishDowns.length,
      sampleWindupObserved: !!sampledWindup,
      sampleActiveObserved: !!sampledActive,
      ...authoritativePunish,
    }));
    const feedbackDeadline = Date.now() + 220;
    while (Date.now() < feedbackDeadline
      && (!attackerState.events.includes("Opponent hit - 34 HP.")
        || !defenderState.events.includes("Hit taken - 34 HP."))) {
      await sleep(8);
      const feedbackStates = await Promise.all(entries.map(readUiEvidence));
      attackerState = feedbackStates.find((entry) => entry.browser === attacker.name);
      defenderState = feedbackStates.find((entry) => entry.browser === defender.name);
      closerState = feedbackStates.find((entry) => entry.browser === closerIdle.name);
    }
    if (!attackerState.events.includes("Opponent hit - 34 HP.")
      || !defenderState.events.includes("Hit taken - 34 HP.")
      || closerState.events.includes("Hit taken - 34 HP.")) {
      throw new Error(milestone + " authoritative hit feedback did not identify only the guard-broken fighter: "
        + JSON.stringify({ attackerState, defenderState, closerState }));
    }
  }

  const clearDeadline = Date.now() + COMBAT.block.guardBreakStunMs + 360;
  const expectedDefenderHp = convert ? 66 : 100;
  let finalEvidence = null;
  while (Date.now() < clearDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const currentAttacker = states.find((entry) => entry.browser === attacker.name);
    const currentDefender = states.find((entry) => entry.browser === defender.name);
    const currentCloser = states.find((entry) => entry.browser === closerIdle.name);
    if (currentAttacker
      && currentAttacker.focusLabel !== "GUARD BREAK #" + defenderId
      && !currentAttacker.recoveryVisible
      && currentDefender?.playerHp === expectedDefenderHp
      && Number.isFinite(currentDefender?.playerGuard)
      && currentCloser?.playerHp === 100
      && currentCloser?.playerGuard === 100) {
      finalEvidence = states;
      break;
    }
    await sleep(16);
  }
  if (!finalEvidence) {
    throw new Error(milestone + " guard-break punish focus did not clear after stun expiry: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  return finalEvidence.map((entry) => ({
    ...entry,
    m151AttackerId: attackerId,
    m151GuardBrokenId: defenderId,
    m151CloserIdleId: closerId,
  }));
}

async function runOnlineUiMiddleBlockPressureFlight(entries) {
  const milestone = "R2 native middle-mouse held block, exactly three guard-pressure hits";
  if (entries.length !== 2) throw new Error(milestone + ": requires two real browsers");
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const attacker = entries.find(entry => entry.name === "chrome");
  const defender = entries.find(entry => entry.name === "firefox");
  const chrome = ready.find(entry => entry.browser === "chrome");
  const firefox = ready.find(entry => entry.browser === "firefox");
  if (!attacker || !defender || !chrome || !firefox) {
    throw new Error(milestone + ": missing server identities");
  }
  const right = chrome.playerNetId < firefox.playerNetId;
  await Promise.all(entries.map(entry => execute(entry.base, entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const attackArena = await resolveArenaElement(attacker, milestone + " attacker");
  const blockArena = await resolveArenaElement(defender, milestone + " blocker");
  await Promise.all(entries.map(centerArenaInViewport));
  await pulseMovementKey(attacker, right ? "d" : "a", 120);
  await Promise.all([
    aimArena(attacker, attackArena, right ? 200 : -200),
    aimArena(defender, blockArena, right ? -200 : 200),
  ]);
  const before = await Promise.all(entries.map(readUiEvidence));
  if (before.some(state => state.playerHp !== 100 || state.playerGuard !== 100)) {
    throw new Error(milestone + ": staging altered starting vitals " + JSON.stringify(before));
  }
  const blockOrigin = { "element-6066-11e4-a52e-4f735466cecf": blockArena };
  let pointerDownSent = false;
  try {
    // ONE real Firefox W3C middle pointerDown. Keep held for all three
    // independently authenticated Chrome click/impact phases.
    await webdriver(defender.base, "POST", "/session/" + defender.sessionId + "/actions", {
      actions: [{
        type: "pointer", id: "mouse-" + defender.name, parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", duration: 0, origin: blockOrigin,
            x: right ? -200 : 200, y: 0 },
          { type: "pointerDown", button: 1 },
        ],
      }],
    });
    pointerDownSent = true;
    // A continuous block is not a timed parry: wait past the original
    // 125ms parry window, then demand three genuine -38 guard hits.
    await sleep(220);
    const expectedGuards = [62, 24, 0];
    for (let index = 0; index < expectedGuards.length; index++) {
      // M334: release-to-strike requires a real LMB down/up that spans
      // multiple 60Hz input samples. 10ms CI taps intermittently missed
      // the newly separate release intent (#39413216936). 45ms remains
      // a strict short LIGHT hold, far below the unchanged 320ms heavy.
      // Exact -38 guard, zero HP, no-parry evidence below is unchanged.
      await performArenaM221GuardBreakClick(attacker, 45);
      const deadline = Date.now() + 1100;
      let good = false;
      while (Date.now() < deadline) {
        const states = await Promise.all(entries.map(readUiEvidence));
        const a = states.find(state => state.browser === "chrome");
        const b = states.find(state => state.browser === "firefox");
        if (a.playerHp !== 100 || b.playerHp !== 100
          || a.feedbackTransitions.includes("parried")
          || b.feedbackTransitions.includes("parry-success")
          || b.playerGuard < expectedGuards[index]) {
          throw new Error(milestone + ": unblocked, parried, or over-damaged "
            + JSON.stringify({ index, states }));
        }
        if (b.playerGuard === expectedGuards[index]) {
          good = true;
          break;
        }
        await sleep(12);
      }
      if (!good) {
        throw new Error(milestone + ": missing exact -38 guard step "
          + JSON.stringify({ index, expectedGuard: expectedGuards[index],
            evidence: await Promise.all(entries.map(readUiEvidence)) }));
      }
      if (index < 2) await sleep(360);
    }
  } finally {
    if (pointerDownSent) {
      await webdriver(defender.base, "POST", "/session/" + defender.sessionId + "/actions", {
        actions: [{
          type: "pointer", id: "mouse-" + defender.name,
          parameters: { pointerType: "mouse" },
          actions: [{ type: "pointerUp", button: 1 }],
        }],
      });
    }
  }
  const evidence = await Promise.all(entries.map(readUiEvidence));
  const defenderState = evidence.find(state => state.browser === defender.name);
  const attackerState = evidence.find(state => state.browser === attacker.name);
  const middles = defenderState.pointers.filter(p => p.button === 1);
  if (middles.filter(p => p.type === "pointerdown").length !== 1
    || middles.filter(p => p.type === "pointerup").length !== 1
    || defenderState.wheels.some(w => w.deltaY > 0)
    || attackerState.pointers.filter(p => p.type === "pointerdown" && p.button === 0).length !== 3
    || defenderState.playerGuard !== 0
    || attackerState.playerHp !== 100 || defenderState.playerHp !== 100
    || defenderState.feedbackTransitions.includes("parry-success")
    || attackerState.feedbackTransitions.includes("parried")) {
    throw new Error(milestone + ": authentic MMB, 100HP, and zero-parry proof failed "
      + JSON.stringify(evidence));
  }
  return { nativeMiddleHold: true, exactGuardSequence: [62, 24, 0],
    noParry: true, noHpDamage: true, realClicks: 3 };
}

async function runOnlineUiGuardBreakFlight(entries, { onGuardBroken = null } = {}) {
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const attacker = entries.find((entry) => entry.name === "chrome");
  const defender = entries.find((entry) => entry.name === "firefox");
  const attackerReady = ready.find((entry) => entry.browser === attacker?.name);
  const defenderReady = ready.find((entry) => entry.browser === defender?.name);
  if (!attacker || !defender || !attackerReady || !defenderReady) {
    throw new Error(`could not resolve M34 UI roles from ${JSON.stringify(ready)}`);
  }
  const attackRight = attackerReady.playerNetId < defenderReady.playerNetId;
  const movementKey = attackRight ? "d" : "a";
  const movementCode = attackRight ? "KeyD" : "KeyA";
  const attackOffset = attackRight ? 200 : -200;
  const blockOffset = attackRight ? -200 : 200;

  // M325: ensure Firefox's test-only localhost socket is already connected.
  // Fail before combat if we cannot certify a genuine native wheel promptly.
  let m325ChannelReady = false;
  for (let poll = 0; poll < 25 && !m325ChannelReady; poll += 1) {
    m325ChannelReady = await execute(defender.base, defender.sessionId,
      "return window.__MYASO_M325_WHEEL_CHANNEL__?.readyState === WebSocket.OPEN;");
    if (!m325ChannelReady) await sleep(30);
  }
  if (!m325ChannelReady) throw new Error("M325 trusted Firefox wheel socket did not open");

  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const attackerElementId = await resolveArenaElement(attacker, "M34 attacker");
  const defenderElementId = await resolveArenaElement(defender, "M34 defender");
  await Promise.all(entries.map(centerArenaInViewport));
  await pulseMovementKey(attacker, movementKey, 120);
  await Promise.all([
    aimArena(attacker, attackerElementId, attackOffset),
    aimArena(defender, defenderElementId, blockOffset),
  ]);
  // Keep both directional inputs on the normal 60 Hz path before the held-block
  // exchange. Subsequent attack bursts are button-only and preserve this aim.
  await sleep(60);
  let evidence = null;
  let blockHeld = false;
  try {
    blockHeld = true;
    // M151/M152 require the same block-only exchange as M194. The old
    // attack-first path admitted the wheel only3ticks before impact (a valid
    // parry), so share the proven real wheel-first choreography. Actual
    // trusted wheel, native driver ACK and all38guard/noHP/noPARRY gates stay.
    // Original M194 first-red: wheel-backed Block tick4902 expired at
    // tick4917; Chrome Light HIT tick4919 while defender was Idle.
    // Its wheel-first compound click released too late for 240ms Block.
    // Use the already-established genuine DOWN -> trusted wheel -> UP
    // sequence for M194, as with M151. M152 remains wheel-first.
    // Keep fixed parry/block, original World, attestation and HP gates.
    const wheelFirstGuardOnly = scenario === "uiguardbreakpunishffahit";
    const m151ReleaseAnchoredGuardOnly = scenario === "uiguardbreakpunishffa";
    const m194ReleaseAnchoredGuardOnly = scenario === "uiguardbreak";
    const m198Plan = planM198GuardBreakW3cExchange({
      parryWindowMs: COMBAT.block.parryWindowMs,
      shortBlockMs: COMBAT.block.shortBlockMs,
      attackWindupMs: COMBAT.attack.windupMs,
      guardDamage: COMBAT.attack.guardDamage,
      maxGuard: COMBAT.guard.max,
    });
    if (m198Plan.minimumExchanges > 4) {
      throw new Error("M198 guard-break exchange budget cannot exhaust authoritative guard");
    }
    let guardBroken = false;
    for (let attempt = 0; attempt < 4 && !guardBroken; attempt += 1) {
      // M198: post-merge M197 main quality #38219864770 observed the
      // first Chrome down/up in a 3-click W3C burst take 187ms, though its
      // requested hold was 10ms. The authoritative attack committed only
      // 240ms after first down and hit after Firefox's 240ms block expired.
      // M198 rev2: exact-head quality #1029 correctly blocked a new
      // parry in one trial: parallel Chrome/Fox driver calls permitted a
      // late Firefox wheel to race ahead of Chrome's 135ms attack windup.
      // Await ONE genuine Firefox W3C wheel-back, then immediately dispatch
      // ONE genuine Chrome LMB without the prior 45ms pointer pause.
      // Wheel ordering is now deterministic; WebDriver/snapshot latency
      // contributes the remaining real inter-client delay. Three distinct
      // genuine -38 guarded hits still must exhaust 100 guard, with zero
      // parries, HP loss, synthetic inputs, or gameplay timing changes.
      // M212: whole Chrome click after Firefox wheel expired the 240ms
      // block when its release took 203ms; full-click attack-first and
      // down/wheel/up instead landed in the unchanged 125ms parry window.
      // Dispatch ONE real Firefox wheel 48ms ahead of ONE genuine split
      // Chrome W3C down/up to target the block-only interval. The original
      // 100HP/-38guard/no-parry proof rejects early, late or missing action.
      // Never fabricate inputs, repeat failed exchanges or alter mechanics.
      // M320: capture ONLY this genuine exchange's authoritative action/event
      // transitions. The loopback-only server trace is evidence, not a clock
      // used to schedule attacks or to waive M194's HP/guard/parry assertions.
      const m320ServerOutputStart = m201ServerOutput().length;
      const challenge = m221Registry.issue();
      let m212Exchange;
      try {
        // Arm the real Firefox observer BEFORE the one genuine W3C wheel.
        // Chrome responds after browser delivery, not the delayed HTTP ACK.
        // Original W3C ACK and strict combat assertions are still mandatory.
        await execute(defender.base, defender.sessionId,
          "window.__MYASO_M221_WHEEL_TOKEN__ = " + JSON.stringify(challenge.token)
            + "; return true;");
        // R2: the real Chrome LMB-up commits the only attack. Attestation
        // fetches can lag the underlying trusted Firefox DOM wheel. Bound
        // that WAIT, but require the actual event to precede Chrome release
        // (read-only epoch evidence below), and require the wheel W3C ACK.
        // Neither the 125/240ms defense nor 34HP/-38 guard assertions change.
        // Guard-only scenarios require the real trusted wheel before input.
        // One genuine pre-aimed down/pause/up transaction removes a separate
        // DOWN ACK barrier (52ms physical hold on e7ce01df). Actual DOM edges,
        // wheel ACK and all guard/HP/parry gates below remain mandatory.
        m212Exchange = await dispatchR2ReleaseLedShortBlock({
          trustedWheelWaitMs: (wheelFirstGuardOnly || m151ReleaseAnchoredGuardOnly || m194ReleaseAnchoredGuardOnly) ? 190 : 0,
          preWheelHeadStartMs: wheelFirstGuardOnly ? 15 : 0,
          postTrustedWheelMs: (m151ReleaseAnchoredGuardOnly || m194ReleaseAnchoredGuardOnly) ? 25 : 0,
          sendAttackClick: wheelFirstGuardOnly
            ? () => performArenaM221GuardBreakClick(attacker, 5) : undefined,
          sendAttackDown: () => setArenaAttackButton(attacker, true),
          sendWheel: () => scrollArenaWheel(defender, defenderElementId, 120, 0),
          awaitTrustedWheel: () => challenge.wait(),
          sendAttackUp: () => setArenaAttackButton(attacker, false),
          sleep,
        });
      } finally {
        challenge.close();
        // If the trusted wheel or W3C release failed, terminate the still
        // held native gesture before the failed acceptance session closes.
        // A failure must never become a silent counted guard exchange.
      }
      await sleep(230);
      const states = await Promise.all(entries.map(readUiEvidence));
      const defenderState = states.find((entry) => entry.browser === defender.name);
      const attackerState = states.find((entry) => entry.browser === attacker.name);
      // Read-only M212 ingress diagnostics must be printed BEFORE the strict
      // assertions throw. W3C dispatch/ACK offsets share this harness clock;
      // defender wheel, block cue and damage/parry use Firefox's own clock;
      // Chrome down, up and strike cue use Chrome's own clock. NEVER compare
      // Chrome and Firefox local timestamp origins directly.
      const m212FirefoxWheel = defenderState?.wheels?.filter(
        (event) => event.deltaY > 0,
      ).at(-1);
      const m212FirefoxBlock = defenderState?.eventTransitions?.filter(
        (event) => event.text.startsWith("Blocking"),
      ).at(-1);
      const m212FirefoxOutcome = defenderState?.eventTransitions?.filter(
        (event) => event.text.startsWith("Hit taken")
          || event.text.startsWith("Parry!")
          || event.text.startsWith("Block held")
          || event.text.startsWith("Guard broken"),
      ).at(-1);
      const m212ChromeDown = attackerState?.pointers?.filter(
        (event) => event.type === "pointerdown" && event.button === 0,
      ).at(-1);
      const m212ChromeUp = attackerState?.pointers?.filter(
        (event) => event.type === "pointerup" && event.button === 0,
      ).at(-1);
      const m212Duration = (end, start) => Number.isFinite(end?.t)
        && Number.isFinite(start?.t) && end.t >= start.t
        ? Number((end.t - start.t).toFixed(1)) : null;
      // Both real browsers run on the same CI host. Date.now() epoch clocks
      // here establish the cross-browser *event order*, not server timing.
      // Never substitute W3C ACK/localhost receipt timestamps for DOM events.
      // This is deliberately independent of the damage/guard assertions.
      const trustedWheelBeforeRelease = Number.isFinite(m212FirefoxWheel?.epochMs)
        && Number.isFinite(m212ChromeUp?.epochMs)
        && Number.isFinite(m212ChromeDown?.epochMs)
        && m212ChromeDown.epochMs <= m212ChromeUp.epochMs
        && m212FirefoxWheel.epochMs <= m212ChromeUp.epochMs;
      console.log("M212_GUARD_BREAK_INGRESS " + JSON.stringify({
        attempt: attempt + 1,
        harnessW3c: m212Exchange,
        trustedWheelBeforeRelease,
        wheelEventEpochMs: m212FirefoxWheel?.epochMs ?? null,
        chromeReleaseEpochMs: m212ChromeUp?.epochMs ?? null,
        firefox: {
          wheelEventMs: m212FirefoxWheel?.t ?? null,
          blockCueMs: m212FirefoxBlock?.t ?? null,
          impactOrParryCueMs: m212FirefoxOutcome?.t ?? null,
          wheelToBlockCueMs: m212Duration(m212FirefoxBlock, m212FirefoxWheel),
          wheelToImpactOrParryMs: m212Duration(m212FirefoxOutcome, m212FirefoxWheel),
          hp: defenderState?.playerHp,
          guard: defenderState?.playerGuard,
        },
        chrome: {
          pointerDownMs: m212ChromeDown?.t ?? null,
          pointerUpMs: m212ChromeUp?.t ?? null,
          genuineClickHoldMs: m212Duration(m212ChromeUp, m212ChromeDown),
          feedback: attackerState?.combatFeedback,
        },
      }));
      const m320AuthoritativeLines = m201ServerOutput()
        .slice(m320ServerOutputStart)
        .split(/\r?\n/)
        .filter(line => /^(M201_AUTH_(ACTION|BLOCK|PARRY|BREAK|HIT)|CORE8C_WORLD_CONTACT) /.test(line))
        .slice(-16);
      console.log("M320_GUARD_BREAK_AUTH_TRACE " + JSON.stringify({
        attempt: attempt + 1,
        attackerNetId: attackerReady.playerNetId,
        defenderNetId: defenderReady.playerNetId,
        tickLines: m320AuthoritativeLines,
      }));
      if (!trustedWheelBeforeRelease) {
        throw new Error(`M334 trusted Firefox wheel did not precede the genuine Chrome LMB release: ${JSON.stringify(states)}`);
      }
      // A real parry must never be silently counted as one of the guard-break
      // exchanges, even if later strikes successfully drain guard.
      if (attackerState?.feedbackTransitions.includes("parried")
        || defenderState?.feedbackTransitions.includes("parry-success")) {
        throw new Error(`M193 guard-break exchange ${attempt + 1} resolved as parry instead of -38 guard: ${JSON.stringify(states)}`);
      }
      if (defenderState?.playerHp !== 100) {
        throw new Error(`M34 guard-break staging allowed an unblocked strike: ${JSON.stringify(states)}`);
      }
      console.log("M193_GUARD_BREAK_EXCHANGE " + JSON.stringify({
        attempt: attempt + 1,
        attackerEvents: attackerState?.events.slice(-3),
        defenderEvents: defenderState?.events.slice(-3),
        defenderHp: defenderState?.playerHp,
        defenderGuard: defenderState?.playerGuard,
        wheelCount: defenderState?.wheels.filter(event => event.deltaY > 0).length,
        attackCount: attackerState?.pointers.filter(event => event.type === "pointerdown" && event.button === 0).length,
        m198Plan,
        m212ChromeDownDispatchMs: m212Exchange.attackDownDispatchMs,
        m212ChromeDownAckMs: m212Exchange.attackDownAckMs,
        m212ChromeUpDispatchMs: m212Exchange.attackUpDispatchMs,
        m212WheelHeadStartMs: m212Exchange.wheelHeadStartMs,
        m212ClickHoldMs: m212Exchange.clickHoldMs,
        chromeClickHoldMs: (() => {
          const downs = attackerState?.pointers.filter(event => event.type === "pointerdown" && event.button === 0) ?? [];
          const ups = attackerState?.pointers.filter(event => event.type === "pointerup" && event.button === 0) ?? [];
          const down = downs.at(-1);
          const up = ups.at(-1);
          return Number.isFinite(down?.t) && Number.isFinite(up?.t)
            ? Number((up.t - down.t).toFixed(1)) : null;
        })(),
        // M200: only a matching *newer* server-derived UI cue can be paired
        // with this browser's genuine wheel. Repeated identical messages may
        // be deduplicated by the observer; explicitly report unobserved.
        ...(() => {
          const observation = measureM200WheelFeedbackLatency({
            wheel: defenderState?.wheels?.at(-1),
            transitions: defenderState?.eventTransitions,
            remainingGuard: defenderState?.playerGuard,
          });
          return {
            wheelToFeedbackMs: observation?.wheelToFeedbackMs ?? null,
            m200FeedbackKind: observation?.feedbackKind ?? null,
            m200TelemetryStatus: observation ? "matched" : "unobserved",
          };
        })(),
      }));
      guardBroken = defenderState?.playerGuard === 0;
      let confirmedStates = states;
      if (!guardBroken && mustAwaitM202GuardConvergence({
        attemptsDone: attempt + 1,
        minimumExchanges: m198Plan.minimumExchanges,
        attackerConfirmed: attackerState?.feedbackTransitions.includes("guard-break-confirm") ?? false,
        defenderGuard: defenderState?.playerGuard,
      })) {
        // M202: never send another genuine wheel/click against an already
        // guard-broken victim merely because its snapshot still shows 24 guard.
        const deadline = performance.now() + 450;
        do {
          await sleep(12);
          confirmedStates = await Promise.all(entries.map(readUiEvidence));
          const updatedAttacker = confirmedStates.find((entry) => entry.browser === attacker.name);
          const updatedDefender = confirmedStates.find((entry) => entry.browser === defender.name);
          if (updatedAttacker?.feedbackTransitions.includes("parried")
            || updatedDefender?.feedbackTransitions.includes("parry-success")
            || updatedDefender?.playerHp !== 100 || updatedAttacker?.playerHp !== 100) {
            throw new Error("M202 pending guard break violated parry/HP proof: " + JSON.stringify(confirmedStates));
          }
          guardBroken = updatedDefender?.playerGuard === 0;
          if (guardBroken) {
            console.log("M202_GUARD_BREAK_CONVERGED " + JSON.stringify({
              attemptsDone: attempt + 1, defenderGuard: updatedDefender.playerGuard,
              attackerConfirmed: updatedAttacker?.feedbackTransitions.includes("guard-break-confirm"),
            }));
          }
        } while (!guardBroken && performance.now() < deadline);
        if (!guardBroken) {
          throw new Error("M202 zero guard did not converge after genuine inputs: " + JSON.stringify(confirmedStates));
        }
      }
      if (guardBroken && onGuardBroken) {
        await onGuardBroken({
          states: confirmedStates,
          attacker,
          defender,
          attackerElementId,
          defenderElementId,
          attackRight,
          attackOffset,
          blockOffset,
        });
      }
      if (!guardBroken) await sleep(300);
    }
    evidence = await waitForUiGuardBreakEvidence(entries, attacker, defender, guardBroken ? 500 : 300);
  } finally {
    if (blockHeld) await setArenaBlock(defender, defenderElementId, false);
  }
  await sleep(20);
  evidence = await Promise.all(entries.map(readUiEvidence));

  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) throw new Error(`incomplete M34 UI evidence: ${JSON.stringify(evidence)}`);
  if (!attackerResult.keys.includes(`keydown:${movementCode}`) || !attackerResult.keys.includes(`keyup:${movementCode}`)) {
    throw new Error(`M34 real attacker movement control was not delivered: ${JSON.stringify(attackerResult)}`);
  }
  const attackDowns = attackerResult.pointers.filter((event) => event.type === "pointerdown" && event.button === 0);
  const blockWheels = defenderResult.wheels.filter((event) => event.deltaY > 0);
  const attacksAimed = attackDowns.length >= 3 && attackDowns.every((event) =>
    Math.abs(event.y - 0.5) <= 0.15 && (attackRight ? event.x >= 0.6 : event.x <= 0.4));
  if (!attacksAimed) {
    throw new Error(`M34 real repeated directional attacks were not delivered: ${JSON.stringify(attackerResult)}`);
  }
  if (blockWheels.length < 3) {
    throw new Error(`M34 repeated wheel-back directional blocks were not delivered: ${JSON.stringify(defenderResult)}`);
  }
  if (attackerResult.playerHp !== 100 || defenderResult.playerHp !== 100 || defenderResult.playerGuard !== 0) {
    throw new Error(`M34 guard break did not preserve HP and exhaust guard: ${JSON.stringify(evidence)}`);
  }
  if (attackerResult.feedbackTransitions.includes("parried") || defenderResult.feedbackTransitions.includes("parry-success")) {
    throw new Error(`M34 stale block accidentally resolved as parry: ${JSON.stringify(evidence)}`);
  }
  return evidence;
}

async function runOnlineUiGuardBreakTellFlight(entries) {
  const evidence = await runOnlineUiGuardBreakFlight(entries);
  const attacker = evidence.find((entry) => entry.feedbackTransitions.includes("guard-break-confirm"));
  const defender = evidence.find((entry) => entry.feedbackTransitions.includes("guard-broken"));
  if (!attacker || !defender || attacker.browser === defender.browser) {
    throw new Error(`M40 could not resolve guard-break roles: ${JSON.stringify(evidence)}`);
  }
  const observer = entries.find((entry) => entry.name === attacker.browser);
  const brokenLocal = entries.find((entry) => entry.name === defender.browser);
  if (!observer || !brokenLocal) throw new Error(`M40 could not resolve browser sessions`);
  const tell = await waitForRemoteGuardBreakTell(observer, brokenLocal, 500);
  await waitForGuardBreakTellClear(observer, 1600);
  return evidence.map((entry) => ({ ...entry, guardBreakTellMaxPixels: entry.browser === observer.name ? tell.observerMax : tell.localMax }));
}

async function runOnlineUiRespawnFlight(entries, onDeath = null) {
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const ordered = ready.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const attacker = entries.find((entry) => entry.name === ordered[0].browser);
  const defender = entries.find((entry) => entry.name === ordered[1].browser);
  if (!attacker || !defender) throw new Error(`could not resolve M31 UI roles from ${JSON.stringify(ready)}`);

  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const arena = await webdriver(attacker.base, "POST", `/session/${attacker.sessionId}/element`, {
    using: "css selector",
    value: "#arena",
  });
  const elementId = arena?.["element-6066-11e4-a52e-4f735466cecf"];
  if (!elementId) throw new Error(`${attacker.name} did not resolve the real arena canvas for M31`);

  let deathEvidence = null;
  await pulseMovementKey(attacker, "d", 120);
  for (let attempt = 0; attempt < 8 && !deathEvidence; attempt += 1) {
    await performArenaAttack(attacker, elementId);
    deathEvidence = await waitForUiDeathEvidence(entries, attacker, defender, 800, false);
    if (!deathEvidence) await pulseMovementKey(attacker, "d", 80);
  }
  if (!deathEvidence) deathEvidence = await waitForUiDeathEvidence(entries, attacker, defender, 1200, true);
  if (onDeath) await onDeath({ attacker, defender, deathEvidence });

  const respawnEvidence = await waitForUiRespawnEvidence(entries, attacker, defender, 3000);
  const attackerResult = respawnEvidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = respawnEvidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) throw new Error(`incomplete M31 UI evidence: ${JSON.stringify(respawnEvidence)}`);
  if (!attackerResult.keys.includes("keydown:KeyD") || !attackerResult.keys.includes("keyup:KeyD")) {
    throw new Error(`M31 real attacker movement control was not delivered: ${JSON.stringify(attackerResult)}`);
  }
  const primaryDown = attackerResult.pointers.find((event) => event.type === "pointerdown" && event.button === 0);
  if (!primaryDown || primaryDown.x < 0.6 || Math.abs(primaryDown.y - 0.5) > 0.15) {
    throw new Error(`M31 real rightward attack aim was not delivered: ${JSON.stringify(attackerResult)}`);
  }
  if (!attackerResult.events.includes("Opponent down.") || !attackerResult.events.includes("Opponent respawned.")) {
    throw new Error(`attacker never rendered the authoritative death/respawn lifecycle: ${JSON.stringify(attackerResult.events)}`);
  }
  if (!defenderResult.events.includes("Defeated - read the exchange.") || !defenderResult.events.includes("Respawned - back in the fight.")) {
    throw new Error(`defender never rendered the authoritative death/respawn lifecycle: ${JSON.stringify(defenderResult.events)}`);
  }
  const showedDefeat = defenderResult.overlayTransitions.some((entry) => entry.visible && entry.title === "DEFEATED" && entry.detail === "Respawning…");
  const clearedAfterDefeat = showedDefeat && defenderResult.overlayTransitions.at(-1)?.visible === false;
  if (!clearedAfterDefeat) {
    throw new Error(`defender overlay did not follow authoritative death through respawn: ${JSON.stringify(defenderResult.overlayTransitions)}`);
  }
  return respawnEvidence;
}

async function runOnlineUiScoreFlight(entries) {
  const evidence = await runOnlineUiRespawnFlight(entries);
  const ordered = evidence.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const attackerId = ordered[0]?.playerNetId ?? 0;
  const defenderId = ordered[1]?.playerNetId ?? 0;
  if (!attackerId || !defenderId) throw new Error(`M48 could not resolve authoritative score identities: ${JSON.stringify(evidence)}`);
  for (const entry of evidence) {
    const rows = entry.scoreboardRows ?? [];
    if (rows.length !== 2
      || rows[0]?.label !== `#${attackerId}` || rows[0]?.kills !== 1
      || rows[1]?.label !== `#${defenderId}` || rows[1]?.kills !== 0) {
      throw new Error(`M48 scoreboard did not converge to authoritative 1-0 kill score: ${JSON.stringify(entry)}`);
    }
    const ownRows = rows.filter((row) => row.own);
    if (ownRows.length !== 1 || ownRows[0].label !== `#${entry.playerNetId}`) {
      throw new Error(`M48 scoreboard local identity marker was incorrect: ${JSON.stringify(entry)}`);
    }
  }
  return evidence;
}

async function runOnlineUiMatchFlight(entries) {
  const firstScore = await runOnlineUiScoreFlight(entries);
  const ordered = firstScore.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const attacker = entries.find((entry) => entry.name === ordered[0]?.browser);
  const defender = entries.find((entry) => entry.name === ordered[1]?.browser);
  if (!attacker || !defender) throw new Error(`M49 could not resolve match roles: ${JSON.stringify(firstScore)}`);

  const winnerId = ordered[0]?.playerNetId ?? 0;
  if (!winnerId) throw new Error(`M121 could not resolve first-to-five leader identity: ${JSON.stringify(firstScore)}`);

  await Promise.all(entries.map(installUiObserver));
  await waitForUiReady(entries);
  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const elementId = await resolveArenaElement(attacker, "M121 first-to-five");

  let matchEvidence = null;
  for (let expectedKills = 2; expectedKills <= FFA_KILL_TARGET; expectedKills += 1) {
    // Reset the attacker to a repeatable approach lane using only ordinary
    // movement. The defeated rival already respawns at the authoritative spawn.
    await pulseMovementKey(attacker, "a", 500);
    await pulseMovementKey(attacker, "d", 140);

    let pointEvidence = null;
    for (let attempt = 0; attempt < 8 && !pointEvidence; attempt += 1) {
      await performArenaAttack(attacker, elementId);
      pointEvidence = expectedKills === FFA_KILL_TARGET
        ? await waitForUiMatchEndEvidence(entries, attacker, defender, 850, false)
        : await waitForUiKillScoreEvidence(entries, attacker, defender, expectedKills, 850, false);
      if (!pointEvidence) await pulseMovementKey(attacker, "d", 40);
    }
    if (!pointEvidence) {
      pointEvidence = expectedKills === FFA_KILL_TARGET
        ? await waitForUiMatchEndEvidence(entries, attacker, defender, 1500, true)
        : await waitForUiKillScoreEvidence(entries, attacker, defender, expectedKills, 1500, true);
    }

    if (expectedKills === FFA_KILL_TARGET) {
      matchEvidence = pointEvidence;
      break;
    }

    const respawned = await waitForUiRespawnEvidence(entries, attacker, defender, 2300);
    if (expectedKills === FFA_KILL_TARGET - 1) {
      const expectedPoint = `MATCH POINT · #${winnerId} · ${expectedKills}/${FFA_KILL_TARGET} KILLS`;
      for (const entry of respawned) {
        if (entry.scoreboardTitle !== `FIRST TO ${FFA_KILL_TARGET}`
          || !entry.matchPointVisible
          || entry.matchPointText !== expectedPoint) {
          throw new Error(`M121 4/5 match-point HUD did not converge: ${JSON.stringify(respawned)}`);
        }
      }
    }
  }

  if (!matchEvidence) throw new Error("M121 first-to-five match never reached authoritative victory");

  await sleep(1500);
  const frozen = await Promise.all(entries.map(readUiEvidence));
  const winner = frozen.find((entry) => entry.browser === attacker.name);
  const loser = frozen.find((entry) => entry.browser === defender.name);
  if (!winner || !loser) throw new Error(`M121 incomplete frozen match evidence: ${JSON.stringify(frozen)}`);
  if (winner.scoreboardRows[0]?.kills !== FFA_KILL_TARGET
    || loser.scoreboardRows[0]?.kills !== FFA_KILL_TARGET
    || winner.opponentHp !== 0 || loser.playerHp !== 0
    || winner.overlayTitle !== "VICTORY" || loser.overlayTitle !== "MATCH OVER"
    || winner.matchPointVisible || loser.matchPointVisible) {
    throw new Error(`M121 authoritative first-to-five state did not remain frozen past respawn time: ${JSON.stringify(frozen)}`);
  }
  return frozen;
}

async function runOnlineUiRematchFlight(entries) {
  const finished = await runOnlineUiMatchFlight(entries);
  const ordered = finished.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const attacker = entries.find((entry) => entry.name === ordered[0]?.browser);
  const defender = entries.find((entry) => entry.name === ordered[1]?.browser);
  if (!attacker || !defender) throw new Error(`M50 could not resolve rematch roles: ${JSON.stringify(finished)}`);

  const reset = await waitForUiMatchResetEvidence(entries, 2200);
  const attackerReady = reset.find((entry) => entry.browser === attacker.name);
  const defenderReady = reset.find((entry) => entry.browser === defender.name);
  if (!attackerReady || !defenderReady) throw new Error(`M50 incomplete reset evidence: ${JSON.stringify(reset)}`);

  const attackRight = attackerReady.playerNetId < defenderReady.playerNetId;
  const movementKey = attackRight ? "d" : "a";
  const attackOffset = attackRight ? 200 : -200;
  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const elementId = await resolveArenaElement(attacker, "M50");
  await pulseMovementKey(attacker, movementKey, 120);

  let damageEvidence = null;
  for (let attempt = 0; attempt < 3 && !damageEvidence; attempt += 1) {
    await performArenaAttack(attacker, elementId, attackOffset);
    damageEvidence = await waitForUiPostResetDamageEvidence(entries, attacker, defender, 800, false);
    if (!damageEvidence) await pulseMovementKey(attacker, movementKey, 60);
  }
  if (!damageEvidence) damageEvidence = await waitForUiPostResetDamageEvidence(entries, attacker, defender, 1200, true);
  return damageEvidence;
}

async function runOnlineUiThreePlayerFfaFlight(entries) {
  if (entries.length !== 3) throw new Error(`M51 expected three real browser clients, received ${entries.length}`);
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  if (ready.length !== 3 || ready.some((entry) => !entry.playerNetId)) {
    throw new Error(`M51 did not resolve three authoritative player identities: ${JSON.stringify(ready)}`);
  }
  const ordered = ready.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const ids = ordered.map((entry) => entry.playerNetId);
  if (new Set(ids).size !== 3) throw new Error(`M51 duplicate authoritative identities: ${JSON.stringify(ready)}`);
  const left = entries.find((entry) => entry.name === ordered[0].browser);
  const center = entries.find((entry) => entry.name === ordered[1].browser);
  const right = entries.find((entry) => entry.name === ordered[2].browser);
  if (!left || !center || !right) throw new Error(`M51 could not map three FFA roles: ${JSON.stringify(ready)}`);

  await waitForUiThreePlayerReady(entries, ids, 2500);
  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const leftArena = await resolveArenaElement(left, "M51 left attacker");
  const rightArena = await resolveArenaElement(right, "M51 right attacker");

  await pulseMovementKey(left, "d", 120);
  let firstHit = null;
  for (let attempt = 0; attempt < 3 && !firstHit; attempt += 1) {
    await performArenaAttack(left, leftArena, 200);
    firstHit = await waitForUiThreePlayerDamage(entries, center, 66, ids, 850, false);
    if (!firstHit) await pulseMovementKey(left, "d", 60);
  }
  if (!firstHit) firstHit = await waitForUiThreePlayerDamage(entries, center, 66, ids, 1200, true);

  await pulseMovementKey(left, "a", 220);
  await pulseMovementKey(right, "a", 120);
  let secondHit = null;
  for (let attempt = 0; attempt < 3 && !secondHit; attempt += 1) {
    await performArenaAttack(right, rightArena, -200);
    secondHit = await waitForUiThreePlayerDamage(entries, center, 32, ids, 850, false);
    if (!secondHit) await pulseMovementKey(right, "a", 60);
  }
  if (!secondHit) secondHit = await waitForUiThreePlayerDamage(entries, center, 32, ids, 1200, true);

  const leftState = secondHit.find((entry) => entry.browser === left.name);
  const centerState = secondHit.find((entry) => entry.browser === center.name);
  const rightState = secondHit.find((entry) => entry.browser === right.name);
  if (!leftState || !centerState || !rightState) throw new Error(`M51 incomplete final FFA evidence: ${JSON.stringify(secondHit)}`);
  if (!leftState.pointers.some((event) => event.type === "pointerdown" && event.button === 0)
    || !rightState.pointers.some((event) => event.type === "pointerdown" && event.button === 0)) {
    throw new Error(`M51 did not preserve real pointer provenance for both attackers: ${JSON.stringify(secondHit)}`);
  }
  if (leftState.playerHp !== 100 || centerState.playerHp !== 32 || rightState.playerHp !== 100) {
    throw new Error(`M51 damage was not isolated to the middle fighter: ${JSON.stringify(secondHit)}`);
  }
  return secondHit;
}

async function runOnlineUiFocusHudFlight(entries) {
  if (entries.length !== 3) throw new Error(`M53 expected three real browser clients, received ${entries.length}`);
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const ordered = ready.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const ids = ordered.map((entry) => entry.playerNetId);
  if (ids.length !== 3 || new Set(ids).size !== 3) {
    throw new Error(`M53 did not resolve three authoritative identities: ${JSON.stringify(ready)}`);
  }
  const left = entries.find((entry) => entry.name === ordered[0].browser);
  const center = entries.find((entry) => entry.name === ordered[1].browser);
  const right = entries.find((entry) => entry.name === ordered[2].browser);
  if (!left || !center || !right) throw new Error(`M53 could not map three FFA roles: ${JSON.stringify(ready)}`);

  const leftId = ordered[0].playerNetId;
  const centerId = ordered[1].playerNetId;
  const rightId = ordered[2].playerNetId;
  const expectedReady = new Map([
    [left.name, { label: `NEAREST #${centerId}`, hp: 100, playerHp: 100 }],
    [center.name, { label: `NEAREST #${leftId}`, hp: 100, playerHp: 100 }],
    [right.name, { label: `NEAREST #${centerId}`, hp: 100, playerHp: 100 }],
  ]);
  await waitForUiFocusHudEvidence(entries, expectedReady, ids, 2500, true);

  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const leftArena = await resolveArenaElement(left, "M53 focused attacker");
  await pulseMovementKey(left, "d", 120);

  const expectedDamage = new Map([
    [left.name, { label: `NEAREST #${centerId}`, hp: 66, playerHp: 100 }],
    [center.name, { labels: [`NEAREST #${leftId}`, `NEAREST #${rightId}`], hp: 100, playerHp: 66 }],
    [right.name, { label: `NEAREST #${centerId}`, hp: 66, playerHp: 100 }],
  ]);
  let evidence = null;
  for (let attempt = 0; attempt < 3 && !evidence; attempt += 1) {
    await performArenaAttack(left, leftArena, 200);
    evidence = await waitForUiFocusHudEvidence(entries, expectedDamage, ids, 650, false);
    if (!evidence) {
      const damage = await waitForUiThreePlayerDamage(entries, center, 66, ids, 300, false);
      if (damage) {
        evidence = await waitForUiFocusHudEvidence(entries, expectedDamage, ids, 1200, true);
        break;
      }
      await pulseMovementKey(left, "d", 60);
    }
  }
  if (!evidence) evidence = await waitForUiFocusHudEvidence(entries, expectedDamage, ids, 1200, true);

  const leftState = evidence.find((entry) => entry.browser === left.name);
  if (!leftState?.pointers.some((event) => event.type === "pointerdown" && event.button === 0)) {
    throw new Error(`M53 focused attack lacked real pointer provenance: ${JSON.stringify(leftState)}`);
  }
  return evidence;
}

async function runOnlineUiThreatAwarenessFlight(entries, requireBearing = false) {
  const milestone = requireBearing ? "M57" : "M54";
  if (entries.length !== 3) throw new Error(`${milestone} expected three real browser clients, received ${entries.length}`);
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const ordered = ready.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const ids = ordered.map((entry) => entry.playerNetId);
  if (ids.length !== 3 || new Set(ids).size !== 3) {
    throw new Error(`${milestone} did not resolve three authoritative identities: ${JSON.stringify(ready)}`);
  }
  const left = entries.find((entry) => entry.name === ordered[0].browser);
  const center = entries.find((entry) => entry.name === ordered[1].browser);
  const right = entries.find((entry) => entry.name === ordered[2].browser);
  if (!left || !center || !right) throw new Error(`${milestone} could not map three FFA roles: ${JSON.stringify(ready)}`);

  await waitForUiThreePlayerReady(entries, ids, 2500);
  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const leftArena = await resolveArenaElement(left, `${milestone} threat attacker`);
  // Authoritative spawns are 96 units apart while attack reach plus fighter radius is 94.
  // Mirror the proven multi-threat staging: establish the real rightward aim, move well
  // inside reach, then let the released movement/facing sample propagate before attacking.
  await aimArena(left, leftArena, 200);
  await sleep(60);
  await pulseMovementKey(left, "d", 260);
  await sleep(60);

  const leftId = ordered[0].playerNetId;
  let evidence = null;
  for (let attempt = 0; attempt < 3 && !evidence; attempt += 1) {
    await performArenaAttack(left, leftArena, 200);
    // Keep all three real browser sessions scheduled while the 135 ms windup and
    // 80 ms active phase are live. Sleeping through the entire exchange lets a
    // headless tab skip the short STRIKE render even though authority resolves it.
    const states = await sampleUiEvidenceWhileActive(entries, 420);
    const leftState = states.find((entry) => entry.browser === left.name);
    const centerState = states.find((entry) => entry.browser === center.name);
    const rightState = states.find((entry) => entry.browser === right.name);
    if (!leftState || !centerState || !rightState) {
      throw new Error(`${milestone} incomplete threat evidence: ${JSON.stringify(states)}`);
    }
    const visibleCenter = centerState.threatTransitions.filter((event) => event.visible && event.label === `#${leftId}`);
    const sawWindup = visibleCenter.some((event) => event.state === "windup" && event.phase === "WINDUP");
    const sawStrike = visibleCenter.some((event) => event.state === "strike" && event.phase === "STRIKE");
    const leftFalsePositive = leftState.threatTransitions.some((event) => event.visible);
    const rightFalsePositive = rightState.threatTransitions.some((event) => event.visible);
    if (leftFalsePositive || rightFalsePositive) {
      throw new Error(`${milestone} threat cue leaked to non-target clients: ${JSON.stringify(states)}`);
    }
    if (centerState.playerHp === 66) {
      if (!sawWindup || !sawStrike) {
        throw new Error(`${milestone} authoritative hit resolved without complete incoming-threat phases: ${JSON.stringify(states)}`);
      }
      if (requireBearing && !visibleCenter.some((event) => event.bearing === "FROM LEFT")) {
        throw new Error(`M57 primary threat bearing did not identify the real left-side attacker: ${JSON.stringify(states)}`);
      }
      if (leftState.playerHp !== 100 || rightState.playerHp !== 100) {
        throw new Error(`${milestone} threat exchange damaged a non-target fighter: ${JSON.stringify(states)}`);
      }
      evidence = states;
      break;
    }
    if (states.some((entry) => entry.playerHp !== 100 || entry.playerGuard !== 100)) {
      throw new Error(`${milestone} retry ${attempt + 1} resolved an unexpected exchange: ${JSON.stringify(states)}`);
    }
    await sleep(520);
    if (attempt < 2) await pulseMovementKey(left, "d", 40);
  }
  if (!evidence) {
    throw new Error(`${milestone} real attack never produced authoritative target damage: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
  }
  const attackerState = evidence.find((entry) => entry.browser === left.name);
  if (!attackerState?.pointers.some((event) => event.type === "pointerdown" && event.button === 0)) {
    throw new Error(`${milestone} threat attack lacked real pointer provenance: ${JSON.stringify(attackerState)}`);
  }
  return evidence;
}

async function runOnlineUiMultiThreatFlight(entries, requireSecondary = false, requireSecondaryBearing = false, requireSecondaryPhase = false, requireGuardArc = false, requireSecondaryGuardArc = false, requireSpatialMarkers = false) {
  const milestone = requireSpatialMarkers ? "M62" : requireSecondaryGuardArc ? "M61" : requireGuardArc ? "M60" : requireSecondaryPhase ? "M59" : requireSecondaryBearing ? "M58" : requireSecondary ? "M56" : "M55";
  if (entries.length !== 3) throw new Error(`${milestone} expected three real browser clients, received ${entries.length}`);
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const ordered = ready.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const ids = ordered.map((entry) => entry.playerNetId);
  if (ids.length !== 3 || new Set(ids).size !== 3) {
    throw new Error(`${milestone} did not resolve three authoritative identities: ${JSON.stringify(ready)}`);
  }
  const left = entries.find((entry) => entry.name === ordered[0].browser);
  const center = entries.find((entry) => entry.name === ordered[1].browser);
  const right = entries.find((entry) => entry.name === ordered[2].browser);
  if (!left || !center || !right) throw new Error(`${milestone} could not map three FFA roles: ${JSON.stringify(ready)}`);

  await waitForUiThreePlayerReady(entries, ids, 2500);
  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const [leftArena, rightArena] = await Promise.all([
    resolveArenaElement(left, `${milestone} left threat attacker`),
    resolveArenaElement(right, `${milestone} right threat attacker`),
  ]);
  // The left spawn's default facing already points toward center, but the right spawn
  // must replicate a ~PI facing change before its attack can threaten center. Aim both real
  // attackers first, then keep that aim active throughout the inward movement pulse so the
  // unchanged 60 Hz input/server path has many samples to establish both facings.
  await Promise.all([
    aimArena(left, leftArena, 200),
    aimArena(right, rightArena, -200),
  ]);
  await sleep(60);
  // Authoritative spawns are 96 units apart while attack reach plus fighter radius is 94.
  // Stage both genuine attackers well inside unchanged threat geometry before synchronizing
  // their attacks so runner/input jitter cannot leave one edge attacker just outside reach.
  await Promise.all([
    pulseMovementKey(left, "d", 260),
    pulseMovementKey(right, "a", 260),
  ]);
  // Let movement release and the persisted facing propagate before either attack commits.
  await sleep(60);
  if (requireSpatialMarkers) await Promise.all(entries.map(armThreatMarkerSampler));

  const leftId = ordered[0].playerNetId;
  const rightId = ordered[2].playerNetId;
  let evidence = null;
  for (let attempt = 0; attempt < 3 && !evidence; attempt += 1) {
    // Online attacks are one-shot pointerdown latches that are cleared after the
    // next outbound input sample. Holding the button does not refresh that latch.
    // M59 must prove normal light WINDUP -> STRIKE, not an accidental heavy.
    // With R2 release-to-strike, repeated genuine 10ms bursts can aggregate
    // into server-held heavy input (observed 46HP HEAVY STRIKE on both sides).
    // Use one real, bounded W3C release per attacker for M59 only; all other
    // multi-threat flights retain their previously verified gesture contract.
    if (requireSecondaryPhase) {
      await Promise.all([
        performArenaAttackHold(left, leftArena, 200, 35),
        performArenaAttackHold(right, rightArena, -200, 35),
      ]);
    } else {
      await Promise.all([
        performArenaAttackBurst(left),
        performArenaAttackBurst(right),
      ]);
    }
    // The active phase is only 80 ms. Actively sample the three sessions instead
    // of leaving them idle for 240 ms, otherwise headless scheduling can erase the
    // brief simultaneous STRIKE frame from the observer history.
    let states = await sampleUiEvidenceWhileActive(entries, 240);
    if (requireSecondaryPhase) {
      // A secondary WINDUP transition can arrive one browser sample before STRIKE under
      // headless runner jitter. Once simultaneous-threat evidence exists, allow only a
      // short bounded observation window for the already-committed STRIKE transition.
      const phaseDeadline = Date.now() + 320;
      while (true) {
        const centerSample = states.find((entry) => entry.browser === center.name);
        const phaseEvents = centerSample?.threatTransitions.filter((event) => {
          if (!event.visible || event.count !== "2 THREATS") return false;
          const eventPrimaryIsLeft = event.label === `#${leftId}`;
          const eventPrimaryIsRight = event.label === `#${rightId}`;
          if (!eventPrimaryIsLeft && !eventPrimaryIsRight) return false;
          const expectedSecondary = eventPrimaryIsLeft ? `NEXT #${rightId}` : `NEXT #${leftId}`;
          return event.secondary === expectedSecondary;
        }) ?? [];
        const phases = new Set(phaseEvents.map((event) => event.secondaryPhase).filter(Boolean));
        if (phaseEvents.length === 0 || (phases.has("WINDUP") && phases.has("STRIKE")) || Date.now() >= phaseDeadline) {
          break;
        }
        await sleep(40);
        states = await Promise.all(entries.map(readUiEvidence));
      }
    }
    const leftState = states.find((entry) => entry.browser === left.name);
    const centerState = states.find((entry) => entry.browser === center.name);
    const rightState = states.find((entry) => entry.browser === right.name);
    if (!leftState || !centerState || !rightState) {
      throw new Error(`${milestone} incomplete multi-threat evidence: ${JSON.stringify(states)}`);
    }

    const multiThreat = centerState.threatTransitions.find((event) =>
      event.visible
      && event.count === "2 THREATS"
      && (event.label === `#${leftId}` || event.label === `#${rightId}`)
      && (event.state === "windup" || event.state === "strike"));
    const leakedMultiThreat = [leftState, rightState].some((state) =>
      state.threatTransitions.some((event) => event.visible && event.count === "2 THREATS"));
    if (leakedMultiThreat) {
      throw new Error(`${milestone} multi-threat count leaked to an attacker client: ${JSON.stringify(states)}`);
    }
    if (multiThreat) {
      const leftPointer = leftState.pointers.some((event) => event.type === "pointerdown" && event.button === 0);
      const rightPointer = rightState.pointers.some((event) => event.type === "pointerdown" && event.button === 0);
      if (!leftPointer || !rightPointer) {
        throw new Error(`${milestone} multi-threat proof lacked two real pointer commits: ${JSON.stringify(states)}`);
      }
      if (requireSecondary) {
        const primaryIsLeft = multiThreat.label === `#${leftId}`;
        const expectedSecondary = primaryIsLeft ? `NEXT #${rightId}` : `NEXT #${leftId}`;
        if (multiThreat.secondary !== expectedSecondary) {
          throw new Error(`${milestone} did not identify the deterministic secondary attacker: ${JSON.stringify(states)}`);
        }
        const secondaryLeak = [leftState, rightState].some((state) =>
          state.threatTransitions.some((event) => event.visible && event.secondary));
        if (secondaryLeak) {
          throw new Error(`${milestone} secondary threat identity leaked to an attacker client: ${JSON.stringify(states)}`);
        }
        if (requireSecondaryBearing) {
          const expectedPrimaryBearing = primaryIsLeft ? "FROM LEFT" : "FROM RIGHT";
          const expectedSecondaryBearing = primaryIsLeft ? "FROM RIGHT" : "FROM LEFT";
          if (multiThreat.bearing !== expectedPrimaryBearing || multiThreat.secondaryBearing !== expectedSecondaryBearing) {
            throw new Error(`M58 did not preserve opposite primary/secondary threat bearings: ${JSON.stringify(states)}`);
          }
          const secondaryBearingLeak = [leftState, rightState].some((state) =>
            state.threatTransitions.some((event) => event.visible && event.secondaryBearing));
          if (secondaryBearingLeak) {
            throw new Error(`M58 secondary threat bearing leaked to an attacker client: ${JSON.stringify(states)}`);
          }
        }
        if (requireSecondaryPhase) {
          const phaseEvents = centerState.threatTransitions.filter((event) => {
            if (!event.visible || event.count !== "2 THREATS") return false;
            const eventPrimaryIsLeft = event.label === `#${leftId}`;
            const eventPrimaryIsRight = event.label === `#${rightId}`;
            if (!eventPrimaryIsLeft && !eventPrimaryIsRight) return false;
            const eventExpectedSecondary = eventPrimaryIsLeft ? `NEXT #${rightId}` : `NEXT #${leftId}`;
            return event.secondary === eventExpectedSecondary;
          });
          const secondaryPhases = new Set(phaseEvents.map((event) => event.secondaryPhase).filter(Boolean));
          if (!secondaryPhases.has("WINDUP") || !secondaryPhases.has("STRIKE")) {
            throw new Error(`M59 did not observe authoritative secondary WINDUP and STRIKE phases: ${JSON.stringify(states)}`);
          }
          // A held LMB now exposes genuine HEAVY WINDUP before early pointerUP
          // releases a light WINDUP. Both are canonical windup phases, not
          // an active secondary threat outranking a winding-up primary.
          const inconsistentWindup = phaseEvents.some((event) =>
            event.state === "windup" && fighterThreatPhaseState(event.secondaryPhase) !== "windup");
          if (inconsistentWindup) {
            throw new Error(`M59 secondary phase violated active-before-windup threat priority: ${JSON.stringify(states)}`);
          }
          const secondaryPhaseLeak = [leftState, rightState].some((state) =>
            state.threatTransitions.some((event) => event.visible && event.secondaryPhase));
          if (secondaryPhaseLeak) {
            throw new Error(`M59 secondary threat phase leaked to an attacker client: ${JSON.stringify(states)}`);
          }
        }
        if (requireGuardArc) {
          const expectedGuardArc = primaryIsLeft ? "FLANK" : "FRONT";
          if (multiThreat.guardArc !== expectedGuardArc) {
            throw new Error(`M60 primary guard arc did not match authoritative center facing: ${JSON.stringify(states)}`);
          }
        }
        if (requireSecondaryGuardArc) {
          const expectedSecondaryGuardArc = primaryIsLeft ? "FRONT" : "FLANK";
          if (multiThreat.secondaryGuardArc !== expectedSecondaryGuardArc) {
            throw new Error(`M61 secondary guard arc did not match authoritative center facing: ${JSON.stringify(states)}`);
          }
          const secondaryGuardArcLeak = [leftState, rightState].some((state) =>
            state.threatTransitions.some((event) => event.visible && event.secondaryGuardArc));
          if (secondaryGuardArcLeak) {
            throw new Error(`M61 secondary guard arc leaked to an attacker client: ${JSON.stringify(states)}`);
          }
        }
      }
      evidence = states;
      break;
    }

    if (centerState.playerHp < 100) {
      throw new Error(`${milestone} authoritative attacks resolved without simultaneous-threat UI evidence: ${JSON.stringify(states)}`);
    }
    if (leftState.playerHp !== 100 || rightState.playerHp !== 100) {
      throw new Error(`${milestone} retry ${attempt + 1} damaged a non-target fighter: ${JSON.stringify(states)}`);
    }
    await sleep(520);
    if (attempt < 2) {
      await Promise.all([
        pulseMovementKey(left, "d", 35),
        pulseMovementKey(right, "a", 35),
      ]);
    }
  }

  if (!evidence) {
    if (requireSpatialMarkers) await Promise.all(entries.map(stopThreatMarkerSampler));
    throw new Error(`${milestone} never observed two simultaneous authoritative threats: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
  }
  if (requireSpatialMarkers) {
    const samples = await Promise.all(entries.map(async (entry) => ({
      browser: entry.name,
      ...(await stopThreatMarkerSampler(entry)),
    })));
    const centerSample = samples.find((entry) => entry.browser === center.name);
    const attackerSamples = samples.filter((entry) => entry.browser === left.name || entry.browser === right.name);
    if (!centerSample
      || centerSample.primaryMax < threatMarkerMinPixels
      || centerSample.secondaryMax < threatMarkerMinPixels) {
      throw new Error(`M62 center observer never painted both spatial threat markers: ${JSON.stringify(samples)}`);
    }
    if (attackerSamples.some((entry) => entry.secondaryMax >= threatMarkerMinPixels)) {
      throw new Error(`M62 secondary spatial threat marker leaked without simultaneous-threat evidence: ${JSON.stringify(samples)}`);
    }
    return evidence.map((entry) => ({
      ...entry,
      threatMarkerPrimaryMaxPixels: samples.find((sample) => sample.browser === entry.browser)?.primaryMax ?? 0,
      threatMarkerSecondaryMaxPixels: samples.find((sample) => sample.browser === entry.browser)?.secondaryMax ?? 0,
    }));
  }
  return evidence;
}

async function runOnlineUiJumpFfaThreatFlight(entries, mode) {
  const milestone = mode === "primary" ? "M142 jump primary FFA threat" : "M142 jump secondary FFA threat";
  if (mode !== "primary" && mode !== "secondary") {
    throw new Error(`M142 unsupported jump FFA threat mode: ${mode}`);
  }
  if (entries.length !== 3) {
    throw new Error(`${milestone} expected three real browser clients, received ${entries.length}`);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const ordered = ready.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const ids = ordered.map((entry) => entry.playerNetId);
  if (ids.length !== 3 || new Set(ids).size !== 3) {
    throw new Error(`${milestone} did not resolve three authoritative identities: ${JSON.stringify(ready)}`);
  }

  const left = entries.find((entry) => entry.name === ordered[0].browser);
  const center = entries.find((entry) => entry.name === ordered[1].browser);
  const right = entries.find((entry) => entry.name === ordered[2].browser);
  if (!left || !center || !right) {
    throw new Error(`${milestone} could not map deterministic FFA roles: ${JSON.stringify(ready)}`);
  }

  await waitForUiThreePlayerReady(entries, ids, 2500);
  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  const [leftArena, rightArena] = await Promise.all([
    resolveArenaElement(left, `${milestone} jump attacker`),
    resolveArenaElement(right, `${milestone} light attacker`),
  ]);
  await Promise.all(entries.map(centerArenaInViewport));
  await Promise.all([
    aimArena(left, leftArena, 200),
    aimArena(right, rightArena, -200),
  ]);
  await sleep(60);

  // Keep both attackers inside their unchanged attack geometry while leaving
  // them safely outside each other's hit reach. Jump attack needs the left
  // fighter within 66 px of center (48 reach + 18 radius); the right light
  // needs 94 px (76 + 18). The older 210/260 ms staging put the attackers
  // about 91 px apart, allowing the right light to legitimately clip #1.
  // These bounded pulses keep the two attackers outside mutual hit reach and preserve
  // deterministic primary/secondary ordering by authoritative distance.
  // M142 secondary's earlier 155/250 ms pulses left the narrow 66 px jump
  // reach near its boundary on loaded runners: both genuine attacks landed,
  // but Firefox often saw only the right-side threat in replicated snapshots.
  // Keep secondary staging balanced; in primary mode pull the jump attacker
  // deeper inside its narrow 66 px reach while retaining safe rival spacing.
  const leftMovementMs = mode === "primary" ? 200 : 180;
  const rightMovementMs = mode === "primary" ? 120 : 275;
  await Promise.all([
    pulseMovementKey(left, "d", leftMovementMs),
    pulseMovementKey(right, "a", rightMovementMs),
  ]);
  await sleep(60);

  // M225: fixed WebDriver key durations can invert authoritative distance
  // order under runner load. Observe genuine server-replicated coordinates
  // at centre and adjust with bounded, ordinary real W3C movement keys.
  // Never reorder HUD state or weaken the original two-threat assertion.
  let geometryReady = false;
  for (let geometryAttempt = 1; geometryAttempt <= 4; geometryAttempt += 1) {
    const centerState = await readUiEvidence(center);
    const stage = planM225ThreatDistanceStaging({
      fighters: centerState.acceptance?.fighters,
      leftId: ids[0], centerId: ids[1], rightId: ids[2], mode,
    });
    console.log("M225_REAL_THREAT_GEOMETRY " + JSON.stringify({
      mode, geometryAttempt, ...stage,
      authoritativeTick: centerState.acceptance?.serverTick ?? null,
    }));
    if (stage.ready) {
      geometryReady = true;
      break;
    }
    if (geometryAttempt === 4) break;
    // R2 directional dash: a double WASD keyDown inside 240ms is a real
    // 42-unit dash, not a fine staging move. M142 #39223717854 recorded
    // right distance 78 -> 120 -> 162 during tiny correction taps.
    // Separate all genuine W3C corrections by >240ms, including from the
    // initial staging gesture. Fine adjustments use a single driver
    // keyDown/pause/keyUp transaction instead of split commands whose hold
    // can inflate under load. Server geometry, reach and strict checks stay.
    // Never change combat reach or strict evidence.
    await sleep(300);
    await Promise.all([
      stage.leftMove.ms
        ? pulseMovementKeyBoundedW3c(left, stage.leftMove.key, stage.leftMove.ms)
        : Promise.resolve(),
      stage.rightMove.ms
        ? pulseMovementKeyBoundedW3c(right, stage.rightMove.key, stage.rightMove.ms)
        : Promise.resolve(),
    ]);
    await sleep(75);
  }
  if (!geometryReady) {
    throw new Error(`${milestone} cannot stage genuine ordered attack geometry after four bounded attempts`);
  }
  await Promise.all([
    aimArena(left, leftArena, 200),
    aimArena(right, rightArena, -200),
  ]);
  await sleep(40);

  const baseline = await Promise.all(entries.map(readUiEvidence));
  const leftBefore = baseline.find((entry) => entry.browser === left.name);
  const centerBefore = baseline.find((entry) => entry.browser === center.name);
  const rightBefore = baseline.find((entry) => entry.browser === right.name);
  if (!leftBefore || !centerBefore || !rightBefore) {
    throw new Error(`${milestone} missing pre-commit evidence: ${JSON.stringify(baseline)}`);
  }
  const leftKeyOffset = leftBefore.keyTransitions.length;
  const leftPointerOffset = leftBefore.pointers.length;
  const rightPointerOffset = rightBefore.pointers.length;
  const centerThreatOffset = centerBefore.threatTransitions.length;

  // R2 release-to-strike: the right light does NOT wind up on pointerDown.
  // Three 10ms taps after the jump chord produced a delayed light, so the
  // center saw JUMP STRIKE + second WINDUP rather than two real STRIKES.
  // Send exactly ONE genuine W3C short LMB click first, then commit the real
  // Space+LMB jump chord. This aligns the unchanged 135ms light and 105ms
  // jumping windups on the authoritative server without synthetic input or
  // weakening the two-threat identity/bearing/phase/damage evidence below.
  // Spatial distance, not which attacker clicked first, determines order.
  const samplesPromise = sampleUiEvidenceWhileActive(entries, 280, 6);
  let jumpHeld = false;
  try {
    await performArenaAttackBurst(right, 1, 0, 0);
    await sleep(mode === "primary" ? 5 : 10);
    await pressArenaJumpAttackChord(left, leftArena, 200);
    jumpHeld = true;
    await sleep(80);
  } finally {
    if (jumpHeld) await releaseArenaJumpAttackChord(left);
  }
  await samplesPromise;

  let evidence = await Promise.all(entries.map(readUiEvidence));
  const leftId = ordered[0].playerNetId;
  const rightId = ordered[2].playerNetId;
  const expectedPrimaryId = mode === "primary" ? leftId : rightId;
  const expectedSecondaryId = mode === "primary" ? rightId : leftId;
  const expectedPrimaryBearing = mode === "primary" ? "FROM LEFT" : "FROM RIGHT";
  const expectedSecondaryBearing = mode === "primary" ? "FROM RIGHT" : "FROM LEFT";
  const expectedPrimaryGuardArc = mode === "primary" ? "FLANK" : "FRONT";
  const expectedSecondaryGuardArc = mode === "primary" ? "FRONT" : "FLANK";
  const expectedPhasePairs = mode === "primary"
    ? [
      { primary: "JUMP WINDUP", secondary: "WINDUP", state: "windup" },
      { primary: "JUMP STRIKE", secondary: "STRIKE", state: "strike" },
    ]
    : [
      { primary: "WINDUP", secondary: "JUMP WINDUP", state: "windup" },
      { primary: "STRIKE", secondary: "JUMP STRIKE", state: "strike" },
    ];

  // Under loaded headless scheduling the shared windup frame can be skipped
  // even though the center still renders the same deterministic primary /
  // secondary ordering during the immediately following shared strike frame.
  // Accept either phase pair while keeping identity, bearing, guard arc, and
  // two-threat ownership fail-closed.
  const findExpectedThreat = (state) => state?.threatTransitions.slice(centerThreatOffset).find((event) =>
    event.visible
    && event.count === "2 THREATS"
    && event.label === `#${expectedPrimaryId}`
    && event.secondary === `NEXT #${expectedSecondaryId}`
    && expectedPhasePairs.some((pair) =>
      event.phase === pair.primary
      && event.secondaryPhase === pair.secondary
      && event.state === pair.state)
    && event.bearing === expectedPrimaryBearing
    && event.secondaryBearing === expectedSecondaryBearing
    && event.guardArc === expectedPrimaryGuardArc
    && event.secondaryGuardArc === expectedSecondaryGuardArc);

  let centerState = evidence.find((entry) => entry.browser === center.name);
  let expectedThreat = findExpectedThreat(centerState);
  const deadline = Date.now() + 260;
  while (!expectedThreat && Date.now() < deadline) {
    await sleep(12);
    evidence = await Promise.all(entries.map(readUiEvidence));
    centerState = evidence.find((entry) => entry.browser === center.name);
    expectedThreat = findExpectedThreat(centerState);
  }
  if (!expectedThreat) {
    throw new Error(`${milestone} never rendered the expected two-threat ordering: ${JSON.stringify(evidence)}`);
  }

  const leftState = evidence.find((entry) => entry.browser === left.name);
  const rightState = evidence.find((entry) => entry.browser === right.name);
  if (!leftState || !rightState || !centerState) {
    throw new Error(`${milestone} incomplete final evidence: ${JSON.stringify(evidence)}`);
  }

  const leakedTwoThreat = [leftState, rightState].some((state) =>
    state.threatTransitions.some((event) => event.visible && event.count === "2 THREATS"));
  if (leakedTwoThreat) {
    throw new Error(`${milestone} center-only multi-threat awareness leaked to an attacker: ${JSON.stringify(evidence)}`);
  }

  const jumpKeys = leftState.keyTransitions.slice(leftKeyOffset);
  const jumpPointers = leftState.pointers.slice(leftPointerOffset);
  const jumpDowns = jumpKeys.filter((entry) => entry.type === "keydown" && entry.code === "Space");
  const jumpUps = jumpKeys.filter((entry) => entry.type === "keyup" && entry.code === "Space");
  const jumpAttackDowns = jumpPointers.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
  const jumpAttackUps = jumpPointers.filter((entry) => entry.type === "pointerup" && entry.button === 0);
  if (jumpDowns.length !== 1 || jumpUps.length !== 1
    || jumpAttackDowns.length !== 1 || jumpAttackUps.length !== 1
    || !Number.isFinite(jumpDowns[0]?.epochMs) || !Number.isFinite(jumpAttackDowns[0]?.epochMs)
    || Math.abs(jumpDowns[0].epochMs - jumpAttackDowns[0].epochMs) > 60) {
    throw new Error(`${milestone} lacked one genuine same-tick Space + LMB jump chord: ${JSON.stringify({ jumpKeys, jumpPointers })}`);
  }

  const lightPointers = rightState.pointers.slice(rightPointerOffset);
  const lightDown = lightPointers.find((entry) => entry.type === "pointerdown" && entry.button === 0);
  const lightUp = lightPointers.find((entry) => entry.type === "pointerup" && entry.button === 0);
  if (!lightDown || !lightUp) {
    throw new Error(`${milestone} lacked genuine right-side light pointer provenance: ${JSON.stringify(lightPointers)}`);
  }

  if (leftState.playerHp !== 100 || leftState.playerGuard !== 100
    || rightState.playerHp !== 100 || rightState.playerGuard !== 100) {
    throw new Error(`${milestone} damaged a non-target attacker: ${JSON.stringify(evidence)}`);
  }

  return evidence.map((entry) => ({
    ...entry,
    m142Mode: mode,
    m142ExpectedPrimary: expectedPrimaryId,
    m142ExpectedSecondary: expectedSecondaryId,
  }));
}

async function runOnlineUiJumpRecoveryFfaFocusFlight(entries) {
  const milestone = "M143 jump recovery FFA focus";
  if (entries.length !== 3) {
    throw new Error(`${milestone} expected three real browser clients, received ${entries.length}`);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const ordered = ready.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const ids = ordered.map((entry) => entry.playerNetId);
  if (ids.length !== 3 || new Set(ids).size !== 3) {
    throw new Error(`${milestone} did not resolve three authoritative identities: ${JSON.stringify(ready)}`);
  }

  const jumpAttacker = entries.find((entry) => entry.name === ordered[0].browser);
  const observer = entries.find((entry) => entry.name === ordered[1].browser);
  const closerIdle = entries.find((entry) => entry.name === ordered[2].browser);
  if (!jumpAttacker || !observer || !closerIdle) {
    throw new Error(`${milestone} could not map deterministic FFA roles: ${JSON.stringify(ready)}`);
  }

  await waitForUiThreePlayerReady(entries, ids, 2500);
  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  const jumpArena = await resolveArenaElement(jumpAttacker, milestone);
  await Promise.all(entries.map(centerArenaInViewport));

  const jumpId = ordered[0].playerNetId;
  const observerId = ordered[1].playerNetId;
  const closerId = ordered[2].playerNetId;

  // Passive native lifecycle witness: real focus/visibility loss can clear
  // browser input latches. DOM delivery alone is not server admission proof.
  await execute(jumpAttacker.base, jumpAttacker.sessionId, `
    const records = [];
    const append = event => {
      if ((event.type === 'keydown' || event.type === 'keyup') && event.code !== 'Space') return;
      if ((event.type === 'pointerdown' || event.type === 'pointerup') && event.button !== 0) return;
      records.push({type:event.type, code:event.code??null, button:event.button??null,
        trusted:event.isTrusted===true, epochMs:Date.now(), hidden:document.hidden,
        focus:document.activeElement?.id??null,
        serverTick:window.__MYASO_ACCEPTANCE_STATE__?.serverTick??null});
      if (records.length > 64) records.shift();
    };
    for (const type of ['focus','blur','keydown','keyup','pointerdown','pointerup']) window.addEventListener(type, append, true);
    document.addEventListener('visibilitychange', append, true);
    window.__MYASO_M143_NATIVE_TIMELINE__ = records;
    return true;
  `);

  // Keep the jump attacker at its original farther spawn while moving #3
  // decisively inward. Before any recovery exists, Firefox must therefore keep
  // its ordinary nearest-rival focus on #3.
  await pulseMovementKey(closerIdle, "a", 280);
  await sleep(80);

  let baseline = await Promise.all(entries.map(readUiEvidence));
  let observerBefore = baseline.find((entry) => entry.browser === observer.name);
  for (let attempt = 0; attempt < 3 && observerBefore?.focusLabel !== `NEAREST #${closerId}`; attempt += 1) {
    await pulseMovementKey(closerIdle, "a", 70);
    await sleep(60);
    baseline = await Promise.all(entries.map(readUiEvidence));
    observerBefore = baseline.find((entry) => entry.browser === observer.name);
  }
  const jumpBefore = baseline.find((entry) => entry.browser === jumpAttacker.name);
  const closerBefore = baseline.find((entry) => entry.browser === closerIdle.name);
  if (!jumpBefore || !observerBefore || !closerBefore) {
    throw new Error(`${milestone} missing staged evidence: ${JSON.stringify(baseline)}`);
  }
  if (observerBefore.focusLabel !== `NEAREST #${closerId}`) {
    throw new Error(`${milestone} did not establish the closer idle rival as ordinary focus: ${JSON.stringify(baseline)}`);
  }
  if (baseline.some((entry) => entry.playerHp !== 100 || entry.playerGuard !== 100)) {
    throw new Error(`${milestone} staging changed authoritative vitals: ${JSON.stringify(baseline)}`);
  }

  const jumpKeyOffset = jumpBefore.keyTransitions.length;
  const jumpPointerOffset = jumpBefore.pointers.length;
  const observerFocusOffset = observerBefore.focusTransitions.length;
  const observerRecoveryOffset = observerBefore.recoveryTransitions.length;

  // Turn #1 180 degrees away from the observer and commit a genuine Space+LMB
  // jump attack. It must whiff cleanly, yet its authoritative 450ms recovery
  // must temporarily outrank the closer idle #3 in the HUD focus.
  // M337: M143's old single-W3C-chord included an extra pointerMove tick;
  // exact-head CI #39420078938 measured real Space -> LMB = 67ms, violating
  // unchanged <=60ms genuine key/mouse onset. This pre-aim occurs while idle.
  // Reuse the qualified M335 genuine pointer-first one-tick chord; preserve
  // the real click, authoritative jump-attack phases, 100HP and HUD gates.
  await aimArena(jumpAttacker, jumpArena, -200);
  await sleep(40);
  const jumpServerLogOffset = m201ServerOutput().length;
  // The owner-approved 450ms recovery extends the authoritative timeline.
  // Sample through the genuine windup, active, full recovery AND returned
  // idle/nearest focus; the 300ms bound is only W3C+replica observation slack.
  // Keep every actual World phase/focus/vitals assertion unchanged.
  const jumpLifecycleObserveMs = COMBAT.jumpAttack.windupMs
    + COMBAT.jumpAttack.activeMs + COMBAT.jumpAttack.recoveryMs + 300;
  await Promise.all([
    performArenaPreAimedJumpAttackChord(jumpAttacker, 90),
    sampleUiEvidenceWhileActive(entries, jumpLifecycleObserveMs, 8),
  ]);

  let evidence = await Promise.all(entries.map(readUiEvidence));
  let jumpState = evidence.find((entry) => entry.browser === jumpAttacker.name);
  let observerState = evidence.find((entry) => entry.browser === observer.name);
  let closerState = evidence.find((entry) => entry.browser === closerIdle.name);
  if (!jumpState || !observerState || !closerState) {
    throw new Error(`${milestone} incomplete final evidence: ${JSON.stringify(evidence)}`);
  }

  // Emit the actual source/replica/World chronology BEFORE every untouched
  // focus and jump-phase assertion. Missing admission remains a fatal result.
  console.log("M143_NATIVE_SOURCE_WORLD_DIAGNOSTIC " + JSON.stringify({
    jumpId, observerId, closerId,
    geometryBefore: baseline.map(state => ({ browser:state.browser,
      serverTick:state.acceptance?.serverTick, fighters:state.acceptance?.fighters })),
    nativeLifecycle: await execute(jumpAttacker.base, jumpAttacker.sessionId,
      "return (window.__MYASO_M143_NATIVE_TIMELINE__??[]).map(event=>({...event}));"),
    physical: { keys:jumpState.keyTransitions.slice(jumpKeyOffset), pointers:jumpState.pointers.slice(jumpPointerOffset) },
    actualOriginalSender: jumpState.acceptance?.inputSubmissions ?? [],
    ownReplicatedActions: jumpState.acceptance?.ownActionTransitions ?? [],
    observerFocus: observerState.focusTransitions.slice(observerFocusOffset),
    observerRecovery: observerState.recoveryTransitions.slice(observerRecoveryOffset),
    geometryAfter: evidence.map(state => ({ browser:state.browser,
      serverTick:state.acceptance?.serverTick, fighters:state.acceptance?.fighters })),
    originalWorld: m201ServerOutput().slice(jumpServerLogOffset).split(/\r?\n/)
      .filter(line=>/^M201_(AUTH_ACTION|AUTH_HIT|AUTH_BLOCK|AUTH_PARRY|AUTH_BREAK|FLIGHT_ACTOR_BASELINE) /.test(line)).slice(-128),
  }));

  const focusTransitions = observerState.focusTransitions.slice(observerFocusOffset);
  const recoveryTransitions = observerState.recoveryTransitions.slice(observerRecoveryOffset);
  const punishIndex = focusTransitions.findIndex((entry) => entry.label === `PUNISH TARGET #${jumpId}`);
  const nearestReturnIndex = focusTransitions.findIndex((entry, index) =>
    index > punishIndex && entry.label === `NEAREST #${closerId}`);
  if (punishIndex < 0 || nearestReturnIndex <= punishIndex) {
    throw new Error(`${milestone} did not switch nearest #${closerId} -> punish #${jumpId} -> nearest #${closerId}: ${JSON.stringify({
      focusTransitions,
      evidence,
    })}`);
  }
  if (focusTransitions.some((entry) => entry.label === `PUNISH TARGET #${closerId}`)) {
    throw new Error(`${milestone} falsely marked the closer idle rival as punishable: ${JSON.stringify(focusTransitions)}`);
  }

  const jumpRecovery = recoveryTransitions.find((entry) =>
    entry.visible
    && entry.state === "jump-attack-recovery"
    && entry.label === "PUNISH"
    && entry.detail === "Jump attack recovery");
  const recoveryCleared = recoveryTransitions.findIndex((entry, index) =>
    index > recoveryTransitions.indexOf(jumpRecovery) && !entry.visible);
  if (!jumpRecovery || recoveryCleared < 0) {
    throw new Error(`${milestone} did not expose and clear the authoritative jump recovery cue: ${JSON.stringify(recoveryTransitions)}`);
  }

  const jumpKeys = jumpState.keyTransitions.slice(jumpKeyOffset);
  const jumpPointers = jumpState.pointers.slice(jumpPointerOffset);
  const spaceDowns = jumpKeys.filter((entry) => entry.type === "keydown" && entry.code === "Space");
  const spaceUps = jumpKeys.filter((entry) => entry.type === "keyup" && entry.code === "Space");
  const attackDowns = jumpPointers.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
  const attackUps = jumpPointers.filter((entry) => entry.type === "pointerup" && entry.button === 0);
  if (spaceDowns.length !== 1 || spaceUps.length !== 1 || attackDowns.length !== 1 || attackUps.length !== 1
    || !Number.isFinite(spaceDowns[0]?.epochMs) || !Number.isFinite(attackDowns[0]?.epochMs)
    || Math.abs(spaceDowns[0].epochMs - attackDowns[0].epochMs) > 60) {
    throw new Error(`${milestone} lacked one genuine same-tick Space + LMB chord: ${JSON.stringify({ jumpKeys, jumpPointers })}`);
  }
  if (attackDowns[0].x >= 0.5) {
    throw new Error(`${milestone} jump attacker was not deliberately aimed away from the observer: ${JSON.stringify(attackDowns)}`);
  }

  const ownTransitions = jumpState.acceptance?.ownActionTransitions ?? [];
  const windupIndex = ownTransitions.findIndex((entry) => entry.action === COMBAT_ACTION.jumpAttackWindup);
  const activeIndex = ownTransitions.findIndex((entry, index) =>
    index > windupIndex && entry.action === COMBAT_ACTION.jumpAttackActive);
  const recoveryIndex = ownTransitions.findIndex((entry, index) =>
    index > activeIndex && entry.action === COMBAT_ACTION.jumpAttackRecovery);
  const idleIndex = ownTransitions.findIndex((entry, index) =>
    index > recoveryIndex && entry.action === COMBAT_ACTION.idle);
  const plainJumpIndex = ownTransitions.findIndex((entry) => entry.action === COMBAT_ACTION.jump);
  if (jumpState.acceptance?.scenario !== "uijumprecoveryffa"
    || windupIndex < 0 || activeIndex <= windupIndex || recoveryIndex <= activeIndex || idleIndex <= recoveryIndex
    || (plainJumpIndex >= 0 && plainJumpIndex < windupIndex)) {
    throw new Error(`${milestone} did not preserve the direct authoritative jump-attack lifecycle: ${JSON.stringify(ownTransitions)}`);
  }

  if (observerState.acceptance?.scenario !== "uijumprecoveryffa"
    || observerState.acceptance.playerNetId !== observerId
    || observerState.acceptance.focusNetId !== closerId) {
    throw new Error(`${milestone} observer did not return to closer idle focus after recovery: ${JSON.stringify(observerState.acceptance)}`);
  }

  if (evidence.some((entry) => entry.playerHp !== 100 || entry.playerGuard !== 100)) {
    throw new Error(`${milestone} off-axis jump/recovery focus proof changed authoritative vitals: ${JSON.stringify(evidence)}`);
  }
  if (observerState.recoveryVisible || observerState.focusLabel !== `NEAREST #${closerId}`) {
    throw new Error(`${milestone} recovery focus did not clear back to the ordinary nearest rival: ${JSON.stringify(observerState)}`);
  }

  return evidence.map((entry) => ({
    ...entry,
    m143JumpAttackerId: jumpId,
    m143ObserverId: observerId,
    m143CloserIdleId: closerId,
  }));
}

async function runOnlineUiJumpRecoveryFfaPunishFlight(entries) {
  const milestone = "M147 actionable FFA jump-recovery punish";
  if (entries.length !== 3) {
    throw new Error(`${milestone} expected three real browser clients, received ${entries.length}`);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const ordered = ready.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const ids = ordered.map((entry) => entry.playerNetId);
  if (ids.length !== 3 || new Set(ids).size !== 3) {
    throw new Error(`${milestone} did not resolve three authoritative identities: ${JSON.stringify(ready)}`);
  }

  const jumpAttacker = entries.find((entry) => entry.name === ordered[0].browser);
  const observer = entries.find((entry) => entry.name === ordered[1].browser);
  const closerIdle = entries.find((entry) => entry.name === ordered[2].browser);
  if (!jumpAttacker || !observer || !closerIdle) {
    throw new Error(`${milestone} could not map deterministic FFA roles: ${JSON.stringify(ready)}`);
  }

  await waitForUiThreePlayerReady(entries, ids, 2500);
  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  const [jumpArena, observerArena] = await Promise.all([
    resolveArenaElement(jumpAttacker, milestone),
    resolveArenaElement(observer, milestone),
  ]);
  await Promise.all(entries.map(centerArenaInViewport));

  const jumpId = ordered[0].playerNetId;
  const observerId = ordered[1].playerNetId;
  const closerId = ordered[2].playerNetId;

  // Bring both rivals inside normal light-attack distance from Firefox, but
  // move #3 farther inward so ordinary focus still prefers the idle right-side
  // rival. The later recovery override must therefore be what selects #1.
  // M147: one real W3C keyboard action bounds the PHYSICAL hold, unlike
  // separate keyDown/keyUp HTTP requests that stretched 210/260ms to >1s.
  // Keep original World positions, normal focus and strict proof unchanged.
  await Promise.all([
    pulseM147FocusStageKey(jumpAttacker, "d", 210),
    pulseM147FocusStageKey(closerIdle, "a", 260),
  ]);
  await sleep(80);

  let baseline = await Promise.all(entries.map(readUiEvidence));
  let observerBefore = baseline.find((entry) => entry.browser === observer.name);
  // A native hold duration is not proof of World displacement. Reuse M121's
  // existing replica-driven, interior-Light-range movement planner, with real
  // bounded WASD only. Stage before the recovery/input proof window begins.
  const { planM121NativeGeometry } = await import("./m121-native-geometry-plan.mjs");
  const nativeGeometry = [];
  let geometryReady = false;
  await sleep(310); // separate any corrective key from the original D/A taps
  for (let attempt = 0; attempt < 8; attempt += 1) {
    baseline = await Promise.all(entries.map(readUiEvidence));
    observerBefore = baseline.find(entry => entry.browser === observer.name);
    const fighters = observerBefore?.acceptance?.fighters ?? [];
    const victim = fighters.find(fighter => fighter.netId === jumpId);
    const punisher = fighters.find(fighter => fighter.netId === observerId);
    const plan = planM121NativeGeometry(victim, punisher, true);
    nativeGeometry.push({serverTick: observerBefore.acceptance.serverTick, fighters, plan});
    if (plan) {
      await pulseMovementKeyBoundedW3c(jumpAttacker, plan.key, plan.durationMs);
      await sleep(310); // genuine repeated keys must not accidentally request Dash
      continue;
    }
    await sleep(80);
    const stable = await readUiEvidence(observer);
    const stableVictim = stable.acceptance?.fighters?.find(fighter => fighter.netId === jumpId);
    const stablePunisher = stable.acceptance?.fighters?.find(fighter => fighter.netId === observerId);
    if (stable.acceptance?.serverTick > observerBefore.acceptance.serverTick
      && !planM121NativeGeometry(stableVictim, stablePunisher, true)
      && Math.hypot(stableVictim.x - victim.x, stableVictim.y - victim.y) <= 2
      && Math.hypot(stablePunisher.x - punisher.x, stablePunisher.y - punisher.y) <= 2) {
      geometryReady = true;
      baseline = await Promise.all(entries.map(readUiEvidence));
      observerBefore = baseline.find(entry => entry.browser === observer.name);
      break;
    }
  }
  console.log("M147_NATIVE_INTERIOR_GEOMETRY " + JSON.stringify({nativeGeometry, geometryReady}));
  if (!geometryReady) throw new Error(`${milestone} actual replica geometry did not converge before the single JumpAttack`);
  for (let attempt = 0; attempt < 3 && observerBefore?.focusLabel !== `NEAREST #${closerId}`; attempt += 1) {
    // Original R2 interprets two real KeyA DOWN edges <=240ms apart as Dash.
    // The first 260ms staging A and previous corrective A are real taps too.
    // Separate every additional physical tap by >240ms: no synthetic
    // movement, no change to World authority, and no false focus acceptance.
    await sleep(300);
    await pulseM147FocusStageKey(closerIdle, "a", 45);
    await sleep(55);
    baseline = await Promise.all(entries.map(readUiEvidence));
    observerBefore = baseline.find((entry) => entry.browser === observer.name);
  }
  const jumpBefore = baseline.find((entry) => entry.browser === jumpAttacker.name);
  const closerBefore = baseline.find((entry) => entry.browser === closerIdle.name);
  if (!jumpBefore || !observerBefore || !closerBefore) {
    throw new Error(`${milestone} missing staged evidence: ${JSON.stringify(baseline)}`);
  }
  if (observerBefore.focusLabel !== `NEAREST #${closerId}`) {
    throw new Error(`${milestone} did not establish closer idle #${closerId} as ordinary focus: ${JSON.stringify(baseline)}`);
  }
  if (baseline.some((entry) => entry.playerHp !== 100 || entry.playerGuard !== 100)) {
    throw new Error(`${milestone} staging changed authoritative vitals: ${JSON.stringify(baseline)}`);
  }

  if (baseline.length !== 3 || !baseline.every(entry => entry.playerHp === 100 && entry.playerGuard === 100)) {
    throw new Error(`${milestone} preflight vitals must be pristine: ${JSON.stringify(baseline)}`);
  }
  const stagingFighters = observerBefore.acceptance?.fighters ?? [];
  const stagedVictim = stagingFighters.find(f => f.netId === jumpId);
  const stagedPunisher = stagingFighters.find(f => f.netId === observerId);
  const stagedCloser = stagingFighters.find(f => f.netId === closerId);
  const stagingGap = stagedVictim && stagedPunisher
    ? Math.hypot(stagedVictim.x - stagedPunisher.x, stagedVictim.y - stagedPunisher.y) : null;
  console.log("M147_STAGING_GEOMETRY " + JSON.stringify({
    serverTick: observerBefore.acceptance?.serverTick, fighters: stagingFighters,
    victimId: jumpId, punisherId: observerId, closerId, stagingGap,
    unchangedContactReach: COMBAT.attack.reach + COMBAT.fighterRadius,
  }));
  if (!stagedVictim || !stagedPunisher || !stagedCloser || !Number.isFinite(stagingGap)
    || stagingGap > COMBAT.attack.reach + COMBAT.fighterRadius
    || !(stagedVictim.x < stagedPunisher.x && stagedPunisher.x < stagedCloser.x)) {
    throw new Error(`${milestone} actual staged replicas are outside the original Light contact geometry`);
  }
  const jumpKeyOffset = jumpBefore.keyTransitions.length;
  const jumpPointerOffset = jumpBefore.pointers.length;
  const observerPointerOffset = observerBefore.pointers.length;
  const observerFocusOffset = observerBefore.focusTransitions.length;
  const observerRecoveryOffset = observerBefore.recoveryTransitions.length;

  // Whiff the narrow jump attack away from Firefox. #1 stays close enough to be
  // hit by Firefox's normal light attack, while #3 remains closer on the right.
  // Pre-aim while idle: no extra pointer move/driver tick on the punish path.
  await aimArena(observer, observerArena, -200);
  await aimArena(jumpAttacker, jumpArena, -200);
  await sleep(40);
  const worldProofOffset = m201ServerOutput().length;
  // Independent real drivers: observe the rendered cue without awaiting the
  // other driver's jump command ACK. Every command is still awaited below.
  // The mouse is already aimed above. Reuse the existing pointer-first native
  // chord: an extra pointerMove tick let Space precede LMB by 163ms in #1077.
  // Actual trusted-event spacing and original World gates remain mandatory.
  const jumpCommand = performArenaPreAimedJumpAttackChord(jumpAttacker, 90)
    .then(() => null, (error) => error);
  let recoveryCue = null;
  try {
    // Use the already-supported native W3C asynchronous browser observer
    // rather than many sequential WebDriver HTTP scalar polls. The only
    // observed signal is the SAME actually rendered recovery/focus/vitals
    // gate, registered before the genuine Firefox LMB is dispatched.
    // No fabricated action, input writer or World timeline is introduced.
    recoveryCue = await webdriver(observer.base, "POST",
      `/session/${observer.sessionId}/execute/async`, {
        script: `
          const [offset, victimId, timeoutMs] = arguments;
          const done = arguments[arguments.length - 1];
          const started = performance.now();
          const inspect = () => {
            const state = window.__MYASO_M30_UI__ ?? {};
            const recovery = document.querySelector('#opponent-recovery');
            const focus = document.querySelector('#focus-label')?.textContent?.trim();
            const entry = (state.recoveryTransitions ?? []).slice(offset)
              .find((row) => row.visible && row.state === 'jump-attack-recovery'
                && row.label === 'PUNISH' && row.detail === 'Jump attack recovery'
                && Number.isFinite(row.epochMs));
            const pristine = ['#player-hp-value', '#player-guard-value',
              '#bot-hp-value', '#bot-guard-value'].every((selector) =>
                document.querySelector(selector)?.textContent?.trim() === '100');
            return entry && recovery && !recovery.hidden
              && recovery.dataset.state === 'jump-attack-recovery'
              && focus === 'PUNISH TARGET #' + victimId && pristine
              ? { ...entry, focusLabel: focus } : null;
          };
          // A physically authentic click can be dispatched as soon as the
          // first REAL selected recovery cue appears; the 30ms continuous
          // UI/focus/vitals verification remains independently mandatory.
          // Previously serializing this verification BEFORE native WebDriver
          // consumed 30ms of the unchanged 450ms World recovery. Run its
          // read-only 4ms observer in parallel, and FAIL the same trial if
          // the original cue/focus disappears before 30ms.
          const stability = window.__MYASO_M147_NATIVE_CUE_STABILITY__ = {
            status: 'waiting', first: null, verifiedMs: null,
          };
          let poll;
          let stableCue = null;
          let stableSince = null;
          let dispatched = false;
          const check = () => {
            const cue = inspect();
            const now = performance.now();
            if (cue) {
              if (!stableCue || stableCue.epochMs !== cue.epochMs
                  || stableCue.focusLabel !== cue.focusLabel) {
                if (dispatched) {
                  stability.status = 'invalidated';
                  stability.reason = 'original cue identity or focus changed before 30ms';
                  clearInterval(poll);
                  return;
                }
                stableCue = cue;
                stableSince = now;
              }
              if (!dispatched) {
                dispatched = true;
                stability.status = 'verifying';
                stability.first = { ...cue, observedAtPerfMs: now };
                done(cue); // authorized genuine W3C action; not a DOM event
              }
              if (now - stableSince >= 30) {
                stability.status = 'verified';
                stability.verifiedMs = now - stableSince;
                clearInterval(poll);
                return;
              }
            } else if (dispatched) {
              stability.status = 'invalidated';
              stability.reason = 'real recovery/focus/vitals disappeared before 30ms';
              clearInterval(poll);
              return;
            }
            if (now - started >= timeoutMs) {
              clearInterval(poll);
              if (!dispatched) done(null);
              else {
                stability.status = 'invalidated';
                stability.reason = '30ms genuine recovery verification timed out';
              }
            }
          };
          poll = setInterval(check, 4);
          check();
        `,
        args: [observerRecoveryOffset, jumpId, 900],
      });
    if (!isM147RenderedRecoveryCue(recoveryCue, jumpId)) {
      throw new Error(`${milestone} never rendered the actual pristine jump-recovery PUNISH cue`);
    }
    // Physical Firefox DOWN/UP is still exactly one real, already pre-aimed
    // W3C pointer transaction with zero pause. Check the 30ms actual cue
    // stability AFTER its issue rather than serializing this avoidable wait
    // inside the 450ms World recovery. Any invalidation is a terminal RED.
    // The authoritative original World HIT-before-exit gate is unchanged.
    const nativeIssuedEpochMs = Date.now();
    await performArenaM221GuardBreakClick(observer, 0);
    const nativeAckEpochMs = Date.now();
    const cueStability = await webdriver(observer.base, "POST",
      `/session/${observer.sessionId}/execute/async`, {
        script: `
          const done = arguments[arguments.length - 1];
          const started = performance.now();
          const read = () => {
            const status = window.__MYASO_M147_NATIVE_CUE_STABILITY__;
            if (!status || status.status === 'verified'
                || status.status === 'invalidated') {
              clearInterval(poll);
              done(status ?? {status: 'missing'});
            } else if (performance.now() - started >= 600) {
              clearInterval(poll);
              done({ ...status, status: 'unverified-timeout' });
            }
          };
          const poll = setInterval(read, 4);
          read();
        `,
        args: [],
      });
    console.log("M147_NATIVE_CUE_PARALLEL_STABILITY " + JSON.stringify({
      cue: recoveryCue,
      stability: cueStability,
      nativeIssuedEpochMs,
      nativeAckEpochMs,
      originalHostRequestDurationMs: nativeAckEpochMs - nativeIssuedEpochMs,
    }));
    if (cueStability?.status !== 'verified'
        || !(cueStability.verifiedMs >= 30)
        || cueStability.first?.epochMs !== recoveryCue.epochMs
        || cueStability.first?.focusLabel !== recoveryCue.focusLabel) {
      throw new Error(`${milestone} genuine recovery cue did not remain stable for 30ms during physical pointer input: ${JSON.stringify(cueStability)}`);
    }
  } finally {
    const jumpError = await jumpCommand;
    if (jumpError) throw jumpError;
  }
  // Full recorded lifecycle/focus/input evidence is validated below. The World
  // classifier additionally rejects every earlier HIT/BLOCK/PARRY/BREAK, so
  // pristine baseline/final vitals cannot hide jump contact or guard recovery.

  let hitEvidence = null;
  const hitDeadline = Date.now() + 800;
  while (Date.now() < hitDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const jumpState = states.find((entry) => entry.browser === jumpAttacker.name);
    const observerState = states.find((entry) => entry.browser === observer.name);
    const closerState = states.find((entry) => entry.browser === closerIdle.name);
    if (!jumpState || !observerState || !closerState) {
      throw new Error(`${milestone} incomplete punish evidence: ${JSON.stringify(states)}`);
    }
    if (hasM147PunishFeedback(states, {
      jumpBrowser: jumpAttacker.name, observerBrowser: observer.name, closerBrowser: closerIdle.name,
    })) {
      hitEvidence = states;
      break;
    }
    if (jumpState.playerHp < 66 || observerState.playerHp !== 100 || closerState.playerHp !== 100
      || jumpState.playerGuard !== 100 || observerState.playerGuard !== 100 || closerState.playerGuard !== 100) {
      throw new Error(`${milestone} punish resolved against the wrong fighter or extra combat: ${JSON.stringify(states)}`);
    }
    await sleep(10);
  }
  if (!hitEvidence) {
    const failureStates = await Promise.all(entries.map(readUiEvidence));
    console.log("M147_MISSED_CONTACT_DIAGNOSTIC " + JSON.stringify({
      actors: {victim: jumpId, punisher: observerId, closer: closerId},
      staging: {fighters: stagingFighters, stagingGap}, cue: recoveryCue,
      final: failureStates.map(row => ({browser: row.browser, id: row.playerNetId,
        hp: row.playerHp, guard: row.playerGuard, focus: row.focusLabel,
        serverTick: row.acceptance?.serverTick, fighters: row.acceptance?.fighters,
        ownActions: row.acceptance?.ownActionTransitions, pointers: row.pointers.slice(-4)})),
      world: m201ServerOutput().slice(worldProofOffset).split(/\r?\n/)
        .filter(line => /^M201_AUTH_(?:ACTION|HIT|BLOCK|PARRY|BREAK) /.test(line)),
    }));
    throw new Error(`${milestone} real Firefox light did not damage selected jump-recovery target #${jumpId}; see M147_MISSED_CONTACT_DIAGNOSTIC`);
  }

  // Wait for #1 to finish recovery and for Firefox to return to the still-idle
  // closer #3. This keeps the final focus identity unambiguous.
  let evidence = hitEvidence;
  const settleDeadline = Date.now() + 700;
  while (Date.now() < settleDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const jumpState = states.find((entry) => entry.browser === jumpAttacker.name);
    const observerState = states.find((entry) => entry.browser === observer.name);
    const ownTransitions = jumpState?.acceptance?.ownActionTransitions ?? [];
    const recoveryIndex = ownTransitions.findIndex((entry) =>
      entry.action === COMBAT_ACTION.jumpAttackRecovery && Number.isFinite(entry.epochMs));
    const idleIndex = ownTransitions.findIndex((entry, index) =>
      index > recoveryIndex && entry.action === COMBAT_ACTION.idle && Number.isFinite(entry.epochMs));
    if (recoveryIndex >= 0 && idleIndex > recoveryIndex
      && observerState?.focusLabel === `NEAREST #${closerId}`) {
      evidence = states;
      break;
    }
    await sleep(10);
  }

  const jumpState = evidence.find((entry) => entry.browser === jumpAttacker.name);
  const observerState = evidence.find((entry) => entry.browser === observer.name);
  const closerState = evidence.find((entry) => entry.browser === closerIdle.name);
  if (!jumpState || !observerState || !closerState) {
    throw new Error(`${milestone} incomplete final evidence: ${JSON.stringify(evidence)}`);
  }

  const jumpKeys = jumpState.keyTransitions.slice(jumpKeyOffset);
  const jumpPointers = jumpState.pointers.slice(jumpPointerOffset);
  const spaceDowns = jumpKeys.filter((entry) => entry.type === "keydown" && entry.code === "Space");
  const spaceUps = jumpKeys.filter((entry) => entry.type === "keyup" && entry.code === "Space");
  const jumpDowns = jumpPointers.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
  const jumpUps = jumpPointers.filter((entry) => entry.type === "pointerup" && entry.button === 0);
  if (spaceDowns.length !== 1 || spaceUps.length !== 1 || jumpDowns.length !== 1 || jumpUps.length !== 1
    || !Number.isFinite(spaceDowns[0]?.epochMs) || !Number.isFinite(jumpDowns[0]?.epochMs)
    || Math.abs(spaceDowns[0].epochMs - jumpDowns[0].epochMs) > 60
    || jumpDowns[0].x >= 0.5) {
    throw new Error(`${milestone} lacked one genuine off-axis same-tick Space + LMB chord: ${JSON.stringify({ jumpKeys, jumpPointers })}`);
  }

  const punishPointers = observerState.pointers.slice(observerPointerOffset);
  const punishDowns = punishPointers.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
  const punishUps = punishPointers.filter((entry) => entry.type === "pointerup" && entry.button === 0);
  const punishDown = punishDowns[0];
  if (punishDowns.length !== 1 || punishUps.length !== 1
    || !Number.isFinite(punishDown?.epochMs) || punishDown.x >= 0.5) {
    throw new Error(`${milestone} lacked one genuine left-aimed Firefox punish LMB: ${JSON.stringify(punishPointers)}`);
  }

  const lifecycle = jumpState.acceptance?.ownActionTransitions ?? [];
  const recoveryIndex = lifecycle.findIndex((entry) =>
    entry.action === COMBAT_ACTION.jumpAttackRecovery && Number.isFinite(entry.epochMs));
  const idleIndex = lifecycle.findIndex((entry, index) =>
    index > recoveryIndex && entry.action === COMBAT_ACTION.idle && Number.isFinite(entry.epochMs));
  const recovery = lifecycle[recoveryIndex];
  const idle = lifecycle[idleIndex];
  // Combat4C read-only fail-first provenance: cross-browser UI timestamps can
  // disagree with the original Rust World entry/exit ticks. Emit evidence
  // before the STRICT browser-order assertion so a red native trial still
  // preserves both clocks, actual source0 submissions and original contact.
  // Do not classify the HIT or change any acceptance gate here.
  const beforeLifecycleWorldTrace = m201ServerOutput().slice(worldProofOffset);
  console.log("M147_PRE_LIFECYCLE_WORLD_DIAGNOSTIC " + JSON.stringify({
    actors: { victim: jumpId, punisher: observerId, idle: closerId },
    cue: recoveryCue,
    physical: { jumpDown: jumpDowns[0], jumpUp: jumpUps[0],
      punishDown: punishDowns[0], punishUp: punishUps[0] },
    victimUiRecovery: { entry: recovery, exit: idle },
    inputSubmissions: (observerState.acceptance?.inputSubmissions ?? []).slice(-10),
    browserInputChronology: (observerState.m147InputPlane ?? []).slice(-32),
    source0Samples: (observerState.acceptance?.m121SentSamples ?? []).slice(-10),
    originalWorldEvents: beforeLifecycleWorldTrace.split(/\r?\n/)
      .filter((line) => /^M201_AUTH_(?:ACTION|HIT|BLOCK|PARRY|BREAK) /.test(line))
      .slice(-24),
  }));
  // The victim and punisher are different REAL browser event loops. Their
  // snapshot callbacks can stamp the very same World recovery 10–20ms apart:
  // in genuine first-red #40506439872 a real Firefox PUNISH cue was recorded
  // at epoch ...0574, its trusted DOWN at ...0580, but the victim browser did
  // not observe its own already-active recovery until ...0590. Do not turn
  // that cross-client UI delivery order into fictional World ordering.
  //
  // Instead STRICTLY require the original Rust World proof NOW: exactly
  // one source-owned Light windup, active, HIT34/HP66 against actor1 WHILE
  // its Action18 recovery was active and BEFORE its exact 27-tick exit.
  // The punisher's own real selected recovery cue must still precede its
  // trusted physical DOWN, checked below; no early/out-of-window HIT passes.
  const actualWorldTrace = beforeLifecycleWorldTrace;
  const worldRecoveryProof = verifyM147WorldRecoveryProof(
    actualWorldTrace, { jumpId, punisherId: observerId, closerId },
  );
  console.log("M147_CROSS_BROWSER_SNAPSHOT_CHRONOLOGY " + JSON.stringify({
    cueEpochMs: recoveryCue?.epochMs,
    physicalDownEpochMs: punishDown.epochMs,
    victimUiRecoveryEntryEpochMs: recovery?.epochMs,
    victimUiRecoveryExitEpochMs: idle?.epochMs,
    victimUiEntryMinusPhysicalDownMs: Number.isFinite(recovery?.epochMs)
      ? recovery.epochMs - punishDown.epochMs : null,
    originalWorldRecoveryTick: worldRecoveryProof.jump.recovery.tick,
    originalWorldHitTick: worldRecoveryProof.hit.tick,
    originalWorldRecoveryExitTick: worldRecoveryProof.jump.idle.tick,
  }));
  if (jumpState.acceptance?.scenario !== "uijumppunishffa"
    || observerState.acceptance?.scenario !== "uijumppunishffa"
    || closerState.acceptance?.scenario !== "uijumppunishffa"
    || recoveryIndex < 0 || idleIndex <= recoveryIndex
    || !Number.isFinite(recoveryCue?.epochMs)
    || punishDown.epochMs < recoveryCue.epochMs) {
    throw new Error(`${milestone} Firefox did not act on the selected genuine recovery cue during original World recovery: ${JSON.stringify({
      punishDown, recoveryCue, recovery, idle, lifecycle, worldRecoveryProof,
    })}`);
  }

  const focusTransitions = observerState.focusTransitions.slice(observerFocusOffset);
  const punishFocus = focusTransitions.find((entry) => entry.label === `PUNISH TARGET #${jumpId}`);
  const returnFocus = focusTransitions.find((entry) => entry.label === `NEAREST #${closerId}`);
  if (!punishFocus || !returnFocus
    || (Number.isFinite(punishFocus.epochMs) && punishDown.epochMs < punishFocus.epochMs)
    || !Number.isFinite(recoveryCue.epochMs)
    || punishDown.epochMs < recoveryCue.epochMs
    || punishDown.epochMs - recoveryCue.epochMs > 190) {
    throw new Error(`${milestone} real punish did not promptly act on the selected recovery cue: ${JSON.stringify({
      focusTransitions,
      recoveryCue,
      punishDown,
    })}`);
  }

  if (jumpState.playerHp !== 66 || jumpState.playerGuard !== 100
    || observerState.playerHp !== 100 || observerState.playerGuard !== 100
    || closerState.playerHp !== 100 || closerState.playerGuard !== 100) {
    throw new Error(`${milestone} final vitals did not prove exactly one 34-damage hit on #${jumpId}: ${JSON.stringify(evidence)}`);
  }
  if (!jumpState.events.includes("Hit taken - 34 HP.")
    || !observerState.events.includes("Opponent hit - 34 HP.")
    || closerState.events.includes("Hit taken - 34 HP.")
    || observerState.events.includes("Hit taken - 42 HP.")
    || closerState.events.includes("Hit taken - 42 HP.")) {
    throw new Error(`${milestone} feedback did not identify the selected punish target cleanly: ${JSON.stringify(evidence)}`);
  }
  if (observerState.focusLabel !== `NEAREST #${closerId}`) {
    throw new Error(`${milestone} HUD did not return to closer idle #${closerId} after the punish window: ${JSON.stringify(observerState)}`);
  }

  const punishUp = punishUps[0];
  if (!Number.isFinite(punishUp?.epochMs) || punishUp.epochMs <= punishDown.epochMs
      || punishUp.epochMs - punishDown.epochMs >= 320
      || !punishDown.trusted || !punishUp.trusted
      || punishDown.pointerId !== punishUp.pointerId) {
    throw new Error(`${milestone} did not preserve one genuine same-pointer short release: ${JSON.stringify({ punishDown, punishUp })}`);
  }
  // Read-only native chronology BEFORE the strict World proof. Keep a
  // bounded actor/tick/input timeline even when the HIT is too late; this
  // does not create input, change the choreography, or waive any assertion.
  console.log("M147_PRE_GATE_CHRONOLOGY " + JSON.stringify({
    actors: { victim: jumpId, punisher: observerId, idle: closerId },
    cue: { epochMs: recoveryCue.epochMs, t: recoveryCue.t,
      state: recoveryCue.state, detail: recoveryCue.detail,
      focusLabel: recoveryCue.focusLabel },
    physical: { jumpDown: jumpDowns[0], jumpUp: jumpUps[0],
      punishDown, punishUp, },
    recovery: { entry: recovery, exit: idle },
    focus: focusTransitions.slice(-6),
    inputSubmissions: (observerState.acceptance?.inputSubmissions ?? []).slice(-10),
    browserInputChronology: (observerState.m147InputPlane ?? []).slice(-32),
    sentSamples: (observerState.acceptance?.m121SentSamples ?? []).slice(-10),
    worldActions: actualWorldTrace.split(/\r?\n/)
      .filter((line) => /^M201_AUTH_(?:ACTION|HIT|BLOCK|PARRY|BREAK) /.test(line))
      .slice(-24),
  }));
  console.log(`M147_WORLD_RECOVERY_PROOF ${JSON.stringify(worldRecoveryProof)}`);

  return evidence.map((entry) => ({
    ...entry,
    m147JumpTargetId: jumpId,
    m147ObserverId: observerId,
    m147CloserIdleId: closerId,
    m147PunishEpochMs: entry.browser === observer.name ? punishDown.epochMs : null,
  }));
}

async function runOnlineUiMultiRecoveryFfaFocusFlight(entries, spatial = false) {
  const milestone = spatial ? "M145 spatial recovery handoff" : "M144 simultaneous recovery FFA focus";
  const expectedScenario = spatial ? "uimultirecoveryspatial" : "uimultirecoveryffa";
  if (entries.length !== 3) {
    throw new Error(`${milestone} expected three real browser clients, received ${entries.length}`);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const ordered = ready.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const ids = ordered.map((entry) => entry.playerNetId);
  if (ids.length !== 3 || new Set(ids).size !== 3) {
    throw new Error(`${milestone} did not resolve three authoritative identities: ${JSON.stringify(ready)}`);
  }

  const jumpAttacker = entries.find((entry) => entry.name === ordered[0].browser);
  const observer = entries.find((entry) => entry.name === ordered[1].browser);
  const lightAttacker = entries.find((entry) => entry.name === ordered[2].browser);
  if (!jumpAttacker || !observer || !lightAttacker) {
    throw new Error(`${milestone} could not map deterministic FFA roles: ${JSON.stringify(ready)}`);
  }

  await waitForUiThreePlayerReady(entries, ids, 2500);
  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  const [jumpArena, lightArena] = await Promise.all([
    resolveArenaElement(jumpAttacker, milestone),
    resolveArenaElement(lightAttacker, milestone),
  ]);
  await Promise.all(entries.map(centerArenaInViewport));

  const jumpId = ordered[0].playerNetId;
  const observerId = ordered[1].playerNetId;
  const lightId = ordered[2].playerNetId;

  // Pull #3 inward so it is unambiguously the nearest rival and, later, the
  // nearest of two simultaneous recovery targets.
  await pulseMovementKey(lightAttacker, "a", 280);
  await sleep(80);

  let baseline = await Promise.all(entries.map(readUiEvidence));
  let observerBefore = baseline.find((entry) => entry.browser === observer.name);
  for (let attempt = 0; attempt < 3 && observerBefore?.focusLabel !== `NEAREST #${lightId}`; attempt += 1) {
    await pulseMovementKey(lightAttacker, "a", 70);
    await sleep(60);
    baseline = await Promise.all(entries.map(readUiEvidence));
    observerBefore = baseline.find((entry) => entry.browser === observer.name);
  }
  const jumpBefore = baseline.find((entry) => entry.browser === jumpAttacker.name);
  const lightBefore = baseline.find((entry) => entry.browser === lightAttacker.name);
  if (!jumpBefore || !observerBefore || !lightBefore) {
    throw new Error(`${milestone} missing staged evidence: ${JSON.stringify(baseline)}`);
  }
  if (observerBefore.focusLabel !== `NEAREST #${lightId}`) {
    throw new Error(`${milestone} did not establish #${lightId} as the ordinary nearest rival: ${JSON.stringify(baseline)}`);
  }
  if (baseline.some((entry) => entry.playerHp !== 100 || entry.playerGuard !== 100)) {
    throw new Error(`${milestone} staging changed authoritative vitals: ${JSON.stringify(baseline)}`);
  }

  // M334: aim the genuine native mouse before any light timing begins.
  // A movement in the previous multi-source jump action delayed real LMB
  // behind Space by 62ms on loaded Chromium, breaching the original <=60ms
  // same-tick requirement. Pre-aim while idle; press both in the first W3C
  // tick without synthetic events or acceptance-window changes.
  await aimArena(jumpAttacker, jumpArena, -200);

  const jumpKeyOffset = jumpBefore.keyTransitions.length;
  const jumpPointerOffset = jumpBefore.pointers.length;
  const lightPointerOffset = lightBefore.pointers.length;
  const observerFocusOffset = observerBefore.focusTransitions.length;
  const observerRecoveryOffset = observerBefore.recoveryTransitions.length;

  // Both attacks deliberately point away from Firefox so the proof is about
  // recovery arbitration, not damage. Start the shorter light attack first.
  // Keep both recovery windows overlapping, but leave enough authoritative
  // server ticks after #3 exits recovery for Firefox to observe #1 as the
  // remaining punishable target. The older 45 ms M144 stagger left only about
  // two server ticks for that handoff under loaded CI.
  // M234: use the same authentic trusted Chrome2 pointerdown receipt for
  // both M144 and M145. M145 previously started its 100ms timer when Node
  // dispatched concurrent WebDriver commands, rather than when the browser
  // actually observed the light attack. Under load that could shift the
  // genuine 70..150ms M145 overlap window. Keep both original delays and
  // all actual-input, 100 HP, 3-stage HUD and server assertions unchanged.
  // M328: genuine Chrome2 LMB held 90ms crossed the R2 80ms heavy-upgrade
  // classifier on exact-head CI #39303383627: #3 transitioned light
  // windup(1) -> heavy windup(9) -> active(10) -> recovery(11). That made
  // #1 recover BEFORE #3, correctly failing strict M144 focus order.
  // Dispatch one genuine 45ms short click instead, below the 80ms classifier.
  // Preserve real pointerDOWN/UP, M144 60..200ms release-to-jump and M145
  // 70..150ms pointerDOWN-to-jump, server phases, HP and pixel assertions.
  // M144 anchors the genuine jump to the authenticated light release:
  // 70ms after release instead of a timer drifting after pointerDOWN.
  // M145 retains its independent 100ms trusted-down choreography and the
  // original measured 70..150ms spatial input lead gate unchanged.
  // Spatial M145 remains anchored to genuine light DOWN. M144 anchors to
  // genuine light UP, when the R1 short attack is already classified, so
  // WebDriver/HTTP startup jitter cannot consume its recovery overlap.
  // Both unchanged strict 60..200ms and 70..150ms windows are checked below.
  // M326: stage the genuine M145 W3C chord 20ms earlier after the trusted
  // light pointerDOWN receipt. Keep the strict measured 70..150ms lead gate,
  // genuine native Space/LMB inputs, and independent M144 release delay intact.
  const jumpInputDelayMs = spatial ? 80 : 70;
  const lightChallenge = m227Registry.issue({ type: spatial ? "pointerdown" : "pointerup" });
  if (lightChallenge) {
    await execute(lightAttacker.base, lightAttacker.sessionId,
      "window.__MYASO_M227_LIGHT_TOKEN__ = " + JSON.stringify(lightChallenge.token)
        + "; window.__MYASO_M227_LIGHT_TOKEN_TYPE__ = " + JSON.stringify(spatial ? "pointerdown" : "pointerup")
        + "; return true;");
  }
  let spatialSamples = [];
  if (spatial) await armRecoveryHandoffSampler(observer);
  try {
    await Promise.all([
      performArenaAttackHold(lightAttacker, lightArena, 200, 45),
      (async () => {
        if (lightChallenge) {
          const receipt = await lightChallenge.wait();
          console.log((spatial ? "M234_TRUSTED_SPATIAL_LIGHT_ONSET " : "M227_TRUSTED_LIGHT_RELEASE ") + JSON.stringify({
            milestone, scenario: expectedScenario, ...receipt,
          }));
        }
        await sleep(jumpInputDelayMs);
        // M336/M144: real Space+LMB reached the Chrome DOM together but
        // loaded exact-head quality #40184398389 still showed ZERO original
        // World actions for #1 while #3 completed its light recovery.
        // Preserve one genuine W3C chord and allow 180ms for original
        // 60Hz input sampling, as M145 already does. Keep the unchanged
        // strict 60/70/150/200ms onset, server phase, focus and vitals gates.
        await performArenaPreAimedJumpAttackChord(jumpAttacker, 180);
      })(),
      // R1 M144: light commits on release and its 185ms delayed jump now
      // correctly yields #3 recovery before #1 recovery. Observe long enough
      // for the subsequent genuine #1 recovery to CLEAR and Firefox to return
      // to ordinary #3 focus. Keep all strict three-stage and server proofs.
      // M245: M145's 760ms read-only observation could stop while the
      // SECOND authentic recovery remained active even though the two
      // required punish-target transitions already occurred. Keep its
      // genuine 70..150ms input-lead, server tick, exact three-stage focus,
      // 100HP and independent remote pixel proof gates unchanged; observe
      // the real recovery until it can return to ordinary nearest focus.
      sampleUiEvidenceWhileActive(entries, 1250, 8),
    ]);
  } finally {
    lightChallenge?.close();
  }
  if (spatial) spatialSamples = await stopRecoveryHandoffSampler(observer);

  const evidence = await Promise.all(entries.map(readUiEvidence));
  const jumpState = evidence.find((entry) => entry.browser === jumpAttacker.name);
  const observerState = evidence.find((entry) => entry.browser === observer.name);
  const lightState = evidence.find((entry) => entry.browser === lightAttacker.name);
  if (!jumpState || !observerState || !lightState) {
    throw new Error(`${milestone} incomplete final evidence: ${JSON.stringify(evidence)}`);
  }

  const focusTransitions = observerState.focusTransitions.slice(observerFocusOffset);
  const recoveryTransitions = observerState.recoveryTransitions.slice(observerRecoveryOffset);
  const lightPunishIndex = focusTransitions.findIndex((entry) => entry.label === `PUNISH TARGET #${lightId}`);
  const jumpPunishIndex = focusTransitions.findIndex((entry, index) =>
    index > lightPunishIndex && entry.label === `PUNISH TARGET #${jumpId}`);
  const nearestReturnIndex = focusTransitions.findIndex((entry, index) =>
    index > jumpPunishIndex && entry.label === `NEAREST #${lightId}`);
  if (lightPunishIndex < 0 || jumpPunishIndex <= lightPunishIndex || nearestReturnIndex <= jumpPunishIndex) {
    // M232: only on a genuine M145 spatial RED, include the already-captured
    // Firefox focus-label/ring pixel samples. Keep the original strict
    // 3-stage gate, authentic W3C input and authoritative evidence unchanged.
    const spatialFailureEvidence = spatial
      ? summarizeM232SpatialHandoffFailure(spatialSamples, { lightId, jumpId })
      : null;
    const m233FailureEvidence = spatial
      ? summarizeM233RecoveryHandoff(observerState.acceptance?.m233RecoveryHandoff, { lightId, jumpId })
      : null;
    throw new Error(`${milestone} did not arbitrate nearest punishable -> remaining punishable -> nearest rival: ${JSON.stringify({
      focusTransitions,
      evidence,
      ...(spatial ? { spatialFailureEvidence, m233FailureEvidence } : {}),
    })}`);
  }

  const lightRecoveryIndex = recoveryTransitions.findIndex((entry) =>
    entry.visible
    && entry.state === "attack-recovery"
    && entry.label === "PUNISH"
    && entry.detail === "Attack recovery");
  const jumpRecoveryIndex = recoveryTransitions.findIndex((entry, index) =>
    index > lightRecoveryIndex
    && entry.visible
    && entry.state === "jump-attack-recovery"
    && entry.label === "PUNISH"
    && entry.detail === "Jump attack recovery");
  const recoveryClearIndex = recoveryTransitions.findIndex((entry, index) =>
    index > jumpRecoveryIndex && !entry.visible);
  if (lightRecoveryIndex < 0 || jumpRecoveryIndex <= lightRecoveryIndex || recoveryClearIndex <= jumpRecoveryIndex) {
    throw new Error(`${milestone} did not render attack recovery -> jump recovery -> clear: ${JSON.stringify(recoveryTransitions)}`);
  }

  const jumpKeys = jumpState.keyTransitions.slice(jumpKeyOffset);
  const jumpPointers = jumpState.pointers.slice(jumpPointerOffset);
  const spaceDowns = jumpKeys.filter((entry) => entry.type === "keydown" && entry.code === "Space");
  const spaceUps = jumpKeys.filter((entry) => entry.type === "keyup" && entry.code === "Space");
  const jumpAttackDowns = jumpPointers.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
  const jumpAttackUps = jumpPointers.filter((entry) => entry.type === "pointerup" && entry.button === 0);
  if (spaceDowns.length !== 1 || spaceUps.length !== 1
    || jumpAttackDowns.length !== 1 || jumpAttackUps.length !== 1
    || !Number.isFinite(spaceDowns[0]?.epochMs) || !Number.isFinite(jumpAttackDowns[0]?.epochMs)
    || Math.abs(spaceDowns[0].epochMs - jumpAttackDowns[0].epochMs) > 60) {
    throw new Error(`${milestone} lacked one genuine same-tick Space + LMB jump chord: ${JSON.stringify({ jumpKeys, jumpPointers })}`);
  }
  if (jumpAttackDowns[0].x >= 0.5) {
    throw new Error(`${milestone} jump attacker was not deliberately aimed away from Firefox: ${JSON.stringify(jumpAttackDowns)}`);
  }

  const lightPointers = lightState.pointers.slice(lightPointerOffset);
  const lightDowns = lightPointers.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
  const lightUps = lightPointers.filter((entry) => entry.type === "pointerup" && entry.button === 0);
  if (lightDowns.length !== 1 || lightUps.length !== 1 || lightDowns[0].x <= 0.5) {
    throw new Error(`${milestone} lacked one genuine off-axis light attack from #${lightId}: ${JSON.stringify(lightPointers)}`);
  }
  if (!Number.isFinite(lightDowns[0]?.epochMs)
    || !Number.isFinite(lightUps[0]?.epochMs)
    || !Number.isFinite(jumpAttackDowns[0]?.epochMs)) {
    throw new Error(`${milestone} missing authentic timestamped light/jump input evidence: ${JSON.stringify({ lightDowns, lightUps, jumpAttackDowns })}`);
  }
  {
    const inputLeadMs = spatial
      ? jumpAttackDowns[0].epochMs - lightDowns[0].epochMs
      : jumpAttackDowns[0].epochMs - lightUps[0].epochMs;
    // M145 compares actual genuine pointerDOWN times; R1 M144 compares
    // genuine light pointerUP -> jump pointerDOWN because release commits light.
    const minLeadMs = spatial ? 70 : 60;
    const maxLeadMs = spatial ? 150 : 200;
    if (inputLeadMs < minLeadMs || inputLeadMs > maxLeadMs) {
      throw new Error(`${milestone} did not preserve the intended light-before-jump overlap: ${JSON.stringify({ inputLeadMs, minLeadMs, maxLeadMs, lightDowns, jumpAttackDowns })}`);
    }
  }

  // M211: sampled replicated ownActionTransitions may omit the authentic
  // 80ms attack-active state, while the read-only server has observed the
  // full 60Hz windup->active->recovery->idle edge chain. Preserve genuine
  // W3C input, sampled windup/recovery/idle, visible two-stage focus and
  // all 100HP/guard assertions; replace only the fallible sampled active
  // expectation with mandatory native server tick evidence.
  const jumpOwn = jumpState.acceptance?.ownActionTransitions ?? [];
  const lightOwn = lightState.acceptance?.ownActionTransitions ?? [];
  const jumpWindup = jumpOwn.findIndex((entry) => entry.action === COMBAT_ACTION.jumpAttackWindup);
  const jumpActiveSample = jumpOwn.findIndex((entry, index) => index > jumpWindup && entry.action === COMBAT_ACTION.jumpAttackActive);
  const jumpRecovery = jumpOwn.findIndex((entry, index) => index > jumpWindup && entry.action === COMBAT_ACTION.jumpAttackRecovery);
  const jumpIdle = jumpOwn.findIndex((entry, index) => index > jumpRecovery && entry.action === COMBAT_ACTION.idle);
  const lightWindup = lightOwn.findIndex((entry) => entry.action === COMBAT_ACTION.attackWindup);
  const lightActiveSample = lightOwn.findIndex((entry, index) => index > lightWindup && entry.action === COMBAT_ACTION.attackActive);
  const lightRecovery = lightOwn.findIndex((entry, index) => index > lightWindup && entry.action === COMBAT_ACTION.attackRecovery);
  const lightIdle = lightOwn.findIndex((entry, index) => index > lightRecovery && entry.action === COMBAT_ACTION.idle);
  let authoritativeLifecycles = null;
  let proofFailure = null;
  const proofDeadline = Date.now() + 180;
  while (!authoritativeLifecycles && Date.now() < proofDeadline) {
    try {
      authoritativeLifecycles = verifyM211DualRecoveryServerProof(m201ServerOutput(), {
        jumpId, lightId, observerId,
      });
    } catch (error) {
      proofFailure = error?.message ?? String(error);
      await sleep(8);
    }
  }
  if (jumpState.acceptance?.scenario !== expectedScenario
    || lightState.acceptance?.scenario !== expectedScenario
    || jumpWindup < 0 || jumpRecovery <= jumpWindup || jumpIdle <= jumpRecovery
    || lightWindup < 0 || lightRecovery <= lightWindup || lightIdle <= lightRecovery
    || !authoritativeLifecycles) {
    throw new Error(`${milestone} did not preserve both authoritative attack lifecycles: ${JSON.stringify({
      jumpOwn, lightOwn, proofFailure, authoritativeLifecycles,
    })}`);
  }
  console.log("M211_SERVER_DUAL_RECOVERY_PHASES " + JSON.stringify({
    jumpId, observerId, lightId, spatial,
    sampledJumpActiveObserved: jumpActiveSample > jumpWindup,
    sampledLightActiveObserved: lightActiveSample > lightWindup,
    ...authoritativeLifecycles,
  }));

  if (observerState.acceptance?.scenario !== expectedScenario
    || observerState.acceptance.playerNetId !== observerId
    || observerState.acceptance.focusNetId !== lightId
    || observerState.focusLabel !== `NEAREST #${lightId}`
    || observerState.recoveryVisible) {
    throw new Error(`${milestone} observer did not settle back to ordinary nearest focus: ${JSON.stringify(observerState)}`);
  }

  if (evidence.some((entry) => entry.playerHp !== 100 || entry.playerGuard !== 100)) {
    throw new Error(`${milestone} off-axis simultaneous recovery proof changed authoritative vitals: ${JSON.stringify(evidence)}`);
  }

  if (spatial) {
    const lightRingIndex = spatialSamples.findIndex((sample) =>
      sample.focusLabel === `PUNISH TARGET #${lightId}`
      && sample.count >= 24
      && sample.centroidX > sample.canvasWidth * 0.52);
    const jumpRingIndex = spatialSamples.findIndex((sample, index) =>
      index > lightRingIndex
      && sample.focusLabel === `PUNISH TARGET #${jumpId}`
      && sample.count >= 24
      && sample.centroidX < sample.canvasWidth * 0.48);
    if (lightRingIndex < 0 || jumpRingIndex <= lightRingIndex) {
      throw new Error(`${milestone} recovery ring did not hand off right #${lightId} -> left #${jumpId}: ${JSON.stringify(spatialSamples)}`);
    }
    const finalGeometry = await sampleRecoveryTellGeometry(observer);
    if (finalGeometry.count !== 0) {
      throw new Error(`${milestone} recovery ring remained after both recoveries closed: ${JSON.stringify(finalGeometry)}`);
    }
  }

  return evidence.map((entry) => ({
    ...entry,
    m144JumpAttackerId: jumpId,
    m144ObserverId: observerId,
    m144LightAttackerId: lightId,
  }));
}

async function runOnlineUiMultiRecoveryPunishFlight(entries) {
  const milestone = "M149 selected recovery punish";
  if (entries.length !== 3) {
    throw new Error(`${milestone} expected three real browser clients, received ${entries.length}`);
  }

  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const ordered = ready.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const ids = ordered.map((entry) => entry.playerNetId);
  if (ids.length !== 3 || new Set(ids).size !== 3) {
    throw new Error(`${milestone} did not resolve three authoritative identities: ${JSON.stringify(ready)}`);
  }

  const jumpAttacker = entries.find((entry) => entry.name === ordered[0].browser);
  const observer = entries.find((entry) => entry.name === ordered[1].browser);
  const heavyAttacker = entries.find((entry) => entry.name === ordered[2].browser);
  if (!jumpAttacker || !observer || !heavyAttacker) {
    throw new Error(`${milestone} could not map deterministic FFA roles: ${JSON.stringify(ready)}`);
  }

  await waitForUiThreePlayerReady(entries, ids, 2500);
  await Promise.all(entries.map((entry) => execute(
    entry.base,
    entry.sessionId,
    "document.querySelector('#arena').focus(); return document.activeElement?.id;",
  )));
  const [jumpArena, observerArena, heavyArena] = await Promise.all([
    resolveArenaElement(jumpAttacker, milestone),
    resolveArenaElement(observer, milestone),
    resolveArenaElement(heavyAttacker, milestone),
  ]);
  await Promise.all(entries.map(centerArenaInViewport));

  const jumpId = ordered[0].playerNetId;
  const observerId = ordered[1].playerNetId;
  const heavyId = ordered[2].playerNetId;

  // Bring #3 and Firefox into clean light-attack range while keeping #3 the
  // unambiguous nearest rival. #1 stays on the opposite side of Firefox.
  await pulseMovementKey(heavyAttacker, "a", 280);
  await pulseMovementKey(observer, "d", 90);
  await sleep(80);
  await Promise.all([
    aimArena(jumpAttacker, jumpArena, -200),
    aimArena(heavyAttacker, heavyArena, 200),
    aimArena(observer, observerArena, 200),
  ]);
  await sleep(60);

  let baseline = await Promise.all(entries.map(readUiEvidence));
  let observerBefore = baseline.find((entry) => entry.browser === observer.name);
  for (let attempt = 0; attempt < 3 && observerBefore?.focusLabel !== `NEAREST #${heavyId}`; attempt += 1) {
    await pulseMovementKey(heavyAttacker, "a", 55);
    await sleep(50);
    baseline = await Promise.all(entries.map(readUiEvidence));
    observerBefore = baseline.find((entry) => entry.browser === observer.name);
  }
  const jumpBefore = baseline.find((entry) => entry.browser === jumpAttacker.name);
  const heavyBefore = baseline.find((entry) => entry.browser === heavyAttacker.name);
  if (!jumpBefore || !observerBefore || !heavyBefore) {
    throw new Error(`${milestone} missing staged evidence: ${JSON.stringify(baseline)}`);
  }
  if (observerBefore.focusLabel !== `NEAREST #${heavyId}`) {
    throw new Error(`${milestone} did not establish #${heavyId} as the nearest rival: ${JSON.stringify(baseline)}`);
  }
  if (baseline.some((entry) => entry.playerHp !== 100 || entry.playerGuard !== 100)) {
    throw new Error(`${milestone} staging changed authoritative vitals: ${JSON.stringify(baseline)}`);
  }

  const jumpKeyOffset = jumpBefore.keyTransitions.length;
  const jumpPointerOffset = jumpBefore.pointers.length;
  const heavyPointerOffset = heavyBefore.pointers.length;
  const observerPointerOffset = observerBefore.pointers.length;
  const observerFocusOffset = observerBefore.focusTransitions.length;
  const observerRecoveryOffset = observerBefore.recoveryTransitions.length;

  let cueObservedAt = 0;
  const punishPromise = (async () => {
    const deadline = Date.now() + 1400;
    while (Date.now() < deadline) {
      const label = await execute(
        observer.base,
        observer.sessionId,
        "return document.querySelector('#focus-label')?.textContent?.trim() ?? '';",
      );
      if (label === `PUNISH TARGET #${heavyId}`) {
        cueObservedAt = Date.now();
        await performArenaAttackHold(observer, observerArena, 200, 90);
        return;
      }
      await sleep(8);
    }
    throw new Error(`${milestone} observer never exposed PUNISH TARGET #${heavyId}`);
  })();

  await Promise.all([
    performM110NativeHeldLmb(heavyAttacker, heavyArena, 200),
    (async () => {
      await sleep(100 + M110_LMB_HEAVY_HOLD_MS - COMBAT.heavyAttack.windupMs);
      await performArenaJumpAttackChord(jumpAttacker, jumpArena, -200, 90);
    })(),
    punishPromise,
    sampleUiEvidenceWhileActive(entries, 1200, 8),
  ]);

  let evidence = await Promise.all(entries.map(readUiEvidence));
  let jumpState = evidence.find((entry) => entry.browser === jumpAttacker.name);
  let observerState = evidence.find((entry) => entry.browser === observer.name);
  let heavyState = evidence.find((entry) => entry.browser === heavyAttacker.name);
  if (!jumpState || !observerState || !heavyState) {
    throw new Error(`${milestone} incomplete final evidence: ${JSON.stringify(evidence)}`);
  }

  // Give the authoritative hit one short replication grace if the final sample
  // landed on the exact resolving tick.
  const settleDeadline = Date.now() + 400;
  while (heavyState.playerHp === 100 && Date.now() < settleDeadline) {
    await sleep(12);
    evidence = await Promise.all(entries.map(readUiEvidence));
    jumpState = evidence.find((entry) => entry.browser === jumpAttacker.name);
    observerState = evidence.find((entry) => entry.browser === observer.name);
    heavyState = evidence.find((entry) => entry.browser === heavyAttacker.name);
  }

  const focusTransitions = observerState.focusTransitions.slice(observerFocusOffset);
  const recoveryTransitions = observerState.recoveryTransitions.slice(observerRecoveryOffset);
  const selectedCue = focusTransitions.find((entry) => entry.label === `PUNISH TARGET #${heavyId}`);
  const heavyRecoveryCueIndex = recoveryTransitions.findIndex((entry) =>
    entry.visible
    && entry.state === "heavy-attack-recovery"
    && entry.label === "PUNISH"
    && entry.detail === "Heavy recovery");
  const heavyRecoveryCue = heavyRecoveryCueIndex >= 0 ? recoveryTransitions[heavyRecoveryCueIndex] : null;
  const heavyRecoveryExitCue = recoveryTransitions.find((entry, index) =>
    index > heavyRecoveryCueIndex
    && (!entry.visible || entry.state !== "heavy-attack-recovery"));
  if (!selectedCue || !heavyRecoveryCue || !heavyRecoveryExitCue) {
    throw new Error(`${milestone} did not expose and close the selected heavy recovery target: ${JSON.stringify({
      focusTransitions,
      recoveryTransitions,
    })}`);
  }

  const punishPointers = observerState.pointers.slice(observerPointerOffset);
  const punishDowns = punishPointers.filter((entry) => entry.type === "pointerdown" && entry.button === 0);
  const punishUps = punishPointers.filter((entry) => entry.type === "pointerup" && entry.button === 0);
  if (punishDowns.length !== 1 || punishUps.length !== 1
    || punishDowns[0].x < 0.6 || Math.abs(punishDowns[0].y - 0.5) > 0.15
    || !Number.isFinite(punishDowns[0]?.epochMs)
    || !Number.isFinite(selectedCue.epochMs)
    || punishDowns[0].epochMs < selectedCue.epochMs
    || punishDowns[0].epochMs - selectedCue.epochMs > 220) {
    throw new Error(`${milestone} genuine punish input did not promptly follow selected-target readability: ${JSON.stringify({
      cueObservedAt,
      selectedCue,
      punishPointers,
    })}`);
  }

  const heavyPointers = heavyState.pointers.slice(heavyPointerOffset);
  requireM188NativeHeldLmb(heavyPointers, true, milestone + " heavy #" + heavyId);
  if (heavyState.keys.some(event => event.endsWith(":KeyE"))) throw new Error(milestone + " retired E cannot author heavy attack");

  const jumpKeys = jumpState.keyTransitions.slice(jumpKeyOffset);
  const jumpPointers = jumpState.pointers.slice(jumpPointerOffset);
  const spaceDown = jumpKeys.find((entry) => entry.type === "keydown" && entry.code === "Space");
  const spaceUp = jumpKeys.find((entry) => entry.type === "keyup" && entry.code === "Space");
  const jumpDown = jumpPointers.find((entry) => entry.type === "pointerdown" && entry.button === 0);
  const jumpUp = jumpPointers.find((entry) => entry.type === "pointerup" && entry.button === 0);
  if (!spaceDown || !spaceUp || !jumpDown || !jumpUp
    || !Number.isFinite(spaceDown.epochMs) || !Number.isFinite(jumpDown.epochMs)
    || Math.abs(spaceDown.epochMs - jumpDown.epochMs) > 60
    || jumpDown.x >= 0.5) {
    throw new Error(`${milestone} lacked one genuine off-axis Space + LMB jump chord: ${JSON.stringify({ jumpKeys, jumpPointers })}`);
  }

  const jumpOwn = jumpState.acceptance?.ownActionTransitions ?? [];
  const heavyOwn = heavyState.acceptance?.ownActionTransitions ?? [];
  const jumpRecovery = jumpOwn.find((entry) => entry.action === COMBAT_ACTION.jumpAttackRecovery);
  const jumpIdle = jumpOwn.find((entry) => entry.action === COMBAT_ACTION.idle && entry.epochMs > (jumpRecovery?.epochMs ?? Infinity));
  const heavyRecovery = heavyOwn.find((entry) => entry.action === COMBAT_ACTION.heavyAttackRecovery);
  const heavyIdle = heavyOwn.find((entry) => entry.action === COMBAT_ACTION.idle && entry.epochMs > (heavyRecovery?.epochMs ?? Infinity));
  if (!jumpRecovery || !heavyRecovery || !jumpIdle || !heavyIdle) {
    throw new Error(`${milestone} did not preserve both recovery lifecycles: ${JSON.stringify({ jumpOwn, heavyOwn })}`);
  }
  if (punishDowns[0].epochMs < jumpRecovery.epochMs
    || punishDowns[0].epochMs >= jumpIdle.epochMs
    || punishDowns[0].epochMs < heavyRecoveryCue.epochMs
    || punishDowns[0].epochMs >= heavyRecoveryExitCue.epochMs) {
    throw new Error(`${milestone} punish input was not issued while both opponents were authoritatively recovering: ${JSON.stringify({
      punishDown: punishDowns[0],
      jumpRecovery,
      jumpIdle,
      heavyRecoveryCue,
      heavyRecoveryExitCue,
      heavyRecovery,
      heavyIdle,
    })}`);
  }

  if (jumpState.acceptance?.scenario !== "uimultirecoverypunish"
    || observerState.acceptance?.scenario !== "uimultirecoverypunish"
    || heavyState.acceptance?.scenario !== "uimultirecoverypunish"
    || observerState.acceptance.playerNetId !== observerId) {
    throw new Error(`${milestone} authoritative acceptance hook was not active: ${JSON.stringify(evidence)}`);
  }

  if (observerState.playerHp !== 100 || observerState.playerGuard !== 100
    || jumpState.playerHp !== 100 || jumpState.playerGuard !== 100
    || heavyState.playerHp !== 66 || heavyState.playerGuard !== 100) {
    throw new Error(`${milestone} did not resolve exactly one 34-HP punish on selected #${heavyId}: ${JSON.stringify(evidence)}`);
  }
  if (!observerState.events.includes("Opponent hit - 34 HP.")
    || !heavyState.events.includes("Hit taken - 34 HP.")
    || jumpState.events.includes("Hit taken - 34 HP.")) {
    throw new Error(`${milestone} authoritative feedback did not identify only the selected target: ${JSON.stringify(evidence)}`);
  }
  if (observerState.events.some((text) => text.includes("46 HP") || text.includes("42 HP"))) {
    throw new Error(`${milestone} an off-axis setup attack unexpectedly connected: ${JSON.stringify(observerState.events)}`);
  }

  return evidence.map((entry) => ({
    ...entry,
    m149JumpAttackerId: jumpId,
    m149ObserverId: observerId,
    m149SelectedTargetId: heavyId,
  }));
}

async function runOnlineUiKillFeedFlight(entries) {
  if (entries.length !== 3) throw new Error(`M52 expected three real browser clients, received ${entries.length}`);
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const ordered = ready.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const ids = ordered.map((entry) => entry.playerNetId);
  if (ids.length !== 3 || new Set(ids).size !== 3) {
    throw new Error(`M52 did not resolve three authoritative identities: ${JSON.stringify(ready)}`);
  }
  const left = entries.find((entry) => entry.name === ordered[0].browser);
  const center = entries.find((entry) => entry.name === ordered[1].browser);
  const right = entries.find((entry) => entry.name === ordered[2].browser);
  if (!left || !center || !right) throw new Error(`M52 could not map three FFA roles: ${JSON.stringify(ready)}`);

  await waitForUiThreePlayerReady(entries, ids, 2500);
  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const leftArena = await resolveArenaElement(left, "M52 left killer");
  const rightArena = await resolveArenaElement(right, "M52 right killer");
  const leftId = ordered[0].playerNetId;
  const centerId = ordered[1].playerNetId;
  const rightId = ordered[2].playerNetId;

  await pulseMovementKey(left, "d", 120);
  const firstDeathBaseline = await readDefeatTransitionCount(center);
  let firstKill = null;
  let firstDeath = null;
  for (let attempt = 0; attempt < 8 && !firstKill && !firstDeath; attempt += 1) {
    await performArenaAttack(left, leftArena, 200);
    firstKill = await waitForUiKillFeedEvidence(
      entries,
      ids,
      center,
      0,
      [{ killer: leftId, victim: centerId }],
      new Map([[leftId, 1], [centerId, 0], [rightId, 0]]),
      650,
      false,
    );
    if (!firstKill) {
      firstDeath = await waitForUiTargetDeath(entries, center, firstDeathBaseline, 300, false);
      if (!firstDeath) await pulseMovementKey(left, "d", 60);
    }
  }
  if (!firstKill) {
    if (!firstDeath) firstDeath = await waitForUiTargetDeath(entries, center, firstDeathBaseline, 1000, true);
    firstKill = await waitForUiKillFeedEvidence(
      entries,
      ids,
      center,
      null,
      [{ killer: leftId, victim: centerId }],
      new Map([[leftId, 1], [centerId, 0], [rightId, 0]]),
      1800,
      true,
    );
  }

  await waitForUiKillFeedEvidence(
    entries,
    ids,
    center,
    100,
    [{ killer: leftId, victim: centerId }],
    new Map([[leftId, 1], [centerId, 0], [rightId, 0]]),
    3000,
    true,
  );

  // Keep the first killer completely outside the second exchange. Authoritative
  // attacks can hit every fighter inside the 94-unit reach/arc, so horizontal
  // ordering alone cannot isolate center. Move the first killer perpendicular to
  // the spawn lane far beyond strike radius before staging the right attacker.
  await pulseMovementKey(left, "s", 650);
  await aimArena(right, rightArena, -200);
  await sleep(60);
  await pulseMovementKey(right, "a", 260);
  await sleep(60);
  const secondDeathBaseline = await readDefeatTransitionCount(center);
  let secondKill = null;
  let secondDeath = null;
  for (let attempt = 0; attempt < 8 && !secondKill && !secondDeath; attempt += 1) {
    await performArenaAttack(right, rightArena, -200);
    secondKill = await waitForUiKillFeedEvidence(
      entries,
      ids,
      center,
      0,
      [{ killer: rightId, victim: centerId }, { killer: leftId, victim: centerId }],
      new Map([[leftId, 1], [centerId, 0], [rightId, 1]]),
      650,
      false,
    );
    if (!secondKill) {
      secondDeath = await waitForUiTargetDeath(entries, center, secondDeathBaseline, 300, false);
      if (!secondDeath) await pulseMovementKey(right, "a", 60);
    }
  }
  if (!secondKill) {
    if (!secondDeath) secondDeath = await waitForUiTargetDeath(entries, center, secondDeathBaseline, 1000, true);
    secondKill = await waitForUiKillFeedEvidence(
      entries,
      ids,
      center,
      null,
      [{ killer: rightId, victim: centerId }, { killer: leftId, victim: centerId }],
      new Map([[leftId, 1], [centerId, 0], [rightId, 1]]),
      1800,
      true,
    );
  }

  for (const state of secondKill) {
    const rows = state.killFeedRows;
    if (rows.length !== 2 || rows[0].sequence !== ((rows[1].sequence + 1) >>> 0)) {
      throw new Error(`M52 reliable kill-event ordering was not consecutive: ${JSON.stringify(state)}`);
    }
    if (rows[0].killerOwn !== (state.playerNetId === rightId)
      || rows[0].victimOwn !== (state.playerNetId === centerId)
      || rows[1].killerOwn !== (state.playerNetId === leftId)
      || rows[1].victimOwn !== (state.playerNetId === centerId)) {
      throw new Error(`M52 kill-feed local identity markers were incorrect: ${JSON.stringify(state)}`);
    }
  }
  return secondKill;
}

async function runOnlineUiDeathTellFlight(entries) {
  let tell = null;
  let observer = null;
  const evidence = await runOnlineUiRespawnFlight(entries, async ({ attacker, defender }) => {
    observer = attacker;
    tell = await waitForRemoteDeathTell(attacker, defender, 700);
  });
  if (!tell || !observer) throw new Error(`M44 death tell was not sampled during authoritative Dead`);
  await waitForDeathTellClear(observer, 1000);
  return evidence.map((entry) => ({
    ...entry,
    deathTellMaxPixels: entry.browser === observer.name ? tell.observerMax : tell.localMax,
  }));
}

async function setMovementKey(session, value, pressed) {
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "key",
      id: `keyboard-${session.name}`,
      actions: [{ type: pressed ? "keyDown" : "keyUp", value }],
    }],
  });
}

async function pulseMovementKey(session, value, durationMs) {
  await setMovementKey(session, value, true);
  await sleep(durationMs);
  await setMovementKey(session, value, false);
}

// M121: one genuine W3C keyboard transaction avoids a 150ms held
// approach accidentally lasting ~700ms due to two separate driver roundtrips.
// Original server geometry, HP and authoritative hit requirements unchanged.
// M147 is a read-only native staging harness, not a production input path.
// The entire physical key press and release must share one W3C transaction.
async function pulseM147FocusStageKey(session, key, durationMs) {
  const actions = planM147NativeFocusKeyActions({
    keyboardId: `keyboard-${session.name}`, key, durationMs,
  });
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, actions);
}

async function pulseMovementKeyBoundedW3c(session, value, durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 250) {
    throw new RangeError("M121 bounded native approach outside staging budget");
  }
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "key",
      id: `keyboard-${session.name}`,
      actions: [
        { type: "keyDown", value },
        { type: "pause", duration: durationMs },
        { type: "keyUp", value },
      ],
    }],
  });
}

async function resolveArenaElement(session, label) {
  const arena = await webdriver(session.base, "POST", `/session/${session.sessionId}/element`, {
    using: "css selector",
    value: "#arena",
  });
  const elementId = arena?.["element-6066-11e4-a52e-4f735466cecf"];
  if (!elementId) throw new Error(`${session.name} did not resolve the real arena canvas for ${label}`);
  return elementId;
}

async function aimArenaForExclusiveAuthoritativeTarget(session, elementId, targetNetId, excludedNetIds, profile, label) {
  const script = "const a=window.__MYASO_ACCEPTANCE_STATE__;"
    + "const own=a?.fighters?.find((fighter)=>fighter.netId===a.playerNetId);"
    + "const target=a?.fighters?.find((fighter)=>fighter.netId===" + Number(targetNetId) + ");"
    + "const canvas=document.querySelector('#arena');const rect=canvas?.getBoundingClientRect();"
    + "return own&&target&&canvas&&rect?.width>0&&rect?.height>0?{own:{...own},target:{...target},fighters:(a?.fighters??[]).map((fighter)=>({...fighter})),width:rect.width,height:rect.height,canvasWidth:canvas.width,canvasHeight:canvas.height}:null;";
  const geometry = await execute(session.base, session.sessionId, script);
  if (!geometry) throw new Error(label + " could not read authoritative fighter geometry");

  const excluded = new Set(excludedNetIds);
  const own = geometry.own;
  const target = geometry.target;
  const maxDistance = profile.reach + COMBAT.fighterRadius;
  const targetDx = target.x - own.x;
  const targetDy = target.y - own.y;
  const targetDistance = Math.hypot(targetDx, targetDy);
  if (targetDistance > maxDistance) {
    throw new Error(label + " selected target #" + targetNetId + " is outside unchanged light reach: "
      + JSON.stringify({ targetDistance, maxDistance, own, target }));
  }

  const halfArc = profile.arcRadians / 2;
  const targetAngle = Math.atan2(targetDy, targetDx);
  const normalize = (angle) => {
    let value = angle;
    while (value > Math.PI) value -= Math.PI * 2;
    while (value < -Math.PI) value += Math.PI * 2;
    return value;
  };
  const candidates = [];
  const sweepDegrees = Math.max(1, Math.floor(halfArc * 180 / Math.PI) - 2);
  for (let degrees = -sweepDegrees; degrees <= sweepDegrees; degrees += 1) {
    const facing = targetAngle + degrees * Math.PI / 180;
    const targetMargin = halfArc - Math.abs(normalize(targetAngle - facing));
    if (targetMargin < 0.02) continue;
    let minExcludedMargin = Infinity;
    let blocked = false;
    for (const fighter of geometry.fighters) {
      if (!excluded.has(fighter.netId)) continue;
      const dx = fighter.x - own.x;
      const dy = fighter.y - own.y;
      const distance = Math.hypot(dx, dy);
      if (distance > maxDistance) continue;
      const angle = Math.atan2(dy, dx);
      const outsideMargin = Math.abs(normalize(angle - facing)) - halfArc;
      if (outsideMargin <= 0.03) { blocked = true; break; }
      minExcludedMargin = Math.min(minExcludedMargin, outsideMargin);
    }
    if (!blocked) candidates.push({
      facing,
      targetMargin,
      minExcludedMargin: Number.isFinite(minExcludedMargin) ? minExcludedMargin : Math.PI,
    });
  }
  candidates.sort((a, b) =>
    (b.minExcludedMargin + b.targetMargin * 0.35) - (a.minExcludedMargin + a.targetMargin * 0.35));
  const chosen = candidates[0];
  if (!chosen) {
    throw new Error(label + " could not isolate #" + targetNetId + " with the unchanged light arc: "
      + JSON.stringify({ own, target, excludedNetIds, fighters: geometry.fighters, maxDistance, halfArc }));
  }

  const worldRadius = 190;
  const worldDx = Math.cos(chosen.facing) * worldRadius;
  const worldDy = Math.sin(chosen.facing) * worldRadius;
  const x = worldDx * (geometry.width / geometry.canvasWidth);
  const y = worldDy * (geometry.height / geometry.canvasHeight);
  await aimArena(session, elementId, x, y);
  return { x, y, facing: chosen.facing, targetDistance, targetMargin: chosen.targetMargin, excludedMargin: chosen.minExcludedMargin };
}
async function aimArena(session, elementId, xOffset, yOffset = 0) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "pointer",
      id: `mouse-${session.name}`,
      parameters: { pointerType: "mouse" },
      actions: [{ type: "pointerMove", duration: 0, origin, x: xOffset, y: yOffset }],
    }],
  });
}


async function centerArenaInViewport(session) {
  const geometry = await execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    arena.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = arena.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, innerWidth, innerHeight };
  `);
  if (geometry.left < 0 || geometry.top < 0 || geometry.right > geometry.innerWidth || geometry.bottom > geometry.innerHeight) {
    throw new Error(`${session.name} arena is not fully visible for M33 pointer geometry: ${JSON.stringify(geometry)}`);
  }
  return geometry;
}

async function scrollArenaWheel(session, elementId, deltaY, delayMs = 0) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  const actions = [];
  if (delayMs > 0) actions.push({ type: "pause", duration: delayMs });
  actions.push({ type: "scroll", x: 0, y: 0, deltaX: 0, deltaY, duration: 0, origin });
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{ type: "wheel", id: `wheel-${session.name}`, actions }],
  });
}

// M41 original native QA only: still one physical W3C wheel-back at the
// arena's real visible center, without WebDriver element-origin resolution.
async function scrollM41ViewportWheel(session, arena) {
  const actions = planM41ViewportWheel({
    arena, wheelId: `wheel-${session.name}`,
  });
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, actions);
}

async function scrollArenaWheelPair(session, elementId, deltaY, firstDelayMs, betweenMs) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "wheel",
      id: `wheel-${session.name}`,
      actions: [
        { type: "pause", duration: firstDelayMs },
        { type: "scroll", x: 0, y: 0, deltaX: 0, deltaY, duration: 0, origin },
        { type: "pause", duration: betweenMs },
        { type: "scroll", x: 0, y: 0, deltaX: 0, deltaY, duration: 0, origin },
      ],
    }],
  });
}

async function pressArenaPerpendicularDodgeAfterPause(session, delayMs, knownElementId = null) {
  const elementId = knownElementId ?? await resolveArenaElement(session, "wheel-roll");
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  // Roll direction is pointer-owned. Aim below arena center immediately before
  // wheel-forward; the simultaneous S key is intentionally redundant evidence
  // that movement keys no longer steer the roll.
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [
      {
        type: "key",
        id: `keyboard-${session.name}`,
        actions: [
          { type: "keyDown", value: "s" },
          { type: "pause", duration: delayMs },
          { type: "pause", duration: 60 },
          { type: "keyUp", value: "s" },
        ],
      },
      {
        type: "pointer",
        id: `mouse-${session.name}`,
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pause", duration: delayMs },
          { type: "pointerMove", duration: 0, origin, x: 0, y: 180 },
          { type: "pause", duration: 15 },
        ],
      },
      {
        type: "wheel",
        id: `wheel-${session.name}`,
        actions: [
          { type: "pause", duration: delayMs },
          { type: "pause", duration: 15 },
          { type: "scroll", x: 0, y: 0, deltaX: 0, deltaY: -120, duration: 0, origin },
        ],
      },
    ],
  });
}

async function performArenaTimedPointerDodge(session, elementId, delayMs = 120) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  const boundedDelayMs = Math.max(0, Math.min(220, Math.trunc(delayMs)));
  // Keep pointer targeting and wheel-forward in one W3C timeline with exactly
  // one browser-owned delay. The older M107 helper intentionally carries a
  // redundant S-key proof, whose synchronized ticks are too long for the
  // jump attack's 105 ms windup. This focused helper proves the production
  // pointer-owned roll without altering gameplay or the established M107 gate.
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [
      {
        type: "pointer",
        id: `mouse-${session.name}`,
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", duration: 0, origin, x: 0, y: 180 },
          { type: "pause", duration: boundedDelayMs },
          { type: "pause", duration: 0 },
        ],
      },
      {
        type: "wheel",
        id: `wheel-${session.name}`,
        actions: [
          { type: "pause", duration: 0 },
          { type: "pause", duration: boundedDelayMs },
          { type: "scroll", x: 0, y: 0, deltaX: 0, deltaY: -120, duration: 0, origin },
        ],
      },
    ],
  });
}

async function setArenaBlock(session, elementId, pressed) {
  if (!pressed) return;
  await scrollArenaWheel(session, elementId, 120);
}

async function setArenaAttack(session, elementId, pressed, xOffset = 200) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  const actions = pressed
    ? [{ type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 }, { type: "pointerDown", button: 0 }]
    : [{ type: "pointerUp", button: 0 }];
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{ type: "pointer", id: `mouse-${session.name}`, parameters: { pointerType: "mouse" }, actions }],
  });
}

async function performArenaDirectionalLight(session, elementId, strafeKey, xOffset = 200) {
  // Physical 7-tick W3C chord. Aim first, then press strafe and LMB in the
  // same native tick; keep strafe until after the genuine LMB release. This
  // prevents driver-induced pre-strike drift without altering World reach.
  const plan = planM121DirectionalW3cActions({
    elementId,
    keyboardId: `keyboard-${session.name}`,
    pointerId: `mouse-${session.name}`,
    strafeKey,
    xOffset,
  });
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, plan);
}

async function performArenaRunHold(session, elementId, movementKey, xOffset = 200, holdMs = 900) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  const boundedHoldMs = Math.max(320, Math.min(1150, Math.trunc(holdMs)));
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [
      {
        type: "pointer",
        id: `mouse-${session.name}`,
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 },
          { type: "pointerDown", button: 2 },
          { type: "pause", duration: boundedHoldMs },
          { type: "pointerUp", button: 2 },
        ],
      },
      {
        type: "key",
        id: `keyboard-${session.name}`,
        actions: [
          { type: "pause", duration: 0 },
          { type: "keyDown", value: movementKey },
          { type: "pause", duration: boundedHoldMs },
          { type: "keyUp", value: movementKey },
        ],
      },
    ],
  });
}

async function performArenaRollAttackChord(session, elementId, xOffset = 200, holdMs = 70) {
  const boundedHoldMs = Math.max(45, Math.min(140, Math.trunc(holdMs)));
  // ChromeDriver can serialize pointer before wheel even when both W3C sources
  // share one action request. Deliver wheel-forward first so the roll-denial
  // candidate is queued while the fighter is still idle, then follow with one
  // genuine bounded LMB gesture. Kernel tests remain authoritative for the true
  // same-input-tick arbitration contract.
  await scrollArenaWheel(session, elementId, -120, 0);
  await sleep(20);
  await performArenaAttackHold(session, elementId, xOffset, boundedHoldMs);
}

async function performArenaRunningAttack(session, elementId, movementKey, xOffset = 200, movementLeadMs = 80) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  const pointerId = `mouse-${session.name}`;
  const attackPointerId = `mouse-attack-${session.name}`;
  const keyboardId = `keyboard-${session.name}`;
  let rightHeld = false;
  let movementHeld = false;
  let lightHeld = false;
  try {
    // Arm the genuine RMB hold first. Keeping movement out of this threshold
    // wait avoids drifting the staged fighters while still proving the actual
    // production hold-to-run gesture.
    await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
      actions: [{
        type: "pointer",
        id: pointerId,
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 },
          { type: "pointerDown", button: 2 },
        ],
      }],
    });
    rightHeld = true;

    // Cross the production 180 ms hold threshold, then arm genuine movement
    // long enough for multiple client input samples to carry run + movement
    // before LMB. This removes scheduler dependence without changing gameplay.
    await sleep(220);
    await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
      actions: [{
        type: "key",
        id: keyboardId,
        actions: [{ type: "keyDown", value: movementKey }],
      }],
    });
    movementHeld = true;
    const boundedMovementLeadMs = Math.max(80, Math.min(600, Math.trunc(movementLeadMs)));
    await sleep(boundedMovementLeadMs);
    lightHeld = true;
    await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
      actions: [{
        type: "pointer",
        id: attackPointerId,
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 },
          { type: "pointerDown", button: 0 },
          // R2: true 20ms light tap. A 90ms hold legitimately upgrades the
          // live 80ms charging windup to heavy, which is NOT a running light.
          { type: "pause", duration: 20 },
          { type: "pointerUp", button: 0 },
        ],
      }],
    });
    lightHeld = false;

    // Keep sprint + movement alive through the initial running-strike
    // commitment, then release both genuine controls.
    await sleep(320);
  } finally {
    if (lightHeld) {
      await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
        actions: [{
          type: "pointer",
          id: attackPointerId,
          parameters: { pointerType: "mouse" },
          actions: [{ type: "pointerUp", button: 0 }],
        }],
      });
    }
    if (rightHeld || movementHeld) {
      // W3C Release Actions releases every depressed real WebDriver input in
      // reverse order. Chromium then dispatches the held RMB and movement-key
      // releases to the page even though LMB used a separate pointer source.
      await webdriver(session.base, "DELETE", `/session/${session.sessionId}/actions`);
      await sleep(20);
    }
  }
}

async function performArenaHeavyFeint(session, elementId, xOffset = 200) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  // One native compound transaction: physical LMB DOWN, real wheel at70ms,
  // then physical UP at450ms. A denied exhausted feint must preserve exactly
  // one original heavy; the full recovery proof rejects phantom light on UP.
  try {
    await webdriver(session.base, "POST", "/session/" + session.sessionId + "/actions", {
      actions: [
        {
          type: "pointer",
          id: "mouse-" + session.name,
          parameters: { pointerType: "mouse" },
          actions: [
            { type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 },
            { type: "pointerDown", button: 0 },
            { type: "pause", duration: M110_LMB_HEAVY_HOLD_MS - 70 },
            { type: "pointerUp", button: 0 },
          ],
        },
        {
          type: "wheel",
          id: "wheel-" + session.name,
          actions: [
            { type: "pause", duration: 0 },
            { type: "pause", duration: 70 },
            { type: "scroll", x: 0, y: 0, deltaX: 0, deltaY: 120, duration: 0, origin },
            { type: "pause", duration: 0 },
          ],
        },
      ],
    });
  } catch (error) {
    await webdriver(session.base, "DELETE", "/session/" + session.sessionId + "/actions");
    throw error;
  }
}

async function performArenaFeint(session, elementId, xOffset = 200) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  // M333: one genuine W3C multi-source action. Issue wheel-back in the
  // tick AFTER pointerDOWN and BEFORE pointerUP, with zero extra hold.
  // On #39387402890 Chrome stretched the former 20ms requested hold to an
  // observed 85ms real press, upgrading the exhausted 34HP light to heavy
  // under the unchanged 80ms heavy classifier. Do not add wall-clock hold:
  // WebDriver's ordered ticks already yield a genuine nonzero mouse press.
  // Keep one trusted wheel inside the unchanged 70ms server-feint window;
  // reject a real heavy upgrade or lost input rather than passing it.
  try {
    await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
      actions: [
        {
          type: "pointer",
          id: `mouse-${session.name}`,
          parameters: { pointerType: "mouse" },
          actions: [
            { type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 },
            { type: "pointerDown", button: 0 },
            { type: "pause", duration: 0 },
            { type: "pause", duration: 0 },
            { type: "pointerUp", button: 0 },
          ],
        },
        {
          type: "wheel",
          id: `wheel-${session.name}`,
          actions: [
            { type: "pause", duration: 0 },
            { type: "pause", duration: 0 },
            { type: "scroll", x: 0, y: 0, deltaX: 0, deltaY: 120, duration: 0, origin },
            { type: "pause", duration: 0 },
            { type: "pause", duration: 0 },
          ],
        },
      ],
    });
  } catch (error) {
    await webdriver(session.base, "DELETE", `/session/${session.sessionId}/actions`);
    throw error;
  }
}

async function performArenaRecoveryBufferedRoll(session, elementId, recoveryStartEpochMs) {
  if (!Number.isFinite(recoveryStartEpochMs)) {
    throw new Error("M129 recovery start epoch is required for buffered roll scheduling");
  }

  // Retarget only after Firefox has independently observed authoritative
  // attack recovery. Then schedule one genuine wheel-forward from the shared
  // epoch clock 10 ms inside the unchanged 90 ms dodge input-buffer window.
  // This avoids fixed WebDriver pauses drifting either before buffer-open or
  // beyond the 255 ms recovery exit as driver load changes.
  await aimArena(session, elementId, 0, 180);
  const bufferOpenEpochMs = recoveryStartEpochMs
    + COMBAT.attack.recoveryMs - COMBAT.inputBuffer.dodgeWindowMs;
  const targetSendEpochMs = bufferOpenEpochMs + 10;
  const remainingMs = targetSendEpochMs - Date.now();
  if (remainingMs > 0) await sleep(remainingMs);
  await scrollArenaWheel(session, elementId, -120, 0);
}

async function pressArenaJumpAttackChord(session, elementId, xOffset = 200) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [
      {
        type: "key",
        id: `keyboard-${session.name}`,
        actions: [
          { type: "pause", duration: 0 },
          { type: "keyDown", value: " " },
        ],
      },
      {
        type: "pointer",
        id: `mouse-${session.name}`,
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 },
          { type: "pointerDown", button: 0 },
        ],
      },
    ],
  });
}

async function releaseArenaJumpAttackChord(session) {
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [
      {
        type: "key",
        id: `keyboard-${session.name}`,
        actions: [{ type: "keyUp", value: " " }],
      },
      {
        type: "pointer",
        id: `mouse-${session.name}`,
        parameters: { pointerType: "mouse" },
        actions: [{ type: "pointerUp", button: 0 }],
      },
    ],
  });
}

async function performArenaJumpAttackChord(session, elementId, xOffset = 200, holdMs = 90) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  const boundedHoldMs = Math.max(50, Math.min(180, Math.trunc(holdMs)));
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [
      {
        type: "key",
        id: `keyboard-${session.name}`,
        actions: [
          { type: "pause", duration: 0 },
          { type: "keyDown", value: " " },
          { type: "pause", duration: boundedHoldMs },
          { type: "keyUp", value: " " },
        ],
      },
      {
        type: "pointer",
        id: `mouse-${session.name}`,
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 },
          { type: "pointerDown", button: 0 },
          { type: "pause", duration: boundedHoldMs },
          { type: "pointerUp", button: 0 },
        ],
      },
    ],
  });
}

// M335 acceptance-only: genuine pointer first, keyboard second, same FIRST
// WebDriver action tick. Exact-head CI #39415462650 measured Space 64ms ahead
// of LMB despite genuine pre-aim. Direct local ChromeDriver native-input
// measurements delivered <=1ms onset gap in pointer-first order, compared
// with 2..5ms keyboard-first without CI contention. Original <=60ms actual
// event gate stays strict. The client legitimately handles Space after LMB
// down by committing its light, so the jump attack still fires just once.
async function performArenaPreAimedJumpAttackChord(session, holdMs = 90) {
  const boundedHoldMs = Math.max(50, Math.min(180, Math.trunc(holdMs)));
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [
      {
        type: "pointer",
        id: `mouse-${session.name}`,
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerDown", button: 0 },
          { type: "pause", duration: boundedHoldMs },
          { type: "pointerUp", button: 0 },
        ],
      },
      {
        type: "key",
        id: `keyboard-${session.name}`,
        actions: [
          { type: "keyDown", value: " " },
          { type: "pause", duration: boundedHoldMs },
          { type: "keyUp", value: " " },
        ],
      },
    ],
  });
}

async function performArenaJumpPress(session, holdMs = 45) {
  const boundedHoldMs = Math.max(25, Math.min(120, Math.trunc(holdMs)));
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "key",
      id: `keyboard-${session.name}`,
      actions: [
        { type: "keyDown", value: " " },
        { type: "pause", duration: boundedHoldMs },
        { type: "keyUp", value: " " },
      ],
    }],
  });
}

async function performArenaRecoveryBufferedJump(session, holdMs = 760) {
  const boundedHoldMs = Math.max(520, Math.min(1200, Math.trunc(holdMs)));
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "key",
      id: `keyboard-${session.name}`,
      actions: [
        { type: "keyDown", value: " " },
        { type: "pause", duration: boundedHoldMs },
        { type: "keyUp", value: " " },
      ],
    }],
  });
}

async function performArenaKickAttackChord(session, elementId, xOffset = 200, holdMs = 70) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  const boundedHoldMs = Math.max(35, Math.min(110, Math.trunc(holdMs)));
  await webdriver(session.base, "POST", "/session/" + session.sessionId + "/actions", {
    actions: [{
      type: "pointer",
      id: "mouse-" + session.name,
      parameters: { pointerType: "mouse" },
      actions: [
        { type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 },
        { type: "pointerDown", button: 2 },
        { type: "pause", duration: boundedHoldMs },
        { type: "pointerUp", button: 2 },
        { type: "pause", duration: 20 },
        { type: "pointerDown", button: 0 },
        { type: "pause", duration: 40 },
        { type: "pointerUp", button: 0 },
      ],
    }],
  });
}

async function performArenaRecoveryBufferedKick(session, elementId, xOffset = 200, holdMs = 45) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  const boundedHoldMs = Math.max(25, Math.min(120, Math.trunc(holdMs)));
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "pointer",
      id: `mouse-${session.name}`,
      parameters: { pointerType: "mouse" },
      actions: [
        { type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 },
        { type: "pointerDown", button: 2 },
        { type: "pause", duration: boundedHoldMs },
        { type: "pointerUp", button: 2 },
      ],
    }],
  });
}

async function performArenaAttack(session, elementId, xOffset = 200) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "pointer",
      id: `mouse-${session.name}`,
      parameters: { pointerType: "mouse" },
      actions: [
        { type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 },
        { type: "pointerDown", button: 0 },
        { type: "pause", duration: 40 },
        { type: "pointerUp", button: 0 },
      ],
    }],
  });
}

async function performArenaBlockAttackChord(session, elementId, xOffset = 200, holdMs = 70) {
  const boundedHoldMs = Math.max(45, Math.min(140, Math.trunc(holdMs)));
  // Browser automation stages wheel-back first because W3C multi-source input
  // ordering is not deterministic across Chrome and Firefox. JS/Rust kernels
  // remain authoritative for the true same-input-tick arbitration contract.
  await scrollArenaWheel(session, elementId, 120, 0);
  await sleep(20);
  await performArenaAttackHold(session, elementId, xOffset, boundedHoldMs);
}

async function performArenaAttackHold(session, elementId, xOffset = 200, holdMs = 180) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  // R2: this is the real LIGHT gesture shared by genuine PvP flights.
  // A requested 90ms press legitimately upgrades to heavy after 80ms; cap
  // it to a true 20–35ms tap rather than weakening the 34HP light gates.
  // Charging heavy still has its separate sustained-LMB release proof.
  const boundedHoldMs = Math.max(20, Math.min(35, Math.trunc(holdMs)));
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "pointer",
      id: `mouse-${session.name}`,
      parameters: { pointerType: "mouse" },
      actions: [
        { type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 },
        { type: "pointerDown", button: 0 },
        { type: "pause", duration: boundedHoldMs },
        { type: "pointerUp", button: 0 },
      ],
    }],
  });
}

// M221: one genuine Chrome W3C transaction; no driver-ACK barrier between
// pointerDown and pointerUp. Strict M34 damage/guard checks remain unchanged.
async function performArenaM221GuardBreakClick(session, clickHoldMs = 10) {
  if (!Number.isInteger(clickHoldMs) || clickHoldMs < 0 || clickHoldMs > 100) {
    throw new TypeError("M221 requires bounded genuine W3C click hold");
  }
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "pointer",
      id: `mouse-${session.name}`,
      parameters: { pointerType: "mouse" },
      actions: [
        { type: "pointerDown", button: 0 },
        // M147 only: a zero-duration pause is STILL an extra W3C driver tick.
        // Deliver genuine physical DOWN/UP back-to-back on the same pointer.
        // Positive holds elsewhere retain their original native timing.
        ...(clickHoldMs > 0 ? [{ type: "pause", duration: clickHoldMs }] : []),
        { type: "pointerUp", button: 0 },
      ],
    }],
  });
}

async function setArenaAttackButton(session, pressed) {
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "pointer",
      id: `mouse-${session.name}`,
      parameters: { pointerType: "mouse" },
      actions: [{ type: pressed ? "pointerDown" : "pointerUp", button: 0 }],
    }],
  });
}

async function performArenaAttackBurst(session, clickCount = 3, initialPauseMs = 0, interClickPauseMs = 8) {
  const actions = [];
  const boundedPauseMs = Math.max(0, Math.min(1000, Math.trunc(initialPauseMs)));
  const boundedInterClickPauseMs = Math.max(0, Math.min(100, Math.trunc(interClickPauseMs)));
  if (boundedPauseMs > 0) actions.push({ type: "pause", duration: boundedPauseMs });
  const boundedClickCount = Math.max(1, Math.min(9, Math.trunc(clickCount)));
  for (let index = 0; index < boundedClickCount; index += 1) {
    actions.push({ type: "pointerDown", button: 0 });
    actions.push({ type: "pause", duration: 10 });
    actions.push({ type: "pointerUp", button: 0 });
    if (index < boundedClickCount - 1) actions.push({ type: "pause", duration: boundedInterClickPauseMs });
  }
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "pointer",
      id: `mouse-${session.name}`,
      parameters: { pointerType: "mouse" },
      actions,
    }],
  });
}

async function sampleUiEvidenceWhileActive(entries, durationMs, intervalMs = 20) {
  const deadline = Date.now() + Math.max(0, durationMs);
  const boundedIntervalMs = Math.max(8, Math.min(80, intervalMs));
  let states = await Promise.all(entries.map(readUiEvidence));
  while (Date.now() < deadline) {
    await sleep(boundedIntervalMs);
    states = await Promise.all(entries.map(readUiEvidence));
  }
  return states;
}

async function installUiObserver(session) {
  await execute(session.base, session.sessionId, `
    const target = document.querySelector('#event-text');
    const arena = document.querySelector('#arena');
    const arenaStage = document.querySelector('.arena-stage');
    const overlay = document.querySelector('#combat-overlay');
    const recovery = document.querySelector('#opponent-recovery');
    const focusLabel = document.querySelector('#focus-label');
    const threat = document.querySelector('#threat-cue');
    const threatCount = document.querySelector('#threat-count');
    const threatSecondary = document.querySelector('#threat-secondary');
    const threatSecondaryBearing = document.querySelector('#threat-secondary-bearing');
    const threatSecondaryPhase = document.querySelector('#threat-secondary-phase');
    const threatSecondaryGuardArc = document.querySelector('#threat-secondary-guard-arc');
    const threatBearing = document.querySelector('#threat-bearing');
    const threatGuardArc = document.querySelector('#threat-guard-arc');
    if (!target || !arena || !arenaStage || !overlay || !recovery || !focusLabel || !threat || !threatCount || !threatSecondary || !threatSecondaryBearing || !threatSecondaryPhase || !threatSecondaryGuardArc || !threatBearing || !threatGuardArc) throw new Error('missing online UI flight target');
    const state = { events: [], eventTransitions: [], keys: [], keyTransitions: [], pointers: [], wheels: [], overlayTransitions: [], feedbackTransitions: [], recoveryTransitions: [], focusTransitions: [], threatTransitions: [], recoveryTellMaxPixels: 0, parryTellMaxPixels: 0, online: '', startedAt: performance.now() };
    // M338/M339: M151/M152 and M40 share the exact M194 guard-break wheel verifier.
    // Open the same real Firefox-only, localhost trusted-proof socket in all
    // four scenarios. Parent FFA flights reinstall UI observers: reuse the
    // existing OPEN/CONNECTING channel rather than leaking another socket.
    if (${requiresM338GuardBreakWheelSocket(scenario, session.name)}) {
      const prior = window.__MYASO_M325_WHEEL_CHANNEL__;
      if (!prior || prior.readyState === WebSocket.CLOSING
        || prior.readyState === WebSocket.CLOSED) {
        window.__MYASO_M325_WHEEL_CHANNEL__ = new WebSocket(
          "ws://" + location.host + "/__myaso_m325_trusted_wheel");
      }
    }
    const epochEvidence = ['uiguardbreak', 'uiguardbreaktell', 'uiheavyguardbreakpunish', 'uidodge', 'uirollbuffer', 'uijumpbuffer', 'uijumpattack', 'uijumpattackinputloss', 'uijumpattackpunish', 'uijumpattacktelegraph', 'uijumpffaprimary', 'uijumpffasecondary', 'uijumprecoveryffa', 'uijumppunishffa', 'uimultirecoveryffa', 'uimultirecoveryspatial', 'uimultirecoverypunish', 'uiparrypunishwindow', 'uiparrypunishffa', 'uiparrypunishffahit', 'uiguardbreakpunishffa', 'uiguardbreakpunishffahit', 'uikickknockdownffa', 'uikickknockdownffahit', 'uikickknockdownbounded', 'uirollknockdownbounded', 'uistaminaauth', 'uistaminaexhaustion', 'uistaminafeedback', 'uistaminaconfirmed', 'uifeint', 'uirollknockdownffahit', 'uimultiknockdownffa', 'uimultiknockdownffahit', 'uirollknockdownffa', 'uijumpattackblock', 'uijumpattackparry', 'uijumpattackdodge', 'uijumpattackbuffer', 'uikickbuffer'].includes(new URLSearchParams(location.search).get('scenario'));
    const record = () => {
      const text = target.textContent?.trim() ?? '';
      if (/^Online - player #\\d+ - server tick \\d+$/.test(text)) state.online = text;
      else if (text && state.events.at(-1) !== text) {
        state.events.push(text);
        state.eventTransitions.push({
          text,
          t: Number((performance.now() - state.startedAt).toFixed(1)),
        });
      }
    };
    const recordOverlay = () => {
      const entry = {
        visible: !overlay.hidden,
        title: document.querySelector('#combat-overlay-title')?.textContent?.trim() ?? '',
        detail: document.querySelector('#combat-overlay-detail')?.textContent?.trim() ?? '',
        t: Number((performance.now() - state.startedAt).toFixed(1)),
      };
      const previous = state.overlayTransitions.at(-1);
      if (!previous || previous.visible !== entry.visible || previous.title !== entry.title || previous.detail !== entry.detail) {
        state.overlayTransitions.push(entry);
      }
    };
    const recordFeedback = () => {
      const feedback = arenaStage.dataset.combatFeedback ?? '';
      if (feedback) state.feedbackTransitions.push(feedback);
    };
    const recordRecovery = () => {
      const entry = {
        visible: !recovery.hidden,
        state: recovery.dataset.state ?? '',
        label: document.querySelector('#opponent-recovery-label')?.textContent?.trim() ?? '',
        detail: document.querySelector('#opponent-recovery-detail')?.textContent?.trim() ?? '',
      };
      const previous = state.recoveryTransitions.at(-1);
      const changed = !previous || ['visible', 'state', 'label', 'detail'].some((key) => previous[key] !== entry[key]);
      if (changed) {
        if (epochEvidence) entry.epochMs = Date.now();
        state.recoveryTransitions.push(entry);
      }
    };
    const recordFocus = () => {
      const entry = {
        label: focusLabel.textContent?.trim() ?? '',
        t: Number((performance.now() - state.startedAt).toFixed(1)),
      };
      const previous = state.focusTransitions.at(-1);
      if (!previous || previous.label !== entry.label) {
        if (epochEvidence) entry.epochMs = Date.now();
        state.focusTransitions.push(entry);
      }
    };
    const recordThreat = () => {
      const entry = {
        visible: !threat.hidden,
        state: threat.dataset.state ?? '',
        label: document.querySelector('#threat-label')?.textContent?.trim() ?? '',
        phase: document.querySelector('#threat-phase')?.textContent?.trim() ?? '',
        count: threatCount.hidden ? '' : (threatCount.textContent?.trim() ?? ''),
        secondary: threatSecondary.hidden ? '' : (threatSecondary.textContent?.trim() ?? ''),
        secondaryBearing: threatSecondaryBearing.hidden ? '' : (threatSecondaryBearing.textContent?.trim() ?? ''),
        secondaryPhase: threatSecondaryPhase.hidden ? '' : (threatSecondaryPhase.textContent?.trim() ?? ''),
        secondaryGuardArc: threatSecondaryGuardArc.hidden ? '' : (threatSecondaryGuardArc.textContent?.trim() ?? ''),
        bearing: threatBearing.hidden ? '' : (threatBearing.textContent?.trim() ?? ''),
        guardArc: threatGuardArc.hidden ? '' : (threatGuardArc.textContent?.trim() ?? ''),
      };
      const previous = state.threatTransitions.at(-1);
      if (!previous || Object.keys(entry).some((key) => previous[key] !== entry[key])) state.threatTransitions.push(entry);
    };
    for (const type of ['keydown', 'keyup']) {
      arena.addEventListener(type, (event) => {
        state.keys.push(type + ':' + event.code);
        const entry = {
          type,
          code: event.code,
          t: Number((performance.now() - state.startedAt).toFixed(1)),
        };
        if (epochEvidence) entry.epochMs = Date.now();
        state.keyTransitions.push(entry);
      }, { capture: true });
    }
    const pointerTypes = new URLSearchParams(location.search).get('scenario') === 'uirollbuffer'
      ? ['pointerdown', 'pointerup', 'pointermove']
      : ['pointerdown', 'pointerup'];
    for (const type of pointerTypes) {
      arena.addEventListener(type, (event) => {
        const rect = arena.getBoundingClientRect();
        const entry = {
          type,
          button: event.button,
          trusted: event.isTrusted === true,
          pointerId: event.pointerId,
          x: Number(((event.clientX - rect.left) / rect.width).toFixed(3)),
          y: Number(((event.clientY - rect.top) / rect.height).toFixed(3)),
          t: Number((performance.now() - state.startedAt).toFixed(1)),
        };
        if (epochEvidence) entry.epochMs = Date.now();
        state.pointers.push(entry);
        // M227/M234: capture the selected real W3C light down (M145) or
        // release (M144). This emits proof only; never synthesizes input.
        if (event.isTrusted === true && event.button === 0) {
          const token = window.__MYASO_M227_LIGHT_TOKEN__;
          const expectedType = window.__MYASO_M227_LIGHT_TOKEN_TYPE__ || 'pointerdown';
          if (token && type === expectedType) {
            window.__MYASO_M227_LIGHT_TOKEN__ = null;
            fetch('/__myaso_m227_trusted_light', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ token, trusted: true, type, button: event.button }),
              keepalive: true,
            }).catch(() => {});
          }
        }
      }, { capture: true });
    }
    arena.addEventListener('wheel', (event) => {
      const entry = {
        deltaY: event.deltaY,
        t: Number((performance.now() - state.startedAt).toFixed(1)),
      };
      if (epochEvidence) entry.epochMs = Date.now();
      state.wheels.push(entry);
      // M221 reports only the browser's trusted native W3C wheel-back event.
      // No preventDefault, dispatchEvent or control/game modification.
      const challenge = window.__MYASO_M221_WHEEL_TOKEN__;
      if (challenge && event.isTrusted === true && event.deltaY > 0) {
        window.__MYASO_M221_WHEEL_TOKEN__ = null;
        const receipt = JSON.stringify({
          token: challenge, trusted: event.isTrusted === true, deltaY: event.deltaY,
        });
        const channel = window.__MYASO_M325_WHEEL_CHANNEL__;
        if (channel) {
          if (channel.readyState === WebSocket.OPEN) channel.send(receipt);
        } else {
          // Preserve original M221 HTTP attestation for other acceptance lanes.
          fetch('/__myaso_m221_trusted_wheel', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: receipt, keepalive: true,
          }).catch(() => {});
        }
      }
    }, { capture: true });
    record();
    recordOverlay();
    recordFeedback();
    recordRecovery();
    recordFocus();
    recordThreat();
    new MutationObserver(record).observe(target, { childList: true, subtree: true, characterData: true });
    new MutationObserver(recordOverlay).observe(overlay, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true, characterData: true });
    new MutationObserver(recordFeedback).observe(arenaStage, { attributes: true, attributeFilter: ['data-combat-feedback'] });
    new MutationObserver(recordRecovery).observe(recovery, { attributes: true, attributeFilter: ['hidden', 'data-state'], childList: true, subtree: true, characterData: true });
    new MutationObserver(recordFocus).observe(focusLabel, { childList: true, subtree: true, characterData: true });
    new MutationObserver(recordThreat).observe(threat, { attributes: true, attributeFilter: ['hidden', 'data-state'], childList: true, subtree: true, characterData: true });
    window.__MYASO_M30_UI__ = state;
    return true;
  `);
}

async function sampleDeathTellPixels(session) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const context = arena?.getContext('2d');
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, arena.width, arena.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (Math.abs(pixels[i] - 255) <= 2 && Math.abs(pixels[i + 1] - 111) <= 2 && Math.abs(pixels[i + 2] - 145) <= 2 && pixels[i + 3] >= 250) count += 1;
    }
    return count;
  `);
}

async function waitForRemoteDeathTell(observer, localDefeated, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let observerMax = 0;
  let localMax = 0;
  while (Date.now() < deadline) {
    const [observerPixels, localPixels] = await Promise.all([
      sampleDeathTellPixels(observer),
      sampleDeathTellPixels(localDefeated),
    ]);
    observerMax = Math.max(observerMax, observerPixels);
    localMax = Math.max(localMax, localPixels);
    if (observerMax >= 24) {
      if (localMax !== 0) throw new Error(`M44 local defeated fighter painted the remote-only death tell: ${localMax}`);
      return { observerMax, localMax };
    }
    await sleep(20);
  }
  throw new Error(`M44 remote death tell never appeared: observer=${observerMax} local=${localMax}`);
}

async function waitForDeathTellClear(session, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await sampleDeathTellPixels(session) === 0) return;
    await sleep(20);
  }
  throw new Error(`M44 remote death tell did not clear after authoritative respawn`);
}

async function armRecoveryHandoffSampler(session) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const context = arena?.getContext('2d');
    const focusLabel = document.querySelector('#focus-label');
    if (!arena || !context || !focusLabel) return false;
    const prior = window.__MYASO_M145_RECOVERY_SAMPLER__;
    prior?.observer?.disconnect();
    const state = { samples: [], startedAt: performance.now(), observer: null };
    const sample = () => {
      const label = focusLabel.textContent?.trim() ?? '';
      if (!label.startsWith('PUNISH TARGET #')) return;
      const pixels = context.getImageData(0, 0, arena.width, arena.height).data;
      let count = 0;
      let xSum = 0;
      let pixelIndex = 0;
      for (let i = 0; i < pixels.length; i += 4, pixelIndex += 1) {
        if (Math.abs(pixels[i] - 239) <= 2
          && Math.abs(pixels[i + 1] - 207) <= 2
          && Math.abs(pixels[i + 2] - 115) <= 2
          && pixels[i + 3] >= 250) {
          count += 1;
          xSum += pixelIndex % arena.width;
        }
      }
      state.samples.push({
        focusLabel: label,
        count,
        centroidX: count > 0 ? xSum / count : -1,
        canvasWidth: arena.width,
        t: Number((performance.now() - state.startedAt).toFixed(1)),
      });
    };
    state.observer = new MutationObserver(sample);
    state.observer.observe(focusLabel, { childList: true, subtree: true, characterData: true });
    window.__MYASO_M145_RECOVERY_SAMPLER__ = state;
    return true;
  `);
}

async function stopRecoveryHandoffSampler(session) {
  return execute(session.base, session.sessionId, `
    const state = window.__MYASO_M145_RECOVERY_SAMPLER__;
    if (!state) return [];
    state.observer?.disconnect();
    return state.samples.map((entry) => ({ ...entry }));
  `);
}

async function sampleRecoveryTellGeometry(session) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const context = arena?.getContext('2d');
    if (!arena || !context) return { count: 0, centroidX: -1, canvasWidth: 0 };
    const pixels = context.getImageData(0, 0, arena.width, arena.height).data;
    let count = 0;
    let xSum = 0;
    let pixelIndex = 0;
    for (let i = 0; i < pixels.length; i += 4, pixelIndex += 1) {
      if (Math.abs(pixels[i] - 239) <= 2
        && Math.abs(pixels[i + 1] - 207) <= 2
        && Math.abs(pixels[i + 2] - 115) <= 2
        && pixels[i + 3] >= 250) {
        count += 1;
        xSum += pixelIndex % arena.width;
      }
    }
    return {
      count,
      centroidX: count > 0 ? xSum / count : -1,
      canvasWidth: arena.width,
    };
  `);
}

async function sampleRecoveryTellPixels(session) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const context = arena?.getContext('2d');
    if (!context) return 0;
    const half = 160;
    const x = Math.max(0, Math.floor(arena.width / 2 - half));
    const y = Math.max(0, Math.floor(arena.height / 2 - half));
    const width = Math.min(half * 2, arena.width - x);
    const height = Math.min(half * 2, arena.height - y);
    const pixels = context.getImageData(x, y, width, height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (Math.abs(pixels[i] - 239) <= 2 && Math.abs(pixels[i + 1] - 207) <= 2 && Math.abs(pixels[i + 2] - 115) <= 2 && pixels[i + 3] >= 250) count += 1;
    }
    return count;
  `);
}

async function armRecoveryTellSampler(session) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const context = arena?.getContext('2d');
    if (!context) return false;
    const prior = window.__MYASO_M38_RECOVERY_SAMPLER__;
    if (prior) prior.active = false;
    if (prior?.frame) cancelAnimationFrame(prior.frame);
    const state = { active: true, frame: 0, maxPixels: 0 };
    const sample = () => {
      if (!state.active) return;
      const half = 160;
      const x = Math.max(0, Math.floor(arena.width / 2 - half));
      const y = Math.max(0, Math.floor(arena.height / 2 - half));
      const width = Math.min(half * 2, arena.width - x);
      const height = Math.min(half * 2, arena.height - y);
      const pixels = context.getImageData(x, y, width, height).data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (Math.abs(pixels[i] - 239) <= 2 && Math.abs(pixels[i + 1] - 207) <= 2
          && Math.abs(pixels[i + 2] - 115) <= 2 && pixels[i + 3] >= 250) count += 1;
      }
      state.maxPixels = Math.max(state.maxPixels, count);
      state.frame = requestAnimationFrame(sample);
    };
    window.__MYASO_M38_RECOVERY_SAMPLER__ = state;
    state.frame = requestAnimationFrame(sample);
    return true;
  `);
}

async function readRecoveryTellSampler(session) {
  return execute(session.base, session.sessionId,
    "return window.__MYASO_M38_RECOVERY_SAMPLER__?.maxPixels ?? 0;");
}

async function stopRecoveryTellSampler(session) {
  return execute(session.base, session.sessionId, `
    const state = window.__MYASO_M38_RECOVERY_SAMPLER__;
    if (!state) return 0;
    state.active = false;
    if (state.frame) cancelAnimationFrame(state.frame);
    return state.maxPixels;
  `);
}

async function armDodgeTellSampler(session, fullCanvas) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const context = arena?.getContext('2d');
    if (!context) return false;
    const prior = window.__MYASO_M43_DODGE_SAMPLER__;
    if (prior?.frame) cancelAnimationFrame(prior.frame);
    const state = { active: true, frame: 0, maxPixels: 0 };
    const sample = () => {
      if (!state.active) return;
      const half = ${fullCanvas ? '160' : '48'};
      const x = ${fullCanvas ? '0' : 'Math.max(0, Math.floor(arena.width / 2 - half))'};
      const y = ${fullCanvas ? '0' : 'Math.max(0, Math.floor(arena.height / 2 - half))'};
      const width = ${fullCanvas ? 'arena.width' : 'Math.min(half * 2, arena.width - x)'};
      const height = ${fullCanvas ? 'arena.height' : 'Math.min(half * 2, arena.height - y)'};
      const pixels = context.getImageData(x, y, width, height).data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (Math.abs(pixels[i] - 199) <= 2 && Math.abs(pixels[i + 1] - 181) <= 2 && Math.abs(pixels[i + 2] - 255) <= 2 && pixels[i + 3] >= 250) count += 1;
      }
      state.maxPixels = Math.max(state.maxPixels, count);
      state.frame = requestAnimationFrame(sample);
    };
    window.__MYASO_M43_DODGE_SAMPLER__ = state;
    state.frame = requestAnimationFrame(sample);
    return true;
  `);
}

async function readDodgeTellSampler(session) {
  return execute(session.base, session.sessionId, `return window.__MYASO_M43_DODGE_SAMPLER__?.maxPixels ?? 0;`);
}

async function stopDodgeTellSampler(session) {
  return execute(session.base, session.sessionId, `
    const state = window.__MYASO_M43_DODGE_SAMPLER__;
    if (!state) return 0;
    state.active = false;
    if (state.frame) cancelAnimationFrame(state.frame);
    return state.maxPixels;
  `);
}

async function sampleDodgeTellPixels(session) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const context = arena?.getContext('2d');
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, arena.width, arena.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (Math.abs(pixels[i] - 199) <= 2 && Math.abs(pixels[i + 1] - 181) <= 2 && Math.abs(pixels[i + 2] - 255) <= 2 && pixels[i + 3] >= 250) count += 1;
    }
    return count;
  `);
}

async function waitForRemoteDodgeTell(entries, observer, localDodger, timeoutMs, fail = true) {
  const deadline = Date.now() + timeoutMs;
  let observerMax = 0;
  let localMax = 0;
  while (Date.now() < deadline) {
    const [observerPixels, localPixels] = await Promise.all([readDodgeTellSampler(observer), readDodgeTellSampler(localDodger)]);
    observerMax = Math.max(observerMax, observerPixels);
    localMax = Math.max(localMax, localPixels);
    if (observerMax >= 24) {
      if (localMax !== 0) throw new Error(`M43 local dodger painted the remote-only dodge tell: ${localMax}`);
      return { observerMax, localMax };
    }
    await sleep(20);
  }
  if (!fail) return null;
  const evidence = await Promise.all(entries.map(readUiEvidence));
  throw new Error(`M43 remote dodge tell never appeared: observer=${observerMax} local=${localMax} evidence=${JSON.stringify(evidence)}`);
}

async function waitForDodgeTellClear(session, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await sampleDodgeTellPixels(session) === 0) return;
    await sleep(20);
  }
  throw new Error(`M43 remote dodge tell did not clear after authoritative Dodge ended`);
}

async function sampleBlockFacingTellPixels(session) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const context = arena?.getContext('2d');
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, arena.width, arena.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (Math.abs(pixels[i] - 154) <= 2 && Math.abs(pixels[i + 1] - 215) <= 2 && Math.abs(pixels[i + 2] - 167) <= 2 && pixels[i + 3] > 0) count += 1;
    }
    return count;
  `);
}

async function armBlockFacingTellSampler(session) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const ctx = arena?.getContext('2d');
    if (!ctx) return false;
    const state = { active: true, maxPixels: 0, frame: 0 };
    const sample = () => {
      if (!state.active) return;
      const data = ctx.getImageData(0, 0, arena.width, arena.height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4)
        if (Math.abs(data[i] - 154) <= 2 && Math.abs(data[i + 1] - 215) <= 2 && Math.abs(data[i + 2] - 167) <= 2 && data[i + 3] > 0) count++;
      state.maxPixels = Math.max(state.maxPixels, count);
      state.frame = requestAnimationFrame(sample);
    };
    window.__MYASO_M42_FACING_SAMPLER__ = state;
    sample();
    return true;
  `);
}
async function readBlockFacingTellSampler(session) {
  return execute(session.base, session.sessionId, "return window.__MYASO_M42_FACING_SAMPLER__?.maxPixels ?? 0;");
}
async function stopBlockFacingTellSampler(session) {
  return execute(session.base, session.sessionId, `
    const state = window.__MYASO_M42_FACING_SAMPLER__;
    if (!state) return 0;
    state.active = false;
    cancelAnimationFrame(state.frame);
    return state.maxPixels;
  `);
}

async function waitForRemoteBlockFacingTell(observer, localBlocker, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let observerMax = 0;
  let localMax = 0;
  while (Date.now() < deadline) {
    const [observerPixels, localPixels] = await Promise.all([sampleBlockFacingTellPixels(observer), sampleBlockFacingTellPixels(localBlocker)]);
    observerMax = Math.max(observerMax, observerPixels);
    localMax = Math.max(localMax, localPixels);
    if (observerMax >= 24) {
      if (localMax !== 0) throw new Error(`M42 local blocker painted the remote-only facing tell: ${localMax}`);
      return { observerMax, localMax };
    }
    await sleep(20);
  }
  throw new Error(`M42 remote block-facing tell never appeared: observer=${observerMax} local=${localMax}`);
}

async function waitForBlockFacingTellClear(session, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await sampleBlockFacingTellPixels(session) === 0) return;
    await sleep(20);
  }
  throw new Error(`M42 remote block-facing tell did not clear after block release`);
}

async function armParryTellSampler(session) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const context = arena?.getContext('2d');
    if (!context) return false;
    const prior = window.__MYASO_M41_PARRY_SAMPLER__;
    if (prior?.frame) cancelAnimationFrame(prior.frame);
    const half = 180;
    const x = Math.max(0, Math.floor(arena.width / 2 - half));
    const y = Math.max(0, Math.floor(arena.height / 2 - half));
    const width = Math.min(half * 2, arena.width - x);
    const height = Math.min(half * 2, arena.height - y);
    // M250: inspect completed native canvas frames instead of a 40ms timer
    // that can miss a short-lived remote parry ring during driver jitter.
    // This is read-only; no pixels, effects or combat state are injected.
    const state = { active: true, frame: 0, maxPixels: 0, sampledFrames: 0,
      lastSampleAtMs: null, firstRingAtMs: null, crop: { x, y, width, height } };
    const sample = () => {
      if (!state.active) return;
      const pixels = context.getImageData(x, y, width, height).data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (Math.abs(pixels[i] - 127) <= 2 && Math.abs(pixels[i + 1] - 207) <= 2 && Math.abs(pixels[i + 2] - 244) <= 2 && pixels[i + 3] >= 250) count += 1;
      }
      state.sampledFrames += 1;
      state.lastSampleAtMs = performance.now();
      if (count >= 24 && state.firstRingAtMs === null) state.firstRingAtMs = state.lastSampleAtMs;
      state.maxPixels = Math.max(state.maxPixels, count);
      state.frame = requestAnimationFrame(sample);
    };
    window.__MYASO_M41_PARRY_SAMPLER__ = state;
    state.frame = requestAnimationFrame(sample);
    return true;
  `);
}

async function readParryTellSampler(session) {
  return execute(session.base, session.sessionId, `return window.__MYASO_M41_PARRY_SAMPLER__?.maxPixels ?? 0;`);
}

async function readParryTellSamplerDiagnostics(session) {
  return execute(session.base, session.sessionId, `
    const state = window.__MYASO_M41_PARRY_SAMPLER__;
    if (!state) return { armed: false };
    return {
      armed: true, active: state.active, sampledFrames: state.sampledFrames,
      maxPixels: state.maxPixels, lastSampleAtMs: state.lastSampleAtMs,
      firstRingAtMs: state.firstRingAtMs, crop: state.crop,
      canvasWidth: document.querySelector('#arena')?.width ?? null,
      canvasHeight: document.querySelector('#arena')?.height ?? null,
      remoteRingDraw: window.__MYASO_M41_DRAW_TRACE__ ?? null,
    };
  `);
}

async function stopParryTellSampler(session) {
  return execute(session.base, session.sessionId, `
    const state = window.__MYASO_M41_PARRY_SAMPLER__;
    if (!state) return 0;
    state.active = false;
    if (state.frame) cancelAnimationFrame(state.frame);
    return state.maxPixels;
  `);
}

async function sampleParryTellPixels(session) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const context = arena?.getContext('2d');
    if (!context) return 0;
    const half = 180;
    const x = Math.max(0, Math.floor(arena.width / 2 - half));
    const y = Math.max(0, Math.floor(arena.height / 2 - half));
    const width = Math.min(half * 2, arena.width - x);
    const height = Math.min(half * 2, arena.height - y);
    const pixels = context.getImageData(x, y, width, height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (Math.abs(pixels[i] - 127) <= 2 && Math.abs(pixels[i + 1] - 207) <= 2 && Math.abs(pixels[i + 2] - 244) <= 2 && pixels[i + 3] >= 250) count += 1;
    }
    return count;
  `);
}

async function waitForRemoteParryTell(observer, parriedLocal, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let observerMax = 0;
  let localMax = 0;
  while (Date.now() < deadline) {
    const [observerPixels, localPixels] = await Promise.all([
      sampleParryTellPixels(observer),
      sampleParryTellPixels(parriedLocal),
    ]);
    observerMax = Math.max(observerMax, observerPixels);
    localMax = Math.max(localMax, localPixels);
    if (observerMax >= 24) {
      if (localMax !== 0) throw new Error(`M41 local parried fighter painted the remote-only tell: ${localMax}`);
      return { observerMax, localMax };
    }
    await sleep(20);
  }
  throw new Error(`M41 remote parry-stun tell never appeared: observer=${observerMax} local=${localMax}`);
}

async function waitForParryTellClear(session, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await sampleParryTellPixels(session) === 0) return;
    await sleep(20);
  }
  throw new Error(`M41 remote parry tell did not clear after stun`);
}

async function sampleGuardBreakTellPixels(session) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const context = arena?.getContext('2d');
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, arena.width, arena.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (Math.abs(pixels[i] - 244) <= 2 && Math.abs(pixels[i + 1] - 127) <= 2 && Math.abs(pixels[i + 2] - 95) <= 2 && pixels[i + 3] >= 250) count += 1;
    }
    return count;
  `);
}

async function waitForRemoteGuardBreakTell(observer, brokenLocal, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let observerMax = 0;
  let localMax = 0;
  while (Date.now() < deadline) {
    const [observerPixels, localPixels] = await Promise.all([sampleGuardBreakTellPixels(observer), sampleGuardBreakTellPixels(brokenLocal)]);
    observerMax = Math.max(observerMax, observerPixels);
    localMax = Math.max(localMax, localPixels);
    if (observerMax >= 24) {
      if (localMax !== 0) throw new Error(`M40 local guard-broken fighter painted the remote-only tell: ${localMax}`);
      return { observerMax, localMax };
    }
    await sleep(20);
  }
  throw new Error(`M40 remote guard-break tell never appeared: observer=${observerMax} local=${localMax}`);
}

async function waitForGuardBreakTellClear(session, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await sampleGuardBreakTellPixels(session) === 0) return;
    await sleep(20);
  }
  throw new Error(`M40 remote guard-break tell did not clear after stun`);
}

async function sampleWindupTellPixels(session) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const context = arena?.getContext('2d');
    if (!context) return 0;
    const half = 160;
    const x = Math.max(0, Math.floor(arena.width / 2 - half));
    const y = Math.max(0, Math.floor(arena.height / 2 - half));
    const width = Math.min(half * 2, arena.width - x);
    const height = Math.min(half * 2, arena.height - y);
    const pixels = context.getImageData(x, y, width, height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (Math.abs(pixels[i] - 243) <= 2 && Math.abs(pixels[i + 1] - 214) <= 2 && Math.abs(pixels[i + 2] - 143) <= 2 && pixels[i + 3] >= 250) count += 1;
    }
    return count;
  `);
}

async function sampleRemoteVitalsPixels(session) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const context = arena?.getContext('2d');
    if (!context) return { hpPixels: 0, guardPixels: 0 };
    const half = 160;
    const x = Math.max(0, Math.floor(arena.width / 2 - half));
    const y = Math.max(0, Math.floor(arena.height / 2 - half));
    const width = Math.min(half * 2, arena.width - x);
    const height = Math.min(half * 2, arena.height - y);
    const pixels = context.getImageData(x, y, width, height).data;
    let hpPixels = 0;
    let guardPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (Math.abs(pixels[i] - 242) <= 2 && Math.abs(pixels[i + 1] - 95) <= 2 && Math.abs(pixels[i + 2] - 92) <= 2 && pixels[i + 3] >= 250) hpPixels += 1;
      if (Math.abs(pixels[i] - 89) <= 2 && Math.abs(pixels[i + 1] - 201) <= 2 && Math.abs(pixels[i + 2] - 139) <= 2 && pixels[i + 3] >= 250) guardPixels += 1;
    }
    return { hpPixels, guardPixels };
  `);
}

async function sampleIdentityBadgePixels(session) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const context = arena?.getContext('2d');
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, arena.width, arena.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (Math.abs(pixels[i] - 52) <= 2 && Math.abs(pixels[i + 1] - 68) <= 2 && Math.abs(pixels[i + 2] - 92) <= 2 && pixels[i + 3] >= 250) count += 1;
    }
    return count;
  `);
}

async function armHitTellSampler(session) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const context = arena?.getContext('2d');
    if (!context) return false;
    const prior = window.__MYASO_M45_HIT_SAMPLER__;
    if (prior?.frame) cancelAnimationFrame(prior.frame);
    const state = { active: true, frame: 0, maxPixels: 0 };
    const sample = () => {
      if (!state.active) return;
      const half = 160;
      const x = Math.max(0, Math.floor(arena.width / 2 - half));
      const y = Math.max(0, Math.floor(arena.height / 2 - half));
      const width = Math.min(half * 2, arena.width - x);
      const height = Math.min(half * 2, arena.height - y);
      const pixels = context.getImageData(x, y, width, height).data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (Math.abs(pixels[i] - 255) <= 2 && Math.abs(pixels[i + 1] - 173) <= 2 && Math.abs(pixels[i + 2] - 102) <= 2 && pixels[i + 3] >= 250) count += 1;
      }
      state.maxPixels = Math.max(state.maxPixels, count);
      state.frame = requestAnimationFrame(sample);
    };
    window.__MYASO_M45_HIT_SAMPLER__ = state;
    state.frame = requestAnimationFrame(sample);
    return true;
  `);
}

async function readHitTellSampler(session) {
  return execute(session.base, session.sessionId, `return window.__MYASO_M45_HIT_SAMPLER__?.maxPixels ?? 0;`);
}

async function stopHitTellSampler(session) {
  return execute(session.base, session.sessionId, `
    const state = window.__MYASO_M45_HIT_SAMPLER__;
    if (!state) return 0;
    state.active = false;
    if (state.frame) cancelAnimationFrame(state.frame);
    return state.maxPixels;
  `);
}

async function armThreatMarkerSampler(session) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const context = arena?.getContext('2d');
    if (!context) return false;
    const prior = window.__MYASO_M62_THREAT_MARKER_SAMPLER__;
    if (prior?.frame) cancelAnimationFrame(prior.frame);
    const state = { active: true, frame: 0, primaryMax: 0, secondaryMax: 0 };
    const sample = () => {
      if (!state.active) return;
      const half = 110;
      const x = Math.max(0, Math.floor(arena.width / 2 - half));
      const y = Math.max(0, Math.floor(arena.height / 2 - half));
      const width = Math.min(half * 2, arena.width - x);
      const height = Math.min(half * 2, arena.height - y);
      const pixels = context.getImageData(x, y, width, height).data;
      let primary = 0;
      let secondary = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (Math.abs(pixels[i] - 255) <= 2 && Math.abs(pixels[i + 1] - 143) <= 2 && Math.abs(pixels[i + 2] - 114) <= 2 && pixels[i + 3] >= 250) primary += 1;
        if (Math.abs(pixels[i] - 247) <= 2 && Math.abs(pixels[i + 1] - 225) <= 2 && Math.abs(pixels[i + 2] - 176) <= 2 && pixels[i + 3] >= 250) secondary += 1;
      }
      state.primaryMax = Math.max(state.primaryMax, primary);
      state.secondaryMax = Math.max(state.secondaryMax, secondary);
      state.frame = requestAnimationFrame(sample);
    };
    window.__MYASO_M62_THREAT_MARKER_SAMPLER__ = state;
    state.frame = requestAnimationFrame(sample);
    return true;
  `);
}

async function stopThreatMarkerSampler(session) {
  return execute(session.base, session.sessionId, `
    const state = window.__MYASO_M62_THREAT_MARKER_SAMPLER__;
    if (!state) return { primaryMax: 0, secondaryMax: 0 };
    state.active = false;
    if (state.frame) cancelAnimationFrame(state.frame);
    return { primaryMax: state.primaryMax, secondaryMax: state.secondaryMax };
  `);
}

async function armWindupTellSampler(session) {
  return execute(session.base, session.sessionId, `
    const arena = document.querySelector('#arena');
    const context = arena?.getContext('2d');
    if (!context) return false;
    const prior = window.__MYASO_M39_WINDUP_SAMPLER__;
    if (prior?.frame) cancelAnimationFrame(prior.frame);
    const state = { active: true, frame: 0, maxPixels: 0 };
    const sample = () => {
      if (!state.active) return;
      const half = 160;
      const x = Math.max(0, Math.floor(arena.width / 2 - half));
      const y = Math.max(0, Math.floor(arena.height / 2 - half));
      const width = Math.min(half * 2, arena.width - x);
      const height = Math.min(half * 2, arena.height - y);
      const pixels = context.getImageData(x, y, width, height).data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (Math.abs(pixels[i] - 243) <= 2 && Math.abs(pixels[i + 1] - 214) <= 2 && Math.abs(pixels[i + 2] - 143) <= 2 && pixels[i + 3] >= 250) count += 1;
      }
      state.maxPixels = Math.max(state.maxPixels, count);
      state.frame = requestAnimationFrame(sample);
    };
    window.__MYASO_M39_WINDUP_SAMPLER__ = state;
    state.frame = requestAnimationFrame(sample);
    return true;
  `);
}

async function readWindupTellSampler(session) {
  return execute(session.base, session.sessionId, `return window.__MYASO_M39_WINDUP_SAMPLER__?.maxPixels ?? 0;`);
}

async function stopWindupTellSampler(session) {
  return execute(session.base, session.sessionId, `
    const state = window.__MYASO_M39_WINDUP_SAMPLER__;
    if (!state) return 0;
    state.active = false;
    if (state.frame) cancelAnimationFrame(state.frame);
    return state.maxPixels;
  `);
}

async function waitForRemoteWindupTell(entries, attacker, defender, timeoutMs, fail = true) {
  const deadline = Date.now() + timeoutMs;
  let defenderMax = 0;
  while (Date.now() < deadline) {
    const defenderPixels = await readWindupTellSampler(defender);
    defenderMax = Math.max(defenderMax, defenderPixels);
    if (defenderMax >= 24) {
      const attackerPixels = await sampleWindupTellPixels(attacker);
      if (attackerPixels !== 0) throw new Error(`M39 local fighter painted the remote-only windup boundary: ${attackerPixels}`);
      const evidence = await Promise.all(entries.map(readUiEvidence));
      return evidence.map((entry) => ({ ...entry, windupTellMaxPixels: entry.browser === attacker.name ? attackerPixels : defenderMax }));
    }
    await sleep(20);
  }
  if (!fail) return null;
  throw new Error(`M39 remote windup boundary never appeared: defender=${defenderMax}`);
}

async function waitForWindupTellClear(session, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await sampleWindupTellPixels(session) === 0) return;
    await sleep(20);
  }
  throw new Error(`M39 remote windup boundary did not clear after windup`);
}

async function waitForUiReady(entries) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    if (states.every((state) => state.playerNetId > 0 && state.playerHp === 100 && state.opponentHp === 100)) return states;
    await sleep(100);
  }
  throw new Error(`real online UI did not converge to ready fighters: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
}

async function waitForUiCombatEvidence(entries, timeoutMs = 3000, fail = true) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const hpValues = states.map((state) => state.playerHp).sort((a, b) => a - b);
    const messagesReady = states.some((state) => state.events.includes("Opponent hit - 34 HP."))
      && states.some((state) => state.events.includes("Hit taken - 34 HP."));
    if (hpValues[0] === 66 && hpValues[1] === 100 && messagesReady) return states;
    await sleep(50);
  }
  if (!fail) return null;
  throw new Error(`real online UI never rendered the authoritative hit exchange: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
}

async function waitForUiMessage(session, text, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await readUiEvidence(session);
    if (state.events.includes(text)) return state;
    await sleep(20);
  }
  throw new Error(`${session.name} never rendered expected online UI message ${text}: ${JSON.stringify(await readUiEvidence(session))}`);
}


async function waitForUiDodgeEvidence(entries, attacker, defender, timeoutMs, fail = true, baselineStates = null) {
  const baselineAttacker = baselineStates?.find((entry) => entry.browser === attacker.name);
  const baselineDefender = baselineStates?.find((entry) => entry.browser === defender.name);
  const count = (items, value) => items?.filter((entry) => entry === value).length ?? 0;
  const baselineAttackCommit = count(baselineAttacker?.events, "Attack committed - your windup is readable.");
  const baselineEvadedMessage = count(baselineAttacker?.events, "Attack evaded - opponent dodged.");
  const baselineSuccessMessage = count(baselineDefender?.events, "Dodge! Strike avoided.");
  const baselineEvadedFeedback = count(baselineAttacker?.feedbackTransitions, "dodge-evaded");
  const baselineSuccessFeedback = count(baselineDefender?.feedbackTransitions, "dodge-success");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerState = states.find((entry) => entry.browser === attacker.name);
    const defenderState = states.find((entry) => entry.browser === defender.name);
    const attackCommitted = count(attackerState?.events, "Attack committed - your windup is readable.") > baselineAttackCommit;
    const messagesReady = count(attackerState?.events, "Attack evaded - opponent dodged.") > baselineEvadedMessage
      && count(defenderState?.events, "Dodge! Strike avoided.") > baselineSuccessMessage;
    const feedbackReady = count(attackerState?.feedbackTransitions, "dodge-evaded") > baselineEvadedFeedback
      && count(defenderState?.feedbackTransitions, "dodge-success") > baselineSuccessFeedback;
    const vitalsClean = attackerState?.playerHp === 100 && attackerState?.playerGuard === 100
      && defenderState?.playerHp === 100 && defenderState?.playerGuard === 100;
    if (attackCommitted && messagesReady && feedbackReady && vitalsClean) return states;
    await sleep(40);
  }
  if (!fail) return null;
  throw new Error(`real online UI never rendered fresh authoritative dodge feedback: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
}

async function waitForUiGuardBreakEvidence(entries, attacker, defender, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerState = states.find((entry) => entry.browser === attacker.name);
    const defenderState = states.find((entry) => entry.browser === defender.name);
    const pressureReady = attackerState?.events.includes("Opponent blocked - guard -38.")
      && defenderState?.events.includes("Block held - guard -38.")
      && attackerState?.feedbackTransitions.includes("block-confirm")
      && defenderState?.feedbackTransitions.includes("guard-pressure");
    const breakReady = attackerState?.events.includes("Opponent guard broken - punish.")
      && defenderState?.events.includes("Guard broken - you are vulnerable.")
      && attackerState?.feedbackTransitions.includes("guard-break-confirm")
      && defenderState?.feedbackTransitions.includes("guard-broken");
    const vitalsReady = attackerState?.playerHp === 100 && defenderState?.playerHp === 100 && defenderState?.playerGuard === 0;
    if (pressureReady && breakReady && vitalsReady) return states;
    await sleep(40);
  }
  throw new Error(`real online UI never rendered authoritative guard break feedback: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
}

async function waitForUiParryEvidence(entries, attacker, defender, timeoutMs, fail = true, baselineStates = null) {
  const baselineAttacker = baselineStates?.find((entry) => entry.browser === attacker.name);
  const baselineDefender = baselineStates?.find((entry) => entry.browser === defender.name);
  const baselineParried = baselineAttacker?.feedbackTransitions.filter((entry) => entry === "parried").length ?? 0;
  const baselineParrySuccess = baselineDefender?.feedbackTransitions.filter((entry) => entry === "parry-success").length ?? 0;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerState = states.find((entry) => entry.browser === attacker.name);
    const defenderState = states.find((entry) => entry.browser === defender.name);
    const messagesReady = attackerState?.events.includes("Parried - your commitment was read.")
      && defenderState?.events.includes("Parry! Opponent stunned - punish now.");
    const feedbackReady = (attackerState?.feedbackTransitions.filter((entry) => entry === "parried").length ?? 0) > baselineParried
      && (defenderState?.feedbackTransitions.filter((entry) => entry === "parry-success").length ?? 0) > baselineParrySuccess;
    const vitalsClean = baselineAttacker && baselineDefender
      ? attackerState?.playerHp === baselineAttacker.playerHp && attackerState?.playerGuard === baselineAttacker.playerGuard
        && defenderState?.playerHp === baselineDefender.playerHp && defenderState?.playerGuard === baselineDefender.playerGuard
      : attackerState?.playerHp === 100 && attackerState?.playerGuard === 100
        && defenderState?.playerHp === 100 && defenderState?.playerGuard === 100;
    if (messagesReady && feedbackReady && vitalsClean) return states;
    await sleep(40);
  }
  if (!fail) return null;
  throw new Error(`real online UI never rendered authoritative parry feedback: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
}

async function waitForUiDeathEvidence(entries, attacker, defender, timeoutMs, fail = true) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerState = states.find((entry) => entry.browser === attacker.name);
    const defenderState = states.find((entry) => entry.browser === defender.name);
    const lifecycleReady = attackerState?.events.includes("Opponent down.")
      && defenderState?.events.includes("Defeated - read the exchange.");
    if (attackerState?.opponentHp === 0 && defenderState?.playerHp === 0
      && defenderState.overlayVisible && defenderState.overlayTitle === "DEFEATED"
      && defenderState.overlayDetail === "Respawning…" && lifecycleReady) return states;
    await sleep(50);
  }
  if (!fail) return null;
  throw new Error(`real online UI never rendered authoritative defeat: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
}

async function waitForUiFocusHudEvidence(entries, expectedByBrowser, ids, timeoutMs, fail = true) {
  const deadline = Date.now() + timeoutMs;
  const labels = ids.map((id) => `#${id}`);
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const ready = states.every((entry) => {
      const expected = expectedByBrowser.get(entry.browser);
      const focusReady = expected?.labels
        ? expected.labels.includes(entry.focusLabel)
        : entry.focusLabel === expected?.label;
      return expected
        && focusReady
        && entry.opponentHp === expected.hp
        && entry.playerHp === expected.playerHp
        && entry.opponentGuard === 100
        && entry.scoreboardRows?.length === 3
        && entry.scoreboardRows.every((row, index) => row.label === labels[index] && row.kills === 0)
        && !entry.overlayVisible;
    });
    if (ready) return states;
    await sleep(50);
  }
  if (!fail) return null;
  throw new Error(`M53 focus HUD did not converge: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
}

async function waitForUiThreePlayerReady(entries, ids, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const labels = ids.map((id) => `#${id}`);
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const ready = states.every((entry) => entry.playerHp === 100 && entry.playerGuard === 100
      && entry.scoreboardRows?.length === 3
      && entry.scoreboardRows.every((row, index) => row.label === labels[index] && row.kills === 0)
      && entry.scoreboardRows.filter((row) => row.own).length === 1
      && !entry.overlayVisible);
    if (ready) return states;
    await sleep(50);
  }
  throw new Error(`M51 three-player FFA never converged to shared ready state: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
}

async function waitForUiThreePlayerDamage(entries, target, expectedHp, ids, timeoutMs, fail = true) {
  const deadline = Date.now() + timeoutMs;
  const labels = ids.map((id) => `#${id}`);
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const targetState = states.find((entry) => entry.browser === target.name);
    const othersHealthy = states
      .filter((entry) => entry.browser !== target.name)
      .every((entry) => entry.playerHp === 100);
    const scoreboardReady = states.every((entry) => entry.scoreboardRows?.length === 3
      && entry.scoreboardRows.every((row, index) => row.label === labels[index] && row.kills === 0));
    if (targetState?.playerHp === expectedHp && othersHealthy && scoreboardReady
      && states.every((entry) => !entry.overlayVisible)) return states;
    await sleep(50);
  }
  if (!fail) return null;
  throw new Error(`M51 target did not reach authoritative HP ${expectedHp}: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
}

async function readDefeatTransitionCount(session) {
  const state = await readUiEvidence(session);
  return state.overlayTransitions.filter((entry) => entry.visible && entry.title === "DEFEATED").length;
}

async function waitForUiTargetDeath(entries, target, baselineDefeats, timeoutMs, fail = true) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const targetState = states.find((entry) => entry.browser === target.name);
    const defeats = targetState?.overlayTransitions.filter((entry) => entry.visible && entry.title === "DEFEATED").length ?? 0;
    if (targetState?.playerHp === 0 || defeats > baselineDefeats) return states;
    await sleep(50);
  }
  if (!fail) return null;
  throw new Error(`M52 target death was not observed: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
}

async function waitForUiKillFeedEvidence(
  entries,
  ids,
  target,
  expectedTargetHp,
  expectedFeed,
  expectedScores,
  timeoutMs,
  fail = true,
) {
  const deadline = Date.now() + timeoutMs;
  const expectedScoreRows = ids
    .map((id) => ({ label: `#${id}`, kills: expectedScores.get(id) ?? 0 }))
    .sort((a, b) => b.kills - a.kills || Number(a.label.slice(1)) - Number(b.label.slice(1)));
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const targetState = states.find((entry) => entry.browser === target.name);
    const feedReady = states.every((entry) => entry.killFeedRows?.length === expectedFeed.length
      && expectedFeed.every((expected, index) => entry.killFeedRows[index]?.text === `#${expected.killer} defeated #${expected.victim}`));
    const scoreReady = states.every((entry) => entry.scoreboardRows?.length === expectedScoreRows.length
      && expectedScoreRows.every((expected, index) => entry.scoreboardRows[index]?.label === expected.label
        && entry.scoreboardRows[index]?.kills === expected.kills));
    const targetReady = expectedTargetHp === null
      || (targetState?.playerHp === expectedTargetHp
        && (expectedTargetHp === 0 || !targetState.overlayVisible));
    const noMatchOverlay = states.every((entry) => entry.overlayTitle !== "VICTORY" && entry.overlayTitle !== "MATCH OVER");
    if (feedReady && scoreReady && targetReady && noMatchOverlay) return states;
    await sleep(50);
  }
  if (!fail) return null;
  throw new Error(`M52 kill feed did not converge with authoritative score/death state: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
}

async function waitForUiMatchResetEvidence(entries, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const ready = states.every((entry) => entry.scoreboardRows?.length === 2
      && entry.scoreboardRows.every((row) => row.kills === 0)
      && entry.playerHp === 100 && entry.playerGuard === 100
      && entry.opponentHp === 100 && entry.opponentGuard === 100
      && !entry.overlayVisible);
    if (ready) return states;
    await sleep(50);
  }
  throw new Error(`real online UI never returned to authoritative 0-0 rematch state: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
}

async function waitForUiPostResetDamageEvidence(entries, attacker, defender, timeoutMs, fail = true) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerState = states.find((entry) => entry.browser === attacker.name);
    const defenderState = states.find((entry) => entry.browser === defender.name);
    const scoreClean = states.every((entry) => entry.scoreboardRows?.length === 2
      && entry.scoreboardRows.every((row) => row.kills === 0));
    const damageReady = attackerState?.opponentHp < 100 && attackerState?.opponentHp > 0
      && defenderState?.playerHp === attackerState?.opponentHp
      && defenderState?.playerHp > 0;
    if (scoreClean && damageReady && !attackerState?.overlayVisible && !defenderState?.overlayVisible) return states;
    await sleep(50);
  }
  if (!fail) return null;
  throw new Error(`real online UI rematch never accepted fresh authoritative damage: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
}

async function waitForUiKillScoreEvidence(entries, attacker, defender, expectedKills, timeoutMs, fail = true) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerState = states.find((entry) => entry.browser === attacker.name);
    const defenderState = states.find((entry) => entry.browser === defender.name);
    const winnerId = attackerState?.playerNetId ?? 0;
    const loserId = defenderState?.playerNetId ?? 0;
    const scoreReady = attackerState?.scoreboardRows?.length === 2 && defenderState?.scoreboardRows?.length === 2
      && attackerState.scoreboardRows[0]?.label === `#${winnerId}` && attackerState.scoreboardRows[0]?.kills === expectedKills
      && attackerState.scoreboardRows[1]?.label === `#${loserId}` && attackerState.scoreboardRows[1]?.kills === 0
      && defenderState.scoreboardRows[0]?.label === `#${winnerId}` && defenderState.scoreboardRows[0]?.kills === expectedKills
      && defenderState.scoreboardRows[1]?.label === `#${loserId}` && defenderState.scoreboardRows[1]?.kills === 0;
    const deathReady = attackerState?.opponentHp === 0 && defenderState?.playerHp === 0;
    if (winnerId && loserId && scoreReady && deathReady) return states;
    await sleep(50);
  }
  if (!fail) return null;
  throw new Error(`real online UI never converged to authoritative ${expectedKills}-0 score: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
}

async function waitForUiMatchEndEvidence(entries, attacker, defender, timeoutMs, fail = true) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerState = states.find((entry) => entry.browser === attacker.name);
    const defenderState = states.find((entry) => entry.browser === defender.name);
    const winnerId = attackerState?.playerNetId ?? 0;
    const loserId = defenderState?.playerNetId ?? 0;
    const expectedDetail = `#${winnerId} wins · ${FFA_KILL_TARGET} KILLS`;
    const scoreReady = attackerState?.scoreboardRows?.length === 2 && defenderState?.scoreboardRows?.length === 2
      && attackerState.scoreboardRows[0]?.label === `#${winnerId}` && attackerState.scoreboardRows[0]?.kills === FFA_KILL_TARGET
      && attackerState.scoreboardRows[1]?.label === `#${loserId}` && attackerState.scoreboardRows[1]?.kills === 0
      && defenderState.scoreboardRows[0]?.label === `#${winnerId}` && defenderState.scoreboardRows[0]?.kills === FFA_KILL_TARGET
      && defenderState.scoreboardRows[1]?.label === `#${loserId}` && defenderState.scoreboardRows[1]?.kills === 0;
    const overlaysReady = attackerState?.overlayVisible && attackerState.overlayTitle === "VICTORY" && attackerState.overlayDetail === expectedDetail
      && defenderState?.overlayVisible && defenderState.overlayTitle === "MATCH OVER" && defenderState.overlayDetail === expectedDetail;
    const deathReady = attackerState?.opponentHp === 0 && defenderState?.playerHp === 0;
    if (winnerId && loserId && scoreReady && overlaysReady && deathReady) return states;
    await sleep(50);
  }
  if (!fail) return null;
  throw new Error(`real online UI never rendered authoritative first-to-${FFA_KILL_TARGET} winner: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
}

async function waitForUiRespawnEvidence(entries, attacker, defender, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerState = states.find((entry) => entry.browser === attacker.name);
    const defenderState = states.find((entry) => entry.browser === defender.name);
    const lifecycleReady = attackerState?.events.includes("Opponent respawned.")
      && defenderState?.events.includes("Respawned - back in the fight.");
    if (attackerState?.opponentHp === 100 && attackerState?.opponentGuard === 100
      && defenderState?.playerHp === 100 && defenderState?.playerGuard === 100
      && !defenderState.overlayVisible && lifecycleReady) return states;
    await sleep(50);
  }
  throw new Error(`real online UI never returned from authoritative defeat: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
}

async function readUiEvidence(session) {
  const value = await execute(session.base, session.sessionId, `
    const state = window.__MYASO_M30_UI__ ?? { events: [], eventTransitions: [], keys: [], keyTransitions: [], pointers: [], wheels: [], overlayTransitions: [], feedbackTransitions: [], recoveryTransitions: [], focusTransitions: [], threatTransitions: [], recoveryTellMaxPixels: 0, parryTellMaxPixels: 0, online: '' };
    const match = state.online.match(/player #(\\d+)/);
    return {
      title: document.title,
      activeElement: document.activeElement?.id ?? null,
      playerNetId: match ? Number(match[1]) : 0,
      eventText: document.querySelector('#event-text')?.textContent?.trim() ?? '',
      playerHp: Number(document.querySelector('#player-hp-value')?.textContent ?? NaN),
      playerGuard: Number(document.querySelector('#player-guard-value')?.textContent ?? NaN),
      playerStamina: Number(document.querySelector('#player-stamina-value')?.textContent ?? NaN),
      opponentHp: Number(document.querySelector('#bot-hp-value')?.textContent ?? NaN),
      opponentGuard: Number(document.querySelector('#bot-guard-value')?.textContent ?? NaN),
      focusLabel: document.querySelector('#focus-label')?.textContent?.trim() ?? '',
      focusTransitions: (state.focusTransitions ?? []).slice(),
      scoreboardTitle: document.querySelector('#scoreboard-title')?.textContent?.trim() ?? '',
      matchPointVisible: !document.querySelector('#match-point')?.hidden,
      matchPointText: document.querySelector('#match-point')?.textContent?.trim() ?? '',
      scoreboardRows: [...document.querySelectorAll('#scoreboard-list li')].map((row) => ({
        label: row.querySelector('span')?.textContent?.trim() ?? '',
        kills: Number(row.querySelector('b')?.textContent ?? NaN),
        own: row.dataset.own === 'true',
      })),
      killFeedRows: [...document.querySelectorAll('#kill-feed-list li')].map((row) => ({
        sequence: Number(row.dataset.sequence ?? NaN),
        text: row.textContent?.trim() ?? '',
        killerOwn: row.dataset.killerOwn === 'true',
        victimOwn: row.dataset.victimOwn === 'true',
      })),
      overlayVisible: !document.querySelector('#combat-overlay')?.hidden,
      overlayTitle: document.querySelector('#combat-overlay-title')?.textContent?.trim() ?? '',
      overlayDetail: document.querySelector('#combat-overlay-detail')?.textContent?.trim() ?? '',
      overlayTransitions: (state.overlayTransitions ?? []).slice(),
      combatFeedback: document.querySelector('.arena-stage')?.dataset.combatFeedback ?? '',
      feedbackTransitions: (state.feedbackTransitions ?? []).slice(),
      recoveryVisible: !document.querySelector('#opponent-recovery')?.hidden,
      recoveryState: document.querySelector('#opponent-recovery')?.dataset.state ?? '',
      recoveryLabel: document.querySelector('#opponent-recovery-label')?.textContent?.trim() ?? '',
      recoveryDetail: document.querySelector('#opponent-recovery-detail')?.textContent?.trim() ?? '',
      recoveryTransitions: (state.recoveryTransitions ?? []).slice(),
      threatVisible: !document.querySelector('#threat-cue')?.hidden,
      threatState: document.querySelector('#threat-cue')?.dataset.state ?? '',
      threatLabel: document.querySelector('#threat-label')?.textContent?.trim() ?? '',
      threatPhase: document.querySelector('#threat-phase')?.textContent?.trim() ?? '',
      threatCount: document.querySelector('#threat-count')?.hidden ? '' : (document.querySelector('#threat-count')?.textContent?.trim() ?? ''),
      threatSecondary: document.querySelector('#threat-secondary')?.hidden ? '' : (document.querySelector('#threat-secondary')?.textContent?.trim() ?? ''),
      threatSecondaryBearing: document.querySelector('#threat-secondary-bearing')?.hidden ? '' : (document.querySelector('#threat-secondary-bearing')?.textContent?.trim() ?? ''),
      threatSecondaryPhase: document.querySelector('#threat-secondary-phase')?.hidden ? '' : (document.querySelector('#threat-secondary-phase')?.textContent?.trim() ?? ''),
      threatSecondaryGuardArc: document.querySelector('#threat-secondary-guard-arc')?.hidden ? '' : (document.querySelector('#threat-secondary-guard-arc')?.textContent?.trim() ?? ''),
      threatBearing: document.querySelector('#threat-bearing')?.hidden ? '' : (document.querySelector('#threat-bearing')?.textContent?.trim() ?? ''),
      threatGuardArc: document.querySelector('#threat-guard-arc')?.hidden ? '' : (document.querySelector('#threat-guard-arc')?.textContent?.trim() ?? ''),
      threatTransitions: (state.threatTransitions ?? []).slice(),
      recoveryTellMaxPixels: Number(state.recoveryTellMaxPixels ?? 0),
      parryTellMaxPixels: Number(state.parryTellMaxPixels ?? 0),
      events: state.events.slice(),
      eventTransitions: (state.eventTransitions ?? []).slice(),
      keys: state.keys.slice(),
      keyTransitions: (state.keyTransitions ?? []).slice(),
      pointers: state.pointers.slice(),
      wheels: (state.wheels ?? []).slice(),
      m147InputPlane: (window.__MYASO_M147_INPUT_PLANE__ ?? [])
        .slice(-96).map((x) => ({ ...x })),
      m111InputPlane: window.__MYASO_M111_INPUT_PLANE__ ? {
        physicalTerminals: (window.__MYASO_M111_INPUT_PLANE__.physicalTerminals ?? []).slice().map((x) => ({ ...x })),
        lightReleases: (window.__MYASO_M111_INPUT_PLANE__.lightReleases ?? []).slice().map((x) => ({ ...x })),
        submitted: (window.__MYASO_M111_INPUT_PLANE__.submitted ?? []).slice(-96).map((x) => ({ ...x })),
      } : null,
      acceptance: window.__MYASO_ACCEPTANCE_STATE__ ? {
        scenario: window.__MYASO_ACCEPTANCE_STATE__.scenario ?? '',
        lastSubmittedClientTick: window.__MYASO_ACCEPTANCE_STATE__.lastSubmittedClientTick ?? null,
        lastSubmittedAtEpochMs: window.__MYASO_ACCEPTANCE_STATE__.lastSubmittedAtEpochMs ?? null,
        inputSubmissions: (window.__MYASO_ACCEPTANCE_STATE__.inputSubmissions ?? []).slice(-32).map((entry) => ({ ...entry })),
        // Original M121 60Hz v1 input sender trace, copied READ-ONLY from the
        // real page to the WebDriver observer; no cross-plane inference.
        m121SentSamples: (window.__MYASO_ACCEPTANCE_STATE__.m121SentSamples ?? [])
          .slice(-96).map((entry) => ({ ...entry })),
        playerNetId: Number(window.__MYASO_ACCEPTANCE_STATE__.playerNetId ?? 0),
        focusNetId: Number(window.__MYASO_ACCEPTANCE_STATE__.focusNetId ?? 0),
        serverTick: Number(window.__MYASO_ACCEPTANCE_STATE__.serverTick ?? 0),
        authoritativeStamina: Number(window.__MYASO_ACCEPTANCE_STATE__.authoritativeStamina ?? NaN),
        staminaTransitions: (window.__MYASO_ACCEPTANCE_STATE__.staminaTransitions ?? []).map((entry) => ({ ...entry })),
        staminaDenialTransitions: (window.__MYASO_ACCEPTANCE_STATE__.staminaDenialTransitions ?? []).map((entry) => ({ ...entry })),
        ownActionTransitions: (window.__MYASO_ACCEPTANCE_STATE__.ownActionTransitions ?? []).map((entry) => ({ ...entry })),
        focusActionTransitions: (window.__MYASO_ACCEPTANCE_STATE__.focusActionTransitions ?? []).map((entry) => ({ ...entry })),
        fighters: (window.__MYASO_ACCEPTANCE_STATE__.fighters ?? []).map((fighter) => ({ ...fighter })),
        m233RecoveryHandoff: (window.__MYASO_ACCEPTANCE_STATE__.m233RecoveryHandoff ?? []).slice(-96).map((entry) => ({
          ...entry,
          fighters: (entry.fighters ?? []).map((fighter) => ({ ...fighter })),
        })),
      } : null,
    };
  `);
  return { browser: session.name, ...value };
}

async function waitForResult(session) {
  const deadline = Date.now() + durationMs + 20000;
  while (Date.now() < deadline) {
    const value = await execute(
      session.base,
      session.sessionId,
      "return {result: window.__MYASO_PVP_RESULT__ || null, error: window.__MYASO_PVP_ERROR__ || null};",
    );
    if (value?.error) throw new Error(`${session.name} PvP page: ${value.error}`);
    if (value?.result) return { browser: session.name, ...value.result };
    await sleep(150);
  }
  throw new Error(`${session.name} PvP flight timed out`);
}

function assertPairedResults(results) {
  if (results.length !== 2) throw new Error(`expected two browser results, received ${results.length}`);
  const [first, second] = results;
  for (const result of results) {
    if (result.scenario !== scenario) throw new Error(`${result.browser} reported scenario ${result.scenario} instead of ${scenario}`);
    if (!result.ok) throw new Error(`${result.browser} did not verify authoritative PvP ${scenario}: ${JSON.stringify(result)}`);
    if (result.maxAuthoritativeEntities < 2) throw new Error(`${result.browser} never observed both players`);
    if (result.snapshots < 10 || result.acknowledgements < 10 || result.sentInputs < 20) {
      throw new Error(`${result.browser} did not sustain the PvP flight long enough`);
    }
    if (!Number.isFinite(result.frameP95) || result.frameP95 >= 25) {
      throw new Error(`${result.browser} p95 frame interval exceeded 25ms: ${result.frameP95}`);
    }
    if (scenario === "parry") {
      if (!result.attackerStunnedSeen || !result.defenderBlockSeen) {
        throw new Error(`${result.browser} did not observe the authoritative parry state transition`);
      }
      if (result.minDefenderHp !== 100 || result.minDefenderGuard !== 100) {
        throw new Error(`${result.browser} defender paid HP/guard cost during parry: ${JSON.stringify(result)}`);
      }
      if (!Number.isFinite(result.firstParryMs)) throw new Error(`${result.browser} did not timestamp a verified parry`);
    } else if (scenario === "dodge") {
      const rollCounter = result.attackerKnockdownSeen === true;
      if (!result.defenderDodgeSeen || (!result.dodgeOverlapSeen && !rollCounter)) {
        throw new Error(`${result.browser} did not observe an authoritative evade or roll-counter knockdown`);
      }
      if (result.minDefenderHp !== 100 || result.minDefenderGuard !== 100) {
        throw new Error(`${result.browser} defender paid HP/guard cost during dodge: ${JSON.stringify(result)}`);
      }
      if (result.defenderBlockSeen || Number.isFinite(result.firstParryMs)) {
        throw new Error(`${result.browser} roll scenario accidentally resolved as block/parry`);
      }
      // Wilds-style pointer rolls intentionally own collision knockdown. If the
      // defender reaches the attacker first, that authoritative knockdown is a
      // valid defensive resolution and can preempt the later attack/iframe overlap.
      if (!rollCounter) {
        if (!Number.isFinite(result.firstDodgeEvadeMs) || !Number.isFinite(result.dodgeOverlapDistance) || !Number.isFinite(result.dodgeOverlapArcDelta)) {
          throw new Error(`${result.browser} did not record verified dodge geometry/timing`);
        }
        if (result.dodgeOverlapDistance > 94 || result.dodgeOverlapArcDelta > Math.PI * 0.39) {
          throw new Error(`${result.browser} dodge overlap was outside authoritative hit geometry: ${JSON.stringify(result)}`);
        }
      }
    } else if (scenario === "block") {
      if (!result.defenderBlockSeen || !result.blockOverlapSeen) {
        throw new Error(`${result.browser} did not observe an in-range authoritative block/attack overlap`);
      }
      if (result.minDefenderHp !== 100 || !(result.minDefenderGuard < 100)) {
        throw new Error(`${result.browser} block did not preserve HP while consuming guard: ${JSON.stringify(result)}`);
      }
      if (result.defenderDodgeSeen || result.attackerStunnedSeen) {
        throw new Error(`${result.browser} block scenario accidentally resolved as dodge/parry`);
      }
      if (!Number.isFinite(result.firstGuardCostMs) || !Number.isFinite(result.blockOverlapDistance) || !Number.isFinite(result.blockOverlapArcDelta)) {
        throw new Error(`${result.browser} did not record verified block geometry/timing`);
      }
      if (result.blockOverlapDistance > 94 || result.blockOverlapArcDelta > Math.PI * 0.39) {
        throw new Error(`${result.browser} block overlap was outside authoritative hit geometry: ${JSON.stringify(result)}`);
      }
    } else if (scenario === "guardbreak") {
      if (!result.defenderBlockSeen || !result.blockOverlapSeen || !result.defenderStunnedSeen) {
        throw new Error(`${result.browser} did not observe authoritative guard-break progression`);
      }
      if (result.minDefenderHp !== 100 || result.minDefenderGuard !== 0) {
        throw new Error(`${result.browser} guard break did not exhaust guard while preserving HP: ${JSON.stringify(result)}`);
      }
      if (result.defenderDodgeSeen || result.attackerStunnedSeen) {
        throw new Error(`${result.browser} guard-break scenario accidentally resolved as dodge/parry`);
      }
      if (!Number.isFinite(result.firstGuardCostMs) || !Number.isFinite(result.firstGuardBreakMs) || !Number.isFinite(result.blockOverlapDistance) || !Number.isFinite(result.blockOverlapArcDelta)) {
        throw new Error(`${result.browser} did not record verified guard-break geometry/timing`);
      }
      if (result.blockOverlapDistance > 94 || result.blockOverlapArcDelta > Math.PI * 0.39) {
        throw new Error(`${result.browser} guard-break overlap was outside authoritative hit geometry: ${JSON.stringify(result)}`);
      }
    } else if (scenario === "backblock") {
      if (!result.defenderBlockSeen || !result.directionalBlockOverlapSeen) {
        throw new Error(`${result.browser} did not observe directional-block failure geometry`);
      }
      if (!(result.minDefenderHp < 100) || result.minDefenderGuard !== 100) {
        throw new Error(`${result.browser} rear-facing block did not allow HP damage with guard untouched: ${JSON.stringify(result)}`);
      }
      if (result.defenderDodgeSeen || result.attackerStunnedSeen) {
        throw new Error(`${result.browser} directional-block scenario accidentally resolved as dodge/parry`);
      }
      if (!Number.isFinite(result.firstDirectionalBlockHitMs) || !Number.isFinite(result.directionalBlockDistance) || !Number.isFinite(result.directionalAttackArcDelta) || !Number.isFinite(result.directionalBlockFacingDelta)) {
        throw new Error(`${result.browser} did not record directional-block timing/geometry`);
      }
      if (result.directionalBlockDistance > 94 || result.directionalAttackArcDelta > Math.PI * 0.39 || result.directionalBlockFacingDelta <= Math.PI * 0.46) {
        throw new Error(`${result.browser} directional-block geometry was not authoritative: ${JSON.stringify(result)}`);
      }
    } else if (scenario === "respawn") {
      if (!result.defenderDeadSeen || result.minDefenderHp !== 0 || result.defenderDamageTransitions < 3) {
        throw new Error(`${result.browser} did not observe a complete authoritative death sequence: ${JSON.stringify(result)}`);
      }
      if (result.minDefenderGuard !== 100 || result.respawnHp !== 100 || result.respawnGuard !== 100 || result.respawnAction !== 0) {
        throw new Error(`${result.browser} respawn did not restore idle full vitals: ${JSON.stringify(result)}`);
      }
      if (result.defenderBlockSeen || result.defenderDodgeSeen || result.attackerStunnedSeen) {
        throw new Error(`${result.browser} respawn scenario accidentally resolved through a defensive mechanic`);
      }
      if (!Number.isFinite(result.firstDeathMs) || !Number.isFinite(result.firstRespawnMs) || !Number.isFinite(result.respawnPositionRestoredMs) || !Number.isFinite(result.respawnDelayMs)
        || !Number.isFinite(result.deathPositionOffset) || !Number.isFinite(result.respawnPositionError)) {
        throw new Error(`${result.browser} did not record death/respawn timing and position evidence`);
      }
      if (result.respawnDelayMs < 1000 || result.respawnDelayMs > 1750 || result.deathPositionOffset < 10 || result.respawnPositionError > 2.5) {
        throw new Error(`${result.browser} death/respawn timing or spawn restoration was outside bounds: ${JSON.stringify(result)}`);
      }
    } else {
      if (result.minOwnHp >= 100 || result.minPeerHp >= 100) throw new Error(`${result.browser} did not observe both sides taking damage`);
      if (result.ownDamageTransitions < 1 || result.peerDamageTransitions < 1) throw new Error(`${result.browser} did not observe authoritative HP transitions`);
    }
  }
  if (first.playerNetId === second.playerNetId) throw new Error("paired browsers received the same player identity");
  if (first.peerNetId !== second.playerNetId || second.peerNetId !== first.playerNetId) {
    throw new Error(`paired browsers disagree on opponent identity: ${JSON.stringify(results)}`);
  }
  if (scenario !== "damage") {
    const roles = results.map((result) => result.role).sort().join(",");
    if (roles !== "attacker,defender") throw new Error(`paired browsers did not resolve attacker/defender roles: ${roles}`);
  }
}

async function waitForDriver(base, child, name) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${name} driver exited early with ${child.exitCode}`);
    try {
      const response = await fetch(`${base}/status`);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`${name} driver did not become ready`);
}

async function execute(base, sessionId, script) {
  const response = await webdriver(base, "POST", `/session/${sessionId}/execute/sync`, { script, args: [] });
  // A successful WebDriver script may intentionally return null. Preserve it;
  // nullish fallback would turn an absent cue into the truthy response envelope.
  return response && Object.hasOwn(response, "value") ? response.value : response;
}

async function webdriver(base, method, pathname, body) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }
  if (!response.ok || payload?.value?.error) {
    throw new Error(`WebDriver ${method} ${pathname} failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload.value ?? payload;
}
function terminate(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 1500).unref();
}

function send(response, status, body) {
  response.statusCode = status;
  response.setHeader("content-type", "text/plain; charset=utf-8");
  response.end(body);
}

function contentType(filename) {
  if (filename.endsWith(".html")) return "text/html; charset=utf-8";
  if (filename.endsWith(".mjs") || filename.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filename.endsWith(".css")) return "text/css; charset=utf-8";
  if (filename.endsWith(".ogg")) return "audio/ogg";
  if (filename.endsWith(".mp3")) return "audio/mpeg";
  if (filename.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}
