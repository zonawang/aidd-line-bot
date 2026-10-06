\set ON_ERROR_STOP on
BEGIN;
SET ROLE u1_migration;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA line_event AUTHORIZATION u1_migration;
CREATE SCHEMA privacy AUTHORIZATION u1_migration;
REVOKE ALL ON SCHEMA line_event, privacy FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE USAGE ON TYPES FROM PUBLIC;

CREATE DOMAIN privacy.key AS text CHECK (VALUE ~ '^[A-Za-z0-9_-]{1,128}$');
CREATE DOMAIN privacy.instant AS timestamptz CHECK (isfinite(VALUE));
CREATE DOMAIN line_event.key AS text CHECK (VALUE ~ '^[A-Za-z0-9_-]{1,128}$');
CREATE DOMAIN line_event.instant AS timestamptz CHECK (isfinite(VALUE));
CREATE SEQUENCE privacy.authority_order AS bigint MINVALUE 1 NO CYCLE CACHE 1;

CREATE FUNCTION privacy.utc_year(query_at timestamptz) RETURNS timestamptz
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog
AS $$ SELECT ((query_at AT TIME ZONE 'UTC') + interval '1 year') AT TIME ZONE 'UTC' $$;

CREATE FUNCTION privacy.fixed_fields() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF (to_jsonb(NEW) - COALESCE(TG_ARGV, ARRAY[]::text[])) IS DISTINCT FROM (to_jsonb(OLD) - COALESCE(TG_ARGV, ARRAY[]::text[])) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'immutable_fields';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION line_event.receipt_transition() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF ROW(NEW.event_key, NEW.original_event_at, NEW.received_at, NEW.purge_at)
     IS DISTINCT FROM ROW(OLD.event_key, OLD.original_event_at, OLD.received_at, OLD.purge_at)
     OR (NEW.reply_state <> OLD.reply_state AND NOT (
       (OLD.reply_state = 'not_started' AND NEW.reply_state = 'sending') OR
       (OLD.reply_state = 'sending' AND NEW.reply_state IN ('accepted', 'rejected', 'unknown'))))
     OR (NEW.processing_state <> OLD.processing_state AND NOT (
       (OLD.processing_state = 'claimed' AND NEW.processing_state IN ('processing', 'failed', 'abandoned')) OR
       (OLD.processing_state = 'processing' AND NEW.processing_state IN ('completed', 'failed', 'abandoned')))) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'invalid_receipt_transition';
  END IF;
  RETURN NEW;
END $$;

CREATE TABLE line_event.receipt (
  event_key line_event.key PRIMARY KEY,
  original_event_at line_event.instant NOT NULL,
  received_at line_event.instant NOT NULL,
  processing_state text NOT NULL DEFAULT 'claimed' CHECK (processing_state IN ('claimed', 'processing', 'completed', 'failed', 'abandoned')),
  reply_state text NOT NULL DEFAULT 'not_started' CHECK (reply_state IN ('not_started', 'sending', 'accepted', 'rejected', 'unknown')),
  purge_at line_event.instant NOT NULL,
  CHECK (original_event_at BETWEEN received_at - interval '24 hours' AND received_at + interval '5 minutes'),
  CHECK (purge_at > received_at AND purge_at <= received_at + interval '168 hours')
);
CREATE INDEX receipt_purge ON line_event.receipt (purge_at);
CREATE TRIGGER receipt_transition BEFORE UPDATE ON line_event.receipt FOR EACH ROW EXECUTE FUNCTION line_event.receipt_transition();

CREATE TABLE privacy.consent_state (
  subject_key privacy.key PRIMARY KEY,
  saving_choice text NOT NULL DEFAULT 'unselected' CHECK (saving_choice IN ('unselected', 'save', 'no_save')),
  notice_version privacy.key NOT NULL,
  consent_version privacy.key NOT NULL UNIQUE,
  boundary_order bigint NOT NULL UNIQUE CHECK (boundary_order > 0),
  changed_at privacy.instant NOT NULL
);
CREATE TRIGGER consent_identity BEFORE UPDATE ON privacy.consent_state FOR EACH ROW
EXECUTE FUNCTION privacy.fixed_fields('saving_choice', 'notice_version', 'consent_version', 'boundary_order', 'changed_at');

