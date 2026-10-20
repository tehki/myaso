#!/usr/bin/env python3
"""Isolated C3i two-item equipment swap acceptance on one disposable PG16 DB."""
import concurrent.futures
import os
import subprocess
import threading

import verify_atomic_item_world_pg as c3g


def check(ok, message):
    if not ok:
        raise AssertionError(message)


def equip(character, slot):
    return "02" + ("%032x" % character) + ("%02x" % slot) + "00" * 8


def swap(op, world_op, character, item_a, rev_a, loc_a, item_b, rev_b, loc_b,
         *, worker=1, zone=1, epoch=1, world_rev=2,
         data="equipment-swap", fails=False):
    return c3g.sql(
        "SELECT world_revision, item_a_revision, item_b_revision, outbox_sequence, replay "
        "FROM core_zone.commit_two_item_equipment_swap("
        f"{c3g.bid(op)}, {c3g.bid(world_op)}, {c3g.bid(character)}, "
        f"{worker}, {zone}, {epoch}, {world_rev}, {c3g.payload(data)}, "
        f"{c3g.bid(item_a)}, {rev_a}, {c3g.literal(loc_a)}, "
        f"{c3g.bid(item_b)}, {rev_b}, {c3g.literal(loc_b)});",
        fails=fails,
    )


def init_pair(character, a, b, slot_a=3, slot_b=4):
    c3g.register(character)
    loc_a, loc_b = equip(character, slot_a), equip(character, slot_b)
    check(c3g.mutation(character + 10000, character + 20000,
                       character, a, 1, 0, None, loc_a).startswith("1|1|"),
          "initial first equipped item")
    check(c3g.mutation(character + 10001, character + 20001,
                       character, b, 1, 0, None, loc_b, world_rev=1).startswith("2|1|"),
          "initial second equipped item")
    return loc_a, loc_b


def batch_rows(operation):
    return c3g.sql("SELECT count(*) FROM core_zone.item_swap_outbox "
                   f"WHERE operation_id={c3g.bid(operation)};")


def receipts(character):
    return c3g.sql("SELECT count(*) FROM core_zone.item_swap_receipts "
                   f"WHERE character_id={c3g.bid(character)};")


def test_exact_swap_replay_and_stale_cas():
    character, a, b = 2001, 5001, 5002
    loc_a, loc_b = init_pair(character, a, b)
    committed = swap(3001, 4001, character, a, 1, loc_a, b, 1, loc_b)
    bits = committed.split("|")
    check(len(bits) == 5 and bits[:3] == ["3", "2", "2"] and bits[4] == "f",
          "world revision and BOTH item revisions must commit")
    check(c3g.item_state(a) == "2|" + loc_b and c3g.item_state(b) == "2|" + loc_a,
          "both equipped slots exchanged atomically")
    check(batch_rows(3001) == "2", "both item outbox rows linked to one world event")
    check(c3g.sql("SELECT count(*) FROM core_zone.world_event_outbox "
                  f"WHERE mutation_id={c3g.bid(4001)};") == "1",
          "exactly one world event")
    check(swap(3001, 4001, character, a, 1, loc_a, b, 1, loc_b) ==
          f"3|2|2|{bits[3]}|t", "ACK loss returns immutable historical receipt")
    check(batch_rows(3001) == "2", "replay does not produce duplicate item deltas")

    swap(3001, 4001, character, a, 1, loc_a, b, 1, loc_b,
         data="forged-different-payload", fails=True)
    swap(3002, 4002, character, a, 1, loc_a, b, 1, loc_b, world_rev=3, fails=True)
    swap(3003, 4003, character, b, 2, loc_a, a, 2, loc_b, world_rev=3, fails=True)
    check(c3g.world_revision(character) == "3" and receipts(character) == "1",
          "stale and reordered swaps must roll back all world receipts")

    # A world-only prior receipt cannot activate new item state.
    c3g.sql("SELECT * FROM core_zone.commit_world_mutation("
            f"{c3g.bid(4004)}, 1::smallint, {c3g.bid(character)}, "
            f"1,1,1,3,{c3g.payload('world-only')});")
    swap(3004, 4004, character, a, 2, loc_b, b, 2, loc_a,
         world_rev=3, data="world-only", fails=True)
    check(c3g.world_revision(character) == "4" and receipts(character) == "1",
          "world-only replay cannot mint a swap")

    reverted = swap(3005, 4005, character, a, 2, loc_b, b, 2, loc_a, world_rev=4)
    check(reverted.startswith("5|3|3|"), "exact new request reverses swap")
    check(c3g.item_state(a) == "3|" + loc_a and c3g.item_state(b) == "3|" + loc_b,
          "original slots restored")
    check(batch_rows(3005) == "2" and receipts(character) == "2",
          "second swap has exactly two new item deltas")
    print("PASS: atomic swap, two deltas/one world event, ACK replay and CAS fencing")


