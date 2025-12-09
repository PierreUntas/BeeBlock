#!/bin/bash
# Script pour nettoyer le cache Next.js

echo "🧹 Nettoyage du cache Next.js..."

# Arrêter tous les processus Next.js
pkill -f "next dev" || true

# Attendre un peu pour que les fichiers se libèrent
sleep 2

# Supprimer le cache
rm -rf .next
rm -rf node_modules/.cache

echo "✅ Cache nettoyé !"
echo "💡 Vous pouvez maintenant relancer avec: npm run dev"


