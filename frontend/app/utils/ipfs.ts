// Configuration
const IPFS_API = process.env.NEXT_PUBLIC_IPFS_API;

// Cache en mémoire pour éviter les requêtes répétées
const ipfsCache = new Map<string, any>();

// Gateway IPFS unique
const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

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

export async function uploadFileToIPFS(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${IPFS_API}/add`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Erreur upload fichier IPFS: ${response.statusText}`);
    }

    const result = await response.json();
    return result.Hash;
}

function cleanCID(cid: string): string {
    return cid
        .replace(/^ipfs:\/\//i, '')
        .replace(/^\/ipfs\//i, '')
        .replace(/^ipfs\//i, '')
        .trim();
}

export async function getFromIPFSGateway(cid: string): Promise<any> {
    const cleanCid = cleanCID(cid);

    // Vérifier le cache d'abord
    if (ipfsCache.has(cleanCid)) {
        console.log(`✓ Cache hit: ${cleanCid}`);
        return ipfsCache.get(cleanCid);
    }

    const url = `${IPFS_GATEWAY}${cleanCid}`;

    const response = await fetch(url, { cache: 'force-cache' });

    if (!response.ok) {
        throw new Error(`Erreur IPFS: ${response.statusText}`);
    }

    const data = await response.json();
    ipfsCache.set(cleanCid, data);
    console.log(`✓ Gateway success: ${IPFS_GATEWAY}`);
    return data;
}

export function getIPFSUrl(cid: string): string {
    const cleanCid = cleanCID(cid);
    return `${IPFS_GATEWAY}${cleanCid}`;
}

// Précharger plusieurs CIDs en parallèle
export async function prefetchIPFS(cids: string[]): Promise<void> {
    await Promise.allSettled(cids.map(cid => getFromIPFSGateway(cid)));
}
