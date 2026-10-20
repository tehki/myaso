// A2.14: investigate whether the lowest source skin-weighted vertex is a stable
// anchor across A3 poses. Never convert this proxy into game collision.
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,dirname,join} from "node:path";
const base=resolve("web/assets/knights");
const clips=["silver_roll","t1_roll"];
const samples=[];
for(const clip of clips){
  const json=JSON.parse(await readFile(join(base,"a213-review",clip+"_a213_skinned_foot_report.json"),"utf8"));
  if(json.originalSourceAssetsModified!==false||json.groundCollisionContactValidated!==false||
     json.authoritativeFloorZKnown!==false||json.a3PresentationScale!==1.2)
    throw Error("Cannot authorize contact calibration from inconsistent source provenance");
  const frames=json.sourcePhaseGeometry.map(p=>p.frame60fps);
  if(frames.join(",")!=="1,3,5,7,9,11,15,22")throw Error("Unexpected A3 source phases");
  const feet={};
  for(const side of ["LeftFoot","RightFoot"]){
    const phases=json.sourcePhaseGeometry.map(p=>p.meshFeet[side]);
    const indices=phases.map(p=>p.sourceVertexIndex);
    const unique=Array.from(new Set(indices));
    const changes=indices.slice(1).filter((index,i)=>index!==indices[i]).length;
    const minima=phases.map(p=>p.minimumWorldZ);
    const reference=json.referenceFloorProxyWorldZ;
    const clearance=minima.map(z=>Number((z-reference).toFixed(5)));
    feet[side]={
      minimumSourceVertexIndices:indices,
      uniqueMinimumVertexCount:unique.length,
      minimumVertexSwitchCount:changes,
      returnedToInitialMinimumVertex:indices.at(-1)===indices[0],
      frame1ReferenceClearanceProxyUnits:clearance,
      minimumSelectedVertexZ:minima,
      p10Z:phases.map(p=>p.p10WorldZ),
      midRollFrame7ClearanceProxyUnits:clearance[3],
      stableSingleVertexAcrossA3:unique.length===1
    };
  }
  samples.push({
    clip,sourceGLBSHA256:json.sourceGLBSHA256,
    sourceFrames60fps:frames,
    floorReferenceMethod:json.floorReference,
    floorIsKnownAuthoritative:false,
    feet,
    shouldAutoReanchorSprite:false,
    bootSoleIsolated:false,
    gameplayContactValidated:false
  });
}
const out={
  milestone:"Blood & Iron A2.14 lower-body anchor stability review",
  source:"A2.13 evaluated original GLB mesh vertex minima",
  visualScale:1.2,
  A3DurationMs:350,
  models:samples,
  authorizesGameplayFootPivot:false,
  authoritativeFloorContact:false,
  sourceAssetsChanged:false,
  deploymentApproved:false,
  caveat:"Across rolling poses the lowest foot-weighted vertex changes identity. Source-frame-1 vertex reference is a model-relative geometric proxy, not a sole/collider."
};
const outPath=resolve(process.argv[2]||join(base,"a214-review","knight_a214_anchor_stability.json"));
await mkdir(dirname(outPath),{recursive:true});
await writeFile(outPath,JSON.stringify(out,null,2)+"\n");
for(const model of samples){
  const data=Object.fromEntries(Object.entries(model.feet).map(([k,v])=>
    [k,{unique:v.uniqueMinimumVertexCount,switches:v.minimumVertexSwitchCount,
     midRollClearance:v.midRollFrame7ClearanceProxyUnits,
     returns:v.returnedToInitialMinimumVertex}]));
  console.log(model.clip,JSON.stringify(data));
}
