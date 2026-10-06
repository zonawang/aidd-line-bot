import { readFileSync, writeFileSync } from 'node:fs';

export function writeGuardFixture(root: string, data: string): string {
  const uid = process.getuid?.();
  const gid = process.getgid?.();
  if (uid === undefined || gid === undefined || !data.startsWith(`${root}/`))
    throw new Error('unit_guard_fixture_identity');
  const script = `${root}/disk-temp-guard.sh`;
  writeFileSync(
    script,
    readFileSync('infra/postgres/disk-temp-guard.sh', 'utf8')
      .replaceAll('/var/lib/postgresql/data/pgdata', data)
      .replaceAll('999:999', `${String(uid)}:${String(gid)}`),
  );
  writeFileSync(
    `${root}/create-denial.pl`,
    readFileSync('infra/postgres/create-denial.pl', 'utf8')
      .replaceAll('/var/lib/postgresql/data/pgdata', data)
      .replace('my $owner = 999;', `my $owner = ${String(uid)};`)
      .replace('my $group = 999;', `my $group = ${String(gid)};`)
      .replace("my @groups = (split(' ', $(), split(' ', $)));", 'my @groups = ($group);'),
  );
  return script;
}
