-- Core C4c: transactional zone-ownership fencing reference for PostgreSQL 15+.
-- DORMANT: no live game endpoint invokes these functions.
-- All inputs must be supplied by an authenticated, authorized server service.
-- One primary PostgreSQL authority is required; async replica reads cannot
-- authorize writes or a post-failover owner.
CREATE SCHEMA IF NOT EXISTS core_zone;
REVOKE ALL ON SCHEMA core_zone FROM PUBLIC;

CREATE TABLE IF NOT EXISTS core_zone.entities (
    entity_kind smallint NOT NULL CHECK (entity_kind IN (1, 2)),
    entity_id bytea NOT NULL CHECK (octet_length(entity_id) = 16),
    owner_worker bigint NOT NULL CHECK (owner_worker > 0),
    owner_zone bigint NOT NULL CHECK (owner_zone > 0),
    authority_epoch bigint NOT NULL CHECK (authority_epoch > 0),
    pending_operation bytea CHECK (pending_operation IS NULL OR octet_length(pending_operation) = 16),
    retired boolean NOT NULL DEFAULT false,
    PRIMARY KEY (entity_kind, entity_id)
);

CREATE TABLE IF NOT EXISTS core_zone.handoffs (
    operation_id bytea PRIMARY KEY CHECK (octet_length(operation_id) = 16),
    entity_kind smallint NOT NULL CHECK (entity_kind IN (1, 2)),
    entity_id bytea NOT NULL CHECK (octet_length(entity_id) = 16),
    source_worker bigint NOT NULL CHECK (source_worker > 0),
    source_zone bigint NOT NULL CHECK (source_zone > 0),
    source_epoch bigint NOT NULL CHECK (source_epoch > 0),
    target_worker bigint NOT NULL CHECK (target_worker > 0),
    target_zone bigint NOT NULL CHECK (target_zone > 0),
    phase text NOT NULL CHECK (phase IN ('prepared', 'committed', 'aborted')),
    committed_epoch bigint CHECK (committed_epoch IS NULL OR committed_epoch > 0),
    FOREIGN KEY (entity_kind, entity_id)
        REFERENCES core_zone.entities (entity_kind, entity_id),
    CHECK ((phase = 'committed') = (committed_epoch IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS handoffs_entity_idx
    ON core_zone.handoffs (entity_kind, entity_id);

CREATE OR REPLACE FUNCTION core_zone.register_entity(
    p_kind smallint, p_entity bytea, p_worker bigint, p_zone bigint
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core_zone AS $
BEGIN
    INSERT INTO core_zone.entities
        (entity_kind, entity_id, owner_worker, owner_zone, authority_epoch)
    VALUES (p_kind, p_entity, p_worker, p_zone, 1)
    ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'zone entity already registered or retired'
            USING ERRCODE = '23505';
    END IF;
    RETURN 1;
END;
$$;

-- Exactly one prepared transfer for an entity, with globally unique
-- operation IDs. Row locks and the handoff PK serialize unrelated worker
-- sessions even when they are on different hosts.
CREATE OR REPLACE FUNCTION core_zone.prepare_transfer(
    p_operation bytea,
    p_kind smallint, p_entity bytea,
    p_source_worker bigint, p_source_zone bigint, p_source_epoch bigint,
    p_target_worker bigint, p_target_zone bigint
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core_zone AS $
DECLARE
    h core_zone.handoffs%ROWTYPE;
    e core_zone.entities%ROWTYPE;
BEGIN
    IF p_operation IS NULL OR octet_length(p_operation) != 16 THEN
        RAISE EXCEPTION 'invalid operation ID';
    END IF;
    IF p_source_worker = p_target_worker AND p_source_zone = p_target_zone THEN
        RAISE EXCEPTION 'same destination';
    END IF;

    -- Serialize by operation ID FIRST, then by entity, in every routine.
    -- The insert remains invisible until this function's transaction commits.
    INSERT INTO core_zone.handoffs (
        operation_id, entity_kind, entity_id,
        source_worker, source_zone, source_epoch,
        target_worker, target_zone, phase
    ) VALUES (
        p_operation, p_kind, p_entity,
        p_source_worker, p_source_zone, p_source_epoch,
        p_target_worker, p_target_zone, 'prepared'
    ) ON CONFLICT DO NOTHING;
    SELECT * INTO STRICT h FROM core_zone.handoffs
        WHERE operation_id = p_operation FOR UPDATE;
    IF h.entity_kind IS DISTINCT FROM p_kind
        OR h.entity_id IS DISTINCT FROM p_entity
        OR h.source_worker IS DISTINCT FROM p_source_worker
        OR h.source_zone IS DISTINCT FROM p_source_zone
        OR h.source_epoch IS DISTINCT FROM p_source_epoch
        OR h.target_worker IS DISTINCT FROM p_target_worker
        OR h.target_zone IS DISTINCT FROM p_target_zone THEN
        RAISE EXCEPTION 'conflicting transaction ID';
    END IF;

    SELECT * INTO STRICT e FROM core_zone.entities
        WHERE entity_kind = p_kind AND entity_id = p_entity FOR UPDATE;
    IF h.phase = 'committed' THEN
        IF e.retired OR e.pending_operation IS NOT NULL
            OR e.owner_worker != h.target_worker
            OR e.owner_zone != h.target_zone
            OR e.authority_epoch != h.committed_epoch THEN
            RAISE EXCEPTION 'committed transaction is no longer current';
        END IF;
        RETURN 'committed';
    END IF;
    IF h.phase = 'aborted' THEN
        RAISE EXCEPTION 'transaction was aborted; ID cannot be reused';
    END IF;
    IF NOT e.retired AND e.pending_operation = p_operation
        AND e.owner_worker = p_source_worker
        AND e.owner_zone = p_source_zone
        AND e.authority_epoch = p_source_epoch THEN
        RETURN 'prepared'; -- exact prepare retry, no second mutation
    END IF;
    IF e.retired OR e.pending_operation IS NOT NULL
        OR e.owner_worker != p_source_worker
        OR e.owner_zone != p_source_zone
        OR e.authority_epoch != p_source_epoch THEN
        RAISE EXCEPTION 'stale or already prepared authority';
    END IF;
    IF e.authority_epoch = 9223372036854775807 THEN
        RAISE EXCEPTION 'authority epoch exhausted';
    END IF;
    UPDATE core_zone.entities SET pending_operation = p_operation
        WHERE entity_kind = p_kind AND entity_id = p_entity;
    RETURN 'prepared';
END;
$$;

CREATE OR REPLACE FUNCTION core_zone.commit_transfer(
    p_operation bytea
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core_zone AS $
DECLARE
    h core_zone.handoffs%ROWTYPE;
    e core_zone.entities%ROWTYPE;
    next_epoch bigint;
BEGIN
    SELECT * INTO STRICT h FROM core_zone.handoffs
        WHERE operation_id = p_operation FOR UPDATE;
    SELECT * INTO STRICT e FROM core_zone.entities
        WHERE entity_kind = h.entity_kind AND entity_id = h.entity_id FOR UPDATE;

    IF h.phase = 'committed' THEN
        IF e.retired OR e.pending_operation IS NOT NULL
            OR e.owner_worker != h.target_worker
            OR e.owner_zone != h.target_zone
            OR e.authority_epoch != h.committed_epoch THEN
            RAISE EXCEPTION 'stale committed handoff acknowledgement';
        END IF;
        RETURN h.committed_epoch;
    END IF;
    IF h.phase != 'prepared' OR e.retired
        OR e.pending_operation IS DISTINCT FROM p_operation
        OR e.owner_worker != h.source_worker
        OR e.owner_zone != h.source_zone
        OR e.authority_epoch != h.source_epoch THEN
        RAISE EXCEPTION 'unprepared or stale handoff';
    END IF;
    IF e.authority_epoch = 9223372036854775807 THEN
        RAISE EXCEPTION 'authority epoch exhausted';
    END IF;

    next_epoch := e.authority_epoch + 1;
    UPDATE core_zone.entities SET
        owner_worker = h.target_worker, owner_zone = h.target_zone,
        authority_epoch = next_epoch, pending_operation = NULL
        WHERE entity_kind = h.entity_kind AND entity_id = h.entity_id;
    UPDATE core_zone.handoffs SET
        phase = 'committed', committed_epoch = next_epoch
        WHERE operation_id = p_operation;
    RETURN next_epoch;
END;
$$;

CREATE OR REPLACE FUNCTION core_zone.abort_transfer(
    p_operation bytea
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core_zone AS $
DECLARE
    h core_zone.handoffs%ROWTYPE;
    e core_zone.entities%ROWTYPE;
BEGIN
    SELECT * INTO STRICT h FROM core_zone.handoffs
        WHERE operation_id = p_operation FOR UPDATE;
    SELECT * INTO STRICT e FROM core_zone.entities
        WHERE entity_kind = h.entity_kind AND entity_id = h.entity_id FOR UPDATE;
    IF h.phase = 'aborted' THEN
        IF e.retired OR e.pending_operation IS NOT NULL
            OR e.owner_worker != h.source_worker
            OR e.owner_zone != h.source_zone
            OR e.authority_epoch != h.source_epoch THEN
            RAISE EXCEPTION 'stale aborted handoff acknowledgement';
        END IF;
        RETURN 'aborted';
    END IF;
    IF h.phase != 'prepared' OR e.retired
        OR e.pending_operation IS DISTINCT FROM p_operation
        OR e.owner_worker != h.source_worker
        OR e.owner_zone != h.source_zone
        OR e.authority_epoch != h.source_epoch THEN
        RAISE EXCEPTION 'cannot abort committed or stale handoff';
    END IF;
    UPDATE core_zone.entities SET pending_operation = NULL
        WHERE entity_kind = h.entity_kind AND entity_id = h.entity_id;
    UPDATE core_zone.handoffs SET phase = 'aborted'
        WHERE operation_id = p_operation;
    RETURN 'aborted';
END;
$$;

-- A read-only diagnostic; NOT an authorization check for a mutation.
CREATE OR REPLACE FUNCTION core_zone.is_current(
    p_kind smallint, p_entity bytea,
    p_worker bigint, p_zone bigint, p_epoch bigint
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, core_zone AS $
    SELECT EXISTS (
        SELECT 1 FROM core_zone.entities
        WHERE entity_kind = p_kind AND entity_id = p_entity
          AND NOT retired AND pending_operation IS NULL
          AND owner_worker = p_worker AND owner_zone = p_zone
          AND authority_epoch = p_epoch
    );
$$;

-- Must run in the SAME PostgreSQL transaction as the state-changing write.
-- Locks the authority row until COMMIT; a subsequent handoff must wait.
CREATE OR REPLACE FUNCTION core_zone.assert_mutation_authority(
    p_kind smallint, p_entity bytea,
    p_worker bigint, p_zone bigint, p_epoch bigint
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core_zone AS $
BEGIN
    PERFORM 1 FROM core_zone.entities
        WHERE entity_kind = p_kind AND entity_id = p_entity
          AND NOT retired AND pending_operation IS NULL
          AND owner_worker = p_worker AND owner_zone = p_zone
          AND authority_epoch = p_epoch
        FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'stale or frozen authority';
    END IF;
END;
$$;

-- Permanent tombstones: never delete or reuse an entity identity.
CREATE OR REPLACE FUNCTION core_zone.retire_entity(
    p_kind smallint, p_entity bytea,
    p_worker bigint, p_zone bigint, p_epoch bigint
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core_zone AS $
BEGIN
    UPDATE core_zone.entities SET retired = true
        WHERE entity_kind = p_kind AND entity_id = p_entity
          AND owner_worker = p_worker AND owner_zone = p_zone
          AND authority_epoch = p_epoch
          AND pending_operation IS NULL AND NOT retired;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'stale or frozen retirement';
    END IF;
END;
$$;

-- DEFINER functions are intentionally owned by the migration role, NOT
-- the network application role. Deploy with a dedicated NOLOGIN owner (not
-- a superuser); grant only schema USAGE + function EXECUTE to a trusted
-- application role. The fixed search_path prevents caller-schema shadowing.
-- Never grant direct authority-table DML to untrusted or browser-facing roles.
-- Deployment must explicitly GRANT EXECUTE only to a verified server role.
-- PUBLIC must not call authority mutations or read per-player ownership.
REVOKE ALL ON ALL TABLES IN SCHEMA core_zone FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA core_zone FROM PUBLIC;
