# chat 도메인 평가 및 리팩토링 계획

## 1. 목적과 범위

현재 `src/features/chat`과 이를 조합하는 `ChatListPage`, `ChatRoomPage`를 유지보수성, 단순성, 가독성 및 컴포넌트 책임 구조 관점에서 평가하고, 외부 동작을 보존하면서 구조를 개선하는 순서를 정의한다.

이번 계획은 기존 REST/STOMP 계약을 바꾸거나 새 기능을 추가하기 위한 문서가 아니다. 텍스트 DM, 채팅방 목록, 안 읽은 메시지 수, 읽음 처리를 현재 기능 범위로 유지한다. Redux 같은 별도 상태 관리 라이브러리 도입, 이미지·영상 메시지 UI, 서버 API 변경은 범위에서 제외한다.

## 2. 평가 요약

| 관점 | 평가 | 근거 |
| --- | --- | --- |
| 유지보수성 | 2.5 / 5 | transport와 계약 검증은 분리되어 있지만 핵심 대화 흐름이 343줄 훅 하나에 집중되어 있고, 그 훅과 소켓 adapter의 전용 테스트가 없다. |
| 단순성 | 3 / 5 | 작은 UI component와 공통 pagination 재사용은 단순하다. 반면 대화 상태, 자원 수명 주기, 인증, 낙관적 메시지, modal/page 표현 방식이 하나의 상태와 context에 합쳐져 있다. |
| 가독성 | 3 / 5 | 파일명과 계층은 역할을 짐작하기 쉽고 DTO 검증도 명시적이다. 그러나 문자열 상태와 단일 `error`, 다수의 ref·timer, page에 남은 읽음 정책 때문에 정상·실패 상태 전이를 여러 파일에서 추론해야 한다. |

종합하면 **외곽 경계는 비교적 잘 나뉘었지만 핵심 use-case 경계가 충분히 나뉘지 않은 구조**다. 컴포넌트도 leaf 단위는 작지만 modal/page의 공통 대화 조합과 focus·읽음 side effect 경계가 불명확하다. 새 기능을 더하기 전에 현재 동작을 테스트로 고정하고 `useChatSession`을 작은 순수 로직과 orchestration으로 분리한 뒤 공통 대화 view를 추출하는 것이 우선이다.

## 3. 현재 구조의 장점

### 3.1 도메인과 transport 경계가 보인다

- `chatService.js`가 REST endpoint와 envelope 검증을 담당한다.
- `chatSocket.js`가 STOMP library 세부사항과 destination을 감싼다.
- `chatContracts.js`가 REST와 STOMP payload를 런타임에 검증한다.
- feature가 page/app을 참조하지 않는 의존 방향은 프로젝트의 `FRONTEND_ARCHITECTURE.md` 및 ESLint 규칙과 맞는다.

이 경계는 유지한다. 리팩토링 과정에서 service 호출을 page로 올리거나 STOMP `Client`를 component에 노출하지 않는다.

### 3.2 화면 component가 대체로 작다

`ChatRoomCard`, `MessageBubble`, `MessageList`, `MessageComposer`는 표시 책임이 제한적이고 props도 읽기 쉽다. 목록은 공통 `useCursorPagination`을 재사용하므로 chat 전용 pagination 구현을 중복하지 않는다.

### 3.3 비동기 경합을 일부 방어한다

`useChatSession`은 `AbortController`와 `sessionIdRef`로 이전 방 요청 결과가 새 방에 반영되는 것을 막고, cleanup 시 subscription·socket·timer를 정리한다. `clientMessageId`를 이용해 낙관적 메시지와 서버 메시지를 병합하는 방향도 적절하다.

### 3.4 API 경계의 실패를 조기에 드러낸다

응답의 ID, nullable field, event type을 validator로 확인한다. 잘못된 서버 응답을 UI의 optional 처리로 숨기지 않는 방식은 유지보수에 유리하다.

## 4. 문제점과 우선순위

### P0. 핵심 상태 흐름에 회귀 방지 테스트가 없다

현재 chat 관련 자동 테스트 21개는 모두 통과한다. 그러나 대상은 service, 시간 formatter, 목록 page, modal, 알림 button이며 다음 핵심 모듈에는 직접 테스트가 없다.

- `useChatSession.js`: 방 전환, 연결·해제, history/live 병합, 전송 timeout, 인증 갱신
- `chatSocket.js`: 연결 실패와 종료 구분, subscription parsing, destination
- `chatContracts.js`: live/auth/error/read event의 성공·실패 계약
- `useUnreadMessages.js`: polling, focus, 요청 중복 제거, logout 초기화
- `ChatRoomPage.jsx`: 읽음 발행과 visibility 조건

특히 가장 복잡한 파일을 수정할 때 보호할 테스트가 없으므로 구조 변경보다 characterization test를 먼저 추가해야 한다.

### P0. `useChatSession`의 책임이 과도하다

`useChatSession.js`는 다음 책임을 동시에 가진다.

