# M187 — Real-browser guard-break input synchronization

## Failure
Issue #203 recorded an M34 full quality browser run where the initial Firefox
wheel-back input was accepted, but Chrome's first light hit landed after the
authoritative 240 ms short-block interval. The target lost 34 HP before later
correct guard pressure and guard-break events. The existing 100 HP acceptance
predicate correctly rejected the flight.

## Corrective choreography
- Begin the genuine Firefox WebDriver wheel-back block input.
- After a 35 ms lead, start the genuine Chrome WebDriver LMB burst while the wheel dispatch is still in flight; await both responses concurrently.
- This puts the light's unchanged 135 ms startup into the block-only segment (beyond 125 ms parry, inside 240 ms short block), without paying the sequential wheel-response latency.
- Keep the original 135 ms light windup, 125 ms parry and 240 ms short-block
  windows fully authoritative and unchanged.
- Fail immediately if any hit leaks through with defender HP below 100,
  instead of retrying after a compromised opening exchange.
- Preserve the original guard-pressure, guard-break, wheel, LMB, facing and
  100 HP / 0 guard acceptance evidence.

The inputs are never synthesized through JavaScript or acceptance hooks.
Window boundaries and the outcome are decided only by the Rust server.

## Promotion
Real Chrome and Firefox M34 / M40 flights plus complete GitHub Rust, JS,
cross-browser and capacity quality run on the merged ancestor. No playable
build launch or production deployment.

## Full-suite M107 choreography hardening
Repeated full CI on the prior M187 head failed a pre-existing M107 browser
scenario before M34 could execute. One run produced an accidental roll-collision
knockdown rather than a perpendicular dodge. Another produced a parry during the
heavy-block flight: its second wheel-back pulse rearmed the 125 ms parry window
shortly before impact. The M107 acceptance now uses one genuine wheel-back
within the normal 240 ms short-block interval and a shorter genuine approach
before the perpendicular roll. No input synthesis, outcome forgiveness, or
server-side balance changes are permitted; M107 retains its exact guarded-hit
and dodge-feedback assertions.
