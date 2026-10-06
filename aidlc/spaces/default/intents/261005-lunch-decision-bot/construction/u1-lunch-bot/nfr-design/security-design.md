# U1 安全設計

## Sources

- [N] `../nfr-requirements/performance-requirements.md`、`../nfr-requirements/security-requirements.md`、`../nfr-requirements/scalability-requirements.md`、`../nfr-requirements/reliability-requirements.md`、`../nfr-requirements/observability-requirements.md`、`../nfr-requirements/tech-stack-decisions.md`：50項NFRx.y及已選技術。
- [F] `../functional-design/functional-spec.md`、`../functional-design/rules.md`：WF01–WF09與不變量。
- [C] `../../../inception/contract-design/contract-summary.md`：C01–C07，現行v1仍是凍結上游。
- [D] `../../../inception/domain-design/components.md`：四元件及九個實體owner。
- [Q] `nfr-design-questions.md`：Q1–Q4逐題確認及新摘要Looks correct；授權紀錄 `f451da1a48f2b605e5c6a399203fe6caad38982e4347a0c1d6c7ed55e0d11d17`。
- [A] `logical-components.md` LC-03：本次明確修訂的替代條文與相容性規則；原凍結上游保留歷史基準，不能把修訂後設計說成原強保證已實現。
- [REV] `../nfr-requirements/reviews/review-01.md`、`../functional-design/reviews/review-01.md`：不同階段的R-01分別是事件資料所有權與歷史輸出交接，不能混為同一問題。

## SD-01 — Trusted Ingress and Identity

對應NFR2.1–NFR2.3、NFR3.1、NFR4.1。Fastify raw-body路徑在解析前檢查唯一且合法Base64的x-line-signature，使用HMAC-SHA256及等時比較；缺漏、重複header、錯destination或型別依C01拒絕。以receivedAt檢查原始時間前24h／後5min含邊界，並要求active私訊、可信user及有效事件。群組、地址文字或使用者URL不變成位置查詢。

subjectKey以專用secret對Bot及LINE可信user ID作具域分隔的HMAC-SHA256；原始ID僅當次記憶體。eventKey使用獨立目的金鑰與可信webhookEventId；不使用座標作key。這是可連結的假名，不宣稱匿名；不傳給provider或塞入診斷label。身分HMAC金鑰在有資料期間必須可用，不能任意輪替致歷史失聯；輪替／洩漏方案須明列受影響資料及安全停用，不加永久原始ID對照表。

驗簽後生成不可由外部payload自行構造的程序內可信context。DataPrivacy每次仍重新驗owner、動作及版本；TypeScript品牌型別只防開發錯誤，不是攻擊者的授權依據。缺設定先告知並丟棄早到位置；設定完全不可讀不外傳，已知no_save仍可推薦。

## SD-02 — Ownership, Roles and References

對應NFR3.1–NFR3.4、NFR4.4；採Q1的明確釐清。同一PostgreSQL內使用line_event與privacy兩個schema；line_event_app只可使用自身受限事件介接，privacy_app只可使用權利／歷史介接。兩角色均非superuser、無BYPASSRLS、無CREATE ROLE／DATABASE、無對方schema權限、無migration權限；遷移角色不載入長駐程序。共用driver模組只能接受注入的對應pool，不能暴露admin連線。

DataPrivacy的五項資料不因共享DB就供LineInteraction SELECT。事件紀錄仍由LineInteraction業務擁有與持久化；操作契約及受影響上游文字見logical-components.md LC-02／CHG-01。這不是第五個業務元件，也不是DataPrivacy新代理所有LINE事件。

ref／cursor／confirm使用密碼學安全隨機192-bit不可猜測值，持久化只存其hash及既有允許綁定，原ref只在當次輸出。15分鐘ref、5分鐘confirm、不滑動延長、owner／scope／expectedVersion逐次驗證，動作消費與狀態變更同一交易。回覆不存在／他人／不可見統一安全結果，不洩漏存在性。ref hash不等於免除本人驗證。

## SD-03 — Secrets, Transport and Host Protection

對應NFR3.3–NFR3.4、NFR4.2、NFR4.5。外部HTTPS須驗主機／憑證、禁止任意redirect；非回環PG連線須TLS verify-full。純合成本機可使用限權Unix socket；不把該配置當真人平台證據。正式秘密由受控secret注入，禁止寫入repo、image、命令輸出、log或測試快照；無敏感值的範本只描述必要名稱。TLS最低1.2，允許1.3，不能以跳過憑證驗證解決開發問題。

