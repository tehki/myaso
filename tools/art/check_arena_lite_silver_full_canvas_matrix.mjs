// Graphics 3C/3A strict original-Rust eight real-browser evidence validator.
// Does not assert four independent humans, GPU present, all animations or Combat.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";

const [normalDir,invertedDir]=process.argv.slice(2);
assert.ok(normalDir&&invertedDir,"two separate original Rust+W3C native matrix evidence directories required");
const expectedEngines=(process.env.MYASO_ARENA_LITE_NATIVE_BROWSERS||"chrome,firefox,chrome,firefox").split(",");
assert.equal(expectedEngines.length,4);
const sha=b=>createHash("sha256").update(b).digest("hex");
const check=(folder,inverted)=>{
  const r=JSON.parse(readFileSync(join(folder,"arena-lite-original-game-native.json"),"utf8"));
  assert.equal(r.actualRustWebTransport,true,"real original WebTransport required");
  assert.equal(r.actualOriginalClient,true);
  assert.equal(r.realSeparateNativeBrowserProcesses,4);
  assert.equal(r.independentPhysicalHumanHosts,false,"four browsers are not four humans");
  assert.equal(r.trueFourIndependentHumanOperators,false);
  assert.equal(r.authenticSilverKnightIntegrationVerified,true);
  assert.equal(r.allFiveClipsVisuallyValidated,false,"only observed actual Silver source clips, not all five");
  assert.equal(r.inverseFloorMatrix,inverted);
  assert.equal(r.modeIsOptional,true);
  assert.equal(r.defaultArenaPreserved,true);
  assert.equal(r.genuineFullCombatApproval,false);
  assert.equal(r.trials.length,4);
  for(let i=0;i<4;i++){
    const t=r.trials[i],expected=(i%2===0)!==inverted?"lite":"grid";
    assert.equal(t.browser,expectedEngines[i]);
    assert.equal(t.actorId,i+1);
    assert.equal(t.mode,expected);
    assert.equal(t.data.canvasWidth,960);assert.equal(t.data.canvasHeight,540);
    assert.equal(t.data.knightsFlag,"1");
    assert.equal(t.data.knightArt,"relit");
    assert.ok(t.data.knightWebPDraws>=8);
    assert.ok(Object.keys(t.data.knightSources).some(x=>/^silver_.*_relit\.webp$/.test(x)),
      "original Blender Silver WebP draw receipts required in each actual browser");
    assert.ok(t.data.roster.length>=4,"four original server actor IDs must remain visible");
    assert.ok(t.data.frames>=12);
    assert.ok(Number.isFinite(t.data.frameIntervalP50Ms)&&t.data.frameIntervalP50Ms>=0);
    assert.ok(Number.isFinite(t.data.frameIntervalP95Ms)&&t.data.frameIntervalP95Ms>=t.data.frameIntervalP50Ms);
    const full=readFileSync(join(folder,t.fullCanvasScreenshot));
    assert.equal(full.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    assert.equal(full.readUInt32BE(16),960);
    assert.equal(full.readUInt32BE(20),540);
    assert.equal(full.length,t.fullCanvasBytes);
    assert.ok(full.length>1500);
    assert.equal(sha(full),t.fullCanvasSha256);
    const page=readFileSync(join(folder,t.screenshot));
    assert.equal(sha(page),t.pngSha256);
  }
  return r;
};
const a=check(normalDir,false),b=check(invertedDir,true);
assert.equal(a.sourceCommit,b.sourceCommit,"exact same real source commit for both runs");
for(let i=0;i<4;i++){
  assert.equal(a.trials[i].browser,b.trials[i].browser);
  assert.notEqual(a.trials[i].mode,b.trials[i].mode);
  const lite=a.trials[i].mode==="lite"?a.trials[i]:b.trials[i];
  const grid=a.trials[i].mode==="grid"?a.trials[i]:b.trials[i];
  assert.ok(lite.data.floor.centerLuminance-grid.data.floor.centerLuminance>12,
    "actual original grid vs opt-in earth/cobble must differ in real same-source game");
}
console.log("ARENA_LITE_SILVER_FULL_CANVAS_MATRIX_PASS "+JSON.stringify({
 exactHead:a.sourceCommit,nativeSessions:8,distinctOriginalWorlds:2,
 engines:expectedEngines,independentHumans:false,realSilverWebPSource:true,
 allFiveClipsNotEstablished:true,fullProtectedQualityNotImplied:true,
 positions:a.trials.map((x,i)=>({browser:x.browser,slot:i+1,
   gridP50Ms:(x.mode==="grid"?x:b.trials[i]).data.frameIntervalP50Ms,
   gridP95Ms:(x.mode==="grid"?x:b.trials[i]).data.frameIntervalP95Ms,
   liteP50Ms:(x.mode==="lite"?x:b.trials[i]).data.frameIntervalP50Ms,
   liteP95Ms:(x.mode==="lite"?x:b.trials[i]).data.frameIntervalP95Ms
 }))}));
