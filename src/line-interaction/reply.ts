import type { AppConfig } from '../config.js';
import { boundedRequest } from '../shared/http.js';
import type { HttpFetch } from '../shared/http.js';
import type { TextMessage } from './messages.js';

export type ReplyOutcome = 'accepted' | 'rejected' | 'unknown' | 'not_sent' | 'synthetic';
export type ReplyTransport = (
  replyToken: string,
  messages: TextMessage[],
  signal: AbortSignal,
) => Promise<ReplyOutcome>;
export const LINE_REPLY_ENDPOINT = 'https://api.line.me/v2/bot/message/reply';

export function createReplyTransport(
  config: AppConfig,
  transport: HttpFetch = fetch,
): ReplyTransport {
  return async (replyToken, messages, signal) => {
    if (
      signal.aborted ||
      messages.length < 1 ||
      messages.length > 5 ||
      messages.some((message) => message.text.length < 1 || message.text.length > 5000)
    )
      return 'not_sent';
    if (config.mode === 'demo') return 'synthetic';
    const result = await boundedRequest(
      transport,
      {
        url: LINE_REPLY_ENDPOINT,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.channelAccessToken}`,
        },
        body: JSON.stringify({ replyToken, messages }),
      },
      { signal, timeoutMs: 2500, maxBytes: 0, readJson: false },
    );
    if (!result.ok) return 'unknown';
    if (result.value.status === 200) return 'accepted';
    if (result.value.status >= 400 && result.value.status < 500) return 'rejected';
    return 'unknown';
  };
}
