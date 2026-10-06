const maximumUtcMs = 8_640_000_000_000_000;

function validateUtc(value: number): void {
  if (!Number.isSafeInteger(value) || Math.abs(value) > maximumUtcMs) {
    throw new RangeError('invalid_utc_clock');
  }
}

function validateMonotonic(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('invalid_monotonic_clock');
  }
}

export class ControlledClock {
  #utcMs: number;
  #monotonicMs: number;

  constructor(utcMs: number, monotonicMs = 0) {
    validateUtc(utcMs);
    validateMonotonic(monotonicMs);
    this.#utcMs = utcMs;
    this.#monotonicMs = monotonicMs;
  }

  utcNowMs(): number {
    return this.#utcMs;
  }

  monotonicNowMs(): number {
    return this.#monotonicMs;
  }

  advance(durationMs: number): void {
    validateMonotonic(durationMs);
    const nextUtcMs = this.#utcMs + durationMs;
    const nextMonotonicMs = this.#monotonicMs + durationMs;
    validateUtc(nextUtcMs);
    validateMonotonic(nextMonotonicMs);
    this.#utcMs = nextUtcMs;
    this.#monotonicMs = nextMonotonicMs;
  }

  adjustUtc(deltaMs: number): void {
    if (!Number.isSafeInteger(deltaMs)) {
      throw new RangeError('invalid_utc_adjustment');
    }
    const nextUtcMs = this.#utcMs + deltaMs;
    validateUtc(nextUtcMs);
    this.#utcMs = nextUtcMs;
  }

  advanceMonotonic(durationMs: number): void {
    validateMonotonic(durationMs);
    const nextMonotonicMs = this.#monotonicMs + durationMs;
    validateMonotonic(nextMonotonicMs);
    this.#monotonicMs = nextMonotonicMs;
  }
}
