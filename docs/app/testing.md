# U1 最小測試 Runner

## 範圍與前置

本文件說明已實作的 Step 2，不取代已核准計畫、Testing Contract 或 `unit-test-instructions.md`。從 workspace 根目錄執行，使用 `config/versions.json` 固定的 Node 24.18.0、npm 11.16.0、Vitest／coverage-v8 5.0.3 與既有鎖版依賴。依賴已經另外授權安裝，不要為重跑測試再下載工具或執行 lifecycle scripts。

此層只有合成 fixture／clock／fault harness，無 HTTP 服務、Docker／VM、真 PG、LINE 或餐廳來源呼叫，不使用其他 Bot 的秘密。未建立 `src/` 或業務元件；runner 成功不代表 Unit 功能或完整覆蓋率通過。

## 精確命令

第一次 smoke 及此層重現命令：

```sh
npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/runner.test.ts
```

實測 exit 0、36 passed／0 failed。只載入本檔，沒有框架或其他 Unit 的測試。`package.json` 的 `test:unit`、`test:integration`、`test:e2e`、`test:performance` 都直接使用 `vitest run`，`test:coverage` 使用 `vitest run --coverage`；額外 CLI 參數原樣傳遞。後續各層仍必須依核准指引使用完整 project／file selectors。

| Project                    | 唯一測試 include                              | 目前實作           |
| -------------------------- | --------------------------------------------- | ------------------ |
| `u1-lunch-bot-unit`        | `tests/u1-lunch-bot/unit/**/*.test.ts`        | `runner.test.ts`   |
| `u1-lunch-bot-integration` | `tests/u1-lunch-bot/integration/**/*.test.ts` | 尚未開始，不是通過 |
| `u1-lunch-bot-e2e`         | `tests/u1-lunch-bot/e2e/**/*.test.ts`         | 尚未開始，不是通過 |
| `u1-lunch-bot-performance` | `tests/u1-lunch-bot/performance/**/*.test.ts` | 尚未開始，不是通過 |

禁止空 suite 成功、`only`、watch 與自動 retry；單 worker、隔離測試檔且不並行。效能 project 預留 360 秒測試 timeout，並非已有負載測試；其他 project 每個測試 10 秒，hook 10 秒。測試 timeout 不會取代未來的業務 deadline／PG timeout。負載與 PG restart 的 fixture 成熟後仍須各自證明時限／清理。

## 合成工具與案例

先完成各 helper 實作，再加入下列測試並執行；沒有使用只會通過的空斷言。固定 case ID 的參數化測試以索引區分，不以位置、subject 或錯誤本文當標題。

| 案例群                     | 行為                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `RUNNER-CLOCK-01`–`07`     | 固定 UTC、前進／零毫秒、UTC 倒退／跳進與單調時間獨立、NaN／無限／小數／負 duration 拒絕、日期與安全整數溢位不部分更新、instance 隔離 |
| `RUNNER-SYNTHETIC-01`–`03` | 固定合成 UTC、20 個合成身分、深層凍結位置、拒絕非 synthetic profile 及非法序號                                                       |
| `RUNNER-FAULT-01`–`05`     | 依 boundary 單次消耗／有序故障、unknown 不轉成功、未消耗故障可偵測、容量 32、明確清理與 instance 隔離                                |
| `RUNNER-REPORT-01`–`04`    | 只產白名單摘要，失敗／skipped／pending／unknown／空 suite／中斷／runner error 不算成功，任意輸入與 canary 不被摘要回印               |

`ControlledClock` 不更動全域 Date 或真實 timers，UTC 與單調毫秒可分別控制；`advance()` 驗證兩個新值後才一起變更。`adjustUtc()` 模擬牆鐘漂移，`advanceMonotonic()` 可獨立模擬執行暫停。這是時鐘測試工具，不冒充已驗證的真主機 suspend／clock 健康。

`FaultHarness` 只存在測試目錄，必須指定 `synthetic`。`arm()` 對 database／source／reply 排入固定 timeout／unavailable／unknown 類別，`trip()` 一次消耗一項；預期故障後呼叫 `assertDrained()`，清理使用 `clear()`。未消耗／過量故障都明確失敗。這不是 fake DB 整合替代品，未來 commit ACK／兩程序／TLS／tmpfs 測試仍需真正 PG17。

## Coverage 分母

`vitest.config.ts` 根層配置 `coverage.include: ['src/**/*.ts']`、`exclude: []`、`thresholds.lines: 80` 與 `autoUpdate: false`。不因 runtime／adapter 難測排除應用。依賴 `node_modules/`、產生碼 `dist/`、框架 `.codex/`／`.agents/`／`aidlc/`、`tests/` 與工具設定不屬於 `src/**/*.ts`，因此不在分母；不要把產生碼放進 `src/` 再偷偷排除。

Vitest 5 的 v8 provider 在顯式 include 下補入未載入來源；`cleanOnRerun: false` 也保留單檔 selector 的未載入檔計算，`clean: true` 在每次獨立 run 清除舊資料，本配置不開 watch。這是 runner 設定，不是全應用測得 80% 的證據。目前沒有應用來源與 PG integration suite，不執行空 coverage 或將 smoke 宣稱為完整 coverage；完整 unit＋integration coverage 命令要在相應 suite 成熟後依核准指引執行，缺 integration／報告／來源或低於門檻都不能交付。

## 安全結果與尚未驗證項目

自訂 `SafeReporter` 不序列化測試名稱、錯誤物件、assert diff、HTTP／SQL 本文或秘密，只輸出固定 unit／suite／status／errorCategory 與計數。console 攔截不輸出內容；未處理錯誤仍計數並使結果失敗，不使用忽略 unhandled error 的選項。coverage 使用 `json-summary`，不產含來源的 HTML 報告。smoke 不寫報告檔或 raw log；既有工具依賴快取不等於測試結果快取。

本層尚非最終安全報告 sanitizer 或任意直接 `process.stdout.write` 的隔離保證；測試不得自行印出敏感資料。Step 15–19 仍須完整驗證錯誤出口、證據 TTL／容量／清理與 CI。尚未執行 app build、真 PG 整合、E2E、performance、安全掃描、hosted CI 或真實完整流程。Step 3 的條款／Desktop／VM／映像及本 run 資源授權獨立處理，不因 Step 2 通過而取得。
