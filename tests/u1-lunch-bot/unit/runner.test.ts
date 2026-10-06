import { describe, expect, it } from 'vitest';
import { ControlledClock } from '../fixtures/clock.js';
import { FaultHarness, SyntheticFault } from '../fixtures/fault-harness.js';
import { summarizeRun } from '../fixtures/safe-reporter.js';
import { createSyntheticScenario, syntheticUtcMs } from '../fixtures/synthetic.js';

describe('RUNNER-CLOCK', () => {
  it('RUNNER-CLOCK-01', () => {
    const clock = new ControlledClock(syntheticUtcMs, 40);
    expect(new Date(clock.utcNowMs()).toISOString()).toBe('2024-02-29T12:00:00.000Z');
    expect(clock.utcNowMs()).toBe(syntheticUtcMs);
    expect(clock.monotonicNowMs()).toBe(40);
    clock.advance(1);
    expect(clock.utcNowMs()).toBe(syntheticUtcMs + 1);
    expect(clock.monotonicNowMs()).toBe(41);
    clock.advance(0);
    expect(clock.monotonicNowMs()).toBe(41);
  });

  it('RUNNER-CLOCK-02', () => {
    const clock = new ControlledClock(syntheticUtcMs);
    clock.adjustUtc(-500);
    expect(clock.utcNowMs()).toBe(syntheticUtcMs - 500);
    expect(clock.monotonicNowMs()).toBe(0);
    clock.advanceMonotonic(1_000);
    expect(clock.utcNowMs()).toBe(syntheticUtcMs - 500);
    expect(clock.monotonicNowMs()).toBe(1_000);
    clock.adjustUtc(1_500);
    expect(clock.utcNowMs()).toBe(syntheticUtcMs + 1_000);
    expect(clock.monotonicNowMs()).toBe(1_000);
  });

  it.each([NaN, Infinity, -Infinity, 0.5, 8_640_000_000_000_001])('RUNNER-CLOCK-03-%#', (value) => {
    expect(() => new ControlledClock(value)).toThrow('invalid_utc_clock');
  });

  it.each([NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])('RUNNER-CLOCK-04-%#', (value) => {
    expect(() => new ControlledClock(syntheticUtcMs, value)).toThrow('invalid_monotonic_clock');
    const clock = new ControlledClock(syntheticUtcMs);
    expect(() => {
      clock.advance(value);
    }).toThrow('invalid_monotonic_clock');
    expect(() => {
      clock.advanceMonotonic(value);
    }).toThrow('invalid_monotonic_clock');
    expect(clock.utcNowMs()).toBe(syntheticUtcMs);
    expect(clock.monotonicNowMs()).toBe(0);
  });

  it('RUNNER-CLOCK-05', () => {
    const utcLimit = new ControlledClock(8_640_000_000_000_000, 20);
    expect(() => {
      utcLimit.advance(1);
    }).toThrow('invalid_utc_clock');
    expect(utcLimit.utcNowMs()).toBe(8_640_000_000_000_000);
    expect(utcLimit.monotonicNowMs()).toBe(20);
    const monotonicLimit = new ControlledClock(syntheticUtcMs, Number.MAX_SAFE_INTEGER);
    expect(() => {
      monotonicLimit.advance(1);
    }).toThrow('invalid_monotonic_clock');
    expect(() => {
      monotonicLimit.advanceMonotonic(1);
    }).toThrow('invalid_monotonic_clock');
    expect(monotonicLimit.utcNowMs()).toBe(syntheticUtcMs);
    expect(monotonicLimit.monotonicNowMs()).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('RUNNER-CLOCK-06', () => {
    const clock = new ControlledClock(-8_640_000_000_000_000);
    expect(() => {
      clock.adjustUtc(-1);
    }).toThrow('invalid_utc_clock');
    expect(() => {
      clock.adjustUtc(NaN);
    }).toThrow('invalid_utc_adjustment');
    expect(() => {
      clock.adjustUtc(0.5);
    }).toThrow('invalid_utc_adjustment');
    expect(clock.utcNowMs()).toBe(-8_640_000_000_000_000);
    expect(clock.monotonicNowMs()).toBe(0);
  });

  it('RUNNER-CLOCK-07', () => {
    const first = new ControlledClock(syntheticUtcMs);
    const second = new ControlledClock(syntheticUtcMs);
    first.advance(1_000);
    expect(second.utcNowMs()).toBe(syntheticUtcMs);
    expect(second.monotonicNowMs()).toBe(0);
  });
});

describe('RUNNER-SYNTHETIC', () => {
  it('RUNNER-SYNTHETIC-01', () => {
    const scenario = createSyntheticScenario('synthetic');
    expect(scenario.queryAtMs).toBe(syntheticUtcMs);
    expect(scenario.location).toEqual({ latitude: 0, longitude: 0 });
    expect(Object.isFrozen(scenario)).toBe(true);
    expect(Object.isFrozen(scenario.location)).toBe(true);
    const subjects = Array.from({ length: 20 }, (_unused, index) =>
      createSyntheticScenario('synthetic', index + 1),
    );
    expect(new Set(subjects.map((subject) => subject.subjectKey)).size).toBe(20);
  });

  it.each(['', 'controlled_integration', 'production'])('RUNNER-SYNTHETIC-02-%#', (profile) => {
    expect(() => createSyntheticScenario(profile)).toThrow('synthetic_profile_required');
    expect(() => new FaultHarness(profile)).toThrow('synthetic_profile_required');
  });

  it.each([0, 21, NaN, Infinity, 1.5])('RUNNER-SYNTHETIC-03-%#', (ordinal) => {
    expect(() => createSyntheticScenario('synthetic', ordinal)).toThrow(
      'invalid_synthetic_subject',
    );
  });
});

describe('RUNNER-FAULT', () => {
  it('RUNNER-FAULT-01', () => {
    const harness = new FaultHarness('synthetic');
    expect(() => {
      harness.trip('source');
    }).not.toThrow();
    harness.arm('source', 'timeout');
    harness.arm('reply', 'unknown');
    expect(() => {
      harness.trip('database');
    }).not.toThrow();
    expect(() => {
      harness.trip('source');
    }).toThrow(new SyntheticFault('timeout'));
    expect(() => {
      harness.trip('source');
    }).not.toThrow();
    expect(() => {
      harness.trip('reply');
    }).toThrow(new SyntheticFault('unknown'));
    expect(() => {
      harness.assertDrained();
    }).not.toThrow();
  });

  it('RUNNER-FAULT-02', () => {
    const harness = new FaultHarness('synthetic');
    harness.arm('database', 'unavailable');
    harness.arm('database', 'unknown');
    const observed: string[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        harness.trip('database');
      } catch (error) {
        if (!(error instanceof SyntheticFault)) {
          throw error;
        }
        observed.push(error.category);
      }
    }
    expect(observed).toEqual(['unavailable', 'unknown']);
    harness.assertDrained();
  });

  it('RUNNER-FAULT-03', () => {
    const harness = new FaultHarness('synthetic');
    harness.arm('reply', 'unknown');
    expect(() => {
      harness.assertDrained();
    }).toThrow('unconsumed_synthetic_fault');
    harness.clear();
    expect(() => {
      harness.assertDrained();
    }).not.toThrow();
    expect(() => {
      harness.trip('reply');
    }).not.toThrow();
  });

  it('RUNNER-FAULT-04', () => {
    const harness = new FaultHarness('synthetic');
    for (let index = 0; index < 32; index += 1) {
      harness.arm('source', 'timeout');
    }
    expect(() => {
      harness.arm('reply', 'unknown');
    }).toThrow('fault_capacity_exceeded');
    harness.clear();
    expect(() => {
      harness.arm('reply', 'unknown');
    }).not.toThrow();
    expect(() => {
      harness.trip('reply');
    }).toThrow(SyntheticFault);
    harness.assertDrained();
  });

  it('RUNNER-FAULT-05', () => {
    const first = new FaultHarness('synthetic');
    const second = new FaultHarness('synthetic');
    first.arm('reply', 'unknown');
    expect(() => {
      second.trip('reply');
    }).not.toThrow();
    expect(() => {
      first.assertDrained();
    }).toThrow('unconsumed_synthetic_fault');
    first.clear();
  });
});

describe('RUNNER-REPORT', () => {
  it('RUNNER-REPORT-01', () => {
    expect(summarizeRun(['passed', 'passed'], ['passed'], 'passed', 0)).toEqual({
      unit: 'u1-lunch-bot',
      suite: 'vitest',
      status: 'pass',
      tests: 2,
      passed: 2,
      failed: 0,
      incomplete: 0,
      errors: 0,
      errorCategory: null,
    });
  });

  it.each(['failed', 'skipped', 'pending', 'unknown'])('RUNNER-REPORT-02-%#', (state) => {
    expect(summarizeRun(['passed', state], ['passed'], 'passed', 0).status).toBe('fail');
    expect(summarizeRun(['passed'], [state], 'passed', 0).status).toBe('fail');
  });

  it('RUNNER-REPORT-03', () => {
    expect(summarizeRun([], ['passed'], 'passed', 0).status).toBe('fail');
    expect(summarizeRun(['passed'], [], 'passed', 0).status).toBe('fail');
    expect(summarizeRun(['passed'], ['passed'], 'interrupted', 0).status).toBe('fail');
    expect(summarizeRun(['passed'], ['passed'], 'passed', 1).status).toBe('fail');
    expect(summarizeRun(['passed'], ['passed'], 'passed', NaN).status).toBe('fail');
  });

  it('RUNNER-REPORT-04', () => {
    const canary = ['synthetic', 'private', 'report', 'canary'].join('-');
    const summary = summarizeRun([canary], [canary], canary, 0);
    expect(summary.status).toBe('fail');
    expect(JSON.stringify(summary).includes(canary)).toBe(false);
    expect(Object.keys(summary)).toEqual([
      'unit',
      'suite',
      'status',
      'tests',
      'passed',
      'failed',
      'incomplete',
      'errors',
      'errorCategory',
    ]);
  });
});
