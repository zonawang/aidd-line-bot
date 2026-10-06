# U1 基礎設施規格

## Sources

- [Q] `infrastructure-design-questions.md`：Q1 Docker Compose、Q2 GitHub Actions與獨立摘要Looks correct；摘要授權 `ba75ca1a561d29c9871d31eafe17511b5b80b0e8a5f237aa7c043370f6f153e9`。
- [P] `../nfr-design/performance-design.md` PD-01–PD-04：期限、輸入上限、連線池及量測。
- [S] `../nfr-design/security-design.md` SD-01–SD-06：身分、權限、傳输／儲存、殘留與歷史頁授權。
- [C] `../nfr-design/scalability-design.md` SC-01–SC-03：單程序資源基準、不自動擴容及容量警示。
- [R] `../nfr-design/reliability-design.md` RD-01–RD-05：DB交易、unknown、清除與隔離。
- [O] `../nfr-design/observability-design.md` OD-01–OD-04：本機安全訊號、品質命令及證據。
- [L] `../nfr-design/logical-components.md` LC-01–LC-06：四元件、CHG-01／02／04／05明示修訂、v2介面、就緒條件與12項反例。
- [D] `../../../inception/domain-design/components.md`、[F] `../functional-design/functional-spec.md`與`../functional-design/rules.md`、[K] `../../../inception/contract-design/contract-summary.md`：原owner、WF01–WF09、規則與C01–C07。舊強保證只在[L]明列範圍被取代，不倒改凍結文件。
- [T] `../../../inception/practices-discovery/team-practices.md`：test-after、至少80%、合併前CI與不正式上線。

## Deployment

| Facet | Choice | Rationale |
| --- | --- | --- |
| Compute model | Docker Compose v2，一個常駐Node.js 24／TypeScript／Fastify容器、一個PostgreSQL 17容器；四元件同版 | [Q][P][C]；不新增worker、serverless、位置queue；HTTP ACK後程序仍運行 |
| Networking topology | Bot只有合成測試HTTP入口綁host 127.0.0.1；DB不publish任何host port，獨立內部DB network只連Bot與授權一次性維護工具 | 不開公開歷史／metrics／管理API；來源及LINE另經受控HTTPS出口；沒有VPC、雲端LB、公開DNS或隧道 |
| Storage strategy | 合成環境使用專用、逐次命名的DB volume，禁止混用既有DB；PG temp及Bot必要暫存用有界tmpfs；安全診斷另限權目錄 | 不將容器檔案層當歷史或日誌儲存；無歷史backup、snapshot、replica、export、PITR或持久位置cache |
| Environments | local與CI僅合成資料／假秘密；真人非正式環境未建立、未授權；沒有staging／production | 不因設計同意或合成測試成功視為真人就緒；若之後另設staging，重新評估既有合併後部署規則 |
| IaC approach | 後續Code Plan產生Compose、Dockerfile、版本清單及啟動檢查；本輪僅設計表 | 不在本階段偷跑完整IaC／workflow／應用生成 |
| Resource sizing | Bot起點1vCPU／512MiB；PG起點1vCPU／1GiB，DB volume合成驗證起始上限2GiB；主機／VM另留OS與測試器空間 | 取自[C]的待測預算，不宣稱機器已有容量或p95已達標；磁碟警示<20%，不可滿時備份位置繞過限制 |
| Runtime hardening | 固定非root UID、drop capabilities、no-new-privileges、Bot rootfs唯讀、禁止privileged／Docker socket／host network；PG只在必要資料／socket／temp掛載可寫 | 不允許容器取得主機管理權；Compose／容器root設定不能證明macOS VM或host不落盤 |
| Lifecycle | 預設不自動重啟或擴容；SIGTERM先停接收、只等每項原deadline，平台停止寬限起點15秒；啟動先跑安全核對再接收 | 寬限不延長10秒工作期限；crash丟棄當次payload、reply／commit不明保持unknown，不從持久位置重播 |
| Time | 容器／PG UTC，LINE顯示Asia/Taipei；主機具可信時間來源，app單調deadline與PG clock_timestamp分開 | UTC曆年而非365天；LINE事件與同意／刪除關係無法證明時拒存，時間健康未知拒絕相關歷史輸出 |

文字拓撲：合成本機測試器 → 回環Bot入口 → 四元件；LineInteraction → line_event schema，DataPrivacy → privacy schema。DB不對host／網際網路公開。模擬HTTP來源與LINE在受控測試網路；真實出口預設關閉。未使用Mermaid，不需要以未驗證圖形取代此文字圖。

## Infrastructure Services

