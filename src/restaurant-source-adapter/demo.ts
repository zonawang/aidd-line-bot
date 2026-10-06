import { failure, success } from '../shared/result.js';
import { isLocation } from '../shared/location.js';
import type { RestaurantSourceAdapter } from './types.js';

export function createDemoSource(): RestaurantSourceAdapter {
  return {
    provider: 'synthetic',
    search(location, signal) {
      if (signal.aborted) return Promise.resolve(failure('cancelled'));
      if (!isLocation(location)) return Promise.resolve(failure('invalid_input'));
      return Promise.resolve(
        success({
          provider: 'synthetic',
          restaurants: [
            { id: 'demo-a', name: '合成午餐甲', latitude: 0.001, opening: 'open' as const },
            { id: 'demo-b', name: '合成午餐乙', latitude: 0.002, opening: 'open' as const },
            { id: 'demo-c', name: '合成午餐丙', latitude: 0.003, opening: 'unknown' as const },
          ].map((entry) => ({
            id: entry.id,
            name: entry.name,
            location: { latitude: entry.latitude, longitude: 0 },
            businessStatus: 'operational' as const,
            opening: entry.opening,
            mapUrl: `https://www.google.com/maps/search/?api=1&query=${entry.latitude.toString()},0`,
            attributions: ['synthetic：虛構店家，地圖只表示合成座標'],
          })),
        }),
      );
    },
  };
}
