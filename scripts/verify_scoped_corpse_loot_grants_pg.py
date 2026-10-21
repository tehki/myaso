#!/usr/bin/env python3
"""C3l disposable PostgreSQL proof: fail-closed scoped single-use corpse grants.

Grant rows are seeded ONLY by the schema-owner test connection. There is no
production trusted death/loot issuer and no authenticated player adapter.
"""
import concurrent.futures
import os
import subprocess
import threading

import verify_atomic_item_world_pg as c3g
import verify_two_item_corpse_loot_pg as c3k


def check(ok, reason):
    if not ok:
        raise AssertionError(reason)


def issue(grant, character, corpse, a, b, *, expired=False, revoked=False):
    expires = "clock_timestamp() - interval '1 hour'" if expired else (
        "clock_timestamp() + interval '1 hour'"
    )
    c3g.sql(
        "INSERT INTO core_zone.corpse_loot_grants("
        "grant_id,character_id,corpse_id,item_a,item_b,expires_at,revoked) VALUES ("
        f"{c3g.bid(grant)},{c3g.bid(character)},{c3g.bid(corpse)},"
        f"{c3g.bid(a)},{c3g.bid(b)},{expires},"
        f"{'true' if revoked else 'false'});"
    )


def state(grant):
    return c3g.sql(
        "SELECT CASE WHEN consumed_operation_id IS NULL THEN 'free' "
        "ELSE encode(consumed_operation_id,'hex') END "
        "FROM core_zone.corpse_loot_grants "
        f"WHERE grant_id={c3g.bid(grant)};"
    )


def loot(op, world_op, c, corpse, a, arev, b, brev, grant, *,
         worker=1, zone=1, epoch=1, world_rev=2,
         data="authorized-loot", fails=False, legacy=False):
    args = (
        f"{c3g.bid(op)},{c3g.bid(world_op)},{c3g.bid(c)},"
        f"{c3g.bid(corpse)},{worker},{zone},{epoch},{world_rev},"
        f"{c3g.payload(data)},{c3g.bid(a)},{arev},{c3g.bid(b)},{brev}"
    )
    if not legacy:
        args += "," + c3g.bid(grant)
    return c3g.sql(
        "SELECT world_revision,item_a_revision,item_b_revision,outbox_sequence,replay "
        "FROM core_zone.commit_two_item_corpse_loot(" + args + ");",
        fails=fails,
    )


def test_missing_wrong_and_expired_grants():
    c, corpse, a, b = 4101, 8101, 10101, 10102
    source, _ = c3k.setup(c, corpse, a, b)
    loot(51001, 52001, c, corpse, a, 1, b, 1, 99999, fails=True)
    loot(51002, 52002, c, corpse, a, 1, b, 1, 99999, fails=True, legacy=True)
    check(c3g.world_revision(c) == "2", "missing grant/old entrypoint cannot mutate world")
    check(c3k.receipt_count(51001) == "0" and c3k.receipt_count(51002) == "0",
          "missing grant must not create receipts")

    issue(61001, c, corpse, a, b, expired=True)
    loot(51003, 52003, c, corpse, a, 1, b, 1, 61001, fails=True)
    check(state(61001) == "free", "expired grant must not be consumed")
    issue(61002, c, corpse, a, b, revoked=True)
    loot(51004, 52004, c, corpse, a, 1, b, 1, 61002, fails=True)
    check(state(61002) == "free", "revoked grant must not be consumed")
    issue(61003, c, corpse, a, b)
    c3g.register(4102)
    loot(51005, 52005, 4102, corpse, a, 1, b, 1, 61003,
         world_rev=0, fails=True)
    loot(51006, 52006, c, corpse + 1, a, 1, b, 1, 61003, fails=True)
    loot(51007, 52007, c, corpse, a, 1, b + 1, 1, 61003, fails=True)
    check(state(61003) == "free", "wrong claimant/corpse/items cannot spend grant")
    check(c3g.item_state(a) == "1|" + source and c3g.item_state(b) == "1|" + source,
          "no denied request changed either corpse item")
    check(c3g.world_revision(c) == "2", "denial leaves original world revision")
    print("PASS: no grant and retired legacy API are fail closed; expired, revoked and wrong scope denied")


