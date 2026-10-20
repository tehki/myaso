#!/usr/bin/env python3
"""Reproduce R4.1's original, quiet, sparse ambient cue without third-party samples.

Run from repository root:
  python3 scripts/generate_moonlit_notes.py /tmp/moonlit-notes.wav
  ffmpeg -y -i /tmp/moonlit-notes.wav -ar 48000 -ac 2 -c:a libvorbis -q:a 3 web/audio/music/moonlit-notes.ogg

Short, softly plucked pentatonic notes with long SILENCES; no pads, organs,
sustained chord drones, high-frequency attacks or music-network dependency.
Fixed score and renderer: every build generates identical PCM samples.
"""
from array import array
from math import exp, pi, sin
from pathlib import Path
import sys
import wave

SAMPLE_RATE = 24_000
SECONDS = 96
# Hand-composed sparse melody in a low D-minor-pentatonic palette.
# (seconds after loop start, frequency Hz, emphasis). Each note fades before
# the next; the closing four seconds and opening one second are truly silent.
NOTES = (
    (1.3, 293.66, 0.78), (4.8, 220.00, 0.65),
    (9.2, 261.63, 0.78), (12.8, 349.23, 0.63),
    (17.2, 293.66, 0.70), (21.0, 220.00, 0.65),
    (24.8, 261.63, 0.72), (28.5, 293.66, 0.59),
    (33.0, 392.00, 0.63), (36.3, 349.23, 0.64),
    (40.6, 293.66, 0.82), (44.1, 220.00, 0.64),
    (48.4, 261.63, 0.76), (51.8, 349.23, 0.58),
    (56.0, 293.66, 0.72), (59.6, 261.63, 0.61),
    (64.0, 220.00, 0.75), (67.7, 293.66, 0.63),
    (72.1, 349.23, 0.70), (75.4, 293.66, 0.63),
    (79.6, 261.63, 0.74), (83.2, 220.00, 0.64),
    (87.3, 293.66, 0.79), (90.4, 220.00, 0.51),
)


def render():
    samples = array("f", [0.0]) * (SAMPLE_RATE * SECONDS)
    # Short round plucks (~1.7s) rather than legato sustained notes.
    for start, pitch, emphasis in NOTES:
        offset = round(start * SAMPLE_RATE)
        length = round(1.72 * SAMPLE_RATE)
        phase = 2 * pi * pitch / SAMPLE_RATE
        for i in range(length):
            t = i / SAMPLE_RATE
            attack = min(1.0, t / 0.014)
            # The upper partials vanish quickly to avoid metallic squeals.
            fundamental = sin(phase * i)
            soft_second = 0.16 * exp(-3.5 * t) * sin(2 * phase * i)
            soft_third = 0.025 * exp(-7.0 * t) * sin(3 * phase * i)
            release = min(1.0, max(0.0, (1.72 - t) / 0.075))
            value = (fundamental + soft_second + soft_third) * attack * release * exp(-2.65 * t)
            samples[offset + i] += 0.23 * emphasis * value
    # Tiny reflections create a natural-room impression, not a sustained bed.
    for delay, strength in ((0.095, 0.055), (0.21, 0.024)):
        shift = round(delay * SAMPLE_RATE)
        for i in range(len(samples) - shift - 1, shift - 1, -1):
            samples[i] += samples[i - shift] * strength
    # Hard bounds and fixed integer PCM for reproducible source.
    pcm = array("h", (int(round(max(-1.0, min(1.0, v)) * 32767)) for v in samples))
    if sys.byteorder != "little":
        pcm.byteswap()
    return pcm.tobytes()


if __name__ == "__main__":
    dest = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/moonlit-notes.wav")
    dest.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(dest), "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(SAMPLE_RATE)
        writer.writeframes(render())
    print(f"Wrote original sparse-note PCM: {dest} ({SECONDS}s, {len(NOTES)} notes)")
