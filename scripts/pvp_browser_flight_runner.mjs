import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { COMBAT_ACTION, FFA_KILL_TARGET } from "../src/browser/combat-readability.mjs";
import { COMBAT } from "../src/combat/model.mjs";

const root = process.cwd();
const durationMs = Number(process.env.MYASO_PVP_FLIGHT_DURATION_MS ?? 7000);
const scenario = process.env.MYASO_PVP_SCENARIO ?? "damage";
// Headless Firefox can occasionally stall longer than a 40 ms DOM key tap.
// Keep the real E key depressed across multiple browser/input frames so the
// authoritative client has a fair opportunity to sample the genuine gesture.
const heavyKeyPulseMs = 120;
// A full M62 threat chevron paints dozens of exact-tone pixels; a handful can
// arise from raster overlap. Use one significance floor for positive and leak proof.
const threatMarkerMinPixels = 8;
if (!new Set(["damage", "inputloss", "parry", "dodge", "block", "guardbreak", "backblock", "respawn", "ui", "uirespawn", "uifeedback", "uihittell", "uivitals", "uiidentity", "uiscore", "uimatch", "uirematch", "uiffa3", "uikillfeed", "uifocus", "uithreat", "uithreatbearing", "uimultithreat", "uisecondarythreat", "uisecondarybearing", "uisecondaryphase", "uiguardarc", "uisecondaryguardarc", "uithreatmarkers", "uijumpffaprimary", "uijumpffasecondary", "uijumprecoveryffa", "uijumppunishffa", "uimultirecoveryffa", "uimultirecoveryspatial", "uimultirecoverypunish", "uiparry", "uiparrypunishwindow", "uiparrypunishffa", "uiparrypunishffahit", "uiguardbreakpunishffa", "uiguardbreakpunishffahit", "uikickknockdownffa", "uikickknockdownffahit", "uikickknockdownbounded", "uirollknockdownbounded", "uirollknockdownffahit", "uimultiknockdownffa", "uimultiknockdownffahit", "uirollknockdownffa", "uistun", "uiguardbreak", "uidodge", "uirecovery", "uirecoverytell", "uiattackintent", "uiheavy", "uiheavyinputloss", "uiheavyblock", "uiheavyparry", "uiheavydodge", "uiheavypunish", "uiheavyguardbreak", "uiheavyguardbreakpunish", "uifeint", "uirunningattack", "uidirectionallight", "uirollbuffer", "uijumpbuffer", "uijumpattack", "uijumpattackinputloss", "uijumpattackpunish", "uijumpattacktelegraph", "uijumpattackblock", "uijumpattackparry", "uijumpattackdodge", "uijumpattackbuffer", "uikickbuffer", "uiguardbreaktell", "uiparrytell", "uiblockfacingtell", "uidodgetell", "uideathtell"]).has(scenario)) throw new Error(`unsupported MYASO_PVP_SCENARIO: ${scenario}`);
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
let gameServer;

try {
  staticServer = await startStaticServer();
  const game = await startGameServer();
  gameServer = game.child;
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
    console.log(`M33_ONLINE_PARRY_FEEDBACK ${JSON.stringify({ ok: true, results })}`);
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
    const results = await runOnlineUiHeavyStrikeFlight(sessions);
    const droppedActionDatagrams = (game.output().match(/M63_INPUT_ACTION_PACKET_DROPPED/g) ?? []).length;
    if (droppedActionDatagrams < 1) {
      throw new Error(`M108 expected a deliberately dropped first-send heavy-action datagram, observed ${droppedActionDatagrams}`);
    }
    console.log(`M108_HEAVY_INPUT_LOSS_RECOVERY ${JSON.stringify({ ok: true, droppedActionDatagrams, results })}`);
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
    console.log(`M117_REAL_WHEEL_FEINT ${JSON.stringify({ ok: true, results })}`);
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
    console.log(`M136_REAL_JUMP_ATTACK_CHORD ${JSON.stringify({ ok: true, results })}`);
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
  } else if (scenario === "uiguardbreaktell") {
    const results = await runOnlineUiGuardBreakTellFlight(sessions);
    console.log(`M40_FFA_GUARD_BREAK_TELL ${JSON.stringify({ ok: true, results })}`);
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
  if (staticServer) await new Promise((resolve) => staticServer.close(resolve));
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
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
      MYASO_FLIGHT_DROP_NEW_ACTION_DATAGRAMS:
        scenario === "inputloss" || scenario === "uiheavyinputloss" || scenario === "uijumpattackinputloss" ? "1" : "0",
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
  if (scenario === "uiparry" || scenario === "uistun" || scenario === "uiguardbreak" || scenario === "uidodge" || scenario === "uiattackintent" || scenario === "uiheavy" || scenario === "uiheavyinputloss" || scenario === "uiheavyblock" || scenario === "uiheavyparry" || scenario === "uiheavydodge" || scenario === "uiheavypunish" || scenario === "uiheavyguardbreak" || scenario === "uiheavyguardbreakpunish" || scenario === "uifeint" || scenario === "uirunningattack" || scenario === "uidirectionallight" || scenario === "uirollbuffer" || scenario === "uijumpbuffer" || scenario === "uijumpattack" || scenario === "uijumpattackinputloss" || scenario === "uijumpattackpunish" || scenario === "uijumpattacktelegraph" || scenario === "uijumpffaprimary" || scenario === "uijumpffasecondary" || scenario === "uijumprecoveryffa" || scenario === "uijumppunishffa" || scenario === "uimultirecoveryffa" || scenario === "uimultirecoveryspatial" || scenario === "uimultirecoverypunish" || scenario === "uiparrypunishwindow" || scenario === "uiparrypunishffa" || scenario === "uiparrypunishffahit" || scenario === "uiguardbreakpunishffa" || scenario === "uiguardbreakpunishffahit" || scenario === "uikickknockdownffa" || scenario === "uikickknockdownffahit" || scenario === "uikickknockdownbounded" || scenario === "uirollknockdownbounded" || scenario === "uirollknockdownffahit" || scenario === "uimultiknockdownffa" || scenario === "uimultiknockdownffahit" || scenario === "uirollknockdownffa" || scenario === "uijumpattackblock" || scenario === "uijumpattackparry" || scenario === "uijumpattackdodge" || scenario === "uijumpattackbuffer" || scenario === "uikickbuffer" || scenario === "uiguardbreaktell" || scenario === "uiparrytell" || scenario === "uiblockfacingtell" || scenario === "uidodgetell") {
    await webdriver(base, "POST", `/session/${sessionId}/window/rect`, { x: 0, y: 0, width: 1280, height: 900 });
  }
  return { ...browser, child, base, sessionId };
}

