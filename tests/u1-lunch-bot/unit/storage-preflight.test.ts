import { accessSync, constants, lstatSync } from 'node:fs';
import type { Stats } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  classifyCommandFailure,
  commandText,
  CommandFailure,
  dockerChildEnvironment,
  dockerCredentialHelper,
  dockerInvocationEnvironment,
  dockerResourcesBin,
  spawnErrorCode,
} from '../../../scripts/u1-lunch-bot/storage-host.ts';
import {
  containerName,
  guestCreateArgs,
  imagePath,
  mountedDevice,
  mountPath,
  ownedContainer,
  storage,
  verifyContext,
  verifyGuestConfiguration,
  verifyPullSpace,
} from '../../../scripts/u1-lunch-bot/storage-policy.ts';

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  accessSync: vi.fn(),
  lstatSync: vi.fn(),
}));

function hostMetadata() {
  return {
    images: [
      {
        'image-path': imagePath,
        'owner-uid': 502,
        writeable: true,
        blockcount: 4_194_304,
        blocksize: 512,
        'system-entities': [{ 'mount-point': mountPath, 'dev-entry': '/dev/disk12' }],
      },
    ],
  };
}

const containerId = 'a'.repeat(64);

function guestMetadata() {
  return [
    {
      Id: containerId,
      Name: `/${containerName}`,
      Config: {
        Image: storage.image,
        User: 'postgres:postgres',
        Labels: { 'com.u1-lunch-bot.owner': 'u1-lunch-bot', 'com.u1-lunch-bot.run': storage.run },
      },
      HostConfig: {
        Memory: 1_073_741_824,
        MemorySwap: 1_073_741_824,
        NanoCpus: 1_000_000_000,
        ReadonlyRootfs: true,
        Privileged: false,
        NetworkMode: 'none',
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'],
        LogConfig: { Type: 'none' },
      },
      Mounts: [
        { Type: 'bind', Source: mountPath, Destination: '/var/lib/postgresql/data', RW: true },
      ],
    },
  ];
}

