import { create } from 'ipfs-http-client';

// Connexion au nœud IPFS local
const client = create({
    host: 'localhost',
    port: 5001,
    protocol: 'http'
});

export async function uploadToIPFS(data: any): Promise<string> {
    try {
        const jsonString = JSON.stringify(data, null, 2);
        const result = await client.add(jsonString);
        return result.path; // Retourne le CID
    } catch (error) {
        console.error('Erreur upload IPFS:', error);
        throw error;
    }
}

export async function getFromIPFS(cid: string): Promise<any> {
    try {
        const chunks = [];
        for await (const chunk of client.cat(cid)) {
            chunks.push(chunk);
        }
        const data = Buffer.concat(chunks).toString();
        return JSON.parse(data);
    } catch (error) {
        console.error('Erreur récupération IPFS:', error);
        throw error;
    }
}

export async function getFromIPFSGateway(cid: string): Promise<any> {
    try {
        const response = await fetch(`http://localhost:8080/ipfs/${cid}`);
        if (!response.ok) throw new Error('Erreur récupération IPFS');
        return await response.json();
    } catch (error) {
        console.error('Erreur récupération IPFS gateway:', error);
        throw error;
    }
}
