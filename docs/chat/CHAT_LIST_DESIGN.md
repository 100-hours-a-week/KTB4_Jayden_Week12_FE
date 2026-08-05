# 채팅 알림 아이콘 및 채팅방 목록 설계

## 1. 목적

로그인 사용자가 모든 보호 페이지의 상단에서 안 읽은 DM 존재 여부를 확인하고, 채팅 아이콘을 눌러 자신의 1:1 채팅방 목록으로 이동할 수 있게 한다. 목록에서는 상대 사용자, 마지막 메시지, 안 읽은 메시지 수, 마지막 메시지 시각을 확인하고 각 채팅방으로 이동할 수 있다.

이 문서는 [`DM_CHAT_DESIGN.md`](DM_CHAT_DESIGN.md)의 대화 기능을 확장한다. 대화창 말풍선에는 읽음 표시를 만들지 않지만, 채팅방 목록과 헤더 알림을 위해 서버는 사용자별 읽음 기준을 관리한다.

API endpoint, payload, 응답 field와 인증의 단일 기준은 [`chat-api-spec.md`](chat-api-spec.md)다. 실제 응답이 다르면 프런트 mapper에서 차이를 숨기지 않고 API 스펙을 먼저 갱신한다.

---

## 2. MVP 범위

### 포함

- 상단 프로필 이미지 왼쪽에 채팅 아이콘 버튼 표시
- 하나 이상의 안 읽은 메시지가 있으면 아이콘 우측 상단에 주황색 점 표시
- 아이콘 클릭 시 `/chats` 채팅방 목록 페이지로 이동
- 목록 화면의 뒤로가기 동작
- 상대방 `nickname`, `profileImageUrl` 표시
- 방별 마지막 텍스트 메시지 표시
- 방별 안 읽은 메시지 개수 badge 표시
- 읽은 마지막 메시지는 회색, 안 읽은 마지막 메시지는 굵은 글씨로 표시
- 마지막 메시지를 보낸 뒤 경과 시간 표시
- 카드 클릭 시 `/chats/{roomId}` 1:1 DM 대화 페이지로 이동
- 대화 페이지 진입 시 읽음 처리
- 목록 loading, empty, error, pagination 상태
- `Q1-A` 선택 시 `/user/queue/chat-updates` 기반 방별 unread 및 마지막 메시지 실시간 갱신
- `Q1-B` 선택 시 전체 unread 30초 polling
- 대화 페이지에서 room topic 구독 및 이탈 시 room 구독 해제
- access token 갱신 후 STOMP session 재인증

### 제외

- 검색창
- 새 대화 버튼
- 입력 중 표시
- 고정된 대화와 고정 기능
- 온라인 상태
- 음소거 아이콘과 알림 설정
- 읽음 여부를 나타내는 체크 아이콘
- 채팅방 삭제 및 나가기 메뉴
- 목록 항목 swipe action
- 브라우저 push notification

첨부 시안의 검색창, 새 대화, `입력 중`, 온라인 점, 고정된 대화, 음소거 및 체크 아이콘은 이번 화면에 포함하지 않는다. 모든 방을 하나의 `모든 대화` 목록으로 표시한다.

---

## 3. 화면과 이동 흐름

```text
보호 페이지 Header
  └─ [채팅 아이콘 ·] [내 프로필]
          │
          └─ click → /chats
                         │
                         ├─ 뒤로가기 → 직전 보호 페이지
                         └─ 채팅방 카드 click → /chats/{roomId}
                                                    │
                                                    └─ 뒤로가기 → /chats
```

### 라우트

| 경로 | 화면 | 접근 |
| --- | --- | --- |
| `/chats` | 내 채팅방 목록 | 로그인 필요 |
| `/chats/:roomId` | 1:1 DM 대화 페이지 | 로그인 및 방 참여 권한 필요 |

두 경로는 현재 `ProtectedRoute > AppLayout` 아래에 추가한다.

