import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

const root = process.cwd();
const durationMs = Number(process.env.MYASO_PVP_FLIGHT_DURATION_MS ?? 7000);
const scenario = process.env.MYASO_PVP_SCENARIO ?? "damage";
if (!new Set(["damage", "parry", "dodge", "block", "guardbreak", "backblock", "respawn", "ui", "uirespawn", "uifeedback", "uiparry", "uistun", "uiguardbreak", "uidodge"]).has(scenario)) throw new Error(`unsupported MYASO_PVP_SCENARIO: ${scenario}`);
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

const children = new Set();
const sessions = [];
let staticServer;
let gameServer;

try {
  staticServer = await startStaticServer();
  const game = await startGameServer();
  gameServer = game.child;
  for (const browser of browsers) sessions.push(await startBrowser(browser));
  await Promise.all(sessions.map((entry) => navigate(entry, game.url, game.certificateHash)));
  if (scenario === "ui") {
    const results = await runOnlineUiFlight(sessions);
    console.log(`M30_ONLINE_UI_READABILITY ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uirespawn") {
    const results = await runOnlineUiRespawnFlight(sessions);
    console.log(`M31_ONLINE_UI_DEATH_RESPAWN ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uifeedback") {
    const results = await runOnlineUiFeedbackFlight(sessions);
    console.log(`M32_ONLINE_HIT_FEEDBACK ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiparry") {
    const results = await runOnlineUiParryFlight(sessions);
    console.log(`M33_ONLINE_PARRY_FEEDBACK ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uistun") {
    const results = await runOnlineUiStunOverlayFlight(sessions);
    console.log(`M35_ONLINE_STUN_OVERLAY ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uidodge") {
    const results = await runOnlineUiDodgeFeedbackFlight(sessions);
    console.log(`M36_ONLINE_DODGE_FEEDBACK ${JSON.stringify({ ok: true, results })}`);
  } else if (scenario === "uiguardbreak") {
    const results = await runOnlineUiGuardBreakFlight(sessions);
    console.log(`M34_ONLINE_GUARD_BREAK_FEEDBACK ${JSON.stringify({ ok: true, results })}`);
  } else {
    const results = await Promise.all(sessions.map(waitForResult));
    assertPairedResults(results);
    const label = scenario === "parry" ? "M23_PVP_PARRY" : scenario === "dodge" ? "M24_PVP_DODGE" : scenario === "block" ? "M25_PVP_BLOCK" : scenario === "guardbreak" ? "M26_PVP_GUARD_BREAK" : scenario === "backblock" ? "M27_PVP_DIRECTIONAL_BLOCK" : scenario === "respawn" ? "M28_PVP_RESPAWN" : "M22_PVP_BROWSER_COMBAT";
    console.log(`${label} ${JSON.stringify({ ok: true, results })}`);
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
    env: { ...process.env, MYASO_BIND: "127.0.0.1:0" },
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
  return { child, url: listeningUrl, certificateHash };
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
  if (scenario === "uiparry" || scenario === "uistun" || scenario === "uiguardbreak" || scenario === "uidodge") {
    await webdriver(base, "POST", `/session/${sessionId}/window/rect`, { x: 0, y: 0, width: 1280, height: 900 });
  }
  return { ...browser, child, base, sessionId };
}

async function navigate(session, gameUrl, certificateHash) {
  const page = scenario === "ui" || scenario === "uirespawn" || scenario === "uifeedback" || scenario === "uiparry" || scenario === "uistun" || scenario === "uiguardbreak" || scenario === "uidodge" ? "index.html" : "pvp-flight.html";
  const url = new URL(`http://127.0.0.1:${staticPort}/web/${page}`);
  url.searchParams.set("server", gameUrl);
  url.searchParams.set("cert", certificateHash);
  if (scenario !== "ui") {
    url.searchParams.set("duration", String(durationMs));
    url.searchParams.set("scenario", scenario);
  }
  await webdriver(session.base, "POST", `/session/${session.sessionId}/url`, { url: url.toString() });
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
  let movementHeld = false;
  try {
    await setMovementKey(attacker, "d", true);
    movementHeld = true;
    await sleep(120);
    for (let attempt = 0; attempt < 5 && !evidence; attempt += 1) {
      await performArenaAttack(attacker, elementId);
      evidence = await waitForUiCombatEvidence(entries, 700, false);
    }
    if (!evidence) evidence = await waitForUiCombatEvidence(entries, 1000, true);
  } finally {
    if (movementHeld) await setMovementKey(attacker, "d", false);
  }
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

async function runOnlineUiDodgeFeedbackFlight(entries) {
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const ordered = ready.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const attacker = entries.find((entry) => entry.name === ordered[0].browser);
  const defender = entries.find((entry) => entry.name === ordered[1].browser);
  if (!attacker || !defender) throw new Error(`could not resolve M36 UI roles from ${JSON.stringify(ready)}`);
  if (attacker.name !== "chrome" || defender.name !== "firefox") throw new Error(`M36 latency choreography requires Chrome attacker / Firefox defender: ${JSON.stringify(ready)}`);

  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const attackerElementId = await resolveArenaElement(attacker, "M36 attacker");
  await resolveArenaElement(defender, "M36 defender");
  await Promise.all(entries.map(centerArenaInViewport));
  await pulseMovementKey(attacker, "d", 120);

  const dodgeAction = pressArenaDodgeAfterPause(defender, 120);
  await sleep(60);
  await performArenaAttack(attacker, attackerElementId, 200);
  await dodgeAction;
  let evidence = await waitForUiDodgeEvidence(entries, attacker, defender, 1200);
  await sleep(80);
  evidence = await Promise.all(entries.map(readUiEvidence));

  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) throw new Error(`incomplete M36 UI evidence: ${JSON.stringify(evidence)}`);
  const attackDown = attackerResult.pointers.find((event) => event.type === "pointerdown" && event.button === 0);
  if (!attackDown || attackDown.x < 0.6 || Math.abs(attackDown.y - 0.5) > 0.15) throw new Error(`M36 real attacker aim was not delivered: ${JSON.stringify(attackerResult)}`);
  if (!defenderResult.keys.includes("keydown:Space") || !defenderResult.keys.includes("keyup:Space")) throw new Error(`M36 real dodge key was not delivered: ${JSON.stringify(defenderResult)}`);
  if (attackerResult.playerHp !== 100 || attackerResult.playerGuard !== 100 || defenderResult.playerHp !== 100 || defenderResult.playerGuard !== 100) throw new Error(`M36 dodge exchange changed authoritative vitals: ${JSON.stringify(evidence)}`);
  if (attackerResult.feedbackTransitions.includes("parried") || defenderResult.feedbackTransitions.includes("parry-success")) throw new Error(`M36 dodge exchange accidentally resolved as parry: ${JSON.stringify(evidence)}`);
  return evidence;
}

async function runOnlineUiParryFlight(entries) {
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const ordered = ready.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const attacker = entries.find((entry) => entry.name === ordered[0].browser);
  const defender = entries.find((entry) => entry.name === ordered[1].browser);
  if (!attacker || !defender) throw new Error(`could not resolve M33 UI roles from ${JSON.stringify(ready)}`);
  if (attacker.name !== "chrome" || defender.name !== "firefox") throw new Error(`M33 latency choreography requires Chrome attacker / Firefox defender: ${JSON.stringify(ready)}`);

  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const attackerElementId = await resolveArenaElement(attacker, "M33 attacker");
  const defenderElementId = await resolveArenaElement(defender, "M33 defender");

  await Promise.all(entries.map(centerArenaInViewport));
  await aimArena(defender, defenderElementId, -200);
  await pulseMovementKey(attacker, "d", 120);
  let evidence;
  let blockHeld = false;
  try {
    blockHeld = true;
    const blockAction = pressArenaBlockAfterPause(defender, 120);
    await sleep(60);
    await performArenaAttack(attacker, attackerElementId, 200);
    await blockAction;
    evidence = await waitForUiParryEvidence(entries, attacker, defender, 1000);
  } finally {
    if (blockHeld) await setArenaBlock(defender, defenderElementId, false);
  }

  await sleep(80);
  evidence = await Promise.all(entries.map(readUiEvidence));
  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) throw new Error(`incomplete M33 UI evidence: ${JSON.stringify(evidence)}`);
  const attackDown = attackerResult.pointers.find((event) => event.type === "pointerdown" && event.button === 0);
  const blockDown = defenderResult.pointers.find((event) => event.type === "pointerdown" && event.button === 2);
  const blockUp = defenderResult.pointers.find((event) => event.type === "pointerup" && event.button === 2);
  if (!attackerResult.keys.includes("keydown:KeyD") || !attackerResult.keys.includes("keyup:KeyD")) {
    throw new Error(`M33 real attacker movement control was not delivered: ${JSON.stringify(attackerResult)}`);
  }
  if (!attackDown || attackDown.x < 0.6 || Math.abs(attackDown.y - 0.5) > 0.15) {
    throw new Error(`M33 real attacker aim was not delivered: ${JSON.stringify(attackerResult)}`);
  }
  if (!blockDown || !blockUp || blockDown.x > 0.4 || Math.abs(blockDown.y - 0.5) > 0.15) {
    throw new Error(`M33 real directional block input was not delivered: ${JSON.stringify(defenderResult)}`);
  }
  return evidence;
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

async function runOnlineUiGuardBreakFlight(entries) {
  await Promise.all(entries.map(installUiObserver));
  const ready = await waitForUiReady(entries);
  const ordered = ready.slice().sort((a, b) => a.playerNetId - b.playerNetId);
  const attacker = entries.find((entry) => entry.name === ordered[0].browser);
  const defender = entries.find((entry) => entry.name === ordered[1].browser);
  if (!attacker || !defender) throw new Error(`could not resolve M34 UI roles from ${JSON.stringify(ready)}`);
  if (attacker.name !== "chrome" || defender.name !== "firefox") throw new Error(`M34 choreography requires Chrome attacker / Firefox defender: ${JSON.stringify(ready)}`);

  await Promise.all(entries.map((entry) => execute(entry.base, entry.sessionId, "document.querySelector('#arena').focus(); return document.activeElement?.id;")));
  const attackerElementId = await resolveArenaElement(attacker, "M34 attacker");
  const defenderElementId = await resolveArenaElement(defender, "M34 defender");
  await Promise.all(entries.map(centerArenaInViewport));
  await pulseMovementKey(attacker, "d", 120);
  await aimArena(defender, defenderElementId, -200);
  const attackAction = performGuardBreakAttackSeries(attacker, attackerElementId, 350);
  await sleep(30);
  const blockAction = holdArenaBlock(defender, 1800);
  await Promise.all([attackAction, blockAction]);
  let evidence = await waitForUiGuardBreakEvidence(entries, attacker, defender, 1200);
  await sleep(80);
  evidence = await Promise.all(entries.map(readUiEvidence));

  const attackerResult = evidence.find((entry) => entry.browser === attacker.name);
  const defenderResult = evidence.find((entry) => entry.browser === defender.name);
  if (!attackerResult || !defenderResult) throw new Error(`incomplete M34 UI evidence: ${JSON.stringify(evidence)}`);
  if (!attackerResult.keys.includes("keydown:KeyD") || !attackerResult.keys.includes("keyup:KeyD")) {
    throw new Error(`M34 real attacker movement control was not delivered: ${JSON.stringify(attackerResult)}`);
  }
  const attackDowns = attackerResult.pointers.filter((event) => event.type === "pointerdown" && event.button === 0);
  const blockDown = defenderResult.pointers.find((event) => event.type === "pointerdown" && event.button === 2);
  const blockUp = defenderResult.pointers.find((event) => event.type === "pointerup" && event.button === 2);
  if (attackDowns.length < 3 || attackDowns.some((event) => event.x < 0.6 || Math.abs(event.y - 0.5) > 0.15)) {
    throw new Error(`M34 real repeated rightward attacks were not delivered: ${JSON.stringify(attackerResult)}`);
  }
  if (!blockDown || !blockUp || blockDown.x > 0.4 || Math.abs(blockDown.y - 0.5) > 0.15) {
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

async function runOnlineUiRespawnFlight(entries) {
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

async function pressArenaDodgeAfterPause(session, delayMs) {
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "key",
      id: `keyboard-${session.name}`,
      actions: [
        { type: "pause", duration: delayMs },
        { type: "keyDown", value: "\uE00D" },
        { type: "pause", duration: 40 },
        { type: "keyUp", value: "\uE00D" },
      ],
    }],
  });
}

async function pressArenaBlockAfterPause(session, delayMs) {
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "pointer",
      id: `mouse-${session.name}`,
      parameters: { pointerType: "mouse" },
      actions: [
        { type: "pause", duration: delayMs },
        { type: "pointerDown", button: 2 },
        { type: "pause", duration: 20 },
        { type: "pointerUp", button: 2 },
        { type: "pause", duration: 20 },
        { type: "pointerDown", button: 2 },
      ],
    }],
  });
}

