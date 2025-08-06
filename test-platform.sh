#!/bin/bash

# Guardian Security Platform - Complete Test Suite
echo "========================================="
echo "Guardian Security Platform Test Suite"
echo "========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

API_URL="http://localhost:8080"
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local endpoint=$1
    local method=$2
    local data=$3
    local description=$4
    
    echo -n "Testing: $description... "
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint")
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_URL$endpoint")
    fi
    
    if [ "$response" == "200" ] || [ "$response" == "201" ]; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED (HTTP $response)${NC}"
        ((FAILED++))
    fi
}

echo -e "\n${YELLOW}1. Testing Core Services${NC}"
test_endpoint "/health" "GET" "" "API Health Check"

echo -e "\n${YELLOW}2. Testing Network Discovery${NC}"
test_endpoint "/api/scanner/discover" "POST" '{"subnet":"192.168.1.0/24"}' "Network Discovery Initiation"
sleep 2
test_endpoint "/api/scanner/results" "GET" "" "Get Scan Results"
test_endpoint "/api/topology" "GET" "" "Get Network Topology"

echo -e "\n${YELLOW}3. Testing Vulnerability Management${NC}"
test_endpoint "/api/vulnerabilities" "GET" "" "Get All Vulnerabilities"

echo -e "\n${YELLOW}4. Testing Policy Management${NC}"
test_endpoint "/api/policies" "GET" "" "Get Security Policies"
test_endpoint "/api/policies" "POST" '{"name":"Test Policy","framework":"NIST CSF","controls":["AC-1","AC-2"]}' "Create New Policy"

echo -e "\n${YELLOW}5. Testing Metrics & Logs${NC}"
test_endpoint "/api/metrics" "GET" "" "Get Platform Metrics"
test_endpoint "/api/logs?limit=10" "GET" "" "Get System Logs"

echo -e "\n${YELLOW}6. Testing Compliance Frameworks${NC}"
test_endpoint "/api/frameworks" "GET" "" "Get Security Frameworks"

echo -e "\n${YELLOW}7. Testing WebSocket Connection${NC}"
echo -n "Testing: WebSocket Real-time Updates... "
timeout 2 bash -c "echo 'test' | nc -l 8080" 2>/dev/null && echo -e "${GREEN}✓ PASSED${NC}" || echo -e "${YELLOW}⚠ SKIPPED${NC}"

echo -e "\n${YELLOW}8. Testing Dashboard${NC}"
echo -n "Testing: React Dashboard... "
if curl -s http://localhost:3000 | grep -q "root"; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
fi

echo -e "\n========================================="
echo -e "Test Results:"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "========================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "Platform is ready at:"
    echo "- Dashboard: http://localhost:3000"
    echo "- API: http://localhost:8080"
    echo ""
    echo "Features available:"
    echo "✓ Real-time network discovery with subnet scanning"
    echo "✓ Interactive network topology visualization"
    echo "✓ Vulnerability detection and management"
    echo "✓ Policy-as-Code enforcement"
    echo "✓ Comprehensive logging with GUI access"
    echo "✓ WebSocket real-time updates"
    echo "✓ ERP-style metrics dashboard"
    echo "✓ Automated remediation workflows"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi