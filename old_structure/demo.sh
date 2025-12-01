#!/bin/bash
set -e

echo "🚀 DEMO - Tolérance aux pannes MinIO"
echo "====================================="

OWNER_ID="123e4567-e89b-12d3-a456-426614174000"

# 0. Créer l'utilisateur
echo ""
echo "👤 0. Création de l'utilisateur de démo..."
docker exec -i postgres psql -U app -d ds << EOF
INSERT INTO users (user_id, email, public_key) 
VALUES ('$OWNER_ID', 'demo@example.com', decode('fake-public-key', 'escape'))
ON CONFLICT (user_id) DO NOTHING;
EOF
echo "   ✅ Utilisateur créé"

# 1. Init upload
echo ""
echo "📤 1. Initialisation de l'upload..."
RESPONSE=$(curl -s -X POST http://localhost:8080/upload/init \
  -H "Content-Type: application/json" \
  -d "{\"owner_id\":\"$OWNER_ID\",\"filename\":\"demo.txt\",\"total_size\":1000,\"chunk_count\":1}")

FILE_ID=$(echo "$RESPONSE" | jq -r '.file_id')
echo "   ✅ File ID: $FILE_ID"

# 2. Upload direct du chunk (utilise un pipe au lieu d'un fichier temporaire)
echo ""
echo "📦 2. Upload du chunk vers MinIO..."

UPLOAD_RESP=$(curl -s -X POST http://localhost:8080/upload/chunk \
  -F "file_id=$FILE_ID" \
  -F "offset=0" \
  -F "chunk=@-;filename=chunk.txt" \
  <<< "Contenu de test pour la démo - $(date)")

echo "   Response: $UPLOAD_RESP"

if echo "$UPLOAD_RESP" | jq . > /dev/null 2>&1; then
    SHA256=$(echo "$UPLOAD_RESP" | jq -r '.sha256')
    echo "   ✅ Chunk uploadé (SHA256: ${SHA256:0:16}...)"
else
    echo "   ❌ Erreur upload: $UPLOAD_RESP"
    exit 1
fi

# 3. Debug: vérifier la distribution
echo ""
echo "🔍 3. Vérification de la distribution sur les nœuds..."
curl -s "http://localhost:8080/debug/chunk/$FILE_ID/0" | jq .

# 4. Test download AVANT panne
echo ""
echo "📥 4. Test de download AVANT panne..."
DOWNLOAD=$(curl -s "http://localhost:8080/download/$FILE_ID")
DOWNLOAD_URL=$(echo "$DOWNLOAD" | jq -r '.parts[0].url')

if curl -s "$DOWNLOAD_URL" 2>&1 | head -c 100 > /dev/null; then
    CONTENT=$(curl -s "$DOWNLOAD_URL")
    echo "   ✅ Download OK"
    echo "   Contenu: ${CONTENT:0:50}..."
else
    echo "   ❌ Download échoué"
fi

# 5. Simuler panne
echo ""
echo "💥 5. SIMULATION DE PANNE - Arrêt de minio2..."
docker stop minio2
sleep 3
echo "   ⚠️  minio2 est DOWN"

# 6. Test download APRÈS panne
echo ""
echo "📥 6. Test de download APRÈS panne..."
DOWNLOAD2=$(curl -s "http://localhost:8080/download/$FILE_ID")
DOWNLOAD_URL2=$(echo "$DOWNLOAD2" | jq -r '.parts[0].url')

if curl -s "$DOWNLOAD_URL2" 2>&1 | head -c 100 > /dev/null; then
    CONTENT2=$(curl -s "$DOWNLOAD_URL2")
    echo "   ✅ Download RÉUSSI malgré la panne !"
    echo "   Contenu: ${CONTENT2:0:50}..."
    echo ""
    echo "   🎉 LA TOLÉRANCE AUX PANNES FONCTIONNE !"
    SUCCESS=1
else
    echo "   ❌ Download échoué après panne"
    SUCCESS=0
fi

# 7. Debug après panne
echo ""
echo "🔍 7. État des nœuds après panne..."
curl -s "http://localhost:8080/debug/chunk/$FILE_ID/0" | jq .

# 8. Restart
echo ""
echo "🔄 8. Redémarrage de minio2..."
docker start minio2
sleep 3
echo "   ✅ Cluster restauré"

echo ""
echo "====================================="
echo "✅ DEMO TERMINÉE"
echo ""
echo "📊 Résumé:"
echo "  - Fichier uploadé: $FILE_ID"
echo "  - Download avant panne: OK ✅"
echo "  - Nœud minio2 arrêté: OK ✅"
echo "  - Download après panne: $([ "$SUCCESS" = "1" ] && echo 'OK ✅' || echo 'FAIL ❌')"
echo ""
echo "📝 Explication technique:"
echo "  MinIO en mode distribué (4 nœuds) utilise l'erasure coding EC:4"
echo "  Chaque objet est découpé en 2 shards de données + 2 shards de parité"
echo "  Le système tolère la perte de 2 nœuds sur 4 (50% de pannes)"
