# M212 — authoritative block-only W3C sequencing

## Confirmed genuine-browser failures

1. [M211 PR #249 first CI #38432344532](https://github.com/tehki/myaso/actions/runs/38432344532) — wheel first, full Chrome click took **203ms** down→up and hit after Firefox's unchanged **240ms short block**, 34HP damage, guard 100. Correctly failed.
2. [M212 PR #251 first CI #38452643108](https://github.com/tehki/myaso/actions/runs/38452643108) — full Chrome click first, then wheel, led to genuine parry. Firefox block feedback to parry ~88ms, inside unchanged **125ms parry**. Correctly failed.
3. [M212 PR #251 second CI #38453881041](https://github.com/tehki/myaso/actions/runs/38453881041) — split Chrome down/wheel/up with wheel after down led to genuine parry, Firefox block feedback to parry ~92ms. Correctly failed.

All timestamps quoted within each individual browser's own monotonic observer clock; do **not** subtract Chrome and Firefox clock origins directly.

## Revised candidate — shortened wheel lead before split click

- Send exactly **one genuine Firefox W3C backward wheel first**. Do not require a long ACK before continuing; a bounded 48ms harness head start is used. The 90ms trial reached unblocked damage, with 271ms Firefox wheel→hit; earlier attack-led trials reached parries near 148ms. This shorter lead is a test-only candidate intended to target the 125..240ms block-only interval, not a guarantee of success.
- Then send exactly **one Chrome W3C mouse-down**, keep pressed for a bounded 10ms after down ACK, then send exactly **one Chrome W3C mouse-up**. Split input avoids W3C full-click duration problems; an actual slow pointer action remains visible and fails if outside timing.
- Require all actual genuine W3C calls to succeed, including late wheel errors. If the wheel fails before Chrome action, do not attack; if it fails after real Chrome down, the release still happens once to avoid a stuck pointer, then test fails.
- No synthetic page events, direct server actions, hidden retries or second attack.
- Original M194 strict acceptance unchanged: 100HP intact, -38 guard per protected light hit (eventually guard break), zero parry, real one-wheel/one-click evidence; preserve 34HP attack damage if unblocked and unchanged 125ms parry / 240ms block / 135ms windup constants.
- No production Rust, protocol, state machine, stamina, damage, or gameplay timing change.
- M211 merged into main and included in this PR branch. Retain its M144/M145 server tick evidence and full CI suite.

## Release policy

Local tests alone do not qualify. Pass full exact-head quality with real independent Firefox+Chrome M194 repetitions and all FFA/512-population suites; then independently validate merged main. Keep public playable and production deployments disabled.

- [Quality #38455651000](https://github.com/tehki/myaso/actions/runs/38455651000), 25ms wheel lead: one genuine Firefox wheel t=581, parry t=715, so 134ms wheel→impact in the same Firefox clock and a strict early-parry failure. The 48ms candidate is an empirical middle between 25ms (134ms early) and 90ms (271ms late), not acceptance evidence.


## Read-only ingress diagnostics (pre-merge)
A single real M194 failure now emits `M212_GUARD_BREAK_INGRESS` **before** the unchanged fail-closed guard. It records wheel/down/up dispatch and ACK in the **single Node harness clock**; Firefox wheel, block feedback, and hit/parry relative timings **only in Firefox's local clock**; and actual Chrome pointer down/up duration **only in Chrome's local clock**. Unknown observations stay `null`. This pinpoints scheduling/driver lag without ever pretending client clocks are synchronized or converting late damage/parry into passing evidence.

- A prior block cue may be deduplicated by the browser observer; when its timestamp predates the current genuine wheel, its per-exchange duration is reported `null`, never a misleading negative latency. Genuine `Block held` and `Guard broken` feedback can count as the same-browser outcome cue.

## Focused acceptance result
[Focused M194 run #38456824920](https://github.com/tehki/myaso/actions/runs/38456824920) passed all **5 independent real Chrome+Firefox sessions**, with **15 genuine guard-pressure exchanges**, 100HP intact, and guard 100→62→24→0 in each. The branch-only temporary focused workflow used for investigation is removed before release; it is not a production or long-lived CI workflow. The normal complete quality workflow remains mandatory before merge and once again after merge.

## M212 slow genuine Firefox W3C ACK correction
[Final cleanup head CI #38457683239](https://github.com/tehki/myaso/actions/runs/38457683239) failed M194 with one genuine parry. The new pre-assertion diagnostics proved the Firefox W3C wheel ACK required **119.7ms**, whereas the five-session focused green run's 15 real exchanges had ACK delays of approximately **4.3..53.2ms**. Firefox's own wheel event to parry cue was **133ms** (inside the immutable 125ms parry phase from server block activation). The prior harness began Chrome down at a fixed **48ms**, while the Firefox wheel command had not yet been acknowledged.

The corrective acceptance-only choreography begins exactly one genuine Firefox W3C wheel, then waits for **both** the existing 48ms minimum lead **and** the actual wheel WebDriver acknowledgement before sending one genuine Chrome down, genuine 10ms hold, and genuine up. This is a real driver acknowledgement, not page JavaScript, direct server action, a second wheel, or a modified parry/short-block duration. If the wheel fails before or after the 48ms lead, the attacker never clicks. If the release fails, the strict test fails. A very late ACK may still cause a parry or expiry; the original real-browser no-parry/no-HP/guard checks continue to fail closed. Deterministic regression test models the observed 120ms ACK and verifies Chrome-down dispatch begins only at 120ms.
