# 午餐決定器 LINE Bot：硬性規則整合版

狀態：**Step 5 整合完成，待本階段最終核准與記憶推送**。保留 Ideation 已確認的產品限制，新增本階段 Q4／Q7 明確採用的品質與安全約束；七題原文均為「同意」，整份摘要為 `Looks correct`。摘要確認只授權本次整合，不等於階段最終核准。[Q4][Q7][W1]

規則作用域限本次 `line-lunch-decision-bot` 可測試版本。上游原為代擬而經整份摘要確認採用的產品限制仍保留其來源性質；本文件不宣稱實作、測試或合規已完成。[P1][P2][P3]

## Mandated

- ALWAYS 將第一版搜尋、本人歷史查閱與刪除限定在 LINE 一對一對話，以使用者主動傳送的位置訊息為搜尋輸入；可靠辨識本人，不僅相信請求自行宣稱的身分。（依據：P2 SCP-01、Users and Product Boundary；P3 Q1–Q2 的已確認摘要。）
- ALWAYS 以傳送點直線半徑一公里搜尋，候選充足時提供三家不重複餐廳及名稱、基於資料的理由、地圖連結；優先資料顯示營業中、排除明確休息或停業者，標示未知，並如實區分不足候選、無結果與外部故障。（依據：P2 SCP-02–SCP-03；P3 Carried Forward Decisions、Q4 的已確認摘要。）
- ALWAYS 清楚告知當次位置處理、第三方傳輸與長期保存選擇；未同意長期保存者仍可當次推薦，不新增本專案的位置／查詢歷史；撤回後停止新增，並提供清除既有本人歷史的操作。（依據：P2 SCP-04、SCP-06；P3 Q3 的已確認摘要。）
- ALWAYS 僅在同意保存時保留主動查詢的精確位置與查詢歷史供本人查看，至少呈現查詢時間及傳送位置；每筆獨立起算一年、到期清除，後續查詢不延長舊紀錄。（依據：P2 SCP-05、SCP-07；P3 Q2 與已確認摘要；P4 DEC-07–DEC-09。）
- ALWAYS 讓本人在清楚確認刪除範圍後刪除單筆或全部本人歷史，阻止其他使用者查閱或刪除；清除與備份復原不得讓已刪除資料重新可見，撤回同意不冒充已完成刪除。（依據：P2 SCP-06–SCP-07、Minimum Complete Release；P3 Q2–Q3 的已確認摘要。）
- ALWAYS 驗證事件來源並避免重複事件重複建立歷史，採取必要資料隔離與存取保護；一般診斷不複製完整位置、訊息或憑證，供應方內容與來源標示僅依授權範圍處理。（依據：P2 SCP-08；P3 Q2–Q3、Q5 的已確認摘要。）
- ALWAYS 在真實整合前確認合法可用的資源與必要費用授權；在真人試用前滿足告知／同意、本人隔離、查閱、提前刪除、到期清除、安全及適用政策查核條件，並提供可重現的必要自動化測試與授權下真實完整流程證據。（依據：P1 Feasibility and Risk Highlights、Team and Delivery Direction；P2 SCP-09、Minimum Complete Release；P3 Q5 的已確認摘要。）

- ALWAYS 在合併前達到至少 80% 應用可測原始碼行覆蓋率，納入未被測試載入的應用原始碼；依賴、產生碼、AI-DLC 框架及測試本身列於可審查的排除清單，關鍵行為案例不以整體覆蓋率取代。（依據：本階段 Q4，使用者原文「同意」及已確認摘要。）
- ALWAYS 在合併前 CI 執行適用建置、格式／lint、單元及關鍵整合測試；驗證拒絕／撤回保存、跨人讀取與刪除拒絕、單筆／全部刪除確認、重送／併發、到期及必要復原情境。（依據：本階段 Q4；lint 阻擋亦有既有 org 規則，格式門檻為本階段新增。）
- ALWAYS 納入秘密、依賴與適用的 SAST 檢查；確認有效的外洩憑證及已確認 Critical／High 風險在處置前阻擋合併，誤報或限期例外由提出者檢視依據另行決定且不得取消既有隱私保護。（依據：本階段 Q7，使用者原文「同意」及已確認摘要。）

## Forbidden

