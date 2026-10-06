import type { AppConfig } from '../config.js';
import { boundedRequest } from '../shared/http.js';
import type { HttpFetch } from '../shared/http.js';
import { isLocation } from '../shared/location.js';
import { failure, isRecord, isText, success } from '../shared/result.js';
import type { Result } from '../shared/result.js';
import type { CandidateSet, Restaurant, RestaurantSourceAdapter } from './types.js';

export const GOOGLE_ENDPOINT = 'https://places.googleapis.com/v1/places:searchNearby';
export const GOOGLE_FIELDS =
  'places.id,places.displayName,places.location,places.googleMapsUri,places.businessStatus,places.types,places.attributions,places.currentOpeningHours.openNow';

export function safeHttpsUrl(value: unknown): value is string {
  if (!isText(value, 2048)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function parseRestaurant(value: unknown): Restaurant | null {
  if (
    !isRecord(value) ||
    !isText(value['id'], 256) ||
    !isRecord(value['displayName']) ||
    !isText(value['displayName']['text'], 200) ||
    !isRecord(value['location']) ||
    typeof value['location']['latitude'] !== 'number' ||
    typeof value['location']['longitude'] !== 'number' ||
    !safeHttpsUrl(value['googleMapsUri']) ||
    !Array.isArray(value['types']) ||
    !value['types'].includes('restaurant')
  )
    return null;
  const mapUrl = new URL(value['googleMapsUri']);
  if (!['maps.google.com', 'www.google.com'].includes(mapUrl.hostname) || mapUrl.port) return null;
  const location = {
    latitude: value['location']['latitude'],
    longitude: value['location']['longitude'],
  };
  if (!isLocation(location)) return null;
  const businessStatus = value['businessStatus'];
  if (!['OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'].includes(String(businessStatus)))
    return null;
  const hours = value['currentOpeningHours'];
  if (
    hours !== undefined &&
    (!isRecord(hours) || (hours['openNow'] !== undefined && typeof hours['openNow'] !== 'boolean'))
  )
    return null;
  const attributions: string[] = [];
  if (value['attributions'] !== undefined) {
    if (!Array.isArray(value['attributions']) || value['attributions'].length > 10) return null;
    for (const attribution of value['attributions']) {
      if (
        !isRecord(attribution) ||
        !isText(attribution['provider'], 200) ||
        !safeHttpsUrl(attribution['providerUri'])
      )
        return null;
      attributions.push(`${attribution['provider']} ${attribution['providerUri']}`);
    }
  }
  if (attributions.join('\n').length > 3500) return null;
  const openNow = isRecord(hours) ? hours['openNow'] : undefined;
  return {
    id: value['id'],
    name: value['displayName']['text'],
    location,
    businessStatus: businessStatus === 'OPERATIONAL' ? 'operational' : 'closed',
    opening: openNow === true ? 'open' : openNow === false ? 'closed' : 'unknown',
    mapUrl: value['googleMapsUri'],
    attributions,
  };
}

export function parseGoogleCandidates(payload: unknown): Result<CandidateSet> {
  if (!isRecord(payload)) return failure('source_invalid');
  const places: unknown = payload['places'] === undefined ? [] : payload['places'];
  if (payload['error'] !== undefined || !Array.isArray(places) || places.length > 20)
    return failure('source_invalid');
  const restaurants: Restaurant[] = [];
  for (const place of places) {
    const restaurant = parseRestaurant(place);
    if (!restaurant) return failure('source_invalid');
    restaurants.push(restaurant);
  }
  return success({ provider: 'Google Maps', restaurants });
}

export function createGoogleSource(
  config: AppConfig,
  transport: HttpFetch = fetch,
): RestaurantSourceAdapter {
  if (config.mode !== 'live' || !config.googleApiKey)
    throw new Error('Google 來源需要有效 live 設定');
  return {
    provider: 'Google Maps',
    async search(location, signal) {
      if (!isLocation(location)) return failure('invalid_input');
      const response = await boundedRequest(
        transport,
        {
          url: GOOGLE_ENDPOINT,
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': config.googleApiKey,
            'X-Goog-FieldMask': GOOGLE_FIELDS,
          },
          body: JSON.stringify({
            includedTypes: ['restaurant'],
            maxResultCount: 20,
            rankPreference: 'DISTANCE',
            languageCode: 'zh-TW',
            locationRestriction: { circle: { center: location, radius: 1000 } },
          }),
        },
        { signal, timeoutMs: 3500, maxBytes: 256 * 1024, readJson: true },
      );
      if (!response.ok) return response;
      if ([401, 403].includes(response.value.status)) return failure('source_auth');
      if (response.value.status !== 200) return failure('source_unavailable');
      return parseGoogleCandidates(response.value.body);
    },
  };
}