async function navigate(session, gameUrl, certificateHash) {
  const page = scenario === "ui" || scenario === "uirespawn" || scenario === "uifeedback" || scenario === "uihittell" || scenario === "uivitals" || scenario === "uiidentity" || scenario === "uiscore" || scenario === "uimatch" || scenario === "uirematch" || scenario === "uiffa3" || scenario === "uikillfeed" || scenario === "uifocus" || scenario === "uithreat" || scenario === "uithreatbearing" || scenario === "uimultithreat" || scenario === "uisecondarythreat" || scenario === "uisecondarybearing" || scenario === "uisecondaryphase" || scenario === "uiguardarc" || scenario === "uisecondaryguardarc" || scenario === "uithreatmarkers" || scenario === "uijumpffaprimary" || scenario === "uijumpffasecondary" || scenario === "uijumprecoveryffa" || scenario === "uijumppunishffa" || scenario === "uimultirecoveryffa" || scenario === "uimultirecoveryspatial" || scenario === "uimultirecoverypunish" || scenario === "uiparry" || scenario === "uiparrypunishwindow" || scenario === "uiparrypunishffa" || scenario === "uiparrypunishffahit" || scenario === "uiguardbreakpunishffa" || scenario === "uiguardbreakpunishffahit" || scenario === "uikickknockdownffa" || scenario === "uikickknockdownffahit" || scenario === "uikickknockdownbounded" || scenario === "uirollknockdownbounded" || scenario === "uirollknockdownffahit" || scenario === "uimultiknockdownffa" || scenario === "uimultiknockdownffahit" || scenario === "uirollknockdownffa" || scenario === "uistun" || scenario === "uiguardbreak" || scenario === "uidodge" || scenario === "uirecovery" || scenario === "uirecoverytell" || scenario === "uiattackintent" || scenario === "uiheavy" || scenario === "uiheavyinputloss" || scenario === "uiheavyblock" || scenario === "uiheavyparry" || scenario === "uiheavydodge" || scenario === "uiheavypunish" || scenario === "uiheavyguardbreak" || scenario === "uiheavyguardbreakpunish" || scenario === "uifeint" || scenario === "uirunningattack" || scenario === "uidirectionallight" || scenario === "uirollbuffer" || scenario === "uijumpbuffer" || scenario === "uijumpattack" || scenario === "uijumpattackinputloss" || scenario === "uijumpattackpunish" || scenario === "uijumpattacktelegraph" || scenario === "uijumpattackblock" || scenario === "uijumpattackparry" || scenario === "uijumpattackdodge" || scenario === "uijumpattackbuffer" || scenario === "uikickbuffer" || scenario === "uiguardbreaktell" || scenario === "uiparrytell" || scenario === "uiblockfacingtell" || scenario === "uidodgetell" || scenario === "uideathtell" ? "index.html" : "pvp-flight.html";
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
  let evidence = await runOnlineUiFeedbackFlight(entries);
  const attacker = evidence.find((entry) => entry.feedbackTransitions.includes("hit-confirm"));
  const defender = evidence.find((entry) => entry.feedbackTransitions.includes("damage-taken"));
  if (!attacker || !defender || attacker.browser === defender.browser) {
    throw new Error(`M38 could not resolve attacker / defender: ${JSON.stringify(evidence)}`);
  }
  const attackerSession = entries.find((entry) => entry.name === attacker.browser);
  const defenderSession = entries.find((entry) => entry.name === defender.browser);
  if (!attackerSession || !defenderSession) throw new Error(`M38 could not resolve browser sessions`);

  const tell = await waitForRemoteRecoveryTell(defenderSession, attackerSession, 700);
  evidence = await Promise.all(entries.map(readUiEvidence));
  evidence = evidence.map((entry) => ({
    ...entry,
    recoveryTellMaxPixels: entry.browser === defender.browser ? tell.observerMax : tell.localMax,
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
      await setArenaAttack(attacker, attackerElementId, true, attackOffset);
      try {
        evidence = await waitForRemoteWindupTell(entries, attacker, defender, 600, false);
      } finally {
        await setArenaAttack(attacker, attackerElementId, false, attackOffset);
      }
      if (!evidence) await sleep(520);
    }
    if (!evidence) evidence = await waitForRemoteWindupTell(entries, attacker, defender, 300, true);
  } finally {
    await stopWindupTellSampler(defender);
  }
  await waitForWindupTellClear(defender, 500);
  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) throw new Error(`incomplete M39 UI evidence: ${JSON.stringify(evidence)}`);
  if (!attackerResult.keys.includes(`keydown:${movementCode}`) || !attackerResult.keys.includes(`keyup:${movementCode}`)) {
    throw new Error(`M39 real attacker movement was not delivered: ${JSON.stringify(attackerResult)}`);
  }
  const attackDown = attackerResult.pointers.find((event) => event.type === "pointerdown" && event.button === 0);
  const aimValid = attackDown && Math.abs(attackDown.y - 0.5) <= 0.15 && (attackRight ? attackDown.x >= 0.6 : attackDown.x <= 0.4);
  if (!aimValid) throw new Error(`M39 real attacker aim was not delivered: ${JSON.stringify(attackerResult)}`);
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

  await pulseMovementKey(attacker, "e", heavyKeyPulseMs);
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
  if (!attackerResult.keys.includes("keydown:KeyE") || !attackerResult.keys.includes("keyup:KeyE")) {
    throw new Error(`M106 real heavy-strike E control was not delivered: ${JSON.stringify(attackerResult)}`);
  }
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
  { attackerName = "chrome", defenderName = "firefox", movementMs = 180 } = {},
) {
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const attacker = entries.find((entry) => entry.name === attackerName);
  const defender = entries.find((entry) => entry.name === defenderName);
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
  await pulseMovementKey(attacker, movementKey, movementMs);
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

function assertHeavyControlDelivered(attackerResult, movementCode, label) {
  if (!attackerResult.keys.includes(`keydown:${movementCode}`)
    || !attackerResult.keys.includes(`keyup:${movementCode}`)) {
    throw new Error(`${label} real attacker movement was not delivered: ${JSON.stringify(attackerResult)}`);
  }
  if (!attackerResult.keys.includes("keydown:KeyE") || !attackerResult.keys.includes("keyup:KeyE")) {
    throw new Error(`${label} real heavy-strike E control was not delivered: ${JSON.stringify(attackerResult)}`);
  }
}

async function runOnlineUiHeavyBlockFlight(entries) {
  const staged = await prepareHeavyCounterplayFlight(entries, "M107 heavy block");
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
    // Start the genuine E edge and schedule two genuine wheel-back pulses from
    // the defender's own WebDriver clock at 70 ms and 170 ms. Their unchanged
    // 240 ms short-block windows overlap by 140 ms, leaving enough scheduler
    // margin that authority stays in one Block action through the ~320 ms impact.
    await Promise.all([
      pulseMovementKey(attacker, "e", heavyKeyPulseMs),
      scrollArenaWheelPair(defender, defenderElementId, 120, 70, 100),
    ]);
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
  const staged = await prepareHeavyCounterplayFlight(entries, "M107 heavy parry");
  const { attacker, defender, attackerElementId, defenderElementId, movementCode } = staged;
  const attackRight = movementCode === "KeyD";
  const attackOffset = attackRight ? 200 : -200;
  const blockOffset = attackRight ? -200 : 200;
  let evidence = null;
  let lastObserved = null;

  // As with the heavy-block flight, WebDriver can deliver the E edge while the
  // browser input latch misses the outbound sample. Retry only that completely
  // pristine case. Any evidence that a heavy actually committed, hit, blocked,
  // or otherwise resolved makes the attempt terminal and therefore fail-closed.
  for (let attempt = 1; attempt <= 3 && !evidence; attempt += 1) {
    // Anchor the genuine wheel-back to authoritative heavy windup instead of
    // WebDriver dispatch timing. Heavy windup is 320 ms; once Firefox actually
    // sees HEAVY WINDUP, wait into the final portion of that commitment and
    // deliver wheel-back while the unchanged 125 ms parry window can still cover
    // the active transition. A clean E-latch miss remains retryable below.
    const heavyPromise = pulseMovementKey(attacker, "e", heavyKeyPulseMs);
    const windupDeadline = Date.now() + COMBAT.heavyAttack.windupMs + 180;
    let windupSeen = false;
    while (!windupSeen && Date.now() < windupDeadline) {
      const liveDefender = await readUiEvidence(defender);
      windupSeen = liveDefender.threatTransitions.some((entry) =>
        entry.visible && entry.phase === "HEAVY WINDUP");
      if (!windupSeen) await sleep(6);
    }
    if (windupSeen) {
      await sleep(150);
      await scrollArenaWheel(defender, defenderElementId, 120, 0);
    }
    await heavyPromise;
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
    { attackerName: "firefox", defenderName: "chrome", movementMs: 200 },
  );
  const { attacker, defender, movementCode } = staged;

  let committedObserved = false;
  let lastCommitEvidence = null;
  for (let attempt = 1; attempt <= 3 && !committedObserved; attempt += 1) {
    const before = await Promise.all(entries.map(readUiEvidence));
    const beforeAttacker = before.find((entry) => entry.browser === attacker.name);
    const commitsBefore = beforeAttacker?.events.filter((text) =>
      text.startsWith("Heavy strike committed")).length ?? 0;

    await pulseMovementKey(attacker, "e", heavyKeyPulseMs);
    const commitDeadline = Date.now() + 360;
    while (Date.now() < commitDeadline) {
      const state = await readUiEvidence(attacker);
      const commits = state.events.filter((text) =>
        text.startsWith("Heavy strike committed")).length;
      if (commits > commitsBefore) {
        committedObserved = true;
        break;
      }
      await sleep(10);
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

  // The sample-safe 120 ms real E hold now contributes the timing margin that
  // used to come from an extra post-observation sleep. Roll immediately after
  // authoritative heavy commitment is observed so the unchanged 125 ms iframe
  // overlaps the ~320 ms heavy active transition instead of landing after it.
  await pressArenaPerpendicularDodgeAfterPause(defender, 0);
  // Let active -> recovery resolve without evidence polling inside the iframe.
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
  const staged = await prepareHeavyCounterplayFlight(
    entries,
    "M121 directional light",
    { attackerName: "chrome", defenderName: "firefox", movementMs: 150 },
  );
  const { attacker, defender, attackerElementId, movementCode } = staged;
  const attackRight = movementCode === "KeyD";
  // In screen-space coordinates, left of a right-facing fighter is W/up; left
  // of a left-facing fighter is S/down.
  const strafeKey = attackRight ? "w" : "s";
  const strafeCode = attackRight ? "KeyW" : "KeyS";
  const attackOffset = attackRight ? 200 : -200;

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
  if (recoveryToDodgeDelayMs < 0 || recoveryToDodgeDelayMs > 140) {
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
  if (perpendicularAim.epochMs < ownAttackRecovery.epochMs
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

  await performArenaJumpAttackChord(attacker, attackerElementId, attackOffset, 90);

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

  return evidence.map((entry) => ({
    ...entry,
    jumpAttackChordEpochMs: entry.browser === attacker.name ? chordEpochMs : null,
    jumpAttackWindupEpochMs: entry.browser === attacker.name ? authoritativeWindup.epochMs : null,
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
  // Leave the dodge case slightly farther apart than block/parry. The unchanged
  // jump attack still reaches during its active movement, but not at the very
  // first active tick, giving the genuine wheel-forward roll time to become
  // authoritative on hosted cross-browser WebDriver.
  const movementMs = defense === "dodge" ? 140 : 180;
  const label = `M138 jump attack ${defense}`;
  const staged = await prepareHeavyCounterplayFlight(
    entries,
    label,
    { attackerName, defenderName, movementMs },
  );
  const { attacker, defender, attackerElementId, defenderElementId, movementCode } = staged;
  const attackOffset = movementCode === "KeyD" ? 200 : -200;
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
  } else if (defense === "parry" || defense === "dodge") {
    // Start both real-browser commands concurrently. Chrome's wheel command
    // carries ~30-40 ms of driver/input overhead on hosted CI. Dodge wants the
    // earliest possible roll ownership, while parry must start later so its
    // unchanged 125 ms opening is still fresh at the 105 ms jump impact.
    // Keep dodge at 10 ms; delay only parry to 35 ms.
    if (defense === "dodge") await aimArena(defender, defenderElementId, 0, 180);
    const defenseDelayMs = defense === "parry" ? 35 : 10;
    let chordHeld = false;
    try {
      const chordPress = pressArenaJumpAttackChord(attacker, attackerElementId, attackOffset);
      const defenseWheel = scrollArenaWheel(
        defender,
        defenderElementId,
        defense === "parry" ? 120 : -120,
        defenseDelayMs,
      );
      await chordPress;
      chordHeld = true;
      await defenseWheel;
      await sleep(20);
    } finally {
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
  const ownPlainJumpIndex = ownTransitions.findIndex((entry) => entry.action === COMBAT_ACTION.jump);
  if ((!rollCounter && ownWindupIndex < 0) || focusWindupIndex < 0
    || (defense !== "parry" && !rollCounter
      && (ownActiveIndex <= ownWindupIndex || focusActiveIndex <= focusWindupIndex))
    || (ownWindupIndex >= 0 && ownPlainJumpIndex >= 0 && ownPlainJumpIndex < ownWindupIndex)) {
    throw new Error(`${label} did not preserve direct authoritative jump-attack commitment: ${JSON.stringify({
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
  // M140 proves the player's commitment starts inside the unchanged 290 ms
  // recovery window. The unchanged 135 ms light windup may finish after that
  // recovery ends; changing its timing would be a balance change, not a proof.
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
        const kickActive = kickerActions
          .filter((entry) => entry.action === COMBAT_ACTION.kickActive && Number.isFinite(entry.epochMs))
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

        if (kickActive && rightDowns.length === 1 && rightUps.length === 1
          && focusSeen && cueSeen && vitalsClean) {
          if (!Number.isFinite(rightDown?.epochMs) || !Number.isFinite(rightUp?.epochMs)
            || rightUp.epochMs <= rightDown.epochMs || rightUp.epochMs - rightDown.epochMs >= 180) {
            throw new Error(milestone + " did not deliver one genuine short RMB kick: "
              + JSON.stringify(kickPointers));
          }
          if (knockdownTransition.epochMs + 80 < kickActive.epochMs
            || knockdownTransition.epochMs > kickActive.epochMs + COMBAT.kick.activeMs + 140) {
            throw new Error(milestone + " could not tie knockdown to the authoritative kick active phase: "
              + JSON.stringify({ kickActive, knockdownTransition }));
          }
          conversion.kickActive = kickActive;
          break;
        }
        await sleep(6);
      }

      if (!conversion.kickActive) {
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
  const defenderFocusActions = defenderState.acceptance?.focusActionTransitions ?? [];
  const defenderSawPunishActive = defenderState.acceptance?.focusNetId === punisherId
    && defenderFocusActions.some((entry) =>
      entry.action === COMBAT_ACTION.attackActive
      && Number.isFinite(entry.epochMs)
      && entry.epochMs >= punishWindup.epochMs
      && (!defenderRecovery || entry.epochMs < defenderRecovery.epochMs));
  if (punishActive.epochMs >= knockdownEndEpochMs
    || (defenderRecovery && punishActive.epochMs >= defenderRecovery.epochMs)
    || !defenderSawPunishActive) {
    throw new Error(milestone + " authoritative ordering did not prove #"
      + punisherId + " became active before #" + defenderId + " recovered: "
      + JSON.stringify({
        knockdownTransition: conversion.knockdownTransition,
        knockdownEndEpochMs,
        punishWindup,
        punishActive,
        defenderRecovery,
        defenderFocusActions,
      }));
  }
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
    m155PunishActiveEpochMs: punishActive.epochMs,
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
  const movementKey = rollRight ? "d" : "a";
  const secondClusterKey = secondVictimId > firstVictimId ? "a" : "d";
  const secondVerticalKey = "s";
  const rollOffset = rollRight ? 200 : -200;

  // Authoritative spawns are 96 px apart. Move #3 down just under one body
  // width, then about 69 px toward #2. The older 170 ms vertical pulse left
  // nominal center distance around 45-46 px, barely outside the unchanged
  // 44 px roll-collision radius under frame quantization. A 145 ms pulse keeps
  // the fighters physically separate while giving the real roll a few pixels
  // of deterministic collision margin, without changing production geometry.
  // #1 still closes roughly 26 px before rolling, preserving a browser-visible
  // stagger between the two unchanged 260 ms knockdown windows.
  await pulseMovementKey(secondVictim, secondVerticalKey, 145);
  await pulseMovementKey(secondVictim, secondClusterKey, 320);
  await pulseMovementKey(roller, movementKey, 120);
  await aimArena(roller, rollerElementId, rollOffset);
  await sleep(50);

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
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
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
  const retreatKey = rollRight ? "a" : "d";
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
    pulseMovementKey(punisher, "a", 900),
  ]);
  await pulseMovementKey(secondVictim, secondClusterKey, 340);
  await pulseMovementKey(roller, rollKey, 210);
  await aimArena(roller, rollerElementId, rollOffset);
  await sleep(50);

  const beforeStates = await Promise.all(entries.map(readUiEvidence));
  const rollerBefore = beforeStates.find((entry) => entry.browser === roller.name);
  const firstBefore = beforeStates.find((entry) => entry.browser === firstVictim.name);
  const secondBefore = beforeStates.find((entry) => entry.browser === secondVictim.name);
  const punisherBefore = beforeStates.find((entry) => entry.browser === punisher.name);
  const wheelOffset = rollerBefore.wheels.length;
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
  const readFirstOwnActions = () => execute(
    firstVictim.base,
    firstVictim.sessionId,
    "return (window.__MYASO_ACCEPTANCE_STATE__?.ownActionTransitions ?? []).map((entry) => ({ ...entry }));",
  );

  await setMovementKey(roller, retreatKey, true);
  await scrollArenaWheel(roller, rollerElementId, -120, 0);

  let trigger = null;
  const triggerDeadline = Date.now() + COMBAT.dodge.durationMs + COMBAT.dodge.collisionKnockdownMs + 120;
  while (Date.now() < triggerDeadline && !trigger) {
    const firstActions = await readFirstOwnActions();
    const firstKnockdown = firstActions.slice(firstActionOffset).find((entry) =>
      entry.action === COMBAT_ACTION.knockdown && Number.isFinite(entry.epochMs));
    if (firstKnockdown) {
      trigger = { firstKnockdown };
      break;
    }
    await sleep(1);
  }
  if (!trigger) {
    await setMovementKey(roller, retreatKey, false);
    throw new Error(milestone + " never observed authoritative primary knockdown #"
      + firstVictimId + ": " + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  // Commit one genuine LMB immediately on #2's authoritative knockdown. Keep
  // same real button held while waiting for #3's authoritative knockdown, then
  // re-aim during the unchanged 135 ms light windup. This removes stale-facing
  // misses caused by #2's roll knockback/separation drift without changing
  // attack reach, arc, windup, or the one-LMB provenance contract.
  await setArenaAttackButton(punisher, true);
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
  await setArenaAttackButton(punisher, false);
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

  if (!Number.isFinite(provenance.rollWheel.epochMs)
    || provenance.firstKnockdown.epochMs >= provenance.secondKnockdown.epochMs
    || provenance.secondKnockdown.epochMs >= provenance.firstKnockdown.epochMs + COMBAT.dodge.collisionKnockdownMs) {
    throw new Error(milestone + " did not prove ordered overlapping roll knockdowns: "
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
  if (punishDowns.length !== 1 || punishUps.length !== 1
    || !Number.isFinite(punishDown?.epochMs)
    || punishDown.epochMs < provenance.rollTransition.epochMs
    || punishDown.epochMs < provenance.firstKnockdown.epochMs - 40
    || punishDown.epochMs >= provenance.firstKnockdown.epochMs + COMBAT.dodge.collisionKnockdownMs) {
    throw new Error(milestone + " genuine #4 LMB did not target the selected overlap window: "
      + JSON.stringify({ punishPointers, provenance, punishAim }));
  }

  const punisherActions = punisherState.acceptance?.ownActionTransitions ?? [];
  const punishWindup = punisherActions.find((entry) =>
    entry.action === COMBAT_ACTION.attackWindup
    && Number.isFinite(entry.epochMs)
    && entry.epochMs >= punishDown.epochMs - 40);
  const punishActive = punishWindup
    ? punisherActions.find((entry) =>
      entry.action === COMBAT_ACTION.attackActive
      && Number.isFinite(entry.epochMs)
      && entry.epochMs >= punishWindup.epochMs)
    : null;
  const primaryKnockdownEnd = provenance.firstKnockdown.epochMs + COMBAT.dodge.collisionKnockdownMs;
  if (!punishWindup || !punishActive
    || punishActive.epochMs < provenance.secondKnockdown.epochMs
    || punishActive.epochMs >= primaryKnockdownEnd) {
    throw new Error(milestone + " #4 attack-active did not land inside the overlapping knockdown window: "
      + JSON.stringify({
        punishDown,
        punishWindup,
        punishActive,
        firstKnockdown: provenance.firstKnockdown,
        secondKnockdown: provenance.secondKnockdown,
        primaryKnockdownEnd,
      }));
  }

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
    m159PunishActiveEpochMs: punishActive.epochMs,
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

  const readDefenderOwnActions = () => execute(
    defender.base,
    defender.sessionId,
    "return (window.__MYASO_ACCEPTANCE_STATE__?.ownActionTransitions ?? []).map((entry) => ({ ...entry }));",
  );

  // Separate the two possible light targets without changing combat reach.
  // Keep #3 at neutral spacing so the unchanged 34-unit roll knockback can
  // bring #2 into the unchanged 76-unit light reach. #1 backs away briefly
  // and keeps that opposite movement held; dodge recovery then continues
  // pulling #1 out of #3's strike lane.
  await aimArena(roller, rollerElementId, rollOffset);
  await aimArena(punisher, punisherElementId, punishOffset);
  await sleep(50);

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
    await scrollArenaWheel(roller, rollerElementId, -120, 0);

    // The conversion window is only 260 ms and the unchanged light windup is
    // 135 ms. Poll the victim's authoritative action stream alone so #3 can
    // commit the real LMB on the first knockdown snapshot instead of paying
    // three WebDriver reads plus focus/HUD replication before acting.
    const setupDeadline = Date.now() + COMBAT.dodge.durationMs
      + COMBAT.dodge.collisionKnockdownMs + 220;
    let knockdownTransition = null;
    while (Date.now() < setupDeadline && !knockdownTransition) {
      const defenderActions = await readDefenderOwnActions();
      const newDefenderActions = defenderActions.slice(defenderActionOffset);
      knockdownTransition = newDefenderActions.find((entry) =>
        entry.action === COMBAT_ACTION.knockdown && Number.isFinite(entry.epochMs)) ?? null;
      if (knockdownTransition) break;
      await sleep(1);
    }

    if (knockdownTransition) {
      conversion = {
        attempt,
        punishPointerOffset,
        knockdownTransition,
      };
      // Pointer was already aimed before the roll; avoid another pointerMove
      // round trip before the tight 260 ms knockdown conversion window.
      await setArenaAttackButton(punisher, true);
      await sleep(40);
      await setArenaAttackButton(punisher, false);

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
  const punishAimValid = punishDown
    && Math.abs(punishDown.y - 0.5) <= 0.15
    && (punisherId < defenderId ? punishDown.x >= 0.6 : punishDown.x <= 0.4);
  const knockdownEndEpochMs = conversion.knockdownTransition.epochMs + COMBAT.dodge.collisionKnockdownMs;
  if (punishDowns.length !== 1 || punishUps.length !== 1 || !punishAimValid
    || !Number.isFinite(punishDown?.epochMs)
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
  if (punishActive.epochMs >= knockdownEndEpochMs
    || (defenderRecovery && punishActive.epochMs >= defenderRecovery.epochMs)) {
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

  const aimAtAuthoritativeTarget = async (entry, elementId, targetNetId) => {
    const offset = await execute(entry.base, entry.sessionId, `
      const a = window.__MYASO_ACCEPTANCE_STATE__;
      const own = a?.fighters?.find((fighter) => fighter.netId === a.playerNetId);
      const target = a?.fighters?.find((fighter) => fighter.netId === ${targetNetId});
      const canvas = document.querySelector('#arena');
      const rect = canvas.getBoundingClientRect();
      if (!own || !target || !canvas || rect.width <= 0 || rect.height <= 0) return null;
      return {
        x: (target.x - own.x) * (rect.width / canvas.width),
        y: (target.y - own.y) * (rect.height / canvas.height),
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
  await aimAtAuthoritativeTarget(suppressor, suppressorElementId, defenderId);
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
  // #1 away from the collision lane.
  await setMovementKey(opener, openerMovementKey, true);
  await scrollArenaWheel(opener, openerElementId, -120, 0);

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

  // #2 has moved by the opener's unchanged 34 px knockback. Re-aim #3 using
  // the authoritative world delta before waiting for the late suppression roll.
  await aimAtAuthoritativeTarget(suppressor, suppressorElementId, defenderId);

  // Send #3's genuine wheel-forward roll immediately after the authoritative
  // re-aim. The prior +170 ms wall-clock wait, combined with WebDriver/server
  // ingress latency, could make the roll authoritative only after #2's 260 ms
  // knockdown had already expired. The re-aim round trip itself provides
  // enough delay for #1 to clear the lane; immediate wheel delivery leaves #3
  // active across #2's original recovery frame without changing gameplay.
  await scrollArenaWheel(suppressor, suppressorElementId, -120, 0);

  let suppressedDodge = null;
  let suppressorDodgeRecovery = null;
  let originalRecovery = null;
  const recoveryDeadline = Date.now() + COMBAT.dodge.collisionKnockdownMs + COMBAT.dodge.durationMs + 320;
  while (Date.now() < recoveryDeadline
    && (!suppressedDodge || !suppressorDodgeRecovery || !originalRecovery)) {
    const [defenderAcceptance, suppressorActions] = await Promise.all([
      readAcceptance(defender),
      readOwnActions(suppressor),
    ]);
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
    if (!suppressedDodge || !suppressorDodgeRecovery || !originalRecovery) await sleep(2);
  }

  await setMovementKey(opener, openerMovementKey, false);

  if (!suppressedDodge || !suppressorDodgeRecovery || !originalRecovery) {
    throw new Error(milestone + " did not observe suppression roll plus original recovery: "
      + JSON.stringify(await Promise.all(entries.map(readUiEvidence))));
  }

  const originalDurationObserved = originalRecovery.epochMs - firstKnockdown.epochMs;
  const recoveryAfterSuppressedDodge = originalRecovery.epochMs - suppressedDodge.epochMs;
  if (suppressedDodge.epochMs <= firstKnockdown.epochMs
    || suppressedDodge.epochMs >= firstKnockdown.epochMs + COMBAT.dodge.collisionKnockdownMs
    || originalDurationObserved < COMBAT.dodge.collisionKnockdownMs - 90
    || originalDurationObserved > COMBAT.dodge.collisionKnockdownMs + 110
    || recoveryAfterSuppressedDodge >= COMBAT.dodge.collisionKnockdownMs - 60
    || originalRecovery.epochMs >= suppressorDodgeRecovery.epochMs) {
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
    || suppressorWheels[0].epochMs >= firstKnockdown.epochMs + COMBAT.dodge.collisionKnockdownMs) {
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
  while (Date.now() < firstDeadline && !firstKnockdown) {
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
    const activeIndex = actions.findIndex((entry) =>
      entry.action === COMBAT_ACTION.kickActive
      && Number.isFinite(entry.epochMs)
      && entry.epochMs === suppressedKickActive.epochMs);
    suppressorIdle = actions.find((entry, index) =>
      index > activeIndex
      && entry.action === COMBAT_ACTION.idle
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
  return evidence;
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
  // This whiff-only gate does not couple defender timing to E key-up, so it can
  // keep the genuine key depressed longer than block/parry/dodge gates. The
  // longer hold gives headless Firefox multiple input frames to sample it.
  const heavyWhiffPulseMs = 240;

  // Stage inside punish range, then deliberately face the heavy away from
  // the defender. This creates a deterministic directional whiff without making
  // the acceptance depend on sub-frame distance thresholds.
  await aimArena(attacker, attackerElementId, whiffOffset);
  await sleep(40);

  // A genuine WebDriver E edge can occasionally miss the client's one-shot
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

    await pulseMovementKey(attacker, "e", heavyWhiffPulseMs);
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

  assertHeavyControlDelivered(attackerResult, movementCode, "M109 heavy whiff punish");
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
    let attackHeld = false;

    // Anchor ordering on completed real W3C input edges instead of cross-driver
    // promise timing. KeyS is held first as redundant provenance, Firefox LMB is
    // then delivered and acknowledged, and one normal input tick later Chrome
    // sends a short wheel-only command while KeyS remains down. Keeping the wheel
    // out of a multi-device action avoids W3C tick alignment delaying it.
    try {
      await aimArena(defender, defenderElementId, 0, 180);
      defenderMovementHeld = true;
      await setMovementKey(defender, "s", true);

      attackHeld = true;
      await setArenaAttack(attacker, attackerElementId, true, attackOffset);
      const attackPressedAt = Date.now();

      await sleep(20);
      await scrollArenaWheel(defender, defenderElementId, -120);
      rollIssued = true;

      await sleep(60);
      defenderMovementHeld = false;
      await setMovementKey(defender, "s", false);

      const remainingAttackHoldMs = Math.max(0, 180 - (Date.now() - attackPressedAt));
      if (remainingAttackHoldMs > 0) await sleep(remainingAttackHoldMs);
    } finally {
      if (attackHeld) await setArenaAttack(attacker, attackerElementId, false, attackOffset);
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
  const movementDelivered = attackerResult.keys.includes(`keydown:${movementCode}`) && attackerResult.keys.includes(`keyup:${movementCode}`);
  const aimDelivered = attackDown && Math.abs(attackDown.y - 0.5) <= 0.15 && (attackRight ? attackDown.x >= 0.6 : attackDown.x <= 0.4);
  if (!movementDelivered || !aimDelivered) throw new Error(`M36 real attacker movement/aim was not delivered: ${JSON.stringify(attackerResult)}`);
  const rollWheel = defenderResult.wheels.find((event) => event.deltaY < 0);
  if (!defenderResult.keys.includes("keydown:KeyS") || !defenderResult.keys.includes("keyup:KeyS") || !rollWheel) throw new Error(`M36 real pointer-directed wheel-roll controls were not delivered: ${JSON.stringify(defenderResult)}`);
  if (attackerResult.playerHp !== 100 || attackerResult.playerGuard !== 100 || defenderResult.playerHp !== 100 || defenderResult.playerGuard !== 100) throw new Error(`M36 dodge exchange changed authoritative vitals: ${JSON.stringify(evidence)}`);
  if (attackerResult.feedbackTransitions.includes("parried") || defenderResult.feedbackTransitions.includes("parry-success")) throw new Error(`M36 dodge exchange accidentally resolved as parry: ${JSON.stringify(evidence)}`);
  return evidence;
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
  await Promise.all(entries.map(centerArenaInViewport));
  await aimArena(defender, defenderElementId, attackRight ? -200 : 200);
  let evidence = null;
  let lastAttemptBaseline = null;
  for (let attempt = 0; attempt < 4 && !evidence; attempt += 1) {
    await pulseMovementKey(attacker, movementKey, attempt === 0 ? 120 : 80);
    lastAttemptBaseline = await Promise.all(entries.map(readUiEvidence));
    let attackHeld = false;
    let blockHeld = false;
    try {
      attackHeld = true;
      await setArenaAttack(attacker, attackerElementId, true, attackOffset);
      await sleep(70);
      blockHeld = true;
      await setArenaBlock(defender, defenderElementId, true);
      await sleep(190);
      evidence = await waitForUiParryEvidence(entries, attacker, defender, 320, false, lastAttemptBaseline);
    } finally {
      if (attackHeld) await setArenaAttack(attacker, attackerElementId, false, attackOffset);
      if (blockHeld) await setArenaBlock(defender, defenderElementId, false);
    }
    if (!evidence) await sleep(260);
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

  // Pull #3 inward so Firefox has a stable ordinary nearest rival that should
  // be overridden only by a real parry stun on #1.
  await pulseMovementKey(closerIdle, "a", 300);
  await sleep(80);
  let baseline = await Promise.all(entries.map(readUiEvidence));
  let defenderBefore = baseline.find((entry) => entry.browser === defender.name);
  for (let attempt = 0; attempt < 4 && defenderBefore?.focusLabel !== `NEAREST #${closerId}`; attempt += 1) {
    await pulseMovementKey(closerIdle, "a", 70);
    await sleep(60);
    baseline = await Promise.all(entries.map(readUiEvidence));
    defenderBefore = baseline.find((entry) => entry.browser === defender.name);
  }
  if (defenderBefore?.focusLabel !== `NEAREST #${closerId}`) {
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
  await pulseMovementKey(attacker, movementKey, 120);
  await sleep(60);
  let staged = await Promise.all(entries.map(readUiEvidence));
  let stagedDefender = staged.find((entry) => entry.browser === defender.name);
  for (let attempt = 0; attempt < 3 && stagedDefender?.focusLabel !== `NEAREST #${closerId}`; attempt += 1) {
    await pulseMovementKey(closerIdle, "a", 70);
    await sleep(50);
    staged = await Promise.all(entries.map(readUiEvidence));
    stagedDefender = staged.find((entry) => entry.browser === defender.name);
  }
  if (stagedDefender?.focusLabel !== `NEAREST #${closerId}`) {
    throw new Error(`${milestone} could not preserve #${closerId} as nearer idle rival before parry: ${JSON.stringify(staged)}`);
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

  let attackHeld = false;
  let blockHeld = false;
  let parryEvidence = null;
  try {
    attackHeld = true;
    await setArenaAttack(attacker, attackerElementId, true, attackOffset);
    await sleep(70);
    blockHeld = true;
    await setArenaBlock(defender, defenderElementId, true);
    await sleep(190);
    parryEvidence = await waitForUiParryEvidence(entries, attacker, defender, 520, true, staged);
  } finally {
    if (attackHeld) await setArenaAttack(attacker, attackerElementId, false, attackOffset);
    if (blockHeld) await setArenaBlock(defender, defenderElementId, false);
  }

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
  const attackDown = attackPointers.find((entry) => entry.type === "pointerdown" && entry.button === 0);
  const blockWheel = defenderState.wheels.slice(defenderWheelOffset).find((entry) => entry.deltaY > 0);
  const attackAimValid = attackDown
    && Math.abs(attackDown.y - 0.5) <= 0.15
    && (attackRight ? attackDown.x >= 0.6 : attackDown.x <= 0.4);
  if (!attackerState.keys.includes(`keydown:${movementCode}`)
    || !attackerState.keys.includes(`keyup:${movementCode}`)
    || !attackAimValid || !blockWheel) {
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

  return evidence.map((entry) => ({
    ...entry,
    m146ParryStunEpochMs: entry.browser === attacker.name ? stunTransition.epochMs : null,
    m146PunishEpochMs: entry.browser === defender.name ? punishDown.epochMs : null,
    m146PunishDelayMs: entry.browser === defender.name ? punishDelayMs : null,
  }));
}

async function runOnlineUiParryTellFlight(entries) {
  const observer = entries.find((entry) => entry.name === "firefox");
  const parriedLocal = entries.find((entry) => entry.name === "chrome");
  if (!observer || !parriedLocal) throw new Error("M41 could not resolve Firefox observer / Chrome parried fighter");

  await Promise.all([
    armParryTellSampler(observer),
    armParryTellSampler(parriedLocal),
  ]);
  let evidence;
  let tell;
  try {
    evidence = await runOnlineUiParryFlight(entries);
    const [observerMax, localMax] = await Promise.all([
      readParryTellSampler(observer),
      readParryTellSampler(parriedLocal),
    ]);
    if (observerMax < 24) {
      throw new Error(`M41 remote parry-stun tell never appeared: observer=${observerMax} local=${localMax}`);
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

  let tell;
  await setArenaBlock(defender, defenderElementId, true);
  try {
    tell = await waitForRemoteBlockFacingTell(observer, defender, 900);
  } finally {
    await setArenaBlock(defender, defenderElementId, false);
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

async function runOnlineUiHeavyGuardBreakFlight(entries, { returnTiming = false } = {}) {
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
    // Start genuine E and schedule two genuine wheel-back pulses inside one
    // browser-owned action sequence. The first lands at 70 ms and the second at
    // 170 ms. Their unchanged 240 ms short-block windows overlap by 140 ms, so
    // scheduler jitter cannot create a false fresh Block/parry edge before the
    // ~320 ms heavy impact.
    const heavyPulse = pulseMovementKey(attacker, "e", heavyKeyPulseMs);
    const blockPulse = scrollArenaWheelPair(defender, defenderElementId, 120, 70, 100);
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

    // First evidence is sampled around 390 ms after E; finish the unchanged
    // 840 ms heavy commitment before the second genuine heavy request.
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
        secondHeavyIssuedAt = attemptIssuedAt;
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
        break;
      }
      await sleep(20);
    }
  } finally {
    if (blockHeld) await setArenaBlock(defender, defenderElementId, false);
  }

  const evidence = await Promise.all(entries.map(readUiEvidence));
  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) {
    throw new Error(`M110 heavy guard break incomplete final evidence: ${JSON.stringify(evidence)}`);
  }
  assertHeavyControlDelivered(attackerResult, movementCode, "M110 heavy guard break");
  const heavyDowns = attackerResult.keys.filter((entry) => entry === "keydown:KeyE").length;
  const authoritativeCommits = heavyCommitCount(attackerResult);
  const blockWheels = defenderResult.wheels.filter((event) => event.deltaY > 0);
  if (heavyDowns < 2 || authoritativeCommits !== 2 || blockWheels.length < 2) {
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
  const guardBreakResult = await runOnlineUiHeavyGuardBreakFlight(entries, { returnTiming: true });
  const { evidence: guardBreakEvidence, secondHeavyIssuedAt } = guardBreakResult;
  const attacker = entries.find((entry) => entry.name === "chrome");
  const defender = entries.find((entry) => entry.name === "firefox");
  if (!attacker || !defender) throw new Error("M111 could not resolve fixed heavy guard-break roles");

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

  // Time genuine clicks from the accepted second-heavy request rather than from
  // a remote recovery snapshot. Authoritative input ingress and browser scheduling
  // can shift the actual Idle boundary relative to the local issuance timestamp,
  // so sample a bounded ~300 ms window around the unchanged 840 ms commitment.
  // Only the first accepted click can start the light; subsequent clicks occur
  // during its own commitment and are ignored. Exact-one-hit validation below
  // remains fail-closed.
  const elapsedSinceHeavyIssue = Date.now() - secondHeavyIssuedAt;
  const firstClickTargetMs = 800;
  const initialPauseMs = Math.max(0, firstClickTargetMs - elapsedSinceHeavyIssue);
  // The in-page observer timestamps both event-text and overlay mutations. That
  // provides stronger ordering evidence than repeated WebDriver reads and does
  // not perturb Firefox while the real Chrome action sequence is executing.
  await performArenaAttackBurst(attacker, 9, initialPauseMs, 20);

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
    throw new Error(`M111 attacker never confirmed exactly one real 34 HP light punish: ${JSON.stringify(await readUiEvidence(attacker))}`);
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
    const hitDeadline = Date.now() + 320;
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
    const punishActions = attackerState.acceptance?.ownActionTransitions ?? [];
    const punishWindup = punishActions.find((entry) =>
      entry.action === COMBAT_ACTION.attackWindup
      && Number.isFinite(entry.epochMs)
      && entry.epochMs >= punishDown.epochMs - 40);
    const punishActive = punishWindup
      ? punishActions.find((entry) =>
        entry.action === COMBAT_ACTION.attackActive
        && Number.isFinite(entry.epochMs)
        && entry.epochMs >= punishWindup.epochMs)
      : null;
    const guardBreakStunEndEpochMs = guardBreakStunTransition.epochMs + COMBAT.block.guardBreakStunMs;
    if (punishDowns.length !== 1 || punishUps.length !== 1 || !punishAimValid
      || !Number.isFinite(punishDown?.epochMs)
      || punishDown.epochMs < guardBreakStunTransition.epochMs
      || punishDown.epochMs >= guardBreakStunTransition.epochMs + COMBAT.block.guardBreakStunMs
      || punishDown.epochMs < recoveryBufferOpenEpochMs
      || punishDown.epochMs > recoveryExitEpochMs + 25
      || !punishWindup
      || !punishActive
      || punishActive.epochMs >= guardBreakStunEndEpochMs) {
      throw new Error(milestone + " genuine punish input/active phase missed the authoritative recovery/stun window: "
        + JSON.stringify({
          punishPointers,
          guardBreakStunTransition,
          guardBreakRecovery,
          recoveryBufferOpenEpochMs,
          recoveryExitEpochMs,
          guardBreakStunEndEpochMs,
          punishWindup,
          punishActive,
        }));
    }
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
    let guardBroken = false;
    for (let attempt = 0; attempt < 4 && !guardBroken; attempt += 1) {
      // Two wheel-back pulses keep the short directional block continuous long
      // enough to cover a light impact while aging beyond the parry window.
      await setArenaBlock(defender, defenderElementId, true);
      await sleep(150);
      await setArenaBlock(defender, defenderElementId, true);
      // Primary attack is a one-shot pointerdown latch cleared after an outbound
      // input sample. Use the same bounded genuine-click burst as M55 so each
      // intended guard-pressure strike survives client/network sampling jitter.
      // The burst completes inside one 135 ms windup; the 530 ms total spacing
      // below still keeps accepted strikes in separate combat cycles.
      await performArenaAttackBurst(attacker);
      await sleep(230);
      const states = await Promise.all(entries.map(readUiEvidence));
      const defenderState = states.find((entry) => entry.browser === defender.name);
      guardBroken = defenderState?.playerGuard === 0;
      if (guardBroken && onGuardBroken) {
        await onGuardBroken({
          states,
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
    // Send a short burst of genuine clicks to both already-aimed Chrome attackers.
    // The burst finishes inside one unchanged 135 ms windup, so once an attack is
    // accepted, later pulses are ignored while the fighter is non-Idle.
    await Promise.all([
      performArenaAttackBurst(left),
      performArenaAttackBurst(right),
    ]);
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
          const inconsistentWindup = phaseEvents.some((event) =>
            event.state === "windup" && event.secondaryPhase !== "WINDUP");
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
  // These shorter pulses keep the two attackers >120 px apart and preserve
  // deterministic primary/secondary ordering by authoritative distance.
  const leftMovementMs = mode === "primary" ? 160 : 155;
  const rightMovementMs = mode === "primary" ? 120 : 250;
  await Promise.all([
    pulseMovementKey(left, "d", leftMovementMs),
    pulseMovementKey(right, "a", rightMovementMs),
  ]);
  await sleep(60);
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

  // Start the genuine jump chord first in both modes, then introduce the
  // right-side light about 20 ms later. This guarantees a broad shared windup
  // interval without depending on cross-browser Promise scheduling. Spatial
  // distance, not start order, remains the only thing that decides whether the
  // jump is primary or secondary in each M142 mode.
  const samplesPromise = sampleUiEvidenceWhileActive(entries, 280, 6);
  let jumpHeld = false;
  try {
    await pressArenaJumpAttackChord(left, leftArena, 200);
    jumpHeld = true;
    await sleep(20);
    await performArenaAttackBurst(right, 3, 0, 8);
    await sleep(16);
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
  // jump attack. It must whiff cleanly, yet its authoritative 290 ms recovery
  // must temporarily outrank the closer idle #3 in the HUD focus.
  await aimArena(jumpAttacker, jumpArena, -200);
  await sleep(40);
  await Promise.all([
    performArenaJumpAttackChord(jumpAttacker, jumpArena, -200, 90),
    sampleUiEvidenceWhileActive(entries, 720, 8),
  ]);

  let evidence = await Promise.all(entries.map(readUiEvidence));
  let jumpState = evidence.find((entry) => entry.browser === jumpAttacker.name);
  let observerState = evidence.find((entry) => entry.browser === observer.name);
  let closerState = evidence.find((entry) => entry.browser === closerIdle.name);
  if (!jumpState || !observerState || !closerState) {
    throw new Error(`${milestone} incomplete final evidence: ${JSON.stringify(evidence)}`);
  }

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
  await Promise.all([
    pulseMovementKey(jumpAttacker, "d", 210),
    pulseMovementKey(closerIdle, "a", 260),
  ]);
  await sleep(80);

  let baseline = await Promise.all(entries.map(readUiEvidence));
  let observerBefore = baseline.find((entry) => entry.browser === observer.name);
  for (let attempt = 0; attempt < 3 && observerBefore?.focusLabel !== `NEAREST #${closerId}`; attempt += 1) {
    await pulseMovementKey(closerIdle, "a", 45);
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

  const jumpKeyOffset = jumpBefore.keyTransitions.length;
  const jumpPointerOffset = jumpBefore.pointers.length;
  const observerPointerOffset = observerBefore.pointers.length;
  const observerFocusOffset = observerBefore.focusTransitions.length;
  const observerRecoveryOffset = observerBefore.recoveryTransitions.length;

  // Whiff the narrow jump attack away from Firefox. #1 stays close enough to be
  // hit by Firefox's normal light attack, while #3 remains closer on the right.
  await aimArena(jumpAttacker, jumpArena, -200);
  await sleep(40);
  await performArenaJumpAttackChord(jumpAttacker, jumpArena, -200, 90);

  let recoveryEvidence = null;
  let recoveryCue = null;
  const recoveryDeadline = Date.now() + 900;
  while (Date.now() < recoveryDeadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const jumpState = states.find((entry) => entry.browser === jumpAttacker.name);
    const observerState = states.find((entry) => entry.browser === observer.name);
    const closerState = states.find((entry) => entry.browser === closerIdle.name);
    const ownTransitions = jumpState?.acceptance?.ownActionTransitions ?? [];
    const recoveryIndex = ownTransitions.findIndex((entry) =>
      entry.action === COMBAT_ACTION.jumpAttackRecovery && Number.isFinite(entry.epochMs));
    const cue = observerState?.recoveryTransitions.slice(observerRecoveryOffset).find((entry) =>
      entry.visible
      && entry.state === "jump-attack-recovery"
      && entry.label === "PUNISH"
      && entry.detail === "Jump attack recovery");
    const pristine = jumpState?.playerHp === 100
      && observerState?.playerHp === 100
      && closerState?.playerHp === 100
      && jumpState?.playerGuard === 100
      && observerState?.playerGuard === 100
      && closerState?.playerGuard === 100;
    if (recoveryIndex >= 0
      && observerState?.focusLabel === `PUNISH TARGET #${jumpId}`
      && cue
      && pristine) {
      recoveryEvidence = states;
      recoveryCue = cue;
      break;
    }
    if (!pristine && Number.isFinite(jumpState?.playerHp)) {
      throw new Error(`${milestone} jump attack failed to whiff cleanly: ${JSON.stringify(states)}`);
    }
    await sleep(8);
  }
  if (!recoveryEvidence || !recoveryCue) {
    throw new Error(`${milestone} never exposed #${jumpId} as the actionable recovery target: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
  }

  // Act on the cue. Firefox aims left at #1 and commits one genuine LMB while
  // #1 is still in authoritative jump-attack recovery. Idle #3 remains closer
  // on the opposite side and must not take damage.
  await performArenaAttackHold(observer, observerArena, -200, 90);

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
    if (jumpState.playerHp === 66 && observerState.playerHp === 100 && closerState.playerHp === 100) {
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
    throw new Error(`${milestone} real Firefox light did not damage selected jump-recovery target #${jumpId}: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
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
  if (jumpState.acceptance?.scenario !== "uijumppunishffa"
    || observerState.acceptance?.scenario !== "uijumppunishffa"
    || closerState.acceptance?.scenario !== "uijumppunishffa"
    || recoveryIndex < 0 || idleIndex <= recoveryIndex
    || punishDown.epochMs < recovery.epochMs || punishDown.epochMs >= idle.epochMs) {
    throw new Error(`${milestone} Firefox did not commit its real light inside #${jumpId}'s authoritative recovery: ${JSON.stringify({
      punishDown,
      recovery,
      idle,
      lifecycle,
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
  const jumpInputDelayMs = spatial ? 100 : 90;
  let spatialSamples = [];
  if (spatial) await armRecoveryHandoffSampler(observer);
  await Promise.all([
    performArenaAttackHold(lightAttacker, lightArena, 200, 90),
    (async () => {
      await sleep(jumpInputDelayMs);
      await performArenaJumpAttackChord(jumpAttacker, jumpArena, -200, 90);
    })(),
    sampleUiEvidenceWhileActive(entries, 760, 8),
  ]);
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
    throw new Error(`${milestone} did not arbitrate nearest punishable -> remaining punishable -> nearest rival: ${JSON.stringify({
      focusTransitions,
      evidence,
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
  if (Number.isFinite(lightDowns[0]?.epochMs) && Number.isFinite(jumpAttackDowns[0]?.epochMs)) {
    const inputLeadMs = jumpAttackDowns[0].epochMs - lightDowns[0].epochMs;
    const minLeadMs = spatial ? 70 : 20;
    const maxLeadMs = spatial ? 150 : 120;
    if (inputLeadMs < minLeadMs || inputLeadMs > maxLeadMs) {
      throw new Error(`${milestone} did not preserve the intended light-before-jump overlap: ${JSON.stringify({ inputLeadMs, minLeadMs, maxLeadMs, lightDowns, jumpAttackDowns })}`);
    }
  }

  const jumpOwn = jumpState.acceptance?.ownActionTransitions ?? [];
  const lightOwn = lightState.acceptance?.ownActionTransitions ?? [];
  const jumpWindup = jumpOwn.findIndex((entry) => entry.action === COMBAT_ACTION.jumpAttackWindup);
  const jumpActive = jumpOwn.findIndex((entry, index) => index > jumpWindup && entry.action === COMBAT_ACTION.jumpAttackActive);
  const jumpRecovery = jumpOwn.findIndex((entry, index) => index > jumpActive && entry.action === COMBAT_ACTION.jumpAttackRecovery);
  const jumpIdle = jumpOwn.findIndex((entry, index) => index > jumpRecovery && entry.action === COMBAT_ACTION.idle);
  const lightWindup = lightOwn.findIndex((entry) => entry.action === COMBAT_ACTION.attackWindup);
  const lightActive = lightOwn.findIndex((entry, index) => index > lightWindup && entry.action === COMBAT_ACTION.attackActive);
  const lightRecovery = lightOwn.findIndex((entry, index) => index > lightActive && entry.action === COMBAT_ACTION.attackRecovery);
  const lightIdle = lightOwn.findIndex((entry, index) => index > lightRecovery && entry.action === COMBAT_ACTION.idle);
  if (jumpState.acceptance?.scenario !== expectedScenario
    || lightState.acceptance?.scenario !== expectedScenario
    || jumpWindup < 0 || jumpActive <= jumpWindup || jumpRecovery <= jumpActive || jumpIdle <= jumpRecovery
    || lightWindup < 0 || lightActive <= lightWindup || lightRecovery <= lightActive || lightIdle <= lightRecovery) {
    throw new Error(`${milestone} did not preserve both authoritative attack lifecycles: ${JSON.stringify({ jumpOwn, lightOwn })}`);
  }

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
  const heavyKeyOffset = heavyBefore.keyTransitions.length;
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
    pulseMovementKey(heavyAttacker, "e", heavyKeyPulseMs),
    (async () => {
      await sleep(100);
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

  const heavyKeys = heavyState.keyTransitions.slice(heavyKeyOffset);
  const heavyDown = heavyKeys.find((entry) => entry.type === "keydown" && entry.code === "KeyE");
  const heavyUp = heavyKeys.find((entry) => entry.type === "keyup" && entry.code === "KeyE");
  if (!heavyDown || !heavyUp) {
    throw new Error(`${milestone} lacked genuine KeyE heavy provenance from #${heavyId}: ${JSON.stringify(heavyKeys)}`);
  }

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
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [
      {
        type: "key",
        id: `keyboard-${session.name}`,
        actions: [
          { type: "keyDown", value: strafeKey },
          { type: "pause", duration: 0 },
          { type: "pause", duration: 0 },
          { type: "pause", duration: 0 },
          { type: "pause", duration: 0 },
          { type: "keyUp", value: strafeKey },
        ],
      },
      {
        type: "pointer",
        id: `mouse-${session.name}`,
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 },
          { type: "pause", duration: 30 },
          { type: "pointerDown", button: 0 },
          { type: "pause", duration: 40 },
          { type: "pointerUp", button: 0 },
          { type: "pause", duration: 150 },
        ],
      },
    ],
  });
}

async function performArenaRunningAttack(session, elementId, movementKey, xOffset = 200) {
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
    await sleep(80);
    lightHeld = true;
    await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
      actions: [{
        type: "pointer",
        id: attackPointerId,
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 },
          { type: "pointerDown", button: 0 },
          { type: "pause", duration: 90 },
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

async function performArenaFeint(session, elementId, xOffset = 200) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  // Keep LMB and wheel-back in one W3C action command so browser-internal
  // timing, not WebDriver round-trip latency, owns the unchanged 70 ms feint
  // window. Dispatch wheel-back in the same action tick as LMB-down: the first
  // sampled frame starts the light, and the still-live short Block feints it on
  // the next frame. Keep LMB held for 45 ms so the real attack edge spans
  // multiple browser/input frames before release.
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
            { type: "pause", duration: 45 },
            { type: "pointerUp", button: 0 },
          ],
        },
        {
          type: "wheel",
          id: `wheel-${session.name}`,
          actions: [
            { type: "pause", duration: 0 },
            { type: "scroll", x: 0, y: 0, deltaX: 0, deltaY: 120, duration: 0, origin },
            { type: "pause", duration: 45 },
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

async function performArenaAttackHold(session, elementId, xOffset = 200, holdMs = 180) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  const boundedHoldMs = Math.max(40, Math.min(500, Math.trunc(holdMs)));
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
    const epochEvidence = ['uirollbuffer', 'uijumpbuffer', 'uijumpattack', 'uijumpattackinputloss', 'uijumpattackpunish', 'uijumpattacktelegraph', 'uijumpffaprimary', 'uijumpffasecondary', 'uijumprecoveryffa', 'uijumppunishffa', 'uimultirecoveryffa', 'uimultirecoveryspatial', 'uimultirecoverypunish', 'uiparrypunishwindow', 'uiparrypunishffa', 'uiparrypunishffahit', 'uiguardbreakpunishffa', 'uiguardbreakpunishffahit', 'uikickknockdownffa', 'uikickknockdownffahit', 'uikickknockdownbounded', 'uirollknockdownbounded', 'uirollknockdownffahit', 'uimultiknockdownffa', 'uimultiknockdownffahit', 'uirollknockdownffa', 'uijumpattackblock', 'uijumpattackparry', 'uijumpattackdodge', 'uijumpattackbuffer', 'uikickbuffer'].includes(new URLSearchParams(location.search).get('scenario'));
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
          x: Number(((event.clientX - rect.left) / rect.width).toFixed(3)),
          y: Number(((event.clientY - rect.top) / rect.height).toFixed(3)),
          t: Number((performance.now() - state.startedAt).toFixed(1)),
        };
        if (epochEvidence) entry.epochMs = Date.now();
        state.pointers.push(entry);
      }, { capture: true });
    }
    arena.addEventListener('wheel', (event) => {
      const entry = {
        deltaY: event.deltaY,
        t: Number((performance.now() - state.startedAt).toFixed(1)),
      };
      if (epochEvidence) entry.epochMs = Date.now();
      state.wheels.push(entry);
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

async function waitForRemoteRecoveryTell(observer, localAttacker, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let observerMax = 0;
  let localMax = 0;
  while (Date.now() < deadline) {
    const [observerPixels, localPixels] = await Promise.all([
      sampleRecoveryTellPixels(observer),
      sampleRecoveryTellPixels(localAttacker),
    ]);
    observerMax = Math.max(observerMax, observerPixels);
    localMax = Math.max(localMax, localPixels);
    if (observerMax >= 24) {
      if (localMax !== 0) throw new Error(`M38 local attacker painted the remote-only recovery ring: ${localMax}`);
      return { observerMax, localMax };
    }
    await sleep(20);
  }
  throw new Error(`M38 remote recovery ring never appeared: observer=${observerMax} local=${localMax}`);
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
    if (prior?.timer) clearTimeout(prior.timer);
    const half = 180;
    const x = Math.max(0, Math.floor(arena.width / 2 - half));
    const y = Math.max(0, Math.floor(arena.height / 2 - half));
    const width = Math.min(half * 2, arena.width - x);
    const height = Math.min(half * 2, arena.height - y);
    const state = { active: true, timer: 0, maxPixels: 0 };
    const sample = () => {
      if (!state.active) return;
      const pixels = context.getImageData(x, y, width, height).data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (Math.abs(pixels[i] - 127) <= 2 && Math.abs(pixels[i + 1] - 207) <= 2 && Math.abs(pixels[i + 2] - 244) <= 2 && pixels[i + 3] >= 250) count += 1;
      }
      state.maxPixels = Math.max(state.maxPixels, count);
      state.timer = setTimeout(sample, 40);
    };
    window.__MYASO_M41_PARRY_SAMPLER__ = state;
    state.timer = setTimeout(sample, 20);
    return true;
  `);
}

async function readParryTellSampler(session) {
  return execute(session.base, session.sessionId, `return window.__MYASO_M41_PARRY_SAMPLER__?.maxPixels ?? 0;`);
}

async function stopParryTellSampler(session) {
  return execute(session.base, session.sessionId, `
    const state = window.__MYASO_M41_PARRY_SAMPLER__;
    if (!state) return 0;
    state.active = false;
    if (state.timer) clearTimeout(state.timer);
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
      acceptance: window.__MYASO_ACCEPTANCE_STATE__ ? {
        scenario: window.__MYASO_ACCEPTANCE_STATE__.scenario ?? '',
        playerNetId: Number(window.__MYASO_ACCEPTANCE_STATE__.playerNetId ?? 0),
        focusNetId: Number(window.__MYASO_ACCEPTANCE_STATE__.focusNetId ?? 0),
        serverTick: Number(window.__MYASO_ACCEPTANCE_STATE__.serverTick ?? 0),
        ownActionTransitions: (window.__MYASO_ACCEPTANCE_STATE__.ownActionTransitions ?? []).map((entry) => ({ ...entry })),
        focusActionTransitions: (window.__MYASO_ACCEPTANCE_STATE__.focusActionTransitions ?? []).map((entry) => ({ ...entry })),
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
  return response.value ?? response;
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
  if (filename.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}
