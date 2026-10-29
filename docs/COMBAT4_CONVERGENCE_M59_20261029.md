# Combat4 M59 native convergence — 2026-10-29

Base: Chat UX `54686ecafd5ea338e09e0633b466fc73489aa8b5`.
Scope: native acceptance fixture only; original Combat timings, threat selector,
damage, network cadence and Chat C1 remain unchanged.

Original first red: [Quality #40929975034](https://github.com/tehki/myaso/actions/runs/40929975034),
job 123645504369, `Validate M59 secondary FFA threat phase`.
Both attackers lost 34 HP after the fixed 260ms inward movement, and the
observer never received two simultaneous STRIKE threats. Local original-base
runs passed 5/5; these passes do not supersede the original CI failure.

The fixture now uses read-only replicated positions to stage genuine W3C
movement at 62±4px on each side of center: both threaten center while remaining
outside each other's 94px Light reach. Bounded corrections wait beyond the dash
double-tap window. Attacks reuse the already aimed physical pointers.

The intermediate 35ms-click candidate passed three native runs and then failed
the original phase assertion. Original World trace established Light starts
at ticks 368/371 and simultaneous active ticks 379–380: a 33ms overlap can fall
entirely between unchanged 50ms snapshots. Removing the artificial W3C pause
tick keeps one genuine DOWN/UP per attacker. No phase assertion is relaxed.
The final candidate additionally requires center HP32 and both attackers HP100.

Validation: 6/6 consecutive final-candidate Chrome/Firefox/Chrome2 native
`uisecondaryphase` processes passed; all include original World action/HIT
trace. The pure World regression covers 58/62/66px separation and 0/1/2-tick
Light staggering: two center HIT34, no attacker damage, overlapping STRIKE.
Full Node, Rust, format, Clippy and exact-commit CI results are recorded in the
PR and durable evidence checkpoint, including failed intermediate candidates.

Evidence: Windows common Git directory `myaso-evidence/combat-convergence-20261029`;
Serj `/tmp/combat-convergence-m59-*` before durable archival. Production
configuration was read only: Chat C1 ON, public local-chat SHA256
`33b57f90e9d8e0be65af94ec5ce2f2618c430824a1b51f5b3e8ba83ed17da451`.

This milestone does not resolve instant-Light #696 or establish a release
verdict. The next confirmed source blocker is optional QUIC uni-stream
dispatch: current server rejects simultaneous Chat C1 and typed gestures.
