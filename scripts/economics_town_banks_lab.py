"""P2 myaso.io LOCAL TOWN BANKS — purely offline fictional reference model.

No game server imports this. No money, token, account, world proof or security
exists here. All test actors and vault-breach receipts are constructible. The
Core/World/Items departments must own actual admission and physical outcomes.
"""
from __future__ import annotations

from dataclasses import dataclass, replace
from threading import RLock
import re


_ID = re.compile(r"[a-z][a-z0-9_-]{0,47}\Z")
_OP = re.compile(r"[A-Za-z0-9_-]{1,64}\Z")


class BankDenied(Exception):
    """A test request failed before changing any modeled assets."""


@dataclass(frozen=True)
class _Bank:
    town: str
    vault_id: str
    reserve_gold: int
    accounts: tuple[tuple[str, int], ...] = ()
    sequence: int = 0

    @property
    def deposit_liability(self) -> int:
        return sum(gold for _, gold in self.accounts)

    @property
    def equity(self) -> int:
        return self.reserve_gold - self.deposit_liability

    @property
    def insolvent(self) -> bool:
        return self.equity < 0


@dataclass(frozen=True)
class _Actor:
    town: str
    carried_gold: int


@dataclass(frozen=True)
class VaultBreachFixture:
    """PUBLICLY FORGEABLE fake World evidence; never real robbery authority."""

    event_id: str
    town: str
    vault_id: str
    actor: str
    stolen_gold: int
    vault_open: bool
    guards_overcome: bool
    zone_epoch: int


@dataclass(frozen=True)
class BankEvent:
    town: str
    local_sequence: int
    operation: str
    actor: str
    gold: int
    world_event_id: str | None = None


@dataclass(frozen=True)
class BankReceipt:
    town: str
    local_sequence: int
    operation_id: str
    operation: str
    actor: str
    gold: int
    vault_reserve_after: int
    deposit_liability_after: int
    carried_gold_after: int
    bank_insolvent: bool


