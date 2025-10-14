'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-indigo-600">
          Artisan's Ally
        </Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-gray-600">Welcome, {user.email}</span>
              <button onClick={logout} className="text-sm font-semibold text-gray-700 hover:text-indigo-600">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-semibold text-gray-700 hover:text-indigo-600">
                Login
              </Link>
              <Link href="/register" className="text-sm font-semibold bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}