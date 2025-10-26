'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

// const API_URL = process.env.NEXT_PUBLIC_API_URL;
const API_URL = '';

export default function PublisherClient() {
    const { user, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [authStatus, setAuthStatus] = useState<'success' | 'error' | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null);
    const [submitMessage, setSubmitMessage] = useState('');

    useEffect(() => {
        if (searchParams.get('success')) {
            setAuthStatus('success');
            router.replace('/publisher');
        } else if (searchParams.get('error')) {
            setAuthStatus('error');
            router.replace('/publisher');
        }
    }, [searchParams, router]);

    const handleEbayAuth = async () => {
        setIsConnecting(true);
        try {
            const response = await fetch(`/api/ebay/get-auth-url`, { credentials: 'include' });
            if (!response.ok) throw new Error("Failed to get auth URL");
            const data = await response.json();
            window.location.href = data.auth_url;
        } catch (_err) {
            console.error(_err);
            setIsConnecting(false);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);
        setSubmitMessage('');
        try {
            const response = await fetch(`/api/ebay/create-draft`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, description, price: parseFloat(price) }),
                credentials: 'include'
            });
            const data = await response.json();
            if (!response.ok) {
                const errorMessage = data.details?.errors?.[0]?.message || data.error || 'An unknown error occurred.';
                setSubmitStatus('error');
                setSubmitMessage(errorMessage);
            } else {
                setSubmitStatus('success');
                setSubmitMessage(`Success! Draft listing created with Offer ID: ${data.offerId}. You can now find this draft in your eBay account.`);
                setTitle(''); setDescription(''); setPrice('');
            }
        } catch (_err) {
            setSubmitStatus('error');
            setSubmitMessage('Failed to connect to the server. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isAuthLoading) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>Loading session...</p></div>;
    }

    if (!user) {
        return (
            <div className="text-center text-gray-500 py-8 px-4 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-gray-800">Welcome to the Publisher!</h2>
                <p className="mt-2">This is your private space to create listings and publish them to your connected marketplaces.</p>
                <p className="mt-4">Please <Link href="/login" className="text-indigo-600 font-semibold hover:underline">log in</Link> or <Link href="/register" className="text-indigo-600 font-semibold hover:underline">register</Link> to get started.</p>
            </div>
        );
    }

    return (
        <>
            <header className="text-center mb-8">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-800">Publisher</h1>
                <p className="text-lg md:text-xl text-gray-500 mt-2">Create once, post everywhere.</p>
            </header>
            
            {authStatus === 'success' && <div className="max-w-xl mx-auto bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md mb-6" role="alert">Successfully connected your eBay account! You can now create drafts.</div>}
            {authStatus === 'error' && <div className="max-w-xl mx-auto bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-6" role="alert">Failed to connect your eBay account. Please try again.</div>}

            <div className="max-w-xl mx-auto bg-white p-8 rounded-lg shadow-md">
                {user.has_ebay_token ? (
                    <div>
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Create a Master Listing</h2>
                        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-md mb-6">
                            <span className="text-green-600 font-bold">✓</span>
                            <p className="text-sm text-green-800">Your eBay account is connected.</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div><label htmlFor="title" className="block text-sm font-medium">Title</label><input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g., Handmade Jesmonite Tray" className="mt-1 w-full p-2 border border-gray-300 rounded-md"/></div>
                            <div><label htmlFor="description" className="block text-sm font-medium">Description</label><textarea id="description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="Describe your beautiful product..." className="mt-1 w-full p-2 border border-gray-300 rounded-md"></textarea></div>
                            <div><label htmlFor="price" className="block text-sm font-medium">Price (£)</label><input type="number" id="price" value={price} onChange={(e) => setPrice(e.target.value)} required step="0.01" placeholder="e.g., 25.00" className="mt-1 w-full p-2 border border-gray-300 rounded-md"/></div>
                            {submitStatus === 'success' && <div className="text-green-700 text-sm p-3 bg-green-50 rounded-md">{submitMessage}</div>}
                            {submitStatus === 'error' && <div className="text-red-700 text-sm p-3 bg-red-50 rounded-md">{submitMessage}</div>}
                            <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                                {isSubmitting ? 'Creating Draft...' : 'Create Draft on eBay'}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="text-center">
                        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Connect Your eBay Account</h2>
                        <p className="text-gray-600 mb-6">To publish listings, you need to grant Artisan's Ally permission to create drafts on your behalf. This is a one-time setup.</p>
                        <button onClick={handleEbayAuth} disabled={isConnecting} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                            {isConnecting ? 'Redirecting...' : 'Connect to eBay'}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}