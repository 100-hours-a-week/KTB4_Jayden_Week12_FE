# React 초보자를 위한 Hobby Loop 코드 가이드

이 문서는 React를 처음 공부하는 개발자가 Hobby Loop 애플리케이션의 실제 코드를 따라 읽을 수 있도록 작성한 안내서다. 설명만 읽기보다 링크된 파일을 함께 열고, 위에서 아래로 코드를 확인하는 방식을 권장한다.

## 1. 가장 먼저 알아둘 것

이 프로젝트는 다음 방향으로 코드가 흐른다.

```text
브라우저
  ↓
main.jsx
  ↓
App / Provider
  ↓
Router
  ↓
Page
  ↓
Feature Component / Custom Hook
  ↓
Service
  ↓
HTTP Client
  ↓
Backend API
```

각 계층의 역할은 다음과 같다.

| 계층 | 폴더 | 역할 |
| --- | --- | --- |
| 앱 조립 | `../../src/app` | Provider와 Router를 연결한다. |
| 레이아웃 | `../../src/layouts` | 여러 페이지가 공유하는 Header와 화면 골격을 제공한다. |
| 페이지 | `../../src/pages` | URL 하나에 대응하는 화면을 조합한다. |
| 기능 | `../../src/features` | 게시글, 댓글, 인증, 사용자 같은 업무 기능을 구현한다. |
| 공통 | `../../src/shared` | HTTP, session, 공통 UI와 공통 hook을 제공한다. |

의존 방향은 `app → layouts/pages → features → shared`다. 아래 계층인 `shared`가 위 계층인 `features`나 `pages`를 import하면 안 된다.

관련 문서: [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md)

## 2. 추천 코드 읽기 순서

처음부터 모든 파일을 읽지 말고 다음 순서로 읽는다.

1. [main.jsx](../../src/main.jsx)
2. [App.jsx](../../src/app/App.jsx)
3. [providers.jsx](../../src/app/providers.jsx)
4. [router.jsx](../../src/app/router.jsx)
5. [PostDetailPage.jsx](../../src/pages/PostDetailPage.jsx)
6. [useArticleDetail.js](../../src/features/articles/useArticleDetail.js)
7. [articleService.js](../../src/features/articles/articleService.js)
8. [httpClient.js](../../src/shared/api/httpClient.js)

이 순서로 읽으면 “화면이 어떻게 API 요청까지 내려가는지”를 한 번에 볼 수 있다.

## 3. 애플리케이션 시작 과정

### 3.1 `main.jsx`

[main.jsx](../../src/main.jsx)는 React 애플리케이션의 시작점이다.

```jsx
createRoot(document.getElementById('root')).render(<App />);
```

HTML에 있는 `#root` 요소를 찾고 그 안에 `<App />`을 렌더링한다. 여기서 렌더링은 React 컴포넌트가 반환한 JSX를 브라우저 화면에 반영한다는 뜻이다.

### 3.2 Provider 구조

[providers.jsx](../../src/app/providers.jsx)의 구조는 다음과 같다.

```jsx
<ToastProvider>
  <AuthProvider>
    <RouterProvider router={router} />
  </AuthProvider>
</ToastProvider>
```

- `ToastProvider`: 어느 화면에서든 toast를 띄울 수 있게 한다.
- `AuthProvider`: 로그인 상태와 현재 사용자 정보를 제공한다.
- `RouterProvider`: URL에 맞는 페이지를 렌더링한다.

Provider 안쪽에 있는 모든 컴포넌트는 해당 Context의 값을 사용할 수 있다.

## 4. Router와 컴포넌트 구조

[router.jsx](../../src/app/router.jsx)는 URL과 페이지를 연결한다.

```text
RouterProvider
├── /
│   └── RootRoute
├── PublicOnlyRoute
│   └── AuthLayout
│       ├── /login  → LoginPage
│       └── /signup → SignupPage
└── ProtectedRoute
    └── AppLayout
        ├── /posts                  → PostListPage
        ├── /posts/new              → PostCreatePage
        ├── /posts/:articleId       → PostDetailPage
        ├── /posts/:articleId/edit  → PostEditPage
        ├── /settings/profile       → ProfileEditPage
        └── /settings/password      → PasswordEditPage
```

