# Graphics 3 P1 — Greyhaven visual-only integration on the Chat C1 / Silver client

**Status:** DRAFT / OPT-IN / SOURCE-INTEGRATION ONLY / NOT A PLAYABLE ALPHA ACCEPTANCE.
**Department:** Graphics 3 Orchestrator; 3A Silver Knight, 3B architecture, 3C terrain/lighting.
**Tracks:** #1030, #344, #480. Main release owner: #360.
**Integration base:** exact Chat UX `54686ecafd5ea338e09e0633b466fc73489aa8b5` from [#1105](https://github.com/tehki/myaso/pull/1105). **Do not merge or deploy.**
**Donor:** exact [Graphics3C + World9 #648](https://github.com/tehki/myaso/pull/648) `d4f05394f6d45af59ef9cc24f8487d6b5db55f8f`. Five source modules imported by original Git blob identity without old Combat/Core/World server history.

## What this candidate actually does

Only the explicit query combination `?world=1&greyhaven=1`, **with no `scenario`**, dynamically imports the canonical World9 authored map and the source-authored Graphics3C renderer. These modules are not eagerly imported by the default Combat arena or acceptance scenarios. Their output is drawn as a *visual underlay* in the genuine authenticated `web/online-game.mjs` browser Canvas using the same reconciled actor camera, original `ARENA_VIEW_ZOOM`, Silver Knight renderer, and existing Chat C1 overlays.

- World9 source map `moonvale-overworld`: Greyhaven city footprint, authored streets and groves, unchanged Red Lion `red-lion` (4240,3880,250x170), Blacksmith `smith` (3710,3850,182x162) and other existing World-authored buildings. Door/portal data stay as authored **visual metadata only**.
- 3C deterministic bounded cobblestone/soil/grass, environmental light pool and sconce render, forest trees and tile caching (default 24 cached tiles / 3 created per visible frame).
- **Existing World9 placeholders for Red Lion and Blacksmith** in this first opt-in pass; **not** their approved realistic Blender facades. In particular, World9's immutable building replacement allowlist currently contains ONLY `red-lion`; it does NOT approve `smith`. Do not silently bypass that validator to draw a Blacksmith facade.
- Genuine original server-authenticated player positions continue to drive sprites and motion. This preview is purely local presentation, cannot change movement, collision, player world coordinates, server ticks, Combat, damage, input, items, portals, or Chat.
- If opt-in resources fail loading or the optional drawing throws, the live Combat floor still exists and the optional renderer is disabled. This is a preview safety fallback, not a claim of fully atomic transactional Canvas composition.
- Default no flags, `?world=1` alone, `?greyhaven=1` alone, and any acceptance `?scenario=...` do **not** instantiate the Greyhaven renderer. Default live Pre-Alpha remains unaffected by this unmerged branch.

## What is NOT done / why it remains HOLD

The approved original [3B Red Lion #831](https://github.com/tehki/myaso/pull/831) is a separate, old-stack draft, with original source day/dusk facade and roof, independent actor occlusion and controlled `red-lion` suppression. Do **not** blindly cherry-pick older Combat/World code. New same-source integration must port the exact three source-approved WebPs + producer provenance, World-owned replacement and the actor-depth/HUD tests.

The owner-approved original [3B Blacksmith #1073](https://github.com/tehki/myaso/pull/1073) has genuine editable Blender/alpha-preserving review sprites under `review-only/` and verified real forge-roof clearance; **not** a World9 `smith` live visual replacement, approved portal, shop or sword grant. World9/Core8C/Physics6 must approve identity, exterior visual depth, collision and occlusion before opt-in live placement.

The 3A original Silver is present in the current Chat base, but future Quaternius modular characters [#1041](https://github.com/tehki/myaso/pull/1041) are not integrated here. Future Blood & Iron gore [#1065](https://github.com/tehki/myaso/issues/1065) remains G0 planning only. Chat C1 one-message-per-Enter and unified Combat #696 must be separately qualified and remain unchanged.

**Four real authenticated Chrome/Firefox humans walking/fighting/chatting in the actual Greyhaven district are NOT yet proven.** No authentic screenshots/frame-percentile metrics are claimed by this initial source-only pass. UI drawing order in congested Combat + greyhaven occlusion requires fresh real native evidence.

## Required 3A/3B/3C and authority review

- **Graphics 3A:** sign off actual eight-direction Silver/grounding and local/remote Chat bubble visibility against world at 960×540.
- **Graphics 3B:** supply safe source-pinned Red Lion and Blacksmith overlays from approved Blender source; prove World9 identity and no collision bypass. No new gameplay portals.
- **Graphics 3C:** measure actual 2/4-player Chrome/Firefox p50/p95 frame intervals, decoded imagery, tile creation, cache/culling and day/dusk; ensure no Combat cue occlusion. No claim JS RAF equals GPU present FPS.
- **World9:** confirm `red-lion` facade/roof visualDepthY=4075 and `smith` authored binding and safe allowlist extension through its owner; verify canonical actor/geometry collision.
- **Core8A/8C / Physics6:** confirm approved authoritative World map/spawn/collision alignment. The current Combat server may permit walking through visually drawn buildings; visual replacement cannot be considered traversable/complete without exact authoritative proof.
- **UI10 / Combat4D:** verify chat HUD and LMB/parry/guard/windup/HP readability, independent from renderer; Combat 4 owns #696 M59/gesture fixes.

## Gated acceptance (NOT yet satisfied)

1. Same-head Node focused + full protected quality; never bypass M-series.
2. Original Chrome & Firefox game-scale 960×540 screenshot and trace proof at 2 and 4 authenticated WebTransport actor IDs.
3. Genuine server-position-based travel in the authored World9 street outside Red Lion with enforced reviewed static collision; no teleport/fake actor/ignored obstacles.
4. Real 3B original Blender Red Lion and Blacksmith source assets loaded under approved replacement contract, distinct day/dusk, successful native occlusion and HUD.
5. Performance: same machine/browser/head p50/p95 RAF and drawing cost baseline vs opt-in, cache budget and fallback, asset hashes, documented hardware and sample counts.
6. Identical current Chat C1 one-message-per-Enter and Combat #696 tests; renderer must never import or replace game authority.
7. Explicit Main0/owner release GO, supported rollback, staging and post-deploy functional acceptance; **not** authorized by this Draft.

**Next engineering step:** Run the focused new source-integration tests, inspect exact-head protected CI, then separately port actual source-approved Red Lion art with stable World9 actor-depth and rollback tests. Coordinate Blacksmith `smith` visual identity/occlusion with World9 rather than inventing it.

## Graphics 3B child — original Blender Red Lion source integration candidate (2026-10-29)

This section describes the **separate child Draft branch** `graphics3/p1-redlion-source-20261029`. The parent P1 #1106 still intentionally draws World9 placeholders; do not confuse their source SHAs or acceptance.

Exact original Red Lion donor: [Graphics3B #831](https://github.com/tehki/myaso/pull/831), immutable original Blender A2.32 source `da5664b015bb1f76b1c60482b5009a6fd5fb7487`; its 3 original day/dusk/roof WebPs and `src/browser/red-lion-live-art.mjs` copied by immutable same-repo Git blob IDs. Red Lion module validates SHA256 of **all three original image bodies** and exact decoded source dimensions before the World9 `red-lion` placeholder may be suppressed. Any failure returns the default World placeholder, never an unapproved building.

Opt-in **`?world=1&greyhaven=1&redlion=1`**, optionally **`&dusk=1`**. Default P0 arena and plain `?world=1&greyhaven=1` remain unchanged. The 3B adapter stages World-replacement and facade offscreen with canonical camera before publishing pixels; paints genuine World-authored remote actors behind, then source facade/roof, then actors in front, and suppresses only actually covered enemy HUD/edge markers. Camera/actor XY are sampled from existing real server state, not invented. Red Lion visual depth Y=4075, entrance Y=4060 and portal Y=4075 are **distinct**, and no portal is made interactive. Original module is lazily imported only when the exact flags are provided; it carries no new network/World/Combat implementation. Original source RGB/day-dusk content retained byte-identical. See original 3B fixture contract; this new child has **not yet passed real native browser or performance qualification**.

**Known open items:** UI10 Chat bubble visibility for occluded actors, signed collision legal movement, bright/dusk native Silver readability, exact-head source/quality, genuinely authenticated four players in exterior World, 3C street tree occlusion/lighting, decoded texture/cache frame cost, source artifact evidence and rollback. No claimed native first-party Greyhaven screenshot from this child yet.

**Blacksmith remains a World9 placeholder** until Core8C/Physics/World9 authorize a `smith` named facade replacement; its approved original R4 Blender [3B #1073](https://github.com/tehki/myaso/pull/1073) portable WebPs may be reviewed separately, not inserted over a World9 solid without permission.

**Gore Blood & Iron #1065 remains G0 planning.** P1 work is a Draft source branch; no merge or production deployment.
