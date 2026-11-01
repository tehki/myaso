import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUATERNIUS_SOURCE, RED_LION_MODEL_FILES, RED_LION_DOOR_FIT, fittedRedLionDoorTransform } from '../src/scene/quaternius-red-lion.js';

const here = dirname(fileURLToPath(import.meta.url));
const assetRoot = resolve(here, '../public/assets/quaternius/medieval-village-megakit');

test('Red Lion GLTF parts and every external dependency are bundled', () => {
  assert.ok(RED_LION_MODEL_FILES.length >= 7);

  for (const filename of RED_LION_MODEL_FILES) {
    const modelPath = resolve(assetRoot, filename);
    assert.ok(existsSync(modelPath), `missing model: ${filename}`);

    const model = JSON.parse(readFileSync(modelPath, 'utf8'));
    assert.equal(model.asset?.version, '2.0', `${filename} must be glTF 2.0`);

    for (const buffer of model.buffers ?? []) {
      const dependency = resolve(assetRoot, buffer.uri);
      assert.ok(existsSync(dependency), `${filename} missing buffer ${buffer.uri}`);
      assert.ok(statSync(dependency).size > 0, `${buffer.uri} must not be empty`);
    }

    for (const image of model.images ?? []) {
      const dependency = resolve(assetRoot, image.uri);
      assert.ok(existsSync(dependency), `${filename} missing texture ${image.uri}`);
      assert.ok(statSync(dependency).size > 0, `${image.uri} must not be empty`);

      if (image.uri.toLowerCase().endsWith('.png')) {
        const png = readFileSync(dependency);
        assert.equal(png.toString('ascii', 1, 4), 'PNG', `${image.uri} must be a PNG`);
        assert.ok(png.readUInt32BE(16) <= 1024, `${image.uri} width must be <= 1024`);
        assert.ok(png.readUInt32BE(20) <= 1024, `${image.uri} height must be <= 1024`);
      }
    }
  }
});

test('Quaternius provenance and CC0 license notice are retained', () => {
  assert.equal(QUATERNIUS_SOURCE.creator, 'Quaternius');
  assert.equal(QUATERNIUS_SOURCE.license, 'CC0-1.0');
  assert.equal(QUATERNIUS_SOURCE.sourceCommit, '21104b4045261c28fc312360841ed1a7b0ac8782');

  const license = readFileSync(resolve(assetRoot, 'LICENSE'), 'utf8');
  const notice = readFileSync(resolve(assetRoot, 'NOTICE.md'), 'utf8');
  assert.match(license, /CC0 1\.0 Universal/);
  assert.match(notice, /Quaternius/);
  assert.match(notice, /21104b4045261c28fc312360841ed1a7b0ac8782/);
  assert.match(notice, /1024/);
});

test('Red Lion Quaternius door fits its original arch with even reveals at gameplay facade scale', () => {
  // Measurements come from actual unmodified Quaternius Door_1_Round glTF
  // and Blender ray casts of Wall_Plaster_Door_Round (opening ~1.305 m,
  // rounded opening apex ~2.50 m), not screenshot pixel guesses.
  const original = JSON.parse(readFileSync(resolve(assetRoot, 'Door_1_Round.gltf'), 'utf8'));
  const leaf = original.meshes[0].primitives.find(part => part.material === 0);
  const { min, max } = original.accessors[leaf.attributes.POSITION];
  assert.ok(Array.isArray(min) && Array.isArray(max));

  // Width 6.25 is World9's existing 250-unit Red Lion facade at 0.025.
  // The wall's three 2m modules scale by the same width/6 factor.
  const frontScaleX = 6.25 / 6;
  const depth = 4.25;
  const placement = fittedRedLionDoorTransform(frontScaleX, depth);
  const left = placement.x + min[0] * placement.scaleX;
  const right = placement.x + max[0] * placement.scaleX;
  const frameHalfOpening = RED_LION_DOOR_FIT.openingWidth * frontScaleX / 2;

  const leftReveal = left + frameHalfOpening;
  const rightReveal = frameHalfOpening - right;
  assert.ok(leftReveal >= 0.025 && leftReveal <= 0.06,
    `door must reveal the left jamb without leaving a large gap: ${leftReveal}`);
  assert.ok(rightReveal >= 0.025 && rightReveal <= 0.06,
    `door must reveal the right jamb without leaving a large gap: ${rightReveal}`);
  assert.ok(Math.abs(leftReveal - rightReveal) < 0.003,
    'door leaf must be genuinely centered between both jambs');

  const bottom = placement.y + min[1] * placement.scaleY;
  const top = placement.y + max[1] * placement.scaleY;
  assert.ok(Math.abs(bottom) < 0.001,
    'bottom of leaf must remain on the existing World9 visual threshold');
  const archReveal = RED_LION_DOOR_FIT.archApexHeight - top;
  assert.ok(archReveal >= 0.06 && archReveal <= 0.12,
    `arched top must fit below masonry reveal: ${archReveal}`);
  assert.ok(Math.abs(placement.z - (depth / 2 - 0.00279258005)) < 1e-8,
    'original wall/door depth must remain unchanged');
});

test('Red Lion door fit rejects invalid presentation dimensions', () => {
  assert.throws(() => fittedRedLionDoorTransform(0, 4.25), /presentation dimensions/);
  assert.throws(() => fittedRedLionDoorTransform(1, -1), /presentation dimensions/);
  assert.throws(() => fittedRedLionDoorTransform(NaN, 4.25), /presentation dimensions/);
});
