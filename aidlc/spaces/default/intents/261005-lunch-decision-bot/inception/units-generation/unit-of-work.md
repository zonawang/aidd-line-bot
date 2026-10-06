# 午餐決定器 LINE Bot：單元定義

## Sources

- [components] `../domain-design/components.md`：四個元件、九個實體及三個單向呼叫關係。
- [decisions] `../domain-design/decisions.md`：ADR-001–ADR-006；本文件只將元件組成部署單元，不改其責任與資料歸屬。
- [requirements] `../requirements-analysis/requirements.md`：全部 FR／NFR、驗收條件及 OQ1–OQ10。
- [practices] `../practices-discovery/team-practices.md`：test-after、80% 行覆蓋率、CI、安全及交付邊界。
- [Q1] `units-generation-questions.md`：Q1 原文「同意」，採一個模組化應用；Q2 保留原文「Approve Plan」。整理後的完整摘要以「Looks correct」確認，紀錄 `4c7e04f0919e74ca90ea0f0dc58216ee60cd2a25e96eba5b30c042d72cdd706f`。
- [plan] `decomposition-plan.md`：保留已核准的一個 service 單元計畫及原始回答；不是實作、測試或正式部署授權。
- [confirmation] 依上述統一問答的新摘要確認重新保存本階段文件，方案不變；較早的確認紀錄保留在問答及計畫附錄供追溯，不作本次保存依據。

## Unit Catalogue

| Unit ID | Directory | Kind | 名稱與描述 | Deployment Model | Complexity |
| --- | --- | --- | --- | --- | --- |
| U1 | u1-lunch-bot | service | 午餐決定器：LINE 私訊推薦及可選本人歷史生命週期的完整應用 | Standalone application；四元件共同版本／部署，外部服務與儲存另行整合 | L |

U1 是唯一單元；`u1-lunch-bot` 同時是依賴 YAML 的 name 及後續 Construction 的目錄名，階段文件位於本意圖 `construction/u1-lunch-bot/` 下。此為預定文件位置，不表示已建立或已實作；應用原始碼依專案慣例放工作區根目錄，不放入意圖紀錄樹。

`service` 是可運行的應用，不是只有 schema 的 spec、獨立 UI、library 或 packaging 單元；須完成適用的功能、非功能、基礎設施、程式、測試及 CI 工作。測試／建置／CI 是 U1 的交付責任，不另拆可部署服務。[plan]

L 是相對複雜度：功能數量不大，但包含本人授權、一年資料生命週期、併發／重送及失敗一致性。它不是人日、預算或交期估算；單元數少不代表可以省略保護或驗證。[requirements][Q1]

## U1 — Boundaries and Responsibilities

### 元件邊界

| Component | Unit ID | Directory | 必須維持的責任 | 不得越界 |
| --- | --- | --- | --- | --- |
| LineInteraction | U1 | u1-lunch-bot | 驗證來源、私訊與事件；可靠本人來源；協調許可、推薦及獲允許保存；繁中回覆、歷史／設定／說明及按鈕 | 不直接改寫 DataPrivacy 資料；不把接收成功當作送達或以按鈕參數代替授權 |
| LunchRecommendation | U1 | u1-lunch-bot | 一公里內資格、距離、去重、穩定排序及有依據的前三家／不足／零結果／失敗 | 不讀個人歷史作推薦；不自行保存位置、候選或來源原始回應 |
| DataPrivacy | U1 | u1-lunch-bot | 統一管理告知／選擇、保存資格、本人歷史、確認、撤回／刪除界線、可見性、限期清除與真實結果 | 不將推薦成功當保存成功；不讓已刪／到期／撤回擋住的舊資料重建 |
| RestaurantSourceAdapter | U1 | u1-lunch-bot | 已授權餐廳來源的介接、格式／失敗判讀、標準候選及來源標示 | 不作推薦排序或本人權利決策；不向餐廳來源傳送本人識別／歷史 |

原三條呼叫仍為 LineInteraction → DataPrivacy、LineInteraction → LunchRecommendation、LunchRecommendation → RestaurantSourceAdapter，皆在 U1 內透過明確介面協作；不新增反向呼叫或跨 Unit 網路。[components][decisions ADR-001–ADR-003]

### 實體擁有者

| Entity | Component Owner | Unit ID | Directory |
| --- | --- | --- | --- |
| LineEventReceipt | LineInteraction | U1 | u1-lunch-bot |
| RecommendationQuery | LunchRecommendation | U1 | u1-lunch-bot |
| RecommendationResult | LunchRecommendation | U1 | u1-lunch-bot |
| ConsentState | DataPrivacy | U1 | u1-lunch-bot |
| QueryHistory | DataPrivacy | U1 | u1-lunch-bot |
| DeletionConfirmation | DataPrivacy | U1 | u1-lunch-bot |
| HistoryWriteControl | DataPrivacy | U1 | u1-lunch-bot |
| CleanupJob | DataPrivacy | U1 | u1-lunch-bot |
| RestaurantCandidate | RestaurantSourceAdapter | U1 | u1-lunch-bot |

實體名稱與歸屬完整沿用 [components]；不在本階段增加型別、枚舉、關聯基數、資料表或 API schema。U1 共用部署不等於所有模組都可讀寫所有資料；DataPrivacy 的資料只能透過其介面操作，最終保存許可與可見寫入仍需可證明一致性。[decisions ADR-002][requirements OQ3]

## Deployment and Trade-offs

採模組化單一應用，四元件共同版本及發布；執行個體數、runtime、部署產品、儲存及可信清除觸發能力由後續設計決定。Standalone 指本專案沒有其他獨立應用 Unit，不代表離線可用或不依賴 LINE、餐廳來源與基礎設施。[Q1]

