-- C3i dormant one-character, two-item atomic equipment swap.
-- Requires C4c 001 + C4d 002 + C3g/C3h 003 on the same primary.
-- This function DOES NOT authenticate a player or worker.

CREATE TABLE IF NOT EXISTS core_zone.item_swap_receipts (
    operation_id bytea PRIMARY KEY CHECK (octet_length(operation_id) = 16),
    world_mutation_id bytea NOT NULL UNIQUE CHECK (octet_length(world_mutation_id) = 16),
    entity_kind smallint NOT NULL DEFAULT 1 CHECK (entity_kind = 1),
    character_id bytea NOT NULL CHECK (octet_length(character_id) = 16),
    worker bigint NOT NULL CHECK (worker > 0),
    zone bigint NOT NULL CHECK (zone > 0),
    authority_epoch bigint NOT NULL CHECK (authority_epoch > 0),
    expected_world_revision bigint NOT NULL CHECK (expected_world_revision >= 0),
    world_payload bytea NOT NULL CHECK (octet_length(world_payload) BETWEEN 1 AND 4096),
    item_a bytea NOT NULL CHECK (octet_length(item_a) = 16),
    expected_a_revision bigint NOT NULL CHECK (expected_a_revision > 0),
    location_a bytea NOT NULL CHECK (octet_length(location_a) = 26),
    item_b bytea NOT NULL CHECK (octet_length(item_b) = 16),
    expected_b_revision bigint NOT NULL CHECK (expected_b_revision > 0),
    location_b bytea NOT NULL CHECK (octet_length(location_b) = 26),
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

CREATE TABLE IF NOT EXISTS core_zone.item_swap_outbox (
    outbox_sequence bigint NOT NULL
        REFERENCES core_zone.world_event_outbox (sequence),
    operation_id bytea NOT NULL
        REFERENCES core_zone.item_swap_receipts (operation_id),
    item_id bytea NOT NULL REFERENCES core_zone.item_state (item_id),
    previous_location bytea NOT NULL CHECK (octet_length(previous_location) = 26),
    new_location bytea NOT NULL CHECK (octet_length(new_location) = 26),
    item_revision bigint NOT NULL CHECK (item_revision > 0),
    PRIMARY KEY (outbox_sequence, item_id),
    UNIQUE (operation_id, item_id)
);

-- The C3h partial unique index is immediate, not DEFERRABLE. Stage both
-- equipped items at their owner inventory inside this same uncommitted
-- transaction, then assign final swapped slots. No other session can see
-- the staged state; a crash rolls everything back including the C4d world.
CREATE OR REPLACE FUNCTION core_zone.commit_two_item_equipment_swap(
    p_operation bytea, p_world_mutation bytea,
    p_character bytea, p_worker bigint, p_zone bigint, p_epoch bigint,
    p_expected_world_revision bigint, p_world_payload bytea,
    p_item_a bytea, p_expected_a_revision bigint, p_location_a bytea,
    p_item_b bytea, p_expected_b_revision bigint, p_location_b bytea
) RETURNS TABLE (
    world_revision bigint,
    item_a_revision bigint,
    item_b_revision bigint,
    outbox_sequence bigint,
    replay boolean
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, core_zone AS $$
DECLARE
    receipt core_zone.item_swap_receipts%ROWTYPE;
    row_a core_zone.item_state%ROWTYPE;
    row_b core_zone.item_state%ROWTYPE;
    world_next bigint;
    event_next bigint;
    was_replayed boolean;
    next_a bigint;
    next_b bigint;
    stage_location bytea;
    zero16 bytea := decode(repeat('00', 16), 'hex');
BEGIN
    IF p_operation IS NULL OR octet_length(p_operation) != 16 OR p_operation = zero16
        OR p_world_mutation IS NULL OR octet_length(p_world_mutation) != 16
        OR p_world_mutation = zero16 OR p_world_mutation = p_operation
        OR p_character IS NULL OR octet_length(p_character) != 16 OR p_character = zero16
        OR p_item_a IS NULL OR octet_length(p_item_a) != 16 OR p_item_a = zero16
        OR p_item_b IS NULL OR octet_length(p_item_b) != 16 OR p_item_b = zero16
        OR p_item_a >= p_item_b
        OR p_expected_a_revision IS NULL OR p_expected_a_revision <= 0
        OR p_expected_b_revision IS NULL OR p_expected_b_revision <= 0
    THEN
        RAISE EXCEPTION 'invalid swap identities, revisions or canonical item order';
    END IF;
    PERFORM core_zone.assert_c3g_location(p_location_a);
    PERFORM core_zone.assert_c3g_location(p_location_b);
    IF get_byte(p_location_a, 0) != 2 OR get_byte(p_location_b, 0) != 2
        OR p_location_a = p_location_b
        OR substring(p_location_a FROM 2 FOR 16) != p_character
        OR substring(p_location_b FROM 2 FOR 16) != p_character
    THEN
        RAISE EXCEPTION 'swap requires two distinct equipped slots of same character';
    END IF;

    INSERT INTO core_zone.item_swap_receipts (
        operation_id, world_mutation_id, character_id, worker, zone, authority_epoch,
        expected_world_revision, world_payload, item_a, expected_a_revision,
        location_a, item_b, expected_b_revision, location_b
    ) VALUES (
        p_operation, p_world_mutation, p_character, p_worker, p_zone, p_epoch,
        p_expected_world_revision, p_world_payload, p_item_a, p_expected_a_revision,
        p_location_a, p_item_b, p_expected_b_revision, p_location_b
    ) ON CONFLICT DO NOTHING;

    SELECT * INTO STRICT receipt FROM core_zone.item_swap_receipts
    WHERE operation_id = p_operation FOR UPDATE;
    IF receipt.world_mutation_id IS DISTINCT FROM p_world_mutation
        OR receipt.character_id IS DISTINCT FROM p_character
        OR receipt.worker IS DISTINCT FROM p_worker
        OR receipt.zone IS DISTINCT FROM p_zone
        OR receipt.authority_epoch IS DISTINCT FROM p_epoch
        OR receipt.expected_world_revision IS DISTINCT FROM p_expected_world_revision
        OR receipt.world_payload IS DISTINCT FROM p_world_payload
        OR receipt.item_a IS DISTINCT FROM p_item_a
        OR receipt.expected_a_revision IS DISTINCT FROM p_expected_a_revision
        OR receipt.location_a IS DISTINCT FROM p_location_a
        OR receipt.item_b IS DISTINCT FROM p_item_b
        OR receipt.expected_b_revision IS DISTINCT FROM p_expected_b_revision
        OR receipt.location_b IS DISTINCT FROM p_location_b
    THEN
        RAISE EXCEPTION 'conflicting two-item swap operation ID';
    END IF;
    IF receipt.world_revision IS NOT NULL THEN
        RETURN QUERY SELECT receipt.world_revision, receipt.item_a_revision,
            receipt.item_b_revision, receipt.outbox_sequence, true;
        RETURN;
    END IF;

    -- C4d atomically checks worker, zone, epoch, handoff freeze and world CAS
    -- while holding the exact C4c authority row used for transfer fencing.
    SELECT w.world_revision, w.outbox_sequence, w.replay
        INTO STRICT world_next, event_next, was_replayed
    FROM core_zone.commit_world_mutation(
        p_world_mutation, 1::smallint, p_character, p_worker, p_zone,
        p_epoch, p_expected_world_revision, p_world_payload
    ) AS w;
    IF was_replayed THEN
        RAISE EXCEPTION 'old world-only receipt cannot authorize fresh swap';
    END IF;

    -- Canonical p_item_a < p_item_b: acquire and hold locks in ID order.
    SELECT * INTO row_a FROM core_zone.item_state
        WHERE item_id = p_item_a FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'missing first swap item';
    END IF;
    SELECT * INTO row_b FROM core_zone.item_state
        WHERE item_id = p_item_b FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'missing second swap item';
    END IF;
    IF row_a.retired OR row_b.retired
        OR row_a.revision != p_expected_a_revision
        OR row_b.revision != p_expected_b_revision
        OR row_a.location IS DISTINCT FROM p_location_a
        OR row_b.location IS DISTINCT FROM p_location_b
        OR row_a.revision = 9223372036854775807
        OR row_b.revision = 9223372036854775807
    THEN
        RAISE EXCEPTION 'stale item swap revision, location or retired ID';
    END IF;
    next_a := row_a.revision + 1;
    next_b := row_b.revision + 1;

    -- A valid C3f inventory location for the SAME character. Uncommitted.
    stage_location := decode('01' || encode(p_character, 'hex') || repeat('00', 9), 'hex');
    UPDATE core_zone.item_state SET location = stage_location
    WHERE item_id IN (p_item_a, p_item_b);
    -- All unique equipment index entries are now released inside this tx.
    UPDATE core_zone.item_state SET location = p_location_b, revision = next_a
    WHERE item_id = p_item_a;
    UPDATE core_zone.item_state SET location = p_location_a, revision = next_b
    WHERE item_id = p_item_b;

    INSERT INTO core_zone.item_swap_outbox (
        outbox_sequence, operation_id, item_id, previous_location, new_location, item_revision
    ) VALUES
        (event_next, p_operation, p_item_a, p_location_a, p_location_b, next_a),
        (event_next, p_operation, p_item_b, p_location_b, p_location_a, next_b);

    UPDATE core_zone.item_swap_receipts SET
        world_revision = world_next, item_a_revision = next_a,
        item_b_revision = next_b, outbox_sequence = event_next
    WHERE operation_id = p_operation;
    RETURN QUERY SELECT world_next, next_a, next_b, event_next, false;
END;
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA core_zone FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA core_zone FROM PUBLIC;
