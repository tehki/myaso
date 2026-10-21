import test from "node:test";
import assert from "node:assert/strict";
import { authoritativeOnlineStatus } from "../src/browser/authoritative-status.mjs";

test("UI status follows actual received authoritative tick without any local simulation", () => {
  assert.equal(authoritativeOnlineStatus(2, 351), "Online - player #2 - server tick 351");
  assert.equal(authoritativeOnlineStatus(2, 1224), "Online - player #2 - server tick 1224");
  assert.equal(authoritativeOnlineStatus(2, 0), "Online - player #2 - server tick 0");
  assert.equal(authoritativeOnlineStatus(2, 0xffffffff), "Online - player #2 - server tick 4294967295");
});
test("UI status cannot be created from invalid authority, missing player or guessed ticks", () => {
  for (const [id, tick] of [[0, 10], [1, -1], [1, NaN], [1, Infinity],
    [1, 1.2], [1, undefined], [0x100000000, 1], [2, 0x100000000]]) {
    assert.equal(authoritativeOnlineStatus(id, tick), null);
  }
});
