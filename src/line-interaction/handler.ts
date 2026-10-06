import type { AppConfig } from '../config.js';
import { recommendLunch } from '../lunch-recommendation/recommend.js';
import type { RestaurantSourceAdapter } from '../restaurant-source-adapter/types.js';
import type { FailureCode } from '../shared/result.js';
import { isCancelled } from '../shared/cancellation.js';
import { ControlState } from './control-state.js';
import { parsePrivateEvent } from './events.js';
import type { PrivateEvent } from './events.js';
import {
  CONFIRM_TEXT,
  HISTORY_TEXT,
  locationGuide,
  noticeMessage,
  recommendationMessages,
  sourceFailureMessage,
  textMessage,
} from './messages.js';
import type { TextMessage } from './messages.js';
import type { ReplyOutcome, ReplyTransport } from './reply.js';

export type Diagnostic =
  ReplyOutcome | FailureCode | 'ignored' | 'duplicate' | 'busy' | 'processing_failed';
export interface InteractionOptions {
  config: AppConfig;
  source: RestaurantSourceAdapter;
  reply: ReplyTransport;
  state: ControlState;
  now?: () => number;
  report?: (code: Diagnostic) => void;
}

async function messagesFor(
  event: PrivateEvent,
  options: InteractionOptions,
  signal: AbortSignal,
): Promise<TextMessage[]> {
  const { state, config } = options;
  if (event.message.type === 'text' && /歷史|刪除|撤回|保存|紀錄|记录/u.test(event.message.text))
    return [textMessage(HISTORY_TEXT)];
  const notice = state.notice(event.userId);
  if (
    event.message.type === 'text' &&
    event.message.text === CONFIRM_TEXT &&
    state.confirm(event.userId, event.timestamp)
  ) {
    return [locationGuide('已確認僅當次處理；請重新傳送 LINE 位置，先前的位置不會使用。')];
  }
  if (!notice || notice.phase !== 'confirmed') {
    if (!state.rememberNotice(event.userId, event.timestamp))
      return [textMessage('目前使用人數較多，請稍後再試。')];
    return [noticeMessage(config)];
  }
  if (event.message.type !== 'location') return [locationGuide()];
  if (event.timestamp < notice.eventTime)
    return [locationGuide('這筆位置早於確認，請重新傳送位置。')];
  const result = await recommendLunch(options.source, event.message.location, signal);
  if (!result.ok) {
    options.report?.(result.error);
    return [sourceFailureMessage(result.error)];
  }
  const rendered = recommendationMessages(result.value);
  if (!rendered.ok) {
    options.report?.(rendered.error);
    return [sourceFailureMessage(rendered.error)];
  }
  return rendered.value;
}

export function createInteraction(options: InteractionOptions) {
  return async (raw: unknown, signal: AbortSignal): Promise<void> => {
    if (isCancelled(signal)) return;
    const event = parsePrivateEvent(raw, (options.now ?? Date.now)());
    if (!event) {
      options.report?.('ignored');
      return;
    }
    const claim = options.state.claimEvent(event.id);
    if (claim !== 'new') {
      options.report?.(claim === 'full' ? 'busy' : 'duplicate');
      return;
    }
    try {
      const messages = await messagesFor(event, options, signal);
      if (isCancelled(signal)) {
        options.report?.('cancelled');
        return;
      }
      const outcome = await options.reply(event.replyToken, messages, signal);
      options.report?.(outcome);
    } catch {
      options.report?.('processing_failed');
    }
  };
}
