"""E2i STRICT fixture purchase gateway: deny unless an INJECTED server adapter admits.

The real Core 8A/8B session-provider, durable account↔character mapping, and
Core 8C authority backend are not installed. This is an OFFLINE dependency
injection/transaction-fencing contract, NOT an authentication implementation.
A malicious Python caller can construct its own provider and forge identities;
therefore NEVER expose this gateway to HTTP, WebTransport or game clients.

Core's real verifier, once provided, must be installed by trusted server code,
must resolve the actual authenticated transport connection, and must bind
account, character, active generation and zone authority to the final PG write.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
import sqlite3

from economics_core_binding import (
    FixtureCoreIdentityAssertion, assert_fixture_binding_in_transaction,
)
from economics_sqlite_lab import (
    Denied, PurchaseIntent, VerifiedSession, purchase,
)


@dataclass(frozen=True)
class FixtureResolvedTransport:
    """Pretend transport resolution; NOT a signed identity/authorization proof."""

    ledger_player_id: int
    account_key_be: bytes
    character_key_be: bytes
    active_generation: int


class FixtureServerSessionProvider(ABC):
    """Injection point; production has NO implementation in this project.

    Only the (fictional) trusted server object should hold an instance. Any
    local Python caller can implement this abstract interface, so its type is
    NOT an unforgeable security capability.
    """

    @abstractmethod
    def resolve_server_owned_handle(self, handle: bytes) -> FixtureResolvedTransport:
        """Resolve a server-local handle; never trust a client-made identity."""


def assert_fixture_server_session_in_transaction(
    db: sqlite3.Connection,
    provider: object,
    server_transport_ref: object,
    session: VerifiedSession,
    intent: PurchaseIntent,
) -> None:
    """Re-evaluate server-side fixture resolution AFTER write BEGIN IMMEDIATE.

    Resolving a server-local session handle outside the transaction would be
    mere preflight. This function runs before a committed receipt can be read
    and before any funds/deed are mutated; it also checks SQL admissions and
    identity mapping under the SAME active writer transaction.
    """
    if (
        not isinstance(db, sqlite3.Connection) or not db.in_transaction
        or not isinstance(provider, FixtureServerSessionProvider)
        or type(server_transport_ref) is not bytes
        or not 1 <= len(server_transport_ref) <= 64
        or not isinstance(session, VerifiedSession)
        or not isinstance(intent, PurchaseIntent)
    ):
        raise Denied("Missing installed fixture session/transaction authority")
    try:
        resolved = provider.resolve_server_owned_handle(server_transport_ref)
    except Exception as exc:
        raise Denied("Offline server-session backend unavailable") from exc
    if (
        not isinstance(resolved, FixtureResolvedTransport)
        or type(resolved.ledger_player_id) is not int
        or resolved.ledger_player_id != session.player_id
        or resolved.ledger_player_id != intent.buyer_id
        or type(resolved.active_generation) is not int
        or resolved.active_generation != session.epoch
        or resolved.active_generation <= 0
    ):
        raise Denied("Server-side session does not admit this buyer and generation")
    assert_fixture_binding_in_transaction(
        db,
        FixtureCoreIdentityAssertion(
            resolved.account_key_be,
            resolved.character_key_be,
            resolved.active_generation,
        ),
        session.player_id,
        session.epoch,
    )


def strict_purchase_fixture(
    db_path,
    *,
    server_transport_ref: object,
    intent: PurchaseIntent,
    expected_generation: int,
    trusted_tick: int,
    installed_provider: FixtureServerSessionProvider | None = None,
    failpoint: str | None = None,
) -> dict:
    """Explicit mock-admission gateway with NO default/bypass-to-legacy path.

    Unlike offline purchase(), this gateway always requires injected authority.
    The provider is STILL only test code, not a real trusted Core verifier.
    expected_generation is an untrusted request/version expectation, NOT proof.
    Never wire this fixture entry point to production.
    """
    if not isinstance(installed_provider, FixtureServerSessionProvider):
        raise Denied("Core trusted identity provider is not installed")
    if not isinstance(intent, PurchaseIntent):
        raise Denied("Malformed fixture transaction intent")
    if type(expected_generation) is not int or expected_generation <= 0:
        raise Denied("Invalid expected fixture generation")
    return purchase(
        db_path,
        VerifiedSession(intent.buyer_id, expected_generation),
        intent,
        trusted_tick,
        failpoint=failpoint,
        _test_only_server_authorizer=installed_provider,
        _test_only_server_transport_ref=server_transport_ref,
    )