1. modal/page 대화 열기와 로그인 redirect
2. 방 resolve 및 history REST 요청
3. socket 생성, 연결, 구독, 해제
4. access token 변경 감지와 STOMP 재인증
5. wire message를 화면 message로 변환하고 중복 병합
6. 낙관적 전송, 15초 timeout, 실패 상태 반영
7. STOMP 오류 code 분류와 인증 실패 처리
8. modal trigger focus 보관과 복원

이 때문에 작은 변경도 다수의 ref, callback dependency, cleanup 순서를 함께 검토해야 한다. 여러 ref와 문자열 상태를 나란히 읽어야만 현재 session의 유효성을 판단할 수 있으며, 순수한 메시지 규칙도 React 훅 안에 묶여 단위 테스트하기 어렵다.

### P1. 상태 전이가 암묵적이고 오류 의미가 섞여 있다

`status`는 `closed`, `resolving-room`, `connecting`, `connected`, `reauthenticating`, `connection-error` 문자열로 사용되지만 가능한 전이와 각 상태의 불변조건이 코드에 정의되어 있지 않다. 여러 `setState`가 부분 객체를 직접 조합하므로 다음과 같은 조합을 타입이나 reducer가 막지 못한다.

- `connected`인데 `room` 또는 socket이 없는 상태
- 이전 방의 `messages`와 새 `target`이 함께 있는 상태
- 메시지 전송 오류가 있는데 연결은 정상인 상태와 실제 연결 오류인 상태의 혼동

또한 하나의 `error` 문자열이 방 resolve, 연결, 인증, 개별 메시지 전송 오류를 모두 표현한다. 새 메시지 성공이나 재인증 성공이 다른 종류의 오류까지 지울 수 있어 오류의 수명 주기를 파악하기 어렵다.

### P1. 읽음 use-case가 page와 session에 분산되어 있다

`ChatRoomPage`가 마지막 상대 메시지를 검색하고 300ms 뒤 `markAsRead`를 호출한 다음, 성공 확인 없이 다시 600ms 뒤 전체 unread count를 조회한다. transport 발행은 `useChatSession`, 전체 count 조회는 `useUnreadMessages`에 있다.

이 구조에는 다음 유지보수 문제가 있다.

- `MESSAGE_READ` event는 `isReadEvent`로 식별한 뒤 즉시 버려서 어떤 발행이 확인되었는지 알 수 없다.
- 300ms와 600ms가 이름 없는 구현 상세로 page에 노출된다.
- hidden 상태에서 message가 도착한 뒤 탭이 visible로 바뀌어도 `visibilitychange`가 상태 의존성에 없으므로 읽음 effect가 다시 실행된다는 보장이 없다.
- 발행 실패, 서버 오류, 최신 메시지가 추가된 경우의 재시도 정책이 page와 문서 사이에만 존재한다.

읽음 위치 계산은 화면 활성 여부와 관련되지만, pending read와 event 확인·재동기화는 chat use-case에 속한다. 두 책임의 경계를 명시해야 한다.

### P1. 하나의 context가 서로 다른 변경 주기와 API를 합친다

`ChatContext`는 대화 session 값과 30초 polling unread 값을 spread로 합치고 modal까지 렌더링한다. 그 결과 알림 button은 count 하나만 사용해도 메시지 전송이나 연결 상태 변경 때 context value가 바뀌고, 대화 UI는 unread polling 결과가 바뀔 때 다시 렌더링된다.

API 면에서도 `useChat()` 반환값에 modal 열기, page 방 열기, 메시지 전송, 읽음 발행, 전체 unread 조회가 모두 평평하게 노출되어 소비자가 필요한 책임을 알기 어렵다.

### P2. wire model과 화면 model 변환이 흩어져 있다

history는 `messageId`/`senderId`, live event는 `chatMessageId`/`userId`를 사용한다. 두 변환 함수와 병합 함수가 `useChatSession` 내부에 있어 service·socket 계약과 화면 모델 사이의 경계를 파일 구조에서 찾기 어렵다. 병합은 각 incoming message마다 `findIndex`를 수행하므로 메시지 수가 커질수록 읽기와 성능 모두 불리하다.

### P2. 표현 방식과 수명 주기 정책이 결합되어 있다

동일한 session이 `presentation: 'modal' | 'page'`를 가지고 provider의 `ChatModal` 렌더링과 focus 복원까지 결정한다. page 진입과 modal 진입의 공통 대화 로직은 재사용할 가치가 있지만, UI 표현 방식이 socket/session state의 필수 필드일 필요는 없다. 이 결합은 새 표현 방식이나 route 변화가 session 훅을 건드리게 한다.

### P2. 설계 문서와 구현 선택이 명확히 동기화되지 않았다

`CHAT_LIST_DESIGN.md`의 Q1은 장기 연결(A)과 대화 중 연결(B)을 선택지로 남겨 두었다. 현재 구현은 대화가 열릴 때만 socket을 연결하고 header unread를 polling하므로 사실상 Q1-B에 가깝지만, B에 적힌 목록 focus·polling 재조회는 구현되어 있지 않다. 목록은 mount 시 한 번 조회하므로 열린 화면에서 preview와 방별 unread가 오래된 상태로 남을 수 있다.

