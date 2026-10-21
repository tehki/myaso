"""E2d fixture-only admitted session issuance and property-cap journal tests."""

import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

from economics_sqlite_lab import (
    Denied, InjectedFailure, VerifiedSession, PurchaseIntent,
    bootstrap_fixture, purchase,
)
from economics_admission_mutation import (
    issue_fixture_session, revoke_fixture_session, change_fixture_title_cap,
)
from economics_recovery_audit import (
    CorruptState, audit_fixture_database, backup_fixture_database,
)
from economics_checkpoint_auth import issue_fixture_checkpoint, InvalidCheckpoint
from economics_recovery_witness import (
    WitnessConflict, initialize_fixture_witness, observe_fixture_checkpoint,
    verify_restore_with_witness, read_fixture_witness_mutation_revision,
)

KEY = b"myaso fiction-only admission-issuer key 000000000000000000001"
REALM = "fixture-realm"
KEY_ID = "fixture-key"


class IssuanceAndPolicyTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix="myaso-e2d-issue-")
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.db = self.root / "economy.sqlite3"
        self.witness = self.root / "witness.sqlite3"
        bootstrap_fixture(self.db)
        initialize_fixture_witness(
            self.witness, self.db, self.seal(), realm=REALM,
            trusted_keys={KEY_ID: KEY},
        )

    def seal(self, path=None):
        return issue_fixture_checkpoint(
            path or self.db, realm=REALM, key_id=KEY_ID, secret=KEY,
        )

    def observe(self):
        return observe_fixture_checkpoint(
            self.witness, self.db, self.seal(), realm=REALM,
            trusted_keys={KEY_ID: KEY},
        )

    def restore(self, checkpoint, path=None):
        return verify_restore_with_witness(
            self.witness, path or self.db, checkpoint, realm=REALM,
            trusted_keys={KEY_ID: KEY},
        )

    def issue(self, op="issue-9", player=10, epoch=9, failpoint=None):
        return issue_fixture_session(
            self.db, operation_id=op, player_id=player,
            session_epoch=epoch, failpoint=failpoint,
        )

    def cap(self, n=3, op="cap-3", failpoint=None):
        return change_fixture_title_cap(
            self.db, operation_id=op, new_cap=n, failpoint=failpoint,
        )

    def child(self, expr):
        return subprocess.run(
            [sys.executable, "-c", expr],
            env={**os.environ, "PYTHONPATH": str(Path(__file__).parent)},
            capture_output=True, text=True, timeout=10, check=False,
        )

    def test_session_issue_advances_mutation_counter_without_issuing_money(self):
        original = audit_fixture_database(self.db)
        self.assertEqual(self.issue(), 1)
        report = audit_fixture_database(self.db)
        self.assertEqual(report.mutation_revision, 1)
        self.assertEqual(report.issued_units, original.issued_units)
        self.assertEqual(report.sequence, 0)
        with sqlite3.connect(self.db) as conn:
            self.assertEqual(conn.execute(
                "SELECT state FROM admitted_sessions WHERE player_id=10 AND epoch=9"
            ).fetchone(), ("active",))

    def test_newly_issued_epoch_can_use_existing_test_buyer_funds(self):
        self.issue()
        receipt = purchase(
            self.db, VerifiedSession(10, 9),
            PurchaseIntent("purchase-epoch-9", 10, 50, 1, 1), 20,
        )
        self.assertEqual(receipt["buyer_id"], 10)
        report = audit_fixture_database(self.db)
        self.assertEqual((report.sequence, report.mutation_revision), (1, 1))
        self.assertEqual(self.observe(), "advanced")
        self.assertEqual(self.restore(self.seal()).sequence, 1)

    def test_new_epoch_must_be_strictly_larger_and_belong_to_player(self):
        for player, epoch in ((10, 8), (10, 7), (99, 9), (1, 9), (10, 0)):
            with self.subTest(player=player, epoch=epoch):
                with self.assertRaises(Denied):
                    self.issue(player=player, epoch=epoch)
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, 0)

    def test_session_issue_then_revoke_journal_both_operations(self):
        self.assertEqual(self.issue(), 1)
        self.assertEqual(revoke_fixture_session(
            self.db, operation_id="revoke-issued-9", player_id=10, session_epoch=9
        ), 2)
        report = audit_fixture_database(self.db)
        self.assertEqual(report.mutation_revision, 2)
        with sqlite3.connect(self.db) as conn:
            self.assertEqual(conn.execute(
                "SELECT state FROM admitted_sessions WHERE player_id=10 AND epoch=9"
            ).fetchone(), ("revoked",))
        self.observe()
        self.assertEqual(read_fixture_witness_mutation_revision(self.witness), 2)

    def test_issue_and_title_cap_idempotency_or_conflict(self):
        self.assertEqual(self.issue(), 1)
        self.assertEqual(self.issue(), 1)
        with self.assertRaises(Denied):
            self.issue(epoch=10)
        self.assertEqual(self.cap(), 2)
        self.assertEqual(self.cap(), 2)
        with self.assertRaises(Denied):
            self.cap(n=4)
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, 2)

    def test_title_cap_change_can_lower_only_to_current_holdings(self):
        self.assertEqual(self.cap(n=1, op="cap-1"), 1)
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, 1)
        with sqlite3.connect(self.db) as conn:
            self.assertEqual(conn.execute(
                "SELECT title_cap FROM metadata WHERE singleton=1"
            ).fetchone(), (1,))
        for cap, op in ((1,"same-1"),(0,"zero"),(-1,"negative")):
            with self.subTest(cap=cap):
                with self.assertRaises(Denied):
                    self.cap(n=cap, op=op)
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, 1)

    def test_policy_changes_are_witnessed_and_old_backup_is_rejected(self):
        old = self.root / "previous.sqlite3"
        backup_fixture_database(self.db, old)
        previous = self.seal(old)
        self.assertEqual(self.cap(n=3, op="new-cap"), 1)
        with self.assertRaises(WitnessConflict):
            self.restore(self.seal())
        self.assertEqual(self.observe(), "advanced")
        self.assertEqual(self.restore(self.seal()).mutation_revision, 1)
        with self.assertRaises((InvalidCheckpoint, WitnessConflict)):
            self.restore(previous, old)
        self.assertEqual(read_fixture_witness_mutation_revision(self.witness), 1)

    def test_two_policy_changes_keep_strictly_increasing_log(self):
        self.cap(n=3, op="increase")
        self.cap(n=2, op="decrease")
        report = audit_fixture_database(self.db)
        self.assertEqual(report.mutation_revision, 2)
        self.observe()
        self.assertEqual(self.restore(self.seal()).mutation_revision, 2)

    def test_tampered_policy_but_preserved_mutation_log_fails_audit(self):
        self.cap(n=3)
        with sqlite3.connect(self.db) as conn:
            conn.execute("UPDATE metadata SET title_cap=4 WHERE singleton=1")
        with self.assertRaises(CorruptState):
            audit_fixture_database(self.db)

    def test_missing_issued_epoch_or_forged_cap_event_fails_audit(self):
        self.issue()
        with sqlite3.connect(self.db) as conn:
            conn.execute("DELETE FROM admitted_sessions WHERE player_id=10 AND epoch=9")
        with self.assertRaises(CorruptState):
            audit_fixture_database(self.db)
        # Separate fixture for policy-journal corruption.
        alt = self.root / "alternative.sqlite3"
        bootstrap_fixture(alt)
        change_fixture_title_cap(alt, operation_id="cap-3", new_cap=3)
        with sqlite3.connect(alt) as conn:
            conn.execute(
                "UPDATE admission_mutations SET target_id=4 WHERE revision=1"
            )
        with self.assertRaises(CorruptState):
            audit_fixture_database(alt)

    def test_hard_kill_before_issue_commit_rolls_back_entire_mutation(self):
        pre = self.seal()
        cmd = (
            "from economics_admission_mutation import issue_fixture_session; "
            f"issue_fixture_session({str(self.db)!r},operation_id='issue-9',"
            "player_id=10,session_epoch=9,failpoint='hard_exit_before_commit')"
        )
        reply = self.child(cmd)
        self.assertEqual(reply.returncode, 91, reply.stderr)
        self.assertEqual(self.seal(), pre)
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, 0)

    def test_hard_kill_after_cap_commit_survives_restart_and_retry(self):
        cmd = (
            "from economics_admission_mutation import change_fixture_title_cap; "
            f"change_fixture_title_cap({str(self.db)!r},operation_id='cap-3',"
            "new_cap=3,failpoint='hard_exit_after_commit')"
        )
        reply = self.child(cmd)
        self.assertEqual(reply.returncode, 91, reply.stderr)
        self.assertEqual(self.cap(), 1)
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, 1)

    def test_competing_processes_issue_one_epoch_once(self):
        cmd = (
            "from economics_admission_mutation import issue_fixture_session; "
            f"issue_fixture_session({str(self.db)!r},operation_id='issue-9',"
            "player_id=10,session_epoch=9)"
        )
        env = {**os.environ, "PYTHONPATH": str(Path(__file__).parent)}
        ps = [
            subprocess.Popen([sys.executable, "-c", cmd], env=env,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            for _ in range(2)
        ]
        responses = [p.communicate(timeout=10) for p in ps]
        self.assertTrue(all(p.returncode == 0 for p in ps), responses)
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, 1)

    def test_revoked_fixture_session_not_auto_reissued_same_epoch(self):
        self.issue()
        revoke_fixture_session(
            self.db, operation_id="revoke-9", player_id=10, session_epoch=9
        )
        with self.assertRaises(Denied):
            self.issue(op="issue-again", epoch=9)
        self.assertEqual(self.issue(op="issue-10", epoch=10), 3)
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, 3)

    def test_both_purchases_and_new_policy_changes_can_be_audited(self):
        purchase(
            self.db, VerifiedSession(10, 8),
            PurchaseIntent("buy-fixture", 10, 50, 1, 1), 20,
        )
        self.cap(n=3)
        report = audit_fixture_database(self.db)
        self.assertEqual((report.sequence, report.mutation_revision), (1, 1))
        self.assertEqual(self.observe(), "advanced")
        self.assertEqual(self.restore(self.seal()).sequence, 1)


if __name__ == "__main__":
    unittest.main()
