import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { COMBAT_ACTION } from "../src/browser/combat-readability.mjs";
import { KNIGHT_CLIPS, createKnightSpriteRenderer, spriteAtlasRect } from "../web/knight-sprites.mjs";

const locomotion = ["silver_idle", "silver_walk", "silver_sprint", "silver_jump"];
const hashes = Object.freeze({
  silver_idle: "3ce8809d131e8e06703019f8714c88fcc3d59a051fcdd301180e603ef274c0e3",
  silver_walk: "4ec5037277f5e50d6aa5ae5a82790f8534f2ff39560c3cd5fa140e0d36b53b6f",
  silver_sprint: "0866a95df012fd09b87bd1a2a7d0529d140ab0a00667cf7cd2e74561058426a0",
  silver_jump: "0735cb6c36c1683ea11d49e348f26c62139bc7c73884c4836eea91e94421e074",
});

test("four original owner Blender size-matched 8-way relit atlases exist only in isolated preview folder", () => {
  for (const clip of locomotion) {
    const file = new URL("../web/assets/knights/review/" + clip + "_relit.webp", import.meta.url);
    const bytes = readFileSync(file);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), hashes[clip]);
    assert.equal(bytes.subarray(0,4).toString(),"RIFF");
    assert.equal(bytes.subarray(8,12).toString(),"WEBP");
  }
});

test("source directions never double mirror the relit Blender Roll-native camera rows", () => {
  for (const clip of [...locomotion, "silver_roll"]) {
    for(let row=0;row<8;row++) {
      const facing=Math.PI/2+row*Math.PI/4;
      const expectedRelit = row*160;
      const expectedLegacy = locomotion.includes(clip)?((8-row)%8)*160:row*160;
      assert.equal(spriteAtlasRect(facing,0,KNIGHT_CLIPS[clip],clip,"relit").y,
        expectedRelit, clip+" relit direction "+row);
      assert.equal(spriteAtlasRect(facing,0,KNIGHT_CLIPS[clip],clip,"original").y,
        expectedLegacy, clip+" original direction "+row);
    }
  }
});

test("one explicit review-only option swaps only the four locomotion files, not Roll or the authenticated clip meanings", () => {
  class FakeImage {
    naturalWidth=0; naturalHeight=0;
    set src(url) {
      this.url=url;
      const base=new URL(url).pathname.split("/").at(-1).replace(".webp","");
      const clip=base.replace("_relit","");
      this.naturalWidth=KNIGHT_CLIPS[clip]*160;
      this.naturalHeight=1280;
      this.onload();
    }
  }
  const sources=[],ctx={
    save(){},restore(){},rotate(){},beginPath(){},ellipse(){},fill(){},
    drawImage(image,sx,sy){sources.push({url:image.url,sx,sy});},
  };
  assert.throws(()=>createKnightSpriteRenderer({sourceArtVariant:"other", ImageCtor:FakeImage}),/source|variant|original|relit/i);
  const originalRenderer=createKnightSpriteRenderer({ImageCtor:FakeImage});
  assert.equal(originalRenderer.loaded().length,5);
  const relitRenderer=createKnightSpriteRenderer({ImageCtor:FakeImage,sourceArtVariant:"relit"});
  assert.deepEqual(relitRenderer.loaded().sort(),Object.keys(KNIGHT_CLIPS).sort());
  const idle={netId:1,x:15,y:25,facing:Math.PI/2+Math.PI/4,action:COMBAT_ACTION.idle};
  assert.equal(originalRenderer.draw(ctx,idle,{actorKind:"player",nowMs:1000}),true);
  assert.match(sources.at(-1).url,/\/assets\/knights\/silver_idle\.webp/);
  assert.equal(sources.at(-1).sy,7*160);
  assert.equal(relitRenderer.draw(ctx,idle,{actorKind:"player",nowMs:1000}),true);
  assert.match(sources.at(-1).url,/\/assets\/knights\/review\/silver_idle_relit\.webp/);
  assert.equal(sources.at(-1).sy,1*160);
  assert.equal(relitRenderer.draw(ctx,{...idle,action:COMBAT_ACTION.dodge},
    {actorKind:"player",nowMs:1200}),true);
  assert.match(sources.at(-1).url,/\/assets\/knights\/silver_roll\.webp$/);
  for(const invalid of [COMBAT_ACTION.kickWindup,COMBAT_ACTION.attackActive,COMBAT_ACTION.dead]) {
    assert.equal(relitRenderer.draw(ctx,{...idle,action:invalid},{actorKind:"player",nowMs:1400}),false);
  }
  assert.equal(relitRenderer.draw(ctx,idle,{actorKind:"npc",remote:true,nowMs:1000}),false);
});

test("real first-party multiplayer URL activates relit art ONLY with explicit knights=1 and knightArt=relit; defaults original", () => {
  const source=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  assert.match(source,/params\.get\("knights"\) === "1"/);
  assert.match(source,/params\.get\("knightArt"\) === "relit"/);
  assert.match(source,/createKnightSpriteRenderer\(\{\s*sourceArtVariant:/);
  assert.doesNotMatch(source,/params\.get\("knightArt"\) === "relit" \|\|/);
});
