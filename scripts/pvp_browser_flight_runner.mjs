import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

const root = process.cwd();
const durationMs = Number(process.env.MYASO_PVP_FLIGHT_DURATION_MS ?? 7000);
const scenario = process.env.MYASO_PVP_SCENARIO ?? "damage";
if (!new Set(["damage", "parry", "dodge", "block"]).has(scenario)) throw new Error(`unsupported MYASO_PVP_SCENARIO: ${scenario}`);
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
  const results = await Promise.all(sessions.map(waitForResult));
  assertPairedResults(results);
  const label = scenario === "parry" ? "M23_PVP_PARRY" : scenario === "dodge" ? "M24_PVP_DODGE" : scenario === "block" ? "M25_PVP_BLOCK" : "M22_PVP_BROWSER_COMBAT";
  console.log(`${label} ${JSON.stringify({ ok: true, results })}`);
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
  return { ...browser, child, base, sessionId };
}

async function navigate(session, gameUrl, certificateHash) {
  const url = new URL(`http://127.0.0.1:${staticPort}/web/pvp-flight.html`);
  url.searchParams.set("server", gameUrl);
  url.searchParams.set("cert", certificateHash);
  url.searchParams.set("duration", String(durationMs));
  url.searchParams.set("scenario", scenario);
  await webdriver(session.base, "POST", `/session/${session.sessionId}/url`, { url: url.toString() });
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
