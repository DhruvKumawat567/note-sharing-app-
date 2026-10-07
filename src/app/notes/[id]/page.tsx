'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Trash2, 
  Plus, 
  Eye, 
  ShieldAlert, 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  KeyRound, 
  Clock, 
  Zap, 
  Calendar,
  AlertTriangle,
  Loader2,
  FileText
} from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';
import { StatusBadge } from '@/components/Badge';

export default function NoteDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-slate-400">Loading note details...</div>}>
      <NoteDetailContent />
    </Suspense>
  );
}

function NoteDetailContent() {
  const params = useParams();
  const router = useRouter();
  const noteId = params?.id as string;

  const [note, setNote] = useState<any>(null);
  const [shareLinks, setShareLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New share link modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalShareType, setModalShareType] = useState<'ONE_TIME' | 'TIME_BASED'>('ONE_TIME');
  const [modalAccessType, setModalAccessType] = useState<'PUBLIC' | 'PASSWORD_PROTECTED'>('PUBLIC');
  const [modalExpiryMinutes, setModalExpiryMinutes] = useState(60);
  const [isCreatingLink, setIsCreatingLink] = useState(false);

  // Revoking state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchNoteData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/notes/${noteId}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to load note details');
      }
      const data = await res.json();
      setNote(data.note);
      setShareLinks(data.shareLinks || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (noteId) {
      fetchNoteData();
    }
  }, [noteId]);

  const handleRevoke = async (linkId: string) => {
    if (!confirm('Are you sure you want to force revoke this share link? It will immediately stop working for all users.')) {
      return;
    }

    setRevokingId(linkId);
    try {
      const res = await fetch(`/api/share/revoke/${linkId}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to revoke share link');
      // Refresh list
      fetchNoteData();
    } catch (err: any) {
      alert(err.message || 'Error revoking link');
    } finally {
      setRevokingId(null);
    }
  };

  const handleCreateShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingLink(true);

    try {
      const res = await fetch(`/api/notes/${noteId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          share_type: modalShareType,
          access_type: modalAccessType,
          expires_in_minutes: modalExpiryMinutes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create share link');

      setIsModalOpen(false);
      fetchNoteData();
    } catch (err: any) {
      alert(err.message || 'Error creating share link');
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!confirm('Are you sure you want to delete this note? All associated share links will be permanently deleted.')) {
      return;
    }

    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/');
      } else {
        alert('Failed to delete note');
      }
    } catch (err) {
      alert('Error deleting note');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm mb-4">
          {error || 'Note not found'}
        </div>
        <Link href="/" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
          ← Return to Notes Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button and page title */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Notes</span>
        </Link>

        <button
          onClick={handleDeleteNote}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:text-white hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Note</span>
        </button>
      </div>

      {/* Note Content Card */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {note.title}
          </h1>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            Created {new Date(note.created_at).toLocaleString()}
          </span>
        </div>

        {/* Content Box */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-sm text-slate-200 whitespace-pre-wrap break-words">
          {note.content}
        </div>
      </div>

      {/* Share Links Management Section */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-400" />
              Active & Historic Share Links
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage link policies, track view counts, copy passwords, or force invalidate access.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate Another Link</span>
          </button>
        </div>

        {/* Links List */}
        {shareLinks.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
            No share links created yet for this note.
          </div>
        ) : (
          <div className="space-y-4">
            {shareLinks.map((link) => {
              const isExpired =
                link.share_type === 'TIME_BASED' &&
                link.expires_at &&
                new Date(link.expires_at).getTime() <= Date.now();
              const isOneTimeUsed = link.share_type === 'ONE_TIME' && link.is_used;
              const isRevoked = link.is_revoked;

              let statusType: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'USED' = 'ACTIVE';
              if (isRevoked) statusType = 'REVOKED';
              else if (isOneTimeUsed) statusType = 'USED';
              else if (isExpired) statusType = 'EXPIRED';

              return (
                <div
                  key={link.id}
                  className={`p-4 sm:p-5 rounded-xl border transition-all ${
                    statusType === 'ACTIVE'
                      ? 'bg-slate-900/80 border-slate-700/80'
                      : 'bg-slate-950/40 border-slate-850 opacity-80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge type={statusType} />
                      <StatusBadge type={link.share_type} />
                      <StatusBadge type={link.access_type} />
                    </div>

                    {/* View Count Display */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300">
                      <Eye className="w-3.5 h-3.5 text-indigo-400" />
                      <span>
                        Views: <strong className="text-white">{link.view_count}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Share URL */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                    <div className="flex-1 p-2 rounded-lg bg-slate-950 font-mono text-xs text-indigo-300 truncate border border-slate-800">
                      {link.shareUrl}
                    </div>
                    <div className="flex items-center gap-2">
                      <CopyButton textToCopy={link.shareUrl} label="Copy Link" />
                      <a
                        href={link.shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                        title="Open Link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Metadata & Password Info */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                    <div className="flex flex-wrap items-center gap-4">
                      {/* Password Key if protected */}
                      {link.plain_password && (
                        <div className="flex items-center gap-1.5 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-500/20 text-purple-300">
                          <KeyRound className="w-3 h-3 text-purple-400" />
                          <span>Key: <strong className="font-mono">{link.plain_password}</strong></span>
                          <CopyButton textToCopy={link.plain_password} label="Copy" className="text-[10px] py-0.5" />
                        </div>
                      )}

                      {/* Expiry info */}
                      {link.expires_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          Expires: {new Date(link.expires_at).toLocaleString()}
                        </span>
                      )}

                      {/* Created date */}
                      <span>Created {new Date(link.created_at).toLocaleDateString()}</span>
                    </div>

                    {/* Revoke Action */}
                    {!link.is_revoked && !isExpired && !isOneTimeUsed && (
                      <button
                        onClick={() => handleRevoke(link.id)}
                        disabled={revokingId === link.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-all cursor-pointer"
                      >
                        {revokingId === link.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <ShieldAlert className="w-3 h-3" />
                        )}
                        <span>Revoke Link</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal for Generating Additional Share Link */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-5">
            <h3 className="text-lg font-bold text-white">Generate Additional Share Link</h3>

            <form onSubmit={handleCreateShareLink} className="space-y-4">
              {/* Share Type */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Share Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalShareType('ONE_TIME')}
                    className={`p-2.5 rounded-lg border text-xs font-medium text-left cursor-pointer ${
                      modalShareType === 'ONE_TIME'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    ⚡ One-Time Access
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalShareType('TIME_BASED')}
                    className={`p-2.5 rounded-lg border text-xs font-medium text-left cursor-pointer ${
                      modalShareType === 'TIME_BASED'
                        ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    ⏳ Time-Based
                  </button>
                </div>
              </div>

              {/* Time based options */}
              {modalShareType === 'TIME_BASED' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Duration
                  </label>
                  <select
                    value={modalExpiryMinutes}
                    onChange={(e) => setModalExpiryMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 outline-none"
                  >
                    <option value={10}>10 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={360}>6 hours</option>
                    <option value={1440}>24 hours</option>
                    <option value={10080}>7 days</option>
                  </select>
                </div>
              )}

              {/* Access Type */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Access Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalAccessType('PUBLIC')}
                    className={`p-2.5 rounded-lg border text-xs font-medium text-left cursor-pointer ${
                      modalAccessType === 'PUBLIC'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    🌐 Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalAccessType('PASSWORD_PROTECTED')}
                    className={`p-2.5 rounded-lg border text-xs font-medium text-left cursor-pointer ${
                      modalAccessType === 'PASSWORD_PROTECTED'
                        ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    🔒 Password-Protected
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingLink}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  {isCreatingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Create Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
