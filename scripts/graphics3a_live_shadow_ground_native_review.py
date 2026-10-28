"""Graphics 3A source-authentic native Rust four-player shadow acceptance.

Read-only source-Canvas instrumentation pairs per-frame original Silver WebP
and its shadow. Real TLS-pinned WebTransport game, trusted native jump and
movement. Does not claim server physics, human operators or production GO.
"""
import json,os,re,select,shutil,socket,subprocess,tempfile,time,urllib.parse,urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BIN=ROOT/"server"/"target"/"debug"/"myaso-server"
assert BIN.is_file(), f"Compile genuine Rust server before this native flight: {BIN}"

os.environ.pop("DBUS_SESSION_BUS_ADDRESS",None)
def port():
 s=socket.socket();s.bind(("127.0.0.1",0));n=s.getsockname()[1];s.close();return n
def request(method,path,body=None,wdport=9515):
 data=None if body is None else json.dumps(body).encode()
 req=urllib.request.Request(f"http://127.0.0.1:{wdport}"+path,data=data,method=method,headers={"Content-Type":"application/json"})
 with urllib.request.urlopen(req,timeout=32) as r: parsed=json.load(r)
 if isinstance(parsed.get("value"),dict) and parsed["value"].get("error"):
  raise RuntimeError(parsed["value"])
 return parsed["value"]
def script(session,code,args=[]):return request("POST",f"/session/{session}/execute/sync",{"script":code,"args":args},drv_port)
def action(session,actions):return request("POST",f"/session/{session}/actions",{"actions":actions},drv_port)
def keyact(key,down):
 return [{"type":"key","id":"movement","actions":[{"type":"keyDown" if down else "keyUp","value":key}]}]
server=None;http=None;driver=None;sessions=[];drv_port=port()
# Preserve actual launch evidence, including failures before a session ID exists.
# No retries or relaxed browser/gameplay deadlines. Only this flight's processes
# are owned/terminated here; process diagnostics contain no command arguments.
diagnostics=Path(os.environ.get("MYASO_NATIVE_DIAGNOSTICS_DIR") or tempfile.mkdtemp(prefix="myaso-g3a-native-"))
diagnostics.mkdir(parents=True,exist_ok=True)
driver_output=(diagnostics/"driver-output.log").open("w")
requested_browser=os.environ.get("MYASO_NATIVE_CHROME_BINARY")
# CI validates Google Chrome and its matching driver. Do not silently launch
# the separately installed Chromium build instead. Local Linux may still use
# its distro Chromium when no particular binary was requested.
browser_binary=(shutil.which(requested_browser) if requested_browser else
 (shutil.which("chromium") or shutil.which("google-chrome") or shutil.which("google-chrome-stable")))
assert browser_binary,"Requested native Chrome executable is unavailable; no browser substitution allowed"
driver_binary=shutil.which("chromedriver") or "chromedriver"
def capture_startup_state(stage):
 data={"stage":stage,"sessionsCreated":len(sessions),"driverExit":driver.poll() if driver else None,
       "browserBinary":browser_binary,"driverBinary":driver_binary,"load":os.getloadavg()}
 for name,args in (("browserVersion",[browser_binary,"--version"]),("driverVersion",[driver_binary,"--version"]),
                   ("processes",["ps","-eo","pid,ppid,stat,pcpu,pmem,rss,comm"])):
  try:data[name]=subprocess.run(args,capture_output=True,text=True,timeout=3).stdout[-16000:]
  except Exception as error:data[name]=type(error).__name__
 try:data["memory"]=Path("/proc/meminfo").read_text()[:4000]
 except OSError:pass
 (diagnostics/(stage+".json")).write_text(json.dumps(data,indent=2))
 print("G3A_NATIVE_STARTUP_STATE",json.dumps({k:v for k,v in data.items() if k not in ("processes","memory")}),flush=True)
