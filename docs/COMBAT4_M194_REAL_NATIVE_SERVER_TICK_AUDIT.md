# Combat 4 / UI 10 — M194 original native authoritative tick audit

**DRAFT test/diagnostic only.** Child of combined Combat4/Core8C source [#778](https://github.com/tehki/myaso/pull/778). This patch adds only `scripts/combat4-native-guard-trace-audit.mjs` and `tests/combat4-native-guard-trace-audit.test.mjs` plus this memo. It modifies NO original runtime, 125ms parry, 240ms block, 38-point guard damage, W3C harness, click durations, World simulation, v1/v2 packets, QUIC or acceptance condition.

## Exact CI cross-check (22 October 2026)

- #778 exact `391f488435d2bf9ea1203ca1578c30ffb21d5d3c` [full quality #39788267914](https://github.com/tehki/myaso/actions/runs/39788267914) **COMPLETED FAILURE at native M194 guard-break**, step22. In the failed actual original authenticated Chrome/Firefox WebDriver scenario the first exchange's M320 source included **attacker original HeavyWindup9 tick273 → LightWindup1 tick274; defender Block6 begins tick275; genuine `M201_AUTH_BLOCK tick282`**, so the first server BLOCK is exactly 7 tick indices after Block entered and guard **100→62**.
- Same real native trial's **second** exchange: attacker Heavy9 tick307 → Light1 tick308; defender Block6 begins tick310; **`M201_AUTH_PARRY tick316`**, only **6 tick indices** later, attacker Stunned7; defender guard remained 62 and HP100. The original strict M193 runner correctly rejects the parry rather than counting a second -38 guarded hit. The authorized 125ms parry, unchanged 240ms short block, and W3C trusted Firefox wheel-before-Chrome-LMB-release are NOT grounds to infer server tick contact was late enough for block-only.
- #778 [separate genuine Chrome/Firefox four-browser ghost rejoin #39788268122](https://github.com/tehki/myaso/actions/runs/39788268122) **COMPLETED SUCCESS 8/8**, and [Core8C actor lease #39788268116](https://github.com/tehki/myaso/actions/runs/39788268116) **SUCCESS 10/10** on same SHA. Those focused successes do NOT cure M194 nor qualify all protected Combat gates. Its original parent [#767](https://github.com/tehki/myaso/pull/767) independently had quality **165/165 SUCCESS**, but it is a different exact source.

Earlier distinct M194/M205 genuine native protected failures on Combat [#752](https://github.com/tehki/myaso/pull/752) had the same 6 index-tick signature and the three-authentic-contact requirement. Existing Combat original Rust `server/tests/prealpha_m193_server_parry_boundary.rs` has 3/3 actual `World::step()` classification controls, including 100→62→24→0 proper guard break with real original server Events.

## Read-only reproducible tool

On an **externally trusted, unchanged** GitHub Actions native CI log, run from source root:

```bash
node scripts/combat4-native-guard-trace-audit.mjs < original-native-quality.log
```

The tool extracts only lines containing `M320_GUARD_BREAK_AUTH_TRACE` JSON, checks actor IDs, bounds to 64 `M201_AUTH_ACTION` / `M201_AUTH_BLOCK/PARRY/BREAK` lines per exchange, uses **the actual server-recorded terminal BLOCK/PARRY/BREAK**, and finds same-actor preceding `to=6` Block action and earlier attacker `to=9/to=1` windup. It reports **server tick-index gaps**, not exact `World.action_elapsed_ms`. A gap `<=6` is *compatible* with the 125ms parry; `>=8 && <=14` *compatible* with guarded contact; **7 or other gaps are ambiguous**, as original World elapsed can count the action-entry tick. It never infers or substitutes an authoritative result: a reported Block remains Block even at an ambiguous gap. Missing edges report `evidenceComplete:false`. All output includes `fullNativeAcceptanceProven:false`, because neither log text nor a parser authenticates a connection or proves a genuine W3C scenario without trusted original CI provenance. The script never sends a request, changes Combat or reruns an attack.

Seven new Node tests include **verbatim M320 Rust-action lines from original #778 protected log**, historical 9-index-tick valid native Block, 6-index-tick real Parry, timestamp-prefixed CI log parsing, missing-edge fail-closed, invalid or unbounded records and strict original W3C/parry constants. Node full suite, locked Rust, strict Clippy, Rustfmt and protected exact-head quality remain independent tests, not waived.

## Next owner action

UI10 + Core8A should correlate real Firefox W3C wheel/block, Chrome pointer down/up, **admitted v1 INPUT clientTick**, and actual `World` action-entry/contact ticks from the **same server authoritative clock**. The exact M194 second block began too near actual attack contact to drain guard. Neither a fixed JavaScript `sleep` nor a W3C release ACK is proof of Block age at impact. The original M194 scenario must preserve 125ms parry, 240ms block, 38 guard, 100HP, three authenticated guarded hits, real W3C inputs, zero fictitious retries/packet injection and all original strict browser cues. Once the source/root is verified, implement one minimal input timing or source-auth correction on its own owner draft and rerun genuine native M194 and full protected QA.

**Release remains HARD HOLD:** authenticated v2 0x11/0x12 KeyE/LMB canonical Main [#723](https://github.com/tehki/myaso/issues/723), server/World same actor lease, original live 34HP pointerDOWN light / 46HP 320ms held-release heavy, 2–4 human hosts, immutable staged rollback and explicit Main GO. No main merge, gameplay activation, production QUIC, deployment, restart or waived test.
