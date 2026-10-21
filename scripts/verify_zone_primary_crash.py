#!/usr/bin/env python3
"""C4h test ONLY: SIGKILL one ephemeral GitHub Actions PostgreSQL 16 container.

This validates single-primary crash-restart state and transactional fencing.
It does NOT test host power loss, promotion, WAN partitions, or production.
"""
import json
import os
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor

TEST_DB = "myaso_c4h_test"
MARKERS = (
    "C4H_OPEN_WORLD_7301",
    "C4H_OPEN_HANDOFF_7401",
    "C4H_OPEN_COMMIT_7501",
    "C4H_OPEN_RETIRE_7601",
    "C4H_OPEN_ABORT_7701",
)


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
    register(75)
    require(sql(prepare(7501, 75)) == "prepared",
            "durably prepared handoff for interrupted commit")
    register(76)
    register(77)
    require(sql(prepare(7701, 77, target=4)) == "prepared",
            "durably prepared handoff for interrupted abort")
    register(78)
    register(79)
    register(80)
    register(81)


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

    require(not current(75) and not current(75, 2, 2),
            "uncommitted transfer COMMIT must remain durably prepared/frozen")
    require(sql(f"SELECT phase FROM core_zone.handoffs "
                f"WHERE operation_id={ident(7501)};") == "prepared",
            "in-flight committed-phase transition must roll back")
    require(sql(f"SELECT core_zone.commit_transfer({ident(7501)});") == "2",
            "retied commit must advance once after primary restart")
    require(sql(f"SELECT core_zone.commit_transfer({ident(7501)});") == "2",
            "historical handoff ACK cannot advance epoch twice")
    require(current(75, 2, 2) and not current(75),
            "new worker alone owns committed transfer")
    print("PASS: in-flight handoff commit rolled back to durable freeze")

    require(current(76), "uncommitted retirement cannot revoke living entity")
    require(sql(f"SELECT retired FROM core_zone.entities "
                f"WHERE entity_id={ident(76)};") == "f",
            "primary crash must roll back retirement tombstone")
    sql(f"SELECT core_zone.retire_entity(1::smallint, {ident(76)}, 1, 1, 1);")
    require(not current(76), "new committed retirement revokes authority")
    sql(f"SELECT core_zone.register_entity(1::smallint, {ident(76)}, 1, 1);",
        expect_failure=True)
    require(sql(f"SELECT retired FROM core_zone.entities "
                f"WHERE entity_id={ident(76)};") == "t",
            "committed tombstone must remain irreversible")
    print("PASS: in-flight retirement rolls back; committed tombstone permanent")

    require(not current(77) and not current(77, 4, 2),
            "uncommitted abort must NOT unfreeze prepared handoff")
    require(sql(f"SELECT phase FROM core_zone.handoffs "
                f"WHERE operation_id={ident(7701)};") == "prepared",
            "interrupted abort must leave durable prepared operation")
    require(sql(f"SELECT core_zone.abort_transfer({ident(7701)});") == "aborted",
            "authorized abort replay can safely resolve frozen source")
    require(sql(f"SELECT core_zone.abort_transfer({ident(7701)});") == "aborted",
            "abort ACK replay returns same result")
    require(current(77), "resolved abort restores same source epoch")
    sql(prepare(7701, 77, target=4), expect_failure=True)
    require(count("handoffs", "operation_id", 7701) == 1,
            "aborted operation cannot be reused or duplicated")
    print("PASS: in-flight handoff abort rolled back to durable freeze")


def racing_mutations(*statements):
    """Release two independent psql callers together; inspect BOTH outcomes."""
    require(len(statements) == 2, "exactly two contenders required")
    barrier = threading.Barrier(2)

    def contender(statement):
        barrier.wait(timeout=6)
        return subprocess.run(
            ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
             "-c", statement],
            capture_output=True, text=True, check=False, timeout=12,
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        left = pool.submit(contender, statements[0])
        right = pool.submit(contender, statements[1])
        return left.result(timeout=20), right.result(timeout=20)


