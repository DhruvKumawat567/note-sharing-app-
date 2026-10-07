import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json(
      { status: 'NOT_FOUND', error: 'Token is required' },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch link metadata and note
    const linkRes = await query(
      `SELECT sl.id, sl.note_id, sl.token, sl.share_type, sl.access_type,
              sl.expires_at, sl.is_revoked, sl.is_used, sl.view_count,
              n.title, n.content, n.created_at as note_created_at
       FROM share_links sl
       JOIN notes n ON sl.note_id = n.id
       WHERE sl.token = $1`,
      [token]
    );

    if (linkRes.rows.length === 0) {
      return NextResponse.json(
        { status: 'NOT_FOUND', error: 'This share link is invalid or does not exist.' },
        { status: 404 }
      );
    }

    const link = linkRes.rows[0];

    // 2. Check if revoked
    if (link.is_revoked) {
      return NextResponse.json(
        {
          status: 'REVOKED',
          error: 'This share link has been revoked by the owner and is no longer accessible.',
        },
        { status: 403 }
      );
    }

    // 3. Check if time-based expired
    if (link.share_type === 'TIME_BASED' && link.expires_at) {
      const expiresAt = new Date(link.expires_at);
      if (expiresAt.getTime() <= Date.now()) {
        return NextResponse.json(
          {
            status: 'EXPIRED',
            error: 'This share link has expired.',
            expires_at: link.expires_at,
          },
          { status: 410 }
        );
      }
    }

    // 4. Check if one-time link is already used
    if (link.share_type === 'ONE_TIME' && link.is_used) {
      return NextResponse.json(
        {
          status: 'ALREADY_USED',
          error: 'This one-time link has already been viewed and is no longer accessible.',
        },
        { status: 410 }
      );
    }

    // 5. If password protected, require password unlock before showing content or updating counts
    if (link.access_type === 'PASSWORD_PROTECTED') {
      return NextResponse.json({
        status: 'PASSWORD_REQUIRED',
        share_type: link.share_type,
        access_type: link.access_type,
        expires_at: link.expires_at,
        created_at: link.note_created_at,
      });
    }

    // 6. Public link access: Atomic update for view count & one-time consumption
    if (link.share_type === 'ONE_TIME') {
      // Atomic compare-and-swap for one-time links
      const updateRes = await query(
        `UPDATE share_links
         SET is_used = TRUE,
             used_at = NOW(),
             view_count = view_count + 1
         WHERE token = $1
           AND is_used = FALSE
           AND is_revoked = FALSE
           AND (expires_at IS NULL OR expires_at > NOW())
         RETURNING view_count`,
        [token]
      );

      if (updateRes.rows.length === 0) {
        // Race condition: concurrent user accessed and consumed it right now!
        return NextResponse.json(
          {
            status: 'ALREADY_USED',
            error: 'This one-time link was just accessed by another user and has expired.',
          },
          { status: 410 }
        );
      }

      return NextResponse.json({
        status: 'PUBLIC_AVAILABLE',
        share_type: 'ONE_TIME',
        access_type: 'PUBLIC',
        view_count: updateRes.rows[0].view_count,
        note: {
          title: link.title,
          content: link.content,
          created_at: link.note_created_at,
        },
      });
    } else {
      // TIME_BASED public link
      const updateRes = await query(
        `UPDATE share_links
         SET view_count = view_count + 1
         WHERE token = $1
           AND is_revoked = FALSE
           AND (expires_at IS NULL OR expires_at > NOW())
         RETURNING view_count`,
        [token]
      );

      if (updateRes.rows.length === 0) {
        return NextResponse.json(
          {
            status: 'EXPIRED',
            error: 'This share link has expired.',
          },
          { status: 410 }
        );
      }

      return NextResponse.json({
        status: 'PUBLIC_AVAILABLE',
        share_type: 'TIME_BASED',
        access_type: 'PUBLIC',
        expires_at: link.expires_at,
        view_count: updateRes.rows[0].view_count,
        note: {
          title: link.title,
          content: link.content,
          created_at: link.note_created_at,
        },
      });
    }
  } catch (error: any) {
    console.error('Share link access error:', error);
    return NextResponse.json(
      { status: 'ERROR', error: 'Internal server error while retrieving share link' },
      { status: 500 }
    );
  }
}
