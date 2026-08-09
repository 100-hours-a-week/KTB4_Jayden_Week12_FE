# 하비루프 프론트엔드

> 취미로 이어지는 커뮤니티, 하비루프

HobbyLoop Frontend는 취미를 게시하고 다른 사용자와 소통할 수 있는 웹 클라이언트입니다. React와 Vite로 구현한 프론트엔드가 있으며, 화면 렌더링부터 인증 상태, HTTP API 연동, STOMP 기반 1:1 채팅까지 포함됩니다.

## 주요 기능

- 회원가입, 로그인, 로그아웃과 JWT access token 갱신
- 게시글 목록의 무한 스크롤, 상세 조회, 작성, 수정, 삭제
- 게시글 다중 이미지 첨부, 좋아요와 댓글
- 프로필 이미지·닉네임 및 비밀번호 변경
- 게시글 작성자와의 1:1 채팅, 채팅방 목록과 안 읽은 메시지 표시
- STOMP 기반 실시간 메시지·읽음 이벤트 처리와 낙관적 메시지 표시

## 기술 스택

| 구분 | 기술 |
| --- | --- |
| UI | React 19, CSS |
| 개발·빌드 | Vite 8 |
| 라우팅 | React Router 7 |
| 서버 통신 | Fetch API, `@stomp/stompjs` |
| 단위·컴포넌트 테스트 | Vitest, Testing Library, jsdom, MSW |
| E2E 테스트 | Playwright |
| 정적 검사 | ESLint |

## 로컬 실행

### 준비 사항

- Node.js `^20.19.0`, `^22.12.0` 또는 `>=24.0.0`과 npm
- 하비루프 백엔드 서버
  - HTTP API: 기본값 `http://localhost:8080`
  - WebSocket/STOMP handshake: `/ws-chat`

Node.js 버전 조건은 현재 설치된 Vite 8의 `engines`를 기준으로 합니다.

### 설치 및 시작

