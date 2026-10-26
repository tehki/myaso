// R3: Low-latency, asset-free combat cues. AudioContext is created only
// by a trusted user gesture; simulation and networking never wait on audio.
const CUES = Object.freeze({
  light: { start: 720, end: 235, duration: .095, gain: .19, noise: .10, filter: 2200, wave: "triangle", minMs: 55 },
  heavy: { start: 330, end: 65, duration: .24, gain: .28, noise: .20, filter: 900, wave: "sawtooth", minMs: 85 },
  kick: { start: 185, end: 55, duration: .125, gain: .26, noise: .15, filter: 600, wave: "triangle", minMs: 90 },
  roll: { start: 240, end: 110, duration: .17, gain: .08, noise: .24, filter: 1250, wave: "sine", minMs: 130 },
  guard: { start: 460, end: 260, duration: .065, gain: .075, noise: .045, filter: 1200, wave: "sine", minMs: 100 },
  parry: { start: 760, end: 340, duration: .11, gain: .11, noise: .035, filter: 1250, wave: "triangle", minMs: 100 },
  jump: { start: 290, end: 520, duration: .11, gain: .10, noise: .045, filter: 1550, wave: "sine", minMs: 120 },
  step: { start: 140, end: 65, duration: .070, gain: .045, noise: .080, filter: 410, wave: "triangle", minMs: 200 },
  hit: { start: 165, end: 38, duration: .19, gain: .33, noise: .23, filter: 880, wave: "sawtooth", minMs: 60 },
  damage: { start: 110, end: 38, duration: .22, gain: .33, noise: .27, filter: 550, wave: "triangle", minMs: 60 },
  block: { start: 390, end: 140, duration: .13, gain: .10, noise: .045, filter: 950, wave: "triangle", minMs: 80 },
  guardbreak: { start: 220, end: 65, duration: .24, gain: .14, noise: .04, filter: 650, wave: "triangle", minMs: 130 },
  death: { start: 155, end: 48, duration: .36, gain: .13, noise: .05, filter: 450, wave: "triangle", minMs: 300 },
  ui: { start: 720, end: 920, duration: .07, gain: .075, noise: 0, filter: 1200, wave: "sine", minMs: 75 },
});

