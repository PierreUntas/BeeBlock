#!/usr/bin/env node

/**
 * Script de vérification de la configuration Pinata
 * Usage: node scripts/check-pinata-config.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Vérification de la configuration Pinata...\n');

// Vérifier si .env.local existe
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
    console.error('❌ Le fichier .env.local n\'existe pas !');
    console.log('   Créez-le à partir de .env.local.example\n');
    process.exit(1);
}

console.log('✅ Fichier .env.local trouvé');

// Lire le contenu
const envContent = fs.readFileSync(envPath, 'utf8');

// Vérifier PINATA_JWT
if (!envContent.includes('PINATA_JWT')) {
    console.error('❌ La variable PINATA_JWT n\'est pas définie dans .env.local');
    console.log('   Ajoutez : PINATA_JWT=votre_jwt_ici\n');
    process.exit(1);
}

const jwtMatch = envContent.match(/PINATA_JWT=(.+)/);
if (!jwtMatch || !jwtMatch[1] || jwtMatch[1].trim() === 'your_pinata_jwt_here') {
    console.error('❌ PINATA_JWT est défini mais vide ou non configuré');
    console.log('   Remplacez "your_pinata_jwt_here" par votre vrai JWT Pinata');
    console.log('   Obtenez-le sur : https://app.pinata.cloud/developers/api-keys\n');
    process.exit(1);
}

console.log('✅ PINATA_JWT est défini');

// Vérifier que le package pinata est installé
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

if (!packageJson.dependencies || !packageJson.dependencies.pinata) {
    console.error('❌ Le package "pinata" n\'est pas installé');
    console.log('   Exécutez : npm install pinata\n');
    process.exit(1);
}

console.log('✅ Package "pinata" installé');

// Vérifier que thirdweb n'est plus là
if (packageJson.dependencies && packageJson.dependencies.thirdweb) {
    console.warn('⚠️  Le package "thirdweb" est encore installé');
    console.log('   Vous pouvez le supprimer : npm uninstall thirdweb\n');
}

console.log('\n✅ Configuration Pinata OK !');
console.log('\n📝 Prochaines étapes :');
console.log('   1. Lancez le serveur : npm run dev');
console.log('   2. Testez l\'upload d\'un fichier dans votre application');
console.log('   3. Vérifiez les logs pour voir "✅ Pinata upload result"\n');
console.log('📚 Documentation : voir PINATA_SETUP.md\n');

