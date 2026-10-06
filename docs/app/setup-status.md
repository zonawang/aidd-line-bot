# U1 開發環境前置檢查

## 已完成範圍

**替代方案評估：** 使用者已同意 Q7，優先滿足產品需求、減少不必要複雜度，並允許提出建議後繼續非破壞性工作。建議本案專用 Lima VZ Linux VM＋獨立 2GiB ext4 data disk，沿用單一 Bot／PostgreSQL／Compose，不搬移或刪除原資料，不降低限制；比較及驗證順序見 `local-storage-assessment.md`。官方 Lima 2.2.1 archive（38328082 bytes）已下載、SHA256 核對及獨立目錄安裝，版本檢查通過；尚不能据此宣稱 VM／儲存或 PostgreSQL 通過。原 run 不掛進新 VM；新 run 需重跑完整 schema／runtime，且在自身同一 PGDATA 完成重啟保留驗證。以下為先前結果。

**最新交接：** 隔離診斷 57080 / exit 0，三次寫入與啟動身分／工具條件通過，容器及 scratch 清理通過；原 PGDATA／evidence 未掛載或改寫。限定三檔單測 110/110、靜態檢查通過。這次沒有重現 96680 的失敗，不等於修復；原 `identity started identity_mismatch none` 仍不准 resume，不新增 phase 例外、不重跑、不改證據。Step 3／4 未完成，下一步需確認可驗證權限與硬容量上限的環境方案，任何安裝、設定變更或搬移資料仍需另行核准。詳見 `docs/app/database-layer.md` 最新節；以下均為歷史。

**最新交接：** 主流程 8708 完整單測 **274/274**、74147 scratch writer 通過；49652 真 PG 續跑仍在 R05 `data_identity / owner=other / mode=0700` 失敗，R01–R04 七例通過。同 source 的 91035 metadata 與 3685 兩次既有 EACCES guard 探測均成功，但未跑 integration／fixtures，根因仍未知，不能推定 FUSE 快取或放寬 PGDATA owner。本輪僅增加同一次 stat 的固定 root／PG／mixed／other 分類，限定五檔 **200/200 通過**；同 PGDATA 保留，未代跑原生操作。Step 3／4 仍未完成，交回原 `node scripts/u1-lunch-bot/database-phase.ts resume-r05`，不進 Step 5。詳見 `docs/app/database-layer.md` 最新節；以下為歷史。

**最新交接：** 26938 啟動失敗、tests 未開始；51996／59335 隔離探測確認 evidence 目錄 guest owner 在首次成功 rename 後由 root/root 轉為 PG/PG。現限定接受這兩組 0700 配對並允許精確 started 重新驗證，host／檔案／clean-cluster guards 不變。限定單測 **181/181 通過**；修補後 scratch 與真 PG 仍待主流程執行，Step 3／4 未完成。詳見 `docs/app/database-layer.md` 最新節；以下為歷史。

**最新交接：** session **67902 / exit 1** 仍為 `evidence_channel pending runtime_check none`、tests 未開始；84938 metadata 的 `-w/-x` 與 41354 真實建立 **EACCES** 拒絕共同釐清 access 誤判（主機 ownership enabled）。已改採嚴格 O_EXCL 建立拒絕、guest evidence 精確 root/root/0700 與 initialized-only 精確 pending 續跑；host admission 未放寬、舊失敗未改成功。**164/164 限定單測通過**；未執行修補後真 PG，Step 3／4 仍未完成。交主流程 `node scripts/u1-lunch-bot/database-phase.ts resume-r05`；不加 readonly bind、不 reset／remount、不進 Step 5。詳見 `docs/app/database-layer.md` 最新節；以下均為歷史。

**最新 session 43006 / exit 1：** admission 通過，但 bootstrap 即 `disk_temp_guard failed disk_temp_rejected none`，**integration tests 未開始**；清理通過，同 PGDATA 保留、未 reset／remount。現補同筆原子 bootstrap 原因碼／action／固定 owner-mode-writable 摘要及精確失敗後續跑 admission；根因仍待原生診斷，未實作 speculative read-only bind。限定單測初次 125/131，修正 shell failure handling 後 **131/131 通過**；未代執行 runtime，Step 3／4 仍未完成。交回 `node scripts/u1-lunch-bot/database-phase.ts resume-r05`。詳見 `docs/app/database-layer.md`，以下均為歷史。

**最新 session 40081 / exit 1：** runtime **7/8**；啟動與 TLS 通過，但 `R05_DISK_GUARD / before / line_event_app` 在 WITH HOLD／ordinary sort 前失敗。同 PGDATA 保留、清理通過，主機讀到專用目錄仍存在且 mode555，不能推定 PG 刪除根目錄或把主機 owner 當 guest owner。本輪補獨立入口的固定原因／owner-mode 摘要、非零結果安全傳遞及有效不可寫斷言；**95/95 限定單測通過，原生結果待驗**。不放寬限制、不重建 running 目錄、不 reset／remount；Step 3／4 未完成。主流程續跑原 `node scripts/u1-lunch-bot/database-phase.ts resume-r05`；以下均為較早歷史。

**最新資料層交接：** session **94765 / exit 1**，runtime **7/8**，已觀察 WITH HOLD 在 default 產生 **1 個正大小檔案／1368064 bytes**、target 零檔。PG17.11 跨交易暫存強制 default 的原始碼已核對；本輪新增啟動時空目錄 0555 防護、WITH HOLD 實際拒絕回歸，以及 unchanged 400ms 下容器內 ordinary sort 觀察。**80/80 限定單測通過，修補後真 PG 尚未執行**。同 PGDATA 保留，未 reset／remount／刪資料；原 39/40、7/8 歷史不改成成功。Step 3／4 仍未完成；詳見 `docs/app/database-layer.md`，由主流程執行同一 `resume-r05`。以下為歷史結果與前置檢查，不取代此最新狀態。

Step 1 已完成：workspace／工具檢查、嚴格 TS／ESM／formatter／lint 設定、公開 metadata 精確版本／image digest／Actions SHA、經授權的依賴安裝及 lockfile 均有下述證據，沒有執行 lifecycle scripts。獨立 Compose 2.40.3 已核對；內附 5.5.1 保持不動。Step 2 runner 既有 36 個通過，本次不重跑。**Q5／Q6 有效，修正後原生核准的 guest preflight session 82750 exit 0；固定 PG image pull 已通過，不再重拉。** 真 PG 首次 39/40 通過；session 91390 原生續跑 7/8 通過，R05 before／line_event_app observe 仍失敗。同 PGDATA 保留，Step 3／4 均未完成。本輪新增安全 GUC／target-default 暫存觀察，限定單測 65/65 通過；新增診斷尚未真 PG 執行。

## 最新 guest 成功與回收限制

**最新續跑（主流程轉交）：** `resume-r05` session **91390 / exit 1**，admission／TLS 通過，可用 **2056949760 bytes**。R01–R04 共 7 案例通過；R05 identity／fixtures／baseline 通過，`before / line_event_app` 的 open 通過、observe 失敗（assertion／none）、close 通過。bootstrap 最後 `tcp_start passed runtime_check none`，清理通過，同 PGDATA 保留。WITH HOLD tuplestore 行為只是待驗假設；不以 cursor 持久化檔案證明普通 sort，不放寬原正大小／no-fallback／角色預算。此次僅加固定設定與兩處暫存觀察，仍交由主流程執行同一 `resume-r05`。

**最新 DB 層結果（主流程轉交）：** `node scripts/u1-lunch-bot/database-phase.ts verify` 已取得原生核准，session **25517** 完成 **exit 1**；host admission 容量 2147483648／可用 2122240000 bytes，bootstrap `tls_role_connected` 通過。**40 tests：39 passed／1 failed／0 incomplete／0 errors**，全部 schema 與 R01–R04 通過，只有 R05 失敗。最後 phase 為 `tcp_start passed runtime_check none`，容器／network 清理成功；**已初始化 PGDATA 保留，沒有 reset／remount**。R05 原本缺分段證據，根因仍未知。下列 guest／空 image 證據是更早歷史，不能當作現有 PGDATA 為空。