```bash
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속합니다.

`.env.local`에서 백엔드 주소를 설정할 수 있습니다.

```dotenv
VITE_API_BASE_URL=http://localhost:8080
```

`VITE_API_BASE_URL`이 HTTP(S) 주소이면 채팅 클라이언트는 같은 호스트의 `/ws-chat`을 WS(S) 주소로 변환해 사용합니다. 값이 비어 있으면 HTTP와 WebSocket 모두 현재 프론트엔드 호스트를 기준으로 요청합니다.

### 명령어

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | Vite 개발 서버 실행 |
| `npm run build` | 배포용 정적 파일을 `dist/`에 생성 |
| `npm run preview` | 빌드 결과 로컬 미리보기 |
| `npm run lint` | ESLint 검사 |
| `npm test` | Vitest 단위·컴포넌트 테스트 1회 실행 |
| `npm run test:watch` | Vitest watch 모드 실행 |
| `npm run test:e2e` | Playwright E2E 테스트 실행 |

## 프로젝트 구조

```text
.
├── assets/                 # 로고, 기본 이미지, 아이콘
├── docs/                   # API, 아키텍처, 채팅 설계 문서
├── e2e/                    # Playwright E2E 테스트
├── legacy/                 # React 이전 HTML/JavaScript 구현
├── src/
│   ├── app/                # Provider와 Router 조립, Route Guard
│   ├── layouts/            # 인증·앱 공통 화면 골격과 Header
│   ├── pages/              # 라우트 단위 화면 조합과 화면 이동
│   ├── features/           # 도메인 컴포넌트, hook, service, validation
│   │   ├── articles/       # 게시글 목록·상세·편집
│   │   ├── auth/           # 인증 상태와 로그인·로그아웃
│   │   ├── chat/           # 채팅 세션, 목록, STOMP 통신
│   │   ├── comments/       # 댓글 목록·작성·삭제
│   │   ├── images/         # 이미지 업로드
│   │   └── user/           # 회원가입과 사용자 설정
│   ├── shared/             # HTTP, session, 공통 UI·hook·오류·유틸리티
│   └── test/               # 테스트 설정, fixture, 공통 renderer
├── Dockerfile              # 프론트엔드 컨테이너 이미지
├── nginx.conf              # 정적 파일과 API·WebSocket reverse proxy 설정
└── vite.config.js          # Vite와 Vitest 설정
```

현재 앱의 의존 방향은 다음과 같습니다.

```text
app → layouts/pages → features → shared
```

- `app`은 전역 Provider와 Router를 조립합니다.
- `layouts`와 `pages`는 공통 골격 및 route 단위 화면을 구성합니다.
- `features`는 도메인 UI, 상태를 다루는 use-case hook, API service를 소유합니다.
- `shared`는 특정 도메인에 의존하지 않는 통신·세션·공통 UI 기반을 제공합니다.

하위 계층은 상위 계층을 참조하지 않습니다. 이 의존 규칙은 ESLint로 검사합니다.

`legacy/`는 이전 구현을 참고하거나 롤백할 때 사용하는 보관 영역이며 현재 Vite 빌드와 lint 대상에는 포함되지 않습니다.

## 라우트

| 접근 | 경로 | 페이지 | 역할 |
| --- | --- | --- | --- |
| 공통 | `/` | `RootRoute` | 인증 상태에 따라 `/posts` 또는 `/login`으로 이동 |
| 비회원 전용 | `/login` | `LoginPage` | 로그인 및 원래 접근 경로 복귀 |
| 비회원 전용 | `/signup` | `SignupPage` | 회원가입 |
| 로그인 필요 | `/posts` | `PostListPage` | 게시글 목록과 무한 스크롤 |
| 로그인 필요 | `/posts/new` | `PostCreatePage` | 게시글 작성 |
| 로그인 필요 | `/posts/:articleId` | `PostDetailPage` | 게시글 상세, 좋아요, 댓글, 작성자 DM |
| 로그인 필요 | `/posts/:articleId/edit` | `PostEditPage` | 게시글 수정 |
| 로그인 필요 | `/settings/profile` | `ProfileEditPage` | 프로필 변경 |
| 로그인 필요 | `/settings/password` | `PasswordEditPage` | 비밀번호 변경 |
| 로그인 필요 | `/chats` | `ChatListPage` | 채팅방 목록과 안 읽은 상태 |
| 로그인 필요 | `/chats/:roomId` | `ChatRoomPage` | 채팅방 전체 화면 |
| 로그인 필요 | `*` | `NotFoundPage` | 일치하는 보호 라우트가 없을 때 표시 |

`PublicOnlyRoute`는 로그인한 사용자가 로그인·회원가입 화면에 접근하면 게시글 목록 또는 안전하게 검증된 `returnTo` 경로로 이동시킵니다. `ProtectedRoute`는 인증 확인 중에는 대기 화면을 표시하고, 비회원이면 현재 URL을 `returnTo`에 담아 로그인 화면으로 이동시킵니다.

## 컴포넌트 구조

### 전체 계층

```text
main.jsx
└── AppProviders
    └── ToastProvider
        └── AuthProvider
            └── ChatProvider
                └── ChatUnreadProvider
                    └── ChatSessionProvider
                        ├── RouterProvider
                        │   ├── RootRoute
                        │   ├── PublicOnlyRoute
                        │   │   └── AuthLayout
                        │   │       ├── LoginPage
                        │   │       └── SignupPage
                        │   └── ProtectedRoute
                        │       └── AppLayout
                        │           ├── Header
                        │           │   ├── ChatNotificationButton
                        │           │   └── AccountMenu
                        │           └── Outlet
                        │               ├── 게시글 페이지
                        │               ├── 사용자 설정 페이지
                        │               └── 채팅 페이지
                        └── ChatModalHost
                            └── ChatModal
```

- `ToastProvider`는 화면 전역 알림을 제공합니다.
- `AuthProvider`는 현재 사용자와 인증 상태를 관리하고 HTTP client에 token refresh 및 unauthorized handler를 등록합니다.
- `ChatUnreadProvider`는 전체 안 읽은 메시지 수를 관리합니다.
- `ChatSessionProvider`는 현재 대화 세션을 관리하고, 게시글 화면에서 여는 채팅 modal을 앱 전역에 배치합니다.
- `RouterProvider`는 인증 상태별 route와 layout을 선택합니다.

### 페이지, hook, service의 역할

```text
Page
├── Feature component      # 도메인 UI
└── Use-case hook          # 화면 상태와 요청 흐름
    ├── Feature service    # endpoint와 DTO mapping
    │   └── HTTP client    # 인증, 재시도, 오류 변환
    └── Shared             # 공통 hook, component, utility
