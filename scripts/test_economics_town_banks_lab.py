"""P2 local NPC town banks: gold conservation, isolation and mock robbery tests.

These prove only deterministic offline accounting, not actual Sentinel guards,
vault access, physics, ownership, Core identity or persistence.
"""
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import unittest

from economics_town_banks_lab import (
    BankDenied, LocalTownBanksLab, VaultBreachFixture,
)


class TownBanksOfflineTests(unittest.TestCase):
    def setUp(self):
        self.lab = LocalTownBanksLab(
            {"greyhaven": 100, "redlion": 30},
            {"alice": 400, "bob": 100, "robber": 0, "charlie": 60},
            {"alice": "greyhaven", "bob": "greyhaven",
             "robber": "greyhaven", "charlie": "redlion"},
            carry_limit=700,
        )
        self.original_supply = self.lab.total_physical_gold()

    def proof(self, *, event="vault-break-1", town="greyhaven", gold=50,
              actor="robber", vault=None, open_=True, guards=True, epoch=3):
        return VaultBreachFixture(
            event_id=event,
            town=town,
            vault_id=vault or f"{town}-vault",
            actor=actor,
            stolen_gold=gold,
            vault_open=open_,
            guards_overcome=guards,
            zone_epoch=epoch,
        )

    def test_town_banks_are_npc_institutions(self):
        for town in ("greyhaven", "redlion"):
            self.assertEqual(self.lab.town_state(town)["operator"], "town_npc")

    def test_independent_founder_reserves(self):
        self.assertEqual(self.lab.town_state("greyhaven")["reserve_gold"], 100)
        self.assertEqual(self.lab.town_state("redlion")["reserve_gold"], 30)
        self.assertEqual(self.original_supply, 690)

    def test_deposit_moves_physical_gold_into_only_one_town_vault(self):
        receipt = self.lab.deposit("alice", "greyhaven", "alice-deposit", 250)
        self.assertEqual(receipt.vault_reserve_after, 350)
        self.assertEqual(self.lab.at_town_balance("alice", "greyhaven"), 250)
        self.assertEqual(self.lab.carried_gold("alice"), 150)
        self.assertEqual(self.lab.town_state("redlion")["reserve_gold"], 30)
        self.assertEqual(self.lab.total_physical_gold(), self.original_supply)

    def test_withdrawal_releases_only_physical_local_reserves(self):
        self.lab.deposit("alice", "greyhaven", "deposit", 250)
        receipt = self.lab.withdraw("alice", "greyhaven", "withdraw", 100)
        self.assertEqual(receipt.vault_reserve_after, 250)
        self.assertEqual(self.lab.carried_gold("alice"), 250)
        self.assertEqual(self.lab.at_town_balance("alice", "greyhaven"), 150)
        self.lab.assert_invariants()

    def test_remote_bank_cannot_access_greyhaven_account(self):
        self.lab.deposit("alice", "greyhaven", "deposit", 250)
        self.lab.travel_fixture("alice", "redlion")
        with self.assertRaises(BankDenied):
            self.lab.at_town_balance("alice", "greyhaven")
        with self.assertRaises(BankDenied):
            self.lab.withdraw("alice", "greyhaven", "remote-withdraw", 100)
        with self.assertRaises(BankDenied):
            self.lab.withdraw("alice", "redlion", "wrong-town-account", 100)
        self.assertEqual(self.lab.town_state("greyhaven")["deposit_liabilities"], 250)

    def test_separate_accounts_in_each_town_with_no_global_bank_transfer(self):
        self.lab.deposit("alice", "greyhaven", "deposit", 200)
        self.lab.travel_fixture("alice", "redlion")
        self.lab.deposit("alice", "redlion", "deposit", 60)
        self.assertEqual(self.lab.at_town_balance("alice", "redlion"), 60)
        self.lab.travel_fixture("alice", "greyhaven")
        self.assertEqual(self.lab.at_town_balance("alice", "greyhaven"), 200)
        self.assertEqual(self.lab.town_state("greyhaven")["deposit_liabilities"], 200)
        self.assertEqual(self.lab.town_state("redlion")["deposit_liabilities"], 60)

    def test_operation_ids_are_independent_per_town(self):
        self.lab.deposit("alice", "greyhaven", "shared-op", 50)
        self.lab.travel_fixture("alice", "redlion")
        self.lab.deposit("alice", "redlion", "shared-op", 50)
        self.assertEqual(self.lab.town_state("greyhaven")["local_sequence"], 1)
        self.assertEqual(self.lab.town_state("redlion")["local_sequence"], 1)

    def test_same_deposit_retry_returns_immutable_receipt_once(self):
        receipt = self.lab.deposit("alice", "greyhaven", "op1", 100)
        self.assertEqual(self.lab.deposit("alice", "greyhaven", "op1", 100), receipt)
        self.assertEqual(self.lab.town_state("greyhaven")["local_sequence"], 1)
        self.assertEqual(self.lab.total_physical_gold(), self.original_supply)

    def test_operation_id_with_changed_amount_is_rejected(self):
        self.lab.deposit("alice", "greyhaven", "op1", 100)
        with self.assertRaises(BankDenied):
            self.lab.deposit("alice", "greyhaven", "op1", 101)
        self.assertEqual(self.lab.at_town_balance("alice", "greyhaven"), 100)

    def test_operation_id_with_different_kind_is_rejected(self):
        self.lab.deposit("alice", "greyhaven", "op1", 100)
        with self.assertRaises(BankDenied):
            self.lab.withdraw("alice", "greyhaven", "op1", 100)

    def test_replay_requires_same_physical_town(self):
        self.lab.deposit("alice", "greyhaven", "op1", 100)
        self.lab.travel_fixture("alice", "redlion")
        with self.assertRaises(BankDenied):
            self.lab.deposit("alice", "greyhaven", "op1", 100)

    def test_overdraft_and_unfunded_deposit_do_not_mutate_gold(self):
        before = self.lab.total_physical_gold()
        for method in (self.lab.deposit, self.lab.withdraw):
            with self.assertRaises(BankDenied):
                method("alice", "greyhaven", "too-much", 800)
        self.assertEqual(self.lab.town_state("greyhaven")["local_sequence"], 0)
        self.assertEqual(self.lab.total_physical_gold(), before)

    def test_robbery_requires_matching_vault_and_fixture_guards(self):
        bad = (
            self.proof(vault="redlion-vault"),
            self.proof(town="redlion"),
            self.proof(actor="alice"),
            self.proof(open_=False),
            self.proof(guards=False),
            self.proof(epoch=0),
            self.proof(event=""),
        )
        for proof in bad:
            with self.subTest(proof=proof):
                with self.assertRaises(BankDenied):
                    self.lab.robbery_fixture("robber", "greyhaven", "raid", proof)
        self.assertEqual(self.lab.town_state("greyhaven")["reserve_gold"], 100)
        self.assertEqual(self.lab.town_events("greyhaven"), ())

    def test_robbery_moves_actual_vault_gold_and_emits_town_alarm_event(self):
        receipt = self.lab.robbery_fixture(
            "robber", "greyhaven", "raid", self.proof(gold=70)
        )
        self.assertEqual(receipt.vault_reserve_after, 30)
        self.assertEqual(self.lab.carried_gold("robber"), 70)
        event, = self.lab.town_events("greyhaven")
        self.assertEqual((event.operation, event.world_event_id), ("robbery", "vault-break-1"))
        self.assertEqual(self.lab.town_events("redlion"), ())
        self.assertEqual(self.lab.total_physical_gold(), self.original_supply)

    def test_robbery_never_erases_customer_deposit_liabilities(self):
        self.lab.deposit("alice", "greyhaven", "deposit", 300)
        before = self.lab.at_town_balance("alice", "greyhaven")
        stolen = self.lab.robbery_fixture(
            "robber", "greyhaven", "raid", self.proof(gold=150)
        )
        self.assertEqual(before, 300)
        self.assertEqual(self.lab.at_town_balance("alice", "greyhaven"), 300)
        self.assertEqual(stolen.vault_reserve_after, 250)
        self.assertTrue(stolen.bank_insolvent)
        self.assertEqual(self.lab.town_state("greyhaven")["equity"], -50)
        self.assertEqual(self.lab.total_physical_gold(), self.original_supply)

    def test_insolvent_bank_freezes_new_deposit_and_withdrawal(self):
        self.lab.deposit("alice", "greyhaven", "deposit", 300)
        self.lab.robbery_fixture("robber", "greyhaven", "raid", self.proof(gold=150))
        for method in (self.lab.deposit, self.lab.withdraw):
            with self.assertRaises(BankDenied):
                method("alice", "greyhaven", "another", 20)
        self.assertEqual(self.lab.town_state("greyhaven")["local_sequence"], 2)
        self.assertEqual(self.lab.at_town_balance("alice", "greyhaven"), 300)

    def test_robbery_below_bank_equity_leaves_bank_solvent(self):
        self.lab.deposit("alice", "greyhaven", "deposit", 300)
        receipt = self.lab.robbery_fixture(
            "robber", "greyhaven", "raid", self.proof(gold=40)
        )
        self.assertFalse(receipt.bank_insolvent)
        self.assertEqual(self.lab.town_state("greyhaven")["equity"], 60)

    def test_world_event_one_shot_cannot_steal_twice_with_new_operation(self):
        proof = self.proof(gold=40)
        first = self.lab.robbery_fixture("robber", "greyhaven", "raid1", proof)
        self.assertEqual(self.lab.robbery_fixture("robber", "greyhaven", "raid1", proof), first)
        with self.assertRaises(BankDenied):
            self.lab.robbery_fixture("robber", "greyhaven", "raid2", proof)
        self.assertEqual(self.lab.carried_gold("robber"), 40)
        self.assertEqual(self.lab.town_state("greyhaven")["local_sequence"], 1)

    def test_world_event_id_may_not_be_reused_in_a_different_town(self):
        self.lab.robbery_fixture("robber", "greyhaven", "raid1", self.proof(gold=10))
        self.lab.travel_fixture("robber", "redlion")
        with self.assertRaises(BankDenied):
            self.lab.robbery_fixture(
                "robber", "redlion", "raid2",
                self.proof(town="redlion", gold=10, event="vault-break-1"),
            )
        self.assertEqual(self.lab.town_state("redlion")["reserve_gold"], 30)

    def test_cannot_steal_more_than_vault_contains(self):
        with self.assertRaises(BankDenied):
            self.lab.robbery_fixture("robber", "greyhaven", "raid", self.proof(gold=101))
        self.assertEqual(self.lab.carried_gold("robber"), 0)

    def test_cannot_overfill_carried_gold_limit_on_withdrawal(self):
        # A bank claimant may acquire physical gold after their deposit;
        # withdrawing the old claim must not bypass item-weight capacity.
        lab = LocalTownBanksLab(
            {"greyhaven": 500}, {"alice": 95},
            {"alice": "greyhaven"}, carry_limit=100,
        )
        lab.deposit("alice", "greyhaven", "initial", 90)
        self.assertEqual(lab.carried_gold("alice"), 5)
        breach = VaultBreachFixture(
            event_id="test-physical-raid", town="greyhaven",
            vault_id="greyhaven-vault", actor="alice", stolen_gold=60,
            vault_open=True, guards_overcome=True, zone_epoch=3,
        )
        lab.robbery_fixture("alice", "greyhaven", "raid", breach)
        self.assertEqual(lab.carried_gold("alice"), 65)
        before = lab.town_state("greyhaven")
        with self.assertRaises(BankDenied):
            lab.withdraw("alice", "greyhaven", "too-heavy", 90)
        self.assertEqual(lab.town_state("greyhaven"), before)
        self.assertEqual(lab.at_town_balance("alice", "greyhaven"), 90)
        lab.assert_invariants()

    def test_cannot_overfill_carried_gold_limit_on_robbery(self):
        lab = LocalTownBanksLab(
            {"greyhaven": 100}, {"robber": 90},
            {"robber": "greyhaven"}, carry_limit=100,
        )
        proof = self.proof(gold=15)
        with self.assertRaises(BankDenied):
            lab.robbery_fixture("robber", "greyhaven", "raid", proof)
        self.assertEqual(lab.carried_gold("robber"), 90)
        self.assertEqual(lab.town_state("greyhaven")["reserve_gold"], 100)

    def test_invalid_amount_types_are_denied(self):
        for amount in (0, -2, True, 2.5, 2**63):
            with self.subTest(amount=amount):
                with self.assertRaises(BankDenied):
                    self.lab.deposit("alice", "greyhaven", "bad", amount)
        self.assertEqual(self.lab.town_state("greyhaven")["local_sequence"], 0)

    def test_invalid_fixture_actor_and_town_are_denied(self):
        with self.assertRaises(BankDenied):
            self.lab.deposit("unknown", "greyhaven", "bad", 1)
        with self.assertRaises(BankDenied):
            self.lab.deposit("alice", "unknown", "bad", 1)
        with self.assertRaises(BankDenied):
            self.lab.travel_fixture("unknown", "redlion")

    def test_town_has_independent_sequence_and_audit_events(self):
        self.lab.deposit("alice", "greyhaven", "a", 50)
        self.lab.deposit("alice", "greyhaven", "b", 50)
        self.lab.deposit("charlie", "redlion", "c", 10)
        self.assertEqual([e.local_sequence for e in self.lab.town_events("greyhaven")], [1, 2])
        self.assertEqual([e.local_sequence for e in self.lab.town_events("redlion")], [1])

    def test_two_contenders_cannot_double_withdraw_one_local_deposit(self):
        self.lab.deposit("alice", "greyhaven", "fund", 250)
        def attempt(op):
            try:
                return self.lab.withdraw("alice", "greyhaven", op, 200)
            except BankDenied:
                return None
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(attempt, ("withdraw-a", "withdraw-b")))
        self.assertEqual(sum(r is not None for r in results), 1)
        self.assertEqual(self.lab.at_town_balance("alice", "greyhaven"), 50)
        self.assertEqual(self.lab.town_state("greyhaven")["local_sequence"], 2)
        self.lab.assert_invariants()

    def test_public_world_breach_fixture_is_forgeable_not_real_authority(self):
        # A Python caller can fabricate the "guards overcome" evidence.
        # This MUST NEVER be wired to player WebTransport or a production bank.
        forged = VaultBreachFixture(
            event_id="not-really-world-authoritative", town="greyhaven",
            vault_id="greyhaven-vault", actor="robber", stolen_gold=10,
            vault_open=True, guards_overcome=True, zone_epoch=99,
        )
        self.assertEqual(
            self.lab.robbery_fixture("robber", "greyhaven", "fake-op", forged).gold,
            10,
        )

    def test_fixture_rejects_bad_starting_capital_and_weight(self):
        for cap in (-1, True, 2**63):
            with self.subTest(cap=cap):
                with self.assertRaises(BankDenied):
                    LocalTownBanksLab({"greyhaven": cap}, {"alice": 1}, {"alice": "greyhaven"})
        with self.assertRaises(BankDenied):
            LocalTownBanksLab({"greyhaven": 0}, {"alice": 1001},
                              {"alice": "greyhaven"})

    def test_successful_actions_preserve_gold_supply_and_solvency_math(self):
        self.lab.deposit("alice", "greyhaven", "a", 200)
        self.lab.deposit("bob", "greyhaven", "b", 80)
        self.lab.withdraw("bob", "greyhaven", "c", 30)
        self.lab.robbery_fixture("robber", "greyhaven", "d", self.proof(gold=90))
        self.assertEqual(self.lab.total_physical_gold(), self.original_supply)
        self.lab.assert_invariants()
        bank = self.lab.town_state("greyhaven")
        self.assertEqual(bank["equity"],
                         bank["reserve_gold"] - bank["deposit_liabilities"])


    def test_two_competing_robbers_cannot_overdraw_same_vault(self):
        lab = LocalTownBanksLab(
            {"greyhaven": 100},
            {"thief_a": 0, "thief_b": 0},
            {"thief_a": "greyhaven", "thief_b": "greyhaven"},
            carry_limit=100,
        )
        def attempt(name):
            evidence = VaultBreachFixture(
                event_id="raid-" + name, town="greyhaven",
                vault_id="greyhaven-vault", actor=name, stolen_gold=70,
                vault_open=True, guards_overcome=True, zone_epoch=1,
            )
            try:
                return lab.robbery_fixture(name, "greyhaven", "op-" + name, evidence)
            except BankDenied:
                return None
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(attempt, ("thief_a", "thief_b")))
        self.assertEqual(sum(x is not None for x in results), 1)
        self.assertEqual(lab.town_state("greyhaven")["reserve_gold"], 30)
        self.assertEqual(lab.carried_gold("thief_a") + lab.carried_gold("thief_b"), 70)
        self.assertEqual(len(lab.town_events("greyhaven")), 1)
        lab.assert_invariants()

    def test_competing_same_event_cannot_commit_twice(self):
        lab = LocalTownBanksLab(
            {"greyhaven": 100}, {"robber": 0}, {"robber": "greyhaven"},
        )
        evidence = self.proof(gold=70)
        def attempt(op):
            try:
                return lab.robbery_fixture("robber", "greyhaven", op, evidence)
            except BankDenied:
                return None
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(attempt, ("op1", "op2")))
        self.assertEqual(sum(x is not None for x in results), 1)
        self.assertEqual(lab.town_state("greyhaven")["reserve_gold"], 30)
        self.assertEqual(lab.carried_gold("robber"), 70)
        lab.assert_invariants()

    def test_competing_same_operation_with_different_actors_is_conflict(self):
        lab = LocalTownBanksLab(
            {"greyhaven": 100},
            {"thief_a": 0, "thief_b": 0},
            {"thief_a": "greyhaven", "thief_b": "greyhaven"},
        )
        def attempt(name):
            proof = VaultBreachFixture(
                event_id="event-" + name, town="greyhaven",
                vault_id="greyhaven-vault", actor=name, stolen_gold=30,
                vault_open=True, guards_overcome=True, zone_epoch=1,
            )
            try:
                return lab.robbery_fixture(name, "greyhaven", "same-op", proof)
            except BankDenied:
                return None
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(attempt, ("thief_a", "thief_b")))
        self.assertEqual(sum(x is not None for x in results), 1)
        self.assertEqual(lab.town_state("greyhaven")["reserve_gold"], 70)
        self.assertEqual(len(lab.town_events("greyhaven")), 1)
        lab.assert_invariants()

    def test_concurrent_deposit_and_raid_preserve_local_claim_and_gold(self):
        lab = LocalTownBanksLab(
            {"greyhaven": 100},
            {"alice": 30, "robber": 0},
            {"alice": "greyhaven", "robber": "greyhaven"},
        )
        proof = self.proof(gold=90)
        with ThreadPoolExecutor(max_workers=2) as pool:
            f_deposit = pool.submit(lab.deposit, "alice", "greyhaven", "deposit", 30)
            f_raid = pool.submit(lab.robbery_fixture, "robber", "greyhaven", "raid", proof)
            self.assertEqual(f_deposit.result().gold, 30)
            self.assertEqual(f_raid.result().gold, 90)
        self.assertEqual(lab.town_state("greyhaven")["reserve_gold"], 40)
        self.assertEqual(lab.at_town_balance("alice", "greyhaven"), 30)
        self.assertEqual(lab.carried_gold("robber"), 90)
        self.assertEqual(lab.carried_gold("alice"), 0)
        lab.assert_invariants()

    def test_truthy_non_boolean_guard_and_vault_flags_rejected(self):
        for name in ("vault_open", "guards_overcome"):
            for value in (1, "yes", object(), [], None):
                with self.subTest(flag=name, val=repr(value)):
                    fake = replace(self.proof(gold=10), **{name: value})
                    with self.assertRaises(BankDenied):
                        self.lab.robbery_fixture("robber", "greyhaven", "raid", fake)
        self.assertEqual(self.lab.town_state("greyhaven")["local_sequence"], 0)
        self.assertEqual(self.lab.carried_gold("robber"), 0)

    def test_malformed_or_overflowing_world_epoch_rejected(self):
        for epoch in (0, -1, True, "3", 2**63):
            with self.subTest(epoch=epoch):
                with self.assertRaises(BankDenied):
                    self.lab.robbery_fixture(
                        "robber", "greyhaven", "raid", self.proof(epoch=epoch),
                    )
        self.assertEqual(self.lab.town_state("greyhaven")["reserve_gold"], 100)

    def test_vault_signed_63_overflow_deposit_is_denied_without_receipt(self):
        bank = LocalTownBanksLab(
            {"greyhaven": 2**63 - 2},
            {"alice": 5},
            {"alice": "greyhaven"},
            carry_limit=5,
        )
        before = bank.town_state("greyhaven")
        with self.assertRaises(BankDenied):
            bank.deposit("alice", "greyhaven", "overflow", 3)
        self.assertEqual(bank.town_state("greyhaven"), before)
        self.assertEqual(bank.carried_gold("alice"), 5)
        self.assertEqual(bank.town_events("greyhaven"), ())
        bank.assert_invariants()

    def test_oversized_physical_gold_weight_capacity_rejected(self):
        with self.assertRaises(BankDenied):
            LocalTownBanksLab(
                {"greyhaven": 1}, {"alice": 1},
                {"alice": "greyhaven"}, carry_limit=2**63,
            )

    def test_denied_overweight_raid_does_not_spend_world_event(self):
        lab = LocalTownBanksLab(
            {"greyhaven": 100}, {"robber": 90},
            {"robber": "greyhaven"}, carry_limit=100,
        )
        proof = self.proof(gold=15)
        with self.assertRaises(BankDenied):
            lab.robbery_fixture("robber", "greyhaven", "raid", proof)
        self.assertEqual(lab.town_state("greyhaven")["local_sequence"], 0)
        lab.deposit("robber", "greyhaven", "free-hands", 20)
        receipt = lab.robbery_fixture("robber", "greyhaven", "raid", proof)
        self.assertEqual(receipt.carried_gold_after, 85)
        self.assertEqual(lab.town_state("greyhaven")["reserve_gold"], 105)
        self.assertEqual(len(lab.town_events("greyhaven")), 2)
        lab.assert_invariants()


if __name__ == "__main__":
    unittest.main()