async function setArenaBlock(session, elementId, pressed) {
  const actions = [{ type: pressed ? "pointerDown" : "pointerUp", button: 2 }];
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

async function performGuardBreakAttackSeries(session, elementId, initialDelayMs) {
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "pointer",
      id: `mouse-${session.name}`,
      parameters: { pointerType: "mouse" },
      actions: [
        { type: "pause", duration: initialDelayMs },
        { type: "pointerMove", duration: 0, origin, x: 200, y: 0 },
        { type: "pointerDown", button: 0 }, { type: "pause", duration: 40 }, { type: "pointerUp", button: 0 },
        { type: "pause", duration: 460 },
        { type: "pointerDown", button: 0 }, { type: "pause", duration: 40 }, { type: "pointerUp", button: 0 },
        { type: "pause", duration: 460 },
        { type: "pointerDown", button: 0 }, { type: "pause", duration: 40 }, { type: "pointerUp", button: 0 },
      ],
    }],
  });
}

async function holdArenaBlock(session, durationMs) {
  await webdriver(session.base, "POST", `/session/${session.sessionId}/actions`, {
    actions: [{
      type: "pointer",
      id: `mouse-${session.name}`,
      parameters: { pointerType: "mouse" },
      actions: [
        { type: "pointerDown", button: 2 },
        { type: "pause", duration: durationMs },
        { type: "pointerUp", button: 2 },
      ],
    }],
  });
}

