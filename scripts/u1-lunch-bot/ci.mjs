import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '../..');
const childEnvironment = { CI: 'true' };

for (const name of [
  'PATH',
  'HOME',
  'TMPDIR',
  'SystemRoot',
  'SystemDrive',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'LANG',
  'LC_ALL',
  'TERM',
]) {
  if (process.env[name] !== undefined) {
    childEnvironment[name] = process.env[name];
  }
}

const coverageFiles = [
  'tests/u1-lunch-bot/unit/lunch-recommendation.test.ts',
  'tests/u1-lunch-bot/unit/restaurant-source-adapter.test.ts',
  'tests/u1-lunch-bot/unit/line-interaction.test.ts',
  'tests/u1-lunch-bot/unit/messages.test.ts',
  'tests/u1-lunch-bot/integration/source-boundary.test.ts',
  'tests/u1-lunch-bot/integration/webhook.test.ts',
  'tests/u1-lunch-bot/integration/line-reply.test.ts',
  'tests/u1-lunch-bot/e2e/lunch-bot.test.ts',
];

const checks = [
  ['format', ['run', 'format:check']],
  ['lint', ['run', 'lint']],
  ['typecheck', ['run', 'typecheck']],
  ['build', ['run', 'build']],
  [
    'unit',
    ['run', 'test:unit', '--', '--project', 'u1-lunch-bot-unit', 'tests/u1-lunch-bot/unit/'],
  ],
  [
    'mvp-coverage',
    [
      'run',
      'test:coverage',
      '--',
      '--project',
      'u1-lunch-bot-unit',
      '--project',
      'u1-lunch-bot-integration',
      '--project',
      'u1-lunch-bot-e2e',
      ...coverageFiles,
    ],
  ],
  ['demo', ['run', 'demo']],
];

function emit(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function runNpm(argumentsList) {
  return spawnSync('npm', argumentsList, {
    cwd: workspaceRoot,
    env: childEnvironment,
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 1024 * 1024,
  });
}

function testCounts(output) {
  for (const line of (output ?? '').split('\n')) {
    if (!line.startsWith('{')) continue;
    try {
      const report = JSON.parse(line);
      const fields = ['tests', 'passed', 'failed', 'incomplete', 'errors'];
      if (
        report.unit === 'u1-lunch-bot' &&
        report.suite === 'vitest' &&
        fields.every((field) => Number.isSafeInteger(report[field]) && report[field] >= 0)
      ) {
        return Object.fromEntries(fields.map((field) => [field, report[field]]));
      }
    } catch {
      continue;
    }
  }
  return {};
}

function applicationCoverage() {
  const report = JSON.parse(
    readFileSync(join(workspaceRoot, 'coverage/u1-lunch-bot/coverage-summary.json'), 'utf8'),
  );
  const sourceFiles = readdirSync(join(workspaceRoot, 'src'), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => join(entry.parentPath, entry.name));
  const reportedFiles = new Set(
    Object.keys(report)
      .filter((name) => name !== 'total')
      .map((name) => resolve(workspaceRoot, name)),
  );
  const { covered, total } = report.total.lines;
  if (
    sourceFiles.length === 0 ||
    !sourceFiles.every((name) => reportedFiles.has(name)) ||
    !Number.isSafeInteger(covered) ||
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    covered < 0 ||
    covered > total ||
    (covered / total) * 100 < 80
  ) {
    return null;
  }
  return {
    coveredLines: covered,
    totalLines: total,
    lineCoverage: Math.floor((covered / total) * 10_000) / 100,
    sourceFiles: sourceFiles.length,
    minimumLineCoverage: 80,
  };
}

function finish(status, exitCode, details = {}) {
  emit({
    event: 'pipeline_complete',
    pipeline: 'local-mvp',
    status,
    ...details,
    mergeReady: false,
    securityScans: 'unverified',
    hostedCI: 'unverified',
    productionReady: false,
  });
  return exitCode;
}

function runPipeline() {
  if (process.argv.length !== 2) {
    return finish('failed', 1, { reason: 'unsupported_arguments' });
  }
  if (process.versions.node !== '24.18.0') {
    return finish('failed', 1, { reason: 'node_version_mismatch' });
  }
  const npmVersion = runNpm(['--version']);
  if (npmVersion.status !== 0 || npmVersion.stdout.trim() !== '11.16.0') {
    return finish('failed', 1, { reason: 'npm_unavailable_or_version_mismatch' });
  }
  let coverage;
  for (const [name, argumentsList] of checks) {
    emit({ event: 'check_started', check: name });
    const result = runNpm(argumentsList);
    const exitCode = result.status ?? 1;
    emit({
      event: 'check_complete',
      check: name,
      status: exitCode === 0 ? 'passed' : 'failed',
      exitCode,
      ...testCounts(result.stdout),
    });
    if (exitCode !== 0) {
      return finish('failed', exitCode, { failedCheck: name });
    }
    if (name === 'mvp-coverage') {
      try {
        coverage = applicationCoverage();
      } catch {
        coverage = null;
      }
      if (!coverage) {
        return finish('failed', 1, { reason: 'application_coverage_invalid' });
      }
    }
  }
  return finish('passed', 0, { checks: checks.length, ...coverage });
}

process.exitCode = runPipeline();
