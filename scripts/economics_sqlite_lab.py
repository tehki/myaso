"""E2d standalone SQLite settlement *laboratory* (not a game server or wallet).

A real SQLite file, a single BEGIN IMMEDIATE transaction, WAL/FULL synchronous
settings, explicit idempotency receipts, and ledger/title/listing/outbox writes.
No runtime entrypoint, credentials, signing, HTTP, Moon Coin, or real accounts.
A VerifiedSession is ONLY a test-fixture type; it is NOT authentication.
Seller consent is an admitted fixture value; it is NOT a signature.
Do not run this against any production account/property data.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3

MAX_INT = (1 << 63) - 1
MAX_FEE_BPS = 1000
OP_ID_RE = re.compile(r"[A-Za-z0-9_-]{1,64}\Z")


class Denied(Exception):
    """Reject a purchase without persisting any partial transfer."""


class InjectedFailure(RuntimeError):
    """Simulate failure at a particular transaction phase."""


@dataclass(frozen=True)
class VerifiedSession:
    # A caller may construct this. Production needs a separate trusted auth gate.
    player_id: int
    epoch: int


@dataclass(frozen=True)
class PurchaseIntent:
    op_id: str
    buyer_id: int
    listing_id: int
    title_revision: int
    buyer_revision: int


SCHEMA = """
CREATE TABLE metadata (
    singleton INTEGER PRIMARY KEY CHECK (singleton=1),
    sequence INTEGER NOT NULL CHECK(sequence>=0),
    issued_units INTEGER NOT NULL CHECK(issued_units>=0),
    title_cap INTEGER NOT NULL CHECK(title_cap>=1),
    mutation_revision INTEGER NOT NULL DEFAULT 0 CHECK(mutation_revision>=0),
    global_revision INTEGER NOT NULL DEFAULT 0 CHECK(global_revision>=0)
);
-- Ordered envelope for modeled source commits, not a production game journal.
CREATE TABLE global_events (
    revision INTEGER PRIMARY KEY CHECK(revision>0),
    event_kind TEXT NOT NULL CHECK(event_kind IN ('purchase','projection','mutation')),
    local_revision INTEGER NOT NULL CHECK(local_revision>0),
    UNIQUE(event_kind,local_revision)
);
CREATE TABLE admission_mutations (
    revision INTEGER PRIMARY KEY CHECK(revision>0),
    operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id) BETWEEN 1 AND 64),
    mutation_kind TEXT NOT NULL CHECK(mutation_kind IN ('session_issue','session_revoke','listing_revoke','title_cap_change')),
    target_id INTEGER NOT NULL CHECK(target_id>0),
    target_epoch INTEGER NOT NULL CHECK(target_epoch>=0)
);
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY CHECK(id>0),
    kind TEXT NOT NULL CHECK(kind IN ('player','treasury')),
    units INTEGER NOT NULL CHECK(units>=0),
    revision INTEGER NOT NULL CHECK(revision>=1)
);
CREATE UNIQUE INDEX one_treasury ON accounts(kind) WHERE kind='treasury';
CREATE TABLE titles (
    parcel_id INTEGER PRIMARY KEY CHECK(parcel_id>0),
    owner_id INTEGER NOT NULL REFERENCES accounts(id),
    revision INTEGER NOT NULL CHECK(revision>=1),
    map_revision INTEGER NOT NULL CHECK(map_revision>=1)
);
CREATE TABLE listings (
    id INTEGER PRIMARY KEY CHECK(id>0),
    parcel_id INTEGER NOT NULL REFERENCES titles(parcel_id),
    seller_id INTEGER NOT NULL REFERENCES accounts(id),
    expected_title_revision INTEGER NOT NULL CHECK(expected_title_revision>=1),
    map_revision INTEGER NOT NULL CHECK(map_revision>=1),
    price INTEGER NOT NULL CHECK(price>0),
    fee_bps INTEGER NOT NULL CHECK(fee_bps BETWEEN 0 AND 1000),
    approved_consent TEXT NOT NULL CHECK(length(approved_consent)>0),
    expires_tick INTEGER NOT NULL CHECK(expires_tick>0),
    state TEXT NOT NULL CHECK(state IN ('active','consumed','revoked'))
);
CREATE UNIQUE INDEX one_active_listing_per_parcel
    ON listings(parcel_id) WHERE state='active';
