# 午餐決定器：U1 資料模型

## Sources

- [R] `../../../inception/requirements-analysis/requirements.md`：FR1–FR9、NFR1–NFR9。
- [D] `../../../inception/domain-design/components.md`：四元件及九個實體的唯一 owner。
- [C] `../../../inception/contract-design/contract-summary.md`：C01–C07、共享投影、原子順序及分類期限。
- [U] `../../../inception/units-generation/unit-of-work.md`、`../../../inception/units-generation/unit-of-work-story-map.md`：U1，kind: service。
- [Q] `functional-design-questions.md`：Q1、Q2 均採 A，摘要已由本人回覆 Looks correct；確認紀錄 `3e57b73dec5ae98f822423198e76bba1e82c0d451c3b01022f0447d2484a58a6`。

## Model Authority

下方 YAML 是資料形狀及關係的唯一來源；流程／狀態轉換以 functional-spec.md 為準，判斷規則以 rules.md 為準。這是技術中立的邏輯模型，不是資料表或新部署服務。九個 owner 沿用 D；值物件、ref 及控制變體不是額外領域實體。傳出 C01–C07 的訊息仍須遵循已核准契約，不能直接序列化整個內部物件。

```yaml
model:
  unit: u1-lunch-bot
  schema_version: 1
  attribute_conventions:
    required: true 代表該變體必須存在；false 代表依 constraints 決定是否存在，不以 null 冒充可用值
    unique: true 僅指識別範圍唯一；非唯一欄位不得藉外部自行指定的值授權
    defaults: 未列 default 的欄位沒有預設，不以空字串、零、unknown 或 no_save 修補非法輸入
    bounds: 數字必須有限；文字長度與邊界投影沿用 C，共享 Key 為 1 至 128 字元
  logical_types:
    Key: 內部不透明非空識別；不得包含原始使用者 ID、位置、LINE token 或秘密
    Instant: 精確 UTC 時刻；邊界投影為 RFC3339 Z，保留原始事件時間精度
    Order: 可信權威配置的不可回繞遞增整數；邊界為十進位字串，按整數比較
    ConsentVersion: DataPrivacy 簽發的目前版本，邏輯上綁不可變 boundaryOrder 與唯一代碼；外部視為不透明字串
    Latitude: WGS84 有限數值，範圍 -90 至 90 度
    Longitude: WGS84 有限數值，範圍 -180 至 180 度
    ActionRef: 至少 128-bit 隨機不透明代碼；外部為 22 至 64 個 URL-safe 字元，不是 bearer 授權
    Cutoff: 固定值物件，含 cutoffAt 與 cutoffOrder；不得接受使用者自填或確認時重算
    CursorAnchor: 最後輸出的 queryAt 與 historyKey；不含經緯度，不是已授權內容快照
    CleanupEvidence: 每一可控儲存目標的完成或失敗狀態，不含位置、訊息或原始身分
    RecommendationItem: 與 C 的 Recommendation 一致；restaurantKey、name、distanceMeters、openingStatus、reason、mapLink、attribution
  global_constraints:
    - 每個實體由其 owner 寫入；跨元件只能使用 C 的最小投影，不直接讀寫其他 owner 的儲存
    - QueryHistory 的七個欄位是全部持久業務內容；event 關聯、狀態控制及 ref 必須在隔離的短期控制類別
    - 控制資料不得以 purgeAt 更新、重試或重新編碼延長原期限；最長七天，內容不含位置
    - 可刪除參照為邏輯非級聯關係；清除 Receipt、Consent 或 control 不自動複製、救回或刪除無關歷史
    - 不保留 RecommendationQuery、RecommendationResult、RestaurantCandidate 或位置的持久佇列、快取、備份
entities:
  - name: LineEventReceipt
    owner: LineInteraction
    description: 已驗證事件的排他處理與回覆紀錄，不保存原始本文或 token
    identifier: eventKey
    retention: 從第一次 receivedAt 起至 purgeAt，最長七天；重送不延長
    attributes:
      - {name: eventKey, type: Key, required: true, unique: true}
      - {name: originalEventAt, type: Instant, required: true, unique: false}
      - {name: receivedAt, type: Instant, required: true, unique: false}
      - {name: processingState, type: enum, required: true, unique: false, allowed_values: [claimed, processing, completed, failed, abandoned], default: claimed}
      - {name: replyState, type: enum, required: true, unique: false, allowed_values: [not_started, sending, accepted, rejected, unknown], default: not_started}
      - {name: purgeAt, type: Instant, required: true, unique: false}
    constraints:
      - eventKey 唯一綁可信 channel、destination、webhookEventId 及本人；同碼不同可信內容拒絕
      - first claim 原子化；purgeAt 不晚於 receivedAt 加七天
      - processingState 與 replyState 分離，接收成功不等於結果已被 LINE 接受
      - 崩潰或送出紀錄不明不得重放業務；不靠原始位置副本恢復
  - name: RecommendationQuery
    owner: LunchRecommendation
    description: 已通過當次處理許可的短暫搜尋點
    identifier: queryKey
    retention: 當次記憶體，完成或原始十秒期限即釋放
    attributes:
      - {name: queryKey, type: Key, required: true, unique: true}
      - {name: latitude, type: Latitude, required: true, unique: false, min: -90, max: 90}
      - {name: longitude, type: Longitude, required: true, unique: false, min: -180, max: 180}
      - {name: deadline, type: Instant, required: true, unique: false}
    constraints:
      - deadline 投影為 C04 的 deadlineAt；固定於首次 receivedAt 加十秒
      - 無 subject、consentVersion、LINE token 或歷史內容，取消訊號是當次執行上下文而非持久欄位
  - name: RecommendationResult
    owner: LunchRecommendation
    description: 當次推薦或真實來源失敗，與保存結果獨立
    identifier: resultKey
    retention: 當次記憶體，完成或十秒即釋放，不入一年歷史
    attributes:
      - {name: resultKey, type: Key, required: true, unique: true}
      - {name: queryKey, type: Key, required: true, unique: true, references: RecommendationQuery.queryKey}
      - {name: outcome, type: enum, required: true, unique: false, allowed_values: [found, zero_results, source_failure]}
      - {name: candidateKeys, type: ordered_list_Key, required: true, unique: false, references: RestaurantCandidate.candidateKey, min: 0, max: 3}
      - {name: distances, type: ordered_list_number, required: true, unique: false, min: 0, max: 1000}
      - {name: reasons, type: ordered_list_text, required: true, unique: false}
      - {name: mapLinks, type: ordered_list_https_uri, required: true, unique: false}
      - {name: sourceAttributions, type: ordered_list_attribution_list, required: true, unique: false}
      - {name: failureCode, type: enum, required: false, unique: false, allowed_values: [timeout, unavailable, rate_limited, unauthorized, malformed_response, rights_unverified]}
    constraints:
      - resultKey 為當次內部識別，不新增對外契約欄位
      - found 的 distances、reasons、mapLinks、sourceAttributions 均與 candidateKeys 等長為一至三，各索引對應同一店家；restaurantKey 不重複
      - zero_results 與 source_failure 的內容陣列皆空；只有 source_failure 必填 failureCode
      - distances 每個元素是未四捨五入非負公尺值且不大於 1000；不是陣列長度上限
      - C04 restaurants 由各索引組成 RecommendationItem，包含當次候選的名稱、ID、營業狀態
      - 取消或期限已到是 C04 Error，不捏造 RecommendationResult 或保存的結果狀態
  - name: ConsentState
    owner: DataPrivacy
    description: 本人目前告知及保存選擇，不是同意變更歷程
    identifier: subjectKey
    retention: 目前有效狀態，服務終止後三十天內清除
    attributes:
      - {name: subjectKey, type: Key, required: true, unique: true}
      - {name: savingChoice, type: enum, required: true, unique: false, allowed_values: [unselected, save, no_save], default: unselected}
      - {name: noticeVersion, type: Key, required: true, unique: false}
      - {name: consentVersion, type: ConsentVersion, required: true, unique: true}
      - {name: changedAt, type: Instant, required: true, unique: false}
    constraints:
      - 不存在狀態只可形成未選擇視圖；讀取失敗不能使用預設 unselected 或 no_save 掩蓋
      - consentVersion 的 boundaryOrder 是目前選擇 LP 的順序，不存舊版本歷程；轉為契約字串不得帶本人識別
      - noticeVersion 非現行已授權用途時先重新告知，不外傳位置或簽發保存 permit
      - applyChoice 原子取代目前版本並失效舊 permit；changedAt 為可信提交界線，不是使用者輸入
  - name: QueryHistory
    owner: DataPrivacy
    description: 本人同意後的新主動查詢，只含最小白名單
    identifier: historyKey
    retention: queryAt 起 UTC 一個曆年；刪除或到期立即不可讀、最遲二十四小時清除
    attributes:
      - {name: historyKey, type: Key, required: true, unique: true}
      - {name: subjectKey, type: Key, required: true, unique: false, references: ConsentState.subjectKey}
      - {name: queryAt, type: Instant, required: true, unique: false}
      - {name: latitude, type: Latitude, required: true, unique: false, min: -90, max: 90}
      - {name: longitude, type: Longitude, required: true, unique: false, min: -180, max: 180}
      - {name: expiresAt, type: Instant, required: true, unique: false}
      - {name: resultSummary, type: enum, required: true, unique: false, allowed_values: [found, zero_results, source_failure]}
    constraints:
      - historyKey 由權威 event 身分穩定對應且不可反推位置；同一事件至多一筆，跨人不可碰撞或指定
      - queryAt 等於原始已驗證事件時間，expiresAt 由 DataPrivacy 計算且不可延長
      - 七欄以外無餐廳清單、位置名稱、原始訊息、eventKey、同意版本或長期控制索引
      - 實體有內容不等於可讀，所有出口必須經即時權利／刪除／期限過濾；不暴露裸儲存存取
  - name: DeletionConfirmation
    owner: DataPrivacy
    description: 固定本人及刪除範圍的五分鐘確認
    identifier: confirmationKey
    retention: 動作五分鐘有效；無位置控制紀錄最長 issuedAt 起七天
    attributes:
      - {name: confirmationKey, type: ActionRef, required: true, unique: true}
      - {name: subjectKey, type: Key, required: true, unique: false, references: ConsentState.subjectKey}
      - {name: historyKey, type: Key, required: false, unique: false, references: QueryHistory.historyKey}
      - {name: scope, type: enum, required: true, unique: false, allowed_values: [one, all]}
      - {name: cutoff, type: Cutoff, required: true, unique: false}
      - {name: issuedAt, type: Instant, required: true, unique: false}
      - {name: expiresAt, type: Instant, required: true, unique: false}
      - {name: confirmationState, type: enum, required: true, unique: false, allowed_values: [pending, cancelled, accepted, expired], default: pending}
      - {name: cleanupKey, type: Key, required: false, unique: false, references: CleanupJob.cleanupKey}
      - {name: purgeAt, type: Instant, required: true, unique: false}
    constraints:
      - scope one 必須 historyKey，scope all 禁止 historyKey；不能用空值轉成 all
      - cutoff 在 issueDeletion LP 形成；expiresAt 等於 issuedAt 加五分鐘，now 等於 expiresAt 已過期
      - accepted 必須 cleanupKey；取消不生成清除工作，重複操作只讀已核實終態
      - 有效 ref 仍須每次本人授權；不可因回覆遺失重建確認或改 cutoff
  - name: HistoryWriteControl
    owner: DataPrivacy
    description: 保存、冪等、刪除屏障及動作 ref 的隔離短期控制變體，不含位置
    identifier: controlKey
    retention: createdAt 起不超過七天；actionExpiresAt 或 deadlineAt 可更早停用
    attributes:
      - {name: controlKey, type: Key, required: true, unique: true}
      - {name: kind, type: enum, required: true, unique: false, allowed_values: [admission, permit, deletion_barrier, cursor, choice_ref, delete_ref]}
      - {name: subjectKey, type: Key, required: true, unique: false, references: ConsentState.subjectKey}
      - {name: eventKey, type: Key, required: false, unique: false, references: LineEventReceipt.eventKey}
      - {name: historyKey, type: Key, required: false, unique: false, references: QueryHistory.historyKey}
      - {name: originalEventAt, type: Instant, required: false, unique: false}
      - {name: acceptedOrder, type: Order, required: false, unique: false}
      - {name: consentVersion, type: ConsentVersion, required: false, unique: false}
      - {name: deletionCutoff, type: Cutoff, required: false, unique: false}
      - {name: writeOutcome, type: enum, required: false, unique: false, allowed_values: [not_attempted, saved, not_saved, unknown]}
      - {name: noticeVersion, type: Key, required: false, unique: false}
      - {name: deadlineAt, type: Instant, required: false, unique: false}
      - {name: consumed, type: boolean, required: false, unique: false}
      - {name: action, type: enum, required: false, unique: false, allowed_values: [next, choice_save, choice_no_save, delete_one]}
      - {name: cursorAnchor, type: CursorAnchor, required: false, unique: false}
      - {name: actionExpiresAt, type: Instant, required: false, unique: false}
      - {name: createdAt, type: Instant, required: true, unique: false}
      - {name: purgeAt, type: Instant, required: true, unique: false}
    constraints:
      - admission 必填 eventKey、originalEventAt、acceptedOrder、deadlineAt；每 subject/event 至多一份，重送沿用
      - permit 必填 eventKey、historyKey、originalEventAt、acceptedOrder、consentVersion、noticeVersion、deadlineAt、consumed、writeOutcome；由 DataPrivacy 產生而非外部傳入
      - permit 初始 consumed false 與 not_attempted；消費、寫入與結果同一 LP，not_saved 只代表已證實未提交
      - deletion_barrier 必填 deletionCutoff；單筆必須 historyKey，eventKey 僅在短期關聯仍存在時使用；全部不攜位置或一年長度的事件清單
      - cursor 必填 action next、cursorAnchor、actionExpiresAt；controlKey 符合 ActionRef，有效期簽發起十五分鐘，不滑動展延
      - choice_ref 必填 choice action、noticeVersion、consentVersion、actionExpiresAt、consumed，十五分鐘內且版本相符才可更新
      - delete_ref 必填 historyKey、action delete_one、actionExpiresAt；十五分鐘內且目前仍可用才可建立確認
      - 變體非必要欄位禁止填入；ref 不帶位置，cursor 不是永久查詢索引
      - 序列權威不得依控制列 TTL 重設或重用 Order；後續平台須證明跨重啟的單調性
  - name: CleanupJob
    owner: DataPrivacy
    description: 無位置的清除工作及可控目標完成證據
    identifier: cleanupKey
    retention: 首次 createdAt 起至 purgeAt 最長七天；重試不延長，dueAt 仍由原始 effectiveAt 決定
    attributes:
      - {name: cleanupKey, type: Key, required: true, unique: true}
      - {name: subjectKey, type: Key, required: true, unique: false, references: ConsentState.subjectKey}
      - {name: scope, type: enum, required: true, unique: false, allowed_values: [one, all, expiry]}
      - {name: historyKeys, type: set_Key, required: true, unique: false, references: QueryHistory.historyKey}
      - {name: cutoff, type: Cutoff, required: false, unique: false}
      - {name: createdAt, type: Instant, required: true, unique: false}
      - {name: effectiveAt, type: Instant, required: true, unique: false}
      - {name: dueAt, type: Instant, required: true, unique: false}
      - {name: cleanupState, type: enum, required: true, unique: false, allowed_values: [purging, complete, failed], default: purging}
      - {name: lastFailureClass, type: safe_error_category, required: false, unique: false}
      - {name: evidence, type: CleanupEvidence, required: true, unique: false}
      - {name: purgeAt, type: Instant, required: true, unique: false}
    constraints:
      - one 必須一個 historyKey；all 必須固定 cutoff，historyKeys 只是分批工作鍵，不改原始範圍
      - expiry 可依本人分批；每筆自各自 expiresAt 起算，批次 effectiveAt/dueAt 採其中最早值，不延長其他成員義務
      - dueAt 等於 effectiveAt 加二十四小時；到期工作即使稍後被掃描發現亦不得以發現時刻重算
      - createdAt 是首次建立控制工作的時刻，遲發現不能改已超時的 dueAt；重試不重設 createdAt 或 purgeAt
      - evidence 只有儲存目標代碼及狀態，不複製被清內容；complete 需全數可控目標成功
      - 工作到期或不存在不能當作清除證明；過期控制清除前須確保不可讀殘留不會重新開放
  - name: RestaurantCandidate
    owner: RestaurantSourceAdapter
    description: 當次來源投影的候選；營業未知不能變成 open
    identifier: candidateKey
    retention: 當次記憶體，完成或十秒即釋放，不新增持久來源快取
    attributes:
      - {name: candidateKey, type: Key, required: true, unique: true}
      - {name: providerKey, type: Key, required: true, unique: false}
      - {name: restaurantKey, type: Key, required: true, unique: false}
      - {name: name, type: nonempty_text, required: true, unique: false}
      - {name: category, type: enum, required: true, unique: false, allowed_values: [restaurant]}
      - {name: latitude, type: Latitude, required: true, unique: false, min: -90, max: 90}
      - {name: longitude, type: Longitude, required: true, unique: false, min: -180, max: 180}
      - {name: openingInfo, type: enum, required: true, unique: false, allowed_values: [open, unknown, closed, permanently_closed]}
      - {name: mapLink, type: verified_https_uri, required: true, unique: false}
      - {name: attribution, type: list_nonempty_text, required: true, unique: false}
      - {name: observedAt, type: Instant, required: true, unique: false}
    constraints:
      - openingInfo 投影為 C05 openingStatus；缺營業資訊經明確映射為 unknown，不是一般非法值預設
      - restaurantKey 是可證明的穩定店家 ID，不用候選序號或名稱猜測合併；來源別名映射待選型證據
      - candidateKey 只識別候選出現項，完全相同店家仍可有不同 candidateKey
      - observedAt 是資料觀測時刻，不證明即時營業或權威修訂先後
      - mapLink 需 C 的網域、HTTPS 與來源權利檢查；無法合法呈現必要標示的資料不當作可用
relationships:
  - {from: ConsentState, to: QueryHistory, cardinality: one-to-many, direction: owner-to-history, constraint: 本人關聯不授予直接查閱，不做級聯復原}
  - {from: ConsentState, to: HistoryWriteControl, cardinality: one-to-many, direction: current-choice-to-control, constraint: 舊版本 permit 失效而非回填}
  - {from: ConsentState, to: DeletionConfirmation, cardinality: one-to-many, direction: owner-to-confirmation, constraint: 保存撤回不取消本人刪除權}
  - {from: ConsentState, to: CleanupJob, cardinality: one-to-many, direction: owner-to-job, constraint: 不向其他本人呈現}
  - {from: LineEventReceipt, to: HistoryWriteControl, cardinality: zero-or-one-to-many, direction: receipt-to-controls, constraint: 非事件型 ref 無 receipt，參照不延長七天或反向讀取內容}
  - {from: RecommendationQuery, to: RecommendationResult, cardinality: one-to-zero-or-one, direction: query-to-result, constraint: 未完成或取消可無 result}
  - {from: RecommendationResult, to: RestaurantCandidate, cardinality: many-to-many, direction: result-to-candidate, constraint: 本輪實際選中零至三個不同店家，皆為短暫關係}
  - {from: QueryHistory, to: DeletionConfirmation, cardinality: zero-or-one-to-many, direction: history-to-confirmation, constraint: all 沒有單筆引用，目標清除後引用可失效}
  - {from: QueryHistory, to: CleanupJob, cardinality: many-to-many, direction: history-to-job, constraint: 工作引用不保存內容且重疊清除冪等}
```