`PublicOnlyRoute`는 로그인하지 않은 사용자만 접근할 수 있다. `ProtectedRoute`는 로그인한 사용자만 접근할 수 있다.

`/posts/:articleId`에서 `:articleId`는 동적으로 바뀌는 URL 값이다. `/posts/12`로 이동하면 `useParams()`를 통해 `articleId` 값 `12`를 읽는다.

## 5. React state 이해하기

state는 화면에 영향을 주는 변경 가능한 값이다.

```jsx
const [status, setStatus] = useState('loading');
```

- `status`: 현재 값
- `setStatus`: 값을 바꾸는 함수
- `'loading'`: 첫 렌더링에서 사용할 초기값

`setStatus('success')`가 실행되면 React는 컴포넌트를 다시 렌더링한다.

### 5.1 이 프로젝트에서 자주 사용하는 요청 상태

```js
status = 'loading'   // 처음 데이터를 불러오는 중
status = 'success'   // 데이터 조회 성공
status = 'empty'     // 성공했지만 목록이 비어 있음
status = 'error'     // 요청 실패
status = 'not-found' // 잘못된 ID 또는 404
```

페이지에서는 다음처럼 상태에 따라 다른 UI를 보여준다.

```jsx
{status === 'loading' && <Loading />}
{status === 'error' && <ErrorMessage />}
{status === 'success' && <Content />}
```

### 5.2 객체 state를 변경하는 방법

기존 객체를 직접 수정하면 안 된다.

```js
// 잘못된 방식
article.likeCount += 1;

// 이 프로젝트에서 사용하는 방식
setArticle((currentArticle) => ({
  ...currentArticle,
  likeCount: currentArticle.likeCount + 1,
}));
```

`...currentArticle`로 기존 값을 복사하고 바꿀 필드만 새 값으로 덮어쓴다.

## 6. 기본 Hook의 의미

### `useState`

화면에 표시될 값을 저장한다.

```js
const [article, setArticle] = useState(null);
```

### `useEffect`

렌더링 이후 API 호출, event listener 등록 같은 외부 작업을 수행한다.

```js
useEffect(() => {
  loadArticle();
  return () => controller.abort();
}, [loadArticle]);
```

return 함수는 컴포넌트가 사라지거나 dependency가 변경되기 전에 실행되는 정리 함수다.

### `useRef`

렌더링 사이에 값을 유지하지만 값이 바뀌어도 다시 렌더링하지 않는다.

```js
const controllerRef = useRef(null);
controllerRef.current = new AbortController();
```

이 프로젝트에서는 다음 용도로 사용한다.

- 중복 제출 방지
- `AbortController` 저장
- 이전 요청 ID 저장
- input 또는 button DOM 접근
- 이미 업로드한 파일 URL 캐시

화면에 보여야 하는 값은 `useState`, 내부 제어용 값은 주로 `useRef`를 사용한다.

### `useCallback`

함수를 렌더링 사이에 재사용한다.

```js
const retry = useCallback(() => loadPage({ reset: true }), [loadPage]);
```

특히 함수를 `useEffect` dependency로 전달하거나 자식 컴포넌트에 전달할 때 사용한다.

### `useMemo`

계산 결과를 재사용한다.

```js
const orderedItems = useMemo(() => orderComments(items), [items]);
```

댓글 목록이 바뀔 때만 정렬을 다시 수행한다.

## 7. 인증 state와 메서드

[AuthContext.jsx](../../src/features/auth/AuthContext.jsx)를 열어 함께 읽는다.

### 7.1 인증 state 형태

```js
{
  status: 'checking' | 'authenticated' | 'anonymous',
  user: null | {
    userId,
    email,
    nickname,
    profileImageUrl,
  },
  bootstrapError: null | Error,
  suppressReturnTo: boolean,
}
```

| state | 의미 |
| --- | --- |
| `status` | 인증 확인 중인지, 로그인 상태인지, 비로그인 상태인지 나타낸다. |
| `user` | 현재 로그인한 사용자다. 로그아웃 상태에서는 `null`이다. |
| `bootstrapError` | 앱 시작 시 인증 확인이 네트워크 오류로 실패했을 때 저장한다. |
| `suppressReturnTo` | 로그아웃·탈퇴 후 이전 보호 페이지로 돌아가지 않게 한다. |

