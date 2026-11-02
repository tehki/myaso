// Graphics 3: nonproduction Firefox Linux headless WebGL2 acceptance.
// The caller must explicitly supply a real Firefox and geckodriver binary plus
// a loopback Vite URL. Preserve historical FIRST-RED as a separate artifact.
// This code never connects to Rust or sends gameplay inputs.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdir, mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';

const firefox=process.env.MYASO_G3_FIREFOX_BINARY;
const gecko=process.env.MYASO_G3_GECKODRIVER_BINARY;
assert.ok(firefox && gecko && existsSync(firefox) && existsSync(gecko),
  'Explicit installed real Firefox and geckodriver binaries required');
const target=new URL(process.env.MYASO_G3_QA_URL || 'http://127.0.0.1:4174/');
assert.ok(target.protocol==='http:' && ['127.0.0.1','localhost'].includes(target.hostname),
  'No public or production URL may be tested');
const port=Number(process.env.MYASO_G3_GECKODRIVER_PORT || '19741');
assert.ok(Number.isInteger(port) && port>=1024 && port<=65535,'Invalid local geckodriver port');
const outputRoot=resolve(process.env.MYASO_G3_QA_OUT || '.artifacts/graphics3-firefox-headless');
await mkdir(outputRoot,{recursive:true});
const output=await mkdtemp(join(outputRoot,'attempt-'));
const base='http://127.0.0.1:'+port;
const logs=[];
const driver=spawn(gecko,['--host','127.0.0.1','--port',String(port),'--log','info'],
  {env:process.env,stdio:['ignore','pipe','pipe']});
