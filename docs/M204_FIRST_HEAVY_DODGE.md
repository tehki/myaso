# M204 — real heavy dodge must precede the FIRST authoritative hit

On M203 PR [#234](https://github.com/tehki/myaso/pull/234) exact-head quality run [#38282948306](https://github.com/tehki/myaso/actions/runs/38282948306), **two independent attempts failed M107** before any M203 guard-break acceptance. Both showed 46 HP damage first and a subsequent real Chrome dodge wheel/success; strict clean-dodge proof correctly rejected 54 HP.

The existing M107 helper awaited the entire Firefox E press, 120ms driver-host sleep, and Firefox E release *before* scheduling Chrome's roll after observing heavy commitment. Actual W3C key release may be delayed substantially on the runner. Thus the real wheel can arrive after the first 46 HP hit.

M204 acceptance-only fix: send one genuine Firefox E keydown, observe the same authoritative heavy-commit event while E remains held, schedule **one genuine Chrome wheel-forward plus perpendicular S key** with a bounded 120ms browser-owned delay during the first heavy windup, then **always release the genuine E key in finally**. A failed commit latch releases E and must satisfy existing strict clean-retry rules; no synthetic action, second dodge, game-timing change, server damage adjustment, or hidden input retry.

Preserved strict evidence: genuine E down/up; genuine wheel -120, S down/up; heavy-dodge feedback on both browsers; attacker and defender HP=100 and guards=100; absence of parry; no collateral damage; unchanged 320ms heavy windup, 46 HP damage, 170ms dodge and 125ms invulnerability. If input still arrives too late, CI correctly fails.

M204 is included as a dependent acceptance-repair commit on M203 PR because exact-head quality cannot be promoted while the pre-existing M107 gate fails. M201 authoritative action phase evidence remains a separate issue #232. Require complete exact-head Rust, Node, real Chrome/Firefox FFA and 512-occupant capacity, then independent post-merge main CI. No playable launch or production deployment.
