# U1 容量與擴充需求

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
| NFR1.7 | 在 NFR1.1 持續300筆及另測同時五筆的負載下，同時維持隱私、正確性、p95及10秒期限；不以限流排掉合格樣本達標 | 提供 ingress／claimed／replied／failed 數與完整分母；五筆併發不是說最多只能註冊五人 |
| NFR1.8 | 必須有有界入口本文、來源回應／候選量、在途工作數、DB pool、鎖等待與清除批次；限制值在設計依契約與實測固定 | 分別注入超限／慢連線／pool耗盡，明確拒絕或誠實故障，不建立持久位置 backlog、不偷偷截斷來源回覆當完整成功 |
| NFR1.9 | 擴縮或重啟不改 event、consent、delete 的權威順序，不放寬本人隔離；背景清除不因查詢繁忙飢餓至超24h | 至少兩條獨立連線／程序重送、撤回與刪除交錯；若實際多實例，須對該拓撲另留證據。單機過關不當跨機過關 |

來源：R NFR1–NFR4；F WF01、WF04、WF07–WF08；C03／C07。這些是滿足原目標的容量證明，不構成自動擴容或付費授權。

## Capacity Model

沒有實際邀請名單、每日流量、月預算或一年連續 QPS；20個合成身分不作招募上限，短時1q/s不能外推為正式每秒常駐負載。

| 資料／資源 | 可驗算模型 | 邊界 |
| --- | --- | --- |
| 在途記憶體 | 每秒受理率 × 平均存活秒數 × 每工作最大 bytes，另加同時尖峰、解析副本與runtime開銷 | 以實測 peak RSS／heap驗證，不用候選3家推論來源只需存3筆；≤10秒不代表配置可以無上限 |
| 合法歷史 | 對仍有效曆年窗口內的實際已授權查詢計數，加實測七欄、索引及必要儲存開銷 | 日期窗口按UTC曆年，不一律乘365；來源餐廳不入歷史 |
| 控制資料 | 不超過7天的實際必要控制量 × 實測每筆bytes；另測ref短有效期 | 過期回收不得破壞刪除防重建；不永久保存event索引來換簡化 |
| 診斷／安全證據 | 每天安全事件bytes × 最多30天，加已列明的索引開銷 | 不含精確位置／raw ID；所有可控副本同受保留規則 |
| 清除餘裕 | 在最繁忙受控輸入下，最早dueAt剩餘時間與未清目標數、實測批次速度 | 最遲24h是硬上限，不能靠事後擴容宣稱超時合法 |
| 餐廳費用 | 查詢數 × 每查詢已查核的正常呼叫數 × 各欄位SKU適用價格 | 失敗重試0不代表所有查詢恆為單一呼叫；不列未查核單價、免費額度或預算承諾 |

## Scaling and Overload Decisions

第一版保持一個模組化應用部署單元。增加 U1 執行個體仍須驗證 C01 ACK後處理、共用資料庫順序與資源限額；不自行另建worker、位置queue、cache服務或讀複本。授權範圍外的資源／費用交由提出者決定。

觀察在途數、DB pool等待、RSS／CPU、回覆超時及清除最早期限；當既定驗收條件失敗，先標記不符合並分析，不靜默調低測試流量。實際部署的資源數、保護閾值與擴縮策略由Infrastructure Design依量測提出；目前無auto-scaling設定或「可支援任意用戶數」主張。

## Verification Handoff

效能場景與超載故障場景分列。已受理的有效事件不能因過載再產生位置副本；設定讀不出仍停止外傳，已知no_save可依既定規則推薦。超限回覆必須遵循C01既有HTTP／事件語意；若需要新HTTP狀態或格式，先提出契約修訂，不能默加429後當契約相容。

## Assumptions & Open Questions

待量測 bytes、限制、pool、CPU／RAM／磁碟、清除吞吐及成本，不捏造6／12個月成長率。技術選型不證明清除能力；Google候選結果上限不是產品自動接受少搜尋的授權。
