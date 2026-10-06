# Integration Test Instructions

## Sources

- ../u1-lunch-bot/code-generation/unit-test-instructions.md — retain every distinct exact applicable selector command once.
- ../u1-lunch-bot/code-generation/code-generation-plan.md — test-after / 80% floor.
- ../u1-lunch-bot/code-generation/code-summary.md — synthetic versus real evidence.

## Setup and Data

Existing Vitest config, safe reporter, single worker, no retry/cache. Only synthetic fixtures and injected transports/time. The runner, legacy mock-only units and MVP tests never require PG or real LINE/Places. Do not use an unscoped integration command. User Stories was skipped; there is one Unit, no cross-unit transport.

## Commands

Execute each command in the current upstream Exact Commands table once, including runner, recommendation/source units, source-boundary integration, LINE units, webhook/reply integration, messages, E2E, full unit regression and exact eight-file coverage selector. Build/types/lint/format are deduplicated with build-instructions.md. This preserves stage Step9 command execution requirements, not a request to repeat implementation.

Coverage command:

```sh
npm run test:coverage -- --project u1-lunch-bot-unit --project u1-lunch-bot-integration --project u1-lunch-bot-e2e tests/u1-lunch-bot/unit/lunch-recommendation.test.ts tests/u1-lunch-bot/unit/restaurant-source-adapter.test.ts tests/u1-lunch-bot/unit/line-interaction.test.ts tests/u1-lunch-bot/unit/messages.test.ts tests/u1-lunch-bot/integration/source-boundary.test.ts tests/u1-lunch-bot/integration/webhook.test.ts tests/u1-lunch-bot/integration/line-reply.test.ts tests/u1-lunch-bot/e2e/lunch-bot.test.ts
```

## Expectations and Evidence

Zero failed/skipped applicable tests; all src/**/*.ts including unloaded files, exclude=[], lines≥80%. Suites overlap: never sum their totals as unique tests. Test results link a per-command exit/count record and coverage numerator/denominator. Required boundaries: raw HMAC/destination/private input, consent/resend, 1km/duplicates/unknown, provider errors, LINE accepted/rejected/unknown without retries/push, output privacy, policy routes.

Real Client success is historical evidence in ../u1-lunch-bot/code-generation/line-live-verification.md, not freshly rerun. Original history lifecycle / real PostgreSQL tests are Deferred and not claimed green.

