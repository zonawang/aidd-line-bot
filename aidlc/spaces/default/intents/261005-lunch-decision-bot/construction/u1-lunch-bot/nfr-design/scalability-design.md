# U1 容量與隔離設計

## Sources

- [N] `../nfr-requirements/performance-requirements.md`、`../nfr-requirements/security-requirements.md`、`../nfr-requirements/scalability-requirements.md`、`../nfr-requirements/reliability-requirements.md`、`../nfr-requirements/observability-requirements.md`、`../nfr-requirements/tech-stack-decisions.md`：50項NFRx.y及已選技術。
- [F] `../functional-design/functional-spec.md`、`../functional-design/rules.md`：WF01–WF09與不變量。
- [C] `../../../inception/contract-design/contract-summary.md`：C01–C07，現行v1仍是凍結上游。
- [D] `../../../inception/domain-design/components.md`：四元件及九個實體owner。
- [Q] `nfr-design-questions.md`：Q1–Q4逐題確認及新摘要Looks correct；授權紀錄 `f451da1a48f2b605e5c6a399203fe6caad38982e4347a0c1d6c7ed55e0d11d17`。
- [A] `logical-components.md` LC-03：本次明確修訂的替代條文與相容性規則；原凍結上游保留歷史基準，不能把修訂後設計說成原強保證已實現。
- [REV] `../nfr-requirements/reviews/review-01.md`、`../functional-design/reviews/review-01.md`：不同階段的R-01分別是事件資料所有權與歷史輸出交接，不能混為同一問題。

## SC-01 — Baseline and Bulkheads

對應NFR1.7–NFR1.9。第一個驗證拓撲是一個常駐Node應用、一個PostgreSQL實例；四業務元件共版部署，不新增worker、cache或位置queue。Node參考預算1vCPU／512MiB，PG參考預算1vCPU／1GiB，主機另預留OS與測試驅動器空間。這是本機可重現量測起點，不是已可用資源、效能保證或雲端配置授權。

Node20在途slots、來源5個同時連線、LINE5個同時連線，各自有界；等待來源／LINEslot也計入各自timeout，位置不另排持久queue。五查詢同時與1q/s負載必須實測全部符合，不能丟樣本假稱通過。CPU工作以1MiB／1000候選上限界定；資料過大回真實來源故障，不truncate成成功。

三個PG pool的4＋6＋1共11條應用上限；DB初始max_connections=20，保留9給維護、測試與必要管理。測兩個應用程序時先規劃不超出總數的分配或調整已授權本機配置，不能每程序盲複製11條再耗盡20。清除pool獨立避免被前台checkout飢餓，CPU／DB仍共享，需壓測驗證。

## SC-02 — Expansion Rules

對應NFR1.8–NFR1.9、NFR9.5。不自動擴容、不自動failover，沒有正式可用率要求支持HA成本。新增實例前必須：
- 同一PG權威資料／角色隔離與原子claim、reply CAS、權利順序跨程序成立。
- SD-05的授權LP、程序綁定能力與reply CAS，以及RD-03交易／角色連線上限跨程序成立；不宣稱lease或mutex能保證原實際出口／提交截止原子性。
- 原deadline、清除義務及權限不因LB／重啟改變；node ACK後執行能力仍具證據。
- 總pool、CPU／RAM、資料與來源配額、費用及操作授權已更新並核准。

一個Unit不等於一個資料owner；基準單程序也不免除兩程序／故障交錯測試。無狀態推薦可擴充不代表歷史安全輸出可直接水平擴充。若平台不支持本次確認的授權、線上刪除及殘留保護要求，保持未就緒，不自動新增第五個業務服務。

## SC-03 — Growth and Capacity Triggers

對應NFR1.7–NFR1.9、NFR4.3–NFR4.5。歷史量以實際UTC曆年窗口內合法保存筆數估算；20測試身分與300筆壓測不是月流量預測。量測每row／index bytes、RSSpeak、pool等待、body／source上限及清除批次吞吐。控制≤7天、證據≤30天；Q4允許的底層殘留另佔儲存且無逐筆回收時限，容量估算不能只用線上row數。位置內容不能因磁碟不足搬到永久備份。

設計診斷閾值：在途≥16/20持續60秒、Node RSS>80%參考預算持續60秒、disk剩餘<20%，均產生無個資容量警示。DB pool每次checkout都計入60秒滾動窗口（含成功、逾時及失敗）：窗口內任一timeout／失敗立即產生安全警示，同類通知每60秒可合併但計數不丟棄；另以等待p95≥80ms作提早警示，沒有樣本不填0。這是調校警示，不是擴容授權。壓測ACK或reply未達標直接記fail，不能以尚未觸發閾值當pass。清除最早due剩餘<6h且有pending須警示，不等容量閾值再處理。

無partitioning、sharding、read replica、CDN或快取；以既定複合索引和keyset分頁起步。未經證明的read replica延遲可能洩漏已刪內容，不能作查閱快取。Q4不授權新增複本；任何擴充須先另審查期限／權限、清除語意與費用。

## Verification and Assumptions

合成壓測每種正常／故障場景分列，另加超限、pool耗盡、慢來源及清除負載同時發生；pool測試包含全部checkout恰在100ms逾時且無成功樣本，必須記完整timeout計數並觸發警示，不能依賴額外排程延遲。越限場景只驗證安全降級，不代替原驗收負載。尚無實測容量、成長率、月成本或平台擴縮證據；配置不得降低原需求。
