# M41 Spatial FFA Parry Tell

## Objective

Make an authoritative parry stun unmistakably readable in free-for-all play without adding client combat authority.

## Product behavior

A remote fighter is eligible for the M41 tell only when replicated authoritative state says both `Stunned` and `guard > 0`.

That fighter keeps the existing generic stun ring and gains a cyan dashed outer ring. The M41 predicate is mutually exclusive with M40: a zero-guard stun remains the broken-guard tell, while a positive-guard stun is the parry tell. The local fighter never receives either remote-only marker around itself.

This makes a successful parry and its punish window readable to nearby third-party observers instead of only through the two-player feedback path.

## Acceptance

The dedicated `uiparrytell` Chrome+Firefox flight reuses the production M33 real-WebDriver parry choreography.

After authoritative `parried` / `parry-success` feedback, the dedicated M41 flight polls the two relevant production canvases for a bounded 500 ms window. The parrying browser must paint the unique cyan remote parry-stun ring, while the browser controlling the parried fighter must paint exactly zero remote-only parry pixels. The marker must then clear after authoritative parry-stun recovery. This avoids relying on one animation-frame sample while adding no game state or authority.

## Inherited M36 acceptance stabilization

The exact M41 head also removes an inherited M36 cross-driver synchronization race. M24 remains the dedicated authoritative dodge reaction/overlap proof. M36 now delivers the real WebDriver attack first, then sends the dodge key 100 ms later inside the existing 135 ms attack windup, keeping the dodge close to the model-proven late-windup evade timing while preserving authoritative active-frame overlap. It still requires `dodge-evaded` / `dodge-success` feedback and unchanged HP/guard. No combat timing or server behavior changes.

## Inherited M38 acceptance stabilization

CI #137 showed authoritative attack recovery correctly reached the production UI, but M38 sampled the recovery-ring canvas inside the same MutationObserver turn before the next render frame painted the ring. The observer now defers only the passive pixel sample by two `requestAnimationFrame` callbacks. It still requires the same replicated recovery state and unique production-canvas ring; no gameplay state, rendering rule, or combat timing changes.

## Local evidence

- Coding-agent policy sentinel: PASS.
- Repository governance sentinel: PASS.
- Focused readability: 18/18 PASS.
- Browser/runtime CI-equivalent suite: 36/36 PASS.
- Combat model: 9/9 PASS.
- Networking/compact snapshot: 24/24 PASS.
- Browser hot-path probe: replacement entity objects = 0.
- JavaScript syntax and `git diff --check`: PASS.

## Risk / rollback

Base is frozen M40 exact head `981d123c7b8d1421e107d8263780588dcec8ce35`.

No server simulation, combat constants, 115 ms parry window, 430 ms parry stun, 520 ms guard-break stun, guard cost, attack/dodge timing, hit geometry, damage, wire protocol, networking, persistence, public bind, deployment, or production activation changes.

Rollback is to close/discard M41; frozen M40 remains unchanged. FULL CI, including the dedicated real Chrome+Firefox M41 flight, is required before M41 acceptance.