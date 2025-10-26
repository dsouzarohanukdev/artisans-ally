'use client';

import { useState, FormEvent } from 'react';
import Navbar from '@/components/Navbar';

// const API_URL = process.env.NEXT_PUBLIC_API_URL;
const API_URL = '';

export default function AboutPage() {
  const [formState, setFormState] = useState({ name: '', email: '', message: '' });
  const [responseMessage, setResponseMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResponseMessage('');
    setErrorMessage('');

    try {
      const res = await fetch(`${API_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message.');
      }

      setResponseMessage(data.message);
      setFormState({ name: '', email: '', message: '' }); // Clear form on success
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message || 'An unknown error occurred.');
      } else {
        setErrorMessage('An unknown error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="font-sans container mx-auto p-4 md:p-8 bg-white min-h-screen">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-800 mb-8">About Artisan's Ally</h1>
          <div className="space-y-6 text-gray-700 leading-relaxed">
            <p>
              Welcome to Artisan's Ally! This tool was born from a simple idea: to empower small-batch creators, hobbyists, and artisans just like you.
            </p>
            <p>
              We know the passion that goes into every handmade item. We also know the frustration of trying to turn that passion into a sustainable business. One of the biggest hurdles is pricing: How do you value your time? How much are your materials *really* costing you? What is the market *actually* willing to pay?
            </p>
            <p>
              Artisan's Ally is designed to be your personal workshop manager and market analyst. It's a single place to:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>
                <strong>Track Your Inventory:</strong> Log all your raw materials (like resin, pigments, jesmonite, or clay) and their costs.
              </li>
              <li>
                <strong>Build Product Recipes:</strong> Define exactly what goes into each product you make, from materials to your valuable time (labour costs).
              </li>
              <li>
                <strong>Calculate Your True Cost:</strong> Instantly see your "Total Cost to Make" and a "Suggested Price" based on your desired profit margin.
              </li>
              <li>
                <strong>Analyze the Market:</strong> With one click, scan live eBay listings for similar products to see what your competition is charging.
              </li>
            </ul>
            <p>
              Our goal is to remove the guesswork from your pricing, so you can spend less time crunching numbers and more time doing what you love: creating.
            </p>
          </div>

          <hr className="my-12 border-t-2 border-gray-200" />

          {/* --- Contact Form --- */}
          <div className="bg-gray-50 p-8 rounded-lg shadow-md">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Contact Us</h2>
            <p className="text-gray-600 mb-6">
              Have feedback, a feature request, or a question? We'd love to hear from you.
            </p>
            
            {responseMessage ? (
              <div className="text-center p-4 bg-green-100 text-green-800 rounded-md">
                <p className="font-semibold">{responseMessage}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">Your Name</label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={formState.name}
                    onChange={handleChange}
                    required
                    className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">Your Email</label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={formState.email}
                    onChange={handleChange}
                    required
                    className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700">Message</label>
                  <textarea
                    name="message"
                    id="message"
                    rows={5}
                    value={formState.message}
                    onChange={handleChange}
                    required
                    className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                >
                  {isLoading ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </>
  );
}