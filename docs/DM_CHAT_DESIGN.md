# DM 채팅 화면 설계

## 1. 목적

게시글 목록과 게시글 상세에서 작성자 영역을 누르면 해당 작성자와 1:1 DM을 주고받을 수 있는 채팅 모달을 연다. 이번 구현은 텍스트 실시간 송수신과 연결 수명 주기에 집중한다.

상단 채팅 알림 아이콘, 채팅방 목록, 목록에서 진입하는 대화 페이지와 읽음 상태는 후속 문서인 [`CHAT_LIST_DESIGN.md`](./CHAT_LIST_DESIGN.md)에서 다룬다. 이 문서의 `채팅방 목록 제외`, `이전 메시지 제외`는 게시글 작성자에서 바로 여는 초기 모달만 단독 구현할 때의 범위다.

이 문서의 기준은 다음과 같다.

- API 단일 기준: [`chat-api-spec.md`](./chat-api-spec.md)
- 프런트엔드: 현재 React 애플리케이션 구조
- 프로토콜: STOMP over WebSocket
- WebSocket endpoint: `/ws-chat`
- 메시지 발행 destination: `/pub/chatrooms/{roomId}/messages`
- 메시지 구독 destination: `/sub/chatrooms/{roomId}`

WebSocket은 SockJS 없이 native WebSocket 위에서 STOMP를 사용한다. endpoint, payload, 응답 field가 실제 서버와 다르면 프런트 mapper로 숨기지 않고 `chat-api-spec.md`를 먼저 갱신한다.

---

## 2. MVP 범위

### 포함

- 게시글 목록과 상세의 작성자 클릭으로 채팅 모달 열기
- 상대방의 `nickname`, `profileImageUrl` 표시
- 텍스트 메시지 송수신
- `clientMessageId` 기반 optimistic message 표시와 서버 event 병합
- 내 메시지와 상대 메시지의 정렬 및 색상 구분
- 모달 배경 blur, 배경 스크롤 및 클릭 차단
- 모달을 열 때 access token 확인
- 연결, 구독, 발행, 재인증 오류 표시
- access token 갱신 후 기존 STOMP session 재인증
- 모달을 닫을 때 room 구독 해제, 대화 전용 연결을 선택한 경우 WebSocket 연결 종료
- 키보드 접근성: focus trap, `Escape` 닫기, 닫은 후 trigger로 focus 복원

### 제외

- 읽음 여부 및 읽음 아이콘
- 온라인 상태
- 더보기(`...`) 메뉴
- 사진, 파일, 이모지 전송 UI
- 입력 중 표시
- 푸시 알림 및 백그라운드 알림
- 채팅방 목록
- 자동 재연결
- 메시지 수정 및 삭제

일반 문자열 안에 사용자가 직접 입력한 유니코드 이모지는 텍스트로 취급한다. 별도 이모지 선택기와 이모지 전송 기능만 제공하지 않는다.

---

## 3. 사용자 흐름

1. 사용자가 게시글의 작성자 프로필 이미지 또는 닉네임을 누른다.
2. 프런트엔드는 현재 로그인 사용자와 작성자의 `userId`를 비교한다.
   - 본인이 작성한 글이면 DM trigger를 제공하지 않는다.
3. 메모리의 access token을 확인한다.
   - 토큰이 없으면 채팅 모달을 열지 않고 로그인 화면으로 이동한다. 현재 URL을 `returnTo`로 보존한다.
4. 상대 사용자와의 1:1 `roomId`를 서버에서 조회하거나 생성한다.
5. 모달을 열고 연결 중 상태를 표시한다.
6. `/ws-chat`에 연결한 뒤 `/user/queue/auth`, `/user/queue/chat-errors`, `/sub/chatrooms/{roomId}`를 구독한다.
7. 사용자가 텍스트를 입력하고 전송하면 UUID v4 `clientMessageId`를 생성하고 optimistic message를 표시한 뒤 `/pub/chatrooms/{roomId}/messages`로 발행한다.
8. 수신 메시지의 `userId`와 로그인 사용자의 `userId`를 비교하여 내 메시지와 상대 메시지를 구분하고, `clientMessageId`가 같은 optimistic message를 서버 확정 데이터로 교체한다.
9. 닫기 버튼 또는 `Escape`로 모달을 닫으면 room subscription을 해제한다. 이 모달이 STOMP client의 유일한 소비자일 때만 client를 비활성화한다.

