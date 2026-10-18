# M249 — R1 guard-break test: remove obsolete post-wheel head start

## Motivation / measurements

The M194 real guard-break qualification requires **100 HP**, a genuine block-only **-38 guard** exchange, zero parries, and eventual server-authoritative guard break under the *unchanged* 125ms parry and 240ms short-block windows.

The R1 short LMB change made light attacks commit **on pointerUP**, not pointerDOWN. M212's historical 48ms wheel-first delay was tuned to earlier input timing and can now leave the actual 34HP light hit outside short block.

On PR #302 run [39111480793](https://github.com/tehki/myaso/actions/runs/39111480793), attempt 2, M194 repetition 1/exchange 1:
- Trusted Firefox wheel receipt: **17ms** (harness clock), mandatory real W3C wheel ACK **24.5ms**.
- Chrome genuine W3C click began **48.8ms** after wheel request, pointerDOWN to UP **22.6ms** on its own clock.
- Firefox wheel→damage cue **285ms** on the *same Firefox clock*; HP **100→66**, guard **100**. Strict gate failed, as required.
- Earlier incident [#298](https://github.com/tehki/myaso/issues/298) observed 293ms wheel→impact after a slower 125ms wheel receipt, so late delivery remains a separate limitation.

## Candidate (strict real-browser experiment)

For **R1 M194 only**, override the M212 helper's default `wheelHeadStartMs: 48` to **0ms**, while retaining:
- exactly one native Firefox wheel-back with a challenge token and real `event.isTrusted`;
- **mandatory genuine wheel receipt before** one real Chrome W3C pointerDOWN/pause/pointerUP batch;
- mandatory Firefox WebDriver wheel ACK before accepting success, even if its HTTP reply comes after the Chrome click;
- no synthetic DOM actions, fabricated hit/guard state, retries or changed combat constants;
- unchanged actual 100 HP, -38 guard, zero parry, 125–240ms server action windows and five independent real-browser repetitions.

When the genuine wheel receipt is prompt, removal of the fixed 48ms pause should shorten wheel→hit toward the block-only interval center. If the Firefox receipt is slow, the click still waits for trusted receipt; some late failures may remain and must stay RED. If a click starts *too* early, genuine parry must also stay RED. **This is a test candidate, not a proven fix or release clearance.**

The M212 exported helper and its legacy default 48ms path are unchanged. Two targeted source/async contract tests verify wheel authentication, W3C ACK, exactly one native click and preservation of fatal HP/guard/parry checks.

## Acceptance

Require 5/5 authentic M194 real-browser qualifications plus complete Rust/Chrome+Firefox quality on exact head; independently merged-main quality and public-network multiplayer smoke are additional gates. Do not merge or deploy based on local unit tests or isolated M194 success alone.
