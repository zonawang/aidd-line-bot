import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseGuardEvidence } from '../fixtures/database-checkpoints.ts';
import { writeGuardFixture } from '../fixtures/disk-guard-fixture.ts';

let root: string;
let data: string;
let directory: string;
const owner = `${String(process.getuid?.())}:${String(process.getgid?.())}`;
let guard: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(`${tmpdir()}/u1-disk-guard-unit-`));
  data = `${root}/pgdata`;
  directory = `${data}/base/pgsql_tmp`;
  mkdirSync(data, { mode: 0o700 });
  mkdirSync(`${data}/base`, { mode: 0o700 });
  guard = writeGuardFixture(root, data);
});
afterEach(() => {
  if (existsSync(directory) && !lstatSync(directory).isSymbolicLink()) chmodSync(directory, 0o700);
  rmSync(root, { recursive: true, force: true });
});

function invoke(action = 'prepare', expectedOwner = owner) {
  const adapter =
    process.platform === 'darwin' ? `stat() { command stat -f '%u:%g:%Lp' "$3"; }` : '';
  return spawnSync(
    '/bin/bash',
    [
      '-c',
      `${adapter}\nsource "$1"; guard_default_temp "$2" "$3" "$4"`,
      'unit-guard',
      guard,
      data,
      expectedOwner,
      action,
    ],
    {
      encoding: 'utf8',
      timeout: 2000,
      maxBuffer: 1024,
    },
  );
}

function standalone(environment: NodeJS.ProcessEnv = {}, identityShim = '') {
  const script = `${root}/standalone-guard.sh`;
  const shim = `${root}/fixture-environment.sh`;
  writeFileSync(script, readFileSync(guard, 'utf8'));
  writeFileSync(
    shim,
    (process.platform === 'darwin' ? `stat() { command stat -f '%u:%g:%Lp' "$3"; }\n` : '') +
      identityShim,
  );
  return spawnSync('/bin/bash', [script], {
    env: { ...process.env, BASH_ENV: shim, U1_PROFILE: 'synthetic', PGDATA: data, ...environment },
    encoding: 'utf8',
    timeout: 2000,
    maxBuffer: 1024,
  });
}

function ownerObservation(metadata: string, operation: 'metadata' | 'check' | 'stat_failure') {
  return spawnSync(
    '/bin/bash',
    [
      '-c',
      `source "$1"
fixture_metadata=$3
fixture_calls=$4
stat() {
  printf 'stat\\n' >> "$fixture_calls"
  [[ "$fixture_metadata" != stat_failed ]] || return 1
  printf '%s\\n' "$fixture_metadata"
}
observe() {
  guard_reset
  guard_target=data
  guard_reason=data_identity
  case "$1" in
    metadata) guard_metadata "$2" 999:999 ;;
    check) guard_default_temp "$2" 999:999 check ;;
    stat_failure)
      guard_metadata "$2" 999:999 || return 1
      fixture_metadata=stat_failed
      guard_target=base
      guard_reason=base_identity
      guard_metadata "$2/base" 999:999 ;;
  esac
}
if observe "$5" "$2"; then guard_report; else guard_report; exit 40; fi`,
      'unit-owner-observation',
      guard,
      data,
      metadata,
      `${root}/stat-calls`,
      operation,
    ],
    { encoding: 'utf8', timeout: 2000, maxBuffer: 1024 },
  );
}