def test_concurrent_fencing_after_primary_restart():
    # Both operations are valid individually, but commit_world_mutation must
    # serialize on the SAME entity authority row and allow just one revision 1.
    left, right = racing_mutations(mutate(7801, 78), mutate(7802, 78))
    require(sum(result.returncode == 0 for result in (left, right)) == 1,
            f"exactly one same-revision winner required: {left.stderr} {right.stderr}")
    winner_op = 7801 if left.returncode == 0 else 7802
    loser_op = 7802 if winner_op == 7801 else 7801
    loser = right if winner_op == 7801 else left
    require("world state revision conflict" in loser.stderr,
            f"loser must be rejected by revision CAS, not transport: {loser.stderr}")
    winner_receipt = sql(mutate(winner_op, 78))
    require(winner_receipt.startswith("1|") and winner_receipt.endswith("|t"),
            f"winner replay immutable: {winner_receipt}")
    require(count("world_mutation_receipts", "mutation_id", winner_op) == 1
            and count("world_mutation_receipts", "mutation_id", loser_op) == 0,
            "losing request must roll back provisional receipt")
    require(count("world_event_outbox", "entity_id", 78) == 1,
            "same-revision concurrent writers must not duplicate outbox")
    require(sql(f"SELECT revision FROM core_zone.world_state "
                f"WHERE entity_id={ident(78)};") == "1",
            "one authoritative revision after concurrent writes")
    sql(mutate(loser_op, 78), expect_failure=True)
    require(count("world_event_outbox", "entity_id", 78) == 1,
            "retrying stale expected revision must not insert any outbox")
    print("PASS: post-crash concurrent same-epoch CAS commits exactly one revision")

    # Different workers can race at the next revision after a durable handoff.
    # The old epoch is fenced independently of connection arrival ordering.
    require(sql(prepare(7900, 79)) == "prepared",
            "fresh post-crash handoff can freeze new entity")
    require(sql(f"SELECT core_zone.commit_transfer({ident(7900)});") == "2",
            "successor receives epoch 2 once")
    require(not current(79) and current(79, 2, 2),
            "old source revoked before concurrent requests")
    stale, successor = racing_mutations(
        mutate(7901, 79, 1, 1, 0),
        mutate(7902, 79, 2, 2, 0),
    )
    require(stale.returncode != 0
            and "stale or frozen world mutation authority" in stale.stderr,
            f"retired worker must be transaction-fenced: {stale.stderr}")
    require(successor.returncode == 0
            and successor.stdout.strip().startswith("1|")
            and successor.stdout.strip().endswith("|f"),
            f"new owner must commit exactly once: {successor.stderr} {successor.stdout}")
    require(count("world_event_outbox", "entity_id", 79) == 1
            and count("world_mutation_receipts", "mutation_id", 7901) == 0,
            "stale source cannot leave an outbox or receipt")
    require(sql(mutate(7902, 79, 2, 2, 0)).endswith("|t"),
            "new owner can replay its one historical receipt")
    sql(mutate(7901, 79, 1, 1, 0), expect_failure=True)
    require(count("world_event_outbox", "entity_id", 79) == 1,
            "stale retry cannot publish")
    print("PASS: post-crash racing stale/new epochs allow successor only")


