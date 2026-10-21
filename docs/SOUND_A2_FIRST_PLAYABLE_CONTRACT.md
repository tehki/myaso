# Sound A2 — First Playable armory and equipment cues (PROPOSED; dormant)

**Owner gate:** [First Playable #480](https://github.com/tehki/myaso/issues/480), [physical four-sword armory #488](https://github.com/tehki/myaso/issues/488), [Items source of truth #460](https://github.com/tehki/myaso/issues/460). **Department:** Sound 5. **Stack dependency:** green Sound A1 [#485](https://github.com/tehki/myaso/pull/485), then this separate Sound A2 review. Do not merge a dependent child ahead of its parent.

## What exists

- `src/browser/game-audio.mjs` contains six **dormant** cue envelopes mapped only to already bundled, attributed OGG samples: `fistLight`, `fistHeavy`, `fistHit`, `swordPickup`, `swordEquip`, `swordDrop`. Existing sword light/heavy/hit, all 4 original user-approved MP3s, their balance, and combat controls are untouched. The new envelopes are **not** currently called by the online runtime.
- `src/browser/armory-audio-contract.mjs` is a pure, fail-silent browser presentation adapter with `cueForAuthoritativeStrike(equipment, action)` and `createConfirmedArmoryCueGate()`. No server, network packet codec, input handler or item ledger was modified. Unit fixtures are NOT a live four-player proof.

## Mandatory upstream contract before connecting it

1. **Combat + Items/Core:** supply a **server-authenticated player equipment mode**, represented *after validation* as `{kind:"UNARMED",itemId:null}` or `{kind:"SWORD",itemId:"<canonical immutable ID>"}`. This proposed Sound shape is **not** a deployed server schema: coordinate with Items and Core before adopting exact field names. A client pending pickup, local menu selection, or rendered sword cannot confer sword mode. Missing/invalid mode produces no new mode-dependent cue; preserve legacy sound fallback until server-owned mode is actually integrated.
2. **Items/Core authoritative receipts:** transport decoder should supply *committed events*, not requests, denials, speculative equipment states or snapshots of old events. Proposed normalized presentation shape: `{source:"authoritative",status:"COMMITTED",sessionEpoch:string,receiptId:string,actorNetId:positive integer,itemId:canonical string,itemRevision:positive safe integer,operation:"PICKUP"|"EQUIP"|"DROP"}`. The strings `source`/`status` are **NOT a security credential**: only the authenticated Core transport can originate the normalized event; never call the gate on untrusted client objects. Multiple operation records for the same item revision result in **at most one cue**. If backend revision semantics differ, adapt the Sound bridge, not the ledger.
3. **Session identity:** call `beginSession(authenticatedSessionEpoch)` after Core's handshake; re-init with a new epoch for a new authenticated session; `reset()` at disconnect. An old-epoch event or duplicate/stale per-item revision remains silent. Per-item memory has a fixed cap and fails silent instead of eviction/replay. Existing Sound A1 independently suppresses stale remote action transitions.
4. **Spatialization:** before calling `audio.play(cue,{pan,level})`, resolve `actorNetId` against the **same authoritative roster and own position**. Nearby distinct speakers get stereo panning and attenuation; missing own fighter or removed player must not emit a remote cue. Never use client-forged actor positions.
5. **Input:** Sound listens *after* the single authoritative sword-click decision and receipt; it cannot initiate `TryPickup`, invent an equip, or cancel/trigger attacks. A denied click is silent. Preserve left-click release-to-strike, roll/parry, kick/run, jump and focus accessibility.
6. **Audio:** the existing owner-approved music/ambience and foley mix remain unchanged. The new fist/equipment cues must get **owner audible approval on actual Chrome/Firefox** before runtime activation; OGG reuse/CI decoding alone does not prove mix quality.

## Strict acceptance needed for integration

- Four independent authentic players, visible four rack swords, server-owned canonical IDs and verified pickup/drop/equip ACKs.
- Four unique committed pickup events → four intentional cues; duplicate deliveries, denied clicks, historical receipt replay, stale/other-session events → no extra cues. Distinct `UNARMED` fist vs committed `SWORD` blade on actual player hit.
- Measured real Chrome and Firefox playback for **two independent client hosts** minimum, ideally four operators. Record W3C input evidence, authoritative receipt ID/revision/session, local actor/remote positions, sample output source starts, no duplicate and non-phantom sounds, while maintaining gameplay timing.
- Existing protected full quality, true multiplayer/wire/auth/ledger acceptance and deployment rollback remain mandatory.
- Current state is **EXPERIMENTAL / interface candidate**, **not wired, integrated, deployed or PLAYABLE**.

No new recording assets, purchases, payments, wallets, live item values or production routes.
