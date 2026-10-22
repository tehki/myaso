# Economics B1 — Read-only World → Town Bank vault-breach event contract

**Status: P2 experimental, NOT player-accessible, NOT trusted, NOT deployed.**

This reference contract documents a future World 9 / Items 2B / Core 8B–8C → Economics 7 boundary. It is not a banking server, does not authenticate any World event and cannot move gold. The [B0 NPC bank concept](./ECONOMICS_P2_LOCAL_TOWN_BANKS.md) is unchanged: one physical currency, independent NPC-run banks per town, no global account transfers, robbable vaults only after real gameplay guards/locks and authority are built, no player-owned deposit bank in First Playable.

## Canonical untrusted event envelope

`scripts/economics_bank_world_contract.py` defines `UntrustedVaultBreachEnvelope` and strict `parse_untrusted_world_envelope`. It uses exact canonical JSON with **no duplicate, missing or unknown fields**, no signed/float/bool integer coercions, ≤2048 bytes, and an exact version `myaso.bank-vault-breach.v1`.

Required fields:

| Field | Meaning / bound |
| --- | --- |
| `schema` | Exact `myaso.bank-vault-breach.v1` |
| `town_id` | Canonical lowercase ASCII identifier, ≤48 characters |
| `vault_entity_id` | Nonzero 128-bit Core-shaped entity identifier, lower-case 32 hex |
| `event_id` | Nonzero unique 128-bit World event ID, lower-case 32 hex |
| `actor_character_id` | Nonzero full-width `CharacterId(u128)`, lower-case 32 hex |
| `loot_container_id` | Nonzero full-width future physical loot container ID, lower-case 32 hex |
| `worker_id` | Positive signed-63-compatible integer, declared origin worker |
| `zone_id` | Positive signed-63-compatible integer, zone |
| `authority_epoch` | Positive signed-63-compatible integer |
| `session_generation` | Positive signed-63-compatible integer |
| `vault_revision` | Positive signed-63-compatible integer, expected source revision |
| `world_tick` | Nonnegative signed-63-compatible integer |
| `stolen_gold` | Positive integer, ≤1,000,000,000,000 fictional units |

The serializer generates canonical sorted-key UTF-8/ASCII bytes and a SHA-256 **fingerprint for comparison, not a signature**. Any caller can invent all fields and calculate a valid hash. Parsing is not a player identity check, not Sentinel/lock verification, not proof of a committed World event, and not proof that loot physically exists. Zero/short/narrowed IDs, malformed bytes, unknown schema, canonicalization bypass attempts and JSON duplicate keys are rejected. Events do not contain owner-controlled wallet details or account mutations.

**Hard fail-closed boundary:** `require_real_atomic_breach_authority(envelope)` explicitly raises `BankWorldAuthorityUnavailable` for **every valid envelope**. The module deliberately exports no `authorize_vault_breach`, `commit_vault_breach`, or `apply_robbery` function. Existing B0 `robbery_fixture` remains an *offline, publicly forgeable test method* only; no B1 field grants permission to invoke it in a real game.

## Non-negotiable future transaction

1. Real Core must establish the active authenticated account ↔ `CharacterId` relation, durable session generation, correct current worker/zone/epoch and vault entity authority. Do **not** use a raw `player_id:u32` transport ID or a client-provided tuple.
2. World/NPC/Combat must authoritatively determine physical forced entry or lock opening, defeated/evaded Sentinels, actual breach, town/world region and replay-safe one-shot World event.
3. Items must atomically transfer precise physical gold from the persistent **unique vault container** to the robber's actual bounded loot inventory, not credit coins out of thin air or generate a drop unrelated to reserves.
4. Economics must lock and mutate local bank physical reserve, global physical conservation invariants, local depositor liabilities **unchanged** by theft, bank insolvency status, unique receipt/outbox, town alarms and recoverability, with durable optimistic revisions/fences.
5. Those checks and all consequential writes must occur in **ONE approved PostgreSQL transaction** with the same Core zone-authority row locked and correctly ordered locks. A separate “verified event” call followed by a later bank database commit is **not atomic**. Previous events and nonce IDs must not be accepted twice across different bank zones.
6. The failure model must cover competing thieves, stale zone-worker handoff, two different sessions, code crash, transaction rollback/unknown COMMIT, source World event rejection, inventory overflow, bank insolvency and independent-session browser reconnection.
7. Production account security requires restricted PostgreSQL roles, real authentication, migration/backup/restore, rate limiting and gameplay rules preventing repetitive offline player griefing, along with Main Orchestrator approval and full independent-machine Chrome/Firefox multiplayer gameplay acceptance.

Until these dependencies exist, this contract is **only a serializable proposed message**, not a World-authenticated business event. In particular, future programmers MUST NOT simply feed a valid JSON payload into `LocalTownBanksLab.robbery_fixture()`.

## Tests

`scripts/test_economics_bank_world_contract.py` adds **24** cases to B0's 29: canonical roundtrip, 128-bit high-bit IDs, field/schema/overflow bounds, duplicate key and noncanonical JSON rejection, hostile UTF-8/numbers/booleans, distinct loot/vault IDs, stable comparison hash (explicitly not cryptographic authentication), forged claim rejection, and observation that **no town reserve/account/event changes** occur after parsing an otherwise valid untrusted event.

Local authorized Serj: **53/53 B0+B1 Python unittest cases passed**, bytecode compilation passed. Full required protected CI remains independently required and does not imply gameplay integration or actual robberies.

**Alpha:** This work is separate **P2**, and must not block the existing P0 first playable shared-city sword pickup, real combat, respawn and browser networking objective. Keep PR draft, no merge/deploy outside central governance.
