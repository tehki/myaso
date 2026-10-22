"""B3 disposable SQLite bank transaction + recovery acceptance, not game auth."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import os
import sqlite3
import subprocess
import sys
import unittest

from economics_bank_b3_sqlite_lab import (
    FixtureBankDenied, FixtureRaidOutcome, FixtureSqliteTownBanks,
    UnknownCommitOutcome, TEST_ENV,
)


def raid(event="a"*32, amount=70, town="greyhaven", actor="thief_a",
         *, vault_open=True, guards_overcome=True, epoch=5):
    return FixtureRaidOutcome(
        event_id=event, town=town, actor=actor,
        vault_id=f"{town}-vault", amount=amount,
        vault_open=vault_open, guards_overcome=guards_overcome,
        authority_epoch=epoch,
    )


class B3SqliteAtomicBankTests(unittest.TestCase):
    def setUp(self):
        temp = TemporaryDirectory(prefix="myaso-b3-disposable-")
        self.addCleanup(temp.cleanup)
        self.path = Path(temp.name) / "only.b3test.sqlite3"
        env = patch.dict(os.environ, {TEST_ENV: "1"})
        env.start()
        self.addCleanup(env.stop)
        self.lab = FixtureSqliteTownBanks(self.path, carry_limit=700)
        self.lab.initialize_fixture(
            {"greyhaven": 100, "redlion": 30},
            {"alice": 400, "bob": 100, "thief_a": 0, "thief_b": 0},
            {"alice": "greyhaven", "bob": "greyhaven",
             "thief_a": "greyhaven", "thief_b": "greyhaven"},
        )

    def state(self):
        return self.lab.audit()

    def invoke_process(self, kind, op, event=None, amount=70):
        script = (
            "import sys\n"
            "from pathlib import Path\n"
            "from economics_bank_b3_sqlite_lab import FixtureSqliteTownBanks, "
            "FixtureRaidOutcome, FixtureBankDenied\n"
            "lab=FixtureSqliteTownBanks(Path(sys.argv[1]),carry_limit=700)\n"
            "actor=sys.argv[2]; kind=sys.argv[3]; op=sys.argv[4]; "
            "amount=int(sys.argv[5]); event=sys.argv[6]\n"
            "try:\n"
            " if kind=='robbery':\n"
            "  proof=FixtureRaidOutcome(event,'greyhaven',actor,"
            "'greyhaven-vault',amount,True,True,5)\n"
            "  result=lab.robbery_fixture('greyhaven',actor,op,proof)\n"
            " else:\n"
            "  result=lab.withdraw('greyhaven',actor,op,amount)\n"
            " print('PAID',result.gold)\n"
            "except FixtureBankDenied:\n"
            " print('DENIED')\n"
        )
        env = os.environ.copy()
        env[TEST_ENV] = "1"
        env["PYTHONPATH"] = str(Path(__file__).resolve().parent)
        return subprocess.Popen(
            [sys.executable, "-c", script, str(self.path),
             kind == "withdraw" and "alice" or op.split("-")[0],
             kind, op, str(amount), event or "a"*32],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            env=env,
        )

    def test_init_has_bounded_physical_gold(self):
        s = self.state()
        self.assertEqual(s["supply"], 630)
        self.assertEqual(s["banks"]["greyhaven"]["reserve"], 100)
        self.assertEqual(s["banks"]["redlion"]["reserve"], 30)
        self.assertEqual(s["banks"]["greyhaven"]["sequence"], 0)

    def test_deposit_atomic_local_bank(self):
        receipt = self.lab.deposit("greyhaven", "alice", "d1", 250)
        self.assertEqual(receipt.vault_reserve_after, 350)
        self.assertEqual(receipt.deposit_liabilities_after, 250)
        self.assertEqual(self.state()["players"]["alice"], 150)
        self.assertEqual(self.state()["banks"]["redlion"]["reserve"], 30)
        self.assertEqual(self.lab.balance_fixture("alice", "greyhaven"), 250)

    def test_withdrawal_preserves_physical_gold(self):
        self.lab.deposit("greyhaven", "alice", "d1", 250)
        self.lab.withdraw("greyhaven", "alice", "w1", 120)
        state = self.state()
        self.assertEqual(state["banks"]["greyhaven"]["reserve"], 230)
        self.assertEqual(state["players"]["alice"], 270)
        self.assertEqual(self.lab.balance_fixture("alice", "greyhaven"), 130)
        self.assertEqual(state["supply"], 630)

    def test_remote_bank_cannot_withdraw_local_claim(self):
        self.lab.deposit("greyhaven", "alice", "d1", 250)
        self.lab.travel_fixture("alice", "redlion")
        with self.assertRaises(FixtureBankDenied):
            self.lab.withdraw("greyhaven", "alice", "w1", 10)
        with self.assertRaises(FixtureBankDenied):
            self.lab.withdraw("redlion", "alice", "w2", 10)
        self.assertEqual(self.lab.balance_fixture("alice", "greyhaven"), 250)

    def test_same_op_replay_returns_same_receipt_after_reopen(self):
        first = self.lab.deposit("greyhaven", "alice", "deposit", 200)
        other = FixtureSqliteTownBanks(self.path, carry_limit=700)
        again = other.deposit("greyhaven", "alice", "deposit", 200)
        self.assertEqual(first, again)
        self.assertEqual(other.audit()["banks"]["greyhaven"]["sequence"], 1)

    def test_conflicting_replay_rejected_without_side_effects(self):
        first = self.lab.deposit("greyhaven", "alice", "deposit", 150)
        with self.assertRaises(FixtureBankDenied):
            self.lab.deposit("greyhaven", "alice", "deposit", 151)
        self.assertEqual(self.lab.audit()["banks"]["greyhaven"]["sequence"], 1)
        self.assertEqual(first.deposit_liabilities_after, 150)

    def test_operation_ids_are_town_local(self):
        self.lab.deposit("greyhaven", "alice", "op", 100)
        self.lab.travel_fixture("alice", "redlion")
        self.lab.deposit("redlion", "alice", "op", 100)
        s=self.state()
        self.assertEqual(s["banks"]["greyhaven"]["sequence"],1)
        self.assertEqual(s["banks"]["redlion"]["sequence"],1)

    def test_robbery_moves_real_fixture_reserve_without_erasing_claim(self):
        self.lab.deposit("greyhaven", "alice", "d1", 300)
        outcome = self.lab.robbery_fixture(
            "greyhaven", "thief_a", "raid", raid(amount=150)
        )
        self.assertEqual(outcome.vault_reserve_after, 250)
        self.assertEqual(outcome.deposit_liabilities_after, 300)
        self.assertTrue(outcome.insolvent)
        self.assertEqual(self.lab.balance_fixture("alice", "greyhaven"), 300)
        self.assertEqual(self.state()["players"]["thief_a"], 150)
        with self.assertRaises(FixtureBankDenied):
            self.lab.withdraw("greyhaven", "alice", "w1", 1)

    def test_stolen_event_unique_even_for_new_operation(self):
        proof = raid(amount=40)
        self.lab.robbery_fixture("greyhaven", "thief_a", "op1", proof)
        with self.assertRaises(FixtureBankDenied):
            self.lab.robbery_fixture("greyhaven", "thief_a", "op2", proof)
        self.assertEqual(self.state()["banks"]["greyhaven"]["reserve"], 60)

    def test_stolen_event_globally_unique_across_towns(self):
        self.lab.robbery_fixture("greyhaven", "thief_a", "op1", raid(amount=20))
        self.lab.travel_fixture("thief_a", "redlion")
        with self.assertRaises(FixtureBankDenied):
            self.lab.robbery_fixture("redlion", "thief_a", "op2",
                                     raid(town="redlion", amount=10))
        self.assertEqual(self.state()["banks"]["redlion"]["reserve"], 30)

    def test_forced_crash_after_balance_changes_rolls_back(self):
        before = self.state()
        with self.assertRaisesRegex(RuntimeError, "crash"):
            self.lab.deposit("greyhaven", "alice", "d", 50, fault="after_balances")
        self.assertEqual(self.state(), before)
        self.assertEqual(self.lab.balance_fixture("alice", "greyhaven"), 0)
        self.assertEqual(self.lab.deposit("greyhaven", "alice", "d", 50).gold, 50)

    def test_forced_crash_after_event_but_before_receipt_rolls_back(self):
        before = self.state()
        with self.assertRaisesRegex(RuntimeError, "crash"):
            self.lab.robbery_fixture("greyhaven", "thief_a", "raid",
                                     raid(amount=70), fault="after_event")
        self.assertEqual(self.state(), before)
        self.assertEqual(
            self.lab.robbery_fixture("greyhaven", "thief_a", "raid", raid(amount=70)).gold, 70
        )

    def test_unknown_ack_after_durable_commit_is_idempotent(self):
        with self.assertRaises(UnknownCommitOutcome):
            self.lab.deposit("greyhaven", "alice", "d", 100,
                             fault="after_commit_unknown")
        reopened = FixtureSqliteTownBanks(self.path, carry_limit=700)
        receipt = reopened.deposit("greyhaven", "alice", "d", 100)
        self.assertEqual(receipt.sequence, 1)
        self.assertEqual(reopened.audit()["banks"]["greyhaven"]["reserve"], 200)
        self.assertEqual(reopened.audit()["banks"]["greyhaven"]["sequence"], 1)

    def test_unknown_ack_robbery_does_not_double_steal(self):
        proof = raid(amount=70)
        with self.assertRaises(UnknownCommitOutcome):
            self.lab.robbery_fixture("greyhaven", "thief_a", "raid", proof,
                                     fault="after_commit_unknown")
        reopened = FixtureSqliteTownBanks(self.path, carry_limit=700)
        first = reopened.robbery_fixture("greyhaven", "thief_a", "raid", proof)
        self.assertEqual(first.vault_reserve_after, 30)
        with self.assertRaises(FixtureBankDenied):
            reopened.robbery_fixture("greyhaven", "thief_a", "raid2", proof)

    def test_double_initialization_never_resets_assets(self):
        before = self.state()
        with self.assertRaises(FixtureBankDenied):
            self.lab.initialize_fixture(
                {"greyhaven": 10}, {"alice": 1}, {"alice": "greyhaven"})
        self.assertEqual(self.state(), before)

    def test_audit_detects_direct_tampered_balance(self):
        with sqlite3.connect(self.path) as con:
            con.execute("UPDATE banks SET reserve=reserve+5 WHERE town='greyhaven'")
        with self.assertRaises(FixtureBankDenied):
            self.lab.audit()

    def test_audit_detects_deleted_receipt_after_commit(self):
        self.lab.deposit("greyhaven", "alice", "d", 40)
        with sqlite3.connect(self.path) as con:
            con.execute("DELETE FROM receipts WHERE op='d'")
        with self.assertRaises(FixtureBankDenied):
            self.lab.audit()

    def test_rejected_raid_does_not_consume_event(self):
        fake=raid(amount=15,vault_open=False)
        with self.assertRaises(FixtureBankDenied):
            self.lab.robbery_fixture("greyhaven","thief_a","raid",fake)
        ok=raid(amount=15)
        self.assertEqual(self.lab.robbery_fixture("greyhaven","thief_a","raid",ok).gold,15)

    def test_concurrent_thread_claimants_redeem_at_most_once(self):
        self.lab.deposit("greyhaven","alice","d",240)
        def execute(key):
            try:
                return self.lab.withdraw("greyhaven","alice",key,180)
            except FixtureBankDenied:
                return None
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(execute,("w1","w2")))
        self.assertEqual(sum(x is not None for x in results),1)
        self.assertEqual(self.lab.balance_fixture("alice","greyhaven"),60)
        self.assertEqual(self.state()["banks"]["greyhaven"]["sequence"],2)

    def test_real_independent_python_processes_race_same_vault(self):
        procs=[
            self.invoke_process("robbery","thief_a-a","a"*32,70),
            self.invoke_process("robbery","thief_b-b","b"*32,70)
        ]
        results=[]
        for proc in procs:
            out,err=proc.communicate(timeout=20)
            self.assertEqual(proc.returncode,0,err)
            results.append(out.strip())
        self.assertEqual(sum(s.startswith("PAID") for s in results),1,results)
        state=self.state()
        self.assertEqual(state["banks"]["greyhaven"]["reserve"],30)
        self.assertEqual(state["banks"]["greyhaven"]["sequence"],1)
        self.assertEqual(state["players"]["thief_a"]+state["players"]["thief_b"],70)

    def test_real_independent_processes_cannot_replay_same_world_event(self):
        procs=[
            self.invoke_process("robbery","thief_a-one","a"*32,40),
            self.invoke_process("robbery","thief_a-two","a"*32,40)
        ]
        result=[]
        for proc in procs:
            out,err=proc.communicate(timeout=20)
            self.assertEqual(proc.returncode,0,err)
            result.append(out.strip())
        self.assertEqual(sum(z.startswith("PAID") for z in result),1,result)
        self.assertEqual(self.state()["banks"]["greyhaven"]["reserve"],60)
        self.assertEqual(self.state()["banks"]["greyhaven"]["sequence"],1)

    def test_no_test_env_cannot_open_existing_database(self):
        with patch.dict(os.environ, {TEST_ENV:"0"}):
            with self.assertRaises(FixtureBankDenied):
                FixtureSqliteTownBanks(self.path)

    def test_real_database_name_must_be_disposable(self):
        with self.assertRaises(FixtureBankDenied):
            FixtureSqliteTownBanks(self.path.with_name("player_money.sqlite3"))
        with self.assertRaises(FixtureBankDenied):
            FixtureSqliteTownBanks(Path(":memory:"))

    def test_malformed_amount_and_guard_fields_denied(self):
        for amount in (0,-1,True,2**63):
            with self.subTest(amount=amount):
                with self.assertRaises(FixtureBankDenied):
                    self.lab.deposit("greyhaven","alice","bad",amount)
        for open_ in (1,"yes",None):
            with self.subTest(open_=open_):
                with self.assertRaises(FixtureBankDenied):
                    self.lab.robbery_fixture(
                        "greyhaven","thief_a","raid",
                        raid(amount=10,vault_open=open_)
                    )
        self.assertEqual(self.state()["banks"]["greyhaven"]["sequence"],0)

    def test_untrusted_zone_epoch_not_authorized(self):
        # The lab only checks shape, not real Core zone authority.
        # A caller can forge epoch=99 and move fictional gold.
        forged=raid(amount=10,epoch=99)
        self.assertEqual(self.lab.robbery_fixture(
            "greyhaven","thief_a","mock",forged).gold,10)
        self.assertEqual(self.state()["banks"]["greyhaven"]["reserve"],90)


if __name__=="__main__":
    unittest.main()
