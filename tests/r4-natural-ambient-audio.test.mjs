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
  destination = new Node();
  constructor() { Context.created++; Context.instances.push(this); }
  createGain() { return Object.assign(new Node(), { gain: new Param() }); }
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
