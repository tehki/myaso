-- Core 8B C3j: one durable idempotency namespace across C3g single-item
-- and C3i two-item swap requests on one trusted PostgreSQL primary.
-- Requires C4c 001, C4d 002, C3g/C3h 003 and C3i 004 already applied.
-- DORMANT: this neither verifies actors nor enables item/world gameplay.
--
-- The migration is atomic and holds write-blocking locks while backfilling
-- historical receipts. Existing cross-family ID collisions fail migration.

BEGIN;

LOCK TABLE core_zone.item_world_receipts, core_zone.item_swap_receipts
    IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS core_zone.item_operation_ids (
    operation_id bytea PRIMARY KEY
        CHECK (octet_length(operation_id) = 16
            AND operation_id != decode(repeat('00', 16), 'hex')),
    operation_family smallint NOT NULL
        CHECK (operation_family IN (1, 2))
);
-- Family 1 = C3g one-item create/move/destroy; family 2 = C3i swap.
-- A committed reservation is a permanent historical tombstone, even if
-- higher-level item/world objects have since been retired.

-- Migrate preexisting receipts under both table locks. A historical ID
-- collision spanning both protocol families must abort this migration.
INSERT INTO core_zone.item_operation_ids (operation_id, operation_family)
SELECT operation_id, 1 FROM core_zone.item_world_receipts
ON CONFLICT DO NOTHING;

INSERT INTO core_zone.item_operation_ids (operation_id, operation_family)
SELECT operation_id, 2 FROM core_zone.item_swap_receipts
ON CONFLICT DO NOTHING;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM core_zone.item_world_receipts AS r
        JOIN core_zone.item_operation_ids AS g USING (operation_id)
        WHERE g.operation_family != 1
    ) OR EXISTS (
        SELECT 1 FROM core_zone.item_swap_receipts AS r
        JOIN core_zone.item_operation_ids AS g USING (operation_id)
        WHERE g.operation_family != 2
    ) THEN
        RAISE EXCEPTION 'conflicting historical item operation IDs: manual reconciliation required';
    END IF;
END;
$$;

-- All future attempts reserve the ID in the SAME transaction as the
-- immutable family receipt. BEFORE INSERT applies even when the caller uses
-- INSERT ... ON CONFLICT DO NOTHING for exact idempotent retries.
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

DROP TRIGGER IF EXISTS item_world_global_id_guard
    ON core_zone.item_world_receipts;
CREATE TRIGGER item_world_global_id_guard
    BEFORE INSERT ON core_zone.item_world_receipts
    FOR EACH ROW EXECUTE FUNCTION core_zone.reserve_item_operation_id();

DROP TRIGGER IF EXISTS item_swap_global_id_guard
    ON core_zone.item_swap_receipts;
CREATE TRIGGER item_swap_global_id_guard
    BEFORE INSERT ON core_zone.item_swap_receipts
    FOR EACH ROW EXECUTE FUNCTION core_zone.reserve_item_operation_id();

REVOKE ALL ON core_zone.item_operation_ids FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION core_zone.reserve_item_operation_id() FROM PUBLIC;
COMMIT;