### 7.2 `useAuth()` 반환 메서드

| 메서드 | 의미 |
| --- | --- |
| `login(credentials)` | 로그인 API를 호출하고 현재 사용자까지 조회한다. |
| `logout()` | 로그아웃 API를 호출하고 사용자 state를 비운다. |
| `refreshUser()` | `/users/me`를 다시 조회해서 Header 등의 사용자 정보를 갱신한다. |
| `applyCurrentUser(user)` | 이미 받은 사용자 응답을 Context에 바로 반영한다. |
| `markAnonymous(options)` | token과 사용자 state를 제거한다. |
| `retryBootstrap()` | 앱 시작 인증 확인을 다시 실행한다. |

### 7.3 bootstrap이란?

앱을 새로 열면 access token은 메모리에 없지만 refresh cookie는 브라우저에 남아 있을 수 있다. 따라서 다음 순서가 필요하다.

```text
앱 시작
  → POST /auth/token/refresh
  → 새 access token을 메모리에 저장
  → GET /users/me
  → status = authenticated
```

refresh가 401이면 `anonymous`가 된다. 네트워크 오류나 5xx이면 사용자가 다시 시도할 수 있도록 `checking`과 오류 상태를 유지한다.

## 8. 게시글 상세 Hook 읽기

[useArticleDetail.js](../../src/features/articles/useArticleDetail.js)는 게시글 상세 화면의 핵심 custom hook이다.

### 8.1 입력과 반환값

```js
const detail = useArticleDetail(articleId);
```

입력은 URL에서 읽은 `articleId`다. 반환 형태는 다음과 같다.

```js
{
  article,
  status,
  error,
  retry,
  adjustCommentCount,
  toggleLike,
  isLikePending,
  likeError,
}
```

| 값/메서드 | 의미 |
| --- | --- |
| `article` | 화면에 표시할 게시글 객체다. |
| `status` | 상세 요청 상태다. |
| `error` | 상세 조회 실패 오류다. |
| `retry()` | 상세 조회를 다시 실행한다. |
| `adjustCommentCount(delta)` | 댓글 작성 시 `1`, 삭제 시 `-1`만큼 댓글 수를 바꾼다. |
| `toggleLike()` | 현재 좋아요 상태에 따라 POST 또는 DELETE를 호출한다. |
| `isLikePending` | 좋아요 요청 중 버튼을 비활성화하는 값이다. |
| `likeError` | 좋아요 요청만 실패했을 때 사용하는 오류다. |

### 8.2 게시글 state 형태

```js
article = {
  articleId,
  userId,
  title,
  content,
  imageUrls,
  nickname,
  profileImageUrl,
  createdAt,
  isUpdated,
  likeCount,
  viewCount,
  commentCount,
  likedByMe,
}
```

이 형태는 서버 응답을 그대로 사용하는 것이 아니다. [articleService.js](../../src/features/articles/articleService.js)의 `mapArticleDetail()`이 서버 필드를 화면에서 사용하기 쉬운 이름으로 변환한다.

### 8.3 좋아요 요청에서 ID를 저장하는 이유

좋아요 요청 중 `/posts/12`에서 `/posts/13`으로 이동할 수 있다. 12번 게시글의 늦은 응답이 13번 게시글을 변경하면 안 된다.

따라서 요청 시작 시 `targetArticleId`를 저장하고, 응답 후 현재 게시글 ID와 같은 경우에만 state를 변경한다.

## 9. 목록과 cursor pagination

[useCursorPagination.js](../../src/shared/hooks/useCursorPagination.js)는 게시글 목록과 댓글 목록이 공유하는 hook이다.

### 9.1 입력 형태

```js
useCursorPagination({
  fetchPage,
  getCursor,
  getItemId,
  pageSize,
});
```

| 옵션 | 의미 |
| --- | --- |
| `fetchPage` | 서버에서 한 페이지를 가져오는 함수다. |
| `getCursor` | 마지막 item에서 다음 요청 cursor를 만드는 함수다. |
| `getItemId` | 중복 item을 제거할 때 사용할 ID를 반환한다. |
| `pageSize` | 한 번에 요청하는 개수다. |

