export const storage = Object.freeze({
  run: '961ab998-0b81-444c-ab33-578c76f008c0',
  stage: '/private/tmp/u1-lunch-bot-storage-961ab998-0b81-444c-ab33-578c76f008c0',
  bytes: 2_147_483_648,
  docker: '/Applications/Docker.app/Contents/Resources/bin/docker',
  endpoint: 'unix:///Users/al03034136/.docker/run/docker.sock',
  pullBudgetBytes: 4_294_967_296,
  hostReserveBytes: 2_147_483_648,
  compose: '/private/tmp/u1-lunch-bot-compose-2.40.3/docker-compose',
  composeHash: '8cd7eb5f95bacb536cc407111662e2c205d67d9abfea5dcb8400be8418db60d1',
  image:
    'docker.io/library/postgres:17.11-bookworm@sha256:75731e2765e7d0c8bb7dea960ef3bdcde68d16314991ab2057a2a74ea0fff257',
});

export const imagePath = `${storage.stage}/pgdata.dmg`;
export const mountPath = `${storage.stage}/mount`;
export const containerName = `u1-lunch-bot-storage-${storage.run}`;

export function requireCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

export function record(value: unknown): Record<string, unknown> {
  requireCondition(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'invalid_metadata',
  );
  return value as Record<string, unknown>;
}

export function verifyContext(value: unknown): void {
  requireCondition(Array.isArray(value) && value.length === 1, 'invalid_context_count');
  const context = record(value[0]);
  requireCondition(context['Name'] === 'desktop-linux', 'context_name_mismatch');
  const endpoint = record(record(context['Endpoints'])['docker']);
  requireCondition(endpoint['Host'] === storage.endpoint, 'context_endpoint_mismatch');
}

export function verifyPullSpace(availableBytes: number): void {
  requireCondition(
    Number.isSafeInteger(availableBytes) &&
      availableBytes >= storage.pullBudgetBytes + storage.hostReserveBytes,
    'host_pull_budget_unavailable',
  );
}

export function mountedDevice(value: unknown, ownerUid: number): string {
  const images = record(value)['images'];
  requireCondition(Array.isArray(images), 'invalid_images');
  const matches = images.map(record).filter((entry) => entry['image-path'] === imagePath);
  requireCondition(matches.length === 1, 'image_identity_mismatch');
  const entry = matches[0];
  requireCondition(entry, 'image_identity_mismatch');
  requireCondition(
    entry['owner-uid'] === ownerUid && entry['writeable'] === true,
    'image_owner_or_mode',
  );
  requireCondition(
    entry['blockcount'] === storage.bytes / 512 && entry['blocksize'] === 512,
    'image_capacity_mismatch',
  );
  const entities = entry['system-entities'];
  requireCondition(Array.isArray(entities) && entities.length === 1, 'unexpected_image_layout');
  const entity = record(entities[0]);
  requireCondition(entity['mount-point'] === mountPath, 'mount_identity_mismatch');
  const device = entity['dev-entry'];
  requireCondition(
    typeof device === 'string' && /^\/dev\/disk[0-9]+$/.test(device),
    'invalid_device',
  );
  return device;
}

export function guestCreateArgs(): string[] {
  return [
    'create',
    '--name',
    containerName,
    '--label',
    'com.u1-lunch-bot.owner=u1-lunch-bot',
    '--label',
    `com.u1-lunch-bot.run=${storage.run}`,
    '--platform',
    'linux/arm64/v8',
    '--pull',
    'never',
    '--user',
    'postgres:postgres',
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
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--read-only',
    '--log-driver',
    'none',
    '--restart',
    'no',
    '--mount',
    `type=bind,source=${mountPath},target=/var/lib/postgresql/data,bind-propagation=rprivate`,
    '--entrypoint',
    '/bin/bash',
    '-i',
    storage.image,
    '-s',
    '--',
    storage.run,
  ];
}

export function ownedContainer(value: unknown, expectedId: string): Record<string, unknown> {
  requireCondition(Array.isArray(value) && value.length === 1, 'invalid_container_count');
  const inspected = record(value[0]);
  const config = record(inspected['Config']);
  const labels = record(config['Labels']);
  requireCondition(
    inspected['Id'] === expectedId && inspected['Name'] === `/${containerName}`,
    'container_identity_mismatch',
  );
  requireCondition(
    labels['com.u1-lunch-bot.owner'] === 'u1-lunch-bot' &&
      labels['com.u1-lunch-bot.run'] === storage.run,
    'container_owner_mismatch',
  );
  return inspected;
}

export function verifyGuestConfiguration(value: unknown, expectedId: string): void {
  const inspected = ownedContainer(value, expectedId);
  const config = record(inspected['Config']);
  const host = record(inspected['HostConfig']);
  requireCondition(
    config['User'] === 'postgres:postgres' && config['Image'] === storage.image,
    'container_user_or_image',
  );
  requireCondition(
    host['Memory'] === 1_073_741_824 &&
      host['MemorySwap'] === 1_073_741_824 &&
      host['NanoCpus'] === 1_000_000_000,
    'runtime_limits_mismatch',
  );
  requireCondition(
    host['ReadonlyRootfs'] === true &&
      host['Privileged'] === false &&
      host['NetworkMode'] === 'none',
    'container_isolation_mismatch',
  );
  requireCondition(
    JSON.stringify(host['CapDrop']) === '["ALL"]' &&
      JSON.stringify(host['SecurityOpt']) === '["no-new-privileges"]',
    'container_hardening_mismatch',
  );
  requireCondition(record(host['LogConfig'])['Type'] === 'none', 'container_log_policy');
  const mounts = inspected['Mounts'];
  requireCondition(Array.isArray(mounts) && mounts.length === 1, 'unexpected_container_mount');
  const mount = record(mounts[0]);
  requireCondition(
    mount['Type'] === 'bind' &&
      mount['Source'] === mountPath &&
      mount['Destination'] === '/var/lib/postgresql/data' &&
      mount['RW'] === true,
    'container_mount_mismatch',
  );
}
