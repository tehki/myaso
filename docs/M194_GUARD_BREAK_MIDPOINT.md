# M194 - Guard-break midpoint and post-merge reliability

## Evidence

M193 PR quality #1017 succeeded, but the merged main quality run [#38143732093](https://github.com/tehki/myaso/actions/runs/38143732093) failed its third genuine Chrome/Firefox uiguardbreak repetition. Firefox received a 34 HP unblocked strike (66 HP remaining) after the prior two independent repetitions each exhausted guard correctly. Its UI evidence showed the block event around 496ms and hit feedback around 743ms, approximately 247ms apart: just beyond the 240ms authoritative short-block window.

## Correction

The old fixed 75ms Chrome-owned W3C pointer pause plus unchanged 135ms light windup targeted ~210ms nominal wheel-to-impact. Under positive ingress jitter this expired the 240ms block. The M194 pointer pause is 45ms, targeting ~180ms, centered between unchanged 125ms parry and 240ms short block. Each exchange still sends a genuine Firefox W3C wheel and Chrome W3C LMB burst concurrently; no synthetic combat input and no second wheel.

The read-only wheelToFeedbackMs diagnostic now accompanies genuine wheel/pointer provenance and authoritative guard/HP feedback. It never replaces or relaxes the outcome assertion.

## Promotion gates

- Five fresh real Chrome/Firefox uiguardbreak qualifications early in quality CI and the original M34/M40 tests afterward.
- Preserve 100 defender HP, no parry, -38 guard pressure, eventual zero guard and server-confirmed guard break.
- Preserve Rust tests, 211 JavaScript tests, all Chrome/Firefox/FFA regressions, and M8 512-player capacity validation.
- Do not change production server timing, input authority, 125ms parry, 240ms block, 135ms light windup, damage, guard, stamina or network protocol.
- No playable build or production deployment. Merge only after exact-head full green CI, then verify main CI separately.