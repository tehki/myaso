import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

const root = process.cwd();
const durationMs = Number(process.env.MYASO_PVP_FLIGHT_DURATION_MS ?? 7000);
const scenario = process.env.MYASO_PVP_SCENARIO ?? "damage";
if (!new Set(["damage", "inputloss", "parry", "dodge", "block", "guardbreak", "backblock", "respawn", "ui", "uirespawn", "uifeedback", "uihittell", "uivitals", "uiidentity", "uiscore", "uimatch", "uirematch", "uiffa3", "uikillfeed", "uifocus", "uithreat", "uithreatbearing", "uimultithreat", "uisecondarythreat", "uisecondarybearing", "uisecondaryphase", "uiguardarc", "uisecondaryguardarc", "uithreatmarkers", "uiparry", "uistun", "uiguardbreak", "uidodge", "uirecovery", "uirecoverytell", "uiattackintent", "uiheavy", "uiheavyinputloss", "uiheavyblock", "uiheavyparry", "uiheavydodge", "uiheavypunish", "uiheavyguardbreak", "uiheavyguardbreakpunish", "uiguardbreaktell", "uiparrytell", "uiblockfacingtell", "uidodgetell", "uideathtell"]).has(scenario)) throw new Error(`unsupported MYASO_PVP_SCENARIO: ${scenario}`);
const staticPort = Number(process.env.MYASO_PVP_FLIGHT_HTTP_PORT ?? 4174);
const browsers = [
  {
    name: "chrome",
    port: 9515,
    executable: process.env.CHROMEWEBDRIVER ? path.join(process.env.CHROMEWEBDRIVER, "chromedriver") : "chromedriver",
    args: ["--port=9515"],
    capabilities: {
      browserName: "chrome",
      "goog:chromeOptions": { args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1280,720"] },
    },
  },
  {
    name: "firefox",
    port: 9516,
    executable: process.env.GECKOWEBDRIVER ? path.join(process.env.GECKOWEBDRIVER, "geckodriver") : "geckodriver",
    args: ["--host", "127.0.0.1", "--port", "9516"],
    capabilities: {
      browserName: "firefox",
      "moz:firefoxOptions": { args: ["-headless"] },
    },
  },
];
if (scenario === "uiffa3" || scenario === "uikillfeed" || scenario === "uifocus" || scenario === "uithreat" || scenario === "uithreatbearing" || scenario === "uimultithreat" || scenario === "uisecondarythreat" || scenario === "uisecondarybearing" || scenario === "uisecondaryphase" || scenario === "uiguardarc" || scenario === "uisecondaryguardarc" || scenario === "uithreatmarkers") {
  browsers.push({
    name: "chrome2",
    port: 9517,
    executable: process.env.CHROMEWEBDRIVER ? path.join(process.env.CHROMEWEBDRIVER, "chromedriver") : "chromedriver",
    args: ["--port=9517"],
    capabilities: {
      browserName: "chrome",
      "goog:chromeOptions": { args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1280,720"] },
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
  if (scenario === "uimultithreat" || scenario === "uisecondarythreat" || scenario === "uisecondarybearing" || scenario === "uisecondaryphase" || scenario === "uiguardarc" || scenario === "uisecondaryguardarc" || scenario === "uithreatmarkers") {
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
    const results = await runOnlineUiMultiThreatFlight(sessions, true, true, true, true, true, true);
    console.log(`M62_FFA_SPATIAL_THREAT_MARKERS ${JSON.stringify({ ok: true, results })}`);
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
        scenario === "inputloss" || scenario === "uiheavyinputloss" ? "1" : "0",
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
  if (scenario === "uiparry" || scenario === "uistun" || scenario === "uiguardbreak" || scenario === "uidodge" || scenario === "uiattackintent" || scenario === "uiheavy" || scenario === "uiheavyinputloss" || scenario === "uiheavyblock" || scenario === "uiheavyparry" || scenario === "uiheavydodge" || scenario === "uiheavypunish" || scenario === "uiheavyguardbreak" || scenario === "uiheavyguardbreakpunish" || scenario === "uiguardbreaktell" || scenario === "uiparrytell" || scenario === "uiblockfacingtell" || scenario === "uidodgetell") {
    await webdriver(base, "POST", `/session/${sessionId}/window/rect`, { x: 0, y: 0, width: 1280, height: 900 });
  }
  return { ...browser, child, base, sessionId };
}

async function navigate(session, gameUrl, certificateHash) {
  const page = scenario === "ui" || scenario === "uirespawn" || scenario === "uifeedback" || scenario === "uihittell" || scenario === "uivitals" || scenario === "uiidentity" || scenario === "uiscore" || scenario === "uimatch" || scenario === "uirematch" || scenario === "uiffa3" || scenario === "uikillfeed" || scenario === "uifocus" || scenario === "uithreat" || scenario === "uithreatbearing" || scenario === "uimultithreat" || scenario === "uisecondarythreat" || scenario === "uisecondarybearing" || scenario === "uisecondaryphase" || scenario === "uiguardarc" || scenario === "uisecondaryguardarc" || scenario === "uithreatmarkers" || scenario === "uiparry" || scenario === "uistun" || scenario === "uiguardbreak" || scenario === "uidodge" || scenario === "uirecovery" || scenario === "uirecoverytell" || scenario === "uiattackintent" || scenario === "uiheavy" || scenario === "uiheavyinputloss" || scenario === "uiheavyblock" || scenario === "uiheavyparry" || scenario === "uiheavydodge" || scenario === "uiheavypunish" || scenario === "uiheavyguardbreak" || scenario === "uiheavyguardbreakpunish" || scenario === "uiguardbreaktell" || scenario === "uiparrytell" || scenario === "uiblockfacingtell" || scenario === "uidodgetell" || scenario === "uideathtell" ? "index.html" : "pvp-flight.html";
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
  const closeTo = (actual, expected, tolerance = 8) => Math.abs(actual - expected) <= tolerance;
  if (!closeTo(attackerVitals.hpPixels, 84) || !closeTo(attackerVitals.guardPixels, 126)) {
    throw new Error(`M46 damaged remote vitals were not spatially rendered as 66/100: ${JSON.stringify(attackerVitals)}`);
  }
  if (!closeTo(defenderVitals.hpPixels, 126) || !closeTo(defenderVitals.guardPixels, 126)) {
    throw new Error(`M46 undamaged remote vitals were not spatially rendered as 100/100: ${JSON.stringify(defenderVitals)}`);
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
  const attacker = evidence.find((entry) => entry.feedbackTransitions.includes("hit-confirm"));
  let defender = evidence.find((entry) => entry.feedbackTransitions.includes("damage-taken"));
  if (!attacker || !defender || attacker.browser === defender.browser) {
    throw new Error(`M37 could not resolve attacker / defender: ${JSON.stringify(evidence)}`);
  }
  const defenderBrowser = defender.browser;
  const showedRecovery = defender.recoveryTransitions.some((entry) => entry.visible
    && entry.state === "attack-recovery" && entry.label === "PUNISH" && entry.detail === "Attack recovery");
  if (!showedRecovery) throw new Error(`M37 defender never rendered opponent attack recovery: ${JSON.stringify(defender.recoveryTransitions)}`);
  if (attacker.recoveryTransitions.some((entry) => entry.visible && entry.state === "attack-recovery")) {
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
  defender = evidence.find((entry) => entry.feedbackTransitions.includes("damage-taken"));
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

  await pulseMovementKey(attacker, "e", 40);
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
    let blockHeld = false;
    try {
      await setArenaBlock(defender, defenderElementId, true);
      blockHeld = true;
      // Start block well before the heavy edge so the 115 ms fresh-parry window
      // is expired by the 320 ms active transition. This must resolve as a normal
      // directional block, not a parry.
      await sleep(160);
      await pulseMovementKey(attacker, "e", 40);
      await sleep(500);
    } finally {
      if (blockHeld) await setArenaBlock(defender, defenderElementId, false);
    }
    await sleep(20);

    lastObserved = await Promise.all(entries.map(readUiEvidence));
    const attackerResult = lastObserved.find((entry) => entry.browser === attacker.name);
    const defenderResult = lastObserved.find((entry) => entry.browser === defender.name);
    if (!attackerResult || !defenderResult) {
      throw new Error(`M107 heavy block incomplete evidence on attempt ${attempt}: ${JSON.stringify(lastObserved)}`);
    }

    const resolvedBlock = attackerResult.playerHp === 100 && attackerResult.playerGuard === 100
      && attackerResult.opponentHp === 100 && attackerResult.opponentGuard === 36
      && defenderResult.playerHp === 100 && defenderResult.playerGuard === 36;
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
  const blockDown = defenderResult.pointers.find((event) => event.type === "pointerdown" && event.button === 2);
  const blockUp = defenderResult.pointers.find((event) => event.type === "pointerup" && event.button === 2);
  if (!blockDown || !blockUp) {
    throw new Error(`M107 heavy block real RMB control was not delivered: ${JSON.stringify(defenderResult)}`);
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
    await pulseMovementKey(attacker, "e", 40);
    // The heavy active transition starts at 320 ms. Arm block at roughly 245 ms
    // from the real E keydown, leaving about 75 ms of parry age at impact and
    // enough margin for moderate Chrome/Firefox delivery skew.
    await sleep(205);
    let blockHeld = false;
    try {
      await setArenaBlock(defender, defenderElementId, true);
      blockHeld = true;
      await sleep(180);
    } finally {
      if (blockHeld) await setArenaBlock(defender, defenderElementId, false);
    }
    await sleep(80);

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
  const blockDown = defenderResult.pointers.find((event) => event.type === "pointerdown" && event.button === 2);
  const blockUp = defenderResult.pointers.find((event) => event.type === "pointerup" && event.button === 2);
  if (!blockDown || !blockUp) {
    throw new Error(`M107 heavy parry real RMB control was not delivered: ${JSON.stringify(defenderResult)}`);
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
  // Match the already-stable M36 browser roles: Firefox attacks, Chrome dodges.
  const staged = await prepareHeavyCounterplayFlight(
    entries,
    "M107 heavy dodge",
    { attackerName: "firefox", defenderName: "chrome", movementMs: 260 },
  );
  const { attacker, defender, movementCode } = staged;

  // Submit both browser action sequences together. The defender's WebDriver
  // sequence carries its own pause, so cross-browser command latency cannot
  // accumulate after the real E pulse and push the 118 ms iframe past the
  // authoritative 320 ms heavy active transition.
  await Promise.all([
    pulseMovementKey(attacker, "e", 40),
    pressArenaPerpendicularDodgeAfterPause(defender, 225),
  ]);
  // Let active -> recovery resolve without evidence polling inside the iframe.
  await sleep(360);

  const evidence = await Promise.all(entries.map(readUiEvidence));
  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) {
    throw new Error(`M107 heavy dodge incomplete evidence: ${JSON.stringify(evidence)}`);
  }
  assertHeavyControlDelivered(attackerResult, movementCode, "M107 heavy dodge");
  if (!defenderResult.keys.includes("keydown:KeyS") || !defenderResult.keys.includes("keyup:KeyS")
    || !defenderResult.keys.includes("keydown:Space") || !defenderResult.keys.includes("keyup:Space")) {
    throw new Error(`M107 heavy dodge real Space/perpendicular controls were not delivered: ${JSON.stringify(defenderResult)}`);
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

    await pulseMovementKey(attacker, "e", 40);
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
  // Once the tell is visible, the short real close plus light windup still lands
  // inside the unchanged 420 ms heavy recovery.
  await pulseMovementKey(defender, punishMoveKey, 160);
  await sleep(20);
  await aimArena(defender, defenderElementId, punishOffset);
  await performArenaAttackBurst(defender, 2);
  await sleep(320);

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
  const punishDown = defenderResult.pointers.find((event) => event.type === "pointerdown" && event.button === 0);
  const punishUp = defenderResult.pointers.find((event) => event.type === "pointerup" && event.button === 0);
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
  // path. M36 uses a two-click Firefox burst to keep the genuine latch retry window narrow
  // inside one unchanged windup; the Chrome defender then performs a genuine perpendicular
  // dodge early enough for the unchanged iframe to span the possible active transition. Combat timing and acceptance thresholds
  // remain unchanged, and the older M36 gate no longer depends on the later threat HUD.
  for (let attempt = 1; attempt <= 3 && !evidence; attempt += 1) {
    lastAttemptBaseline = await Promise.all(entries.map(readUiEvidence));
    if (!lastAttemptBaseline.every((entry) => entry.playerHp === 100 && entry.playerGuard === 100)) {
      throw new Error(`M36 retry ${attempt} did not start from clean authoritative vitals: ${JSON.stringify(lastAttemptBaseline)}`);
    }

    await performArenaAttackBurst(attacker, 2);
    // M24 owns exact dodge reaction timing/geometry. The genuine attack burst finishes
    // inside one unchanged 135 ms windup. A short fixed pause after that bounded burst
    // places the real Chrome dodge iframe across the possible active transition without
    // making this older M36 feedback acceptance depend on the later M54 threat HUD.
    await sleep(35);
    await pressArenaPerpendicularDodgeAfterPause(defender, 0);
    // Keep the iframe/strike resolution window free of evidence polling.
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
      // Let both authoritative recovery windows settle, then approximately unwind the full
      // perpendicular Dodge displacement with ordinary opposite movement. A 145 ms Dodge at
      // 610 units/s can move about 88 units; 410 ms at the normal 215 units/s restores that
      // spacing closely enough that each retry starts inside the same authoritative threat geometry.
      await sleep(430);
      await pulseMovementKey(defender, "w", 410);
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
  if (!defenderResult.keys.includes("keydown:KeyS") || !defenderResult.keys.includes("keyup:KeyS") || !defenderResult.keys.includes("keydown:Space") || !defenderResult.keys.includes("keyup:Space")) throw new Error(`M36 real perpendicular dodge controls were not delivered: ${JSON.stringify(defenderResult)}`);
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
  const blockDown = defenderResult.pointers.find((event) => event.type === "pointerdown" && event.button === 2);
  const blockUp = defenderResult.pointers.find((event) => event.type === "pointerup" && event.button === 2);
  if (!attackerResult.keys.includes(`keydown:${movementCode}`) || !attackerResult.keys.includes(`keyup:${movementCode}`)) {
    throw new Error(`M33 real attacker movement control was not delivered: ${JSON.stringify(attackerResult)}`);
  }
  const attackAimValid = attackDown && Math.abs(attackDown.y - 0.5) <= 0.15 && (attackRight ? attackDown.x >= 0.6 : attackDown.x <= 0.4);
  if (!attackAimValid) throw new Error(`M33 real attacker aim was not delivered: ${JSON.stringify(attackerResult)}`);
  const blockAimValid = blockDown && Math.abs(blockDown.y - 0.5) <= 0.15 && (attackRight ? blockDown.x <= 0.4 : blockDown.x >= 0.6);
  if (!blockAimValid || !blockUp) throw new Error(`M33 real directional block input was not delivered: ${JSON.stringify(defenderResult)}`);
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
  const blockDown = defenderResult?.pointers.find((event) => event.type === "pointerdown" && event.button === 2);
  const blockUp = defenderResult?.pointers.find((event) => event.type === "pointerup" && event.button === 2);
  const aimedTowardObserver = blockDown && Math.abs(blockDown.y - 0.5) <= 0.15
    && (aimOffset < 0 ? blockDown.x <= 0.4 : blockDown.x >= 0.6);
  if (!aimedTowardObserver || !blockUp) throw new Error(`M42 real directional block input was not delivered: ${JSON.stringify(defenderResult)}`);
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
    && dodgerResult.keys.includes("keydown:Space") && dodgerResult.keys.includes("keyup:Space");
  if (!controlsDelivered) throw new Error(`M43 real dodge controls were not delivered: ${JSON.stringify(dodgerResult)}`);
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

  try {
    await setArenaBlock(defender, defenderElementId, true);
    blockHeld = true;
    // Expire the 115 ms parry-entry window before either 320 ms heavy impact.
    // Keeping Block held also intentionally suppresses guard regeneration, so
    // the real pressure sequence must read 100 -> 36 -> 0.
    await sleep(160);

    for (let attempt = 1; attempt <= 3 && !firstEvidence; attempt += 1) {
      const before = await Promise.all(entries.map(readUiEvidence));
      const beforeAttacker = before.find((entry) => entry.browser === attacker.name);
      if (!beforeAttacker) throw new Error(`M110 first heavy missing attacker baseline: ${JSON.stringify(before)}`);
      const commitsBefore = heavyCommitCount(beforeAttacker);

      await pulseMovementKey(attacker, "e", 40);
      await sleep(390);
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
      if (!beforeAttacker || !beforeDefender || beforeDefender.playerGuard !== 36) {
        throw new Error(`M110 held block did not preserve 36 guard before second heavy: ${JSON.stringify(before)}`);
      }
      const commitsBefore = heavyCommitCount(beforeAttacker);

      const attemptIssuedAt = Date.now();
      await pulseMovementKey(attacker, "e", 40);
      await sleep(390);
      const states = await Promise.all(entries.map(readUiEvidence));
      const attackerState = states.find((entry) => entry.browser === attacker.name);
      const defenderState = states.find((entry) => entry.browser === defender.name);
      if (!attackerState || !defenderState) {
        throw new Error(`M110 second heavy incomplete evidence on attempt ${attempt}: ${JSON.stringify(states)}`);
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
        && defenderState.playerHp === 100 && defenderState.playerGuard === 36
        && attackerState.opponentHp === 100 && attackerState.opponentGuard === 36
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
  const blockDown = defenderResult.pointers.find((event) => event.type === "pointerdown" && event.button === 2);
  const blockUp = defenderResult.pointers.find((event) => event.type === "pointerup" && event.button === 2);
  if (heavyDowns < 2 || authoritativeCommits !== 2 || !blockDown || !blockUp) {
    throw new Error(`M110 did not prove two real heavies into one held RMB block: ${JSON.stringify(evidence)}`);
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
  // a remote recovery snapshot. Downs are centered tightly around the unchanged
  // 840 ms heavy commitment boundary. The first may be ignored just before Idle;
  // the following downs cross that boundary without spending the 185 ms punish
  // margin on WebDriver/snapshot observation latency.
  const elapsedSinceHeavyIssue = Date.now() - secondHeavyIssuedAt;
  const firstClickTargetMs = 835;
  const initialPauseMs = Math.max(0, firstClickTargetMs - elapsedSinceHeavyIssue);
  // The in-page observer timestamps both event-text and overlay mutations. That
  // provides stronger ordering evidence than repeated WebDriver reads and does
  // not perturb Firefox while the real Chrome action sequence is executing.
  await performArenaAttackBurst(attacker, 3, initialPauseMs, 12);

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
    await setArenaBlock(defender, defenderElementId, true);
    blockHeld = true;
    await sleep(180);
    let guardBroken = false;
    for (let attempt = 0; attempt < 4 && !guardBroken; attempt += 1) {
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
  const blockDown = defenderResult.pointers.find((event) => event.type === "pointerdown" && event.button === 2);
  const blockUp = defenderResult.pointers.find((event) => event.type === "pointerup" && event.button === 2);
  const attacksAimed = attackDowns.length >= 3 && attackDowns.every((event) =>
    Math.abs(event.y - 0.5) <= 0.15 && (attackRight ? event.x >= 0.6 : event.x <= 0.4));
  if (!attacksAimed) {
    throw new Error(`M34 real repeated directional attacks were not delivered: ${JSON.stringify(attackerResult)}`);
  }
  const blockAimed = blockDown && blockUp && Math.abs(blockDown.y - 0.5) <= 0.15
    && (attackRight ? blockDown.x <= 0.4 : blockDown.x >= 0.6);
  if (!blockAimed) {
    throw new Error(`M34 real held directional block was not delivered: ${JSON.stringify(defenderResult)}`);
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

  await Promise.all(entries.map(installUiObserver));
  await waitForUiReady(entries);
  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const elementId = await resolveArenaElement(attacker, "M49");

  let matchEvidence = null;
  await pulseMovementKey(attacker, "a", 500);
  await pulseMovementKey(attacker, "d", 140);
  for (let attempt = 0; attempt < 8 && !matchEvidence; attempt += 1) {
    await performArenaAttack(attacker, elementId);
    matchEvidence = await waitForUiMatchEndEvidence(entries, attacker, defender, 850, false);
    if (!matchEvidence) await pulseMovementKey(attacker, "d", 40);
  }
  if (!matchEvidence) matchEvidence = await waitForUiMatchEndEvidence(entries, attacker, defender, 1400, true);

  await sleep(1500);
  const frozen = await Promise.all(entries.map(readUiEvidence));
  const winner = frozen.find((entry) => entry.browser === attacker.name);
  const loser = frozen.find((entry) => entry.browser === defender.name);
  if (!winner || !loser) throw new Error(`M49 incomplete frozen match evidence: ${JSON.stringify(frozen)}`);
  if (winner.scoreboardRows[0]?.kills !== 2 || loser.scoreboardRows[0]?.kills !== 2
    || winner.opponentHp !== 0 || loser.playerHp !== 0
    || winner.overlayTitle !== "VICTORY" || loser.overlayTitle !== "MATCH OVER") {
    throw new Error(`M49 authoritative match state did not remain frozen past respawn time: ${JSON.stringify(frozen)}`);
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
    await sleep(420);
    const states = await Promise.all(entries.map(readUiEvidence));
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
    await sleep(240);
    let states = await Promise.all(entries.map(readUiEvidence));
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
    if (!centerSample || centerSample.primaryMax < 8 || centerSample.secondaryMax < 8) {
      throw new Error(`M62 center observer never painted both spatial threat markers: ${JSON.stringify(samples)}`);
    }
    if (attackerSamples.some((entry) => entry.secondaryMax !== 0)) {
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

async function aimArena(session, elementId, xOffset) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "pointer",
      id: `mouse-${session.name}`,
      parameters: { pointerType: "mouse" },
      actions: [{ type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 }],
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

async function pressArenaPerpendicularDodgeAfterPause(session, delayMs) {
  const elementId = await resolveArenaElement(session, "wheel-roll");
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "key",
      id: `keyboard-${session.name}`,
      actions: [
        { type: "keyDown", value: "s" },
        { type: "pause", duration: delayMs + 45 },
        { type: "keyUp", value: "s" },
      ],
    }],
  });
  await scrollArenaWheel(session, elementId, -120, delayMs);
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
  const boundedClickCount = Math.max(1, Math.min(3, Math.trunc(clickCount)));
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

async function installUiObserver(session) {
  await execute(session.base, session.sessionId, `
    const target = document.querySelector('#event-text');
    const arena = document.querySelector('#arena');
    const arenaStage = document.querySelector('.arena-stage');
    const overlay = document.querySelector('#combat-overlay');
    const recovery = document.querySelector('#opponent-recovery');
    const threat = document.querySelector('#threat-cue');
    const threatCount = document.querySelector('#threat-count');
    const threatSecondary = document.querySelector('#threat-secondary');
    const threatSecondaryBearing = document.querySelector('#threat-secondary-bearing');
    const threatSecondaryPhase = document.querySelector('#threat-secondary-phase');
    const threatSecondaryGuardArc = document.querySelector('#threat-secondary-guard-arc');
    const threatBearing = document.querySelector('#threat-bearing');
    const threatGuardArc = document.querySelector('#threat-guard-arc');
    if (!target || !arena || !arenaStage || !overlay || !recovery || !threat || !threatCount || !threatSecondary || !threatSecondaryBearing || !threatSecondaryPhase || !threatSecondaryGuardArc || !threatBearing || !threatGuardArc) throw new Error('missing online UI flight target');
    const state = { events: [], eventTransitions: [], keys: [], pointers: [], wheels: [], overlayTransitions: [], feedbackTransitions: [], recoveryTransitions: [], threatTransitions: [], recoveryTellMaxPixels: 0, parryTellMaxPixels: 0, online: '', startedAt: performance.now() };
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
      if (!previous || Object.keys(entry).some((key) => previous[key] !== entry[key])) state.recoveryTransitions.push(entry);
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
      arena.addEventListener(type, (event) => state.keys.push(type + ':' + event.code), { capture: true });
    }
    for (const type of ['pointerdown', 'pointerup']) {
      arena.addEventListener(type, (event) => {
        const rect = arena.getBoundingClientRect();
        state.pointers.push({
          type,
          button: event.button,
          x: Number(((event.clientX - rect.left) / rect.width).toFixed(3)),
          y: Number(((event.clientY - rect.top) / rect.height).toFixed(3)),
          t: Number((performance.now() - state.startedAt).toFixed(1)),
        });
      }, { capture: true });
    }
    arena.addEventListener('wheel', (event) => {
      state.wheels.push({
        deltaY: event.deltaY,
        t: Number((performance.now() - state.startedAt).toFixed(1)),
      });
    }, { capture: true });
    record();
    recordOverlay();
    recordFeedback();
    recordRecovery();
    recordThreat();
    new MutationObserver(record).observe(target, { childList: true, subtree: true, characterData: true });
    new MutationObserver(recordOverlay).observe(overlay, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true, characterData: true });
    new MutationObserver(recordFeedback).observe(arenaStage, { attributes: true, attributeFilter: ['data-combat-feedback'] });
    new MutationObserver(recordRecovery).observe(recovery, { attributes: true, attributeFilter: ['hidden', 'data-state'], childList: true, subtree: true, characterData: true });
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

async function waitForUiMatchEndEvidence(entries, attacker, defender, timeoutMs, fail = true) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerState = states.find((entry) => entry.browser === attacker.name);
    const defenderState = states.find((entry) => entry.browser === defender.name);
    const winnerId = attackerState?.playerNetId ?? 0;
    const loserId = defenderState?.playerNetId ?? 0;
    const expectedDetail = `#${winnerId} wins · 2 KILLS`;
    const scoreReady = attackerState?.scoreboardRows?.length === 2 && defenderState?.scoreboardRows?.length === 2
      && attackerState.scoreboardRows[0]?.label === `#${winnerId}` && attackerState.scoreboardRows[0]?.kills === 2
      && attackerState.scoreboardRows[1]?.label === `#${loserId}` && attackerState.scoreboardRows[1]?.kills === 0
      && defenderState.scoreboardRows[0]?.label === `#${winnerId}` && defenderState.scoreboardRows[0]?.kills === 2
      && defenderState.scoreboardRows[1]?.label === `#${loserId}` && defenderState.scoreboardRows[1]?.kills === 0;
    const overlaysReady = attackerState?.overlayVisible && attackerState.overlayTitle === "VICTORY" && attackerState.overlayDetail === expectedDetail
      && defenderState?.overlayVisible && defenderState.overlayTitle === "MATCH OVER" && defenderState.overlayDetail === expectedDetail;
    const deathReady = attackerState?.opponentHp === 0 && defenderState?.playerHp === 0;
    if (winnerId && loserId && scoreReady && overlaysReady && deathReady) return states;
    await sleep(50);
  }
  if (!fail) return null;
  throw new Error(`real online UI never rendered authoritative match winner: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
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
    const state = window.__MYASO_M30_UI__ ?? { events: [], eventTransitions: [], keys: [], pointers: [], overlayTransitions: [], feedbackTransitions: [], recoveryTransitions: [], threatTransitions: [], recoveryTellMaxPixels: 0, parryTellMaxPixels: 0, online: '' };
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
      pointers: state.pointers.slice(),
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
      if (!result.defenderDodgeSeen || !result.dodgeOverlapSeen) {
        throw new Error(`${result.browser} did not observe an in-range authoritative dodge/attack overlap`);
      }
      if (result.minDefenderHp !== 100 || result.minDefenderGuard !== 100) {
        throw new Error(`${result.browser} defender paid HP/guard cost during dodge: ${JSON.stringify(result)}`);
      }
      if (result.defenderBlockSeen || result.attackerStunnedSeen) {
        throw new Error(`${result.browser} dodge scenario accidentally resolved as block/parry`);
      }
      if (!Number.isFinite(result.firstDodgeEvadeMs) || !Number.isFinite(result.dodgeOverlapDistance) || !Number.isFinite(result.dodgeOverlapArcDelta)) {
        throw new Error(`${result.browser} did not record verified dodge geometry/timing`);
      }
      if (result.dodgeOverlapDistance > 94 || result.dodgeOverlapArcDelta > Math.PI * 0.39) {
        throw new Error(`${result.browser} dodge overlap was outside authoritative hit geometry: ${JSON.stringify(result)}`);
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
