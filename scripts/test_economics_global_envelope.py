"""E2f global event envelope: modeled purchase, projection and policy commit order.

The event envelope is research-only and does not turn fictional player IDs
or seller approvals into real authenticated monetary authorities.
"""
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

from economics_sqlite_lab import (
    Denied, InjectedFailure, VerifiedSession, PurchaseIntent,
    bootstrap_fixture, purchase, project_title_event, snapshot,
)
from economics_admission_mutation import (
    issue_fixture_session, revoke_fixture_session, change_fixture_title_cap,
)
from economics_recovery_audit import (
    audit_fixture_database, CorruptState, backup_fixture_database,
)
from economics_checkpoint_auth import (
    issue_fixture_checkpoint, InvalidCheckpoint,
)
from economics_recovery_witness import (
    WitnessConflict, initialize_fixture_witness,
    observe_fixture_checkpoint, verify_restore_with_witness,
    read_fixture_global_revision,
)

KEY=b"myaso-e2f-offline-test-checkpoint-key-0000000000000000001"
KID="fixture-key"
REALM="fictional-global-journal"


class GlobalEnvelopeTests(unittest.TestCase):
    def setUp(self):
        d=tempfile.TemporaryDirectory(prefix="myaso-e2f-global-")
        self.addCleanup(d.cleanup)
        self.root=Path(d.name)
        self.db=self.root/"game-fiction.sqlite3"
        self.witness=self.root/"witness-fiction.sqlite3"
        bootstrap_fixture(self.db)
        initialize_fixture_witness(
            self.witness, self.db, self.seal(), realm=REALM,
            trusted_keys={KID:KEY},
        )

    def seal(self, path=None):
        return issue_fixture_checkpoint(
            path or self.db, realm=REALM, key_id=KID, secret=KEY
        )

    def observe(self, path=None, checkpoint=None):
        return observe_fixture_checkpoint(
            self.witness, path or self.db, checkpoint or self.seal(),
            realm=REALM, trusted_keys={KID:KEY},
        )

    def restore(self, checkpoint, path=None):
        return verify_restore_with_witness(
            self.witness, path or self.db, checkpoint,
            realm=REALM, trusted_keys={KID:KEY},
        )

    def sale(self, failpoint=None):
        return purchase(
            self.db, VerifiedSession(10,8),
            PurchaseIntent("purchase-1",10,50,1,1),20,
            failpoint=failpoint,
        )

    def event_rows(self):
        with sqlite3.connect(self.db) as db:
            return db.execute(
                "SELECT revision,event_kind,local_revision FROM global_events "
                "ORDER BY revision"
            ).fetchall()

    def test_fresh_fixture_has_empty_global_commit_stream(self):
        report=audit_fixture_database(self.db)
        self.assertEqual(report.global_revision,0)
        self.assertEqual(self.event_rows(),[])
        self.assertEqual(self.observe(),"unchanged")
        self.assertEqual(read_fixture_global_revision(self.witness),0)

    def test_sale_and_projection_are_two_atomic_ordered_events(self):
        self.sale()
        self.assertEqual(self.event_rows(),[(1,"purchase",1)])
        self.assertEqual(audit_fixture_database(self.db).global_revision,1)
        project_title_event(self.db,1)
        self.assertEqual(
            self.event_rows(),
            [(1,"purchase",1),(2,"projection",1)],
        )
        report=audit_fixture_database(self.db)
        self.assertEqual((report.global_revision,report.sequence,report.inbox_events),
                         (2,1,1))
        self.assertEqual(self.observe(),"advanced")
        self.assertEqual(read_fixture_global_revision(self.witness),2)
        self.assertEqual(self.restore(self.seal()).global_revision,2)

    def test_interleaved_mutations_and_purchase_use_one_global_sequence(self):
        issue_fixture_session(
            self.db,operation_id="issue9",player_id=10,session_epoch=9
        )
        self.sale()
        change_fixture_title_cap(self.db,operation_id="cap3",new_cap=3)
        project_title_event(self.db,1)
        revoke_fixture_session(
            self.db,operation_id="revoke9",player_id=10,session_epoch=9
        )
        self.assertEqual(
            self.event_rows(),
            [(1,"mutation",1),(2,"purchase",1),(3,"mutation",2),
             (4,"projection",1),(5,"mutation",3)],
        )
        report=audit_fixture_database(self.db)
        self.assertEqual((report.global_revision,report.sequence,report.mutation_revision),
                         (5,1,3))
        self.observe()
        self.assertEqual(self.restore(self.seal()).global_revision,5)

    def test_retried_operations_do_not_create_duplicate_global_event(self):
        a=self.sale()
        self.assertEqual(self.sale(),a)
        self.assertEqual(project_title_event(self.db,1),"applied")
        self.assertEqual(project_title_event(self.db,1),"already_applied")
        self.assertEqual(change_fixture_title_cap(
            self.db,operation_id="cap3",new_cap=3
        ),1)
        self.assertEqual(change_fixture_title_cap(
            self.db,operation_id="cap3",new_cap=3
        ),1)
        self.assertEqual(len(self.event_rows()),3)
        self.assertEqual(audit_fixture_database(self.db).global_revision,3)

    def test_rejected_purchase_and_mutation_leave_no_global_entries(self):
        with self.assertRaises(Denied):
            purchase(
                self.db,VerifiedSession(30,8),
                PurchaseIntent("bad",30,50,2,1),20,
            )
        with self.assertRaises(Denied):
            issue_fixture_session(
                self.db,operation_id="old",player_id=10,session_epoch=8
            )
        self.assertEqual(self.event_rows(),[])
        self.assertEqual(audit_fixture_database(self.db).global_revision,0)

    def test_failed_commit_or_hard_kill_roll_back_global_envelope(self):
        with self.assertRaises(InjectedFailure):
            self.sale(failpoint="before_commit")
        self.assertEqual(self.event_rows(),[])
        script=(
            "from economics_sqlite_lab import *; "
            f"purchase({str(self.db)!r},VerifiedSession(10,8),"
            "PurchaseIntent('purchase-1',10,50,1,1),20,"
            "failpoint='hard_exit_before_commit')"
        )
        child=subprocess.run(
            [sys.executable,"-c",script],check=False,
            env={**os.environ,"PYTHONPATH":str(Path(__file__).parent)},
            capture_output=True,text=True,timeout=10,
        )
        self.assertEqual(child.returncode,91,child.stderr)
        self.assertEqual(self.event_rows(),[])
        self.assertEqual(self.sale()["sequence"],1)
        self.assertEqual(self.event_rows(),[(1,"purchase",1)])

    def test_audit_rejects_deleted_envelope_even_when_money_is_conserved(self):
        self.sale()
        with sqlite3.connect(self.db) as db:
            db.execute("DELETE FROM global_events WHERE revision=1")
        self.assertTrue(snapshot(self.db)["conserved"])
        with self.assertRaises(CorruptState):
            audit_fixture_database(self.db)

    def test_audit_rejects_missing_gap_even_with_updated_global_counter(self):
        self.sale()
        project_title_event(self.db,1)
        with sqlite3.connect(self.db) as db:
            db.execute("DELETE FROM global_events WHERE revision=1")
            db.execute("UPDATE global_events SET revision=3 WHERE revision=2")
            db.execute("UPDATE metadata SET global_revision=2")
        with self.assertRaises(CorruptState):
            audit_fixture_database(self.db)

    def test_audit_rejects_forged_event_source_identity(self):
        self.sale()
        with sqlite3.connect(self.db) as db:
            db.execute("UPDATE global_events SET event_kind='mutation' WHERE revision=1")
        with self.assertRaises(CorruptState):
            audit_fixture_database(self.db)

    def test_audit_rejects_projection_ordered_before_purchase(self):
        self.sale()
        project_title_event(self.db,1)
        with sqlite3.connect(self.db) as db:
            db.execute(
                "UPDATE global_events SET event_kind='mutation' WHERE revision=1"
            )
            db.execute(
                "UPDATE global_events SET event_kind='purchase' WHERE revision=2"
            )
            db.execute(
                "UPDATE global_events SET event_kind='projection' WHERE revision=1"
            )
        # Both source events are still present exactly once, but their
        # asserted commit order is backwards, which the auditor must reject.
        with self.assertRaises(CorruptState):
            audit_fixture_database(self.db)

    def test_old_backup_rejected_after_witnessed_global_commit(self):
        old=self.root/"old-fixture.sqlite3"
        backup_fixture_database(self.db,old)
        old_sig=self.seal(old)
        self.sale()
        self.observe()
        with self.assertRaises((InvalidCheckpoint,WitnessConflict)):
            self.restore(old_sig,old)
        self.assertEqual(read_fixture_global_revision(self.witness),1)
        self.assertEqual(self.restore(self.seal()).global_revision,1)

    def test_witness_global_counter_never_decreases(self):
        self.sale()
        self.observe()
        with sqlite3.connect(self.db) as db:
            db.execute("DELETE FROM global_events WHERE revision=1")
            db.execute("UPDATE metadata SET global_revision=0")
        with self.assertRaises(CorruptState):
            audit_fixture_database(self.db)
        self.assertEqual(read_fixture_global_revision(self.witness),1)

    def test_process_restart_reuses_one_purchase_event(self):
        script=(
            "from economics_sqlite_lab import *; "
            f"purchase({str(self.db)!r},VerifiedSession(10,8),"
            "PurchaseIntent('purchase-1',10,50,1,1),20,"
            "failpoint='hard_exit_after_commit')"
        )
        child=subprocess.run(
            [sys.executable,"-c",script],check=False,
            env={**os.environ,"PYTHONPATH":str(Path(__file__).parent)},
            capture_output=True,text=True,timeout=10,
        )
        self.assertEqual(child.returncode,91,child.stderr)
        self.assertEqual(self.sale()["sequence"],1)
        self.assertEqual(self.event_rows(),[(1,"purchase",1)])
        self.assertEqual(audit_fixture_database(self.db).global_revision,1)


if __name__=="__main__":
    unittest.main()
