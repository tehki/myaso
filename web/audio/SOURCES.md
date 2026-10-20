# myaso.io Sound R4.1 — sources and listening direction

## Physical combat sound effects — CC0

**Kenney, RPG Audio (2014), CC0 1.0**
- https://kenney.nl/assets/rpg-audio
- https://opengameart.org/content/50-rpg-sound-effects
- Distribution: https://opengameart.org/sites/default/files/RPGsounds_Kenney.zip

The 23 bundled `web/audio/foley/*.ogg` files are unchanged recordings
from the original Kenney OGG set. They include blade movement, leathery
impacts, soft fabric shifts, physical footfalls and a short restrained
metal click. Playback uses subtle randomized rates and gain calibration.

**R4.1 listening-driven safety correction:** the three resonant
`metalPot1/2/3.ogg` files were removed. They sounded sharp or squealing,
especially as Guard Break variants. **Guard Break now rotates only between
low, dry leather and cloth recordings**, slowed down and passed through a
950 Hz low-pass filter at reduced volume. Block and parry use similarly
damped recordings with a 1750 Hz low-pass filter. A softened procedural
fallback remains available if a browser cannot decode OGG.

The quiet draw-knife recordings require small gain compensation (8x);
`metalClick` receives a 4x trim, and `cloth4` 2x. These corrections are
controlled by final per-cue volume. There is no real-time audio analysis
or synchronous asset loading on combat input.

## Original minimal Moonlit Notes music (R4.1)

- File: `web/audio/music/moonlit-notes.ogg`
- Source: `scripts/generate_moonlit_notes.py` (reproducible PCM score)
- Original composition for myaso.io; **no third-party music recording**
- 96-second quiet loop, 24 short pentatonic notes, true silence between
  notes and at loop boundaries, no sustained chords, organs, pads or drone
- Standard 48 kHz stereo Vorbis OGG (~287 KB) resampled from 24 kHz mono score; served locally

The previous 137-second `Cathedral in the forest` CC0 recording was removed
in response to listening feedback: its constantly sustained organ-like
texture competed with the game's natural sounds. The new track is
intentionally simple: a few low soft notes with room for silence.

Regenerate from the repository root:

```bash
python3 scripts/generate_moonlit_notes.py /tmp/myaso-moonlit-notes.wav
ffmpeg -y -i /tmp/myaso-moonlit-notes.wav -ar 48000 -ac 2 -c:a libvorbis -q:a 3 web/audio/music/moonlit-notes.ogg
```

Music remains independently opt-in; at the default Music setting of
35%, the media element is limited to 10.5% of full-scale playback. Sound
effects and music have separate controls and persist independently. No
automatic music starts on combat input; hidden tabs pause playback.

## Sound-only listening review

The standalone `web/audio/audition.html` uses the identical mixer from
`src/browser/game-audio.mjs` without loading or simulating the game.
Buttons are disabled until **23 / 23 decoded** local CC0 effects are ready.
The page does not silently play synthesized replacements during a review.

From a Sound R4.1 branch checkout:

```powershell
py -m http.server 8000
```

Then open `http://127.0.0.1:8000/web/audio/audition.html`; click
**Prepare 23 recordings**, wait for all 23 to decode, and try Guard Break
multiple times. Compare Parry/Block, Light/Heavy and the quiet Moonlit Notes
music. Pan the sound to test spatial placement. Use comfortable headphone
levels at first.

Before R4.1 is subjectively accepted, a human listener should confirm
**no shrill/squeaky Guard Break variant**, dull but legible hit and block
feedback, blade motion that remains physical, and only sparse simple notes
in the background. The automated Chromium/Firefox native media tests
prove playback and controls, not whether the audio sounds good to a person.

## Technical constraints

- Client audio is optional, nonauthoritative and never blocks input,
  rendering, networking, death, loot, or server simulation.
- The two OGG decode workers are bounded per browser; audio stays local.
- Distant opponents are attenuated, replayed packets remain silent, and
  speculative local attacks are never treated as confirmed remote hits.
- All 23 foley samples remain CC0, with source credits above; the new
  Moonlit Notes music is original to this project.