at-rest保護以受控加密儲存為平台要求，主機／DB存取最小化；管理員存取另受授權，不假稱共用程序可隔離已掌控主機的攻擊者。禁用core dump、swap與payload日誌／APM；不能驗證的主機不得開真人入口。磁碟加密不是24h逐筆清除，DB清除限制依SD-04／RD-04。

不使用cookie或瀏覽器session作授權，不需要另加網站CSRF流程；webhook不是靠CORS保護。只回固定最小HTTP本文與安全Content-Type、不反射輸入；外部名稱／理由只作LINE文字，不當HTML、SQL或可執行模板。SQL參數化，絕不拼接輸入表名／排序。

## SD-04 — Retention and Residual Data Boundary

對應NFR4.2–NFR4.9，依Q4及LC-03 CHG-05明確修訂。QueryHistory仍只有七個邏輯欄位；queryAt保留原有效事件UTC瞬間，expiresAt=UTC一曆年後、Feb29→翌年Feb28，不以365天／DB session時區代替。原一年是線上可查閱期限；刪除屏障／expiry立即阻止新查閱，已核准單則輸出依SD-05例外，不承諾收回LINE訊息。

| 儲存目標 | 已選處置 | 完成或限制的證據 |
| --- | --- | --- |
| 主資料庫QueryHistory的線上row | 原effectiveAt／expiresAt+24h內交易DELETE；固定scope／cutoff，主表直接核對 | RD-04提交確認＋新快照無scope目標＋無在途補寫；只有此層可報online_removed |
| 應用位置／頁／token引用 | 完成、取消或原10秒截止釋放，不做持久cache／queue | buffer／callback生命週期與敏感值測試；不是JS GC位元清零保證 |
| PostgreSQL heap舊版本、index、TOAST、WAL、釋放頁面及底層磁碟 | 同一受限加密volume，autovacuum及正常checkpoint／WAL回收，不作PITR／archive／replica | 權限、加密、回收設定及實際可控複本清冊；不證明逐筆24h擦除，也不刪正在使用的WAL來硬湊期限 |
| DB temp與作業系統暫存 | 禁用core／swap／休眠記憶體落盤，query參數／payload logging關閉；DB temp目錄置不落盤tmpfs，容量有界 | 啟動檢查掛載／日誌設定及失敗注入；無法證明則不開真人入口 |
| 歷史backup、snapshot、export、長期queue、位置診斷與host自動備份 | 第一版禁止，不將Q4解讀為可新增 | 平台排除名單與設定實證；若仍有自動副本即不符合本拓撲，須另取得變更，不能改名成殘留 |

普通磁碟加密只保護部分媒體失竊情境；掛載中、有管理權限或取得金鑰者仍可能還原舊內容。**底層殘留可能超過一年，不保證固定期限物理抹除或不可復原。** Q4接受此放寬，不是密碼學銷毀方案；刪除同庫金鑰row不等於銷毀其所有副本。平台採最小權限、管理存取授權與不含位置的安全證據、正常回收及媒體退役處置；不得以forensic／WAL還原把已刪內容重新提供應用查閱。正常PostgreSQL crash recovery可用既有WAL維持交易一致性，但啟動需RD-04安全檢查，不允許任意回到刪除前的時間點。

控制仍最多7天，安全／診斷證據最多30天，目前consent於終止後30天內移除；不因Q4新增無限控制歷史。對使用者受理時說「已受理，現在無法再查閱，線上歷史清除中」；可靠完成後說「線上歷史已移除」，不得說「所有副本已徹底銷毀」。保存告知需明列一年線上查閱／24h主資料刪除與上述底層風險，並說明刪除前核准訊息可能後送。沿用既有noticeVersion機制，新版告知未確認前不新增保存，不藉重新同意回填舊查詢；既有歷史管理不能因不重新同意而被拒絕。

[PG-V] https://www.postgresql.org/docs/current/routine-vacuuming.html 與 [PG-E] https://www.postgresql.org/docs/current/encryption-options.html 已於2026-10-05公開查核：回收空間不等於安全擦除、加密掛載視圖仍可讀。法域／公司政策是否接受這項修訂尚未查核；本人採用設計取捨不能替代法律依據或其他使用者告知。

## SD-05 — Atomic History Output Authorization

對應NFR3.1、NFR3.2及修訂後NFR3.5；Q3與LC-03 CHG-02將排序分界從「實際向LINE發送」改成「DataPrivacy核准當次歷史頁」。不再要求刪除與外部LINE請求形成分散式原子交易，也不宣稱資料庫鎖丟失後能撤銷已核准訊息。C02外部LINE API不變，只變更內部傳送介接與C03操作。

