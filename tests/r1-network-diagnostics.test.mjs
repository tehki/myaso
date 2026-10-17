import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createNetworkDiagnostics } from "../src/browser/network-diagnostics.mjs";

test("R1 input-to-ACK measures exact processed input ticks, not input redelivery or ICMP ping", () => {
  let time = 0;
  const m = createNetworkDiagnostics({ now: () => time });
  m.noteSentInput(10);
  time = 40;
  m.noteSentInput(10); // retransmission must not reset original sentAt
  time = 120;
  m.noteAck(10);
  const snap = m.snapshot();
  assert.equal(snap.inputAckSamples, 1);
  assert.equal(snap.inputAckP50Ms, 120);
  assert.equal(snap.inputAckP95Ms, 120);
  assert.equal(snap.pendingInputs, 0);
  assert.equal(snap.ackJitterP95Ms, null);
  assert.equal(snap.ackCount, 1);
  m.noteAck(10); // duplicate ACK ignored
  assert.equal(m.snapshot().ackCount, 1);
});

test("R1 ACK samples count queueing and out-of-order arrivals without double counting", () => {
  let time = 0;
  const m = createNetworkDiagnostics({ now: () => time });
  m.noteSentInput(20);
  time = 10; m.noteSentInput(21);
  time = 20; m.noteSentInput(22);
  time = 50; m.noteAck(21); // Cumulative ACK, original tick 20 still pruned
  assert.equal(m.snapshot().inputAckP50Ms, 40);
  assert.equal(m.snapshot().pendingInputs, 1);
  time = 65; m.noteAck(20);
  assert.equal(m.snapshot().ackCount, 1, "reordered older ACK is ignored");
  time = 100; m.noteAck(22);
  const result = m.snapshot();
  assert.equal(result.ackCount, 2);
  assert.equal(result.inputAckSamples, 2);
  assert.equal(result.ackJitterP95Ms, 40);
  assert.equal(result.pendingInputs, 0);
});

test("R1 32-bit tick wrap and bounded pending/samples prevent indefinite memory growth", () => {
  let time = 1000;
  const m = createNetworkDiagnostics({ now: () => time, maxPending: 3, sampleLimit: 3 });
  for (const tick of [0xfffffffe, 0xffffffff, 0, 1]) {
    m.noteSentInput(tick);
    time += 15;
  }
  assert.equal(m.snapshot().pendingInputs, 3);
  time += 80;
  m.noteAck(0);
  assert.equal(m.snapshot().pendingInputs, 1);
  time += 30;
  m.noteAck(1);
  assert.equal(m.snapshot().pendingInputs, 0);
  for(let i=2; i<50; i++) {
    m.noteSentInput(i);
    time+=10;
    m.noteAck(i);
  }
  assert.equal(m.snapshot().inputAckSamples, 3);
  assert.equal(m.snapshot().ackCount, 50);
  assert.equal(m.snapshot().pendingInputs, 0);
});

test("R1 snapshot cadence, jitter and camera correction expose stale authoritative anchor", () => {
  let time = 1000;
  const m = createNetworkDiagnostics({ now: () => time });
  m.noteSnapshot();
  time = 1050; m.noteSnapshot();
  time = 1170; m.noteSnapshot();
  m.noteAckAnchor({serverTick: 120}, {serverTick: 118});
  m.noteReconciliation({serverTick: 120}, {serverTick: 118}, 12);
  m.noteAckAnchor({serverTick: 121}, {serverTick: 121});
  m.noteReconciliation({serverTick: 121}, {serverTick: 121}, 3);
  const s = m.snapshot();
  assert.equal(s.snapshots, 3);
  assert.equal(s.snapshotGapP50Ms, 120);
  assert.equal(s.snapshotGapP95Ms, 120);
  assert.equal(s.cameraCorrectionP95, 12);
  assert.equal(s.staleOwnAtAckCount, 1);
  assert.equal(s.maxStaleOwnTicks, 2);
});

test("R1 diagnostics are opt-in, private and never update authoritative gameplay state", () => {
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  const client = readFileSync(new URL("../web/authoritative-client.mjs", import.meta.url), "utf8");
  const online = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  assert.match(html, /id="network-diagnostics"[^>]*hidden/);
  assert.match(online, /params\.get\("netstats"\) === "1"/);
  assert.match(online, /if \(!diagnosticsVisible \|\| !diagnosticsPanel/);
  assert.match(online, /diagnosticsPanel\.textContent =/);
  assert.match(client, /diagnostics\.noteSentInput\(normalized\.tick\)/);
  assert.match(client, /diagnostics\.noteAck\(ack\.processedClientTick\)/);
  assert.match(client, /diagnostics\.noteSnapshot\(\)/);
  assert.doesNotMatch(readFileSync(new URL("../src/browser/network-diagnostics.mjs", import.meta.url), "utf8"), /localStorage|fetch\(|sendBeacon|XMLHttpRequest|WebSocket|WebTransport|console\./);
});
