"""MYASO Graphics3 nonproduction genuine Chrome/Firefox W3C visual device test.
Runs against a separately started loopback Vite URL; never sends game input."""
import json
import os
import time
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions

URL=os.environ.get('MYASO_G3_QA_URL','http://127.0.0.1:4174/')
OUT=Path(__file__).parent.parent/'.artifacts'/'graphics-device-real-gpu'
OUT.mkdir(parents=True,exist_ok=True)

PROBE="""const d=document.documentElement.dataset;
const device=window.__MYASO_PLAYCANVAS__?.device;
const gl=device?.gl;
let debug=null;
if(gl){try{const e=gl.getExtension('WEBGL_debug_renderer_info');
 debug={vendor:e?gl.getParameter(e.UNMASKED_VENDOR_WEBGL):null,
 renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null,
 version:gl.getParameter(gl.VERSION), contextIsWebGL2:gl instanceof WebGL2RenderingContext};
}catch(err){debug={error:String(err)}}}
return {booted:d.engineBooted,renderer:d.renderer,deviceType:d.graphicsDeviceType,
 red:d.redLionAssetLoaded,smith:d.blacksmithAssetLoaded,
 look:d.greyhavenLook,smoke:d.greyhavenDuskSmoke,wisps:d.greyhavenSmokeWisps,
 hardware:debug,fatal:document.querySelector('#fatal')?.textContent,
 scene:window.__MYASO_PLAYCANVAS__?.scene?.sceneKind||null};"""

RAF="""const done=arguments[arguments.length-1],points=[],limit=120;
function loop(t){points.push(t);if(points.length<limit)requestAnimationFrame(loop);
else{const values=points.slice(1).map((x,i)=>x-points[i]).sort((a,b)=>a-b);
 const pct=f=>values[Math.floor((values.length-1)*f)];
 done({frames:values.length,p50Ms:pct(.5),p95Ms:pct(.95),maxMs:values.at(-1)})}}
requestAnimationFrame(loop);"""

def run(browser):
    if browser=='firefox':
        opts=FirefoxOptions()
        opts.binary_location=r'C:\Program Files\Mozilla Firefox\firefox.exe'
        driver=webdriver.Firefox(options=opts)
    else:
        opts=ChromeOptions()
        opts.binary_location=r'C:\Program Files\Google\Chrome\Application\chrome.exe'
        opts.add_argument('--use-gl=desktop')
        driver=webdriver.Chrome(options=opts)
    driver.set_window_size(1280,720)
    outcomes=[]
    try:
        for view,look in [('red-lion','day'),('red-lion','dusk'),('blacksmith','day'),('blacksmith','dusk')]:
            driver.get(URL+f'?view={view}&greyhavenTime={look}')
            state=None
            for _ in range(100):
                state=driver.execute_script(PROBE)
                if state['booted'] in ('true','false'):break
                time.sleep(.3)
            name=f'{browser}-{view}-{look}'
            (OUT/(name+'.json')).write_text(json.dumps(state,indent=2),encoding='utf-8')
            driver.save_screenshot(str(OUT/(name+'.png')))
            print('GRAPHICS3_W3C_PROBE',name,json.dumps(state),flush=True)
            assert state['booted']=='true',f'{name} cannot boot: {state}'
            assert state['renderer']=='WebGL2' and state['deviceType']=='webgl2',f'{name} not genuine WebGL2'
            assert state['hardware']['contextIsWebGL2'],f'{name} GL context failed'
            assert state['red']=='true' and state['smith']=='true',f'{name} original architecture failed'
            assert state['look']==look and state['smoke']==('true' if look=='dusk' else 'false')
            assert int(state['wisps'])==(12 if look=='dusk' else 0)
            metrics=driver.execute_async_script(RAF)
            (OUT/(name+'-timing.json')).write_text(json.dumps(metrics,indent=2),encoding='utf-8')
            print('GRAPHICS3_W3C_PERF',name,json.dumps(metrics),flush=True)
            outcomes.append(dict(name=name,state=state,perf=metrics))
        return outcomes
    finally:
        driver.quit()

results={}
for browser in ('chrome','firefox'):
    try:results[browser]=run(browser)
    except Exception as e:
        (OUT/(browser+'-FIRST-RED.txt')).write_text(str(e),encoding='utf-8')
        print('GRAPHICS3_NATIVE_FIRST_RED',browser,repr(e),flush=True)
        raise
if os.environ.get('MYASO_G3_REQUIRE_GPU')=='1':
    candidates=[o['state']['hardware']['renderer'] or '' for rows in results.values() for o in rows]
    assert any(('NVIDIA' in s or 'AMD' in s or 'Intel' in s) and
        not any(x in s for x in ('SwiftShader','llvmpipe','Basic Render','WARP')) for s in candidates), 'No hardware-accelerated GPU witness'
print('GRAPHICS3_CHROME_FIREFOX_GENUINE_WEBGL2_VISUAL_PASS',json.dumps({
    b:[o['name'] for o in a] for b,a in results.items()}),flush=True)
