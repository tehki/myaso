import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isChatC1PreviewEligible, activateChatC1Preview } from "../src/browser/chat-c1-activation.mjs";

function location(hostname, search = "?server=staging&chatC1Preview=1", protocol = "http:") {
  return { hostname, protocol, search };
}

test("C1B cannot be activated by remote website or default production path", () => {
  for (const loc of [
    location("myaso.io"), location("example.com"),
    location("127.0.0.1", ""), location("localhost", "?server=staging&chatC1Preview=0"),
    location("localhost", "?chatC1Preview=1"),
    location("localhost", "?chatC1Preview=1", "https:"),
  ]) assert.equal(isChatC1PreviewEligible(loc), false);
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    assert.equal(isChatC1PreviewEligible(location(host)), true);
  }
});

test("C1B blocked activation never calls Core or touches a remote page", async () => {
  let calls = 0;
  const result = await activateChatC1Preview({
    doc: { querySelector() {throw Error("should not touch DOM");} },
    location: location("myaso.io"),
    gameClient: { transport: { kind: "webtransport" } },
    openBridge() { calls++; throw Error("must not open"); },
  });
  assert.equal(result, null);
  assert.equal(calls, 0);
});

test("C1B integration requires existing game connection, no second WebSocket or combat changes", () => {
  const src = readFileSync(new URL("../src/browser/chat-c1-activation.mjs", import.meta.url), "utf8");
  const online = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  assert.match(src, /gameClient\?\.transport\?\.kind !== "webtransport"/);
  assert.match(src, /onDisconnect\(\)\s*\{\s*panel\.bindAdapter\(null\);/);
  assert.match(src, /bubbles\?\.clear\(\)/);
  assert.match(src, /onBubblesReady\(null\)/);
  assert.match(src, /adapter\.close\(\)/);
  assert.match(online, /void import\("\.\.\/src\/browser\/chat-c1-activation\.mjs"\)/);
  assert.match(online, /gameClient: networkClient/);
  assert.doesNotMatch(src, /new WebSocket\(|new WebTransport\(|sendReliable\(/);
});

test("C1B Core v1 and UI UTF-8 limits agree", async () => {
  const [{ CHAT }, { CHAT_UI_LIMITS, validateLocalChatText }] = await Promise.all([
    import("../src/network/chat-codec.mjs"),
    import("../src/browser/local-chat.mjs"),
  ]);
  assert.equal(CHAT.maxTextBytes, 240);
  assert.equal(CHAT_UI_LIMITS.bytes, CHAT.maxTextBytes);
  assert.equal(validateLocalChatText("é".repeat(120)).length, 120);
  assert.throws(() => validateLocalChatText("é".repeat(121)), /too long/);
});
