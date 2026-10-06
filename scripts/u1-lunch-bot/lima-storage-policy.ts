export const limaStorage = Object.freeze({
  run: '238f4c91-5090-433c-9b85-84e0484ae4c0',
  home: '/private/tmp/u1-lima-238f4c915090',
  instance: 'storage',
  disk: 'u1-238f4c91',
  bytes: 2_147_483_648,
  osBytes: 12_884_901_888,
  budgetBytes: 21_474_836_480,
  binary: '/private/tmp/u1-lunch-bot-lima-2.2.1/install/bin/limactl',
  archive: '/private/tmp/u1-lunch-bot-lima-2.2.1/lima-2.2.1-Darwin-arm64.tar.gz',
  archiveBytes: 38_328_082,
  archiveHash: '9e9eacce88f37e185c346bad73aa6136f738d8cdf8c3bb23cd42b071824bc66e',
  imageUrl:
    'https://cloud-images.ubuntu.com/releases/resolute/release-20260927/ubuntu-26.04-server-cloudimg-arm64.img',
  imageBytes: 945_530_880,
  imageHash: '63a93bd5a8d76e33b15ceb5daa3657bd79be804748051ab178e643b0f5da22e7',
});

export function demand(condition: unknown, category: string): asserts condition {
  if (!condition) throw new Error(category);
}

export function requireSpace(available: number): void {
  demand(Number.isSafeInteger(available) && available >= limaStorage.budgetBytes, 'host_space');
}

export function requireHome(path: string): void {
  demand(path === limaStorage.home, 'home_identity');
}

export function requireFreshHome(path: string, exists: boolean): void {
  requireHome(path);
  demand(!exists, 'home_exists');
}

export function childEnvironment(): NodeJS.ProcessEnv {
  return {
    PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
    HOME: `${limaStorage.home}/childhome`,
    LIMA_HOME: limaStorage.home,
    TMPDIR: `${limaStorage.home}/tmp`,
    LC_ALL: 'C',
  };
}

export function asRecord(value: unknown): Record<string, unknown> {
  demand(value !== null && typeof value === 'object' && !Array.isArray(value), 'metadata');
  return value as Record<string, unknown>;
}

export type PreflightPhase =
  | 'admission'
  | 'download'
  | 'validate'
  | 'disk'
  | 'create'
  | 'start'
  | 'probe'
  | 'stop'
  | 'format_lock';

export class PreflightFailure extends Error {
  readonly phase: PreflightPhase;
  readonly category: 'command_failed' | 'evidence_rejected';

  constructor(phase: PreflightPhase, category: 'command_failed' | 'evidence_rejected') {
    super('lima_preflight_failed');
    this.phase = phase;
    this.category = category;
  }
}

export async function atPhase<Result>(
  phase: PreflightPhase,
  operation: () => Promise<Result>,
): Promise<Result> {
  try {
    return await operation();
  } catch (error) {
    throw new PreflightFailure(
      phase,
      error instanceof Error && error.message === 'bounded_command_failed'
        ? 'command_failed'
        : 'evidence_rejected',
    );
  }
}

export function failureReport(error: unknown): Record<string, unknown> {
  return {
    check: 'lima_storage_only',
    status: 'failed',
    phase: error instanceof PreflightFailure ? error.phase : 'admission',
    category: error instanceof PreflightFailure ? error.category : 'evidence_rejected',
    resources: 'retained_inspect_before_any_restart',
    pgVerified: false,
  };
}

export function cidataLabel(descriptor: Buffer): string {
  demand(
    descriptor.length === 2048 &&
      descriptor[0] === 1 &&
      descriptor.subarray(1, 6).toString('ascii') === 'CD001' &&
      descriptor[6] === 1,
    'cidata_descriptor',
  );
  const label = descriptor.subarray(40, 72).toString('latin1').trim();
  demand(/^[A-Za-z0-9_-]{1,32}$/.test(label), 'cidata_label');
  return label;
}

export function validateDisk(value: unknown, attached: boolean): void {
  const disk = asRecord(value);
  demand(
    disk['name'] === limaStorage.disk &&
      disk['size'] === limaStorage.bytes &&
      disk['format'] === 'raw' &&
      disk['dir'] === `${limaStorage.home}/_disks/${limaStorage.disk}` &&
      disk['instance'] === (attached ? limaStorage.instance : '') &&
      disk['instanceDir'] === (attached ? `${limaStorage.home}/${limaStorage.instance}` : ''),
    'disk_identity',
  );
}

export function validateInstance(text: string): string {
  const fields = text.trim().split('|');
  demand(
    fields.length === 8 &&
      fields.slice(0, 7).join('|') ===
        `storage|${limaStorage.home}/storage|vz|aarch64|2|3221225472|12884901888` &&
      ['Running', 'Stopped', 'Broken'].includes(fields[7] ?? ''),
    'instance_identity',
  );
  return fields[7] ?? '';
}

export function parseProbe(text: string): Record<string, unknown> {
  demand(Buffer.byteLength(text) <= 1024, 'probe_evidence');
  const value = asRecord(JSON.parse(text) as unknown);
  const keys = [
    'status',
    'deviceBytes',
    'partitionBytes',
    'filesystemBytes',
    'writtenBytes',
    'uid',
    'gid',
    'files',
    'enospc',
    'fsync',
    'rename',
    'cleanup',
  ];
  demand(Object.keys(value).sort().join() === keys.sort().join(), 'probe_evidence');
  demand(
    value['status'] === 'passed' &&
      value['deviceBytes'] === limaStorage.bytes &&
      value['uid'] === 999 &&
      value['gid'] === 999 &&
      value['files'] === 2 &&
      ['enospc', 'fsync', 'rename', 'cleanup'].every((key) => value[key] === true),
    'probe_evidence',
  );
  for (const key of ['partitionBytes', 'filesystemBytes', 'writtenBytes']) {
    demand(
      Number.isSafeInteger(value[key]) &&
        Number(value[key]) > 0 &&
        Number(value[key]) < limaStorage.bytes,
      'probe_capacity',
    );
  }
  demand(
    Number(value['filesystemBytes']) <= Number(value['partitionBytes']) &&
      Number(value['writtenBytes']) >= 536_870_912 &&
      Number(value['writtenBytes']) <= Number(value['filesystemBytes']),
    'probe_capacity',
  );
  return value;
}