describe('U1-DISK-TEMP-GUARD', () => {
  it.each([
    ['999:999:700', 'expected'],
    ['0:0:700', 'root_pair'],
    ['0:999:700', 'mixed_pair'],
    ['999:0:700', 'mixed_pair'],
    ['12345:12345:700', 'other'],
    ['999:12345:700', 'other'],
    ['12345:0:700', 'other'],
  ])('G21 同一次 stat 的 %s 只投影固定 owner 分類', (metadata, expected) => {
    const result = ownerObservation(metadata, 'metadata');
    expect(result.status).toBe(0);
    expect(parseGuardEvidence(result.stdout)).toMatchObject({ owner: expected, mode: '0700' });
    expect(readFileSync(`${root}/stat-calls`, 'utf8')).toBe('stat\n');
    expect(result.stderr).toBe('');
    expect(result.stdout).not.toContain(metadata);
  });
  it.each(['0:0:700', '0:999:700', '999:0:700', '12345:12345:700'])(
    'G22 PGDATA %s 仍拒絕；診斷分類不成為准入',
    (metadata) => {
      const result = ownerObservation(metadata, 'check');
      expect(result.status).toBe(40);
      expect(parseGuardEvidence(result.stdout)).toMatchObject({
        reason: 'data_identity',
        target: 'data',
        create: 'unknown',
      });
      expect(readFileSync(`${root}/stat-calls`, 'utf8')).toBe('stat\nstat\n');
      expect(existsSync(directory)).toBe(false);
      expect(lstatSync(data).mode & 0o777).toBe(0o700);
      expect(result.stderr).toBe('');
      expect(result.stdout).not.toContain(metadata);
    },
  );
  it('G23 下一 target 的 stat 失敗不沿用前一筆 owner／mode', () => {
    const result = ownerObservation('999:999:700', 'stat_failure');
    expect(result.status).toBe(40);
    expect(parseGuardEvidence(result.stdout)).toMatchObject({
      reason: 'base_identity',
      target: 'base',
      present: 'yes',
      owner: 'unknown',
      mode: 'unknown',
      writable: 'unknown',
    });
    expect(readFileSync(`${root}/stat-calls`, 'utf8')).toBe('stat\nstat\n');
  });
  it('G11 獨立執行與 sourced prepare/check 同樣驗證 0555／建立拒絕', () => {
    expect(invoke().status).toBe(0);
    expect(invoke('check').status).toBe(0);
    const result = standalone();
    expect(result.status).toBe(0);
    expect(parseGuardEvidence(result.stdout)).toEqual({
      reason: 'checked',
      target: 'temp',
      present: 'yes',
      owner: 'expected',
      mode: '0555',
      writable: 'no',
      create: 'denied',
      errno: 'EACCES',
      cleanup: 'not_created',
    });
    expect(result.stderr).toBe('');
    expect(readdirSync(directory)).toEqual([]);
  });
  it('G16 access 可寫的錯誤訊號不取代實際 EACCES，仍回報 yes', () => {
    mkdirSync(directory, { mode: 0o555 });
    writeFileSync(guard, readFileSync(guard, 'utf8').replace('if [[ -w "$path" ]]', 'if true'));
    const result = standalone();
    expect(result.status).toBe(0);
    expect(parseGuardEvidence(result.stdout)).toMatchObject({
      writable: 'yes',
      create: 'denied',
      errno: 'EACCES',
      cleanup: 'not_created',
    });
    expect(readdirSync(directory)).toEqual([]);
  });
  it.each([
    ['EROFS', 0, 'denied', 'EROFS'],
    ['ENOSPC', 40, 'unknown', 'other'],
    ['EIO', 40, 'unknown', 'other'],
    ['EEXIST', 40, 'unknown', 'other'],
  ] as const)('G17 真實 errno 分類 %s，其他拒絕不算保護成功', (errno, exit, create, expected) => {
    mkdirSync(directory, { mode: 0o555 });
    const helper = `${root}/create-denial.pl`;
    writeFileSync(
      helper,
      readFileSync(helper, 'utf8')
        .replace(
          'use Errno qw(EACCES EROFS ENOENT);',
          `use Errno qw(EACCES EROFS ENOENT ${errno});`,
        )
        .replace(
          'sysopen($handle, $filename, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0600)',
          `do { $! = ${errno}; 0 }`,
        ),
    );
    const result = standalone();
    expect(result.status).toBe(exit);
    expect(parseGuardEvidence(result.stdout)).toMatchObject({
      create,
      errno: expected,
      cleanup: 'not_created',
    });
    expect(readdirSync(directory)).toEqual([]);
  });
  it.each(['missing', 'malformed', 'created', 'cleanup', 'nonzero'])(
    'G18 helper %s 不可變成成功，無原文外洩',
    (kind) => {
      mkdirSync(directory, { mode: 0o555 });
      const helper = `${root}/create-denial.pl`;
      if (kind === 'missing') rmSync(helper);
      else {
        const report =
          kind === 'created'
            ? 'created none removed'
            : kind === 'cleanup'
              ? 'created none unknown'
              : kind === 'nonzero'
                ? 'denied EACCES not_created'
                : 'private_payload';
        writeFileSync(helper, `print "U1_CREATE_DENIAL ${report}\\n"; exit 1;`);
      }
      const result = standalone();
      expect(result.status).toBe(40);
      expect(result.stdout + result.stderr).not.toContain('private_payload');
      expect(readdirSync(directory)).toEqual([]);
    },
  );
  it.each(['removed', 'modified', 'unlink_failure', 'interrupted'])(
    'G19 意外建立 %s 僅清理自己的零位元組檔，仍失敗',
    (kind) => {
      mkdirSync(directory, { mode: 0o700 });
      const helper = `${root}/create-denial.pl`;
      let source = readFileSync(helper, 'utf8').replaceAll('0555', '0700');
      if (kind === 'modified')
        source = source.replace('$created = 1;', '$created = 1; syswrite($handle, "synthetic");');
      if (kind === 'unlink_failure') source = source.replace('unlink($filename) == 1', '0 == 1');
      if (kind === 'interrupted')
        source = source.replace(
          "$cleanup = 'unknown';\n    } else",
          '$cleanup = \'unknown\'; die "interrupted\\n";\n    } else',
        );
      writeFileSync(helper, source);
      const result = spawnSync('/usr/bin/perl', [helper], { encoding: 'utf8', timeout: 2000 });
      expect(result.status).toBe(1);
      const removed = kind === 'removed' || kind === 'interrupted';
      expect(result.stdout).toBe(
        `U1_CREATE_DENIAL created none ${removed ? 'removed' : 'unknown'}\n`,
      );
      expect(result.stderr).toBe('');
      const entries = readdirSync(directory);
      expect(entries).toHaveLength(removed ? 0 : 1);
      if (!removed) {
        const info = lstatSync(`${directory}/${entries[0] ?? ''}`);
        expect(info.uid).toBe(process.getuid?.());
        expect(info.mode & 0o777).toBe(0o600);
        expect(info.size).toBe(kind === 'modified' ? 9 : 0);
      }
    },
  );
  it.each([
    [{ U1_PROFILE: 'private_payload' }, 'profile'],
    [{ PGDATA: 'private_payload' }, 'data_environment'],
  ] as const)('G12 獨立 context 錯誤回固定原因，不回印輸入', (environment, reason) => {
    const result = standalone(environment);
    expect(result.status).toBe(40);
    expect(parseGuardEvidence(result.stdout)?.reason).toBe(reason);
    expect(result.stdout + result.stderr).not.toContain('private_payload');
  });
  it('G13 獨立 process identity 不符明示，無 host/guest UID 值', () => {
    const result = standalone({}, 'id() { printf 999999; }');
    expect(result.status).toBe(40);
    expect(parseGuardEvidence(result.stdout)?.reason).toBe('process_identity');
    expect(result.stdout).not.toContain('999999');
  });
  it.each(['nonempty', 'symlink', 'changed_tree', 'replaced_file'])(
    'G20 helper 自身檢查 %s，不刪不屬於原 descriptor 的檔案',
    (kind) => {
      mkdirSync(directory, { mode: 0o700 });
      const helper = `${root}/create-denial.pl`;
      const canary = `${root}/private_payload`;
      writeFileSync(canary, 'synthetic', { mode: 0o600 });
      if (kind === 'nonempty') writeFileSync(`${directory}/retained`, 'synthetic');
      if (kind === 'symlink') {
        rmSync(directory, { recursive: true });
        symlinkSync(`${root}/absent`, directory);
      } else if (kind === 'replaced_file') {
        writeFileSync(
          helper,
          readFileSync(helper, 'utf8')
            .replaceAll('0555', '0700')
            .replace(
              '$created = 1;',
              '$created = 1; rename($filename, "$directory/retained") or die "rename\\n"; symlink("' +
                canary +
                '", $filename) or die "link\\n";',
            ),
        );
      } else {
        chmodSync(directory, 0o555);
        if (kind === 'changed_tree')
          writeFileSync(
            helper,
            readFileSync(helper, 'utf8').replace(
              '        same_tree();\n        absent();',
              '        chmod(0700, $directory);\n        same_tree();\n        absent();',
            ),
          );
      }
      const result = spawnSync('/usr/bin/perl', [helper], { encoding: 'utf8', timeout: 2000 });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe(
        kind === 'replaced_file'
          ? 'U1_CREATE_DENIAL created none unknown\n'
          : 'U1_CREATE_DENIAL unknown other unknown\n',
      );
      expect(result.stderr).toBe('');
      expect(readFileSync(canary, 'utf8')).toBe('synthetic');
      if (kind === 'nonempty')
        expect(readFileSync(`${directory}/retained`, 'utf8')).toBe('synthetic');
      if (kind === 'symlink') expect(lstatSync(directory).isSymbolicLink()).toBe(true);
      if (kind === 'replaced_file') {
        expect(readdirSync(directory)).toHaveLength(2);
        expect(lstatSync(`${directory}/retained`).size).toBe(0);
      }
    },
  );
  it('G14 check 缺目錄保留缺失，不自動重建', () => {
    const result = standalone();
    expect(result.status).toBe(40);
    expect(parseGuardEvidence(result.stdout)).toMatchObject({
      reason: 'temp_missing',
      present: 'no',
      mode: 'unknown',
    });
    expect(existsSync(directory)).toBe(false);
  });
  it('G15 0700 與非空目錄回不同固定原因，不 chmod／刪除', () => {
    mkdirSync(directory, { mode: 0o700 });
    const writable = standalone();
    expect(writable.status).toBe(40);
    expect(parseGuardEvidence(writable.stdout)).toMatchObject({
      reason: 'temp_mode',
      mode: '0700',
      writable: 'yes',
    });
    writeFileSync(`${directory}/private_payload`, 'synthetic');
    const nonempty = standalone();
    expect(nonempty.status).toBe(40);
    expect(parseGuardEvidence(nonempty.stdout)?.reason).toBe('temp_nonempty');
    expect(nonempty.stdout + nonempty.stderr).not.toContain('private_payload');
    expect(readFileSync(`${directory}/private_payload`, 'utf8')).toBe('synthetic');
    expect(lstatSync(directory).mode & 0o777).toBe(0o700);
  });
  it('G01 缺少專用目錄時只建立空 0555，不改父目錄', () => {
    const base = lstatSync(`${data}/base`);
    expect(invoke().status).toBe(0);
    expect(lstatSync(directory).mode & 0o777).toBe(0o555);
    expect(lstatSync(`${data}/base`).ino).toBe(base.ino);
    expect(lstatSync(`${data}/base`).mode & 0o777).toBe(0o700);
  });
  it('G02 原空 0700 可收緊且後續只核驗，同 inode 保留', () => {
    mkdirSync(directory, { mode: 0o700 });
    const inode = lstatSync(directory).ino;
    expect(invoke().status).toBe(0);
    expect(invoke('check').status).toBe(0);
    expect(invoke().status).toBe(0);
    expect(lstatSync(directory).ino).toBe(inode);
  });
  it('G03 非空先拒絕，不刪檔、不 chmod 或覆寫', () => {
    mkdirSync(directory, { mode: 0o700 });
    writeFileSync(`${directory}/synthetic-residue`, 'synthetic');
    expect(invoke().status).not.toBe(0);
    expect(readFileSync(`${directory}/synthetic-residue`, 'utf8')).toBe('synthetic');
    expect(lstatSync(directory).mode & 0o777).toBe(0o700);
  });
  it('G04 symlink／懸空 symlink 拒絕，不跟隨或移除', () => {
    symlinkSync(`${root}/missing`, directory);
    expect(invoke().status).not.toBe(0);
    expect(lstatSync(directory).isSymbolicLink()).toBe(true);
    expect(existsSync(`${root}/missing`)).toBe(false);
  });
  it('G05 base 路徑 symlink 拒絕', () => {
    rmSync(`${data}/base`, { recursive: true });
    mkdirSync(`${root}/alternate`, { mode: 0o700 });
    symlinkSync(`${root}/alternate`, `${data}/base`);
    expect(invoke().status).not.toBe(0);
    expect(existsSync(`${root}/alternate/pgsql_tmp`)).toBe(false);
  });
  it('G06 未知權限／owner 拒絕，不自行修正', () => {
    mkdirSync(directory, { mode: 0o700 });
    chmodSync(directory, 0o777);
    expect(invoke().status).not.toBe(0);
    expect(lstatSync(directory).mode & 0o777).toBe(0o777);
    expect(invoke('prepare', '999999:999999').status).not.toBe(0);
  });
  it('G07 check 不建立缺失目錄或修正可寫目錄', () => {
    expect(invoke('check').status).not.toBe(0);
    expect(existsSync(directory)).toBe(false);
    mkdirSync(directory, { mode: 0o700 });
    expect(invoke('check').status).not.toBe(0);
    expect(lstatSync(directory).mode & 0o777).toBe(0o700);
  });
  it('G08 子目錄或普通檔均非可接受的空專用目錄', () => {
    mkdirSync(directory, { mode: 0o700 });
    mkdirSync(`${directory}/nested`);
    expect(invoke().status).not.toBe(0);
    expect(existsSync(`${directory}/nested`)).toBe(true);
    rmSync(directory, { recursive: true });
    writeFileSync(directory, 'synthetic');
    expect(invoke().status).not.toBe(0);
    expect(readFileSync(directory, 'utf8')).toBe('synthetic');
  });
  it('G09 每次啟動先防護，isolated stop 後再核驗才開 TCP', () => {
    const source = readFileSync('infra/postgres/bootstrap.sh', 'utf8');
    expect(source.indexOf('guard_checkpoint prepare')).toBeGreaterThan(0);
    expect(source.indexOf('guard_checkpoint prepare')).toBeLessThan(
      source.indexOf('checkpoint isolated_start'),
    );
    expect(source.indexOf('guard_checkpoint check')).toBeGreaterThan(
      source.indexOf('checkpoint isolated_stop'),
    );
    expect(source.indexOf('guard_checkpoint check')).toBeLessThan(
      source.indexOf('checkpoint tcp_start'),
    );
    expect(source).toContain(
      "datname='lunch_bot' AND dattablespace=(SELECT oid FROM pg_tablespace WHERE spcname='pg_default')",
    );
  });
  it('G10 ordinary sort 先 FETCH 再容器內觀察，最後 CLOSE；不放寬 timeout', () => {
    const source = readFileSync('infra/postgres/ordinary-spill.sh', 'utf8');
    expect(source).toContain('NO SCROLL CURSOR WITHOUT HOLD');
    expect(source.indexOf('FETCH FORWARD 1')).toBeLessThan(source.indexOf('files=$(printf'));
    expect(source.indexOf('files=$(printf')).toBeLessThan(source.indexOf('CLOSE u1_sort; COMMIT;'));
    expect(source).toContain("'\\o /dev/null'");
    expect(source).not.toMatch(/SET.*(?:timeout|temp_file_limit)|pg_sleep|sleep [0-9]/);
  });
});
