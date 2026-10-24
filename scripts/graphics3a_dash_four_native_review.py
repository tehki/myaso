"""Graphics 3A source-authentic original Silver Dash four-player review.

Read-only source-Canvas instrumentation pairs per-frame original Silver WebP
and its shadow. Real TLS-pinned WebTransport game, trusted native jump and
movement. Does not claim server physics, human operators or production GO.
"""
import json,os,re,select,shutil,socket,subprocess,time,urllib.parse,urllib.request
from graphics3a_dash_native_keys import trusted_double_tap
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
server=None;http=None;driver=None;sessions=[];debuggers={};drv_port=port()
try:
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
 driver=subprocess.Popen([shutil.which("chromedriver") or "chromedriver",f"--port={drv_port}"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 for _ in range(30):
  try:urllib.request.urlopen(f"http://127.0.0.1:{drv_port}/status",timeout=2);break
  except Exception:time.sleep(.1)
 page=f"http://127.0.0.1:{siteport}/web/?server={urllib.parse.quote(url,safe='')}&cert={cert}&knights=1&knightArt=relit&knightDashArt=traction&chatC1Preview=1&netstats=1&scenario=uijumpbuffer"
 for i in range(4):
  props={"capabilities":{"alwaysMatch":{"browserName":"chrome","goog:chromeOptions":{"binary":(shutil.which("chromium") or shutil.which("google-chrome") or shutil.which("google-chrome-stable") or "/usr/bin/chromium"),"args":["--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-background-networking","--remote-allow-origins=http://localhost","--window-size=1200,850"]}}}}
  established=request("POST","/session",props,drv_port)
  session=established["sessionId"]
  debugger=established["capabilities"]["goog:chromeOptions"]["debuggerAddress"]
  debuggers[session]=debugger
  sessions.append(session)
  request("POST",f"/session/{session}/url",{"url":page},drv_port)
  for _ in range(90):
   val=script(session,"const n=document.querySelector('[data-local-chat]');return {ok:n?.dataset.connected==='true',event:document.querySelector('#event-text')?.textContent};")
   if val.get("ok"):break
   time.sleep(.12)
  assert val.get("ok"),val
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
 for seat in sessions:
  ready=script(seat,"return {dashArt:new URLSearchParams(location.search).get('knightDashArt'),knights:new URLSearchParams(location.search).get('knights'), connected:document.querySelector('[data-local-chat]')?.dataset.connected==='true'};")
  assert ready["dashArt"]=="traction" and ready["knights"]=="1" and ready["connected"],ready
 # Inspect ALL original authored facing rows and EVERY source frame inside
 # the real browser WebP decoder, without altering live fighter world state.
 source_audit=(ROOT/"scripts"/"graphics3a_dash_all_facing_source_audit.js").read_text()
 eight=request("POST",f"/session/{sessions[0]}/execute/async",
  {"script":source_audit,"args":[]},drv_port)
 assert eight and eight.get("ok") and len(eight["facingRows"])==8,eight
 assert all(row["frames"]==8 and row["distinctFrames"]>=7 and row["minimumOpaquePixels"]>100
            for row in eight["facingRows"]),eight
 print("AUTHENTIC_DASH_SOURCE_ALL_EIGHT_FACINGS",json.dumps(eight,separators=(",",":")),flush=True)
 # Source-authentic trusted double-tap of same directional key within 240ms.
 seat=sessions[1]
 focus=script(seat,"document.querySelector('#arena').focus();return document.activeElement.id;")
 assert focus=="arena",focus
 script(seat,"window.__dashKeys=[]; for(const type of ['keydown','keyup'])document.querySelector('#arena').addEventListener(type,e=>window.__dashKeys.push({type:e.type,code:e.code,key:e.key,repeat:e.repeat,trusted:e.isTrusted,ms:Math.round(performance.now())}),true);")
 # Direct trusted Chrome DevTools key edges keep the 240ms double-tap
 # intact on a constrained browser host; no DOM-synthesized keyboard events.
 trusted_double_tap(debuggers[seat])
 time.sleep(.95)
 # First party scenario instrumentation is read-only; true server action ids.
 report=script(seat, """const a=window.__MYASO_ACCEPTANCE_STATE__;
return a ? {playerNetId:a.playerNetId,serverTick:a.serverTick,
  actions:a.ownActionTransitions?.map(v=>({action:v.action,tick:v.serverTick}))} : null;""")
 assert report and report["playerNetId"]>0,report
 actions=report.get("actions") or []
 print("DASH_INPUT_TRACE",json.dumps(script(seat,"return {keys:window.__dashKeys,focus:document.activeElement.id,acceptance:window.__MYASO_ACCEPTANCE_STATE__?.inputSubmissions?.slice(-12)};")),flush=True)
 print("DASH_AUTH_TRANSITIONS",json.dumps(report),flush=True)
 trusted_keys=script(seat,"return window.__dashKeys;")
 assert [e["type"] for e in trusted_keys]==["keydown","keyup","keydown","keyup"],trusted_keys
 assert all(e["trusted"] and e["code"]=="KeyW" and not e["repeat"] for e in trusted_keys),trusted_keys
 second_down_lead=trusted_keys[2]["ms"]-trusted_keys[0]["ms"]
 assert 0<=second_down_lead<=240,("Authentic production Dash double-tap deadline",trusted_keys)
 assert trusted_keys[3]["ms"]-trusted_keys[2]["ms"]>=50,("Second key hold too short for real 30Hz send",trusted_keys)
 print("AUTHENTIC_DASH_TRUSTED_INPUT",json.dumps({"downToDownMs":second_down_lead,"secondHoldMs":trusted_keys[3]["ms"]-trusted_keys[2]["ms"]}),flush=True)
 dash_i=next((i for i,x in enumerate(actions) if x["action"]==30),None)
 assert dash_i is not None, "Real trusted double tap never became authoritative Dash(30)"
 idle_i=next((i for i in range(dash_i+1,len(actions)) if actions[i]["action"]==0),None)
 assert idle_i is not None, "Authoritative Dash did not return to Idle"
 dash_tick=actions[dash_i]["tick"]
 finish_tick=actions[idle_i]["tick"]
 assert 1<=finish_tick-dash_tick<=20,(dash_tick,finish_tick)
 assert report["serverTick"]>finish_tick
 print("AUTHENTIC_DASH_140_SERVER_TICKS",json.dumps({
 "playerNetId":report["playerNetId"],"dashTick":dash_tick,"idleTick":finish_tick,
 "durationTicks":finish_tick-dash_tick,"observedAfterIdleTick":report["serverTick"]}),flush=True)
 for i,seat in enumerate(sessions):
  measure=script(seat,"return window.__G3A_SHADOW_AUDIT__?.()??null;")
  assert measure and measure["total"]>=20 and measure["unpaired"]==0,measure
  clips=measure["clips"]
  assert "silver_idle_relit.webp" in clips,clips
  assert "silver_dash_traction_p0.webp" in clips, ("real authored Dash WebP missing",i+1,clips)
  assert clips["silver_dash_traction_p0.webp"]["frames"]>=2, ("no temporal dash animation",i+1,clips)
  assert abs(clips["silver_dash_traction_p0.webp"]["mean"])<15, ("Dash sprite floats above its floor shadow",i+1,clips)
  print("AUTHENTIC_DASH_ATLAS_CANVAS",i+1,json.dumps(clips["silver_dash_traction_p0.webp"]),flush=True)
 print("G3A_DASH_REAL_FOUR_PLAYER_SOURCE_ACCEPTANCE_COMPLETE",flush=True)
finally:
 for s in sessions:
  try:request("DELETE",f"/session/{s}",wdport=drv_port)
  except Exception:pass
 for proc in (driver,http,server):
  if proc and proc.poll() is None:
   proc.terminate()
   try:proc.wait(timeout=3)
   except Exception:proc.kill()
