"""Disposable PostgreSQL 16 Economics E2j acceptance (not game integration).

Requires MYASO_E2J_TEST_ONLY=1 and PGDATABASE=myaso_e2j_test.
It refuses any other database, and uses only psql as independent clients.
"""
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import shutil
import subprocess
import unittest

SCHEMA = Path(__file__).with_name("economics_e2j_pg_lab.sql")
TREASURY="00000000000000000000000000000001"
BUYER="00000000000000000000000000000010"
SELLER="00000000000000000000000000000020"
PARCEL="80000000000000000000000000000042"
SESSION="00000000000000000000000000000080"
CONSENT="000000000000000000000000000000ee"
OP="000000000000000000000000000000ff"


def b(value):
    return "decode('" + value + "','hex')"


def run_sql(sql=None, *, file=None, expect_failure=False):
    if os.getenv("MYASO_E2J_TEST_ONLY") != "1" or os.getenv("PGDATABASE") != "myaso_e2j_test":
        raise RuntimeError("Refusing any non-disposable E2j PostgreSQL database")
    if not shutil.which("psql"):
        raise RuntimeError("PostgreSQL 16 psql is required")
    command=["psql","-X","-q","-A","-t","-v","ON_ERROR_STOP=1"]
    command.extend(["-f",str(file)] if file else ["-c",sql])
    env=os.environ.copy()
    env["PGOPTIONS"]=(env.get("PGOPTIONS","")+" -c myaso.e2j.test_only=on").strip()
    result=subprocess.run(command,env=env,capture_output=True,text=True,timeout=20)
    if result.returncode == 0 and expect_failure:
        raise AssertionError("Expected SQL failure but succeeded: "+str(sql))
    if result.returncode != 0 and not expect_failure:
        raise AssertionError("SQL failed: "+result.stderr+"\n"+str(sql))
    return (result.stderr if expect_failure else result.stdout).strip()


def settle(*, op=OP, session=SESSION, worker=7, zone=5, epoch=3,
           listing=50, title_rev=1, buyer_rev=1, tick=10, fail=False):
    sql=("SELECT * FROM e2j_lab.settle_test_purchase("
         + ",".join([b(op),b(session),str(worker),str(zone),str(epoch),
                     str(listing),str(title_rev),str(buyer_rev),str(tick)]) + ")")
    return run_sql(sql,expect_failure=fail)


def value(sql):
    return run_sql(sql).splitlines()[-1]


