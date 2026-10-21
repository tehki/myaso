"""B1: 128-bit World->Bank event INTERFACE tests, never robbery grants."""
from dataclasses import replace
import json
import unittest

from economics_bank_world_contract import (
    BankWorldAuthorityUnavailable, InvalidBankWorldEnvelope,
    UntrustedVaultBreachEnvelope, parse_untrusted_world_envelope,
    require_real_atomic_breach_authority,
)
from economics_town_banks_lab import LocalTownBanksLab


def fixture():
    return UntrustedVaultBreachEnvelope(
        schema="myaso.bank-vault-breach.v1",
        town_id="greyhaven",
        vault_entity_id="80000000000000000000000000000004",
        event_id="a0000000000000000000000000000005",
        actor_character_id="b0000000000000000000000000000006",
        loot_container_id="c0000000000000000000000000000007",
        worker_id=15, zone_id=9, authority_epoch=31,
        session_generation=22, vault_revision=11, world_tick=130,
        stolen_gold=45,
    )


class BankWorldContractTests(unittest.TestCase):
    def setUp(self):
        self.event = fixture()
        self.bank = LocalTownBanksLab(
            {"greyhaven": 100, "redlion": 50},
            {"robber": 0}, {"robber": "greyhaven"},
        )
        self.snapshot = self.bank.town_state("greyhaven")
        self.supply = self.bank.total_physical_gold()

    def test_roundtrip_is_byte_for_byte_canonical(self):
        raw = self.event.canonical_bytes()
        self.assertEqual(parse_untrusted_world_envelope(raw), self.event)
        self.assertEqual(parse_untrusted_world_envelope(raw).canonical_bytes(), raw)

    def test_hash_is_stable_but_not_a_signature(self):
        self.assertEqual(self.event.fingerprint(), fixture().fingerprint())
        self.assertEqual(len(self.event.fingerprint()), 64)
        self.assertNotEqual(self.event.fingerprint(), replace(self.event, stolen_gold=46).fingerprint())

    def test_high_bit_full_width_character_and_vault_supported(self):
        self.assertEqual(len(self.event.actor_character_id), 32)
        self.assertGreater(int(self.event.actor_character_id, 16), 2**64)
        self.assertGreater(int(self.event.vault_entity_id, 16), 2**64)

    def test_reject_duplicate_json_keys(self):
        raw = self.event.canonical_bytes()
        raw = raw.replace(b'"worker_id":15', b'"worker_id":15,"worker_id":15')
        with self.assertRaises(InvalidBankWorldEnvelope):
            parse_untrusted_world_envelope(raw)

    def test_reject_missing_unknown_fields(self):
        d = json.loads(self.event.canonical_bytes())
        d.pop("vault_revision")
        with self.assertRaises(InvalidBankWorldEnvelope):
            parse_untrusted_world_envelope(json.dumps(d).encode())
        d["vault_revision"] = 11
        d["is_admin"] = True
        with self.assertRaises(InvalidBankWorldEnvelope):
            parse_untrusted_world_envelope(json.dumps(d).encode())

    def test_reject_noncanonical_json_property_order_and_spaces(self):
        d = json.loads(self.event.canonical_bytes())
        raw = json.dumps(d, indent=2).encode()
        with self.assertRaises(InvalidBankWorldEnvelope):
            parse_untrusted_world_envelope(raw)

    def test_reject_utf8_bom_invalid_utf8_and_non_bytes(self):
        for raw in (b"\xef\xbb\xbf" + self.event.canonical_bytes(), b"\xff",
                    self.event.canonical_bytes().decode("ascii"), None, True):
            with self.subTest(raw=repr(raw)[:40]):
                with self.assertRaises(InvalidBankWorldEnvelope):
                    parse_untrusted_world_envelope(raw)

    def test_reject_oversized_and_empty_payloads(self):
        for raw in (b"", b"a"*2049):
            with self.assertRaises(InvalidBankWorldEnvelope):
                parse_untrusted_world_envelope(raw)

    def test_bool_must_not_be_numeric_epoch_or_gold(self):
        for key in ("worker_id", "zone_id", "authority_epoch", "session_generation",
                    "vault_revision", "world_tick", "stolen_gold"):
            with self.subTest(key=key):
                with self.assertRaises(InvalidBankWorldEnvelope):
                    replace(self.event, **{key: True})

    def test_number_overflow_rejected(self):
        for key in ("worker_id", "zone_id", "authority_epoch", "session_generation",
                    "vault_revision", "world_tick"):
            with self.subTest(key=key):
                with self.assertRaises(InvalidBankWorldEnvelope):
                    replace(self.event, **{key: 2**63})

    def test_zero_epochs_worker_and_revision_rejected(self):
        for key in ("worker_id", "zone_id", "authority_epoch", "session_generation",
                    "vault_revision", "stolen_gold"):
            with self.subTest(key=key):
                with self.assertRaises(InvalidBankWorldEnvelope):
                    replace(self.event, **{key: 0})
        self.assertEqual(replace(self.event, world_tick=0).world_tick, 0)

    def test_negative_and_huge_gold_rejected(self):
        for gold in (-1, 0, 10**12+1, -2**63, 1.5, "4"):
            with self.subTest(gold=gold):
                with self.assertRaises(InvalidBankWorldEnvelope):
                    replace(self.event, stolen_gold=gold)

    def test_wrong_and_missing_schema_rejected(self):
        for schema in ("", "myaso.bank-vault-breach.v2", None):
            with self.subTest(schema=schema):
                with self.assertRaises(InvalidBankWorldEnvelope):
                    replace(self.event, schema=schema)

    def test_wrong_town_ids_rejected(self):
        for town in ("Greyhaven", "bad town", "", "../../etc", "a"*49, None):
            with self.subTest(town=town):
                with self.assertRaises(InvalidBankWorldEnvelope):
                    replace(self.event, town_id=town)

    def test_malformed_nonzero_128bit_key_rejected(self):
        for key in ("vault_entity_id", "event_id", "actor_character_id",
                    "loot_container_id"):
            for val in ("0"*32, "ABC"*11, "f"*33, "a"*31, "", 5, None):
                with self.subTest(key=key, val=val):
                    with self.assertRaises(InvalidBankWorldEnvelope):
                        replace(self.event, **{key: val})

    def test_vault_cannot_equal_loot_container(self):
        with self.assertRaises(InvalidBankWorldEnvelope):
            replace(self.event, loot_container_id=self.event.vault_entity_id)

    def test_fraction_and_nan_json_rejected(self):
        raw = self.event.canonical_bytes()
        for suffix in (b"1.25", b"1e2", b"NaN", b"Infinity"):
            tampered = raw.replace(b'"stolen_gold":45', b'"stolen_gold":' + suffix)
            with self.subTest(number=suffix):
                with self.assertRaises(InvalidBankWorldEnvelope):
                    parse_untrusted_world_envelope(tampered)

    def test_parsed_forged_envelope_is_still_untrusted(self):
        forged = parse_untrusted_world_envelope(fixture().canonical_bytes())
        self.assertEqual(forged, self.event)
        with self.assertRaisesRegex(BankWorldAuthorityUnavailable, "no trusted"):
            require_real_atomic_breach_authority(forged)

    def test_altered_gold_with_recomputed_hash_is_still_untrusted(self):
        forged = replace(self.event, stolen_gold=95)
        self.assertNotEqual(forged.fingerprint(), self.event.fingerprint())
        with self.assertRaises(BankWorldAuthorityUnavailable):
            require_real_atomic_breach_authority(forged)

    def test_no_economy_mutation_on_parsed_valid_world_event(self):
        original_events = self.bank.town_events("greyhaven")
        require = require_real_atomic_breach_authority
        for candidate in (self.event, parse_untrusted_world_envelope(self.event.canonical_bytes())):
            with self.assertRaises(BankWorldAuthorityUnavailable):
                require(candidate)
        self.assertEqual(self.bank.town_state("greyhaven"), self.snapshot)
        self.assertEqual(self.bank.town_events("greyhaven"), original_events)
        self.assertEqual(self.bank.carried_gold("robber"), 0)
        self.assertEqual(self.bank.total_physical_gold(), self.supply)

    def test_reject_unknown_event_object_without_any_effect(self):
        for candidate in (None, {}, self.event.canonical_bytes(), "event"):
            with self.assertRaises(InvalidBankWorldEnvelope):
                require_real_atomic_breach_authority(candidate)
        self.assertEqual(self.bank.town_state("greyhaven"), self.snapshot)

    def test_ingress_canonicalization_is_deterministic(self):
        inputs = (self.event, replace(self.event, worker_id=16),
                  replace(self.event, town_id="redlion"))
        self.assertEqual(len({x.canonical_bytes() for x in inputs}), 3)
        self.assertEqual(len({x.fingerprint() for x in inputs}), 3)

    def test_well_formed_claim_cannot_select_global_balance_or_move_gold(self):
        pretend_remote = replace(self.event, town_id="redlion")
        with self.assertRaises(BankWorldAuthorityUnavailable):
            require_real_atomic_breach_authority(pretend_remote)
        self.assertEqual(self.bank.town_state("redlion")["reserve_gold"], 50)
        self.assertEqual(self.bank.town_state("greyhaven")["reserve_gold"], 100)

    def test_p2_contract_has_no_unauthenticated_commit_function(self):
        import economics_bank_world_contract as m
        self.assertFalse(hasattr(m, "commit_vault_breach"))
        self.assertFalse(hasattr(m, "authorize_vault_breach"))
        self.assertFalse(hasattr(m, "apply_robbery"))
        self.assertEqual(self.bank.total_physical_gold(), self.supply)


if __name__ == "__main__":
    unittest.main()
