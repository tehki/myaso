#!/usr/bin/env python3
"""C3g isolated PostgreSQL item+world state/receipt/outbox atomicity tests.

Only run with MYASO_C3G_TEST_ONLY=1 and disposable database myaso_c3g_test.
This proves single-item SQL transaction semantics, NOT trusted game admission.
"""
import concurrent.futures
import os
import subprocess
import threading


def check(value, message):
    if not value:
        raise AssertionError(message)


def sql(statement, *, fails=False):
    p = subprocess.run(
        ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement],
        capture_output=True, text=True, timeout=25,
    )
    if fails:
        check(p.returncode != 0, "expected SQL rejection: " + statement + "\n" + p.stdout)
    else:
        check(p.returncode == 0, statement + "\n" + p.stderr)
    return p.stdout.strip().splitlines()[-1] if p.stdout.strip() else ""


def bid(value):
    return "decode('%032x', 'hex')" % value


def payload(message):
    return "decode('%s', 'hex')" % message.encode().hex()


def inv(character):
    return ("01" + ("%032x" % character) + "00" * 9)


def ground(zone, x=100, y=-200):
    return "04" + ("%016x" % zone) + "00" * 9 + (
        (x & 0xFFFFFFFF).to_bytes(4, "big") + (y & 0xFFFFFFFF).to_bytes(4, "big")
    ).hex()


def literal(location):
    return "NULL::bytea" if location is None else "decode('%s', 'hex')" % location


def register(character, worker=1, zone=1):
    check(
        sql(f"SELECT core_zone.register_entity(1::smallint, {bid(character)}, {worker}, {zone});") == "1",
        "register character"
    )


def mutation(op, world_op, entity, item, mode, item_rev, before, after,
             *, worker=1, zone=1, epoch=1, world_rev=0, world_data="state",
             fails=False):
    return sql(
        "SELECT world_revision, item_revision, outbox_sequence, replay "
        "FROM core_zone.commit_item_world_mutation("
        f"{bid(op)}, {bid(world_op)}, 1::smallint, {bid(entity)}, "
        f"{worker}, {zone}, {epoch}, {world_rev}, {payload(world_data)}, "
        f"{bid(item)}, {mode}::smallint, {item_rev}, {literal(before)}, {literal(after)});",
        fails=fails,
    )


def item_state(item):
    return sql("SELECT revision::text || '|' || COALESCE(encode(location,'hex'), 'retired') "
               f"FROM core_zone.item_state WHERE item_id={bid(item)};")


def world_revision(entity):
    return sql("SELECT revision FROM core_zone.world_state "
               f"WHERE entity_kind=1 AND entity_id={bid(entity)};")


def counts(entity, item):
    return (
        sql("SELECT count(*) FROM core_zone.world_event_outbox "
            f"WHERE entity_kind=1 AND entity_id={bid(entity)};"),
        sql("SELECT count(*) FROM core_zone.item_world_outbox "
            f"WHERE item_id={bid(item)};"),
        sql("SELECT count(*) FROM core_zone.item_world_receipts "
            f"WHERE item_id={bid(item)};"),
    )


