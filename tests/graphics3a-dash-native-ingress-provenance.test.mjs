import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { COMBAT } from "../src/combat/model.mjs";
import { DASH_DOUBLE_TAP_MS, DASH_COOLDOWN_MS } from "../src/browser/dash-input.mjs";

const src=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
const flight=readFileSync(new URL("../scripts/graphics3a_dash_four_native_review.py",import.meta.url),"utf8");

test("Dash diagnostic is isolated to BOTH explicit review flags plus scenario, never default or normal acceptance",()=>{
 assert.match(src,/const dashReviewAuditEnabled = acceptanceScenario === "uidashreview"/);
 assert.match(src,/params\.get\("knights"\) === "1"/);
 assert.match(src,/params\.get\("knightDashArt"\) === "traction"/);
 assert.match(src,/if \(!dashReviewAuditEnabled\) return;/);
 assert.match(src,/dashIngressTrace/);
 assert.match(src,/if \(dashReviewAuditEnabled\)/);
});

test("Dash diagnostic captures real event recognition, eligibility and original transmitted input, never fabricates Dash",()=>{
 assert.match(src,/dashGesture\.press\(event\.code, performance\.now\(\), event\.repeat\)/);
 assert.match(src,/alreadyPressed:/);
 assert.match(src,/gestureRecognized:/);
 assert.match(src,/serverReady[,}\n]/);
 assert.match(src,/localAction:/);
 assert.match(src,/dashRequestQueued:/);
 assert.match(src,/dashSubmitted:/);
 assert.match(src,/networkClient\.sendInput\(\{ tick: outgoingTick, \.\.\.currentInput \}\)/);
 assert.doesNotMatch(src,/debug\.[a-zA-Z]+\.sendInput\(/);
 assert.equal(DASH_DOUBLE_TAP_MS,240);
 assert.equal(DASH_COOLDOWN_MS,3000);
 assert.equal(COMBAT.dash.durationMs,140);
});

test("authentic four-player flight fails closed when no server Dash, captures actual client ingress & send provenance",()=>{
 assert.match(flight,/scenario=uidashreview/);
 assert.match(flight,/dashIngressTrace/);
 assert.match(flight,/AUTHENTIC_DASH_INPUT_PROVENANCE/);
 assert.match(flight,/dashTick/);
 assert.match(flight,/Authentic production Dash double-tap deadline/);
 assert.match(flight,/Real trusted double tap never became authoritative Dash\(30\)/);
});
