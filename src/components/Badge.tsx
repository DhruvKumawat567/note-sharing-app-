import React from 'react';
import { Clock, Zap, Lock, Globe, CheckCircle2, AlertTriangle, XCircle, ShieldAlert } from 'lucide-react';

interface BadgeProps {
  type: 'ONE_TIME' | 'TIME_BASED' | 'PUBLIC' | 'PASSWORD_PROTECTED' | 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'USED';
  className?: string;
}

export function StatusBadge({ type, className = '' }: BadgeProps) {
  switch (type) {
    case 'ONE_TIME':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 ${className}`}>
          <Zap className="w-3 h-3 text-amber-400" />
          One-Time Access
        </span>
      );
    case 'TIME_BASED':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 ${className}`}>
          <Clock className="w-3 h-3 text-blue-400" />
          Time-Based
        </span>
      );
    case 'PUBLIC':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className}`}>
          <Globe className="w-3 h-3 text-emerald-400" />
          Public
        </span>
      );
    case 'PASSWORD_PROTECTED':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 ${className}`}>
          <Lock className="w-3 h-3 text-purple-400" />
          Password-Protected
        </span>
      );
    case 'ACTIVE':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className}`}>
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          Active
        </span>
      );
    case 'EXPIRED':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 ${className}`}>
          <AlertTriangle className="w-3 h-3 text-orange-400" />
          Expired
        </span>
      );
    case 'REVOKED':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 ${className}`}>
          <ShieldAlert className="w-3 h-3 text-rose-400" />
          Revoked
        </span>
      );
    case 'USED':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/15 text-slate-400 border border-slate-500/20 ${className}`}>
          <XCircle className="w-3 h-3 text-slate-400" />
          One-Time Used
        </span>
      );
    default:
      return null;
  }
}
