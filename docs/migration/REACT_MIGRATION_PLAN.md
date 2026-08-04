# 하비루프 React 마이그레이션 계획

## 0. 문서 사용 방법

이 문서는 바닐라 JavaScript 다중 페이지 애플리케이션을 React SPA로 전환하기 위한 최상위 계획서다. AI와 작업자는 아래 순서로 문서를 읽는다.

1. `REACT_MIGRATION_PLAN.md`: 범위, 구조, 순서, 완료 기준을 확인한다.
2. [`../API_SPEC.md`](../API_SPEC.md): endpoint, 요청/응답, 인증 여부를 확인한다.
3. 작업별 문서: 해당 단계의 상세 구현 지시를 확인한다. 인증 작업은 [`tasks/auth-migration.md`](tasks/auth-migration.md)를 사용한다.

문서가 충돌하면 다음 우선순위를 적용한다.

1. `../API_SPEC.md`의 확정된 API 계약
2. `tasks/*.md`의 해당 작업 상세 지시
3. 이 문서의 전체 계획
4. 현재 레거시 코드의 실제 동작

### AI 실행 규칙

- JavaScript와 JSX만 사용한다. TypeScript, `.ts`, `.tsx` 파일을 만들지 않는다.
- TanStack Query, Redux 같은 상태 관리 라이브러리를 사용하지 않는다.
- 서버 데이터는 일반 `fetch` 기반 service 함수와 `useState`, `useEffect`로 관리한다.
- API 경로와 응답 필드를 추측하지 않는다. 불명확하면 `../API_SPEC.md`의 `확정 필요` 항목으로 남긴다.
- 한 번에 한 단계 또는 한 페이지를 변경한다. 관련 없는 리팩터링을 함께 수행하지 않는다.
- 기존 문구, CSS class, 접근성 속성, fallback 이미지를 최대한 유지한다.
- 레거시 결함은 그대로 복사하지 않고 이 문서의 “선행 해결 항목”에 따라 수정한다.
- 작업 완료 전 lint, unit test, build와 해당 사용자 시나리오를 검증한다.

---

## 1. 목표와 범위

### 목표

- HTML별로 흩어진 DOM 조작과 이벤트 처리를 React 컴포넌트와 상태로 전환한다.
- HTML 파일 이동을 React Router 기반 클라이언트 라우팅으로 전환한다.
- 인증, API 호출, 폼, 일시적 UI 상태의 책임을 분리한다.
- 로딩, 빈 결과, 오류, 재시도, 권한 상태를 실제로 동작하게 만든다.
- 핵심 사용자 흐름을 자동 테스트할 수 있게 만든다.

### 포함 범위

- `../../index.html`, `pages/`, `js/`, `../../css`, `../../assets`의 프런트엔드 전체
- 로그인, 회원가입, 로그아웃과 refresh cookie 기반 인증
- 게시글 목록/상세/작성/수정/삭제, 좋아요, 조회수
- 댓글/대댓글 목록과 작성/수정/삭제
- 프로필, 비밀번호 수정과 회원 탈퇴
- 기존 UI와 반응형 스타일 유지

### 제외 범위

- 백엔드 API 구현 변경
- 대규모 UI 리디자인
- SSR, 모바일 앱, 전역 상태 관리 라이브러리 도입
- API 명세에 없는 기능의 임의 추가

### 확정된 기술 결정

| 구분 | 결정 |
| --- | --- |
| 빌드 | Vite |
| UI | React + JavaScript/JSX |
| 라우팅 | React Router |
| API | 일반 `fetch`를 감싼 공통 client와 도메인별 service |
| 인증 전역 상태 | React Context |
| 페이지 데이터 | 페이지 또는 feature hook의 `useState`, `useEffect` |
| 폼 | controlled input과 순수 validation 함수 |
| 테스트 | Vitest, React Testing Library, MSW, Playwright |
| 스타일 | 1차로 기존 CSS와 class 재사용 |

---

## 2. 기존 프로젝트 분석

### 2.1 현재 구조

