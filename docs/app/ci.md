# 本機 CI

在專案根目錄執行：

```sh
npm run ci
```

前提是既有 Node 24.18.0、npm 11.16.0 與鎖版依賴已安裝。此指令不安裝依賴或工具；缺少或版本不符時回傳非零狀態。

流程依序執行 format、lint、typecheck、build、390 案既有單元回歸、八檔核心推薦／Webhook／LINE reply／E2E 的 coverage，以及 synthetic demo。測試數量會隨後續變更而改變，不以固定案例數替代測試通過。任何檢查失敗、啟動失敗或逾時都立即停止，沒有重試或跳過。

Vitest 沿用全部 `src/**/*.ts`、空排除清單與至少 80% 行覆蓋率；runner 另核對報告包含每個 `src` TypeScript 檔案，並以 covered/total 計算門檻。只輸出檢查名稱、exit code、安全測試計數與覆蓋率聚合，不回印子程序的任意 stdout/stderr。若需診斷，可在本機重跑失敗項目的既有命令；不要分享金鑰或敏感輸出。

runner 只傳遞必要系統環境，沒有讀取 `.env`，也不把 LINE／Google 金鑰、live 旗標或 `NODE_OPTIONS` 交給檢查程序。所有 adapter 與完整流程測試使用合成輸入及受控 transport，不呼叫真實 LINE／Places、PostgreSQL 或 Lima。`dist/`、`coverage/` 仍為可重建、Git-ignored 的本機產物。

成功的最後一行包含 `pipeline: "local-mvp"`、`status: "passed"` 及覆蓋率；同時維持 `mergeReady: false`、`securityScans: "unverified"`、`hostedCI: "unverified"`、`productionReady: false`。

## 尚未放行的項目

- 尚未選定／啟用外部 CI provider，未推送或上傳程式碼，沒有 hosted job 結果。
- 必要秘密、依賴及 SAST 掃描仍未執行；Gitleaks、Semgrep、OSV-Scanner 的鎖版、本機規則／資料庫與授權存取證據需要後續工作。
- 確認外洩憑證與已確認 Critical／High 風險仍須處置後才可合併；接受 Build and Test 缺口不是安全例外。
- 原完整歷史、負載與平台驗證仍延後；`main`、短期分支／squash 與原合併門檻保持不變。
- 沒有 deploy、publish、remote trigger 或略過必要檢查的 merge 模式。

最新階段交接見 `aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/ci-pipeline/`；真實 LINE 的既有一次成功與追加費用授權界線仍依 `line-live-verification.md`。
