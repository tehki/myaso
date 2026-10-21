#!/usr/bin/env python3
"""C3j: shared single-item/swap request-ID namespace acceptance (disposable PG16)."""
import concurrent.futures
import os
import subprocess
import sys
import threading

import verify_atomic_item_world_pg as c3g
import verify_atomic_equipment_swaps_pg as c3i


def check(ok, message):
    if not ok:
        raise AssertionError(message)


def registration(operation):
    return c3g.sql(
        "SELECT operation_family FROM core_zone.item_operation_ids "
        f"WHERE operation_id={c3g.bid(operation)};"
    )


def family_count(operation):
    return (
        c3g.sql("SELECT count(*) FROM core_zone.item_world_receipts "
                f"WHERE operation_id={c3g.bid(operation)};"),
        c3g.sql("SELECT count(*) FROM core_zone.item_swap_receipts "
                f"WHERE operation_id={c3g.bid(operation)};"),
    )


def pre_migration_seed():
    """Old unmodified C3g/C3i transaction functions must leave real receipts."""
    loc_a, loc_b = c3i.init_pair(6101, 8101, 8102)
    result = c3i.swap(61011, 61012, 6101, 8101, 1, loc_a, 8102, 1, loc_b)
    check(result.startswith("3|2|2|"), "pre-migration swap committed")
    check(family_count(61011) == ("0", "1"), "legacy swap receipt exists")
    check(family_count(16101) == ("1", "0"), "legacy item receipt exists")
    print("PASS: committed legacy C3g and C3i receipts prepared for atomic migration")


def test_backfill_and_idempotency():
    check(registration(16101) == "1", "historical single-item receipt backfilled")
    check(registration(16102) == "1", "second historical single-item receipt backfilled")
    check(registration(61011) == "2", "historical swap receipt backfilled")
    loc_a, loc_b = c3i.equip(6101, 3), c3i.equip(6101, 4)
    check(c3i.swap(61011, 61012, 6101, 8101, 1, loc_a, 8102, 1, loc_b).endswith("|t"),
          "exact historical swap retry survives migration")
    check(c3g.mutation(16101, 26101, 6101, 8101, 1, 0, None, loc_a)
          .endswith("|t"), "historical C3g retry survives migration")
    check(family_count(61011) == ("0", "1") and family_count(16101) == ("1", "0"),
          "migration retries create no duplicated receipts")
    print("PASS: legacy receipt backfill, exact historical retries and kind preservation")


def test_cross_family_reuse_rejected_and_rollback():
    loc_a, loc_b = c3i.init_pair(6201, 8201, 8202)
    c3g.register(6202)
    first = c3g.mutation(72001, 73001, 6202, 8203, 1, 0, None, c3g.inv(6202))
    check(first.startswith("1|1|"), "single-item ID committed first")
    c3i.swap(72001, 73002, 6201, 8201, 1, loc_a, 8202, 1, loc_b, fails=True)
    check(registration(72001) == "1" and family_count(72001) == ("1", "0"),
          "swap may not reuse existing single-item operation ID")
    check(c3g.world_revision(6201) == "2", "conflicting swap did not update world")
    check(c3g.item_state(8201) == "1|" + loc_a, "conflicting swap did not move item")
    check(c3g.mutation(72001, 73001, 6202, 8203, 1, 0, None, c3g.inv(6202))
          .endswith("|t"), "legitimate one-item replay remains idempotent")

    loc_a2, loc_b2 = c3i.init_pair(6301, 8301, 8302)
    second = c3i.swap(72002, 73003, 6301, 8301, 1, loc_a2, 8302, 1, loc_b2)
    check(second.startswith("3|2|2|"), "swap registered first")
    c3g.register(6302)
    c3g.mutation(72002, 73004, 6302, 8303, 1, 0, None, c3g.inv(6302),
                 fails=True)
    check(registration(72002) == "2" and family_count(72002) == ("0", "1"),
          "one-item create cannot reuse existing swap operation ID")
    check(c3g.world_revision(6302) == "" and c3g.item_state(8303) == "",
          "losing protocol rolled back all world/item state")
    check(c3i.swap(72002, 73003, 6301, 8301, 1, loc_a2, 8302, 1, loc_b2)
          .endswith("|t"), "legitimate swap retry survives global registry")
    print("PASS: both cross-family reuse directions rejected without phantom state")


