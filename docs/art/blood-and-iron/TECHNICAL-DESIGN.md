# Blood & Iron — Technical Architecture Proposal (G0)

**Status:** SPECIFICATION ONLY. Not an implemented protocol, renderer, event handler, physics system or asset.  
**Parent:** https://github.com/tehki/myaso/issues/1065  
**Authority:** Graphics3 proposes; Combat4C/Core8A/8C review event/authority; Combat4D validates; Main0 authorizes G1+.

## Current baseline and constraints

Verified protected main `6fa59b649112c272bcbc018b4a32bf963f9a5bba` uses Rust World authority, WebTransport, the original browser Canvas 2D `web/online-game.mjs`, a 960×540 canvas and original attack/defense/HUD cues. Source-approved Silver Knight five-motion eight-direction sprite assets, lighting, foot pivot and original 22-bone Blender authoring are in **separate draft stacks** #904/#922/#824 and cannot be presumed merged.

**Invariant:** all damage, death, attacker ownership, hitboxes, movement, timing, guard, parry, recovery, respawn and actor replication belong to the current Combat/Core system. Graphics receives confirmed results and renders them. No new source of combat truth, no change to 450ms recovery-punch window, and no extra physics or gameplay engine authority.

## Renderer feasibility study

| Candidate | Advantage | Limitation | Decision for future prototype |
|---|---|---|---|
| Pre-rendered eight-way original Blender body/death sprite variants | Matches existing Canvas pipeline, reproducible, lighting/scaling controlled | Large number of variants, difficult part seams | **Preferred** first body/headless pose |
| Composited eight-way detachable parts and local Canvas FX | Small isolated change, camera/pivots can match Silver art; no engine migration | Joint coverage, overlapping limbs and atlas correctness need careful review | **Preferred** small G1 head-piece treatment |
| Full runtime 3D/skeletal dismemberment | Flexible future geometry/death blending | Current renderer does not provide this; substantial engine, browser and QA cost | Research only, no adoption |
| Bounded simple Canvas blood/ground decal manager | Small original sprite/palette sprites, existing depth/terrain basis | Draw calls, overdraw, allocation/texture and visibility risks | **Preferred** 3C proposal; measure first |

**Recommendation to be reviewed, not authorized:** original 8-direction body/head sprites + tiny composited detachable-part layer and bounded client-local particles/decal manager. Do not silently introduce WebGL/Unity/Godot or a second shared renderer.

## Proposed event envelope — illustrative ONLY

This schema is **not an existing WebTransport/World protocol**. Combat4C and Core8A/8C must approve semantics, carrier, serialization and source ownership before any implementation.

~~~json
{
  "event_type": "combat_death_visual",
  "event_version": 1,
  "event_id": "server-unique-id",
  "victim_actor_id": "actor-id",
  "victim_spawn_epoch": 4,
  "attacker_actor_id": "actor-id",
  "server_tick": 123456,
  "lethal": true,
  "visual_variant": "decapitation",
  "impact_direction": [1, 0],
  "effect_seed": 12345
}
~~~

### Required server/client contract properties

1. Only a server-confirmed lethal outcome may create a lethal visual event. No cosmetic eligibility inferred from local swing, predicted HP or apparent head impact.
2. Combat owns whether and which future lethal variant is eligible. G0 does not define new damage multipliers, hit locations, limb injury, weapon drop or execution gameplay.
3. Core chooses event identity and replay/ordering; event_id and spawn epoch are **proposed concepts**, not guarantees of current wire availability.
4. Validate event version, actor identity/epoch, server tick, finite direction, bounded seed and allowlisted variant. Unknown or malformed data safely drops to ordinary death/no-effect.
5. Bounded dedupe keyed on (event_id, spawn epoch); retransmission must not generate extra fountains or parts. Actor-ID reuse/respawn fences older events.
6. Current authoritative actor death state must agree with the event; when it does not, do not display irreversible dismemberment. Avoid predicting death from a visual frame.
7. Late/duplicate/reordered events cannot resurrect, contradict respawn or attach to another incarnation. Rejoining clients first render authoritative living/dead state; residue is optional cosmetic, not persisted World fact.
8. Define **one** lifecycle owner so snapshot death and visual event cannot independently double-spawn an effect.
9. Cosmetic object seed permits deterministic-enough local effects; do **not** send each blood droplet or detached-piece position. Server input/snapshot cadence always takes priority.
10. Gameplay must continue identically with visual setting Off, unsupported version, missing FX asset or renderer crash.

## Future cosmetic VFX pipeline (not coded)

