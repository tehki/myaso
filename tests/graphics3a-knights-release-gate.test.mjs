import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {test} from "node:test";
import {parseAlphaConfig,alphaPlayPath} from "../web/alpha-config.mjs";
import {KNIGHT_CLIPS} from "../web/knight-sprites.mjs";

const originalConfig=Object.freeze({
  serverUrl:"https://game.open-trust-layer.org:4433/game",
  certificateSha256:"a".repeat(64), maxPlayers:4,
});
const launch=(cfg)=>new URL(alphaPlayPath(parseAlphaConfig(cfg)),"https://game.open-trust-layer.org");

test("ready Silver 5 release is disabled unless trusted operator explicitly selects relit art",()=>{
  const baseline=launch(originalConfig);
  assert.equal(baseline.pathname,"/web/");
  assert.equal(baseline.searchParams.get("knights"),"1");
  assert.equal(baseline.searchParams.get("server"),originalConfig.serverUrl);
  assert.equal(baseline.searchParams.get("cert"),originalConfig.certificateSha256);
  assert.equal(baseline.searchParams.has("knightArt"),false);
  assert.equal(baseline.searchParams.has("knightDashArt"),false);
  for(const flag of [undefined,false]){
    const cfg={...originalConfig};
    if(flag!==undefined)cfg.silverKnightRelitEnabled=flag;
    const path=launch(cfg);
    assert.equal(path.searchParams.has("knightArt"),false);
    assert.equal(parseAlphaConfig(cfg).silverKnightRelitEnabled,undefined);
  }
});

test("strict optional first-party launcher switch can release exactly four relit actions plus immutable original Roll",()=>{
  const candidate=launch({...originalConfig,silverKnightRelitEnabled:true,chatC1Enabled:true});
  assert.equal(candidate.searchParams.get("knights"),"1");
  assert.equal(candidate.searchParams.get("knightArt"),"relit");
  assert.equal(candidate.searchParams.get("chatC1"),"1");
  assert.equal(candidate.searchParams.has("knightDashArt"),false);
  assert.equal(candidate.searchParams.has("knightKickSource"),false);
  assert.equal(candidate.searchParams.has("knightKickV3"),false);
  assert.equal(candidate.searchParams.has("knightKnockdown"),false);
  assert.deepEqual(Object.keys(KNIGHT_CLIPS).sort(),
    ["silver_idle","silver_jump","silver_roll","silver_sprint","silver_walk"]);
  const client=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  assert.match(client,/params\.get\("knights"\) === "1"/);
  assert.match(client,/params\.get\("knightArt"\) === "relit"/);
  assert.match(client,/createKnightSpriteRenderer/);
});

test("untrusted or malformed release flags fail closed; config rollback restores byte-identical original launch",()=>{
  for(const value of ["true","1",1,null,{},[],0]){
    assert.throws(()=>parseAlphaConfig({...originalConfig,silverKnightRelitEnabled:value}),TypeError);
  }
  const enabled=launch({...originalConfig,silverKnightRelitEnabled:true});
  const disabled=launch({...originalConfig,silverKnightRelitEnabled:false});
  const original=launch(originalConfig);
  assert.equal(enabled.searchParams.get("knightArt"),"relit");
  assert.equal(disabled.href,original.href);
  assert.equal(enabled.searchParams.get("server"),original.searchParams.get("server"));
  assert.equal(enabled.searchParams.get("cert"),original.searchParams.get("cert"));
});


test("ready-five release manifest is immutable five REAL source assets; excludes unqualified Dash Kick Knockdown from runtime",()=>{
  const packet=JSON.parse(readFileSync(new URL("../docs/releases/knights-p0-20261023/ready-five-manifest.json",import.meta.url),"utf8"));
  assert.equal(packet.status,"READY_FOR_MAIN_RELEASE_DECISION_NOT_DEPLOYED");
  assert.equal(packet.promotionGate.disabledByDefault,true);
  assert.equal(packet.promotionGate.configField,"silverKnightRelitEnabled");
  assert.equal(packet.promotionGate.urlQueryAdded,"knightArt=relit");
  assert.equal(packet.readyMotions.length,5);
  assert.deepEqual(packet.readyMotions.map(a=>a.motion),["Idle","Walk","Sprint","Jump","Roll"]);
  for (const a of packet.readyMotions){
    assert.equal(a.directions,8);
    assert.deepEqual(a.pixelFrame,[160,160]);
    const bytes=readFileSync(new URL("../"+a.relativePath,import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"),a.sha256);
    assert.equal(bytes.length,a.bytes);
  }
  assert.equal(packet.excludedFromGameplayRelease.length,4);
  assert.ok(packet.excludedFromGameplayRelease.some(a=>/Dash/.test(a.motion)));
  assert.ok(packet.excludedFromGameplayRelease.some(a=>/Kick/.test(a.motion)));
  assert.ok(packet.excludedFromGameplayRelease.some(a=>/Knockdown/.test(a.motion)));
  const doc=readFileSync(new URL("../docs/releases/knights-p0-20261023/README.md",import.meta.url),"utf8");
  assert.match(doc,/Main.*GO.*HOLD/);
  assert.match(doc,/human clients/);
  assert.match(doc,/Fast art rollback/);
  assert.match(doc,/not qualified/i);
});
