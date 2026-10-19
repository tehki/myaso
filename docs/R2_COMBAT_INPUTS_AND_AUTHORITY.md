# R2 — Responsive melee, directional dash, hold block, longer roll knockdown

Scope: owner-requested gameplay change, initially shipped with R2. The heavy
reach and LMB load changes below describe the **superseding 19 October owner
correction** (see R2_HEAVY_REACH_AND_CHARGE_RESTORATION.md). All movement and
attacks remain server-authoritative; the current production release is not
changed merely by committing source changes.

## Implemented in this branch

1. Heavy reach was briefly increased to 130 in the initial R2 build, but
   user feedback restored **82** world units against the normal light's 76.
   The active heavy now performs a short server-authoritative 24px forward
   lunge over 100ms, with real collision/bounds and unchanged painted arc.
2. **Normal LMB pointerDOWN is instant** (no delayed tap classification).
   The initial 80ms internal hold classification is necessary to upgrade the
   unlanded 135ms light into heavy *before* double damage; this timing is not
   the heavy load. The separate **320ms authoritative heavy windup** remains
   fully restored and its charge indicator is only shown after long-hold
   classification. Space+LMB jump chord and E heavy shortcut remain intact.
3. Running short-LMB pointerDOWN issues the running strike immediately;
   sustained LMB upgrades the unlanded windup to heavy. Running sprint controls, packet cadence and
   authoritative stamina remain unchanged.
4. Double-tap the **same physical WASD key** twice within 240ms (with an actual
   keyUp in between) to dash in that direction, regardless of mouse facing.
   Uses remaining bit 7 of the unchanged 34-byte input format, action code 30
   in the snapshot, 140ms dash at 750 world units/sec, costs 20 stamina.
   The server enforces a 3000ms cooldown, independent of client throttling.
   Dash is not the invulnerable mouse-directed roll; it does NOT knock players
   down, evade damage, or reset a knockdown.
5. Middle-button down holds ordinary directional block, and release/cancel/blur
   ends it. The block movement modifier is 0.5 (half ordinary move speed).
   Existing wheel-back timing still controls the short parry/feint input path.
6. Roll collision knockdown lasts 520ms instead of 260ms. Duplicate contact
   or kicking an already grounded victim cannot refresh the timer.

## Unimplemented: projectile weapon throw, F

A safe public multiplayer F throw requires a **separate server-authoritative
projectile milestone**, not a browser-only particle or a spoofed combined button.
Required acceptance contract: F sends an independently encoded edge; server
launches a projectile along mouse-facing aim, removes the melee weapon/weapon
damage and knockdowns from the thrower for 30 seconds, regenerates exactly one
weapon at expiry; projectile has bounded 15-minute lifetime or earlier collision
with real world obstacles; kicking an approaching projectile deflects it along
the kicker's server-confirmed facing; reflection ownership/damage resolved only
by the server and replicated to observers and late joiners; no infinite
projectile accumulation (cap/expiry), no duplicate F from redundant datagrams,
no ownership or score exploits. The currently implemented alpha map has no
general obstacle geometry beyond world bounds, which must be defined explicitly
before claiming obstacle collisions. Keep F disabled until the server, protocol,
snapshot replication, disarm HUD and PvP acceptance exist.

## Required release gates

- JS/Rust state transitions, protocol bit7 round-trip and rollback-safe source
  compatibility; full browser Chrome+Firefox genuine input/impact tests.
- Re-qualify R1 browser flights whose strict evidence intentionally assumed
  light commits on pointerDOWN or roll knockdowns end after 260ms. Do not just
  change expected damage or disable assertions; prove the new owner-requested
  semantics from real server outcomes.
- Exact-head full quality GREEN, independently merged-main quality GREEN, R2
  package checksum, two independent real WAN browsers, 2–8 player real combat
  and safety of neighboring VPS services. No automatic deployment in this PR.
