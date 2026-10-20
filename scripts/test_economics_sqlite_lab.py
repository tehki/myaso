"""E2d offline-only real SQLite file and crash/replay regression tests."""

from pathlib import Path
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest

from economics_sqlite_lab import (
    Denied, InjectedFailure, PurchaseIntent, VerifiedSession,
    bootstrap_fixture, purchase, snapshot, MAX_INT,
)


def buyer(which=10, op="op-A"):
    return VerifiedSession(which, 8), PurchaseIntent(op, which, 50, 1, 1)


class E2dDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.TemporaryDirectory(prefix="myaso-e2d-")
        self.addCleanup(self.root.cleanup)
        self.path = str(Path(self.root.name) / "test-fixture.sqlite3")
        bootstrap_fixture(self.path)

    def state(self):
        return snapshot(self.path)

    def execute(self, who=10, op="op-A", failpoint=None, tick=20):
        s, i = buyer(who, op)
        return purchase(self.path, s, i, tick, failpoint=failpoint)

    def crash_child(self, who, op, point):
        script = (
            "from economics_sqlite_lab import *; "
            f"purchase({self.path!r},VerifiedSession({who},8),"
            f"PurchaseIntent({op!r},{who},50,1,1),20,failpoint={point!r})"
        )
        return subprocess.run(
            [sys.executable, "-c", script],
            env={**os.environ, "PYTHONPATH": str(Path(__file__).parent)},
            capture_output=True, text=True, timeout=10, check=False,
        )

    def test_fixture_balances_supply_and_no_payments(self):
        st = self.state()
        self.assertEqual(st["accounts"], [(1, 100, 1), (10, 1500, 1),
                                          (20, 200, 1), (30, 600, 1)])
        self.assertEqual(st["title"], (20, 1))
        self.assertEqual(st["listing"], "active")
        self.assertEqual(st["sequence"], 0)
        self.assertTrue(st["conserved"])

    def test_persistent_purchase_updates_account_deed_receipt_and_outbox(self):
        receipt = self.execute()
        self.assertEqual(receipt["sequence"], 1)
        self.assertEqual(receipt["seller_proceeds"], 490)
        self.assertEqual(receipt["treasury_fee"], 10)
        self.assertEqual(receipt["title_version"], 2)
        st = self.state()
        self.assertEqual(st["accounts"], [(1, 110, 2), (10, 1000, 2),
                                          (20, 690, 2), (30, 600, 1)])
        self.assertEqual(st["title"], (10, 2))
        self.assertEqual(st["listing"], "consumed")
        self.assertEqual((st["sequence"], st["receipts"], st["outbox"]), (1, 1, 1))
        self.assertEqual(st["postings"], [(1, 0, 3)])
        self.assertTrue(st["conserved"])

    def test_idempotent_retry_uses_durable_receipt_even_with_different_tick(self):
        first = self.execute(tick=20)
        second = self.execute(tick=55)
        self.assertEqual(first, second)
        self.assertEqual(self.state()["sequence"], 1)
        self.assertTrue(self.state()["conserved"])

    def test_cannot_steal_receipt_by_reusing_another_buyer_operation_id(self):
        self.execute()
        with self.assertRaises(Denied):
            self.execute(who=30)
        self.assertEqual(self.state()["receipts"], 1)
        self.assertTrue(self.state()["conserved"])

    def test_invalid_session_is_denied_before_receipt_lookup(self):
        self.execute()
        with self.assertRaises(Denied):
            purchase(
                self.path, VerifiedSession(30, 8),
                PurchaseIntent("op-A", 10, 50, 1, 1), 20,
            )
        with self.assertRaises(Denied):
            purchase(
                self.path, VerifiedSession(10, 0),
                PurchaseIntent("op-A", 10, 50, 1, 1), 20,
            )
        self.assertTrue(self.state()["conserved"])

    def test_stale_account_or_title_cannot_charge_or_transfer(self):
        s, i = buyer()
        with self.assertRaises(Denied):
            purchase(self.path, s, PurchaseIntent("op-A", 10, 50, 2, 1), 20)
        with self.assertRaises(Denied):
            purchase(self.path, s, PurchaseIntent("op-B", 10, 50, 1, 2), 20)
        self.assertEqual(self.state()["sequence"], 0)
        self.assertTrue(self.state()["conserved"])

    def test_expired_revoked_and_unfunded_attempts_are_atomic(self):
        with self.assertRaises(Denied):
            self.execute(tick=101)
        with sqlite3.connect(self.path) as db:
            db.execute("UPDATE listings SET state='revoked' WHERE id=50")
        with self.assertRaises(Denied):
            self.execute()
        with sqlite3.connect(self.path) as db:
            db.execute("UPDATE listings SET state='active' WHERE id=50")
            db.execute("UPDATE accounts SET units=499 WHERE id=10")
            db.execute("UPDATE accounts SET units=1601 WHERE id=30")
        with self.assertRaises(Denied):
            self.execute()
        self.assertEqual(self.state()["title"], (20, 1))
        self.assertEqual(self.state()["sequence"], 0)
        self.assertTrue(self.state()["conserved"])

    def test_failure_injection_rolls_back_whole_transaction(self):
        original = self.state()
        for failpoint in ("after_debit", "after_title", "before_commit"):
            with self.subTest(failpoint=failpoint):
                with self.assertRaises(InjectedFailure):
                    self.execute(failpoint=failpoint)
                self.assertEqual(self.state(), original)

    def test_hard_process_kill_before_commit_preserves_all_invariants(self):
        original = self.state()
        for failpoint in ("hard_exit_after_debit", "hard_exit_after_title",
                          "hard_exit_before_commit"):
            with self.subTest(failpoint=failpoint):
                child = self.crash_child(10, "op-A", failpoint)
                self.assertEqual(child.returncode, 91, child.stderr)
                self.assertEqual(self.state(), original)

    def test_hard_process_kill_after_commit_receipt_survives_restart(self):
        child = self.crash_child(10, "op-A", "hard_exit_after_commit")
        self.assertEqual(child.returncode, 91, child.stderr)
        st = self.state()
        self.assertEqual((st["sequence"], st["receipts"], st["outbox"]), (1, 1, 1))
        self.assertTrue(st["conserved"])
        replay = self.execute()
        self.assertEqual(replay["sequence"], 1)
        self.assertEqual(self.state(), st)

    def test_lost_acknowledgment_has_same_durable_semantics(self):
        with self.assertRaises(InjectedFailure):
            self.execute(failpoint="after_commit")
        self.assertEqual(self.state()["sequence"], 1)
        replay = self.execute()
        self.assertEqual(replay["sequence"], 1)
        self.assertTrue(self.state()["conserved"])

    def test_real_competing_processes_only_one_can_buy_single_listing(self):
        cmd = []
        for who in (10, 30):
            script = (
                "from economics_sqlite_lab import *; "
                f"purchase({self.path!r},VerifiedSession({who},8),"
                f"PurchaseIntent('op-{who}',{who},50,1,1),20)"
            )
            cmd.append([
                sys.executable, "-c", script,
            ])
        env = {**os.environ, "PYTHONPATH": str(Path(__file__).parent)}
        processes = [subprocess.Popen(c, env=env, stdout=subprocess.PIPE,
                                      stderr=subprocess.PIPE, text=True) for c in cmd]
        results = [p.communicate(timeout=10) for p in processes]
        self.assertEqual(sum(p.returncode == 0 for p in processes), 1, results)
        state = self.state()
        self.assertEqual(state["sequence"], 1)
        self.assertIn(state["title"][0], (10, 30))
        self.assertEqual(state["receipts"], 1)
        self.assertTrue(state["conserved"])

    def test_seller_cannot_self_purchase_and_op_id_rejects_bad_input(self):
        with self.assertRaises(Denied):
            self.execute(who=20)
        with self.assertRaises(Denied):
            self.execute(op="test space")
        with self.assertRaises(Denied):
            self.execute(op="")
        self.assertTrue(self.state()["conserved"])

    def test_title_revision_overflow_rolls_back_everything(self):
        with sqlite3.connect(self.path) as db:
            db.execute('UPDATE titles SET revision=? WHERE parcel_id=42',
                       (MAX_INT,))
            db.execute('UPDATE listings SET expected_title_revision=? WHERE id=50',
                       (MAX_INT,))
        before = self.state()
        with self.assertRaises(Denied):
            purchase(self.path, VerifiedSession(10, 8),
                     PurchaseIntent('op-A', 10, 50, MAX_INT, 1), 20)
        self.assertEqual(before, self.state())
        self.assertEqual(self.state()['sequence'], 0)
        self.assertTrue(self.state()['conserved'])


if __name__ == "__main__":
    unittest.main()