續跑入口 `node scripts/u1-lunch-bot/database-phase.ts resume-r05` 嚴格核对相同 image／PGDATA／allowlist／SQL hash／已知初始化結果，續跑 runtime 8 案例（含 R05），不重做 schema／guest fill／pull。R05 僅驗證並保留既有合成 fixture，有序缺少尾端才新增，不 UPDATE／DELETE／upsert／重設 sequence。安全 checkpoint／SQLSTATE 詳見 `docs/app/database-layer.md`。Step 3／4 仍未完成，新增 observation 後尚未再執行。

下列為主流程轉交的原生核准執行結果；此輪不重跑 preflight／quota fill／pull／工具 metadata。

- `node scripts/u1-lunch-bot/storage-preflight.ts guest`：session **82750** 已結束、**exit 0**。host identity 容量 2147483648 bytes、可用 2122240000 bytes；Compose pin 通過。host pull available 60816424960 bytes，通過 4294967296 bytes 預算及 2147483648 bytes reserve；固定 PG pull 成功。
- guest 證據：`STORAGE_CAPACITY=2147483648`、`STORAGE_ENOSPC_BYTES=2122186752`、`STORAGE_PASS=guest_quota_and_file_fsync_only`。容器清理通過；shell 曾核對 nonroot／UID／CPU／RAM，合併 UID/GID 行被舊大寫白名單濾掉，不能捏造數字輸出或為此重填磁碟。
- **清理後僅剩 53248 bytes 可用**。獨立唯讀檢查 `entryCount=0`／`probePresent=false`，並不證明空間已回收。
- 主流程另取得精確 owned 空 image 的非強制 detach／reattach 原生核准；session **19628** 已結束、**exit 0**，同一 2GiB image 保留，remount 後可用 **2122240000 bytes**。沒有 reformat／reset／全域設定變更。
- 只證明 remount 後恢復空間，**沒有一般即時回收、PG crash durability 或 IR-02 證據**；當時未初始化任何 PGDATA。DB 初始化前 wrapper 會再匹配 image／mount／device，並要求至少 1GiB 可用；重啟只移除容器使 tmpfs 消失，永不 remount／刪除 PGDATA 取巧。
- Docker helper 子程序 PATH 修正已在真實 pull 通過；沒有 login、全域 PATH 或 auth 設定變更。先前等待原生核准中止是歷史，不是目前 blocker。
- 主流程另回報 storage-preflight **57 tests／exit 0**；此輪不重跑。新的 DB 層有界執行入口：`node scripts/u1-lunch-bot/database-phase.ts verify`，需主流程審核後用可見原生核准執行。指令、案例與保留資源見 `docs/app/database-layer.md`。
- DB／runtime 實作及 40 個真 PG integration 案例已準備，但 **0 個已執行**。獨立安全證據 reader suite **11 passed／exit 0**；typecheck、限定 lint／format 與四個 shell 語法檢查 **exit 0**。新增 18 檔、修改 2 檔清單及精確命令見 `docs/app/database-layer.md`；沒有 runtime 資源操作或新 PGDATA。

## 原生重試與子程序 PATH 修正（歷史）

本節保留 session 59142 及修正當時的事實；其中「尚未重試／未驗證」只指當時狀態，最新結果以上節 82750／19628 為準。

下列執行／helper metadata 由主流程轉交，本次代理沒有重跑 preflight、pull、Docker／host 儲存命令或新增權限申請：

- 主流程取得精確 `node scripts/u1-lunch-bot/storage-preflight.ts guest` 的原生核准並執行；session **59142 已結束，exit 1**。host identity 2147483648 bytes、available 2122240000 bytes，Compose 通過；host pull available 60743581696 bytes，通過 4294967296 bytes 預算加 2147483648 bytes 餘裕。
- 固定 PG pull 開始後失敗：`exitCode=1`、`timedOut=false`、`permissionDenied=false`、`category=credential_helper`。腳本停在 pull，沒有建立／啟動容器或初始化 PG。這是新的實際失敗分類，不追溯猜測先前 session 53525 的 unknown 原因。
- 主流程只查非秘密設定 metadata：`credsStore=desktop`、registry credential helpers 數量 0、helper 不在 PATH、已安裝 `/Applications/Docker.app/Contents/Resources/bin/docker-credential-desktop` 存在且非 symlink；沒有讀取／輸出 auth 值或憑證。根因為已安裝 helper 未在 Docker 子程序 PATH，不需要新工具或修改全域設定。
- 修正只對 Docker 子程序傳入 env 複本，PATH 前加固定 `/Applications/Docker.app/Contents/Resources/bin`，其餘變數保持不變；缺少／空 PATH 不產生尾端冒號。不改 `process.env`、shell profile、全域 PATH、Docker 設定、登入或憑證，不建立空 auth 設定绕過 credential store。context／一般 Docker 命令及互動 start 均採用此 env。
- 每次 Docker invocation 前核對預期 helper 是一般檔案並具有 `X_OK`；缺少、symlink 或不可執行即以固定安全碼拒絕，不 fallback。這是可執行性前置檢查，實際 helper／pull 是否成功仍待主流程執行；不把單元 mock 或已核准 prefix 當成 runtime 通過。
- 先實作，再新增 9 個 env／helper 測試：env 複本、固定 prefix、missing／empty／undefined PATH、保留原變數／父程序 env、helper 缺失／不可執行／symlink 拒絕與允許路徑。精確 storage-preflight suite **57 passed／0 failed／exit 0**，`npm run typecheck` **exit 0**；未重跑 runner、未放寬 coverage。

格式只透過 `apply_patch` 更新；格式整理後下列四條命令皆 **exit 0**，第一條為 **57 passed／0 failed**，其餘為 typecheck、限定 lint／格式通過：

```sh
npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/storage-preflight.test.ts
npm run typecheck
node node_modules/eslint/bin/eslint.js --max-warnings=0 scripts/u1-lunch-bot/storage-host.ts scripts/u1-lunch-bot/storage-preflight.ts tests/u1-lunch-bot/unit/storage-preflight.test.ts
node node_modules/prettier/bin/prettier.cjs --check scripts/u1-lunch-bot/storage-host.ts scripts/u1-lunch-bot/storage-preflight.ts tests/u1-lunch-bot/unit/storage-preflight.test.ts config/versions.json
```

本次修改共 5 檔：`scripts/u1-lunch-bot/storage-host.ts`、`scripts/u1-lunch-bot/storage-preflight.ts`、`tests/u1-lunch-bot/unit/storage-preflight.test.ts`、`docs/app/setup-status.md`、`config/versions.json`，沒有新增／刪除來源。修正後 runtime 重試 **未執行**，由主流程審核後使用可見原生核准執行；本次未清理 image／mount，沒有新執行中的 runtime session，所有本次檢查命令已結束。guest UID／fsync／限額／同 PGDATA restart 及 Step 4 仍未驗證。

## Q6 先前執行與中止後交接（歷史）

本節記錄原生核准完成前的歷史交接；最新狀態以「最新 guest 成功與回收限制」為準。Q6 答覆已由主流程記錄，沒有重問或修改問答。此前 local volume quota 失敗、誤用 hdiutil sectors 單位及修正後 host-only ENOSPC／fsync 證據仍保留，不追溯改寫失敗。

