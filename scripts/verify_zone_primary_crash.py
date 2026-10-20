#!/usr/bin/env python3
"""C4h test ONLY: SIGKILL one ephemeral GitHub Actions PostgreSQL 16 container.

This validates single-primary crash-restart state and transactional fencing.
It does NOT test host power loss, promotion, WAN partitions, or production.
"""
import json
import os
import subprocess
import time

TEST_DB = "myaso_c4h_test"
MARKERS = ("C4H_OPEN_WORLD_7301", "C4H_OPEN_HANDOFF_7401")


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def sql(statement, *, expect_failure=False):
    result = subprocess.run(
        ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement],
        text=True, capture_output=True, check=False, timeout=12,
    )
    if expect_failure:
        require(result.returncode != 0, f"unexpected SQL success: {statement}")
    else:
        require(result.returncode == 0, f"SQL failed: {statement}\n{result.stderr}")
    lines = result.stdout.strip().splitlines()
    return lines[-1] if lines else ""


def ident(n):
    return f"decode('{n:032x}', 'hex')"


def register(n):
    require(sql(f"SELECT core_zone.register_entity(1::smallint, {ident(n)}, 1, 1);") == "1",
            f"registration must start epoch 1: {n}")


def prepare(op, entity, worker=1, epoch=1, target=2):
    return (
        f"SELECT core_zone.prepare_transfer({ident(op)}, 1::smallint, "
        f"{ident(entity)}, {worker}, {worker}, {epoch}, {target}, {target});"
    )


def mutate(op, entity, worker=1, epoch=1, revision=0):
    payload = "decode('7374617465', 'hex')"  # b"state"
    return (
        "SELECT world_revision, outbox_sequence, replay "
        "FROM core_zone.commit_world_mutation("
        f"{ident(op)}, 1::smallint, {ident(entity)}, {worker}, "
        f"{worker}, {epoch}, {revision}, {payload});"
    )


def current(entity, worker=1, epoch=1):
    return sql(
        f"SELECT core_zone.is_current(1::smallint, {ident(entity)}, "
        f"{worker}, {worker}, {epoch});"
    ) == "t"


def count(table, column, n):
    return int(sql(f"SELECT count(*) FROM core_zone.{table} WHERE {column}={ident(n)};"))


def docker(*args):
    return subprocess.run(
        ["docker", *args], check=True, capture_output=True, text=True, timeout=25,
    ).stdout.strip()


def guarded_container():
    # Require all test-only facts BEFORE issuing a Docker control command.
    require(os.environ.get("CI") == "true" and
            os.environ.get("GITHUB_ACTIONS") == "true" and
            os.environ.get("MYASO_C4H_TEST_ONLY") == "1",
            "GitHub Actions and C4h test opt-in required")
    require(os.environ.get("PGHOST") == "127.0.0.1" and
            os.environ.get("PGDATABASE") == TEST_DB and
            os.environ.get("PGUSER") == TEST_DB and
            os.environ.get("PGPORT") == "5432",
            "only disposable localhost C4h database/user/port allowed")

    container = os.environ.get("C4H_TEST_POSTGRES_CONTAINER", "")
    require(len(container) >= 12 and
            all(ch in "0123456789abcdef" for ch in container),
            "requires exact GitHub Actions service container ID")
    info = json.loads(docker("inspect", "--format", "{{json .}}", container))
    config = info.get("Config") or {}
    require(config.get("Image") == "postgres:16", "must be ephemeral postgres:16 image")
    environment = set(config.get("Env") or [])
    require(f"POSTGRES_USER={TEST_DB}" in environment and
            f"POSTGRES_DB={TEST_DB}" in environment and
            "POSTGRES_PASSWORD=ephemeral-test-only" in environment and
            "GITHUB_ACTIONS=true" in environment,
            "not the isolated GitHub Actions C4h database service")
    require(info.get("Id", "").startswith(container) and
            info.get("State", {}).get("Running") is True,
            "exact test service must exist and be running")
    require(sql("SHOW fsync;") == "on" and
            sql("SHOW synchronous_commit;") == "on",
            "test primary must have fsync and synchronous commits enabled")
    return container


def open_uncommitted_transaction(statement, marker):
    client = subprocess.Popen(
        ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE, text=True, bufsize=1,
    )
    try:
        require(client.stdin is not None, "psql stdin required")
        client.stdin.write("BEGIN;\n")
        client.stdin.write(statement + "\n")
        client.stdin.write(f"SELECT '{marker}';\n")
        client.stdin.flush()
        for _ in range(100):
            require(client.poll() is None, f"psql exited before {marker}")
            ready = sql(
                "SELECT count(*) FROM pg_catalog.pg_stat_activity "
                "WHERE datname=current_database() AND pid <> pg_backend_pid() "
                "AND state='idle in transaction' "
                f"AND query LIKE '%{marker}%';"
            )
            if ready == "1":
                return client
            time.sleep(0.1)
        raise AssertionError(f"open transaction did not reach marker: {marker}")
    except BaseException:
        if client.poll() is None:
            client.kill()
        client.communicate(timeout=6)
        raise


def wait_for_primary():
    deadline = time.monotonic() + 35
    while time.monotonic() < deadline:
        check = subprocess.run(
            ["pg_isready", "-h", "127.0.0.1", "-p", "5432",
             "-U", TEST_DB, "-d", TEST_DB],
            capture_output=True, text=True, check=False, timeout=4,
        )
        if check.returncode == 0:
            # A reconnect must succeed, not just a socket reporting readiness.
            try:
                if sql("SELECT 1;") == "1":
                    return
            except (AssertionError, subprocess.TimeoutExpired):
                pass
        time.sleep(0.25)
    raise AssertionError("disposable primary did not recover within 35 seconds")


