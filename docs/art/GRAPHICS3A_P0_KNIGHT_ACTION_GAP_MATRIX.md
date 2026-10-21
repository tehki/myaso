# Graphics 3A — P0 Silver Knight 31-action authentic animation gap matrix

**Scope and baseline:** `main` `COMBAT_ACTION` 0–30 from `src/browser/combat-readability.mjs`; real original Silver/T1 atlas list from `web/knight-sprites.mjs`; authoritative durations from `src/combat/model.mjs`. Audit is source-only. No Combat, client renderer, item grant, NPC identity or server changes.

**Status: 4/31 numerically mapped to original Silver art; 27/31 currently MISSING the required authored Silver action clips.** Even the four mapped states are NOT a proven integrated gameplay/ground-contact pass; roll art and pickup equipment remain separately on visual HOLD.

| ID | Server action | Family | Silver source clip | Source authoring / eight directions | Server phase / ms | Status | Next action |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 0 | `idle` | locomotion | silver_idle (4×8 atlas) | 8/8 if authored | until movement/action | AUTHORED SOURCE / still QA-required | verify-grounding |
| 1 | `attackWindup` | light-attack | **none** | 0/8 if authored | 135 | **MISSING — truthful Combat fallback only** | author |
| 2 | `attackActive` | light-attack | **none** | 0/8 if authored | 80 | **MISSING — truthful Combat fallback only** | author |
| 3 | `attackRecovery` | light-attack | **none** | 0/8 if authored | 255 | **MISSING — truthful Combat fallback only** | author |
| 4 | `dodge` | roll | silver_roll (8×8 atlas) | 8/8 if authored | 170 | AUTHORED SOURCE / still QA-required | correct-contact |
| 5 | `dodgeRecovery` | roll | silver_roll (8×8 atlas) | 8/8 if authored | 180 | AUTHORED SOURCE / still QA-required | correct-contact |
| 6 | `block` | defense | **none** | 0/8 if authored | 240 | **MISSING — truthful Combat fallback only** | author |
| 7 | `stunned` | disruption | **none** | 0/8 if authored | authoritative cause-dependent | **MISSING — truthful Combat fallback only** | author |
| 8 | `dead` | death | **none** | 0/8 if authored | respawn follows 1250ms | **MISSING — truthful Combat fallback only** | author |
| 9 | `heavyAttackWindup` | heavy-attack | **none** | 0/8 if authored | 320 | **MISSING — truthful Combat fallback only** | author |
| 10 | `heavyAttackActive` | heavy-attack | **none** | 0/8 if authored | 100 | **MISSING — truthful Combat fallback only** | author |
| 11 | `heavyAttackRecovery` | heavy-attack | **none** | 0/8 if authored | 420 | **MISSING — truthful Combat fallback only** | author |
| 12 | `kickWindup` | kick | **none** | 0/8 if authored | 90 | **MISSING — truthful Combat fallback only** | kick-blender-8way |
| 13 | `kickActive` | kick | **none** | 0/8 if authored | 70 | **MISSING — truthful Combat fallback only** | kick-blender-8way |
| 14 | `kickRecovery` | kick | **none** | 0/8 if authored | 220 | **MISSING — truthful Combat fallback only** | kick-blender-8way |
| 15 | `jump` | jump | silver_jump (6×8 atlas) | 8/8 if authored | 430 | AUTHORED SOURCE / still QA-required | verify-grounding |
| 16 | `jumpAttackWindup` | jump-attack | **none** | 0/8 if authored | 105 | **MISSING — truthful Combat fallback only** | author |
| 17 | `jumpAttackActive` | jump-attack | **none** | 0/8 if authored | 105 | **MISSING — truthful Combat fallback only** | author |
| 18 | `jumpAttackRecovery` | jump-attack | **none** | 0/8 if authored | 290 | **MISSING — truthful Combat fallback only** | author |
| 19 | `knockdown` | disruption | **none** | 0/8 if authored | source event-dependent | **MISSING — truthful Combat fallback only** | author |
| 20 | `feintRecovery` | defense | **none** | 0/8 if authored | 270 | **MISSING — truthful Combat fallback only** | author |
| 21 | `runningAttackWindup` | running-attack | **none** | 0/8 if authored | 160 | **MISSING — truthful Combat fallback only** | author |
| 22 | `runningAttackActive` | running-attack | **none** | 0/8 if authored | 90 | **MISSING — truthful Combat fallback only** | author |
| 23 | `runningAttackRecovery` | running-attack | **none** | 0/8 if authored | 310 | **MISSING — truthful Combat fallback only** | author |
| 24 | `attackLeftWindup` | directional-attack | **none** | 0/8 if authored | 135 | **MISSING — truthful Combat fallback only** | author |
| 25 | `attackLeftActive` | directional-attack | **none** | 0/8 if authored | 80 | **MISSING — truthful Combat fallback only** | author |
| 26 | `attackLeftRecovery` | directional-attack | **none** | 0/8 if authored | 255 | **MISSING — truthful Combat fallback only** | author |
| 27 | `attackRightWindup` | directional-attack | **none** | 0/8 if authored | 135 | **MISSING — truthful Combat fallback only** | author |
| 28 | `attackRightActive` | directional-attack | **none** | 0/8 if authored | 80 | **MISSING — truthful Combat fallback only** | author |
| 29 | `attackRightRecovery` | directional-attack | **none** | 0/8 if authored | 255 | **MISSING — truthful Combat fallback only** | author |
| 30 | `dash` | dash | **none** | 0/8 if authored | 140 | **MISSING — truthful Combat fallback only** | dash-blender-8way |

