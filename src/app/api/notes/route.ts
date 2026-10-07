import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { generateUUID, generateShareToken, generateDynamicPassword } from '@/lib/token';
import { hashPassword } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getCurrentUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT n.id, n.title, n.content, n.created_at, n.updated_at,
              COUNT(sl.id)::int as total_links,
              COALESCE(SUM(sl.view_count), 0)::int as total_views
       FROM notes n
       LEFT JOIN share_links sl ON n.id = sl.note_id
       WHERE n.user_id = $1
       GROUP BY n.id
       ORDER BY n.created_at DESC`,
      [session.userId]
    );

    return NextResponse.json({ notes: result.rows });
  } catch (error: any) {
    console.error('Fetch notes error:', error);
    return NextResponse.json({ error: 'Failed to retrieve notes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      title,
      content,
      share_type = 'ONE_TIME',
      access_type = 'PUBLIC',
      expires_in_minutes,
      custom_expiry,
    } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Note title is required' }, { status: 400 });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Note content is required' }, { status: 400 });
    }

    if (!['ONE_TIME', 'TIME_BASED'].includes(share_type)) {
      return NextResponse.json({ error: 'Invalid share type. Must be ONE_TIME or TIME_BASED' }, { status: 400 });
    }

    if (!['PUBLIC', 'PASSWORD_PROTECTED'].includes(access_type)) {
      return NextResponse.json({ error: 'Invalid access type. Must be PUBLIC or PASSWORD_PROTECTED' }, { status: 400 });
    }

    let expiresAt: Date | null = null;
    if (share_type === 'TIME_BASED') {
      if (custom_expiry) {
        const parsed = new Date(custom_expiry);
        if (isNaN(parsed.getTime()) || parsed <= new Date()) {
          return NextResponse.json({ error: 'Custom expiry must be a valid future date/time' }, { status: 400 });
        }
        expiresAt = parsed;
      } else {
        const minutes = Number(expires_in_minutes) || 60; // default 60 minutes
        expiresAt = new Date(Date.now() + minutes * 60 * 1000);
      }
    }

    let plainPassword: string | null = null;
    let passwordHash: string | null = null;

    if (access_type === 'PASSWORD_PROTECTED') {
      plainPassword = generateDynamicPassword();
      passwordHash = await hashPassword(plainPassword);
    }

    const noteId = generateUUID();
    const linkId = generateUUID();
    const token = generateShareToken();

    // Insert Note
    await query(
      `INSERT INTO notes (id, user_id, title, content)
       VALUES ($1, $2, $3, $4)`,
      [noteId, session.userId, title.trim(), content.trim()]
    );

    // Insert Share Link
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
      note: {
        id: noteId,
        title: title.trim(),
        content: content.trim(),
      },
      shareLink: {
        id: linkId,
        token,
        shareUrl,
        share_type,
        access_type,
        plain_password: plainPassword,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        view_count: 0,
      },
    });
  } catch (error: any) {
    console.error('Create note error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create note' },
      { status: 500 }
    );
  }
}
