import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const noteRes = await query(
      'SELECT id, user_id, title, content, created_at, updated_at FROM notes WHERE id = $1 AND user_id = $2',
      [id, session.userId]
    );

    if (noteRes.rows.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const note = noteRes.rows[0];

    const linksRes = await query(
      `SELECT id, token, share_type, access_type, plain_password, expires_at, 
              is_revoked, is_used, used_at, view_count, created_at
       FROM share_links 
       WHERE note_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [id, session.userId]
    );

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';

    const linksWithUrls = linksRes.rows.map((link) => ({
      ...link,
      shareUrl: `${protocol}://${host}/share/${link.token}`,
    }));

    return NextResponse.json({
      note,
      shareLinks: linksWithUrls,
    });
  } catch (error: any) {
    console.error('Get note error:', error);
    return NextResponse.json({ error: 'Failed to retrieve note details' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await query(
      'DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, session.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Note not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Note deleted' });
  } catch (error: any) {
    console.error('Delete note error:', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
