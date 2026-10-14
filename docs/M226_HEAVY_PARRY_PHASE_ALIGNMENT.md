# M226 — Align genuine Firefox heavy-parry wheel with server hit phase

The unchanged merged M223 265ms W3C wheel-pause target has repeatedly accepted native Firefox wheel and authoritative Block but ended in an ordinary **-64 guard** instead of a parry during strict M188/M107. Evidence: [M225 quality #38627800188 attempt 1+2](https://github.com/tehki/myaso/actions/runs/38627800188) and [integrated M221 quality #38632617567](https://github.com/tehki/myaso/actions/runs/38632617567).

In the latter, real Chrome E caused server windup tick 544 (replica 546), real Firefox wheel caused server Block tick 558, and Chrome heavy Active began tick 564. The block was ~6 ticks (~100ms) before Active; the actual hit resolves after Active, sometimes exceeding the existing 125ms parry limit. The previous wheel objective was 265ms after observed server windup; varying W3C ingress and browser timing made its native block too early.

**Acceptance-only change:** Adjust the genuine CI parry wheel target by **+20ms to 285ms** after fresh server-observed windup; keep real Chrome E input, Firefox W3C wheel input, unchanged 65–85ms bounded ingress estimator, strict native event count, and original absolute 100HP/100guard/attacker stunned/parry feedback. The heavy-block case stays at **155ms** and still must cause exactly 64 guard loss without parry. The Rust/gameplay **320ms heavy windup and 125ms parry interval are unchanged**. The script remains fail-closed if the later input arrives too late.

This is a timing hypothesis requiring validation, **not a passed proof**. Qualify genuine M188 3/3 heavy-block and 3/3 parry, M107 real heavy counterplay, full exact-head quality twice and independent merged-main qualification. No playable build or production deployment.
