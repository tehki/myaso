import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const root=new URL("../assets/environment/greyhaven/a232-review/",import.meta.url);
const sourceFile=new URL("../tools/art/build_red_lion_a232_ironwork.py",import.meta.url);
const validatorFile=new URL("../tools/art/verify_red_lion_a232_door_hinge_attachment.py",import.meta.url);
const report=JSON.parse(readFileSync(new URL("red_lion_a232_hinge_attachment_blender_report.json",root),"utf8"));
const art=JSON.parse(readFileSync(new URL("red_lion_a232_art_report.json",root),"utf8"));
const source=JSON.parse(readFileSync(new URL("red_lion_a232_blender_source.json",root),"utf8"));
const sha=path=>createHash("sha256").update(readFileSync(path)).digest("hex");
const overlap=(a,b,axis)=>Math.min(a[axis][1],b[axis][1])-Math.max(a[axis][0],b[axis][0]);

test("actual Blender source revised: both real forged straps cross original Red Lion wood",()=>{
 assert.equal(report.source,"Actual editable Blender 5.2 source mesh/world coordinates");
 assert.equal(report.blenderScene,"red_lion_a232_wrought_ironwork.blend");
 assert.equal(report.hingePiecesRepositioned,10);
 assert.equal(report.editableBlenderSourceModified,true);
 assert.equal(sha(new URL(report.blenderScene,root)),report.sourceBlendSha256);
 assert.equal(report.door.name,"Red Lion / door_front");
 assert.ok(Math.abs(report.door.frontY+2.03)<0.002);
 assert.ok(report.previousClosestFaceGapMeters>0.6);
 for(const z of ["lower","upper"]){
   const {strap,barrel,peens}=report.corrected[z];
   assert.ok(overlap(strap,report.door.worldBounds,1)>.005,z+" strap must intersect actual wood");
   assert.ok(overlap(barrel,report.door.worldBounds,1)>.005,z+" barrel must meet wood");
   assert.ok(overlap(strap,barrel,1)>.005,z+" barrel must meet strap in depth");
   assert.ok(overlap(strap,barrel,0)>.002,z+" barrel must meet strap at left edge");
   assert.equal(peens.length,3);
   for(const rivet of peens){
     assert.ok(overlap(rivet,strap,1)>.005,z+" rivet physically seated in iron strap");
     assert.ok(overlap(rivet,strap,0)>.005,z+" rivet has contact surface on strap");
   }
 }
});

test("derived .blend and original A2.30 Blender source integrity proven by actual hashes",()=>{
 assert.equal(art.originalSourceBlenderUnmodified,true);
 assert.equal(art.newOriginalIronMeshes,20);
 assert.equal(source.addedMeshes,20);
 assert.equal(source.objectNames.length,20);
 assert.equal(source.derivedSha256,report.sourceBlendSha256);
 assert.equal(art.roofByteIdentical,true);
 assert.equal(art.dayDuskAlphaIdentical,true);
 assert.equal(art.changedAlphaPixels,0);
 assert.equal(art.changedBoundaryAlphaPixels,0);
 assert.equal(art.gameRenderIntegrated,false);
 assert.equal(report.originalDoorRoofGeometryEdited,false);
 assert.equal(report.otherIronworkRepositioned,false);
});

test("source-only 2.5D render projection does not move the saved physical hinge geometry",()=>{
 const builder=readFileSync(sourceFile,"utf8");
 const validator=readFileSync(validatorFile,"utf8");
 assert.match(builder,/DOOR_FACE_Y=-2\.030/);
 assert.match(builder,/HINGE_STRAP_Y=DOOR_FACE_Y-\.015/);
 assert.match(builder,/HINGE_BARREL_Y=DOOR_FACE_Y-\.020/);
 assert.match(builder,/HINGE_PEEN_Y=DOOR_FACE_Y-\.045/);
 assert.match(builder,/bpy\.ops\.wm\.save_as_mainfile\(/);
 assert.match(builder,/if name\.startswith\(prefix\):/);
 assert.match(builder,/v\.x\+\.08/);
 assert.match(builder,/v\.y-lift\+\.648/);
 assert.match(builder,/v\.y-lift\+\.683/);
 assert.match(builder,/v\.y-lift\+\.716/);
 assert.ok(builder.indexOf("bpy.ops.wm.save_as_mainfile(")<builder.indexOf("def deform(v,name)"));
 assert.match(validator,/doorFrontY|frontY/);
 assert.match(validator,/overlaps\(peen,strap,1/);
});

test("actual unchanged roof, correct alpha and original game-ready day/dusk source files",()=>{
 const roof=new URL("red_lion_a232_roof_unchanged.webp",root);
 const oldroof=new URL("../a231-review/red_lion_a231_roof_unchanged.webp",root);
 assert.equal(sha(roof),sha(oldroof));
 assert.equal(sha(roof),art.roofSha256);
 for(const field of ["dayWebP","duskWebP"]){
   const item=art[field];
   assert.equal(sha(new URL(item.file,root)),item.sha256);
   assert.ok(item.bytes>10000);
 }
 assert.ok(art.changedRgbPixels>500);
});

test("revision remains art-only and does not activate game, actors, or server",()=>{
 assert.equal(report.serverOrGameplayEdited,false);
 assert.equal(report.artistApprovalPending,true);
 assert.equal(art.realFourPlayerAcceptance,false);
 assert.equal(art.releaseApproved,false);
 const client=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(client,/a232_(?:day|dusk)_ironwork/);
});
