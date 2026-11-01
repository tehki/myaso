// Core8C: genuine nonproduction original Rust -> PlayCanvas read-only native evidence.
// No gameplay input, prediction, map authority claim, production connection, or wire changes.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';

const clientRoot=fileURLToPath(new URL('../',import.meta.url));
const worldRoot=process.env.MYASO_CORE8C_GREYHAVEN_SRC;
const expectedSha=process.env.MYASO_CORE8C_EXPECTED_SHA;
assert.ok(worldRoot && /^[a-f0-9]{40}$/.test(expectedSha||''),
  'supply an independently selected Greyhaven source directory and exact SHA');
const out=resolve(clientRoot,'.artifacts/core8c-rust-readonly');
const sha=x=>createHash('sha256').update(x).digest('hex');
const children=[],sessions=[];
function command(name,args,cwd,env=process.env){
  const r=spawnSync(name,args,{cwd,env,encoding:'utf8',timeout:180000});
  if(r.status!==0)throw Error(name+' failed: '+String(r.stderr||r.error).slice(-2000));
  return r.stdout.trim();
}
async function waitFor(fn,limit=22000){
  const end=Date.now()+limit;let last;
  while(Date.now()<end){try{const v=await fn();if(v)return v;}catch(e){last=String(e)}await sleep(120);}
  throw Error('native condition timeout '+(last||''));
}
async function freePort(){
  const s=createServer();await new Promise(ok=>s.listen(0,'127.0.0.1',ok));
  const p=s.address().port;await new Promise(ok=>s.close(ok));return p;
}
async function request(base,method,path,data,timeout=30000){
  const r=await fetch(base+path,{method,
    headers:data===undefined?undefined:{'content-type':'application/json'},
    body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(timeout)});
  const b=await r.json().catch(()=>null);
  if(!r.ok||b?.value?.error)throw Error(path+' '+JSON.stringify(b).slice(0,2200));
  return b?.value;
}
async function addBrowser(url){
  const port=await freePort();
  const driver=spawn(process.env.CHROMEDRIVER_BINARY||'chromedriver',
    ['--port='+port],{stdio:'ignore'});children.push(driver);
  const base='http://127.0.0.1:'+port;
  await waitFor(async()=>{if(driver.exitCode!==null)throw Error('chromedriver exited');
    return (await request(base,'GET','/status')).ready;});
  const session=await request(base,'POST','/session',{capabilities:{alwaysMatch:{
    browserName:'chrome','goog:chromeOptions':{args:[
      '--headless=new','--no-sandbox','--disable-dev-shm-usage',
      '--window-size=1280,720','--use-gl=angle','--use-angle=swiftshader',
      '--enable-webgl','--enable-unsafe-swiftshader']}}}});
  const id=session.sessionId;assert.ok(id,'real browser session');
  const s={base,id};sessions.push(s);
  await request(base,'POST','/session/'+id+'/timeouts',{script:15000,pageLoad:30000});
  await request(base,'POST','/session/'+id+'/url',{url},45000);
  return s;
}
async function observe(s){
  return request(s.base,'POST','/session/'+s.id+'/execute/sync',{script:
    'const s=window.__MYASO_PLAYCANVAS__?.devRustSession;return {booted:document.documentElement.dataset.engineBooted,renderer:document.documentElement.dataset.renderer,connected:document.documentElement.dataset.rustSession,status:document.querySelector("#runtime-status")?.textContent,snapshots:s?.snapshotCount??0,count:s?.layer?.count??0,ownNetId:s?.client?.playerNetId??null,tick:s?.client?.latestServerTick??0,actors:s?.client?.state?[...s.client.state.values()].map(a=>({netId:a.netId,x:a.x,y:a.y,facing:a.facing,hp:a.hp,action:a.action,serverTick:a.serverTick})).sort((a,b)=>a.netId-b.netId):[]};',
    args:[]});
}
function assertSpawn(a,id,x,y){
  assert.equal(a.netId,id);
  assert.ok(Math.abs(a.x-x)<=2&&Math.abs(a.y-y)<=2,
    'Rust World9 spawn expected, not client-side origin: '+JSON.stringify(a));
  assert.ok(Number.isFinite(a.facing)&&Number.isFinite(a.hp));
}
await mkdir(out,{recursive:true});
try{
  const source=command('git',['rev-parse','HEAD'],worldRoot);
  assert.equal(source,expectedSha);
  const main=await readFile(join(worldRoot,'server/src/main.rs'),'utf8');
  assert.match(main,/configure_greyhaven_alpha_runtime\(&mut state\.world, greyhaven_alpha\)/);
  command('node',['scripts/verify-core8c-greyhaven-geometry.mjs'],worldRoot);
  const cargoEnv={...process.env,RUSTUP_TOOLCHAIN:'1.89.0'};
  command('cargo',['build','--locked','--manifest-path','server/Cargo.toml','--bin','myaso-server'],
    worldRoot,cargoEnv);
  const binary=join(cargoEnv.CARGO_TARGET_DIR||join(worldRoot,'server/target'),'debug/myaso-server');
  const binarySha=sha(await readFile(binary));
  let stdout='',stderr='';
  const server=spawn(binary,[],{cwd:worldRoot,env:{...cargoEnv,
    MYASO_BIND:'127.0.0.1:0',MYASO_MAX_PLAYERS:'2',
    MYASO_CHAT_C1_ENABLED:'0',MYASO_WORLD9_GREYHAVEN_ALPHA:'1',
    MYASO_EXPERIMENTAL_GESTURE_V2:'0'},stdio:['ignore','pipe','pipe']});
  children.push(server);
  server.stdout.on('data',p=>stdout+=p.toString());
  server.stderr.on('data',p=>stderr+=p.toString());
  const actual=await waitFor(()=>{
    if(server.exitCode!==null)throw Error('isolated Rust exited: '+stderr);
    const endpoint=stdout.match(/listening on (https:\/\/[^\s]+)/)?.[1];
    const cert=stdout.match(/development certificate SHA-256:\s*([a-fA-F0-9:]+)/)?.[1]
      ?.replaceAll(':','').toLowerCase();
    return endpoint&&cert?.length===64?{endpoint,cert}:null;
  },15000);
  assert.match(actual.endpoint,/^https:\/\/127\.0\.0\.1:\d+\/game$/);
  const proof={type:'operator-owned isolated Rust launch; NOT map token on network',
    sourceSha:source,binarySha256:binarySha,pid:server.pid,
    bind:'127.0.0.1:0',endpoint:actual.endpoint,certSha256:actual.cert,
    rustGate:'MYASO_WORLD9_GREYHAVEN_ALPHA=1',geometry:'23 pinned World9 solids',
    snapshotHasMapToken:false,snapshotHasIncarnation:false};
  console.log('CORE8C_GREYHAVEN_OPERATOR_LAUNCH '+JSON.stringify(proof));
  const vite=spawn(process.execPath,[join(clientRoot,'node_modules/vite/bin/vite.js'),
    '--host','127.0.0.1','--port','4174','--strictPort'],{
    cwd:clientRoot,env:{...process.env,
      VITE_MYASO_DEV_QUIC_URL:actual.endpoint,VITE_MYASO_DEV_QUIC_SHA256:actual.cert},
    stdio:'ignore'});
  children.push(vite);
  const url='http://127.0.0.1:4174/?rust=1';
  await waitFor(async()=>{if(vite.exitCode!==null)throw Error('Vite exited');
    return (await fetch(url)).ok;});
  const first=await addBrowser(url);
  const alone=await waitFor(async()=>{
    const s=await observe(first);
    return s.connected==='connected'&&s.actors.length===1&&s.snapshots>0?s:null;
  },25000);
  assert.equal(alone.booted,'true');
  assertSpawn(alone.actors[0],1,4110,4160);
  const second=await addBrowser(url);
  let lastTogether=[];
  const together=await waitFor(async()=>{
    const both=await Promise.all([observe(first),observe(second)]);
    lastTogether=both;
    return both.every(s=>s.connected==='connected'&&s.actors.length===2
      &&s.count===2&&s.tick>0&&s.snapshots>0)?both:null;
  },25000).catch(async error=>{
    // Do not relax the simultaneous-state assertion. Retain genuine
    // first-RED with the operator-side server identity and both browser views.
    const witness={ proof, firstConnected:alone, observed:lastTogether,
      reason:'original Rust realtime_ready stays false until baseline input ACK',
      readOnlyBridgeSentInput:false, sameSessionRespawnProven:false };
    await writeFile(join(out,'core8c-original-rust-first-red.json'),
      JSON.stringify(witness,null,2)+'\n');
    console.error('CORE8C_TWO_SEATS_FIRST_RED '+JSON.stringify(lastTogether));
    throw error;
  });
  for(const s of together){
    assertSpawn(s.actors[0],1,4110,4160);
    assertSpawn(s.actors[1],2,4206,4160);
    assert.equal(s.ownNetId,null,
      'read-only PlayCanvas has no input ACK; cannot invent own actor identity');
  }
  const png=Buffer.from(await request(first.base,'GET',
    '/session/'+first.id+'/screenshot'),'base64');
  assert.ok(png.length>1024);
  await writeFile(join(out,'native-playcanvas-original-rust.png'),png);
  await request(second.base,'DELETE','/session/'+second.id);
  sessions.splice(sessions.indexOf(second),1);
  const afterRemoval=await waitFor(async()=>{
    const s=await observe(first);
    return s.count===1&&s.actors.length===1&&s.actors[0].netId===1?s:null;
  },22000);
  const third=await addBrowser(url);
  const rejoined=await waitFor(async()=>{
    const both=await Promise.all([observe(first),observe(third)]);
    return both.every(s=>s.count===2&&s.actors.length===2
      &&s.actors.some(x=>x.netId===3))?both:null;
  },25000);
  for(const s of rejoined)assertSpawn(s.actors[1],3,4206,4160);
  const evidence={...proof,initial:alone,twoSeats:together,
    afterRemoval,rejoined,canonicalWire:true,production:false,
    sameSessionRespawnVerified:false,physicalWANVerified:false,
    snapshotOwnNetIdUnknownWithoutOriginalInputAck:true,screenshotSha256:sha(png)};
  await writeFile(join(out,'core8c-readonly-live.json'),
    JSON.stringify(evidence,null,2)+'\n');
  console.log('CORE8C_PLAYCANVAS_ORIGINAL_RUST_READONLY_PASS '+JSON.stringify({
    sourceSha:source,binarySha256:binarySha,
    realActors:together[0].actors.map(x=>x.netId),
    realPositions:together[0].actors.map(x=>[x.x,x.y]),
    afterLeave:afterRemoval.actors.map(x=>x.netId),
    afterReconnect:rejoined[0].actors.map(x=>x.netId),
    originalRustServerTick:rejoined[0].tick,sameSessionRespawnVerified:false}));
}finally{
  for(const s of sessions)await request(s.base,'DELETE','/session/'+s.id).catch(()=>{});
  for(const c of children.reverse())if(c.exitCode===null)c.kill('SIGTERM');
}
