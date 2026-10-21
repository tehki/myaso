"""E2h in-transaction Core identity mapping tests; all actors are fictional."""

from dataclasses import replace
from pathlib import Path
import sqlite3
import tempfile
import unittest

from economics_core_binding import (
    FixtureCoreIdentityAssertion, assert_fixture_binding_in_transaction,
    example_fixture_assertion,
)
from economics_core_identity import to_core_pg_character_key
from economics_recovery_audit import audit_fixture_database, CorruptState
from economics_sqlite_lab import (
    Denied, PurchaseIntent, VerifiedSession, bootstrap_fixture, purchase, snapshot,
)
from economics_admission_mutation import revoke_fixture_session, issue_fixture_session


class FixturePrincipalBindingTests(unittest.TestCase):
    def setUp(self):
        t = tempfile.TemporaryDirectory(prefix="myaso-e2h-")
        self.addCleanup(t.cleanup)
        self.root = Path(t.name)
        self.db = self.root / "fictional.sqlite3"
        bootstrap_fixture(self.db)

    def buy(self, assertion=None, *, buyer=10, op="op-A", epoch=8):
        return purchase(
            self.db, VerifiedSession(buyer, epoch),
            PurchaseIntent(op, buyer, 50, 1, 1), 20,
            _test_only_core_assertion=assertion,
        )

    def test_distinct_128bit_principals_bind_to_one_fictional_account(self):
        claim = example_fixture_assertion(10)
        self.assertEqual(claim.account_key_be.hex(), "00000000000000000000000000000a10")
        self.assertEqual(
            claim.character_key_be.hex(), "0102030405060708090a0b0c0d0e0f10"
        )
        self.assertNotEqual(claim.account_key_be, claim.character_key_be)
        self.assertEqual(self.buy(claim)["buyer_id"], 10)
        self.assertEqual(audit_fixture_database(self.db).sequence, 1)

    def test_unrelated_character_is_denied_without_any_debit(self):
        original = snapshot(self.db)
        who = example_fixture_assertion(10)
        with self.assertRaises(Denied):
            self.buy(replace(who, character_key_be=example_fixture_assertion(20).character_key_be))
        self.assertEqual(snapshot(self.db), original)

    def test_unrelated_account_is_denied_even_with_same_character(self):
        original = snapshot(self.db)
        who = example_fixture_assertion(10)
        with self.assertRaises(Denied):
            self.buy(replace(who, account_key_be=example_fixture_assertion(30).account_key_be))
        self.assertEqual(snapshot(self.db), original)

    def test_buyer_cannot_take_seller_or_other_buyer_mapping(self):
        original = snapshot(self.db)
        for other in (20, 30):
            with self.subTest(other=other):
                with self.assertRaises(Denied):
                    self.buy(example_fixture_assertion(other))
        self.assertEqual(snapshot(self.db), original)

    def test_revoked_epoch_fails_inside_same_transaction(self):
        revoke_fixture_session(
            self.db, operation_id="revoke-10", player_id=10, session_epoch=8
        )
        original = snapshot(self.db)
        with self.assertRaises(Denied):
            self.buy(example_fixture_assertion(10))
        self.assertEqual(snapshot(self.db), original)
        self.assertEqual(audit_fixture_database(self.db).mutation_revision, 1)

    def test_wrong_generation_or_bool_generation_is_denied(self):
        original = snapshot(self.db)
        for value in (0, 7, 9, True, -1, 2 ** 64):
            with self.subTest(value=value):
                with self.assertRaises(Denied):
                    self.buy(replace(example_fixture_assertion(10), session_generation=value))
        self.assertEqual(snapshot(self.db), original)

    def test_new_session_epoch_cannot_reuse_stale_bound_generation(self):
        issue_fixture_session(
            self.db, operation_id="new-9", player_id=10, session_epoch=9
        )
        before = snapshot(self.db)
        with self.assertRaises(Denied):
            self.buy(example_fixture_assertion(10), epoch=9)
        self.assertEqual(snapshot(self.db), before)

    def test_invalid_byte_lengths_and_zero_keys_are_denied(self):
        original = snapshot(self.db)
        base = example_fixture_assertion(10)
        candidates = (
            replace(base, account_key_be=b""),
            replace(base, account_key_be=b"\x00"*16),
            replace(base, account_key_be=b"\x01"*15),
            replace(base, account_key_be=bytearray(base.account_key_be)),
            replace(base, character_key_be=b"\x00"*16),
            replace(base, character_key_be=base.account_key_be),
            replace(base, character_key_be=bytearray(base.character_key_be)),
            replace(base, character_key_be=base.character_key_be[:-1]),
        )
        for bad in candidates:
            with self.subTest(value=repr(bad)[:110]):
                with self.assertRaises(Denied):
                    self.buy(bad)
        self.assertEqual(snapshot(self.db), original)

    def test_invalid_untrusted_object_and_overflowed_principals_fail(self):
        before = snapshot(self.db)
        for bad in ("character=1", {"character": 1}, True, 123):
            with self.subTest(bad=bad):
                with self.assertRaises(Denied):
                    self.buy(bad)
        with self.assertRaises(Denied):
            example_fixture_assertion(500)
        self.assertEqual(snapshot(self.db), before)

    def test_binding_query_requires_same_active_sqlite_transaction(self):
        with sqlite3.connect(self.db) as conn:
            # sqlite3's context manager does not BEGIN until DML.
            self.assertFalse(conn.in_transaction)
            with self.assertRaises(Denied):
                assert_fixture_binding_in_transaction(
                    conn, example_fixture_assertion(10), 10, 8
                )
            conn.execute("BEGIN IMMEDIATE")
            assert_fixture_binding_in_transaction(
                conn, example_fixture_assertion(10), 10, 8
            )
            conn.rollback()

    def test_binding_generation_can_be_stored_only_as_admitted_epoch(self):
        with sqlite3.connect(self.db) as conn:
            conn.execute(
                "UPDATE core_fixture_bindings SET session_generation=9"
                " WHERE ledger_account_id=10"
            )
        with self.assertRaises(CorruptState):
            audit_fixture_database(self.db)
        with self.assertRaises(Denied):
            self.buy(example_fixture_assertion(10))

    def test_duplicate_character_binding_rejected_by_unique_constraint(self):
        with sqlite3.connect(self.db) as conn:
            with self.assertRaises(sqlite3.IntegrityError):
                conn.execute(
                    "UPDATE core_fixture_bindings SET character_key_be=?"
                    " WHERE ledger_account_id=10",
                    (example_fixture_assertion(20).character_key_be,)
                )
        self.assertEqual(audit_fixture_database(self.db).sequence, 0)

    def test_mapping_sql_corruption_detected_by_auditor(self):
        with sqlite3.connect(self.db) as conn:
            conn.execute("UPDATE core_fixture_bindings SET session_generation=7"
                         " WHERE ledger_account_id=10")
        with self.assertRaises(CorruptState):
            audit_fixture_database(self.db)

    def test_partial_purchase_failure_has_no_receipt_and_no_binding_change(self):
        original = snapshot(self.db)
        with self.assertRaises(Exception):
            purchase(
                self.db, VerifiedSession(10, 8),
                PurchaseIntent("op-A", 10, 50, 1, 1), 20,
                _test_only_core_assertion=example_fixture_assertion(10),
                failpoint="after_title",
            )
        self.assertEqual(snapshot(self.db), original)
        self.assertEqual(audit_fixture_database(self.db).global_revision, 0)

    def test_retry_after_commit_gets_same_receipt_only_for_matching_mapping(self):
        assertion = example_fixture_assertion(10)
        receipt = self.buy(assertion)
        self.assertEqual(self.buy(assertion), receipt)
        with self.assertRaises(Denied):
            self.buy(example_fixture_assertion(30))
        self.assertEqual(audit_fixture_database(self.db).sequence, 1)

    def test_revocation_after_commit_blocks_receipt_retrieval_for_same_binding(self):
        original = self.buy(example_fixture_assertion(10))
        self.assertEqual(original["sequence"], 1)
        revoke_fixture_session(
            self.db, operation_id="revoke-10", player_id=10, session_epoch=8
        )
        stable = snapshot(self.db)
        with self.assertRaises(Denied):
            self.buy(example_fixture_assertion(10))
        self.assertEqual(snapshot(self.db), stable)
        report = audit_fixture_database(self.db)
        self.assertEqual((report.sequence, report.mutation_revision), (1, 1))

    def test_high_bit_core_character_is_supported_without_integer_cast(self):
        assertion = example_fixture_assertion(20)
        numeric = int.from_bytes(assertion.character_key_be, "big")
        self.assertGreater(numeric, 2 ** 64)
        self.assertEqual(to_core_pg_character_key(numeric), assertion.character_key_be)
        self.assertEqual(len(assertion.account_key_be), 16)
        self.assertNotEqual(assertion.account_key_be, assertion.character_key_be)

    def test_known_fixture_assertion_is_trivially_constructible_not_authentication(self):
        assertion = example_fixture_assertion(10)
        # A client with knowledge of the published fixture can create the
        # same value. Matching stored bytes proves NOTHING about the caller.
        forged = FixtureCoreIdentityAssertion(
            assertion.account_key_be, assertion.character_key_be,
            assertion.session_generation,
        )
        self.assertEqual(assertion, forged)
        # Lab permits this, proving it MUST NOT be wired to a real network.
        self.assertEqual(self.buy(forged)["buyer_id"], 10)


if __name__ == "__main__":
    unittest.main()
