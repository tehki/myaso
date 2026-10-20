# myaso.io audio sources and sound direction

## Recorded foley — CC0

**Kenney, RPG Audio (2014), Creative Commons CC0 1.0**
- Official: https://kenney.nl/assets/rpg-audio
- Archived bundle: https://opengameart.org/content/50-rpg-sound-effects
- Original distribution: https://opengameart.org/sites/default/files/RPGsounds_Kenney.zip

The 26 included `web/audio/foley/*.ogg` files are **unchanged originals** from the `OGG/` directory of this bundle (the audio itself, not the .sfk waveform sidecars). They cover knife swishes, metallic contact, clothing/leather movement, steps and physical impacts. We retain per-event randomized pitch and variant rotation to avoid a mechanical repeating sound.

## Ambient music — CC0

**congusbongus, "Cathedral in the forest (ambient loop)" (2022), Creative Commons CC0 1.0**
- Author/source: https://opengameart.org/content/cathedral-in-the-forest-ambient-loop
- Included original: `web/audio/music/cathedral-in-the-forest.ogg` (the source's `forest_2.ogg` renamed, otherwise unchanged, 136.97 seconds)
- 2:17 seamless loop of subdued dark atmospheric pads and bells; not combat music

All included media are confirmed CC0 as published on their original asset pages. Attribution is optional; credit is included for transparency. They are bundled locally and never streamed from a third-party host during gameplay.

## R4 playback loudness calibration

Objective `ffmpeg volumedetect` measurements on the original bundled OGGs showed
`drawKnife1.ogg` at -44.7 dBFS mean versus `knifeSlice.ogg` at -21.5 dBFS,
and `drawKnife2.ogg` at -41.3 dBFS mean versus `chop.ogg` at -18.5 dBFS.
Untrimmed rotation could make consecutive blade cues differ by roughly 23 dB.
The very short `metalClick` is also quieter than the resonant `metalPot`
recordings. The Web Audio player applies small **per-recording gain trims**
(8x boost for both draw-knife files; 4x for metalClick; attenuation on
metalPot1/2/3; 2x for cloth4). Source files remain byte-for-byte unchanged.
The boosted knife clip peaks remain below full scale at the standard mix gain.
No waveform scans, network requests, or normalizations run during player input.
These instrumented gain trims improve consistent attack readability but do
not replace subjective listening tests for material character or final mix.


## Mixing principles

- **Combat and world foley:** physical recordings first. For missing files/OGG-decoding failures the previous lightweight procedural cues remain as fail-silent fallbacks. Sound is neither authoritative gameplay nor a source of input latency.
- **Ambient music:** quiet background atmosphere, not synchronized to fights and never a loud combat-theme interruption. A dedicated Music on/off control is opt-in; a separate level defaults to 35% on a 30%-headroom bus. The page and network simulation never force audio autoplay.
- **Space:** positional nearby remote cues, distance reduction, 1-cue-per-action onset, and no distant sounds. Avoid needless sound overlap.
- **Future:** swap region-appropriate biome/weather loops at the music boundary and add in-world distance-reduced NPC, environment and inventory sounds without changing authoritative game mechanics.

## Sound-only listening review (no playable game)

The standalone `web/audio/audition.html` uses **the same
`src/browser/game-audio.mjs` mixer as gameplay**, including measured CC0
recording trims, randomized playback speed, pan, game effects slider and
independent low-level ambient music. There is no combat simulation or game
connection on this page. Effects stay disabled until all 26 local OGG files
decode; the page never silently substitutes synthetic sounds during review.

From the repository root on Windows, serve the current Sound branch locally:

```powershell
py -m http.server 8000
```

Then open `http://localhost:8000/web/audio/audition.html`. Click **Prepare 26
recordings**, wait for **26 / 26 decoded**, and use the cue buttons. Try each
cue a few times to hear variant loudness, then turn on the independent ambient
music and compare attacks and blocks over it. Pan the sound left/right to
audition remote spatial placement. Use comfortable headphone levels.

Before Sound R4 can be called *subjectively accepted*, a human listener
should verify that light/heavy blades are distinguishable and convincingly
physical, parry/block metal is not painfully sharp, footsteps and cloth
movement sound proportional, death and damage are readable, and music remains
background atmosphere without dominating combat. The listening reviewer
should explicitly report approval or concrete changes needed. Native CI
automatically tests correct decoding/playback/UI but does not claim human
listening approval.
