# M212 — authoritative block-only W3C sequencing

## Confirmed genuine-browser failures

1. [M211 PR #249 first CI #38432344532](https://github.com/tehki/myaso/actions/runs/38432344532) — wheel first, full Chrome click took **203ms** down→up and hit after Firefox's unchanged **240ms short block**, 34HP damage, guard 100. Correctly failed.
2. [M212 PR #251 first CI #38452643108](https://github.com/tehki/myaso/actions/runs/38452643108) — full Chrome click first, then wheel, led to genuine parry. Firefox block feedback to parry ~88ms, inside unchanged **125ms parry**. Correctly failed.
3. [M212 PR #251 second CI #38453881041](https://github.com/tehki/myaso/actions/runs/38453881041) — split Chrome down/wheel/up with wheel after down led to genuine parry, Firefox block feedback to parry ~92ms. Correctly failed.

All timestamps quoted within each individual browser's own monotonic observer clock; do **not** subtract Chrome and Firefox clock origins directly.

## Revised candidate — wheel lead before split click

- Send exactly **one genuine Firefox W3C backward wheel first**. Do not require a long ACK before continuing; a bounded 90ms harness head start is used, tuned to target the midpoint of the original 125..240ms block-only interval from the observed parry cases.
- Then send exactly **one Chrome W3C mouse-down**, keep pressed for a bounded 10ms after down ACK, then send exactly **one Chrome W3C mouse-up**. Split input avoids W3C full-click duration problems; an actual slow pointer action remains visible and fails if outside timing.
- Require all actual genuine W3C calls to succeed, including late wheel errors. If the wheel fails before Chrome action, do not attack; if it fails after real Chrome down, the release still happens once to avoid a stuck pointer, then test fails.
- No synthetic page events, direct server actions, hidden retries or second attack.
- Original M194 strict acceptance unchanged: 100HP intact, -38 guard per protected light hit (eventually guard break), zero parry, real one-wheel/one-click evidence; preserve 34HP attack damage if unblocked and unchanged 125ms parry / 240ms block / 135ms windup constants.
- No production Rust, protocol, state machine, stamina, damage, or gameplay timing change.
- M211 merged into main and included in this PR branch. Retain its M144/M145 server tick evidence and full CI suite.

## Release policy

Local tests alone do not qualify. Pass full exact-head quality with real independent Firefox+Chrome M194 repetitions and all FFA/512-population suites; then independently validate merged main. Keep public playable and production deployments disabled.
