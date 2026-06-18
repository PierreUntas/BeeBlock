/**
 * GET /api/admin/artists
 *
 * Returns a list of all rows in artist_subscriptions, enriched with the
 * count of editions each artist has created (off-chain count from
 * edition_events). Used by the admin dashboard.
 *
 * Auth: must be admin or owner of the ArtworkRegistry contract.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { requireAuth } from '@/lib/auth';
import { isAdminOrOwner } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export interface ArtistRow {
    walletAddress: string;
    email: string | null;
    plan: 'free' | 'atelier';
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    freeQuotaUsed: number;
    privacyAcceptedAt: string | null;
    createdAt: string;
    updatedAt: string;
    editionsCount: number;
    hasStripeSubscription: boolean;
}

export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (!(await isAdminOrOwner(auth.walletAddress))) {
            return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }

        const result = await sql`
            SELECT
                s.wallet_address,
                s.email,
                s.plan,
                s.status,
                s.current_period_end,
                s.cancel_at_period_end,
                s.free_quota_used,
                s.privacy_accepted_at,
                s.created_at,
                s.updated_at,
                s.stripe_subscription_id IS NOT NULL AS has_stripe_subscription,
                COALESCE(e.cnt, 0)::int AS editions_count
            FROM artist_subscriptions s
            LEFT JOIN (
                SELECT wallet_address, COUNT(*)::int AS cnt
                FROM edition_events
                GROUP BY wallet_address
            ) e ON e.wallet_address = s.wallet_address
            ORDER BY s.updated_at DESC
        `;

        const rows: ArtistRow[] = result.rows.map((r) => ({
            walletAddress: r.wallet_address,
            email: r.email,
            plan: r.plan,
            status: r.status,
            currentPeriodEnd: r.current_period_end
                ? new Date(r.current_period_end).toISOString()
                : null,
            cancelAtPeriodEnd: r.cancel_at_period_end,
            freeQuotaUsed: r.free_quota_used,
            privacyAcceptedAt: r.privacy_accepted_at
                ? new Date(r.privacy_accepted_at).toISOString()
                : null,
            createdAt: new Date(r.created_at).toISOString(),
            updatedAt: new Date(r.updated_at).toISOString(),
            editionsCount: r.editions_count,
            hasStripeSubscription: r.has_stripe_subscription,
        }));

        return NextResponse.json({ artists: rows });
    } catch (err: any) {
        console.error('[admin/artists] failed:', err?.message);
        const status = err?.status ?? 500;
        return NextResponse.json(
            { error: err?.message || 'internal_error' },
            { status },
        );
    }
}
