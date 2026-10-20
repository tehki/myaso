#!/usr/bin/env python3
"""C4d isolated PostgreSQL mutation/receipt/outbox acceptance.

Requires explicit MYASO_C4D_TEST_ONLY=1 and a fresh disposable PGDATABASE.
Uses separate psql connections to the SAME isolated primary. Not gameplay.
"""
import concurrent.futures
import os
import subprocess
import threading


def check(ok, message):
    if not ok:
        raise AssertionError(message)


def db(sql, error=False):
    result = subprocess.run(
        ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql],
        capture_output=True, text=True, timeout=15,
    )
    if error:
        check(result.returncode != 0, f"expected failure: {sql}")
    else:
        check(result.returncode == 0, f"{sql}\n{result.stderr}")
    lines = result.stdout.strip().splitlines()
    return lines[-1].strip() if lines else ""


def ident(i):
    return f"decode('{i:032x}', 'hex')"


def blob(data):
    return f"decode('{data.encode().hex()}', 'hex')"


def register(i):
    check(db(f"SELECT core_zone.register_entity(1::smallint, {ident(i)}, 1, 1);") == "1", "register")


def world(op, i, worker=1, zone=1, epoch=1, revision=0, payload="state-A", *, error=False):
    return db(
        "SELECT world_revision, outbox_sequence, replay "
        "FROM core_zone.commit_world_mutation("
        f"{ident(op)}, 1::smallint, {ident(i)}, "
        f"{worker}, {zone}, {epoch}, {revision}, {blob(payload)});",
        error=error,
    )


def transfer(op, i, worker, zone, epoch, target_worker, target_zone):
    return db(
        f"SELECT core_zone.prepare_transfer({ident(op)}, 1::smallint, "
        f"{ident(i)}, {worker}, {zone}, {epoch}, {target_worker}, {target_zone});"
    )


def state(i):
    return db(f"SELECT revision::text || '|' || encode(payload, 'hex') "
              f"FROM core_zone.world_state WHERE entity_kind=1 AND entity_id={ident(i)};")


def outbox(i):
    return db(f"SELECT count(*) FROM core_zone.world_event_outbox "
              f"WHERE entity_kind=1 AND entity_id={ident(i)};")


def test_zero_mutation_identifiers_fail_closed():
    register(20)
    world(0, 20, error=True)
    world(2010, 0, error=True)
    check(state(20) == "", "invalid IDs must not create world state")
    check(outbox(20) == "0", "invalid IDs must not create world events")
    check(
        db(f"SELECT count(*) FROM core_zone.world_mutation_receipts "
           f"WHERE mutation_id={ident(0)};") == "0",
        "zero mutation ID must not create a receipt",
    )
    print("PASS: zero mutation/entity IDs reject without state or receipts")


def test_commit_and_handoff():
    register(11)
    first = world(1001, 11)
    a = first.split("|")
    check(len(a) == 3 and a[0] == "1" and a[2] == "f", f"new receipt: {first}")
    check(outbox(11) == "1", "one initial event")
    check(world(1001, 11) == f"1|{a[1]}|t", "original receipt on ACK loss")
    check(outbox(11) == "1", "repeated operation cannot create outbox event")
    world(1001, 11, payload="tampered", error=True)
    world(1002, 11, revision=0, payload="wrong-version", error=True)
    check(outbox(11) == "1", "failure must roll back receipts and outbox")
    check(state(11) == "1|73746174652d41", "world bytes preserved")

    check(transfer(9001, 11, 1, 1, 1, 2, 2) == "prepared", "handoff freeze")
    world(1003, 11, revision=1, payload="old-worker-frozen", error=True)
    check(outbox(11) == "1", "pending handoff froze game writes")
    check(db(f"SELECT core_zone.commit_transfer({ident(9001)});") == "2", "commit handoff")
    world(1003, 11, revision=1, payload="old-worker-frozen", error=True)
    second = world(1004, 11, worker=2, zone=2, epoch=2, revision=1, payload="state-B")
    check(second.startswith("2|") and second.endswith("|f"), "new owner writes revision two")
    check(outbox(11) == "2", "exactly one successor outbox")
    check(world(1001, 11) == f"1|{a[1]}|t", "historical replay not new authority")
    world(1005, 11, worker=2, zone=2, epoch=1, revision=2, error=True)
    check(outbox(11) == "2", "wrong epoch cannot create world mutation")
    check(db(f"SELECT count(*) FROM core_zone.world_mutation_receipts "
             f"WHERE entity_kind=1 AND entity_id={ident(11)};") == "2",
          "exactly two committed idempotency receipts")

    world(1006, 11, worker=2, zone=2, epoch=2, revision=2, payload="x" * 4097, error=True)
    check(outbox(11) == "2", "oversize blocked")
    print("PASS: commit/state/outbox atomicity, replay, handoff freeze and stale epoch")


