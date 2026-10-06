# U1 午餐決定器：程式產生計畫

## Sources

- [U] `../../../inception/units-generation/unit-of-work.md`、`../../../inception/units-generation/unit-of-work-story-map.md`：唯一service U1／u1-lunch-bot、四元件、九實體；User Stories未執行，用真實FR而非虛構US／AC追溯。
- [R] `../../../inception/requirements-analysis/requirements.md`：FR1–FR9及子項、NFR1–NFR9、Acceptance Coverage。
- [D] `../../../inception/domain-design/components.md`、[C] `../../../inception/contract-design/contract-summary.md`：owner與C01–C07。
- [F] `../functional-design/functional-spec.md`、`../functional-design/rules.md`、`../functional-design/entities.md`：WF01–WF09、34條BR、九實體與七欄歷史。
- [N] `../nfr-design/logical-components.md` LC-03／LC-06、`../nfr-design/performance-design.md`、`../nfr-design/security-design.md`、`../nfr-design/reliability-design.md`、`../nfr-design/scalability-design.md`、`../nfr-design/observability-design.md`：明示修訂基準、12項反例與50個NFRx.y；同目錄traceability保留修訂對照。
- [I] `../infrastructure-design/infrastructure-specification.md`、`../infrastructure-design/monitoring-design.md`、`../infrastructure-design/cicd-pipeline.md`：Compose／PG17／GitHub Actions與配置。
- [IR] `../infrastructure-design/reviews/review-01.md`：R-01真人驗證循環前提、R-02持久PGDATA與tmpfs重啟，仍為上游待處理問題。本計畫列明下游修正與測試，不倒改凍結文件、不假稱已修好。

## Scope and Authorization

本計畫只供核准；尚無應用碼、安裝、容器執行或應用測試。應用寫工作區根目錄，不寫aidlc紀錄樹。既有框架、memory與不相關變更不重寫；不建立分支／commit／push，不新建repo、不部署、不付費或傳真人位置。

Approve Plan僅授權按本計畫產生應用／測試／設定／文件，不是外部操作授權。安裝／下載依賴與runtime、容器啟動及資源、外部scan／repo／Actions／真人API／费用需另取必要授權；缺任一就停在對應步驟，不把未跑測試當通過，不為繼續而改Testing Contract或guards。目前shell PATH未找到docker／podman／psql，只是這個shell的檢查結果。

單Node.js24＋TypeScript＋Fastify、單PG17，四元件同版、三條單向業務呼叫不變。精確patch、套件版本、image digest與Actions SHA必須由可信公開metadata查核後固定，不能編造或使用浮動latest。若版本／工具無法履行既定語意，提出變更再取得需要的核准；不得靜默更換DB／來源或降低門檻。

## Execution Steps

各checkbox只在該步必要檔案與證據完成後勾選；所有測試使用本Unit精確目錄／filter，命令詳見unit-test-instructions.md。每可測層先實作、隨即寫並執行測試，邊界可接即整合；不拖到末尾才補測。約5–8案例／元件是起點，不能排除安全與生命週期案例。

