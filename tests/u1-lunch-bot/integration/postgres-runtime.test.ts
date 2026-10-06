import { beforeAll, describe, expect, it } from 'vitest';
import {
  databaseName,
  docker,
  rejectedBootstrap,
  restartDatabase,
  sql,
  verifyDatabaseContainer,
} from '../../../scripts/u1-lunch-bot/database-runtime.ts';
import {
  holdSpill,
  ordinarySpill,
  probeDiskTempGuard,
  spillQuery,
} from '../fixtures/postgres-spill.ts';
import { type SpillObservation } from '../fixtures/spill-observations.ts';
import {
  checkpointRunner,
  expectSqlState,
  type Checkpoint,
} from '../fixtures/database-checkpoints.ts';
import {
  completeRestartFixtures,
  fixtureFingerprint,
  inspectRestartFixtures,
} from '../fixtures/restart-fixtures.ts';

beforeAll(() => {
  expect(process.env['U1_DATABASE_TEST']).toBe('owned-synthetic');
  expect(sql('privacy_app', 'SELECT 1')).toBe('1');
});

function noDiskFallback(): void {
  expect(sql('bootstrap', 'SELECT count(*) FROM pg_ls_tmpdir()')).toBe('0');
  expect(
    sql(
      'bootstrap',
      `SELECT count(*) FROM pg_class WHERE reltablespace=(SELECT oid FROM pg_tablespace WHERE spcname='u1_temp')`,
    ),
  ).toBe('0');
}

async function verifySpills(
  trace: Checkpoint[],
  observations: SpillObservation[],
  cycle: 'before' | 'after',
): Promise<void> {
  for (const role of ['line_event_app', 'privacy_app'] as const) {
    const check = checkpointRunner(trace, cycle, role);
    await check('R05_DISK_GUARD', () => {
      const result = probeDiskTempGuard();
      const entry = trace.at(-1);
      if (entry?.id !== 'R05_DISK_GUARD') throw new Error('database_checkpoint_invalid');
      entry.guard = result.guard;
      expect(result.passed).toBe(true);
    });
    await check('R05_HOLD_REFUSED', async () => {
      try {
        const release = await holdSpill(role, cycle, observations);
        await release();
      } catch (error) {
        if (error instanceof Error && error.message === 'database_sqlstate_XX000') return;
        throw error;
      }
      throw new Error('database_expected_sql_failure_missing');
    });
    await check('R05_DISK_CHECK', noDiskFallback);
    const entries = await check('R05_ORDINARY_SORT', () =>
      ordinarySpill(role, cycle, observations),
    );
    await check('R05_SPILL_OBSERVE', () => {
      const session = entries[0];
      expect(session).toMatchObject({
        id: 'R05_SPILL_SESSION',
        role,
        cycle,
        phase: 'local',
        currentRole: role,
        workMem: '64kB',
        tempTablespaces: 'u1_temp',
        createPrivilege: true,
        statementTimeout: '400ms',
        transactionTimeout: '400ms',
        idleTimeout: '400ms',
        lockTimeout: '100ms',
        tempFileLimit: '16MB',
      });
      const files = entries.slice(1);
      expect(files.map((entry) => entry.id === 'R05_SPILL_FILES' && entry.scope)).toEqual([
        'default',
        'target',
      ]);
      for (const entry of files) {
        if (entry.id !== 'R05_SPILL_FILES') throw new Error('spill_observation_invalid');
        expect(entry.treeComplete).toBe(true);
        expect(entry.rootPresent).toBe(true);
        if (entry.scope === 'default') {
          expect(entry.directFiles).toBe(0);
          expect(entry.treeFiles).toBe(0);
          expect(entry.treeDirectories).toBe(0);
          expect(entry.treeBytes).toBe(0);
        } else {
          expect(entry.directPositive).toBeGreaterThan(0);
          expect(entry.treePositive).toBeGreaterThan(0);
          expect(entry.treeBytes).toBeGreaterThan(0);
        }
      }
    });
    await check('R05_DISK_CHECK', noDiskFallback);
    await check('R05_FILE_LIMIT', () => {
      expectSqlState(
        () =>
          sql(
            role,
            `SET work_mem='64kB'; SELECT count(*) FROM
      (SELECT repeat(md5(series.value::text),256) AS body FROM generate_series(1,15000) AS series(value) ORDER BY body) AS sorted`,
          ),
        '53400',
      );
    });
    await check('R05_TMPFS_FILL', () => {
      verifyDatabaseContainer();
      expect(
        docker([
          'exec',
          databaseName,
          '/bin/bash',
          '/opt/u1/infra/postgres/temp-pressure.sh',
          'fill',
        ]).trim(),
      ).toBe('U1_TEMP_PRESSURE=ready');
    });
    try {
      await check('R05_TMPFS_EXHAUST', () => {
        expectSqlState(
          () => sql(role, `SET work_mem='64kB'; SELECT count(*) FROM (${spillQuery}) AS sorted`),
          '53100',
        );
      });
      await check('R05_DISK_CHECK', noDiskFallback);
    } finally {
      await check('R05_TMPFS_RELEASE', () => {
        expect(
          docker([
            'exec',
            databaseName,
            '/bin/bash',
            '/opt/u1/infra/postgres/temp-pressure.sh',
            'release',
          ]).trim(),
        ).toBe('U1_TEMP_PRESSURE=released');
      });
    }
    await check('R05_ROLE_HEALTH', () => {
      expect(sql(role, 'SELECT 1')).toBe('1');
    });
  }
}

