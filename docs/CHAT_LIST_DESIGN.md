# 채팅 알림 아이콘 및 채팅방 목록 설계

## 1. 목적

로그인 사용자가 모든 보호 페이지의 상단에서 안 읽은 DM 존재 여부를 확인하고, 채팅 아이콘을 눌러 자신의 1:1 채팅방 목록으로 이동할 수 있게 한다. 목록에서는 상대 사용자, 마지막 메시지, 안 읽은 메시지 수, 마지막 메시지 시각을 확인하고 각 채팅방으로 이동할 수 있다.

이 문서는 [`DM_CHAT_DESIGN.md`](./DM_CHAT_DESIGN.md)의 대화 기능을 확장한다. 대화창 말풍선에는 읽음 표시를 만들지 않지만, 채팅방 목록과 헤더 알림을 위해 서버는 사용자별 읽음 기준을 관리한다.

---

## 2. MVP 범위

### 포함

- 상단 프로필 이미지 왼쪽에 채팅 아이콘 버튼 표시
- 하나 이상의 안 읽은 메시지가 있으면 아이콘 우측 상단에 주황색 점 표시
- 아이콘 클릭 시 `/chats` 채팅방 목록 페이지로 이동
- 목록 페이지의 뒤로가기 버튼
- 상대방 `nickname`, `profileImageUrl` 표시
- 방별 마지막 텍스트 메시지 표시
- 방별 안 읽은 메시지 개수 badge 표시
- 읽은 마지막 메시지는 회색, 안 읽은 마지막 메시지는 굵은 글씨로 표시
- 마지막 메시지를 보낸 뒤 경과 시간 표시
- 카드 클릭 시 `/chats/{roomId}` 1:1 DM 대화 페이지로 이동
- 대화 페이지 진입 시 읽음 처리
- 목록 loading, empty, error, pagination 상태
- 대화 페이지에서 기존 WebSocket 주소 사용 및 이탈 시 연결 해제

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
- 헤더 알림의 완전한 실시간 WebSocket 갱신

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

목록 페이지의 뒤로가기는 `navigate(-1)`을 우선 사용한다. 앱 내부 이전 history가 없거나 로그인/auth 페이지로 돌아갈 가능성이 있으면 `/posts`로 이동한다. 대화 페이지의 뒤로가기는 항상 `/chats`를 기본값으로 한다.

게시글 작성자를 눌러 시작한 DM은 기존 설계대로 모달로 열 수 있다. 목록에서 진입한 `/chats/:roomId`는 같은 `ChatConversation` UI와 session hook을 페이지 shell 안에서 재사용한다. 두 진입점 모두 한 번에 하나의 STOMP client만 활성화한다.

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

제공된 `/sub/chatrooms/{roomId}`는 개별 방 구독 주소이며 사용자 전체 알림 destination은 제공되지 않았다. 모든 방을 항상 구독하는 방식은 방 수가 늘수록 비효율적이므로 MVP 헤더는 HTTP count 조회를 사용한다.

안 읽음 count를 다음 시점에 갱신한다.

- 로그인 완료 직후
- `Header` mount 시
- `/chats` 진입 및 목록 재조회 완료 시
- `/chats/:roomId`에서 읽음 처리 성공 시
- 브라우저 window가 다시 focus될 때
- 보호 페이지가 열린 동안 30초 간격

같은 시각의 중복 요청은 하나로 합치고, logout 또는 `AuthProvider` unmount 시 timer와 요청을 정리한다. 30초 이내의 즉시 갱신이 필수가 되면 백엔드에 사용자 전용 destination(예: `/user/queue/chat-notifications`)을 별도 추가해야 한다.

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
- 페이지 상단에는 뒤로가기, `h1`인 `메시지`만 둔다.
- `모든 대화`를 목록 section의 `h2`로 둔다.
- 검색창과 새 대화 버튼을 렌더링하지 않는다.
- 목록은 마지막 메시지 `sentAt` 내림차순으로 정렬한다.
- 방이 많으면 cursor pagination과 기존 `InfiniteScrollTrigger`를 재사용한다.
- 각 항목 전체를 하나의 `Link`로 구현하여 nested interactive element를 만들지 않는다.
- 접근성 이름은 `{nickname}님과의 대화, 읽지 않은 메시지 {unreadCount}개` 형식으로 한다. 0개이면 안 읽음 문구를 생략한다.

### 5.2 채팅방 카드

