import { expect, test } from '@playwright/test';

function fulfillJson(route, payload, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

async function mockAuthenticatedUser(page, user = {
  userId: 1,
  email: 'hobby@example.com',
  nickname: '하비',
  profileImageUrl: null,
}) {
  await page.route('**/auth/token/refresh', (route) => fulfillJson(route, { data: { accessToken: 'e2e-token' } }));
  await page.route('**/users/me', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfillJson(route, { data: user });
  });
}

test('타인 작성자 버튼은 기본 버튼 테두리 없이 카드 구분선과 포커스 표시를 유지한다', async ({ page }) => {
  await mockAuthenticatedUser(page);
  const otherUserArticle = {
    articleId: 12,
    userId: 2,
    title: '작성자 버튼 스타일 테스트',
    content: '본문',
    contentImageUrls: [],
    nickname: '다른 사용자',
    profileImageUrl: null,
    likedByMe: false,
    createdAt: '2026-07-19T12:00:00',
    updatedAt: null,
    articleLikeCount: 0,
    articleViewCount: 1,
    commentCount: 0,
  };

  await page.route('**/articles?*', (route) => fulfillJson(route, { data: [otherUserArticle] }));
  await page.route('**/articles/12', (route) => fulfillJson(route, { data: otherUserArticle }));
  await page.route('**/articles/12/comments?*', (route) => fulfillJson(route, { data: [] }));
  await page.route('**/views/articles/12', (route) => route.fulfill({ status: 204 }));

  await page.goto('/posts');
  const cardAuthorButton = page.getByRole('button', { name: '다른 사용자님에게 메시지 보내기' });
  await expect(cardAuthorButton).toBeVisible();
  await expect(cardAuthorButton).toHaveCSS('border-top-width', '1px');
  await expect(cardAuthorButton).toHaveCSS('border-right-width', '0px');
  await expect(cardAuthorButton).toHaveCSS('border-bottom-width', '0px');
  await expect(cardAuthorButton).toHaveCSS('border-left-width', '0px');
  await cardAuthorButton.focus();
  await expect(cardAuthorButton).toHaveCSS('outline-style', 'solid');

  await page.goto('/posts/12');
  const detailAuthorButton = page.getByRole('button', { name: '다른 사용자님에게 메시지 보내기' });
  await expect(detailAuthorButton).toBeVisible();
  await expect(detailAuthorButton).toHaveCSS('border-top-width', '0px');
  await expect(detailAuthorButton).toHaveCSS('border-right-width', '0px');
  await expect(detailAuthorButton).toHaveCSS('border-bottom-width', '0px');
  await expect(detailAuthorButton).toHaveCSS('border-left-width', '0px');
  await detailAuthorButton.focus();
  await expect(detailAuthorButton).toHaveCSS('outline-style', 'solid');
});

test('미인증 상세 deep link는 로그인 후 원래 URL로 복귀한다', async ({ page }) => {
  await page.route('**/auth/token/refresh', (route) => fulfillJson(route, { message: 'unauthorized' }, 401));
  await page.route('**/auth/login', (route) => fulfillJson(route, { data: { token: { accessToken: 'login-token' } } }));
  await page.route('**/users/me', (route) => fulfillJson(route, {
    data: { userId: 1, email: 'hobby@example.com', nickname: '하비', profileImageUrl: null },
  }));
  await page.route('**/articles/12', (route) => fulfillJson(route, {
    data: {
      articleId: 12,
      userId: 2,
      title: '클라이밍 입문기',
      content: '첫 기록',
      contentImageUrls: [],
      nickname: '작성자',
      profileImageUrl: null,
      likedByMe: false,
      createdAt: '2026-07-19T12:00:00',
      updatedAt: null,
      articleLikeCount: 0,
      articleViewCount: 1,
      commentCount: 0,
    },
  }));
  await page.route('**/articles/12/comments?*', (route) => fulfillJson(route, { data: [] }));
  await page.route('**/views/articles/12', (route) => route.fulfill({ status: 204 }));

  await page.goto('/posts/12?tab=comments#reply');
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await page.getByLabel('이메일').fill('hobby@example.com');
  await page.getByLabel('비밀번호').fill('Valid1!x');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/posts\/12\?tab=comments#reply$/);
  await expect(page.getByRole('heading', { name: '클라이밍 입문기' })).toBeVisible();
});

test('좋아요를 갱신하고 같은 닉네임의 다른 사용자에게 작성자 action을 노출하지 않는다', async ({ page }) => {
  await mockAuthenticatedUser(page, {
    userId: 1,
    email: 'hobby@example.com',
    nickname: '같은 닉네임',
    profileImageUrl: null,
  });
  await page.route('**/articles/12', (route) => fulfillJson(route, {
    data: {
      articleId: 12,
      userId: 2,
      title: '소유권 테스트',
      content: '',
      contentImageUrls: [],
      nickname: '같은 닉네임',
      profileImageUrl: null,
      likedByMe: false,
      createdAt: '2026-07-19T12:00:00',
      updatedAt: null,
      articleLikeCount: 3,
      articleViewCount: 10,
      commentCount: 0,
    },
  }));
  await page.route('**/articles/12/comments?*', (route) => fulfillJson(route, { data: [] }));
  await page.route('**/views/articles/12', (route) => route.fulfill({ status: 204 }));
  let likeRequests = 0;
  await page.route('**/likes/articles/12', (route) => {
    likeRequests += 1;
    return fulfillJson(route, { data: null });
  });

  await page.goto('/posts/12');
  await expect(page.getByRole('heading', { name: '소유권 테스트' })).toBeVisible();
  await expect(page.getByRole('link', { name: '수정' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '삭제' })).toHaveCount(0);
  await page.getByRole('button', { name: '좋아요 추가' }).click();

  await expect(page.getByRole('button', { name: '좋아요 취소' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '좋아요 취소' }).locator('strong')).toHaveText('4');
  expect(likeRequests).toBe(1);
});

test('비밀번호 변경 성공 후 인증을 해제하고 로그인으로 이동한다', async ({ page }) => {
  await mockAuthenticatedUser(page);
  await page.route('**/users/me/password', (route) => fulfillJson(route, { data: null }));

  await page.goto('/settings/password');
  await page.getByLabel('비밀번호', { exact: true }).fill('Valid1!x');
  await page.getByLabel('비밀번호 확인').fill('Valid1!x');
  await page.getByRole('button', { name: '수정하기' }).click();

  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('status')).toHaveText('비밀번호가 수정되었습니다.');
});
