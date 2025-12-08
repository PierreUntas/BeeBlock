// Configuration
const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY;
const IPFS_API = process.env.NEXT_PUBLIC_IPFS_API || 'http://localhost:5001/api/v0';

// Gateways publiques IPFS en fallback
const PUBLIC_GATEWAYS = [
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/'
];

export async function uploadToIPFS(data: any): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    formData.append('file', blob);

    const response = await fetch(`${IPFS_API}/add`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Erreur upload IPFS: ${response.statusText}`);
    }

    const result = await response.json();
    return result.Hash;
}

export async function getFromIPFSGateway(cid: string): Promise<any> {
    // Nettoyer le CID si nécessaire
    const cleanCid = cid.replace('ipfs://', '').replace('/ipfs/', '');

    // Construire la liste des gateways à essayer
    const gateways = IPFS_GATEWAY
        ? [`${IPFS_GATEWAY.replace(/\/$/, '')}/ipfs/`, ...PUBLIC_GATEWAYS]
        : PUBLIC_GATEWAYS;

    let lastError: Error | null = null;

    for (const gateway of gateways) {
        try {
            const response = await fetch(`${gateway}${cleanCid}`, {
                cache: 'force-cache',
                signal: AbortSignal.timeout(10000) // Timeout 10 secondes
            });

            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.warn(`Gateway ${gateway} failed, trying next...`);
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw new Error(`Toutes les gateways IPFS ont échoué: ${lastError?.message}`);
}
