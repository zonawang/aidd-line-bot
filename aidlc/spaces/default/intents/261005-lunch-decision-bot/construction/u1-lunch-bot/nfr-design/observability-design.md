# U1 可觀測性與品質證據設計

## Sources

- [N] `../nfr-requirements/performance-requirements.md`、`../nfr-requirements/security-requirements.md`、`../nfr-requirements/scalability-requirements.md`、`../nfr-requirements/reliability-requirements.md`、`../nfr-requirements/observability-requirements.md`、`../nfr-requirements/tech-stack-decisions.md`：50項NFRx.y及已選技術。
- [F] `../functional-design/functional-spec.md`、`../functional-design/rules.md`：WF01–WF09與不變量。
- [C] `../../../inception/contract-design/contract-summary.md`：C01–C07，現行v1仍是凍結上游。
- [D] `../../../inception/domain-design/components.md`：四元件及九個實體owner。
- [Q] `nfr-design-questions.md`：Q1–Q4逐題確認及新摘要Looks correct；授權紀錄 `f451da1a48f2b605e5c6a399203fe6caad38982e4347a0c1d6c7ed55e0d11d17`。
- [A] `logical-components.md` LC-03：本次明確修訂的替代條文與相容性規則；原凍結上游保留歷史基準，不能把修訂後設計說成原強保證已實現。
- [REV] `../nfr-requirements/reviews/review-01.md`、`../functional-design/reviews/review-01.md`：不同階段的R-01分別是事件資料所有權與歷史輸出交接，不能混為同一問題。

## OD-01 — Safe Signals

對應NFR4.5、NFR5.2–NFR5.3、NFR5.5。停用Fastify預設request／response全文logger、DB參數logger及自動HTTP tracing；只經專用白名單encoder輸出JSON安全事件。欄位限UTC時間、隨機單次correlationId、固定component／operation／outcome／errorClass、durationMs與必要count。未知欄位拒絕，不用自由文字message或raw exception做後門。

不記subjectKey、eventKey原值、historyKey、ref、token、座標、SQL bind、完整URL或header。隨機correlationId只在一個工作內關聯，不向外部供應方傳播、不跨查詢追蹤同一人；它不是永久控制索引。需要操作證據時由權利控制資料最多7天保留最小識別，不複製到診斷30天資料。

以本機有界ring buffer聚合固定label counters／histograms，向受限本機檢查命令提供snapshot；不是公開metrics HTTP API。可控安全log按日檔輪替，最大30天，容量上限先警示且丟棄一般INFO不得吞掉清除故障安全狀態；當無法記必要證據時維護路徑回不健康，不能宣稱觀測符合。日誌不含位置，因此不替代一年歷史。

## OD-02 — Measurement and Alerts

對應NFR5.2–NFR5.4。每次測試產出場景、總樣本、正確／拒絕／未回覆數、ACK與reply接受耗時、p95演算法、deadline違反、環境與工具版本。未回覆樣本依performance-design.md記失敗，不塞0ms。沒有同意儲存的人仍可被安全總量計數，但不記可回溯的個人行為資料。

| 訊號 | 觸發 | 接收方式與處置 |
| --- | --- | --- |
| 任一線上清除batch／核對失敗 | 每次觀察到失敗立即 | 本機安全error＋非個人服務安全狀態，重試不改due |
| 清除pending接近期限 | 最早due剩餘<6h | 明確warning，不延長期限 |
| 清除超時 | now≥due且無完整完成證據 | error／未達標；依RD-04隔離，保持清除中而非online_removed |
| 敏感值被偵測／授權隔離失效 | 任一事件 | 停止相關收集或資料路徑，限制證據存取，不能繼續dump除錯 |
| deadline入口檢查、DB順序或輸出能力驗證不可信 | 任一證據失效 | 關閉依賴該能力的真人路徑，記G-*未就緒 |
| 容量 | SC-03閾值 | 本機warning，提出調校／資源決策，不自動付費擴容 |
| pool checkout | 任一timeout／失敗，或60秒窗口等待p95≥80ms | 窗口涵蓋全部嘗試，依固定pool類別計數；同類通知可60秒合併，計數不丟棄，不需等待超過100ms才警示 |

本輪只設計本機受限命令與安全輸出；不發Slack／mail／LINE push，不新建dashboard。真人環境需要維護責任人、可達通知通道、檢查節奏及送達失敗備援。通道未定是未就緒，不以「有log」假稱有人收到。測試以受控subscriber驗證第一次故障可見及告警失敗的安全記錄。

## OD-03 — Quality Commands and Security Evidence

對應NFR8.1–NFR8.4、NFR9.1–NFR9.4。下列是後續Code Plan要實現的命令契約，現在沒有package.json、套件安裝或已執行報告：
- build／typecheck：TypeScript完整應用輸入；format:check為Prettier，lint為ESLint。
- test:unit與test:integration：Vitest，依test-after逐層補測；coverage包含未載入應用碼，lines≥80%，排除清單只能依已確認種類。
- test:performance：合成開迴路負載及五併發，輸出安全量測與nearest-rank判定。
- security:secrets：選Gitleaks本機掃描；security:sast：選Semgrep本機固定rules；security:dependencies：優先OSV-Scanner的本機資料庫／不傳repo依賴模式。這些工具是待鎖版／適用性查核的設計選擇，若實際版本無法離線或需上傳內容，先回報，不偷偷改用外部SaaS。不給未查核的CLI flags或假稱已安裝。
- 相依安全資料可在確認來源、授權與存取條件後取得；過期資料庫、掃描失敗、規則零涵蓋或工具缺失不能算pass。偵測結果先判讀，已確認有效憑證／Critical／High阻擋合併，誤報／限期例外必須提出者決定。
- 同一lockfile與工具版本供本機／CI使用，CI provider尚未選；不受信任變更不得取秘密／發布權限。DAST待受控目標與明確授權，不掃LINE／Google。

安全／測試報告只留規則、檔案／位置、severity、安全摘要與版本，不留命中的秘密原值、位置或訊息。掃描與測試失敗snapshot也走白名單，最多30天且受限存取。設計文件／程式碼不是運行診斷，正常版控不以診斷TTL刪除。

## OD-04 — Verification Matrix

至少逐模組happy path＋兩個錯誤／邊界，並覆蓋上游F全部案例群；80%不替代權利案例。以可注入clock測UTC曆年／閏日、5min／15min／24h／7d／30d，注入兩程序、commit ACK失、LINE未知、修訂後的授權分界、主資料清除及底層殘留保護。LC-06逐項列出新語意正反例，舊全殘留清除／十秒commit生效／實際送出分界斷言不可原樣照搬。完整真人整合只在所有G-*與外部前提完成及取得授權後進行，合成／真實證據分列。

## Assumptions & Open Questions

尚未選外部CI／監控、維護責任人或精確工具版本；本輪不安裝、不上傳、不執行應用scan。命令契約須於Code Plan落實並取得必要驗證命令核准，不把文字清單當執行證據。