- 新增 `storage-policy.ts`、`storage-host.ts`、`storage-preflight.ts` 與 `guest-storage-probe.sh`，限定既有 image／mount、官方固定 PG digest、精確 `desktop-linux` local socket、非 root、無網路與 runtime caps；create 失敗後按精確名稱及 owner／run 標記核對資源，不因 stdout 缺少就假稱未建立。這些控制的單元測試不代表實際容器 admission 已成功。
- `npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/storage-preflight.test.ts`：先前 **19 passed／0 failed／exit 0**。初次 import 路徑錯誤造成零測試失敗，後續型別／lint 錯誤均已修正；最終 typecheck、限定 lint、shell 語法檢查 exit 0，沒有隱藏初次失敗。
- `node scripts/u1-lunch-bot/storage-preflight.ts host`：**exit 0**。依 image／mount 即時匹配 device，image 與 filesystem 均 2147483648 bytes，可用 2122240000 bytes；Compose 2.40.3 的 hash／版本通過。未重跑 host fill、未重建映像，不把觀察到的 device 名稱當作日後識別。
- `node scripts/u1-lunch-bot/storage-preflight.ts guest`：session **53525 已結束，exit 1**。local endpoint 與碰撞檢查後開始固定 PG pull；host available 62057738240 bytes，通過 4294967296 bytes pull 預算加 2147483648 bytes 餘裕檢查。這是下載空間 admission，不是下載／cache hard cap，也不是全案磁碟上限。
- 該 pull 子命令 **exit 1、未逾時，原因 unknown**。舊 wrapper 只留下 `bounded_command_failed`；`permissionDenied=false` 只是未匹配到已知字串，不能排除權限原因，也不能推定是網路、image 或儲存相容性失敗。未保留 raw stderr，後續分類修補不能追溯還原原因。
- 同一 guest 命令的 `require_escalated` 原生申請在等待核准約 384.6 秒時中止：**原生權限核准未完成，重試中止，無 session／執行結果**，亦未返回 exit code。沒有明確拒絕答覆，不歸因為使用者決定取消；中斷可能結束了待核准工具。Q5／Q6 仍有效。不宣稱執行成功或確定未曾執行；中止後沒有重試、繞過權限或新增申請。
- 主流程轉交的獨立唯讀結果：本 run 的 Docker ps 空、endpoint 仍為精確 local socket；限定 postgres 的 image 清單空（exit 0）。本次未重查；清單空不排除部分 image blobs，不能宣稱下載殘留已清光。
- 保留 `/private/tmp/u1-lunch-bot-storage-961ab998-0b81-444c-ab33-578c76f008c0/pgdata.dmg` 及 sibling `mount` 掛載。取消後未 detach／刪除或清理。没有已初始化 PG；guest 可見性、UID／fsync／ENOSPC、同 PGDATA tmpfs-loss restart、TLS／schema／roles 及 Step 4 均未驗證。

本次只作有界交接修補：`CommandFailure` 回傳固定 timeout、DNS／TLS／連線、authentication、rate-limit、manifest-not-found、credential-helper、permission-denied 或 unknown 分類；多種相衝突線索保持 unknown，不輸出 raw stderr、URL、參數或憑證。先實作再增補測試，精確 storage-preflight suite **48 passed／0 failed／exit 0**（原 19 加 29 個診斷案例，含未知／歧義／canary 安全輸出）。不重跑 runner、host／guest preflight、pull 或任何資源操作，不進入後續 DB 層；testing coverage 門檻保持不變。

格式依已安裝 Prettier 計算，僅透過 `apply_patch` 更新本次 TS／config／test，未用 `--write`。格式修正後逐條執行以下命令，**四條均 exit 0**；第一條仍為 48 passed／0 failed，其餘為 typecheck、限定 lint 與格式通過，並非全案 build／coverage／安全掃描或 Step 4：

```sh
npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/storage-preflight.test.ts
npm run typecheck
node node_modules/eslint/bin/eslint.js --max-warnings=0 eslint.config.mjs scripts/u1-lunch-bot/storage-policy.ts scripts/u1-lunch-bot/storage-host.ts scripts/u1-lunch-bot/storage-preflight.ts tests/u1-lunch-bot/unit/storage-preflight.test.ts
node node_modules/prettier/bin/prettier.cjs --check tsconfig.json eslint.config.mjs config/versions.json scripts/u1-lunch-bot/storage-policy.ts scripts/u1-lunch-bot/storage-host.ts scripts/u1-lunch-bot/storage-preflight.ts tests/u1-lunch-bot/unit/storage-preflight.test.ts
```

本次四條檢查均已結束，未留下執行中的測試 session；原生取消後的狀態不由這些 Node-only 檢查推論。後續接續點仍是已取消的原生權限邊界與 unknown pull 原因，交由主流程處理；不重新要求 Q5／Q6 同意。

## 先前環境檢查紀錄

下列工具狀態、當時 pending 敘述及操作紀錄保留各次檢查的歷史意義；當前 Q6 授權、pull 失敗及停止點以上一節為準。

2026-10-06（Asia/Taipei）檢查：工作區起初沒有應用 manifest、來源或 node_modules；現有 AI-DLC 框架、設計與其他未提交變更保留。有效核准及 Testing Contract 已由 `aidlc engine testing-posture verify --unit u1-lunch-bot` 核對，`execution_allowed=true`，hash 與本次工作指示相符。

| 項目                           | 實際結果                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 本機                           | Darwin／arm64                                                                                                        |
| Node.js／npm                   | PATH 中既有 24.18.0／11.16.0；官方 release metadata 與 npm registry 可核對相同版本                                   |
| Docker／Podman／psql           | 本次 shell PATH 未找到，不推論整台電腦未安裝                                                                         |
| Gitleaks／OSV-Scanner／Semgrep | 本次 shell PATH 未找到，未執行掃描                                                                                   |
| Codex CLI                      | 既有 0.155.1；版本命令另警告 PATH alias 無法建立，未因此修改主機                                                     |
| 對外動作                       | 已授權 npm 依賴、Desktop DMG 及獨立 Compose v2 下載、公開 metadata 讀取；未下載 image layers、掃描工具 binary 或規則 |

## 設定與版本依據

`package.json` 固定直接依賴及工具的精確版本，`config/versions.json` 保存版本、公開來源、registry integrity、宣告授權及下述稽核結果。已核對間接依賴版本、engine／peer 宣告及既有快取 tarball 雜湊；不把這些檢查當安全掃描、逐檔驗證解壓後內容或應用相容性測試。

TypeScript 選 6.0.3：查得的 7.0.2 超出 typescript-eslint 8.71.0 宣告的 `>=4.8.4 <6.1.0`。ESLint 10.12.0 符合其 peer range，Vitest／coverage 同為 5.0.3，Vite 8.3.2 符合 Vitest 的 peer range。Node 型別使用 24 系列；型別套件 patch 不是 runtime patch，仍需實際 typecheck。

TS 使用嚴格檢查、NodeNext／ESM，建置輸入限 `src/**/*.ts`，型別檢查另含本 Unit 測試及 Vitest 設定。ESLint 限應用／本 Unit 工具及測試，排除框架、依賴與產物；Prettier 使用同樣限定的應用檔案範圍。Step 1 僅確認設定可載入；Step 2 才執行下述 typecheck／lint／格式檢查。尚無 `src/`，未執行應用 build，不把空建置當成功。

`.npmrc` 固定公開 registry、精確儲存版本、嚴格 engine，停用 lifecycle scripts、自動 audit 及 fund。已完成的安裝授權不包含任何套件 lifecycle script。

## 已授權安裝與依賴稽核

使用者回答「是」授權的下列命令已在此工作區成功執行；這是歷史命令，不是再次安裝指令：

```sh
npm install --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org/ --cache=/private/tmp/u1-lunch-bot-npm-cache --logs-max=0
```

實際結果為 exit 0、21 秒新增 210 個套件；產生 `node_modules/`、`package-lock.json` 及指定暫存快取，快取路徑在安裝前不存在。沒有重新安裝，也沒有執行 lifecycle scripts、自動 audit 或 fund。安裝授權不涵蓋 VM／容器／服務啟動、真人出口、外部掃描、Actions 或部署。

唯讀稽核於 `2026-10-05T16:45:17.348Z` 回報：

- Lockfile v3，234 個非根套件項目；來源全為 `https://registry.npmjs.org/`，全部具 SHA-512 integrity 格式。
- 210 個已安裝套件版本符合 lockfile；所有直接 pin 與先前版本清單的 integrity 一致。
- 210 個既有快取 tarball 實際計算 SHA-512，全部符合 lockfile；快取缺失 0。
- 24 個未安裝項目皆為 optional，OS／CPU 宣告均不符合本機 Darwin／arm64，沒有缺少必要套件。
- 實際 manifest 的 121 項 Node／npm engine、28 項已解析 peer range 檢查無異常；另外 24 個未安裝 peer 均明示 optional。
- 稽核輸出 `issues: []`。這些是依賴結構及雜湊證據，不是漏洞或應用測試結果。

Lockfile SHA-256 為 `3aaa34649ec233d33e9d27114c7c5eb71be06ca656e397f7706d39aaf140e6f7`；本次文件補記前以 `shasum -a 256 package-lock.json` 再核對相同值，未改動 lockfile。

## Lifecycle 與工具載入結果

以下 19 個已安裝套件有 `prepare` 宣告；全部僅讀取、未執行：

