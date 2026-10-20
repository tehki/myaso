"""E2d offline authenticated-checkpoint fixture using externally held HMAC keys.

This is a TEST-ONLY model. It does not store or issue production signing keys,
establish a network identity, prove host disk durability, or bind actual realms
to authenticated account infrastructure. An authorized caller must separately
protect (a) the HMAC key and (b) the highest committed sequence.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import hmac
import json
import re
from pathlib import Path
from typing import Mapping

from economics_recovery_audit import (
    AuditReport, CorruptState, RecoveryAnchor,
    anchor_fixture_checkpoint, verify_against_trusted_anchor,
)

_PREFIX = b"myaso/economics/e2d/recovery-checkpoint/v1\x00"
_LABEL = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,63}\Z")
_SHA256 = re.compile(r"[0-9a-f]{64}\Z")
_MAX_SEQUENCE = (1 << 63) - 1


class InvalidCheckpoint(CorruptState):
    """Checkpoints that are malformed, unauthorized or cannot be matched."""


@dataclass(frozen=True)
class AuthenticatedCheckpoint:
    version: int
    realm: str
    key_id: str
    sequence: int
    logical_sha256: str
    hmac_sha256: str


def _valid_label(value: object) -> bool:
    return isinstance(value, str) and _LABEL.fullmatch(value) is not None


def _valid_sequence(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= _MAX_SEQUENCE


def _valid_key(value: object) -> bool:
    # Neither passphrases nor HMAC test keys are issued by this code.
    return isinstance(value, bytes) and len(value) >= 32


def _canonical_body(checkpoint: AuthenticatedCheckpoint) -> bytes:
    body = {
        "key_id": checkpoint.key_id,
        "logical_sha256": checkpoint.logical_sha256,
        "realm": checkpoint.realm,
        "sequence": checkpoint.sequence,
        "version": checkpoint.version,
    }
    return _PREFIX + json.dumps(
        body, sort_keys=True, separators=(",", ":"), ensure_ascii=True
    ).encode("ascii")


def _validated_fields(checkpoint: AuthenticatedCheckpoint) -> None:
    if (
        not isinstance(checkpoint, AuthenticatedCheckpoint)
        or type(checkpoint.version) is not int
        or checkpoint.version != 1
        or not _valid_label(checkpoint.realm)
        or not _valid_label(checkpoint.key_id)
        or not _valid_sequence(checkpoint.sequence)
        or not isinstance(checkpoint.logical_sha256, str)
        or _SHA256.fullmatch(checkpoint.logical_sha256) is None
        or not isinstance(checkpoint.hmac_sha256, str)
        or _SHA256.fullmatch(checkpoint.hmac_sha256) is None
    ):
        raise InvalidCheckpoint("Malformed authenticated checkpoint envelope")


def issue_fixture_checkpoint(
    db_path: str | Path, *, realm: str, key_id: str, secret: bytes
) -> AuthenticatedCheckpoint:
    """Create a sealed checkpoint for a disposal-only SQLite fixture.

    NEVER give this authority to an untrusted game client; a compromised issuer
    could certify malicious state. Caller is responsible for external custody
    of the key and signed checkpoint.
    """
    if not _valid_label(realm) or not _valid_label(key_id) or not _valid_key(secret):
        raise InvalidCheckpoint("Invalid fixture realm/key metadata")
    anchor = anchor_fixture_checkpoint(db_path)
    unsigned = AuthenticatedCheckpoint(
        version=1, realm=realm, key_id=key_id, sequence=anchor.sequence,
        logical_sha256=anchor.logical_sha256, hmac_sha256="0" * 64,
    )
    signature = hmac.new(secret, _canonical_body(unsigned), hashlib.sha256).hexdigest()
    return AuthenticatedCheckpoint(
        version=unsigned.version, realm=unsigned.realm, key_id=unsigned.key_id,
        sequence=unsigned.sequence, logical_sha256=unsigned.logical_sha256,
        hmac_sha256=signature,
    )


def encode_checkpoint(checkpoint: AuthenticatedCheckpoint) -> str:
    """Portable deterministic JSON checkpoint, not a storage transport."""
    _validated_fields(checkpoint)
    return json.dumps(
        {
            "version": checkpoint.version,
            "realm": checkpoint.realm,
            "key_id": checkpoint.key_id,
            "sequence": checkpoint.sequence,
            "logical_sha256": checkpoint.logical_sha256,
            "hmac_sha256": checkpoint.hmac_sha256,
        },
        sort_keys=True, separators=(",", ":"), ensure_ascii=True,
    )


def decode_checkpoint(encoded: str) -> AuthenticatedCheckpoint:
    """Reject ambiguous/duplicate keys and unknown JSON fields."""
    if not isinstance(encoded, str) or not 1 <= len(encoded) <= 2048:
        raise InvalidCheckpoint("Invalid checkpoint encoding")
    def reject_duplicates(pairs: list[tuple[str, object]]) -> dict:
        data = {}
        for key, value in pairs:
            if key in data:
                raise InvalidCheckpoint("Duplicate JSON checkpoint fields")
            data[key] = value
        return data
    try:
        parsed = json.loads(encoded, object_pairs_hook=reject_duplicates)
    except (TypeError, ValueError, UnicodeError) as exc:
        raise InvalidCheckpoint("Invalid checkpoint JSON") from exc
    expected = {
        "version", "realm", "key_id", "sequence",
        "logical_sha256", "hmac_sha256",
    }
    if not isinstance(parsed, dict) or set(parsed) != expected:
        raise InvalidCheckpoint("Unexpected or missing checkpoint fields")
    envelope = AuthenticatedCheckpoint(**parsed)
    _validated_fields(envelope)
    return envelope


def verify_fixture_checkpoint(
    db_path: str | Path,
    checkpoint: AuthenticatedCheckpoint,
    *,
    expected_realm: str,
    trusted_keys: Mapping[str, bytes],
    minimum_committed_sequence: int,
) -> AuditReport:
    """Validate HMAC, trusted minimum sequence, then restored SQLite contents.

    A valid *old* checkpoint alone cannot prove recency. The caller's
    independently trusted highest-committed sequence MUST be at least as fresh
    as the latest actual transaction. Using zero after commits permits rollback.
    """
    _validated_fields(checkpoint)
    if (
        not _valid_label(expected_realm)
        or checkpoint.realm != expected_realm
        or not _valid_sequence(minimum_committed_sequence)
        or not isinstance(trusted_keys, Mapping)
    ):
        raise InvalidCheckpoint("Untrusted realm or monotonic sequence policy")
    secret = trusted_keys.get(checkpoint.key_id)
    if not _valid_key(secret):
        raise InvalidCheckpoint("Checkpoint key unavailable or invalid")
    computed = hmac.new(
        secret, _canonical_body(checkpoint), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(computed, checkpoint.hmac_sha256):
        raise InvalidCheckpoint("Checkpoint HMAC does not match trusted key")
    if checkpoint.sequence < minimum_committed_sequence:
        raise InvalidCheckpoint("Checkpoint precedes independently trusted commit")
    try:
        return verify_against_trusted_anchor(
            db_path, RecoveryAnchor(checkpoint.sequence, checkpoint.logical_sha256)
        )
    except CorruptState as exc:
        raise InvalidCheckpoint("Restored database does not match authenticated checkpoint") from exc
