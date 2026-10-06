# U1 可靠性設計

## Sources

- [N] `../nfr-requirements/performance-requirements.md`、`../nfr-requirements/security-requirements.md`、`../nfr-requirements/scalability-requirements.md`、`../nfr-requirements/reliability-requirements.md`、`../nfr-requirements/observability-requirements.md`、`../nfr-requirements/tech-stack-decisions.md`：50項NFRx.y及已選技術。
- [F] `../functional-design/functional-spec.md`、`../functional-design/rules.md`：WF01–WF09與不變量。
- [C] `../../../inception/contract-design/contract-summary.md`：C01–C07，現行v1仍是凍結上游。
- [D] `../../../inception/domain-design/components.md`：四元件及九個實體owner。
- [Q] `nfr-design-questions.md`：Q1–Q4逐題確認及新摘要Looks correct；授權紀錄 `f451da1a48f2b605e5c6a399203fe6caad38982e4347a0c1d6c7ed55e0d11d17`。
- [A] `logical-components.md` LC-03：本次明確修訂的替代條文與相容性規則；原凍結上游保留歷史基準，不能把修訂後設計說成原強保證已實現。
- [REV] `../nfr-requirements/reviews/review-01.md`、`../functional-design/reviews/review-01.md`：不同階段的R-01分別是事件資料所有權與歷史輸出交接，不能混為同一問題。

## RD-01 — Authoritative Transactions

對應NFR2.3–NFR2.5、NFR3.1、NFR4.1、NFR4.3–NFR4.4。DataPrivacy以本人目前狀態行的SELECT FOR UPDATE作為所有同意／保存／刪除操作的共同序列化點；新人的初始化使用subject唯一限制及衝突後重讀，不先在記憶體任意建立順序。取得鎖後才分配權威bigint順序，交易rollback留下序號空洞可接受，不以時間戳或JSON陣列順序代替。

同一transaction檢查目前notice／choice／版本、permit owner／event、原始時間可信關係、刪除cutoff、queryAt／expiresAt與deadline，再唯一寫入歷史並消費permit。新增同意版本、確認刪除屏障及清除job同樣在相應原子交易中生效。只先驗權限再另開INSERT交易不合法。獨立兩連線／程序插入交錯測，不靠每人單一worker替代上游已選交易方案。

LineInteraction事件claim與DataPrivacy admission是不同owner的交易。前者成功後後者失敗可丟失當次處理，不能從持久位置重播；receipt存在使重送不重啟業務。兩交易不假裝跨owner原子，沒有寫位置queue來補可靠性。

DB已證明提交回saved；可證明未提交才not_saved；逾時／連線斷／commit ACK遺失為unknown。查核只用既有event／history識別，查不到已過期控制不能證明從未保存。重試不得重新INSERT位置；重新同意不回填舊查詢。

## RD-02 — Retry and Reply State

對應NFR2.6–NFR2.7、NFR5.1、NFR7.1–NFR7.2。餐廳故障自動重試0；關閉HTTP client retry，所有正常分頁共享2,200ms來源預算。暫時錯誤、429或5xx都如實source_failure，不用cache、擴圈或合成店家冒成功。第一版不額外加circuit breaker或half-open探測，避免引入未授權外部呼叫與新故障語意；以bulkhead和timeout限制影響。

LineInteraction自己的事件repository原子CAS not_started→sending取得唯一回覆權，之後accepted／rejected／unknown終態不回退。sending時程序crash或200後狀態寫失敗為unknown，不能盲目重送或push。接收ACK、推薦、保存及LINE接受各自獨立。token只在本次記憶體，已用／過期／缺token不呼叫。

格式化保持C02的1–5則文字、每則≤5000 UTF-16 units、quick reply≤13且只最後一則；所有重要狀態有繁中與文字入口，時間Asia/Taipei。保存unknown保留推薦，明說無法確認，可稍後看歷史；清除受理不說完成。來源標示若無法在既定格式合法呈現，先阻擋該provider，不截斷標示。

## RD-03 — Initiation Deadline and Unknown Commit

對應NFR1.4、NFR2.4–NFR2.5、NFR2.8及NFR4.2，適用LC-03 CHG-04／Q2修訂。十秒是應用啟動新步驟的截止，不是所有已發起DB工作的生效截止。所有業務、DB及HTTP adapter入口使用同一單調deadline；到期或取消的context不得再開新交易、發COMMIT或發送新reply。最後檢查與交付driver在同一同步呼叫內，不在兩者間await、排應用工作或重試；driver／OS接手之後的完成可能晚到，不能用callback到達時間冒充實際提交時點。停止／恢復後第一個adapter動作必須重查deadline；timer是喚醒手段，不是唯一防線。

