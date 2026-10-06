export type SpillRole = 'line_event_app' | 'privacy_app';
export type SpillCycle = 'before' | 'after';
type SpillContext = { role: SpillRole; cycle: SpillCycle };
export type SpillObservation = SpillContext &
  (
    | {
        id: 'R05_SPILL_SESSION';
        phase: 'local' | 'held';
        currentRole: SpillRole | 'other';
        workMem: '64kB' | '1MB' | 'other';
        tempTablespaces: 'u1_temp' | 'default' | 'other';
        createPrivilege: boolean;
        statementTimeout: '400ms' | 'other';
        transactionTimeout: '400ms' | 'other';
        idleTimeout: '400ms' | 'other';
        lockTimeout: '100ms' | 'other';
        tempFileLimit: '16MB' | 'other';
      }
    | {
        id: 'R05_SPILL_FILES';
        scope: 'target' | 'default';
        rootPresent: boolean;
        treeComplete: boolean;
        directFiles: number;
        directPositive: number;
        treeFiles: number;
        treePositive: number;
        treeDirectories: number;
        treeBytes: number;
      }
  );

function oneOf<Value extends string>(value: unknown, choices: readonly Value[]): value is Value {
  return typeof value === 'string' && choices.some((choice) => choice === value);
}

function count(value: unknown, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

export function safeSpillObservation(value: unknown): SpillObservation | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  const { role, cycle } = candidate;
  if (!oneOf(role, ['line_event_app', 'privacy_app']) || !oneOf(cycle, ['before', 'after']))
    return undefined;
  if (candidate['id'] === 'R05_SPILL_SESSION') {
    const {
      phase,
      currentRole,
      workMem,
      tempTablespaces,
      createPrivilege,
      statementTimeout,
      transactionTimeout,
      idleTimeout,
      lockTimeout,
      tempFileLimit,
    } = candidate;
    if (
      !oneOf(phase, ['local', 'held']) ||
      !oneOf(currentRole, ['line_event_app', 'privacy_app', 'other']) ||
      !oneOf(workMem, ['64kB', '1MB', 'other']) ||
      !oneOf(tempTablespaces, ['u1_temp', 'default', 'other']) ||
      typeof createPrivilege !== 'boolean' ||
      !oneOf(statementTimeout, ['400ms', 'other']) ||
      !oneOf(transactionTimeout, ['400ms', 'other']) ||
      !oneOf(idleTimeout, ['400ms', 'other']) ||
      !oneOf(lockTimeout, ['100ms', 'other']) ||
      !oneOf(tempFileLimit, ['16MB', 'other'])
    )
      return undefined;
    return {
      id: 'R05_SPILL_SESSION',
      role,
      cycle,
      phase,
      currentRole,
      workMem,
      tempTablespaces,
      createPrivilege,
      statementTimeout,
      transactionTimeout,
      idleTimeout,
      lockTimeout,
      tempFileLimit,
    };
  }
  if (candidate['id'] === 'R05_SPILL_FILES') {
    const {
      scope,
      rootPresent,
      treeComplete,
      directFiles,
      directPositive,
      treeFiles,
      treePositive,
      treeDirectories,
      treeBytes,
    } = candidate;
    if (
      !oneOf(scope, ['target', 'default']) ||
      typeof rootPresent !== 'boolean' ||
      typeof treeComplete !== 'boolean' ||
      !count(directFiles, 129) ||
      !count(directPositive, 129) ||
      !count(treeFiles, 129) ||
      !count(treePositive, 129) ||
      !count(treeDirectories, 129) ||
      !count(treeBytes, 2147483648) ||
      directPositive > directFiles ||
      treePositive > treeFiles
    )
      return undefined;
    return {
      id: 'R05_SPILL_FILES',
      role,
      cycle,
      scope,
      rootPresent,
      treeComplete,
      directFiles,
      directPositive,
      treeFiles,
      treePositive,
      treeDirectories,
      treeBytes,
    };
  }
  return undefined;
}

export function parseSpillObservation(line: string, context: SpillContext): SpillObservation {
  try {
    if (line.length > 2048) throw new Error();
    const value: unknown = JSON.parse(line);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    const safe = safeSpillObservation({ ...value, ...context });
    if (safe) return safe;
  } catch {
    throw new Error('spill_observation_invalid');
  }
  throw new Error('spill_observation_invalid');
}

