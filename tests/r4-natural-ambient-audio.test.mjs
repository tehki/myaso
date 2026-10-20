import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createGameAudio } from "../src/browser/game-audio.mjs";

class Param {
  value = 0;
  setValueAtTime(v) { this.value = v; }
  exponentialRampToValueAtTime(v) { this.value = v; }
}
class Node { connect() { return this; } disconnect() {} }
class Context {
  static created = 0;
  static instances = [];
  currentTime = 0;
  state = "running";
  sampleRate = 8000;
  oscillators = 0;
  samples = [];
  gainNodes = [];
  destination = new Node();
  constructor() { Context.created++; Context.instances.push(this); }
  createGain() {
    const node = Object.assign(new Node(), { gain: new Param() });
    this.gainNodes.push(node);
    return node;
  }
  createStereoPanner() { return Object.assign(new Node(), { pan: new Param() }); }
  createOscillator() { this.oscillators++; return Object.assign(new Node(), { frequency: new Param(), start() {}, stop() {} }); }
  createBuffer(_channels, length) { return { getChannelData() { return new Float32Array(length); } }; }
  createBiquadFilter() { return Object.assign(new Node(), { frequency: new Param() }); }
  createBufferSource() {
    const sample = Object.assign(new Node(), { playbackRate: new Param(), start() {}, stop() {} });
    this.samples.push(sample);
    return sample;
  }
  async decodeAudioData(bytes) { return { length: bytes.byteLength, duration: 0.5 }; }
  resume() { return Promise.resolve(); }
}

class MusicTrack {
  static created = [];
  constructor(src) {
    this.src = src; this.loop = false; this.paused = true; this.volume = 0;
    this.playCalls = 0; this.pauseCalls = 0;
    MusicTrack.created.push(this);
  }
  play() { this.playCalls++; this.paused = false; return Promise.resolve(); }
  pause() { this.pauseCalls++; this.paused = true; }
}

test("R4 CC0 recorded foley and ambient loop are bundled locally", () => {
  const files = readdirSync(new URL("../web/audio/foley/", import.meta.url));
  assert.equal(files.length, 26);
  for (const file of files) {
    assert.match(file, /^[\w]+\.ogg$/);
    assert.equal(readFileSync(new URL("../web/audio/foley/" + file, import.meta.url)).subarray(0, 4).toString(), "OggS");
  }
  const ambient = readFileSync(new URL("../web/audio/music/cathedral-in-the-forest.ogg", import.meta.url));
  assert.equal(ambient.subarray(0, 4).toString(), "OggS");
  assert.ok(ambient.byteLength > 100_000 && ambient.byteLength < 5_000_000);
  const source = readFileSync(new URL("../web/audio/SOURCES.md", import.meta.url), "utf8");
  assert.match(source, /Kenney.*CC0/);
  assert.match(source, /congusbongus[\s\S]*?CC0/);
});

test("R4 natural foley decodes asynchronously, uses OGG rather than oscillator once loaded, and preserves cooldown", async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    return { ok: true, arrayBuffer: async () => Uint8Array.of(0x4f,0x67,0x67,0x53).buffer };
  };
  const audio = createGameAudio({ AudioContextImpl: Context, AudioElementImpl: MusicTrack,
    fetchImpl, random: () => 0.5, storage: null });
  assert.equal(audio.play("step"), false);
  assert.equal(audio.loadedFoleyCount(), 0);
  assert.equal(audio.unlock(), true);
  for (let i = 0; i < 30 && audio.loadedFoleyCount() < 26; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert.equal(audio.loadedFoleyCount(), 26);
  assert.equal(requested.length, 26);
  assert.ok(requested.every(u => u.includes("/web/audio/foley/") && u.endsWith(".ogg")));
  assert.equal(new Set(requested).size, 26, "each real recording is decoded once");
  const ctx = Context.instances.at(-1);
  assert.equal(audio.play("light"), true);
  assert.equal(audio.play("light"), false, "same-simulation-tick events cannot duplicate sound");
  assert.equal(audio.play("step"), true);
  assert.equal(audio.play("block"), true);
  // No oscillator-based game sound is created once recorded assets decode.
  assert.equal(ctx.oscillators, 0);
  assert.equal(ctx.samples.length, 3);
  assert.equal(ctx.samples[0].playbackRate.value, 1);
  assert.ok(ctx.samples.every(sample => sample.buffer.length === 4));
  assert.equal(requested.length, 26, "combat playback never fetches media synchronously");
});