리팩토링 중 암묵적으로 Q1-A를 구현하지 않는다. 먼저 현재 선택을 Q1-B로 확정할지 제품 결정을 기록하고, B를 유지한다면 목록 재동기화 조건을 별도 기능 작업으로 분리한다.

## 5. 컴포넌트 구조 평가

### 5.1 평가 요약

| 관점 | 평가 | 근거 |
| --- | --- | --- |
| 책임 분리 | 3 / 5 | leaf component는 작지만 modal과 page가 동일한 대화 본문을 각각 조합하고, page에 읽음 side effect가 남아 있다. |
| 재사용 경계 | 2.5 / 5 | `MessageList`와 `MessageComposer`는 재사용하지만 header·오류·본문 조합은 중복된다. 반대로 `ChatRoomList`는 동작 없이 map만 감싸 추상화 이점이 작다. |
| props/API 가독성 | 3 / 5 | props 이름은 대체로 명확하다. 다만 `target` 전체 객체 전달, 고정 DOM ID, 평평한 `chat` 객체 전달로 실제 의존성을 component signature만 보고 알기 어렵다. |
| 접근성 구조 | 3.5 / 5 | heading, dialog role, label, focus trap, live region을 갖추고 있다. 그러나 modal focus가 selector와 고정 ID에 결합되어 있고 focus 복원은 session 훅에 떨어져 있다. |
| 테스트 용이성 | 2.5 / 5 | modal과 일부 leaf UI는 테스트되지만 공통 대화 조합, composer 자체, room page, scroll·focus 계약이 독립적으로 검증되지 않는다. |

컴포넌트 계층은 과도하게 크지 않으며 전면 재설계가 필요하지 않다. 핵심은 **modal과 page의 공통 대화 본문만 재사용 가능한 단위로 묶고, route/dialog 같은 환경별 책임은 container에 남기는 것**이다. 모든 짧은 JSX를 별도 파일로 추출하는 방식은 피한다.

### 5.2 잘 구성된 부분

- `MessageBubble`은 메시지 표시, 삭제 tombstone, 미지원 형식, 전송 상태만 담당한다.
- `MessageComposer`는 controlled input과 Enter/Shift+Enter 동작을 한곳에 모은다.
- `ChatRoomCard`는 링크 전체를 클릭 영역으로 만들고 unread label, badge, 상대 시각을 일관되게 표시한다.
- `ChatModal`은 `role="dialog"`, `aria-modal`, focus trap, Escape 처리를 포함해 dialog 경계를 명시한다.
- page는 feature component를 조합하고 feature component는 shared `Avatar`를 사용하는 현재 의존 방향이 적절하다.
- `ChatListSkeleton`처럼 한 page에서만 쓰이고 독립적인 업무 의미가 없는 component를 page 가까이에 둔 선택은 단순하다.

### 5.3 개선이 필요한 부분

#### P1. modal과 room page의 대화 본문 조합이 중복된다

`ChatModal`과 `ChatRoomPage`는 모두 다음 순서로 UI를 조합한다.

1. 상대방 header
2. `MessageList`
3. session 오류
4. `MessageComposer`

현재 차이는 dialog/page shell, heading level, 닫기 또는 복귀 action뿐이다. 오류 class와 문구 배치도 각각 구현되어 있어 전송 상태나 재연결 UI를 추가하면 두 화면을 함께 수정해야 한다.

공통 영역을 `ChatConversation`으로 추출하되 header와 shell까지 하나의 범용 component로 합치지 않는다. `ChatModal`은 dialog·focus·Escape를, `ChatRoomPage`는 route 진입·이탈과 page heading을 계속 소유한다.

#### P1. component와 DOM selector가 직접 결합되어 있다

`MessageComposer`는 `id="chat-message-input"`을 고정으로 사용하고 `ChatModal`은 해당 selector를 문자열로 찾아 focus한다. 현재 전역 session이 modal/page 동시 표시를 막기 때문에 우연히 충돌하지 않지만, component 재사용 계약으로는 숨은 결합이다.

`MessageComposer`가 `useId()`로 label 연결 ID를 만들고 textarea ref 또는 `focus()` handle을 명시적으로 제공하도록 바꾼다. modal은 DOM ID를 알지 않고 전달받은 ref에 focus한다. focus 복원도 session 훅이 아니라 modal host가 열기 trigger를 저장해 담당한다.

#### P1. `ChatRoomPage`가 view와 use-case side effect를 함께 가진다

room page는 route ID 검증과 session open/close 외에도 최신 상대 메시지 검색, visibility 판단, 두 단계 timer, unread refresh를 수행한다. 이 때문에 page test가 socket 및 timer 정책까지 알아야 하고 JSX를 읽는 도중 읽음 알고리즘을 만나게 된다.