## Entity Summary

| 類別 | 實體 | 保留與存取 |
| --- | --- | --- |
| 短暫推薦 | RecommendationQuery、RecommendationResult、RestaurantCandidate | 僅當次必要記憶體，不向歷史或診斷複製 |
| 本人業務資料 | ConsentState、QueryHistory | 目前選擇與白名單歷史；本人權利每次重驗 |
| 短期控制 | LineEventReceipt、DeletionConfirmation、HistoryWriteControl、CleanupJob | 無位置、最長七天；更短操作期限另算 |

HistoryWriteControl 的變體承接 C 已有 permit、cursor、choice_ref、delete_ref 與刪除屏障，沒有新增公開操作。ConsentVersion 的內部 boundaryOrder 是本階段選定的邏輯表示；NFR／Infrastructure Design 仍須選出能原子配置順序、目前版本及期限 fencing 的平台，不能把此表示當作能力已存在。

## Assumptions & Open Questions

供應方映射、加密／識別機制、全域或等效序列權威、實體隔離與備份政策尚未選定。允許的序列實作之一是無個人資料的全域單調序號，各本人取其子序列；不得以七天控制資料到期重設 per-person 序號。任何方案仍須滿足 C 的同一 LP 與失敗語意。這些是後續必須證明的能力，不是新的產品回答或已建置成果。
