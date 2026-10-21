"""E2h test-only database-side principal binding checks inside SQLite purchase.

WARNING: This does NOT authenticate a human, login, server worker, seller or
account. Every assertion is caller-constructible and the pre-seeded mapping
is fictional. It cannot become a network, wallet or gameplay write permit.
The Core 8B/8C verified issuer and true economic account ownership relation
are absent; real production must inject those via reviewed trusted Core code.
"""

from __future__ import annotations

from dataclasses import dataclass
import sqlite3

from economics_core_identity import from_core_pg_character_key
from economics_sqlite_lab import Denied


@dataclass(frozen=True)
class FixtureCoreIdentityAssertion:
    """Untrusted demo assertion; a matching SQL row is NOT proof of credentials."""

    account_key_be: bytes
    character_key_be: bytes
    session_generation: int


def assert_fixture_binding_in_transaction(
    db: sqlite3.Connection,
    untrusted: object,
    ledger_account_id: int,
    current_epoch: int,
) -> None:
    """Check an exact mapped pair under caller's existing write transaction.

    Only *one* DB transaction may cover binding, balance, listing, title,
    immutable receipt and outbox; this function must not open another DB
    connection, commit or release the lock. A network client could fabricate
    these public fields; therefore it is a consistency test ONLY.
    """
    if (
        not isinstance(db, sqlite3.Connection)
        or not db.in_transaction
        or not isinstance(untrusted, FixtureCoreIdentityAssertion)
        or type(ledger_account_id) is not int or ledger_account_id <= 0
        or type(current_epoch) is not int or current_epoch <= 0
        or type(untrusted.session_generation) is not int
        or untrusted.session_generation <= 0
        or untrusted.session_generation != current_epoch
        or type(untrusted.account_key_be) is not bytes
        or len(untrusted.account_key_be) != 16
    ):
        raise Denied("No valid fixture principal-bound transaction context")

    try:
        # Enforce canonical Core 8C nonzero 128-bit network-order identity.
        from_core_pg_character_key(untrusted.character_key_be)
        from_core_pg_character_key(untrusted.account_key_be)
    except ValueError as exc:
        raise Denied("Malformed or zero Core fixture identity") from exc

    if untrusted.account_key_be == untrusted.character_key_be:
        raise Denied("Account and character must be distinct principal keys")

    record = db.execute(
        "SELECT b.account_key_be,b.character_key_be,b.session_generation,"
        " a.kind,s.state"
        " FROM core_fixture_bindings b"
        " JOIN accounts a ON a.id=b.ledger_account_id"
        " JOIN admitted_sessions s ON s.player_id=b.ledger_account_id"
        "   AND s.epoch=b.session_generation"
        " WHERE b.ledger_account_id=?",
        (ledger_account_id,),
    ).fetchone()
    if record != (
        untrusted.account_key_be,
        untrusted.character_key_be,
        untrusted.session_generation,
        "player",
        "active",
    ):
        raise Denied("Fictional principal binding revoked, stale or mismatched")


def example_fixture_assertion(player_id: int) -> FixtureCoreIdentityAssertion:
    """Documented hardcoded test vector generator, NOT a Core credential.

    This method intentionally demonstrates how trivial it is to fabricate a
    matching assertion in the toy model. NEVER enable it for real accounts.
    """
    by_id = {
        10: (
            0xA10,
            0x0102030405060708090A0B0C0D0E0F10,
        ),
        20: (0xA20, 0x80000000000000000000000000000001),
        30: (0xA30, 0x333),
    }
    if type(player_id) is not int or player_id not in by_id:
        raise Denied("No such fictional Core fixture principal")
    account_id, character_id = by_id[player_id]
    return FixtureCoreIdentityAssertion(
        account_id.to_bytes(16, "big"),
        character_id.to_bytes(16, "big"),
        8,
    )
