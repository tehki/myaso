# R4 native full-track metadata / real ending acceptance

This Sound-only test modifies **only** `scripts/r4_audio_browser_acceptance.mjs`. It exercises the existing four original recorded MP3s and unchanged `createGameAudio()` implementation using real W3C Chrome/Firefox playback.

It validates original full-song metadata (335.54, 152.69, 197.67 and 622.92 seconds), actual browser HTTP Range-based seek to the final ~1.25 seconds of each unmodified MP3, native `ended` event (not direct `onended()` calls), automatic sequence through four tracks and return to the first, one HTMLMediaElement and no overlap. The original 24 decoded OGG samples, music opt-in, volume/visibility controls, and original source/credit checks remain mandatory.

**Limits:** This is **not** 21 minutes and 49 seconds of uninterrupted listening, not a quality-of-headphones measurement, not a deployment. Seeking near track endings is an explicit acceleration for CI. Failure is a genuine browser-media integration failure and must not be replaced with simulated `ended` signals to make the test green. No music recording, audio mixer, active game, server, input or original Combat test was changed. First Playable Pre-Alpha continues to use merged R4; this experimental acceptance is not a new production feature or a separate release dependency.
