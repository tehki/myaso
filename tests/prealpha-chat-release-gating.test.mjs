import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {parseAlphaConfig, alphaPlayPath} from "../web/alpha-config.mjs";
import {isChatC1PreviewEligible, isChatC1ReleaseEligible, isChatC1Eligible, isTrustedChatC1ReleaseConfigured} from "../src/browser/chat-c1-activation.mjs";

const config = { serverUrl:"https://game.open-trust-layer.org:4433/game",
  certificateSha256:"a".repeat(64), maxPlayers:4 };
const location = (protocol,hostname,search)=>({protocol,hostname,search});

test("Chat C1 release is off by default: only explicit trusted lobby config offers public chat",()=>{
  const no=alphaPlayPath(parseAlphaConfig(config));
  const yes=alphaPlayPath(parseAlphaConfig({...config,chatC1Enabled:true}));
  assert.equal(new URL(no,"https://game.open-trust-layer.org").searchParams.has("chatC1"),false);
  assert.equal(new URL(yes,"https://game.open-trust-layer.org").searchParams.get("chatC1"),"1");
  assert.equal(new URL(yes,"https://game.open-trust-layer.org").searchParams.get("knights"),"1");
  assert.equal(isChatC1Eligible(location("https:","game.open-trust-layer.org",new URL(no,"https://game.open-trust-layer.org").search)),false);
  assert.equal(isChatC1ReleaseEligible(location("https:","game.open-trust-layer.org",new URL(yes,"https://game.open-trust-layer.org").search)),true);
  for(const value of ["1", 1, null, {}, "true", false]) {
    if(value === false){ assert.equal(parseAlphaConfig({...config,chatC1Enabled:false}).chatC1Enabled,undefined);continue; }
    assert.throws(()=>parseAlphaConfig({...config,chatC1Enabled:value}));
  }
});
test("Preview token cannot enable release chat on public origin; no remote-origin flag substitution",()=>{
  assert.equal(isChatC1PreviewEligible(location("http:","127.0.0.1","?server=https://test&chatC1Preview=1")),true);
  for(const where of [
    location("https:","evil.example","?server=x&cert=y&chatC1=1"),
    location("https:","game.open-trust-layer.org","?server=x&cert=y&chatC1Preview=1"),
    location("http:","game.open-trust-layer.org","?server=x&cert=y&chatC1=1"),
    location("https:","game.open-trust-layer.org","?server=x&chatC1=1"),
    location("https:","game.open-trust-layer.org","?cert=y&chatC1=1"),
    location("https:","game.open-trust-layer.org","?server=x&cert=y&chatC1=1&chatC1Preview=1"),
  ]) assert.equal(isChatC1Eligible(where),false);
});
test("Rust chat stream requires explicit operator flag with prior game/auth admission",()=>{
  const code=readFileSync(new URL("../server/src/main.rs",import.meta.url),"utf8");
  assert.match(code,/MYASO_CHAT_C1_ENABLED/);
  assert.match(code,/Ok\("0"\) \| Err\(env::VarError::NotPresent\) => false/);
  assert.match(code,/if game\.chat_enabled && !chat_started/);
  assert.match(code,/LocalChatHub/);
  const ui=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  assert.match(ui,/isChatC1Eligible\(window\.location\)/);
  assert.match(ui,/activateChatC1Preview/);
  const activation=readFileSync(new URL("../src/browser/chat-c1-activation.mjs",import.meta.url),"utf8");
  assert.match(activation,/installLocalChat\(doc/);
});
test("Release packet and UI are non-privileged and never use an additional combat socket",()=>{
  const ui=readFileSync(new URL("../src/browser/chat-c1-activation.mjs",import.meta.url),"utf8");
  const net=readFileSync(new URL("../src/network/chat-codec.mjs",import.meta.url),"utf8");
  assert.match(ui,/gameClient\.transport/);
  assert.doesNotMatch(ui,/new WebTransport|new WebSocket/);
  assert.match(net,/createUnidirectionalStream/);
  const client=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  assert.match(client,/activateChatC1Preview/);
  assert.match(client,/canvas\.addEventListener\("blur", releaseInputs\)/);
  assert.match(client,/current authenticated WebTransport connection/);
});

test("Trusted public config is the second browser C1 gate: URL alone never activates chat",async()=>{
 const cert="ab".repeat(32),serverUrl=config.serverUrl;
 const url=location("https:","game.open-trust-layer.org",
   "?server="+encodeURIComponent(serverUrl)+"&cert="+cert+"&chatC1=1");
 const get=(record)=>async (path,options)=>{
   assert.equal(path,"/game-config.json");
   assert.equal(options.credentials,"same-origin");
   assert.equal(options.cache,"no-store");
   return {ok:true,json:async()=>record};
 };
 assert.equal(await isTrustedChatC1ReleaseConfigured(url,get({...config,certificateSha256:cert})),false);
 assert.equal(await isTrustedChatC1ReleaseConfigured(url,get({...config,certificateSha256:cert,chatC1Enabled:false})),false);
 assert.equal(await isTrustedChatC1ReleaseConfigured(url,get({...config,certificateSha256:cert,chatC1Enabled:true})),true);
 const wrongCert=location("https:","game.open-trust-layer.org",
   "?server="+encodeURIComponent(serverUrl)+"&cert="+("cd".repeat(32))+"&chatC1=1");
 assert.equal(await isTrustedChatC1ReleaseConfigured(wrongCert,get({...config,certificateSha256:cert,chatC1Enabled:true})),false);
 assert.equal(await isTrustedChatC1ReleaseConfigured(url,async()=>({ok:false})),false);
 assert.equal(await isTrustedChatC1ReleaseConfigured(url,async()=>{throw Error("offline")}),false);
});
