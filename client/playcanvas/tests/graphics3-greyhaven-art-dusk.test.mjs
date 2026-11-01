import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {BLACKSMITH_R4, smithVisualPlacement} from '../src/scene/original-blacksmith-r4.js';
import {
  GREYHAVEN_VISUAL_BUDGET, greyhavenLook, smokePlan,
  redLionSmokeAnchor, blacksmithSmokeAnchor
} from '../src/scene/greyhaven-visual-effects.js';
import {AUTHORED_MAPS,MAP_IDS} from '../src/world/authored-maps.mjs';

const root = new URL('../',import.meta.url);
const file=path=>new URL(path,root);
const map=AUTHORED_MAPS[MAP_IDS.overworld];

test('Original Blacksmith R4 is genuine Blender GLB and matches its immutable source SHA',()=>{
  const bytes=readFileSync(file('public'+BLACKSMITH_R4.path));
  assert.equal(bytes.length,BLACKSMITH_R4.sourceBytes);
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  assert.equal(bytes.readUInt32LE(4),2);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),BLACKSMITH_R4.sha256);
  assert.equal(BLACKSMITH_R4.worldBuildingId,'smith');
});

test('Blacksmith root position is derived only from the unchanged World9 smith footprint',()=>{
  const smith=map.buildings.find(b=>b.id==='smith');
  assert.deepEqual(
    {x:smith.x,y:smith.y,w:smith.w,h:smith.h},
    {x:3710,y:3850,w:182,h:162}
  );
  const placement=smithVisualPlacement(smith,4140,4105);
  assert.ok(Math.abs(placement.x+8.475)<1e-10);
  assert.ok(Math.abs(placement.z+4.35)<1e-10);
  assert.equal(placement.y,0);
  assert.equal(placement.scale,0.72);
  assert.throws(()=>smithVisualPlacement({...smith,id:'red-lion'},4140,4105),TypeError);
  assert.throws(()=>smithVisualPlacement(smith,NaN,4105),TypeError);
});

test('Day mode has no decorative smoke or warm practical light load by design',()=>{
  assert.equal(greyhavenLook(''),'day');
  assert.equal(greyhavenLook('?greyhavenTime=day'),'day');
  assert.equal(greyhavenLook('?greyhavenTime=invalid'),'day');
  assert.equal(greyhavenLook('?greyhavenTime=dusk'),'dusk');
  const anchors=[redLionSmokeAnchor({x:5.625,z:-3.5}),
    blacksmithSmokeAnchor({x:-8.475,z:-4.35})];
  assert.deepEqual(smokePlan(anchors,'day'),[]);
  assert.equal(smokePlan(anchors,'dusk').length,2);
  assert.throws(()=>smokePlan([...anchors,...anchors],'dusk'),TypeError);
  assert.throws(()=>smokePlan([{name:'oops',x:Infinity,y:0,z:0}],'dusk'),TypeError);
});

test('Graphics atmosphere stays inside explicit render budgets and does not establish World gameplay authority',()=>{
  assert.equal(GREYHAVEN_VISUAL_BUDGET.maxChimneys,2);
  assert.ok(GREYHAVEN_VISUAL_BUDGET.wispsPerChimney<=6);
  assert.ok(GREYHAVEN_VISUAL_BUDGET.maxPracticalLights<=4);
  assert.ok(GREYHAVEN_VISUAL_BUDGET.shadowResolution<=1024);
  const scene=readFileSync(file('src/scene/greyhaven-blockout.js'),'utf8');
  assert.match(scene,/buildOriginalBlacksmith/);
  assert.match(scene,/buildQuaterniusRedLion/);
  assert.match(scene,/configureGreyhavenLighting/);
  assert.match(scene,/createDuskSmoke/);
  assert.match(scene,/collisionAuthority: false/);
  assert.match(scene,/portalAuthority: false/);
  assert.match(scene,/serverAuthorityConnected: false/);
  assert.equal(statSync(file('public'+BLACKSMITH_R4.path)).size,BLACKSMITH_R4.sourceBytes);
});
