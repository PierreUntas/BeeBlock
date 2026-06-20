/**
 * POST /api/subscription/checkout
 *
 * Creates a Stripe Checkout Session for the Atelier subscription and returns
 * its URL. The frontend redirects the browser to this URL.
 *
 * If the artist already has a Stripe customer, we reuse it. Otherwise we let
 * Stripe create one and persist the ID in the DB via the webhook flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
    getOrCreateSubscription,
    updateSubscription,
    setPreferredLocale,
    type Locale,
} from '@/lib/db';
import { APP_URL, STRIPE_PRICE_ID, getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

function detectLocale(req: NextRequest): Locale {
    const referer = req.headers.get('referer') || '';
    if (/\/de(\/|$)/.test(referer)) return 'de';
    return 'fr';
}

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (!STRIPE_PRICE_ID) {
            return NextResponse.json({ error: 'price_not_configured' }, { status: 500 });
        }

        const stripe = getStripe();
        const sub = await getOrCreateSubscription(auth.walletAddress, auth.email);
        // Capture the user's current locale so the welcome email is in their language.
        await setPreferredLocale(auth.walletAddress, detectLocale(req));

        // Reuse existing Stripe customer if any, otherwise create one
        let customerId = sub.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: auth.email ?? undefined,
                metadata: {
                    wallet_address: auth.walletAddress,
                    privy_user_id: auth.userId,
                },
            });
            customerId = customer.id;
            await updateSubscription(auth.walletAddress, { stripeCustomerId: customerId });
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: customerId,
            line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
            success_url: `${APP_URL}/artist/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${APP_URL}/artist/subscription?canceled=true`,
            metadata: {
                wallet_address: auth.walletAddress,
            },
            // EU consumer-rights compliance: explicit ToS acceptance.
            // Requires a Terms of Service URL configured in Stripe Dashboard
            // → Settings → Public details → Terms of service URL pointing to
            // https://www.monaeditions.com/legal/terms before this is enabled.
            consent_collection: {
                terms_of_service: 'required',
            },
        });

        if (!session.url) {
            return NextResponse.json({ error: 'no_session_url' }, { status: 500 });
        }
        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        // Log the full error to Vercel function logs so we can diagnose
        // mismatches between code / Stripe account configuration / env vars.
        console.error('[checkout] failed:', {
            message: err?.message,
            code: err?.code,
            type: err?.type,
            statusCode: err?.statusCode,
            raw: err?.raw,
        });
        const status = err?.statusCode ?? err?.status ?? 500;
        return NextResponse.json(
            {
                error: err?.message || 'internal_error',
                code: err?.code,
                type: err?.type,
            },
            { status },
        );
    }
}
