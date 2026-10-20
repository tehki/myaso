import {createServer} from 'node:http';
import {access,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {spawn} from 'node:child_process';
import {resolve,extname,sep} from 'node:path';
import os from 'node:os';
const sha='7c5fe9b08e86254cff9e05ae07c1d0d572cb7879';
const root=process.cwd();
const host='http://127.0.0.1:54520';
const driverHost='http://127.0.0.1:9537';
const pin='8ee6ef5b682adfd1e3d312a92cc582b8e15c24aa7815dae0e0831c1e870ed291';
const target='https://game.open-trust-layer.org:44551/game';
const device='github-hosted-external-WAN';let session=null,driver=null,web=null;let complete=false;
const start=Date.now(),events=[];
const log=(key,v)=>{const obj={t:Math.round((Date.now()-start)/1000),key,v};events.push(obj);console.log('R2_'+key+'='+JSON.stringify(v))};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function query(p,method='GET',body){
 const r=await fetch(driverHost+p,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const j=await r.json();
 if(!r.ok||j.value?.error)throw new Error('WebDriver '+method+' '+p+' '+JSON.stringify(j.value).slice(0,500));
 return j.value;
}
const exec=script=>query('/session/'+session+'/execute/sync','POST',{script,args:[]});
const stateScript="return {event:document.querySelector('#event-text')?.textContent||'',focus:document.querySelector('#focus-label')?.textContent||'',score:[...document.querySelectorAll('#scoreboard-list li')].map(e=>e.textContent),hp:document.querySelector('#player-hp-value')?.textContent,stamina:document.querySelector('#player-stamina-value')?.textContent,tick:window.__MYASO_ACCEPTANCE_STATE__?.serverTick||0,id:window.__MYASO_ACCEPTANCE_STATE__?.playerNetId||null,actions:window.__MYASO_ACCEPTANCE_STATE__?.ownActionTransitions?.slice(-15)||[]};";
const state=()=>exec(stateScript);
const action=actions=>query('/session/'+session+'/actions','POST',{actions});
async function cleanup(){
 if(complete)return;complete=true;
 if(session){try{await query('/session/'+session,'DELETE')}catch{}}
 if(driver){driver.kill('SIGTERM');setTimeout(()=>driver.kill('SIGKILL'),1500).unref()}
 if(web)await new Promise(r=>web.close(r));
 try{await writeFile('R2-WAN-CLOUD-W3C-'+device+'.json',JSON.stringify({device,sha,target,pin,events},null,2))}catch(e){console.log('EVIDENCE_ERROR='+e.message)}
}
const watchdog=setTimeout(()=>{console.log('WATCHDOG_TIMEOUT');cleanup().finally(()=>process.exit(9))},105000);
try{
 await access(root+'/web/online-game.mjs');
 web=createServer(async(req,res)=>{
 const p=new URL(req.url,host).pathname;
 const file=resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));
 if(!(file===root||file.startsWith(root+sep))){res.writeHead(403);res.end();return}
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[extname(file)]||'application/octet-stream');
 try{await access(file);createReadStream(file).pipe(res)}catch{res.writeHead(404);res.end('not found')}
 });
 await new Promise((ok,bad)=>{web.once('error',bad);web.listen(54520,'127.0.0.1',ok)});
 log('LOCAL_PREVIEW_STARTED',host);
 driver=spawn('chromedriver',['--port=9537','--allowed-ips=127.0.0.1'],{stdio:['ignore','pipe','pipe']});
 driver.stderr.on('data',d=>{if(d.toString().includes('ERROR'))log('DRIVER_WARNING',d.toString().slice(0,180))});
 for(let i=0;i<40;i++){try{const s=await fetch(driverHost+'/status',{signal:AbortSignal.timeout(600)});if(s.ok)break}catch{}await pause(180)}
 const s=await query('/session','POST',{capabilities:{alwaysMatch:{browserName:'chrome','goog:chromeOptions':{args:['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--mute-audio','--window-size=1365,900']}}}});
 session=s.sessionId; log('CHROMIUM',session?.slice(0,8));
 const url=host+'/web/?'+new URLSearchParams({server:target,cert:pin,scenario:'uistaminaauth'});
 await query('/session/'+session+'/url','POST',{url});
 let s0={},ok=false;
 for(let i=0;i<42;i++){s0=await state();if(s0.id&&s0.tick>0){ok=true;break}if(i%8===0)log('JOIN_PROGRESS',{event:s0.event,tick:s0.tick});await pause(500)}
 if(!ok)throw new Error('JOIN_FAIL '+JSON.stringify(s0));
 log('CONNECTED',{id:s0.id,tick:s0.tick,score:s0.score});
 await pause(13500);
 const s1=await state(); log('TWO_PLAYER_SNAPSHOT',{id:s1.id,tick:s1.tick,score:s1.score,focus:s1.focus});
 const e=await query('/session/'+session+'/element','POST',{using:'css selector',value:'#arena'});
 const elem=e['element-6066-11e4-a52e-4f735466cecf'];if(!elem)throw new Error('canvas missing');
 await query('/session/'+session+'/element/'+elem+'/click','POST',{});
 await action([{type:'key',id:'kbd',actions:[{type:'keyDown',value:'d'},{type:'pause',duration:550},{type:'keyUp',value:'d'}]}]);log('TRUSTED_KEY_MOVE',true);
 const mouseActions=(holdMs)=>[{type:'pointer',id:'pointer',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',duration:130,origin:{'element-6066-11e4-a52e-4f735466cecf':elem},x:70,y:0},{type:'pointerDown',button:0},{type:'pause',duration:holdMs},{type:'pointerUp',button:0}]}];
 await action(mouseActions(145));log('TRUSTED_LIGHT_RELEASE',true);
 await pause(400);
 await action(mouseActions(470));log('TRUSTED_HEAVY_RELEASE',true);
 await action([{type:'wheel',id:'wheel',actions:[{type:'scroll',origin:{'element-6066-11e4-a52e-4f735466cecf':elem},x:0,y:0,deltaX:0,deltaY:-180,duration:0}]}]);log('TRUSTED_ROLL_WHEEL',true);
 await pause(250);
 await action([{type:'wheel',id:'wheel',actions:[{type:'scroll',origin:{'element-6066-11e4-a52e-4f735466cecf':elem},x:0,y:0,deltaX:0,deltaY:160,duration:0}]}]);log('TRUSTED_BLOCK_WHEEL',true);
 await pause(1800);
 const s2=await state();log('FINAL_SERVER_STATE',s2);
 if(!(s2.tick>s1.tick))throw new Error('No authoritative tick progression');
 if(s2.score.length<2)throw new Error('Only one player visible');
 log('RESULT','PASS_INDEPENDENT_WAN_CLOUD_CHROME_W3C_TWO_PLAYERS');
 await pause(2500);
}catch(e){log('RESULT','FAIL: '+e.message);process.exitCode=1}
finally{clearTimeout(watchdog);await cleanup()}