| 영역 | 표시 규칙 |
| --- | --- |
| 프로필 | 상대방 `profileImageUrl`, 실패/빈 값이면 기존 `Avatar` fallback |
| 닉네임 | 상대방 `nickname`, 한 줄 말줄임 |
| 마지막 메시지 | 텍스트 한 줄 말줄임 |
| 경과 시간 | 카드 우측 상단, `lastMessage.sentAt` 기준 |
| 안 읽음 badge | `unreadCount > 0`일 때 우측에 숫자 표시 |

마지막 메시지 style:

- `unreadCount > 0`: 본문 글자색, `font-weight: 700`
- `unreadCount === 0`: 회색 보조 글자색, `font-weight: 400`
- 닉네임은 읽음 여부와 관계없이 식별하기 쉬운 동일한 굵기를 유지한다.
- 안 읽음 badge는 `99`까지 숫자로 표시하고 100개 이상은 `99+`로 표시한다.

마지막 메시지가 아직 없는 방은 MVP 목록에 노출하지 않는 것을 기본값으로 한다. 서버가 빈 방도 반환한다면 preview는 `아직 메시지가 없습니다.`로 표시하고 목록 맨 아래에 둔다.

### 5.3 상대 시간

클라이언트 현재 시각과 서버의 ISO 8601 `sentAt` 차이를 사용한다.

| 경과 시간 | 표시 |
| --- | --- |
| 1분 미만 | `방금` |
| 1분 이상, 60분 미만 | `{n}분 전` |
| 1시간 이상, 24시간 미만 | `{n}시간 전` |
| 24시간 이상, 48시간 미만 | `어제` |
| 2일 이상 | `{n}일 전` |

- 음수이거나 잘못된 날짜이면 빈 문자열로 표시하고 UI를 중단하지 않는다.
- 화면을 계속 열어 둔 경우 표시가 낡지 않도록 1분 간격으로 현재 시각 state만 갱신한다.
- `<time dateTime={sentAt}>`을 사용하고 전체 날짜/시간을 접근성 label 또는 `title`로 제공한다.

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

안 읽음 개수는 현재 사용자가 보낸 메시지를 제외하고, 사용자의 방별 읽음 기준 이후에 상대방이 보낸 메시지 수다.

권장 저장 모델:

```text
chat_room_member
├── room_id
├── user_id
└── last_read_message_id
```

`last_read_message_id` 갱신은 항상 기존 값보다 큰 message id로만 진행하여 늦게 도착한 요청이 읽음 상태를 되돌리지 않게 한다.

### 6.2 읽음 처리 시점

1. 사용자가 `/chats/:roomId`로 이동한다.
2. WebSocket 연결과 구독을 먼저 완료한다.
3. history를 조회하여 화면에 렌더링한다.
4. document가 visible이고 대화 화면이 활성화된 경우 마지막으로 렌더링된 상대 메시지의 `messageId`까지 읽음 처리한다.
5. 처리 성공 시 해당 방의 local `unreadCount`와 header count를 갱신한다.
6. 대화 중 새 상대 메시지가 오면 visible 상태에서 렌더링된 후 같은 API를 300ms 정도 debounce하여 호출한다.

탭이 hidden이거나 대화 route를 벗어난 상태에서는 읽음 처리하지 않는다. API가 실패하면 메시지는 볼 수 있지만 목록의 unread 상태는 서버 값을 유지하고, 다음 focus 또는 페이지 재진입 때 다시 시도한다.

대화 말풍선 옆에는 읽음 여부나 읽지 않은 인원수를 표시하지 않는다. 이번 요구의 unread 정보는 헤더와 채팅방 목록에만 표시한다.

---

## 7. 서버 계약 제안 — 백엔드 확정 필요

제공된 WebSocket 주소만으로는 채팅방 목록, 안 읽음 개수, 읽음 처리를 구현할 수 없다. 아래 HTTP 계약을 구현 전에 확정해야 한다.

### 7.1 채팅방 목록 조회

```http
GET /chatrooms?pageSize=20&lastMessageId={lastMessageId}
Authorization: Bearer <accessToken>
```

응답 제안:

```json
{
  "data": {
    "items": [
      {
        "roomId": 20,
        "participant": {
          "userId": 31,
          "nickname": "coffee_moon",
          "profileImageUrl": "/profiles/31.png"
        },
        "lastMessage": {
          "messageId": 501,
          "senderId": 31,
          "content": "안녕하세요",
          "sentAt": "2026-07-23T10:30:00Z"
        },
        "unreadCount": 2
      }
    ],
    "nextCursor": 501,
    "hasNext": false
  }
}
```

