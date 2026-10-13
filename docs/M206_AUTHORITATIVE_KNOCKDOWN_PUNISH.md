# M206 — authoritative third-party knockdown punish phase proof

## Observed flake

[M205 PR #237 quality run #38360425539](https://github.com/tehki/myaso/actions/runs/38360425539) failed existing M155 genuine three-browser third-party kick-knockdown punish proof. The real Chrome2 light LMB entered the authoritative windup at server tick 345 and recovery at 357; the intermediate unchanged ~80ms attack-active phase was absent from sampled 50ms browser replicated snapshots, causing a false negative. Unchanged rerun passed M155. This is the same failure class as M201 guard-break punish but in another multiplayer interaction, and is separately tracked at [issue #238](https://github.com/tehki/myaso/issues/238).

## M206 acceptance-only repair

Extend existing `MYASO_FLIGHT_ACTION_PROOF=1` loopback server trace enablement to exactly the real `uikickknockdownffahit` browser acceptance scenario. No protocol or gameplay change; the Rust server still rejects the fixture on any non-loopback bind.

The independent verifier reads the same native 60Hz Rust stdout action/hit sequence and requires:
- Genuine kicker light-independent kick *active* server action (wire 13) before target knockdown (wire 19).
- One different real punisher action windup-to-active (wire 1→2), the *same* strike, within the unchanged 360ms / 22-server-tick knockdown lifetime.
- Exactly one authoritative 34 HP hit, from punisher to knocked-down fighter, resulting in 66 HP and occurring during the actual active phase before knockdown expiry/recovery.
- No hits to the kicker or any other target after that knockdown.
- Native monotonic server ticks and distinct actual browser fighter IDs.

Separate real Chrome, Firefox and Chrome2 browser proofs remain mandatory, including one genuine RMB kicker kick, exactly one genuine Chrome2 LMB down/up with correct aim, authoritative knockdown on Firefox, clean 100HP/100-guard kicker and punisher, correct victim-local 34HP feedback, focus and HUD phase clearing. Browser snapshot active-phase presence is recorded as optional *diagnostic only*; the 60Hz authoritative server edge becomes mandatory evidence. No browser epoch is compared to server tick.

The unchanged M205 **three fresh M152 guard-break sessions** stay required in CI. M206 changes only loopback acceptance flag routing, its server-tick verifier, two focused integration tests and documentation. Full exact-head CI, Rust, real browsers, FFA and 512-player capacity; then independent merged-main run before completion. Production and public playable remain closed.
