// Core 8A / P0 M1: four REAL Chrome/Firefox WebDriver browser sessions
// sharing the actual Rust/WebTransport server. Localhost CI only: NOT WAN,
// cross-machine, rendered Greyhaven city or Combat/item acceptance.
// Explicit opt-in mode also verifies SERVER-OWNED Greyhaven spawn/recovery.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import {WORLD_ALPHA_SWORD_RACK_SOCKETS,validateWorldAlphaArmoryLayout} from "../src/world/alpha-armory.mjs";
import {nextNativeWalkPulse,nativeRackArrived,proposedNativeRackReachPoint,nativeRackWithinProposedReach,verifyNativeRackPeerConsensus,verifyNativeRackRecoveryPeerConsensus} from "./alpha_p0_rack_walk_math.mjs";
import {nativeDriverPortForAttempt,retryNativeFirefoxSession} from "./alpha_p0_native_driver_startup_policy.mjs";

const root = process.cwd();
const greyhavenModeValue = process.env.MYASO_ALPHA_NATIVE_GREYHAVEN;
if (greyhavenModeValue !== undefined && !["0","1"].includes(greyhavenModeValue)) {
  throw Error("MYASO_ALPHA_NATIVE_GREYHAVEN must be unset, 0 or 1");
}
const greyhavenMode = greyhavenModeValue === "1";
const nativeRackWalkValue = process.env.MYASO_ALPHA_NATIVE_RACK_WALK;
if(nativeRackWalkValue !== undefined && !["0","1"].includes(nativeRackWalkValue)) {
  throw Error("MYASO_ALPHA_NATIVE_RACK_WALK must be unset, 0 or 1");
}
const nativeRackWalk = nativeRackWalkValue === "1";
if(nativeRackWalk && !greyhavenMode)throw Error("rack walking requires explicit Greyhaven server authority");
const nativeRackReachValue=process.env.MYASO_ALPHA_NATIVE_RACK_REACH;
if(nativeRackReachValue!==undefined&&!["0","1"].includes(nativeRackReachValue))
  throw Error("MYASO_ALPHA_NATIVE_RACK_REACH must be unset, 0 or 1");
const nativeRackReach=nativeRackReachValue==="1";
if(nativeRackReach&&(!nativeRackWalk||!greyhavenMode))
  throw Error("proposed rack reach requires reviewed Greyhaven plus native rack walk");
const rackCrashValue=process.env.MYASO_ALPHA_NATIVE_RACK_CRASH_REJOIN;
if(rackCrashValue!==undefined&&!["0","1"].includes(rackCrashValue))
  throw Error("MYASO_ALPHA_NATIVE_RACK_CRASH_REJOIN must be unset, 0 or 1");
const rackCrashRejoin=rackCrashValue==="1";
if(rackCrashRejoin&&!nativeRackReach)
  throw Error("rack crash/rejoin requires actual native proposed rack reach mode");
