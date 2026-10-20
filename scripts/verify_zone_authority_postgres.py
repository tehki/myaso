#!/usr/bin/env python3
"""C4c authority acceptance against one disposable PostgreSQL primary.

This script uses independent psql client processes, not an in-memory mock.
It never connects to the game or to production. Configure PGHOST/PGPORT/
PGUSER/PGPASSWORD/PGDATABASE to point at a fresh isolated test database.
"""
import concurrent.futures
import os
import shutil
import subprocess
import threading
import time


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def call(statement: str, *, expect_failure: bool = False) -> str:
    completed = subprocess.run(
        ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement],
        text=True, capture_output=True, check=False, timeout=15,
    )
    if expect_failure:
        require(completed.returncode != 0, f"unexpectedly succeeded: {statement}")
    else:
        require(
            completed.returncode == 0,
            f"database query failed: {statement}\n{completed.stderr}",
        )
    return completed.stdout.strip()


def entity(n: int) -> str:
    return f"decode('{n:032x}', 'hex')"


def operation(n: int) -> str:
    return entity(n)


def register(n: int, worker=1, zone=1) -> None:
    require(
        call(f"SELECT core_zone.register_entity(1::smallint, {entity(n)}, {worker}, {zone});") == "1",
        "fresh entity should start at epoch 1",
    )


def prepare(transaction: int, n: int, src_worker: int, src_zone: int,
            epoch: int, target_worker: int, target_zone: int,
            *, expect_failure=False) -> str:
    return call(
        "SELECT core_zone.prepare_transfer("
        f"{operation(transaction)}, 1::smallint, {entity(n)}, "
        f"{src_worker}, {src_zone}, {epoch}, {target_worker}, {target_zone});",
        expect_failure=expect_failure,
    )


def commit(transaction: int, *, expect_failure=False) -> str:
    return call(
        f"SELECT core_zone.commit_transfer({operation(transaction)});",
        expect_failure=expect_failure,
    )


def abort(transaction: int, *, expect_failure=False) -> str:
    return call(
        f"SELECT core_zone.abort_transfer({operation(transaction)});",
        expect_failure=expect_failure,
    )


def is_current(n: int, worker: int, zone: int, epoch: int) -> bool:
    return call(
        f"SELECT core_zone.is_current(1::smallint, {entity(n)}, {worker}, {zone}, {epoch});"
    ) == "t"


def assert_can_mutate(n: int, worker: int, zone: int, epoch: int,
                      *, expect_failure=False) -> None:
    call(
        f"SELECT core_zone.assert_mutation_authority(1::smallint, {entity(n)}, "
        f"{worker}, {zone}, {epoch});",
        expect_failure=expect_failure,
    )


def test_authority_recovery() -> None:
    register(1)
    require(is_current(1, 1, 1, 1), "initial worker must be current")
    require(prepare(100, 1, 1, 1, 1, 2, 2) == "prepared", "prepare")
    require(not is_current(1, 1, 1, 1), "prepare must freeze source")
    require(not is_current(1, 2, 2, 2), "prepare must freeze target")
    assert_can_mutate(1, 1, 1, 1, expect_failure=True)
    require(prepare(100, 1, 1, 1, 1, 2, 2) == "prepared", "exact replay")
    prepare(100, 1, 1, 1, 1, 3, 3, expect_failure=True)
    prepare(101, 1, 1, 1, 1, 3, 3, expect_failure=True)

    require(commit(100) == "2", "commit increments epoch once")
    require(commit(100) == "2", "ACK retry must preserve epoch")
    require(is_current(1, 2, 2, 2), "target now authoritative")
    require(not is_current(1, 1, 1, 1), "old worker is fenced")
    assert_can_mutate(1, 1, 1, 1, expect_failure=True)
    assert_can_mutate(1, 2, 2, 2)
    abort(100, expect_failure=True)

    require(prepare(102, 1, 2, 2, 2, 3, 3) == "prepared", "second handoff")
    require(commit(102) == "3", "next epoch")
    commit(100, expect_failure=True)
    require(is_current(1, 3, 3, 3), "latest worker current")

    register(2)
    require(prepare(200, 2, 1, 1, 1, 2, 2) == "prepared", "prepare abort")
    require(abort(200) == "aborted", "abort restores source")
    require(abort(200) == "aborted", "abort reply idempotent")
    require(is_current(2, 1, 1, 1), "abort preserves epoch")
    prepare(200, 2, 1, 1, 1, 3, 3, expect_failure=True)
    require(prepare(201, 2, 1, 1, 1, 3, 3) == "prepared", "new unique ID")
    require(commit(201) == "2", "commit after abort")
    abort(200, expect_failure=True)  # historical ACK cannot claim current authority

    # Persistent ID cannot be registered again; retirement is irreversible.
    call(f"SELECT core_zone.retire_entity(1::smallint, {entity(2)}, 3, 3, 2);")
    require(not is_current(2, 3, 3, 2), "retirement revoked authority")
    call(f"SELECT core_zone.register_entity(1::smallint, {entity(2)}, 3, 3);",
         expect_failure=True)
    print("PASS: committed and aborted transfer receipts, stale fences, retirement")