def seed():
    register(71)
    first = sql(mutate(7101, 71))
    require(first.startswith("1|") and first.endswith("|f"), "initial mutation")
    require(sql(prepare(7111, 71)) == "prepared", "prepare committed handoff")
    require(sql(f"SELECT core_zone.commit_transfer({ident(7111)});") == "2",
            "new owner epoch 2")
    successor = sql(mutate(7102, 71, 2, 2, 1))
    require(successor.startswith("2|") and successor.endswith("|f"),
            "successor mutation before crash")
    require(count("world_event_outbox", "entity_id", 71) == 2,
            "two committed outbox events before crash")

    register(72)
    require(sql(prepare(7201, 72, target=3)) == "prepared",
            "durably prepared but not resolved")
    require(not current(72) and not current(72, 3, 2),
            "both workers frozen by persisted prepare")
    register(73)
    register(74)


def verify_after_primary_restart():
    require(not current(71) and current(71, 2, 2),
            "committed owner/epoch must survive primary process death")
    require(count("world_state", "entity_id", 71) == 1, "committed world state")
    require(sql(f"SELECT revision FROM core_zone.world_state "
                f"WHERE entity_id={ident(71)};") == "2", "revision two survived")
    require(count("world_event_outbox", "entity_id", 71) == 2,
            "both committed outbox events survived exactly once")
    require(count("world_mutation_receipts", "entity_id", 71) == 2,
            "both mutation receipts survive")
    require(sql(mutate(7101, 71)).endswith("|t"),
            "historical source replay only returns receipt")
    require(sql(mutate(7102, 71, 2, 2, 1)).endswith("|t"),
            "historical successor replay only returns receipt")
    sql(mutate(7103, 71, 1, 1, 2), expect_failure=True)
    require(count("world_event_outbox", "entity_id", 71) == 2,
            "stale source cannot create events after primary restart")
    require(sql(f"SELECT core_zone.commit_transfer({ident(7111)});") == "2",
            "handoff ACK replay cannot spend a second epoch")
    print("PASS: committed epochs, receipts, world revisions and outbox survive crash")

    require(not current(72) and not current(72, 3, 2),
            "durably prepared handoff stays frozen across primary restart")
    sql(mutate(7202, 72), expect_failure=True)
    require(sql(prepare(7201, 72, target=3)) == "prepared",
            "exact persisted prepared replay must not unfreeze")
    require(sql(f"SELECT core_zone.abort_transfer({ident(7201)});") == "aborted",
            "explicit recovery resolution required")
    require(current(72), "abort restores source at original epoch")
    sql(prepare(7201, 72, target=3), expect_failure=True)
    require(sql(prepare(7203, 72, target=3)) == "prepared",
            "new operation ID may be prepared after abort")
    require(sql(f"SELECT core_zone.commit_transfer({ident(7203)});") == "2",
            "new recovery handoff advances only once")
    require(current(72, 3, 2) and not current(72),
            "old source fenced by new committed epoch")
    print("PASS: durably prepared handoff survives primary restart frozen")

    require(current(73), "uncommitted world op cannot change ownership")
    require(count("world_state", "entity_id", 73) == 0 and
            count("world_mutation_receipts", "mutation_id", 7301) == 0 and
            count("world_event_outbox", "entity_id", 73) == 0,
            "uncommitted mutation must fully roll back on primary crash")
    fresh = sql(mutate(7301, 73))
    require(fresh.startswith("1|") and fresh.endswith("|f"),
            "rolled back operation ID is retryable once")
    require(sql(mutate(7301, 73)).endswith("|t"),
            "repeated retry returns original receipt")
    require(count("world_event_outbox", "entity_id", 73) == 1,
            "one outbox after post-crash retry")
    print("PASS: in-flight world transaction rolled back on primary crash")

    require(current(74) and count("handoffs", "operation_id", 7401) == 0,
            "uncommitted prepare/freeze must roll back on primary crash")
    require(sql(prepare(7401, 74)) == "prepared",
            "rolled-back handoff ID available to retry")
    require(sql(f"SELECT core_zone.commit_transfer({ident(7401)});") == "2",
            "retry transfers to new epoch only once")
    require(current(74, 2, 2) and not current(74),
            "source fenced after recovery")
    print("PASS: in-flight prepare/freeze rolled back on primary crash")


def main():
    container = guarded_container()
    seed()
    clients = []
    try:
        clients.append(open_uncommitted_transaction(
            mutate(7301, 73), MARKERS[0],
        ))
        clients.append(open_uncommitted_transaction(
            prepare(7401, 74), MARKERS[1],
        ))
        # Only the exact prevalidated ephemeral CI PostgreSQL service is
        # killed. Do not kill any client, production server or host process.
        docker("kill", "--signal=KILL", container)
        print("C4H: isolated PostgreSQL 16 process was SIGKILLed")
    finally:
        for client in clients:
            if client.poll() is None:
                client.kill()
            client.communicate(timeout=6)
        # Restore the exact same CI service, not a replacement primary.
        state = json.loads(docker("inspect", "--format", "{{json .}}", container))
        if not state.get("State", {}).get("Running"):
            docker("start", container)
    wait_for_primary()
    verify_after_primary_restart()
    print("C4H PRIMARY CRASH ACCEPTANCE PASSED (one disposable PG16 primary)")


if __name__ == "__main__":
    main()
