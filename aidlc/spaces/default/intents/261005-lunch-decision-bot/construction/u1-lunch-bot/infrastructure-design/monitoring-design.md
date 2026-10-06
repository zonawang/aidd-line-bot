# U1 監控設計

## Sources

- [Q] `infrastructure-design-questions.md`：Q1 Docker Compose、Q2 GitHub Actions與獨立摘要Looks correct；摘要授權 `ba75ca1a561d29c9871d31eafe17511b5b80b0e8a5f237aa7c043370f6f153e9`。
- [P] `../nfr-design/performance-design.md` PD-01–PD-04：期限、輸入上限、連線池及量測。
- [S] `../nfr-design/security-design.md` SD-01–SD-06：身分、權限、傳输／儲存、殘留與歷史頁授權。
- [C] `../nfr-design/scalability-design.md` SC-01–SC-03：單程序資源基準、不自動擴容及容量警示。
- [R] `../nfr-design/reliability-design.md` RD-01–RD-05：DB交易、unknown、清除與隔離。
- [O] `../nfr-design/observability-design.md` OD-01–OD-04：本機安全訊號、品質命令及證據。
- [L] `../nfr-design/logical-components.md` LC-01–LC-06：四元件、CHG-01／02／04／05明示修訂、v2介面、就緒條件與12項反例。
- [D] `../../../inception/domain-design/components.md`、[F] `../functional-design/functional-spec.md`與`../functional-design/rules.md`、[K] `../../../inception/contract-design/contract-summary.md`：原owner、WF01–WF09、規則與C01–C07。舊強保證只在[L]明列範圍被取代，不倒改凍結文件。
- [T] `../../../inception/practices-discovery/team-practices.md`：test-after、至少80%、合併前CI與不正式上線。

## M-01 — Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
| --- | --- | --- | --- |
| ack_duration_ms | LINE入口接收至HTTP ACK完成；固定場景分類 | 合成標準負載p95≤1000ms | 與業務／DB／LINE結果分開，ACK不是推薦完成 |
| reply_accept_duration_ms | 首次有效事件接收至LINE接受回覆；模擬與真實分列 | 可回覆樣本p95≤5000ms；未回覆計超標，未量測不填0 | 不等同裝置送達；固定4800ms預算只是配置 |
| initiation_deadline_violation | adapter入口單調deadline檢查 | 新工作／COMMIT／reply在原10秒後啟動任一筆即失敗 | 已合法發起交易晚完成分列unknown／late outcome，不錯當原十秒生效保證 |
| inflight_events | Bot有界slot計數 | ≥16/20持續60秒warning | 防無界記憶體／工作排隊，不自動擴容 |
| node_rss_bytes | 本機程序RSS及容器memory.current | >80%×512MiB持續60秒warning；OOM另error | RSS之外須看cgroup／tmpfs整體，不以RSS掩蓋容器壓力 |
| db_storage_free_ratio | PG volume及底層host／VM可用容量 | 任一<20%warning；不可寫立即error | 包括WAL／heap殘留，不能只估線上row數 |
| db_pool_wait_ms／checkout_outcome | line_event／privacy_interactive／privacy_cleanup全部checkout，含成功／timeout／failure | 60秒窗口p95≥80ms，或任一timeout／failure即warning | 不用>100ms才告警；零成功仍有失敗樣本，沒樣本顯示N/A |
| quarantined_sessions | 固定pool類別隔離token計數，不含backend識別於log | 任一新增警示，無法確認終止readiness不健康 | client close不等於可補連線 |
| cleanup_pending／oldest_due_remaining | DataPrivacy安全聚合；無subject／history label | 有pending且剩餘<6h warning；now≥due未完成error | 保留原due；unknown不當online_removed |
| control_safety_margin | 距最早需證明安全之control purge的聚合時間 | purge前24h仍無證據即blocked，最遲purge前撤歷史權限 | 不用永久tombstone換取安全 |
| source_outcome／reply_outcome／save_outcome | 固定列舉、無個人ID | source_failure／LINE unknown／save unknown分開計數 | 不讓零結果、未存、沒送或刪完的假成功污染量測 |
| privacy_safety／clock_health | 本機安全核對；狀態固定ready／blocked／unknown | 一項不可信即關相應真人路徑 | env=true不能取代證據 |
| evidence_sink_health | 白名單encoder、輪替、TTL、受控告警subscriber | 寫入／清理／通知失敗立即error；沒有樣本不是成功 | 告警故障不能蓋掉清除故障 |

