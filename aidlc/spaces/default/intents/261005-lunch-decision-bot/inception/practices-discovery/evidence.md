# 午餐決定器 LINE Bot：實務探索整合證據

狀態：**Step 5 整合完成，待本階段最終核准**。主筆已讀七題完成訪談及三份獨立意見，只整合四份自有文件；問題檔與原始 contribution 保持不變。人類採用實務不等於已實施、測試通過、合規完成或已取得外部資源授權。[I][QLT][DEV][SEC]

## 確認依據與證據界線

- Q1–Q7 每題均記錄 `[Answer]: A`，人類原文逐題為「同意」；最後摘要答案為 `Looks correct`。本次派工提供成功的摘要授權 receipt `0b6c6c91a85730e6286a88224119e62305f64de8e0e15d1c0c3a637c997098c0`；此處記錄其來源，不另外操作或重建 receipt，也不將其視為最終階段核准。[I][dispatch]
- 組織預設與現行規則來自 org；新採用實務來自本階段回答；產品限制來自已核准 Ideation；角色知識及支持意見是建議來源，只有被回答採用的部分才能寫成人類選擇。[memory:M1][I][P1][P2]
- 沿用 Step 2 有界盤點：排除框架、流程記錄、Git 與依賴目錄後，當時只列出 `AGENTS.md`、`.gitignore`，未發現應用程式／CI／測試／部署配置；本次沒有重掃工作區。框架工具不是 Bot 技術證據，也不推論其他專案或外部帳號不存在。
- 現讀 W1 仍為 Greenfield、Depth／Test Strategy `Standard`、技術 `Unknown`；實務確認時間空白，`practices-discovery` 進行中。既有 team／project 空白實務模板的判讀沿用前次讀取；本次不推送記憶。
- 本次沒有執行應用建置、測試、CI、安全掃描、真實串接、部署或外部資源／法律查核；沒有相關成功率、覆蓋率結果、工具可用性或合規證明。

## 人類採用決定

各列均對應問題檔原文「同意」及其 A 選項，並由最後 `Looks correct` 確認；以下是摘要，不替代原始回答。[I]

| 問題 | 採用內容 | 主要落點／保留邊界 |
| --- | --- | --- |
| Q1 | 沿用 main、短期分支、squash；提出者確認功能／範圍，開發者提供摘要及檢查結果 | Way of Working；其他協作者責任另記，不授權當下分支／提交／自動合併 |
| Q2 | 合成資料先串通最小輸入到推薦流程，再逐段補齊例外與完整歷史保護，授權後驗真實串接 | Walking Skeleton；第一切片不等於整個版本或固定第一 Unit 全部工作，不改 scope 或啟用儀式 |
| Q3 | test-after，每層立即完成測試，可連接邊界即整合驗證再擴充 | Methodology／Ordering；未改成 TDD 或 custom |
| Q4 | 至少 80% 行覆蓋率、包含未載入原始碼、可審查排除清單；適用建置、格式／lint、單元及關鍵整合測試均為合併前 CI 檢查 | Testing Posture、discovered-rules；必要檢查失敗／未執行不能算通過，必要隱私與生命週期案例不能被百分比取代 |
| Q5 | 本機可重現驗證先行，非正式真實串接環境另確認；已授權 staging 才沿用合併後部署 | Deployment；不正式上線，不取得建立資源、付費或真人資料傳送授權 |
| Q6 | 適用設定優先、只補未涵蓋規則，本機／CI 同版本及命令；驗證外部輸入、明確錯誤與部分成功、只安全重試 | Code Style；語言、工具、架構、錯誤表示法與重試機制未定 |
| Q7 | 秘密、依賴及適用 SAST；有效外洩憑證、已確認 Critical／High 風險處置前阻擋；必要檢查未執行／失敗不算通過 | Testing Posture、Deployment、discovered-rules；提出者另決誤報／限期例外，保留隱私；DAST 需受控目標授權，不擅自掃第三方或新增外傳 |

## 參與者與異議處置

