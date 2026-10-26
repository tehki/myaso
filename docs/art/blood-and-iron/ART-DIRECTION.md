# Blood & Iron — Gore Visual Art Direction (G0)

**Status:** OWNER ARTISTIC VISION APPROVED, DETAILS PROPOSED / NO RUNTIME AUTHORIZATION  
**Parent:** [#1065](https://github.com/tehki/myaso/issues/1065)  
**Extends:** [Existing medieval realism art bible](../BLOOD_AND_IRON_ART_DIRECTION_RU.md), not a replacement.

## The creative contrast

The world must remain authentic and beautiful: weathered European medieval architecture, forests, hand-authored cobblestone and dirt roads, worn timber/stone, warm taverns, directional sunlight, believable dusk and readable shadows. Violence should become especially striking by contrast with the peaceful world, **not** make every village a permanently bloody set.

Combat effects are physically informed, dramatic and intentional, rather than random visual noise. Always privilege **readable active actors, attack windup, parry, guard, incoming direction, HP and recovery cues** over any spray/debris.

## Visual principles

1. **Authority** — only server-confirmed combat outcomes receive matching presentation.
2. **Readability** — attacker, victim, timing and result must remain comprehensible at real **960×540** game size.
3. **Directionality** — blood impulse, body reactions and part movement follow approved impact direction, not guessed client-local hit confirmation.
4. **Consistency** — same original Silver Knight scale, eight directions, camera, alpha handling, ground pivot, light/shadow and medieval material palette.
5. **Performance** — capped effects and automatic cleanup; Off/Reduced/Full intensity cosmetic-only.
6. **Fallback** — regular truthful death depiction when part art, event, network, cache or effects are unavailable.
7. **Provenance** — editable original source/Blender or rights-cleared materials, reproducible exports and SHA-256 manifests; no generated mockups mislabeled implemented.

## Planned art/animation families — none claimed implemented

| Family | Art intent | 3A/3B/3C source requirements | Safe fallback |
|---|---|---|---|
| Ordinary death | Convincing authoritative collapse | Source-authored death/grounding sequence | Current default Combat death |
| Decapitation | Head separation, headless corpse and short readable fountain | 3A: 8-way original head/body cut atlases, pivots; 3C: emitter origin, particles | Ordinary death |
| Left/right arm and leg separation | Lethal-only matching body/part poses | 3A: 8-way intact/separated variants and detached pieces | Ordinary death |
| Impact spray | Directional short jets/droplets | 3C: original bounded alpha sprites and impact vector mapping | No cosmetic spray |
| Ground stains and pools | Controlled temporary battlefield aftermath | 3C: local decals by terrain type, TTL; 3B: wall/facade masks/material response | Decal omission |
| Detached part motion | Brief fall/bounce/settle | 3A sprite atlas + 3C cosmetic local motion | Fade out |
| Knockdown-to-death | Smooth visual transition without inventing state | 3A poses aligned to existing server transitions | Ordinary death |

Do not introduce nonlethal dismemberment impairments, client-owned weapon drops or gameplay penalties without separate Combat approval.

## Game-scale character authoring contract

For any future G1 source, record: original Blender/GLB provenance, bone indices and part seams, 8 camera directions and diagonal parity, frame/pixel size, exact camera/pivot, actor/world foot origin, neck/limb emitter attachment points, arm/leg silhouettes, intact body/part source hashes, alpha/premultiplication semantics, standard and dusk lighting. Verify positions under actual renderer zoom, not enlarged asset previews.

Existing five Silver source motions are Idle, Walk, Sprint, Jump and 350ms Roll on draft source #904/#922. A 22-bone original Blender source/export pipeline is demonstrated in draft #824, but **does not mean detachable anatomical part exports or a runtime gore rig exist**. Preserve all approved P0 assets.

### Initial G1 artistic minimum (BLOCKED)

One eligible server-confirmed Silver death; one head separation, one headless death pose, one visible detachable head, one restrained but dramatic short fountain and stable shadow/ground contact. No multiple character variants, weapon changes, new hitboxes or complete 31-motion animation library required. An offline art review is not native multiplayer integration.

## Environment surface and compositing

The following is a **proposed**, not existing, draw-order agreement subject to 3B/3C/UI10 review:

1. Authored opaque terrain and ground.
2. Cosmetic stains/pools projected in canonical World9 XY, without changing collision.
3. Grounded actor shadows and world-positioned actors.
4. Part/body sprites depth-sorted consistently with 3B facades, roofs, vegetation and props.
5. Bounded foreground impact droplets only where they cannot mask parry, attacker silhouettes or HUD.
6. Protected original UI/Combat tells rendered clearly on top.

Do not invent 3B building coordinates or a second shared renderer. Wall stains must respect building authored normals/material masks and approved roof occlusion, or simply be omitted until supported.

## Accessibility and mode semantics

- **Off:** no explicit anatomical gore, blood sprays/stains or gore-specific audio; still show truthful combat state and standard death/collapse.
- **Reduced:** restrained brief generic blood and lower effect density, no dismemberment imagery as appropriate for the setting/distribution profile; death mechanics unchanged.
- **Full:** owner-approved directional fountain/detachment imagery subject to measured budgets.
- Settings may alter presentation only; must not influence network actor IDs, damage, kill/respawn, input or visibility of essential signals. Switching to Off should clean/fade existing local effects safely.
- UI10 must plan player-facing warnings, reduced-motion and relevant platform age/content disclosure policy before eventual release.

## Acceptance plan (future, not performed in G0)

Real first-party Chromium/Firefox at 960×540, same source SHA and real Rust/WebTransport 2-player then 4-player, 8 facings, normal and dusk lighting, original Silver source provenance, physically correct ground/shadow, unambiguous attack/parry tells, all intensity settings, missing-asset fallback, camera motion and performance. Human visual review by Graphics3 and Combat4D. Standalone Blender stills must be labeled artist previews.

**G0 ends with documentation review only. No assets, effects or running gore feature created by this specification.**
