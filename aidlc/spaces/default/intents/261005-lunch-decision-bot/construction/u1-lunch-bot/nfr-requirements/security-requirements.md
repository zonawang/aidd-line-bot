# U1 安全與隱私需求

## Sources

- [R] `../../../inception/requirements-analysis/requirements.md`：NFR1–NFR9 與功能驗收界線。
- [F] `../functional-design/functional-spec.md`：WF01–WF09 與已確認的狀態／競爭規則。
- [B] `../functional-design/rules.md`：規則的權威 YAML。
- [C] `../../../inception/contract-design/contract-summary.md`：C01–C07 介面與最小資料投影。
- [Q] `nfr-requirements-questions.md`：本輪三題已答、整份摘要 Looks correct；授權紀錄 `9e6e63e53393656f3cc31b97135000d3251f63866204932c7ec3810d96db3898`。
- [P] `../../../inception/practices-discovery/team-practices.md`：test-after、品質及交付限制。

## Scope and Trust Boundaries

不假定「LINE 傳來」等於來源可信，也不假定「合法 webhook」等於可操作任何使用者。C01 原始 bytes 驗證、C03 本人授權、C06 已授權第三方出口與 C07 可信清除觸發分開驗證。所有持久歷史與控制由 DataPrivacy 管理；其他元件不跨 owner 直讀資料庫。程式內模組分界本身不是惡意主機管理員隔離機制。

## Requirements

| ID | 強制要求 | 驗證證據／失敗處理 |
| --- | --- | --- |
| NFR2.1 | 依 C01 對未改寫的原始本文驗證 LINE 簽章、destination、結構及私訊來源；不先將 JSON 重建再驗簽 | 正確／錯誤簽章、改一個 byte、錯 destination、群組、混合 events；不合法事件零餐廳傳输與權利副作用，原始本文不記錄 |
| NFR2.2 | 原始事件時間限首次接收前24h至後5min，含邊界；先驗來源才信任事件欄位 | 兩端前／當下／後及延遲重送；此窗口不延長 LINE token、15min ref 或5min確認有效期 |
| NFR2.3 | 原子事件 claim 與唯一歷史寫入防止串行、併發及跨程序重送；控制過期後仍先以事件時效拒絕舊事件 | 至多一筆歷史、一個 reply 發送者；claim 不明停止副作用，崩潰後不可由持久位置重播 |
| NFR3.1 | 每次設定、保存、歷史／分頁、刪除／取消及清除狀態都核對可信本人、紀錄與動作 scope；ref／cursor 不是 bearer 授權 | 至少兩個合成使用者交換全部識別；跨人拒絕且不洩漏存在性，不存在／他人／不可見統一安全結果 |
| NFR3.2 | 設定、歷史 cursor、刪除入口 ref 不可猜測、綁本人／用途／必要版本，簽發起15min；刪除確認綁固定範圍5min；不滑動延長 | 到期、重放、竄改 scope／版本、取消／確認並行；一次性操作原子消費，過期不能新啟動刪除 |
| NFR3.3 | 網路傳輸驗證 TLS 憑證與主機，秘密不硬編碼、不進版控／錯誤；應用 DB 權限最小化，遷移／維護權限隔離 | 非回環 DB 連線加密且驗證對端；本機純合成隔離測試如用 Unix socket，明列邊界。未授權 DB 帳號／觸發拒絕；實際憑證輪替與儲存保護須於真人前驗證 |
| NFR3.4 | 儲存、主機、CI 與診斷僅授權人員可存取；位置歷史需要 at-rest 保護及最小權限，診斷不能變成旁路歷史查詢 | NFR Design 定義金鑰與輪替、DB 角色及主機存取；磁碟加密不是即時授權或逐筆清除證明；沒有公開管理／歷史 API |
| NFR3.5 | 歷史讀取後至 C02 輸出交接須與刪除／到期具有可證明順序；先失效的內容不能送出，已開始送往 LINE 不承諾撤回 | 插入「listHistory 後、最後檢查後、交接前」刪除／到期及跨實例競爭。Functional R-01 仍未解：必須先補 C03／C02 交接契約，不能靠多讀一次或其他元件直讀 storage |
| NFR4.1 | 未完成現行告知／選擇的位置立即丟棄，不向來源傳輸，不等待同意；已知 no_save 可當次推薦，settings_unavailable 停止外傳／查詢／保存 | 初次位置後選擇仍須重傳；無設定、已知拒存與讀取失敗分開測，不猜目前 consent |
| NFR4.2 | 當次位置、原始訊息、回覆 token、來源候選與推薦內容只在必要記憶體，完成或原10秒期限到達即釋放；不入磁碟／持久佇列／持久快取 | 逐正常、逾時、例外、取消檢查所有可控暫存、DB／代理日誌、swap、core dump、APM 及錯誤附件；未證明平台不落盤就阻擋真人使用。受同意保護的合法歷史另依 NFR4.3，不把記憶體「清零」能力當作 JS GC 保證 |
| NFR4.3 | QueryHistory 邏輯欄位僅 historyKey、subjectKey、queryAt、latitude、longitude、expiresAt、resultSummary；每筆由原有效事件 UTC 起算一曆年，Feb29→翌年Feb28 | 拒絕完整訊息、來源餐廳清單／raw response、自由文字地址。測新查詢不延長舊期限；刪除／到期立即不可讀、24h內清除可控殘留，無持久位置歷史備份／匯出 |
| NFR4.4 | 去重、防重建、許可、ref、刪除作業控制不含位置／完整訊息，最長7天；其短有效期另依 NFR3.2，不藉更新延長原期限 | 控制保留與動作有效期分開測；控制清掉前仍須證明不復活已刪內容，無法證明時依 reliability-requirements.md 隔離，不加永久個人索引 |
| NFR4.5 | 診斷、安全／CI 證據與追蹤最多30天，只含允許時間、隨機關聯碼、狀態類別及必要量測；不含座標、訊息、原始 user ID 或秘密 | 含錯誤堆疊、SQL bind、HTTP URL／header、測試失敗快照及掃描附件的逐欄白名單與敏感值注入測試；匿名化不能作無限保留藉口 |
| NFR4.6 | 僅保留目前同意狀態的本人關聯、選擇、版本及變更時間，不另建永久 consent history；撤回保留拒絕狀態，服務終止後30天內清除 | 重啟不把 no_save 變 save；終止流程另有刪除證據，不以刪 consent 紀錄誤刪歷史或解除既有屏障 |
| NFR4.7 | C06 僅傳必要搜尋位置、半徑／餐廳條件及來源憑證，不帶本人、LINE token、歷史／同意版本；供應方內容限合法當次使用 | 固定核准 endpoint／redirect 規則，拒絕任意使用者 URL，驗證輸入、來源 schema 與地圖域名；不可把地圖連結／座標塞入診斷或永久 cache |
| NFR6.1 | 真實整合前逐項驗證 LINE、餐廳來源、環境、權限與費用；真人保存前取得所有本人權利、清除、安全與實際平台設定證據 | 缺項標未就緒，文件核准／替身測試不替代資源、支出或真人授權；不自行掃描外部平台 |
| NFR6.2 | 使用地區、資料所在地、公司政策、適用法規、第三方處理與告知均需查核；不宣稱已符合 GDPR／個資法或可代刪 LINE／供應方全部資料 | 來源告知需指明實際對象，查核責任由設計／提出者承接，無指定法域或法律證據不捏造合規結論 |
| NFR6.3 | Google Places 只是優先候選；完整查核結果上限、欄位／營業語意、標示、公開條款／隱私政策及計費，未通過不得啟用真人來源 | 詳見 tech-stack-decisions.md 的外部證據；若既定 LINE 文字回覆或不新增網站的範圍無法滿足條款，回報並取得方案修訂，不偷偷新增網站或省略標示 |

