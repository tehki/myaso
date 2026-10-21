import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const source = read("tools/art/author_silver_kick_dash_p0.py");
const report = JSON.parse(read("docs/art/silver-kick-grounding-p0/grounded_blender_bake_report.json"));

test("kick source renderer evaluates exact Blender fractional action keyframes", () => {
  assert.match(source, /sc\.frame_set\(int\(fr\),subframe=fr-int\(fr\)\)/);
  assert.doesNotMatch(source, /sc\.frame_set\(round\(fr\)\)/);
  assert.equal(report.sourceRigBones, 22);
  assert.deepEqual(report.authoritativePhases.kickMs, [90, 70, 220]);
  assert.equal(report.originalArtReplaced, false);
  assert.equal(report.realGreyhaven, false);
  assert.equal(report.humanVisualApproved, false);
});

test("all 64 real Blender kick renders sample authored source times without rounding", () => {
  const rows = report.rendered.filter(row => row.clip === "silver_kick_p0");
  assert.equal(rows.length, 64);
  const phases = [1, 3.7, 6.4, 8.5, 10.6, 13.5, 18.0, 23.8];
  for (const direction of Array.from({length: 8}, (_, i) => i)) {
    const frames = rows.filter(row => row.direction === direction)
      .sort((a, b) => a.phase - b.phase);
    assert.equal(frames.length, 8);
    assert.deepEqual(frames.map(row => row.sourceFrame), phases);
    assert.deepEqual(frames.map(row => row.sampledBlenderFrame), phases);
  }
  assert.ok(rows.some(row => !Number.isInteger(row.sampledBlenderFrame)));
});
