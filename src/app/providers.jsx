import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthContext.jsx';
import { router } from './router.jsx';
import { ToastProvider } from '../shared/components/ToastContext.jsx';
import { ChatProvider } from '../features/chat/ChatProvider.jsx';

export function AppProviders() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ChatProvider>
          <RouterProvider router={router} />
        </ChatProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
