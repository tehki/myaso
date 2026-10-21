// P11: real authoritative /game input/snapshot/ACK browser flights concurrent
// with a *separate* 16-real-connection magic FX WebTransport crowd sidecar.
// Controlled, loopback-only co-host contention; NOT shared socket transport,
// production magic activation, 512 real players, or actual hit-confirm RTT.
import { spawn } from "node:child_process";

const root = process.cwd();
const active = new Set();
const recordings = [];
const now = () => Date.now();
const flightEnv = {
  MYASO_FLIGHT_DURATION_MS: "6000",
  MYASO_FLIGHT_STRESS_ENTITIES: "128",
  MYASO_P11_OVERLAP_TRACE: "1",
};

function launch(label, script, env = {}, onLine = () => {}) {
  const child = spawn(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  active.add(child);
  const events = [];
  function pipe(output, stream) {
    let buffered = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      buffered += chunk;
      const chunks = buffered.split(/\r?\n/);
      buffered = chunks.pop();
      for (const line of chunks) {
        const entry = { label, timeMs: now(), line, output };
        events.push(entry);
        onLine(entry);
        console.log(`[${label}] ${line}`);
      }
    });
    stream.on("end", () => {
      if (buffered) {
        const entry = { label, timeMs: now(), line: buffered, output };
        events.push(entry);
        onLine(entry);
        console.log(`[${label}] ${buffered}`);
      }
    });
  }
  pipe("stdout", child.stdout);
  pipe("stderr", child.stderr);
  const completion = new Promise((resolve, reject) => {
    child.on("error", reject);
    // close fires after stdout/stderr have drained; exit does not.
    // Evidence parsing must include final per-browser JSON lines.
    child.on("close", (code, signal) => {
      active.delete(child);
      if (code === 0) resolve(events);
      else reject(new Error(`${label} exit=${code} signal=${signal}; tail=${events.slice(-10).map(x => x.line).join(" | ")}`));
    });
  });
  return { child, events, completion };
}

function parseFlight(events, prefix) {
  const found = new Map();
  for (const item of events) {
    if (!item.line.startsWith(`${prefix} {`)) continue;
    const value = JSON.parse(item.line.slice(prefix.length + 1));
    if (!value.ok || !value.webTransportAvailable ||
        !Number.isFinite(value.processedInputAckMs?.p95) ||
        value.processedInputAckMs.count < 5 ||
        value.snapshots < 20 || value.acknowledgements < 10 || value.sentInputs < 30) {
      throw new Error(`P11 authoritative flight incomplete: ${item.line}`);
    }
    const browser = value.userAgent.includes("Firefox") ? "firefox" : "chrome";
    if (found.has(browser)) throw new Error(`P11 duplicate real browser ${browser}`);
    found.set(browser, { ...value, completedAt: item.timeMs });
  }
  if (found.size !== 2 || !found.has("chrome") || !found.has("firefox")) {
    throw new Error(`P11 ${prefix} did not complete both genuine browsers`);
  }
  return found;
}

function parseCrowd(events) {
  const found = new Map();
  for (const item of events) {
    if (!item.line.startsWith("P10_REAL_CROWD_BROWSER {")) continue;
    const value = JSON.parse(item.line.slice("P10_REAL_CROWD_BROWSER ".length));
    if (!value.ok || value.realConcurrentSessions !== 16 ||
        value.minGameplayMarkers < 55 || value.minFxPackets < 12 ||
        value.minPingReplies < 5 || value.malformedFx !== 0) {
      throw new Error(`P11 real FX crowd incomplete: ${item.line}`);
    }
    found.set(value.browser, value);
  }
  if (found.size !== 2 || !found.has("chrome") || !found.has("firefox")) {
    throw new Error("P11 did not complete 16 real FX connections in both browsers");
  }
  return found;
}

