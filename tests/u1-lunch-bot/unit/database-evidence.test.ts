import { describe, expect, it, vi } from 'vitest';
import { bootstrapEvidence } from '../../../scripts/u1-lunch-bot/database-runtime.ts';

const files = vi.hoisted(() => ({ readBootstrapStatus: vi.fn() }));
vi.mock('../../../scripts/u1-lunch-bot/database-bootstrap-evidence.ts', async (original) => ({
  ...(await original<
    typeof import('../../../scripts/u1-lunch-bot/database-bootstrap-evidence.ts')
  >()),
  ...files,
}));

describe('U1-DB-EVIDENCE', () => {
  it('E01 只讀固定 phase／SQLSTATE，不讀原始 PG logs', () => {
    files.readBootstrapStatus.mockReturnValue('model_migration failed sql_failed 42501\n');
    expect(bootstrapEvidence()).toEqual({
      phase: 'model_migration',
      status: 'failed',
      category: 'sql_failed',
      sqlstate: '42501',
    });
    expect(files.readBootstrapStatus).toHaveBeenCalledTimes(1);
    expect(String(files.readBootstrapStatus.mock.calls[0]?.[0]).endsWith('/evidence')).toBe(true);
  });

  it.each([
    'tcp_start passed runtime_check none\n',
    'tls_server failed tls_failed none\n',
    'tool_admission failed missing_tool none\n',
    'disk_temp_guard failed disk_temp_rejected none\n',
    'evidence_channel pending runtime_check none\n',
  ])('E02 固定成功／失敗／未開始證據', (content) => {
    files.readBootstrapStatus.mockReturnValue(content);
    expect(bootstrapEvidence().status).not.toBe('unknown');
  });

  it.each([
    'private_payload failed sql_failed 42501',
    'model_migration failed sql_failed 42501 extra_payload',
    'tls_server failed private_payload none',
    'tls_server failed tls_failed private_payload',
  ])('E03 非白名單內容不回印', (content) => {
    files.readBootstrapStatus.mockReturnValue(content);
    expect(bootstrapEvidence().status).toBe('unknown');
    expect(JSON.stringify(bootstrapEvidence()).includes('private_payload')).toBe(false);
  });

  it('E04 bounded reader 拒絕時不外洩 metadata 或原始錯誤', () => {
    files.readBootstrapStatus.mockImplementation(() => {
      throw new Error('private_payload');
    });
    expect(bootstrapEvidence().status).toBe('unknown');
    expect(JSON.stringify(bootstrapEvidence())).not.toContain('private_payload');
  });

  it('E05 缺檔／permission 不冒成功，不外洩例外內容', () => {
    files.readBootstrapStatus.mockImplementation(() => {
      throw new Error('private_payload');
    });
    expect(bootstrapEvidence()).toEqual({
      phase: 'evidence_channel',
      status: 'unknown',
      category: 'runtime_check',
      sqlstate: 'none',
    });
  });

  it('E06 bootstrap failure 保留同筆 action／固定 guard 摘要，沒有 raw 路徑', () => {
    files.readBootstrapStatus.mockReturnValue(
      'disk_temp_guard failed disk_temp_rejected none prepare U1_DISK_TEMP_GUARD temp_writable temp yes expected 0555 yes\n',
    );
    expect(bootstrapEvidence()).toEqual({
      phase: 'disk_temp_guard',
      status: 'failed',
      category: 'disk_temp_rejected',
      sqlstate: 'none',
      guard_action: 'prepare',
      guard: {
        reason: 'temp_writable',
        target: 'temp',
        present: 'yes',
        owner: 'expected',
        mode: '0555',
        writable: 'yes',
        create: 'unknown',
        errno: 'unknown',
        cleanup: 'unknown',
      },
    });
  });
});
