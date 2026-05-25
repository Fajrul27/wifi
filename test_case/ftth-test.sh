#!/bin/bash

BASE_URL="http://localhost:3000"

echo "================================================="
echo "FTTH TOPOLOGY ENGINE TEST"
echo "================================================="

echo ""
echo "1. CREATE OLT PORT"

OLT_RESPONSE=$(curl -s -X POST $BASE_URL/api/olt-port \
-H "Content-Type: application/json" \
-d '{
  "routerId": 1,
  "name": "GPON-PORT-1",
  "port": "gpon1/1",
  "latitude": -6.914744,
  "longitude": 107.609810
}')

echo $OLT_RESPONSE

OLT_PORT_ID=$(echo $OLT_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

echo ""
echo "OLT PORT ID = $OLT_PORT_ID"

echo ""
echo "2. CREATE ODC NODE"

ODC_RESPONSE=$(curl -s -X POST $BASE_URL/api/topology/nodes \
-H "Content-Type: application/json" \
-d "{
  \"name\": \"ODC-CIMAHI-01\",
  \"type\": \"ODC\",
  \"oltPortId\": $OLT_PORT_ID,
  \"latitude\": -6.872222,
  \"longitude\": 107.542222,
  \"description\": \"ODC utama cimahi\"
}")

echo $ODC_RESPONSE

ODC_ID=$(echo $ODC_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

echo ""
echo "ODC ID = $ODC_ID"

echo ""
echo "3. CREATE ODP NODE"

ODP_RESPONSE=$(curl -s -X POST $BASE_URL/api/topology/nodes \
-H "Content-Type: application/json" \
-d '{
  "name": "ODP-CIMAHI-BLOCK-A",
  "type": "ODP",
  "splitter": "SPLITTER_1_8",
  "latitude": -6.871111,
  "longitude": 107.541111,
  "description": "ODP cluster A"
}')

echo $ODP_RESPONSE

ODP_ID=$(echo $ODP_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

echo ""
echo "ODP ID = $ODP_ID"

echo ""
echo "4. CREATE LINK ODC -> ODP"

LINK_RESPONSE=$(curl -s -X POST $BASE_URL/api/topology/links \
-H "Content-Type: application/json" \
-d "{
  \"fromNodeId\": $ODC_ID,
  \"toNodeId\": $ODP_ID,
  \"cableType\": \"BACKBONE_8_CORE\",
  \"distanceMeter\": 250
}")

echo $LINK_RESPONSE

LINK_ID=$(echo $LINK_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

echo ""
echo "LINK ID = $LINK_ID"

echo ""
echo "5. ASSIGN CLIENT TO ODP CORE"

curl -s -X POST $BASE_URL/api/topology/odp/assign-client \
-H "Content-Type: application/json" \
-d "{
  \"clientId\": 1,
  \"odpId\": $ODP_ID,
  \"coreNumber\": 1
}"

echo ""
echo ""
echo "6. CHECK CORE STATUS"

curl -s $BASE_URL/api/topology/odp/$ODP_ID/core-status

echo ""
echo ""
echo "7. USE CORE"

curl -s -X POST $BASE_URL/api/topology/links/$LINK_ID/use-core \
-H "Content-Type: application/json" \
-d '{
  "amount": 1
}'

echo ""
echo ""
echo "8. CHECK LINK CAPACITY"

curl -s $BASE_URL/api/topology/links/$LINK_ID/capacity

echo ""
echo ""
echo "9. GIS MAP"

curl -s $BASE_URL/api/topology/gis-map

echo ""
echo ""
echo "================================================="
echo "TEST DONE"
echo "================================================="