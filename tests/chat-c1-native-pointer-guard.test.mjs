import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("Chat C1 blocks arena pointer, chorded mouse and wheel at Window capture before Combat", () => {
 const s=readFileSync(new URL("../src/browser/local-chat.mjs",import.meta.url),"utf8");
 assert.match(s,/doc\.defaultView\?\.addEventListener\(type, fenceChatPhysicalEvent, captureOptions\)/);
 assert.match(s,/doc\.defaultView\?\.removeEventListener\(type, fenceChatPhysicalEvent, captureOptions\)/);
 assert.match(s,/const captureOptions = \{ capture: true, passive: false \}/);
 assert.match(s,/event\.target !== canvas/);
 assert.match(s,/doc\.activeElement !== input/);
 assert.match(s,/event\.stopImmediatePropagation\(\)/);
 assert.match(s,/canvas\.addEventListener\("keydown", onArenaKey, true\)/);
 for(const name of ["pointerdown","pointerup","mousedown","mouseup","wheel","contextmenu"]) {
   assert(s.includes('"' + name + '"'),name+" must be captured");
 }
});
test("Real Rust World browser acceptance covers original 4D physical first-red", () => {
 const s=readFileSync(new URL("../scripts/chat_c1_three_browser_acceptance.mjs",import.meta.url),"utf8");
 assert.match(s,/C1_REAL_WORLD_NATIVE_CHAT_POINTER_FOCUS_PASS/);
 assert.match(s,/type:"pointer",id:"c1-native-mouse"/);
 assert.match(s,/type:"wheel",id:"c1-native-wheel"/);
});
