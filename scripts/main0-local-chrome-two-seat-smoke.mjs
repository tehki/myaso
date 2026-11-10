// Main0 Alpha 0.2 nonrelease Chrome-only local seat preflight.
// Never connects to a game server. ChromeDriver binds to loopback and each
// temporary Chrome profile is separate from the user's real browser profile.
// Browser-only proof != authenticated Rust World or independent human QA.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir, platform } from "node:os";
import { join, isAbsolute, posix, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

// ChromeDriver can report browserName='chrome' for Chromium. A Chrome Stable
// product seat must also use a Google-branded installed Chrome binary.
export function isBrandedChromeExecutable(binary, os) {
  if (typeof binary!=="string") return false;
  if (os==="linux" && !posix.isAbsolute(binary)) return false;
  if (os==="win32" && !win32.isAbsolute(binary)) return false;
  if (os==="linux") return /\/google-chrome-stable$/.test(binary);
  if (os==="win32") return /[\\/]Google[\\/]Chrome[\\/]Application[\\/]chrome\.exe$/i.test(binary);
  return false;
}

export function validateLocalSeatEvidence(rows, expectedMajor) {
  assert.equal(rows.length, 2, "exactly two real browser seats required per physical host");
  assert.notEqual(rows[0].id, rows[1].id, "browser session identities must differ");
  assert.notEqual(rows[0].profile, rows[1].profile, "each seat needs a distinct temporary profile");
  for (const row of rows) {
    assert.equal(row.browser, "chrome", "do not substitute Chromium or simulated browser");
    assert.match(row.version, /^\d+\.\d+\.\d+\.\d+$/);
    assert.equal(Number(row.version.split(".")[0]), expectedMajor, "actual Chrome version mismatch");
    assert.equal(row.keyTrusted, true, "one real trusted W3C browser keydown required");
    assert.equal(row.keyCount, 1, "exactly one trusted W3C keydown per seat");
    assert.equal(row.browserOnly, true, "this proof cannot involve the game server");
  }
  return { hostCount: 1, chromeSeatCount: 2, browserOnly: true,
    rustWorldAcceptance: "NOT_RUN", crossHostNetworkAcceptance: "NOT_RUN",
    release: "HOLD" };
}

async function freeLoopbackPort() {
  const s=createServer();
  await new Promise((yes,no)=>{
    s.once("error",no);s.listen(0,"127.0.0.1",yes);
  });
  const port=s.address().port;
  await new Promise((yes,no)=>s.close(err=>err?no(err):yes()));
  return port;
}

async function post(driverPort, method, endpoint, data) {
  const res=await fetch(`http://127.0.0.1:${driverPort}${endpoint}`,{
    method,headers:{"content-type":"application/json"},
    body:data===undefined?undefined:JSON.stringify(data),
    signal:AbortSignal.timeout(25000),
  });
  const body=await res.json();
  if (!res.ok || body.value?.error) {
    throw new Error("ChromeDriver "+method+" "+endpoint+": "+JSON.stringify(body).slice(0,900));
  }
  return body.value;
}

async function statusReady(port,proc) {
  const until=Date.now()+30000;
  while(Date.now()<until) {
    if(proc.exitCode!==null) throw new Error("ChromeDriver exited before status");
    try {
      const reply=await post(port,"GET","/status");
      if(reply.ready) return;
    } catch {}
    await sleep(180);
  }
  throw new Error("local ChromeDriver readiness timeout");
}

async function run(argv) {
  const [alias,majorText]=argv;
  const expectedMajor=Number(majorText);
  assert.match(alias??"",/^[a-z0-9-]{1,32}$/);
  assert.ok(Number.isInteger(expectedMajor)&&expectedMajor>=115&&expectedMajor<300);
  const driver=process.env.MYASO_CHROMEDRIVER_BIN;
  const browser=process.env.CHROME_BIN;
  assert.ok(isAbsolute(driver??"")&&existsSync(driver),"explicit portable ChromeDriver absolute path required");
  assert.ok(isAbsolute(browser??"")&&existsSync(browser),"explicit Chrome Stable absolute path required");
  assert.ok(isBrandedChromeExecutable(browser,platform()),"Google Chrome Stable required; Chromium is not a qualifying product seat");
  const driverVersion=execFileSync(driver,["--version"],{
    encoding:"utf8",stdio:["ignore","pipe","ignore"],timeout:4000
  }).trim();
  assert.match(driverVersion,new RegExp("^ChromeDriver "+expectedMajor+"\\."));
  const profiles=[],sessions=[];
  const port=await freeLoopbackPort();
  const proc=spawn(driver,["--port="+port],{stdio:"ignore",windowsHide:true});
  try{
    await statusReady(port,proc);
    for(let i=0;i<2;i++){
      const profile=mkdtempSync(join(tmpdir(),"myaso-main0-seat-"));
      profiles.push(profile);
      const value=await post(port,"POST","/session",{
        capabilities:{alwaysMatch:{browserName:"chrome",
          "goog:chromeOptions":{binary:browser,args:[
            "--headless=new","--no-first-run","--disable-background-networking",
            "--user-data-dir="+profile
          ]}}}
      });
      assert.equal(typeof value.sessionId,"string");
      const id=value.sessionId;
      sessions.push(id);
      const version=value.capabilities?.browserVersion;
      const browserName=value.capabilities?.browserName;
      await post(port,"POST",`/session/${id}/url`,{url:"data:text/html,%3Ctitle%3EMain0%20local%20seat%20QA%3C/title%3E"});
      await post(port,"POST",`/session/${id}/execute/sync`,{
        script:"document.body.tabIndex=0;document.body.focus();window.__myasoTrustedKeys=[];document.addEventListener('keydown',e=>window.__myasoTrustedKeys.push({key:e.key,isTrusted:e.isTrusted}));",
        args:[]
      });
      await post(port,"POST",`/session/${id}/actions`,{
        actions:[{type:"key",id:"main0-local-w3c",actions:[
          {type:"keyDown",value:"a"},{type:"keyUp",value:"a"}
        ]}]
      });
      const keyboard=await post(port,"POST",`/session/${id}/execute/sync`,{
        script:"return window.__myasoTrustedKeys??[];",args:[]
      });
      sessions[i]={id,profile,version,browser:browserName,
        keyTrusted:keyboard[0]?.isTrusted===true,keyCount:keyboard.length,
        browserOnly:true};
    }
    const verdict=validateLocalSeatEvidence(sessions,expectedMajor);
    console.log("MAIN0_TWO_CHROME_SEAT_SMOKE_PASS",JSON.stringify({
      alias,driverVersion,versions:sessions.map(s=>s.version),
      distinctSessions:new Set(sessions.map(s=>s.id)).size,
      distinctProfiles:new Set(profiles).size,...verdict
    }));
  } finally {
    for(const session of sessions) {
      const id=typeof session==="string"?session:session?.id;
      if(id) try {await post(port,"DELETE",`/session/${id}`);} catch {}
    }
    proc.kill();
    for(const profile of profiles)rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).catch(err=>{
    console.error("MAIN0_TWO_CHROME_SEAT_SMOKE_FIRST_RED",String(err.message??err));
    process.exitCode=1;
  });
}