初始驗證目標為支援transaction_timeout的PostgreSQL 17或較新受支援主版本，精確版本於Infrastructure固定。互動交易設定：lock_timeout=min(100ms,剩餘預算)，statement_timeout及transaction_timeout=min(該步剩餘預算,400ms)，idle_in_transaction_session_timeout≤400ms。剩餘不足1ms就不開始；零不是無限timeout的替代值。逐連線檢查設定值，僅受限role可登入、禁止prepared transaction及背景攜位置重送；連線／版本不支援要求時拒絕該路徑，不能略過設定。

PostgreSQL 17公開文件 https://www.postgresql.org/docs/17/runtime-config-client.html#GUC-TRANSACTION-TIMEOUT 於2026-10-05確認此設定以毫秒限制transaction、0為停用，prepared transaction不受限制；設定能力不等於server停頓下硬截止或已實測。正式版本須另查支援期／相容性。

保存順序為：取得目前本人狀態行鎖→以READ COMMITTED的新statement快照重驗notice／save／版本／事件／permit／cutoff／expiresAt→原子INSERT及消費permit→deadline仍有效才交付COMMIT。所有撤回、刪除、保存與清除採相同本人行鎖和固定鎖序。真正保存生效點為DB成功提交；若先保存再撤回，該筆是既有歷史；若撤回／刪除先成功提交，後來取得鎖的舊保存會被版本／屏障拒絕。不得持鎖等來源或LINE。expiry在最終授權時驗證；晚提交也不延長expiresAt，已到期資料不得新查閱且清除due仍從原expiresAt計算。

client期限到達時立即取消等待、送出可用的cancel、關閉並從pool逐出該連線、移除應用持有的位置／訊息引用。這不是JS記憶體安全抹除或DB回滾證據；已交給DB的合法保存可能完成。COMMIT已發起但無確定結果一律unknown；沒有COMMIT發起也不能僅靠逾時宣稱回滾，須有rollback／backend終止等可靠證據才not_saved。late callback不得再回覆、重存或還原舊context。截止前可在預留reply預算說「目前無法確認是否已保存，可稍後查看歷史」，截止後不追加訊息／push。

每個pool保留固定容量token：unknown backend佔用的token進入quarantined，不因client close就自動補新connection；line_event角色DB連線上限4，privacy角色總上限7（互動6＋cleanup1），配合DB總20。隔離token只存backend/session識別及狀態、不含位置，限制在當次運行／既有控制最長7天內。受限維護命令只可觀察／取消本應用backend（核對PID、backend_start及role，避免PID重用），不得讀出query text；確認舊backend終止才回收token。server完全不可達時保持slot隔離、readiness不健康，不無限換連線；服務重啟先由同一受限維護流程清理舊session，所有舊reply維持unknown。DB角色上限是跨重啟的第二道界線，不把close或pg_cancel_backend成功當交易未提交。

單調時間與DB可信UTC分開。DB內以clock_timestamp而非transaction起始固定時間檢查expiry；已簽LINE事件不足以證明相對同意／刪除時點的誤差界線。同毫秒、漂移或來源時間關係無法證明則拒存，不把前24h／後5min入口窗口當因果證據；設定不可確認仍停止外傳。時間健康故障保守拒絕相關歷史輸出。

反例處置：COMMIT於9.9秒交付、server停頓至11秒才生效→unknown或晚完成，是Q2已接受語意而非原截止保證；撤回先成功再恢復舊保存→版本拒絕；client取消但DB仍commit→unknown且不重送。timeout在server停頓時也可能晚執行，400ms是配置與可測正常故障目標，不聲稱無限停頓下硬終止。長時間DB故障造成24h清除未達仍為違約，不能藉Q2豁免。

## RD-04 — Online Cleanup and Quarantine

對應NFR4.3–NFR4.4、NFR4.6、NFR4.8–NFR4.9、NFR5.4，適用LC-03 CHG-05／Q4。已選方案是單一PostgreSQL主資料庫、無歷史備份／replica／snapshot／archive，先以本人刪除屏障或expiresAt立即禁止新讀，再以交易刪除線上主資料。底層殘留不納入24h物理抹除保證；具體目標、保護及使用者措辭見SD-04。不以rowcount=0宣稱所有媒體已清。

