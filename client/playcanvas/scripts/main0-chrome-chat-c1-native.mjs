// Main0 Chrome-only nonrelease: TWO independent real Chrome windows,
// original loopback Rust QUIC, physical v1 sender identity and original Chat C1.
// Never opens a public host, rewrites packet codec, fakes ACK or deploys.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, isAbsolute, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('../..');
const binary = process.env.MYASO_PLAYCANVAS_RUST_BIN;
assert.ok(binary && isAbsolute(binary) && basename(binary) === 'myaso-server'
  && existsSync(binary), 'explicit absolute locally built original Rust binary required');
const chrome = process.env.CHROME_BIN || '/usr/bin/chromium';
assert.ok(isAbsolute(chrome) && existsSync(chrome), 'real local Chrome/Chromium required');
const sha = execFileSync('git', ['rev-parse','HEAD'], {cwd:root,encoding:'utf8'}).trim();
const chromeVersion = execFileSync(chrome,['--version'],{encoding:'utf8'}).trim();
const children = [], sessions = [];
let rustStdout = '', rustStderr = '', viteLog = '', driverPort = 0;
const loopback = /^https:\/\/127\.0\.0\.1:\d+\/game$/;
const safeError = x => String(x?.message || x).slice(0,350);

function track(cmd,args,opts={}) {
  const c = spawn(cmd,args,{stdio:['ignore','pipe','pipe'],...opts});
  children.push(c);
  return c;
}
function port() {
  return new Promise((resolve,reject) => {
    const s=createServer();
    s.once('error',reject);
    s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});
  });
}
async function poll(label,check,ms=25_000) {
  const until=Date.now()+ms; let last;
  while (Date.now()<until) {
    try {const v=await check(); last=v; if (v?.ok) return v;} catch(e){last=safeError(e);}
    await delay(170);
  }
  throw new Error(label+' first-RED '+JSON.stringify(last).slice(0,1500));
}
async function wd(method,path,body) {
  const res=await fetch('http://127.0.0.1:'+driverPort+path,{
    method,headers:{'content-type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(35_000),
  });
  const j=await res.json();
  if(!res.ok||j.value?.error)throw Error('WebDriver '+method+' '+path+': '+JSON.stringify(j).slice(0,1100));
  return j.value;
}
const ev=(s,script,args=[])=>wd('POST','/session/'+s+'/execute/sync',{script,args});
const action=(s,items)=>wd('POST','/session/'+s+'/actions',{
  actions:[{type:'key',id:'main0-physical',actions:items}],
});
const press=(s,value)=>action(s,[{type:'keyDown',value},{type:'keyUp',value}]);
async function physicalJoin(s) {
  await ev(s,'document.querySelector("#application").focus();');
  await action(s,[{type:'keyDown',value:'w'},{type:'pause',duration:130},{type:'keyUp',value:'w'}]);
  return poll('original Rust actor ACK/snapshot and chat stream',async()=>{
    const v=await ev(s,`const g=window.__MYASO_PLAYCANVAS__,d=document.documentElement,
      p=g?.devRustSession,c=p?.client;
      return {connected:d.dataset.rustSession,chat:d.dataset.chatC1,
        actor:c?.playerNetId??null,hasActor:!!c?.state?.has(c?.playerNetId),
        renderer:d.dataset.renderer,
        gameKind:c?.transport?.kind,gameClosed:c?.transport?.closed,
        composer:document.querySelector('[data-local-chat]')?.dataset?.connected??null,
        controls:d.dataset.combatInput,
        snapshots:p?.snapshotCount??0,serverTick:c?.latestServerTick??0};`);
    return {...v,ok:v.connected==='connected'&&v.chat==='connected'
      &&v.composer==='true'&&v.actor>0&&v.hasActor
      &&v.gameKind==='webtransport'&&!v.gameClosed
      &&v.serverTick>0&&v.snapshots>0};
  },45_000);
}
async function cancelChatWithoutSending(s) {
  await ev(s,'document.querySelector("#application").focus();');
  const before = await ev(s,'return document.querySelectorAll(".local-chat-item").length');
  await press(s,'\uE007');
  const opened = await ev(s,'return document.querySelector("[data-local-chat]")?.dataset.open');
  assert.equal(opened,'true','Enter opens original composer');
  await ev(s,'document.querySelector(".local-chat-input").value="UNSENT CHAT DRAFT"');
  await press(s,'\uE00C');
  const cancelled = await ev(s,`const root=document.querySelector('[data-local-chat]');
    return {open:root.dataset.open,text:root.querySelector('input').value,
      focused:document.activeElement?.id==='application',
      messages:document.querySelectorAll('.local-chat-item').length};`);
  assert.deepEqual(cancelled,{open:'false',text:'',focused:true,messages:before},
    'Escape must cancel and never forge an outgoing message');
  return cancelled;
}
async function sendChat(s,message) {
  await ev(s,'document.querySelector("#application").focus();');
  await press(s,'\uE007');
  const editing=await ev(s,`const r=document.querySelector('[data-local-chat]');
    return {open:r?.dataset.open,focused:document.activeElement===r?.querySelector('input')}`);
  assert.deepEqual(editing,{open:'true',focused:true},'native Enter must open original Chat composer');
  const before=await ev(s,'return window.__MYASO_PLAYCANVAS__.devRustSession.combatInput.tick');
  await press(s,'w'); // Trusted key while composer owns focus MUST NOT move Rust.
  const after=await ev(s,'return window.__MYASO_PLAYCANVAS__.devRustSession.combatInput.tick');
  assert.equal(after,before,'Chat input focus must suppress original physical game packets');
  await ev(s,'document.querySelector(".local-chat-input").value=arguments[0]',[message]);
  await press(s,'\uE007');
  const ack=await poll('original Rust authenticated Chat ACK',async()=>{
    const v=await ev(s,`const r=document.querySelector('[data-local-chat]');
      return {open:r?.dataset.open,accepted:[...document.querySelectorAll('li[data-delivery=accepted] .local-chat-text')]
        .map(n=>n.textContent),status:r?.querySelector('.local-chat-status')?.textContent};`);
    return {...v,ok:v.open==='false'&&v.accepted.includes(message)};
  },15_000);
  return {editing,blockedPhysicalTick:before,ack};
}
async function secondReceives(s,message,senderId) {
  return poll('original server sender identity and Chat C1 delivery',async()=>{
    const v=await ev(s,`const list=[...document.querySelectorAll('.local-chat-item[data-channel=local]')]
      .map(x=>({name:x.querySelector('.local-chat-sender')?.textContent,
        text:x.querySelector('.local-chat-text')?.textContent}));
      return {messages:list};`);
    return {...v,ok:v.messages.some(x=>x.text===message&&x.name==='Player #'+senderId)};
  },12_000);
}
try {
  const scrubbed=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('MYASO_')));
  const rust=track(binary,[],{env:{...scrubbed,MYASO_BIND:'127.0.0.1:0',
    MYASO_MAX_PLAYERS:'4',MYASO_WORLD9_GREYHAVEN_ALPHA:'1',
    MYASO_CHAT_C1_ENABLED:'1',MYASO_CHAT_RADIUS:'160',
    MYASO_EXPERIMENTAL_GESTURE_V2:'1'}});
  rust.stdout.on('data',c=>rustStdout+=c.toString());
  rust.stderr.on('data',c=>rustStderr+=c.toString());
  const world=await poll('isolated original Rust boot',()=>{
    const endpoint=rustStdout.match(/listening on (https:\/\/[^\s]+)/)?.[1],
      pin=rustStdout.match(/development certificate SHA-256:\s*([a-fA-F0-9:]+)/)?.[1]?.replaceAll(':','');
    return {endpoint,pin,ok:!!endpoint&&!!pin};
  },20_000);
  assert.match(world.endpoint,loopback);
  assert.match(world.pin,/^[a-fA-F0-9]{64}$/);
  console.log('MAIN0_CHROME_CHAT_RUST_LOOPBACK',JSON.stringify({sha,chromeVersion,
    world9:'operator launch',gameUrl:world.endpoint,chat:'original reliable C1'}));
  const webPort=await port();
  const vite=track(process.execPath,[resolve('node_modules/vite/bin/vite.js'),
    '--host','127.0.0.1','--port',String(webPort),'--strictPort'],{
    env:{...process.env,VITE_MYASO_DEV_QUIC_URL:world.endpoint,
      VITE_MYASO_DEV_QUIC_SHA256:world.pin}});
  vite.stdout.on('data',c=>viteLog+=c.toString());
  vite.stderr.on('data',c=>viteLog+=c.toString());
  const url='http://127.0.0.1:'+webPort+'/?rust=1&combatInput=1&chatC1=1';
  await poll('local PlayCanvas Vite',async()=>({ok:(await fetch(url).catch(()=>null))?.ok===true}));
  driverPort=await port();
  const driver=track('chromedriver',['--port='+driverPort]);
  await poll('ChromeDriver',async()=>({ok:(await fetch('http://127.0.0.1:'+driverPort+'/status').catch(()=>null))?.ok===true}));
  const owned=[];
  for(let i=0;i<2;i++){
    const session=await wd('POST','/session',{capabilities:{alwaysMatch:{
      browserName:'chrome','goog:chromeOptions':{binary:chrome,args:[
        '--headless=new','--no-sandbox','--disable-dev-shm-usage',
        '--disable-background-networking','--use-gl=angle','--use-angle=swiftshader',
        '--enable-webgl','--enable-unsafe-swiftshader','--window-size=960,540']}}}});
    assert.ok(session.sessionId,'real Chrome session');
    sessions.push(session.sessionId);
    await wd('POST','/session/'+session.sessionId+'/url',{url});
    console.log('MAIN0_CHROME_CHAT_BROWSER_SESSION_CREATED',i+1);
    await poll('PlayCanvas Chrome real boot',async()=>{
      const v=await ev(session.sessionId,'return {booted:document.documentElement.dataset.engineBooted,renderer:document.documentElement.dataset.renderer,rust:document.documentElement.dataset.rustSession}');
      return {...v,ok:v.booted==='true'&&v.renderer!=='failed'&&v.rust==='connected'};
    },45_000);
    // Bind each original Rust actor before allocating a second software
    // WebGL2 renderer; X230i's memory/CPU remain a genuine QA constraint.
    owned.push(await physicalJoin(session.sessionId));
    console.log('MAIN0_CHROME_CHAT_BROWSER_ACTOR_READY',i+1,owned[i].actor);
  }
  console.log('MAIN0_CHROME_CHAT_BROWSER_BOOTED',sessions.length);
  const [a,b]=owned;
  console.log('MAIN0_CHROME_CHAT_ACTOR_ACKS',JSON.stringify({a:a.actor,b:b.actor}));
  assert.notEqual(a.actor,b.actor,'Rust MUST issue different actor identities');
  const cancelled=await cancelChatWithoutSending(sessions[0]);
  console.log('MAIN0_CHROME_CHAT_ESCAPE_CANCEL_PASS');
  const text='Main0 genuine Greyhaven Chrome Chat C1 '+sha.slice(0,8);
  const send=await sendChat(sessions[0],text);
  const received=await secondReceives(sessions[1],text,a.actor);
  console.log('MAIN0_CHROME_CHAT_AUTHORITATIVE_ACK_RECEIVE_PASS');
  // Optional visual witness: software-GPU screenshot retrieval is not
  // authoritative World or Chat acceptance and must not block gameplay QA.
  // When explicitly requested, it is an additional strict (not silent) gate.
  const evidenceDir=resolve('.artifacts/main0-chrome-chat-c1');
  mkdirSync(evidenceDir,{recursive:true});
  let screenshotSha256=null;
  if(process.env.MYASO_CHROME_CHAT_SCREENSHOT==='1'){
    console.log('MAIN0_CHROME_CHAT_SCREENSHOT_REQUESTED');
    const screenshotBase64=await wd('GET','/session/'+sessions[1]+'/screenshot');
    const screenshot=Buffer.from(screenshotBase64,'base64');
    assert.ok(screenshot.length>2048,'real Chrome screenshot required when requested');
    screenshotSha256=createHash('sha256').update(screenshot).digest('hex');
    writeFileSync(resolve(evidenceDir,'recipient-chrome.png'),screenshot);
  }
  const evidence={sha,chromeVersion,realChromes:2,actors:[a.actor,b.actor],
    rustServerTick:[a.serverTick,b.serverTick],chatText:text,renderer:a.renderer,
    serverAcknowledged:true,recipientSenderId:a.actor,
    composerEscapeCancelledWithoutSend:cancelled.messages===0,
    gameplayTickUnchangedWhileTyping:true,
    screenshotSha256,transport:'original QUIC',publicActivation:false};
  writeFileSync(resolve(evidenceDir,'main0-original-rust-chat.json'),
    JSON.stringify(evidence,null,2)+String.fromCharCode(10));
  console.log('MAIN0_PLAYCANVAS_TWO_CHROME_ORIGINAL_CHAT_PASS',
    JSON.stringify({sha,chromeVersion,realChromes:2,actors:[a.actor,b.actor],
      rustServerTick:[a.serverTick,b.serverTick],chatText:text,
      acknowledged:send.ack.accepted.includes(text),received:received.messages,
      escapeCancelledWithoutSend:true,screenshotSha256,
      gameplayTickUnchangedWhileTyping:true,transport:'original QUIC',
      simulatedServerAcks:false,publicActivation:false}));
} catch(error) {
  const firstRed={sha,chromeVersion,reason:safeError(error),
    originalRustTail:rustStderr.slice(-800),localViteTail:viteLog.slice(-500),
    production:false,untouchedTestAssertions:true};
  const evidenceDir=resolve('.artifacts/main0-chrome-chat-c1');
  mkdirSync(evidenceDir,{recursive:true});
  writeFileSync(resolve(evidenceDir,'first-red.json'),
    JSON.stringify(firstRed,null,2)+String.fromCharCode(10));
  console.error('MAIN0_PLAYCANVAS_TWO_CHROME_CHAT_FIRST_RED',JSON.stringify(firstRed));
  process.exitCode=1;
} finally {
  for(const id of sessions.reverse()) await wd('DELETE','/session/'+id).catch(()=>{});
  for(const p of children.reverse()) if(p.exitCode===null) p.kill('SIGTERM');
}