### 9.2 반환 state

```js
{
  items: [],
  status: 'loading',
  error: null,
  hasNext: true,
  isLoadingMore: false,
  loadMoreError: null,
}
```

첫 페이지 실패와 추가 페이지 실패를 구분한다. 추가 조회가 실패해도 이미 화면에 있던 목록은 유지되어야 하기 때문이다.

### 9.3 주요 메서드

| 메서드 | 의미 |
| --- | --- |
| `reset()` | 기존 GET을 취소하고 첫 페이지부터 다시 조회한다. |
| `loadMore()` | 현재 cursor 다음 페이지를 가져온다. |
| `retryLoadMore()` | 실패했던 추가 조회를 다시 실행한다. |
| `setItems(updater)` | 댓글 수정·삭제처럼 로컬 item을 변경할 때 사용한다. |

`AbortController`는 필요 없어진 fetch 요청을 취소한다. `requestIdRef`는 취소가 늦게 처리되더라도 오래된 응답이 최신 state를 덮어쓰지 못하게 한다.

## 10. 댓글 Hook

[useComments.js](../../src/features/comments/useComments.js)는 공통 pagination에 댓글 작성·수정·삭제 기능을 추가한다.

```js
const {
  items,
  addComment,
  editComment,
  removeComment,
} = useComments(articleId);
```

| 메서드 | 호출 예시 | 의미 |
| --- | --- | --- |
| `addComment` | `addComment('내용', null)` | 일반 댓글을 작성하고 첫 페이지를 다시 조회한다. |
| `addComment` | `addComment('답글', parentId)` | 부모 ID가 있는 대댓글을 작성한다. |
| `editComment` | `editComment(id, '수정 내용')` | 서버 수정 후 해당 item의 text를 로컬에서 변경한다. |
| `removeComment` | `removeComment(id)` | 서버 삭제 후 item을 `isDeleted: true`로 바꾼다. |

댓글 작성 후에는 새 댓글의 정확한 위치와 소유권 정보를 받기 위해 `reset()`을 실행한다. 이때 진행 중인 추가 GET은 취소한다.

## 11. Page, Component, Hook, Service의 차이

게시글 상세 기능을 기준으로 보면 다음처럼 나뉜다.

```text
PostDetailPage
├── useArticleDetail       상태와 업무 흐름
├── ImageGallery           이미지 표시
├── PostStats              좋아요·조회수·댓글 수 표시
├── PostActions            수정·삭제 UI
└── CommentSection
    ├── useComments        댓글 상태와 업무 흐름
    ├── CommentForm
    └── CommentItem
```

- Page: 여러 기능을 한 화면으로 조합한다.
- Component: 입력받은 props를 화면에 표시하고 사용자 event를 전달한다.
- Hook: state와 event 처리, API 호출 순서를 관리한다.
- Service: endpoint와 HTTP method, request/response 변환을 관리한다.

Page에서 직접 복잡한 API 순서를 작성하지 않는 것이 중요하다.

## 12. Form state 형태

[PostForm.jsx](../../src/features/articles/components/PostForm.jsx)를 예로 들면 다음 state를 사용한다.

```js
{
  title: '',
  content: '',
  files: [],
  existingImageUrls: [],
  uploadedImageUrls: null,
  error: null,
  isSubmitting: false,
}
```

- `files`: 사용자가 새로 선택한 브라우저 `File` 객체다.
- `existingImageUrls`: 게시글 수정 전에 이미 저장된 이미지 URL이다.
- `uploadedImageUrls`: 업로드는 성공했지만 게시글 저장이 실패했을 때 재사용할 URL이다.
- `isSubmitting`: 중복 제출을 막고 버튼 loading UI를 보여준다.

input은 React state와 연결된 controlled component다.

```jsx
<input
  value={title}
  onChange={(event) => setTitle(event.target.value)}
/>
```

입력값의 기준은 DOM이 아니라 React의 `title` state다.

## 13. Service 메서드 의미

### 게시글 Service

