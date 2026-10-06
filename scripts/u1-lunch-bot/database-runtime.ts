import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  command,
  commandText,
  dockerInvocationEnvironment,
  hostIdentity,
  CommandFailure,
  spawnErrorCode,
} from './storage-host.ts';
import { mountPath, record, requireCondition, storage, verifyContext } from './storage-policy.ts';
import { validateResumeFiles } from './database-resume-policy.ts';
import {
  parseBootstrapStatus,
  readBootstrapStatus,
  writeBootstrapStatus,
  type BootstrapEvidence,
} from './database-bootstrap-evidence.ts';

export const databaseName = `u1-lunch-bot-pg-${storage.run}`;
export const networkName = `u1-lunch-bot-net-${storage.run}`;
const resumeCheckName = `${databaseName}-resume-check`;
export const evidencePath = `${storage.stage}/evidence`;
export const workspace = resolve(import.meta.dirname, '../..');
export type DatabaseRole = 'bootstrap' | 'line_event_app' | 'privacy_app';
export type TlsMode = 'valid' | 'wrong_ca' | 'wrong_name' | 'plaintext';
let resumeOnly = false;

export function docker(args: string[], input?: string, timeoutMs = 20_000): string {
  return command(storage.docker, ['--context', 'desktop-linux', ...args], timeoutMs, input);
}

function labelsMatch(value: unknown): void {
  const labels = record(value);
  requireCondition(
    labels['com.u1-lunch-bot.owner'] === 'u1-lunch-bot' &&
      labels['com.u1-lunch-bot.run'] === storage.run,
    'database_resource_ownership',
  );
}

export function verifyDatabaseContainer(): Record<string, unknown> {
  const value: unknown = JSON.parse(docker(['inspect', databaseName]));
  requireCondition(Array.isArray(value) && value.length === 1, 'database_inspect');
  const entry = record(value[0]);
  const config = record(entry['Config']);
  const host = record(entry['HostConfig']);
  labelsMatch(config['Labels']);
  requireCondition(
    entry['Name'] === `/${databaseName}` &&
      config['Image'] === storage.image &&
      config['User'] === '999:999' &&
      host['ReadonlyRootfs'] === true &&
      host['Privileged'] === false &&
      host['Memory'] === 1_073_741_824 &&
      host['MemorySwap'] === 1_073_741_824 &&
      host['NanoCpus'] === 1_000_000_000 &&
      host['PidsLimit'] === 64 &&
      JSON.stringify(host['CapDrop']) === '["ALL"]' &&
      JSON.stringify(host['SecurityOpt']) === '["no-new-privileges:true"]' &&
      record(host['LogConfig'])['Type'] === 'none' &&
      Object.keys(record(host['PortBindings'] ?? {})).length === 0,
    'database_hardening',
  );
  const mounts = entry['Mounts'];
  requireCondition(Array.isArray(mounts), 'database_mounts');
  const binds = mounts.map(record).filter((mount) => mount['Type'] === 'bind');
  const expected = new Map([
    ['/var/lib/postgresql/data', [mountPath, true]],
    ['/opt/u1/db', [`${workspace}/db`, false]],
    ['/opt/u1/infra/postgres', [`${workspace}/infra/postgres`, false]],
    ['/u1-evidence', [evidencePath, true]],
  ]);
  requireCondition(binds.length === expected.size, 'database_bind_count');
  for (const bind of binds) {
    const pair = expected.get(String(bind['Destination']));
    requireCondition(pair && bind['Source'] === pair[0] && bind['RW'] === pair[1], 'database_bind');
  }
  const networks = record(record(entry['NetworkSettings'])['Networks']);
  requireCondition(Object.keys(networks).join() === networkName, 'database_network');
  return entry;
}

function compose(args: string[]): string {
  const result = spawnSync(
    storage.compose,
    [
      '--context',
      'desktop-linux',
      '--project-directory',
      workspace,
      '-f',
      `${workspace}/compose.yaml`,
      ...args,
    ],
    {
      cwd: workspace,
      env: { ...dockerInvocationEnvironment(), U1_RESUME_ONLY: String(resumeOnly) },
      encoding: 'utf8',
      timeout: 60_000,
      maxBuffer: 1_048_576,
    },
  );
  if (result.error || result.status !== 0)
    throw new CommandFailure(result.status, result.stderr, spawnErrorCode(result.error));
  return commandText(result.stdout).trim();
}

