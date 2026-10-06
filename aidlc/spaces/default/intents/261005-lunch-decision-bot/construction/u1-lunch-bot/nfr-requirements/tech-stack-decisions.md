# U1 技術選型與驗證交接

## Sources

- [R] `../../../inception/requirements-analysis/requirements.md`：NFR1–NFR9 與功能驗收界線。
- [F] `../functional-design/functional-spec.md`：WF01–WF09 與已確認的狀態／競爭規則。
- [B] `../functional-design/rules.md`：規則的權威 YAML。
- [C] `../../../inception/contract-design/contract-summary.md`：C01–C07 介面與最小資料投影。
- [Q] `nfr-requirements-questions.md`：本輪三題已答、整份摘要 Looks correct；授權紀錄 `9e6e63e53393656f3cc31b97135000d3251f63866204932c7ec3810d96db3898`。
- [P] `../../../inception/practices-discovery/team-practices.md`：test-after、品質及交付限制。

## Decision Status

本輪確認的是程式工具、PostgreSQL設計目標及Google Places優先查核方向，**不是資源或真人啟用許可**。四元件、一個service、C01–C07責任不變。本機合成資料先驗證，未知外部能力不得被填成已通過。語言／資料庫選型可以固定，而特定版本、平台符合性與供應方權利仍需證據。

## Technology Decisions

| 項目 | 採用／狀態與理由 | 比較過的替代與取捨 | 下一個證據 |
| --- | --- | --- | --- |
| 語言／runtime | Q1採TypeScript＋Node.js 24；同一語言處理LINE／HTTP、型別與非同步 | Python＋FastAPI亦可完成需求，但使用者選TS；不能因型別存在就省略runtime邊界驗證 | Node24支援時程已查；精確patch、TS與依賴相容性在實作前核對鎖定 |
| HTTP框架 | Q1採Fastify；集中schema、raw bytes與logger設定 | FastAPI隨Python方案未採；框架預設logger不是本案資料白名單 | 選相容受支援版本，測原始本文驗簽、大小限制、ACK後執行、關閉敏感預設記錄 |
| 測試／風格 | Vitest及適用coverage provider、ESLint、Prettier | pytest／coverage.py、Ruff／Black隨Python方案未採；不用人工檢查取代必要命令 | 鎖定工具與設定，涵蓋未載入應用碼；非TS的安全工具另依NFR9.3驗證 |
| 持久化 | Q2採PostgreSQL作本機設計／驗證目標，只有DataPrivacy持有資料存取介接 | SQLite環境簡單但寫入並行及多實例拓撲較受限；兩者均不自動保證擦除 | 支援的PG major／patch、driver及交易隔離／鎖定由NFR Design定義並證明；SQL DELETE不當清除證明 |
| LINE | 依已核准C01／C02使用Messaging API，不新增push或公開歷史API | 官方SDK與有界直接HTTPS均須保留raw-body簽章、單次reply與取消語意 | 選client時查隱含retry／timeout與logger，不預設任何SDK已符合 |
| 餐廳 | Q3僅以Google Places API（New）作第一候選，C06透過Adapter隔離供應方 | 可改用使用者指定且合法的其他API／資料集，但不得無聲切換；固定fixture僅測試替身，不能當真實交付 | 下方外部證據與能力／條款／成本阻擋項；未查核完不視為已選定可上線來源 |
| 距離 | 實作WGS84橢球最短地表距離，沿用a=6378137m、f=1/298.257223563 | Haversine球體／地圖道路距離不符合已確認算法，不能當替代 | 選維護中演算法套件或可信實作，查授權與獨立參考值；不以誤差容忍擴大產品1000m界線 |
| 本機／基礎設施 | 可重現Node程序＋受控PostgreSQL，先合成資料；不預選cloud | 容器化或原生PG為後續環境方案；不擅自安裝Docker、開託管DB或雲端服務 | NFR／Infrastructure Design選具體執行方式、資源、主機不落盤與清除證據；本輪不安裝 |
| CI與IaC | 可移植本機檢查命令先定義；CI階段在scope內，外部託管／IaC未選 | 不因舊專案曾用GCP、GitHub或agent為AWS角色就視為採用 | CI Pipeline及Infrastructure Design取得適用平台／權限；本輪不推送、不提交、不部署 |
| 診斷／告警 | 先用有白名單與期限的本機安全輸出，機制待設計 | 不引入外部APM、Slack／郵件或公開dashboard | 驗證清除故障可見且通道失敗有備援，真人前確認維護責任與存取 |