def test_create_move_destroy_retries_and_handoff():
    register(101)
    loc_a, loc_b = inv(101), ground(1)
    first = mutation(1001, 2001, 101, 901, 1, 0, None, loc_a)
    fields = first.split("|")
    check(len(fields) == 4 and fields[:2] == ["1", "1"] and fields[3] == "f", "create")
    check(counts(101, 901) == ("1", "1", "1"), "exactly one atomic create event")
    check(mutation(1001, 2001, 101, 901, 1, 0, None, loc_a) ==
          f"1|1|{fields[2]}|t", "lost-ACK retry returns original complete receipt")
    check(counts(101, 901) == ("1", "1", "1"), "retry never duplicates outbox")
    mutation(1001, 2001, 101, 901, 1, 0, None, loc_b, fails=True)
    mutation(1002, 2001, 101, 902, 1, 0, None, loc_a, world_rev=1, fails=True)
    mutation(1003, 2003, 101, 901, 1, 0, None, loc_a, world_rev=1, fails=True)
    check(world_revision(101) == "1", "failed create must roll back world change")

    # Corrupt canonical padded location is rejected BEFORE any world event.
    tampered = loc_b[:20] + "ff" + loc_b[22:]
    mutation(1004, 2004, 101, 901, 2, 1, loc_a, tampered, world_rev=1, fails=True)
    check(counts(101, 901) == ("1", "1", "1"), "bad location cannot publish")

    moved = mutation(1005, 2005, 101, 901, 2, 1, loc_a, loc_b, world_rev=1)
    check(moved.startswith("2|2|") and moved.endswith("|f"), "moving item+world")
    check(item_state(901) == "2|" + loc_b, "ground coordinate persisted")
    mutation(1006, 2006, 101, 901, 2, 1, loc_a, loc_b, world_rev=2, fails=True)
    check(counts(101, 901) == ("2", "2", "2"), "stale CAS never published")

    destroyed = mutation(1007, 2007, 101, 901, 3, 2, loc_b, None, world_rev=2)
    check(destroyed.startswith("3|3|"), "durable destruction")
    check(item_state(901) == "3|retired", "tombstone persists")
    mutation(1008, 2008, 101, 901, 1, 0, None, loc_a, world_rev=3, fails=True)
    check(counts(101, 901) == ("3", "3", "3"), "destroyed ID never resurrected")
    check(world_revision(101) == "3", "resurrection attempt rolled back")

    sql(f"SELECT core_zone.prepare_transfer({bid(9001)}, 1::smallint, "
        f"{bid(101)}, 1, 1, 1, 2, 2);")
    mutation(1009, 2009, 101, 903, 1, 0, None, loc_a, world_rev=3, fails=True)
    check(sql(f"SELECT core_zone.commit_transfer({bid(9001)});") == "2", "transfer")
    mutation(1009, 2009, 101, 903, 1, 0, None, loc_a, world_rev=3, fails=True)
    successor = mutation(1010, 2010, 101, 903, 1, 0, None, loc_a,
                         worker=2, zone=2, epoch=2, world_rev=3)
    check(successor.startswith("4|1|"), "new worker wins after handoff")
    check(counts(101, 903) == ("4", "1", "1"), "new worker only receipt")
    print("PASS: item create/move/destroy/retire, atomic world/outbox, idempotency, stale handoff")


def test_competing_writers_and_rollback():
    register(102)
    initial = inv(102)
    mutation(3001, 4001, 102, 902, 1, 0, None, initial)
    barrier = threading.Barrier(3)

    def attempt(op, dst):
        barrier.wait(timeout=10)
        return subprocess.run(
            ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c",
             "SELECT * FROM core_zone.commit_item_world_mutation("
             f"{bid(op)}, {bid(op+1000)}, 1::smallint, {bid(102)}, "
             f"1, 1, 1, 1, {payload('race')}, {bid(902)}, 2::smallint, 1, "
             f"{literal(initial)}, {literal(dst)});"],
            capture_output=True, text=True, timeout=20
        ).returncode == 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        a = pool.submit(attempt, 3002, ground(1, 1, 2))
        b = pool.submit(attempt, 3003, ground(1, 3, 4))
        barrier.wait(timeout=10)
        results = [a.result(timeout=20), b.result(timeout=20)]
    check(results.count(True) == 1, "concurrent contenders must elect exactly one")
    check(world_revision(102) == "2", "exactly one world version advance")
    check(counts(102, 902) == ("2", "2", "2"), "one committed item + world outbox")
    print("PASS: two independent PostgreSQL contenders produce one atomic winner")

    register(103)
    call = (
        "SELECT * FROM core_zone.commit_item_world_mutation("
        f"{bid(5001)}, {bid(6001)}, 1::smallint, {bid(103)}, "
        f"1,1,1,0,{payload('doomed')},{bid(904)},1::smallint,0,NULL::bytea,{literal(inv(103))});"
    )
    sql("BEGIN; " + call + " ROLLBACK;")
    check(world_revision(103) == "", "explicit rollback loses world state")
    check(item_state(904) == "", "explicit rollback loses item state")
    check(counts(103, 904) == ("0", "0", "0"), "rollback loses receipts and outbox")
    check(mutation(5001, 6001, 103, 904, 1, 0, None, inv(103)).startswith("1|1|"),
          "same id can succeed after previous complete rollback")
    print("PASS: outer PostgreSQL rollback undoes all item, world, receipt and outbox writes")