test("R4 music is opt-in, separate from effects, quiet, looping, and persistent", () => {
  const values = new Map();
  const storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) };
  const audio = createGameAudio({ AudioContextImpl: Context, AudioElementImpl: MusicTrack,
    fetchImpl: null, storage });
  const initial = MusicTrack.created.length;
  assert.equal(audio.isMusicEnabled(), false);
  assert.equal(MusicTrack.created.length, initial, "must not create/stream music before consent");
  audio.setMusicEnabled(true);
  assert.equal(MusicTrack.created.length, initial + 1);
  const track = MusicTrack.created.at(-1);
  assert.ok(track.src.endsWith("/web/audio/music/cathedral-in-the-forest.ogg"));
  assert.equal(track.loop, true);
  assert.equal(track.preload, "none");
  assert.equal(audio.isMusicPlaying(), true);
  assert.equal(track.volume, 0.35 * 0.30, "ambient mix should leave headroom for combat");
  audio.setMuted(true);
  assert.equal(track.paused, false, "muting combat foley does not mute ambient music");
  audio.setMusicVolume(0.8);
  assert.equal(track.volume, 0.8 * 0.30);
  audio.setMusicEnabled(false);
  assert.equal(track.paused, true);
  audio.setMusicEnabled(true);
  assert.equal(MusicTrack.created.length, initial + 1, "one looping media element, no stacked tracks");
  const restored = createGameAudio({ AudioContextImpl: Context, AudioElementImpl: MusicTrack,
    fetchImpl: null, storage });
  assert.equal(restored.isMuted(), true);
  assert.equal(restored.isMusicEnabled(), true);
  assert.equal(restored.getMusicVolume(), 0.8);
  assert.equal(MusicTrack.created.length, initial + 1, "restore must not autoplay without gesture");
  assert.equal(restored.unlock(), true);
  assert.equal(MusicTrack.created.length, initial + 2, "saved preference resumes only after a fresh player gesture");
  assert.equal(MusicTrack.created.at(-1).paused, false);
  restored.setMusicEnabled(false);
});

