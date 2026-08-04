# 하비루프 프런트엔드 API 명세

## 0. 문서 역할

이 문서는 React 마이그레이션에서 사용하는 API 계약의 단일 기준이다. AI는 endpoint, method, 인증 여부, payload, 응답 필드를 이 문서에서 확인한다.

### 상태 표시

- `현재 코드 확인`: 레거시 프런트엔드에서 호출 또는 사용 중인 내용
- `서버 확인`: 사용자 또는 백엔드 계약으로 확정된 내용
- `확정 필요`: 현재 프런트엔드만으로 정확히 판단할 수 없는 내용

### AI 규칙

- `확정 필요` 필드를 임의 이름으로 구현하지 않는다.
- 응답이 문서와 다르면 mapper에서 숨기지 말고 이 문서를 먼저 갱신한다.
- API 실패는 Error 객체를 반환하지 않고 반드시 throw한다.
- 보호 API의 인증/재시도 동작은 [`migration/tasks/auth-migration.md`](migration/tasks/auth-migration.md)를 따른다.
- TypeScript type을 만들지 않는다. 필요한 타입 설명은 JSDoc 또는 이 문서의 필드 표를 사용한다.

---

## 1. 공통 규칙

### 1.1 Base URL

```js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
```

- 로컬 현재값: `http://localhost:8080`
- production/staging 값은 환경 변수로 주입한다.
- 코드에 origin을 직접 작성하지 않는다.

### 1.2 인증

- access token: JavaScript 메모리에만 저장한다.
- refresh token: 서버가 관리하는 cookie를 사용한다.
- cookie가 필요한 요청은 `credentials: 'include'`를 사용한다.
- 보호 API는 `Authorization: Bearer <accessToken>` header를 사용한다.
- 로그인, 로그아웃, 회원가입, refresh는 access token 없이 호출한다.
- 보호 API가 401이면 refresh 후 원 요청을 한 번만 재시도한다.

### 1.3 Content-Type

| body | header |
| --- | --- |
| JSON | `Content-Type: application/json` |
| `FormData` | 직접 설정하지 않음. 브라우저가 boundary 포함 header 생성 |
| body 없음 | 불필요 |

### 1.4 응답 envelope

현재 코드는 다음 형태를 가정한다.

```js
{
  data: {},
  message: 'optional message'
}
```

- 성공 응답이 204이면 JSON parsing을 시도하지 않는다.
- JSON이 아닌 오류 응답도 처리할 수 있어야 한다.
- `response.ok === false`이면 `ApiError`를 throw한다.

권장 오류 객체:

```js
class ApiError extends Error {
  constructor(message, { status, code, data } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}
```

`code` 규칙:
- UPPER_SNAKE_CASE 사용
- HTTP 상태 코드와 별도로 관리
- 프론트엔드 코드에서 변경되지 않는 안정적인 값으로 사용
- 메시지 문장을 code로 사용하지 않기
- Java 예외 클래스명을 노출하지 않기

### 1.5 취소와 중복 요청

- GET 요청은 effect cleanup에서 `AbortController`로 취소한다.
- abort 오류는 사용자 오류 UI로 표시하지 않는다.
- form submit 중에는 submit 버튼을 비활성화한다.
- cursor 추가 조회 중에는 같은 cursor를 다시 요청하지 않는다.

---

## 2. Endpoint 요약

