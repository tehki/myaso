# M187 — Real-browser guard-break input synchronization

## Failure
Issue #203 recorded an M34 full quality browser run where the initial Firefox
wheel-back input was accepted, but Chrome's first light hit landed after the
authoritative 240 ms short-block interval. The target lost 34 HP before later
correct guard pressure and guard-break events. The existing 100 HP acceptance
predicate correctly rejected the flight.

## Corrective choreography
- Begin a genuine WebDriver Chrome LMB attack burst.
- Immediately after starting, issue Firefox's genuine WebDriver wheel-back block; await both. The 1 ms scheduling yield allows both real browser inputs to overlap without a fixed late wheel.
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
