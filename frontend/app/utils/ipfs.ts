// Configuration
const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'http://localhost:8080/ipfs/';
const IPFS_API = process.env.NEXT_PUBLIC_IPFS_API || 'http://localhost:5001/api/v0';

export async function uploadToIPFS(data: any): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    formData.append('file', blob);

    const response = await fetch(`${IPFS_API}/add`, {
        method: 'POST',
        body: formData
    });

    const result = await response.json();
    return result.Hash;
}

export async function getFromIPFSGateway(cid: string): Promise<any> {
    const response = await fetch(`${IPFS_GATEWAY}${cid}`, {
        cache: 'force-cache' // Cache pour optimiser
    });

    if (!response.ok) {
        throw new Error(`Erreur IPFS: ${response.statusText}`);
    }

    return response.json();
}
