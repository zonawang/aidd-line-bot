# 午餐決定器 LINE Bot：需求與單元對照

## Sources and Mapping Convention

- [requirements] `../requirements-analysis/requirements.md`：功能需求與子需求的永久識別碼、九項 NFR、驗收及 OQ1–OQ10。
- [components] `../domain-design/components.md`：元件／實體擁有者。
- [decisions] `../domain-design/decisions.md`：ADR-001–ADR-006。
- `unit-of-work.md`、`unit-of-work-dependency.md`：唯一單元 U1／u1-lunch-bot，kind service，零跨 Unit 邊。
- `units-generation-questions.md`、`decomposition-plan.md`：統一問答中的已確認回答、既有計畫核准及保留的計畫附錄。
- 整理後的完整摘要以「Looks correct」確認，紀錄 `4c7e04f0919e74ca90ea0f0dc58216ee60cd2a25e96eba5b30c042d72cdd706f`；依同一份統一摘要及不變的計畫重新保存本文件。
- `../practices-discovery/team-practices.md`：單元內開發慣例、test-after 及必要交付證據。

User Stories 階段未執行，故本文件保留所有 FR，不創造 USx.y 或用故事摘要取代需求。下表共 30 個識別碼：九個主項與 21 個子項，每個都指向 U1／u1-lunch-bot；主項是完整需求群的責任，不重複宣稱多份實作。追溯檔的 OK 只表示已分配有效單元，不表示驗收通過。

## Functional Requirement Mapping

