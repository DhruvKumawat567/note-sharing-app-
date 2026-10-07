'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Shield, 
  Zap, 
  Clock, 
  Lock, 
  Globe, 
  Copy, 
  Check, 
  ExternalLink, 
  ArrowRight, 
  AlertCircle, 
  Loader2, 
  KeyRound,
  FileText,
  Sparkles
} from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';

export default function NewNotePage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [shareType, setShareType] = useState<'ONE_TIME' | 'TIME_BASED'>('ONE_TIME');
  const [accessType, setAccessType] = useState<'PUBLIC' | 'PASSWORD_PROTECTED'>('PUBLIC');
  const [expiryMinutes, setExpiryMinutes] = useState<number>(60);
  const [customExpiry, setCustomExpiry] = useState<string>('');
  const [isCustomExpiry, setIsCustomExpiry] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Result state after creation
  const [createdResult, setCreatedResult] = useState<{
    noteId: string;
    shareUrl: string;
    plainPassword?: string | null;
    shareType: string;
    accessType: string;
    expiresAt?: string | null;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please provide a note title');
      return;
    }

    if (!content.trim()) {
      setError('Please provide note content');
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        title: title.trim(),
        content: content.trim(),
        share_type: shareType,
        access_type: accessType,
      };

      if (shareType === 'TIME_BASED') {
        if (isCustomExpiry && customExpiry) {
          payload.custom_expiry = new Date(customExpiry).toISOString();
        } else {
          payload.expires_in_minutes = expiryMinutes;
        }
      }

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create note');
      }

      setCreatedResult({
        noteId: data.note.id,
        shareUrl: data.shareLink.shareUrl,
        plainPassword: data.shareLink.plain_password,
        shareType: data.shareLink.share_type,
        accessType: data.shareLink.access_type,
        expiresAt: data.shareLink.expires_at,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTitle('');
    setContent('');
    setShareType('ONE_TIME');
    setAccessType('PUBLIC');
    setCreatedResult(null);
  };

  return (
    <div className="max-w-3xl mx-auto py-4">
      {/* Creation Success Modal / Card */}
      {createdResult ? (
        <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-emerald-500/30 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Share Link Generated!</h2>
              <p className="text-xs text-slate-400">
                Your note is saved and the secure share link is ready for distribution.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Share Link Box */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Secure Share Link
                </span>
                <CopyButton textToCopy={createdResult.shareUrl} label="Copy Link" />
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 font-mono text-xs text-indigo-300 break-all select-all border border-slate-800/80">
                {createdResult.shareUrl}
              </div>
            </div>

            {/* Dynamic Password Display if password-protected */}
            {createdResult.plainPassword && (
              <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-purple-200 uppercase tracking-wider">
                      Dynamic Access Key (Password)
                    </span>
                  </div>
                  <CopyButton textToCopy={createdResult.plainPassword} label="Copy Key" />
                </div>
                <div className="p-3 rounded-lg bg-slate-950 text-center font-mono text-lg font-bold tracking-widest text-purple-300 border border-purple-500/20 select-all">
                  {createdResult.plainPassword}
                </div>
                <p className="text-[11px] text-purple-300/80 mt-2">
                  ⚠️ Note: The recipient must enter this dynamic key to unlock the note content.
                </p>
              </div>
            )}

            {/* Policy Summary */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex flex-wrap gap-4 items-center justify-between">
              <div>
                <span className="text-slate-500">Share Type: </span>
                <span className="font-medium text-slate-200">
                  {createdResult.shareType === 'ONE_TIME' ? '⚡ One-Time (Self-destruct)' : '⏳ Time-Based'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Access Type: </span>
                <span className="font-medium text-slate-200">
                  {createdResult.accessType === 'PUBLIC' ? '🌐 Public' : '🔒 Password Protected'}
                </span>
              </div>
              {createdResult.expiresAt && (
                <div>
                  <span className="text-slate-500">Expires At: </span>
                  <span className="font-medium text-slate-200">
                    {new Date(createdResult.expiresAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
              <a
                href={createdResult.shareUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/20"
              >
                <span>Test Open Link</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <Link
                href={`/notes/${createdResult.noteId}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-all border border-slate-700"
              >
                <span>View Note Details</span>
              </Link>

              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 text-sm transition-all cursor-pointer"
              >
                Create Another
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Create Note Form */
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-400" />
              Create a Secure Note
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Store sensitive content and generate an expiring, revocable share link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-300 text-sm">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Note Details */}
            <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Note Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Production API Keys, Database Password, Private Memo"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm text-slate-100 placeholder-slate-500 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Secret Content
                </label>
                <textarea
                  required
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste your sensitive keys, passwords, credentials or notes here..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm font-mono text-slate-100 placeholder-slate-500 transition-all outline-none resize-y"
                />
              </div>
            </div>

            {/* Share Configuration */}
            <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800 space-y-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                Security & Expiry Controls
              </h3>

              {/* 1. Share Type */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  1. Select Share Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setShareType('ONE_TIME')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      shareType === 'ONE_TIME'
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-200 shadow-md shadow-amber-500/10'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Zap className={`w-5 h-5 ${shareType === 'ONE_TIME' ? 'text-amber-400' : 'text-slate-500'}`} />
                      <span className="font-semibold text-sm text-slate-100">One-Time Access</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Self-destructs after the first successful view or unlock. Protected against race conditions.
                    </p>
                  </div>

                  <div
                    onClick={() => setShareType('TIME_BASED')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      shareType === 'TIME_BASED'
                        ? 'bg-blue-500/10 border-blue-500/40 text-blue-200 shadow-md shadow-blue-500/10'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Clock className={`w-5 h-5 ${shareType === 'TIME_BASED' ? 'text-blue-400' : 'text-slate-500'}`} />
                      <span className="font-semibold text-sm text-slate-100">Time-Based Access</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Can be viewed multiple times until the scheduled expiry time arrives.
                    </p>
                  </div>
                </div>
              </div>

              {/* Expiry selection if time-based */}
              {shareType === 'TIME_BASED' && (
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <label className="block text-xs font-medium text-slate-300">
                    Expiry Duration
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '10 mins', value: 10 },
                      { label: '1 hour', value: 60 },
                      { label: '6 hours', value: 360 },
                      { label: '24 hours', value: 1440 },
                      { label: '7 days', value: 10080 },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setIsCustomExpiry(false);
                          setExpiryMinutes(opt.value);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          !isCustomExpiry && expiryMinutes === opt.value
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsCustomExpiry(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        isCustomExpiry
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Custom Date/Time
                    </button>
                  </div>

                  {isCustomExpiry && (
                    <div className="mt-3">
                      <input
                        type="datetime-local"
                        value={customExpiry}
                        onChange={(e) => setCustomExpiry(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 outline-none focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 2. Access Type */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  2. Select Access Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setAccessType('PUBLIC')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      accessType === 'PUBLIC'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Globe className={`w-5 h-5 ${accessType === 'PUBLIC' ? 'text-emerald-400' : 'text-slate-500'}`} />
                      <span className="font-semibold text-sm text-slate-100">Public Access</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Direct view without password. Openable by anyone holding the link token.
                    </p>
                  </div>

                  <div
                    onClick={() => setAccessType('PASSWORD_PROTECTED')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      accessType === 'PASSWORD_PROTECTED'
                        ? 'bg-purple-500/10 border-purple-500/40 text-purple-200 shadow-md shadow-purple-500/10'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Lock className={`w-5 h-5 ${accessType === 'PASSWORD_PROTECTED' ? 'text-purple-400' : 'text-slate-500'}`} />
                      <span className="font-semibold text-sm text-slate-100">Password-Protected</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Generates a dynamic high-entropy access key. Protected against brute-force attacks.
                    </p>
                  </div>
                </div>

                {accessType === 'PASSWORD_PROTECTED' && (
                  <div className="mt-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 flex items-center gap-2.5">
                    <KeyRound className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span>
                      A dynamic cryptographic access key (e.g. <code>Ab4k-Tm9x-R2wQ</code>) will be generated automatically and shown on creation.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                href="/"
                className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 text-sm transition-all"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/25 flex items-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Note & Link...</span>
                  </>
                ) : (
                  <>
                    <span>Create Note & Share Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
