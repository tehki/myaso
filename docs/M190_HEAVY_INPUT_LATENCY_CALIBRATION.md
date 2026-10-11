# M190 — Real-browser heavy-defense delivery calibration

## Regression

M189's phase-anchored wheel input passed the full PR run, but failed on merged `main` ([quality #38133511704](https://github.com/tehki/myaso/actions/runs/38133511704)). The Chrome authoritative heavy windup began at server tick 3003 and Firefox's actual block began only on tick 3021 — roughly 258ms later. The heavy hit arrived around the same tick as the block, so it legitimately counted as a parry rather than 64 guard damage.

## Correction

A 125ms parry vs. 240ms block interval is narrower than the sporadic remote W3C delivery delays seen on loaded browsers. Waiting for a replicated action event before even sending Firefox's input cannot meet the block-only interval reliably. M190 pre-arms the two **real** browser actions concurrently. Just before each independent exchange, genuine 1px WebDriver pointer movements in Chrome/Firefox establish observed local dispatch-to-event latency; each browser is then aimed back at the target. The measured difference determines a Firefox-native W3C pause before a single real wheel-back. The real Chrome E gesture is dispatched concurrently, without blocking on round trips or HUD rendering.

Instrumented, read-only server-replicated action transitions record the Chrome heavy windup and Firefox block ticks after the command. These diagnostics do not fabricate authoritative actions, issue synthetic JavaScript input, or relax any outcome. Target browser-event offsets are initially 130ms after the real heavy onset for an ordinary block and 265ms for parry; both remain server-decided and subject to ingress/scheduler jitter.

## Acceptance

- Three genuine fresh Chrome/Firefox heavy-block trials produce exactly 64 guard damage and 100 HP, with **no parry**.
- Three fresh heavy-parry trials produce real stun/parry and unchanged 100 HP.
- Original M107 heavy block/parry/dodge, M34/M40 guard-break, all Rust/JS/FFA/browser checks, and M8 capacity pass on the exact head.
- The 320ms heavy windup, 125ms parry, 240ms short block, stamina and combat authority remain unchanged.
- No playable build or production deployment.

## Repeated-gate feedback

Full candidate run #1006 passed all three calibrated real heavy-block trials
and two calibrated heavy-parry trials. On the third parry, the server correctly
registered ordinary block pressure (-64 guard), not a parry: Chrome's replicated
heavy windup was at server tick 219, Firefox block at tick 231, and active heavy
at tick 237. The real wheel was delivered too early for the 125ms parry window.
The Firefox-native W3C parry pause therefore advances from a 240ms to **265ms**
after the estimated real E onset. This is test-only scheduling, not a change to
authoritative combat timings or acceptable results.

## Second full-quality flight and timing refinement

Quality #1008 was rerun unchanged after an unrelated M144 observation gap.
On the rerun all six heavy-defense repetitions and M144 passed, but original
M107 `uiheavyparry` produced a genuine 46 HP hit: Firefox's real wheel arrived
approximately 15ms before the visible impact and the authoritative block
transition entered after strike activation. Under a separate earlier flight,
a 240ms planned parry wheel resolved as normal guard pressure. These opposing
failures bracket a narrow W3C timing target; M190 selects **250ms** between
those trial values. The full M107 original gate is also moved immediately
after the six-repeat gate, so loaded Chrome/Firefox input failures are found
before later unrelated PvP tests. All mandatory gates and original fail-closed
outcomes remain unchanged. No combat or network timing changes.