| FR ID | 需求 | Unit ID | Directory | 責任元件 | 驗證範圍（尚未執行） |
| --- | --- | --- | --- | --- | --- |
| FR1 | 私訊入口與位置輸入 | U1 | u1-lunch-bot | LineInteraction | 通過全部 FR1.1–FR1.3 |
| FR1.1 | 合法私訊位置及群組隔離 | U1 | u1-lunch-bot | LineInteraction、DataPrivacy | 群組不推薦／操作私人歷史；合法位置在完成選擇後才搜尋 |
| FR1.2 | 不支援與無效輸入 | U1 | u1-lunch-bot | LineInteraction | 地址／網址不解析；無效座標拒絕、不建歷史 |
| FR1.3 | 來源及時效拒絕 | U1 | u1-lunch-bot | LineInteraction | 來源不符／事件失效不查來源、不建歷史、不執行權利操作 |
| FR2 | 告知、選擇與同意管理 | U1 | u1-lunch-bot | LineInteraction、DataPrivacy | 通過全部 FR2.1–FR2.3 |
| FR2.1 | 首次告知、第三方傳輸與重傳位置 | U1 | u1-lunch-bot | LineInteraction、DataPrivacy、RestaurantSourceAdapter | 未選擇位置不保存／暫存或傳來源；選好後重傳，實際來源未定只能受控模擬 |
| FR2.2 | 不保存仍推薦、同意後才保存 | U1 | u1-lunch-bot | LineInteraction、DataPrivacy | 只允許選擇後的新查詢；拒絕保存不妨礙基本推薦 |
| FR2.3 | 選擇沿用與變更 | U1 | u1-lunch-bot | DataPrivacy、LineInteraction | 可變更且不每次重問；用途／條件改變須先重新告知確認 |
| FR3 | 候選資格、距離與排序 | U1 | u1-lunch-bot | LunchRecommendation、RestaurantSourceAdapter | 通過全部 FR3.1–FR3.3 |
| FR3.1 | 餐廳資格及一公里含邊界 | U1 | u1-lunch-bot | LunchRecommendation、RestaurantSourceAdapter | 未四捨五入距離 ≤1,000 公尺，排除明確休息／停業及必要欄位不足；不擴圈 |
| FR3.2 | 營業優先、距離及穩定去重排序 | U1 | u1-lunch-bot | LunchRecommendation | 已知營業先於未知、組內由近到遠、同距以穩定識別排序；同店不重複 |
| FR3.3 | 三家、有依據理由與地圖 | U1 | u1-lunch-bot | LunchRecommendation、RestaurantSourceAdapter、LineInteraction | 足量取前三家；名稱、理由、地圖及必要來源標示正確且不捏造 |
| FR4 | 推薦例外與部分成功 | U1 | u1-lunch-bot | LineInteraction、LunchRecommendation、DataPrivacy、RestaurantSourceAdapter | 通過 FR4.1–FR4.3；保存狀態依 ADR-004 細化 |
| FR4.1 | 不足與零結果 | U1 | u1-lunch-bot | LunchRecommendation、LineInteraction | 只有一／兩家就如實回覆；零家不複製／捏造或擴圈 |
| FR4.2 | 來源故障、逾時與不可判讀 | U1 | u1-lunch-bot | RestaurantSourceAdapter、LunchRecommendation、LineInteraction | 整份不可判讀是來源失敗，不偽裝成空結果；期限與 LINE 故障依 NFR1／NFR2 |
| FR4.3 | 推薦與歷史操作的部分成功 | U1 | u1-lunch-bot | DataPrivacy、LineInteraction | 保留可用推薦；確認已存／確定未存／不明分開，查閱或刪除失敗不假稱空白／完成；承接 ADR-004 及上游 R-01 |
| FR5 | 可選一年查詢歷史 | U1 | u1-lunch-bot | DataPrivacy、LineInteraction | 通過全部 FR5.1–FR5.3 |
| FR5.1 | 被允許的新查詢與真實結果保存 | U1 | u1-lunch-bot | DataPrivacy、LineInteraction | 成功／零結果／外部失敗如實保存；原先及寫入時均有許可，不重複或越過撤回／刪除界線 |
| FR5.2 | 歷史欄位白名單 | U1 | u1-lunch-bot | DataPrivacy | 不含原始訊息、自由文字位置名、餐廳清單／完整來源回應；技術資料另按期限分類 |
| FR5.3 | 原始事件時間起算 UTC 一曆年 | U1 | u1-lunch-bot | DataPrivacy、LineInteraction | 閏日轉次年二月二十八日同時刻；重送／延遲／新查詢不延長舊期限 |
| FR6 | 本人歷史查閱 | U1 | u1-lunch-bot | DataPrivacy、LineInteraction | 新到舊每頁最多五筆，臺北時間、搜尋點地圖及真實狀態；分頁仍驗本人／可見性，空白與故障分開 |
| FR7 | 本人確認後刪除 | U1 | u1-lunch-bot | DataPrivacy、LineInteraction | 通過全部 FR7.1–FR7.3 |
| FR7.1 | 刪除範圍、五分鐘確認與取消 | U1 | u1-lunch-bot | DataPrivacy、LineInteraction | 本人、單筆或全部截止範圍綁定；過期／取消／跨人不刪，重複確認不新增刪除 |
| FR7.2 | 立即不可見與防止在途重建 | U1 | u1-lunch-bot | DataPrivacy | 受理即不可見；全部範圍含截止前在途舊查詢但不含畫面後新查詢；失敗不假稱受理 |
| FR7.3 | 清除中、完成及失敗的真實狀態 | U1 | u1-lunch-bot | DataPrivacy、LineInteraction | 只有全部可控內容清除後說已刪；安全重試與無位置告警，不使用者推播 |
| FR8 | 撤回與重新同意 | U1 | u1-lunch-bot | DataPrivacy、LineInteraction | 撤回停止新／在途／延遲保存，既有歷史按原期限保留；重新同意不補存舊事件，設定失敗如實回覆 |
| FR9 | 到期、清除與復原 | U1 | u1-lunch-bot | DataPrivacy | 通過全部 FR9.1–FR9.3 |
| FR9.1 | 到期立即不可見 | U1 | u1-lunch-bot | DataPrivacy | 達期限即不可讀／重建，不等待排程；期限前合法本人仍可讀 |
| FR9.2 | 24 小時清除全部可控內容 | U1 | u1-lunch-bot | DataPrivacy | 生效後主要儲存／快取／可控複本依限清除；殘留僅供清除，失敗／逾期可辨識且不算通過 |
| FR9.3 | 無持久歷史備份與不復活 | U1 | u1-lunch-bot | DataPrivacy | 不建位置歷史備份／匯出；平台複本及自動備份需符合限制，復原不令已刪／到期可見 |

