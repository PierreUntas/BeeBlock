/**
 * POST /api/legal/accept
 *
 * Records the authenticated artist's acceptance of the privacy policy.
 * Idempotent: if already accepted, the original timestamp is preserved.
 *
 * Auth: Privy session (Bearer token)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { requireAuth } from '@/lib/auth';
import { getOrCreateSubscription, normalizeWallet } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        // Make sure a row exists for this wallet
        await getOrCreateSubscription(auth.walletAddress, auth.email);

        const wallet = normalizeWallet(auth.walletAddress);
        await sql`
            UPDATE artist_subscriptions
            SET privacy_accepted_at = NOW()
            WHERE wallet_address = ${wallet}
              AND privacy_accepted_at IS NULL
        `;

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        const status = err?.status ?? 500;
        return NextResponse.json(
            { error: err?.message || 'internal_error' },
            { status },
        );
    }
}
