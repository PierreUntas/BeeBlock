/**
 * useSubscription — client-side hook that reads the artist's subscription
 * snapshot from /api/subscription/status.
 *
 * Auto-fetches when the Privy user becomes available.
 * Exposes a `refresh()` method to re-fetch after an event (e.g. just after a
 * successful edition creation, to update the remaining quota).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

export type Plan = 'free' | 'atelier';
export type SubStatus = 'none' | 'active' | 'canceled' | 'past_due' | 'incomplete';

export interface SubscriptionSnapshot {
    plan: Plan;
    status: SubStatus;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    remainingQuota: number;
    quotaLimit: number;
    periodEditionsUsed: number;
    freeQuotaUsed: number;
    privacyAcceptedAt: string | null;
}

/**
 * Helper: record acceptance of the privacy policy by the authenticated user.
 * Idempotent: subsequent calls don't overwrite the original timestamp.
 */
export async function acceptPrivacy(
    getAccessToken: () => Promise<string | null>,
): Promise<boolean> {
    const token = await getAccessToken();
    if (!token) return false;
    const res = await fetch('/api/legal/accept', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
}

interface UseSubscriptionState {
    snapshot: SubscriptionSnapshot | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionState {
    const { authenticated, getAccessToken, ready } = usePrivy();

    const [snapshot, setSnapshot] = useState<SubscriptionSnapshot | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!authenticated) return;
        setLoading(true);
        setError(null);
        try {
            const token = await getAccessToken();
            if (!token) throw new Error('no_token');
            const res = await fetch('/api/subscription/status', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `http_${res.status}`);
            }
            const data = (await res.json()) as SubscriptionSnapshot;
            setSnapshot(data);
        } catch (e: any) {
            setError(e?.message || 'fetch_failed');
        } finally {
            setLoading(false);
        }
    }, [authenticated, getAccessToken]);

    useEffect(() => {
        if (ready && authenticated) {
            refresh();
        }
    }, [ready, authenticated, refresh]);

    return { snapshot, loading, error, refresh };
}

/**
 * Helper: redirect to Stripe Checkout for a new Atelier subscription.
 */
export async function openCheckout(getAccessToken: () => Promise<string | null>): Promise<void> {
    const token = await getAccessToken();
    if (!token) throw new Error('no_token');
    const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || 'checkout_failed');
    window.location.href = data.url;
}

/**
 * Helper: redirect to Stripe Customer Portal.
 */
export async function openPortal(getAccessToken: () => Promise<string | null>): Promise<void> {
    const token = await getAccessToken();
    if (!token) throw new Error('no_token');
    const res = await fetch('/api/subscription/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || 'portal_failed');
    window.location.href = data.url;
}

/**
 * Helper: trigger a free renewal flow (cancel current + new Checkout).
 */
export async function openRenew(getAccessToken: () => Promise<string | null>): Promise<void> {
    const token = await getAccessToken();
    if (!token) throw new Error('no_token');
    const res = await fetch('/api/subscription/renew', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || 'renew_failed');
    window.location.href = data.url;
}

/**
 * Helper: record an edition creation. Returns true if recorded.
 */
export async function incrementEdition(
    getAccessToken: () => Promise<string | null>,
    editionId: bigint | number,
    txHash?: string,
): Promise<boolean> {
    const token = await getAccessToken();
    if (!token) return false;
    const res = await fetch('/api/editions/increment', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ editionId: Number(editionId), txHash }),
    });
    return res.ok;
}
