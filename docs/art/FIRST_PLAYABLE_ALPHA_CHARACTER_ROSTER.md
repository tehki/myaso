# Moon Games — First Playable Alpha character roster

**Owner decision 2026-10-21 — P0 presentation priority.**

| Real gameplay actor | Alpha art | Availability |
| --- | --- | --- |
| Authenticated **human player**, including **other clients over multiplayer** | **Silver Knight** | Approved default visual target, pending real renderer CI/merge |
| Authoritative **NPC** | **T1 Sentinel** | Approved NPC visual target **only if NPC presence is deliberately enabled** |
| Adult masculine / adult feminine body prototypes | **Not an Alpha playable skin** | Continue development, preview/testing only; no default activation |

The role is an **identity/gameplay type**, not a network viewpoint. The existing Knight prototype [#326](https://github.com/tehki/myaso/pull/326) uses `remote` to select T1. **That is incompatible with this owner decision:** another authenticated human in the shared world must look like a Silver Knight. The fact that the server streamed its fighter as a remote actor does not make it an NPC.

## Integration boundary

- `src/browser/first-playable-character-roster.mjs` is a tiny **read-only visual policy**, not an active game renderer or verified role authenticator.
- Core supplies the **authenticated player vs server-owned NPC type** in a versioned, validated session/roster contract. UI/query strings, client-only guesses, player-controlled display names, `netId`, `remote`, actor index and actor appearance payloads **cannot** manufacture an NPC or change a player to an NPC.
- **All player fighter sprites must use Silver**: local + remote. For missing Silver attack/block/kick/hit/death art, fall back to the existing **truthful Combat renderer** with unchanged input/action/hitboxes; do NOT reuse T1 NPC attack/block art for remote human players.
- **Sentinels are NPCs only.** Graphics 3A owns T1 source/atlases and art adapter; AI & NPCs owns NPC roster, movement behavior and availability; Core 8A owns authoritative replicated NPC identity and types. Do not draw NPCs from ordinary remote fighter snapshots. A `npc` kind provided by a client query or generic remote actor must be rejected.
- **First Playable does not depend on NPC presence.** AI department's [pilot #353](https://github.com/tehki/myaso/pull/353) is draft, opt-in and loopback-only. No new public NPC server/port/protocol enabled by this policy. If NPCs cannot be safely enabled in the first release, **players still all render Knights and the first playable remains valid with no Sentinels present**.
- Adult masculine/feminine source work [#423](https://github.com/tehki/myaso/pull/423) → [#433](https://github.com/tehki/myaso/pull/433) → [#448](https://github.com/tehki/myaso/pull/448) → [#457](https://github.com/tehki/myaso/pull/457) → [#472](https://github.com/tehki/myaso/pull/472)/[#487](https://github.com/tehki/myaso/pull/487) remains isolated. Human art review and source-accurate roll/grounding are still on hold. Do not ship bare adult source atlases in Alpha via an alternate URL flag.

## Appearance is not physical inventory

The Silver Knight represents an **Alpha presentation skin**, not proof that an item or armor slot is equipped. This policy cannot grant a sword, physical armor, attack damage, armor mitigation, inventory currency or gameplay item identity. The separate Magic/Items empty-start and equipment authority remains authoritative; the future adult paper-doll layer is unrelated to this temporary roster.

## Required validation before active integration

1. Graphics 3A updates the **opt-in** Knight renderer contract to accept **explicit authoritative actor kind** rather than using `remote` as an asset-class selector. Preserve 120% 96px idle/134px roll and 350ms visual roll, authentic frame timing and truthful fallback for unsupported local and remote player actions. No sprite remapping based on screen/client location.
2. Unit tests: local player Knight; **two other independent remote player IDs both Knights**; server NPC Sentinel; unknown/forged/unspecified roles fail closed; jump/attack/guard/knockdown/death preserve truthful fallback; sprite atlas decode failures do not hide combatants.
3. Real Chrome+Firefox staged acceptance with **two authenticated players** in the same authoritative world, each appearing Silver locally and remotely, no Sentinel except real server NPC if separately approved. Walking, rolling, attacking, hit reaction and respawn, no altered hitboxes or network messages. Capture evidence.
4. Core+AI approve an explicit NPC entity/roster source and visible fallback before exposing any Sentinel. No NPC pilot enabled by this PR.
5. Exact-head full protected quality, central [First Playable #480](https://github.com/tehki/myaso/issues/480) and [Development Center #360](https://github.com/tehki/myaso/issues/360) integration approval, staging/rollback. No independent merge/deploy.

**Implementation status:** this PR encodes the alpha roster and tests **only**. Runtime in `main` remains untouched; Knight #326 and NPC #353 are unmerged draft/opt-in experiments. Do not claim the game already renders these roles or is playable until actual multi-browser acceptance.
