import { spawnSync } from 'node:child_process';
import { accessSync, constants, lstatSync, realpathSync, statfsSync } from 'node:fs';
import {
  imagePath,
  mountedDevice,
  mountPath,
  requireCondition,
  storage,
} from './storage-policy.ts';

export type CommandFailureCategory =
  | 'timeout'
  | 'network_dns'
  | 'network_tls'
  | 'network_connection'
  | 'authentication'
  | 'rate_limit'
  | 'manifest_not_found'
  | 'credential_helper'
  | 'permission_denied'
  | 'unknown';

export function classifyCommandFailure(
  stderr: unknown,
  errorCode: unknown,
): CommandFailureCategory {
  if (errorCode === 'ETIMEDOUT') return 'timeout';
  const diagnostic = commandText(stderr);
  const matches = new Set<CommandFailureCategory>();
  const patterns: readonly [CommandFailureCategory, RegExp][] = [
    ['timeout', /\b(?:i\/o timeout|context deadline exceeded|connection timed out)\b/i],
    [
      'network_dns',
      /\b(?:no such host|temporary failure in name resolution|getaddrinfo ENOTFOUND|EAI_AGAIN)\b/i,
    ],
    [
      'network_tls',
      /\b(?:x509:|tls handshake|certificate signed by unknown authority|certificate has expired|certificate verify failed)/i,
    ],
    [
      'network_connection',
      /\b(?:connection refused|connection reset by peer|network is unreachable|no route to host)\b/i,
    ],
    [
      'authentication',
      /\b(?:unauthorized: authentication required|authentication required|incorrect username or password|HTTP(?:\/\d(?:\.\d)?)? 401)\b/i,
    ],
    [
      'rate_limit',
      /\b(?:toomanyrequests|too many requests|pull rate limit|HTTP(?:\/\d(?:\.\d)?)? 429)\b/i,
    ],
    ['manifest_not_found', /\b(?:manifest unknown|manifest not found|no matching manifest)\b/i],
    [
      'credential_helper',
      /\b(?:error getting credentials|error saving credentials|docker-credential-[a-z0-9_-]+[^\n]*executable file not found)\b/i,
    ],
    ['permission_denied', /\b(?:permission denied|operation not permitted)\b/i],
  ];
  for (const [category, pattern] of patterns) {
    if (pattern.test(diagnostic)) matches.add(category);
  }
  if (errorCode === 'EACCES' || errorCode === 'EPERM') matches.add('permission_denied');
  if (errorCode === 'ENOTFOUND' || errorCode === 'EAI_AGAIN') matches.add('network_dns');
  if (errorCode === 'ECONNREFUSED' || errorCode === 'ECONNRESET' || errorCode === 'ENETUNREACH')
    matches.add('network_connection');
  return matches.size === 1 ? ([...matches][0] ?? 'unknown') : 'unknown';
}

export function spawnErrorCode(error: unknown): unknown {
  return error !== null && typeof error === 'object' && 'code' in error ? error.code : undefined;
}

export class CommandFailure extends Error {
  exitCode: number | null;
  timedOut: boolean;
  permissionDenied: boolean;
  category: CommandFailureCategory;

  constructor(exitCode: number | null, stderr: unknown, errorCode: unknown) {
    super('bounded_command_failed');
    this.exitCode = exitCode;
    this.timedOut = errorCode === 'ETIMEDOUT';
    this.category = classifyCommandFailure(stderr, errorCode);
    this.permissionDenied = this.category === 'permission_denied';
  }

  safeDiagnostic(): Record<string, unknown> {
    return {
      check: 'command_failure',
      exitCode: this.exitCode,
      timedOut: this.timedOut,
      permissionDenied: this.permissionDenied,
      category: this.category,
    };
  }
}

export function commandText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export const dockerResourcesBin = '/Applications/Docker.app/Contents/Resources/bin';
export const dockerCredentialHelper = `${dockerResourcesBin}/docker-credential-desktop`;

export function dockerChildEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const existingPath = environment['PATH'];
  return {
    ...environment,
    PATH: existingPath ? `${dockerResourcesBin}:${existingPath}` : dockerResourcesBin,
  };
}

export function dockerInvocationEnvironment(): NodeJS.ProcessEnv {
  try {
    requireCondition(lstatSync(dockerCredentialHelper).isFile(), 'docker_helper_unavailable');
    accessSync(dockerCredentialHelper, constants.X_OK);
  } catch {
    throw new Error('docker_credential_helper_unavailable');
  }
  return dockerChildEnvironment(process.env);
}

export function command(
  binary: string,
  args: string[],
  timeoutMs = 20_000,
  input?: string,
): string {
  const result = spawnSync(binary, args, {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 1_048_576,
    ...(binary === storage.docker ? { env: dockerInvocationEnvironment() } : {}),
    ...(input === undefined ? {} : { input }),
  });
  if (result.error || result.status !== 0) {
    throw new CommandFailure(result.status, result.stderr, spawnErrorCode(result.error));
  }
  return commandText(result.stdout);
}

export function hostIdentity(): {
  device: string;
  filesystemBytes: number;
  availableBytes: number;
} {
  requireCondition(
    process.platform === 'darwin' && typeof process.getuid === 'function',
    'unsupported_host',
  );
  const owner = process.getuid();
  const stage = lstatSync(storage.stage);
  const image = lstatSync(imagePath);
  const mount = lstatSync(mountPath);
  requireCondition(
    stage.isDirectory() && stage.uid === owner && (stage.mode & 0o777) === 0o700,
    'private_stage_mismatch',
  );
  requireCondition(
    image.isFile() && image.uid === owner && image.size === storage.bytes && image.nlink === 1,
    'image_file_mismatch',
  );
  requireCondition(mount.isDirectory() && stage.dev !== mount.dev, 'not_a_mounted_filesystem');
  requireCondition(
    realpathSync(storage.stage) === storage.stage &&
      realpathSync(imagePath) === imagePath &&
      realpathSync(mountPath) === mountPath,
    'noncanonical_storage',
  );
  const plist = command('/usr/bin/hdiutil', ['info', '-plist']);
  const json = command('/usr/bin/plutil', ['-convert', 'json', '-o', '-', '-'], 20_000, plist);
  const device = mountedDevice(JSON.parse(json) as unknown, owner);
  const filesystem = statfsSync(mountPath);
  const filesystemBytes = filesystem.bsize * filesystem.blocks;
  requireCondition(filesystemBytes === storage.bytes, 'host_filesystem_capacity');
  return { device, filesystemBytes, availableBytes: filesystem.bsize * filesystem.bavail };
}
