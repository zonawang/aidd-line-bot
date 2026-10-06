# U1 邏輯元件與設計決策

## Sources

- [N] `../nfr-requirements/performance-requirements.md`、`../nfr-requirements/security-requirements.md`、`../nfr-requirements/scalability-requirements.md`、`../nfr-requirements/reliability-requirements.md`、`../nfr-requirements/observability-requirements.md`、`../nfr-requirements/tech-stack-decisions.md`：50項NFRx.y及已選技術。
- [F] `../functional-design/functional-spec.md`、`../functional-design/rules.md`：WF01–WF09與不變量。
- [C] `../../../inception/contract-design/contract-summary.md`：C01–C07，現行v1仍是凍結上游。
- [D] `../../../inception/domain-design/components.md`：四元件及九個實體owner。
- [Q] `nfr-design-questions.md`：Q1–Q4逐題確認及新摘要Looks correct；授權紀錄 `f451da1a48f2b605e5c6a399203fe6caad38982e4347a0c1d6c7ed55e0d11d17`。
- [A] `logical-components.md` LC-03：本次明確修訂的替代條文與相容性規則；原凍結上游保留歷史基準，不能把修訂後設計說成原強保證已實現。
- [REV] `../nfr-requirements/reviews/review-01.md`、`../functional-design/reviews/review-01.md`：不同階段的R-01分別是事件資料所有權與歷史輸出交接，不能混為同一問題。

## LC-01 — Inventory and Failure Domains

仍是單一U1 service、四個業務元件，三條業務依賴為LineInteraction→DataPrivacy、LineInteraction→LunchRecommendation、LunchRecommendation→RestaurantSourceAdapter。回傳值不新增反向依賴；本文件的repository、pool、clock與safety gate是元件內技術組件，不是新業務owner或獨立部署服務。

| 邏輯組件 | 所屬／資料owner | 隔離與故障影響 |
| --- | --- | --- |
| LINE入口、reply adapter、事件repository | LineInteraction；LineEventReceipt | 事件DB不可用不能安全claim／reply；既有claimed工作不重播，token不持久 |
| 當次候選處理與WGS84計算 | LunchRecommendation；RecommendationQuery、RecommendationResult | 純當次記憶體，故障回C04 Error，不產生假的歷史狀態 |
| 同意／保存／查閱／刪除及清除迴圈 | DataPrivacy；ConsentState、QueryHistory、DeletionConfirmation、HistoryWriteControl、CleanupJob | 只自己的privacy schema；設定未知阻止外傳，歷史失效不假稱空頁；可依能力隔離 |
| 來源client及白名單映射 | RestaurantSourceAdapter；RestaurantCandidate | 來源故障限制在當次推薦，不能讀本人歷史或LINE token；Google候選未通過時只用合成替身 |
| 常駐Node runtime與有限工作集合 | U1執行環境，不擁有新業務實體 | 程序故障影響全部在途工作；原deadline、無位置queue、不承諾無損重啟 |
| PostgreSQL、line_event／privacy schema、受限roles | 各原owner透過自己的repository使用 | 同一DB故障為共同故障域，schema隔離不是DB高可用；pool分離防清除飢餓但仍共享I/O |
| clock／deadline、無個資log與安全狀態 | 各元件注入共用技術工具 | 不讀別人的表，不產生新個人資料庫；時間／安全證據不可信關閉相應權利路徑 |

文字圖：LINE → LineInteraction → LunchRecommendation → RestaurantSourceAdapter → 合法來源；LineInteraction → DataPrivacy。LineInteraction → line_event repository／schema；DataPrivacy → privacy repository／schema。兩schema在同一PG，無交叉SQL。共有九個原業務實體，每個只有原owner，沒有轉移LineEventReceipt到DataPrivacy。

## LC-02 — Event Repository Contract

