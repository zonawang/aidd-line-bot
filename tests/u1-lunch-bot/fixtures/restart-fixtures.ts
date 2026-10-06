import { requireCondition } from '../../../scripts/u1-lunch-bot/storage-policy.ts';

const fixtures = [
  {
    table: 'consent_state',
    valid: `subject_key='restart_subject' AND saving_choice='save' AND notice_version='notice'
      AND consent_version='restart_version' AND boundary_order>0 AND isfinite(changed_at)`,
    insert: `INSERT INTO privacy.consent_state VALUES ('restart_subject','save','notice','restart_version',nextval('privacy.authority_order'),clock_timestamp())`,
  },
  {
    table: 'query_history',
    valid: `history_key='restart_history' AND subject_key='restart_subject' AND latitude=25 AND longitude=121
      AND result_summary='found' AND expires_at=privacy.utc_year(query_at)
      AND query_at >= (SELECT changed_at FROM privacy.consent_state WHERE subject_key='restart_subject')`,
    insert: `INSERT INTO privacy.query_history VALUES ('restart_history','restart_subject',statement_timestamp(),25,121,privacy.utc_year(statement_timestamp()),'found')`,
  },
  {
    table: 'write_control',
    valid: `control_key='restart_barrier' AND subject_key='restart_subject' AND kind='deletion_barrier'
      AND cutoff_at=created_at AND purge_at=created_at+interval '168 hours'
      AND cutoff_order>(SELECT boundary_order FROM privacy.consent_state WHERE subject_key='restart_subject')
      AND created_at >= (SELECT query_at FROM privacy.query_history WHERE history_key='restart_history')
      AND num_nonnulls(event_key,history_key,original_event_at,accepted_order,consent_version,write_outcome,notice_version,deadline_at,consumed,action,cursor_at,cursor_key,action_expires_at)=0`,
    insert: `INSERT INTO privacy.write_control(control_key,kind,subject_key,cutoff_at,cutoff_order,created_at,purge_at)
      VALUES ('restart_barrier','deletion_barrier','restart_subject',statement_timestamp(),nextval('privacy.authority_order'),statement_timestamp(),statement_timestamp()+interval '168 hours')`,
  },
  {
    table: 'cleanup_job',
    valid: `cleanup_key='restart_cleanup' AND subject_key='restart_subject' AND scope='all'
      AND cardinality(history_keys)=0 AND cutoff_at=created_at AND effective_at=created_at
      AND due_at=effective_at+interval '24 hours' AND purge_at=created_at+interval '168 hours'
      AND cleanup_state='pending' AND online_evidence='pending' AND attempts=0
      AND failure_class IS NULL AND next_attempt_at IS NULL
      AND cutoff_order>(SELECT cutoff_order FROM privacy.write_control WHERE control_key='restart_barrier')
      AND created_at >= (SELECT created_at FROM privacy.write_control WHERE control_key='restart_barrier')`,
    insert: `INSERT INTO privacy.cleanup_job(cleanup_key,subject_key,scope,history_keys,cutoff_at,cutoff_order,created_at,effective_at,due_at,purge_at)
      VALUES ('restart_cleanup','restart_subject','all',ARRAY[]::privacy.key[],statement_timestamp(),nextval('privacy.authority_order'),statement_timestamp(),statement_timestamp(),statement_timestamp()+interval '24 hours',statement_timestamp()+interval '168 hours')`,
  },
] as const;
export type FixtureQuery = (statement: string) => string;

export function validateFixturePrefix(states: readonly string[]): number {
  requireCondition(
    states.length === 4 && states.every((state) => state === 'missing' || state === 'valid'),
    'database_resume_fixture_invalid',
  );
  const firstMissing = states.indexOf('missing');
  requireCondition(
    firstMissing === -1 || states.slice(firstMissing).every((state) => state === 'missing'),
    'database_resume_fixture_gap',
  );
  return firstMissing === -1 ? 4 : firstMissing;
}

export function inspectRestartFixtures(query: FixtureQuery): number {
  const states = fixtures.map((fixture) =>
    query(`SELECT CASE WHEN count(*)=0 THEN 'missing'
    WHEN count(*)=1 AND bool_and((${fixture.valid}) IS TRUE) THEN 'valid' ELSE 'invalid' END FROM privacy.${fixture.table}`),
  );
  requireCondition(
    query('SELECT count(*) FROM privacy.deletion_confirmation') === '0',
    'database_resume_unexpected_confirmation',
  );
  return validateFixturePrefix(states);
}

export function fixtureFingerprint(query: FixtureQuery, count: number): string {
  requireCondition(
    Number.isInteger(count) && count >= 0 && count <= 4,
    'database_resume_fixture_count',
  );
  return fixtures
    .slice(0, count)
    .map((fixture) => {
      const digest = query(
        `SELECT md5(row_to_json(fixture)::text) FROM privacy.${fixture.table} AS fixture`,
      );
      requireCondition(/^[a-f0-9]{32}$/.test(digest), 'database_resume_fingerprint_invalid');
      return digest;
    })
    .join(':');
}

export function completeRestartFixtures(query: FixtureQuery, existing: number): void {
  const original = fixtureFingerprint(query, existing);
  for (const fixture of fixtures.slice(existing)) query(fixture.insert);
  requireCondition(
    inspectRestartFixtures(query) === 4 && fixtureFingerprint(query, existing) === original,
    'database_resume_existing_fixture_changed',
  );
}
