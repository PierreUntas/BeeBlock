import { NextRequest, NextResponse } from 'next/server';

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

export async function POST(request: NextRequest) {
    console.log('🚀 Utilisation de Pinata pour l\'upload IPFS');

    if (!PINATA_JWT) {
        console.error('❌ PINATA_JWT n\'est pas configuré');
        return NextResponse.json(
            { 
                error: 'Configuration Pinata manquante. Veuillez définir PINATA_JWT dans les variables d\'environnement de Vercel.',
                details: 'La variable d\'environnement PINATA_JWT n\'est pas définie. Ajoutez-la dans les paramètres de votre projet Vercel.'
            },
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
            let errorText = '';
            let errorData: any = null;
            
            try {
                errorText = await response.text();
                // Essayer de parser le JSON si possible
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    // Ce n'est pas du JSON, utiliser le texte brut
                }
            } catch {
                errorText = response.statusText;
            }
            
            console.error('❌ Pinata Error:', errorText);
            
            let errorMessage = `Erreur Pinata: ${response.statusText}`;
            let details = errorText;
            
            if (response.status === 401) {
                errorMessage = 'Authentification Pinata échouée. Vérifiez votre PINATA_JWT.';
                details = 'Le JWT Pinata est invalide ou a expiré. Vérifiez votre configuration sur Vercel.';
            } else if (response.status === 403) {
                errorMessage = 'Accès refusé. Vérifiez les permissions de votre clé API Pinata.';
                details = 'Votre clé API Pinata n\'a pas les permissions nécessaires pour uploader des fichiers.';
            } else if (errorData?.error) {
                errorMessage = errorData.error;
                details = errorData.details || errorText;
            }
            
            return NextResponse.json(
                { 
                    error: errorMessage,
                    details: details,
                    status: response.status
                },
                { status: response.status }
            );
        }

        const result = await response.json();
        console.log('✅ Pinata Result:', result);
        
        // Vérifier que le résultat contient bien IpfsHash
        if (!result.IpfsHash) {
            console.error('❌ Pinata response missing IpfsHash:', result);
            return NextResponse.json(
                { 
                    error: 'Réponse Pinata invalide',
                    details: 'La réponse de Pinata ne contient pas de hash IPFS.'
                },
                { status: 500 }
            );
        }
        
        // Adapter la réponse Pinata au format attendu par l'application
        // Pinata retourne IpfsHash, mais l'application attend Hash
        return NextResponse.json({
            Hash: result.IpfsHash,
            ...result
        });
    } catch (error) {
        console.error('💥 Pinata upload error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { 
                error: 'Échec de l\'upload vers Pinata',
                details: errorMessage
            },
            { status: 500 }
        );
    }
}
