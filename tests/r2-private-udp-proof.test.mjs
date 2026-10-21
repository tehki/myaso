import assert from "node:assert/strict";
import test from "node:test";
import dgram from "node:dgram";
import {
  config, privateIPv4, encodePing, decodePing, encodePong, decodePong, run,
} from "../scripts/r2-private-udp-proof.mjs";

const staging = Object.freeze({
  MYASO_R2_PRIVATE_PROBE_ONLY: "1",
  MYASO_R2_STAGING_OWNER_ATTESTED: "YES",
  MYASO_R2_UDP_BIND: "10.8.1.6",
  MYASO_R2_UDP_PEER: "10.8.1.5",
  MYASO_R2_UDP_PORT: "41439",
});
const parse = changes => config({ ...staging, ...changes });

test("private operator-attested addresses are exact and immutable", () => {
  assert.deepEqual(parse(), {bind:"10.8.1.6",peer:"10.8.1.5",port:41439});
  assert.ok(Object.isFrozen(parse()));
  for (const ip of ["10.0.0.1","172.16.255.1","172.31.0.1","192.168.100.32"]) assert.ok(privateIPv4(ip));
  for (const ip of ["127.0.0.1","0.0.0.0","::1","172.32.0.1","169.254.1.1","8.8.8.8","256.0.0.1",null]) assert.equal(privateIPv4(ip),false);
});

test("fail closed on missing approval, public endpoints, self-peering and privileged ports", () => {
  for (const changes of [
    {MYASO_R2_PRIVATE_PROBE_ONLY:"0"},
    {MYASO_R2_STAGING_OWNER_ATTESTED:"NO"},
    {MYASO_R2_UDP_BIND:"127.0.0.1"},
    {MYASO_R2_UDP_BIND:"8.8.8.8"},
    {MYASO_R2_UDP_PEER:"8.8.8.8"},
    {MYASO_R2_UDP_PEER:"10.8.1.6"},
    {MYASO_R2_UDP_PORT:"443"},
    {MYASO_R2_UDP_PORT:"0"},
    {MYASO_R2_UDP_PORT:"65536"},
    {MYASO_R2_UDP_PORT:"41439abc"},
    {MYASO_R2_UDP_PORT:"041439"},
  ]) assert.throws(() => parse(changes), Error, JSON.stringify(changes));
});

test("PING and PONG codec require exact version, size, and replay challenge bytes", () => {
  const token="0123456789abcdef0123456789abcdef";
  const ping=encodePing(token), pong=encodePong(token);
  assert.equal(decodePing(ping),token);
  assert.equal(decodePong(pong),token);
  assert.equal(decodePing(pong),null);
  assert.equal(decodePong(ping),null);
  assert.equal(decodePing(Buffer.concat([ping,Buffer.from([0])])),null);
  assert.equal(decodePong(Buffer.concat([pong,Buffer.from([0])])),null);
  assert.equal(decodePing(Buffer.from("MYASO_R2_V0_PING:"+token)),null);
  assert.throws(()=>encodePing("hello"),TypeError);
  assert.throws(()=>encodePong("A".repeat(32)),TypeError);
});

test("same-host loopback verifies actual UDP ACK path, not mere sendto", async () => {
  const reserve=dgram.createSocket("udp4");
  const port=await new Promise((ok,fail)=> {
    reserve.once("error",fail);
    reserve.bind(0,"127.0.0.1",()=>ok(reserve.address().port));
  });
  reserve.close();
  const traces=[];
  const io={log:v=>traces.push(v),error:v=>traces.push(v)};
  const listener=run("listen",{bind:"127.0.0.1",peer:"127.0.0.1",port},io);
  // Wait briefly for listener to bind; all sockets are under this test process.
  await new Promise(ok=>setTimeout(ok,50));
  const client=await run("probe",{bind:"127.0.0.1",peer:"127.0.0.1",port},io);
  const host=await listener;
  assert.equal(client.result,"ACK_RECEIVED");
  assert.equal(client.routeProven,true);
  assert.equal(client.acknowledgements,1);
  assert.ok(client.roundTripMs>=0);
  assert.equal(host.result,"PING_RECEIVED_ACK_SENT");
  assert.equal(host.oneWayReceiveConfirmed,true);
  assert.equal(host.routeProven,false);
  assert.ok(traces.some(x=>x.includes("ACK_RECEIVED")));
  // This deliberately tests only an isolated loopback kernel UDP roundtrip.
  // It provides NO evidence that two actual machines can exchange packets.
});
