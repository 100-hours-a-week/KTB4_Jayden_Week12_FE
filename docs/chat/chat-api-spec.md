# 채팅 도메인 API SPEC

> 문서 상태: 최종 확정
> 최종 코드 대조일: 2026-08-04
> 계약 확정일: 2026-08-04
> 대상 서버: Spring REST API 현재 저장소
> 대상 클라이언트: React 마이그레이션 프런트엔드

## 0. 문서 역할

이 문서는 React 마이그레이션에서 사용하는 채팅 도메인 API 계약의 단일 기준이다. AI와 개발자는 endpoint, method, 인증 여부, payload, 응답 필드를 이 문서에서 확인한다.

### 상태 표시

| 상태 | 의미 |
|---|---|
| **현재 코드 확인** | 레거시 프런트엔드에서 실제 호출 또는 사용 중임을 확인한 내용 |
| **서버 확인** | 현재 백엔드 코드 또는 사용자와의 합의로 확인된 내용 |
| **확정 필요** | 현재 코드만으로 프런트 계약을 안전하게 확정할 수 없는 내용 |

현재 저장소에는 레거시 프런트엔드가 없으므로 이 문서에는 **현재 코드 확인** 항목이 없다. 추후 레거시 소스가 제공되면 실제 사용 여부를 대조해 갱신한다.

### AI 규칙

- **확정 필요** 필드를 임의 이름이나 임의 동작으로 구현하지 않는다.
- 실제 응답이 문서와 다르면 mapper에서 차이를 숨기지 말고 이 문서를 먼저 갱신한다.
- REST API 실패는 `Error` 객체를 반환값으로 돌려주지 않고 반드시 `throw`한다.
- STOMP 오류 이벤트도 성공 데이터로 변환하지 않는다. 구독 계층에서 오류로 전파한다.
- 보호 API의 인증 및 재시도 동작은 별도 단일 기준 문서인 `../migration/tasks/auth-migration.md`를 따른다. 해당 문서는 React 인증 구현 전에 작성되어야 하며, 채팅 API 문서에 별도 재시도 정책을 중복 정의하지 않는다.
- TypeScript `type` 또는 `interface`를 만들지 않는다. 필요한 타입 정보는 JSDoc 또는 이 문서의 필드 표를 사용한다.
- 이 문서에 `nullable`로 표시되지 않은 응답 필드를 임의로 optional 처리하지 않는다.

## 1. 공통 계약

### 1.1 전송 방식과 기준 URL

| 항목 | 값 | 상태 |
|---|---|---|
| REST base URL | 환경별 API origin. 서버 코드에 공통 path prefix는 없음 | **서버 확인** |
| WebSocket handshake | `ws(s)://{host}/ws-chat` | **서버 확인** |
| WebSocket protocol | STOMP over native WebSocket, SockJS 미사용 | **서버 확인** |
| STOMP publish prefix | `/pub` | **서버 확인** |
| STOMP broker prefixes | `/sub`, `/queue` | **서버 확인** |
| STOMP user prefix | `/user` | **서버 확인** |

개발 환경에서 서버가 명시적으로 허용하는 WebSocket origin은 `http://localhost:8080`, `http://localhost:5173`이다. REST CORS는 `http://127.0.0.1:5500`, `http://localhost:5500`, `http://localhost:5173`을 허용한다.

배포 환경에서는 React 앱과 API/WebSocket gateway를 **동일 origin reverse proxy**로 제공한다. 브라우저는 REST에 상대 URL을 사용하고 WebSocket은 현재 페이지와 같은 host의 `/ws-chat`에 연결한다. 백엔드의 내부 host/port를 브라우저에 노출하지 않는다. **서버 확인**

### 1.2 인증

모든 채팅 REST endpoint는 보호 API다.

```http
Authorization: Bearer {accessToken}
```

