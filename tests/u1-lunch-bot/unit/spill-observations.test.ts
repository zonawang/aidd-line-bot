import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { spawn, spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import type { TestCase } from 'vitest/node';
import DatabaseReporter from '../fixtures/database-reporter.ts';
import {
  holdSpill,
  ordinarySpill,
  probeDiskTempGuard,
  spillQuery,
} from '../fixtures/postgres-spill.ts';
import {
  parseGuardEvidence,
  safeCheckpoint,
  safeGuardEvidence,
} from '../fixtures/database-checkpoints.ts';
import {
  parseSpillObservation,
  safeSpillObservation,
  spillFilesQuery,
  spillSessionQuery,
  type SpillObservation,
} from '../fixtures/spill-observations.ts';

vi.mock('node:child_process', () => ({ spawn: vi.fn(), spawnSync: vi.fn() }));
vi.mock('../../../scripts/u1-lunch-bot/database-runtime.ts', () => ({
  databaseName: 'synthetic-container',
  verifyDatabaseContainer: vi.fn(),
}));
vi.mock('../../../scripts/u1-lunch-bot/storage-host.ts', () => ({
  dockerInvocationEnvironment: () => ({}),
}));

const context = { role: 'line_event_app', cycle: 'before' } as const;
const session: SpillObservation = {
  ...context,
  id: 'R05_SPILL_SESSION',
  phase: 'local',
  currentRole: 'line_event_app',
  workMem: '64kB',
  tempTablespaces: 'u1_temp',
  createPrivilege: true,
  statementTimeout: '400ms',
  transactionTimeout: '400ms',
  idleTimeout: '400ms',
  lockTimeout: '100ms',
  tempFileLimit: '16MB',
};
const files: SpillObservation = {
  ...context,
  id: 'R05_SPILL_FILES',
  scope: 'target',
  rootPresent: true,
  treeComplete: true,
  directFiles: 1,
  directPositive: 1,
  treeFiles: 2,
  treePositive: 2,
  treeDirectories: 1,
  treeBytes: 4096,
};

describe('U1-SPILL-OBSERVATIONS', () => {
  it.each(['root_pair', 'mixed_pair', 'other', 'unknown'])(
    'O19 owner %s 可安全傳遞但絕不能證明 guard 成功',
    (owner) => {
      const stdout = `U1_DISK_TEMP_GUARD data_identity data yes ${owner} 0700 yes unknown unknown unknown\n`;
      vi.mocked(spawnSync).mockReturnValue({
        status: 40,
        stdout,
        stderr: 'private_payload',
      } as ReturnType<typeof spawnSync>);
      const result = probeDiskTempGuard();
      expect(result.passed).toBe(false);
      expect(result.guard.owner).toBe(owner);
      const checkpoint = {
        id: 'R05_DISK_GUARD',
        ...context,
        status: 'fail',
        category: 'assertion',
        sqlstate: 'none',
        guard: { ...result.guard, uid: '12345', gid: 'private_payload' },
      };
      const safe = safeCheckpoint(safeCheckpoint(checkpoint));
      expect(safe?.guard).toEqual(result.guard);
      expect(safe?.status).toBe('fail');
      expect(JSON.stringify(safe)).not.toMatch(/12345|private_payload/);
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: `U1_DISK_TEMP_GUARD checked temp yes ${owner} 0555 yes denied EACCES not_created\n`,
        stderr: '',
      } as ReturnType<typeof spawnSync>);
      expect(probeDiskTempGuard().passed).toBe(false);
    },
  );
  it('O15 失敗 guard stdout 仍保留固定原因與摘要，stderr 不外洩', () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 40,
      stdout: 'U1_DISK_TEMP_GUARD temp_missing temp no unknown unknown unknown\n',
      stderr: 'private_payload',
    } as ReturnType<typeof spawnSync>);
    const result = probeDiskTempGuard();
    expect(result.passed).toBe(false);
    expect(result.guard.reason).toBe('temp_missing');
    const checkpoint = {
      id: 'R05_DISK_GUARD',
      role: 'line_event_app',
      cycle: 'before',
      status: 'fail',
      category: 'assertion',
      sqlstate: 'none',
      guard: { ...result.guard, raw: 'private_payload' },
    };
    expect(safeCheckpoint(safeCheckpoint(checkpoint))?.guard).toEqual(result.guard);
    expect(JSON.stringify(safeCheckpoint(checkpoint))).not.toContain('private_payload');
  });
  it.each(['EACCES', 'EROFS'])('O16 只有完整建立拒絕 %s 證據可通過，不要求 access=no', (errno) => {
    const stdout = `U1_DISK_TEMP_GUARD checked temp yes expected 0555 no denied ${errno} not_created\n`;
    vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout, stderr: '' } as ReturnType<
      typeof spawnSync
    >);
    expect(probeDiskTempGuard().passed).toBe(true);
    vi.mocked(spawnSync).mockReturnValue({ status: 40, stdout, stderr: '' } as ReturnType<
      typeof spawnSync
    >);
    expect(probeDiskTempGuard().passed).toBe(false);
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: stdout.replace('0555 no', '0555 yes'),
      stderr: '',
    } as ReturnType<typeof spawnSync>);
    expect(probeDiskTempGuard().passed).toBe(true);
    for (const invalid of [
      stdout.replace(` denied ${errno} not_created`, ''),
      stdout.replace(errno, 'other'),
      stdout.replace('not_created', 'unknown'),
      stdout.replace('denied', 'created'),
    ]) {
      vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: invalid, stderr: '' } as ReturnType<
        typeof spawnSync
      >);
      expect(probeDiskTempGuard().passed).toBe(false);
    }
  });
  it.each([
    '',
    'private_payload',
    'U1_DISK_TEMP_GUARD checked temp yes expected 0555 no extra',
    'U1_DISK_TEMP_GUARD private_payload temp yes expected 0555 no',
    'U1_DISK_TEMP_GUARD checked temp yes 999:999 0555 no',
    'U1_DISK_TEMP_GUARD data_identity data yes 0:0 0700 yes unknown unknown unknown',
    'U1_DISK_TEMP_GUARD data_identity data yes 0:999 0700 yes unknown unknown unknown',
    'U1_DISK_TEMP_GUARD data_identity data yes private_payload 0700 yes unknown unknown unknown',
    'x'.repeat(257),
  ])('O17 guard 無效／非白名單輸出拒絕且不回印', (stdout) => {
    expect(parseGuardEvidence(stdout)).toBeUndefined();
    vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout, stderr: '' } as ReturnType<
      typeof spawnSync
    >);
    expect(probeDiskTempGuard()).toMatchObject({
      passed: false,
      guard: { reason: 'invocation_failed' },
    });
    expect(JSON.stringify(probeDiskTempGuard())).not.toContain('private_payload');
  });
  it('O18 sanitizer 不接受缺欄位或非字串枚舉', () => {
    expect(safeGuardEvidence({ reason: 'checked' })).toBeUndefined();
    expect(
      safeGuardEvidence({
        reason: 'checked',
        target: 'temp',
        present: true,
        owner: 'expected',
        mode: '0555',
        writable: 'no',
      }),
    ).toBeUndefined();
  });
  it('O11 ordinary probe 傳原查詢，解析設定與兩處安全觀察', () => {
    const entries = [
      session,
      {
        ...files,
        scope: 'default',
        directFiles: 0,
        directPositive: 0,
        treeFiles: 0,
        treePositive: 0,
        treeDirectories: 0,
        treeBytes: 0,
      },
      files,
    ];
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: entries.map((entry) => JSON.stringify(entry)).join('\n'),
      stderr: '',
    } as ReturnType<typeof spawnSync>);
    const observations: SpillObservation[] = [];
    expect(ordinarySpill('line_event_app', 'before', observations)).toEqual(entries);
    expect(observations).toEqual(entries);
    const call = vi.mocked(spawnSync).mock.calls[0];
    expect(call?.[1]).toContain('/opt/u1/infra/postgres/ordinary-spill.sh');
    expect(call?.[2]).toMatchObject({ timeout: 10000, maxBuffer: 8192 });
    const input = call?.[2]?.input;
    if (typeof input !== 'string') throw new Error('synthetic_input_missing');
    expect(input.trim().split('\n')).toHaveLength(3);
    expect(input).toContain(spillQuery.replace(/\n/g, ' '));
  });
  it('O12 ordinary timeout 不冒成功，保留先前安全觀察與實際 SQLSTATE', () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: JSON.stringify(session),
      stderr: 'ERROR: 57014\nprivate_payload',
    } as ReturnType<typeof spawnSync>);
    const observations: SpillObservation[] = [];
    expect(() => ordinarySpill('line_event_app', 'before', observations)).toThrow(
      /^database_sqlstate_57014$/,
    );
    expect(observations).toEqual([session]);
  });
  it('O13 零結果／缺觀察不冒成功', () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: '', stderr: '' } as ReturnType<
      typeof spawnSync
    >);
    expect(() => ordinarySpill('line_event_app', 'before', [])).toThrow(
      /^spill_observation_invalid$/,
    );
  });
  it('O14 held cursor 的 XX000 原碼保留，不改成 quota 或 timeout', async () => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      stdin: new PassThrough(),
      kill: vi.fn(),
    });
    vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
    const observations: SpillObservation[] = [];
    const ready = holdSpill('line_event_app', 'before', observations);
    child.stdout.write(JSON.stringify(session) + '\n');
    child.stderr.write('ERROR: XX000\n');
    child.emit('close', 1);
    await expect(ready).rejects.toThrow(/^database_sqlstate_XX000$/);
    expect(observations).toEqual([session]);
  });
  it('O01 兩次白名單投影保留固定設定，移除額外 payload', () => {
    const safe = safeSpillObservation({
      ...session,
      path: 'private_payload',
      sql: 'private_payload',
    });
    expect(safe).toEqual(session);
    expect(safeSpillObservation({ ...safe, secret: 'private_payload' })).toEqual(session);
  });
  it('O02 固定 other／default 與無權限如實保留，不冒成功', () => {
    const value = {
      ...session,
      currentRole: 'other',
      workMem: 'other',
      tempTablespaces: 'default',
      createPrivilege: false,
    };
    expect(safeSpillObservation(value)).toEqual(value);
  });
  it.each([
    { currentRole: 'private_payload' },
    { workMem: 'private_payload' },
    { tempTablespaces: 'private_payload' },
    { statementTimeout: '401ms' },
    { tempFileLimit: '32MB' },
    { createPrivilege: 'true' },
    { role: 'bootstrap' },
    { phase: 'unknown' },
    { cycle: 'none' },
  ])('O03 不接受自由字串／角色／放寬設定', (changes) => {
    expect(safeSpillObservation({ ...session, ...changes })).toBeUndefined();
  });
  it('O04 區分零檔／零大小／子目錄正大小，不把 held 當 sort 證明', () => {
    const value = { ...files, directFiles: 0, directPositive: 0 };
    expect(safeSpillObservation(value)).toEqual(value);
    const zeroSize = { ...files, treePositive: 0, directPositive: 0, treeBytes: 0 };
    expect(safeSpillObservation(zeroSize)).toEqual(zeroSize);
    expect(safeSpillObservation({ ...files, scope: 'default', treeComplete: false })).toEqual({
      ...files,
      scope: 'default',
      treeComplete: false,
    });
  });
  it.each([
    { directFiles: -1 },
    { treeFiles: 130 },
    { treeBytes: 2147483649 },
    { treeBytes: Infinity },
    { treePositive: 1.5 },
    { treeFiles: 1 },
    { directFiles: 0 },
    { scope: 'private_payload' },
    { rootPresent: 'true' },
  ])('O05 拒絕越界／不一致／未知檔案觀察', (changes) => {
    expect(safeSpillObservation({ ...files, ...changes })).toBeUndefined();
  });
  it('O06 parser 綁定呼叫端 context，固定錯誤不回印原文', () => {
    expect(
      parseSpillObservation(JSON.stringify({ ...session, role: 'private_payload' }), context),
    ).toEqual(session);
    for (const value of ['private_payload', '[]', '{}', 'null', 'x'.repeat(2049)]) {
      expect(() => parseSpillObservation(value, context)).toThrow(/^spill_observation_invalid$/);
    }
  });
  it('O07 failed case 仍輸出兩處 metadata，拒絕 extras 且最多16筆', () => {
    const output: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((value) => {
      output.push(String(value));
      return true;
    });
    new DatabaseReporter().onTestCaseResult({
      name: 'R05 synthetic',
      meta: () => ({
        spillObservations: [
          { ...files, path: 'private_payload' },
          { ...files, scope: 'default' },
          ...Array.from({ length: 20 }, () => session),
        ],
      }),
      result: () => ({ state: 'failed', errors: ['private_payload'] }),
    } as unknown as TestCase);
    expect(output).toHaveLength(17);
    expect(output.join('')).not.toContain('private_payload');
    expect(output[0]).toContain('"scope":"target"');
    expect(output[1]).toContain('"scope":"default"');
    expect(output[16]).toContain('"status":"fail"');
  });
  it('O08 觀察唯讀、有界且使用實際 catalog；不放寬 sort 設定', () => {
    expect(spillFilesQuery).toContain('pg_control_system()');
    expect(spillFilesQuery).toContain('LIMIT 129');
    expect(spillFilesQuery).toContain('LIMIT 33');
    expect(spillFilesQuery).toContain('parent.depth<4');
    expect(spillFilesQuery).toContain("'base/pgsql_tmp'");
    expect(spillFilesQuery).toContain('pg_ls_tmpdir(roots.space_oid)');
    expect(spillFilesQuery).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|SET)\b/);
    expect(spillSessionQuery('local')).toContain(
      "has_tablespace_privilege(current_user,'u1_temp','CREATE')",
    );
    expect(spillSessionQuery('held')).toContain("'phase','held'");
  });
  it('O09 同一 child 取得 local／held 設定，保留原 sort／COMMIT／close', async () => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      stdin: new PassThrough(),
      kill: vi.fn(),
    });
    vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
    const observations: SpillObservation[] = [];
    const ready = holdSpill('line_event_app', 'before', observations);
    const statement = String(child.stdin.read());
    expect(statement).toContain("SET LOCAL work_mem='64kB'");
    expect(statement).toContain(`CURSOR WITH HOLD FOR ${spillQuery}; COMMIT;`);
    expect(statement.indexOf("'phase','local'")).toBeLessThan(statement.indexOf('DECLARE'));
    expect(statement.indexOf("'phase','held'")).toBeGreaterThan(statement.indexOf('COMMIT'));
    const response = `${JSON.stringify(session)}\n${JSON.stringify({ ...session, phase: 'held', workMem: '1MB' })}\nU1_HELD\n`;
    child.stdout.write(response.slice(0, 40));
    child.stdout.write(response.slice(40));
    const release = await ready;
    expect(observations).toHaveLength(2);
    const finished = release();
    expect(String(child.stdin.read())).toBe('CLOSE u1_spill;\n');
    child.emit('close', 0);
    await finished;
    expect(spawn).toHaveBeenCalledTimes(1);
  });
  it('O10 缺 metadata 的 held 不冒成功且終止 child', async () => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      stdin: new PassThrough(),
      kill: vi.fn(),
    });
    vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
    const ready = holdSpill('line_event_app', 'before', []);
    child.stdout.write('U1_HELD\n');
    child.emit('close', 1);
    await expect(ready).rejects.toThrow(/^spill_observation_invalid$/);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });
});
