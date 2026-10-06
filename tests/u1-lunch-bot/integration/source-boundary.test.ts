import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createGoogleSource,
  GOOGLE_ENDPOINT,
  GOOGLE_FIELDS,
} from '../../../src/restaurant-source-adapter/google.js';
import type { HttpFetch } from '../../../src/shared/http.js';
import { failure, success } from '../../../src/shared/result.js';
import { distanceMeters } from '../../../src/shared/location.js';
import type {
  CandidateSet,
  RestaurantSourceAdapter,
} from '../../../src/restaurant-source-adapter/types.js';
import type { Result } from '../../../src/shared/result.js';
import { createBoundedSource } from '../../../scripts/u1-lunch-bot/live-demo-source.js';
import { googlePlace, liveConfig, mockFetch, origin } from '../fixtures/mvp.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('受控真實展示限額（合成來源，不呼叫外部）', () => {
  const station = { latitude: 25.0478, longitude: 121.517 };
  const signal = new AbortController().signal;

  it('指定地點僅呼叫一次，後續查詢拒絕；診斷只有狀態與次數', async () => {
    const result = success<CandidateSet>({ provider: 'synthetic', restaurants: [] });
    const search = vi.fn<RestaurantSourceAdapter['search']>(() => Promise.resolve(result));
    const report = vi.fn();
    const source = createBoundedSource({ provider: 'synthetic', search }, distanceMeters, report);
    expect(source.attempts).toBe(0);
    expect(await source.search(station, signal)).toBe(result);
    expect(source.attempts).toBe(1);
    expect(await source.search(station, signal)).toEqual(failure('source_auth'));
    expect(search).toHaveBeenCalledExactlyOnceWith(station, signal);
    expect(report.mock.calls).toEqual([
      [{ event: 'source_attempt', attempts: 1 }],
      [{ event: 'source_complete', outcome: 'success', attempts: 1 }],
    ]);
    expect(Object.getOwnPropertyDescriptor(source, 'attempts')).toMatchObject({ set: undefined });
    expect(Object.isFrozen(source)).toBe(true);
  });

  it('await 前已保留額度，併發拒絕且逾時結果不退還額度', async () => {
    let finish: (result: Result<CandidateSet>) => void = () => {};
    const search = vi.fn<RestaurantSourceAdapter['search']>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const report = vi.fn();
    const source = createBoundedSource({ provider: 'synthetic', search }, distanceMeters, report);
    const first = source.search(station, signal);
    expect(source.attempts).toBe(1);
    expect(await source.search(station, signal)).toEqual(failure('source_auth'));
    finish(failure('source_timeout'));
    expect(await first).toEqual(failure('source_timeout'));
    expect(await source.search(station, signal)).toEqual(failure('source_auth'));
    expect(search).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenLastCalledWith({
      event: 'source_complete',
      outcome: 'failure',
      code: 'source_timeout',
      attempts: 1,
    });
  });

  it('來源拋錯也不退還額度，不回傳例外內容', async () => {
    const search = vi.fn<RestaurantSourceAdapter['search']>(() => {
      throw new Error('synthetic-sensitive-error');
    });
    const source = createBoundedSource({ provider: 'synthetic', search }, distanceMeters);
    expect(await source.search(station, signal)).toEqual(failure('source_unavailable'));
    expect(await source.search(station, signal)).toEqual(failure('source_auth'));
    expect(source.attempts).toBe(1);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('區域外、非法座標與已取消不呼叫來源或消耗額度，300 公尺內仍可查詢', async () => {
    const search = vi.fn<RestaurantSourceAdapter['search']>(() =>
      Promise.resolve(success({ provider: 'synthetic', restaurants: [] })),
    );
    const source = createBoundedSource({ provider: 'synthetic', search }, distanceMeters);
    const outside = { ...station, latitude: station.latitude + 0.003 };
    expect(distanceMeters(station, outside)).toBeGreaterThan(300);
    for (const location of [
      outside,
      origin,
      { latitude: NaN, longitude: 0 },
      { ...station, latitude: station.latitude + 180 },
      { ...station, longitude: station.longitude + 360 },
    ])
      expect(await source.search(location, signal)).toEqual(failure('source_auth'));
    expect(await source.search(station, AbortSignal.abort())).toEqual(failure('cancelled'));
    expect(source.attempts).toBe(0);
    expect(search).not.toHaveBeenCalled();
    const inside = { ...station, latitude: station.latitude + 0.002 };
    expect(distanceMeters(station, inside)).toBeLessThan(300);
    expect((await source.search(inside, signal)).ok).toBe(true);
    expect(await source.search(station, AbortSignal.abort())).toEqual(failure('cancelled'));
    expect(source.attempts).toBe(1);
    expect(search).toHaveBeenCalledTimes(1);
  });
});

