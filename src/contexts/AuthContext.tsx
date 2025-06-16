import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'user' | 'admin' | null;

interface AuthContextType {
  isAuthenticated: boolean;
  userRole: UserRole;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<UserRole>(null);

  // Check if auth is enabled
  const authEnabled = import.meta.env.VITE_AUTH_ENABLED === 'true';

  // Load authentication state from session storage on component mount
  useEffect(() => {
    const storedAuth = sessionStorage.getItem('auth');
    if (storedAuth) {
      const { isAuthenticated: storedIsAuthenticated, userRole: storedUserRole } = JSON.parse(storedAuth);
      setIsAuthenticated(storedIsAuthenticated);
      setUserRole(storedUserRole);
    } else if (!authEnabled) {
      // If auth is disabled, automatically authenticate as a regular user
      setIsAuthenticated(true);
      setUserRole('user');
    }
  }, [authEnabled]);

  const login = (username: string, password: string): boolean => {
    // If authentication is disabled, always return true
    if (!authEnabled) {
      setIsAuthenticated(true);
      setUserRole('user');
      saveAuthToStorage(true, 'user');
      return true;
    }

    // Check admin credentials
    if (
      username === import.meta.env.VITE_ADMIN_USERNAME &&
      password === import.meta.env.VITE_ADMIN_PASSWORD
    ) {
      setIsAuthenticated(true);
      setUserRole('admin');
      saveAuthToStorage(true, 'admin');
      return true;
    }

    // Check user credentials
    if (
      username === import.meta.env.VITE_USER_USERNAME &&
      password === import.meta.env.VITE_USER_PASSWORD
    ) {
      setIsAuthenticated(true);
      setUserRole('user');
      saveAuthToStorage(true, 'user');
      return true;
    }

    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUserRole(null);
    sessionStorage.removeItem('auth');
  };

  // Helper function to store auth state in session storage
  const saveAuthToStorage = (isAuth: boolean, role: UserRole) => {
    sessionStorage.setItem('auth', JSON.stringify({ isAuthenticated: isAuth, userRole: role }));
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userRole, login, logout }}>
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