읽음 정책을 `useChatReadReceipt`로 이동하면 page에는 `roomId`를 기준으로 session을 여는 container 역할과 `ChatConversation` 렌더링만 남는다.

#### P2. 일부 component 경계의 추상화 수준이 맞지 않는다

- `ChatRoomList`는 `<ul>`과 `rooms.map()`만 감싼 9줄 component다. list 자체에 별도 동작이나 테스트 계약을 두지 않을 경우 상위 list view에 인라인하는 편이 탐색 비용이 작다.
- 반면 연결 상태 안내와 오류 표시는 modal/page에서 중복되므로 `ChatSessionFeedback`처럼 의미 있는 상태 표현 단위가 필요하다.
- `ChatHeader`라는 이름은 범용처럼 보이지만 실제로 modal 닫기 button과 `h2`를 고정한다. `ChatModalHeader`로 이름을 구체화하거나 heading/action을 명시적으로 받는 제한된 API로 바꾼다.

component를 분리하는 기준은 줄 수가 아니라 **독립적인 상태 분기, 접근성 계약, 둘 이상의 consumer** 중 하나를 가지는지 여부로 정한다.

#### P2. props가 실제 의존성보다 넓다

`ChatModal`은 session 전체 객체를 `chat` prop 하나로 받고, `MessageBubble`은 avatar와 nickname만 필요하지만 `target` 전체를 받는다. 편리하지만 component가 어떤 값에 의존하는지 호출부와 테스트 fixture가 불필요하게 넓어진다.

- container는 session 객체를 받아도 되지만 view component에는 필요한 값과 callback만 전달한다.
- `MessageList`에는 `participant`처럼 화면에서 사용하는 상대 정보 model을 전달하고 wire room 객체를 그대로 전달하지 않는다.
- boolean props가 늘어나면 `isLoading`, `isConnecting`, `hasError`를 조합하지 않고 단일 `status` 또는 계산된 view model을 사용한다.

#### P2. scroll 정책이 렌더링 component 내부에 고정되어 있다

`MessageList`는 `messages`가 바뀔 때마다 항상 마지막으로 scroll한다. 현재 최초 history와 새 메시지만 있으므로 단순하지만, 이전 history prepend를 연결하면 사용자가 보던 위치가 사라진다.

즉시 복잡한 scroll manager를 도입하지는 않는다. 먼저 현재 계약을 “최초 로드와 append 시 하단 이동”으로 테스트하고, history pagination을 구현할 때 prepend 위치 보존을 `useMessageScroll` 같은 별도 UI hook으로 분리한다.

#### P3. chat stylesheet의 책임 구획이 코드 구조보다 약하다

`chat.css` 한 파일에 modal, message, room page, list 스타일이 이어져 있다. 현재 약 110줄이므로 파일 분리는 시급하지 않다. 우선 section comment와 component 순서로 정렬하고, 각 영역이 독립적으로 커질 때 `chat-conversation.css`, `chat-list.css`로 나눈다. 구조 개선을 이유로 지금 CSS 파일 수부터 늘리지는 않는다.

## 6. 목표 구조

파일 수를 늘리는 것 자체가 목적은 아니다. 변경 이유가 서로 다른 책임만 분리한다.

```text
features/chat/
├── chatContracts.js          # wire payload 검증만 담당
├── chatMessageModel.js       # wire → 화면 model, 병합, 낙관적 message 생성
├── chatService.js            # REST 요청
├── chatSocket.js             # STOMP transport adapter
├── chatSessionReducer.js     # 명시적인 session 상태와 전이
├── useChatSession.js         # REST/socket/reducer를 조율하는 use-case
├── useChatReadReceipt.js     # visible 상태, 마지막 상대 메시지, read 동기화
├── useUnreadMessages.js      # 전체 unread 조회 정책
├── ChatSessionContext.jsx    # 대화 API만 제공
├── ChatUnreadContext.jsx     # 전체 unread API만 제공
└── components/
    ├── ChatModalHost.jsx     # modal 표시 여부와 trigger focus 복원
    ├── ChatModal.jsx         # dialog shell, focus trap, Escape
    ├── ChatModalHeader.jsx   # modal 전용 heading과 닫기 action
    ├── ChatConversation.jsx  # message/feedback/composer 공통 조합
    ├── ChatSessionFeedback.jsx
    ├── MessageList.jsx
    ├── MessageBubble.jsx
    └── MessageComposer.jsx
```

다음 원칙을 적용한다.

- **순수 규칙과 side effect 분리:** normalize, merge, reducer는 browser·React 없이 테스트할 수 있게 한다.
- **상태 전이 단일화:** component와 socket callback은 상태 객체를 직접 조합하지 않고 의미 있는 action을 dispatch한다.
- **context 최소화:** 소비자는 `useChatSessionContext()` 또는 `useChatUnread()` 중 필요한 값만 구독한다.
- **page는 조합만 담당:** route parameter 해석, 화면 배치, 활성 상태 전달만 남기고 timeout·재시도 정책은 hook으로 이동한다.
- **transport는 정책을 모른다:** socket adapter는 connect/subscribe/publish/deactivate만 제공하고 인증 갱신 및 오류 문구 정책은 use-case에 둔다.
- **공통 본문만 공유:** dialog와 route page의 shell·heading은 분리하고 message/feedback/composer 조합만 공유한다.
- **명시적인 focus 계약:** component끼리 고정 ID나 selector를 공유하지 않고 ref 또는 공개 callback으로 상호작용한다.