## External Evidence

查核日期：2026-10-05；僅對公開文件做無憑證HTTP GET，未呼叫LINE／Places服務、未傳送位置、未啟用計費。下列是文件證據，不是本案真實平台測試。網頁可更新，選型／上線前須再核對實際版本與條款。

| 來源 | 此次讀到的事實 | 對本案的限制 |
| --- | --- | --- |
| E1 Node Release schedule：<https://raw.githubusercontent.com/nodejs/Release/main/schedule.json> | v24 LTS為2025-10-28、maintenance為2026-10-20、end為2028-04-30；目前本機node報v24.18.0 | Node24仍在該時程內；不代表全部套件相容或已鎖版。未用較舊版本EOL推論必須升到未確認major |
| E2 Nearby Search (New)：<https://developers.google.com/maps/documentation/places/web-service/nearby-search> | POST搜尋需field mask；maxResultCount為1–20；currentOpeningHours等欄位觸發Nearby Search Enterprise SKU | 不能宣稱單次回覆列出一公里全部餐廳，也不能用較便宜欄位把未知營業當open。正式價格／billing account／配額尚未查核，不填單價 |
| E3 Places policies：<https://developers.google.com/maps/documentation/places/web-service/policies> | 有內容保存限制及place ID例外、Google Maps標示要求；空間受限時允許文字標示的條件，需讓使用者清楚知道來源；依billing address有不同條款。頁面摘要並提示公開Terms of Use／Privacy Policy要求 | 本案仍不保存供應方內容。須查完整適用條款、第三方標示、LINE文字介面可否符合及公開政策承載；摘要不是法律或實作符合性證明，不逕自建立範圍外網站 |
| E4 PostgreSQL routine vacuuming：<https://www.postgresql.org/docs/current/routine-vacuuming.html> | MVCC保留舊版本；VACUUM回收可重用空間，VACUUM FULL以新檔重寫且要排他鎖 | 空間回收不是本案24h物理清除證據，還須檢查WAL、索引、主機與副本。current文件可能隨major更新，最後要對鎖定版本驗證 |

### Candidate Provider Stop Conditions

Google候選仍為**待查核，未核准真人使用**：
- 必須界定資料來源候選集合的涵蓋與完整回應語意。最多20筆與供應方排名可能漏掉本案open優先、WGS84距離排序後應推薦的店家；不能用「取得20筆即全部」掩蓋衝突。若無法滿足既定契約與使用者文案，回報需求／來源修訂，不擅自擴圈、增加搜尋分片呼叫或聲稱找到全部。
- 檢查restaurant分類、穩定ID／店家更名或搬遷、座標、businessStatus與當下opening的映射；一般OPERATIONAL不等於目前營業中。欄位缺失保留unknown，所需資訊／標示無法提供時不能捏造。
- 公開條款／隱私政策的承載與LINE標示方式必須獲得適用條款支持；若需要新增網站或變更C02回覆類型，先提出範圍／契約修訂。沒有默認把LINE保存內容當作本專案可控儲存，也不承諾代刪第三方紀錄。
- 費用估算含實際欄位SKU、完整查詢呼叫數、測試流量、配額、地區／帳號條件；使用者另核准才啟用。無金額上限時不發有成本的測試。

## Quality and Delivery Requirements

