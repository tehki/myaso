import assert from "node:assert/strict";
import test from "node:test";
import {MAP_IDS} from "../src/world/authored-maps.mjs";
import {createAuthoredWorldRenderer,WORLD_TILE_SIZE,WORLD_CACHE_CAP}
  from "../src/browser/authored-world-renderer.mjs";

function operationsAt(camera) {
  const calls={arcs:0,rects:0,ellipses:0,tiles:0};
  const tileCtx={
    save(){},restore(){},translate(){},
    fillRect(){},strokeRect(){calls.rects++;},beginPath(){},
    moveTo(){},lineTo(){},arc(){calls.arcs++;},ellipse(){calls.ellipses++;},
    fill(){},stroke(){},fillText(){}
  };
  const screen={fillRect(){},drawImage(){calls.tiles++;}};
  let canvasCount=0;
  const renderer=createAuthoredWorldRenderer({
    cacheCap:WORLD_CACHE_CAP,buildLimit:8,
    makeCanvas:()=>{canvasCount++;return {width:0,height:0,getContext:()=>tileCtx};}
  });
  renderer.draw(screen,MAP_IDS.overworld,camera,600,420,1);
  return {...calls,canvasCount,cached:renderer.stats.cached,created:renderer.stats.created};
}

test("P2.3 rejects distant authored props but retains city and grove silhouettes",()=>{
  const empty=operationsAt({x:7700,y:7200});
  const city=operationsAt({x:4350,y:4100});
  const forest=operationsAt({x:950,y:2550});
  assert.equal(empty.arcs,0,"remote empty wilderness must not paint faraway trees or portals");
  assert.equal(empty.rects,0,"remote empty wilderness must not paint city or buildings");
  assert.equal(empty.ellipses,0,"remote empty wilderness must not paint distant tree shadows");
  assert.ok(city.rects>0,"authored Greyhaven walls and buildings remain painted");
  assert.ok(forest.arcs>0,"authored grove tree silhouettes remain painted");
  for(const sample of [empty,city,forest]){
    assert.ok(sample.created<=8 && sample.cached<=WORLD_CACHE_CAP);
    assert.equal(sample.created,sample.canvasCount);
    assert.ok(sample.tiles>0);
  }
  assert.equal(WORLD_TILE_SIZE,512);
});
