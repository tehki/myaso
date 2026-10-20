-- C4d dormant proof: in-transaction world state + outbox atomically
-- fenced by the same PostgreSQL entity row as C4c handoffs.
-- NOT a live gameplay adapter, item ledger, networking service, or wallet.
-- Requires 001_zone_authority_postgres.sql already applied to the SAME primary.

CREATE TABLE IF NOT EXISTS core_zone.world_state (
    entity_kind smallint NOT NULL,
    entity_id bytea NOT NULL CHECK (
        octet_length(entity_id) = 16
        AND entity_id <> decode('00000000000000000000000000000000', 'hex')
    ),
    revision bigint NOT NULL CHECK (revision > 0),
    payload bytea NOT NULL CHECK (octet_length(payload) BETWEEN 1 AND 4096),
    PRIMARY KEY (entity_kind, entity_id),
    FOREIGN KEY (entity_kind, entity_id)
        REFERENCES core_zone.entities (entity_kind, entity_id)
);

-- The complete immutable request and result receipt are retained together.
-- Missing results exist only inside an uncommitted DB transaction, never
-- visible to another committed transaction.
CREATE TABLE IF NOT EXISTS core_zone.world_mutation_receipts (
    mutation_id bytea PRIMARY KEY CHECK (
        octet_length(mutation_id) = 16
        AND mutation_id <> decode('00000000000000000000000000000000', 'hex')
    ),
    entity_kind smallint NOT NULL,
    entity_id bytea NOT NULL CHECK (
        octet_length(entity_id) = 16
        AND entity_id <> decode('00000000000000000000000000000000', 'hex')
    ),
    worker bigint NOT NULL CHECK (worker > 0),
    zone bigint NOT NULL CHECK (zone > 0),
    authority_epoch bigint NOT NULL CHECK (authority_epoch > 0),
    expected_revision bigint NOT NULL CHECK (expected_revision >= 0),
    payload bytea NOT NULL CHECK (octet_length(payload) BETWEEN 1 AND 4096),
    world_revision bigint CHECK (world_revision IS NULL OR world_revision > 0),
    outbox_sequence bigint CHECK (outbox_sequence IS NULL OR outbox_sequence > 0),
    CHECK ((world_revision IS NULL) = (outbox_sequence IS NULL)),
    FOREIGN KEY (entity_kind, entity_id)
        REFERENCES core_zone.entities (entity_kind, entity_id)
);

CREATE TABLE IF NOT EXISTS core_zone.world_event_outbox (
    sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mutation_id bytea UNIQUE NOT NULL,
    entity_kind smallint NOT NULL,
    entity_id bytea NOT NULL CHECK (
        octet_length(entity_id) = 16
        AND entity_id <> decode('00000000000000000000000000000000', 'hex')
    ),
    authority_epoch bigint NOT NULL CHECK (authority_epoch > 0),
    world_revision bigint NOT NULL CHECK (world_revision > 0),
    payload bytea NOT NULL CHECK (octet_length(payload) BETWEEN 1 AND 4096),
    FOREIGN KEY (mutation_id) REFERENCES core_zone.world_mutation_receipts (mutation_id),
    FOREIGN KEY (entity_kind, entity_id)
        REFERENCES core_zone.entities (entity_kind, entity_id)
);
CREATE INDEX IF NOT EXISTS world_event_outbox_entity_idx
    ON core_zone.world_event_outbox (entity_kind, entity_id, world_revision);