| 도메인 | Method | Path | 인증 | 상태 |
| --- | --- | --- | --- | --- |
| 인증 | POST | `/auth/login` | 없음, cookie 포함 | 현재 코드 확인 |
| 인증 | POST | `/auth/token/refresh` | refresh cookie | 현재 코드 확인 |
| 인증 | POST | `/auth/logout` | access token + cookie | 현재 코드 확인 |
| 사용자 | POST | `/users` | 없음 | 현재 코드 확인 |
| 사용자 | GET | `/users/me` | 필요 | 현재 코드 확인 |
| 사용자 | PATCH | `/users/me` | 필요 | 현재 코드 확인 |
| 사용자 | PATCH | `/users/me/password` | 필요 | 현재 코드 확인 |
| 사용자 | DELETE | `/users/me` | 필요 | 현재 코드 확인 |
| 이미지 | POST | `/users/me/profile-image` | 상황별 확정 필요 수정됨| 현재 코드 확인 |
| 이미지 | POST | `/articles/content-image` | 필요 | 현재 코드 확인 |
| 게시글 | GET | `/articles` | 필요 | 현재 코드 확인 |
| 게시글 | POST | `/articles` | 필요 | 현재 코드 확인 |
| 게시글 | GET | `/articles/:articleId` | 필요 | 현재 코드 확인 |
| 게시글 | PUT | `/articles/:articleId` | 필요 | 현재 코드 확인 |
| 게시글 | DELETE | `/articles/:articleId` | 필요 | 현재 코드 확인 |
| 댓글 | GET | `/articles/:articleId/comments` | 필요 | 현재 코드 확인 |
| 댓글 | POST | `/articles/:articleId/comments` | 필요 | 댓글 확인, 대댓글 요구사항 확정 |
| 댓글 | PUT | `/articles/:articleId/comments/:commentId` | 필요 | 현재 코드 확인 |
| 댓글 | DELETE | `/articles/:articleId/comments/:commentId` | 필요 | 현재 코드 확인 |
| 좋아요 | POST | `/likes/articles/:articleId` | 필요 | 현재 코드 확인 |
| 좋아요 | DELETE | `/likes/articles/:articleId` | 필요 | 현재 코드 확인 |
| 조회수 | POST | `/views/articles/:articleId` | 필요 | 서버 멱등성 확인 |

---

## 3. 인증 API

### 3.1 로그인

`POST /auth/login`

요청:

```js
{
  email: 'user@example.com',
  password: 'Password1!'
}
```

성공 응답에서 현재 코드가 사용하는 경로:

```js
response.data.token.accessToken
```

주의:

- refresh 응답의 token 경로와 다르다.
- 로그인 실패 시 `data.token`에 접근하지 않는다.
- 성공/실패 status code와 error code는 200, 401(이메일, 패스워드 실패), 404(사용자 삭제됨)이다.

### 3.2 access token 재발급

`POST /auth/token/refresh`

요청 설정:

```js
{
  method: 'POST',
  credentials: 'include'
}
```

성공 응답에서 현재 코드가 사용하는 경로:

```js
response.data.accessToken
```

상태 전이:

- 성공: 새 token 저장, `authenticated`
- 401: token 제거, `anonymous`
- 네트워크/5xx: 인증 상태를 임의로 anonymous로 단정하지 않고 오류로 전달. 화면 정책은 auth task를 따른다.

### 3.3 로그아웃

`POST /auth/logout`

- 인증: refresh cookie, access token 없음
- body: 없음
- 성공 후 access token과 current user를 제거한다.
- 실패하면 현재 화면과 authenticated 상태를 유지하고 오류를 표시한다.
- 성공하다면 200 응답, {message : "logout_success", data: null} 이다.

---

## 4. 사용자 API

### 4.1 회원가입

`POST /users`

요청:

```js
{
  email,
  password,
  nickname,
  profileImageUrl // string 또는 null
}
```

- 현재 UI에는 비밀번호 확인 필드가 있지만 API 요청에는 포함하지 않는다.
- 이메일/닉네임 중복 오류 code와 field 매핑은 409 응답, "이미 존재하는 이메일/닉네임 입니다.", 틀린 필드 출력.
- 프로필 이미지는 필수가 아니다.

### 4.2 내 정보 조회

`GET /users/me`

현재 사용 필드:

```js
{
  userId,
  email,
  nickname,
  profileImageUrl
}
```

- `profileImageUrl`이 없으면 `../assets/images/default-profile.svg`를 사용한다.


### 4.3 내 정보 수정

`PATCH /users/me`

요청:

```js
{
  nickname,
  profileImageUrl
}
```

성공 후 AuthContext의 current user를 응답값으로 갱신한다. 서버가 수정된 사용자를 반환하지 않으면 `GET /users/me`를 다시 호출한다.

### 4.4 비밀번호 수정

`PATCH /users/me/password`

요청:

```js
{ password }
```

- password confirm은 client validation 전용이며 전송하지 않는다.
- 변경 후 다시 로그인을 요구한다.

### 4.5 회원 탈퇴

`DELETE /users/me`

- body: 없음
- 성공 후 access token과 current user를 제거하고 `/login`으로 이동한다.
- 성공 body 200응답, cookie 삭제 방식은 기존 쿠키를 덮어쓴다. 

