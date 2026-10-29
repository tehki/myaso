import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateLocalChatText, createLocalChatHistory, CHAT_UI_LIMITS } from "../src/browser/local-chat.mjs";

test("C1 message length, UTF-8 and control characters fail closed", () => {
  assert.equal(validateLocalChatText("  Greetings, traveler!  "), "Greetings, traveler!");
  for (const bad of ["", "  ", "x".repeat(241), "🛡️".repeat(260), "hello\u0000there", "\n", "spoof\u202eeman"]) {
    assert.throws(() => validateLocalChatText(bad));
  }
  assert.equal(validateLocalChatText("🛡️ Guard the old mill."), "🛡️ Guard the old mill.");
  // Core #399 accepts <=240 UTF-8 bytes, not 240 UTF-16 characters.
  assert.equal(new TextEncoder().encode("é".repeat(120)).length, 240);
  assert.equal(validateLocalChatText("é".repeat(120)), "é".repeat(120));
  assert.throws(() => validateLocalChatText("é".repeat(121)), /too long/);
  assert.equal(validateLocalChatText("x".repeat(240)), "x".repeat(240));
  assert.throws(() => validateLocalChatText("x".repeat(241)), /too long/);
  assert.equal(validateLocalChatText("🛡".repeat(60)), "🛡".repeat(60));
  assert.throws(() => validateLocalChatText("🛡".repeat(61)), /too long/);
});

test("C1 stores only unique, supported server messages with bounded memory", () => {
  const history = createLocalChatHistory(3);
  const event = (i) => ({ channel: "local", serverMessageId: String(i), sender: { displayName: "Traveler" }, text: "Hello" });
  assert.equal(history.push(event(1)), true);
  assert.equal(history.push(event(1)), false);
  assert.equal(history.push({ ...event(2), channel: "guild" }), false);
  assert.equal(history.push({ ...event(2), sender: null }), false);
  assert.equal(history.push(event(2)), true);
  assert.equal(history.push(event(3)), true);
  assert.equal(history.push(event(4)), true);
  assert.equal(history.size(), 3);
  assert.deepEqual(history.values().map(v=>v.serverMessageId), ["2", "3", "4"]);
  assert.equal(history.push(event(1)), true);
  assert.equal(history.size(), 3);
  assert.throws(() => createLocalChatHistory(1000));
});

test("C1 repeated server message IDs are independent across reconnect sessions", () => {
  const history = createLocalChatHistory(3);
  const message = (text, id = "1") => ({ channel: "local",
    serverMessageId: id, sender: {displayName: "Player #1"}, text });
  assert.equal(history.push(message("old session")), true);
  assert.equal(history.push(message("duplicate on old session")), false);
  history.beginSession();
  assert.equal(history.push(message("fresh session reuses id 1")), true);
  assert.equal(history.push(message("duplicate on new session")), false);
  assert.deepEqual(history.values().map(v => v.text),
    ["old session", "fresh session reuses id 1"]);
  assert.equal(history.push(message("new id", "2")), true);
  // Eviction of the old generation's id 1 must not clear the current
  // generation's distinct id 1 from the deduplication set.
  assert.equal(history.push(message("later", "3")), true);
  assert.equal(history.push(message("duplicate on new session again")), false);
  assert.deepEqual(history.values().map(v => v.text),
    ["fresh session reuses id 1", "new id", "later"]);
});

test("C1 does not allocate wire packet ids or optimistic backend", () => {
  const js = readFileSync(new URL("../src/browser/local-chat.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML|sendReliable\(|PACKET_TYPE/);
  assert.match(js, /clientMessageId/);
  assert.match(js, /serverMessageId/);
  assert.match(js, /Message not sent/);
  assert.match(js, /event\.key !== "Enter"/);
  assert.match(js, /generation !== sendGeneration/);
  assert.match(js, /cancelInflight/);
  assert.match(js, /input\.readOnly = pending/);
  assert.equal(CHAT_UI_LIMITS.history, 60);
  assert.equal(CHAT_UI_LIMITS.bytes, 240);
});

test("C1 bootstrap and real-client focus cleanup remain explicit", () => {
  const boot = readFileSync(new URL("../web/bootstrap.mjs", import.meta.url), "utf8");
  for (const path of ["game.mjs", "online-game.mjs"]) {
    const src = readFileSync(new URL("../web/" + path, import.meta.url), "utf8");
    assert.match(src, /canvas\.addEventListener\("blur", releaseInputs\)/);
    assert.match(src, /canvas\.addEventListener\("keydown",/);
  }
  assert.ok(boot.indexOf("installLocalChat(document") < boot.indexOf('await import("./online-game.mjs")'));
  assert.ok(boot.includes('online: params.has("server")'));
});
