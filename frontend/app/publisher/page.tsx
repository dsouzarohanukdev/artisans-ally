import { Suspense } from 'react';
import PublisherClient from '@/components/PublisherClient';
import Navbar from '@/components/Navbar';

export default function PublisherPage() {
  return (
    <>
      <Navbar />
      <main className="font-sans container mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">
        <Suspense fallback={<p className="text-center p-8">Loading Publisher...</p>}>
          <PublisherClient />
        </Suspense>
      </main>
    </>
  );
}