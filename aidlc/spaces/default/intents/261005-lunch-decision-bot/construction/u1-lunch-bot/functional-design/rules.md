# 午餐決定器：U1 業務規則

## Sources

- [R] `../../../inception/requirements-analysis/requirements.md`：全部 FR／NFR，穩定識別碼作追溯。
- [D] `../../../inception/domain-design/components.md`、`../../../inception/domain-design/decisions.md`：資料責任及保存不明 ADR-004。
- [C] `../../../inception/contract-design/contract-summary.md`：C01–C07 的既定契約及時序。
- [Q] `functional-design-questions.md`：本輪已確認 Q1 橢球距離、Q2 衝突整組排除；不是新供應方或真人資料授權。

## Business Rules

下方 YAML 是規則唯一來源。BR3.2、BR3.3 由本輪回答細化；其餘把 R、D、C 已確認行為轉成可驗證條件。各 FR 父項的符合性包含其所有子項；NFR 的規則連結不是已通過效能或安全測試。FR4.3 的 unknown 分支承接 ADR-004，不改寫上游 R-01 的狀態。

```yaml
rules:
  - id: BR1.1
    statement: "只有可信私訊才能進入業務"
    category: "authorization"
    applies_to: ["LineEventReceipt"]
    trigger: "收到 LINE webhook"
    logic: "IF 原始 bytes 簽章、destination、事件結構、可靠私訊本人及時效均有效 THEN 才可進入該事件業務；群組與多人對話不推薦或操作歷史。合法空 events 可接收，不代表結果已送出。"
    violation: "來源／私訊失敗零餐廳傳輸、零歷史與權利變更；不向不可信請求回覆私人內容。"
    source: ["FR1","FR1.1","FR1.3","NFR2","NFR3"]
  - id: BR1.2
    statement: "只接受合法 LINE 位置及明列的操作"
    category: "validation"
    applies_to: ["RecommendationQuery"]
    trigger: "解析已驗證事件"
    logic: "IF 搜尋輸入為 LINE location 且經緯度有限、型別正確、在合法範圍 THEN 可交當次許可檢查；文字地址或網址不解析定位，命令及 postback 只依 C 的白名單。"
    violation: "缺欄、未知動作、重複鍵或非法值拒絕，支援情境用繁中引導，不以零或型別轉換補值。"
    source: ["FR1.2","NFR7"]
  - id: BR1.3
    statement: "事件時效與首次處理不可重設"
    category: "constraint"
    applies_to: ["LineEventReceipt","HistoryWriteControl"]
    trigger: "事件 claim 或重送"
    logic: "IF originalEventAt 在 receivedAt 前24小時至後5分鐘含邊界 THEN 以可信事件鍵原子 claim；duplicate 沿用首次 receivedAt、acceptedOrder、deadline，不重做已開始業務或增加歷史。"
    violation: "過時／超前拒絕；claim 不可確認則停止副作用；七天控制過期仍先驗事件時間，不重建舊紀錄。"
    source: ["FR1.3","FR5.1","NFR2","NFR4"]
  - id: BR2.1
    statement: "位置傳輸前先完成實際告知與選擇"
    category: "policy"
    applies_to: ["ConsentState","RecommendationQuery"]
    trigger: "admitQuery"
    logic: "IF 現行告知尚未確認或尚未選擇 THEN 不傳餐廳、不保存等待，釋放位置，提供實際第三方與保存／不保存選擇，要求重傳。IF 設定完全不可讀 THEN 停止搜尋與保存。"
    violation: "未選商或真人前提不全只准合成資料；不能用 no_save 預設掩蓋 settings_unavailable。"
    source: ["FR2","FR2.1","NFR4","NFR6"]
  - id: BR2.2
    statement: "不保存仍可推薦，保存只處理新的查詢"
    category: "authorization"
    applies_to: ["ConsentState","HistoryWriteControl"]
    trigger: "admission 簽發 permit"
    logic: "IF 目前選擇 no_save THEN allowed/disabled 仍推薦但不簽 permit；IF save 且事件可信原始時間與首次 acceptedOrder 都嚴格晚於目前同意 LP、版本及告知有效 THEN allowed/enabled。"
    violation: "無法證明新舊則 disabled/order_unproven；舊事件 superseded_consent，不補存，不把 admission 的 saving 值當作目前選擇已被修改。"
    source: ["FR2.2","FR5.1","FR8","NFR2"]
  - id: BR2.3
    statement: "設定變更綁本人及當前告知版本"
    category: "authorization"
    applies_to: ["ConsentState","HistoryWriteControl"]
    trigger: "getSettings 或 applyChoice"
    logic: "IF 本人、action、未過期 ref、noticeVersion 與預期 consentVersion 全相符 THEN 同一 LP 更新目前選擇、changedAt、新 boundaryOrder/version，消費動作；後續查詢沿用當前選擇。目的／期限變更先重新告知。"
    violation: "過期或舊版本拒絕並引導重開；提交確認遺失 outcome_unknown 後重新讀設定，不假稱變更成功。"
    source: ["FR2.3","FR8","NFR3","NFR4"]
  - id: BR3.1
    statement: "候選資格與來源權利完整才可使用"
    category: "validation"
    applies_to: ["RestaurantCandidate"]
    trigger: "標準化當次來源回應"
    logic: "IF 整份回應可可靠判讀且每候選有穩定店家識別、餐廳分類、有效名稱／WGS84 座標／合法地圖與必要標示 THEN 才進候選集合，保留 open/unknown/closed/permanently_closed。"
    violation: "個別不足剔除；整份不可判讀為 source_failure，不能當空集合。不得將缺營業資料變 open，不能假造地圖或來源標示。"
    source: ["FR3","FR3.1","FR3.3","FR4.2","NFR6"]
  - id: BR3.2
    statement: "固定 WGS84 橢球距離與包含邊界"
    category: "calculation"
    applies_to: ["RecommendationQuery","RestaurantCandidate"]
    trigger: "計算合格候選距離"
    logic: "IF 座標已可靠映射 WGS84 THEN 以 a=6378137m、f=1/298.257223563 的橢球逆測地線最短地表距離計算；以未四捨五入公尺值判斷 distance≤1000 並排序，顯示才四捨五入。"
    violation: "大於1000排除，不加容差擴圈，不用步行或供應方未驗證距離；計算無法可靠完成則明確失敗，不冒充無結果。"
    source: ["FR3.1","FR3.2"]
  - id: BR3.3
    statement: "先解決同店衝突再篩選及去重"
    category: "constraint"
    applies_to: ["RestaurantCandidate"]
    trigger: "彙整一次完整來源查詢的候選"
    logic: "IF 同 restaurantKey 的業務欄位依已證明等價正規化後完全一致 THEN 合併成一店；IF 名稱、座標、地圖、分類、營業或必要標示存在未解衝突 THEN 整組排除；不先刪 closed 再保留同店 open。"
    violation: "不任選第一筆、拼欄位、按未保證的時間戳挑最新，也不以店名猜跨來源別名；來源分頁未完成或不可靠不得用部分集合宣稱完整成功。"
    source: ["FR3.1","FR3.2","FR4.1","FR4.2"]
  - id: BR3.4
    statement: "固定營業狀態、距離與店家鍵排序"
    category: "calculation"
    applies_to: ["RecommendationResult"]
    trigger: "候選一致性完成後"
    logic: "IF 店家非 closed/permanently_closed 且距離合格 THEN 以 open 優於 unknown、未四捨五入距離遞增、restaurantKey Unicode code point 序遞增排序，取至多三家不同店家。"
    violation: "不得隨機、個人化、以 locale 或來源回傳順序改同分結果；相同受控候選集合必須可重現。"
    source: ["FR3.2","FR3.3"]
  - id: BR3.5
    statement: "推薦理由與連結只表達可證實內容"
    category: "constraint"
    applies_to: ["RecommendationResult"]
    trigger: "形成回覆"
    logic: "IF found THEN 各店回名稱、基於計算距離／來源營業狀態的短理由、該店地圖及必要標示；unknown 明說未知，observedAt 不作即時保證。"
    violation: "不虛构評價、好吃、座位或營業保證；不把搜尋點地圖當店家地圖，不截斷必需標示或 URL。"
    source: ["FR3.3","NFR6","NFR7"]
  - id: BR4.1
    statement: "實際候選數與結果類別分開"
    category: "constraint"
    applies_to: ["RecommendationResult"]
    trigger: "推薦完成"
    logic: "IF 可靠來源查詢完成且合格不同店家1至2家 THEN found 並說不足；IF 為0 THEN zero_results；至少3家只回前三家。"
    violation: "不複製或擴圈湊數；來源失敗不得轉 zero_results。"
    source: ["FR4","FR4.1","FR3.3"]
  - id: BR4.2
    statement: "來源故障不重試或偽裝成功"
    category: "policy"
    applies_to: ["RecommendationResult","RestaurantCandidate"]
    trigger: "外部呼叫／分頁失敗或超時"
    logic: "IF 來源故障、逾時、權利未驗證或整份不可解析 THEN source_failure 並保留安全 code；來源失敗重試0次，停用隱含重試；正常受限分頁可進行但共享原 deadline。"
    violation: "取消／期限後丟棄晚到結果，不用未完整候選冒稱成功，不把 C04 Error 轉成虛構歷史狀態。"
    source: ["FR4.2","NFR1","NFR2","NFR5"]
  - id: BR4.3
    statement: "推薦、保存、權利操作與回覆成功各自判定"
    category: "constraint"
    applies_to: ["RecommendationResult","HistoryWriteControl","CleanupJob","LineEventReceipt"]
    trigger: "組合操作結果"
    logic: "IF 取得推薦 THEN 不因保存故障丟棄；saved 需已核實提交，not_saved 需確定無提交，unknown 明說目前無法確認是否保存；讀取故障不當空歷史，刪除未完成不宣稱完成。"
    violation: "ACK 遺失保持 unknown/outcome_unknown；LINE 接受與裝置送達分開；不得以任何部分成功代表全成功。"
    source: ["FR4.3","FR5.1","FR7.3","NFR5"]
  - id: BR5.1
    statement: "最終保存是原子授權、唯一寫入及消費許可"
    category: "authorization"
    applies_to: ["QueryHistory","HistoryWriteControl","ConsentState"]
    trigger: "commitHistory LP"
    logic: "IF 本人/context/permit 相符、save/告知/版本仍有效、屬新事件、未消費、未命中刪除範圍、now早於expiresAt且早於deadline THEN 同一 LP 建唯一歷史、消費permit及記結果；餐廳呼叫在此交易之外。"
    violation: "條件不成立拒存；未知提交先查既有識別，禁止盲目 insert 或攜位置背景重試；平台無提交 fencing 或跨實例順序證據阻擋真人保存。"
    source: ["FR5","FR5.1","FR7.2","FR8","NFR2","NFR3"]
  - id: BR5.2
    statement: "歷史與短期內容按白名單隔離"
    category: "constraint"
    applies_to: ["QueryHistory","RecommendationQuery","HistoryWriteControl"]
    trigger: "保存或診斷投影"
    logic: "IF 建歷史 THEN 僅本人關聯、historyKey、原始queryAt、精確經緯度、expiresAt、真實結果found/zero_results/source_failure；所有技術控制另依短期類別，推薦資料不入歷史。"
    violation: "拒絕額外欄位及原始訊息、位置名稱、餐廳清單；未保存位置不寫磁碟、持久佇列或診斷，所有當次副本完成或十秒即釋放。"
    source: ["FR5.2","NFR4"]
  - id: BR5.3
    statement: "一年期限以原始 UTC 曆年獨立計算"
    category: "calculation"
    applies_to: ["QueryHistory"]
    trigger: "首次形成歷史"
    logic: "IF queryAt有效 THEN expiresAt為UTC加一曆年；2月29日對應次年2月28日同時刻。每筆固定自身期限。"
    violation: "重送、晚寫、重試及新查詢不能延長；不以365天或臺北日期代換UTC算法。"
    source: ["FR5.3","FR9.1"]
  - id: BR6.1
    statement: "每次本人歷史讀取重驗可見性"
    category: "authorization"
    applies_to: ["QueryHistory","HistoryWriteControl"]
    trigger: "listHistory 與回覆前檢查"
    logic: "IF 本人且現在未到期、未被已生效刪除屏障涵蓋 THEN 才輸出；分頁亦然，送出前重核變更版本與期限，必要時重新組頁；撤回保存仍可讀既有合法歷史。"
    violation: "他人、已刪、到期或不存在一律 not_available，不洩漏存在與否；權利狀態不可確認不回任何位置。"
    source: ["FR6","FR8","FR9.1","NFR3"]
  - id: BR6.2
    statement: "以固定鍵往後翻頁而非 offset"
    category: "calculation"
    applies_to: ["QueryHistory","HistoryWriteControl"]
    trigger: "形成頁面或使用 cursor"
    logic: "IF 讀取成功 THEN 依queryAt降序及historyKey升序取至多5筆；下一頁為queryAt較舊或同queryAt且historyKey較大者，cursor本人綁定最後鍵、簽發起15分鐘有效且不滑動延長。"
    violation: "過期／他人cursor拒絕並提示重新輸入歷史；新增查詢不插入已翻頁前方；故障不能回空page。"
    source: ["FR6","NFR3","NFR7"]
  - id: BR6.3
    statement: "歷史呈現與操作在私訊中完成"
    category: "policy"
    applies_to: ["QueryHistory","DeletionConfirmation"]
    trigger: "呈現本人頁面"
    logic: "IF 合法頁面 THEN 每筆有Asia/Taipei時間、搜尋點地圖、真實結果與單筆刪除入口，另有下一頁、全部刪除、設定及清除狀態；按鈕有相同授權的文字備援。"
    violation: "不新增網站或公開後台；不只用顏色／圖示，不將餐廳地圖混入搜尋點歷史。"
    source: ["FR6","NFR7"]
  - id: BR7.1
    statement: "確認建立時固定刪除範圍與五分鐘期限"
    category: "authorization"
    applies_to: ["DeletionConfirmation","HistoryWriteControl"]
    trigger: "issueDeletion"
    logic: "IF 本人及單筆ref/目標有效或要求all THEN 在原子快照固定scope、historyKey或cutoffAt/cutoffOrder、issuedAt及expiresAt=issuedAt+5min，顯示範圍、臺北截止時間、期限與取消方式；此時不刪。"
    violation: "非法／跨人ref不建立確認；now等於expiresAt已失效；confirm 不重算範圍，不把單筆變全部。"
    source: ["FR7","FR7.1","NFR3","NFR7"]
  - id: BR7.2
    statement: "一次確認與取消不誤刪"
    category: "constraint"
    applies_to: ["DeletionConfirmation","CleanupJob"]
    trigger: "decideDeletion LP"
    logic: "IF 本人、ref、scope、action、pending及now<expiresAt均有效 THEN confirm同一LP消費確認、安裝不可見屏障、建清除工作；cancel只消費為cancelled。重複操作讀回既有終態。"
    violation: "跨人、過期、取消後confirm無刪除；確認ACK遺失outcome_unknown，不能假稱未受理或新建範圍；重複不延長dueAt。"
    source: ["FR7.1","FR7.2","NFR2"]
  - id: BR7.3
    statement: "全部範圍含舊在途，不含明確新查詢"
    category: "constraint"
    applies_to: ["HistoryWriteControl","QueryHistory"]
    trigger: "已受理刪除與保存／查閱交錯"
    logic: "IF all屏障生效 THEN 已受理order≤cutoffOrder或原始時間≤cutoffAt的歷史／查詢均屬範圍；明確新查詢須order及可信原始時間同時在界線後。單筆只擋該history/event。"
    violation: "無法證明在界線後拒絕新增，不任意刪明確新歷史；短期關聯到期不可復活；已送至LINE的舊訊息不承諾代刪。"
    source: ["FR7.2","FR9.1","NFR2"]
  - id: BR7.4
    statement: "受理、清除中與完成分別回覆"
    category: "constraint"
    applies_to: ["CleanupJob"]
    trigger: "確認結果或 getCleanupStatus"
    logic: "IF 屏障已提交但非全部可控目標清除 THEN 只回已受理清除中／清除失敗；IF全部完成證據齊全 THEN complete可說已刪除；只列本人短期作業。"
    violation: "無工作或控制已清除只說無可查狀態，不推論完成；截短清單不隱藏失敗／未完成警告，不推播。"
    source: ["FR7.3","FR4.3","NFR5"]
  - id: BR8.1
    statement: "撤回阻止新及未提交的在途寫入"
    category: "authorization"
    applies_to: ["ConsentState","HistoryWriteControl","QueryHistory"]
    trigger: "撤回與 commit 的 LP 排序"
    logic: "IF 撤回LP在commit前 THEN 舊版本permit不再有效；IF commit先 THEN 已是既有歷史依原期限保存。撤回更新目前狀態為no_save，但當次推薦仍可用。"
    violation: "不把撤回當已刪歷史；設定不明如實回報並重新讀取，不能自稱撤回完成。"
    source: ["FR8","FR2.3","FR5.1"]
  - id: BR8.2
    statement: "重新同意不回填舊事件"
    category: "authorization"
    applies_to: ["ConsentState","HistoryWriteControl"]
    trigger: "重新同意後 admission"
    logic: "IF 選save成功 THEN 新版本及新LP界線僅授權之後的新查詢，必須同時驗原始時間、首次順序及非舊事件；同毫秒不能證明則拒存。"
    violation: "舊permit、撤回期間或重送查詢不補存，不能只按伺服器到達時間洗成新查詢。"
    source: ["FR8","FR2.2","NFR2"]
  - id: BR9.1
    statement: "到期即不可讀，與掃描時刻無關"
    category: "constraint"
    applies_to: ["QueryHistory"]
    trigger: "任何讀取或寫入"
    logic: "IF now≥expiresAt或有生效刪除屏障 THEN 不可讀／不可重寫；IF 到期前且未刪並有本人權利 THEN 可讀。"
    violation: "不等待TTL或排程才隱藏，不以後續查詢延命。"
    source: ["FR9","FR9.1","FR5.3"]
  - id: BR9.2
    statement: "清除時限與成功證據不可重算"
    category: "constraint"
    applies_to: ["CleanupJob","QueryHistory"]
    trigger: "到期掃描、刪除受理或清除重試"
    logic: "IF 生效 THEN dueAt=effectiveAt+24h，逐可控目標冪等清除；只有全數成功證據可complete。失敗保留安全分類並告警，重試仍用原範圍與期限。"
    violation: "超時即驗收失敗；告警失敗不抹清除失敗；七天控制消失前未清殘留必須仍fail-closed或隔離，不能延期保留控制來掩蓋。"
    source: ["FR9.2","FR7.3","NFR4","NFR5"]
  - id: BR9.3
    statement: "不得用備份或復原恢復已刪歷史"
    category: "policy"
    applies_to: ["QueryHistory","CleanupJob"]
    trigger: "儲存選型、複本讀取或故障復原"
    logic: "IF 處理位置歷史 THEN 不建立持久備份／匯出；複本同受不可見及24h清除；復原時先證明未刪且未過期，無法證明不恢復讀寫。"
    violation: "平台無法滿足阻擋真人保存，回報而不改期限；不宣稱無備份仍保證歷史可救回。"
    source: ["FR9.3","NFR4","NFR6"]
  - id: BR10.1
    statement: "處理及回覆共享原十秒預算"
    category: "constraint"
    applies_to: ["RecommendationQuery","LineEventReceipt"]
    trigger: "各邊界呼叫與reply"
    logic: "IF 尚有預留回覆預算 THEN 在固定deadline內取得結果並最多一次取得sending發送；200才accepted，明確拒絕rejected，逾時／崩潰／不明unknown；截止停止新提交及釋放位置。"
    violation: "不盲目重送或push，24h事件窗口不是reply token壽命；p95目標、分配預算與真實平台能力留待驗證，不以背景工作延長。"
    source: ["NFR1","NFR2","NFR5"]
  - id: BR10.2
    statement: "所有輸出與技術資料按最小化期限處理"
    category: "policy"
    applies_to: ["LineEventReceipt","ConsentState","HistoryWriteControl","CleanupJob"]
    trigger: "記錄、輸出或控制回收"
    logic: "IF 記診斷 THEN 只用時間、隨機關聯碼、狀態／錯誤類別及必要量測，最多30天；控制最長7天；目前同意狀態服務終止30天內清除。"
    violation: "禁止座標、完整訊息、原始user ID、token或秘密進診斷／控制；不得把未保存位置藏在追蹤或崩潰資料。"
    source: ["NFR3","NFR4","NFR5"]
  - id: BR10.3
    statement: "動作代碼與LINE呈現限制不降低本人驗證"
    category: "validation"
    applies_to: ["HistoryWriteControl","DeletionConfirmation"]
    trigger: "解析／呈現action"
    logic: "IF ref/action/version合法且本人及當下範圍有效 THEN 才執行；設定／單筆入口15min，確認5min。每回覆1至5則文字、各≤5000 UTF-16 units、最後一則≤13 quick replies、label≤20與data≤300字元。"
    violation: "拒絕未知／重複鍵、任意owner或cutoff；必要內容不可硬截；無法合法容納的來源阻擋選型，文字備援同樣授權。"
    source: ["FR2.3","FR6","FR7.1","NFR3","NFR7"]
  - id: BR10.4
    statement: "真人與第三方操作先滿足已定前提"
    category: "policy"
    applies_to: ["RecommendationQuery","RestaurantCandidate","QueryHistory"]
    trigger: "真人整合或保存啟用前"
    logic: "IF 資源、實際來源告知／權利、必要費用、政策、位置隔離及查閱刪除到期完整保護均有證據 THEN 才能在授權目標驗證；之前只用合成資料。"
    violation: "缺項未就緒，不擅自傳真人位置、開資源、縮短一年、移除保護或正式上線；不掃LINE／供應方。"
    source: ["NFR6","NFR3","FR2.1","FR9.3"]
  - id: BR10.5
    statement: "設計可驗證不等於交付已通過"
    category: "policy"
    applies_to: ["RecommendationResult","QueryHistory"]
    trigger: "下游實作及交付檢查"
    logic: "IF 宣稱完成 THEN 需test-after、關鍵流程及交錯測試、≥80%含未載入應用碼行覆蓋率、本機／CI一致命令、適用建置格式lint測試秘密依賴SAST結果與授權下真實完整流程證據。"
    violation: "未執行／失敗不當通過，不為過關縮分母；已確認外洩秘密或Critical/High風險未處理阻擋合併，例外需本人另決。"
    source: ["NFR8","NFR9"]
```

