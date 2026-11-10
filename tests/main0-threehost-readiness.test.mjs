import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  parseBrowserVersion, parseChromeDriverVersion,
  assessThreeHostPlan, inspectLocalHost,
} from "../scripts/main0-threehost-readiness.mjs";

const chrome = major => ({ name: "google-chrome-stable", version: major + ".0.1.2", major });
const chromium = major => ({ name: "chromium", version: major + ".0.1.2", major });
const driver = major => ({ name: "chromedriver", version: major + ".0.1.2", major });
const hosts = () => [
  {alias:"x230i",browser:chrome(155),driver:driver(155),browserVerified:true,driverVerified:true,chromeSeats:2,networkSeat:true},
  {alias:"machine",browser:chrome(157),driver:driver(157),browserVerified:true,driverVerified:true,chromeSeats:2,networkSeat:true},
  {alias:"serj",browser:chromium(152),driver:driver(152),browserVerified:true,driverVerified:true,chromeSeats:0,networkSeat:true},
];

test("version parser requires real Google Chrome Stable, not Chromium or ChromeDriver", () => {
  assert.deepEqual(parseBrowserVersion("Google Chrome 155.0.8059.79"), {
    name:"google-chrome-stable",version:"155.0.8059.79",major:155,
  });
  assert.deepEqual(parseBrowserVersion("Chromium 152.0.7977.82 Arch Linux"), {
    name:"chromium",version:"152.0.7977.82",major:152,
  });
  assert.equal(parseBrowserVersion("ChromeDriver 152.0.7977.82"),null);
  assert.equal(parseBrowserVersion("Google Chrome malicious"),null);
  assert.equal(parseBrowserVersion(""),null);
});

test("driver parser uses genuine browser-driver major and rejects injected text", () => {
  assert.deepEqual(parseChromeDriverVersion("ChromeDriver 152.0.7977.82 (abcdef)"), {
    name:"chromedriver",version:"152.0.7977.82",major:152,
  });
  assert.equal(parseChromeDriverVersion("Mozilla GeckoDriver 152.0.7977.82"),null);
  assert.equal(parseChromeDriverVersion(""),null);
});

test("real-owner topology is four Chrome seats on TWO hosts plus a third Chromium network witness", () => {
  const result = assessThreeHostPlan(hosts());
  assert.equal(result.physicalHostsRecorded,3);
  assert.equal(result.chromeStableHostsRecorded,2);
  assert.equal(result.chromiumWitnessHostsRecorded,1);
  assert.equal(result.plannedChromeSessions,4);
  assert.equal(result.plannedNetworkHostSessions,3);
  assert.equal(result.topologyReady,true);
  assert.deepEqual(result.blockers,[]);
  // Ready prerequisites NEVER claim runtime QA or release on their own.
  assert.equal(result.fourChromeSessionAcceptance,"NOT_RUN");
  assert.equal(result.threePhysicalHostNetworkAcceptance,"NOT_RUN");
  assert.equal(result.authenticatedQuicTlsStage,"NOT_AUTHORIZED_OR_VERIFIED");
  assert.equal(result.releaseDecision,"HOLD");
});

test("actual read-only machine inventory fails driver readiness, without inventing native acceptance", () => {
  const records=hosts();
  records[0].driver=driver(152); // X230i Chrome155 / driver152
  records[1].driver=driver(156); // Machine Chrome157 / cached driver156
  const result=assessThreeHostPlan(records);
  assert.equal(result.topologyReady,false);
  assert.match(result.blockers.join(" | "),/x230i: executable matching-major/);
  assert.match(result.blockers.join(" | "),/machine: executable matching-major/);
  assert.equal(result.fourChromeSessionAcceptance,"NOT_RUN");
  assert.equal(result.releaseDecision,"HOLD");
});

test("Chromium cannot be counted as one of the four Google Chrome sessions", () => {
  const records=hosts();
  records[2].chromeSeats=2;
  records[1].chromeSeats=0;
  const r=assessThreeHostPlan(records);
  assert.equal(r.topologyReady,false);
  assert.match(r.blockers.join(" | "),/Serj|serj: Chrome seats require Google Chrome Stable/);
});

test("three-machine network plan requires three real browser witnesses with matching driver", () => {
  const records=hosts();
  records[2].driver=driver(151);
  const r=assessThreeHostPlan(records);
  assert.equal(r.topologyReady,false);
  assert.match(r.blockers.join(" | "),/serj: native network witness/);
});

test("Chrome second seat cannot be replaced with another Chromium process or third Chrome seat", () => {
  const records=hosts();
  records[0].chromeSeats=1;
  assert.match(assessThreeHostPlan(records).blockers.join(" | "),/two Chrome seats|four genuine/);
  records[0].chromeSeats=3;
  assert.throws(() => assessThreeHostPlan(records),/0..2/);
});

test("cached driver and unverified browser cannot qualify a physical test seat", () => {
  const records=hosts();
  records[1].driverVerified=false; // cached Windows driver is not on PATH
  records[2].browserVerified=false;
  const result=assessThreeHostPlan(records);
  assert.equal(result.topologyReady,false);
  assert.match(result.blockers.join(" | "),/machine: executable matching-major/);
  assert.match(result.blockers.join(" | "),/serj: browser version is not independently verified/);
});

test("missing or duplicate physical machines never count as independent hardware", () => {
  const records=hosts();
  assert.throws(() => assessThreeHostPlan(records.slice(0,2)),/exactly three/);
  records[2].alias="x230i";
  assert.throws(() => assessThreeHostPlan(records),/repeated/);
});

test("explicit witness seat selection mandatory and cannot silently drop Serj", () => {
  const records=hosts();
  records[2].networkSeat=false;
  assert.match(assessThreeHostPlan(records).blockers.join(" | "),/three physical network witnesses/);
  delete records[1].networkSeat;
  assert.throws(() => assessThreeHostPlan(records),/explicitly declare/);
});

test("missing Chrome or driver is fail-closed instead of marking checkout green", () => {
  const records=hosts();
  records[0].browser=null;
  records[0].driver=null;
  const result=assessThreeHostPlan(records);
  assert.equal(result.topologyReady,false);
  assert.ok(result.blockers.length>=2);
});

test("invalid host aliases rejected before a false physical machine declaration", () => {
  assert.throws(() => inspectLocalHost("../secret"),/non-sensitive/);
  assert.throws(() => assessThreeHostPlan(hosts().map((x,i)=>i===2?{...x,alias:"a/b"}:x)),/invalid/);
});

test("source harness is read-only and cannot silently claim four independently tested physical Chrome hosts", () => {
  const source=readFileSync(new URL("../scripts/main0-threehost-readiness.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(source,/\bcreateServer\(|\bfetch\(|\bWebTransport\s*\(|\bspawn\s*\(|\bwriteFile\s*\(/);
  assert.match(source,/fourChromeSessionAcceptance: "NOT_RUN"/);
  assert.match(source,/threePhysicalHostNetworkAcceptance: "NOT_RUN"/);
  assert.match(source,/releaseDecision: "HOLD"/);
});
