import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  createReadStream,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  statfsSync,
  writeFileSync,
} from 'node:fs';
import { totalmem } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  asRecord,
  atPhase,
  childEnvironment,
  cidataLabel,
  demand,
  failureReport,
  limaStorage as policy,
  parseProbe,
  requireFreshHome,
  requireSpace,
  validateDisk,
  validateInstance,
} from './lima-storage-policy.ts';

type Invoke = (args: string[], input?: string, timeout?: number) => Promise<string>;
const instanceFormat =
  '{{.Name}}|{{.Dir}}|{{.VMType}}|{{.Arch}}|{{.CPUs}}|{{.Memory}}|{{.Disk}}|{{.Status}}';

export async function storageSequence(
  invoke: Invoke,
  checkRaw: () => void,
  probe: string,
  cidata: () => { bytes: number; label: string },
): Promise<Record<string, unknown>> {
  let attempted = false;
  try {
    await atPhase('validate', () => invoke(['validate', `${policy.home}/storage.yaml`]));
    await atPhase('disk', async () => {
      await invoke(['disk', 'create', policy.disk, '--size', '2GiB', '--format', 'raw']);
      validateDisk(
        JSON.parse(await invoke(['disk', 'list', '--json', policy.disk])) as unknown,
        false,
      );
      checkRaw();
    });
    attempted = true;
    await atPhase('create', async () => {
      await invoke(
        [
          'create',
          '--name',
          policy.instance,
          '--tty=false',
          '--mount-none',
          `${policy.home}/storage.yaml`,
        ],
        undefined,
        180_000,
      );
      demand(
        validateInstance(await invoke(['list', '--format', instanceFormat, policy.instance])) ===
          'Stopped',
        'instance_state',
      );
    });
    await atPhase('start', async () => {
      await invoke(['start', '--timeout=180s', policy.instance], undefined, 190_000);
      demand(
        validateInstance(await invoke(['list', '--format', instanceFormat, policy.instance])) ===
          'Running',
        'instance_state',
      );
      checkRaw();
      validateDisk(
        JSON.parse(await invoke(['disk', 'list', '--json', policy.disk])) as unknown,
        true,
      );
    });
    return await atPhase('probe', async () => {
      const iso = cidata();
      const result = parseProbe(
        await invoke(
          [
            'shell',
            '--workdir=/',
            policy.instance,
            'sudo',
            '-n',
            'python3',
            '-I',
            '-',
            policy.run,
            policy.disk,
            String(iso.bytes),
            iso.label,
          ],
          probe,
          130_000,
        ),
      );
      checkRaw();
      return result;
    });
  } finally {
    if (attempted) {
      await atPhase('stop', async () => {
        const state = validateInstance(
          await invoke(['list', '--format', instanceFormat, policy.instance]),
        );
        if (state !== 'Stopped') await invoke(['stop', policy.instance], undefined, 60_000);
        demand(
          validateInstance(await invoke(['list', '--format', instanceFormat, policy.instance])) ===
            'Stopped',
          'stop_unverified',
        );
      });
      await atPhase('format_lock', async () => {
        await invoke([
          'edit',
          '--tty=false',
          '--set',
          '.additionalDisks[0].format = false',
          policy.instance,
        ]);
        demand(
          (
            await invoke([
              'list',
              '--format',
              '{{(index .Config.AdditionalDisks 0).Format}}',
              policy.instance,
            ])
          ).trim() === 'false',
          'format_lock_unverified',
        );
      });
    }
  }
}

async function hash(path: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk as Buffer);
  return digest.digest('hex');
}

