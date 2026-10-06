# U1 單元測試與驗證指引

## Scope and Prerequisites

唯一目標為`u1-lunch-bot`，workspace根目錄執行；指令是Code Plan必須實現的契約，**目前尚未有package.json、依賴、測試或已通過結果**。先取得Approve Plan，再依需要確認Node24、PG17／Compose v2、鎖版依賴／安全工具的安裝、下載、容器資源及執行授權。缺工具時停止，不以空suite或in-memory PG替代。

按`code-generation-plan.md`完整Testing Contract實行test-after：每層實作後寫並跑該層測試，相依可接即整合，再擴充下一層。至少80%全應用行覆蓋率（含未載入來源）；每元件5–8案例為規劃起點，安全／交錯必要案例不設上限。沒有Web前端；LINE文字／quick reply仍需完整行為驗證。

`vitest.config.ts`配置具精確名稱的projects：u1-lunch-bot-unit、u1-lunch-bot-integration、u1-lunch-bot-e2e、u1-lunch-bot-performance。include限定對應`tests/u1-lunch-bot/`子目錄，不抓其他Unit／框架測試。coverage另由U1全部app來源決定，不因指定單一test而縮小分母。

## Runner Readiness and Exact Commands

下列路徑由計畫生成後才存在；所有命令只執行本Unit。package scripts傳遞Vitest CLI參數，不能吞掉project／file selector。

| 使用時點 | 精確命令 | 通過條件 |
| --- | --- | --- |
| Step2第一次測試前 | `npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/runner.test.ts` | 實際載入Vitest／TS設定與合成clock helper，驗證前進／固定UTC及錯誤輸入；不是assert(true)。command缺失、零測試、未能執行不可進入下一測試步驟 |
| 本Unit單元測試 | `npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/` | 本Unit各owner與安全工具案例通過；不得誤納框架或別Unit |
| 本UnitPG／HTTP整合 | `npm run test:integration -- --project u1-lunch-bot-integration tests/u1-lunch-bot/integration/` | 授權下隔離Compose＋實際PG17／TLS／roles；fake DB只能用於單元故障設置，不替代整合 |
| 本Unit合成全流程 | `npm run test:e2e -- --project u1-lunch-bot-e2e tests/u1-lunch-bot/e2e/` | fake LINE／來源＋真实受限PG、合成身分；本人選擇／推薦／歷史／撤回／刪除／到期完整 |
| 本Unit完整coverage | `npm run test:coverage -- --project u1-lunch-bot-unit --project u1-lunch-bot-integration tests/u1-lunch-bot/` | 完整單元＋關鍵整合覆蓋同commit，lines≥80%，缺報告／未載入來源被漏掉即失敗 |
| 本Unitperformance | `npm run test:performance -- --project u1-lunch-bot-performance tests/u1-lunch-bot/performance/` | 20合成身分1q/s×300秒及另5同時；ACKp95≤1s、LINE接受p95≤5s，正常／故障各列 |
| 本Unitbuild／格式／lint／typecheck | `node scripts/u1-lunch-bot/quality.mjs --unit u1-lunch-bot --check static` | 受限wrapper依固定本Unitapp檔案清單執行四項；不把--unit錯傳給tsc／eslint，任何失敗nonzero |
| 本Unit安全檢查 | `node scripts/u1-lunch-bot/security.mjs --unit u1-lunch-bot --check all` | 秘密／依賴／SAST及必要runtime image涵蓋皆有新鮮可核對結果，未安裝／DB過期／零涵蓋不過 |
| 本Unit完整本機品質 | `node scripts/u1-lunch-bot/verify.mjs --unit u1-lunch-bot --profile synthetic` | 呼叫相同鎖版命令及精確Unit selectors、保留每項結果；任一必要項missing／failed／skipped／cancelled不可pass |

最後一列不是已批准的Construction Verification Command，也不證明真實LINE結果；該命令依流程另選，不能拿synthetic成功冒充真實端到端。此文件不提供可盲跑的真人命令；受控真實驗證需計畫IR-01的另外授權與入口證據，才產生確切限定命令、費用／流量／停止條件。

## Layer-by-Layer Test Files

每對實作／測試步驟完成後立即跑對應精確檔案；檔案未生成不得換成不相關通過suite。

