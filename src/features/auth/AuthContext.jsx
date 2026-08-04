import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getCurrentUser } from '../user/userService.js';
import { isUnauthorizedError } from '../../shared/api/ApiError.js';
import { setRefreshHandler, setUnauthorizedHandler } from '../../shared/api/httpClient.js';
import { clearAccessToken } from '../../shared/session/tokenStore.js';
import { login as loginRequest, logout as logoutRequest, refreshAccessToken } from './authService.js';
import { AUTH_STATUS } from './authConstants.js';

// Context와 hook을 함께 공개하는 도메인 진입점이다.
// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(AUTH_STATUS.CHECKING);
  const [user, setUser] = useState(null);
  const [bootstrapError, setBootstrapError] = useState(null);
  const [suppressReturnTo, setSuppressReturnTo] = useState(false);
  const mountedRef = useRef(false);

  const markAnonymous = useCallback(({ suppressReturnTo: shouldSuppressReturnTo = false } = {}) => {
    clearAccessToken();
    if (!mountedRef.current) return;
    setUser(null);
    setBootstrapError(null);
    setSuppressReturnTo(shouldSuppressReturnTo);
    setStatus(AUTH_STATUS.ANONYMOUS);
  }, []);

  const bootstrap = useCallback(async () => {
    if (mountedRef.current) {
      setStatus(AUTH_STATUS.CHECKING);
      setBootstrapError(null);
    }

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await refreshAccessToken();
        const currentUser = await getCurrentUser({ retryOn401: false });
        if (!currentUser) throw new Error('사용자 정보 응답이 비어 있습니다.');

        if (mountedRef.current) {
          setUser(currentUser);
          setSuppressReturnTo(false);
          setStatus(AUTH_STATUS.AUTHENTICATED);
        }
        return;
      } catch (error) {
        if (isUnauthorizedError(error)) {
          markAnonymous();
          return;
        }
        lastError = error;
      }
    }

    if (mountedRef.current) setBootstrapError(lastError);
  }, [markAnonymous]);

  useEffect(() => {
    mountedRef.current = true;
    const removeRefreshHandler = setRefreshHandler(refreshAccessToken);
    const removeUnauthorizedHandler = setUnauthorizedHandler(markAnonymous);
    queueMicrotask(() => void bootstrap());

    return () => {
      mountedRef.current = false;
      removeRefreshHandler();
      removeUnauthorizedHandler();
    };
  }, [bootstrap, markAnonymous]);

  const login = useCallback(async (credentials) => {
    await loginRequest(credentials);
    try {
      const currentUser = await getCurrentUser({ retryOn401: false });
      if (!currentUser) throw new Error('사용자 정보 응답이 비어 있습니다.');
      setUser(currentUser);
      setBootstrapError(null);
      setSuppressReturnTo(false);
      setStatus(AUTH_STATUS.AUTHENTICATED);
      return currentUser;
    } catch (error) {
      clearAccessToken();
      setUser(null);
      setStatus(AUTH_STATUS.ANONYMOUS);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setBootstrapError(null);
    setSuppressReturnTo(true);
    setStatus(AUTH_STATUS.ANONYMOUS);
  }, []);

  const refreshUser = useCallback(async () => {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('사용자 정보 응답이 비어 있습니다.');
    setUser(currentUser);
    return currentUser;
  }, []);

  const applyCurrentUser = useCallback((currentUser) => {
    if (!currentUser) return;
    setUser(currentUser);
  }, []);

  const value = {
    status,
    user,
    login,
    logout,
    refreshUser,
    applyCurrentUser,
    markAnonymous,
    suppressReturnTo,
    bootstrapError,
    retryBootstrap: bootstrap,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth는 AuthProvider 안에서 사용해야 합니다.');
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalAuth() {
  return useContext(AuthContext);
}
