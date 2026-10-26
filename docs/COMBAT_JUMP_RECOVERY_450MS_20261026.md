# Combat decision — 450 ms jump-attack recovery

**Approved by the game owner:** 26 October 2026

**Scope:** M147 actionable recovery-punish opportunity following a jump attack

**Status:** Gameplay balance change awaiting exact-head native/QA validation; release HARD HOLD

The authoritative Rust World and the JavaScript combat model now use **450 ms** for `JumpAttackRecovery` (previously 290 ms). At the original 60 Hz server tick this is 27 World steps. This extends the interval in which an opponent can deliberately recognize and land a legitimate recovery punishment.

The original **135 ms light windup**, **34 HP light damage**, **46 HP heavy damage**, **125 ms parry window**, **240 ms short block**, and all other recovery durations stay unchanged. The server remains the sole authority on action eligibility and actual HIT/HP.

**M147 acceptance is unchanged:** a genuine third-party Light attack must commit one authoritative 34 HP HIT **strictly before** the victim exits `JumpAttackRecovery`; a late HIT remains a failure. A 450 ms balance change is not itself a test PASS.

Legacy milestone notes that say 290 ms document the previous rule. They do not qualify the new 450 ms version. Independent Combat 4D must revalidate M140/M143/M144/M147, standard native Combat, original World tick boundaries, packet-loss and parry regressions on a single immutable SHA before promotion.

No production deployment, public experimental gesture/HIT activation, merge or release GO is authorized by this decision.