| Service | Role | Configuration | Notes |
| --- | --- | --- | --- |
| Bot容器 | application | 20在途，來源與LINE各5連線；body 256KiB、來源1MiB／1000候選；必要頁共享2200ms、故障retry=0；reply含slot等候1000ms | 超限安全拒絕、不truncate為成功；600ms ACK配置、4800ms整體預算與200ms餘裕仍需量測。[P] |
| PostgreSQL 17 | database | max_connections=20；line_event_app上限4、privacy_app總上限7（互動6＋清除1）；剩餘9供受限維護／測試；兩schema無跨owner SQL | 角色名稱用[S]的app後綴；[R]的角色限額同義承接，不是第三個資料owner。migration不得載入長駐程序 |
| schema／索引 | database | eventKey與historyKey唯一；本人歷史(subjectKey,queryAt DESC,historyKey ASC)、expiresAt、purgeAt、dueAt索引；七個QueryHistory邏輯欄位不增加 | historyKey、subjectKey、queryAt、latitude、longitude、expiresAt、resultSummary；不加永久event對照 |
| DataPrivacy清除迴圈 | in-process maintenance | 每60秒／啟動先掃，每批≤100鍵／單subject；專用pool1，交易≤5秒；原due=effectiveAt或expiresAt+24h | 固定scope／cutoff；主表新快照核對且防舊save補寫，才online_removed；不是外部cron或新增service。[R] RD-04 |
| 安全診斷 | local diagnostic | Bot內有界ring counters／histograms、受限Unix socket只允許固定snapshot／health查詢；安全JSON按日輪替 | 不開metrics HTTP、不增dashboard／APM服務；維護能力與只讀diagnostics權限不同。見monitoring-design.md |
| cache／queue／search／CDN／DNS／LB | none | 全部不建；無位置cache、持久payload queue、read replica | 正式對外HTTPS／DNS與維護通知若需要，先另確認環境、資料出口及費用，不能視為已配置 |
| 外部LINE／餐廳來源 | external dependency | 只有核准endpoint HTTPS TLS≥1.2及完整憑證驗證，拒絕redirect；不得發push、額外探测或任意使用者URL | Google只是候選，20筆上限、來源標示、公開政策承載、條款與計費仍待證據；實際host依核准帳號確定 |

單Unit沒有跨Unit共享資源，Shared Infrastructure不適用。兩個schema共享同PG故障域，不代表兩個部署Unit或高可用。兩程序故障測試必須切分4／7的總pool配額，不直接每程序各複製11條。

## I-01 — Version and Configuration Admission

| 項目 | 設計選擇／拒絕條件 | Code Plan及執行前證據 |
| --- | --- | --- |
| 固定版本 | 本設計選PG17而非任意較新版，需transaction_timeout；Node24、Compose v2。精確patch及image digest未查核，不填假版本 | manifest列OS／CPU架構、Node／PG／Compose patch、base image registry與sha256、套件lockfile、CI actions commit SHA；查支援期、漏洞／授權及相容性。未固定不得稱可重現 |
| 容器runtime | 目前shell PATH未找到docker／podman／psql，不推論全機未安裝 | 由人另准安裝／下載及VM資源；檢查cgroup限制、Compose實際CPU／memory設定及tmpfs是否生效，失效就停止相應測試 |
| DB傳輸 | Compose bridge並非loopback；包括合成測試也用TLS verify-full／受控測試CA，server名匹配DB service DNS，pg_hba限精確role／來源／DB並使用SCRAM | CA及假秘密只在run-specific受限runtime目錄，不進image／repo／報告；TLS錯CA／錯名／未加密均拒絕，不設rejectUnauthorized=false |
| 交易設定 | pool checkout≤100ms、idle30秒；互動lock≤100ms，statement／transaction／idle-in-transaction≤400ms且縮至原步剩餘；剩餘<1ms不啟動 | 每連線驗設定，不支援PG17 timeout就拒絕。prepared transaction關閉；無長期snapshot／游標事務。400ms不是server無限停頓下硬終止證明 |
| 清除設定 | lock≤100ms、statement／transaction／idle≤5秒且受原due剩餘約束；overdue仍保留事實並以≤5秒補救 | 清除重試min(60×2^attempt,3600)秒＋0–10%抖動、不跨原due；原期限內最多48次，未知先查scope及主表 |
| Unknown session | client close／cancel不證明終止，pool token隔離且不自動補位；同role跨重啟限額仍成立 | 受限一次性維護程式核對PID＋backend_start＋role才cancel／terminate；不授予應用superuser／pg_signal_backend或讀取raw query；驗證終止後才釋slot |
| 存取角色 | app roles無superuser／BYPASSRLS／CREATEROLE／CREATEDB／migration及跨schema權；明確撤銷public預設create，受限search_path | 獨立migration與維護憑證不進app；維護入口只處理本應用session識別及安全狀態，不可接受任意SQL。維護流程及負面role tests為真人前阻擋條件 |
| App相容性 | 同版privacy:v2與reply-history:v2必需；啟動拒絕舊v1直接送history PageResult | 歷史授權前先取得reply CAS／LINE slot，SD-05一次性記憶體能力≤1秒且在原10秒內；同步consume→transport無await／再排queue，不以DB鎖保證LINE撤回 |

