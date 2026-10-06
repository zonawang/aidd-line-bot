export const checkpointIds = [
  'R05_IDENTITY',
  'R05_FIXTURES_VALIDATE',
  'R05_FIXTURES_COMPLETE',
  'R05_BASELINE',
  'R05_MARKER_WRITE',
  'R05_RESTART',
  'R05_MARKER_ABSENT',
  'R05_PRESERVED',
  'R05_NEGATIVE_UID',
  'R05_NEGATIVE_MAJOR',
  'R05_NEGATIVE_CATALOG',
  'R05_NEGATIVE_SYMLINK',
  'R05_SPILL_OPEN',
  'R05_SPILL_OBSERVE',
  'R05_DISK_CHECK',
  'R05_SPILL_CLOSE',
  'R05_DISK_GUARD',
  'R05_HOLD_REFUSED',
  'R05_ORDINARY_SORT',
  'R05_FILE_LIMIT',
  'R05_TMPFS_FILL',
  'R05_TMPFS_EXHAUST',
  'R05_TMPFS_RELEASE',
  'R05_ROLE_HEALTH',
] as const;
export type CheckpointId = (typeof checkpointIds)[number];
export const guardReasons = [
  'checked',
  'inspection_failed',
  'invocation_failed',
  'action',
  'profile',
  'data_environment',
  'process_identity',
  'data_identity',
  'base_identity',
  'temp_symlink',
  'temp_missing',
  'temp_create',
  'temp_identity',
  'temp_scan',
  'temp_nonempty',
  'temp_chmod',
  'temp_mode',
  'temp_writable',
  'temp_probe',
  'temp_created',
  'temp_cleanup',
] as const;
export interface GuardEvidence {
  reason: (typeof guardReasons)[number];
  target: 'context' | 'data' | 'base' | 'temp';
  present: 'yes' | 'no' | 'unknown';
  owner: 'expected' | 'root_pair' | 'mixed_pair' | 'other' | 'unknown';
  mode: '0555' | '0700' | 'other' | 'unknown';
  writable: 'yes' | 'no' | 'unknown';
  create: 'denied' | 'created' | 'unknown';
  errno: 'EACCES' | 'EROFS' | 'none' | 'other' | 'unknown';
  cleanup: 'not_created' | 'removed' | 'unknown';
}

export function guardDenialProven(guard: GuardEvidence): boolean {
  return (
    guard.reason === 'checked' &&
    guard.target === 'temp' &&
    guard.present === 'yes' &&
    guard.owner === 'expected' &&
    guard.mode === '0555' &&
    (guard.writable === 'yes' || guard.writable === 'no') &&
    guard.create === 'denied' &&
    (guard.errno === 'EACCES' || guard.errno === 'EROFS') &&
    guard.cleanup === 'not_created'
  );
}

export function safeGuardEvidence(value: unknown): GuardEvidence | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = { ...value } as Record<string, unknown>;
  if (['create', 'errno', 'cleanup'].every((key) => candidate[key] === undefined)) {
    Object.assign(candidate, { create: 'unknown', errno: 'unknown', cleanup: 'unknown' });
  }
  const choices = {
    reason: guardReasons,
    target: ['context', 'data', 'base', 'temp'],
    present: ['yes', 'no', 'unknown'],
    owner: ['expected', 'root_pair', 'mixed_pair', 'other', 'unknown'],
    mode: ['0555', '0700', 'other', 'unknown'],
    writable: ['yes', 'no', 'unknown'],
    create: ['denied', 'created', 'unknown'],
    errno: ['EACCES', 'EROFS', 'none', 'other', 'unknown'],
    cleanup: ['not_created', 'removed', 'unknown'],
  };
  if (
    !Object.entries(choices).every(
      ([key, allowed]) =>
        typeof candidate[key] === 'string' && allowed.some((item) => item === candidate[key]),
    )
  )
    return undefined;
  return Object.fromEntries(
    Object.keys(choices).map((key) => [key, candidate[key]]),
  ) as unknown as GuardEvidence;
}

