import { NextRequest, NextResponse } from "next/server";

export const config = {
    api: { bodyParser: { sizeLimit: '20mb' } },
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const PINATA_JWT = process.env.PINATA_JWT;

export async function POST(request: NextRequest) {
    // Uploading to Pinata (internal). PINATA_JWT may be undefined.

    if (!PINATA_JWT) {
        console.error("❌ PINATA_JWT not configured");
        return NextResponse.json(
            {
                error: "Configuration manquante: PINATA_JWT non défini côté serveur.",
                details: "Définir PINATA_JWT dans .env (dev) ou les variables d'environnement de production.",
            },
            { status: 500 }
        );
    }

    try {
        const formData = await request.formData();
        const fileEntry = formData.get("file");
        if (!fileEntry || !(fileEntry instanceof File)) {
            return NextResponse.json(
                { error: "Aucun fichier reçu dans le champ `file`." },
                { status: 400 }
            );
        }

        const file = fileEntry as File;

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `Fichier trop volumineux. Taille maximale : 20 Mo (reçu : ${(file.size / 1024 / 1024).toFixed(1)} Mo).` },
                { status: 413 }
            );
        }

        // Prepare the FormData for Pinata
        const forward = new FormData();
        forward.append("file", file, file.name);

        const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${PINATA_JWT}`,
            },
            body: forward,
        });

        const json = await res.json();
        if (!res.ok) {
            console.error("Pinata API response error:", res.status, json);
            return NextResponse.json(
                { error: "Erreur depuis Pinata", details: json },
                { status: 502 }
            );
        }

        const cid = json.IpfsHash;
        const size = json.PinSize ?? file.size;

        // Pinata add result (internal): json

        return NextResponse.json({
            Hash: cid,
            cid,
            size,
            name: file.name,
        });
    } catch (error: any) {
        console.error("💥 IPFS RPC upload error:", error);
        return NextResponse.json(
            {
                error: "Échec de l'upload vers le RPC IPFS",
                details: error?.message || String(error),
            },
            { status: 500 }
        );
    }
}
