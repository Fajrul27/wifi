#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=============================="
echo "TOPOLOGY API FULL TEST START"
echo "=============================="

# =====================================================
# 1. CREATE ROUTER ID ASSUMED = 1 (atau ambil dari sistem kamu)
# =====================================================
ROUTER_ID=1

echo "\n[1] CREATE OLT PORT"

OLT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/olt-ports" \
-H "Content-Type: application/json" \
-d "{
  \"routerId\": $ROUTER_ID,
  \"name\": \"OLT-AUTO-TEST\",
  \"port\": \"GE-TEST-1\",
  \"latitude\": -6.2,
  \"longitude\": 106.8
}")

echo $OLT_RESPONSE | jq

OLT_ID=$(echo $OLT_RESPONSE | jq -r '.data.id')

echo "OLT_ID = $OLT_ID"

# =====================================================
# 2. CREATE NODE (ODC)
# =====================================================
echo "\n[2] CREATE ODC NODE"

ODC_RESPONSE=$(curl -s -X POST "$BASE_URL/api/topology" \
-H "Content-Type: application/json" \
-d "{
  \"name\": \"ODC-AUTO-1\",
  \"type\": \"ODC\",
  \"oltPortId\": $OLT_ID,
  \"latitude\": -6.21,
  \"longitude\": 106.81
}")

echo $ODC_RESPONSE | jq

ODC_ID=$(echo $ODC_RESPONSE | jq -r '.data.id')

echo "ODC_ID = $ODC_ID"

# =====================================================
# 3. CREATE NODE (ODP)
# =====================================================
echo "\n[3] CREATE ODP NODE"

ODP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/topology" \
-H "Content-Type: application/json" \
-d "{
  \"name\": \"ODP-AUTO-1\",
  \"type\": \"ODP\",
  \"oltPortId\": $OLT_ID,
  \"parentNodeId\": $ODC_ID,
  \"latitude\": -6.22,
  \"longitude\": 106.82
}")

echo $ODP_RESPONSE | jq

ODP_ID=$(echo $ODP_RESPONSE | jq -r '.data.id')

echo "ODP_ID = $ODP_ID"

# =====================================================
# 4. CREATE SPLITTER
# =====================================================
echo "\n[4] CREATE SPLITTER"

SPLITTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/splitter" \
-H "Content-Type: application/json" \
-d "{
  \"nodeId\": $ODC_ID,
  \"type\": \"1:8\",
  \"outputPort\": 8,
  \"name\": \"SPLITTER-AUTO\"
}")

echo $SPLITTER_RESPONSE | jq

SPLITTER_ID=$(echo $SPLITTER_RESPONSE | jq -r '.data.id')

echo "SPLITTER_ID = $SPLITTER_ID"

# =====================================================
# 5. GENERATE OUTPUT PORTS
# =====================================================
echo "\n[5] GENERATE SPLITTER OUTPUT"

GENERATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/splitter/$SPLITTER_ID/generate")

echo $GENERATE_RESPONSE | jq

# =====================================================
# 6. GET SPLITTER DETAIL TO GET OUTPUT ID
# =====================================================
echo "\n[6] GET SPLITTER DETAIL"

SPLITTER_DETAIL=$(curl -s "$BASE_URL/api/splitter")

OUTPUT_ID=$(echo $SPLITTER_DETAIL | jq -r '.data[0].outputs[0].id')

echo "OUTPUT_ID = $OUTPUT_ID"

# =====================================================
# 7. CREATE CLIENT (SIMULASI HARDCODE ID = 1)
# =====================================================
CLIENT_ID=1

# =====================================================
# 8. ASSIGN CLIENT TO FIBER
# =====================================================
echo "\n[7] ASSIGN CLIENT TO FIBER"

ASSIGN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/fiber/assign" \
-H "Content-Type: application/json" \
-d "{
  \"clientId\": $CLIENT_ID,
  \"outputId\": $OUTPUT_ID
}")

echo $ASSIGN_RESPONSE | jq

# =====================================================
# 9. PORT USAGE CHECK
# =====================================================
echo "\n[8] PORT USAGE"

USAGE=$(curl -s "$BASE_URL/api/olt-ports/$OLT_ID/usage")

echo $USAGE | jq

# =====================================================
# 10. UNASSIGN CLIENT
# =====================================================
echo "\n[9] UNASSIGN CLIENT"

UNASSIGN=$(curl -s -X DELETE "$BASE_URL/api/fiber/unassign/$OUTPUT_ID")

echo $UNASSIGN | jq

# =====================================================
# DONE
# =====================================================
echo "\n=============================="
echo "TEST COMPLETED SUCCESSFULLY"
echo "=============================="