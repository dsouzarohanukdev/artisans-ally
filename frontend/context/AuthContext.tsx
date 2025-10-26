'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// const API_URL = process.env.NEXT_PUBLIC_API_URL;
const API_URL = '';

interface User {
  email: string;
  has_ebay_token: boolean;
  currency: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<any>;
  register: (email: string, password: string, currency: string) => Promise<any>;
  logout: () => Promise<void>;
  updateCurrency: (newCurrency: string) => Promise<any>;
  forgotPassword: (email: string) => Promise<any>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const res = await fetch(`${API_URL}/api/check_session`, { credentials: 'include' });
        const data = await res.json();
        if (data.logged_in) {
          setUser(data.user);
        }
      } catch (error) {
        console.error('Session check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };
    checkLoggedIn();
  }, []);

  const register = async (email: string, password: string, currency: string) => {
    const res = await fetch(`${API_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, currency }),
      credentials: 'include',
    });
    const data = await res.json();
    if (res.ok) {
      setUser(data.user);
    }
    return data;
  };

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });
    const data = await res.json();
    if (res.ok) {
      setUser(data.user);
    }
    return data;
  };

  const logout = async () => {
    await fetch(`${API_URL}/api/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    setUser(null);
  };

  const updateCurrency = async (newCurrency: string) => {
    try {
      const res = await fetch(`${API_URL}/api/user/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: newCurrency }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
      }
      return data;
    } catch (err) {
      console.error("Failed to update currency", err);
      return { error: "Failed to update currency" };
    }
  };

  const forgotPassword = async (email: string) => {
    const res = await fetch(`${API_URL}/api/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      credentials: 'include',
    });
    return await res.json();
  };
  
  const changePassword = async (currentPassword: string, newPassword: string) => {
    const res = await fetch(`${API_URL}/api/user/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
      credentials: 'include',
    });
    return await res.json();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateCurrency, forgotPassword, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};