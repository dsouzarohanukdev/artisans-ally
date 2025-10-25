'use client';
import { useState, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const data = await login(email, password);
      if (data.error) {
        setError(data.error);
      } else {
        router.push('/'); // Redirect to homepage on successful login
        router.refresh(); // Force a refresh to update user state
      }
    } catch (_err) {
      setError('Failed to log in. Please try again.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md relative">
        <div className="absolute top-4 right-4">
          <Link href="/" className="text-gray-400 hover:text-gray-600" title="Close">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </Link>
        </div>
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Log In to Artisan's Ally</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
            <input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            {/* --- NEW: "Forgot Password?" Link --- */}
            <div className="flex justify-between items-center">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <Link href="/forgot-password" className="text-sm font-semibold text-indigo-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <input id="password" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Log In
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/register" className="font-semibold text-indigo-600 hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}