describe('來源 HTTP 邊界（mock HTTP）', () => {
  it('檢查實際 request、key 與 field mask；只用回傳候選', async () => {
    let inspected = false;
    const transport: HttpFetch = (url, options) => {
      inspected =
        url === GOOGLE_ENDPOINT && options?.method === 'POST' && options.redirect === 'error';
      const headers = new Headers(options?.headers);
      expect(headers.get('X-Goog-Api-Key') === liveConfig.googleApiKey).toBe(true);
      expect(headers.get('X-Goog-FieldMask')).toBe(GOOGLE_FIELDS);
      const body: unknown = JSON.parse(typeof options?.body === 'string' ? options.body : 'null');
      expect(body).toEqual({
        includedTypes: ['restaurant'],
        maxResultCount: 20,
        rankPreference: 'DISTANCE',
        languageCode: 'zh-TW',
        locationRestriction: { circle: { center: origin, radius: 1000 } },
      });
      return mockFetch({ places: [googlePlace()] })(url, options);
    };
    const result = await createGoogleSource(liveConfig, transport).search(
      origin,
      new AbortController().signal,
    );
    expect(inspected).toBe(true);
    expect(result.ok && result.value.restaurants.length).toBe(1);
  });
  it.each([401, 403, 429, 500])('HTTP %i 不冒充無結果', async (status) => {
    const result = await createGoogleSource(
      liveConfig,
      mockFetch({ secret: 'synthetic-canary' }, status),
    ).search(origin, new AbortController().signal);
    expect(result).toEqual(
      failure(status === 401 || status === 403 ? 'source_auth' : 'source_unavailable'),
    );
  });
  it('必要欄位不足及半份錯誤結果 fail closed', async () => {
    const result = await createGoogleSource(
      liveConfig,
      mockFetch({ places: [googlePlace(), {}] }),
    ).search(origin, new AbortController().signal);
    expect(result).toEqual(failure('source_invalid'));
  });
  it('malformed、oversize、錯誤 MIME 與網路故障安全返回', async () => {
    const transports: HttpFetch[] = [
      () =>
        Promise.resolve(new Response('{bad', { headers: { 'Content-Type': 'application/json' } })),
      mockFetch({ large: 'x'.repeat(256 * 1024) }),
      () => Promise.resolve(new Response('{}')),
      () => Promise.reject(new Error('synthetic-provider-secret-canary')),
    ];
    for (const transport of transports) {
      const result = await createGoogleSource(liveConfig, transport).search(
        origin,
        new AbortController().signal,
      );
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result).includes('canary')).toBe(false);
    }
  });
  it('有界 timeout，即使注入 fetch 不配合 abort', async () => {
    vi.useFakeTimers();
    let requests = 0;
    const transport: HttpFetch = () => {
      requests += 1;
      return new Promise(() => {});
    };
    const pending = createGoogleSource(liveConfig, transport).search(
      origin,
      new AbortController().signal,
    );
    await vi.advanceTimersByTimeAsync(3500);
    expect(await pending).toEqual(failure('source_timeout'));
    expect(requests).toBe(1);
  });
  it('取消及非法位置不呼叫 HTTP', async () => {
    let requests = 0;
    const transport: HttpFetch = () => {
      requests += 1;
      return Promise.reject(new Error('should-not-call'));
    };
    const source = createGoogleSource(liveConfig, transport);
    expect(await source.search(origin, AbortSignal.abort())).toEqual(failure('cancelled'));
    expect(
      await source.search({ latitude: 100, longitude: 0 }, new AbortController().signal),
    ).toEqual(failure('invalid_input'));
    expect(requests).toBe(0);
  });
});
