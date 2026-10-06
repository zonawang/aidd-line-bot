import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  lstatSync,
  realpathSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  openSync,
  fstatSync,
  readSync,
  closeSync,
  constants,
  unlinkSync,
  rmdirSync,
} from 'node:fs';
import { databaseName, networkName, workspace, docker } from './database-runtime.ts';
import {
  storage,
  containerName,
  record,
  requireCondition,
  verifyContext,
} from './storage-policy.ts';
import { hostIdentity, dockerInvocationEnvironment } from './storage-host.ts';

const guest = readFileSync(new URL('./evidence-writer-probe.sh', import.meta.url), 'utf8');
const name = databaseName + '-evidence-writer-probe';
const token = randomUUID();
const scratch = storage.stage + '/evidence-writer-probe-' + token;
const library = workspace + '/infra/postgres';
const sources = new Map([
  [
    library + '/bootstrap-evidence.sh',
    'a7c00ebe7757853512954aef0185be71f5f653fcb5d84e770024e01c22bd3fe8',
  ],
  [library + '/bootstrap.sh', 'fcf3c2fb99529722f4f54a0d9de731823f6a1516c84f4966a2d9187f251e7549'],
]);
const initial = 'evidence_channel pending runtime_check none\n';
const allowedContent = new Map([
  [initial, 'pending'],
  ['evidence_channel started runtime_check none\n', 'first_started'],
  ['identity started identity_mismatch none\n', 'second_started'],
  ['tool_admission started missing_tool none\n', 'third_started'],
]);
const mounts = new Map([
  ['/u1-evidence', [scratch, true]],
  ['/opt/u1/infra/postgres', [library, false]],
]);
const dataTmpfs = 'ro,noexec,nosuid,nodev,size=1m,uid=999,gid=999,mode=0700';
const emit = (value) => process.stdout.write(JSON.stringify(value) + '\n');
let identifier;
let phase = 'admission';
let createdScratch = false;
let scratchStamp;
let containerGone = true;
const owner = process.getuid?.();
let cancelled = false;
const cancel = () => {
  cancelled = true;
  process.exitCode = 1;
};
process.once('SIGINT', cancel);
process.once('SIGTERM', cancel);
async function checkCancellation() {
  await new Promise(setImmediate);
  requireCondition(!cancelled, 'probe_cancelled');
}
function sameDirectory() {
  const info = lstatSync(scratch);
  requireCondition(
    info.isDirectory() &&
      realpathSync(scratch) === scratch &&
      info.uid === owner &&
      (info.mode & 0o7777) === 0o700 &&
      info.ino === scratchStamp.ino &&
      info.dev === scratchStamp.dev,
    'probe_scratch_identity',
  );
}
function checkedSources() {
  requireCondition(
    lstatSync(library).isDirectory() && realpathSync(library) === library,
    'probe_library',
  );
  for (const [source, hash] of sources) {
    requireCondition(
      lstatSync(source).isFile() &&
        !lstatSync(source).isSymbolicLink() &&
        realpathSync(source) === source &&
        createHash('sha256').update(readFileSync(source)).digest('hex') === hash,
      'probe_source',
    );
  }
}
function owned() {
  const entries = JSON.parse(docker(['inspect', identifier]));
  requireCondition(Array.isArray(entries) && entries.length === 1, 'probe_inspect');
  const entry = record(entries[0]);
  const config = record(entry.Config);
  const host = record(entry.HostConfig);
  const labels = record(config.Labels);
  requireCondition(
    entry.Id === identifier &&
      entry.Name === '/' + name &&
      labels['com.u1-lunch-bot.owner'] === 'u1-lunch-bot' &&
      labels['com.u1-lunch-bot.run'] === storage.run &&
      labels['com.u1-lunch-bot.purpose'] === 'evidence-writer-probe' &&
      labels['com.u1-lunch-bot.probe-token'] === token &&
      config.Image === storage.image &&
      config.User === '999:999' &&
      JSON.stringify(config.Entrypoint) === '["/bin/bash"]' &&
      JSON.stringify(config.Cmd) === '["--noprofile","--norc","-s"]' &&
      host.NetworkMode === 'none' &&
      host.Privileged === false &&
      host.ReadonlyRootfs === true &&
      host.Memory === 1073741824 &&
      host.MemorySwap === 1073741824 &&
      host.NanoCpus === 1000000000 &&
      host.PidsLimit === 64 &&
      host.ShmSize === 16777216 &&
      JSON.stringify(host.CapDrop) === '["ALL"]' &&
      JSON.stringify(host.SecurityOpt) === '["no-new-privileges:true"]' &&
      record(host.LogConfig).Type === 'none' &&
      Object.keys(record(host.PortBindings ?? {})).length === 0 &&
      record(host.RestartPolicy).Name === 'no' &&
      JSON.stringify(record(host.Tmpfs)) ===
        JSON.stringify({ '/var/lib/postgresql/data': dataTmpfs }),
    'probe_identity',
  );
  requireCondition(
    Array.isArray(entry.Mounts) &&
      entry.Mounts.every(
        (mount) =>
          mount.Type === 'bind' ||
          (mount.Type === 'tmpfs' && mount.Destination === '/var/lib/postgresql/data'),
      ),
    'probe_no_anonymous_volumes',
  );
  const binds = entry.Mounts.filter((mount) => mount.Type === 'bind');
  requireCondition(binds.length === mounts.size, 'probe_mount_count');
  for (const bind of binds) {
    const expected = mounts.get(bind.Destination);
    requireCondition(
      expected && bind.Source === expected[0] && bind.RW === expected[1],
      'probe_mount',
    );
  }
  return entry;
}
function checkedScratchFile(path) {
  const valid = (info) => {
    requireCondition(
      info.isFile() &&
        info.uid === owner &&
        info.nlink === 1 &&
        (info.mode & 0o7777) === 0o600 &&
        info.size > 0 &&
        info.size <= 256,
      'probe_scratch_file',
    );
  };
  const before = lstatSync(path);
  valid(before);
  const descriptor = openSync(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const opened = fstatSync(descriptor);
    valid(opened);
    requireCondition(opened.dev === before.dev && opened.ino === before.ino, 'probe_file_changed');
    const buffer = Buffer.alloc(257);
    const count = readSync(descriptor, buffer, 0, buffer.length, 0);
    const after = fstatSync(descriptor);
    valid(after);
    requireCondition(count === opened.size && count === after.size, 'probe_file_size');
    const content = buffer.subarray(0, count).toString('utf8');
    requireCondition(allowedContent.has(content), 'probe_file_content');
    return { info: after, state: allowedContent.get(content) };
  } finally {
    closeSync(descriptor);
  }
}
const steps = [
  'directory_check',
  'directory_path',
  'directory_owner',
  'directory_list',
  'directory_contents',
  'old_status_check',
  'next_absent',
  'next_create',
  'next_check',
  'file_kind',
  'file_owner_mode_links',
  'file_size_read',
  'file_size_bound',
  'rename',
  'record_phase',
  'record_status',
  'failure_handler',
  'write_return',
  'checkpoint_return',
  'process_identity_return',
  'environment_identity_return',
  'tool_admission_return',
];
const points = [
  'directory',
  'initial_status',
  'old_status',
  'next_created',
  'pre_mv_status',
  'pre_mv_next',
  'post_mv_status',
  'post_mv_next',
  'final_status',
  'final_next',
];
function project(output) {
  requireCondition(
    typeof output === 'string' &&
      output.length > 0 &&
      output.length <= 16384 &&
      output.endsWith('\n'),
    'probe_output',
  );
  const lines = output.trimEnd().split('\n');
  requireCondition(lines.length <= 160, 'probe_output_count');
  const numericExit = (value) => {
    requireCondition(
      /^(0|[1-9][0-9]{0,2})$/.test(value) && Number(value) <= 255,
      'probe_exit_code',
    );
    return Number(value);
  };
  return lines.map((line) => {
    const [kind, write, ...values] = line.split(' ');
    requireCondition(['first', 'second', 'third'].includes(write), 'probe_write');
    if (kind === 'META') {
      const choices = [
        points,
        ['yes', 'no'],
        ['missing', 'symlink', 'file', 'directory', 'other'],
        ['root', 'pg', 'host', 'other', 'unknown'],
        ['root', 'pg', 'host', 'other', 'unknown'],
        ['0600', '0700', 'other', 'unknown'],
        ['one', 'multiple', 'unknown'],
      ];
      requireCondition(
        values.length === choices.length &&
          choices.every((allowed, index) => allowed.includes(values[index])),
        'probe_meta',
      );
      const [point, present, objectKind, ownerClass, groupClass, mode, links] = values;
      return {
        check: 'writer_metadata',
        write,
        point,
        present,
        kind: objectKind,
        owner: ownerClass,
        group: groupClass,
        mode,
        links,
      };
    }
    if (kind === 'MOVE') {
      requireCondition(values.length === 1, 'probe_move');
      return { check: 'writer_mv', write, exitCode: numericExit(values[0]) };
    }
    requireCondition((kind === 'STEP' || kind === 'EXIT') && values.length === 2, 'probe_record');
    const reasons =
      kind === 'STEP'
        ? steps
        : [
            ...steps,
            'admission',
            'source',
            'write_call',
            'checkpoint_call',
            'complete',
            'process_identity',
            'environment_identity',
            'tool_admission',
          ];
    requireCondition(reasons.includes(values[0]), 'probe_reason');
    return kind === 'STEP'
      ? { check: 'writer_step', write, step: values[0], priorExitCode: numericExit(values[1]) }
      : { check: 'writer_exit', write, reason: values[0], exitCode: numericExit(values[1]) };
  });
}
try {
  requireCondition(process.argv.length === 2 && Number.isInteger(owner), 'probe_arguments');
  verifyContext(JSON.parse(docker(['context', 'inspect', 'desktop-linux'])));
  requireCondition(hostIdentity().availableBytes >= 1073741824, 'probe_space');
  const parent = lstatSync(storage.stage);
  requireCondition(
    parent.isDirectory() &&
      realpathSync(storage.stage) === storage.stage &&
      parent.uid === owner &&
      (parent.mode & 0o7777) === 0o700,
    'probe_parent',
  );
  checkedSources();
  for (const candidate of [
    name,
    databaseName,
    databaseName + '-resume-check',
    databaseName + '-metadata-probe',
    databaseName + '-create-denial-probe',
    containerName,
  ]) {
    requireCondition(
      docker(['ps', '-aq', '--filter', 'name=^/' + candidate + '$']).trim() === '',
      'probe_collision',
    );
  }
  requireCondition(
    docker(['network', 'ls', '-q', '--filter', 'name=^' + networkName + '$']).trim() === '',
    'probe_network_collision',
  );
  const image = JSON.parse(docker(['image', 'inspect', storage.image]));
  requireCondition(
    Array.isArray(image) &&
      image.length === 1 &&
      JSON.stringify(Object.keys(record(record(image[0].Config).Volumes))) ===
        '["/var/lib/postgresql/data"]',
    'probe_image_volumes',
  );
  await checkCancellation();
  phase = 'scratch';
  mkdirSync(scratch, { mode: 0o700 });
  createdScratch = true;
  scratchStamp = lstatSync(scratch);
  sameDirectory();
  writeFileSync(scratch + '/bootstrap.status', initial, { flag: 'wx', mode: 0o600 });
  requireCondition(
    checkedScratchFile(scratch + '/bootstrap.status').state === 'pending',
    'probe_initial_status',
  );
  await checkCancellation();
  phase = 'create';
  containerGone = false;
  identifier = docker([
    'create',
    '--name',
    name,
    '--label',
    'com.u1-lunch-bot.owner=u1-lunch-bot',
    '--label',
    'com.u1-lunch-bot.run=' + storage.run,
    '--label',
    'com.u1-lunch-bot.purpose=evidence-writer-probe',
    '--label',
    'com.u1-lunch-bot.probe-token=' + token,
    '--platform',
    'linux/arm64/v8',
    '--pull',
    'never',
    '--user',
    '999:999',
    '--hostname',
    'u1-pg',
    '--network',
    'none',
    '--ipc',
    'private',
    '--cpus',
    '1',
    '--memory',
    '1073741824',
    '--memory-swap',
    '1073741824',
    '--pids-limit',
    '64',
    '--shm-size',
    '16m',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges:true',
    '--read-only',
    '--log-driver',
    'none',
    '--restart',
    'no',
    '--ulimit',
    'core=0',
    '--env',
    'U1_PROFILE=synthetic',
    '--env',
    'PGDATA=/var/lib/postgresql/data/pgdata',
    '--env',
    'U1_EVIDENCE_HOST_UID=' + scratchStamp.uid,
    '--env',
    'U1_EVIDENCE_HOST_GID=' + scratchStamp.gid,
    ...Array.from(mounts, ([target, [source, writable]]) => [
      '--mount',
      'type=bind,source=' + source + ',target=' + target + (writable ? '' : ',readonly'),
    ]).flat(),
    '--tmpfs',
    '/var/lib/postgresql/data:' + dataTmpfs,
    '--entrypoint',
    '/bin/bash',
    '-i',
    storage.image,
    '--noprofile',
    '--norc',
    '-s',
  ]).trim();
  requireCondition(/^[a-f0-9]{64}$/.test(identifier), 'probe_identifier');
  phase = 'container_admission';
  owned();
  sameDirectory();
  checkedSources();
  await checkCancellation();
  phase = 'writer';
  const result = spawnSync(
    storage.docker,
    ['--context', 'desktop-linux', 'start', '-ai', identifier],
    {
      input: guest,
      env: dockerInvocationEnvironment(),
      encoding: 'utf8',
      timeout: 20000,
      maxBuffer: 16384,
    },
  );
  await new Promise(setImmediate);
  const rows = project(result.stdout);
  rows.forEach(emit);
  const state = record(owned().State);
  const exit = rows.at(-1);
  const complete =
    !cancelled &&
    !result.error &&
    result.status === 0 &&
    state.Running === false &&
    state.ExitCode === 0 &&
    exit.check === 'writer_exit' &&
    exit.write === 'third' &&
    exit.reason === 'complete' &&
    exit.exitCode === 0 &&
    ['first', 'second', 'third'].every(
      (write) =>
        rows.filter((row) => row.check === 'writer_mv' && row.write === write && row.exitCode === 0)
          .length === 1,
    ) &&
    ['process_identity_return', 'environment_identity_return', 'tool_admission_return'].every(
      (step) =>
        rows.some(
          (row) => row.check === 'writer_step' && row.step === step && row.priorExitCode === 0,
        ),
    ) &&
    rows.some(
      (row) =>
        row.check === 'writer_step' && row.write === 'third' && row.step === 'checkpoint_return',
    ) &&
    checkedScratchFile(scratch + '/bootstrap.status').state === 'third_started';
  emit({
    check: 'evidence_writer_probe',
    status: complete ? 'completed' : 'failed',
    runtimeValidation: 'not_run',
    retainedEvidence: 'not_mounted_not_written',
  });
  if (!complete) process.exitCode = 1;
} catch {
  process.exitCode = 1;
  emit({ check: 'evidence_writer_probe', phase, status: 'failed' });
} finally {
  if (identifier && /^[a-f0-9]{64}$/.test(identifier)) {
    try {
      const state = record(owned().State);
      if (state.Running === true) docker(['stop', '--time', '5', identifier], undefined, 10000);
      requireCondition(record(owned().State).Running === false, 'probe_still_running');
      docker(['rm', identifier], undefined, 10000);
      containerGone = true;
      emit({ check: 'writer_probe_container_cleanup', status: 'passed' });
    } catch {
      process.exitCode = 1;
      emit({ check: 'writer_probe_container_cleanup', status: 'unknown' });
    }
  } else if (!containerGone) {
    process.exitCode = 1;
    emit({ check: 'writer_probe_container_cleanup', status: 'unknown' });
  }
  if (createdScratch) {
    try {
      requireCondition(containerGone, 'probe_container_retained');
      sameDirectory();
      const files = readdirSync(scratch);
      requireCondition(
        files.every((file) => ['bootstrap.status', 'bootstrap.next'].includes(file)),
        'probe_scratch_contents',
      );
      const checked = files.map((file) => ({ file, ...checkedScratchFile(scratch + '/' + file) }));
      for (const item of checked) {
        const point = item.file === 'bootstrap.status' ? 'status' : 'next';
        emit({ check: 'writer_probe_scratch_state', point, state: item.state });
      }
      for (const item of checked) {
        sameDirectory();
        const current = lstatSync(scratch + '/' + item.file);
        requireCondition(
          current.isFile() &&
            current.dev === item.info.dev &&
            current.ino === item.info.ino &&
            current.uid === owner &&
            current.nlink === 1 &&
            current.size === item.info.size &&
            current.mode === item.info.mode,
          'probe_cleanup_changed',
        );
        unlinkSync(scratch + '/' + item.file);
      }
      sameDirectory();
      requireCondition(readdirSync(scratch).length === 0, 'probe_not_empty');
      rmdirSync(scratch);
      emit({ check: 'writer_probe_scratch_cleanup', status: 'passed' });
    } catch {
      process.exitCode = 1;
      emit({ check: 'writer_probe_scratch_cleanup', status: 'unknown_retained' });
    }
  }
  await new Promise(setImmediate);
  if (cancelled) {
    process.exitCode = 1;
    emit({ check: 'evidence_writer_probe', status: 'cancelled' });
  }
  process.removeListener('SIGINT', cancel);
  process.removeListener('SIGTERM', cancel);
}