| 구분 | 현재 상태 | React 전환 |
| --- | --- | --- |
| 실행 | 빌드 도구 없는 정적 다중 페이지 | Vite React SPA |
| 언어 | ES Module JavaScript | JavaScript + JSX 유지 |
| 라우팅 | HTML 경로와 `window.location` | React Router |
| DOM | `querySelector`, `createElement`, class 토글 | state와 props 기반 렌더링 |
| API | `js/common/fetch.js` 함수 모음 | 공통 client + 도메인 service |
| 인증 | 메모리 access token + refresh cookie | AuthContext + 메모리 token |
| 데이터 | 페이지 모듈 전역 변수 | 페이지/feature hook 로컬 state |
| 폼 | input 이벤트와 직접 검증 | controlled input + 공통 validation |
| 스타일 | 전역/페이지별 CSS | 기존 CSS 우선 재사용 |
| 테스트 | 없음 | unit/component/E2E 구성 |
| 설정 | API 주소 `localhost:8080` 고정 | `VITE_API_BASE_URL` |

현재 `../../package.json`은 주석이 포함되어 유효한 JSON이 아니며 실행, 빌드, 테스트 script가 없다. 첫 단계에서 정상화한다.

### 2.2 구현 상태 기준

| 상태 | 의미 | 마이그레이션 기준 |
| --- | --- | --- |
| 정상 | 주요 정상 흐름이 연결되어 있음 | React에서 기능 동등성 유지 |
| 부분 구현 | 일부 정상 흐름만 동작하거나 상태 처리가 빠짐 | 누락 상태를 완성한 뒤 이관 |
| 미연결 | 마크업은 있으나 이벤트/API 연결이 없음 | React 구현에서 실제 동작 연결 |
| 결함 | 런타임 오류 또는 데이터 손실 가능성이 있음 | 레거시 동작을 복사하지 않고 수정 |

### 2.3 현재 페이지와 주요 기능

| 페이지 | 주요 기능 | 상태 | 확인된 제한/결함 | 목표 route |
| --- | --- | --- | --- | --- |
| `../../index.html` | 로그인 HTML로 즉시 이동 | 정상 | 인증 상태와 무관하게 로그인으로 이동 | `/` |
| `pages/auth/login.html` | 입력 검증, 로그인, token 저장 | 결함 | 실패 응답의 `data.token`에 접근 가능, loading/error 처리가 불완전 | `/login` |
| `pages/auth/signup.html` | 이미지 preview/upload, 입력 검증, 가입 | 결함 | 실패 시 Error를 throw하지 않음, 중복 검사는 주석뿐임 | `/signup` |
| `pages/posts/list.html` | 카드 목록, cursor 무한 스크롤, 빈/오류 UI | 부분 구현 | 재시도 버튼 미연결, template 미사용, 응답 이미지 필드가 불명확 | `/posts` |
| `pages/posts/detail.html` | 상세, gallery, 좋아요, 조회수, 댓글 목록/CRUD | 부분 구현 | 상세/댓글 재시도 미연결, 댓글 변경 후 UI 미갱신, 초기 좋아요/권한 상태 미연결 | `/posts/:articleId` |
| `pages/posts/create.html` | 제목/내용, 여러 이미지 preview/upload, 작성 | 결함 | 업로드 실패가 정상 응답처럼 처리될 수 있음 | `/posts/new` |
| `pages/posts/edit.html` | 상세 로딩, 내용/이미지 수정 | 결함 | 기존 이미지가 요청에서 제외되어 소실될 수 있음 | `/posts/:articleId/edit` |
| `pages/user/profile-edit.html` | 내 정보, 이미지/닉네임 수정, 탈퇴, toast | 결함 | `uploadProfileImageRequest` import 누락 | `/settings/profile` |
| `pages/user/password-edit.html` | 비밀번호 검증/수정, toast | 부분 구현 | 요청 오류 UI와 복구 흐름이 불완전 | `/settings/password` |

### 2.4 공통 기능 현황

- 보호 페이지는 진입 시 `refreshAccessToken()`을 각각 호출한다.
- `account-menu.js`가 보호 페이지마다 내 프로필을 별도로 조회한다.
- access token은 메모리에 있고 refresh token은 cookie를 사용하는 구조다.
- 목록은 `lastArticleId`, 댓글은 `lastCommentId`와 `lastParentCommentId` cursor를 사용한다.
- 대댓글은 `parentCommentId`가 있는 항목을 들여쓰기하여 표시하지만 작성 UI는 없다.
- 오류/재시도 마크업 중 일부는 JavaScript 이벤트가 연결되지 않았다.
- 날짜, 숫자, 폼 field 검증 코드가 여러 페이지에 중복되어 있다.

