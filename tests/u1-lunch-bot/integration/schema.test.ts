import { beforeAll, describe, expect, it } from 'vitest';
import { sql } from '../../../scripts/u1-lunch-bot/database-runtime.ts';

beforeAll(() => {
  expect(process.env['U1_DATABASE_TEST']).toBe('owned-synthetic');
  expect(sql('privacy_app', 'SELECT 1')).toBe('1');
});

const historyInsert = `INSERT INTO privacy.query_history VALUES
  ('schema_history', 'schema_subject', '2024-02-29T23:15:00Z', 25, 121,
   '2025-02-28T23:15:00Z', 'found')`;

describe('U1-SCHEMA', () => {
  it('S01 七欄歷史、必要索引與 migration ownership', () => {
    expect(
      sql(
        'bootstrap',
        `SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
      FROM information_schema.columns WHERE table_schema='privacy' AND table_name='query_history'`,
      ),
    ).toBe('history_key,subject_key,query_at,latitude,longitude,expires_at,result_summary');
    expect(
      sql(
        'bootstrap',
        `SELECT count(*) FROM pg_indexes WHERE schemaname='privacy'
      AND indexname IN ('history_owner_page','history_expiry')`,
      ),
    ).toBe('2');
    expect(
      sql(
        'bootstrap',
        `SELECT count(*) FROM pg_tables WHERE schemaname IN ('privacy','line_event')
      AND tableowner <> 'u1_migration'`,
      ),
    ).toBe('0');
    expect(sql('bootstrap', `SELECT count(*) FROM pg_constraint WHERE contype='f'`)).toBe('0');
  });

  it('S02 合法合成歷史可寫讀刪、唯一鍵拒絕重複', () => {
    sql('privacy_app', historyInsert);
    expect(
      sql(
        'privacy_app',
        `SELECT count(*) FROM privacy.query_history WHERE history_key='schema_history'`,
      ),
    ).toBe('1');
    expect(() => sql('privacy_app', historyInsert)).toThrow('database_sqlstate_23505');
    sql('privacy_app', `DELETE FROM privacy.query_history WHERE history_key='schema_history'`);
  });

  it.each([
    ['S03', 'line_event_app', 'SELECT * FROM privacy.query_history'],
    ['S04', 'privacy_app', 'SELECT * FROM line_event.receipt'],
    ['S05', 'privacy_app', 'CREATE TABLE privacy.forbidden (value integer)'],
    ['S06', 'line_event_app', 'CREATE TABLE line_event.forbidden (value integer)'],
    ['S07', 'privacy_app', 'CREATE TEMP TABLE forbidden (value integer)'],
    ['S08', 'line_event_app', 'CREATE TEMP TABLE forbidden (value integer)'],
    ['S09', 'privacy_app', 'ALTER TABLE privacy.query_history SET TABLESPACE u1_temp'],
    ['S10', 'line_event_app', 'ALTER TABLE line_event.receipt SET TABLESPACE u1_temp'],
    ['S11', 'privacy_app', 'CREATE TABLE public.forbidden (value integer) TABLESPACE u1_temp'],
    ['S12', 'privacy_app', "UPDATE privacy.storage_safety SET state='synthetic_ready'"],
    ['S13', 'privacy_app', "SELECT setval('privacy.authority_order',1)"],
    ['S14', 'privacy_app', 'SET ROLE u1_migration'],
  ] as const)('%s 最小權限拒絕', (_caseId, role, statement) => {
    expect(() => sql(role, statement)).toThrow('database_sqlstate_42501');
  });

  it.each([
    ['S15', "'NaN'", '121'],
    ['S16', "'Infinity'", '121'],
    ['S17', '91', '121'],
    ['S18', '25', '-181'],
  ])('%s 非法座標拒絕', (_caseId, latitude, longitude) => {
    expect(() =>
      sql('privacy_app', historyInsert.replace('25, 121', `${latitude}, ${longitude}`)),
    ).toThrow('database_sqlstate_23514');
  });

  it('S19 未定義欄位、非法型別／結果／到期時間拒絕', () => {
    expect(() => sql('privacy_app', 'SELECT event_key FROM privacy.query_history')).toThrow(
      'database_sqlstate_42703',
    );
    expect(() => sql('privacy_app', historyInsert.replace('25, 121', "'not_number', 121"))).toThrow(
      'database_sqlstate_22P02',
    );
    expect(() => sql('privacy_app', historyInsert.replace("'found'", "'restaurants'"))).toThrow(
      'database_sqlstate_23514',
    );
    expect(() => sql('privacy_app', historyInsert.replace('2025-02-28', '2025-03-01'))).toThrow(
      'database_sqlstate_23514',
    );
    expect(() =>
      sql('privacy_app', historyInsert.replace('2025-02-28T23:15:00Z', 'infinity')),
    ).toThrow('database_sqlstate_23514');
  });

  it.each([
    ['S20', 'UTC', '2024-02-29T23:15:00Z', '2025-02-28T23:15:00Z'],
    ['S21', 'Asia/Taipei', '2023-12-31T16:30:00Z', '2024-12-31T16:30:00Z'],
    ['S22', 'America/New_York', '2023-03-12T06:59:59Z', '2024-03-12T06:59:59Z'],
  ])('%s UTC 曆年不受 session timezone 影響', (_caseId, timezone, before, after) => {
    expect(
      sql(
        'privacy_app',
        `SET timezone='${timezone}'; SELECT privacy.utc_year('${before}')='${after}'::timestamptz`,
      ),
    ).toBe('t');
  });

  it('S23 歷史不可更新，到期不滑動', () => {
    sql('privacy_app', historyInsert);
    expect(() =>
      sql('privacy_app', "UPDATE privacy.query_history SET query_at=query_at+interval '1 hour'"),
    ).toThrow('database_sqlstate_42501');
    expect(() =>
      sql(
        'bootstrap',
        "UPDATE privacy.query_history SET latitude=26 WHERE history_key='schema_history'",
      ),
    ).toThrow('database_sqlstate_23514');
    sql('privacy_app', "DELETE FROM privacy.query_history WHERE history_key='schema_history'");
  });

  it('S24 receipt 七天上限、原期限固定、reply 終態不可重送', () => {
    const insert = `INSERT INTO line_event.receipt (event_key,original_event_at,received_at,purge_at)
      VALUES ('schema_event','2026-01-01Z','2026-01-01Z','2026-01-08Z')`;
    expect(() => sql('line_event_app', insert.replace('2026-01-08Z', '2026-01-09Z'))).toThrow(
      'database_sqlstate_23514',
    );
    sql('line_event_app', insert);
    expect(() => sql('line_event_app', insert)).toThrow('database_sqlstate_23505');
    expect(() =>
      sql(
        'bootstrap',
        "UPDATE line_event.receipt SET purge_at=purge_at-interval '1 hour' WHERE event_key='schema_event'",
      ),
    ).toThrow('database_sqlstate_23514');
    sql(
      'line_event_app',
      "UPDATE line_event.receipt SET reply_state='sending' WHERE event_key='schema_event'",
    );
    sql(
      'line_event_app',
      "UPDATE line_event.receipt SET reply_state='unknown' WHERE event_key='schema_event'",
    );
    expect(() =>
      sql(
        'line_event_app',
        "UPDATE line_event.receipt SET reply_state='sending' WHERE event_key='schema_event'",
      ),
    ).toThrow('database_sqlstate_23514');
    sql('line_event_app', "DELETE FROM line_event.receipt WHERE event_key='schema_event'");
  });

  it('S25 admission 變體必要欄位、唯一鍵與 TTL', () => {
    const insert = `INSERT INTO privacy.write_control
      (control_key,kind,subject_key,event_key,original_event_at,accepted_order,deadline_at,created_at,purge_at)
      VALUES ('schema_admission','admission','schema_subject','schema_event','2026-01-01Z',1,
      '2026-01-01T00:00:10Z','2026-01-01Z','2026-01-08Z')`;
    sql('privacy_app', insert);
    expect(() =>
      sql('privacy_app', insert.replace('schema_admission', 'duplicate_admission')),
    ).toThrow('database_sqlstate_23505');
    expect(() =>
      sql(
        'privacy_app',
        insert.replace('schema_admission', 'bad_admission').replace('2026-01-08Z', '2026-01-09Z'),
      ),
    ).toThrow('database_sqlstate_23514');
    expect(() =>
      sql(
        'privacy_app',
        insert.replace('schema_admission', 'missing_admission').replace("'schema_event'", 'NULL'),
      ),
    ).toThrow('database_sqlstate_23514');
    expect(() =>
      sql(
        'privacy_app',
        "UPDATE privacy.write_control SET consumed=true WHERE control_key='schema_admission'",
      ),
    ).toThrow('database_sqlstate_23514');
    sql('privacy_app', "DELETE FROM privacy.write_control WHERE control_key='schema_admission'");
  });

  it('S26 ref 僅存 hash、十五分鐘固定期限與無額外欄位', () => {
    const insert = `INSERT INTO privacy.write_control
      (control_key,kind,subject_key,action,cursor_at,cursor_key,action_expires_at,created_at,purge_at)
      VALUES (repeat('a',64),'cursor','schema_subject','next','2026-01-01Z','anchor',
      '2026-01-01T00:15:00Z','2026-01-01Z','2026-01-08Z')`;
    sql('privacy_app', insert);
    expect(() => sql('privacy_app', insert.replace("repeat('a',64)", "'raw_ref'"))).toThrow(
      'database_sqlstate_23514',
    );
    expect(() =>
      sql(
        'privacy_app',
        insert.replace("repeat('a',64)", "repeat('b',64)").replace('00:15:00Z', '00:16:00Z'),
      ),
    ).toThrow('database_sqlstate_23514');
    expect(() =>
      sql(
        'bootstrap',
        "UPDATE privacy.write_control SET action_expires_at=action_expires_at-interval '1 minute' WHERE control_key=repeat('a',64)",
      ),
    ).toThrow('database_sqlstate_23514');
    sql('privacy_app', "DELETE FROM privacy.write_control WHERE control_key=repeat('a',64)");
  });

  it('S27 confirmation 五分鐘／固定 scope／cancel 終態', () => {
    const insert = `INSERT INTO privacy.deletion_confirmation
      (confirmation_hash,subject_key,scope,cutoff_at,cutoff_order,issued_at,expires_at,purge_at)
      VALUES (repeat('c',64),'schema_subject','all','2026-01-01Z',1,'2026-01-01Z',
      '2026-01-01T00:05:00Z','2026-01-08Z')`;
    expect(() => sql('privacy_app', insert.replace("'all'", "'one'"))).toThrow(
      'database_sqlstate_23514',
    );
    expect(() => sql('privacy_app', insert.replace('00:05:00Z', '00:06:00Z'))).toThrow(
      'database_sqlstate_23514',
    );
    sql('privacy_app', insert);
    sql(
      'privacy_app',
      "UPDATE privacy.deletion_confirmation SET confirmation_state='cancelled' WHERE confirmation_hash=repeat('c',64)",
    );
    expect(() =>
      sql(
        'privacy_app',
        "UPDATE privacy.deletion_confirmation SET confirmation_state='pending' WHERE confirmation_hash=repeat('c',64)",
      ),
    ).toThrow('database_sqlstate_23514');
    sql(
      'privacy_app',
      "DELETE FROM privacy.deletion_confirmation WHERE confirmation_hash=repeat('c',64)",
    );
  });

  it('S28 cleanup 原 24h due 與七天控制不重設、不假稱物理抹除', () => {
    const insert = `INSERT INTO privacy.cleanup_job
      (cleanup_key,subject_key,scope,history_keys,created_at,effective_at,due_at,purge_at)
      VALUES ('schema_cleanup','schema_subject','one',ARRAY['schema_history'],
      '2026-01-02Z','2026-01-01Z','2026-01-02Z','2026-01-09Z')`;
    expect(() =>
      sql(
        'privacy_app',
        insert.replace("'2026-01-02Z','2026-01-09Z'", "'2026-01-03Z','2026-01-09Z'"),
      ),
    ).toThrow('database_sqlstate_23514');
    sql('privacy_app', insert);
    expect(() =>
      sql(
        'bootstrap',
        "UPDATE privacy.cleanup_job SET created_at=created_at+interval '1 hour' WHERE cleanup_key='schema_cleanup'",
      ),
    ).toThrow('database_sqlstate_23514');
    expect(() =>
      sql(
        'privacy_app',
        "UPDATE privacy.cleanup_job SET cleanup_state='complete' WHERE cleanup_key='schema_cleanup'",
      ),
    ).toThrow('database_sqlstate_23514');
    expect(() =>
      sql(
        'privacy_app',
        "UPDATE privacy.cleanup_job SET cleanup_state='online_removed' WHERE cleanup_key='schema_cleanup'",
      ),
    ).toThrow('database_sqlstate_23514');
    sql(
      'privacy_app',
      "UPDATE privacy.cleanup_job SET attempts=49, cleanup_state='overdue' WHERE cleanup_key='schema_cleanup'",
    );
    expect(
      sql(
        'privacy_app',
        "SELECT attempts FROM privacy.cleanup_job WHERE cleanup_key='schema_cleanup'",
      ),
    ).toBe('49');
    sql('privacy_app', "DELETE FROM privacy.cleanup_job WHERE cleanup_key='schema_cleanup'");
  });

  it('S29 permit 消費不可反向、unknown 可核對、saved／not_saved 終態不反轉', () => {
    sql(
      'privacy_app',
      `INSERT INTO privacy.write_control
      (control_key,kind,subject_key,event_key,history_key,original_event_at,accepted_order,consent_version,
      notice_version,deadline_at,consumed,write_outcome,created_at,purge_at)
      VALUES ('schema_permit','permit','schema_subject','permit_event','permit_history','2026-01-01T00:00:00Z',1,
      'version','notice','2026-01-01T00:00:10Z',false,'not_attempted','2026-01-01T00:00:00Z','2026-01-08T00:00:00Z')`,
    );
    sql(
      'privacy_app',
      "UPDATE privacy.write_control SET consumed=true,write_outcome='unknown' WHERE control_key='schema_permit'",
    );
    expect(() =>
      sql(
        'privacy_app',
        "UPDATE privacy.write_control SET consumed=false,write_outcome='not_attempted' WHERE control_key='schema_permit'",
      ),
    ).toThrow('database_sqlstate_23514');
    sql(
      'privacy_app',
      "UPDATE privacy.write_control SET write_outcome='saved' WHERE control_key='schema_permit'",
    );
    for (const outcome of ['unknown', 'not_saved']) {
      expect(() =>
        sql(
          'privacy_app',
          `UPDATE privacy.write_control SET write_outcome='${outcome}' WHERE control_key='schema_permit'`,
        ),
      ).toThrow('database_sqlstate_23514');
    }
    sql('privacy_app', "DELETE FROM privacy.write_control WHERE control_key='schema_permit'");
  });

  it.each(['accepted', 'expired'] as const)('S30 confirmation %s 終態不復活', (state) => {
    sql(
      'privacy_app',
      `INSERT INTO privacy.deletion_confirmation
      (confirmation_hash,subject_key,scope,cutoff_at,cutoff_order,issued_at,expires_at,purge_at)
      VALUES (repeat('d',64),'schema_subject','all','2026-01-01T00:00:00Z',1,'2026-01-01T00:00:00Z',
      '2026-01-01T00:05:00Z','2026-01-08T00:00:00Z')`,
    );
    sql(
      'privacy_app',
      `UPDATE privacy.deletion_confirmation SET confirmation_state='${state}',
      cleanup_key=${state === 'accepted' ? "'accepted_job'" : 'NULL'} WHERE confirmation_hash=repeat('d',64)`,
    );
    expect(() =>
      sql(
        'privacy_app',
        "UPDATE privacy.deletion_confirmation SET confirmation_state='pending',cleanup_key=NULL WHERE confirmation_hash=repeat('d',64)",
      ),
    ).toThrow('database_sqlstate_23514');
    sql(
      'privacy_app',
      "DELETE FROM privacy.deletion_confirmation WHERE confirmation_hash=repeat('d',64)",
    );
  });

  it('S31 receipt 時效依首次接收，24h／5min 含邊界，外側拒絕', () => {
    for (const original of ['2026-01-01T00:00:00Z', '2026-01-02T00:05:00Z']) {
      sql(
        'line_event_app',
        `INSERT INTO line_event.receipt(event_key,original_event_at,received_at,purge_at)
        VALUES ('boundary','${original}','2026-01-02T00:00:00Z','2026-01-09T00:00:00Z')`,
      );
      sql('line_event_app', "DELETE FROM line_event.receipt WHERE event_key='boundary'");
    }
    for (const original of ['2025-12-31T23:59:59.999Z', '2026-01-02T00:05:00.001Z']) {
      expect(() =>
        sql(
          'line_event_app',
          `INSERT INTO line_event.receipt(event_key,original_event_at,received_at,purge_at)
        VALUES ('boundary','${original}','2026-01-02T00:00:00Z','2026-01-09T00:00:00Z')`,
        ),
      ).toThrow('database_sqlstate_23514');
    }
  });
});