- Consume a Core-approved **readonly** confirmed event. Check actor generation, authoritative dead status and dedupe.
- Resolve authentic source Silver atlas direction and emitter pivots (defined and exported by 3A).
- Determine view-local Off/Reduced/Full budget, spawn a bounded seeded short jet/part/death pose only if assets are qualified.
- Cosmetic detached-part physics: gravity, optional initial impulse, simple local ground interaction, bounded bounces and slide, automatic TTL. Parts are never authoritative colliders, damage sources, inventory items, loot or server actors.
- Draw decal/pool on locally cached ground surface; depth sort actor and parts with existing terrain/building/foliage. HUD, parry, attack and offscreen tells remain readable.
- Cull offscreen effects; cap active counts; clean on TTL, respawn, actor generation change, memory pressure and Off setting.
- Fallback to truthful standard death/vanilla Combat renderer on any error. No blocking render loop or state writes to Rust World.

### Visual layer/ground ownership

3C owns particles, stain cache, emitter physics and culling, but cannot invent World9 XY geography or alter server collision. 3B owns building surface decals and material/roof clipping agreements. 3A owns original cut pieces, body variants, 8-way source lighting, and foot/neck/limb pivots. UI10 decides safe overlays and player settings. Physics6 reviews cosmetic projection; Combat/Core exclusively define gameplay and actor authority.

## Resource budgets — preliminary hypotheses, NOT acceptance limits

Use real native **no-gore** baseline first: current #1035 2/4-player Chrome/Firefox measurements distinguish RAF intervals and floor blit p95 from GPU-present FPS. Do not borrow numbers across source SHA or machines.

| Hypothetical future initial cap | Proposal | Caveat |
|---|---:|---|
| Max visible blood droplets | 120 | Drop excess instead of allocating |
| Max detached parts per viewport | 6 | Oldest fade first |
| Max temporary stains/pools | 32 | World-local visual cache only |
| Spray TTL | 1.5 s | Fade or clear |
| Detached part TTL | 8 s | Include settle/cleanup |
| Ground stain TTL | 20 s | Do not persist server-side |
| Additional decoded FX texture memory | 12 MiB | Reuse atlases; profile device |
| Additional FX CPU/draw p95 cost | 1.0 ms/frame | Must be measured, separate from RAF |
| Network event overhead | One bounded approved event per eligible death | Byte/rate policy to be defined by Core |

**These are proposed experiment knobs, not measured capacity or release PASS thresholds.** Revise with controlled source-identical baseline vs Full/Reduced/Off on Chrome/Firefox, 2/4 genuine actors, original 960×540 game canvas, explicit host/browser versions, sample counts, perf instrumentation, p50/p95 RAF and draw costs, texture cache, render-clock debt and input responsiveness. Target 60 FPS is aspirational, not automatically observed; never report JS frame interval as GPU-present FPS.

## Future test architecture (not executed in G0)

Pure unit/state checks: no gore on nonlethal, unknown/invalid payload, version mismatch, duplicate, reordered/expired/spawn-mismatched events; settings only affect visuals; cleanup always bounded; deterministic seed and direction/clip pivot; missing assets return truthful original death. Run full original protected Combat tests unchanged.

Native tests: original Rust/WebTransport genuine Chrome/Firefox two-player then four-player, actual confirmed kill and HP/death, no visual before confirmation, exact actor identity, late/dropped/duplicate/rejoin/respawn safety, 960×540 screenshots, eight facing source orientation, environment lighting, effect budget/culling and same-head full CI. Human Graphics3/Combat4D art/readability acceptance required.

## Risks / decision requests

| Risk | Mitigation / owner |
|---|---|
| Original Silver atlas lacks detachable layers | 3A audit original 22-bone editable Blender and perform **future authorized** one-character eight-way export |
| Effects obscure attack/parry tells or cause expensive overdraw | 3C capped per-viewport manager, safe layers/fallback; Combat4D native visual check |
| Events duplicated/reordered, actor ID reused | Core8A/8C negotiate server-confirmed event identity, spawn-epoch fencing and reconciliation |
| Missing textures/invalid alpha/lighting | 3A/3B/3C immutable manifests, fallback, native original-source screenshots |
| Violent content rated differently by platform/region | UI10/Main later verify ESRB/PEGI/IARC/store disclosure; no unverified rating claims |
| Scope creep delaying Combat release | G0 docs only; Main+owner G1 gate, no P0 dependency |
| Client FX coupled to authoritative physics/loot | Explicit cosmetic-only state, Physics6/Items2B review where applicable |

### Required decisions before G1

- Does Combat supply a versioned eligible lethal classification or must G1 remain explicitly offline fixture-only?
- Which Core replication/event channel and spawn-generation fencing are safe and nonblocking?
- Which approved Silver source/mesh and rig can produce genuine body/head layers at current original game projection?
- What platform default for Off/Reduced/Full and content warning is appropriate for distribution?
- Which controlled benchmark is the accepted baseline for CPU, memory, frame and input regression?

**G0 exit is documentation review. No source code, runtime event or gore renderer approved by this technical proposal.**
