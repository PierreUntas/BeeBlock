/**
 * GET /api/sentry-test
 *
 * Test route: throws an intentional error to verify Sentry is wired
 * correctly. Should NOT be called by users — only by Pierre once,
 * to confirm the error shows up in the Sentry dashboard.
 *
 * Safe to leave in production: it only throws when explicitly hit,
 * and Sentry's free tier rate-limits / dedup events. You can remove
 * this file once you've confirmed the setup works.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    throw new Error(
        'Sentry test error — if you see this in Sentry, the setup works ✅',
    );
    // Unreachable, but keeps TypeScript happy
    return NextResponse.json({ ok: true });
}
