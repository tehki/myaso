import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {
  ADULT_HUMAN_RIG_ID,
  ADULT_HUMAN_BODY_PRESENTATIONS,
  ADULT_HUMAN_DIRECTIONS,
  ADULT_HUMAN_RIG_V1_BONES,
  ADULT_HUMAN_CLIP_COVERAGE,
  resolveAdultHumanClip,
} from "../src/browser/adult-human-animation-contract.mjs";
import {
  isValidAnimationTimeline,
  sampleAnimationFrame,
} from "../src/browser/human-animation-timeline.mjs";

const root = new URL("../", import.meta.url);
const bytes = path => readFileSync(new URL(path, root));
const json = path => JSON.parse(bytes(path).toString("utf8"));

function glbJointNames(buffer) {
  assert.equal(buffer.subarray(0, 4).toString("ascii"), "glTF");
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a);
  const length = buffer.readUInt32LE(12);
  const doc = JSON.parse(buffer.subarray(20, 20 + length).toString("utf8"));
  const skin = (doc.skins || []).find(candidate => candidate.joints?.length === 22);
  assert.ok(skin, "original GLB must contain the shared 22-joint skin");
  return skin.joints.map(index => doc.nodes[index]?.name);
}

function assertAtlas(path, manifestPath, expectedFrames) {
  const atlas = bytes(path);
  const manifest = json(manifestPath);
  assert.equal(atlas.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(atlas.subarray(8, 12).toString("ascii"), "WEBP");
  assert.equal(manifest.bytes, atlas.length);
  assert.equal(manifest.sha256, createHash("sha256").update(atlas).digest("hex"));
  assert.equal(manifest.directions ?? manifest.directionCount, 8);
  assert.equal(manifest.framesPerDirection ?? manifest.frameCount, expectedFrames);
  assert.equal(manifest.sourceFramePx ?? manifest.framePx, 160);
  return manifest;
}

test("A3 defines one reusable 22-bone human rig and eight-way convention", () => {
  assert.equal(ADULT_HUMAN_RIG_ID, "adult-human-22-v1");
  assert.deepEqual(ADULT_HUMAN_BODY_PRESENTATIONS, ["adult-masculine", "adult-feminine"]);
  assert.deepEqual(ADULT_HUMAN_DIRECTIONS,
    ["south", "southwest", "west", "northwest", "north", "northeast", "east", "southeast"]);
  assert.equal(ADULT_HUMAN_RIG_V1_BONES.length, 22);
  assert.equal(new Set(ADULT_HUMAN_RIG_V1_BONES).size, 22);
  for (const body of ADULT_HUMAN_BODY_PRESENTATIONS) {
    const report = json("assets/characters/adult-body/" + body + "-source-report.json");
    assert.deepEqual(new Set(report.rigBoneNames), new Set(ADULT_HUMAN_RIG_V1_BONES));
    for (const path of [
      "assets/characters/" + body + ".glb",
      "assets/characters/adult-body-a1/" + body + "-locomotion-a1.glb",
      "assets/characters/adult-body-a2/" + body + "-roll-a2.glb",
      "assets/characters/adult-mocap-r4/" + body + "-mocap-roll-r4.glb",
    ]) {
      assert.deepEqual(new Set(glbJointNames(bytes(path))), new Set(ADULT_HUMAN_RIG_V1_BONES), path);
    }
  }
});

test("A0/A1 source atlases resolve without a renderer fallback for both human bodies", () => {
  for (const body of ADULT_HUMAN_BODY_PRESENTATIONS) {
    for (const clip of ["idle", "walk", "run"]) {
      const resolved = resolveAdultHumanClip(body, clip);
      assert.ok(resolved, body + " " + clip);
      assert.equal(resolved.status, "source-preview-only");
      assert.equal(resolved.sourceActionName, clip);
      assert.equal(resolved.productionActive, false);
      const manifest = assertAtlas(resolved.atlasPath, resolved.manifestPath, 4);
      assert.equal(manifest.bodyPresentation, body);
      assert.equal(manifest.clip, clip);
      assert.equal(resolveAdultHumanClip(body, clip, "r4"), null);
    }
  }
});

test("A2 and R4 rolls are explicit visual-hold variants with original source timing", () => {
  const expectedTimes = [0, 1000/30, 2000/30, 100, 4000/30, 5000/30, 7000/30, 350];
  for (const body of ADULT_HUMAN_BODY_PRESENTATIONS) {
    assert.equal(resolveAdultHumanClip(body, "roll"), null,
      "ambiguous roll sources must not be selected implicitly");
    for (const variant of ["a2", "r4"]) {
      const resolved = resolveAdultHumanClip(body, "roll", variant);
      assert.ok(resolved);
      assert.equal(resolved.status, "source-visual-hold");
      assert.equal(resolved.sourceActionName, variant === "a2" ? "roll" : "roll_r4_real_mocap_candidate");
      assert.equal(resolved.productionActive, false);
      assert.deepEqual(resolved.sourceFrameTimesMs, expectedTimes);
      assertAtlas(resolved.atlasPath, resolved.manifestPath, 8);
    }
  }
});

test("missing actions fail closed and never resolve to Idle or another substitute", () => {
  for (const body of ADULT_HUMAN_BODY_PRESENTATIONS) {
    for (const clip of [
      "start", "stop", "turn", "jump", "fall", "land", "attack", "block",
      "parry", "kick", "hitReaction", "stun", "knockdown", "death",
      "pickup", "equip", "unequip", "drop", "unknown",
    ]) {
      assert.equal(resolveAdultHumanClip(body, clip), null, body + " " + clip);
    }
  }
  assert.equal(resolveAdultHumanClip("child", "idle"), null);
  assert.equal(resolveAdultHumanClip("adult-masculine", "roll", "unknown"), null);
});

test("source-time sampler follows nonuniform Blender keyframe timestamps", () => {
  const times = [0, 1000/30, 2000/30, 100, 4000/30, 5000/30, 7000/30, 350];
  const samples = [0, 32, 34, 87, 130, 134, 169, 170, 175, 232, 234, 349.9, 350, 600];
  const expected = [0, 0, 1, 2, 3, 4, 5, 5, 5, 5, 6, 6, 7, 7];
  assert.deepEqual(samples.map(elapsedMs =>
    sampleAnimationFrame({elapsedMs, durationMs:350, frameTimesMs:times})?.frame), expected);
  const atEnd = sampleAnimationFrame({elapsedMs:600, durationMs:350, frameTimesMs:times});
  assert.equal(atEnd.elapsedMs, 350);
  assert.equal(atEnd.complete, true);
  assert.equal(atEnd.sourceTimeMs, 350);
});

test("generic loop sampler wraps only at the authored cycle duration", () => {
  const times = [0, 50, 100, 150];
  assert.equal(isValidAnimationTimeline({durationMs:200, frameTimesMs:times, loop:true}), true);
  assert.equal(sampleAnimationFrame({elapsedMs:199, durationMs:200, frameTimesMs:times, loop:true}).frame, 3);
  assert.equal(sampleAnimationFrame({elapsedMs:200, durationMs:200, frameTimesMs:times, loop:true}).frame, 0);
  assert.equal(sampleAnimationFrame({elapsedMs:450, durationMs:200, frameTimesMs:times, loop:true}).elapsedMs, 50);
});

test("invalid or ambiguous clip timelines are rejected instead of guessed", () => {
  const invalid = [
    {durationMs:0, frameTimesMs:[0]},
    {durationMs:100, frameTimesMs:[]},
    {durationMs:100, frameTimesMs:[1, 50]},
    {durationMs:100, frameTimesMs:[0, 50, 50]},
    {durationMs:100, frameTimesMs:[0, 101]},
    {durationMs:100, frameTimesMs:[0, NaN]},
    {durationMs:100, frameTimesMs:[0, Infinity]},
    {durationMs:100, frameTimesMs:[0, 100], loop:true},
  ];
  for (const args of invalid) assert.equal(isValidAnimationTimeline(args), false, JSON.stringify(args));
  for (const elapsedMs of [-1, NaN, Infinity, "10", null]) {
    assert.equal(sampleAnimationFrame({elapsedMs, durationMs:100, frameTimesMs:[0, 50]}), null);
  }
});