def test_success_exact_replay_revoke_and_double_spend():
    c, corpse, a, b = 4201, 8201, 10201, 10202
    source, dest = c3k.setup(c, corpse, a, b)
    issue(62001, c, corpse, a, b)
    result = loot(53001, 54001, c, corpse, a, 1, b, 1, 62001)
    parts = result.split("|")
    check(len(parts) == 5 and parts[:3] == ["3", "2", "2"] and parts[4] == "f",
          "grant issued to exact pair permits one complete transfer")
    check(state(62001) == "%032x" % 53001, "grant consumed by exact operation")
    check(c3g.item_state(a) == "2|" + dest and c3g.item_state(b) == "2|" + dest,
          "both items reach destination inventory")
    check(c3k.receipt_count(53001) == "1" and c3k.delta_count(53001) == "2",
          "one receipt and two companion deltas")
    c3g.sql(f"UPDATE core_zone.corpse_loot_grants SET revoked=true "
            f"WHERE grant_id={c3g.bid(62001)};")
    check(loot(53001, 54001, c, corpse, a, 1, b, 1, 62001) ==
          f"3|2|2|{parts[3]}|t", "historical exact ACK retry works after revocation")
    loot(53002, 54002, c, corpse, a, 1, b, 1, 62001, world_rev=3, fails=True)
    loot(53001, 54001, c, corpse, a, 1, b, 1, 62002, fails=True)
    check(c3g.world_revision(c) == "3", "double spend and conflicting grant did not commit")
    print("PASS: exact one-use grant, historical reply, immutable scope and double-spend denial")


def test_failure_rolls_back_grant_consumption():
    c, corpse, a, b = 4301, 8301, 10301, 10302
    source, inv = c3k.setup(c, corpse, a, b)
    issue(63001, c, corpse, a, b)
    check(c3g.mutation(55001, 56001, c, b, 2, 1, source, inv,
                       world_rev=2).startswith("3|2|"),
          "one item previously moved")
    loot(55002, 56002, c, corpse, a, 1, b, 1, 63001, world_rev=3, fails=True)
    check(state(63001) == "free", "failed pair CAS rolls back consumption")
    check(c3g.item_state(a) == "1|" + source, "unmoved item stays in corpse")
    check(c3g.world_revision(c) == "3", "world revision rollback")
    print("PASS: partial source CAS failure rolls back grant and all world/item effects")


def test_competing_claims_single_grant():
    c, corpse, a, b = 4401, 8401, 10401, 10402
    _, dest = c3k.setup(c, corpse, a, b)
    issue(64001, c, corpse, a, b)
    gate = threading.Barrier(3)

    def attempt(op, world_op):
        gate.wait(timeout=10)
        args = ",".join((
            c3g.bid(op), c3g.bid(world_op), c3g.bid(c), c3g.bid(corpse),
            "1", "1", "1", "2", c3g.payload("race"),
            c3g.bid(a), "1", c3g.bid(b), "1", c3g.bid(64001)
        ))
        p = subprocess.run(
            ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c",
             "SELECT * FROM core_zone.commit_two_item_corpse_loot(" + args + ");"],
            capture_output=True, text=True, timeout=25
        )
        return p.returncode == 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(attempt, 57001, 58001)
        second = pool.submit(attempt, 57002, 58002)
        gate.wait(timeout=10)
        results = [first.result(timeout=25), second.result(timeout=25)]
    check(results.count(True) == 1, "only one independent writer may consume a grant")
    check(c3g.item_state(a) == "2|" + dest and c3g.item_state(b) == "2|" + dest,
          "both items moved by one winner without split")
    check(state(64001) in ("%032x" % 57001, "%032x" % 57002),
          "one durable matching operation consumes grant")
    check(int(c3k.receipt_count(57001)) + int(c3k.receipt_count(57002)) == 1,
          "only one immutable corpse receipt")
    print("PASS: two independent PostgreSQL clients contend for grant, one complete winner")


