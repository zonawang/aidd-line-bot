import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  asRecord,
  atPhase,
  childEnvironment,
  cidataLabel,
  failureReport,
  limaStorage,
  parseProbe,
  requireFreshHome,
  requireHome,
  requireSpace,
  validateDisk,
  validateInstance,
} from '../../../scripts/u1-lunch-bot/lima-storage-policy.ts';
import { storageSequence } from '../../../scripts/u1-lunch-bot/lima-storage-preflight.ts';

function diskMetadata(attached = false) {
  return {
    name: limaStorage.disk,
    size: limaStorage.bytes,
    format: 'raw',
    dir: `${limaStorage.home}/_disks/${limaStorage.disk}`,
    instance: attached ? 'storage' : '',
    instanceDir: attached ? `${limaStorage.home}/storage` : '',
  };
}

function probeMetadata() {
  return {
    status: 'passed',
    deviceBytes: limaStorage.bytes,
    partitionBytes: 2_146_000_000,
    filesystemBytes: 2_050_000_000,
    writtenBytes: 1_900_000_000,
    uid: 999,
    gid: 999,
    files: 2,
    enospc: true,
    fsync: true,
    rename: true,
    cleanup: true,
  };
}

const cidata = () => ({ bytes: 1_048_576, label: 'synthetic-cidata' });

