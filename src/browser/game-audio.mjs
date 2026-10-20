// R3: Low-latency, asset-free combat cues. AudioContext is created only
// by a trusted user gesture; simulation and networking never wait on audio.
const CUES = Object.freeze({
  light: { start: 720, end: 235, duration: .095, gain: .19, noise: .10, filter: 2200, wave: "triangle", minMs: 55 },
  heavy: { start: 330, end: 65, duration: .24, gain: .28, noise: .20, filter: 900, wave: "sawtooth", minMs: 85 },
  kick: { start: 185, end: 55, duration: .125, gain: .26, noise: .15, filter: 600, wave: "triangle", minMs: 90 },
  roll: { start: 240, end: 110, duration: .17, gain: .08, noise: .24, filter: 1250, wave: "sine", minMs: 130 },
  guard: { start: 460, end: 260, duration: .065, gain: .075, noise: .045, filter: 1200, wave: "sine", minMs: 100 },
  parry: { start: 1180, end: 740, duration: .14, gain: .18, noise: .10, filter: 2900, wave: "triangle", minMs: 100 },
  jump: { start: 290, end: 520, duration: .11, gain: .10, noise: .045, filter: 1550, wave: "sine", minMs: 120 },
  step: { start: 140, end: 65, duration: .070, gain: .045, noise: .080, filter: 410, wave: "triangle", minMs: 200 },
  hit: { start: 165, end: 38, duration: .19, gain: .33, noise: .23, filter: 880, wave: "sawtooth", minMs: 60 },
  damage: { start: 110, end: 38, duration: .22, gain: .33, noise: .27, filter: 550, wave: "triangle", minMs: 60 },
  block: { start: 500, end: 160, duration: .13, gain: .19, noise: .17, filter: 1900, wave: "square", minMs: 80 },
  guardbreak: { start: 380, end: 55, duration: .26, gain: .34, noise: .23, filter: 1400, wave: "sawtooth", minMs: 130 },
  death: { start: 155, end: 35, duration: .30, gain: .20, noise: .11, filter: 500, wave: "triangle", minMs: 300 },
  ui: { start: 720, end: 920, duration: .07, gain: .075, noise: 0, filter: 1200, wave: "sine", minMs: 75 },
});

const SETTINGS_KEY = "myaso.audio.v1";
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function createGameAudio({ AudioContextImpl = globalThis.AudioContext ?? globalThis.webkitAudioContext,
  storage = readStorage(), defaultVolume = 0.55 } = {}) {
  let context = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;
  let volume = clamp(defaultVolume, 0, 1);
  const lastPlayed = new Map();

  try {
    const saved = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? "null");
    if (typeof saved?.muted === "boolean") muted = saved.muted;
    if (Number.isFinite(saved?.volume)) volume = clamp(saved.volume, 0, 1);
  } catch { /* Storage can be disabled in private contexts. */ }

  function persist() {
    try { storage?.setItem(SETTINGS_KEY, JSON.stringify({ muted, volume })); }
    catch { /* Sound remains usable without persistence. */ }
  }
  function updateMaster() {
    if (master) master.gain.value = muted ? 0 : volume;
  }
  function unlock() {
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
    return true;
  }
  function setMuted(value) {
    muted = Boolean(value);
    updateMaster();
    persist();
  }
  function setVolume(value) {
    if (!Number.isFinite(value)) return;
    volume = clamp(value, 0, 1);
    updateMaster();
    persist();
  }
  function play(name, { pan = 0, level = 1 } = {}) {
    const spec = CUES[name];
    if (!spec || muted || volume <= 0 || !context || !master || globalThis.document?.hidden) return false;
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
  return Object.freeze({ unlock, play, setMuted, setVolume,
    isMuted: () => muted, getVolume: () => volume, isUnlocked: () => context !== null });
}

function readStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

// Both offline and authoritative online clients share the same accessible control.
export function installGameAudioControls(audio, root = globalThis.document) {
  const toggle = root?.querySelector("#audio-toggle");
  const slider = root?.querySelector("#audio-volume");
  if (!toggle || !slider) return;
  function sync() {
    toggle.textContent = audio.isMuted() ? "Sound off" : "Sound on";
    toggle.setAttribute("aria-pressed", String(!audio.isMuted()));
    slider.value = String(Math.round(audio.getVolume() * 100));
  }
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
