import { useState, useEffect } from 'react';
import { setAuthTokenGetter } from '@workspace/api-client-react';

export const TOKEN_KEY = 'quantedge_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Initialize the API client with the token getter
setAuthTokenGetter(() => getToken());

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getToken());

  useEffect(() => {
    const checkAuth = () => setIsAuthenticated(!!getToken());
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  const login = (token: string) => {
    setToken(token);
    setIsAuthenticated(true);
    // Trigger storage event for other tabs
    window.dispatchEvent(new Event('storage'));
  };

  const logout = () => {
    removeToken();
    setIsAuthenticated(false);
    window.dispatchEvent(new Event('storage'));
  };

  return { isAuthenticated, login, logout };
}