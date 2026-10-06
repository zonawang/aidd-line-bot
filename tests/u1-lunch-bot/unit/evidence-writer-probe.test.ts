import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { requireCondition } from '../../../scripts/u1-lunch-bot/storage-policy.ts';

const guest = readFileSync('scripts/u1-lunch-bot/evidence-writer-probe.sh', 'utf8');
const host = readFileSync('scripts/u1-lunch-bot/evidence-writer-probe.mjs', 'utf8');
const projection = host.slice(host.indexOf('const steps = ['), host.indexOf('\ntry {\n'));
const project = runInNewContext(`${projection}\nproject`, { requireCondition }) as (
  output: unknown,
) => Record<string, unknown>[];
let root: string;
let evidence: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(`${tmpdir()}/u1-writer-probe-unit-`));
  evidence = `${root}/evidence`;
  mkdirSync(evidence, { mode: 0o700 });
  writeFileSync(`${evidence}/bootstrap.status`, 'evidence_channel pending runtime_check none\n', {
    mode: 0o600,
  });
  writeFileSync(
    `${root}/bootstrap-evidence.sh`,
    readFileSync('infra/postgres/bootstrap-evidence.sh', 'utf8').replaceAll(
      '/u1-evidence',
      evidence,
    ),
  );
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function invoke(mode = 'valid', environment: NodeJS.ProcessEnv = {}) {
  const darwin = process.platform === 'darwin';
  const shim = `${root}/fixture.sh`;
  writeFileSync(
    shim,
    `fixture_moves=0
id() {
  if [[ "$fixture_mode" == wrong_user ]]; then printf private_payload
  elif [[ "$1" == -un ]]; then printf postgres
  else printf 999; fi
}
stat() {
  local format=$2 path=$3 pair=999:999
  [[ "$path" != -- ]] || path=$4
  if [[ "$path" == "$fixture_directory" && "$fixture_moves" == 0 ]]; then pair=0:0; fi
  if [[ "$fixture_mode" == third_owner && "$fixture_moves" == 2 && "$path" == */bootstrap.status ]]; then pair=0:0; fi
  case "$format" in
    '%u:%g:%a') printf '%s:' "$pair"; builtin command stat ${darwin ? "-f '%Lp'" : "-c '%a'"} "$path" ;;
    '%u:%g:%a:%h') printf '%s:' "$pair"; builtin command stat ${darwin ? "-f '%Lp:%l'" : "-c '%a:%h'"} "$path" ;;
    '%s') builtin command stat ${darwin ? "-f '%z'" : "-c '%s'"} "$path" ;;
    *) return 1 ;;
  esac
}
command() {
  if [[ "$1" == -v ]]; then
    if [[ "$fixture_mode:$2" == missing_tool:pg_ctl ]]; then return 1; fi
    return 0
  elif [[ "$1" == stat ]]; then shift; stat "$@"
  elif [[ "$1" == mv ]]; then
    shift
    ${darwin ? 'shift' : ':'}
    builtin command mv "$@" || return 1
    fixture_moves=$((fixture_moves + 1))
  else builtin command "$@"; fi
}
${darwin ? 'find() { builtin command find "$1" -mindepth 1 -maxdepth 1 -exec basename {} \\; ; }' : ''}
`,
  );
  const script = guest
    .replaceAll('/u1-evidence', evidence)
    .replaceAll('/opt/u1/infra/postgres/bootstrap-evidence.sh', `${root}/bootstrap-evidence.sh`);
  return spawnSync('/bin/bash', ['--noprofile', '--norc', '-s'], {
    input: script,
    env: {
      ...process.env,
      BASH_ENV: shim,
      U1_PROFILE: 'synthetic',
      PGDATA: '/var/lib/postgresql/data/pgdata',
      U1_EVIDENCE_HOST_UID: String(process.getuid?.()),
      U1_EVIDENCE_HOST_GID: String(process.getgid?.()),
      fixture_mode: mode,
      fixture_directory: evidence,
      ...environment,
    },
    encoding: 'utf8',
    timeout: 3000,
    maxBuffer: 16384,
  });
}

