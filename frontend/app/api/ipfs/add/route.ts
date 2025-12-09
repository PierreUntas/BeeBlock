import { NextRequest, NextResponse } from 'next/server';

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

export async function POST(request: NextRequest) {
    console.log('🚀 Utilisation de Pinata pour l\'upload IPFS');

    if (!PINATA_JWT) {
        console.error('❌ PINATA_JWT n\'est pas configuré');
        return NextResponse.json(
            { error: 'Configuration Pinata manquante. Veuillez définir PINATA_JWT dans les variables d\'environnement.' },
            { status: 500 }
        );
    }

    try {
        const formData = await request.formData();
        console.log('📦 FormData received');

        const response = await fetch(PINATA_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PINATA_JWT}`,
            },
            body: formData,
        });

        console.log('📡 Pinata Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Pinata Error:', errorText);
            
            let errorMessage = `Erreur Pinata: ${response.statusText}`;
            if (response.status === 401) {
                errorMessage = 'Authentification Pinata échouée. Vérifiez votre PINATA_JWT.';
            } else if (response.status === 403) {
                errorMessage = 'Accès refusé. Vérifiez les permissions de votre clé API Pinata.';
            }
            
            return NextResponse.json(
                { error: errorMessage },
                { status: response.status }
            );
        }

        const result = await response.json();
        console.log('✅ Pinata Result:', result);
        
        // Adapter la réponse Pinata au format attendu par l'application
        // Pinata retourne IpfsHash, mais l'application attend Hash
        return NextResponse.json({
            Hash: result.IpfsHash,
            ...result
        });
    } catch (error) {
        console.error('💥 Pinata upload error:', error);
        return NextResponse.json(
            { error: 'Échec de l\'upload vers Pinata', details: String(error) },
            { status: 500 }
        );
    }
}