배경을 눌러도 모달은 닫히지 않으며 게시글에도 click event가 전달되지 않는다.

---

## 4. 화면 설계

### 4.1 진입점

#### 게시글 목록

현재 `PostCard`는 카드 전체가 하나의 `Link`이므로 작성자 버튼을 그 안에 중첩하면 유효하지 않은 interactive markup이 된다. 구현 시 다음처럼 영역을 분리한다.

- 제목, 이미지, 통계, 작성일: 게시글 상세로 이동하는 `Link`
- 작성자 프로필 이미지와 닉네임: 채팅을 여는 `button`
- 작성자 버튼의 접근성 이름: `{nickname}님에게 메시지 보내기`

작성자 버튼 click은 카드 상세 이동을 발생시키지 않아야 한다.

#### 게시글 상세

헤더의 작성자 프로필 이미지와 닉네임을 하나의 `button`으로 감싼다. 작성일은 버튼 밖에 둔다.

#### 내 게시글

로그인 사용자와 작성자의 `userId`가 같으면 작성자 영역을 일반 표시로 유지하고 채팅 버튼으로 만들지 않는다.

### 4.2 모달 구성

```text
┌──────────────────────────────────────┐
│ [프로필] nickname              [닫기] │
├──────────────────────────────────────┤
│                                      │
│ [프로필] 상대 메시지                 │
│                      내 메시지        │
│ [프로필] 상대 메시지                 │
│                                      │
│       연결/전송 오류 메시지 영역      │
├──────────────────────────────────────┤
│ [메시지 입력........................] [전송] │
└──────────────────────────────────────┘
```

- 헤더: 상대방의 프로필 이미지, 닉네임, 닫기 버튼만 표시한다.
- 본문: 세로 스크롤이 가능한 메시지 목록이다.
- 상대 메시지: 왼쪽 정렬, 상대 프로필 이미지 표시, 밝은 중립색 bubble
- 내 메시지: 오른쪽 정렬, 프로필 이미지 생략, 서비스 primary 색 bubble
- 입력부: 텍스트 입력과 전송 버튼만 둔다.
- `...`, 온라인 문구/표식, 읽음 아이콘, 사진 버튼, 이모지 버튼은 두지 않는다.
- 연결 전에는 입력과 전송 버튼을 비활성화한다.
- 빈 메시지와 공백만 있는 메시지는 전송하지 않는다.
- 전송 후 입력창을 비우고 최신 메시지가 보이도록 아래로 스크롤한다.
- 전송 직후 optimistic bubble을 표시하며, 같은 `clientMessageId`의 서버 event가 오면 중복 추가하지 않고 확정 상태로 교체한다.
- `MESSAGE_CONTENT_REQUIRED`, `MESSAGE_CONTENT_TOO_LONG` 등 전송 오류를 표시한다. 오류 payload에는 `clientMessageId`가 없으므로 여러 전송을 동시에 pending으로 둘 때 특정 bubble과 임의로 연결하지 않는다.

### 4.3 반응형 및 배경 차단

- 데스크톱: 화면 중앙 또는 우측 하단에 고정된 최대 너비 `30rem`, 최대 높이 `min(42rem, calc(100dvh - 2rem))`
- 모바일: 좌우 여백 `1rem`, 높이는 `calc(100dvh - 2rem)` 이내
- overlay: `position: fixed; inset: 0; z-index`는 기존 confirm dialog보다 높게 설정
- 배경: 반투명 색상과 `backdrop-filter: blur(6px)` 적용
- modal open 동안 `document.body.style.overflow = 'hidden'`
- overlay에서 pointer event를 소비하고 backdrop click으로 닫지 않는다.
- modal은 `role="dialog"`, `aria-modal="true"`, nickname과 연결된 `aria-labelledby`를 사용한다.
- 모달 내부에 focus를 가두고 열린 직후 메시지 입력창으로 focus한다.

