import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateLocalChatText, createLocalChatHistory, CHAT_UI_LIMITS } from "../src/browser/local-chat.mjs";

test("C1 message length, UTF-8 and control characters fail closed", () => {
  assert.equal(validateLocalChatText("  Greetings, traveler!  "), "Greetings, traveler!");
  for (const bad of ["", "  ", "x".repeat(281), "🛡️".repeat(260), "hello\u0000there", "\n"]) {
    assert.throws(() => validateLocalChatText(bad));
  }
  assert.equal(validateLocalChatText("🛡️ Guard the old mill."), "🛡️ Guard the old mill.");
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

test("C1 does not allocate wire packet ids or optimistic backend", () => {
  const js = readFileSync(new URL("../src/browser/local-chat.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML|sendReliable\(|PACKET_TYPE/);
  assert.match(js, /clientMessageId/);
  assert.match(js, /serverMessageId/);
  assert.match(js, /Message not sent/);
  assert.match(js, /event\.key !== "Enter"/);
  assert.equal(CHAT_UI_LIMITS.history, 60);
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