- [x] Step 1 — 檢查workspace、工具、授權及版本；確認無需改既有應用。建立`package.json`、嚴格TS／ESM與formatter／lint設定及`config/versions.json`；經授權後以可信metadata鎖定依賴／image／工具並生成lockfile，先無lifecycle scripts，需者另審核。不下載／啟動未獲准工具。（NFR9.1–NFR9.5）
- [x] Step 2 — Bootstrap Vitest、coverage、單Unit projects與合成fixture／可控clock／fault harness；建立最小runner smoke測試並執行精確命令。設定`src/**/*.ts`全應用include，未載入檔計入，行覆蓋率80%；完整覆蓋率在對應suite成熟後評估，不能調低。（NFR8.1–NFR8.4）
- [ ] Step 3 — 實作DB/runtime前置與資料model：Compose、PG TLS、隔離角色／migration、兩schema、表／索引、七欄歷史與短期控制、非個人安全狀態；migration擁有表，app僅必要DML，禁止跨schema／DDL。實作下節IR-02每次啟動tmpfs準備，再執行授權下合成初始化，不先開Bot入口。（FR5.2、FR9；BR5.2、BR9.1–BR9.3；NFR3.3–NFR4.6）
- [ ] Step 4 — 寫並跑資料層tests：schema／role拒絕、唯一鍵、非法欄位／型別／TTL、UTC曆年與閏日、TLS错CA／錯名拒絕；保留PGDATA但清空tmpfs的restart／spill／滿額案例。真PG不可用就停止本層驗證，不換in-memory DB假通過。（FR5.2–FR5.3、FR9；NFR3.3、NFR4.3–NFR4.9）
- [ ] Step 5 — 實作`src/line-interaction/event-repository.ts`及`src/data-privacy/repository.ts`，對應各自pool；subject共同行鎖、READ COMMITTED新快照、sequence／版本／permit／cutoff、唯一寫入與reply CAS；pool4＋6＋1／DB20、checkout100ms、互動timeout≤400ms與unknown backend隔離／安全維護。（FR1.3、FR5.1、FR7.2、FR8；BR1.3、BR5.1、BR8.1–BR8.2；NFR2.3–NFR2.8）
- [ ] Step 6 — 寫並跑repository tests及真PG關鍵邊界整合，兩連線／兩程序排序、同事件重送、commit ACK失、late commit、同意／刪除先後、PID重用、未知slot不補位，對照T-COMMIT-01–03。（FR4.3、FR5.1、FR7.2、FR8；NFR2.3–NFR2.8）
- [ ] Step 7 — 實作DataPrivacy service：告知／選擇／可信context、192-bit ref hash、15min／5min、不保存仍推薦、設定未知停外傳、本人5筆keyset歷史、固定scope刪除及撤回／重新同意、60秒清除迴圈／100鍵／5秒／原24h due與7天控制回收隔離；privacy:v2 schema＋一次性history output capability與immutable頁。（FR2、FR5–FR9；BR2.1–BR2.3、BR5.1–BR9.3；NFR3.1–NFR4.9）
- [ ] Step 8 — 寫並跑DataPrivacy單元／整合，所有本人／cross-user／期限／確認取消／unknown／清除案例、T-CLEAN-01–03、T-OUTPUT-01–04資料端及T-RESIDUAL-01；主表核對不是過濾後history API，控制到期不延長、不復活、不誤刪新資料。（FR2、FR5–FR9；NFR3.1–NFR4.9）
- [ ] Step 9 — 實作RestaurantSourceAdapter與LunchRecommendation：C05／C06投影、白名單endpoint／URL／型別、完整必要候選、來源限制、WGS84橢球未四捨五入≤1000m、全組衝突排除、open優先、距離／穩定鍵排序、最多3家、有依據理由／map／attribution，failure retry=0。（FR3、FR4.1–FR4.2；BR3.1–BR4.2；NFR4.7、NFR6.3）
- [ ] Step 10 — 寫並跑推薦／來源單元與整合：半徑前當下後、反子午線／極端座標、重複／衝突、closed／unknown、1／2／3／0家、malformed／partial／timeout／redirect／超1MiB或1000候選；確認不擴圈／不假造／不持久保存來源。（FR3、FR4.1–FR4.2；NFR1.6、NFR2.7、NFR4.7）
- [ ] Step 11 — 實作Fastify `POST /webhooks/line`與LineInteraction協調：原始bytes HMAC／duplicate-header／JSON-key、destination、active私訊、事件時間、claim後ACK／有界20在途、收到ACK後常駐工作；256KiB，HTTP狀態只依C01；所有adapter同步檢查原10秒啟動截止。（FR1、FR2、FR4.3；BR1.1–BR2.3、BR10.1；NFR1.2、NFR2.1–NFR2.3）
- [ ] Step 12 — 寫並跑API單元／整合：正反簽章／bytes改動、群組／standby／混合events／空events、reply token缺少、400／401／403／413／415／503、deadline／crash後不重播、settings unknown零來源呼叫。（FR1、FR2；NFR1.4、NFR2.1–NFR2.3、NFR4.1）
- [ ] Step 13 — 實作繁中LINE文字／quick reply互動、設定／歷史／清除狀態、confirm／cancel；1–5則／每則≤5000 UTF-16／最後quick reply≤13，來源標示不可截；reply-history:v2、先CAS及slot，再授權頁、同步consume→transport，reply單次unknown不重送／push。（FR2、FR3.3、FR4.3、FR6–FR8；BR4.3、BR6.3、BR7.4、BR10.3；NFR2.6、NFR3.5、NFR7.1–NFR7.2）
- [ ] Step 14 — 寫並跑互動／transport整合：台北時間、歷史搜尋點／餐廳地圖不混淆、長文字／表情UTF16、source attribution、T-OUTPUT-01–04完整出口、LINE接受／拒絕／unknown／發送中crash；禁止v1／任意page／別人能力／重啟恢復能力。（FR3.3、FR4.3、FR6–FR8；NFR2.6、NFR3.5、NFR7.1–NFR7.2）
- [ ] Step 15 — 實作安全診斷／metrics／Unix受限snapshot、固定labels、白名單encoder、TTL輪替／容量上限、清除／pool／clock／告警失敗狀態，以及IR-01分階段readiness與runtime preflight／shutdown／維護操作。（BR10.2、BR10.4；NFR4.2、NFR4.5、NFR5.1–NFR5.5）
- [ ] Step 16 — 寫並跑觀測／啟動／維護 tests：敏感canary不出logs／reports、100筆100ms pool timeout零成功仍警示、29／30天、disk滿／通知失敗／clock漂移／server suspend、readiness缺證據fail-closed；不把tmpfs或env flag當主機安全證明。（NFR1.4、NFR4.2、NFR4.5、NFR5.1–NFR5.5）
- [ ] Step 17 — 完整合成E2E與壓測：20身分1q/s×300秒及5同時、正常與可回覆故障分列、nearest-rank包含失敗；ACKp95≤1s、LINE接受p95≤5s，所有LC-06反例、本人完整生命週期／防復活。（FR1–FR9；NFR1.1–NFR1.9、NFR8.3–NFR8.4）
- [ ] Step 18 — 實作並經授權執行本機秘密／依賴／SAST工具入口，鎖版／規則／漏洞DB與出口；Gitleaks、OSV-Scanner離線DB及Semgrep本機规则不支持則回報，掃描缺失／零涵蓋不過。必要container OS／runtime依賴也需涵蓋；未核准外部服務不替代。（NFR9.2–NFR9.4）
- [ ] Step 19 — 寫安全工具wrapper／報告sanitizer tests，再實作GitHub Actions設定及必要check聚合、least-read／untrusted PR隔離、pin SHA、logs／artifacts14天、run-specific清理；以本機fixture檢查fail／skip／cancel／掃描漏覆蓋均不能success。不push或啟動Actions。（NFR4.5、NFR9.1–NFR9.4）
- [ ] Step 20 — 寫README、設定範本／版本／本機重現、資料／秘密／DB維護／shutdown與rollback手冊、來源權利與真實整合待辦；核對全部FR／34 BR／50 NFR與原修訂，不新增網站／公開後台／群組／push／備份。（FR1–FR9；NFR6.1–NFR6.3、NFR7–NFR9）
- [ ] Step 21 — 執行已授權的全部本機品質命令並產安全證據：build／typecheck／format／lint／測試／80%／performance／security，保持test-after已完成的逐層證據。缺工具或環境就明列blocked，不勾本步；真實API／hosted CI未授權仍分別標未驗證。（NFR8、NFR9）
- [ ] Step 22 — 只有另行授權且IR-01進入條件具備才進行受控真實LINE→合法來源→回覆及本人權利完整流程；在正式CI及真實交付證據未具備前不宣稱Unit／版本已完整交付。記錄每項未完成義務，生成真實`code-summary.md`、`source-manifest.json`與`traceability.json`後按流程審查／驗證；不捏造OK指向不存在檔案。（NFR6.1–NFR6.3、NFR8.4、NFR9.5）