class LocalTownBanksLab:
    """Thread-safe, MEMORY-ONLY accounts and physical gold for fictional towns.

    This is NOT crash-consistent or Byzantine-secure. A Python caller can
    fabricate bank travel, admission and vault breach; do not expose to users.
    Physical conserved units are modeled for an offline game-design invariant.
    """

    def __init__(
        self,
        town_capital: dict[str, int],
        actor_gold: dict[str, int],
        actor_towns: dict[str, str],
        *,
        carry_limit: int = 1000,
    ):
        if (
            type(carry_limit) is not int or carry_limit <= 0
            or not isinstance(town_capital, dict) or not town_capital
            or not isinstance(actor_gold, dict) or not actor_gold
            or set(actor_gold) != set(actor_towns)
        ):
            raise BankDenied("Malformed fictional bank fixture")
        self._lock = RLock()
        self._carry_limit = carry_limit
        self._banks: dict[str, _Bank] = {}
        self._actors: dict[str, _Actor] = {}
        for town, capital in town_capital.items():
            if not _valid_id(town) or not _nonnegative(capital):
                raise BankDenied("Invalid town or founding physical vault gold")
            self._banks[town] = _Bank(town=town, vault_id=f"{town}-vault", reserve_gold=capital)
        for actor, carried in actor_gold.items():
            town = actor_towns[actor]
            if (
                not _valid_id(actor) or not _nonnegative(carried)
                or carried > carry_limit or town not in self._banks
            ):
                raise BankDenied("Invalid test actor, location or gold weight limit")
            self._actors[actor] = _Actor(town=town, carried_gold=carried)
        self._initial_gold = self.total_physical_gold()
        self._receipts: dict[tuple[str, str], tuple[tuple, BankReceipt]] = {}
        self._spent_world_events: set[str] = set()
        self._events: dict[str, tuple[BankEvent, ...]] = {town: () for town in self._banks}

    def total_physical_gold(self) -> int:
        with self._lock:
            return (
                sum(bank.reserve_gold for bank in self._banks.values())
                + sum(actor.carried_gold for actor in self._actors.values())
            )

    def town_state(self, town: str) -> dict:
        with self._lock:
            bank = self._get_bank(town)
            return {
                "town": bank.town,
                "operator": "town_npc",  # No player-owned deposit bank.
                "vault_id": bank.vault_id,
                "reserve_gold": bank.reserve_gold,
                "deposit_liabilities": bank.deposit_liability,
                "equity": bank.equity,
                "insolvent": bank.insolvent,
                "local_sequence": bank.sequence,
            }

    def at_town_balance(self, actor: str, town: str) -> int:
        """A simulated banker discloses only this visitor's local balance."""
        with self._lock:
            bank, _ = self._admit_location(actor, town)
            return dict(bank.accounts).get(actor, 0)

    def carried_gold(self, actor: str) -> int:
        with self._lock:
            return self._get_actor(actor).carried_gold

    def travel_fixture(self, actor: str, destination: str) -> None:
        """Test harness movement, NOT a server-verified/world travel action."""
        with self._lock:
            person = self._get_actor(actor)
            self._get_bank(destination)
            self._actors[actor] = replace(person, town=destination)

    def deposit(self, actor: str, town: str, operation_id: str, gold: int) -> BankReceipt:
        return self._transact("deposit", actor, town, operation_id, gold)

    def withdraw(self, actor: str, town: str, operation_id: str, gold: int) -> BankReceipt:
        return self._transact("withdraw", actor, town, operation_id, gold)

    def robbery_fixture(
        self, actor: str, town: str, operation_id: str, evidence: VaultBreachFixture
    ) -> BankReceipt:
        """Offline-only consequence of a *mock* physical World vault breach."""
        if not isinstance(evidence, VaultBreachFixture):
            raise BankDenied("No vault event supplied")
        return self._transact("robbery", actor, town, operation_id, evidence.stolen_gold, evidence)

    def town_events(self, town: str) -> tuple[BankEvent, ...]:
        with self._lock:
            self._get_bank(town)
            return self._events[town]

    def _transact(
        self, kind: str, actor: str, town: str, operation_id: str, gold: int,
        evidence: VaultBreachFixture | None = None,
    ) -> BankReceipt:
        if not _valid_op(operation_id) or not _positive(gold):
            raise BankDenied("Invalid immutable operation or gold amount")
        with self._lock:
            bank, person = self._admit_location(actor, town)
            intent = (kind, actor, town, gold, evidence)
            key = (town, operation_id)
            previous = self._receipts.get(key)
            if previous is not None:
                if previous[0] != intent:
                    raise BankDenied("Same operation ID, different request")
                # Even idempotent replay must still be physically local.
                return previous[1]
            accounts = dict(bank.accounts)
            current_balance = accounts.get(actor, 0)
            new_reserve = bank.reserve_gold
            new_carried = person.carried_gold
            new_balance = current_balance
            world_event_id = None

            if kind == "deposit":
                if bank.insolvent:
                    raise BankDenied("Insolvent town bank cannot accept fresh deposits")
                if new_carried < gold:
                    raise BankDenied("Insufficient physically carried gold")
                new_carried -= gold
                new_reserve += gold
                new_balance += gold
            elif kind == "withdraw":
                if bank.insolvent:
                    raise BankDenied("Insolvent bank: withdrawal recovery requires town policy")
                if current_balance < gold or bank.reserve_gold < gold:
                    raise BankDenied("No local bank claim or insufficient physical reserve")
                new_carried += gold
                new_reserve -= gold
                new_balance -= gold
            elif kind == "robbery":
                if (
                    evidence is None or not isinstance(evidence, VaultBreachFixture)
                    or evidence.actor != actor or evidence.town != town
                    or evidence.vault_id != bank.vault_id
                    or not evidence.vault_open or not evidence.guards_overcome
                    or type(evidence.zone_epoch) is not int or evidence.zone_epoch <= 0
                    or not _valid_op(evidence.event_id)
                    or evidence.event_id in self._spent_world_events
                ):
                    raise BankDenied("Vault guards, location, epoch or one-shot World event absent")
                if bank.reserve_gold < gold:
                    raise BankDenied("Cannot steal more physical gold than exists")
                new_reserve -= gold
                new_carried += gold
                world_event_id = evidence.event_id
                # A robbery drains the vault; customers' legal claims remain.
                # Do NOT erase balances as a side effect of a raid.
            else:
                raise BankDenied("Unknown fictional bank operation")
            if new_carried > self._carry_limit:
                raise BankDenied("Carried gold exceeds simulated physical weight limit")
            if new_reserve < 0 or new_carried < 0 or new_balance < 0:
                raise BankDenied("Negative physical asset or customer claim")

            if kind != "robbery":
                if new_balance:
                    accounts[actor] = new_balance
                else:
                    accounts.pop(actor, None)
            updated = replace(
                bank,
                reserve_gold=new_reserve,
                accounts=tuple(sorted(accounts.items())),
                sequence=bank.sequence + 1,
            )
            receipt = BankReceipt(
                town=town, local_sequence=updated.sequence,
                operation_id=operation_id, operation=kind, actor=actor,
                gold=gold, vault_reserve_after=new_reserve,
                deposit_liability_after=updated.deposit_liability,
                carried_gold_after=new_carried, bank_insolvent=updated.insolvent,
            )
            event = BankEvent(
                town=town, local_sequence=updated.sequence, operation=kind,
                actor=actor, gold=gold, world_event_id=world_event_id,
            )
            # All validation precedes this synchronized in-memory commit.
            self._banks[town] = updated
            self._actors[actor] = replace(person, carried_gold=new_carried)
            self._receipts[key] = (intent, receipt)
            self._events[town] = self._events[town] + (event,)
            if world_event_id is not None:
                self._spent_world_events.add(world_event_id)
            self.assert_invariants()
            return receipt

    def assert_invariants(self) -> None:
        with self._lock:
            if self.total_physical_gold() != self._initial_gold:
                raise AssertionError("Gold was created or destroyed during a bank operation")
            for town, bank in self._banks.items():
                if (
                    bank.town != town or bank.reserve_gold < 0
                    or any(gold < 0 or actor not in self._actors for actor, gold in bank.accounts)
                    or bank.accounts != tuple(sorted(bank.accounts))
                    or len(bank.accounts) != len(dict(bank.accounts))
                    or bank.sequence != len(self._events[town])
                    or any(event.local_sequence != i+1 for i, event in enumerate(self._events[town]))
                ):
                    raise AssertionError("Broken independent local bank ledger")
            for actor in self._actors.values():
                if actor.carried_gold < 0 or actor.carried_gold > self._carry_limit:
                    raise AssertionError("Broken gold carrying constraints")

    def _get_bank(self, town: str) -> _Bank:
        if town not in self._banks:
            raise BankDenied("Unknown local bank")
        return self._banks[town]

    def _get_actor(self, actor: str) -> _Actor:
        if actor not in self._actors:
            raise BankDenied("Unknown fictional test actor")
        return self._actors[actor]

    def _admit_location(self, actor: str, town: str) -> tuple[_Bank, _Actor]:
        bank = self._get_bank(town)
        person = self._get_actor(actor)
        if person.town != town:
            raise BankDenied("Only physically local visitors may use this bank")
        return bank, person


def _valid_id(value: object) -> bool:
    return type(value) is str and _ID.fullmatch(value) is not None


def _valid_op(value: object) -> bool:
    return type(value) is str and _OP.fullmatch(value) is not None


def _nonnegative(value: object) -> bool:
    return type(value) is int and 0 <= value < 2**63


def _positive(value: object) -> bool:
    return _nonnegative(value) and value > 0