### 2.5 선행 해결 항목

| 우선순위 | 항목 | React 구현 기준 |
| --- | --- | --- |
| P0 | 로그인 실패 응답 접근 오류 | 성공 여부를 먼저 검사하고 실패는 `ApiError`로 처리 |
| P0 | helper가 Error 객체를 반환 | API 실패는 항상 throw |
| P0 | 프로필 이미지 upload 함수 import 누락 | API service에서 올바르게 import/export |
| P0 | 게시글 수정 시 기존 이미지 소실 | 유지/삭제/신규 URL을 구분해 서버 계약대로 전송 |
| P0 | 가입 전/로그인 후 프로필 upload가 같은 endpoint 사용 | `../API_SPEC.md`에서 인증 요구사항 확인 후 구현 |
| P1 | 인증 실패 redirect 비활성화 | 명시된 인증 상태 전이와 route guard 구현 |
| P1 | 댓글 변경 후 UI 미갱신 | 성공 후 로컬 state 갱신 또는 목록 재조회 |
| P1 | 소유권과 초기 좋아요 상태 미연결 | 서버 응답의 확정된 필드만 사용 |
| P1 | retry 버튼 미연결 | 오류 state에서 동일 조회 함수를 다시 실행 |
| P1 | 제목/내용 필수 조건 불일치 | API/기획 계약을 공통 validation으로 구현 |
| P1 | 대댓글 작성 기능 없음 | 답글 버튼과 대댓글 폼을 새로 구현 |
| P2 | window scroll 기반 pagination | `IntersectionObserver` trigger로 교체 |
| P2 | URL `id` 검증 없음 | route param 검증 후 404 표시 |

---

## 3. 목표 라우팅과 구조

### 3.1 라우팅

```text
/
├── login                         PublicOnlyRoute
├── signup                        PublicOnlyRoute
├── posts                         ProtectedRoute + AppLayout
│   ├── new
│   └── :articleId
│       └── edit
└── settings                      ProtectedRoute + AppLayout
    ├── profile
    └── password
```

- `/`는 인증 확인 완료 후 `/posts` 또는 `/login`으로 이동한다.
- 보호 route에서만 anonymous 사용자를 `/login`으로 이동시킨다.
- 인증 완료 전에는 route redirect를 실행하지 않는다.
- 잘못된 route와 존재하지 않는 게시글은 서로 다른 404 UI로 처리한다.
- 배포 서버는 SPA deep link를 `../../index.html`로 rewrite해야 한다.

### 3.2 디렉터리 구조

```text
src/
├── app/
│   ├── App.jsx
│   ├── router.jsx
│   ├── providers.jsx
│   └── routes/
│       ├── ProtectedRoute.jsx
│       └── PublicOnlyRoute.jsx
├── layouts/
│   ├── AppLayout.jsx
│   └── AuthLayout.jsx
├── pages/
│   ├── LoginPage.jsx
│   ├── SignupPage.jsx
│   ├── PostListPage.jsx
│   ├── PostDetailPage.jsx
│   ├── PostCreatePage.jsx
│   ├── PostEditPage.jsx
│   ├── ProfileEditPage.jsx
│   ├── PasswordEditPage.jsx
│   └── NotFoundPage.jsx
├── features/
│   ├── auth/
│   ├── user/
│   ├── articles/
│   ├── comments/
│   └── images/
├── shared/
│   ├── api/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── styles/
└── assets/
```

도메인 폴더는 필요에 따라 다음 파일을 가진다.

```text
features/articles/
├── articleService.js
├── articleValidation.js
├── useArticleList.js
├── useArticleDetail.js
└── components/
```

- `*Service.js`: API 호출만 담당한다.
- `use*.js`: `useState`, `useEffect`로 로딩/데이터/오류와 재조회 함수를 제공한다.
- component는 service를 직접 호출하지 않고 page 또는 feature hook이 전달한 값과 callback을 사용한다.

---

## 4. 컴포넌트 구조와 역할

### 4.1 전체 구조

