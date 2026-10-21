import assert from "node:assert/strict";
import test from "node:test";
import {spawnSync} from "node:child_process";
import {parseR2RemoteConfig} from "../scripts/r2-remote-acceptance-config.mjs";

const pin="0123456789abcdef".repeat(4);
const base=Object.freeze({
  MYASO_R2_REMOTE_TEST_ONLY:"1",
  MYASO_R2_STAGING_OWNER_ATTESTED:"YES",
  MYASO_R2_REMOTE_PLAYER_CAP:"2",
  MYASO_R2_REMOTE_ALLOW_HOST:"10.8.1.5",
  MYASO_R2_REMOTE_URL:"https://10.8.1.5:4433/game",
  MYASO_R2_REMOTE_CERT_SHA256:pin,
});
const configuration=override=>parseR2RemoteConfig({...base,...override});

test("explicitly approved separate-host staging URL and certificate are immutable",()=>{
  const result=configuration();
  assert.equal(result.gameUrl,"https://10.8.1.5:4433/game");
  assert.equal(result.expectedHost,"10.8.1.5");
  assert.equal(result.certificateSha256,pin);
  assert.equal(result.playerCap,2);
  assert.equal(result.stagingOnly,true);
  assert.ok(Object.isFrozen(result));
});

test("cannot run two-host runner without owner approval or cap=2 staging attestation",()=>{
  for(const override of [
    {MYASO_R2_REMOTE_TEST_ONLY:"0"},
    {MYASO_R2_STAGING_OWNER_ATTESTED:"NO"},
    {MYASO_R2_REMOTE_PLAYER_CAP:"3"},
    {MYASO_R2_REMOTE_PLAYER_CAP:""},
  ])assert.throws(()=>configuration(override),/require/);
});

test("rejects loopback, production host, other ports and arbitrary destinations",()=>{
  for(const override of [
    {MYASO_R2_REMOTE_ALLOW_HOST:"127.0.0.1",MYASO_R2_REMOTE_URL:"https://127.0.0.1:4433/game"},
    {MYASO_R2_REMOTE_ALLOW_HOST:"localhost",MYASO_R2_REMOTE_URL:"https://localhost:4433/game"},
    {MYASO_R2_REMOTE_ALLOW_HOST:"game.open-trust-layer.org",MYASO_R2_REMOTE_URL:"https://game.open-trust-layer.org:4433/game"},
    {MYASO_R2_REMOTE_ALLOW_HOST:"test.open-trust-layer.org",MYASO_R2_REMOTE_URL:"https://test.open-trust-layer.org:4433/game"},
    {MYASO_R2_REMOTE_ALLOW_HOST:"10.8.1.5",MYASO_R2_REMOTE_URL:"https://10.8.1.6:4433/game"},
    {MYASO_R2_REMOTE_URL:"http://10.8.1.5:4433/game"},
    {MYASO_R2_REMOTE_URL:"https://10.8.1.5:4433/"},
    {MYASO_R2_REMOTE_URL:"https://10.8.1.5:4433/game?token=forbidden"},
    {MYASO_R2_REMOTE_URL:"https://user:pass@10.8.1.5:4433/game"},
    {MYASO_R2_REMOTE_URL:"https://10.8.1.5/game"},
    {MYASO_R2_REMOTE_ALLOW_HOST:"10.8.1.5/evil"},
    {MYASO_R2_REMOTE_ALLOW_HOST:""},
  ])assert.throws(()=>configuration(override),undefined,JSON.stringify(override));
});

test("rejects certificate mismatches and missing certificate pins",()=>{
  for(const cert of ["","a".repeat(63),"q".repeat(64),"0x"+pin,"00:".repeat(32)]) {
    assert.throws(()=>configuration({MYASO_R2_REMOTE_CERT_SHA256:cert}),/certificate/);
  }
  assert.equal(configuration({MYASO_R2_REMOTE_CERT_SHA256:pin.toUpperCase()}).certificateSha256,pin);
});

test("unapproved remote runner terminates before opening a browser or network",()=>{
  const result=spawnSync(process.execPath,["scripts/r2-remote-abrupt-close-acceptance.mjs"],{
    cwd:process.cwd(),env:{...process.env,MYASO_R2_REMOTE_TEST_ONLY:"0"},encoding:"utf8",timeout:3000,
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/staging-only attestation/);
});
