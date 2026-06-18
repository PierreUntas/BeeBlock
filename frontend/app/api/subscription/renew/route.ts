/**
 * POST /api/subscription/renew
 *
 * Free renewal flow: when an Atelier artist exhausts their 50 editions before
 * the 30-day window is up, they can pay again immediately to reset the counter.
 *
 * Behavior:
 *  1. If the artist has an active Atelier subscription, cancel it immediately
 *     (no proration / refund — they keep the editions they already used).
 *  2. Create a new Stripe Checkout Session for a fresh Atelier subscription.
 *  3. Return the Checkout URL for the frontend to redirect to.
 *
 * Once payment is confirmed, the webhook will set a new
 * current_period_start = now, which effectively resets the 30-day window.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getOrCreateSubscription, updateSubscription } from '@/lib/db';
import { APP_URL, STRIPE_PRICE_ID, getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (!STRIPE_PRICE_ID) {
            return NextResponse.json({ error: 'price_not_configured' }, { status: 500 });
        }

        const stripe = getStripe();
        const sub = await getOrCreateSubscription(auth.walletAddress, auth.email);

        // 1. Cancel any active Atelier subscription. Only mark the DB as
        // canceled if Stripe actually confirmed the cancellation — otherwise
        // we'd risk a state where Stripe keeps billing while our DB believes
        // the artist is on free tier. If Stripe says the sub is already gone
        // ('resource_missing'), we still mark canceled because that confirms
        // there is nothing to bill anymore.
        if (sub.stripeSubscriptionId && sub.status === 'active') {
            let cancellationConfirmed = false;
            try {
                await stripe.subscriptions.cancel(sub.stripeSubscriptionId, {
                    invoice_now: false,
                    prorate: false,
                });
                cancellationConfirmed = true;
            } catch (e: any) {
                if (e?.code === 'resource_missing') {
                    // Subscription already deleted Stripe-side — safe to mark canceled.
                    cancellationConfirmed = true;
                } else {
                    console.error('Failed to cancel existing subscription:', e?.message);
                    return NextResponse.json(
                        { error: 'cancel_failed' },
                        { status: 502 },
                    );
                }
            }
            if (cancellationConfirmed) {
                await updateSubscription(auth.walletAddress, {
                    stripeSubscriptionId: null,
                    status: 'canceled',
                });
            }
        }

        // 2. Make sure we have a Stripe customer
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

        // 3. Create a fresh Checkout for a new Atelier cycle
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: customerId,
            line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
            success_url: `${APP_URL}/artist/subscription?renewed=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${APP_URL}/artist/subscription?canceled=true`,
            consent_collection: {
                terms_of_service: 'required',
            },
            metadata: {
                wallet_address: auth.walletAddress,
                renewal: 'true',
            },
        });

        if (!session.url) {
            return NextResponse.json({ error: 'no_session_url' }, { status: 500 });
        }
        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        const status = err?.status ?? 500;
        return NextResponse.json(
            { error: err?.message || 'internal_error' },
            { status },
        );
    }
}
