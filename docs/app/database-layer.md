# U1 Step 3／4 資料層交接

## 最新續跑交接

### session 57080：三次隔離寫入成功，原啟動失敗仍未解決

主流程實際執行一次 `node scripts/u1-lunch-bot/evidence-writer-probe.mjs`，**57080 / exit 0**。三次 write／rename、process identity、profile／PGDATA 字串及工具存在檢查均成功；目錄仍觀察到 root/root → PG/PG 轉譯，status 維持 PG/PG、0600、單連結，最後為 tool_admission started。容器與 scratch 均在歸屬核對後清理通過，原 PGDATA／evidence 未掛載、未改写，沒有啟動 PG 或執行 SQL。

這次未重現 96680 的失敗，**不是原資料庫修復或 R05 通過**。原 evidence 仍停在 identity started，不放寬 resume allowlist、不改寫 passed、不重跑 probe 或 resume。既有資料保留，Step 3／4 未完成；若改用其他儲存／測試環境，須先確認方案與必要授權，不能自行搬移、重建資料或調整 Docker 全域設定。

開發代理因 API 限流中斷，沒有完整最終交接；主流程已獨立檢查留下的診斷檔案，執行精確三檔單測 **110/110、session 98256 / exit 0**，以及 typecheck、限定 ESLint／Prettier、shell／Node 語法檢查（38960 / exit 0）。bootstrap／evidence helper 與兩份 frozen SQL SHA 均未變。此數字不是全 Unit suite 或 coverage；先前 274/274 僅是歷史結果。

```sh
npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/evidence-writer-probe.test.ts tests/u1-lunch-bot/unit/bootstrap-evidence.test.ts tests/u1-lunch-bot/unit/database-resume.test.ts
```

### session 96680：最後成功記錄停在 identity，停止盲目續跑

主流程轉交 **96680 / exit 1**：admission 通過，prior 為 `tcp_start passed runtime_check none`，同 image 可用 2056949760 bytes；bootstrap／final 均為 **`identity started identity_mismatch none`**，`database_bootstrap_failed`，integration **未開始**，未到新 R05 owner 分類。容器／network 清理通過，無 active PG 容器，同一 initialized PGDATA 保留、無 reset／remount。本輪代理未執行原生操作。

這是**最後成功寫出的 checkpoint，不是 identity validation 已證明失敗**。原碼先寫 identity started，再檢查 `U1_PROFILE`／`PGDATA`，接著第三次寫 tool_admission；環境檢查失敗或後續 writer／失敗記錄未能更新均仍可能留下此標記。現有證據不足以指定哪一項；host/private bind UID/GID 轉譯是待驗假設，不能把既有 evidence 目錄觀察套成 PGDATA 原因。當前標記不在 resume allowlist，保持原值及拒絕，不寫 passed、不加入新 phase 例外。前節的 resume 命令是歷史交接，**現在不執行**。

**唯一下一步提案：** 將主流程既有兩次 scratch writer 探測存為 `scripts/u1-lunch-bot/evidence-writer-probe.mjs`／同名 `.sh`，僅延伸到第三次 tool_admission 寫入，加入現行啟動的 UID／GID／postgres 名稱、profile／PGDATA 字串與工具存在檢查。實際 helper 不修改，鎖定 helper 與 bootstrap SHA；DEBUG 只輸出固定 step、metadata 類別與退出碼，EXIT 補目錄／status／next 分類。探測以明示失敗分支維持拒絕，不以 DEBUG／ERR 行為判定身分通過；不重演完整 bootstrap 的失敗記錄流程。

```sh
node scripts/u1-lunch-bot/evidence-writer-probe.mjs
```

此命令交主流程審核並按原生授權執行**一次**，本輪未執行。沿用精確本機 context、固定 cached image、`--pull never`、999:999、無網路／host port、唯讀 rootfs、drop ALL、no-new-privileges、1 CPU／1GiB／64 PID／16MiB shm／core=0；guest 20 秒、輸出 16384 bytes／160 records，不擴大原界限。只掛載新 UUID 的 private scratch（RW）及程式目錄（RO）；原 PGDATA／原 evidence 不掛載、不讀寫，原 1MiB 唯讀 tmpfs 僅遮蔽 image 宣告的 data volume，避免 anonymous volume。沿用 host image／剩餘空間唯讀 admission，沒有 initdb／PG 啟動／SQL／原資料清理。清理仍核對容器 token／labels／image／mounts 與 scratch owner／canonical／inode、O_NOFOLLOW／單連結／0600／bounded 固定內容；有未知項就 nonzero 並保留 scratch，不遞迴刪除。不保證 SIGKILL／host crash 後自動清理，create 結果不明也不猜測資源不存在。

若 probe 失敗，只據首個失敗步驟及固定 metadata 評估；若三次皆成功，也只證明該次 scratch，**不能解鎖原 identity started 或證明 R05 通過**。兩種結果都停止，不自動 resume 或再跑 probe；仍無可證實修復時，由 Q6 的環境選擇重新確認可驗證固定 UID/GID 與可靠 evidence 的平台，另審保存同一 PGDATA 的方式，不擅自換環境、搬資料或調整全域設定。Step 3／4 未完成，不進 Step 5、不產 manifest。

### session 49652／91035／3685：執行中 PGDATA owner 差異尚未定因

以下為主流程轉交，代理未重跑原生操作：

