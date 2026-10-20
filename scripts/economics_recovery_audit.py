"""E2d offline SQLite recovery audit + independently retained logical checkpoint.

This is a lab verification aid, NOT a credential, payment rail, physical
durability guarantee, or tamper-resistant checkpoint issuer. An attacker able
to replace both the DB and caller's expected anchor defeats digest matching.
Only run against disposable E2d fixtures; no game-server API calls this.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
import sqlite3


class CorruptState(Exception):
    """An internal invariant or expected externally held checkpoint failed."""


@dataclass(frozen=True)
class RecoveryAnchor:
    """Must be held outside the file being verified and trusted by the caller."""
    sequence: int
    logical_sha256: str


@dataclass(frozen=True)
class AuditReport:
    sequence: int
    issued_units: int
    accounts: int
    owned_parcels: int
    receipts: int
    inbox_events: int
    logical_sha256: str
    mutation_revision: int
    global_revision: int


TABLES = (
    ("metadata", "singleton"),
    ("global_events", "revision"),
    ("admission_mutations", "revision"),
    ("accounts", "id"),
    ("titles", "parcel_id"),
    ("listings", "id"),
    ("admitted_sessions", "player_id,epoch"),
    ("seller_consents", "id"),
    ("receipts", "sequence"),
    ("postings", "sequence,slot"),
    ("outbox", "sequence"),
    ("title_projection", "parcel_id"),
    ("projection_inbox", "sequence"),
)


def _reject(reason: str) -> None:
    raise CorruptState(reason)


def _read_existing(path: str | Path) -> sqlite3.Connection:
    file = Path(path).resolve()
    if not file.is_file():
        _reject("No existing backup/database to verify")
    # Opening with mode=ro prevents sqlite3.connect silently creating an
    # empty file after a failed restore.
    db = sqlite3.connect(f"{file.as_uri()}?mode=ro", uri=True, isolation_level=None)
    db.execute("PRAGMA query_only=ON")
    db.execute("BEGIN")  # a single consistent snapshot throughout the audit
    return db


def _one(db: sqlite3.Connection, query: str, parameters: tuple = ()) -> tuple:
    rows = db.execute(query, parameters).fetchall()
    if len(rows) != 1:
        _reject("Expected exactly one authoritative metadata record")
    return rows[0]


def _decode(value: str) -> dict:
    if not isinstance(value, str):
        _reject("Nonnumeric/nontext journal encoding")
    try:
        parsed = json.loads(value)
    except (ValueError, TypeError) as exc:
        raise CorruptState("Malformed stored JSON") from exc
    if not isinstance(parsed, dict):
        _reject("Stored JSON must be an object")
    return parsed


def _all_rows(db: sqlite3.Connection, table: str, order: str) -> list[tuple]:
    return db.execute(f"SELECT * FROM {table} ORDER BY {order}").fetchall()


def _audit(db: sqlite3.Connection) -> AuditReport:
    if _one(db, "PRAGMA integrity_check") != ("ok",):
        _reject("SQLite page/index integrity check failed")
    if db.execute("PRAGMA foreign_key_check").fetchone() is not None:
        _reject("Foreign-key constraint check failed")

    meta = _one(
        db, "SELECT sequence,issued_units,title_cap,mutation_revision,global_revision FROM metadata WHERE singleton=1"
    )
    if db.execute("SELECT count(*) FROM metadata").fetchone()[0] != 1:
        _reject("Additional metadata records")
    seq, issued, cap, mutation_revision, global_revision = meta
    if (seq < 0 or issued < 0 or cap <= 0
        or mutation_revision < 0 or global_revision < 0):
        _reject("Invalid committed policy")

    accounts = db.execute(
        "SELECT id,kind,units,revision FROM accounts ORDER BY id"
    ).fetchall()
    account_kinds = {ident: kind for ident, kind, _, _ in accounts}
    if not accounts or sum(kind == "treasury" for _, kind, _, _ in accounts) != 1:
        _reject("Missing or duplicate treasury")
    if (
        any(ident <= 0 or units < 0 or revision < 1
            for ident, _, units, revision in accounts)
        or sum(units for _, _, units, _ in accounts) != issued
        or account_kinds.get(1) != "treasury"
    ):
        _reject("Broken account/issuance conservation or treasury identity")

    titles = db.execute(
        "SELECT parcel_id,owner_id,revision,map_revision FROM titles ORDER BY parcel_id"
    ).fetchall()
    title_by_parcel = {parcel: (owner, version, map_version)
                       for parcel, owner, version, map_version in titles}
    if any(account_kinds.get(owner) != "player" or rev < 1 or mr < 1
           for _, owner, rev, mr in titles):
        _reject("Invalid title principal or revision")
    for owner in (ident for ident, kind, _, _ in accounts if kind == "player"):
        if sum(title[0] == owner for title in title_by_parcel.values()) > cap:
            _reject("Ownership exceeds policy cap")

    listings = db.execute(
        "SELECT id,parcel_id,seller_id,expected_title_revision,map_revision,"
        "price,fee_bps,approved_consent,expires_tick,state FROM listings ORDER BY id"
    ).fetchall()
    listings_by_id = {listing[0]: listing for listing in listings}
    consents = db.execute(
        "SELECT id,listing_id,seller_id,parcel_id,title_revision,map_revision,"
        "price,fee_bps,expires_tick,state FROM seller_consents ORDER BY id"
    ).fetchall()
    consents_by_id = {consent[0]: consent for consent in consents}

    mutations = db.execute(
        "SELECT revision,operation_id,mutation_kind,target_id,target_epoch"
        " FROM admission_mutations ORDER BY revision"
    ).fetchall()
    if len(mutations) != mutation_revision or [row[0] for row in mutations] != list(
        range(1, mutation_revision + 1)
    ):
        _reject("Admission mutation revision chain is incomplete")
    if len({row[1] for row in mutations}) != len(mutations):
        _reject("Duplicate admission mutation operation IDs")
    latest_cap_change = None
    seen_issued = set()
    for revision, operation_id, kind, target, epoch in mutations:
        if kind == "session_issue":
            if epoch <= 0 or (target, epoch) in seen_issued:
                _reject("Duplicate or invalid fixture session issue")
            seen_issued.add((target, epoch))
            row = db.execute(
                "SELECT state FROM admitted_sessions WHERE player_id=? AND epoch=?",
                (target, epoch),
            ).fetchone()
            if row is None or row[0] not in ("active", "revoked"):
                _reject("Committed session issue lacks admitted epoch")
        elif kind == "title_cap_change":
            if epoch != 0 or target <= 0:
                _reject("Malformed title cap policy mutation")
            latest_cap_change = target
        elif kind == "session_revoke":
            recorded = db.execute(
                "SELECT state FROM admitted_sessions WHERE player_id=? AND epoch=?",
                (target, epoch),
            ).fetchone()
            if recorded != ("revoked",):
                _reject("Committed session revocation missing from admission table")
        elif kind == "listing_revoke":
            listing_state = db.execute(
                "SELECT state,approved_consent FROM listings WHERE id=?",
                (target,),
            ).fetchone()
            if listing_state is None or listing_state[0] != "revoked":
                _reject("Committed listing revocation missing from registry")
            consent_state = db.execute(
                "SELECT state FROM seller_consents WHERE id=?",
                (listing_state[1],),
            ).fetchone()
            if consent_state != ("revoked",):
                _reject("Committed seller-consent revocation missing")
        else:
            _reject("Unknown mutation kind")
    if latest_cap_change is not None and latest_cap_change != cap:
        _reject("Current property cap disagrees with last committed mutation")

    receipts = db.execute(
        "SELECT op_id,payload,buyer_id,sequence,receipt"
        " FROM receipts ORDER BY sequence"
    ).fetchall()
    if len(receipts) != seq:
        _reject("Committed sequence does not match receipt count")
    if [receipt[3] for receipt in receipts] != list(range(1, seq + 1)):
        _reject("Missing, duplicated or reordered committed sequence")
    postings = db.execute(
        "SELECT sequence,slot,account_id,delta_units FROM postings"
        " ORDER BY sequence,slot"
    ).fetchall()
    outbox = db.execute(
        "SELECT sequence,event_kind,event_payload FROM outbox ORDER BY sequence"
    ).fetchall()
    if len(postings) != 3 * seq or len(outbox) != seq:
        _reject("Missing posting group or outbox event")
    posted = {}
    for posting in postings:
        posted.setdefault(posting[0], []).append(posting[1:])
    outbox_by_seq = {entry[0]: entry[1:] for entry in outbox}

    last_transfer = {}
    consumed_listing_ids = set()
    for op_id, payload_json, buyer_id, tx_seq, receipt_json in receipts:
        payload = _decode(payload_json)
        result = _decode(receipt_json)
        listing_id = result.get("listing_id")
        listing = listings_by_id.get(listing_id)
        if listing is None or listing_id in consumed_listing_ids:
            _reject("Receipt references absent or multiply consumed listing")
        consumed_listing_ids.add(listing_id)
        (_, parcel, seller, expected_title, expected_map, price,
         fee_bps, consent_id, expires, listing_state) = listing
        if listing_state != "consumed":
            _reject("Committed receipt has an active/revoked listing")
        consent = consents_by_id.get(consent_id)
        if consent != (consent_id, listing_id, seller, parcel, expected_title,
                       expected_map, price, fee_bps, expires, "consumed"):
            _reject("Seller consent missing, altered or not consumed")
        fee = price * fee_bps // 10_000
        if (
            not (0 <= fee_bps <= 1000) or price <= 0
            or account_kinds.get(seller) != "player"
            or account_kinds.get(buyer_id) != "player"
            or buyer_id == seller
            or payload.get("op") != op_id
            or payload.get("buyer") != buyer_id
            or payload.get("listing") != listing_id
            or payload.get("title_rev") != expected_title
            or not isinstance(payload.get("epoch"), int)
            or payload.get("epoch", 0) <= 0
            or any(result.get(k) != v for k, v in (
                ("op_id", op_id), ("sequence", tx_seq),
                ("buyer_id", buyer_id), ("seller_id", seller),
                ("parcel_id", parcel), ("listing_id", listing_id),
                ("title_version", expected_title + 1),
                ("map_revision", expected_map), ("price", price),
                ("seller_proceeds", price - fee), ("treasury_fee", fee),
                ("consent_ref", consent_id),
            ))
        ):
            _reject("Receipt does not match listing, ledger or intent")
        expected_postings = [
            (0, buyer_id, -price), (1, seller, price - fee), (2, 1, fee)
        ]
        if posted.get(tx_seq) != expected_postings:
            _reject("Postings disagree with authoritative purchase receipt")
        if outbox_by_seq.get(tx_seq) != ("title_transferred", receipt_json):
            _reject("Outbox differs from committed receipt")
        # All receipts should correspond to a fixture-admitted epoch, which
        # may legitimately have been revoked AFTER the original commit.
        epoch_exists = db.execute(
            "SELECT 1 FROM admitted_sessions WHERE player_id=? AND epoch=?",
            (buyer_id, payload["epoch"]),
        ).fetchone()
        if epoch_exists is None:
            _reject("Receipt references an unadmitted session epoch")
        last_transfer[parcel] = (buyer_id, expected_title + 1, expected_map, tx_seq)

    for listing in listings:
        (listing_id, parcel, seller, expected_title, map_version,
         price, fee_bps, consent_id, expires, state) = listing
        if account_kinds.get(seller) != "player":
            _reject("Listing seller is not a player principal")
        c = consents_by_id.get(consent_id)
        if c is None or c[:9] != (
            consent_id, listing_id, seller, parcel, expected_title,
            map_version, price, fee_bps, expires
        ):
            _reject("Listing and admitted consent terms mismatch")
        if state == "consumed" and listing_id not in consumed_listing_ids:
            _reject("Consumed listing lacks receipt")
        if state == "active" and c[9] != "approved":
            _reject("Active listing lacks active consent")
        if listing_id not in consumed_listing_ids:
            t = title_by_parcel.get(parcel)
            if t is None or t != (seller, expected_title, map_version):
                _reject("Unconsumed listing no longer matches title")
    for parcel, (buyer, title_version, map_version, _) in last_transfer.items():
        if title_by_parcel.get(parcel) != (buyer, title_version, map_version):
            _reject("Committed receipt and current title disagree")

    projections = db.execute(
        "SELECT parcel_id,owner_id,revision,last_sequence"
        " FROM title_projection ORDER BY parcel_id"
    ).fetchall()
    inbox = db.execute(
        "SELECT sequence,payload_sha256 FROM projection_inbox ORDER BY sequence"
    ).fetchall()
    applied_by_parcel = {}
    for event_seq, digest in inbox:
        event = outbox_by_seq.get(event_seq)
        if event is None or hashlib.sha256(
            event[1].encode("utf-8")
        ).hexdigest() != digest:
            _reject("Projection inbox not bound to source event")
        result = _decode(event[1])
        applied_by_parcel[result["parcel_id"]] = (
            result["buyer_id"], result["title_version"], event_seq
        )
    for parcel, owner, revision, last_sequence in projections:
        if parcel in applied_by_parcel:
            if (owner, revision, last_sequence) != applied_by_parcel[parcel]:
                _reject("Projection and acknowledged inbox diverged")
        else:
            # In the reference model, an unprojected parcel is seeded by
            # exactly one original listing. A future general ledger needs
            # permanent title genesis records separate from listings.
            seed_listings = [l for l in listings if l[1] == parcel]
            if len(seed_listings) != 1:
                _reject("Missing unique origin for unprojected parcel")
            source = seed_listings[0]
            if (owner, revision, last_sequence) != (source[2], source[3], 0):
                _reject("Unacknowledged projection moved from genesis")
    if {p[0] for p in projections} != set(title_by_parcel):
        _reject("Missing/stale parcel projection")

    # Independently reconcile each modeled source commit to exactly one
    # gap-free global event envelope and enforce purchase-before-projection.
    events = db.execute(
        "SELECT revision,event_kind,local_revision FROM global_events ORDER BY revision"
    ).fetchall()
    if (len(events) != global_revision
        or [event[0] for event in events] != list(range(1, global_revision + 1))):
        _reject("Incomplete cross-domain transaction envelope")
    expected_events = (
        {("purchase", record[3]) for record in receipts}
        | {("projection", record[0]) for record in inbox}
        | {("mutation", record[0]) for record in mutations}
    )
    actual_events = {(kind, local) for _, kind, local in events}
    if actual_events != expected_events or len(actual_events) != len(events):
        _reject("Global event envelope disagrees with source commits")
    order = {(kind, local): rev for rev, kind, local in events}
    for (kind, local) in expected_events:
        if kind == "projection" and order[("purchase", local)] >= order[("projection", local)]:
            _reject("Projected title before corresponding committed purchase")

    # Logical checkpoint includes every persisted row, excluding SQLite's
    # nondeterministic page order / WAL bytes. Store expected anchor OUTSIDE DB.
    material = [
        (name, _all_rows(db, name, order)) for name, order in TABLES
    ]
    # Schema constraints are part of the externally checked fixture state.
    # Exclude storage-specific root page numbers and SQLite internal tables,
    # which can differ after legitimate SQLite backup/compaction.
    material.append((
        "schema",
        db.execute(
            "SELECT type,name,tbl_name,sql FROM sqlite_master "
            "WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name"
        ).fetchall(),
    ))
    digest = hashlib.sha256(
        json.dumps(material, separators=(",", ":"), ensure_ascii=True)
        .encode("ascii")
    ).hexdigest()
    return AuditReport(
        sequence=seq,
        issued_units=issued,
        accounts=len(accounts),
        owned_parcels=len(titles),
        receipts=len(receipts),
        inbox_events=len(inbox),
        logical_sha256=digest,
        mutation_revision=mutation_revision,
        global_revision=global_revision,
    )


def audit_fixture_database(path: str | Path) -> AuditReport:
    """Check structural and transaction semantics, without an external tip."""
    db = _read_existing(path)
    try:
        return _audit(db)
    except sqlite3.DatabaseError as exc:
        raise CorruptState("SQLite unable to audit full recovery state") from exc
    finally:
        db.close()


def anchor_fixture_checkpoint(path: str | Path) -> RecoveryAnchor:
    """Test-only producer; caller MUST independently retain the result.

    Producing both this anchor and a damaged DB from the same source makes
    validation meaningless. No signature, secret, or external timestamp here.
    """
    report = audit_fixture_database(path)
    return RecoveryAnchor(report.sequence, report.logical_sha256)


def verify_against_trusted_anchor(
    path: str | Path, expected: RecoveryAnchor
) -> AuditReport:
    """Reject structurally inconsistent and/or outdated restorable state."""
    if (
        not isinstance(expected, RecoveryAnchor)
        or not isinstance(expected.sequence, int)
        or expected.sequence < 0
        or not isinstance(expected.logical_sha256, str)
        or re.fullmatch(r"[a-f0-9]{64}", expected.logical_sha256) is None
    ):
        _reject("Malformed external anchor")
    report = audit_fixture_database(path)
    if (
        report.sequence != expected.sequence
        or report.logical_sha256 != expected.logical_sha256
    ):
        _reject("Recovered state differs from externally retained checkpoint")
    return report


def backup_fixture_database(source: str | Path, destination: str | Path) -> None:
    """SQLite-consistent physical copy to a NEW disposable filename only.

    This is a fixture acceptance aid. It is NOT multi-region replication,
    an authenticated off-host backup, or a production migration tool.
    """
    src, dst = Path(source).resolve(), Path(destination).resolve()
    if src == dst or dst.exists() or dst.with_name(dst.name + "-wal").exists():
        raise FileExistsError("Refusing to overwrite an existing database/backup")
    source_db = _read_existing(src)
    target_db = None
    try:
        target_db = sqlite3.connect(str(dst), isolation_level=None)
        source_db.backup(target_db)
    except BaseException:
        if target_db is not None:
            target_db.close()
            target_db = None
        dst.unlink(missing_ok=True)
        raise
    finally:
        source_db.close()
        if target_db is not None:
            target_db.close()