對應NFR2.3、NFR2.6、NFR3.3及本輪Q1。這是LineInteraction內部技術介接，不新增C03操作：
- claimTrustedEvent：只接受已完成C01驗證的eventKey、originalEventAt、firstReceivedAt及固定purgeAt；唯一鍵交易返回claimed／duplicate／unavailable／unknown。只能首次認領成功者開始業務；不傳位置、raw message、subject歷史、replyToken。
- markProcessing／finishProcessing：以eventKey與預期狀態CAS，允許F既定processingState轉移；失敗不能當處理完成，原時間／purgeAt不變。
- claimReply：以已認領可信事件CAS not_started→sending；成功才可呼叫C02。單次發送權與供應方推薦結果不同，不要求同一交易持鎖呼叫LINE。
- recordReplyOutcome：accepted／rejected／unknown只依可靠結果寫入終態；sending崩潰後恢復視unknown。失敗不反推已未送出、不把unknown還原not_started。
- purgeExpiredReceipts：最多7天，刪前後的原始事件窗口仍由C01判斷；不因資料消失重啟舊查詢。

role tests必須證明line_event_app不能SELECT／UPDATE privacy，privacy_app不能直接碰line_event；以程序可信context將必要event識別交給DataPrivacy，不改資料owner或以共享admin pool繞過。沒有跨schema外鍵迫使事件紀錄永久保留；event識別是有限期限邏輯關聯。

## LC-03 — Confirmed Amendment Register and Interfaces

本節是本Unit後續設計的明確替代條文，依Q1–Q4及新摘要授權；凍結文件保持原樣作歷史基準。以下僅列明的語意被替代，其他欄位、owner、功能與品質要求仍承接。**原NFR2.8、NFR3.5、NFR4.8的較強語意沒有被原樣實現**；後續Code Plan／測試必須同時載入本節，不能只拿舊v1生成。這是正式設計修訂記錄，不宣稱已發布可執行v2 schema或已完成實作。

| ID | 受影響上游與來源 | 本次替代條文／實現 |
| --- | --- | --- |
| CHG-01 | NFR Requirements問答Q2、tech-stack的集中存取措辭；本輪Q1 | DataPrivacy只獨佔權利／歷史及其控制；LineInteraction獨佔不含位置的事件repository。LC-02／SD-02兩組roles，同PG不同表／權限，不新增C03事件broker |
| CHG-02 | security-requirements NFR3.5；Functional WF05／WF09與輸出相關rules；C03 Ordering第7項、C02歷史路由；Q3 | 排序LP改為SD-05對該人、該頁的原子授權；核准時未刪／未到期，授權後刪除／到期不撤銷該則的≤1秒單次發送資格，且不超原10秒。新讀立即排除舊資料；傳輸晚到／LINE已接收不可召回 |
| CHG-03 | C06候選來源與NFR6.3 | 未作語意變更。Google資料上限／標示／條款、涵蓋與純LINE互動仍待查核；衝突先回報，不縮圈、換排序或擴大網站範圍 |
| CHG-04 | reliability-requirements NFR2.8及NFR2.4–NFR2.5；performance NFR1.4；security NFR4.2；C03 Ordering第3項及C01／C04 deadline文字；Functional WF03／WF04／WF09相關規則；Q2 | 十秒停止應用啟動新工作／提交／reply與釋放當次引用，不保證已合法發起交易在十秒內終止或生效。資料庫commit可晚完成，unknown不冒充rollback；目前同意／屏障依共同鎖排序，原expiry及清除due不變。RD-03明定交易、cancel、資源隔離 |
| CHG-05 | inception FR9.2／FR9.3、NFR4；security NFR4.3、reliability NFR4.8–NFR4.9及刪除措辭NFR5.1／NFR7.1；Functional WF07／WF09及相關rules；C03 Ordering第7項、History/Cleanup Results、C07完成與測試條文；Q4 | 立即停止新查閱，原生效點+24h內交易刪除線上主資料並核對；底層殘留受SD-04保護但不保證固定期限抹除／不可復原，可能超過一年。complete概念改明示online_removed，無備份限制及控制TTL不變，不能藉殘留復活應用歷史 |

C03內部契約版本升至privacy:v2（設計識別，不更動LINE官方HTTP schema）。保留其餘既有操作及不變的request欄位；新增／替代如下：

