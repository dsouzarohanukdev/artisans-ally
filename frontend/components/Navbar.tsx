'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/'); // Redirect to homepage after logout
  };

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-indigo-600">
          Artisan's Ally
        </Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              {/* --- THIS IS THE NEW LINK --- */}
              <Link href="/publisher" className="text-sm font-semibold text-gray-700 hover:text-indigo-600">
                Publisher
              </Link>
              <span className="text-sm text-gray-600">|</span>
              <span className="text-sm text-gray-600">Welcome, {user.email}</span>
              <button onClick={handleLogout} className="text-sm font-semibold text-gray-700 hover:text-indigo-600">
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