所有細節仍以 [requirements] 原文及已確認的 [decisions] 細化為準，表格不是縮減驗收。FR4.3 的保存不明由 ADR-004 承接：提交可能已成功但確認遺失時不能斷言未保存；上游 R-01 仍需後續契約及失敗測試證據，不在此宣稱關閉。

## Cross-cutting Concerns

沒有跨 Unit 需求；下列跨元件情境全部仍由 U1 交付，不能因 Unit 只有一個就跳過整合測試：

- 可信來源／事件 → 告知與許可 → 來源查詢 → 推薦 → 最後許可與保存 → 真實回覆：涵蓋 FR1–FR5、NFR1–NFR6，避免「入口已驗證」替代歷史本人授權。
- 本人查閱／翻頁與單筆／全部刪除、撤回／重新同意及在途提交交錯：涵蓋 FR5–FR9、NFR2–NFR5，所有引用、確認及分頁都不得成為授權旁路。
- 位置／候選短暫生命週期、短期控制資料及清除／診斷：涵蓋 FR9、NFR4–NFR5；不以日誌、持久佇列、備份或故障資料另建位置歷史。
- 繁中呈現、臺北時間、文字與按鈕一致、真實部分成功：涵蓋 FR4、FR6–FR8、NFR7；按鈕可操作不代表授權有效。
- 測試、CI、來源權利及授權下真實完整流程：涵蓋 NFR6、NFR8、NFR9；合成成功、行覆蓋率或掃描數字不能替代必要情境與真實證據。

## Non-functional Responsibility Mapping

| NFR ID | Unit ID | Directory | 責任與後續驗證 |
| --- | --- | --- | --- |
| NFR1 | U1 | u1-lunch-bot | LineInteraction 協調期限，其餘元件提供受控延遲／故障介面；20 合成身分、每秒一筆持續五分鐘及同時五筆分別驗證，接收 p95 ≤1 秒、LINE 接受回覆 p95 ≤5 秒、處理十秒。樣本及失敗完整記錄，LINE 不可用不假稱送達或達標 |
| NFR2 | U1 | u1-lunch-bot | LineInteraction 驗來源、原始事件在接收前 24 小時至後五分鐘（含邊界）及回覆安全；DataPrivacy 防重複／重建。測重送、併發、取消／重試、撤回／刪除與技術資料清除後舊事件；最多一筆歷史 |
| NFR3 | U1 | u1-lunch-bot | LineInteraction 提供可靠本人來源，DataPrivacy 每次核對歸屬及可見性；至少兩個合成使用者互換紀錄／分頁／確認識別作拒絕測試，另驗傳輸／儲存最小權限與秘密管理 |
| NFR4 | U1 | u1-lunch-bot | 各元件按所擁有資料分類處理；未選擇位置不暫存，不保存位置完成或十秒即釋放；歷史 UTC 一年且不可見後 24 小時清除；控制資料最多七天、診斷／安全證據最多 30 天、同意狀態終止後 30 天內清除；來源內容限授權，不建立替代歷史 |
| NFR5 | U1 | u1-lunch-bot | LineInteraction 呈現真實接收／推薦／歷史結果；DataPrivacy 區分受理、清除中、完成、失敗並以無位置告警追蹤。注入保存確認遺失、查閱／刪除／清除／告警故障，不能把未確認當成功 |
| NFR6 | U1 | u1-lunch-bot | 提出者決定資源／費用／範圍，設計及開發提供 LINE、來源、平台日誌／複本、權利／政策證據；真實整合及真人保存前置條件逐項查核，缺項標未就緒，不宣稱合規或正式上線 |
| NFR7 | U1 | u1-lunch-bot | LineInteraction 負責繁中、Asia/Taipei、文字入口及按鈕；以 DataPrivacy 與推薦實際狀態呈現未知／不足／失敗／保存／清除。驗證首次引導、五筆分頁、刪除範圍／有效期／取消及地圖目標，不新增網站 |
| NFR8 | U1 | u1-lunch-bot | 各可測層 test-after，能連接即邊界整合；≥80% 應用行覆蓋率含未載入原始碼及可審查排除清單；受控時鐘、跨人、生命週期、故障、併發與完整流程均驗。授權下真實證據另列，不用模擬替代 |
| NFR9 | U1 | u1-lunch-bot | U1 交付本機／CI 一致版本與命令，適用建置、格式／lint、單元／關鍵整合／覆蓋率、秘密／依賴／SAST 證據；必要檢查失敗或未做不能合併，確認有效洩漏秘密及 Critical／High 阻擋，誤報／限期例外交提出者判定，不取消隱私保護；DAST 需另授權 |