所有label只限固定component／operation／outcome／errorClass／pool／scenario；禁止user ID、subjectKey、eventKey、historyKey、ref、位置、token、完整URL、SQL參數。外部不接收correlationId。histogram、ring buffer與key集合都有限，超限記聚合drop count，不生成無界label。

## M-02 — Alerts

| Alert | Condition | Severity | Routes to |
| --- | --- | --- | --- |
| 清除batch或主表核對失敗 | 任一失敗／unknown | error | 本機安全事件＋獨立非個人安全狀態；合成測試subscriber驗可見，依原due重試 |
| 清除接近期限 | pending最早due<6h | warning | 同上，維護處理不得改due |
| 清除逾期 | now≥原due且無完整線上移除證據 | error | 標overdue及隔離受影響儲存；真人前指定的維護人／通道尚未具備 |
| 控制回收安全未證明 | purge前24h仍有風險 | critical | blocked、歷史路徑停用；最遲purge前撤權，控制照期刪；不靠提醒代替阻擋 |
| 敏感輸出／越權 | canary／白名單失敗、schema越權成功或錯誤頁放行 | critical | 停相關收集或真人路徑，限制已產生證據存取，不輸出原始樣本 |
| 能力／期限／clock不可信 | v2不相容、跨程序能力、啟動檢查失敗 | error | readiness blocked；依原業務契約回安全故障，不猜空頁 |
| pool飽和 | 任一timeout／failure或p95≥80ms | warning | 每類60秒可合併通知，但第一次立刻可見、所有失敗計數保留 |
| 容量不足 | M-01 CPU／RSS／磁碟／tmpfs異常 | warning／error | 本機受限診斷；提出調校，不自動買資源／備份或啟用持久queue |
| 通知／證據管線失敗 | subscriber不可達、檔案無法寫／輪替、TTL清除失敗 | error | 優先非個人安全狀態與受限health；兩者皆失敗即程序停真人接收、下次啟動預設blocked |

本輪不發mail／Slack／LINE push，不新建dashboard或外部監控帳號。合成subscriber只證明本機事件可見；**不證明真人維護人收到**。真人前必須指定責任人、實際可達通道、檢查節奏、通知失敗備援並演練；缺項維持G-ENVIRONMENT未就緒，不憑空承諾24×7 on-call。

## M-03 — SLIs / SLOs

| SLI | SLO target | Measurement window |
| --- | --- | --- |
| HTTP ACK延遲 | p95≤1秒 | 合成20身分、開迴路1q/s×300秒=300筆；另5筆同時，逐場景分列 |
| LINE接受延遲 | p95≤5秒 | 同上；正常、不足、零結果、來源失敗、保存unknown分列；無回覆計失敗，真LINE不可用另列 |
| 工作啟動期限 | 0筆在原10秒後啟動新業務／COMMIT／reply | 全測試及故障注入；已發起晚完成不冒充rollback |
| 歷史輸出資格 | 同本人／頁／event／程序且單次，啟動≤authStart+1秒及原deadline | SD-05完整授權與刪除／expiry交錯；不對transport接手後延遲做無法證明的保證 |
| 新歷史讀取安全 | 刪除生效／expiry後新授權0筆含失效內容 | 單筆／全部／到期與兩程序交錯；已核准未送的單則適用[L]CHG-02 |
| 線上主資料清除 | 每筆原effectiveAt／expiresAt+24h內完成主表核對與防復活 | 受控clock前／當下／後、故障／重啟／late commit；實際超時不因測試clock縮時消失 |
| 診斷／安全證據 | 無禁止值；最多30天、僅授權可讀 | 成功／失敗／scan／CI附件；TTL與disk滿、重啟／離線情境 |
| 可靠性／可用率 | 不新增百分比SLA、RPO或RTO | 單Node／PG無HA及歷史backup，故障可能丟當次工作／合法歷史 |

