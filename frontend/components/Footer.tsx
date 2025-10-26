'use client';

import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-100 border-t border-gray-200 mt-24">
      <div className="container mx-auto px-4 md:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center text-center md:text-left">
          <div className="mb-4 md:mb-0">
            <p className="text-sm text-gray-600">
              &copy; {currentYear} Artisan's Ally. All rights reserved.
            </p>
          </div>
          <div className="flex space-x-6">
            <Link href="/about" className="text-sm text-gray-600 hover:text-indigo-600">
              About & Contact
            </Link>
            <Link href="/privacy-policy" className="text-sm text-gray-600 hover:text-indigo-600">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}