- `@eslint-community/eslint-utils` 內的 `eslint-visitor-keys@3.4.3`、`@humanfs/core@0.19.2`、`@humanfs/node@0.16.8`、`@humanfs/types@0.15.0`、`@humanwhocodes/module-importer@1.0.1`、`@humanwhocodes/retry@0.4.3`、`globals@17.13.0`、`tinyexec@1.3.1`：`npm run build`。
- `acorn@8.19.0`：`cd ..; npm run build:main`。
- `balanced-match@4.0.4`、`brace-expansion@5.0.12`、`minimatch@10.2.6`：`tshy`。
- `cookie@1.1.1`：`ts-scripts install`。
- `hashery@1.5.1`、`hookified@1.15.1`：`pnpm build`。
- `lightningcss@1.33.0`：`patch-package`。
- `pino-abstract-transport@3.0.0`：`husky install`。
- `ret@0.5.0`：`tsc`。
- `ts-api-utils@2.5.0`：`husky`。

另有 `fsevents@2.3.3` 的 lockfile `hasInstallScript=true`，但實際安裝 manifest 無 `preinstall`／`install`／`postinstall`／`prepare`，套件目錄亦無 `binding.gyp`。其發布模組可直接 import，未補跑 script；保留此差異，不修改 lockfile 掩蓋標記。`prepublishOnly` 的存在不代表消費端已執行。

先前已執行的精確 CLI 載入命令與輸出如下；均未啟動服務，本次沒有重跑：

```sh
node node_modules/typescript/bin/tsc --version
node node_modules/eslint/bin/eslint.js --version
node node_modules/prettier/bin/prettier.cjs --version
node node_modules/vitest/vitest.mjs --version
node node_modules/vite/bin/vite.js --version
```

依序輸出 `Version 6.0.3`、`v10.12.0`、`3.9.9`、`vitest/5.0.3 darwin-arm64 node-v24.18.0`、`vite/8.3.2 darwin-arm64 node-v24.18.0`，無命令錯誤。另以 Node ESM 直接 import `fastify`、`pg`、`@vitest/coverage-v8`、`fsevents`、`./eslint.config.mjs`，五項皆輸出 `status: loaded`。未建立 DB 連線或 watcher；這不是 runner smoke 或應用測試通過。

## 已取得的公開 metadata

以下均是先前已完成的公開唯讀查詢，本次未重跑。後續續作分別補上官方 image metadata 與 Docker Desktop metadata；沒有重裝 npm 或重跑已完成的 210 套件稽核：

- GitHub release API 為 HTTP 403；Compose 查詢回應明示 `x-ratelimit-remaining=0` 及 API rate limit exceeded。未改用私有憑證。
- 改以 `git ls-remote --tags --refs` 讀官方 repository refs，確認 Compose `v2.40.3`、Gitleaks `v8.30.1`、OSV-Scanner `v2.6.0`；tag object 已記於版本清單，不將它冒充已驗證 binary checksum 或功能相容性。
- Actions 的精確 tag 另查 peeled ref（如有），並讀固定 commit 的 `action.yml`，確認 `actions/checkout@7.0.1` → `3d3c42e5aac5ba805825da76410c181273ba90b1`、`actions/setup-node@7.0.0` → `820762786026740c76f36085b0efc47a31fe5020`、`actions/upload-artifact@7.0.1` → `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`；三者宣告 `node24`。未建立或執行 workflow。
- `https://raw.githubusercontent.com/docker-library/postgres/master/versions.json` 顯示 PostgreSQL 17.11；這不是 image digest。
- `https://pypi.org/pypi/semgrep/json` 顯示 Semgrep 1.179.0、Python `>=3.10`；尚未取得／驗證 binary、固定規則、離線漏洞 DB 或必要 image 涵蓋。

## 官方 Image Metadata 重試結果

歷史失敗保留：先前 Node fetch 查 Docker Hub metadata 時，沙箱內回報 `fetch failed`；另行申請沙箱外僅讀 metadata 後兩項仍為 `fetch failed`、`code: ETIMEDOUT`，該命令 exit 1，未區分 token 或 manifest 端點。這不是本次 curl 的結果，也不再是當前未解缺口。

2026-10-06（Asia/Taipei）續作改用正常配置的 curl 傳輸；不改 proxy／防火牆、不使用 mirror、不重跑連線探測。第一次 curl 的 `--dump-header /dev/stderr` 輸出方式回報 exit 23，未取得可驗證 manifest；改以 `--include` 在記憶體中分離 HTTP headers 與原始 response bytes 後，完整查詢命令 exit 0。兩個公開 token 查詢與六個 manifest 查詢均 HTTP 200，token 只在程序記憶體與 curl stdin，未印出／保存。

每個 metadata request 使用以下命令模板（不是映像 pull 命令）；`--config -` 僅經 stdin 傳入必要 Accept／Bearer header，沒有憑證出現在命令列：

```sh
curl --silent --show-error --fail --include --connect-timeout 8 --max-time 20 --max-filesize 1048576 --config - <official-metadata-url>
```

兩份 index 逐份計算原始 response bytes 的 SHA-256，與 `Docker-Content-Digest` header 比對相同；四份平台 manifest 另核對 index descriptor 的 digest 及 byte size。沒有重新序列化 JSON 來取代原始 bytes 雜湊，也沒有下載 image layers、執行映像或確認其 runtime 內部版本。

- Node index（`2026-10-05T16:58:27.576Z`）：3929 bytes，`sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d`。
- Node Linux arm64/v8：1931 bytes，`sha256:af01d58b748ec92b1d6e8e11429aad424fd1e68c848185399dca0596a1ab8f5c`。
- Node Linux amd64：1929 bytes，`sha256:d45d78e7929b46875bbd4e29bea672d5bc48186c6c3588306521c815e78352d6`。
- PG index（`2026-10-05T16:58:31.152Z`）：6496 bytes，`sha256:639ab7ceb90e13123085b741fb31ef493fba25463002f6da665352e7b534b652`。
- PG Linux arm64/v8：3643 bytes，`sha256:75731e2765e7d0c8bb7dea960ef3bdcde68d16314991ab2057a2a74ea0fff257`。
- PG Linux amd64：3641 bytes，`sha256:91eb910c44c7ed13f7f1a4ccadaa9ca72ef14cddc04cacb6e070e48eb44731a3`。

涉及的確切 URL／host：

- `https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/node:pull`
- `https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/postgres:pull`
- `https://registry-1.docker.io/v2/library/node/manifests/24.18.0-bookworm-slim`
- `https://registry-1.docker.io/v2/library/postgres/manifests/17.11-bookworm`

四份平台 manifest 使用相同官方 registry 的 `/v2/library/<node|postgres>/manifests/<sha256:digest>` 路徑，digest 為上述相應平台值。涉及 hosts 僅為 `auth.docker.io`／`registry-1.docker.io`；兩個精確 tag 的 index 與上述平台 manifest 已實際取得並驗證，完整 digest／bytes／media type 已寫入版本清單。其他工具鏈及 runtime 尚未就緒，`reproducible=false` 維持不變。

## 目前阻塞與續作邊界

Step 1 的獨立 Compose v2 缺口已解除，Node-only Step 2 也已完成。依原 Step 1，版本／image digest／Actions SHA 的公開 metadata 固定與依賴 lockfile 已完成；Step 3 的 VM／PG 啟動、Step 18 的安全工具下載／checksum／規則／漏洞 DB／掃描及相容性實測不是 Step 2 前提，仍列待辦而非通過。

先前工具路徑／本機 CLI 檢查及 Q4 後容量觀察保留為歷史結果。Q5 後另查儲存 driver／volume plugins、執行單一 local quota 探測，再按原生權限申請進行下述 host disk image 探測；未重做 Step 1／2、metadata 鎖版、依賴安裝或稽核，沒有修改 PATH、socket、Desktop 設定、登入啟動項或 license 設定。

Desktop 已被觀察為運行中，不必再次要求人完成同一啟動動作。「好了」本身沒有授權全部容量或資源操作；後續 Q5「同意」才授權固定映像／lockfile、本機合成單 run 及建置／測試 VM 範圍，並知悉磁碟警示。不重問已核准範圍，也不把授權當成 quota、runtime preflight、TLS／tmpfs 或平台保護已通過。安全工具／規則／漏洞 DB 與真實出口仍不在 Q5 範圍，本次不研究其他工具鏈。

