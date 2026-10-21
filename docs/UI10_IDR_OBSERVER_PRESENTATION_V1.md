# UI 10 — IDR observer-specific presentation cache (DORMANT)

Engineering owner: Moon Games UI 10. Tracking: [IDR/UI #658](https://github.com/tehki/myaso/issues/658), [IDR master #636](https://github.com/tehki/myaso/issues/636). Parent: [IDR phase-1 #633](https://github.com/tehki/myaso/pull/633).

## Delivered source boundary

`src/browser/identity-visibility.mjs` now formats **every claimed alias** as `Calls themselves X` (including a raw `X` projection), while a verified label can be shown without the prefix **only after an external authenticated server-viewer adapter has confirmed evidence**. This is a display distinction, not proof that the client can authenticate the label.

`src/browser/idr-observer-view-cache.mjs` is a dormant, pure, bounded browser presentation cache for an eventual Core 8A **viewer-validated** identity projection. It is not imported from `web/online-game.mjs`. It does not open a channel, send a packet, create or verify a signature, call a server method, modify Combat or equipment, or enable IDR in production.

The proposed *internal-only* UI adapter inputs are `viewerRef` (opaque canonical viewer reference), `sessionRef` (authenticated active connection), `sessionEpoch`, `actorRef` (opaque same-world actor), `revision`, `appearanceEpoch`, `certainty: unknown|claimed|verified`, and a safe public `label` only for claimed/verified. These are not a finalized Core 8A wire schema; no IDs, sequence numbers, certainty or evidence may originate from free-form chat or browser controls.

Only a future trusted 8A adapter may attach a session and pass observations **after validating recipient, active canonical lease, protected message authenticity, zone, server observation epoch, ordered revision and Core8B verified-evidence provenance**. This in-memory cache cannot perform those checks. Any unauthenticated caller can invoke JavaScript methods and MUST NOT be treated as an identity trust authority. It explicitly **cannot attest** signatures, LOS, witnessed costume changes or durable knowledge.

The cache denies observations before a viewer session, wrong-recipient or wrong-lease updates, non-monotonic per-actor revision, older appearance epochs, conflicting equal revision, unsafe names, private true-name or controller-kind fields, and capacity exhaustion. Exact equal-revision retransmission may be idempotent. It resets across every session attach and disconnect and tombstones retired actors for that session. A new appearance epoch replaces the viewer's previous view only with an authorized NEW server projection: witnesses may retain `Verified`; non-witnesses see `Unknown stranger`, without client guessing who saw a costume swap.

This does not hide temporary net IDs in raw QUIC, privilege/debug network captures, server audit, nor NPC vs player controller meta. No in-world `Introduce as...` packet or verification event is connected; Core 8A/8B/8C/Physics must agree on their live authoritative contract first. The existing chat text remains **unverified**, and original four-browser IDR-preview acceptance [#652](https://github.com/tehki/myaso/pull/652) remains a separate independent test.

## Required future gates

1. Core8B/8A signed or otherwise authenticated viewer-specific projection contract and fresh/anti-rollback identity epoch; never a browser-created `verified: true` flag.
2. Core8C, World9 and Physics verified LOS, witness evidence and appearance epoch; NPC1/Sentinel indistinguishability.
3. UI wiring to exactly one source of projection truth, including accessible labels, hover, scoreboard, nameplate, focus, killfeed, chat, debug surfaces and secure `Introduce as...` intent; no duplicate chat/Canvas loops.
4. Genuine Chrome and Firefox viewers observing different authenticated labels for the same actor, reconnect/disguise replay adversaries, unchanged Combat and Chat C1 tests and protected exact-head CI.

This PR is **DRAFT / DEFAULT OFF / NO MAIN MERGE / NO PRODUCTION ACTIVATION**. IDR social features must not delay P0 four real rack swords, authoritative pickup or First Playable Alpha.
