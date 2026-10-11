# M188 — Heavy-block input-window reliability

## Post-merge failure

Merged M187 passed its PR quality run, but the ensuing `main` workflow #38127867827 reproduced M107 heavy-block drift. Chrome issued a genuine heavy strike and hit Firefox for 46 HP; the single genuine wheel-back arrived approximately 296 ms before impact, beyond the unchanged 240 ms short block. The browser test correctly failed, and M34 did not run.

## Correction

Schedule one genuine Firefox W3C wheel-back about 170 ms after Chrome begins its real E heavy gesture, instead of 70 ms. With a 320 ms heavy windup, this targets the block-only interval: older than the 125 ms parry window, but within the 240 ms short block. No synthetic client actions, renewed wheel, modified gameplay timings, retry after resolved damage, or relaxed acceptance.

## Promotion gate

Require real Chrome/Firefox M107 `uiheavyblock`, `uiheavyparry`, and `uiheavydodge`; M34 and M40 guard-break; all Rust, JS and M8 capacity checks. Preserve 100 HP and the 64-guard-damage authoritative event. Repeat the critical browser gates on the final immutable head to guard against transient CI green. Do not open the playable build.
