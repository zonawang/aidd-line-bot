import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../../src/app.js';
import { ControlState } from '../../../src/line-interaction/control-state.js';
import { CONFIRM_TEXT } from '../../../src/line-interaction/messages.js';
import type { TextMessage } from '../../../src/line-interaction/messages.js';
import { demoConfig, event, now, signed } from '../fixtures/mvp.js';

vi.mock('node:fs/promises', { spy: true });

const apps: FastifyInstance[] = [];
afterEach(async () => {
  vi.useRealTimers();
  for (const app of apps.splice(0)) await app.close();
});
function app() {
  const server = createApp(demoConfig, { now: () => now });
  apps.push(server);
  return server;
}
function post(server: FastifyInstance, body: string, signature = signed(body)) {
  return server.inject({
    method: 'POST',
    url: '/webhook',
    headers: { 'Content-Type': 'application/json', 'x-line-signature': signature },
    payload: body,
  });
}
function envelope(events: unknown[]) {
  return JSON.stringify({ destination: demoConfig.destination, events });
}

describe('固定政策頁面', () => {
  it.each([
    ['terms', '服務條款', '/privacy'],
    ['privacy', '隱私政策', '/terms'],
  ])('%s 回傳有安全標頭的繁中政策，不呼叫外部服務', async (page, title, otherPage) => {
    const network = vi.fn(() => Promise.reject(new Error('unexpected_network')));
    vi.stubGlobal('fetch', network);
    const server = app();
    const response = await server.inject(`/${page}`);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.headers['cache-control']).toBe('no-store, no-transform');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBe(
      "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['set-cookie']).toBeUndefined();
    for (const text of [
      '<html lang="zh-Hant">',
      '<meta charset="utf-8"',
      'name="viewport"',
      `<h1>午餐決定器 LINE Bot ${title}</h1>`,
      `<title>${title}｜午餐決定器 LINE Bot</title>`,
      '已發布；生效日期：2026-10-06。',
      '營運者：<strong>Zona</strong>',
      'href="mailto:bear336339@gmail.com"',
      '>bear336339@gmail.com</a',
      `data-testid="${page}-contact-link"`,
      `href="${otherPage}"`,
      'https://cloud.google.com/maps-platform/terms/maps-end-user-terms',
      'https://policies.google.com/privacy',
      'https://www.lycorp.co.jp/en/company/privacypolicy_zh-TW/',
      'https://www.cloudflare.com/privacypolicy/',
    ])
      expect(response.body.includes(text)).toBe(true);
    expect(/<(?:script|style|img|iframe|link)\b|\son\w+=/iu.test(response.body)).toBe(false);
    expect(response.body.includes('\uFFFD')).toBe(false);
    expect(response.body.includes('【待填：')).toBe(false);
    expect(/DRAFT|草稿|尚未生效|內容待營運者確認/u.test(response.body)).toBe(false);
    if (page === 'privacy')
      expect(
        /Cloudflare Tunnel\s+是本次受控測試的臨時入口，不是穩定的正式環境。/u.test(response.body),
      ).toBe(true);
    expect(network).not.toHaveBeenCalled();
    expect((await post(server, envelope([]))).statusCode).toBe(200);
    expect((await post(server, `${envelope([])} `, signed(envelope([])))).statusCode).toBe(401);
  });

  it.each(['terms', 'privacy'])('%s 資產讀取失敗只回安全錯誤', async (page) => {
    const server = app();
    vi.mocked(readFile).mockRejectedValueOnce(new Error('ENOENT /synthetic-private-path'));
    const response = await server.inject(`/${page}`);
    expect(response.statusCode).toBe(503);
    expect(response.json<unknown>()).toEqual({ error: 'policy_unavailable' });
    expect(response.headers['cache-control']).toBe('no-store, no-transform');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.body.includes('synthetic-private-path')).toBe(false);
    expect((await server.inject('/health')).statusCode).toBe(200);
  });

  it('不掛載目錄或依請求路徑讀檔，查詢參數不改變固定資產', async () => {
    const server = app();
    const read = vi.mocked(readFile);
    for (const url of [
      '/',
      '/docs/app/',
      '/docs/app/privacy.html',
      '/src/app.ts',
      '/.env',
      '/terms/../../.env',
      '/privacy/%2e%2e/%2e%2e/.env',
      '/terms%2f..%2f.env',
      '/terms/',
      '/privacy/extra',
    ]) {
      const response = await server.inject(url);
      expect(response.statusCode).toBe(404);
      expect(response.json<unknown>()).toEqual({ error: 'not_found' });
    }
    for (const method of ['POST', 'PUT', 'DELETE', 'HEAD'] as const) {
      for (const page of ['terms', 'privacy'])
        expect((await server.inject({ method, url: `/${page}` })).statusCode).toBe(404);
    }
    expect(read).not.toHaveBeenCalled();
    const response = await server.inject('/terms?file=../../.env');
    expect(response.statusCode).toBe(200);
    expect(read).toHaveBeenCalledExactlyOnceWith(
      new URL('../../../docs/app/terms.html', import.meta.url),
      'utf8',
    );
  });
});