CREATE TABLE privacy.query_history (
  history_key privacy.key PRIMARY KEY,
  subject_key privacy.key NOT NULL,
  query_at privacy.instant NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  expires_at privacy.instant NOT NULL,
  result_summary text NOT NULL CHECK (result_summary IN ('found', 'zero_results', 'source_failure')),
  CHECK (expires_at = privacy.utc_year(query_at))
);
CREATE INDEX history_owner_page ON privacy.query_history (subject_key, query_at DESC, history_key ASC);
CREATE INDEX history_expiry ON privacy.query_history (expires_at, history_key);
CREATE TRIGGER history_immutable BEFORE UPDATE ON privacy.query_history FOR EACH ROW EXECUTE FUNCTION privacy.fixed_fields();

CREATE TABLE privacy.write_control (
  control_key privacy.key PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('admission', 'permit', 'deletion_barrier', 'cursor', 'choice_ref', 'delete_ref')),
  subject_key privacy.key NOT NULL,
  event_key privacy.key,
  history_key privacy.key,
  original_event_at privacy.instant,
  accepted_order bigint CHECK (accepted_order > 0),
  consent_version privacy.key,
  cutoff_at privacy.instant,
  cutoff_order bigint CHECK (cutoff_order > 0),
  write_outcome text CHECK (write_outcome IN ('not_attempted', 'saved', 'not_saved', 'unknown')),
  notice_version privacy.key,
  deadline_at privacy.instant,
  consumed boolean,
  action text CHECK (action IN ('next', 'choice_save', 'choice_no_save', 'delete_one')),
  cursor_at privacy.instant,
  cursor_key privacy.key,
  action_expires_at privacy.instant,
  created_at privacy.instant NOT NULL,
  purge_at privacy.instant NOT NULL,
  CHECK (purge_at > created_at AND purge_at <= created_at + interval '168 hours'),
  CHECK (deadline_at IS NULL OR (deadline_at > created_at AND deadline_at <= created_at + interval '10 seconds')),
  CHECK (action_expires_at IS NULL OR (action_expires_at = created_at + interval '15 minutes' AND action_expires_at <= purge_at)),
  CHECK (
    (kind = 'admission' AND num_nonnulls(event_key, original_event_at, accepted_order, deadline_at) = 4
      AND num_nonnulls(history_key, consent_version, cutoff_at, cutoff_order, write_outcome, notice_version, consumed, action, cursor_at, cursor_key, action_expires_at) = 0)
    OR (kind = 'permit' AND num_nonnulls(event_key, history_key, original_event_at, accepted_order, consent_version, notice_version, deadline_at, consumed, write_outcome) = 9
      AND num_nonnulls(cutoff_at, cutoff_order, action, cursor_at, cursor_key, action_expires_at) = 0
      AND (consumed = (write_outcome <> 'not_attempted')))
    OR (kind = 'deletion_barrier' AND num_nonnulls(cutoff_at, cutoff_order) = 2
      AND num_nonnulls(original_event_at, accepted_order, consent_version, write_outcome, notice_version, deadline_at, consumed, action, cursor_at, cursor_key, action_expires_at) = 0
      AND (event_key IS NULL OR history_key IS NOT NULL))
    OR (kind = 'cursor' AND num_nonnulls(action, cursor_at, cursor_key, action_expires_at) = 4 AND action = 'next' AND control_key ~ '^[0-9a-f]{64}$'
      AND num_nonnulls(event_key, history_key, original_event_at, accepted_order, consent_version, cutoff_at, cutoff_order, write_outcome, notice_version, deadline_at, consumed) = 0)
    OR (kind = 'choice_ref' AND num_nonnulls(action, notice_version, consent_version, action_expires_at, consumed) = 5 AND action IN ('choice_save', 'choice_no_save') AND control_key ~ '^[0-9a-f]{64}$'
      AND num_nonnulls(event_key, history_key, original_event_at, accepted_order, cutoff_at, cutoff_order, write_outcome, deadline_at, cursor_at, cursor_key) = 0)
    OR (kind = 'delete_ref' AND num_nonnulls(history_key, action, action_expires_at) = 3 AND action = 'delete_one' AND control_key ~ '^[0-9a-f]{64}$'
      AND num_nonnulls(event_key, original_event_at, accepted_order, consent_version, cutoff_at, cutoff_order, write_outcome, notice_version, deadline_at, consumed, cursor_at, cursor_key) = 0)
  )
);
CREATE UNIQUE INDEX admission_unique ON privacy.write_control (subject_key, event_key) WHERE kind = 'admission';
CREATE UNIQUE INDEX permit_unique ON privacy.write_control (subject_key, event_key) WHERE kind = 'permit';
CREATE INDEX control_purge ON privacy.write_control (purge_at);
CREATE INDEX control_subject ON privacy.write_control (subject_key, kind);
CREATE TRIGGER control_fixed BEFORE UPDATE ON privacy.write_control FOR EACH ROW EXECUTE FUNCTION privacy.fixed_fields('consumed', 'write_outcome');

