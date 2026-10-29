import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = file => readFileSync(new URL("../"+file,import.meta.url),"utf8");
const publicClient = read("web/online-game.mjs");
const legacy = read("src/browser/left-button-charge.mjs");
const protocol = read("src/network/input-codec.mjs");
const server = read("server/src/main.rs");
const authority = read("server/src/prealpha_lmb_gesture_authority.rs");
const adapter = read("src/browser/prealpha-lmb-dom-gesture-review.mjs");
const spec = read("docs/COMBAT4_PUBLIC_INSTANT_LIGHT_CUTOVER_REVIEW_20261027.md");

test("explicitly DOCUMENT the live v1 release-to-strike blocker; do not pretend contract is accepted",()=>{
  assert.match(legacy,/LMB is a release-to-strike gesture/);
  assert.match(legacy,/const result = committed \? "committed" : elapsedMs >= chargeMs \? "heavy" : "light"/);
  assert.match(legacy,/if \(result === "heavy"\) onHeavy\(\);\s*else if \(result === "light"\) onLight\(\)/);
  assert.match(publicClient,/leftButtonCharge\.press\(event\.pointerId, \{/);
  assert.match(publicClient,/immediate: local\.action === COMBAT_ACTION\.jump/);
  assert.match(spec,/NOT IMPLEMENTED \/ NOT ACCEPTED/);
});

test("current v1 sample has no authentic unique LMB gesture source, so cannot be publicly relabeled",()=>{
  assert.match(protocol,/const SAMPLE_BYTES = 6/);
  assert.doesNotMatch(publicClient,/prealpha-lmb-gesture-proposal/);
  assert.match(spec,/never attach both listeners/);
});

test("dormant signed-lease source0 press begins REAL World LightWindup, upgrade is pre-contact only",()=>{
  assert.match(authority,/GestureAction::Press[\s\S]*?self\.phase = Phase::LightWindup;[\s\S]*?Command::BeginLightWindup/);
  assert.match(authority,/GestureAction::Upgrade[\s\S]*?self\.phase == Phase::LightWindup[\s\S]*?elapsed < LIGHT_WINDUP_MS/);
  assert.match(authority,/Phase::LightActive[\s\S]*?Command::None/);
  assert.match(spec,/before.*World adjudicates LightActive\/contact/);
});

test("heavy ready only by authoritative 320ms server time; an UP is required for Heavy",()=>{
  assert.match(authority,/const HEAVY_READY_MS: u64 = 320/);
  assert.match(authority,/Phase::HeavyCharging if elapsed >= HEAVY_READY_MS/);
  assert.match(authority,/Phase::HeavyReady[\s\S]*?Command::ReleaseHeavy/);
  assert.match(spec,/no Heavy hit before genuine UP/);
});

test("current typed gesture route stays review-only with public gate OFF",()=>{
  assert.match(adapter,/DORMANT REVIEW ONLY/);
  assert.match(adapter,/must \*replace\* legacy v1 LMB handling atomically/);
  assert.match(server,/MYASO_EXPERIMENTAL_GESTURE_V2/);
  assert.match(server,/experimental v2 gesture ingress is loopback-only/);
  assert.match(spec,/Separate owner approval is required for live activation/);
});