```text
AppProviders
└── AuthProvider
    └── RouterProvider
        ├── AuthLayout
        │   ├── LoginPage > LoginForm
        │   └── SignupPage > SignupForm > ProfileImagePicker
        └── ProtectedRoute
            └── AppLayout
                ├── Header > AccountMenu
                └── Outlet
                    ├── PostListPage
                    │   └── PostList > PostCard + InfiniteScrollTrigger
                    ├── PostDetailPage
                    │   ├── PostHeader + ImageGallery + PostActions + PostStats
                    │   └── CommentSection
                    │       ├── CommentForm
                    │       └── CommentList
                    │           └── CommentItem
                    │               ├── ReplyButton + ReplyForm
                    │               └── CommentEditForm
                    ├── PostCreatePage / PostEditPage > PostForm > MultiImagePicker
                    ├── ProfileEditPage > ProfileEditForm + ConfirmDialog
                    └── PasswordEditPage > PasswordEditForm
```

### 4.2 공통 컴포넌트

| 컴포넌트 | 역할 | 상태 소유 |
| --- | --- | --- |
| `ProtectedRoute` | checking fallback, anonymous 로그인 이동 | AuthContext 읽기 |
| `PublicOnlyRoute` | checking fallback, authenticated `/posts` 이동 | AuthContext 읽기 |
| `AppLayout` | 보호 화면의 Header와 Outlet | 공통 layout |
| `Header` | 로고, 선택적 뒤로가기, 계정 메뉴 | current user |
| `AccountMenu` | 메뉴 열기/닫기, 설정 이동, logout | 로컬 `isOpen` |
| `Button` | variant, disabled, loading 표시 | props |
| `FormField` | label, helper/error, ARIA 연결 | props |
| `Avatar` | 프로필 이미지와 fallback | props |
| `ConfirmDialog` | 삭제/탈퇴 확인과 focus 복귀 | open/pending props |
| `Toast` | 성공/오류 알림 | 가까운 page state |
| `AsyncState` | loading/empty/error/retry | page 또는 feature hook state |
| `InfiniteScrollTrigger` | 다음 cursor 요청 | observer 로컬 state |

### 4.3 도메인 컴포넌트

| 컴포넌트 | 역할 | 주의사항 |
| --- | --- | --- |
| `LoginForm` | 검증, 로그인 submit, 서버 오류 표시 | 성공 시 AuthContext action 호출 |
| `SignupForm` | 가입 필드와 이미지 upload/가입 순서 조정 | upload 성공 URL을 저장해 동일 시도에서 재사용 |
| `PostList` | 현재까지 받은 게시글 렌더링 | 중복 ID를 추가하지 않음 |
| `PostCard` | 대표 이미지, 제목, 통계, 작성자 | API mapper 결과만 사용 |
| `ImageGallery` | 0/1/N 이미지 slide 제어 | 로컬 `activeIndex` |
| `PostActions` | 작성자에게 수정/삭제 제공 | 서버 권한 검증도 유지 |
| `PostStats` | 좋아요/조회수/댓글 수 | 성공 후 현재 상세 state 갱신 |
| `PostForm` | 작성/수정 공통 폼 | mode와 초기값을 props로 받음 |
| `MultiImagePicker` | 기존/신규 이미지, 제거, preview URL 정리 | 파일 변경/unmount 시 URL 해제 |
| `CommentSection` | 댓글 목록과 변경 후 state 조정 | 댓글/대댓글을 같은 배열로 관리 |
| `CommentForm` | 최상위 댓글 작성 | `parentCommentId: null` 전달 |
| `ReplyButton` | 해당 댓글의 대댓글 폼 열기/닫기 | 삭제 댓글에는 표시하지 않음 |
| `ReplyForm` | 대댓글 입력/등록/취소 | 대상 `commentId`를 `parentCommentId`로 전달 |
| `CommentItem` | 댓글/대댓글/삭제/편집 상태 표시 | 대댓글 여부에 따라 기존 `is-reply` class 유지 |
| `ProfileEditForm` | 내 정보 수정 | 성공 후 AuthContext의 current user 갱신 |
| `PasswordEditForm` | 비밀번호 변경 | 성공 후 입력 초기화와 toast |

---

## 5. 상태와 데이터 흐름

### 5.1 상태 소유 원칙

