-- Economics E2j: PostgreSQL 16 disposable settlement experiment ONLY.
-- NEVER APPLY TO LIVE DATABASES. NO account authentication, wallets, Moon Coin,
-- player-facing route, or installed Core C4d world mutation provider.
-- Use solely on a disposable database named myaso_e2j_test.
CREATE SCHEMA e2j_lab;
REVOKE ALL ON SCHEMA e2j_lab FROM PUBLIC;

CREATE TABLE e2j_lab.accounts (
  account_key bytea PRIMARY KEY CHECK(octet_length(account_key)=16),
  kind text NOT NULL CHECK(kind IN ('player','treasury')),
  credits bigint NOT NULL CHECK(credits>=0),
  revision bigint NOT NULL DEFAULT 1 CHECK(revision>0)
);
CREATE UNIQUE INDEX e2j_only_treasury
  ON e2j_lab.accounts(kind) WHERE kind='treasury';

-- These admissions are manually seeded demo data, NOT real login sessions.
CREATE TABLE e2j_lab.admissions (
  session_ref bytea PRIMARY KEY CHECK(octet_length(session_ref)=16),
  account_key bytea NOT NULL REFERENCES e2j_lab.accounts(account_key),
  character_key bytea NOT NULL CHECK(octet_length(character_key)=16),
  generation bigint NOT NULL CHECK(generation>0),
  active boolean NOT NULL
);
-- A MOCK Core C4c-style zone authority row, not the actual core_zone table.
CREATE TABLE e2j_lab.zone_fences (
  parcel_key bytea PRIMARY KEY CHECK(octet_length(parcel_key)=16),
  worker bigint NOT NULL CHECK(worker>0),
  zone bigint NOT NULL CHECK(zone>0),
  epoch bigint NOT NULL CHECK(epoch>0),
  frozen boolean NOT NULL DEFAULT false
);
CREATE TABLE e2j_lab.titles (
  parcel_key bytea PRIMARY KEY REFERENCES e2j_lab.zone_fences(parcel_key),
  owner_key bytea NOT NULL REFERENCES e2j_lab.accounts(account_key),
  revision bigint NOT NULL CHECK(revision>0)
);
CREATE TABLE e2j_lab.listings (
  listing_id bigint PRIMARY KEY CHECK(listing_id>0),
  parcel_key bytea NOT NULL REFERENCES e2j_lab.titles(parcel_key),
  seller_key bytea NOT NULL REFERENCES e2j_lab.accounts(account_key),
  title_revision bigint NOT NULL CHECK(title_revision>0),
  price bigint NOT NULL CHECK(price>0),
  fee_bps integer NOT NULL CHECK(fee_bps BETWEEN 0 AND 1000),
  expiry_tick bigint NOT NULL CHECK(expiry_tick>0),
  consent_ref bytea NOT NULL UNIQUE CHECK(octet_length(consent_ref)=16),
  state text NOT NULL CHECK(state IN ('active','consumed','revoked'))
);
CREATE UNIQUE INDEX e2j_active_parcel_listing
  ON e2j_lab.listings(parcel_key) WHERE state='active';
-- Consent is fixture-seeded, not cryptographically authenticated.
CREATE TABLE e2j_lab.consents (
  consent_ref bytea PRIMARY KEY CHECK(octet_length(consent_ref)=16),
  listing_id bigint NOT NULL UNIQUE REFERENCES e2j_lab.listings(listing_id),
  parcel_key bytea NOT NULL REFERENCES e2j_lab.titles(parcel_key),
  seller_key bytea NOT NULL REFERENCES e2j_lab.accounts(account_key),
  title_revision bigint NOT NULL CHECK(title_revision>0),
  price bigint NOT NULL CHECK(price>0),
  fee_bps integer NOT NULL CHECK(fee_bps BETWEEN 0 AND 1000),
  expiry_tick bigint NOT NULL CHECK(expiry_tick>0),
  state text NOT NULL CHECK(state IN ('approved','consumed','revoked'))
);
CREATE TABLE e2j_lab.receipts (
  receipt_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operation_key bytea NOT NULL UNIQUE CHECK(octet_length(operation_key)=16),
  session_ref bytea NOT NULL REFERENCES e2j_lab.admissions(session_ref),
  buyer_key bytea NOT NULL REFERENCES e2j_lab.accounts(account_key),
  worker bigint NOT NULL,
  zone bigint NOT NULL,
  epoch bigint NOT NULL,
  listing_id bigint NOT NULL REFERENCES e2j_lab.listings(listing_id),
  expected_title_revision bigint NOT NULL,
  expected_buyer_revision bigint NOT NULL,
  price bigint NOT NULL,
  seller_proceeds bigint NOT NULL,
  fee bigint NOT NULL,
  new_title_revision bigint NOT NULL
);
CREATE TABLE e2j_lab.postings (
  receipt_id bigint NOT NULL REFERENCES e2j_lab.receipts(receipt_id),
  slot smallint NOT NULL CHECK(slot IN (0,1,2)),
  account_key bytea NOT NULL REFERENCES e2j_lab.accounts(account_key),
  delta bigint NOT NULL,
  PRIMARY KEY(receipt_id,slot)
);
CREATE TABLE e2j_lab.outbox (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_id bigint NOT NULL UNIQUE REFERENCES e2j_lab.receipts(receipt_id),
  parcel_key bytea NOT NULL REFERENCES e2j_lab.titles(parcel_key),
  title_revision bigint NOT NULL CHECK(title_revision>0),
  buyer_key bytea NOT NULL REFERENCES e2j_lab.accounts(account_key),
  epoch bigint NOT NULL CHECK(epoch>0)
);

