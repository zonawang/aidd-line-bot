# Cross-Unit Traceability

## Sources

- ../../inception/requirements-analysis/requirements.md — every literal FR/NFR ID, including referenced detailed IDs.
- ../u1-lunch-bot/code-generation/traceability.json — sole Code Generation map in this one-Unit scope.
- ../u1-lunch-bot/code-generation/mvp-scope-adjustment.md — Deferred status authority, not completed coverage.
- aidlc-state.md: user-stories stage skipped; stories.md does not exist, so no three-segment story ACs are applicable. Do not invent stories or restart that stage.

## Verdict

**Fail for original full requirements**: 39 IDs, 6 OK with an existing target; 33 Deferred, none Missing, no missing target path. Deferred targets pointing to known-limitations.md do not satisfy the OK coverage requirement. The source code map additionally enumerates123 FR/NFR/BR IDs (16OK,107Deferred); that larger denominator is not this original-requirement gate's39. No coverage promotion or product change.

## Per-ID Coverage

| ID | Status | Owning Stage / Unit | Target | Exists | Gate |
| --- | --- | --- | --- | --- | --- |
| FR1 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR1.1 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR1.2 | OK | code-generation / u1-lunch-bot | src/line-interaction/events.ts | true | Pass |
| FR1.3 | OK | code-generation / u1-lunch-bot | src/line-interaction/events.ts | true | Pass |
| FR2 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR2.1 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR2.2 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR2.3 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR3 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR3.1 | OK | code-generation / u1-lunch-bot | src/lunch-recommendation/recommend.ts | true | Pass |
| FR3.2 | OK | code-generation / u1-lunch-bot | src/lunch-recommendation/recommend.ts | true | Pass |
| FR3.3 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR4 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR4.1 | OK | code-generation / u1-lunch-bot | src/line-interaction/messages.ts | true | Pass |
| FR4.2 | OK | code-generation / u1-lunch-bot | src/restaurant-source-adapter/google.ts | true | Pass |
| FR4.3 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR5 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR5.1 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR5.2 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR5.3 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR6 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR7 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR7.1 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR7.2 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR7.3 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR8 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR9 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR9.1 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR9.2 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| FR9.3 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| NFR1 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| NFR2 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| NFR3 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| NFR4 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| NFR5 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| NFR6 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| NFR7 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| NFR8 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |
| NFR9 | Deferred | code-generation / u1-lunch-bot | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/code-generation/known-limitations.md | true | Fail — deferred |

## Uncovered Elements

FR1, FR1.1, FR2, FR2.1, FR2.2, FR2.3, FR3, FR3.3, FR4, FR4.3, FR5, FR5.1, FR5.2, FR5.3, FR6, FR7, FR7.1, FR7.2, FR7.3, FR8, FR9, FR9.1, FR9.2, FR9.3, NFR1, NFR2, NFR3, NFR4, NFR5, NFR6, NFR7, NFR8, NFR9.

These retain their original incomplete status; core recommendation partial implementation remains documented upstream. This finding is to be surfaced in the Build-and-Test failure decision and any subsequent approval gate, never concealed by the MVP label.

