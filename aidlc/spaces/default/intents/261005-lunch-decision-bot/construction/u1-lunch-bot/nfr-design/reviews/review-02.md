## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-05T15:54:30Z
**Iteration:** 2

### Findings

| ID | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| R-01 | Major | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/nfr-design/security-design.md:55 > SD-05 — Atomic History Output Authorization；aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/nfr-design/logical-components.md:47 > LC-03／CHG-02 | 原缺口為實際 LINE 發送與刪除之間無硬性 fencing。本輪 Q3 明確改採資料權利元件的頁面授權 LP，不能再用舊保證判定失鎖後發送必然違規。新方案以本人 FOR SHARE／權利變更 FOR UPDATE、取得鎖後的新 READ COMMITTED 快照與同一 authorizedAt 決定頁面；完整可信結果才產生程序／本人／事件／不可變頁綁定能力。notAfter 從 SQL 發起前計算，至多一秒且不超原 deadline；預先取得 reply CAS 與 LINE slot，同步單次 consume 後交付 transport，取消／過期／跨程序／重啟不可重用。privacy:v2、reply-history:v2 及拒絕舊 PageResult 直送的規則已具體化。原缺口依核准後的替代語意解決，不是原跨 LINE 原子性已實現。 | 本輪無剩餘設計阻擋；後續實作保留 LC-06 T-OUTPUT-01–04 的正反例及 v1 路徑拒絕測試。不得將應用啟動傳輸的 LP 宣稱為 socket 寫出或 LINE 接受期限。 | Resolved |
| R-02 | Major | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/nfr-design/reliability-design.md:31 > RD-03 — Initiation Deadline and Unknown Commit；aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/nfr-design/logical-components.md:49 > LC-03／CHG-04 | 原缺口為無法保證 COMMIT 不在十秒後生效。Q2 現已明確允許截止前合法發起的交易晚完成，仍禁止截止後新提交及盲目重寫。RD-03 提供 adapter 入口單調期限檢查、PG17+ 短交易設定、共同本人鎖與新 statement 快照、unknown 判定、cancel／逐出連線及 quarantined 容量 token；未確認 backend 終止不補位，並有角色連線上限與重啟檢查。撤回／刪除先成功提交者仍阻止後取得鎖的舊保存，原 expiry／清除 due 不延長。晚提交反例現在屬已核准情形，不再是未選定硬截止方案。 | 本輪無剩餘設計阻擋；下游固定支援版本與配置，實作 T-COMMIT-01–03，驗證取消不等於回滾、backend 識別／回收及跨程序限額。不得把 400ms timeout 配置說成 server 停頓下的硬終止保證。 | Resolved |
| R-03 | Major | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/nfr-design/security-design.md:37 > SD-04 — Retention and Residual Data Boundary；aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/nfr-design/reliability-design.md:49 > RD-04 — Online Cleanup and Quarantine | 原缺口為無全可控殘留 24h 物理清除方案。Q4 明確將承諾改為 24h 線上主資料交易刪除，並承認底層殘留可能超過一年且可被具足夠權限者還原。新方案已定義固定 scope／due、本人鎖、批次 DELETE 與進度原子提交、另開新快照直接查主表且檢查防補寫條件後才標 online_removed；未知結果、超期及控制回收前隔離皆有處置。SD-04 分列 WAL／舊頁、tmpfs、禁用備份及殘留保護，告知與完成文案不再冒稱全部媒體擦除。這已是新承諾的具體設計，不是由審查者代為接受原風險。受影響功能流程引用的次要缺漏另列 R-05。 | 本輪無剩餘核心清除機制阻擋；後續依 T-CLEAN-01–03、T-RESIDUAL-01 驗證主表刪除與防復活，確認加密／權限／無副本配置及適用政策後才開真人路徑。維持主資料刪除完成與底層安全擦除的明確區別。 | Resolved |
| R-04 | Minor | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/nfr-design/scalability-design.md > SC-03 — Growth and Capacity Triggers；aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/nfr-design/performance-design.md > PD-03 — Queries and Connections | 原先 checkout 上限 100ms 搭配 p95>100ms 會漏報。修訂後 60 秒窗口納入所有成功／逾時／失敗，任一 timeout／失敗即警示，另以 p95≥80ms 預警；通知合併不丟計數，無樣本不填零。OD-02 與 T-POOL-01 一致。100 筆恰為 100ms 的逾時反例現在會觸發，不依賴排程超時。 | 無剩餘設計修正；後續以 T-POOL-01 驗證實際量測與通知路徑，不將本次靜態計算當作負載測試。 | Resolved |
| R-05 | Minor | aidlc/spaces/default/intents/261005-lunch-decision-bot/construction/u1-lunch-bot/nfr-design/logical-components.md:50 > LC-03／CHG-05「受影響上游與來源」 | 清除修訂的功能流程映射列為 WF07／WF09，卻漏列直接承載舊保證的 WF06 第 8 步與 WF08 第 3、8 步；functional-spec 的 QueryHistory／CleanupJob 狀態機仍使用 physically_absent／complete。前者 WF07 實際是撤回與重新同意。LC-03 已明確放棄原全殘留承諾，故不認定設計偷偷違反凍結上游；但變更清單未精確指出這些清除流程／狀態，後續依清單衍生測試時可能漏換舊斷言。 | 在 CHG-05 的受影響清單補上 WF06、WF08、相關狀態機及 BR7.4／BR9.2–BR9.3，明確對照舊 physically_absent／complete 與新線上 row 移除／online_removed 的意義，並保留不可復活等未放寬部分；不需倒改凍結文件。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
| --- | --- | --- |
| sensor-required-sections，stage=nfr-design，逐六份產出 | 全部 exit 0、pass=true、零 findings；performance／security／scalability／reliability／observability／logical-components 的 H2 數為 6／8／5／7／6／8 | 文件結構通過，不驗證實作或競爭語意。 |
| sensor-upstream-coverage，security-design.md，指定八項 consumes | exit 0、pass=true，unreferenced=[] | 八份上游引用齊全；不代表修訂影響清單逐條精確，故仍可有 R-05。 |
| sensor-traceability，traceability.json | exit 0、pass=true；gaps／orphans／missing／invalid 清單皆空 | 50 項映射結構完整；需另外讀 coverage_basis 及 amendments，不能解讀成原強保證達成。 |
| node /private/tmp/validate-lunch-nfr-design.mjs | 先讀程式及確認上游掃描目錄範圍後執行；exit 0，structuralPass=true、documents=6、mapped=50、ok=50、deferred=0 | 驗證新摘要回答、修訂標記、來源／章節、12 個反例規格及實際 budget 表累計 4,800ms；僅文件查核。 |
| 獨立唯讀 Node 集合／算術檢查 | 六份指定上游擷取 50 個唯一 NFRx.y；映射 50，缺漏／多出均空；amendments 為 CHG-01／02／04／05。100 筆 100ms timeout 的 p95=100，舊警示 false、新警示 true | 未依賴 sensor 結論核對需求集合及 R-04 靜態反例；非應用或 DB 測試。 |
| 獨立 Ruby YAML 元件檢查 | 四元件、三條單向依賴、無環；九個實體各保留原 owner | 同 PostgreSQL／分離 repository 沒有轉移 owner 或新增反向業務呼叫。 |
| linter／type-check | 不適用：六份設計無 TS／JS 實作片段 | 未安裝、執行應用／資料庫／平台／負載／安全測試或外部 API；未做 Git 操作。 |