class E2jPgAcceptance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not SCHEMA.exists():
            raise RuntimeError("Missing SQL schema")
        run_sql("DROP SCHEMA IF EXISTS e2j_lab CASCADE")
        run_sql(file=SCHEMA)

    def setUp(self):
        run_sql("TRUNCATE e2j_lab.outbox,e2j_lab.postings,e2j_lab.receipts,"
                "e2j_lab.consents,e2j_lab.listings,e2j_lab.titles,"
                "e2j_lab.zone_fences,e2j_lab.admissions,e2j_lab.accounts"
                " RESTART IDENTITY CASCADE")
        sql=(
            "INSERT INTO e2j_lab.accounts(account_key,kind,credits) VALUES"
            f"({b(TREASURY)},'treasury',100),"
            f"({b(BUYER)},'player',1000),"
            f"({b(SELLER)},'player',100);"
            "INSERT INTO e2j_lab.admissions("
            "session_ref,account_key,character_key,generation,active) VALUES"
            f"({b(SESSION)},{b(BUYER)},"
            f"{b('0102030405060708090a0b0c0d0e0f10')},3,true);"
            "INSERT INTO e2j_lab.zone_fences(parcel_key,worker,zone,epoch)"
            f" VALUES({b(PARCEL)},7,5,3);"
            "INSERT INTO e2j_lab.titles(parcel_key,owner_key,revision)"
            f" VALUES({b(PARCEL)},{b(SELLER)},1);"
            "INSERT INTO e2j_lab.listings("
            "listing_id,parcel_key,seller_key,title_revision,price,fee_bps,"
            "expiry_tick,consent_ref,state)"
            f" VALUES(50,{b(PARCEL)},{b(SELLER)},"
            f"1,500,200,100,{b(CONSENT)},'active');"
            "INSERT INTO e2j_lab.consents("
            "consent_ref,listing_id,parcel_key,seller_key,title_revision,"
            "price,fee_bps,expiry_tick,state)"
            f" VALUES({b(CONSENT)},50,{b(PARCEL)},"
            f"{b(SELLER)},1,500,200,100,'approved')"
        )
        run_sql(sql)

    def test_purchase_balances_and_atomic_property(self):
        self.assertEqual(settle(),"1|f")
        rows=run_sql("SELECT encode(account_key,'hex'),credits "
                     "FROM e2j_lab.accounts ORDER BY account_key").splitlines()
        self.assertEqual(rows,[TREASURY+"|110",BUYER+"|500",SELLER+"|590"])
        self.assertEqual(value("SELECT encode(owner_key,'hex')||'|'||revision "
                               "FROM e2j_lab.titles"),BUYER+"|2")
        self.assertEqual(value("SELECT SUM(delta) FROM e2j_lab.postings"),"0")
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.outbox"),"1")
        self.assertEqual(value("SELECT state FROM e2j_lab.consents"),"consumed")

    def test_ack_replay_is_idempotent(self):
        self.assertEqual(settle(),"1|f")
        self.assertEqual(settle(),"1|t")
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.receipts"),"1")
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.postings"),"3")
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.outbox"),"1")

    def test_conflicting_operation_payload_fails(self):
        settle()
        settle(buyer_rev=2,fail=True)
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.receipts"),"1")

    def test_revoked_session_blocks_even_receipt_replay(self):
        settle()
        run_sql("UPDATE e2j_lab.admissions SET active=false")
        settle(fail=True)
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.receipts"),"1")

    def test_handoff_blocks_historical_receipt_replay_for_old_worker(self):
        settle()
        run_sql("UPDATE e2j_lab.zone_fences SET worker=9,epoch=4")
        settle(fail=True)
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.receipts"),"1")
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.outbox"),"1")

    def test_wrong_or_frozen_zone_fence_blocks_purchase(self):
        for params in ({"worker":8},{"zone":9},{"epoch":4}):
            with self.subTest(params=params):
                settle(**params,fail=True)
        run_sql("UPDATE e2j_lab.zone_fences SET frozen=true")
        settle(fail=True)
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.receipts"),"0")

    def test_missing_revoked_or_changed_consent_blocks_purchase(self):
        run_sql("UPDATE e2j_lab.consents SET state='revoked'")
        settle(fail=True)
        run_sql("UPDATE e2j_lab.consents SET state='approved',price=501")
        settle(fail=True)
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.receipts"),"0")

    def test_expired_listing_cannot_sell(self):
        settle(tick=101,fail=True)
        self.assertEqual(value("SELECT state FROM e2j_lab.listings"),"active")

    def test_stale_buyer_revision_is_rejected(self):
        settle(buyer_rev=2,fail=True)
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.receipts"),"0")

    def test_underfunded_buyer_is_rejected(self):
        run_sql("UPDATE e2j_lab.accounts SET credits=40 "
                f"WHERE account_key={b(BUYER)}")
        settle(fail=True)
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.receipts"),"0")
        self.assertEqual(value("SELECT state FROM e2j_lab.listings"),"active")

    def test_self_sale_is_rejected(self):
        run_sql("UPDATE e2j_lab.admissions SET account_key="+b(SELLER))
        settle(fail=True)
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.receipts"),"0")

    def test_outer_rollback_undoes_entire_settlement(self):
        body=("BEGIN; SELECT * FROM e2j_lab.settle_test_purchase("
              f"{b(OP)},{b(SESSION)},7,5,3,50,1,1,10); ROLLBACK;")
        self.assertIn("|f",run_sql(body))
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.receipts"),"0")
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.outbox"),"0")
        self.assertEqual(value("SELECT state FROM e2j_lab.listings"),"active")

    def test_two_separate_psql_clients_one_listing_one_winner(self):
        op2="000000000000000000000000000000ab"
        def compete(op):
            try:
                settle(op=op)
                return True
            except AssertionError:
                return False
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(compete,(OP,op2)))
        self.assertEqual(sorted(results),[False,True])
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.receipts"),"1")
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.postings"),"3")

    def test_malformed_operation_key_denied(self):
        run_sql(
            "SELECT * FROM e2j_lab.settle_test_purchase("
            f"decode('00','hex'),{b(SESSION)},7,5,3,50,1,1,10)",
            expect_failure=True)
        self.assertEqual(value("SELECT count(*) FROM e2j_lab.receipts"),"0")

    def test_repeat_ack_after_commit_never_duplicates_money(self):
        settle()
        self.assertEqual(settle(),"1|t")
        self.assertEqual(value("SELECT sum(delta) FROM e2j_lab.postings"),"0")


if __name__=="__main__":
    unittest.main()
