import assert from "node:assert/strict";
import { createServer } from "node:http";
import { connect } from "node:net";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { attachM325TrustedWheelSocket } from "../scripts/m325-trusted-wheel-socket.mjs";
import { createM221TrustedWheelRegistry } from "../scripts/m221-trusted-wheel-attestation.mjs";

function browserFrame(packet) {
  const data = Buffer.from(JSON.stringify(packet), "utf8");
  assert.ok(data.length <= 1024);
  const mask = randomBytes(4);
  const offset = data.length < 126 ? 2 : 4;
  const frame = Buffer.alloc(offset + 4 + data.length);
  frame[0] = 0x81;
  frame[1] = 0x80 | (offset === 2 ? data.length : 126);
  if (offset === 4) frame.writeUInt16BE(data.length, 2);
  mask.copy(frame, offset);
  for (let i = 0; i < data.length; i++) frame[offset + 4 + i] = data[i] ^ mask[i % 4];
  return frame;
}

test("M325 masked browser WebSocket authenticates exactly one genuine wheel event", { timeout: 7000 }, async () => {
  const registry = createM221TrustedWheelRegistry({ timeoutMs: 2000 });
  const server = createServer((_, response) => { response.writeHead(404); response.end(); });
  const dispose = attachM325TrustedWheelSocket(server, registry);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const client = connect(port, "127.0.0.1");
  try {
    await new Promise((resolve, reject) => {
      client.once("connect", resolve);
      client.once("error", reject);
    });
    const key = randomBytes(16).toString("base64");
    client.write([
      "GET /__myaso_m325_trusted_wheel HTTP/1.1",
      "Host: 127.0.0.1:" + port,
      "Upgrade: websocket",
      "Connection: Upgrade",
      "Sec-WebSocket-Version: 13",
      "Sec-WebSocket-Key: " + key,
      "Origin: http://127.0.0.1:" + port,
      "", "",
    ].join("\r\n"));
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("M325 WebSocket handshake timeout")), 1500);
      client.once("data", data => { clearTimeout(timeout); resolve(data.toString("utf8")); });
      client.once("error", reject);
      client.once("close", () => reject(new Error("M325 handshake socket closed")));
    });
    assert.match(response, /^HTTP\/1\.1 101 Switching Protocols/);
    const challenge = registry.issue();
    const receipt = challenge.wait();
    client.write(browserFrame({ token: challenge.token, trusted: false, deltaY: 120 }));
    client.write(browserFrame({ token: challenge.token, trusted: true, deltaY: -120 }));
    client.write(browserFrame({ token: challenge.token, trusted: true, deltaY: 120 }));
    assert.deepEqual(await Promise.race([receipt, new Promise((_, reject) => setTimeout(() => reject(new Error("M325 attestation timeout")), 1500))]), { trusted: true, deltaY: 120 });
    assert.equal(registry.receive({ token: challenge.token, trusted: true, deltaY: 120 }), false);
    challenge.close();
  } finally {
    dispose();
    client.destroy();
    await new Promise(resolve => server.close(resolve));
  }
});

