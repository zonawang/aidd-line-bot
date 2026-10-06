import type { Location } from '../shared/location.js';
import type { Result } from '../shared/result.js';

export interface Restaurant {
  id: string;
  name: string;
  location: Location;
  businessStatus: 'operational' | 'closed';
  opening: 'open' | 'unknown' | 'closed';
  mapUrl: string;
  attributions: string[];
}

export interface CandidateSet {
  provider: 'synthetic' | 'Google Maps';
  restaurants: Restaurant[];
}

export interface RestaurantSourceAdapter {
  readonly provider: CandidateSet['provider'];
  search(location: Location, signal: AbortSignal): Promise<Result<CandidateSet>>;
}
