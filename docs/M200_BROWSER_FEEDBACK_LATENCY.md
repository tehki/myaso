# M200 — browser-clock combat feedback evidence

## Verified telemetry defect

M199 merged-main quality [#38264985842](https://github.com/tehki/myaso/actions/runs/38264985842)
passed, but the second genuine guard-break exchange logged
`wheelToFeedbackMs: -393`. The former diagnostic unconditionally paired
the latest wheel with the latest event text transition, even when that
transition belonged to an earlier exchange.

## Correction

The read-only M200 helper accepts only an exact defender server-derived
blocked-guard or guard-break UI message with a finite event timestamp
not preceding the most recent genuine Firefox wheel timestamp. Both
values are captured relative to the same browser performance clock.
It returns `null` when the observer did not capture a new matching event,
including repeated identical messages deduplicated by the UI observer.
An explicit `unobserved` label distinguishes missing measurement from
zero milliseconds. No timing samples are invented, and no cross-browser
or browser-to-server absolute clocks are subtracted.

This is a *temporal UI correlation*, not a proof of causal server ingress
latency. Combat acceptance continues to rely on the original strict
server-authoritative guard, HP, input provenance and feedback assertions.

## Qualification

Run pure M200 unit tests, the unchanged full Rust / JS / real Chrome and
Firefox / FFA / 512-player quality workflow on the PR head, then independently
on merged main. No gameplay values, input path, protocol, deployment, or
playable-build changes.