// R4: physically recorded CC0 foley has priority over synthetic fallback.
// Small randomized playback-rate differences avoid robotic repetition.
const RECORDED_FOLEY = Object.freeze({
  light: ["knifeSlice", "knifeSlice2", "drawKnife1"],
  heavy: ["chop", "drawKnife2"],
  kick: ["dropLeather", "chop"],
  roll: ["cloth1", "cloth2", "cloth3"],
  guard: ["beltHandle1", "cloth4"],
  parry: ["metalClick", "beltHandle1"],
  jump: ["cloth2", "cloth3"],
  step: ["footstep00", "footstep01", "footstep02", "footstep03", "footstep04",
    "footstep05", "footstep06", "footstep07", "footstep08", "footstep09"],
  hit: ["chop", "dropLeather"],
  damage: ["dropLeather", "cloth1"],
  block: ["beltHandle1", "dropLeather", "metalClick"],
  guardbreak: ["dropLeather", "cloth1"],
  death: ["deathFall1", "deathFall2"],
});
// Owner listening review: the original metal pot resonances squeal, with the
// worst variant in Guard Break. Exclude those files entirely rather than
// relying on a small volume reduction to hide painful frequency peaks.
// Correct quiet knife variants with measured playback-only gain trims.
const FOLEY_GAIN_TRIM = Object.freeze({
  drawKnife1: 8, drawKnife2: 8, metalClick: 4, cloth4: 2,
});
// User-provided original MP3 recordings. One media element, four sequential
// tracks, no overlap, no automatic playback until explicitly opted in.
const MUSIC_TRACKS = Object.freeze([
  { title: "Moonlight Sonata — Adagio sostenuto", url: new URL("../../web/audio/music/moonlight-sonata-adagio.mp3", import.meta.url).href },
  { title: "Vivaldi — Autumn: Adagio molto", url: new URL("../../web/audio/music/vivaldi-autumn-adagio.mp3", import.meta.url).href },
  { title: "Vivaldi — Winter", url: new URL("../../web/audio/music/vivaldi-winter.mp3", import.meta.url).href },
  { title: "Untitled fourth composition", url: new URL("../../web/audio/music/track-04-untitled.mp3", import.meta.url).href },
]);
const SETTINGS_KEY = "myaso.audio.v1";
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function createGameAudio({ AudioContextImpl = globalThis.AudioContext ?? globalThis.webkitAudioContext,
  AudioElementImpl = globalThis.Audio,
  fetchImpl = typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null,
  random = Math.random,
  storage = readStorage(), defaultVolume = 0.55 } = {}) {
  let context = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;
  let volume = clamp(defaultVolume, 0, 1);
  let musicEnabled = false; // Explicit opt-in: no music autoplay on combat input.
  let musicVolume = 0.35; // Scaled down further by the ambient headroom factor.
  let musicTrack = null;
  let musicIndex = 0;
  const musicTrackListeners = new Set();
  const loadedSamples = new Map();
  const pendingSamples = new Map();
  let warmupStarted = false;
  let disposed = false;
  const abortFoley = typeof AbortController === "function" ? new AbortController() : null;
  const lastPlayed = new Map();
  const variantCursor = new Map();

  try {
    const saved = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? "null");
    if (typeof saved?.muted === "boolean") muted = saved.muted;
    if (Number.isFinite(saved?.volume)) volume = clamp(saved.volume, 0, 1);
    if (typeof saved?.musicEnabled === "boolean") musicEnabled = saved.musicEnabled;
    if (Number.isFinite(saved?.musicVolume)) musicVolume = clamp(saved.musicVolume, 0, 1);
  } catch { /* Storage can be disabled in private contexts. */ }

  function persist() {
    try { storage?.setItem(SETTINGS_KEY, JSON.stringify({ muted, volume, musicEnabled, musicVolume })); }
    catch { /* Sound remains usable without persistence. */ }
  }
  function updateMaster() {
    if (master) master.gain.value = muted ? 0 : volume;
  }
  function ensureFoleyWarmup() {
    if (disposed || warmupStarted || !fetchImpl || !context || typeof context.decodeAudioData !== "function") return;
    warmupStarted = true;
    const decoder = context;
    // At most two background decodes per client. A busy 3-player browser CI
    // must not suddenly launch 78 fetch/decode tasks next to timed native input.
    // Missing/corrupt OGG always leaves the existing R3 fallback available.
    const names = [...new Set(Object.values(RECORDED_FOLEY).flat())];
    let next = 0;
    async function worker() {
      while (!disposed && next < names.length) {
        const name = names[next++];
        const url = new URL(`../../web/audio/foley/${name}.ogg`, import.meta.url).href;
        const load = Promise.resolve().then(() => {
          if (disposed) return null;
          return fetchImpl(url, abortFoley ? { signal: abortFoley.signal } : undefined);
        })
          .then((response) => !disposed && response?.ok ? response.arrayBuffer() : null)
          .then((bytes) => bytes && !disposed ? decoder.decodeAudioData(bytes) : null)
          .then((buffer) => { if (buffer && !disposed) loadedSamples.set(name, buffer); })
          .catch(() => { /* Missing sample must never become an input error. */ })
          .finally(() => pendingSamples.delete(name));
        pendingSamples.set(name, load);
        await load;
      }
    }
    // After the genuine input callback has completed, start bounded work.
    for (let i = 0; i < 2; i++) Promise.resolve().then(worker);
  }
  function makeMusicTrack() {
    if (!musicTrack && AudioElementImpl) {
      try {
        musicTrack = new AudioElementImpl(MUSIC_TRACKS[musicIndex].url);
        musicTrack.loop = false; // Ended advances the 4-track playlist.
        musicTrack.preload = "none";
        musicTrack.volume = musicVolume * .30; // Keep effects readable at any slider setting.
        musicTrack.onended = () => { nextMusicTrack(); };
      } catch { musicTrack = null; }
    }
    return musicTrack;
  }
  function nextMusicTrack() {
    if (disposed) return false;
    musicIndex = (musicIndex + 1) % MUSIC_TRACKS.length;
    if (musicTrack) {
      try {
        musicTrack.pause();
        musicTrack.src = MUSIC_TRACKS[musicIndex].url;
        // Do not call load() while off or hidden: never preload future songs.
      } catch { /* A missing output device must not impact combat. */ }
      syncMusic();
    }
    for (const callback of musicTrackListeners) {
      try { callback(musicIndex); } catch { /* UI observers cannot affect audio. */ }
    }
    return true;
  }
  function onMusicTrackChanged(callback) {
    if (typeof callback !== "function" || disposed) return () => {};
    musicTrackListeners.add(callback);
    return () => musicTrackListeners.delete(callback);
  }
  function syncMusic() {
    const track = musicTrack;
    if (!track) return;
    track.volume = musicVolume * .30;
    if (!musicEnabled || globalThis.document?.hidden || musicVolume <= 0) {
      try { track.pause(); } catch { /* No effect on input. */ }
      return;
    }
    if (!track.paused) return; // Slider and visibility updates must not restart music.
    try {
      const started = track.play();
      if (started?.catch) started.catch(() => {
        // Browser policy or missing source: do not claim music is audible.
        // The next explicit Music on click can try again.
      });
    } catch { /* Autoplay remains user-gesture gated. */ }
  }
  function setMusicEnabled(value) {
    if (disposed) return;
    musicEnabled = Boolean(value);
    if (musicEnabled) makeMusicTrack();
    syncMusic();
    persist();
  }
  function setMusicVolume(value) {
    if (disposed || !Number.isFinite(value)) return;
    musicVolume = clamp(value, 0, 1);
    syncMusic();
    persist();
  }
  function suspendMusicWhenHidden() { syncMusic(); }

  function unlock() {
    if (disposed) return false;
    // A previously enabled ambient track may resume only on the next real
    // player gesture in a new session, never automatically during bootstrap.
    if (musicEnabled && !musicTrack) { makeMusicTrack(); syncMusic(); }
    if (!AudioContextImpl) return false;
    if (!context) {
      try {
        context = new AudioContextImpl({ latencyHint: "interactive" });
        master = context.createGain();
        master.connect(context.destination);
        updateMaster();
        if (typeof context.createBuffer === "function") {
          const sampleCount = Math.max(1, Math.floor(context.sampleRate * .32));
          noiseBuffer = context.createBuffer(1, sampleCount, context.sampleRate);
          const data = noiseBuffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        }
      } catch {
        context = null;
        master = null;
        return false;
      }
    }
    if (context.state === "suspended") {
      try { context.resume().catch(() => {}); } catch { /* Browser gesture gate. */ }
    }
    // Schedule file fetch + decode asynchronously after returning from unlock.
    ensureFoleyWarmup();
    return true;
  }
  function setMuted(value) {
    if (disposed) return;
    muted = Boolean(value);
    updateMaster();
    persist();
  }
  function setVolume(value) {
    if (disposed || !Number.isFinite(value)) return;
    volume = clamp(value, 0, 1);
    updateMaster();
    persist();
  }
  function play(name, { pan = 0, level = 1 } = {}) {
    const spec = CUES[name];
    if (disposed || !spec || muted || volume <= 0 || !context || !master || globalThis.document?.hidden) return false;
    const now = context.currentTime;
    if (now - (lastPlayed.get(name) ?? -Infinity) < spec.minMs / 1000) return false;
    lastPlayed.set(name, now);
    const amplitude = clamp(level, 0, 1);
    if (amplitude <= 0) return false;
    try {
      const output = typeof context.createStereoPanner === "function"
        ? context.createStereoPanner() : context.createGain();
      if (output.pan) output.pan.value = clamp(pan, -1, 1);
      output.connect(master);

      const variants = RECORDED_FOLEY[name] ?? [];
      const ready = variants.filter((variant) => loadedSamples.has(variant));
      if (ready.length && typeof context.createBufferSource === "function") {
        const cursor = variantCursor.get(name) ?? 0;
        variantCursor.set(name, cursor + 1);
        const sample = context.createBufferSource();
        const variant = ready[cursor % ready.length];
        sample.buffer = loadedSamples.get(variant);
        if (sample.playbackRate) {
          sample.playbackRate.value = name === "guardbreak"
            ? .80 + clamp(random(), 0, 1) * .05
            : name === "death" ? .94 + clamp(random(), 0, 1) * .04
            : .96 + clamp(random(), 0, 1) * .08;
        }
        const envelope = context.createGain();
        const cueGain = name === "step" ? .46
          : name === "guardbreak" ? .34
          : name === "death" ? .50
          : name === "parry" || name === "block" ? .44 : .64;
        const peak = Math.max(.0002, amplitude * cueGain * (FOLEY_GAIN_TRIM[variant] ?? 1));
        envelope.gain.setValueAtTime(peak, now);
        // Short dull impact rather than a screaming resonant ring. A single
        // local biquad per very short defensive cue does not touch simulation.
        const cutoff = name === "guardbreak" ? 950
          : name === "death" ? 1250
          : name === "parry" || name === "block" ? 1750 : null;
        const filter = cutoff !== null ? context.createBiquadFilter() : null;
        if (filter) {
          filter.type = "lowpass";
          filter.frequency.value = cutoff;
          sample.connect(filter);
          filter.connect(envelope);
        } else sample.connect(envelope);
        envelope.connect(output);
        sample.start(now);
        sample.onended = () => { sample.disconnect(); filter?.disconnect(); envelope.disconnect(); output.disconnect(); };
        return true;
      }

      // R3 synthesis is a fail-silent fallback while recordings decode or
      // if a device/browser cannot play OGG. Never blocks combat input.
      const osc = context.createOscillator();
      osc.type = spec.wave;
      osc.frequency.setValueAtTime(spec.start, now);
      osc.frequency.exponentialRampToValueAtTime(spec.end, now + spec.duration);
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(.0001, now);
      envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, spec.gain * amplitude), now + .005);
      envelope.gain.exponentialRampToValueAtTime(.0001, now + spec.duration);
      osc.connect(envelope);
      envelope.connect(output);
      osc.start(now);
      osc.stop(now + spec.duration + .008);
      osc.onended = () => { osc.disconnect(); envelope.disconnect(); output.disconnect(); };

      if (noiseBuffer && spec.noise > 0) {
        const noise = context.createBufferSource();
        noise.buffer = noiseBuffer;
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = spec.filter;
        const noiseEnvelope = context.createGain();
        noiseEnvelope.gain.setValueAtTime(.0001, now);
        noiseEnvelope.gain.exponentialRampToValueAtTime(Math.max(.0002, spec.noise * amplitude), now + .003);
        noiseEnvelope.gain.exponentialRampToValueAtTime(.0001, now + spec.duration);
        noise.connect(filter);
        filter.connect(noiseEnvelope);
        noiseEnvelope.connect(output);
        noise.start(now, 0, spec.duration + .008);
        noise.onended = () => { noise.disconnect(); filter.disconnect(); noiseEnvelope.disconnect(); };
      }
      return true;
    } catch { return false; } // Audio must never interfere with combat/input.
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    abortFoley?.abort();
    if (musicTrack) musicTrack.onended = null;
    musicTrackListeners.clear();
    try { musicTrack?.pause(); } catch { /* Already stopped or unavailable. */ }
    const closingContext = context;
    context = null;
    master = null;
    noiseBuffer = null;
    loadedSamples.clear();
    pendingSamples.clear();
    lastPlayed.clear();
    variantCursor.clear();
    try { closingContext?.close?.()?.catch?.(() => {}); }
    catch { /* A closed or unsupported audio device is harmless. */ }
    musicTrack = null;
  }
  return Object.freeze({ unlock, play, dispose, setMuted, setVolume,
    setMusicEnabled, setMusicVolume, nextMusicTrack, onMusicTrackChanged,
    suspendMusicWhenHidden,
    isMuted: () => muted, getVolume: () => volume, isUnlocked: () => context !== null,
    isMusicEnabled: () => musicEnabled, getMusicVolume: () => musicVolume,
    isMusicPlaying: () => Boolean(musicTrack && !musicTrack.paused),
    getMusicTrackIndex: () => musicIndex,
    getMusicTrackTitle: () => MUSIC_TRACKS[musicIndex].title,
    getMusicTrackCount: () => MUSIC_TRACKS.length,
    getPlaybackClock: () => context?.currentTime ?? null,
    loadedFoleyCount: () => loadedSamples.size });
}

function readStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

// Both offline and authoritative online clients share the same accessible control.
export function installGameAudioControls(audio, root = globalThis.document) {
  const enable = root?.querySelector("#audio-enable");
  const toggle = root?.querySelector("#audio-toggle");
  const slider = root?.querySelector("#audio-volume");
  const musicToggle = root?.querySelector("#music-toggle");
  const musicSlider = root?.querySelector("#music-volume");
  if (!toggle || !slider) return;
  function sync() {
    if (enable) enable.hidden = audio.isUnlocked();
    toggle.textContent = audio.isMuted() ? "Effects off" : "Effects on";
    toggle.setAttribute("aria-pressed", String(!audio.isMuted()));
    slider.value = String(Math.round(audio.getVolume() * 100));
    if (musicToggle) {
      musicToggle.textContent = audio.isMusicEnabled() ? "Music on" : "Music off";
      musicToggle.setAttribute("aria-pressed", String(audio.isMusicEnabled()));
    }
    if (musicSlider) musicSlider.value = String(Math.round(audio.getMusicVolume() * 100));
  }
  // A separate trusted UI gesture can initialize the expensive AudioContext
  // without delaying an actual combat input or source0 network frame.
  enable?.addEventListener("click", () => {
    audio.unlock();
    audio.play("ui");
    sync();
  });
  toggle.addEventListener("click", () => {
    audio.unlock();
    audio.setMuted(!audio.isMuted());
    audio.play("ui");
    sync();
  });
  slider.addEventListener("input", () => {
    audio.unlock();
    audio.setVolume(Number(slider.value) / 100);
    sync();
  });
  // Ambient soundtrack is always a separate, explicit, user-controlled layer.
  musicToggle?.addEventListener("click", () => {
    audio.setMusicEnabled(!audio.isMusicEnabled());
    sync();
  });
  musicSlider?.addEventListener("input", () => {
    audio.setMusicVolume(Number(musicSlider.value) / 100);
    sync();
  });
  root?.addEventListener?.("visibilitychange", () => audio.suspendMusicWhenHidden());
  sync();
}