export function databaseAdmission(mode: 'verify' | 'resume-r05' = 'verify'): string | undefined {
  verifyContext(JSON.parse(docker(['context', 'inspect', 'desktop-linux'])) as unknown);
  const identity = hostIdentity();
  requireCondition(identity.availableBytes >= 1_073_741_824, 'database_free_space_insufficient');
  requireCondition(
    createHash('sha256').update(readFileSync(storage.compose)).digest('hex') ===
      storage.composeHash,
    'compose_pin_mismatch',
  );
  requireCondition(
    docker(['ps', '-aq', '--filter', `name=^/${databaseName}$`]).trim() === '',
    'database_container_collision',
  );
  requireCondition(
    docker(['network', 'ls', '-q', '--filter', `name=^${networkName}$`]).trim() === '',
    'database_network_collision',
  );
  if (mode === 'resume-r05') {
    requireCondition(typeof process.getuid === 'function', 'database_resume_host');
    validateResumeFiles(mountPath, evidencePath, workspace, process.getuid());
    resumeOnly = true;
    requireCondition(
      docker(['ps', '-aq', '--filter', `name=^/${resumeCheckName}$`]).trim() === '',
      'database_resume_check_collision',
    );
    let systemId: string;
    try {
      systemId = docker(
        [
          'run',
          '--rm',
          '--name',
          resumeCheckName,
          '--label',
          'com.u1-lunch-bot.owner=u1-lunch-bot',
          '--label',
          `com.u1-lunch-bot.run=${storage.run}`,
          '--platform',
          'linux/arm64/v8',
          '--pull',
          'never',
          '--user',
          '999:999',
          '--network',
          'none',
          '--cpus',
          '1',
          '--memory',
          '1073741824',
          '--memory-swap',
          '1073741824',
          '--pids-limit',
          '64',
          '--cap-drop',
          'ALL',
          '--security-opt',
          'no-new-privileges:true',
          '--read-only',
          '--log-driver',
          'none',
          '--ulimit',
          'core=0',
          '--mount',
          `type=bind,source=${mountPath},target=/var/lib/postgresql/data,readonly`,
          '--mount',
          `type=bind,source=${workspace}/db,target=/opt/u1/db,readonly`,
          '--mount',
          `type=bind,source=${workspace}/infra/postgres,target=/opt/u1/infra/postgres,readonly`,
          '--entrypoint',
          '/bin/bash',
          storage.image,
          '/opt/u1/infra/postgres/resume-check.sh',
        ],
        undefined,
        20_000,
      ).trim();
    } finally {
      if (docker(['ps', '-aq', '--filter', `name=^/${resumeCheckName}$`]).trim()) {
        const inspected: unknown = JSON.parse(docker(['inspect', resumeCheckName]));
        requireCondition(
          Array.isArray(inspected) && inspected.length === 1,
          'database_resume_check_inspect',
        );
        const entry = record(inspected[0]);
        const config = record(entry['Config']);
        labelsMatch(config['Labels']);
        const host = record(entry['HostConfig']);
        const mounts = entry['Mounts'];
        requireCondition(
          entry['Name'] === `/${resumeCheckName}` &&
            config['Image'] === storage.image &&
            config['User'] === '999:999' &&
            host['ReadonlyRootfs'] === true &&
            host['NetworkMode'] === 'none' &&
            Array.isArray(mounts) &&
            mounts.every((mount: unknown) => record(mount)['RW'] === false),
          'database_resume_check_ownership',
        );
        docker(['stop', '--time', '5', resumeCheckName]);
        if (docker(['ps', '-aq', '--filter', `name=^/${resumeCheckName}$`]).trim())
          docker(['rm', resumeCheckName]);
      }
    }
    requireCondition(/^\d{1,20}$/.test(systemId), 'database_resume_system_identifier');
    process.stdout.write(
      `${JSON.stringify({ check: 'database_resume_admission', status: 'passed', priorBootstrap: bootstrapEvidence(), ...identity })}\n`,
    );
    return systemId;
  }
  requireCondition(
    !existsSync(`${mountPath}/pgdata`) && readdirSync(mountPath).length === 0,
    'database_already_initialized_no_reset_allowed',
  );
  docker(['image', 'inspect', storage.image]);
  requireCondition(!existsSync(evidencePath), 'database_evidence_collision');
  mkdirSync(evidencePath, { mode: 0o700 });
  writeFileSync(
    `${evidencePath}/bootstrap.status`,
    'evidence_channel pending runtime_check none\n',
    { mode: 0o600, flag: 'wx' },
  );
  process.stdout.write(`${JSON.stringify({ check: 'database_host_admission', ...identity })}\n`);
}

export function bootstrapEvidence(): BootstrapEvidence {
  try {
    return parseBootstrapStatus(readBootstrapStatus(evidencePath, process.getuid?.() ?? -1));
  } catch {
    return {
      phase: 'evidence_channel',
      status: 'unknown',
      category: 'runtime_check',
      sqlstate: 'none',
    };
  }
}

