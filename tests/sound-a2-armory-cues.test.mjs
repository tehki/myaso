import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cueForAuthoritativeStrike, createConfirmedArmoryCueGate,
} from "../src/browser/armory-audio-contract.mjs";

test("Sound A2: fists and physical swords have separate fail-silent authoritative cue paths", () => {
  assert.deepEqual(["light", "heavy", "hit"].map(action =>
    cueForAuthoritativeStrike({ kind: "UNARMED", itemId: null }, action)),
  ["fistLight", "fistHeavy", "fistHit"]);
  assert.deepEqual(["light", "heavy", "hit"].map(action =>
    cueForAuthoritativeStrike({ kind: "SWORD", itemId: "canonical-sword-1" }, action)),
  ["light", "heavy", "hit"]);
  for (const mode of [
    null, {}, { kind: "SWORD" }, { kind: "SWORD", itemId: "  " },
    { kind: "UNARMED", itemId: "uncommitted-rack-sword" },
    { kind: "PENDING_SWORD", itemId: "canonical-sword-1" },
    { kind: "SWORD", itemId: "../forged" },
  ]) assert.equal(cueForAuthoritativeStrike(mode, "light"), null,
    "unknown, client-optimistic or invalid equipment must not sound like a sword");
  for (const action of ["parry", "toString", "constructor", "__proto__", "valueOf"]) {
    assert.equal(cueForAuthoritativeStrike({ kind: "UNARMED", itemId: null }, action), null);
    assert.equal(cueForAuthoritativeStrike({ kind: "SWORD", itemId: "canonical-sword-1" }, action), null);
  }
});

test("Sound A2: four distinct authoritative sword claims yield exactly four cues", () => {
  const gate = createConfirmedArmoryCueGate({ maxItems: 4 });
  assert.equal(gate.consume({}), null, "no audio before verified session bootstrap");
  assert.equal(gate.beginSession("core-session-a"), true);
  const committed = actorNetId => ({
    source: "authoritative", status: "COMMITTED", sessionEpoch: "core-session-a",
    operation: "PICKUP", actorNetId, itemId: `sword-${actorNetId}`,
    itemRevision: 1, receiptId: `commit-pickup-${actorNetId}`,
  });
  for (let actor = 1; actor <= 4; actor++) {
    const result = gate.consume(committed(actor));
    assert.equal(result.cue, "swordPickup");
    assert.equal(result.actorNetId, actor);
    assert.equal(result.itemId, `sword-${actor}`);
    assert.equal(gate.consume(committed(actor)), null, "duplicate receipt must be silent");
  }
  assert.equal(gate.consume({ ...committed(4), receiptId: "forged-replay", itemRevision: 1 }), null,
    "renamed receipt with same authoritative item revision must be silent");
  assert.equal(gate.consume({
    ...committed(5), itemRevision: 1,
  }), null, "bounded memory fails silent instead of evicting old receipts");
});

test("Sound A2: denied local pickup, stale session, drop/re-pick and reconnect are silent unless committed", () => {
  const gate = createConfirmedArmoryCueGate();
  assert.equal(gate.beginSession("epoch-1"), true);
  const pickup = {
    source: "authoritative", status: "COMMITTED", operation: "PICKUP",
    sessionEpoch: "epoch-1", receiptId: "tx1", actorNetId: 1,
    itemId: "sword-1", itemRevision: 11,
  };
  assert.equal(gate.consume({ ...pickup, source: "client" }), null);
  assert.equal(gate.consume({ ...pickup, status: "PENDING" }), null);
  assert.equal(gate.consume({ ...pickup, status: "DENIED" }), null);
  assert.equal(gate.consume({ ...pickup, actorNetId: 0 }), null);
  assert.equal(gate.consume({ ...pickup, itemRevision: 0 }), null);
  assert.equal(gate.consume({ ...pickup, receiptId: "" }), null);
  assert.equal(gate.consume({ ...pickup, operation: "PREVIEW" }), null);
  assert.equal(gate.consume(pickup).cue, "swordPickup");
  assert.equal(gate.consume(pickup), null);
  assert.equal(gate.consume({ ...pickup, operation: "EQUIP", receiptId: "tx1b" }), null,
    "same item revision is one authoritative sound boundary");
  assert.equal(gate.consume({
    ...pickup, operation: "DROP", actorNetId: 1, receiptId: "tx2", itemRevision: 12,
  }).cue, "swordDrop");
  assert.equal(gate.consume({
    ...pickup, operation: "PICKUP", actorNetId: 2, receiptId: "tx3", itemRevision: 13,
  }).cue, "swordPickup");
  assert.equal(gate.consume({
    ...pickup, operation: "EQUIP", actorNetId: 2, receiptId: "tx4", itemRevision: 14,
  }).cue, "swordEquip");
  assert.equal(gate.consume({ ...pickup, receiptId: "delayed-old", itemRevision: 11 }), null);
  gate.reset();
  assert.equal(gate.consume({ ...pickup, receiptId: "late-after-reset" }), null);
  assert.equal(gate.beginSession("epoch-2"), true);
  assert.equal(gate.consume({ ...pickup, receiptId: "late-old-session" }), null);
  assert.equal(gate.consume({
    ...pickup, sessionEpoch: "epoch-2", receiptId: "new-live-tx",
    actorNetId: 3, itemRevision: 15,
  }).cue, "swordPickup");
  assert.equal(gate.beginSession(""), false);
  assert.equal(gate.consume({
    ...pickup, sessionEpoch: "epoch-2", receiptId: "after-invalid-epoch",
  }), null);
});

test("Sound A2: the dormant palette reuses bundled recorded samples without changing approved tracks", () => {
  const source = readFileSync(new URL("../src/browser/game-audio.mjs", import.meta.url), "utf8");
  const contract = readFileSync(new URL("../src/browser/armory-audio-contract.mjs", import.meta.url), "utf8");
  for (const cue of ["fistLight", "fistHeavy", "fistHit", "swordPickup", "swordEquip", "swordDrop"]) {
    assert.match(source, new RegExp(`\\b${cue}: \\{`), `missing sound envelope ${cue}`);
    assert.match(source, new RegExp(`\\b${cue}: \\["[a-zA-Z0-9]+"`),
      `missing recorded local sample mapping ${cue}`);
  }
  assert.match(contract, /No online runtime currently imports this module/);
  assert.match(source, /music\/track-04-untitled\.mp3/);
  assert.match(source, /music\/moonlight-sonata-adagio\.mp3/);
  assert.match(source, /music\/vivaldi-autumn-adagio\.mp3/);
  assert.match(source, /music\/vivaldi-winter\.mp3/);
});
