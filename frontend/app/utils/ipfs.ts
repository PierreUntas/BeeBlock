// Configuration
const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY;
const IPFS_API = process.env.NEXT_PUBLIC_IPFS_API || 'http://localhost:5001/api/v0';

// Gateways publiques IPFS en fallback (les plus fiables en premier)
const PUBLIC_GATEWAYS = [
    'https://w3s.link/ipfs/',
    'https://nftstorage.link/ipfs/',
    'https://ipfs.io/ipfs/',
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

function buildGatewayUrl(gateway: string, cid: string): string {
    // Nettoyer la gateway et le CID
    const cleanGateway = gateway.replace(/\/+$/, ''); // Supprimer les / à la fin

    // Vérifier si la gateway contient déjà /ipfs/
    if (cleanGateway.includes('/ipfs')) {
        return `${cleanGateway}/${cid}`;
    }
    return `${cleanGateway}/ipfs/${cid}`;
}

export async function getFromIPFSGateway(cid: string): Promise<any> {
    // Nettoyer le CID (supprimer tous les préfixes possibles)
    const cleanCid = cid
        .replace(/^ipfs:\/\//i, '')
        .replace(/^\/ipfs\//i, '')
        .replace(/^ipfs\//i, '')
        .trim();

    // Construire la liste des gateways à essayer
    // Ignorer la gateway privée HTTP si on est en HTTPS (mixed content)
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

    let gateways: string[] = [];

    if (IPFS_GATEWAY) {
        const isPrivateHttps = IPFS_GATEWAY.startsWith('https://');
        // N'ajouter la gateway privée que si elle est en HTTPS ou si la page n'est pas en HTTPS
        if (isPrivateHttps || !isHttps) {
            gateways.push(IPFS_GATEWAY);
        }
    }

    gateways = [...gateways, ...PUBLIC_GATEWAYS];

    let lastError: Error | null = null;

    for (const gateway of gateways) {
        const url = buildGatewayUrl(gateway, cleanCid);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 secondes

            const response = await fetch(url, {
                cache: 'force-cache',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                console.log(`✓ Gateway success: ${gateway}`);
                return await response.json();
            }
        } catch (error) {
            console.warn(`✗ Gateway ${gateway} failed for CID ${cleanCid}`);
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw new Error(`Toutes les gateways IPFS ont échoué pour ${cleanCid}: ${lastError?.message}`);
}
