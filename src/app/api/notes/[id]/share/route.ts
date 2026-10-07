import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { generateUUID, generateShareToken, generateDynamicPassword } from '@/lib/token';
import { hashPassword } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: noteId } = await params;

  try {
    // Verify user owns the note
    const noteRes = await query(
      'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
      [noteId, session.userId]
    );

    if (noteRes.rows.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const body = await req.json();
    const {
      share_type = 'ONE_TIME',
      access_type = 'PUBLIC',
      expires_in_minutes,
      custom_expiry,
    } = body;

    if (!['ONE_TIME', 'TIME_BASED'].includes(share_type)) {
      return NextResponse.json({ error: 'Invalid share type' }, { status: 400 });
    }

    if (!['PUBLIC', 'PASSWORD_PROTECTED'].includes(access_type)) {
      return NextResponse.json({ error: 'Invalid access type' }, { status: 400 });
    }

    let expiresAt: Date | null = null;
    if (share_type === 'TIME_BASED') {
      if (custom_expiry) {
        const parsed = new Date(custom_expiry);
        if (isNaN(parsed.getTime()) || parsed <= new Date()) {
          return NextResponse.json({ error: 'Custom expiry must be in the future' }, { status: 400 });
        }
        expiresAt = parsed;
      } else {
        const minutes = Number(expires_in_minutes) || 60;
        expiresAt = new Date(Date.now() + minutes * 60 * 1000);
      }
    }

    let plainPassword: string | null = null;
    let passwordHash: string | null = null;

    if (access_type === 'PASSWORD_PROTECTED') {
      plainPassword = generateDynamicPassword();
      passwordHash = await hashPassword(plainPassword);
    }

    const linkId = generateUUID();
    const token = generateShareToken();

    await query(
      `INSERT INTO share_links 
       (id, note_id, user_id, token, share_type, access_type, password_hash, plain_password, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        linkId,
        noteId,
        session.userId,
        token,
        share_type,
        access_type,
        passwordHash,
        plainPassword,
        expiresAt ? expiresAt.toISOString() : null,
      ]
    );

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const shareUrl = `${protocol}://${host}/share/${token}`;

    return NextResponse.json({
      success: true,
      shareLink: {
        id: linkId,
        note_id: noteId,
        token,
        shareUrl,
        share_type,
        access_type,
        plain_password: plainPassword,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        is_revoked: false,
        is_used: false,
        view_count: 0,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Create additional share link error:', error);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}
