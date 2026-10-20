"""E2d fixture-only independent durable checkpoint-tip tests."""

from dataclasses import replace
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

from economics_sqlite_lab import (
    PurchaseIntent, VerifiedSession, bootstrap_fixture,
    project_title_event, purchase,
)
from economics_recovery_audit import backup_fixture_database
from economics_checkpoint_auth import (
    InvalidCheckpoint, issue_fixture_checkpoint,
)
from economics_recovery_witness import (
    WitnessConflict, initialize_fixture_witness,
    observe_fixture_checkpoint, read_fixture_witness_tip,
    verify_restore_with_witness,
)

KEY = b"myaso fictional witness checkpoint test signing key 00001"
REALM = "offline-realm-test"
KEY_ID = "development-test-key"


class WitnessTests(unittest.TestCase):
    def setUp(self):
        d = tempfile.TemporaryDirectory(prefix="myaso-e2d-witness-")
        self.addCleanup(d.cleanup)
        self.root = Path(d.name)
        self.live = self.root / "fictional-game-db.sqlite3"
        self.witness = self.root / "independent-fake-witness.sqlite3"
        bootstrap_fixture(self.live)
        self.initial = self.seal()
        initialize_fixture_witness(
            self.witness, self.live, self.initial,
            realm=REALM, trusted_keys={KEY_ID: KEY},
        )

    def seal(self):
        return issue_fixture_checkpoint(
            self.live, realm=REALM, key_id=KEY_ID, secret=KEY,
        )

    def observe(self, cp=None, path=None, failpoint=None):
        return observe_fixture_checkpoint(
            self.witness, path or self.live, cp or self.seal(),
            realm=REALM, trusted_keys={KEY_ID: KEY}, failpoint=failpoint,
        )

    def verify(self, cp, path=None):
        return verify_restore_with_witness(
            self.witness, path or self.live, cp,
            realm=REALM, trusted_keys={KEY_ID: KEY},
        )

    def buy(self):
        return purchase(
            self.live, VerifiedSession(10, 8),
            PurchaseIntent("op-A", 10, 50, 1, 1), 20,
        )

    def child(self, cp, point):
        # Only test keys from this file are included in the subprocess.
        code = (
            "from economics_recovery_witness import observe_fixture_checkpoint; "
            "from economics_checkpoint_auth import AuthenticatedCheckpoint; "
            f"observe_fixture_checkpoint({str(self.witness)!r},"
            f"{str(self.live)!r}, AuthenticatedCheckpoint(**{vars(cp)!r}),"
            f"realm={REALM!r},trusted_keys={{{KEY_ID!r}:{KEY!r}}},"
            f"failpoint={point!r})"
        )
        return subprocess.run(
            [sys.executable, "-c", code], capture_output=True, text=True,
            env={**os.environ, "PYTHONPATH": str(Path(__file__).parent)},
            timeout=10, check=False,
        )

    def test_genesis_witness_provisions_and_verifies(self):
        realm, seq, inbox, digest = read_fixture_witness_tip(self.witness)
        self.assertEqual((realm, seq, inbox), (REALM, 0, 0))
        self.assertEqual(digest, self.initial.logical_sha256)
        self.assertEqual(self.verify(self.initial).sequence, 0)

    def test_valid_sale_advances_witness_then_restarts_cleanly(self):
        self.buy()
        checkpoint = self.seal()
        self.assertEqual(self.observe(checkpoint), "advanced")
        self.assertEqual(self.verify(checkpoint).sequence, 1)
        self.assertEqual(read_fixture_witness_tip(self.witness)[1:3], (1, 0))
        self.assertEqual(self.observe(checkpoint), "unchanged")

    def test_old_valid_checkpoint_and_old_complete_backup_fail_after_advance(self):
        old = self.root / "old.sqlite3"
        backup_fixture_database(self.live, old)
        old_cp = self.initial
        self.buy()
        self.assertEqual(self.observe(), "advanced")
        with self.assertRaises((InvalidCheckpoint, WitnessConflict)):
            self.verify(old_cp, path=old)
        with self.assertRaises((InvalidCheckpoint, WitnessConflict)):
            self.observe(old_cp, path=old)
        self.assertEqual(self.verify(self.seal()).sequence, 1)

    def test_new_commit_must_be_observed_before_restore_authorized(self):
        self.buy()
        signed_but_unregistered = self.seal()
        with self.assertRaises(WitnessConflict):
            self.verify(signed_but_unregistered)
        self.assertEqual(self.observe(signed_but_unregistered), "advanced")
        self.assertEqual(self.verify(signed_but_unregistered).sequence, 1)

    def test_committed_backup_remains_acceptable_if_exactly_registered(self):
        self.buy()
        current = self.seal()
        self.observe(current)
        safe = self.root / "backup.sqlite3"
        backup_fixture_database(self.live, safe)
        self.assertEqual(self.verify(current, safe).sequence, 1)

    def test_projection_progress_is_separate_monotonic_dimension(self):
        self.buy()
        pre_projection = self.seal()
        self.observe(pre_projection)
        project_title_event(self.live, 1)
        post_projection = self.seal()
        self.assertEqual(post_projection.sequence, pre_projection.sequence)
        self.assertNotEqual(
            post_projection.logical_sha256, pre_projection.logical_sha256
        )
        self.assertEqual(self.observe(post_projection), "advanced")
        self.assertEqual(read_fixture_witness_tip(self.witness)[1:3], (1, 1))
        self.assertEqual(self.verify(post_projection).inbox_events, 1)
        with self.assertRaises((InvalidCheckpoint, WitnessConflict)):
            self.verify(pre_projection)
        with self.assertRaises((InvalidCheckpoint, WitnessConflict)):
            self.observe(pre_projection)

    def test_rollback_of_outbox_projection_is_rejected_even_when_db_audits_clean(self):
        self.buy()
        self.observe()
        project_title_event(self.live, 1)
        self.observe()
        with sqlite3.connect(self.live) as conn:
            conn.execute("DELETE FROM projection_inbox WHERE sequence=1")
            conn.execute(
                "UPDATE title_projection SET owner_id=20, revision=1,"
                " last_sequence=0 WHERE parcel_id=42"
            )
        # A stale UI read model is internally permitted but cannot overwrite
        # the separately witnessed projection progress.
        old_projection = self.seal()
        with self.assertRaises(WitnessConflict):
            self.observe(old_projection)
        self.assertEqual(read_fixture_witness_tip(self.witness)[1:3], (1, 1))

    def test_same_progress_different_data_is_not_silently_rewitnessed(self):
        self.buy()
        checkpoint = self.seal()
        self.observe(checkpoint)
        with sqlite3.connect(self.live) as conn:
            conn.execute(
                "UPDATE admitted_sessions SET state='revoked' WHERE player_id=10"
            )
        newer = self.seal()  # Signed by fixture issuer, but no event clock tick.
        with self.assertRaises(WitnessConflict):
            self.observe(newer)
        with self.assertRaises(WitnessConflict):
            self.verify(newer)
        self.assertEqual(read_fixture_witness_tip(self.witness)[3], checkpoint.logical_sha256)

    def test_reset_existing_witness_rejected_and_original_tip_kept(self):
        self.buy()
        self.observe()
        old = read_fixture_witness_tip(self.witness)
        with self.assertRaises(FileExistsError):
            initialize_fixture_witness(
                self.witness, self.live, self.seal(),
                realm=REALM, trusted_keys={KEY_ID: KEY},
            )
        self.assertEqual(read_fixture_witness_tip(self.witness), old)

    def test_missing_witness_is_not_automatically_recreated(self):
        absent = self.root / "not-initialized.sqlite3"
        with self.assertRaises(WitnessConflict):
            verify_restore_with_witness(
                absent, self.live, self.initial,
                realm=REALM, trusted_keys={KEY_ID: KEY},
            )
        self.assertFalse(absent.exists())

    def test_cannot_bootstrap_new_witness_from_already_committed_db(self):
        self.buy()
        extra_witness = self.root / "new-witness.sqlite3"
        with self.assertRaises(WitnessConflict):
            initialize_fixture_witness(
                extra_witness, self.live, self.seal(),
                realm=REALM, trusted_keys={KEY_ID: KEY},
            )
        self.assertFalse(extra_witness.exists())

    def test_wrong_realm_or_key_never_advances_tip(self):
        original = read_fixture_witness_tip(self.witness)
        self.buy()
        cp = self.seal()
        with self.assertRaises((InvalidCheckpoint, WitnessConflict)):
            observe_fixture_checkpoint(
                self.witness, self.live, cp, realm="wrong-realm",
                trusted_keys={KEY_ID: KEY},
            )
        with self.assertRaises(InvalidCheckpoint):
            observe_fixture_checkpoint(
                self.witness, self.live, cp, realm=REALM,
                trusted_keys={KEY_ID: b"different-secret-00000000000000000000"},
            )
        with self.assertRaises(InvalidCheckpoint):
            self.observe(replace(cp, hmac_sha256="0" * 64))
        self.assertEqual(read_fixture_witness_tip(self.witness), original)

    def test_process_kill_before_witness_commit_preserves_old_tip(self):
        self.buy()
        cp = self.seal()
        old = read_fixture_witness_tip(self.witness)
        child = self.child(cp, "hard_exit_before_commit")
        self.assertEqual(child.returncode, 91, child.stderr)
        self.assertEqual(read_fixture_witness_tip(self.witness), old)
        self.assertEqual(self.observe(cp), "advanced")

    def test_process_kill_after_witness_commit_retains_advanced_tip(self):
        self.buy()
        cp = self.seal()
        child = self.child(cp, "hard_exit_after_commit")
        self.assertEqual(child.returncode, 91, child.stderr)
        self.assertEqual(read_fixture_witness_tip(self.witness)[1], 1)
        self.assertEqual(self.observe(cp), "unchanged")
        self.assertEqual(self.verify(cp).sequence, 1)

    def test_recover_after_lost_witness_acknowledgment(self):
        self.buy()
        cp = self.seal()
        with self.assertRaises(WitnessConflict):
            self.observe(cp, failpoint="after_commit")
        self.assertEqual(self.observe(cp), "unchanged")
        self.assertEqual(self.verify(cp).sequence, 1)

    def test_two_concurrent_witness_observers_converge(self):
        self.buy()
        cp = self.seal()
        script = (
            "from economics_recovery_witness import observe_fixture_checkpoint; "
            "from economics_checkpoint_auth import AuthenticatedCheckpoint; "
            f"observe_fixture_checkpoint({str(self.witness)!r},{str(self.live)!r},"
            f"AuthenticatedCheckpoint(**{vars(cp)!r}),"
            f"realm={REALM!r},trusted_keys={{{KEY_ID!r}:{KEY!r}}})"
        )
        env = {**os.environ, "PYTHONPATH": str(Path(__file__).parent)}
        jobs = [
            subprocess.Popen(
                [sys.executable, "-c", script], env=env,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            )
            for _ in range(2)
        ]
        results = [p.communicate(timeout=10) for p in jobs]
        self.assertTrue(all(p.returncode == 0 for p in jobs), results)
        self.assertEqual(read_fixture_witness_tip(self.witness)[1:3], (1, 0))
        self.assertEqual(self.verify(cp).sequence, 1)

    def test_witness_data_tampering_cannot_validate_signed_restore(self):
        self.buy()
        cp = self.seal()
        self.observe(cp)
        with sqlite3.connect(self.witness) as conn:
            conn.execute(
                "UPDATE witness_head SET logical_sha256=? WHERE singleton=1",
                ("f" * 64,),
            )
        with self.assertRaises(WitnessConflict):
            self.verify(cp)

    def test_witness_attacker_can_replay_entire_old_file_without_offhost_tip(self):
        # This is a documented residual risk, not a security property: storing
        # witness and economy on the same failure domain cannot stop an actor
        # who restores BOTH from an older complete backup.
        old_copy = self.root / "old-witness.sqlite3"
        backup_fixture_database(self.witness, old_copy)
        self.buy()
        self.observe()
        old_economy = self.root / "old-economy.sqlite3"
        bootstrap_fixture(old_economy)
        self.assertEqual(
            verify_restore_with_witness(
                old_copy, old_economy, self.initial,
                realm=REALM, trusted_keys={KEY_ID: KEY},
            ).sequence, 0
        )


if __name__ == "__main__":
    unittest.main()