```

페이지는 API 호출 순서를 직접 조합하지 않습니다. 화면 상태와 여러 요청의 흐름은 feature hook이 담당하고, endpoint 및 서버 DTO 변환은 feature service가 담당합니다. 공통 HTTP 처리, cursor pagination, dialog, toast, avatar 같은 기반은 `shared`에서 제공합니다.

### 인증·사용자 도메인

```text
AuthProvider
├── authService
│   ├── login
│   ├── refreshAccessToken
│   └── logout
├── LoginPage
└── Route Guard
    ├── RootRoute
    ├── PublicOnlyRoute
    ├── ProtectedRoute
    └── AuthStatusFallback

SignupPage
├── useSignup
├── SignupForm
│   └── ProfileImagePicker
├── userService
└── imageService

ProfileEditPage
├── useProfileEdit
├── ProfileEditForm
│   └── ProfileImagePicker
├── ConfirmDialog
└── userService / imageService

PasswordEditPage
├── PasswordEditForm
└── userService
```

`AuthProvider`는 앱 시작 시 인증을 확인하고 현재 사용자를 전역에 제공합니다. 회원가입과 사용자 설정 페이지는 form component에 입력 UI를 맡기고, hook 또는 page에서 검증·업로드·API 요청과 성공 후 이동을 조정합니다.

### 게시글·댓글·이미지 도메인

```text
PostListPage
├── useArticleList
│   ├── useCursorPagination
│   └── articleService
├── PostCard
└── InfiniteScrollTrigger

PostDetailPage
├── useArticleDetail
│   └── articleService
├── ImageGallery
├── PostStats
├── PostActions
│   └── ConfirmDialog
└── CommentSection
    ├── useComments
    ├── CommentForm
    ├── CommentItem
    └── commentService

PostCreatePage / PostEditPage
└── PostForm
    ├── MultiImagePicker
    ├── imageService
    └── articleService
```

게시글 목록은 공통 cursor pagination을 이용해 첫 로딩과 추가 로딩을 분리합니다. 상세 페이지는 게시글 정보와 좋아요 상태를 관리하고, `CommentSection`은 댓글 조회·작성·수정·삭제를 묶어 게시글의 댓글 수를 갱신합니다. 작성·수정 form은 이미지 선택과 업로드를 마친 뒤 게시글 요청을 전달합니다.

### 채팅 도메인

```text
ChatProvider
├── ChatUnreadProvider
│   ├── useUnreadMessages
│   └── ChatNotificationButton
└── ChatSessionProvider
    ├── useChatSession
    │   ├── chatSessionReducer
    │   ├── chatService
    │   ├── chatSocket
    │   └── chatMessageModel
    └── ChatModalHost
        └── ChatModal
            ├── ChatModalHeader
            └── ChatConversation

ChatListPage
├── useChatList
│   ├── useCursorPagination
│   └── chatService
└── ChatListContent
    └── ChatRoomCard

ChatRoomPage
├── ChatSessionContext
├── useChatReadReceipt
└── ChatConversation
    ├── ChatSessionFeedback
    ├── MessageList
    │   └── MessageBubble
    └── MessageComposer
```

채팅 목록은 cursor pagination으로 채팅방을 조회합니다. 대화 UI는 modal과 전체 화면에서 `ChatConversation`을 함께 사용하고, 연결·구독·메시지 병합·읽음 상태는 `ChatSessionContext`와 관련 hook이 관리합니다.

### 공통 기반

```text
shared
├── api
│   ├── httpClient
│   ├── ApiError
│   └── contracts
├── session
│   └── tokenStore
├── hooks
│   └── useCursorPagination
├── components
│   ├── Avatar
│   ├── ConfirmDialog
│   ├── InfiniteScrollTrigger
│   └── Toast / ToastContext
├── errors
│   └── errorMessages
└── lib
    ├── formatArticle
    └── getSafeReturnTo
