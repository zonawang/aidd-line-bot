import type { Location } from '../../src/shared/location.js';
import type { FailureCode, Result } from '../../src/shared/result.js';
import type {
  CandidateSet,
  RestaurantSourceAdapter,
} from '../../src/restaurant-source-adapter/types.js';

type SourceDiagnostic =
  | { event: 'source_attempt'; attempts: 1 }
  | { event: 'source_complete'; outcome: 'success'; attempts: 1 }
  | { event: 'source_complete'; outcome: 'failure'; code: FailureCode; attempts: 1 };

const TEST_CENTER: Readonly<Location> = Object.freeze({ latitude: 25.0478, longitude: 121.517 });

export function createBoundedSource(
  source: RestaurantSourceAdapter,
  distance: (origin: Location, destination: Location) => number,
  report: (diagnostic: SourceDiagnostic) => void = () => {},
): RestaurantSourceAdapter & { readonly attempts: number } {
  let attempts = 0;
  return Object.freeze({
    provider: source.provider,
    get attempts() {
      return attempts;
    },
    async search(location: Location, signal: AbortSignal): Promise<Result<CandidateSet>> {
      if (signal.aborted) return { ok: false, error: 'cancelled' };
      if (
        attempts !== 0 ||
        !Number.isFinite(location.latitude) ||
        Math.abs(location.latitude) > 90 ||
        !Number.isFinite(location.longitude) ||
        Math.abs(location.longitude) > 180
      )
        return { ok: false, error: 'source_auth' };
      const separation = distance(TEST_CENTER, location);
      if (!(separation >= 0 && separation <= 300)) return { ok: false, error: 'source_auth' };
      attempts = 1;
      report({ event: 'source_attempt', attempts: 1 });
      let result: Result<CandidateSet>;
      try {
        result = await source.search(location, signal);
      } catch {
        result = { ok: false, error: 'source_unavailable' };
      }
      report(
        result.ok
          ? { event: 'source_complete', outcome: 'success', attempts: 1 }
          : { event: 'source_complete', outcome: 'failure', code: result.error, attempts: 1 },
      );
      return result;
    },
  });
}
