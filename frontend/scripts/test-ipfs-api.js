#!/usr/bin/env node

/**
 * Script de test pour l'API IPFS
 * Usage: node test-ipfs-api.js
 */

const IPFS_RPC = process.env.IPFS_RPC || "https://ipfs-api.web3pi.link";

console.log("🧪 Test de l'API IPFS\n");
console.log(`📡 URL de l'API: ${IPFS_RPC}\n`);

// Test 1: Vérifier que l'API répond
async function testApiConnection() {
    console.log("1️⃣ Test de connexion à l'API...");
    try {
        const response = await fetch(`${IPFS_RPC}/api/v0/version`, {
            method: 'POST',
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log("   ✅ Connexion réussie!");
            console.log(`   📦 Version IPFS: ${data.Version || 'N/A'}`);
            return true;
        } else {
            console.log(`   ❌ Erreur: ${response.status} ${response.statusText}`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Erreur de connexion: ${error.message}`);
        return false;
    }
}

// Test 2: Ajouter un fichier de test
async function testAddFile() {
    console.log("\n2️⃣ Test d'ajout d'un fichier...");
    try {
        const testContent = JSON.stringify({
            test: true,
            message: "Test IPFS BeeBlock",
            timestamp: new Date().toISOString()
        });

        const formData = new FormData();
        const blob = new Blob([testContent], { type: 'application/json' });
        formData.append('file', blob, 'test.json');

        const response = await fetch(`${IPFS_RPC}/api/v0/add`, {
            method: 'POST',
            body: formData,
        });

        if (response.ok) {
            const data = await response.json();
            console.log("   ✅ Fichier ajouté avec succès!");
            console.log(`   📝 Hash IPFS: ${data.Hash || data.hash}`);
            console.log(`   🔗 URL: https://ipfs.io/ipfs/${data.Hash || data.hash}`);
            return data.Hash || data.hash;
        } else {
            const text = await response.text();
            console.log(`   ❌ Erreur: ${response.status} ${response.statusText}`);
            console.log(`   📄 Réponse: ${text}`);
            return null;
        }
    } catch (error) {
        console.log(`   ❌ Erreur: ${error.message}`);
        return null;
    }
}

// Test 3: Récupérer un fichier
async function testGetFile(hash) {
    if (!hash) {
        console.log("\n3️⃣ Test de récupération ignoré (pas de hash)");
        return;
    }

    console.log("\n3️⃣ Test de récupération du fichier...");
    try {
        // Essayer via l'API locale
        const response = await fetch(`${IPFS_RPC}/api/v0/cat?arg=${hash}`, {
            method: 'POST',
        });

        if (response.ok) {
            const content = await response.text();
            console.log("   ✅ Fichier récupéré!");
            console.log(`   📄 Contenu: ${content}`);
        } else {
            console.log(`   ⚠️  Récupération via API locale échouée (${response.status})`);
            console.log("   💡 Essayez via gateway public: https://ipfs.io/ipfs/" + hash);
        }
    } catch (error) {
        console.log(`   ❌ Erreur: ${error.message}`);
    }
}

// Exécuter tous les tests
async function runTests() {
    const isConnected = await testApiConnection();
    
    if (isConnected) {
        const hash = await testAddFile();
        await testGetFile(hash);
    }

    console.log("\n" + "=".repeat(50));
    console.log("✅ Tests terminés!");
    console.log("=".repeat(50));
}

// Lancer les tests
runTests().catch(console.error);
