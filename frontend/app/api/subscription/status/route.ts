/**
 * GET /api/subscription/status
 *
 * Returns the current subscription snapshot for the authenticated artist:
 * plan, status, remaining quota, current billing period.
 *
 * Auto-creates a default 'free' row on first call if the artist has never
 * been seen before.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { buildSnapshot, getOrCreateSubscription } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        const sub = await getOrCreateSubscription(auth.walletAddress, auth.email);
        const snapshot = await buildSnapshot(sub);
        return NextResponse.json(snapshot);
    } catch (err: any) {
        const status = err?.status ?? 500;
        return NextResponse.json(
            { error: err?.message || 'internal_error' },
            { status },
        );
    }
}
