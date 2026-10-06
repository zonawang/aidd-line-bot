# U1 午餐推薦 MVP：修訂實作計畫

## Sources and Change Authority

- `mvp-scope-adjustment.md`：使用者 2026-10-06 明確要求 Time-to-MVP 優先，並以「是」確認無歷史推薦 MVP。這是新增交付切片，非原完整歷史版本完成。
- 原上游需求、功能、NFR、契約與設計仍保留；追溯依 `../../../inception/requirements-analysis/requirements.md` FR1–FR9，以及本 Unit 的 functional-design、nfr-design、infrastructure-design。
- `history/pre-mvp/`：原 22 步計畫、測試指引與已批准問答的完整快照；舊 Step 1／2 已完成，DB Step 3／4 部分成果保留但未完成。
- `known-limitations.md`：原 infrastructure／PG 問題與歷史、負載、真實串接等未完成義務。不得再次用這些工作阻塞核心 Bot 實作。

## Scope and Authorization

沿用單一 Node.js 24／TypeScript／Fastify 程序和既有精確鎖版依賴，不新增 DB、VM、微服務、Kubernetes、儲存或部署平台。現有 PG／Compose／Lima 檔案、資料與失敗結果不動；MVP 執行與新測試不 import 或啟動舊儲存入口。

本次先交付「私訊主動位置 → 一公里內最多三家不同餐廳 → 理由及地圖」，以及初次告知、輸入引導、來源／LINE 故障處理、本機可重現展示。保存一年、歷史查閱／刪除／撤回等功能明示尚未提供；使用者詢問歷史時不能假稱查無資料或已刪除舊資料。

精確 Plan Approval 只授權本計畫的程式、測試、設定與文件產生，以及已授權本機合成驗證；不授權真人外傳、付費、部署、推播、Git mutation、外部掃描或新工具安裝。缺 LINE／合法來源前提時繼續完成本機核心與 adapter，不盲目開啟真實出口，也不拿 mock 冒充真實 API 成功。

## MVP Behavior

- LINE：驗證原始 bytes HMAC 與必要結構／時效；只處理 active 私訊，文字引導傳送 LINE location。保留 256KiB 本文上限、24 小時前至 5 分鐘後事件窗口與原 10 秒當次處理界線。
- 告知：說明不保存歷史及實際第三方傳输。尚未確認的第一筆位置立即放棄，不緩存等待；用私訊確認後請其重傳。僅使用有界短期記憶體告知狀態，重啟／到期後重新告知，不提供未實作的保存選項。
- 推薦：有效餐廳、未四捨五入 WGS84 直線距離 ≤1000m、不重複；已知營業中優先，未知清楚標示，排除明確休息或停業。組內距離與穩定 ID 排序，最多三家，各有名稱、基於資料的理由、地圖及必要來源標示。
- 來源：保留獨立 adapter。合成 provider 僅用測試／明確 demo；真實候選 adapter 優先對接 Google Places API (New)，實作前查官方 API／顯示條款，不能把候選選型當權利或費用已核准。固定可信 endpoint、型別與大小檢查、有界逾時，失敗不擴圈、不切未授權來源。
- 候選範圍：MVP 只在來源此次實際返回的候選集合中篩選排序，明示這不是全區所有餐廳或全區最靠近三家的保證；API 結果上限不能冒充全量。必要欄位／來源標示無法合法顯示就回報具體限制。
- 錯誤：不足／零結果、來源故障／逾時、LINE 拒絕／結果不明分開；不捏造送達、不盲重送、不 push。短期有界去重僅存必要控制代碼，不含位置／訊息／回覆 token；不承諾跨重啟 exactly-once。
- 隱私：不建立位置或來源內容檔案、DB、持久佇列或 cache；logging 不含本文、座標、token、原始 user ID、provider payload 或秘密。未啟用歷史不等於已刪除原資源。

## Execution Steps

各層先實作、立即撰寫並執行該層測試，再連接下一層。新步驟未實際完成不可勾選，原資料層失敗不重新標記。沒有獨立網站／前端，LINE 互動承接可觀察使用者流程。

