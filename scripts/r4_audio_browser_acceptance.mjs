// R4: Native Chrome/Firefox media and Web Audio proof, with real W3C click activation.
// This never supplies or mutates multiplayer input. It runs before long PvP CI flights.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const names = process.env.MYASO_R4_BROWSER ? [process.env.MYASO_R4_BROWSER] : ["chrome", "firefox"];
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://127.0.0.1").pathname;
    const absolute = path.resolve(root, "." + decodeURIComponent(pathname));
    if (!absolute.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (!(await stat(absolute)).isFile()) { res.writeHead(404).end(); return; }
    const type = absolute.endsWith(".ogg") ? "audio/ogg"
      : absolute.endsWith(".mjs") || absolute.endsWith(".js") ? "text/javascript; charset=utf-8"
      : absolute.endsWith(".html") ? "text/html; charset=utf-8"
      : absolute.endsWith(".css") ? "text/css; charset=utf-8" : "application/octet-stream";
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    res.end(await readFile(absolute));
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const site = "http://127.0.0.1:" + server.address().port;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function command(base, method, endpoint, payload) {
  const response = await fetch(base + endpoint, {
    method, headers: { "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const json = await response.json();
  if (!response.ok || json.value?.error) {
    throw new Error(method + " " + endpoint + " (" + response.status + "): " + JSON.stringify(json.value).slice(0, 800));
  }
  return json.value;
}

async function run(browser, port) {
  const firefox = browser === "firefox";
  const binary = firefox ? (process.env.GECKOWEBDRIVER ? path.join(process.env.GECKOWEBDRIVER, "geckodriver") : "geckodriver")
    : (process.env.CHROMEWEBDRIVER ? path.join(process.env.CHROMEWEBDRIVER, "chromedriver") : "chromedriver");
  const args = firefox ? ["--host", "127.0.0.1", "--port", String(port)] : ["--port=" + port];
  const child = spawn(binary, args, { stdio: "ignore" });
  const base = "http://127.0.0.1:" + port;
  let session = null;
  try {
    let ready = false;
    for (let n = 0; n < 100; n++) {
      if (child.exitCode !== null) throw new Error(browser + " driver exited " + child.exitCode);
      try { await command(base, "GET", "/status"); ready = true; break; } catch { await delay(100); }
    }
    assert.ok(ready, browser + " driver did not start");
    const capabilities = firefox
      ? { browserName: "firefox", "moz:firefoxOptions": { args: ["-headless"] } }
      : { browserName: "chrome", "goog:chromeOptions": {
        args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1280,720"],
      } };
    session = (await command(base, "POST", "/session", { capabilities: { alwaysMatch: capabilities } })).sessionId;
    const prefix = "/session/" + session;
    const script = (code, args = []) => command(base, "POST", prefix + "/execute/sync", { script: code, args });
    const element = async (selector) => {
      const el = await command(base, "POST", prefix + "/element", { using: "css selector", value: selector });
      return el["element-6066-11e4-a52e-4f735466cecf"] || el.ELEMENT;
    };
    const click = async (selector) => command(base, "POST", prefix + "/element/" + await element(selector) + "/click", {});
    await command(base, "POST", prefix + "/url", { url: site + "/web/index.html" });
    assert.equal(await script('return document.querySelector("#music-toggle").getAttribute("aria-pressed")'), "false");
    // A fresh test object shares the real application module and original local assets,
    // while exposing its AudioContext and media element for end-to-end assertions.
    await script(`
      return import("/src/browser/game-audio.mjs").then(({createGameAudio}) => {
        window.__r4SourceStarts = 0;
        class TrackedContext extends (window.AudioContext || window.webkitAudioContext) {
          constructor(...args) { super(...args); window.__r4Context = this; }
          createBufferSource() {
            const source = super.createBufferSource();
            const start = source.start.bind(source);
            source.start = (...args) => { window.__r4SourceStarts++; return start(...args); };
            return source;
          }
        }
        class TrackedMusic extends Audio {
          constructor(url) { super(url); window.__r4Music = this; }
        }
        window.__r4Audio = createGameAudio({
          AudioContextImpl: TrackedContext, AudioElementImpl: TrackedMusic,
          storage: null,
        });
        const button = document.createElement("button");
        button.id = "r4-audio-probe";
        button.textContent = "Test sound";
        button.addEventListener("click", () => {
          window.__r4Unlock = window.__r4Audio.unlock();
          window.__r4Audio.setMusicEnabled(true);
        });
        document.body.prepend(button);
        return true;
      });
    `);
    const preflight = await script(`
      return Promise.all(["/web/audio/foley/footstep01.ogg",
        "/web/audio/music/cathedral-in-the-forest.ogg"].map(async (url) => {
        const r = await fetch(url);
        const bytes = await r.arrayBuffer();
        return { url, status: r.status, type: r.headers.get("content-type"),
          ogg: new TextDecoder().decode(bytes.slice(0, 4)), size: bytes.byteLength };
      }));
    `);
    assert.equal(preflight.length, 2);
    for (const media of preflight) {
      assert.equal(media.status, 200, media.url);
      assert.equal(media.type, "audio/ogg", media.url);
      assert.equal(media.ogg, "OggS", media.url);
      assert.ok(media.size > 1000, media.url);
    }
    await click("#music-toggle");
    assert.equal(await script('return document.querySelector("#music-toggle").getAttribute("aria-pressed")'), "true");
    await click("#audio-toggle");
    assert.equal(await script('return document.querySelector("#audio-toggle").getAttribute("aria-pressed")'), "false");
    assert.equal(await script('return document.querySelector("#music-toggle").getAttribute("aria-pressed")'), "true", "effects must not mute music");
    await click("#music-toggle");
    assert.equal(await script('return document.querySelector("#music-toggle").getAttribute("aria-pressed")'), "false");
    await click("#r4-audio-probe"); // Trusted native browser user gesture, not JS .click().
    let loaded = 0;
    for (let n = 0; n < 100; n++) {
      loaded = await script("return window.__r4Audio.loadedFoleyCount()");
      if (loaded === 26) break;
      await delay(100);
    }
    if (loaded !== 26) {
      const diagnostics = await script(`
        return (async () => {
          let directDecode;
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const bytes = await (await fetch("/web/audio/foley/footstep01.ogg")).arrayBuffer();
            const buffer = await ctx.decodeAudioData(bytes);
            directDecode = { duration: buffer.duration, state: ctx.state };
            await ctx.close();
          } catch (err) { directDecode = { error: String(err) }; }
          return {
            unlock: window.__r4Unlock, unlocked: window.__r4Audio.isUnlocked(),
            contextState: window.__r4Context?.state,
            audioContextType: typeof window.AudioContext,
            musicState: window.__r4Music?.readyState,
            musicError: window.__r4Music?.error?.message,
            vorbisSupport: document.createElement("audio").canPlayType('audio/ogg; codecs="vorbis"'),
            directDecode
          };
        })();
      `);
      throw new Error(browser + " decoded " + loaded + "/26 OGG assets: " + JSON.stringify(diagnostics));
    }
    const result = await script(`
      return (async () => {
        const a = window.__r4Audio;
        const bytes = await (await fetch("/web/audio/foley/footstep01.ogg")).arrayBuffer();
        const pcm = await window.__r4Context.decodeAudioData(bytes);
        const channel = pcm.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < channel.length; i += 64) sum += channel[i] * channel[i];
        const rms = Math.sqrt(sum / Math.ceil(channel.length / 64));
        const before = window.__r4SourceStarts;
        const played = a.play("light");
        a.setMuted(true);
        const musicIndependent = a.isMusicEnabled() && !window.__r4Music.paused;
        a.setMusicEnabled(false);
        const musicPaused = window.__r4Music.paused;
        a.setMusicEnabled(true);
        return { unlocked: window.__r4Unlock, state: window.__r4Context.state,
          played, sources: window.__r4SourceStarts - before, rms, musicIndependent,
          musicPaused, musicLoop: window.__r4Music.loop,
          musicVolume: window.__r4Music.volume,
          musicPlaying: !window.__r4Music.paused };
      })();
    `);
    assert.equal(result.unlocked, true);
    assert.equal(result.state, "running", browser + " Web Audio not running after W3C gesture");
    assert.equal(result.played, true);
    assert.equal(result.sources, 1, browser + " never started decoded buffer playback");
    assert.ok(result.rms > 0.0001, browser + " decoded recording is silent");
    assert.equal(result.musicIndependent, true);
    assert.equal(result.musicPaused, true);
    assert.equal(result.musicLoop, true);
    assert.ok(result.musicVolume <= 0.3);
    assert.equal(result.musicPlaying, true);
    let playbackTime = 0;
    for (let n = 0; n < 40; n++) {
      playbackTime = await script("return window.__r4Music.currentTime");
      if (playbackTime > 0.08) break;
      await delay(100);
    }
    assert.ok(playbackTime > 0.08, browser + " music did not advance through decoded media");
    console.log("R4_NATIVE_AUDIO " + JSON.stringify({ browser, decoded: loaded, ...result, playbackTime }));
    // Release native media/context resources before closing browser.
    await script("window.__r4Audio.dispose(); return true;");
  } finally {
    if (session) await command(base, "DELETE", "/session/" + session).catch(() => {});
    child.kill("SIGTERM");
  }
}

try {
  for (let i = 0; i < names.length; i++) await run(names[i], 19515 + i);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