主筆整合政策；品質角色提供測試順序、CI 與生命週期案例意見；開發角色提供設定優先、錯誤及切片尺度意見；安全角色提供 lint／format 歸因、掃描與供應鏈控制意見。三份原始 `Positions` 全文保留。[QLT][DEV][SEC]

下列識別碼依各 contribution 的 `OBJECT:` 出現順序建立，僅用於本文件追溯，沒有更改原文或宣稱支持角色已重新審閱整合版。

| 異議 | 人類決定與本次處置 | 仍待完成 |
| --- | --- | --- |
| QLT-O1：Ordering 可能將整合延至全部功能完成 | Q3 採納修正；一個明示句子要求每層立即測試、邊界可連接即驗證後再擴充 | 實際程式及測試尚未執行 |
| QLT-O2：既有 lint 阻擋不能全數寫成可選 | 修正 org 歸因；Q4 新增格式、建置／測試及覆蓋率門檻，必要失敗或未執行不能算通過 | CI 平台、命令、報告留存與偶發失敗處置細節待設計 |
| QLT-O3：缺生命週期交錯驗證 | Q4 採納重送／併發、撤回／刪除與在途事件、刪除確認、到期及必要復原案例；加入 Testing Posture | 生效切點、確認期限、不可見與實體清除時限、閏日／時區、副本語意仍待需求，不宣稱技術風險已解除 |
| DEV-O1：未明示先讀設定、只補未涵蓋項目 | Q6 採用並寫入 Code Style；本機／CI 同版本與命令 | 工具與維護人選未定 |
| DEV-O2：缺歷史失敗、部分成功與安全重試 | Q6 已採用；列明保存／查閱／刪除失敗，不把部分成功當全成功，只安全重放 | 回覆文案、重試界線／次數及與同意／刪除交錯規則待設計 |
| SEC-O1：格式 CI 被錯歸為 org 明文 | 已修正：org 明文是 lint 合併前 CI 且失敗阻擋，格式檢查阻擋來自 Q4 新採用 | 未以新格式要求反推既有配置已存在 |
| SEC-O2：僅評估掃描不足以形成可操作政策 | Q7 已確認秘密／依賴／適用 SAST、失敗處理、Critical／High 處置及 DAST 授權界線；敏感位置證據沿用產品保護 | 供應鏈權限隔離、來源／版本固定、掃描完整範圍與適用性、證據欄位／保存等控制仍是後續設計事項；未把所有角色建議當成已採用硬規則 |

另處置開發角色的切片尺度建議：Q2 將最小合成資料流程與完整 SCP-01–SCP-09 交付分開；完整歷史測試清單不是強迫第一個 Unit 全部完成。真人資料保護的先決條件維持不變。[DEV][I Q2][P2][P6]

上述已處置的是文件主張及政策選擇；表中未定需求／控制仍開放。沒有收到整合後新的「維持異議」回覆，也未要求角色撤回異議；不能據此宣稱所有角色已同意整合版或所有技術疑慮已關閉。

## 來源修正與持續界線

- **80%**：Step 2 正確保留自訂 scope 未定數值；現在由 Q4 明確新增。分母包含未載入的應用可測原始碼，排除依賴、產生碼、AI-DLC 與測試，排除清單須可審查；不是把 Standard 自動等同列舉 scope 的底線。[I Q4][QLT]
- **lint／format**：初稿將兩者一併歸為 org 的說法不精確；本次修正為 org 原有 lint 阻擋，加上 Q4 新採用的格式檢查政策。角色工具範例仍不等於已選工具。[memory:M1][SEC][I Q4]
- **產品核准現況**：交接文件的核准前措辭是產出時點狀態；W1 與派工明示 Ideation 已完成。本階段答案則以本次問題檔為依據，不從 Ideation 核准推導。[P1][W1][I]
- **scope**：原檔未宣告 `skeleton:`，Q2 不改檔、不自行推導 `on`／`off` 或啟用儀式；有效設定來源由 orchestrator 按規則處理。其英文簡介的 budget／preferences 不追加為產品功能，OUT-02 的篩選排除仍適用。[scope][memory:M1][I Q2][P2]
- **部署／授權**：Q5 本機優先、已授權 staging 才沿用 org 合併後部署；Operation 略過及本輪不上線不免除必要產品驗證，也不授權建立環境。Q7 沒有授權掃描第三方或把程式／資料傳到新外部服務。[W1][I Q5、Q7]
- **時間與版本**：本次以唯讀 `date -u '+%Y-%m-%dT%H:%M:%SZ'` 及 `git rev-parse --verify HEAD` 取得 `2026-10-05T10:55:46Z`、`7a1f627f8c7b92699c5a8a4402169caf0a78f857`，用於一行 `Discovered` 記錄；此為探索時間與當時 HEAD，不是 affirmation、所有來源均已提交或該版本已測試的證據。

