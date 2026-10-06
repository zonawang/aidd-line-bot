import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../../src/app.js';
import { runSyntheticDemo } from '../../../src/demo.js';
import type { Diagnostic } from '../../../src/line-interaction/handler.js';
import { CONFIRM_TEXT } from '../../../src/line-interaction/messages.js';
import { createReplyTransport, LINE_REPLY_ENDPOINT } from '../../../src/line-interaction/reply.js';
import {
  createGoogleSource,
  GOOGLE_ENDPOINT,
} from '../../../src/restaurant-source-adapter/google.js';
import type { HttpFetch } from '../../../src/shared/http.js';
import { isRecord } from '../../../src/shared/result.js';
import { event, googlePlace, liveConfig, mockFetch, now, signed } from '../fixtures/mvp.js';

const apps: FastifyInstance[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

function scenario(sourceStatus = 200, replyStatus = 200) {
  let sourceCalls = 0;
  const replies: unknown[] = [];
  const diagnostics: Diagnostic[] = [];
  const transport: HttpFetch = (url, options) => {
    if (url === GOOGLE_ENDPOINT) {
      sourceCalls += 1;
      return mockFetch({ places: [googlePlace()] }, sourceStatus)(url, options);
    }
    if (url === LINE_REPLY_ENDPOINT) {
      const body: unknown = JSON.parse(typeof options?.body === 'string' ? options.body : 'null');
      replies.push(body);
      return mockFetch({ canary: 'synthetic-provider-private' }, replyStatus)(url, options);
    }
    return Promise.reject(new Error('unauthorized_test_egress'));
  };
  const server = createApp(liveConfig, {
    now: () => now,
    source: createGoogleSource(liveConfig, transport),
    reply: createReplyTransport(liveConfig, transport),
    report: (code) => {
      diagnostics.push(code);
    },
  });
  apps.push(server);
  const post = (input: unknown) => {
    const body = JSON.stringify({ destination: liveConfig.destination, events: [input] });
    return server.inject({
      method: 'POST',
      url: '/webhook',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': signed(body, liveConfig.channelSecret),
      },
      payload: body,
    });
  };
  return { post, replies, diagnostics, sourceCalls: () => sourceCalls };
}

describe('synthetic E2E，未驗證真實 LINE 接受', () => {
  it('告知→未確認位置放棄→確認→重傳→mock 來源→mock reply', async () => {
    const context = scenario();
    expect((await context.post(event('guide', { type: 'text', text: '午餐' }))).statusCode).toBe(
      200,
    );
    await context.post(
      event('discarded', { type: 'location', latitude: 0.00123456789, longitude: 0 }),
    );
    expect(context.sourceCalls()).toBe(0);
    await context.post(event('confirm', { type: 'text', text: CONFIRM_TEXT }));
    expect(context.sourceCalls()).toBe(0);
    await context.post(event('resent'));
    expect(context.sourceCalls()).toBe(1);
    const last = context.replies.at(-1);
    expect(isRecord(last) && Array.isArray(last['messages']) && last['messages'].length).toBe(2);
    expect(JSON.stringify(last).includes('合成餐廳')).toBe(true);
    expect(JSON.stringify(last).includes('合成第三方 https://example.test/source')).toBe(true);
    expect(context.diagnostics).toEqual(['accepted', 'accepted', 'accepted', 'accepted']);
    await context.post(event('resent'));
    expect(context.sourceCalls()).toBe(1);
    expect(context.replies.length).toBe(4);
  });
  it('来源拒絕明確回報，回覆結果不明不重送', async () => {
    const context = scenario(403, 500);
    await context.post(event('notice'));
    await context.post(event('confirm', { type: 'text', text: CONFIRM_TEXT }));
    await context.post(event('location'));
    expect(context.sourceCalls()).toBe(1);
    expect(context.replies.length).toBe(3);
    expect(JSON.stringify(context.replies.at(-1)).includes('來源授權遭拒')).toBe(true);
    expect(context.diagnostics.includes('source_auth')).toBe(true);
    expect(context.diagnostics.filter((code) => code === 'unknown').length).toBe(3);
  });
  it('敏感 canary 不進診斷、console 或 webhook response', async () => {
    const outputs: unknown[][] = [];
    vi.spyOn(console, 'log').mockImplementation((...values: unknown[]) => {
      outputs.push(values);
    });
    vi.spyOn(console, 'error').mockImplementation((...values: unknown[]) => {
      outputs.push(values);
    });
    const context = scenario(500);
    const bodies: string[] = [];
    bodies.push((await context.post(event('notice'))).body);
    bodies.push((await context.post(event('confirm', { type: 'text', text: CONFIRM_TEXT }))).body);
    bodies.push(
      (
        await context.post(
          event('location', { type: 'location', latitude: 0.00123456789, longitude: 0 }),
        )
      ).body,
    );
    const observed = JSON.stringify({ bodies, outputs, diagnostics: context.diagnostics });
    const canaries = [
      '0.00123456789',
      event('location').source.userId,
      event('location').replyToken,
      liveConfig.channelSecret,
      liveConfig.channelAccessToken,
      liveConfig.googleApiKey,
      'synthetic-provider-private',
    ];
    expect(canaries.some((canary) => observed.includes(canary))).toBe(false);
    expect(outputs.length).toBe(0);
    expect(context.diagnostics.includes('source_unavailable')).toBe(true);
  });
  it('可重現展示僅 synthetic，不宣稱真實 API 成功', async () => {
    const demo = await runSyntheticDemo();
    expect(demo.mode).toBe('synthetic');
    expect(demo.realLineAccepted).toBe(false);
    expect(demo.sourceCalls).toBe(1);
    expect(demo.replyCalls).toBe(4);
    expect(demo.recommendations.length).toBe(4);
  });
});