describe('Fastify 原始 bytes webhook', () => {
  it('健康僅回安全狀態，未定義路徑不回印 URL', async () => {
    const server = app();
    expect((await server.inject('/health')).json<unknown>()).toEqual({
      status: 'ok',
      mode: 'demo',
      history: 'disabled',
    });
    const response = await server.inject('/synthetic-private-canary');
    expect(response.statusCode).toBe(404);
    expect(response.body.includes('canary')).toBe(false);
  });
  it('正確簽章及空 events 的 LINE 驗證', async () => {
    const server = app();
    expect((await post(server, envelope([]))).statusCode).toBe(200);
    expect((await post(server, envelope([event('message')]))).statusCode).toBe(200);
  });
  it('缺少、不合法簽章與 bytes 改動在處理前拒絕', async () => {
    const server = app();
    const body = envelope([event('secret')]);
    for (const signature of ['', 'invalid', signed(body, 'different-secret')])
      expect((await post(server, body, signature)).statusCode).toBe(401);
    expect((await post(server, `${body} `, signed(body))).statusCode).toBe(401);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/webhook',
          headers: { 'Content-Type': 'application/json' },
          payload: body,
        })
      ).statusCode,
    ).toBe(401);
    expect((await post(server, '{', 'invalid')).statusCode).toBe(401);
  });
  it('已驗簽 invalid JSON、destination 不符或超大本文安全拒絕', async () => {
    const server = app();
    expect((await post(server, '{')).statusCode).toBe(400);
    expect(
      (await post(server, JSON.stringify({ destination: 'wrong', events: [] }))).statusCode,
    ).toBe(400);
    expect(
      (await post(server, envelope(Array.from({ length: 21 }, () => event('too-many')))))
        .statusCode,
    ).toBe(400);
    expect((await post(server, 'x'.repeat(256 * 1024 + 1))).statusCode).toBe(413);
  });
  it('群組、過期與不支援事件無回覆；合法流程僅回覆一次', async () => {
    const messages: TextMessage[][] = [];
    const server = createApp(demoConfig, {
      now: () => now,
      reply: (_token, outgoing) => {
        messages.push(outgoing);
        return Promise.resolve('synthetic');
      },
    });
    apps.push(server);
    await post(
      server,
      envelope([
        { ...event('group'), source: { type: 'group' } },
        { ...event('old'), timestamp: now - 86_400_001 },
        { type: 'follow' },
      ]),
    );
    expect(messages.length).toBe(0);
    await post(
      server,
      envelope([
        event('first'),
        event('confirm', { type: 'text', text: CONFIRM_TEXT }),
        event('resent'),
      ]),
    );
    expect(messages.length).toBe(3);
    expect(messages[2]?.length).toBe(4);
    await post(server, envelope([event('resent')]));
    expect(messages.length).toBe(3);
  });
  it('10 秒總期限到達即停止，不在稍後補送', async () => {
    const state = new ControlState();
    state.rememberNotice(event('subject').source.userId, now);
    state.confirm(event('subject').source.userId, now);
    let sent = 0;
    let entered = () => {};
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const server = createApp(demoConfig, {
      now: () => now,
      state,
      source: {
        provider: 'synthetic',
        search: () => {
          entered();
          return new Promise(() => {});
        },
      },
      reply: () => {
        sent += 1;
        return Promise.resolve('synthetic');
      },
    });
    apps.push(server);
    await server.ready();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const pending = post(server, envelope([event('timeout')])).then((response) => response);
    await started;
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await pending).statusCode).toBe(200);
    expect(sent).toBe(0);
  });
  it('首次收件後讀取本文耗時也計入十秒', async () => {
    let elapsed = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => elapsed);
    const state = new ControlState();
    state.rememberNotice(event('subject').source.userId, now);
    state.confirm(event('subject').source.userId, now);
    let calls = 0;
    let sent = 0;
    let entered = () => {};
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const server = createApp(demoConfig, {
      now: () => now,
      state,
      source: {
        provider: 'synthetic',
        search: () => {
          calls += 1;
          entered();
          return new Promise(() => {});
        },
      },
      reply: () => {
        sent += 1;
        return Promise.resolve('synthetic');
      },
    });
    server.addHook('preParsing', (_request, _reply, payload, done) => {
      elapsed = 9000;
      done(null, payload);
    });
    apps.push(server);
    await server.ready();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const pending = post(server, envelope([event('slow-upload')])).then((response) => response);
    await started;
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await pending).statusCode).toBe(200);
    expect(sent).toBe(0);
  });
});
