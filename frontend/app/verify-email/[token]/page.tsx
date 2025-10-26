'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>(); 

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your account...');

//   const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const API_URL = '';

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Verification link is missing a token.');
      return;
    }

    const handleVerification = async () => {
      try {
        const res = await fetch(`${API_URL}/api/verify-email/${token}`, { method: 'GET' });
        const data = await res.json();

        if (res.ok) {
          setStatus('success');
          setMessage(data.message || 'Verification successful! You can now log in.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed. The link may have expired.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('Could not connect to the server. Please try again later.');
      }
    };

    handleVerification();
  }, [token, API_URL]);

  const displayIcon = () => {
    switch (status) {
      case 'loading':
        return <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>;
      case 'success':
        return (
          <svg className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="h-12 w-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
        <div className="mb-6 flex justify-center">{displayIcon()}</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Email Verification</h2>
        <p className={`text-lg mb-6 ${status === 'error' ? 'text-red-500' : 'text-gray-600'}`}>
          {message}
        </p>

        {status !== 'loading' && (
          <Link
            href="/login"
            className="mt-4 inline-block bg-indigo-600 text-white px-6 py-2 rounded-md font-medium hover:bg-indigo-700"
          >
            Go to Login
          </Link>
        )}
      </div>
    </div>
  );
}
