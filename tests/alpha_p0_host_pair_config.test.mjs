// These are OFFLINE negative-security and JSON consistency unit tests.
// Synthetic fixture records here are NOT four game clients or multi-host PASS.
import test from "node:test";
import assert from "node:assert/strict";
import {parseHostPairConfig,privateIpv4} from "../scripts/alpha_p0_host_pair_config.mjs";
import {verifyPairEvidence,verifyCaptureFiles,verifyServerAdmissionLog} from "../scripts/alpha_p0_host_pair_verify.mjs";
import {createHash} from "node:crypto";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
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
    screenshots:["chrome","firefox"].map((family,i)=>({
      family,relativeFile:`alpha-p0-hostpair-evidence/pair-${role.toLowerCase()}-${family}.png`,
      bytes:25000+i*1000,
      sha256:(role==="A"?(i?"b":"a"):(i?"d":"c")).repeat(64),
      driverPid:(role==="A"?100:200)+i,
      w3cSessionId:(role==="A"?"aaaaaaaa":"bbbbbbbb")+(i?"11111111":"22222222"),
    })),
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
    (a,b)=>a.screenshots[0].sha256="wrong",
    (a,b)=>a.screenshots[1].w3cSessionId=a.screenshots[0].w3cSessionId,
    (a,b)=>a.screenshots[1].driverPid=a.screenshots[0].driverPid,
    (a,b)=>a.screenshots[0].relativeFile="../outside.png",
    (a,b)=>a.screenshots[1].sha256=a.screenshots[0].sha256,
    (a,b)=>{a.url="https://8.8.8.8:44321/game";b.url=a.url},
    (a,b)=>{a.url="https://192.168.2.128:44321/game";b.url=a.url},
    (a,b)=>a.localIpv4=["8.8.8.8"],
    (a,b)=>a.localIpv4=["192.168.2.85"],
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

test("offline verifier rejects moving but divergent four-browser authoritative positions",()=>{
  // Both reports contain authentic-looking movement and increasing ticks.
  // Their inconsistent observations must not count as a shared-world flight.
  for(const change of [
    (a,b)=>{b.observed[0].find(f=>f.netId===3).x+=70},
    (a,b)=>{a.observed[1].find(f=>f.netId===1).y-=70},
  ]){
    const a=fixture("A"),b=fixture("B");
    change(a,b);
    assert.throws(()=>verifyPairEvidence(a,b),/observers disagree on authoritative fighter/);
  }
  const a=fixture("A"),b=fixture("B");
  b.observed[0].find(f=>f.netId===3).x+=4;
  assert.doesNotThrow(()=>verifyPairEvidence(a,b));
});

test("scoped real-format SERVER log must confirm two actual IPs and four assigned IDs (synthetic fixtures)",()=>{
  const a=fixture("A"),b=fixture("B");
  const lines=[
    "session 101 assigned player 1 from 192.168.2.128:40001",
    "session 102 assigned player 2 from 192.168.2.128:40002",
    "session 103 assigned player 3 from 192.168.2.130:40103",
    "session 104 assigned player 4 from 192.168.2.130:40104",
  ];
  const valid=lines.join("\n");
  const correlated=verifyServerAdmissionLog(valid,a,b);
  assert.equal(correlated.admissions,4);
  assert.equal(correlated.notReleaseApproval,true);
  assert.equal(correlated.physicalHostAttestationStillRequired,true);
  assert.deepEqual(correlated.playerNetIds,[1,2,3,4]);
  for(const invalid of [
    valid.replace("192.168.2.130:40104","192.168.2.128:40104"),
    valid.replace("player 4","player 5"),
    valid.replace("session 104","session 103"),
    valid.replace("player 4","player 3"),
    valid.replace("192.168.2.130:40104","8.8.8.8:40104"),
    valid.replace("192.168.2.130:40104","192.168.2.130:65536"),
    valid.replace("session 104","session 0"),
    valid.replace("session 104 assigned","garbage assigned"),
    lines.slice(1).join("\n"),
    valid+"\n"+"session 105 assigned player 5 from 192.168.2.130:40105",
    "",
    "x".repeat(2_000_001),
  ]) assert.throws(()=>verifyServerAdmissionLog(invalid,a,b));
  const timestamped=lines.map(s=>"2026-10-21T16:00:00Z "+s).join("\n");
  assert.equal(verifyServerAdmissionLog(timestamped,a,b).admissions,4);
});

test("capture-file verifier hashes real disk bytes, rejects missing/tampered PNG (synthetic fixture)",async()=>{
  const d=await mkdtemp(path.join(tmpdir(),"core8a-p0-pair-unit-"));
  try{
    const a=fixture("A"),b=fixture("B");
    const dir=path.join(d,"alpha-p0-hostpair-evidence");
    await mkdir(dir,{recursive:true});
    for(const e of [a,b]){
      for(let i=0;i<2;i++){
        const record=e.screenshots[i];
        // This is a TEST-ONLY minimal PNG-signature buffer; not a browser image.
        const synthetic=Buffer.alloc(700,10+((e.role==="A"?0:2)+i));
        Buffer.from("89504e470d0a1a0a","hex").copy(synthetic,0);
        record.bytes=synthetic.length;
        record.sha256=createHash("sha256").update(synthetic).digest("hex");
        await writeFile(path.join(d,record.relativeFile),synthetic);
      }
    }
    assert.equal(verifyPairEvidence(a,b).mutuallyWitnessedBrowserMovement,true);
    assert.equal((await verifyCaptureFiles(a,path.join(d,"a.json"))).length,2);
    assert.equal((await verifyCaptureFiles(b,path.join(d,"b.json"))).length,2);
    const tamper=path.join(d,b.screenshots[1].relativeFile);
    const invalid=Buffer.alloc(700,99);
    Buffer.from("89504e470d0a1a0a","hex").copy(invalid,0);
    await writeFile(tamper,invalid);
    await assert.rejects(verifyCaptureFiles(b,path.join(d,"b.json")),/PNG bytes\/hash/);
    await rm(tamper);
    await assert.rejects(verifyCaptureFiles(b,path.join(d,"b.json")),/file missing/);
  }finally{await rm(d,{recursive:true,force:true})}
});