async function installUiObserver(session) {
  await execute(session.base, session.sessionId, `
    const target = document.querySelector('#event-text');
    const arena = document.querySelector('#arena');
    const arenaStage = document.querySelector('.arena-stage');
    const overlay = document.querySelector('#combat-overlay');
    if (!target || !arena || !arenaStage || !overlay) throw new Error('missing online UI flight target');
    const state = { events: [], keys: [], pointers: [], overlayTransitions: [], feedbackTransitions: [], online: '', startedAt: performance.now() };
    const record = () => {
      const text = target.textContent?.trim() ?? '';
      if (/^Online - player #\\d+ - server tick \\d+$/.test(text)) state.online = text;
      else if (text && state.events.at(-1) !== text) state.events.push(text);
    };
    const recordOverlay = () => {
      const entry = {
        visible: !overlay.hidden,
        title: document.querySelector('#combat-overlay-title')?.textContent?.trim() ?? '',
        detail: document.querySelector('#combat-overlay-detail')?.textContent?.trim() ?? '',
      };
      const previous = state.overlayTransitions.at(-1);
      if (!previous || previous.visible !== entry.visible || previous.title !== entry.title || previous.detail !== entry.detail) {
        state.overlayTransitions.push(entry);
      }
    };
    const recordFeedback = () => {
      const feedback = arenaStage.dataset.combatFeedback ?? '';
      if (feedback && state.feedbackTransitions.at(-1) !== feedback) state.feedbackTransitions.push(feedback);
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
    record();
    recordOverlay();
    recordFeedback();
    new MutationObserver(record).observe(target, { childList: true, subtree: true, characterData: true });
    new MutationObserver(recordOverlay).observe(overlay, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true, characterData: true });
    new MutationObserver(recordFeedback).observe(arenaStage, { attributes: true, attributeFilter: ['data-combat-feedback'] });
    window.__MYASO_M30_UI__ = state;
    return true;
  `);
}

