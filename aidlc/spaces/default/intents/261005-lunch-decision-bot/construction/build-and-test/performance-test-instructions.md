# Performance Test Instructions

## Sources

- ../u1-lunch-bot/nfr-requirements/performance-requirements.md and scalability-requirements.md.
- ../u1-lunch-bot/nfr-design/performance-design.md and scalability-design.md.
- ../u1-lunch-bot/code-generation/mvp-scope-adjustment.md and code-summary.md.

## Targets and Setup

Preserve original 300 queries/300 seconds, 20 synthetic identities, separate five concurrent requests, ACK p95≤1000ms, LINE accepted p95≤5000ms and shared 10000ms initiation deadline. Nearest rank ceil(.95*N), include eligible failures and missing replies. Do not infer p95 from total test runtime or the one live demo.

## Execution Boundary

No benchmark/PG/platform command in this MVP run. Existing scoped unit/integration cases check cancellation, capacity and deadline behavior, not the original load acceptance. Full deployment/performance-validation stages are skipped, so there is no scheduled later owner that makes deferral successful. Original benchmark targets remain Unverified (or Not Met where implementation divergence is established), owned by Build and Test until separately authorized. Do not run the legacy performance project blindly or contact live APIs.

## Evidence and Follow-up

Record missing samples, measured versus unmeasured values and applicable design divergence in target matrix. Future authorization must first define synthetic target, limits, safe telemetry and missing history/platform scope. No lower threshold, new production topology or infra diagnosis as a workaround.

