"""E2g independent Core X1 u128 wire fixtures and account-boundary tests.

Golden vectors transcribed from Core X1 PR #407 commit
4556088bf5a938fedf7935a594e5ac0d5242cfc5. They are not authentication
material. The actual Core-owned adapter remains unmerged and uninstalled.
"""

import unittest

from economics_core_identity import (
    UntrustedIdentityEncoding, EconomicIdentityUnavailable,
    UntrustedCoreCharacterRecord, decode_untrusted_mych_v1,
    from_core_pg_character_key, to_core_pg_character_key,
    prepare_economic_account_from_character,
    prohibit_legacy_sqlite_character_owner,
    _fnv1a32,
    MAX_SQL_SIGNED_BIGINT,
    MAX_SQLITE_SIGNED_INTEGER,
)

VECTORS = (
    # character numerical hex, committed-generation bytes, 36-byte MYCH, PG bytea
    (
        "00000000000000000000000000000001",
        1,
        "4d5943480100000001000000000000000000000000000000010000000000000099b62575",
        "00000000000000000000000000000001",
    ),
    (
        "0102030405060708090a0b0c0d0e0f10",
        7,
        "4d59434801000000100f0e0d0c0b0a09080706050403020107000000000000007e4ee07b",
        "0102030405060708090a0b0c0d0e0f10",
    ),
    (
        "80000000000000000000000000000001",
        72623859790382856,
        "4d5943480100000001000000000000000000000000000080080706050403020100680099",
        "80000000000000000000000000000001",
    ),
)