async function waitForUiReady(entries) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    if (states.every((state) => state.playerNetId > 0 && state.playerHp === 100 && state.opponentHp === 100)) return states;
    await sleep(100);
  }
  throw new Error(`real online UI did not converge to two ready fighters: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
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

async function waitForUiDodgeEvidence(entries, attacker, defender, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerState = states.find((entry) => entry.browser === attacker.name);
    const defenderState = states.find((entry) => entry.browser === defender.name);
    const messagesReady = attackerState?.events.includes("Attack evaded - opponent dodged.")
      && defenderState?.events.includes("Dodge! Strike avoided.");
    const feedbackReady = attackerState?.feedbackTransitions.includes("dodge-evaded")
      && defenderState?.feedbackTransitions.includes("dodge-success");
    const vitalsClean = attackerState?.playerHp === 100 && attackerState?.playerGuard === 100
      && defenderState?.playerHp === 100 && defenderState?.playerGuard === 100;
    if (messagesReady && feedbackReady && vitalsClean) return states;
    await sleep(40);
  }
  throw new Error(`real online UI never rendered authoritative dodge feedback: ${JSON.stringify(await Promise.all(entries.map(readUiEvidence)))}`);
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

async function waitForUiParryEvidence(entries, attacker, defender, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const states = await Promise.all(entries.map(readUiEvidence));
    const attackerState = states.find((entry) => entry.browser === attacker.name);
    const defenderState = states.find((entry) => entry.browser === defender.name);
    const messagesReady = attackerState?.events.includes("Parried - your commitment was read.")
      && defenderState?.events.includes("Parry! Opponent stunned - punish now.");
    const feedbackReady = attackerState?.feedbackTransitions.includes("parried")
      && defenderState?.feedbackTransitions.includes("parry-success");
    const vitalsClean = attackerState?.playerHp === 100 && attackerState?.playerGuard === 100
      && defenderState?.playerHp === 100 && defenderState?.playerGuard === 100;
    if (messagesReady && feedbackReady && vitalsClean) return states;
    await sleep(40);
  }
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
    const state = window.__MYASO_M30_UI__ ?? { events: [], keys: [], pointers: [], overlayTransitions: [], feedbackTransitions: [], online: '' };
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
      overlayVisible: !document.querySelector('#combat-overlay')?.hidden,
      overlayTitle: document.querySelector('#combat-overlay-title')?.textContent?.trim() ?? '',
      overlayDetail: document.querySelector('#combat-overlay-detail')?.textContent?.trim() ?? '',
      overlayTransitions: (state.overlayTransitions ?? []).slice(),
      combatFeedback: document.querySelector('.arena-stage')?.dataset.combatFeedback ?? '',
      feedbackTransitions: (state.feedbackTransitions ?? []).slice(),
      events: state.events.slice(),
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
