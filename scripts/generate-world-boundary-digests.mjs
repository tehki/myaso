// D5 differential occupancy sampling: 20,000 reproducible, quarter-unit
// positions near wall/gate/building/river/furniture edges plus open terrain.
// Run: node scripts/generate-world-boundary-digests.mjs [--check]
// No production behavioral changes or client-trusted decisions.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MAP_IDS, getAuthoredMap } from "../src/world/authored-maps.mjs";
import { isAuthoredPreviewWalkable } from "../src/world/authored-preview-collision.mjs";

const destination = fileURLToPath(new URL("../tests/fixtures/world-boundary-digests-v1.csv", import.meta.url));
const world = getAuthoredMap(MAP_IDS.overworld);
const inn = getAuthoredMap(MAP_IDS.tavern);
const radii = [8, 18, 24, 32];
const names = ["city-walls", "building-edges", "river-bridges", "inn-furniture", "world-uniform"];
const cases = 20000;
let state = 0x5a17d00d;
const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
const summary = names.map(name => ({ name, total:0, blocked:0, hash:2166136261 }));
function q(v) { return Math.round(v * 4) / 4; }
for (let i = 0; i < cases; i++) {
  const a=next(),b=next(),c=next(),d=next(),e=next();
  const bucket=i%5, radius=radii[e%4];
  let map=MAP_IDS.overworld, x=0, y=0;
  if (bucket===0) {
    const side=a%4, off=((c%321)-160)/4, along=((d%1001)-500)/4;
    if (side===0) { x=world.city.x+off; y=4180+along; }
    if (side===1) { x=world.city.x+world.city.w+off; y=4180+along; }
    if (side===2) { x=4130+along; y=world.city.y+off; }
    if (side===3) { x=4130+along; y=world.city.y+world.city.h+off; }
  } else if (bucket===1) {
    const building=world.buildings[a%world.buildings.length];
    const side=b%4, off=((c%401)-200)/4;
    if (side===0) { x=building.x+off; y=building.y+(d%(building.h*4+1))/4; }
    if (side===1) { x=building.x+building.w+off; y=building.y+(d%(building.h*4+1))/4; }
    if (side===2) { y=building.y+off; x=building.x+(d%(building.w*4+1))/4; }
    if (side===3) { y=building.y+building.h+off; x=building.x+(d%(building.w*4+1))/4; }
  } else if (bucket===2) {
    const idx=a%(world.river.points.length-1);
    const [ax,ay]=world.river.points[idx], [bx,by]=world.river.points[idx+1];
    const t=(b%257)/256;
    x=q(ax+(bx-ax)*t)+((c%1001)-500)/4;
    y=q(ay+(by-ay)*t)+((d%401)-200)/4;
  } else if (bucket===3) {
    map=MAP_IDS.tavern;
    const solids=inn.furniture.filter(f=>f.kind!=="rug");
    const f=solids[a%solids.length];
    const side=b%4, off=((c%401)-200)/4;
    if (side===0) { x=f.x+off; y=f.y+(d%(f.h*4+1))/4; }
    if (side===1) { x=f.x+f.w+off; y=f.y+(d%(f.h*4+1))/4; }
    if (side===2) { y=f.y+off; x=f.x+(d%(f.w*4+1))/4; }
    if (side===3) { y=f.y+f.h+off; x=f.x+(d%(f.w*4+1))/4; }
  } else {
    x=(a%32769)/4; y=(b%32769)/4;
  }
  const walk=isAuthoredPreviewWalkable(map,x,y,radius);
  const row=summary[bucket];
  row.total++;
  if(!walk) row.blocked++;
  row.hash=Math.imul((row.hash^(walk?1:0))>>>0,16777619)>>>0;
}
if(summary.some(v=>v.total!==4000)||summary[0].blocked<100||summary[1].blocked<100
  ||summary[2].blocked<100||summary[3].blocked<100)
  throw Error("D5 differential sample distribution insufficient");
const output="# D5 world boundary digest v1: region,samples,blocked,fnv32\n"
  +summary.map(x=>[x.name,x.total,x.blocked,x.hash.toString(16).padStart(8,"0")].join(",")).join("\n")+"\n";
if(process.argv.includes("--check")) {
  if(readFileSync(destination,"utf8").replace(/\r\n/g,"\n")!==output){
    console.error("D5 boundary parity digest stale");
    process.exitCode=1;
  } else console.log("D5 boundary parity verified: 20000 positions, five regions");
} else {
  writeFileSync(destination,output);
  console.log(output.trim());
}
