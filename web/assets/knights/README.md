# Silver Knight — Pre-Alpha 0.1 Source-Authored Subset

## Scope (Main Orchestrator, October 21 2026)

This directory contains exactly five immutable **existing original** Silver Knight WebP
atlases selectively copied from Graphics 3A PR #497
\`25f8cdd7b207ec1ecb51f38b96dafa74298e341a\`, itself based on original
Blender/authored sprite work in #326 / truthful fallback #408.

| Atlas | Original source SHA-256 | Genuine source grid |
|---|---|---|
| silver_idle.webp | 828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4 | 4 × 8 × 160px |
| silver_walk.webp | 8fd421ea2d96a38a70afd9e05bec1297e90bffd8fde586a79c6a0907413adbb7 | 8 × 8 × 160px |
| silver_sprint.webp | 3ec5b5c2b6a24d8bbad3639984f2020bec0519be08f8021be30d8d20b1e9f271 | 8 × 8 × 160px |
| silver_roll.webp | 31c774ac930a5cf1060640f1fc2914b02d6d5ddccd7d56591123efd098909426 | 8 × 8 × 160px |
| silver_jump.webp | b73c506ad886fe68e01c834b36bb18ea951edd8327dfb8532c2eb0450dbc2e14 | 6 × 8 × 160px |

These are **original authored art files**, not generated replacement artwork.
No owner source GLB or .blend binary has been redistributed or modified.

## Strict active behavior

- Current authenticated **online arena player roster** passes \`actorKind: "player"\` for
  both local and remote fighter snapshots. It is NOT inferred from network locality.
- Defaults on in the **Pre-Alpha online arena candidate only**; \`&knights=0\`
  is an explicit non-production visual rollback path.
- Exact original idle/walk/sprint, **350ms roll/recovery** and jump clips
  only. Single 120% reviewed scale. Eight-direction rotation uses real facing.
- Unsupported kick/attack/block/stun/knockdown/death/jump-attack states return
  null to existing authoritative Combat-circle and native telegraph renderer.
  This is intentionally truthful: **do not fake an attack with walk/idle art**.
- No Spartan kick atlas from Graphics PRs #611/#617 included: its original
  source/phase in-game validity remains visual HOLD, even though the owner
  approved the motion direction.
- No T1 Sentinel, other NPC, adult, magic, Greyhaven, item, sword or inventory
  sprite is included. Explicit fallback omits old unowned sword-shaped glyph
  when the Knight renderer is active; actual game attack telegraph is preserved.
- No Combat damage/HP/stamina/hitbox/timing, network protocol, input or session
  authority code modified in this renderer integration.

## Status and release gates

This is a **source implementation + deterministic test candidate**, not verified
real multiplayer Silver Knight gameplay. Department Graphics 3A, Core 8A,
Combat 4 and UI 10 must qualify on genuine Chrome and Firefox players:
both local and remote are Silver Knight on real authoritative idle/movement,
roll/jump; unsupported Combat phases remain visually legible and truthful;
no character art silently hides attack/parry/kick/recovery/death cues;
no unauthorized item appearance. Run full protected exact-head CI, paired
native human acceptance and one Main Orchestrator combined release candidate.
Public release and main merge are not authorized by this file.