| 상태 | 소유 위치 | 구현 |
| --- | --- | --- |
| 인증 상태/token/current user | AuthContext | `useState`, 메모리 token store |
| route와 `articleId`, `returnTo` | React Router | param/search/location |
| 게시글 목록과 cursor | `PostListPage` 또는 `useArticleList` | `useState`, `useEffect` |
| 상세 게시글 | `PostDetailPage` 또는 `useArticleDetail` | `useState`, `useEffect` |
| 댓글 목록과 cursor | `CommentSection` 또는 `useComments` | `useState`, `useEffect` |
| 폼 값과 오류 | 각 Form | controlled input `useState` |
| 메뉴/모달/gallery/reply/edit | 가장 가까운 컴포넌트 | 로컬 `useState` |
| 파일과 object URL | image picker | 로컬 state + effect cleanup |

전역 서버 데이터 cache를 만들지 않는다. route 이동 후 필요한 데이터는 다시 조회한다. 데이터 변경 후에는 현재 화면의 로컬 state를 직접 바꾸거나 동일 조회 함수를 다시 실행한다.

### 5.2 공통 조회 상태

각 조회 hook 또는 page는 다음 값을 가진다.

```js
const [data, setData] = useState(null);
const [status, setStatus] = useState('idle'); // idle | loading | success | empty | error
const [error, setError] = useState(null);
```

조회 함수는 다음 순서를 따른다.

1. `status = loading`, `error = null`
2. service 함수 호출
3. 응답 정규화 후 `data` 저장
4. 결과가 비었으면 `empty`, 있으면 `success`
5. 실패하면 `error`와 오류 객체 저장
6. retry 버튼은 같은 조회 함수를 다시 호출
7. effect cleanup에서 `AbortController.abort()` 실행

### 5.3 변경 요청 후 화면 처리

| 작업 | 성공 후 처리 | 실패 후 처리 |
| --- | --- | --- |
| 로그인 | AuthContext를 authenticated로 변경하고 안전한 `returnTo`로 이동 | 입력 유지, form 오류 |
| 프로필 수정 | current user와 현재 form 초기값 갱신, toast | 입력 유지, 오류 표시 |
| 게시글 작성 | `/posts/:articleId`로 이동 | 입력/선택 파일 유지 |
| 게시글 수정 | 상세 route로 이동 | 입력/이미지 선택 유지 |
| 게시글 삭제 | 목록 route로 이동 | dialog 유지, 오류 표시 |
| 좋아요 | 현재 상세의 `likedByMe`, count 갱신 | 기존 표시 유지, 오류 알림 |
| 댓글/대댓글 작성 | 응답 항목을 목록에 추가하거나 댓글 목록 재조회, 입력 닫기/초기화 | 입력 유지 |
| 댓글 수정 | 해당 ID 항목 text 교체 또는 목록 재조회 | 편집 모드 유지 |
| 댓글 삭제 | 해당 항목을 삭제 상태로 교체 또는 목록 재조회 | dialog 유지 |
| logout/탈퇴 | 인증 정보 초기화 후 로그인 이동 | 현재 상태 유지, 오류 표시 |

목록 화면은 route 재진입 시 다시 조회하므로 별도의 전역 동기화를 하지 않는다. 상세 화면에 표시되는 댓글 수는 댓글 작업 성공 직후 함께 갱신하거나 상세를 재조회한다.

### 5.4 인증 상태 전이

인증 상세 구현은 [`tasks/auth-migration.md`](tasksuth-migration.md)를 따른다.

```text
앱 시작
  └─ checking
      ├─ refresh 성공 ──────────> authenticated
      └─ refresh 401 ───────────> anonymous

authenticated
  ├─ logout 성공/회원 탈퇴 성공 -> anonymous
  └─ 보호 API 재시도도 401 ────> anonymous

anonymous
  └─ login 성공 ───────────────> authenticated
```

필수 규칙:

- checking 완료 전에는 redirect하지 않는다.
- 보호 페이지에서만 anonymous를 `/login`으로 이동한다.
- 공개 페이지의 refresh 401은 정상적인 비로그인 상태다.
- `returnTo`는 동일 origin이며 `/`로 시작하는 내부 경로만 허용한다.
- `//external.example`, 다른 origin, 잘못된 URL은 `/posts`로 대체한다.
- 동시에 발생한 refresh 요청은 하나의 Promise를 공유한다.
- 보호 API의 401은 refresh 후 한 번만 재시도한다.

### 5.5 목록과 cursor