---

## 5. 상태와 수명 주기

채팅 모달은 다음 상태를 갖는다.

| 상태 | 의미 | UI |
| --- | --- | --- |
| `closed` | 모달이 닫힘 | 렌더링하지 않음 |
| `resolving-room` | room 조회/생성 중 | 모달과 loading 표시, 입력 비활성화 |
| `connecting` | WebSocket/STOMP 연결 중 | `채팅에 연결하는 중…`, 입력 비활성화 |
| `connected` | 구독 및 발행 가능 | 입력 활성화 |
| `reauthenticating` | 갱신된 access token으로 STOMP session 재인증 중 | 기존 메시지 유지, 새 발행 일시 차단 |
| `connection-error` | 연결 또는 구독 실패/끊김 | `채팅 연결이 끊겼습니다.`, 입력 비활성화 |
| `closing` | 구독/연결 정리 중 | 추가 입력 차단 |

### 연결 순서

1. `openChat(targetUser)` 호출
2. access token과 로그인 사용자 확인
3. room 조회/생성
4. STOMP client 생성
5. STOMP `CONNECT` header에 `Authorization: Bearer <accessToken>` 전달
6. 연결 성공 callback에서 `/user/queue/auth`, `/user/queue/chat-errors`를 먼저 구독
7. `/sub/chatrooms/{roomId}` 구독
8. 필요한 구독 등록을 마친 뒤 `connected`로 전환

브라우저의 기본 WebSocket handshake에는 임의의 `Authorization` header를 직접 넣을 수 없다. 따라서 서버는 STOMP `CONNECT` frame의 `Authorization` header를 인증해야 한다. URL query에 access token을 넣는 방식은 로그 노출 위험 때문에 사용하지 않는다.

### 종료 순서

다음 경우 모두 같은 `closeChat()` cleanup을 실행한다.

- 닫기 버튼
- `Escape`
- 페이지 전환 또는 provider unmount
- 로그아웃 또는 인증 상태가 anonymous로 변경됨

cleanup은 중복 호출해도 안전해야 한다.

1. 새 메시지 전송 차단
2. 활성 room subscription의 `unsubscribe()` 호출
3. 이 모달이 client의 유일한 소비자일 때만 STOMP client의 `deactivate()` 호출
4. component state와 message 목록 초기화
5. body scroll lock 해제
6. 채팅을 연 trigger로 focus 복원

MVP에서는 비정상 종료 후 자동 재연결을 하지 않는다. 연결 실패 또는 WebSocket close가 발생하면 정확히 `채팅 연결이 끊겼습니다.`를 `role="alert"`로 표시하고 사용자가 모달을 닫도록 한다. 연결 이후의 업무 오류는 연결 종료로 취급하지 않고 `/user/queue/chat-errors`의 `code`에 따라 처리한다.

### access token 재인증

REST 요청 과정에서 access token이 갱신되면 기존 STOMP session도 새 token으로 재인증한다.

1. 새 access token을 확인하고 메시지 발행을 잠시 차단한다.
2. `/pub/auth/reauth`에 body 없이 새 `Authorization: Bearer <accessToken>` native header를 전송한다.
3. `/user/queue/auth`에서 `type: "REAUTHENTICATED"`와 `expiresAt`을 확인한다.
4. 성공하면 기존 구독과 대화 state를 유지하고 발행을 재개한다.
5. `INVALID_ACCESS_TOKEN`, `ACCESS_TOKEN_EXPIRED`면 HTTP refresh와 재인증을 한 번 수행하고, 최종 실패하면 연결을 종료하고 로그인 처리를 진행한다.
6. `REAUTH_USER_MISMATCH`면 기존 session을 재사용하지 않고 연결을 종료한다.

