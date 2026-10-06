import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReplyTransport, LINE_REPLY_ENDPOINT } from '../../../src/line-interaction/reply.js';
import { textMessage } from '../../../src/line-interaction/messages.js';
import type { HttpFetch } from '../../../src/shared/http.js';
import { demoConfig, liveConfig, mockFetch } from '../fixtures/mvp.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('LINE reply HTTP 邊界（mock HTTP）', () => {
  it('實際 URL、Authorization、replyToken、messages 正確', async () => {
    let inspected = false;
    const token = 'synthetic-reply-canary';
    const messages = [textMessage('合成測試')];
    const transport: HttpFetch = (url, options) => {
      const headers = new Headers(options?.headers);
      const body: unknown = JSON.parse(typeof options?.body === 'string' ? options.body : 'null');
      inspected =
        url === LINE_REPLY_ENDPOINT &&
        options?.method === 'POST' &&
        options.redirect === 'error' &&
        headers.get('Authorization') === `Bearer ${liveConfig.channelAccessToken}` &&
        JSON.stringify(body) === JSON.stringify({ replyToken: token, messages });
      return mockFetch({})(url, options);
    };
    expect(
      await createReplyTransport(liveConfig, transport)(
        token,
        messages,
        new AbortController().signal,
      ),
    ).toBe('accepted');
    expect(inspected).toBe(true);
  });
  it.each([400, 401, 403, 429, 500, 503])('HTTP %i 只發一次，不推播補發', async (status) => {
    let requests = 0;
    const transport: HttpFetch = (url, options) => {
      requests += 1;
      return mockFetch({ private: 'synthetic-canary' }, status)(url, options);
    };
    const outcome = await createReplyTransport(liveConfig, transport)(
      'synthetic',
      [textMessage('合成')],
      new AbortController().signal,
    );
    expect(outcome).toBe(status < 500 ? 'rejected' : 'unknown');
    expect(requests).toBe(1);
  });
  it('網路錯誤與 timeout 是 unknown，不是假定拒絕或接受', async () => {
    const rejected: HttpFetch = () => Promise.reject(new Error('synthetic-private-canary'));
    expect(
      await createReplyTransport(liveConfig, rejected)(
        'synthetic',
        [textMessage('合成')],
        new AbortController().signal,
      ),
    ).toBe('unknown');
    vi.useFakeTimers();
    const pending = createReplyTransport(liveConfig, () => new Promise(() => {}))(
      'synthetic',
      [textMessage('合成')],
      new AbortController().signal,
    );
    await vi.advanceTimersByTimeAsync(2500);
    expect(await pending).toBe('unknown');
  });
  it('取消、空訊息、超出五則或文字界線不外傳', async () => {
    let calls = 0;
    const transport: HttpFetch = () => {
      calls += 1;
      return Promise.reject(new Error('must-not-call'));
    };
    const reply = createReplyTransport(liveConfig, transport);
    for (const messages of [
      [],
      [textMessage('')],
      [textMessage('x'.repeat(5001))],
      Array.from({ length: 6 }, () => textMessage('合成')),
    ]) {
      expect(await reply('synthetic', messages, new AbortController().signal)).toBe('not_sent');
    }
    expect(await reply('synthetic', [textMessage('合成')], AbortSignal.abort())).toBe('not_sent');
    expect(calls).toBe(0);
  });
  it('demo 明確為 synthetic 且不 HTTP 外傳', async () => {
    let calls = 0;
    const transport: HttpFetch = () => {
      calls += 1;
      return Promise.reject(new Error('must-not-call'));
    };
    expect(
      await createReplyTransport(demoConfig, transport)(
        'synthetic',
        [textMessage('合成')],
        new AbortController().signal,
      ),
    ).toBe('synthetic');
    expect(calls).toBe(0);
  });
});
