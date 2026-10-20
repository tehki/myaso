"""E2d offline monotonic recovery witness (fixture-only).

This *separate SQLite file* records the latest externally authenticated
database checkpoint seen by an authorized offline recovery verifier.
It does not provide an independent failure domain or trusted key custody by
itself. A compromised or rolled-back witness makes its guarantee meaningless.
Never use it on a live game account, property registry or wallet.
"""

from __future__ import annotations

from pathlib import Path
import sqlite3
from typing import Mapping

from economics_checkpoint_auth import (
    AuthenticatedCheckpoint, InvalidCheckpoint, verify_fixture_checkpoint,
)
from economics_recovery_audit import AuditReport

SCHEMA = """
CREATE TABLE witness_head (
    singleton INTEGER PRIMARY KEY CHECK (singleton=1),
    realm TEXT NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence>=0),
    projected_events INTEGER NOT NULL CHECK (projected_events>=0),
    logical_sha256 TEXT NOT NULL CHECK(length(logical_sha256)=64),
    mutation_revision INTEGER NOT NULL DEFAULT 0 CHECK(mutation_revision>=0)
);
"""


class WitnessConflict(InvalidCheckpoint):
    """An observed checkpoint conflicts with the separately retained tip."""


def _witness_path(path: str | Path) -> Path:
    candidate = Path(path)
    if not candidate.is_file():
        raise WitnessConflict("Trusted witness database does not exist")
    return candidate.resolve()


def _open_witness(path: str | Path) -> sqlite3.Connection:
    file = _witness_path(path)
    db = sqlite3.connect(
        f"{file.as_uri()}?mode=rw", uri=True, isolation_level=None, timeout=8.0
    )
    db.execute("PRAGMA busy_timeout=8000")
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA synchronous=FULL")
    return db


def _head(db: sqlite3.Connection) -> tuple[str, int, int, str, int]:
    if db.execute("PRAGMA integrity_check").fetchone() != ("ok",):
        raise WitnessConflict("Witness storage integrity failed")
    rows = db.execute(
        "SELECT realm,sequence,projected_events,logical_sha256,mutation_revision"
        " FROM witness_head WHERE singleton=1"
    ).fetchall()
    if len(rows) != 1 or db.execute(
        "SELECT count(*) FROM witness_head"
    ).fetchone()[0] != 1:
        raise WitnessConflict("Witness has no unique committed tip")
    realm, sequence, projected, digest, mutation_revision = rows[0]
    if (
        not isinstance(realm, str) or not realm
        or type(sequence) is not int or sequence < 0
        or type(projected) is not int or projected < 0
        or type(mutation_revision) is not int or mutation_revision < 0
        or not isinstance(digest, str) or len(digest) != 64
    ):
        raise WitnessConflict("Malformed persisted witness state")
    return realm, sequence, projected, digest, mutation_revision


def initialize_fixture_witness(
    witness_path: str | Path,
    genesis_db_path: str | Path,
    checkpoint: AuthenticatedCheckpoint,
    *,
    realm: str,
    trusted_keys: Mapping[str, bytes],
) -> None:
    """Explicit initial provisioning of an UNUSED external file.

    Provisioning is not an automatic recovery fallback. A lost witness must
    require an independent owner decision, never silently reset on restore.
    """
    witness = Path(witness_path)
    if witness.exists() or witness.is_symlink():
        raise FileExistsError("Existing witness cannot be overwritten/reset")
    if Path(genesis_db_path).resolve() == witness.resolve():
        raise WitnessConflict("Economy database cannot double as its witness")
    report = verify_fixture_checkpoint(
        genesis_db_path, checkpoint, expected_realm=realm,
        trusted_keys=trusted_keys, minimum_committed_sequence=0,
    )
    if report.sequence != 0 or report.inbox_events != 0:
        raise WitnessConflict("Only unused genesis may provision a new witness")

    created = False
    db = None
    try:
        db = sqlite3.connect(str(witness), isolation_level=None)
        created = True
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA synchronous=FULL")
        db.executescript(SCHEMA)
        db.execute("BEGIN IMMEDIATE")
        db.execute(
            "INSERT INTO witness_head(singleton,realm,sequence,"
            "projected_events,logical_sha256,mutation_revision) VALUES(1,?,?,?,?,?)",
            (realm, 0, 0, report.logical_sha256, 0),
        )
        db.commit()
    except BaseException:
        if db is not None and db.in_transaction:
            db.rollback()
        if db is not None:
            db.close()
            db = None
        if created:
            witness.unlink(missing_ok=True)
        raise
    finally:
        if db is not None:
            db.close()


