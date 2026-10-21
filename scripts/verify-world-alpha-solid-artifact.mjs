// World Department 9 / First Playable Alpha: deterministic server-embeddable
// GEOMETRY DATA, never live zone/epoch/revision or a "complete" Physics window.
// Read-only default command verifies exact byte parity with authored source.
// --print is explicitly authoring output, not automatic runtime generation.
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {
 WORLD_ALPHA_SOLIDS_SCHEMA_VERSION,WORLD_ALPHA_SOLIDS_LAYOUT_ID,
 WORLD_ALPHA_PICKUP_GEOMETRY_SCOPE,WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS
} from "../src/world/alpha-solid-geometry.mjs";

export const WORLD_ALPHA_STATIC_ARTIFACT_PATH=
  "assets/world/greyhaven-alpha-solids-v1.json";

export function buildWorldAlphaStaticArtifact(){
 const solids=WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS;
 const digest=createHash("sha256")
  .update(JSON.stringify(solids),"utf8").digest("hex");
 // The fields below intentionally contain no "complete", server revision,
 // worker epoch, live zone/owner, auth session, pickup right or item ID.
 return Object.freeze({
  schema_version:WORLD_ALPHA_SOLIDS_SCHEMA_VERSION,
  layout_id:WORLD_ALPHA_SOLIDS_LAYOUT_ID,
  map_id:WORLD_ALPHA_PICKUP_GEOMETRY_SCOPE.mapId,
  city_id:WORLD_ALPHA_PICKUP_GEOMETRY_SCOPE.cityId,
  geometry_kind:WORLD_ALPHA_PICKUP_GEOMETRY_SCOPE.geometry,
  requires_core_fence:true,
  includes_river_or_dynamic_solids:false,
  solids_sha256:digest,
  solids_count:solids.length,
  solids
 });
}
export function serializeWorldAlphaStaticArtifact(){
 return JSON.stringify(buildWorldAlphaStaticArtifact(),null,2)+"\n";
}
export function verifyWorldAlphaStaticArtifact(raw){
 if(typeof raw!=="string")return false;
 // Byte-exact canonical shape prevents a checked-in artifact from drifting
 // or keeping valid-looking counts/digests while changing numeric obstacles.
 // Git on Windows may check out text JSON with CRLF; normalize ONLY those
 // line endings, never reorder entries or accept different values.
 return raw.replace(/\r\n/g,"\n")===serializeWorldAlphaStaticArtifact();
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const flags=process.argv.slice(2);
 if(flags.length===1&&flags[0]==="--print"){
  process.stdout.write(serializeWorldAlphaStaticArtifact());
 }else if(flags.length===0){
  try{
   const file=path.resolve(process.cwd(),WORLD_ALPHA_STATIC_ARTIFACT_PATH);
   const actual=readFileSync(file,"utf8");
   if(!verifyWorldAlphaStaticArtifact(actual))
    throw new Error("artifact differs from exact authored World solids");
   const manifest=buildWorldAlphaStaticArtifact();
   console.log("World P0 pinned solids PASS: "+manifest.solids_count+
    " AABBs; layout="+manifest.layout_id+
    "; sha256="+manifest.solids_sha256);
  }catch(error){
   console.error("World P0 pinned solids FAIL: "+error.message);
   process.exitCode=1;
  }
 }else{
  console.error("Usage: node scripts/verify-world-alpha-solid-artifact.mjs [--print]");
  process.exitCode=2;
 }
}
