-- Core 8B C3m: permanently freeze corpse-loot grant scope and consumption.
-- Requires 001..007, one trusted PostgreSQL primary. DORMANT DB-only proof.
-- Does not authenticate a player or provide a trusted grant issuer.
BEGIN;

-- A completed C3l receipt must point at the actual grant record. Legacy
-- C3k receipts have NULL grant_id and remain historical, not reauthorized.
-- Fail the upgrade if any non-NULL existing reference is inconsistent.
ALTER TABLE core_zone.item_corpse_loot_receipts
    ADD CONSTRAINT item_corpse_loot_receipt_grant_fk
    FOREIGN KEY (grant_id) REFERENCES core_zone.corpse_loot_grants (grant_id)
    DEFERRABLE INITIALLY IMMEDIATE;

CREATE OR REPLACE FUNCTION core_zone.guard_corpse_loot_grant_history()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, core_zone AS $$
DECLARE
    matches_receipt boolean;
BEGIN
    IF TG_TABLE_SCHEMA != 'core_zone'
        OR TG_TABLE_NAME != 'corpse_loot_grants' THEN
        RAISE EXCEPTION 'unsupported corpse grant history trigger target';
    END IF;

    IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN
        RAISE EXCEPTION 'corpse grant history is permanent';
    ELSIF TG_OP != 'UPDATE' THEN
        RAISE EXCEPTION 'unsupported corpse grant history mutation';
    END IF;

    -- A grant is a permanently scoped authorization record: not even a
    -- trusted DB issuer may silently change the entitled principal, the
    -- corpse, the item pair, or extend/shorten the original expiration.
    IF NEW.grant_id IS DISTINCT FROM OLD.grant_id
        OR NEW.character_id IS DISTINCT FROM OLD.character_id
        OR NEW.corpse_id IS DISTINCT FROM OLD.corpse_id
        OR NEW.item_a IS DISTINCT FROM OLD.item_a
        OR NEW.item_b IS DISTINCT FROM OLD.item_b
        OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
        RAISE EXCEPTION 'immutable corpse-loot grant scope or expiry';
    END IF;

    -- Revocation is monotone. Never re-enable a previously revoked grant.
    IF OLD.revoked AND NOT NEW.revoked THEN
        RAISE EXCEPTION 'corpse-loot grant revocation cannot be undone';
    END IF;

    -- Once consumed, the grant has one irreversible historical operation.
    IF OLD.consumed_operation_id IS NOT NULL THEN
        IF NEW.consumed_operation_id IS DISTINCT FROM OLD.consumed_operation_id THEN
            RAISE EXCEPTION 'corpse-loot grant consumption cannot be rewritten';
        END IF;
    ELSIF NEW.consumed_operation_id IS NOT NULL THEN
        IF OLD.revoked OR NEW.revoked OR OLD.expires_at <= clock_timestamp() THEN
            RAISE EXCEPTION 'revoked or expired corpse grant cannot be consumed';
        END IF;
        -- A leaked SQL INSERT/UPDATE permission on the grant table cannot
        -- attach the grant to a different corpse or unrelated operation.
        SELECT EXISTS (
            SELECT 1 FROM core_zone.item_corpse_loot_receipts AS receipt
            WHERE receipt.operation_id = NEW.consumed_operation_id
              AND receipt.grant_id = OLD.grant_id
              AND receipt.character_id = OLD.character_id
              AND receipt.corpse_id = OLD.corpse_id
              AND receipt.item_a = OLD.item_a
              AND receipt.item_b = OLD.item_b
        ) INTO matches_receipt;
        IF NOT matches_receipt THEN
            RAISE EXCEPTION 'grant consumption has no matching immutable loot receipt';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER corpse_loot_grants_immutable_history
    BEFORE UPDATE OR DELETE ON core_zone.corpse_loot_grants
    FOR EACH ROW EXECUTE FUNCTION core_zone.guard_corpse_loot_grant_history();

CREATE TRIGGER corpse_loot_grants_no_truncate
    BEFORE TRUNCATE ON core_zone.corpse_loot_grants
    FOR EACH STATEMENT EXECUTE FUNCTION core_zone.guard_corpse_loot_grant_history();

REVOKE ALL ON core_zone.corpse_loot_grants FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION core_zone.guard_corpse_loot_grant_history() FROM PUBLIC;
COMMIT;
