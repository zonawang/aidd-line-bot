import { describe, expect, it, vi } from 'vitest';
import { ControlState } from '../../../src/line-interaction/control-state.js';
import { parsePrivateEvent } from '../../../src/line-interaction/events.js';
import { createInteraction } from '../../../src/line-interaction/handler.js';
import type { Diagnostic } from '../../../src/line-interaction/handler.js';
import { CONFIRM_TEXT } from '../../../src/line-interaction/messages.js';
import type { TextMessage } from '../../../src/line-interaction/messages.js';
import { createDemoSource } from '../../../src/restaurant-source-adapter/demo.js';
import { demoConfig, event, now } from '../fixtures/mvp.js';

function setup() {
  let calls = 0;
  const messages: TextMessage[][] = [];
  const codes: Diagnostic[] = [];
  const state = new ControlState();
  const demo = createDemoSource();
  const handle = createInteraction({
    config: demoConfig,
    state,
    now: () => now,
    source: {
      provider: 'synthetic',
      search: (location, signal) => {
        calls += 1;
        return demo.search(location, signal);
      },
    },
    reply: (_token, outgoing) => {
      messages.push(outgoing);
      return Promise.resolve('synthetic');
    },
    report: (code) => {
      codes.push(code);
    },
  });
  return { handle, messages, codes, state, calls: () => calls };
}

describe('LINE 私訊核心', () => {
  it('只接受 active 私訊；群組、standby、缺欄位與非法位置忽略', () => {
    expect(parsePrivateEvent(event('valid'), now)?.message.type).toBe('location');
    for (const raw of [
      null,
      { ...event('group'), source: { type: 'group' } },
      { ...event('standby'), mode: 'standby' },
      { ...event('invalid'), replyToken: '' },
      event('bad-location', { type: 'location', latitude: 91, longitude: 0 }),
      event('bad-type', { type: 'location', latitude: '0', longitude: 0 }),
      { ...event('follow'), type: 'follow' },
    ]) {
      expect(parsePrivateEvent(raw, now)).toBeNull();
    }
  });
  it('24 小時至未來五分鐘事件邊界', () => {
    for (const delta of [-86_400_000, 300_000])
      expect(parsePrivateEvent({ ...event('edge'), timestamp: now + delta }, now)).not.toBeNull();
    for (const delta of [-86_400_001, 300_001])
      expect(parsePrivateEvent({ ...event('expired'), timestamp: now + delta }, now)).toBeNull();
  });
  it('第一筆位置不呼叫來源，確認後仍須重傳', async () => {
    const context = setup();
    const signal = new AbortController().signal;
    await context.handle(event('first'), signal);
    expect(context.calls()).toBe(0);
    expect(context.messages[0]?.[0]?.text.includes('重新傳送位置')).toBe(true);
    await context.handle(event('confirm', { type: 'text', text: CONFIRM_TEXT }), signal);
    expect(context.calls()).toBe(0);
    await context.handle(event('resent'), signal);
    expect(context.calls()).toBe(1);
    expect(context.messages[2]?.length).toBe(4);
  });
  it('未先告知的確認、另一使用者與舊位置不能啟用來源', async () => {
    const context = setup();
    const signal = new AbortController().signal;
    await context.handle(event('unsolicited', { type: 'text', text: CONFIRM_TEXT }), signal);
    expect(context.state.notice(event('x').source.userId)?.phase).toBe('pending');
    await context.handle(
      { ...event('confirmation', { type: 'text', text: CONFIRM_TEXT }), timestamp: now + 1 },
      signal,
    );
    await context.handle(event('old-location'), signal);
    await context.handle(
      { ...event('other'), source: { type: 'user', userId: 'U33333333333333333333333333333333' } },
      signal,
    );
    expect(context.calls()).toBe(0);
  });
  it('重送與同時重送只處理一次', async () => {
    const context = setup();
    const signal = new AbortController().signal;
    await Promise.all([
      context.handle(event('same'), signal),
      context.handle(event('same'), signal),
    ]);
    expect(context.messages.length).toBe(1);
    expect(context.codes.includes('duplicate')).toBe(true);
  });
  it('文字與不支援訊息引導，不假稱歷史已刪除', async () => {
    const context = setup();
    const signal = new AbortController().signal;
    await context.handle(event('start', { type: 'text', text: '午餐' }), signal);
    await context.handle(event('confirm', { type: 'text', text: CONFIRM_TEXT }), signal);
    await context.handle(event('photo', { type: 'image' }), signal);
    await context.handle(event('history', { type: 'text', text: '刪除歷史' }), signal);
    expect(context.messages[2]?.[0]?.quickReply?.items[0]?.action.type).toBe('location');
    expect(context.messages[3]?.[0]?.text.includes('尚未提供')).toBe(true);
    expect(context.calls()).toBe(0);
  });
  it('控制資訊容量、TTL、重啟失效且不保留輸入值', () => {
    let clock = 0;
    const state = new ControlState({ clock: () => clock, capacity: 1, noticeTtl: 10 });
    expect(state.claimEvent('synthetic-event-canary')).toBe('new');
    expect(state.claimEvent('synthetic-event-canary')).toBe('duplicate');
    expect(state.claimEvent('another')).toBe('full');
    expect(state.rememberNotice('synthetic-user-canary', now)).toBe(true);
    expect(state.rememberNotice('another', now)).toBe(false);
    expect(state.confirm('synthetic-user-canary', now - 1)).toBe(false);
    expect(state.confirm('synthetic-user-canary', now)).toBe(true);
    expect(JSON.stringify(state)).toBe('{}');
    clock = 10;
    expect(state.notice('synthetic-user-canary')).toBeUndefined();
    expect(state.confirm('synthetic-user-canary', now)).toBe(false);
    clock = 86_700_000;
    expect(state.sizes()).toEqual({ events: 0, notices: 0 });
    expect(new ControlState().notice('synthetic-user-canary')).toBeUndefined();
    expect(() => new ControlState({ capacity: 0 })).toThrow();
  });
  it('忽略、取消、回覆拋錯均只發安全分類', async () => {
    const context = setup();
    await context.handle(event('cancel'), AbortSignal.abort());
    await context.handle({}, new AbortController().signal);
    expect(context.messages.length).toBe(0);
    const codes: Diagnostic[] = [];
    const handle = createInteraction({
      config: demoConfig,
      source: createDemoSource(),
      state: new ControlState(),
      now: () => now,
      reply: () => Promise.reject(new Error('synthetic-private-canary')),
      report: (code) => {
        codes.push(code);
      },
    });
    await handle(event('failed'), new AbortController().signal);
    expect(codes).toEqual(['processing_failed']);
  });
  it('閒置時定時清除過期資料，關閉時停止 timer', () => {
    vi.useFakeTimers();
    try {
      const clock = vi.fn(() => 0);
      const state = new ControlState({ clock, noticeTtl: 1000 });
      state.rememberNotice('synthetic-user', now);
      state.claimEvent('synthetic-event');
      clock.mockReturnValue(86_700_000);
      clock.mockClear();
      vi.advanceTimersByTime(1000);
      expect(clock.mock.calls.length).toBe(1);
      expect(state.sizes()).toEqual({ events: 0, notices: 0 });
      state.clear();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