已知先前命令皆已結束，沒有已知背景命令；不重複安裝或執行 lifecycle scripts。Step 2 的四個 Unit-scoped Vitest projects、合成 fixture、可控 clock／fault harness 及精確 smoke 命令另記實際結果。最終 coverage 仍包含未載入的全部 `src/**/*.ts`、行覆蓋率至少 80%；runner smoke 不代表全應用覆蓋率或整合通過。

真 PG／TLS／tmpfs 重啟驗證已有 Q5 的限定操作授權，但須先解除下述持久儲存限額阻塞，不以記憶體 DB 或 PGDATA tmpfs 代替。IR-01／IR-02 尚未實作或驗證，上游 R-01／R-02 不關閉。合法真實來源、真實 LINE 完整流程、CI 與交付證據均待後續；不將此設定紀錄當 code-summary 或完成的 traceability。

Q6 回答前，daemon 明確拒絕 local volume quota；沒有降成容量輪詢或建立無上限 volume。其後 host 端固定 2GiB image 已透過原生權限核准實際建立／掛載並探測。當時原生核准不冒充 Q6 答覆，也不證明 PG 的限額／權限／持久性；依當時要求先停在 host-mount 同意交接。後來 Q6 已核准，續作與取消結果見最新交接，不沿用當時 pending 作現況。未代人接受條款、登入、付費、啟動 Desktop 或變更全域設定；問答答案與授權紀錄仍由主流程管理。

## Q4 自行設定回報與唯讀觀察

Q4 使用者原答為「好了」，只記為自行設定完成的回報及未提供數值的部分回答。不是本代理獨立查證合法使用資格／條款接受的證據，也不宣稱免費授權；`agreementAccepted` 記 unknown（JSON null），不是推定已接受或未接受。

以下為轉交的既有唯讀結果，本次未重跑：

- Context 為 `desktop-linux`，host 為 `unix:///Users/al03034136/.docker/run/docker.sock`，是本機端點；selected-fields `docker --context desktop-linux info --format …` 成功、exit 0。只保留轉交的安全欄位，不捏造完整原始命令。
- Server 29.8.2、Linux／aarch64、8 CPUs、memoryBytes 8319770624、cgroup v2、overlayfs。這是 daemon 回報的目前容量，不是本案可占用的預算、空閒量或使用許可。
- `settings-store.json` 沒有明示 CPU／memory／disk-size keys；缺 key 不證明任何預設值或磁碟上限。
- `df -k` 回報 host filesystem total 482797652 KiB、available 61404404 KiB（約 58.56GiB），約 12.7% 可用，低於設計 20% 警示。這是容量警示，不是已滿、已達硬失敗或必須清他人資料的證據；執行前仍要確認本 run 空間需求可承擔。
- 另轉交 `~/Library/Containers/com.docker.docker/Data/vms/0/data/Docker.raw` 的唯讀 size metadata：logicalBytes 494384709632、allocatedBytes 10649600，沒有讀取檔案內容。本次未重查；稀疏 logical capacity 不是實體預留量、可用空間、專案配額或授權，不能將其當成已驗證的全域磁碟 hard cap。

先前 `installation.desktopLaunched=false` 與 `localCliChecks.daemonConnected=false` 保留其安裝／CLI 檢查當時的歷史意義；當前狀態以新增 `daemonObservation` 為準。沒有把觀察到 daemon 運行改寫成代理已獲啟動或資源建立授權。

## Step 3 起的本機合成操作限定提案

**狀態：Q5 原答「同意」已核准；執行尚未通過儲存前置。** 下列為已核准合併操作範圍，不重開同一授權，不改既有計畫與 test-after 次序，不授權真人或正式交付。若條件無法履行就停在該處回報，不換 runtime／資料庫、不增加工具、不放寬上限。

1. **執行位置與來源：** 僅使用現有本機 `desktop-linux`，不改 Desktop 全域 CPU／RAM／磁碟、socket、PATH 或啟動設定，不使用遠端 daemon。Compose 僅用 `/private/tmp/u1-lunch-bot-compose-2.40.3/docker-compose`；缺少或不符固定版本／hash 就停止。只允許下列已查核的官方 Linux arm64/v8 基礎映像與其 digest 對應 blobs，不用浮動 tag、其他基礎映像或工具映像：
   - `docker.io/library/node:24.18.0-bookworm-slim@sha256:af01d58b748ec92b1d6e8e11429aad424fd1e68c848185399dca0596a1ab8f5c`
   - `docker.io/library/postgres:17.11-bookworm@sha256:75731e2765e7d0c8bb7dea960ef3bdcde68d16314991ab2057a2a74ea0fff257`
2. **建置：** 只建本 Unit 的本機 image／產物，不 push。若容器建置需要依賴，僅依既有 `package-lock.json` 執行 `npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org/`；不改鎖檔、不新增依賴／runtime／工具、不跑 lifecycle／apt／雲端服務。對外只限固定映像及鎖檔依賴下載；本機合成測試不連真實 LINE／餐廳 API，不上傳程式、資料、telemetry 或掃描內容。
3. **並行與 CPU／RAM：** 同時只允許一個 `u1-lunch-bot-<run-id>`。Q5 明確允許建置／測試執行器使用既有 VM 回報的 8 CPU／8319770624 bytes 記憶體容量，不更改全域設定；依據是 Q5 原答「同意」，不是 daemon 觀察。一次只執行一個本 Unit 建置，建置與 runtime 測試不並行，不啟用遠端或額外 builder。runtime 另施更嚴格限制：PG 1 CPU／1GiB，Bot 1 CPU／512MiB；一次性維護與 Bot 共用 app 配額且互斥，先停止 Bot 再維護，不各加一份。測試器及 builder 的資源不是 Bot／PG runtime 配額，builder 尚無獨立限額實證，**不承諾全案含建置都只有 2 CPU／1.5GiB**。PG tmpfs／shared memory 也計入 PG 記憶體限額；實際 runtime cgroup／CPU／memory 限制必須驗證，失效即停止。若需要超出既有 VM 範圍或變更其設定，另問，不自動擴大。
4. **磁碟與暫存：** 本 run 合成 PGDATA／WAL 合計設計上限 2GiB，PG temp tablespace tmpfs 128MiB，不得回落一般磁碟暫存。2GiB 不是普通 Docker volume 已有的 hard cap；須先確認且實測可強制執行的私有儲存限額，不能只用定期看 used bytes 冒充 hard cap。若在不改全域設定、不授 privileged／新工具的範圍內無法做到，就停止資料初始化並回報。基礎／衍生映像、依賴快取與建置層不算進 DB 2GiB，不能因此宣稱總磁碟只用 2GiB；只建立本 run 必需項目，不宣稱已驗證全域 VM 磁碟上限。使用者需知悉目前 host 12.7% 可用的警示；不足本 run 需求時停止，不替人清磁碟。
5. **隔離與網路：** 只建立帶本 run 前綴及 owner 標記的私有 container／volume／network／CA／假秘密／有界 tmpfs；名稱碰撞或歸屬不明就停止。DB 不 publish host port，TLS verify-full；Bot 到 API 層具備才可綁 `127.0.0.1` 合成入口，Step 3 不先開 Bot。固定非 root、no-new-privileges／drop capabilities；禁止 privileged、容器掛 Docker socket、host network、公開暴露、真實身分／位置／秘密。主機控制 CLI 使用現有本機 socket，不把它暴露給測試容器。
6. **驗證與清理：** 授權包括逐層合成初始化、故障／重啟／spill／滿額測試及本 run 清理，仍須先實作再測試，不越過失敗層。IR-02 重啟測試保留同一 PGDATA，不能清 DB 重建取巧；完成該測試後才按 run 清理。成功／失敗／取消均只清本 run 新建且再次核對 owner／識別的資源；不全域 prune、不刪共用基礎映像、其他專案或既有使用者資料。清理失敗回報並保留安全狀態，不冒充已清理。此提案不含安全工具下載／掃描、hosted Actions、真人串接、付款或部署。

**原單一確認題（歷史，不重問）：** 是否授權依以上固定來源、單 run 隔離／清理及 runtime 配額進行本機合成建置／逐層測試，允許建置／測試執行器使用既有 VM 回報的 8 CPU／8319770624 bytes 而不更改全域設定，知悉 host 約 58.56GiB／12.7% 可用的警示，並在 runtime 限額／2GiB DB 儲存上限無法強制驗證或空間不足時停止？Q5 已回答「同意」，以下分開記錄實際執行。