현재 `AuthContext`의 refresh handler가 token 갱신 완료를 ChatProvider에 전달할 수 있도록 callback 또는 token change subscription을 추가한다. token 원문은 React state, 로그, URL에 노출하지 않는다.

React Strict Mode에서 effect가 개발 중 두 번 실행될 수 있으므로 client instance와 subscription은 `useRef`에 저장하고, 기존 연결을 먼저 정리한 뒤 새 연결을 만든다.

---

## 6. 데이터 및 서버 계약

### 6.1 WebSocket 및 필수 destination

| 용도 | 주소 | 수신/송신 shape |
| --- | --- | --- |
| 연결 | `/ws-chat` | STOMP over native WebSocket |
| 메시지 발행 | `/pub/chatrooms/{roomId}/messages` | bare request object |
| 방 event 구독 | `/sub/chatrooms/{roomId}` | 새 메시지 bare object 또는 `MESSAGE_READ` envelope |
| 재인증 발행 | `/pub/auth/reauth` | body 없음, 새 Authorization header |
| 재인증 결과 | `/user/queue/auth` | bare object |
| 업무 오류 | `/user/queue/chat-errors` | bare error object |

개발 환경에서 절대 API origin을 사용할 때는 그 origin의 protocol을 `ws` 또는 `wss`로 변환하고 path를 `/ws-chat`으로 고정한다. 배포 환경의 `VITE_API_BASE_URL=/api`처럼 REST base가 상대 path이면 현재 페이지의 protocol과 host를 사용하여 `/ws-chat`에 연결한다. `/api/ws-chat`으로 연결하지 않는다.

권장 라이브러리는 `@stomp/stompjs` 하나다. SockJS를 사용하거나 `sockjs-client`를 추가하지 않는다. `CONNECT` native header에는 `Authorization: Bearer <accessToken>`을 전달한다.

### 6.2 1:1 채팅방 생성 또는 조회

```http
POST /chatrooms/direct
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "opponentId": 31
}
```

성공 응답 `data`:

```json
{
  "chatRoomId": 20,
  "opponentUserId": 31,
  "nickname": "coffee_moon",
  "profileImageUrl": "https://example.com/profiles/31.png",
  "created": true
}
```

- 신규 생성은 `201`, `message: "chat_room_created"`, `created: true`다.
- 기존 방 조회는 `200`, `message: "chat_room_read_success"`, `created: false`다.
- `chatService`는 현재 `httpClient`의 `includeResponseMeta`를 사용하여 status와 payload를 함께 검증한다.
- 모달 헤더는 게시글에서 받은 사용자 정보보다 direct-room 응답의 `nickname`, `profileImageUrl`을 우선 사용한다.
- `profileImageUrl`은 nullable이며 없으면 기존 `Avatar` fallback을 사용한다.
- 자기 자신을 지정한 `400`, 사용자 없음 `404`는 room resolve 오류로 처리하고 socket을 만들지 않는다.

### 6.3 텍스트 메시지 발행

publish payload:

```json
{
  "clientMessageId": "52b72a7d-7997-4e11-97b3-87af8057014c",
  "content": "안녕하세요"
}
```

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `clientMessageId` | `string` | 예 | 클라이언트가 생성한 UUID v4, 동일 사용자 내 중복 불가 |
| `content` | `string` | 예 | 공백만 허용하지 않음, 최대 1,000자 |

전송할 때 optimistic message를 즉시 추가한다. optimistic 항목은 `clientMessageId`, 현재 사용자 `userId`, 입력 content, 클라이언트 표시 시각, `status: "sending"`을 내부 UI state로 가진다. wire payload에 내부 status나 임의 field를 추가하지 않는다.

### 6.4 실시간 메시지 수신 및 병합

메시지 발행 성공 시 별도 ACK는 없으며 같은 room topic으로 다음 bare object가 발신자와 상대방에게 broadcast된다.

