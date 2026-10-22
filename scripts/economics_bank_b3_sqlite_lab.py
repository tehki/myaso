"""B3 disposable SQLite town-bank settlement acceptance laboratory.

TEST ONLY. This is neither a Core/World authority verifier nor player currency.
A caller can forge the fixture raid outcome. Never import into shipping game.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from contextlib import contextmanager
import json
import os
import re
import sqlite3

MAX = 2**63 - 1
ID = re.compile(r"[a-z][a-z0-9_-]{0,47}\Z")
OP = re.compile(r"[A-Za-z0-9_-]{1,64}\Z")
EVENT = re.compile(r"[0-9a-f]{32}\Z")
FILE_ENDING = ".b3test.sqlite3"
TEST_ENV = "MYASO_BANK_B3_TEST_ONLY"


class FixtureBankDenied(RuntimeError):
    pass


class UnknownCommitOutcome(RuntimeError):
    """Simulates losing an ACK after a successfully committed transaction."""


@dataclass(frozen=True)
class FixtureRaidOutcome:
    """Publicly forgeable: NOT World/Items authorization or server identity."""

    event_id: str
    town: str
    actor: str
    vault_id: str
    amount: int
    vault_open: bool
    guards_overcome: bool
    authority_epoch: int


@dataclass(frozen=True)
class FixtureReceipt:
    town: str
    operation_id: str
    operation: str
    actor: str
    gold: int
    sequence: int
    vault_reserve_after: int
    deposit_liabilities_after: int
    player_gold_after: int
    insolvent: bool


def _int(value: object, *, positive: bool = False) -> bool:
    return type(value) is int and (0 < value <= MAX if positive else 0 <= value <= MAX)


def _id(value: object) -> bool:
    return type(value) is str and ID.fullmatch(value) is not None


def _op(value: object) -> bool:
    return type(value) is str and OP.fullmatch(value) is not None


class FixtureSqliteTownBanks:
    """Offline, path-guarded SQLite ACID lab. Test fixture roles are forgeable."""

    def __init__(self, path: Path, *, carry_limit: int = 1000):
        if os.environ.get(TEST_ENV) != "1":
            raise FixtureBankDenied("Disposable B3 test-only gate is not enabled")
        if not isinstance(path, Path) or not path.name.endswith(FILE_ENDING):
            raise FixtureBankDenied("Refuse any non-disposable SQLite path")
        if path.is_symlink() or not path.parent.is_dir() or not _int(carry_limit, positive=True):
            raise FixtureBankDenied("Invalid test DB destination or capacity")
        self.path = path.resolve()
        self.carry_limit = carry_limit

    @contextmanager
    def _db(self):
        con = sqlite3.connect(self.path, timeout=10, isolation_level=None)
        try:
            con.execute("PRAGMA busy_timeout=10000")
            con.execute("PRAGMA foreign_keys=ON")
            con.execute("PRAGMA journal_mode=WAL")
            con.execute("PRAGMA synchronous=FULL")
            yield con
        finally:
            con.close()

    def initialize_fixture(
        self, capital: dict[str, int], carried: dict[str, int], locations: dict[str, str]
    ) -> None:
        """One-time mock seed. NEVER a production database migration."""
        if (type(capital) is not dict or not capital or type(carried) is not dict
                or not carried or type(locations) is not dict
                or set(carried) != set(locations)):
            raise FixtureBankDenied("Invalid bank seed")
        for town, value in capital.items():
            if not _id(town) or not _int(value):
                raise FixtureBankDenied("Invalid town seed")
        for actor, value in carried.items():
            if (not _id(actor) or not _int(value) or value > self.carry_limit
                    or locations[actor] not in capital):
                raise FixtureBankDenied("Invalid actor seed")
        physical_total = sum(capital.values()) + sum(carried.values())
        if physical_total > MAX:
            raise FixtureBankDenied("Combined initial gold exceeds bounded supply")
        with self._db() as con:
            try:
                con.execute("BEGIN IMMEDIATE")
                con.executescript("""
                    CREATE TABLE IF NOT EXISTS meta (
                      id INTEGER PRIMARY KEY CHECK(id=1),
                      supply INTEGER NOT NULL CHECK(supply>=0)
                    );
                    CREATE TABLE IF NOT EXISTS banks (
                      town TEXT PRIMARY KEY,
                      vault_id TEXT NOT NULL UNIQUE,
                      reserve INTEGER NOT NULL CHECK(reserve>=0),
                      sequence INTEGER NOT NULL DEFAULT 0 CHECK(sequence>=0)
                    );
                    CREATE TABLE IF NOT EXISTS actors (
                      actor TEXT PRIMARY KEY,
                      town TEXT NOT NULL REFERENCES banks(town),
                      carried INTEGER NOT NULL CHECK(carried>=0)
                    );
                    CREATE TABLE IF NOT EXISTS claims (
                      town TEXT NOT NULL REFERENCES banks(town),
                      actor TEXT NOT NULL REFERENCES actors(actor),
                      balance INTEGER NOT NULL CHECK(balance>=0),
                      PRIMARY KEY(town,actor)
                    );
                    CREATE TABLE IF NOT EXISTS receipts (
                      town TEXT NOT NULL REFERENCES banks(town),
                      op TEXT NOT NULL,
                      intent TEXT NOT NULL,
                      receipt TEXT NOT NULL,
                      PRIMARY KEY(town,op)
                    );
                    CREATE TABLE IF NOT EXISTS events (
                      town TEXT NOT NULL REFERENCES banks(town),
                      sequence INTEGER NOT NULL,
                      kind TEXT NOT NULL CHECK(kind IN ('deposit','withdraw','robbery')),
                      actor TEXT NOT NULL REFERENCES actors(actor),
                      amount INTEGER NOT NULL CHECK(amount>0),
                      world_event TEXT UNIQUE,
                      PRIMARY KEY(town,sequence)
                    );
                """)
                # executescript commits implicitly in SQLite; transaction must
                # be explicitly reacquired before any seeded rows are written.
                con.execute("BEGIN IMMEDIATE")
                if con.execute("SELECT COUNT(*) FROM meta").fetchone()[0] != 0:
                    raise FixtureBankDenied("Refuse second initialization or reset")
                con.execute("INSERT INTO meta VALUES(1,?)", (physical_total,))
                for town, amount in sorted(capital.items()):
                    con.execute("INSERT INTO banks(town,vault_id,reserve) VALUES(?,?,?)",
                                (town, f"{town}-vault", amount))
                for actor, amount in sorted(carried.items()):
                    con.execute("INSERT INTO actors VALUES(?,?,?)",
                                (actor, locations[actor], amount))
                con.commit()
            except BaseException:
                con.rollback()
                raise

    def travel_fixture(self, actor: str, town: str) -> None:
        """Test-only mocked travel: no authentic World position proof."""
        with self._db() as con:
            try:
                con.execute("BEGIN IMMEDIATE")
                if (con.execute("SELECT 1 FROM actors WHERE actor=?", (actor,)).fetchone() is None
                    or con.execute("SELECT 1 FROM banks WHERE town=?", (town,)).fetchone() is None):
                    raise FixtureBankDenied("Unknown actor or town")
                con.execute("UPDATE actors SET town=? WHERE actor=?", (town, actor))
                con.commit()
            except BaseException:
                con.rollback()
                raise

    def deposit(self, town: str, actor: str, op: str, amount: int, *, fault: str | None = None):
        return self._settle("deposit", town, actor, op, amount, None, fault)

    def withdraw(self, town: str, actor: str, op: str, amount: int, *, fault: str | None = None):
        return self._settle("withdraw", town, actor, op, amount, None, fault)

    def robbery_fixture(
        self, town: str, actor: str, op: str, evidence: FixtureRaidOutcome,
        *, fault: str | None = None,
    ):
        if type(evidence) is not FixtureRaidOutcome:
            raise FixtureBankDenied("No test-only World fixture")
        return self._settle("robbery", town, actor, op, evidence.amount, evidence, fault)

    def _settle(self, kind, town, actor, op, amount, evidence, fault):
        if (not _id(town) or not _id(actor) or not _op(op)
                or not _int(amount, positive=True)):
            raise FixtureBankDenied("Invalid strict fictional intent")
        if fault not in (None, "after_balances", "after_event", "after_commit_unknown"):
            raise FixtureBankDenied("Unknown crash injection")
        intent = json.dumps(
            [kind, town, actor, amount, asdict(evidence) if evidence is not None else None],
            separators=(",", ":"), sort_keys=True,
        )
        with self._db() as con:
            committed = False
            try:
                con.execute("BEGIN IMMEDIATE")
                actor_row = con.execute(
                    "SELECT town,carried FROM actors WHERE actor=?", (actor,)
                ).fetchone()
                bank_row = con.execute(
                    "SELECT vault_id,reserve,sequence FROM banks WHERE town=?", (town,)
                ).fetchone()
                if actor_row is None or bank_row is None or actor_row[0] != town:
                    raise FixtureBankDenied("No physically local actor/bank")
                prev = con.execute(
                    "SELECT intent,receipt FROM receipts WHERE town=? AND op=?",
                    (town, op),
                ).fetchone()
                if prev:
                    if prev[0] != intent:
                        raise FixtureBankDenied("Conflicting immutable operation replay")
                    # A committed receipt can be replayed safely after an ACK
                    # loss, but never used to move any additional gold.
                    con.rollback()
                    return FixtureReceipt(**json.loads(prev[1]))
                vault_id, reserve, sequence = bank_row
                carried = actor_row[1]
                balance_row = con.execute(
                    "SELECT balance FROM claims WHERE town=? AND actor=?", (town, actor)
                ).fetchone()
                balance = balance_row[0] if balance_row else 0
                total_claims = con.execute(
                    "SELECT COALESCE(SUM(balance),0) FROM claims WHERE town=?", (town,)
                ).fetchone()[0]
                if not _int(total_claims):
                    raise FixtureBankDenied("Broken bounded liability total")
                if kind in ("deposit", "withdraw") and reserve < total_claims:
                    raise FixtureBankDenied("Insolvent bank is frozen")
                event_id = None
                next_balance = balance
                if kind == "deposit":
                    if carried < amount:
                        raise FixtureBankDenied("Actor lacks physical gold")
                    next_reserve, next_carried = reserve + amount, carried - amount
                    next_balance += amount
                elif kind == "withdraw":
                    if balance < amount or reserve < amount:
                        raise FixtureBankDenied("Missing local claim or physical reserves")
                    next_reserve, next_carried = reserve - amount, carried + amount
                    next_balance -= amount
                elif kind == "robbery":
                    if (evidence is None or evidence.town != town
                            or evidence.actor != actor or evidence.vault_id != vault_id
                            or type(evidence.vault_open) is not bool or not evidence.vault_open
                            or type(evidence.guards_overcome) is not bool
                            or not evidence.guards_overcome
                            or not _int(evidence.authority_epoch, positive=True)
                            or type(evidence.event_id) is not str
                            or EVENT.fullmatch(evidence.event_id) is None
                            or evidence.event_id == "0"*32):
                        raise FixtureBankDenied("Missing simulated World breach outcome")
                    if reserve < amount:
                        raise FixtureBankDenied("Vault cannot be overdrawn")
                    event_id = evidence.event_id
                    next_reserve, next_carried = reserve - amount, carried + amount
                else:
                    raise FixtureBankDenied("Unknown fixture operation")

                next_claims = total_claims + (next_balance - balance)
                if (not all(_int(v) for v in (
                        next_reserve, next_carried, next_balance, next_claims))
                        or next_carried > self.carry_limit or not _int(sequence+1)):
                    raise FixtureBankDenied("Overflow, negativity, or carrying capacity")
                if next_reserve+next_carried != reserve+carried:
                    raise FixtureBankDenied("Physical gold conservation violation")

                con.execute("UPDATE banks SET reserve=?, sequence=? WHERE town=?",
                            (next_reserve, sequence+1, town))
                con.execute("UPDATE actors SET carried=? WHERE actor=?", (next_carried, actor))
                if kind != "robbery":
                    if next_balance:
                        con.execute("""
                            INSERT INTO claims(town,actor,balance) VALUES(?,?,?)
                            ON CONFLICT(town,actor) DO UPDATE SET balance=excluded.balance
                        """, (town, actor, next_balance))
                    else:
                        con.execute("DELETE FROM claims WHERE town=? AND actor=?",
                                    (town, actor))
                if fault == "after_balances":
                    raise RuntimeError("Simulated process crash before committing balances")
                con.execute(
                    "INSERT INTO events(town,sequence,kind,actor,amount,world_event) VALUES(?,?,?,?,?,?)",
                    (town, sequence+1, kind, actor, amount, event_id),
                )
                if fault == "after_event":
                    raise RuntimeError("Simulated crash after journal, before COMMIT")
                receipt = FixtureReceipt(
                    town=town, operation_id=op, operation=kind, actor=actor,
                    gold=amount, sequence=sequence+1,
                    vault_reserve_after=next_reserve,
                    deposit_liabilities_after=next_claims,
                    player_gold_after=next_carried,
                    insolvent=next_reserve < next_claims,
                )
                con.execute(
                    "INSERT INTO receipts(town,op,intent,receipt) VALUES(?,?,?,?)",
                    (town, op, intent, json.dumps(asdict(receipt), sort_keys=True)),
                )
                # Assert global supply and local event/receipt consistency
                # BEFORE commit so any violation rolls back all writes.
                self._audit_in_transaction(con)
                con.commit()
                committed = True
                if fault == "after_commit_unknown":
                    raise UnknownCommitOutcome(
                        "Test-only ACK lost after durable SQLite COMMIT; retry exact op"
                    )
                return receipt
            except sqlite3.IntegrityError as exc:
                if not committed:
                    con.rollback()
                raise FixtureBankDenied("Conflicting event/op or invalid ledger") from exc
            except BaseException:
                if not committed:
                    con.rollback()
                raise

    @staticmethod
    def _audit_in_transaction(con):
        metadata = con.execute("SELECT supply FROM meta WHERE id=1").fetchone()
        if not metadata:
            raise FixtureBankDenied("Fixture supply metadata missing")
        totals = con.execute("SELECT COALESCE(SUM(reserve),0) FROM banks").fetchone()[0]
        carried = con.execute("SELECT COALESCE(SUM(carried),0) FROM actors").fetchone()[0]
        if not _int(totals) or not _int(carried) or totals+carried != metadata[0]:
            raise FixtureBankDenied("Physical supply diverged")
        for town, seq in con.execute("SELECT town,sequence FROM banks").fetchall():
            if con.execute("SELECT COUNT(*) FROM events WHERE town=?", (town,)).fetchone()[0] != seq:
                raise FixtureBankDenied("Journal event sequence diverged")
            if con.execute("SELECT COUNT(*) FROM receipts WHERE town=?", (town,)).fetchone()[0] != seq:
                raise FixtureBankDenied("Receipt sequence diverged")

    def audit(self):
        """Verify persisted disposable state after reopening/recovery."""
        with self._db() as con:
            self._audit_in_transaction(con)
            banks = {}
            for town, reserve, seq in con.execute(
                "SELECT town,reserve,sequence FROM banks ORDER BY town"
            ):
                liabilities = con.execute(
                    "SELECT COALESCE(SUM(balance),0) FROM claims WHERE town=?", (town,)
                ).fetchone()[0]
                banks[town] = {
                    "reserve": reserve, "liabilities": liabilities,
                    "insolvent": reserve < liabilities, "sequence": seq,
                }
            return {
                "banks": banks,
                "players": dict(con.execute(
                    "SELECT actor,carried FROM actors ORDER BY actor"
                ).fetchall()),
                "supply": con.execute("SELECT supply FROM meta WHERE id=1").fetchone()[0],
            }

    def balance_fixture(self, actor: str, town: str) -> int:
        """Test-only admin visibility; no account authentication."""
        with self._db() as con:
            row = con.execute(
                "SELECT balance FROM claims WHERE actor=? AND town=?", (actor, town)
            ).fetchone()
            return row[0] if row else 0