-- Admitted epochs are fixed demo records, NOT proof of real authentication.
CREATE TABLE admitted_sessions (
    player_id INTEGER NOT NULL REFERENCES accounts(id),
    epoch INTEGER NOT NULL CHECK(epoch>0),
    state TEXT NOT NULL CHECK(state IN ('active','revoked')),
    PRIMARY KEY(player_id,epoch)
);
-- Seller consent must bind all material listing terms. Approval is fixture-
-- seeded, NOT cryptographically signed or admitted by a real seller login.
-- Fictional Core X1 compatibility keys; not an authenticated account store.
CREATE TABLE core_fixture_bindings (
    ledger_account_id INTEGER PRIMARY KEY REFERENCES accounts(id),
    account_key_be BLOB NOT NULL UNIQUE CHECK(length(account_key_be)=16),
    character_key_be BLOB NOT NULL UNIQUE CHECK(length(character_key_be)=16),
    session_generation INTEGER NOT NULL CHECK(session_generation>0),
    CHECK(account_key_be != zeroblob(16)),
    CHECK(character_key_be != zeroblob(16)),
    CHECK(account_key_be != character_key_be)
);
CREATE TABLE seller_consents (
    id TEXT PRIMARY KEY CHECK(length(id)>0),
    listing_id INTEGER NOT NULL UNIQUE REFERENCES listings(id),
    seller_id INTEGER NOT NULL REFERENCES accounts(id),
    parcel_id INTEGER NOT NULL REFERENCES titles(parcel_id),
    title_revision INTEGER NOT NULL CHECK(title_revision>=1),
    map_revision INTEGER NOT NULL CHECK(map_revision>=1),
    price INTEGER NOT NULL CHECK(price>0),
    fee_bps INTEGER NOT NULL CHECK(fee_bps BETWEEN 0 AND 1000),
    expires_tick INTEGER NOT NULL CHECK(expires_tick>0),
    state TEXT NOT NULL CHECK(state IN ('approved','revoked','consumed'))
);
CREATE TABLE receipts (
    op_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    buyer_id INTEGER NOT NULL REFERENCES accounts(id),
    sequence INTEGER NOT NULL UNIQUE CHECK(sequence>0),
    receipt TEXT NOT NULL
);
CREATE TABLE postings (
    sequence INTEGER NOT NULL REFERENCES receipts(sequence),
    slot INTEGER NOT NULL CHECK(slot BETWEEN 0 AND 2),
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    delta_units INTEGER NOT NULL,
    PRIMARY KEY(sequence,slot)
);
CREATE TABLE outbox (
    sequence INTEGER PRIMARY KEY REFERENCES receipts(sequence),
    event_kind TEXT NOT NULL,
    event_payload TEXT NOT NULL
);
-- A fictional read-side projection; NOT source of truth for ownership.
CREATE TABLE title_projection (
    parcel_id INTEGER PRIMARY KEY REFERENCES titles(parcel_id),
    owner_id INTEGER NOT NULL REFERENCES accounts(id),
    revision INTEGER NOT NULL CHECK(revision>=1),
    last_sequence INTEGER NOT NULL CHECK(last_sequence>=0)
);
-- The consumer's durable idempotency inbox. No external event delivery.
CREATE TABLE projection_inbox (
    sequence INTEGER PRIMARY KEY REFERENCES outbox(sequence),
    payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64)
);
"""


def _positive(value: int) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 0 < value <= MAX_INT


def _nonnegative(value: int) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= MAX_INT


def _connect(db_path: str | Path) -> sqlite3.Connection:
    db = sqlite3.connect(str(db_path), timeout=8.0, isolation_level=None)
    db.execute("PRAGMA busy_timeout=8000")
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA synchronous=FULL")
    return db


def _record_global_event(db: sqlite3.Connection, kind: str, local_revision: int) -> int:
    """Append a modeled event atomically inside the caller's active transaction."""
    if kind not in ("purchase", "projection", "mutation") or not _positive(local_revision):
        raise Denied("Invalid global event")
    row = db.execute("SELECT global_revision FROM metadata WHERE singleton=1").fetchone()
    if row is None or row[0] >= MAX_INT:
        raise Denied("Global event revision unavailable")
    next_revision = row[0] + 1
    if db.execute(
        "UPDATE metadata SET global_revision=? WHERE singleton=1 AND global_revision=?",
        (next_revision, row[0]),
    ).rowcount != 1:
        raise Denied("Concurrent global event revision")
    db.execute(
        "INSERT INTO global_events(revision,event_kind,local_revision) VALUES(?,?,?)",
        (next_revision, kind, local_revision),
    )
    return next_revision


