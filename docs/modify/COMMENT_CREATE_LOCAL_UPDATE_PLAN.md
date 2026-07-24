# 댓글 작성 후 로컬 목록 갱신 계획

## 1. 목적

댓글 또는 대댓글 작성 후 댓글 목록 전체를 다시 조회하지 않고, `POST /articles/:articleId/comments` 응답으로 받은 생성 댓글 한 건만 현재 화면에 반영한다.

현재 `useComments.addComment`는 댓글 생성 응답을 받은 뒤 `pagination.reset()`을 실행한다. 이 때문에 첫 페이지 전체를 다시 요청하며, 추가 조회 중인 요청까지 취소된다.

```js
const createdComment = await createComment(articleId, { commentText, parentCommentId });
await pagination.reset({ throwOnError: true });
return createdComment;
```

## 2. 변경 대상

- `src/features/comments/commentService.js`
- `src/features/comments/useComments.js`
- `src/shared/hooks/useCursorPagination.js`
- `src/features/comments/commentService.test.js`
- `src/features/comments/components/CommentSection.test.jsx`
- `src/features/comments/components/CommentForm.jsx`
- `src/features/comments/components/CommentSection.jsx`

## 3. 구현 계획

### 3.1 댓글 생성 응답을 화면 모델로 사용

`commentService.createComment()`가 생성 API 응답을 `mapComment()`로 변환하여 반환하는 현재 흐름을 유지한다.

서버 생성 응답에는 로컬 렌더링과 소유권 판별에 필요한 다음 필드가 포함되어야 한다.

- `commentId`
- `userId`
- `parentCommentId`
- `commentText`
- `nickname`
- `profileImageUrl`
- `createdAt`
- `deletedAt`

`commentId` 등 필수 필드가 없는 불완전한 응답은 목록 전체 조회로 보완하지 않는다. 명시적인 계약 오류를 발생시켜 등록 폼의 입력값을 유지하고 댓글 수를 변경하지 않는다.

### 3.2 pagination에 단일 항목 추가 기능 제공

`useCursorPagination()`에 `appendItem` 또는 `upsertItem` 메서드를 추가한다.

이 메서드는 다음 동작을 담당한다.

1. 기존 `items` 뒤에 생성 댓글을 추가한다.
2. `getItemId`로 같은 ID가 있는지 확인하여 중복 추가를 막는다.
3. 기존 상태가 `empty`이면 `success`로 전환한다.
4. pagination의 `cursor`와 `hasNext`는 변경하지 않는다.
5. functional state update를 사용하여 진행 중인 추가 조회 결과와 충돌하지 않게 한다.

새 댓글은 pagination 조회의 다음 cursor를 계산하는 서버 응답 항목이 아니므로 `cursorRef`를 생성 댓글 기준으로 변경하지 않는다.

### 3.3 `addComment`에서 전체 재조회 제거

`useComments.addComment()`를 다음 흐름으로 변경한다.

```js
const createdComment = await createComment(articleId, {
  commentText,
  parentCommentId,
});

pagination.appendItem(createdComment);
return createdComment;
```

다음 전체 재조회 코드는 제거한다.

```js
await pagination.reset({ throwOnError: true });
```

이에 따라 댓글과 대댓글 작성 성공 후 발생하는 네트워크 요청은 생성 `POST` 한 번뿐이다.

### 3.4 댓글과 대댓글 표시 순서 유지

생성 댓글은 원본 배열에 추가하고, 화면 표시 순서는 기존 `orderComments()`에 맡긴다.

- 최상위 댓글은 기존 최상위 댓글 뒤에 표시한다.
- 대댓글은 `parentCommentId`를 기준으로 부모 댓글 바로 아래에 표시한다.
- 삭제된 부모의 대댓글 표시 규칙은 기존 동작을 유지한다.

서버의 공식 댓글 정렬 정책이 이 순서와 다르다면 구현 전에 정렬 계약을 먼저 확정한다.

### 3.5 진행 중인 조회와의 경합 처리

추가 페이지 조회 중 댓글을 작성해도 해당 GET 요청을 취소하거나 첫 페이지를 다시 조회하지 않는다. GET 결과와 생성 댓글은 각각 functional state update로 병합하고 ID 중복을 제거한다.

최초 댓글 조회가 진행 중일 때는 초기 조회 결과가 방금 추가한 댓글을 덮어쓸 수 있다. 다음 중 하나로 이를 방지한다.

1. 권장: 최초 조회 상태가 `success` 또는 `empty`가 될 때까지 댓글 등록을 비활성화한다.
2. 대안: 최초 조회 응답을 기존 로컬 항목과 병합하되, 게시글 변경 시 이전 게시글의 로컬 항목이 섞이지 않도록 요청 세대를 함께 관리한다.

현재 구조에서는 첫 번째 방법이 영향 범위가 작고 상태 전이가 명확하다.

### 3.6 댓글 수 갱신 시점 유지

`CommentSection.handleCreate()`는 `addComment()`가 생성 응답 검증과 로컬 목록 반영까지 성공한 뒤에만 `onCommentCountChange(1)`을 호출한다.

생성 실패 또는 불완전한 응답인 경우에는 다음 상태를 유지한다.

- 입력 내용 유지
- 댓글 수 유지
- 기존 댓글 목록 유지
- 등록 오류 표시

## 4. 테스트 계획

### 4.1 서비스 테스트

`commentService.test.js`에서 다음을 검증한다.

- 생성 응답이 `mapComment()`를 거쳐 반환된다.
- 댓글과 대댓글 요청에 올바른 `parentCommentId`가 전달된다.
- 필수 생성 응답이 없을 때 계약 오류가 발생한다.

### 4.2 컴포넌트 및 훅 동작 테스트

`CommentSection.test.jsx`에서 기존 전체 재조회 전제의 mock과 assertion을 변경하고 다음을 검증한다.

1. 최초 목록 조회 후 댓글을 작성해도 `getComments` 호출 횟수가 증가하지 않는다.
2. `createComment`가 반환한 댓글이 즉시 표시된다.
3. 빈 목록에서 작성하면 `empty` 안내가 사라지고 댓글 목록이 표시된다.
4. 새 대댓글이 부모 댓글 바로 아래에 표시된다.
5. 추가 조회 중 작성해도 추가 조회 결과와 생성 댓글이 모두 유지된다.
6. 같은 `commentId`가 들어와도 목록에 중복 표시되지 않는다.
7. 생성 실패 시 입력값과 기존 목록이 유지된다.
8. 생성 성공 시에만 `onCommentCountChange(1)`이 호출된다.

기존의 "추가 조회 중 댓글을 작성하면 GET을 중단하고 첫 페이지를 다시 조회한다" 테스트는 "추가 조회를 유지하면서 생성 댓글을 로컬로 병합한다" 테스트로 교체한다.

## 5. 완료 기준

- 댓글 및 대댓글 작성 시 생성 `POST` 이후 댓글 목록 GET이 발생하지 않는다.
- 생성된 댓글이 별도의 새로고침 없이 즉시 표시된다.
- 빈 목록, 추가 조회 중 작성, 중복 ID 상황에서도 목록 상태가 일관된다.
- 댓글 작성 성공과 댓글 수 증가가 동일한 성공 시점에 반영된다.
- 기존 댓글 조회, 수정, 삭제, 무한 스크롤 테스트가 모두 통과한다.
- `npm test`, `npm run lint`, `npm run build`가 모두 통과한다.
