# U1 基礎設施設計：本機環境與CI

## Sources

- [N] `../nfr-design/performance-design.md`、`../nfr-design/security-design.md`、`../nfr-design/scalability-design.md`、`../nfr-design/reliability-design.md`、`../nfr-design/observability-design.md`、`../nfr-design/logical-components.md`：單常駐Node、單PostgreSQL、具體容量／期限／保護與LC-03修訂基準。
- [Q] `../nfr-design/nfr-design-questions.md`：Q1–Q4及新整份Looks correct；十秒啟動截止、核准後單則歷史輸出、24h線上主資料刪除與底層殘留風險已確認，不重新詢問。
- [R] `../nfr-design/reviews/review-02.md`：前四項問題解決，另留R-05 Minor；清除修訂需精確承接Functional WF06、WF08、狀態機及BR7.4／BR9.2–BR9.3，不能回改凍結上游或把建議當已關閉。
- [D] `../../../inception/domain-design/components.md`：四元件及原owner／依賴。
- [F] `../functional-design/functional-spec.md`、`../functional-design/rules.md`：原流程與狀態基準，與[N]明示修訂合讀。
- [C] `../../../inception/contract-design/contract-summary.md`：原C01–C07，加上[N]的privacy:v2／reply-history:v2及cleanup替代語意，不改LINE官方API。
- [P] `../../../inception/practices-discovery/team-practices.md`：本機先可重現、test-after、至少80%及CI必需檢查；不正式上線。
- [ENV] 2026-10-05唯讀command -v檢查：目前PATH可找到/usr/local/bin/node，未找到docker、podman或psql。這只描述本次shell的可用命令，不等同證明整台電腦未安裝；未安裝或啟動任何軟體。

## Carried Forward Decisions

- 一個service、四個業務元件，Node.js 24＋TypeScript＋Fastify；PostgreSQL同實例兩組受限owner／schema，PG17或較新受支援版本需固定並驗證transaction_timeout。
- 先本機與合成資料；保留授權後真實完整流程的交付要求，不以模擬成功替代。當次位置不持久排隊；Node須可在HTTP ACK後繼續運行，不能採請求結束即凍結的runtime。
- 不自動擴容／切換，不建位置歷史備份、匯出、快照、replica或位置日誌；真人前必須有加密、最小權限、不落盤／清除、可信時間、維護通知、政策與資源授權證據。
- 新基準：十秒後不啟動新工作，既有合法交易可晚完成／unknown；歷史頁核准後的單次發送資格最多一秒且在原deadline內；24h清除線上主資料，底層殘留可能超過一年且不保證不可復原。後續需精確映射舊physically_absent／complete至線上row移除／online_removed，維持不復活。
- 已確認的負載、4800ms設計預算、p95目標、20在途、來源／LINE各5連線、PG pool 4＋6＋1／DB20、清除60秒／100筆／5秒及診斷期限不重新問。
- 安裝、建立資源、實際費用、Git提交／推送、部署、外部掃描及真人資料傳輸都不在本次設計選擇的授權內。Google仍只是優先查核候選，不能將本題答案當成來源條款與配額已許可。

## Questions

**Mode:** Guide me。使用者透過互動方式問題選擇「Guide me (Recommended)」；逐題說明並等待回答，不代填Q1／Q2。

### Q1 — 本機可重現環境採Docker Compose管理Bot與PostgreSQL嗎？

**背景：** 已選常駐Node及PostgreSQL，但尚未選本機環境的建置方式。目前shell找不到Docker／PostgreSQL命令，後續執行前需補齊環境，不能現在假稱可直接啟動。這題只選設計目標，不授權安裝或下載。

A. 採Docker Compose v2管理一個Node應用容器與一個PostgreSQL容器（建議）。固定版本／image來源與digest，DB不公開對外，合成資料本機驗證與CI沿用相同拓撲；重建、角色／暫存設定比較一致。代價是需另具備容器執行環境，macOS通常還有Linux VM的記憶體、授權與維護成本；Compose不自動保證host加密、swap／快照或真人政策符合。先只用合成資料，安裝／資源使用另行確認。
B. 採本機原生Node＋PostgreSQL程序，不引入Docker。降低容器需求，但需個別安裝、固定版本、管理服務及清除本機資料，跨平台重現與隔離較多手動設定；同樣不保證既有主機符合真人資料條件，缺工具也需另外確認安裝。
X. Other (please specify)

[Answer]: A。使用者原文：「同意」。採Docker Compose v2作為本機一個Node Bot容器與一個PostgreSQL容器的設計目標，固定版本、image來源與digest，DB不公開對外，本機與CI沿用相同拓撲並先用合成資料驗證。理解容器執行環境／VM的資源、授權與維護需求；Compose不代表host加密、swap／快照或真人資料政策已符合。此回答只確認設計，不授權安裝、下載、啟動容器或使用付費資源；也不代答Q2或整份摘要確認。

### Q2 — 自動檢查流程以GitHub Actions為設計目標嗎？

