import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
import {
  ORIGINAL_RED_LION_ART, ORIGINAL_RED_LION_WORLD_ANCHOR,
  createOriginalRedLionLiveArt, redLionActorHudVisible,
} from "../src/browser/red-lion-live-art.mjs";
import {MAP_IDS} from "../src/world/authored-maps.mjs";
import {worldBuildingPresentation,normalizeWorldBuildingReplacementIds} from "../src/world/building-presentation.mjs";

const here=dirname(fileURLToPath(import.meta.url));
const client=readFileSync(resolve(here,"../web/online-game.mjs"),"utf8");

test("Graphics 3B original Blender Red Lion day, dusk and roof image bytes remain SHA-authentic",()=>{
  for(const [key,meta] of Object.entries(ORIGINAL_RED_LION_ART)){
    const source=readFileSync(resolve(here,"../assets/environment/greyhaven/a232-review",meta.name));
    assert.equal(createHash("sha256").update(source).digest("hex"),meta.sha256,key);
    assert.ok(source.length>8000);
    assert.ok(meta.width>0&&meta.height>0);
  }
  assert.deepEqual(ORIGINAL_RED_LION_WORLD_ANCHOR,
    {x:4365,y:4075,facadeDx:-114,facadeDy:-269,roofDx:-119,roofDy:-283});
});

test("existing World9 authorizes precisely the Red Lion, not Smith gameplay or visual replacement",()=>{
  const p=worldBuildingPresentation(MAP_IDS.overworld,"red-lion",[{x:4286,y:4070,netId:1}]);
  assert.equal(p.visualDepthY,4075);
  assert.deepEqual(p.gameplayEntrance,{x:4365,y:4060});
  assert.deepEqual(normalizeWorldBuildingReplacementIds(MAP_IDS.overworld,["red-lion"]),["red-lion"]);
  assert.throws(()=>normalizeWorldBuildingReplacementIds(MAP_IDS.overworld,["smith"]),RangeError);
  assert.equal(worldBuildingPresentation(MAP_IDS.overworld,"smith",[]),null);
});

test("untrusted Red Lion asset fails closed before World9 placeholder suppression",async()=>{
  let makeWorldCalls=0;
  const art=createOriginalRedLionLiveArt({
    fetchBytes:async()=>new ArrayBuffer(0),
    decode:async()=>({width:228,height:297}),
    makeCanvas:()=>({}),
    makeWorld:()=>{makeWorldCalls++;return{};},
  });
  assert.equal(await art.load(),false);
  assert.equal(art.state().phase,"failed");
  assert.equal(makeWorldCalls,0);
  assert.equal(art.prepare({x:4365,y:4075},960,540,0.84),null);
});

test("Red Lion actor visual depth affects only facade-covered actors and HUD",()=>{
  const fake={behindFacade:a=>a.x>=4240&&a.x<=4490&&a.y<4075};
  assert.equal(redLionActorHudVisible(fake,null,{x:4286,y:4070}),true);
  assert.equal(redLionActorHudVisible(fake,{}, {x:4286,y:4070}),false);
  assert.equal(redLionActorHudVisible(fake,{}, {x:4286,y:4134}),true);
  assert.equal(redLionActorHudVisible(fake,{}, {x:3300,y:3850}),true);
});

test("real Silver/Chat client loads original Blender Red Lion only behind explicit Triple P1 opt-in",()=>{
  assert.match(client,/greyhavenPreviewRequested && params\.get\("redlion"\) === "1"/);
  assert.match(client,/import\("\.\.\/src\/browser\/red-lion-live-art\.mjs"\)/);
  assert.doesNotMatch(client,/^import .*red-lion-live-art/m);
  assert.match(client,/params\.get\("dusk"\) === "1" \? "dusk" : "day"/);
  assert.match(client,/redLionPreview\.art\.prepare\(visualCameraPosition/);
  assert.match(client,/redLionPreview\.draw\(ctx, redLionFrame\.world/);
  assert.match(client,/redLionPreview\.draw\(ctx, redLionFrame\.facade/);
  assert.match(client,/redLionPreview\.art\.behindFacade\(sampled\)/);
  assert.match(client,/redLionActorsInFront\.push/);
  assert.match(client,/chatBubbleController\?\.frame\(/);
  const idxBehind=client.indexOf('const inFront = !redLionFrame');
  const idxFacade=client.indexOf('redLionPreview.draw(ctx, redLionFrame.facade');
  const idxFront=client.indexOf('for (const {sampled, damageTell, recoveryTell} of redLionActorsInFront)');
  assert.ok(idxBehind>0 && idxFacade>idxBehind && idxFront>idxFacade);
});
