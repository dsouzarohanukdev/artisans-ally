'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface User { email: string; has_ebay_token: boolean; }
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<any>;
  register: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const res = await fetch(`/api/check_session`, { credentials: 'include' });
        const data = await res.json();
        if (data.logged_in) { setUser(data.user); }
      } catch (error) { console.error('Session check failed:', error);
      } finally { setIsLoading(false); }
    };
    checkLoggedIn();
  }, []);

  const register = async (email: string, password: string) => {
    const res = await fetch(`/api/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }), credentials: 'include',
    });
    const data = await res.json();
    if (res.ok) { setUser(data.user); }
    return data;
  };

  const login = async (email: string, password: string) => {
    const res = await fetch(`/api/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }), credentials: 'include',
    });
    const data = await res.json();
    if (res.ok) { setUser(data.user); }
    return data;
  };

  const logout = async () => {
    await fetch(`/api/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) { throw new Error('useAuth must be used within an AuthProvider'); }
  return context;
};