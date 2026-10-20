import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const digest = readFileSync(new URL("./fixtures/world-boundary-digests-v1.csv", import.meta.url),"utf8");
const entries=digest.trim().split(/\r?\n/).filter(x=>!x.startsWith("#"))
  .map(x=>x.split(","));
test("D5 five independently hashed edge categories cover 20000 representative points",()=>{
  assert.equal(entries.length,5);
  let total=0,blocked=0;
  const names=["city-walls","building-edges","river-bridges","inn-furniture","world-uniform"];
  for(let i=0;i<entries.length;i++){
    const [category,count,n,hash]=entries[i];
    assert.equal(category,names[i]);
    assert.equal(Number(count),4000);
    assert.match(hash,/^[0-9a-f]{8}$/);
    assert.ok(Number(n)>=0 && Number(n)<=Number(count));
    total+=Number(count);blocked+=Number(n);
  }
  assert.equal(total,20000);
  assert.ok(blocked>7000);
});

test("D5 seeded boundary digests are reproducible across Windows and Linux",()=>{
  const script=fileURLToPath(new URL("../scripts/generate-world-boundary-digests.mjs",import.meta.url));
  const r=spawnSync(process.execPath,[script,"--check"],{encoding:"utf8",timeout:15000});
  assert.equal(r.error,undefined);
  assert.equal(r.status,0,r.stderr || r.stdout);
  assert.match(r.stdout,/20000 positions, five regions/);
});

test("D5 differential corpus does not change networked combat or trusted movement",()=>{
  const source=readFileSync(new URL("../server/src/world_boundary_parity.rs",import.meta.url),"utf8");
  const live=readFileSync(new URL("../server/src/main.rs",import.meta.url),"utf8");
  const simulation=readFileSync(new URL("../server/src/simulation.rs",import.meta.url),"utf8");
  assert.match(source,/d5_twenty_thousand_edge_biased_queries_match_browser_digests/);
  assert.doesNotMatch(live,/world_boundary_parity|world_boundary_digests/);
  assert.doesNotMatch(simulation,/world_boundary_parity|world_boundary_digests/);
});
