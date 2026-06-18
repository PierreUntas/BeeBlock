/**
 * POST /api/subscription/webhook
 *
 * Stripe webhook handler. Updates the database when subscription events occur.
 *
 * IMPORTANT — to configure on Stripe Dashboard:
 *  Endpoint URL: https://www.monaeditions.com/api/subscription/webhook
 *  Events to subscribe:
 *    - checkout.session.completed
 *    - customer.subscription.created
 *    - customer.subscription.updated
 *    - customer.subscription.deleted
 *    - invoice.payment_failed
 *
 * Then copy the webhook signing secret into env: STRIPE_WEBHOOK_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import {
    findByStripeCustomerId,
    markStripeEventProcessed,
    updateSubscription,
    normalizeWallet,
} from '@/lib/db';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
// Stripe needs the raw request body to verify the signature
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    const sig = req.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !webhookSecret) {
        return NextResponse.json({ error: 'missing_signature_or_secret' }, { status: 400 });
    }

    const stripe = getStripe();
    const rawBody = await req.text();

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
        console.error('Stripe webhook signature verification failed:', err.message);
        return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
    }

    // Idempotency: skip if we've already processed this event id
    const fresh = await markStripeEventProcessed(event.id, event.type);
    if (!fresh) {
        return NextResponse.json({ received: true, skipped: 'already_processed' });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
                break;

            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
                break;

            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
                break;

            default:
                // Other events: acknowledge but don't act
                break;
        }
    } catch (err) {
        console.error(`Error processing ${event.type}:`, err);
        // Return 500 so Stripe retries
        return NextResponse.json({ error: 'handler_failed' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}

// ---- Handlers --------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    // Triggered right after a successful payment, before the subscription event.
    // We use this to associate the wallet with the Stripe customer if needed.
    const wallet = session.metadata?.wallet_address;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    if (!wallet || !customerId) return;

    await updateSubscription(normalizeWallet(wallet), {
        stripeCustomerId: customerId,
    });
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const dbSub = await findByStripeCustomerId(customerId);
    if (!dbSub) {
        // Stripe doesn't guarantee strict ordering of webhook events: this can
        // arrive BEFORE checkout.session.completed has had a chance to link
        // the wallet to the customer id. Throwing here returns 500 to Stripe
        // so it retries with backoff (default: up to 3 days). By the time it
        // retries, checkout.session.completed will have set the link.
        throw new Error(`No subscription row for Stripe customer ${customerId} — will retry`);
    }

    const status = mapStripeStatus(sub.status);
    const isActiveOrTrialing = sub.status === 'active' || sub.status === 'trialing';
    const periodStart = (sub as any).current_period_start
        ? new Date((sub as any).current_period_start * 1000)
        : null;
    const periodEnd = (sub as any).current_period_end
        ? new Date((sub as any).current_period_end * 1000)
        : null;

    await updateSubscription(dbSub.walletAddress, {
        stripeSubscriptionId: sub.id,
        plan: isActiveOrTrialing ? 'atelier' : 'free',
        status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
    });
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const dbSub = await findByStripeCustomerId(customerId);
    if (!dbSub) return;

    await updateSubscription(dbSub.walletAddress, {
        stripeSubscriptionId: null,
        plan: 'free',
        status: 'canceled',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
    });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;
    const dbSub = await findByStripeCustomerId(customerId);
    if (!dbSub) return;
    await updateSubscription(dbSub.walletAddress, { status: 'past_due' });
}

// ---- Helpers ---------------------------------------------------------------

function mapStripeStatus(s: Stripe.Subscription.Status):
    | 'active'
    | 'canceled'
    | 'past_due'
    | 'incomplete'
    | 'none' {
    switch (s) {
        case 'active':
        case 'trialing':
            return 'active';
        case 'canceled':
        case 'unpaid':
            return 'canceled';
        case 'past_due':
            return 'past_due';
        case 'incomplete':
        case 'incomplete_expired':
            return 'incomplete';
        default:
            return 'none';
    }
}
