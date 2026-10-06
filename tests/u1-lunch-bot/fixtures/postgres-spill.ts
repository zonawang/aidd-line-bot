import { spawn, spawnSync } from 'node:child_process';
import {
  databaseName,
  verifyDatabaseContainer,
} from '../../../scripts/u1-lunch-bot/database-runtime.ts';
import { dockerInvocationEnvironment } from '../../../scripts/u1-lunch-bot/storage-host.ts';
import { storage } from '../../../scripts/u1-lunch-bot/storage-policy.ts';
import {
  guardDenialProven,
  parseGuardEvidence,
  sqlStateFromDiagnostic,
  type GuardEvidence,
} from './database-checkpoints.ts';
import {
  parseSpillObservation,
  spillSessionQuery,
  spillFilesQuery,
  type SpillCycle,
  type SpillObservation,
} from './spill-observations.ts';

export const spillQuery = `SELECT repeat(md5(series.value::text), 8) AS body
  FROM generate_series(1,5000) AS series(value) ORDER BY body`;

function observationText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function probeDiskTempGuard(): { passed: boolean; guard: GuardEvidence } {
  verifyDatabaseContainer();
  const result = spawnSync(
    storage.docker,
    [
      '--context',
      'desktop-linux',
      'exec',
      databaseName,
      '/bin/bash',
      '/opt/u1/infra/postgres/disk-temp-guard.sh',
    ],
    { env: dockerInvocationEnvironment(), encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 },
  );
  const guard = parseGuardEvidence(result.stdout);
  return {
    passed: !result.error && result.status === 0 && guard !== undefined && guardDenialProven(guard),
    guard: guard ?? {
      reason: 'invocation_failed',
      target: 'context',
      present: 'unknown',
      owner: 'unknown',
      mode: 'unknown',
      writable: 'unknown',
      create: 'unknown',
      errno: 'unknown',
      cleanup: 'unknown',
    },
  };
}

export function ordinarySpill(
  role: 'line_event_app' | 'privacy_app',
  cycle: SpillCycle,
  observations: SpillObservation[],
): SpillObservation[] {
  verifyDatabaseContainer();
  const result = spawnSync(
    storage.docker,
    [
      '--context',
      'desktop-linux',
      'exec',
      '-i',
      databaseName,
      '/bin/bash',
      '/opt/u1/infra/postgres/ordinary-spill.sh',
      role,
    ],
    {
      env: dockerInvocationEnvironment(),
      encoding: 'utf8',
      timeout: 10_000,
      maxBuffer: 8192,
      input:
        [spillSessionQuery('local'), spillFilesQuery, spillQuery]
          .map((query) => query.replace(/\n/g, ' '))
          .join('\n') + '\n',
    },
  );
  const entries = observationText(result.stdout)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => parseSpillObservation(line, { role, cycle }));
  if (entries.length > 3) throw new Error('spill_observation_invalid');
  observations.push(...entries);
  if (result.error || result.status !== 0) {
    const state = sqlStateFromDiagnostic(observationText(result.stderr));
    throw new Error(state ? `database_sqlstate_${state}` : 'spill_process_failed');
  }
  if (entries.length !== 3) throw new Error('spill_observation_invalid');
  return entries;
}

export async function holdSpill(
  role: 'line_event_app' | 'privacy_app',
  cycle: SpillCycle,
  observations: SpillObservation[],
): Promise<() => Promise<void>> {
  verifyDatabaseContainer();
  const child = spawn(
    storage.docker,
    [
      '--context',
      'desktop-linux',
      'exec',
      '-i',
      databaseName,
      '/bin/bash',
      '/opt/u1/infra/postgres/client.sh',
      role,
    ],
    { env: dockerInvocationEnvironment(), stdio: ['pipe', 'pipe', 'pipe'] },
  );
  let held = false;
  let diagnostic = '';
  let sqlstate: string | undefined;
  let rejectReady: (error: Error) => void = () => undefined;
  const timer = setTimeout(() => {
    child.kill('SIGTERM');
    rejectReady(new Error('spill_timeout'));
  }, 8_000);
  const finished = new Promise<void>((done, reject) => {
    child.on('error', () => {
      clearTimeout(timer);
      rejectReady(new Error('spill_process_failed'));
      reject(new Error('spill_process_failed'));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const error = new Error(sqlstate ? `database_sqlstate_${sqlstate}` : 'spill_not_established');
      if (!held) rejectReady(error);
      if (code === 0) done();
      else reject(error);
    });
  });
  void finished.catch(() => undefined);
  child.stderr.on('data', (chunk: Buffer) => {
    diagnostic = (diagnostic + chunk.toString('utf8')).slice(-4096);
    sqlstate = sqlStateFromDiagnostic(diagnostic) ?? sqlstate;
  });
  await new Promise<void>((done, reject) => {
    rejectReady = reject;
    let output = '';
    let received = 0;
    let sessions = 0;
    child.stdout.on('data', (chunk: Buffer) => {
      received += chunk.length;
      output += chunk.toString('utf8');
      if (received > 4096) {
        child.kill('SIGTERM');
        reject(new Error('spill_output_limit'));
        return;
      }
      const lines = output.split('\n');
      output = lines.pop() ?? '';
      try {
        for (const line of lines) {
          if (line === 'U1_HELD' && sessions === 2 && !held) {
            held = true;
            done();
          } else {
            const entry = parseSpillObservation(line, { role, cycle });
            if (
              held ||
              sessions >= 2 ||
              entry.id !== 'R05_SPILL_SESSION' ||
              entry.phase !== (sessions === 0 ? 'local' : 'held')
            )
              throw new Error('spill_observation_invalid');
            observations.push(entry);
            sessions += 1;
          }
        }
      } catch {
        child.kill('SIGTERM');
        reject(new Error('spill_observation_invalid'));
      }
    });
    child.stdin.write(
      `BEGIN; SET LOCAL work_mem='64kB'; ${spillSessionQuery('local')}
      DECLARE u1_spill CURSOR WITH HOLD FOR ${spillQuery}; COMMIT;
      ${spillSessionQuery('held')}\n\\echo U1_HELD\n`,
    );
  });
  return async () => {
    child.stdin.end('CLOSE u1_spill;\n');
    await finished;
  };
}
