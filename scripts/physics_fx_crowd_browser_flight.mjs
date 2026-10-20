// P10 concurrent real WebTransport connections, always loopback and isolated.
// No playable arena, combat, spells, credentials or production endpoint.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const root = process.cwd();
const extendedWindowMs = process.env.P10_WINDOW_MS ?? "4200";
if (!/^\\d+$/.test(extendedWindowMs) || Number(extendedWindowMs) < 4200 || Number(extendedWindowMs) > 10500) throw new Error("P10_WINDOW_MS must be 4200..10500");
const children = new Set();
const files = new Map([
  ["/web/physics-fx-crowd-flight.html", "web/physics-fx-crowd-flight.html"],
  ["/src/browser/magic-effect-receiver.mjs", "src/browser/magic-effect-receiver.mjs"],
  ["/src/browser/magic-particle-pool.mjs", "src/browser/magic-particle-pool.mjs"],
]);
const browsers = [
  {
    name: "chrome", port: 19515, executable: process.env.CHROMEWEBDRIVER
      ? path.join(process.env.CHROMEWEBDRIVER, "chromedriver") : "chromedriver",
    args: ["--port=19515"],
    capabilities: {
      browserName: "chrome",
      "goog:chromeOptions": {
        args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1280,720"],
      },
    },
  },
  {
    name: "firefox", port: 19516, executable: process.env.GECKOWEBDRIVER
      ? path.join(process.env.GECKOWEBDRIVER, "geckodriver") : "geckodriver",
    args: ["--host", "127.0.0.1", "--port", "19516"],
    capabilities: {
      browserName: "firefox",
      "moz:firefoxOptions": { args: ["-headless"] },
    },
  },
];

let staticServer;
try {
  staticServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost/");
    const name = files.get(url.pathname);
    if (!name) {
      res.writeHead(404).end("P9 lab only");
      return;
    }
    try {
      const bytes = await readFile(path.join(root, name));
      res.writeHead(200, {
        "cache-control": "no-store",
        "content-type": name.endsWith(".html") ? "text/html; charset=utf-8"
          : "text/javascript; charset=utf-8",
      }).end(bytes);
    } catch (error) {
      res.writeHead(500).end(String(error));
    }
  });
  await new Promise((resolve, reject) => {
    staticServer.once("error", reject);
    staticServer.listen(0, "127.0.0.1", resolve);
  });
  const staticPort = staticServer.address().port;
  const results = [];
  for (const browser of browsers) {
    // New sidecar for each browser so that each scenario truly includes 16
    // simultaneously open connections against ONE shared hub/budget.
    const lab = await startLab();
    try {
      const result = await runBrowser(browser, lab, staticPort);
      if (!result.ok || result.realConcurrentSessions !== 16
          || result.minGameplayMarkers < 55 || result.minFxPackets < 12
          || result.minPingReplies < 5 || result.malformedFx !== 0) {
        throw new Error(`P10 ${browser.name} concurrent QUIC receipt failed: ${JSON.stringify(result)}`);
      }
      results.push({ browser: browser.name, ...result });
      console.log(`P10_REAL_CROWD_BROWSER ${JSON.stringify(results.at(-1))}`);
    } finally {
      terminate(lab.child);
    }
  }
  console.log(`P10_REAL_CROWD_SUMMARY ${JSON.stringify({ ok: true, results })}`);
} finally {
  for (const child of children) terminate(child);
  if (staticServer) await new Promise((resolve) => staticServer.close(resolve));
}

async function startLab() {
  const child = spawn("cargo", [
    "run", "--locked", "--manifest-path", "server/Cargo.toml",
    "--example", "magic_fx_crowd_loopback", "--quiet", "--", "16",
  ], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  children.add(child);
  let endpoint = null;
  let cert = null;
  let buffer = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (value) => { stderr += value; process.stderr.write(value); });
  child.stdout.on("data", (value) => {
    // Only test-sidecar output: accepted lab session diagnostics, no user data.
    process.stdout.write(`[p10-lab] ${value}`);
    buffer += value;
    for (const line of buffer.split(/\r?\n/)) {
      const e = line.match(/P10_LOOPBACK_LISTENING (https:\/\/127\.0\.0\.1:\d+\/physics-fx-crowd)/);
      if (e) endpoint = e[1];
      if (line.includes("P10_CERT_SHA256 ")) {
        const hex = line.split("P10_CERT_SHA256 ").at(-1).trim()
          .replace(/[^0-9a-fA-F]/g, "").toLowerCase();
        if (hex.length === 64) cert = hex;
      }
    }
  });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline && !(endpoint && cert)) {
    if (child.exitCode !== null) throw new Error(`P10 crowd lab stopped: ${child.exitCode}\n${stderr}`);
    await sleep(100);
  }
  if (!endpoint || !cert) throw new Error(`P10 crowd lab startup timed out: ${buffer}\n${stderr}`);
  return { endpoint, cert, child };
}

async function runBrowser(browser, lab, staticPort) {
  const child = spawn(browser.executable, browser.args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  children.add(child);
  child.stderr?.on("data", (value) => process.stderr.write(`[${browser.name}] ${value}`));
  const base = `http://127.0.0.1:${browser.port}`;
  await waitDriver(base, child, browser.name);

  let sessionId;
  try {
    const created = await webdriver(base, "POST", "/session", {
      capabilities: { alwaysMatch: browser.capabilities },
    });
    sessionId = created.sessionId ?? created.value?.sessionId;
    if (!sessionId) throw new Error(`P10 ${browser.name} WebDriver session was not created`);

    const page = new URL(`http://127.0.0.1:${staticPort}/web/physics-fx-crowd-flight.html`);
    page.searchParams.set("server", lab.endpoint);
    page.searchParams.set("cert", lab.cert);
    page.searchParams.set("sessions", "16");
    page.searchParams.set("windowMs", extendedWindowMs);
    await webdriver(base, "POST", `/session/${sessionId}/url`, { url: page.toString() });
    const deadline = Date.now() + 65000;
    let lastStage = "page-not-started";
    while (Date.now() < deadline) {
      const result = await webdriver(base, "POST", `/session/${sessionId}/execute/sync`, {
        script: "return {result:window.__P10_RESULT__||null,error:window.__P10_ERROR__||null,stage:window.__P10_STAGE__||null};",
        args: [],
      });
      const value = result.value ?? result;
      lastStage = value?.stage ?? lastStage;
      if (value.error) throw new Error(`P10 ${browser.name} page: ${value.error}`);
      if (value.result) return value.result;
      await sleep(175);
    }
    throw new Error(`P10 ${browser.name} concurrent QUIC datagram flight timed out (stage: ${lastStage})`);
  } finally {
    if (sessionId) {
      try { await webdriver(base, "DELETE", `/session/${sessionId}`); } catch {}
    }
    terminate(child);
    children.delete(child);
  }
}

async function waitDriver(base, child, name) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`P10 ${name} driver quit early`);
    try {
      const status = await fetch(`${base}/status`);
      if (status.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`P10 ${name} driver did not become ready`);
}

async function webdriver(base, method, pathname, body) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { raw }; }
  if (!response.ok || data?.value?.error) {
    throw new Error(`P10 WebDriver ${method} ${pathname}: ${JSON.stringify(data)}`);
  }
  return data.value ?? data;
}

function terminate(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 1500).unref();
}