def test_crashed_uncommitted_grant_and_recovery():
    c, corpse, a, b = 4501, 8501, 10501, 10502
    source, dest = c3k.setup(c, corpse, a, b)
    issue(65001, c, corpse, a, b)
    p = subprocess.Popen(
        ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, bufsize=1
    )
    try:
        check(p.stdin is not None and p.stdout is not None, "psql pipes")
        params = ",".join((
            c3g.bid(59001), c3g.bid(60001), c3g.bid(c), c3g.bid(corpse),
            "1", "1", "1", "2", c3g.payload("crash"),
            c3g.bid(a), "1", c3g.bid(b), "1", c3g.bid(65001)
        ))
        p.stdin.write(
            "BEGIN;\nSELECT * FROM core_zone.commit_two_item_corpse_loot("
            + params + ");\nSELECT 'UNCOMMITTED_GRANT_LOOT';\n"
        )
        p.stdin.flush()
        found = False
        for _ in range(14):
            if "UNCOMMITTED_GRANT_LOOT" in p.stdout.readline():
                found = True
                break
        check(found, "SQL consumed grant and moved pair in uncommitted transaction")
        p.kill()
        p.wait(timeout=8)
        check(state(65001) == "free", "SIGKILL before COMMIT restored grant")
        check(c3g.item_state(a) == "1|" + source and c3g.item_state(b) == "1|" + source,
              "SIGKILL restored BOTH corpse sources")
        check(c3g.world_revision(c) == "2", "world receipt also rolled back")
        check(c3k.receipt_count(59001) == "0", "no incomplete receipt")
        check(loot(59001, 60001, c, corpse, a, 1, b, 1, 65001,
                   data="crash").startswith("3|2|2|"), "retry commits once")
        check(c3g.item_state(a) == "2|" + dest and c3g.item_state(b) == "2|" + dest,
              "recovering writer transfers entire pair")
    finally:
        if p.poll() is None:
            p.kill()
            p.wait(timeout=8)
    print("PASS: SIGKILL before COMMIT restores grant, receipts, world and both items")


def test_untrusted_role_cannot_issue_or_read_grants():
    role = "myaso_c3l_restricted"
    c3g.sql(f"CREATE ROLE {role} NOLOGIN;")
    c3g.sql(f"GRANT USAGE ON SCHEMA core_zone TO {role};")
    c3g.sql(f"GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA core_zone TO {role};")
    c3g.sql(f"SET ROLE {role}; SELECT * FROM core_zone.corpse_loot_grants;",
            fails=True)
    c3g.sql(f"SET ROLE {role}; DELETE FROM core_zone.corpse_loot_grants;",
            fails=True)
    c3g.sql(f"SET ROLE {role}; INSERT INTO core_zone.corpse_loot_grants "
            f"(grant_id,character_id,corpse_id,item_a,item_b,expires_at) "
            f"VALUES ({c3g.bid(99999)},{c3g.bid(1)},{c3g.bid(1)},"
            f"{c3g.bid(1)},{c3g.bid(2)},clock_timestamp()+interval '1 hour');",
            fails=True)
    print("PASS: application-role simulation cannot issue, inspect or rewrite DB grants")


def main():
    check(os.getenv("MYASO_C3L_TEST_ONLY") == "1", "explicit C3l test gate required")
    check(os.getenv("PGDATABASE") == "myaso_c3l_test", "requires disposable C3l primary")
    test_missing_wrong_and_expired_grants()
    test_success_exact_replay_revoke_and_double_spend()
    test_failure_rolls_back_grant_consumption()
    test_competing_claims_single_grant()
    test_crashed_uncommitted_grant_and_recovery()
    test_untrusted_role_cannot_issue_or_read_grants()
    print("C3L SCOPED DB GRANT PREREQUISITE ACCEPTANCE PASSED (NOT PLAYER AUTH)")


if __name__ == "__main__":
    main()
