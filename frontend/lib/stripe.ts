/**
 * Shared Stripe client for API routes.
 * Loaded lazily so build-time doesn't fail if env vars aren't set yet.
 */

import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
    if (_stripe) return _stripe;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        throw new Error('STRIPE_SECRET_KEY not configured');
    }
    // No apiVersion override: let the Stripe SDK pin to its own default,
    // which matches the version it was tested against. This avoids the
    // brittle `as any` cast that breaks when the installed SDK doesn't
    // recognize the literal we hardcoded.
    _stripe = new Stripe(key, {
        typescript: true,
    });
    return _stripe;
}

export const STRIPE_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || '';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.monaeditions.com';