此表分配的是交付責任，不選工具、平台或具體安全／一致性實作；適用機制由後續設計選定並提供正反例證據。

## Implementation Order Within U1

以下只描述同一單元內的增量安排，不是額外 Unit、Bolt、故事 ID 或跨單元經濟排序。每個可測層都遵守「實作後立即測試」，邊界可接即驗，不等到最後一項才補測試：

- 先用合成身分／位置及受控 LINE／來源，串通可信私訊、首次告知／選擇、位置推薦及回覆的薄切片（FR1–FR4）。未完成的真實依賴明確以替身隔離，不送真人位置或開放真實保存；這只證明內部可連接。
- 在同一 U1 補齊可選保存、本人分頁、刪除確認／取消、撤回／重新同意、到期及實體清除（FR2、FR5–FR9）；同步驗權限、時間及資料最小化，必要保護整組完成前不能開放真人保存。
- 隨各邊界完成即注入失敗並驗跨元件交錯：提交成功但確認遺失、許可不可讀、來源／LINE 故障、去重／併發、刪除截止／撤回與在途寫入、技術代碼到期及必要復原（FR1.3、FR4、FR5–FR9、NFR1–NFR5）。
- 匯整全版本覆蓋率、負載、可重現 CI 與安全證據；資源及授權條件具備後另驗真實 LINE、來源、回覆及完整本人歷史管理（NFR1、NFR6、NFR8、NFR9）。缺真實證據就保留未完成，不以受控結果替代。

此安排沿用既定薄切片慣例，不宣告 skeleton 開關，也不授權資源／費用／正式部署；具體檔案、方法及測試命令留待適用設計與程式階段。

## Coverage Verification

- 所有九個 FR 主項及 21 個子項都在功能表逐列分配，沒有遺漏、重複、Deferred、N/A 或新造需求 ID。
- 唯一 U1 有全部 30 個 FR 及九項 NFR 的責任，四個元件都有承接需求；九個實體歸屬見 `unit-of-work.md`，沒有孤立的額外 Unit。
- `traceability.json` 的 upstream_ids 等於功能表 FR ID 集合；每個 coverage.target 為該列實際出現的 U1。Directory 與依賴 YAML 的 name 均為 u1-lunch-bot。
- 追溯覆蓋只驗證設計責任可追蹤，不證明功能、安全、性能、資料權利或 CI 已驗收；所有應用測試仍待執行。

## Assumptions & Open Questions

詳細契約、選型及外部查核依需求 OQ1–OQ10 保留；無法證明保存一致性、清除時限、來源權利或回覆條件時必須回報，不把分配到 U1 當作問題已解決。未新增產品假設或改變上游已確認行為。