## I-02 — Data, Host and Recovery Controls

| 資產／風險 | 配置與操作邊界 | 檢查／失敗處置 |
| --- | --- | --- |
| 合成DB volume | 逐次名稱及owner標記，不掃描／刪除全機volumes；同一測試需要重啟時保留該run volume，結束只清自己的合成資源 | 不執行全域docker prune；真實資料volume絕不套用測試清理。磁碟限制／used bytes需實測，不以Compose宣告當證據 |
| 真人PG資料／WAL | 未建立；若核准，所有heap／index／TOAST／WAL同受限加密storage，無archive／replica／snapshot／host自動backup，autovacuum及正常WAL回收啟用 | 加密金鑰／掛載／存取者及所有可控副本清冊需實證；不把VACUUM／checkpoint／DELETE當secure erase，禁止手刪WAL或還原舊歷史 |
| 暫存 | PG temp_tablespaces指向預建立tmpfs tablespace，Bot /tmp與必要socket亦tmpfs；PG temp起點128MiB、temp_file_limit每session16MiB，總壓力仍需測 | 逐角色SHOW與產生合成sort/temp故障確認不fallback PGDATA；PG shared memory亦算1GiB預算。滿額即受控失敗，不偷偷落盤 |
| Host／VM | 真人前證明host與VM加密、core dump=0、swap／休眠記憶體落盤停用、snapshot及自動backup排除，runtime不收payload | tmpfs可能被host swap，容器內設定不足；macOS或runner不能證明就保持只用合成資料 |
| 日誌／錯誤 | Fastify全文logger、PG query／bind／慢查詢、HTTP自動trace及APM關閉；PG錯誤不得記statement或parameters。Docker原始stdout／stderr持久logger停用；只收白名單安全事件 | 關閉log_statement、log_min_duration_statement，log_parameter_max_length與on_error=0，log_min_error_statement=panic，log_error_verbosity=terse；檢查panic／啟動等所有路徑，無法排除敏感輸出就不留原始log或開真人 |
| HMAC／LINE／來源秘密 | 按用途分開，以受限唯讀runtime secret檔注入，路徑可作非敏感設定；不放image、repo、命令列、CI正式秘密或錯誤 | LINE／来源輪替先停新呼叫、驗新secret後復用；subject HMAC不得任意輪替使既有歷史失聯，洩漏先停相關路徑，另核准遷移與權利維持方案，不永久留raw ID |
| 保存與清除 | 一UTC曆年、Feb29→Feb28；立即擋新讀，主表24h移除；ref15min／confirm5min／控制≤7天、目前同意終止後≤30天 | 新查詢不延舊expiry；控制purge前24h仍無安全證據，非個人全儲存狀態blocked，最遲purge前封鎖所有歷史讀寫，控制仍刪 |
| 隔離重啟 | 非個人儲存安全狀態獨立於短期個人控制；狀態缺失、不可讀或不可信預設blocked | 停接歷史並由受限維護撤銷app歷史存取；啟動不載真人權限直到核對舊session終止、未履行清除及不復活。無法分類原scope保持隔離，不清空他人合法新資料 |
| Recovery／rollback | 無歷史備份，不能承諾災損恢復或RPO／RTO；只允許交易一致性的正常PG crash recovery，啟動先安全核對 | 不能PITR回到刪除前；app rollback需同版v2／schema相容且不改屏障／expiry／due。不相容就停用，不能以舊版恢復可用率 |
| 已核准歷史頁 | DataPrivacy核准LP後，可在資格內啟動該一則；刪除／expiry不撤銷已核准頁 | 正常新讀仍立即排除；資格期限不保證socket／LINE接受／使用者裝置送達期限，不承諾收回 |

底層殘留可能超過一年，具管理權限／金鑰者仍可能復原；沒有固定物理抹除或不可復原保證。這是已確認[S][L]的限制，不授權新增副本；適用政策不接受就不開真人保存，不暗改期限。

## I-03 — Precise Functional Handoff