def test_crashed_uncommitted_writer():
    register(104)
    p = subprocess.Popen(
        ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, bufsize=1,
    )
    try:
        check(p.stdin and p.stdout, "psql pipes")
        query = (
            "SELECT * FROM core_zone.commit_item_world_mutation("
            f"{bid(7001)}, {bid(8001)}, 1::smallint, {bid(104)},"
            f"1,1,1,0,{payload('uncommitted')},{bid(905)},1::smallint,0,"
            f"NULL::bytea,{literal(inv(104))});"
        )
        p.stdin.write("BEGIN;\n" + query + "\nSELECT 'ITEM_WORLD_UNCOMMITTED';\n")
        p.stdin.flush()
        observed = False
        for _ in range(12):
            line = p.stdout.readline()
            if "ITEM_WORLD_UNCOMMITTED" in line:
                observed = True
                break
        check(observed, "must observe uncommitted, durable-lock-holding writer")
        p.kill()
        p.wait(timeout=8)
        check(item_state(905) == "" and world_revision(104) == "",
              "SIGKILL before outer commit must undo item and world")
        check(counts(104, 905) == ("0", "0", "0"), "SIGKILL must not leave phantom receipts")
        check(mutation(7001, 8001, 104, 905, 1, 0, None, inv(104)).startswith("1|1|"),
              "retry after crash should commit exactly once")
    finally:
        if p.poll() is None:
            p.kill()
            p.wait(timeout=8)
    print("PASS: real SIGKILL of uncommitted writer + retry after rollback")


def test_restricted_db_role():
    register(105)
    role = "myaso_c3g_restricted"
    sql("CREATE ROLE " + role + " NOLOGIN")
    sql("GRANT USAGE ON SCHEMA core_zone TO " + role)
    sql("GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA core_zone TO " + role)
    sql(f"SET ROLE {role}; SELECT * FROM core_zone.item_state;", fails=True)
    sql(f"SET ROLE {role}; INSERT INTO core_zone.item_state "
        f"(item_id, revision, location) VALUES ({bid(999)},1,{literal(inv(105))});", fails=True)
    sql(f"SET ROLE {role}; INSERT INTO core_zone.item_world_outbox "
        f"(outbox_sequence, operation_id, item_id, operation_kind, item_revision) "
        f"VALUES (1,{bid(9999)},{bid(999)},1,1);", fails=True)
    response = sql(
        f"SET ROLE {role}; SELECT world_revision, item_revision, replay "
        "FROM core_zone.commit_item_world_mutation("
        f"{bid(9001)}, {bid(9002)}, 1::smallint, {bid(105)}, "
        f"1,1,1,0,{payload('restricted')},{bid(906)},1::smallint,0,"
        f"NULL::bytea,{literal(inv(105))});"
    )
    check(response == "1|1|f", "trusted definer function remains callable")
    check(counts(105, 906) == ("1", "1", "1"), "only function committed")
    print("PASS: no direct DML from restricted DB role")


def main():
    check(os.environ.get("MYASO_C3G_TEST_ONLY") == "1", "explicit test-only gate required")
    check(os.environ.get("PGDATABASE") == "myaso_c3g_test", "fresh disposable PG DB required")
    test_create_move_destroy_retries_and_handoff()
    test_competing_writers_and_rollback()
    test_crashed_uncommitted_writer()
    test_restricted_db_role()
    print("C3G ITEM + WORLD + RECEIPT + OUTBOX ATOMIC POSTGRES ACCEPTANCE PASSED")


if __name__ == "__main__":
    main()