def test_racing_handoff_operations_after_primary_restart():
    # Distinct handoff operation IDs both reference the same entity through
    # the handoffs FK. Neither may deadlock while securing exclusive mutation
    # authority; exactly one must freeze the original source.
    left, right = racing_mutations(
        prepare(8001, 80, target=2), prepare(8002, 80, target=3),
    )
    require(sum(result.returncode == 0 for result in (left, right)) == 1,
            f"exactly one prepare winner required: {left.stderr} {right.stderr}")
    winner_op = 8001 if left.returncode == 0 else 8002
    loser_op = 8002 if winner_op == 8001 else 8001
    target_worker = 2 if winner_op == 8001 else 3
    losing_result = right if winner_op == 8001 else left
    require("stale or already prepared authority" in losing_result.stderr
            and "deadlock detected" not in losing_result.stderr,
            f"loser must be fenced by pending handoff, never deadlock: {losing_result.stderr}")
    require(count("handoffs", "operation_id", winner_op) == 1
            and count("handoffs", "operation_id", loser_op) == 0,
            "losing handoff must leave no durable ID")
    require(not current(80) and not current(80, target_worker, 2),
            "prepared winner freezes both source and target")
    require(sql(f"SELECT core_zone.commit_transfer({ident(winner_op)});") == "2",
            "winner advances epoch once")
    require(current(80, target_worker, 2) and not current(80),
            "new owner alone authoritative")
    sql(prepare(loser_op, 80, target=3 if target_worker == 2 else 2),
        expect_failure=True)
    require(count("handoffs", "operation_id", loser_op) == 0,
            "loser retry must remain fenced")
    print("PASS: concurrent handoff IDs freeze once without FK row-lock deadlock")

    # A source-state mutation and a different-ID zone prepare contend for the
    # same live entity. Either the mutation commits before the freeze, or it
    # is rejected after the freeze; both paths must have one coherent result.
    mutation, handoff = racing_mutations(
        mutate(8101, 81), prepare(8102, 81, target=4),
    )
    require(handoff.returncode == 0 and handoff.stdout.strip() == "prepared",
            f"handoff must freeze after any completed earlier mutation: {handoff.stderr}")
    require(count("handoffs", "operation_id", 8102) == 1,
            "exactly one durable handoff")
    require(not current(81) and not current(81, 4, 2),
            "both workers frozen after concurrent prepare")
    mutation_committed = mutation.returncode == 0
    if mutation_committed:
        require(mutation.stdout.strip().startswith("1|")
                and mutation.stdout.strip().endswith("|f"),
                "pre-freeze mutation committed exactly once")
        require(sql(mutate(8101, 81)).endswith("|t"),
                "pre-freeze mutation receipt remains historical")
    else:
        require("stale or frozen world mutation authority" in mutation.stderr
                and "deadlock detected" not in mutation.stderr,
                f"post-freeze mutation must reject stale claim: {mutation.stderr}")
    require(count("world_event_outbox", "entity_id", 81) == int(mutation_committed)
            and count("world_mutation_receipts", "mutation_id", 8101) == int(mutation_committed),
            "no partial receipt/outbox after racing handoff and mutation")
    require(sql(f"SELECT core_zone.commit_transfer({ident(8102)});") == "2",
            "target epoch two after concurrent race")
    require(current(81, 4, 2) and not current(81),
            "old writer fenced when handoff commits")
    sql(mutate(8103, 81, 1, 1, int(mutation_committed)), expect_failure=True)
    fresh = sql(mutate(8104, 81, 4, 2, int(mutation_committed)))
    require(fresh.endswith("|f"),
            f"new owner may mutate next revision: {fresh}")
    require(count("world_event_outbox", "entity_id", 81) == int(mutation_committed) + 1,
            "successor creates one event, without stale duplication")
    print("PASS: racing handoff vs mutation serializes and fences old epoch")


