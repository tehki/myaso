#!/usr/bin/env python3
"""C4g: kill disposable psql CLIENT processes while their SQL transactions are open.

This verifies rollback before COMMIT, recovery after COMMIT without an ACK,
durable prepared handoffs across connections and idempotent mutation retry. It does NOT stop PostgreSQL,
exercise network partitions, or demonstrate database-primary failover.
"""
import os
import subprocess
import time

DB = "myaso_c4g_test"


def require(ok, message):
    if not ok:
        raise AssertionError(message)


def sql(statement, expect_error=False):
    process = subprocess.run(
        ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement],
        capture_output=True, text=True, check=False, timeout=12,
    )
    if expect_error:
        require(process.returncode != 0, f"unexpected SQL success: {statement}")
    else:
        require(process.returncode == 0, f"SQL failure: {statement}\n{process.stderr}")
    lines = process.stdout.strip().splitlines()
    return lines[-1].strip() if lines else ""


def ident(i):
    return f"decode('{i:032x}', 'hex')"


def prepare(op, entity, worker, epoch, target_worker):
    return (
        "SELECT core_zone.prepare_transfer("
        f"{ident(op)}, 1::smallint, {ident(entity)}, {worker}, "
        f"{worker}, {epoch}, {target_worker}, {target_worker});"
    )


def mutate(op, entity, worker=1, epoch=1, revision=0):
    payload = "decode('736e617073686f74','hex')"  # b"snapshot"
    return (
        "SELECT world_revision, outbox_sequence, replay "
        "FROM core_zone.commit_world_mutation("
        f"{ident(op)}, 1::smallint, {ident(entity)}, "
        f"{worker}, {worker}, {epoch}, {revision}, {payload});"
    )


def registered(entity):
    require(sql(
        "SELECT core_zone.register_entity("
        f"1::smallint, {ident(entity)}, 1, 1);"
    ) == "1", "registration must start at epoch 1")


def is_current(entity, worker=1, epoch=1):
    return sql(
        "SELECT core_zone.is_current("
        f"1::smallint, {ident(entity)}, {worker}, {worker}, {epoch});"
    ) == "t"


def count(table, column, identifier):
    return sql(
        f"SELECT count(*) FROM core_zone.{table} "
        f"WHERE {column}={ident(identifier)};"
    )


def kill_transaction_client(operation, marker, *, after_commit=False):
    # Send separate SQL statements through a live psql stdin stream.
    # The backend is idle with BEGIN still open, or idle *after* COMMIT,
    # depending on the test. Unlike a long-running server-side pg_sleep,
    # PostgreSQL notices the client disconnect promptly.
    client = subprocess.Popen(
        ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE, text=True, bufsize=1,
    )
    try:
        require(client.stdin is not None, "psql stdin must be writable")
        client.stdin.write("BEGIN;\n")
        client.stdin.write(operation + "\n")
        if after_commit:
            client.stdin.write("COMMIT;\n")
        client.stdin.write(f"SELECT '{marker}';\n")
        client.stdin.flush()
        observed = False
        for _ in range(100):
            if client.poll() is not None:
                detail = client.stderr.read() if client.stderr else ""
                raise AssertionError(f"client exited before crash injection: {detail}")
            # The marker must be the last statement. An idle backend after
            # COMMIT distinguishes durable outcome from an open transaction.
            required_state = "idle" if after_commit else "idle in transaction"
            ready = sql(
                "SELECT count(*) FROM pg_catalog.pg_stat_activity "
                "WHERE datname = current_database() "
                "AND pid <> pg_backend_pid() "
                f"AND state = '{required_state}' "
                f"AND query LIKE '%{marker}%';"
            )
            if ready == "1":
                observed = True
                break
            time.sleep(0.1)
        require(observed, f"transaction did not reach required state: {marker}")
    finally:
        if client.poll() is None:
            client.kill()
        client.communicate(timeout=6)
    require(client.returncode != 0, "crash injection did not terminate psql")


def test_killed_prepare_transaction_rolls_back():
    registered(61)
    kill_transaction_client(prepare(6101, 61, 1, 1, 2), "C4G_PREPARE_6101")
    require(is_current(61), "source retains authority after uncommitted prepare crash")
    require(count("handoffs", "operation_id", 6101) == "0",
            "uncommitted handoff must not survive crash")
    require(sql(
        f"SELECT pending_operation IS NULL FROM core_zone.entities WHERE entity_id={ident(61)};"
    ) == "t", "crash must not leave phantom frozen owner")
    require(sql(prepare(6101, 61, 1, 1, 2)) == "prepared",
            "uncommitted operation ID remains available for retry")
    require(sql(f"SELECT core_zone.commit_transfer({ident(6101)});") == "2",
            "retry commits the unique new epoch")
    require(not is_current(61), "old worker fenced after committed retry")
    require(is_current(61, 2, 2), "new worker alone authoritative")
    require(sql(f"SELECT core_zone.commit_transfer({ident(6101)});") == "2",
            "committed handoff ACK retry must not increment epoch")
    print("PASS: client SIGKILL before prepare COMMIT rolls back; retry fences source")


