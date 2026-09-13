import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

const root = process.cwd();
const flightDurationMs = Number(process.env.MYASO_FLIGHT_DURATION_MS ?? 4000);
const stressEntities = Number(process.env.MYASO_FLIGHT_STRESS_ENTITIES ?? 128);
const staticPort = Number(process.env.MYASO_FLIGHT_HTTP_PORT ?? 4173);
const browsers = [
  {
    name: "chrome",
    port: 9515,
    executable: process.env.CHROMEWEBDRIVER ? path.join(process.env.CHROMEWEBDRIVER, "chromedriver") : "chromedriver",
    args: ["--port=9515"],
    capabilities: {
      browserName: "chrome",
      "goog:chromeOptions": {
        args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1280,720"],
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
      "moz:firefoxOptions": { args: ["-headless"] },
    },
  },
];

const children = new Set();
let staticServer;
let gameServer;

try {
  staticServer = await startStaticServer();
  const game = await startGameServer();
  gameServer = game.child;
  const results = [];
  for (const browser of browsers) {
    const result = await runBrowser(browser, game.url, game.certificateHash);
    assertFlightResult(browser.name, result);
    results.push({ browser: browser.name, ...result });
    console.log(`M7_BROWSER_FLIGHT ${JSON.stringify(results.at(-1))}`);
  }
  console.log(`M7_BROWSER_FLIGHT_SUMMARY ${JSON.stringify({ ok: true, results })}`);
} finally {
  for (const child of children) terminate(child);
  if (staticServer) await new Promise((resolve) => staticServer.close(resolve));
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
      let relative = decodeURIComponent(url.pathname);
      if (relative === "/") relative = "/web/flight.html";
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
  if (!listeningUrl || !certificateHash) throw new Error(`game server did not publish flight endpoint/hash: ${buffer}\n${stderr}`);
  return { child, url: listeningUrl, certificateHash };
}

async function runBrowser(browser, gameUrl, certificateHash) {
  const child = spawn(browser.executable, browser.args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  children.add(child);
  child.stdout?.on("data", (chunk) => process.stdout.write(`[${browser.name}-driver] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[${browser.name}-driver] ${chunk}`));
  const base = `http://127.0.0.1:${browser.port}`;
  await waitForDriver(base, child, browser.name);

  let sessionId;
  try {
    const created = await webdriver(base, "POST", "/session", {
      capabilities: { alwaysMatch: browser.capabilities },
    });
    sessionId = created.sessionId ?? created.value?.sessionId;
    if (!sessionId) throw new Error(`${browser.name} WebDriver did not return a session id: ${JSON.stringify(created)}`);

    const flightUrl = new URL(`http://127.0.0.1:${staticPort}/web/flight.html`);
    flightUrl.searchParams.set("server", gameUrl);
    flightUrl.searchParams.set("cert", certificateHash);
    flightUrl.searchParams.set("duration", String(flightDurationMs));
    flightUrl.searchParams.set("stress", String(stressEntities));
    await webdriver(base, "POST", `/session/${sessionId}/url`, { url: flightUrl.toString() });

    const deadline = Date.now() + flightDurationMs + 20000;
    while (Date.now() < deadline) {
      const value = await execute(base, sessionId,
        "return {result: window.__MYASO_FLIGHT_RESULT__ || null, error: window.__MYASO_FLIGHT_ERROR__ || null};");
      if (value?.error) throw new Error(`${browser.name} flight page: ${value.error}`);
      if (value?.result) return value.result;
      await sleep(200);
    }
    throw new Error(`${browser.name} flight timed out`);
  } finally {
    if (sessionId) {
      try { await webdriver(base, "DELETE", `/session/${sessionId}`); } catch {}
    }
    terminate(child);
    children.delete(child);
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

function assertFlightResult(browser, result) {
  if (!result?.ok) throw new Error(`${browser} flight did not complete authoritative state`);
  if (!result.webTransportAvailable) throw new Error(`${browser} does not expose WebTransport`);
  if (result.snapshots < 20) throw new Error(`${browser} received too few snapshots: ${result.snapshots}`);
  if (result.acknowledgements < 10) throw new Error(`${browser} received too few input acknowledgements: ${result.acknowledgements}`);
  if (result.sentInputs < 30) throw new Error(`${browser} sent too few inputs: ${result.sentInputs}`);
  if (result.frames < 60) throw new Error(`${browser} produced too few animation frames: ${result.frames}`);
  if (!Number.isFinite(result.frameMs?.p95) || result.frameMs.p95 >= 100) {
    throw new Error(`${browser} p95 frame interval is pathological: ${result.frameMs?.p95}`);
  }
  if (result.maxPredictionHistory > 64) throw new Error(`${browser} prediction history escaped its bound`);
  if (result.correctionPx?.max !== null && (!Number.isFinite(result.correctionPx.max) || result.correctionPx.max >= 512)) {
    throw new Error(`${browser} reconciliation correction escaped sanity bound: ${result.correctionPx.max}`);
  }
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
  if (filename.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}
