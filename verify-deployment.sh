#!/bin/bash

# Guardian Platform Deployment Verification Script
# This script verifies the CI/CD pipeline and deployment setup

echo "========================================="
echo "Guardian Platform Deployment Verification"
echo "========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

section() {
    echo -e "\n${BLUE}═══ $1 ═══${NC}"
}

# Check Project Structure
section "Project Structure"

if [ -d ".github/workflows" ]; then
    check_pass "GitHub workflows directory exists"
else
    check_fail "GitHub workflows directory missing"
fi

if [ -f ".github/workflows/ci.yml" ]; then
    check_pass "CI workflow file exists"
else
    check_fail "CI workflow file missing"
fi

if [ -f ".github/workflows/cd.yml" ]; then
    check_pass "CD workflow file exists"
else
    check_fail "CD workflow file missing"
fi

if [ -d "infrastructure" ]; then
    check_pass "Infrastructure directory exists"
else
    check_fail "Infrastructure directory missing"
fi

if [ -f "infrastructure/terraform/main.tf" ]; then
    check_pass "Terraform configuration exists"
else
    check_fail "Terraform configuration missing"
fi

if [ -f "Dockerfile.backend" ] && [ -f "Dockerfile.frontend" ] && [ -f "Dockerfile.api" ]; then
    check_pass "All Dockerfiles exist"
else
    check_fail "Some Dockerfiles are missing"
fi

if [ -f "app-spec.yml" ]; then
    check_pass "App Platform specification exists"
else
    check_fail "App Platform specification missing"
fi

# Check Docker
section "Docker Configuration"

if command -v docker &> /dev/null; then
    check_pass "Docker is installed"
    
    if docker info &> /dev/null; then
        check_pass "Docker daemon is running"
    else
        check_fail "Docker daemon is not running"
    fi
else
    check_fail "Docker is not installed"
fi

# Test Docker builds
echo -e "\n${YELLOW}Testing Docker builds...${NC}"

if docker build -f Dockerfile.backend -t test-backend:latest . > /dev/null 2>&1; then
    check_pass "Backend Docker image builds successfully"
    docker rmi test-backend:latest > /dev/null 2>&1
else
    check_fail "Backend Docker image build failed"
fi

if docker build -f Dockerfile.frontend -t test-frontend:latest . > /dev/null 2>&1; then
    check_pass "Frontend Docker image builds successfully"
    docker rmi test-frontend:latest > /dev/null 2>&1
else
    check_fail "Frontend Docker image build failed"
fi

if docker build -f Dockerfile.api -t test-api:latest . > /dev/null 2>&1; then
    check_pass "API Docker image builds successfully"
    docker rmi test-api:latest > /dev/null 2>&1
else
    check_fail "API Docker image build failed"
fi

# Check Local Services
section "Local Services"

if curl -f http://localhost:3000 > /dev/null 2>&1; then
    check_pass "Frontend is running locally"
else
    check_warn "Frontend is not running locally (run 'just start' to test)"
fi

if curl -f http://localhost:8080/health > /dev/null 2>&1; then
    check_pass "API is running locally"
else
    check_warn "API is not running locally (run 'just start' to test)"
fi

# Check Dependencies
section "Dependencies & Tools"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    check_pass "Node.js is installed ($NODE_VERSION)"
else
    check_fail "Node.js is not installed"
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    check_pass "npm is installed ($NPM_VERSION)"
else
    check_fail "npm is not installed"
fi

if command -v git &> /dev/null; then
    check_pass "Git is installed"
else
    check_fail "Git is not installed"
fi

if command -v terraform &> /dev/null; then
    TERRAFORM_VERSION=$(terraform version -json 2>/dev/null | grep -o '"terraform_version":"[^"]*' | cut -d'"' -f4)
    check_pass "Terraform is installed (v${TERRAFORM_VERSION:-unknown})"
else
    check_warn "Terraform is not installed (needed for infrastructure deployment)"
