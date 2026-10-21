#!/usr/bin/env node
// First Playable Alpha P0 — four-department, read-only, exact-source merge
// closure verifier. This is intentionally NOT a world/item writer, session
// authenticator, replay validator, or substitute for protected/browser CI.
//
// Run from Core 8B's checked-out scripts against an independently prepared,
// CLEAN, UNPUSHED local merger checkout with all four exact commits:
// node scripts/verify_p0_four_source_closure.mjs \
//   --root /path/to/disposable-merged-tree \
//   --core <full-40-char-SHA> --items <SHA> --world <SHA> --core8c <SHA> \
//   --self-test
//
// No checkout, git fetch, git reset, git merge, git push, or files written.
// Never infer default branches, default SHAs, live unit conversion, or winner.

import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

const owners = ["core", "items", "world", "core8c"];
const requiredModules = [
  "alpha_armory_mapping_preflight", "alpha_mainhand_snapshot",
  "alpha_pickup_ack_proof", "alpha_greyhaven_geometry", "alpha_spawn",
  "character_identity", "identity", "item_journal", "item_ownership",
  "legacy_gear_preflight", "loot", "loot_persistence", "loot_transaction",
  "magic", "magic_cast", "magic_checkpoint", "magic_combat_death",
  "magic_combat_interrupt", "magic_combat_preview", "magic_teacher",
  "simulation", "zone", "zone_item_transfer",
];

// Only files that each department claims as solely owned are tracked here.
// Deliberately exclude coedited server/src/lib.rs, server/src/main.rs,
// server/src/simulation.rs, CI and web entrypoints: those need a separate
// semantic merge review, not a dishonest byte-for-byte pass.
const sourceClaims = {
  core: [
    "server/src/alpha_armory_mapping_preflight.rs",
    "server/src/alpha_mainhand_snapshot.rs",
    "server/src/alpha_pickup_ack_proof.rs",
    "server/src/item_journal.rs",
    "server/src/item_ownership.rs",
    "server/src/legacy_gear_preflight.rs",
    "scripts/verify_armory_source_parity.mjs",
    "scripts/verify_armory_reach_overlap.mjs",
  ],
  items: [
    "server/src/character_identity.rs",
    "server/src/loot.rs",
    "server/src/loot_persistence.rs",
    "server/src/loot_transaction.rs",
    "server/src/magic.rs",
  ],
  world: [
    "src/world/alpha-armory.mjs",
    "src/world/alpha-solid-geometry.mjs",
    "tests/world-alpha-armory.test.mjs",
    "tests/world-alpha-rack-selection-range.test.mjs",
  ],
  core8c: [
    "server/src/alpha_greyhaven_geometry.rs",
    "server/src/alpha_spawn.rs",
    "server/tests/alpha_greyhaven_spawn_quic.rs",
  ],
};

