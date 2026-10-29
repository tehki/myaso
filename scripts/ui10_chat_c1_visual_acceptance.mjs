// Native real Chrome/Firefox HUD review. UI-only visual fixture — NOT C1 server acceptance.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer as httpServer } from "node:http";
import { createServer as tcpServer } from "node:net";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = process.cwd();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const randomPort = () => new Promise((resolvePort, reject) => {
  const s = tcpServer();
  s.on("error", reject);
  s.listen(0, "127.0.0.1", () => {
    const port = s.address().port;
    s.close(() => resolvePort(port));
  });
});
const files = new Map([
  ["/tests/fixtures/chat-c1-hud-visual.html",
    ["tests/fixtures/chat-c1-hud-visual.html", "text/html; charset=utf-8"]],
  ["/src/browser/local-chat.mjs",
    ["src/browser/local-chat.mjs", "text/javascript; charset=utf-8"]],
  ["/tests/fixtures/local-chat.css",
    ["web/local-chat.css", "text/css; charset=utf-8"]],
]);
function makeServer() {
  return httpServer(async (request, response) => {
    const entry = files.get(new URL(request.url, "http://localhost").pathname);
    if (!entry) { response.writeHead(404); response.end(); return; }
    try {
      const body = await readFile(resolve(root, entry[0]));
      response.writeHead(200, { "Content-Type": entry[1], "Cache-Control": "no-store" });
      response.end(body);
    } catch { response.writeHead(500); response.end(); }
  });
}
async function poll(label, action, ms = 12000) {
  const deadline = Date.now() + ms;
  let last = null;
  while (Date.now() < deadline) {
    try { last = await action(); if (last?.ok) return last; }
    catch (error) { last = { error: String(error) }; }
    await delay(160);
  }
  throw Error("UI10 native " + label + " timeout: " + JSON.stringify(last));
}
async function wd(port, method, path, body) {
  const response = await fetch("http://127.0.0.1:" + port + path, {
    method, headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || data.value?.error) {
    throw Error("WebDriver " + method + " " + path + ": " + JSON.stringify(data).slice(0, 1400));
  }
  return data.value;
}
async function exercise(browser, viewWidth, previewUrl, screenshotDir) {
  const driverPort = await randomPort();
  const binary = browser === "chrome" ? "chromedriver" : (process.env.C1_GECKODRIVER || "geckodriver");
  const driverProcess = spawn(binary, ["--port=" + driverPort], { stdio:"ignore" });
  let sid;
  try {
    await poll(browser + " driver", async () => {
      const res = await fetch("http://127.0.0.1:" + driverPort + "/status").catch(() => null);
      return { ok: !!res?.ok };
    }, 10000);
    const options = browser === "chrome"
      ? { browserName:"chrome", "goog:chromeOptions":{
          args:["--headless=new","--no-sandbox","--disable-dev-shm-usage",
            "--window-size=" + viewWidth + ",540"],
        } }
      : { browserName:"firefox", "moz:firefoxOptions":{
          args:["-headless","--width=" + viewWidth,"--height=540"],
        } };
    sid = (await wd(driverPort, "POST", "/session",
      { capabilities:{ alwaysMatch:options } })).sessionId;
    const prefix = "/session/" + sid;
    const js = (code, args = []) => wd(driverPort, "POST", prefix + "/execute/sync",
      { script:code, args });
    const key = value => wd(driverPort, "POST", prefix + "/actions",
      { actions:[{ type:"key", id:"keyboard",
        actions:[{type:"keyDown",value},{type:"keyUp",value}] }] });
    await wd(driverPort, "POST", prefix + "/window/rect", { width:viewWidth, height:540 });
    await wd(driverPort, "POST", prefix + "/url", { url:previewUrl });
    await poll(browser + " fixture module", async () => ({
      ok: await js("return window.__ui10Ready === true;"),
    }), 12000);
    await js("document.querySelector('#arena').focus();");
    await key("\uE007"); // Actual native Enter, not synthetic DOM dispatch.
    const opened = await js(
      "const c=window.__ui10Chat;return {open:c.root.dataset.open,focused:document.activeElement===c.input};");
    assert.deepEqual(opened, {open:"true",focused:true},
      browser + " native Enter must focus the real chat composer");
    for (const char of ["w","a","s","d"," ","e"]) await key(char);
    const typed = await js(
      "return {text:window.__ui10Chat.input.value,focused:document.activeElement===window.__ui10Chat.input,leaks:window.__ui10CombatLeak};");
    assert.equal(typed.text,"wasd e");
    assert.equal(typed.focused,true);
    assert.deepEqual(typed.leaks,{keydown:0,pointerdown:0,wheel:0});
    const geometry = await js(
      "const a=document.querySelector('.arena-stage').getBoundingClientRect();"+
      "const x=document.querySelector('.local-chat').getBoundingClientRect();"+
      "const input=document.querySelector('.local-chat-input').getBoundingClientRect();"+
      "return {stage:{x:a.x,y:a.y,right:a.right,bottom:a.bottom},panel:{x:x.x,y:x.y,right:x.right,bottom:x.bottom},input:{x:input.x,y:input.y,right:input.right,bottom:input.bottom},viewport:innerWidth};"
    );
    assert(geometry.panel.x >= geometry.stage.x - 1
      && geometry.panel.right <= geometry.stage.right + 1,
      browser + " chat panel clips horizontally at " + viewWidth);
    assert(geometry.panel.y >= geometry.stage.y - 1
      && geometry.panel.bottom <= geometry.stage.bottom + 1,
      browser + " chat panel escapes arena at " + viewWidth);
    assert(geometry.input.bottom <= geometry.stage.bottom + 1,
      browser + " composer input falls outside arena at " + viewWidth);
    const picture = await wd(driverPort, "GET", prefix + "/screenshot");
    const bytes = Buffer.from(picture, "base64");
    assert(bytes.length > 3000 && bytes.subarray(1,4).toString() === "PNG");
    const output = join(screenshotDir,"ui10-chat-c1-" + browser + "-" + viewWidth + ".png");
    await writeFile(output, bytes);
    const clickX = Math.floor(Math.max(60, Math.min(geometry.viewport - 40,geometry.viewport * .75)));
    const clickY = Math.floor(Math.min(geometry.stage.bottom - 15, Math.max(60, geometry.stage.bottom * .32)));
    await wd(driverPort,"POST",prefix + "/actions",{actions:[{
      type:"pointer",id:"mouse",parameters:{pointerType:"mouse"},
      actions:[{type:"pointerMove",origin:"viewport",x:clickX,y:clickY,duration:30},
        {type:"pointerDown",button:0},{type:"pointerUp",button:0}],
    }]});
    const afterClick = await js(
      "const c=window.__ui10Chat;return {focused:document.activeElement===c.input,leaks:window.__ui10CombatLeak};");
    assert.equal(afterClick.focused,true,"composer must retain focus after arena physical click");
    assert.equal(afterClick.leaks.pointerdown,0,"Combat must not see a physical chat-time LMB");
    await wd(driverPort,"POST",prefix + "/actions",{actions:[{
      type:"wheel",id:"wheel",
      actions:[{type:"scroll",x:clickX,y:clickY,deltaX:0,deltaY:120,duration:30}],
    }]});
    const afterWheel = await js("return window.__ui10CombatLeak.wheel;");
    assert.equal(afterWheel,0,"Combat must not see physical chat-time wheel");
    await key("\uE00C"); // Real Escape returns control to arena.
    const closed = await js(
      "const c=window.__ui10Chat;return {open:c.root.dataset.open,focused:document.activeElement?.id==='arena'};");
    assert.deepEqual(closed,{open:"false",focused:true});
    await key("w");
    assert.equal(await js("return window.__ui10CombatLeak.keydown;"),1,
      "actual gameplay keys resume after Escape");
    console.log("UI10_NATIVE_LAYOUT_AND_COMBAT_ISOLATION_PASS",
      JSON.stringify({browser,viewWidth,geometry,screenshot:output}));
  } finally {
    if (sid) await wd(driverPort,"DELETE","/session/"+sid).catch(()=>{});
    driverProcess.kill();
  }
}

const app = makeServer();
const screenshots = join(root,"artifacts","ui10-chat-c1");
await mkdir(screenshots,{recursive:true});
await new Promise(resolve => app.listen(0,"127.0.0.1",resolve));
const url = "http://127.0.0.1:" + app.address().port
  + "/tests/fixtures/chat-c1-hud-visual.html";
try {
  for (const browser of ["chrome","firefox"]) {
    for (const width of [960,420]) await exercise(browser,width,url,screenshots);
  }
  console.log("UI10_VISUAL_FIXTURE_PASS chrome/firefox 960 and narrow, not authenticated Chat C1 routing");
} finally { await new Promise(resolve => app.close(resolve)); }