[articleService.js](../../src/features/articles/articleService.js)

| 메서드 | API | 의미 |
| --- | --- | --- |
| `getArticles` | `GET /articles` | cursor 기반 게시글 목록 조회 |
| `getArticle` | `GET /articles/:id` | 게시글 상세 조회 |
| `createArticle` | `POST /articles` | 게시글 작성 |
| `updateArticle` | `PUT /articles/:id` | 게시글 수정 |
| `deleteArticle` | `DELETE /articles/:id` | 게시글 삭제 |
| `addArticleLike` | `POST /likes/articles/:id` | 좋아요 추가 |
| `removeArticleLike` | `DELETE /likes/articles/:id` | 좋아요 취소 |
| `incrementArticleView` | `POST /views/articles/:id` | 조회수 증가 |

### 사용자 Service

[userService.js](../../src/features/user/userService.js)

| 메서드 | 의미 |
| --- | --- |
| `getCurrentUser` | 현재 로그인 사용자 조회 |
| `updateCurrentUser` | 닉네임과 프로필 이미지 수정 |
| `deleteCurrentUser` | 회원 탈퇴 |
| `updatePassword` | 비밀번호 변경 |
| `createUser` | 회원가입 |

## 14. HTTP Client 이해하기

[httpClient.js](../../src/shared/api/httpClient.js)의 `request()`가 모든 service 요청의 공통 기반이다.

```js
request('/articles', {
  method: 'POST',
  body: articleData,
});
```

옵션 의미는 다음과 같다.

| 옵션 | 기본값 | 의미 |
| --- | --- | --- |
| `method` | `GET` | HTTP method |
| `body` | 없음 | JSON 또는 FormData 요청 body |
| `headers` | 없음 | 추가 header |
| `signal` | 없음 | AbortController 취소 signal |
| `auth` | `true` | access token을 넣을지 결정 |
| `retryOn401` | `true` | 401에서 token refresh 후 한 번 재시도 |
| `credentials` | `include` | refresh cookie를 요청에 포함 |
| `includeResponseMeta` | `false` | payload와 HTTP status를 함께 받을지 결정 |

일반 객체 body는 자동으로 JSON 문자열로 변환한다. `FormData`는 브라우저가 boundary를 설정해야 하므로 `Content-Type`을 직접 설정하지 않는다.

### 401 처리 흐름

```text
보호 API 요청
  → 401
  → access token refresh
  → 새 token으로 원 요청 한 번 재시도
  → 다시 401이면 token 제거 및 anonymous 전환
```

요청 이후 다른 요청이 이미 token을 갱신했다면 refresh를 중복 실행하지 않고 현재 token으로 재시도한다.

## 15. Runtime API 계약 검증

[contracts.js](../../src/shared/api/contracts.js)는 서버 응답이 예상 형태인지 실행 중 확인한다.

| 함수 | 의미 |
| --- | --- |
| `requireRecord` | 값이 배열이 아닌 객체인지 확인한다. |
| `requireArray` | 값이 배열인지 확인한다. |
| `requireId` | 필수 ID가 존재하는지 확인한다. |

서버 응답에 `userId`가 없으면 화면에서 조용히 잘못 동작하는 대신 `ApiContractError`를 발생시킨다. JavaScript 프로젝트에서 API 타입 오류를 일찍 발견하기 위한 장치다.

## 16. 공통 UI

### ConfirmDialog

[ConfirmDialog.jsx](../../src/shared/components/ConfirmDialog.jsx)는 게시글 삭제, 댓글 삭제, 회원 탈퇴에서 사용한다.

```jsx
<ConfirmDialog
  open={isOpen}
  title="게시글을 삭제하시겠습니까?"
  pending={isDeleting}
  onConfirm={handleDelete}
  onClose={closeDialog}
/>
```

Escape 닫기, Tab 순환, 처음 열었을 때 취소 버튼 focus, 닫힌 후 원래 버튼 focus 복귀를 공통 처리한다.

### Toast

[ToastContext.jsx](../../src/shared/components/ToastContext.jsx)의 `useToast()`를 사용한다.

```js
const { showToast } = useToast();
showToast('수정완료');
```