## Q5 執行：2GiB 持久儲存前置阻塞

以下至「原生主機探測結果與交接資源」結尾為 **Q6 回答前的歷史紀錄**；其中待同意／未 pull 敘述只代表當時，當前狀態以「Q6 最新執行與取消後交接」為準。

完整讀取 Q5 與本文件後，先查目前 driver／plugin 能力，未拉映像或初始化 PG：

```sh
/Applications/Docker.app/Contents/Resources/bin/docker --context desktop-linux info --format '{{json .Driver}} {{json .DriverStatus}} {{json .Plugins.Volume}}'
```

Exit 0，實際回傳 `"overlayfs" [["driver-type","io.containerd.snapshotter.v1"]] ["local"]`。

於 Q5 已授權的單 run 資源範圍內，以唯一名稱檢查碰撞（exit 0、空結果），再嘗試 local volume 的 `size=2G`，每個子命令最多 20 秒：

```sh
/Applications/Docker.app/Contents/Resources/bin/docker --context desktop-linux volume ls --filter 'name=^u1-lunch-bot-quota-probe-961ab998-0b81-444c-ab33-578c76f008c0$' --format '{{.Name}}'
/Applications/Docker.app/Contents/Resources/bin/docker --context desktop-linux volume create --driver local --opt size=2G --label com.u1-lunch-bot.owner=u1-lunch-bot --label com.u1-lunch-bot.run=961ab998-0b81-444c-ab33-578c76f008c0 u1-lunch-bot-quota-probe-961ab998-0b81-444c-ab33-578c76f008c0
/Applications/Docker.app/Contents/Resources/bin/docker --context desktop-linux volume inspect u1-lunch-bot-quota-probe-961ab998-0b81-444c-ab33-578c76f008c0 --format '{{json .}}'
```

- `volume create` exit 1：`quota size requested but no quota support`；未逾時。這是實際儲存 admission 失敗，不是預期通過的應用測試。
- 隨後 `volume inspect` exit 1：`no such volume`。沒有可核對的已登錄 volume，未執行移除／prune；也沒有存取 daemon 內部檔案系統或宣稱其內部殘留已被查核清光。
- Node 有界命令協調程序最後 exit 1，已結束，沒有背景 session。未拉映像、建置、建立容器／network 或初始化 PG；Step 3 仍 blocked，Step 4 integration 未跑，不以原 Step 2 的 36 個通過結果替代。

另唯讀查官方文件作交叉核對：第一次 `docker/docs` 舊路徑 `content/engine/storage/volumes.md` HTTP 404，未當成功；修正為 `content/manuals/engine/storage/volumes.md` 及 Docker CLI `v29.8.2` 的 `docs/reference/commandline/container_run.md`，查詢組 exit 0，各 request 上限 20 秒。後者 `--storage-opt size` 文件只列 btrfs／overlay2／windowsfilter／zfs；overlay2 還需 backing XFS／pquota。這不是目前 containerd／overlayfs 的持久 volume quota 保證，也不能把 container rootfs 配額當成另一個 PGDATA volume 配額。依據連結：`https://raw.githubusercontent.com/docker/cli/v29.8.2/docs/reference/commandline/container_run.md`。沒有以文件敘述取代上述實際探測。

**固定大小 host image 候選：** 使用 macOS 既有 `hdiutil` 在本 run 私有目錄建立固定大小 2GiB UDIF 可讀寫映像（不是 SPARSE／SPARSEBUNDLE），掛載其檔案系統後，候選用途是把 PGDATA（含 WAL）bind mount 給 PG；filesystem metadata 會使可用容量小於 2GiB，不把單檔 ulimit 當 PG 總配額。後續主流程提示 Q5 允許自有 run 私有資源、原生權限可另申請，代理遂完成下述 host 探測；這個時間順序必須保留，不能在交接中誤報未掛載或 Q6 已核准。未下載工具，未改任何既有磁碟或 Desktop 設定。

後續仍須先取得主流程所要求的 host-mount 同意，才驗既有 Desktop file sharing 可見性、固定 PG UID 權限與 guest 端 ENOSPC／fsync／持久性。若需更改 Desktop 分享設定、提升容器權限或新增工具，立即停，不自行補做。PGDATA 必須跨容器重建及 tmpfs 清空持續存在，沿用 IR-02；本次未初始化 PG，沒有用新 DB 冒充 restart 證據。候選方案尚非 Linux PG／macOS 檔案分享相容性通過，也不宣稱所有可能方案都已窮舉。

**交給主流程的最小問題範圍：** 先如實告知下述主機探測已完成與掛載尚存，再確認是否允許沿用此 run 的固定大小 2GiB host image／mount 作 PGDATA／WAL，執行 guest 限額、UID／fsync 及同 PGDATA 重啟驗證，並只對本 run 核對歸屬後卸載／刪除；任一驗證失敗或需改 Desktop 設定即停止。不重問 Q5 已准的工具／映像範圍，不把本文件寫成 Q6 回答或核准紀錄。

## 原生主機探測結果與交接資源

這一節是最新結果，補充前述 local driver 失敗，不取代或掩蓋失敗。已停止後續操作；CLI session 均已結束，但以下 mount／image 仍存在，不宣稱已清理。

1. `hdiutil create -help`／`attach -help` 唯讀查看既有工具選項。`diskutil listFilesystems` 在沙箱內 exit 1（無法使用 DiskManagement framework）；以相同命令申請原生權限後 exit 0，列出 `Case-sensitive Journaled HFS+`。這是支援清單，當時未構成限額通過。
2. 第一次原生申請的有界探測，代理誤把 `-size 2147483648b` 的 `b` 當 bytes；本機 `man hdiutil` 明示它是 512-byte sectors，實際請求成了 1TiB，超出原意。`hdiutil create` exit 1、`create failed - 裝置已經沒有空間`，未逾時；session `94363` 已以 exit 1 結束。隨後唯讀確認只有自己建立的空 `mount` 目錄，沒有 image 檔；host availableBytes 63861219328。這是參數誤用，不當成主機不支援 2GiB 或 quota failure。已向主流程即時說明，不隱藏此失敗。
3. 改用本機手冊明示 1024×1024 bytes 單位的 `-megabytes 2048`，再次原生權限核准後執行下列命令，create 上限 60 秒、attach 30 秒，皆 exit 0：

```sh
/usr/bin/hdiutil create -megabytes 2048 -layout NONE -fs 'Case-sensitive Journaled HFS+' -volname u1pg-961ab998 -type UDIF -nospotlight /private/tmp/u1-lunch-bot-storage-961ab998-0b81-444c-ab33-578c76f008c0/pgdata.dmg
/usr/bin/hdiutil attach /private/tmp/u1-lunch-bot-storage-961ab998-0b81-444c-ab33-578c76f008c0/pgdata.dmg -mountpoint /private/tmp/u1-lunch-bot-storage-961ab998-0b81-444c-ab33-578c76f008c0/mount -nobrowse -noautoopen -owners on
```

4. 掛載回傳 `/dev/disk8`；先核對 private stage 屬當前使用者、mode 0700、無既有 image、空 mount，以及 mount 與 parent 不同 device。實測 imageBytes 與 filesystemBytes 均為 2147483648，寫入前 availableBytes 2122240000。只在映像內新建兩個合成檔，第一檔 512MiB，第二檔繼續填入，填入過程上限 60 秒；合計寫入 2118123520 bytes 時收到 `ENOSPC`，`fsync` 成功，image 長度未變。兩個探測檔已刪除，結果 `pass_host_only`；session `12056` 已以 exit 0 結束。
5. **仍存在的自有資源：** `/private/tmp/u1-lunch-bot-storage-961ab998-0b81-444c-ab33-578c76f008c0/pgdata.dmg` 與同目錄下 `mount` 的掛載。未卸載／刪除，依最新要求保留交接；不要直接相信日後仍是 `/dev/disk8`，清理前須重新匹配 image／mount／device 歸屬，不做 force detach 或全域清理。
6. **未驗證：** Docker bind mount 可見性、PG 固定 UID 權限、guest 端總限額、PG fsync／crash durability、保留 PGDATA 的 tmpfs-loss restart、TLS／schema／roles。未拉任何 Node／PG image、未起容器或初始化 DB、未執行 Step 4 測試。Host 限額通過不代表 Step 3／4 完成；`postgres.capEnforcementVerified` 仍為 false。