| 操作 | 輸入與owner | 結果、時效及失敗 |
| --- | --- | --- |
| authorizeHistoryOutput | LineInteraction以可信context、已驗本人cursor（可無）、本次replyAttempt及原deadline呼叫DataPrivacy；不接受caller傳的舊頁當authority | SD-05讀取新五筆keyset頁，回authorized(page,opaqueCapability)／not_available／expired／unavailable。空頁也須成功本人授權。page含原C03合法欄位與必要refs，不多存位置；未成功不返回可用能力 |
| consumeHistoryOutput | C02內部history adapter同步以同context及opaqueCapability呼叫DataPrivacy；不可經外部HTTP或從JSON反序列化 | 一次性ready／invalid／expired／cancelled／used。ready只放行其綁定immutable page的純renderer輸出；不接受別人的page／任意messages替換。consume時即開始單次transport操作，後續不再await或排應用queue |
| cancelHistoryOutput | 同可信context及當次能力 | 冪等取消未消費能力、釋放引用；已消費不回退、不承諾撤回LINE訊息。無需持久finish接口；一般C02結果由LineInteraction自己的事件repository記錄 |
| commitHistory | 保留v1白名單與permit綁定，不新增位置背景工作 | saved／not_saved／unknown原三態；時限用CHG-04，不因DB晚完成重建位置或延長expiry |
| decideDeletion／getCleanupStatus | 原本人、固定scope及confirm時效不變 | 受理仍pending，v2完成狀態明定online_removed；unavailable／unknown與失敗保持獨立。證據依RD-04；不能把舊complete當作物理抹除或把缺控制當完成 |
| C07 trusted cleanup | 原可信本機觸發，不接受外部subject／cutoff | 套用CHG-05的線上目標與證據，pending／failed／overdue任一存在不得整批online_removed；不改原due，無遠端新管理API |

相容性必須採fail-closed：四元件同版部署，啟動時對照privacy:v2與內部reply-history:v2能力；任何v1 PageResult直接當history訊息的路徑拒絕而非降級。外部C02仍只有官方replyToken／messages，不把capability、subject或契約版本送往LINE；messageKind/historyEnvelope是內部必填辨識，只有受控歷史renderer可產生history envelope，非歷史分支不得接收歷史DTO。schema additionalProperties=false不能暗塞新欄位；新版本型別／schema及負面測試須在Code Plan中明列並生成，未具備就不接歷史入口。

舊cleanup complete語意不得直接沿用；沒有舊版真人資料（目前僅設計／合成）的新建環境用v2狀態。若發現真實既有部署或資料，先停止並安排另行核准的遷移，不自動更改其保留承諾。新版告知用SD-04文字，noticeVersion由既有機制控管；所有文件變更在本修訂表有來源，不能倒改原凍結回答來製造一致。

## LC-04 — Readiness Gates and Evidence

| Gate | 本次設計狀態 | 實作／真人前證據 |
| --- | --- | --- |
| G-OWNERSHIP | Q1釐清；兩組受限repository與roles已選 | 兩方向跨schema拒絕、事件claim／reply故障測試；CHG-01一致性 |
| G-HANDOFF | Q3改採授權LP；SD-05及CHG-02具體協定 | v2接口、單次能力／context／不可變頁驗證、失鎖／到期／程序暫停與重啟測試；不是原實際出口原子性 |
| G-COMMIT | Q2改採啟動截止；RD-03具體短交易與unknown隔離 | PG版本／timeout／role限額、晚commit與撤回刪除順序、backend回收測試；不是原十秒生效截止 |
| G-PURGE | Q4改採24h線上主資料刪除；SD-04／RD-04已選 | DELETE完成、固定scope／due、無副本設定、殘留加密／權限／告知與適用政策；不是全媒體24h擦除 |
| G-PROVIDER | Google仍僅候選 | 20筆上限涵蓋、欄位映射、完整適用條款、標示／政策承載與費用授權 |
| G-ENVIRONMENT | 未建立／未授權 | ACK後常駐、不落盤tmpfs／core／swap、加密／roles、可信clock、所在地、維護責任／通知 |
| G-QUALITY | 尚未執行 | Code Plan、驗證命令選定、鎖版、CI／掃描、≥80%及全部關鍵案例；合成與真人證據分開 |

REAL_PROVIDER_ENABLED與REAL_HISTORY_ENABLED預設false，不能用單一env=true繞過同版能力／授權清單。上述開關只防越權，並非完成設計或測試的證據。Q1–Q4已選取捨；剩餘是明列的schema實作、環境設定與驗證，不再把原三項不可證明強保證交給下游秘密解決。

## LC-05 — Handoff and Coverage Semantics

