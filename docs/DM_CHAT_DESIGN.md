# DM 채팅 화면 설계

## 1. 목적

게시글 목록과 게시글 상세에서 작성자 영역을 누르면 해당 작성자와 1:1 DM을 주고받을 수 있는 채팅 모달을 연다. 이번 구현은 텍스트 실시간 송수신과 연결 수명 주기에 집중한다.

상단 채팅 알림 아이콘, 채팅방 목록, 목록에서 진입하는 대화 페이지와 읽음 상태는 후속 문서인 [`CHAT_LIST_DESIGN.md`](./CHAT_LIST_DESIGN.md)에서 다룬다. 이 문서의 `채팅방 목록 제외`, `이전 메시지 제외`는 게시글 작성자에서 바로 여는 초기 모달만 단독 구현할 때의 범위다.

이 문서의 기준은 다음과 같다.

- 프런트엔드: 현재 React 애플리케이션 구조
- 프로토콜: STOMP over WebSocket
- WebSocket endpoint: `/ws-chat`
- 메시지 발행 destination: `/pub/chatrooms/{roomId}/messages`
- 메시지 구독 destination: `/sub/chatrooms/{roomId}`

`/pub`, `/sub` destination을 사용하는 점을 근거로 STOMP를 전제로 한다. 백엔드가 순수 WebSocket 또는 SockJS를 요구한다면 연결 구현을 시작하기 전에 계약을 변경해야 한다.

---

## 2. MVP 범위

### 포함

- 게시글 목록과 상세의 작성자 클릭으로 채팅 모달 열기
- 상대방의 `nickname`, `profileImageUrl` 표시
- 텍스트 메시지 송수신
- 내 메시지와 상대 메시지의 정렬 및 색상 구분
- 모달 배경 blur, 배경 스크롤 및 클릭 차단
- 모달을 열 때 access token 확인
- 연결, 구독, 발행 오류 표시
- 모달을 닫을 때 구독 해제 및 WebSocket 연결 종료
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
6. `/ws-chat`에 연결한 뒤 `/sub/chatrooms/{roomId}`를 구독한다.
7. 사용자가 텍스트를 입력하고 전송하면 `/pub/chatrooms/{roomId}/messages`로 발행한다.
8. 수신 메시지의 `senderId`와 로그인 사용자의 `userId`를 비교하여 내 메시지와 상대 메시지를 구분한다.
9. 닫기 버튼 또는 `Escape`로 모달을 닫으면 구독을 해제하고 STOMP client를 비활성화한다.

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
| `connection-error` | 연결 또는 구독 실패/끊김 | `채팅 연결이 끊겼습니다.`, 입력 비활성화 |
| `closing` | 구독/연결 정리 중 | 추가 입력 차단 |

### 연결 순서

1. `openChat(targetUser)` 호출
2. access token과 로그인 사용자 확인
3. room 조회/생성
4. STOMP client 생성
5. STOMP `CONNECT` header에 `Authorization: Bearer <accessToken>` 전달
6. 연결 성공 callback에서 room destination 구독
7. 구독 준비 후 `connected`로 전환

브라우저의 기본 WebSocket handshake에는 임의의 `Authorization` header를 직접 넣을 수 없다. 따라서 서버는 STOMP `CONNECT` frame의 `Authorization` header를 인증해야 한다. URL query에 access token을 넣는 방식은 로그 노출 위험 때문에 사용하지 않는다.

### 종료 순서

다음 경우 모두 같은 `closeChat()` cleanup을 실행한다.

- 닫기 버튼
- `Escape`
- 페이지 전환 또는 provider unmount
- 로그아웃 또는 인증 상태가 anonymous로 변경됨

cleanup은 중복 호출해도 안전해야 한다.

1. 새 메시지 전송 차단
2. 활성 subscription의 `unsubscribe()` 호출
3. STOMP client의 `deactivate()` 호출
4. component state와 message 목록 초기화
5. body scroll lock 해제
6. 채팅을 연 trigger로 focus 복원

MVP에서는 자동 재연결을 하지 않는다. 연결 실패, STOMP error, WebSocket close가 발생하면 정확히 `채팅 연결이 끊겼습니다.`를 `role="alert"`로 표시하고 사용자가 모달을 닫도록 한다.

React Strict Mode에서 effect가 개발 중 두 번 실행될 수 있으므로 client instance와 subscription은 `useRef`에 저장하고, 기존 연결을 먼저 정리한 뒤 새 연결을 만든다.

---

## 6. 데이터 및 서버 계약

### 6.1 확정된 WebSocket 계약

| 용도 | 주소 |
| --- | --- |
| 연결 | `/ws-chat` |
| 발행 | `/pub/chatrooms/{roomId}/messages` |
| 구독 | `/sub/chatrooms/{roomId}` |

WebSocket origin은 `VITE_API_BASE_URL`에서 만든다. 예를 들어 `https://api.example.com`이면 `wss://api.example.com/ws-chat`, `http://localhost:8080`이면 `ws://localhost:8080/ws-chat`을 사용한다. origin은 코드에 직접 작성하지 않는다.

