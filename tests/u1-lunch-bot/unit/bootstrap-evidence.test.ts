import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  parseBootstrapStatus,
  readBootstrapStatus,
  writeBootstrapStatus,
} from '../../../scripts/u1-lunch-bot/database-bootstrap-evidence.ts';
import { validateResumeFiles } from '../../../scripts/u1-lunch-bot/database-resume-policy.ts';
import { writeGuardFixture } from '../fixtures/disk-guard-fixture.ts';

const uid = process.getuid?.() ?? -1;
const owner = `${String(uid)}:${String(process.getgid?.())}`;
const pending = 'evidence_channel pending runtime_check none\n';
const started = 'evidence_channel started runtime_check none\n';
const legacyFailure = 'disk_temp_guard failed disk_temp_rejected none\n';
const writableFailure = `${legacyFailure.trim()} prepare U1_DISK_TEMP_GUARD temp_writable temp yes expected 0555 yes\n`;
let root: string;
let evidence: string;
let status: string;
let data: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(`${tmpdir()}/u1-bootstrap-evidence-unit-`));
  evidence = `${root}/evidence`;
  status = `${evidence}/bootstrap.status`;
  data = `${root}/mount/pgdata`;
  mkdirSync(evidence, { mode: 0o700 });
  mkdirSync(`${root}/mount`, { mode: 0o700 });
  mkdirSync(data, { mode: 0o700 });
  mkdirSync(`${data}/base`, { mode: 0o700 });
  writeFileSync(status, pending, { mode: 0o600 });
});
afterEach(() => {
  if (existsSync(`${data}/base/pgsql_tmp`)) chmodSync(`${data}/base/pgsql_tmp`, 0o700);
  rmSync(root, { recursive: true, force: true });
});

function bootstrapGuard(action: 'prepare' | 'check', shim = '', after = '') {
  const library = `${root}/bootstrap-evidence.sh`;
  writeFileSync(
    library,
    readFileSync('infra/postgres/bootstrap-evidence.sh', 'utf8')
      .replaceAll('/u1-evidence', evidence)
      .replace('0:0:700', `${owner}:700`)
      .replaceAll('999:999', owner),
  );
  const prefix =
    readFileSync('infra/postgres/bootstrap.sh', 'utf8').split('trap fail ERR')[0] ?? '';
  const adapter =
    process.platform === 'darwin'
      ? `
stat() {
  case "$2" in
    '%u:%g:%a') command stat -f '%u:%g:%Lp' "$3" ;;
    '%u:%g:%a:%h') command stat -f '%u:%g:%Lp:%l' "$3" ;;
    '%s') command stat -f '%z' "$3" ;;
    *) return 1 ;;
  esac
}
find() {
  if [[ "$*" == *-printf* ]]; then command find "$1" -mindepth 1 -maxdepth 1 -exec basename {} \\;
  else command find "$@"; fi
}
mv() { shift; command mv "$@"; }
`
      : '';
  return spawnSync(
    '/bin/bash',
    [
      '-c',
      `${adapter}
${prefix.replace('/opt/u1/infra/postgres/bootstrap-evidence.sh', library)}
trap fail ERR
source "$1"
PGDATA=$2
${shim}
guard_checkpoint "$3"
${after}
`,
      'unit-bootstrap-evidence',
      writeGuardFixture(root, data),
      data,
      action,
    ],
    {
      encoding: 'utf8',
      timeout: 3000,
      maxBuffer: 1024,
    },
  );
}