def test_forced_handoff_fk_lock_contention():
    # Deterministically stage two explicit transactions with *different*
    # handoff operation IDs against one entity. The handoffs FK trigger holds
    # a compatible KEY SHARE lock on the parent entity for BOTH clients.
    # They then simultaneously invoke the trusted prepare function while
    # their own uncommitted handoff IDs are already inserted. This forces
    # the exact FK KEY SHARE -> authority-row lock-upgrade interleaving.
    register(82)
    clients = []
    choices = ((8201, 2), (8202, 3))
    try:
        for op, target in choices:
            statement = (
                "INSERT INTO core_zone.handoffs "
                "(operation_id, entity_kind, entity_id, "
                "source_worker, source_zone, source_epoch, "
                "target_worker, target_zone, phase) VALUES ("
                f"{ident(op)}, 1::smallint, {ident(82)}, "
                f"1, 1, 1, {target}, {target}, 'prepared');"
            )
            client = open_uncommitted_transaction(
                statement, f"C4H_HELD_HANDOFF_FK_{op}",
            )
            clients.append(client)
        require(len(clients) == 2, "must stage two independent FK locks")
        def release(index):
            op, target = choices[index]
            client = clients[index]
            require(client.stdin is not None, "staged client pipe required")
            client.stdin.write(prepare(op, 82, target=target) + "\nCOMMIT;\n")
            client.stdin.flush()
            client.stdin.close()
            client.wait(timeout=12)
            stderr = client.stderr.read() if client.stderr else ""
            return (client.returncode, stderr)

        # The test deliberately overlaps the two final statements. Both
        # transactions already hold their FK KEY SHARE, so even if release
        # calls are staggered the row-lock conflict is truly simultaneous.
        with ThreadPoolExecutor(max_workers=2) as pool:
            left_future = pool.submit(release, 0)
            right_future = pool.submit(release, 1)
            left = left_future.result(timeout=16)
            right = right_future.result(timeout=16)
        require(sum(result[0] == 0 for result in (left, right)) == 1,
                f"forced FK contention: one winner required, got {left} {right}")
        winner_op = 8201 if left[0] == 0 else 8202
        loser_op = 8202 if winner_op == 8201 else 8201
        loser = right if winner_op == 8201 else left
        require("deadlock detected" not in loser[1]
                and "stale or already prepared authority" in loser[1],
                f"held-FK loser must see fenced pending handoff: {loser}")
        target = 2 if winner_op == 8201 else 3
        require(count("handoffs", "operation_id", winner_op) == 1
                and count("handoffs", "operation_id", loser_op) == 0,
                "loser transaction must roll back its staged FK row")
        require(not current(82) and not current(82, target, 2),
                "winner leaves both workers frozen")
        require(sql(f"SELECT core_zone.commit_transfer({ident(winner_op)});") == "2",
                "only one handoff may transfer to epoch 2")
        require(current(82, target, 2) and not current(82),
                "old worker fenced after deterministic FK contention")
        print("PASS: forced dual-FK handoff race excludes lock-upgrade deadlocks")
    finally:
        for client in clients:
            if client.poll() is None:
                client.kill()
            client.wait(timeout=6)


def test_simultaneous_duplicate_operation_retries_after_primary_restart():
    # Both callers use the SAME immutable mutation ID and exact request.
    # This is the lost-ACK retry race, not the different-ID revision CAS case.
    register(83)
    left, right = racing_mutations(mutate(8301, 83), mutate(8301, 83))
    require(left.returncode == 0 and right.returncode == 0,
            f"duplicate mutation retries must both return receipts: {left.stderr} {right.stderr}")
    received = [left.stdout.strip(), right.stdout.strip()]
    require(all(receipt.startswith("1|") for receipt in received)
            and sorted(receipt.rsplit("|", 1)[-1] for receipt in received) == ["f", "t"],
            f"exactly one new mutation and one historical replay: {received}")
    require(received[0].split("|", 2)[1] == received[1].split("|", 2)[1],
            "both callers must receive the identical durable outbox sequence")
    require(count("world_mutation_receipts", "mutation_id", 8301) == 1
            and count("world_event_outbox", "entity_id", 83) == 1
            and count("world_state", "entity_id", 83) == 1,
            "simultaneous retries cannot insert extra state, receipts or events")
    require(sql(mutate(8301, 83)).endswith("|t"),
            "subsequent retry remains purely historical")
    conflicting_payload = mutate(8301, 83).replace(
        "decode('7374617465', 'hex')", "decode('6368616e676564', 'hex')")
    require(conflicting_payload != mutate(8301, 83), "payload conflict must differ")
    sql(conflicting_payload, expect_failure=True)
    require(count("world_mutation_receipts", "mutation_id", 8301) == 1
            and count("world_event_outbox", "entity_id", 83) == 1,
            "conflicting same operation ID must not rewrite durable result")
    print("PASS: simultaneous identical mutation retries share one receipt/outbox")

    # Two independent connections concurrently prepare one handoff operation
    # ID, then concurrently commit it. Prepared and committed ACK loss must
    # never advance an extra epoch or accidentally grant both owners.
    register(84)
    left, right = racing_mutations(
        prepare(8401, 84, target=3),
        prepare(8401, 84, target=3),
    )
    require(left.returncode == 0 and right.returncode == 0
            and left.stdout.strip() == "prepared"
            and right.stdout.strip() == "prepared",
            f"duplicate prepare must be idempotent: {left.stderr} {right.stderr}")
    require(count("handoffs", "operation_id", 8401) == 1
            and not current(84) and not current(84, 3, 2),
            "single durable prepare freezes both candidate workers")
    commit = f"SELECT core_zone.commit_transfer({ident(8401)});"
    left, right = racing_mutations(commit, commit)
    require(left.returncode == 0 and right.returncode == 0
            and left.stdout.strip() == "2" and right.stdout.strip() == "2",
            f"duplicate commit must return one epoch: {left.stderr} {right.stderr}")
    require(current(84, 3, 2) and not current(84)
            and count("handoffs", "operation_id", 8401) == 1,
            "simultaneous handoff retries must grant target only once")
    sql(prepare(8401, 84, target=2), expect_failure=True)
    require(sql(commit) == "2"
            and not current(84, 3, 3),
            "conflicting reuse is denied and historical ACK cannot advance epoch")
    print("PASS: simultaneous identical prepare/commit retries advance epoch once")


