// Isolated, opt-in PlayCanvas + original Rust QUIC/WebTransport test.
// Starts only loopback processes with a fresh development certificate.
// Reuses the existing qualified browser client; never changes wire codecs.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as pause } from 'node:timers/promises';
import { basename, isAbsolute, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const repo = resolve('../..');
const rustBinary = process.env.MYASO_PLAYCANVAS_RUST_BIN;
if (!rustBinary || !isAbsolute(rustBinary) || !existsSync(rustBinary) ||
    !['myaso-server', 'myaso-server.exe'].includes(basename(rustBinary))) {
  throw new Error('Explicit absolute path to a locally built myaso-server binary is required');
}
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
const children = [];
const sessions = [];
let driverPort;
let rustOutput = '';
let viteOutput = '';
const testDeadlineMs = 30_000;
const browserName = process.env.MYASO_PLAYCANVAS_BROWSER === 'firefox' ? 'firefox' : 'chrome';

function child(file, args, options = {}) {
  const proc = spawn(file, args, { stdio: ['ignore','pipe','pipe'], ...options });
  children.push(proc);
  return proc;
}
function readOutput(proc, onText) {
  proc.stdout.on('data', data => onText(data.toString()));
  proc.stderr.on('data', data => onText(data.toString()));
}
function freePort() {
  return new Promise((resolve, reject) => {
    const socket = createServer();
    socket.on('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}
async function poll(label, fn, ms = testDeadlineMs) {
  const start = Date.now();
  let last;
  while (Date.now() - start < ms) {
    try { last = await fn(); if (last?.ok) return last; }
    catch (error) { last = { error: String(error) }; }
    await pause(130);
  }
  throw new Error(label + ' TIMEOUT: ' + JSON.stringify(last) + ' Rust tail: ' + rustOutput.slice(-700));
}
async function wd(method, path, body) {
  const response = await fetch('http://127.0.0.1:' + driverPort + path, {
    method, headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const json = await response.json();
  if (!response.ok || json.value?.error) {
    throw new Error('WebDriver ' + method + ' ' + path + ': ' + JSON.stringify(json).slice(-1000));
  }
  return json.value;
}
async function newBrowser(url) {
  const options = browserName === 'firefox'
    ? { browserName: 'firefox', 'moz:firefoxOptions': {
        args: process.env.MYASO_PLAYCANVAS_XVFB === '1' ? [] : ['-headless'],
        // Headless Firefox on CI has no WebGL2 context: run under Xvfb
        // with software Mesa, without weakening actual engine boot checks.
        // Explicitly allow its
        // software WebGL2 renderer, without changing game or protocol code.
        prefs: { 'webgl.force-enabled': true, 'webgl.disabled': false,
          'webgl.enable-webgl2': true },
        ...(process.env.FIREFOX_BIN ? { binary: process.env.FIREFOX_BIN } : {})
      } }
    : { browserName: 'chrome', 'goog:chromeOptions': {
        binary: process.env.CHROME_BIN || '/usr/bin/chromium', args: [
          '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
          '--disable-background-networking', '--use-gl=angle', '--use-angle=swiftshader',
          '--enable-webgl', '--enable-unsafe-swiftshader', '--window-size=1280,720'
        ]
      } };
  const value = await wd('POST', '/session', { capabilities: { alwaysMatch: options } });
  const id = value.sessionId;
  assert.ok(id, 'real browser session');
  sessions.push(id);
  const base = '/session/' + id;
  await wd('POST', base + '/timeouts', { script: 25_000, pageLoad: 35_000 });
  await wd('POST', base + '/url', { url });
  await poll('PlayCanvas boot', async () => {
    const state = await wd('POST', base + '/execute/sync', {
      script: 'return {booted:document.documentElement.dataset.engineBooted,renderer:document.documentElement.dataset.renderer,ready:!!window.__MYASO_PLAYCANVAS__,fatal:document.querySelector("#fatal")?.textContent?.slice(0,600),gpu:!!navigator.gpu,webgl2:(()=>{try{return !!document.createElement("canvas").getContext("webgl2")}catch{return false}})()};',
      args: [],
    });
    return { ...state, ok: state.booted === 'true' && state.ready === true };
  });
  return base;
}

async function openPlayCanvasQuic(endpoint, hex, done) {
  try {
    if (!/^https:\/\/127\.0\.0\.1:\d+\/game$/.test(endpoint)) throw Error('non-loopback endpoint forbidden');
    if (document.documentElement.dataset.engineBooted !== 'true') throw Error('PlayCanvas not ready');
    const { connectAuthoritativeClient } = await window.__MYASO_PLAYCANVAS__.loadAuthoritativeClient();
    const raw = new Uint8Array(hex.match(/../g).map(pair => Number.parseInt(pair, 16)));
    const proof = { started: Date.now(), datagramSnapshots: 0, reliableSnapshots: 0,
      fullSnapshots: 0, processedAcks: 0, serverTicks: [], identityEvents: [],
      errors: [], stateSamples: [], sendFailures: [] };
    let client;
    client = await connectAuthoritativeClient({
      webTransportUrl: endpoint,
      webTransportOptions: { serverCertificateHashes: [{ algorithm: 'sha-256', value: raw }] },
      onSnapshot(result, state) {
        proof.datagramSnapshots++;
        if (proof.serverTicks.length < 16) proof.serverTicks.push(result.serverTick);
        if (proof.stateSamples.length < 8) proof.stateSamples.push({ size: state.size, full: result.full });
      },
      onReliableSnapshot(result, state, meta) {
        proof.reliableSnapshots++;
        if (meta?.full) proof.fullSnapshots++;
        if (proof.stateSamples.length < 8) proof.stateSamples.push({ size: state.size, full: meta?.full });
      },
      onProcessedAck(ack) {
        proof.processedAcks++;
        if (proof.identityEvents.length < 4) proof.identityEvents.push(ack.playerNetId);
      },
      onProtocolError(error) { proof.errors.push(String(error)); },
    });
    const generation = { client, proof, tick: 0 };
    generation.timer = setInterval(() => {
      if (client.transport.closed) return;
      try { client.sendInput({ tick: ++generation.tick, moveX: 0, moveY: 0, facing: 0 }); }
      catch (error) { proof.sendFailures.push(String(error)); }
    }, 33);
    window.__MYASO_PC_QUIC_TEST__ = generation;
    done({ ok: true, kind: client.transport.kind });
  } catch (error) { done({ ok: false, error: String(error) }); }
}
function samplePlayCanvasQuic() {
  const g = window.__MYASO_PC_QUIC_TEST__;
  if (!g) return { missing: true };
  const { client, proof } = g;
  const own = client.state.get(client.playerNetId);
  return { ...proof,
    kind: client.transport.kind, closed: client.transport.closed,
    actorId: client.playerNetId, latestTick: client.latestServerTick,
    snapshotSequence: client.latestSnapshotSequence,
    stateCount: client.state.size, own: own ? {
      netId: own.netId, x: own.x, y: own.y, hp: own.hp,
      serverTick: own.serverTick,
    } : null,
    stateIds: [...client.state.keys()].slice(0, 10),
    sentInputs: g.tick, renderer: document.documentElement.dataset.renderer,
    playcanvasBooted: document.documentElement.dataset.engineBooted === 'true',
  };
}
function closePlayCanvasQuic() {
  const g = window.__MYASO_PC_QUIC_TEST__;
  if (!g) return { missing: true };
  clearInterval(g.timer);
  const old = { actorId: g.client.playerNetId, kind: g.client.transport.kind };
  g.client.close('loopback PlayCanvas QUIC lifecycle acceptance');
  old.closed = g.client.transport.closed;
  window.__MYASO_PC_QUIC_TEST__ = null;
  return old;
}
async function bootTransport(base, endpoint, pin) {
  const opened = await wd('POST', base + '/execute/async', {
    script: '(' + openPlayCanvasQuic.toString() + ').apply(null,arguments)',
    args: [endpoint, pin],
  });
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.equal(opened.kind, 'webtransport', 'no WebSocket fallback or protocol fork');
}
async function sample(base) {
  return wd('POST', base + '/execute/sync', {
    script: 'return (' + samplePlayCanvasQuic.toString() + ')();', args: [],
  });
}
async function bridgeSample(base) {
  return wd('POST', base + '/execute/sync', {
    script: 'const s=window.__MYASO_PLAYCANVAS__?.devRustSession; return {status:document.documentElement.dataset.rustSession,kind:s?.client?.transport?.kind,snapshots:s?.snapshotCount??0,actors:s?.layer?.count??0,ids:s?[...s.client.state.keys()]:[],ownNetId:s?.client?.playerNetId??null,datagramSeq:s?.client?.latestSnapshotSequence??null,hasAuthorityBridge:!!s,renderer:document.documentElement.dataset.renderer};',
    args: [],
  });
}
async function close(base) {
  return wd('POST', base + '/execute/sync', {
    script: 'return (' + closePlayCanvasQuic.toString() + ')();', args: [],
  });
}

try {
  // Scrub inherited production certificates, feature flags and credentials.
  // This server must use only its own loopback-generated development identity.
  const rustEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('MYASO_')),
  );
  const rust = child(rustBinary, [], {
    env: { ...rustEnv, MYASO_BIND: '127.0.0.1:0', MYASO_MAX_PLAYERS: '4' },
  });
  readOutput(rust, text => { rustOutput += text; });
  const server = await poll('original Rust WebTransport loopback server', () => {
    const endpoint = rustOutput.match(/listening on (https:\/\/127\.0\.0\.1:\d+\/game)/)?.[1];
    const hash = rustOutput.match(/development certificate SHA-256:\s*([a-fA-F0-9:]+)/)?.[1];
    return { endpoint, pin: hash?.replaceAll(':', ''), ok: Boolean(endpoint && hash) };
  });
  assert.equal(server.pin.length, 64, 'real ephemeral development certificate SHA-256');

  const httpPort = await freePort();
  driverPort = await freePort();
  const vite = child(process.execPath, [
    resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1',
    '--port', String(httpPort), '--strictPort',
  ], { env: {
    ...process.env,
    VITE_MYASO_DEV_QUIC_URL: server.endpoint,
    VITE_MYASO_DEV_QUIC_SHA256: server.pin,
  } });
  readOutput(vite, text => { viteOutput += text; });
  await poll('loopback PlayCanvas Vite server', async () => {
    const response = await fetch('http://127.0.0.1:' + httpPort).catch(() => null);
    return { ok: Boolean(response?.ok) };
  });
  child(browserName === 'firefox' ? 'geckodriver' : 'chromedriver',
    browserName === 'firefox'
      ? ['--host', '127.0.0.1', '--port', String(driverPort)]
      : ['--port=' + driverPort]);
  await poll('loopback ChromeDriver', async () => ({
    ok: Boolean((await fetch('http://127.0.0.1:' + driverPort + '/status').catch(() => null))?.ok),
  }));

  const page = 'http://127.0.0.1:' + httpPort + '/';
  // Attach the passive PlayCanvas actor bridge *before* other actors join.
  // Never send neutral inputs to wake QUIC or invent a new packet type.
  const readOnly = await newBrowser(page + '?rust=1');
  const baseline = await poll('read-only baseline before another actor joins', async () => {
    const proof = await bridgeSample(readOnly);
    return { ...proof, ok: proof.snapshots >= 1 && proof.actors === 1
      && proof.kind === 'webtransport' && proof.status === 'connected' };
  });
  const a = await newBrowser(page);
  const b = await newBrowser(page);
  await bootTransport(a, server.endpoint, server.pin);
  await bootTransport(b, server.endpoint, server.pin);

  // Exercise the real source-only PlayCanvas read-only debug bridge too.
  // Unlike the two independent session/identity probes above, it sends zero
  // input, movement or Combat packets and never claims map authority.
  // Read-only clients may receive just the initial reliable baseline until
  // their input-free lease is scheduled another catchup. Require one real
  // server snapshot with two real actor silhouettes, never fake frame ticks.
  const bridge = await poll('opt-in original Rust snapshot actor bridge', async () => {
    const proof = await bridgeSample(readOnly);
    return { ...proof, ok: proof.status === 'connected' &&
      proof.kind === 'webtransport' && proof.snapshots > baseline.snapshots &&
      proof.actors >= 3 && proof.ids.includes(2) && proof.ids.includes(3)
      && proof.ownNetId === null && proof.datagramSeq === 65535 };
  }, 40_000);

  const ready = await poll('two independently authoritative PlayCanvas snapshots and ACKs', async () => {
    const first = await sample(a), second = await sample(b);
    return { first, second, ok: [first, second].every(s =>
      s.playcanvasBooted && s.renderer !== 'failed' && s.kind === 'webtransport' &&
      !s.closed && s.datagramSnapshots >= 5 && s.reliableSnapshots >= 1 &&
      s.processedAcks >= 3 && s.actorId > 0 && s.own?.netId === s.actorId &&
      Number.isFinite(s.own.x) && Number.isFinite(s.own.y) &&
      s.errors.length === 0 && s.sendFailures.length === 0) &&
      first.actorId !== second.actorId,
    };
  }, 40_000);
  const before = ready.first;
  const second = ready.second;
  assert.notEqual(before.actorId, second.actorId, 'server issues distinct actor identity per QUIC root');
  const exited = await close(a);
  assert.equal(exited.closed, true, 'old connection explicitly retires');
  await poll('peer and passive PlayCanvas both observe actor removal', async () => {
    const peer = await sample(b), spectator = await bridgeSample(readOnly);
    return { peer, spectator, ok: !peer.stateIds.includes(before.actorId) &&
      !spectator.ids.includes(before.actorId) &&
      spectator.snapshots > bridge.snapshots && spectator.actors === 2 &&
      spectator.ownNetId === null && spectator.datagramSeq === 65535 &&
      peer.processedAcks > second.processedAcks };
  }, 25_000);

  await bootTransport(a, server.endpoint, server.pin);
  const reconnected = await poll('fresh authoritative snapshot and server-issued identity', async () => {
    const fresh = await sample(a);
    const peer = await sample(b);
    return { fresh, peer, ok:
      fresh.kind === 'webtransport' && !fresh.closed && fresh.actorId > 0 &&
      fresh.actorId !== before.actorId && fresh.datagramSnapshots >= 5 &&
      fresh.processedAcks >= 3 && fresh.own?.netId === fresh.actorId &&
      fresh.errors.length === 0 && fresh.sendFailures.length === 0 &&
      peer.stateIds.includes(fresh.actorId) };
  }, 35_000);
  assert.ok(reconnected.fresh.latestTick > 0);
  const rejoinedSpectator = await poll('passive PlayCanvas reflects server-issued rejoin', async () => {
    const spectator = await bridgeSample(readOnly);
    return { spectator, ok: spectator.ids.includes(reconnected.fresh.actorId) &&
      spectator.actors === 3 && spectator.ownNetId === null &&
      spectator.datagramSeq === 65535 };
  }, 25_000);
  const bridgeClosed = await wd('POST', readOnly + '/execute/sync', {
    script: 'const s=window.__MYASO_PLAYCANVAS__.devRustSession; s.close(); return {closed:s.client.transport.closed};',
    args: [],
  });
  assert.equal(bridgeClosed.closed, true, 'read-only bridge retires QUIC without input');
  await close(a);
  await close(b);
  console.log('PLAYCANVAS_REAL_RUST_QUIC_PASS', JSON.stringify({
    sha, browser: browserName, loopbackOnly: true, protocolFork: false,
    client: 'PlayCanvas 2.23.3 + shared authoritative-client.mjs',
    renderer: before.renderer,
    readOnlyBridge: { transport: bridge.kind, initialActors: baseline.actors,
      joinedActors: bridge.actors, rejoinedActors: rejoinedSpectator.spectator.actors,
      snapshots: rejoinedSpectator.spectator.snapshots, closed: bridgeClosed.closed,
      sentInputs: 0 },
    originalActor: before.actorId, peerActor: second.actorId,
    reconnectedActor: reconnected.fresh.actorId,
    first: { snapshots: before.datagramSnapshots, reliable: before.reliableSnapshots,
      acks: before.processedAcks, tick: before.latestTick, own: before.own },
    peer: { snapshots: second.datagramSnapshots, reliable: second.reliableSnapshots,
      acks: second.processedAcks, tick: second.latestTick },
    reconnect: { snapshots: reconnected.fresh.datagramSnapshots,
      reliable: reconnected.fresh.reliableSnapshots, acks: reconnected.fresh.processedAcks,
      tick: reconnected.fresh.latestTick, own: reconnected.fresh.own },
    originalClosed: exited.closed, oldActorGoneFromPeer: true,
  }));
} catch (error) {
  console.error('PLAYCANVAS_REAL_RUST_QUIC_FIRST_RED', String(error),
    'Rust output tail:', rustOutput.slice(-2200), 'Vite output tail:', viteOutput.slice(-700));
  process.exitCode = 1;
} finally {
  for (const id of sessions.reverse()) {
    await wd('DELETE', '/session/' + id).catch(() => {});
  }
  for (const proc of children.reverse()) {
    if (proc.exitCode === null) proc.kill('SIGTERM');
  }
}