- **8708 / exit 0**：完整 Unit 單測 **274/274**。**74147 / exit 0**：修補後 scratch writer 兩次 write／mv 均成功，root→PG 目錄轉譯被精確接受，容器／scratch 清理通過，原 evidence 未動。
- **49652 / exit 1**：原 `resume-r05` 的 started admission／TLS、R01–R04 七例、R05 identity／fixture validate／complete／baseline 均通過；`R05_DISK_GUARD / before / line_event_app` 仍 assertion 失敗。精確摘要為 `data_identity / data / yes / other / 0700 / yes / unknown / unknown / unknown`（reason／target／present／owner／mode／writable／create／errno／cleanup）。未進入 WITH HOLD／ordinary sort；final 為 `tcp_start passed runtime_check none`，清理通過，同 PGDATA 保留。
- **91035 / exit 0**：僅 admission／start／metadata／cleanup，exec 為 999:999；兩輪 canonical lookup 後 data／base／temp／evidence／status 全 PG/PG，mode 依序 700／700／555／700／600。**3685 / exit 0**：同類流程在 metadata 前後呼叫既有 `probeDiskTempGuard()`，兩次均為 `checked / temp / yes / expected / 0555 / yes / denied / EACCES / not_created`；中間 metadata 一致。兩次清理通過，均未執行 R01–R04 或 R05 SQL fixtures；49652 至 3685 間無 runtime source 修改，不能以獨立成功取代 integration 失敗。

原始碼追查：`database-phase.ts` 的 resume 只選 runtime suite，Vitest 單 worker、無額外 setupFiles；R01–R03 為 inspect／SQL／TLS 檢查，R04 的 DELETE 在交易內 ROLLBACK。R05 guard 前為 SQL fixture 核對、僅補缺少尾端的 INSERT、fingerprint 與 baseline `nextval`，不是全唯讀。`sql()` 經 `verifyDatabaseContainer()`／`docker exec`／`client.sh` 執行 psql，未見 host PGDATA 改權操作；host PGDATA metadata 讀取在啟動前 admission，啟動期間 host 寫入限 evidence。首次失敗後的 restart／negative fault 路徑尚未執行。**未找到已證實的 owner 改變來源**；共享檔案系統 metadata／FUSE 快取或 integration 時序差異仍僅是假設，沒有新增重試、flush 或改權來掩蓋失敗。

本輪僅擴充既有 `owner` 固定枚舉：`expected` 為預期 PG 配對、`root_pair` 為 0:0、`mixed_pair` 僅為 0:999／999:0，其他為 `other`，讀取失敗為 `unknown`。全部從 `guard_metadata` 同一次 stat 取值，無新欄位／額外 stat／raw UID/GID；原獨立身份斷言的另一次 stat 保留，兩次讀取不宣稱原子一致。PGDATA 仍只接受 **999:999:700**，不沿用 evidence 目錄例外；原 R05 failure assertion、EACCES proof、SQL／caps／timeouts／fixtures 均未改。先取得這次實際 R05 分類，不另加 post-failure 探測。

test-after：原限定五檔 **200/200 通過**，新增同次 stat、精確配對分類、PGDATA 拒絕、stat 失敗重置與雙層 sanitizer／raw 值拒絕回歸；typecheck／限定 lint／format／shell 語法均 exit 0，兩份 frozen SQL 與 evidence writer SHA 未變。首次格式檢查有一處換行不符，經 `apply_patch` 修正後重驗通過，限定五檔亦再驗 200/200。這不是新的真 PG 結果；Step 3／4 仍未完成，不進 Step 5、不產 manifest。主流程交回同一 `node scripts/u1-lunch-bot/database-phase.ts resume-r05`。以下保留歷史與當時判讀。

### session 26938／51996／59335：目錄 owner 動態轉譯

主流程轉交：**26938 / exit 1** admission 通過，但 bootstrap／final 為 `evidence_channel started runtime_check none`，tests 未開始；清理通過，同 PGDATA 保留。隔離 scratch writer probe **51996 / exit 1** 首次寫入與 mv（exit 0）成功，第二次卡在 directory owner；僅增加首次寫入後目錄 metadata 的 **59335 / exit 1** 確認目錄由 **root/root/0700 → PG/PG/0700**，各檔案始終 PG/PG/0600、單連結。兩次 probe 容器／scratch 清理皆通過，未掛載原 PGDATA／evidence；不是 mv 或檔案 owner 失敗。

最小修補只讓 guest evidence 目錄接受 **0:0:700 或 999:999:700**，混合／其他 owner 與其他 mode 仍拒絕；host-owned canonical 0700／精確 bind 與所有檔案、symlink、hardlink、大小、原子更新檢查不變，無 chmod／chown。續跑只額外接受精確 `evidence_channel started runtime_check none\n`；保留 priorBootstrap 及 clean cluster／system identifier／frozen SQL／allowlist／fixture 全部驗證，不改寫實際 started 為 passed、不擴大其他 failed phase。EACCES guard、SQL／caps／timeouts 均未改。

test-after：初次因新增 fixture 插入位置造成語法錯誤而載入不完整，已修正；限定原五檔 **181/181 通過**，含重複寫入 root→PG、混合／錯權限拒絕及 started 不改寫。修補後原生 scratch／真 PG 均未由代理執行；主流程先以本次 helper SHA 更新原 scratch probe 的 expectedHash，通過後再執行 `node scripts/u1-lunch-bot/database-phase.ts resume-r05`。Step 3／4 仍未完成，不進 Step 5。以下保留歷史與當時判讀。

### session 67902／84938／41354：建立拒絕證據與方法修正

