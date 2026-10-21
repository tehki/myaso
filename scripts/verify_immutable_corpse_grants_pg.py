#!/usr/bin/env python3
"""C3m PostgreSQL proof: scope, expiry, revocation and consumption history.

This test runs ONLY against disposable myaso_c3m_test. It does not create
an authenticated actor or trusted live grant issuer.
"""
import os

import verify_atomic_item_world_pg as c3g
import verify_scoped_corpse_loot_grants_pg as c3l
import verify_two_item_corpse_loot_pg as c3k


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def item_count(operation):
    return c3g.sql("SELECT count(*) FROM core_zone.item_corpse_loot_outbox "
                   f"WHERE operation_id={c3g.bid(operation)};")


def test_scopes_and_expiry_cannot_be_rewritten():
    character, corpse, a, b, grant = 5101, 9101, 11101, 11102, 71001
    original, _ = c3k.setup(character, corpse, a, b)
    c3l.issue(grant, character, corpse, a, b)
    changes = [
        f"grant_id={c3g.bid(grant + 1)}",
        f"character_id={c3g.bid(character + 1)}",
        f"corpse_id={c3g.bid(corpse + 1)}",
        f"item_a={c3g.bid(a-1)}",
        f"item_b={c3g.bid(b+1)}",
        "expires_at=expires_at + interval '1 hour'",
        "expires_at=expires_at - interval '1 second'",
    ]
    for patch in changes:
        c3g.sql("UPDATE core_zone.corpse_loot_grants SET " + patch +
                f" WHERE grant_id={c3g.bid(grant)};", fails=True)
    check(c3l.state(grant) == "free", "refused changes cannot spend the grant")
    check(c3g.item_state(a) == "1|" + original, "grant changes cannot mutate source item")
    check(c3g.world_revision(character) == "2", "grant changes cannot mutate world")
    c3g.sql(f"DELETE FROM core_zone.corpse_loot_grants WHERE grant_id={c3g.bid(grant)};",
            fails=True)
    c3g.sql("TRUNCATE core_zone.corpse_loot_grants CASCADE;", fails=True)
    check(c3g.sql("SELECT count(*) FROM core_zone.corpse_loot_grants "
                  f"WHERE grant_id={c3g.bid(grant)};") == "1",
          "grants cannot be erased with DELETE or TRUNCATE")
    print("PASS: scope, item IDs and expiration are immutable; no delete/truncate")


def test_consumption_tombstone_and_revoke_only_forward():
    character, corpse, a, b, grant = 5201, 9201, 11201, 11202, 72001
    _, inventory = c3k.setup(character, corpse, a, b)
    c3l.issue(grant, character, corpse, a, b)
    result = c3l.loot(82001, 83001, character, corpse, a, 1, b, 1, grant)
    check(result.startswith("3|2|2|") and result.endswith("|f"), "valid atomic grant")
    check(c3l.state(grant) == "%032x" % 82001, "immutable consumed receipt")
    c3g.sql(f"UPDATE core_zone.corpse_loot_grants SET consumed_operation_id=NULL "
            f"WHERE grant_id={c3g.bid(grant)};", fails=True)
    c3g.sql("UPDATE core_zone.corpse_loot_grants "
            f"SET consumed_operation_id={c3g.bid(82002)} "
            f"WHERE grant_id={c3g.bid(grant)};", fails=True)
    c3g.sql(f"UPDATE core_zone.corpse_loot_grants SET revoked=true "
            f"WHERE grant_id={c3g.bid(grant)};")
    c3g.sql(f"UPDATE core_zone.corpse_loot_grants SET revoked=false "
            f"WHERE grant_id={c3g.bid(grant)};", fails=True)
    check(c3l.loot(82001, 83001, character, corpse, a, 1, b, 1, grant).endswith("|t"),
          "historical exact retry after revocation must work")
    check(item_count(82001) == "2" and c3g.item_state(a) == "2|" + inventory,
          "historical result has exactly two item deltas")
    print("PASS: grant consumption irreversible, revocation one-way, ACK replay stable")