### Amendment Basis and Adversarial Assessment

已閱讀問答的 Q2、Q3、Q4 各自回答及整份摘要的 `[Answer]: Looks correct`；產物一致引用新授權識別 `f451da1a48f2b605e5c6a399203fe6caad38982e4347a0c1d6c7ed55e0d11d17`。本輪以這些明確變更及 LC-03 為有效設計基準，不以舊摘要或上一輪風險處置代替本次決策，也不把文件檢查視為授權有效性的獨立稽核。

- **輸出交錯**：刪除先提交時，新鎖後快照不能納入該筆；授權先成立後刪除，該則在資格內仍可啟動，屬 Q3 明示允許。結果不完整／逾時不得建立能力，資格過期、消費兩次與跨程序皆拒絕。審查的是應用單次 transport 操作的啟動，不重新要求已放棄的實際 socket／LINE 原子交接。
- **提交交錯**：共同本人鎖保持保存、撤回、刪除的 DB 提交順序。原期限前已發起 COMMIT 而晚完成可回 unknown，不視為 rollback；控制時效、原到期日及清除義務沒有隨 Q2 被延長。cancel／close 與 backend 終止證據分開，避免以換連線掩蓋未終止工作。
- **清除與復原**：主表查不到必須由固定範圍的直接查詢及防补寫條件支撐，不透過已過濾過期資料的歷史 API 判定完成。底層殘留仍存在並不自動使新版線上刪除失敗，但不得復活成應用歷史；超過原 due、未知提交及控制證據不足仍安全失敗。Q4 沒有授權備份、快照、額外副本或省略政策查核。
- **相容性與實作邊界**：同版部署、privacy:v2／reply-history:v2 能力檢查、拒絕舊 PageResult 直接發送、內部 envelope 不送入 LINE 官方 JSON，以及發現既有真人資料即停止另議遷移，足以界定新建版本的實作方向。精確 schema／型別與負面測試可由 Code Plan 落實，不能以 v1 的 additionalProperties=false 靜默塞欄位。R-05 僅要求補精確的清除來源／狀態對照。
- **容量與驗證聲稱**：4,800ms budget 留 200ms 至 5s 目標，pool 4＋6＋1=11 與 DB 20 的維護餘裕一致；兩程序不盲複製連線數。清除每 60 秒、至多 100 個 key／批、5 秒交易及重試不重設 due 有明確規格。上述仍須實測，不把配置數字、工具名稱或 50 個 OK 當成能力證明。
- **未解除的外部前提**：Google 候選的 20 筆涵蓋、欄位 SKU、完整條款／標示、費用及真人資源仍未獲本次審查放行；法域、殘留風險政策、儲存／主機設定、可信時間、維護通知與必要品質證據仍按既定 gate 完成。

### Summary

R-01–R-04 均為 Resolved：前三項是依人類明確修訂的保證補成具體設計，不是原強保證已技術實現，也不是本審查代為接受風險。現有未解 findings 為 0 Critical、0 Major、1 Minor，依角色既定門檻判定 READY；此結論只表示可依修訂基準進行後續設計／實作，不代表真人使用、部署、合規或應用測試通過。