def test_committed_prepare_remains_frozen_without_original_session():
    registered(62)
    require(sql(prepare(6201, 62, 1, 1, 2)) == "prepared",
            "prepared handoff durable across psql connection close")
    require(not is_current(62, 1, 1) and not is_current(62, 2, 2),
            "no worker may mutate during durable pending transfer")
    sql(mutate(6202, 62), expect_error=True)
    require(count("world_event_outbox", "entity_id", 62) == "0",
            "frozen owner must never emit a mutation")
    require(sql(prepare(6201, 62, 1, 1, 2)) == "prepared",
            "connection loss preserves exact prepared replay")
    require(sql(f"SELECT core_zone.abort_transfer({ident(6201)});") == "aborted",
            "separate coordinator abort unfreezes source")
    require(is_current(62), "abort restores same source epoch")
    sql(prepare(6201, 62, 1, 1, 2), expect_error=True)
    require(sql(prepare(6203, 62, 1, 1, 3)) == "prepared",
            "fresh handoff ID works after abort")
    require(sql(f"SELECT core_zone.commit_transfer({ident(6203)});") == "2",
            "new owner receives epoch 2")
    require(is_current(62, 3, 2) and not is_current(62),
            "old source cannot regain fenced authority")
    print("PASS: durable prepared handoff survives disconnect until explicit abort")


def test_killed_world_mutation_rolls_back_and_retries_exactly_once():
    registered(63)
    kill_transaction_client(mutate(6301, 63), "C4G_WORLD_6301")
    require(count("world_mutation_receipts", "mutation_id", 6301) == "0",
            "no uncommitted receipt after killed client")
    require(count("world_state", "entity_id", 63) == "0",
            "no uncommitted state after killed client")
    require(count("world_event_outbox", "entity_id", 63) == "0",
            "no uncommitted outbox event after killed client")
    require(is_current(63), "client crash must not revoke unchanged ownership")
    committed = sql(mutate(6301, 63))
    require(committed.startswith("1|") and committed.endswith("|f"),
            f"fresh retry must commit revision one: {committed}")
    replay = sql(mutate(6301, 63))
    require(replay == committed[:-1] + "t",
            "exact retry returns same receipt/sequence as historical replay")
    require(count("world_mutation_receipts", "mutation_id", 6301) == "1",
            "one receipt after retry")
    require(count("world_state", "entity_id", 63) == "1",
            "one world state after retry")
    require(count("world_event_outbox", "entity_id", 63) == "1",
            "exactly one outbox event after retry")
    print("PASS: client SIGKILL before mutation COMMIT rolls back all three records")


def test_lost_ack_after_committed_world_mutation():
    registered(64)
    # psql output is deliberately suppressed and the client is SIGKILLed
    # after the backend visibly executed COMMIT.
    kill_transaction_client(
        mutate(6401, 64), "C4G_WORLD_ACK_LOST_6401", after_commit=True,
    )
    require(count("world_mutation_receipts", "mutation_id", 6401) == "1",
            "ack loss must not remove committed receipt")
    require(count("world_state", "entity_id", 64) == "1",
            "ack loss must not remove committed state")
    require(count("world_event_outbox", "entity_id", 64) == "1",
            "ack loss must not lose durable outbox")
    receipt = sql(mutate(6401, 64))
    fields = receipt.split("|")
    require(len(fields) == 3 and fields[0] == "1" and fields[2] == "t",
            f"identical ACK-loss retry must be historical receipt: {receipt}")
    require(count("world_event_outbox", "entity_id", 64) == "1",
            "ACK-loss replay cannot duplicate published event")

    require(sql(prepare(6402, 64, 1, 1, 2)) == "prepared",
            "new authority handoff")
    require(sql(f"SELECT core_zone.commit_transfer({ident(6402)});") == "2",
            "new owner epoch")
    require(sql(mutate(6401, 64)) == receipt,
            "historical committed mutation receipt remains readable")
    sql(mutate(6403, 64, 1, 1, 1), expect_error=True)
    require(count("world_event_outbox", "entity_id", 64) == "1",
            "historical replay must not reopen old worker writes")
    print("PASS: lost post-COMMIT world ACK returns one receipt and fences old owner")


def test_lost_ack_after_committed_handoff():
    registered(65)
    operations = (
        prepare(6501, 65, 1, 1, 2)
        + f"\nSELECT core_zone.commit_transfer({ident(6501)});"
    )
    kill_transaction_client(
        operations, "C4G_HANDOFF_ACK_LOST_6501", after_commit=True,
    )
    require(not is_current(65, 1, 1) and is_current(65, 2, 2),
            "committed handoff must fence source despite lost ACK")
    require(count("handoffs", "operation_id", 6501) == "1",
            "only one durable handoff")
    require(sql(f"SELECT core_zone.commit_transfer({ident(6501)});") == "2",
            "exact commit ACK retry must retain epoch 2")
    require(sql(prepare(6501, 65, 1, 1, 2)) == "committed",
            "exact original prepare replay is historical committed")
    sql(mutate(6502, 65, 1, 1, 0), expect_error=True)
    require(sql(mutate(6503, 65, 2, 2, 0)).endswith("|f"),
            "new worker can make the first valid world mutation")
    require(count("world_event_outbox", "entity_id", 65) == "1",
            "source cannot duplicate new owner event")
    print("PASS: lost post-COMMIT handoff ACK preserves new epoch and fences source")


def main():
    require(os.getenv("MYASO_C4G_TEST_ONLY") == "1", "explicit C4g test-only flag required")
    require(os.getenv("PGDATABASE") == DB, "only disposable C4g database allowed")
    require(os.getenv("PGUSER") == DB, "only disposable C4g user allowed")
    require(os.getenv("PGHOST") in ("127.0.0.1", "localhost"),
            "never run C4g acceptance against remote/production PostgreSQL")
    test_killed_prepare_transaction_rolls_back()
    test_committed_prepare_remains_frozen_without_original_session()
    test_killed_world_mutation_rolls_back_and_retries_exactly_once()
    test_lost_ack_after_committed_world_mutation()
    test_lost_ack_after_committed_handoff()
    print("C4G CRASH-SESSION ACCEPTANCE PASSED (client-only, one local PG primary)")


if __name__ == "__main__":
    main()