p95採nearest-rank（排序第ceil(0.95×N)筆）；分母為該場景所有應量測樣本。可回覆但未回覆列超標，不以0ms、只成功樣本或排除冷啟動修飾；零樣本N/A。每份報告含總數、成功／拒絕／unknown／缺回覆、p95算法、原deadline違反、版本、實際cgroup資源與替身延遲。[P][O]

## M-04 — Logs & Tracing

| 範圍 | 實現設計 | 保留／存取 |
| --- | --- | --- |
| App事件 | 專用白名單JSON encoder，只允許UTC時間、單次隨機correlationId、固定列舉、durationMs與count；拒絕未知欄位，無自由message／raw exception | 限權owner目錄0700、檔案0600；設計上最長29天，啟動及每小時移除超限檔／輪替，為30天上限留餘裕；真人前驗離線清理操作 |
| Metrics ring | 有界記憶體counter／histogram，受限Unix socket snapshot、peer UID核驗，只有固定只讀操作 | 重啟可失去一般量測但不丟應另存的安全狀態；無遠端metrics API／個人labels |
| Tracing | 僅元件安全耗時與隨機單次關聯，不啟用自動HTTP／SQL／APM payload capture | 不向第三方傳播、不建立跨查詢個人行為追蹤 |
| DB／容器底層 | infrastructure-specification.md I-02禁statement／parameters、原始container logger與dump | 不用PG stderr、docker logs或core作替代位置歷史；檢查client error／PANIC／磁碟满及啟動失敗路徑 |
| 證據容量 | 本機安全log設計總上限100MiB，剩餘20%即warning；優先丟一般INFO並記drop count，保留必需安全狀態 | 安全記錄不可寫則不健康／停止真人路徑，不用無限檔案或延TTL解決；cap含當日及輪替總量 |
| CI／安全報告 | cicd-pipeline.md C-04的白名單測試／scan摘要，禁止原始命中值、secret片段、raw payload與任意artifact | 預設GitHub logs／artifacts設14天，實際repository與平台政策另核對，不能只設artifact TTL卻漏job logs／cache |

到期清除是可控副本義務；長期關機不能假稱每小時任務仍執行。若計畫保留真人診斷需主機可在截止前清理或停用持久診斷／先清理再停機；不能履行就不開真人環境。一般非個人儲存blocked狀態可持續，不能塞個人識別或把原安全證據永留其中。

## M-05 — Dashboard and Operational Checks

| 本機檢查視圖 | 呈現 | 禁止內容／執行條件 |
| --- | --- | --- |
| 延遲與負載摘要 | ACK／LINE接受分布、全部樣本、來源／DB／LINE耗時、inflight／RSS／tmpfs／disk | 不顯示某人、查詢位置或完整URL；不是公開網頁 |
| 隱私安全摘要 | 各G-* ready／blocked／unknown、清除pending／overdue數及最小剩餘時間、隔離session數 | 不dump QueryHistory／ConsentState／ref；DB admin與只讀診斷分離 |
| 品質摘要 | build／test／coverage／scan及版本、規則涵蓋、真實整合未驗證狀態 | 未跑／失敗／零涵蓋不可綠燈；安全掃描報告不回印命中原文 |
| 啟動核對 | 版本／角色／timeout／掛載／TLS／來源flags／安全狀態／clock | 未獲準的真實外部探測不執行，未知即不開真人路徑 |
| 故障演練 | [L] LC-06全部12項，另subscriber失敗、證據disk滿／TTL、全部checkout100ms逾時 | 只用合成資料；與真人平台驗證分開，不能當法規或條款證明 |

## Assumptions & Open Questions

沒有已部署的監控、維護責任人、外部通知、metrics socket或執行結果。配置、閾值及報告格式為後續Code Plan／測試契約，不宣稱G-*已通過。設計使用既有本機模式，不新引入SaaS、公開後台或付費告警；真人前所需通道與保護另行確認。
