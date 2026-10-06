import { createHmac } from 'node:crypto';
import { loadConfig } from '../../../src/config.js';
import type { HttpFetch } from '../../../src/shared/http.js';
import type { Restaurant } from '../../../src/restaurant-source-adapter/types.js';

export const now = Date.UTC(2026, 9, 6, 12);
export const origin = { latitude: 0, longitude: 0 };
export const demoConfig = loadConfig({ APP_MODE: 'demo' });
export const liveConfig = loadConfig({
  APP_MODE: 'live',
  LIVE_AUTHORIZED: 'yes',
  SOURCE_RIGHTS_CONFIRMED: 'yes',
  GOOGLE_FEES_AUTHORIZED: 'yes',
  LINE_CHANNEL_SECRET: 'synthetic-live-secret-canary',
  LINE_CHANNEL_ACCESS_TOKEN: 'synthetic-line-token-canary',
  LINE_DESTINATION: 'U11111111111111111111111111111111',
  GOOGLE_PLACES_API_KEY: 'synthetic-google-key-canary',
  PUBLIC_TERMS_URL: 'https://example.test/terms',
  PUBLIC_PRIVACY_URL: 'https://example.test/privacy',
});

export function restaurant(id = 'fixture-a', overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id,
    name: `合成餐廳 ${id}`,
    location: origin,
    businessStatus: 'operational',
    opening: 'open',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=0,0',
    attributions: [],
    ...overrides,
  };
}

export function googlePlace(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fixture-a',
    displayName: { text: '合成餐廳' },
    location: origin,
    businessStatus: 'OPERATIONAL',
    currentOpeningHours: { openNow: true },
    types: ['restaurant'],
    googleMapsUri: 'https://maps.google.com/?cid=1234',
    attributions: [{ provider: '合成第三方', providerUri: 'https://example.test/source' }],
    ...overrides,
  };
}

export function mockFetch(body: unknown, status = 200): HttpFetch {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
}

export function signed(body: string, secret = demoConfig.channelSecret): string {
  return createHmac('sha256', secret).update(body).digest('base64');
}

export function event(
  id: string,
  message: Record<string, unknown> = { type: 'location', ...origin },
) {
  return {
    type: 'message',
    mode: 'active',
    timestamp: now,
    webhookEventId: id,
    deliveryContext: { isRedelivery: false },
    source: { type: 'user', userId: 'U22222222222222222222222222222222' },
    replyToken: `synthetic-reply-${id}`,
    message: { id: `message-${id}`, ...message },
  };
}
