#!/usr/bin/env python3
"""C3k isolated two-item corpse -> inventory PostgreSQL transaction acceptance.

This deliberately omits live actor permission checks and only proves SQL
atomicity, fencing, source CAS, shared global IDs and crash recovery.
"""
import concurrent.futures
import os
import subprocess
import threading

import verify_atomic_item_world_pg as c3g
import verify_atomic_equipment_swaps_pg as c3i


def check(ok, message):
    if not ok:
        raise AssertionError(message)


def corpse(corpse_id):
    return "03" + ("%032x" % corpse_id) + "00" * 9


def setup(c, corpse_id, a, b):
    c3g.register(c)
    src = corpse(corpse_id)
    check(c3g.mutation(c+10000, c+20000, c, a, 1, 0, None, src)
          .startswith("1|1|"), "initial first corpse item")
    check(c3g.mutation(c+10001, c+20001, c, b, 1, 0, None, src, world_rev=1)
          .startswith("2|1|"), "initial second corpse item")
    return src, c3g.inv(c)


def loot(op, world_op, c, corpse_id, a, arev, b, brev, *,
         worker=1, zone=1, epoch=1, world_rev=2, data="loot", fails=False):
    return c3g.sql(
        "SELECT world_revision,item_a_revision,item_b_revision,outbox_sequence,replay "
        "FROM core_zone.commit_two_item_corpse_loot("
        f"{c3g.bid(op)}, {c3g.bid(world_op)}, {c3g.bid(c)}, {c3g.bid(corpse_id)}, "
        f"{worker},{zone},{epoch},{world_rev},{c3g.payload(data)},"
        f"{c3g.bid(a)},{arev},{c3g.bid(b)},{brev});",
        fails=fails,
    )


def receipt_count(op):
    return c3g.sql("SELECT count(*) FROM core_zone.item_corpse_loot_receipts "
                   f"WHERE operation_id={c3g.bid(op)};")


def delta_count(op):
    return c3g.sql("SELECT count(*) FROM core_zone.item_corpse_loot_outbox "
                   f"WHERE operation_id={c3g.bid(op)};")


def test_pair_atomicity_and_idempotency():
    c, co, a, b = 3101, 7101, 9101, 9102
    old, new = setup(c, co, a, b)
    result = loot(41001, 42001, c, co, a, 1, b, 1)
    fields = result.split("|")
    check(len(fields) == 5 and fields[:3] == ["3", "2", "2"]
          and fields[4] == "f", "world+both item revisions commit")
    check(c3g.item_state(a) == "2|" + new and c3g.item_state(b) == "2|" + new,
          "both corpse items arrive in one inventory")
    check(delta_count(41001) == "2" and receipt_count(41001) == "1",
          "one complete receipt and exactly two item deltas")
    check(c3g.sql("SELECT count(*) FROM core_zone.world_event_outbox "
                  f"WHERE mutation_id={c3g.bid(42001)};") == "1",
          "one world event with both linked item deltas")
    check(c3g.sql("SELECT count(DISTINCT outbox_sequence) "
                  "FROM core_zone.item_corpse_loot_outbox "
                  f"WHERE operation_id={c3g.bid(41001)};") == "1",
          "both item deltas belong to same world outbox")
    check(loot(41001, 42001, c, co, a, 1, b, 1) ==
          f"3|2|2|{fields[3]}|t", "lost ACK exact retry returns original result")
    loot(41001, 42001, c, co, a, 1, b, 1, data="tampered", fails=True)
    loot(41002, 42002, c, co, a, 1, b, 1, world_rev=3, fails=True)
    check(c3g.world_revision(c) == "3" and receipt_count(41002) == "0",
          "stale source CAS cannot advance world or receipt")
    print("PASS: two items one corpse, one world event, immutable ACK replay")


