# U1 CI/CD 流程設計

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

## C-01 — Platform and Trust Boundary

本輪採GitHub Actions為CI設計目標，不是建立repository／上傳／push／執行Actions的許可。[Q]取代[O]原「CI provider尚未選」的未定狀態，其餘安全與品質基準不變。現在不產生完整workflow、安裝工具、建image或執行掃描。

| 面向 | 設計規則 | 必要證據／門檻 |
| --- | --- | --- |
| 觸發 | 日後經核准repository的pull_request及main push；只跑CI、不deploy；不以paths filter漏掉必要檢查 | 必要check在每個待合併commit有結果；queued／cancelled／skipped／timeout不是pass |
| Runner | 合成資料用一次性隔離GitHub-hosted Linux runner；OS image版本、CPU架構及實際資源記錄；不讓PR用維護人主機／長駐self-hosted runner | 帳號、可見性、runner額度與費用另確認；hosted label不是固定image digest，需記實際image版本並依相容性驗證 |
| 工具固定 | Node24／PG17／Compose v2的精確patch、base image digest、npm lockfile及Actions完整commit SHA放版本清單；本機同工具／命令 | Code Plan鎖版及查支援期／授權／來源；缺任一不能稱可重現。不用latest、浮動major action tag或未查核curl-pipe-shell |
| 權限 | workflow及job只需contents:read；其餘權限none，checkout不持久化憑證；無id-token、packages:write、release或部署secret | 禁止pull_request_target配PR checkout／執行；workflow_run等高權流程不取未信任artifact來执行；PR不可碰真人憑證或歷史 |
| 依賴／網路 | 經核准來源取得鎖版依賴／公開工具與漏洞DB，測試時真實LINE／來源出口關閉 | 沒有外部code scan SaaS、遠端telemetry、npm audit上傳依賴清單替代離線scan；若工具做不到先回報，不能當pass |
| Cache | 第一版不使用共享PR cache、DB dump cache或build cache artifact；每次乾淨安裝／DB | 不跨信任層重用可執行內容；若未來要加cache另設隔離與TTL，不能先以速度為由持久化payload |
| 必要check保護 | 一個aggregate required-check依賴所有必需job，任何未執行／失敗／未達標均nonzero；branch protection／ruleset另設並驗證 | 修改workflow／gate／coverage排除／scan規則／供應鏈pin需授權維護人檢查；不由PR自報success繞過門檻，平台方案不支持時不能假稱有合併保護 |
| 取消與期限 | 同PR可取消舊commit檢查但不把舊通過當新commit證據；job有有限timeout（起點30分鐘） | 超時是失敗／未完成，不放寬測試或原業務deadline；負載較大需調整經核准runner而非減少300筆 |
| Checkout內容 | 程式、必要測試／設定及經確認文件才上傳repository；runtime secret、個資、原始scan、DB／dump／本機配置排除 | 實際上傳內容與可見性須人確認；不把「採GitHub Actions」當公開全部workspace許可 |

## C-02 — Build Stages and Gates

下列npm script名稱是**待Code Plan實現的命令契約**，目前沒有可執行證據；安全工具底層參數與版本亦待查核，不捏造離線flags。每個可測層遵循test-after：實作→該層單元測試→相依可連接即整合，最後全流程；不能全部寫完才補smoke tests。

| 順序／stage | 本機及CI相同入口 | 內容／環境 | Gate |
| --- | --- | --- | --- |
| 1 preflight | 待實現的版本／設定核對入口 | checkout commit、工具／image manifest、lockfile、runtime資源、無正式secret／真實出口；只用run-specific合成volume | 欠固定版本、權限／TLS／tmpfs／設定失敗即停止；不自己安裝缺工具 |
| 2 dependencies | npm ci | 鎖定直接與間接依賴、可信來源；先無lifecycle scripts取依賴，需script者經審查白名單在無秘密隔離環境執行 | lockfile不一致或未核准script不可執行；不靜默改lockfile求通過 |
| 3 static | npm run format:check；npm run lint；npm run typecheck；npm run build | Prettier／ESLint／TypeScript全應用輸入；build不啟動外部服務 | 任一錯誤nonzero，不自動fix後隱藏diff |
| 4 unit | npm run test:unit | Vitest、可注入clock／fake provider／fake LINE；每模組happy path＋至少兩個錯誤／邊界 | 需求案例缺漏／零測試／失敗不可通過 |
| 5 integration | npm run test:integration | 與本機相同Compose Bot＋PG17，TLS、受限roles、真實交易／唯一性；需要時兩Bot程序共享原總pool限額 | 安全不變量、schema拒絕、unknown／restart／清除／能力交錯都必測；不以記憶體DB代替PG結果 |
| 6 coverage | npm run test:coverage | unit＋integration完整收集／合併同commit數據；未載入應用來源納入分母，產生可審查include／exclude | lines≥80%；只排依賴、產生碼、框架、測試本身；缺report／零涵蓋／未達標必失敗 |
| 7 performance | npm run test:performance | 合成20身分、開迴路1q/s×300秒，另5同時；正常／不足／零／來源故障／保存unknown分列，量資源與替身延遲 | ACKp95≤1s、LINE接受p95≤5s；無回覆計超標。壓力runner失敗不能宣稱產品達標 |
| 8 security | npm run security:secrets；npm run security:dependencies；npm run security:sast | Gitleaks／OSV-Scanner本機DB模式／Semgrep本機固定規則，版本／涵蓋實測見C-03 | 工具缺／未跑／零涵蓋／DB過期／scan錯誤阻擋；確定有效洩漏secret及Critical／High未處置不能合併 |
| 9 evidence | 待實現的安全報告整理入口 | 只白名單統計、版本、規則、必要檔案／行號／severity與安全摘要，合成／真實結果分列 | canary／禁止欄位出現即不發布該附件，保留安全失敗狀態，不能上傳原始dump |
| 10 aggregate | required-check | 驗同commit各必要job及門檻，永遠執行來判失敗／取消／未執行 | 只有所有必要項都真通過才能success；真實整合未驗證不得記全版本完成 |
| 11 cleanup | 逐run資源清理入口 | 成功、失敗、取消皆清本次合成volume、測試CA／secret、tmpfs、網路／容器；runner銷毀作後盾 | 不用全機prune／不碰既有資料；清理失敗記非敏感錯誤，不能掩蓋原job失敗 |