def test_character_fencing_and_handoff():
    character, a, b = 2101, 5101, 5102
    loc_a, loc_b = init_pair(character, a, b)
    c3g.register(2102)
    swap(3100, 4100, 2102, a, 1, loc_a, b, 1, loc_b,
         world_rev=0, fails=True)
    check(c3g.world_revision(2102) == "", "other entity cannot mutate this character's slots")

    c3g.sql("SELECT core_zone.prepare_transfer("
            f"{c3g.bid(9701)}, 1::smallint, {c3g.bid(character)}, "
            "1,1,1,2,2);")
    swap(3101, 4101, character, a, 1, loc_a, b, 1, loc_b, fails=True)
    check(c3g.item_state(a) == "1|" + loc_a and receipts(character) == "0",
          "prepared handoff freezes equipped swaps")
    check(c3g.sql(f"SELECT core_zone.commit_transfer({c3g.bid(9701)});") == "2",
          "handoff epoch committed")
    swap(3101, 4101, character, a, 1, loc_a, b, 1, loc_b, fails=True)
    result = swap(3102, 4102, character, a, 1, loc_a, b, 1, loc_b,
                  worker=2, zone=2, epoch=2)
    check(result.startswith("3|2|2|"), "fresh worker commits")
    check(receipts(character) == "1", "only new worker obtains swap receipt")
    print("PASS: foreign character denied, pending/finalized handoff fenced")


def test_two_clients_one_winner():
    character, a, b = 2201, 5201, 5202
    loc_a, loc_b = init_pair(character, a, b)
    gate = threading.Barrier(3)

    def contender(op, world_op):
        gate.wait(timeout=10)
        statement = (
            "SELECT * FROM core_zone.commit_two_item_equipment_swap("
            f"{c3g.bid(op)}, {c3g.bid(world_op)}, {c3g.bid(character)}, "
            f"1,1,1,2,{c3g.payload('race')},"
            f"{c3g.bid(a)},1,{c3g.literal(loc_a)},"
            f"{c3g.bid(b)},1,{c3g.literal(loc_b)});"
        )
        r = subprocess.run(
            ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement],
            capture_output=True, text=True, timeout=20,
        )
        return r.returncode == 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        one = pool.submit(contender, 3201, 4201)
        two = pool.submit(contender, 3202, 4202)
        gate.wait(timeout=10)
        outcomes = [one.result(timeout=20), two.result(timeout=20)]
    check(outcomes.count(True) == 1, "exactly one complete two-item swap wins")
    check(c3g.world_revision(character) == "3" and receipts(character) == "1",
          "loser world mutation and receipt must roll back")
    check(c3g.item_state(a) == "2|" + loc_b and c3g.item_state(b) == "2|" + loc_a,
          "both items match winning swap; no half swap")
    check(c3g.sql("SELECT count(*) FROM core_zone.item_swap_outbox "
                  f"WHERE item_id IN ({c3g.bid(a)}, {c3g.bid(b)});") == "2",
          "only winning pair of swap deltas exists")
    print("PASS: two independent DB contenders, one world-and-two-item winner")


