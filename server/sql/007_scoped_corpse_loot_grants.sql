-- Core 8B C3l: disable grant-free corpse looting and require a scoped,
-- one-time, DB-owner-issued permit on exactly one two-item corpse batch.
-- This DOES NOT authenticate the caller; no production grant issuer exists.
-- Requires Core C4c..C3k migrations 001..006 on the SAME PG primary.

BEGIN;

ALTER TABLE core_zone.item_corpse_loot_receipts
    ADD COLUMN grant_id bytea CHECK (grant_id IS NULL OR octet_length(grant_id) = 16);
-- Existing legacy receipts retain NULL grant_id. Their old signature is
-- intentionally disabled: they cannot be re-authorized without migration.

CREATE TABLE core_zone.corpse_loot_grants (
    grant_id bytea PRIMARY KEY CHECK (
        octet_length(grant_id) = 16
        AND grant_id != decode(repeat('00', 16), 'hex')
    ),
    character_id bytea NOT NULL CHECK (
        octet_length(character_id) = 16
        AND character_id != decode(repeat('00', 16), 'hex')
    ),
    corpse_id bytea NOT NULL CHECK (
        octet_length(corpse_id) = 16
        AND corpse_id != decode(repeat('00', 16), 'hex')
    ),
    item_a bytea NOT NULL CHECK (octet_length(item_a) = 16),
    item_b bytea NOT NULL CHECK (octet_length(item_b) = 16),
    expires_at timestamptz NOT NULL,
    revoked boolean NOT NULL DEFAULT false,
    consumed_operation_id bytea UNIQUE
        REFERENCES core_zone.item_corpse_loot_receipts (operation_id)
        DEFERRABLE INITIALLY DEFERRED,
    CHECK (item_a < item_b)
);
-- No GRANT/ISSUE function is provided: only trusted schema-owner migration/
-- future separately authenticated death/loot service can insert grants.
-- Receipt validation must never accept caller-written row-level state.

