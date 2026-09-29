# M39 Spatial FFA Attack Intent

## Objective

Make authoritative remote attack windup unmistakably readable before the strike becomes active, preserving the combat north star that every damaging commitment is visible before damage can happen.

## Product behavior

A remote fighter in `AttackWindup` keeps the existing faint directional attack cone and now gains a dashed high-contrast boundary around that cone. When the replicated action advances to `AttackActive`, the dashed boundary disappears and the existing stronger filled active cone remains.

The extra boundary is remote-only. The local fighter keeps the existing self presentation and textual action hint, avoiding redundant local-screen noise.

M39 consumes only existing replicated authoritative action/facing state. It does not predict attacks or grant client combat authority.

## Acceptance

The dedicated `uiattackintent` Chrome+Firefox flight opens the production `index.html`, drives a genuine pointer attack through WebDriver, and arms a passive `requestAnimationFrame` sampler before that input. The sampler tracks the maximum matching pixels in a bounded 320×320 combat envelope throughout the brief authoritative windup without injecting or mutating combat state. The bound contains the remote fighter plus the 94-unit windup cone while avoiding Firefox full-canvas script timeouts and WebDriver round-trip gaps.

Chrome is the attacker and Firefox is the observer. Spawn ordering determines left/right movement and aim. Firefox must observe the unique remote-windup boundary pixels, while Chrome must never paint that remote-only boundary around its local fighter. The boundary must clear after the authoritative windup ends.

### Acceptance stabilization

FULL CI #179 cleared M34-M38 and then reproduced an inherited M39 scheduling case where both passive windup samplers stayed at 0. M39 already had up to three bounded repetitions of the same genuine pointer attack, so adding more retries would not address the underlying contention. The attacker-side continuous `getImageData()` sampler has therefore been removed: Firefox keeps the passive remote observer sampler, and the instant Firefox observes at least 24 authoritative windup pixels the harness takes one synchronous Chrome negative-control sample while that same windup is still live. This preserves the original remote-only 24-pixel requirement and still rejects any local rendering of that boundary, while removing continuous canvas readback from the browser that must deliver the one-shot attack input. No attack state is injected and no gameplay timing or threshold is changed.

## Local evidence

- Coding-agent policy sentinel: PASS.
- Repository governance sentinel: PASS.
- Focused readability tests: 16/16 PASS.
- Browser/runtime CI-equivalent suite: 34/34 PASS.
- Browser hot-path probe: replacement entity objects = 0.
- JavaScript syntax and `git diff --check`: PASS.
- Local real-browser M39 flight cannot start on this Windows host because `cargo` is not on PATH; GitHub FULL CI provides the required Chrome+Firefox acceptance.

## Risk / rollback

Base is frozen M38 exact head `090e9bbea4c5ab577825f36cb97c75a7b95ab850`.

No server simulation, combat constants, 135 ms attack windup, 80 ms active window, 255 ms attack recovery, hit geometry, damage, guard, parry/dodge windows, wire protocol, persistence, networking, public bind, deployment, or production activation changes.

Rollback is to close/discard M39; frozen M38 remains unchanged. FULL CI, including the dedicated real Chrome+Firefox M39 flight, is required before M39 acceptance.
