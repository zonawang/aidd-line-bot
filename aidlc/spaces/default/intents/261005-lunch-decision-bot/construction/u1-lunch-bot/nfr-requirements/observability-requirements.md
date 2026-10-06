# U1 可觀測性需求

## Sources

- [R] `../../../inception/requirements-analysis/requirements.md`：NFR1–NFR9 與功能驗收界線。
- [F] `../functional-design/functional-spec.md`：WF01–WF09 與已確認的狀態／競爭規則。
- [B] `../functional-design/rules.md`：規則的權威 YAML。
- [C] `../../../inception/contract-design/contract-summary.md`：C01–C07 介面與最小資料投影。
- [Q] `nfr-requirements-questions.md`：本輪三題已答、整份摘要 Looks correct；授權紀錄 `9e6e63e53393656f3cc31b97135000d3251f63866204932c7ec3810d96db3898`。
- [P] `../../../inception/practices-discovery/team-practices.md`：test-after、品質及交付限制。

## Requirements

| ID | 要求 | 驗收方式 |
| --- | --- | --- |
| NFR5.2 | 以不含個人的有限label記錄接收拒絕、有效查詢、found／不足／zero／source_failure、保存三態、歷史錯誤、刪除／清除狀態、reply三態、deadline及耗時 | 每條正常／故障路徑可由安全事件及總數核對，不需位置、owner、event原值或完整URL；不可把個人查詢頻率當產品分析 |
| NFR5.3 | ACK、reply接受、10秒處理及24h清除均分開量測；reply未接受／未知分列，不混進成功分母 | 對照performance-requirements.md的完整樣本及p95算法；清除以原effectiveAt／dueAt，不能用重試時間洗掉違约 |
| NFR5.4 | 任一清除失敗、超24h、敏感資訊出現在診斷或歷史安全隔離均須有授權維護人員可見的故障訊號；告警失敗本身可辨識 | 故障注入時先寫允許的本機安全狀態／診斷並嘗試通知，不把通知失敗視為清除完成；通道、責任人及檢查節奏須在真人前具備，不擅自發外部訊息或使用者push |
| NFR5.5 | 使用單次隨機關聯碼追蹤元件時間／狀態；不長期追蹤同一人，不附HTTP本文／headers／SQL參數；所有診斷與安全證據最多30天且限授權人員 | 在成功與錯誤路徑注入座標、user ID、訊息、token／secret，掃描日誌、trace、CI失敗輸出與附件應無該值；驗证期限到時可控副本清除 |

來源：R NFR4–NFR5；F WF01、WF08–WF09；C的錯誤／期限矩陣。NFR5.4的告警觸發就是已確認的清除失敗要求，不新增24×7 on-call或任意外部通知服務。

## Signal Catalog

| 訊號 | 維度白名單 | 判讀 |
| --- | --- | --- |
| 接收／業務／回覆計數 | 固定元件名、固定操作與狀態類別 | ACK不代表推薦或送達成功；拒絕與未處理另列 |
| 各階段耗時 | 固定階段、受控場景、成功／失敗類別 | 量測包含鎖等待、來源及LINE，不只量核心函式 |
| 清除義務 | 作業狀態、最早due剩餘／逾期時間、目標類別與數量 | 不能在metric label放historyKey／subjectKey或座標；必要job關聯留在最多7天的權利控制資料 |
| 資源壓力 | 在途總數、pool等待／使用數、RSS／CPU／磁碟與清除backlog數 | 只作服務健康與容量驗證，不做個人偏好／活動分析 |
| 安全失敗 | 固定拒絕原因、秘密／掃描類別、隔離狀態 | 無自由文字例外、外部完整URL或原始輸入 |

沒有本輪公開dashboard、獨立管理網站或外部trace SaaS。先交付可重現的本機診斷／測試報告，若後續選外部後端須另查資料出口、存取、成本與保存。應用白名單也須涵蓋Fastify預設logger與DB／proxy，不只自訂log。

## Alert and SLI Interpretation

- 性能驗收：每個完整受控場景ACK p95>1s、reply p95>5s、可回覆但未回覆、錯誤內容或任何期限違反，均記錄未達標；不是自行引入正式月可用率。
- 清除失敗：首次觀察到失敗即建立安全可見記錄；dueAt到達仍無全目標完成證據即失敗。設計可加接近due預警，但不能以預警寬限延長期限。
- 診斷疑似含敏感內容：停止該資料收集路徑、限制存取、修正並驗證；已寫內容依既定保護處理，不能以「需要除錯」默認永久保留。
- 告警通道不可用時保留允許的本機安全訊號及未知狀態；沒有安排人員能看到就不宣稱符合可觀測性。30天是上限，不是保證每個告警都要保存30天。

## Verification Handoff

對每個固定狀態至少注入一個可重現案例，核對使用者回覆、安全訊號及控制資料各自結果。驗證診斷保留期限、未授權讀取、告警失敗及重啟；記錄的是測試判定與安全摘要，不附原始位置、使用者訊息、憑證或帶敏感值的測試快照。

## Assumptions & Open Questions

本輪沒有配置外部監控、正式告警通道或值班責任。NFR Design須提供本機可觀測性與清除故障可見路徑；任何真人環境需先確認維護責任、通知通道與存取／保留設定，不擅自指定既有Slack／郵件或發送訊息。