## Sources

- [I] `practices-discovery-questions.md`：Q1–Q7、Deferred Requirement Details、Consolidated Summary Confirmation。
- [QLT] `contributions/aidlc-quality-agent.md`：全部 Contribution、三項 OBJECT 及後續未知。
- [DEV] `contributions/aidlc-developer-agent.md`：全部 Contribution、兩項 OBJECT 及切片尺度建議。
- [SEC] `contributions/aidlc-devsecops-agent.md`：全部 Contribution、兩項 OBJECT 及掃描／供應鏈建議。
- [memory:M1] `aidlc/spaces/default/memory/org.md`；team／project 模板狀態沿用 Step 2 讀取的 `aidlc/spaces/default/memory/team.md`、`aidlc/spaces/default/memory/project.md`。
- [W1] `aidlc/spaces/default/intents/261005-lunch-decision-bot/aidlc-state.md`。
- [scope] Workflow-selected scope: `line-lunch-decision-bot`；`.codex/scopes/aidlc-line-lunch-decision-bot.md` 原文沿用 Step 2 證據。
- [P1] `aidlc/spaces/default/intents/261005-lunch-decision-bot/ideation/approval-handoff/initiative-brief.md`。
- [P2] `aidlc/spaces/default/intents/261005-lunch-decision-bot/ideation/scope-definition/scope-document.md`。
- [P6] `aidlc/spaces/default/intents/261005-lunch-decision-bot/ideation/scope-definition/intent-backlog.md`。
- [F] `.codex/aidlc-common/stages/inception/practices-discovery.md` Step 5、`.codex/aidlc-common/protocols/stage-protocol-ensemble.md` §11；persona 與共享／角色知識沿用前次已載入內容，均屬框架方法，非應用證據。
- [dispatch] 本次 Step 5 派工提供摘要 receipt、允許編輯的四檔及禁止流程／記憶操作界線；receipt 未在本次另行驗證或重建。

## Assumptions & Open Questions

- **需求與生命週期**：一年曆年／時區／閏日、清除時限、撤回與刪除對在途事件的生效切點、既有資料清除義務、刪除確認有效期、失敗查詢及詳細歷史欄位仍待明訂；不重開已確認的一年可選保存、本人權利或完整保護。
- **設計與可靠性**：部分成功的使用者回覆、重試等待／次數、去重資料期限、資料副本與復原、一致性及儲存機制未定；不得用待設計作為對真人省略保護的理由。
- **NFR 與驗證責任**：受邀試用量、尖峰負載、接收事件及推薦回覆的時間界線／百分位、失敗率、清除量測與環境待需求化；後續確立的 NFR 仍須指定驗證歸屬，即使 performance-validation 階段略過。
- **工具與安全落地**：語言、框架、資料／CI／掃描服務、帳號／額度、預算、具名維護及秘密輪替責任未知；掃描範圍與適用性、修補／例外期限、CI 供應鏈及權限、證據存取／保存、DAST 允許目標／流量／停止條件留待設計。
- **流程銜接**：skeleton 有效設定來源、實際驗證命令，以及本階段驗證、探索事件、後續 learnings、最終核准及推送由 orchestrator 處理；本次僅完成文件整合，未修改原始意見、問題檔或流程狀態。