test("M325 leaves M194's authoritative guard, HP and parry gates strict", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function runOnlineUiGuardBreakFlight(");
  const end = source.indexOf("async function waitForUiGuardBreakEvidence(", start);
  assert.ok(start >= 0 && end > start);
  const flight = source.slice(start, end);
  assert.ok(source.includes("attachM325TrustedWheelSocket(server, m221Registry, {"));
  assert.ok(source.includes('m147Receipt: ["uijumppunishffa", "uikickknockdownffahit"].includes(scenario) ? m147CueReceipt : null'));
  assert.ok(source.includes("new WebSocket("));
  assert.ok(source.includes("event.isTrusted === true && event.deltaY > 0"));
  assert.ok(source.includes("if (channel.readyState === WebSocket.OPEN) channel.send(receipt);"));
  assert.ok(flight.includes("M325 trusted Firefox wheel socket did not open"));
  const r2 = readFileSync(new URL("../scripts/r2-release-led-short-block.mjs", import.meta.url), "utf8");
  assert.ok(flight.includes("dispatchR2ReleaseLedShortBlock({"));
  assert.match(r2, /wheelHeadStartMs: 0/);
  assert.match(r2, /receiptGraceMs = 100/);
  assert.match(r2, /postTrustedWheelMs = 0/);
  assert.match(r2, /postTrustedWheelMs: rounded\(postTrustedWheelMs\)/);
  assert.ok(flight.includes("awaitTrustedWheel: () => challenge.wait()"));
  assert.ok(flight.includes("sendWheel: () => scrollArenaWheel(defender, defenderElementId, 120, 0)"));
  assert.ok(flight.includes("sendAttackDown: () => setArenaAttackButton(attacker, true)"));
  assert.ok(flight.includes("sendAttackUp: () => setArenaAttackButton(attacker, false)"));
  assert.ok(flight.includes("if (!trustedWheelBeforeRelease)"));
  assert.ok(flight.includes('feedbackTransitions.includes("parried")'));
  assert.ok(flight.includes('defenderState?.playerHp !== 100'));
  assert.ok(flight.includes('defenderResult.playerGuard !== 0'));
});

test("M147 optional cue socket routes larger observations separately from wheel provenance", { timeout: 7000 }, async () => {
  const packets = [];
  let complete;
  const received = new Promise(resolve => { complete = resolve; });
  const server = createServer((_, response) => { response.writeHead(404); response.end(); });
  const dispose = attachM325TrustedWheelSocket(server,
    { receive: () => assert.fail("DOM observation must not enter wheel registry") },
    { m147Receipt: { receive: packet => { packets.push(packet); complete(); } } });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const client = connect(port, "127.0.0.1");
  try {
    await new Promise((resolve, reject) => { client.once("connect", resolve); client.once("error", reject); });
    const handshake = new Promise((resolve, reject) => {
      client.once("data", data => resolve(data.toString("utf8")));
      client.once("error", reject);
    });
    client.write(["GET /__myaso_m147_cue HTTP/1.1", "Host: 127.0.0.1:" + port,
      "Upgrade: websocket", "Connection: Upgrade", "Sec-WebSocket-Version: 13",
      "Sec-WebSocket-Key: " + randomBytes(16).toString("base64"),
      "Origin: http://127.0.0.1:" + port, "", ""].join("\r\n"));
    assert.match(await handshake, /^HTTP\/1\.1 101 Switching Protocols/);
    const packet = { observation: "actual browser snapshot".repeat(25) };
    assert.ok(JSON.stringify(packet).length > 512);
    client.write(browserFrame(packet));
    await received;
    assert.deepEqual(packets, [packet]);
  } finally {
    dispose(); client.destroy(); await new Promise(resolve => server.close(resolve));
  }
});

test("M147 observation capacity does not expand the trusted wheel frame limit", { timeout: 7000 }, async () => {
  const server = createServer();
  const dispose = attachM325TrustedWheelSocket(server,
    { receive: () => assert.fail("oversized wheel frame must be rejected") },
    { m147Receipt: { receive: () => assert.fail("wheel path must not route to DOM cue") } });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const client = connect(port, "127.0.0.1");
  try {
    await new Promise((resolve, reject) => { client.once("connect", resolve); client.once("error", reject); });
    const handshake = new Promise((resolve, reject) => {
      client.once("data", data => resolve(data.toString("utf8"))); client.once("error", reject);
    });
    client.write(["GET /__myaso_m325_trusted_wheel HTTP/1.1", "Host: 127.0.0.1:" + port,
      "Upgrade: websocket", "Connection: Upgrade", "Sec-WebSocket-Version: 13",
      "Sec-WebSocket-Key: " + randomBytes(16).toString("base64"),
      "Origin: http://127.0.0.1:" + port, "", ""].join("\r\n"));
    assert.match(await handshake, /^HTTP\/1\.1 101 Switching Protocols/);
    const closed = new Promise(resolve => client.once("close", resolve));
    client.write(browserFrame({ observation: "not a trusted wheel".repeat(30) }));
    await closed;
  } finally {
    dispose(); client.destroy(); await new Promise(resolve => server.close(resolve));
  }
});