-- Fail closed on original 13-argument C3k entrypoint. This must remain
-- impossible to call directly, even if an application EXECUTE grant leaked.
CREATE OR REPLACE FUNCTION core_zone.commit_two_item_corpse_loot(
    p_operation bytea, p_world_mutation bytea,
    p_character bytea, p_corpse bytea,
    p_worker bigint, p_zone bigint, p_epoch bigint,
    p_expected_world_revision bigint, p_world_payload bytea,
    p_item_a bytea, p_expected_a_revision bigint,
    p_item_b bytea, p_expected_b_revision bigint
) RETURNS TABLE (
    world_revision bigint, item_a_revision bigint, item_b_revision bigint,
    outbox_sequence bigint, replay boolean
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, core_zone AS $$
BEGIN
    RAISE EXCEPTION 'C3k grant-free corpse loot disabled by C3l migration';
END;
$$;

-- New 14-argument entrypoint: complete C3k atomic transaction plus a
-- locked, exact-scope, unrevoked, unexpired, single-use grant. Consuming the
-- grant is part of the SAME world/item/outbox PostgreSQL COMMIT or ROLLBACK.
CREATE OR REPLACE FUNCTION core_zone.commit_two_item_corpse_loot(
    p_operation bytea, p_world_mutation bytea,
    p_character bytea, p_corpse bytea,
    p_worker bigint, p_zone bigint, p_epoch bigint,
    p_expected_world_revision bigint, p_world_payload bytea,
    p_item_a bytea, p_expected_a_revision bigint,
    p_item_b bytea, p_expected_b_revision bigint,
    p_grant_id bytea
) RETURNS TABLE (
    world_revision bigint, item_a_revision bigint, item_b_revision bigint,
    outbox_sequence bigint, replay boolean
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, core_zone AS $$
DECLARE
    receipt core_zone.item_corpse_loot_receipts%ROWTYPE;
    grant_row core_zone.corpse_loot_grants%ROWTYPE;
    row_a core_zone.item_state%ROWTYPE;
    row_b core_zone.item_state%ROWTYPE;
    from_corpse bytea;
    to_inventory bytea;
    world_next bigint;
    event_next bigint;
    was_replayed boolean;
    next_a bigint;
    next_b bigint;
    zero16 bytea := decode(repeat('00', 16), 'hex');
BEGIN
    IF p_operation IS NULL OR octet_length(p_operation) != 16 OR p_operation = zero16
        OR p_world_mutation IS NULL OR octet_length(p_world_mutation) != 16
        OR p_world_mutation = zero16 OR p_world_mutation = p_operation
        OR p_character IS NULL OR octet_length(p_character) != 16 OR p_character = zero16
        OR p_corpse IS NULL OR octet_length(p_corpse) != 16 OR p_corpse = zero16
        OR p_item_a IS NULL OR octet_length(p_item_a) != 16 OR p_item_a = zero16
        OR p_item_b IS NULL OR octet_length(p_item_b) != 16 OR p_item_b = zero16
        OR p_item_a >= p_item_b
        OR p_grant_id IS NULL OR octet_length(p_grant_id) != 16 OR p_grant_id = zero16
        OR p_expected_a_revision IS NULL OR p_expected_a_revision <= 0
        OR p_expected_b_revision IS NULL OR p_expected_b_revision <= 0
    THEN
        RAISE EXCEPTION 'invalid canonical corpse-loot item identities or revisions';
    END IF;

    from_corpse := decode('03' || encode(p_corpse, 'hex') || repeat('00', 9), 'hex');
    to_inventory := decode('01' || encode(p_character, 'hex') || repeat('00', 9), 'hex');
    PERFORM core_zone.assert_c3g_location(from_corpse);
    PERFORM core_zone.assert_c3g_location(to_inventory);

    INSERT INTO core_zone.item_corpse_loot_receipts (
        operation_id, world_mutation_id, character_id, corpse_id,
        worker, zone, authority_epoch, expected_world_revision, world_payload,
        item_a, expected_a_revision, item_b, expected_b_revision, grant_id
    ) VALUES (
        p_operation, p_world_mutation, p_character, p_corpse,
        p_worker, p_zone, p_epoch, p_expected_world_revision, p_world_payload,
        p_item_a, p_expected_a_revision, p_item_b, p_expected_b_revision, p_grant_id
    ) ON CONFLICT DO NOTHING;

    SELECT * INTO STRICT receipt FROM core_zone.item_corpse_loot_receipts
    WHERE operation_id = p_operation FOR UPDATE;
    IF receipt.world_mutation_id IS DISTINCT FROM p_world_mutation
        OR receipt.character_id IS DISTINCT FROM p_character
        OR receipt.corpse_id IS DISTINCT FROM p_corpse
        OR receipt.worker IS DISTINCT FROM p_worker
        OR receipt.zone IS DISTINCT FROM p_zone
        OR receipt.authority_epoch IS DISTINCT FROM p_epoch
        OR receipt.expected_world_revision IS DISTINCT FROM p_expected_world_revision
        OR receipt.world_payload IS DISTINCT FROM p_world_payload
        OR receipt.item_a IS DISTINCT FROM p_item_a
        OR receipt.expected_a_revision IS DISTINCT FROM p_expected_a_revision
        OR receipt.item_b IS DISTINCT FROM p_item_b
        OR receipt.expected_b_revision IS DISTINCT FROM p_expected_b_revision
        OR receipt.grant_id IS DISTINCT FROM p_grant_id
    THEN
        RAISE EXCEPTION 'conflicting corpse-loot transaction ID';
    END IF;

    IF receipt.world_revision IS NOT NULL THEN
        RETURN QUERY SELECT receipt.world_revision, receipt.item_a_revision,
            receipt.item_b_revision, receipt.outbox_sequence, true;
        RETURN;
    END IF;

    -- A grant is issued only by a trusted DB-owner-controlled server path.
    -- This is a DB-scoped authorization precondition, NOT actor identity.
    -- Lock after completed-receipt replay so exact ACK retries remain valid.
    SELECT * INTO grant_row FROM core_zone.corpse_loot_grants
    WHERE grant_id = p_grant_id FOR UPDATE;
    IF NOT FOUND OR grant_row.revoked
        OR grant_row.expires_at <= clock_timestamp()
        OR grant_row.consumed_operation_id IS NOT NULL
        OR grant_row.character_id IS DISTINCT FROM p_character
        OR grant_row.corpse_id IS DISTINCT FROM p_corpse
        OR grant_row.item_a IS DISTINCT FROM p_item_a
        OR grant_row.item_b IS DISTINCT FROM p_item_b
    THEN
        RAISE EXCEPTION 'no active matching trusted corpse-loot grant';
    END IF;

    UPDATE core_zone.corpse_loot_grants
    SET consumed_operation_id = p_operation
    WHERE grant_id = p_grant_id;

    SELECT w.world_revision, w.outbox_sequence, w.replay
        INTO STRICT world_next, event_next, was_replayed
    FROM core_zone.commit_world_mutation(
        p_world_mutation, 1::smallint, p_character, p_worker, p_zone, p_epoch,
        p_expected_world_revision, p_world_payload
    ) AS w;
    IF was_replayed THEN
        RAISE EXCEPTION 'historical world receipt cannot authorize corpse loot';
    END IF;

    -- Lock only the two source item rows, in ascending ID order. C4d holds
    -- the requesting character authority row for this entire transaction.
    SELECT * INTO row_a FROM core_zone.item_state
    WHERE item_id = p_item_a FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'first corpse item missing';
    END IF;
    SELECT * INTO row_b FROM core_zone.item_state
    WHERE item_id = p_item_b FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'second corpse item missing';
    END IF;
    IF row_a.retired OR row_b.retired
        OR row_a.revision != p_expected_a_revision
        OR row_b.revision != p_expected_b_revision
        OR row_a.location IS DISTINCT FROM from_corpse
        OR row_b.location IS DISTINCT FROM from_corpse
        OR row_a.revision = 9223372036854775807
        OR row_b.revision = 9223372036854775807
    THEN
        RAISE EXCEPTION 'stale or unauthorized-by-source-location corpse item CAS';
    END IF;

    next_a := row_a.revision + 1;
    next_b := row_b.revision + 1;
    UPDATE core_zone.item_state
    SET revision = next_a, location = to_inventory
    WHERE item_id = p_item_a;
    UPDATE core_zone.item_state
    SET revision = next_b, location = to_inventory
    WHERE item_id = p_item_b;

    INSERT INTO core_zone.item_corpse_loot_outbox (
        outbox_sequence, operation_id, item_id, item_revision,
        corpse_location, inventory_location
    ) VALUES
        (event_next, p_operation, p_item_a, next_a, from_corpse, to_inventory),
        (event_next, p_operation, p_item_b, next_b, from_corpse, to_inventory);

    UPDATE core_zone.item_corpse_loot_receipts SET
        world_revision = world_next, item_a_revision = next_a,
        item_b_revision = next_b, outbox_sequence = event_next
    WHERE operation_id = p_operation;

    RETURN QUERY SELECT world_next, next_a, next_b, event_next, false;
END;
$$;

REVOKE ALL ON core_zone.corpse_loot_grants FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA core_zone FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA core_zone FROM PUBLIC;
COMMIT;