export function spillSessionQuery(phase: 'local' | 'held'): string {
  return `SELECT json_build_object(
    'id','R05_SPILL_SESSION','phase','${phase}',
    'currentRole',CASE WHEN current_user IN ('line_event_app','privacy_app') THEN current_user::text ELSE 'other' END,
    'workMem',CASE WHEN current_setting('work_mem') IN ('64kB','1MB') THEN current_setting('work_mem') ELSE 'other' END,
    'tempTablespaces',CASE current_setting('temp_tablespaces') WHEN 'u1_temp' THEN 'u1_temp' WHEN '' THEN 'default' ELSE 'other' END,
    'createPrivilege',has_tablespace_privilege(current_user,'u1_temp','CREATE'),
    'statementTimeout',CASE current_setting('statement_timeout') WHEN '400ms' THEN '400ms' ELSE 'other' END,
    'transactionTimeout',CASE current_setting('transaction_timeout') WHEN '400ms' THEN '400ms' ELSE 'other' END,
    'idleTimeout',CASE current_setting('idle_in_transaction_session_timeout') WHEN '400ms' THEN '400ms' ELSE 'other' END,
    'lockTimeout',CASE current_setting('lock_timeout') WHEN '100ms' THEN '100ms' ELSE 'other' END,
    'tempFileLimit',CASE current_setting('temp_file_limit') WHEN '16MB' THEN '16MB' ELSE 'other' END);`;
}

export const spillFilesQuery = `WITH RECURSIVE
roots(scope,path,space_oid) AS (
  SELECT 'target','pg_tblspc/'||oid||'/PG_17_'||catalog_version_no||'/pgsql_tmp',oid
  FROM pg_tablespace CROSS JOIN pg_control_system() WHERE spcname='u1_temp'
  UNION ALL SELECT 'default','base/pgsql_tmp',oid FROM pg_tablespace WHERE spcname='pg_default'
),
walk(scope,path,depth,valid,overflow) AS (
  SELECT scope,path,0,true,false FROM roots
  UNION ALL
  SELECT parent.scope,parent.path||'/'||child.name,parent.depth+1,
    child.name ~ '^[a-zA-Z0-9_.-]+$' AND child.name NOT IN ('.','..'),child.ordinality=33
  FROM walk AS parent
  CROSS JOIN LATERAL (
    SELECT name,ordinality FROM pg_ls_dir(
      CASE WHEN parent.depth<4 AND parent.valid AND NOT parent.overflow
        AND (pg_stat_file(parent.path,true)).isdir THEN parent.path END,
      true,false) WITH ORDINALITY AS entries(name,ordinality) LIMIT 33
  ) AS child
  WHERE parent.depth<4 AND parent.valid AND NOT parent.overflow
    AND (pg_stat_file(parent.path,true)).isdir
),
bounded AS MATERIALIZED (SELECT * FROM walk LIMIT 129),
stats AS MATERIALIZED (
  SELECT bounded.*,metadata.size,metadata.isdir FROM bounded
  LEFT JOIN LATERAL pg_stat_file(CASE WHEN valid THEN path END,true) AS metadata ON true
)
SELECT json_build_object(
  'id','R05_SPILL_FILES','scope',roots.scope,
  'rootPresent',COALESCE(bool_or(depth=0 AND isdir),false),
  'treeComplete',(SELECT count(*)<129 FROM bounded) AND NOT bool_or(
    NOT valid OR overflow OR (depth=4 AND COALESCE(isdir,false)) OR (depth>0 AND size IS NULL)),
  'directFiles',(SELECT count(*) FROM pg_ls_tmpdir(roots.space_oid)),
  'directPositive',(SELECT count(*) FROM pg_ls_tmpdir(roots.space_oid) WHERE size>0),
  'treeFiles',count(*) FILTER (WHERE depth>0 AND NOT isdir),
  'treePositive',count(*) FILTER (WHERE depth>0 AND NOT isdir AND size>0),
  'treeDirectories',count(*) FILTER (WHERE depth>0 AND isdir),
  'treeBytes',COALESCE(sum(size) FILTER (WHERE depth>0 AND NOT isdir),0))
FROM roots JOIN stats USING(scope) GROUP BY roots.scope,roots.space_oid ORDER BY roots.scope`;
