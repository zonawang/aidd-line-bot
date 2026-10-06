# U1 MVP 交付範圍調整

## Sources

- 2026-10-06 使用者要求保留現有 workflow 與成果、停止非核心 infrastructure 深入診斷，改以 Time-to-MVP 為優先；原文見下節。
- 同一使用者對「先完成不保存歷史、可實際展示的午餐推薦 MVP，將一年歷史功能延後，是否同意？」回答原文：**是**。
- 已驗證的 in-flight 提案維持 `line-lunch-decision-bot`、Standard 與 strict；階段 delta 為 `skip: []`、`add: []`，沒有另開 intent 或重跑已完成設計。
- 原計畫、測試指引與核准問答完整保存在 `history/pre-mvp/`。舊核准不視為新計畫核准。

## User Request

調整目前開發優先級：本專案以完成可實際使用與展示的 LINE Bot MVP 為最高優先，不需要 production-grade 的 infrastructure robustness。
請停止對 Lima、PostgreSQL、底層磁碟、cache、持久化機制等非核心 infrastructure 問題進行過度深入的診斷。
若目前 PostgreSQL / local storage 問題會阻礙產品功能開發，請採用更簡單且可靠的替代方案，並將目前未解決問題記錄為 known limitation / technical debt，而不是持續阻塞開發。
接下來請優先完成：
1. LINE Bot 核心使用者流程
2. Messaging API / Webhook 整合
3. 午餐推薦核心功能
4. 必要的錯誤處理
5. 最小必要測試
6. 可實際執行與展示的 MVP
非核心 edge cases、production-grade resilience、底層 infrastructure optimization 與 exhaustive testing 可以延後。
請保留既有 artifacts 與已完成成果，不要重新開始 AIDLC workflow；在目前 workflow 中調整 scope 並繼續往產品 implementation 推進。
Time-to-MVP > infrastructure completeness.

## Confirmed Milestone

本次新增「不保存歷史的推薦 MVP」交付切片，解除原資料庫 Step 3／4 對產品實作的阻塞。先完成 LINE 私訊主動位置、當次處理告知、附近餐廳推薦、理由／地圖、Messaging API／Webhook、必要錯誤處理、合成完整流程及可執行說明。真實串接另須合法來源、憑證與必要授權。

不建立位置／查詢歷史、持久事件本文佇列、餐廳內容快取、分析或替代診斷歷史。現有 PostgreSQL、Compose、Lima 程式與測試保留但不作此切片的啟動依賴；不建立或啟動新的 VM／DB，不搬移、刪除、重新格式化既有資料。

本同意只確認交付邊界，不是假造 `Approve Plan`、測試結果、外部服務授權或完整 Unit 完成收據。

## Preserved Requirements

- FR1：可靠 LINE 原始本文簽章驗證；只處理有效私訊位置，不從地址文字推定位置，不支援群組推薦。
- FR2 的當次處理告知、不保存仍可推薦與未確認位置不得等待／外傳原則保留。保存一年選項及跨重啟偏好延後；暫存告知確認僅含必要非位置控制資訊，有界、到期且重啟即失效。
- FR3／FR4：一公里、不重複、最多三家、營業未知明示、不捏造理由／數量；零結果、來源故障及 LINE 回覆失敗不混淆。資料來源涵蓋範圍要如實說明。
- 當次位置與秘密不落應用日誌／檔案，不保留供應方原始回應；沒有公開後台、主動推播、背景定位或正式上線。
- test-after、全 `src/**/*.ts` 至少 80% 行覆蓋率、關鍵邊界整合與必要安全檢查保留。既有數值不得改低來製造通過；本次是交付切片與驗證時點調整。
- 原先已允許的合成工具／依賴使用不擴張成真人資料、付費、部署、Git push 或外部掃描授權。

## Deferred Requirements and Debt

- FR5–FR9：一年歷史、本人查閱、撤回、確認刪除、到期清除與防復活及其測試，全部保留為後續切片，未完成、未取消。
- 原 DB／repository／歷史相關 NFR、IR-02、Lima、PG owner／R05、磁碟硬上限、tmpfs／重啟與災損驗證不再阻塞推薦切片，不改成通過。
- 重型負載、production-grade resilience、平台底層存放／快取／swap／備份深入驗證延後；當次處理期限與應用資料最小化仍需測試。不宣稱程序記憶體等於主機全媒體不留痕。
- 同程序的有界短期去重不宣稱跨重啟或跨程序 exactly-once；無持久佇列／回覆不明不盲重送、不推播補發，相關限制明列。
- CI 的合併前義務與必要秘密／依賴／SAST 檢查保留；缺證據時不能合併或宣稱全面品質驗證，但不因此停止撰寫／本機展示核心功能。

詳細已知狀態、影響與重啟条件見 `known-limitations.md`；不為完成這份文件再做 infrastructure 診斷。

## Delivery Labels and Acceptance

1. **本機合成 MVP**：可依說明啟動，真實 HTTP／簽章路徑與受控來源／LINE transport 串通，核心測試及應用 80% 覆蓋率可重現；明示資料與傳輸為模擬。
2. **真實 LINE 推薦 MVP**：在憑證、合法來源、必要費用與入口授權具備後，LINE → 餐廳來源 → 回覆有真實成功與失敗證據；沒有歷史功能。
3. **原完整版本**：仍須原歷史生命週期、全項適用品質與真人驗證。前兩種標籤都不能替代這個成果，也不能將延後要求在 traceability 標為 OK。

目前只完成邊界確認；新實作計畫需重新取得精確 Plan Approval，才能產生產品程式。