CG要把script落地、命令與參數、各退出碼、資料出口及可重現步驟寫入README／測試說明。以上不是現在獲准執行的Construction Verification Command；該命令仍按流程另選，不能以npm列表取代人類確認。

## C-03 — Test and Security Integration

| 驗證群組 | 核心案例／資料 | 不得省略的判定 |
| --- | --- | --- |
| 入口／推薦 | 原始bytes簽章、重複header、destination、私訊、事件前24h／後5min、群組拒絕；WGS84一公里／3家／去重衝突／未知優先序 | 未驗簽零副作用，故障不當零結果；適用[C01–C07]及F完整驗證群 |
| 同意／本人 | unknown settings不外傳、已知no_save仍推薦、現行notice、ref15min／confirm5min、跨人全操作 | ref不是bearer auth，撤回／再同意不回填，七欄歷史、UTC一年／閏日、5筆keyset頁 |
| 交易／DB | [L] T-COMMIT-01–03；獨立連線／程序、COMMIT ACK失、late commit、撤回／刪除共同鎖、unknown token隔離 | 10秒截止為啟動而非完成，unknown不重INSERT／盲回覆，原expiry／due不改；錯role／TLS拒絕 |
| 歷史頁輸出 | T-OUTPUT-01–04：完整頁授權、失鎖／部分結果、前後刪除／expiry、超1秒、錯context／頁、二次consume、重啟、v1降級 | 未核准不可送；核准後允許原單則資格內啟動且不聲稱召回；同步consume→transport不可另await |
| 清除／殘留 | T-CLEAN-01–03、T-RESIDUAL-01；固定scope／cutoff、主表直接核對、24h邊界、7天控制回收／隔離／重啟 | online_removed只表示主表移除＋防復活，不能用查閱API空頁當證據，不要求已放棄的全媒體抹除；I-03精確對照一併驗 |
| 觀測／資源 | T-POOL-01全100次checkout恰100ms逾時；disk滿、tmpfs滿、通知失敗、敏感canary、29／30天期限 | timeout計數與≥80ms規則可警示；失敗樣本全納入，告警失敗不遮清除失敗 |
| secrets | Gitleaks鎖版本機掃描適用應用／配置／待合併變更與核准歷史範圍；命中先於證據上傳 | redaction不信任為唯一保護；原始輸出放隔離tmpfs，不印匹配值，不由AI假定有效性或接受例外 |
| dependencies | OSV-Scanner選能本機DB比對且不外傳dependency清單的受支持版本；涵蓋npm lockfile及需審查的runtime image／OS套件清單 | 新鮮度設計上限24h，記資料來源／時間／digest；不支持或image涵蓋不全如實阻擋／補核准工具，不以npm audit替代 |
| SAST | Semgrep本機規則集pin hash、TypeScript／JavaScript適用規則與fixture，telemetry關閉並測出口 | 全應用src及相關設定涵蓋，規則零結果不等同零涵蓋；未分析／parser失敗須顯示且阻擋必要涵蓋 |
| findings | 確認有效外洩secret／Critical／High先處置；其他風險列明 | 誤報及限期例外由提出者看證據另決，記ID／依據／owner／到期；過期再次阻擋，不可取消隱私保護 |
| DAST／真實完整流程 | 不在預設PR job；僅於另准受控環境、目標、流量／費用／停止條件具備後 | 不掃LINE／餐廳；真LINE→來源→推薦及本人查閱／撤回／刪除／到期另留受限安全證據。合成通過不等於真實通過 |

