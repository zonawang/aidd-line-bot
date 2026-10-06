# Security Test Instructions

## Sources

- ../u1-lunch-bot/nfr-requirements/security-requirements.md and tech-stack-decisions.md.
- ../u1-lunch-bot/nfr-design/security-design.md and observability-design.md (OD-03).
- ../u1-lunch-bot/code-generation/code-summary.md and mvp-scope-adjustment.md.

## Local Boundary Verification

Use the exact synthetic integration/unit/E2E selectors from integration-test-instructions.md. Verify HMAC, destination, event window, no pre-consent transmission, payload limits, fixed endpoints, no redirect/retry/push and no sensitive canaries in application output. These are security-related tests, not SAST or DAST.

```sh
git check-ignore .env .DS_Store
git ls-files -- .env .DS_Store
command -v gitleaks
command -v semgrep
command -v osv-scanner
```

Ignore check must list both names, tracked-file check must be empty. Scanner availability is preflight, not a clean scan. Do not open, read, print, hash, copy or scan the external runtime file; do not scan the full home directory or dump environment variables.

## Retained Scan Obligations

OD-03 specifies Gitleaks (redacted), Semgrep with pinned local rules/no upload, OSV-Scanner with local database/no dependency upload. None is currently available on PATH. Report Unverified; no npm audit substitution, tool/rule download, external telemetry or dependency upload in this run. CI Pipeline owns the later setup/evidence handoff, but missing scans still prevent claiming a fully passing Build and Test or merge readiness.

## Evidence and Restrictions

Only aggregate counts, fixed classifications and exit codes enter this record; no raw secret/position reports. Future sensitive scan/CI outputs require authorized private access and ≤30-day retention, not committed raw attachments. DAST is not authorized against LINE, Places or the public tunnel. Old credential revocation and general operational compliance remain unverified. No policy change, public endpoint, production deployment or new cost.

