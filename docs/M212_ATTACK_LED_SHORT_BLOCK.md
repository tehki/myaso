# M212 — genuine W3C block-only sequencing, revised after CI

## Reproduced opposite failures

- [M211 PR #249 original quality #38432344532](https://github.com/tehki/myaso/actions/runs/38432344532) showed Firefox one real wheel-back at observer t=538ms followed by **unblocked 34HP**, HP 66 / guard 100 at t=968ms. Chrome one real down t=579.7, up t=782.4 (**203ms genuine click hold**), attack confirmation t=967.2. Firefox wheel→damage ~430ms in its own clock, beyond unchanged 240ms short block.
- [M212 PR #251 revision 1 quality #38452643108](https://github.com/tehki/myaso/actions/runs/38452643108) put the **complete** Chrome W3C click before the wheel; Firefox correctly **parried** the first light. Chrome down t=497.9, up t=509.3, parried t=700.1; Firefox wheel t=499, block feedback t=616, parry feedback t=704. Its own block feedback→parry was ~88ms, inside the unchanged 125ms parry window. The strict M193/M194 test failed closed.

Chrome and Firefox local monotonic clocks are NOT synchronized; never subtract absolute timestamps across browsers.

## Candidate revision 2 (after M211 main integration)

The W3C click duration is unreliable as an atomic unit. A whole Firefox wheel before the whole Chrome click risks short-block expiry; a wheel after the whole click risks a parry.

Use the existing genuine W3C pointer input:
1. Issue exactly **one Chrome pointer-down** and await its WebDriver acknowledgement.
2. Dispatch exactly **one Firefox wheel-back**, then keep Chrome down across a bounded **55ms** genuine inter-browser lead (only harness time, no game delay or altered combat value).
3. Issue exactly **one Chrome pointer-up** and await both W3C requests. Release must be attempted even if Firefox's wheel fails, so a held mouse is not left stuck. The test remains failed on either WebDriver error.
4. Read the actual browser W3C pointer down/up, wheel, server-generated block/damage/parry/guard and state. Real success must be independently evidenced; scheduling order alone is never accepted.

All original M194 gates remain strict: no parries, no damage, exact -38 guard per guarded hit, guard-break after real exchanges, one real W3C click and wheel, no synthetic events, hidden gameplay retries, adjusted Rust timings, protocol changes, or game logic changes. Fail if an exchange lands in the 125ms parry or outside the 240ms short block.

The previously merged M211 Rust server 60Hz read-only action proof is preserved on this combined PR branch, including both M144/M145 CI steps. Local Node tests include delayed down ACK, slow wheel ACK, failed wheel cleanup, single up/down/wheel, historical guard assertions, and full CI workflow wiring.

## Release gate

Do not merge on local unit tests. Require full exact-head CI including multiple fresh real Chrome/Firefox M194 trials; then independent merged-main CI after merge. Keep playable and production deployment closed.