def test_commit_vs_abort_resolution_race_after_primary_restart():
    # Recovery coordinators can disagree: one may retry the final commit
    # while another attempts an abort for the SAME durably prepared handoff.
    # The handoff row lock must linearize their decisions; exactly one wins
    # and no two workers can hold mutation authority.
    register(85)
    require(sql(prepare(8501, 85, target=3)) == "prepared",
            "commit-vs-abort race needs one durable prepared handoff")
    require(not current(85) and not current(85, 3, 2),
            "neither worker writes during the prepared window")
    commit_statement = f"SELECT core_zone.commit_transfer({ident(8501)});"
    abort_statement = f"SELECT core_zone.abort_transfer({ident(8501)});"
    committed, aborted = racing_mutations(commit_statement, abort_statement)
    require(sum(result.returncode == 0 for result in (committed, aborted)) == 1,
            f"commit vs abort must have one successful outcome: "
            f"{committed.stderr} {aborted.stderr}")
    require("deadlock detected" not in committed.stderr
            and "deadlock detected" not in aborted.stderr,
            "one-operation decision race must serialize without deadlock")
    phase = sql(f"SELECT phase FROM core_zone.handoffs "
                f"WHERE operation_id={ident(8501)};")
    require(count("handoffs", "operation_id", 8501) == 1,
            "competing resolution cannot duplicate handoff operation")
    if committed.returncode == 0:
        require(committed.stdout.strip() == "2"
                and "cannot abort committed or stale handoff" in aborted.stderr
                and phase == "committed",
                "commit winning requires abort to observe committed phase")
        require(not current(85) and current(85, 3, 2),
                "committed outcome grants only the target at epoch two")
        require(sql(commit_statement) == "2",
                "commit ACK retry cannot advance a second epoch")
        sql(abort_statement, expect_failure=True)
    else:
        require(aborted.stdout.strip() == "aborted"
                and "unprepared or stale handoff" in committed.stderr
                and phase == "aborted",
                "abort winning requires commit to observe aborted phase")
        require(current(85) and not current(85, 3, 2),
                "aborted outcome restores only the original source at epoch one")
        require(sql(abort_statement) == "aborted",
                "abort ACK retry must return immutable result")
        sql(commit_statement, expect_failure=True)
    require(count("world_event_outbox", "entity_id", 85) == 0,
            "resolution race must not forge or duplicate world events")
    print("PASS: commit-vs-abort same-handoff race has one permanent authority outcome")


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
        clients.append(open_uncommitted_transaction(
            f"SELECT core_zone.commit_transfer({ident(7501)});", MARKERS[2],
        ))
        clients.append(open_uncommitted_transaction(
            f"SELECT core_zone.retire_entity(1::smallint, {ident(76)}, 1, 1, 1);",
            MARKERS[3],
        ))
        clients.append(open_uncommitted_transaction(
            f"SELECT core_zone.abort_transfer({ident(7701)});", MARKERS[4],
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
    test_concurrent_fencing_after_primary_restart()
    test_racing_handoff_operations_after_primary_restart()
    test_forced_handoff_fk_lock_contention()
    test_simultaneous_duplicate_operation_retries_after_primary_restart()
    test_commit_vs_abort_resolution_race_after_primary_restart()
    print("C4H PRIMARY CRASH ACCEPTANCE PASSED (one disposable PG16 primary)")


if __name__ == "__main__":
    main()
