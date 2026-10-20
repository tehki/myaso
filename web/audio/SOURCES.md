# myaso.io Sound R4 — audio provenance and playlist

## Four user-provided MP3 music recordings

The owner supplied **four MP3 recordings from their Windows Music folder**
for the game. The existing generated `Moonlit Melody` and old organ drone
have been removed from gameplay. The new music layer plays **one MP3 at a time
in sequence**, advances when a song ends, returns to the first after track 4,
and does not preload all 4 simultaneously. It remains off until the player
explicitly enables Music; effects volume/mute are independent.

| Playback order | Bundled file | Windows-file metadata | Duration |
| --- | --- | --- | --- |
| 1 | `moonlight-sonata-adagio.mp3` | Beethoven, *Piano Sonata No. 14, Op. 27 No. 2, I. Adagio sostenuto* (embedded artist: Unknown Artist) | 5:35.54 |
| 2 | `vivaldi-autumn-adagio.mp3` | Vivaldi, *The Four Seasons — Autumn: Adagio molto*; embedded artist: John Harrison — Violin | 2:32.69 |
| 3 | `vivaldi-winter.mp3` | Vivaldi, *The Four Seasons — Winter*; embedded artist: The USAF Concert Band and Singing Sergeants | 3:17.67 |
| 4 | `track-04-untitled.mp3` | Source file has no title/artist tags (Windows music category: Blues); do not invent an identity | 10:22.92 |

All four files are **byte-for-byte identical to the owner's provided
original MP3s**. The file names have been normalized for web serving; there
is no transcode, remix or lossy re-encoding. SHA-256 checksums:

```text
moonlight-sonata-adagio.mp3       04fd810bc2dad1aa5f2dd5c8703c068c5830b4f1c2540aaea7b2451ee775015a
vivaldi-autumn-adagio.mp3        2191f3ac31bd6214c4040df7be181deaf9751f621d079c58577f81bacf5ad911
vivaldi-winter.mp3               6ae40350af0ca7458b66711478a47cb1acc793adb338c51f11f4ee8f4da37438
track-04-untitled.mp3           5d4547cccaf97fb17f7160bf7d165de5ad11ec3819cc6a1a05ef5f054942b54c
```

**Licensing note:** the user reports that the four recordings are public
domain / royalty-free. Composition copyright and **recording-specific
redistribution/public-performance rights** are different. We have not
independently verified rights in the individual performances or the fourth
untitled MP3, and do not assert a particular license for them. Confirm
recording-specific rights before shipping the files in a public release.

## Original physical combat/movement Foley (CC0)

**Kenney RPG Audio (2014), CC0 1.0:**
- https://kenney.nl/assets/rpg-audio
- https://opengameart.org/content/50-rpg-sound-effects
- https://opengameart.org/sites/default/files/RPGsounds_Kenney.zip

The bundle retains **22 unchanged CC0 Kenney OGG effects** for movement,
blades, footfalls, cloth, leather and restrained metal clicks. Harsh
`metalPot1/2/3` and squeaking `creak1` were deliberately removed after
the owner's listening feedback. Guard Break uses filtered soft leather/cloth
instead of piercing metal.

## Death — human grunt + physical fall (CC0)

**Exewin, "Death sounds" (2018), CC0 1.0:**
- https://opengameart.org/content/death-sounds-0
- Original source package: https://opengameart.org/sites/default/files/exewinDeathSoundsPack.zip

Derived `deathFall1.ogg` and `deathFall2.ogg` use Exewin human
death-grunt recordings 6 and 11 plus a Kenney leather fall sound. Source
recipe: `scripts/build_death_falls.sh`. Offline low-pass, fade and
gain limiting remove harsh high frequency; runtime applies an additional
1250 Hz low-pass and reduced playback level. There is no old wooden creak.

## Audition and runtime boundaries

`web/audio/audition.html` exercises the identical browser mixer with
**24 / 24 local OGG effects**, the four independent MP3 songs, an explicit
Music on/off toggle and **Next track** preview. It does not load the
playable world, networking, physics or characters, and its settings do not
modify the player's persisted game preferences.

From the sound-branch checkout, serve the repository root locally:

```powershell
py -m http.server 8000
```

Open `http://127.0.0.1:8000/web/audio/audition.html`. Press Prepare
24 recordings, select Music on and try Next track to hear all four. The
playlist cycles automatically on completion; only one media element plays,
with `preload=none`, default Music slider 35% times a 30% bus headroom
factor, and independent combat effects.

Native Chromium/Firefox acceptance must confirm correct MP3 MIME and
actual media playback; unit tests verify opt-in, end-of-track progression,
round-robin wrap, no overlap, pause, no off-state autoplay and cleanup.
Human listening and license verification are separate release gates.
