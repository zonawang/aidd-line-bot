import type { TestCase } from 'vitest/node';
import SafeReporter from './safe-reporter.js';
import { safeCheckpoint } from './database-checkpoints.ts';
import { safeSpillObservation } from './spill-observations.ts';

export default class DatabaseReporter extends SafeReporter {
  onTestCaseResult(testCase: TestCase): void {
    const observations: unknown = (testCase.meta() as Record<string, unknown>)['spillObservations'];
    if (Array.isArray(observations)) {
      for (const value of observations.slice(0, 16)) {
        const entry = safeSpillObservation(value);
        if (entry)
          process.stdout.write(
            `${JSON.stringify({ unit: 'u1-lunch-bot', suite: 'spill_observation', ...entry })}\n`,
          );
      }
    }
    const trace: unknown = (testCase.meta() as Record<string, unknown>)['databaseCheckpoints'];
    if (Array.isArray(trace)) {
      for (const value of trace.slice(0, 96)) {
        const entry = safeCheckpoint(value);
        if (entry)
          process.stdout.write(
            `${JSON.stringify({ unit: 'u1-lunch-bot', suite: 'database_checkpoint', ...entry })}\n`,
          );
      }
    }
    const caseId = testCase.name.match(/^[SR][0-9]{2}\b/)?.[0] ?? 'unknown';
    const result = testCase.result();
    const state = result.state;
    process.stdout.write(
      `${JSON.stringify({
        unit: 'u1-lunch-bot',
        suite: 'database_case',
        caseId,
        status: state === 'passed' ? 'pass' : 'fail',
        errorCategory: state === 'passed' ? null : 'database_case_failed_or_incomplete',
      })}\n`,
    );
  }
}
