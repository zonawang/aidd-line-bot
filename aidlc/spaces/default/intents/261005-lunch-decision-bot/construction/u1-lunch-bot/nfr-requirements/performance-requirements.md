# U1 效能需求

## Sources

- [R] `../../../inception/requirements-analysis/requirements.md`：NFR1–NFR9 與功能驗收界線。
- [F] `../functional-design/functional-spec.md`：WF01–WF09 與已確認的狀態／競爭規則。
- [B] `../functional-design/rules.md`：規則的權威 YAML。
- [C] `../../../inception/contract-design/contract-summary.md`：C01–C07 介面與最小資料投影。
- [Q] `nfr-requirements-questions.md`：本輪三題已答、整份摘要 Looks correct；授權紀錄 `9e6e63e53393656f3cc31b97135000d3251f63866204932c7ec3810d96db3898`。
- [P] `../../../inception/practices-discovery/team-practices.md`：test-after、品質及交付限制。

## Scope

本文件定義待驗證目標，不是測量成果。U1 是單一模組化應用；LINE 接收 ACK、業務完成、LINE 接受回覆與使用者裝置看到訊息是不同事件。只承接小規模試用驗收，不新增正式 SLA。[R NFR1][F WF01、WF09]

## Requirements

| ID | 可量測要求 | 驗證與判定 |
| --- | --- | --- |
| NFR1.1 | 使用最多 20 個合成身分，持續 1 有效查詢／秒、五分鐘、共 300 筆；另跑同時五筆查詢，兩種場景分開記錄 | 記錄產生、抵達、有效／拒絕、已回覆與未回覆數；測試身分數不是固定產品帳號上限 |
| NFR1.2 | webhook 首次抵達服務至接收 HTTP 回應的 p95 ≤1000ms；接收前完成來源與必要無位置原子 claim，不等全部推薦 | 驗證合法空 events、正常位置與受控故障；錯誤接收回應不能假稱業務或 reply 成功 |
| NFR1.3 | 有效事件首次抵達服務至 LINE 接受結果回覆的 p95 ≤5000ms，正常及 LINE 可用的受控故障逐場景符合 | 使用完整合格樣本集合的 nearest-rank：排序第 ceil(0.95×N) 筆；300 筆為第285筆。LINE 可用但未回覆的樣本算失敗／超標，不刪除；五筆併發場景第5筆為 p95 |
| NFR1.4 | 首次受理的總處理上限10000ms；相依呼叫、正常來源分頁、鎖等待、取消及失敗回覆共用原 deadline，重送不重設 | 受控慢來源、慢資料庫及晚到結果：截止後不開始新工作／保存／回覆，不以取消訊號當成資料庫提交已阻止的證據 |
| NFR1.5 | NFR Design 必須提供可計算的依賴 timeout／取消與失敗回覆預留：每次呼叫上限不超過剩餘預算；正常路徑亦須實測滿足5秒目標 | 最壞上限總和及實際交錯都不得超過10秒；5秒是驗收分位目標，不靠設10秒 timeout 證明達標。清除工作有獨立24小時期限，不占用已結束的位置生命週期 |
| NFR1.6 | webhook 回應後，當次記憶體工作在原期限內仍有受控執行能力；不能持久排隊位置換取可靠性 | 本機／實際候選平台分別測 HTTP ACK 後執行、停機及回收；平台無法支持則阻擋該部署選型，不改成同步等10秒又宣稱 ACK 達標 |

來源：NFR1.1–NFR1.4 由 R NFR1、C01／C02 與 F WF01／WF09 繼承；NFR1.5–NFR1.6 是上述上限的設計證明義務，沒有自行新增使用量或外部服務保證。

## Benchmark Protocol

- 合成資料先測：正常三家、不足、零結果、來源故障且 LINE 可用、保存 not_saved／unknown、查閱／刪除故障分列。不得把回錯訊息的快速請求算作正確成功。
- 使用可控供應方及 LINE 替身，記錄延遲設定、資料集大小、CPU／記憶體／資料庫版本與配置、冷啟動／暖機、執行個體數、時鐘來源、測試版本及命令。冷啟動樣本不可偷偷排除；若另報暖機結果須分開標明。
- 壓測發送器持續依排程產生輸入，不以等待前一回覆減少實際負載；記錄發送端落後及服務端抵達時間，避免把客戶端阻塞藏起來。
- p95 不足以代表所有截止：同時報 min／p50／p95／max、超10秒數、未回覆數及正確性失敗數；deadline 與敏感資料生命週期仍是逐事件硬性要求。
- LINE／網路不可用案例沒有可靠接受時間，單獨記錄，不宣稱達到回覆 SLO，也不盲目重送或改 push。授權下真實整合另留量測，不能用替身成績代替。
- 初始 CPU、RAM、資料庫 pool、本文／來源回應大小上限需在 NFR／Infrastructure Design 提出有界設定並實測，不捏造現有容量。負載上限與容量證據見 scalability-requirements.md。

## Verification Handoff

測試在首次抵達、驗證、claim、資料設定、來源、保存／核對、reply 開始／被接受、取消與位置釋放處取單調耗時；持久證據只留安全時間、狀態、隨機單次關聯碼與量測，不記位置或訊息。時鐘跨機量測不能用未校正的時間直接相減。[R NFR4–NFR5]

## Assumptions & Open Questions

尚未執行效能測試、建立環境或配置 timeout。數字是已確認門檻；各依賴預算、資源配置及平台背景執行證據留給 NFR／Infrastructure Design，未證明不能聲稱可行。來源最多回20筆的候選限制與欄位費用風險見 tech-stack-decisions.md，不以較少回傳資料美化效能或假稱完整搜尋。
