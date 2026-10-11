# M188 — Heavy-block input-window reliability

## Post-merge failure

Merged M187 passed its PR quality run, but the ensuing `main` workflow #38127867827 reproduced M107 heavy-block drift. Chrome issued a genuine heavy strike and hit Firefox for 46 HP; the single genuine wheel-back arrived approximately 296 ms before impact, beyond the unchanged 240 ms short block. The browser test correctly failed, and M34 did not run.

## Correction

Schedule one genuine Firefox W3C wheel-back about 170 ms after Chrome begins its real E heavy gesture, instead of 70 ms. With a 320 ms heavy windup, this targets the block-only interval: older than the 125 ms parry window, but within the 240 ms short block. No synthetic client actions, renewed wheel, modified gameplay timings, retry after resolved damage, or relaxed acceptance.

## Promotion gate

Require real Chrome/Firefox M107 `uiheavyblock`, `uiheavyparry`, and `uiheavydodge`; M34 and M40 guard-break; all Rust, JS and M8 capacity checks. Preserve 100 HP and the 64-guard-damage authoritative event. Repeat the critical browser gates on the final immutable head to guard against transient CI green. Do not open the playable build.

## Follow-up: heavy-parry W3C input race

The first M188 candidate run #990 failed M107 `uiheavyparry`: the real Firefox
wheel reached the browser only a few milliseconds before heavy impact, and a
real 46 HP strike landed. Polling the replicated HUD for heavy windup followed
by another 165 ms wait was vulnerable to browser/WebDriver latency. The updated
flight dispatches Chrome's real E hold and Firefox's **single** 250 ms delayed
wheel-back concurrently in distinct real browser sessions. The server must still
observe the parry within its original 125 ms window. Heavy block remains
separate with one wheel at 170 ms; no balance constants or assertions change.
The repeatability gate now verifies **three** independent heavy-block and
**three** independent heavy-parry runs before the full M8 capacity gate.

## M188 repeated-flight correction

Quality #993 passed the original M107 flight and two independent M188
heavy-block repeats, then correctly failed the third: Firefox parried instead
of holding block. The replicated heavy-commit-to-impact interval varies under
CI load. A fixed delay from E key delivery cannot reliably distinguish the
125 ms parry window from the 240 ms short block. The latest flight uses an
independent read-only Chrome event observer to measure the age of the genuine
`Heavy strike committed` UI transition and send Firefox's *real* W3C wheel
with a bounded remaining delay. Targets are 110 ms after that transition for
block and 215 ms for parry, before WebDriver delivery overhead. These offsets
change only acceptance scheduling; the Rust server remains the sole arbiter.
Any 46 HP damage, parry during a block test, or missing parry during a parry
test remains a hard CI failure. A complete final-head quality run is required.