| 選項 | 利益 | 代價與處置 |
| --- | --- | --- |
| 一個模組化 service（採用） | 減少跨服務驗證、版本相容及部署協調；容易本機重現與端到端受控測試 | 一起發布、共用故障及擴縮邊界；保留內部介面與邊界測試，不宣稱程序內隔離已提供完整安全保證 |
| 另拆 DataPrivacy 為獨立 service（未採用） | 可獨立發布／擴縮及設計較強的執行邊界 | 增加服務身分、請求授權、網路延遲／故障、提交不明及版本相容成本；本輪無此部署需求，故不增設第二 Unit |

安全取捨：共同部署不能取代來源驗證、本人授權、最小存取及資料隔離；未採微服務亦不豁免一致性證據。未來若要獨立部署資料權利或清除 worker，需另行評估並修訂單元拓撲及契約，不能把新增服務藏在本單元名稱下。[requirements NFR2–NFR6][plan]

## Implementation Notes and Constraints

- 完整交付涵蓋全部 SCP-01–SCP-09；LINE 私訊主動位置、一公里含邊界、合格者前三家、已知營業先於未知並按距離／穩定識別排序。候選不足、零結果與來源故障分開，禁止擴圈、捏造或新增個人化。[requirements FR1、FR3、FR4]
- 首次告知／選擇前的位置不等待同意、不外傳，選好後重傳；已知不保存仍可推薦。查詢前完全無法核對資料設定即停止，不外傳、保存或排隊；不把「不知許可」當「不保存即可外傳」。[requirements FR2、NFR4][decisions ADR-005]
- 只有同意後且最終寫入仍獲允許的新有效查詢可保存；保存欄位限白名單，成功／零結果／外部失敗皆如實記錄。每筆期限以驗證過的原始 LINE 事件時間按 UTC 加一曆年，閏日轉次年二月二十八日同時刻，重試／新查詢不延長。[requirements FR5]
- 本人歷史每頁最多五筆；所有查閱、翻頁、設定與刪除都核對本人及當下可見性。刪除確認有效五分鐘，綁定本人、範圍與截止；立即不可見與全部實體清除是不同狀態。撤回停止新及在途保存、重新同意不補存舊查詢。[requirements FR6–FR8]
- 已刪／到期內容立即不可讀，生效後 24 小時內清除全部可控位置／查詢內容；不建立位置歷史持久備份或匯出。可信觸發由 DataPrivacy 接受，具體機制待定，不使用含位置的持久訊息佇列或使用者推播。[requirements FR9][decisions ADR-003]
- 不保存位置限當次記憶體，完成或十秒期限到達即釋放；事件／防重建／清除控制資料最長七天，清除後不得復活舊內容。診斷／安全證據最長 30 天且不含位置、完整訊息、原始使用者 ID 或秘密；同意狀態僅目前有效選擇，服務終止後 30 天內清除。[requirements NFR4]
- 保存結果區分確認已保存、確定未保存、結果不明。提交成功但確認遺失時保留可用推薦並如實說不明、提供本人歷史／刪除入口，不盲目重試、不為核對拖延回覆。此為上游 ADR-004 對 requirements FR4.3 的設計細化，不宣稱上游審查 R-01 已實作修正或關閉。[decisions ADR-004]
- 所有適用保護、負載、延遲、來源時效及故障驗收依 [requirements]，責任映射見 `unit-of-work-story-map.md`；20 個合成身分等測試目標不是實際試用授權。
- test-after：每個可測層實作後立即測試，邊界可串即做整合；至少 80% 應用行覆蓋率含未載入的應用碼，必要案例不能被百分比取代。適用建置、格式／lint、測試及安全 CI 均須有證據；失敗／未做不算通過。[practices][requirements NFR8–NFR9]

## Delivery Boundary

U1 的交付包含可重現本機執行／測試方式、可審查的來源及建置設定、必要自動化／安全檢查證據、完整需求追溯，以及條件具備後授權下的真實 LINE → 餐廳來源 → 回覆與本人歷史管理證據。合成資料薄切片只能證明內部可連接，不能當完整交付；真人保存前必須先完成本人權利及全部必要保護。[practices][requirements]

目前仍為設計文件；沒有應用程式、測試通過、真實整合或部署成果的主張。本輪不正式上線，不授權新增資源、費用、外部掃描、分支或提交。既定 unit-major／serial／checkpoints 與未宣告的 skeleton 開關均不由本文件改動；本階段只定義單元拓撲，不替代經濟排序或自行新增 Delivery Planning。[plan]

## Assumptions & Open Questions

- 下一步 Contract Design 具體化元件內外介面、資料結構、可信受理順序／同意版本／刪除截止、最終保存一致性、取消及提交不明結果；保留已核准行為，不只依客戶端時間判斷新舊。[requirements OQ3、OQ5、OQ7]
- 後續功能／非功能／基礎設施設計在既定要求下選語言、格式、測試工具、安全、timeout／重試、儲存與可信清除觸發；須證明不落盤、分類期限、複本／自動備份與清除上限可同時符合。[requirements OQ2、OQ4、OQ6、OQ10]
- 真實整合前確認帳號、來源條款、顯示／標示、LINE 回覆能力與費用；真人試用前完成地區／政策／資料所在地及全部保護證據。24 小時事件接受窗口不是 LINE 回覆憑證有效期保證。[requirements OQ1、OQ7–OQ9]
- 提出者保留預算、日期、資源及範圍決策；未知事項不默認為已選型或已有外部團隊承擔。無法滿足需求時回報，不靜默縮短一年或減少保護。[requirements]