### 6.1 목표 상태 모델

상태명은 상수로 관리하고 reducer action으로만 바꾼다.

```js
const CHAT_SESSION_STATUS = {
  CLOSED: 'closed',
  RESOLVING_ROOM: 'resolving-room',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  REAUTHENTICATING: 'reauthenticating',
  DISCONNECTED: 'disconnected',
};
```

오류는 최소한 `sessionError`와 message별 `status: sending | sent | failed`로 구분한다. 입력 검증 오류처럼 연결을 끊지 않는 오류가 `DISCONNECTED` 전이를 만들지 않도록 action별 책임을 고정한다.

주요 action 예시는 다음과 같다.

- `OPEN_REQUESTED`, `ROOM_RESOLVED`, `SOCKET_CONNECTED`
- `HISTORY_RECEIVED`, `LIVE_MESSAGE_RECEIVED`
- `MESSAGE_SEND_STARTED`, `MESSAGE_SEND_CONFIRMED`, `MESSAGE_SEND_FAILED`
- `REAUTH_STARTED`, `REAUTH_SUCCEEDED`, `SESSION_DISCONNECTED`, `CLOSED`

### 6.2 외부 API 목표

대화 session consumer에는 다음 정도만 노출한다.

```js
{
  state: { status, target, messages, sessionError },
  openDirectChat,
  openRoom,
  close,
  sendText,
  requestRead,
}
```

unread consumer에는 `{ totalUnreadCount, refreshUnread }`만 노출한다. `socketRef`, subscription, timer, token은 외부에 노출하지 않는다.

### 6.3 목표 컴포넌트 조합

```text
ChatModalHost
└── ChatModal                 # dialog 접근성·focus
    ├── ChatModalHeader
    └── ChatConversation
        ├── MessageList
        │   └── MessageBubble
        ├── ChatSessionFeedback
        └── MessageComposer

ChatRoomPage                  # route lifecycle·page heading
└── ChatConversation          # 동일한 대화 본문 재사용
```

`ChatConversation`은 session hook을 직접 호출하지 않는 presentational component로 둔다. 다음처럼 필요한 값만 받는다.

```jsx
<ChatConversation
  messages={messages}
  participant={participant}
  currentUserId={currentUserId}
  status={status}
  error={sessionError}
  onSend={sendText}
/>
```

이를 통해 session hook은 container에서 한 번만 호출되고, 공통 view는 story 형태의 fixture나 component test로 독립 검증할 수 있다.

## 7. 단계별 리팩토링 계획

### 0단계. 현재 동작 고정

구조를 바꾸기 전에 다음 characterization test를 추가한다.

1. direct modal과 room page가 각각 올바른 REST 요청 후 socket을 연결한다.
2. 방을 빠르게 전환하면 이전 history와 live message가 새 방에 섞이지 않는다.
3. history와 live message가 `clientMessageId` 또는 `messageId` 기준으로 한 번만 남는다.
4. 전송 직후 `sending`, echo 수신 후 `sent`, 15초 무응답 후 `failed`가 된다.
5. close/unmount 시 요청, subscription, socket, 모든 timer가 정리된다.
6. access token 변경 시 한 번 재인증하고 성공·timeout·refresh 실패가 각각 올바른 상태가 된다.
7. logout 시 session과 unread가 초기화된다.
8. malformed STOMP payload가 uncaught callback 오류로 퍼지지 않고 정의된 session 오류로 처리된다.

테스트에서는 실제 STOMP client 대신 `createChatSocket`을 mock하고 fake timer를 사용한다. 내부 ref 개수가 아니라 사용자에게 보이는 상태와 adapter 호출을 검증한다.

### 1단계. 메시지 model과 상태 reducer 추출

`normalizeHistoryMessage`, `normalizeLiveMessage`, `mergeUniqueMessages`, 낙관적 message 생성을 `chatMessageModel.js`로 옮긴다. 공개 함수는 별도 단위 테스트를 작성한다.

병합은 다음 규칙을 명시한다.

1. `clientMessageId` 일치를 우선한다.
2. 양쪽에 `messageId`가 있을 때 ID 일치를 보조 기준으로 사용한다.
3. server message가 optimistic field를 덮어써 `sent`로 확정한다.
4. history prepend와 live append에서 서버 시간 순서를 훼손하지 않는다.
5. 같은 batch 안의 중복도 제거한다.

그 다음 `chatSessionReducer.js`를 만들고 기존 `setState`를 action dispatch로 기계적으로 치환한다. 이 단계에서는 socket 수명 주기와 UI를 바꾸지 않아 회귀 범위를 제한한다.

