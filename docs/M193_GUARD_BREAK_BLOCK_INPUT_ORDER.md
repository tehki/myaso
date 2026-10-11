# M193 — Guard-break block-only browser input ordering

## Main CI regression

After M192 merged (`c4458fb1bf9294c6be035902e37018f020f0edf8`), quality run [#38139942679](https://github.com/tehki/myaso/actions/runs/38139942679) passed M188's three real block plus three real parry trials and original M107. It then failed M34: the initial genuine wheel-back was followed by a Chrome light attack that Firefox **parried**, instead of producing authoritative guard pressure. Later attacks were guarded for -38, but the defender never reached zero guard / guard-break.

## Correction

M34's existing per-exchange wheel-back lead of **35ms** was close enough to the unchanged **125ms** parry window that remote Chrome/Firefox delivery jitter could resolve the light inside parry. Increase the test-only lead to **65ms** before the genuine Chrome LMB burst. With the unchanged 135ms light windup, the intended collision remains between the 125ms parry interval and 240ms short-block expiration. The server remains the only combat arbiter.

## Qualification

- Three independent, real Chrome/Firefox `uiguardbreak` runs early in quality CI, *in addition to* the original M34 and M40 checks.
- Each flight must preserve both players at **100 HP**, deliver genuine W3C wheel-back and LMB edges, show blocked -38 guard pressure and eventually **zero guard + genuine guard break**.
- Any parry, unblocked damage, missing break or missing input is a test failure. Do not reset guard or generate gameplay input from JS or alter Rust combat rules.
- Original M188/M107, M34/M40, full Rust/JavaScript/browser/FFA and M8 capacity gates remain required.
- No playable build or production launch.
