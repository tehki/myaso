import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUATERNIUS_SOURCE, RED_LION_MODEL_FILES } from '../src/scene/quaternius-red-lion.js';

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