def test_independent_competing_writers():
    register(12)
    gate = threading.Barrier(3)

    def attempt(txn, data):
        gate.wait(timeout=10)
        sql = ("SELECT * FROM core_zone.commit_world_mutation("
               f"{ident(txn)}, 1::smallint, {ident(12)}, 1, 1, 1, 0, {blob(data)});")
        run = subprocess.run(
            ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql],
            capture_output=True, text=True, timeout=15,
        )
        return run.returncode == 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        a = executor.submit(attempt, 2001, "racer-A")
        b = executor.submit(attempt, 2002, "racer-B")
        gate.wait(timeout=10)
        outcomes = [a.result(timeout=20), b.result(timeout=20)]
    check(outcomes.count(True) == 1, f"exactly one update winner expected: {outcomes}")
    check(outbox(12) == "1", "loser did not create outbox")
    check(state(12).startswith("1|"), "world revision one")
    print("PASS: two independent clients cannot commit same expected revision")


def test_transaction_locks_out_handoff():
    register(13)
    process = subprocess.Popen(
        ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, bufsize=1,
    )
    try:
        check(process.stdin is not None and process.stdout is not None, "pipes")
        process.stdin.write(
            "BEGIN;\n"
            f"SELECT world_revision FROM core_zone.commit_world_mutation("
            f"{ident(3001)}, 1::smallint, {ident(13)}, 1, 1, 1, 0, {blob('inside-tx')});\n"
            "SELECT 'MUTATION_LOCK_HELD';\n"
        )
        process.stdin.flush()
        marker = False
        for _ in range(8):
            line = process.stdout.readline()
            if "MUTATION_LOCK_HELD" in line:
                marker = True
                break
        check(marker, "source transaction did not take world lock")
        db("SET lock_timeout='200ms'; "
           f"SELECT core_zone.prepare_transfer({ident(3002)}, 1::smallint, "
           f"{ident(13)}, 1, 1, 1, 2, 2);", error=True)
        check(outbox(13) == "0", "uncommitted world event invisible")
        process.stdin.write("COMMIT;\n\\q\n")
        process.stdin.flush()
        process.wait(timeout=8)
        check(process.returncode == 0, "source committed")
        check(outbox(13) == "1", "after commit outbox published once")
        check(transfer(3003, 13, 1, 1, 1, 2, 2) == "prepared", "handoff after commit")
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=3)
    print("PASS: handoff waits for world mutation transaction commit")


def test_restricted_executor():
    register(14)
    role = "myaso_c4d_restricted"
    db(f"CREATE ROLE {role} NOLOGIN;")
    db(f"GRANT USAGE ON SCHEMA core_zone TO {role};")
    db(f"GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA core_zone TO {role};")
    db(f"SET ROLE {role}; SELECT * FROM core_zone.world_state;", error=True)
    db(f"SET ROLE {role}; INSERT INTO core_zone.world_event_outbox "
       f"(mutation_id, entity_kind, entity_id, authority_epoch, world_revision, payload) "
       f"VALUES ({ident(4999)}, 1, {ident(14)}, 1, 1, {blob('forged')});", error=True)
    accepted = db(
        f"SET ROLE {role}; SELECT world_revision, replay FROM "
        f"core_zone.commit_world_mutation({ident(4001)}, 1::smallint, "
        f"{ident(14)}, 1, 1, 1, 0, {blob('restricted')});"
    )
    check(accepted == "1|f", f"limited trusted function should work: {accepted}")
    check(outbox(14) == "1", "one event from authorized function")
    print("PASS: restricted role can call trusted function but cannot DML world state")


def main():
    check(os.environ.get("MYASO_C4D_TEST_ONLY") == "1", "test-only approval required")
    check(os.environ.get("PGDATABASE") == "myaso_c4d_test", "disposable database required")
    test_zero_mutation_identifiers_fail_closed()
    test_commit_and_handoff()
    test_independent_competing_writers()
    test_transaction_locks_out_handoff()
    test_restricted_executor()
    print("C4D POSTGRES MUTATION ACCEPTANCE PASSED (isolated single primary)")


if __name__ == "__main__":
    main()