def observe_fixture_checkpoint(
    witness_path: str | Path,
    current_db_path: str | Path,
    checkpoint: AuthenticatedCheckpoint,
    *,
    realm: str,
    trusted_keys: Mapping[str, bytes],
    failpoint: str | None = None,
) -> str:
    """Advance one independent witness tip following full live DB validation.

    Progress is monotonic independently across (committed purchase sequence,
    applied outbox count, admitted revocation revision). Direct SQL edits that
    bypass those clocks are rejected at unchanged progress, not authorized.

    Deliberate hard_exit failpoints may terminate a disposable test process.
    """
    allowed = (
        None, "before_commit", "after_commit",
        "hard_exit_before_commit", "hard_exit_after_commit",
    )
    if failpoint not in allowed:
        raise ValueError("Unknown witness fault-injection mode")
    db = _open_witness(witness_path)
    committed = False
    try:
        db.execute("BEGIN IMMEDIATE")
        existing_realm, sequence, projected, digest, mutation_revision = _head(db)
        if existing_realm != realm:
            raise WitnessConflict("Witness registered for another realm")
        report = verify_fixture_checkpoint(
            current_db_path, checkpoint, expected_realm=realm,
            trusted_keys=trusted_keys, minimum_committed_sequence=sequence,
        )
        next_progress = (report.sequence, report.inbox_events, report.mutation_revision)
        old_progress = (sequence, projected, mutation_revision)
        if any(new < old for new, old in zip(next_progress, old_progress)):
            raise WitnessConflict("Committed/projection watermark rollback")
        if next_progress == old_progress:
            if report.logical_sha256 != digest:
                raise WitnessConflict("Changed state at unchanged monotonic clock")
            db.commit()
            committed = True
            return "unchanged"
        if db.execute(
            "UPDATE witness_head SET sequence=?, projected_events=?,"
            "logical_sha256=?, mutation_revision=? WHERE singleton=1 AND sequence=?"
            " AND projected_events=? AND logical_sha256=? AND mutation_revision=?",
            (report.sequence, report.inbox_events, report.logical_sha256,
             report.mutation_revision, sequence, projected, digest, mutation_revision),
        ).rowcount != 1:
            raise WitnessConflict("Concurrent witness changed during update")
        if failpoint == "hard_exit_before_commit":
            import os
            os._exit(91)  # TEST ONLY, never a game server operation.
        if failpoint == "before_commit":
            raise WitnessConflict("Simulated witness commit failure")
        db.commit()
        committed = True
        if failpoint == "hard_exit_after_commit":
            import os
            os._exit(91)
        if failpoint == "after_commit":
            raise WitnessConflict("Witness committed; acknowledgment lost")
        return "advanced"
    except BaseException:
        if not committed:
            db.rollback()
        raise
    finally:
        db.close()


def verify_restore_with_witness(
    witness_path: str | Path,
    restored_db_path: str | Path,
    checkpoint: AuthenticatedCheckpoint,
    *,
    realm: str,
    trusted_keys: Mapping[str, bytes],
) -> AuditReport:
    """Require the restored database to match the *exact* persisted tip.

    Holding the witness's writer lock prevents a simultaneous tip update
    during this offline check. This function does not authorize game access.
    """
    db = _open_witness(witness_path)
    try:
        db.execute("BEGIN IMMEDIATE")
        expected_realm, sequence, projected, digest, mutation_revision = _head(db)
        if expected_realm != realm:
            raise WitnessConflict("Witness realm mismatch")
        report = verify_fixture_checkpoint(
            restored_db_path, checkpoint, expected_realm=realm,
            trusted_keys=trusted_keys, minimum_committed_sequence=sequence,
        )
        if (
            report.sequence != sequence
            or report.inbox_events != projected
            or report.mutation_revision != mutation_revision
            or report.logical_sha256 != digest
        ):
            raise WitnessConflict("Restore does not match separately committed tip")
        db.commit()
        return report
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()


def read_fixture_witness_tip(path: str | Path) -> tuple[str, int, int, str]:
    """Debug-only inspection; not a trusted counter on its own."""
    db = _open_witness(path)
    try:
        db.execute("BEGIN IMMEDIATE")
        tip = _head(db)
        db.commit()
        return tip[:4]
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()


def read_fixture_witness_mutation_revision(path: str | Path) -> int:
    """Read the additional witnessed revocation revision, fixture-only."""
    db = _open_witness(path)
    try:
        db.execute("BEGIN IMMEDIATE")
        revision = _head(db)[4]
        db.commit()
        return revision
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()
