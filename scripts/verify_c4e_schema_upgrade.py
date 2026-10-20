#!/usr/bin/env python3
"""Isolated C4e migration test: legacy bad row abort, clean upgrade, idempotence.

Requires disposable PostgreSQL 16 CI database. No production connections.
"""
import os
import subprocess

ZERO = "00000000000000000000000000000000"
MIGRATION = "server/sql/003_nonzero_authority_ids.sql"


def psql(*args, expect_failure=False):
    proc = subprocess.run(
        ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", *args],
        check=False, capture_output=True, text=True, timeout=25,
    )
    if expect_failure:
        assert proc.returncode != 0, f"unexpected SQL success: {args}"
    else:
        assert proc.returncode == 0, f"SQL failed: {args}\n{proc.stderr}"
    return proc.stdout.strip(), proc.stderr


def query(sql, expect_failure=False):
    return psql("-c", sql, expect_failure=expect_failure)[0].splitlines()[-1:]


def constraints():
    result = query(
        "SELECT count(*) FROM pg_catalog.pg_constraint "
        "WHERE connamespace='core_zone'::regnamespace "
        "AND conname LIKE 'c4e_%';"
    )
    return int(result[-1])


def main():
    assert os.environ.get("MYASO_C4D_TEST_ONLY") == "1", "test-only opt-in required"
    assert os.environ.get("PGDATABASE") == "myaso_c4d_test", "disposable database only"
    assert constraints() == 0, "migration must start uninstalled"

    # Emulate a pre-C4e schema row by removing the new inline fresh-install
    # CHECK from an isolated CI table. No production schema is modified.
    query("ALTER TABLE core_zone.entities DROP CONSTRAINT entities_entity_id_check;")
    query(
        "INSERT INTO core_zone.entities "
        "(entity_kind,entity_id,owner_worker,owner_zone,authority_epoch) "
        f"VALUES (1, decode('{ZERO}','hex'), 1, 1, 1);"
    )
    _, stderr = psql("-f", MIGRATION, expect_failure=True)
    assert "violates check constraint" in stderr, (
        "migration must fail specifically on legacy zero-ID data, not unrelated errors: "
        + stderr
    )
    assert constraints() == 0, "failed transactional migration must leave zero new constraints"
    assert query(
        "SELECT count(*) FROM core_zone.entities "
        f"WHERE entity_id=decode('{ZERO}','hex');"
    ) == ["1"], "legacy bad row must not be silently deleted"
    print("PASS: invalid legacy row aborts upgrade atomically")

    query(f"DELETE FROM core_zone.entities WHERE entity_id=decode('{ZERO}','hex');")
    psql("-f", MIGRATION)
    assert constraints() == 8, "all eight safety constraints installed"
    psql("-f", MIGRATION)
    assert constraints() == 8, "second upgrade must be idempotent"
    query(
        "INSERT INTO core_zone.entities "
        "(entity_kind,entity_id,owner_worker,owner_zone,authority_epoch) "
        f"VALUES (1, decode('{ZERO}','hex'), 1, 1, 1);",
        expect_failure=True,
    )
    print("PASS: clean upgrade, idempotence, and zero-ID rejection")


if __name__ == "__main__":
    main()
