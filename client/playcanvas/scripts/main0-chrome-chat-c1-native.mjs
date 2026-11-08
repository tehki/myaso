// Main0 Chrome-only nonrelease: TWO or FOUR independent real Chrome windows,
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
// Do not mislabel a dirty development candidate as an exact-head native PASS.
// First commit the reviewed source on the isolated Main0 branch.
const dirty = execFileSync('git', ['status','--porcelain'], {cwd:root,encoding:'utf8'}).trim();
assert.equal(dirty,'','real Chrome/Rust acceptance requires clean committed exact HEAD');
const chromeVersion = execFileSync(chrome,['--version'],{encoding:'utf8'}).trim();
const fourMode=process.env.MYASO_CHROME_FOUR_P0==='1';
const respawnMode=process.env.MYASO_CHROME_RESPAWN_P0==='1';
assert.ok(!(fourMode&&respawnMode),
  'Source11 respawn and four-PlayCanvas native qualifications are independent');
if(fourMode||respawnMode){
  assert.match(chromeVersion,/^Google Chrome /,
    'real PlayCanvas release qualification requires branded Google Chrome Stable');
  assert.equal(['MYASO_CHROME_COMBAT_P0','MYASO_CHROME_HEAVY_P0',
    'MYASO_CHROME_JUMP_P0'].some(k=>process.env[k]==='1'),false,
    'opt-in PlayCanvas lifecycle qualification owns the complete physical Combat trial');
}
const children = [], sessions = [];
// Nonrelease source11: bounded read-only first-RED chronology. Never sends
// any World packet, changes any actor or owns an additional QUIC session.
const source11VictimTrace = [];
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
async function physicalJoin(s, expectedAnchor) {
  await ev(s,'document.querySelector("#application").focus();');
  // A trusted W3C wheel-back Block/Parry triggers the original v1 writer
  // without moving the World9 spawn or leaving a Space/Jump state active.
  // Prior held-W admission drifted Y under load; Space admission could
  // leave a live Jump (15) and interfere with later typed LMB. No neutral
  // packets, fabricated ACK, client-selected spawn or gameplay bypass.
  await wd('POST','/session/'+s+'/actions',{actions:[{
    type:'wheel',id:'main0-native-admission-parry',
    actions:[{type:'scroll',origin:'viewport',x:480,y:250,
      deltaX:0,deltaY:120,duration:0}],
  }]});
  return poll('original Rust actor ACK/snapshot and chat stream',async()=>{
    const v=await ev(s,`const g=window.__MYASO_PLAYCANVAS__,d=document.documentElement,
      p=g?.devRustSession,c=p?.client;
      return {connected:d.dataset.rustSession,chat:d.dataset.chatC1,
        actor:c?.playerNetId??null,hasActor:!!c?.state?.has(c?.playerNetId),
        spawnX:c?.state?.get(c?.playerNetId)?.x??null,
        spawnY:c?.state?.get(c?.playerNetId)?.y??null,
        renderer:d.dataset.renderer,
        gameKind:c?.transport?.kind,gameClosed:c?.transport?.closed,
        composer:document.querySelector('[data-local-chat]')?.dataset?.connected??null,
        controls:d.dataset.combatInput,
        snapshots:p?.snapshotCount??0,serverTick:c?.latestServerTick??0};`);
    return {...v,ok:v.connected==='connected'&&v.chat==='connected'
      &&v.composer==='true'&&v.actor>0&&v.hasActor
      &&Math.abs(v.spawnX-expectedAnchor[0])<=2
      &&Math.abs(v.spawnY-expectedAnchor[1])<=2
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
async function readCombatWorld(s) {
  return ev(s,`const g=window.__MYASO_PLAYCANVAS__,session=g?.devRustSession,
    c=session?.client,netId=c?.playerNetId,own=c?.state?.get(netId);
    return {netId:netId??null,x:own?.x??null,y:own?.y??null,
      hp:own?.hp??null,action:own?.action??null,
      tick:c?.latestServerTick??0,
      typedGranted:session?.combatInput?.typedGranted===true,
      combatStatus:document.documentElement.dataset.combatInput,
      transport:c?.transport?.kind??null,
      active:document.activeElement?.id??null};`);
}
async function physicalRustCombat(s, peer, {heavy = false, jump = false} = {}) {
  assert.ok(!(heavy && jump),'heavy and jump must remain separate native trials');
  await ev(s,'document.querySelector("#application").focus();');
  const initial=await readCombatWorld(s);
  const opponentBefore=await readCombatWorld(peer);
  assert.equal(opponentBefore.hp,100,'isolated original Rust defender starts at 100 HP');
  assert.notEqual(opponentBefore.netId,initial.netId,'World owners must be distinct');
  assert.equal(initial.netId>0,true,'original ACK identity required');
  assert.equal(initial.transport,'webtransport','never a Combat protocol fork');
  const granted=await poll('original Rust typed source0 server GRANT',async()=>{
    const v=await readCombatWorld(s);
    return {...v,ok:v.typedGranted&&v.netId===initial.netId};
  },12_000);
  console.log('MAIN0_CHROME_TYPED_SOURCE0_GRANTED',JSON.stringify({
    netId:granted.netId,combatStatus:granted.combatStatus}));
  // The W3C keyboard is a genuine native Chrome physical event. The only
  // gameplay writer is the existing original Rust v1 owner.
  await action(s,[{type:'keyDown',value:'d'},
    {type:'pause',duration:235},{type:'keyUp',value:'d'}]);
  const moved=await poll('original World authoritative physical D movement',async()=>{
    const v=await readCombatWorld(s);
    return {...v,ok:v.netId===initial.netId&&v.tick>initial.tick
      &&Number.isFinite(v.x)&&v.x>initial.x+4};
  },7000);
  console.log('MAIN0_CHROME_PHYSICAL_WORLD_MOVE_PASS',JSON.stringify({
    actorId:initial.netId,before:[initial.x,initial.y],
    after:[moved.x,moved.y],originalTick:moved.tick}));
  // A read-only periodic witness records ONLY the actor's original Rust
  // snapshot state. It does not manufacture Combat events, packets or HIT.
  await ev(s,`const c=window.__MYASO_PLAYCANVAS__.devRustSession.client,
    netId=c.playerNetId,watch={changes:[],last:null};
    watch.timer=setInterval(()=>{
      const actor=c.state.get(netId),action=actor?.action;
      if(Number.isInteger(action)&&action!==watch.last){
        watch.changes.push({action,tick:c.latestServerTick,hp:actor.hp});
        watch.last=action;
      }
    },12);
    window.__MAIN0_ORIGINAL_COMBAT_WITNESS__=watch;`);
  // Actual ChromeDriver W3C pointer input; script-created MouseEvents are
  // explicitly rejected by the unchanged original Combat input owner.
  try {
    const pointer={type:'pointer',id:'main0-real-mouse',
      parameters:{pointerType:'mouse'},
      actions:[{type:'pointerMove',origin:'viewport',x:630,y:250,duration:0},
        {type:'pointerDown',button:0},{type:'pause',duration:jump?110:heavy?450:75},
        {type:'pointerUp',button:0}]};
    if(jump){
      // A separate WebDriver Space request can delay the authenticated
      // pointer event past the server's 12-tick / 200ms jump review window.
      // Pre-aim then send one W3C native two-source sequence: Space DOWN on
      // tick 1, pointer DOWN on tick 2 while Space is held, then both UP.
      // No synthesized JS event, local World jump, or parallel attack owner.
      await wd('POST','/session/'+s+'/actions',{actions:[{
        type:'pointer',id:'main0-real-mouse',parameters:{pointerType:'mouse'},
        actions:[{type:'pointerMove',origin:'viewport',x:630,y:250,duration:0}],
      }]});
      await wd('POST','/session/'+s+'/actions',{actions:[{
        type:'key',id:'main0-jump-space',actions:[
          {type:'keyDown',value:' '},{type:'pause',duration:0},
          {type:'pause',duration:110},{type:'keyUp',value:' '}],
      },{
        type:'pointer',id:'main0-real-mouse',parameters:{pointerType:'mouse'},
        actions:[{type:'pause',duration:0},{type:'pointerDown',button:0},
          {type:'pause',duration:110},{type:'pointerUp',button:0}],
      }]});
    }else{
      await wd('POST','/session/'+s+'/actions',{actions:[pointer]});
    }
    const committed=await poll(jump?'genuine Space+LMB JumpAttack original Rust World action':
      heavy?'genuine typed Heavy original Rust World action':
      'genuine typed Light original Rust World action',async()=>{
      const data=await ev(s,`const w=window.__MAIN0_ORIGINAL_COMBAT_WITNESS__;
        const p=window.__MYASO_LOCAL_GESTURE_PROOF__?.();
        return {actions:w?.changes??[],clientNetId:window.__MYASO_PLAYCANVAS__?.devRustSession?.client?.playerNetId,
          tick:window.__MYASO_PLAYCANVAS__?.devRustSession?.client?.latestServerTick,
          gesture:p?{failed:p.failed,pending:p.pending,closed:p.closed,
            recentAcks:p.acknowledged?.slice(-4).map(x=>({action:x.action,status:x.status})),
            recentPhysical:p.attemptedTransmissions?.slice(-4).map(x=>({action:x.action,sequence:x.sequence}))}:null};`);
      return {...data,ok:data.clientNetId===initial.netId
        &&data.actions.some(x=>(jump?[16,17,18]:heavy?[9,10,11]:[1,2,3]).includes(x.action))};
    },6000);
    // A real original Rust defender snapshot, not visual HP inference or
    // source0 ACK, must prove 34 Light or 46 Heavy damage precisely.
    const damage=jump?42:heavy?46:34;
    const target=await poll('original Rust '+(jump?'JumpAttack42':heavy?'Heavy46':'Light34')+' real defender HP',async()=>{
      const v=await readCombatWorld(peer);
      return {...v,ok:v.netId===opponentBefore.netId
        &&v.hp===opponentBefore.hp-damage&&v.tick>opponentBefore.tick};
    },8000);
    let actions=committed.actions;
    if(jump){
      const result=await poll('original Rust JumpAttack42 server phases',async()=>{
        const v=await ev(s,`const w=window.__MAIN0_ORIGINAL_COMBAT_WITNESS__;
          return {actions:w?.changes??[],netId:window.__MYASO_PLAYCANVAS__?.devRustSession?.client?.playerNetId};`);
        return {...v,ok:v.netId===initial.netId &&
          v.actions.some(x=>x.action===16) &&
          v.actions.some(x=>[17,18].includes(x.action))};
      },6000);
      actions=result.actions;
      assert.equal(actions.some(x=>[2,10].includes(x.action)),false,
        'physical Space+LMB must never land another Light/Heavy strike');
      console.log('MAIN0_JUMP_WORLD_TRACE',JSON.stringify({
        attackerActions:actions,defenderHpBefore:opponentBefore.hp,
        defenderHpAfter:target.hp,defenderNetId:target.netId}));
    }
    if (heavy) {
      // Source0 first opens a provisional Light WINDUP (action 1), then the
      // granted hold UPGRADE enters Heavy WINDUP (9). This is intentional;
      // an actual Light STRIKE (2), not provisional windup, is forbidden.
      // The early witness captured by the pre-HIT poll cannot prove later
      // Heavy Active/Recovery. Re-read original Rust snapshots *after* the
      // independently observed defender's 46 HP authoritative damage.
      const heavySettled=await poll('original Rust Heavy phase after 46 damage',async()=>{
        const v=await ev(s,`const w=window.__MAIN0_ORIGINAL_COMBAT_WITNESS__;
          return {actions:w?.changes??[],netId:window.__MYASO_PLAYCANVAS__?.devRustSession?.client?.playerNetId};`);
        return {...v,ok:v.netId===initial.netId
          &&v.actions.some(x=>x.action===9)
          &&v.actions.some(x=>[10,11].includes(x.action))};
      },6000);
      actions=heavySettled.actions;
      console.log('MAIN0_HEAVY_WORLD_TRACE',JSON.stringify({
        attackerActions:actions,defenderHpBefore:opponentBefore.hp,
        defenderHpAfter:target.hp,defenderNetId:target.netId}));
      assert.equal(actions.some(x=>x.action===2),false,
        'held physical Heavy must not also land an original Light strike');
    }
    return {actorId:initial.netId,movedX:moved.x-initial.x,
      attackKind:jump?'jump':heavy?'heavy':'light',source0ServerGranted:true,
      authoritativeWorldActions:actions,
      originalDefenderNetId:target.netId,
      defenderHpBefore:opponentBefore.hp,
      defenderHpAfter:target.hp,
      authoritativeWorldDamage:opponentBefore.hp-target.hp,
      originalTick:target.tick,privateHitReceiptClaimed:false};
  } finally {
    await ev(s,`const w=window.__MAIN0_ORIGINAL_COMBAT_WITNESS__;
      if(w){clearInterval(w.timer);delete window.__MAIN0_ORIGINAL_COMBAT_WITNESS__;}`);
  }
}
// PlayCanvas Source11 is a new opt-in acceptance path, not gameplay code.
// Three genuine original Rust World lives must complete on one victim QUIC
// root. Every strike comes from a trusted W3C pointer; no direct sendInput,
// local HP write, synthetic ACK, forced respawn, or control protocol fork.
async function source11Witness(s){
  const value=await ev(s,`const g=window.__MYASO_PLAYCANVAS__?.devRustSession,
    c=g?.client,p=window.__MYASO_LOCAL_GESTURE_PROOF__?.();
    const own=c?.state?.get(c?.playerNetId);
    return {actor:c?.playerNetId??null, hp:own?.hp??null,
      ownSnapshotTick:own?.serverTick??null,
      x:own?.x??null,y:own?.y??null,
      action:own?.action??null,serverTick:c?.latestServerTick??0,
      snapshotSequence:c?.latestSnapshotSequence??null,
      acknowledgedSnapshotSequence:c?.acknowledgedSnapshotSequence??null,
      processedClientTick:c?.processedClientTick??null,
      ownedInputTick:g?.combatInput?.tick??null,
      reliableSnapshots:c?.reliableSnapshots??0,
      closed:c?.transport?.closed??true,kind:c?.transport?.kind??null,
      typedGranted:g?.combatInput?.typedGranted===true,
      typedGeneration:p?.typedGeneration??null,
      typedRenewalPending:p?.typedRenewalPending??null,
      source11Events:p?.source11Events??[],
      acks:p?.acknowledged??[],nextSequence:p?.nextSequence??null,
      failed:p?.failed??null,leaseClosed:p?.closed??null};`);
  // Read-only ring buffer: keep the original HP, snapshot age, and source0
  // ACK chronology on the SAME accepted client/root. No timers or messages.
  if(respawnMode&&s===sessions[1]){
    const point={atEpochMs:Date.now(),actor:value.actor,hp:value.hp,action:value.action,
      ownSnapshotTick:value.ownSnapshotTick,serverTick:value.serverTick,
      snapshotSequence:value.snapshotSequence,
      acknowledgedSnapshotSequence:value.acknowledgedSnapshotSequence,
      reliableSnapshots:value.reliableSnapshots,typedGeneration:value.typedGeneration,
      typedRenewalPending:value.typedRenewalPending,
      processedClientTick:value.processedClientTick,ownedInputTick:value.ownedInputTick,
      typedGranted:value.typedGranted,closed:value.closed,failed:value.failed};
    source11VictimTrace.push(point);
    if(source11VictimTrace.length>120)source11VictimTrace.shift();
  }
  return value;
}
async function trustedLightClick(s,{x=630,holdMs=75}={}){
  await ev(s,'document.querySelector("#application").focus();');
  await wd('POST','/session/'+s+'/actions',{actions:[{
    type:'pointer',id:'main0-source11-real-mouse',
    parameters:{pointerType:'mouse'},actions:[
      {type:'pointerMove',origin:'viewport',x,y:250,duration:0},
      {type:'pointerDown',button:0},{type:'pause',duration:holdMs},
      {type:'pointerUp',button:0}],
  }]});
}
async function physicalThreeSameRootRespawns(attacker,victim){
  const a=await source11Witness(attacker),b=await source11Witness(victim);
  assert.ok(a.actor>0&&b.actor>0&&a.actor!==b.actor);
  assert.equal(a.typedGranted,true);
  assert.equal(b.typedGranted,true);
  assert.equal(b.kind,'webtransport');
  assert.equal(b.closed,false);
  assert.ok(Number.isInteger(b.typedGeneration)&&b.typedGeneration>=0,
    'original initial typed GRANT generation required (generation zero is valid)');
  // A real physical D key moves the attacker into original World9 Light
  // range; only Rust World validates and commits this movement.
  await ev(attacker,'document.querySelector("#application").focus();');
  await action(attacker,[{type:'keyDown',value:'d'},
    {type:'pause',duration:235},{type:'keyUp',value:'d'}]);
  const approach=await poll('real PlayCanvas movement before Source11 fight',
    async()=>{const x=await source11Witness(attacker);
      return {...x,ok:x.actor===a.actor&&x.x>a.x+4&&x.x<4206
        &&Math.abs(x.y-4160)<4&&!x.closed};
    },8_000);
  const cycles=[];
  let previousGeneration=b.typedGeneration;
  for(let cycle=1;cycle<=3;cycle++){
    const starting=await poll('Source11 original victim same-root full HP '+cycle,
      async()=>{const v=await source11Witness(victim);
        return {...v,ok:v.actor===b.actor&&v.hp===100&&v.typedGranted
          &&!v.closed&&v.kind==='webtransport'&&!v.failed&&!v.leaseClosed};
      },12_000);
    const hits=[];
    for(let hit=1;hit<=3;hit++){
      // Preserve the authoritative 34HP Light transition 100→66→32→0.
      // No attack is ever issued via JavaScript or a surrogate v1 owner.
      const wanted=Math.max(0,100-34*hit);
      await trustedLightClick(attacker);
      const result=await poll('original physical Light34 victim HP cycle '+
        cycle+' hit '+hit,async()=>{
        const v=await source11Witness(victim);
        return {...v,ok:v.actor===b.actor&&v.hp===wanted
          &&v.serverTick>starting.serverTick&&!v.closed};
      },8_000);
      hits.push({hit,serverTick:result.serverTick,hp:result.hp});
      if(hit<3)await delay(560); // do not miss original 1250ms Death phase
    }
    const died=await poll('original Rust Death state from three physical hits '+cycle,
      async()=>{const v=await source11Witness(victim);
        return {...v,ok:v.actor===b.actor&&v.hp===0
          &&v.action===8&&!v.closed};
      },2200);
    // The original root notice and server-bound typed GRANT prove a fresh
    // World incarnation, but not yet a current client HP snapshot. The first
    // Chrome first-RED had a legitimate root hint while client HP remained 0.
    const grant=await poll('original Rust Source11 bound typed GRANT '+cycle,
      async()=>{const v=await source11Witness(victim);
        const hasRenew=v.source11Events.some(x=>x.stage==='renew-lease-active'
          &&x.generation>previousGeneration);
        return {...v,ok:v.actor===b.actor&&v.typedGranted
          &&v.typedGeneration>previousGeneration&&hasRenew
          &&v.typedRenewalPending===false&&!v.failed&&!v.leaseClosed
          &&v.kind==='webtransport'&&!v.closed};
      },9_000);
    // A REAL W3C physical Block/Parry carries the original v1 snapshot ACK.
    // An otherwise-idle actor may retain a stale acknowledged baseline and
    // display HP0 even after the server-owned World has respawned. Do not
    // manufacture a neutral input, modify HP or advance a snapshot cursor.
    await ev(victim,'document.querySelector("#application").focus();');
    await wd('POST','/session/'+victim+'/actions',{actions:[{
      type:'wheel',id:'main0-source11-real-snapshot-ack-wheel',
      actions:[{type:'scroll',origin:'viewport',x:480,y:250,
        deltaX:0,deltaY:120,duration:0}],
    }]});
    const renewed=await poll('real Rust HP100 respawn snapshot after trusted wheel '+cycle,
      async()=>{const v=await source11Witness(victim);
        return {...v,ok:v.actor===b.actor&&v.hp===100&&v.typedGranted
          &&v.typedGeneration===grant.typedGeneration
          &&v.ownedInputTick>grant.ownedInputTick
          &&v.processedClientTick>grant.processedClientTick
          &&v.typedRenewalPending===false&&!v.failed&&!v.leaseClosed
          &&v.kind==='webtransport'&&!v.closed
          &&v.serverTick>died.serverTick};
      },9_000);
    const oldGeneration=previousGeneration;
    previousGeneration=renewed.typedGeneration;
    await delay(320); // original 240ms physical Block must expire before Light
    // The renewed lease must process a NEW trusted LMB rather than
    // reusing the retired source0 sequence from the previous World life.
    const before=await source11Witness(victim);
    await trustedLightClick(victim,{x:630,holdMs:65});
    const regrantedAction=await poll('post-respawn real Source11 typed Combat '+cycle,
      async()=>{const v=await source11Witness(victim);
        const settled=v.acks.some(x=>x.transportSettled===true
          &&x.action===1&&x.source===0
          &&x.sequence>=before.nextSequence
          &&x.serverTick>before.serverTick);
        return {...v,ok:v.actor===b.actor&&!v.closed
          &&v.typedGeneration===previousGeneration
          &&v.nextSequence>before.nextSequence&&settled
          &&!v.failed&&!v.leaseClosed};
      },6500);
    const chatText='Main0 Rust Source11 real life '+cycle+' '+b.actor;
    const ack=await sendChat(victim,chatText);
    const peer=await secondReceives(attacker,chatText,b.actor);
    assert.ok(ack.ack.accepted.includes(chatText));
    cycles.push({cycle,victimActor:b.actor,attackerActor:a.actor,
      hits,deathTick:died.serverTick,respawnTick:renewed.serverTick,
      oldGeneration,newGeneration:previousGeneration,
      renewedRealSource0NextSequence:regrantedAction.nextSequence,
      postRespawnChatServerAck:true,
      postRespawnChatPeer:peer.messages.some(x=>x.text===chatText),
      authoritativeAttackerApproachX:approach.x});
    console.log('MAIN0_PLAYCANVAS_SOURCE11_RESPAWN_CYCLE_PASS',
      JSON.stringify(cycles.at(-1)));
  }
  assert.equal(cycles.length,3);
  assert.ok(cycles.every(x=>x.victimActor===b.actor
    &&x.newGeneration>x.oldGeneration
    &&x.hits.map(h=>h.hp).join(',')==='66,32,0'));
  return {sha,chromeVersion,actors:[a.actor,b.actor],
    originalVictimQuicRootRetained:true,
    originalServerOwnedWorldLives:3,cycles,
    trustedNativeInputOnly:true,localDamageOrRespawnSimulation:false,
    originalRustAuthority:true,publicActivation:false};
}
let acceptanceStage='chat';
try {
  const scrubbed=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('MYASO_')));
  const rust=track(binary,[],{env:{...scrubbed,MYASO_BIND:'127.0.0.1:0',
    MYASO_MAX_PLAYERS:'4',MYASO_WORLD9_GREYHAVEN_ALPHA:'1',
    MYASO_CHAT_C1_ENABLED:'1',MYASO_CHAT_RADIUS:'160',
    MYASO_EXPERIMENTAL_GESTURE_V2:'1',
    ...(process.env.MYASO_CHROME_JUMP_P0==='1'
      ?{MYASO_EXPERIMENTAL_JUMP_ATTACK_V2:'1'}:{})}});
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
  const url='http://127.0.0.1:'+webPort+
    '/?rust=1&combatInput=1&chatC1=1'+(respawnMode?'&source11Renewal=1':'');
  await poll('local PlayCanvas Vite',async()=>({ok:(await fetch(url).catch(()=>null))?.ok===true}));
  driverPort=await port();
  const driver=track('chromedriver',['--port='+driverPort]);
  await poll('ChromeDriver',async()=>({ok:(await fetch('http://127.0.0.1:'+driverPort+'/status').catch(()=>null))?.ok===true}));
  const owned=[];
  const anchors=[[4110,4160],[4206,4160],[4110,4256],[4206,4256]];
  for(let i=0;i<(fourMode?4:2);i++){
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
    owned.push(await physicalJoin(session.sessionId,anchors[i]));
    console.log('MAIN0_CHROME_CHAT_BROWSER_ACTOR_READY',i+1,owned[i].actor);
  }
  console.log('MAIN0_CHROME_CHAT_BROWSER_BOOTED',sessions.length);
  const [a,b]=owned;
  console.log('MAIN0_CHROME_CHAT_ACTOR_ACKS',
    JSON.stringify({actors:owned.map(x=>x.actor)}));
  assert.equal(new Set(owned.map(x=>x.actor)).size,owned.length,
    'original Rust must issue a unique actor identity for every real PlayCanvas session');
  const cancelled=await cancelChatWithoutSending(sessions[0]);
  console.log('MAIN0_CHROME_CHAT_ESCAPE_CANCEL_PASS');
  const text='Main0 genuine Greyhaven Chrome Chat C1 '+sha.slice(0,8);
  const send=await sendChat(sessions[0],text);
  const receivedAll=await Promise.all(sessions.slice(1)
    .map(s=>secondReceives(s,text,a.actor)));
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
  const evidence={sha,chromeVersion,realChromes:owned.length,actors:owned.map(x=>x.actor),
    rustServerTick:owned.map(x=>x.serverTick),chatText:text,renderer:a.renderer,
    serverAcknowledged:true,recipientSenderId:a.actor,
    composerEscapeCancelledWithoutSend:cancelled.messages===0,
    gameplayTickUnchangedWhileTyping:true,
    screenshotSha256,transport:'original QUIC',publicActivation:false};
  writeFileSync(resolve(evidenceDir,'main0-original-rust-chat.json'),
    JSON.stringify(evidence,null,2)+String.fromCharCode(10));
  console.log(fourMode?'MAIN0_PLAYCANVAS_FOUR_CHROME_ORIGINAL_CHAT_PASS':
    'MAIN0_PLAYCANVAS_TWO_CHROME_ORIGINAL_CHAT_PASS',
    JSON.stringify({sha,chromeVersion,realChromes:owned.length,
      actors:owned.map(x=>x.actor),rustServerTick:owned.map(x=>x.serverTick),chatText:text,
      acknowledged:send.ack.accepted.includes(text),
      received:receivedAll.map(x=>x.messages),
      escapeCancelledWithoutSend:true,screenshotSha256,
      gameplayTickUnchangedWhileTyping:true,transport:'original QUIC',
      simulatedServerAcks:false,publicActivation:false}));
  if(respawnMode){
    acceptanceStage='source11-respawn';
    const proof=await physicalThreeSameRootRespawns(sessions[0],sessions[1]);
    const evidenceDir=resolve('.artifacts/main0-chrome-chat-c1');
    writeFileSync(resolve(evidenceDir,'main0-playcanvas-source11-three-lives.json'),
      JSON.stringify(proof,null,2)+String.fromCharCode(10));
    console.log('MAIN0_PLAYCANVAS_CHROME_SOURCE11_THREE_REAL_RESPAWNS_PASS',
      JSON.stringify(proof));
  }
  if(fourMode){
    acceptanceStage='four-combat';
    assert.equal(owned.length,4,'four real PlayCanvas browser sessions required');
    assert.ok(owned.every(x=>x.renderer==='WebGL2'),
      'each of four genuine Chrome clients must render real PlayCanvas WebGL2');
    // Four independently rendered PlayCanvas clients must all retain real
    // server-owned identities and typed source0 leases. Real Chat C1 was
    // acknowledged and delivered separately to all THREE other clients.
    const participants=await Promise.all(sessions.map(s=>poll(
      'four genuine PlayCanvas original Rust actor grants',async()=>{
        const v=await readCombatWorld(s);
        return {...v,ok:v.netId>0&&v.typedGranted
          &&v.transport==='webtransport'&&v.hp===100};
      },18_000)));
    assert.equal(new Set(participants.map(x=>x.netId)).size,4,
      'four independently authenticated original Rust actor IDs');
    const combat=await physicalRustCombat(sessions[0],sessions[1]);
    assert.equal(combat.authoritativeWorldDamage,34);
    assert.equal(combat.originalDefenderNetId,participants[1].netId);
    const spectatorProof=await Promise.all(sessions.slice(2).map(s=>poll(
      'original Rust four-client spectator replication of authoritative HIT',
      async()=>{
        const v=await ev(s,`const z=window.__MYASO_PLAYCANVAS__?.devRustSession?.client;
          const own=z?.state?.get(z.playerNetId),target=z?.state?.get(arguments[0]);
          return {observer:z?.playerNetId??null,observerHp:own?.hp??null,
            victimHp:target?.hp??null,serverTick:z?.latestServerTick??0,
            transport:z?.transport?.kind??null,closed:z?.transport?.closed};`,
          [participants[1].netId]);
        return {...v,ok:v.observer>0&&v.observerHp===100
          &&v.victimHp===66&&v.serverTick>combat.originalTick
          &&v.transport==='webtransport'&&!v.closed};
      },15_000)));
    assert.deepEqual(spectatorProof.map(x=>x.observer),
      participants.slice(2).map(x=>x.netId),
      'spectators must not get forged actor identities or World HP');
    const fourEvidence={sha,chromeVersion,realChromes:4,
      actors:participants.map(x=>x.netId),
      individuallyGrantedTypedSource0:participants.every(x=>x.typedGranted),
      serverChatAcknowledged:send.ack.accepted.includes(text),
      serverChatDeliveredToThree:receivedAll.length===3,
      combat,spectatorProof,
      originalRustAuthority:true,localCombatSimulation:false,
      privateHitReceiptClaimed:false,publicActivation:false};
    writeFileSync(resolve(evidenceDir,'main0-four-playcanvas-original-rust.json'),
      JSON.stringify(fourEvidence,null,2)+String.fromCharCode(10));
    console.log('MAIN0_PLAYCANVAS_FOUR_CHROME_RUST_CHAT_LIGHT34_PASS',
      JSON.stringify(fourEvidence));
  }
  if(['MYASO_CHROME_COMBAT_P0','MYASO_CHROME_HEAVY_P0','MYASO_CHROME_JUMP_P0']
    .some(key=>process.env[key]==='1')){
    const heavy=process.env.MYASO_CHROME_HEAVY_P0==='1';
    const jump=process.env.MYASO_CHROME_JUMP_P0==='1';
    assert.ok(!(heavy&&jump),'no mixed Heavy/Jump qualification');
    acceptanceStage=jump?'combat-jump':heavy?'combat-heavy':'combat';
    const combat=await physicalRustCombat(sessions[0],sessions[1],{heavy,jump});
    console.log(jump?'MAIN0_PLAYCANVAS_TWO_CHROME_PHYSICAL_JUMP42_PASS':
      heavy?'MAIN0_PLAYCANVAS_TWO_CHROME_PHYSICAL_HEAVY_PASS':
      'MAIN0_PLAYCANVAS_TWO_CHROME_PHYSICAL_COMBAT_PASS',
      JSON.stringify({sha,chromeVersion,realChromes:2,...combat,
        originalRustAuthority:true,localCombatSimulation:false,
        production:false}));
    writeFileSync(resolve(evidenceDir,jump?'main0-original-rust-jump.json':heavy?'main0-original-rust-heavy.json':'main0-original-rust-combat.json'),
      JSON.stringify({sha,chromeVersion,...combat,production:false},null,2)
      +String.fromCharCode(10));
  }
} catch(error) {
  // Read-only actor/lease/snapshot evidence, no tokens or credentials.
  const source11FirstRed=respawnMode&&sessions.length===2 ? {
    attacker:await source11Witness(sessions[0]).catch(e=>({error:safeError(e)})),
    victim:await source11Witness(sessions[1]).catch(e=>({error:safeError(e)})),
  }:null;
  const firstRed={sha,chromeVersion,acceptanceStage,
    reason:respawnMode?String(error?.message??error).slice(0,3500):safeError(error),
    source11FirstRed,
    // Bounded original World read-only trace retained in the CI artifact.
    source11VictimTrace:respawnMode?source11VictimTrace.slice(-120):null,
    realBrowserSessionsStarted:sessions.length,
    expectedFourPlayCanvasSessions:fourMode?4:null,
    originalRustTail:rustStderr.slice(-800),localViteTail:viteLog.slice(-500),
    production:false,untouchedTestAssertions:true};
  const evidenceDir=resolve('.artifacts/main0-chrome-chat-c1');
  mkdirSync(evidenceDir,{recursive:true});
  const combatFailure=acceptanceStage.startsWith('combat')
    ||acceptanceStage==='four-combat';
  writeFileSync(resolve(evidenceDir,
    respawnMode?'source11-three-lives-first-red.json':
      fourMode?'four-playcanvas-first-red.json':
        combatFailure?'combat-first-red.json':'first-red.json'),
    JSON.stringify(firstRed,null,2)+String.fromCharCode(10));
  console.error(respawnMode?'MAIN0_PLAYCANVAS_SOURCE11_THREE_LIVES_FIRST_RED':
    fourMode?'MAIN0_PLAYCANVAS_FOUR_CHROME_FIRST_RED':
      combatFailure?'MAIN0_PLAYCANVAS_TWO_CHROME_COMBAT_FIRST_RED':
        'MAIN0_PLAYCANVAS_TWO_CHROME_CHAT_FIRST_RED',JSON.stringify(firstRed));
  process.exitCode=1;
} finally {
  for(const id of sessions.reverse()) await wd('DELETE','/session/'+id).catch(()=>{});
  for(const p of children.reverse()) if(p.exitCode===null) p.kill('SIGTERM');
}