CREATE TABLE privacy.deletion_confirmation (
  confirmation_hash text PRIMARY KEY CHECK (confirmation_hash ~ '^[0-9a-f]{64}$'),
  subject_key privacy.key NOT NULL,
  history_key privacy.key,
  scope text NOT NULL CHECK (scope IN ('one', 'all')),
  cutoff_at privacy.instant NOT NULL,
  cutoff_order bigint NOT NULL CHECK (cutoff_order > 0),
  issued_at privacy.instant NOT NULL,
  expires_at privacy.instant NOT NULL,
  confirmation_state text NOT NULL DEFAULT 'pending' CHECK (confirmation_state IN ('pending', 'cancelled', 'accepted', 'expired')),
  cleanup_key privacy.key,
  purge_at privacy.instant NOT NULL,
  CHECK ((scope = 'one') = (history_key IS NOT NULL)),
  CHECK ((confirmation_state = 'accepted') = (cleanup_key IS NOT NULL)),
  CHECK (expires_at = issued_at + interval '5 minutes'),
  CHECK (cutoff_at <= issued_at AND purge_at >= expires_at AND purge_at <= issued_at + interval '168 hours')
);
CREATE INDEX confirmation_purge ON privacy.deletion_confirmation (purge_at);
CREATE TRIGGER confirmation_fixed BEFORE UPDATE ON privacy.deletion_confirmation FOR EACH ROW EXECUTE FUNCTION privacy.fixed_fields('confirmation_state', 'cleanup_key');
CREATE FUNCTION privacy.control_transition() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF TG_TABLE_NAME = 'deletion_confirmation' THEN
    IF OLD.confirmation_state <> 'pending' AND NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'terminal_confirmation';
    END IF;
  ELSE
    IF OLD.consumed IS TRUE AND NEW.consumed IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'consumed_control';
    END IF;
    IF OLD.kind = 'permit' AND NEW.write_outcome <> OLD.write_outcome AND NOT (
      (OLD.write_outcome = 'not_attempted' AND NEW.write_outcome IN ('saved', 'not_saved', 'unknown')) OR
      (OLD.write_outcome = 'unknown' AND NEW.write_outcome IN ('saved', 'not_saved'))) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'terminal_write_outcome';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER confirmation_transition BEFORE UPDATE ON privacy.deletion_confirmation FOR EACH ROW EXECUTE FUNCTION privacy.control_transition();
CREATE TRIGGER control_transition BEFORE UPDATE ON privacy.write_control FOR EACH ROW EXECUTE FUNCTION privacy.control_transition();

