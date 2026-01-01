// typescript
import { NextRequest, NextResponse } from "next/server";

const IPFS_RPC = process.env.IPFS_RPC;

export async function POST(request: NextRequest) {
    console.log("🚀 Upload vers IPFS RPC:", IPFS_RPC);

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
        console.log("📦 Fichier reçu:", file.name, file.size);

        // Prépare le FormData à forwarder vers le RPC IPFS
        const forward = new FormData();
        forward.append("file", file, file.name);

        const url = `${IPFS_RPC.replace(/\/$/, "")}/api/v0/add?pin=false`;
        const res = await fetch(url, {
            method: "POST",
            body: forward,
        });

        const text = await res.text();
        if (!res.ok) {
            console.error("IPFS RPC response error:", res.status, text);
            return NextResponse.json(
                { error: "Erreur depuis le RPC IPFS", details: text },
                { status: 502 }
            );
        }

        // La réponse peut être NDJSON (une ou plusieurs lignes JSON) — on prend la dernière ligne.
        const lines = text.trim().split("\n").filter(Boolean);
        const last = JSON.parse(lines[lines.length - 1]);

        const cid = last.Hash || last.Hash || (last?.cid?.["/"] ?? last.cid);
        const size = last.Size ? Number(last.Size) : file.size;

        console.log("✅ IPFS add result:", last);

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


// // app/api/ipfs/add/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import { PinataSDK } from "pinata";
//
// const PINATA_JWT = process.env.PINATA_JWT;
//
// export async function POST(request: NextRequest) {
//     console.log("🚀 Utilisation de Pinata pour l'upload IPFS");
//
//     if (!PINATA_JWT) {
//         console.error("❌ PINATA_JWT n'est pas configuré");
//         return NextResponse.json(
//             {
//                 error: "Configuration Pinata manquante. Veuillez définir PINATA_JWT dans les variables d'environnement.",
//                 details:
//                     "PINATA_JWT n'est pas définie (.env.local en dev, Vercel Env en prod).",
//             },
//             { status: 500 }
//         );
//     }
//
//     try {
//         const formData = await request.formData();
//         console.log("📦 FormData received");
//
//         const fileEntry = formData.get("file");
//         if (!fileEntry || !(fileEntry instanceof File)) {
//             return NextResponse.json(
//                 { error: "Aucun fichier reçu dans le champ 'file'." },
//                 { status: 400 }
//             );
//         }
//
//         const file = fileEntry as File;
//         console.log("📦 Fichier reçu:", file.name, file.size);
//
//         // Client Pinata côté serveur
//         const pinata = new PinataSDK({
//             pinataJwt: PINATA_JWT,
//         });
//
//         // Upload vers Pinata (IPFS) - utilisation de la méthode public
//         const upload = await pinata.upload.public.file(file);
//
//         console.log("✅ Pinata upload result:", upload);
//
//         return NextResponse.json({
//             Hash: upload.cid, // CID retourné par Pinata
//             cid: upload.cid,
//             size: upload.size || file.size,
//             name: file.name,
//         });
//     } catch (error: any) {
//         console.error("💥 Pinata upload error:", error);
//         return NextResponse.json(
//             {
//                 error: "Échec de l'upload vers Pinata",
//                 details: error?.message || String(error),
//             },
//             { status: 500 }
//         );
//     }
// }
