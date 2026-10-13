# M210 — early genuine light-feint W3C wheel timing

## Reproduced regression
M208 independent merged-main quality [#38370495454](https://github.com/tehki/myaso/actions/runs/38370495454) first attempt correctly failed M171 real exhausted-light/heavy feint scenario **at the original sufficient-stamina light feint**. One real Chrome LMB-down reached the browser, and a real wheel-back reached ~81ms later; the unchanged **70ms** server-authoritative light feint window had already elapsed. The move continued from light windup to active, dealing **34 HP** to Firefox. The existing test correctly refused a clean retry. Its independent unchanged rerun later passed all 148 quality checks, confirming sensitivity to real WebDriver timing. Tracking issue [#245](https://github.com/tehki/myaso/issues/245).

## Proposed acceptance-only change
Preserve the exact one real Chrome W3C pointerDown, wheel-back scroll, and pointerUp **in one WebDriver multi-source command**, with wheel in a *later W3C tick* (never the same tick as pointerDown, which can cause a Block before the light attack is committed). Reduce only the test's 20ms first pointer/wheel interval to **5ms**. Increase the subsequent pointer hold from 70ms to **85ms**, so the same 90ms total button-held gesture and genuine controls remain unchanged. This should provide 15ms more room for variable driver scheduling, while preserving enough separate ticks for an authentic light-feint chord.

The unchanged server remains sole authority for whether the real wheel arrived early enough to cancel the attack. If W3C ingress still misses 70ms, genuine 34 HP damage and the real-browser M117/M170/M171 test must **fail closed**; no fabricated feint, second wheel, hidden retry or test assertion relaxation is permitted.

The exhausted-stamina proof still requires the same genuine early LMB/wheel chord to be **rejected** when stamina is below the unchanged 12 cost, preserve the original light commitment, and not falsely consume stamina.

## Release gates
Focused M210 source/integration test, entire JavaScript test suite, unchanged Rust format/lints and tests, real Chrome/Firefox feint, heavy feint, M36/M107/M194, three fresh M205 guard-break server-proof sessions, M155/M159 multiplayer, and 512 occupant capacity. Then independent post-merge main verification. No playable launch or production deployment.