主流程轉交（代理未重跑）：**67902 / exit 1** 的 same-image admission／readonly clean-cluster helper 通過，容量 2147483648、可用 2056949760 bytes；bootstrap／final 仍是 `evidence_channel pending runtime_check none`，`database_bootstrap_failed`，integration **未開始**，清理通過、同 PGDATA 保留。**84938 / exit 0** 僅讀 metadata：temp555 的 `-w=yes`、status600 的 `-x=yes`；主機 `GlobalPermissionsEnabled=true`。**41354 / exit 0** 真實 O_EXCL 建立遭 **EACCES**，沒有產生檔案，probe 容器清理通過；guest evidence 目錄精確分類為 root/root。這證明 access 判斷不能取代實際 open，不是 ownership 關閉或 chmod 無效。

本輪新增 `infra/postgres/create-denial.pl`，使用已在固定 image 確認存在的 Perl，無下載。固定 PGDATA／999 身分、canonical／owner／mode／空目錄檢查後，隨機唯一名稱以 O_EXCL／O_NOFOLLOW 嘗試建立零位元組檔；只有 **EACCES／EROFS** 且再次驗證原目錄身分、檔案未建立與空目錄才成功。其他 errno、缺 helper、矛盾／缺漏證據都失敗；意外成功只在 descriptor／inode／owner／0600／單連結／零大小一致時移除自己的檔案，仍失敗，清理不確定不冒成功。新增固定 `create/errno/cleanup` 摘要，`writable` 如實保留、僅供診斷；舊六欄失敗仍可讀，但沒有建立拒絕證據不能當 guard 通過。

guest evidence 目錄限定 **0:0:700**，status 檔仍 **999:999:600:1**；host canonical／本人 owner／0700、精確 bind 來源／target／RW、非 symlink 等 admission 不變，未接受任意 other、未 chmod／chown evidence。`resume-r05` 僅額外允許**精確**現有 pending 文字，仍須 initialized allowlist／版本／SQL hash／唯一 symlink／無 PID、相同 image／mount／owner、readonly pg_control clean／catalog／system identifier 及既有 fixture 驗證。admission 輸出保留 `priorBootstrap`，不把舊 pending 改成 passed，不允許其他 failed/pending phase 或 initdb fallback。

test-after 初次 159/159，加上 descriptor 替換／目錄變更／無 proof 成功拒絕後 **164/164 單測通過**（精確五檔命令同下節）。新增單測 fixture `tests/u1-lunch-bot/fixtures/disk-guard-fixture.ts` 僅映射本機合成目錄；不是 PG 證據。原兩 app 角色、重啟前後 WITH HOLD 拒絕與 ordinary sort 正大小 tmpfs／零 fallback 回歸、400ms／16MiB／128MiB、SQL 與合成資料契約均未變。未新增 readonly bind，未 reset／remount 或執行 runtime。Step 3／4 **仍未完成**，不進 Step 5；交主流程執行 `node scripts/u1-lunch-bot/database-phase.ts resume-r05`，不可預先宣稱通過。以下保留歷史結果與當時判讀，不覆蓋本節的方法修正。

本輪靜態檢查：`npm run typecheck`、限定 11 份 TS 的 ESLint、14 份 TS／文件／版本設定的 Prettier、三份修改 shell 各自 `bash -n`、新 Perl 的 `perl -c` 與 `git diff --check` 均 exit 0；兩份 frozen SQL SHA 核對未變。這不等於真 PG／全應用 coverage 或完整品質驗證。

### session 43006：bootstrap guard 失敗，測試未開始

主流程原生 `resume-r05` **session 43006 / exit 1**：same-image admission 通過（容量 **2147483648**、可用 **2056949760** bytes；device 僅本次觀察，不固定編號）。bootstrap／final 均為 `disk_temp_guard failed disk_temp_rejected none`，phase code `database_bootstrap_failed`；**未開始 integration tests**。容器／network 清理通過，同 PGDATA `retained_no_reset_no_remount`。當時沒有 guard 摘要，不能斷言是平台權限語意或 shell/context 問題。

本輪限定修補：將 `prepare|check` 與固定 `guard.reason/target/present/owner/mode/writable` 併入同一份 `bootstrap.status` 原子更新，不另建 sidecar；failure 明確 exit 41，下一個 checkpoint／attempt 覆寫舊摘要。目錄與檔案驗 canonical／owner／mode、固定名稱、非 symlink／單一 hardlink、256-byte 上限；host reader 另用 no-follow descriptor、inode 核對及 bounded read。無 raw stderr、路徑、UID/GID、SQL 或資料；缺失／非法證據仍 unknown／拒絕，絕不當成功。也修正缺 base 時摘要挪用上一個 target metadata 的問題。

`resume-r05` 額外只接受精確 `disk_temp_guard failed disk_temp_rejected none`（相容 session 43006 無摘要格式及新合法摘要），這是允許重新診斷，不是通過證據。既有 initialized PGDATA、SQL hash、唯一 tablespace symlink、owner／mode、無 postmaster.pid，以及 readonly helper 的 clean pg_control／catalog／system identifier 檢查全部保留。其他 failed／pending／started 不放行；initdb fallback 仍禁用。

test-after：初次 **125/131**，六個證據拒絕案例發現函式內 ERR trap 未繼承；已改明確失敗處理，重跑 **131/131** 通過。前輪 95 與更早 native 結果保留為歷史。新增測試檔 `tests/u1-lunch-bot/unit/bootstrap-evidence.test.ts`；本輪未執行原生 runtime，Step 3／4 仍未完成。精確單測命令：

```sh
npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/bootstrap-evidence.test.ts tests/u1-lunch-bot/unit/disk-temp-guard.test.ts tests/u1-lunch-bot/unit/spill-observations.test.ts tests/u1-lunch-bot/unit/database-evidence.test.ts tests/u1-lunch-bot/unit/database-resume.test.ts
```

