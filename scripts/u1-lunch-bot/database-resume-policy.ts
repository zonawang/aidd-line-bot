import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync } from 'node:fs';
import { requireCondition } from './storage-policy.ts';
import { parseBootstrapStatus, readBootstrapStatus } from './database-bootstrap-evidence.ts';

export interface ResumeMetadata {
  major: string;
  allowlist: string;
  modelHash: string;
  roleHash: string;
  tablespaceEntries: string[];
  tablespaceTarget: string;
  bootstrapStatus: string;
}

export function validateResumeMetadata(metadata: ResumeMetadata): void {
  const fields = metadata.allowlist.trim().split(/\s+/);
  requireCondition(
    metadata.major.trim() === '17' && fields.length === 6,
    'database_resume_version_or_allowlist',
  );
  const [major, catalog, oid, target, model, roles] = fields;
  requireCondition(
    major === '17' &&
      /^\d{9}$/.test(catalog ?? '') &&
      /^[1-9]\d*$/.test(oid ?? '') &&
      target === '/u1-temp/tablespace' &&
      /^[a-f0-9]{64}$/.test(model ?? '') &&
      /^[a-f0-9]{64}$/.test(roles ?? '') &&
      model === metadata.modelHash &&
      roles === metadata.roleHash,
    'database_resume_allowlist_mismatch',
  );
  requireCondition(
    metadata.tablespaceEntries.length === 1 &&
      metadata.tablespaceEntries[0] === oid &&
      metadata.tablespaceTarget === target,
    'database_resume_tablespace_mismatch',
  );
  const prior = parseBootstrapStatus(metadata.bootstrapStatus);
  requireCondition(
    metadata.bootstrapStatus === 'tcp_start passed runtime_check none\n' ||
      metadata.bootstrapStatus === 'evidence_channel pending runtime_check none\n' ||
      metadata.bootstrapStatus === 'evidence_channel started runtime_check none\n' ||
      (prior.phase === 'disk_temp_guard' &&
        prior.status === 'failed' &&
        prior.category === 'disk_temp_rejected' &&
        prior.sqlstate === 'none'),
    'database_resume_prior_initialization_unverified',
  );
}

export function validateResumeFiles(
  mount: string,
  evidence: string,
  workspace: string,
  owner: number,
): void {
  const data = `${mount}/pgdata`;
  const directory = lstatSync(data);
  const evidenceDirectory = lstatSync(evidence);
  requireCondition(
    directory.isDirectory() &&
      realpathSync(data) === data &&
      (directory.uid === owner || directory.uid === 999) &&
      (directory.mode & 0o777) === 0o700,
    'database_resume_data_owner',
  );
  requireCondition(
    evidenceDirectory.isDirectory() &&
      realpathSync(evidence) === evidence &&
      evidenceDirectory.uid === owner &&
      (evidenceDirectory.mode & 0o777) === 0o700,
    'database_resume_evidence_owner',
  );
  requireCondition(
    readdirSync(evidence).join() === 'bootstrap.status',
    'database_resume_evidence_contents',
  );
  requireCondition(readdirSync(mount).join() === 'pgdata', 'database_resume_mount_contents');
  requireCondition(
    !readdirSync(data).includes('postmaster.pid'),
    'database_resume_postmaster_present',
  );
  const wal = lstatSync(`${data}/pg_wal`);
  requireCondition(
    wal.isDirectory() &&
      realpathSync(`${data}/pg_wal`) === `${data}/pg_wal` &&
      wal.uid === directory.uid,
    'database_resume_wal_identity',
  );
  const readBounded = (path: string, maximum: number, uid: number): string => {
    const info = lstatSync(path);
    requireCondition(
      info.isFile() &&
        info.nlink === 1 &&
        info.uid === uid &&
        (info.mode & 0o077) === 0 &&
        info.size > 0 &&
        info.size <= maximum,
      'database_resume_file_metadata',
    );
    return readFileSync(path, 'utf8');
  };
  const allowlist = readBounded(`${data}/u1-temp.allowlist`, 256, directory.uid);
  requireCondition(
    lstatSync(`${data}/pg_tblspc`).isDirectory() &&
      realpathSync(`${data}/pg_tblspc`) === `${data}/pg_tblspc`,
    'database_resume_tablespace_directory',
  );
  const entries = readdirSync(`${data}/pg_tblspc`);
  requireCondition(
    entries.length === 1 && /^[1-9]\d*$/.test(entries[0] ?? ''),
    'database_resume_tablespace_count',
  );
  const link = `${data}/pg_tblspc/${entries[0] ?? ''}`;
  requireCondition(lstatSync(link).isSymbolicLink(), 'database_resume_tablespace_link');
  validateResumeMetadata({
    major: readBounded(`${data}/PG_VERSION`, 16, directory.uid),
    allowlist,
    modelHash: createHash('sha256')
      .update(readFileSync(`${workspace}/db/migrations/001-model.sql`))
      .digest('hex'),
    roleHash: createHash('sha256')
      .update(readFileSync(`${workspace}/db/roles/bootstrap.sql`))
      .digest('hex'),
    tablespaceEntries: entries,
    tablespaceTarget: readlinkSync(link),
    bootstrapStatus: readBootstrapStatus(evidence, owner),
  });
}
