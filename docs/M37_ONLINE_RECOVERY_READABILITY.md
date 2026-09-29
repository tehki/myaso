# M37 Online Recovery Readability

## Objective

Make the opponent's authoritative recovery window directly readable in the normal online arena so commitment visibly creates counterplay.

## Product behavior

In the unambiguous two-fighter online view, the opponent HUD shows a small `PUNISH` cue only while replicated authoritative state says the opponent is recovering:

- `AttackRecovery` -> `PUNISH / Attack recovery`;
- `DodgeRecovery` -> `PUNISH / Dodge recovery`.

The cue disappears as soon as the opponent leaves recovery. It is suppressed when more than two authoritative fighters are present so the client does not invent opponent attribution in an FFA state.

The cue is presentation-only. It does not predict recovery, change action timing, or grant client combat authority.

## Acceptance

Deterministic browser-readability coverage verifies both recovery states and hidden idle behavior.

The dedicated `uirecovery` flight reuses the proven production `index.html` Chrome+Firefox authoritative hit choreography. The defender must passively observe the attacker's replicated `AttackRecovery` and render `PUNISH / Attack recovery`; the attacker must not render its own recovery as an opponent cue. The defender cue must clear after authoritative recovery ends.
## Local evidence

- Coding-agent policy sentinel: PASS.
- Repository governance sentinel: PASS.
- Focused readability tests: 16/16 PASS.
- Browser/runtime suite: 34/34 PASS.
- Combat model: 9/9 PASS.
- Networking/compact snapshot suite: 24/24 PASS.
- Browser hot-path probe: replacement entity objects = 0.
- JavaScript syntax and `git diff --check`: PASS.
- Local real-browser flight: not executed because this Windows host has no `cargo`/browser-driver toolchain available on PATH; the attempted flight stopped before product execution at `spawn cargo ENOENT`.

## Base / risk / rollback

Base is frozen M36 exact head `c2aa8e1558a82d36a029745511690100df1909d9`.

This is a presentation-only change consuming already-authoritative opponent action state. No server simulation, 255 ms attack recovery, 165 ms dodge recovery, damage, guard, parry/dodge windows, wire protocol, persistence, networking, public bind, deployment, or production activation changes.

Rollback is to close/discard M37; frozen M36 remains unchanged. FULL CI, including the real Chrome+Firefox M37 flight, is required before M37 acceptance.