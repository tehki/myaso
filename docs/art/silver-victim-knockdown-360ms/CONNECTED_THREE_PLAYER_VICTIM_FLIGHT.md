# Graphics 3A — genuine M153 three-player original Silver victim fall/stand animation (QA)

**Draft child of original 22-bone Blender knockdown source PR #774. No default or Pre-Alpha activation.**

Parent PR #772 proved **server-confirmed real M153 three-player non-damaging kick knockdown** from owner-approved V3 kicking art. Parent PR #774 provides genuine original Silver 22-bone editable action, 360ms, 8 poses × 8 directions, Blender artifact provenance and source-only CI. This child closes a *different* acceptance gap: does the **actual running local Rust authoritative multiplayer game** draw the original victim knockdown/recovery sprite when and only when `COMBAT_ACTION.knockdown` is reported?

## Strict fourth opt-in

```
MYASO_PVP_SCENARIO=uikickknockdownffa
MYASO_GRAPHICS3A_V3_KNOCKDOWN_FLIGHT=1
MYASO_GRAPHICS3A_ORIGINAL_VICTIM_FLIGHT=1
node scripts/pvp_browser_flight_runner.mjs
```

Native QA browser query: `?knights=1&knightKickSource=1&knightKickV3=1&knightKnockdownSource=1`. No one flag activates an unapproved victim animation; all four require explicit opt-in. `silver_knockdown.webp` is byte-identical to the first-party [Blender source atlas](original_silver_knockdown_360ms_8way.webp) in the source artwork directory. The default renderer and all prior current client/gameplay controls are unchanged.

The new clip `silver_knockdown` is selected for **actorKind=player and ONLY real already observed server action `COMBAT_ACTION.knockdown`**, not from an attacker kick sprite, a local predicted hit, or mouse click. The client may progress its 8 pose frames within the still-authenticated 360ms visual state; the server alone changes knockdown→idle, so art does not cause stun, movement, damage, teleport or state transition.

Run existing unchanged M153 real three-player W3C Chrome (kicker), Firefox (victim), Chrome #2 (spectator), preserving original short right-click, victim server `knockdown` tick, attacker `KNOCKDOWN #2` focus, original V3 kicker source and 100HP/guard all players, then check true **`CanvasRenderingContext2D.drawImage`** observations of original Silver victim atlas in all three real native browsers. Each must have at least two distinct original action frames, real source filename and 160px cropped cells; no substituted V2, fake frames, forged server IDs, disconnected actor or missing spectator accepted. The passive original atlas probe cannot modify game Canvas draw semantics or combat state.

Only true exact-head CI success with `GRAPHICS3A_ORIGINAL_SILVER_VICTIM_REAL_KNOCKDOWN` indicates genuine server-action-gated 3-browser original source proof. This **does not** establish every 8 frame observed across the short knockdown, actual floor/sole contact, proper final animation proportions, true server action start for every client, 0.84 Greyhaven city ground, gameplay readiness or human owner signoff.

The previous 360ms controlled source fall may visually **float** in the simplified arena: artist review of IK, foot plant, overlap, 0.84 camera and world physical center of mass is mandatory before any release. No live Rust/server, Combat authority, hitbox, physics or sound edits, no Pre-Alpha inclusion, no merges/deploys, no appeal for release bypass. Full mandatory `quality` remains separate and strict.