| 計畫步驟 | 預計測試檔案（workspace相對） | 必要範圍 |
| --- | --- | --- |
| 3→4 | `tests/u1-lunch-bot/integration/schema.test.ts`、`tests/u1-lunch-bot/integration/postgres-runtime.test.ts` | 七欄schema、roles／TLS、持久PGDATA＋清空tmpfs重啟／兩角色spill／滿額／無fallback；migration非app owner |
| 5→6 | `tests/u1-lunch-bot/integration/repositories.test.ts`、`tests/u1-lunch-bot/integration/commit-order.test.ts` | 唯一claim、兩程序subject鎖與順序、late COMMIT、unknown及quarantined slot／PID重用 |
| 7→8 | `tests/u1-lunch-bot/unit/data-privacy.test.ts`、`tests/u1-lunch-bot/integration/privacy-lifecycle.test.ts`、`tests/u1-lunch-bot/integration/cleanup.test.ts` | no_save／unknown、本人／cross-user、notice版本、UTC曆年／閏日、15min／5min、固定scope、24h主表實刪／7天隔離／不復活 |
| 9→10 | `tests/u1-lunch-bot/unit/lunch-recommendation.test.ts`、`tests/u1-lunch-bot/unit/restaurant-source-adapter.test.ts`、`tests/u1-lunch-bot/integration/source-boundary.test.ts` | WGS84橢球≤1000m、衝突／去重／排序、理由／地圖／標示、完整必要來源、retry0／deadline／malformed |
| 11→12 | `tests/u1-lunch-bot/unit/line-interaction.test.ts`、`tests/u1-lunch-bot/integration/webhook.test.ts` | raw驗簽、JSON／header重複拒絕、時效／group／混合event、C01 HTTP、20slots／ACK後常駐、無持久payload |
| 13→14 | `tests/u1-lunch-bot/unit/messages.test.ts`、`tests/u1-lunch-bot/integration/history-output.test.ts`、`tests/u1-lunch-bot/integration/line-reply.test.ts` | 繁中／臺北時間／UTF16、1–5則／quick reply≤13、single-use transport、v2／不可變頁／1秒能力／expiry順序 |
| 15→16 | `tests/u1-lunch-bot/unit/observability.test.ts`、`tests/u1-lunch-bot/integration/readiness.test.ts`、`tests/u1-lunch-bot/integration/maintenance.test.ts` | 白名單／TTL／disk滿、pool全失敗、通知失敗、IR-01無循環入口但不開試用、主機證據／clock失敗阻擋 |
| 17 | `tests/u1-lunch-bot/e2e/lunch-bot.test.ts`、`tests/u1-lunch-bot/performance/load.test.ts` | 全Acceptance Coverage及LC-06、300筆及5同時、可回覆未回覆視超標 |
| 18→19 | `tests/u1-lunch-bot/unit/security-wrapper.test.ts`、`tests/u1-lunch-bot/unit/ci-policy.test.ts` | tool缺／舊DB／零涵蓋／nonzero、報告不含命中值、PR正式秘密隔離、skip／cancel不能success |

單檔命令採第一節相同script與project，把檔案selector換成本表**一個完整路徑**；例如repository單檔用`npm run test:integration -- --project u1-lunch-bot-integration tests/u1-lunch-bot/integration/repositories.test.ts`。實作若需新增測試檔，必須仍在該Unit目錄且補進最終traceability；不得刪掉這些必要驗證群。

## Coverage and Assertions

- cover全部`src/**/*.ts`，包含未被載入的應用來源。只排依賴、產生碼、AI-DLC框架、測試本身；不能以複雜、未完成、runtime或adapter難測為由排掉。排除檔案／規則記在可審查設定。
- 全體lines至少80%，百分比不取代每模組happy path與至少兩個錯誤／邊界、每元件5–8起點或全部權利案例。局部開發命令不自稱全體coverage過關；最終命令缺integration時不過。
- CHG-02／04／05修訂生效：核准頁可單次在資格內啟動而晚送達；已合法啟動DB可晚完成；online_removed證明線上主表移除＋防復活，不宣稱全媒體抹除。測試必須驗新語意，不能用放棄的舊強保證製造假失敗，也不能刪剩餘保障。
- 兩程序共用role4／7及DB20總限制；不得將pool各複製11條。DB未知時不靠client close補slot或假rollback；所有必要LINE／DB故障result與回覆分開。
- 每次test／scan失敗回傳nonzero且提供白名單安全分類；缺工具／hosted CI／真人前置狀態如實未驗證，不視為預期pass。

## Mocking, Fixtures and Resource Cleanup

以合成位置／身分／假secret，runtime flags及test-only adapter injection隔離真LINE／真來源；預設無真人出口、無telemetry／scan上傳。不用既有其他Bot憑證，真正secret不放測試或shell輸出。可控UTC與單調clock分開，測毫秒相等、前後漂移、expiry／deadline及閏年。

unit可mock repository／transport；integration須用實際PG17、不同connection與受控SQL barrier／fault proxy模擬ACK失、suspend與重啟。tmpfs restart測試保留同一run PGDATA及原scope／due，不能清DB取巧。主表清除證據讀原表，不經expiry过滤API；只能用合成標記研究底層殘留。

run-specific volume／network／測試CA／secret／tmpfs均有owner標記。清理只動本run合成資源，不做全域prune、刪其他專案資料或真人DB；成功／失敗／取消都清理，清理失敗保留安全狀態。授權及平台不允許執行時停止，不私自用其他機器／付費runner。

## Safe Evidence

raw assert diff、HTTP本文／header／URL、SQL參數、scan命中原文與秘密只可在受控當次記憶體／tmpfs，不能直接tee進CI／普通log。對外只有固定suite／case ID、pass／fail／unknown、安全error類別、樣本數、時延／coverage／工具及規則版本；位置／raw ID／ref／secret canary測試不得回印canary。

本機安全證據依monitoring-design.md最長29天輪替／清理，GitHub logs與artifacts預設14天且核對實際方案，所有可控證據≤30天。驗保留期限／清理與離線故障，不把job artifact TTL當logs／cache全部已符合。合成與真實結果分列；未執行真實流程不標完整交付。
