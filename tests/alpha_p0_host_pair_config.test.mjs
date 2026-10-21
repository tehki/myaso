// These are OFFLINE negative-security and JSON consistency unit tests.
// Synthetic fixture records here are NOT four game clients or multi-host PASS.
import test from "node:test";
import assert from "node:assert/strict";
import {parseHostPairConfig,privateIpv4} from "../scripts/alpha_p0_host_pair_config.mjs";
import {verifyPairEvidence} from "../scripts/alpha_p0_host_pair_verify.mjs";
const now=2_000_000_000_000;
const defaults={
  MYASO_P0_HOST_PAIR_APPROVED:"YES",MYASO_P0_ISOLATED_STAGE:"1",
  MYASO_P0_MAX_PLAYERS:"4",MYASO_P0_PAIR_ROLE:"A",
  MYASO_P0_PAIR_HOST_ID:"client-a",MYASO_P0_PAIR_PEER_HOST_ID:"client-b",
  MYASO_P0_SERVER_IPV4:"192.168.2.85",
  MYASO_P0_SERVER_URL:"https://192.168.2.85:44321/game",
  MYASO_P0_SERVER_CERT_SHA256:"a".repeat(64),
  MYASO_P0_COORDINATED_START_MS:String(now+90000),
};
const parse=(diff={},localAddresses=["192.168.2.128"])=>
  parseHostPairConfig({...defaults,...diff},{now,localAddresses});
test("real private RFC1918 only; no loopback, CGNAT or public",()=>{
  for(const x of ["10.1.2.3","172.16.1.1","172.31.255.255","192.168.2.85"])
    assert.equal(privateIpv4(x),true,x);
  for(const x of ["127.0.0.1","8.8.8.8","100.64.0.1","192.167.0.1",
    "172.32.0.1","10.01.2.3","256.1.1.1","::1","game.open-trust-layer.org"])
    assert.equal(privateIpv4(x),false,x);
});
test("exact authorized nonproduction staging tuple accepted",()=>{
  const r=parse();assert.equal(r.cap,4);assert.equal(r.role,"A");
  assert.equal(r.fingerprint,"a".repeat(64));assert.equal(r.stagingOnly,true);
  assert(Object.isFrozen(r));
});
test("no approval, cap four, roles, host identity or own RFC1918 address fail closed",()=>{
  const invalid=[
    {MYASO_P0_HOST_PAIR_APPROVED:""},
    {MYASO_P0_ISOLATED_STAGE:"0"},
    {MYASO_P0_MAX_PLAYERS:"2"},
    {MYASO_P0_PAIR_ROLE:"C"},
    {MYASO_P0_PAIR_HOST_ID:"client-b"},
    {MYASO_P0_PAIR_PEER_HOST_ID:""},
    {MYASO_P0_SERVER_IPV4:"8.8.8.8"},
    {MYASO_P0_SERVER_URL:"https://8.8.8.8:44321/game"},
    {MYASO_P0_SERVER_URL:"https://192.168.2.85/game"},
    {MYASO_P0_SERVER_URL:"http://192.168.2.85:44321/game"},
    {MYASO_P0_SERVER_URL:"https://192.168.2.85:44321/admin"},
    {MYASO_P0_SERVER_URL:"https://user:pw@192.168.2.85:44321/game"},
    {MYASO_P0_SERVER_URL:"https://192.168.2.85:44321/game?q=1"},
    {MYASO_P0_SERVER_URL:"https://192.168.2.85:44321/game#x"},
    {MYASO_P0_SERVER_CERT_SHA256:"bad"},
    {MYASO_P0_COORDINATED_START_MS:String(now+5000)},
    {MYASO_P0_COORDINATED_START_MS:String(now+700000)},
  ];
  for(const diff of invalid)assert.throws(()=>parse(diff),undefined,JSON.stringify(diff));
  assert.throws(()=>parse({},["192.168.2.85"]),"server may not be same host");
  assert.throws(()=>parse({},[]),"no local private address");
});
function fixture(role){
  const A=role==="A";
  const localIds=A?[1,2]:[3,4],remoteIds=A?[3,4]:[1,2];
  const before=[1,2,3,4].map(netId=>({netId,x:netId*100,y:42}));
  const after=before.map(f=>({...f,x:f.x+(f.netId===1?40:f.netId===3?30:0)}));
  return {
    marker:"MYASO_P0_PAIR_LIVE_REMOTE_MOVE_PASS",kind:"P0_REAL_W3C_PAIR_STAGING",
    role,hostId:A?"client-a":"client-b",peerHostId:A?"client-b":"client-a",
    osHost:A?"machine-a":"machine-b",localIpv4:[A?"192.168.2.128":"192.168.2.130"],
    url:defaults.MYASO_P0_SERVER_URL,certificateSha256:"a".repeat(64),
    serverCapAttested:4,start:now+90000,
    clientFamilies:["chrome","firefox"],localIds,remoteIds,allIds:[1,2,3,4],
    actorId:A?1:3,remoteMovedId:A?3:1,movedAt:now+90000+(A?900:7000),
    baseline:[structuredClone(before),structuredClone(before)],
    observed:[structuredClone(after),structuredClone(after)],
    serverTicksBefore:[1000,1000],serverTicksAfter:[1900,1900],
    twoNativeIndependentW3cClients:true,authenticatedRemoteQuic:true,
    crossHostMovementSeenByChromeAndFirefox:true,
  };
}
test("pure structural verifier correlates two forged UNIT FIXTURES; not actual network evidence",()=>{
  const result=verifyPairEvidence(fixture("A"),fixture("B"));
  assert.equal(result.status,"EVIDENCE_STRUCTURALLY_CONSISTENT_REQUIRES_SERVER_LOGS");
  assert.equal(result.physicalHostAttestationStillRequired,true);
  assert.equal(result.notReleaseApproval,true);
});
test("verifier rejects same host, overlap, wrong remote mover, different QUIC certificate",()=>{
  for(const mutate of [
    (a,b)=>b.hostId=a.hostId,
    (a,b)=>b.osHost=a.osHost,
    (a,b)=>b.localIpv4=[...a.localIpv4],
    (a,b)=>b.localIds=[1,4],
    (a,b)=>b.remoteMovedId=2,
    (a,b)=>b.certificateSha256="f".repeat(64),
    (a,b)=>b.allIds=[1,2,3,5],
    (a,b)=>b.peerHostId="someone-else",
    (a,b)=>b.start=a.start+1000,
  ]){
    const a=fixture("A"),b=fixture("B");mutate(a,b);
    assert.throws(()=>verifyPairEvidence(a,b));
  }
});
test("verifier rejects cached world state, missing Firefox movement and forged markers",()=>{
  for(const mutate of [
    (a)=>a.serverTicksAfter[1]=a.serverTicksBefore[1],
    (a)=>a.observed[1]=structuredClone(a.baseline[1]),
    (a)=>a.marker="PASS_WITHOUT_BROWSER",
    (a)=>a.localIds=[1,1],
    (a)=>a.movedAt=a.start-500,
    (a)=>a.clientFamilies=["chrome","chrome"],
    (a)=>a.baseline[0][0].x=Number.NaN,
  ]){
    const a=fixture("A"),b=fixture("B");mutate(a);
    assert.throws(()=>verifyPairEvidence(a,b));
  }
});
