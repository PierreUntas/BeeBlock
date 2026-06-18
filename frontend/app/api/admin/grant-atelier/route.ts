/**
 * POST /api/admin/grant-atelier
 *
 * Grants an indefinite free Atelier subscription to a target wallet.
 * Used to comp pilot artists without going through Stripe.
 *
 * Body: { walletAddress: string }
 * Auth: must be admin or owner of the ArtworkRegistry contract
 *
 * Sets:
 *  - plan = 'atelier'
 *  - status = 'active'
 *  - current_period_start = NOW()
 *  - current_period_end = '2099-12-31' (effectively indefinite)
 *  - cancel_at_period_end = false
 *  - stripe_customer_id / stripe_subscription_id untouched (remain NULL
 *    since no Stripe transaction occurred)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isAdminOrOwner } from '@/lib/admin';
import {
    getOrCreateSubscription,
    updateSubscription,
    normalizeWallet,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

const INDEFINITE_END = new Date('2099-12-31T23:59:59Z');

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
        await getOrCreateSubscription(wallet, null);
        await updateSubscription(wallet, {
            plan: 'atelier',
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: INDEFINITE_END,
            cancelAtPeriodEnd: false,
        });

        return NextResponse.json({ ok: true, wallet });
    } catch (err: any) {
        console.error('[grant-atelier] failed:', err?.message);
        const status = err?.status ?? 500;
        return NextResponse.json(
            { error: err?.message || 'internal_error' },
            { status },
        );
    }
}