export async function main(): Promise<void> {
  const workspace = resolve(import.meta.dirname, '../..');
  const uid = process.getuid?.();
  demand(
    process.argv.length === 2 &&
      process.platform === 'darwin' &&
      process.arch === 'arm64' &&
      uid !== undefined &&
      uid !== 0,
    'host_identity',
  );
  demand(totalmem() >= 8_589_934_592, 'host_memory');
  requireFreshHome(policy.home, existsSync(policy.home));
  const hostSpace = statfsSync('/private/tmp');
  requireSpace(hostSpace.bavail * hostSpace.bsize);
  const regular = (path: string) => {
    const info = lstatSync(path);
    demand(
      info.isFile() &&
        !info.isSymbolicLink() &&
        info.nlink === 1 &&
        info.uid === uid &&
        realpathSync(path) === path,
      'file_identity',
    );
    return info;
  };
  demand(
    regular(policy.archive).size === policy.archiveBytes &&
      (await hash(policy.archive)) === policy.archiveHash,
    'archive_identity',
  );
  process.umask(0o077);
  mkdirSync(policy.home, { mode: 0o700 });
  const homeIdentity = lstatSync(policy.home);
  mkdirSync(`${policy.home}/tmp`, { mode: 0o700 });
  mkdirSync(`${policy.home}/downloads`, { mode: 0o700 });
  mkdirSync(`${policy.home}/childhome`, { mode: 0o700 });
  const environment = childEnvironment();
  let cancelled = false;
  let active: ReturnType<typeof spawn> | undefined;
  const cancel = () => {
    cancelled = true;
    active?.kill('SIGTERM');
  };
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  const command = (
    binary: string,
    args: string[],
    input?: string,
    timeout = 20_000,
    maximum = 32768,
  ): Promise<Buffer> =>
    new Promise((done, reject) => {
      const child = spawn(binary, args, {
        cwd: workspace,
        env: environment,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      active = child;
      const chunks: Buffer[] = [];
      let bytes = 0;
      let failed = false;
      const timer = setTimeout(() => {
        failed = true;
        child.kill('SIGTERM');
      }, timeout);
      const killer = setTimeout(() => child.kill('SIGKILL'), timeout + 5000);
      child.stdout.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > maximum) {
          failed = true;
          child.kill('SIGTERM');
        } else chunks.push(chunk);
      });
      child.stderr.resume();
      child.stdin.on('error', () => {
        failed = true;
      });
      child.stdin.end(input);
      child.on('error', () => {
        failed = true;
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        clearTimeout(killer);
        active = undefined;
        if (failed || code !== 0) reject(new Error('bounded_command_failed'));
        else done(Buffer.concat(chunks));
      });
    });
  const assertHome = () => {
    const current = lstatSync(policy.home);
    demand(
      current.isDirectory() &&
        current.uid === uid &&
        (current.mode & 0o7777) === 0o700 &&
        current.ino === homeIdentity.ino &&
        current.dev === homeIdentity.dev &&
        realpathSync(policy.home) === policy.home,
      'home_identity',
    );
  };
  try {
    for (const entry of ['bin/limactl', 'share/lima/lima-guestagent.Linux-aarch64.gz']) {
      const installed = `/private/tmp/u1-lunch-bot-lima-2.2.1/install/${entry}`;
      regular(installed);
      const archived = await command(
        '/usr/bin/tar',
        ['-xOf', policy.archive, `./${entry}`],
        undefined,
        20_000,
        134_217_728,
      );
      demand(
        createHash('sha256').update(archived).digest('hex') === (await hash(installed)),
        'installed_source_mismatch',
      );
    }
    const invoke: Invoke = async (args, input, timeout) => {
      assertHome();
      const cleanup = ['list', 'stop', 'edit'].includes(args[0] ?? '');
      demand(!cancelled || cleanup, 'cancelled');
      return (await command(policy.binary, args, input, timeout)).toString('utf8');
    };
    demand((await invoke(['--version'])).trim() === 'limactl version 2.2.1', 'version_mismatch');
    const image = `${policy.home}/downloads/ubuntu.img`;
    const config = asRecord(
      JSON.parse(readFileSync(`${workspace}/infra/lima/storage.json`, 'utf8')) as unknown,
    );
    const probe = readFileSync(`${workspace}/infra/lima/storage-probe.py`, 'utf8');
    const rendered =
      JSON.stringify(
        {
          ...config,
          images: [{ location: image, arch: 'aarch64', digest: `sha256:${policy.imageHash}` }],
          additionalDisks: [{ name: policy.disk, format: true, fsType: 'ext4' }],
        },
        null,
        2,
      ) + '\n';
    writeFileSync(
      `${policy.home}/owner.json`,
      JSON.stringify({
        unit: 'u1-lunch-bot',
        run: policy.run,
        purpose: 'storage_only',
        configurationSha256: createHash('sha256').update(rendered).digest('hex'),
        probeSha256: createHash('sha256').update(probe).digest('hex'),
      }) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    writeFileSync(`${policy.home}/storage.yaml`, rendered, { flag: 'wx', mode: 0o600 });
    demand(!cancelled, 'cancelled');
    await atPhase('download', async () => {
      await command(
        '/usr/bin/curl',
        [
          '--disable',
          '--fail',
          '--location',
          '--proto',
          '=https',
          '--proto-redir',
          '=https',
          '--max-time',
          '180',
          '--max-filesize',
          String(policy.imageBytes),
          '--output',
          image,
          policy.imageUrl,
        ],
        undefined,
        190_000,
      );
      demand(
        regular(image).size === policy.imageBytes && (await hash(image)) === policy.imageHash,
        'image_identity',
      );
    });
    const space = statfsSync(policy.home);
    requireSpace(space.bavail * space.bsize);
    let diskInode: number | undefined;
    const checkRaw = () => {
      const info = regular(`${policy.home}/_disks/${policy.disk}/datadisk`);
      demand(
        info.size === policy.bytes && (diskInode === undefined || diskInode === info.ino),
        'raw_identity',
      );
      diskInode = info.ino;
    };
    const cidata = () => {
      const path = `${policy.home}/storage/cidata.iso`;
      const before = regular(path);
      demand(before.size > 32768 && before.size <= 134_217_728, 'cidata_size');
      const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const opened = fstatSync(descriptor);
        demand(
          opened.ino === before.ino && opened.dev === before.dev && opened.size === before.size,
          'cidata_identity',
        );
        const block = Buffer.alloc(2048);
        demand(readSync(descriptor, block, 0, block.length, 32768) === 2048, 'cidata_read');
        return { bytes: opened.size, label: cidataLabel(block) };
      } finally {
        closeSync(descriptor);
      }
    };
    const result = await storageSequence(invoke, checkRaw, probe, cidata);
    demand(!cancelled, 'cancelled');
    const report = {
      check: 'lima_storage_only',
      ...result,
      vm: 'stopped',
      formatOnRestart: false,
      pgVerified: false,
    };
    writeFileSync(`${policy.home}/storage-result.json`, JSON.stringify(report) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    process.stdout.write(JSON.stringify(report) + '\n');
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stdout.write(JSON.stringify(failureReport(error)) + '\n');
    process.exitCode = 1;
  });
}
