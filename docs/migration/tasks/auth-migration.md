# Task: React 인증 기반 마이그레이션

## 0. 작업 메타데이터

| 항목 | 값 |
| --- | --- |
| Task ID | `AUTH-MIGRATION-001` |
| 상태 | 구현 준비 |
| 우선순위 | P0 |
| 선행 작업 | Vite React JavaScript scaffold, `VITE_API_BASE_URL` |
| 선행 문서 | [`../REACT_MIGRATION_PLAN.md`](../REACT_MIGRATION_PLAN.md), [`../../API_SPEC.md`](../../API_SPEC.md) |
| 결과 | AuthContext, token/refresh, route guard, 인증 테스트 |

AI는 이 task 범위만 구현하고 인증 화면의 상세 디자인이나 다른 page 마이그레이션을 함께 수행하지 않는다.

---

## 1. 목표

- 앱 인증 상태를 `checking`, `authenticated`, `anonymous`로 관리한다.
- 앱 시작 시 refresh cookie로 로그인 상태를 복구한다.
- access token은 메모리에만 저장한다.
- 보호 API 401에서 refresh 후 원 요청을 한 번만 재시도한다.
- 보호 route와 공개 전용 route의 redirect를 인증 확인 이후에만 실행한다.
- 안전한 내부 `returnTo`만 허용한다.

## 2. 범위 제외

- 로그인/회원가입 페이지의 최종 CSS 변환
- 사용자 프로필 수정 UI
- 권한 role 시스템
- localStorage/sessionStorage token 저장
- TypeScript
- 서버 데이터 cache 또는 전역 상태 라이브러리

---

## 3. 필수 상태 전이

### 3.1 상태 정의

```js
const AUTH_STATUS = Object.freeze({
  CHECKING: 'checking',
  AUTHENTICATED: 'authenticated',
  ANONYMOUS: 'anonymous',
});
```

초기값은 반드시 `checking`이다.

### 3.2 전이 표

| 현재 상태 | 이벤트 | 다음 상태 | 추가 동작 |
| --- | --- | --- | --- |
| checking | refresh 성공 | authenticated | access token 저장, 내 정보 조회 |
| checking | refresh 401 | anonymous | token/current user 제거 |
| checking | refresh network/5xx | checking + bootstrap error + retry 1회 진행 | anonymous로 단정하지 않음 |
| anonymous | login 성공 | authenticated | token 저장, 내 정보 조회 |
| anonymous | login 실패 | anonymous | form 오류 반환 |
| authenticated | logout 성공 | anonymous | token/current user 제거 |
| authenticated | 회원 탈퇴 성공 | anonymous | token/current user 제거 |
| authenticated | 보호 요청 재시도도 401 | anonymous | token/current user 제거 |

### 3.3 redirect 규칙

- `checking`: 어떤 route에서도 redirect하지 않고 전체 화면 인증 확인 fallback을 표시한다.
- `anonymous + 보호 route`: `/login?returnTo=<encoded internal path>`로 replace한다.
- `anonymous + 공개 route`: 그대로 렌더링한다.
- `authenticated + /login 또는 /signup`: `/posts`로 replace한다.
- 일반 404 route는 인증 정책을 적용한 뒤 NotFound page로 처리한다.

---

## 4. 안전한 returnTo

### 4.1 허용 규칙

다음 조건을 모두 만족해야 한다.

1. 문자열이다.
2. `/`로 시작한다.
3. `//`로 시작하지 않는다.
4. `new URL(candidate, window.location.origin)`의 origin이 현재 origin과 같다.
5. 결과는 `pathname + search + hash` 형태의 내부 경로다.

조건을 만족하지 않으면 `/posts`를 반환한다.

### 4.2 구현 예시

```js
export function getSafeReturnTo(candidate, fallback = '/posts') {
  if (typeof candidate !== 'string') return fallback;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return fallback;

  try {
    const url = new URL(candidate, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
```

### 4.3 필수 테스트 값

| 입력 | 결과 |
| --- | --- |
| `/posts/10?tab=comments#reply` | 그대로 허용 |
| `/settings/profile` | 그대로 허용 |
| `https://evil.example` | `/posts` |
| `//evil.example/path` | `/posts` |
| `/\\evil.example/path` | `/posts` 또는 origin 검사로 차단 |
| `posts/10` | `/posts` |
| 빈 문자열/null/undefined | `/posts` |

---

## 5. 생성할 파일과 책임