---

## 5. 이미지 API

### 5.1 프로필 이미지 upload

`POST /users/me/profile-image`

요청:

```js
const formData = new FormData();
formData.append('profileImage', file);
```

현재 사용 응답:

```js
response.data.fileUrl
```

- 회원가입 전에도 `/users/me/...`를 access token 없이 호출할 수 있다.
- 로그인 후 프로필 변경에서는 access token/cookie가 필요하다.
- 가입용과 수정용 endpoint를 분리하지 않는다.
- 파일 당 허용 용량 10MB, 총 용량 100MB.


### 5.2 게시글 이미지 upload

`POST /articles/content-image`

요청:

```js
const formData = new FormData();
files.forEach((file) => formData.append('contentImages', file));
```

현재 사용 응답:

```js
response.data.fileUrls // string[]
```

- 파일 당 허용 용량 10MB, 총 용량 100MB
- 일부 파일만 실패할 수 있는지: 일부 파일 실패하면 전체 실패다.

클라이언트 규칙:

- upload 성공 URL은 form state에 저장한다.
- 이어지는 게시글 저장 실패 시 같은 선택 파일을 자동 재업로드하지 않는다.
- 파일 선택이 바뀌면 기존 upload 결과를 사용하지 않는다.

---

## 6. 게시글 API

### 6.1 목록 조회

`GET /articles?pageSize={pageSize}&lastArticleId={lastArticleId}`

query parameter:

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `pageSize` | 예 | 현재값 10 |
| `lastArticleId` | 첫 요청 아니오 | 직전 응답 마지막 게시글 ID |

현재 코드는 `response.data`를 배열로 사용한다.

현재 사용 필드:

```js
{
  articleId,
  title,
  contentImageUrls,
  articleLikeCount,
  commentCount,
  articleViewCount,
  createdAt,
  userId,
  nickname,
  profileImageUrl,
  updatedAt
}
```

- 이미지 필드가 현재 코드에서 여러 후보 이름으로 처리되고 있으므로 실제 대표 이미지 필드는 리스트의 가장 첫번째 사진이다. 확정 후 mapper는 하나의 `thumbnailUrl` 필드로 정규화한다.
- updatedAt의 null 여부로 작성일자 옆에 `수정됨`을 표기한다.

다음 페이지 판단:

- 응답 길이가 `pageSize`보다 작으면 종료한다.
- 응답 길이가 0이면 첫 요청은 empty, 추가 요청은 pagination 종료다.
- 별도의 `hasNext` 응답 필드가 있다면 해당 필드를 우선하도록 명세를 갱신한다.

### 6.2 게시글 작성

`POST /articles`

요청:

```js
{
  title,
  content,
  contentImageUrls
}
```

현재 사용 응답:

```js
response.data.articleId
```

- title 최대 길이: HTML 기준 26자
- content 필수 여부와 최대 길이: nullable, 최대 길이 제한 없음.

### 6.3 게시글 상세

`GET /articles/:articleId`

현재 사용 필드:

```js
{
  articleId,
  title,
  content,
  contentImageUrls,
  userId,
  nickname,
  profileImageUrl,
  likedByMe,
  createdAt,
  updatedAt,
  articleLikeCount,
  articleViewCount,
  commentCount
}
```

- 존재하지 않는 ID의 status code를 404 응답이 출력된다.

### 6.4 게시글 수정

`PUT /articles/:articleId`

요청:

```js
{
  title,
  content,
  contentImageUrls
}
```

현재 사용 응답:

```js
response.data.articleId
```

- 이미지 재업로드를 하지 않으면 기존의 업로드했던 이미지 사용
- 이미지 재업로드 하면 기존의 업로드한 이미지를 삭제하고 추가 업로드한 사진만 이용
- 이미지 순서를 URL 배열 순서로 보존.

### 6.5 게시글 삭제

`DELETE /articles/:articleId`

응답: 
```js
{
  articleId,
  userId,
  title,
  content,
  contentImageUrls,
  createdAt,
  deletedAt
}
```

- 다른 사용자의 게시글은 서버가 403으로 거부해야 한다.


---

## 7. 댓글과 대댓글 API

### 7.1 목록 조회

`GET /articles/:articleId/comments?pageSize={pageSize}&lastCommentId={id}&lastParentCommentId={id}`