```

`shared`는 어느 도메인에도 종속되지 않습니다. feature는 이 계층의 통신, 세션, 공통 UI와 유틸리티를 재사용합니다.

## 동작 흐름

### 앱 시작과 인증

- 앱 시작 시 refresh cookie로 access token을 갱신하고 `GET /users/me`로 현재 사용자를 조회합니다.
- 인증되면 요청한 보호 화면을 표시하며, `/` 접근은 `/posts`로 이동합니다.
- 비회원은 `returnTo`를 포함한 로그인 화면으로 이동하고, 로그인 후 원래 경로로 복귀합니다.
- token refresh가 401로 실패하면 비회원 상태로 전환하고, 그 외 초기화 오류는 한 번 재시도합니다.

### 게시글과 댓글

- 목록 진입 시 첫 페이지를 조회하고, 목록 끝에서는 마지막 `articleId`를 cursor로 다음 페이지를 불러옵니다.
- 상세 화면은 게시글과 댓글을 조회하고 조회 수, 좋아요, 댓글 수를 사용자 동작에 맞춰 갱신합니다.
- 작성·수정 시 입력을 검증하고 이미지를 먼저 업로드한 뒤 게시글 데이터를 저장합니다.
- 삭제는 확인 dialog의 승인을 받은 후 처리하고 목록으로 이동합니다.

### 작성자에게 DM 보내기

- 다른 사용자의 작성자 영역을 선택하면 기존 채팅 세션을 정리하고 `ChatModal`을 엽니다.
- HTTP API로 1:1 채팅방을 조회하거나 생성한 뒤 STOMP 연결과 메시지 초기화를 진행합니다.
- 본인의 게시글에는 DM 동작을 노출하지 않습니다.
- 채팅 목록에서 방을 선택하면 `/chats/:roomId`에서 같은 대화 UI를 전체 화면으로 표시합니다.

### 채팅방 연결과 메시지

- HTTP로 채팅방을 결정한 뒤 WebSocket에 연결하고 인증, 오류, 현재 채팅방 destination을 구독합니다.
- 구독 후 HTTP로 이전 메시지를 조회하여 먼저 도착한 실시간 메시지와 병합합니다.
- 전송 시 `clientMessageId` 기반 임시 메시지를 표시하고, 서버 메시지는 `messageId`와 함께 병합합니다.
- 읽은 마지막 메시지를 STOMP로 전달하고, 읽음 event 수신 후 전체 안 읽은 수를 갱신합니다.
- HTTP는 방·이력·안 읽은 수 조회를, STOMP는 메시지·읽음·오류 event를 담당합니다.

### HTTP 401 재시도

- 인증 요청이 401을 반환하면 access token을 갱신하고 원래 요청을 한 번 재시도합니다.
- 여러 요청이 동시에 401을 받아도 하나의 refresh Promise를 공유합니다.
- refresh 또는 재시도가 401로 실패하면 token을 제거하고 비회원 상태로 전환합니다.
- 401이 아닌 오류는 호출한 feature에 전달합니다.

## 테스트

- **Vitest**는 service의 요청·응답 mapping, validation, reducer, 공통 hook과 유틸리티를 검증합니다.
- **Testing Library**는 Provider와 페이지·컴포넌트를 사용자 관점에서 검증합니다.
- **MSW**는 테스트에서 HTTP API 응답을 격리합니다.
- **Playwright**는 Vite 앱을 실제 브라우저에서 실행해 인증 이동, 게시글 상호작용, 사용자 설정 같은 주요 흐름을 검증합니다.

전체 검증은 다음 순서로 실행할 수 있습니다.

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

Playwright는 `http://127.0.0.1:5173`에서 개발 서버를 자동으로 시작하며 Chromium 프로젝트를 사용합니다. 필요한 브라우저가 없다면 먼저 Playwright의 Chromium을 설치해야 합니다.

```bash
npx playwright install chromium
```
