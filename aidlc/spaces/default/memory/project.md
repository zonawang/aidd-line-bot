# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance; contradictions with broader policy
> are rejected. Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).

## Way of Working

<!-- Project-specific specialisation. Example: -->
<!-- This monorepo requires package-scoped branch names and a package owner -->
<!-- review in addition to the team's normal merge policy. -->

## Walking Skeleton

<!-- Project-specific specialisation. Example: -->
<!-- The walking skeleton must exercise the legacy service adapter as well -->
<!-- as the new service boundary. -->

## Testing Posture

<!-- Project-specific specialisation. -->

## Guard Policy

<!-- Project-specific. Mode: strict, relaxed, or off. Strict here holds for every intent and cannot be changed from chat. A section under the retired Change Control heading, written by an earlier release, is still read. -->

## Deployment

<!-- Project-specific specialisation. -->

## Code Style

<!-- Project-specific specialisation. -->

## Tech Stack

<!-- Technology choices locked for this project. -->

## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->

## Scope Overrides

<!-- Custom scope rules for this project. -->

## Forbidden

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: NEVER [behavior] (affirmed [date]) -->
<!-- Example: NEVER throw exceptions across service layer boundaries (affirmed 2026-05-17) -->

- NEVER 把未同意保存者的資料轉存至診斷紀錄以建立替代歷史，或將位置歷史用於背景追蹤、員工監控、個人化、行為分析或他人歷史分享。（依據：P2 SCP-04、SCP-08、OUT-03；P3 Q3–Q4 的已確認摘要；P4 DEC-08、DEC-12。） (affirmed 2026-10-05)

- NEVER 先向真人開放位置保存，之後才補本人權限、同意、提前刪除或到期清除；只完成推薦、只保存卻無法管理歷史、或只有模擬成功都不能宣稱本輪完整交付。（依據：P1 Team and Delivery Direction；P2 Minimum Complete Release、Sequencing and Dependencies；P3 Q5 的已確認摘要。） (affirmed 2026-10-05)

- NEVER 以一年使用者歷史保存需求推論可以封存供應方完整餐廳回應，或擅自延長保存、縮短一年承諾、移除歷史保護、降低既定測試要求；權利、資源或費用衝突交由提出者決定。（依據：P2 Scope Summary、Change and Decision Boundaries；P3 Q2、Q5 的已確認摘要；P4 DEC-16、DEC-18。） (affirmed 2026-10-05)

- NEVER 將本輪可測試版本當成正式上線或付費啟用授權，亦不自行加入 OUT-01–OUT-04 已排除的群組、進階輸入、收藏／篩選／重抽、餐飲交易、推播、分析、獨立網站／公開後台或公司系統整合。（依據：P2 Out of Scope、Change and Decision Boundaries；P3 Q1、Q4–Q5 的已確認摘要。） (affirmed 2026-10-05)

- NEVER 將必要建置、格式／lint、測試、覆蓋率或掃描檢查失敗、未執行或未達門檻記作通過，亦不得為通過而降低已採用品質要求。（依據：本階段 Q4、Q7；P2 既定品質要求。） (affirmed 2026-10-05)

- NEVER 未取得受控環境及目標授權即執行動態安全測試，或自行掃描 LINE／餐廳供應方、擅自將程式或資料傳至新外部服務。（依據：本階段 Q7 的回答與已確認摘要。） (affirmed 2026-10-05)

## Mandated

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->

- ALWAYS 將第一版搜尋、本人歷史查閱與刪除限定在 LINE 一對一對話，以使用者主動傳送的位置訊息為搜尋輸入；可靠辨識本人，不僅相信請求自行宣稱的身分。（依據：P2 SCP-01、Users and Product Boundary；P3 Q1–Q2 的已確認摘要。） (affirmed 2026-10-05)

- ALWAYS 以傳送點直線半徑一公里搜尋，候選充足時提供三家不重複餐廳及名稱、基於資料的理由、地圖連結；優先資料顯示營業中、排除明確休息或停業者，標示未知，並如實區分不足候選、無結果與外部故障。（依據：P2 SCP-02–SCP-03；P3 Carried Forward Decisions、Q4 的已確認摘要。） (affirmed 2026-10-05)

- ALWAYS 清楚告知當次位置處理、第三方傳輸與長期保存選擇；未同意長期保存者仍可當次推薦，不新增本專案的位置／查詢歷史；撤回後停止新增，並提供清除既有本人歷史的操作。（依據：P2 SCP-04、SCP-06；P3 Q3 的已確認摘要。） (affirmed 2026-10-05)

- ALWAYS 僅在同意保存時保留主動查詢的精確位置與查詢歷史供本人查看，至少呈現查詢時間及傳送位置；每筆獨立起算一年、到期清除，後續查詢不延長舊紀錄。（依據：P2 SCP-05、SCP-07；P3 Q2 與已確認摘要；P4 DEC-07–DEC-09。） (affirmed 2026-10-05)

- ALWAYS 讓本人在清楚確認刪除範圍後刪除單筆或全部本人歷史，阻止其他使用者查閱或刪除；清除與備份復原不得讓已刪除資料重新可見，撤回同意不冒充已完成刪除。（依據：P2 SCP-06–SCP-07、Minimum Complete Release；P3 Q2–Q3 的已確認摘要。） (affirmed 2026-10-05)

- ALWAYS 驗證事件來源並避免重複事件重複建立歷史，採取必要資料隔離與存取保護；一般診斷不複製完整位置、訊息或憑證，供應方內容與來源標示僅依授權範圍處理。（依據：P2 SCP-08；P3 Q2–Q3、Q5 的已確認摘要。） (affirmed 2026-10-05)

- ALWAYS 在真實整合前確認合法可用的資源與必要費用授權；在真人試用前滿足告知／同意、本人隔離、查閱、提前刪除、到期清除、安全及適用政策查核條件，並提供可重現的必要自動化測試與授權下真實完整流程證據。（依據：P1 Feasibility and Risk Highlights、Team and Delivery Direction；P2 SCP-09、Minimum Complete Release；P3 Q5 的已確認摘要。） (affirmed 2026-10-05)

- ALWAYS 在合併前達到至少 80% 應用可測原始碼行覆蓋率，納入未被測試載入的應用原始碼；依賴、產生碼、AI-DLC 框架及測試本身列於可審查的排除清單，關鍵行為案例不以整體覆蓋率取代。（依據：本階段 Q4，使用者原文「同意」及已確認摘要。） (affirmed 2026-10-05)

- ALWAYS 在合併前 CI 執行適用建置、格式／lint、單元及關鍵整合測試；驗證拒絕／撤回保存、跨人讀取與刪除拒絕、單筆／全部刪除確認、重送／併發、到期及必要復原情境。（依據：本階段 Q4；lint 阻擋亦有既有 org 規則，格式門檻為本階段新增。） (affirmed 2026-10-05)

- ALWAYS 納入秘密、依賴與適用的 SAST 檢查；確認有效的外洩憑證及已確認 Critical／High 風險在處置前阻擋合併，誤報或限期例外由提出者檢視依據另行決定且不得取消既有隱私保護。（依據：本階段 Q7，使用者原文「同意」及已確認摘要。） (affirmed 2026-10-05)

## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