**背景：** 本輪必須交付CI檢查，但尚未選託管平台；本機有Git或既有GitHub帳號，不代表此專案已決定公開、推送或付費。

A. 先設計GitHub Actions工作流程（建議），本機與CI沿用鎖定版本及相同build／format／lint／test／coverage／security命令，僅用合成資料與假秘密；設計最小read權限、PR不取正式憑證、不自動部署。接受日後執行CI需將適用程式／測試放入另行核准的GitHub repository與runner；repository可見性、上傳內容、帳號／runner授權及可能費用另確認。本題不建立repo、不push、不啟動Actions、不上傳程式。
B. 保持CI服務商中立，先定義本機命令與平台無關流程；目前不選GitHub或其他外部託管。代價是CI接線與實際託管驗證仍未完成，後續CI階段需再選平台；不能只交本機命令就說完整CI已交付。
X. Other (please specify)

[Answer]: A。使用者原文：「同意」。採GitHub Actions作為自動建置、格式／lint、測試、覆蓋率與安全檢查的設計目標；沿用本機鎖定版本與命令，僅用合成資料與假秘密，最小讀取權限，不讓不受信任PR取得正式憑證，不自動部署。此回答只確認設計，不建立repository、不上傳或push、不啟動Actions；實際repository可見性、上傳內容、帳號／runner授權及可能費用另行確認。不視為整份摘要確認。

## Change and Review Boundaries

- 本階段是設計，產出部署／服務表、監控表、CI流程及追溯；不生成完整Compose／IaC、應用程式或實際CI設定來繞過Code Plan。
- NFR Design已完成並凍結，其R-05是後續需補精確對照的來源問題，不改產品取捨。本階段可在自己的交接表補WF06第8步、WF08第3／8步、QueryHistory／CleanupJob狀態及BR7.4／BR9.2–BR9.3的映射，不能宣稱上游已重審或自行改其文件。
- 地區／法域、實際資源／主機、維護責任與可達告警、LINE／來源帳號及費用仍未授權。設計可列明真人驗證前必備清單，不能虛構已存在的環境；若需要作新的實質平台取捨，另行詢問。

## Assumptions & Open Questions

Q1與Q2已分別由使用者各自的「同意」確認Docker Compose及GitHub Actions設計目標，沒有以其他階段或另一題的回答代填。沿用已確認產品與隱私修訂，不重新問保存期限、資料庫或語言；仍需獨立整份摘要確認，才產生四份正式交付文件。

## Ambiguity Analysis

- Q1、Q2各自回覆的是前一則明確建議，均可對應A；本機Compose與GitHub Actions採相同版本／命令／拓撲的設計方向相容，沒有未解的設計選擇衝突。
- Node.js 24與PostgreSQL 17或較新受支援版本沿用上游；確切patch、image digest及runner能力需在實作／驗證前查核固定，不把目前缺少執行證據描述為環境已就緒。
- 安裝、repo與runner、上傳內容／可見性、實際費用、真人前主機加密與資料政策、維護／告警責任、LINE與餐廳來源帳號仍是後續執行前置條件，不阻礙本輪設計，也不因兩題同意而自動獲得授權。
- 無需新增產品取捨題；使用者另以「Looks correct」確認整份摘要，正式成果依成功記錄的確認產生。

## Consolidated Summary Confirmation

- 本機採Docker Compose v2，一個常駐Node.js 24／TypeScript／Fastify Bot容器及一個PostgreSQL容器；固定版本與image digest，DB不公開對外。先以合成資料驗證，不假稱現有shell已能執行容器。
- 自動檢查採GitHub Actions設計，本機與CI沿用鎖定版本、命令及拓撲，涵蓋建置、格式、lint、測試、至少80%覆蓋率與安全檢查；合成資料／假秘密、最小讀取權限、不受信任PR不取正式憑證、不自動部署。
- 沿用四個業務元件、單service及單PostgreSQL的分schema／受限角色；沿用已確認容量、期限、SLO及監控需求，不新增雲端資源、自動擴容／切換或持久位置佇列。
- 沿用已確認隱私修訂：十秒是新工作啟動截止而非既有交易完成保證；歷史頁核准後單次發送資格最多一秒且在原deadline內；刪除／到期後立即擋新讀取、24h清除線上主資料，但底層殘留可能超過一年且不保證不可復原。不建位置歷史備份、快照、匯出、replica或位置日誌。
- 本輪只產出基礎設施規格、監控設計、CI/CD流程及追溯四份文件，並在自己的交接表補R-05對WF06第8步、WF08第3／8步、QueryHistory／CleanupJob與BR7.4／BR9.2–BR9.3的精確映射；不改凍結NFR成果、不宣稱上游問題已獨立重審關閉。
- 目前不安裝、下載或啟動容器，不建立repository、不上傳／push、不啟動Actions、不部署或付費；容器環境／授權／資源、repo／runner／費用及真人驗證所需主機、政策、來源條款與憑證另確認。合成驗證不替代日後另行授權的真實完整流程。

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