traceability.json保留全部50個原NFR ID。OK只表示本次有效設計基準下有具體映射，不代表已實測或原始文字全部仍成立；coverage_basis及amendments顯式記錄受CHG-01／02／04／05影響者，尤其NFR2.8、NFR3.5、NFR4.8是經人類確認的語意替代，不是原保證達成。未列出的部分照原要求。不可只拿50個OK宣稱品質／隱私已驗證。

交Infrastructure的是單常駐Node＋單PG的配置需求、role／session資源上限、常駐cleanup與殘留保護；不能新增歷史backup、replica、serverless凍結窗口或付費服務來填缺口。交Code Plan的是本節修訂基準、v2接口與LC-06全部驗證。若平台／政策不容許Q4殘留風險、來源條款不符或任何既定條件無法成立，回報而非再自行放寬。

本次僅設計與文件驗證，不安裝、不開資源、不提交／部署、不發真人位置。完整版本仍須本人權利、真實授權下整合與必要品質證據，不能把合成走通當成已交付。

## LC-06 — Required Counterexample Verification

以下是可重現測試規格，**尚未執行應用／DB／平台測試**。使用合成兩身分、兩程序、可控clock／連線fault與SQL barrier，記錄操作順序及安全結果，不輸出位置。

| Case | 注入順序 | 必要斷言 |
| --- | --- | --- |
| T-COMMIT-01 | deadline前交COMMIT，server停頓至deadline後再完成 | 可晚完成但結果不能假not_saved；沒有新提交、第二個history或晚reply，expiry不延長 |
| T-COMMIT-02 | 撤回／刪除成功先於舊保存取本人鎖；另測相反順序 | 前者拒存；後者視既有歷史再受權利操作，無越過屏障補存 |
| T-COMMIT-03 | pool／lock／query逾時，cancel ACK遺失、DB斷線及程序重啟 | unknown連線slot不自動補位；跨程序角色連線上限成立，確認backend終止才回收，不依PID單值誤殺 |
| T-OUTPUT-01 | 刪除／expiry先於授權LP；另測授權先於刪除／expiry | 前者頁不含紀錄；後者僅原單則在notAfter前可開始，LINE晚到不算新授權，後續新讀排除 |
| T-OUTPUT-02 | 完整授權結果前失鎖／部分回傳；另測核准後失鎖且另一程序刪除 | 前者不可送；後者按Q3可送一次，不要求已放棄的跨LINE原子性 |
| T-OUTPUT-03 | auth結果超1秒、adapter前暫停跨notAfter、兩次consume、不同本人／程序／頁／event、取消與重啟 | 全部拒絕相應無效發送；transport開始後暫停則記可能晚到，不假稱召回 |
| T-OUTPUT-04 | 舊v1 page直接reply；持久化／反序列化偽造能力；非歷史分支注入history DTO | fail-closed且無LINE呼叫；程式依賴與型別測試證明無可繞過的舊history路由 |
| T-CLEAN-01 | 單筆／全部固定scope，確認後新查詢，部分batch提交或ACK遺失 | 未完成不報online_removed；重新核對原scope，保留新資料及原due；unknown不當完成 |
| T-CLEAN-02 | expiresAt與dueAt前／當下／後，停機晚掃描、保存晚提交 | 新讀即時排除；原24h內主表實際刪除，過期未確認即overdue，不調整原expiry／due |
| T-CLEAN-03 | 七天控制回收、未清row、重啟及DB安全狀態不可讀 | 全歷史路徑隔離，控制不延長，不藉缺tombstone復活；不能安全修復就維持隔離 |
| T-RESIDUAL-01 | 主表刪除後仍可在受控底層合成副本偵測標記 | 不以此判線上DELETE失敗，也不聲稱物理清除；檢查禁止副本、加密／存取設定與明確告知，無真人樣本 |
| T-POOL-01 | 100筆checkout全在100ms逾時，零成功且無額外排程延遲 | 100筆完整計數、窗口p95=100ms，timeout或≥80ms規則觸發警示 |

## Assumptions & Open Questions

沒有執行應用、平台或法規查核。Q2–Q4改變了實際承諾，保留完整人類來源與原始上游，不能稱舊強保證已通過。平台細部與精確版本待下游落實；若發現上述協定仍不可實現或需新增語意取捨，停止回報，不靠調整完成定義隱藏。
