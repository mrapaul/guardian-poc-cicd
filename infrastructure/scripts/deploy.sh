#!/bin/bash
set -e

# Guardian Platform Infrastructure Deployment Script
# This script manages the deployment of Guardian Security Platform to DigitalOcean

echo "========================================="
echo "Guardian Platform Infrastructure Deploy"
echo "========================================="

# Configuration
ENVIRONMENT=${1:-production}
ACTION=${2:-apply}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check for required tools
    command -v terraform >/dev/null 2>&1 || { log_error "terraform is required but not installed."; exit 1; }
    command -v doctl >/dev/null 2>&1 || { log_error "doctl is required but not installed."; exit 1; }
    command -v docker >/dev/null 2>&1 || { log_error "docker is required but not installed."; exit 1; }
    
    # Check for API token
    if [ -z "$DIGITALOCEAN_ACCESS_TOKEN" ]; then
        log_error "DIGITALOCEAN_ACCESS_TOKEN environment variable is not set"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

setup_terraform() {
    log_info "Setting up Terraform..."
    
    cd infrastructure/terraform
    
    # Initialize Terraform
    terraform init -upgrade
    
    # Validate configuration
    terraform validate
    
    log_info "Terraform setup complete"
}

create_infrastructure() {
    log_info "Creating infrastructure for $ENVIRONMENT environment..."
    
    # Plan the deployment
    terraform plan \
        -var="environment=$ENVIRONMENT" \
        -var="do_token=$DIGITALOCEAN_ACCESS_TOKEN" \
        -out=tfplan
    
    if [ "$ACTION" == "plan" ]; then
        log_info "Plan complete. Review the changes above."
        exit 0
    fi
    
    # Apply the deployment
    if [ "$ACTION" == "apply" ]; then
        log_warn "About to create/update infrastructure. This may incur costs."
        read -p "Continue? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            terraform apply tfplan
            log_info "Infrastructure deployment complete"
        else
            log_info "Deployment cancelled"
            exit 0
        fi
    fi
}

setup_registry() {
    log_info "Setting up container registry..."
    
    # Login to registry
    doctl registry login
    
    # Get registry info
    REGISTRY_NAME=$(doctl registry get --format Name --no-header || echo "")
    if [ -z "$REGISTRY_NAME" ]; then
        log_info "Creating container registry..."
        doctl registry create guardian-security --subscription-tier basic --region nyc3
    fi
    
    log_info "Registry ready"
}

build_and_push_images() {
    log_info "Building and pushing Docker images..."
    
    # Get registry endpoint
    REGISTRY_ENDPOINT=$(terraform output -raw registry_endpoint 2>/dev/null || echo "registry.digitalocean.com/guardian-security")
    
    # Navigate back to project root
    cd ../..
    
    # Build and push backend
    log_info "Building backend image..."
    docker build -f Dockerfile.backend -t $REGISTRY_ENDPOINT/guardian-backend:latest .
    docker push $REGISTRY_ENDPOINT/guardian-backend:latest
    
    # Build and push frontend
    log_info "Building frontend image..."
    docker build -f Dockerfile.frontend -t $REGISTRY_ENDPOINT/guardian-frontend:latest .
    docker push $REGISTRY_ENDPOINT/guardian-frontend:latest
    
    # Build and push API
    log_info "Building API image..."
    docker build -f Dockerfile.api -t $REGISTRY_ENDPOINT/guardian-api:latest .
    docker push $REGISTRY_ENDPOINT/guardian-api:latest
    
    log_info "Images pushed successfully"
}

deploy_application() {
    log_info "Deploying application to App Platform..."
    
    # Check if app exists
    APP_ID=$(doctl apps list --format ID,Spec.Name --no-header | grep "guardian-platform" | awk '{print $1}' || true)
    
    if [ -z "$APP_ID" ]; then
        log_info "Creating new app..."
        doctl apps create --spec app-spec.yml
    else
        log_info "Updating existing app..."
        doctl apps update $APP_ID --spec app-spec.yml
    fi
    
    # Wait for deployment
    log_info "Waiting for deployment to complete..."
    if [ ! -z "$APP_ID" ]; then
        doctl apps create-deployment $APP_ID --wait
    fi
    
    # Get app URL
    APP_URL=$(doctl apps list --format LiveURL --no-header | head -1 || echo "")
    if [ ! -z "$APP_URL" ]; then
        log_info "Application deployed to: https://$APP_URL"
    fi
}

run_health_checks() {
    log_info "Running health checks..."
    
    APP_URL=$(doctl apps list --format LiveURL --no-header | head -1 || echo "localhost:3000")
    
    # Check API health
    if curl -f -s "https://$APP_URL/api/health" > /dev/null 2>&1; then
        log_info "API health check: PASSED"
    else
        log_warn "API health check: FAILED (may still be starting)"
    fi
    
    # Check frontend
    if curl -f -s "https://$APP_URL" > /dev/null 2>&1; then
        log_info "Frontend health check: PASSED"
    else
        log_warn "Frontend health check: FAILED (may still be starting)"
    fi
}

cleanup_old_resources() {
    log_info "Cleaning up old resources..."
    
    # Clean old container images
    doctl registry garbage-collection start --force || true
    
    log_info "Cleanup complete"
}

# Main execution
main() {
    log_info "Starting deployment for $ENVIRONMENT environment"
    
    check_prerequisites
    
    if [ "$ACTION" == "destroy" ]; then
        log_warn "About to destroy infrastructure!"
        read -p "Are you sure? Type 'yes' to continue: " -r
        if [ "$REPLY" == "yes" ]; then
            cd infrastructure/terraform
            terraform destroy -var="do_token=$DIGITALOCEAN_ACCESS_TOKEN" -auto-approve
            log_info "Infrastructure destroyed"
        fi
        exit 0
    fi
    
    setup_terraform
    create_infrastructure
    
    if [ "$ACTION" == "apply" ]; then
        setup_registry
        build_and_push_images
        deploy_application
        run_health_checks
        cleanup_old_resources
    fi
    
    log_info "Deployment complete!"
}

# Run main function
main