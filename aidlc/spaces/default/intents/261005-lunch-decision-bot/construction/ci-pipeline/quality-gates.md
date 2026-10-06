# CI Quality Gates

## Sources

- `../build-and-test/build-and-test-summary.md`、`test-results.md`：原品質目標與已接受未完成處置。
- `../u1-lunch-bot/code-generation/code-summary.md`、`unit-test-instructions.md`：固定commands／scope。
- `ci-pipeline-questions.md`：本次已確認的最小本機配置。
- `scripts/u1-lunch-bot/ci.mjs` 與 `vitest.config.ts`：實際failure propagation／coverage enforcement。
- active-space `memory/team.md`、`memory/project.md`：原合併前及秘密／依賴／SAST義務。

## Local MVP Gates

| ID | Required | Current CI Result | Failure Behavior |
| --- | --- | --- | --- |
| G-VERSION | Node24.18.0、npm11.16.0 | Met — 版本檢查通過；缺npm負向驗證exit1 | 不符／不可用即nonzero |
| G-FORMAT | format:check exit0 | Met — exit0 | 停止 |
| G-LINT | lint exit0／零warning | Met — exit0 | 停止 |
| G-TYPES | typecheck exit0 | Met — exit0 | 停止 |
| G-BUILD | build exit0 | Met — exit0 | 停止 |
| G-UNIT | 既有精確Unit suite全案通過 | Met — 390/390；failed/incomplete/errors0 | 不刪案例、不skip |
| G-MVP | 八檔unit/integration/E2E全案通過 | Met — 81/81；含必要完整流程 | 不以替身替換整個產品；維持外部transport受控 |
| G-COVERAGE | 全src TS檔／空exclude；行≥80% | Met — 383/422＝90.75%；18/18src檔 | Report缺漏／無效／不達標即nonzero，門檻不降低 |
| G-DEMO | synthetic完整流程exit0 | Met — exit0 | 合成不冒充真實LINE結果 |
| G-SAFE-OUTPUT | fixed keys／aggregate；無任意child輸出或secret inheritance | Met — 缺工具仍安全failed、合成canary未出現在輸出 | 無法啟動仍明確failed，不回印底層錯誤本文 |

## Merge and Production Gates

| ID | Requirement | Actual | Status |
| --- | --- | --- | --- |
| G-SECRETS | 必要秘密掃描；已確認外洩處置 | Gitleaks尚未可用／未掃描；舊憑證撤銷未驗證 | Unverified — blocks merge |
| G-DEPENDENCIES | 本機依賴掃描／固定資料庫；Critical/High處置 | OSV-Scanner／database未建立，未執行 | Unverified — blocks merge |
| G-SAST | 適用本機固定rule pack／掃描；Critical/High處置 | Semgrep／rules未建立，未執行 | Unverified — blocks merge |
| G-HOSTED | 已授權provider、同一lockfile/checks、最小權限、PR秘密隔離、真實job evidence | 未啟用或執行 | Unverified — blocks merge |
| G-FULL-SCOPE | 原完整FR/NFR／權利歷史／負載／平台驗證 | 原追溯與原Build and Test保留未通過 | NOT-READY — no full-version promotion |
| G-EXTERNAL | 新API費用／入口／credential／production操作核准 | 一次Places額度已用完；本階段無新授權 | 禁止新增外部動作 |
| G-RELEASE | production deployment及必要Operation驗證 | Operation全部SKIP，本輪不正式上線 | NOT-READY |

Build and Test 的 Accept failure／Approve僅允許MVP流程收尾；不是security例外或原完整需求完成。任何必要檢查缺失、失敗、零涵蓋都不能記pass。未知掃描工具flags不寫成可用配置、不安裝或送repo至新外部服務。

## Evidence and Handoff

本機runner輸出只保留可安全核對的聚合；上表來自 `execution-evidence.md` 的實際exit與coverage。raw log／scan hits／CI附件不進record，不讀.env。未來scanner／hosted evidence限授權私密存取與≤30天，不在此階段建立公開證據服務。

原完整負載、歷史、PG／Lima與平台債務沿用known-limitations.md，本次不診斷。詳細phase結果見../../verification/phase-check-construction.md。