function repeatedEvidenceWrites(
  initialDirectory: string,
  nextDirectory: string,
  fileOwner = '999:999',
) {
  const library = `${root}/writer-evidence.sh`;
  writeFileSync(
    library,
    readFileSync('infra/postgres/bootstrap-evidence.sh', 'utf8').replaceAll(
      '/u1-evidence',
      evidence,
    ),
  );
  const darwin = process.platform === 'darwin';
  return spawnSync(
    '/bin/bash',
    [
      '-c',
      `
set -euo pipefail
umask 077
writes=0
stat() {
  case "$2" in
    '%u:%g:%a')
      [[ "$3" == "$directory" ]] || return 1
      if [[ "$writes" == 0 ]]; then printf '%s\\n' "$initial_directory";
      else printf '%s\\n' "$next_directory"; fi ;;
    '%u:%g:%a:%h')
      printf '%s:' "$file_owner"
      command stat ${darwin ? "-f '%Lp:%l'" : "-c '%a:%h'"} "$3" ;;
    '%s') command stat ${darwin ? "-f '%z'" : "-c '%s'"} "$3" ;;
    *) return 1 ;;
  esac
}
${darwin ? 'find() { command find "$1" -mindepth 1 -maxdepth 1 -exec basename {} \\; ; }' : ''}
mv() {
  ${darwin ? 'shift' : ':'}
  command mv "$@" || return 1
  writes=$((writes + 1))
}
directory=$2
initial_directory=$3
next_directory=$4
file_owner=$5
source "$1"
phase=evidence_channel
category=runtime_check
sqlstate=none
fail() { exit 41; }
checkpoint() { phase=$1; category=$2; sqlstate=none; evidence started || fail; }
trap fail ERR
evidence started
checkpoint identity identity_mismatch
printf '%s' "$writes"
`,
      'unit-evidence-writes',
      library,
      evidence,
      initialDirectory,
      nextDirectory,
      fileOwner,
    ],
    { encoding: 'utf8', timeout: 3000, maxBuffer: 1024 },
  );
}