필수 field:

- `roomId`
- `participant.userId`, `nickname`, `profileImageUrl`
- `lastMessage.messageId`, `senderId`, `content`, `sentAt`
- `unreadCount`

서버는 현재 사용자가 참여한 방만 반환하며 `lastMessage.sentAt` 내림차순을 보장한다. 상대방 탈퇴 시 nickname/profile 표시 규칙은 백엔드와 별도 확정한다.

### 7.2 전체 안 읽음 개수 조회

```http
GET /chatrooms/unread-count
Authorization: Bearer <accessToken>
```

```json
{
  "data": {
    "totalUnreadCount": 6
  }
}
```

헤더는 `totalUnreadCount > 0` 여부만 시각적으로 표시하지만 접근성 label과 local count 조정을 위해 실제 숫자를 받는다.

### 7.3 읽음 처리

```http
POST /chatrooms/{roomId}/read
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "lastReadMessageId": 501
}
```

```json
{
  "data": {
    "roomId": 20,
    "unreadCount": 0,
    "totalUnreadCount": 4
  }
}
```

서버는 사용자가 해당 room의 참여자인지, `lastReadMessageId`가 해당 room의 메시지인지 검증한다. 같은 값으로 여러 번 호출해도 결과가 같은 멱등 연산이어야 한다.

### 7.4 메시지 history

목록 카드에서 대화로 이동했을 때 기존 메시지를 보여주고 정확한 읽음 기준을 정하려면 history API가 필요하다.

```http
GET /chatrooms/{roomId}/messages?pageSize=30&beforeMessageId={messageId}
Authorization: Bearer <accessToken>
```

메시지 DTO는 [`DM_CHAT_DESIGN.md`](./DM_CHAT_DESIGN.md)의 `messageId`, `roomId`, `senderId`, `content`, `sentAt` 계약을 따른다.

### 7.5 WebSocket

대화 페이지에서만 다음 계약을 사용한다.

| 용도 | 주소 |
| --- | --- |
| 연결 | `/ws-chat` |
| 발행 | `/pub/chatrooms/{roomId}/messages` |
| 구독 | `/sub/chatrooms/{roomId}` |

- `/chats/:roomId` 진입 시 access token을 확인한 후 연결한다.
- STOMP `CONNECT` header에 `Authorization: Bearer <accessToken>`을 전달한다.
- route를 벗어나면 subscription을 해제하고 STOMP client를 `deactivate()`한다.
- 연결 실패 또는 끊김은 `채팅 연결이 끊겼습니다.`로 표시한다.

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
        ├── ChatContext.jsx
        ├── chatService.js
        ├── chatSocket.js
        ├── useChatList.js
        ├── useUnreadMessages.js
        ├── useChatSession.js
        ├── chat.css
        └── components/
            ├── ChatNotificationButton.jsx
            ├── ChatRoomList.jsx
            ├── ChatRoomCard.jsx
            └── ChatConversation.jsx
```

역할:

- `ChatContext`: `totalUnreadCount`, count refresh, 읽음 처리 후 count 반영
- `chatService`: 목록/count/history/read HTTP API 및 DTO validation
- `chatSocket`: STOMP transport
- `useChatList`: cursor pagination과 목록 재조회
- `useUnreadMessages`: 초기/focus/30초 polling lifecycle
- `useChatSession`: 선택한 방의 WebSocket, history, 읽음 처리 및 cleanup
- `ChatConversation`: 모달과 page shell이 공유하는 대화 UI

`ChatProvider`는 기존 설계대로 `AuthProvider` 안쪽에 두며 로그인 사용자 변경 또는 logout 때 count, timer, socket state를 모두 초기화한다.

---

## 9. 데이터 흐름

### 헤더와 목록

```text
ChatProvider mount
  → GET /chatrooms/unread-count
  → totalUnreadCount 저장
  → Header의 점 표시 여부 계산

/chats 진입
  → GET /chatrooms
  → 카드별 unreadCount 표시
  → 응답 unread 합계가 아닌 count endpoint 값을 전체 기준으로 사용
```

페이지네이션된 현재 목록의 합은 아직 불러오지 않은 방을 제외하므로 전체 안 읽음 개수로 사용하지 않는다.

### 카드 클릭과 읽음 처리

```text
ChatRoomCard click
  → /chats/{roomId}
  → token 확인
  → WebSocket 연결 및 room 구독
  → history 조회/병합
  → 마지막 상대 message까지 POST /read
  → room unreadCount = 0
  → 응답 totalUnreadCount로 Header 갱신
