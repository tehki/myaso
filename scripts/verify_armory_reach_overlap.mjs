#!/usr/bin/env node
// Integration-only: static World authoring × Items reach source contract.
// A reach window is NOT a uniquely identified loot item. This doctor
// verifies four authored approaches each cover their own exact sword,
// while intermediate points cover two distinct swords.
// Runtime still MUST use a server-confirmed entity+physical item ID.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function fail(detail) {
  throw new Error("M2 rack pickup reach contract rejected: "+detail);
}

function readItemsPickupReach(source) {
  const matches=[...source.matchAll(/pub\s+const\s+PICKUP_REACH\s*:\s*f32\s*=\s*(\d+(?:\.\d+)?)\s*;/g)];
  if (matches.length!==1) fail("no single reviewable Items PICKUP_REACH f32 literal");
  const value=Number(matches[0][1]);
  if (!Number.isFinite(value)||value<=0) fail("invalid Items reach");
  return value;
}

function reachable(sockets,point,reach) {
  return sockets.filter(socket=>
    (point.x-socket.x)**2+(point.y-socket.y)**2<=reach**2
  ).map(socket=>socket.socketId);
}

function inspect(world,reach) {
  if (world.WORLD_ALPHA_ARMORY_VERSION!==1 ||
      !world.validateWorldAlphaArmoryLayout())
    fail("World authored layout/version not valid for preflight");
  const sockets=world.WORLD_ALPHA_SWORD_RACK_SOCKETS;
  if (!Array.isArray(sockets)||sockets.length!==4)
    fail("four authored swords are required");
  for (const socket of sockets) {
    if (!socket.approach ||
        !Number.isFinite(socket.approach.x) ||
        !Number.isFinite(socket.approach.y))
      fail("invalid approach for "+socket.socketId);
    const eligible=reachable(sockets,socket.approach,reach);
    if (eligible.length!==1||eligible[0]!==socket.socketId)
      fail("approach for "+socket.socketId+" not unique: "+eligible);
  }
  const ambiguous=[];
  for (let i=0;i<sockets.length-1;i++) {
    const left=sockets[i],right=sockets[i+1];
    const between={
      x:(left.approach.x+right.approach.x)/2,
      y:(left.approach.y+right.approach.y)/2,
    };
    const eligible=reachable(sockets,between,reach);
    // This UX ambiguity must be detected, never silently auto-picked.
    if (eligible.length!==2||eligible[0]!==left.socketId||
        eligible[1]!==right.socketId)
      fail("midpoint "+left.socketId+"/"+right.socketId+" no longer represents exactly two pickup choices: "+eligible);
    ambiguous.push({between,eligible});
  }
  return ambiguous;
}

if (process.argv.includes("--help")) {
  console.log("Usage: node scripts/verify_armory_reach_overlap.mjs [--self-test] <World-src/world/alpha-armory.mjs> <Items-server/src/loot.rs>");
} else {
  const selfTest=process.argv.includes("--self-test");
  const args=process.argv.slice(2).filter(a=>a!=="--self-test");
  if (args.length!==2)
    fail("explicit World and Items source paths required");
  const world=await import(pathToFileURL(resolve(args[0])).href);
  const source=readFileSync(resolve(args[1]),"utf8");
  const reach=readItemsPickupReach(source);
  const ambiguous=inspect(world,reach);
  console.log("PASS M2 World/Items reach="+reach+": 4 unique approach targets; "+ambiguous.length+" two-target intermediate points require exact ID");
  if (selfTest) {
    for (const [label,badReach] of [["too-short",49],["too-wide",65]]) {
      let rejected=false;
      try {inspect(world,badReach);} catch {rejected=true;}
      if (!rejected) fail("reach mutation "+label+" not rejected");
      console.log("PASS fail-closed reach mutation: "+label);
    }
    for (const [label,badSource] of [
      ["missing",source.replace(/pub\s+const\s+PICKUP_REACH\s*:\s*f32\s*=\s*56\.0\s*;/,"")],
      ["duplicate",source+"\npub const PICKUP_REACH: f32 = 56.0;\n"],
    ]) {
      if (badSource===source) fail("mutation "+label+" not applied");
      let rejected=false;
      try {readItemsPickupReach(badSource);} catch {rejected=true;}
      if (!rejected) fail("Items source mutation "+label+" not rejected");
      console.log("PASS fail-closed Items literal mutation: "+label);
    }
  }
}
