'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function AccountPage() {
  const { user, isLoading, updateCurrency, changePassword } = useAuth();
  const router = useRouter();

  // State for settings form
  const [currency, setCurrency] = useState('GBP');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');

  // State for password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // When user data loads, set the currency dropdown to their saved currency
  useEffect(() => {
    if (user) {
      setCurrency(user.currency);
    }
  }, [user]);

  // Handle currency setting update
  const handleSettingsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSettingsError('');
    setSettingsMessage('');
    
    const data = await updateCurrency(currency);
    
    if (data.error) {
      setSettingsError(data.error);
    } else {
      setSettingsMessage('Settings updated successfully!');
    }
  };

  // Handle password change
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }

    const data = await changePassword(currentPassword, newPassword);

    if (data.error) {
      setPasswordError(data.error);
    } else {
      setPasswordMessage(data.message);
      // Clear the password fields on success
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  // If auth is loading, show a loading spinner
  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p>Loading your account...</p>
      </div>
    );
  }

  // Once loaded, show the page
  return (
    <>
      <Navbar />
      <main className="font-sans container mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-800 mb-8">My Account</h1>

          {/* --- Account Details Section --- */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-8">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Account Details</h2>
            <p className="text-gray-600">
              <span className="font-medium">Email:</span> {user.email}
            </p>
          </div>

          {/* --- Change Settings Section --- */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-8">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Change Your Settings</h2>
            <form onSubmit={handleSettingsSubmit} className="space-y-4">
              <div>
                <label htmlFor="currency" className="block text-sm font-medium text-gray-700">Your Currency</label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="GBP">British Pound (£)</option>
                  <option value="USD">US Dollar ($)</option>
                  <option value="EUR">Euro (€)</option>
                </select>
              </div>
              {settingsMessage && <p className="text-green-600 text-sm">{settingsMessage}</p>}
              {settingsError && <p className="text-red-500 text-sm">{settingsError}</p>}
              <button
                type="submit"
                className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Save Settings
              </button>
            </form>
          </div>

          {/* --- Change Password Section --- */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Change Your Password</h2>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">Current Password</label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              {passwordMessage && <p className="text-green-600 text-sm">{passwordMessage}</p>}
              {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Change Password
              </button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}