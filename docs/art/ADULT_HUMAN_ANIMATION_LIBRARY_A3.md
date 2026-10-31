# Graphics 3A A3 — Reusable Human Animation Contract

**Owner direction (2026-10-31):** park Silver Knight-specific work; build the reusable adult human animation system first; apply the qualified library to Silver Knight later. Existing Silver PRs and original assets remain preserved and parked.

**Stack:** A3 is a source-only child of the existing adult human R4 study [#487](https://github.com/tehki/myaso/pull/487), which carries the A0/A1/A2 and R1/R4 review sources. It does not modify or activate the Silver Knight.

## Existing first-party human foundation

- **A0 #433:** original editable adult masculine/feminine Blender sources, 22-bone rig, eight-direction idle.
- **A1 #448:** the same rig and original sources with separate walk/run actions and eight-direction atlases.
- **A2 #457:** separate 350ms forward-roll source action and eight-direction atlases.
- **R3/R4 #487:** CC0 MakeHuman anatomical source meshes on the same 22-bone rig. The R3/R4 GLBs retain real `idle`, `walk`, and `run` source actions, plus separate R3/R4 roll candidates. The anatomical locomotion actions do **not yet** have their own approved atlases or ground-contact review; the R4 roll remains visual HOLD.
- **R1 #472 / R4 #487 review:** genuine standalone Chrome/Firefox review evidence, not live Greyhaven or gameplay acceptance.

The shared source rig is **adult-human-22-v1**, with 22 named bones and the canonical eight directions: south, southwest, west, northwest, north, northeast, east, southeast. A3 tests verify the original A0/A1/A2/R3/R4 GLB joint names against this contract. A0/A1 atlases remain procedural-study previews; do not mistake them for final anatomical body art. The later R3 MakeHuman CC0 body is the preferred anatomical base for the reusable library, but its existing locomotion actions still need new renders and grounding review.

## A3 engineering change

1. Add a single source-animation clip registry for both adult body presentations.
2. Keep A0 Idle and A1 Walk/Run explicitly source-preview-only; their source art and gameplay grounding are not approved.
3. Keep A2 and R4 Roll as explicit, separately selected visual-hold variants. No implicit selection between them.
4. Add a generic timeline sampler that uses the actual authored sample timestamps rather than assuming uniformly spaced atlas cells.
5. Correct the dormant A2 roll preview helper to use the actual Blender source keyframes **1, 3, 5, 7, 9, 11, 15, 22 at 60fps**, giving **0, 33.333, 66.667, 100, 133.333, 166.667, 233.333, 350ms**. The 170ms dodge-to-recovery boundary remains unchanged; the sample index does not reset.
6. Missing actions resolve to null. The library does not invent Idle, Walk or Roll substitutes for unsupported movement/combat/item actions.

## Current coverage truth

| Clip group | Status | Source |
|---|---|---|
| Idle | Authored preview only | A0 |
| Walk / Run | Authored preview only | A1 |
| Roll | Source visual HOLD | A2 and R4 variants |
| Start / Stop / Turn | Missing | Not authored |
| Jump / Fall / Land | Missing | Not authored |
| Attack / Block / Parry / Kick | Missing | Not authored |
| Hit / Stun / Knockdown / Death | Missing | Not authored |
| Pickup / Equip / Unequip / Drop | Missing | Not authored |

No clip in this contract is marked production-active. The generic timeline sampler requires explicit source times; it does not guess cycle duration for Idle/Walk/Run.

## Next art milestone

**A4 — Human Jump / Fall / Landing**, on the same reusable 22-bone rig for both body presentations, with editable Blender source, independent GLB re-import, eight-direction 160px frames, source-time manifests, reproducible WebP atlases and real Chrome/Firefox source-preview evidence. It must measure root/foot anchors through takeoff, airborne and landing phases; source renders alone do not prove in-game floor contact.

Then author Start/Stop/Turn transitions and remaining action groups as separate reviewable source PRs. Do not build a massive all-actions branch.

## Hard boundaries

- Source and review tooling only; not imported by `web/online-game.mjs`.
- No Silver Knight edits, renderer integration or activation.
- No Combat, Core, World, hitbox, server movement, input, network or Chat changes.
- No false hit/parry/death/pickup/equipment visuals.
- No production activation, merge or deployment without Main authorization and the required independent art/browser qualification.