LineInteraction先取得來源可信context、事件單次reply CAS及LINE並行slot，任何一項unknown就不查頁發送；因此拿到一秒資格之後不再等待pool／網路slot或DB claim。CAS已成sending但其後放棄，可保守維持unknown，不重新取得reply權。以C03 v2 authorizeHistoryOutput取代舊listHistory→直接送的路徑，具體輸入／結果見LC-03。

DataPrivacy在短READ COMMITTED交易取得本人狀態行的FOR SHARE鎖；保存、撤回、刪除、到期清除都取同一行FOR UPDATE。取得鎖後用新statement快照讀本人五筆keyset頁、檢查cursor／scope／expiry及生效刪除屏障。核准LP是此statement內以同一可信authorizedAt對整頁完成可見性檢查的時點，不是稍後COMMIT ACK或LINE送出時點；不是在呼叫者舊page上做最後版本查詢。expiry必須嚴格大於authorizedAt，全部已失效則依當下結果安全返回空頁；讀取故障不可假空。

核准是唯讀授權，持鎖期間成立即可；不在DB新增長期授權／頁快取。取得完整、可信的授權查詢結果才可建立opaque capability；只有部分row／錯誤／timeout不成立。正常rollback／結束唯讀交易釋鎖不撤銷已成立的授權；意外失鎖在完整結果之前一律unavailable，在已知核准之後的刪除可先成功而該則仍送出，這正是Q3接受的界線。若需簽發下一頁／刪除ref，先完成原有不含位置的ref交易，再於本次授權重驗；ref的簽發成功不能替代頁授權。

能力只在DataPrivacy私有記憶體registry，綁定程序、subject、event／attempt、原deadline、不可變page與ref集合及其摘要；不入JSON／DB／log、不接受外部傳入的聲稱。以發起授權SQL前的單調時間authStart計算notAfter=min(authStart+1000ms,originalDeadline,ref剩餘期限的保守單調映射)，DB授權發生在authStart後，所以不會給出超過授權後一秒的資格；結果回得太晚直接丟棄。資格不再綁最早history expiresAt，因為Q3明確允許核准後到期的該則仍送出；新核准仍須重新排除。

LineInteraction只能用授權物件的immutable page及refs經純renderer產生歷史訊息；history分支不接收任意舊PageResult／原始字串。渲染後在C02 adapter入口同步呼叫DataPrivacy.consumeHistoryOutput，核對同context／頁、完整性、未消費、未取消、notAfter及原deadline，原子改consumed；成功才在同一同步呼叫交付HTTP transport。此處「開始發送」定義為應用消費資格並提交單次transport操作，不保證socket bytes或LINE接受在一秒內；中間禁止await／另排應用工作／重新取得slot。OS在transport開始後暫停、網路延遲及LINE稍後接受均不新增許可或延長期限。若transport未呼叫即發生同步錯誤也不還原consumed；未知結果不重送。

cancelHistoryOutput使尚未消費能力失效；完成、截止或程序退出一律移除當次registry引用。程序重啟不能重建或重播能力，事件sending保持unknown；跨程序複製／偽造物件一律拒絕。取消發生在transport開始後不承諾收回。無跨owner直接SQL或DataPrivacy→LINE回呼；所有呼叫仍由LineInteraction向DataPrivacy發起。

順序例證：刪除先提交→新授權快照不包含；核准先成立→刪除後仍可在資格內啟動一則；expiry先於核准→不包含；expiry在核准後→允許該則但新查閱排除；auth結果延遲超過notAfter→不送；程序在adapter入口前停頓超限→重查後不送；transport開始後暫停→可能晚到，不承諾召回。這是已確認的保證變更，不是用多讀一次消除原TOCTOU。

## SD-06 — Provider and Compliance Gate

對應NFR4.7、NFR6.1–NFR6.3。出口固定核准的provider host，payload白名單只有位置、固定半徑／餐廳條件及必要憑證。需驗完整response型別、穩定ID、狀態與地圖allowlist；未知opening不當open，所有同店衝突先排除整組。只有合法完整候選集合才依WGS84排序，不用provider距離代替。

Google仍是候選：Nearby Search上限20筆、營業欄位SKU、排名涵蓋、文字標示及公開政策承載待查核；未符合前REAL_PROVIDER_ENABLED=false，只有合成來源。這個開關是防止越權，不是NFR6.3已符合的證據。未查明適用地區／billing address／資料所在地／公司政策不宣稱合規；不自行建立範圍外網站或呼叫付費API。

## Verification and Assumptions

正反例包含改一byte簽章、重複header、群組、跨人ref、SQL注入文字、schema/role越權、日誌敏感值及LC-06的交錯。設計以已確認的替代保證為驗收基準，不聲稱原三項強保證仍成立；實際憑證、儲存與清除設定、法規／條款及應用測試尚未驗證，真人路徑維持未就緒。
