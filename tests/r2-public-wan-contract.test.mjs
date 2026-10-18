import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../scripts/public_wan_smoke.py", import.meta.url), "utf8");

test("R2 WAN browser smoke uses public pinned WebTransport, native W3C input and bounded reporting", () => {
  assert.match(src, /ORIGIN = "https:\/\/game\.open-trust-layer\.org"/);
  assert.match(src, /"certificateSha256"/);
  assert.match(src, /"netstats": "1"/);
  assert.match(src, /"type": "key", "id": "public-smoke-keys"/);
  assert.match(src, /"type": "keyDown", "value": "w"/);
  assert.match(src, /"type": "keyUp", "value": "w"/);
  assert.match(src, /"DELETE"\)/);
  assert.match(src, /"remote_fighter_seen_in_scoreboard"/);
  assert.match(src, /12 <= args\.duration <= 60/);
  assert.doesNotMatch(src, /dispatchEvent|createEvent|new WebTransport|fakeSnapshot|setInterval/);
});

test("R2 WAN acceptance is read-only: no server/gameplay changes or implicit deployment", () => {
  assert.doesNotMatch(src, /systemctl|ssh |scp |gh run|git push|git reset|ufw /);
  const runtime = readFileSync(new URL("../src/browser/smooth-motion.mjs", import.meta.url), "utf8");
  assert.match(runtime, /maxCatchUpRate = 1\.45/);
});
