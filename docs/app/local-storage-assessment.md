# U1 本機合成資料庫儲存方案評估

## 建議與邊界

建議下一步驗證**專用 Lima VZ Linux VM＋獨立 2GiB raw 虛擬資料磁碟／ext4＋既有 Docker Compose／PostgreSQL 17**。這是有條件的環境選擇建議；Lima 2.2.1 已由主流程安裝並核對，尚未建立 VM 或取得新磁碟容量證據。採標準 VM／磁碟工具，沿用現有 SQL、容器限制、啟動檢查及測試；不開發 hypervisor，也不增加資料庫種類、Redis、微服務、Kubernetes 或雲端服務。

新環境只建立全新、獨立命名的合成 cluster，使用既有 migrations 及重新產生的合成 fixtures。原 run `961ab998-0b81-444c-ab33-578c76f008c0` 的 image、mount、PGDATA、evidence 全部原地保留；不得複製、搬移、reset、chown、remount、刪除或掛進新 VM。新 run 的成功只證明新環境，不是舊資料遷移、復原、修復或原失敗根因證明。

## Sources

- [U] 本次 Q7 原文：「同意。請先評估替代的本機儲存方案，以能完成目前產品需求、降低不必要的架構複雜度為優先。不要刪除或搬移現有資料，也不要降低既有安全限制。提出建議方案後，若不涉及破壞性操作，可繼續完成 AIDLC workflow。」後續分工已擴至下述最小 storage-only preflight；官方調研與主機盤點由主流程提供，原生執行仍由主流程負責。
- [E] [database-layer.md](database-layer.md) 最新 session 57080／96680／49652，以及 [setup-status.md](setup-status.md) 的 quota 拒絕紀錄。較早章節為歷史，不覆蓋最新交接。
- [S] `compose.yaml`、`scripts/u1-lunch-bot/{storage-policy,storage-host,storage-preflight,database-runtime,database-phase,database-resume-policy,database-bootstrap-evidence}.ts`、`scripts/u1-lunch-bot/guest-storage-probe.sh`、`infra/postgres/`、`tests/u1-lunch-bot/integration/{schema,postgres-runtime}.test.ts`、`tests/u1-lunch-bot/fixtures/{postgres-spill,restart-fixtures}.ts`。本次只讀取相關程式接點，未執行原生環境命令。
- [P] 活動 intent `261005-lunch-decision-bot` 的已核准 U1 Code Plan、unit-test instructions、Testing Contract `sha256:c5dec7fa39fd4eda2b6ded095f4b0fffbf47913be5a50f6db66e2f5003d03b7c`，以及 Infrastructure Specification 的 I-01／I-04、IR-02。規則來源為 `.codex/aidlc-common/stages/construction/code-generation.md` Step 3；目前 state 記錄 Guard Policy 為 `strict`。
- [O] 主流程轉交的官方鎖版文件：[Lima v2.2.1 disk.md](https://raw.githubusercontent.com/lima-vm/lima/v2.2.1/website/content/en/docs/config/disk.md)、[VZ](https://raw.githubusercontent.com/lima-vm/lima/v2.2.1/website/content/en/docs/config/vmtype/vz.md)、[installation](https://raw.githubusercontent.com/lima-vm/lima/v2.2.1/website/content/en/docs/installation/_index.md)。文件描述 `limactl disk create NAME --size SIZE --format raw`、`additionalDisks` 的 `name`／`format: true`／`fsType: ext4`、獨立持久磁碟及 macOS 13 以上的 Virtualization.framework；安裝 archive 可解至其他目錄，QEMU 前置只適用 QEMU driver。本次未重複網路調研。主流程另轉交 archive 下載 session 12022／exit 0、SHA 符合，以及只解至新 install 子目錄的 session 94547／exit 0、limactl version 2.2.1；均不是 VM 或 Docker 安裝完成證據。

## 已知事實與未解問題

| 類別                   | 可支持的結論                                                                                                                                                      | 不能據此推論                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 原環境                 | 普通 local volume 的 `size=2G` 實際遭 `quota size requested but no quota support` 拒絕；固定 2GiB macOS image 後續曾初始化 PG                                     | 不能把普通 named volume 或容器 rootfs 配額當成 PGDATA hard cap                                              |
| 權限與啟動             | session 49652 的 R05 PGDATA owner 分類不符；scratch evidence 目錄曾出現 root／PG 轉譯；最新 96680 最後成功記錄為 `identity started identity_mismatch none`        | 未證實原啟動卡在哪個檢查；不能把最後 checkpoint 當成 identity validation 已失敗，也不能宣稱 FUSE 為已知根因 |
| 最新 scratch           | 57080 三次 write／rename 與身分／工具檢查成功，清理成功，未掛載原資料                                                                                             | 未重現原失敗；`resume-r05` 仍禁止，不能擴大 allowlist 或改寫原 evidence                                     |
| 主機盤點（主流程轉交） | macOS 26.5.2、arm64、16GiB physical memory、8 logical CPU，約 60.4GiB 可用、剩餘約 14%；初始只觀察到 Docker Desktop，後續已另裝 Lima 2.2.1                        | 初始 PATH／常見位置未見 VM 工具；後續 Lima 安裝不代表 VM 已建立，剩餘容量不是負載達標證據                   |
| 官方能力（主流程轉交） | Lima 文件提供 VZ VM、獨立 raw disk 與 ext4 配置途徑                                                                                                               | 尚未證明選定版本可同時符合本案配額、UID、cgroup、重啟、資料隔離及證據通道                                   |
| 版本取得（主流程轉交） | GitHub latest release API 曾兩次 403；其後官方 releases/latest 的 302 指向 v2.2.1，expanded_assets 與 SHA256SUMS 確認下列 Lima artifact；Ubuntu checksum 另行核對 | Lima 下載／SHA／執行版本已核對；Docker 安裝、完整依賴鎖定與平台能力仍待驗                                   |

主流程已核對的固定下載 metadata 與執行狀態（本次僅記錄轉交證據）：

| 項目          | 固定來源／版本                                                                                                                                                                                                 | 已核對內容及限制                                                                                                                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lima          | [v2.2.1 Darwin arm64 archive](https://github.com/lima-vm/lima/releases/download/v2.2.1/lima-2.2.1-Darwin-arm64.tar.gz)；[官方 SHA256SUMS](https://github.com/lima-vm/lima/releases/download/v2.2.1/SHA256SUMS) | SHA256 `9e9eacce88f37e185c346bad73aa6136f738d8cdf8c3bb23cd42b071824bc66e`；HTTP Content-Length `38328082`；12022 下載／SHA 通過，94547 解至 `/private/tmp/u1-lunch-bot-lima-2.2.1` 下的新 install 子目錄並確認版本；尚未建立 VM |
| Ubuntu guest  | Lima v2.2.1 的 `_images/ubuntu-26.04.yaml` 指向 [Ubuntu 26.04 arm64，release-20260927](https://cloud-images.ubuntu.com/releases/resolute/release-20260927/ubuntu-26.04-server-cloudimg-arm64.img)              | SHA256 `63a93bd5a8d76e33b15ceb5daa3657bd79be804748051ab178e643b0f5da22e7`，主流程另與該 Ubuntu release 官方 SHA256SUMS 核對；不得浮動 fallback                                                                                  |
| Docker daemon | 官方 apt resolute arm64 的 docker-ce／docker-ce-cli 均為 `5:29.8.2-1~ubuntu.26.04~resolute`，containerd.io 為 `2.3.6-1~ubuntu.26.04~resolute`                                                                  | 核心套件 metadata 已確認；iptables、nftables、libseccomp2 等完整依賴與 signed apt repo 設定仍待 pin，未安裝 Docker                                                                                                              |

核心 Docker 套件 metadata（主流程轉交，尚未下載／安裝）：

| 套件          | bytes    | SHA256                                                             |
| ------------- | -------- | ------------------------------------------------------------------ |
| containerd.io | 19575880 | `d533efd8996b4d63f066b05f562482c070b431561e569e4c3b38b885ef14f8ce` |
| docker-ce-cli | 15816584 | `519e88d90248c00e5d43cdc747d508931d288288855733d8a3d9b3df577ccda6` |
| docker-ce     | 20872932 | `f1794f13d20d9d051b0053e4213a0401eafd90dd85fba0f2d9c69a71b7d21bc5` |

已安裝 archive 含原生 Linux-aarch64 guest agent，毋須因此下載其他架構 agent；help 確認 raw disk、`create --mount-none`、containerd none 與 VZ 選項。這支持下一步製作**最小 Lima storage-only preflight 設定**，尚未證明 2GiB ENOSPC、UID／fsync 或 IR-02；Docker runtime 接點留待其後實作。

## 四種方案比較

| 方案                             | 可保留項目                                          | 本案成本／限制                                                                                       | 判斷                                                                                   |
| -------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| macOS 固定 image 經 Desktop bind | 原 Compose、PG17、已存在 2GiB image／資料           | owner／evidence 行為與完整 R05 仍未解；繼續診斷不能以放寬權限或重設資料換取通過                      | 保留現況；不以再次盲跑當成新方案                                                       |
| 普通 Docker named volume         | 容器及 PG 程式幾乎不動                              | 本機已觀察無 quota 支援；usage polling、`max_wal_size`、單檔 ulimit 均不能限制 PGDATA＋WAL 合計 2GiB | 不採用無硬上限的普通 volume；若另加受限 backing disk，實質已是新的儲存方案             |
| macOS 原生 PostgreSQL            | SQL／資料模型可能沿用                               | 需替換 Compose、Linux tmpfs／cgroup、UID999 容器及 bootstrap／runtime 測試；無已驗證等價保護         | 不推薦；超出單純環境接點調整，須重設計及重新核准相關計畫                               |
| 專用 Linux VM＋ext4 data disk    | 同一 PG17 image、SQL、容器安全設定及 IR-02 測試語意 | 需安裝與 pin VM／OS／daemon，重做 admission；仍可能遇到容量、權限或時間門檻失敗                      | 優先驗證；將 PGDATA／evidence 留在 guest 原生檔案系統，減少跨 macOS 共享檔案系統的依賴 |

## 建議配置與待驗能力

- VM 固定 **2 CPU／3GiB RAM**；OS raw 磁碟 **12GiB**，**資料磁碟固定 2,147,483,648 bytes**，不得拿 VM 的全部 OS disk 當 PGDATA 配額。預算合計為磁碟 14GiB＋下載上限 4GiB＋host reserve 2GiB，wrapper 實查當下 host 可用空間至少 20GiB。raw 格式或 sparse host 配置本身不保證 host 不會先滿；必須核對 virtual capacity、實際 backing、host reserve 及 guest 滿額結果。主流程觀察 memory pressure 30% free；磁碟剩餘 14% 已低於既有 20% 警示線，不替人清磁碟或自行擴容。
- 只建立新的虛擬磁碟，不使用 host `blockDevices`、實體磁碟、root helper／sudoers 修改。標準 guest 初始 provisioning 如需管理權，只能針對新 VM／空磁碟，權限範圍仍交主流程確認；不可延伸到原 run 或給 PG 容器 root／privileged。
- guest 的 ext4 disk 僅承載新 run PGDATA（含 WAL）。使用其下專用空目錄作 container bind，將 ext4 自身的 `lost+found` 留在掛載根，不刪它也不放寬既有「fresh data root 必須空」契約。不得外接 WAL、一般 tablespace、位置備份或 fallback 到 OS disk。每次啟動／重啟先核對 disk 身分、ext4 mount、canonical path、容量、剩餘空間、UID999／GID999 與 mode；磁碟未掛載時不得悄悄寫進同名 OS 目錄。
- evidence 使用新 guest 私有目錄及既有有界白名單格式；續跑與停止後讀取需保持可行，不能為了 host 讀取而讓 evidence 或 PGDATA 普遍可寫。禁止共享 home、host tmp、原 storage；僅提供選定 source 的唯讀掛載，排除 `.env`、憑證、原 run 與無關目錄。若 runner 在 guest 執行，工作目錄／鎖版依賴位於新的 guest 工作區，不把 macOS `node_modules` 的平台相容性當成既定事實。
- 官方 `docker.yaml` 範本預設的 `curl | get.docker.sh` 未固定內容且採 rootless，**不能原樣套用**。本案優先評估專用 VM 內鎖版標準 rootful Docker daemon，以減少 rootless UID mapping／cgroup 接點；daemon 的管理權限與容器的 UID999 是不同層，不能把 daemon 身分當作容器增權許可。若採 rootless，須先實測映射後 owner、memory／swap／CPU／PID 限制及 bind 寫入／拒絕語意，不因「rootless」名稱直接放行。
- PG 容器仍是 1 CPU／1GiB、memory swap allowance 0、64 PID、16MiB shm、core=0、唯讀 rootfs、UID999／GID999、drop ALL、no-new-privileges、logger none、internal network、無 host port／host network／Docker socket 掛載。daemon 控制只在管理面；不暴露給應用或測試容器。
- 保持 temp tablespace **128MiB tmpfs**、每 session **16MiB temp_file_limit**、互動 statement／transaction／idle-in-transaction **400ms**、lock／checkout **100ms**，以及 DB20／role 4＋7 與後續 pool 4＋6＋1 預算。不以增加 timeout、temp_file_limit、VM 資源或 SQL 權限掩蓋失敗。
- PG image／17.11 行為、兩份 SQL SHA、角色／兩 schema、TLS verify-full、資料權利、同一 run 的 PGDATA 身分及 test-after／80% 全來源覆蓋率不變。VM／OS／Docker／Linux Compose／Node 的新 binary 必須逐一查核精確版本及 digest；現有 Darwin Compose binary 的 SHA 不能充作 Linux binary 的 SHA。

## 最小來源調整接點（後續工作，本次未修改）

| 接點                                                                     | 必要變更與不得省略的核對                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage-policy.ts`、`compose.yaml`                                      | 現在固定舊 UUID／Desktop context／macOS 路徑。加入明確的新 run 設定及新環境選擇，集中少量固定欄位；保留原 descriptor。以獨立 Compose override／產生設定替換新 run 名稱、bind 路徑與 labels，容器目標路徑和 hardening 不變。不得改全域 Docker context 或把舊命令重導新 cluster                                                                                                                      |
| `storage-host.ts`、`storage-preflight.ts`                                | macOS 的 `hdiutil`／`plutil`／Desktop credential helper 不可在 Linux 假成功。新增窄範圍 Linux admission，核對 VM／daemon endpoint、new disk identity、mount／FS、UID、容量與工具 pins；未知 backend／資源碰撞 fail-closed。使用標準 Lima 命令執行，重用既有 bounded command／安全錯誤分類，不建立通用 VM 管理框架                                                                                  |
| `bootstrap.sh`、`guest-storage-probe.sh`                                 | 目前直接要求 `statfs block_size × block_count == 2147483648`；ext4 的 metadata／journal／reserved blocks 可能使可用或回報資料區較小。必須區分「block device 精確 2GiB」與「已核對 ext4 的檔案系統帳目及可用空間」，用同一新 disk 的可核對證據保留 hard cap；不是只把等號換成 `<=`，也不是放大磁碟補 overhead。保持初始至少 1GiB、bootstrap 至少 256MiB 可用等現有門檻，先做實際 ENOSPC／fsync 驗證 |
| `database-runtime.ts`、`database-phase.ts`、`fixtures/postgres-spill.ts` | 多處直接 spawn Desktop CLI／context，須共用同一已驗證的新 run 執行接點；僅改入口與路徑，不改 SQL／斷言／timeout。新 cluster 必須走完整 `verify` 路徑，不能只選 `resume-r05` 而漏 schema suite。若 runner 移至 guest，鎖定同一來源、依賴及 Unit selectors                                                                                                                                           |
| `database-resume-policy.ts`、`database-bootstrap-evidence.ts`            | 現在部分 host owner／path 檢查針對 macOS。新環境應精確核對 guest owner 與有界 evidence 讀取，不接受任意 UID；保留 no-follow／單連結／mode／內容／SQL SHA／catalog／system identifier 檢查及拒絕狀態。舊 `identity started` 絕不因新 backend 而合法化                                                                                                                                               |
| 對應單元測試、`config/versions.json`、應用文件                           | 增加新 run 選擇、錯 endpoint／disk／mount／UID、舊 run 隔離、容量計量、evidence 缺失與 cleanup 歸屬的回歸；依測試契約逐層執行。新 pins 與環境結果分開記錄，不能覆蓋舊失敗或將文件當成 capability 通過                                                                                                                                                                                              |

因此「沿用 Compose／PG」指服務與安全語意相同，並非現有 scripts 可零修改直接搬到 Linux。尤其 ext4 容量計量、`lost+found`、daemon endpoint 與 evidence owner 是實作前必須處理的差異。

## 驗證順序與保留義務

1. 先依已核對的 Lima／Ubuntu metadata 執行下述 **storage-only probe**；更正先前順序：**Docker daemon 與其依賴 pins／安裝留待 storage-only 結果之後**，不是這次探測的前置。新 VM／磁碟操作由主流程在 Q7 已授權範圍及原生權限下執行；本文件不代替下載成功或平台證據。
2. 先在**新磁碟初始化 PG 前**做 UID999 寫入／rename／fsync、容量及真實 ENOSPC，確認沒有落入 OS disk 或 host 共享儲存；清理只限自己的合成探測檔，然後停止本 VM 並鎖定 `format: false`。本次不初始化 PG。之後必須另完成 daemon／runtime 接點及 admission、確認專用 data 目錄空，才用既有 SQL 初始化新 cluster。禁止將滿磁碟探測用在原 cluster。
3. 每個被調整的可測層實作後立即寫並跑其單元測試；接口接通後，重跑 `schema.test.ts`＋`postgres-runtime.test.ts` **完整兩套**。沿用安全 reporter、`u1-lunch-bot-integration` project、300 秒 runner／310 秒終止等既有上限。不得以舊 schema 通過或 scratch 成功補足新 run 結果。
4. R05 在**同一新 run、同一 disk、同一 PGDATA**完成：寫合成 history／barrier／job／原 due／sequence → 兩角色 spill／滿額 → 停 PG、移除及重建容器令 tmpfs 全失 → 核對相同 system identifier／資料 fingerprint／due 與 sequence → 再做兩角色 spill／滿額。新 fixtures 只在新 run 起始產生，不能在重啟中重建 cluster 或重灌 fixtures 冒充保留。
5. 保持 WITH HOLD 磁碟 fallback 的實際拒絕，以及 ordinary sort 在指定 tmpfs 的正大小檔案／完整觀察／pg_default 零 fallback；兩角色均驗 16MiB 與 128MiB 壓力、TLS 錯 CA／錯名／plaintext、錯 UID／major／catalog／symlink 拒啟動。權限拒絕以實際 open 結果證明，不以 `-w`／`SHOW` 取代。
6. 成功／失敗／取消只處理核對為新 run 的容器及 network；保留已初始化的新 PGDATA 與安全狀態，失敗不自動重建、更換 backend 或重試至綠。不得讓 VM disk 的 `format: true`／autoformat 在既有新 PGDATA 的重啟路徑再次格式化；此語意須以選定版本官方資料及測試確認。SIGKILL／host crash 不保證自動清理。

精確整合 suite 仍是既有指引的兩檔 selector；目前原 wrapper 固定舊 run，**尚不能直接用它啟動新 VM**。後續接點完成且 admission 通過才可執行，不在本文件提供會誤觸原 run 的立即執行命令。資料層全通過後才能進 Step 5；本次 Step 3／4 仍未完成。

## 計畫核准判斷

**條件成立時，專用本機 Linux VM 可以是已核准計畫的實作／環境選擇。** 計畫已保留 runtime／VM 的安裝與能力查核，要求單 PG17、Compose、合成隔離及 IR-02，未固定必須使用 macOS bind image。新 run 不碰舊資料，保留全部數值、安全、資料模型、測試與層次順序，僅變更工具接點及 backing filesystem，不必單因選用 Lima 再要求相同 Plan Approval。Q7 已同意先提出建議後，在非破壞且不降安全條件下繼續；主流程已呈現此建議，可繼續最小 preflight，無需為同一調研再加一般核准題。安裝仍需符合工具的原生權限及具體資源範圍。

下列情況則不能以環境選擇名義繼續：需要更改已核准 plan／unit-test instructions／Testing Contract 的內容或其綁定路徑／數字／順序；改用原生 macOS PG、不同 DB、變更角色／SQL hash；放寬配額／timeout／UID／權限／安全與測試門檻；或將 IR-02 改為不同 PGDATA／還原舊副本。依目前 strict 與 Code Generation Step 3，計畫內容變動需要主流程取得重新核准，不能自行修改凍結文件或降低 guard。若只是 backend 不支援既有契約，先回報具體能力缺口，不能靠把失敗斷言刪掉宣稱不需重審。

本次實作不修改核准計畫、SQL、Compose 或既有 runtime，不建立新 VM 資源，也不推進 lifecycle；主流程已安裝 Lima 的事實如前述單列。剩餘工具 pins、native provisioning、guest 權限／容量／重啟實測仍待完成；真人 host／VM 加密、swap／休眠／snapshot／backup 控制及 true readiness、合法來源／真實 API、CI、安全掃描與完整 80%／負載／本人生命週期驗證仍各自未解。新 VM 合成成功不能宣稱 `delivery_verified` 或完整 Unit 交付。

## 最小 storage-only 實作交接

新增 `infra/lima/storage.json`、`infra/lima/storage-probe.py`、`scripts/u1-lunch-bot/lima-storage-{preflight,policy}.ts`；單元測試位於 `tests/u1-lunch-bot/unit/lima-storage-preflight.test.ts` 與 `tests/u1-lunch-bot/fixtures/lima-storage-probe-unit.py`。`config/versions.json` 僅新增相關 `limaStoragePreflight` 記錄，不覆蓋舊失敗。

主流程從 workspace 根目錄執行的**唯一一次性命令**：

```sh
node scripts/u1-lunch-bot/lima-storage-preflight.ts
```

- 此命令尚未執行；不接受任意路徑或既有 home。新 run 為 `238f4c91-5090-433c-9b85-84e0484ae4c0`，`LIMA_HOME=/private/tmp/u1-lima-238f4c915090`、instance `storage`、disk `u1-238f4c91`；完整 UUID 寫入該新 home 的私有 `owner.json`。短 home 避免 macOS socket 104 字元限制。home 已存在即拒絕，不覆蓋、不 resume、不盲重試。
- 核對官方 archive SHA／size、installed limactl／aarch64 guestagent 與 archive 內容、精確版本，再下載固定 Ubuntu image（945530880 bytes）並核對 SHA。`limactl validate` 不加 `--fill`；固定 instance/home 的 disk create、VM create、start 僅一次。缺工具或校驗失敗即停，不下載其他工具、不用浮動 image。
- 子程序白名單環境使用本 run 新 `childhome` 作 `HOME`，父程序及真實使用者 HOME 不變；Darwin cache 因而只可落入私有 childhome。Lima image 指向已核對的本機檔案，不觸發 remote image cache。沒有虛構 `LIMA_CACHE_HOME`／XDG 保證，不繼承 proxy、SSH agent 或其他秘密。
- 無 host mounts、host blockDevices、hostnet／bridged network、host sudo／sudoers／root helper、snapshot／backup；無 Docker／PG。containerd system/user 關閉，升級關閉，dependency provision 使用官方 `skipDefaultDependencyResolution: true`，僅確認 guest 既有 Python3／findmnt／lsblk／blockdev；缺一即失敗。SSH 不載入 host keys、不轉 agent，拒絕所有自動 port forwards。
- guest 管理面 root 僅核對新磁碟與建立專用探測目錄；實際檔案操作降至 UID999／GID999。核對 by-label→partition1→whole device 精確 2GiB、ext4 mount／canonical／no-follow／inode／mode／owner，且 root partition 屬於獨立 12GiB OS disk。允許的第三顆 disk **只限唯讀 CIDATA ISO**：host 私有 `cidata.iso` no-follow 描述符取得大小及 ISO9660 primary volume label，與 guest lsblk 的 size／RO／LABEL／FSTYPE 逐一匹配；拒絕任何额外實體 disk 或可寫 CIDATA。OS file-backed loop 不作實體磁碟計數。
- ext4 partition／filesystem 可小於 2GiB，前提是同一全新 raw／實體虛擬磁碟身分與精確容量均成立；不是放寬成任意 `<=`。至少兩檔累計寫入、fsync／rename，第二檔必須真的發生 ENOSPC；沒有 ENOSPC、EIO、錯 UID 或無法清理都不通過。清理僅限本次 descriptor／inode 核對的探測檔，絕不遞迴刪除資料。
- 成功或可處理失敗後僅停止本次核對的 VM；停止確認後透過標準 `limactl edit` 設定其 `additionalDisks[0].format = false` 並查核，才可回報成功。任何未完成停機／format lock、SIGKILL 或 host crash 均需主流程先查核，不允許直接再 start。保留新 VM／disk／下載／私有狀態；不刪除舊或新資源。
- 輸出只含固定 enum／數值；失敗含 `phase`（`admission/download/validate/disk/create/start/probe/stop/format_lock`）與 `command_failed/evidence_rejected`，不輸出 raw stderr、credential、檔案路徑或 assertion diff。停機／鎖格式失敗會優先顯示該清理階段，不可據先前 probe 結果宣稱成功。主流程保留安全結果時仍遵守既有最長 29 天證據期限。

官方機制依據為主流程核對的 v2.2.1 `pkg/cidata/cidata.TEMPLATE.d/boot.Linux/05-lima-disks.sh`（缺 label 時 `format:true` 可能格式化）、`pkg/driver/vz/vm_darwin.go` 的 `attachDisks()`（CIDATA 為 read-only VirtioBlock，不是必然 TYPE=rom）、`pkg/downloader/downloader.go`（本機檔案不 cache；WithCache 使用 `os.UserCacheDir()`）及 `pkg/limatype/dirnames/dirnames.go`（socket 長度）。未重複網路調研。既有 bounded helper 帶 Desktop 環境耦合且同步，這次只新增小型有界子程序入口，不改舊 helper、不建立通用平台框架。

實作後執行的限定測試命令：

```sh
node node_modules/vitest/vitest.mjs run --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/lima-storage-preflight.test.ts
```

結果 **39/39 通過**，其中一例包含 Python **7** 個 stdlib 單測；涵蓋舊路徑／home 重用、raw 容量與身分、CIDATA、固定錯誤分類、單次 start／stop／format lock、權限與雙檔 ENOSPC 模擬，以及原生 Node strip-only import（不執行 main）。Python fixture 使用小型合成檔與故障注入，不是 2GiB 原生容量證據。實際 VM／guest ENOSPC、Docker／PG、R05、完整 80% coverage 與交付仍**未驗證**；不呼叫原 `verify`／`resume-r05`，Step 3／4 不因此完成。

靜態檢查使用已安裝的鎖版工具：`node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`、限定三個新 TS 檔的 ESLint、限定新 TS／Lima JSON／versions／本文件的 Prettier check；均通過。另以 `node --input-type=module -e "await import('./scripts/u1-lunch-bot/lima-storage-preflight.ts')"` 實際確認原生入口可載入、exit 0，未呼叫 main 或建立資源。尚未執行原生 `limactl validate`，它是交由主流程的一次性命令內的步驟。