describe('U1-EVIDENCE-WRITER-PROBE', () => {
  it('W01 三次實際 fixture rename 與所有身分／工具檢查，輸出在原界限內', () => {
    const result = invoke();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const rows = project(result.stdout);
    expect(rows.filter((row) => row['check'] === 'writer_mv')).toHaveLength(3);
    expect(rows.at(-1)).toMatchObject({ reason: 'complete', write: 'third', exitCode: 0 });
    for (const step of [
      'process_identity_return',
      'environment_identity_return',
      'tool_admission_return',
    ])
      expect(rows.some((row) => row['step'] === step && row['priorExitCode'] === 0)).toBe(true);
    expect(readFileSync(`${evidence}/bootstrap.status`, 'utf8')).toBe(
      'tool_admission started missing_tool none\n',
    );
  });
  it('W02 第三次 owner 錯誤仍拒絕，保留 identity started 並只投影固定 metadata', () => {
    const result = invoke('third_owner');
    expect(result.status).toBe(41);
    const rows = project(result.stdout);
    expect(rows.filter((row) => row['check'] === 'writer_mv')).toHaveLength(2);
    expect(rows.at(-1)).toMatchObject({
      write: 'third',
      reason: 'file_owner_mode_links',
      exitCode: 41,
    });
    expect(rows.find((row) => row['point'] === 'final_status')).toMatchObject({
      owner: 'root',
      group: 'root',
    });
    expect(readFileSync(`${evidence}/bootstrap.status`, 'utf8')).toBe(
      'identity started identity_mismatch none\n',
    );
  });
  it.each([
    ['wrong_user', {}, 'process_identity'],
    ['valid', { U1_PROFILE: 'private_payload' }, 'environment_identity'],
    ['valid', { PGDATA: 'private_payload' }, 'environment_identity'],
    ['missing_tool', {}, 'tool_admission'],
  ] as const)('W03 %s 啟動條件失敗不冒成功或回印內容', (mode, environment, reason) => {
    const result = invoke(mode, environment);
    expect(result.status).not.toBe(0);
    expect(project(result.stdout).at(-1)?.['reason']).toBe(reason);
    expect(result.stdout + result.stderr).not.toContain('private_payload');
  });
  it.each([
    'META third directory yes directory 999 999 0700 multiple\n',
    'STEP third private_payload 0\n',
    'EXIT third complete 256\n',
    'EXIT third complete 0 extra\n',
    'EXIT fourth complete 0\n',
    'EXIT third complete 0',
    'MOVE third 0\n'.repeat(161),
    'x'.repeat(16385),
  ])('W04 sanitizer 拒絕非枚舉／原始 ID／缺欄／超界內容', (value) => {
    expect(() => project(value)).toThrow(/^probe_/);
  });
  it('W05 startup checks 與現行 bootstrap 一致，probe 不啟動 PG 或改權', () => {
    const bootstrap = readFileSync('infra/postgres/bootstrap.sh', 'utf8');
    for (const line of guest
      .split('\n')
      .filter(
        (line) =>
          line.startsWith('[[ $(id ') ||
          line.startsWith('[[ ${U1_PROFILE') ||
          line.startsWith('for tool in '),
      ))
      expect(bootstrap).toContain(line.replace(/ \|\| fail$/, ''));
    expect(guest).not.toMatch(/\b(?:chown|chmod|initdb -|pg_ctl -|psql -|exec postgres)\b/);
    expect(host).not.toMatch(
      /databaseAdmission\(|startDatabase\(|resume-r05|writeBootstrapStatus\(/,
    );
    expect(host).toContain("'/u1-evidence', [scratch, true]");
    expect(host).toContain("'ro,noexec,nosuid,nodev,size=1m,uid=999,gid=999,mode=0700'");
    expect(host).toMatch(/timeout:\s*20000,\s*maxBuffer:\s*16384/);
    expect(host).toContain('current.ino === item.info.ino');
    expect(host).toContain("requireCondition(containerGone, 'probe_container_retained')");
  });
});