describe('STORAGE-PREFLIGHT', () => {
  it('STORAGE-CHILD-ENV-01', () => {
    const parent = Object.freeze({
      PATH: '/usr/bin:/bin',
      SYNTHETIC_SECRET: 'synthetic-only',
      DOCKER_CONFIG: '/synthetic/config',
    });
    const child = dockerChildEnvironment(parent);
    expect(child).not.toBe(parent);
    expect(child['PATH']).toBe('/Applications/Docker.app/Contents/Resources/bin:/usr/bin:/bin');
    expect(parent.PATH).toBe('/usr/bin:/bin');
    expect(Object.keys(child).sort().join(',') === Object.keys(parent).sort().join(',')).toBe(true);
    expect(child['SYNTHETIC_SECRET'] === parent.SYNTHETIC_SECRET).toBe(true);
    expect(child['DOCKER_CONFIG'] === parent.DOCKER_CONFIG).toBe(true);
  });

  it.each([{}, { PATH: '' }, { PATH: undefined }])('STORAGE-CHILD-ENV-02-%#', (parent) => {
    const before = { ...parent };
    const child = dockerChildEnvironment(parent);
    expect(child['PATH']).toBe(dockerResourcesBin);
    expect(child['PATH']?.endsWith(':')).toBe(false);
    expect(Object.hasOwn(parent, 'PATH')).toBe(Object.hasOwn(before, 'PATH'));
    expect(parent.PATH === before.PATH).toBe(true);
  });

  it('STORAGE-CHILD-ENV-03', () => {
    const before = { ...process.env };
    const child = dockerChildEnvironment(process.env);
    expect(child).not.toBe(process.env);
    expect(
      Object.keys(child)
        .filter((key) => key !== 'PATH')
        .every((key) => child[key] === before[key]),
    ).toBe(true);
    child['PATH'] = '/synthetic/changed';
    expect(Object.keys(process.env).length === Object.keys(before).length).toBe(true);
    expect(Object.keys(before).every((key) => process.env[key] === before[key])).toBe(true);
  });

  it.each(['missing', 'non_executable', 'symlink'])('STORAGE-CHILD-ENV-04-%#', (failure) => {
    vi.mocked(lstatSync).mockImplementation(() => {
      if (failure === 'missing') throw new Error('synthetic-filesystem-detail');
      return { isFile: () => failure !== 'symlink' } as Stats;
    });
    vi.mocked(accessSync).mockImplementation(() => {
      throw new Error('synthetic-permission-detail');
    });
    expect(() => dockerInvocationEnvironment()).toThrow('docker_credential_helper_unavailable');
  });

  it('STORAGE-CHILD-ENV-05', () => {
    vi.mocked(lstatSync).mockReturnValue({ isFile: () => true } as Stats);
    vi.mocked(accessSync).mockImplementation(() => undefined);
    const before = { ...process.env };
    const child = dockerInvocationEnvironment();
    expect(lstatSync).toHaveBeenCalledWith(dockerCredentialHelper);
    expect(accessSync).toHaveBeenCalledWith(dockerCredentialHelper, constants.X_OK);
    expect(child['PATH']?.split(':')[0]).toBe(dockerResourcesBin);
    expect(Object.keys(before).every((key) => process.env[key] === before[key])).toBe(true);
  });

  it.each([
    ['i/o timeout', undefined, 'timeout'],
    ['', 'ETIMEDOUT', 'timeout'],
    ['lookup registry: no such host', undefined, 'network_dns'],
    ['', 'ENOTFOUND', 'network_dns'],
    ['x509: certificate signed by unknown authority', undefined, 'network_tls'],
    ['remote error: tls handshake failure', undefined, 'network_tls'],
    ['connection reset by peer', undefined, 'network_connection'],
    ['', 'ECONNREFUSED', 'network_connection'],
    ['unauthorized: authentication required', undefined, 'authentication'],
    ['HTTP/1.1 401', undefined, 'authentication'],
    ['toomanyrequests: pull rate limit exceeded', undefined, 'rate_limit'],
    ['HTTP 429', undefined, 'rate_limit'],
    ['manifest unknown', undefined, 'manifest_not_found'],
    ['no matching manifest for linux/arm64/v8', undefined, 'manifest_not_found'],
    ['error getting credentials - err: exit status 1', undefined, 'credential_helper'],
    ['exec: docker-credential-desktop: executable file not found', undefined, 'credential_helper'],
    ['permission denied', undefined, 'permission_denied'],
    ['', 'EPERM', 'permission_denied'],
  ])('STORAGE-DIAGNOSTIC-01-%#', (stderr, code, expected) => {
    expect(classifyCommandFailure(stderr, code)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    '',
    'failed',
    'HTTP 403',
    'permission',
    'denied: requested access to the resource is denied',
  ])('STORAGE-DIAGNOSTIC-02-%#', (stderr) => {
    expect(classifyCommandFailure(stderr, undefined)).toBe('unknown');
  });

  it('STORAGE-DIAGNOSTIC-03', () => {
    expect(classifyCommandFailure('no such host; permission denied', undefined)).toBe('unknown');
    expect(classifyCommandFailure('error getting credentials: permission denied', undefined)).toBe(
      'unknown',
    );
    expect(classifyCommandFailure('unrecognized error', 'UNRECOGNIZED')).toBe('unknown');
  });

  it.each(['', 'authentication required: '])('STORAGE-DIAGNOSTIC-04-%#', (prefix) => {
    const canary = 'synthetic-diagnostic-canary-742';
    const raw = `${prefix}https://fake-user:${canary}@example.invalid/private?token=${canary} --password=${canary}`;
    const failure = new CommandFailure(1, raw, undefined);
    const encoded = JSON.stringify(failure.safeDiagnostic());
    expect(failure.safeDiagnostic()).toEqual({
      check: 'command_failure',
      exitCode: 1,
      timedOut: false,
      permissionDenied: false,
      category: prefix === '' ? 'unknown' : 'authentication',
    });
    expect(encoded.includes(canary)).toBe(false);
    expect(encoded.includes('https://')).toBe(false);
    expect(encoded.includes('--password')).toBe(false);
    expect(JSON.stringify(failure).includes(canary)).toBe(false);
    expect(failure.message).toBe('bounded_command_failed');
  });

  it('STORAGE-DIAGNOSTIC-05', () => {
    expect(spawnErrorCode(null)).toBeUndefined();
    expect(spawnErrorCode(new Error('synthetic'))).toBeUndefined();
    const failure = new CommandFailure(null, null, spawnErrorCode({ code: 'ETIMEDOUT' }));
    expect(failure.safeDiagnostic()).toEqual({
      check: 'command_failure',
      exitCode: null,
      timedOut: true,
      permissionDenied: false,
      category: 'timeout',
    });
  });

  it('STORAGE-COMMAND-01', () => {
    expect(commandText(null)).toBe('');
    expect(commandText(undefined)).toBe('');
    expect(commandText('synthetic')).toBe('synthetic');
  });
  it('STORAGE-CONTEXT-01', () => {
    expect(() => {
      verifyContext([{ Name: 'desktop-linux', Endpoints: { docker: { Host: storage.endpoint } } }]);
    }).not.toThrow();
  });

  it.each(['tcp://127.0.0.1:2375', 'ssh://host', 'unix:///tmp/other.sock'])(
    'STORAGE-CONTEXT-02-%#',
    (endpoint) => {
      expect(() => {
        verifyContext([{ Name: 'desktop-linux', Endpoints: { docker: { Host: endpoint } } }]);
      }).toThrow('context_endpoint_mismatch');
    },
  );

  it('STORAGE-SPACE-01', () => {
    expect(() => {
      verifyPullSpace(storage.pullBudgetBytes + storage.hostReserveBytes);
    }).not.toThrow();
    expect(() => {
      verifyPullSpace(storage.pullBudgetBytes + storage.hostReserveBytes - 1);
    }).toThrow('host_pull_budget_unavailable');
    expect(() => {
      verifyPullSpace(NaN);
    }).toThrow('host_pull_budget_unavailable');
  });

  it('STORAGE-HOST-01', () => {
    expect(mountedDevice(hostMetadata(), 502)).toBe('/dev/disk12');
  });

  it('STORAGE-HOST-02', () => {
    const metadata = hostMetadata();
    metadata.images.push(...hostMetadata().images);
    expect(() => mountedDevice(metadata, 502)).toThrow('image_identity_mismatch');
    expect(() => mountedDevice({ images: [] }, 502)).toThrow('image_identity_mismatch');
    expect(() => mountedDevice(hostMetadata(), 501)).toThrow('image_owner_or_mode');
  });

  it('STORAGE-HOST-03', () => {
    const metadata = hostMetadata();
    const entry = metadata.images[0];
    expect(entry).toBeDefined();
    if (!entry) throw new Error('fixture_missing');
    entry.blockcount *= 512;
    expect(() => mountedDevice(metadata, 502)).toThrow('image_capacity_mismatch');
  });

  it('STORAGE-HOST-04', () => {
    const metadata = hostMetadata();
    const entity = metadata.images[0]?.['system-entities'][0];
    if (!entity) throw new Error('fixture_missing');
    entity['mount-point'] = '/private/tmp/unrelated';
    expect(() => mountedDevice(metadata, 502)).toThrow('mount_identity_mismatch');
  });

  it.each([null, [], { images: 'wrong' }, { images: [null] }])('STORAGE-HOST-05-%#', (input) => {
    expect(() => mountedDevice(input, 502)).toThrow();
  });

  it('STORAGE-GUEST-01', () => {
    expect(() => {
      verifyGuestConfiguration(guestMetadata(), containerId);
    }).not.toThrow();
    const args = guestCreateArgs();
    expect(args).toContain(storage.image);
    expect(args).toContain('postgres:postgres');
    expect(args).toContain('no-new-privileges');
    expect(args).not.toContain('--privileged');
    expect(args).not.toContain('--publish');
    expect(args.filter((value) => value.startsWith('type=bind,'))).toEqual([
      `type=bind,source=${mountPath},target=/var/lib/postgresql/data,bind-propagation=rprivate`,
    ]);
  });

  it('STORAGE-GUEST-02', () => {
    expect(() => ownedContainer(guestMetadata(), 'b'.repeat(64))).toThrow(
      'container_identity_mismatch',
    );
    const metadata = guestMetadata();
    const entry = metadata[0];
    if (!entry) throw new Error('fixture_missing');
    entry.Config.Labels['com.u1-lunch-bot.owner'] = 'unrelated';
    expect(() => ownedContainer(metadata, containerId)).toThrow('container_owner_mismatch');
  });

  it('STORAGE-GUEST-03', () => {
    const metadata = guestMetadata();
    const entry = metadata[0];
    if (!entry) throw new Error('fixture_missing');
    entry.HostConfig.Memory = 0;
    expect(() => {
      verifyGuestConfiguration(metadata, containerId);
    }).toThrow('runtime_limits_mismatch');
  });

  it('STORAGE-GUEST-04', () => {
    const metadata = guestMetadata();
    const entry = metadata[0];
    if (!entry) throw new Error('fixture_missing');
    entry.Mounts.push({ Type: 'volume', Source: 'unbounded', Destination: '/extra', RW: true });
    expect(() => {
      verifyGuestConfiguration(metadata, containerId);
    }).toThrow('unexpected_container_mount');
  });

  it('STORAGE-GUEST-05', () => {
    const metadata = guestMetadata();
    const entry = metadata[0];
    if (!entry) throw new Error('fixture_missing');
    entry.Config.User = 'root';
    expect(() => {
      verifyGuestConfiguration(metadata, containerId);
    }).toThrow('container_user_or_image');
  });
});