const GREYHAVEN_SPAWNS = new Map([
  [1,{x:4110,y:4160}],[2,{x:4206,y:4160}],
  [3,{x:4110,y:4256}],[4,{x:4206,y:4256}],
]);
const deadlineMs = 155_000;
const expiry = Date.now() + deadlineMs;
const children = new Set();
const sessions = [];
let staticServer;
const evidenceDir = path.join(root, "alpha-m1-four-browser-evidence");
const browsers = [
  { name: "chrome-1", family: "chrome", port: 9651 },
  { name: "firefox-2", family: "firefox", port: 9652 },
  { name: "chrome-3", family: "chrome", port: 9653 },
  { name: "firefox-4", family: "firefox", port: 9654 },
];
const assert = (condition, detail) => { if (!condition) throw Error(detail); };
// Each WebDriver launches a browser tree. Reap the entire isolated process
// group, not just chromedriver/geckodriver (which can leave browser workers
// holding stdio pipes open and hang the CI Node event loop indefinitely).
function terminate(child, signal = "SIGTERM") {
  if (!child?.pid) return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch { /* already exited */ }
}
async function webdriver(base, method, uri, body, timeoutMs = 10_000) {
  const response = await fetch(base + uri, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json();
  if (!response.ok || payload.value?.error) {
    throw Error(`real WebDriver ${method} ${uri}: ${JSON.stringify(payload).slice(0, 600)}`);
  }
  return payload.value ?? payload;
}
async function execute(s, js) {
  return await webdriver(s.base, "POST", `/session/${s.id}/execute/sync`, {
    script: js, args: [],
  });
}
async function snapshot(s) {
  return await execute(s, `
    const a = window.__MYASO_ACCEPTANCE_STATE__;
    return {
      id:Number(a?.playerNetId ?? 0),tick:Number(a?.serverTick ?? 0),
      fighters:(a?.fighters ?? []).map(f=>({netId:Number(f.netId),x:Number(f.x),y:Number(f.y)})),
      scoreboard:[...document.querySelectorAll("#scoreboard-list li")].map(e=>e.textContent.trim()),
    };
  `);
}
function fighter(state, id) { return state.fighters.find(f => f.netId === id); }
async function waitFor(fn, label, ms = 18_000) {
  const end = Math.min(Date.now() + ms, expiry);
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last?.ok) return last.value;
    await sleep(120);
  }
  throw Error(`${label} timed out, last=${JSON.stringify(last?.value).slice(0, 1000)}`);
}
function fourVisible(s) {
  if (s.id <= 0 || s.tick <= 0) return false;
  const ids = s.fighters.map(f=>f.netId).sort((a,b)=>a-b);
  return ids.length === 4
    && ids.every((id,index)=>id===index+1)
    && [1,2,3,4].every(id=>s.scoreboard.some(row=>row.startsWith("#"+id)));
}
async function httpServer() {
  const server = createServer(async (req,res)=>{
    try {
      const requested = decodeURIComponent(new URL(req.url, "http://127.0.0.1/").pathname);
      const relative = requested.endsWith("/") ? requested + "index.html" : requested;
      const absolute = path.resolve(root, "." + relative);
      if (!absolute.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
      const info = await stat(absolute);
      if (!info.isFile()) { res.writeHead(404); res.end(); return; }
      const data = await readFile(absolute);
      const ext = path.extname(absolute);
      res.setHeader("content-type", ({
        ".html":"text/html; charset=utf-8", ".js":"text/javascript", ".mjs":"text/javascript",
        ".css":"text/css", ".png":"image/png", ".svg":"image/svg+xml", ".json":"application/json",
        ".woff2":"font/woff2", ".ogg":"audio/ogg", ".mp3":"audio/mpeg",
      })[ext] || "application/octet-stream");
      res.setHeader("cache-control","no-store");
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
  return server;
}
async function startRealGameServer() {
  // The focused workflow already builds this exact binary. Spawn it
  // directly so SIGTERM reaps the real server, not just a cargo parent.
  const gameEnv = { ...process.env, MYASO_BIND:"127.0.0.1:0", MYASO_MAX_PLAYERS:"4",
    MYASO_FLIGHT_BACKGROUND_PLAYERS:"0", MYASO_FLIGHT_NEAR_PRESSURE_PLAYERS:"0" };
  // Existing generic arena fixture stays default-OFF for staging features.
  delete gameEnv.MYASO_ALPHA_SPAWN;
  delete gameEnv.MYASO_ALPHA_STATIC_COLLISION;
  if (greyhavenMode) {
    gameEnv.MYASO_ALPHA_SPAWN = "greyhaven";
    gameEnv.MYASO_ALPHA_STATIC_COLLISION = "reviewed-static-only";
  }
  const child = spawn(path.join(root, "server", "target", "debug", "myaso-server"), [], {
    cwd: root, env: gameEnv,
    stdio:["ignore","pipe","pipe"],
    detached: process.platform !== "win32",
  });
  children.add(child);
  let url,hash,output="";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", chunk=>{
    output+=chunk;
    process.stdout.write("[actual-rust-server] "+chunk);
    const match=output.match(/listening on (https:\/\/[^\s]+)/);
    if (match) url=match[1];
    const cert=output.match(/development certificate SHA-256: ([^\r\n]+)/);
    if (cert) {
      const text=cert[1].replace(/[^0-9a-f]/gi,"");
      if (text.length === 64) hash=text.toLowerCase();
    }
  });
  child.stderr.on("data",chunk=>process.stderr.write("[actual-rust-server-err] "+chunk));
  await waitFor(async()=>{
    if (child.exitCode !== null) throw Error("server exited "+child.exitCode);
    return {ok:!!url && !!hash && output.includes("myaso admission cap: 4 concurrent players")
      && (!greyhavenMode || (output.includes("staging-only Greyhaven spawn selected")
        && output.includes("staging-only Greyhaven fixed static sweep enabled"))),
      value:{url,hash}};
  }, "real server pinned localhost / cap four",45_000);
  assert(url.startsWith("https://127.0.0.1:") && url.endsWith("/game"),"server must bind loopback");
  if (greyhavenMode) {
    assert(output.includes("staging-only Greyhaven spawn selected")
      && output.includes("staging-only Greyhaven fixed static sweep enabled"),
      "explicit reviewed Greyhaven server spawn/static collision opt-in missing");
  }
  return {url,hash};
}
async function driver(browser) {
  const isChrome=browser.family==="chrome";
  const executable=isChrome
    ? (process.env.CHROMEWEBDRIVER ? path.join(process.env.CHROMEWEBDRIVER,"chromedriver") : "chromedriver")
    : (process.env.GECKOWEBDRIVER ? path.join(process.env.GECKOWEBDRIVER,"geckodriver") : "geckodriver");
  const caps=isChrome
    ? {browserName:"chrome","goog:chromeOptions":{args:[
      "--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1280,900",
      "--disable-background-timer-throttling","--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding"]}}
    : {browserName:"firefox","moz:firefoxOptions":{args:["-headless"],
      prefs:{"dom.min_background_timeout_value":4,"dom.timeout.enable_budget_timer_throttling":false}}};
  // Real Firefox geckodriver /session startup sometimes hangs at 30s under
  // CI runner load, before any game admission. Never turn the first hung
  // browser into a fake successful actor. Kill the whole native process group
  // before the only allowed Linux Firefox retry, on a NEW localhost port.
  for(let attempt=0;attempt<=1;attempt++){
    const port=nativeDriverPortForAttempt(browser,attempt);
    const arguments_=isChrome ? [`--port=${port}`] : ["--host","127.0.0.1","--port",String(port)];
    const child=spawn(executable,arguments_,{
      cwd:root,stdio:["ignore","pipe","pipe"],detached:process.platform!=="win32",
    });
    children.add(child);
    child.stderr.on("data",chunk=>process.stderr.write(`[${browser.name}-driver] ${chunk}`));
    const base=`http://127.0.0.1:${port}`;
    try {
      await waitFor(async()=>{
        if(child.exitCode!==null||child.signalCode!==null)
          throw Error(browser.name+" driver exited "+(child.exitCode??child.signalCode));
        try {
          const response=await fetch(base+"/status",{signal:AbortSignal.timeout(700)});
          return {ok:response.ok,value:true};
        }catch{return {ok:false,value:false};}
      },browser.name+" native WebDriver startup",15_000);
      console.log("ALPHA_M1_BROWSER_START "+JSON.stringify({
        browser:browser.name,family:browser.family,attempt,actualDriverPort:port,
      }));
      // A headless Firefox session may need extra startup time under runner
      // contention. This remains a genuine W3C /session POST, never a mock.
      const created=await webdriver(base,"POST","/session",
        {capabilities:{alwaysMatch:caps}},30_000);
      const id=created.sessionId??created.value?.sessionId;
      assert(id,browser.name+" no real WebDriver session ID");
      await webdriver(base,"POST",`/session/${id}/timeouts`,
        {script:15000,pageLoad:30000,implicit:0});
      return {name:browser.name,base,id,driverChild:child};
    }catch(error){
      const mayRetry=retryNativeFirefoxSession(error,browser,attempt,process.platform);
      terminate(child,"SIGKILL");
      await Promise.race([
        new Promise(resolve=>{
          if(child.exitCode!==null||child.signalCode!==null)return resolve();
          child.once("exit",resolve);
        }),
        sleep(3000),
      ]);
      // Fail closed on all Chrome failures, malformed geckodriver replies,
      // genuine admission errors, and the second real Firefox timeout.
      if(!mayRetry)throw error;
      console.log("ALPHA_M1_FIREFOX_STARTUP_RETRY "+JSON.stringify({
        browser:browser.name,failedAttempt:attempt,
        cause:"W3C new-session timeout before gameplay admission",
        originalDriverPort:port,nextDriverPort:nativeDriverPortForAttempt(browser,1),
        originalProcessGroupKilled:true,
      }));
    }
  }
  throw Error(browser.name+" exceeded exact native WebDriver attempts");
}
async function openGame(s,game,staticPort) {
  const u=new URL(`http://127.0.0.1:${staticPort}/web/index.html`);
  u.searchParams.set("server",game.url);
  u.searchParams.set("cert",game.hash);
  u.searchParams.set("scenario","uijumpffaprimary");
  await webdriver(s.base,"POST",`/session/${s.id}/url`,{url:u.toString()});
  const joined=await waitFor(async()=>{
    const value=await snapshot(s);
    return {ok:value.id>0 && value.tick>0 && Boolean(fighter(value,value.id)),value};
  },s.name+" genuine multiplayer admission",18_000);
  console.log("ALPHA_M1_NATIVE_BROWSER_JOIN "+JSON.stringify({browser:s.name,id:joined.id,tick:joined.tick}));
  return joined;
}
async function saveScreenshot(s,tag) {
  const raw=await webdriver(s.base,"GET",`/session/${s.id}/screenshot`);
  const name=path.join(evidenceDir,`${s.name}-${tag}.png`);
  await writeFile(name,Buffer.from(raw,"base64"));
}
async function moveGenuinely(s,key="d") {
  assert(key==="a"||key==="d", "movement test only supports authentic A/D keys");
  const initial=await snapshot(s),before=fighter(initial,initial.id);
  assert(before,"attacker own fighter absent before movement");
  const found=await webdriver(s.base,"POST",`/session/${s.id}/element`,{using:"css selector",value:"#arena"});
  const element=found["element-6066-11e4-a52e-4f735466cecf"];
  assert(element,"real browser has no arena");
  await webdriver(s.base,"POST",`/session/${s.id}/element/${element}/click`,{});
  const url=`/session/${s.id}/actions`;
  await webdriver(s.base,"POST",url,{actions:[{type:"key",id:"movement-"+s.name,actions:[{type:"keyDown",value:key}]}]});
  try {await sleep(1100);}
  finally {
    await webdriver(s.base,"POST",url,{actions:[{type:"key",id:"movement-"+s.name,actions:[{type:"keyUp",value:key}]}]});
  }
  const own=await waitFor(async()=>{
    const value=await snapshot(s),after=fighter(value,initial.id);
    return {ok:!!after && Math.hypot(after.x-before.x,after.y-before.y)>4 && value.tick>initial.tick,value};
  },"authoritative native WebDriver D movement",8000);
  return {before,after:fighter(own,initial.id),tick:own.tick};
}
// P0 R2: kill an actual Firefox browser *process group* (no WebDriver DELETE,
// no WebTransport.close()) while three Chrome/Firefox peers remain alive.
// This proves same-host browser crash/authoritative admission recovery only,
// NOT an independent-host network partition or Greyhaven/sword continuity.
function assertServerOwnedGreyhavenRoster(states,phase) {
  if (!greyhavenMode) return;
  for (const s of states) {
    for (const [id,point] of GREYHAVEN_SPAWNS) {
      const p=fighter(s,id);
      assert(p && Math.hypot(p.x-point.x,p.y-point.y)<=1,
        phase+" real browser #"+s.id+" did not observe server-owned Greyhaven spawn #"+id
          +"; fighter="+JSON.stringify(p));
    }
  }
  console.log("ALPHA_P0_FOUR_NATIVE_GREYHAVEN_SPAWN_PASS "+JSON.stringify({
    phase,authoritativeSpawns:[...GREYHAVEN_SPAWNS],
    realBrowserWitnesses:states.map(s=>({playerId:s.id,tick:s.tick})),
    collision:"reviewed-static-only",renderedWorldVerified:false,
    scope:"one localhost CI host; NOT two hosts, real sword, or visually rendered city"
  }));
}
async function crashAndRejoin(game, staticPort) {
  assert(process.platform === "linux", "process-group crash acceptance requires isolated Linux CI");
  const lost = sessions.splice(1, 1)[0];
  assert(lost?.driverChild?.pid && lost.name === "firefox-2", "expected live second Firefox driver");
  const surviving = [...sessions];
  const expectedBefore = [1, 3, 4];
  const crashedAt = Date.now();
  terminate(lost.driverChild, "SIGKILL");
  await waitFor(async () => ({
    ok: lost.driverChild.exitCode !== null || lost.driverChild.signalCode !== null,
    value: {exitCode:lost.driverChild.exitCode,signalCode:lost.driverChild.signalCode},
  }), "abrupt Firefox process-group SIGKILL", 5_000);
  console.log("ALPHA_M1_CRASH_PROCESS_KILLED " + JSON.stringify({
    formerPlayerId:2, formerBrowser:lost.name, mechanism:"SIGKILL process group, no W3C DELETE",
  }));
  const afterRemoval = await Promise.all(surviving.map(s => waitFor(async () => {
    const state = await snapshot(s);
    const ids = state.fighters.map(f=>f.netId).sort((a,b)=>a-b);
    const ok = ids.join(",") === expectedBefore.join(",")
      && expectedBefore.every(id => state.scoreboard.some(row=>row.startsWith("#"+id)))
      && !state.scoreboard.some(row=>row.startsWith("#2"));
    return {ok,value:state};
  }, s.name + " authoritative ghost removal and three-survivor roster", 38_000)));
  const removalMs = Date.now()-crashedAt;
  assert(removalMs <= 38_000, "abandoned Firefox ghost cleanup exceeded 38 seconds: "+removalMs);
  console.log("ALPHA_M1_THREE_SURVIVORS_NO_GHOST " + JSON.stringify({
    crashedPlayerId:2, removalMs, survivingIds:expectedBefore,
    observedBy:surviving.map((s,i)=>({browser:s.name,tick:afterRemoval[i].tick})),
  }));
  const replacement = await driver({name:"firefox-rejoin-5",family:"firefox",port:9655});
  sessions.push(replacement);
  const joined = await openGame(replacement,game,staticPort);
  assert(joined.id === 5, "replacement must receive a fresh server-issued ID #5, got "+joined.id);
  const expectedAfter = [1,3,4,5];
  const validRoster = state => state.id > 0 && state.tick > 0
    && state.fighters.map(f=>f.netId).sort((a,b)=>a-b).join(",") === expectedAfter.join(",")
    && expectedAfter.every(id => state.scoreboard.some(row=>row.startsWith("#"+id)))
    && !state.scoreboard.some(row=>row.startsWith("#2"));
  const views = await Promise.all(sessions.map(s=>waitFor(async()=>{
    const state=await snapshot(s);return {ok:validRoster(state),value:state};
  },s.name+" authoritative replacement roster 1,3,4,5",15_000)));
  if (greyhavenMode) {
    for (const view of views) {
      const replacementPosition=fighter(view,5);
      const freed=GREYHAVEN_SPAWNS.get(2);
      assert(replacementPosition && Math.hypot(
        replacementPosition.x-freed.x,replacementPosition.y-freed.y)<=1,
        "real browser #"+view.id+" did not observe fresh #5 at freed Greyhaven spawn");
      assert(!fighter(view,2),"abandoned Greyhaven fighter #2 retained after rejoin");
    }
    console.log("ALPHA_P0_FOUR_NATIVE_GREYHAVEN_REJOIN_PASS "+JSON.stringify({
      formerId:2,replacementId:5,freedAnchor:GREYHAVEN_SPAWNS.get(2),
      actualBrowserWitnesses:views.map(v=>({id:v.id,tick:v.tick})),
      noGhost:true,independentHosts:false
    }));
  }
  await saveScreenshot(replacement,"rejoin-no-ghost");
  await saveScreenshot(surviving[0],"rejoin-observed");
  const before = await Promise.all(surviving.map(snapshot));
  const movement = await moveGenuinely(replacement);
  const observed = await Promise.all(surviving.map((s,i)=>waitFor(async()=>{
    const state=await snapshot(s), prior=fighter(before[i],5), later=fighter(state,5);
    const ok=validRoster(state) && !!prior && !!later && state.tick>before[i].tick
      && Math.hypot(later.x-prior.x,later.y-prior.y)>4;
    return {ok,value:state};
  },s.name+" authoritative movement replicated from new Firefox player 5",12_000)));
  console.log("ALPHA_M1_FOUR_BROWSER_CRASH_REJOIN_PASS " + JSON.stringify({
    noGracefulClose:true,crashedId:2,replacementId:5,ghostRemovedWithinMs:removalMs,
    authoritativeFourRoster:expectedAfter,realFirefoxMovement:movement,
    independentSurvivorObservations:surviving.map((s,i)=>({browser:s.name,tick:observed[i].tick,player5:fighter(observed[i],5)})),
    exactClientSource:true,greyhavenAuthorityOptIn:greyhavenMode,
    scope:"isolated localhost CI only; no independent host, visual Greyhaven, armory sword or Combat release",
  }));
}

async function pressActualMovementKey(s,key,holdMs) {
  assert(["w","a","s","d"].includes(key), "W3C keys must be WASD only");
  assert(Number.isFinite(holdMs)&&holdMs>=75&&holdMs<=550,"unsafe keyboard hold");
  const url=`/session/${s.id}/actions`;
  await webdriver(s.base,"POST",url,{actions:[{type:"key",id:"rack-walk-"+s.name,
    actions:[{type:"keyDown",value:key}]}]});
  try{await sleep(holdMs)}
  finally{await webdriver(s.base,"POST",url,{actions:[{type:"key",id:"rack-walk-"+s.name,
    actions:[{type:"keyUp",value:key}]}]});}
  // Server processes real browser key-up on its next 30Hz input packet;
  // wait for a bounded post-release fence before sampling a new direction.
  // Never overwrite fighter coordinates or ignore an obstructing solid.
  await sleep(220);
}
// Expected live roster is explicit. The original pre-crash mode remains
// EXACT 1,2,3,4; only the approved post-SIGKILL mode uses 1,3,4,5.
function hasExactAuthoritativeRoster(view,expected){
  if(!view||view.id<=0||!Number.isFinite(view.tick)||view.tick<=0||
    !Array.isArray(view.fighters)||!Array.isArray(view.scoreboard)||
    view.fighters.length!==expected.length)return false;
  const ids=view.fighters.map(f=>f.netId).sort((a,b)=>a-b);
  return ids.every((id,i)=>id===expected[i])
    && expected.every(id=>view.scoreboard.some(row=>row.startsWith("#"+id)))
    && !view.scoreboard.some(row=>/^(?:#2(?:\D|$))/.test(row) && !expected.includes(2));
}
async function walkActualBrowserAxis(s,playerId,axis,target,expectedRoster=[1,2,3,4]) {
  assert(axis==="x"||axis==="y","unauthorized walk axis");
  assert((expectedRoster.join(",")==="1,2,3,4"
      ||(rackCrashRejoin&&playerId===5&&expectedRoster.join(",")==="1,3,4,5")),
    "unreviewed authoritative live roster for native movement");
  let noProgress=0;
  const samples=[];
  for(let attempt=0;attempt<24;attempt++){
    const before=await snapshot(s),p=fighter(before,playerId);
    assert(p&&hasExactAuthoritativeRoster(before,expectedRoster),
      "missing true Rust fighter or unexpected live roster during rack approach");
    const step=nextNativeWalkPulse(p[axis],target);
    if(step.done)return samples;
    const key=axis==="x"?(step.key==="negative"?"a":"d"):
      (step.key==="negative"?"w":"s");
    await pressActualMovementKey(s,key,step.holdMs);
    const after=await waitFor(async()=>{
      const value=await snapshot(s),next=fighter(value,playerId);
      return {ok:hasExactAuthoritativeRoster(value,expectedRoster)
        &&value.tick>before.tick&&!!next,value};
    },s.name+" server-authoritative "+axis+" rack approach tick",2800);
    const newPosition=fighter(after,playerId),gain=Math.abs(p[axis]-target)-Math.abs(newPosition[axis]-target);
    samples.push({attempt,key,holdMs:step.holdMs,before:p[axis],after:newPosition[axis],
      actualPoint:{x:newPosition.x,y:newPosition.y},
      target,tick:after.tick,gain});
    if(gain<=1)noProgress++;
    else noProgress=0;
    if(noProgress>=3)throw Error(s.name+" authoritative rack path blocked on "+axis+" "+
      JSON.stringify(samples.slice(-4)));
  }
  throw Error(s.name+" did not reach rack "+axis+" target: "+JSON.stringify(samples.slice(-8)));
}
async function nativeFourRackApproaches(views) {
  assert(greyhavenMode&&nativeRackWalk,"rack acceptance requires explicit reviewed server flag");
  assert(validateWorldAlphaArmoryLayout()&&WORLD_ALPHA_SWORD_RACK_SOCKETS.length===4,
    "original World four-rack geometry invalid or substituted");
  const witnessed=[];
  // Four distinct real browser W3C actors, never puppeteered via generated
  // state, simulated input or write APIs; pure read of authoritative state.
  for(let i=0;i<4;i++){
    const s=sessions[i],slot=WORLD_ALPHA_SWORD_RACK_SOCKETS[i],id=i+1;
    assert(views[i].id===id,"unreviewed actor assignment");
    const found=await webdriver(s.base,"POST",`/session/${s.id}/element`,
      {using:"css selector",value:"#arena"});
    const target=found["element-6066-11e4-a52e-4f735466cecf"];
    assert(target,"original game canvas missing");
    await webdriver(s.base,"POST",`/session/${s.id}/element/${target}/click`,{});
    // Original click focuses canvas and may initiate unarmed swing. Allow the
    // actual server to finish recovery; never set synthetic action/position.
    await sleep(750);
    // Stay SOUTH of Smith's actual building AABB (bottom y=4012) while
    // traversing west, then approach the four racks from outside the wall.
    // Old north-first sequence intermittently clipped the actual Smith
    // east boundary at x=3914 as key-up packet delivery lagged.
    const horizontal=await walkActualBrowserAxis(s,id,"x",slot.approach.x);
    const vertical=await walkActualBrowserAxis(s,id,"y",slot.approach.y);
    const at=await waitFor(async()=>{
      const state=await snapshot(s),p=fighter(state,id);
      return {ok:fourVisible(state)&&nativeRackArrived(p,slot.approach),value:state};
    },s.name+" server-owned arrival at original World rack "+slot.socketId,3500);
    // Optional NEXT step: walk closer using only real W3C "w" input.
    // This is World #639's REVIEW-ONLY 30-unit nominal-offset proposal.
    // It cannot create, grant, select or acknowledge any physical sword.
    let reach=null;
    if(nativeRackReach){
      const target=proposedNativeRackReachPoint(slot);
      const reachPulses=await walkActualBrowserAxis(s,id,"y",target.y);
      const reached=await waitFor(async()=>{
        const state=await snapshot(s),p=fighter(state,id);
        return {ok:fourVisible(state)&&nativeRackArrived(p,target)
          &&nativeRackWithinProposedReach(p,slot),value:state};
      },s.name+" actual server-owned position within proposed reach for "+slot.socketId,3500);
      reach={target,w3cPulses:reachPulses,
        observedPosition:fighter(reached,id),
        proposedSocketDistance:Math.hypot(fighter(reached,id).x-slot.x,
          fighter(reached,id).y-slot.y),serverTick:reached.tick};
    }
    witnessed.push({id,browser:s.name,socketId:slot.socketId,
      originalWorldApproach:slot.approach,
      actualRustPosition:fighter(at,id),serverTick:at.tick,
      w3cVerticalPulses:vertical,w3cHorizontalPulses:horizontal,
      proposedReach:reach});
    console.log((nativeRackReach?"ALPHA_P0_REAL_NATIVE_PROPOSED_RACK_REACH ":"ALPHA_P0_REAL_NATIVE_RACK_APPROACH ")+
      JSON.stringify(witnessed[witnessed.length-1]));
    await saveScreenshot(s,nativeRackReach?"rack-proposed-reach-"+id:"rack-approach-"+id);
  }
  const peers=await Promise.all(sessions.map(s=>waitFor(async()=>{
    const value=await snapshot(s);
    const all=WORLD_ALPHA_SWORD_RACK_SOCKETS.every((slot,i)=>
      nativeRackReach
        ? nativeRackArrived(fighter(value,i+1),proposedNativeRackReachPoint(slot))
          &&nativeRackWithinProposedReach(fighter(value,i+1),slot)
        : nativeRackArrived(fighter(value,i+1),slot.approach));
    return {ok:fourVisible(value)&&all,value};
  },s.name+(nativeRackReach?" all four proposed near-sword positions visible"
    :" all four physical rack approaches visible"),7500)));
  const peerConsensus=nativeRackReach
    ? verifyNativeRackPeerConsensus(peers,witnessed,WORLD_ALPHA_SWORD_RACK_SOCKETS)
    : null;
  console.log((nativeRackReach?"ALPHA_P0_FOUR_NATIVE_GREYHAVEN_PROPOSED_REACH_PASS "
    :"ALPHA_P0_FOUR_NATIVE_GREYHAVEN_RACK_APPROACH_PASS ")+JSON.stringify({
    actualBrowsers:sessions.map(s=>s.name),witnessed,
    peerSnapshots:peers.map(v=>({viewer:v.id,tick:v.tick})),
    peerConsensus,
    worldFixtureAuthoritativeForPlacement:true,
    realRustPositions:true,proposedReachOnly:nativeRackReach,
    liveSwordItemsProven:false,physicalSwordClickProven:false,
    actualRenderedWorldProven:false,
    scope:"one loopback CI host, read-only prototype distance <=56 to authored empty rack only; no actual pickup or independent computers"
  }));
}


/** REAL W3C Firefox SIGKILL recovery after four independently confirmed rack approaches.
 * This is same-host, read-only server-state inspection: no item authority. */
async function nativeRackCrashRecovery() {
  const replacement=sessions.find(s=>s.name==="firefox-rejoin-5");
  assert(replacement&&sessions.length===4,
    "expected authentic new Firefox WebDriver session after abrupt client death");
  const slot=WORLD_ALPHA_SWORD_RACK_SOCKETS[1];
  const target=proposedNativeRackReachPoint(slot);
  const found=await webdriver(replacement.base,"POST",
    `/session/${replacement.id}/element`,
    {using:"css selector",value:"#arena"});
  const element=found["element-6066-11e4-a52e-4f735466cecf"];
  assert(element,"replacement browser missing original game canvas");
  await webdriver(replacement.base,"POST",
    `/session/${replacement.id}/element/${element}/click`,{});
  await sleep(750);
  const x=await walkActualBrowserAxis(replacement,5,"x",target.x,[1,3,4,5]);
  const y=await walkActualBrowserAxis(replacement,5,"y",target.y,[1,3,4,5]);
  const at=await waitFor(async()=>{
    const view=await snapshot(replacement),fighter5=fighter(view,5);
    return {ok:hasExactAuthoritativeRoster(view,[1,3,4,5])
      &&!!fighter5&&nativeRackArrived(fighter5,target)
      &&nativeRackWithinProposedReach(fighter5,slot),value:view};
  },"real replacement Firefox player5 reached vacated rack2 without authoritative shortcut",4000);
  const afterReplacementTick=at.tick;
  const peers=await Promise.all(sessions.map(s=>waitFor(async()=>{
    const v=await snapshot(s);
    const ids=v.fighters.map(f=>f.netId).sort((a,b)=>a-b);
    return {ok:v.tick>afterReplacementTick
      &&ids.join(",")==="1,3,4,5",value:v};
  },s.name+" full replacement roster and fresh server tick",10000)));
  const recovered=verifyNativeRackRecoveryPeerConsensus(peers,
    WORLD_ALPHA_SWORD_RACK_SOCKETS,afterReplacementTick);
  for(const session of sessions)
    await saveScreenshot(session,"rack-rejoin-auth-no-ghost");
  console.log("ALPHA_P0_FOUR_NATIVE_RACK_SIGKILL_REJOIN_PASS "+JSON.stringify({
    crashedRealBrowser:"firefox-2",removedPlayerId:2,
    replacementRealBrowser:"firefox-rejoin-5",replacementPlayerId:5,
    originalThreePlayersStayedNearTheirOwnEmptySockets:true,
    originalSocketRecoveredByNewRealFirefox:true,
    genuineW3cReplacementMovement:{x,y},
    authoritativeRecoveryPosition:fighter(at,5),serverTick:at.tick,
    originalAuthoredSocket:slot.socketId,peerConsensus:recovered,
    serverAuthoritativeActors:true,actualLiveSwordItems:false,
    physicalSwordClick:false,ownershipContinuity:false,
    independentClientHosts:false,
    scope:"single localhost Rust/QUIC and four real W3C browser sessions only"
  }));
}

async function run() {
  await mkdir(evidenceDir,{recursive:true});
  staticServer=await httpServer();
  const game=await startRealGameServer();
  for (let i=0;i<browsers.length;i++){
    const session=await driver(browsers[i]);
    sessions.push(session);
    const admitted=await openGame(session,game,staticServer.address().port);
    assert(admitted.id===i+1,`expected player #${i+1}; got #${admitted.id}`);
  }
  const views=await Promise.all(sessions.map(async s=>waitFor(async()=>{
    const value=await snapshot(s);return{ok:fourVisible(value),value};
  },s.name+" four authoritative identities+scoreboard",25_000)));
  assertServerOwnedGreyhavenRoster(views,"initial-four");
  if(nativeRackWalk){
    await nativeFourRackApproaches(views);
    if(rackCrashRejoin){
      await crashAndRejoin(game,staticServer.address().port);
      await nativeRackCrashRecovery();
    }
    return;
  }
  for (let i=0;i<sessions.length;i++){
    await saveScreenshot(sessions[i],"four-visible");
    console.log("ALPHA_M1_FOUR_BROWSER_VISIBLE "+JSON.stringify({
      browser:sessions[i].name,playerId:views[i].id,tick:views[i].tick,
      ids:views[i].fighters.map(f=>f.netId).sort((a,b)=>a-b),
    }));
  }
  // Genuine W3C keyboard input in Chrome #1; independent Chrome+Firefox
  // browsers must independently receive the authoritative replicated motion.
  const mover=sessions[0],other=views.slice(1);
  const before=fighter(views[0],1);
  const change=await moveGenuinely(mover,greyhavenMode?"a":"d");
  console.log("ALPHA_M1_FOUR_BROWSER_MOVED "+JSON.stringify({player:1,...change}));
  const observed=[];
  for (let i=1;i<sessions.length;i++) {
    const original=fighter(other[i-1],1);
    assert(original,"observer missing initial player #1");
    const state=await waitFor(async()=>{
      const value=await snapshot(sessions[i]),newPos=fighter(value,1);
      return {ok:fourVisible(value) && !!newPos && Math.hypot(newPos.x-original.x,newPos.y-original.y)>4,value};
    },sessions[i].name+" real remote replication of player1 movement",12_000);
    observed.push({browser:sessions[i].name,remote:fighter(state,1),tick:state.tick});
    await saveScreenshot(sessions[i],"remote-movement");
  }

  // Bidirectional Chrome/Firefox acceptance: player #4 must also produce
  // native Firefox W3C keyboard input, and BOTH Chrome browsers plus Firefox
  // #2 must observe player #4's movement in the authoritative world state.
  // Take each observer's baseline immediately before Firefox movement, not
  // from a stale login-time snapshot; require monotonic server ticks.
  const firefoxMover = sessions[3];
  const firefoxObservers = await Promise.all(sessions.slice(0, 3).map(snapshot));
  const firefoxChange = await moveGenuinely(firefoxMover);
  console.log("ALPHA_M1_FOUR_BROWSER_FIREFOX_MOVED "+JSON.stringify({
    player:4,browser:firefoxMover.name,...firefoxChange,
  }));
  const firefoxObserved = [];
  for (let i=0;i<3;i++) {
    const original=fighter(firefoxObservers[i],4);
    assert(original, sessions[i].name+" missing Firefox #4 before movement");
    const state=await waitFor(async()=>{
      const value=await snapshot(sessions[i]),newPos=fighter(value,4);
      return {ok:fourVisible(value) && value.tick>firefoxObservers[i].tick
        && !!newPos && Math.hypot(newPos.x-original.x,newPos.y-original.y)>4,value};
    },sessions[i].name+" real remote replication of Firefox player4 movement",12_000);
    firefoxObserved.push({browser:sessions[i].name,remote:fighter(state,4),tick:state.tick});
    await saveScreenshot(sessions[i],"firefox-remote-movement");
  }
  // Strict post-action health: four authoritative identities still visible in
  // every real browser, with later server ticks (not cached initial state).
  const finalStates=await Promise.all(sessions.map(async (s,i)=>waitFor(async()=>{
    const value=await snapshot(s);
    return {ok:fourVisible(value) && value.tick>views[i].tick,value};
  },s.name+" post-movement four-player liveness",9000)));

  // No client spoofing, simulated actors, manual injection or test bypass.
  console.log("ALPHA_M1_FOUR_REAL_BROWSER_SHARED_WORLD_PASS "+JSON.stringify({
    sessions:sessions.map((s,i)=>({browser:s.name,playerId:i+1})),
    actualRustServer:true,authenticatedQuic:true,validScoreboard:true,
    nativeW3cInput:true,replicatedMovementInOtherThreeBrowsers:true,observed,
    firefoxNativeW3cInput:true,firefoxReplicatedToOtherThreeBrowsers:true,
    firefoxObserved,postActionFourPlayerLiveness:finalStates.map(s=>s.tick),
    scope:greyhavenMode
      ? "single localhost server with authoritative Greyhaven spawns and static collision; NOT rendered city, sword or independent host"
      : "single GitHub-hosted localhost arena, NOT Greyhaven or independent network",
  }));
  await crashAndRejoin(game,staticServer.address().port);
}
try {await run();}
catch(error){console.error("ALPHA_M1_FOUR_REAL_BROWSER_FAIL "+(error.stack??error));process.exitCode=1;}
finally {
  for(const s of sessions)try{await webdriver(s.base,"DELETE",`/session/${s.id}`);}catch{}
  for(const child of children)terminate(child);
  // Give descendants a bounded chance to terminate; then kill any process
  // group that ignored SIGTERM, regardless of the driver's own exit status.
  await sleep(1600);
  for(const child of children)terminate(child, "SIGKILL");
  if (staticServer) {
    staticServer.closeAllConnections?.();
    await Promise.race([
      new Promise(resolve=>staticServer.close(resolve)),
      sleep(2000),
    ]);
  }
}