原生權限申請與其執行結果以上述實際命令／session 為依據，不冒充主流程的 host-mount Q6 同意。最新交接要求到達後，只補寫本文件及版本紀錄，不再執行能力研究、pull、初始化、測試或清理。

## Step 2 Runner 實作與實測

2026-10-06（Asia/Taipei）：先實作 runner 設定與 fixture，再撰寫 `tests/u1-lunch-bot/unit/runner.test.ts` 並立即執行核准命令。沒有下載新依賴、重新稽核依賴、執行套件 lifecycle 或啟動網路／DB 服務。

```sh
npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/runner.test.ts
```

首次與修改 lint／格式後的重跑均 exit 0，Vitest 5.0.3 實際載入 TS 設定與 fixture，結果皆為 `tests=36, passed=36, failed=0, incomplete=0, errors=0`。不是空 suite；涵蓋固定 UTC／毫秒前進、分離 UTC 漂移與單調時間、非法值／溢位的原子拒絕、合成身分／不可變位置、非合成 profile 拒絕、有界單次 fault／隔離／清理及安全摘要拒絕失敗／空結果。細項與重現方式見 `docs/app/testing.md`。

四個 project 名稱為 `u1-lunch-bot-unit`、`u1-lunch-bot-integration`、`u1-lunch-bot-e2e`、`u1-lunch-bot-performance`，include 各限定對應 Unit 子目錄。`test:*` scripts 直接傳遞 CLI selectors，不攔截或吞掉 `--project`／檔案路徑。禁止 only／空 suite 成功，不啟用 watch／retry。coverage 明列全部 `src/**/*.ts`、`exclude: []`、lines 80／禁止自動降低；未載入來源也計入，不能因 file selector 縮分母。JSON summary 不包含原始 source／assertion diff；沒有新增持久 raw log 或測試快取。

補充的限定靜態檢查：

```sh
npm run typecheck
node node_modules/eslint/bin/eslint.js --max-warnings=0 eslint.config.mjs vitest.config.ts tests/u1-lunch-bot/
node node_modules/prettier/bin/prettier.cjs --check package.json tsconfig.json tsconfig.build.json eslint.config.mjs .prettierrc.json vitest.config.ts config/versions.json tests/u1-lunch-bot/
```

第一次 typecheck exit 0；lint exit 1（22 處 void arrow shorthand），格式 exit 1（2 檔）。已用 `apply_patch` 修正，沒有停用規則或降低門檻；上述三條最終皆 exit 0，並重跑精確 smoke 命令成功。這不是 Step 21 完整品質命令；尚無應用來源／成熟整合 suite，未執行 build、全體 coverage、PG／E2E／performance／安全掃描或 hosted CI，不宣稱 80% 已達標。

## Docker Desktop 安裝與本機 CLI 證據

Q1 原答「可以」確認 Docker Desktop 選型；其後 Q2 原答「可以」另授權限定下載、校驗、唯讀掛載及複製。以下先前取得的官方 metadata 保留，沒有重查；未修改由流程管理的問答檔，也未代為接受條款：

- 官方 main／Apple Silicon appcast：`https://desktop.docker.com/mac/main/arm64/appcast.xml`；4.94.0、build 241994、發布時間 `2026-10-05T08:17:03Z`、DMG 587631519 bytes（約 587.6 MB）。不使用 appcast 較舊的 channel link 或浮動下載 URL。
- 官方 release notes：`https://docs.docker.com/desktop/release-notes/#4940`，確認相同穩定版及 Apple Silicon 固定 build 下載／checksum URL。
- 官方 checksum：`https://desktop.docker.com/mac/main/arm64/241994/checksums.txt`，curl exit 0，原文 `02147e4d559ff41e1d9d7be63a554101340237064c7b6df234548aa111ebf04c *Docker.dmg`。轉交的已授權下載結果確認實際 DMG SHA-256 相同，size 為 587631519 bytes。
- 官方安裝文件：`https://docs.docker.com/desktop/setup/install/mac-install/`；支援目前及前兩個 macOS 主要版本、至少 4 GB RAM。appcast 最低 OS 為 14.0.0；Rosetta 非嚴格必要，本提案不安裝 Rosetta。
- `sw_vers`：macOS 26.5.2（25F84）；`uname -m`：arm64。`sysctl -n hw.memsize` 沙箱內遭拒，經原生提權唯讀查詢成功，輸出 17179869184 bytes（16 GiB）。符合架構、appcast 最低 OS 及 RAM 要求，不等於完整 host／虛擬化／TLS／tmpfs preflight 通過。

安裝採對應官方拖曳方式的 bundle 複製；未執行 command-line installer 或 Docker.app，未使用 `--accept-license`、`--user`、`open`，未修改 PATH、socket、設定、登入啟動項或既有 Docker 資料。

授權／費用邊界：官方安裝頁摘要列個人、教育、非商業開源及符合員工數／營收條件的小企業可免費，其他專業用途及政府實體可能需要付費訂閱。本案資格未知，須由人確認，不能從電腦或專案名稱推定免費；條款由人自行閱讀／決定，未代為接受、購買或登入。首次啟動與條款接受會進入 Desktop 設定／執行階段，不包含在下列複製提案內。

**已完成下載／安裝的轉交證據（不重跑）：** 官方 DMG 使用 600 秒下載上限，與 metadata 20 秒上限分開。DMG 保留在 `/private/tmp/u1-lunch-bot-desktop-4.94.0-241994/Docker.dmg`，checksum／size 通過；原生權限核准後唯讀掛載，source／destination 的 `codesign --verify --deep --strict` 均通過，PlistBuddy 核對 4.94.0／241994。以原子 `mkdir` 保留原先不存在的 `/Applications/Docker.app` 再 `ditto` 複製；實際未使用 sudo，現有使用者權限足夠，沒有覆寫既有 app。`hdiutil detach` 成功，mount 目錄空，結果 `APP_COPY_SIGNATURE_AND_UNMOUNT_OK`、exit 0。

以下為本次實際執行的 CLI 版本／雜湊命令，僅本機檢查，不啟動或連接 daemon：

```sh
/Applications/Docker.app/Contents/Resources/bin/docker --version
/Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose version --short
shasum -a 256 /Applications/Docker.app/Contents/Resources/bin/docker /Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose
```

結果依序為 `Docker version 29.8.2, build 7fc2dff`、`5.5.1`；兩個已安裝 binary 的 SHA-256 分別為 `6c33f6c851de8ea6729a44f952b41774973a6d20768ea514dfa700497c884392`、`86fb969e772ef5082195224d143cdbd3cf36e7d6fc95f0c2db47be0f9d64fe04`，命令組 exit 0。這些是已校驗 DMG 內 binary 的本機指紋，不假稱為獨立 release checksum 或 daemon／Engine 運作證據。

## Compose v2 已完成的限定下載證據

內附 Compose 5.5.1 不符合凍結計畫的 v2，不能默默更改 major，也不需為核對此事啟動 VM。最小補足方案是另外放置既定 Compose 2.40.3 的官方 darwin-aarch64 binary，使用絕對路徑，不替換 Desktop 內附 plugin、不動全域 PATH 或使用者 Docker 設定。

先前的官方 checksum metadata 查詢如下，20 秒上限，exit 0；該次查詢本身沒有下載 binary：

```sh
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --connect-timeout 8 --max-time 20 --max-filesize 65536 https://github.com/docker/compose/releases/download/v2.40.3/docker-compose-darwin-aarch64.sha256
```

回應為 `8cd7eb5f95bacb536cc407111662e2c205d67d9abfea5dcb8400be8418db60d1 *docker-compose-darwin-aarch64`。**Q3「可以」另行授權後，下列限定操作已由主流程成功執行；此處為歷史命令，不重跑**。目錄原先不存在才建立，既有路徑即停止、不覆寫。checksum 不符或逾時即停止，不啟動 daemon：