def test_uncommitted_id_reservation_rolls_back():
    loc_a, loc_b = c3i.init_pair(6401, 8401, 8402)
    c3g.register(6402)
    operation, world_op = 74001, 75001
    query = (
        "SELECT * FROM core_zone.commit_item_world_mutation("
        f"{c3g.bid(operation)}, {c3g.bid(world_op)}, 1::smallint, "
        f"{c3g.bid(6402)},1,1,1,0,{c3g.payload('uncommitted')},"
        f"{c3g.bid(8403)},1::smallint,0,NULL::bytea,{c3g.literal(c3g.inv(6402))});"
    )
    c3g.sql("BEGIN; " + query + " ROLLBACK;")
    check(registration(operation) == "", "aborted receipt cannot reserve global ID")
    check(family_count(operation) == ("0", "0"), "no partial receipt remains")
    check(c3i.swap(operation, 75002, 6401, 8401, 1, loc_a, 8402, 1, loc_b)
          .startswith("3|2|2|"), "rolled back operation ID may be reassigned to swap")
    check(registration(operation) == "2", "committed swap owns global registry")
    print("PASS: aborted ID reservation rolls back; no phantom lock or tombstone")


def test_independent_cross_family_race():
    loc_a, loc_b = c3i.init_pair(6501, 8501, 8502)
    c3g.register(6502)
    operation = 76001
    barrier = threading.Barrier(3)

    def item_attempt():
        barrier.wait(timeout=10)
        statement = (
            "SELECT * FROM core_zone.commit_item_world_mutation("
            f"{c3g.bid(operation)}, {c3g.bid(77001)}, 1::smallint, "
            f"{c3g.bid(6502)},1,1,1,0,{c3g.payload('item-race')},"
            f"{c3g.bid(8503)},1::smallint,0,NULL::bytea,{c3g.literal(c3g.inv(6502))});"
        )
        return subprocess.run(
            ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement],
            capture_output=True, text=True, timeout=20
        ).returncode == 0

    def swap_attempt():
        barrier.wait(timeout=10)
        statement = (
            "SELECT * FROM core_zone.commit_two_item_equipment_swap("
            f"{c3g.bid(operation)}, {c3g.bid(77002)}, {c3g.bid(6501)},"
            f"1,1,1,2,{c3g.payload('swap-race')},"
            f"{c3g.bid(8501)},1,{c3g.literal(loc_a)},"
            f"{c3g.bid(8502)},1,{c3g.literal(loc_b)});"
        )
        return subprocess.run(
            ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement],
            capture_output=True, text=True, timeout=20
        ).returncode == 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        item = pool.submit(item_attempt)
        swap = pool.submit(swap_attempt)
        barrier.wait(timeout=10)
        outcomes = (item.result(timeout=20), swap.result(timeout=20))
    check(outcomes.count(True) == 1, f"one globally-unique operation winner: {outcomes}")
    check(family_count(operation) in (("1", "0"), ("0", "1")),
          "exactly one committed protocol receipt")
    check(registration(operation) in ("1", "2"), "exactly one durable ID family")
    if outcomes[0]:
        check(registration(operation) == "1" and c3g.world_revision(6502) == "1",
              "single-item winner committed")
        check(c3g.world_revision(6501) == "2", "swap loser no world state change")
        check(c3g.item_state(8501) == "1|" + loc_a, "swap loser no item movement")
    else:
        check(registration(operation) == "2" and c3g.world_revision(6501) == "3",
              "swap winner committed")
        check(c3g.world_revision(6502) == "" and c3g.item_state(8503) == "",
              "one-item loser no item/world state change")
    print("PASS: two independent PostgreSQL protocol families race one global ID; one winner")


