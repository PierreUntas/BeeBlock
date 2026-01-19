# 🧪 Guide de test et alternatives IPFS

## ❌ Problème détecté

L'API `https://ipfs-api.web3pi.link` ne fonctionne plus (erreur 404).

## ✅ Solutions recommandées

### Option 1: **Pinata** (Recommandé pour BeeBlock)
Service professionnel, gratuit jusqu'à 1GB.

**Avantages :**
- ✅ Service stable et fiable
- ✅ Dashboard de gestion
- ✅ API bien documentée
- ✅ Gratuit jusqu'à 1GB
- ✅ Parfait pour production

**Setup :**
1. Créer un compte sur https://pinata.cloud
2. Récupérer votre API Key et Secret
3. Ajouter dans `.env.local` :
```env
NEXT_PUBLIC_PINATA_JWT=your-jwt-here
```

### Option 2: **Infura IPFS**
Service d'Infura (Consensys).

**Setup :**
```env
NEXT_PUBLIC_INFURA_PROJECT_ID=your-project-id
NEXT_PUBLIC_INFURA_SECRET=your-secret
IPFS_RPC=https://ipfs.infura.io:5001
```

### Option 3: **Web3.Storage**
Service gratuit de Protocol Labs.

**Setup :**
1. Créer un compte sur https://web3.storage
2. Récupérer votre token
```env
NEXT_PUBLIC_WEB3_STORAGE_TOKEN=your-token
```

### Option 4: **Node IPFS local**
Pour développement uniquement.

**Installation :**
```bash
# Via npm
npm install -g ipfs

# Initialiser
ipfs init

# Lancer
ipfs daemon
```

**Configuration :**
```env
IPFS_RPC=http://127.0.0.1:5001
```

## 🧪 Tester une API IPFS

### Script créé
J'ai créé un script de test : [scripts/test-ipfs-api.js](scripts/test-ipfs-api.js)

**Usage :**
```bash
# Test avec l'URL par défaut
node scripts/test-ipfs-api.js

# Test avec une URL personnalisée
IPFS_RPC=https://autre-api.com node scripts/test-ipfs-api.js
```

### Test manuel avec curl
```bash
# Tester la connexion
curl -X POST https://ipfs.infura.io:5001/api/v0/version

# Ajouter un fichier
echo "Hello IPFS" > test.txt
curl -X POST -F file=@test.txt https://ipfs.infura.io:5001/api/v0/add
```

## 💡 Recommandation pour BeeBlock

**Utilisez Pinata** car :
1. Vous l'avez déjà dans vos dépendances (`pinata: ^2.5.1`)
2. Fichier [PINATA_SETUP.md](PINATA_SETUP.md) déjà présent
3. Adapté pour production
4. Dashboard pour gérer les fichiers miel/batch

## 🔧 Migration vers Pinata

### 1. Vérifier l'installation
```bash
npm list pinata
```

### 2. Configurer `.env.local`
```env
NEXT_PUBLIC_PINATA_JWT=eyJhbG...votre-jwt
```

### 3. Code exemple
```typescript
import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
  pinataJwt: process.env.NEXT_PUBLIC_PINATA_JWT,
});

// Upload un fichier
const upload = await pinata.upload.json({
  name: "Batch Miel #1",
  description: "Données de traçabilité"
});

console.log("IPFS Hash:", upload.IpfsHash);
```

## 📊 Comparaison des services

| Service | Gratuit | Limite | Fiabilité | Production |
|---------|---------|--------|-----------|------------|
| Pinata | ✅ Oui | 1GB | ⭐⭐⭐⭐⭐ | ✅ Oui |
| Infura | ✅ Oui | 5GB/jour | ⭐⭐⭐⭐ | ✅ Oui |
| Web3.Storage | ✅ Oui | Illimité | ⭐⭐⭐⭐ | ✅ Oui |
| Local | ✅ Oui | Disque | ⭐⭐ | ❌ Non |
| web3pi.link | ❌ Down | - | ⭐ | ❌ Non |

## 🚀 Next steps

1. **Choisir un service** (Pinata recommandé)
2. **Créer un compte** et récupérer les credentials
3. **Mettre à jour** `.env.local`
4. **Tester** avec le script ou vos routes API
5. **Déployer** en production

## 📝 Notes

- Les fichiers uploadés sur IPFS sont publics
- Les hashes IPFS sont permanents
- Utilisez Pinata pour garantir la disponibilité (pinning)
- Pour des données sensibles, chiffrez avant upload
