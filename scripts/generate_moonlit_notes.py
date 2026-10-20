#!/usr/bin/env python3
"""Render the original myaso.io Moonlit Melody, a non-droning fantasy ambience.

Reproducible score: 8 x 16-beat melodic phrases at 80 BPM, gentle short
harp/wood notes, quiet answering voices, soft stereo echoes. No sustaining
organ/pad waveform or near-continuous bass note. Nothing generated at runtime.

  python3 scripts/generate_moonlit_notes.py /tmp/moonlit-melody.wav
  ffmpeg -y -i /tmp/moonlit-melody.wav -ar 48000 -ac 2 -c:a libvorbis -q:a 3 web/audio/music/moonlit-melody.ogg
"""
from array import array
from math import exp, pi, sin
from pathlib import Path
import sys
import wave

SAMPLE_RATE = 24_000
SECONDS = 96
BEAT_SECONDS = 0.75
FREQ = {
    "D3": 146.83, "F3": 174.61, "G3": 196.00, "A3": 220.00,
    "C4": 261.63, "D4": 293.66, "E4": 329.63, "F4": 349.23,
    "G4": 392.00, "A4": 440.00, "Bb4": 466.16, "C5": 523.25,
    "D5": 587.33, "E5": 659.25, "F5": 698.46,
}
# Beat offset, pitch, duration in beats. Each phrase tells its own musical
# line; answering phrases are related but never an endlessly repeated arpeggio.
PHRASES = [
    [(0,"D4",1),(1.5,"F4",.9),(3,"A4",1.5),(5.5,"G4",.8),
     (6.5,"F4",1),(8,"E4",1.3),(10,"D4",1.4),(12,"F4",1),(13.5,"E4",1)],
    [(0,"F4",1.2),(1.5,"A4",1),(3,"C5",1.6),(5.5,"A4",.8),
     (6.5,"G4",1),(8,"F4",1.4),(10.5,"E4",1),(12,"F4",.8),(13.5,"A4",1)],
    [(0,"D5",1.4),(2,"C5",1),(3.5,"A4",1.3),(5.5,"F4",1),
     (7,"G4",1),(8.5,"A4",1),(10,"Bb4",.8),(11.5,"A4",1.2),(13.5,"F4",1)],
    [(0,"G4",.9),(1.5,"Bb4",1.1),(3.5,"A4",1),(5,"F4",1.3),
     (7,"E4",1),(8.5,"D4",1.3),(10.5,"F4",.8),(12,"A4",.8),(14,"E4",.8)],
    [(0,"D4",1),(1.5,"F4",.8),(3,"A4",1),(4.5,"C5",.8),
     (6,"A4",1),(7.5,"F4",1.1),(9.5,"G4",.9),(11,"F4",.8),(13.5,"D4",1.3)],
    [(0,"C5",1),(1.5,"D5",1),(3.5,"A4",1.4),(6,"G4",1.1),
     (7.5,"F4",.9),(9,"A4",.8),(10.5,"G4",1),(12.5,"F4",1),(14,"E4",.8)],
    [(0,"F4",1.2),(2,"A4",1),(3.5,"F5",1.2),(5.5,"E5",1),
     (7,"C5",1.2),(9,"A4",.9),(10.5,"G4",1),(12,"F4",1),(14,"E4",.8)],
    [(0,"D5",1),(1.5,"C5",.8),(3,"A4",1),(5,"F4",1.2),
     (7,"G4",.8),(8.5,"F4",1),(10,"E4",.8),(11.5,"D4",1.1),(13,"D4",1.1)],
]
# Sparse bass/inner voicings are melodic plucked notes, never sustained beds.
ROOTS = ["D3", "F3", "G3", "D3", "D3", "F3", "G3", "D3"]
RESPONSES = ["A3", "C4", "D4", "F3", "A3", "D4", "F3", "A3"]


def render():
    length = SECONDS * SAMPLE_RATE
    left = array("f", [0.0]) * length
    right = array("f", [0.0]) * length

    def pluck(start_s, pitch_name, duration, strength, pan, voice="harp"):
        start_index = round(start_s * SAMPLE_RATE)
        if start_index >= length or start_index < 0:
            return
        count = min(round(duration * SAMPLE_RATE), length - start_index)
        w = 2 * pi * FREQ[pitch_name] / SAMPLE_RATE
        if voice == "harp":
            decay, second, third = 2.3, 0.24, 0.065
        elif voice == "wood":
            decay, second, third = 3.1, 0.13, 0.025
        else:  # high bell has a soft edge and a shorter tail than a pad
            decay, second, third = 2.7, 0.17, 0.04
        lv = (1 - pan) * 0.5
        rv = (1 + pan) * 0.5
        for i in range(count):
            t = i / SAMPLE_RATE
            attack = min(1.0, t / 0.022)
            release = min(1.0, max(0.0, (duration - t) / .085))
            envelope = strength * attack * release * exp(-decay * t)
            value = envelope * (sin(w * i)
                + second * exp(-4.4 * t) * sin(2 * w * i)
                + third * exp(-7.0 * t) * sin(3 * w * i))
            left[start_index + i] += value * lv
            right[start_index + i] += value * rv

    # Leave ~0.45s at the head and ~1.5s at the tail for a smooth quiet seam.
    for phrase_id, phrase in enumerate(PHRASES):
        base = phrase_id * 16 * BEAT_SECONDS + 0.48
        for idx, (beat, name, span) in enumerate(phrase):
            pluck(base + beat * BEAT_SECONDS, name, min(1.6, span * BEAT_SECONDS + .30),
                .42 * (0.88 + (idx % 3) * .06), (-.28 if idx % 2 else .28), "harp")
        # The background has discrete low wood notes with true gaps.
        pluck(base + 0.0, ROOTS[phrase_id], 1.55, .16, -.18, "wood")
        pluck(base + 4.1 * BEAT_SECONDS, RESPONSES[phrase_id], 1.2, .13, .25, "wood")
        pluck(base + 8.0 * BEAT_SECONDS, ROOTS[phrase_id], 1.55, .13, -.10, "wood")
        pluck(base + 12.1 * BEAT_SECONDS, RESPONSES[phrase_id], 1.2, .11, .20, "wood")
        # Two tiny high answering notes make the tune conversational, not dull.
        if phrase_id in (1, 2, 4, 5, 6):
            pluck(base + 4.5 * BEAT_SECONDS, "D5", .72, .11, .60, "bell")
            pluck(base + 11.0 * BEAT_SECONDS, "C5", .64, .10, -.53, "bell")

    # Early stereo reflections at low level; no long reverberant pad or drone.
    for delay, gain in ((.18, .11), (.37, .055), (.57, .024)):
        shift = round(delay * SAMPLE_RATE)
        for i in range(length - shift - 1, shift - 1, -1):
            left[i] += right[i - shift] * gain
            right[i] += left[i - shift] * gain

    pcm = array("h")
    for l, r in zip(left, right):
        pcm.extend((int(max(-1, min(1, l)) * 32767),
                    int(max(-1, min(1, r)) * 32767)))
    if sys.byteorder != "little":
        pcm.byteswap()
    return pcm.tobytes()


if __name__ == "__main__":
    dest = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/moonlit-melody.wav")
    dest.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(dest), "wb") as writer:
        writer.setnchannels(2)
        writer.setsampwidth(2)
        writer.setframerate(SAMPLE_RATE)
        writer.writeframes(render())
    print(f"Wrote melodic fantasy ambience: {dest} ({SECONDS}s, {len(PHRASES)} phrases)")