try:
 capture_startup_state("before-launch")
 server=subprocess.Popen([str(BIN)],env={**os.environ,"MYASO_BIND":"127.0.0.1:0","MYASO_CHAT_RADIUS":"160","MYASO_CHAT_C1_ENABLED":"1"},stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
 url=None;cert=None
 os.set_blocking(server.stdout.fileno(),False)
 captured=""
 until=time.monotonic()+22
 while time.monotonic()<until and (not url or not cert):
  try:chunk=os.read(server.stdout.fileno(),65536)
  except BlockingIOError:chunk=b""
  if chunk:
   captured+=chunk.decode("utf-8","replace")
   print("RUST_BUFFER",captured[-600:],flush=True)
   m=re.search(r"listening on (https://\S+)",captured)
   if m:url=m.group(1)
   m=re.search(r"development certificate SHA-256:\s*([a-fA-F0-9:]+)",captured)
   if m:cert=m.group(1).replace(":","")
  time.sleep(.12)
 assert url and cert and len(cert)==64,(url,cert,server.poll())
 print("REAL_RUST_SERVER",url,cert[:12],flush=True)
 siteport=port()
 http=subprocess.Popen(["python3","-m","http.server",str(siteport),"--bind","127.0.0.1","--directory",str(ROOT)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 driver=subprocess.Popen([driver_binary,f"--port={drv_port}","--verbose",f"--log-path={diagnostics/'chromedriver.log'}"],
  env={**os.environ,"CHROME_LOG_FILE":str(diagnostics/"chrome.log")},stdout=driver_output,stderr=driver_output)
 driver_ready=False
 for _ in range(30):
  try:
   with urllib.request.urlopen(f"http://127.0.0.1:{drv_port}/status",timeout=2) as response:
    driver_ready=json.load(response).get("value",{}).get("ready") is True
   if driver_ready:break
  except Exception:time.sleep(.1)
 assert driver_ready,"ChromeDriver never reported readiness; inspect preserved launch diagnostics"
 page=f"http://127.0.0.1:{siteport}/web/?server={urllib.parse.quote(url,safe='')}&cert={cert}&knights=1&knightArt=relit&chatC1Preview=1&netstats=1&scenario=uijumpbuffer"
 for i in range(4):
  props={"capabilities":{"alwaysMatch":{"browserName":"chrome","goog:chromeOptions":{"binary":browser_binary,"args":["--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-background-networking","--window-size=1200,850","--enable-logging"]}}}}
  session_started=time.monotonic()
  session=request("POST","/session",props,drv_port)["sessionId"]
  sessions.append(session)
  print("G3A_NATIVE_SESSION_CREATED",json.dumps({"seat":i+1,"elapsedMs":round((time.monotonic()-session_started)*1000)}),flush=True)
  request("POST",f"/session/{session}/url",{"url":page},drv_port)
  for _ in range(90):
   val=script(session,"const t=document.querySelector('#event-text')?.textContent||'';const m=t.match(/Online - player #([0-9]+) - server tick ([0-9]+)/);return {ok:!!m,playerId:m?Number(m[1]):null,serverTick:m?Number(m[2]):null,event:t};")
   if val.get("ok"):break
   time.sleep(.12)
  assert val.get("ok"),val
  assert val.get("playerId")==i+1, "Native World actor ID must match the genuine WebTransport seat"
  assert val.get("serverTick",0)>0, "Original authoritative server must be ticking"
  print("AUTHENTIC_PLAYER_JOINED",i+1,flush=True)
 inspect=r"""
if(!window.__G3A_SHADOW_AUDIT__) {
 const p=CanvasRenderingContext2D.prototype;
 const originalEllipse=p.ellipse, originalDraw=p.drawImage;
 const rgba=document.createElement("canvas");rgba.width=160;rgba.height=160;
 const probe=rgba.getContext("2d",{willReadFrequently:true});
 const memo=new Map();
 const q={total:0,unpaired:0,byClip:{},samples:[],maxSamples:100};
 let pending=null;
 p.ellipse=function(x,y,rx,ry,...rest){
  if(this.canvas?.id==='arena' && Math.abs(rx-24)<.001 && Math.abs(ry-9.6)<.001)
   pending={x,y,t:this.getTransform()};
  return originalEllipse.apply(this,arguments);
 };
 p.drawImage=function(image,...args){
  const output=originalDraw.apply(this,arguments);
  const src=image?.currentSrc||image?.src||'';
  if(this.canvas?.id!=='arena'||!src.includes('/assets/knights/')||!src.includes('silver_')||!src.includes('.webp'))return output;
  if(!pending||args.length!==8){q.unpaired++;return output;}
  const shadow=pending;pending=null;
  const [sx,sy,sw,sh,dx,dy,dw,dh]=args;
  let bottom=memo.get(src+'|'+sx+'|'+sy);
  if(bottom===undefined){
   probe.clearRect(0,0,160,160);
   originalDraw.call(probe,image,sx,sy,sw,sh,0,0,160,160);
   const bytes=probe.getImageData(0,0,160,160).data;
   bottom=0;
   outer:for(let yy=159;yy>=0;yy--)
    for(let xx=0;xx<160;xx++)
     if(bytes[(yy*160+xx)*4+3]>=64){bottom=yy+1;break outer;}
   memo.set(src+'|'+sx+'|'+sy,bottom);
  }
  const foot=dy+dh*bottom/160, transform=this.getTransform();
  const screenFootY=transform.b*(dx+dw/2)+transform.d*foot+transform.f;
  const groundCenterY=shadow.t.b*shadow.x+shadow.t.d*shadow.y+shadow.t.f;
  const cssDelta=screenFootY-groundCenterY,localDelta=foot-shadow.y;
  const clip=src.split('/').at(-1);
  const a=q.byClip[clip]??{n:0,min:1e9,max:-1e9,sum:0,foot0:[],distinctFrames:new Set()};
  a.n++;a.min=Math.min(a.min,cssDelta);a.max=Math.max(a.max,cssDelta);a.sum+=cssDelta;
  if(a.foot0.length<8)a.foot0.push(Math.round(cssDelta*10)/10);
  a.distinctFrames.add(sx+':'+sy);
  q.byClip[clip]=a;
  q.total++;
  if(q.samples.length<q.maxSamples)q.samples.push({clip,sourceFrame:[sx,sy],bottom,localDelta:Math.round(localDelta*10)/10,cssDelta:Math.round(cssDelta*10)/10});
  return output;
 };
 window.__G3A_SHADOW_AUDIT__=()=>({total:q.total,unpaired:q.unpaired,clips:Object.fromEntries(Object.entries(q.byClip).map(([k,v])=>[k,{n:v.n,min:+v.min.toFixed(2),max:+v.max.toFixed(2),mean:+(v.sum/v.n).toFixed(2),frames:v.distinctFrames.size,samples:v.foot0}])),samples:q.samples.slice(0,12)});
}
"""
 for s in sessions:script(s,inspect)
 time.sleep(1.5)
 focus=script(sessions[0],"document.querySelector('#arena').focus();return {focused:document.activeElement.id,art:new URLSearchParams(location.search).get('knightArt')};")
 assert focus["focused"]=="arena" and focus["art"]=="relit",focus
 action(sessions[0],keyact("w",True));time.sleep(1.35);action(sessions[0],keyact("w",False))
 time.sleep(1)
 script(sessions[1],"document.querySelector('#arena').focus();return document.activeElement.id;")
 action(sessions[1],keyact(" ",True));time.sleep(.24);action(sessions[1],keyact(" ",False))
 time.sleep(1.2)
 # Existing first-party acceptance instrumentation records authentic replicated
 # server ticks/actions, not predicted local pose nor synthetic action injection.
 # It is opt-in via scenario=uijumpbuffer and has no authority over gameplay.
 # COMBAT_ACTION.jump=15, idle=0 in src/browser/combat-readability.mjs.
 landing=script(sessions[1], """const a=window.__MYASO_ACCEPTANCE_STATE__;
return a ? {playerNetId:a.playerNetId,serverTick:a.serverTick,
 actions:a.ownActionTransitions?.map(v=>({action:v.action,tick:v.serverTick}))} : null;""")
 assert landing and landing["playerNetId"]>0, "No authenticated own fighter acceptance"
 transitions=landing.get("actions") or []
 jump_index=next((i for i,entry in enumerate(transitions) if entry["action"]==15),None)
 assert jump_index is not None, "Real native Space never admitted authoritative Jump (15)"
 landing_index=next((i for i in range(jump_index+1,len(transitions))
                     if transitions[i]["action"]==0),None)
 assert landing_index is not None, "Authoritative Jump never returned to Idle (0)"
 jump_tick=transitions[jump_index]["tick"]
 landing_tick=transitions[landing_index]["tick"]
 assert 1<=landing_tick-jump_tick<=120, "Invalid authoritative jump/landing tick transition"
 assert landing["serverTick"]>landing_tick, "No authoritative ticks observed after landing"
 print("AUTHENTIC_JUMP_LANDING_SERVER_TICKS",json.dumps({
     "playerNetId":landing["playerNetId"],"jumpTick":jump_tick,
     "landingTick":landing_tick,"durationTicks":landing_tick-jump_tick,
     "observedAfterLandingTick":landing["serverTick"]}),flush=True)
 seen_jump=False
 for i,s in enumerate(sessions):
  measure=script(s,"return window.__G3A_SHADOW_AUDIT__?.()??null;")
  print("AUTHENTIC_ARENA_SILVER_SHADOW",i+1,json.dumps(measure,separators=(",",":"))[:8000],flush=True)
  assert measure["total"]>=20, "No authentic Silver frames were observed"
  assert measure["unpaired"]==0, "Source image and preceding original shadow were not paired"
  assert "silver_idle_relit.webp" in measure["clips"]

  clips=measure["clips"]
  assert abs(clips["silver_idle_relit.webp"]["mean"])<10
  if "silver_jump_relit.webp" in clips:
   seen_jump=True
   assert clips["silver_jump_relit.webp"]["max"]<-4, "Ground-shadow must remain below lifted true jump sprite"
 assert seen_jump, "Real server never admitted a jump during native Space choreography"
 print("G3A_REAL_FOUR_PLAYER_SHADOW_SOURCE_AUDIT_COMPLETE",flush=True)
except BaseException:
 capture_startup_state("failure")
 for name in ("chromedriver.log","driver-output.log","chrome.log"):
  try:
   with (diagnostics/name).open("rb") as log:
    log.seek(max(0,os.fstat(log.fileno()).st_size-12000))
    print("G3A_NATIVE_FAILURE_LOG",name,log.read().decode("utf-8","replace"),flush=True)
  except OSError:pass
 raise
finally:
 for s in sessions:
  try:request("DELETE",f"/session/{s}",wdport=drv_port)
  except Exception:pass
 for proc in (driver,http,server):
  if proc and proc.poll() is None:
   proc.terminate()
   try:proc.wait(timeout=3)
   except Exception:proc.kill()
 driver_output.close()
 print("G3A_NATIVE_DIAGNOSTICS",str(diagnostics),flush=True)
