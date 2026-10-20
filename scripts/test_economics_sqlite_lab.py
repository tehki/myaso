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
    pending_title_events, project_title_event,
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

    def test_revoke_admitted_session_denies_new_purchase_and_old_receipt_retrieval(self):
        previous = self.execute()
        self.assertEqual(previous["sequence"], 1)
        with sqlite3.connect(self.path) as db:
            db.execute(
                "UPDATE admitted_sessions SET state='revoked'"
                " WHERE player_id=10 AND epoch=8"
            )
        current = self.state()
        with self.assertRaises(Denied):
            self.execute()
        self.assertEqual(self.state(), current)
        self.assertTrue(self.state()["conserved"])

    def test_unknown_or_revoked_session_epoch_fails_before_a_charge(self):
        with self.assertRaises(Denied):
            purchase(self.path, VerifiedSession(10, 9),
                     PurchaseIntent("op-A", 10, 50, 1, 1), 20)
        with sqlite3.connect(self.path) as db:
            db.execute(
                "UPDATE admitted_sessions SET state='revoked'"
                " WHERE player_id=10 AND epoch=8"
            )
        before = self.state()
        with self.assertRaises(Denied):
            self.execute()
        self.assertEqual(self.state(), before)
        self.assertEqual(self.state()["sequence"], 0)

    def test_revoked_seller_consent_rejects_active_listing_before_transfer(self):
        with sqlite3.connect(self.path) as db:
            db.execute(
                "UPDATE seller_consents SET state='revoked'"
                " WHERE id='TEST_FIXTURE_ONLY'"
            )
        before = self.state()
        with self.assertRaises(Denied):
            self.execute()
        self.assertEqual(self.state(), before)
        self.assertEqual(self.state()["title"], (20, 1))
        self.assertTrue(self.state()["conserved"])

    def test_price_title_map_and_fee_must_match_admitted_consent(self):
        for field, value in (("price", 501), ("title_revision", 2),
                             ("map_revision", 8), ("fee_bps", 300),
                             ("expires_tick", 101), ("seller_id", 30)):
            with self.subTest(field=field):
                with sqlite3.connect(self.path) as db:
                    db.execute(
                        f"UPDATE seller_consents SET {field}=?"
                        " WHERE id='TEST_FIXTURE_ONLY'", (value,)
                    )
                before = self.state()
                with self.assertRaises(Denied):
                    self.execute()
                self.assertEqual(self.state(), before)
                self.assertTrue(self.state()["conserved"])
                with sqlite3.connect(self.path) as db:
                    db.execute(
                        f"UPDATE seller_consents SET {field}=?"
                        " WHERE id='TEST_FIXTURE_ONLY'",
                        ({"price": 500, "title_revision": 1, "map_revision": 7,
                         "fee_bps": 200, "expires_tick": 100, "seller_id": 20}[field],),
                    )

    def test_missing_consent_reference_is_not_approval(self):
        with sqlite3.connect(self.path) as db:
            db.execute(
                "UPDATE listings SET approved_consent='FAKE_VALUE' WHERE id=50"
            )
        before = self.state()
        with self.assertRaises(Denied):
            self.execute()
        self.assertEqual(self.state(), before)
        self.assertTrue(self.state()["conserved"])

    def test_purchase_consumes_both_listing_and_matching_consent_once(self):
        first = self.execute()
        self.assertEqual(self.state()["consent"], "consumed")
        self.assertEqual(self.state()["listing"], "consumed")
        self.assertEqual(self.execute(), first)
        self.assertEqual(self.state()["receipts"], 1)
        with self.assertRaises(Denied):
            self.execute(op="new-op")
        self.assertEqual(self.state()["sequence"], 1)
        self.assertTrue(self.state()["conserved"])

    def test_hard_kill_after_commit_recovers_consumed_consent_too(self):
        child = self.crash_child(10, "op-A", "hard_exit_after_commit")
        self.assertEqual(child.returncode, 91, child.stderr)
        before = self.state()
        self.assertEqual(before["consent"], "consumed")
        self.assertTrue(before["conserved"])
        self.execute()
        self.assertEqual(self.state(), before)


    def projection_child(self, point):
        code = (
            "from economics_sqlite_lab import project_title_event; "
            f"project_title_event({self.path!r},1,failpoint={point!r})"
        )
        return subprocess.run(
            [sys.executable, "-c", code],
            env={**os.environ, "PYTHONPATH": str(Path(__file__).parent)},
            capture_output=True, text=True, timeout=10, check=False,
        )

    def test_outbox_projection_lags_until_consumed(self):
        self.assertEqual(pending_title_events(self.path), [])
        self.assertEqual(self.state()["read_model"], (20, 1, 0))
        self.execute()
        after_commit = self.state()
        self.assertEqual(after_commit["title"], (10, 2))
        self.assertEqual(after_commit["read_model"], (20, 1, 0))
        self.assertEqual((after_commit["pending_events"], after_commit["consumed_events"]), (1, 0))
        events = pending_title_events(self.path)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["sequence"], 1)
        self.assertEqual(events[0]["event_kind"], "title_transferred")
        self.assertEqual(project_title_event(self.path, 1), "applied")
        read = self.state()
        self.assertEqual(read["read_model"], (10, 2, 1))
        self.assertEqual((read["pending_events"], read["consumed_events"]), (0, 1))
        self.assertEqual(pending_title_events(self.path), [])
        self.assertTrue(read["conserved"])

    def test_duplicate_outbox_delivery_is_idempotent(self):
        self.execute()
        self.assertEqual(project_title_event(self.path, 1), "applied")
        after = self.state()
        self.assertEqual(project_title_event(self.path, 1), "already_applied")
        self.assertEqual(self.state(), after)
        self.assertEqual(self.state()["consumed_events"], 1)

    def test_consumer_failures_before_commit_roll_back_projection_and_ack(self):
        self.execute()
        original = self.state()
        for point in ("after_projection", "before_commit"):
            with self.subTest(point=point):
                with self.assertRaises(InjectedFailure):
                    project_title_event(self.path, 1, failpoint=point)
                self.assertEqual(self.state(), original)
        self.assertEqual(project_title_event(self.path, 1), "applied")
        self.assertTrue(self.state()["conserved"])

    def test_consumer_hard_kills_before_commit_do_not_ack(self):
        self.execute()
        original = self.state()
        for point in ("hard_exit_after_projection", "hard_exit_before_commit"):
            with self.subTest(point=point):
                child = self.projection_child(point)
                self.assertEqual(child.returncode, 91, child.stderr)
                self.assertEqual(self.state(), original)
        self.assertEqual(self.state()["pending_events"], 1)

    def test_consumer_hard_kill_after_commit_resumes_without_double_projection(self):
        self.execute()
        child = self.projection_child("hard_exit_after_commit")
        self.assertEqual(child.returncode, 91, child.stderr)
        stable = self.state()
        self.assertEqual(stable["read_model"], (10, 2, 1))
        self.assertEqual(stable["consumed_events"], 1)
        self.assertEqual(project_title_event(self.path, 1), "already_applied")
        self.assertEqual(self.state(), stable)
        self.assertTrue(stable["conserved"])

    def test_consumer_lost_acknowledgment_returns_durable_idempotency(self):
        self.execute()
        with self.assertRaises(InjectedFailure):
            project_title_event(self.path, 1, failpoint="after_commit")
        stable = self.state()
        self.assertEqual(stable["read_model"], (10, 2, 1))
        self.assertEqual(project_title_event(self.path, 1), "already_applied")
        self.assertEqual(self.state(), stable)

    def test_two_real_processes_project_once(self):
        self.execute()
        command = (
            "from economics_sqlite_lab import project_title_event; "
            f"project_title_event({self.path!r},1)"
        )
        env = {**os.environ, "PYTHONPATH": str(Path(__file__).parent)}
        processes = [
            subprocess.Popen([sys.executable, "-c", command], env=env,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            for _ in range(2)
        ]
        results = [p.communicate(timeout=10) for p in processes]
        self.assertTrue(all(p.returncode == 0 for p in processes), results)
        snapshot_after = self.state()
        self.assertEqual(snapshot_after["read_model"], (10, 2, 1))
        self.assertEqual(snapshot_after["consumed_events"], 1)
        self.assertEqual(snapshot_after["pending_events"], 0)
        self.assertTrue(snapshot_after["conserved"])

    def test_tampered_outbox_is_not_applied_or_accepted_on_retry(self):
        self.execute()
        with sqlite3.connect(self.path) as db:
            db.execute(
                "UPDATE outbox SET event_payload='{}' WHERE sequence=1"
            )
        original = self.state()
        with self.assertRaises(Denied):
            project_title_event(self.path, 1)
        self.assertEqual(self.state(), original)
        self.assertEqual(self.state()["read_model"], (20, 1, 0))

    def test_forged_sequence_or_bad_poll_budget_is_denied(self):
        self.execute()
        for seq in (0, -1, 2):
            with self.subTest(seq=seq):
                with self.assertRaises(Denied):
                    project_title_event(self.path, seq)
        for lim in (0, 1001, True):
            with self.subTest(limit=lim):
                with self.assertRaises(ValueError):
                    pending_title_events(self.path, limit=lim)
        self.assertEqual(len(pending_title_events(self.path, limit=1)), 1)
        self.assertEqual(self.state()["read_model"], (20, 1, 0))

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