def bootstrap_fixture(db_path: str | Path) -> None:
    """Create one disposable database with fictional test actors only.

    DO NOT make this function reachable from the game server or the network.
    A consent reference here is fixture seed data, not verified seller consent.
    """
    p = Path(db_path)
    if p.exists() or p.with_name(p.name + "-wal").exists():
        raise FileExistsError("Fixture must start with an unused database filename")
    db = _connect(p)
    try:
        db.executescript(SCHEMA)
        db.execute("BEGIN IMMEDIATE")
        db.execute(
            "INSERT INTO metadata(singleton,sequence,issued_units,title_cap)"
            " VALUES(1,0,2400,2)"
        )
        db.executemany(
            "INSERT INTO accounts(id,kind,units,revision) VALUES(?,?,?,1)",
            [(1, "treasury", 100), (10, "player", 1500),
             (20, "player", 200), (30, "player", 600)],
        )
        db.execute(
            "INSERT INTO titles(parcel_id,owner_id,revision,map_revision)"
            " VALUES(42,20,1,7)"
        )
        db.execute(
            "INSERT INTO listings(id,parcel_id,seller_id,expected_title_revision,"
            "map_revision,price,fee_bps,approved_consent,expires_tick,state)"
            " VALUES(50,42,20,1,7,500,200,'TEST_FIXTURE_ONLY',100,'active')"
        )
        db.executemany(
            "INSERT INTO admitted_sessions(player_id,epoch,state)"
            " VALUES(?,8,'active')", [(10,), (20,), (30,)]
        )
        db.execute(
            "INSERT INTO seller_consents(id,listing_id,seller_id,parcel_id,"
            "title_revision,map_revision,price,fee_bps,expires_tick,state)"
            " VALUES('TEST_FIXTURE_ONLY',50,20,42,1,7,500,200,100,'approved')"
        )
        # E2h fictional identities are explicitly distinct from both ledger
        # INTEGER IDs and from each other; not issued by Core authentication.
        db.executemany(
            "INSERT INTO core_fixture_bindings("
            "ledger_account_id,account_key_be,character_key_be,session_generation)"
            " VALUES(?,?,?,8)",
            [
                (10, (0xA10).to_bytes(16, "big"),
                 int("0102030405060708090a0b0c0d0e0f10", 16).to_bytes(16, "big")),
                (20, (0xA20).to_bytes(16, "big"),
                 int("80000000000000000000000000000001", 16).to_bytes(16, "big")),
                (30, (0xA30).to_bytes(16, "big"),
                 (0x333).to_bytes(16, "big")),
            ],
        )
        db.execute(
            "INSERT INTO title_projection(parcel_id,owner_id,revision,last_sequence)"
            " VALUES(42,20,1,0)"
        )
        db.commit()
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()


def _payload(session: VerifiedSession, intent: PurchaseIntent) -> str:
    return json.dumps(
        {"buyer": intent.buyer_id, "epoch": session.epoch, "listing": intent.listing_id,
         "op": intent.op_id, "title_rev": intent.title_revision,
         "buyer_rev": intent.buyer_revision},
        sort_keys=True, separators=(",", ":"),
    )