def test_direct_registry_writes_denied():
    c3g.sql("CREATE ROLE myaso_c3j_restricted NOLOGIN;")
    c3g.sql("GRANT USAGE ON SCHEMA core_zone TO myaso_c3j_restricted;")
    c3g.sql("GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA core_zone TO myaso_c3j_restricted;")
    c3g.sql("SET ROLE myaso_c3j_restricted; SELECT * "
            "FROM core_zone.item_operation_ids;", fails=True)
    c3g.sql("SET ROLE myaso_c3j_restricted; DELETE "
            "FROM core_zone.item_operation_ids;", fails=True)
    c3g.sql("SET ROLE myaso_c3j_restricted; INSERT INTO core_zone.item_operation_ids "
            f"(operation_id,operation_family) VALUES ({c3g.bid(90001)},1);",
            fails=True)
    print("PASS: unprivileged role cannot forge/read/delete global ID reservations")


def seed_historical_conflict():
    """Fixture for a SECOND disposable database where old receipt IDs collide."""
    loc_a, loc_b = c3i.init_pair(7101, 9101, 9102)
    c3g.register(7102)
    check(c3g.mutation(88001, 88101, 7102, 9103, 1, 0, None,
                       c3g.inv(7102)).startswith("1|1|"),
          "historical single-item ID committed")
    check(c3i.swap(88001, 88201, 7101, 9101, 1, loc_a, 9102, 1, loc_b)
          .startswith("3|2|2|"), "historical swap reused same ID before migration")
    check(family_count(88001) == ("1", "1"),
          "pre-migration cross-family collision fixture exists")
    print("PASS: historical collision fixture committed in second disposable database")


def verify_failed_upgrade_rolled_back():
    # The preceding SQL migration must have exited NONZERO. BEGIN/DO exception
    # must restore BOTH old receipt families and eliminate all DDL/backfill.
    check(c3g.sql("SELECT to_regclass('core_zone.item_operation_ids') IS NULL;") == "t",
          "atomic migration rollback must not leave a partial global registry")
    check(family_count(88001) == ("1", "1"),
          "failed migration must not rewrite/delete either historical receipt")
    check(c3g.world_revision(7101) == "3" and c3g.world_revision(7102) == "1",
          "failed migration must preserve both committed world histories")
    check(c3g.item_state(9103) == "1|" + c3g.inv(7102),
          "failed migration must preserve item ownership")
    print("PASS: conflicting historical IDs abort entire SQL upgrade without data loss")


def main():
    check(os.environ.get("MYASO_C3J_TEST_ONLY") == "1", "C3j disposable test-only gate required")
    db = os.environ.get("PGDATABASE")
    if len(sys.argv) == 2 and sys.argv[1] in ("--seed-conflict", "--verify-failed-upgrade"):
        check(db == "myaso_c3j_conflict_test", "conflict test requires isolated disposable DB")
        if sys.argv[1] == "--seed-conflict":
            seed_historical_conflict()
        else:
            verify_failed_upgrade_rolled_back()
        return
    check(db == "myaso_c3j_test", "use only disposable C3j database")
    if len(sys.argv) == 2 and sys.argv[1] == "--seed":
        pre_migration_seed()
        return
    check(len(sys.argv) == 1, "unrecognized mode")
    test_backfill_and_idempotency()
    test_cross_family_reuse_rejected_and_rollback()
    test_uncommitted_id_reservation_rolls_back()
    test_independent_cross_family_race()
    test_direct_registry_writes_denied()
    print("C3J GLOBAL ITEM-OPERATION ID NAMESPACE ACCEPTANCE PASSED")


if __name__ == "__main__":
    main()
