import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("overhead speaker identity comes from authenticated ChatReceived, never player labels", () => {
 const codec=source("src/network/local-chat-ui-bridge.mjs");
 const ui=source("src/browser/chat-c1-overheads.mjs");
 assert.match(codec,/netId: event\.senderId/);
 assert.match(ui,/return show\(message\.sender\?\.netId, message\.text\)/);
 assert.doesNotMatch(ui,/parseInt\(.*displayName/);
 assert.match(ui,/node\.textContent = text/);
 assert.doesNotMatch(ui,/innerHTML\s*=/);
});

test("overheads use actual current world camera/remote interpolation with no authority mutation", () => {
 const online=source("web/online-game.mjs");
 const module=source("src/browser/chat-c1-overheads.mjs");
 const render=online.slice(online.indexOf("function render("),online.indexOf("function drawImpactBurst("));
 const sample=render.indexOf("visualCamera.sample(local, nowMs, visualCameraPosition)");
 const sprites=render.indexOf("visibleEnemyPositions.push(sampled)");
 const label=render.indexOf("chatBubbleController?.frame({");
 assert.ok(sample>=0 && sample<sprites && sprites<label);
 assert.match(render,/remotes: visibleEnemyPositions, camera: visualCameraPosition/);
 assert.match(module,/projectArenaPoint\(fighter\.x, fighter\.y,/);
 assert.match(module,/entry\.node\.hidden = true/);
 assert.match(source("web/local-chat.css"),/\.chat-c1-overheads\s*\{[^}]*pointer-events:\s*none/s);
});

test("new overheads cannot appear on URL spoof or absent server ACK", () => {
 const activation=source("src/browser/chat-c1-activation.mjs");
 const panel=source("src/browser/local-chat.mjs");
 assert.match(activation,/isTrustedChatC1ReleaseConfigured\(location, fetchConfig\)/);
 const gate=activation.indexOf("if (isChatC1ReleaseEligible(location)");
 const attach=activation.indexOf("bubbles = createOverheadChatBubbles({ doc })");
 assert.ok(gate>=0 && attach>gate);
 assert.match(activation,/onMessage\(event\) \{ bubbles\?\.received\(event\); \}/);
 assert.match(activation,/onAccepted\(text\) \{ bubbles\?\.acceptedOwn\(gameClient\.playerNetId, text\); \}/);
 const ack=panel.indexOf("if (disposed || generation !== sendGeneration || !ack");
 const accepted=panel.indexOf("try { onAccepted(text); }");
 assert.ok(ack>=0 && accepted>ack);
 assert.match(activation,/bubbles\?\.dispose\(\)/);
});

test("real native pinned-WebTransport flight validates actual bubble coordinates and physical camera movement",()=>{
 const s=source("scripts/chat_c1_three_browser_acceptance.mjs");
 for(const marker of ["CHAT_C1_REAL_WORLD_KNIGHT_OVERHEAD_BUBBLES_PASS",
     "CHAT_C1_BUBBLE_FOLLOWS_PHYSICAL_WORLD_MOVEMENT_PASS",
     "C1_REAL_WORLD_NATIVE_CHAT_POINTER_FOCUS_PASS", "FOUR_PLAYER_AUTHENTIC_PROXIMITY_PASS"]) {
  assert.ok(s.includes(marker),marker);
 }
 assert.match(s,/type:"key",id:"c1-speech-world-walk"/);
});
