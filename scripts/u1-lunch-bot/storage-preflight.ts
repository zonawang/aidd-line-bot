import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statfsSync } from 'node:fs';
import {
  command,
  commandText,
  CommandFailure,
  dockerInvocationEnvironment,
  hostIdentity,
  spawnErrorCode,
} from './storage-host.ts';
import {
  containerName,
  guestCreateArgs,
  ownedContainer,
  record,
  requireCondition,
  storage,
  verifyContext,
  verifyGuestConfiguration,
  verifyPullSpace,
} from './storage-policy.ts';

function emit(result: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function docker(args: string[], timeoutMs = 20_000): string {
  const context = command(storage.docker, ['context', 'inspect', 'desktop-linux']);
  verifyContext(JSON.parse(context) as unknown);
  return command(storage.docker, ['--context', 'desktop-linux', ...args], timeoutMs);
}

function inspect(containerId: string): unknown {
  return JSON.parse(docker(['container', 'inspect', containerId])) as unknown;
}

function cleanupContainer(containerId: string): void {
  const metadata = ownedContainer(inspect(containerId), containerId);
  if (record(metadata['State'])['Running'] === true) docker(['stop', '--time', '5', containerId]);
  ownedContainer(inspect(containerId), containerId);
  docker(['rm', containerId]);
  requireCondition(
    docker(['ps', '-aq', '--filter', `name=^/${containerName}$`]).trim() === '',
    'container_cleanup_incomplete',
  );
  emit({ check: 'container_cleanup', status: 'passed' });
}

function reconcileCreate(): void {
  const found = docker(['ps', '-aq', '--no-trunc', '--filter', `name=^/${containerName}$`]).trim();
  if (found === '') {
    emit({
      check: 'create_reconciliation',
      status: 'no_registered_container_at_check',
      lateDaemonCompletionExcluded: false,
    });
    return;
  }
  requireCondition(/^[a-f0-9]{64}$/.test(found), 'ambiguous_create_reconciliation');
  const metadata = ownedContainer(inspect(found), found);
  requireCondition(
    record(metadata['Config'])['Image'] === storage.image,
    'reconciliation_image_mismatch',
  );
  cleanupContainer(found);
}

function main(): void {
  const mode = process.argv[2];
  requireCondition(
    process.argv.length === 3 && (mode === 'host' || mode === 'guest'),
    'invalid_preflight_mode',
  );
  emit({ check: 'host_identity', status: 'passed', ...hostIdentity() });
  const hash = createHash('sha256').update(readFileSync(storage.compose)).digest('hex');
  requireCondition(hash === storage.composeHash, 'compose_hash_mismatch');
  requireCondition(
    command(storage.compose, ['version', '--short']).trim() === '2.40.3',
    'compose_version_mismatch',
  );
  emit({ check: 'compose_pin', status: 'passed' });
  if (mode === 'host') return;
  const filesystem = statfsSync(storage.stage);
  const availableBytes = filesystem.bsize * filesystem.bavail;
  verifyPullSpace(availableBytes);
  emit({
    check: 'host_pull_budget',
    status: 'passed',
    availableBytes,
    pullBudgetBytes: storage.pullBudgetBytes,
    reserveBytes: storage.hostReserveBytes,
  });
  const active = docker([
    'ps',
    '-aq',
    '--filter',
    'label=com.u1-lunch-bot.owner=u1-lunch-bot',
  ]).trim();
  requireCondition(active === '', 'another_owned_run_present');
  requireCondition(
    docker(['ps', '-aq', '--filter', `name=^/${containerName}$`]).trim() === '',
    'container_name_collision',
  );
  emit({ check: 'pinned_pg_pull', status: 'started', timeoutMs: 600_000 });
  docker(['pull', '--platform', 'linux/arm64/v8', storage.image], 600_000);
  emit({ check: 'pinned_pg_pull', status: 'passed' });
  let created: string;
  try {
    created = docker(guestCreateArgs(), 60_000).trim();
    requireCondition(/^[a-f0-9]{64}$/.test(created), 'invalid_created_id');
  } catch (error) {
    reconcileCreate();
    throw error;
  }
  try {
    verifyGuestConfiguration(inspect(created), created);
    const result = spawnSync(
      storage.docker,
      ['--context', 'desktop-linux', 'start', '-ai', created],
      {
        input: readFileSync(new URL('./guest-storage-probe.sh', import.meta.url)),
        encoding: 'utf8',
        timeout: 180_000,
        maxBuffer: 65_536,
        env: dockerInvocationEnvironment(),
      },
    );
    const lines = commandText(result.stdout)
      .trim()
      .split('\n')
      .filter((line) => /^STORAGE_[A-Z_]+=[a-z0-9_= ]+$/.test(line));
    emit({
      check: 'guest_storage',
      exitCode: result.status,
      timedOut: spawnErrorCode(result.error) === 'ETIMEDOUT',
      evidence: lines,
    });
    if (result.error || result.status !== 0) {
      emit(
        new CommandFailure(
          result.status,
          result.stderr,
          spawnErrorCode(result.error),
        ).safeDiagnostic(),
      );
    }
    requireCondition(
      !result.error &&
        result.status === 0 &&
        lines.includes('STORAGE_PASS=guest_quota_and_file_fsync_only'),
      'guest_storage_failed',
    );
    emit({ check: 'host_identity_after_guest', status: 'passed', ...hostIdentity() });
  } finally {
    cleanupContainer(created);
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : '';
  emit({
    status: 'blocked',
    code: /^[a-z_]+$/.test(message) ? message : 'storage_preflight_failed',
  });
  if (error instanceof CommandFailure) emit(error.safeDiagnostic());
  process.exitCode = 1;
}