def purchase(
    db_path: str | Path,
    session: VerifiedSession,
    intent: PurchaseIntent,
    trusted_tick: int,
    *,
    failpoint: str | None = None,
    _test_only_core_assertion: object | None = None,
    _test_only_server_authorizer: object | None = None,
    _test_only_server_transport_ref: object | None = None,
) -> dict:
    """Commit exactly one file-backed test purchase or no purchase.

    Accepted failpoints: after_debit, after_title, before_commit, after_commit.
    Testing-only crash points use hard_exit_<phase> and exit the process (91).
    The last simulates lost acknowledgment: a commit occurred despite failure.
    """
    if failpoint not in (None, "after_debit", "after_title",
                         "before_commit", "after_commit",
                         "hard_exit_after_debit", "hard_exit_after_title",
                         "hard_exit_before_commit", "hard_exit_after_commit"):
        raise ValueError("Unknown failpoint")
    if (not _positive(session.player_id) or not _positive(session.epoch)
        or not _positive(intent.buyer_id) or session.player_id != intent.buyer_id
        or not _positive(intent.listing_id) or not _positive(intent.title_revision)
        or not _positive(intent.buyer_revision)
        or not isinstance(intent.op_id, str) or not OP_ID_RE.fullmatch(intent.op_id)
        or not _nonnegative(trusted_tick)):
        raise Denied("Invalid or unverified test buyer/intent")
    payload = _payload(session, intent)
    db = _connect(db_path)
    committed = False
    try:
        db.execute("BEGIN IMMEDIATE")
        # Demonstrates authority-state admission, NOT real session proof.
        admitted = db.execute(
            "SELECT state FROM admitted_sessions WHERE player_id=? AND epoch=?",
            (session.player_id, session.epoch),
        ).fetchone()
        if admitted != ("active",):
            raise Denied("Session not admitted or already revoked")
        if (_test_only_server_authorizer is None) != (
            _test_only_server_transport_ref is None
        ):
            raise Denied("Incomplete offline trusted-provider configuration")
        if _test_only_server_authorizer is not None:
            if _test_only_core_assertion is not None:
                raise Denied("Cannot combine caller assertion and verifier-backed gateway")
            # A mock server-owned verifier runs INSIDE the same writer
            # transaction, before old receipt lookup or any mutable transfer.
            # There is NO production Core verifier or signed session here.
            from economics_core_gateway import assert_fixture_server_session_in_transaction
            assert_fixture_server_session_in_transaction(
                db, _test_only_server_authorizer, _test_only_server_transport_ref,
                session, intent,
            )
        if _test_only_core_assertion is not None:
            # This prior optional fixture guard is not authentication.
            from economics_core_binding import assert_fixture_binding_in_transaction
            assert_fixture_binding_in_transaction(
                db, _test_only_core_assertion, session.player_id, session.epoch
            )
        previous = db.execute(
            "SELECT payload,receipt FROM receipts WHERE op_id=?", (intent.op_id,)
        ).fetchone()
        if previous is not None:
            if previous[0] != payload:
                raise Denied("Operation ID already committed for another payload")
            result = json.loads(previous[1])
            db.commit()
            committed = True
            return result

        listing = db.execute(
            "SELECT parcel_id,seller_id,expected_title_revision,map_revision,"
            "price,fee_bps,approved_consent,expires_tick,state"
            " FROM listings WHERE id=?", (intent.listing_id,)
        ).fetchone()
        if listing is None:
            raise Denied("Unknown listing")
        (parcel, seller, expected_title, expected_map, price, fee_bps,
         consent, expiry, state) = listing
        if (state != "active" or seller == intent.buyer_id
            or not consent or trusted_tick > expiry):
            raise Denied("Inactive, expired or self-issued sale")
        approved = db.execute(
            "SELECT listing_id,seller_id,parcel_id,title_revision,"
            "map_revision,price,fee_bps,expires_tick,state"
            " FROM seller_consents WHERE id=?", (consent,),
        ).fetchone()
        if approved != (intent.listing_id, seller, parcel, expected_title,
                        expected_map, price, fee_bps, expiry, "approved"):
            raise Denied("Missing, revoked, consumed or altered seller consent")
        title = db.execute(
            "SELECT owner_id,revision,map_revision FROM titles WHERE parcel_id=?",
            (parcel,),
        ).fetchone()
        if (title != (seller, expected_title, expected_map)
            or title[1] != intent.title_revision):
            raise Denied("Stale deed or map revision")
        buyer_row = db.execute(
            "SELECT units,revision,kind FROM accounts WHERE id=?",
            (intent.buyer_id,),
        ).fetchone()
        seller_row = db.execute(
            "SELECT units,revision,kind FROM accounts WHERE id=?", (seller,)
        ).fetchone()
        treasury_row = db.execute(
            "SELECT units,revision,kind FROM accounts WHERE id=1"
        ).fetchone()
        if (buyer_row is None or seller_row is None or treasury_row is None
            or buyer_row[2] != "player" or seller_row[2] != "player"
            or treasury_row[2] != "treasury"
            or buyer_row[1] != intent.buyer_revision):
            raise Denied("Invalid buyer, seller or stale spendable revision")
        meta = db.execute(
            "SELECT sequence,issued_units,title_cap FROM metadata WHERE singleton=1"
        ).fetchone()
        if meta is None:
            raise Denied("No trusted model policy")
        ownership = db.execute(
            "SELECT count(*) FROM titles WHERE owner_id=?", (intent.buyer_id,)
        ).fetchone()[0]
        if ownership >= meta[2]:
            raise Denied("Property ownership cap")
        if buyer_row[0] < price:
            raise Denied("Insufficient credits")
        fee = price * fee_bps // 10000
        proceeds = price - fee
        seller_after = seller_row[0] + proceeds
        treasury_after = treasury_row[0] + fee
        if (not _nonnegative(seller_after) or not _nonnegative(treasury_after)
            or title[1] >= MAX_INT or meta[0] >= MAX_INT
            or any(r[1] >= MAX_INT for r in (buyer_row,seller_row,treasury_row))):
            raise Denied("Arithmetic or revision overflow")
        seq = meta[0] + 1
        postings = [(intent.buyer_id, -price), (seller, proceeds), (1, fee)]
        if sum(delta for _, delta in postings) != 0:
            raise Denied("Unbalanced transaction")

        def change_account(account_id: int, old: tuple, new_units: int) -> None:
            updated = db.execute(
                "UPDATE accounts SET units=?, revision=revision+1"
                " WHERE id=? AND units=? AND revision=?",
                (new_units, account_id, old[0], old[1]),
            ).rowcount
            if updated != 1:
                raise Denied("Concurrent balance update")

        change_account(intent.buyer_id, buyer_row, buyer_row[0] - price)
        if failpoint == "hard_exit_after_debit":
            os._exit(91)  # Intentional offline process-kill acceptance only.
        if failpoint == "after_debit":
            raise InjectedFailure("Before second account credit")
        change_account(seller, seller_row, seller_after)
        change_account(1, treasury_row, treasury_after)
        if db.execute(
            "UPDATE titles SET owner_id=?,revision=revision+1"
            " WHERE parcel_id=? AND owner_id=? AND revision=? AND map_revision=?",
            (intent.buyer_id, parcel, seller, expected_title, expected_map),
        ).rowcount != 1:
            raise Denied("Concurrent deed update")
        if failpoint == "hard_exit_after_title":
            os._exit(91)  # Intentional offline process-kill acceptance only.
        if failpoint == "after_title":
            raise InjectedFailure("Before consuming listing")
        if db.execute(
            "UPDATE listings SET state='consumed' WHERE id=? AND state='active'",
            (intent.listing_id,),
        ).rowcount != 1:
            raise Denied("Listing already consumed")
        if db.execute(
            "UPDATE seller_consents SET state='consumed'"
            " WHERE id=? AND listing_id=? AND state='approved'",
            (consent, intent.listing_id),
        ).rowcount != 1:
            raise Denied("Seller consent was concurrently revoked or consumed")
        if db.execute(
            "UPDATE metadata SET sequence=? WHERE singleton=1 AND sequence=?",
            (seq, meta[0]),
        ).rowcount != 1:
            raise Denied("Concurrent committed sequence")
        receipt = {
            "op_id": intent.op_id, "sequence": seq,
            "buyer_id": intent.buyer_id, "seller_id": seller, "parcel_id": parcel,
            "listing_id": intent.listing_id, "title_version": expected_title + 1,
            "map_revision": expected_map, "price": price,
            "seller_proceeds": proceeds, "treasury_fee": fee,
            "consent_ref": consent, "committed_tick": trusted_tick,
        }
        receipt_json = json.dumps(receipt, sort_keys=True, separators=(",", ":"))
        db.execute(
            "INSERT INTO receipts(op_id,payload,buyer_id,sequence,receipt)"
            " VALUES(?,?,?,?,?)",
            (intent.op_id, payload, intent.buyer_id, seq, receipt_json),
        )
        db.executemany(
            "INSERT INTO postings(sequence,slot,account_id,delta_units)"
            " VALUES(?,?,?,?)",
            [(seq, i, account, delta) for i, (account, delta) in enumerate(postings)],
        )
        db.execute(
            "INSERT INTO outbox(sequence,event_kind,event_payload)"
            " VALUES(?, 'title_transferred',?)", (seq, receipt_json)
        )
        _record_global_event(db, "purchase", seq)
        if failpoint == "hard_exit_before_commit":
            os._exit(91)  # Intentional offline process-kill acceptance only.
        if failpoint == "before_commit":
            raise InjectedFailure("After inserts, before durable commit")
        db.commit()
        committed = True
        if failpoint == "hard_exit_after_commit":
            os._exit(91)  # Intentional offline process-kill acceptance only.
        if failpoint == "after_commit":
            raise InjectedFailure("Commit completed; acknowledgment lost")
        return receipt
    except BaseException:
        if not committed:
            db.rollback()
        raise
    finally:
        db.close()



