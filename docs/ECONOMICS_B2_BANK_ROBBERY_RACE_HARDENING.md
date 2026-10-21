# Economics B2 — Local vault contention and bounded gold accounting

**Priority:** P2 research after First Playable Alpha. **Owner:** Economics #7. **Status:** isolated, in-memory, offline-only; not an implementation of server-authoritative robbery.

B2 hardens the NPC town-bank fixture in [PR #614](https://github.com/tehki/myaso/pull/614) against common race and economic-arithmetic errors. B0's town-local customer claims and physical reserves, and B1's **untrusted and unconditionally denied** World→bank event schema remain unchanged.

## Safety properties checked

1. **Two physical thieves, one vault.** Independent simultaneous 70-gold robbery attempts against a vault holding 100 gold produce **one success, one refusal**; not 140 gold. Only one town-local event is appended. Carried physical gold plus every vault reserve remains conserved.
2. **Two attempts for the same World event.** Identical publicly forgeable event IDs cannot be used with different bank operation IDs to debit a vault twice, even when the calls race.
3. **Conflicting actors on the same operation ID.** At most one immutable intent commits; the other's different actor and World event cannot steal under the winner's idempotency key.
4. **Robbery racing with a deposit.** Both commit in some serialized order, maintaining independent bank reserves, the depositor's legal claim, the robber's physical loot, and the original total gold. No player gains a global transfer or a claim on a second town.
5. **Strict guard fixture typing.** The *fake* guards-overcome and vault-open fields must be real booleans, not strings, integer `1`, containers, or truthy objects. A false/malformed guard state can never settle even an offline test.
6. **Bounded fixture epoch and gold.** Reject missing/negative/boolean/oversized mock zone epochs and signed-63 overflow on bank reserves, carrying limits, any actor balance, town claim sum, or local operation sequence **before** the model mutates its receipt/event state.
7. **Failed weight-limit events do not commit.** An oversized escape sack is refused without removing vault gold or marking its event as spent. The same mocked event can be retried after fictional carrying capacity is freed; no double credit occurs.

These properties are covered by **nine new tests** in `scripts/test_economics_town_banks_lab.py`, bringing the total **B0 38 + B1 24 = 62 tests**. The implementation update is only `scripts/economics_town_banks_lab.py` and tests; existing game runtime `server/`, `web/`, `src/` and protected quality workflow are untouched.

## Non-production limitations

The model uses a **single Python `RLock`** and an in-memory ledger, so concurrent tests prove serialization **only within one process**. They do not demonstrate PostgreSQL cross-process serializability, server restart safety, actual vault/item consistency, verified Core identity, valid authoritative worker epoch, real Sentinel attacks, 2–4 browser acceptance or any production financial security.

In particular, **`VaultBreachFixture` remains publicly forgeable** and B1's `require_real_atomic_breach_authority` still **unconditionally refuses** a parsed vault event. None of the race tests creates an authorization capability. Do not interpret an independent SHA-256 event fingerprint as proof.

A future real implementation must lock the same authoritative Core 8C source entity/zone row, actual Items gold inventory and bank rows inside **one verified PostgreSQL transaction**, enforce unique event/operation IDs, and reconcile unknown-COMMIT retries. The bank may be physically robbed only after World/NPC/Combat has proven guarded/locked vault access. This is a cross-department decision owned by the Main Orchestrator.

**First Playable Alpha:** defer all P2 economy and vault activity. Preserve the verified playable-combat baseline and existing mandatory Rust, browser and multiplayer CI without bypasses.
