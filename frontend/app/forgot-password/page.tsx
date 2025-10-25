'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { forgotPassword } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const data = await forgotPassword(email);
      if (data.error) {
        setError(data.error);
      } else {
        setMessage(data.message); // "If an account exists, an email has been sent."
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md relative">
        <div className="absolute top-4 right-4">
          <Link href="/login" className="text-gray-400 hover:text-gray-600" title="Back to Login">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </Link>
        </div>

        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Reset Your Password</h2>
        
        {message ? (
          <div className="text-center">
            <p className="text-green-600 font-semibold">{message}</p>
            <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:underline">
              ← Back to Log in
            </Link>
          </div>
        ) : (
          <>
            <p className="text-center text-gray-600 mb-6">
              Enter your email address and we will send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}