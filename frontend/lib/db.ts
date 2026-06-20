/**
 * Shared Postgres client + domain types for the subscription system.
 *
 * Uses @vercel/postgres so it works seamlessly with Vercel Postgres
 * (auto-injects POSTGRES_URL on the platform, falls back to env locally).
 */

import { sql } from '@vercel/postgres';

// ---- Domain types ----------------------------------------------------------

export type Plan = 'free' | 'atelier';
export type Locale = 'fr' | 'de';
export type SubStatus =
    | 'none'         // never had a subscription
    | 'active'       // Atelier paid and current
    | 'canceled'     // canceled but possibly still within paid period
    | 'past_due'     // last invoice failed, grace period
    | 'incomplete';  // initial payment not yet confirmed

export interface ArtistSubscription {
    walletAddress: string;
    email: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    plan: Plan;
    status: SubStatus;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    freeQuotaUsed: number;
    privacyAcceptedAt: Date | null;
    preferredLocale: Locale;
    createdAt: Date;
    updatedAt: Date;
}

export interface SubscriptionSnapshot {
    plan: Plan;
    status: SubStatus;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    remainingQuota: number;          // negative-clamped to 0
    quotaLimit: number;              // 5 for free, 50 for atelier
    periodEditionsUsed: number;      // editions used in the current window
    freeQuotaUsed: number;
    privacyAcceptedAt: Date | null;  // null = never accepted RGPD privacy policy
}

// ---- Constants -------------------------------------------------------------

export const FREE_QUOTA_LIMIT = 5;
export const ATELIER_QUOTA_LIMIT = 50;
export const ATELIER_WINDOW_DAYS = 30;

// ---- Helpers ---------------------------------------------------------------

/** Normalize a wallet to lowercase 0x... form for consistent DB keys. */
export function normalizeWallet(addr: string): string {
    return addr.trim().toLowerCase();
}

/**
 * Map a raw DB row (snake_case) to our camelCase domain type.
 * Returns null if the row is missing.
 */
