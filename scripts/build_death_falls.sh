#!/usr/bin/env bash
# Reproducible offline assembly of two human, non-squeaking death falls.
# Input: Exewin Death Sounds Pack (CC0) from OpenGameArt, URL in SOURCES.md.
# Output: two short OGG death-grunt + body-drop foley variants. Requires ffmpeg.
# Run from repository root after obtaining the CC0 archive:
#   bash scripts/build_death_falls.sh /path/to/exewinDeathSoundsPack.zip
set -euo pipefail
archive="${1:?Pass the CC0 Exewin death sounds ZIP as the first argument}"
cd "$(dirname "$0")/.."
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
unzip -p "$archive" exewinDeathSoundsPack/6.ogg > "$scratch/grunt6.ogg"
unzip -p "$archive" exewinDeathSoundsPack/11.ogg > "$scratch/grunt11.ogg"
test -s "$scratch/grunt6.ogg"
test -s "$scratch/grunt11.ogg"

# Blend the genuine human CC0 final-breath grunt with existing Kenney CC0
# falling leather/body contact. 1100-1250 Hz low-pass removes the squeaky,
# sharp upper frequencies and retains low human voice + body impact.
ffmpeg -hide_banner -loglevel error -y \
  -i "$scratch/grunt6.ogg" -i web/audio/foley/dropLeather.ogg \
  -filter_complex '[0:a]aresample=48000,highpass=f=65,lowpass=f=1200,volume=2.1,afade=t=out:st=0.93:d=0.24,apad=pad_dur=0.28[v];[1:a]aresample=48000,lowpass=f=730,volume=0.27,adelay=180|180,apad=pad_dur=0.3[b];[v][b]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.60,atrim=0:1.45,afade=t=out:st=1.24:d=0.18[out]' \
  -map '[out]' -ar 48000 -ac 2 -c:a libvorbis -q:a 3 \
  web/audio/foley/deathFall1.ogg

ffmpeg -hide_banner -loglevel error -y \
  -i "$scratch/grunt11.ogg" -i web/audio/foley/dropLeather.ogg \
  -filter_complex '[0:a]aresample=48000,highpass=f=65,lowpass=f=1150,volume=2.4,afade=t=out:st=0.72:d=0.20,apad=pad_dur=0.38[v];[1:a]aresample=48000,lowpass=f=680,volume=0.34,adelay=235|235,apad=pad_dur=0.3[b];[v][b]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.60,atrim=0:1.32,afade=t=out:st=1.08:d=0.22[out]' \
  -map '[out]' -ar 48000 -ac 2 -c:a libvorbis -q:a 3 \
  web/audio/foley/deathFall2.ogg

ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 web/audio/foley/deathFall1.ogg
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 web/audio/foley/deathFall2.ogg
