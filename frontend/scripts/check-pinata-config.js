#!/usr/bin/env node

/**
 * Script de vérification de la configuration Pinata
 * Usage: node scripts/check-pinata-config.js
 */

require('dotenv').config({ path: '.env.local' });

const PINATA_JWT = process.env.PINATA_JWT;

console.log('🔍 Vérification de la configuration Pinata...\n');

if (!PINATA_JWT) {
    console.error('❌ PINATA_JWT n\'est pas défini dans .env.local');
    console.log('\n💡 Solution:');
    console.log('   1. Créez un fichier .env.local à la racine du dossier frontend');
    console.log('   2. Ajoutez: PINATA_JWT=votre_jwt_ici');
    console.log('   3. Obtenez votre JWT sur: https://app.pinata.cloud/developers/api-keys');
    process.exit(1);
}

if (!PINATA_JWT.startsWith('eyJ')) {
    console.error('❌ PINATA_JWT ne semble pas être un JWT valide (devrait commencer par "eyJ")');
    console.log('\n💡 Vérifiez que vous avez copié le bon JWT depuis Pinata');
    process.exit(1);
}

console.log('✅ PINATA_JWT est configuré');
console.log(`   Longueur: ${PINATA_JWT.length} caractères`);
console.log(`   Début: ${PINATA_JWT.substring(0, 20)}...`);

// Test de connexion à Pinata
console.log('\n🔗 Test de connexion à Pinata...');

fetch('https://api.pinata.cloud/data/testAuthentication', {
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${PINATA_JWT}`
    }
})
.then(response => {
    if (response.ok) {
        console.log('✅ Connexion à Pinata réussie !');
        return response.json();
    } else if (response.status === 401) {
        console.error('❌ Authentification échouée (401)');
        console.log('💡 Votre JWT est invalide ou a expiré');
        console.log('   Obtenez un nouveau JWT sur: https://app.pinata.cloud/developers/api-keys');
        process.exit(1);
    } else if (response.status === 403) {
        console.error('❌ Accès refusé (403)');
        console.log('💡 Votre JWT n\'a pas les permissions nécessaires');
        console.log('   Vérifiez les permissions de votre clé API sur Pinata');
        process.exit(1);
    } else {
        console.error(`❌ Erreur inattendue: ${response.status} ${response.statusText}`);
        process.exit(1);
    }
})
.then(data => {
    if (data) {
        console.log('📊 Informations du compte:');
        console.log(`   Authentifié: ${data.authenticated || 'Oui'}`);
    }
    console.log('\n✅ Configuration Pinata valide !');
})
.catch(error => {
    console.error('❌ Erreur lors du test:', error.message);
    console.log('💡 Vérifiez votre connexion internet');
    process.exit(1);
});


