"""E2i strict, server-injected purchase boundary tests. All IDs and actors fake."""

from dataclasses import replace
from pathlib import Path
import sqlite3
import tempfile
import unittest

from economics_core_binding import example_fixture_assertion
from economics_core_gateway import (
    FixtureResolvedTransport,
    FixtureServerSessionProvider,
    assert_fixture_server_session_in_transaction,
    strict_purchase_fixture,
)
from economics_sqlite_lab import (
    Denied, InjectedFailure, PurchaseIntent, VerifiedSession,
    bootstrap_fixture, purchase, snapshot,
)
from economics_admission_mutation import revoke_fixture_session
from economics_recovery_audit import audit_fixture_database


class FakeServerProvider(FixtureServerSessionProvider):
    """A fake, publicly constructible server provider. NOT real authentication."""

    def __init__(self, db_path=None):
        self.sessions = {}
        self.outage = False
        self.seen = []
        self.db_path = db_path
        self.writer_locked = []

    def add(self, handle=b"server-connection-10", *, ledger_id=10, generation=8,
            account_key=None, character_key=None):
        known = example_fixture_assertion(ledger_id)
        self.sessions[handle] = FixtureResolvedTransport(
            ledger_id,
            account_key if account_key is not None else known.account_key_be,
            character_key if character_key is not None else known.character_key_be,
            generation,
        )
        return self

    def resolve_server_owned_handle(self, handle: bytes):
        self.seen.append(handle)
        if self.outage:
            raise RuntimeError("Pretend server session resolver is unavailable")
        if self.db_path:
            db = sqlite3.connect(self.db_path, isolation_level=None, timeout=0)
            try:
                try:
                    db.execute("BEGIN IMMEDIATE")
                except sqlite3.OperationalError as exc:
                    if "locked" not in str(exc).lower():
                        raise
                    self.writer_locked.append(True)
                else:
                    self.writer_locked.append(False)
                    db.rollback()
            finally:
                db.close()
        return self.sessions.get(handle)


class StrictOfflineGatewayTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="myaso-e2i-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.db_path = self.root / "fixture.sqlite3"
        bootstrap_fixture(self.db_path)
        self.provider = FakeServerProvider(self.db_path).add()
        self.intent = PurchaseIntent("op-001", 10, 50, 1, 1)

    def submit(self, provider=None, *, handle=b"server-connection-10",
               intent=None, generation=8, failpoint=None):
        return strict_purchase_fixture(
            self.db_path,
            server_transport_ref=handle,
            intent=intent or self.intent,
            expected_generation=generation,
            trusted_tick=20,
            installed_provider=self.provider if provider is None else provider,
            failpoint=failpoint,
        )

    def test_provider_is_mandatory_and_failure_is_atomic(self):
        original = snapshot(self.db_path)
        with self.assertRaises(Denied):
            strict_purchase_fixture(
                self.db_path, server_transport_ref=b"server-connection-10",
                intent=self.intent, expected_generation=8, trusted_tick=20,
            )
        self.assertEqual(snapshot(self.db_path), original)

    def test_valid_mock_provider_commits_single_purchase(self):
        receipt = self.submit()
        self.assertEqual(receipt["buyer_id"], 10)
        self.assertEqual(receipt["title_version"], 2)
        self.assertEqual(snapshot(self.db_path)["title"], (10, 2))
        self.assertEqual(audit_fixture_database(self.db_path).sequence, 1)

    def test_provider_is_called_inside_existing_sqlite_writer_transaction(self):
        self.submit()
        self.assertEqual(self.provider.writer_locked, [True])
        self.assertEqual(self.provider.seen, [b"server-connection-10"])

    def test_unknown_handle_fails_before_receipt_or_money(self):
        before = snapshot(self.db_path)
        with self.assertRaises(Denied):
            self.submit(handle=b"unknown-transport")
        self.assertEqual(snapshot(self.db_path), before)

    def test_wrong_handle_types_or_lengths_fail_closed(self):
        before = snapshot(self.db_path)
        for ref in (None, "", b"", b"\x01"*65, 123, True,
                    bytearray(b"server-connection-10")):
            with self.subTest(ref=repr(ref)[:40]):
                with self.assertRaises(Denied):
                    self.submit(handle=ref)
        self.assertEqual(snapshot(self.db_path), before)

    def test_server_resolver_outage_blocks_purchase(self):
        self.provider.outage = True
        before = snapshot(self.db_path)
        with self.assertRaises(Denied):
            self.submit()
        self.assertEqual(snapshot(self.db_path), before)

    def test_wrong_bound_character_is_denied_atomically(self):
        claim = example_fixture_assertion(20)
        provider = FakeServerProvider().add(
            account_key=example_fixture_assertion(10).account_key_be,
            character_key=claim.character_key_be,
        )
        before = snapshot(self.db_path)
        with self.assertRaises(Denied):
            self.submit(provider)
        self.assertEqual(snapshot(self.db_path), before)

    def test_wrong_bound_account_is_denied_atomically(self):
        provider = FakeServerProvider().add(
            account_key=example_fixture_assertion(30).account_key_be,
        )
        before = snapshot(self.db_path)
        with self.assertRaises(Denied):
            self.submit(provider)
        self.assertEqual(snapshot(self.db_path), before)

    def test_server_session_identity_cannot_be_another_buyer(self):
        provider = FakeServerProvider().add(ledger_id=30)
        before = snapshot(self.db_path)
        with self.assertRaises(Denied):
            self.submit(provider)
        self.assertEqual(snapshot(self.db_path), before)

    def test_stale_session_generation_is_denied(self):
        for mismatch in (7, 9, 0):
            with self.subTest(mismatch=mismatch):
                provider = FakeServerProvider().add(generation=mismatch)
                with self.assertRaises(Denied):
                    self.submit(provider)
        self.assertEqual(audit_fixture_database(self.db_path).sequence, 0)

    def test_untrusted_requested_generation_cannot_override_server_epoch(self):
        before = snapshot(self.db_path)
        with self.assertRaises(Denied):
            self.submit(generation=9)
        self.assertEqual(snapshot(self.db_path), before)

    def test_original_committed_receipt_requery_requires_provider_again(self):
        first = self.submit()
        self.assertEqual(self.submit(), first)
        self.provider.outage = True
        with self.assertRaises(Denied):
            self.submit()
        self.assertEqual(audit_fixture_database(self.db_path).sequence, 1)

    def test_revoked_session_blocks_old_receipt_access(self):
        self.submit()
        revoke_fixture_session(
            self.db_path, operation_id="session-revoke", player_id=10,
            session_epoch=8,
        )
        before = snapshot(self.db_path)
        with self.assertRaises(Denied):
            self.submit()
        self.assertEqual(snapshot(self.db_path), before)

    def test_prepurchase_failure_rolls_back_everything(self):
        before = snapshot(self.db_path)
        with self.assertRaises(InjectedFailure):
            self.submit(failpoint="after_title")
        self.assertEqual(snapshot(self.db_path), before)
        self.assertEqual(audit_fixture_database(self.db_path).global_revision, 0)

    def test_postcommit_ack_lost_can_retry_once(self):
        with self.assertRaises(InjectedFailure):
            self.submit(failpoint="after_commit")
        before = snapshot(self.db_path)
        self.assertEqual(self.submit()["sequence"], 1)
        self.assertEqual(snapshot(self.db_path), before)
        self.assertEqual(audit_fixture_database(self.db_path).sequence, 1)

    def test_altered_operation_id_cannot_resell_consumed_listing(self):
        self.submit()
        other = replace(self.intent, op_id="another-id", buyer_revision=2)
        with self.assertRaises(Denied):
            self.submit(intent=other)
        self.assertEqual(audit_fixture_database(self.db_path).sequence, 1)

    def test_malformed_intent_and_generation_fail(self):
        before = snapshot(self.db_path)
        for intent in ({}, None, "purchase", True):
            with self.subTest(intent=repr(intent)):
                with self.assertRaises(Denied):
                    strict_purchase_fixture(
                        self.db_path, server_transport_ref=b"server-connection-10",
                        intent=intent, expected_generation=8,
                        trusted_tick=20, installed_provider=self.provider
                    )
        for epoch in (0, -1, True, 1.25):
            with self.subTest(epoch=epoch):
                with self.assertRaises(Denied):
                    self.submit(generation=epoch)
        self.assertEqual(snapshot(self.db_path), before)

    def test_invalid_verifier_output_fails_closed(self):
        class Broken(FixtureServerSessionProvider):
            def resolve_server_owned_handle(self, handle: bytes):
                return {"account": 10}
        with self.assertRaises(Denied):
            self.submit(Broken())
        self.assertEqual(audit_fixture_database(self.db_path).sequence, 0)

    def test_direct_authorizer_without_db_transaction_is_denied(self):
        db = sqlite3.connect(self.db_path)
        try:
            with self.assertRaises(Denied):
                assert_fixture_server_session_in_transaction(
                    db, self.provider, b"server-connection-10",
                    VerifiedSession(10, 8), self.intent,
                )
        finally:
            db.close()

    def test_old_e2h_caller_assertion_cannot_mix_with_installed_adapter(self):
        from economics_sqlite_lab import purchase
        before = snapshot(self.db_path)
        with self.assertRaises(Denied):
            purchase(
                self.db_path, VerifiedSession(10, 8), self.intent, 20,
                _test_only_core_assertion=example_fixture_assertion(10),
                _test_only_server_authorizer=self.provider,
                _test_only_server_transport_ref=b"server-connection-10",
            )
        self.assertEqual(snapshot(self.db_path), before)

    def test_direct_optional_gateway_parameters_must_be_complete(self):
        before = snapshot(self.db_path)
        with self.assertRaises(Denied):
            purchase(
                self.db_path, VerifiedSession(10, 8), self.intent, 20,
                _test_only_server_authorizer=self.provider,
            )
        with self.assertRaises(Denied):
            purchase(
                self.db_path, VerifiedSession(10, 8), self.intent, 20,
                _test_only_server_transport_ref=b"server-connection-10",
            )
        self.assertEqual(snapshot(self.db_path), before)

    def test_public_mock_backend_is_forgeable_not_production_authorization(self):
        # Explicit negative security finding: the mock provider and known
        # fictional identifiers are constructible by any local Python caller.
        forged = FakeServerProvider().add()
        self.assertEqual(self.submit(forged)["sequence"], 1)
        self.assertEqual(audit_fixture_database(self.db_path).sequence, 1)


if __name__ == "__main__":
    unittest.main()
