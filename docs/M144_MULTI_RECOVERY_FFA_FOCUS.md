# M144 — Simultaneous recovery focus arbitration in FFA

## Goal
Prove that the M143 punish-target HUD remains deterministic when two opponents are recoverable at the same time.

M144 changes no combat constants and no authoritative combat rules. It is a readability/acceptance milestone built on the existing recovery selector.

## Arbitration contract
While multiple remote fighters are recoverable, the HUD follows the nearest recoverable fighter. If that fighter exits recovery while another remains recoverable, focus hands off immediately to the remaining punish target. Once all recovery windows close, the HUD returns to the ordinary nearest living rival.

Distance remains the primary recovery-target ordering key, with lower network id as the stable tie-breaker.
## Real-browser acceptance
The deterministic three-client flight uses:

- Chrome / #1: off-axis jump attacker
- Firefox / #2: observer
- second Chrome / #3: closer off-axis light attacker

#3 is moved inward so Firefox begins at `NEAREST #3`. #3 then performs one real LMB light attack aimed away from Firefox. Forty-five milliseconds later #1 performs one genuine same-tick Space + LMB jump attack aimed away from Firefox.

The unchanged light recovery (255 ms) and jump-attack recovery (290 ms) overlap. During that overlap Firefox must prefer the closer recoverable #3, then hand off to #1 when #3 returns to idle, and finally return to `NEAREST #3` after #1 also recovers:

`NEAREST #3 -> PUNISH TARGET #3 -> PUNISH TARGET #1 -> NEAREST #3`

The recovery card must simultaneously transition `Attack recovery -> Jump attack recovery -> clear`. Both authoritative attack lifecycles must complete normally, both inputs must have genuine DOM/WebDriver provenance, and all HP/guard values must remain untouched because both attacks are deliberately off-axis.

## Scope
Changes are limited to acceptance coverage, unit assertions, query-gated acceptance telemetry, CI wiring, and this document. The playable build is not opened.