主流程下一個命令仍為 `node scripts/u1-lunch-bot/database-phase.ts resume-r05`；先取得上述固定原因，再判斷平台問題。nested read-only bind **未實作**：若實際證據確認 0555 仍可寫，可評估為原 no-fallback 目標的最小加強，但必須驗既有空來源／canonical／owner／symlink、mountinfo RO 與精確 container mount allowlist，且不 reset／remount PGDATA、不增權／改 caps。是否可安全落實仍待實證，不以此取代診斷。原 WITH HOLD 實際拒絕與 ordinary positive spill／no-fallback 回歸，以及 400ms／16MiB／128MiB、SQL hashes 均未變。

交接前再跑同 **131** 案例、typecheck、限定 ESLint／Prettier、逐檔 `bash -n` 與 `git diff --check`，均 exit 0；兩份 frozen SQL SHA 與既有值相同。無原生命令或工具權限等待；未推進後續步驟。

### session 40081：running guard 未通過，根因尚待固定診斷

主流程原生 `resume-r05` session **40081 / exit 1**：admission／TLS、R01–R04 共 7 案例及 R05 identity／fixtures／baseline 均通過；`R05_DISK_GUARD / before / line_event_app` 以 `command / none` 失敗，**尚未進入 WITH HOLD 拒絕回歸或 ordinary sort**，合計 **7/8**。最後 bootstrap `tcp_start passed runtime_check none`，容器／network 清理通過，同 PGDATA 保留、未 reset／remount。清理後主流程另讀主機 metadata：PGDATA／base 為 700，專用暫存目錄仍存在且為 **555**，owner **502:20** 是主機轉譯值，不拿來推定 guest owner。

唯讀核對官方 REL_17_11 `fd.c`：`RemovePgTempFiles()` 以 `unlink_all=false` 處理根暫存目錄，`RemovePgTempFilesInDir()` 的 rmdir 只針對子目錄，並未刪除根目錄。結合上述 metadata，**不能把根目錄被 PG 清除／重建當成已證實原因**。前輪單測只測 sourced function，未覆蓋獨立入口／執行環境；本輪補齊，但尚未證明 guest 中的原始失敗條件。

本輪保留 prepare／check 的所有原限制，增加有效不可寫檢查；獨立入口拒絕時不再遺失原因。固定 reason 區分 profile、PGDATA environment、process identity、data／base identity、temp symlink／missing／identity／scan／nonempty／mode／writable／呼叫失敗，附固定 target、present、owner 是否符合、0555／0700／other、writable 摘要。沒有實際路徑、UID/GID 值、原始 stderr 或資料。子程序非零仍先取安全證據，掛在原 `R05_DISK_GUARD` checkpoint，经 reporter／父 wrapper 既有雙重白名單輸出；缺證據、非零或可寫均失敗，沒有把 check 改成 prepare，也不刪檔、重建或 chmod running PG 的目錄。

新增獨立入口與 sanitizer／非零證據測試後，限定 **95/95 單測通過**，typecheck 通過。下一次原生執行必須先通過 **PG 啟動後** 的嚴格 guard，再逐兩角色、重啟前後證明 WITH HOLD 的實際拒絕與 ordinary sort 的正大小 tmpfs／零磁碟暫存。現階段不宣稱 0555 在 guest 中已有效；Step 3／4 仍未完成。代理未執行 runtime；下列原命令交主流程執行：

```sh
node scripts/u1-lunch-bot/database-phase.ts resume-r05
```

本輪最終重新執行同 **95** 案例、typecheck、僅變更來源的 ESLint／Prettier、guard shell 語法檢查皆 exit 0；兩份 frozen SQL SHA 不變。所有格式變更均透過 `apply_patch`，未執行 PG／容器或 lifecycle 命令。

### 前輪磁碟暫存觀察與防護修補歷史

主流程 `resume-r05` session **94765 / exit 1**：同 PGDATA admission／bootstrap 通過，R01–R04 共 7 案例通過，R05 observe 失敗，合計 **7/8**。`line_event_app / before` 實際 local work_mem=64kB、held=1MB；兩者 temp_tablespaces=u1_temp、CREATE=true、400ms／100ms／16MB 均符合。default 的完整觀察為 **1 個正大小檔案、1368064 bytes、0 子目錄**，target 為 **0 檔／0 bytes**；兩處 rootPresent／treeComplete=true。open／close 通過，容器／network 清理通過，同 PGDATA 保留、無 reset／remount。不是只缺觀察，而是已證實 cursor 磁碟暫存；原 25517 的 39/40 與 91390 的 7/8 歷史均保留。

### 本輪根因與待驗修補