- 게시글: `items`, `lastArticleId`, `hasNext`, `isLoadingMore`를 로컬 state로 관리한다.
- 댓글: `items`, `lastCommentId`, `lastParentCommentId`, `hasNext`, `isLoadingMore`를 로컬 state로 관리한다.
- 첫 조회와 추가 조회 오류를 구분한다.
- 추가 결과를 붙일 때 ID가 같은 항목은 중복 추가하지 않는다.
- `IntersectionObserver`는 `hasNext && !isLoadingMore`일 때만 다음 조회를 실행한다.

### 5.6 조회수 증가

- 상세 화면이 article을 정상적으로 확인한 뒤 `POST /views/articles/:articleId`를 호출한다.
- 서버에서 멱등성을 보장하므로 React Strict Mode 또는 동일 사용자 중복 요청을 위한 별도 client dedupe를 구현하지 않는다.
- 조회수 요청 실패가 게시글 본문 표시를 막지 않는다.
- 서버가 증가된 count를 응답하면 현재 상세 state에 반영하고, 응답하지 않으면 기존 상세 값을 유지한다.

### 5.7 이미지 upload와 저장 실패

- 이미지 upload 성공 후 받은 URL을 현재 form state에 보관한다.
- 이어지는 가입/게시글 저장이 실패한 경우 같은 파일을 자동으로 다시 upload하지 않는다.
- 사용자가 파일 선택을 변경하면 이전 upload URL을 폐기하고 새 upload를 실행한다.
- 서버의 미사용 파일 만료/삭제 정책은 `../API_SPEC.md`에서 확정 필요 항목으로 관리한다.

---

## 6. 단계별 마이그레이션 순서

각 단계는 별도 PR 또는 되돌릴 수 있는 커밋 단위로 진행한다.

### 0단계. 기준선과 API 계약

작업:

- 8개 화면의 정상/빈 결과/오류 상태 screenshot과 수동 시나리오를 기록한다.
- 실제 API 응답 fixture 또는 OpenAPI를 확보해 `../API_SPEC.md`를 갱신한다.
- 소유권, 좋아요 여부, 이미지 수정, upload 인증, 대댓글 정렬 정책을 확정한다.
- 현재 기능의 정상/부분 구현/미연결/결함 상태를 브라우저와 대조한다.

완료 기준:

- `../API_SPEC.md`에 구현을 막는 미확정 P0 항목이 없다.
- React 결과와 비교할 acceptance checklist가 있다.

### 1단계. React 기반 구성

작업:

- 유효한 `../../package.json`과 Vite React JavaScript scaffold를 구성한다.
- `dev`, `build`, `lint`, `test` script를 만든다.
- Router와 placeholder page, 기본 404, error boundary를 구성한다.
- 기존 CSS/asset import와 각 route의 page class 적용 방식을 정한다.
- `VITE_API_BASE_URL`과 SPA rewrite를 설정한다.

완료 기준:

- 모든 script가 성공한다.
- 모든 목표 route를 직접 열고 새로고침할 수 있다.

### 2단계. 공통 API와 인증

상세 작업은 [`tasks/auth-migration.md`](tasksuth-migration.md)를 따른다.

작업:

- 공통 fetch client, `ApiError`, 응답 parser를 구현한다.
- token store, single-flight refresh와 401 1회 재시도를 구현한다.
- AuthProvider와 route guard를 구현한다.
- 인증 상태 전이와 안전한 `returnTo`를 테스트한다.

완료 기준:

- checking/authenticated/anonymous 상태가 명세대로 전이된다.
- refresh 401이 공개 페이지 오류나 redirect loop를 만들지 않는다.
- 보호 페이지만 로그인으로 이동하며 내부 `returnTo`가 보존된다.

### 3단계. 공통 UI와 layout

작업:

- `AuthLayout`, `AppLayout`, `Header`, `AccountMenu`를 구현한다.
- `Button`, `FormField`, `Avatar`, `ConfirmDialog`, `Toast`, `AsyncState`를 구현한다.
- 메뉴/dialog focus, ARIA, 이미지 fallback을 검증한다.

완료 기준:

- 헤더는 AuthContext의 current user를 사용한다.
- 메뉴와 dialog를 키보드로 사용할 수 있다.

### 4단계. 인증 화면

순서: 로그인 → 회원가입.

작업:

