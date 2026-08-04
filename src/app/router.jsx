import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout.jsx';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';
import { PostListPage } from '../pages/PostListPage.jsx';
import { PostDetailPage } from '../pages/PostDetailPage.jsx';
import { PostCreatePage } from '../pages/PostCreatePage.jsx';
import { PostEditPage } from '../pages/PostEditPage.jsx';
import { ProfileEditPage } from '../pages/ProfileEditPage.jsx';
import { PasswordEditPage } from '../pages/PasswordEditPage.jsx';
import { SignupPage } from '../pages/SignupPage.jsx';
import { ChatListPage } from '../pages/ChatListPage.jsx';
import { ChatRoomPage } from '../pages/ChatRoomPage.jsx';
import { ProtectedRoute } from './routes/ProtectedRoute.jsx';
import { PublicOnlyRoute } from './routes/PublicOnlyRoute.jsx';
import { RootRoute } from './routes/RootRoute.jsx';

export const router = createBrowserRouter([
  { path: '/', element: <RootRoute /> },
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/signup', element: <SignupPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/posts', element: <PostListPage /> },
          { path: '/posts/new', element: <PostCreatePage /> },
          { path: '/posts/:articleId', element: <PostDetailPage /> },
          { path: '/posts/:articleId/edit', element: <PostEditPage /> },
          { path: '/settings/profile', element: <ProfileEditPage /> },
          { path: '/settings/password', element: <PasswordEditPage /> },
          { path: '/chats', element: <ChatListPage /> },
          { path: '/chats/:roomId', element: <ChatRoomPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