CREATE FUNCTION e2j_lab.settle_test_purchase(
  p_operation bytea,
  p_session bytea,
  p_worker bigint,
  p_zone bigint,
  p_epoch bigint,
  p_listing bigint,
  p_title_revision bigint,
  p_buyer_revision bigint,
  p_tick bigint
) RETURNS TABLE(committed_receipt bigint, was_replay boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,e2j_lab
AS $fn$
DECLARE
  s e2j_lab.admissions%ROWTYPE;
  prev e2j_lab.receipts%ROWTYPE;
  listing e2j_lab.listings%ROWTYPE;
  c e2j_lab.consents%ROWTYPE;
  f e2j_lab.zone_fences%ROWTYPE;
  t e2j_lab.titles%ROWTYPE;
  buyer e2j_lab.accounts%ROWTYPE;
  seller e2j_lab.accounts%ROWTYPE;
  treasury e2j_lab.accounts%ROWTYPE;
  fee_value bigint;
  seller_value bigint;
  new_receipt bigint;
BEGIN
  -- The flag is a QA misuse barrier only; SETtable GUC is NOT authentication.
  IF current_database() <> 'myaso_e2j_test'
     OR current_setting('myaso.e2j.test_only',true) IS DISTINCT FROM 'on'
     THEN RAISE EXCEPTION 'E2j accepts only its disposable test database';
  END IF;
  IF p_operation IS NULL OR octet_length(p_operation)<>16
     OR p_session IS NULL OR octet_length(p_session)<>16
     OR p_worker IS NULL OR p_worker<=0 OR p_zone IS NULL OR p_zone<=0
     OR p_epoch IS NULL OR p_epoch<=0 OR p_listing IS NULL OR p_listing<=0
     OR p_title_revision IS NULL OR p_title_revision<=0
     OR p_buyer_revision IS NULL OR p_buyer_revision<=0
     OR p_tick IS NULL OR p_tick<0
  THEN RAISE EXCEPTION 'Malformed E2j fixture intent';
  END IF;
  -- Lock admission *before* replay: revoked actors cannot retrieve receipts.
  SELECT * INTO s FROM e2j_lab.admissions a
   WHERE a.session_ref=p_session FOR UPDATE;
  IF NOT FOUND OR NOT s.active OR s.generation<>p_epoch
    THEN RAISE EXCEPTION 'Unadmitted or stale fictional session';
  END IF;
  SELECT * INTO prev FROM e2j_lab.receipts r
    WHERE r.operation_key=p_operation FOR UPDATE;
  IF FOUND THEN
    IF prev.session_ref IS DISTINCT FROM p_session
       OR prev.buyer_key IS DISTINCT FROM s.account_key
       OR prev.worker IS DISTINCT FROM p_worker
       OR prev.zone IS DISTINCT FROM p_zone
       OR prev.epoch IS DISTINCT FROM p_epoch
       OR prev.listing_id IS DISTINCT FROM p_listing
       OR prev.expected_title_revision IS DISTINCT FROM p_title_revision
       OR prev.expected_buyer_revision IS DISTINCT FROM p_buyer_revision
    THEN RAISE EXCEPTION 'Conflicting idempotency intent';
    END IF;
    -- Historical idempotency MUST NOT be a stale worker read capability.
    -- Re-check the SAME fenced parcel row even when no new sale occurs.
    SELECT * INTO f FROM e2j_lab.zone_fences z
      WHERE z.parcel_key=(
        SELECT l.parcel_key FROM e2j_lab.listings l
        WHERE l.listing_id=prev.listing_id
      ) FOR UPDATE;
    IF NOT FOUND OR f.frozen OR f.worker<>p_worker
       OR f.zone<>p_zone OR f.epoch<>p_epoch
      THEN RAISE EXCEPTION 'Old receipt denied by changed authority';
    END IF;
    RETURN QUERY SELECT prev.receipt_id, true;
    RETURN;
  END IF;
  SELECT * INTO listing FROM e2j_lab.listings l
    WHERE l.listing_id=p_listing FOR UPDATE;
  IF NOT FOUND OR listing.state<>'active'
     OR listing.title_revision<>p_title_revision
     OR listing.expiry_tick<p_tick
     OR listing.seller_key=s.account_key
    THEN RAISE EXCEPTION 'Inactive, stale, expired or self-buy listing';
  END IF;
  SELECT * INTO f FROM e2j_lab.zone_fences z
    WHERE z.parcel_key=listing.parcel_key FOR UPDATE;
  IF NOT FOUND OR f.frozen OR f.worker<>p_worker
     OR f.zone<>p_zone OR f.epoch<>p_epoch
    THEN RAISE EXCEPTION 'Stale, frozen or absent zone fence';
  END IF;
  SELECT * INTO t FROM e2j_lab.titles x
    WHERE x.parcel_key=listing.parcel_key FOR UPDATE;
  IF NOT FOUND OR t.owner_key<>listing.seller_key
     OR t.revision<>listing.title_revision
    THEN RAISE EXCEPTION 'Stale deed/title or seller';
  END IF;
  SELECT * INTO c FROM e2j_lab.consents x
    WHERE x.consent_ref=listing.consent_ref FOR UPDATE;
  IF NOT FOUND OR c.state<>'approved'
     OR c.listing_id<>listing.listing_id
     OR c.parcel_key<>listing.parcel_key
     OR c.seller_key<>listing.seller_key
     OR c.title_revision<>listing.title_revision
     OR c.price<>listing.price OR c.fee_bps<>listing.fee_bps
     OR c.expiry_tick<>listing.expiry_tick
    THEN RAISE EXCEPTION 'Consent absent/revoked/altered';
  END IF;
  -- Fixed order of account-row locks; same database transaction as title.
  PERFORM a.account_key FROM e2j_lab.accounts a
    WHERE a.account_key IN (s.account_key,listing.seller_key,
      decode('00000000000000000000000000000001','hex'))
    ORDER BY a.account_key FOR UPDATE;
  SELECT * INTO buyer FROM e2j_lab.accounts a
    WHERE a.account_key=s.account_key;
  SELECT * INTO seller FROM e2j_lab.accounts a
    WHERE a.account_key=listing.seller_key;
  SELECT * INTO treasury FROM e2j_lab.accounts a
    WHERE a.account_key=decode('00000000000000000000000000000001','hex');
  IF buyer.kind IS DISTINCT FROM 'player' OR seller.kind IS DISTINCT FROM 'player'
     OR treasury.kind IS DISTINCT FROM 'treasury'
     OR buyer.revision<>p_buyer_revision
     OR buyer.credits<listing.price
    THEN RAISE EXCEPTION 'Invalid accounts, revision or buyer funds';
  END IF;
  fee_value:=floor((listing.price::numeric*c.fee_bps)/10000)::bigint;
  seller_value:=listing.price-fee_value;
  -- Overflow in integer balance arithmetic raises an exception and rolls back.
  UPDATE e2j_lab.accounts a SET credits=credits-listing.price,revision=revision+1
    WHERE a.account_key=buyer.account_key;
  UPDATE e2j_lab.accounts a SET credits=credits+seller_value,revision=revision+1
    WHERE a.account_key=seller.account_key;
  UPDATE e2j_lab.accounts a SET credits=credits+fee_value,revision=revision+1
    WHERE a.account_key=treasury.account_key;
  UPDATE e2j_lab.titles x SET owner_key=buyer.account_key,revision=revision+1
    WHERE x.parcel_key=listing.parcel_key;
  UPDATE e2j_lab.listings x SET state='consumed' WHERE x.listing_id=p_listing;
  UPDATE e2j_lab.consents x SET state='consumed' WHERE x.consent_ref=c.consent_ref;
  INSERT INTO e2j_lab.receipts(
    operation_key,session_ref,buyer_key,worker,zone,epoch,listing_id,
    expected_title_revision,expected_buyer_revision,price,seller_proceeds,fee,
    new_title_revision
  ) VALUES(
    p_operation,p_session,buyer.account_key,p_worker,p_zone,p_epoch,p_listing,
    p_title_revision,p_buyer_revision,listing.price,seller_value,fee_value,
    p_title_revision+1
  ) RETURNING receipt_id INTO new_receipt;
  INSERT INTO e2j_lab.postings(receipt_id,slot,account_key,delta) VALUES
    (new_receipt,0,buyer.account_key,-listing.price),
    (new_receipt,1,seller.account_key,seller_value),
    (new_receipt,2,treasury.account_key,fee_value);
  INSERT INTO e2j_lab.outbox(receipt_id,parcel_key,title_revision,buyer_key,epoch)
    VALUES(new_receipt,listing.parcel_key,p_title_revision+1,buyer.account_key,p_epoch);
  RETURN QUERY SELECT new_receipt,false;
END
$fn$;
