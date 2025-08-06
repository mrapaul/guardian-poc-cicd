#!/bin/bash

# Guardian Platform - GitHub Deployment Helper
# This script helps set up and deploy to GitHub and DigitalOcean

echo "========================================="
echo "Guardian Platform - GitHub Deployment"
echo "========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}GitHub CLI (gh) is not installed${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}Not authenticated with GitHub${NC}"
    echo "Running: gh auth login"
    gh auth login
fi

# Get repository name
REPO_NAME=${1:-guardian-poc}
echo -e "\n${GREEN}Setting up repository: $REPO_NAME${NC}"

# Create GitHub repository
echo -e "\n${YELLOW}Creating GitHub repository...${NC}"
gh repo create $REPO_NAME --public --description "Guardian Security Platform - CI/CD PoC" --confirm || echo "Repository might already exist"

# Set up secrets
echo -e "\n${YELLOW}Setting up GitHub secrets...${NC}"
echo "Enter your DigitalOcean Access Token (or press Enter to skip):"
read -s DO_TOKEN

if [ ! -z "$DO_TOKEN" ]; then
    gh secret set DIGITALOCEAN_ACCESS_TOKEN --body "$DO_TOKEN"
    echo -e "${GREEN}✓ DIGITALOCEAN_ACCESS_TOKEN secret set${NC}"
else
    echo -e "${YELLOW}⚠ Skipped setting DIGITALOCEAN_ACCESS_TOKEN${NC}"
fi

# Push to GitHub
echo -e "\n${YELLOW}Pushing to GitHub...${NC}"
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/$(gh api user --jq .login)/$REPO_NAME.git
git push -u origin main

# Open repository in browser
echo -e "\n${GREEN}Opening repository in browser...${NC}"
gh repo view --web

echo -e "\n${GREEN}=========================================${NC}"
echo -e "${GREEN}Deployment Setup Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Go to the Actions tab in your repository"
echo "2. The CI/CD pipeline will run automatically on push"
echo "3. For DigitalOcean deployment, ensure DIGITALOCEAN_ACCESS_TOKEN is set"
echo ""
echo "Repository URL: https://github.com/$(gh api user --jq .login)/$REPO_NAME"
echo ""
echo "To trigger deployment manually:"
echo "  git push origin main"
echo ""
echo "To deploy to DigitalOcean directly:"
echo "  export DIGITALOCEAN_ACCESS_TOKEN='your-token'"
echo "  ./infrastructure/scripts/deploy.sh"