本案沒有獨立Web前端，Testing Contract的Frontend behavior不適用；LINE互動行為由Step13–14測試承接，不能因此省略輸出／權利案例。Step22不授權正式上線，也不因等待外部條件把其checkbox勾完成。

## Planned Source and Test Layout

| 責任 | 預計workspace路徑 |
| --- | --- |
| 組裝／入口 | `src/main.ts`、`src/app.ts`、`src/config.ts`、`src/runtime/` |
| 四業務owner | `src/line-interaction/`、`src/data-privacy/`、`src/lunch-recommendation/`、`src/restaurant-source-adapter/` |
| 共用型別／安全工具 | `src/contracts/`（privacy:v2、reply-history:v2）、`src/shared/`（clock、deadline、WGS84、types）；不能含admin pool或跨owner資料存取 |
| DB／runtime | `db/migrations/`、`db/roles/`、`infra/postgres/`、`infra/runtime/`、`compose.yaml`、`Dockerfile`、`.dockerignore` |
| 測試 | `tests/u1-lunch-bot/unit/`、`tests/u1-lunch-bot/integration/`、`tests/u1-lunch-bot/e2e/`、`tests/u1-lunch-bot/performance/`、`tests/u1-lunch-bot/fixtures/` |
| 工具／CI | `scripts/u1-lunch-bot/`、`config/versions.json`、`vitest.config.ts`、`.github/workflows/u1-lunch-bot-ci.yml`、安全工具設定 |
| 文件 | `README.md`、`.env.example`（只有名称／假值）、`docs/app/`；不覆寫既有AI-DLC文件 |

