**Collaborator:** aidlc-developer-agent

## Contribution

本次僅為 Step 3 的文件獨立審查；以下補充皆為待訪談建議，不代表新增人類共識、技術選型或架構決策。已讀四份主筆初稿及指定證據；未讀其他支持角色成果，未進行應用程式掃描或測試。[D1–D4][F1–F2]

- **命名與設定優先**：認同語言選定後採慣用命名。建議補明「提出風格建議前，先讀適用的應用 linter／formatter 設定；僅對設定未涵蓋處提出補充」。工具名稱是範例，框架 TypeScript、記憶模板中的 named exports／`Result<T, E>` 都不是 Bot 慣例。設定、工具版本與檢查命令日後應可重現，具體工具仍待選定。[D1 Code Style][M1–M3][K1]
- **責任界線與檔案組織**：保留訊息入口、供應方資料、推薦規則、同意與歷史管理的責任區分，目的在讓輸入驗證、業務結果及外部副作用可分別驗證；不據此預先指定服務數、固定分層或資料夾。檔案可依所選語言／框架慣例聚合相關責任，測試位置隨工具決定；角色知識中的每檔單一 export、行數上限與介面模式不升格為團隊硬規則。INT-01–INT-06 仍是成果分組。[D1][U3][K1]
- **入口與外部回應**：建議在外部資料進入時驗證來源、型別及合理範圍，再交由內部規則處理；來源驗證不等於本人授權，歷史操作仍需核對操作者與紀錄歸屬。餐廳資料缺漏／營業狀態未知也需有明確表示，不能被型別預設值變成「營業中」。此為承接 SCP-01、SCP-03、SCP-08 的候選實作原則，驗證套件與身分機制留待設計。[U2][K1]
- **錯誤語意**：草稿已區分無結果、權限拒絕與外部失敗；建議補上保存／查閱／刪除失敗及部分成功的處理原則。餐廳零候選屬正常業務結果，逾時或供應方故障不能轉成空清單；推薦成功也不證明歷史已存入，刪除失敗不能回覆已刪除。錯誤須保留可診斷原因，對外訊息與內部診斷分開，診斷不複製位置、完整訊息或憑證；避免每層重複記錄原始輸入。使用例外或顯式結果由語言慣例及後續設計決定。[D1][U2 SCP-03–SCP-08][K1]
- **重試與資料生命週期**：不要把「可恢復錯誤」直接寫成「一律重試」。候選原則是僅在操作可安全重放時才重試，並釐清處理期間同意撤回、刪除與重複事件交錯的可觀察結果；具體逾時、次數、去重資料及一致性機制待需求／設計決定，不預設佇列、資料庫或交易模式。[U2 SCP-04、SCP-06–SCP-08][assumption]
- **最小切片的尺度**：Walking Skeleton 提案幾乎涵蓋完整歷史生命週期，宜明示其為風險驗證清單，不直接固定為第一個 Unit 的全部工作。先行內部整合切片與 SCP-01–SCP-09 完整交付應各有界線；真人保存前的既有保護條件維持不變。scope 未宣告 `skeleton:`，目前也沒有可據以斷言啟用儀式的資料。[D1–D3][U2–U3][S1]

## Positions

- AGREE: 四份初稿清楚保留未確認狀態，且區分框架方法、產品限制與提案；`Draft:` 時間不冒充最終完成或實務核准。[D1–D4]
- AGREE: Code Style 採語言慣例與應用設定，責任界線尚未被宣告為架構；既有一年歷史、本人權利與診斷限制有上游依據。[D1–D2][M1][U2]
- OBJECT: Code Style 尚未明示「先讀適用 linter 設定、只補未涵蓋部分」，容易讓角色範例變成重複或衝突的風格規則；建議補入設定優先的操作順序。[D1][M1]
- OBJECT: 錯誤處理提案仍缺保存／刪除失敗、部分成功及安全重試的訪談項目；僅區分無結果／權限／外部錯誤不足以決定一致的使用者回覆。[D1][U2][assumption]

## Sources

以下 `<record>` 為 `aidlc/spaces/default/intents/261005-lunch-decision-bot`；所有路徑相對工作區。

- [D1–D4] `<record>/inception/practices-discovery/` 下依序為 `team-practices.md`、`discovered-rules.md`、`evidence.md`、`practices-discovery-timestamp.md`；均完整讀取。D3 的應用檔案盤點是主筆證據，本次未另行重做。
- [U1–U3] `<record>/ideation/approval-handoff/initiative-brief.md`、`<record>/ideation/scope-definition/scope-document.md`、`<record>/ideation/scope-definition/intent-backlog.md`。
- [W1] `<record>/aidlc-state.md`：Greenfield、應用技術 Unknown、實務確認時間空白；Ideation 已 Verified，不延伸為本階段實務同意。
- [M1–M3] `aidlc/spaces/default/memory/org.md`、`aidlc/spaces/default/memory/team.md`、`aidlc/spaces/default/memory/project.md`；org 依派工的逐字規則讀取，後兩者實際讀取，註解範例不作既有實務。
- [S1] `.codex/scopes/aidlc-line-lunch-decision-bot.md`；未指定應用技術與 `skeleton:`，簡介的 budget／preferences 不追加為已核准功能。
- [F1–F2] `.codex/aidlc-common/stages/inception/practices-discovery.md` Step 3；`.codex/aidlc-common/protocols/stage-protocol-ensemble.md` §5、§11。
- [K1] `.codex/agents/aidlc-developer-agent.md`；依序載入 `.codex/knowledge/aidlc-shared/` 九份及 `.codex/knowledge/aidlc-developer-agent/` 六份 Markdown，尤以 `rules-reading.md`、`code-generation-guide.md`、`code-generation-patterns.md` 為本次判讀依據。active-space 對應兩個 knowledge 子目錄未提供補充。知識內容只作方法依據。
- [assumption] 本支持審查提出的實作原則與追問方向，尚未由人類確認。

## Assumptions & Open Questions

- **本階段訪談**：確認採用「語言慣例＋應用設定優先」的方向、現有外部團隊規範／技術限制是否需要提供，以及誰維護檢查設定；沒有既定工具時，可將具體選型留到設計，不必現在指定品牌。
- **本階段訪談**：確認是否採用外部邊界驗證、明確錯誤分類及最小診斷資料的開發原則，是否有既定錯誤表示與檔案組織規範；保留未決狀態，不能以本審查代填同意。
- **需求／設計交接**：補問推薦成功但保存失敗、刪除未完成時使用者可見結果；撤回／刪除與進行中查詢或重送交錯時的處理；重試等待上限、失敗查詢留存及不含位置的必要去重資訊生命週期。這些是既定成果的細化，不重新詢問是否保留一年歷史或本人權利。
- **整合安排**：釐清先行內部切片的最小證據與完整交付差異，以及 `skeleton` 缺省的有效規則來源；不由本文件指定 Unit、變更設定或宣稱測試已通過。
