# U1 推薦 MVP 測試與執行指引

## Scope and Readiness

唯一目標 `u1-lunch-bot`，沿用已安裝 Node 24、鎖版依賴、Vitest projects 與 safe reporter。原 runner 已有成功證據；下面新增 MVP 檔案尚未存在／未執行，不能把命令清單當通過結果。

依 `mvp-scope-adjustment.md`，推薦切片不需要 PG／Compose／Lima。保留所有既有 infra／DB 測試與失敗紀錄，但本 MVP 精確 selectors 不啟動它們；這不是略過原完整版本義務。原指引的完整快照在 `history/pre-mvp/unit-test-instructions.md`。

Testing Contract 不變：每個可測層先實作、立即寫跑測試，相依可接即整合；含未載入檔案的全部 `src/**/*.ts` 行覆蓋率至少 80%。沒有 DB／repository 或獨立 Web UI 層；LINE 使用者互動仍要驗證。

## Exact Commands

workspace 根目錄執行。現有 package scripts 接受以下 project／完整檔案 selectors；測試缺檔、零測試、失敗一律 nonzero，不改門檻。靜態工具的應用 scope 由現有設定限定，勿把 `--unit` 傳給 tsc。

| 時點 | 精確命令 |
| --- | --- |
| Runner 必要時確認，不重建 | `npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/runner.test.ts` |
| Step 4 推薦／來源 | `npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/lunch-recommendation.test.ts tests/u1-lunch-bot/unit/restaurant-source-adapter.test.ts` |
| Step 4 HTTP 邊界 | `npm run test:integration -- --project u1-lunch-bot-integration tests/u1-lunch-bot/integration/source-boundary.test.ts` |
| Step 6 LINE 核心 | `npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/line-interaction.test.ts` |
| Step 6 Webhook／reply | `npm run test:integration -- --project u1-lunch-bot-integration tests/u1-lunch-bot/integration/webhook.test.ts tests/u1-lunch-bot/integration/line-reply.test.ts` |
| Step 8 訊息 | `npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/messages.test.ts` |
| Step 8 合成完整流程 | `npm run test:e2e -- --project u1-lunch-bot-e2e tests/u1-lunch-bot/e2e/lunch-bot.test.ts` |
| Step 9 既有與新增單元回歸 | `npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/` |
| Step 9 全應用 MVP coverage | `npm run test:coverage -- --project u1-lunch-bot-unit --project u1-lunch-bot-integration --project u1-lunch-bot-e2e tests/u1-lunch-bot/unit/lunch-recommendation.test.ts tests/u1-lunch-bot/unit/restaurant-source-adapter.test.ts tests/u1-lunch-bot/unit/line-interaction.test.ts tests/u1-lunch-bot/unit/messages.test.ts tests/u1-lunch-bot/integration/source-boundary.test.ts tests/u1-lunch-bot/integration/webhook.test.ts tests/u1-lunch-bot/integration/line-reply.test.ts tests/u1-lunch-bot/e2e/lunch-bot.test.ts` |
| Step 9 build／types | `npm run build`；`npm run typecheck` |
| Step 9 lint／format | `npm run lint`；`npm run format:check` |

最後兩列每個命令各自執行並核對 exit code。Coverage 仍使用現有 `include: ['src/**/*.ts']`、空 exclude 與 lines 80；指定測試檔不得縮小應用分母，未 import 的應用檔仍列入。非關鍵極端組合不新增 exhaustive suite；每元件保留 happy path 與至少兩種錯誤／邊界，約 5–8 案例是軟性規劃。

## Required Cases

| 測試檔 | 必要行為 |
| --- | --- |
| `unit/lunch-recommendation.test.ts` | 未四捨五入一公里前／當下／後、有效座標、去重、open／unknown／closed、穩定排序、0／1／2／3 家，不捏造理由或地圖 |
| `unit/restaurant-source-adapter.test.ts` | 可信固定 endpoint、必要欄位／型別、來源標示、結果上限語意、格式錯誤與空清單分開；合成／真實設定隔離 |
| `integration/source-boundary.test.ts` | mock HTTP 成功／錯誤／timeout／malformed／oversize，必要欄位缺少、取消與安全錯誤；無未授權真實網路呼叫 |
| `unit/line-interaction.test.ts` | 私訊／群組、位置合法性、事件有效期、告知未確認零外傳／重傳、短期控制有界／到期、重送只處理一次 |
| `integration/webhook.test.ts` | 真實 Fastify 原始 bytes 驗簽正反例、body tamper／invalid JSON／size、健康狀態、不支援事件、合法串接、受控失敗 |
| `integration/line-reply.test.ts` | LINE reply request／token 正確放 header/body、接受／拒絕／unknown／timeout；不盲重試、不改 push、不洩漏錯誤本文 |
| `unit/messages.test.ts` | 繁中引導／quick reply、實際數量／unknown／故障／未提供歷史、名稱／地圖／必要 attribution 與 LINE 文字長度界線 |
| `e2e/lunch-bot.test.ts` | 合成身分從告知確認、重傳位置、來源到 reply；一個必要故障出口；位置／user ID／token／秘密 canary 不進輸出，明示 synthetic |

API 是否實际接受回覆與使用者裝置是否顯示分開。檢查的是實際 outgoing request／回傳狀態，不以 helper 呼叫次數冒充真實 LINE 成功。

## Fixtures and Safety

只用合成座標、身分與假秘密，mock 外部 fetch／HTTP transport、控制時間與取消；integration 驗證真實 app／adapter 邊界，並非 mock 整個產品。新測試不 import 舊 DB phase，不啟動容器、不載入其他 Bot 的憑證。不得在一般 log、assert diff／report 中回印敏感 canary；沿用安全 reporter。

當次未告知位置不得存入 session；測試證明不呼叫來源且需重傳。告知狀態與去重只保留必要短期非位置控制資訊，測試到期／容量／重啟失效；不承諾持久防重送。取消、逾時、錯誤後不保留位置本文／provider response 參照供後續查詢。

## Demo, Live and Merge Evidence

- 本機展示命令由 Step 7 建立：`npm run dev` 用明確 demo 設定；`npm start` 啟動 build 產物。demo 不需 DB 或真實 secret；live 必須有有效安全設定及已確認來源，不能以 demo 替換 live 失敗。
- Step 8 的 E2E 是可重現自動化展示證據，不是已批准的真實 Construction Verification Command，也不等同真實 LINE 連線。
- Step 11 的真實驗證，在使用者提供安全環境設定、合法來源、入口及必要費用授權後，才記錄確切命令／點擊步驟與停止條件。不把 secret 貼到對話，不自动開付費或平台資源。
- 建置／型別／lint／format、80% 與核心案例需真結果。秘密／依賴／適用 SAST 及 hosted CI 的工具、命令與結果在相應交接列明；未做不能記 pass，合併前仍須補齊。這些狀態不觸發新的底層診斷。
- 歷史、PG／IR-02、重型負載與原完整版本的測試列為延後，非通過；不刪測試、不加 skip 偷改原結果。各項以 `known-limitations.md` 的範圍／重新啟動條件為準。
