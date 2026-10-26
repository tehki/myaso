# Combat 4 × Core 8A × UI 10 — Pre-Alpha P0 dormant DOM-to-World proof

**DRAFT TEST-ONLY INTEGRATION / NO LIVE GAMEPLAY.** This source builds on Combat4+Core8A joint [#721](https://github.com/tehki/myaso/pull/721) exact `5c6fefafc9ce29948859a80a5839713c01820f76`, including original World real-HP Combat4 [#717](https://github.com/tehki/myaso/pull/717). It cherry-picks without conflict and without changing authoring source the **five exact original commits** of UI10 [#720](https://github.com/tehki/myaso/pull/720) head `b6ee90979993876f7ad2edc7d9d160a7a25a9646`, and adds only this scope document plus **one new interop test**.

## Exact source-to-source verification

New `tests/prealpha-ui10-core8a-combat4-world-source-interop.test.mjs` invokes the actual dormant UI10 `createDormantPrealphaLmbDomGate`, not a reimplementation. Synthetic *test fixture* pointer objects are passed through the source adapter (native WebDriver validation exists independently at UI10's [dedicated genuine Chrome+Firefox workflow #39720172059](https://github.com/tehki/myaso/actions/runs/39720172059) SUCCESS). It consumes the **actual** Core8A `ProposedLmbGestureOutbox` and checks the exact bytes against the independent Rust source-owned golden vectors used by `server/tests/prealpha_core8a_world_wire_interop.rs`, which drive actual `decode_event` → `GestureAuthority` → review-only `World` and real CombatEvent HIT/HP tests.

- One UI `pointerDown` and `pointerUp`, both at client sampling tick 42, yield precisely two 16-byte type `0x11` messages with event sequences 1,2 and SAME gesture ID 1. Original Rust v2 World tests prove this same tuple starts actual server light windup and results in **one 34HP HIT** (victim 100→66), even though no intermediate v1 sample recorded the held bit.
- One UI `pointerDown(42)`, explicitly reviewed `approvedHoldUpgrade(43)`, and `pointerUp(63)` produce exactly three 16-byte messages with matching gesture ID and sequential event IDs. Original Rust interop with those bytes proves server-owned 320ms READY until matching RELEASE and exactly **one 46HP HIT** (victim 100→54), no early HP mutation.
- Blur after an upgrade issues a correlated `CANCEL`, never synthesizes terminal heavy `RELEASE`; chat focus and Space+LMB chords do not start v2 LMB; right mouse does not start it either. The original online browser and server main contain **no import, listener registration, v2 ingress or activation** of these proposed types.
- Existing 30Hz v1 input packet remains exactly unmodified. Core8C's competing `0x52` v2 envelope is intentionally NOT ingested by our `0x11` decoder; Main/Core8C warned it cannot be treated as the same ABI.

## Executed test gates

- New cross-department JS interop **4/4 PASS**; combined dedicated Core8A/Combat codec/UI10/source checks **29/29 PASS**.
- Rust previous exact-wire → real World **4/4 PASS**, Combat World **11/11 PASS**, gesture reducer **12/12 PASS**, proposal codec **3/3 PASS**.
- Full combined source **591/591 Node PASS**; full locked Rust Cargo PASS including real preexisting QUIC/WebTransport tests, all-target strict Clippy `-D warnings` PASS, Rust formatting and Git diff whitespace PASS.
- Independent UI10 [genuine Chrome+Firefox DOM workflow #39720172059](https://github.com/tehki/myaso/actions/runs/39720172059) SUCCESS and independent Combat4 parent [full protected quality #39718883329](https://github.com/tehki/myaso/actions/runs/39718883329) SUCCESS are **different source heads** and **must NOT be substituted for this combined head's own protected CI**. Parent #721 quality #39720172215 was running at last check.

## Strict remaining gates

**Not tested or implemented here:** authenticated negotiated v2 WebTransport transport/ACK delivery in real client/server, session-issued per-actor lease/epoch fencing, server-integrated v2 tick/World command dispatch, lost/reordered WAN inputs, actual gameplay `web/online-game.mjs` pointer binding, concurrent KeyE/RMB/Space/Chat Enter/Escape arbitration, native authenticated browser HIT tests or 2–4 different human computers, Physics post-hit third-party separation, final assembled Silver/R4/optional OFF Chat C1 exact source QA, immutable release, rollback and Main GO.

Main/Core8A/Core8C/Combat4 must explicitly agree **one canonical versioned wire ABI**. Core8C has cautioned its alternate `0x52` contract must not be mixed with Combat4+Core8A `0x11/0x12`; separate actor epoch/source-channel review still required. Any future real runtime must replace legacy LMB callback atomically, not run two listeners and double strike.

**Do not merge to `main`, deploy, open a public listener, restart, stage, waive original strict native M acceptance, or claim instant-light is playable.**
