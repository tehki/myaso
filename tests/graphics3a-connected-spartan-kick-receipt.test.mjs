import test from "node:test";
import assert from "node:assert/strict";
import {summarizeSpartanConnectedKickFlight} from "../scripts/graphics3a-spartan-connected-receipt.mjs";
import {readFileSync} from "node:fs";

const transitions=[
 {action:2,epochMs:1000}, {action:12,epochMs:1150},
 {action:13,epochMs:1230},{action:14,epochMs:1300},{action:0,epochMs:1540}
];
const base=()=>({
 attackerTransitions:structuredClone(transitions),
 defenderTransitions:structuredClone(transitions),
 clients:[
  {engine:"chrome",netId:1,serverConnected:true,probeInstalled:true,
   draws:[{frame:0,direction:6,epochMs:1160},{frame:2,direction:6,epochMs:1180},
    {frame:3,direction:6,epochMs:1270},{frame:5,direction:6,epochMs:1340}]},
  {engine:"firefox",netId:2,serverConnected:true,probeInstalled:true,
   draws:[{frame:0,direction:6,epochMs:1210},{frame:5,direction:6,epochMs:1450}]},
 ]
});
const error=(message,edit)=>{
 const data=base();edit(data);
 assert.throws(()=>summarizeSpartanConnectedKickFlight(data),new RegExp(message));
};
test("connected receipt retains genuine two-identity evidence while refusing to claim Greyhaven ground or hit",()=>{
 const p=summarizeSpartanConnectedKickFlight(base());
 assert.equal(p.verifiedRealConnectedServer,true);
 assert.deepEqual(p.authenticServerNetIds,[1,2]);
 assert.equal(p.nativeBrowserSourceDraws.length,2);
 assert.equal(p.nativeBrowserSourceDraws[0].hasContactFrame,true);
 assert.equal(p.nativeBrowserSourceDraws[1].hasContactFrame,false);
 assert.equal(p.floorContactValidated,false);
 assert.equal(p.hitReceiptValidated,false);
 assert.equal(p.exactServerPhaseStartValidated,false);
 assert.equal(p.realGreyhavenCityValidated,false);
});
test("real-flight attestation fails closed on no server or fake identity",()=>{
 error("authoritative server netId",data=>{data.clients[0].netId=0;});
 error("server-authorized identities",data=>{data.clients[1].netId=1;});
 error("mocked/disconnected",data=>{data.clients[1].serverConnected=false;});
 error("strict original source drawImage probe",data=>{data.clients[0].probeInstalled=false;});
 error("two separate browser",data=>{data.clients.pop();});
});
test("real-flight phase evidence rejects stale and forged clip frames",()=>{
 error("real windup",data=>{data.clients[1].draws=data.clients[1].draws.slice(1);});
 error("real recovery",data=>{data.clients[0].draws=data.clients[0].draws.slice(0,3);});
 error("real contact",data=>{data.clients[0].draws=data.clients[0].draws.filter(x=>x.frame!==3);});
 error("out-of-range kick",data=>{data.clients[0].draws[0].frame=8;});
 error("out-of-range direction",data=>{data.clients[0].draws[0].direction=-1;});
 error("browser paint timestamp",data=>{data.clients[0].draws[0].epochMs=NaN;});
 error("defender must receive attacker ordered",data=>{data.defenderTransitions=[];});
 error("attacker must receive authoritative ordered",data=>{data.attackerTransitions=[];});
 error("attacker must receive authoritative ordered",data=>{
   data.attackerTransitions=[data.attackerTransitions[0],
     data.attackerTransitions[2],data.attackerTransitions[1],
     data.attackerTransitions[3],data.attackerTransitions[4]];
 });
 error("defender must receive attacker ordered",data=>{
   data.defenderTransitions=data.defenderTransitions.filter(x=>x.action!==13);
 });
});
test("opt-in flight never silently affects normal M133 PvP browser acceptance",()=>{
 const txt=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
 assert.match(txt,/MYASO_GRAPHICS3A_SPARTAN_FLIGHT/);
 assert.match(txt,/spartanFlight && scenario !== "uikickbuffer"/);
 assert.match(txt,/if \(spartanFlight\) \{/);
 assert.match(txt,/url\.searchParams\.set\("knightKickSource",\s*"1"\)/);
 assert.match(txt,/graphics3aSpartanReceipt: spartanReceipt/);
 assert.match(txt,/window\.__graphics3aSpartanDrawProbe/);
 assert.match(txt,/new RegExp\("player #\(\[0-9\]\+\)"\)/);
 assert.doesNotMatch(txt,/window\.\_\_GRAPHICS3A.*= .*mockAction/);
});
