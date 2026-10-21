# Moon Games · Economics B0 — Local Town Banks (P2 design and offline prototype)

**Decision:** NPC-/town-operated banks first. No global account or instant bank transfer; no player-operated deposit banks. Players may eventually own **private vaults for their own property** (future phase, not implemented). Chartered, regulated player-operated banks are a later design question, **not** currently approved.

**Project:** [myaso.io](https://github.com/tehki/myaso) · **Department:** #7 Economics · **Priority:** P2 post–First Playable Alpha · **Status:** EXPERIMENTAL / offline-only.  
**First Playable boundary:** Do **not** integrate B0 into the initial 2–4 player browser city, sword pickup, unarmed combat, death/respawn and networking path. Preserve [small P0 perimeter PR #482](https://github.com/tehki/myaso/pull/482) and the Main Orchestrator's integration authority. B0 does not depend on or modify #482 or the larger [E2d–E2j economy research PR #385](https://github.com/tehki/myaso/pull/385).

## Rules decided

1. **One currency, geographically local custodians.** Gold is physically the same everywhere. Greyhaven's bank account, reserve and deposit ledger have *no* relationship to Red Lion's. A player with 300 gold in Greyhaven cannot withdraw 300 gold from a banker in Red Lion. No global bank UI, account, ATM, wallet, credit line or instant interbank transfer.
2. **NPC town institution.** The bank belongs to its town, operates from a physical building, and is represented by a banker, locked vault and guards/Sentinels. Player ownership of customer deposits is **not** an Alpha/B0 feature. Players may later protect caravans, hunt thieves, work as guards, and eventually maintain a private treasury (without accepting stranger deposits).
3. **Actual physical value.** Depositing gold transfers units from a verified player-controlled *physical inventory* into the town's authoritative vault reserve, while creating an equal customer claim. A withdrawal reverses that transfer only at the same bank, only for the true claimant and only when its physical reserve and solvency allow payment. A coin cannot exist both in player inventory and the bank vault.
4. **Robbery is a real World/AI/Items/Combat event.** Vault access is a physical problem (guards, locked doors, reinforcement, escape weight and consequences), not a menu button or a probabilistic reward. A **world-authoritative committed vault-breach event** would cause an Economics transaction removing *only the stolen physical gold* from that vault and placing the same amount into verified robber/loot inventory. Players' ledger claims are **never silently erased** by the robbery.
5. **Real bank failure has consequences.** Each town has physical reserve `R` and owed customer deposits `L`. Its reserve-backed equity is `R − L`. A raid decreases `R`, not `L`. If `R < L`, the bank enters a crisis state. The B0 lab freezes new deposits/withdrawals rather than rewarding fastest-clicking depositors and creating unfair bank runs. Future World/Economics design must cover restitution/recovery, town capitalization, insurance limits, bounty financing and appropriate anti-grief protections.
6. **Gold has weight.** Carrying capacity applies to withdrawals and robberies. Later, genuine item stacks, carts and caravans must supply physical transfer and hauling limits, not an account-only teleport.
7. **No interest, loans, debt creation, magic insurance, player-owned bank or interbank wires in B0.** These should be designed later, if they improve actual multiplayer gameplay.

## Small implemented reference model

`scripts/economics_town_banks_lab.py` is a Python-stdlib, in-memory, thread-locked **test harness**. It models:
- Independent `town -> vault reserve, claimant balances, local operation sequence, audit events`; `town_state.operator == "town_npc"`.
- Separately modeled carried gold and mock visitor location. `deposit` and `withdraw` require a locally present visitor, adequate gold, and bank solvency.
- Mock `robbery_fixture` transfers physical vault gold into robber inventory with a bounded carrying limit, emits a town-local `BankEvent(operation="robbery", world_event_id=...)`, and rejects duplicate consumption of the same fictional World event across towns.
- Identical idempotency retries return one immutable original receipt; a conflicting replay is denied. No cross-town account transfers or balance conflation. No customer ledger write is used to disguise theft.
- Strong numerical demonstration invariant: `sum(all player-carried gold) + sum(all town vault reserves)` stays constant across accepted bank operations and robberies. Debits, insolvent-bank operation refusal and failed/contending withdrawals do not partially apply.

`scripts/test_economics_town_banks_lab.py` exercises **29 deterministic tests**, including NPC-only ownership, multiple banks, real reserve movement, cross-town isolation, per-bank ledgers and sequence numbers, deposit/withdraw retry, insufficient gold, two concurrent withdrawal contenders, vault/guard/zone fixture mismatch, one-shot raid events across towns, weight limit, local alarm event, unreduced customer claims, insolvency, and a **deliberately forged test raid** that demonstrates the mock proof is **not authoritative**.

## Security / production blockers — MUST NOT ACTIVATE

This test code is **not a production banking system or account authenticator**. `travel_fixture()` teleports a local test actor; `VaultBreachFixture` is publicly constructible. A malicious caller can fake all its guards/locks/world receipt fields. There is **no authenticated player identity, actual physical gold inventory, Sentinel AI, persistent deposit store, bank NPC, bank building, network route, currency wallet, money contract or crash consistency**. Nothing here may be imported by `server/src` or `web/`, deployed, given economic value, or treated as an authorization decision.

A real implementation requires central review and **the same authoritative atomic transaction** spanning: verified account↔`CharacterId` and durable session generation; player/item/container gold state; unique physical vault identifier; bounded carrying capacity; town/zone worker epoch authority and committed World vault-breach receipt; bank claimant liability; bank local reserves; immutable operation and world event IDs; audit/outbox; insolvency policies. The account transfer and robbery aftermath must be fenced against double-commit, disconnect, retries, stale zone ownership, two competing thieves and server crash. Core 8B/8C, Items 2B, World 9, NPCs 1, Combat 4, UI 10 and Main Orchestrator all have ownership boundaries.

The previous Economics E2j **disposable PostgreSQL 16** laboratory proves atomic *fictional property settlement*, **not** this bank/gameplay integration. B0 is a separate prototype; it must not be merged as production-ready or used to block the First Playable Alpha.

## Real gameplay acceptance, when promoted in a later milestone

Two independent real browser sessions enter Greyhaven. The first player physically walks into its bank, interacts with its banker, deposits a real inventory gold stack, sees it removed from inventory and recorded only in Greyhaven. They then travel to Red Lion and verify the Greyhaven claim is unavailable there. Two or more attackers fight Sentinels, open the Greyhaven vault under authoritative world/zone proofs and physically escape with weight-limited stolen sacks. Actual servers and reconnecting browsers agree on vault depletion, thief inventory, local NPC alarms, remaining claimant balances, bank solvency and idempotent replay after a network ACK loss. Different-town reserves remain unaffected. Dedicated Chrome/Firefox, independent-device multiplayer and crash-recovery evidence must pass before any feature is called **PLAYABLE**.

**Ownership and integration:** Economics develops B0 ledger invariants and interface contracts; Main Development & Deployment Orchestrator sequences cross-department integration and releases. No permission is implied to merge, deploy or enable any real currency or player-owned financial institution.
