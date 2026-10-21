// Offline reviewer for TWO separately collected REAL host-pair flight reports.
// A valid JSON pair is NOT cryptographic proof of physical host independence;
// match server-side QUIC logs + actual machine identities before release.
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve,dirname,sep} from "node:path";
import {pathToFileURL} from "node:url";
import {privateIpv4} from "./alpha_p0_host_pair_config.mjs";

const fail=(m)=>{throw Error("P0 multi-host evidence: "+m)};
const ids=x=>[...x].sort((a,b)=>a-b).join(",");
const validActors=x=>Array.isArray(x)&&x.length===4&&x.every(f=>
  Number.isSafeInteger(f.netId)&&f.netId>0&&Number.isFinite(f.x)&&Number.isFinite(f.y));
function moved(from,to,id){
  const a=from.find(x=>x.netId===id),b=to.find(x=>x.netId===id);
  return !!a&&!!b&&Math.hypot(a.x-b.x,a.y-b.y)>4;
}
function checkOne(e,role){
  if(!e||e.role!==role||e.marker!=="MYASO_P0_PAIR_LIVE_REMOTE_MOVE_PASS"
    ||e.kind!=="P0_REAL_W3C_PAIR_STAGING"||e.serverCapAttested!==4
    ||e.twoNativeIndependentW3cClients!==true||e.authenticatedRemoteQuic!==true
    ||e.crossHostMovementSeenByChromeAndFirefox!==true)fail(role+" invalid flight marker");
  if(!Array.isArray(e.clientFamilies)||ids(e.clientFamilies)!=="chrome,firefox")fail(role+" wrong real browser families");
  // The JSON report alone cannot attest pixels or operating-system identity;
  // an operator must compare these SHA-256 digests to actual local PNG files.
  if(!Array.isArray(e.screenshots)||e.screenshots.length!==2
    ||e.screenshots.some((p,i)=>
      p.family!==["chrome","firefox"][i]
      ||p.relativeFile!==`alpha-p0-hostpair-evidence/pair-${role.toLowerCase()}-${p.family}.png`
      ||!Number.isSafeInteger(p.bytes)||p.bytes<=256
      ||!(/^[a-f0-9]{64}$/.test(p.sha256||""))
      ||!Number.isSafeInteger(p.driverPid)||p.driverPid<=0
      ||!(/^[a-z0-9-]{16,80}$/i.test(p.w3cSessionId||""))))
    fail(role+" missing genuine browser screenshot/process references");
  if(e.screenshots[0].w3cSessionId===e.screenshots[1].w3cSessionId
    ||e.screenshots[0].driverPid===e.screenshots[1].driverPid
    ||e.screenshots[0].sha256===e.screenshots[1].sha256)
    fail(role+" duplicate WebDriver/process/screenshots");
  if(!Array.isArray(e.localIds)||e.localIds.length!==2
    ||new Set(e.localIds).size!==2||!e.localIds.every(x=>Number.isSafeInteger(x)&&x>0))fail(role+" bad local identities");
  if(!Array.isArray(e.allIds)||e.allIds.length!==4||new Set(e.allIds).size!==4)fail(role+" no four fighters");
  if(!Array.isArray(e.remoteIds)||e.remoteIds.length!==2
    ||ids([...e.localIds,...e.remoteIds])!==ids(e.allIds))fail(role+" wrong remote identities");
  if(e.actorId!==e.localIds[0]||!e.remoteIds.includes(e.remoteMovedId))fail(role+" wrong mover IDs");
  if(typeof e.osHost!=="string"||!e.osHost||typeof e.hostId!=="string"||!e.hostId
    ||typeof e.peerHostId!=="string"||!e.peerHostId)fail(role+" missing host attestation");
  if(!Array.isArray(e.localIpv4)||e.localIpv4.length===0
    ||!e.localIpv4.every(privateIpv4))fail(role+" invalid private client addresses");
  let server;
  try{server=new URL(e.url)}catch{fail(role+" malformed remote server URL")}
  if(server.protocol!=="https:"||server.pathname!=="/game"||!server.port
    ||!privateIpv4(server.hostname)||server.username||server.password
    ||server.search||server.hash||e.localIpv4.includes(server.hostname)
    ||!/^[0-9a-f]{64}$/.test(e.certificateSha256||""))
    fail(role+" malformed or untrusted private pinned server URL");
  if(!Number.isSafeInteger(e.start)||!Number.isSafeInteger(e.movedAt)
    ||e.movedAt<e.start+(role==="A"?650:6300)
    ||e.movedAt>e.start+(role==="A"?5000:12000))fail(role+" invalid UTC movement barrier");
  if(!Array.isArray(e.baseline)||!Array.isArray(e.observed)
    ||e.baseline.length!==2||e.observed.length!==2
    ||!Array.isArray(e.serverTicksBefore)||!Array.isArray(e.serverTicksAfter)
    ||e.serverTicksBefore.length!==2||e.serverTicksAfter.length!==2)fail(role+" missing two WebDriver witnesses");
  for(let i=0;i<2;i++){
    if(!validActors(e.baseline[i])||!validActors(e.observed[i])
      ||ids(e.baseline[i].map(f=>f.netId))!==ids(e.allIds)
      ||ids(e.observed[i].map(f=>f.netId))!==ids(e.allIds)
      ||!Number.isSafeInteger(e.serverTicksBefore[i])||!Number.isSafeInteger(e.serverTicksAfter[i])
      ||e.serverTicksAfter[i]<=e.serverTicksBefore[i])fail(role+" stale or mismatched snapshot");
    if(!moved(e.baseline[i],e.observed[i],e.actorId)
      ||!moved(e.baseline[i],e.observed[i],e.remoteMovedId))
      fail(role+" Chrome/Firefox lacks real local and remote movement");
  }
}
export function verifyPairEvidence(first,second){
  const byRole=new Map([[first?.role,first],[second?.role,second]]);
  if(byRole.size!==2||!byRole.has("A")||!byRole.has("B"))fail("require one A and one B evidence");
  const A=byRole.get("A"),B=byRole.get("B");
  checkOne(A,"A");checkOne(B,"B");
  if(A.hostId===B.hostId||A.osHost===B.osHost
    ||A.peerHostId!==B.hostId||B.peerHostId!==A.hostId
    ||A.localIpv4.some(ip=>B.localIpv4.includes(ip)))fail("host identities/IPs not distinct");
  if(A.start!==B.start||A.url!==B.url||A.certificateSha256!==B.certificateSha256
    ||ids(A.allIds)!==ids(B.allIds))fail("client hosts did not observe same pinned authority and four players");
  if(A.localIds.some(x=>B.localIds.includes(x))
    ||ids([...A.localIds,...B.localIds])!==ids(A.allIds))fail("client host identity sets overlap");
  if(A.remoteMovedId!==B.actorId||B.remoteMovedId!==A.actorId
    ||ids(A.remoteIds)!==ids(B.localIds)
    ||ids(B.remoteIds)!==ids(A.localIds))fail("no mutual across-machine mover correlation");
  // Each of the FOUR native Chrome/Firefox browser witnesses must converge
  // on the same SERVER-OWNED fighter positions after both gestures settle.
  // Independent "moved >4" checks alone permit completely divergent worlds.
  // The 18-world-unit bound is an acceptance tolerance, NOT game authority.
  const fourWitnesses=[...A.observed,...B.observed];
  for(const netId of A.allIds){
    const positions=fourWitnesses.map(frame=>frame.find(f=>f.netId===netId));
    for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++){
      if(Math.hypot(positions[i].x-positions[j].x,positions[i].y-positions[j].y)>18)
        fail("native browser observers disagree on authoritative fighter "+netId);
    }
  }
  return Object.freeze({
    status:"EVIDENCE_STRUCTURALLY_CONSISTENT_REQUIRES_SERVER_LOGS",
    server:A.url,roles:["A","B"],attestedHosts:[A.hostId,B.hostId],
    physicalHostAttestationStillRequired:true,
    fourAuthenticatedQuicClientReports:true,
    mutuallyWitnessedBrowserMovement:true,
    serverCapAttestedOnly:true,
    notReleaseApproval:true
  });
}
// Report JSON alone is insufficient: hash the original screenshots on disk.
// Optional bounded SOURCE-SERVER admission-log correlation.
// Only a separately collected Rust/WebTransport server log can establish
// which authenticated net IDs actually arrived from which client-host IP.
// The log is still operator-provided text, not cryptographic host attestation.
export function verifyServerAdmissionLog(contents,first,second){
  const pair=verifyPairEvidence(first,second);
  if(typeof contents!=="string"||contents.length===0||contents.length>2_000_000)
    fail("missing or oversized scoped original server admission log");
  const roles=new Map([[first.role,first],[second.role,second]]);
  const A=roles.get("A"),B=roles.get("B");
  const expected=new Map();
  for(const host of [A,B])for(const netId of host.localIds)expected.set(netId,host);
  const seenPlayers=new Set(),seenSessions=new Set(),seenHosts=new Set();
  let count=0;
  for(const line of contents.split(/\r?\n/)){
    if(!line.includes("assigned player"))continue;
    // Exact server/src/main.rs format; only an optional timestamp prefix is
    // permitted. Refuse log lines that resemble an admission but differ.
    const m=/^(?:[^\r\n]{0,120}\s)?session ([1-9][0-9]*) assigned player ([1-9][0-9]*) from ((?:[0-9]{1,3}\.){3}[0-9]{1,3}):([0-9]{1,5})$/.exec(line.trim());
    if(!m)fail("malformed or unsupported authoritative admission line");
    const [,sessionId,playerText,ip,portText]=m;
    const player=Number(playerText),port=Number(portText);
    if(!Number.isSafeInteger(player)||!expected.has(player)||!privateIpv4(ip)
      ||port<1||port>65535||seenSessions.has(sessionId)||seenPlayers.has(player))
      fail("duplicate, foreign or malformed server admission");
    const host=expected.get(player);
    if(!host.localIpv4.includes(ip))fail("server source IP does not match client's reported private address");
    seenSessions.add(sessionId);seenPlayers.add(player);seenHosts.add(host.role);
    count++;
  }
  if(count!==4||seenPlayers.size!==4||seenHosts.size!==2)
    fail("server log must contain exactly four distinct current-session admissions");
  return Object.freeze({
    status:"SERVER_ADMISSIONS_CORRELATED_REQUIRES_REAL_HOST_AND_INPUT_ATTESTATION",
    server:pair.server,admissions:count,
    playerNetIds:[...seenPlayers].sort((a,b)=>a-b),
    physicalHostAttestationStillRequired:true,
    serverMovementLogReviewStillRequired:true,
    notReleaseApproval:true,
  });
}