檔名可在不改变範圍／責任的步驟內細分，但traceability及manifest須列實際寫入／修改／刪除路徑（包括generator）；不把紀錄檔、依賴或框架冒充應用實作。所有既有未知檔案先讀適用AGENTS再改，無法判定歸屬就不覆蓋。

## IR-01 — Controlled Validation Versus Delivery

修正[I]「全部G-*後才做真人驗證」的循環，而不放寬本人保護。這是[IR]R-01的**擬實作修正**，Plan Approval確認後執行，尚非已驗證：

| 階段 | 必要條件 | 不可宣稱／放行 |
| --- | --- | --- |
| 合成開發 | 假身分／位置／secret、fake外部adapter、隔離授權本機環境；逐層test-after | 不能叫真人已就緒或完整交付 |
| 受控真實整合入口 | 明確限定测试人／資料／目标／時段／流量／費用的授權；G-OWNERSHIP、G-HANDOFF、G-COMMIT、G-PURGE、G-PROVIDER、G-ENVIRONMENT必需控制與平台證據具備；G-QUALITY的建置／合成測試／80%／安全檢查通過，無未處理保護缺口 | G-QUALITY的「真實完整流程結果」仍pending，不列為該次首次驗證的前提；只能執行已核准受控驗證，不開一般真人試用 |
| 完整交付／一般真人試用評估 | 所有必要本機與CI檢查及受控真實完整流程證據均通過；G-QUALITY完整成立；另核准試用安排 | 不以flags=true、文件核准或合成通過取代任何證據；不等於正式上線許可 |

以機器可判定的`synthetic_ready`、`controlled_integration_authorized`、`delivery_verified`分開記錄非個人readiness，無法讀取則blocked。測試需證明：缺首次真實結果但其餘嚴格前提與單次授權齊備時只允許受控驗證；缺任一隱私／平台／授權時仍拒絕；尚未真實驗證永遠不能delivery_verified。

## IR-02 — Temporary Tablespace Restart Contract

[IR]R-02的擬修正保留PGDATA、不回落磁碟暫存，不以刪整個DB逃避重啟：
- 每次PG容器啟動都由固定PG OS UID的bootstrap在postmaster接收應用連線前驗證tmpfs掛載、canonical path、空間及目錄mode／UID；Compose提供正確uid/gid掛載，不能用privileged或host改權作捷徑。
- 首次隔離初始化用migration／bootstrap角色建立專用temp tablespace，記錄不含個資的OID、canonical tmpfs路徑與匹配PG17 binary／catalog-version目錄規格。PGDATA非空時檢查既有pg_tblspc symlink與這份allowlist，拒絕指向未核准路徑。
- 保留PGDATA而tmpfs清空時，僅重建受核准temp tablespace所需的版本目錄／pgsql_tmp與權限；先比對PG主版及catalog版本，不能猜版本或重建一般資料表目錄。角色／OID核對需啟動PG時，先用隔離bootstrap存取、app連線保持封鎖，檢查通過才放行。
- 專用tablespace只能承接暫存：migration擁有持久表，app不是表owner、無schema CREATE／DDL，撤銷public TEMP，僅授必要temp tablespace存取；不允許把持久table／index移進tmpfs。所需權限以PG17實測，不能因tmpfs溢出而給superuser。
- 逐line_event_app與privacy_app以受控合成資料實際強迫sort spill，確認檔案落指定tmpfs；驗quota滿時受控失敗、PGDATA無fallback。入口健康核對包括兩角色結果，而非只讀SHOW。
- 測試必須以同一PGDATA執行「初始化→寫入合法合成歷史→停PG容器→重建使tmpfs全失→再啟動→兩角色spill與滿額測試」，核對既有歷史／刪除屏障／due不變、未知session與安全狀態按[N]處置。版本／symlink／UID錯誤時拒絕啟動；不能改成清空DB重建後回報成功。

