/**
 * Server-side admin authorization check.
 *
 * Verifies that the caller's wallet has the `isAdmin` role on the
 * ArtworkRegistry smart contract. Used by /api/admin/* routes to gate
 * sensitive operations (e.g. granting free Atelier subscriptions).
 */

import { publicClient } from '@/lib/client';
import {
    ARTWORK_REGISTRY_ADDRESS,
    ARTWORK_REGISTRY_ABI,
} from '@/config/contracts';

/**
 * Returns true if the given wallet address is an admin or the owner of
 * the ArtworkRegistry contract. Throws on RPC failure.
 */
export async function isAdminOrOwner(wallet: string): Promise<boolean> {
    const address = wallet.toLowerCase() as `0x${string}`;

    const [isAdmin, owner] = await Promise.all([
        publicClient.readContract({
            address: ARTWORK_REGISTRY_ADDRESS,
            abi: ARTWORK_REGISTRY_ABI,
            functionName: 'isAdmin',
            args: [address],
        }) as Promise<boolean>,
        publicClient.readContract({
            address: ARTWORK_REGISTRY_ADDRESS,
            abi: ARTWORK_REGISTRY_ABI,
            functionName: 'owner',
        }) as Promise<string>,
    ]);

    if (isAdmin) return true;
    return owner.toLowerCase() === address;
}
