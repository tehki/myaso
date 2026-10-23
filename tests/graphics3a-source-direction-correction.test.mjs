import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { KNIGHT_FRAME_PX, spriteAtlasRect } from "../web/knight-sprites.mjs";

const legacy = ["silver_idle", "silver_walk", "silver_sprint", "silver_jump"];
const facings = [
  { name: "south", row: 0 },
  { name: "southwest", row: 1 },
  { name: "west", row: 2 },
  { name: "northwest", row: 3 },
  { name: "north", row: 4 },
  { name: "northeast", row: 5 },
  { name: "east", row: 6 },
  { name: "southeast", row: 7 },
];
const angle = row => Math.PI / 2 + row * Math.PI / 4;

test("Idle, Walk, Sprint and Jump invert E/W and all diagonals, never N/S", () => {
  for (const clip of legacy) {
    for (const { name, row } of facings) {
      const actual = spriteAtlasRect(angle(row), 0, 8, clip);
      const expected = ((8 - row) % 8) * KNIGHT_FRAME_PX;
      assert.equal(actual.y, expected, clip + " " + name);
    }
  }
});
test("Roll, Kick and Knockdown keep every native source direction unchanged", () => {
  for (const clip of ["silver_roll", "silver_kick_v3", "silver_knockdown"]) {
    for (const { name, row } of facings) {
      const actual = spriteAtlasRect(angle(row), 0, 8, clip);
      assert.equal(actual.y, row * KNIGHT_FRAME_PX, clip + " " + name);
    }
  }
});
test("live Silver renderer passes selected clip into source-only orientation remap", () => {
  const source = readFileSync(new URL("../web/knight-sprites.mjs", import.meta.url), "utf8");
  assert.match(source, /spriteAtlasRect\(fighter\.facing \?\? 0,\s*frame,\s*frames,\s*clip,\s*sourceArtVariant\)/);
});