def test_competing_independent_clients() -> None:
    register(3)
    start = threading.Barrier(3)

    def candidate(op: int, worker: int) -> tuple[int, bool]:
        start.wait(timeout=5)
        statement = (
            "SELECT core_zone.prepare_transfer("
            f"{operation(op)}, 1::smallint, {entity(3)}, 1, 1, 1, {worker}, 2);"
        )
        result = subprocess.run(
            ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement],
            capture_output=True, text=True, timeout=15,
        )
        return op, result.returncode == 0 and result.stdout.strip() == "prepared"

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        a = pool.submit(candidate, 301, 2)
        b = pool.submit(candidate, 302, 3)
        start.wait(timeout=5)
        outcomes = [a.result(timeout=20), b.result(timeout=20)]
    winners = [op for op, accepted in outcomes if accepted]
    require(len(winners) == 1, f"expected one winner, got {outcomes}")
    winner = winners[0]
    require(commit(winner) == "2", "winning transaction must be committable")
    require(
        is_current(3, 2 if winner == 301 else 3, 2, 2),
        "winning target now owns entity",
    )
    other = 302 if winner == 301 else 301
    commit(other, expect_failure=True)
    print("PASS: independent PostgreSQL clients serialize contending workers")


def test_row_lock_protects_mutation() -> None:
    register(4)
    session = subprocess.Popen(
        ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, bufsize=1,
    )
    require(session.stdin is not None and session.stdout is not None,
            "psql session pipes")
    try:
        session.stdin.write(
            "BEGIN;\n"
            f"SELECT core_zone.assert_mutation_authority(1::smallint, {entity(4)}, 1, 1, 1);\n"
            "SELECT 'AUTHORITY_ROW_LOCKED';\n"
        )
        session.stdin.flush()
        marker = ""
        for _ in range(10):
            line = session.stdout.readline()
            if not line:
                break
            if "AUTHORITY_ROW_LOCKED" in line:
                marker = line
                break
        require(bool(marker), "transaction did not retain row lock")
        # Another independent client must NOT prepare while the authoritative
        # mutation transaction holds the row lock. Failure is from lock_timeout.
        call(
            "SET lock_timeout='200ms'; "
            f"SELECT core_zone.prepare_transfer({operation(401)}, 1, "
            f"{entity(4)}, 1, 1, 1, 2, 2);",
            expect_failure=True,
        )
        require(is_current(4, 1, 1, 1), "source stays current under lock")
        session.stdin.write("COMMIT;\n\\q\n")
        session.stdin.flush()
        session.wait(timeout=8)
        require(session.returncode == 0, "source transaction commit")
        require(prepare(402, 4, 1, 1, 1, 2, 2) == "prepared",
                "handoff succeeds after lock release")
        require(commit(402) == "2", "post-lock commit succeeds")
    finally:
        if session.poll() is None:
            session.kill()
            session.wait(timeout=3)
    print("PASS: in-transaction authority row locks exclude competing handoffs")


def test_least_privilege_role() -> None:
    # Production needs a dedicated NOLOGIN function owner and an authenticated
    # application role with EXECUTE only; this acceptance creates an ephemeral
    # restricted role without raw table read/write privileges.
    role = "myaso_c4c_executor_test"
    call(f"CREATE ROLE {role} NOLOGIN;")
    call(f"GRANT USAGE ON SCHEMA core_zone TO {role};")
    call(f"GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA core_zone TO {role};")
    call(f"SET ROLE {role}; SELECT core_zone.register_entity("
         f"1::smallint, {entity(99)}, 1, 1);")
    call(f"SET ROLE {role}; SELECT * FROM core_zone.entities;",
         expect_failure=True)
    call(f"SET ROLE {role}; UPDATE core_zone.entities SET owner_worker = 9;",
         expect_failure=True)
    require(
        call(f"SET ROLE {role}; SELECT core_zone.prepare_transfer("
             f"{operation(990)}, 1::smallint, {entity(99)}, 1, 1, 1, 2, 2);")
        == "prepared",
        "restricted service role must use trusted database function",
    )
    require(
        call(f"SET ROLE {role}; SELECT core_zone.commit_transfer({operation(990)});")
        == "2",
        "restricted service role can commit after compare-and-swap",
    )
    require(is_current(99, 2, 2, 2), "restricted operation updated committed authority")
    print("PASS: restricted service role has function access, not table bypass")


def main() -> None:
    require(shutil.which("psql") is not None, "PostgreSQL client not found")
    require(os.environ.get("PGDATABASE"), "PGDATABASE required: isolated database only")
    require(os.environ.get("MYASO_C4C_TEST_ONLY") == "1",
            "explicit test-only environment required")
    test_authority_recovery()
    test_competing_independent_clients()
    test_row_lock_protects_mutation()
    test_least_privilege_role()
    print("C4C POSTGRES ACCEPTANCE PASSED (one primary; not WAN/partition proof)")


if __name__ == "__main__":
    main()