describe('LIMA-STORAGE-POLICY', () => {
  it('L19 原生 Node strip-only 載入入口但不執行 main', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "await import('./scripts/u1-lunch-bot/lima-storage-preflight.ts')",
      ],
      { timeout: 10_000, encoding: 'utf8', maxBuffer: 16384 },
    );
    expect(result.status === 0 && !result.error).toBe(true);
    expect(result.stdout.length).toBe(0);
  });
  it('L09 Python 探測器的容量／權限／ENOSPC／清理單測', () => {
    const result = spawnSync(
      '/usr/bin/python3',
      ['-I', '-B', 'tests/u1-lunch-bot/fixtures/lima-storage-probe-unit.py'],
      {
        timeout: 10_000,
        encoding: 'utf8',
        maxBuffer: 16384,
      },
    );
    expect(result.status === 0 && !result.error).toBe(true);
    expect(result.stderr.includes('Ran 7 tests')).toBe(true);
  });
  it('L01 新 run 與至少 20GiB 預算', () => {
    expect(() => {
      requireFreshHome(limaStorage.home, false);
    }).not.toThrow();
    expect(() => {
      requireFreshHome(limaStorage.home, true);
    }).toThrow('home_exists');
    expect(() => {
      requireHome(limaStorage.home);
    }).not.toThrow();
    expect(() => {
      requireSpace(limaStorage.budgetBytes);
    }).not.toThrow();
    expect(() => {
      requireSpace(limaStorage.budgetBytes - 1);
    }).toThrow('host_space');
    expect(() => {
      requireSpace(NaN);
    }).toThrow('host_space');
    expect(`${limaStorage.home}/storage/ssh.sock.1234567890123456`.length).toBeLessThan(104);
  });
  it.each([
    '/private/tmp/u1-lunch-bot-storage-961ab998-0b81-444c-ab33-578c76f008c0',
    '/private/tmp',
    '/Users/example/.lima',
    `${limaStorage.home}/../other`,
  ])('L02 拒絕舊或任意路徑 %#', (path) => {
    expect(() => {
      requireHome(path);
    }).toThrow('home_identity');
  });
  it('L03 精確新 raw disk 及 attachment', () => {
    expect(() => {
      validateDisk(diskMetadata(), false);
    }).not.toThrow();
    expect(() => {
      validateDisk(diskMetadata(true), true);
    }).not.toThrow();
    expect(() => {
      validateDisk(diskMetadata(), true);
    }).toThrow('disk_identity');
  });
  it.each([
    { name: 'old' },
    { size: limaStorage.bytes - 1 },
    { size: limaStorage.bytes + 1 },
    { format: 'qcow2' },
    { dir: '/private/tmp/old' },
    { instance: 'other' },
  ])('L04 拒絕錯 disk／size／來源 %#', (override) => {
    expect(() => {
      validateDisk({ ...diskMetadata(), ...override }, false);
    }).toThrow('disk_identity');
  });
  it('L05 ext4 metadata overhead 不等於放寬硬上限', () => {
    expect(parseProbe(JSON.stringify(probeMetadata()))).toEqual(probeMetadata());
    for (const deviceBytes of [limaStorage.bytes - 1, limaStorage.bytes + 1]) {
      expect(() => parseProbe(JSON.stringify({ ...probeMetadata(), deviceBytes }))).toThrow();
    }
  });
  it.each([
    { enospc: false },
    { fsync: false },
    { rename: false },
    { cleanup: false },
    { uid: 0 },
    { files: 1 },
    { writtenBytes: 0 },
    { filesystemBytes: 2_147_483_648 },
    { extra: 'canary' },
  ])('L06 缺證據不通過 %#', (override) => {
    expect(() => parseProbe(JSON.stringify({ ...probeMetadata(), ...override }))).toThrow();
  });
  it('L07 只接受同一 VM', () => {
    const identity = `storage|${limaStorage.home}/storage|vz|aarch64|2|3221225472|12884901888|Stopped`;
    expect(validateInstance(identity)).toBe('Stopped');
    expect(() => validateInstance(identity.replace('vz', 'qemu'))).toThrow();
    expect(() => validateInstance(identity.replace('12884901888', '21474836480'))).toThrow();
    expect(() => validateInstance(`${identity}\n${identity}`)).toThrow();
  });
  it('L08 設定不共享主機或安裝依賴', () => {
    const config = asRecord(JSON.parse(readFileSync('infra/lima/storage.json', 'utf8')) as unknown);
    expect(config['mounts']).toEqual([]);
    expect(config['networks']).toEqual([]);
    expect(config['containerd']).toEqual({ system: false, user: false });
    expect(config['upgradePackages']).toBe(false);
    expect(asRecord(config['ssh'])['loadDotSSHPubKeys']).toBe(false);
    expect(asRecord(config['ssh'])['forwardAgent']).toBe(false);
    const provisions = config['provision'] as Record<string, unknown>[];
    expect(provisions[0]?.['skipDefaultDependencyResolution']).toBe(true);
    expect(config).not.toHaveProperty('base');
    expect(config).not.toHaveProperty('blockDevices');
    expect(config).not.toHaveProperty('images');
  });
  it('L14 子程序 HOME／cache 限本 run，不繼承 proxy 或秘密', () => {
    expect(childEnvironment()).toEqual({
      HOME: `${limaStorage.home}/childhome`,
      LIMA_HOME: limaStorage.home,
      TMPDIR: `${limaStorage.home}/tmp`,
      PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
      LC_ALL: 'C',
    });
    expect(childEnvironment()['HOME']).not.toBe(process.env['HOME']);
  });
  it('L15 CIDATA 只採本 run ISO 的合法 primary volume descriptor', () => {
    const descriptor = Buffer.alloc(2048, 0);
    descriptor[0] = 1;
    descriptor.write('CD001', 1, 'ascii');
    descriptor[6] = 1;
    descriptor.fill(32, 40, 72);
    descriptor.write('synthetic-cidata', 40, 'ascii');
    expect(cidataLabel(descriptor)).toBe('synthetic-cidata');
    expect(() => cidataLabel(descriptor.subarray(0, 2047))).toThrow();
    descriptor[40] = 0xff;
    expect(() => cidataLabel(descriptor)).toThrow();
    descriptor[0] = 2;
    expect(() => cidataLabel(descriptor)).toThrow();
  });
  it('L16 錯誤只輸出固定階段／分類，不洩漏原始內容', async () => {
    for (const phase of [
      'admission',
      'download',
      'validate',
      'disk',
      'create',
      'start',
      'probe',
      'stop',
      'format_lock',
    ] as const) {
      const error: unknown = await atPhase(phase, () =>
        Promise.reject(new Error('synthetic-private-canary')),
      ).catch((failure: unknown) => failure);
      expect(failureReport(error)).toEqual({
        check: 'lima_storage_only',
        status: 'failed',
        phase,
        category: 'evidence_rejected',
        resources: 'retained_inspect_before_any_restart',
        pgVerified: false,
      });
    }
    const error: unknown = await atPhase('download', () =>
      Promise.reject(new Error('bounded_command_failed')),
    ).catch((failure: unknown) => failure);
    expect(failureReport(error)['category']).toBe('command_failed');
    expect(
      JSON.stringify(failureReport(new Error('synthetic-private-canary'))).includes('canary'),
    ).toBe(false);
  });
});

