# M40 Spatial FFA Guard-Break Tell

## Objective

Make an authoritative broken guard unmistakably punishable in free-for-all play without adding client combat authority.

## Product behavior

A remote fighter is eligible for the M40 tell only when replicated authoritative state says both `Stunned` and `guard == 0`.

That fighter keeps the existing generic stun ring and gains a brighter dashed outer ring. A normal parry stun with guard remaining does not receive the extra ring. The local fighter never receives the remote-only marker.

This makes the north-star rule “broken guard creates a punish window” readable to nearby third-party observers instead of only through the two-player HUD/event feed.

## Acceptance

The dedicated `uiguardbreaktell` Chrome+Firefox flight reuses the production M34 guard-break choreography and real WebDriver movement, attacks, and directional block.

After authoritative `guard-break-confirm` / `guard-broken` feedback, the attacking browser must paint the unique remote broken-guard ring, while the browser controlling the broken fighter must not paint that remote-only marker around itself. The marker must clear after authoritative stun recovery.
## Local evidence

- Coding-agent policy sentinel: PASS.
- Repository governance sentinel: PASS.
- Focused readability: 17/17 PASS.
- Browser/runtime CI-equivalent suite: 35/35 PASS.
- Combat model: 9/9 PASS.
- Networking/compact snapshot: 24/24 PASS.
- Browser hot-path probe: replacement entity objects = 0.
- JavaScript syntax and `git diff --check`: PASS.

## Risk / rollback

Base is frozen M39 exact head `7d54599a48891427e27a47c8a62c595be6062db7`.

No server simulation, combat constants, guard cost, stun duration, parry/dodge windows, attack timing, hit geometry, damage, wire protocol, networking, persistence, public bind, deployment, or production activation changes.

Rollback is to close/discard M40; frozen M39 remains unchanged. FULL CI, including the dedicated real Chrome+Firefox M40 flight, is required before M40 acceptance.
