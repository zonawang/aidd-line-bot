# Local Command Evidence

## Sources

Executed at workspace root on 2026-10-06 for Build and Test. Existing Node v24.18.0 / npm 11.16.0, no install/update. Commands from upstream unit-test-instructions.md plus offline demo. All fixture/provider transport is synthetic; no runtime .env read, real network API or DB connection.

## Collection Notes

Distinct upstream selectors executed once except unit-regression: the first run's collection lost its final response after terminal-session closure (tool reported Unknown process id), so that command alone was repeated to obtain a reliable exit/count record. No pass claim is based on the interrupted collection. Fifteen command identities below; overlapping test totals must not be added.

## build

Command: `npm run build`

Exit: 0

```text
exit_code=0; no diagnostic errors.
```

## typecheck

Command: `npm run typecheck`

Exit: 0

```text
exit_code=0; no diagnostic errors.
```

## lint

Command: `npm run lint`

Exit: 0

```text
exit_code=0; no diagnostic errors.
```

## format

Command: `npm run format:check`

Exit: 0

```text
All matched files use Prettier code style!
```

## whitespace

Command: `git diff --check`

Exit: 0

```text
exit_code=0; no diagnostic errors.
```

## runner

Command: `npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/runner.test.ts`

Exit: 0

```text
{"unit":"u1-lunch-bot","suite":"vitest","status":"pass","tests":36,"passed":36,"failed":0,"incomplete":0,"errors":0,"errorCategory":null}
```

## recommendation-source

Command: `npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/lunch-recommendation.test.ts tests/u1-lunch-bot/unit/restaurant-source-adapter.test.ts`

Exit: 0

```text
{"unit":"u1-lunch-bot","suite":"vitest","status":"pass","tests":25,"passed":25,"failed":0,"incomplete":0,"errors":0,"errorCategory":null}
```

## source-boundary

Command: `npm run test:integration -- --project u1-lunch-bot-integration tests/u1-lunch-bot/integration/source-boundary.test.ts`

Exit: 0

```text
{"unit":"u1-lunch-bot","suite":"vitest","status":"pass","tests":13,"passed":13,"failed":0,"incomplete":0,"errors":0,"errorCategory":null}
```

## line-interaction

Command: `npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/line-interaction.test.ts`

Exit: 0

```text
{"unit":"u1-lunch-bot","suite":"vitest","status":"pass","tests":9,"passed":9,"failed":0,"incomplete":0,"errors":0,"errorCategory":null}
```

## webhook-reply

Command: `npm run test:integration -- --project u1-lunch-bot-integration tests/u1-lunch-bot/integration/webhook.test.ts tests/u1-lunch-bot/integration/line-reply.test.ts`

Exit: 0

```text
{"unit":"u1-lunch-bot","suite":"vitest","status":"pass","tests":22,"passed":22,"failed":0,"incomplete":0,"errors":0,"errorCategory":null}
```

## messages

Command: `npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/messages.test.ts`

Exit: 0

```text
{"unit":"u1-lunch-bot","suite":"vitest","status":"pass","tests":8,"passed":8,"failed":0,"incomplete":0,"errors":0,"errorCategory":null}
```

## e2e

Command: `npm run test:e2e -- --project u1-lunch-bot-e2e tests/u1-lunch-bot/e2e/lunch-bot.test.ts`

Exit: 0

```text
{"unit":"u1-lunch-bot","suite":"vitest","status":"pass","tests":4,"passed":4,"failed":0,"incomplete":0,"errors":0,"errorCategory":null}
```

## unit-regression

Command: `npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/`

Exit: 0

```text
{"unit":"u1-lunch-bot","suite":"vitest","status":"pass","tests":390,"passed":390,"failed":0,"incomplete":0,"errors":0,"errorCategory":null}
```

## coverage

Command: `npm run test:coverage -- --project u1-lunch-bot-unit --project u1-lunch-bot-integration --project u1-lunch-bot-e2e tests/u1-lunch-bot/unit/lunch-recommendation.test.ts tests/u1-lunch-bot/unit/restaurant-source-adapter.test.ts tests/u1-lunch-bot/unit/line-interaction.test.ts tests/u1-lunch-bot/unit/messages.test.ts tests/u1-lunch-bot/integration/source-boundary.test.ts tests/u1-lunch-bot/integration/webhook.test.ts tests/u1-lunch-bot/integration/line-reply.test.ts tests/u1-lunch-bot/e2e/lunch-bot.test.ts`

Exit: 0

```text
{"unit":"u1-lunch-bot","suite":"vitest","status":"pass","tests":81,"passed":81,"failed":0,"incomplete":0,"errors":0,"errorCategory":null}
```

## demo

Command: `npm run demo`

Exit: 0

```text
mode=synthetic; realLineAccepted=false; sourceCalls=1; replyCalls=4; recommendations=3 (only aggregates retained).
```

## Coverage Denominator

coverage/u1-lunch-bot/coverage-summary.json: lines covered383 / total422, skipped0, pct90.75. All18 src files are present. vitest.config.ts: include=['src/**/*.ts']; exclude=[]; threshold.lines=80; autoUpdate=false. Generated coverage/dist remain Git-ignored.

## Security Preflight

`git check-ignore .env .DS_Store` listed both; `git ls-files -- .env .DS_Store` returned no paths. `command -v` found none of gitleaks/semgrep/osv-scanner on PATH. This is not a scanner success. No secret content was opened, read or copied.

