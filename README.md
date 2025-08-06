# Guardian Security Platform - CI/CD Pipeline

## Overview
This repository contains a complete CI/CD pipeline for deploying the Guardian Security Platform to DigitalOcean using GitHub Actions, Terraform, and Docker.

## Quick Start

### Local Development
```bash
# Copy environment variables
cp .env.example .env

# Start services locally
docker-compose up -d

# Verify services
curl http://localhost:8080/health

# View logs
docker-compose logs -f
```

### Deployment Verification
```bash
# Run the verification script
./verify-deployment.sh
```

## GitHub Setup

### 1. Create Repository
```bash
# Add GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/guardian-poc.git

# Push to GitHub
git push -u origin main
```

### 2. Configure Secrets
Go to Settings → Secrets and variables → Actions and add:
- `DIGITALOCEAN_ACCESS_TOKEN` - Your DigitalOcean API token

## DigitalOcean Deployment

### Prerequisites
- DigitalOcean account with API token
- Terraform installed (optional, for infrastructure management)
- doctl CLI installed (optional, for manual deployment)

### Automatic Deployment
Push to main branch triggers automatic deployment:
```bash
git push origin main
```

### Manual Deployment
```bash
# Set environment variable
export DIGITALOCEAN_ACCESS_TOKEN="your-token-here"

# Deploy infrastructure and application
./infrastructure/scripts/deploy.sh
```

## Architecture

### CI/CD Pipeline
- **CI Workflow**: Runs on pull requests - linting, testing, security scanning
- **CD Workflow**: Runs on main branch - builds, pushes images, deploys to DigitalOcean

### Infrastructure Components
- **VPC**: Private network for all services
- **PostgreSQL**: Managed database (15.x)
- **Redis**: Managed cache for job queues
- **Container Registry**: Private Docker registry
- **App Platform**: Hosts the application services
- **Spaces**: Object storage for files

### Application Services
- **Backend API**: Node.js/Express REST API
- **Frontend**: React dashboard
- **Scanner Worker**: Background job processor

## Monitoring

### Health Checks
- API: `https://your-app.ondigitalocean.app/health`
- Frontend: `https://your-app.ondigitalocean.app`

### Logs
```bash
# View App Platform logs
doctl apps logs <app-id>

# View local logs
docker-compose logs -f
```

## Costs

Estimated monthly costs on DigitalOcean:
- Container Registry (Basic): $5
- PostgreSQL Database: $15
- Redis Cache: $15
- App Platform: ~$25-50 (depending on usage)
- **Total**: ~$60-85/month

## Security

- All secrets stored as encrypted environment variables
- Private VPC network isolation
- HTTPS-only public access
- Non-root container execution
- Automated vulnerability scanning

## Troubleshooting

### Docker Build Fails
```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache
```

### Deployment Fails
```bash
# Check GitHub Actions logs
gh run list
gh run view <run-id>

# Check DigitalOcean app status
doctl apps list
doctl apps logs <app-id>
```

### Database Connection Issues
```bash
# Check VPC configuration
doctl vpcs list

# Check database firewall rules
doctl databases firewalls list <db-id>
```

## Support

For issues or questions:
1. Check the [deployment verification script](./verify-deployment.sh)
2. Review the [secrets documentation](./DEPLOYMENT-SECRETS.md)
3. Check GitHub Actions logs
4. Contact DigitalOcean support

## License

MIT