# 午餐決定器 LINE Bot：介面契約

## Sources

- [units] `../units-generation/unit-of-work.md`、`../units-generation/unit-of-work-dependency.md`：唯一單元 U1／`u1-lunch-bot`，共同版本／部署，零跨 Unit 邊；四元件、九實體歸屬與三條內部呼叫不變。
- [components] `../domain-design/components.md`：元件責任、短暫資料、本人授權、可信受理順序與原子保存要求。
- [requirements] `../requirements-analysis/requirements.md`：全部 FR1–FR9、子需求、NFR1–NFR9 及 OQ1–OQ10。
- [decisions] `../domain-design/decisions.md`：ADR-001–ADR-006；ADR-004 細化保存不明，不回改上游 FR4.3 或宣稱 requirements 審查 R-01 已關閉。
- [Q1]–[Q4] `contract-design-questions.md`：四題均採 A，逐題原文「同意」；本人另以 `Looks correct` 確認摘要，確認紀錄 `006b4daae249c898ffda54a9dfefd98c5651352ef6fc3224cc019a417abc0025`。
- [LINE-REF] [LINE Messaging API reference](https://developers.line.biz/en/reference/messaging-api/)，2026-10-05 查閱官方 [Markdown 版本](https://developers.line.biz/en/reference/messaging-api/index.html.md)；使用 Webhooks、Common properties、Location、Postback event、Send reply message、Quick reply、Text message、Postback action、Retrying an API request 章節。
- [LINE-SIG] [Verify webhook signature](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)，2026-10-05 查閱；原始本文的 HMAC-SHA256／Base64 驗證，解析前不可改動。
- [LINE-RECV] [Receiving messages](https://developers.line.biz/en/docs/messaging-api/receiving-messages/)，2026-10-05 查閱；非同步事件處理建議及重送語意。官方一般儲存範例不覆蓋本案不持久保存原始本文的限制。

## Scope and Conventions

這是介面及行為契約，不是完整資料庫 schema、平台選型或已實作能力。雖只有一個 Unit，LINE 是 webhook 的外部呼叫者，故需正式 HTTP 契約。C03–C05 是程序內呼叫，不變成網路服務；C07 不新增公開管理 API 或獨立 worker。沒有推薦／歷史 REST API、群組功能、推播、位置佇列或歷史備份。[units][components]

各個 fenced block 是可分別解析的規格文件：HTTP 使用 OpenAPI 3.1；程序內邊界以 JSON Schema 2020-12 定義訊息，`x-operations` 指定操作及輸入／輸出。`urn:lunch:...:v1` 是本文件內規格識別，不是網路網址；工具化時必須把各 block 註冊為同一 schema registry，不能嘗試上網下載 URN。共享型別只共用定義，不共用存取權限。[Q1]

- UTC 時刻使用 RFC3339、`Z` 結尾；原始 LINE 毫秒 timestamp 轉換不得換成重送時間。所有數字需為有限值；不接受重複 JSON key、數字字串或隱式型別轉換。
- `subjectKey` 是可信 LINE 使用者的內部不透明關聯，不是原始 user ID；`eventKey` 綁已驗證 channel／destination／webhookEventId，與本人一致。映射及密鑰機制由後續設計證明，不向餐廳來源、診斷或按鈕傳送身分。
- `deadlineAt = receivedAt + 10 秒`，不因元件呼叫、重送或重試重新起算；程序內另用單調時鐘執行剩餘預算與取消。回覆必須預留在截止前完成送出的時間，不能等到第十秒才開始錯誤回覆。
- 對外新增的非必要欄位可忽略；白名單投影後才進入內部 schema。內部訊息拒絕未定義欄位以防位置／秘密意外流入；共同發布新增可選欄位時同步更新 schema。未知動作、選擇及安全狀態一律拒絕，不用預設值轉成許可。[Q1]

## Contracts

| # | Provider Unit | Consumer | Mechanism | Owner |
| --- | --- | --- | --- | --- |
| C01 | U1／LineInteraction | External: LINE Platform | HTTPS POST webhook，OpenAPI | U1 的 LineInteraction；LINE 擁有事件格式 |
| C02 | External: LINE Messaging API | U1／LineInteraction | HTTPS POST reply，OpenAPI 使用子集 | LINE 擁有遠端 API；LineInteraction 擁有本案映射／重送防護 |
| C03 | U1／DataPrivacy | U1／LineInteraction | 程序內請求／結果、共享 schema | DataPrivacy；LINE 入口只能提供可信上下文，不能代授權 |
| C04 | U1／LunchRecommendation | U1／LineInteraction | 程序內限時請求／結果、共享 schema | LunchRecommendation |
| C05 | U1／RestaurantSourceAdapter | U1／LunchRecommendation | 程序內來源查詢／結果、共享 schema | RestaurantSourceAdapter |
| C06 | External: 合法餐廳資料來源（待選） | U1／RestaurantSourceAdapter | 待選供應方協定；本案出口資料白名單 | 供應方擁有遠端協定；Adapter 擁有轉換與最小化 |
| C07 | U1／DataPrivacy | External: 受信任執行環境清除觸發 | 受保護的內部呼叫／觸發訊息，不公開 HTTP | DataPrivacy 擁有清除及結果；環境擁有觸發身分 |

共七個邊界：一個外部進站 API、兩個外部出站依賴、三個內部元件介面、一個清除觸發邊界。C06 遠端供應方尚未選定，不偽造其 HTTP endpoint；C07 可由 U1 內的排程或授權環境呼叫，傳輸／身分機制待選，不是已建立資源。[units]

## Shared Message Definitions

下列型別是邊界投影，不是新增領域實體或資料表。`HistoryItem` 僅對本人回傳，不可送餐廳來源；`Candidate`／`RecommendationResult` 限當次處理，不存入一年歷史。[requirements FR5.2][components]

```yaml shared-schema
$schema: https://json-schema.org/draft/2020-12/schema
$id: urn:lunch:shared:v1
$defs:
  Key: {type: string, minLength: 1, maxLength: 128}
  Instant: {type: string, format: date-time, pattern: 'Z$'}
  Order: {type: string, pattern: '^[0-9]+$'}
  Version: {type: string, minLength: 1, maxLength: 128}
  ActionRef: {type: string, pattern: '^[A-Za-z0-9_-]{22,64}$'}
  Position:
    type: object
    additionalProperties: false
    required: [latitude, longitude]
    properties:
      latitude: {type: number, minimum: -90, maximum: 90}
      longitude: {type: number, minimum: -180, maximum: 180}
  Context:
    type: object
    additionalProperties: false
    required: [subjectKey, eventKey, originalEventAt, receivedAt, deadlineAt]
    properties:
      subjectKey: {$ref: '#/$defs/Key'}
      eventKey: {$ref: '#/$defs/Key'}
      originalEventAt: {$ref: '#/$defs/Instant'}
      receivedAt: {$ref: '#/$defs/Instant'}
      deadlineAt: {$ref: '#/$defs/Instant'}
  Error:
    type: object
    additionalProperties: false
    required: [kind, code]
    properties:
      kind: {const: error}
      code:
        enum: [invalid_input, forbidden, not_available, expired_action, stale_action,
          settings_unavailable, storage_unavailable, deadline_exceeded, outcome_unknown]
  HistoryItem:
    type: object
    additionalProperties: false
    required: [historyKey, queryAt, position, expiresAt, resultSummary]
    properties:
      historyKey: {$ref: '#/$defs/Key'}
      queryAt: {$ref: '#/$defs/Instant'}
      position: {$ref: '#/$defs/Position'}
      expiresAt: {$ref: '#/$defs/Instant'}
      resultSummary: {enum: [found, zero_results, source_failure]}
  Candidate:
    type: object
    additionalProperties: false
    required: [candidateKey, providerKey, restaurantKey, name, category, position, openingStatus, mapLink, attribution, observedAt]
    properties:
      candidateKey: {$ref: '#/$defs/Key'}
      providerKey: {$ref: '#/$defs/Key'}
      restaurantKey: {$ref: '#/$defs/Key'}
      name: {type: string, minLength: 1}
      category: {const: restaurant}
      position: {$ref: '#/$defs/Position'}
      openingStatus: {enum: [open, unknown, closed, permanently_closed]}
      mapLink: {type: string, format: uri, pattern: '^https://'}
      attribution: {type: array, items: {type: string, minLength: 1}}
      observedAt: {$ref: '#/$defs/Instant'}
  Recommendation:
    type: object
    additionalProperties: false
    required: [restaurantKey, name, distanceMeters, openingStatus, reason, mapLink, attribution]
    properties:
      restaurantKey: {$ref: '#/$defs/Key'}
      name: {type: string, minLength: 1}
      distanceMeters: {type: number, minimum: 0, maximum: 1000}
      openingStatus: {enum: [open, unknown]}
      reason: {type: string, minLength: 1}
      mapLink: {type: string, format: uri, pattern: '^https://'}
      attribution: {type: array, items: {type: string, minLength: 1}}
  QueryResult:
    oneOf:
      - type: object
        additionalProperties: false
        required: [kind, restaurants]
        properties:
          kind: {const: found}
          restaurants: {type: array, minItems: 1, maxItems: 3, items: {$ref: '#/$defs/Recommendation'}}
      - type: object
        additionalProperties: false
        required: [kind]
        properties:
          kind: {const: zero_results}
      - type: object
        additionalProperties: false
        required: [kind, code]
        properties:
          kind: {const: source_failure}
          code: {enum: [timeout, unavailable, rate_limited, unauthorized, malformed_response, rights_unverified]}
```

格式只是必要條件。距離算法、店家識別映射、來源允許的 URL／標示及文字呈現長度仍有語意驗證；不能只靠 schema 宣稱資料可靠。所有 URL 限經核對的來源／地圖服務 HTTPS 連結，拒絕任意主機、user-info、非安全 scheme；不抓取使用者提供 URL、不跟隨來源任意重導以傳送位置。具體允許網域需在選商時列明。[requirements OQ2、OQ6]

## C01 — LINE Webhook

`/webhooks/line` 是本案固定路徑，不是已註冊 URL；主機／憑證待授權環境選定。驗簽使用原始位元組與 channel secret；Base64 簽章以等時比較核對，header 名稱大小寫不敏感。缺漏、重複／不合法簽章或驗證不符拒絕，不解析後再重建本文驗簽，不記原始本文。[LINE-SIG]

```yaml OpenAPI
openapi: 3.1.0
info: {title: 午餐決定器 LINE 事件入口, version: 1.0.0}
paths:
  /webhooks/line:
    post:
      operationId: receiveLineWebhook
      security: [{LineSignature: []}]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [destination, events]
              additionalProperties: true
              properties:
                destination: {type: string, pattern: '^U[0-9a-f]{32}$'}
                events:
                  type: array
                  items: {type: object, additionalProperties: true}
      responses:
        '200': {description: 已接收或安全忽略；空 events 同樣成功，不代表業務成功或送達}
        '400': {description: 驗簽後發現無效 JSON 或信封格式}
        '401': {description: 簽章缺漏或不符，不處理任何事件}
        '403': {description: destination 不屬於設定中的本 Bot}
        '413': {description: 超出經測試的入口本文上限，不緩存原始內容}
        '415': {description: 不支援的媒體型別}
        '503': {description: 無法安全接收；可能部分事件已受理，重送仍按事件去重}
components:
  securitySchemes:
    LineSignature:
      type: apiKey
      in: header
      name: x-line-signature
      description: 僅描述傳輸位置；實際必須驗證 HMAC-SHA256 及 Base64，不是比較靜態 API key
  schemas:
    PrivateEvent:
      type: object
      required: [type, mode, timestamp, webhookEventId, source, deliveryContext]
      additionalProperties: true
      properties:
        type: {enum: [message, postback, follow]}
        mode: {const: active}
        timestamp: {type: integer, minimum: 0}
        webhookEventId: {type: string, minLength: 1}
        replyToken: {type: string, minLength: 1}
        source:
          type: object
          required: [type, userId]
          properties:
            type: {const: user}
            userId: {type: string, pattern: '^U[0-9a-f]{32}$'}
        deliveryContext:
          type: object
          required: [isRedelivery]
          properties:
            isRedelivery: {type: boolean}
        message:
          oneOf:
            - type: object
              required: [id, type, latitude, longitude]
              properties:
                id: {type: string, minLength: 1}
                type: {const: location}
                latitude: {type: number, minimum: -90, maximum: 90}
                longitude: {type: number, minimum: -180, maximum: 180}
            - type: object
              required: [id, type, text]
              properties:
                id: {type: string, minLength: 1}
                type: {const: text}
                text: {type: string}
        postback:
          type: object
          required: [data]
          properties:
            data: {type: string, minLength: 1, maxLength: 300}
      allOf:
        - if: {properties: {type: {const: message}}}
          then: {required: [message]}
        - if: {properties: {type: {const: postback}}}
          then: {required: [postback]}
x-event-validation: '#/components/schemas/PrivateEvent'
```

信封有意不要求每個事件通過 `PrivateEvent`：有效 LINE 請求可以夾帶群組、其他類型或多筆事件；逐事件分類，不因其中一筆不支援就重做其他筆。通過簽章、Bot destination、私訊身分、型別及 `receivedAt−24h ≤ originalEventAt ≤ receivedAt+5min` 才能操作；群組、standby、無可信本人或過時事件安全忽略，200 不構成授權。私訊的其他訊息只回傳位置引導，不解析地址／網址或保存內容；follow 只顯示引導，不默認同意。缺座標及非有限值不查詢／建檔。[FR1.1、FR1.2、FR1.3][NFR2]

多筆同人事件不可假設陣列或送達順序是發生順序；由 C03 序列化受理並保留原始事件時間。接收確認不等推薦完成：先完成驗證及必要無位置的原子 claim，再將當次記憶體工作交給能在 HTTP 回應後繼續執行的已驗證 runtime，回 200。若 runtime 不支持，不能改存位置佇列或以同步等十秒假稱達成一秒接收；此為阻擋選型／真實整合的能力條件。

同事件只能取得一次執行所有權；重送／併發回 200，不另啟餐廳查詢或重存。claim 後 crash 而無位置可恢復時，維持失敗／不明、不由重送重做已開始的業務；使用者可送新的位置。claim 之前的安全接收失敗可由 LINE 重送，但重送不保證發生。原始本文、replyToken、位置與未保存結果在處理完成或十秒截止即釋放；禁用 ingress／APM／proxy 本文落盤、core dump 及持久工作酬載。[NFR1、NFR2、NFR4]

## C02 — LINE Reply and Interaction

此 OpenAPI 是本案使用的官方 API 子集，不取代 LINE 全規格。採文字訊息與 quick reply 按鈕：推薦文字含至多三店與地圖；歷史五筆可分成最多五則文字，最後一則放操作按鈕。原生通知不等於本案另發 push API；本案不呼叫 push／multicast。[LINE-REF]

```yaml OpenAPI
openapi: 3.1.0
info: {title: LINE 回覆 API 使用子集, version: 1.0.0}
servers: [{url: 'https://api.line.me'}]
paths:
  /v2/bot/message/reply:
    post:
      operationId: replyOnce
      security: [{ChannelAccessToken: []}]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              additionalProperties: false
              required: [replyToken, messages]
              properties:
                replyToken: {type: string, minLength: 1}
                messages:
                  type: array
                  minItems: 1
                  maxItems: 5
                  items: {$ref: '#/components/schemas/TextMessage'}
      responses:
        '200': {description: LINE 已接受；不等於使用者裝置已看到}
        '400': {description: 無效訊息或回覆 token，不盲目重送}
        '401': {description: 憑證錯誤，不自動更換權限或洩漏秘密}
        '403': {description: 未獲授權}
        '429': {description: 用量／速率限制，不使用 push 補發}
        '500': {description: 遠端故障，無確定接受證據時維持不明}
        default: {description: 保留安全錯誤類別，不把未知結果當未送出}
components:
  securitySchemes:
    ChannelAccessToken: {type: http, scheme: bearer}
  schemas:
    TextMessage:
      type: object
      additionalProperties: false
      required: [type, text]
      properties:
        type: {const: text}
        text: {type: string, minLength: 1, maxLength: 5000, x-max-utf16-code-units: 5000}
        quickReply:
          type: object
          additionalProperties: false
          required: [items]
          properties:
            items:
              type: array
              minItems: 1
              maxItems: 13
              items:
                type: object
                additionalProperties: false
                required: [type, action]
                properties:
                  type: {const: action}
                  action:
                    type: object
                    additionalProperties: false
                    required: [type, label, data]
                    properties:
                      type: {const: postback}
                      label: {type: string, minLength: 1, maxLength: 20}
                      data: {type: string, minLength: 1, maxLength: 300}
```

官方限制：replyToken 一次性、應盡快使用；接收後一分鐘以上不保證。重送事件同樣有接收後一分鐘限制，原 token 已用或事件已超過二十分鐘時不能使用；期限可能變動，不將它當可等待的服務承諾。24 小時事件處理窗口不延長回覆有效期。回覆不適用官方列出的 `X-Line-Retry-Key` 重試端點，不能自行推論 reply 可冪等重送。[LINE-REF]

LineInteraction 以事件原子更新 `not_started → sending → accepted | rejected | unknown`；只有第一個成功取得 `sending` 的呼叫能送出。200 才記 accepted；明確拒絕記 rejected；連線中斷、逾時、程序死亡或未能持久記錄 200 都維持 unknown，不重送。缺少／已知無效 token 時不呼叫 LINE、不假稱送達；業務處理與保存結果分別記錄，不能用回覆失敗推論歷史未保存。舊事件及 duplicate 不重做已開始的業務，不推播補發。無位置的狀態最多七天，token 本身不持久化。[NFR2、NFR5]

### Command and Action Mapping

按鈕資料固定為 `v=1&action=<name>&ref=<opaque>`；無 ref 的讀取入口可省略 ref。只允許表中鍵及動作，拒絕重複鍵、未知版本／動作和超過 300 字元的內容；不接受按鈕聲稱的 owner、座標、cutoff 或同意版本。ref 由 DataPrivacy 隨機簽發並綁本人、動作、有效期及必要範圍，至少 128-bit 隨機性；不是可跨人使用的 bearer 授權。[Q1、Q3][NFR3]

| 文字／按鈕 | 內部操作 | 必須顯示或檢查 |
| --- | --- | --- |
| `歷史`／`history` | listHistory | 本人、目前可見性；最新五筆 |
| `設定`／`settings` | getSettings | 目前選擇及實際第三方告知；讀不到不默認允許 |
| `說明`／`help` | 本地引導 | 私訊傳 LINE 位置、歷史／設定／清除狀態入口 |
| `choice` + ref | applyChoice | ref 對應畫面中不保存或保存一年、noticeVersion 與當時 consentVersion；舊版本不能覆寫新選擇 |
| `next` + ref | listHistory | 本人、翻頁鍵、十五分鐘效期；失效重新輸入歷史 |
| `delete_one` + ref／`delete_all` | issueDeletion | 單筆 ref 核對本人及紀錄；全部範圍重新形成確認，尚不刪除 |
| `confirm_delete` + ref／`cancel_delete` + ref | decideDeletion | 本人、固定範圍、五分鐘有效期、未使用／取消；不得在確認時擴大範圍 |
| `清除狀態`／`cleanup_status` | getCleanupStatus | 本人主動讀取，不推播；不能用控制資料不存在冒充完成 |

設定畫面、單筆刪除入口可沿用十五分鐘短期控制 ref，這是操作代碼的規格細化，不延長確認本身的五分鐘；設定 ref 綁目前版本，過期或版本改變即要求重新開設定。若需替換此細節，仍須保持授權及安全失效。純文字備援為上述入口，需 ref 的操作可輸入 `操作 <action> <ref>`；其解析遵守完全相同的白名單與本人檢查，不把人工輸入當可信授權。

LINE 只顯示最後一則訊息的 quick reply，舊版可能只顯示文字；因此每頁／確認文字須附可用文字操作方式。歷史五筆各有單筆刪除入口，加下一頁／全部刪除／設定／清除狀態共至多九個按鈕，低於十三個上限。送出前以 UTF-16 code unit 檢查文字五千限制；schema 的 maxLength 不能代替此檢查。不可截斷 URL、必要來源標示、刪除範圍或狀態來硬塞；無法容納所需合法標示的來源應被選型阻擋。[LINE-REF][NFR7]

## C03 — DataPrivacy

只有通過 C01 驗證的呼叫者上下文可以進入此介面；schema 不能證明可信身分。每個讀取、設定、保存、確認及取消都重新核對 subjectKey／ref／紀錄歸屬；不存在、他人或不可見物件用同一 `not_available` 結果，不能洩漏對方是否有資料。設定變更使用 ref 中的預期版本，不接受任意版本由使用者指定。[FR2、FR5–FR9][NFR3]

```yaml shared-schema
$schema: https://json-schema.org/draft/2020-12/schema
$id: urn:lunch:privacy:v1
x-operations:
  admitQuery: {request: '#/$defs/ContextRequest', response: '#/$defs/AdmissionResult'}
  getSettings: {request: '#/$defs/ContextRequest', response: '#/$defs/SettingsResult'}
  applyChoice: {request: '#/$defs/RefRequest', response: '#/$defs/SettingsResult'}
  commitHistory: {request: '#/$defs/CommitRequest', response: '#/$defs/WriteResult'}
  listHistory: {request: '#/$defs/ListRequest', response: '#/$defs/PageResult'}
  issueDeletion: {request: '#/$defs/DeleteRequest', response: '#/$defs/ConfirmationResult'}
  decideDeletion: {request: '#/$defs/DecisionRequest', response: '#/$defs/DeletionResult'}
  getCleanupStatus: {request: '#/$defs/ContextRequest', response: '#/$defs/CleanupResult'}
$defs:
  ContextRequest:
    type: object
    additionalProperties: false
    required: [context]
    properties:
      context: {$ref: 'urn:lunch:shared:v1#/$defs/Context'}
  RefRequest:
    type: object
    additionalProperties: false
    required: [context, ref]
    properties:
      context: {$ref: 'urn:lunch:shared:v1#/$defs/Context'}
      ref: {$ref: 'urn:lunch:shared:v1#/$defs/ActionRef'}
  AdmissionResult:
    oneOf:
      - {$ref: 'urn:lunch:shared:v1#/$defs/Error'}
      - type: object
        additionalProperties: false
        required: [kind]
        properties:
          kind: {const: notice_required}
      - type: object
        additionalProperties: false
        required: [kind, queryKey, acceptedOrder, saving]
        properties:
          kind: {const: allowed}
          queryKey: {$ref: 'urn:lunch:shared:v1#/$defs/Key'}
          acceptedOrder: {$ref: 'urn:lunch:shared:v1#/$defs/Order'}
          saving: {enum: [enabled, disabled]}
          permitRef: {$ref: 'urn:lunch:shared:v1#/$defs/Key'}
          noSaveReason: {enum: [no_permission, superseded_consent, order_unproven]}
        allOf:
          - if: {properties: {saving: {const: enabled}}}
            then: {required: [permitRef], not: {required: [noSaveReason]}}
            else: {required: [noSaveReason], not: {required: [permitRef]}}
  SettingsResult:
    oneOf:
      - {$ref: 'urn:lunch:shared:v1#/$defs/Error'}
      - type: object
        additionalProperties: false
        required: [kind, choice, noticeVersion, consentVersion, actionRefs]
        properties:
          kind: {const: settings}
          choice: {enum: [unselected, save, no_save]}
          noticeVersion: {$ref: 'urn:lunch:shared:v1#/$defs/Version'}
          consentVersion: {$ref: 'urn:lunch:shared:v1#/$defs/Version'}
          actionRefs:
            type: object
            additionalProperties: false
            required: [save, no_save]
            properties:
              save: {$ref: 'urn:lunch:shared:v1#/$defs/ActionRef'}
              no_save: {$ref: 'urn:lunch:shared:v1#/$defs/ActionRef'}
  CommitRequest:
    type: object
    additionalProperties: false
    required: [context, permitRef, position, resultSummary]
    properties:
      context: {$ref: 'urn:lunch:shared:v1#/$defs/Context'}
      permitRef: {$ref: 'urn:lunch:shared:v1#/$defs/Key'}
      position: {$ref: 'urn:lunch:shared:v1#/$defs/Position'}
      resultSummary: {enum: [found, zero_results, source_failure]}
  WriteResult:
    oneOf:
      - type: object
        additionalProperties: false
        required: [kind, historyKey]
        properties:
          kind: {const: saved}
          historyKey: {$ref: 'urn:lunch:shared:v1#/$defs/Key'}
      - type: object
        additionalProperties: false
        required: [kind, reason]
        properties:
          kind: {const: not_saved}
          reason: {enum: [no_permission, superseded_consent, deleted_scope, expired, deadline_exceeded, invalid_input, storage_rejected, order_unproven]}
      - type: object
        additionalProperties: false
        required: [kind]
        properties:
          kind: {const: unknown}
  ListRequest:
    type: object
    additionalProperties: false
    required: [context]
    properties:
      context: {$ref: 'urn:lunch:shared:v1#/$defs/Context'}
      cursor: {$ref: 'urn:lunch:shared:v1#/$defs/ActionRef'}
  PageResult:
    oneOf:
      - {$ref: 'urn:lunch:shared:v1#/$defs/Error'}
      - type: object
        additionalProperties: false
        required: [kind, entries]
        properties:
          kind: {const: page}
          entries:
            type: array
            maxItems: 5
            items:
              type: object
              additionalProperties: false
              required: [item, deleteRef]
              properties:
                item: {$ref: 'urn:lunch:shared:v1#/$defs/HistoryItem'}
                deleteRef: {$ref: 'urn:lunch:shared:v1#/$defs/ActionRef'}
          nextCursor: {$ref: 'urn:lunch:shared:v1#/$defs/ActionRef'}
  DeleteRequest:
    type: object
    additionalProperties: false
    required: [context, scope]
    properties:
      context: {$ref: 'urn:lunch:shared:v1#/$defs/Context'}
      scope: {enum: [one, all]}
      ref: {$ref: 'urn:lunch:shared:v1#/$defs/ActionRef'}
    allOf:
      - if: {properties: {scope: {const: one}}}
        then: {required: [ref]}
        else: {not: {required: [ref]}}
  ConfirmationResult:
    oneOf:
      - {$ref: 'urn:lunch:shared:v1#/$defs/Error'}
      - type: object
        additionalProperties: false
        required: [kind, ref, scope, cutoffAt, expiresAt]
        properties:
          kind: {const: confirmation}
          ref: {$ref: 'urn:lunch:shared:v1#/$defs/ActionRef'}
          scope: {enum: [one, all]}
          historyKey: {$ref: 'urn:lunch:shared:v1#/$defs/Key'}
          cutoffAt: {$ref: 'urn:lunch:shared:v1#/$defs/Instant'}
          expiresAt: {$ref: 'urn:lunch:shared:v1#/$defs/Instant'}
        allOf:
          - if: {properties: {scope: {const: one}}}
            then: {required: [historyKey]}
            else: {not: {required: [historyKey]}}
  DecisionRequest:
    type: object
    additionalProperties: false
    required: [context, ref, decision]
    properties:
      context: {$ref: 'urn:lunch:shared:v1#/$defs/Context'}
      ref: {$ref: 'urn:lunch:shared:v1#/$defs/ActionRef'}
      decision: {enum: [confirm, cancel]}
  DeletionResult:
    oneOf:
      - type: object
        additionalProperties: false
        required: [kind]
        properties:
          kind: {const: cancelled}
      - {$ref: '#/$defs/CleanupResult'}
  CleanupResult:
    oneOf:
      - {$ref: 'urn:lunch:shared:v1#/$defs/Error'}
      - type: object
        additionalProperties: false
        required: [kind, jobs]
        properties:
          kind: {const: cleanup_status}
          jobs:
            type: array
            items:
              type: object
              additionalProperties: false
              required: [cleanupKey, state, effectiveAt, dueAt]
              properties:
                cleanupKey: {$ref: 'urn:lunch:shared:v1#/$defs/Key'}
                state: {enum: [purging, complete, failed]}
                effectiveAt: {$ref: 'urn:lunch:shared:v1#/$defs/Instant'}
                dueAt: {$ref: 'urn:lunch:shared:v1#/$defs/Instant'}
```

### Ordering and Atomicity

本節是規範性時序，與 schema 一起適用。`LP` 是儲存可證明的原子生效點，不是 UI 點擊時間；多執行個體及重啟須共用同一權威順序。當同一毫秒或時鐘不可靠使新舊無法證明，返回 `order_unproven` 而不保存；不能以「位於同一程序」當證據。[Q2][requirements OQ3]

| 名稱 | 權威定義 | 用途 |
| --- | --- | --- |
| originalEventAt | 經來源／時效驗證的 LINE 事件發生時間，不採使用者輸入的日期 | 查詢時間、UTC 一曆年、識別尚未首次受理的延遲事件 |
| acceptedOrder | DataPrivacy 對首次受理事件以原子方式配置的每人順序，數字字串按整數比較；重送沿用原值 | 證明已受理事件相對權利變更的順序；不可因 TTL 消失重設後誤比較 |
| consentVersion／changedAt | 目前選擇成功提交時更換的版本及可信生效時刻；同一事件重送不再換版 | 保存 permit 必須屬目前版本；撤回／重新同意使舊 permit 永久失效 |
| deletion cutoff | issueDeletion LP 固定的本人範圍、cutoffOrder 及 cutoffAt；與 confirmation ref 綁定 | 確認時不重算；已受理舊事件及尚未到達的舊事件均有界線 |
| permitRef | DataPrivacy 管理的無位置短期保存控制，綁 subject／event／acceptedOrder／originalAt／consentVersion／deadline | 不能從按鈕取得；不是繞過最後授權的通行證 |

1. **受理與許可**：事件 first claim 及 DataPrivacy admission 需有冪等關聯；受理順序不由 LINE 的陣列位置、ULID 字典順序或 `isRedelivery` 推測。`admitQuery` 在一致性讀取中判斷告知／選擇；未完成回 `notice_required`、完全不可讀回 `settings_unavailable`，兩者不外傳位置。已知 no_save 回 allowed／disabled。位置不進 admission 控制紀錄。[FR2.1–FR2.3]
2. **新查詢判定**：只有首次受理在本次保存同意 LP 之後、原始 LINE 發生時間也可證明在該次生效界線之後、且非已有舊事件的查詢，才簽發該版本 permit。原始時間負責攔首次晚到的舊事件，可信受理順序及版本負責攔已受理的在途事件；只滿足其中一項不夠。原始時間落在不能可信排序的邊界／時鐘異常時，不簽發保存許可但可在已確認處理選擇下推薦。Admission 的 saving 指本次保存資格，不改使用者目前選擇；disabled 必須附 noSaveReason，供入口如實說明。此證據要求及時鐘可用性須在真人保存前驗證；不得用伺服器到達時間把舊查詢洗成新查詢。[FR5.1、FR8]
3. **保存 LP**：原子檢查 context／permit 綁定、目前 save／notice／consentVersion、事件新舊、未消費 permit、未命中刪除界線、未到期及仍在原十秒期限內；同一原子提交建立唯一 event 對應歷史、消費 permit 並記結果。其間不能先解鎖再寫；成功 ACK 才回 saved。逾時或 commit ACK 遺失回 unknown，不能轉成 not_saved；禁止攜位置的背景重試。重複 commit 只返回已核實的同一結果；已存就返回同一 historyKey，不明仍為 unknown，不能僅因 duplicate 就說未保存。儲存須支持交易有效期限／提交 fencing，不能在截止後讓排隊的寫入生效。[FR5.1–FR5.3][NFR2]
4. **撤回／重新同意 LP**：比對本人、ref 綁定 notice／預期 consentVersion 及時效，原子改選擇、換新版本並使所有舊 permit 不可用。撤回先於 commitHistory LP 則該次不得存；保存先於撤回則是既有歷史，按原期限留存，撤回本身不刪除。重新同意使用全新版本與生效界線，不能重新授權舊事件。[FR8]
5. **全部刪除範圍**：確認畫面形成時固定 cutoffOrder／cutoffAt，涵蓋已保存及已受理且 `acceptedOrder ≤ cutoffOrder` 的查詢；原始 LINE 時間 `≤ cutoffAt` 的首次晚到事件也不能稍後補存。新查詢須同時在 order 與可信原始時間上位於界線之後，才能確定不屬此範圍；無法證明者不新增歷史。受理在界線前但原始時間超前者仍按 order 納入，不因時鐘超前逃過刪除。短期控制可協助這種分類，但超過七天不得保留永久查詢索引；經七天後原始時間已足以跨過最多五分鐘的超前窗口。[FR7.1、FR7.2]
6. **刪除／取消 LP**：確認須在 `now < issuedAt+5min`，且本人、scope、ref 仍有效；原子消費確認、安裝範圍阻擋及不可見規則、產生無位置的清除作業。取消只消費確認，不安裝刪除；單筆只綁該筆及其事件，不擴大至其他歷史。重複確認讀回同一結果，不再建立新範圍／作業；確認結果 ACK 遺失回 outcome_unknown，不假稱未受理。範圍內已存／在途／首次晚到查詢均不能復活。[FR7.1–FR7.3]
7. **可見性與清除**：每次讀取以當下本人、expiresAt 及生效刪除界線過濾，不等掃描或 TTL。若讀取與刪除並行，返回資料前再做版本／界線檢查；已送往 LINE 的舊訊息屬第三方處理，不能宣稱代刪。到期時及刪除 LP 起 24h 內完成所有可控內容清除，完成才回 complete。七天控制資料到期不能重新解禁不可讀殘留；未清內容維持 fail-closed／隔離並告警，已屬超時驗收失敗，不藉保留過期控制紀錄掩飾。[FR9.1–FR9.3]
8. **不明寫入核對**：僅透過既有 event／history 識別與 DataPrivacy 查核，無需位置副本；先確認是否已提交，不能把 unknown 當作可重新 insert。若已刪／到期，至多返回安全狀態，不取回內容。原請求未提交的安全證據才允許 not_saved；查不到控制紀錄不構成該證據。核對不拖延當次推薦、不推播；讀歷史／清除入口仍可用。[decisions ADR-004]

確認畫面形成的 LP 是伺服器生成確認資料的時點，並在文字顯示該 cutoffAt（臺北時間），不是等裝置顯示回執；本案無裝置已讀保證。相同時刻、延遲投遞及時鐘異常的保守拒存是無法證明許可的分支，不得據此刪除明確位於範圍之後的新紀錄。若平台不能提供上述分類與序列化證據，阻擋真人保存，而非只寫「用交易即可」。

### History and Cleanup Results

- 年份算法：原始事件 UTC 加一曆年，2 月 29 日對應下一年 2 月 28 日同一時刻；逾期比較含等號。DataPrivacy 計算 expiresAt，呼叫者不能傳入自己延長的值。HistoryItem 的 subject 由可信 context 決定，不從 message 讀取；持久欄位仍只限原白名單。[FR5.2、FR5.3]
- 分頁排序鍵 `(queryAt DESC, historyKey ASC)`，cursor 綁本人及最後鍵，向後作 keyset 分頁，不用浮動 offset。每頁重新過濾刪除／到期；新增查詢不插入舊游標前的頁面，重新輸入歷史可看最新。cursor 簽發起十五分鐘到期、不滑動展延，控制資料不含位置，最長七天清除；查閱故障回 error，不回空 page。[FR6][Q3]
- `SettingsResult` 是真實目前狀態；applyChoice 的提交回應遺失回 outcome_unknown，要求重新讀設定，不假稱變更已生效。已知 no_save 不依賴歷史可寫性；完全不可確認選擇則不能借 no_save 名義查第三方。[FR2、FR8]
- `CleanupResult.jobs` 只列本人仍保有的短期作業狀態；沒有作業只說目前無可查狀態，不推論全部已清完。既有狀態超過可呈現長度時摘要仍區分失敗／清除中，不能省略尚未完成的警告；詳細維護診斷不給一般使用者。[NFR4、NFR5]
- 當次位置副本即使已同意保存也不另建 queue／暫存檔，完成或十秒即釋放；只有合法 History 寫入能保留內容。同意版本是目前狀態，不追加無期限同意歷程，服務停止後 30 天清除。[components][NFR4]

## C04 — LunchRecommendation

```yaml shared-schema
$schema: https://json-schema.org/draft/2020-12/schema
$id: urn:lunch:recommendation:v1
x-operations:
  recommend: {request: '#/$defs/Request', response: '#/$defs/Response'}
$defs:
  Request:
    type: object
    additionalProperties: false
    required: [queryKey, position, deadlineAt]
    properties:
      queryKey: {$ref: 'urn:lunch:shared:v1#/$defs/Key'}
      position: {$ref: 'urn:lunch:shared:v1#/$defs/Position'}
      deadlineAt: {$ref: 'urn:lunch:shared:v1#/$defs/Instant'}
  Response:
    oneOf:
      - {$ref: 'urn:lunch:shared:v1#/$defs/QueryResult'}
      - {$ref: 'urn:lunch:shared:v1#/$defs/Error'}
```

LineInteraction 只有在 C03 確認可當次處理後才呼叫；不傳 subject、歷史、LINE token 或 consentVersion。取消以程序內 cancellation signal 傳遞，與 deadlineAt 同時適用，不能把取消當可重試的來源空結果。適用 FR3.1–FR3.3：以未四捨五入直線距離 `≤1000m`、餐廳分類及必要資訊篩選，排除 closed／permanently_closed，去重後先 open 再 unknown，各組 distance 升序、穩定 restaurantKey 升序取三家。距離算法及來源 identity 對照須在 Functional Design／來源選型時定案並測邊界；不能把地圖道路距離混入此數值。[FR3]

`found` 一／二筆需明說不足，三筆正常；合格數零才 zero_results。整份來源失敗必須 source_failure，不附偽候選；個別候選無法可靠判讀可剔除。reason 只敘述有依據的距離／營業狀態，保留未知與來源標示，不捏造評價、即時營業或座位。LineInteraction 將推薦與 C03 保存結果分開組句，unknown 使用「目前無法確認是否已保存，可稍後查看歷史」，不丟棄已取得推薦。[FR4.1–FR4.3][decisions ADR-004]

## C05 — RestaurantSourceAdapter

```yaml shared-schema
$schema: https://json-schema.org/draft/2020-12/schema
$id: urn:lunch:source:v1
x-operations:
  search: {request: '#/$defs/Request', response: '#/$defs/Response'}
$defs:
  Request:
    type: object
    additionalProperties: false
    required: [position, radiusMeters, deadlineAt]
    properties:
      position: {$ref: 'urn:lunch:shared:v1#/$defs/Position'}
      radiusMeters: {const: 1000}
      deadlineAt: {$ref: 'urn:lunch:shared:v1#/$defs/Instant'}
  Response:
    oneOf:
      - type: object
        additionalProperties: false
        required: [kind, candidates, rejectedCandidateCount]
        properties:
          kind: {const: source_success}
          candidates: {type: array, items: {$ref: 'urn:lunch:shared:v1#/$defs/Candidate'}}
          rejectedCandidateCount: {type: integer, minimum: 0}
      - type: object
        additionalProperties: false
        required: [kind, code]
        properties:
          kind: {const: source_failure}
          code: {enum: [timeout, unavailable, rate_limited, unauthorized, malformed_response, rights_unverified]}
```

Adapter 驗證整份回應可判讀，再逐候選白名單轉換；不把缺營業狀態當 open，不因未知名稱／地圖而假造。`restaurantKey` 必須代表穩定店家識別，不能以每次查詢的陣列序號代替；多來源別名去重需可證明映射，不能任意合併不同餐廳。來源查詢失敗不自動重試，取消／deadline 中止所有 in-flight 讀取並丟棄晚到結果；外部 API client 的隱含 retry 須關閉。[Q4][FR3、FR4]

## C06 — Restaurant Provider Egress

下列是本案送出資料的**允許集合與整合約束**，不是未選供應方的遠端 API schema。供應方選定後，Adapter 將此訊息轉成其正式參數並補遠端規格／條款版本；未完成前只准合成資料模擬，不可使用真人位置。[NFR6][requirements OQ1、OQ2]

```yaml shared-schema
$schema: https://json-schema.org/draft/2020-12/schema
$id: urn:lunch:provider-egress:v1
type: object
additionalProperties: false
required: [position, radiusMeters, category]
properties:
  position: {$ref: 'urn:lunch:shared:v1#/$defs/Position'}
  radiusMeters: {const: 1000}
  category: {const: restaurant}
x-transport:
  provider: unselected
  endpoint: null
  authentication: supplied_by_adapter_secret_not_payload
  location_logging: forbidden
  failure_retries: 0
  persistence: none
x-response-mapping: 'urn:lunch:source:v1#/$defs/Response'
```

只有必要搜尋點／範圍／分類可外傳；供應方必需的純協定參數（例如頁碼）須記於選定來源映射，不可加入 subject、event、queryKey、同意或歷史。憑證由 Adapter 的秘密注入機制提供，不進診斷／本文。合法來源可能需多次正常讀取，全部共享剩餘預算；本案不承諾一次 HTTP 足以取完，也不以回傳部分資料卻隱藏後續故障假稱完整成功。需縮限候選讀取範圍時在來源設計列明涵蓋率與限制，不改一公里／排序要求。

實際來源需提供可用分類、穩定 ID、座標、營業資訊、地圖、必要標示及足夠格式／長度；缺能力先回報，不能虛構。對必要第三方傳輸及其不可控保留如實告知，本專案不宣稱代刪 LINE 或供應方全部資料；不將原始餐廳回應保存一年，不新增持久來源快取。[FR2.1、FR3.3][NFR4、NFR6]

## C07 — Trusted Cleanup Trigger

此訊息不夾帶位置，呼叫權限來自已驗證的執行環境而非 payload 內的字串。DataPrivacy 自行取可信現在時間、讀取到期及已受理刪除的範圍，不能由外部指定他人的 subject 或任意截止時間。若後續採 HTTP trigger，須另定受保護管理端點與身分，不能把 C01 的 LINE 簽章拿來共用。[components]

```yaml shared-schema
$schema: https://json-schema.org/draft/2020-12/schema
$id: urn:lunch:cleanup:v1
x-operations:
  runCleanup: {request: '#/$defs/Request', response: '#/$defs/Response'}
$defs:
  Request:
    type: object
    additionalProperties: false
    required: [runKey]
    properties:
      runKey: {$ref: 'urn:lunch:shared:v1#/$defs/Key'}
  Response:
    type: object
    additionalProperties: false
    required: [kind, processedCount, pendingCount, overdueCount, alertState]
    properties:
      kind: {enum: [complete, pending, failed]}
      processedCount: {type: integer, minimum: 0}
      pendingCount: {type: integer, minimum: 0}
      overdueCount: {type: integer, minimum: 0}
      alertState: {enum: [not_needed, accepted, failed, unknown]}
```

觸發／重試冪等、不重設 effectiveAt／dueAt，只有每個應清儲存／副本的成功證據才更新完成；觸發成功不等於清除完成。若尚有 pending／failed／overdue 就不能將整批記 complete；告警失敗不能抹去清除失敗。排程頻率、每次批次上限、重試間隔、告警管道及平台副本證明交下游，但要預留失敗後重試空間並滿足 24h。TTL 只是輔助，不是 SLA 證據；短期 job 清除後仍不允許殘留資料復活。[FR9][NFR4、NFR5]

## Error and Deadline Matrix

| 邊界／狀態 | 對外行為 | 重試及資料處理 |
| --- | --- | --- |
| C01 驗簽／身分／時效不合 | 不查餐廳、不保存或執行權利操作；依信封或單事件規則拒絕／忽略 | 原始本文不留存；重送仍須全部檢查 |
| C03 notice_required | 顯示實際告知及保存選擇，請重傳位置 | 丟棄提前收到位置，不能留著等同意 |
| C03 settings_unavailable | 暫時無法確認資料設定，請稍後重試 | 不外傳、保存或排隊；已知 no_save 則仍可推薦 |
| C05／C06 source_failure | 暫時無法取得餐廳資料，不冒充零結果 | 失敗重試零次；有有效 permit 才記真實失敗歷史 |
| C03 not_saved／unknown | 前者只在確定未寫入時說未保存；後者說無法確認 | 推薦保留；既有識別核對不重寫位置、不延遲回覆 |
| C03 page／settings 讀取 error | 明說查閱／設定失敗 | 不能冒充空歷史或 no_save；本人可重新發起 |
| C03 確認過期／取消／跨人 | 不刪除，提示重新發起或不可用，不洩漏對方資料 | 不擴大／延長 ref；跨人不改任何狀態 |
| C03 刪除已受理 | 已受理，清除中；complete 才說已刪除 | 立即不可見；受控清除安全重試，24h 期限不重算 |
| C02 LINE 拒絕／回應不明 | 不假稱送達 | 不盲目重送、不推播，保存結果獨立判斷 |
| 任一當次操作到 deadline | 截止前以預留預算送出可用結果或明確失敗；無法送出則記真實失敗 | 停止外部工作及新提交，釋放短暫位置，不延長十秒 |

內部 Error 不包含自由文字例外、URL、位置或憑證；LineInteraction 按 code 映射繁中訊息，診斷只記隨機關聯碼、狀態、時間及必要量測，最多 30 天，限授權維護人員。具體每個依賴的 timeout 分配由後續 NFR 設計依實测決定；必須滿足接收 p95≤1s、回覆被 LINE 接受 p95≤5s、十秒上限，不能用 timeout 總和大於十秒的配置或把等待藏到背景。[NFR1、NFR4–NFR5]

## Contract Ownership and Changes

| 決策 | Context／Decision | Consequences／Security | Alternatives Rejected |
| --- | --- | --- | --- |
| [Q1] 共用 schema | 一個共同發布應用集中維護 v1 定義，各介面有最小投影 | 減少漂移；型別變更一起驗證，不把共用模型當分享資料許可 | 各邊界獨立 schema／版本增加轉換與重複測試，第一版不採 |
| [Q2] 原子授權／寫入 | 版本、順序、刪除界線及寫入共享 LP，不持鎖等餐廳 | 需儲存交易／條件式提交及跨個體證據，未知提交如實處理 | 每人單一序列化執行者需更多故障切換及所有權證明，第一版不採 |
| [Q3] 不透明分頁 ref | 十五分鐘短期控制，由本人授權後查回位置鍵 | 多次控制讀取；可撤銷，代碼不含歷史內容 | 自含簽章游標增加金鑰、大小及版本管理，第一版不採 |
| [Q4] 來源不重試 | 餐廳來源失敗如實回覆，由使用者新位置重查 | 較容易限制延遲及成本，短暫故障恢復率較低 | 有界重試一次仍需供應方與時間條件，第一版不採；不影響清除重試 |

- 表列 Owner 維護其 spec；U1 維護者在同一變更內同步提供方、使用方、正反例與邊界測試，由提出者確認涉及產品／權利的破壞性變更。沒有已承諾外部團隊人力或交期。
- 初版業務契約版本 v1，不重寫 LINE 欄位格式或在 LINE URL 加本案版本；應用自己產生的 action 帶 v=1。安全新增可選欄位不得改舊欄位意思、把 unknown 改成允許、延長期限或增加敏感輸出。
- 破壞性變更須新版本及雙方相容計畫；共同部署前測仍有效的舊 ref／按鈕。不能相容時明確安全失效並引導重開入口，不能把舊 confirm 的範圍改成新範圍。LINE 官方未預告變動是外部風險，真實整合前重查官方文件。
- C06 選商及 C07 傳輸機制落實需補契約映射及證據；若變成額外部署服務、增加資料／外部使用目的或無法滿足期限，回報並修訂已確認設計，不暗中拓撲擴張。

## Verification Handoff

本表是後續必測情境，不是已執行測試報告；同一 schema 驗證成功不能替代時序、安全或真實串接證據。[requirements NFR8–NFR9]

| 契約／案例 | 必須成立的結果 | 需求 |
| --- | --- | --- |
| C01 簽章原始 bytes、header 大小寫、空 events、混合事件、群組、非有限座標 | 合法空事件 200；非法來源零副作用；逐筆去重，群組零私人輸出 | FR1、FR1.1、FR1.2、FR1.3、NFR2、NFR3 |
| C03 首次位置、no_save、settings 不可讀、舊設定 ref | 告知前不查／不存／不等待；已知不保存可推薦；設定未知停止 | FR2、FR2.1、FR2.2、FR2.3、FR8 |
| C04／C05 距離 1000m 邊界、重複、未知／休息、穩定排序 | 同一集合可重現、前三家、來源理由／地圖相符 | FR3、FR3.1、FR3.2、FR3.3 |
| C04–C06 一／二／零候選、整份解析失敗、來源逾時、隱含 retry | 不足與零結果不同於故障；來源失敗重試零次 | FR4、FR4.1、FR4.2、FR4.3 |
| C03 valid permit 保存成功／零結果／故障，跨版本／deadline | 至多一筆且只含白名單；不合法許可不寫；期限不延長 | FR5、FR5.1、FR5.2、FR5.3 |
| C03 保存 ACK 遺失、撤回／刪除與 commit 兩種先後、重啟 | 明確 LP 順序；unknown 非 not_saved；無越界／復活寫入 | FR4.3、FR5.1、FR7.2、FR8、NFR2、NFR5 |
| C03 首次晚到／重送、同毫秒、未可信時鐘、七天控制清除 | 舊事件不因重新同意而變新；不能證明則拒存；控制過期不解禁 | FR7.2、FR8、FR9.1、NFR2、NFR4 |
| C03 兩人互換 cursor／confirm／history ref、十五分鐘邊界 | 無越權；翻頁當下刪除／到期立刻排除，空與故障分開 | FR6、NFR3、NFR7 |
| C03 單筆／全部、取消、重複、五分鐘邊界、畫面後新查詢 | 範圍固定且不刪新資料；取消／跨人／過期零刪除 | FR7、FR7.1、FR7.2、FR7.3 |
| C03／C07 UTC 閏日、臺北跨日、24h 清除／復原／告警失敗 | 到期立即不可見；全部可控內容依限清除，無備份或復活 | FR9、FR9.1、FR9.2、FR9.3、NFR4、NFR5 |
| C02 一次性 token、20 分鐘重送、未知送出、文字／按鈕上限 | 不盲目重送或推播；文字 fallback、繁中與真實狀態 | NFR2、NFR5、NFR7 |
| C01–C07 正常／受控故障、20 身分、1q/s×5min、另測同時五筆 | 接收 p95≤1s、LINE 接受回覆 p95≤5s；保留失敗樣本／延遲條件，不冒充裝置送達 | NFR1 |
| 出口、權限、平台日誌／暫存／副本／清除能力與授權 | 真實完整流程、資料權利、必要費用及真人保護缺一不開放 | NFR3、NFR4、NFR6 |
| 本機／CI 一致命令、test-after、所有必要案例、安全檢查 | ≥80% 含未載入應用原始碼，必要建置／格式／lint／測試／掃描缺失不算通過 | NFR8、NFR9 |

## Open Questions

| Contract | Question | Blocks |
| --- | --- | --- |
| C01、C02 | 實際帳號、HTTPS 環境、channel／token 授權、本文上限及 HTTP 回應後記憶體工作能力；重新核對官方限制 | U1 真實整合及 NFR1 證據；不能用位置持久佇列補救（OQ1、OQ7） |
| C03 | 可信時鐘、每人順序／目前版本的儲存表示、截止提交 fencing、隔離級別與 crash 復原證據 | U1 Functional／NFR／Infrastructure Design 及任何真人保存；契約 LP 已定，實作能力未定（OQ3、OQ4、OQ6） |
| C03、C07 | 無歷史備份、平台複本／日誌／快取處置、24h 內實體清除、七天控制消失仍不可復活 | U1 儲存選型、歷史實作與真人保存（OQ4） |
| C04–C06 | 來源、穩定店家識別、直線距離算法、合法地圖網域、內容／標示及格式上限與讀取涵蓋率 | U1 Functional Design／來源映射及真實餐廳查詢（OQ1、OQ2） |
| C02–C07 | 個別 timeout 預算、訊息排版、清除批次／重試節奏、告警與最小權限配置 | U1 NFR／Infrastructure Design 及對應驗收，不放寬本文件期限（OQ5–OQ7、OQ10） |
| 全部 | 使用地區、政策、資料所在地、費用上限、環境及運作責任 | U1 付費／外部資源行動與真人試用；不影響合成資料設計（OQ8、OQ9） |

## Assumptions & Open Questions

四題取捨已有本人確認；沒有把上表未知能力當作事實。LINE 文件查閱不是帳號、真實回覆或資源驗證；規格解析也不是應用測試。本案依已確認行為設計介面，仍須後續功能、非功能、基礎設施與實作證據；不宣稱目前已符合隱私法規、已解決 R-01、可正式上線或已取得任何費用／真人資料授權。
