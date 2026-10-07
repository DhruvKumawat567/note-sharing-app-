export type ShareType = 'ONE_TIME' | 'TIME_BASED';
export type AccessType = 'PUBLIC' | 'PASSWORD_PROTECTED';

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ShareLink {
  id: string;
  note_id: string;
  user_id: string;
  token: string;
  share_type: ShareType;
  access_type: AccessType;
  password_hash: string | null;
  plain_password?: string | null; // stored or returned once for creator's reference
  expires_at: string | null;
  is_revoked: boolean;
  is_used: boolean;
  used_at: string | null;
  view_count: number;
  created_at: string;
}

export interface ShareLinkPublicView {
  status: 'PUBLIC_AVAILABLE' | 'PASSWORD_REQUIRED' | 'EXPIRED' | 'REVOKED' | 'ALREADY_USED' | 'NOT_FOUND';
  share_type?: ShareType;
  access_type?: AccessType;
  expires_at?: string | null;
  note?: {
    title: string;
    content: string;
    created_at: string;
  };
  view_count?: number;
  message?: string;
}

export interface CreateNoteInput {
  title: string;
  content: string;
  share_type: ShareType;
  access_type: AccessType;
  expires_in_minutes?: number | null; // e.g. 10, 60, 1440, etc.
  custom_expiry?: string | null; // ISO string
}
