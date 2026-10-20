"""E2d independent trusted-anchor and SQLite restore acceptance tests."""

from dataclasses import replace
from pathlib import Path
import sqlite3
import tempfile
import unittest

from economics_sqlite_lab import (
    VerifiedSession, PurchaseIntent, bootstrap_fixture, purchase,
    project_title_event, snapshot,
)
from economics_recovery_audit import (
    CorruptState, RecoveryAnchor, audit_fixture_database,
    anchor_fixture_checkpoint, verify_against_trusted_anchor,
    backup_fixture_database,
)


class RecoveryAuditTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="myaso-e2d-audit-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.db = self.root / "live-fixture.sqlite3"
        bootstrap_fixture(self.db)

    def buy(self):
        return purchase(
            self.db, VerifiedSession(10, 8),
            PurchaseIntent("op-A", 10, 50, 1, 1), 20,
        )

    def validate(self):
        return audit_fixture_database(self.db)

    def test_fresh_disposable_genesis_has_consistent_zero_commits(self):
        report = self.validate()
        self.assertEqual(report.sequence, 0)
        self.assertEqual(report.receipts, 0)
        self.assertEqual(report.issued_units, 2400)
        self.assertEqual(report.inbox_events, 0)
        self.assertEqual(len(report.logical_sha256), 64)
        anchor = anchor_fixture_checkpoint(self.db)
        self.assertEqual(verify_against_trusted_anchor(self.db, anchor), report)

    def test_committed_sale_before_or_after_projection_is_consistent(self):
        self.buy()
        before = self.validate()
        self.assertEqual((before.sequence, before.receipts), (1, 1))
        self.assertEqual(before.inbox_events, 0)
        project_title_event(self.db, 1)
        after = self.validate()
        self.assertEqual(after.inbox_events, 1)
        self.assertNotEqual(after.logical_sha256, before.logical_sha256)
        self.assertEqual(
            verify_against_trusted_anchor(self.db, anchor_fixture_checkpoint(self.db)),
            after,
        )

    def test_valid_old_backup_is_rejected_by_newer_committed_anchor(self):
        old_backup = self.root / "previous.sqlite3"
        backup_fixture_database(self.db, old_backup)
        old_report = audit_fixture_database(old_backup)
        self.assertEqual(old_report.sequence, 0)
        self.buy()
        newer_anchor = anchor_fixture_checkpoint(self.db)
        self.assertEqual(newer_anchor.sequence, 1)
        self.assertEqual(audit_fixture_database(old_backup).sequence, 0)
        with self.assertRaises(CorruptState):
            verify_against_trusted_anchor(old_backup, newer_anchor)
        # Untrusted self-certification of old data cannot establish recency.
        old_anchor = anchor_fixture_checkpoint(old_backup)
        self.assertEqual(
            verify_against_trusted_anchor(old_backup, old_anchor).sequence, 0
        )

    def test_committed_backup_reopens_without_wal_dependency(self):
        self.buy()
        project_title_event(self.db, 1)
        trusted = anchor_fixture_checkpoint(self.db)
        backup = self.root / "committed.sqlite3"
        backup_fixture_database(self.db, backup)
        self.assertEqual(verify_against_trusted_anchor(backup, trusted).sequence, 1)
        self.assertEqual(snapshot(backup)["title"], (10, 2))
        self.assertEqual(snapshot(backup)["read_model"], (10, 2, 1))
        self.assertEqual(snapshot(backup)["consumed_events"], 1)
        self.assertTrue(snapshot(backup)["conserved"])

    def test_modified_balances_are_detected_even_if_supply_still_balances(self):
        self.buy()
        trusted = anchor_fixture_checkpoint(self.db)
        with sqlite3.connect(self.db) as conn:
            conn.execute("UPDATE accounts SET units=units-1 WHERE id=10")
            conn.execute("UPDATE accounts SET units=units+1 WHERE id=30")
        self.assertTrue(snapshot(self.db)["conserved"])
        with self.assertRaises(CorruptState):
            verify_against_trusted_anchor(self.db, trusted)
        # Internal accounting invariants alone don't prove a valid balance
        # redistribution was authorized; the external digest is needed.
        self.assertEqual(audit_fixture_database(self.db).sequence, 1)

    def test_posting_forgery_breaks_receipt_consistency(self):
        self.buy()
        with sqlite3.connect(self.db) as conn:
            conn.execute(
                "UPDATE postings SET delta_units=delta_units+1"
                " WHERE sequence=1 AND slot=0"
            )
            conn.execute(
                "UPDATE postings SET delta_units=delta_units-1"
                " WHERE sequence=1 AND slot=1"
            )
        self.assertTrue(snapshot(self.db)["conserved"])
        with self.assertRaises(CorruptState):
            self.validate()

    def test_deleted_receipt_or_outbox_breaks_committed_completeness(self):
        for record in ("receipts", "outbox"):
            with self.subTest(record=record):
                backup = self.root / f"start-{record}.sqlite3"
                backup_fixture_database(self.db, backup)
                purchase(
                    backup, VerifiedSession(10, 8),
                    PurchaseIntent("op-A", 10, 50, 1, 1), 20,
                )
                with sqlite3.connect(backup) as conn:
                    conn.execute("PRAGMA foreign_keys=OFF")
                    conn.execute(f"DELETE FROM {record} WHERE sequence=1")
                with self.assertRaises(CorruptState):
                    audit_fixture_database(backup)

    def test_outbox_digest_disagreement_and_projection_mismatch_fail(self):
        self.buy()
        project_title_event(self.db, 1)
        with sqlite3.connect(self.db) as conn:
            conn.execute(
                "UPDATE projection_inbox SET payload_sha256=? WHERE sequence=1",
                ("0" * 64,),
            )
        with self.assertRaises(CorruptState):
            self.validate()
        with sqlite3.connect(self.db) as conn:
            conn.execute("UPDATE projection_inbox SET payload_sha256=("
                         "SELECT lower(hex(zeroblob(32))) ) WHERE sequence=1")
        # Still invalid digest; cannot re-certify malformed state.
        with self.assertRaises(CorruptState):
            self.validate()

    def test_projection_without_durable_inbox_is_invalid(self):
        self.buy()
        project_title_event(self.db, 1)
        with sqlite3.connect(self.db) as conn:
            conn.execute("DELETE FROM projection_inbox WHERE sequence=1")
        with self.assertRaises(CorruptState):
            self.validate()

    def test_mismatched_title_and_consumed_consent_fail(self):
        self.buy()
        with sqlite3.connect(self.db) as conn:
            conn.execute("UPDATE titles SET owner_id=30 WHERE parcel_id=42")
        with self.assertRaises(CorruptState):
            self.validate()
        with sqlite3.connect(self.db) as conn:
            conn.execute("UPDATE titles SET owner_id=10 WHERE parcel_id=42")
            conn.execute(
                "UPDATE seller_consents SET state='approved'"
                " WHERE id='TEST_FIXTURE_ONLY'"
            )
        with self.assertRaises(CorruptState):
            self.validate()

    def test_trusted_anchor_detects_missing_database_uniqueness_index(self):
        trusted = anchor_fixture_checkpoint(self.db)
        with sqlite3.connect(self.db) as conn:
            conn.execute("DROP INDEX one_active_listing_per_parcel")
        # Existing data are still internally consistent, but future admission
        # would be unsafe without the required uniqueness constraint.
        self.assertEqual(audit_fixture_database(self.db).sequence, 0)
        with self.assertRaises(CorruptState):
            verify_against_trusted_anchor(self.db, trusted)

    def test_bad_external_anchor_and_nonexistent_db_fail_closed(self):
        self.buy()
        anchor = anchor_fixture_checkpoint(self.db)
        with self.assertRaises(CorruptState):
            verify_against_trusted_anchor(self.db, replace(anchor, sequence=0))
        with self.assertRaises(CorruptState):
            verify_against_trusted_anchor(
                self.db, RecoveryAnchor(anchor.sequence, "x" * 64)
            )
        with self.assertRaises(CorruptState):
            verify_against_trusted_anchor(self.db, ("not", "a", "checkpoint"))
        absent = self.root / "absent.sqlite3"
        with self.assertRaises(CorruptState):
            audit_fixture_database(absent)
        self.assertFalse(absent.exists())

    def test_backup_refuses_overwrite_and_self_backup(self):
        first = self.root / "backup.sqlite3"
        backup_fixture_database(self.db, first)
        stable = anchor_fixture_checkpoint(first)
        for target in (self.db, first):
            with self.assertRaises(FileExistsError):
                backup_fixture_database(self.db, target)
        self.assertEqual(verify_against_trusted_anchor(first, stable).sequence, 0)

    def test_crash_recovery_can_audit_rolled_back_write(self):
        import os
        import subprocess
        import sys
        code = (
            "from economics_sqlite_lab import *; "
            f"purchase({str(self.db)!r},VerifiedSession(10,8),"
            "PurchaseIntent('op-A',10,50,1,1),20,"
            "failpoint='hard_exit_before_commit')"
        )
        child = subprocess.run(
            [sys.executable, "-c", code],
            env={**os.environ, "PYTHONPATH": str(Path(__file__).parent)},
            capture_output=True, text=True, timeout=10,
        )
        self.assertEqual(child.returncode, 91, child.stderr)
        self.assertEqual(self.validate().sequence, 0)
        self.assertEqual(self.validate().receipts, 0)
        self.assertTrue(snapshot(self.db)["conserved"])


if __name__ == "__main__":
    unittest.main()