```sh
set -eu
umask 077
stage=/private/tmp/u1-lunch-bot-compose-2.40.3
mkdir -m 700 "$stage"
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --connect-timeout 8 --max-time 180 --output "$stage/docker-compose" https://github.com/docker/compose/releases/download/v2.40.3/docker-compose-darwin-aarch64
printf '%s  %s\n' '8cd7eb5f95bacb536cc407111662e2c205d67d9abfea5dcb8400be8418db60d1' "$stage/docker-compose" | shasum -a 256 -c -
chmod 700 "$stage/docker-compose"
actual_version=$("$stage/docker-compose" version --short)
printf '%s\n' "$actual_version"
test "$actual_version" = '2.40.3'
```

轉交的實際結果：`/private/tmp/u1-lunch-bot-compose-2.40.3/docker-compose: OK`、版本 `2.40.3`、`COMPOSE_DOWNLOAD_HASH_VERSION_OK`、exit 0；SHA-256 與上述官方值相同，mode 700。精確版本命令為 `/private/tmp/u1-lunch-bot-compose-2.40.3/docker-compose version --short`。binary 下載上限 180 秒，與 checksum metadata 的 20 秒上限分開；沒有重複下載／校驗／安裝，也沒有連接 daemon。

暫存路徑不保證跨重啟保留，後續 wrapper 必須核對存在／版本／hash，缺少即拒絕，不能 fallback 到 Desktop 5.5.1。Q5 已另准固定映像與本 run 操作，但目前停在儲存 quota 前置；不從安裝成功或自行設定回報推定合法使用資格或限額已通過。Step 1 完成只表示本步設定／鎖版及已授權依賴具備；`reproducible=false` 保留整體 runtime／交付尚未驗證的事實，不把 metadata 當安全掃描。

## 路徑清單

Q6 前已有下列 17 個應用設定／測試／文件。Q6 續作新增 4 個前置腳本與 1 個測試檔，並修改 `tsconfig.json`、`eslint.config.mjs`；本次交接修補另更新 `docs/app/setup-status.md`、`config/versions.json` 與診斷程式／測試，累計 22 個應用設定／測試／文件，未刪除來源。`package-lock.json` 未改。未碰計畫、測試指引、Testing Contract、memory、問答、state／audit 或凍結設計，未產生階段完成文件；Step 3／4 未勾完成。工作區外 image／mount 另列於最新交接，不能混同為沒有資源。

- `package.json`
- `.npmrc`
- `.node-version`
- `tsconfig.json`
- `tsconfig.build.json`
- `eslint.config.mjs`
- `.prettierrc.json`
- `config/versions.json`
- `docs/app/setup-status.md`
- `package-lock.json`
- `vitest.config.ts`
- `tests/u1-lunch-bot/fixtures/clock.ts`
- `tests/u1-lunch-bot/fixtures/synthetic.ts`
- `tests/u1-lunch-bot/fixtures/fault-harness.ts`
- `tests/u1-lunch-bot/fixtures/safe-reporter.ts`
- `tests/u1-lunch-bot/unit/runner.test.ts`
- `docs/app/testing.md`
- `scripts/u1-lunch-bot/storage-policy.ts`
- `scripts/u1-lunch-bot/storage-host.ts`
- `scripts/u1-lunch-bot/storage-preflight.ts`
- `scripts/u1-lunch-bot/guest-storage-probe.sh`
- `tests/u1-lunch-bot/unit/storage-preflight.test.ts`

此外已有被忽略的 `node_modules/` 與 `/private/tmp/u1-lunch-bot-npm-cache/`；兩者不是應用來源，不列入上述 22 個設定／測試／文件清單。先前下載的 Desktop／Compose 位於前述工作區外路徑，不冒充應用原始碼。

## 依賴稽核命令證據

下列是先前實際執行的唯讀 Node 稽核命令原文；本次只留存命令，沒有重新執行。其結構化輸出為 `entries=234`、`installed=210`、`engineChecks=121`、`peerChecks=28`、`cacheVerified=210`、`cacheAbsent=0`、`issues=[]`，optional 與 lifecycle 明細彙整於前述各節。

```sh
node --input-type=module <<'NODE'
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const semver = require('semver');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const lockBytes = readFileSync('package-lock.json');
const lock = JSON.parse(lockBytes);
const manifest = readJson('package.json');
const versions = readJson('config/versions.json');
const issues = [];
const lifecycles = [];
const optionalAbsent = [];
const optionalPeersAbsent = [];
let installed = 0;
let engineChecks = 0;
let peerChecks = 0;
let cacheVerified = 0;
let cacheAbsent = 0;
const allows = (values, current) => !values || (!values.includes(`!${current}`) && (values.includes('any') || values.includes(current) || values.every((value) => value.startsWith('!'))));
const resolvePeer = (directory, name) => {
  let current = resolve(directory);
  while (true) {
    const candidate = join(current, 'node_modules', name, 'package.json');
    if (existsSync(candidate)) return readJson(candidate);
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
};
for (const [name, pin] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
  const entry = lock.packages[`node_modules/${name}`];
  if (entry?.version !== pin || entry?.integrity !== versions.packages[name]?.integrity || versions.packages[name]?.version !== pin) issues.push({ name, kind: 'direct_pin_or_integrity_mismatch' });
}
for (const [directory, entry] of Object.entries(lock.packages)) {
  if (!directory) continue;
  const name = directory.split('node_modules/').at(-1);
  if (!entry.resolved?.startsWith('https://registry.npmjs.org/')) issues.push({ name, kind: 'unexpected_source' });
  if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(entry.integrity ?? '')) issues.push({ name, kind: 'integrity_format' });
  const packagePath = `${directory}/package.json`;
  if (!existsSync(packagePath)) {
    optionalAbsent.push({ name, optional: entry.optional === true, os: entry.os, cpu: entry.cpu, compatible: allows(entry.os, process.platform) && allows(entry.cpu, process.arch) });
    if (!entry.optional) issues.push({ name, kind: 'missing_required' });
    continue;
  }
  installed++;
  const actual = readJson(packagePath);
  if (actual.version !== entry.version) issues.push({ name, kind: 'installed_version_mismatch' });
  for (const [engine, actualVersion] of [['node', process.versions.node], ['npm', manifest.engines.npm]]) {
    if (!actual.engines?.[engine]) continue;
    engineChecks++;
    if (!semver.satisfies(actualVersion, actual.engines[engine])) issues.push({ name, kind: 'engine_mismatch', engine, range: actual.engines[engine] });
  }
  for (const [peer, range] of Object.entries(actual.peerDependencies ?? {})) {
    const resolved = resolvePeer(directory, peer);
    const optional = actual.peerDependenciesMeta?.[peer]?.optional === true;
    if (!resolved) {
      if (optional) optionalPeersAbsent.push({ name, peer });
      else issues.push({ name, peer, kind: 'missing_peer' });
      continue;
    }
    peerChecks++;
    if (!semver.satisfies(resolved.version, range)) issues.push({ name, peer, kind: 'peer_mismatch', range, installed: resolved.version });
  }
  const scripts = Object.fromEntries(Object.entries(actual.scripts ?? {}).filter(([name]) => ['preinstall', 'install', 'postinstall', 'prepare'].includes(name)));
  if (entry.hasInstallScript || Object.keys(scripts).length) lifecycles.push({ name, version: actual.version, lockInstallFlag: entry.hasInstallScript ?? false, bindingGyp: existsSync(`${directory}/binding.gyp`), scripts });
  const integrityHex = Buffer.from(entry.integrity.slice(7), 'base64').toString('hex');
  const cacheFile = `/private/tmp/u1-lunch-bot-npm-cache/_cacache/content-v2/sha512/${integrityHex.slice(0, 2)}/${integrityHex.slice(2, 4)}/${integrityHex.slice(4)}`;
  if (existsSync(cacheFile)) {
    if (`sha512-${createHash('sha512').update(readFileSync(cacheFile)).digest('base64')}` !== entry.integrity) issues.push({ name, kind: 'cache_hash_mismatch' });
    else cacheVerified++;
  } else cacheAbsent++;
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), node: process.versions.node, platform: process.platform, architecture: process.arch, lockfileVersion: lock.lockfileVersion, lockfileSha256: createHash('sha256').update(lockBytes).digest('hex'), entries: Object.keys(lock.packages).length - 1, installed, engineChecks, peerChecks, cacheVerified, cacheAbsent, issues, lifecycles, optionalAbsent, optionalPeersAbsent }, null, 2));
NODE
```
