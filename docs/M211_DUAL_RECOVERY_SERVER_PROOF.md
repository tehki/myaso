# M211 — honest server-origin attack-active evidence for simultaneous recovery

## Root cause
[Issue #211](https://github.com/tehki/myaso/issues/211) captured an M144 three-real-browser false-negative after genuine off-axis light and Space+LMB jump attacks. The client sampled light **idle → windup → recovery → idle** and missed the unchanged ~80ms server `attackActive` phase, while the correct observer recovery focus handoff and 100HP/100guard held. Treating a missing sampled frame as proof of a skipped server phase was not justified.

## Acceptance-only fix
Reuse the existing M201 60Hz Rust authoritative action trace, still **loopback-only, read-only, and disabled outside explicit browser acceptance**, for both M144 `uimultirecoveryffa` and M145 `uimultirecoveryspatial`. No Rust/server game change, extra gameplay wire message, input spoofing or combat timing change.

The new strict verifier reads actual server tick transitions for **both fighters**, requiring exactly one light windup→active→recovery→idle (actions 1→2→3→0) and one actual jump attack windup→active→recovery→idle (16→17→18→0). Native ticks must strictly advance within each attack. Both real recovery windows must overlap: light recovery begins first, jump recovery enters before the light leaves, and jump recovery exits last. All three fighter IDs are distinct. Any server hit to or from the three players fails: attacks deliberately point off-axis.

Genuine Chrome/Firefox real-browser Space+LMB down/up, off-axis light LMB down/up, relative input lead, initial/final 100HP/100 guard, visible light→jump→ordinary-nearest focus handoff, recovery panel updates and spatial recovery-ring checks are **unchanged**. Browser sampled windup/recovery/idle remain required. Only the fallible sampled `attackActive` expectation is replaced by mandatory exact server `windup→active` evidence. Logs include whether the sampled active was observed to aid diagnosis, never to fabricate success.

## Qualification
All Node tests (including deterministic missing-active, out-of-order, early-recovery, extra-action and collateral-hit negatives), real W3C M144/M145/M149, repeated M194/M205, M159, Rust, FFA and 512-occupant capacity in full exact-head CI, then separate merged-main CI. No playable build opened or production deployment.