fi

if command -v doctl &> /dev/null; then
    check_pass "DigitalOcean CLI is installed"
else
    check_warn "DigitalOcean CLI is not installed (needed for deployment)"
fi

# Check Environment Variables
section "Environment Configuration"

if [ -f ".env.example" ]; then
    check_pass "Environment example file exists"
else
    check_fail "Environment example file missing"
fi

if [ -f ".env" ]; then
    check_pass "Local .env file exists"
else
    check_warn "Local .env file not configured (copy from .env.example)"
fi

if [ ! -z "$DIGITALOCEAN_ACCESS_TOKEN" ]; then
    check_pass "DigitalOcean access token is set"
else
    check_warn "DigitalOcean access token not set (needed for deployment)"
fi

# Check Git Configuration
section "Git Configuration"

if [ -d ".git" ]; then
    check_pass "Git repository initialized"
    
    REMOTE=$(git remote get-url origin 2>/dev/null)
    if [ ! -z "$REMOTE" ]; then
        check_pass "Git remote configured: $REMOTE"
    else
        check_warn "No Git remote configured"
    fi
    
    BRANCH=$(git branch --show-current 2>/dev/null)
    if [ "$BRANCH" == "main" ] || [ "$BRANCH" == "master" ]; then
        check_pass "On main branch: $BRANCH"
    else
        check_warn "Not on main branch (current: $BRANCH)"
    fi
else
    check_fail "Not a Git repository"
fi

# Check GitHub Actions Secrets (if gh CLI available)
section "GitHub Configuration"

if command -v gh &> /dev/null; then
    if gh auth status &> /dev/null; then
        check_pass "GitHub CLI authenticated"
        
        # Check for required secrets
        SECRETS=$(gh secret list 2>/dev/null || echo "")
        if echo "$SECRETS" | grep -q "DIGITALOCEAN_ACCESS_TOKEN"; then
            check_pass "DIGITALOCEAN_ACCESS_TOKEN secret configured"
        else
            check_warn "DIGITALOCEAN_ACCESS_TOKEN secret not configured in GitHub"
        fi
    else
        check_warn "GitHub CLI not authenticated (run 'gh auth login')"
    fi
else
    check_warn "GitHub CLI not installed (needed to manage secrets)"
fi

# Test Workflow Syntax
section "Workflow Validation"

echo -e "\n${YELLOW}Validating workflow files...${NC}"

# Simple YAML syntax check
for workflow in .github/workflows/*.yml; do
    if [ -f "$workflow" ]; then
        if python3 -c "import yaml; yaml.safe_load(open('$workflow'))" 2>/dev/null; then
            check_pass "$(basename $workflow) has valid YAML syntax"
        else
            check_fail "$(basename $workflow) has invalid YAML syntax"
        fi
    fi
done

# Check Services Health
section "Service Components"

for dir in guardian-api guardian-dashboard guardian-scanner; do
    if [ -d "$dir" ]; then
        check_pass "$dir directory exists"
        
        if [ -f "$dir/package.json" ]; then
            check_pass "$dir has package.json"
        else
            check_fail "$dir missing package.json"
        fi
    else
        check_fail "$dir directory missing"
    fi
done

# Summary
section "Verification Summary"

echo -e "\n${GREEN}Passed:${NC} $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC} $FAILED"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ Deployment verification PASSED!${NC}"
    echo -e "\nNext steps:"
    echo "1. Set up GitHub secrets: gh secret set DIGITALOCEAN_ACCESS_TOKEN"
    echo "2. Configure .env file: cp .env.example .env && vim .env"
    echo "3. Test locally: just start"
    echo "4. Deploy to DigitalOcean: ./infrastructure/scripts/deploy.sh"
    exit 0
else
    echo -e "\n${RED}❌ Deployment verification FAILED!${NC}"
    echo -e "\nPlease fix the issues above before deploying."
    exit 1
fi