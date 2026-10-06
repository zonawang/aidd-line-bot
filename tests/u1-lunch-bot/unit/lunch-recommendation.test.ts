import { describe, expect, it } from 'vitest';
import { recommendLunch, selectRestaurants } from '../../../src/lunch-recommendation/recommend.js';
import { distanceMeters } from '../../../src/shared/location.js';
import { createDemoSource } from '../../../src/restaurant-source-adapter/demo.js';
import { failure } from '../../../src/shared/result.js';
import { origin, restaurant } from '../fixtures/mvp.js';

describe('推薦與距離', () => {
  it('一公里前、當下、後不先四捨五入', () => {
    const atDistance = (meters: number) => ({
      latitude: 0,
      longitude: meters / (6_378_137 * (Math.PI / 180)),
    });
    const result = selectRestaurants(origin, {
      provider: 'synthetic',
      restaurants: [
        restaurant('before', { location: atDistance(999.999) }),
        restaurant('at', { location: atDistance(1000) }),
        restaurant('after', { location: atDistance(1000.001) }),
      ],
    });
    expect(distanceMeters(origin, atDistance(1000))).toBeCloseTo(1000, 9);
    expect(result.ok && result.value.restaurants.map((entry) => entry.id)).toEqual([
      'before',
      'at',
    ]);
  });
  it('WGS84 南北距離與非法座標', () => {
    expect(distanceMeters(origin, { latitude: 1, longitude: 0 })).toBeCloseTo(110574.3886, 3);
    expect(distanceMeters(origin, { latitude: NaN, longitude: 0 })).toBe(Infinity);
    expect(distanceMeters({ latitude: 91, longitude: 0 }, origin)).toBe(Infinity);
    expect(distanceMeters({ latitude: 1, longitude: 1 }, { latitude: 1, longitude: 1 })).toBe(0);
    expect(
      selectRestaurants(
        { latitude: 0, longitude: 181 },
        { provider: 'synthetic', restaurants: [] },
      ),
    ).toEqual(failure('invalid_input'));
  });
  it('open 優先、unknown 保留、closed 排除與 ID 穩定排序', () => {
    const result = selectRestaurants(origin, {
      provider: 'synthetic',
      restaurants: [
        restaurant('unknown', { opening: 'unknown' }),
        restaurant('b'),
        restaurant('a'),
        restaurant('closed', { opening: 'closed' }),
        restaurant('shutdown', { businessStatus: 'closed' }),
      ],
    });
    expect(result.ok && result.value.restaurants.map((entry) => entry.id)).toEqual([
      'a',
      'b',
      'unknown',
    ]);
  });
  it('完全重複只留一次，資料衝突整個 ID 排除', () => {
    const result = selectRestaurants(origin, {
      provider: 'synthetic',
      restaurants: [
        restaurant('same'),
        restaurant('same'),
        restaurant('conflict'),
        restaurant('conflict', { opening: 'closed' }),
      ],
    });
    expect(result.ok && result.value.restaurants.map((entry) => entry.id)).toEqual(['same']);
  });
  it.each([0, 1, 2, 3, 4])('實際候選數量 %i', (count) => {
    const result = selectRestaurants(origin, {
      provider: 'synthetic',
      restaurants: Array.from({ length: count }, (_unused, index) =>
        restaurant(`fixture-${index.toString()}`),
      ),
    });
    expect(result.ok && result.value.restaurants.length).toBe(Math.min(count, 3));
    expect(
      result.ok &&
        result.value.restaurants.every(
          (entry) => entry.name.includes(entry.id) && entry.mapUrl.startsWith('https:'),
        ),
    ).toBe(true);
  });
  it('合成來源成功、取消與錯誤不冒充零結果', async () => {
    const signal = new AbortController().signal;
    expect((await recommendLunch(createDemoSource(), origin, signal)).ok).toBe(true);
    expect(await recommendLunch(createDemoSource(), origin, AbortSignal.abort())).toEqual(
      failure('cancelled'),
    );
    expect(
      await recommendLunch(createDemoSource(), { latitude: Infinity, longitude: 0 }, signal),
    ).toEqual(failure('invalid_input'));
    expect(
      await recommendLunch(
        { provider: 'synthetic', search: () => Promise.resolve(failure('source_auth')) },
        origin,
        signal,
      ),
    ).toEqual(failure('source_auth'));
    expect(
      await recommendLunch(
        { provider: 'synthetic', search: () => Promise.reject(new Error('synthetic')) },
        origin,
        signal,
      ),
    ).toEqual(failure('source_unavailable'));
  });
});