function fail(message) {
  throw new Error("P0 four-source closure BLOCKED: " + message);
}
function parseArgs(args) {
  const parsed = {};
  for (let i=0;i<args.length;i++) {
    const arg=args[i];
    if (arg==="--self-test") {
      if ("selfTest" in parsed) fail("duplicate --self-test");
      parsed.selfTest=true;
      continue;
    }
    if (!["--root","--core","--items","--world","--core8c"].includes(arg))
      fail("unknown option: "+arg);
    const name=arg.slice(2);
    if (name in parsed) fail("duplicate option "+arg);
    const val=args[++i];
    if (!val || val.startsWith("--")) fail("missing value for "+arg);
    parsed[name]=val;
  }
  if (!parsed.root) fail("explicit --root disposable checkout is mandatory");
  for (const owner of owners) {
    if (!/^[0-9a-f]{40}$/.test(parsed[owner] ?? ""))
      fail("full lowercase 40-hex --"+owner+" commit required");
  }
  if (new Set(owners.map(owner=>parsed[owner])).size!==4)
    fail("owner commits must be four distinct identities");
  return parsed;
}
function git(root,...args) {
  try {
    return execFileSync("git",args,{
      cwd:root,encoding:"utf8",stdio:["ignore","pipe","pipe"],
      timeout:20_000, maxBuffer:4*1024*1024,
    }).trim();
  } catch(err) {
    fail("git "+args.slice(0,4).join(" ")+" failed; incomplete Git source/ancestry: "+
      String(err.stderr??err.message).slice(0,250));
  }
}
function ensureAncestry(root,commits) {
  const head=git(root,"rev-parse","HEAD");
  for (const owner of owners) {
    const sha=commits[owner];
    const typ=git(root,"cat-file","-t",sha);
    if (typ!=="commit") fail(owner+" must resolve to real Git commit");
    if (git(root,"merge-base",sha,head)!==sha)
      fail(owner+" commit NOT an ancestor of local merged HEAD: "+sha);
  }
  return head;
}
function readModules(source) {
  const names=[...source.matchAll(/^pub mod ([a-z0-9_]+);$/gm)].map(match=>match[1]);
  for(const name of requiredModules) {
    if (names.filter(n=>n===name).length!==1)
      fail("expected exactly one real module declaration: "+name);
  }
  if(new Set(names).size!==names.length)
    fail("duplicate Rust module declarations");
  if (!source.includes("pub const PROTOCOL_VERSION: u8 = 1;") ||
      !source.includes("pub fn coalesce_accepted_input_batch"))
    fail("full original server/src/lib.rs gameplay/protocol body was truncated");
  if (source.includes("<<<<<<<") || source.includes(">>>>>>>"))
    fail("unresolved merge marker in lib.rs");
  return names.length;
}
function verifyClaim(root,sha,path) {
  const expected=git(root,"rev-parse",sha+":"+path);
  const observed=git(root,"hash-object","--",path);
  if (!/^[0-9a-f]{40}$/.test(expected)||expected!==observed)
    fail("unexpected "+path+" byte drift after merge; source owner="+sha+
      " expected="+expected+" actual="+observed);
}
function selfTest() {
  const fixture=[
    "pub mod alpha_armory_mapping_preflight;",
    ...requiredModules.filter(m=>m!=="alpha_armory_mapping_preflight")
      .map(m=>"pub mod "+m+";"),
    "pub const PROTOCOL_VERSION: u8 = 1;",
    "pub fn coalesce_accepted_input_batch() {}",
  ].join("\n");
  readModules(fixture); // reviewed positive module-contract baseline
  const changes=[
    ["missing module", fixture.replace("pub mod item_journal;\n","")],
    ["duplicate module", fixture+" \npub mod loot;"],
    ["truncated server lib", fixture.replace("pub fn coalesce_accepted_input_batch() {}","")],
    ["conflict marker", fixture+"\n<<<<<<< HEAD"],
  ];
  for(const [name,source] of changes) {
    let refused=false;
    try { readModules(source); } catch { refused=true; }
    if (!refused) fail("negative module fixture was accepted: "+name);
    console.log("PASS P0 fail-closed integration module mutation: "+name);
  }
  const inputs=[
    ["missing source commit", ["--root","/tmp","--core","abc"]],
    ["implicit missing root", owners.flatMap(n=>["--"+n,"a".repeat(40)])],
  ];
  for(const [name,args] of inputs) {
    let refused=false;
    try { parseArgs(args); } catch { refused=true; }
    if (!refused) fail("negative argument fixture was accepted: "+name);
    console.log("PASS P0 fail-closed source identity argument: "+name);
  }
}

function main() {
  if(process.argv.includes("--help")) {
    console.log("Usage: node scripts/verify_p0_four_source_closure.mjs --root <clean-local-merged-checkout> --core <40hex> --items <40hex> --world <40hex> --core8c <40hex> [--self-test]");
    return;
  }
  const args=parseArgs(process.argv.slice(2));
  const root=realpathSync(resolve(args.root));
  if(git(root,"rev-parse","--show-toplevel")!==root)
    fail("root must be the exact top-level Git worktree, not nested source");
  const changes=git(root,"status","--porcelain","--untracked-files=normal");
  if(changes) fail("disposable local merged checkout must be CLEAN");
  const head=ensureAncestry(root,args);
  const moduleCount=readModules(readFileSync(resolve(root,"server/src/lib.rs"),"utf8"));
  let verified=0;
  for(const owner of owners) {
    for(const path of sourceClaims[owner]) {
      verifyClaim(root,args[owner],path);
      verified++;
    }
  }
  console.log("PASS P0 four-source exact ancestry, HEAD="+head+
    ", owner-file blobs="+verified+", unique modules="+moduleCount+
    ", clean local checkout");
  console.log("NOTE: no single writer, world-unit scale, actor auth, postcommit outbox, real native browser or production approval is inferred");
  if(args.selfTest) selfTest();
}

main();
