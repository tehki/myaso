// Isolated native Chromium W3C smoke gate for the optional NPC panel.
// node scripts/npc_pilot_native_browser_gate.mjs
// Does not start a game server, alter production, or prove four-player QUIC.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = `<!doctype html><meta charset="utf-8"><div class="arena-wrap">
<canvas id="arena" tabindex="0" width="640" height="480"></canvas></div>
<script type="module">
import { createNpcChatPanel } from "/web/npc-chat.mjs";
const p = { sent: [], gameKeys: [], heldKeys: [], focused: 0, resolve: null };
const arena = document.querySelector("#arena");
arena.addEventListener("keydown", e => {
 p.gameKeys.push(e.key);
 if ("wasd".includes(e.key)) p.heldKeys.push(e.key);
});
const npc = createNpcChatPanel({
 onFocus() { p.focused++; p.heldKeys.length = 0; },
 onSend(id,text) {
  p.sent.push({id,text});
  return new Promise(resolve => { p.resolve = resolve; });
 }
});
p.roster = value => npc.setRoster(value);
p.receive = value => npc.receive(value);
p.focus = () => npc.focus();
p.snapshot = () => ({
 hidden: document.querySelector(".npc-pilot").hidden,
 active: document.activeElement?.id || document.activeElement?.tagName,
 focused: p.focused, sent: [...p.sent],
 gameKeys: [...p.gameKeys], heldKeys: [...p.heldKeys],
 disabled: document.querySelector(".npc-pilot button").disabled,
 history: [...document.querySelectorAll(".npc-pilot ol li")].map(x => x.textContent)
});
window.__probe = p;
arena.focus();
</script>`;
const http = createServer(async (req, res) => {
 try {
  const pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;
  if (pathname === "/") {
   res.writeHead(200, {"content-type":"text/html","cache-control":"no-store"});
   res.end(html);
   return;
  }
  const file = path.resolve(root, "." + pathname);
  if (!file.startsWith(root + path.sep) || !file.endsWith(".mjs")) {
   res.writeHead(403).end("denied");
   return;
  }
  res.writeHead(200, {"content-type":"text/javascript","cache-control":"no-store"});
  res.end(await readFile(file));
 } catch { res.writeHead(404).end("not found"); }
});
const bind = (server) => new Promise((ok,fail) => {
 server.once("error", fail);
 server.listen(0,"127.0.0.1",ok);
});
const reservePort = async () => {
 const s = createServer();
 await bind(s);
 const port = s.address().port;
 await new Promise(ok=>s.close(ok));
 return port;
};
const request = async (base, method, route, data) => {
 const response = await fetch(base + route, {
  method, headers:data===undefined?undefined:{"content-type":"application/json"},
  body:data===undefined?undefined:JSON.stringify(data),
  signal:AbortSignal.timeout(8000),
 });
 const value = await response.json();
 if (!response.ok || value.value?.error) {
  throw Error(method+" "+route+": "+JSON.stringify(value).slice(0,1200));
 }
 return value.value ?? value;
};
const until = async (fn,label) => {
 for(let n=0;n<60;n++) {
  const result = await fn();
  if(result) return result;
  await sleep(100);
 }
 throw Error("No native acceptance: "+label);
};
let driver,session;
let base="";
try {
 await bind(http);
 const port = await reservePort();
 base="http://127.0.0.1:"+port;
 driver=spawn(process.env.CHROMEWEBDRIVER||"chromedriver",
  ["--port="+port,"--allowed-ips=127.0.0.1"],
  {cwd:root,stdio:["ignore","ignore","pipe"]});
 let driverErr="";
 driver.stderr.on("data",b=>{driverErr+=b.toString()});
 await until(async ()=>{
  if(driver.exitCode!==null) throw Error("driver exited: "+driverErr);
  try {return (await fetch(base+"/status",{signal:AbortSignal.timeout(700)})).ok;}
  catch{return false;}
 },"ChromeDriver");
 const created=await request(base,"POST","/session",{capabilities:{alwaysMatch:{
  browserName:"chrome","goog:chromeOptions":{args:[
   "--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1000,730"
  ]}
 }}});
 session=created.sessionId??created.value?.sessionId;
 assert.ok(session,"a genuine Chrome W3C session is required");
 const e="/session/"+session;
 const execute=(script)=>request(base,"POST",e+"/execute/sync",{script,args:[]});
 const snapshot=()=>execute("return window.__probe?.snapshot() || null");
 const element=async (selector)=>{
  const el=await request(base,"POST",e+"/element",{using:"css selector",value:selector});
  return el["element-6066-11e4-a52e-4f735466cecf"];
 };
 const keys=(id,text)=>request(base,"POST",e+"/element/"+id+"/value",{text});
 await request(base,"POST",e+"/url",{url:"http://127.0.0.1:"+http.address().port+"/"});
 await until(snapshot,"real module loaded");
 let a=await snapshot();
 assert.equal(a.hidden,true);
 assert.equal(a.active,"arena");
 assert.equal(a.focused,0);
 const canvas=await element("#arena");
 await request(base,"POST",e+"/element/"+canvas+"/click",{});
 await keys(canvas,"w");
 a=await snapshot();
 assert.ok(a.gameKeys.includes("w"),"native key reaches game canvas when NPCs off");
 assert.equal(a.sent.length,0);
 await execute("window.__probe.roster([{id:3,name:'Rowan',role:'Guard',x:155,y:205}]);");
 assert.equal((await snapshot()).hidden,false);
 const input=await element(".npc-pilot input");
 await request(base,"POST",e+"/element/"+input+"/click",{});
 await keys(input,"Hello Rowan");
 await keys(input,"\ue007"); // actual WebDriver Enter key; no synthetic DOM submit
 await until(async()=>(await snapshot()).sent.length===1,"native Enter submitted one message");
 a=await snapshot();
 assert.equal(a.disabled,true);
 assert.deepEqual(a.history,[]);
 await execute("window.__probe.receive({id:3,text:'Early NPC reply'});");
 assert.deepEqual((await snapshot()).history,[],"early answer cannot precede question");
 await execute("window.__probe.resolve();");
 await until(async()=>(await snapshot()).history.length===2,"ordered chat pair");
 a=await snapshot();
 assert.match(a.history[0],/You → Rowan: Hello Rowan/);
 assert.equal(a.history[1],"Early NPC reply");
 await execute("window.__probe.roster([]);");
 a=await snapshot();
 assert.equal(a.hidden,true);
 assert.equal(a.active,"arena","NPC revocation returns focus to game canvas");
 assert.deepEqual(a.history,[]);
 await keys(canvas,"a");
 assert.ok((await snapshot()).gameKeys.includes("a"),"native game keyboard restored");

 // The canvas Enter shortcut calls npc.focus(). That method must rely on
 // the native input-focus event exactly once, never explicitly release a
 // second time on the same transition.
 await execute("window.__probe.roster([{id:3,name:'Rowan',role:'Guard',x:155,y:205}]);");
 await request(base,"POST",e+"/element/"+canvas+"/click",{});
 const priorFocus = await snapshot();
 await execute("window.__probe.focus();");
 const afterFocus = await snapshot();
 assert.equal(afterFocus.active,"INPUT","arena Enter must move native input focus");
 assert.equal(afterFocus.focused,priorFocus.focused+1,
   "one arena Enter transition must trigger exactly one input release");
 await execute("window.__probe.focus();");
 assert.equal((await snapshot()).focused,afterFocus.focused,
   "repeated programmatic focus on same input must not release a second time");
 await execute("window.__probe.roster([]);");
 assert.equal((await snapshot()).active,"arena",
   "single-transition focus test must restore canvas on roster revocation");

 // Exercise the real browser's focus behavior for the selector and Speak
 // button, not merely simulated DOM focus in the Node fixture. Revoking a
 // roster must never strand the player in a newly hidden pilot control.
 for (const [selector, tag, gameKey] of [
  [".npc-pilot select", "SELECT", "d"],
  [".npc-pilot button", "BUTTON", "s"],
 ]) {
  await execute("window.__probe.roster([{id:3,name:'Rowan',role:'Guard',x:155,y:205}]);");
  const control = await element(selector);
  // Genuine browser input is held before entering NPC controls; a focus
  // callback must release gameplay input even if the native keyup no longer
  // reaches the canvas.
  await request(base,"POST",e+"/element/"+canvas+"/click",{});
  await keys(canvas,gameKey);
  let beforeControl = await snapshot();
  assert.ok(beforeControl.heldKeys.includes(gameKey),
    "native canvas press must be held before entering "+tag);
  await request(base,"POST",e+"/element/"+control+"/click",{});
  const entered = await snapshot();
  assert.equal(entered.active,tag,
    "native click must focus "+tag+" before roster revocation");
  assert.equal(entered.focused,beforeControl.focused + 1,
    "entering "+tag+" must invoke combat-input release callback");
  assert.deepEqual(entered.heldKeys,[],
    "entering "+tag+" must clear held movement without canvas keyup");
  await execute("window.__probe.roster([]);");
  const restored = await snapshot();
  assert.equal(restored.hidden,true);
  assert.equal(restored.active,"arena",tag+" revocation must return arena keyboard focus");
  assert.equal(restored.sent.length,1,"focus test must not send another NPC message");
  await keys(canvas,gameKey);
  assert.ok((await snapshot()).gameKeys.includes(gameKey),
    "native gameplay keyboard still works after revoking "+tag);
 }
 console.log("NPC_P0_NATIVE_CHROME_GATE "+JSON.stringify({
  ok:true,engine:"Chromium W3C",nativeKeyboard:true,nativeEnter:true,
  npcOffHidden:true,earlyReplyOrdered:true,revocationRestoresFocus:true,
  nativeSelectorRevokeRestoresFocus:true,nativeSubmitRevokeRestoresFocus:true,
  nativeSelectorReleasesHeldInput:true,nativeSubmitReleasesHeldInput:true,
  nativeProgrammaticFocusSingleRelease:true,
  serverConnection:false,independentHost:false
 }));
} finally {
 if(session) {
  try{await request(base,"DELETE","/session/"+session)}catch{}
 }
 if(driver) {
  driver.kill("SIGTERM");
  await Promise.race([new Promise(ok=>driver.once("exit",ok)),sleep(600)]);
  if(driver.exitCode===null) driver.kill("SIGKILL");
 }
 await new Promise(ok=>http.close(ok));
}