query parameter:

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `pageSize` | 예 | 현재값 10 |
| `lastCommentId` | 첫 요청 아니오 | 직전 응답 마지막 comment ID |
| `lastParentCommentId` | 첫 요청 아니오 | 직전 응답 마지막 parent ID, null 처리 계약 확인 필요 |

현재 사용 필드:

```js
{
  commentId,
  parentCommentId, // 최상위 댓글은 null
  commentText,
  userId,
  nickname,
  profileImageUrl,
  createdAt,
  deletedAt
}
```

정렬/표시 규칙:

- `parentCommentId === null`: 최상위 댓글
- `parentCommentId !== null`: 해당 부모의 대댓글
- 대댓글은 부모 댓글 아래에 표시한다.
- 삭제된 부모 댓글을 '해당 댓글은 삭제되었습니다.' 표시한다.
- 삭제된 부모 댓글의 대댓글은 표시한다. 
- 대댓글의 대댓글 허용 여부는 현재 요구 범위에서 제외한다. 답글 버튼은 최상위 댓글에만 표시하는 것을 기본값으로 한다.

### 7.2 댓글/대댓글 작성

`POST /articles/:articleId/comments`

일반 댓글 요청:

```js
{
  commentText,
  parentCommentId: null
}
```

대댓글 요청:

```js
{
  commentText,
  parentCommentId: parentComment.commentId
}
```

응답:

```js
{
  commentId,
  parentCommentId, // 최상위 댓글은 null
  commentText,
  userId,
  nickname,
  profileImageUrl,
  createdAt,
  deletedAt
}
```

중요:

- endpoint와 method는 댓글 작성과 동일하다.
- 대댓글은 `parentCommentId`에 부모 댓글 ID를 전달한다.
- 성공 응답에 생성된 comment 전체가 있으면 로컬 목록에 삽입한다.
- 성공 응답이 ID만 반환하면 댓글 목록을 다시 조회한다.
- 응답 구조와 부모가 아닌 대댓글 ID 전달 시 오류 status는 400이다.

### 7.3 댓글 수정

`PUT /articles/:articleId/comments/:commentId`

요청:

```js
{ commentText }
```

- 일반 댓글과 대댓글에 같은 endpoint를 사용한다.
- 작성자만 수정할 수 있어야 한다.

### 7.4 댓글 삭제

`DELETE /articles/:articleId/comments/:commentId`

- body: 없음
- 작성자만 삭제할 수 있어야 한다.
-  `deletedAt`을 기록하는 soft delete이다.
- 삭제 후 댓글 목록을 다시 조회한다. 

---

## 8. 좋아요 API

### 좋아요 추가

`POST /likes/articles/:articleId`

### 좋아요 취소

`DELETE /likes/articles/:articleId`

공통 규칙:

- body: 없음
- 성공 후 상세 화면의 `likedByMe`와 `articleLikeCount`를 갱신한다.
- 현재 UI는 요청 성공 후에만 값을 바꾸는 단순 방식을 사용한다.
- 이미 추가/취소된 상태에서 같은 요청을 보낸 경우의 status와 응답은 409다.

---

## 9. 조회수 API

`POST /views/articles/:articleId`

서버:

- 서버에서 중복 요청에 대한 멱등성을 보장한다.
- 따라서 React Strict Mode의 중복 effect를 막기 위한 client dedupe는 필요하지 않다.

클라이언트 규칙:

- 상세 게시글을 정상 조회한 뒤 호출한다.
- 조회수 증가 성공 201, 중복 조회수 증가 방지 204 응답한다.


---

## 10. API 구현 파일 매핑

| 파일 | 책임 |
| --- | --- |
| `../src/shared/api/httpClient.js` | base URL, JSON/FormData, auth header, 401 1회 재시도, `ApiError` |
| `../src/features/auth/authService.js` | login, refresh, logout |
| `../src/features/user/userService.js` | 내 정보, 수정, 비밀번호, 탈퇴 |
| `../src/features/images/imageService.js` | 프로필/게시글 이미지 upload |
| `../src/features/articles/articleService.js` | 게시글 CRUD, 좋아요, 조회수 |
| `../src/features/comments/commentService.js` | 댓글/대댓글 조회와 CRUD |

service 함수는 UI state를 변경하거나 route를 이동하지 않는다. API 요청과 응답 반환만 담당한다.

