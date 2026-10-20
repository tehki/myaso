# E2 — Inert authored parcels and property deeds

**Status:** implementation prototype / **DRAFT, UNMERGED, UNDEPLOYED, DISCONNECTED** from live myaso.io. No land is purchasable in the running game. Economics owns this isolated domain and central orchestration approves integration. The implementation is `server/src/property.rs`.

## Purpose

A real realm needs durable deed ownership of finite, geometrically valid parcels. **A parcel is not a visual building:** it is an explicitly approved, server-authoritative zone claim pinned to the future trusted map revision. No WebTransport commands or browser state exist in this feature.

## Implemented prototype

- Bounded startup catalog (maximum 4096 authored plots) requiring nonzero globally unique parcel IDs, zone IDs and revision numbers.
- Each zone must use one coherent map revision; rectangular bounds must be ordered, finite, coordinate-bounded and non-overlapping **within** a zone. Adjacent parcels may share an edge; another zone may reuse spatial coordinates, not parcel IDs.
- Distinguishes `Residence`, `Workshop`, `GuildHall` parcel categories only as authoring metadata, **not playable or buildable entities**.
- Inert deed registry tracks exact parcel ID, owner identity (server-side numeric placeholder), monotonic title version and operation ID.
- **Registrar-only initial grant**, which is an explicitly nonfinancial administrative test operation, not a sale or proof of payment.
- **Authenticated-owner-only voluntary gift**, which validates the existing owner and expected title version. New owner cannot self-claim somebody else's property; stale versions and duplicate operation IDs are rejected.
- Idempotent repeat calls return their original receipt; conflicting replays or unauthorized callers are denied *before* leaking receipts. Successful events are recorded in a process-local append-only sequence.
- Unit tests cover unauthorized issue/transfer, duplicate issue, unknown parcel, overlaps, touching bounds, invalid extreme bounds, mixed map revisions, missing deed, stale-title replay, idempotent gift and owner change.

## Explicit hard limits

**No purchase, escrow/payment integration, rent, tax, upkeep, house, zone claims, item/loot container, teleport, collisions, account authentication, persistence, replay-safe restart, or live PvP territory mechanism.** The `Actor` type is a future trusted-call contract, not an authentication implementation. Anyone with programmatic access to an in-process public type could construct it; therefore **do not expose this module as a client endpoint**.

The currently accepted game world does not establish approved production parcel locations, so E2 supplies **zero production parcels**. Hardcoded example rectangles in unit tests are not Greyhaven plots, map truth, buildable positions, or claims.

The bounded vector of events and in-memory ID map are for deterministic proof only: they must be replaced or backed by a transactional durable storage design before deployment. The absence of persistent deeds means **nobody has acquired real or durable property through this PR**.

## Ownership economics contract (not active)

- Initial claim and a paid ownership transfer must be atomic with the E1/production ledger, payment escrow and durable inventory/deed event; no partial payment, double charge, double conveyance or unfunded title.
- A voluntary gift is an **unpaid** title conveyance initiated by the actual authorized owner. A market purchase needs a *distinct* transaction API that verifies atomic settlement and anti-wash-trading policy, not a fake gift.
- A player's cryptocurrency account must not drop on PvP death. Real in-game physical item coins, if introduced, need a separate secure conversion mechanism.
- Player rights: primary residence availability, explicit guest permissions and storage rights later; do not let a zone ruler confiscate private assets arbitrarily.
- Territory sovereignty (e.g. guild zone control, siege window and limited taxes) must be separate from perpetual private deed title. PvP victories do not silently rewrite house ownership.
- Inactivity and repossession need published terms, grace periods, notices, deposit/storage safeguards and recovery / appeal before any implementation.
- Progressive secondary-estate upkeep discourages land monopolization; starter houses remain achievable in typical gameplay hours. Treasury fees differ from actual currency burns.
- No ownership or fee is represented by NFT. Any use of Moon Coin/MOCMP requires separate verified token identity and settlement approvals per `docs/MOON_COIN_AWARENESS.md`.

## Review and integration acceptance

Run: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test --locked`, full protected quality CI exact-head. Domain tests alone are not a production proof. For future active property gameplay, add property persistence migrations, concurrency/property-based tests, stale-session protection, transaction recovery, a real authorized map manifest, collision and anti-blockage verification, account deletion/transfer controls, geographical zoning constraints, and two-browser multiplayer acceptance.

Keep this PR independent of E1 draft PR #358 and world-map, Magic & Items, Combat, and UI streams. No changes to live networking, world state, menus, balance or deploy configurations.
