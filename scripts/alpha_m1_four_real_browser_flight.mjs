// Core 8A / P0 M1: four REAL Chrome/Firefox WebDriver browser sessions
// sharing the actual Rust/WebTransport server. Localhost CI only: NOT WAN,
// cross-machine, authored Greyhaven city or Combat/item acceptance.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

const root = process.cwd();
const deadlineMs = 120_000;
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
async function webdriver(base, method, uri, body) {
  const response = await fetch(base + uri, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
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
  const child = spawn(path.join(root, "server", "target", "debug", "myaso-server"), [], {
    cwd: root,
    env: { ...process.env, MYASO_BIND:"127.0.0.1:0", MYASO_MAX_PLAYERS:"4",
      MYASO_FLIGHT_BACKGROUND_PLAYERS:"0", MYASO_FLIGHT_NEAR_PRESSURE_PLAYERS:"0" },
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
    return {ok:!!url && !!hash && output.includes("myaso admission cap: 4 concurrent players"),
      value:{url,hash}};
  }, "real server pinned localhost / cap four",45_000);
  assert(url.startsWith("https://127.0.0.1:") && url.endsWith("/game"),"server must bind loopback");
  return {url,hash};
}
async function driver(browser) {
  const isChrome=browser.family==="chrome";
  const executable=isChrome
    ? (process.env.CHROMEWEBDRIVER ? path.join(process.env.CHROMEWEBDRIVER,"chromedriver") : "chromedriver")
    : (process.env.GECKOWEBDRIVER ? path.join(process.env.GECKOWEBDRIVER,"geckodriver") : "geckodriver");
  const arguments_=isChrome ? [`--port=${browser.port}`] : ["--host","127.0.0.1","--port",String(browser.port)];
  const child=spawn(executable,arguments_,{
    cwd:root,stdio:["ignore","pipe","pipe"],detached:process.platform!=="win32",
  });
  children.add(child);
  child.stderr.on("data",chunk=>process.stderr.write(`[${browser.name}-driver] ${chunk}`));
  const base=`http://127.0.0.1:${browser.port}`;
  await waitFor(async()=>{
    if (child.exitCode !== null) throw Error(browser.name+" driver exited "+child.exitCode);
    try { const response=await fetch(base+"/status",{signal:AbortSignal.timeout(700)});return {ok:response.ok,value:true}; }
    catch {return {ok:false,value:false};}
  }, browser.name+" native WebDriver startup",15_000);
  const caps=isChrome
    ? {browserName:"chrome","goog:chromeOptions":{args:[
      "--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1280,900",
      "--disable-background-timer-throttling","--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding"]}}
    : {browserName:"firefox","moz:firefoxOptions":{args:["-headless"],
      prefs:{"dom.min_background_timeout_value":4,"dom.timeout.enable_budget_timer_throttling":false}}};
  const created=await webdriver(base,"POST","/session",{capabilities:{alwaysMatch:caps}});
  const id=created.sessionId ?? created.value?.sessionId;
  assert(id, browser.name+" no real WebDriver session ID");
  await webdriver(base,"POST",`/session/${id}/timeouts`,{script:15000,pageLoad:30000,implicit:0});
  return {name:browser.name,base,id};
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
async function moveGenuinely(s) {
  const initial=await snapshot(s),before=fighter(initial,initial.id);
  assert(before,"attacker own fighter absent before movement");
  const found=await webdriver(s.base,"POST",`/session/${s.id}/element`,{using:"css selector",value:"#arena"});
  const element=found["element-6066-11e4-a52e-4f735466cecf"];
  assert(element,"real browser has no arena");
  await webdriver(s.base,"POST",`/session/${s.id}/element/${element}/click`,{});
  const url=`/session/${s.id}/actions`;
  await webdriver(s.base,"POST",url,{actions:[{type:"key",id:"movement-"+s.name,actions:[{type:"keyDown",value:"d"}]}]});
  try {await sleep(1100);}
  finally {
    await webdriver(s.base,"POST",url,{actions:[{type:"key",id:"movement-"+s.name,actions:[{type:"keyUp",value:"d"}]}]});
  }
  const own=await waitFor(async()=>{
    const value=await snapshot(s),after=fighter(value,initial.id);
    return {ok:!!after && Math.hypot(after.x-before.x,after.y-before.y)>4 && value.tick>initial.tick,value};
  },"authoritative native WebDriver D movement",8000);
  return {before,after:fighter(own,initial.id),tick:own.tick};
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
  const change=await moveGenuinely(mover);
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
  // No client spoofing, simulated actors, manual injection or test bypass.
  console.log("ALPHA_M1_FOUR_REAL_BROWSER_SHARED_WORLD_PASS "+JSON.stringify({
    sessions:sessions.map((s,i)=>({browser:s.name,playerId:i+1})),
    actualRustServer:true,authenticatedQuic:true,validScoreboard:true,
    nativeW3cInput:true,replicatedMovementInOtherThreeBrowsers:true,observed,
    scope:"single GitHub-hosted localhost arena, NOT Greyhaven or independent network",
  }));
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
