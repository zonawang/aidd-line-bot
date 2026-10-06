import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../src/config.js';
import { createDemoSource } from '../../../src/restaurant-source-adapter/demo.js';
import {
  createGoogleSource,
  GOOGLE_ENDPOINT,
  parseGoogleCandidates,
} from '../../../src/restaurant-source-adapter/google.js';
import { failure } from '../../../src/shared/result.js';
import { demoConfig, googlePlace, liveConfig, mockFetch, origin } from '../fixtures/mvp.js';

describe('來源與設定', () => {
  it('Google 必要欄位、地圖與第三方 attribution', () => {
    const result = parseGoogleCandidates({ places: [googlePlace()] });
    expect(result.ok && result.value.provider).toBe('Google Maps');
    expect(result.ok && result.value.restaurants[0]?.attributions).toEqual([
      '合成第三方 https://example.test/source',
    ]);
    expect(GOOGLE_ENDPOINT).toBe('https://places.googleapis.com/v1/places:searchNearby');
  });
  it('未知營業時間不變成營業中', () => {
    const result = parseGoogleCandidates({
      places: [googlePlace({ currentOpeningHours: undefined })],
    });
    expect(result.ok && result.value.restaurants[0]?.opening).toBe('unknown');
    const closed = parseGoogleCandidates({
      places: [googlePlace({ businessStatus: 'CLOSED_TEMPORARILY' })],
    });
    expect(closed.ok && closed.value.restaurants[0]?.businessStatus).toBe('closed');
  });
  it.each([
    { displayName: {} },
    { location: { latitude: '0', longitude: 0 } },
    { location: { latitude: 100, longitude: 0 } },
    { googleMapsUri: 'https://example.test/map' },
    { googleMapsUri: 'javascript:bad' },
    { types: [] },
    { currentOpeningHours: { openNow: 'true' } },
    { businessStatus: 'UNKNOWN' },
    { attributions: [{ provider: 'missing-url' }] },
    { attributions: 'wrong' },
  ])('不完整或錯型拒絕 %#', (override) => {
    expect(parseGoogleCandidates({ places: [googlePlace(override)] })).toEqual(
      failure('source_invalid'),
    );
  });
  it('空清單、格式錯誤、超出來源上限分開', () => {
    expect(parseGoogleCandidates({})).toEqual({
      ok: true,
      value: { provider: 'Google Maps', restaurants: [] },
    });
    for (const payload of [
      null,
      [],
      { places: null },
      { places: 'wrong' },
      { error: {} },
      { places: Array.from({ length: 21 }, () => googlePlace()) },
    ]) {
      expect(parseGoogleCandidates(payload)).toEqual(failure('source_invalid'));
    }
  });
  it('demo 不讀憑證、不開真實出口', async () => {
    expect(loadConfig({ APP_MODE: 'demo', GOOGLE_PLACES_API_KEY: 'ignored' }).googleApiKey).toBe(
      '',
    );
    expect(() => createGoogleSource(demoConfig, mockFetch({}))).toThrow();
    expect((await createDemoSource().search(origin, new AbortController().signal)).ok).toBe(true);
    expect(await createDemoSource().search(origin, AbortSignal.abort())).toEqual(
      failure('cancelled'),
    );
    expect(
      await createDemoSource().search({ latitude: 91, longitude: 0 }, new AbortController().signal),
    ).toEqual(failure('invalid_input'));
    expect(liveConfig.mode).toBe('live');
  });
  it('缺少模式、授權或非法設定立即失敗', () => {
    expect(() => loadConfig({})).toThrow();
    expect(() => loadConfig({ APP_MODE: 'demo', PORT: '0' })).toThrow();
    expect(() => loadConfig({ APP_MODE: 'live' })).toThrow();
    expect(() =>
      loadConfig({
        APP_MODE: 'live',
        LIVE_AUTHORIZED: 'yes',
        SOURCE_RIGHTS_CONFIRMED: 'yes',
        GOOGLE_FEES_AUTHORIZED: 'yes',
      }),
    ).toThrow();
  });
});