- [x] Step 1 — 沿用已完成 workspace、Node／npm、package lock、TS／ESM、lint／format 與版本設定，不重裝、不新增 runtime。（NFR9；原 Step 1）
- [x] Step 2 — 沿用 Vitest、safe reporter、Unit projects、合成 clock／fixture 與全 `src/**/*.ts` 80% 覆蓋率設定；既有 runner 證據保留。（NFR8；原 Step 2）
- [x] Step 3 — 實作小型設定／共用型別、LunchRecommendation 與 RestaurantSourceAdapter；無 DB dependency，包含明確合成來源及受設定／授權限制的真實 adapter、型別與距離檢查、去重排序、必要 attribution 與安全錯誤型別。（FR1.2、FR3、FR4.1–FR4.2、NFR4／6）
- [x] Step 4 — 立即寫跑推薦／來源單元與 HTTP 邊界整合：一公里邊界、重複、closed／unknown、0／1／2／3 家、invalid／partial、timeout／HTTP error；證明來源失敗不是空結果，mock 不開真人出口。（FR3–FR4、NFR8）
- [x] Step 5 — 實作 Fastify Webhook、LINE 原始驗簽與私訊事件驗證、無歷史告知與重傳、Messaging API reply、短期有界控制資訊、10 秒期限及不盲重試；`GET /health` 僅回安全狀態。（FR1–FR2、FR4、NFR2／4／5）
- [x] Step 6 — 立即寫跑入口／transport 单元與整合：正反簽章、本文變動／大小、群組／無效位置、事件時效、未確認零外傳、重送、LINE 接受／拒絕／unknown；只以 mock HTTP 替代外部供應方，不啟動 PG。（FR1–FR2、FR4、NFR2／4／8）
- [x] Step 7 — 完成繁中訊息、位置 quick reply、推薦／不足／失敗／未提供歷史文案、程式入口、demo／live 明確設定、啟停與環境變數範本及最短執行說明；`npm run dev`、`npm start` 不需 Docker。（FR1–FR4、NFR7／9）
- [x] Step 8 — 立即寫跑訊息及一條完整合成 E2E：引導／告知確認→重傳位置→來源→reply，含故障出口與敏感 canary 不進診斷；結果明示 synthetic，不宣稱實際 LINE 接受。（FR1–FR4、NFR4／7／8）
- [x] Step 9 — 執行 MVP 精確單元／整合／E2E、build、typecheck、lint、format 及全應用行覆蓋率≥80%；保留既有可本機執行的單元回歸，不把既有 PG integration 偷改綠或放進 MVP 啟動相依。（NFR8／9）
- [x] Step 10 — 準備最小 CI／必要安全檢查交接及 README、known limitations：沿用相同命令／鎖版，區分本機展示與合併前檢查。秘密／依賴／SAST、hosted CI 未執行就明列未驗證，不偽造通過、不自行 push／啟用外部服務；CI Pipeline 階段續接，不在此研究 production 平台。（NFR9）
- [x] Step 11 — 具體憑證、合法來源／顯示權利、入口與費用授權具備後，執行受控真實 LINE→來源→reply 驗證並保存不含敏感值的結果；未具備則寫明外部待辦，本機產品實作不回到 DB 診斷。未完成真實驗證不得勾本步或稱真實 MVP 已驗證。（NFR6／8）
- [x] Step 12 — 產生 `code-summary.md`、真實 `source-manifest.json` 與追溯：分開本機合成 MVP、真實推薦 MVP、原完整版本；所有延後 FR／BR／NFR 連到調整依據與待辦、不標 OK。只對實際完成的範圍申請相應驗證／審查，不假報原 Unit 全部完成。（全部追溯）

## Source and Test Layout

| 責任 | workspace 路徑 |
| --- | --- |
| 組裝、設定、啟停 | `src/main.ts`、`src/app.ts`、`src/config.ts` |
| 推薦與來源 | `src/lunch-recommendation/`、`src/restaurant-source-adapter/`、`src/shared/` |
| LINE、無歷史告知與訊息 | `src/line-interaction/`；不建立假實作的歷史 repository／service |
| 測試 | `tests/u1-lunch-bot/unit/`、`integration/`、`e2e/`，精確檔案見 `unit-test-instructions.md` |
| 執行說明 | `README.md`、`.env.example`、`docs/app/`；原環境文件保留並標示不屬 MVP 必要前置 |

可維持四責任的邊界概念，但本切片不產生未實作假成功的歷史元件。必要外部版本查核限當前 API／依賴，不再擴張成 VM／DB／磁碟工程。

## Requirement Mapping and Deferred Work

| 需求 | 當前計畫 | 延後／狀態 |
| --- | --- | --- |
| FR1、FR3、FR4.1–4.2 | Steps 3–9、11 | 候選範圍改為來源此次返回集合；真實權利／整合另核對 |
| FR2、NFR4 當次處理 | Steps 5–8 | 僅不保存選項及短期告知；持久同意偏好／保存設定延後 |
| FR4.3、FR5–FR9、NFR3 歷史權利 | 無歷史入口不假回查無／已刪 | 全部保留後續，須權利保護完成才啟用 |
| NFR1／NFR2 | 期限、時效、必要逾時與單程序去重測試 | 300 筆負載／p95 SLO、跨程序／重啟強保證延後，數值未改低或宣稱達成 |
| NFR4／NFR5 | 無應用落地、去敏錯誤、合成 canary | 底層全媒體存放與 production 觀測深入驗證延後，不過度主張保證 |
| NFR6／NFR7 | 真實出口前提、attribution、繁中互動 | 帳號／費用／真實證據未具備就未驗證 |
| NFR8／NFR9 | test-after、全部 src ≥80%、關鍵整合、建置／lint／format | CI 與必要安全檢查仍為合併前義務，未做不可算通過 |
| 原 IR-01／IR-02 及 PG／infra 專屬 BR／NFR | 保存舊成果與原失敗證據 | 不在推薦切片啟動依賴；不可用 mock DB 假稱修復 |

