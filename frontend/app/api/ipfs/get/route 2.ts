import { NextRequest, NextResponse } from 'next/server';

// Liste de gateways IPFS avec fallback
const IPFS_GATEWAYS = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
];

function cleanCID(cid: string): string {
    return cid
        .replace(/^ipfs:\/\//i, '')
        .replace(/^\/ipfs\//i, '')
        .replace(/^ipfs\//i, '')
        .trim();
}

async function fetchFromGateway(
    gateway: string,
    cid: string,
    retryCount: number = 0,
    maxRetries: number = 3
): Promise<Response> {
    const url = `${gateway}${cid}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(url, {
            cache: 'force-cache',
            signal: controller.signal,
            headers: {
                'Accept': 'application/json, */*',
            }
        });

        clearTimeout(timeoutId);

        // Gérer les erreurs 429 (Too Many Requests) avec retry
        if (response.status === 429 && retryCount < maxRetries) {
            const retryAfter = response.headers.get('Retry-After');
            const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, retryCount) * 1000;
            
            console.log(`⏳ Rate limit atteint, retry dans ${delay}ms (tentative ${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            return fetchFromGateway(gateway, cid, retryCount + 1, maxRetries);
        }

        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const cid = searchParams.get('cid');

    if (!cid) {
        return NextResponse.json(
            { error: 'CID manquant' },
            { status: 400 }
        );
    }

    const cleanCid = cleanCID(cid);
    let lastError: Error | null = null;

    // Essayer chaque gateway jusqu'à ce qu'un fonctionne
    for (const gateway of IPFS_GATEWAYS) {
        try {
            const response = await fetchFromGateway(gateway, cleanCid);

            if (!response.ok) {
                // Si c'est une erreur 429, passer au gateway suivant
                if (response.status === 429) {
                    console.log(`⚠️ Gateway ${gateway} rate limit, essai suivant...`);
                    continue;
                }
                
                // Pour les autres erreurs, continuer avec le gateway suivant
                if (response.status >= 500) {
                    console.log(`⚠️ Gateway ${gateway} erreur serveur, essai suivant...`);
                    continue;
                }

                // Pour les erreurs client (404, etc.), retourner l'erreur
                return NextResponse.json(
                    { error: `Erreur IPFS: ${response.statusText}`, status: response.status },
                    { status: response.status }
                );
            }

            // Succès ! Détecter le type de contenu
            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                const data = await response.json();
                return NextResponse.json(data, {
                    headers: {
                        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
                    }
                });
            } else {
                // Pour les fichiers binaires (PDF, images, etc.), retourner le blob
                const blob = await response.blob();
                return new NextResponse(blob, {
                    headers: {
                        'Content-Type': contentType,
                        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
                    }
                });
            }
        } catch (error) {
            console.error(`Erreur avec gateway ${gateway}:`, error);
            lastError = error as Error;
            // Continuer avec le gateway suivant
            continue;
        }
    }

    // Tous les gateways ont échoué
    console.error('❌ Tous les gateways IPFS ont échoué');
    return NextResponse.json(
        { 
            error: 'Échec de la récupération IPFS depuis tous les gateways',
            details: lastError?.message || 'Aucun gateway disponible'
        },
        { status: 503 }
    );
}