-- Returning a previously committed receipt is safe only as an idempotent
-- *historical result*. It never authorizes new gameplay or target activation.
-- A new mutation must check the exact live worker/zone/epoch while holding
-- the SAME row lock as handoff, then update state and outbox in one statement
-- transaction. On an exception the complete insert/update/outbox rolls back.
CREATE OR REPLACE FUNCTION core_zone.commit_world_mutation(
    p_mutation bytea,
    p_kind smallint,
    p_entity bytea,
    p_worker bigint,
    p_zone bigint,
    p_epoch bigint,
    p_expected_revision bigint,
    p_payload bytea
) RETURNS TABLE (
    world_revision bigint,
    outbox_sequence bigint,
    replay boolean
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, core_zone AS $$
DECLARE
    receipt core_zone.world_mutation_receipts%ROWTYPE;
    owned core_zone.entities%ROWTYPE;
    current_revision bigint;
    next_revision bigint;
    published_sequence bigint;
BEGIN
    IF p_mutation IS NULL OR octet_length(p_mutation) != 16
        OR p_mutation = decode('00000000000000000000000000000000', 'hex')
        OR p_entity IS NULL OR octet_length(p_entity) != 16
        OR p_entity = decode('00000000000000000000000000000000', 'hex')
        OR p_payload IS NULL OR octet_length(p_payload) NOT BETWEEN 1 AND 4096
        OR p_kind IS NULL OR p_kind NOT IN (1, 2)
        OR p_worker IS NULL OR p_worker <= 0
        OR p_zone IS NULL OR p_zone <= 0
        OR p_epoch IS NULL OR p_epoch <= 0
        OR p_expected_revision IS NULL OR p_expected_revision < 0
    THEN
        RAISE EXCEPTION 'invalid world mutation fields';
    END IF;

    -- The receipt key is locked FIRST, then the ownership row, avoiding a
    -- second set of lock ordering rules for retries vs concurrent handoffs.
    INSERT INTO core_zone.world_mutation_receipts (
        mutation_id, entity_kind, entity_id, worker, zone,
        authority_epoch, expected_revision, payload
    ) VALUES (
        p_mutation, p_kind, p_entity, p_worker, p_zone,
        p_epoch, p_expected_revision, p_payload
    ) ON CONFLICT DO NOTHING;

    SELECT * INTO STRICT receipt
    FROM core_zone.world_mutation_receipts
    WHERE mutation_id = p_mutation FOR UPDATE;

    IF receipt.entity_kind IS DISTINCT FROM p_kind
        OR receipt.entity_id IS DISTINCT FROM p_entity
        OR receipt.worker IS DISTINCT FROM p_worker
        OR receipt.zone IS DISTINCT FROM p_zone
        OR receipt.authority_epoch IS DISTINCT FROM p_epoch
        OR receipt.expected_revision IS DISTINCT FROM p_expected_revision
        OR receipt.payload IS DISTINCT FROM p_payload
    THEN
        RAISE EXCEPTION 'conflicting world mutation ID';
    END IF;

    IF receipt.world_revision IS NOT NULL THEN
        RETURN QUERY SELECT receipt.world_revision, receipt.outbox_sequence, true;
        RETURN;
    END IF;

    SELECT * INTO STRICT owned FROM core_zone.entities
    WHERE entity_kind = p_kind AND entity_id = p_entity FOR UPDATE;

    IF owned.retired OR owned.pending_operation IS NOT NULL
        OR owned.owner_worker != p_worker
        OR owned.owner_zone != p_zone
        OR owned.authority_epoch != p_epoch THEN
        RAISE EXCEPTION 'stale or frozen world mutation authority';
    END IF;

    SELECT COALESCE((SELECT s.revision FROM core_zone.world_state s
        WHERE s.entity_kind = p_kind AND s.entity_id = p_entity), 0)
        INTO current_revision;

    IF current_revision != p_expected_revision
        OR current_revision = 9223372036854775807 THEN
        RAISE EXCEPTION 'world state revision conflict or overflow';
    END IF;

    next_revision := current_revision + 1;
    INSERT INTO core_zone.world_state (
        entity_kind, entity_id, revision, payload
    ) VALUES (p_kind, p_entity, next_revision, p_payload)
    ON CONFLICT (entity_kind, entity_id) DO UPDATE
        SET revision = EXCLUDED.revision, payload = EXCLUDED.payload;

    INSERT INTO core_zone.world_event_outbox (
        mutation_id, entity_kind, entity_id, authority_epoch,
        world_revision, payload
    ) VALUES (
        p_mutation, p_kind, p_entity, p_epoch, next_revision, p_payload
    ) RETURNING sequence INTO published_sequence;

    UPDATE core_zone.world_mutation_receipts
    SET world_revision = next_revision, outbox_sequence = published_sequence
    WHERE mutation_id = p_mutation;

    RETURN QUERY SELECT next_revision, published_sequence, false;
END;
$$;

-- Never permit the network role to issue DML against state or outbox tables:
-- only the trusted, security-definer function should modify these records.
-- Grant EXECUTE selectively to verified server roles during staged rollout.
REVOKE ALL ON ALL TABLES IN SCHEMA core_zone FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA core_zone FROM PUBLIC;