### 2단계. session orchestration 단순화

`useChatSession`에는 다음 orchestration만 남긴다.

- open/close use-case 시작
- service와 socket adapter 호출
- callback 결과를 reducer action으로 전달
- session generation과 `AbortController` 관리
- token 변경에 따른 재인증 시작

error code 집합과 사용자 문구 매핑은 `mapChatError` 같은 순수 함수로 분리한다. timer 값 `MESSAGE_ACK_TIMEOUT_MS`, `REAUTH_TIMEOUT_MS`를 이름 있는 상수로 만든다. cleanup은 구독 해제 → timer 정리 → 요청 취소 → socket deactivate 순서와 멱등성을 테스트로 고정한다.

modal focus trigger는 `ChatModalHost`로 이동한다. `presentation`은 session 상태가 아니라 host 또는 호출 entry point가 소유하도록 하되, modal과 page가 동시에 하나의 전역 session을 열 수 없다는 현재 제약은 유지한다.

### 3단계. context와 consumer API 분리

대화 session context와 unread context를 나눈다. 마이그레이션 중에는 기존 `useChat`을 임시 facade로 둘 수 있지만 신규 코드는 목적별 hook을 사용한다.

- `ChatNotificationButton`, `ChatListPage` → unread context
- `PostCard`, `PostDetailPage`, `ChatModalHost`, `ChatRoomPage` → session context
- `ChatRoomPage` → session context + unread context를 직접 조합하지 않고 다음 단계의 read hook 사용

provider value는 `useMemo`로 안정화하되, memoization보다 context 분리로 변경 전파 범위를 줄이는 것을 우선한다. 전환이 끝나면 평평한 `useChat` facade를 제거한다.

### 4단계. 공통 대화 view와 focus 계약 정리

먼저 `ChatConversation`을 추가해 `MessageList`, `ChatSessionFeedback`, `MessageComposer` 조합을 modal과 page에서 공유한다. 이때 두 container의 외부 구조는 유지해 한 번에 접근성 tree와 CSS layout까지 바뀌지 않게 한다.

1. modal/page의 현재 렌더링 결과를 component test로 고정한다.
2. 중복 오류 UI를 `ChatSessionFeedback`으로 옮긴다. page에만 필요한 복귀 link는 `action` slot 또는 명시적인 prop으로 전달한다.
3. `ChatHeader`를 `ChatModalHeader`로 구체화하고 page header는 page에 유지한다.
4. `MessageComposer`에 생성된 ID와 textarea ref 계약을 추가하고 modal의 `#chat-message-input` query를 제거한다.
5. `ChatModalHost`가 modal 표시와 열기 trigger focus 복원을 담당하게 한다.
6. 동작 없는 `ChatRoomList`는 list view에 인라인하거나, list의 접근성·상태 책임까지 맡기는 경우에만 유지한다.

추출 후에도 `ChatConversation`이 session context를 직접 읽거나 route를 참조하지 않게 한다. props drilling을 줄이기 위해 view 전용 context를 새로 만드는 것은 현재 규모에서는 이점보다 복잡성이 크므로 사용하지 않는다.

### 5단계. 읽음 처리 use-case 통합

`useChatReadReceipt`가 다음을 담당하게 한다.

1. document가 visible인지 추적하고 `visibilitychange`에서 다시 평가한다.
2. 현재 방의 최신 상대 message ID를 계산한다.
3. 이미 요청·확인한 ID보다 클 때만 read를 발행한다.
4. `MESSAGE_READ` event의 room, reader, message ID를 validator로 확인한다.
5. 확인 또는 명시한 fallback 시점에만 `refreshUnread`를 호출한다.
6. 방 변경·unmount 시 pending read timer를 정리한다.

`isReadEvent` boolean 판별만 두지 말고 `validateReadEvent`가 envelope 전체를 검증하게 한다. 현재 서버가 동일·과거 ID에 event를 발행하지 않는 계약을 고려해, event 부재를 곧바로 실패로 만들지 않고 이름 있는 fallback timeout 뒤 REST로 보정한다.

이 단계가 끝나면 `ChatRoomPage`에서는 300ms/600ms timer, `lastReadRef`, 역순 검색을 제거한다.

### 6단계. 문서와 선택 사항 정리

제품 결정으로 `CHAT_LIST_DESIGN.md`의 Q1을 확정한다.

- **Q1-B 유지 시:** 대화가 닫힐 때 socket 종료와 30초 전체 count polling을 현재 정책으로 명시한다. 목록 focus/polling 재조회는 별도 hook 또는 `useChatList`의 `reset`으로 구현하고 테스트한다.
- **Q1-A 전환 시:** 전역 socket, `/user/queue/chat-updates`, room subscription을 분리하는 별도 기능 설계를 먼저 작성한다. 이번 구조 리팩토링과 같은 PR에서 구현하지 않는다.

문서의 선택 표기, 실제 provider 수명 주기, 테스트가 동일한 정책을 말하도록 맞춘다.

