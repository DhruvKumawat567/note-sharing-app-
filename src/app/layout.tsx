import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'NoteVault — Secure Expiring Note Sharing',
  description: 'Share sensitive notes securely with one-time access, time-based expiry, dynamic password protection, and atomic race-condition safeguards.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        <Suspense fallback={<div className="h-16 border-b border-slate-900 bg-slate-950" />}>
          <Navbar />
        </Suspense>
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
          <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-slate-500">Loading...</div>}>
            {children}
          </Suspense>
        </main>
        <footer className="w-full border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p>© 2026 NoteVault POC — MERN/PERN Stack Developer Assessment</p>
            <div className="flex items-center gap-4 text-slate-400">
              <span>Next.js 16</span>
              <span>•</span>
              <span>PostgreSQL</span>
              <span>•</span>
              <span>Drizzle / Atomic Locks</span>
              <span>•</span>
              <span>TypeScript</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
