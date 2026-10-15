# M228 — genuine kick release-to-feedback observability

Parent: [M196 #221](https://github.com/tehki/myaso/issues/221). Issue: [#275](https://github.com/tehki/myaso/issues/275).

Independent post-merge M227 [main quality #38755463677](https://github.com/tehki/myaso/actions/runs/38755463677) passed all 148 checks. Its genuine M153 short-right-click kick had **123 ms** from right-button pointerdown to browser-observed authoritative kick windup; the two preceding exact-head qualification runs measured **129 ms** and **127 ms**. These are not pure input-response latency because the legitimate **short RMB press duration is included**. Comparing them directly with wheel-roll or parry timing would be misleading.

M228 extends the existing **read-only post-success** `M217_SUCCESSFUL_KICK_FEEDBACK_LATENCY` diagnostics:

- `rightHoldMs`: genuine RMB `pointerup.epochMs - pointerdown.epochMs`.
- `rightUpToObservedWindupMs`: observed authoritative kick-windup transition epoch minus genuine RMB release epoch, **same Chrome actor observer clock only**.
- `rightUpToKnockdownFocusMs`: actual knockdown focus cue render time minus RMB release time, **same Chrome actor performance clock only**.
- Retains existing `rightDownToObservedWindupMs`, `rightDownToKnockdownFocusMs`, and authoritative windup tick, so earlier samples remain comparable.

A missing, repeated, out-of-order, untrusted-source (cross-clock), long-held or unpaired release must **never** fabricate zero or positive latency. If an authoritative windup or focus cue precedes release, report an explicit missing reason, not a negative duration. No cross-browser/server timestamp subtraction or inferred server commit time.

The existing real Chrome/Firefox/Chrome2 M153 three-player proof must still pass before any data is logged; exact knockdown, 100 HP/guard, focus clearance, and original control semantics are unchanged. No Rust, gameplay constants, input injection, protocol, packet handling or playable publication changes.

Qualification: deterministic Node tests, two full exact-head quality runs and independent merged-main quality. The data may then inform M196 user-feedback improvements; the metric alone does **not** demonstrate a gameplay problem.