권장 라이브러리는 `@stomp/stompjs` 하나다. 백엔드가 SockJS fallback을 요구하지 않는 한 `sockjs-client`는 추가하지 않는다.

### 6.2 메시지 DTO 제안 — 백엔드 확정 필요

최소 발행 payload:

```json
{
  "content": "안녕하세요"
}
```

최소 구독 payload:

```json
{
  "messageId": 501,
  "roomId": 20,
  "senderId": 31,
  "content": "안녕하세요",
  "sentAt": "2026-07-23T10:30:00Z"
}
```

프런트엔드에서 반드시 필요한 필드는 `messageId`, `senderId`, `content`, `sentAt`이다. `senderId`가 없으면 내 메시지/상대 메시지를 안정적으로 구분할 수 없다. 메시지 정렬은 `sentAt` 오름차순으로 하되, 동일 시각이면 수신 순서를 유지한다.

서버가 발행한 메시지를 발신자에게도 구독 destination으로 되돌려 주는 것을 기본 계약으로 한다. 프런트엔드는 전송 직후 임시 메시지를 추가하지 않고 서버 echo 수신 시 목록에 추가하여 중복 표시를 피한다.

nickname과 profile image는 게시글 응답에 이미 있는 상대 사용자 정보와 `AuthContext.user`의 내 사용자 정보를 사용한다. 메시지마다 표시 이름을 서버가 내려줄 필요는 없다. 사용자가 대화 중 프로필을 바꾼 경우 실시간 반영은 MVP 범위에서 제외한다.

### 6.3 채팅방 조회/생성 API 제안 — 백엔드 확정 필요

제공된 주소만으로는 `{roomId}`를 알 수 없으므로, 구현 전에 다음과 같은 HTTP API가 하나 필요하다.

```http
POST /chatrooms/direct
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "targetUserId": 31
}
```

```json
{
  "data": {
    "roomId": 20
  }
}
```

동일한 두 사용자의 요청은 기존 room을 반환해야 하며 동시에 여러 번 요청해도 하나의 room만 생기도록 서버에서 멱등성을 보장한다. 실제 endpoint, method, request/response field는 백엔드와 합의 후 `docs/API_SPEC.md`에 확정 상태로 추가한다.

### 6.4 이전 메시지

메시지 history API가 제공되지 않았으므로 최초 MVP는 **모달을 연 뒤 구독으로 받은 메시지만** 표시한다. 기존 대화까지 보여야 한다면 WebSocket 구현 전에 cursor 기반 history API 계약을 추가해야 한다.

채팅방 목록과 `/chats/:roomId` 페이지까지 구현하는 확장 MVP에서는 history가 필요하며, 구체 계약과 읽음 처리 순서는 [`CHAT_LIST_DESIGN.md`](./CHAT_LIST_DESIGN.md)를 따른다.

권장 형태는 다음과 같으나 현재 확정 계약이 아니다.

```http
GET /chatrooms/{roomId}/messages?pageSize=30&beforeMessageId={messageId}
```

history를 추가할 경우 연결과 구독을 먼저 완료한 뒤 history를 병합해야 조회 도중 도착한 메시지를 놓치지 않는다. `messageId`로 중복을 제거한다.

### 6.5 제한값 — 백엔드 확정 필요

- 메시지 최대 길이: 제안 `1,000`자
- content 앞뒤 공백: 프런트엔드에서 `trim()` 후 전송
- 빈 content: 클라이언트 차단 및 서버 `400` 거부
- room 참여자가 아닌 사용자의 구독/발행: 서버 `ERROR` frame 또는 연결 종료로 거부

길이 제한은 서버 규칙을 최종 기준으로 한다.

---

## 7. 프런트엔드 구조

현재 `app → pages/layouts → features → shared` 의존 규칙을 유지한다.

```text
src/
├── app/
│   └── providers.jsx                       # ChatProvider 조립
├── features/
│   └── chat/
│       ├── ChatContext.jsx                 # 전역 openChat/closeChat 진입점
│       ├── chatService.js                  # room HTTP API와 DTO 검증
│       ├── chatSocket.js                   # STOMP client 생성/연결/구독/발행
│       ├── useChatSession.js               # 상태 전이와 cleanup
│       ├── chat.css
│       └── components/
│           ├── ChatModal.jsx
│           ├── ChatHeader.jsx
│           ├── MessageList.jsx
│           ├── MessageBubble.jsx
│           └── MessageComposer.jsx
└── shared/
    └── session/tokenStore.js               # 기존 getAccessToken 재사용
```

`ChatProvider`를 `AuthProvider` 안쪽, `RouterProvider` 바깥쪽에 둔다. 목록과 상세 어디에서든 `useChat().openChat(author)`를 호출할 수 있고, route가 바뀌어도 cleanup 정책을 한곳에서 관리할 수 있다.

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

서비스와 socket 모듈은 React에 의존하지 않는다. `useChatSession`이 연결 lifecycle과 UI state를 관리하고, components는 표시와 사용자 event 전달만 담당한다.

---

## 8. 오류 처리

