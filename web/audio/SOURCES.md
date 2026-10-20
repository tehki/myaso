# myaso.io Sound R4.2 — recorded death and melodic ambient

## Physical combat / movement foley (CC0)

**Kenney, RPG Audio (2014), Creative Commons CC0 1.0**
- Source: https://kenney.nl/assets/rpg-audio
- Mirrored CC0 source: https://opengameart.org/content/50-rpg-sound-effects
- Original package: https://opengameart.org/sites/default/files/RPGsounds_Kenney.zip

The 22 remaining original `web/audio/foley/*.ogg` Kenney recordings
cover blades, leather/cloth, metal clicks, movement and footsteps. The
three resonant `metalPot` recordings were removed in R4.1 due to
painful high-frequency squealing, particularly in Guard Break.

## Death: genuine human voice and grounded fall (CC0)

**Exewin, "Death sounds" (2018), Creative Commons CC0 1.0**
- Licensed source: https://opengameart.org/content/death-sounds-0
- CC0 original download: https://opengameart.org/sites/default/files/exewinDeathSoundsPack.zip
- Source recordings used: `exewinDeathSoundsPack/6.ogg` and `11.ogg`
- Final in-game sounds: `deathFall1.ogg` and `deathFall2.ogg`

R4.2 removes `creak1.ogg` and its reference from Death: it was a
physical door/wood creak, not a credible dying character, and included
the shrill squeaking the owner reported. The two replacement variants
contain real **human dying/grunt vocal performances** with an offset
Kenney leather impact suggesting a body hitting the ground. Offline
low-pass (roughly 1150–1200 Hz), fade-outs, gain limits and an additional
1250 Hz low-pass in the player keep these cues short, warm and non-shrill.
Their final recorded-cue playback gain is reduced to 0.50.
They are recorded CC0 derivatives, **not synthetic screams**.

To reproduce the derived files using the CC0 original ZIP and ffmpeg:

```bash
bash scripts/build_death_falls.sh /path/to/exewinDeathSoundsPack.zip
```

This offline recipe is a development tool only. The browser never fetches
source archives and always uses the two bundled resulting OGG files.

## Melodic fantasy ambience: Moonlit Melody (original score)

- File: `web/audio/music/moonlit-melody.ogg`
- Source: `scripts/generate_moonlit_notes.py`
- 96 seconds; **eight individual melodic phrases**, each with recognizable
  call-and-response, gentle low plucked harmony and occasional bell replies
- 80 BPM, short harp/wood-style notes and small stereo early reflections
- No continuously sustained chord, organ-like timbre, looped pad, or drone
- No third-party music; original composition built for myaso.io
- 48 kHz stereo Vorbis (~676 KB), significantly smaller than R4's 2.95 MB

R4.1's 24 isolated notes were too sparse and dull. R4.2 adds melodic
contour and short counterlines to evoke an atmospheric fantasy realm
while leaving quiet spaces for combat and environmental sound.
A music-only track stays separately opt-in, not synchronized to hits,
never forced on by combat, and capped at 30% of the independent Music
volume slider. Default Music level remains 35%.

Reproduce the soundtrack from the original project score:

```bash
python3 scripts/generate_moonlit_notes.py /tmp/moonlit-melody.wav
ffmpeg -y -i /tmp/moonlit-melody.wav -ar 48000 -ac 2 -c:a libvorbis -q:a 3 web/audio/music/moonlit-melody.ogg
```

## Listening / review

The `web/audio/audition.html` sound-only page loads the actual game mixer
and gates all cue buttons on **24 / 24 decoded recorded effects**.
No playable game, combat simulation or network connection is launched.
Use comfortable headphones and review repeated Death cues to verify
distinct non-squeaking grunts plus physical falls, then enable Music
to hear the new melody and subtle supporting harmony. Also try
Parry/Block/Guard Break for harshness, and compare effects against music.

In Windows PowerShell from the checkout root:

```powershell
py -m http.server 8000
```

Open `http://127.0.0.1:8000/web/audio/audition.html`, press
**Prepare 24 recordings**, and listen. Reviewer approval remains required;
passing automated decoding/playback does not establish subjective quality.

## Runtime / architecture

- 22 unchanged Kenney CC0 effects + 2 derived Exewin/Kenney CC0 Death files
  = 24 bundled foley OGG recordings. `creak1` and squealing `metalPot*` gone.
- Recorded foley prioritized; nonblocking R3 synthesizer is only a
  fail-soft fallback when OGG loading/decoding fails.
- Two bounded asynchronous fetch+decode workers; no synchronous audio on
  trusted combat input, no remote streaming, no production token use.
- Nearby remote fighters are spatially attenuated; duplicate snapshots
  cannot replay the same sound. Audio never affects server authority.
