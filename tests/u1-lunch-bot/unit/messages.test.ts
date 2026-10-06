import { describe, expect, it } from 'vitest';
import {
  CONFIRM_TEXT,
  HISTORY_TEXT,
  locationGuide,
  noticeMessage,
  recommendationMessages,
  sourceFailureMessage,
} from '../../../src/line-interaction/messages.js';
import { failure } from '../../../src/shared/result.js';
import type { FailureCode } from '../../../src/shared/result.js';
import { demoConfig, liveConfig, restaurant } from '../fixtures/mvp.js';

describe('繁中互動訊息', () => {
  it('位置 quick reply 與明確告知確認', () => {
    expect(locationGuide().quickReply?.items[0]?.action).toEqual({
      type: 'location',
      label: '傳送位置',
    });
    expect(noticeMessage(demoConfig).quickReply?.items[0]?.action).toEqual({
      type: 'message',
      label: CONFIRM_TEXT,
      text: CONFIRM_TEXT,
    });
    expect(noticeMessage(demoConfig).text.includes('synthetic')).toBe(true);
    expect(noticeMessage(demoConfig).text.includes('不保存位置')).toBe(true);
  });
  it('live 告知實際 LINE／Google 與公開政策連結', () => {
    const text = noticeMessage(liveConfig).text;
    expect(text.includes('Google Maps（Google Places API）')).toBe(true);
    expect(text.includes('LINE')).toBe(true);
    expect(text.includes(liveConfig.privacyUrl) && text.includes(liveConfig.termsUrl)).toBe(true);
    expect(text.includes('已放棄')).toBe(true);
    expect(text.length <= 5000).toBe(true);
  });
  it.each([0, 1, 2, 3])('實際 %i 家、unknown、來源與地圖', (count) => {
    const result = recommendationMessages({
      provider: 'Google Maps',
      restaurants: Array.from({ length: count }, (_unused, index) => ({
        ...restaurant(`fixture-${index.toString()}`, {
          opening: 'unknown',
          attributions: ['合成來源 https://example.test/source'],
        }),
        distanceMeters: 999.6,
      })),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('訊息格式錯誤');
    expect(result.value.length).toBe(count + 1);
    expect(result.value[0]?.text.includes('不保證')).toBe(true);
    if (count > 0) {
      expect(result.value[0]?.text.includes(`${count.toString()} 家`)).toBe(true);
      const text = result.value[1]?.text ?? '';
      expect(
        text.includes('營業時間未知') &&
          text.includes('fixture-0') &&
          text.includes('Google Maps') &&
          text.includes('https://example.test/source') &&
          text.includes('https://www.google.com/maps/'),
      ).toBe(true);
    }
    if (count === 1 || count === 2) expect(result.value[0]?.text.includes('不足三家')).toBe(true);
  });
  it('來源錯誤不說無結果，歷史未提供不假稱查無／刪除成功', () => {
    const codes: FailureCode[] = [
      'invalid_input',
      'source_auth',
      'source_unavailable',
      'source_timeout',
      'source_invalid',
      'display_limit',
      'cancelled',
    ];
    const texts = codes.map((code) => sourceFailureMessage(code).text);
    expect(new Set(texts).size).toBe(codes.length);
    expect(HISTORY_TEXT.includes('尚未提供')).toBe(true);
    expect(HISTORY_TEXT.includes('不代表舊資源已刪除')).toBe(true);
  });
  it('5000 UTF-16 字元邊界不裁掉必要 attribution', () => {
    const candidate = { ...restaurant(), distanceMeters: 0 };
    const baseline = recommendationMessages({ provider: 'Google Maps', restaurants: [candidate] });
    if (!baseline.ok) throw new Error('baseline_failed');
    const length = baseline.value[1]?.text.length ?? 0;
    candidate.attributions = ['x'.repeat(5000 - length - 1)];
    const exact = recommendationMessages({ provider: 'Google Maps', restaurants: [candidate] });
    expect(exact.ok && exact.value[1]?.text.length).toBe(5000);
    candidate.attributions[0] = `${candidate.attributions[0] ?? ''}x`;
    expect(recommendationMessages({ provider: 'Google Maps', restaurants: [candidate] })).toEqual(
      failure('display_limit'),
    );
  });
});
