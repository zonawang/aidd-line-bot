**Collaborator:** aidlc-devsecops-agent

## Contribution

本稿僅為 Practices Discovery Step 3 的獨立文件審查，尚未經人類確認。已讀四份主筆初稿及指定上游文件；未執行安全掃描、測試、安裝或外部查核。Greenfield、技術欄位 `Unknown`、實務確認時間空白，且 team／project 仍為註解模板；應用檔案缺席的盤點引用主筆 `evidence.md`，並非本角色重新掃描。框架設定、persona 工具範例與 sensors 開啟均不證明 Bot 已具備安全管線。[D][W][M][K]

### 基線與提案界線

- **既有產品基線**：SCP-04–SCP-09 已要求保存選擇、可靠本人辨識、隔離、來源驗證、重複事件處理、提前／到期刪除及復原後不重新可見；一般診斷不可複製完整位置、訊息或憑證。這些保護須在真人試用前成立，不能因掃描工具未定而延期；OUT-05 仍排除正式上線。[P]
- **組織預設的明確要求**：`org.md` 的 Code Style 已寫明 lint 在合併前 CI 執行、失敗阻擋 PR；這不是此次新增同意，也不是已有實作。formatter 依專案設定／語言選擇，但 org 未明文要求格式檢查阻擋合併。建議修正主筆 Code Style 的「格式及 lint 納入合併前 CI」來源分類，並在 Testing Posture 將既有 lint 要求與新增掃描門檻分開。[M][D]
- **專業建議、未確認**：秘密／依賴掃描、SAST／DAST、供應鏈實作及下列額外阻擋條件是落實安全基線的候選做法；不直接加入 `discovered-rules.md` 的人類硬限制，也不把知識庫範例升格成團隊共識。[F][K]

### 掃描適用性與建議阻擋條件

下表均為待訪談的管線提案，沒有建立或啟用任何門檻。

| 項目 | 適用範圍與時機 | 建議阻擋條件／尚待確認 |
| --- | --- | --- |
| 秘密掃描 | 本機提交前檢查加 CI 備援；涵蓋程式、設定、文件、測試資料及交付產物，不能只掃應用副檔名。CI 變更掃描外另定完整掃描範圍 | 確認為有效憑證的發現阻擋合併／交付，先撤銷與輪替，不能只刪文字；未分類發現不得默認通過。工具、範圍及處置責任未知；不為驗證發現而擅自呼叫供應方 |
| 依賴掃描 | 應用 manifest／lockfile 建立後涵蓋直接、間接及開發依賴，每次建置與定期重掃；產出可追溯版本清單或 SBOM | 建議 Critical／High 發現完成風險處置前阻擋；已知可利用漏洞優先處理。可達性、修補可用性與限期例外另記，開發依賴仍可能控制 CI。採容器／IaC 時再加入相應掃描，不預設已有該架構 |
| SAST（原始碼安全分析） | 選定語言後在 PR 分析 webhook、歷史存取、刪除與供應方介接；安全規則與版本須可追溯 | 建議已確認 Critical／High 問題阻擋合併。一般 lint 不能替代 SAST；SAST 通過也不能證明同意、本人隔離與刪除語意正確，須保留 SCP-09 的針對性測試 |
| DAST（執行中服務安全測試） | Bot 即使沒有網站，HTTP webhook／歷史入口仍適用；等受控非正式環境可用，再測來源驗證、輸入邊界、越權與重送 | 建議嚴重發現阻擋該測試版本對真人開放；不新增 production 發布目標。目標擁有者授權、網域允許清單、測試身分、流量／費用限制及停止條件未定；不得掃 LINE 或餐廳供應方服務 |

新增檢查若成為必要門檻，建議區分「通過／有發現／未執行或失敗／有理由的不適用」；工具缺席、逾時、無法取得漏洞資料庫或掃描涵蓋為零，均不可寫成通過。例外須有範圍、理由、負責人、到期及重驗條件；核可者與期限尚未確認，例外不能取消既有位置資料保護。[assumption][K][P]

### lint／format 與供應鏈

建議本機與 CI 使用版本控管的相同設定及鎖定版本，CI 格式檢查採唯讀模式；格式不符是否阻擋屬新增提案。linter／formatter 的外掛、可執行設定、套件安裝腳本及 CI action 都是程式執行入口：採可信套件來源與 lockfile 驗證，CI action／映像使用不可變參照，審查工具及規則更新，限制安裝腳本與 runner 權限；分析不受信任 PR 時不提供部署憑證或寫入權限。避免臨時抓取 `latest` 工具、在帶有秘密的工作中執行任意 PR 設定。尚未選定語言、套件管理器或 CI，不能指定某品牌已可用。[assumption][K][W]

### 敏感位置資料保障

