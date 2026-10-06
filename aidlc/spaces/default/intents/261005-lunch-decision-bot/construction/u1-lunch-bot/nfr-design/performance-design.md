# U1 效能設計

## Sources

- [N] `../nfr-requirements/performance-requirements.md`、`../nfr-requirements/security-requirements.md`、`../nfr-requirements/scalability-requirements.md`、`../nfr-requirements/reliability-requirements.md`、`../nfr-requirements/observability-requirements.md`、`../nfr-requirements/tech-stack-decisions.md`：50項NFRx.y及已選技術。
- [F] `../functional-design/functional-spec.md`、`../functional-design/rules.md`：WF01–WF09與不變量。
- [C] `../../../inception/contract-design/contract-summary.md`：C01–C07，現行v1仍是凍結上游。
- [D] `../../../inception/domain-design/components.md`：四元件及九個實體owner。
- [Q] `nfr-design-questions.md`：Q1–Q4逐題確認及新摘要Looks correct；授權紀錄 `f451da1a48f2b605e5c6a399203fe6caad38982e4347a0c1d6c7ed55e0d11d17`。
- [A] `logical-components.md` LC-03：本次明確修訂的替代條文與相容性規則；原凍結上游保留歷史基準，不能把修訂後設計說成原強保證已實現。
- [REV] `../nfr-requirements/reviews/review-01.md`、`../functional-design/reviews/review-01.md`：不同階段的R-01分別是事件資料所有權與歷史輸出交接，不能混為同一問題。

## PD-01 — Deadline Budget

對應NFR1.1–NFR1.6。以首次有效事件抵達的單調時鐘建立唯一10,000ms deadline；UTC用於資料期限，單調時計算本程序剩餘預算。client重送、分頁、取消或重試皆不重設deadline。以下是**待測設計配置**，不是供應方保證或已量測結果：

| 階段 | 配置上限ms | 累計ms | 超限結果 |
| --- | --- | --- | --- |
| 驗簽、信封與事件claim，寫出HTTP ACK | 600 | 600 | 無法安全認領回C01既有503；可能已claim的事件靠去重，不假稱業務完成 |
| 讀設定／admitQuery | 300 | 900 | settings_unavailable停止外傳；已知no_save才可推薦 |
| 完整必要來源讀取（所有正常頁共享） | 2200 | 3100 | 取消並回source_failure；失敗重試0，不交部分頁 |
| 正規化、WGS84、衝突／排序 | 100 | 3200 | 有界工作量；計算不可用回C04 Error，不冒充零結果 |
| 最終保存／權利交易 | 400 | 3600 | 確定未寫入才not_saved，不能確定為unknown |
| 組句／格式上限 | 100 | 3700 | 不截掉告知、地圖、來源或保存狀態 |
| reply狀態CAS | 100 | 3800 | 未能可靠取得發送權就不呼叫LINE |
| LINE請求至收到接受／拒絕 | 1000 | 4800 | 不明即unknown，不盲重送／push |

配置總和4800ms，為5秒p95留下200ms量測／調度餘裕，不以總和當達標證據。各階段使用min(階段上限、原deadline剩餘−必要後續預留)，任何非正預算立即走安全失敗分支。正常及受控故障的實測仍須分別達標；若因安全交接超預算，不犧牲授權來達成速度。

最晚8,000ms停止新增業務步驟並保留最多2,000ms作尚未發起的故障回覆及釋放；這是最後防線，不是把正常來源timeout改成8秒。10,000ms停止應用啟動新工作並釋放當次引用，adapter入口每次重查原deadline。Q2允許已合法發起的DB交易晚完成；SD-05界定歷史發送的應用起始點，不承諾網路／LINE一秒內交付。事件loop阻塞／suspend後不得重新開始過期工作；依RD-03驗證，不能只靠timer。

## PD-02 — Admission and Memory Work

對應NFR1.2、NFR1.6、NFR1.7–NFR1.8、NFR4.2。Fastify先限制原始body為256KiB，再以原bytes驗HMAC；只在本次記憶體保留需要的payload。容量保護使用C01原有413／503，不新增429或額外HTTP契約。初始20個在途事件slot；同一webhook多事件逐事件claim，不能安全接收剩餘部分時503，已claim者不重做。已驗證不支援事件安全忽略，不佔推薦slot。

單一常駐Node程序作基準，不使用ACK後可能凍結CPU的請求生命週期平台；ACK後任務需由同程序有界工作集合持有且有finally釋放。沒有持久工作queue。關機先拒新輸入，再只等每項原deadline，程序被殺時不恢復位置工作。runtime與主機不落盤證據是Infrastructure前提，Node／Fastify名稱不是證據。

來源response最多1MiB、解析後最多1000個候選作防耗盡上限；超出時整次來源故障，不靜默截取。這不是把Google20筆當完整搜尋；真實provider映射未通過前出口關閉。候選與原始response不雙重長期保留，不記request body、URL座標或token。

## PD-03 — Queries and Connections

對應NFR1.5、NFR1.8、NFR3.1。PG driver選用node-postgres的有界pool設計，精確相容版本在Code Plan鎖定。每程序初始：LineInteraction角色pool最多4、DataPrivacy互動pool最多6、同角色清除專用pool最多1；各pool idle timeout30秒，checkout等候最多100ms且受原deadline限制。總連線預算及DB管理餘裕見scalability-design.md。

索引只服務已授權訪問：事件eventKey唯一、歷史historyKey唯一、本人歷史(subjectKey, queryAt DESC, historyKey ASC)、expiresAt清除索引、控制purgeAt與清除dueAt索引。不能為效能增加餐廳清單、位置cache、永久event索引或跨人查詢入口。QueryHistory仍是七個邏輯欄位；索引／WAL等底層殘留依Q4／SD-04的加密及存取保護，不再承諾24h逐筆物理抹除。

每次pool checkout記錄允許的pool類別、等待耗時與成功／timeout／失敗類別；等待分布包含失敗樣本，不只成功者。逾時／失敗另有計數，不依靠等待值超過100ms才辨識飽和；告警規則見SC-03及OD-02。

權利交易先取得目前本人狀態行鎖，再取得必要動作／紀錄鎖；固定順序與短transaction，嚴禁持鎖等餐廳。pool上限不等於可同時持有十秒DB鎖；lock_timeout最多100ms，statement_timeout不超過該步剩餘，transaction_timeout、unknown backend隔離及commit晚完成依RD-03；未通過實測與平台條件不得真人保存。

## PD-04 — Benchmark and Optimization

對應NFR1.1、NFR1.3、NFR1.7、NFR8.3–NFR8.4。合成20身分，開迴路1q/s×300秒，另測同時五筆；逐正常／不足／零／來源故障／保存unknown分列。p95=排序第ceil(0.95N)筆；可回覆但未回覆計超標，不刪樣本。ACK、reply accepted、完整正確性與10秒違反分開計量，LINE不可用另報失敗。

量測含pool／鎖等待、冷啟動、真實排程落後，記資源及替身延遲。若未達標，先檢查有界候選、索引、查詢計畫及pool等待；不啟用不被允許的資料cache／持久queue，不降低80%或負載。真實整合需另有資源／權利／費用授權，受控數字不能代替。

## Assumptions & Open Questions

未執行應用測試或安裝。256KiB、20slots、1MiB、1000候選及pool／timeout是本次可測初始設計，不是外部API限額；適用本文大小、混合事件及Google回應須驗證。需要變更C01／產品行為或增加資源費用時先回報；不靜默調低負載避開失敗。