## Rules Summary

| Rule | 規則 | 類別 | 上游 |
| --- | --- | --- | --- |
| BR1.1 | 只有可信私訊才能進入業務 | authorization | FR1、FR1.1、FR1.3、NFR2、NFR3 |
| BR1.2 | 只接受合法 LINE 位置及明列的操作 | validation | FR1.2、NFR7 |
| BR1.3 | 事件時效與首次處理不可重設 | constraint | FR1.3、FR5.1、NFR2、NFR4 |
| BR2.1 | 位置傳輸前先完成實際告知與選擇 | policy | FR2、FR2.1、NFR4、NFR6 |
| BR2.2 | 不保存仍可推薦，保存只處理新的查詢 | authorization | FR2.2、FR5.1、FR8、NFR2 |
| BR2.3 | 設定變更綁本人及當前告知版本 | authorization | FR2.3、FR8、NFR3、NFR4 |
| BR3.1 | 候選資格與來源權利完整才可使用 | validation | FR3、FR3.1、FR3.3、FR4.2、NFR6 |
| BR3.2 | 固定 WGS84 橢球距離與包含邊界 | calculation | FR3.1、FR3.2 |
| BR3.3 | 先解決同店衝突再篩選及去重 | constraint | FR3.1、FR3.2、FR4.1、FR4.2 |
| BR3.4 | 固定營業狀態、距離與店家鍵排序 | calculation | FR3.2、FR3.3 |
| BR3.5 | 推薦理由與連結只表達可證實內容 | constraint | FR3.3、NFR6、NFR7 |
| BR4.1 | 實際候選數與結果類別分開 | constraint | FR4、FR4.1、FR3.3 |
| BR4.2 | 來源故障不重試或偽裝成功 | policy | FR4.2、NFR1、NFR2、NFR5 |
| BR4.3 | 推薦、保存、權利操作與回覆成功各自判定 | constraint | FR4.3、FR5.1、FR7.3、NFR5 |
| BR5.1 | 最終保存是原子授權、唯一寫入及消費許可 | authorization | FR5、FR5.1、FR7.2、FR8、NFR2、NFR3 |
| BR5.2 | 歷史與短期內容按白名單隔離 | constraint | FR5.2、NFR4 |
| BR5.3 | 一年期限以原始 UTC 曆年獨立計算 | calculation | FR5.3、FR9.1 |
| BR6.1 | 每次本人歷史讀取重驗可見性 | authorization | FR6、FR8、FR9.1、NFR3 |
| BR6.2 | 以固定鍵往後翻頁而非 offset | calculation | FR6、NFR3、NFR7 |
| BR6.3 | 歷史呈現與操作在私訊中完成 | policy | FR6、NFR7 |
| BR7.1 | 確認建立時固定刪除範圍與五分鐘期限 | authorization | FR7、FR7.1、NFR3、NFR7 |
| BR7.2 | 一次確認與取消不誤刪 | constraint | FR7.1、FR7.2、NFR2 |
| BR7.3 | 全部範圍含舊在途，不含明確新查詢 | constraint | FR7.2、FR9.1、NFR2 |
| BR7.4 | 受理、清除中與完成分別回覆 | constraint | FR7.3、FR4.3、NFR5 |
| BR8.1 | 撤回阻止新及未提交的在途寫入 | authorization | FR8、FR2.3、FR5.1 |
| BR8.2 | 重新同意不回填舊事件 | authorization | FR8、FR2.2、NFR2 |
| BR9.1 | 到期即不可讀，與掃描時刻無關 | constraint | FR9、FR9.1、FR5.3 |
| BR9.2 | 清除時限與成功證據不可重算 | constraint | FR9.2、FR7.3、NFR4、NFR5 |
| BR9.3 | 不得用備份或復原恢復已刪歷史 | policy | FR9.3、NFR4、NFR6 |
| BR10.1 | 處理及回覆共享原十秒預算 | constraint | NFR1、NFR2、NFR5 |
| BR10.2 | 所有輸出與技術資料按最小化期限處理 | policy | NFR3、NFR4、NFR5 |
| BR10.3 | 動作代碼與LINE呈現限制不降低本人驗證 | validation | FR2.3、FR6、FR7.1、NFR3、NFR7 |
| BR10.4 | 真人與第三方操作先滿足已定前提 | policy | NFR6、NFR3、FR2.1、FR9.3 |
| BR10.5 | 設計可驗證不等於交付已通過 | policy | NFR8、NFR9 |

## Assumptions & Open Questions

所有規則為必須落實的設計，不表示平台已提供跨實例原子順序、時鐘可信度、期限 fencing 或副本清除能力。這些待後續 NFR／Infrastructure Design 證明；來源權利、映射及費用亦維持待確認。測試情境與狀態轉換見 functional-spec.md；本階段不新增 SQL、應用程式或外部操作。
