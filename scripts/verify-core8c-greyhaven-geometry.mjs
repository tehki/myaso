#!/usr/bin/env node
// Generate and strictly verify the Rust-side, compile-time static geometry input.
// This is authored content, never an authenticated live map/epoch/revision.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const asset = JSON.parse(readFileSync("assets/world/greyhaven-alpha-solids-v1.json", "utf8"));
const EXPECTED_HASH = "9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43";
assert.equal(asset.schema_version, 1);
assert.equal(asset.layout_id, "moonvale-greyhaven-v10-solids-v1");
assert.equal(asset.map_id, "moonvale-overworld");
assert.equal(asset.city_id, "greyhaven");
assert.equal(asset.geometry_kind, "fixed-buildings-and-city-walls");
assert.equal(asset.requires_core_fence, true);
assert.equal(asset.includes_river_or_dynamic_solids, false);
assert.equal(asset.solids_count, 23);
assert.equal(asset.solids_sha256, EXPECTED_HASH);
assert.equal(asset.solids.length, 23);
assert.equal(createHash("sha256").update(JSON.stringify(asset.solids)).digest("hex"), EXPECTED_HASH);
const seen = new Set();
for (const rect of asset.solids) {
  assert.deepEqual(Object.keys(rect), ["id", "kind", "min_x", "min_y", "max_x", "max_y"]);
  assert.match(rect.id, /^(building|wall):[a-z0-9-]+$/);
  assert.ok(!seen.has(rect.id), "duplicate static solid ID: " + rect.id);
  seen.add(rect.id);
  assert.ok(["building", "city-wall"].includes(rect.kind));
  for (const axis of ["min_x", "min_y", "max_x", "max_y"]) {
    assert.ok(Number.isFinite(rect[axis]) && Math.abs(rect[axis]) <= 8192);
  }
  assert.ok(rect.min_x < rect.max_x && rect.min_y < rect.max_y);
}
const number = (v) => Number.isInteger(v) ? v.toFixed(1) : String(v);
const generated = [
  "// AUTO-GENERATED from assets/world/greyhaven-alpha-solids-v1.json.",
  "// Regenerate: node scripts/verify-core8c-greyhaven-geometry.mjs --print",
  "// Exact content hash is a static-authoring fingerprint, NOT zone/epoch/revision authority.",
  `pub const STATIC_LAYOUT_ID: &str = "${asset.layout_id}";`,
  `pub const STATIC_SOLIDS_SHA256: &str = "${EXPECTED_HASH}";`,
  `pub const STATIC_SOLIDS: [StaticSolid; ${asset.solids.length}] = [`,
  ...asset.solids.flatMap(r => [
    "    StaticSolid {",
    `        id: "${r.id}",`,
    `        kind: "${r.kind}",`,
    `        min_x: ${number(r.min_x)},`,
    `        min_y: ${number(r.min_y)},`,
    `        max_x: ${number(r.max_x)},`,
    `        max_y: ${number(r.max_y)},`,
    "    },",
  ]),
  "];",
  "",
].join("\n");
if (process.argv.slice(2).join(" ") === "--print") {
  process.stdout.write(generated);
} else {
  assert.deepEqual(process.argv.slice(2), [], "only --print accepted");
  const actual = readFileSync("server/src/alpha_greyhaven_solids_generated.rs", "utf8").replaceAll("\r\n", "\n");
  assert.equal(actual, generated, "server compile-time static geometry drifted from reviewed World JSON");
  console.log("CORE8C_STATIC_GREYHAVEN_PARITY_PASS solids=23 sha256=" + EXPECTED_HASH);
}