## Completion Boundaries

本計畫不將 scope change 包裝成原測試通過，也不改 memory／guards 或上游凍結設計。對原完整版本的未完成要求保留；是否能結束整個 Unit 由實際適用成果及後續驗證決定，不為 time-to-MVP 偽造完成。真人前提若缺失，只阻擋真人出口，不阻擋本機合成 MVP。

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "每個可測層實作後立即撰寫並執行該層測試；相依邊界一旦可連接，即完成其整合測試，再擴充下一段功能，最後執行完整流程驗證。",
  "scope": "line-lunch-decision-bot",
  "test_strategy": "standard",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: 每個可測層實作後立即撰寫並執行該層測試；相依邊界一旦可連接，即完成其整合測試，再擴充下一段功能，最後執行完整流程驗證。\n\n上述方法與順序由 Q3 採用。我們保留 `Standard` 的單元及關鍵邊界整合測試；每元件約 5–8 個測試僅為軟性規劃指引，數量及比例不能排除必要行為、隱私或生命週期案例。[Q3][Q4][W1][F3]\n\n- **行覆蓋率**：我們新增至少 **80%** 的應用可測原始碼行覆蓋率底線，分母包含未被測試載入的應用原始碼；排除依賴、產生碼、AI-DLC 框架及測試本身，排除清單須可審查。這是 Q4 對本自訂 scope 的新採用要求，不是由 Standard 自動推導，也不代表已達標；不得為通過檢查而降低。[Q4][memory:M1]\n- **合併前 CI**：我們執行適用建置、格式、lint、單元與關鍵整合測試並檢查覆蓋率；必要檢查失敗、未執行或未達門檻時不能視為通過或合併。既有 org 明文要求 lint 在合併前 CI 執行且失敗阻擋 PR；**格式檢查門檻是 Q4 新採用**，初稿的來源歸類已修正。平台、工具、命令與報告位置留待選定。[Q4][memory:M1]\n- **推薦與入口**：我們驗證私訊／群組及無效輸入界線、一公里範圍、候選不足／重複、未知／休息／停業狀態，以及外部故障不得冒充無結果或成功；名稱、理由與地圖須對應實際候選。[P2 SCP-01–SCP-03、SCP-08–SCP-09][QLT]\n- **同意與本人權利**：我們驗證未同意仍可推薦且不新增歷史、同意後本人查閱、撤回後停止新增，以及跨人查閱／單筆刪除／全部刪除均被拒絕；來源驗證不能取代本人授權。刪除確認涵蓋範圍、取消、重複與過期情境，其有效期及具體行為留待需求明訂。[Q4][P2 SCP-04–SCP-08][QLT]\n- **生命週期交錯**：我們驗證重送與併發不重複建檔、撤回／刪除與在途查詢或延遲事件交錯、每筆一年獨立起算、到期前／當下／之後、清除失敗及必要復原；新查詢不延長舊紀錄，已刪或到期資料不重新可見。以受控時間測試一年邊界，讀取不可見與實體清除完成分別驗證；曆年／時區／閏日算法、生效切點與時限仍待需求化。[Q4][P2 SCP-07–SCP-09][QLT]\n- **證據與完整流程**：我們在日常測試使用合成資料與受控供應方回應，檢查一般診斷及失敗路徑不形成替代位置歷史；授權後另保留真實 LINE → 資料來源 → 回覆及本人歷史管理的可重現證據。覆蓋率、模擬成功或安全掃描都不能取代上述關鍵案例與真實串接；未驗證者如實標示。[Q4][P2 SCP-08–SCP-09]\n- **安全檢查**：我們納入秘密、依賴與適用的 SAST 原始碼安全檢查；確認有效的外洩憑證及已確認 Critical／High 風險在處置前阻擋合併。必要掃描失敗或未執行不能算通過；誤報與限期例外由提出者檢視依據另行決定，不能取消既有隱私保護。掃描工具、適用性、判讀規則、修補及例外期限待設計，不把工具不存在或掃描涵蓋為零當通過。[Q7][SEC]"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:b0dbecde1d7e0b8fb8b774ae0e5b0cedc01eac04a0a232c8609894a3a787379a",
  "contract_sha256": "sha256:c5dec7fa39fd4eda2b6ded095f4b0fffbf47913be5a50f6db66e2f5003d03b7c"
}
```