## Quality and External Blockers

- 有效基準是[N] LC-03 CHG-01／02／04／05及[I] I-03精確WF／BR對照：十秒啟動截止／晚commit unknown、原子頁核准與單次一秒發送、24h線上主表移除／底層殘留可能超一年。不得重新宣稱舊全媒體清除或實際LINE送出原子保證。
- Google Places API(New)仍非已選合法來源；公開條款／20筆上限／必要資料涵蓋／attribution／政策承載與費用未通過之前，真實provider路徑只返回rights_unverified／保持關閉，不能用fake當正式實作已完成。若找不到符合既定規則的來源，回報人類取捨，不縮圈、改排序或自行加網站。
- Test harness fake只用合成profile；真人profile拒絕fake資料、fault注入與未驗證flags。缺外部授權／平台保護時保持真實路徑blocked，未完成真實provider或交付証據明列，不用stub冒成功。
- 必要測試、80%、負載、秘密／依賴／SAST不可降低；20測試身分不是實際招募許可。Docker／依賴／CI／掃描需環境授權後執行，沒有工具不能把nonzero當預期而忽略。
- 本階段以新的Plan Approval確認IR-01／IR-02的下游方案；上游Infrastructure review仍保留New，實作／測試與後續獨立審查才可支持修正有效，不能以計畫文字關閉。

## Requirement-to-Step Traceability

| 上游需求群 | 計畫步驟 | 業務規則／關鍵測試 |
| --- | --- | --- |
| FR1／FR1.1–FR1.3 | 5–6、11–12、17 | BR1.1–BR1.3，入口、時效、去重 |
| FR2／FR2.1–FR2.3 | 7–8、11–14、17 | BR2.1–BR2.3，先告知、未知停外傳、不保存仍推薦 |
| FR3／FR3.1–FR3.3 | 9–10、13–14、17 | BR3.1–BR3.5，WGS84、衝突／排序與標示 |
| FR4／FR4.1–FR4.3 | 5–6、9–14、17 | BR4.1–BR4.3，結果／保存／LINE分開 |
| FR5／FR5.1–FR5.3 | 3–8、17 | BR5.1–BR5.3，七欄、唯一性、曆年／閏日 |
| FR6 | 7–8、13–14、17 | BR6.1–BR6.3，本人keyset與v2輸出 |
| FR7／FR7.1–FR7.3 | 5–8、13–14、17 | BR7.1–BR7.4，固定scope、確認／取消／清除真狀態 |
| FR8 | 5–8、13–14、17 | BR8.1–BR8.2，撤回／重新同意不回填 |
| FR9／FR9.1–FR9.3 | 3–8、15–17 | BR9.1–BR9.3，到期／主表清除／不復活 |
| NFR1.1–NFR1.9、NFR2.1–NFR2.8 | 3–6、9–17 | BR10.1，時間／容量／故障交錯 |
| NFR3.1–NFR3.5、NFR4.1–NFR4.9 | 3–8、11–19 | BR10.2–BR10.4，本人／平台／各類TTL |
| NFR5.1–NFR5.5、NFR6.1–NFR6.3、NFR7.1–NFR7.2 | 9–17、20–22 | BR10.2–BR10.4，觀測／來源前提／繁中LINE |
| NFR8.1–NFR8.4、NFR9.1–NFR9.5 | 1–22 | BR10.5，逐層證據／80%／CI／外部授權 |