- 토큰 누락·만료·검증 실패 시 REST는 `401`을 반환한다.
- STOMP `CONNECT` frame의 native header에도 같은 `Authorization` 값을 넣는다.
- STOMP 연결 후 토큰이 만료되면 `SEND`와 `SUBSCRIBE`가 거부된다. 새 access token을 받은 뒤 [4.3 재인증](#43-access-token-재인증)을 수행해야 한다.
- 다른 사용자의 토큰으로 기존 STOMP session을 재인증할 수 없다.

### 1.3 REST 성공/실패 envelope

REST 성공 응답의 공통 형태:

```json
{
  "message": "업무별_성공_메시지",
  "data": {}
}
```

REST 실패 응답의 일반 형태:

```json
{
  "message": "오류 코드 또는 오류 메시지",
  "data": null
}
```

인증 실패도 같은 두 필드를 사용하며 `message`는 `UNAUTHORIZED`다. 접근 거부 처리기의 `message`는 `ACCESS_NOT_VALID`이지만, 서비스에서 발생한 `403`은 구체적인 예외 메시지를 반환할 수 있다.

### 1.4 값 표현

| 종류 | JSON 표현 | 비고 | 상태 |
|---|---|---|---|
| ID, count | `number` | Java `Long`. 현재 서버 직렬화 기준 | **서버 확인** |
| REST/STOMP 도메인 시각 | ISO-8601 문자열 | `LocalDateTime`; 예: `2026-08-04T14:30:00.123456`, timezone/offset 없음 | **서버 확인** |
| 인증 만료 시각 | ISO-8601 UTC 문자열 | `Instant`; 예: `2026-08-04T05:33:00Z` | **서버 확인** |
| `ChatType` | `TEXT`, `IMAGE`, `VIDEO` | 현재 송신 API는 `TEXT`만 생성 | **서버 확인** |

프런트는 서버의 `Long`을 JSON `number`로 받는다. 서버는 모든 외부 노출 ID가 JavaScript 안전 정수 범위인 `1` 이상 `Number.MAX_SAFE_INTEGER` 이하임을 보장한다. 범위를 벗어난 ID를 응답하거나 문자열로 임의 변환하지 않는다. **서버 확인**

## 2. Endpoint 요약

### 2.1 REST

| Method | Endpoint | 용도 | 인증 | 성공 status | 상태 |
|---|---|---|---|---|---|
| `POST` | `/chatrooms/direct` | 1:1 채팅방 생성 또는 기존 방 조회 | 필요 | `201` 생성 / `200` 조회 | **서버 확인** |
| `GET` | `/chatrooms/{roomId}` | 채팅방 상단 정보 조회 | 필요 | `200` | **서버 확인** |
| `GET` | `/chatrooms` | 채팅방 목록 커서 조회 | 필요 | `200` | **서버 확인** |
| `GET` | `/chatrooms/{roomId}/messages` | 이전 메시지 커서 조회 | 필요 | `200` | **서버 확인** |
| `GET` | `/chatrooms/unread-count` | 전체 읽지 않은 메시지 수 조회 | 필요 | `200` | **서버 확인** |
| `DELETE` | `/chatrooms/{roomId}/users/me` | 현재 사용자 채팅방 퇴장 | 필요 | `200` | **서버 확인** |

### 2.2 STOMP

| 동작 | Destination | payload/수신 데이터 | 인증 | 상태 |
|---|---|---|---|---|
| publish | `/pub/chatrooms/{roomId}/messages` | `{ "clientMessageId": string, "content": string }` | 필요 | **서버 확인** |
| publish | `/pub/chatrooms/{roomId}/read` | `{ "lastReadMessageId": number }` | 필요 | **서버 확인** |
| publish | `/pub/auth/reauth` | body 없음, 새 Authorization header | 필요 | **서버 확인** |
| subscribe | `/sub/chatrooms/{roomId}` | 새 메시지 또는 읽음 이벤트 | 필요, 참여자 검사 | **서버 확인** |
| subscribe | `/user/queue/chat-updates` | 사용자별 채팅방 목록 갱신 | 필요 | **서버 확인** |
| subscribe | `/user/queue/auth` | 재인증 결과 | 필요 | **서버 확인** |
| subscribe | `/user/queue/chat-errors` | 사용자별 STOMP 오류 | 필요 | **서버 확인** |

## 3. REST 상세

### 3.1 1:1 채팅방 생성 또는 조회

`POST /chatrooms/direct`

요청 body:

| 필드 | 타입 | 필수 | 제약 | 상태 |
|---|---|---|---|---|
| `opponentId` | `number` | 예 | 양의 정수 | **서버 확인** |

```json
{
  "opponentId": 42
}
```

응답 `data`:

| 필드 | 타입 | nullable | 설명 | 상태 |
|---|---|---|---|---|
| `chatRoomId` | `number` | 아니요 | 채팅방 ID | **서버 확인** |
| `opponentUserId` | `number` | 아니요 | 상대 사용자 ID | **서버 확인** |
| `nickname` | `string` | 아니요 | 상대 닉네임 | **서버 확인** |
| `profileImageUrl` | `string` | 예 | 상대 프로필 이미지의 절대 URL | **서버 확인** |
| `created` | `boolean` | 아니요 | 이번 요청에서 생성됐는지 여부 | **서버 확인** |

신규 생성 응답은 `201`, `message: "chat_room_created"`, `created: true`다. 기존 방 조회 응답은 `200`, `message: "chat_room_read_success"`, `created: false`다. 같은 두 사용자의 반복 요청은 기존 direct room을 반환한다.

주요 실패:

- `400`: 자기 자신을 `opponentId`로 지정함, body/validation 오류
- `404 USER_NOT_FOUND`: 요청 사용자 없음
- `404 OPPONENT_USER_NOT_FOUND`: 상대 사용자 없음

### 3.2 채팅방 정보 조회

`GET /chatrooms/{roomId}`

응답: `200`, `message: "chat_room_info_read_success"`

| `data` 필드 | 타입 | nullable | 설명 | 상태 |
|---|---|---|---|---|
| `chatRoomId` | `number` | 아니요 | 채팅방 ID | **서버 확인** |
| `opponentUserId` | `number` | 아니요 | 상대 사용자 ID | **서버 확인** |
| `nickname` | `string` | 아니요 | 상대 닉네임 | **서버 확인** |
| `profileImageUrl` | `string` | 예 | 상대 프로필 이미지 절대 URL | **서버 확인** |
| `lastMessageId` | `number` | 예 | 마지막 메시지 ID. 메시지가 없으면 `null` | **서버 확인** |
| `createdAt` | `string` | 예 | 마지막 메시지 생성 시각. 메시지가 없으면 `null` | **서버 확인** |

`createdAt`은 채팅방 생성 시각이 아니라 **마지막 메시지 생성 시각**이다.

주요 실패: 참여자가 아니면 `403`, 방/상대 사용자를 찾지 못하면 `404`.

### 3.3 채팅방 목록 조회

`GET /chatrooms?createdAtCursor={createdAt}&lastMessageIdCursor={messageId}&pageSize={size}`

query:

| 필드 | 타입 | 필수 | 설명 | 상태 |
|---|---|---|---|---|
| `createdAtCursor` | ISO-8601 `LocalDateTime` 문자열 | 아니요 | 마지막으로 받은 방의 `createdAt`. 첫 요청에서는 생략 | **서버 확인** |
| `lastMessageIdCursor` | `number` | 아니요 | 마지막으로 받은 방의 양의 `lastMessageId`. 첫 요청에서는 생략 | **서버 확인** |
| `pageSize` | integer | 아니요 | 기본값 `10`, 최솟값 `1`, 최댓값 `50` | **서버 확인** |

응답: `200`, `message: "chat_room_list_read_success"`, `data`는 배열이다.

| 배열 원소 필드 | 타입 | nullable | 설명 | 상태 |
|---|---|---|---|---|
| `chatRoomId` | `number` | 아니요 | 채팅방 ID | **서버 확인** |
| `opponentUserId` | `number` | 아니요 | 상대 사용자 ID | **서버 확인** |
| `nickname` | `string` | 아니요 | 상대 닉네임 | **서버 확인** |
| `profileImageUrl` | `string` | 예 | 상대 프로필 이미지 절대 URL | **서버 확인** |
| `lastMessageId` | `number` | 아니요 | 마지막 메시지 ID | **서버 확인** |
| `content` | `string` | 예 | 마지막 메시지 본문. 마지막 메시지가 삭제됐으면 `null` | **서버 확인** |
| `createdAt` | `string` | 아니요 | 마지막 메시지 생성 시각 | **서버 확인** |
| `unreadCount` | `number` | 아니요 | 해당 방에서 상대가 보낸 읽지 않은 메시지 수 | **서버 확인** |

정렬은 `(createdAt DESC, lastMessageId DESC)`다. 두 cursor는 한 쌍이며 하나만 전달하면 `400 INVALID_CURSOR`다. 다음 페이지는 아래 조건을 만족하는 항목을 조회한다.

```text
createdAt < createdAtCursor
OR (createdAt = createdAtCursor AND lastMessageId < lastMessageIdCursor)
```

응답 배열 길이가 `pageSize`보다 작으면 마지막 페이지로 판단한다. 별도의 `hasNext`는 없다. **메시지가 한 건도 없는 방은 목록에 포함하지 않는다.** 방 생성 응답으로 직접 진입할 수 있으며, 첫 메시지가 저장된 뒤 목록 pagination 대상이 된다. **서버 확인**

### 3.4 채팅 메시지 목록 조회

`GET /chatrooms/{roomId}/messages?lastMessageId={cursor}&pageSize={size}`

query:

| 필드 | 타입 | 필수 | 설명 | 상태 |
|---|---|---|---|---|
| `lastMessageId` | `number` | 아니요 | 이 ID보다 작은 메시지를 조회. 첫 요청에서는 생략 | **서버 확인** |
| `pageSize` | integer | 아니요 | 기본값 `10`, 최솟값 `1`, 최댓값 `50` | **서버 확인** |

응답: `200`, `message: "messages_read_success"`, `data`는 **오래된 메시지 → 최신 메시지의 오름차순 배열**이다. 다음 과거 페이지 cursor로 현재 배열 첫 원소의 `messageId`를 사용한다. 응답 길이가 `pageSize`보다 작으면 마지막 페이지다.

| 배열 원소 필드 | 타입 | nullable | 설명 | 상태 |
|---|---|---|---|---|
| `messageId` | `number` | 아니요 | 메시지 ID | **서버 확인** |
| `clientMessageId` | `string` | 아니요 | 송신 클라이언트가 생성한 UUID. 기존 데이터도 migration으로 채움 | **서버 확인** |
| `senderId` | `number` | 아니요 | 발신 사용자 ID | **서버 확인** |
| `content` | `string` | 예 | 메시지 본문. `deletedAt`이 non-null이면 반드시 `null` | **서버 확인** |
| `chatType` | enum string | 아니요 | `TEXT`, `IMAGE`, `VIDEO` | **서버 확인** |
| `createdAt` | `string` | 아니요 | 생성 시각 | **서버 확인** |
| `updatedAt` | `string` | 예 | 수정 시각 | **서버 확인** |
| `deletedAt` | `string` | 예 | 삭제 시각 | **서버 확인** |

참여 중인 멤버가 아니거나 퇴장한 멤버면 `403 CHAT_ROOM_ACCESS_DENIED`. 조회만으로 읽음 상태가 바뀌지는 않으며, 읽음 처리는 STOMP publish가 별도로 필요하다.

삭제 메시지는 배열에서 제외하지 않는다. `messageId`, `senderId`, `chatType`, `createdAt`, `deletedAt`을 유지하고 `content: null`인 tombstone으로 반환한다. 프런트는 원문 대신 삭제 안내 UI를 표시한다. **서버 확인**

### 3.5 전체 안 읽은 메시지 수 조회

`GET /chatrooms/unread-count`

응답 예:

```json
{
  "message": "unread_count_load_success",
  "data": 7
}
```

`data`는 상대가 보낸 메시지 중 현재 사용자가 아직 읽지 않은 메시지의 전체 개수다. 삭제된 메시지와 퇴장한 방의 메시지는 제외된다. **서버 확인**

### 3.6 채팅방 퇴장

`DELETE /chatrooms/{roomId}/users/me`

응답 예:

```json
{
  "message": "chat_room_delete_success",
  "data": 12
}
```

`data`는 퇴장한 `roomId`다. 실제 채팅방/메시지를 삭제하지 않고 현재 멤버의 `leftAt`을 기록한다. 이미 퇴장한 방에 같은 사용자가 DELETE를 반복해도 동일한 `200` 응답과 `roomId`를 반환하는 멱등 API다. **서버 확인**

퇴장 성공 뒤 해당 사용자의 방 정보/메시지 조회, 메시지 송신 및 방 topic 구독은 `403 CHAT_ROOM_ACCESS_DENIED`로 거부한다. 프런트는 성공 즉시 방 topic 구독을 해제하고 채팅방 목록 cache에서 제거한다.

같은 direct room을 다시 시작하면 요청자 본인의 membership을 명시적으로 재활성화하고 `joinedAt`을 갱신하며 `leftAt`과 `lastReadMessage`를 초기화한다.

## 4. STOMP 상세

### 4.1 연결과 필수 구독

STOMP `CONNECT` native header:

```text
Authorization: Bearer {accessToken}
```

연결 후 필요한 범위만 구독한다.

- 채팅방 화면: `/sub/chatrooms/{roomId}`
- 전역 채팅방 목록/배지: `/user/queue/chat-updates`
- 재인증 응답: `/user/queue/auth`
- 오류: `/user/queue/chat-errors`

`/sub/chatrooms/{roomId}`를 구독할 때 서버가 현재 사용자의 활성 membership을 검사한다. 멤버가 아니거나 `leftAt != null`이면 구독을 `CHAT_ROOM_ACCESS_DENIED`로 거부한다.

### 4.2 텍스트 메시지 송수신

publish destination: `/pub/chatrooms/{roomId}/messages`

payload:

| 필드 | 타입 | 필수 | 제약 | 상태 |
|---|---|---|---|---|
| `clientMessageId` | `string` | 예 | 클라이언트가 생성한 UUID v4, 동일 사용자 내 중복 불가 | **서버 확인** |
| `content` | `string` | 예 | 공백만 허용하지 않음, 최대 1,000자 | **서버 확인** |

```json
{
  "clientMessageId": "52b72a7d-7997-4e11-97b3-87af8057014c",
  "content": "안녕하세요"
}
```

성공 시 별도 request-response ACK는 없다. 같은 방 topic `/sub/chatrooms/{roomId}`에 아래 **bare object**가 broadcast된다.

| 필드 | 타입 | nullable | 설명 | 상태 |
|---|---|---|---|---|
| `chatMessageId` | `number` | 아니요 | 새 메시지 ID | **서버 확인** |
| `clientMessageId` | `string` | 아니요 | 요청에서 받은 UUID. optimistic message 병합 키 | **서버 확인** |
| `userId` | `number` | 아니요 | 발신 사용자 ID. REST의 `senderId`와 이름이 다름 | **서버 확인** |
| `content` | `string` | 아니요 | 메시지 본문 | **서버 확인** |
| `chatType` | enum string | 아니요 | 현재 `TEXT` | **서버 확인** |
| `createdAt` | `string` | 아니요 | 생성 시각 | **서버 확인** |
| `updatedAt` | `string` | 예 | 수정 시각 | **서버 확인** |
| `deletedAt` | `string` | 예 | 삭제 시각 | **서버 확인** |

서버는 `(senderId, clientMessageId)`를 idempotency key로 저장한다. 같은 키의 재전송은 새 메시지를 생성하지 않고 최초 저장 메시지와 같은 `chatMessageId`를 가진 event를 반환한다. 프런트는 `clientMessageId`로 optimistic message와 서버 event를 병합하고 중복 event를 제거한다.

같은 메시지 발송 뒤 `/user/queue/chat-updates`에도 사용자별 unread count를 담은 갱신 이벤트가 발행된다.

### 4.3 access token 재인증

먼저 `/user/queue/auth`를 구독한다. access token 갱신 후 아래 frame을 보낸다.

```text
SEND /pub/auth/reauth
Authorization: Bearer {newAccessToken}

```

성공 시 `/user/queue/auth` 수신 데이터는 envelope 없는 bare object다.

| 필드 | 타입 | nullable | 설명 | 상태 |
|---|---|---|---|---|
| `type` | string | 아니요 | 고정값 `REAUTHENTICATED` | **서버 확인** |
| `expiresAt` | ISO-8601 Instant string | 아니요 | 새 access token 만료 시각 | **서버 확인** |

### 4.4 읽음 상태 갱신

publish destination: `/pub/chatrooms/{roomId}/read`

payload:

| 필드 | 타입 | 필수 | 제약 | 상태 |
|---|---|---|---|---|
| `lastReadMessageId` | `number` | 예 | 양의 정수이며 해당 방에 존재하는 메시지 ID | **서버 확인** |

읽음 위치가 이전보다 앞으로 이동한 경우에만 `/sub/chatrooms/{roomId}`로 다음 envelope를 broadcast한다. 같거나 과거 ID면 이벤트를 발행하지 않는다.

```json
{
  "message": "MESSAGE_READ",
  "data": {
    "code": "READ_UPDATED",
    "roomId": 12,
    "readerId": 7,
    "lastReadMessageId": 105
  }
}
```

모든 필드는 non-null이다. `lastReadMessageId`가 다른 방의 메시지면 `MESSAGE_ROOM_MISMATCH`, 존재하지 않으면 `MESSAGE_NOT_FOUND`, 활성 멤버가 아니면 `CHAT_ROOM_ACCESS_DENIED`를 `/user/queue/chat-errors`로 보낸다.

### 4.5 사용자별 채팅방 갱신 이벤트

subscribe destination: `/user/queue/chat-updates`

```json
{
  "message": "chat_room_updated",
  "data": {
    "chatUpdateType": "MESSAGE_RECEIVED",
    "roomId": 12,
    "messageId": 105,
    "senderId": 7,
    "content": "안녕하세요",
    "chatType": "TEXT",
    "clientMessageId": "52b72a7d-7997-4e11-97b3-87af8057014c",
    "createdAt": "2026-08-04T14:30:00.123456",
    "unreadCount": 3
  }
}
```

| `data` 필드 | 타입 | nullable | 설명 | 상태 |
|---|---|---|---|---|
| `chatUpdateType` | enum string | 아니요 | 현재 발행값 `MESSAGE_RECEIVED`; enum에는 `UPSERT`, `DELETE`도 존재 | **서버 확인** |
| `roomId` | `number` | 아니요 | 채팅방 ID | **서버 확인** |
| `messageId` | `number` | 아니요 | 새 메시지 ID | **서버 확인** |
| `clientMessageId` | `string` | 아니요 | 메시지 송신 요청의 UUID | **서버 확인** |
| `senderId` | `number` | 아니요 | 발신 사용자 ID | **서버 확인** |
| `content` | `string` | 아니요 | 메시지 본문 | **서버 확인** |
| `chatType` | enum string | 아니요 | 현재 `TEXT` | **서버 확인** |
| `createdAt` | `string` | 아니요 | 새 메시지 생성 시각 | **서버 확인** |
| `unreadCount` | `number` | 아니요 | 이 이벤트 수신 사용자 기준 해당 방 unread count | **서버 확인** |

### 4.6 STOMP 오류

subscribe destination: `/user/queue/chat-errors`

validation, 인증, 인가, 업무 오류는 모두 아래 envelope 없는 bare object로 전달한다. `code`는 프런트 분기용 고정 영문 코드이고 `message`는 사용자 표시 또는 로깅용 설명이다.

| 필드 | 타입 | nullable | 설명 | 상태 |
|---|---|---|---|---|
| `code` | `string` | 아니요 | 아래 표에 정의된 안정적인 영문 오류 코드 | **서버 확인** |
| `message` | `string` | 아니요 | 사용자 표시 또는 로깅용 설명. 분기 기준으로 사용하지 않음 | **서버 확인** |
| `roomId` | `number` | 예 | 방 단위 요청이면 대상 방 ID, 전역 인증 오류면 `null` | **서버 확인** |

예:

```json
{
  "code": "ROOM_NOT_FOUND",
  "message": "채팅방을 찾을 수 없습니다.",
  "roomId": 12
}
```

오류 코드 계약:

| code | 발생 조건 | `roomId` | 재시도 |
|---|---|---|---|
| `INVALID_PAYLOAD` | JSON 파싱 실패, 필수 필드 누락, 필드 형식 오류 | 방 요청이면 ID | 수정 후 가능 |
| `MESSAGE_CONTENT_REQUIRED` | `content`가 비었거나 공백뿐임 | 대상 방 ID | 수정 후 가능 |
| `MESSAGE_CONTENT_TOO_LONG` | `content`가 1,000자를 초과함 | 대상 방 ID | 수정 후 가능 |
| `INVALID_CLIENT_MESSAGE_ID` | `clientMessageId`가 UUID v4 형식이 아님 | 대상 방 ID | 수정 후 가능 |
| `WEBSOCKET_AUTH_REQUIRED` | STOMP session이 인증되지 않음 | `null` | 재인증/재연결 후 가능 |
| `INVALID_ACCESS_TOKEN` | access token 검증 실패 또는 access token이 아님 | `null` | token 갱신 후 가능 |
| `ACCESS_TOKEN_EXPIRED` | session의 access token이 만료됨 | `null` | token 갱신 및 재인증 후 가능 |
| `REAUTH_USER_MISMATCH` | 다른 사용자의 token으로 재인증 시도 | `null` | 올바른 계정으로 재연결 |
| `CHAT_ROOM_ACCESS_DENIED` | 방 멤버가 아니거나 퇴장한 멤버임 | 대상 방 ID | 권한 회복 전 불가 |
| `ROOM_NOT_FOUND` | 대상 채팅방이 없음 | 요청한 방 ID | 불가 |
| `MESSAGE_NOT_FOUND` | 대상 메시지가 없음 | 대상 방 ID | 불가 |
| `MESSAGE_ROOM_MISMATCH` | 읽음 대상 메시지가 다른 방 소속임 | 대상 방 ID | 수정 후 가능 |
| `INTERNAL_SERVER_ERROR` | 분류되지 않은 서버 오류 | 알 수 있으면 방 ID | 조건부 |

`CONNECT` 자체가 실패해 user destination을 사용할 수 없는 경우에 한해 서버는 STOMP `ERROR` frame을 보내고 연결을 종료할 수 있다. 연결이 성립된 뒤 발생한 오류는 `/user/queue/chat-errors`로 통일하며 오류 때문에 자동으로 연결을 종료하지 않는다.

## 5. 프런트 구현 규칙

1. REST client는 non-2xx 응답에 대해 응답 `message`, HTTP status, endpoint 정보를 보존한 예외를 `throw`한다.
2. REST 성공 함수는 `data`를 반환해도 되지만, 응답 필드명을 임의 변환하지 않는다.
3. `/sub/chatrooms/{roomId}`에는 서로 다른 두 wire shape가 온다.
   - `chatMessageId`가 있는 bare object: 새 메시지
   - `message === "MESSAGE_READ"`인 envelope: 읽음 이벤트
4. REST 과거 메시지와 실시간 메시지의 이름 차이(`messageId`/`senderId` 대 `chatMessageId`/`userId`)는 이 문서가 변경되기 전까지 호출부가 명시적으로 다룬다.
5. optimistic message는 요청 시 생성한 `clientMessageId`로 관리한다. 같은 `clientMessageId`의 서버 event가 오면 임시 항목을 확정 항목으로 교체하고, 이미 확정됐다면 중복 event를 버린다.
6. 퇴장 성공 즉시 방 topic 구독을 해제하고 채팅방 목록 cache에서 제거한다.
7. 날짜 문자열은 timezone이 없는 서버 로컬 시각이다. UTC로 간주해 `Z`를 덧붙이지 않는다.

## 6. 백엔드 반영 체크리스트

이 절은 최종 계약과 2026-08-04 현재 서버 구현 사이의 차이다. 프런트 mapper로 호환 처리하지 않는다. 서버 구현과 테스트를 이 계약에 맞춘 뒤 제공해야 한다.

| ID | 필요한 서버 변경 | 완료 조건 | 상태 |
|---|---|---|---|
| B1 | 신규 direct room에서 조기 `orElseThrow()` 제거 | 신규 `201`, 기존 `200` controller/service 테스트 통과 | **서버 확인** |
| B2 | 방 목록에 `lastMessageIdCursor` 추가 | 같은 `createdAt` 경계에서 누락 없는 pagination 테스트 통과 | **서버 확인** |
| B3 | 활성 membership 검사에 `leftAt is null` 적용 | 퇴장 후 REST, SEND, SUBSCRIBE가 모두 거부됨 | **서버 확인** |
| B4 | 재입장 시 요청자 membership 복구 | 요청자의 `joinedAt`, `leftAt`, `lastReadMessage`가 계약대로 갱신됨 | **서버 확인** |
| B5 | 갱신 DTO `createdA`를 `createdAt`으로 변경 | wire payload에 `createdAt`만 존재 | **서버 확인** |
| B6 | STOMP 오류 handler와 interceptor 오류 전달 통일 | 연결 후 모든 정의 오류가 `/user/queue/chat-errors` shape를 만족 | **서버 확인** |
| B7 | 메시지에 `clientMessageId` 저장 및 unique 제약 추가 | 같은 `(senderId, clientMessageId)` 재전송 시 메시지가 한 건만 존재 | **서버 확인** |
| B8 | 과거 메시지와 두 실시간 event에 `clientMessageId` 추가 | 세 응답 모두 동일 값을 반환 | **서버 확인** |
| B9 | `pageSize` 기본값 및 validation 추가 | 생략 시 10, 1~50 외 값은 `400` | **서버 확인** |
| B10 | unread query에서 퇴장 방과 삭제 메시지 제외 | 목록별 count와 전체 count가 같은 기준 사용 | **서버 확인** |
| B11 | 메시지가 없는 방을 목록 query에서 제외 | 첫 메시지 전에는 미노출, 저장 후 목록에 노출 | **서버 확인** |
| B12 | 삭제 메시지 본문을 tombstone 처리 | `deletedAt != null`이면 `content`가 항상 `null` | **서버 확인** |
| B13 | 중복 방 퇴장을 멱등 처리 | 두 번째 이후 DELETE도 같은 `200`과 `roomId` 반환 | **서버 확인** |
| B14 | 외부 노출 ID의 안전 정수 범위 보장 | 범위 검증/모니터링과 경계 테스트 통과 | **서버 확인** |
| B15 | 배포 경로를 동일 origin reverse proxy로 구성 | REST 상대 경로와 `/ws-chat` upgrade 운영 검증 | **서버 확인** |
| B16 | 인증 계약 문서 작성 | `../migration/tasks/auth-migration.md`가 React 인증 구현 전에 확정됨 | **서버 확인** |

## 7. 최종 확정 계약 요약

다음 계약은 사용자의 최종 결정을 본문에 반영했다.

- 신규 direct room은 `201 / created: true`, 기존 room은 `200 / created: false`
- 채팅방 목록은 `(createdAt, lastMessageId)` 복합 cursor 사용
- 퇴장 멤버는 REST 조회/송신과 STOMP 구독을 `403`으로 거부하고 재입장 시 본인 membership 복구
- 채팅방 갱신 시각 필드는 `createdAt`
- STOMP 오류는 `{ code, message, roomId }`로 통일
- `clientMessageId`로 idempotency와 optimistic message 병합 지원
- `pageSize` 기본값 `10`, 허용 범위 `1~50`
- 메시지가 없는 방은 목록에서 제외하고 첫 메시지 저장 뒤 포함
- 반복 퇴장은 같은 `200`과 `roomId`를 반환하는 멱등 처리
- 삭제 메시지는 `content: null` tombstone으로 timeline 유지
- 모든 외부 ID는 JSON `number`이며 JavaScript 안전 정수 범위를 서버가 보장
- 배포 환경은 동일 origin reverse proxy만 사용
- 인증 갱신/재시도 계약은 `../migration/tasks/auth-migration.md`에서 별도 관리

현재 **확정 필요**로 남은 채팅 도메인 계약은 없다.

## 8. 서버 근거 파일

- REST endpoint: `src/main/java/com/example/spring_rest_api/chat/controller/ChatRoomController.java`
- STOMP endpoint와 방 broadcast: `src/main/java/com/example/spring_rest_api/chat/controller/ChatMessageController.java`
- STOMP 재인증: `src/main/java/com/example/spring_rest_api/chat/controller/StompAuthController.java`
- request/response wire field: `src/main/java/com/example/spring_rest_api/chat/service/request`, `src/main/java/com/example/spring_rest_api/chat/service/response`
- pagination/정렬/unread query: `src/main/java/com/example/spring_rest_api/chat/repository`
- REST 인증: `src/main/java/com/example/spring_rest_api/common/config/SecurityConfig.java`
- STOMP 경로/인증/인가: `src/main/java/com/example/spring_rest_api/common/config/WebSocketConfig.java`, `src/main/java/com/example/spring_rest_api/chat/interceptor`
- REST/STOMP 오류 shape: `src/main/java/com/example/spring_rest_api/common/exception`, `src/main/java/com/example/spring_rest_api/common/response`

문서의 **서버 확인**에는 현재 코드로 확인한 내용과 사용자가 확정한 계약이 모두 포함된다. 둘의 차이는 [6. 백엔드 반영 체크리스트](#6-백엔드-반영-체크리스트)에 명시했다. 현재 저장소에는 채팅 도메인 통합 테스트가 없다.
