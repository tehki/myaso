// Graphics 3C / Moon Games FIRST PLAYABLE (P0) non-invasive visual integration guard.
// Tests the existing online entry at source level: it never emulates the server,
// opens network connections, enables preview portals, or bypasses Combat CI.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {MAP_IDS} from "../src/world/authored-maps.mjs";
import {
  WORLD_CACHE_CAP,WORLD_TILE_SIZE,createAuthoredWorldRenderer
} from "../src/browser/authored-world-renderer.mjs";

const online=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
const preview=readFileSync(new URL("../web/world-preview.html",import.meta.url),"utf8");
const renderFile=readFileSync(new URL("../src/browser/authored-world-renderer.mjs",import.meta.url),"utf8");

test("P0 online world flag: actual source predicate defaults off and rejects scenario overlays",()=>{
  const match=online.match(/\bconst fixedWorldEnabled\s*=\s*([^;]+);/);
  assert.ok(match,"find exact online opt-in predicate; fail closed on upstream contract changes");
  const predicate=match[1];
  const cases=[
    ["",false],["world=0",false],["world=1",true],
    ["world=01",false],["world=true",false],
    ["world=1&scenario=",false],
    ["world=1&scenario=uiguardbreak",false],
    ["world=1&scenario=uimultirecoveryffa",false],
    ["scenario=uiguardbreak",false],["world=1&netstats=1",true],
  ];
  for(const [query,expected] of cases){
    const params=new URLSearchParams(query);
    // Only execute the extracted pure Boolean expression in a sandbox.
    const actual=vm.runInNewContext(predicate,{params},{timeout:200});
    assert.equal(actual,expected,"online visual opt-in differs for "+(query||"(default)"));
  }
  assert.match(online,/const authoredWorld = fixedWorldEnabled \? createAuthoredWorldRenderer\(\) : null;/);
});

test("P0 combat rendering: authored World is behind remote/local fighters and HUD",()=>{
  const start=online.indexOf("if (authoredWorld && local.initialized) {");
  const world=online.indexOf("authoredWorld.draw(ctx, MAP_IDS.overworld",start);
  const remote=online.indexOf("for (const entity of networkClient.state.values())",world);
  const own=online.indexOf("drawFighterScreen(",remote);
  const restore=online.indexOf("ctx.restore();",own);
  const hud=online.indexOf("drawRemoteVitals(",restore);
  assert.ok(start>=0&&world>start&&remote>world&&own>remote
    &&restore>own&&hud>restore,"world→fighters→HUD original layering must survive");
  assert.match(online,/ctx\.scale\(ARENA_VIEW_ZOOM, ARENA_VIEW_ZOOM\)/);
  assert.match(online,/authoredWorld\.draw\(ctx, MAP_IDS\.overworld, visualCameraPosition,/);
  assert.match(online,/if \(authoredWorld && local\.initialized\)/);
});

test("P0 preview-only doors: no local map teleport or portal imports in online game",()=>{
  assert.doesNotMatch(online,/previewPortalDestination|nearbyAuthoredPortal/);
  assert.match(preview,/LOCAL DESIGN PREVIEW/);
  assert.match(preview,/nearbyAuthoredPortal\(mapId,player\.x,player\.y,16\)/);
  assert.match(preview,/if\(e\.code==="KeyE"/);
  assert.match(online,/if \(!server\) throw new Error\("online mode requires/);
});

test("P0 visual painter: bounded tile allocation, and no independent runtime timer",()=>{
  assert.equal(WORLD_TILE_SIZE,512);
  assert.equal(WORLD_CACHE_CAP,24);
  let allocated=0;
  const fakeContext={
    save(){},restore(){},translate(){},fillRect(){},strokeRect(){},
    beginPath(){},moveTo(){},lineTo(){},arc(){},ellipse(){},fill(){},stroke(){},fillText(){}
  };
  const painter=createAuthoredWorldRenderer({makeCanvas(){
    allocated++;
    return {width:0,height:0,getContext:()=>fakeContext};
  }});
  const screen={fillRect(){},drawImage(){}};
  for(let i=0;i<30;i++){
    painter.draw(screen,MAP_IDS.overworld,{x:3350+i*125,y:4050},960,540,1);
    assert.ok(painter.stats.created<=3,"per-frame tile allocation limit");
    assert.ok(painter.stats.cached<=24,"bounded tile cache");
  }
  assert.ok(allocated>0);
  painter.clear();
  assert.equal(painter.stats.cached,0);
  assert.doesNotMatch(renderFile,/setInterval\s*\(|setTimeout\s*\(|requestAnimationFrame\s*\(/);
});
