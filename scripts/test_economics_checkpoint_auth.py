"""E2d offline HMAC checkpoint fixture security and restore acceptance."""

from dataclasses import replace
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from economics_sqlite_lab import (
    PurchaseIntent, VerifiedSession, bootstrap_fixture, project_title_event,
    purchase,
)
from economics_recovery_audit import (
    RecoveryAnchor, backup_fixture_database,
)
from economics_checkpoint_auth import (
    AuthenticatedCheckpoint, InvalidCheckpoint, issue_fixture_checkpoint,
    encode_checkpoint, decode_checkpoint, verify_fixture_checkpoint,
)

KEY_A = b"myaso E2d test-only signing secret A 00000000000000001"
KEY_B = b"myaso E2d test-only signing secret B 00000000000000002"
REALM = "myaso-fixture-1"


class CheckpointSecurityTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="myaso-e2d-mac-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.db = self.root / "fictional.sqlite3"
        bootstrap_fixture(self.db)

    def seal(self, *, key_id="key-a", secret=KEY_A):
        return issue_fixture_checkpoint(
            self.db, realm=REALM, key_id=key_id, secret=secret
        )

    def validate(self, checkpoint, *, path=None, keys=None, minimum=0, realm=REALM):
        return verify_fixture_checkpoint(
            path or self.db, checkpoint, expected_realm=realm,
            trusted_keys={"key-a": KEY_A} if keys is None else keys,
            minimum_committed_sequence=minimum,
        )

    def buy(self):
        return purchase(
            self.db, VerifiedSession(10, 8),
            PurchaseIntent("op-A", 10, 50, 1, 1), 20
        )

    def test_genesis_checkpoint_encodes_and_verifies_roundtrip(self):
        checkpoint = self.seal()
        encoded = encode_checkpoint(checkpoint)
        self.assertEqual(decode_checkpoint(encoded), checkpoint)
        self.assertEqual(encode_checkpoint(decode_checkpoint(encoded)), encoded)
        report = self.validate(checkpoint)
        self.assertEqual(report.sequence, 0)
        self.assertEqual(report.issued_units, 2400)

    def test_committed_sale_and_projection_can_be_sealed_and_recovered(self):
        self.buy()
        project_title_event(self.db, 1)
        checkpoint = self.seal()
        backup = self.root / "complete.sqlite3"
        backup_fixture_database(self.db, backup)
        report = self.validate(
            decode_checkpoint(encode_checkpoint(checkpoint)),
            path=backup, minimum=1,
        )
        self.assertEqual(report.sequence, 1)
        self.assertEqual(report.inbox_events, 1)

    def test_valid_old_backup_with_valid_old_mac_rejected_by_minimum_commit(self):
        old_backup = self.root / "old.sqlite3"
        backup_fixture_database(self.db, old_backup)
        old_checkpoint = self.seal()
        self.buy()
        new_checkpoint = self.seal()
        self.assertEqual(new_checkpoint.sequence, 1)
        self.assertEqual(old_checkpoint.sequence, 0)
        # Crucially, the valid old HMAC does not override outside knowledge
        # that sequence 1 was already committed.
        with self.assertRaises(InvalidCheckpoint):
            self.validate(old_checkpoint, path=old_backup, minimum=1)
        with self.assertRaises(InvalidCheckpoint):
            self.validate(old_checkpoint, minimum=1)
        self.assertEqual(self.validate(new_checkpoint, minimum=1).sequence, 1)
        # Without external monotonic state, a valid old checkpoint CANNOT
        # distinguish legitimate historical restore from malicious rollback.
        self.assertEqual(self.validate(old_checkpoint, path=old_backup).sequence, 0)

    def test_newer_seal_rejects_older_consistent_restore(self):
        old = self.root / "old.sqlite3"
        backup_fixture_database(self.db, old)
        self.buy()
        current = self.seal()
        with self.assertRaises(InvalidCheckpoint):
            self.validate(current, path=old, minimum=1)

    def test_tamper_logical_hash_rejected_even_if_format_is_valid(self):
        self.buy()
        checkpoint = self.seal()
        fake = replace(checkpoint, logical_sha256="0" * 64)
        with self.assertRaises(InvalidCheckpoint):
            self.validate(fake)
        fake = replace(checkpoint, sequence=0)
        with self.assertRaises(InvalidCheckpoint):
            self.validate(fake)

    def test_tamper_hmac_rejected(self):
        checkpoint = self.seal()
        fake = replace(checkpoint, hmac_sha256="f" * 64)
        with self.assertRaises(InvalidCheckpoint):
            self.validate(fake)
        # A digest with one changed nibble is still rejected.
        altered = ("0" if checkpoint.hmac_sha256[0] != "0" else "1")
        with self.assertRaises(InvalidCheckpoint):
            self.validate(replace(checkpoint, hmac_sha256=altered + checkpoint.hmac_sha256[1:]))

    def test_wrong_realm_prevents_cross_realm_replay(self):
        checkpoint = self.seal()
        with self.assertRaises(InvalidCheckpoint):
            self.validate(checkpoint, realm="myaso-fixture-2")
        with self.assertRaises(InvalidCheckpoint):
            self.validate(replace(checkpoint, realm="myaso-fixture-2"))

    def test_unknown_key_id_wrong_key_and_removed_key_fail(self):
        checkpoint = self.seal()
        with self.assertRaises(InvalidCheckpoint):
            self.validate(checkpoint, keys={"key-a": KEY_B})
        with self.assertRaises(InvalidCheckpoint):
            self.validate(checkpoint, keys={})
        with self.assertRaises(InvalidCheckpoint):
            self.validate(replace(checkpoint, key_id="key-b"), keys={"key-a": KEY_A, "key-b": KEY_B})

    def test_explicit_key_rotation_and_retirement(self):
        old = self.seal()
        rotated = self.seal(key_id="key-b", secret=KEY_B)
        keys = {"key-a": KEY_A, "key-b": KEY_B}
        self.assertEqual(self.validate(old, keys=keys).sequence, 0)
        self.assertEqual(self.validate(rotated, keys=keys).sequence, 0)
        with self.assertRaises(InvalidCheckpoint):
            self.validate(old, keys={"key-b": KEY_B})
        self.assertEqual(self.validate(rotated, keys={"key-b": KEY_B}).sequence, 0)

    def test_token_json_duplicate_fields_rejected(self):
        encoded = encode_checkpoint(self.seal())
        duplicated = encoded[:-1] + ',"version":1}'
        with self.assertRaises(InvalidCheckpoint):
            decode_checkpoint(duplicated)

    def test_checkpoint_with_extra_fields_and_wrong_json_types_rejected(self):
        parsed = json.loads(encode_checkpoint(self.seal()))
        parsed["actor"] = "bob"
        with self.assertRaises(InvalidCheckpoint):
            decode_checkpoint(json.dumps(parsed))
        del parsed["actor"]
        parsed["sequence"] = True
        with self.assertRaises(InvalidCheckpoint):
            decode_checkpoint(json.dumps(parsed))
        parsed["sequence"] = 0.0
        with self.assertRaises(InvalidCheckpoint):
            decode_checkpoint(json.dumps(parsed))
        parsed["sequence"] = 0
        parsed["version"] = True
        with self.assertRaises(InvalidCheckpoint):
            decode_checkpoint(json.dumps(parsed))

    def test_missing_fields_and_invalid_encoding_fail_closed(self):
        c = self.seal()
        fields = json.loads(encode_checkpoint(c))
        del fields["hmac_sha256"]
        with self.assertRaises(InvalidCheckpoint):
            decode_checkpoint(json.dumps(fields))
        for token in ("", "[]", "null", '{"bad_json"', "x" * 2500):
            with self.subTest(token=token[:10]):
                with self.assertRaises(InvalidCheckpoint):
                    decode_checkpoint(token)

    def test_short_signing_key_and_invalid_names_fail(self):
        with self.assertRaises(InvalidCheckpoint):
            self.seal(secret=b"guessable")
        with self.assertRaises(InvalidCheckpoint):
            issue_fixture_checkpoint(self.db, realm="bad/name", key_id="key-a", secret=KEY_A)
        with self.assertRaises(InvalidCheckpoint):
            issue_fixture_checkpoint(self.db, realm=REALM, key_id="", secret=KEY_A)
        with self.assertRaises(InvalidCheckpoint):
            self.validate(self.seal(), keys={"key-a": b"too-short"})

    def test_minimum_sequence_rejects_bool_negative_and_impossible_value(self):
        checkpoint = self.seal()
        for n in (True, -1, (1 << 63), 1.5):
            with self.subTest(n=n):
                with self.assertRaises(InvalidCheckpoint):
                    self.validate(checkpoint, minimum=n)

    def test_unmodified_seal_catches_redistributed_credits(self):
        self.buy()
        checkpoint = self.seal()
        with sqlite3.connect(self.db) as conn:
            conn.execute("UPDATE accounts SET units=units+1 WHERE id=30")
            conn.execute("UPDATE accounts SET units=units-1 WHERE id=10")
        with self.assertRaises(InvalidCheckpoint):
            self.validate(checkpoint, minimum=1)

    def test_schema_edit_invalidates_authentic_checkpoint(self):
        checkpoint = self.seal()
        with sqlite3.connect(self.db) as conn:
            conn.execute("DROP INDEX one_active_listing_per_parcel")
        with self.assertRaises(InvalidCheckpoint):
            self.validate(checkpoint)

if __name__ == "__main__":
    unittest.main()