class CoreCharacterIdentityBoundaryTests(unittest.TestCase):

    def test_all_three_core_x1_golden_mych_and_pg_bytea_vectors(self):
        for numeric, generation, record_hex, pg_hex in VECTORS:
            with self.subTest(numeric=numeric):
                record = decode_untrusted_mych_v1(bytes.fromhex(record_hex))
                self.assertEqual(record.numerical_character_id, int(numeric, 16))
                self.assertEqual(record.stored_session_generation, generation)
                self.assertEqual(record.pg_entity_bytea.hex(), pg_hex)
                self.assertEqual(from_core_pg_character_key(record.pg_entity_bytea),
                                 record.numerical_character_id)

    def test_id_le_bytes_must_not_be_directly_copied_into_pg_be_bytea(self):
        # Core 8B's MYCH persistent record is little-endian.
        # Core 8C's PostgreSQL bytea authority ID is big-endian.
        for numeric, _, record_hex, pg_hex in VECTORS:
            with self.subTest(numeric=numeric):
                raw = bytes.fromhex(record_hex)
                self.assertEqual(int.from_bytes(raw[8:24], "little"), int(numeric, 16))
                self.assertEqual(raw[8:24][::-1].hex(), pg_hex)
                self.assertNotEqual(raw[8:24], bytes.fromhex(pg_hex))

    def test_frozen_fnv1a32_check_bytes_from_upstream_fixture(self):
        for _, _, record_hex, _ in VECTORS:
            record = bytes.fromhex(record_hex)
            self.assertEqual(
                _fnv1a32(record[:32]),
                int.from_bytes(record[32:36], "little"),
            )

    def test_zero_identity_is_rejected_from_pg_and_record(self):
        with self.assertRaises(UntrustedIdentityEncoding):
            from_core_pg_character_key(bytes(16))
        with self.assertRaises(UntrustedIdentityEncoding):
            to_core_pg_character_key(0)
        fake = bytearray.fromhex(VECTORS[0][2])
        fake[8:24] = bytes(16)
        fake[32:36] = _fnv1a32(fake[:32]).to_bytes(4, "little")
        with self.assertRaises(UntrustedIdentityEncoding):
            decode_untrusted_mych_v1(bytes(fake))

    def test_record_checksum_mismatch_is_rejected(self):
        original = bytearray.fromhex(VECTORS[1][2])
        original[12] ^= 0x04
        with self.assertRaises(UntrustedIdentityEncoding):
            decode_untrusted_mych_v1(bytes(original))

    def test_invalid_magic_and_unknown_record_version_rejected(self):
        record = bytearray.fromhex(VECTORS[0][2])
        record[:4] = b"FAKE"
        record[32:36] = _fnv1a32(record[:32]).to_bytes(4, "little")
        with self.assertRaises(UntrustedIdentityEncoding):
            decode_untrusted_mych_v1(bytes(record))
        record = bytearray.fromhex(VECTORS[0][2])
        record[4] = 2
        record[32:36] = _fnv1a32(record[:32]).to_bytes(4, "little")
        with self.assertRaises(UntrustedIdentityEncoding):
            decode_untrusted_mych_v1(bytes(record))

    def test_nonzero_reserved_bytes_fail_even_with_updated_checksum(self):
        record = bytearray.fromhex(VECTORS[0][2])
        record[5] = 1
        record[32:36] = _fnv1a32(record[:32]).to_bytes(4, "little")
        with self.assertRaises(UntrustedIdentityEncoding):
            decode_untrusted_mych_v1(bytes(record))

    def test_truncated_or_wrong_length_records_are_rejected(self):
        raw = bytes.fromhex(VECTORS[0][2])
        for invalid in (b"", raw[:-1], raw + b"\x00", raw[8:24], raw[:32]):
            with self.subTest(size=len(invalid)):
                with self.assertRaises(UntrustedIdentityEncoding):
                    decode_untrusted_mych_v1(invalid)
        with self.assertRaises(UntrustedIdentityEncoding):
            decode_untrusted_mych_v1(bytearray(raw))

    def test_pg_entity_key_accepts_exact_16_bytes_only(self):
        with self.assertRaises(UntrustedIdentityEncoding):
            from_core_pg_character_key(b"\x01")
        with self.assertRaises(UntrustedIdentityEncoding):
            from_core_pg_character_key(b"\x01" * 15)
        with self.assertRaises(UntrustedIdentityEncoding):
            from_core_pg_character_key(b"\x01" * 17)
        with self.assertRaises(UntrustedIdentityEncoding):
            from_core_pg_character_key(bytearray(b"\x01" * 16))

    def test_all_128_bits_survive_no_u64_truncation(self):
        numeric = int(VECTORS[2][0], 16)
        self.assertGreater(numeric, 2 ** 64)
        self.assertEqual(from_core_pg_character_key(to_core_pg_character_key(numeric)),
                         numeric)
        self.assertNotEqual(numeric & ((1 << 64) - 1), numeric)

    def test_pg_signed_bigint_limit_is_not_character_identity_limit(self):
        self.assertEqual(MAX_SQL_SIGNED_BIGINT, (1 << 63) - 1)
        self.assertEqual(MAX_SQLITE_SIGNED_INTEGER, (1 << 63) - 1)
        self.assertGreater(int(VECTORS[2][0], 16), MAX_SQL_SIGNED_BIGINT)
        self.assertEqual(to_core_pg_character_key(int(VECTORS[2][0], 16)).hex(),
                         VECTORS[2][3])

    def test_out_of_range_and_non_integer_values_fail_closed(self):
        for raw in (-1, 1 << 128, True, 1.1, "1", None):
            with self.subTest(raw=raw):
                with self.assertRaises(UntrustedIdentityEncoding):
                    to_core_pg_character_key(raw)

    def test_generation_zero_is_record_data_not_live_admission(self):
        raw = bytearray.fromhex(VECTORS[0][2])
        raw[24:32] = (0).to_bytes(8, "little")
        raw[32:36] = _fnv1a32(raw[:32]).to_bytes(4, "little")
        parsed = decode_untrusted_mych_v1(bytes(raw))
        self.assertEqual(parsed.stored_session_generation, 0)
        with self.assertRaises(EconomicIdentityUnavailable):
            prepare_economic_account_from_character(parsed)

    def test_even_valid_record_cannot_be_converted_into_economic_account(self):
        for _, _, record_hex, _ in VECTORS:
            parsed = decode_untrusted_mych_v1(bytes.fromhex(record_hex))
            with self.assertRaises(EconomicIdentityUnavailable):
                prepare_economic_account_from_character(parsed)
            with self.assertRaises(EconomicIdentityUnavailable):
                prohibit_legacy_sqlite_character_owner(parsed.numerical_character_id)

    def test_untrusted_record_cannot_be_forged_with_mismatched_pg_bytes(self):
        numeric = int(VECTORS[1][0], 16)
        with self.assertRaises(UntrustedIdentityEncoding):
            UntrustedCoreCharacterRecord(
                numeric,
                7,
                numeric.to_bytes(16, "little"),
            )

    def test_no_legacy_sqlite_account_cast_even_for_small_character_id(self):
        parsed = decode_untrusted_mych_v1(bytes.fromhex(VECTORS[0][2]))
        self.assertEqual(parsed.numerical_character_id, 1)
        # The equal numeric value could be the demo treasury account ID;
        # equality is accidental and MUST NOT establish account ownership.
        with self.assertRaises(EconomicIdentityUnavailable):
            prohibit_legacy_sqlite_character_owner(1)


if __name__ == "__main__":
    unittest.main()