export async function verifyCaptureFiles(report,reportFile){
  if(!report || !Array.isArray(report.screenshots) || report.screenshots.length!==2)
    fail("missing two native screenshot records");
  const base=dirname(resolve(reportFile));
  const verified=[];
  for(const image of report.screenshots){
    const pathname=resolve(base,image.relativeFile);
    if(!pathname.startsWith(base+sep))fail("screenshot path escapes report directory");
    let pixels;
    try{pixels=await readFile(pathname)}
    catch{fail("genuine screenshot file missing: "+image.relativeFile)}
    if(pixels.length!==image.bytes||pixels.length<=256
      ||!pixels.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex"))
      ||createHash("sha256").update(pixels).digest("hex")!==image.sha256)
      fail("PNG bytes/hash do not match W3C report: "+image.relativeFile);
    verified.push({family:image.family,bytes:pixels.length,sha256:image.sha256});
  }
  return Object.freeze(verified);
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  if(process.argv.length!==4&&process.argv.length!==5){console.error("Usage: node scripts/alpha_p0_host_pair_verify.mjs <A-evidence.json> <B-evidence.json> [scoped-server-log.txt]");process.exitCode=2}
  else try{
    const a=JSON.parse(await readFile(process.argv[2],"utf8"));
    const b=JSON.parse(await readFile(process.argv[3],"utf8"));
    const structural=verifyPairEvidence(a,b);
    const screenshotsA=await verifyCaptureFiles(a,process.argv[2]);
    const screenshotsB=await verifyCaptureFiles(b,process.argv[3]);
    console.log("MYASO_P0_PAIR_EVIDENCE_FILES_VERIFIED "+JSON.stringify({screenshotsA,screenshotsB}));
    console.log("MYASO_P0_PAIR_STRUCTURAL_CHECK "+JSON.stringify(structural));
    if(process.argv[4]){
      const log=await readFile(process.argv[4],"utf8");
      console.log("MYASO_P0_PAIR_SERVER_ADMISSION_CORRELATION "+JSON.stringify(
        verifyServerAdmissionLog(log,a,b)));
    }
  }catch(e){console.error("MYASO_P0_PAIR_STRUCTURAL_FAIL "+e.message);process.exitCode=1}
}
