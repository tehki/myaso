-- Core 8B C3g: dormant, single-item + versioned world mutation atomicity.
-- REQUIRES C4c 001 and C4d 002 installed on the SAME PostgreSQL primary.
-- No trusted actor/worker authenticator, game adapter, payment or deployment.
-- Inventory/corpse/trade permission checks are NOT supplied by this function.

CREATE TABLE IF NOT EXISTS core_zone.item_state (
    item_id bytea PRIMARY KEY CHECK (octet_length(item_id) = 16),
    revision bigint NOT NULL CHECK (revision > 0),
    location bytea CHECK (location IS NULL OR octet_length(location) = 26),
    retired boolean NOT NULL DEFAULT false,
    CHECK (retired = (location IS NULL))
);
-- Item IDs never leave this table, including destroyed/retired items.

CREATE TABLE IF NOT EXISTS core_zone.item_world_receipts (
    operation_id bytea PRIMARY KEY CHECK (octet_length(operation_id) = 16),
    world_mutation_id bytea NOT NULL UNIQUE CHECK (octet_length(world_mutation_id) = 16),
    entity_kind smallint NOT NULL CHECK (entity_kind IN (1, 2)),
    entity_id bytea NOT NULL CHECK (octet_length(entity_id) = 16),
    worker bigint NOT NULL CHECK (worker > 0),
    zone bigint NOT NULL CHECK (zone > 0),
    authority_epoch bigint NOT NULL CHECK (authority_epoch > 0),
    expected_world_revision bigint NOT NULL CHECK (expected_world_revision >= 0),
    world_payload bytea NOT NULL CHECK (octet_length(world_payload) BETWEEN 1 AND 4096),
    item_id bytea NOT NULL CHECK (octet_length(item_id) = 16),
    operation_kind smallint NOT NULL CHECK (operation_kind IN (1, 2, 3)),
    expected_item_revision bigint NOT NULL CHECK (expected_item_revision >= 0),
    expected_location bytea CHECK (expected_location IS NULL OR octet_length(expected_location) = 26),
    new_location bytea CHECK (new_location IS NULL OR octet_length(new_location) = 26),
    world_revision bigint CHECK (world_revision IS NULL OR world_revision > 0),
    item_revision bigint CHECK (item_revision IS NULL OR item_revision > 0),
    outbox_sequence bigint CHECK (outbox_sequence IS NULL OR outbox_sequence > 0),
    CHECK (
        (world_revision IS NULL AND item_revision IS NULL AND outbox_sequence IS NULL)
        OR (world_revision IS NOT NULL AND item_revision IS NOT NULL AND outbox_sequence IS NOT NULL)
    ),
    CHECK (
        (operation_kind = 1 AND expected_item_revision = 0 AND expected_location IS NULL AND new_location IS NOT NULL)
        OR (operation_kind = 2 AND expected_item_revision > 0 AND expected_location IS NOT NULL AND new_location IS NOT NULL
            AND expected_location != new_location)
        OR (operation_kind = 3 AND expected_item_revision > 0 AND expected_location IS NOT NULL AND new_location IS NULL)
    ),
    FOREIGN KEY (entity_kind, entity_id)
        REFERENCES core_zone.entities (entity_kind, entity_id),
    FOREIGN KEY (world_mutation_id)
        REFERENCES core_zone.world_mutation_receipts (mutation_id)
        DEFERRABLE INITIALLY DEFERRED
);

-- Same global C4d event sequence: item delta is a typed companion row to
-- core_zone.world_event_outbox. Subscribers MUST consume/ACK both atomically
-- before claiming item+world event delivery. No publisher exists yet.
CREATE TABLE IF NOT EXISTS core_zone.item_world_outbox (
    outbox_sequence bigint PRIMARY KEY
        REFERENCES core_zone.world_event_outbox (sequence),
    operation_id bytea NOT NULL UNIQUE
        REFERENCES core_zone.item_world_receipts (operation_id),
    item_id bytea NOT NULL
        REFERENCES core_zone.item_state (item_id),
    operation_kind smallint NOT NULL CHECK (operation_kind IN (1, 2, 3)),
    item_revision bigint NOT NULL CHECK (item_revision > 0),
    new_location bytea CHECK (new_location IS NULL OR octet_length(new_location) = 26)
);

-- Fail closed on byte layouts different from C3f's PROPOSED 26-byte
-- canonical big-endian encoding. PostgreSQL substrings use 1-based indexes.
CREATE OR REPLACE FUNCTION core_zone.assert_c3g_location(p_location bytea)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, core_zone AS $$
DECLARE
    tag integer;
    zero16 bytea := decode(repeat('00', 16), 'hex');