| 상황 | 처리 |
| --- | --- |
| 모달 open 시 access token 없음 | 연결하지 않고 로그인 화면으로 이동 |
| room 조회/생성 401 | 기존 HTTP client의 refresh 1회 정책 적용; 최종 실패 시 로그인 처리 |
| room 조회/생성 기타 실패 | `채팅방을 열지 못했습니다.` 표시 후 닫기 제공 |
| WebSocket/STOMP 연결 실패 | `채팅 연결이 끊겼습니다.` 표시, 입력 비활성화 |
| 연결 후 비정상 종료 | `채팅 연결이 끊겼습니다.` 표시, 입력 비활성화 |
| 발행 시 연결 없음/실패 | `채팅 연결이 끊겼습니다.` 표시, 입력 비활성화 |
| 잘못된 수신 JSON/필수 field 누락 | 해당 frame 무시, 개발 환경 console 기록 |
| 상대 프로필 이미지 로드 실패 | 기존 `Avatar` 기본 이미지 사용 |

연결 오류 메시지는 모달 안에 유지한다. 이번 범위에서는 자동 재시도 버튼이나 자동 reconnect를 제공하지 않는다.

---

## 9. 보안 및 안정성

- access token은 기존 정책대로 메모리에서만 읽고 local/session storage에 저장하지 않는다.
- token을 WebSocket URL query parameter 또는 로그에 남기지 않는다.
- 백엔드는 STOMP 연결 인증뿐 아니라 구독 room과 발행 room의 참여자 권한을 각각 검증한다.
- 메시지는 React text node로 렌더링하고 `dangerouslySetInnerHTML`을 사용하지 않는다.
- `roomId`, `userId`, message DTO 필수 field를 수신 경계에서 검증한다.
- 한 번에 하나의 채팅 모달과 하나의 WebSocket connection만 허용한다.
- 다른 작성자를 누르면 기존 연결을 완전히 종료한 뒤 새 채팅을 연다.
- 빠른 연속 open/close의 비동기 응답이 닫힌 모달을 다시 열지 않도록 session id 또는 `AbortController`를 사용한다.

---

## 10. 테스트 계획

### 단위 및 컴포넌트 테스트

- 목록 작성자 클릭은 채팅을 열고 게시글 상세로 이동하지 않는다.
- 상세 작성자 클릭은 올바른 `userId`, `nickname`, `profileImageUrl`을 전달한다.
- 본인 작성자 영역에는 DM 버튼이 없다.
- token이 없으면 socket client를 만들지 않는다.
- 연결 성공 후 정확한 room destination을 한 번 구독한다.
- Enter 또는 전송 버튼으로 trim된 텍스트를 정확한 발행 destination에 보낸다.
- 빈 문자열은 발행하지 않는다.
- `senderId === currentUser.userId`이면 내 메시지 style, 아니면 상대 style을 적용한다.
- 연결 실패/비정상 종료 시 `채팅 연결이 끊겼습니다.`를 표시한다.
- 닫기와 unmount에서 `unsubscribe`, `deactivate`를 각각 호출한다.
- backdrop click은 모달을 닫지 않고 배경 click handler도 실행하지 않는다.
- `Escape`, focus trap, focus 복원이 동작한다.

STOMP client는 실제 네트워크 대신 adapter를 mock하여 destination, header, cleanup 호출을 검증한다.

### E2E

- 서로 다른 두 사용자로 같은 room을 열고 양방향 텍스트 송수신
- 모달 open 동안 배경 링크/버튼 클릭 및 body scroll 차단
- 모달을 닫은 뒤 서버에서 connection이 종료되는지 확인
- access token이 만료되었거나 유효하지 않을 때 채팅이 열리지 않는지 확인
- 서버 중단 시 지정된 연결 오류 문구가 표시되는지 확인

---

## 11. 구현 순서

1. 백엔드와 room 조회/생성 API, STOMP 인증 header, 메시지 DTO, server echo 여부를 확정한다.
2. `docs/API_SPEC.md`에 확정된 채팅 HTTP/WebSocket 계약을 추가한다.
3. `@stomp/stompjs`를 설치하고 `chatSocket.js` adapter를 작성한다.
4. room service와 DTO validator를 작성한다.
5. `ChatProvider`, `useChatSession`, cleanup을 구현한다.
6. 접근 가능한 `ChatModal`과 text composer를 구현한다.
7. `PostCard`의 중첩 link를 피하도록 영역을 나누고 목록/상세 author trigger를 연결한다.
8. 단위, 컴포넌트, E2E 테스트를 추가한다.
9. `npm run lint`, `npm test -- --run`, `npm run build`로 검증한다.

---

## 12. 구현 전 확정 체크리스트

아래 네 항목만 확정되면 MVP 구현을 시작할 수 있다.

- [ ] 상대 `userId`로 기존 1:1 room을 조회하거나 새로 만드는 HTTP API
- [ ] STOMP `CONNECT`의 `Authorization` header 인증 지원 여부
- [ ] 발행 및 수신 메시지 DTO field
- [ ] 발신 메시지를 같은 구독 destination으로 echo하는지 여부

이전 메시지 조회는 이번 MVP에서 제외할 수 있으며, 제외하면 모달을 연 이후의 메시지만 보인다.