describe('LIMA-STORAGE-SEQUENCE', () => {
  function harness(failure = '') {
    const calls: string[][] = [];
    let running = false;
    const invoke = async (args: string[]) => {
      calls.push(args);
      if (args[0] === failure) throw new Error('synthetic_failure');
      if (args[0] === 'start') running = true;
      if (args[0] === 'stop') running = false;
      if (args[0] === 'disk' && args[1] === 'list') return JSON.stringify(diskMetadata(running));
      if (args[0] === 'list') {
        if (args[2]?.includes('.Format')) return 'false\n';
        return `storage|${limaStorage.home}/storage|vz|aarch64|2|3221225472|12884901888|${running ? 'Running' : 'Stopped'}`;
      }
      if (args[0] === 'shell') return JSON.stringify(probeMetadata());
      return await Promise.resolve('');
    };
    return { invoke, calls };
  }
  it('L10 一次建立啟動、探測後停機並鎖 format=false', async () => {
    const fixture = harness();
    let checks = 0;
    await storageSequence(
      fixture.invoke,
      () => {
        checks += 1;
      },
      'synthetic-probe',
      cidata,
    );
    expect(checks).toBe(3);
    expect(fixture.calls.filter((args) => args[0] === 'start')).toHaveLength(1);
    expect(fixture.calls.findIndex((args) => args[0] === 'stop')).toBeLessThan(
      fixture.calls.findIndex((args) => args[0] === 'edit'),
    );
    expect(fixture.calls.some((args) => args.includes('.additionalDisks[0].format = false'))).toBe(
      true,
    );
    expect(fixture.calls.some((args) => args.includes('delete') || args.includes('--fill'))).toBe(
      false,
    );
    expect(fixture.calls.find((args) => args[0] === 'shell')?.slice(-2)).toEqual([
      '1048576',
      'synthetic-cidata',
    ]);
  });
  it.each(['start', 'shell'])('L11 失敗仍查核同 VM 後停機、禁止重啟 %#', async (failure) => {
    const fixture = harness(failure);
    await expect(
      storageSequence(fixture.invoke, () => undefined, '', cidata),
    ).rejects.toMatchObject({ phase: failure === 'shell' ? 'probe' : 'start' });
    expect(fixture.calls.filter((args) => args[0] === 'start')).toHaveLength(1);
    expect(fixture.calls.some((args) => args[0] === 'edit')).toBe(true);
  });
  it.each(['stop', 'edit'])('L12 清理或格式鎖失敗不能 pass %#', async (failure) => {
    const fixture = harness(failure);
    await expect(
      storageSequence(fixture.invoke, () => undefined, '', cidata),
    ).rejects.toMatchObject({ phase: failure === 'edit' ? 'format_lock' : 'stop' });
  });
  it('L13 raw 身分失敗不進 VM create', async () => {
    const fixture = harness();
    await expect(
      storageSequence(
        fixture.invoke,
        () => {
          throw new Error('raw_identity');
        },
        '',
        cidata,
      ),
    ).rejects.toMatchObject({ phase: 'disk', category: 'evidence_rejected' });
    expect(fixture.calls.some((args) => args[0] === 'create' || args[0] === 'start')).toBe(false);
  });
  it.each(['validate', 'disk', 'create'])('L17 前置階段失敗分類、不進 start %#', async (phase) => {
    const fixture = harness(phase);
    await expect(
      storageSequence(fixture.invoke, () => undefined, '', cidata),
    ).rejects.toMatchObject({ phase });
    expect(fixture.calls.some((args) => args[0] === 'start' || args[0] === 'shell')).toBe(false);
  });
  it('L18 CIDATA 身分無法核對時不進 guest probe，仍停止本 VM', async () => {
    const fixture = harness();
    await expect(
      storageSequence(
        fixture.invoke,
        () => undefined,
        '',
        () => {
          throw new Error('cidata_identity');
        },
      ),
    ).rejects.toMatchObject({ phase: 'probe' });
    expect(fixture.calls.some((args) => args[0] === 'shell')).toBe(false);
    expect(fixture.calls.some((args) => args[0] === 'stop')).toBe(true);
  });
});