建議將 SCP-04–SCP-09 轉成可驗證檢查：無效／缺少來源驗證不得觸發查詢或保存；兩個合成身分不能互讀互刪；拒絕／撤回保存不新增歷史；刪除、到期及必要復原後均不可讀。優先使用合成位置，檢查失敗路徑的日誌、trace、錯誤報告、CI 附件與掃描證據不洩漏位置、身分連結或 token；秘密掃描無法可靠辨認座標及位置歷史，不能取代資料流審查。[P][assumption]

加密傳輸／儲存、環境間憑證分離、最小存取權限及安全注入秘密是建議落地控制，具體機制仍待設計。另需釐清暫存、佇列、死信、備份與復原若被採用時的生命週期；一年本人歷史保存不能自動套用至診斷、掃描報告或供應方完整回應。真人資料、原始碼、套件清單或發現內容傳至外部掃描服務的允許範圍須另確認，不從文件審查授權推導。[P][K][assumption]

## Positions

- AGREE: 保留 Greenfield／未確認標記，且不把框架工具視為應用證據；四份初稿尚不代表安全掃描已實施。
- AGREE: 真人試用前完成同意、隔離與完整清除生命週期，並維持不正式上線及真實整合授權界線；符合 SCP-04–SCP-09、OUT-05。
- OBJECT: Code Style 把格式 CI 與 lint 一併歸為 org 明文預設不精確；lint 失敗阻擋已有依據，格式阻擋與新增掃描政策須獨立標為提案。
- OBJECT: Testing Posture 只寫「評估依賴與秘密掃描」不足以形成可操作實務；需補 SAST／DAST 適用時機、工具失敗處理、供應鏈權限與敏感位置證據保護。

## Sources

以下 `<record>` 指 `aidlc/spaces/default/intents/261005-lunch-decision-bot`，`<stage>` 指其 `inception/practices-discovery`。

- [D] `<stage>/team-practices.md`、`<stage>/discovered-rules.md`、`<stage>/evidence.md`、`<stage>/practices-discovery-timestamp.md`：四份 Step 2 初稿，timestamp 仍為 `Draft`。
- [P] `<record>/ideation/approval-handoff/initiative-brief.md`、`<record>/ideation/scope-definition/scope-document.md`、`<record>/ideation/scope-definition/intent-backlog.md`：SCP-04–SCP-09、OUT-05、INT-01–INT-06。上游核准狀態依 [W]；沿用產品限制不表示新實務已同意。
- [W] `<record>/aidlc-state.md`、`.codex/scopes/aidlc-line-lunch-decision-bot.md`：Greenfield、技術未知、CI 在範圍內、Operation 略過；scope 不指定 stack／部署目標。
- [M] `aidlc/spaces/default/memory/org.md`（派工提供全文）、`aidlc/spaces/default/memory/team.md`、`aidlc/spaces/default/memory/project.md`：組織預設與未填實務模板；另遵循派工提供的 Inception guardrails。
- [F] `.codex/aidlc-common/stages/inception/practices-discovery.md` Step 3、`.codex/aidlc-common/protocols/stage-protocol-ensemble.md` §11：獨立支持審查與輸出契約。
- [K] `.codex/agents/aidlc-devsecops-agent.md`、`.codex/agents/aidlc-devsecops-agent.toml`；`.codex/knowledge/aidlc-shared/` 全部九份 Markdown 與 `.codex/knowledge/aidlc-devsecops-agent/` 的 `devsecops-pipeline-patterns.md`、`nfr-requirements-guide.md`、`security-guide.md`、`threat-modelling-stride.md`。相應 active-space knowledge 子目錄無可讀補充；均為方法來源，不是專案實施證據。
- [assumption] 本角色提出的工具、控制及額外阻擋門檻，供主筆整合與後續訪談，未新增人類同意。

## Assumptions & Open Questions

以下為交回主筆的訪談缺口，沒有在本輪向使用者提問或代填答案：

1. **工具與授權**：可用 CI／掃描服務、語言支援、授權費、執行位置及外傳資料範圍；誰負責選型、規則維護、憑證保管與輪替？
2. **門檻與處置**：除既有 lint 要求外，是否採格式／秘密／依賴／SAST 的建議阻擋政策；嚴重度、誤報複核、修補期限、限期例外核可者及掃描不可用時如何處理？
3. **受控動態驗證**：誰擁有及授權 DAST 目標；可用非正式環境、合成身分、第三方呼叫隔離、流量／費用限制與停止責任為何？工具尚不可用時如何保留未驗證狀態？
4. **資料生命週期**：一年曆年邊界、清除時限、撤回後既有資料義務、副本／暫存／復原處置；日誌與安全證據的允許欄位、存取者及保存期限為何？不重開已確認的一年可選保存與本人權利。