Provider가 Router보다 바깥에 있으므로 페이지 이동 후에도 toast가 유지된다.

## 17. 대표 흐름을 코드로 따라가기

### 로그인

1. [LoginPage.jsx](../../src/pages/LoginPage.jsx)의 form submit을 찾는다.
2. `useAuth().login()` 호출을 확인한다.
3. [AuthContext.jsx](../../src/features/auth/AuthContext.jsx)의 `login`을 읽는다.
4. [authService.js](../../src/features/auth/authService.js)의 로그인 요청을 읽는다.
5. [httpClient.js](../../src/shared/api/httpClient.js)의 `request`까지 내려간다.
6. 성공 후 `user`, `status`가 어떻게 바뀌는지 확인한다.

### 게시글 상세와 좋아요

1. [PostDetailPage.jsx](../../src/pages/PostDetailPage.jsx)에서 `useParams()`를 찾는다.
2. `useArticleDetail(articleId)` 반환값을 확인한다.
3. `PostStats`에 `toggleLike`가 props로 전달되는지 확인한다.
4. [useArticleDetail.js](../../src/features/articles/useArticleDetail.js)의 `toggleLike`를 읽는다.
5. [articleService.js](../../src/features/articles/articleService.js)의 좋아요 endpoint를 확인한다.

### 댓글 작성

1. [CommentSection.jsx](../../src/features/comments/components/CommentSection.jsx)의 `handleCreate`를 찾는다.
2. [useComments.js](../../src/features/comments/useComments.js)의 `addComment`를 확인한다.
3. POST 성공 후 `pagination.reset()`을 호출하는 이유를 생각한다.
4. [useCursorPagination.js](../../src/shared/hooks/useCursorPagination.js)에서 기존 GET을 abort하는 코드를 찾는다.

## 18. 코드를 수정할 때 지켜야 할 기준

- 화면 조합은 Page에 둔다.
- state와 여러 API 요청 순서는 custom hook에 둔다.
- endpoint와 응답 mapping은 service에 둔다.
- 두 기능 이상에서 쓰는 코드는 shared에 둔다.
- shared에서 feature를 import하지 않는다.
- 비동기 요청에는 loading, success, error 상태를 고려한다.
- GET 요청은 unmount 시 취소한다.
- form은 중복 제출을 막는다.
- 배열이나 객체 state를 직접 수정하지 않는다.
- API 필수 필드는 runtime contract에서 검증한다.

## 19. 테스트 읽기

구현 파일을 읽은 다음 같은 이름의 테스트를 읽으면 의도를 더 쉽게 이해할 수 있다.

예시:

- `useArticleDetail.js` → `useArticleDetail.test.jsx`
- `articleService.js` → `articleService.test.js`
- `PostDetailPage.jsx` → `PostDetailPage.test.jsx`
- `AuthContext.jsx` → `AuthContext.test.jsx`

[renderWithProviders.jsx](../../src/test/renderWithProviders.jsx)는 Router와 ToastProvider가 필요한 페이지 테스트를 쉽게 렌더링한다. [fixtures.js](../../src/test/fixtures.js)는 테스트용 사용자, 게시글, 댓글 객체를 만든다.

검증 명령:

```bash
npm run lint
npm test -- --run
npm run build
npm run test:e2e
```

## 20. 초보자 연습 문제

다음 순서로 작은 수정을 해보면 구조를 이해하는 데 도움이 된다.

1. 게시글 빈 목록 문구를 변경하고 관련 테스트를 수정한다.
2. `PostCard`에 작성자 닉네임의 접근성 label을 추가한다.
3. 공통 오류 메시지 하나를 `errorMessages.js`에 추가한다.
4. `ConfirmDialog`의 문구를 props로 전달하는 위치를 찾아본다.
5. 댓글 수정 성공 시 `setItems`가 어떤 item만 바꾸는지 테스트로 확인한다.
6. 새로운 GET 화면을 만들 때 `loading/error/success` state를 직접 설계해본다.

처음에는 “이 코드가 어떤 Hook을 쓰는가”보다 “이 값이 화면용 state인지, 요청 제어용 ref인지, 서버 통신용 service인지”를 구분하는 데 집중하는 것이 좋다.