| ID | 要求 | 驗證／停止條件 |
| --- | --- | --- |
| NFR8.1 | test-after：每個可測層實作後即測，邊界可連接即做整合，再擴充，最後完整流程 | 計畫及證據保留順序，不能等全部實作完才補幾個smoke tests |
| NFR8.2 | 可測應用原始碼行覆蓋率至少80%，包括未被測試載入的應用碼 | 明列coverage include與排除；只排依賴、產生碼、AI-DLC框架及測試本身，未達標／未收集不算過 |
| NFR8.3 | 必要正反例涵蓋可信入口、半徑／排序／衝突、告知／撤回、跨人、唯一性、並行、unknown、刪除／到期及清除復原 | 對照F Verification Handoff每群案例與R Acceptance Coverage；每可測模組含happy path及至少兩種錯誤／邊界，測試數或80%不替代必要案例 |
| NFR8.4 | 日常用合成位置／身分與可控時鐘／來源；授權後另留真實LINE→來源→回覆與本人歷史管理完整流程證據 | 合成與真實成績分列；沒實際授權或真實證據就不稱全版本完成 |
| NFR9.1 | 本機／CI使用相同鎖定工具版本與命令，提供可重現建置、格式、lint、型別、單元／關鍵整合、coverage說明 | CI平台尚未定不豁免必要檢查；缺命令、失敗或未執行不算通過，未達門檻不能合併 |
| NFR9.2 | 固定直接／間接依賴，可信來源、lockfile、最小CI權限；不受信任PR不接觸秘密，不自動把程式／資料交新外部服務 | 檢查依賴來源、lockfile一致、CI權限及artifact敏感值；開源工具授權／供應鏈亦須查核 |
| NFR9.3 | 秘密、依賴及適用SAST都需有實際涵蓋與結果；確認有效憑證外洩及Critical／High在處置前阻擋合併 | NFR Design評估可本機運行的工具／rule pack、資料出口及適用性；掃描失敗、零涵蓋或無工具不能當pass。誤報／限期例外須提出者檢視證據另決，不由AI代接受 |
| NFR9.4 | 掃描與CI證據遵守30天、最小化及授權存取；DAST只可在已授權受控目標／流量／停止條件下進行 | 本輪不掃LINE／餐廳、不上傳程式到外部、不使用真人位置；不能為scan報告保存完整秘密或原始位置 |
| NFR9.5 | 本輪提供可測試版本，不正式上線；Code Plan、驗證命令與必要外部操作各依流程另取核准 | 不將Continue automatically／本次摘要解讀為git commit／branch、安裝、費用或部署許可；文檔check不是應用build、security或integration通過 |

來源：R NFR8–NFR9、P、Q。詳細工具命令與版本留待設計／Code Plan；不能以本輪未安裝工具取消必要檢查。

## Handoff and Blocking Items

| 時點 | 必須提供 | 責任／不能做的事 |
| --- | --- | --- |
| 實作歷史交接前 | Functional R-01對應的C03／C02修訂／證明：owner、識別／版本、時效、取消、失敗與刪除／到期交錯 | NFR Design先提出契約變更，不編造已存在操作、不跨owner storage |
| 定資料層／runtime方案時 | 可信時間、transaction deadline fencing、跨實例順序、ACK後原期限內執行、不落盤與24h清除可行性 | NFR／Infrastructure Design；無法符合即回報，不能暗改物理清除為僅邏輯刪除 |
| 真實來源整合前 | E2／E3能力、候選涵蓋、完整適用條款、標示／政策承載、帳號與費用核准 | 開發提供證據、提出者作資源／衝突決策；Google不符合時重新選擇 |
| 真人保存前 | 本人權利全流程、平台日誌／備份／副本、加密／權限、所在地／法域及真實測試證據 | 缺項未就緒，不以本機資料庫或文件審查通過代替 |
| 實作／CI前 | 相容鎖版、實際安全工具及命令、Code Plan與必要驗證命令核准 | 不提前安裝、提交、部署或新增外部服務 |

## Assumptions & Open Questions

沒有將上述阻擋項改成已完成；沒有Google服務價格、法規結論、PG24h清除或LINE完整串接成功主張。Functional R-02的上游接受來源已在security-requirements.md補充，但不重寫凍結文件或宣布結案。本輪產出只屬設計需求，traceability.json的OK意指文件有下游需求，不是應用驗收通過。
