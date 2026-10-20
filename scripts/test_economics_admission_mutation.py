"""E2d+ offline mutation revision, revocation replay and witness acceptance."""

from pathlib import Path
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest

from economics_sqlite_lab import (
    Denied, InjectedFailure, PurchaseIntent, VerifiedSession,
    bootstrap_fixture, purchase, snapshot,
)
from economics_admission_mutation import revoke_fixture_session, revoke_fixture_listing
from economics_recovery_audit import (
    CorruptState, audit_fixture_database, backup_fixture_database,
)
from economics_checkpoint_auth import issue_fixture_checkpoint, InvalidCheckpoint
from economics_recovery_witness import (
    WitnessConflict, initialize_fixture_witness, observe_fixture_checkpoint,
    verify_restore_with_witness, read_fixture_witness_tip,
    read_fixture_witness_mutation_revision,
)

KEY = b"myaso-demo-admission-mutation-key-0000000000000001"
REALM = "fictional-realm"
KEY_ID = "fixture-key"


class AdmissionMutationTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix="myaso-e2d-mutation-")
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.db = self.root / "credits.sqlite3"
        self.witness = self.root / "outside-witness.sqlite3"
        bootstrap_fixture(self.db)
        initial = self.seal()
        initialize_fixture_witness(
            self.witness, self.db, initial, realm=REALM,
            trusted_keys={KEY_ID: KEY},
        )

    def seal(self, path=None):
        return issue_fixture_checkpoint(
            path or self.db, realm=REALM, key_id=KEY_ID, secret=KEY,
        )

    def observe(self, checkpoint=None, path=None):
        return observe_fixture_checkpoint(
            self.witness, path or self.db, checkpoint or self.seal(),
            realm=REALM, trusted_keys={KEY_ID: KEY},
        )

    def restore(self, checkpoint, path=None):
        return verify_restore_with_witness(
            self.witness, path or self.db, checkpoint,
            realm=REALM, trusted_keys={KEY_ID: KEY},
        )

    def session(self, operation_id="revoke-10", player_id=10, epoch=8, fault=None):
        return revoke_fixture_session(
            self.db, operation_id=operation_id, player_id=player_id,
            session_epoch=epoch, failpoint=fault,
        )

    def listing(self, operation_id="revoke-50", listing_id=50, fault=None):
        return revoke_fixture_listing(
            self.db, operation_id=operation_id, listing_id=listing_id,
            failpoint=fault,
        )

    def child(self, kind, failpoint):
        fn = "revoke_fixture_session" if kind == "session" else "revoke_fixture_listing"
        kw = (
            "operation_id='revoke-10',player_id=10,session_epoch=8"
            if kind == "session" else
            "operation_id='revoke-50',listing_id=50"
        )
        code = (
            f"from economics_admission_mutation import {fn}; "
            f"{fn}({str(self.db)!r},{kw},failpoint={failpoint!r})"
        )
        return subprocess.run(
            [sys.executable, "-c", code],
            env={**os.environ, "PYTHONPATH": str(Path(__file__).parent)},
            capture_output=True, text=True, timeout=10, check=False,
        )

    def test_revoke_session_advances_independent_witness_clock(self):
        old = self.seal()
        self.assertEqual(self.session(), 1)
        report = audit_fixture_database(self.db)
        self.assertEqual((report.sequence, report.inbox_events, report.mutation_revision),
                         (0, 0, 1))
        signed = self.seal()
        with self.assertRaises(WitnessConflict):
            self.restore(signed)
        self.assertEqual(self.observe(signed), "advanced")
        self.assertEqual(read_fixture_witness_mutation_revision(self.witness), 1)
        self.assertEqual(self.restore(signed).mutation_revision, 1)
        with self.assertRaises((InvalidCheckpoint, WitnessConflict)):
            self.restore(old)

    def test_revoked_epoch_denies_existing_session_without_credits(self):
        self.session()
        original = snapshot(self.db)
        with self.assertRaises(Denied):
            purchase(
                self.db, VerifiedSession(10, 8),
                PurchaseIntent("buy", 10, 50, 1, 1), 20,
            )
        self.assertEqual(snapshot(self.db), original)
        self.assertTrue(audit_fixture_database(self.db).mutation_revision == 1)

    def test_listing_consent_revocation_commits_atomically_and_denies_purchase(self):
        self.assertEqual(self.listing(), 1)
        db = sqlite3.connect(self.db)
        self.addCleanup(db.close)
        self.assertEqual(db.execute("SELECT state FROM listings WHERE id=50").fetchone(),
                         ("revoked",))
        self.assertEqual(db.execute(
            "SELECT state FROM seller_consents WHERE listing_id=50"
        ).fetchone(), ("revoked",))
        with self.assertRaises(Denied):
            purchase(
                self.db, VerifiedSession(10, 8),
                PurchaseIntent("buy", 10, 50, 1, 1), 20,
            )
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, 1)
        self.assertEqual(self.observe(), "advanced")
        self.assertEqual(self.restore(self.seal()).mutation_revision, 1)

    def test_two_distinct_revocations_create_gap_free_monotonic_log(self):
        self.assertEqual(self.session(), 1)
        self.assertEqual(self.listing(), 2)
        report = audit_fixture_database(self.db)
        self.assertEqual(report.mutation_revision, 2)
        self.assertEqual(report.receipts, 0)
        self.observe()
        self.assertEqual(read_fixture_witness_mutation_revision(self.witness), 2)
        self.assertEqual(self.restore(self.seal()).mutation_revision, 2)

    def test_duplicate_operation_retry_does_not_bump_mutation_revision(self):
        a = self.session()
        self.assertEqual(a, 1)
        self.assertEqual(self.session(), a)
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, a)
        self.assertEqual(self.listing(), 2)
        self.assertEqual(self.listing(), 2)
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, 2)

    def test_conflicting_operation_id_never_performs_other_revocation(self):
        self.session(operation_id="duplicate-op")
        original = snapshot(self.db)
        with self.assertRaises(Denied):
            self.listing(operation_id="duplicate-op")
        with self.assertRaises(Denied):
            self.session(operation_id="duplicate-op", player_id=30)
        self.assertEqual(snapshot(self.db), original)
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, 1)

    def test_precommit_injected_exception_and_child_kills_leave_no_changes(self):
        original = self.seal()
        for point in ("before_commit",):
            with self.assertRaises(InjectedFailure):
                self.session(fault=point)
            self.assertEqual(self.seal(), original)
        for point in ("hard_exit_before_commit",):
            child = self.child("session", point)
            self.assertEqual(child.returncode, 91, child.stderr)
            self.assertEqual(self.seal(), original)
        self.assertEqual(self.session(), 1)

    def test_postcommit_lost_acknowledgment_and_restart_keep_one_revocation(self):
        with self.assertRaises(InjectedFailure):
            self.session(fault="after_commit")
        self.assertEqual(self.session(), 1)
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, 1)
        self.observe()
        self.assertEqual(self.restore(self.seal()).mutation_revision, 1)

    def test_hard_kill_after_commit_retains_listing_revocation(self):
        child = self.child("listing", "hard_exit_after_commit")
        self.assertEqual(child.returncode, 91, child.stderr)
        self.assertEqual(self.listing(), 1)
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, 1)
        self.observe()
        self.assertEqual(self.restore(self.seal()).mutation_revision, 1)

    def test_reverted_valid_mutation_backup_fails_against_advanced_witness(self):
        old = self.root / "old-backup.sqlite3"
        backup_fixture_database(self.db, old)
        old_checkpoint = self.seal(old)
        self.session()
        self.observe()
        with self.assertRaises((InvalidCheckpoint, WitnessConflict)):
            self.restore(old_checkpoint, old)
        self.assertEqual(audit_fixture_database(old).mutation_revision, 0)

    def test_witness_detects_rollback_even_with_unchanged_purchase_sequence(self):
        self.session()
        self.observe()
        with sqlite3.connect(self.db) as db:
            db.execute("DELETE FROM admission_mutations WHERE revision=1")
            db.execute("UPDATE admitted_sessions SET state='active' WHERE player_id=10")
            db.execute("UPDATE metadata SET mutation_revision=0 WHERE singleton=1")
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, 0)
        with self.assertRaises(WitnessConflict):
            self.observe()
        self.assertEqual(read_fixture_witness_mutation_revision(self.witness), 1)

    def test_witness_rejects_session_reactivation_without_advancing_revision(self):
        self.session()
        self.observe()
        with sqlite3.connect(self.db) as db:
            db.execute("UPDATE admitted_sessions SET state='active' WHERE player_id=10")
        with self.assertRaises(CorruptState):
            audit_fixture_database(self.db)

    def test_audit_rejects_missing_gap_or_forged_revocation(self):
        self.session()
        with sqlite3.connect(self.db) as db:
            db.execute("DELETE FROM admission_mutations WHERE revision=1")
        with self.assertRaises(CorruptState):
            audit_fixture_database(self.db)

    def test_concurrent_revocation_processes_commit_one_operation(self):
        fn = "from economics_admission_mutation import revoke_fixture_session; "
        code = (
            f"{fn}revoke_fixture_session({str(self.db)!r},operation_id='revoke-10',"
            "player_id=10,session_epoch=8)"
        )
        env = {**os.environ, "PYTHONPATH": str(Path(__file__).parent)}
        children = [
            subprocess.Popen([sys.executable, "-c", code], env=env,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            for _ in range(2)
        ]
        replies = [p.communicate(timeout=10) for p in children]
        self.assertTrue(all(p.returncode == 0 for p in children), replies)
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, 1)

    def test_invalid_epochs_and_cross_kind_fail_closed(self):
        with self.assertRaises(Denied):
            self.session(epoch=0)
        with self.assertRaises(Denied):
            self.session(player_id=999)
        with self.assertRaises(Denied):
            self.listing(listing_id=999)
        with self.assertRaises(Denied):
            self.session(operation_id="space invalid")
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, 0)

    def test_mutation_commit_can_coexist_with_prior_purchase_and_projection(self):
        purchase(
            self.db, VerifiedSession(10, 8),
            PurchaseIntent("buy", 10, 50, 1, 1), 20,
        )
        project_title_event = __import__(
            "economics_sqlite_lab"
        ).project_title_event
        project_title_event(self.db, 1)
        self.assertEqual(self.session(), 1)
        report = audit_fixture_database(self.db)
        self.assertEqual((report.sequence, report.inbox_events, report.mutation_revision),
                         (1, 1, 1))
        self.assertEqual(self.observe(), "advanced")
        self.assertEqual(self.restore(self.seal()).mutation_revision, 1)


if __name__ == "__main__":
    unittest.main()
