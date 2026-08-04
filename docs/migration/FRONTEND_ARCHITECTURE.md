# React 프런트엔드 아키텍처

## 계층과 의존 방향

```text
app → layouts/pages → features → shared
```

- `app`: provider와 router 조립
- `layouts`: 공통 화면 골격
- `pages`: route 단위 화면 조합과 성공 후 navigation
- `features`: 도메인 component, use-case hook, service, validation
- `shared`: HTTP, session, 공통 hook·component·오류·테스트 기반

`shared`는 상위 계층을 참조하지 않고, `features`는 `pages`, `layouts`, `app`을 참조하지 않는다. 이 규칙은 ESLint로 검사한다.

## 서버 통신 규칙

- HTTP transport는 `shared/api/httpClient.js`를 사용한다.
- endpoint와 DTO mapping은 feature service에서 관리한다.
- 여러 요청을 조합하는 업무 흐름은 use-case hook에서 관리한다.
- page는 service 요청 순서를 직접 구성하지 않는다.
- 주요 응답의 필수 ID와 자료형은 `shared/api/contracts.js`로 검증한다.

## 공통 UI와 상태

- 확인 모달: `shared/components/ConfirmDialog.jsx`
- toast: `shared/components/ToastContext.jsx`
- cursor pagination: `shared/hooks/useCursorPagination.js`
- API 오류 문구: `shared/errors/errorMessages.js`

## 테스트

- 공통 renderer: `../../src/test/renderWithProviders.jsx`
- fixture factory: `../../src/test/fixtures.js`
- 검증 명령: `npm run lint`, `npm test -- --run`, `npm run build`, `npm run test:e2e`

## Legacy

이전 HTML/JavaScript 구현은 rollback 참고용으로 `../../legacy`에 격리한다. 현재 Vite 빌드와 lint 대상에는 포함하지 않는다.
