import { describe, expect, it, vi } from 'vitest';
import {
  validateResumeMetadata,
  type ResumeMetadata,
} from '../../../scripts/u1-lunch-bot/database-resume-policy.ts';
import {
  checkpointRunner,
  expectSqlState,
  failureCategory,
  safeCheckpoint,
  sqlStateFromDiagnostic,
  type Checkpoint,
} from '../fixtures/database-checkpoints.ts';
import {
  completeRestartFixtures,
  inspectRestartFixtures,
  validateFixturePrefix,
} from '../fixtures/restart-fixtures.ts';

const modelHash = 'a'.repeat(64);
const roleHash = 'b'.repeat(64);
function metadata(): ResumeMetadata {
  return {
    major: '17\n',
    allowlist: `17 202406281 16384 /u1-temp/tablespace ${modelHash} ${roleHash}\n`,
    modelHash,
    roleHash,
    tablespaceEntries: ['16384'],
    tablespaceTarget: '/u1-temp/tablespace',
    bootstrapStatus: 'tcp_start passed runtime_check none\n',
  };
}

describe('U1-DB-RESUME', () => {
  it('P01 已知初始化／hash／唯一 symlink 可續跑', () => {
    expect(() => {
      validateResumeMetadata(metadata());
    }).not.toThrow();
  });
  it.each([
    'evidence_channel pending runtime_check none\n',
    'evidence_channel started runtime_check none\n',
    'disk_temp_guard failed disk_temp_rejected none\n',
    'disk_temp_guard failed disk_temp_rejected none prepare U1_DISK_TEMP_GUARD temp_writable temp yes expected 0555 yes\n',
    'disk_temp_guard failed disk_temp_rejected none check U1_DISK_TEMP_GUARD temp_missing temp no unknown unknown unknown\n',
  ])('P12 精確 guard bootstrap 失敗可重驗，不當成功／不略過初始化檢查', (bootstrapStatus) => {
    const value = { ...metadata(), bootstrapStatus };
    const before = structuredClone(value);
    expect(() => {
      validateResumeMetadata(value);
    }).not.toThrow();
    for (const changes of [
      { major: '16' },
      { roleHash: 'c'.repeat(64) },
      { modelHash: 'c'.repeat(64) },
      { tablespaceEntries: [] },
      { tablespaceTarget: '/tmp' },
    ]) {
      expect(() => {
        validateResumeMetadata({ ...value, ...changes });
      }).toThrow(/^database_resume_/);
    }
    expect(value).toEqual(before);
  });
  it.each([
    'disk_temp_guard started disk_temp_rejected none\n',
    'disk_temp_guard passed disk_temp_rejected none\n',
    'disk_temp_guard failed runtime_check none\n',
    'disk_temp_guard failed disk_temp_rejected 42501\n',
    'evidence_channel started runtime_check 42501\n',
    'evidence_channel started identity_mismatch none\n',
    'identity started runtime_check none\n',
    'identity started identity_mismatch none\n',
    'evidence_channel  started runtime_check none\n',
    'evidence_channel started runtime_check none\n\n',
    'evidence_channel failed runtime_check none\n',
    'evidence_channel pending runtime_check 42501\n',
    'evidence_channel pending identity_mismatch none\n',
    'initialize pending runtime_check none\n',
    'evidence_channel  pending runtime_check none\n',
    'disk_temp_guard failed disk_temp_rejected none check U1_DISK_TEMP_GUARD checked temp yes expected 0555 no\n',
    'disk_temp_guard failed disk_temp_rejected none private_payload\n',
  ])('P13 其他 incomplete／failed／矛盾證據不可擴大續跑', (bootstrapStatus) => {
    expect(() => {
      validateResumeMetadata({ ...metadata(), bootstrapStatus });
    }).toThrow(/^database_(evidence|resume)_/);
  });
  it.each([
    { major: '16' },
    { modelHash: 'c'.repeat(64) },
    { roleHash: 'c'.repeat(64) },
    { tablespaceEntries: [] },
    { tablespaceEntries: ['16384', '16385'] },
    { tablespaceEntries: ['16385'] },
    { tablespaceTarget: '/tmp' },
    { bootstrapStatus: 'model_migration failed sql_failed 42501\n' },
    { bootstrapStatus: 'tcp_start started postgres_start_failed none\n' },
    { allowlist: `17 202406281 16384 /u1-temp/tablespace ${modelHash} ${roleHash} extra` },
  ])('P02 不符 metadata 拒絕，不改寫', (changes) => {
    const value = { ...metadata(), ...changes };
    const before = structuredClone(value);
    expect(() => {
      validateResumeMetadata(value);
    }).toThrow(/^database_resume_/);
    expect(value).toEqual(before);
  });
  it.each([0, 1, 2, 3, 4])('P03 合成 fixture 有序 prefix %s 可保留', (count) => {
    expect(
      validateFixturePrefix(
        Array.from({ length: 4 }, (_, index) => (index < count ? 'valid' : 'missing')),
      ),
    ).toBe(count);
  });
  it.each([
    ['valid', 'missing', 'valid', 'missing'],
    ['valid', 'invalid', 'missing', 'missing'],
    ['valid', 'valid', 'valid'],
    ['missing', 'missing', 'missing', 'private_payload'],
  ])('P04 不合法／缺口／未知資料拒絕', (...states) => {
    expect(() => validateFixturePrefix(states)).toThrow(/^database_resume_/);
  });
  it('P05 全部先驗證，非法現有 row 不 INSERT／UPDATE／DELETE', () => {
    const query = vi.fn((statement: string) =>
      statement.includes('deletion_confirmation') ? '0' : 'invalid',
    );
    expect(() => inspectRestartFixtures(query)).toThrow('database_resume_fixture_invalid');
    expect(query.mock.calls.every(([statement]) => statement.startsWith('SELECT'))).toBe(true);
  });
  it('P06 已完成 fixture 僅重驗，不重種／改 due／reset sequence', () => {
    const query = vi.fn((statement: string) => {
      if (statement.includes('SELECT md5')) return 'a'.repeat(32);
      if (statement.includes('deletion_confirmation')) return '0';
      return 'valid';
    });
    completeRestartFixtures(query, 4);
    expect(query.mock.calls.every(([statement]) => statement.startsWith('SELECT'))).toBe(true);
  });
  it('P07 部分 fixture 只 INSERT 缺少尾端，不用 conflict 掩蓋', () => {
    const query = vi.fn((statement: string) => {
      if (statement.includes('SELECT md5')) return 'a'.repeat(32);
      if (statement.startsWith('INSERT')) return '';
      if (statement.includes('deletion_confirmation')) return '0';
      return 'valid';
    });
    completeRestartFixtures(query, 2);
    const inserts = query.mock.calls
      .map(([statement]) => statement)
      .filter((statement) => statement.startsWith('INSERT'));
    expect(inserts).toHaveLength(2);
    expect(inserts.every((statement) => !/ON CONFLICT|UPDATE|DELETE|setval/i.test(statement))).toBe(
      true,
    );
    expect(
      inserts.some((statement) => statement.includes('INSERT INTO privacy.query_history')),
    ).toBe(false);
  });
  it('P08 checkpoint 成功及 SQLSTATE 失敗，不含原文', async () => {
    const trace: Checkpoint[] = [];
    const check = checkpointRunner(trace, 'before', 'privacy_app');
    await check('R05_SPILL_OPEN', () => 1);
    await expect(
      check('R05_FILE_LIMIT', () => {
        throw new Error('database_sqlstate_57014');
      }),
    ).rejects.toThrow();
    expect(trace.map(({ status, sqlstate }) => ({ status, sqlstate }))).toEqual([
      { status: 'pass', sqlstate: 'none' },
      { status: 'fail', sqlstate: '57014' },
    ]);
    expect(failureCategory(new Error('private_payload'))).toEqual({
      category: 'unknown',
      sqlstate: 'none',
    });
  });
  it('P09 非預期 SQLSTATE 保留實際分類，沒有錯誤不能過', () => {
    expect(() => {
      expectSqlState(() => {
        throw new Error('database_sqlstate_57014');
      }, '53400');
    }).toThrow('database_sqlstate_57014');
    expect(() => {
      expectSqlState(() => undefined, '53400');
    }).toThrow('database_expected_sql_failure_missing');
    expect(() => {
      expectSqlState(() => {
        throw new Error('database_sqlstate_53400');
      }, '53400');
    }).not.toThrow();
  });
  it('P10 白名單雙重投影不回傳多餘欄位', () => {
    const value = {
      id: 'R05_SPILL_OPEN',
      role: 'line_event_app',
      cycle: 'before',
      status: 'fail',
      category: 'sql',
      sqlstate: '53400',
      raw: 'private_payload',
    };
    expect(JSON.stringify(safeCheckpoint(value))).not.toContain('private_payload');
    expect(safeCheckpoint({ ...value, id: 'private_payload' })).toBeUndefined();
    expect(safeCheckpoint({ ...value, sqlstate: 'private_payload' })).toBeUndefined();
  });
  it.each(['ERROR:  53400\n', 'FATAL:  25P04\n'])('P11 只取 ERROR／FATAL 五碼', (diagnostic) => {
    expect(sqlStateFromDiagnostic(diagnostic)).toMatch(/^[0-9A-Z]{5}$/);
    expect(sqlStateFromDiagnostic('private_payload')).toBeUndefined();
  });
});
