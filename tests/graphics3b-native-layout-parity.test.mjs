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
