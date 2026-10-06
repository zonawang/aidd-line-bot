# Build Instructions

## Sources

- ../u1-lunch-bot/code-generation/code-generation-plan.md — current Testing Contract.
- ../u1-lunch-bot/code-generation/unit-test-instructions.md — exact commands.
- ../u1-lunch-bot/code-generation/code-summary.md — existing implementation.

## Prerequisites and Environment

Workspace root; Node 24.18.0 and npm 11.16.0. Existing locked dependencies are already installed. A clean authorized checkout uses `npm ci --ignore-scripts`; installation is not needed or executed in this run. No PG, Lima, Docker, real credentials or external service is needed. Do not source the local runtime file or run `npm start` for this verification. Runtime relocation is documented in ../local-runtime-location.md.

## Commands and Verification

Run each separately and preserve its exit status:

```sh
npm run build
npm run typecheck
npm run lint
npm run format:check
git diff --check
npm run demo
```

Build emits ignored dist files; demo explicitly uses synthetic providers and reports realLineAccepted=false. Expected: all commands exit0, demo returns three synthetic restaurants. A synthetic success is not a new real LINE result.

## Troubleshooting

Missing dependencies/version: report precise prerequisite; do not change lockfile to hide it. Any build error: preserve safe output, classify before changing code. No infrastructure diagnostics or application changes are pre-authorized by this instruction. Record actual outcomes in test-results.md.