for(const stream of [driver.stdout,driver.stderr])stream.on('data',b=>logs.push(String(b)));
const hash=b=>createHash('sha256').update(b).digest('hex');
async function request(method,path,body,limit=30000){
  const response=await fetch(base+path,{method,
    headers:body===undefined?undefined:{'content-type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(limit)});
  const parsed=await response.json().catch(()=>({}));
  if(!response.ok||parsed.value?.error)throw Error(path+': '+JSON.stringify(parsed).slice(0,1500));
  return parsed.value;
}
async function awaitReady(fn,limit=25000){
  const deadline=Date.now()+limit;let last='';
  while(Date.now()<deadline){
    try{const v=await fn();if(v)return v;}catch(e){last=String(e);}
    await sleep(180);
  }
  throw Error('Native browser timeout: '+last);
}
const probe=String.raw`
 const d=document.documentElement.dataset,device=window.__MYASO_PLAYCANVAS__?.device,gl=device?.gl;
 const e=gl?.getExtension('WEBGL_debug_renderer_info');
 return {booted:d.engineBooted,renderer:d.renderer,deviceType:d.graphicsDeviceType,
   vendor:e?gl.getParameter(e.UNMASKED_VENDOR_WEBGL):null,
   gpuRenderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null,
   glVersion:gl?.getParameter(gl.VERSION)||null,
   realWebGL2:Boolean(gl&&gl instanceof WebGL2RenderingContext),
   redLion:d.redLionAssetLoaded,blacksmith:d.blacksmithAssetLoaded,
   look:d.greyhavenLook,smoke:d.greyhavenDuskSmoke,wisps:d.greyhavenSmokeWisps,
   message:document.querySelector('#fatal')?.textContent||'',
   userAgent:navigator.userAgent};
`;
const frameSample=String.raw`
 const done=arguments[arguments.length-1],ts=[];
 function next(t){ts.push(t);
  if(ts.length<121){requestAnimationFrame(next);return;}
  const intervals=ts.slice(1).map((v,i)=>v-ts[i]).sort((a,b)=>a-b);
  const percentile=p=>intervals[Math.floor((intervals.length-1)*p)];
  done({samples:intervals.length,p50Ms:percentile(.5),p95Ms:percentile(.95),
    maxMs:intervals.at(-1),unit:'RAF callback interval, not GPU-present FPS'});
 }
 requestAnimationFrame(next);
`;
let session;
const results=[];
const dayImageHashes=new Map();
const exec=(script,async=false)=>request('POST','/session/'+session+'/execute/'+(async?'async':'sync'),
  {script,args:[]},async?60000:25000);
try{
  await awaitReady(async()=>{if(driver.exitCode!==null)throw Error('geckodriver exited');
    return (await request('GET','/status')).ready;},12000);
  const capabilities={browserName:'firefox','moz:firefoxOptions':{
    binary:firefox,args:['-headless'],
    prefs:{'webgl.disabled':false,'webgl.enable-webgl2':true,'webgl.force-enabled':true}
  }};
  const value=await request('POST','/session',{capabilities:{alwaysMatch:capabilities}},45000);
  session=value.sessionId;
  assert.ok(session,'Real Firefox Marionette W3C session required');
  await request('POST','/session/'+session+'/timeouts',{script:60000,pageLoad:45000});
  for(const [view,look] of [['red-lion','day'],['red-lion','dusk'],['blacksmith','day'],['blacksmith','dusk']]){
    const page=new URL(target.href);
    page.searchParams.set('view',view);
    page.searchParams.set('greyhavenTime',look);
    await request('POST','/session/'+session+'/url',{url:page.href},50000);
    let state=null;
    for(let tries=0;tries<90;tries++){
      state=await exec(probe);
      if(state?.booted==='true'||state?.booted==='false')break;
      await sleep(300);
    }
    const key=view+'-'+look;
    await writeFile(join(output,key+'.json'),JSON.stringify(state,null,2)+'\n');
    const png=Buffer.from(await request('GET','/session/'+session+'/screenshot'),'base64');
    await writeFile(join(output,key+'.png'),png);
    const pngSHA256=hash(png);
    // A healthy WebGL2 object does not prove the Canvas is actually painting:
    // Linux headless Chromium once returned WebGL2 while all screenshots were
    // byte-identical blank scenes. Require day/dusk image differentiation.
    if(look==='day')dayImageHashes.set(view,pngSHA256);
    else {
      assert.ok(dayImageHashes.has(view),'Corresponding daylight screenshot required');
      assert.notEqual(pngSHA256,dayImageHashes.get(view),
        'Day and dusk screenshot bytes identical: visual renderer not qualified');
    }
    console.log('G3_FIREFOX_LINUX_NATIVE_FRAME',key,JSON.stringify({...state,pngSHA256}));
    assert.equal(state?.booted,'true','preserve first-RED when context fails');
    assert.equal(state?.renderer,'WebGL2');
    assert.equal(state?.deviceType,'webgl2');
    assert.equal(state?.realWebGL2,true);
    assert.match(state?.glVersion||'',/^WebGL 2\.0/,'Actual WebGL2 version string required');
    assert.equal(state?.redLion,'true');
    assert.equal(state?.blacksmith,'true');
    assert.equal(state?.look,look);
    assert.equal(state?.smoke,look==='dusk'?'true':'false');
    assert.equal(state?.wisps,look==='dusk'?'12':'0');
    if(process.env.MYASO_G3_REQUIRE_GPU==='1'){
      const name=state.gpuRenderer||'';
      assert.match(state.vendor||'',/Intel|AMD|NVIDIA/i,'Hardware renderer vendor required');
      assert.doesNotMatch(name,/SwiftShader|Basic Render|WARP|llvmpipe|softpipe/i,
        'Software renderer is not hardware GPU evidence');
    }
    const frames=await exec(frameSample,true);
    assert.ok(frames.samples>=100,'Real native RAF sample required');
    await writeFile(join(output,key+'-perf.json'),JSON.stringify(frames,null,2)+'\n');
    console.log('G3_FIREFOX_LINUX_NATIVE_PERFORMANCE',key,JSON.stringify(frames));
    results.push({key,state,frames,pngSHA256:hash(png)});
  }
  await writeFile(join(output,'summary.json'),JSON.stringify(results,null,2)+'\n');
  console.log('G3_FIREFOX_LINUX_HEADLESS_WEBGL2_PASS',JSON.stringify({scenes:results.length,output}));
}catch(e){
  console.error('G3_FIREFOX_LINUX_HEADLESS_FIRST_RED',String(e));
  await writeFile(join(output,'first-RED.json'),
    JSON.stringify({error:String(e),priorFrames:results,driverLog:logs.join('').slice(-12000)},null,2)+'\n');
  process.exitCode=1;
}finally{
  if(session)try{await request('DELETE','/session/'+session)}catch{}
  driver.kill('SIGTERM');
  await writeFile(join(output,'geckodriver.log'),logs.join(''));
}
