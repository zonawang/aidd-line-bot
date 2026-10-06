# U1 可靠性與復原需求

## Sources

- [R] `../../../inception/requirements-analysis/requirements.md`：NFR1–NFR9 與功能驗收界線。
- [F] `../functional-design/functional-spec.md`：WF01–WF09 與已確認的狀態／競爭規則。
- [B] `../functional-design/rules.md`：規則的權威 YAML。
- [C] `../../../inception/contract-design/contract-summary.md`：C01–C07 介面與最小資料投影。
- [Q] `nfr-requirements-questions.md`：本輪三題已答、整份摘要 Looks correct；授權紀錄 `9e6e63e53393656f3cc31b97135000d3251f63866204932c7ec3810d96db3898`。
- [P] `../../../inception/practices-discovery/team-practices.md`：test-after、品質及交付限制。

## Service Objectives

本輪有受控負載的ACK／reply p95目標及10秒期限，沒有正式營運月可用率、RTO或歷史RPO承諾。不以通用99.9%範本新增SLA。使用者已接受不備份歷史而災損可能無法救回的取捨；不宣稱零資料遺失。刪除／到期24h清除仍是必須滿足的資料義務，不因沒有SLA或程序離線而暫停。

## Requirements

| ID | 要求 | 必要故障／交錯測試 |
| --- | --- | --- |
| NFR2.4 | 最終保存授權、目前notice／consentVersion、可信原始事件與受理順序、刪除界線、到期、去重及寫入在同一不可分割LP；不持交易等餐廳 | 保存前／後撤回、重同意、刪除、同時刻、原始時間超前、兩連線並行；無法證明順序拒絕保存而非猜測 |
| NFR2.5 | 保存 saved／not_saved／unknown 僅依可靠證據；已提交但ACK遺失為unknown，不能盲目重寫或假報未存 | commit前中止、commit後斷線、回覆丟失、控制遺失；核對只用既有識別且不復活已刪內容 |
| NFR2.6 | LINE reply單次原子not_started→sending→accepted／rejected／unknown；sending崩潰歸unknown，禁止盲重送／push | 呼叫前後崩潰、200後狀態寫失敗、token失效／重用；業務／保存成功與訊息接受分別呈現 |
| NFR2.7 | 餐廳失敗重試0且關閉client隱含retry；正常分頁共享原deadline，任何必需頁失敗不得把部分當完整成功 | 網路錯、授權錯、限流、malformed、部分頁與慢回應；取消不造零結果，C04 Error不捏造resultSummary |
| NFR2.8 | deadline／撤回／刪除先成立時，晚到結果不能開始新提交或復活歷史；提交fencing必須有資料庫側及程序協調證據 | 查核與寫入間交錯、鎖等待、逾時後commit、時鐘漂移、runtime停止；AbortSignal不是已撤銷交易的證明 |
| NFR4.8 | 刪除LP或原expiresAt起立即不可讀、effectiveAt+24h前清所有可控位置殘留；晚掃描與重試不改dueAt；不建持久歷史備份／匯出 | 成功、部分目標失敗、重複job、到期前當下後、24h前當下後；完成要有全目標證據，超時即驗收失敗 |
| NFR4.9 | 控制資料7天回收前必須證明已清除或仍不可能重現；無法證明則停用受影響歷史儲存的讀寫及隔離存取，控制仍依期回收 | 跨重啟維持非個人儲存安全狀態；不得延長控制TTL、建永久個人索引或誤刪不屬範圍的新歷史；恢復前證明不復活 |
| NFR5.1 | 來源零結果／來源故障、推薦結果／保存結果、歷史空頁／讀取失敗、刪除受理／清除中／完成／失敗明確分開 | 每類注入故障，使用者與內部狀態一致；清除ACK不明保留unknown，不把沒有紀錄當成功 |
| NFR7.1 | 所有狀態使用繁體中文、Asia/Taipei顯示，unknown／不足／故障／未存／不明／清除中均以文字區別 | 視覺標記移除後仍可理解；「目前無法確認是否已保存，可稍後查看歷史」不改成未保存 |
| NFR7.2 | 本人查閱、分頁、設定、刪除／取消及清除狀態留在LINE私訊，有文字操作備援；地圖連結指向正確搜尋點／店家 | 1–5則文字、每則≤5000 UTF-16 units；quick reply僅最後一則且≤13項，依C02完整驗證。不得截掉告知、地圖、權利狀態或必要來源標示 |

來源：R NFR2／NFR4／NFR5／NFR7；F WF04–WF09；C02／C03／C05／C07。上游requirements R-01的unknown設計已有對應，不等於已測通或關閉風險。

## Fault Containment and Cleanup

- 設定未知：不向餐廳傳送位置、不保存、不排隊；已知no_save的查詢不以歷史寫入故障為理由阻擋推薦。歷史被隔離時仍需能可靠知道目前處理選擇，否則同樣停止查詢。
- 程序在ACK後停止可能遺失在途查詢；C01已明訂不能從持久位置queue補做。只報實際結果；不以重新推播或二次保存修補。
- 清除安全重試不屬餐廳重試政策。NFR Design須定受控排程、互斥／冪等、退避與上限、失敗告警及重啟掃描；無論實作節奏如何，24h固定截止不變。
- 清除觸發只走C07受信任環境；不從任意payload接受本人或截止範圍。未知觸發拒絕，重疊job不擴大原範圍。
- 無備份災損時不重建位置；重新運行前以現存狀態／設定安全檢查。必要控制損毀就隔離歷史，不以空控制表推論無刪除義務。
- 對停機超24h、磁碟不可用或平台不能清除的案例如實記違約／驗收失敗並阻擋真人；不假稱任何平台均能在無限故障中符合24h。

## Verification Handoff

用可注入時鐘測UTC曆年、閏日、臺北跨日、5／15分鐘、24h、7／30天等邊界；不用等待真實期限。用兩程序及可控連線故障測交易與LINE狀態。資料殘留測試另有受控合成標記及平台證據，不把邏輯不可見當物理不存在。

## Assumptions & Open Questions

歷史輸出交接仍由security-requirements.md NFR3.5追蹤；不得用本文件的可靠性承諾假裝C03已具交接操作。平台fencing、可信時鐘／誤差、清除機制及告警尚待設計驗證。任何新增SLA、備份、推播或復原保留政策須另取得決策。
