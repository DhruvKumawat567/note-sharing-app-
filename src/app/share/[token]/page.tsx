'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { 
  Lock, 
  Unlock, 
  ShieldAlert, 
  AlertTriangle, 
  XCircle, 
  Eye, 
  Clock, 
  Zap, 
  Copy, 
  Check, 
  Loader2, 
  FileText, 
  ShieldCheck,
  EyeOff
} from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';

type PageStatus = 
  | 'LOADING'
  | 'PUBLIC_AVAILABLE'
  | 'PASSWORD_REQUIRED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'ALREADY_USED'
  | 'NOT_FOUND'
  | 'ERROR';

export default function ShareViewPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-slate-400">Loading shared note...</div>}>
      <ShareViewContent />
    </Suspense>
  );
}

function ShareViewContent() {
  const params = useParams();
  const token = params?.token as string;

  const [status, setStatus] = useState<PageStatus>('LOADING');
  const [errorMessage, setErrorMessage] = useState('');
  const [noteData, setNoteData] = useState<{
    title: string;
    content: string;
    created_at: string;
  } | null>(null);

  const [shareType, setShareType] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState<number>(0);

  // Password Unlock state
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const loadShareLink = async () => {
    try {
      setStatus('LOADING');
      const res = await fetch(`/api/share/${token}`);
      const data = await res.json();

      if (res.status === 404) {
        setStatus('NOT_FOUND');
        setErrorMessage(data.error || 'This link does not exist.');
        return;
      }

      if (res.status === 403) {
        setStatus('REVOKED');
        setErrorMessage(data.error || 'This link was revoked by the owner.');
        return;
      }

      if (res.status === 410) {
        if (data.status === 'ALREADY_USED') {
          setStatus('ALREADY_USED');
          setErrorMessage(data.error || 'This one-time link has already been used.');
        } else {
          setStatus('EXPIRED');
          setErrorMessage(data.error || 'This share link has expired.');
        }
        return;
      }

      if (!res.ok) {
        setStatus('ERROR');
        setErrorMessage(data.error || 'Failed to load shared note.');
        return;
      }

      if (data.status === 'PASSWORD_REQUIRED') {
        setStatus('PASSWORD_REQUIRED');
        setShareType(data.share_type);
        setExpiresAt(data.expires_at);
        return;
      }

      if (data.status === 'PUBLIC_AVAILABLE') {
        setStatus('PUBLIC_AVAILABLE');
        setNoteData(data.note);
        setViewCount(data.view_count || 1);
        setShareType(data.share_type);
        setExpiresAt(data.expires_at);
        return;
      }
    } catch (err: any) {
      setStatus('ERROR');
      setErrorMessage(err.message || 'Network error retrieving share link.');
    }
  };

  useEffect(() => {
    if (token) {
      loadShareLink();
    }
  }, [token]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setUnlockError('Please enter the password or access key');
      return;
    }

    setUnlockLoading(true);
    setUnlockError('');

    try {
      const res = await fetch(`/api/share/${token}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();

      if (res.status === 429) {
        // Rate limited
        setUnlockError(data.error || 'Rate limit exceeded. Too many failed attempts.');
        return;
      }

      if (res.status === 401) {
        // Wrong password
        setUnlockError(data.error || 'Invalid password.');
        if (typeof data.remainingAttempts === 'number') {
          setRemainingAttempts(data.remainingAttempts);
        }
        return;
      }

      if (res.status === 410) {
        setStatus('ALREADY_USED');
        setErrorMessage(data.error || 'This link has expired or was already consumed.');
        return;
      }

      if (!res.ok) {
        setUnlockError(data.error || 'Failed to unlock note.');
        return;
      }

      // Successful Unlock!
      setNoteData(data.note);
      setViewCount(data.view_count);
      setStatus('PUBLIC_AVAILABLE');
    } catch (err: any) {
      setUnlockError(err.message || 'Network error unlocking note');
    } finally {
      setUnlockLoading(false);
    }
  };

  // 1. Loading State
  if (status === 'LOADING') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
        <p className="text-sm text-slate-400">Verifying secure link cryptographic integrity...</p>
      </div>
    );
  }

  // 2. Revoked State
  if (status === 'REVOKED') {
    return (
      <div className="max-w-md mx-auto py-16 text-center animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center mb-5">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Share Link Revoked</h1>
        <p className="text-sm text-slate-400 mb-6">
          {errorMessage || 'This share link has been revoked by the owner and can no longer be accessed.'}
        </p>
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 inline-block">
          Status Code: <span className="text-rose-400 font-mono font-semibold">403 Forbidden</span>
        </div>
      </div>
    );
  }

  // 3. Expired State
  if (status === 'EXPIRED') {
    return (
      <div className="max-w-md mx-auto py-16 text-center animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-3xl bg-orange-500/10 border border-orange-500/20 text-orange-400 mx-auto flex items-center justify-center mb-5">
          <Clock className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Link Expired</h1>
        <p className="text-sm text-slate-400 mb-6">
          {errorMessage || 'The time window configured for this share link has elapsed.'}
        </p>
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 inline-block">
          Status Code: <span className="text-orange-400 font-mono font-semibold">410 Expired</span>
        </div>
      </div>
    );
  }

  // 4. One-Time Link Already Used State
  if (status === 'ALREADY_USED') {
    return (
      <div className="max-w-md mx-auto py-16 text-center animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-5">
          <Zap className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">One-Time Link Used</h1>
        <p className="text-sm text-slate-400 mb-6">
          {errorMessage || 'This link was configured for one-time access and has already been viewed. It was immediately destroyed for security.'}
        </p>
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 inline-block">
          Security Guarantee: <span className="text-amber-400 font-semibold">Self-Destruct Executed</span>
        </div>
      </div>
    );
  }

  // 5. Not Found / Invalid State
  if (status === 'NOT_FOUND') {
    return (
      <div className="max-w-md mx-auto py-16 text-center animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-3xl bg-slate-800 border border-slate-700 text-slate-400 mx-auto flex items-center justify-center mb-5">
          <XCircle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Invalid Share Link</h1>
        <p className="text-sm text-slate-400 mb-6">
          {errorMessage || 'This token does not correspond to any active share link.'}
        </p>
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 inline-block">
          Status Code: <span className="text-slate-300 font-mono font-semibold">404 Not Found</span>
        </div>
      </div>
    );
  }

  // 6. Password Required State
  if (status === 'PASSWORD_REQUIRED') {
    return (
      <div className="min-h-[65vh] flex items-center justify-center py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mx-auto flex items-center justify-center mb-4 shadow-lg shadow-purple-500/10">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Password Protected Note</h1>
            <p className="text-sm text-slate-400 mt-1.5">
              Enter the dynamic access key or password to decrypt and view this note.
            </p>
          </div>

          <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-2xl">
            {unlockError && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span>{unlockError}</span>
                  {remainingAttempts !== null && remainingAttempts > 0 && (
                    <div className="text-xs font-semibold text-rose-400">
                      Remaining attempts before lockout: {remainingAttempts}
                    </div>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Access Key / Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="e.g. Ab4k-Tm9x-R2wQ"
                    className="w-full pl-4 pr-11 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm font-mono text-slate-100 placeholder-slate-500 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {shareType === 'ONE_TIME' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>
                    <strong>One-Time Note:</strong> Unlocking will destroy this link. Copy the content immediately after viewing.
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={unlockLoading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium text-sm transition-all shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                {unlockLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Decrypting Note...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Unlock Note</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // 7. Unlocked / Public Content Display
  if (status === 'PUBLIC_AVAILABLE' && noteData) {
    return (
      <div className="max-w-3xl mx-auto py-6 space-y-6 animate-in fade-in duration-200">
        {/* Status header banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/20">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <div>
              <span className="text-xs font-semibold text-indigo-200 uppercase tracking-wider block">
                Secure Decrypted Note
              </span>
              <span className="text-[11px] text-slate-400">
                Created {new Date(noteData.created_at).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Count Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                Total Views: <strong className="text-white">{viewCount}</strong>
              </span>
            </div>

            <CopyButton textToCopy={noteData.content} label="Copy Note" />
          </div>
        </div>

        {/* One-Time link warning banner */}
        {shareType === 'ONE_TIME' && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>One-time access notice:</strong> This link has now expired. If you refresh or close this tab, this note will no longer be accessible.
            </span>
          </div>
        )}

        {/* Note viewer card */}
        <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-2xl space-y-4">
          <h1 className="text-2xl font-bold text-white tracking-tight border-b border-slate-800/80 pb-4">
            {noteData.title}
          </h1>

          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-sm text-slate-100 whitespace-pre-wrap leading-relaxed select-text">
            {noteData.content}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