// Only play remote action starts once per authoritative state transition.
// A repeated/reordered packet or resimulation cannot replay a remote sound.
export function createRemoteActionAudioTracker({ hearingRadius = 440 } = {}) {
  const previous = new Map();
  const onset = new Map([
    [1, "light"], [24, "light"], [27, "light"], [21, "light"],
    [9, "heavy"], [12, "kick"], [4, "roll"], [30, "roll"],
    [15, "jump"], [16, "light"],
  ]);
  return {
    observe(state, ownId, play) {
      if (!(state instanceof Map) || !ownId || typeof play !== "function") return;
      const own = state.get(ownId);
      if (!own) return;
      const seen = new Set();
      for (const fighter of state.values()) {
        if (!Number.isInteger(fighter.netId)) continue;
        const id = fighter.netId;
        seen.add(id);
        const before = previous.get(id);
        previous.set(id, fighter.action);
        if (id === ownId || before === undefined || before === fighter.action) continue;
        const cue = onset.get(fighter.action);
        if (!cue) continue;
        const distance = Math.hypot(fighter.x - own.x, fighter.y - own.y);
        if (!Number.isFinite(distance) || distance >= hearingRadius) continue;
        play(cue, {
          pan: clamp((fighter.x - own.x) / (hearingRadius * .7), -1, 1),
          level: clamp((1 - distance / hearingRadius) * .65, .04, .65),
        });
      }
      for (const id of previous.keys()) if (!seen.has(id)) previous.delete(id);
    },
    reset() { previous.clear(); },
  };
}

export function soundForCombatFeedback(feedback) {
  if (feedback === "damage-taken" || feedback === "shoved" || feedback === "rolled-over") return "damage";
  if (feedback === "hit-confirm" || feedback === "kick-confirm" || feedback === "roll-impact") return "hit";
  if (feedback === "parry-success" || feedback === "parried") return "parry";
  if (feedback === "guard-broken" || feedback === "guard-break-confirm") return "guardbreak";
  if (feedback === "guard-pressure" || feedback === "block-confirm") return "block";
  return null;
}