BEGIN
    IF p_location IS NULL OR octet_length(p_location) != 26 THEN
        RAISE EXCEPTION 'invalid item location length';
    END IF;
    tag := get_byte(p_location, 0);
    IF tag IN (1, 3) THEN
        IF substring(p_location FROM 2 FOR 16) = zero16
            OR substring(p_location FROM 18 FOR 9) != decode(repeat('00', 9), 'hex') THEN
            RAISE EXCEPTION 'noncanonical item principal or padding';
        END IF;
    ELSIF tag = 2 THEN
        IF substring(p_location FROM 2 FOR 16) = zero16
            OR substring(p_location FROM 19 FOR 8) != decode(repeat('00', 8), 'hex') THEN
            RAISE EXCEPTION 'noncanonical equipment principal or padding';
        END IF;
    ELSIF tag = 4 THEN
        IF substring(p_location FROM 2 FOR 8) = decode(repeat('00', 8), 'hex')
            OR substring(p_location FROM 10 FOR 9) != decode(repeat('00', 9), 'hex') THEN
            RAISE EXCEPTION 'noncanonical ground zone or padding';
        END IF;
    ELSE
        RAISE EXCEPTION 'unknown item location type';
    END IF;
END;
$$;

-- A single authoritative PostgreSQL transaction covers BOTH the C4d world
-- revision/receipt/outbox and exactly ONE item's CAS/receipt/outbox delta.
-- Lock order: unique item operation receipt -> C4d world receipt ->
-- shared C4c authority entity row -> item row. Handoff locks entity row,
-- so an older worker cannot commit after transfer. Multi-item/death/trade
-- and economics batches are OUT OF SCOPE (no atomic guarantee).
CREATE OR REPLACE FUNCTION core_zone.commit_item_world_mutation(
    p_operation bytea, p_world_mutation bytea,
    p_kind smallint, p_entity bytea,
    p_worker bigint, p_zone bigint, p_epoch bigint,
    p_expected_world_revision bigint, p_world_payload bytea,
    p_item bytea, p_item_operation smallint, p_expected_item_revision bigint,
    p_expected_location bytea, p_new_location bytea
) RETURNS TABLE (
    world_revision bigint,
    item_revision bigint,
    outbox_sequence bigint,
    replay boolean
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, core_zone AS $$
DECLARE
    receipt core_zone.item_world_receipts%ROWTYPE;
    original core_zone.item_state%ROWTYPE;
    next_item_revision bigint;
    published_world_revision bigint;
    published_outbox_sequence bigint;
    world_replay boolean;
    inserted_count integer;
    zero16 bytea := decode(repeat('00', 16), 'hex');
BEGIN
    IF p_operation IS NULL OR octet_length(p_operation) != 16 OR p_operation = zero16
        OR p_world_mutation IS NULL OR octet_length(p_world_mutation) != 16 OR p_world_mutation = zero16
        OR p_operation = p_world_mutation
        OR p_item IS NULL OR octet_length(p_item) != 16 OR p_item = zero16
        OR p_expected_item_revision IS NULL OR p_expected_item_revision < 0
        OR p_item_operation IS NULL OR p_item_operation NOT IN (1, 2, 3) THEN
        RAISE EXCEPTION 'invalid item operation identifiers or revision';
    END IF;

    IF p_item_operation = 1 THEN
        IF p_expected_item_revision != 0 OR p_expected_location IS NOT NULL
            OR p_new_location IS NULL THEN
            RAISE EXCEPTION 'invalid item create precondition';
        END IF;
    ELSIF p_item_operation = 2 THEN
        IF p_expected_item_revision = 0 OR p_expected_location IS NULL
            OR p_new_location IS NULL OR p_expected_location = p_new_location THEN
            RAISE EXCEPTION 'invalid item move precondition';
        END IF;
    ELSE
        IF p_expected_item_revision = 0 OR p_expected_location IS NULL
            OR p_new_location IS NOT NULL THEN
            RAISE EXCEPTION 'invalid item destroy precondition';
        END IF;
    END IF;
    IF p_expected_location IS NOT NULL THEN
        PERFORM core_zone.assert_c3g_location(p_expected_location);
    END IF;
    IF p_new_location IS NOT NULL THEN
        PERFORM core_zone.assert_c3g_location(p_new_location);
    END IF;

    INSERT INTO core_zone.item_world_receipts (
        operation_id, world_mutation_id, entity_kind, entity_id, worker, zone,
        authority_epoch, expected_world_revision, world_payload, item_id,
        operation_kind, expected_item_revision, expected_location, new_location
    ) VALUES (
        p_operation, p_world_mutation, p_kind, p_entity, p_worker, p_zone,
        p_epoch, p_expected_world_revision, p_world_payload, p_item,
        p_item_operation, p_expected_item_revision, p_expected_location, p_new_location
    ) ON CONFLICT DO NOTHING;

    SELECT * INTO STRICT receipt FROM core_zone.item_world_receipts
    WHERE operation_id = p_operation FOR UPDATE;

    IF receipt.world_mutation_id IS DISTINCT FROM p_world_mutation
        OR receipt.entity_kind IS DISTINCT FROM p_kind
        OR receipt.entity_id IS DISTINCT FROM p_entity
        OR receipt.worker IS DISTINCT FROM p_worker
        OR receipt.zone IS DISTINCT FROM p_zone
        OR receipt.authority_epoch IS DISTINCT FROM p_epoch
        OR receipt.expected_world_revision IS DISTINCT FROM p_expected_world_revision
        OR receipt.world_payload IS DISTINCT FROM p_world_payload
        OR receipt.item_id IS DISTINCT FROM p_item
        OR receipt.operation_kind IS DISTINCT FROM p_item_operation
        OR receipt.expected_item_revision IS DISTINCT FROM p_expected_item_revision
        OR receipt.expected_location IS DISTINCT FROM p_expected_location
        OR receipt.new_location IS DISTINCT FROM p_new_location THEN
        RAISE EXCEPTION 'conflicting item-world operation ID';
    END IF;
    IF receipt.world_revision IS NOT NULL THEN
        -- Immutable historical result only; NOT permission to activate.
        RETURN QUERY SELECT receipt.world_revision, receipt.item_revision, receipt.outbox_sequence, true;
        RETURN;
    END IF;

    -- In the SAME outer transaction, C4d locks the exact C4c authority row,
    -- applies world revision, and records one immutable world outbox event.
    SELECT w.world_revision, w.outbox_sequence, w.replay
        INTO STRICT published_world_revision, published_outbox_sequence, world_replay
    FROM core_zone.commit_world_mutation(
        p_world_mutation, p_kind, p_entity, p_worker, p_zone, p_epoch,
        p_expected_world_revision, p_world_payload
    ) AS w;
    -- A world-only prior receipt must NOT authorize a fresh item mutation.
    IF world_replay THEN
        RAISE EXCEPTION 'existing world mutation cannot authorize new item operation';
    END IF;

    IF p_item_operation = 1 THEN
        INSERT INTO core_zone.item_state (item_id, revision, location, retired)
        VALUES (p_item, 1, p_new_location, false)
        ON CONFLICT DO NOTHING;
        GET DIAGNOSTICS inserted_count = ROW_COUNT;
        IF inserted_count != 1 THEN
            RAISE EXCEPTION 'item identity was already allocated or retired';
        END IF;
        next_item_revision := 1;
    ELSE
        SELECT * INTO original FROM core_zone.item_state
        WHERE item_id = p_item FOR UPDATE;
        IF NOT FOUND OR original.retired OR original.location IS DISTINCT FROM p_expected_location
            OR original.revision != p_expected_item_revision THEN
            RAISE EXCEPTION 'item ownership compare-and-swap conflict';
        END IF;
        IF original.revision = 9223372036854775807 THEN
            RAISE EXCEPTION 'item revision exhausted';
        END IF;
        next_item_revision := original.revision + 1;
        UPDATE core_zone.item_state
        SET revision = next_item_revision, location = p_new_location,
            retired = (p_item_operation = 3)
        WHERE item_id = p_item;
    END IF;

    INSERT INTO core_zone.item_world_outbox (
        outbox_sequence, operation_id, item_id, operation_kind,
        item_revision, new_location
    ) VALUES (
        published_outbox_sequence, p_operation, p_item, p_item_operation,
        next_item_revision, p_new_location
    );

    UPDATE core_zone.item_world_receipts
    SET world_revision = published_world_revision,
        item_revision = next_item_revision,
        outbox_sequence = published_outbox_sequence
    WHERE operation_id = p_operation;

    RETURN QUERY SELECT published_world_revision, next_item_revision, published_outbox_sequence, false;
END;
$$;

-- DB callers are NOT implicitly trusted by possessing an opaque operation ID.
-- Schema-owner/grants review must ensure ONLY authenticated server code can
-- EXECUTE these SECURITY DEFINER functions; never grant public DML.
REVOKE ALL ON ALL TABLES IN SCHEMA core_zone FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA core_zone FROM PUBLIC;