- NEVER 把未同意保存者的資料轉存至診斷紀錄以建立替代歷史，或將位置歷史用於背景追蹤、員工監控、個人化、行為分析或他人歷史分享。（依據：P2 SCP-04、SCP-08、OUT-03；P3 Q3–Q4 的已確認摘要；P4 DEC-08、DEC-12。）
- NEVER 先向真人開放位置保存，之後才補本人權限、同意、提前刪除或到期清除；只完成推薦、只保存卻無法管理歷史、或只有模擬成功都不能宣稱本輪完整交付。（依據：P1 Team and Delivery Direction；P2 Minimum Complete Release、Sequencing and Dependencies；P3 Q5 的已確認摘要。）
- NEVER 以一年使用者歷史保存需求推論可以封存供應方完整餐廳回應，或擅自延長保存、縮短一年承諾、移除歷史保護、降低既定測試要求；權利、資源或費用衝突交由提出者決定。（依據：P2 Scope Summary、Change and Decision Boundaries；P3 Q2、Q5 的已確認摘要；P4 DEC-16、DEC-18。）
- NEVER 將本輪可測試版本當成正式上線或付費啟用授權，亦不自行加入 OUT-01–OUT-04 已排除的群組、進階輸入、收藏／篩選／重抽、餐飲交易、推播、分析、獨立網站／公開後台或公司系統整合。（依據：P2 Out of Scope、Change and Decision Boundaries；P3 Q1、Q4–Q5 的已確認摘要。）

- NEVER 將必要建置、格式／lint、測試、覆蓋率或掃描檢查失敗、未執行或未達門檻記作通過，亦不得為通過而降低已採用品質要求。（依據：本階段 Q4、Q7；P2 既定品質要求。）
- NEVER 未取得受控環境及目標授權即執行動態安全測試，或自行掃描 LINE／餐廳供應方、擅自將程式或資料傳至新外部服務。（依據：本階段 Q7 的回答與已確認摘要。）

## 規則作用域與保留未知

主幹／squash、最小內部切片、test-after、協作及設定優先等已採用實務記於 `team-practices.md`；不把描述性做法擴張成任意架構、固定日期、工具品牌或改動 guard 的硬規則。語言、CI／掃描服務、資料來源、環境與具體命令仍未選定；角色知識的工具與供應鏈模式不自動成為人類硬限制。既有框架規則按原作用域保留。[memory:M1]

## Sources

- [Q4] `practices-discovery-questions.md` Q4 及 Consolidated Summary Confirmation：80% 分母與排除項、合併前 CI、關鍵案例及不得誤報通過；使用者原文「同意」。
- [Q7] `practices-discovery-questions.md` Q7 及 Consolidated Summary Confirmation：安全檢查、阻擋條件、例外責任、受控動態測試與外傳授權界線；使用者原文「同意」。

- [P1] `aidlc/spaces/default/intents/261005-lunch-decision-bot/ideation/approval-handoff/initiative-brief.md`：核准的 Ideation 交接內容；最終核准現況依本次派工及 W1。
- [P2] `aidlc/spaces/default/intents/261005-lunch-decision-bot/ideation/scope-definition/scope-document.md`：已核准產品範圍與前置條件。
- [P3] `aidlc/spaces/default/intents/261005-lunch-decision-bot/ideation/scope-definition/scope-definition-questions.md`：Q1–Q5 的代擬來源及最後 `Looks correct` 摘要確認。
- [P4] `aidlc/spaces/default/intents/261005-lunch-decision-bot/ideation/approval-handoff/decision-log.md`：DEC-01–DEC-19、Direct User Corrections；直接修正原文包含「我要長期保存精確位置與查詢歷」及「好啊 那就先一年」。
- [W1] `aidlc/spaces/default/intents/261005-lunch-decision-bot/aidlc-state.md`：Ideation `Verified`，Practices Discovery 進行中，實務確認時間空白。
- [memory:M1] `aidlc/spaces/default/memory/org.md`：框架預設與既有規則，非新增產品硬限制來源。
- [F1] `.codex/aidlc-common/stages/inception/practices-discovery.md`：`ALWAYS`／`NEVER` 僅承載有使用者依據的硬性限制。

## Assumptions & Open Questions

- Q4／Q7 的品質與安全要求已有本階段人類回答及摘要確認；階段最終核准、記憶推送仍未完成。
- 一年曆年邊界、撤回後既有資料清除義務、清除完成時限、必要副本處置、失敗查詢與歷史詳細欄位仍待需求化；此處不虛構期限、數字或已通過的驗證。
- 掃描工具、完整涵蓋範圍、修補與限期例外期限、供應鏈實作及 DAST 目標細節仍待設計，未填入任意數字或額外架構。
- 上述規則整理已確認產品限制及本階段明確採用的品質／安全約束，並不證明實作、權限設定、合規或真實串接已完成。
