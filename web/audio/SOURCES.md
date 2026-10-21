# myaso.io Sound R4 — Audio sources, licensing and playlist

## Four source-identical MP3 recordings

The project owner supplied these four **user-provided** MP3 files from the Windows
`%USERPROFILE%\Music` folder. Windows NTFS `Zone.Identifier`
alternate data streams on **all four original files** identify
`ReferrerUrl=https://musopen.org/` and individual
`HostUrl=https://dl.musopen.org/recordings/...` downloads.
That is file-origin evidence, **not an automatic guarantee of licensing**.

The game plays the four originals **sequentially** through a single opt-in
HTML media element. A track ends before the next starts; after #4 it
wraps to #1. `preload=none`, independent music volume and mute,
visibility pause, and no gameplay-triggered autoplay are preserved.

| Order | Bundled file | Recording details and duration | Download recording ID |
| --- | --- | --- | --- |
| 1 | `moonlight-sonata-adagio.mp3` | Beethoven, Sonata No. 14, first movement; 5:35.54; audio tags say *Unknown Artist* | `4689d506-fb06-439a-878b-0a80e9722084` |
| 2 | `vivaldi-autumn-adagio.mp3` | Vivaldi, Four Seasons — Autumn: Adagio molto; John Harrison, violin; 2:32.69 | `616970c4-72d3-43e6-b680-5fa879330b18` |
| 3 | `vivaldi-winter.mp3` | Vivaldi, Four Seasons — Winter; USAF Concert Band and Singing Sergeants; 3:17.67 | `edc962f5-6cc9-40ab-ae28-c2bfcb859ae6` |
| 4 | `track-04-untitled.mp3` | Title and performer *unknown*; Windows category Blues; 10:22.92 | `3274b502-2ab0-4506-9d49-d2442a02699b` |

### Original download URLs from the Windows file zone metadata

- #1 <https://dl.musopen.org/recordings/4689d506-fb06-439a-878b-0a80e9722084.mp3>
- #2 <https://dl.musopen.org/recordings/616970c4-72d3-43e6-b680-5fa879330b18.mp3>
- #3 <https://dl.musopen.org/recordings/edc962f5-6cc9-40ab-ae28-c2bfcb859ae6.mp3>
- #4 <https://dl.musopen.org/recordings/3274b502-2ab0-4506-9d49-d2442a02699b.mp3>

The Windows original filenames sometimes included a `filename=` query
parameter. The recording ID above is the same canonical Musopen download.
The four bundled MP3s were copied byte-for-byte, not transcoded or
remixed. Source and committed asset SHA-256 hashes match:

```text
moonlight-sonata-adagio.mp3       04fd810bc2dad1aa5f2dd5c8703c068c5830b4f1c2540aaea7b2451ee775015a
vivaldi-autumn-adagio.mp3        2191f3ac31bd6214c4040df7be181deaf9751f621d079c58577f81bacf5ad911
vivaldi-winter.mp3               6ae40350af0ca7458b66711478a47cb1acc793adb338c51f11f4ee8f4da37438
track-04-untitled.mp3           5d4547cccaf97fb17f7160bf7d165de5ad11ec3819cc6a1a05ef5f054942b54c
```

### Recording-specific permissions: release checklist

**Musopen source terms:** https://musopen.org/faq/ explains that
the rights in the composition and a particular performance are separate,
and Musopen cannot guarantee the copyright status of every upload.
The catalog notes that specific restrictions require checking each
recording's license icon: https://musopen.org/music/.

- **Autumn (#2): verified attribution/share-alike required.** The
  owner's MP3 contains the embedded comment: `John Harrison, Violin;
  Robert Turizziani, Conductor; Wichita State University Chamber
  Players`, then **Creative Commons Attribution ShareAlike 1.0** and
  https://creativecommons.org/licenses/by-sa/1.0/.
  Wikimedia Commons confirms this specific performance is available
  under Creative Commons BY-SA, including selectable later versions:
  https://commons.wikimedia.org/wiki/File:Vivaldi_-_Four_Seasons_3_Autumn_mvt_2_Adagio_molto_-_John_Harrison_violin.oga.
  When distributing or using this recording, retain appropriate
  performer/source/license attribution and comply with the selected
  BY-SA version's conditions. **Do not label Autumn as CC0 or public domain.**
- **Moonlight (#1): exact Musopen download source known; recording-specific
  license/performer not independently verified.** Beethoven's
  composition being old does not independently clear this performance.
- **Winter (#3): exact Musopen download source and the USAF performer
  attribution known; recording-specific terms not independently
  confirmed against that exact MP3.** Likely U.S. federal public
  domain material, but do not assert it without checking provenance.
- **Untitled (#4): exact Musopen download source known but the artist,
  composition and recording-specific license are still unverified.**
  The MP3 has no ID3 title/artist. Do not invent them from its genre.

**Release gate:** The owner reports the recordings as royalty-free / public
domain. That statement and Musopen-hosted origin are documented, but they
do not establish that every recording meets public redistribution and
commercial game-use requirements. Check each individual Musopen recording
license before merging into public distribution, particularly #1 and #4,
and apply BY-SA attribution for #2. Evidence/reference links are
preserved here for review.

## Physical combat/movement Foley (CC0)

**Kenney RPG Audio (2014), CC0 1.0:**
- https://kenney.nl/assets/rpg-audio
- https://opengameart.org/content/50-rpg-sound-effects
- https://opengameart.org/sites/default/files/RPGsounds_Kenney.zip

The game retains 22 unchanged Kenney CC0 OGG sounds for blade motions,
footfalls, cloth, leather and restrained metal clicks. It removed the
resonant `metalPot1/2/3` recordings and squeaking `creak1` after
owner listening feedback. Guard Break uses soft, filtered physical impacts.

## Death grunt and physical fall (CC0)

**Exewin, Death Sounds (2018), CC0 1.0:**
- https://opengameart.org/content/death-sounds-0
- https://opengameart.org/sites/default/files/exewinDeathSoundsPack.zip

The two derived `deathFall1.ogg` and `deathFall2.ogg` each combine a
real **human dying/grunt** recording from Exewin with a Kenney leather fall.
Reproducible processing recipe: `scripts/build_death_falls.sh`.
Offline low-pass/fade/gain
limiting and the runtime's additional 1250 Hz low-pass avoid sharp squeaks.

## Sound-only listening / runtime

`web/audio/audition.html` uses the same sound mixer and gates cue controls
until **24 / 24 recorded OGG effects** decode. Its Music switch and
**Next track** button preview all four user MP3s without opening the game,
connecting to multiplayer or modifying saved gameplay audio preferences.

From the local Sound branch checkout:

```powershell
py -m http.server 8000
```

Open `http://127.0.0.1:8000/web/audio/audition.html`. Music is opt-in
and defaults to 35% on the 30%-headroom media bus. The single playlist
player has `preload=none`, ends-driven next track, automatic wrap and
visibility pause. Native Chrome/Firefox CI verifies MP3 MIME and actual
playback; tests verify no overlap, unintended autoplay and source hashes.
Human listening was approved by the owner on 2026-10-20.
