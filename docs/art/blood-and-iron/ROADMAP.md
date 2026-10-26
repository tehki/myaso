# Blood & Iron — G0–G4 Roadmap and Department Handoffs

**Parent:** https://github.com/tehki/myaso/issues/1065  
**Priority:** P1 planning now; **implementation AFTER Combat Pre-Alpha stabilization and separate explicit owner/Main approval**.  
**Current authorization:** G0 planning only. Not a new department, not a replacement Combat system and not production-ready.

## G0 — Decision and specification (AUTHORIZED NOW)

**Deliverable:** one documentation-only Draft PR with OWNER-DECISION.md, ART-DIRECTION.md, TECHNICAL-DESIGN.md and this ROADMAP.md; one parent issue #1065; links to existing [#344](https://github.com/tehki/myaso/issues/344), [#695](https://github.com/tehki/myaso/issues/695), [#1029](https://github.com/tehki/myaso/issues/1029), [#1030](https://github.com/tehki/myaso/issues/1030).

**Review checks:**
- Owner decision and existing October 19 Medieval Realism source linked and consistent.
- Feasibility comparison for pre-rendered eight-way variants, composited part sprites and future skeletal/3D approach.
- Proposed—not actual—minimal server-confirmed lethal visual event lifecycle, safe duplicate/delay/rejoin/respawn behavior and ordinary-death fallback.
- 3A/3B/3C/Combat4/Core8/Sound5/UI10 ownership, bounded VFX hypothesis budget and risks.
- Platform/region age/content disclosure, Off/Reduced/Full accessibility implications recorded.
- No production source, artwork, event protocol, timing, assets, live flags, tests disabled, merge or deployment.

**Exit:** G0 documents ready for Main/Combat/Core/Graphics review; this DOES NOT enable G1.

## G1 — One original lethal visual prototype (BLOCKED)

**Entry gates:** Combat Pre-Alpha 0.1 stable with mandatory exact-head protected success and explicit owner/Main **G1 authorization**; Combat/Core approve eligibility/event semantics OR the prototype is explicitly labeled offline only; Graphics3A identifies source-authored rig, license/provenance and export.

**Minimum future scope:** one authentic Silver Knight, one already-confirmed eligible lethal event, one eight-direction head separation body/head asset, one bounded directional fountain and detached head, one grounded death pose; unchanged ordinary death fallback and no changes to real hitboxes, damage, weapon pickup or timing.

**Evidence:** reproducible original editable Blender source, directional pivots, true original game-scale Chrome/Firefox source review, measured local particle/texture/frame-time cost, clear distinction between offline fixture and actual game. No public release.

## G2 — Authoritative multiplayer presentation (BLOCKED)

**Entry:** G1 accepted, Combat4 (unified engineering)/Core8A/8C approve versioned event/actor lifecycle and explicit Main authorization.

**Future scope:** real Rust/WebTransport 2-player then four-player Chrome/Firefox; server-confirmed lethal only, idempotent per event/actor, late/reordered/duplicate detection, respawn/new actor generation clearing, reconnect consistency, Off/Reduced/Full settings, damage/HP parity, no packet/input interference.

**Acceptance:** full unchanged protected quality and independent Combat4D QA at one exact source SHA, genuine browser traces/screenshot hashes and performance evidence. Main/owner accept; no gameplay semantics altered.

## G3 — Expanded gore and battlefield aftermath (BLOCKED)

**Entry:** G2 fully accepted and separate owner/Main scope approval.

**Future scope:** original left/right arm and leg lethal-only variants, additional approved collapse/death poses, temporary decals/pools on terrain and where accepted by 3B on building materials, strictly bounded cosmetic physics. No nonlethal limb injury, movement penalties, item drops or authoritative World debris without separate gameplay decision.

**Acceptance:** eight-direction artwork matching authored medieval light and real world scale, rendering depth, UI Combat readability, cross-browser cache/memory and Off/Reduced/Full parity, cleanup and source rights.

## G4 — Artistic polish, safety and distribution preparation (BLOCKED)

**Entry:** G3 accepted and Main/owner release planning approval.

**Future scope:** animation transitions, color/light balance, fine particle timing, original rights-cleared optional sound, content warnings and user preference UI, frame/input regressions on representative machines, distribution-specific content/rating disclosure (verify target platforms rather than guessing a rating), stage/rollback plan.

**Release gate:** authentic 2/4-player native Chrome+Firefox, one exact-head protected full CI, independent human Graphics3/Combat4D visual signoff and explicit Main0 + owner release GO; no independent Graphics merge/deployment.

## Ownership matrix

| Team | Current G0 action | Future implementation boundary |
|---|---|---|
| Graphics 3 — Orchestrator | Single owner decision, specification, roadmap, parent issue and Draft PR | Integration/art direction only; no protected main merge |
| 3A — Characters & Animation | Audit original 22-bone Silver source, 8-way body/head part feasibility | Authored head/limb/body death exports after approval; keep five P0 motions pristine |
| 3B — Buildings & Architecture | Study decals on stone/wood/dirt/grass and roof/facade occlusion | Surface material masks/placement agreement only; do not alter approved buildings |
| 3C — Environment & Atmosphere | Design bounded blood droplets, pool/decal lifecycle, cache/culling and perf benchmark | Cosmetic effect rendering, no new server physics |
| Combat 4 — Unified Combat engineering | Decide potential authoritative lethal-event eligibility without new rule change | Server eligibility and input/gameplay changes only through separate approval |
| Combat 4D — Independent QA | Design readability, hit/HP/death parity and browser scenarios | Independent no-regression and human visual acceptance |
| Core 8A/8C — Networking/World | Review proposed event version/id/order/reconnect/spawn-epoch and cost | Own any future wire protocol/replication; no assumed current event |
| Physics 6 | Review local cosmetic ground fall/part depth | No second authoritative physics |
| Sound 5 | Plan optional original impact/aftermath SFX brief | No G0 audio implementation |
| UI 10 | Plan Off/Reduced/Full setting, warnings and accessibility | Cosmetic-only toggle; no changed Combat mechanics |
| Main Orchestrator 0 | Prioritize P0 Combat, review cross-team G0 and G1 permission | Exclusive integration/merge/stage/deploy/rollback/GO |

## Risk and dependency register

- **P0 release risk:** Combat Pre-Alpha still has its own exact-head gates; G1 cannot be pulled into these release conditions.
- **Renderer limitation:** current Canvas/Silver atlases do not prove realtime skeletal dismemberment; original Blender layered export must be qualified first.
- **Identity/reliability:** Core must design dedupe, version, actor generation and out-of-order/reconnect semantics before native G2.
- **GPU/CPU/memory:** only proposed effect budgets exist; benchmark real Chrome/Firefox 2/4 players and use runtime quality degradation/fail closed after authorization.
- **Readability:** blood and body sprites must not hide parry, recovery, HUD or actor silhouettes.
- **Content ratings:** no assumed fixed age rating; distribution-specific review and warnings required.
- **Asset rights:** validate all external assets, Blender/project source and optional sounds before use.

## Immediate next action

Graphics Orchestrator 3 presents the **single G0 Draft PR** to Main0, Combat4 (unified engineering)/4D, Core8A/8C, Graphics3A/3B/3C and UI10 for **planning review only**. Record architectural decisions on parent #1065. Do not spawn new departments or duplicative issue trees.

**Current status: G0 documents submitted for review / G1–G4 HARD HOLD / no gore gameplay or production implementation.**
