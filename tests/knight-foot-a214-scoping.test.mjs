import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {KNIGHT_PRESENTATION_SCALE,KNIGHT_ROLL_PRESENTATION_MS} from "../web/knight-sprites.mjs";

const report=JSON.parse(readFileSync(new URL(
  "../web/assets/knights/a214-review/knight_a214_anchor_stability.json",
  import.meta.url),"utf8"));
const sourceHashes={
  silver_roll:"e4a263d480896fb1069ffc81e913e9aaa7324ff344611f5b69829cfee25c5d94",
  t1_roll:"b89432a621d1f0956b7c06449035e0a055d11b17d6ceb34c9b26264eadcb6aed"
};

test("A2.14 retains approved display while rejecting foot-vertex as game pivot",()=>{
  assert.equal(report.visualScale,KNIGHT_PRESENTATION_SCALE);
  assert.equal(report.A3DurationMs,KNIGHT_ROLL_PRESENTATION_MS);
  assert.equal(report.authorizesGameplayFootPivot,false);
  assert.equal(report.authoritativeFloorContact,false);
  assert.equal(report.sourceAssetsChanged,false);
  assert.equal(report.deploymentApproved,false);
  assert.deepEqual(report.models.map(m=>m.clip),["silver_roll","t1_roll"]);
});
test("A2.14 actual source foot minima change identities during forward-roll frames",()=>{
  const unique={silver_roll:[5,5],t1_roll:[6,7]};
  const mid={silver_roll:[.51808,.52461],t1_roll:[.31607,.40672]};
  for(const m of report.models){
    assert.equal(m.sourceGLBSHA256,sourceHashes[m.clip]);
    assert.deepEqual(m.sourceFrames60fps,[1,3,5,7,9,11,15,22]);
    assert.equal(m.floorReferenceMethod,"MIN_OF_FRAME_1_SKIN_WEIGHTED_FOOT_VERTICES_ONLY");
    assert.equal(m.floorIsKnownAuthoritative,false);
    assert.equal(m.shouldAutoReanchorSprite,false);
    assert.equal(m.bootSoleIsolated,false);
    assert.equal(m.gameplayContactValidated,false);
    for(const [i,side] of ["LeftFoot","RightFoot"].entries()){
      const f=m.feet[side];
      assert.equal(f.uniqueMinimumVertexCount,unique[m.clip][i]);
      assert.equal(f.minimumVertexSwitchCount,unique[m.clip][i]);
      assert.equal(f.stableSingleVertexAcrossA3,false);
      assert.equal(f.returnedToInitialMinimumVertex,true);
      assert.equal(f.minimumSourceVertexIndices.length,8);
      assert.equal(f.frame1ReferenceClearanceProxyUnits.length,8);
      assert.equal(f.minimumSelectedVertexZ.length,8);
      assert.equal(f.p10Z.length,8);
      assert.equal(f.midRollFrame7ClearanceProxyUnits,mid[m.clip][i]);
      assert.ok(f.minimumSelectedVertexZ.every(Number.isFinite));
      assert.ok(f.minimumSelectedVertexZ.every((z,n)=>z<=f.p10Z[n]));
      assert.ok(f.frame1ReferenceClearanceProxyUnits.every(Number.isFinite));
      assert.equal(f.minimumSourceVertexIndices[0],f.minimumSourceVertexIndices[7]);
    }
  }
});
test("A2.14 review is not imported by the game and does not assert real ground contact",()=>{
  const viewer=readFileSync(new URL("../web/knight-ground-a214-preview.mjs",import.meta.url),"utf8");
  const html=readFileSync(new URL("../web/knight-ground-a214-preview.html",import.meta.url),"utf8");
  assert.match(viewer,/authorizesGameplayFootPivot/);
  assert.match(viewer,/groundContactValidated:false/);
  assert.match(viewer,/physicalBootSoleValidated:false/);
  assert.match(html,/NOT a verified floor/);
  assert.doesNotMatch(viewer,/new WebSocket|localStorage|online-game|XMLHttpRequest/);
});
