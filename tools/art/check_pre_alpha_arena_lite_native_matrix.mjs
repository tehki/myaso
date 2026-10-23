// Fail-closed validation of TWO genuine exact-source original-Rust four-browser
// native runs with opposite flag polarity. This checks test evidence, never
// asserts Silver artwork or multiplayer humans not actually included here.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
const [normalDir,invertedDir]=process.argv.slice(2);
const expectedEngines=(process.env.MYASO_ARENA_LITE_NATIVE_BROWSERS||"chrome,firefox,chrome,firefox").split(",");
assert.equal(expectedEngines.length,4);
assert.ok(normalDir&&invertedDir,"normal and inverted real native output directories are required");
const sha=b=>createHash("sha256").update(b).digest("hex");
function validate(folder,shouldInvert){
  const r=JSON.parse(readFileSync(join(folder,"arena-lite-original-game-native.json"),"utf8"));
  assert.equal(r.actualRustWebTransport,true);
  assert.equal(r.actualOriginalClient,true);
  assert.equal(r.realSeparateNativeBrowserProcesses,4);
  assert.equal(r.independentPhysicalHumanHosts,false);
  assert.equal(r.authenticSilverKnightIntegrationVerified,false);
  assert.equal(r.modeInverted,shouldInvert);
  assert.equal(r.trials.length,4);
  for(let i=0;i<4;i++){
    const t=r.trials[i],expected=(i%2===0)!==shouldInvert?"lite":"grid";
    assert.equal(t.actorId,i+1);
    assert.equal(t.mode,expected);
    assert.equal(t.browser,expectedEngines[i]);
    assert.equal(t.data.canvasWidth,960);
    assert.equal(t.data.canvasHeight,540);
    assert.ok(t.data.frames>=12);
    assert.ok(Number.isFinite(t.data.frameIntervalP50Ms)&&t.data.frameIntervalP50Ms>=0);
    assert.ok(Number.isFinite(t.data.frameIntervalP95Ms)&&t.data.frameIntervalP95Ms>=t.data.frameIntervalP50Ms);
    const full=readFileSync(join(folder,t.fullCanvasScreenshot));
    assert.equal(full.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    assert.equal(full.readUInt32BE(16),960);
    assert.equal(full.readUInt32BE(20),540);
    assert.equal(sha(full),t.fullCanvasSha256);
    assert.equal(full.length,t.fullCanvasBytes);
    assert.ok(full.length>1500);
    const page=readFileSync(join(folder,t.screenshot));
    assert.equal(sha(page),t.pngSha256);
  }
  return r;
}
const a=validate(normalDir,false),b=validate(invertedDir,true);
assert.equal(a.sourceCommit,b.sourceCommit,"compare exactly the same original source bytes");
for(let i=0;i<4;i++){
  assert.equal(a.trials[i].browser,b.trials[i].browser);
  assert.notEqual(a.trials[i].mode,b.trials[i].mode);
  const lite=a.trials[i].mode==="lite"?a.trials[i]:b.trials[i];
  const grid=a.trials[i].mode==="grid"?a.trials[i]:b.trials[i];
  assert.ok(lite.data.floor.centerLuminance-grid.data.floor.centerLuminance>12,
    "actual unchanged original vs optional arena Canvas source must be measurably different");
}
console.log("ARENA_LITE_FULL_CANVAS_MATRIX_PASS "+JSON.stringify({
  exactHead:a.sourceCommit,nativeSessions:8,distinctServerWorlds:2,
  independentPhysicalHumanHosts:false,silverSpritesNotVerified:true,
  pairedByBrowserPosition:a.trials.map((x,i)=>({browser:x.browser,actorSlot:i+1,
    gridP50Ms:(x.mode==="grid"?x:b.trials[i]).data.frameIntervalP50Ms,
    gridP95Ms:(x.mode==="grid"?x:b.trials[i]).data.frameIntervalP95Ms,
    liteP50Ms:(x.mode==="lite"?x:b.trials[i]).data.frameIntervalP50Ms,
    liteP95Ms:(x.mode==="lite"?x:b.trials[i]).data.frameIntervalP95Ms}))}));
