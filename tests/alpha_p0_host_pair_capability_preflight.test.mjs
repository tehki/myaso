// Pure, offline only. Fake binaries below are NOT real browsers or drivers.
import test from "node:test";
import assert from "node:assert/strict";
import {probeHostCapabilities} from "../scripts/alpha_p0_host_pair_capability_preflight.mjs";

const good={
  chromium:"Chromium 152.0.7977.82",
  firefox:"Mozilla Firefox 153.4",
  chromedriver:"ChromeDriver 152.0.7977.82",
  geckodriver:"geckodriver 0.36.0",
};
function fakeExec(versions){
  return (name,args)=>{
    assert.deepEqual(args,["--version"]);
    return Object.hasOwn(versions,name)
      ? {status:0,stdout:versions[name],stderr:""}
      : {status:null,error:{code:"ENOENT"},stdout:"",stderr:""};
  };
}
function checked(versions=good,options={}){
  return probeHostCapabilities({
    exec:fakeExec(versions),exists:()=>false,
    platform:"linux",env:{},host:"TEST_ONLY",nodeVersion:"26.8.1",
    ...options
  });
}
test("offline synthetic complete native Chrome+Firefox pair is only locally ready",()=>{
  const r=checked();
  assert.equal(r.ready,true);
  assert.equal(r.chromeDriverMajorChecked,true);
  assert.equal(r.status,"LOCAL_BROWSER_PREREQUISITES_FOUND_NOT_A_GAME_PASS");
  assert.equal(r.noNetworkConnectivityChecked,true);
  assert.equal(r.noNativeBrowserSessionsStarted,true);
  assert.equal(r.requiresApprovedThirdHostStaging,true);
});
test("absent GeckoDriver fails closed even when Firefox executable exists",()=>{
  const v={...good};delete v.geckodriver;
  const r=checked(v);
  assert.equal(r.ready,false);
  assert(r.missing.includes("geckodriver on PATH"));
});
test("absent Firefox fails closed even with Chromium and both drivers",()=>{
  const v={...good};delete v.firefox;
  assert.equal(checked(v).ready,false);
});
test("missing ChromeDriver and absent Chrome browser reject operator-run launch",()=>{
  const v={firefox:good.firefox,geckodriver:good.geckodriver};
  const r=checked(v);
  assert.equal(r.ready,false);
  assert(r.missing.includes("real Chrome or Chromium browser"));
  assert(r.missing.includes("chromedriver on PATH"));
});
test("driver/browser Chromium major version mismatch is a hard blocker",()=>{
  const r=checked({...good,chromedriver:"ChromeDriver 151.0.7990.0"});
  assert.equal(r.ready,false);
  assert(r.missing.some(x=>x.includes("major does not match")));
});
test("Chrome and Firefox Windows default installation alone do not waive missing drivers",()=>{
  const files=new Set([
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
  ]);
  const r=checked({},{
    platform:"win32",env:{PROGRAMFILES:"C:\\Program Files"},
    exists:p=>files.has(p)
  });
  assert.equal(r.ready,false);
  assert.equal(r.chrome.found,true);
  assert.equal(r.firefox.found,true);
  assert.equal(r.chrome.method,"WINDOWS_INSTALL_PATH_ONLY");
  assert(r.missing.includes("chromedriver on PATH"));
  assert(r.missing.includes("geckodriver on PATH"));
});
test("Windows browser default paths plus valid real-driver versions are only local preflight",()=>{
  const files=new Set([
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
  ]);
  const r=checked({chromedriver:good.chromedriver,geckodriver:good.geckodriver},{
    platform:"win32",env:{PROGRAMFILES:"C:\\Program Files"},
    exists:p=>files.has(p)
  });
  assert.equal(r.ready,true);
  assert.equal(r.chromeDriverMajorChecked,false);
  assert.equal(r.noNetworkConnectivityChecked,true);
});
test("unsupported Node.js version and driver execution failures are rejected",()=>{
  assert(checked(good,{nodeVersion:"18.20.0"}).missing.includes("Node.js >=20"));
  const r=checked(good,{exec:(name)=>{
    if(name==="chromedriver")return {status:1,stdout:"ChromeDriver bad",stderr:"error"};
    return fakeExec(good)(name,["--version"]);
  }});
  assert.equal(r.ready,false);
  assert(r.missing.includes("chromedriver on PATH"));
});