```

---

## 10. 오류 및 경계 상황

| 상황 | 처리 |
| --- | --- |
| count 조회 실패 | 기존 count 유지, 아이콘만으로 오류 표시하지 않음, 다음 주기에 재시도 |
| 목록 조회 실패 | 목록 page에 오류와 재시도 표시 |
| 목록 응답에 필수 field 누락 | contract error로 목록 오류 처리 |
| room 접근 403 | `접근할 수 없는 채팅방입니다.` 표시 후 `/chats` 이동 제공 |
| room 404 | `채팅방을 찾을 수 없습니다.` 표시 후 `/chats` 이동 제공 |
| 읽음 API 실패 | 서버 unread 값을 유지하고 다음 focus/진입 시 재시도 |
| 상대 profile image 실패 | 기본 profile image 표시 |
| 긴 nickname/message | 한 줄 말줄임, 전체 값은 접근 가능한 label로 보존 |
| WebSocket 실패 | `채팅 연결이 끊겼습니다.` 표시 및 입력 비활성화 |
| logout | polling, 요청, 구독, socket 정리 후 unread state 초기화 |

HTTP 401은 기존 `httpClient`의 access token refresh 1회 정책을 사용한다.

---

## 11. 테스트 계획

### 단위 및 컴포넌트

- 채팅 아이콘이 프로필 버튼 왼쪽에 렌더링된다.
- `totalUnreadCount`가 0이면 점이 없고 1 이상이면 점이 표시된다.
- 아이콘 접근성 이름에 실제 unread count가 반영된다.
- 채팅 아이콘 클릭 시 `/chats`로 이동한다.
- 목록에서 검색창, 새 대화, 입력 중, 온라인 UI가 렌더링되지 않는다.
- 목록이 `lastMessage.sentAt` 내림차순으로 표시된다.
- unread가 있으면 preview가 bold이고 badge가 표시된다.
- unread가 없으면 preview가 회색이며 badge가 없다.
- badge는 100개 이상일 때 `99+`로 표시된다.
- 상대 시간 경계값이 `방금`, `1분 전`, `1시간 전`, `어제`, `2일 전`으로 표시된다.
- 카드 click 시 `/chats/{roomId}`로 이동한다.
- hidden document에서는 읽음 API를 호출하지 않는다.
- visible한 대화에서 마지막 상대 message까지 읽음 처리한다.
- 읽음 성공 응답의 `totalUnreadCount`로 header state를 갱신한다.
- polling, focus listener, socket이 unmount/logout 시 정리된다.

### E2E

- 사용자 B가 메시지를 보내면 사용자 A의 헤더에 polling 주기 안에 점이 표시된다.
- A가 목록으로 이동하면 해당 방의 굵은 preview와 unread count가 보인다.
- A가 카드를 누르면 대화 페이지로 이동하고 WebSocket이 연결된다.
- 읽음 처리 후 목록으로 돌아오면 preview가 회색으로 바뀌고 badge가 사라진다.
- 마지막 unread가 해소되면 헤더 점도 사라진다.
- 대화 페이지에서 나가면 WebSocket connection이 종료된다.

---

## 12. 구현 순서 및 확정 체크리스트

1. 목록, 전체 unread count, history, read HTTP API를 백엔드와 확정한다.
2. 확정된 계약을 `docs/API_SPEC.md`에 추가한다.
3. `ChatProvider`와 count 조회/polling을 구현한다.
4. Header action 영역과 `ChatNotificationButton`을 구현한다.
5. `/chats` route, 목록 service/hook/components를 구현한다.
6. `/chats/:roomId` route에 공유 `ChatConversation`을 연결한다.
7. history 병합과 읽음 처리 흐름을 구현한다.
8. 단위, 컴포넌트, E2E 테스트를 추가한다.
9. lint, test, build로 검증한다.

구현 전에 다음을 확정해야 한다.

- [ ] 채팅방 목록 endpoint와 pagination 방식
- [ ] 전체 안 읽음 개수 endpoint
- [ ] 읽음 처리 endpoint와 `lastReadMessageId` 규칙
- [ ] 메시지 history endpoint
- [ ] 삭제된 사용자 또는 삭제된 마지막 메시지 표시 규칙
- [ ] 30초 polling으로 충분한지, 실시간 사용자 알림 destination이 필요한지
