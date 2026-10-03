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
if (!new Set(["damage", "inputloss", "parry", "dodge", "block", "guardbreak", "backblock", "respawn", "ui", "uirespawn", "uifeedback", "uihittell", "uivitals", "uiidentity", "uiscore", "uimatch", "uirematch", "uiffa3", "uikillfeed", "uifocus", "uithreat", "uithreatbearing", "uimultithreat", "uisecondarythreat", "uisecondarybearing", "uisecondaryphase", "uiguardarc", "uisecondaryguardarc", "uithreatmarkers", "uijumpffaprimary", "uijumpffasecondary", "uijumprecoveryffa", "uimultirecoveryffa", "uimultirecoveryspatial", "uiparry", "uistun", "uiguardbreak", "uidodge", "uirecovery", "uirecoverytell", "uiattackintent", "uiheavy", "uiheavyinputloss", "uiheavyblock", "uiheavyparry", "uiheavydodge", "uiheavypunish", "uiheavyguardbreak", "uiheavyguardbreakpunish", "uifeint", "uirunningattack", "uidirectionallight", "uirollbuffer", "uijumpbuffer", "uijumpattack", "uijumpattackinputloss", "uijumpattackpunish", "uijumpattacktelegraph", "uijumpattackblock", "uijumpattackparry", "uijumpattackdodge", "uijumpattackbuffer", "uikickbuffer", "uiguardbreaktell", "uiparrytell", "uiblockfacingtell", "uidodgetell", "uideathtell"]).has(scenario)) throw new Error(`unsupported MYASO_PVP_SCENARIO: ${scenario}`);
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
if (scenario === "uiffa3" || scenario === "uikillfeed" || scenario === "uifocus" || scenario === "uithreat" || scenario === "uithreatbearing" || scenario === "uimultithreat" || scenario === "uisecondarythreat" || scenario === "uisecondarybearing" || scenario === "uisecondaryphase" || scenario === "uiguardarc" || scenario === "uisecondaryguardarc" || scenario === "uithreatmarkers" || scenario === "uijumpffaprimary" || scenario === "uijumpffasecondary" || scenario === "uijumprecoveryffa" || scenario === "uimultirecoveryffa" || scenario === "uimultirecoveryspatial") {
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

const children = new Set();
const sessions = [];
let staticServer;
let gameServer;

try {
  staticServer = await startStaticServer();
  const game = await startGameServer();
  gameServer = game.child;
  for (const browser of browsers) sessions.push(await startBrowser(browser));
  if (scenario === "uimultithreat" || scenario === "uisecondarythreat" || scenario === "uisecondarybearing" || scenario === "uisecondaryphase" || scenario === "uiguardarc" || scenario === "uisecondaryguardarc" || scenario === "uithreatmarkers" || scenario === "uijumpffaprimary" || scenario === "uijumpffasecondary" || scenario === "uijumprecoveryffa" || scenario === "uimultirecoveryffa" || scenario === "uimultirecoveryspatial") {
    const expected = [
      ["chrome", 1],
      ["firefox", 2],
      ["chrome2", 3],
    ];
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
  } else if (scenario === "uimultirecoveryffa") {
    const results = await runOnlineUiMultiRecoveryFfaFocusFlight(sessions);
    console.log(`M144_MULTI_RECOVERY_FFA_FOCUS ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uimultirecoveryspatial") {
    const results = await runOnlineUiMultiRecoveryFfaFocusFlight(sessions, true);
    console.log(`M145_SPATIAL_RECOVERY_HANDOFF ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiparry") {
    const results = await runOnlineUiParryFlight(sessions);
    console.log(`M33_ONLINE_PARRY_FEEDBACK ${JSON.stringify({ ok: true, results })}`);
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
  if (scenario === "uiparry" || scenario === "uistun" || scenario === "uiguardbreak" || scenario === "uidodge" || scenario === "uiattackintent" || scenario === "uiheavy" || scenario === "uiheavyinputloss" || scenario === "uiheavyblock" || scenario === "uiheavyparry" || scenario === "uiheavydodge" || scenario === "uiheavypunish" || scenario === "uiheavyguardbreak" || scenario === "uiheavyguardbreakpunish" || scenario === "uifeint" || scenario === "uirunningattack" || scenario === "uidirectionallight" || scenario === "uirollbuffer" || scenario === "uijumpbuffer" || scenario === "uijumpattack" || scenario === "uijumpattackinputloss" || scenario === "uijumpattackpunish" || scenario === "uijumpattacktelegraph" || scenario === "uijumpffaprimary" || scenario === "uijumpffasecondary" || scenario === "uijumprecoveryffa" || scenario === "uimultirecoveryffa" || scenario === "uimultirecoveryspatial" || scenario === "uijumpattackblock" || scenario === "uijumpattackparry" || scenario === "uijumpattackdodge" || scenario === "uijumpattackbuffer" || scenario === "uikickbuffer" || scenario === "uiguardbreaktell" || scenario === "uiparrytell" || scenario === "uiblockfacingtell" || scenario === "uidodgetell") {
    await webdriver(base, "POST", `/session/${sessionId}/window/rect`, { x: 0, y: 0, width: 1280, height: 900 });
  }
  return { ...browser, child, base, sessionId };
}

async function navigate(session, gameUrl, certificateHash) {
  const page = scenario === "ui" || scenario === "uirespawn" || scenario === "uifeedback" || scenario === "uihittell" || scenario === "uivitals" || scenario === "uiidentity" || scenario === "uiscore" || scenario === "uimatch" || scenario === "uirematch" || scenario === "uiffa3" || scenario === "uikillfeed" || scenario === "uifocus" || scenario === "uithreat" || scenario === "uithreatbearing" || scenario === "uimultithreat" || scenario === "uisecondarythreat" || scenario === "uisecondarybearing" || scenario === "uisecondaryphase" || scenario === "uiguardarc" || scenario === "uisecondaryguardarc" || scenario === "uithreatmarkers" || scenario === "uijumpffaprimary" || scenario === "uijumpffasecondary" || scenario === "uijumprecoveryffa" || scenario === "uimultirecoveryffa" || scenario === "uimultirecoveryspatial" || scenario === "uiparry" || scenario === "uistun" || scenario === "uiguardbreak" || scenario === "uidodge" || scenario === "uirecovery" || scenario === "uirecoverytell" || scenario === "uiattackintent" || scenario === "uiheavy" || scenario === "uiheavyinputloss" || scenario === "uiheavyblock" || scenario === "uiheavyparry" || scenario === "uiheavydodge" || scenario === "uiheavypunish" || scenario === "uiheavyguardbreak" || scenario === "uiheavyguardbreakpunish" || scenario === "uifeint" || scenario === "uirunningattack" || scenario === "uidirectionallight" || scenario === "uirollbuffer" || scenario === "uijumpbuffer" || scenario === "uijumpattack" || scenario === "uijumpattackinputloss" || scenario === "uijumpattackpunish" || scenario === "uijumpattacktelegraph" || scenario === "uijumpattackblock" || scenario === "uijumpattackparry" || scenario === "uijumpattackdodge" || scenario === "uijumpattackbuffer" || scenario === "uikickbuffer" || scenario === "uiguardbreaktell" || scenario === "uiparrytell" || scenario === "uiblockfacingtell" || scenario === "uidodgetell" || scenario === "uideathtell" ? "index.html" : "pvp-flight.html";
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
    // Launch the attacker E edge and defender wheel-back from separate browser
    // sessions at the same time. The delayed wheel is therefore relative to the
    // same WebDriver dispatch boundary instead of a later UI/snapshot observation.
    // At 230 ms, the unchanged 240 ms short block covers the 320 ms heavy active
    // transition and its unchanged 125 ms opening parry window.
    await Promise.all([
      pulseMovementKey(attacker, "e", heavyKeyPulseMs),
      scrollArenaWheel(defender, defenderElementId, 120, 230),
    ]);
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
  await performArenaRecoveryBufferedRoll(attacker, attackerElementId);

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
  if (perpendicularAim.epochMs < attackRecovery.epochMs
    || rollWheel.epochMs < attackRecovery.epochMs
    || rollWheel.epochMs >= attackRecoveryExit.epochMs) {
    throw new Error(`M129 genuine wheel was not inside Firefox's authoritative attack-recovery interval: ${JSON.stringify({
      attackRecovery,
      attackRecoveryExit,
      perpendicularAim,
      rollWheel,
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
  const attackerName = defense === "dodge" ? "firefox" : "chrome";
  const defenderName = defense === "dodge" ? "chrome" : "firefox";
  const movementMs = 180;
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
  } else if (defense === "parry") {
    await Promise.all([
      performArenaJumpAttackChord(attacker, attackerElementId, attackOffset, 90),
      scrollArenaWheel(defender, defenderElementId, 120, 35),
    ]);
  } else if (defense === "dodge") {
    await Promise.all([
      performArenaJumpAttackChord(attacker, attackerElementId, attackOffset, 90),
      performArenaTimedPointerDodge(defender, defenderElementId, 60),
    ]);
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
    const ownKnockdownIndex = ownTransitions.findIndex((entry, index) =>
      index > ownWindupIndex && entry.action === COMBAT_ACTION.knockdown);
    const focusKnockdownIndex = focusTransitions.findIndex((entry, index) =>
      index > focusWindupIndex && entry.action === COMBAT_ACTION.knockdown);
    const rollCounter = defense === "dodge"
      && attackerResult.feedbackTransitions.includes("rolled-over")
      && defenderResult.feedbackTransitions.includes("roll-impact")
      && ownKnockdownIndex > ownWindupIndex
      && focusKnockdownIndex > focusWindupIndex;
    // A successful parry or roll collision can replace jump-attack-active before
    // it is replicated. The latter is an intended Wilds-style counter: the real
    // pointer roll reaches the attacker first and knocks the commitment down.
    const attackSeen = defense === "parry"
      ? windupSeen && ownStunnedIndex > ownWindupIndex && focusStunnedIndex > focusWindupIndex
      : defense === "dodge" && rollCounter
        ? windupSeen
        : windupSeen && activeSeen;
    const terminalReplicated = defense === "parry"
      ? ownStunnedIndex > ownWindupIndex && focusStunnedIndex > focusWindupIndex
      : defense === "dodge" && rollCounter
        ? ownKnockdownIndex > ownWindupIndex && focusKnockdownIndex > focusWindupIndex
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
  const ownKnockdownIndex = ownTransitions.findIndex((entry, index) =>
    index > ownWindupIndex && entry.action === COMBAT_ACTION.knockdown);
  const focusKnockdownIndex = focusTransitions.findIndex((entry, index) =>
    index > focusWindupIndex && entry.action === COMBAT_ACTION.knockdown);
  const rollCounter = defense === "dodge"
    && attackerResult.feedbackTransitions.includes("rolled-over")
    && defenderResult.feedbackTransitions.includes("roll-impact")
    && ownKnockdownIndex > ownWindupIndex
    && focusKnockdownIndex > focusWindupIndex;
  const ownPlainJumpIndex = ownTransitions.findIndex((entry) => entry.action === COMBAT_ACTION.jump);
  if (ownWindupIndex < 0 || focusWindupIndex < 0
    || (defense !== "parry" && !rollCounter
      && (ownActiveIndex <= ownWindupIndex || focusActiveIndex <= focusWindupIndex))
    || (ownPlainJumpIndex >= 0 && ownPlainJumpIndex < ownWindupIndex)) {
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
    if (ownKnockdownIndex <= ownWindupIndex || focusKnockdownIndex <= focusWindupIndex) {
      throw new Error(`${label} did not replicate jump-attack windup -> knockdown on roll counter: ${JSON.stringify({
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

async function runOnlineUiParryFlight(entries) {
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const attacker = entries.find((entry) => entry.name === "chrome");
  const defender = entries.find((entry) => entry.name === "firefox");
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

  await sleep(80);
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

async function runOnlineUiGuardBreakFlight(entries) {
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

  // Both attackers must remain inside their unchanged attack geometry, but the
  // chosen side is deliberately closer so simultaneous windups have a stable
  // deterministic primary/secondary ordering by authoritative distance.
  const leftMovementMs = mode === "primary" ? 260 : 210;
  const rightMovementMs = mode === "primary" ? 210 : 260;
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

  // Start the right light 35 ms after the jump chord begins. Jump windup is
  // only 105 ms, so the previous 80 ms delay left too little replicated overlap
  // under loaded headless scheduling. A 35 ms delay preserves a broad shared
  // windup interval while distance still deterministically decides whether the
  // jump or light attacker is primary in each mode.
  await Promise.all([
    performArenaJumpAttackChord(left, leftArena, 200, 90),
    performArenaAttackBurst(right, 3, 35, 8),
    sampleUiEvidenceWhileActive(entries, 260, 8),
  ]);

  let evidence = await Promise.all(entries.map(readUiEvidence));
  const leftId = ordered[0].playerNetId;
  const rightId = ordered[2].playerNetId;
  const expectedPrimaryId = mode === "primary" ? leftId : rightId;
  const expectedSecondaryId = mode === "primary" ? rightId : leftId;
  const expectedPrimaryPhase = mode === "primary" ? "JUMP WINDUP" : "WINDUP";
  const expectedSecondaryPhase = mode === "primary" ? "WINDUP" : "JUMP WINDUP";
  const expectedPrimaryBearing = mode === "primary" ? "FROM LEFT" : "FROM RIGHT";
  const expectedSecondaryBearing = mode === "primary" ? "FROM RIGHT" : "FROM LEFT";
  const expectedPrimaryGuardArc = mode === "primary" ? "FLANK" : "FRONT";
  const expectedSecondaryGuardArc = mode === "primary" ? "FRONT" : "FLANK";

  const findExpectedThreat = (state) => state?.threatTransitions.slice(centerThreatOffset).find((event) =>
    event.visible
    && event.count === "2 THREATS"
    && event.label === `#${expectedPrimaryId}`
    && event.phase === expectedPrimaryPhase
    && event.state === "windup"
    && event.secondary === `NEXT #${expectedSecondaryId}`
    && event.secondaryPhase === expectedSecondaryPhase
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
  // Its 255 ms recovery overlaps the jump attack's 290 ms recovery, then exits
  // first, leaving a short but real authoritative handoff window to #1.
  let spatialSamples = [];
  if (spatial) await armRecoveryHandoffSampler(observer);
  await Promise.all([
    performArenaAttackHold(lightAttacker, lightArena, 200, 90),
    (async () => {
      await sleep(45);
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
    if (inputLeadMs < 20 || inputLeadMs > 120) {
      throw new Error(`${milestone} did not preserve the intended light-before-jump overlap: ${JSON.stringify({ inputLeadMs, lightDowns, jumpAttackDowns })}`);
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

async function performArenaRecoveryBufferedRoll(session, elementId) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  // This command is issued only after Firefox has independently observed the
  // authoritative light recovery. Pointer retarget and the real wheel share one
  // W3C timeline; a short browser-owned pause keeps the real wheel inside
  // recovery even when newer Chrome/Firefox drivers add command overhead.
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [
      {
        type: "pointer",
        id: `mouse-${session.name}`,
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", duration: 0, origin, x: 0, y: 180 },
          { type: "pause", duration: 80 },
          { type: "pause", duration: 0 },
        ],
      },
      {
        type: "wheel",
        id: `wheel-${session.name}`,
        actions: [
          { type: "pause", duration: 0 },
          { type: "pause", duration: 80 },
          { type: "scroll", x: 0, y: 0, deltaX: 0, deltaY: -120, duration: 0, origin },
        ],
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
    const epochEvidence = ['uirollbuffer', 'uijumpbuffer', 'uijumpattack', 'uijumpattackinputloss', 'uijumpattackpunish', 'uijumpattacktelegraph', 'uijumpffaprimary', 'uijumpffasecondary', 'uijumprecoveryffa', 'uimultirecoveryffa', 'uimultirecoveryspatial', 'uijumpattackblock', 'uijumpattackparry', 'uijumpattackdodge', 'uijumpattackbuffer', 'uikickbuffer'].includes(new URLSearchParams(location.search).get('scenario'));
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
    if (prior?.frame) cancelAnimationFrame(prior.frame);
    const state = { active: true, frame: 0, samples: [], startedAt: performance.now() };
    const sample = () => {
      if (!state.active) return;
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
        focusLabel: focusLabel.textContent?.trim() ?? '',
        count,
        centroidX: count > 0 ? xSum / count : -1,
        canvasWidth: arena.width,
        t: Number((performance.now() - state.startedAt).toFixed(1)),
      });
      state.frame = requestAnimationFrame(sample);
    };
    window.__MYASO_M145_RECOVERY_SAMPLER__ = state;
    state.frame = requestAnimationFrame(sample);
    return true;
  `);
}

async function stopRecoveryHandoffSampler(session) {
  return execute(session.base, session.sessionId, `
    const state = window.__MYASO_M145_RECOVERY_SAMPLER__;
    if (!state) return [];
    state.active = false;
    if (state.frame) cancelAnimationFrame(state.frame);
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
