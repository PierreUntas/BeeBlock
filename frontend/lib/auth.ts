/**
 * Server-side authentication helpers for API routes.
 *
 * Verifies a Privy access token from the Authorization header, returns the
 * caller's wallet address. Privy issues these tokens after email/SMS auth and
 * keeps them refreshed for the client SDK; we just validate them server-side.
 */

import { PrivyClient } from '@privy-io/server-auth';
import { NextRequest } from 'next/server';

let _privy: PrivyClient | null = null;

function getPrivy(): PrivyClient {
    if (_privy) return _privy;
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;
    if (!appId || !appSecret) {
        throw new Error('NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET must be configured');
    }
    _privy = new PrivyClient(appId, appSecret);
    return _privy;
}

export interface AuthContext {
    walletAddress: string;
    email: string | null;
    userId: string;
}

/**
 * Extracts and validates the Privy session from the request.
 * Throws a NextResponse-friendly Error with status hint on failure.
 */
export async function requireAuth(req: NextRequest): Promise<AuthContext> {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        const err = new Error('missing_bearer_token');
        (err as any).status = 401;
        throw err;
    }
    const token = match[1];

    let verified;
    try {
        verified = await getPrivy().verifyAuthToken(token);
    } catch {
        const err = new Error('invalid_token');
        (err as any).status = 401;
        throw err;
    }

    const userId = verified.userId;
    const user = await getPrivy().getUserById(userId);

    // Wallet detection: align with the rest of the app, which uses
    //   user.wallet ?? linkedAccounts.find(type === 'wallet')
    // We prefer the embedded Privy wallet (user.wallet) when present so the
    // off-chain DB key matches the address the frontend actually uses for
    // on-chain transactions, then fall back to any other linked wallet.
    const primaryWallet = (user as any).wallet;
    const linkedWallet = user.linkedAccounts.find((a: any) => a.type === 'wallet') as any;
    const walletAddress: string | undefined =
        primaryWallet?.address ?? linkedWallet?.address;

    if (!walletAddress) {
        const err = new Error('no_wallet_linked');
        (err as any).status = 403;
        throw err;
    }

    // Locate the email account if any (Privy email login)
    const emailAccount = user.linkedAccounts.find((a: any) => a.type === 'email') as any;
    const email = emailAccount?.address ?? null;

    return {
        walletAddress: walletAddress.toLowerCase(),
        email,
        userId,
    };
}
