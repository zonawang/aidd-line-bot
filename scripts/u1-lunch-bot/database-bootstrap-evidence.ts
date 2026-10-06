import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  writeFileSync,
  type Stats,
} from 'node:fs';
import {
  guardDenialProven,
  parseGuardEvidence,
  type GuardEvidence,
} from '../../tests/u1-lunch-bot/fixtures/database-checkpoints.ts';
import { requireCondition } from './storage-policy.ts';

const phases = new Set([
  'evidence_channel',
  'identity',
  'tool_admission',
  'binary_version',
  'cgroup_limits',
  'storage',
  'tls_ca',
  'tls_server',
  'tls_negative_ca',
  'initialize',
  'restart_allowlist',
  'disk_temp_guard',
  'isolated_start',
  'tablespace_create',
  'role_migration',
  'model_migration',
  'tablespace_grant',
  'catalog_validation',
  'synthetic_credentials',
  'isolated_stop',
  'tcp_start',
]);
const categories = new Set([
  'runtime_check',
  'identity_mismatch',
  'missing_tool',
  'version_mismatch',
  'limit_mismatch',
  'storage_mismatch',
  'tls_failed',
  'initialization_failed',
  'allowlist_mismatch',
  'disk_temp_rejected',
  'postgres_start_failed',
  'sql_failed',
  'catalog_mismatch',
  'credential_setup_failed',
  'postgres_stop_failed',
]);

export interface BootstrapEvidence {
  phase: string;
  status: string;
  category: string;
  sqlstate: string;
  guard_action?: 'prepare' | 'check';
  guard?: GuardEvidence;
}

export function parseBootstrapStatus(content: string): BootstrapEvidence {
  requireCondition(
    Buffer.byteLength(content) <= 256 &&
      /^[a-zA-Z0-9_ ]+\n$/.test(content) &&
      content.indexOf('\n') === content.length - 1,
    'database_evidence_invalid',
  );
  const [phase, status, category, sqlstate, ...detail] = content.slice(0, -1).split(' ');
  requireCondition(
    phase &&
      phases.has(phase) &&
      status &&
      ['pending', 'started', 'failed', 'passed'].includes(status) &&
      category &&
      categories.has(category) &&
      sqlstate &&
      /^(none|[0-9A-Z]{5})$/.test(sqlstate),
    'database_evidence_invalid',
  );
  if (detail.length === 0) {
    requireCondition(
      phase !== 'disk_temp_guard' || status !== 'passed',
      'database_evidence_invalid',
    );
    return { phase, status, category, sqlstate };
  }
  const [action, ...report] = detail;
  const guard = parseGuardEvidence(report.join(' '));
  requireCondition(
    phase === 'disk_temp_guard' &&
      category === 'disk_temp_rejected' &&
      sqlstate === 'none' &&
      (action === 'prepare' || action === 'check') &&
      guard &&
      ((status === 'failed' && guard.reason !== 'checked') ||
        (status === 'passed' && guardDenialProven(guard))),
    'database_evidence_invalid',
  );
  return { phase, status, category, sqlstate, guard_action: action, guard };
}

function validateDirectory(directory: string, owner: number): void {
  const info = lstatSync(directory);
  requireCondition(
    info.isDirectory() &&
      realpathSync(directory) === directory &&
      info.uid === owner &&
      (info.mode & 0o7777) === 0o700 &&
      readdirSync(directory).every(
        (name) => name === 'bootstrap.status' || name === 'bootstrap.next',
      ),
    'database_evidence_directory',
  );
}

function validateFile(info: Stats, owner: number): void {
  requireCondition(
    info.isFile() &&
      info.nlink === 1 &&
      info.uid === owner &&
      (info.mode & 0o7777) === 0o600 &&
      info.size > 0 &&
      info.size <= 256,
    'database_evidence_file',
  );
}

export function readBootstrapStatus(directory: string, owner: number): string {
  validateDirectory(directory, owner);
  const path = `${directory}/bootstrap.status`;
  const before = lstatSync(path);
  validateFile(before, owner);
  const descriptor = openSync(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const opened = fstatSync(descriptor);
    validateFile(opened, owner);
    requireCondition(
      opened.ino === before.ino && opened.dev === before.dev,
      'database_evidence_changed',
    );
    const buffer = Buffer.alloc(257);
    const size = readSync(descriptor, buffer, 0, buffer.length, 0);
    const after = fstatSync(descriptor);
    validateFile(after, owner);
    requireCondition(
      size === opened.size && size === after.size && size <= 256,
      'database_evidence_size',
    );
    const content = buffer.subarray(0, size).toString('utf8');
    parseBootstrapStatus(content);
    return content;
  } finally {
    closeSync(descriptor);
  }
}

export function writeBootstrapStatus(
  directory: string,
  status: 'pending' | 'passed',
  owner: number,
): void {
  readBootstrapStatus(directory, owner);
  const content =
    status === 'pending'
      ? 'evidence_channel pending runtime_check none\n'
      : 'tcp_start passed runtime_check none\n';
  writeFileSync(`${directory}/bootstrap.next`, content, { mode: 0o600, flag: 'wx' });
  renameSync(`${directory}/bootstrap.next`, `${directory}/bootstrap.status`);
}
