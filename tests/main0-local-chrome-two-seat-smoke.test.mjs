import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {validateLocalSeatEvidence, isBrandedChromeExecutable} from "../scripts/main0-local-chrome-two-seat-smoke.mjs";
import {assessThreeHostPlan} from "../scripts/main0-threehost-readiness.mjs";

const seats=()=>[
  {id:"a",profile:"/tmp/myaso-local-seat-A",browser:"chrome",
    version:"155.0.8059.79",keyTrusted:true,keyCount:1,browserOnly:true},
  {id:"b",profile:"/tmp/myaso-local-seat-B",browser:"chrome",
    version:"155.0.8059.79",keyTrusted:true,keyCount:1,browserOnly:true}
];
test("branded Google Chrome Stable executable cannot be replaced by Chromium",()=>{
  assert.equal(isBrandedChromeExecutable("/usr/bin/google-chrome-stable","linux"),true);
  assert.equal(isBrandedChromeExecutable("/usr/bin/chromium","linux"),false);
  assert.equal(isBrandedChromeExecutable("chromium","linux"),false);
  assert.equal(isBrandedChromeExecutable("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe","win32"),true);
  assert.equal(isBrandedChromeExecutable("C:\\Program Files\\Chromium\\Application\\chrome.exe","win32"),false);
  assert.equal(isBrandedChromeExecutable("chrome.exe","win32"),false);
});

test("2 local browser sessions never become real Rust World signoff",()=>{
  const verdict=validateLocalSeatEvidence(seats(),155);
  assert.equal(verdict.chromeSeatCount,2);
  assert.equal(verdict.hostCount,1);
  assert.equal(verdict.rustWorldAcceptance,"NOT_RUN");
  assert.equal(verdict.crossHostNetworkAcceptance,"NOT_RUN");
  assert.equal(verdict.release,"HOLD");
});
test("must be exactly two sessions with distinct genuine WebDriver identities",()=>{
  assert.throws(()=>validateLocalSeatEvidence(seats().slice(0,1),155),/exactly two/);
  const same=seats(); same[1].id="a";
  assert.throws(()=>validateLocalSeatEvidence(same,155),/identities/);
});
test("must have isolated temporary browser profiles, not same user data",()=>{
  const same=seats();same[1].profile=same[0].profile;
  assert.throws(()=>validateLocalSeatEvidence(same,155),/distinct temporary profile/);
});
test("never qualify Chromium or a mismatched installed browser",()=>{
  const wrong=seats();wrong[0].browser="chromium";
  assert.throws(()=>validateLocalSeatEvidence(wrong,155),/Chrome|chrome/);
  const wrongBuild=seats();wrongBuild[0].version="156.0.8059.79";
  assert.throws(()=>validateLocalSeatEvidence(wrongBuild,155),/version mismatch/);
});
test("trusted W3C input is required for both seats independently",()=>{
  const untrusted=seats();untrusted[1].keyTrusted=false;
  assert.throws(()=>validateLocalSeatEvidence(untrusted,155),/trusted W3C/);
  const duplicated=seats();duplicated[1].keyCount=2;
  assert.throws(()=>validateLocalSeatEvidence(duplicated,155),/exactly one/);
});
test("2026-11-10 measured four Chrome seats unblock topology only, not original Rust release",()=>{
  const inventory=JSON.parse(readFileSync(new URL(
    "../client/playcanvas/alpha02-threehost-observed-20261110.json",import.meta.url),"utf8"));
  assert.equal(inventory.hosts.length,3);
  const chromeHosts=inventory.hosts.filter(h=>h.browser.name==="google-chrome-stable");
  assert.deepEqual(chromeHosts.map(h=>[h.alias,h.localBrowserOnlySmoke,h.observedDistinctBrowserSessions]),
    [["x230i","PASS",2],["machine","PASS",2]]);
  assert.equal(inventory.hosts[2].browser.name,"chromium");
  const v=assessThreeHostPlan(inventory.hosts);
  assert.equal(v.topologyReady,true);
  assert.equal(v.physicalHostsRecorded,3);
  assert.equal(v.chromeStableHostsRecorded,2);
  assert.equal(v.plannedChromeSessions,4);
  assert.equal(v.originalRustWorldAcceptance,"NOT_RUN");
  assert.equal(v.fourChromeSessionAcceptance,"NOT_RUN");
  assert.equal(v.threePhysicalHostNetworkAcceptance,"NOT_RUN");
  assert.equal(v.authenticatedQuicTlsStage,"NOT_AUTHORIZED_OR_VERIFIED");
  assert.equal(v.releaseDecision,"HOLD");
  assert.equal(inventory.release,"HOLD");
});

test("no fake game-server evidence or public activation in the local seat smoke",()=>{
  const wrong=seats();wrong[1].browserOnly=false;
  assert.throws(()=>validateLocalSeatEvidence(wrong,155),/cannot involve the game server/);
  const src=readFileSync(new URL("../scripts/main0-local-chrome-two-seat-smoke.mjs",import.meta.url),"utf8");
  assert.match(src,/data:text\/html/);
  assert.match(src,/127\.0\.0\.1/);
  assert.doesNotMatch(src,/--no-sandbox|--disable-web-security|https:\/\/.*\/game|0\.0\.0\.0/);
  assert.match(src,/rustWorldAcceptance: "NOT_RUN"/);
  assert.match(src,/release: "HOLD"/);
});
