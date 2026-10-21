// P18 real, loopback-only WebTransport end-to-end acceptance, deliberately
// separate from live main.rs and all existing combat/browser flight scenarios.
// Reuses the repository's no-dependency W3C WebDriver and runner conventions.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const root = process.cwd();
const children = new Set();
const files = new Map([
  ["/web/physics-fx-reconnect-flight.html", "web/physics-fx-reconnect-flight.html"],
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
      res.writeHead(404).end("P18 reconnect lab only");
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
    const lab = await startLab();
    try {
      const result = await runBrowser(browser, lab, staticPort);
      const proof = lab.summary();
      if (!result.ok || result.realSequentialConnections !== 2 ||
          (result.a.zones?.[7] ?? 0) < 10 || (result.a.zones?.[8] ?? 0) < 10 ||
          (result.b.zones?.[9] ?? 0) < 10 ||
          result.b.zones?.[7] !== undefined || result.b.zones?.[8] !== undefined ||
          !proof || proof.accepted_real_connections !== 2 ||
          proof.migrated !== 1 || proof.real_closes !== 1 ||
          proof.recycled !== 1 || proof.stale_fx_blocked !== 2 ||
          ![proof.old_generation, proof.moved_generation, proof.new_generation].every(Number.isInteger) ||
          new Set([proof.old_generation, proof.moved_generation, proof.new_generation]).size !== 3 ||
          proof.old_gp !== 25 || proof.moved_gp !== 25 || proof.new_gp !== 40 ||
          proof.old_fx < 20 || proof.moved_fx < 20 || proof.new_fx < 30) {
        throw new Error(`P18 ${browser.name} real reconnect/zone fence failed: ${JSON.stringify({result,proof})}`);
      }
      results.push({browser:browser.name, ...result, serverProof:proof});
      console.log(`P18_REAL_RECONNECT_BROWSER ${JSON.stringify(results.at(-1))}`);
    } finally {
      terminate(lab.child);
    }
  }
  console.log(`P18_REAL_RECONNECT_SUMMARY ${JSON.stringify({ok:true,results})}`);
} finally {
  for (const child of children) terminate(child);
  if (staticServer) await new Promise((resolve) => staticServer.close(resolve));
}

async function startLab() {
  const child = spawn("cargo", [
    "run", "--locked", "--manifest-path", "server/Cargo.toml",
    "--example", "magic_fx_reconnect_loopback", "--quiet",
  ], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  children.add(child);
  let endpoint = null;
  let cert = null;
  let buffer = "";
  let stderr = "";
  let summary = null;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (value) => { stderr += value; process.stderr.write(value); });
  child.stdout.on("data", (value) => {
    // Only test-sidecar output: accepted lab session diagnostics, no user data.
    process.stdout.write(`[p18-lab] ${value}`);
    buffer += value;
    for (const line of buffer.split(/\r?\n/)) {
      const e = line.match(/P18_LOOPBACK_LISTENING (https:\/\/127\.0\.0\.1:\d+\/physics-fx-reconnect)/);
      if (e) endpoint = e[1];
      if (line.startsWith("P18_REAL_CHURN_SUMMARY ")) {
        summary = Object.fromEntries([...line.matchAll(/([a-z_]+)=(\d+)/g)]
          .map((match) => [match[1], Number(match[2])]));
      }
      if (line.includes("P18_CERT_SHA256 ")) {
        const hex = line.split("P18_CERT_SHA256 ").at(-1).trim()
          .replace(/[^0-9a-fA-F]/g, "").toLowerCase();
        if (hex.length === 64) cert = hex;
      }
    }
  });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline && !(endpoint && cert)) {
    if (child.exitCode !== null) throw new Error(`P18 reconnect lab stopped: ${child.exitCode}\n${stderr}`);
    await sleep(100);
  }
  if (!endpoint || !cert) throw new Error(`P18 reconnect lab startup timed out: ${buffer}\n${stderr}`);
  return { endpoint, cert, child, summary: () => summary };
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
    if (!sessionId) throw new Error(`P18 ${browser.name} WebDriver session was not created`);

    const page = new URL(`http://127.0.0.1:${staticPort}/web/physics-fx-reconnect-flight.html`);
    page.searchParams.set("server", lab.endpoint);
    page.searchParams.set("cert", lab.cert);
    await webdriver(base, "POST", `/session/${sessionId}/url`, { url: page.toString() });
    const deadline = Date.now() + 65000;
    let lastStage = "page-not-started";
    while (Date.now() < deadline) {
      const result = await webdriver(base, "POST", `/session/${sessionId}/execute/sync`, {
        script: "return {result:window.__P18_RESULT__||null,error:window.__P18_ERROR__||null,stage:window.__P18_STAGE__||null};",
        args: [],
      });
      const value = result.value ?? result;
      lastStage = value?.stage ?? lastStage;
      if (value.error) throw new Error(`P18 ${browser.name} page: ${value.error}`);
      if (value.result) return value.result;
      await sleep(175);
    }
    throw new Error(`P18 ${browser.name} real QUIC datagram flight timed out (stage: ${lastStage})`);
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
    if (child.exitCode !== null) throw new Error(`P18 ${name} driver quit early`);
    try {
      const status = await fetch(`${base}/status`);
      if (status.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`P18 ${name} driver did not become ready`);
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
    throw new Error(`P18 WebDriver ${method} ${pathname}: ${JSON.stringify(data)}`);
  }
  return data.value ?? data;
}

function terminate(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 1500).unref();
}
