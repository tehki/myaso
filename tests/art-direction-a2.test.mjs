import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../assets/environment/greyhaven/blood-iron-a2.art.json', import.meta.url), 'utf8'));
const a1 = JSON.parse(readFileSync(new URL('../assets/environment/greyhaven/art-manifest.v1.json', import.meta.url), 'utf8'));
const author = readFileSync(new URL('../tools/art/build_blood_iron_a2.py', import.meta.url), 'utf8');

test('A2 look-dev keeps the approved Red Lion dimensions and art-only boundary', () => {
  assert.equal(manifest.milestone.includes('non-runtime'), true);
  assert.equal(manifest.geometry.metersPerGameUnit, a1.coordinateConvention.metersPerWorldUnit);
  assert.deepEqual(manifest.sceneBuildings[0].unitMeters, [
    a1.firstSlice.approvedBuilding.exterior.width * manifest.geometry.metersPerGameUnit,
    a1.firstSlice.approvedBuilding.exterior.height * manifest.geometry.metersPerGameUnit
  ]);
  assert.equal(manifest.integration.changesGameplay, false);
  assert.equal(manifest.integration.changesPortalOrAuthority, false);
  assert.equal(manifest.integration.changesKnights, false);
  assert.equal(manifest.integration.productionApproved, false);
});

test('A2 authored scene has distinct architecture and explicitly separate roof candidates', () => {
  assert.deepEqual(manifest.sceneBuildings.map(x => x.id), [
    'red-lion', 'gable-merchant', 'tanners-cottage', 'stone-weaver', 'blacksmith'
  ]);
  assert.equal(manifest.street.cobblestones.count, 1032);
  assert.equal(manifest.street.cobblestones.meshBatches, 1);
  assert.match(author, /roof-occlusion-candidate/);
  assert.match(author, /world-base-candidate/);
  assert.match(author, /bpy\.ops\.wm\.obj_import/);
});

test('A2 CPU look-dev uses self-authored procedural materials, not external downloads', () => {
  assert.equal(manifest.rendering.device, 'CPU');
  assert.equal(manifest.rendering.cameraExportLocked, false);
  assert.match(author, /ShaderNodeTexNoise/);
  assert.match(author, /ShaderNodeBump/);
  assert.match(author, /scene\.cycles\.device\s*=\s*"CPU"/);
  assert.doesNotMatch(author, /ShaderNodeTexImage|https?:\/\/|requests\.|urlretrieve\(/);
});
