'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Shield, 
  Lock, 
  Zap, 
  Clock, 
  Eye, 
  PlusCircle, 
  ArrowRight, 
  FileText, 
  Share2, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Trash2,
  Sparkles
} from 'lucide-react';

export default function HomePage() {
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData.user);

        // Fetch notes
        const notesRes = await fetch('/api/notes');
        if (notesRes.ok) {
          const notesData = await notesRes.json();
          setNotes(notesData.notes || []);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this note and revoke all its share links?')) return;

    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (err) {
      console.error('Delete error', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  // Authenticated Dashboard View
  if (user) {
    const totalViews = notes.reduce((acc, curr) => acc + (Number(curr.total_views) || 0), 0);
    const totalLinks = notes.reduce((acc, curr) => acc + (Number(curr.total_links) || 0), 0);

    return (
      <div className="space-y-8 animate-in fade-in duration-200">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome, {user.name}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage your confidential notes, expiring links, and view analytics.
            </p>
          </div>

          <Link
            href="/notes/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/25 cursor-pointer self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Note</span>
          </Link>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Notes</span>
              <FileText className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white">{notes.length}</div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Share Links</span>
              <Share2 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{totalLinks}</div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Views Tracked</span>
              <Eye className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">{totalViews}</div>
          </div>
        </div>

        {/* Notes List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Your Notes
          </h2>

          {notes.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 text-center border border-dashed border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">No notes yet</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Create your first secure note to generate expiring share links.
                </p>
              </div>
              <Link
                href="/notes/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Note Now</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {notes.map((note) => (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="glass-panel glass-panel-hover p-5 rounded-2xl border border-slate-800/80 flex flex-col justify-between group"
                >
                  <div className="space-y-2 mb-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-base text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                        {note.title}
                      </h3>
                      <button
                        onClick={(e) => handleDeleteNote(note.id, e)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        title="Delete note"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-850">
                      {note.content}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Share2 className="w-3.5 h-3.5 text-blue-400" />
                        {note.total_links} {Number(note.total_links) === 1 ? 'link' : 'links'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        {note.total_views} {Number(note.total_views) === 1 ? 'view' : 'views'}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-500">
                      {new Date(note.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Public Hero Landing View
  return (
    <div className="py-12 space-y-16 animate-in fade-in duration-300">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>MERN / PERN Developer Assessment POC</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Secure Note Sharing with{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400 bg-clip-text text-transparent">
            Expiring Links
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Engineered for strict security: one-time self-destructing links, dynamic high-entropy passwords, atomic database updates preventing race conditions, and brute-force rate limiting.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-xl shadow-indigo-600/25"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-sm border border-slate-700 transition-all"
          >
            <span>Sign In (Demo Access)</span>
          </Link>
        </div>
      </div>

      {/* Feature Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-white">One-Time Self Destruct</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Atomic row-level locking ensures that concurrent users cannot double-read a one-time link. First view consumes the token; all other concurrent requests are rejected.
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-white">Dynamic Password Protection</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Dynamic cryptographic access keys hashed with bcrypt. Protected by a sliding-window rate limiter (5 attempts / 60s) preventing brute-force attacks.
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Eye className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-white">Accurate View Tracking</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Atomic SQL counters guarantee accuracy. Failed password attempts, expired tokens, and revoked links never increment the count.
          </p>
        </div>
      </div>
    </div>
  );
}
