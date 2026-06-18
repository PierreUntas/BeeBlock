/**
 * POST /api/subscription/portal
 *
 * Generates a Stripe Customer Portal link so the artist can:
 *  - View invoices
 *  - Update payment method
 *  - Cancel their subscription
 *
 * Returns 404 if the artist has no Stripe customer yet (i.e. never subscribed).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getOrCreateSubscription } from '@/lib/db';
import { APP_URL, getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        const sub = await getOrCreateSubscription(auth.walletAddress, auth.email);
        if (!sub.stripeCustomerId) {
            return NextResponse.json({ error: 'no_customer' }, { status: 404 });
        }
        const stripe = getStripe();
        const portal = await stripe.billingPortal.sessions.create({
            customer: sub.stripeCustomerId,
            return_url: `${APP_URL}/artist/subscription`,
        });
        return NextResponse.json({ url: portal.url });
    } catch (err: any) {
        const status = err?.status ?? 500;
        return NextResponse.json(
            { error: err?.message || 'internal_error' },
            { status },
        );
    }
}
