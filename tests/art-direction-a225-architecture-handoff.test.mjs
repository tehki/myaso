import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";

const root=new URL("../",import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),"utf8"));
const sha=path=>createHash("sha256").update(readFileSync(new URL(path,root))).digest("hex");
const contract=read("assets/environment/greyhaven/red-lion-a225-architecture-handoff.json");
const art=read("assets/environment/greyhaven/art-manifest.v1.json");
const geo=read("assets/environment/greyhaven/a222-review/greyhaven_a222_geometry_report.json");
const raster=read("assets/environment/greyhaven/a224-review/greyhaven_a224_webp_report.json");
const facade=read("assets/environment/greyhaven/a224-review/greyhaven_a224_facade_report.json");
const browser=read("assets/environment/greyhaven/a224-review/greyhaven_a224_real_chrome_report.json");

test("A2.25 Red Lion visual handoff uses World proposal without promoting it to authority",()=>{
 assert.equal(contract.schemaVersion,1);
 assert.equal(contract.kind,"architecture-visual-handoff");
 assert.equal(contract.buildingId,art.firstSlice.approvedBuilding.id);
 assert.equal(contract.visualPrefab,art.firstSlice.approvedBuilding.visualPrefab);
 assert.equal(contract.status,"unapproved-art-review");
 assert.equal(contract.provenance.worldProposalPr,336);
 assert.equal(contract.provenance.worldProposalUnmerged,true);
 assert.equal(contract.provenance.originalBlenderScene,
  "assets/environment/greyhaven/a22-review/"+geo.sourceScene);
 const proposal=art.firstSlice.approvedBuilding;
 assert.deepEqual(contract.proposedWorldPlacement.exterior,proposal.exterior);
 assert.deepEqual(contract.proposedWorldPlacement.door, {
  ...proposal.door,status:"proposed-visual-anchor-only"
 });
 const {exterior,door}=contract.proposedWorldPlacement;
 assert.equal(door.x,exterior.x+exterior.width/2);
 assert.equal(door.y-exterior.y-exterior.height,
  contract.proposedWorldPlacement.doorOffsetFromExteriorSouthEdgeWorldUnits);
 assert.equal(contract.proposedWorldPlacement.doorOffsetFromExteriorSouthEdgeWorldUnits,25);
 for(const value of Object.values(contract.integrationGate)){
  assert.equal(typeof value,"boolean");
 }
 assert.deepEqual(contract.integrationGate,{
  visualPreviewOnly:true,automaticRoofOcclusionImplemented:false,
  authoritativePortalOrCollisionImplemented:false,
  multiplayerInteriorAccepted:false,productionApproved:false
 });
});

test("A2.25 camera projection and proposed visual door stay deterministic",()=>{
 const p=contract.projection,door=contract.proposedWorldPlacement.door;
 assert.equal(p.module,art.coordinateConvention.cameraSource);
 assert.equal(p.cameraZoom,ARENA_VIEW_ZOOM);
 assert.equal(p.metersPerWorldUnit,art.coordinateConvention.metersPerWorldUnit);
 assert.deepEqual(p.visualDoorCanvasPx,geo.visualDoorAnchorPixels);
 assert.deepEqual(p.reviewCanvasPx,geo.canvasPx);
 assert.deepEqual(p.groundBasisPixelsPerSourceMeter,
  geo.groundBasisPixelsPerSourceMeter);
 assert.deepEqual([door.x,door.y],geo.proposedDoorGameXY);
 const x=120,y=-80,at=projectArenaPoint(
  door.x+x,door.y+y,door.x,door.y,...p.reviewCanvasPx);
 const estimated=[
  p.visualDoorCanvasPx[0]+p.metersPerWorldUnit*(p.groundBasisPixelsPerSourceMeter.x[0]*x+p.groundBasisPixelsPerSourceMeter.y[0]*y),
  p.visualDoorCanvasPx[1]+p.metersPerWorldUnit*(p.groundBasisPixelsPerSourceMeter.x[1]*x+p.groundBasisPixelsPerSourceMeter.y[1]*y)
 ];
 assert.ok(Math.hypot(at.x-estimated[0],at.y-estimated[1])<0.001);
 assert.deepEqual([at.x,at.y],[420.8,252.8]);
});

test("A2.25 facade/roof package bytes, crop and offsets match actual A2.24 assets",()=>{
 assert.equal(raster.productionApproved,false);
 for(const part of ["base","roof"]){
  const handed=contract.rasterLayers[part],original=raster.layers[part];
  assert.equal(handed.file,
   "assets/environment/greyhaven/a224-review/"+original.file);
  assert.equal(handed.sha256,original.sha256);
  assert.equal(sha(handed.file),original.sha256);
  assert.deepEqual(handed.croppedPixels,original.croppedPixels);
  assert.deepEqual(handed.drawOffsetFromVisualDoorPixels,
   original.drawOffsetFromVisualDoorPixels);
  assert.equal(original.roundtripExactRGBA,true);
  assert.equal(original.flippedIntoGamePositiveYDown,true);
 }
 assert.deepEqual(contract.rasterLayers.base.alphaBoundsCanvasPx,
  facade.newFacadeAlphaBounds);
 assert.deepEqual(contract.rasterLayers.roof.alphaBoundsCanvasPx,
  browser.atDoor.versions.refined.roofAlphaBounds);
 assert.equal(contract.sourceProof.facadeRgbPixelsChanged,
  facade.originalFacePixelColorsChanged);
 assert.equal(contract.sourceProof.facadeAlphaPixelsChanged,
  browser.facadePixelComparison.alphaPixelDifferences);
 assert.equal(contract.sourceProof.roofBinaryUnchangedFromA222,
  facade.roofBinaryIdenticalToA222);
 assert.equal(contract.sourceProof.groundVerticesMovedXY,
  geo.geometry.maxGroundXYDrift);
 assert.equal(contract.sourceProof.proposedDoorVisualAnchorChanged,false);
 assert.equal(geo.actualAuthoritativeDoorOrCollisionApproved,false);
 assert.equal(browser.roofOcclusionValidatedInActualGame,false);
 assert.equal(browser.actualAuthoritativeEntranceValidated,false);
});