## 8. 테스트 계획

### 8.1 순수 단위 테스트

- history/live/optimistic message normalize
- 중복 병합과 상태 확정
- session reducer의 정상 전이와 허용하지 않는 action 처리
- STOMP error code → 상태/action/문구 매핑
- read event와 auth event 계약 검증

### 8.2 hook 통합 테스트

- 방 resolve → connect → subscribe → history 병합
- REST, socket, token 갱신의 비동기 순서와 stale session 차단
- close, 방 전환, logout, unmount cleanup
- unread 최초 조회, focus, 30초 polling, 동시 요청 dedupe, abort
- hidden → visible 전환 시 최신 상대 메시지 읽음 처리

### 8.3 component/page 테스트

- modal과 page가 동일한 session view를 렌더링한다.
- 연결 상태별 composer 활성화와 오류 표시가 유지된다.
- 잘못된 room ID, 403, 404, 연결 실패에서 복귀 경로가 유지된다.
- session 변경이 notification button을 불필요하게 갱신하지 않고 unread 변경은 반영된다.
- `ChatConversation`이 연결 준비, 빈 대화, 메시지 목록, 오류, 전송 가능 상태를 각각 표시한다.
- composer가 고유한 label 연결 ID를 사용하고 Enter/Shift+Enter, max length, 성공 후 입력 초기화를 유지한다.
- modal이 composer ref로 초기 focus를 이동하고 Escape·Tab 순환·close 후 trigger focus 복원을 유지한다.
- message append 시 하단으로 이동하되 component mount 전 ref 부재에서도 오류가 발생하지 않는다.
- modal과 page의 heading level, dialog role, live region 등 접근성 tree가 유지된다.

테스트는 CSS class나 내부 component 개수보다 role, accessible name, 표시 상태, callback을 우선 검증한다. 공통 component 추출 전후에 같은 사용자 동작 assertion을 사용해 markup 재배치가 기능 회귀를 숨기지 않게 한다.

### 8.4 회귀 검증 명령

각 단계에서 다음을 모두 통과시킨다.

```sh
npm test
npm run lint
npm run build
npm run test:e2e
```

E2E 환경에서 두 사용자의 동시 접속이 어렵다면 최소한 mock server 기반으로 전송 echo, 읽음, token 재인증 시나리오를 통합 테스트하고 실제 다중 사용자 검증 항목을 수동 체크리스트로 남긴다.

## 9. 작업 단위와 권장 PR 순서

| PR | 내용 | 동작 변경 |
| --- | --- | --- |
| 1 | `useChatSession`, socket, unread, room page characterization test | 없음 |
| 2 | message model 및 reducer 추출 | 없음 |
| 3 | session orchestration, 오류 매핑, timer 상수 정리 | 없음 |
| 4 | session/unread context 분리 및 consumer 이동 | 없음 |
| 5 | `ChatConversation`, feedback, composer ref, modal host 정리 | 없음 |
| 6 | read receipt hook과 event 검증 도입 | 읽음 재동기화 정확성 개선 |
| 7 | Q1 결정 반영 및 목록 재동기화 또는 전역 socket 별도 구현 | 제품 결정에 따름 |

각 PR은 구조 변경과 기능 추가를 섞지 않는다. 특히 PR 1의 테스트가 통과하는 상태에서 PR 2~5를 진행하고, 의도적인 읽음 동작 변경은 PR 6의 테스트와 변경 설명으로 분리한다.

## 10. 완료 기준

- `useChatSession.js`가 메시지 변환, reducer, modal focus 구현을 직접 포함하지 않는다.
- session 상태 변경이 reducer action으로 표현되고 주요 전이가 단위 테스트된다.
- session과 unread context가 분리되어 consumer가 필요한 API만 구독한다.
- modal과 room page가 `ChatConversation`을 공유하되 dialog와 route shell 책임은 각각 유지한다.
- `MessageComposer`의 고정 DOM ID와 modal의 composer selector query가 제거된다.
- focus trap과 focus 복원이 session 훅이 아닌 modal component/host 경계에 위치한다.
- 공통 component는 session context와 router를 직접 참조하지 않고 필요한 props만 받는다.
- 의미 있는 책임이 없는 pass-through component는 제거되거나 명확한 접근성·상태 책임을 가진다.
- `ChatRoomPage`에 읽음 관련 magic timeout과 pending ref가 남지 않는다.
- history/live/optimistic message의 단일 화면 model과 병합 규칙이 한 파일에 정의된다.
- open/close, 방 전환, 전송 성공·timeout, 재인증, logout, unmount cleanup 테스트가 존재한다.
- `CHAT_LIST_DESIGN.md`의 Q1 선택과 실제 socket/list 갱신 정책이 일치한다.
- 기존 접근성, 목록 pagination, modal/page 진입, 메시지 전송 UX가 유지된다.
- 전체 test, lint, build, E2E 검증이 통과한다.

## 11. 예상 효과

