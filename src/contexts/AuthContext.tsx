import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginWithEdge } from '@/lib/edgeFunctions';

export type UserRole = 'user' | 'admin' | null;

interface AuthContextType {
  isAuthenticated: boolean;
  userRole: UserRole;
  sessionToken: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Check if auth is enabled
  const authEnabled = import.meta.env.VITE_AUTH_ENABLED === 'true';
  const useEdgeAuth = import.meta.env.VITE_USE_SUPABASE_EDGE_AUTH === 'true';

  // Load authentication state from session storage on component mount
  useEffect(() => {
    const storedAuth = sessionStorage.getItem('auth');
    if (storedAuth) {
      const {
        isAuthenticated: storedIsAuthenticated,
        userRole: storedUserRole,
        sessionToken: storedSessionToken
      } = JSON.parse(storedAuth);
      setIsAuthenticated(storedIsAuthenticated);
      setUserRole(storedUserRole);
      setSessionToken(storedSessionToken || null);
    } else if (!authEnabled) {
      // If auth is disabled, automatically authenticate as a regular user
      setIsAuthenticated(true);
      setUserRole('user');
      setSessionToken(null);
    }
  }, [authEnabled]);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // If authentication is disabled, always return true
    if (!authEnabled) {
      setIsAuthenticated(true);
      setUserRole('user');
      setSessionToken(null);
      saveAuthToStorage(true, 'user', null);
      return { success: true };
    }

    if (useEdgeAuth) {
      try {
        const result = await loginWithEdge(username, password);
        setIsAuthenticated(true);
        setUserRole(result.role);
        setSessionToken(result.sessionToken);
        saveAuthToStorage(true, result.role, result.sessionToken);
        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
        return { success: false, error: errorMessage };
      }
    }

    // Check admin credentials
    if (
      username === import.meta.env.VITE_ADMIN_USERNAME &&
      password === import.meta.env.VITE_ADMIN_PASSWORD
    ) {
      setIsAuthenticated(true);
      setUserRole('admin');
      setSessionToken(null);
      saveAuthToStorage(true, 'admin', null);
      return { success: true };
    }

    // Check user credentials
    if (
      username === import.meta.env.VITE_USER_USERNAME &&
      password === import.meta.env.VITE_USER_PASSWORD
    ) {
      setIsAuthenticated(true);
      setUserRole('user');
      setSessionToken(null);
      saveAuthToStorage(true, 'user', null);
      return { success: true };
    }

    return { success: false, error: 'Invalid username or password' };
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUserRole(null);
    setSessionToken(null);
    sessionStorage.removeItem('auth');
  };

  // Helper function to store auth state in session storage
  const saveAuthToStorage = (isAuth: boolean, role: UserRole, nextSessionToken: string | null) => {
    sessionStorage.setItem('auth', JSON.stringify({
      isAuthenticated: isAuth,
      userRole: role,
      sessionToken: nextSessionToken
    }));
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userRole, sessionToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