- regex를 순수 JavaScript validation 함수로 옮긴다.
- controlled input으로 로그인/회원가입 폼을 구현한다.
- 로그인 실패, upload 실패, 가입 실패 상태를 실제 UI에 연결한다.

완료 기준:

- 기존 validation 문구와 접근성 연결을 유지한다.
- 실패 시 성공 route로 이동하지 않고 입력을 유지한다.

### 5단계. 게시글/댓글 조회

순서: 게시글 목록 → 상세/gallery → 댓글/대댓글 목록.

작업:

- response mapper와 조회 service를 구현한다.
- 로컬 state 기반 cursor pagination과 retry를 구현한다.
- 상세 404, gallery, 조회수 증가를 구현한다.

완료 기준:

- 첫 로딩, 빈 결과, 오류, retry, 추가 로딩이 구분된다.
- cursor 중복 요청/중복 항목 없이 목록이 이어진다.

### 6단계. 게시글/댓글 변경 기능

순서: 좋아요 → 댓글 → 대댓글 → 게시글 작성 → 수정 → 삭제.

작업:

- 좋아요 성공 후 상세 state를 갱신한다.
- 댓글 CRUD와 답글 버튼/대댓글 폼을 구현한다.
- 대댓글 작성 시 부모 댓글 ID를 `parentCommentId`로 보낸다.
- 작성/수정 공통 `PostForm`과 이미지 upload 흐름을 구현한다.
- 소유권에 따라 action을 표시하고 403을 처리한다.

완료 기준:

- 댓글/대댓글 작업 결과와 댓글 수가 즉시 일치한다.
- 대댓글이 부모 댓글 아래에 기존 `is-reply` 스타일로 표시된다.
- 중복 submit을 막고 실패 시 입력을 보존한다.

### 7단계. 사용자 설정

순서: 프로필 수정/탈퇴 → 비밀번호 수정.

완료 기준:

- 프로필 변경이 AuthContext와 헤더에 즉시 반영된다.
- 비밀번호 변경 성공/실패가 명확히 표시된다.
- 탈퇴 후 인증 정보가 메모리에 남지 않는다.

### 8단계. 회귀 검증과 전환

작업:

- Playwright로 인증, 목록, 게시글 CRUD, 좋아요, 댓글/대댓글 CRUD, 설정을 검증한다.
- 모바일/데스크톱 시각 비교와 접근성 검사를 수행한다.
- staging에서 CORS/cookie, 환경 변수, deep-link rewrite를 확인한다.
- React 진입점 전환 후 관찰 기간을 거쳐 레거시 파일을 제거한다.

완료 기준:

- lint/test/build/E2E가 통과한다.
- P0/P1 회귀가 없다.
- rollback 절차가 준비되어 있다.

---

## 7. AI 작업 목록

| ID | 단계 | 작업 | 필수 입력 | 산출물 | 검증 |
| --- | --- | --- | --- | --- | --- |
| AI-01 | 0 | 실제 응답으로 API 명세 보정 | `fetch.js`, fixture/OpenAPI | `../API_SPEC.md` 갱신 | 백엔드 계약 대조 |
| AI-02 | 1 | Vite React JavaScript scaffold | Node/배포 환경 | 실행 가능한 기반 | lint/test/build |
| AI-03 | 1 | 기존 CSS/asset 경로 전환 | `../../css`, `../../assets` | style entry | route screenshot |
| AI-04 | 2 | 인증 기반 구현 | API 명세, auth task | AuthContext/client/guards | auth task 전체 테스트 |
| AI-05 | 3 | 공통 layout/UI 변환 | 기존 HTML/CSS | shared components | keyboard/ARIA |
| AI-06 | 4 | 로그인 변환 | login HTML/JS | LoginPage/Form | 성공/실패/returnTo |
| AI-07 | 4 | 회원가입 변환 | signup HTML/JS | SignupPage/Form | upload/가입 실패 |
| AI-08 | 5 | 게시글 목록과 cursor | list HTML/JS | page/hook/card | empty/error/retry/paging |
| AI-09 | 5 | 상세/gallery/view count | detail HTML/JS | detail components | 0/1/N 이미지, 404 |
| AI-10 | 5 | 댓글 목록/cursor | comment 코드 | list/item | 삭제/대댓글 순서 |
| AI-11 | 6 | 좋아요 처리 | 상세 API | service/local update | 성공/실패 |
| AI-12 | 6 | 댓글/대댓글 CRUD | 댓글 API, 정렬 정책 | forms/actions | 부모 ID/댓글 수 |
| AI-13 | 6 | 게시글 작성/수정 폼 | create/edit 코드 | PostForm/picker | 이미지 유지/실패 |
| AI-14 | 6 | 게시글 삭제/권한 | 소유권 계약 | action/dialog | 본인/타인/403 |
| AI-15 | 7 | 프로필/비밀번호/탈퇴 | user 코드 | settings pages | 헤더 반영/인증 제거 |
| AI-16 | 8 | E2E와 시각 회귀 | acceptance checklist | Playwright suite | 격리된 test data |
| AI-17 | 8 | 레거시 제거 후보 분석 | 전체 repo | 삭제 목록 | 사람 승인 |

