# U1 推薦 MVP：修訂計畫確認

## Sources

- `mvp-scope-adjustment.md`：使用者要求停止非核心 infrastructure 診斷、Time-to-MVP 優先，並對無歷史推薦 MVP 回答「是」。
- `code-generation-plan.md`：12 步修訂計畫、完整未變更的 Testing Contract；原 Step 1／2 成果沿用，不等待 PG／Lima。
- `unit-test-instructions.md`：精確 MVP selectors、test-after、全應用 80%、核心驗證、合成／真實區分。
- `known-limitations.md`：歷史、PG／IR-02、重型負載與其他未完成義務；既有成果保留在原路徑及 `history/pre-mvp/`。

## Scope Confirmation

已提出的問題原文：「先完成不保存歷史、可實際展示的午餐推薦 MVP，將一年歷史功能延後，是否同意？」

使用者回答原文：是。

這是交付範圍確認，不填成 `Approve Plan`，不替代下節精確計畫核准。

## Plan Approval

Approve this exact Code Generation plan?

核准涵蓋目前 `code-generation-plan.md`、完整 Testing Contract 與 `unit-test-instructions.md`。先做單 Node／Fastify 的無 DB 推薦 MVP、必要告知／驗簽／錯誤處理與測試；推薦以來源此次返回的候選為準，不宣稱全區全量。歷史與儲存問題延後，保留資料／原義務且不假稱完成。必要合併前 CI／安全要求不取消。

此核准只授權按計畫產生程式與已授權本機合成驗證；真人外傳、付費、部署、Git mutation、新工具安裝及外部掃描仍需相應授權。舊核准僅在歷史快照保留，不沿用為本計畫核准。

[Approval Fingerprint]: sha256:v3:e4b02a5f29324b1ea73a8c773961820f0f5d4b334f3a6dff7a25079482656584
[Planned Source]: 4686482fe7df4ff39358a851bb56c1cb2380e1082f0c05b641c1dfa5a2f52bb8

- Approve Plan
- Request Changes

[Answer]: Approve Plan
