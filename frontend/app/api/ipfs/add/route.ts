// app/api/ipfs/add/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient } from "thirdweb";
import { upload } from "thirdweb/storage";

const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;

export async function POST(request: NextRequest) {
    console.log("🚀 Utilisation de thirdweb pour l'upload IPFS");

    if (!THIRDWEB_SECRET_KEY) {
        console.error("❌ THIRDWEB_SECRET_KEY n'est pas configuré");
        return NextResponse.json(
            {
                error: "Configuration thirdweb manquante. Veuillez définir THIRDWEB_SECRET_KEY dans les variables d'environnement.",
                details:
                    "THIRDWEB_SECRET_KEY n'est pas définie (.env.local en dev, Vercel Env en prod).",
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

        // Client thirdweb côté serveur
        const client = createThirdwebClient({
            secretKey: THIRDWEB_SECRET_KEY,
        });

        // Upload vers le storage thirdweb (IPFS)
        const cid = await upload({
            client,
            files: [file], // File natif (Web API)
            uploadWithoutDirectory: true,
        });

        console.log("✅ thirdweb CID brut:", cid);

        // cid = "ipfs://<CID>" → on garde uniquement le CID
        const cleanCid = cid.replace(/^ipfs:\/\//i, "");

        return NextResponse.json({
            Hash: cleanCid, // compatible avec ton lib/ipfs.ts
            cid: cleanCid,
            size: file.size,
            name: file.name,
        });
    } catch (error: any) {
        console.error("💥 thirdweb upload error:", error);
        return NextResponse.json(
            {
                error: "Échec de l'upload vers thirdweb",
                details: error?.message || String(error),
            },
            { status: 500 }
        );
    }
}
