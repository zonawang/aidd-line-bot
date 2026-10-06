import type { Reporter, SerializedError, TestModule, TestRunEndReason } from 'vitest/node';

export function summarizeRun(
  testStates: readonly string[],
  moduleStates: readonly string[],
  reason: string,
  errorCount: number,
) {
  const passed = testStates.filter((state) => state === 'passed').length;
  const failed = testStates.filter((state) => state === 'failed').length;
  const incomplete = testStates.length - passed - failed;
  const invalidErrorCount = !Number.isSafeInteger(errorCount) || errorCount < 0;
  const errors = invalidErrorCount ? 1 : errorCount;
  const success =
    reason === 'passed' &&
    moduleStates.length > 0 &&
    moduleStates.every((state) => state === 'passed') &&
    passed > 0 &&
    failed === 0 &&
    incomplete === 0 &&
    errors === 0;

  return {
    unit: 'u1-lunch-bot',
    suite: 'vitest',
    status: success ? 'pass' : 'fail',
    tests: testStates.length,
    passed,
    failed,
    incomplete,
    errors,
    errorCategory: success ? null : 'test_run_failed_or_incomplete',
  };
}

export default class SafeReporter implements Reporter {
  onTestRunEnd(
    modules: readonly TestModule[],
    errors: readonly SerializedError[],
    reason: TestRunEndReason,
  ): void {
    const summary = summarizeRun(
      modules.flatMap((module) =>
        Array.from(module.children.allTests(), (testCase) => testCase.result().state),
      ),
      modules.map((module) => module.state()),
      reason,
      errors.length,
    );
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    if (summary.status !== 'pass') {
      process.exitCode = 1;
    }
  }
}
