import { spawn, type ChildProcess } from 'node:child_process';
import {
  cleanupDatabaseResources,
  bootstrapEvidence,
  databaseAdmission,
  startDatabase,
  workspace,
} from './database-runtime.ts';
import { requireCondition } from './storage-policy.ts';
import { CommandFailure } from './storage-host.ts';
import { safeCheckpoint } from '../../tests/u1-lunch-bot/fixtures/database-checkpoints.ts';
import { safeSpillObservation } from '../../tests/u1-lunch-bot/fixtures/spill-observations.ts';
import { sql } from './database-runtime.ts';

let admitted = false;
let failed = false;
let cancelled = false;
let activeTest: ChildProcess | undefined;
const cancel = () => {
  cancelled = true;
  activeTest?.kill('SIGTERM');
};
process.once('SIGINT', cancel);
process.once('SIGTERM', cancel);
try {
  requireCondition(
    process.argv.length === 3 && (process.argv[2] === 'verify' || process.argv[2] === 'resume-r05'),
    'database_phase_arguments',
  );
  const mode = process.argv[2];
  const expectedSystemId = databaseAdmission(mode);
  admitted = true;
  requireCondition(!cancelled, 'database_phase_cancelled');
  await startDatabase();
  if (expectedSystemId)
    requireCondition(
      sql('bootstrap', 'SELECT system_identifier FROM pg_control_system()') === expectedSystemId,
      'database_resume_system_identifier_changed',
    );
  requireCondition(!cancelled, 'database_phase_cancelled');
  const exitCode = await new Promise<number>((done, reject) => {
    const child = spawn(
      process.execPath,
      [
        'node_modules/vitest/vitest.mjs',
        'run',
        '--project',
        'u1-lunch-bot-integration',
        '--reporter',
        './tests/u1-lunch-bot/fixtures/database-reporter.ts',
        ...(mode === 'verify' ? ['tests/u1-lunch-bot/integration/schema.test.ts'] : []),
        'tests/u1-lunch-bot/integration/postgres-runtime.test.ts',
      ],
      {
        cwd: workspace,
        env: {
          ...process.env,
          U1_DATABASE_TEST: 'owned-synthetic',
          U1_DATABASE_MODE: mode,
          ...(expectedSystemId ? { U1_EXPECTED_SYSTEM_ID: expectedSystemId } : {}),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    activeTest = child;
    const timer = setTimeout(() => child.kill('SIGTERM'), 300_000);
    const killer = setTimeout(() => child.kill('SIGKILL'), 310_000);
    let pending = '';
    let observations = 0;
    child.stdout.on('data', (chunk: Buffer) => {
      pending += chunk.toString('utf8');
      if (pending.length > 65_536) {
        child.kill('SIGTERM');
        return;
      }
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) {
        try {
          const item: unknown = JSON.parse(line);
          if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
            const value = item as Record<string, unknown>;
            if (
              value['unit'] === 'u1-lunch-bot' &&
              value['suite'] === 'spill_observation' &&
              observations < 16
            ) {
              const entry = safeSpillObservation(value);
              if (entry) {
                observations += 1;
                process.stdout.write(
                  `${JSON.stringify({ unit: 'u1-lunch-bot', suite: 'spill_observation', ...entry })}\n`,
                );
              }
            }
            if (value['unit'] === 'u1-lunch-bot' && value['suite'] === 'database_checkpoint') {
              const entry = safeCheckpoint(value);
              if (entry)
                process.stdout.write(
                  `${JSON.stringify({ unit: 'u1-lunch-bot', suite: 'database_checkpoint', ...entry })}\n`,
                );
            }
            if (
              value['unit'] === 'u1-lunch-bot' &&
              value['suite'] === 'database_case' &&
              typeof value['caseId'] === 'string' &&
              /^[SR][0-9]{2}$/.test(value['caseId'])
            ) {
              process.stdout.write(
                `${JSON.stringify({
                  unit: 'u1-lunch-bot',
                  suite: 'database_case',
                  caseId: value['caseId'],
                  status: value['status'] === 'pass' ? 'pass' : 'fail',
                })}\n`,
              );
            }
            if (value['unit'] === 'u1-lunch-bot' && value['suite'] === 'vitest') {
              const counts = ['tests', 'passed', 'failed', 'incomplete', 'errors'];
              if (
                counts.every((key) => Number.isSafeInteger(value[key]) && Number(value[key]) >= 0)
              ) {
                process.stdout.write(
                  `${JSON.stringify({
                    unit: 'u1-lunch-bot',
                    suite: 'vitest',
                    status: value['status'] === 'pass' ? 'pass' : 'fail',
                    ...Object.fromEntries(counts.map((key) => [key, value[key]])),
                  })}\n`,
                );
              }
            }
          }
        } catch {
          continue;
        }
      }
    });
    child.stderr.resume();
    child.on('error', () => {
      clearTimeout(timer);
      clearTimeout(killer);
      reject(new Error('database_test_runner_failed'));
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      clearTimeout(killer);
      done(code ?? 1);
    });
  });
  activeTest = undefined;
  requireCondition(exitCode === 0 && !cancelled, 'database_integration_failed');
  process.stdout.write('{"check":"database_integration","status":"passed"}\n');
} catch (error) {
  failed = true;
  if (error instanceof CommandFailure)
    process.stdout.write(`${JSON.stringify(error.safeDiagnostic())}\n`);
  if (admitted)
    process.stdout.write(
      `${JSON.stringify({ check: 'database_bootstrap_last_phase', ...bootstrapEvidence() })}\n`,
    );
  const code =
    error instanceof Error && /^database_[a-z_]+$/.test(error.message)
      ? error.message
      : 'database_phase_failed';
  process.stdout.write(`${JSON.stringify({ check: 'database_phase', status: 'failed', code })}\n`);
} finally {
  if (admitted) {
    try {
      cleanupDatabaseResources();
      process.stdout.write(
        '{"check":"database_container_network_cleanup","status":"passed","pgdata":"retained_no_reset_no_remount"}\n',
      );
    } catch {
      failed = true;
      process.stdout.write(
        '{"check":"database_container_network_cleanup","status":"unknown","pgdata":"retained"}\n',
      );
    }
  }
  process.exitCode = failed ? 1 : 0;
  process.removeListener('SIGINT', cancel);
  process.removeListener('SIGTERM', cancel);
}
