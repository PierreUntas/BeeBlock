// app/api/ipfs/add/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PinataSDK } from "pinata";

const PINATA_JWT = process.env.PINATA_JWT;

export async function POST(request: NextRequest) {
    console.log("🚀 Utilisation de Pinata pour l'upload IPFS");

    if (!PINATA_JWT) {
        console.error("❌ PINATA_JWT n'est pas configuré");
        return NextResponse.json(
            {
                error: "Configuration Pinata manquante. Veuillez définir PINATA_JWT dans les variables d'environnement.",
                details:
                    "PINATA_JWT n'est pas définie (.env.local en dev, Vercel Env en prod).",
            },
            { status: 500 }
        );
    }

    try {
        const formData = await request.formData();
        console.log("📦 FormData received");

        const fileEntry = formData.get("file");
        if (!fileEntry || !(fileEntry instanceof File)) {
            return NextResponse.json(
                { error: "Aucun fichier reçu dans le champ 'file'." },
                { status: 400 }
            );
        }

        const file = fileEntry as File;
        console.log("📦 Fichier reçu:", file.name, file.size);

        // Client Pinata côté serveur
        const pinata = new PinataSDK({
            pinataJwt: PINATA_JWT,
        });

        // Upload vers Pinata (IPFS) - utilisation de la méthode public
        const upload = await pinata.upload.public.file(file);

        console.log("✅ Pinata upload result:", upload);

        return NextResponse.json({
            Hash: upload.cid, // CID retourné par Pinata
            cid: upload.cid,
            size: upload.size || file.size,
            name: file.name,
        });
    } catch (error: any) {
        console.error("💥 Pinata upload error:", error);
        return NextResponse.json(
            {
                error: "Échec de l'upload vers Pinata",
                details: error?.message || String(error),
            },
            { status: 500 }
        );
    }
}