def test_revoked_grant_cannot_be_resurrected_or_manually_consumed():
    character, corpse, a, b, grant = 5301, 9301, 11301, 11302, 73001
    c3k.setup(character, corpse, a, b)
    c3l.issue(grant, character, corpse, a, b)
    c3g.sql(f"UPDATE core_zone.corpse_loot_grants SET revoked=true "
            f"WHERE grant_id={c3g.bid(grant)};")
    c3g.sql(f"UPDATE core_zone.corpse_loot_grants SET revoked=false "
            f"WHERE grant_id={c3g.bid(grant)};", fails=True)
    c3g.sql(f"UPDATE core_zone.corpse_loot_grants SET consumed_operation_id={c3g.bid(84001)} "
            f"WHERE grant_id={c3g.bid(grant)};", fails=True)
    c3l.loot(84001, 85001, character, corpse, a, 1, b, 1, grant, fails=True)
    check(c3l.state(grant) == "free", "revoked unused grant remains unconsumed")
    check(c3k.receipt_count(84001) == "0", "revoked grant left no receipt")
    print("PASS: even a privileged UPDATE cannot un-revoke or spend revoked grant")


def test_receipt_binding_and_mismatched_consumption():
    c1, corpse1, a1, b1, grant1 = 5401, 9401, 11401, 11402, 74001
    c2, corpse2, a2, b2, grant2 = 5501, 9501, 11501, 11502, 75001
    c3k.setup(c1, corpse1, a1, b1)
    c3k.setup(c2, corpse2, a2, b2)
    c3l.issue(grant1, c1, corpse1, a1, b1)
    c3l.issue(grant2, c2, corpse2, a2, b2)
    check(c3l.loot(86001, 87001, c2, corpse2, a2, 1, b2, 1, grant2)
          .startswith("3|2|2|"), "unrelated real receipt exists")
    # The FK accepts 86001 as a valid operation, but the strict trigger
    # must reject claiming it consumed grant1.
    c3g.sql("UPDATE core_zone.corpse_loot_grants "
            f"SET consumed_operation_id={c3g.bid(86001)} "
            f"WHERE grant_id={c3g.bid(grant1)};", fails=True)
    check(c3l.state(grant1) == "free", "mismatched foreign receipt cannot consume grant")
    # FK rejects attaching a receipt to a nonexistent grant ID.
    c3g.sql("UPDATE core_zone.item_corpse_loot_receipts "
            f"SET grant_id={c3g.bid(99991)} "
            f"WHERE operation_id={c3g.bid(86001)};", fails=True)
    check(c3g.sql("SELECT encode(grant_id,'hex') "
                  "FROM core_zone.item_corpse_loot_receipts "
                  f"WHERE operation_id={c3g.bid(86001)};") == "%032x" % grant2,
          "failed FK update left historical receipt grant intact")
    print("PASS: consumption only bound to exact immutable receipt, FK rejects dangling grants")


def test_application_role_cannot_rewrite_grant_history():
    role = "myaso_c3m_restricted"
    c3g.sql(f"CREATE ROLE {role} NOLOGIN;")
    c3g.sql(f"GRANT USAGE ON SCHEMA core_zone TO {role};")
    c3g.sql(f"GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA core_zone TO {role};")
    for statement in [
        "UPDATE core_zone.corpse_loot_grants SET revoked=false;",
        "DELETE FROM core_zone.corpse_loot_grants;",
        "TRUNCATE core_zone.corpse_loot_grants CASCADE;",
        "SELECT * FROM core_zone.corpse_loot_grants;",
    ]:
        c3g.sql(f"SET ROLE {role}; " + statement, fails=True)
    print("PASS: untrusted DB application role has no read/write grant-history access")


def main():
    check(os.environ.get("MYASO_C3M_TEST_ONLY") == "1",
          "C3m test-only environment variable required")
    check(os.environ.get("PGDATABASE") == "myaso_c3m_test",
          "must use disposable C3m test database")
    test_scopes_and_expiry_cannot_be_rewritten()
    test_consumption_tombstone_and_revoke_only_forward()
    test_revoked_grant_cannot_be_resurrected_or_manually_consumed()
    test_receipt_binding_and_mismatched_consumption()
    test_application_role_cannot_rewrite_grant_history()
    print("C3M IMMUTABLE CORPSE GRANT HISTORY PG16 ACCEPTANCE PASSED")


if __name__ == "__main__":
    main()
