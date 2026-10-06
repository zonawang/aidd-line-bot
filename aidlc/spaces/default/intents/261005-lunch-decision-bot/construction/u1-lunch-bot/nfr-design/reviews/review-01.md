## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-05T15:25:46Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| R-01 | Major | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/nfr-design/security-design.md:48 > SD-05 — History Output Contract Gap | NFR3.5／G-HANDOFF 尚缺能涵蓋實際 C02 發送的交接與失效封鎖機制。反例：歷史頁讀取並完成最後檢查 → DB 連線失去 shared guard → 另一程序提交刪除 → 舊程序仍向 LINE 發送。草稿正確承認普通鎖、TTL、AbortSignal 不足，但候選 session 介接及 CHG-02 尚未決定交接 LP、失鎖後硬性禁送與到期競爭的可實作協定，無法滿足上游 NFR3.5 及 Functional WF05／WF09。這是重要架構選擇未收斂，不是要求本階段完成程式或宣稱草稿已承諾實現。 | 選定涵蓋 LINE 發送邊界的排序／fencing 架構，明定交接 LP、owner、期限、取消及連線／程序失效時的強制封鎖；完成 C03／C02 修訂方案及舊呼叫者安全失敗規則。以 read 後刪除、send 前到期、失鎖、程序暫停與重啟逐步論證，定義對應驗證。如果必須改上游保證，交由提出者明確決策，不以 Deferred 或停用開關替代方案。 | New |
| R-02 | Major | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/nfr-design/reliability-design.md:36 > RD-03 — Time and Commit Fencing | NFR2.8／G-COMMIT 缺少已選的資料層截止 fencing。反例：期限前查核通過並送出 COMMIT → DB 暫停或 fsync 延遲 → client 逾時 → 寫入在原期限後才生效。短交易、timeout、銷毀連線與回覆 unknown 均不能證明該寫入未生效。C03「Ordering and Atomicity」第 3 項明定不得在截止後讓排隊寫入生效；目前僅將關鍵機制交平台／資料層補充，實作者仍須重新決定提交架構。 | 選定可支撐原截止語意的資料／執行期機制，明定 DB 生效 LP 與原 deadline 的關係、取消完成依據、崩潰及不明提交處置，提供 server 暫停、鎖等待、慢提交與 ACK 遺失的架構論證及故障驗證條件。若選型無法滿足，先取得明確需求／選型變更決策；不能只把 client 停止等待當成取消。 | New |
| R-03 | Major | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/nfr-design/security-design.md:42 > SD-04 — Retention and Purge Boundary；aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/nfr-design/reliability-design.md:44 > RD-04 — Cleanup Execution and Quarantine | NFR4.8／G-PURGE 尚無符合原 24h 全可控位置殘留清除要求的已選儲存／清除架構。既有設計定義不可見、掃描、重試及隔離，卻無法將單筆清除義務追至 PG heap／index／TOAST／WAL／temp 與主機副本的完成證據。DELETE／VACUUM 沒被誤稱充分證據是正確的，但把整個物理實現留待 Infrastructure，仍可能導致儲存與資料配置重大重設。隔離及七天控制回收不等於 FR9.2／FR9.3、C03／C07 要求的依限清除。 | 在 NFR 設計選定可行的儲存及殘留清除策略，列明實際目標、原 effectiveAt／expiresAt 起算的有界清除路徑、完成證據與失敗處置；平台細部配置與實測可由後續階段落實。若必須改儲存選型或清除定義，先交提出者決策，不擅自接受金鑰刪除等替代語意，也不以真人入口停用視為已滿足清除需求。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/nfr-design/scalability-design.md:34 > SC-03 — Growth and Capacity Triggers；aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/nfr-design/performance-design.md:41 > PD-03 | pool checkout 等候上限 100ms，但容量警示只使用「等待 p95 > 100ms」。若所有 checkout 都在 100ms 逾時，p95 正好等於 100ms，該警示不觸發；若統計只含成功 checkout，則更可能漏報。不能依賴排程延遲超過上限才辨識 pool 飽和。其他故障處置仍在，因此列為非阻擋的可觀測性缺口。 | 明定 checkout 逾時／失敗計數、取樣與告警時間窗，或採可在上限內觸發的等待閾值；加入持續 checkout 逾時且無額外排程延遲的受控案例，確認容量警示會觸發。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
| --- | --- | --- |
| sensor-required-sections，stage=nfr-design | 六份 Markdown 均 exit 0、零 findings；performance／security／scalability／reliability／observability／logical-components 的 H2 數依序為 6／8／5／7／6／7 | 結構檢查通過，不代表必要機制已選定。 |
| sensor-upstream-coverage，security-design.md | exit 0；指定八份 consumes 均被引用，零 findings | 引用存在；一致性仍須以契約與需求內容判斷。 |
| sensor-traceability，traceability.json | exit 0；gaps／orphans／missing／invalid 清單皆空 | 結構接受 Deferred，不代表所有需求已有 concrete design。 |
| node /private/tmp/validate-lunch-nfr-design.mjs | 先讀程式範圍後執行，exit 0；structuralPass=true、documents=6、mapped=50、ok=47、deferred=3 | 工具明示僅文件驗證，仍有三項設計阻擋；未執行應用或平台測試。 |
| 獨立唯讀 Node／Ruby 查核 | 上游 50 個 NFRx.y 與映射集合一致；Deferred 恰為 NFR2.8、NFR3.5、NFR4.8；實際八段 budget 加總 4,800ms 且累計一致；四業務元件三條依賴無環，九個實體 owner 保持；C03 現行八項操作未含候選交接介接 | 映射沒有漏列，不把 47 個 OK 解讀成已實測達標。budget 保留 200ms 至 5s 目標；pool 4＋6＋1 與 max_connections=20 的算術一致。 |
| pool 閾值反例計算 | 100 筆各 100ms 的 checkout 逾時，p95=100ms，判斷 >100 為 false | 支持 R-04；屬靜態反例，非實際負載測試。 |
| linter／type-check | 不適用：本次設計無 TS／JS 程式片段 | 不宣稱應用建置、測試、掃描、負載或平台驗證通過。 |