```text
src/
├── app/
│   ├── providers.jsx
│   └── routes/
│       ├── ProtectedRoute.jsx
│       └── PublicOnlyRoute.jsx
├── features/auth/
│   ├── AuthContext.jsx
│   ├── authConstants.js
│   ├── authService.js
│   └── tokenStore.js
├── shared/api/
│   ├── ApiError.js
│   └── httpClient.js
└── shared/lib/
    └── getSafeReturnTo.js
```

테스트 파일은 프로젝트 규칙에 맞춰 같은 폴더의 `*.test.js(x)` 또는 `src/__tests__/`에 둔다.

### 5.1 `tokenStore.js`

책임:

- module scope의 access token 저장/조회/제거
- refresh token 저장 금지

필수 export:

```js
getAccessToken()
setAccessToken(token)
clearAccessToken()
```

### 5.2 `authService.js`

책임:

- `login(credentials)`
- `refreshAccessToken()`
- `logout()`
- 동시에 여러 refresh 호출이 발생하면 하나의 Promise 공유

주의:

- 순환 import를 만들지 않는다.
- `authService.js`는 `httpClient.js`의 request 함수를 사용할 수 있지만 `httpClient.js`가 `authService.js`를 import하면 안 된다.
- login/refresh는 `{ auth: false, retryOn401: false }`로 호출해 자동 refresh 대상에서 제외한다.
- logout은 인증 요청으로 호출하고 성공했을 때만 local 인증 상태를 제거한다.
- refresh Promise는 성공/실패 후 `finally`에서 null로 되돌린다.

### 5.3 `httpClient.js`

책임:

- base URL 결합
- JSON/FormData 요청
- 인증 header 추가
- JSON/204/error parsing
- 보호 요청 401 시 refresh 후 한 번 재시도
- 재시도도 401이면 token 제거 후 unauthorized handler 호출

필수 제약:

- login/refresh 요청을 자동 refresh 대상으로 만들지 않는다.
- 요청별 재시도는 최대 1회다.
- 모든 요청에 무조건 `Content-Type`을 넣지 않는다.
- `AbortError`를 `ApiError`로 변환하지 않는다.

`httpClient.js`가 `authService.js`를 import해 순환 의존성을 만들지 않도록 refresh 함수와 인증 만료 처리는 handler 등록 방식으로 연결한다.

```js
let refreshHandler = null;
let unauthorizedHandler = null;

export function setRefreshHandler(handler) {
  refreshHandler = handler;
  return () => {
    if (refreshHandler === handler) refreshHandler = null;
  };
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}
```

- 보호 요청 401이면 등록된 `refreshHandler`를 호출한다.
- refresh 성공 후 새 token으로 원 요청을 한 번 재시도한다.
- refresh 실패 또는 재시도도 401이면 `unauthorizedHandler?.()`를 호출한다.
- AuthProvider는 mount 시 두 handler를 등록하고 unmount 시 해제한다.

### 5.4 `AuthContext.jsx`

Context value:

```js
{
  status,
  user,
  login,
  logout,
  refreshUser,
  markAnonymous,
}
```

책임:

- 초기 `status = checking`
- mount 시 refresh 실행
- refresh 성공 후 내 정보 조회
- refresh 401이면 anonymous
- refresh handler와 unauthorized handler 등록/해제
- login/logout 성공 시 상태 전이
- unmount 후 state 변경 방지

current user 조회는 `GET /users/me`를 사용한다. refresh는 성공했지만 사용자 조회가 실패한 경우 처리 정책:

- 사용자 조회 401: anonymous
- 사용자 조회 network/5xx: token은 유지하고 bootstrap 오류 fallback과 retry 제공

### 5.5 route guards

`ProtectedRoute.jsx`:

```text
checking       -> 인증 확인 fallback
authenticated  -> Outlet
anonymous      -> login redirect + 현재 내부 path를 returnTo에 저장
```

현재 내부 path는 다음 값을 합친다.

```js
location.pathname + location.search + location.hash
```

`PublicOnlyRoute.jsx`:

```text
checking       -> 인증 확인 fallback
authenticated  -> /posts replace
anonymous      -> Outlet
```

---

## 6. 구현 순서

각 단계 완료 후 테스트를 실행한다.

1. `authConstants.js`, `tokenStore.js`, `ApiError.js` 작성
2. `authService.js`의 login/refresh/logout과 single-flight 테스트
3. `httpClient.js`의 parse/error/401 재시도 구현과 테스트
4. `getSafeReturnTo.js` 작성과 보안 입력 테스트
5. `AuthContext.jsx` 상태 전이 구현과 MSW 테스트
6. `ProtectedRoute.jsx`, `PublicOnlyRoute.jsx` 구현과 memory router 테스트
7. `providers.jsx`에서 AuthProvider와 Router 연결
8. placeholder 로그인 화면으로 login/returnTo 통합 테스트
9. 전체 lint/test/build 실행