## First real source/atlas deliverables (owner directive #542)

**Kick:** build a first-party editable 22-bone Silver Blender source containing distinct 90ms anticipation, 70ms contacting leg kick, 220ms return; export original transparent 160px frames for *all 8 directions* and decode in native Chrome/Firefox. **Dash:** separate physically believable 140ms leaning/lunging animation (not looped sprint or 350ms roll), eight directions and no fake visual displacement from the Combat hitbox. Start with actual Blender action clips; never claim readiness from a fallback, rig JSON, tests, or unreviewed atlas alone.

**Visual phase sync:** local and remote **human** Silver use the same authoritative action-state/phase. Local input intent, prediction or packet retry are NOT accepted action events. Combat/Core controls 170ms dodge +180ms recovery, 140ms dash, kick 90/70/220; do not alter server movement or hitboxes to match art. Original T1 Sentinel sprite attack/block is available only for a verified NPC, not a remote human. Source Silver has `silver_walk` and `silver_sprint` as **idle-state locomotion** (speed-based), not separate numeric Combat actions.

## Non-enum events and interactions — DO NOT counterfeit receipts

| Interaction / event | Authoritative source | Current authentic Silver state | Action needed |
| --- | --- | --- | --- |
| Run/sprint | verified movement + speed while action 0 | `silver_walk` / `silver_sprint` (8-way), grounding QA open | start/stop transitions, slide metrics |
| Confirmed parry / guard-break / hit | verified Combat/Core outcome, not a new enum number | no dedicated first-party Silver atlas | design outcome-specific reaction; never predict success |
| Death→new spawn | verified Combat/Core transition | no death/respawn art | defeat/get-up/reset, prevent old pose on new actor |
| Pickup/reach/grip | verified **Items/Core committed world→MainHand** receipt (not click) | MISSING authored pickup; no live public ACK | author 8-way reach now, trigger only on approved accepted receipt |
| Equip/unequip/sheathe/drop | canonical actor-bound Core/Items current item snapshot + monotonic revision | no complete authentic grip transitions; sword review only | align physical held/original 3B item visuals; avoid double sword |
| Open/interaction | actually implemented World/Core confirmed event | no authenticated Silver clip | do not invent unimplemented door/game mechanic |

## QA and release gates

All 31 action values and unknown values must be explicitly covered by tests. Art must include Blender editable clip, first-party atlas, eight directions, natural anticipation/contact/recovery, foot/ground/shoulder silhouette, true camera 0.84 / 120% Standing 96px / Roll 134px, real native Chrome and Firefox preview, and at least one **authenticated `online-game.mjs` local + remote Silver** acceptance for each P0 action family. Current source-only previews are insufficient for PLAYABLE. No NPC relabeling, no pre-commit item visual, no protected CI bypass, no autonomous merge or deployment.

**Order:** Kick + dash original source PR first; then directional/light/heavy/running/jump attack; guard/parry and disruption/death; P1 pickup/receipt integration; P2 adult masculine/feminine separate. The original adult work [#421](https://github.com/tehki/myaso/issues/421) remains active but not an Alpha release gate.

**Owner/coordination:** Graphics 3A + [#542](https://github.com/tehki/myaso/issues/542), [#344](https://github.com/tehki/myaso/issues/344); central [#360](https://github.com/tehki/myaso/issues/360); Alpha [#480](https://github.com/tehki/myaso/issues/480). **Readiness: MATRIX IMPLEMENTED/TESTABLE; 27 ANIMATION STATES MISSING; INTEGRATION BLOCKED.**