test("R4 mute, slider and separate Music buttons are shared by online and offline clients", () => {
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  for (const id of ["audio-toggle", "audio-volume", "music-toggle", "music-volume"]) {
    assert.ok(html.includes('id="' + id + '"'));
  }
  const audioSource = readFileSync(new URL("../src/browser/game-audio.mjs", import.meta.url), "utf8");
  assert.match(audioSource, /musicToggle\?\.addEventListener\("click"/);
  assert.match(audioSource, /musicSlider\?\.addEventListener\("input"/);
  assert.match(audioSource, /root\?\.addEventListener\?\.\("visibilitychange"/);
  for (const client of ["game", "online-game"]) {
    const code = readFileSync(new URL("../web/" + client + ".mjs", import.meta.url), "utf8");
    assert.match(code, /installGameAudioControls\(audio\)/);
    assert.match(code, /audio\.play\("step"/);
    assert.doesNotMatch(code, /setMusicEnabled\(true\)/, "combat/input never starts music");
  }
});

test("R4 media slider changes do not retrigger playback; hidden tabs pause and resume only when visible", () => {
  const previous = globalThis.document;
  globalThis.document = { hidden: false };
  try {
    const audio = createGameAudio({ AudioContextImpl: Context, AudioElementImpl: MusicTrack,
      fetchImpl: null, storage: null });
    audio.setMusicEnabled(true);
    const track = MusicTrack.created.at(-1);
    assert.equal(track.playCalls, 1);
    audio.setMusicVolume(0.5);
    audio.setMusicVolume(0.65);
    assert.equal(track.playCalls, 1, "changing music volume must not restart an active loop");
    globalThis.document.hidden = true;
    audio.suspendMusicWhenHidden();
    assert.equal(track.paused, true);
    const started = track.playCalls;
    audio.setMusicEnabled(true);
    assert.equal(track.playCalls, started, "hidden tab must never start playback");
    globalThis.document.hidden = false;
    audio.suspendMusicWhenHidden();
    assert.equal(track.paused, false);
    assert.equal(track.playCalls, started + 1, "returning to visible resumes exactly once");
    audio.suspendMusicWhenHidden();
    assert.equal(track.playCalls, started + 1, "duplicate visibility events cannot stack playback");
    audio.dispose();
    assert.equal(track.paused, true);
    assert.equal(audio.unlock(), false);
    assert.equal(audio.play("light"), false);
    audio.setMusicEnabled(true);
    assert.equal(audio.isMusicEnabled(), true, "dispose never silently overwrites saved preferences");
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});

test("R4 unreadable recordings use nonblocking fallback and disposal cancels in-flight loads", async () => {
  let attempts = 0;
  let aborts = 0;
  class ClosingContext extends Context {
    close() { this.closed = true; return Promise.resolve(); }
  }
  const broken = createGameAudio({ AudioContextImpl: ClosingContext, AudioElementImpl: MusicTrack,
    fetchImpl: async () => ({ ok: false }), storage: null });
  assert.equal(broken.unlock(), true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(broken.loadedFoleyCount(), 0);
  assert.equal(broken.play("heavy"), true, "missing OGG must preserve gameplay-independent fallback");
  assert.equal(Context.instances.at(-1).oscillators, 1);
  broken.dispose();
  assert.equal(Context.instances.at(-1).closed, true);

  const pending = createGameAudio({ AudioContextImpl: ClosingContext, AudioElementImpl: MusicTrack,
    storage: null, fetchImpl: (_url, options) => {
      attempts++;
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => {
          aborts++;
          reject(new Error("aborted"));
        }, { once: true });
      });
    },
  });
  pending.unlock();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(attempts, 2, "only two concurrent media requests");
  pending.dispose();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(aborts, 2);
  assert.equal(pending.loadedFoleyCount(), 0);
  assert.equal(pending.unlock(), false, "disposed instance cannot recreate AudioContext");
  pending.dispose(); // idempotent
});

test("R4 native browser servers declare OGG MIME and CI runs genuine browser audio proof", () => {
  for (const runner of ["browser_flight_runner.mjs", "pvp_browser_flight_runner.mjs"]) {
    const source = readFileSync(new URL("../scripts/" + runner, import.meta.url), "utf8");
    assert.match(source, /filename\.endsWith\("\.ogg"\)\) return "audio\/ogg"/);
  }
  const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  assert.match(workflow, /node --test tests\/r4-natural-ambient-audio\.test\.mjs/);
  assert.match(workflow, /node scripts\/r4_audio_browser_acceptance\.mjs/);
  const harness = readFileSync(new URL("../scripts/r4_audio_browser_acceptance.mjs", import.meta.url), "utf8");
  assert.match(harness, /r4-audio-probe/);
  assert.match(harness, /assert\.equal\(result\.sources, 1/);
});

test("R4 per-recording gain trims stabilize quiet blade variants and tame metal impacts", async () => {
  const audio = createGameAudio({
    AudioContextImpl: Context, AudioElementImpl: MusicTrack, storage: null,
    random: () => .5,
    fetchImpl: async () => ({
      ok: true,
      arrayBuffer: async () => Uint8Array.of(0x4f, 0x67, 0x67, 0x53).buffer,
    }),
  });
  assert.equal(audio.unlock(), true);
  for (let i = 0; i < 30 && audio.loadedFoleyCount() < 26; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert.equal(audio.loadedFoleyCount(), 26);
  const ctx = Context.instances.at(-1);
  function nextGain(cue) {
    ctx.currentTime += .35; // Preserve the real per-cue dedupe window.
    assert.equal(audio.play(cue), true);
    return ctx.gainNodes.at(-1).gain.value;
  }
  const blades = [nextGain("light"), nextGain("light"), nextGain("light")];
  assert.ok(Math.abs(blades[0] - blades[1]) < 1e-9);
  assert.ok(Math.abs(blades[2] / blades[0] - 8) < 1e-9,
    "quiet knife-draw should not disappear among knife slices");
  const heavies = [nextGain("heavy"), nextGain("heavy")];
  assert.ok(Math.abs(heavies[1] / heavies[0] - 8) < 1e-9);
  const parries = [nextGain("parry"), nextGain("parry")];
  assert.ok(parries[0] > parries[1],
    "quiet metallic click is boosted while resonant metal pot is attenuated");
  const blocks = [nextGain("block"), nextGain("block"), nextGain("block")];
  assert.ok(blocks[0] < .64 && blocks[1] < .64 && blocks[2] > .64);
  // An 8x boost on the quietest measured knife variant stays below full scale
  // with default master/envelope gain and the original -24.3 dBFS source peak.
  assert.ok(.55 * .64 * 8 * 10 ** (-24.3 / 20) < 1);
  audio.dispose();
});
