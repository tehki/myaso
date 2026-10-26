import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planM41ViewportWheel } from "../scripts/m41-viewport-wheel.mjs";

const arena = {
  left:180,top:100,right:1100,bottom:600,width:920,height:500,
  innerWidth:1280,innerHeight:720,
};
test("M41 plans exactly one real native W3C viewport-centered wheel-back",()=>{
  assert.deepEqual(planM41ViewportWheel({arena,wheelId:"wheel-firefox"}),{
    actions:[{type:"wheel",id:"wheel-firefox",actions:[
      {type:"scroll",origin:"viewport",x:640,y:350,deltaX:0,deltaY:120,duration:0},
    ]}],
  });
});
test("M41 cannot emit wheel outside viewport or for a non-real driver",()=>{
  for(const wheelId of ["wheel-chrome2","keyboard-firefox","wheel-test",""]){
    assert.throws(()=>planM41ViewportWheel({arena,wheelId}),TypeError);
  }
  for(const candidate of [null,{}, {...arena,left:-2}, {...arena,top:-1},
    {...arena,right:1300}, {...arena,bottom:900}, {...arena,width:0},
    {...arena,height:0}, {...arena,innerWidth:0},
    {...arena,width:Infinity}, {...arena,right:1097}]){
    assert.throws(()=>planM41ViewportWheel({arena:candidate,wheelId:"wheel-firefox"}));
  }
});
test("M41 native wheel remains downstream of genuine actor-bound cue; M35 still uses original wheel",()=>{
  const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const start=source.indexOf("async function runOnlineUiParryFlight(entries");
  const end=source.indexOf("async function runOnlineUiParryPunishFfaFocusFlight(",start);
  assert.ok(start>=0&&end>start);
  const block=source.slice(start,end);
  assert.ok(block.includes("dispatchM41ObservedParry({"));
  assert.ok(block.includes("awaitWorldCue: () => waitForM41WorldWindup("));
  assert.ok(block.includes('scenario === "uiparrytell" || scenario === "uistun" || scenario === "uiparry"'),
    "M33 short-click parry requires an original fresh actor-bound light windup");
  assert.ok(block.includes('(scenario === "uiparrytell" || scenario === "uiparry")'),
    "M33/M41 issue one native viewport wheel; M35 stays unchanged");
  assert.ok(block.includes('scenario === "uiparrytell",'),
    "M33 never accepts early heavy windup, only M41 can");
  assert.ok(block.includes("scrollM41ViewportWheel(defender, defenderViewport)"));
  assert.ok(block.includes("setArenaBlock(defender, defenderElementId, true)"));
  assert.ok(block.includes("performArenaM221GuardBreakClick(attacker, 35)"));
  assert.ok(block.includes("waitForUiParryEvidence("));
});
