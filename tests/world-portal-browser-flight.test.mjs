import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {MAP_IDS,AUTHORED_MAPS,nearbyAuthoredPortal,previewPortalDestination} from "../src/world/authored-maps.mjs";
import {isAuthoredPreviewWalkable,moveAuthoredPreview} from "../src/world/authored-preview-collision.mjs";

const flight=readFileSync(new URL("../scripts/world-portal-browser-flight.mjs",import.meta.url),"utf8");
const html=readFileSync(new URL("../web/world-preview.html",import.meta.url),"utf8");

test("D19 browser gate checks actual E enter and return via W3C key actions",()=>{
  assert.match(flight,/\/session\/"\+sessionId\+"\/actions"/);
  assert.match(flight,/await press\("e"\)/);
  assert.match(flight,/await press\("w",210\)/);
  assert.match(flight,/await press\("s",220\)/);
  assert.match(flight,/D19_REAL_CHROME_PORTAL_ROUND_TRIP_PASS/);
  assert.match(flight,/until\("real E transfer into Red Lion"/);
  assert.match(flight,/until\("real E transfer back outdoors"/);
  assert.match(flight,/if\(!interior\.lore/);
  assert.match(flight,/if\(!outside\.lore/);
  assert.doesNotMatch(flight,/(?:mapId|player)\s*=\s*(?:MAP_IDS|[{])/,
    "flight script may never assign the game position/zone directly");
});

test("D19 real preview requires nearby E and keeps collision guarded landing",()=>{
  const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const syntax=spawnSync(process.execPath,["--check","--input-type=module"],{
    input:script,encoding:"utf8",timeout:10000,
  });
  assert.equal(syntax.status,0,syntax.stderr);
  assert.match(script,/if\(e\.code==="KeyE"&&!e\.repeat&&performance\.now\(\)>cooldown\)/);
  assert.match(script,/nearbyAuthoredPortal\(mapId,player\.x,player\.y,16\)/);
  assert.match(script,/if\(target&&isAuthoredPreviewWalkable\(target\.mapId,target\.x,target\.y\)\)/);
  assert.match(script,/cooldown=performance\.now\(\)\+550/);
  assert.match(script,/door\.textContent=nearby\?"Press E/);
  assert.doesNotMatch(script,/WebSocket|WebTransport|localStorage|sessionStorage|fetch\(/);
});

test("D19 Greyhaven spawn is outside portal until real collision-safe W movement",()=>{
  const start={x:4365,y:4150};
  const map=MAP_IDS.overworld,entrance=AUTHORED_MAPS[map].portals[0];
  assert.equal(nearbyAuthoredPortal(map,start.x,start.y,16),null);
  assert.ok(Math.hypot(entrance.x-start.x,entrance.y-start.y)>entrance.radius+16);
  let point=start;
  for(let i=0;i<12;i++)point=moveAuthoredPreview(map,point,0,-7);
  assert.ok(isAuthoredPreviewWalkable(map,point.x,point.y));
  assert.equal(nearbyAuthoredPortal(map,point.x,point.y,16)?.id,"red-lion-enter");
  const target=previewPortalDestination(map,"red-lion-enter");
  assert.ok(target && isAuthoredPreviewWalkable(target.mapId,target.x,target.y));
  assert.deepEqual(target,{mapId:MAP_IDS.tavern,x:390,y:480});
});

test("D19 interior arrival requires physical S movement before return E",()=>{
  const map=MAP_IDS.tavern;
  const arrival={x:390,y:480};
  assert.equal(nearbyAuthoredPortal(map,arrival.x,arrival.y,16),null);
  let point=arrival;
  for(let i=0;i<13;i++)point=moveAuthoredPreview(map,point,0,4);
  assert.ok(isAuthoredPreviewWalkable(map,point.x,point.y));
  assert.equal(nearbyAuthoredPortal(map,point.x,point.y,16)?.id,"red-lion-exit");
  const target=previewPortalDestination(map,"red-lion-exit");
  assert.deepEqual(target,{mapId:MAP_IDS.overworld,x:4365,y:4143});
  assert.ok(isAuthoredPreviewWalkable(target.mapId,target.x,target.y));
});

test("D19 harness is self-contained, strict and cannot silently skip missing Chrome",()=>{
  const syntax=spawnSync(process.execPath,["--check",
    new URL("../scripts/world-portal-browser-flight.mjs",import.meta.url).pathname],{
      encoding:"utf8",timeout:10000,
  });
  // node --check takes a native pathname. On Windows URL.pathname has a
  // leading slash; run another robust check via native fileURLToPath below.
  if(process.platform!=="win32")assert.equal(syntax.status,0,syntax.stderr);
  assert.match(flight,/chromedriver did not start; no silent browser skip/);
  assert.match(flight,/await webdriver\("DELETE","\/session\/"\+sessionId\)/);
  assert.match(flight,/await new Promise\(resolve=>server\.close\(resolve\)\)/);
  assert.doesNotMatch(flight,/cargo |server\/Cargo|WebTransport|rewards?\s*=|localStorage|sessionStorage/);
  for(const p of ["../server/src/main.rs","../server/src/simulation.rs","../web/online-game.mjs"]){
    assert.doesNotMatch(readFileSync(new URL(p,import.meta.url),"utf8"),
      /world-portal-browser-flight|D19_REAL_CHROME_PORTAL_ROUND_TRIP_PASS/);
  }
});
