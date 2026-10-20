// D4: deterministic browser-preview walking fixtures for dormant Rust parity.
// Run: node scripts/generate-world-movement-fixtures.mjs [--check]
// Golden corpus is versioned and reviewable, not a trusted movement endpoint.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MAP_IDS } from "../src/world/authored-maps.mjs";
import {
  isAuthoredPreviewWalkable,
  moveAuthoredPreview,
  MAX_PREVIEW_FRAME_MOVE,
} from "../src/world/authored-preview-collision.mjs";

const destination = fileURLToPath(new URL("../tests/fixtures/world-movement-parity-v1.csv", import.meta.url));
const rows = [
  "# D4 generated movement parity: map,startX,startY,dx,dy,radius,outX,outY,result",
  "# result: ok, invalid-start, invalid-delta. D3 geometry manifest v1.",
];
const cases = [];
const outdoor = MAP_IDS.overworld, inn = MAP_IDS.tavern;

function add(map, x, y, dx, dy, radius = 18) {
  cases.push({ map, x, y, dx, dy, radius });
}

// Deliberately exercise doors, walls, gate openings, river barriers, both
// bridge approaches, inn furniture, and map boundaries (not just open fields).
const anchors = [
  [outdoor,4365,4150], [outdoor,4365,4069], [outdoor,4365,4068],
  [outdoor,4215,3980], [outdoor,4220,4080], [outdoor,4450,4250],
  [outdoor,4450,4320], [outdoor,3490,4180], [outdoor,3520,4180],
  [outdoor,4130,3460], [outdoor,4000,3460], [outdoor,4760,4180],
  [outdoor,1900,4250], [outdoor,1980,4240], [outdoor,2200,4250],
  [outdoor,2100,5500], [outdoor,2250,3600], [outdoor,1940,3840],
  [outdoor,2815,4100], [outdoor,3210,2070], [outdoor,18,18],
  [outdoor,8174,8174], [inn,390,480], [inn,390,430], [inn,390,428],
  [inn,390,550], [inn,400,115], [inn,250,430], [inn,20,20],
];
const moves = [
  [0,0], [-10,0], [10,0], [0,-10], [0,10], [11,11], [-11,-11],
  [8,-8], [-8,8], [6,3], [-6,3], [3,-6], [0,16],
];
for (const [map,x,y] of anchors) for (const [dx,dy] of moves) add(map,x,y,dx,dy);

// Reproducible bounded LCG: sample heavily near houses, the town gates and
// the river rather than making the whole corpus mostly empty wilderness.
let seed = 0x41c0ffee;
const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
for (let i = 0; i < 480; i++) {
  const region = i % 4;
  const map = region === 3 ? inn : outdoor;
  const x = region === 0 ? 3350 + (rnd() % 1750) / 2
    : region === 1 ? 1650 + (rnd() % 1250) / 2
    : region === 2 ? 4000 + (rnd() % 1200)
    : 18 + (rnd() % 1480) / 2;
  const y = region === 0 ? 3300 + (rnd() % 3000) / 2
    : region === 1 ? 3300 + (rnd() % 3000) / 2
    : region === 2 ? 3800 + (rnd() % 1400)
    : 18 + (rnd() % 1160) / 2;
  const dx = (rnd() % 25 - 12) / 2;
  const dy = (rnd() % 25 - 12) / 2;
  add(map,x,y,dx,dy);
}
// Adversarial requests are part of the corpus, not accepted moves.
add(outdoor,4365,4150,17,0);
add(outdoor,4365,4150,12,12);
add(outdoor,4365,4150,NaN,0);
add(outdoor,4365,4150,0,NaN);
add(outdoor,NaN,4150,0,0);
add(outdoor,4365,4150,0,0,0);
add(outdoor,4365,4150,0,0,33);
add(inn,390,480,12,12);
add(inn,390,480,0,NaN);
add(inn,NaN,480,0,0);

function fmt(v) {
  if (!Number.isFinite(v)) return String(v);
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4)));
}
let blocked = 0, accepted = 0, invalid = 0;
for (const {map,x,y,dx,dy,radius} of cases) {
  const startOK = isAuthoredPreviewWalkable(map,x,y,radius);
  const deltaOK = Number.isFinite(dx) && Number.isFinite(dy)
    && Math.hypot(dx,dy) <= MAX_PREVIEW_FRAME_MOVE;
  const outcome = !startOK ? "invalid-start" : !deltaOK ? "invalid-delta" : "ok";
  const result = moveAuthoredPreview(map,{x,y},dx,dy,radius);
  if (outcome === "ok") {
    if (!result || !isAuthoredPreviewWalkable(map,result.x,result.y,radius))
      throw Error("Preview movement left valid geometry");
    if (Math.abs(result.x-x) < Math.abs(dx)-.01 || Math.abs(result.y-y) < Math.abs(dy)-.01) blocked++;
    accepted++;
  } else {
    if (startOK && (!result || result.x!==x || result.y!==y))
      throw Error("Unsafe local invalid displacement");
    invalid++;
  }
  rows.push([map,fmt(x),fmt(y),fmt(dx),fmt(dy),fmt(radius),
    result && outcome==="ok" ? fmt(result.x) : "-",
    result && outcome==="ok" ? fmt(result.y) : "-",outcome].join(","));
}
if (cases.length < 600 || blocked < 10 || invalid < 10)
  throw Error(`Insufficient corpus: ${cases.length} cases; ${blocked} blocked, ${invalid} rejected`);
const output = rows.join("\n")+"\n";
if (process.argv.includes("--check")) {
  if (readFileSync(destination,"utf8").replace(/\r\n/g,"\n")!==output) {
    console.error("D4 movement fixtures stale; regenerate from preview");
    process.exitCode=1;
  } else console.log(`D4 fixtures verified: ${cases.length} steps; ${blocked} collisions; ${invalid} rejected`);
} else {
  writeFileSync(destination,output);
  console.log(`Generated D4 fixtures: ${cases.length} cases, ${blocked} collisions, ${invalid} rejected`);
}
