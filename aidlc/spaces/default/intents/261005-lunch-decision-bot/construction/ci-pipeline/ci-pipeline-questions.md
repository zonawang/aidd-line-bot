# CI Pipeline 問答與摘要確認

## Sources

- [user:priority] 使用者已要求「Time-to-MVP > infrastructure completeness」，允許最低必要測試、可執行展示與既有 workflow 收尾；已授權 non-destructive config、documentation、測試與必要 artifacts 更新。
- [user:boundaries] 使用者保留 remote push/merge、production deployment、付費 API、公開服務、credentials 及實質政策變更的個別核准要求。
- [user:disposition] Build and Test 的實際選擇為 `Accept failure`、`Nothing to add`、`Approve`；回答與核准均由工具記錄，未把原完整版本改成通過。
- [build] `../build-and-test/build-and-test-summary.md`、`test-results.md`、`command-evidence.md`：390/390 單元、81/81 MVP、4/4 E2E、383/422 行＝90.75%；正式完整版本目標及 traceability 仍有缺口。
- [code] `../u1-lunch-bot/code-generation/code-summary.md`、`mvp-scope-adjustment.md`：無歷史推薦切片、鎖版工具、合成 transport 與已完成一次真實 LINE 驗證。
- [team] active-space 已確認 `main` 主幹／短期分支／squash，以及合併前建置、format/lint、tests、≥80% 與必要安全掃描。
- [runtime] `../local-runtime-location.md`：現有 runtime 檔已移出 application source tree，CI 不載入它。
- [inspection] 工作區沒有 `.github/` 或其他現有應用 CI 配置；安全三類 scanner 未安裝。這是先前已知結果，不重複診斷。

## CI Decisions

本節將四項階段問題與既有決策對齊；「執行預設」是本次待確認的具體提案，不偽稱使用者曾選定外部 CI 平台。

| Question | 本次採用內容 | 依據與界線 |
| --- | --- | --- |
| 使用哪個 CI 工具？ | 執行預設：Node 本機可重複執行的 pipeline，提供 `npm run ci`；hosted provider 保留未選定。 | 既有本機可重現交付與 MVP-first 授權；不新增外部服務、不上傳 repo、不安裝工具。 |
| Branch strategy？ | 沿用 `main`、短期分支與 squash。 | [team] 已決定；本階段不建立 branch、不 commit/push/merge。 |
| 合併前 quality gates？ | 既有 local build/typecheck/lint/format/unit/MVP integration+E2E/80% 全部保留；必要安全掃描與 hosted evidence 缺失維持禁止合併。 | [team][build]；local success 標籤只證明本機 MVP checks，不作 merge/production 放行。 |
| Artifact repositories？ | 執行預設：只沿用 Git-ignored `dist/`、`coverage/`；版控紀錄僅安全聚合摘要，不新設 registry/S3/ECR。 | [user:boundaries][runtime]；不發布 artifacts，未來外部儲存另行決定。 |

## Concrete Configuration Proposal

新增檔案與最小修改：

- `scripts/u1-lunch-bot/ci.mjs`：固定 command list，從專案根目錄依序跑；任何子命令失敗或逾時都回 nonzero，無 retry／skip。輸出僅 check ID、exit code、安全測試計數及整體標籤，不回印任意 child stdout/stderr。
- `package.json`：新增 `ci` 指令指向上述 Node runner，不新增依賴，不改其他 scripts。
- `docs/app/ci.md`：本機使用、必要前提、目前無 hosted CI、安全掃描待辦、merge/deploy 未就緒。
- `docs/app/mvp.md`：僅在開頭加 runtime 位置更新與 CI 指引，保留既有成果與當時驗證紀錄。
- 本階段 `ci-config.md`、`quality-gates.md` 及 `verification/phase-check-construction.md`：逐項標記可用本機配置與未完成的原完整版本 gate。

runner 只把既有工具所需的最小系統環境交給子程序，不讀取或繼承 LINE／Google 金鑰、`NODE_OPTIONS` 或 live 授權旗標，不載入任何 `.env`。

固定 jobs：

1. `npm run format:check`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`
5. `npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/`
6. 沿用 unit-test-instructions.md 的完整八檔 `npm run test:coverage` selector（unit＋關鍵 integration＋E2E），include 全 `src/**/*.ts`、空 exclude、lines≥80%。
7. `npm run demo`（synthetic，無 LINE/Google 外呼）。

版本前提為 Node24.18.0 / npm11.16.0。正式使用 pipeline 時重跑這些 jobs；本階段以一次新的完整 runner 執行證明配置可運作，失敗只修本 runner 的 scaffolding，不為此重開產品實作或底層診斷。

## Quality and Completion Semantics

- local pipeline 所有 jobs 通過時只標記 `pipeline=local-mvp`／`checks=passed`；仍明示 `mergeReady=false`、security/hosted CI 未驗證。
- 不提供 automatic deploy、publish、remote trigger 或可略過掃描的 merge 模式。
- 原完整 FR/NFR traceability 未通過的事實保持不變。Construction → Operation readiness 記 `NOT-READY`；目前 Operation 全部 SKIP，沒有啟動／核准該 transition。MVP workflow 收尾與原完整版本放行分別記錄。
- 原安全工具版本／rule pack／offline database 與 hosted provider 留待有明確授權的工作；本輪不以假 flags 或零涵蓋成功替代。
- 若完成 report 的正式檢查仍拒絕收尾，記錄具體原因並停止該動作，不重跑 requirements/design/implementation，不降低 guard。

## Consolidated Summary Confirmation

本次只新增可執行的本機 CI 配置與交接紀錄；沿用所有產品行為、工具與最低品質門檻。沒有 hosted 上傳、掃描安裝、付費、credentials、公開服務或 deployment 動作。既有完整版本缺口及合併限制全部保留。

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
