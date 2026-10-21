// Core 8A P0: read-only local tools preflight for an authorized two-client-host
// staging flight. Never binds sockets, starts a browser/driver session, installs
// software, or checks remote connectivity. A PASS is not a QUIC gameplay PASS.
import {spawnSync} from "node:child_process";
import {existsSync} from "node:fs";
import path from "node:path";
import {hostname} from "node:os";
import {pathToFileURL} from "node:url";

function commandVersion(exec,command) {
  try {
    const r=exec(command,["--version"],{
      encoding:"utf8",timeout:2500,windowsHide:true,stdio:["ignore","pipe","pipe"]
    });
    if(r.error||r.status!==0)return null;
    const output=(String(r.stdout??"")+"\n"+String(r.stderr??"")).trim();
    return output.slice(0,180)||null;
  }catch{return null}
}
function browserFallbacks(platform,env){
  if(platform!=="win32")return {chrome:[],firefox:[]};
  const dirs=[env.PROGRAMFILES,env["PROGRAMFILES(X86)"],env.LOCALAPPDATA]
    .filter(x=>typeof x==="string"&&x.length>0);
  return {
    chrome:dirs.map(d=>path.win32.join(d,"Google","Chrome","Application","chrome.exe")),
    firefox:dirs.map(d=>path.win32.join(d,"Mozilla Firefox","firefox.exe"))
  };
}
// Read Windows PE product-version metadata without executing the browser.
function readWindowsFileVersion(exec,pathname){
  if(typeof pathname!=="string"||!path.win32.isAbsolute(pathname))return null;
  const quoted=pathname.replaceAll("'","''");
  try{
    const r=exec("powershell.exe",[
      "-NoProfile","-NonInteractive","-Command",
      "(Get-Item -LiteralPath '"+quoted+"').VersionInfo.ProductVersion",
    ],{encoding:"utf8",timeout:2500,windowsHide:true,stdio:["ignore","pipe","pipe"]});
    if(r.error||r.status!==0)return null;
    const version=String(r.stdout??"").trim();
    return /^\d{2,3}\.\d+(?:\.\d+){0,3}$/.test(version)?version:null;
  }catch{return null}
}
function firstUsableCommand(exec,names){
  for(const name of names){
    const output=commandVersion(exec,name);
    if(output)return {found:true,command:name,version:output,method:"PATH_COMMAND"};
  }
  return null;
}
function browserEvidence(exec,exists,commands,fallbacks,fileVersion) {
  const byCommand=firstUsableCommand(exec,commands);
  if(byCommand)return byCommand;
  const installed=fallbacks.find(p=>exists(p));
  if(installed){
    const version=fileVersion(installed);
    return {found:true,command:installed,version,
      method:version?"WINDOWS_READ_ONLY_PE_VERSION":"WINDOWS_INSTALL_PATH_VERSION_UNVERIFIED"};
  }
  return {found:false,command:null,version:null,method:"NOT_FOUND"};
}
function majorFromVersion(value){
  if(typeof value!=="string")return null;
  const m=value.match(/\b(\d{2,3})\./);
  return m?Number(m[1]):null;
}
export function probeHostCapabilities({
  exec=spawnSync,exists=existsSync,platform=process.platform,
  env=process.env,nodeVersion=process.versions.node,host=hostname(),
  fileVersion=(pathname)=>readWindowsFileVersion(exec,pathname),
}={}){
  const fallback=browserFallbacks(platform,env);
  const nodeMajor=Number.parseInt(String(nodeVersion).split(".")[0],10);
  const chrome=browserEvidence(exec,exists,
    ["google-chrome","chromium","chromium-browser","chrome"],fallback.chrome,fileVersion);
  const firefox=browserEvidence(exec,exists,["firefox"],fallback.firefox,fileVersion);
  const driverChrome=firstUsableCommand(exec,["chromedriver"]);
  const driverFirefox=firstUsableCommand(exec,["geckodriver"]);
  const missing=[];
  if(!Number.isSafeInteger(nodeMajor)||nodeMajor<20)missing.push("Node.js >=20");
  if(!chrome.found)missing.push("real Chrome or Chromium browser");
  if(!firefox.found)missing.push("real Firefox browser");
  if(!driverChrome)missing.push("chromedriver on PATH");
  if(!driverFirefox)missing.push("geckodriver on PATH");
  const chromeMajor=majorFromVersion(chrome.version);
  const driverMajor=majorFromVersion(driverChrome?.version);
  if(chrome.found&&chromeMajor===null)missing.push("Chrome/Chromium version cannot be verified");
  if(driverChrome&&driverMajor===null)missing.push("ChromeDriver version cannot be verified");
  const majorMismatch=chromeMajor!==null&&driverMajor!==null&&chromeMajor!==driverMajor;
  if(majorMismatch)missing.push("ChromeDriver major does not match Chrome/Chromium major");
  const ready=missing.length===0;
  return Object.freeze({
    status:ready?"LOCAL_BROWSER_PREREQUISITES_FOUND_NOT_A_GAME_PASS":"BLOCKED_LOCAL_BROWSER_PREREQUISITES",
    ready,platform,host,nodeVersion:String(nodeVersion),missing,
    chrome,firefox,
    chromedriver:driverChrome??{found:false,command:null,version:null},
    geckodriver:driverFirefox??{found:false,command:null,version:null},
    chromeDriverMajorChecked:chromeMajor!==null&&driverMajor!==null,
    chromeDriverMajorMatch:!majorMismatch,
    noNetworkConnectivityChecked:true,
    noNativeBrowserSessionsStarted:true,
    requiresApprovedThirdHostStaging:true
  });
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const result=probeHostCapabilities();
  console.log("MYASO_P0_PAIR_LOCAL_CAPABILITY_"+(result.ready?"READY":"BLOCKED")+" "+JSON.stringify(result));
  if(!result.ready)process.exitCode=1;
}
