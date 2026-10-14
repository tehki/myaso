# M213: third-party suppression roll and opener dodge recovery ordering

## Evidence

[Full M212 quality #38460186079](https://github.com/tehki/myaso/actions/runs/38460186079) failed existing real-browser M162 in two built-in trials after M194 passed. With genuine opener and third-party suppressor W3C wheels, #1 opened its dodge at server tick 357, #2 became knocked down at 357, and #3 rolled into #1 at 369. #1 was knocked down before entering the expected dodgeRecovery action. The original M162 fail-closed guard correctly rejected this.

[Passing main #38453243919](https://github.com/tehki/myaso/actions/runs/38453243919) showed #1 original dodge tick 360, original dodgeRecovery tick 369 and incidental knockdown at 372, while #2 recovered on its own at 375. A three-tick difference changed whether the acceptance proof observed recovery.

## Candidate correction (only W3C test-harness scheduling)

The third-party true W3C wheel-forward pause increases from **185ms to 215ms** relative to #1's genuine wheel. This seeks to put #3's collision after #1's authoritative 170ms dodge recovery, but still during #2's original unchanged **260ms knockdown**. There are no changes to game dodge/knockdown durations, physics, collision radius, damage, tick frequency, protocol, or any acceptance assertions.

CI must observe original genuine W3C wheels (one per acting browser), server #1 dodge then dodgeRecovery, #2 knockdown and original idle recovery, #3 dodge then dodgeRecovery, original #2 knockdown duration unchanged, 100HP/100guard, no duplicate/late/skip evidence or faked browser input.

## Gates

Full focused real 3-browser M162 repetitions and full exact-head quality CI must pass independently. M213 is a separate issue and PR from M212, and should be merged only after M212 has qualified and merged.

## Focused three-browser result

[Focused M213 CI #38517785465](https://github.com/tehki/myaso/actions/runs/38517785465) passed **3/3** independent strict real Chrome/Firefox/Chrome2 M162 scenarios with the single genuine third-party wheel at 215ms. The temporary branch-only focused CI has been removed before release; the M213 unit source-contract test is wired permanently into normal quality CI. Full exact-head normal quality and merged-main qualification remain mandatory.
