import assert from "node:assert/strict";
import test from "node:test";
import {resolveInstantLmbProfile} from "../src/browser/instant-lmb-activation.mjs";
import {parseAlphaConfig,alphaPlayPath} from "../web/alpha-config.mjs";

const config={serverUrl:"https://game.open-trust-layer.org:4433/game",certificateSha256:"ab".repeat(32),maxPlayers:8};
const page=(extra="")=>new URL("https://game.open-trust-layer.org/web/?server="+encodeURIComponent(config.serverUrl)+"&cert="+config.certificateSha256+extra);
const served=raw=>async(path,options)=>{
  assert.equal(path,"/game-config.json");assert.equal(options.cache,"no-store");
  assert.equal(options.credentials,"same-origin");return {ok:true,json:async()=>raw};
};

test("instant Light release profile requires an explicit trusted flag and exact TLS endpoint/pin",async()=>{
  assert.equal((await resolveInstantLmbProfile(page("&instantLmb=1"),served(config))).enabled,false);
  const enabled={...config,instantLmbEnabled:true};
  assert.deepEqual(await resolveInstantLmbProfile(page("&instantLmb=1"),served(enabled)),{enabled:true,kind:"release"});
  for(const url of [page(),page("&instantLmb=1&instantLmbPreview=1"),page("&instantLmb=1&gestureLab=1")])
    assert.equal((await resolveInstantLmbProfile(url,served(enabled))).enabled,false);
  const wrongPin=page("&instantLmb=1");wrongPin.searchParams.set("cert","cd".repeat(32));
  assert.equal((await resolveInstantLmbProfile(wrongPin,served(enabled))).enabled,false);
  const wrongHost=page("&instantLmb=1");wrongHost.hostname="untrusted.example";
  assert.equal((await resolveInstantLmbProfile(wrongHost,served(enabled))).enabled,false);
  assert.equal((await resolveInstantLmbProfile(page("&instantLmb=1"),async()=>{throw Error("offline");})).enabled,false);
});

test("loopback preview cannot authorize a public endpoint or masquerade as the release profile",async()=>{
  const preview=new URL("http://127.0.0.1/web/?instantLmbPreview=1&server=https%3A%2F%2F127.0.0.1%3A4433%2Fgame");
  assert.deepEqual(await resolveInstantLmbProfile(preview),{enabled:true,kind:"preview"});
  preview.searchParams.set("server",config.serverUrl);
  assert.equal((await resolveInstantLmbProfile(preview)).enabled,false);
  preview.searchParams.set("instantLmb","1");
  assert.equal((await resolveInstantLmbProfile(preview)).enabled,false);
});

test("operator config preserves legacy defaults and publishes only a validated instant Light opt-in",()=>{
  assert.equal(parseAlphaConfig(config).instantLmbEnabled,undefined);
  assert.equal(new URL(alphaPlayPath(parseAlphaConfig(config)),"https://example.com").searchParams.has("instantLmb"),false);
  const enabled=parseAlphaConfig({...config,instantLmbEnabled:true,chatC1Enabled:true});
  const path=new URL(alphaPlayPath(enabled),"https://example.com");
  assert.equal(path.searchParams.get("instantLmb"),"1");assert.equal(path.searchParams.get("chatC1"),"1");
  assert.throws(()=>parseAlphaConfig({...config,instantLmbEnabled:"1"}),/boolean/);
});
