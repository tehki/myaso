"""B1: read-only World/Items -> Economics bank vault-breach envelope.

**NO AUTHORIZATION OR MUTATION.** A well-formed event, SHA-256 fingerprint,
Core-shaped ID, world tick or tuple is not evidence of a successful raid.
These bytes are fully forgeable by a client. There is deliberately NO method
here that transfers gold or calls LocalTownBanksLab.robbery_fixture().

Real admission requires server-owned Core/World authority and ONE atomic,
fenced persistence transaction covering vault gold + physical item custody +
bank reserve/deposit liabilities + unique world event + outbox. This module
does not provide those services or a player-facing network route.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import re

MAX_I63 = 2**63 - 1
MAX_GOLD = 10**12
_ID_RE = re.compile(r"[a-z][a-z0-9_-]{0,47}\Z")
_HEX_128 = re.compile(r"[0-9a-f]{32}\Z")
_SCHEMA = "myaso.bank-vault-breach.v1"
_FIELDS = frozenset({
    "schema", "town_id", "vault_entity_id", "event_id", "actor_character_id",
    "loot_container_id", "worker_id", "zone_id", "authority_epoch",
    "session_generation", "vault_revision", "world_tick", "stolen_gold",
})


class InvalidBankWorldEnvelope(ValueError):
    """Untrusted or noncanonical World-to-Economics event payload."""


class BankWorldAuthorityUnavailable(RuntimeError):
    """No trusted Core+World+Items atomic purchase/robbery service installed."""


@dataclass(frozen=True)
class UntrustedVaultBreachEnvelope:
    schema: str
    town_id: str
    vault_entity_id: str
    event_id: str
    actor_character_id: str
    loot_container_id: str
    worker_id: int
    zone_id: int
    authority_epoch: int
    session_generation: int
    vault_revision: int
    world_tick: int
    stolen_gold: int

    def __post_init__(self):
        # Inputs must be strict canonical values, without JSON/Python bool
        # masquerading as numeric authority or signed/shortened Core IDs.
        if self.schema != _SCHEMA or type(self.town_id) is not str \
                or not _ID_RE.fullmatch(self.town_id):
            raise InvalidBankWorldEnvelope("Invalid World event schema or town")
        for name in ("vault_entity_id", "event_id",
                     "actor_character_id", "loot_container_id"):
            value = getattr(self, name)
            if type(value) is not str or not _HEX_128.fullmatch(value) \
                    or value == "0" * 32:
                raise InvalidBankWorldEnvelope(f"Invalid full-width {name}")
        if self.vault_entity_id == self.loot_container_id:
            raise InvalidBankWorldEnvelope("Vault and loot container cannot be identical")
        for name in ("worker_id", "zone_id", "authority_epoch",
                     "session_generation", "vault_revision", "world_tick",
                     "stolen_gold"):
            value = getattr(self, name)
            lower = 0 if name == "world_tick" else 1
            limit = MAX_GOLD if name == "stolen_gold" else MAX_I63
            if type(value) is not int or not lower <= value <= limit:
                raise InvalidBankWorldEnvelope(f"Invalid bounded {name}")

    def canonical_bytes(self) -> bytes:
        # Fingerprints are *not* signatures. No secret or trust originates here.
        data = {name: getattr(self, name) for name in sorted(_FIELDS)}
        return json.dumps(
            data, sort_keys=True, separators=(",", ":"), ensure_ascii=True
        ).encode("ascii")

    def fingerprint(self) -> str:
        return hashlib.sha256(self.canonical_bytes()).hexdigest()


def parse_untrusted_world_envelope(raw: bytes) -> UntrustedVaultBreachEnvelope:
    """Parse exactly one canonical JSON object; never authenticate it."""
    if type(raw) is not bytes or len(raw) > 2048 or not raw:
        raise InvalidBankWorldEnvelope("Invalid/oversized World envelope bytes")
    try:
        source = raw.decode("utf-8", errors="strict")

        def reject_duplicates(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise InvalidBankWorldEnvelope("Duplicate JSON key")
                result[key] = value
            return result

        def reject_float(text):
            raise InvalidBankWorldEnvelope("Fractional/exponent JSON numbers rejected")

        obj = json.loads(
            source,
            object_pairs_hook=reject_duplicates,
            parse_float=reject_float,
            parse_constant=reject_float,
        )
        if type(obj) is not dict or set(obj) != _FIELDS:
            raise InvalidBankWorldEnvelope("Missing or unexpected envelope fields")
        envelope = UntrustedVaultBreachEnvelope(**obj)
        if envelope.canonical_bytes() != raw:
            raise InvalidBankWorldEnvelope("World event encoding is not canonical")
        return envelope
    except (UnicodeError, TypeError, ValueError, OverflowError) as exc:
        if isinstance(exc, InvalidBankWorldEnvelope):
            raise
        raise InvalidBankWorldEnvelope("Malformed World envelope") from exc


def require_real_atomic_breach_authority(
    untrusted: UntrustedVaultBreachEnvelope,
) -> None:
    """Unconditionally DENY.

    Parsing a canonical event must never grant account access or move vault
    gold. An authorized service must instead own a reviewed, non-bypassable
    Core/World/Items transaction, which does not exist in First Playable.
    """
    if not isinstance(untrusted, UntrustedVaultBreachEnvelope):
        raise InvalidBankWorldEnvelope("No checked World handoff proposal")
    raise BankWorldAuthorityUnavailable(
        "Cannot settle a bank robbery: no trusted Core/World/Items atomic "
        "vault/inventory/ledger authority installed"
    )
