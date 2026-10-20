"""E2g read-only Core 8B / 8C character ID wire-compatibility laboratory.

Pinned to Core X1 draft PR #407, head 4556088bf5a938fedf7935a594e5ac0d5242cfc5.
This module can only PARSE UNTRUSTED PERSISTED BYTES. It cannot authenticate
a session, infer which durable account owns a character, grant a property,
resolve worker authority, or approve any economic command.

The real Core-owned adapter must use its own trusted, durably fenced identity
source and a separately authorized account<->character relationship.
"""

from __future__ import annotations

from dataclasses import dataclass

MYCH_V1_LENGTH = 36
MYCH_MAGIC = b"MYCH"
MYCH_VERSION = 1
PG_ENTITY_KEY_BYTES = 16
MAX_U128 = (1 << 128) - 1
MAX_SQL_SIGNED_BIGINT = (1 << 63) - 1
MAX_SQLITE_SIGNED_INTEGER = (1 << 63) - 1


class UntrustedIdentityEncoding(ValueError):
    """Bytes or numeric IDs fail the recorded Core identity format."""


class EconomicIdentityUnavailable(RuntimeError):
    """No authenticated durable account/character authority is installed."""


@dataclass(frozen=True)
class UntrustedCoreCharacterRecord:
    """A parsed record, NEVER a session/authentication/ownership receipt."""

    numerical_character_id: int
    stored_session_generation: int
    pg_entity_bytea: bytes

    def __post_init__(self) -> None:
        if (
            type(self.numerical_character_id) is not int
            or not 0 < self.numerical_character_id <= MAX_U128
            or type(self.stored_session_generation) is not int
            or not 0 <= self.stored_session_generation <= (1 << 64) - 1
            or type(self.pg_entity_bytea) is not bytes
            or len(self.pg_entity_bytea) != PG_ENTITY_KEY_BYTES
            or int.from_bytes(self.pg_entity_bytea, "big")
               != self.numerical_character_id
        ):
            raise UntrustedIdentityEncoding("Inconsistent untrusted character record")


def _fnv1a32(raw: bytes) -> int:
    state = 0x811C9DC5
    for byte in raw:
        state ^= byte
        state = (state * 0x01000193) & 0xFFFFFFFF
    return state


def to_core_pg_character_key(character_numeric_id: int) -> bytes:
    """Canonical 8C PG bytea conversion; never reuse 8B's little-endian bytes."""
    if (
        type(character_numeric_id) is not int
        or not 0 < character_numeric_id <= MAX_U128
    ):
        raise UntrustedIdentityEncoding("Core character ID must be nonzero u128")
    return character_numeric_id.to_bytes(PG_ENTITY_KEY_BYTES, "big")


def from_core_pg_character_key(value: bytes) -> int:
    """Read exact 16 network-order bytes, no implicit casts or legacy u64."""
    if type(value) is not bytes or len(value) != PG_ENTITY_KEY_BYTES:
        raise UntrustedIdentityEncoding("Core PG character bytea must be exactly 16 bytes")
    character_id = int.from_bytes(value, "big")
    if character_id == 0:
        raise UntrustedIdentityEncoding("Core character identity cannot be zero")
    return character_id


def decode_untrusted_mych_v1(raw: bytes) -> UntrustedCoreCharacterRecord:
    """Decode 8B 36-byte persisted record, including its nonsecure FNV checksum.

    The stored generation and checksum are data, NOT proof that this session
    still owns the character; they are NOT a verified player account.
    """
    if type(raw) is not bytes or len(raw) != MYCH_V1_LENGTH:
        raise UntrustedIdentityEncoding("Core MYCH v1 record must be 36 bytes")
    if raw[:4] != MYCH_MAGIC or raw[4] != MYCH_VERSION:
        raise UntrustedIdentityEncoding("Invalid Core MYCH magic or version")
    if raw[5:8] != b"\x00\x00\x00":
        raise UntrustedIdentityEncoding("Nonzero reserved Core identity bytes")
    expected_checksum = _fnv1a32(raw[:32])
    actual_checksum = int.from_bytes(raw[32:36], "little")
    if actual_checksum != expected_checksum:
        raise UntrustedIdentityEncoding("Core MYCH checksum mismatch")
    numeric = int.from_bytes(raw[8:24], "little")
    key = to_core_pg_character_key(numeric)
    generation = int.from_bytes(raw[24:32], "little")
    return UntrustedCoreCharacterRecord(numeric, generation, key)


def prepare_economic_account_from_character(
    _untrusted_record: UntrustedCoreCharacterRecord,
) -> None:
    """Deliberate unavailability: Core has no installed account-owner verifier.

    Reconstructing an ID/record is NEVER a substitute for an authenticated
    account binding, fencing generation, active session and durable grants.
    """
    raise EconomicIdentityUnavailable(
        "Core 8B/8C authenticated account-character binding is not installed"
    )


def prohibit_legacy_sqlite_character_owner(character_numeric_id: int) -> None:
    """Reject *all* 128-bit character IDs for E2d's INTEGER fixture account key.

    Even numbers that happen to fit in signed i64 must not become durable
    economic accounts by coercion: a character and an account are not the same.
    """
    to_core_pg_character_key(character_numeric_id)
    raise EconomicIdentityUnavailable(
        "SQLite fixture INTEGER player_id cannot represent a canonical account binding"
    )