describe('U1-PG-RUNTIME', () => {
  it('R01 私有網路／nonroot／硬上限／無 host port／不落普通 logs', () => {
    expect(() => verifyDatabaseContainer()).not.toThrow();
    expect(
      sql(
        'bootstrap',
        `SELECT current_setting('server_version_num')='170011'
      AND current_setting('max_connections')='20'
      AND current_setting('max_prepared_transactions')='0'
      AND current_setting('archive_mode')='off'
      AND current_setting('max_wal_senders')='0'
      AND current_setting('log_min_error_statement')='panic'
      AND current_setting('log_parameter_max_length_on_error')='0'
      AND current_setting('logging_collector')='off'
      AND current_setting('fsync')='on'
      AND current_setting('full_page_writes')='on'
      AND current_setting('synchronous_commit')='on'
      AND current_setting('data_checksums')='on'`,
      ),
    ).toBe('t');
  });

  it.each(['line_event_app', 'privacy_app'] as const)(
    'R02 %s 真實角色 timeout／16MiB／TLS',
    (role) => {
      expect(
        sql(
          role,
          `SELECT current_user='${role}'
      AND current_setting('statement_timeout')='400ms'
      AND current_setting('transaction_timeout')='400ms'
      AND current_setting('idle_in_transaction_session_timeout')='400ms'
      AND current_setting('lock_timeout')='100ms'
      AND current_setting('temp_file_limit')='16MB'
      AND current_setting('temp_tablespaces')='u1_temp'
      AND current_setting('default_transaction_isolation')='read committed'
      AND (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid())`,
        ),
      ).toBe('t');
      expect(
        sql(
          'bootstrap',
          `SELECT NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolbypassrls AND NOT rolreplication AND rolconnlimit=${role === 'line_event_app' ? '4' : '7'}
      FROM pg_roles WHERE rolname='${role}'`,
        ),
      ).toBe('t');
    },
  );

  it.each(['wrong_ca', 'wrong_name', 'plaintext'] as const)('R03 TLS %s 拒絕', (mode) => {
    expect(() => sql('privacy_app', 'SELECT 1', mode)).toThrow('database_connection_rejected');
  });

  it('R04 安全狀態預設 blocked，缺失也不授權', () => {
    expect(sql('privacy_app', 'SELECT state FROM privacy.storage_safety WHERE singleton')).toBe(
      'blocked',
    );
    expect(
      sql(
        'bootstrap',
        "BEGIN; DELETE FROM privacy.storage_safety; SELECT COALESCE((SELECT state='synthetic_ready' FROM privacy.storage_safety WHERE singleton),false); ROLLBACK",
      ),
    ).toBe('f');
  });

  it('R05 同 PGDATA 保留 history／屏障／原 due／sequence，清空 tmpfs 後兩角色 spill／滿額仍安全', async (context) => {
    const trace: Checkpoint[] = [];
    const observations: SpillObservation[] = [];
    Object.assign(context.task.meta, {
      databaseCheckpoints: trace,
      spillObservations: observations,
    });
    const check = checkpointRunner(trace);
    const query = (statement: string) => sql('privacy_app', statement);
    const systemId = await check('R05_IDENTITY', () => {
      const value = sql('bootstrap', 'SELECT system_identifier FROM pg_control_system()');
      if (process.env['U1_DATABASE_MODE'] === 'resume-r05')
        expect(value).toBe(process.env['U1_EXPECTED_SYSTEM_ID']);
      return value;
    });
    const existing = await check('R05_FIXTURES_VALIDATE', () => {
      expect(sql('bootstrap', 'SELECT count(*) FROM line_event.receipt')).toBe('0');
      const count = inspectRestartFixtures(query);
      if (process.env['U1_DATABASE_MODE'] !== 'resume-r05') expect(count).toBe(0);
      return count;
    });
    await check('R05_FIXTURES_COMPLETE', () => {
      completeRestartFixtures(query, existing);
    });
    const { fingerprint, sequence } = await check('R05_BASELINE', () => ({
      fingerprint: fixtureFingerprint(query, 4),
      sequence: BigInt(query("SELECT nextval('privacy.authority_order')")),
    }));
    await verifySpills(trace, observations, 'before');
    await check('R05_MARKER_WRITE', () => {
      verifyDatabaseContainer();
      docker([
        'exec',
        databaseName,
        '/bin/bash',
        '-c',
        'umask 077; printf marker > /u1-temp/.restart-marker',
      ]);
    });
    await check('R05_RESTART', restartDatabase);
    await check('R05_MARKER_ABSENT', () => {
      expect(
        docker([
          'exec',
          databaseName,
          '/bin/bash',
          '-c',
          'test ! -e /u1-temp/.restart-marker && printf absent',
        ]).trim(),
      ).toBe('absent');
    });
    await check('R05_PRESERVED', () => {
      expect(sql('bootstrap', 'SELECT system_identifier FROM pg_control_system()')).toBe(systemId);
      expect(fixtureFingerprint(query, 4)).toBe(fingerprint);
      expect(
        BigInt(sql('privacy_app', "SELECT nextval('privacy.authority_order')")),
      ).toBeGreaterThan(sequence);
    });
    await verifySpills(trace, observations, 'after');
    const negativeIds = {
      uid: 'R05_NEGATIVE_UID',
      major: 'R05_NEGATIVE_MAJOR',
      catalog: 'R05_NEGATIVE_CATALOG',
      symlink: 'R05_NEGATIVE_SYMLINK',
    } as const;
    for (const fault of ['uid', 'major', 'catalog', 'symlink'] as const) {
      await check(negativeIds[fault], () => rejectedBootstrap(fault));
      await check('R05_PRESERVED', () => {
        expect(fixtureFingerprint(query, 4)).toBe(fingerprint);
        expect(sql('bootstrap', 'SELECT system_identifier FROM pg_control_system()')).toBe(
          systemId,
        );
      });
    }
  }, 180_000);
});
