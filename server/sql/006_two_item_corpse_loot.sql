-- Core 8B C3k: dormant TWO-item corpse-to-inventory batch mutation.
-- Depends on Core 8C C4c 001 + C4d 002 and C3g/C3h 003, C3i 004, C3j 005.
-- Same PostgreSQL primary and transaction, no trusted loot-permission verifier.
-- Only two existing items at exactly one corpse -> one character inventory.

BEGIN;

ALTER TABLE core_zone.item_operation_ids
    DROP CONSTRAINT item_operation_ids_operation_family_check;
ALTER TABLE core_zone.item_operation_ids
    ADD CONSTRAINT item_operation_ids_operation_family_check
        CHECK (operation_family IN (1, 2, 3));

CREATE TABLE IF NOT EXISTS core_zone.item_corpse_loot_receipts (
    operation_id bytea PRIMARY KEY CHECK (octet_length(operation_id) = 16),
    world_mutation_id bytea NOT NULL UNIQUE CHECK (octet_length(world_mutation_id) = 16),
    entity_kind smallint NOT NULL DEFAULT 1 CHECK (entity_kind = 1),
    character_id bytea NOT NULL CHECK (octet_length(character_id) = 16),
    corpse_id bytea NOT NULL CHECK (octet_length(corpse_id) = 16),
    worker bigint NOT NULL CHECK (worker > 0),
    zone bigint NOT NULL CHECK (zone > 0),
    authority_epoch bigint NOT NULL CHECK (authority_epoch > 0),
    expected_world_revision bigint NOT NULL CHECK (expected_world_revision >= 0),
    world_payload bytea NOT NULL CHECK (octet_length(world_payload) BETWEEN 1 AND 4096),
    item_a bytea NOT NULL CHECK (octet_length(item_a) = 16),
    expected_a_revision bigint NOT NULL CHECK (expected_a_revision > 0),
    item_b bytea NOT NULL CHECK (octet_length(item_b) = 16),
    expected_b_revision bigint NOT NULL CHECK (expected_b_revision > 0),
    world_revision bigint CHECK (world_revision IS NULL OR world_revision > 0),
    item_a_revision bigint CHECK (item_a_revision IS NULL OR item_a_revision > 0),
    item_b_revision bigint CHECK (item_b_revision IS NULL OR item_b_revision > 0),
    outbox_sequence bigint CHECK (outbox_sequence IS NULL OR outbox_sequence > 0),
    CHECK (item_a < item_b),
    CHECK (
        (world_revision IS NULL AND item_a_revision IS NULL
            AND item_b_revision IS NULL AND outbox_sequence IS NULL)
        OR (world_revision IS NOT NULL AND item_a_revision IS NOT NULL
            AND item_b_revision IS NOT NULL AND outbox_sequence IS NOT NULL)
    ),
    FOREIGN KEY (world_mutation_id)
        REFERENCES core_zone.world_mutation_receipts (mutation_id)
        DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (entity_kind, character_id)
        REFERENCES core_zone.entities (entity_kind, entity_id)
);

CREATE TABLE IF NOT EXISTS core_zone.item_corpse_loot_outbox (
    outbox_sequence bigint NOT NULL REFERENCES core_zone.world_event_outbox (sequence),
    operation_id bytea NOT NULL REFERENCES core_zone.item_corpse_loot_receipts (operation_id),
    item_id bytea NOT NULL REFERENCES core_zone.item_state (item_id),
    item_revision bigint NOT NULL CHECK (item_revision > 0),
    corpse_location bytea NOT NULL CHECK (octet_length(corpse_location) = 26),
    inventory_location bytea NOT NULL CHECK (octet_length(inventory_location) = 26),
    PRIMARY KEY (outbox_sequence, item_id),
    UNIQUE (operation_id, item_id)
);

-- Upgrade the C3j registry to a third protocol family, preserving its
-- existing trigger protection for both C3g and C3i without a bypass.
CREATE OR REPLACE FUNCTION core_zone.reserve_item_operation_id()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, core_zone AS $$
DECLARE
    expected_family smallint;
    stored_family smallint;
BEGIN
    IF TG_TABLE_SCHEMA != 'core_zone' THEN
        RAISE EXCEPTION 'unrecognized operation receipt schema';
    END IF;
    IF TG_TABLE_NAME = 'item_world_receipts' THEN
        expected_family := 1;
    ELSIF TG_TABLE_NAME = 'item_swap_receipts' THEN
        expected_family := 2;
    ELSIF TG_TABLE_NAME = 'item_corpse_loot_receipts' THEN
        expected_family := 3;
    ELSE
        RAISE EXCEPTION 'unrecognized operation receipt table';
    END IF;

    IF NEW.operation_id IS NULL OR octet_length(NEW.operation_id) != 16
        OR NEW.operation_id = decode(repeat('00', 16), 'hex') THEN
        RAISE EXCEPTION 'invalid global item operation ID';
    END IF;

    INSERT INTO core_zone.item_operation_ids (operation_id, operation_family)
    VALUES (NEW.operation_id, expected_family)
    ON CONFLICT DO NOTHING;

    SELECT operation_family INTO STRICT stored_family
    FROM core_zone.item_operation_ids
    WHERE operation_id = NEW.operation_id
    FOR UPDATE;

    IF stored_family IS DISTINCT FROM expected_family THEN
        RAISE EXCEPTION 'item operation ID already used by a different protocol family';
    END IF;
    RETURN NEW;
END;
$$;


CREATE TRIGGER item_corpse_loot_global_id_guard
    BEFORE INSERT ON core_zone.item_corpse_loot_receipts
    FOR EACH ROW EXECUTE FUNCTION core_zone.reserve_item_operation_id();

-- Under one C4d-fenced character world row, lock both item rows in sorted
-- ID order; source corpse and destination inventory must match EXACTLY.
-- Does not verify the character's right to loot that corpse.
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
DECLARE
    receipt core_zone.item_corpse_loot_receipts%ROWTYPE;
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
        item_a, expected_a_revision, item_b, expected_b_revision
    ) VALUES (
        p_operation, p_world_mutation, p_character, p_corpse,
        p_worker, p_zone, p_epoch, p_expected_world_revision, p_world_payload,
        p_item_a, p_expected_a_revision, p_item_b, p_expected_b_revision
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
    THEN
        RAISE EXCEPTION 'conflicting corpse-loot transaction ID';
    END IF;

    IF receipt.world_revision IS NOT NULL THEN
        RETURN QUERY SELECT receipt.world_revision, receipt.item_a_revision,
            receipt.item_b_revision, receipt.outbox_sequence, true;
        RETURN;
    END IF;

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

REVOKE ALL ON ALL TABLES IN SCHEMA core_zone FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA core_zone FROM PUBLIC;
COMMIT;
