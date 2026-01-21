// typescript
// File: frontend/app/api/ipfs/get/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Gateways par défaut (fallbacks)
const DEFAULT_GATEWAYS = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
];

const customGateway = process.env.IPFS_GATEWAY_URL ?? '';

// Gateway personnalisé en priorité, puis fallbacks
const IPFS_GATEWAYS = Array.from(new Set([customGateway, ...DEFAULT_GATEWAYS].filter(Boolean)));

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

    for (const gateway of IPFS_GATEWAYS) {
        try {
            const response = await fetchFromGateway(gateway, cleanCid);

            if (!response.ok) {
                if (response.status === 429) {
                    console.log(`⚠️ Gateway ${gateway} rate limit, essai suivant...`);
                    continue;
                }

                if (response.status >= 500) {
                    console.log(`⚠️ Gateway ${gateway} erreur serveur, essai suivant...`);
                    continue;
                }

                return NextResponse.json(
                    { error: `Erreur IPFS: ${response.statusText}`, status: response.status },
                    { status: response.status }
                );
            }

            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                const data = await response.json();
                return NextResponse.json(data, {
                    headers: {
                        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
                    }
                });
            } else {
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
            continue;
        }
    }

    console.error('❌ Tous les gateways IPFS ont échoué');
    return NextResponse.json(
        {
            error: 'Échec de la récupération IPFS depuis tous les gateways',
            details: lastError?.message || 'Aucun gateway disponible'
        },
        { status: 503 }
    );
}