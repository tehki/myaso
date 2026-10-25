# 🌕🎨 Graphics 3A — Owner-approved external character library intake (P1, nonrelease)

**Decision date:** 2026-10-25  
**Status:** OWNER SELECTED / SOURCE ACQUISITION AND TECHNICAL QUALIFICATION PENDING  
**Authority:** Graphics Orchestrator 3 / Main Orchestrator 0; see [P1 Graphics #1030](https://github.com/tehki/myaso/issues/1030).  
**Budget authorization:** free Standard tiers only; no purchases or paid Source tier.

## Approved — acquire, evaluate and license-audit

| Producer | Selected source | Owner decision | Release use |
|---|---|---|---|
| Quaternius | [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) | **APPROVED** | Generic player/NPC humanoid meshes + consistent head, hair, skin and proportions; *not* a replacement for P0 Silver |
| Quaternius | [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) | **APPROVED** | Candidate source animations and skeletal retargeting, P1 only |
| Quaternius | [Universal Animation Library 2](https://quaternius.itch.io/universal-animation-library-2) | **APPROVED** | Additional locomotion/action/combat retarget sources, P1 only |
| KayKit | [Character Animations](https://kaylousberg.itch.io/kaykit-character-animations) | **APPROVED** | Alternative retarget reference and action clips, P1 only |
| Quaternius | [Modular Character Outfits - Fantasy](https://quaternius.itch.io/modular-character-outfits-fantasy) | **APPROVED 2026-10-25** | Clothing/armor/civilian visual variety compatible with Universal Base Characters, P1 only |

### Modular Character Outfits — official acquisition facts checked 2026-10-25

- [Official pack](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html) / [itch listing](https://quaternius.itch.io/modular-character-outfits-fantasy) explicitly list **CC0 1.0 Universal**, **commercial use**, **12 outfits**, **62 modular parts**, **3 color texture variations**, compatible with the Universal Base Character heads, humanoid rig and Universal Animation Library.
- Official itch change history: **v2.0 2026-01-29** fixes interchangeable parts / incorrect .BIN filenames; **v2.1 2026-07-05** fixes Noble/Wizard glTF exports and texture paths in combined Blend files. Acquire latest free Standard package, inspect contents and version, do not assume all outfits exist in a free subset.
- Publisher's no-payment download is named **`Modular Character Outfits - Fantasy[Standard].zip` (280 MB)**. Separate `[Source].zip` lists **724 MB with $20 minimum** on the itch page. **Do not buy Source or claim Blender .blend, shaders, rigs or complete set are present in Standard until actually inspected.**
- Publisher now also publishes [Quaternius Asset License v1.0](https://quaternius.com/license.html) dated 2026-08-28. The pack-specific itch page still explicitly states CC0; log the exact download's included license and acquisition date before public redistribution of any raw assets. If inconsistent, ask Graphics Orchestrator 3 to clarify scope instead of treating all Quaternius content as blanket CC0.
- Do not simply place a downloaded archive (or the large third-party libraries) into this public Git repository. First check embedded license and user-facing distro restrictions, choose cleared derived game sprites / approved asset path, and preserve sources with provenance, attribution expectations, SHA256 and per-file manifest.
- Download at **$0 only** via the publisher's official link. Record `ZIP_SHA256`, download date, zip listing, rig/bone naming, texture and mat naming, topologies and legal evidence upon actual download. No hashes are claimed until bytes are acquired.

## Excluded or still unapproved

- **Do not use the Mid-Poly Knight.** The owner explicitly rejected its appearance; not a fallback, not a reference mesh.
- MakeHuman/MPFB, Quaternius older Ultimate Modular Men/Women, Bestiary monsters and other suggested packs remain **candidates, not newly approved here**.
- P1 Dash artwork [#1034](https://github.com/tehki/myaso/pull/1034), Spartan Kick V3 and grounded Knockdown [#788](https://github.com/tehki/myaso/pull/788) are separately qualified visual research; selection of animation source libraries is *not* approval to promote any Combat clips.

## Acceptance before anyone imports into Moon Games gameplay

1. Acquire only official free Standard archives; store manifest record: original publisher URL, UTC acquisition timestamp, version, exact archive SHA256, contained filenames, exact license text, restrictions, and verified credit requirement.
2. Inspect actual downloaded rig and meshes in Blender with **no replacement for the original server actor, original World, physics, game scale, 60Hz authority or authoritative Combat actions**.
3. Retarget one controlled Idle / Walk / Sprint / Jump / Roll test to the selected compatible rig. Test humanoid skeleton/axes, skin weighting, seam/clipping of mixed outfits, weapon-hand alignment, root-motion suppression and 350 ms approved Roll *presentation only*.
4. Produce **offline** deterministic source-derived 8-direction 160px review atlases at the actual 960×540 game arena scale. Use the same lighting and grounding as Silver Knight; compare screenshot hashes, identity continuity, grounded feet/shadow and local/remote actor poses. No generated substitute artwork and no counterfeit attacks during missing Combat clips.
5. Measure image size, p50/p95 original full-Canvas frame intervals with real Chrome/Firefox 2 and 4 genuine server actors. Owner/Art Director 3 visual acceptance is separate from synthetic automated acceptance.
6. Create separate, explicit P1 runtime integration PR **only after** above checks. UI, Combat and Core retain existing authority. Preserve current Pre-Alpha Ready-Five Silver renderer and protected gates; no automatic promotion, merge, staging, deployment, paid purchase or public release.

## Intake disposition

**This file records owner decisions and independent publisher metadata only.** As of this manifest, no Standard ZIP, raw vendor mesh, source .blend or third-party animation binary has been fetched into this branch, no hash has been calculated and no assets were integrated or deployed.

## Verified read-only intake tooling (2026-10-25)

The independent importer **does not download or unzip** anything. It is an offline archive metadata validator maintained in `scripts/graphics3a_p1_standard_intake.py`; seven small synthetic tests in `tests/test_graphics3a_p1_standard_intake.py` verify path traversal rejection, Windows paths, case collisions, the HOLD status and missing-license warnings. Protected CI invokes these assertions before the existing Combat test matrix; no mandatory test is waived.

Run this only **after acquiring the no-payment Standard ZIP from itch.io** and recording its original download URL:

```bash
python3 scripts/graphics3a_p1_standard_intake.py \
  --pack quaternius-outfits \
  --zip '/local/private/Modular Character Outfits - Fantasy[Standard].zip' \
  --output /local/private/graphics3a-outfits-audit.json
```

For other approved packs, substitute `quaternius-base`, `quaternius-ual1`, `quaternius-ual2` or `kaykit-animations`. The script records archive SHA256, total file counts, potential meshes and license filename hints; it does **not** verify the license contents, animations or rig quality. All results remain `HOLD_NOT_IMPORTED`.

**Actual acquisition checkpoint:** Standard archives remain **NOT DOWNLOADED** in this branch. The public zero-cost itch.io download flow is interactive. We attempted nontransactional retrieval on the X230i Linux dev runner, and did not find a direct static download URL; no third-party mirror has been substituted. No Source-tier purchase, archive import or mesh retarget has occurred.