CREATE TABLE privacy.cleanup_job (
  cleanup_key privacy.key PRIMARY KEY,
  subject_key privacy.key NOT NULL,
  scope text NOT NULL CHECK (scope IN ('one', 'all', 'expiry')),
  history_keys privacy.key[] NOT NULL CHECK (cardinality(history_keys) <= 100 AND array_position(history_keys, NULL) IS NULL),
  cutoff_at privacy.instant,
  cutoff_order bigint CHECK (cutoff_order > 0),
  created_at privacy.instant NOT NULL,
  effective_at privacy.instant NOT NULL,
  due_at privacy.instant NOT NULL,
  cleanup_state text NOT NULL DEFAULT 'pending' CHECK (cleanup_state IN ('pending', 'unknown', 'online_removed', 'failed', 'overdue')),
  failure_class text CHECK (failure_class IN ('storage_unavailable', 'timeout', 'outcome_unknown', 'overdue')),
  online_evidence text NOT NULL DEFAULT 'pending' CHECK (online_evidence IN ('pending', 'unknown', 'removed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at privacy.instant,
  purge_at privacy.instant NOT NULL,
  CHECK (due_at = effective_at + interval '24 hours'),
  CHECK (effective_at <= created_at AND purge_at > created_at AND purge_at <= created_at + interval '168 hours'),
  CHECK ((scope = 'all' AND num_nonnulls(cutoff_at, cutoff_order) = 2)
    OR (scope IN ('one', 'expiry') AND num_nonnulls(cutoff_at, cutoff_order) = 0 AND cardinality(history_keys) BETWEEN 1 AND 100)),
  CHECK (scope <> 'one' OR cardinality(history_keys) = 1),
  CHECK (cleanup_state <> 'online_removed' OR online_evidence = 'removed')
);
CREATE INDEX cleanup_due ON privacy.cleanup_job (due_at, cleanup_key);
CREATE INDEX cleanup_purge ON privacy.cleanup_job (purge_at);
CREATE INDEX cleanup_subject ON privacy.cleanup_job (subject_key);
CREATE TRIGGER cleanup_fixed BEFORE UPDATE ON privacy.cleanup_job FOR EACH ROW
EXECUTE FUNCTION privacy.fixed_fields('cleanup_state', 'failure_class', 'online_evidence', 'attempts', 'next_attempt_at');

CREATE TABLE privacy.storage_safety (
  singleton boolean PRIMARY KEY CHECK (singleton),
  state text NOT NULL CHECK (state IN ('blocked', 'synthetic_ready')),
  reason text NOT NULL CHECK (reason IN ('unverified', 'maintenance_required', 'synthetic_checks_passed')),
  checked_at privacy.instant NOT NULL
);
INSERT INTO privacy.storage_safety VALUES (true, 'blocked', 'unverified', clock_timestamp());

GRANT USAGE ON SCHEMA line_event TO line_event_app;
GRANT USAGE ON SCHEMA privacy TO privacy_app;
GRANT USAGE ON TYPE line_event.key, line_event.instant TO line_event_app;
GRANT USAGE ON TYPE privacy.key, privacy.instant TO privacy_app;
GRANT SELECT, INSERT, DELETE ON line_event.receipt TO line_event_app;
GRANT UPDATE (processing_state, reply_state) ON line_event.receipt TO line_event_app;
GRANT SELECT, INSERT, DELETE ON privacy.consent_state, privacy.query_history, privacy.write_control, privacy.deletion_confirmation, privacy.cleanup_job TO privacy_app;
GRANT SELECT ON privacy.storage_safety TO privacy_app;
GRANT UPDATE (saving_choice, notice_version, consent_version, boundary_order, changed_at) ON privacy.consent_state TO privacy_app;
GRANT UPDATE (consumed, write_outcome) ON privacy.write_control TO privacy_app;
GRANT UPDATE (confirmation_state, cleanup_key) ON privacy.deletion_confirmation TO privacy_app;
GRANT UPDATE (cleanup_state, failure_class, online_evidence, attempts, next_attempt_at) ON privacy.cleanup_job TO privacy_app;
GRANT USAGE, SELECT ON SEQUENCE privacy.authority_order TO privacy_app;
GRANT EXECUTE ON FUNCTION privacy.utc_year(timestamptz) TO privacy_app;
COMMIT;
