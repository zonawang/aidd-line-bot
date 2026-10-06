# U1 非功能設計：文件檢查

## Scope

2026-10-05。六份設計Markdown及traceability.json；只檢查文件，不執行應用、資料庫、負載、平台、安全掃描或真人串接。

## Checks

- required-sections：逐六份設計執行 `aidlc engine sensor-required-sections --output-path <檔案> --stage-slug nfr-design`，H2數6／8／5／7／6／8，全數pass、零findings。
- upstream-coverage：security-design.md明列 `--consumes performance-requirements,security-requirements,scalability-requirements,reliability-requirements,observability-requirements,tech-stack-decisions,functional-spec,contract-summary`，八項全部有引用，pass。
- traceability：`aidlc engine sensor-traceability --output-path <本目錄>/traceability.json --stage-slug nfr-design`，pass；50個OK依明列的修訂基準，不是原強保證或已實測達標。
- `node /private/tmp/validate-lunch-nfr-design.mjs`：直接從上游NFR文件擷取50項ID，核對全部唯一映射、50個OK／0個Deferred、實際設計章節及來源路徑、四題回答及Looks correct、新摘要授權、四項明列修訂、12項反例驗證規格、實際表格4800ms及各列累計、空白／字元／fence；structuralPass=true。
- `git diff --check`：pass；新文件未追蹤，不受該命令覆蓋，以上直接讀檔檢查另外涵蓋它們。
- TS／JS linter及type-check：設計沒有實作片段，本輪不適用，不聲稱應用檢查通過。

## Design Status

Q1–Q4及新整份摘要已取得本人確認。NFR2.8、NFR3.5、NFR4.8的原強保證被明確修訂，並非原樣滿足：改為應用啟動截止／晚交易unknown、原子核准歷史頁／短期單次transport，以及24h線上主資料刪除／不承諾底層殘留固定時限不可復原。LC-03保留替代條文、相容性及受影響上游；traceability的coverage_basis與amendments防止把變更當成原要求完成。

六份設計列具體交易／backend隔離、歷史能力驗證、固定scope清除與殘留保護；LC-06是尚待執行的測試規格，不是測試結果。文件檢查不能替代獨立審查或平台、政策及真人前條件。沒有安裝、付費、資源建立、Git提交、部署或真人資料傳輸，凍結上游未改寫。

公開PostgreSQL文件查核僅證明VACUUM／加密限制與PG17 transaction_timeout設定存在，不證明實作或清除保證。pool反例是靜態規則核對：100筆各100ms逾時，p95=100ms，原>100不觸發；新timeout計數或≥80ms規則會觸發，並非已執行負載測試。
