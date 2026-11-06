import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(
  new URL("../.github/workflows/combat4-private-hit-native.yml", import.meta.url), "utf8");
const runner = readFileSync(
  new URL("../tools/art/main0_v2_knights_combat_four_native.mjs", import.meta.url), "utf8");

test("M147 private HIT retains historical mixed browsers and independently checks four branded Chrome Stable sessions", () => {
  assert.match(workflow, /acceptance: historical-mixed-engines\s+browsers: chrome,firefox,chrome,firefox/);
  assert.match(workflow, /acceptance: alpha02-four-google-chrome-stable\s+browsers: chrome,chrome,chrome,chrome/);
  assert.match(workflow, /MYASO_LIVE_GESTURE_NATIVE_BROWSERS: \$\{\{ matrix\.browsers \}\}/);
  assert.match(workflow, /max-parallel: 2/);
  assert.match(workflow, /case "\$chrome_version" in\s+"Google Chrome "\*\)/);
  assert.match(workflow, /MYASO_LIVE_GESTURE_SOURCE_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(workflow, /combat4-private-hit-native-\$\{\{ matrix\.acceptance \}\}-/);
});

test("M147 native proof keeps the original Rust private feature strictly opt-in and nonrelease", () => {
  assert.match(workflow, /MYASO_LIVE_GESTURE_PHYSICAL_MODE: private-hit/);
  assert.match(workflow, /cargo test --locked --manifest-path server\/Cargo\.toml --features experimental-hit-delivery-lab/);
  assert.match(workflow, /Four original browsers genuine LMB World HIT and participant-only private receipts/);
  assert.match(runner, /physicalMode==="private-hit"/);
  assert.match(runner, /MYASO_EXPERIMENTAL_HIT_DELIVERY_LAB:"1"/);
  assert.match(runner, /developerLoopbackOnly:true,publicNamespaceActivated:false,independentPhysicalHumanHosts:false/);
  assert.match(runner, /COMBAT4_PRIVATE_HIT_FOUR_NATIVE_WORLD_PASS/);
  assert.match(runner, /assert\.equal\(\(await privateProof\(a\)\)\.delivered\.length,a\.actor\.id<=2\?1:0\)/);
});