## C-04 — Artifacts, Secrets and Retention

| 對象 | 處置 | 失敗／授權邊界 |
| --- | --- | --- |
| 正式secret | GitHub CI一律不提供LINE token、provider key、subject／event HMAC或真人DB憑證；也不使用pull_request_target取secret | 無正式secret不是任意外傳程式許可；runner／repo還要人核准 |
| 合成secret／證書 | 逐run產生，tmpfs／受限檔案注入；不放workflow文字、shell trace、image layer或artifacts | 假秘密也不在報告當成功示例回印；逐run清理，不變成共用production credentials |
| 原始測試／scan輸出 | 測試框架和scan先在隔離tmpfs收集，trusted wrapper只印白名單摘要；關閉debug／set -x／HTTP debug，任意assert diff不可直接tee到Actions log | 信任邊界是無真人資料／秘密；filter不是執行惡意PR時的DLP保證。找到真秘密先停止／限制證據，不聲稱能從已公開log收回 |
| 報告 | 預設只發布安全摘要／coverage統計／測試計數／scan統計與版本，無source snippets、命中原文或位置 | 無外部scan SaaS；任何上傳需repository及內容授權，公開repo對安全報告的暴露另審查 |
| 保存 | GitHub job logs與artifacts設14天，仍受全體證據最多30天上限；本機安全檔依M-04；無cache | 實際帳號方案、log與artifact政策及可控副本刪除需驗證；不能只設retention-days便宣稱所有渠道已清除 |
| Runtime image | build可在當次runner驗證，但不push registry、不release，不封入.env、DB、問答機密／診斷或runtime secret | 後續若需發布image另核准registry／存取／費用；本輪沒有部署artifact的外部保存承諾 |
| 設計／應用版控 | 正常保留設計與程式版本供追溯，不是運行診斷 | 仍不可版控秘密／真人位置或把30天診斷混入Git永久歷史 |

## C-05 — Deployment, Promotion and Rollback

| 步驟 | 本輪策略 | 安全條件 |
| --- | --- | --- |
| 本機合成部署 | 人另准環境後，以固定manifest建置Compose；遷移由隔離一次性角色執行，通過啟動檢查才開合成入口 | 同版四元件、PG角色／TLS／timeout及v2 schema；不把migration憑證交runtime |
| CI合成部署 | 相同拓撲／設定／命令，fake adapters與假秘密；啟動後健康检查及全部必要tests | 外部provider／history真人flags=false，假API及fault注入只可由test profile裝配；真人profile拒絕fake／debug配置 |
| 環境promotion | 沒有自動staging或production；CI綠燈只代表此commit適用檢查通過 | 人另准資源、所在地、維護、TLS／主機證據、條款／費用與全部G-*後才設真人非正式驗證；Operation仍不在本輪 |
| Feature controls | REAL_PROVIDER_ENABLED=false、REAL_HISTORY_ENABLED=false，啟用需同版能力與G-*證據一併成立 | flag不是產品功能增減的捷徑；已知no_save仍可推薦，unknown設定停止外傳；不能繞過告知與本人權利 |
| App rollback | 停新輸入，等原deadline／安全結束，回到最後已驗證且同privacy:v2、reply-history:v2、schema相容的image digest | 不重播payload、不重新reply、不以回滾重建已刪資料；若無相容版本就保持停用並修正向前 |
| DB migration／rollback | 合成可清本run DB重建以驗可重現；真人沒有自動down migration／snapshot restore | 既有真人資料若被發現先停，不在本輪自行遷移；未来schema變更需權利、不可復活及資料保護方案另核准 |
| 失敗／災損 | 保留安全失敗證據、unknown與原due，不用備份恢復換可用率 | 無歷史backup／HA，不能承諾RPO／RTO；清除24h違約仍需處理與揭露，不因停機重算 |

## C-06 — Completion Evidence and Handoff

Code Generation需同時讀[L] LC-03／LC-06與infrastructure-specification.md I-03，不直接從凍結v1生成舊physically_absent／complete、十秒提交生效或實際LINE送出排序的承諾。計畫明列可執行v2型別／schema、受限維護、主機preflight、全部必要測試、CI命令、版本manifest、授權與未就緒清單。

「設計已完成」只表示這三份規格及traceability可供實作；「CI已接線」需實際核准repository／runner檢查；「版本已交付」還要既定完整真實流程及資料保護證據。這三者不可互換。沒跑應用build、test、security、load或真實串接，不記為pass。

## Assumptions & Open Questions

GitHub Actions平台選擇已確認，不重新詢問。精確工具／image／action版本、runner與repo可見性／存取方案、實際上傳內容／成本、漏洞DB來源授權及全部真人前條件仍待證據／執行授權，未就緒項維持明示。若無法以可取得工具達到離線scan、必要CI或平台保護，停止回報；不能改走未授權SaaS或靜默降低門檻。