### AI 작업 요청 템플릿

```text
목표: [한 개 단계 또는 한 개 page]를 React JavaScript로 전환한다.
선행 문서: REACT_MIGRATION_PLAN.md, API_SPEC.md, 해당 tasks 문서
참조 코드: [레거시 HTML/JS/CSS]
변경 허용 범위: [파일/디렉터리]
필수 상태: loading / empty / error / retry / success / unauthorized 중 해당 항목
금지: TypeScript, 전역 상태 라이브러리, 서버 데이터 cache 라이브러리, API 필드 추측
필수 테스트: [정상/실패/경계 사례]
완료 보고: 변경 파일, 실행한 검증, 남은 확정 필요 항목
```

---

## 8. 핵심 테스트와 완료 기준

### E2E 사용자 흐름

1. 미인증 deep link → 로그인 → 안전한 원래 경로 복귀
2. 로그인 상태 새로고침 → refresh 성공 → 보호 페이지 유지
3. refresh 401 → 공개 페이지 유지 / 보호 페이지 로그인 이동
4. 회원가입 이미지 있음/없음, upload 실패, 가입 실패
5. 목록 첫 로딩/빈 결과/오류/retry/추가 로딩
6. 게시글 작성 → 상세 → 수정(기존 이미지 유지/삭제/추가) → 삭제
7. 좋아요 성공/실패와 상세 표시 일치
8. 댓글 작성/수정/삭제
9. 답글 버튼 → 대댓글 작성/취소 → 부모 아래 표시
10. 프로필 변경 후 헤더 반영, 비밀번호 변경, logout/탈퇴

### Definition of Done

- JavaScript lint 오류, test 실패 없이 production build가 성공한다.
- 데이터 화면에 loading/empty/error/retry 상태가 실제로 연결되어 있다.
- 처리되지 않은 Promise rejection과 object URL 누수가 없다.
- 마우스 없이 폼, 메뉴, gallery, dialog, 답글 기능을 사용할 수 있다.
- staging에서 API base URL, cookie, CORS, SPA rewrite가 검증된다.
- 레거시 대비 승인되지 않은 기능/반응형/접근성 회귀가 없다.

---

## 9. 위험과 대응

| 위험 | 대응 |
| --- | --- |
| 실제 API 응답과 현재 코드 가정 불일치 | fixture/OpenAPI를 먼저 확정하고 mapper에서 정규화 |
| refresh cookie/CORS가 Vite origin에서 실패 | dev proxy 또는 백엔드 CORS를 2단계 전에 검증 |
| 목록/댓글 cursor 중복 | loading guard와 ID 중복 제거 테스트 |
| 기존 CSS 전역 selector 충돌 | route별 screenshot 비교, page root class 유지 |
| 이미지 upload 후 저장 실패로 고아 파일 발생 | URL 재사용, 파일 변경 시 폐기, 서버 만료 정책 확인 |
| SPA deep link 404 | 배포 rewrite와 모든 route 직접 새로고침 검증 |
| AI가 레거시 결함을 복사 | 2.5의 선행 해결 항목을 매 작업 입력에 포함 |

## 10. 최종 산출물

- React JavaScript SPA
- 갱신된 `../API_SPEC.md`
- 공통 API client와 인증 Context
- 공통 UI와 도메인 컴포넌트
- unit/component/E2E 테스트
- staging 검증 및 배포/rollback checklist
- 승인된 레거시 제거 목록