export function parseGuardEvidence(value: unknown): GuardEvidence | undefined {
  if (typeof value !== 'string' || value.length > 256) return undefined;
  const [prefix, reason, target, present, owner, mode, writable, create, errno, cleanup, extra] =
    value.trim().split(' ');
  if (prefix !== 'U1_DISK_TEMP_GUARD' || extra !== undefined) return undefined;
  return safeGuardEvidence({
    reason,
    target,
    present,
    owner,
    mode,
    writable,
    create,
    errno,
    cleanup,
  });
}

export interface Checkpoint {
  id: CheckpointId;
  cycle: 'before' | 'after' | 'none';
  role: 'line_event_app' | 'privacy_app' | 'none';
  status: 'started' | 'pass' | 'fail';
  category: 'none' | 'sql' | 'assertion' | 'timeout' | 'connection' | 'command' | 'unknown';
  sqlstate: string;
  guard?: GuardEvidence;
}

export function sqlStateFromDiagnostic(value: string): string | undefined {
  return value.match(/\b(?:ERROR|FATAL):\s+([0-9A-Z]{5})(?:\s|$)/)?.[1];
}

export function failureCategory(error: unknown): Pick<Checkpoint, 'category' | 'sqlstate'> {
  if (!(error instanceof Error)) return { category: 'unknown', sqlstate: 'none' };
  const state = /^database_sqlstate_([0-9A-Z]{5})$/.exec(error.message)?.[1];
  if (state) return { category: 'sql', sqlstate: state };
  if (error.name === 'AssertionError') return { category: 'assertion', sqlstate: 'none' };
  if (['spill_timeout', 'database_start_timeout'].includes(error.message))
    return { category: 'timeout', sqlstate: 'none' };
  if (
    [
      'database_connection_rejected',
      'spill_not_established',
      'spill_failed',
      'spill_process_failed',
    ].includes(error.message)
  )
    return { category: 'connection', sqlstate: 'none' };
  if (error.message === 'bounded_command_failed') return { category: 'command', sqlstate: 'none' };
  return { category: 'unknown', sqlstate: 'none' };
}

export function safeCheckpoint(value: unknown): Checkpoint | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    !checkpointIds.some((id) => id === candidate['id']) ||
    !['before', 'after', 'none'].includes(String(candidate['cycle'])) ||
    !['line_event_app', 'privacy_app', 'none'].includes(String(candidate['role'])) ||
    !['started', 'pass', 'fail'].includes(String(candidate['status'])) ||
    !['none', 'sql', 'assertion', 'timeout', 'connection', 'command', 'unknown'].includes(
      String(candidate['category']),
    ) ||
    typeof candidate['sqlstate'] !== 'string' ||
    !/^(none|[0-9A-Z]{5})$/.test(candidate['sqlstate'])
  )
    return undefined;
  const guard =
    candidate['id'] === 'R05_DISK_GUARD' ? safeGuardEvidence(candidate['guard']) : undefined;
  return {
    id: candidate['id'] as CheckpointId,
    cycle: candidate['cycle'] as Checkpoint['cycle'],
    role: candidate['role'] as Checkpoint['role'],
    status: candidate['status'] as Checkpoint['status'],
    category: candidate['category'] as Checkpoint['category'],
    sqlstate: candidate['sqlstate'],
    ...(guard ? { guard } : {}),
  };
}

export function checkpointRunner(
  trace: Checkpoint[],
  cycle: Checkpoint['cycle'] = 'none',
  role: Checkpoint['role'] = 'none',
) {
  return async <Result>(
    id: CheckpointId,
    operation: () => Result | Promise<Result>,
  ): Promise<Result> => {
    if (trace.length >= 96) throw new Error('database_checkpoint_limit');
    const entry: Checkpoint = {
      id,
      cycle,
      role,
      status: 'started',
      category: 'none',
      sqlstate: 'none',
    };
    trace.push(entry);
    try {
      const result = await operation();
      entry.status = 'pass';
      return result;
    } catch (error) {
      Object.assign(entry, { status: 'fail', ...failureCategory(error) });
      throw error;
    }
  };
}

export function expectSqlState(operation: () => unknown, expected: string): void {
  try {
    operation();
  } catch (error) {
    if (error instanceof Error && error.message === `database_sqlstate_${expected}`) return;
    throw error;
  }
  throw new Error('database_expected_sql_failure_missing');
}