來源沒有獨立AC編號／User Stories，不自行發明；生成後traceability從實際FR、BR及NFRx.y抽取，逐ID指向存在的workspace程式或測試。表格是計畫覆蓋，不是已完成實作／測試。

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "每個可測層實作後立即撰寫並執行該層測試；相依邊界一旦可連接，即完成其整合測試，再擴充下一段功能，最後執行完整流程驗證。",
  "scope": "line-lunch-decision-bot",
  "test_strategy": "standard",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: 每個可測層實作後立即撰寫並執行該層測試；相依邊界一旦可連接，即完成其整合測試，再擴充下一段功能，最後執行完整流程驗證。\n\n上述方法與順序由 Q3 採用。我們保留 `Standard` 的單元及關鍵邊界整合測試；每元件約 5–8 個測試僅為軟性規劃指引，數量及比例不能排除必要行為、隱私或生命週期案例。[Q3][Q4][W1][F3]\n\n- **行覆蓋率**：我們新增至少 **80%** 的應用可測原始碼行覆蓋率底線，分母包含未被測試載入的應用原始碼；排除依賴、產生碼、AI-DLC 框架及測試本身，排除清單須可審查。這是 Q4 對本自訂 scope 的新採用要求，不是由 Standard 自動推導，也不代表已達標；不得為通過檢查而降低。[Q4][memory:M1]\n- **合併前 CI**：我們執行適用建置、格式、lint、單元與關鍵整合測試並檢查覆蓋率；必要檢查失敗、未執行或未達門檻時不能視為通過或合併。既有 org 明文要求 lint 在合併前 CI 執行且失敗阻擋 PR；**格式檢查門檻是 Q4 新採用**，初稿的來源歸類已修正。平台、工具、命令與報告位置留待選定。[Q4][memory:M1]\n- **推薦與入口**：我們驗證私訊／群組及無效輸入界線、一公里範圍、候選不足／重複、未知／休息／停業狀態，以及外部故障不得冒充無結果或成功；名稱、理由與地圖須對應實際候選。[P2 SCP-01–SCP-03、SCP-08–SCP-09][QLT]\n- **同意與本人權利**：我們驗證未同意仍可推薦且不新增歷史、同意後本人查閱、撤回後停止新增，以及跨人查閱／單筆刪除／全部刪除均被拒絕；來源驗證不能取代本人授權。刪除確認涵蓋範圍、取消、重複與過期情境，其有效期及具體行為留待需求明訂。[Q4][P2 SCP-04–SCP-08][QLT]\n- **生命週期交錯**：我們驗證重送與併發不重複建檔、撤回／刪除與在途查詢或延遲事件交錯、每筆一年獨立起算、到期前／當下／之後、清除失敗及必要復原；新查詢不延長舊紀錄，已刪或到期資料不重新可見。以受控時間測試一年邊界，讀取不可見與實體清除完成分別驗證；曆年／時區／閏日算法、生效切點與時限仍待需求化。[Q4][P2 SCP-07–SCP-09][QLT]\n- **證據與完整流程**：我們在日常測試使用合成資料與受控供應方回應，檢查一般診斷及失敗路徑不形成替代位置歷史；授權後另保留真實 LINE → 資料來源 → 回覆及本人歷史管理的可重現證據。覆蓋率、模擬成功或安全掃描都不能取代上述關鍵案例與真實串接；未驗證者如實標示。[Q4][P2 SCP-08–SCP-09]\n- **安全檢查**：我們納入秘密、依賴與適用的 SAST 原始碼安全檢查；確認有效的外洩憑證及已確認 Critical／High 風險在處置前阻擋合併。必要掃描失敗或未執行不能算通過；誤報與限期例外由提出者檢視依據另行決定，不能取消既有隱私保護。掃描工具、適用性、判讀規則、修補及例外期限待設計，不把工具不存在或掃描涵蓋為零當通過。[Q7][SEC]"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:b0dbecde1d7e0b8fb8b774ae0e5b0cedc01eac04a0a232c8609894a3a787379a",
  "contract_sha256": "sha256:c5dec7fa39fd4eda2b6ded095f4b0fffbf47913be5a50f6db66e2f5003d03b7c"
}
```
