-- Core 8C C4e: upgrade existing dormant C4c/C4d schemas, not just fresh installs.
-- Requires 001 and 002 applied to a single isolated PostgreSQL primary.
-- A zero-valued legacy ID causes the entire migration to abort unchanged.
-- No production deployment is authorized by this reference migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $c4e$
DECLARE
    spec record;
BEGIN
    FOR spec IN SELECT * FROM (VALUES
        ('core_zone.entities', 'c4e_entities_entity_nonzero', 'entity_id <> decode(''00000000000000000000000000000000'', ''hex'')'),
        ('core_zone.entities', 'c4e_entities_pending_nonzero', 'pending_operation <> decode(''00000000000000000000000000000000'', ''hex'')'),
        ('core_zone.handoffs', 'c4e_handoffs_operation_nonzero', 'operation_id <> decode(''00000000000000000000000000000000'', ''hex'')'),
        ('core_zone.handoffs', 'c4e_handoffs_entity_nonzero', 'entity_id <> decode(''00000000000000000000000000000000'', ''hex'')'),
        ('core_zone.world_state', 'c4e_world_state_entity_nonzero', 'entity_id <> decode(''00000000000000000000000000000000'', ''hex'')'),
        ('core_zone.world_mutation_receipts', 'c4e_receipts_mutation_nonzero', 'mutation_id <> decode(''00000000000000000000000000000000'', ''hex'')'),
        ('core_zone.world_mutation_receipts', 'c4e_receipts_entity_nonzero', 'entity_id <> decode(''00000000000000000000000000000000'', ''hex'')'),
        ('core_zone.world_event_outbox', 'c4e_outbox_entity_nonzero', 'entity_id <> decode(''00000000000000000000000000000000'', ''hex'')')
    ) AS constraints(relation_name, constraint_name, predicate)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_constraint
            WHERE conrelid = spec.relation_name::regclass
              AND conname = spec.constraint_name
        ) THEN
            -- ADD CHECK validates preexisting rows before this transaction commits.
            -- PostgreSQL holds an ALTER TABLE lock; do not modify hot tables.
            EXECUTE format(
                'ALTER TABLE %s ADD CONSTRAINT %I CHECK (%s)',
                spec.relation_name::regclass, spec.constraint_name, spec.predicate
            );
        END IF;
    END LOOP;
END;
$c4e$;
COMMIT;