- 已唯讀核對官方 `REL_17_11` 原始碼：[portalmem.c](https://raw.githubusercontent.com/postgres/postgres/REL_17_11/src/backend/utils/mmgr/portalmem.c) 的 holdStore 使用 interXact=true；[tuplestore.c](https://raw.githubusercontent.com/postgres/postgres/REL_17_11/src/backend/utils/sort/tuplestore.c) 將旗標交給 BufFileCreateTemp；[fd.c](https://raw.githubusercontent.com/postgres/postgres/REL_17_11/src/backend/storage/file/fd.c) 的 OpenTemporaryFile 對跨交易檔案強制走 database default，普通 temp tablespace 開啟失敗亦可 fallback。此語意與 session 94765 的實際磁碟檔吻合。
- `disk-temp-guard.sh` 在任何 postmaster 啟動前，驗 canonical PGDATA／base／專用 `base/pgsql_tmp`、999:999、非 symlink 與空目錄；僅接受原空 0700 或已受限 0555，前者收緊為 0555，缺目錄才建立 0555。未知權限／owner／任何殘留（含子目錄）都拒絕，不刪除、清空或重建既有資料。isolated stop 後再 check，才啟動 TCP；catalog 同時要求 lunch_bot default 為 pg_default。
- 防護是可信 PG binary／nonroot 999 與受限 app SQL 角色邊界，不宣稱防 OS postgres／bootstrap superuser 被攻陷。app 沒有 superuser／server-program／server-file membership／DDL，不能 chmod；0555 阻止普通檔案建立。PG 的失敗重試只是 mkdir／open，不會 chmod 既有目錄。**實際 bind mount 權限效力仍須本次原生測試確認。**
- `R05_HOLD_REFUSED` 保留原 WITH HOLD query，逐 app 角色、before／after 要求實際受控失敗且 default 無暫存洩漏。精確預期為 **XX000**，不是猜成 42501：上述 fd.c 的最終拒絕用 `elog(ERROR)`，由 [elog.c](https://raw.githubusercontent.com/postgres/postgres/REL_17_11/src/backend/utils/error/elog.c) 預設 internal_error。任何成功、timeout 或其它 SQLSTATE 都失敗，不放寬成「任何錯誤均可」。
- 正向證明改用 `ordinary-spill.sh`：同一實際 app 連線 BEGIN／SET LOCAL 64kB／WITHOUT HOLD ordinary sort／FETCH 1，容器內立刻由隔離 bootstrap 讀 target／default 完整計數，再 CLOSE／COMMIT。角色設定與檔案觀察仍經雙重白名單；FETCH 內容送 /dev/null。沒有 host polling、pg_sleep 或 transaction 延長；400ms 內未能完成就失敗。仍要求 target 正大小／正 bytes、default 零檔／零子目錄／零 bytes；不以跨交易持久化作 sort 證明。
- 400ms／16MiB／128MiB、模型／roles SQL hash、fixtures、system identifier／history／barriers／due／expiry／sequence 保留規則不變。16MiB 與 tmpfs 滿額仍逐角色、重啟前後執行原 SQLSTATE 斷言。沒有新工具、runtime 執行或 completion manifest；Step 3／4 **仍未完成**。

新增來源：`infra/postgres/disk-temp-guard.sh`、`infra/postgres/ordinary-spill.sh`、`tests/u1-lunch-bot/unit/disk-temp-guard.test.ts`。test-after 限定單測 **80/80 passed**；新增防護／ordinary observer 尚未真 PG 執行。主流程續跑原命令：

最終 typecheck、限定 ESLint／Prettier 與三份變更 shell 的 `bash -n` 均 **exit 0**；兩份 frozen SQL SHA 與原值相同。初次 lint 的 null handling／測試 input 型別問題已用 `apply_patch` 修正，重新執行同 80 案例及所有上述檢查通過。這不替代真 PG 下的 0555 拒絕、ordinary sort、400ms 或重啟證據。

```sh
node scripts/u1-lunch-bot/database-phase.ts resume-r05
```

```sh
npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/disk-temp-guard.test.ts tests/u1-lunch-bot/unit/spill-observations.test.ts tests/u1-lunch-bot/unit/database-evidence.test.ts tests/u1-lunch-bot/unit/database-resume.test.ts
```

### 前輪診斷與修補歷史（下列未執行敘述僅指當時）

主流程續跑 `resume-r05`，session **91390** 完成 **exit 1**：resume admission／TLS 連線通過，同 2GiB image 可用 **2056949760 bytes**；runtime **8 tests：7 passed／1 failed**。R05 identity、fixture validate／complete、baseline 通過；`before / line_event_app` 的 spill open 通過、observe 失敗（`assertion / none`）、close 通過。最後仍為 `tcp_start passed runtime_check none`，容器／network 清理通過，同 PGDATA 保留、無 reset／remount。這是失敗定位，不是 IR-02 通過。

本輪只加診斷：`R05_SPILL_SESSION` 在同一 app 連線的 SET LOCAL 後、COMMIT 後分列固定 current-role、work_mem（64kB／1MB／other）、temp_tablespaces、CREATE 權限及原 timeout／temp_file_limit。`R05_SPILL_FILES` 在斷言前一次收集 target／default 的直接檔案數、正大小數與完整暫存子樹觀察（檔案／正大小／目錄數及 bytes）；版本目錄採實際 catalog，遍歷最多 4 層、每目錄 33 筆、總 129 節點，觸及界限明示 incomplete 並失敗。實際路徑／OID／檔名只留查詢記憶體，不進證據。最多 16 筆 observation 經 reporter 及父 wrapper 雙重白名單；不輸出 raw SQL／結果／錯誤／diff。

**根因未證明。** WITH HOLD 跨交易 tuplestore 與普通 sort 可能行為不同；held 或 cursor 持久化檔案不是普通 sort spill 證明。目前不更換 harness、不更改原 sort／fixture／正大小與 no-fallback 斷言，不放寬 400ms／16MiB／128MiB。先用原命令取得兩處觀察，由實際結果決定後續；本輪代理不執行 runtime。

```sh
node scripts/u1-lunch-bot/database-phase.ts resume-r05
```

新增 `tests/u1-lunch-bot/fixtures/spill-observations.ts` 與 `tests/u1-lunch-bot/unit/spill-observations.test.ts`。test-after 限定單測 **65/65 passed**（新診斷 26＋既有 resume／evidence 39），不等於真 PG 通過。SQL observer 尚未真 PG 執行，Step 3／4 仍未完成，原 schema 通過證據保留。

格式修補皆用 `apply_patch`；重新執行上述單測、typecheck、僅本輪變更來源的 ESLint／Prettier 均 exit 0，兩份 frozen SQL 的 SHA 與原值相同。沒有啟動容器／PG、改主機設定或產生 completion manifest。

```sh
npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/spill-observations.test.ts tests/u1-lunch-bot/unit/database-resume.test.ts tests/u1-lunch-bot/unit/database-evidence.test.ts
```

### 原 verify 與首次續跑修補歷史

主流程實際核准並執行原 `verify`，session **25517** 完成 **exit 1**：初始化及 TLS role 連線成功；40 tests **39 passed／1 failed**，S01–S31（含 S30 兩列）與 R01–R04 全通過，只有 R05 失敗。最後 bootstrap phase `tcp_start passed runtime_check none`；容器／network 清理通過，**原 PGDATA 保留**。根因未定位，不猜測為 timeout／quota／fixture，不改 SQL／PG 設定／400ms／16MiB。

修補後由主流程以可見原生核准執行：

```sh
node scripts/u1-lunch-bot/database-phase.ts resume-r05
```

先唯讀核對 image／mount 身分及既有空間門檻、PGDATA／WAL／evidence ownership、唯一 tablespace symlink、allowlist 與未變 model／roles SHA。既有固定 PG image 啟動一個有界、唯讀 bind、network none／nonroot／1 CPU／1GiB 的檢查容器，以實際 `pg_controldata` 核對 catalog、乾淨 shutdown 及 system identifier；隨即清理。主 PG 只准啟動既有資料，`U1_RESUME_ONLY=true` 禁止 initdb fallback；啟動後 system identifier 必須相同。沒有 pull、reset、reformat、remount 或放寬任何限制。

重跑範圍為 `postgres-runtime.test.ts` 的 **8 個案例**，保留先前 32 個 schema 通過證據，不重種 schema。R05 所有現存 fixture 必須符合固定合成值、原 due／expiry／時間順序及有序 prefix；不符就先停止，沒有 ON CONFLICT、UPDATE／DELETE 或 setval。先驗全部現存 row，才 INSERT 尚缺的尾端，並核對現存 row 摘要未變；之後 restart／negative boot 都比對同 system identifier、四筆 fixture 摘要及單調 sequence。摘要僅記憶體比對，不输出內容或 digest。

R05 固定 checkpoint 區分 identity、fixture validate／complete、baseline、兩角色 before／after 的 spill open／observe／close、磁碟 fallback、16MiB limit、tmpfs fill／exhaust／release、role health、restart、marker、preservation 及四類 negative bootstrap。Vitest task metadata 搭配 reporter 傳送，避免一般 console 過濾掉；父 wrapper 再做白名單投影。只输出 checkpoint／role／cycle／status／固定分類與五碼 SQLSTATE，不输出原始錯誤、SQL、key、位置、憑證或 diff。若收到非預期 SQLSTATE，保留實際碼而不改斷言成通過。

SQL 固定 hash：`001-model.sql` 為 `f96dc254a428e8e4b135afd2c7b321158678140a9f7daf9baba613c4755b7b7a`，`bootstrap.sql` 為 `c8481fec5ec0d476ff2d2d059b3e736af04d8e75df17e849ed19e3e6e7c57ba4`；此輪均未修改。新增來源須於後續 manifest 納入 `scripts/u1-lunch-bot/database-resume-policy.ts`、`infra/postgres/resume-check.sh`、`tests/u1-lunch-bot/fixtures/database-checkpoints.ts`、`tests/u1-lunch-bot/fixtures/restart-fixtures.ts`、`tests/u1-lunch-bot/unit/database-resume.test.ts`。

本次修補單測 **39 passed／0 failed／exit 0**（新增 resume／checkpoint 28 案例＋既有 evidence 11 案例），與真 PG 的 39/40 分開。最終 typecheck、限定 lint／format 及 bootstrap／resume-check shell 語法均 exit 0；修補期間曾出現 TS 參數／metadata 型別及 lint void-expression 錯誤，均修正後重驗。格式與 lint 修補皆透過 `apply_patch`。本次新增 5 檔、修改 10 檔；未修改 frozen SQL、PG settings 或 lifecycle 記錄。

```sh
npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/database-resume.test.ts tests/u1-lunch-bot/unit/database-evidence.test.ts
npm run typecheck
node node_modules/eslint/bin/eslint.js --max-warnings=0 scripts/u1-lunch-bot/database-runtime.ts scripts/u1-lunch-bot/database-phase.ts scripts/u1-lunch-bot/database-resume-policy.ts tests/u1-lunch-bot/fixtures/database-checkpoints.ts tests/u1-lunch-bot/fixtures/restart-fixtures.ts tests/u1-lunch-bot/fixtures/postgres-spill.ts tests/u1-lunch-bot/fixtures/database-reporter.ts tests/u1-lunch-bot/integration/postgres-runtime.test.ts tests/u1-lunch-bot/unit/database-resume.test.ts
node node_modules/prettier/bin/prettier.cjs --check scripts/u1-lunch-bot/database-runtime.ts scripts/u1-lunch-bot/database-phase.ts scripts/u1-lunch-bot/database-resume-policy.ts tests/u1-lunch-bot/fixtures/database-checkpoints.ts tests/u1-lunch-bot/fixtures/restart-fixtures.ts tests/u1-lunch-bot/fixtures/postgres-spill.ts tests/u1-lunch-bot/fixtures/database-reporter.ts tests/u1-lunch-bot/integration/postgres-runtime.test.ts tests/u1-lunch-bot/unit/database-resume.test.ts compose.yaml config/versions.json docs/app/database-layer.md docs/app/setup-status.md
bash -n infra/postgres/bootstrap.sh
bash -n infra/postgres/resume-check.sh
```

以下為首次執行前的歷史交接；其中「未執行／無 PGDATA」已由本節實際結果取代，Step 3／4 仍不能標完成。

## Sources

本層沿用 `aidlc/spaces/default/intents/261005-lunch-decision-bot/` 下的 `inception/requirements-analysis/requirements.md` FR1–FR9／NFR1–NFR9、`inception/units-generation/unit-of-work.md` 的唯一 U1／四 owner／九實體、`inception/contract-design/contract-summary.md` C01–C07，以及 `construction/u1-lunch-bot/` 的 functional-spec／rules／entities、NFR logical-components／performance／security／reliability、infrastructure-specification。沒有 User Stories，不虛構 US／AC。

Testing Contract 保持 `sha256:c5dec7fa39fd4eda2b6ded095f4b0fffbf47913be5a50f6db66e2f5003d03b7c`，test-after、全應用行覆蓋率 80% 不變。這是資料模型／runtime 合成驗證，不是 repository、本人權利服務或完整交付。

## 實作與限制

- `db/migrations/001-model.sql` 僅兩 owner schema；migration 擁有表、app 不擁有表、不授權 schema CREATE／DB TEMP／跨 schema／角色提升。QueryHistory 恰七欄，UTC 年份 helper 不依 session timezone；持久非循環 bigint sequence 與控制表分離。
- receipt 的原時間相對首次 receivedAt 前 24h／後 5min，含邊界，直接源於 NFR2 及 C01；不是重新以重送時間設門檻。S31 測兩側邊界。
- 七天 purge、15 分鐘 ref、5 分鐘確認、原 effectiveAt 加 24h due 來自 entities／BR／RD-04。固定欄位 trigger 的空 TG_ARGV 明確視為空陣列；S23 用 bootstrap 嘗試修改歷史證明不是因 app UPDATE 權限不足而假通過。
- **RD-04 的最多 48 次是原期限內 retry 規則**，不是 lifetime DB 計數上限。`attempts` 僅限制非負，S28 驗 overdue 的第 49 次補救仍能記錄；實際 retry 排程留在 Step 7／8，不在 DB 偷加新 gate。confirmation、消費旗標與 write outcome 反向／終態另有 S27／S29／S30。
- `bootstrap.sh` 每次檢查固定 UID/GID、cgroup limits、真正 tmpfs／mode／canonical path／容量；首次隔離 initdb，無 TCP 應用入口。PG17.11／catalog／tablespace OID／路徑／migration hash allowlist 匹配才重建 temp 版本目錄；未知或不完整 PGDATA 拒絕，不重建 DB。
- 每次啟動以 tmpfs 產生當次合成 TLS／SCRAM 憑證，無真實 secret，無 host port。最終僅兩 app 角色走 TLS＋SCRAM，bootstrap 只限受控容器的 local peer socket；沒有 app admin pool。TLS 憑證僅供這個合成 profile，不能用於真人環境。
- 啟動將非個人 storage safety 保持 blocked；資料層通過也不自動解除後續保護／真人 gate。維護／unknown session 的完整服務仍屬後續步驟。
- PG 1 CPU／1GiB、2GiB 同 image 的 PGDATA/WAL、temp tmpfs 128MiB、不新增 volume、不加 root／caps／privileged／Docker socket。Bot 尚未啟動。所有 PG logs 留當次 tmpfs 或丟棄，Docker log driver none；普通輸出只白名單 summary／安全分類。

## 精確有界執行

**尚未執行真 PG 初始化／整合；請主流程使用可見原生核准執行這一條：**

```sh
node scripts/u1-lunch-bot/database-phase.ts verify
```

此入口只用已存在鎖版 Compose／PG image，無 pull／build／install。先檢查 context/socket、Compose SHA、owned image identity／剩餘空間、空掛載及同名資源衝突；透過 Compose 建立本 run internal network 與受限 PG，啟動後再核對實際限制。若初始化已留下 PGDATA，入口會停止，**不刪資料、重掛載或再 initdb**；失敗後需先閱讀安全結果，另行審核下一步。

緊接執行的精確測試等價命令如下；入口以相同已安裝 Vitest binary＋selector 執行，僅對子程序傳入 `U1_DATABASE_TEST=owned-synthetic`。缺 DB／旗標直接失敗，不 skip、不換 fake DB：

```sh
npm run test:integration -- --project u1-lunch-bot-integration --reporter ./tests/u1-lunch-bot/fixtures/database-reporter.ts tests/u1-lunch-bot/integration/schema.test.ts tests/u1-lunch-bot/integration/postgres-runtime.test.ts
```

- schema：七欄／索引／owner、正常 DML、唯一鍵、跨 schema／DDL／TEMP／tablespace／角色拒絕、非法欄位／數值／結果／TTL、UTC 曆年與閏日、immutable／終態／scope／原 due。
- runtime：真 PG17 TLS 成功與錯 CA／錯名／plaintext 拒絕；兩角色實際 400ms statement／transaction／idle timeout、100ms lock、16MiB temp_file_limit。sort 只將 work_mem 減至 64KiB 以強迫 spill，**不放寬上述 timeout／temp_file_limit，不以 admin／SET ROLE 代替 app 執行 sort**。
- 兩角色 sort cursor commit 後保持連線，bootstrap 只觀察 tmpfs 指定 tablespace 的實際 temp file；另驗 16MiB quota 與 tmpfs 剩餘空間不足產生分別 53400／53100，檢查 pg_default 無 temp file、無持久表落 tmpfs。timeout 或不符 SQLSTATE 算失敗，不當預期成功。
- 同 run PGDATA 寫合成 history／barrier／job，再停容器、移除及重建，使 tmpfs marker 全失；system identifier／資料摘要／原 due／sequence 必須保留，再做兩角色 spill／滿額。錯 UID／major／catalog／symlink 用真 bootstrap 拒啟動，非刪 DB；篡改僅限非個人 allowlist／symlink，trap 回復，成功啟動後再核對同 PGDATA 摘要。
- 測試總等待上限 300 秒，310 秒強制結束 runner；成功／失敗／SIGINT／SIGTERM 後只清理 owner/run 匹配的容器與空 network。SIGKILL／host crash 不能保證 cleanup，需人工核對；保留 PGDATA 及 backing image，永不 prune／`down -v`／reformat。

## 檔案清單（供後續 manifest）

新增：`compose.yaml`、`db/roles/bootstrap.sql`、`db/migrations/001-model.sql`、`infra/postgres/postgresql.conf`、`infra/postgres/pg_hba.conf`、`infra/postgres/pg_ident.conf`、`infra/postgres/bootstrap.sh`、`infra/postgres/client.sh`、`infra/postgres/negative-bootstrap.sh`、`infra/postgres/temp-pressure.sh`、`scripts/u1-lunch-bot/database-runtime.ts`、`scripts/u1-lunch-bot/database-phase.ts`、`tests/u1-lunch-bot/fixtures/postgres-spill.ts`、`tests/u1-lunch-bot/integration/schema.test.ts`、`tests/u1-lunch-bot/integration/postgres-runtime.test.ts`、`docs/app/database-layer.md`。修改：`docs/app/setup-status.md`、`config/versions.json`。無刪除。尚不生成 stage completion／source-manifest；最終 manifest 必須包含這些實際檔案。

## 保留資源與未驗證

### 本輪實際檢查

先實作 DB／runtime，再寫真 PG integration；尚待原生執行，32 個 schema＋8 個 runtime 案例只代表已準備，不是通過數。證據 reader 實作後緊接新增及執行 `database-evidence.test.ts`：**11 passed／0 failed／exit 0**。最後 `npm run typecheck`、下列限定 ESLint／Prettier，以及四個 shell 的 `bash -n` 均 **exit 0**。初次 lint 曾因數字 template expression 失敗一次，已修正並重驗；没有把該次 shell 最後一條命令的 exit 0 當成 lint 通過。

```sh
npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/database-evidence.test.ts
npm run typecheck
node node_modules/eslint/bin/eslint.js --max-warnings=0 scripts/u1-lunch-bot/database-runtime.ts scripts/u1-lunch-bot/database-phase.ts tests/u1-lunch-bot/fixtures/postgres-spill.ts tests/u1-lunch-bot/fixtures/database-reporter.ts tests/u1-lunch-bot/unit/database-evidence.test.ts tests/u1-lunch-bot/integration/schema.test.ts tests/u1-lunch-bot/integration/postgres-runtime.test.ts
node node_modules/prettier/bin/prettier.cjs --check scripts/u1-lunch-bot/database-runtime.ts scripts/u1-lunch-bot/database-phase.ts tests/u1-lunch-bot/fixtures/postgres-spill.ts tests/u1-lunch-bot/fixtures/database-reporter.ts tests/u1-lunch-bot/unit/database-evidence.test.ts tests/u1-lunch-bot/integration/schema.test.ts tests/u1-lunch-bot/integration/postgres-runtime.test.ts compose.yaml config/versions.json docs/app/database-layer.md docs/app/setup-status.md
bash -n infra/postgres/bootstrap.sh
bash -n infra/postgres/client.sh
bash -n infra/postgres/negative-bootstrap.sh
bash -n infra/postgres/temp-pressure.sh
```

以上不包含真 PG、SQL 語法／行為驗證、全應用 build／coverage，也沒有重跑既有 57 案例 suite。格式修改皆透過 `apply_patch`。

### 安全 phase 證據

`/u1-evidence` 綁定同 run 的 `${stage}/evidence`，與 PGDATA／raw log 分離；初始化前 wrapper 專門建立 mode0700 目錄與 pending marker，若已有同名證據則停止。bootstrap 用最多 256 bytes 固定 phase／status／category／SQLSTATE 原子替換 `bootstrap.status`，包括工具缺失、TLS CA／server、initdb、隔離啟動、role／model migration、tablespace／catalog／憑證／TCP 啟動。SQL 錯誤只從 tmpfs stderr 取五碼 SQLSTATE，原文不外送。容器退出後 host 仍可讀取此檔；無權寫入或檔案無效則明确 evidence_channel unknown，不推定成功。wrapper 輸出白名單 phase 與本機測試固定 case ID／pass-fail，沒有 raw SQL、參數、位置、credentials 或 assertion diff。

若失敗，保留 partial PGDATA 與 phase 證據供下一次有界修正；不能因 startup 失敗重設資料。證據是固定非個人狀態而非 append-only log，本次交接保留，依既有最長 29 天政策由授權維護清理。新增 `tests/u1-lunch-bot/fixtures/database-reporter.ts` 與 `tests/u1-lunch-bot/unit/database-evidence.test.ts` 也須列入後續 manifest。

本輪代理未執行資源命令，沒有新 runtime session。依最新轉交證據，保留 run `961ab998-0b81-444c-ab33-578c76f008c0` 的 `/private/tmp/u1-lunch-bot-storage-961ab998-0b81-444c-ab33-578c76f008c0/pgdata.dmg` 與 sibling `mount`，尚無 PGDATA；固定 PG image 已在 Docker cache，guest 容器已清理。device 只在每次匹配時使用，不固定成 disk8。

guest 清理後空間未即時恢復；owned 空 image remount 後可用 2122240000 bytes 的事實保留於 setup-status。真正 PG durability／角色存取／IR-02／整合結果、全應用 coverage、安全掃描、CI、真人流程仍未驗證。Step 3／4 不勾選；不進入 Step 5。
