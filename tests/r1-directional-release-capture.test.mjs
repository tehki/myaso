import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  captureLightAttackMovement, resolveLightAttackReleaseMovement,
} from "../src/browser/light-attack-movement.mjs";
import { COMBAT } from "../src/combat/model.mjs";

test("real W-strafe held on pointerDown survives early KeyW release before short LMB pointerUp",()=>{
  const press=captureLightAttackMovement(new Set(["KeyW"]));
  const release=captureLightAttackMovement(new Set());
  assert.deepEqual(resolveLightAttackReleaseMovement(release,press),{moveX:0,moveY:-1});
  assert.ok(COMBAT.directionalAttack.lateralThreshold<=1);
});

test("genuine release-held movement overrides press movement; neutral remains neutral",()=>{
  assert.deepEqual(resolveLightAttackReleaseMovement({moveX:0,moveY:1},{moveX:0,moveY:-1}),{moveX:0,moveY:1});
  assert.deepEqual(resolveLightAttackReleaseMovement({moveX:1,moveY:0},{moveX:0,moveY:-1}),{moveX:1,moveY:0});
  assert.deepEqual(resolveLightAttackReleaseMovement({moveX:0,moveY:0},null),{moveX:0,moveY:0});
  assert.deepEqual(resolveLightAttackReleaseMovement(null,{moveX:NaN,moveY:NaN}),{moveX:0,moveY:0});
});

test("native LMB records real movement on pointerdown and clears on all lifecycle exits",()=>{
  const online=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  assert.match(online,/leftButtonPressMovement = captureLightAttackMovement\(keys\)/);
  assert.match(online,/resolveLightAttackReleaseMovement\(\s*captureLightAttackMovement\(keys\), leftButtonPressMovement\)/);
  assert.match(online,/onHeavy\(\) \{ heavyAttackRequested = true; leftButtonPressMovement = null;/);
  // Matching pointerUP must release/categorize the genuine LMB gesture before
  // clearing its captured strafe. A stale pointerUP must not erase a newer
  // pointer's direction (directly exercised by the 4A cancel/release tests).
  const upStart = online.indexOf("function onLeftPointerUp(event) {");
  const upEnd = online.indexOf('canvas.addEventListener("pointerup", onLeftPointerUp);', upStart);
  assert.ok(upStart > 0 && upEnd > upStart);
  const up = online.slice(upStart, upEnd);
  const released = up.indexOf("leftButtonCharge.release(event.pointerId)");
  const staleGuard = up.indexOf("if (committed === null) return;");
  const movementCleared = up.indexOf("leftButtonPressMovement = null;");
  assert.ok(released >= 0 && staleGuard > released && movementCleared > staleGuard,
    "only the matching pointer release can clear captured attack direction");
  // PointerCancel may carry button=-1, and a stale pointerId MUST NOT clear
  // the movement captured by a newer genuine physical LMB press. The shared
  // pointer-scoped cancel checks charge ownership before clearing this state.
  assert.match(online,/function cancelActiveLeftPointer\(pointerId\) \{/);
  assert.match(online,/if \(!leftButtonCharge\.cancel\(pointerId\)\) return false;\s*leftButtonDown = false;\s*leftButtonPressMovement = null;/);
  assert.match(online,/canvas\.addEventListener\("pointercancel", \(event\) => \{[\s\S]*?cancelActiveLeftPointer\(event\.pointerId\)/);
  assert.match(online,/canvas\.addEventListener\("lostpointercapture", \(event\) => \{[\s\S]*?cancelActiveLeftPointer\(event\.pointerId\)/);
  assert.match(online,/leftButtonPressMovement = null;\s*leftButtonCharge\.cancel\(\);/);
  assert.doesNotMatch(online,/new KeyboardEvent|new PointerEvent|dispatchEvent\(/);
});