function realIntervals(gameEvents, crowdEvents) {
  const game = new Map();
  const crowd = new Map();
  for (const browser of ["chrome", "firefox"]) {
    game.set(browser, {});
    crowd.set(browser, {});
  }
  for (const item of gameEvents) {
    const begin = item.line.match(/^P11_REAL_GAME_BROWSER_STARTED browser=(chrome|firefox)$/);
    if (begin) game.get(begin[1]).start = item.timeMs;
    if (item.line.startsWith("P11_GAME_LOADED {")) {
      const value = JSON.parse(item.line.slice("P11_GAME_LOADED ".length));
      const browser = value.userAgent.includes("Firefox") ? "firefox" : "chrome";
      game.get(browser).end = item.timeMs;
    }
  }
  let index = 0, closed = 0;
  for (const item of crowdEvents) {
    if (item.line.includes("P10_REAL_CONNECTIONS_ACCEPTED 16")) {
      const browser = index++ === 0 ? "chrome" : "firefox";
      crowd.get(browser).start = item.timeMs;
    }
    if (item.line.includes("P10_REAL_CROWD_SUMMARY connections=16")) {
      const browser = closed++ === 0 ? "chrome" : "firefox";
      crowd.get(browser).end = item.timeMs;
    }
  }
  const overlaps = {};
  for (const browser of ["chrome", "firefox"]) {
    const g = game.get(browser), c = crowd.get(browser);
    if (![g.start, g.end, c.start, c.end].every(Number.isFinite)) {
      throw new Error(`P11 missing genuine connection/gameplay lifecycle timestamps: ${browser} ${JSON.stringify({g,c})}`);
    }
    const overlap = Math.max(0, Math.min(g.end, c.end) - Math.max(g.start, c.start));
    // This is a real interval intersection, not a guessed simultaneous count.
    if (overlap < 500) {
      throw new Error(`P11 insufficient real game/FX activity overlap in ${browser}: ${overlap}ms`);
    }
    overlaps[browser] = overlap;
  }
  return overlaps;
}

try {
  // First obtain real authoritative-only baseline using unchanged /game.
  const baselineRun = launch("p11-game-baseline", "scripts/browser_flight_runner.mjs", {
    ...flightEnv,
    MYASO_FLIGHT_LABEL: "P11_GAME_BASELINE",
  });
  const baselineEvents = await baselineRun.completion;
  const baseline = parseFlight(baselineEvents, "P11_GAME_BASELINE");
  console.log("P11_REAL_GAME_BASELINE_COMPLETE");

  let admitted;
  const admittedOnce = new Promise((resolve) => { admitted = resolve; });
  const crowdRun = launch("p11-fx-crowd", "scripts/physics_fx_crowd_browser_flight.mjs", {
    P10_LAB_TICKS: "270", // ~8 seconds of genuine QUIC datagrams
    P10_WINDOW_MS: "8400",
  }, (entry) => {
    if (entry.line.includes("P10_REAL_CONNECTIONS_ACCEPTED 16")) admitted();
  });

  // Guard against a broken/blocked crowd sidecar before launching game.
  await Promise.race([
    admittedOnce,
    crowdRun.completion.then(() => { throw new Error("P11 FX crowd ended before it accepted real connections"); }),
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error("P11 FX crowd accept exceeded 90s")), 90000);
      timer.unref();
    }),
  ]);
  const gameRun = launch("p11-game-loaded", "scripts/browser_flight_runner.mjs", {
    ...flightEnv,
    MYASO_FLIGHT_LABEL: "P11_GAME_LOADED",
  });

  const [crowdEvents, loadedEvents] = await Promise.all([
    crowdRun.completion, gameRun.completion,
  ]);
  const loaded = parseFlight(loadedEvents, "P11_GAME_LOADED");
  const crowd = parseCrowd(crowdEvents);
  const overlappingMs = realIntervals(loadedEvents, crowdEvents);
  const browsers = ["chrome", "firefox"].map((browser) => {
    const first = baseline.get(browser), second = loaded.get(browser);
    return {
      browser,
      gameAndFxOverlappingMs: overlappingMs[browser],
      game: {
        baseline: { snapshots: first.snapshots, inputAcks: first.acknowledgements,
          inputAckP95Ms: first.processedInputAckMs.p95, frameP95Ms: first.frameMs.p95 },
        loaded: { snapshots: second.snapshots, inputAcks: second.acknowledgements,
          inputAckP95Ms: second.processedInputAckMs.p95, frameP95Ms: second.frameMs.p95 },
        ackP95DeltaMs: Number((second.processedInputAckMs.p95 - first.processedInputAckMs.p95).toFixed(2)),
        frameP95DeltaMs: Number((second.frameMs.p95 - first.frameMs.p95).toFixed(2)),
      },
      fxCrowd: {
        realConcurrentSessions: crowd.get(browser).realConcurrentSessions,
        minFxPackets: crowd.get(browser).minFxPackets,
        maxPingRttP95Ms: crowd.get(browser).maxPingRttP95Ms,
        payloadBytes: crowd.get(browser).cosmeticPayloadBytes,
      },
    };
  });
  console.log(`P11_REAL_GAME_FX_OVERLAP_SUMMARY ${JSON.stringify({ok:true, browsers, limitations:"Separate real /game and FX loopback processes, browser sidecar and game player are distinct sessions; co-host scheduling contention only, NOT live shared-socket priority, multi-host latency, 512 players or combat hit RTT."})}`);
} finally {
  // Retain no lingering test browser, cargo sidecar or /game server.
  for (const child of active) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
}