```json
{
  "chatMessageId": 501,
  "clientMessageId": "52b72a7d-7997-4e11-97b3-87af8057014c",
  "userId": 31,
  "content": "안녕하세요",
  "chatType": "TEXT",
  "createdAt": "2026-08-04T14:30:00.123456",
  "updatedAt": null,
  "deletedAt": null
}
```

- `userId === currentUser.userId`이면 내 메시지로 표시한다.
- 같은 `clientMessageId`의 optimistic 항목이 있으면 `chatMessageId`, 서버 `createdAt` 등 확정 데이터로 교체하고 `status: "sent"`로 전환한다.
- 이미 확정한 `clientMessageId` 또는 `chatMessageId` event를 다시 받으면 버린다.
- 다른 사용자가 보낸 event는 새 항목으로 추가한다.
- 현재 송신 API는 `TEXT`만 생성하지만 수신 validator는 `TEXT`, `IMAGE`, `VIDEO` enum을 검증한다. MVP UI가 지원하지 않는 type은 안전한 대체 문구로 표시한다.
- 날짜는 timezone이 없는 서버 `LocalDateTime`이다. UTC로 간주하거나 문자열에 `Z`를 덧붙이지 않는다.

REST history와 실시간 event는 field 이름이 다르다. REST는 `messageId`, `senderId`를 사용하고 실시간 event는 `chatMessageId`, `userId`를 사용하므로 수신 경계에서 각각 검증한 뒤 호출부가 출처를 명시적으로 다룬다.

### 6.5 이전 메시지 조회

```http
GET /chatrooms/{roomId}/messages?lastMessageId={cursor}&pageSize={size}
Authorization: Bearer <accessToken>
```

- 첫 요청은 `lastMessageId`를 생략한다.
- `pageSize` 기본값은 `10`, 허용 범위는 `1~50`이다. 대화 UI의 첫 요청은 `30`을 사용한다.
- `data`는 오래된 메시지에서 최신 메시지 순서의 배열이다.
- 다음 과거 페이지 cursor는 현재 배열 첫 원소의 `messageId`다.
- 응답 길이가 `pageSize`보다 작으면 마지막 페이지다.
- room 구독을 먼저 등록한 뒤 history를 조회하여 조회 중 도착한 실시간 메시지를 놓치지 않는다.
- history는 `messageId`와 `clientMessageId`, 실시간 event는 `chatMessageId`와 `clientMessageId`로 중복을 제거한다.
- `deletedAt`이 non-null인 history 항목은 `content: null` tombstone이다. 원문 대신 `삭제된 메시지입니다.`를 표시한다.