### Assessment

- 本次是 NFR Design 的首次獨立審查，全部 findings 為 New；不沿用前一階段的風險處置。Q1 的 Looks correct／有效 receipt 確認同一 PostgreSQL 內各自受限介接與角色的所有權安排，不代表人類接受 G-HANDOFF、G-COMMIT 或 G-PURGE。
- LineInteraction 管理自身事件、DataPrivacy 管理自身權利／歷史的責任界線有明文；CHG-01 記錄待同步的上游文字，未轉移 owner，故不重提為本次產品缺陷。四元件無循環，角色／pool 分離、兩程序總連線須重新分配、清除獨立連線與重試不重設 dueAt 的方向一致。
- 來源／LINE bulkhead、固定預算及錯誤分類可供後續驗證，但不是效能實證。品質工具與至少 80% 覆蓋率是待執行門檻，沒有被文件 sensor 取代；工具版本、平台細部配置、外部許可與法域不因本次審查而被視為已確認。
- Google 僅候選，20 筆上限、欄位 SKU、標示／政策與費用衝突仍受停止條件約束；本次未呼叫外部 API，也不將既有公共文件摘要當成完整法律查核。
- stage 的 Step 4 要求各類 NFR 的具體方案，Step 5 要求逐條映射至 concrete design。三項 Deferred 的揭露誠實且停用措施必要，但核心提交、輸出及實體清除機制缺失不只是待填平台參數，仍須重大架構決策；本次不要求在設計階段完成應用實作才可解除 findings。

### Summary

共 0 Critical、3 Major、1 Minor，依角色既定「任何 Critical 或超過 2 Major」門檻判定未就緒，未自行加嚴。三項必要機制須形成具體可實作方案及可驗證的失效語意；如需變更既有承諾，應交由人類明確決定，不能由審查者代為接受風險。
