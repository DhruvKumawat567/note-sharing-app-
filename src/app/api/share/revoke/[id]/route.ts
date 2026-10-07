import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(
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
      `UPDATE share_links
       SET is_revoked = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING id, note_id, token, is_revoked, view_count`,
      [id, session.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Share link not found or you do not have permission to revoke it' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Share link has been revoked',
      shareLink: result.rows[0],
    });
  } catch (error: any) {
    console.error('Revoke share link error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke share link' },
      { status: 500 }
    );
  }
}
