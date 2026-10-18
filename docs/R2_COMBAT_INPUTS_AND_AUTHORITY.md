# R2 — Responsive melee, directional dash, hold block, longer roll knockdown

Scope: owner-requested gameplay change. Staged and **not a production release**.
All new movement/attacks must remain authoritative. Previous R1 timings and test
fixtures are not silently accepted as R2 facts; CI must requalify true W3C combat.

## Implemented in this branch

1. Heavy melee reach: 82 → 130 world units (plus 18px fighter hit radius).
   Server's actual target-center reach is therefore 148, matching the visible
   arc; light reach remains 76+18=94. Angle, windup, damage, i-frames and
   hit-target deduplication are otherwise unchanged.
2. LMB pointerDOWN queues a light immediately, rather than waiting for
   pointerUP to distinguish tap vs hold. A continuous LMB hold for 80ms upgrades
   **only the still-unlanded** light/running-attack windup to the existing
   320ms heavy attack. The light must not also score damage. Space+LMB jump
   chord stays a light/jump action, not an accidental heavy. E heavy shortcut
   remains. This resolves the fundamental tap-vs-hold timing tradeoff by
   permitting a short *authoritative windup conversion*, not speculative damage.
3. Running + immediate LMB remains the existing running strike, and running +
   sustained LMB can upgrade before hit to heavy. Running sprint controls,
   60Hz packets and stamina source of truth remain unchanged.
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
  light commits on pointerUP or roll knockdowns end after 260ms. Do not just
  change expected damage or disable assertions; prove the new owner-requested
  semantics from real server outcomes.
- Exact-head full quality GREEN, independently merged-main quality GREEN, R2
  package checksum, two independent real WAN browsers, 2–8 player real combat
  and safety of neighboring VPS services. No automatic deployment in this PR.