history를 모달에도 표시할지는 [12. 구현 전 확정 사항](#12-구현-전-확정-사항)의 선택에 따른다. `/chats/:roomId` 대화 페이지에서는 항상 history를 조회한다.

### 6.6 STOMP 오류

연결이 성립된 뒤 validation, 인증, 인가, 업무 오류는 `/user/queue/chat-errors`에서 다음 bare object로 받는다.

```json
{
  "code": "ROOM_NOT_FOUND",
  "message": "채팅방을 찾을 수 없습니다.",
  "roomId": 20
}
```

- 분기는 사용자 문구인 `message`가 아니라 안정적인 `code`로 한다.
- 현재 room과 다른 `roomId`의 오류를 대화 오류로 잘못 표시하지 않는다.
- `INVALID_PAYLOAD`, `MESSAGE_CONTENT_REQUIRED`, `MESSAGE_CONTENT_TOO_LONG`, `INVALID_CLIENT_MESSAGE_ID`는 연결을 유지하고 room 단위 전송 오류로 표시한다. 오류에는 `clientMessageId`가 없으므로 특정 optimistic message와 임의로 연결하지 않는다.
- `CHAT_ROOM_ACCESS_DENIED`, `ROOM_NOT_FOUND`는 현재 room 사용을 중단하고 닫기 동작을 제공한다.
- `WEBSOCKET_AUTH_REQUIRED`, `INVALID_ACCESS_TOKEN`, `ACCESS_TOKEN_EXPIRED`는 token refresh 및 재인증 흐름으로 보낸다.
- `INTERNAL_SERVER_ERROR`는 연결을 유지하되 전송 실패를 알리고 재시도를 제공한다.
- STOMP `CONNECT` 자체가 실패한 경우에만 `ERROR` frame과 연결 종료를 연결 실패로 처리한다.

### 6.7 입력 제한

- `content.trim()`이 빈 문자열이면 클라이언트에서 전송하지 않는다.
- 최대 길이 검사는 서버와 동일하게 1,000자를 기준으로 한다.
- 앞뒤 공백을 제거한 값을 보낼지, 원문을 보낼지는 UI 정책으로 분리하되 길이 검사와 실제 송신 값이 달라지지 않게 한다. 이번 MVP는 `trim()`한 값을 송신한다.
- 메시지는 React text node로 렌더링하고 HTML로 해석하지 않는다.

---

## 7. 프런트엔드 구조

현재 `app → pages/layouts → features → shared` 의존 규칙을 유지한다.

```text
src/
├── app/
│   └── providers.jsx                       # ChatProvider 조립
├── features/
│   └── chat/
│       ├── ChatProvider.jsx                # session/unread provider 조립
│       ├── ChatSessionContext.jsx          # openChat/openRoom/closeChat 진입점
│       ├── ChatUnreadContext.jsx           # 전체 unread REST polling
│       ├── chatService.js                  # direct room/history REST API와 DTO 검증
│       ├── chatSocket.js                   # STOMP client 생성/연결/구독/발행/재인증
│       ├── chatContracts.js                # REST와 STOMP wire shape JSDoc/validator
│       ├── useChatSession.js               # 상태 전이와 cleanup
│       ├── chat.css
│       └── components/
│           ├── ChatModalHost.jsx
│           ├── ChatModal.jsx
│           ├── ChatModalHeader.jsx
│           ├── ChatConversation.jsx
│           ├── MessageList.jsx
│           ├── MessageBubble.jsx
│           └── MessageComposer.jsx
└── shared/
    └── session/tokenStore.js               # 기존 getAccessToken 재사용
```

`ChatProvider`를 `AuthProvider` 안쪽, `RouterProvider` 바깥쪽에 둔다. 게시글에서는 `useOptionalChatSession().openChat(author)`, 채팅방에서는 `useChatSessionContext().openRoom(roomId)`를 사용한다. 대화가 열려 있을 때만 session이 STOMP client를 소유하고, 전역 unread는 분리된 context의 REST polling으로 관리한다.

```jsx
<AuthProvider>
  <ChatProvider>
    <RouterProvider router={router} />
  </ChatProvider>
</AuthProvider>
```

author 입력 모델:

```js
{
  userId,
  nickname,
  profileImageUrl
}
```

서비스와 socket 모듈은 React에 의존하지 않는다. `useChatSession`이 연결 lifecycle, history와 실시간 event 병합, optimistic status와 UI state를 관리하고 components는 표시와 사용자 event 전달만 담당한다.

`chatService`는 서버 envelope에서 `data`를 꺼낼 수 있지만 응답 field 이름을 임의로 바꾸지 않는다. `chatContracts`는 TypeScript `type` 또는 `interface` 대신 JSDoc와 runtime validator를 사용한다.

---

## 8. 오류 처리

| 상황 | 처리 |
| --- | --- |
| 모달 open 시 access token 없음 | 연결하지 않고 로그인 화면으로 이동 |
| room 조회/생성 401 | 기존 HTTP client의 refresh 1회 정책 적용; 최종 실패 시 로그인 처리 |
| room 조회/생성 기타 실패 | `채팅방을 열지 못했습니다.` 표시 후 닫기 제공 |
| WebSocket/STOMP 연결 실패 | `채팅 연결이 끊겼습니다.` 표시, 입력 비활성화 |
| 연결 후 비정상 종료 | `채팅 연결이 끊겼습니다.` 표시, 입력 비활성화 |
| 발행 시 연결 없음 | optimistic message를 실패 처리하고 연결 오류 표시 |
| 메시지 validation 오류 | 연결 유지, room 단위 오류 표시; correlation 정보가 없으므로 특정 optimistic message와 임의 연결하지 않음 |
| room 접근 거부 또는 없음 | 대화 중단, 안내 문구와 닫기 제공 |
| token 만료 | HTTP refresh 후 `/pub/auth/reauth`; 최종 실패 시 로그인 처리 |
| 잘못된 수신 JSON/필수 field 누락 | contract error로 구독 계층에서 전파하고 개발 환경 기록 |
| 상대 프로필 이미지 로드 실패 | 기존 `Avatar` 기본 이미지 사용 |

연결 오류 메시지는 모달 안에 유지한다. 이번 범위에서는 자동 reconnect를 제공하지 않는다. 서버 event로 확정되지 않은 optimistic message는 timeout 후 실패 상태로 전환하고 사용자가 새 `clientMessageId`로 재전송할 수 있게 한다. STOMP 오류 객체를 성공 데이터나 일반 메시지로 변환하지 않는다.

---

## 9. 보안 및 안정성

- access token은 기존 정책대로 메모리에서만 읽고 local/session storage에 저장하지 않는다.
- token을 WebSocket URL query parameter 또는 로그에 남기지 않는다.
- 백엔드는 STOMP 연결 인증뿐 아니라 구독 room과 발행 room의 참여자 권한을 각각 검증한다.
- 메시지는 React text node로 렌더링하고 `dangerouslySetInnerHTML`을 사용하지 않는다.
- `chatRoomId`, `messageId`, `chatMessageId`, `clientMessageId`, `userId`, `senderId` 등 출처별 필수 field를 수신 경계에서 검증한다.
- 한 번에 하나의 채팅 모달과 하나의 WebSocket connection만 허용한다.
- 다른 작성자를 누르면 기존 room subscription과 session state를 정리한 뒤 새 room을 연다. 공유 client를 선택한 경우 연결 자체는 재사용한다.
- 빠른 연속 open/close의 비동기 응답이 닫힌 모달을 다시 열지 않도록 session id 또는 `AbortController`를 사용한다.

---

## 10. 테스트 계획

### 단위 및 컴포넌트 테스트

- 목록 작성자 클릭은 채팅을 열고 게시글 상세로 이동하지 않는다.
- 상세 작성자 클릭은 올바른 `userId`, `nickname`, `profileImageUrl`을 전달한다.
- 본인 작성자 영역에는 DM 버튼이 없다.
- token이 없으면 socket client를 만들지 않는다.
- 연결 성공 후 정확한 room destination을 한 번 구독한다.
- 연결 성공 후 auth와 error user destination을 각각 한 번 구독한다.
- Enter 또는 전송 버튼으로 UUID v4 `clientMessageId`와 trim된 텍스트를 정확한 발행 destination에 보낸다.
- 빈 문자열은 발행하지 않는다.
- 전송 직후 optimistic message를 표시하고 같은 `clientMessageId`의 event로 확정한다.
- 중복 `clientMessageId` 또는 `chatMessageId` event를 한 번만 표시한다.
- 실시간 event의 `userId === currentUser.userId`이면 내 메시지 style, 아니면 상대 style을 적용한다.
- REST history의 `senderId === currentUser.userId`이면 내 메시지 style을 적용한다.
- room 구독 뒤 history를 조회하고 중간에 수신한 event를 누락 없이 병합한다.
- 삭제된 history message는 원문 대신 삭제 안내를 표시한다.
- `MESSAGE_READ` envelope를 새 메시지로 렌더링하지 않는다.
- `/user/queue/chat-errors` 오류를 code와 roomId에 따라 분기한다.
- token 갱신 후 reauth를 보내고 `REAUTHENTICATED` 응답 뒤 발행을 재개한다.
- 연결 실패/비정상 종료 시 `채팅 연결이 끊겼습니다.`를 표시한다.
- 닫기와 unmount에서 room `unsubscribe`를 호출하고, 대화 전용 client를 선택한 경우에만 `deactivate`를 호출한다.
- backdrop click은 모달을 닫지 않고 배경 click handler도 실행하지 않는다.
- `Escape`, focus trap, focus 복원이 동작한다.

STOMP client는 실제 네트워크 대신 adapter를 mock하여 destination, header, cleanup 호출을 검증한다.

### E2E

- 서로 다른 두 사용자로 같은 room을 열고 양방향 텍스트 송수신
- 모달 open 동안 배경 링크/버튼 클릭 및 body scroll 차단
- 모달을 닫은 뒤 room subscription이 제거되고, 대화 전용 client를 선택한 경우 서버 connection도 종료되는지 확인
- access token이 만료되었거나 유효하지 않을 때 채팅이 열리지 않는지 확인
- 연결 중 access token 갱신 후 대화와 구독을 유지한 채 재인증되는지 확인
- 같은 `clientMessageId`를 재전송해도 메시지가 중복 표시되지 않는지 확인
- 서버 중단 시 지정된 연결 오류 문구가 표시되는지 확인

---

## 11. 구현 순서

1. `@stomp/stompjs`를 설치하고 `chatSocket.js` adapter를 작성한다.
2. `chat-api-spec.md`에 맞는 direct room/history service와 REST/STOMP validator를 작성한다.
3. `clientMessageId` 생성, optimistic 병합, 중복 제거를 구현한다.
4. auth/error/room 구독과 access token 재인증 흐름을 구현한다.
5. `ChatProvider`, `useChatSession`, 멱등 cleanup을 구현한다.
6. 접근 가능한 `ChatModal`, history timeline과 text composer를 구현한다.
7. `PostCard`의 중첩 link를 피하도록 영역을 나누고 목록/상세 author trigger를 연결한다.
8. 단위, 컴포넌트, E2E 테스트를 추가한다.
9. `npm run lint`, `npm test -- --run`, `npm run build`로 검증한다.

---

## 12. 구현 전 확정 사항

API endpoint, 인증, DTO, echo, 제한값은 `chat-api-spec.md`에서 모두 확정되어 있다. 아래 항목은 API 계약이 아닌 제품 범위와 프런트 수명 주기 결정이다.

### Q1. 게시글 작성자에서 여는 DM 모달의 이전 메시지 표시 범위

- **A. 모달에서도 이전 메시지를 조회한다. — 권장**
  - `/chats/:roomId`와 같은 `ChatConversation` 및 pagination 동작을 재사용한다.
  - 기존 direct room을 다시 열었을 때 과거 맥락이 보이고 두 진입점의 사용자 경험이 일관된다.
- **B. 모달은 연 이후의 메시지만 표시한다.**
  - 초기 구현 범위는 작지만 기존 대화를 열어도 빈 화면으로 시작하며 page shell과 동작이 달라진다.

선택: **Q1-A**. 모달과 `/chats/:roomId`가 같은 session history와 `ChatConversation`을 사용한다.

### Q2. STOMP client 수명 주기

- **A. 로그인 동안 ChatProvider가 하나의 client를 유지한다. — 권장**
  - 전역 `/user/queue/chat-updates`, auth, error 구독을 유지하고 모달은 room subscription만 추가·제거한다.
  - 헤더 unread 실시간 갱신과 대화 기능이 하나의 인증 session 및 재인증 흐름을 공유한다.
- **B. 모달과 대화 페이지가 열릴 때만 client를 연결한다.**
  - 대화가 닫히면 `deactivate()`하며, 헤더 unread는 REST polling에 의존한다.
  - 연결 횟수는 늘지만 전역 socket lifecycle 구현 범위는 작다.

선택: **Q2-B**. 모달과 대화 페이지가 열려 있을 때만 STOMP client를 연결하고 전역 unread는 REST polling으로 동기화한다.