채팅 아이콘이 `/chats`로 이동할 때 현재 보호 경로를 `location.state.from`으로 전달한다. 목록의 뒤로가기는 안전한 보호 경로인 `from`이 있으면 그 경로로, 직접 진입했거나 값이 안전하지 않으면 `/posts`로 이동한다. 브라우저 history를 추측하여 auth 또는 외부 페이지로 이동하지 않는다. 대화 페이지의 뒤로가기는 항상 `/chats`를 기본값으로 한다. 뒤로가기 control의 렌더링 위치는 [12. 구현 순서 및 확정 사항](#12-구현-순서-및-확정-사항)의 선택에 따른다.

게시글 작성자를 눌러 시작한 DM은 기존 설계대로 모달로 열 수 있다. 목록에서 진입한 `/chats/:roomId`는 같은 `ChatConversation` UI와 session hook을 페이지 shell 안에서 재사용한다. 두 진입점 모두 `ChatProvider`가 관리하는 하나의 STOMP client와 인증 session을 공유할 수 있게 설계한다. 최종 client 수명 주기는 [12. 구현 순서 및 확정 사항](#12-구현-순서-및-확정-사항)의 선택에 따른다.

---

## 4. 상단 채팅 아이콘

### 4.1 배치

현재 `Header`의 `AccountMenu`가 우측 끝에 absolute 배치되어 있으므로, 우측 action 영역을 다음처럼 묶는다.

```text
site-header__actions
├── ChatNotificationButton
└── AccountMenu
```

- 채팅 아이콘은 프로필 이미지 바로 왼쪽에 둔다.
- 두 버튼 사이 간격은 `var(--space-3)`을 기본값으로 한다.
- 아이콘 button의 클릭 영역은 프로필 버튼과 동일한 최소 `2.5rem × 2.5rem`으로 한다.
- SVG는 `currentColor`를 사용하고 장식용 SVG에는 `aria-hidden="true"`를 설정한다.
- 현재 경로가 `/chats` 또는 `/chats/:roomId`이면 `aria-current="page"` 또는 `is-active` style을 적용한다.

### 4.2 안 읽음 표시

- `totalUnreadCount > 0`이면 아이콘 우측 상단에 주황색 원형 점을 표시한다.
- 헤더 아이콘에는 숫자를 표시하지 않고 존재 여부만 표시한다.
- 점은 장식 요소이므로 screen reader에 중복으로 읽히지 않게 한다.
- 접근성 이름은 count에 따라 바뀐다.
  - 0개: `메시지 목록 열기`
  - 1개 이상: `읽지 않은 메시지 {totalUnreadCount}개, 메시지 목록 열기`
- count 조회 중에는 기존 값을 유지하여 점이 깜빡이지 않게 한다.
- 조회 실패만으로 기존 점을 제거하지 않는다.

### 4.3 MVP 갱신 정책

초기 전체 count는 `GET /chatrooms/unread-count`로 조회한다. 로그인 동안 STOMP client를 유지하는 선택에서는 `/user/queue/chat-updates`를 구독하여 새 메시지를 실시간 반영하고, REST 조회는 초기값과 재동기화에 사용한다.

안 읽음 count를 다음 시점에 갱신한다.

- 로그인 완료 직후
- `Header` mount 시
- STOMP 연결 후 `/user/queue/chat-updates`에서 상대방의 새 메시지를 받을 때
- `/chats` 진입 및 목록 첫 페이지 재조회 완료 시
- `/chats/:roomId`에서 현재 사용자의 `MESSAGE_READ` event를 확인한 뒤
- STOMP 재연결 및 재인증 완료 시
- 브라우저 window가 다시 focus될 때

`chat-updates`의 `messageId`를 중복 제거한 뒤 `senderId !== currentUser.userId`인 새 event만 전체 local count에 한 건 반영한다. event의 `unreadCount`는 해당 room의 절대값으로 사용한다. 연결 유실 중 event 누락, 삭제 메시지, 퇴장 상태를 보정하기 위해 focus·재연결·재인증 시 REST count를 다시 조회한다.

동일 시각의 REST 중복 요청은 하나로 합치고 logout 또는 `AuthProvider` unmount 시 요청, 구독, socket state를 정리한다. 대화 화면에서 읽음 완료 후에는 `chat-updates`가 별도 read event를 제공하지 않으므로 REST count를 다시 조회한다. 대화 전용 client를 선택하면 실시간 user queue를 유지할 수 없으므로 30초 polling을 fallback으로 사용한다.

---

## 5. 채팅방 목록 페이지

### 5.1 레이아웃

```text
┌────────────────────────────────────────────┐
│ [←] 메시지                                 │
├────────────────────────────────────────────┤
│ 모든 대화                                  │
│ ┌────────────────────────────────────────┐ │
│ │ [프로필] nickname             3분 전   │ │
│ │          마지막 메시지             [2] │ │
│ ├────────────────────────────────────────┤ │
│ │ [프로필] nickname             어제     │ │
│ │          읽은 마지막 메시지            │ │
│ └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

- 페이지 `main`의 id는 기존 skip link와 연결되는 `main-content`로 한다.
- 페이지 상단에는 `h1`인 `메시지`를 둔다. `Q2-B`를 선택한 경우에만 page shell에 뒤로가기 버튼을 함께 둔다.
- `모든 대화`를 목록 section의 `h2`로 둔다.
- 검색창과 새 대화 버튼을 렌더링하지 않는다.
- 목록은 서버가 보장하는 `(createdAt DESC, lastMessageId DESC)` 순서를 유지한다.
- 방이 많으면 cursor pagination과 기존 `InfiniteScrollTrigger`를 재사용한다.
- 각 항목 전체를 하나의 `Link`로 구현하여 nested interactive element를 만들지 않는다.
- 접근성 이름은 `{nickname}님과의 대화, 읽지 않은 메시지 {unreadCount}개` 형식으로 한다. 0개이면 안 읽음 문구를 생략한다.

### 5.2 채팅방 카드

| 영역 | 표시 규칙 |
| --- | --- |
| 프로필 | 상대방 `profileImageUrl`, 실패/빈 값이면 기존 `Avatar` fallback |
| 닉네임 | 상대방 `nickname`, 한 줄 말줄임 |
| 마지막 메시지 | `content` 한 줄 말줄임, `null`이면 `삭제된 메시지입니다.` |
| 경과 시간 | 카드 우측 상단, `createdAt` 기준 |
| 안 읽음 badge | `unreadCount > 0`일 때 우측에 숫자 표시 |

마지막 메시지 style:

- `unreadCount > 0`: 본문 글자색, `font-weight: 700`
- `unreadCount === 0`: 회색 보조 글자색, `font-weight: 400`
- 닉네임은 읽음 여부와 관계없이 식별하기 쉬운 동일한 굵기를 유지한다.
- 안 읽음 badge는 `99`까지 숫자로 표시하고 100개 이상은 `99+`로 표시한다.

서버는 메시지가 한 건도 없는 방을 목록에 포함하지 않는다. direct room 생성 직후에는 응답의 `chatRoomId`로 대화에 바로 진입하고 첫 메시지가 저장된 뒤 목록 pagination 대상이 된다.

### 5.3 상대 시간

클라이언트 현재 시각과 서버의 ISO 8601 `createdAt` 차이를 사용한다.

| 경과 시간 | 표시 |
| --- | --- |
| 1분 미만 | `방금` |
| 1분 이상, 60분 미만 | `{n}분 전` |
| 1시간 이상, 24시간 미만 | `{n}시간 전` |
| 24시간 이상, 48시간 미만 | `어제` |
| 2일 이상 | `{n}일 전` |

- 음수이거나 잘못된 날짜이면 빈 문자열로 표시하고 UI를 중단하지 않는다.
- 화면을 계속 열어 둔 경우 표시가 낡지 않도록 1분 간격으로 현재 시각 state만 갱신한다.
- 서버 시각은 timezone/offset이 없는 `LocalDateTime`이므로 UTC로 간주하거나 `Z`를 덧붙이지 않는다.
- `<time dateTime={createdAt}>`을 사용하고 전체 날짜/시간을 접근성 label 또는 `title`로 제공한다.

### 5.4 화면 상태

| 상태 | UI |
| --- | --- |
| loading | 4개 정도의 채팅방 skeleton |
| success | 채팅방 목록 |
| empty | `아직 시작된 대화가 없어요.` |
| error | `메시지 목록을 불러오지 못했어요.`와 `다시 시도` 버튼 |
| loading-more | 목록 아래 추가 loading |
| load-more-error | 기존 목록 유지, 아래에 재시도 버튼 |

`aria-busy`, `aria-live="polite"`, error의 `role="alert"`를 사용한다.

---

## 6. 안 읽음 정의와 읽음 처리

### 6.1 서버 기준

안 읽음 개수는 현재 사용자가 보낸 메시지를 제외하고 사용자의 방별 읽음 기준 이후에 상대방이 보낸 메시지 수다. 삭제된 메시지와 현재 사용자가 퇴장한 방의 메시지는 방별 및 전체 unread count에서 제외된다.

읽음 위치는 기존 값보다 큰 `lastReadMessageId`로만 이동한다. 같거나 과거 ID를 다시 보내면 오류는 아니지만 room topic에 새 읽음 event도 발행되지 않는다.

### 6.2 읽음 처리 시점

1. 사용자가 `/chats/:roomId`로 이동한다.
2. `GET /chatrooms/{roomId}`로 상단 상대 정보를 조회한다.
3. STOMP 연결과 `/user/queue/chat-errors`, `/sub/chatrooms/{roomId}` 구독을 먼저 완료한다.
4. history를 조회하여 화면에 병합·렌더링한다.
5. document가 visible이고 대화 화면이 활성화된 경우 마지막으로 렌더링된 상대 메시지의 `messageId`까지 `/pub/chatrooms/{roomId}/read`로 발행한다.
6. 읽음 위치가 앞으로 이동한 경우 room topic에서 현재 사용자의 `MESSAGE_READ` event를 확인하면 해당 목표까지 읽음 처리가 성공한 것으로 본다.
7. 처리한 ID보다 새로운 상대 메시지가 없다면 해당 방의 local `unreadCount`를 0으로 바꾸고 `GET /chatrooms/unread-count`로 header count를 재동기화한다.
8. 대화 중 새 상대 메시지가 오면 visible 상태에서 렌더링된 뒤 마지막 상대 메시지 ID를 300ms 정도 debounce하여 다시 발행한다.

읽음 발행 payload는 `{ "lastReadMessageId": number }`다. 성공 event는 `message: "MESSAGE_READ"` envelope이며 `data`의 `roomId`, `readerId`, `lastReadMessageId`가 모두 현재 pending read와 일치하는지 확인한다. 같거나 과거 ID는 서버가 event를 발행하지 않으므로 event 부재만으로 실패 처리하지 않는다. pending timeout 뒤 오류가 없으면 목록 및 전체 count REST 재조회로 상태를 확인한다. 읽음 오류는 `/user/queue/chat-errors`의 `MESSAGE_ROOM_MISMATCH`, `MESSAGE_NOT_FOUND`, `CHAT_ROOM_ACCESS_DENIED`로 받는다.

탭이 hidden이거나 대화 route를 벗어난 상태에서는 읽음 처리하지 않는다. 읽음 event를 받기 전에 더 최신 상대 메시지가 렌더링되면 방 unread를 0으로 만들지 않고 최신 ID까지 다시 읽음 처리한다. 실패하면 서버 unread 값을 유지하고 다음 focus 또는 페이지 재진입 때 다시 시도한다.

대화 말풍선 옆에는 읽음 여부나 읽지 않은 인원수를 표시하지 않는다. 이번 요구의 unread 정보는 헤더와 채팅방 목록에만 표시한다.

### 6.3 room topic event 구분

`/sub/chatrooms/{roomId}`에는 두 wire shape가 도착한다.

- `chatMessageId`가 있는 bare object: 새 메시지
- `message === "MESSAGE_READ"`인 envelope: 읽음 위치 갱신

새 메시지와 읽음 event는 각각 별도 validator로 검사한다. 읽음 envelope를 메시지 bubble로 표시하거나 STOMP 오류를 성공 데이터로 변환하지 않는다.

---

## 7. 서버 계약

### 7.1 채팅방 목록 조회

```http
GET /chatrooms?createdAtCursor={createdAt}&lastMessageIdCursor={messageId}&pageSize={size}
Authorization: Bearer <accessToken>
```

query 규칙:

- 첫 요청에서는 두 cursor를 모두 생략한다.
- 다음 요청은 마지막으로 받은 방의 `createdAt`, `lastMessageId`를 한 쌍으로 전달한다.
- 하나만 전달하면 `400 INVALID_CURSOR`다.
- `pageSize` 기본값은 `10`, 허용 범위는 `1~50`이며 목록 UI는 `20`을 사용한다.

응답 `data`는 별도 `items`, `nextCursor`, `hasNext`가 없는 배열이다.

```json
{
  "message": "chat_room_list_read_success",
  "data": [
    {
      "chatRoomId": 20,
      "opponentUserId": 31,
      "nickname": "coffee_moon",
      "profileImageUrl": "https://example.com/profiles/31.png",
      "lastMessageId": 501,
      "content": "안녕하세요",
      "createdAt": "2026-08-04T14:30:00.123456",
      "unreadCount": 2
    }
  ]
}
```

`profileImageUrl`과 삭제된 마지막 메시지의 `content`만 nullable이다. 나머지 field를 임의로 optional 처리하지 않는다. 응답 길이가 `pageSize`보다 작으면 마지막 페이지다. 페이지 병합 시 `chatRoomId`로 중복을 제거하고 서버 순서를 유지한다.

### 7.2 전체 안 읽음 개수 조회

```http
GET /chatrooms/unread-count
Authorization: Bearer <accessToken>
```

```json
{
  "message": "unread_count_load_success",
  "data": 6
}
```

헤더 state의 `totalUnreadCount`에는 `data` 숫자를 저장한다. 객체 형태로 가정하거나 목록의 현재 page unread 합계를 전체 count로 사용하지 않는다.

### 7.3 채팅방 정보 조회

```http
GET /chatrooms/{roomId}
Authorization: Bearer <accessToken>
```

```json
{
  "message": "chat_room_info_read_success",
  "data": {
    "chatRoomId": 20,
    "opponentUserId": 31,
    "nickname": "coffee_moon",
    "profileImageUrl": null,
    "lastMessageId": 501,
    "createdAt": "2026-08-04T14:30:00.123456"
  }
}
```

`/chats/:roomId`를 새로고침하거나 URL로 직접 진입해도 목록 cache에 의존하지 않고 이 API로 상대 정보를 조회한다. 메시지가 없는 방은 `lastMessageId`, `createdAt`이 `null`일 수 있다. 참여자가 아니면 `403`, 방이나 상대 사용자를 찾을 수 없으면 `404`다.

### 7.4 메시지 history

```http
GET /chatrooms/{roomId}/messages?lastMessageId={cursor}&pageSize={size}
Authorization: Bearer <accessToken>
```

`data`는 오래된 메시지에서 최신 메시지 순서의 배열이다. 첫 요청은 cursor를 생략하고, 다음 과거 page는 현재 배열 첫 원소의 `messageId`를 cursor로 사용한다. 응답 길이가 `pageSize`보다 작으면 마지막 page다.

필수 field는 `messageId`, `clientMessageId`, `senderId`, `content`, `chatType`, `createdAt`, `updatedAt`, `deletedAt`이다. `content`, `updatedAt`, `deletedAt`만 nullable이며 `deletedAt`이 non-null이면 `content`는 반드시 `null`이다. 삭제 메시지는 timeline에서 제외하지 않고 `삭제된 메시지입니다.` tombstone으로 표시한다.

### 7.5 WebSocket

| 용도 | 주소 |
| --- | --- |
| 연결 | `/ws-chat` |
| 메시지 발행 | `/pub/chatrooms/{roomId}/messages` |
| 읽음 발행 | `/pub/chatrooms/{roomId}/read` |
| 방 event 구독 | `/sub/chatrooms/{roomId}` |
| 사용자별 목록 갱신 | `/user/queue/chat-updates` |
| 재인증 발행/결과 | `/pub/auth/reauth`, `/user/queue/auth` |
| 오류 | `/user/queue/chat-errors` |

- STOMP `CONNECT` header에 `Authorization: Bearer <accessToken>`을 전달한다.
- 배포 환경은 현재 페이지와 같은 host의 `/ws-chat`에 연결하며 REST의 `/api` prefix를 붙이지 않는다.
- `/chats/:roomId` route를 벗어나면 room subscription을 해제한다. 공유 client를 선택한 경우 auth, error, chat-updates 구독과 연결은 유지한다.
- access token 갱신 후 `/pub/auth/reauth`를 보내고 `/user/queue/auth`의 `REAUTHENTICATED`를 확인한다.
- 연결 이후 업무 오류는 `/user/queue/chat-errors`의 `{ code, message, roomId }`로 처리하며 자동으로 연결 종료로 바꾸지 않는다.

### 7.6 사용자별 채팅방 갱신 event

이 절의 실시간 cache 갱신은 `Q1-A`를 선택한 경우에 적용한다. `Q1-B`에서는 목록 화면 진입·focus·polling 시 REST 목록을 재조회한다.

`/user/queue/chat-updates`의 현재 발행 event는 `chatUpdateType: "MESSAGE_RECEIVED"`다. `data`에는 `roomId`, `messageId`, `clientMessageId`, `senderId`, `content`, `chatType`, `createdAt`, `unreadCount`가 모두 non-null로 온다.

- 이미 처리한 `messageId` event는 버린다.
- cache에 있는 room이면 마지막 메시지와 방별 unread를 event 값으로 교체하고 목록 최상단으로 이동한다.
- cache에 없는 room이면 event에 상대 nickname/profile이 없으므로 임의 room 객체를 만들지 않고 첫 page를 재조회한다.
- 첫 page 재조회 시 기존 추가 page와 `chatRoomId`로 병합하고, cursor는 병합 결과의 마지막 항목에서 다시 계산한다.
- 현재 사용자가 보낸 event는 해당 방 preview와 순서를 갱신하되 전체 unread count는 증가시키지 않는다.
- enum에 존재하지만 현재 서버가 발행하지 않는 `UPSERT`, `DELETE` 동작을 추측하여 구현하지 않는다.

---

## 8. 프런트엔드 구조

```text
src/
├── app/
│   └── router.jsx
├── layouts/
│   └── components/
│       └── Header.jsx
├── pages/
│   ├── ChatListPage.jsx
│   └── ChatRoomPage.jsx
└── features/
    └── chat/
        ├── ChatProvider.jsx
        ├── ChatSessionContext.jsx
        ├── ChatUnreadContext.jsx
        ├── chatMessageModel.js
        ├── chatSessionReducer.js
        ├── chatService.js
        ├── chatSocket.js
        ├── chatContracts.js
        ├── useChatList.js
        ├── useUnreadMessages.js
        ├── useChatSession.js
        ├── useChatReadReceipt.js
        ├── chat.css
        └── components/
            ├── ChatNotificationButton.jsx
            ├── ChatListContent.jsx
            ├── ChatRoomCard.jsx
            ├── ChatModalHost.jsx
            ├── ChatModal.jsx
            └── ChatConversation.jsx
```

역할:

- `ChatSessionContext`: 대화 session과 modal 진입점
- `ChatUnreadContext`: 전체 unread count와 REST polling lifecycle
- `chatService`: 방 정보, 목록, count, history REST API 및 DTO validation
- `chatSocket`: STOMP 연결, 메시지/읽음 발행, room/user 구독 adapter
- `chatContracts`: REST와 STOMP의 서로 다른 wire shape JSDoc 및 runtime validator
- `useChatList`: 복합 cursor pagination, `chatRoomId` dedupe와 실시간 목록 갱신
- `useUnreadMessages`: 초기/focus/30초 REST 동기화
- `useChatSession`: 선택한 방 정보, room 구독, history 병합, 재인증 및 cleanup
- `useChatReadReceipt`: visible 상태, 읽음 debounce, receipt 확인과 REST fallback
- `ChatConversation`: 모달과 page shell이 공유하는 대화 UI

`ChatProvider`는 기존 설계대로 `AuthProvider` 안쪽, `RouterProvider` 바깥쪽에 두며 로그인 사용자 변경 또는 logout 때 count, 요청, 구독, socket state를 모두 초기화한다. TypeScript `type` 또는 `interface`를 추가하지 않고 JSDoc와 validator를 사용한다.

---

## 9. 데이터 흐름

### 헤더와 목록

아래 실시간 흐름은 `Q1-A` 기준이다. `Q1-B`에서는 STOMP user queue 단계 대신 로그인·focus·30초 polling 때 REST count와 현재 목록을 재조회한다.

```text
로그인 완료
  → GET /chatrooms/unread-count
  → totalUnreadCount 저장
  → STOMP CONNECT Authorization header
  → /user/queue/auth, /user/queue/chat-errors 구독
  → /user/queue/chat-updates 구독
  → Header의 점 표시 여부 계산

/chats 진입
  → GET /chatrooms?pageSize=20
  → 카드별 unreadCount 표시
  → 응답 unread 합계가 아닌 count endpoint 값을 전체 기준으로 사용

MESSAGE_RECEIVED event
  → messageId 중복 확인
  → known room: preview/unread 갱신 후 최상단 이동
  → unknown room: 목록 첫 page 재조회
  → 상대 메시지면 totalUnreadCount local +1
```

페이지네이션된 현재 목록의 합은 아직 불러오지 않은 방을 제외하므로 전체 안 읽음 개수로 사용하지 않는다. focus, STOMP 재연결과 재인증 완료 시 REST count를 다시 조회하여 local delta를 보정한다.

### 카드 클릭과 읽음 처리

```text
ChatRoomCard click
  → /chats/{roomId}
  → token 확인
  → GET /chatrooms/{roomId}
  → STOMP 연결 확인 및 room 구독
  → history 조회/병합
  → 마지막 상대 messageId까지 /pub/chatrooms/{roomId}/read
  → 현재 사용자의 MESSAGE_READ event 확인
  → 더 최신 상대 메시지가 없으면 room unreadCount = 0
  → GET /chatrooms/unread-count로 Header 재동기화
```

---

## 10. 오류 및 경계 상황

| 상황 | 처리 |
| --- | --- |
| count 조회 실패 | 기존 count 유지, 아이콘만으로 오류 표시하지 않음, 다음 주기에 재시도 |
| 목록 조회 실패 | 목록 page에 오류와 재시도 표시 |
| 목록 응답에 필수 field 누락 | contract error로 목록 오류 처리 |
| cursor 한쪽만 전달 | 요청 생성 오류로 기록하고 첫 page부터 다시 조회 |
| room 접근 403 | `접근할 수 없는 채팅방입니다.` 표시 후 `/chats` 이동 제공 |
| room 404 | `채팅방을 찾을 수 없습니다.` 표시 후 `/chats` 이동 제공 |
| 읽음 STOMP 오류 | code에 따라 서버 unread 유지, 접근 거부면 방 이탈, 그 외 다음 focus/진입 시 재시도 |
| `chat-updates` contract 오류 | 성공 데이터로 반영하지 않고 구독 계층에서 오류 전파, REST 재동기화 |
| STOMP token 만료 | HTTP refresh 후 `/pub/auth/reauth`, 최종 실패 시 로그인 처리 |
| 상대 profile image 실패 | 기본 profile image 표시 |
| 긴 nickname/message | 한 줄 말줄임, 전체 값은 접근 가능한 label로 보존 |
| WebSocket 실패 | 활성 대화는 연결 오류 표시 및 입력 비활성화; `Q1-A`의 헤더/목록은 REST focus·polling fallback으로 전환 |
| logout | 요청, 구독, socket 정리 후 unread state 초기화 |

HTTP 401은 별도 인증 기준 문서와 기존 `httpClient`의 access token refresh 1회 정책을 사용한다. REST에서 token이 갱신되면 기존 STOMP session에도 재인증을 수행한다.

---

## 11. 테스트 계획

### 단위 및 컴포넌트

- 채팅 아이콘이 프로필 버튼 왼쪽에 렌더링된다.
- `totalUnreadCount`가 0이면 점이 없고 1 이상이면 점이 표시된다.
- 아이콘 접근성 이름에 실제 unread count가 반영된다.
- 채팅 아이콘 클릭 시 `/chats`로 이동한다.
- 목록에서 검색창, 새 대화, 입력 중, 온라인 UI가 렌더링되지 않는다.
- 목록이 서버의 `(createdAt DESC, lastMessageId DESC)` 순서로 표시된다.
- 목록 다음 page 요청에 마지막 항목의 `createdAtCursor`, `lastMessageIdCursor`를 함께 전달한다.
- 목록 응답 길이가 `pageSize`보다 작으면 pagination을 종료한다.
- 실시간 event와 page 응답의 중복 room은 `chatRoomId`로 한 번만 표시한다.
- unread가 있으면 preview가 bold이고 badge가 표시된다.
- unread가 없으면 preview가 회색이며 badge가 없다.
- badge는 100개 이상일 때 `99+`로 표시된다.
- `content: null`인 마지막 메시지는 삭제 안내로 표시한다.
- 상대 시간 경계값이 `방금`, `1분 전`, `1시간 전`, `어제`, `2일 전`으로 표시된다.
- 카드 click 시 `/chats/{roomId}`로 이동한다.
- 직접 room URL 진입 시 `GET /chatrooms/{roomId}`로 상대 정보를 조회한다.
- hidden document에서는 읽음 STOMP publish를 호출하지 않는다.
- visible한 대화에서 마지막 상대 `messageId`를 읽음 destination으로 발행한다.
- 현재 사용자의 `MESSAGE_READ` event를 성공으로 처리하고 다른 사용자의 event와 구분한다.
- 읽음 성공 후 전체 count endpoint 값으로 header state를 재동기화한다.
- `Q1-A`에서 `MESSAGE_RECEIVED` event가 known room을 최상단으로 이동하고 preview와 unread를 갱신한다.
- `Q1-A`에서 unknown room event는 불완전한 카드를 만들지 않고 첫 page를 재조회한다.
- `Q1-A`에서 같은 `messageId` event를 중복 반영하지 않는다.
- focus listener, 요청, 구독과 socket이 unmount/logout 시 정리된다.

### E2E

- `Q1-A`에서 사용자 B가 메시지를 보내면 사용자 A의 헤더와 목록이 `chat-updates` event로 갱신된다.
- `Q1-B`에서 사용자 B가 메시지를 보내면 사용자 A의 헤더가 polling 주기 안에 갱신된다.
- A가 목록으로 이동하면 해당 방의 굵은 preview와 unread count가 보인다.
- A가 카드를 누르면 대화 페이지로 이동하고 WebSocket이 연결된다.
- 읽음 처리 후 목록으로 돌아오면 preview가 회색으로 바뀌고 badge가 사라진다.
- 마지막 unread가 해소되면 헤더 점도 사라진다.
- 대화 페이지에서 나가면 room subscription이 제거되고 선택한 client 수명 주기 정책대로 connection이 유지 또는 종료된다.
- access token 갱신 뒤 STOMP 재인증이 성공하고 전역 및 room 구독이 유지된다.

---

## 12. 구현 순서 및 확정 사항

1. 아래 제품·수명 주기 선택을 확정한다.
2. `chat-api-spec.md` 기반 REST/STOMP validator와 service를 작성한다.
3. `ChatProvider`에 client 연결, auth/error/chat-updates 구독과 재인증을 구현한다.
4. 전체 unread REST 초기화·보정과 실시간 local count 반영을 구현한다.
5. Header action 영역과 `ChatNotificationButton`을 구현한다.
6. `/chats` route, 복합 cursor 목록 hook과 components를 구현한다.
7. `/chats/:roomId`에서 방 정보, room 구독, history 병합과 읽음 publish를 구현한다.
8. 단위, 컴포넌트, E2E 테스트를 추가한다.
9. `npm run lint`, `npm test -- --run`, `npm run build`로 검증한다.

API endpoint, pagination, unread 응답, history, 읽음 destination과 삭제 메시지 규칙은 `chat-api-spec.md`에서 모두 확정되어 있다. 아래 항목만 제품 및 프런트 구조 결정이 필요하다.

### Q1. STOMP client 수명 주기

- **A. 로그인 동안 ChatProvider가 하나의 client를 유지한다. — 권장**
  - `/user/queue/chat-updates`로 헤더와 목록을 즉시 갱신한다.
  - 대화 진입·이탈 때 room subscription만 추가·제거하고 auth/error 구독과 재인증 흐름을 공유한다.
  - 초기, focus, 재연결 때 REST count로 보정한다.
- **B. 모달과 대화 페이지가 열릴 때만 client를 연결한다.**
  - 대화가 닫히면 `deactivate()`하고 헤더 unread는 30초 polling으로 갱신한다.
  - 전역 실시간 목록 갱신은 제공하지 않는다.

이 선택은 `DM_CHAT_DESIGN.md`의 `Q2`와 같은 항목이므로 두 문서에 동일하게 적용한다.

선택: **Q1-B**. 대화가 열려 있을 때만 STOMP client를 연결하고, header unread와 열린 채팅 목록은 focus 및 30초 REST polling으로 재동기화한다.

### Q2. 채팅 화면 뒤로가기 위치

현재 공통 Header가 `/posts` 외 경로에 뒤로가기를 표시하므로 페이지 내부 버튼을 함께 렌더링하면 중복된다.

- **A. 공통 Header가 뒤로가기를 소유한다. — 권장**
  - `/chats`는 안전한 이전 보호 페이지 또는 `/posts`, `/chats/:roomId`는 `/chats`로 이동하도록 Header 규칙을 확장한다.
  - 채팅 page 본문에는 `h1`만 표시한다.
- **B. 채팅 page가 자체 뒤로가기를 소유한다.**
  - chat route에서는 공통 Header의 뒤로가기를 숨기고 page shell의 버튼을 사용한다.

선택: **Q2-A**. 공통 Header가 채팅 목록과 채팅방의 이전 화면 이동을 소유하고 page 본문은 별도 뒤로가기 button을 렌더링하지 않는다.
