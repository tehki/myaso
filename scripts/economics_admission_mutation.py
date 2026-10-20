"""E2d offline fixture revocations with durable monotonic mutation revisions.

No credentials, issuer authorization, production player sessions, game endpoints,
seller keys, or wallet integration are provided. A Python caller able to open
this SQLite file is effectively trusted in this *laboratory*, not production.
"""

from __future__ import annotations

from pathlib import Path
import os
import sqlite3

from economics_sqlite_lab import Denied, InjectedFailure, MAX_INT, OP_ID_RE, _connect, _positive

_ALLOWED_FAULTS = (
    None, "before_commit", "after_commit",
    "hard_exit_before_commit", "hard_exit_after_commit",
)


def _revocation(
    db_path: str | Path,
    operation_id: str,
    kind: str,
    target_id: int,
    target_epoch: int,
    *,
    failpoint: str | None,
) -> int:
    if failpoint not in _ALLOWED_FAULTS:
        raise ValueError("Unsupported offline revocation failpoint")
    if (not isinstance(operation_id, str) or OP_ID_RE.fullmatch(operation_id) is None
        or not _positive(target_id)
        or not isinstance(target_epoch, int) or isinstance(target_epoch, bool)
        or target_epoch < 0 or target_epoch > MAX_INT):
        raise Denied("Invalid fictional revocation request")
    if kind not in ("session_revoke", "listing_revoke"):
        raise Denied("Unknown fixture revocation kind")
    if kind == "session_revoke" and target_epoch == 0:
        raise Denied("Session epoch must be positive")
    if kind == "listing_revoke" and target_epoch != 0:
        raise Denied("Listing revocation has no session epoch")

    db = _connect(db_path)
    committed = False
    try:
        db.execute("BEGIN IMMEDIATE")
        old = db.execute(
            "SELECT revision,mutation_kind,target_id,target_epoch"
            " FROM admission_mutations WHERE operation_id=?", (operation_id,),
        ).fetchone()
        if old is not None:
            if old[1:] != (kind, target_id, target_epoch):
                raise Denied("Revocation operation ID reused with different intent")
            db.commit()
            committed = True
            return old[0]

        if kind == "session_revoke":
            count = db.execute(
                "UPDATE admitted_sessions SET state='revoked'"
                " WHERE player_id=? AND epoch=? AND state='active'",
                (target_id, target_epoch),
            ).rowcount
            if count != 1:
                raise Denied("Session was not admitted or already revoked")
        else:
            listing = db.execute(
                "SELECT approved_consent FROM listings"
                " WHERE id=? AND state='active'", (target_id,),
            ).fetchone()
            if listing is None:
                raise Denied("Listing was not active")
            consent_id = listing[0]
            if db.execute(
                "UPDATE seller_consents SET state='revoked'"
                " WHERE id=? AND listing_id=? AND state='approved'",
                (consent_id, target_id),
            ).rowcount != 1:
                raise Denied("Seller consent cannot be revoked for this listing")
            if db.execute(
                "UPDATE listings SET state='revoked'"
                " WHERE id=? AND state='active'", (target_id,),
            ).rowcount != 1:
                raise Denied("Listing update conflict")

        current = db.execute(
            "SELECT mutation_revision FROM metadata WHERE singleton=1"
        ).fetchone()
        if current is None or current[0] >= MAX_INT:
            raise Denied("Revocation revision overflow")
        revision = current[0] + 1
        if db.execute(
            "UPDATE metadata SET mutation_revision=?"
            " WHERE singleton=1 AND mutation_revision=?",
            (revision, current[0]),
        ).rowcount != 1:
            raise Denied("Concurrent mutation version mismatch")
        db.execute(
            "INSERT INTO admission_mutations("
            "revision,operation_id,mutation_kind,target_id,target_epoch)"
            " VALUES(?,?,?,?,?)",
            (revision, operation_id, kind, target_id, target_epoch),
        )
        if failpoint == "hard_exit_before_commit":
            os._exit(91)  # Disposable test child process ONLY.
        if failpoint == "before_commit":
            raise InjectedFailure("Revocation not yet durable")
        db.commit()
        committed = True
        if failpoint == "hard_exit_after_commit":
            os._exit(91)
        if failpoint == "after_commit":
            raise InjectedFailure("Revocation committed, acknowledgment lost")
        return revision
    except BaseException:
        if not committed:
            db.rollback()
        raise
    finally:
        db.close()


def revoke_fixture_session(
    db_path: str | Path,
    *,
    operation_id: str,
    player_id: int,
    session_epoch: int,
    failpoint: str | None = None,
) -> int:
    """Trustlessly *not* authenticated: revoke an admitted fictional session."""
    return _revocation(
        db_path, operation_id, "session_revoke", player_id, session_epoch,
        failpoint=failpoint,
    )


def revoke_fixture_listing(
    db_path: str | Path,
    *,
    operation_id: str,
    listing_id: int,
    failpoint: str | None = None,
) -> int:
    """Revoke fictional listing and test consent in the same SQLite commit."""
    return _revocation(
        db_path, operation_id, "listing_revoke", listing_id, 0,
        failpoint=failpoint,
    )
