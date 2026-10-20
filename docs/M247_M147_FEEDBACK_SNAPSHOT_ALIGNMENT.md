# M247 — M147 cross-browser feedback snapshot alignment

## Observed failure

On 18 October 2026, the exact-head quality run [39111480793, attempt 1](https://github.com/tehki/myaso/actions/runs/39111480793) observed a genuine three-browser M147 recovery-punish hit: the jump attacker had 66 HP after precisely one real light strike, while observer/punisher and the closer idle rival remained at 100 HP and full guard. The recovered focus had correctly returned to the closer idle rival. However, the punisher's observed snapshot was at server tick 351 and still contained only the *attack committed* event; the damaged victim was already at server tick 354 and had *hit taken - 34 HP*. The strict feedback check read those non-simultaneous snapshots as if they were aligned and failed.

The same unchanged head subsequently passed M147 on its controlled attempt-2 rerun, demonstrating variability. Attempt 2 later failed the independent M194 real guard-break staging; **this M247 change does not fix M194**.

## Bounded read-only correction

After a *real* authoritative selected-victim hit is observed, and after the jump-attack recovery is complete and focus returns, allow up to 240 ms for the punisher's own authoritative hit-confirm event to arrive in a later 20 Hz snapshot. Each observation rereads all three genuine Chrome/Firefox browser states and immediately rejects any extra damage or lost guard. No click is repeated or synthesized, and the maximum wait is bounded.

All existing provenance, one actual Space+LMB jump chord, exactly one real punish LMB, 290 ms jump-recovery input deadline, selected target identity, 34 HP damage, third-party untouched 100 HP/guard, hit feedback and focus-return assertions remain intact. This is solely acceptance observation scheduling. It changes **no** production game behavior, server ticks, combat rules, network frames, damage, recovery, or stamina.

## Release gate

Keep draft until full exact-head Rust/Chrome/Firefox quality passes and independently merged-main validation succeeds. Do not stage or activate production based on this narrow correction. Investigate M194 separately.
