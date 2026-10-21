#!/usr/bin/env node
// P0 cross-department source-only contract doctor. Must be run against a
// disposable checkout containing actual World #493 AND Core 8B #541 source.
// Does not select an item writer, approve units, authorize pickup, or modify
// either file. Fails CLOSED on absent, stale, swapped or changed sockets.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";

function fail(message) {
  throw new Error(`M2 Greyhaven World/Core socket contract mismatch: ${message}`);
}

function parseCoreSocketManifest(source) {
  const match=source.match(/pub\s+const\s+GREYHAVEN_RACK_V1\s*:\s*\[\s*\(&str,\s*i32,\s*i32\)\s*;\s*4\s*\]\s*=\s*\[([\s\S]*?)\];/);
  if (!match) fail("missing or changed Core GREYHAVEN_RACK_V1 fixed 4-row signature");
  const text=match[1];
  const regex=/\(\s*"([^"]+)"\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)\s*,?/g;
  const rows=[];
  let remainder=text;
  for (const hit of text.matchAll(regex)) {
    rows.push({socketId:hit[1],x:Number(hit[2]),y:Number(hit[3])});
    remainder=remainder.replace(hit[0],"");
  }
  if (rows.length!==4 || remainder.trim()) fail("Core V1 must have exactly four literal tuple entries");
  if (rows.some(s=>!Number.isSafeInteger(s.x)||!Number.isSafeInteger(s.y)))
    fail("Core V1 contains unsafe integer source coordinates");
  if (new Set(rows.map(s=>s.socketId)).size!==4)
    fail("Core V1 duplicate socket ID");
  return rows;
}

async function verify(worldPath,corePath) {
  const world=await import(pathToFileURL(resolve(worldPath)).href);
  const {WORLD_ALPHA_ARMORY_VERSION, WORLD_ALPHA_SWORD_RACK_SOCKETS, validateWorldAlphaArmoryLayout}=world;
  if (WORLD_ALPHA_ARMORY_VERSION!==1) fail("World authored V1 version changed");
  if (typeof validateWorldAlphaArmoryLayout!=="function" || !validateWorldAlphaArmoryLayout())
    fail("World authoring validator rejects layout");
  if (!Array.isArray(WORLD_ALPHA_SWORD_RACK_SOCKETS) ||
      WORLD_ALPHA_SWORD_RACK_SOCKETS.length!==4)
    fail("World socket count is not four");
  const worldRows=WORLD_ALPHA_SWORD_RACK_SOCKETS.map(row=>({
    socketId:row.socketId,x:row.x,y:row.y,
  }));
  for (const row of worldRows) {
    if (typeof row.socketId!=="string" ||
        !Number.isSafeInteger(row.x) || !Number.isSafeInteger(row.y))
      fail("World socket ID or coordinates are not valid precise source values");
  }
  const coreRows=parseCoreSocketManifest(readFileSync(resolve(corePath),"utf8"));
  if (JSON.stringify(worldRows)!==JSON.stringify(coreRows))
    fail(`World vs Core differs: world=${JSON.stringify(worldRows)}, core=${JSON.stringify(coreRows)}`);
  return worldRows;
}

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/verify_armory_source_parity.mjs [--self-test] <World-src/world/alpha-armory.mjs> <Core-server/src/alpha_armory_mapping_preflight.rs>");
} else {
  const selfTest=process.argv.includes("--self-test");
  const paths=process.argv.slice(2).filter(arg=>arg!=="--self-test");
  if (paths.length!==2) fail("two explicit source paths are required; do not fetch main or guess a branch");
  const rows=await verify(paths[0],paths[1]);
  console.log(`PASS M2 World V1 <-> Core 8B four sockets: ${JSON.stringify(rows)}`);
  if (selfTest) {
    // Negative tests run wholly in memory. A CI worker need not create
    // writable temp fixtures, and these edits cannot affect the real files.
    const source=readFileSync(resolve(paths[1]),"utf8");
    const variants=[
      ["coordinate drift", source.replace('("greyhaven-rack-3", 3820, 4038)', '("greyhaven-rack-3", 3819, 4038)')],
      ["duplicate socket identity", source.replace('("greyhaven-rack-2", 3780, 4038)', '("greyhaven-rack-1", 3780, 4038)')],
      ["missing fourth socket", source.replace('("greyhaven-rack-4", 3860, 4038),', '')],
      ["wrong review constant", source.replace("GREYHAVEN_RACK_V1","GREYHAVEN_RACK_V0")],
    ];
    for (const [name,corrupted] of variants) {
      if (corrupted===source) fail(`negative fixture substitution for ${name} did not apply`);
      let rejected=false;
      try {
        const parsed=parseCoreSocketManifest(corrupted);
        rejected=JSON.stringify(parsed)!==JSON.stringify(rows);
      } catch {
        rejected=true;
      }
      if (!rejected) fail(`unsafe mutation unexpectedly accepted: ${name}`);
      console.log(`PASS M2 fail-closed negative case: ${name}`);
    }
  }
}