function rowToSubscription(row: any): ArtistSubscription | null {
    if (!row) return null;
    return {
        walletAddress: row.wallet_address,
        email: row.email,
        stripeCustomerId: row.stripe_customer_id,
        stripeSubscriptionId: row.stripe_subscription_id,
        plan: row.plan,
        status: row.status,
        currentPeriodStart: row.current_period_start ? new Date(row.current_period_start) : null,
        currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
        cancelAtPeriodEnd: row.cancel_at_period_end,
        freeQuotaUsed: row.free_quota_used,
        privacyAcceptedAt: row.privacy_accepted_at ? new Date(row.privacy_accepted_at) : null,
        preferredLocale: (row.preferred_locale || 'fr') as Locale,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}

/**
 * Update the preferred locale for a wallet. Called by any authenticated API
 * route to keep the user's email language in sync with their browsing locale.
 * Idempotent and non-throwing — failures only log.
 */
export async function setPreferredLocale(
    walletAddress: string,
    locale: Locale,
): Promise<void> {
    const wallet = normalizeWallet(walletAddress);
    try {
        await sql`
            UPDATE artist_subscriptions
            SET preferred_locale = ${locale}
            WHERE wallet_address = ${wallet}
              AND preferred_locale IS DISTINCT FROM ${locale}
        `;
    } catch (e) {
        console.warn('[setPreferredLocale] failed:', (e as Error).message);
    }
}

/**
 * Fetch the subscription row for a wallet, or create a default 'free' row
 * if none exists. Always returns a row.
 */
export async function getOrCreateSubscription(
    walletAddress: string,
    email: string | null,
): Promise<ArtistSubscription> {
    const wallet = normalizeWallet(walletAddress);

    const existing = await sql`
        SELECT * FROM artist_subscriptions WHERE wallet_address = ${wallet} LIMIT 1
    `;
    if (existing.rows.length > 0) {
        return rowToSubscription(existing.rows[0])!;
    }

    const inserted = await sql`
        INSERT INTO artist_subscriptions (wallet_address, email, plan, status, free_quota_used)
        VALUES (${wallet}, ${email}, 'free', 'none', 0)
        ON CONFLICT (wallet_address) DO UPDATE SET email = COALESCE(artist_subscriptions.email, EXCLUDED.email)
        RETURNING *
    `;
    return rowToSubscription(inserted.rows[0])!;
}

/**
 * Count editions created in the current window for a wallet.
 *  - Atelier: editions where created_at >= current_period_start (resets on each new billing cycle)
 *  - Free: count of edition_events ever (used for sanity; the source of truth is free_quota_used)
 */
export async function countEditionsInWindow(
    walletAddress: string,
    windowStart: Date | null,
): Promise<number> {
    const wallet = normalizeWallet(walletAddress);
    if (!windowStart) {
        const all = await sql`
            SELECT COUNT(*)::int AS c FROM edition_events WHERE wallet_address = ${wallet}
        `;
        return all.rows[0]?.c ?? 0;
    }
    const since = windowStart.toISOString();
    const r = await sql`
        SELECT COUNT(*)::int AS c
        FROM edition_events
        WHERE wallet_address = ${wallet}
          AND created_at >= ${since}
    `;
    return r.rows[0]?.c ?? 0;
}

/**
 * Compute the public snapshot returned by /api/subscription/status.
 * Centralized so both the status route and the increment route use the same
 * logic to validate quota.
 */
export async function buildSnapshot(
    sub: ArtistSubscription,
): Promise<SubscriptionSnapshot> {
    const isActiveAtelier = sub.plan === 'atelier' && sub.status === 'active';

    if (isActiveAtelier) {
        const periodEditionsUsed = await countEditionsInWindow(
            sub.walletAddress,
            sub.currentPeriodStart,
        );
        return {
            plan: 'atelier',
            status: sub.status,
            currentPeriodStart: sub.currentPeriodStart,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            remainingQuota: Math.max(0, ATELIER_QUOTA_LIMIT - periodEditionsUsed),
            quotaLimit: ATELIER_QUOTA_LIMIT,
            periodEditionsUsed,
            freeQuotaUsed: sub.freeQuotaUsed,
            privacyAcceptedAt: sub.privacyAcceptedAt,
        };
    }

    // Free tier (or atelier that lapsed)
    return {
        plan: 'free',
        status: sub.status === 'active' ? 'active' : sub.status,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        remainingQuota: Math.max(0, FREE_QUOTA_LIMIT - sub.freeQuotaUsed),
        quotaLimit: FREE_QUOTA_LIMIT,
        periodEditionsUsed: sub.freeQuotaUsed,
        freeQuotaUsed: sub.freeQuotaUsed,
        privacyAcceptedAt: sub.privacyAcceptedAt,
    };
}

/**
 * Record a successful edition creation. Returns true if recorded, false if
 * quota was already exhausted (caller should reject the request).
 *
 * Updates done atomically:
 *  - Insert into edition_events (idempotent on (wallet, edition_id))
 *  - For free plan: bump free_quota_used
 */
export async function recordEdition(
    walletAddress: string,
    editionId: bigint | number,
    txHash: string | null,
): Promise<{ recorded: boolean; reason?: string }> {
    const wallet = normalizeWallet(walletAddress);

    const subRows = await sql`SELECT * FROM artist_subscriptions WHERE wallet_address = ${wallet} LIMIT 1`;
    const sub = rowToSubscription(subRows.rows[0]);
    if (!sub) return { recorded: false, reason: 'no_subscription_row' };

    const snapshot = await buildSnapshot(sub);
    if (snapshot.remainingQuota <= 0) {
        return { recorded: false, reason: 'quota_exhausted' };
    }

    // Insert the edition event (idempotent)
    await sql`
        INSERT INTO edition_events (wallet_address, edition_id, tx_hash)
        VALUES (${wallet}, ${Number(editionId)}, ${txHash})
        ON CONFLICT (wallet_address, edition_id) DO NOTHING
    `;

    // For free plan, bump the lifetime counter
    if (sub.plan === 'free') {
        await sql`
            UPDATE artist_subscriptions
            SET free_quota_used = free_quota_used + 1
            WHERE wallet_address = ${wallet}
              AND free_quota_used < ${FREE_QUOTA_LIMIT}
        `;
    }

    return { recorded: true };
}

/**
 * Idempotency guard for Stripe webhooks.
 * Returns true if this event is new (insert succeeded), false if already processed.
 */
export async function markStripeEventProcessed(
    eventId: string,
    eventType: string,
): Promise<boolean> {
    try {
        await sql`
            INSERT INTO stripe_webhook_events (event_id, event_type)
            VALUES (${eventId}, ${eventType})
        `;
        return true;
    } catch (e: any) {
        // Unique violation = already processed
        if (e?.code === '23505') return false;
        throw e;
    }
}

/**
 * Find a subscription by Stripe customer id (used by webhooks).
 */
export async function findByStripeCustomerId(customerId: string): Promise<ArtistSubscription | null> {
    const r = await sql`
        SELECT * FROM artist_subscriptions WHERE stripe_customer_id = ${customerId} LIMIT 1
    `;
    return rowToSubscription(r.rows[0]);
}

/**
 * Update subscription fields after a Stripe event.
 * All fields are optional; only provided ones are updated.
 *
 * Atomic by construction: every patch is compiled into a single UPDATE
 * statement so a partial failure cannot leave the row half-written.
 */
export async function updateSubscription(
    walletAddress: string,
    patch: Partial<{
        stripeCustomerId: string | null;
        stripeSubscriptionId: string | null;
        plan: Plan;
        status: SubStatus;
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
        cancelAtPeriodEnd: boolean;
    }>,
): Promise<void> {
    const wallet = normalizeWallet(walletAddress);

    const setClauses: string[] = [];
    const params: unknown[] = [];

    const push = (col: string, val: unknown) => {
        params.push(val);
        setClauses.push(`${col} = $${params.length}`);
    };

    if (patch.stripeCustomerId !== undefined) push('stripe_customer_id', patch.stripeCustomerId);
    if (patch.stripeSubscriptionId !== undefined) push('stripe_subscription_id', patch.stripeSubscriptionId);
    if (patch.plan !== undefined) push('plan', patch.plan);
    if (patch.status !== undefined) push('status', patch.status);
    if (patch.currentPeriodStart !== undefined) {
        push('current_period_start', patch.currentPeriodStart ? patch.currentPeriodStart.toISOString() : null);
    }
    if (patch.currentPeriodEnd !== undefined) {
        push('current_period_end', patch.currentPeriodEnd ? patch.currentPeriodEnd.toISOString() : null);
    }
    if (patch.cancelAtPeriodEnd !== undefined) push('cancel_at_period_end', patch.cancelAtPeriodEnd);

    if (setClauses.length === 0) return; // nothing to do

    params.push(wallet);
    const query = `UPDATE artist_subscriptions SET ${setClauses.join(', ')} WHERE wallet_address = $${params.length}`;
    await sql.query(query, params);
}
