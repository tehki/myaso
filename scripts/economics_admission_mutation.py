"""E2d offline fixture admissions, revocations and policy mutation revisions.

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


def _fixture_mutation(
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
    if kind not in ("session_issue", "session_revoke", "listing_revoke", "title_cap_change"):
        raise Denied("Unknown fixture revocation kind")
    if kind in ("session_revoke", "session_issue") and target_epoch == 0:
        raise Denied("Session epoch must be positive")
    if kind in ("listing_revoke", "title_cap_change") and target_epoch != 0:
        raise Denied("Non-session mutation must not carry a session epoch")

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
                raise Denied("Fixture mutation operation ID reused with different intent")
            db.commit()
            committed = True
            return old[0]

        if kind == "session_issue":
            owner = db.execute(
                "SELECT kind FROM accounts WHERE id=?", (target_id,),
            ).fetchone()
            latest = db.execute(
                "SELECT COALESCE(MAX(epoch),0) FROM admitted_sessions WHERE player_id=?",
                (target_id,),
            ).fetchone()[0]
            if owner != ("player",) or target_epoch <= latest:
                raise Denied("New epoch must belong to fixture player and be strictly increasing")
            db.execute(
                "INSERT INTO admitted_sessions(player_id,epoch,state) VALUES(?,?,'active')",
                (target_id, target_epoch),
            )
        elif kind == "title_cap_change":
            prior = db.execute(
                "SELECT title_cap FROM metadata WHERE singleton=1",
            ).fetchone()
            most_titles = db.execute(
                "SELECT COALESCE(MAX(c),0) FROM ("
                " SELECT COUNT(*) AS c FROM titles GROUP BY owner_id)"
            ).fetchone()[0]
            if prior is None or prior[0] == target_id or target_id < most_titles:
                raise Denied("Invalid, unchanged or below-current-holdings title cap")
            if db.execute(
                "UPDATE metadata SET title_cap=? WHERE singleton=1 AND title_cap=?",
                (target_id, prior[0]),
            ).rowcount != 1:
                raise Denied("Concurrent title policy revision")
        elif kind == "session_revoke":
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
            raise Denied("Fixture mutation revision overflow")
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
    return _fixture_mutation(
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
    return _fixture_mutation(
        db_path, operation_id, "listing_revoke", listing_id, 0,
        failpoint=failpoint,
    )



def issue_fixture_session(
    db_path: str | Path,
    *,
    operation_id: str,
    player_id: int,
    session_epoch: int,
    failpoint: str | None = None,
) -> int:
    """Create a toy admission epoch; the caller is NOT authenticated."""
    return _fixture_mutation(
        db_path, operation_id, "session_issue", player_id, session_epoch,
        failpoint=failpoint,
    )


def change_fixture_title_cap(
    db_path: str | Path,
    *,
    operation_id: str,
    new_cap: int,
    failpoint: str | None = None,
) -> int:
    """Version a fictional property-limit policy; no server config is changed."""
    return _fixture_mutation(
        db_path, operation_id, "title_cap_change", new_cap, 0,
        failpoint=failpoint,
    )
