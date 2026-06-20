/**
 * POST /api/collector/notify-claim
 *
 * Called by the collector frontend right after a successful certificate
 * claim. Sends a confirmation email summarizing the artwork and pointing
 * the collector to their collection page.
 *
 * Body: { editionId: number, txHash: string, artworkTitle?: string, artistName?: string }
 * Auth: Privy session (Bearer token) — also used to fetch the email
 *
 * Best-effort: failures are logged but never block the user. The blockchain
 * transaction has already succeeded by the time this runs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { sendClaimReceipt } from '@/lib/email';
import type { Locale } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Reads the locale from the Referer URL (e.g. /de/collector/claim → 'de'). */
function detectLocale(req: NextRequest): Locale {
    const referer = req.headers.get('referer') || '';
    if (/\/de(\/|$)/.test(referer)) return 'de';
    return 'fr';
}

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (!auth.email) {
            // No email on file means we have nothing to write to — gracefully exit
            return NextResponse.json({ ok: true, skipped: 'no_email' });
        }

        const body = await req.json().catch(() => ({}));
        const editionId = Number(body?.editionId);
        const txHash = typeof body?.txHash === 'string' ? body.txHash : '';
        const locale = detectLocale(req);
        const artworkTitle =
            typeof body?.artworkTitle === 'string' && body.artworkTitle.trim()
                ? body.artworkTitle.trim()
                : (locale === 'de' ? 'Ihr Werk' : 'votre œuvre');
        const artistName =
            typeof body?.artistName === 'string' && body.artistName.trim()
                ? body.artistName.trim()
                : (locale === 'de' ? 'dem Künstler' : "l'artiste");

        if (!Number.isFinite(editionId) || editionId < 0) {
            return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
        }

        await sendClaimReceipt(
            auth.email,
            { artworkTitle, artistName, editionId, txHash },
            locale,
        );

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[notify-claim] failed:', err?.message);
        return NextResponse.json({ ok: false, error: err?.message }, { status: 200 });
    }
}