- 새 메시지 유형이나 재전송을 추가할 때 React 수명 주기 전체를 수정하지 않고 message model과 reducer 중심으로 변경할 수 있다.
- 방 전환·인증 갱신·읽음처럼 비동기 순서에 민감한 회귀를 자동 테스트에서 발견할 수 있다.
- page와 component가 transport 세부사항을 모르므로 화면 변경과 통신 변경의 영향 범위가 줄어든다.
- 상태와 오류의 의미가 이름 있는 action과 상수로 드러나 정상 흐름뿐 아니라 실패 흐름도 빠르게 읽을 수 있다.
- modal과 page의 공통 대화 UI 변경이 한 component에서 이뤄지고, 환경별 접근성 책임은 서로 영향을 주지 않는다.
- focus, scroll, 입력 같은 UI side effect가 명시적인 component API로 드러나 DOM 구조 변경에 덜 취약해진다.

## 12. 구현 진행 현황

### 2026-08-05: 전체 공통 기반 개선 완료

- `chatMessageModel.js`로 history/live/optimistic message 정규화와 병합·실패 규칙을 분리했다.
- `chatSessionReducer.js`에 session 상태 상수와 action 기반 전이를 추가했다.
- `chatErrorPolicy.js`로 STOMP 오류 분류와 대화 열기 오류 문구를 분리했다.
- `useChatSession.js`를 reducer 기반 orchestration으로 전환하고 message/reauth timeout을 이름 있는 상수로 변경했다.
- `chatSocket.js`에 protocol error 경계를 추가해 JSON parsing 및 payload callback 오류가 STOMP callback 밖으로 전파되지 않게 했다.
- `ChatSessionContext`와 `ChatUnreadContext`를 분리했다.
- 게시글의 채팅 진입점은 session context만, header 알림은 unread context만 구독하도록 전환했다.
- message model, reducer, error policy, contract, socket, session hook, unread hook 테스트를 추가했다.

목록과 채팅방 페이지가 모두 목적별 context를 직접 사용하므로 기존 `ChatContext`와 `useChat()` 호환 facade는 제거했다.

### 2026-08-05: 채팅 목록 페이지 개선 완료

- `ChatListPage`가 통합 `useChat()` facade 대신 `useChatUnread()`만 구독하도록 변경했다.
- 로딩, 빈 목록, 초기 오류, 목록, 추가 조회 오류, background refresh 오류 표시를 `ChatListContent`로 분리했다.
- 별도 동작 없이 `<ul>`과 `map`만 감싸던 `ChatRoomList`를 제거하고 list 의미를 `ChatListContent`가 소유하게 했다.
- `useChatList`가 화면 focus 및 visible 상태의 30초 주기로 첫 페이지를 background refresh한다.
- 최신 첫 페이지를 기존 추가 페이지와 `chatRoomId` 기준으로 병합하고, 병합 결과의 마지막 room으로 pagination cursor를 다시 계산한다.
- background refresh가 실패해도 기존 목록을 유지하고 별도 재시도 UI를 제공한다.
- `CHAT_LIST_DESIGN.md`의 socket 수명 주기 선택을 실제 구현에 맞는 `Q1-B`로 확정하고 `DM_CHAT_DESIGN.md`의 `Q2-B`와 동기화했다.
- 빈 상태, 복합 cursor, focus 병합, background refresh 실패·복구, 30초 polling 테스트를 추가했다.

### 2026-08-05: 채팅방 페이지 개선 완료

- `ChatConversation`이 modal과 route page의 message list, session feedback, composer 조합을 공유한다.
- modal 전용 heading component를 `ChatModalHeader`로 구체화하고 route page header는 page에 유지했다.
- `MessageComposer`가 `useId()`와 textarea ref를 제공하며 modal의 고정 `#chat-message-input` selector 의존성을 제거했다.
- modal 표시와 trigger focus 복원을 `ChatModalHost` 및 `ChatSessionProvider` 경계로 옮겼다.
- session 상태의 `presentation`과 `useChatSession`의 DOM focus 책임을 제거했다.
- `MESSAGE_READ` envelope의 code, room, reader, message ID를 검증하고 session reducer에 receipt와 read error를 분리했다.
- `useChatReadReceipt`가 visible/focus 추적, 300ms debounce, receipt 확인, 명시적 오류 후 focus 재시도, confirmation timeout REST fallback을 담당한다.
- `ChatRoomPage`는 route ID 검증, session open/close, page header와 공통 conversation 조합만 담당한다.
- 채팅방 페이지를 `ChatSessionContext`와 `ChatUnreadContext` 직접 사용으로 전환하고 통합 `ChatContext` facade를 제거했다.
- `CHAT_LIST_DESIGN.md`의 뒤로가기 선택을 현재 구현과 일치하는 `Q2-A`로, `DM_CHAT_DESIGN.md`의 history 범위를 `Q1-A`로 확정했다.
- composer ID/ref, modal focus 복원, read receipt/fallback/retry, route 오류 및 연결 오류 회귀 테스트를 추가했다.
