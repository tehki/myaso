import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("original myaso page actually owns the tested header, controls, HUD and game Canvas",()=>{
 const html=source("web/index.html"),css=source("web/styles.css");
 assert.match(html,/<canvas id="arena"/);
 assert.match(html,/class="masthead"/);
 assert.match(html,/class="controls"/);
 assert.match(html,/class="hud"/);
 assert.match(css,/canvas \{ display: block; width: 100%; height: auto;/);
 assert.match(css,/\.masthead \{ display: flex/);
});
test("equal-height browser QA drives native Chrome and Firefox without game authority",()=>{
 const probe=source("scripts/graphics3b_native_layout_parity.mjs");
 assert.match(probe,/nativeContentViewportMatches/);
 assert.match(probe,/nextNativeW3cWindowRect/);
 assert.match(probe,/window\/rect/);
 assert.match(probe,/browser\.name/);
 assert.match(probe,/getBoundingClientRect\(\)/);
 assert.match(probe,/screenshotSha256/);
 assert.match(probe,/fourAuthenticatedPlayers:false/);
 assert.match(probe,/originalRackRendered:false/);
 assert.match(probe,/worldOrItemWriterTouched:false/);
 assert.doesNotMatch(probe,/setPlayerPosition\(|TryPickup\(|scrollTo\(|scrollIntoView\(/);
});
test("both problematic short CSS viewports use identical measured native browser dimensions",()=>{
 const probe=source("scripts/graphics3b_native_layout_parity.mjs");
 assert.match(probe,/viewportTargets=Object\.freeze\(\[P0_CONTENT_VIEWPORT,Object\.freeze\(\{width:1366,height:682\}\)\]\)/);
 assert.match(probe,/for\(const target of viewportTargets\)result\.push\(await inspect\(browser,target\)\)/);
 assert.match(probe,/viewportTarget:target/);
 assert.match(probe,/sameCssViewport:true/);
 assert.match(probe,/await measureContentViewport\(browser,target\)/);
});

test("game-first candidate preserves all exact 14 source controls behind native details",()=>{
 const html=source("web/index.html");
 const css=source("web/styles.css");
 assert.match(html,/<details class="controls-disclosure">/);
 assert.match(html,/<summary>Controls · movement and combat<\/summary>/);
 assert.match(html,/<div class="controls" aria-label="Controls">/);
 const controls=html.match(/<div class="controls" aria-label="Controls">([\s\S]*?)<\/div>/)?.[1];
 assert.equal((controls?.match(/<span>/g)||[]).length,14);
 assert.match(css,/\.controls-disclosure > summary:focus-visible/);
 assert.match(css,/\.controls-disclosure > \.controls/);
 assert.match(css,/max-height: min\(72dvh, 540px\)/);
});
test("game-first candidate uses a real short-viewport media rule and uniform 16:9 ratio",()=>{
 const css=source("web/styles.css");
 assert.match(css,/@media \(max-height: 780px\) and \(min-width: 761px\)/);
 assert.match(css,/\.arena-wrap \{ width: min\(100%, calc\(\(100dvh - 220px\) \* 16 \/ 9\)\);/);
 assert.match(css,/\.hud \{ gap: 6px; margin-bottom: 6px; \}/);
 assert.match(css,/\.audio-controls \{ gap: 4px 6px; font-size: 11px; \}/);
 assert.doesNotMatch(css,/\.controls \{ display: none/);
});
test("candidate's actual W3C browser QA requires fully visible Canvas and opening/closing native details",()=>{
 const probe=source("scripts/graphics3b_native_layout_parity.mjs");
 assert.match(probe,/MYASO_P0_GAME_FIRST_LAYOUT/);
 assert.match(probe,/foldBudget\.canvasFullyInPage/);
 assert.match(probe,/GRAPHICS3B_P0_GAME_FIRST_LAYOUT_ACCEPT/);
 assert.match(probe,/\.controls-disclosure summary/);
 assert.match(probe,/opened\.items!==14/);
 assert.doesNotMatch(probe,/scrollTo\(|scrollIntoView\(|setPlayerPosition\(|sendTryPickup\(/);
});