---

## 7. 상세 동작 시나리오

### 7.1 앱 시작: 세션 있음

1. AuthProvider가 `checking`으로 렌더링된다.
2. refresh를 한 번 실행한다.
3. access token을 메모리에 저장한다.
4. 내 정보를 조회한다.
5. user를 저장하고 `authenticated`로 전환한다.
6. 현재 보호 route를 렌더링한다.

### 7.2 앱 시작: 세션 없음

1. AuthProvider가 `checking`으로 렌더링된다.
2. refresh가 401을 반환한다.
3. token/user를 제거하고 `anonymous`로 전환한다.
4. 공개 route면 그대로 표시한다.
5. 보호 route면 안전한 `returnTo`와 함께 `/login`으로 이동한다.

### 7.3 보호 API의 token 만료

1. 보호 요청이 401을 반환한다.
2. 진행 중인 refresh가 있으면 같은 Promise를 기다린다.
3. refresh 성공 시 새 token으로 원 요청을 한 번 다시 보낸다.
4. 재시도 성공 시 응답을 반환한다.
5. refresh 또는 재시도도 401이면 token/user를 제거하고 anonymous로 전환한다.

### 7.4 로그인 후 복귀

1. 로그인 성공 전에 URL search의 `returnTo`를 읽는다.
2. `getSafeReturnTo()`로 검증한다.
3. 로그인 성공, 내 정보 조회, authenticated 전환을 완료한다.
4. 검증된 내부 경로로 replace한다.

---

## 8. 필수 테스트

### unit

- token set/get/clear
- login 성공/4xx/network error
- refresh 성공/401/5xx
- 동시 refresh N개가 실제 fetch 1회만 호출
- JSON 성공, 204 성공, JSON 오류, non-JSON 오류
- 보호 요청 401 → refresh → 원 요청 1회 성공
- 보호 요청 401 → refresh 401 → unauthorized handler
- 보호 요청 재시도도 401 → 두 번째 refresh 없이 unauthorized handler
- FormData에 JSON Content-Type을 추가하지 않음
- abort는 사용자 API 오류로 변환하지 않음
- `getSafeReturnTo` 표의 전체 입력

### component/router

- checking에서는 공개/보호 route 모두 redirect하지 않음
- anonymous 공개 route 렌더링
- anonymous 보호 route 로그인 replace와 returnTo 보존
- authenticated 보호 route 렌더링
- authenticated 로그인/가입 route는 `/posts` replace
- refresh 401은 공개 로그인 화면에서 일반 오류를 표시하지 않음
- refresh 5xx/network error는 무한 redirect하지 않고 retry 가능한 fallback 표시

### integration

- 보호 deep link → refresh 401 → 로그인 → 원래 path/search/hash 복귀
- 여러 보호 API가 동시에 401 → refresh 1회 → 모두 한 번씩 재시도
- logout 성공 → anonymous → 로그인 화면

---

## 9. 완료 기준

- [ ] JavaScript/JSX만 사용했다.
- [ ] access token이 localStorage/sessionStorage/cookie에 JavaScript로 저장되지 않는다.
- [ ] 초기 상태는 checking이다.
- [ ] refresh 성공은 authenticated, refresh 401은 anonymous다.
- [ ] checking 중 redirect가 없다.
- [ ] 보호 route에서만 anonymous를 로그인으로 이동시킨다.
- [ ] 공개 로그인/가입 route의 refresh 401은 정상 anonymous로 처리된다.
- [ ] `returnTo`는 동일 origin의 `/` 시작 내부 경로만 허용한다.
- [ ] refresh는 동시 호출에서 하나의 Promise를 공유한다.
- [ ] 보호 요청은 refresh 후 최대 한 번만 재시도한다.
- [ ] refresh/retry 401이 AuthContext를 anonymous로 바꾼다.
- [ ] unit/component/integration test가 통과한다.
- [ ] lint와 production build가 성공한다.

## 10. 완료 보고 형식

```text
구현 파일:
- ...

검증:
- npm run lint
- npm run test
- npm run build

상태 전이 검증:
- checking -> authenticated: 통과/실패
- checking -> anonymous: 통과/실패
- authenticated -> anonymous: 통과/실패

남은 확정 필요 항목:
- ...
```
