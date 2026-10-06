# CI Pipeline 配置

## Sources

- `../build-and-test/build-and-test-summary.md`、`test-results.md`、`command-evidence.md`：本機 MVP 通過與 accepted-failure 完整版本處置。
- `../u1-lunch-bot/code-generation/code-summary.md`：現有 Unit／程式／真實 LINE 證據與原限制。
- `ci-pipeline-questions.md`：使用者回覆 `Looks correct`，已取得 summary confirmation 收據，authorization ID `25e54f63ff401f6913e56b57ef4f8ef460d65ea85bfe0975f0b3deb2e355079f`。
- `scripts/u1-lunch-bot/ci.mjs`、`package.json`、`docs/app/ci.md`：本次實際建立的配置與使用說明。
- active-space org/team/project 規則；本階段採用已核准的 MVP-first 交付切片，不更改原 merge／安全門檻。

## Scope and Architecture

Development priority changed to MVP-first / Time-to-MVP optimization.

無現有應用 CI 配置，故本階段需要建立。採用已確認的本機 Node pipeline 作為最小可執行 equivalent；沒有選定或啟用 hosted CI provider。只有既有 U1；不新增服務、DB、VM、外部 registry 或付費依賴。

`npm run ci` 在 runner 所在專案根目錄執行，固定 Node24.18.0 / npm11.16.0。無新依賴／安裝，使用現有 lockfile 與 node_modules。node/npm 不可用或不符就 nonzero。

## Executable Jobs

| Job | 命令／範圍 | Gate |
| --- | --- | --- |
| format | `npm run format:check` | exit0 |
| lint | `npm run lint` | exit0，零 warning |
| typecheck | `npm run typecheck` | exit0 |
| build | `npm run build` | exit0 |
| unit | `npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/` | 全案通過 |
| mvp-coverage | 上游 unit-test-instructions.md 的八檔完整 selector，unit／三項關鍵 integration／E2E | 全案通過；全部 src TS 檔出現在報告，covered/total≥80% |
| demo | `npm run demo` | 合成展示 exit0 |

每個 child process 最多5分鐘／輸出 buffer1MiB，非零、啟動失敗、逾時／超 buffer即停止；無重試與skip。safe Vitest reporter 的計數只接受固定 keys 和非負整數。子程序 stdout/stderr不回印或寫報告，錯誤只顯示 fixed check ID／exit code；可另在本機重跑該命令診斷。

## Environment and Artifact Configuration

只交給子程序 PATH、必要 HOME/TMPDIR/平台路徑及 locale/terminal，CI固定true；不傳 LINE／Google金鑰、live授權旗標、NODE_OPTIONS。不讀取／複製外部 runtime檔，也不載入根目錄 .env。不得把 CI 命令包在有 env-file 的 live 啟動程序內。

只沿用 Git-ignored dist/coverage，可重建；沒有 artifact upload／registry／publish。紀錄只含無真人資料的合成開發驗證聚合，無原始 scan/CI附件。後續任何敏感安全／hosted CI證據仍需受控存取與≤30天政策，不把新scan輸出直接提交。

## Branches, Triggers and Promotion

沿用 main／短期分支／squash。此配置只有明確本機 `npm run ci` trigger；沒有 push／PR／schedule／remote trigger，不建立 branch、不commit/push/merge、不部署。今後選定hosted provider前須確認授權、成本、只讀checkout、固定工具、PR與secrets隔離和證據存取。

local成功最後一行明示 `pipeline=local-mvp`、`mergeReady=false`、`securityScans=unverified`、`hostedCI=unverified`、`productionReady=false`。安全掃描沒有工具不算pass；不提供可略過scanner的merge模式。

## Validation Results

2026-10-06 實際執行最終配置 `npm run ci`，exit0，七項全部 passed：format／lint／typecheck／build、unit390/390、MVP81/81、synthetic demo。全18個src檔案在coverage報告，383/422行＝90.75%，80%門檻不變；案例有重疊，數字不相加。

缺少npm的負向驗證：runner exit1、status=failed、原因為固定分類；注入的合成secret canary未出現在stdout/stderr，測試本身exit0。node語法檢查及git diff --check均exit0。詳 `execution-evidence.md`；無外呼API、runtime檔讀取、DB／Lima動作。

首次配置執行也通過，當時runner把383/422四捨五入顯示90.76%；小幅調整顯示為與Vitest相同的截尾兩位90.75後，已重新跑完整runner通過。門檻始終使用未四捨五入的covered/total判斷，不改coverage分母或測試內容。

## Phase Boundary and Limitations

`../../verification/phase-check-construction.md` 如實記錄原完整版本 NOT-READY；原追溯123項中107Deferred、原跨Unit gate39項中33Deferred，target均存在。Operation在本intent全部SKIP，`next_stage=null`，沒有執行Construction→Operation放行。MVP配置交付不能改成原完整版本驗證成功。

## Review

本階段沒有宣告 reviewer，不重做 Code Generation review。正式tool-owned completion仍需此階段儀式與核准，不據此假造流程完成。