def test_no_half_loot_and_handoff():
    c, co, a, b = 3201, 7201, 9201, 9202
    src, inv = setup(c, co, a, b)
    # Make the second item stale using a third C3g world+item transaction.
    check(c3g.mutation(43001, 44001, c, b, 2, 1, src, inv, world_rev=2)
          .startswith("3|2|"), "one source item moved by prior transaction")
    loot(43002, 44002, c, co, a, 1, b, 1, world_rev=3, fails=True)
    check(c3g.item_state(a) == "1|" + src and c3g.item_state(b) == "2|" + inv,
          "failed batch cannot steal remaining valid source item")
    check(c3g.world_revision(c) == "3" and delta_count(43002) == "0",
          "failed second item rolls back world and first item movement")

    c2, co2, a2, b2 = 3301, 7301, 9301, 9302
    src2, inv2 = setup(c2, co2, a2, b2)
    c3g.sql("SELECT core_zone.prepare_transfer("
            f"{c3g.bid(47001)},1::smallint,{c3g.bid(c2)},1,1,1,2,2);")
    loot(45001, 46001, c2, co2, a2, 1, b2, 1, fails=True)
    check(c3g.item_state(a2) == "1|" + src2, "prepared handoff froze batch")
    check(c3g.sql(f"SELECT core_zone.commit_transfer({c3g.bid(47001)});") == "2",
          "handoff committed")
    loot(45001, 46001, c2, co2, a2, 1, b2, 1, fails=True)
    check(loot(45002, 46002, c2, co2, a2, 1, b2, 1,
               worker=2, zone=2, epoch=2).startswith("3|2|2|"),
          "new worker authority commits complete batch")
    check(c3g.item_state(a2) == "2|" + inv2 and c3g.item_state(b2) == "2|" + inv2,
          "fenced new worker moves both items")
    print("PASS: stale source and prepared/committed worker handoffs roll back")


def test_global_ids_and_world_only_replay():
    c, co, a, b = 3401, 7401, 9401, 9402
    src, _ = setup(c, co, a, b)
    check(c3g.sql("SELECT core_zone.commit_world_mutation("
                  f"{c3g.bid(48001)},1::smallint,{c3g.bid(c)},"
                  f"1,1,1,2,{c3g.payload('world-only')});") != "",
          "world-only committed")
    loot(49001, 48001, c, co, a, 1, b, 1, world_rev=2,
         data="world-only", fails=True)
    check(receipt_count(49001) == "0" and c3g.item_state(a) == "1|" + src,
          "world-only historical receipt cannot authorize new loot")

    # Earlier C3g receipt operation ID, new world ID => global family denial.
    loot(c + 10000, 48002, c, co, a, 1, b, 1, world_rev=3, fails=True)
    check(c3g.sql("SELECT operation_family FROM core_zone.item_operation_ids "
                  f"WHERE operation_id={c3g.bid(c+10000)};") == "1",
          "legacy single-item operation ID cannot be reused by corpse batch")

    # Earlier C3i swap operation ID, new corpse batch ID => family denial.
    cs, sa, sb = 3501, 9501, 9502
    loc_a, loc_b = c3i.init_pair(cs, sa, sb)
    check(c3i.swap(50001, 50002, cs, sa, 1, loc_a, sb, 1, loc_b)
          .startswith("3|2|2|"), "registered C3i swap operation ID")
    loot(50001, 50003, c, co, a, 1, b, 1, world_rev=3, fails=True)
    check(c3g.sql("SELECT operation_family FROM core_zone.item_operation_ids "
                  f"WHERE operation_id={c3g.bid(50001)};") == "2",
          "C3i swap ID cannot be reused for corpse loot")
    check(c3g.world_revision(c) == "3" and c3g.item_state(a) == "1|" + src,
          "ID conflicts do not mutate world or corpse items")
    print("PASS: historical world replay and C3g/C3i global operation ID conflicts")


def test_competing_looters_one_winner():
    owner, co, a, b = 3601, 7601, 9601, 9602
    src, _ = setup(owner, co, a, b)
    other = 3602
    c3g.register(other)
    gate = threading.Barrier(3)

    def attempt(c, op, world_op, world_rev):
        gate.wait(timeout=10)
        statement = (
            "SELECT * FROM core_zone.commit_two_item_corpse_loot("
            f"{c3g.bid(op)},{c3g.bid(world_op)},{c3g.bid(c)},"
            f"{c3g.bid(co)},1,1,1,{world_rev},{c3g.payload('competing')},"
            f"{c3g.bid(a)},1,{c3g.bid(b)},1);"
        )
        p = subprocess.run(
            ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement],
            capture_output=True, text=True, timeout=25
        )
        return p.returncode == 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        x = pool.submit(attempt, owner, 51001, 52001, 2)
        y = pool.submit(attempt, other, 51002, 52002, 0)
        gate.wait(timeout=10)
        outcomes = [x.result(timeout=25), y.result(timeout=25)]
    check(outcomes.count(True) == 1, "only one item batch can acquire source pair")
    winner = owner if outcomes[0] else other
    loser = other if outcomes[0] else owner
    inv = c3g.inv(winner)
    check(c3g.item_state(a) == "2|" + inv and c3g.item_state(b) == "2|" + inv,
          "both items end with one winner, never split")
    check(receipt_count(51001 if winner == owner else 51002) == "1",
          "winner retains one immutable batch receipt")
    check(receipt_count(51002 if winner == owner else 51001) == "0",
          "loser leaves no batch receipt")
    check(c3g.world_revision(loser) == ("" if loser == other else "2"),
          "loser world revision completely unchanged")
    print("PASS: independent workers contest identical corpse item pair, one atomic winner")