下表承接上游NFR Review R-05的精確來源缺口；只補本階段交接，不修改凍結NFR、不宣稱該上游發現已被獨立重審關閉。Code Plan須同載[F]、[K]、[L] LC-03及本表，只有指定完成／殘留語意變更，其他保障不變。

| 精確上游位置 | 原文字／狀態 | 下游有效替代與未變保障 |
| --- | --- | --- |
| functional-spec.md WF06 第8步 | 全目標完成才「已刪除」 | 受理回「已受理，現在無法再查閱，線上歷史清除中」；RD-04主表及不復活核對成功才「線上歷史已移除」，不得「全部副本徹底銷毀」。回覆失敗不反轉刪除 |
| functional-spec.md WF08 第3步 | 逐主要儲存、快取及可控副本清除；全目標證據 | 24h義務針對固定scope主資料row；主表新快照核對且不被舊save重建。底層殘留按[S]保護、無固定擦除期限；仍禁止新位置cache／副本，工作鍵不帶位置 |
| functional-spec.md WF08 第8步 | 不建持久備份／匯出，平台副本不符合即阻擋真人 | 無backup／snapshot／export／replica仍不變；PG既有WAL／heap正常殘留不宣稱24h擦除，但新增副本不是殘留。服務終止的consent另處理 |
| functional-spec.md State Machines — QueryHistory | readable → unreadable → physically_absent | readable → unreadable → online_removed（衍生線上row不存在，不新增第八欄）；不回readable，控制到期或恢復不能復活，不能映射為物理不可復原 |
| functional-spec.md State Machines — CleanupJob | purging → complete／failed；安全重試 | 完成終態改online_removed；執行中purging／pending、failed／overdue及unknown分清，重試依RD-04核對原scope與主表。無完整證據不可成功、不得改dueAt |
| rules.md BR7.4 | 受理、清除中、完成分別回覆 | 「完成」限定線上歷史移除並說明殘留限制；LINE接受不當DB清除證據 |
| rules.md BR9.2 | 清除時限及成功證據不重算 | 原effectiveAt／expiresAt+24h不變，證據改為線上主表移除＋不復活；DB晚commit或晚掃描不豁免超時 |
| rules.md BR9.3 | 備份／復原不得恢復已刪歷史 | 不變；禁止新增副本、舊WAL/PITR／forensic內容返回應用，無安全證據隔離，控制仍≤7天 |
| contract-summary.md C03／C07；[L] CHG-05 | 舊complete及全殘留清除措辭 | 內部privacy:v2明定online_removed，C07可信本機觸發不新增公開API；unknown不猜成功，不改LINE官方schema |

## I-04 — Readiness and Evidence

| 門檻 | 要交的實證 | 現況／阻擋 |
| --- | --- | --- |
| G-OWNERSHIP／G-COMMIT | 雙向schema拒絕、PG17 timeout、pool隔離、兩程序順序及晚commit；[L] T-COMMIT-01–03 | 尚未實作／執行，不能真人保存 |
| G-HANDOFF | privacy:v2／reply-history:v2、原子頁授權與程序綁定能力；T-OUTPUT-01–04 | 未實作，不能用v1降級開歷史 |
| G-PURGE | 主表實刪、原due、控制回收、重啟隔離、無新增副本與殘留告知；T-CLEAN-01–03、T-RESIDUAL-01 | 未實測；失敗不假報online_removed |
| G-ENVIRONMENT | ACK後常駐、加密／tmpfs／core／swap／clock／位置地區及帳號權限證據、維護責任／可達告警 | 未建立；通知未定不是「已有log就通過」 |
| G-PROVIDER | LINE與來源帳號、搜尋完整性／標示／政策／實際目的地及费用授權 | REAL_PROVIDER_ENABLED=false；不呼叫真實API試錯 |
| G-QUALITY | [T]及cicd-pipeline.md全部必要檢查、80%、真實授權下完整流程分列 | 沒有應用／CI執行結果；REAL_HISTORY_ENABLED=false，flags不能繞過其他門檻 |
| 授權邊界 | Code Plan及驗證命令確認，安裝／下載、repo／runner／上傳內容、費用與真實資料另核准 | 本文件不是安裝、Git、服務啟動、部署或掃描授權 |

## Assumptions & Open Questions

已選Docker Compose及GitHub Actions，沒有未決的產品設計題。本輪不虛構精確patch／digest、主機能力、月費、可達通知或法規符合；這些以I-01／I-04列為後續實作／啟用前必需證據。部署平台不能符合時回報，不新加備份、擴容、公開網站或降低原品質要求。應用、平台、負載與真人串接尚未驗證。
