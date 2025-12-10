// Configuration - utilise le proxy API pour les uploads
const IPFS_API = '/api/ipfs';

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
        let errorMessage = `Erreur upload IPFS: ${response.statusText}`;
        try {
            const errorData = await response.json();
            if (errorData.error) {
                errorMessage = errorData.error;
            } else if (errorData.details) {
                errorMessage = `${errorData.error || 'Erreur upload IPFS'}: ${errorData.details}`;
            }
        } catch {
            try {
                const errorText = await response.text();
                if (errorText) {
                    errorMessage = `Erreur upload IPFS: ${errorText}`;
                }
            } catch {}
        }
        throw new Error(errorMessage);
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
        let errorMessage = `Erreur upload fichier IPFS: ${response.statusText}`;
        try {
            const errorData = await response.json();
            if (errorData.error) {
                errorMessage = errorData.error;
            } else if (errorData.details) {
                errorMessage = `${errorData.error || 'Erreur upload fichier IPFS'}: ${errorData.details}`;
            }
        } catch {
            try {
                const errorText = await response.text();
                if (errorText) {
                    errorMessage = `Erreur upload fichier IPFS: ${errorText}`;
                }
            } catch {}
        }
        throw new Error(errorMessage);
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
    if (ipfsCache.has(cleanCid)) {
        console.log(`✓ Cache hit: ${cleanCid}`);
        return ipfsCache.get(cleanCid);
    }

    const url = `${IPFS_GATEWAY}${cleanCid}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(url, {
            cache: 'force-cache',
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Erreur IPFS: ${response.statusText}`);
        }

        const data = await response.json();
        ipfsCache.set(cleanCid, data);
        console.log(`✓ Gateway success: ${cleanCid}`);
        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

export function getIPFSUrl(cid: string): string {
    const cleanCid = cleanCID(cid);
    return `${IPFS_GATEWAY}${cleanCid}`;
}

export async function prefetchIPFS(cids: string[]): Promise<void> {
    await Promise.allSettled(cids.map(cid => getFromIPFSGateway(cid)));
}