def test_sigkill_outer_transaction():
    character, a, b = 2301, 5301, 5302
    loc_a, loc_b = init_pair(character, a, b)
    p = subprocess.Popen(
        ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, bufsize=1,
    )
    try:
        check(p.stdin and p.stdout, "psql pipes")
        query = (
            "SELECT * FROM core_zone.commit_two_item_equipment_swap("
            f"{c3g.bid(3301)}, {c3g.bid(4301)}, {c3g.bid(character)},"
            f"1,1,1,2,{c3g.payload('crash')},"
            f"{c3g.bid(a)},1,{c3g.literal(loc_a)},"
            f"{c3g.bid(b)},1,{c3g.literal(loc_b)});"
        )
        p.stdin.write("BEGIN;\n" + query + "\nSELECT 'SWAP_BEFORE_COMMIT';\n")
        p.stdin.flush()
        marker = False
        for _ in range(12):
            line = p.stdout.readline()
            if "SWAP_BEFORE_COMMIT" in line:
                marker = True
                break
        check(marker, "swap must finish inside outer uncommitted transaction")
        p.kill()
        p.wait(timeout=8)
        check(c3g.world_revision(character) == "2" and receipts(character) == "0",
              "killed transaction cannot publish world or swap receipt")
        check(c3g.item_state(a) == "1|" + loc_a and c3g.item_state(b) == "1|" + loc_b,
              "SIGKILL must preserve BOTH original slots")
        check(batch_rows(3301) == "0", "no phantom item events")
        check(swap(3301, 4301, character, a, 1, loc_a, b, 1, loc_b,
                   data="crash").startswith("3|2|2|"),
              "identical request can retry after crash and commit once")
    finally:
        if p.poll() is None:
            p.kill()
            p.wait(timeout=8)
    print("PASS: real SIGKILL before outer COMMIT rolls back both item updates")


def test_restricted_role_and_no_direct_sql():
    character, a, b = 2401, 5401, 5402
    loc_a, loc_b = init_pair(character, a, b)
    role = "myaso_c3i_restricted"
    c3g.sql(f"CREATE ROLE {role} NOLOGIN;")
    c3g.sql(f"GRANT USAGE ON SCHEMA core_zone TO {role};")
    c3g.sql(f"GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA core_zone TO {role};")
    c3g.sql(f"SET ROLE {role}; SELECT * FROM core_zone.item_swap_outbox;", fails=True)
    c3g.sql(f"SET ROLE {role}; SELECT * FROM core_zone.item_swap_receipts;", fails=True)
    c3g.sql(f"SET ROLE {role}; UPDATE core_zone.item_state SET revision=99 "
            f"WHERE item_id={c3g.bid(a)};", fails=True)
    observed = c3g.sql(
        f"SET ROLE {role}; SELECT world_revision,item_a_revision,item_b_revision,replay "
        "FROM core_zone.commit_two_item_equipment_swap("
        f"{c3g.bid(3401)},{c3g.bid(4401)},{c3g.bid(character)},"
        f"1,1,1,2,{c3g.payload('role')},"
        f"{c3g.bid(a)},1,{c3g.literal(loc_a)},"
        f"{c3g.bid(b)},1,{c3g.literal(loc_b)});"
    )
    check(observed == "3|2|2|f", "definer function permitted by test-only role")
    check(batch_rows(3401) == "2", "two events still atomic")
    print("PASS: restricted role cannot read/forge state or outbox")


def main():
    check(os.environ.get("MYASO_C3I_TEST_ONLY") == "1", "explicit disposable test approval required")
    check(os.environ.get("PGDATABASE") == "myaso_c3i_test", "must use disposable C3i database")
    test_exact_swap_replay_and_stale_cas()
    test_character_fencing_and_handoff()
    test_two_clients_one_winner()
    test_sigkill_outer_transaction()
    test_restricted_role_and_no_direct_sql()
    print("C3I TWO-ITEM POSTGRES EQUIPMENT SWAP ACCEPTANCE PASSED")


if __name__ == "__main__":
    main()
