/**
 * POST /api/editions/increment
 *
 * Called by the frontend after a successful on-chain createArtworkEdition
 * transaction. Records the event for quota tracking.
 *
 * Body:  { editionId: number, txHash?: string }
 * Auth:  Privy session
 *
 * Refuses (and returns 402) if the quota would be exceeded — this catches
 * race conditions where two creations happen simultaneously near the cap.
 * The on-chain edition still exists; the counter just doesn't reflect it,
 * which is a soft enforcement of the off-chain limit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { recordEdition } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        const body = await req.json().catch(() => ({}));
        const editionId = body?.editionId;
        const txHash = typeof body?.txHash === 'string' ? body.txHash : null;

        if (editionId === undefined || editionId === null) {
            return NextResponse.json({ error: 'edition_id_required' }, { status: 400 });
        }
        const parsed = typeof editionId === 'string' ? Number(editionId) : Number(editionId);
        if (!Number.isFinite(parsed) || parsed < 0) {
            return NextResponse.json({ error: 'invalid_edition_id' }, { status: 400 });
        }

        const result = await recordEdition(auth.walletAddress, parsed, txHash);
        if (!result.recorded) {
            const status = result.reason === 'quota_exhausted' ? 402 : 500;
            return NextResponse.json({ error: result.reason ?? 'not_recorded' }, { status });
        }

        return NextResponse.json({ recorded: true });
    } catch (err: any) {
        const status = err?.status ?? 500;
        return NextResponse.json(
            { error: err?.message || 'internal_error' },
            { status },
        );
    }
}