def pending_title_events(db_path: str | Path, *, limit: int = 100) -> list[dict]:
    """Read undelivered *local fixture* outbox items in committed sequence order.

    This does NOT publish events to network clients, Telegram, queues, or
    external applications. The read model may legitimately lag the ledger.
    """
    if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 1000:
        raise ValueError("Offline poll limit must be in [1, 1000]")
    db = _connect(db_path)
    try:
        rows = db.execute(
            "SELECT o.sequence,o.event_kind,o.event_payload"
            " FROM outbox o LEFT JOIN projection_inbox i ON i.sequence=o.sequence"
            " WHERE i.sequence IS NULL ORDER BY o.sequence ASC LIMIT ?",
            (limit,),
        ).fetchall()
        return [
            {"sequence": seq, "event_kind": kind, "payload": data}
            for seq, kind, data in rows
        ]
    finally:
        db.close()


def project_title_event(
    db_path: str | Path,
    sequence: int,
    *,
    failpoint: str | None = None,
) -> str:
    """Apply one committed *test* outbox event idempotently to a read model.

    A transactional projection/inbox can be retried safely after a hard exit.
    External side effects (e.g. network sends) are NOT exactly-once and are
    deliberately absent. Only a trusted internal consumer should ever invoke
    this hypothetical service, which has NO authentication or game endpoint.
    """
    if not _positive(sequence):
        raise Denied("Invalid projection sequence")
    allowed = (
        None, "after_projection", "before_commit", "after_commit",
        "hard_exit_after_projection", "hard_exit_before_commit",
        "hard_exit_after_commit",
    )
    if failpoint not in allowed:
        raise ValueError("Invalid offline consumer failpoint")
    db = _connect(db_path)
    committed = False
    try:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute(
            "SELECT o.event_kind,o.event_payload,r.receipt,r.buyer_id"
            " FROM outbox o JOIN receipts r ON r.sequence=o.sequence"
            " WHERE o.sequence=?", (sequence,),
        ).fetchone()
        if row is None:
            raise Denied("No committed event with receipt")
        kind, event_json, receipt_json, buyer_id = row
        if kind != "title_transferred" or event_json != receipt_json:
            raise Denied("Outbox does not match committed receipt")
        digest = hashlib.sha256(event_json.encode("utf-8")).hexdigest()
        existing = db.execute(
            "SELECT payload_sha256 FROM projection_inbox WHERE sequence=?",
            (sequence,),
        ).fetchone()
        if existing is not None:
            if existing[0] != digest:
                raise Denied("Processed event no longer matches acknowledged digest")
            db.commit()
            committed = True
            return "already_applied"
        try:
            event = json.loads(event_json)
        except (ValueError, TypeError) as exc:
            raise Denied("Malformed event payload") from exc
        if (not isinstance(event, dict)
            or not _positive(event.get("parcel_id"))
            or not _positive(event.get("buyer_id"))
            or not _positive(event.get("title_version"))
            or not _positive(event.get("sequence"))
            or event["sequence"] != sequence
            or event["buyer_id"] != buyer_id):
            raise Denied("Invalid event identity or contents")
        projection = db.execute(
            "SELECT owner_id,revision,last_sequence FROM title_projection"
            " WHERE parcel_id=?", (event["parcel_id"],),
        ).fetchone()
        if (projection is None or projection[1] != event["title_version"] - 1
            or projection[2] >= sequence):
            raise Denied("Projection out of order or missing canonical title")
        # Read model cannot advance past the true committed deed revision.
        canonical = db.execute(
            "SELECT revision FROM titles WHERE parcel_id=?",
            (event["parcel_id"],),
        ).fetchone()
        if canonical is None or canonical[0] < event["title_version"]:
            raise Denied("Event claims uncommitted title version")
        if db.execute(
            "UPDATE title_projection"
            " SET owner_id=?,revision=?,last_sequence=?"
            " WHERE parcel_id=? AND revision=? AND last_sequence=?",
            (
                event["buyer_id"], event["title_version"], sequence,
                event["parcel_id"], projection[1], projection[2],
            ),
        ).rowcount != 1:
            raise Denied("Concurrent projection update")
        if failpoint == "hard_exit_after_projection":
            os._exit(91)  # Offline child-process fault injection only.
        if failpoint == "after_projection":
            raise InjectedFailure("Read model updated but inbox not committed")
        db.execute(
            "INSERT INTO projection_inbox(sequence,payload_sha256) VALUES(?,?)",
            (sequence, digest),
        )
        _record_global_event(db, "projection", sequence)
        if failpoint == "hard_exit_before_commit":
            os._exit(91)
        if failpoint == "before_commit":
            raise InjectedFailure("Projection and inbox not committed")
        db.commit()
        committed = True
        if failpoint == "hard_exit_after_commit":
            os._exit(91)
        if failpoint == "after_commit":
            raise InjectedFailure("Projection committed, ack lost")
        return "applied"
    except BaseException:
        if not committed:
            db.rollback()
        raise
    finally:
        db.close()

