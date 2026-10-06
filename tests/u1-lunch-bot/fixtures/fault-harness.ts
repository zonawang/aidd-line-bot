const boundaries = ['database', 'source', 'reply'] as const;
const failures = ['timeout', 'unavailable', 'unknown'] as const;

type Boundary = (typeof boundaries)[number];
type Failure = (typeof failures)[number];

export class SyntheticFault extends Error {
  constructor(readonly category: Failure) {
    super('synthetic_fault');
    this.name = 'SyntheticFault';
  }
}

export class FaultHarness {
  readonly #queue: { boundary: Boundary; failure: Failure }[] = [];

  constructor(profile: string) {
    if (profile !== 'synthetic') {
      throw new Error('synthetic_profile_required');
    }
  }

  arm(boundary: Boundary, failure: Failure): void {
    if (!boundaries.includes(boundary) || !failures.includes(failure)) {
      throw new Error('invalid_synthetic_fault');
    }
    if (this.#queue.length >= 32) {
      throw new Error('fault_capacity_exceeded');
    }
    this.#queue.push({ boundary, failure });
  }

  trip(boundary: Boundary): void {
    if (!boundaries.includes(boundary)) {
      throw new Error('invalid_synthetic_boundary');
    }
    const index = this.#queue.findIndex((fault) => fault.boundary === boundary);
    if (index < 0) {
      return;
    }
    const fault = this.#queue.splice(index, 1)[0];
    if (!fault) {
      throw new Error('fault_queue_invariant');
    }
    throw new SyntheticFault(fault.failure);
  }

  assertDrained(): void {
    if (this.#queue.length !== 0) {
      throw new Error('unconsumed_synthetic_fault');
    }
  }

  clear(): void {
    this.#queue.length = 0;
  }
}
