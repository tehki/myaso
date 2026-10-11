# M195 — Real heavy-parry median input ingress qualification

## Post-merge failure

After M194 PR #218 passed full quality and merged as bd7da51, [main quality #38146608797](https://github.com/tehki/myaso/actions/runs/38146608797) failed the second independent M188 heavy-parry trial. Three heavy blocks and the first parry trial had passed. Chrome's genuine E and Firefox's genuine wheel-back were recorded, but the second parry landed too late: Firefox received 46 HP damage (54 HP remaining). The isolated calibration reported E ingress of 98ms versus wheel ingress of 38ms and scheduled a 315ms wheel pause. The true concurrent heavy commitment feedback followed E keydown by roughly 65ms, suggesting a calibration outlier versus the actual exchange.

## M195 acceptance-only correction

- Perform **three distinct real Chrome E heavy whiffs**, off-axis, with full recovery; require read-only server heavy-windup and idle transitions plus 100 HP/100 guard for both fighters.
- Perform **three separate real Firefox wheel-back short-block calibrations** while no attack is pending, each after prior block expiry. Require genuine server block transition and 100 HP/100 guard.
- Use the median of each true action type's server-ingress delays and clamp the resulting *applied* E-to-wheel skew to +/-40ms for heavy blocks and +/-25ms for parries. Log all six samples, medians, raw and applied skew; never fabricate action timestamps or combat outcomes.
- Center the one-wheel true parry probe at 265ms after heavy windup, with its narrower +/-25ms calibrated skew, within the existing late 125ms parry window before 320ms heavy impact, to prevent both the previously observed late 46 HP hit and the early ordinary 64 guard block seen in PR quality #1021.
- The **actual test exchange still sends one and only one real Firefox WebDriver wheel-back** with a genuine Chrome E. Calibration input is isolated, never used as acceptance or as a second combat wheel.
- Fail closed on 46 HP hits, 64 guard-only blocks, missing parry/stun, wrong HP/guard, action corruption, or calibration anomalies.

## Promotion

Three fresh Chrome/Firefox heavy blocks and three heavy parries must pass, followed by the original M107, guard-break M194 five repeats and M34/M40, full Rust/JavaScript/network/browser/FFA, and 512-player capacity. Validate the exact PR head and then the merged main run separately. No gameplay timing, combat damage, stamina, Rust authority, or protocol changes. The playable build stays closed and production deployment disabled.