DataPrivacy同程序迴圈每60秒掃描，啟動先掃；dueAt由原刪除effectiveAt或expiresAt加24h，遲掃描不重設。每批最多100個historyKey，清除專用pool1連線、lock_timeout≤100ms、statement／transaction／idle-in-transaction timeout≤5秒並受最早due剩餘約束；due已過則以至多5秒進行補救，但保留overdue。每個subject批次先鎖ConsentState權威行，再鎖既有CleanupJob與目標；多subject工作拆批，不反轉鎖序。

單筆刪除使用已確認historyKey；全部刪除依確認時固定cutoff及scope，不擴大到其後新查詢。到期任務使用expiresAt≤可信now，並保留每筆原due。DELETE目標只限上述固定範圍；同交易更新不含位置的batch進度。批次提交確認後，以新READ COMMITTED交易再取得同一subject鎖，驗證該job範圍在線上主表已無剩餘且舊permit／刪除屏障仍阻擋在途補寫，才原子標online_removed。仍有row則pending；連線／ACK不明則unknown，重試先查既有job與主表，而非猜成功。不經帶expiry過濾的查閱API核對清除，避免用「已不可見」冒充「row已刪」。

每個scope可以重複DELETE而不改原due／cutoff；已知完成的batch不重建。失敗延遲min(60×2^attempt,3600)秒，加0–10%抖動且不超過due剩餘；原期限內最多48次，啟動恢復另掃。最早due剩餘<6h警示；到due仍無確定完成即overdue／error、受影響儲存隔離，仍補救但不得抹除未達標事實。每次清除等待都釋放與重取得pool，不持鎖睡眠。

新查閱／輸出只用READ COMMITTED、SD-05的全新授權；禁止長期snapshot／游標事務、read replica、位置頁面cache、PITR及還原舊WAL作應用服務。所有保存拿同一subject鎖，因此已成功刪除屏障不能被更早未完成的保存越過；expiry晚提交仍會被每輪掃描及讀取過濾捕捉，逾due才生效依然算清除未達，不重設期限。

控制purgeAt前24小時若仍無主資料清除與不復活證據，將非個人、全儲存readiness設為blocked；最遲控制原七天到期前禁止該儲存所有歷史讀寫及解除權限。控制仍按期刪除，不建永久個人tombstone、不刪不屬範圍的新歷史。DB不可達／安全狀態無法寫入時，程序及下次啟動預設blocked，不以缺marker視為安全。恢復須由受限維護程序在禁止應用連入下核對無舊session、未履行線上清除與復活風險已處置；控制證據已失無法安全區分範圍則保持隔離並請維護人處理，不擅自清空所有人的合法歷史，也不承諾自動恢復。

目前consent於服務終止後30天內刪除，不與一般控制7天混用；清除所有合法線上資料仍需單獨記錄，不能以刪consent代替。媒體退役時依平台核定安全處置，但不把退役流程當每筆24h擦除。沒有歷史備份／匯出，災損可能無法恢復；不新增RPO／RTO。

## RD-05 — Shutdown and Fault Matrix

對應NFR5.1、NFR8.3–NFR8.4。SIGTERM先關閉接收能力，再只等待當前工作原deadline；不延長位置存活。無法完成的reply／commit標unknown，程序退出不產生恢復位置payload。狀態需有可靠DB回覆才確認，不明時安全失敗。

| 故障 | 使用者／內部結果 | 禁止補救 |
| --- | --- | --- |
| 設定未知 | 暫時不能確認設定，不外傳 | 猜no_save／save或把位置排隊 |
| 來源慢／失敗 | source_failure，合法permit才可記真實失敗歷史 | 隱含retry、假零結果、拼部分頁 |
| DB ACK遺失 | unknown，保留可用推薦 | 再存一次／說一定沒存 |
| LINE不可用 | rejected或unknown | push補發／說裝置已收到 |
| 清除失敗／超時 | 清除中或失敗、維護告警與隔離 | 說已刪、延長期限／控制TTL |
| 已確認的新語意尚無實作／平台證據 | 真人資料路徑未就緒 | 以文檔核准或合成成功當實證，或宣稱原強保證仍成立 |

## Verification and Assumptions

故障注入包含kill前後、兩程序重送、DB連線／COMMIT回應遺失、時鐘前後跳、到期與輸出交錯、清除batch部分成功、告警失敗、控制回收與重啟。LC-03與LC-06列修訂後斷言及反例，不把原強保證當已實現；應用測試及平台實證尚未執行。
