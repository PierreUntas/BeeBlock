/**
 * POST /api/admin/revoke-atelier
 *
 * Revokes a previously granted free Atelier subscription, returning the
 * wallet to the free plan. Does NOT touch active Stripe-managed
 * subscriptions: if stripe_subscription_id is set we refuse to act,
 * since the artist might be a legitimate paying subscriber.
 *
 * Body: { walletAddress: string }
 * Auth: must be admin or owner of the ArtworkRegistry contract
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { requireAuth } from '@/lib/auth';
import { isAdminOrOwner } from '@/lib/admin';
import { normalizeWallet } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (!(await isAdminOrOwner(auth.walletAddress))) {
            return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const target = typeof body?.walletAddress === 'string'
            ? body.walletAddress.trim()
            : '';
        if (!/^0x[a-fA-F0-9]{40}$/.test(target)) {
            return NextResponse.json(
                { error: 'invalid_wallet_address' },
                { status: 400 },
            );
        }

        const wallet = normalizeWallet(target);
        const existing = await sql`
            SELECT stripe_subscription_id FROM artist_subscriptions
            WHERE wallet_address = ${wallet} LIMIT 1
        `;
        const row = existing.rows[0];
        if (!row) {
            return NextResponse.json(
                { error: 'no_subscription_row' },
                { status: 404 },
            );
        }
        if (row.stripe_subscription_id) {
            return NextResponse.json(
                { error: 'cannot_revoke_stripe_managed_subscription' },
                { status: 409 },
            );
        }

        await sql`
            UPDATE artist_subscriptions
            SET plan = 'free',
                status = 'none',
                current_period_start = NULL,
                current_period_end = NULL,
                cancel_at_period_end = FALSE
            WHERE wallet_address = ${wallet}
        `;

        return NextResponse.json({ ok: true, wallet });
    } catch (err: any) {
        console.error('[revoke-atelier] failed:', err?.message);
        const status = err?.status ?? 500;
        return NextResponse.json(
            { error: err?.message || 'internal_error' },
            { status },
        );
    }
}