def snapshot(db_path: str | Path) -> dict:
    """Inspect persisted test state after closing/reopening the SQLite file."""
    db = _connect(db_path)
    try:
        accounts = db.execute(
            "SELECT id,units,revision FROM accounts ORDER BY id"
        ).fetchall()
        owner = db.execute(
            "SELECT owner_id,revision FROM titles WHERE parcel_id=42"
        ).fetchone()
        listing = db.execute(
            "SELECT state FROM listings WHERE id=50"
        ).fetchone()
        meta = db.execute(
            "SELECT sequence,issued_units FROM metadata WHERE singleton=1"
        ).fetchone()
        receipts = db.execute("SELECT count(*) FROM receipts").fetchone()[0]
        postings = db.execute("SELECT sequence, sum(delta_units),count(*)"
                              " FROM postings GROUP BY sequence").fetchall()
        outbox = db.execute("SELECT count(*) FROM outbox").fetchone()[0]
        consent_state = db.execute(
            "SELECT state FROM seller_consents WHERE id='TEST_FIXTURE_ONLY'"
        ).fetchone()[0]
        admitted_sessions = db.execute(
            "SELECT player_id,epoch,state FROM admitted_sessions ORDER BY player_id,epoch"
        ).fetchall()
        read_model = db.execute(
            "SELECT owner_id,revision,last_sequence FROM title_projection"
            " WHERE parcel_id=42"
        ).fetchone()
        consumed_events = db.execute("SELECT count(*) FROM projection_inbox").fetchone()[0]
        pending_events = db.execute(
            "SELECT count(*) FROM outbox o"
            " LEFT JOIN projection_inbox i ON i.sequence=o.sequence"
            " WHERE i.sequence IS NULL"
        ).fetchone()[0]
        return {
            "accounts": accounts, "title": owner, "listing": listing[0],
            "sequence": meta[0], "issued": meta[1], "receipts": receipts,
            "postings": postings, "outbox": outbox,
            "consent": consent_state, "sessions": admitted_sessions,
            "read_model": read_model, "consumed_events": consumed_events,
            "pending_events": pending_events,
            "conserved": sum(a[1] for a in accounts) == meta[1]
                and all(total == 0 and n == 3 for _, total, n in postings)
                and receipts == meta[0] and outbox == receipts
                and (listing[0] == "consumed") == (consent_state == "consumed"),
        }
    finally:
        db.close()
