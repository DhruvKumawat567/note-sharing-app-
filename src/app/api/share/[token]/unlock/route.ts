import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from '@/lib/rate-limit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  // Get Client IP for brute force rate limiting
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';

  const rateLimitKey = `${ip}:${token}`;

  // 1. Check Rate Limit (Max 5 attempts per 60 seconds)
  const rateLimitStatus = checkRateLimit(rateLimitKey, 5, 60);
  if (rateLimitStatus.isBlocked) {
    return NextResponse.json(
      {
        error: `Too many failed password attempts. Access temporarily locked for security. Please retry in ${rateLimitStatus.retryAfterSeconds} seconds.`,
        retryAfter: rateLimitStatus.retryAfterSeconds,
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password or access key is required' }, { status: 400 });
    }

    // 2. Fetch share link metadata and note
    const linkRes = await query(
      `SELECT sl.id, sl.token, sl.share_type, sl.access_type,
              sl.password_hash, sl.expires_at, sl.is_revoked, sl.is_used,
              sl.view_count, n.title, n.content, n.created_at as note_created_at
       FROM share_links sl
       JOIN notes n ON sl.note_id = n.id
       WHERE sl.token = $1`,
      [token]
    );

    if (linkRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'Share link not found or invalid' },
        { status: 404 }
      );
    }

    const link = linkRes.rows[0];

    // Check if revoked
    if (link.is_revoked) {
      return NextResponse.json(
        { error: 'This share link has been revoked by the owner and is no longer accessible.' },
        { status: 403 }
      );
    }

    // Check if expired
    if (link.share_type === 'TIME_BASED' && link.expires_at) {
      const expiresAt = new Date(link.expires_at);
      if (expiresAt.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: 'This share link has expired.' },
          { status: 410 }
        );
      }
    }

    // Check if one-time link already used
    if (link.share_type === 'ONE_TIME' && link.is_used) {
      return NextResponse.json(
        { error: 'This one-time link has already been viewed and is no longer accessible.' },
        { status: 410 }
      );
    }

    // 3. Verify password
    if (!link.password_hash) {
      // If it wasn't password protected, no need to verify password
    } else {
      const isMatch = await verifyPassword(password.trim(), link.password_hash);
      if (!isMatch) {
        // Record failed attempt for brute-force protection
        const failedResult = recordFailedAttempt(rateLimitKey, 60);

        return NextResponse.json(
          {
            error: 'Incorrect password or access key. Please verify and try again.',
            remainingAttempts: failedResult.remainingAttempts,
            retryAfter: failedResult.retryAfterSeconds,
          },
          { status: 401 }
        );
      }
    }

    // Successful password match: Clear rate limit record
    clearRateLimit(rateLimitKey);

    // 4. Atomic view count update and one-time consumption
    if (link.share_type === 'ONE_TIME') {
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
            error: 'This one-time link was just accessed and consumed by another user.',
          },
          { status: 410 }
        );
      }

      return NextResponse.json({
        success: true,
        view_count: updateRes.rows[0].view_count,
        note: {
          title: link.title,
          content: link.content,
          created_at: link.note_created_at,
        },
      });
    } else {
      // TIME_BASED password-protected link
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
          { error: 'This share link has expired.' },
          { status: 410 }
        );
      }

      return NextResponse.json({
        success: true,
        view_count: updateRes.rows[0].view_count,
        note: {
          title: link.title,
          content: link.content,
          created_at: link.note_created_at,
        },
      });
    }
  } catch (error: any) {
    console.error('Password unlock error:', error);
    return NextResponse.json(
      { error: 'Internal server error while unlocking note' },
      { status: 500 }
    );
  }
}
