// Exemple d'utilisation IPFS local pour BeeBlock
// Ce fichier montre comment uploader et récupérer des données

const IPFS_API = process.env.IPFS_RPC || "http://127.0.0.1:5001";

// Exemple 1: Upload d'un objet JSON (données de batch de miel)
async function uploadBatchData() {
    const batchData = {
        batchId: "BATCH-2026-001",
        producer: "Rucher des Abeilles Dorées",
        harvestDate: "2026-01-14",
        location: {
            latitude: 43.6047,
            longitude: 1.4442,
            address: "Toulouse, France"
        },
        honeyType: "Miel de Lavande",
        quantity: 50, // kg
        certifications: ["Bio", "Label Rouge"],
        analyses: {
            humidity: 17.2,
            ph: 3.9,
            conductivity: 0.35
        },
        timestamp: new Date().toISOString()
    };

    console.log("📦 Upload des données du batch...");
    
    const blob = new Blob([JSON.stringify(batchData, null, 2)], { 
        type: 'application/json' 
    });
    
    const formData = new FormData();
    formData.append('file', blob, `batch-${batchData.batchId}.json`);

    const response = await fetch(`${IPFS_API}/api/v0/add`, {
        method: 'POST',
        body: formData,
    });

    const result = await response.json();
    
    console.log("✅ Données uploadées avec succès!");
    console.log(`📝 Hash IPFS: ${result.Hash}`);
    console.log(`🔗 URL locale: http://127.0.0.1:8080/ipfs/${result.Hash}`);
    console.log(`🌐 URL publique: https://ipfs.io/ipfs/${result.Hash}`);
    
    return result.Hash;
}

// Exemple 2: Récupération des données
async function getBatchData(hash) {
    console.log(`\n📥 Récupération des données du hash: ${hash}`);
    
    const response = await fetch(`${IPFS_API}/api/v0/cat?arg=${hash}`, {
        method: 'POST',
    });

    const data = await response.json();
    
    console.log("✅ Données récupérées:");
    console.log(JSON.stringify(data, null, 2));
    
    return data;
}

// Exemple 3: Upload d'un fichier image (photo du miel)
async function uploadImage(imagePath) {
    const fs = require('fs');
    const FormData = require('form-data'); // Nécessite: npm install form-data
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(imagePath));

    const response = await fetch(`${IPFS_API}/api/v0/add`, {
        method: 'POST',
        body: formData,
    });

    const result = await response.json();
    
    console.log("✅ Image uploadée!");
    console.log(`🖼️  Hash: ${result.Hash}`);
    
    return result.Hash;
}

// Exemple 4: Upload avec métadonnées (NFT-style)
async function uploadBatchNFTMetadata() {
    const metadata = {
        name: "Miel de Lavande - Batch #001",
        description: "Miel biologique récolté dans les champs de lavande de Provence",
        image: "ipfs://QmPreviousImageHash", // Hash d'une image déjà uploadée
        attributes: [
            { trait_type: "Type", value: "Miel de Lavande" },
            { trait_type: "Origine", value: "Provence, France" },
            { trait_type: "Année", value: "2026" },
            { trait_type: "Certification", value: "Bio" },
            { trait_type: "Quantité (kg)", value: "50" }
        ],
        properties: {
            producer: "Rucher des Abeilles Dorées",
            harvestDate: "2026-01-14",
            batchId: "BATCH-2026-001"
        }
    };

    const blob = new Blob([JSON.stringify(metadata, null, 2)], { 
        type: 'application/json' 
    });
    
    const formData = new FormData();
    formData.append('file', blob, 'metadata.json');

    const response = await fetch(`${IPFS_API}/api/v0/add`, {
        method: 'POST',
        body: formData,
    });

    const result = await response.json();
    
    console.log("✅ Métadonnées NFT uploadées!");
    console.log(`📝 Hash: ${result.Hash}`);
    
    return result.Hash;
}

// Lancer les exemples
async function main() {
    try {
        console.log("🐝 BeeBlock - Exemples IPFS\n");
        console.log("=".repeat(50));
        
        // Test 1: Upload batch data
        const hash = await uploadBatchData();
        
        // Test 2: Récupérer les données
        await getBatchData(hash);
        
        // Test 3: Métadonnées NFT
        console.log("\n" + "=".repeat(50));
        await uploadBatchNFTMetadata();
        
        console.log("\n" + "=".repeat(50));
        console.log("✅ Tous les tests sont réussis!");
        console.log("\n💡 Ouvrez la WebUI: http://127.0.0.1:5001/webui");
        
    } catch (error) {
        console.error("❌ Erreur:", error.message);
    }
}

// Exécuter si lancé directement
if (require.main === module) {
    main();
}

module.exports = {
    uploadBatchData,
    getBatchData,
    uploadImage,
    uploadBatchNFTMetadata
};
