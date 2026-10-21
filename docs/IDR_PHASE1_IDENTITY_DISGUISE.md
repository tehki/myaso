# Moon Games — IDR Phase 1 (draft, 2026-10-21)

## Why

The owner wants a social world in which a Knight can masquerade as a Sentinel,
a Sentinel can blend in with human players, and observers do not receive true
names or human/NPC status without evidence. An introduction is **a claim**,
not verification. Different observers can hold conflicting beliefs.

## Implemented in this child of UI #607

- A new **server-only dormant Rust identity policy** at
  server/src/identity_disguise.rs, using nonzero 128-bit domain SubjectId.
- Private Human/Sentinel controller type, true name and disguise status; no
  corresponding controller flag, true ID or true-name field in the public
  ObservedIdentity projection.
- Per-observer Unknown / Claimed / Verified status. Saying "I am Tomas" changes
  only the receiving observer's claim; Core-only trusted evidence can reveal
  the actual character name. An unverifiable self-introduction NEVER verifies.
- Appearance changes increment a monotonic presentation epoch; only witnesses
  validated by the calling World/Physics layer retain recognition. An observer
  who did not see the change must rediscover the new appearance. Disguise is
  NOT assumed to erase what a witness already knew.
- Register/remove and bounded memory for 512 active subjects and 8192
  observer/subject knowledge pairs; remove revokes all related knowledge.
- Name validation rejects HTML tags, newlines, bidi controls, ambiguous
  reserved game/admin labels and excessive length.
- A separate **loopback-HTTP-only** ?idrPreview=1 presentation path: online
  scoreboard shows You / Unknown stranger; combat focus and kill-feed net-ID
  labels are redacted, HUD generic player-# labels are redacted, and the
  optional existing authenticated Chat C1 bridge shows "Unknown voice" instead
  of "Player #42". Chat delivery, sender authentication, message content,
  player combat state and game protocol are unchanged.
- Pure observer projection and presentation tests exercise Human/Sentinel
  indistinguishability, individual claims, lies, verified evidence, witness
  knowledge through a disguise, lost non-witness recognition, stale identity
  reuse and legacy/default UI behavior.

## Why this is NOT the complete live identity system

**IDR IS DORMANT / NOT LIVE / NOT ANTI-TRACKING SECURITY.**

1. SubjectId is NOT yet Core 8B CharacterId. There is no reviewed mapping to
   8B session leases and zone identity, no durable knowledge store, server
   transaction, migration or rollback proof.
2. No authenticated client packet exists for Introduce, ChangeDisguise or
   Evidence; intentionally none is added here. The Rust methods must only be
   invoked from trusted Core game code. The authority must validate proximity,
   line of sight, character state, disguise material/equipment and witnesses.
3. Current QUIC snapshots expose temporary network slot IDs and some Combat
   HUD/debug labels. A client or an outside observer may correlate movements
   or network metadata. Presentation redaction alone cannot promise that
   "nobody knows it is a player"; full wire minimization and common NPC/player
   representation require Core 8A/8C + NPCs1 design/review.
4. No real Sentinel AI disguise behavior or source character art is activated.
5. Player-authored chat claims are plain chat text; the client does not parse
   phrases as verified truth or auto-update knowledge.
6. The current public online game is UNCHANGED by default. Preview requires
   localhost HTTP explicit opt-in. No production feature flag enabled, no
   live world/item ownership modification, no server restart.
7. Identity presentation does not substitute for server-authoritative PvP
   targeting, moderation audit or actual canonical ownership; admin tooling
   must continue to identify every account truthfully.

## Required next cross-department stages

- **8B / 8C:** bind the canonical u128 subject to the one stable character ID,
  zone/world authority epoch and durable observer-specific evidence store.
  Trust-checked observation changes require transaction/recovery and rollback.
- **8A:** design recipient-specific observations without raw true names, actor
  kind or canonical IDs; use opaque per-recipient visual actor keys where safe,
  preserving authoritative Combat focus and audit.
- **NPCs 1 / Graphics 3A:** common observable player/Sentinel appearance and
  animation envelope, real clothing/unmasking events and AI recognition.
- **World 9 / Physics 6:** validated visibility and LOS witness set,
  interaction distance, same-tick appearance and evidence.
- **UI 10:** connect authenticated server observation snapshots to one names
  adapter and complete all name/role leak audits in HUD, targeting, messages,
  scoreboard, accessibility attributes, sound and client diagnostics.

## Release and evidence rules

Remain a draft stacked on UI #607; Core 8B and Department 1 review required.
Run focused Rust identity tests, full relevant server library and Node suites,
format/Clippy and full protected CI on the EXACT committed head. Genuine
four-real-browser Greyhaven identity acceptance, independent-host gameplay
and all First Playable M1–M5 gates remain unverified here.

Never treat an NPC disguise sprite, a typed local test, a chat "I'm Aldric"
message or a redacted DOM label as a verified server-authoritative identity.
