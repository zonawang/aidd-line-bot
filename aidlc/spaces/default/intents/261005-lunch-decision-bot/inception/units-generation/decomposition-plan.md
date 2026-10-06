# 午餐決定器 LINE Bot：單元拆分計畫及既有核准紀錄

## Status

使用者已以原文「Approve Plan」核准本計畫。本文件不是正式單元產出，也不是 Units Generation 最終階段核准。原檔名為 decomposition-plan-questions.md；使用者另以「同意」授權保留方案並重新整理確認流程後，將既有計畫問題與回答整併至 `units-generation-questions.md` 的 Q2。本文件改作計畫附錄，保留原計畫、原始回答及歷史摘要，不再是第二份現行問答。

現行完整問答與待確認摘要統一位於 `units-generation-questions.md`；整理不撤銷已核准計畫、不刪除任何決策內容、不降低檢查，且仍須取得整理後整份摘要的人類確認才能重新保存四份文件及請求審查。

摘要確認紀錄：`c87104e2c300dce600dfb9058ef8126c22e54ee21aad2e0fe5a97278cbd56c0a`。

## Sources

- `units-generation-questions.md`：Q1 採 A，四元件組成一個模組化應用，共同版本及部署。
- `../domain-design/components.md`、`../domain-design/decisions.md`：元件及實體歸屬、單向呼叫、資料權利與失敗語意。
- `../requirements-analysis/requirements.md`：全部 FR／NFR、完整交付及外部授權前提。

## Proposed Plan

### Boundary and Granularity

按應用部署邊界定義一個單元；不把功能、資料層、測試、CI 或文件各拆成獨立服務。四個邏輯元件維持原有責任及介面，單一部署不等於可繞過資料擁有者或已完成安全隔離。

| Unit ID | Directory | kind | 責任 | 部署模型 | 直接 Unit 依賴 | 相對複雜度 |
| --- | --- | --- | --- | --- | --- | --- |
| U1 | u1-lunch-bot | service | LINE 互動、午餐推薦、資料權利及餐廳介接；完整推薦、本人歷史生命週期、測試及 CI 交付責任 | 一個模組化應用，共同版本及部署 | 無 | L |

`service` 表示可運行的應用服務，後續須完成其適用設計與實作；不是只有契約或文件。L 表示包含隱私生命週期、併發及故障驗證的相對複雜度，不是工期或費用估算。

### Dependencies and Integration

- 單元圖只有 U1，沒有跨 Unit 邊或跨 Unit 平行開發機會；不據此更改既定串行工作方式，也不選跨 Unit 實作順序或關鍵路徑。
- U1 內維持 `LineInteraction → DataPrivacy`、`LineInteraction → LunchRecommendation`、`LunchRecommendation → RestaurantSourceAdapter`。這些是元件呼叫，不是三個額外服務。
- 九個實體仍依已核准元件文件歸屬；DataPrivacy 獨占同意、歷史、刪除及清除的判定與資料操作，其他元件只能透過其介面使用。
- LINE 與餐廳來源是外部整合依賴；儲存及可信清除觸發機制待選型，不虛構已存在資源。詳細契約、保存一致性、取消／重試及提交結果不明處理由 Contract Design 及後續設計具體化。
- 一起發布較容易維護及整合，代價是共用故障與擴縮邊界。保留可測介面，但不承諾日後拆服務零成本。

### Generation and Verification Scope

核准此計畫後，才產生以下四份文件：

- `unit-of-work.md`：穩定 Unit ID／目錄、kind、責任、邊界、部署模型、相對複雜度與限制。
- `unit-of-work-dependency.md`：只有 U1 的無循環依賴圖及機器可讀 YAML；分清內部元件介面與外部依賴，不暗中增加其他 Unit。
- `unit-of-work-story-map.md`：因故事階段略過，逐項映射所有 30 個 FR 識別碼（九個主項及 21 個子項）至 U1／u1-lunch-bot；另說明 NFR 責任與單元內開發安排，不虛構 US 識別碼。
- `traceability.json`：與需求及對照表一致，每個 FR 的目標均為已宣告的 U1；追溯完整不代表需求已實作或測試通過。

驗證包含 YAML／JSON 格式、單元識別一致性、相依圖無循環、需求覆蓋、來源與文字格式；之後執行一次獨立架構審查並處理結果，再呈現本階段最終核准。文件驗證不冒充應用測試。

### Unchanged Constraints

- 全部 SCP-01–SCP-09、FR／NFR 及品質要求不減少；一年歷史、本人權限、撤回／刪除、到期立即不可見及 24 小時實體清除等限制維持。
- 不修改 scope、工作模式或 skeleton 開關；下一階段仍為 Contract Design，不自行加入 Delivery Planning 或 Operation。
- 本次不選語言、資料庫、雲端或供應方，不執行程式生成、真實整合或部署，不建立資源／分支／提交，不代表任何費用或真人資料處理授權。
- 尚未驗證的外部能力及 OQ1–OQ10 維持待辦；不得把本計畫核准當成上游 R-01 風險已修正或已關閉。

## Plan Approval

是否核准以上一個 service 單元的拆分計畫，讓我據此產生四份單元文件？此核准只授權本階段文件生成，不取代完成文件及審查後的最終階段核准。

A. Approve Plan — 依本計畫產生四份單元文件。
B. Revise Plan — 先修改拆分計畫，不產生正式文件。
X. Other (please specify)

[Answer]: Approve Plan

## Historical Plan Summary Confirmation

以下為原計畫文件已取得的摘要確認，紀錄 `3ff6f75716a8fb943c7d2049344cd4104d15949f220f800e217b1f2d9ccc8662`。保留供追溯，不將歷史回答冒充整理後的新確認。

- 使用者已以「Approve Plan」核准一個 service 單元 U1／u1-lunch-bot；本次摘要不改變該計畫或代替最終階段核准。
- LINE 互動、午餐推薦、資料權利及餐廳介接四元件共同版本／部署，九個實體歸屬及三條內部呼叫維持；DataPrivacy 仍是同意、歷史、刪除及清除的唯一管理者。
- 單元相對複雜度 L，無其他 Unit 依賴；LINE、餐廳來源及待選型基礎設施仍須整合與驗證。接受共用發布、故障及擴縮邊界，不預選技術或虛構資源已存在。
- 產出單元定義、依賴、需求對照及追溯四份文件，所有 30 個 FR 識別碼及九項 NFR 分配給 U1；覆蓋表示責任完整，不是測試通過或實作完成。
- 一年歷史、本人權限、撤回／刪除、到期不可見、24 小時清除及全部品質要求保持不變；不因單元合併降低保護、擅自啟用 skeleton 或變更既定串行工作方式。
- 確認後依這份不變的計畫重新保存四份文件並進行獨立審查，最後另請本階段核准；本次不授權程式實作、外部資源、費用或部署。

以上拆分計畫摘要是否正確？這次補齊計畫文件的摘要確認，不改變已核准的方案。

- Looks correct
- Request changes

[Answer]: Looks correct