來源：R NFR2–NFR4、NFR6；F WF01–WF09；C01–C07；Q1–Q3。NFR3.5 明列未解的上游交接缺口，不新增未核准介面。

## Threat Model

| 威脅 | 邊界／反例 | 對應控制與測試 |
| --- | --- | --- |
| 偽冒與重放 | 偽簽章、合法事件換 owner、7天後重播、併發 reply | NFR2.1–NFR2.3、NFR3.1；正反例來源及去重測試 |
| 竄改與越權 | cursor 指向他人、改 scope、舊設定覆蓋新版、取消後確認 | NFR3.1–NFR3.2；版本／動作原子性與跨人拒絕 |
| 資訊洩漏 | URL 座標、SQL 參數、例外內容、CI snapshot、刪後在途頁 | NFR3.5、NFR4.2–NFR4.7；注入敏感樣本與交接競爭 |
| 否認／結果不明 | commit 已成功但 ACK 遺失，假報未存或已刪 | reliability-requirements.md NFR2.4–NFR2.6；只依可靠證據回覆 |
| 資源耗盡 | 巨大本文、慢來源、過多候選、pool耗盡、清除飢餓 | performance／scalability-requirements.md；設計有界限制，不丟棄既定驗收樣本假稱通過 |
| 權限提升／供應鏈 | DB 超級使用者、惡意依賴、PR 取得秘密、偽清除觸發 | NFR3.3–NFR3.4、NFR9.2–NFR9.4；最小權限、pin、掃描與可信來源 |

## Data Protection Verification

清除驗證必須覆蓋 PostgreSQL heap／index／TOAST／WAL、日誌、可控副本、磁碟與主機快照等實際存在目標；不存在者記錄設定證據。DELETE、VACUUM 或 at-rest encryption 均不單獨證明24h清除。若考慮逐筆加密及銷毀金鑰，必須先明確界定清除語意、所有金鑰副本及衍生／索引洩漏，驗證且取得必要決策；本文件沒有默認採用密碼學清除替代既定物理清除要求。

## Review Follow-up

- Functional R-01：保持開放，NFR Design 提出所有權、識別／版本、有效期、失敗／取消與刪除排序的契約修訂方案；實作前須解決。只選 PostgreSQL 無法彌補介面缺口。
- Functional R-02：上游 requirements-analysis 於2026-10-05T11:34:29Z 的 GATE_APPROVED 明錄使用者 Approve 及 R-01 Accepted risk；見 Q 的 audit 路徑。此為來源補充，不是風險修復或本輪重新判定結案。

## Assumptions & Open Questions

尚無加密、金鑰、角色、資料所在地、平台清除或跨實例交接的實作證據。允許繼續合成資料設計，不允許把本階段通過當作真人可用。Google 公開政策的具體承載方式、不可保存者的主機不落盤證明與 PostgreSQL 殘留清除均是後續實作／真人前的明確停止條件。
