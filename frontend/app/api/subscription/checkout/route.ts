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
    recordWithdrawalWaiver,
    type Locale,
} from '@/lib/db';
import { APP_URL, STRIPE_PRICE_ID, getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

function detectLocale(req: NextRequest): Locale {
    const referer = req.headers.get('referer') || '';
    if (/\/de(\/|$)/.test(referer)) return 'de';
    if (/\/en(\/|$)/.test(referer)) return 'en';
    return 'fr';
}

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (!STRIPE_PRICE_ID) {
            return NextResponse.json({ error: 'price_not_configured' }, { status: 500 });
        }

        // Parse the body: the frontend MUST send `{ withdrawalWaiver: true }`
        // to confirm the user has explicitly accepted to start service
        // immediately and waive their 14-day right of withdrawal.
        // Without this, we reject the request — the alternative is to leave
        // the subscription rescindable for 14 days, which would expose us to
        // refund requests after service consumption.
        let body: { withdrawalWaiver?: boolean } = {};
        try {
            body = await req.json();
        } catch {
            // body parsing failed — treat as missing
        }
        if (body?.withdrawalWaiver !== true) {
            return NextResponse.json(
                { error: 'withdrawal_waiver_required' },
                { status: 400 },
            );
        }

        const stripe = getStripe();
        const sub = await getOrCreateSubscription(auth.walletAddress, auth.email);

        // Record the waiver timestamp BEFORE creating the Checkout Session.
        // If the user abandons Stripe, we still have proof of their consent
        // at the moment of the click (CGV art. 5 enforcement).
        await recordWithdrawalWaiver(auth.walletAddress);

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
