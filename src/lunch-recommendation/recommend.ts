import { distanceMeters, isLocation } from '../shared/location.js';
import type { Location } from '../shared/location.js';
import { failure, success } from '../shared/result.js';
import type { Result } from '../shared/result.js';
import { isCancelled } from '../shared/cancellation.js';
import type {
  CandidateSet,
  Restaurant,
  RestaurantSourceAdapter,
} from '../restaurant-source-adapter/types.js';

export interface Recommendation extends Restaurant {
  distanceMeters: number;
}
export interface LunchRecommendation {
  provider: CandidateSet['provider'];
  restaurants: Recommendation[];
}

export function selectRestaurants(
  location: Location,
  candidates: CandidateSet,
): Result<LunchRecommendation> {
  if (!isLocation(location)) return failure('invalid_input');
  const unique = new Map<string, Restaurant>();
  const conflicts = new Set<string>();
  for (const restaurant of candidates.restaurants) {
    const prior = unique.get(restaurant.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(restaurant)) conflicts.add(restaurant.id);
    unique.set(restaurant.id, restaurant);
  }
  const restaurants = Array.from(unique.values())
    .filter(
      (restaurant) =>
        !conflicts.has(restaurant.id) &&
        restaurant.businessStatus === 'operational' &&
        restaurant.opening !== 'closed',
    )
    .map((restaurant) => ({
      ...restaurant,
      distanceMeters: distanceMeters(location, restaurant.location),
    }))
    .filter((restaurant) => restaurant.distanceMeters <= 1000)
    .sort(
      (left, right) =>
        Number(left.opening !== 'open') - Number(right.opening !== 'open') ||
        left.distanceMeters - right.distanceMeters ||
        (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
    )
    .slice(0, 3);
  return success({ provider: candidates.provider, restaurants });
}

export async function recommendLunch(
  source: RestaurantSourceAdapter,
  location: Location,
  signal: AbortSignal,
): Promise<Result<LunchRecommendation>> {
  if (!isLocation(location)) return failure('invalid_input');
  if (isCancelled(signal)) return failure('cancelled');
  try {
    const candidates = await source.search(location, signal);
    if (isCancelled(signal)) return failure('cancelled');
    return candidates.ok ? selectRestaurants(location, candidates.value) : candidates;
  } catch {
    return failure('source_unavailable');
  }
}
