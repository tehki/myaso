import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {test} from "node:test";
import {parseAlphaConfig,alphaPlayPath} from "../web/alpha-config.mjs";
import {KNIGHT_CLIPS,createKnightSpriteRenderer,spriteAtlasRect} from "../web/knight-sprites.mjs";

const originalConfig=Object.freeze({
  serverUrl:"https://game.open-trust-layer.org:4433/game",
  certificateSha256:"a".repeat(64), maxPlayers:4,
});
const launch=(cfg)=>new URL(alphaPlayPath(parseAlphaConfig(cfg)),"https://game.open-trust-layer.org");

test("official Silver lobby retains a stable URL; default source renderer is relit",()=>{
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
  assert.match(client,/params\.get\("knightArt"\) === "original"/);
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


test("combined Main-authored original Silver eight-camera relights retain native Roll rows without double mirroring",()=>{
  const movement=["silver_idle","silver_walk","silver_sprint","silver_jump"];
  for(const clip of [...movement,"silver_roll"]){
    for(let row=0;row<8;row++){
      const facing=Math.PI/2+row*Math.PI/4;
      assert.equal(spriteAtlasRect(facing,0,KNIGHT_CLIPS[clip],clip,"relit").y,row*160,
        clip+" source-relit genuine original Roll camera "+row);
      const oldRow=movement.includes(clip)?(8-row)%8:row;
      assert.equal(spriteAtlasRect(facing,0,KNIGHT_CLIPS[clip],clip,"original").y,oldRow*160,
        clip+" frozen legacy mapping "+row);
    }
  }
});

test("Main integrated first-party Silver renderer selects only approved relit four assets after lobby GO",()=>{
  class MockImage{
    naturalWidth=0;naturalHeight=0;
    set src(u){
      this.uri=u;
      const clip=new URL(u).pathname.split("/").at(-1).replace(".webp","").replace("_relit","");
      this.naturalWidth=KNIGHT_CLIPS[clip]*160;
      this.naturalHeight=8*160;
      this.onload();
    }
  }
  const baseline=[],relit=[];
  const ImageCtor=class extends MockImage{
    set src(u){super.src=u}
    get src(){return this.uri}
  };
  const originalRenderer=createKnightSpriteRenderer({ImageCtor,sourceArtVariant:"original"});
  const relitRenderer=createKnightSpriteRenderer({ImageCtor,sourceArtVariant:"relit"});
  assert.equal(originalRenderer.loaded().length,5);
  assert.equal(relitRenderer.loaded().length,5);
  const mockContext=(arr)=>({
    save(){},restore(){},rotate(){},translate(){},beginPath(){},ellipse(){},fill(){},
    drawImage(image,sx,sy){arr.push({url:image.uri,sx,sy})},
  });
  const idle={netId:33,x:0,y:0,action:0,facing:Math.PI/2+Math.PI/4};
  assert.equal(originalRenderer.draw(mockContext(baseline),idle,{actorKind:"player",nowMs:1000}),true);
  assert.equal(relitRenderer.draw(mockContext(relit),idle,{actorKind:"player",nowMs:1000}),true);
  assert.match(baseline.at(-1).url,/\/silver_idle\.webp$/);
  assert.equal(baseline.at(-1).sy,7*160);
  assert.match(relit.at(-1).url,/\/review\/silver_idle_relit\.webp$/);
  assert.equal(relit.at(-1).sy,1*160);
  const roll={...idle,action:4};
  assert.equal(relitRenderer.draw(mockContext(relit),roll,{actorKind:"player",nowMs:1100}),true);
  assert.match(relit.at(-1).url,/\/silver_roll\.webp$/);
  assert.equal(relit.at(-1).sy,1*160);
});