def test_sigkill_before_outer_commit():
    c, co, a, b = 3701, 7701, 9701, 9702
    src, _ = setup(c, co, a, b)
    p = subprocess.Popen(
        ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, bufsize=1,
    )
    try:
        statement = (
            "SELECT * FROM core_zone.commit_two_item_corpse_loot("
            f"{c3g.bid(53001)},{c3g.bid(54001)},{c3g.bid(c)},"
            f"{c3g.bid(co)},1,1,1,2,{c3g.payload('crash')},"
            f"{c3g.bid(a)},1,{c3g.bid(b)},1);"
        )
        check(p.stdin is not None and p.stdout is not None, "psql pipes")
        p.stdin.write("BEGIN;\n" + statement + "\nSELECT 'CORPSE_LOOT_UNCOMMITTED';\n")
        p.stdin.flush()
        found = False
        for _ in range(12):
            line = p.stdout.readline()
            if "CORPSE_LOOT_UNCOMMITTED" in line:
                found = True
                break
        check(found, "observed fully processed yet uncommitted corpse loot")
        p.kill()
        p.wait(timeout=8)
        check(c3g.world_revision(c) == "2" and receipt_count(53001) == "0",
              "SIGKILL rolls back world revision and batch receipt")
        check(c3g.item_state(a) == "1|" + src and c3g.item_state(b) == "1|" + src,
              "SIGKILL cannot strand one of the two items in inventory")
        check(delta_count(53001) == "0", "SIGKILL publishes no item outbox")
        check(c3g.sql("SELECT count(*) FROM core_zone.item_operation_ids "
                      f"WHERE operation_id={c3g.bid(53001)};") == "0",
              "uncommitted family-3 reservation rolls back")
        check(loot(53001, 54001, c, co, a, 1, b, 1, data="crash")
              .startswith("3|2|2|"), "post-SIGKILL same request recovers once")
    finally:
        if p.poll() is None:
            p.kill()
            p.wait(timeout=8)
    print("PASS: SIGKILL before COMMIT restores both items, world, receipt and global ID")


def test_restricted_role():
    c, co, a, b = 3801, 7801, 9801, 9802
    setup(c, co, a, b)
    role = "myaso_c3k_restricted"
    c3g.sql(f"CREATE ROLE {role} NOLOGIN;")
    c3g.sql(f"GRANT USAGE ON SCHEMA core_zone TO {role};")
    c3g.sql(f"GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA core_zone TO {role};")
    c3g.sql(f"SET ROLE {role}; SELECT * FROM core_zone.item_corpse_loot_outbox;",
            fails=True)
    c3g.sql(f"SET ROLE {role}; SELECT * FROM core_zone.item_corpse_loot_receipts;",
            fails=True)
    c3g.sql(f"SET ROLE {role}; DELETE FROM core_zone.item_operation_ids;",
            fails=True)
    result = c3g.sql(
        f"SET ROLE {role}; SELECT world_revision,item_a_revision,item_b_revision,replay "
        "FROM core_zone.commit_two_item_corpse_loot("
        f"{c3g.bid(55001)},{c3g.bid(56001)},{c3g.bid(c)},"
        f"{c3g.bid(co)},1,1,1,2,{c3g.payload('role')},"
        f"{c3g.bid(a)},1,{c3g.bid(b)},1);"
    )
    check(result == "3|2|2|f", "test trusted definer function still usable")
    print("PASS: restricted role cannot forge/read DB state or delete ID registry")


def main():
    check(os.environ.get("MYASO_C3K_TEST_ONLY") == "1", "explicit isolated test gate required")
    check(os.environ.get("PGDATABASE") == "myaso_c3k_test", "disposable C3k database required")
    test_pair_atomicity_and_idempotency()
    test_no_half_loot_and_handoff()
    test_global_ids_and_world_only_replay()
    test_competing_looters_one_winner()
    test_sigkill_before_outer_commit()
    test_restricted_role()
    print("C3K TWO-ITEM CORPSE LOOT PG ATOMICITY ACCEPTANCE PASSED (NOT AUTHORIZATION)")


if __name__ == "__main__":
    main()
