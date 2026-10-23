import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {createHash} from "node:crypto";
const root=new URL("../docs/art/silver-dash-traction-review/",import.meta.url);
const u=(name)=>new URL(name,root);
const blob=(name)=>readFileSync(u(name));
const sha=(buf)=>createHash("sha256").update(buf).digest("hex");
test("authentic source dash has 8 by 8 timed transparent pose frames",()=>{
 const m=JSON.parse(blob("dash_traction_manifest.json"));
 assert.deepEqual(m.phaseSamplesMs,[0,10,26,45,72,96,119,140]);
 assert.equal(m.durationMs,140); assert.equal(m.directionRows,8); assert.equal(m.samplesPerRow,8);
 assert.deepEqual(m.atlasSizePx,[1280,1280]);
 assert(m.frameMinimumTransparentMarginPx>=4);
 assert.equal(m.genuineSourcePixelChangeFromFirstToMidPerDirection.length,8);
 assert(m.genuineSourcePixelChangeFromFirstToMidPerDirection.every(n=>n>90));
 for(const key of ["serverRootTranslation","runtimeEnabled","artApproved","realWorldFootContactValidated","originalKnightGlbRedistributed"]) assert.equal(m[key],false);
});
test("original and new original-source WebP/GIF SHA pinning",()=>{
 const m=JSON.parse(blob("dash_traction_manifest.json"));
 for(const x of [m.assets.newDash,m.assets.newGif]) assert.equal(sha(blob(x.name)),x.sha256);
 assert.equal(sha(blob("../silver-kick-dash-p0/silver_dash_p0.webp")),m.assets.oldDash.sha256);
 const fresh=blob("silver_dash_traction_p0.webp");
 assert.equal(fresh.toString("ascii",0,4),"RIFF");
 assert.equal(fresh.toString("ascii",8,12),"WEBP");
 assert(statSync(u("Graphics3A_Silver_Dash_Traction_action_source.blend")).size>30000);
});
test("standalone review embeds both source atlases with no remote fetch",()=>{
 const html=blob("silver_dash_traction_review_offline.html").toString("utf8");
 assert.equal(html.match(/data:image\/webp;base64,/g)?.length,2);
 assert(html.includes("requestAnimationFrame"));
 assert(!/<script\s+src=/.test(html));
 assert(!/<img\s+[^>]*src=["']https?:/i.test(html));
});
test("private owner GLB provenance and all actual Blender PNG sample records",()=>{
 const r=JSON.parse(blob("dash_traction_blender_bake_report.json"));
 assert.equal(r.sourceRigBones,22);
 assert.equal(r.sourceSha256,"d679fccd00df868d600b4c5e2fcf8a4a46cc062dbd432be5b6a7f533eb30141f");
 assert.equal(r.rendered.length,64);
 assert.equal(new Set(r.rendered.map(f=>String(f.direction)+":"+String(f.phase))).size,64);
 assert.equal(r.originalArtReplaced,false);assert.equal(r.trueServerEvent,false);assert.equal(r.humanVisualApproved,false);
});