export async function startDatabase(): Promise<void> {
  writeBootstrapStatus(evidencePath, 'pending', process.getuid?.() ?? -1);
  compose(['up', '-d', '--no-build', '--pull', 'never', 'postgres']);
  verifyDatabaseContainer();
  const networks: unknown = JSON.parse(docker(['network', 'inspect', networkName]));
  requireCondition(Array.isArray(networks) && networks.length === 1, 'database_network_count');
  const network = record(networks[0]);
  labelsMatch(network['Labels']);
  requireCondition(network['Internal'] === true, 'database_network_not_private');
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (record(verifyDatabaseContainer()['State'])['Running'] !== true) {
      process.stdout.write(
        `${JSON.stringify({ check: 'database_bootstrap', ...bootstrapEvidence() })}\n`,
      );
      throw new Error('database_bootstrap_failed');
    }
    try {
      requireCondition(sql('privacy_app', 'SELECT 1') === '1', 'database_not_ready');
      writeBootstrapStatus(evidencePath, 'passed', process.getuid?.() ?? -1);
      process.stdout.write(
        `${JSON.stringify({ check: 'database_bootstrap', status: 'passed', phase: 'tls_role_connected' })}\n`,
      );
      return;
    } catch {
      await new Promise((done) => setTimeout(done, 500));
    }
  }
  process.stdout.write(
    `${JSON.stringify({ check: 'database_bootstrap', ...bootstrapEvidence() })}\n`,
  );
  throw new Error('database_start_timeout');
}

export function sql(role: DatabaseRole, statement: string, mode: TlsMode = 'valid'): string {
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
      '/opt/u1/infra/postgres/client.sh',
      role,
      mode,
    ],
    {
      input: `${statement}\n`,
      env: dockerInvocationEnvironment(),
      encoding: 'utf8',
      timeout: 10_000,
      maxBuffer: 1_048_576,
    },
  );
  if (result.error || result.status !== 0) {
    const state =
      mode === 'valid'
        ? commandText(result.stderr).match(/(?:ERROR|FATAL):\s+([0-9A-Z]{5})\b/)?.[1]
        : undefined;
    throw new Error(state ? `database_sqlstate_${state}` : 'database_connection_rejected');
  }
  return commandText(result.stdout).trim();
}

export function stopDatabaseContainer(): void {
  verifyDatabaseContainer();
  docker(['stop', '--time', '15', databaseName], undefined, 25_000);
  const entry = verifyDatabaseContainer();
  const state = record(entry['State']);
  requireCondition(
    state['Running'] === false && state['ExitCode'] === 0,
    'database_shutdown_unclean',
  );
  docker(['rm', databaseName]);
}

export async function restartDatabase(): Promise<void> {
  stopDatabaseContainer();
  await startDatabase();
}

export async function rejectedBootstrap(
  fault: 'uid' | 'major' | 'catalog' | 'symlink',
): Promise<void> {
  stopDatabaseContainer();
  try {
    if (fault === 'uid') {
      const result = compose([
        'run',
        '--rm',
        '--no-deps',
        '-T',
        '--name',
        databaseName,
        '--user',
        '1000:1000',
        '--entrypoint',
        '/bin/bash',
        'postgres',
        '-c',
        'set +e; output=$(/bin/bash /opt/u1/infra/postgres/bootstrap.sh 2>/dev/null); result=$?; [[ "$result" == 41 && "$output" == U1_BOOTSTRAP_FAIL=identity ]] && printf U1_NEGATIVE_PASS=uid',
      ]);
      requireCondition(result === 'U1_NEGATIVE_PASS=uid', 'database_uid_negative_failed');
    } else {
      const result = compose([
        'run',
        '--rm',
        '--no-deps',
        '-T',
        '--name',
        databaseName,
        '--entrypoint',
        '/bin/bash',
        'postgres',
        '/opt/u1/infra/postgres/negative-bootstrap.sh',
        fault,
      ]);
      requireCondition(result === `U1_NEGATIVE_PASS=${fault}`, 'database_negative_failed');
    }
    process.stdout.write(
      `${JSON.stringify({ unit: 'u1-lunch-bot', suite: 'database_bootstrap_negative', fault, status: 'pass' })}\n`,
    );
  } finally {
    await startDatabase();
  }
}

export function cleanupDatabaseResources(): void {
  if (docker(['ps', '-aq', '--filter', `name=^/${databaseName}$`]).trim()) {
    verifyDatabaseContainer();
    docker(['stop', '--time', '15', databaseName], undefined, 25_000);
    verifyDatabaseContainer();
    docker(['rm', databaseName]);
  }
  if (docker(['network', 'ls', '-q', '--filter', `name=^${networkName}$`]).trim()) {
    const networks: unknown = JSON.parse(docker(['network', 'inspect', networkName]));
    requireCondition(Array.isArray(networks) && networks.length === 1, 'network_cleanup_count');
    const network = record(networks[0]);
    labelsMatch(network['Labels']);
    requireCondition(
      Object.keys(record(network['Containers'] ?? {})).length === 0,
      'network_not_empty',
    );
    docker(['network', 'rm', networkName]);
  }
}