describe('U1-BOOTSTRAP-EVIDENCE', () => {
  it('B01 真正 sourced guard 成功，原子證據包含 prepare／check', () => {
    for (const action of ['prepare', 'check'] as const) {
      const result = bootstrapGuard(action);
      expect(result.status).toBe(0);
      expect(result.stdout + result.stderr).toBe('');
      expect(parseBootstrapStatus(readBootstrapStatus(evidence, uid))).toMatchObject({
        status: 'passed',
        guard_action: action,
        guard: {
          reason: 'checked',
          target: 'temp',
          present: 'yes',
          owner: 'expected',
          mode: '0555',
          writable: 'no',
          create: 'denied',
          errno: 'EACCES',
          cleanup: 'not_created',
        },
      });
      expect(readdirSync(evidence)).toEqual(['bootstrap.status']);
      expect(lstatSync(status).mode & 0o777).toBe(0o600);
    }
  });
  it('B02 真正 check 失敗經 ERR／fail 路徑不遺失固定原因，且不建立目錄', () => {
    const result = bootstrapGuard('check');
    expect(result.status).toBe(41);
    expect(result.stdout).toBe('U1_BOOTSTRAP_FAIL=disk_temp_guard\n');
    expect(result.stderr).toBe('');
    expect(parseBootstrapStatus(readBootstrapStatus(evidence, uid))).toMatchObject({
      status: 'failed',
      guard_action: 'check',
      guard: {
        reason: 'temp_missing',
        target: 'temp',
        present: 'no',
        owner: 'unknown',
        mode: 'unknown',
        writable: 'unknown',
      },
    });
    expect(existsSync(`${data}/base/pgsql_tmp`)).toBe(false);
  });
  it('B03 模擬 0555 仍可寫：保留矛盾證據與失敗，不以 mode 掩蓋', () => {
    const result = bootstrapGuard(
      'prepare',
      `guard_default_temp() {
      guard_reset; guard_reason=temp_writable; guard_target=temp; guard_present=yes;
      guard_owner=expected; guard_mode=0555; guard_writable=yes; return 1;
    }`,
    );
    expect(result.status).toBe(41);
    expect(readBootstrapStatus(evidence, uid)).toBe(
      `${writableFailure.trim()} unknown unknown unknown\n`,
    );
    expect(result.stdout + result.stderr).not.toContain(root);
  });
  it('B04 後續 checkpoint／新 attempt 清除舊 guard，無 sidecar stale 成功', () => {
    expect(
      bootstrapGuard('prepare', '', 'checkpoint isolated_start postgres_start_failed').status,
    ).toBe(0);
    expect(parseBootstrapStatus(readBootstrapStatus(evidence, uid)).guard).toBeUndefined();
    writeFileSync(status, writableFailure);
    writeBootstrapStatus(evidence, 'pending', uid);
    expect(readBootstrapStatus(evidence, uid)).toBe(pending);
    expect(readdirSync(evidence)).toEqual(['bootstrap.status']);
  });
  it.each(['symlink', 'hardlink', 'mode', 'oversize', 'next', 'unexpected'])(
    'B05 不安全證據 %s 拒絕；shell writer／host reader 不跟隨或覆寫',
    (kind) => {
      const outside = `${root}/private_payload`;
      writeFileSync(outside, pending, { mode: 0o600 });
      if (kind === 'symlink' || kind === 'hardlink') {
        rmSync(status);
        if (kind === 'symlink') symlinkSync(outside, status);
        else linkSync(outside, status);
      }
      if (kind === 'mode') chmodSync(status, 0o644);
      if (kind === 'oversize') writeFileSync(status, 'x'.repeat(257));
      if (kind === 'next') symlinkSync(outside, `${evidence}/bootstrap.next`);
      if (kind === 'unexpected') writeFileSync(`${evidence}/private_payload`, 'synthetic');
      const before = readFileSync(status, 'utf8');
      const result = bootstrapGuard('prepare');
      expect(result.status).toBe(41);
      expect(result.stdout + result.stderr).not.toContain(root);
      expect(result.stdout + result.stderr).not.toContain('private_payload');
      if (kind !== 'next')
        expect(() => readBootstrapStatus(evidence, uid)).toThrow(/^database_evidence_/);
      expect(() => {
        writeBootstrapStatus(evidence, 'pending', uid);
      }).toThrow();
      expect(readFileSync(status, 'utf8')).toBe(before);
      expect(readFileSync(outside, 'utf8')).toBe(pending);
      expect(existsSync(`${data}/base/pgsql_tmp`)).toBe(false);
    },
  );
  it.each(['directory_link', 'directory_mode', 'directory_owner', 'empty'])(
    'B06 reader metadata %s 不合時 fail closed',
    (kind) => {
      if (kind === 'directory_link') {
        renameSync(evidence, `${root}/alternate`);
        symlinkSync(`${root}/alternate`, evidence);
      }
      if (kind === 'directory_mode') chmodSync(evidence, 0o755);
      if (kind === 'empty') writeFileSync(status, '');
      expect(() =>
        readBootstrapStatus(evidence, kind === 'directory_owner' ? uid + 1 : uid),
      ).toThrow(/^database_evidence_/);
    },
  );
  it.each([
    'disk_temp_guard passed disk_temp_rejected none\n',
    `${writableFailure.trim()} private_payload\n`,
    writableFailure.replace('temp_writable', 'private_payload'),
    writableFailure.replace('prepare', 'private_payload'),
    writableFailure.replace('disk_temp_guard', 'tcp_start'),
    writableFailure.replace('failed', 'passed'),
    writableFailure.replace('0555', '/private_payload'),
    writableFailure.replace('expected', '999:999'),
    `${legacyFailure}\n`,
    legacyFailure.trim(),
  ])('B07 封閉語法／一致性，不接受 raw 資料或矛盾成功', (value) => {
    expect(() => parseBootstrapStatus(value)).toThrow('database_evidence_invalid');
  });
  it.each([legacyFailure, pending, started])(
    'B08 既有失敗／pending／started 續跑仍要求 initialized PGDATA／SQL hash／唯一 symlink',
    (prior) => {
      writeFileSync(status, prior);
      for (const directory of ['pg_wal', 'pg_tblspc'])
        mkdirSync(`${data}/${directory}`, { mode: 0o700 });
      writeFileSync(`${data}/PG_VERSION`, '17\n', { mode: 0o600 });
      const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
      writeFileSync(
        `${data}/u1-temp.allowlist`,
        `17 202406281 16384 /u1-temp/tablespace ${hash('db/migrations/001-model.sql')} ${hash('db/roles/bootstrap.sql')}\n`,
        { mode: 0o600 },
      );
      symlinkSync('/u1-temp/tablespace', `${data}/pg_tblspc/16384`);
      const validate = () => {
        validateResumeFiles(`${root}/mount`, evidence, resolve('.'), uid);
      };
      expect(validate).not.toThrow();
      expect(readFileSync(status, 'utf8')).toBe(prior);
      writeFileSync(`${data}/postmaster.pid`, 'synthetic');
      expect(validate).toThrow('database_resume_postmaster_present');
      rmSync(`${data}/postmaster.pid`);
      writeFileSync(`${data}/PG_VERSION`, '16\n');
      expect(validate).toThrow('database_resume_version_or_allowlist');
      expect(readFileSync(status, 'utf8')).toBe(prior);
    },
  );
  it('B09 缺 base 的摘要不可挪用 data 的 owner／mode', () => {
    rmSync(`${data}/base`, { recursive: true });
    expect(bootstrapGuard('check').status).toBe(41);
    expect(parseBootstrapStatus(readBootstrapStatus(evidence, uid)).guard).toEqual({
      reason: 'base_identity',
      target: 'base',
      present: 'no',
      owner: 'unknown',
      mode: 'unknown',
      writable: 'unknown',
      create: 'unknown',
      errno: 'unknown',
      cleanup: 'unknown',
    });
  });
  it.each([
    '0:999:700',
    '999:0:700',
    '12345:12345:700',
    '0:12345:700',
    '0:0:755',
    '999:999:755',
    '0:0:1700',
    '999:999:1700',
  ])('B10 第二次寫入拒絕混合／其他 owner 或錯 mode %s，不覆蓋既有狀態', (metadata) => {
    const result = repeatedEvidenceWrites('0:0:700', metadata);
    expect(result.status).toBe(41);
    expect(result.stdout + result.stderr).toBe('');
    expect(readBootstrapStatus(evidence, uid)).toBe(started);
    expect(readdirSync(evidence)).toEqual(['bootstrap.status']);
  });
  it.each([
    ['0:0:700', '999:999:700'],
    ['0:0:700', '0:0:700'],
    ['999:999:700', '999:999:700'],
  ])('B12 重複原子寫入接受精確目錄轉譯 %s → %s，不改 host 權限', (initial, next) => {
    const before = lstatSync(evidence);
    const result = repeatedEvidenceWrites(initial, next);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('2');
    expect(result.stderr).toBe('');
    expect(readBootstrapStatus(evidence, uid)).toBe('identity started identity_mismatch none\n');
    expect(readdirSync(evidence)).toEqual(['bootstrap.status']);
    const after = lstatSync(evidence);
    expect([after.dev, after.ino, after.uid, after.gid, after.mode]).toEqual([
      before.dev,
      before.ino,
      before.uid,
      before.gid,
      before.mode,
    ]);
  });
  it.each(['0:0', '0:999', '999:0', '12345:12345'])(
    'B13 目錄 allowlist 不擴大 status 檔案 owner %s',
    (fileOwner) => {
      const result = repeatedEvidenceWrites('0:0:700', '999:999:700', fileOwner);
      expect(result.status).toBe(41);
      expect(result.stdout + result.stderr).toBe('');
      expect(readBootstrapStatus(evidence, uid)).toBe(pending);
      expect(readdirSync(evidence)).toEqual(['bootstrap.status']);
    },
  );
  it.each(['EACCES', 'EROFS'])('B11 passed 以建立拒絕 %s 為準，access 可寫仍如實保留', (errno) => {
    const content = `disk_temp_guard passed disk_temp_rejected none check U1_DISK_TEMP_GUARD checked temp yes expected 0555 yes denied ${errno} not_created\n`;
    expect(parseBootstrapStatus(content).guard).toMatchObject({
      writable: 'yes',
      create: 'denied',
      errno,
      cleanup: 'not_created',
    });
    for (const invalid of [
      content.replace(` denied ${errno} not_created`, ''),
      content.replace(errno, 'other'),
      content.replace('not_created', 'removed'),
      content.replace('denied', 'created'),
    ])
      expect(() => parseBootstrapStatus(invalid)).toThrow('database_evidence_invalid');
  });
});
