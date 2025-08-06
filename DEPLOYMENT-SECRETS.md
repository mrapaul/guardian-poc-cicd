# Guardian Platform - Secrets Management Guide

## Overview
This document provides comprehensive instructions for managing secrets required for the Guardian Security Platform CI/CD pipeline and cloud deployment.

⚠️ **IMPORTANT**: Never commit actual secrets to the repository. This file contains only placeholders and instructions.

## GitHub Secrets Configuration

These secrets must be configured in your GitHub repository settings under Settings → Secrets and variables → Actions.

### Required GitHub Secrets

#### 1. DIGITALOCEAN_ACCESS_TOKEN
- **Purpose**: Authentication for DigitalOcean API and Container Registry
- **How to obtain**:
  1. Log in to DigitalOcean Control Panel
  2. Navigate to API → Tokens/Keys
  3. Click "Generate New Token"
  4. Give it a name: "guardian-cicd"
  5. Select "Write" scope
  6. Copy the token immediately (shown only once)
- **Format**: `dop_v1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

#### 2. DATABASE_URL
- **Purpose**: PostgreSQL database connection string
- **Generated automatically** by Terraform/DigitalOcean
- **Format**: `postgresql://username:password@host:port/database?sslmode=require`
- **Note**: This will be automatically set after infrastructure creation

#### 3. REDIS_URL
- **Purpose**: Redis cache connection string for background jobs
- **Generated automatically** by Terraform/DigitalOcean
- **Format**: `rediss://default:password@host:port`
- **Note**: This will be automatically set after infrastructure creation

#### 4. JWT_SECRET
- **Purpose**: Secret key for JWT token signing
- **How to generate**:
  ```bash
  openssl rand -base64 32
  ```
- **Format**: Random 32+ character string
- **Example**: `7K8xNzM5YmQ2ZjI3NGE4ZDk5MzQ5ZTE3MDQ3ZjE5NDg=`

#### 5. ENCRYPTION_KEY
- **Purpose**: AES encryption key for sensitive data
- **How to generate**:
  ```bash
  openssl rand -hex 32
  ```
- **Format**: 64-character hexadecimal string
- **Example**: `a4f8e2b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3`

#### 6. API_URL
- **Purpose**: Public URL of the API service
- **Format**: `https://your-app-name.ondigitalocean.app/api`
- **Note**: Set after initial deployment

### Setting GitHub Secrets

```bash
# Using GitHub CLI
gh secret set DIGITALOCEAN_ACCESS_TOKEN --body "your-token-here"
gh secret set JWT_SECRET --body "$(openssl rand -base64 32)"
gh secret set ENCRYPTION_KEY --body "$(openssl rand -hex 32)"
```

## DigitalOcean App Platform Secrets

These environment variables are configured in the DigitalOcean App Platform settings.

### App-Level Environment Variables

1. **Navigate to**: DigitalOcean Console → Apps → guardian-platform → Settings → App-Level Environment Variables

2. **Add the following encrypted variables**:

| Key | Value | Encrypted |
|-----|-------|-----------|
| DATABASE_URL | (Auto-populated from managed database) | ✓ |
| REDIS_URL | (Auto-populated from Redis instance) | ✓ |
| JWT_SECRET | (Same as GitHub secret) | ✓ |
| ENCRYPTION_KEY | (Same as GitHub secret) | ✓ |
| STORAGE_ACCESS_KEY | (Spaces access key) | ✓ |
| STORAGE_SECRET_KEY | (Spaces secret key) | ✓ |
| SENTRY_DSN | (Optional - for error tracking) | ✓ |
| SMTP_PASSWORD | (Optional - for email notifications) | ✓ |

### Component-Specific Variables

#### Backend Service
```yaml
NODE_ENV: production
LOG_LEVEL: info
PORT: 8080
CORS_ORIGIN: ${APP_URL}
```

#### Frontend Service
```yaml
NODE_ENV: production
NEXT_PUBLIC_API_URL: http://api-service:8080
REACT_APP_API_URL: http://api-service:8080
```

#### Scanner Worker
```yaml
SCANNER_QUEUE: scan-tasks
NUCLEI_TEMPLATES: /app/nuclei-templates
MAX_CONCURRENT_SCANS: 5
```

## Local Development Secrets

For local development, create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env

# Edit with your local values
vim .env
```

### .env File Structure
```env
# Database
DATABASE_URL=postgresql://guardian:password@localhost:5432/guardian_dev
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=local-dev-secret-change-in-production
ENCRYPTION_KEY=local-dev-key-change-in-production

# Services
API_URL=http://localhost:8080
FRONTEND_URL=http://localhost:3000

# DigitalOcean (for local testing)
DIGITALOCEAN_ACCESS_TOKEN=your-dev-token

# Optional Services
SENTRY_DSN=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
```

## Terraform Secrets

For infrastructure deployment, create `terraform.tfvars`:

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
```hcl
do_token     = "dop_v1_your_token_here"
region       = "nyc3"
environment  = "production"
project_name = "guardian-security"
```

⚠️ **Never commit `terraform.tfvars` to version control!**

## Secret Rotation

### Recommended Rotation Schedule
- **API Keys**: Every 90 days
- **JWT Secret**: Every 180 days
- **Database Password**: Every 90 days
- **Encryption Keys**: Only when compromised

### Rotation Process
1. Generate new secret
2. Update in DigitalOcean App Platform
3. Update in GitHub Secrets
4. Trigger redeployment
5. Verify application functionality
6. Remove old secret after 24 hours

## Security Best Practices

1. **Use Strong Secrets**
   - Minimum 32 characters for passwords
   - Use cryptographically secure random generators

2. **Limit Access**
   - Use GitHub's environment protection rules
   - Implement RBAC in DigitalOcean
   - Audit access logs regularly

3. **Monitor Usage**
   - Enable audit logging in DigitalOcean
   - Set up alerts for unusual API activity
   - Review GitHub Actions logs regularly

4. **Backup Strategy**
   - Store encrypted backups of critical secrets
   - Use a separate secure password manager
   - Document recovery procedures

## Troubleshooting

### Common Issues

1. **"Invalid token" error in GitHub Actions**
   - Verify DIGITALOCEAN_ACCESS_TOKEN is correctly set
   - Check token hasn't expired
   - Ensure token has write permissions

2. **Database connection failures**
   - Verify DATABASE_URL format
   - Check VPC connectivity
   - Ensure database firewall allows app connections

3. **Container registry push failures**
   - Verify registry exists: `doctl registry get`
   - Check registry quota: `doctl registry get`
   - Login manually: `doctl registry login`

### Verification Commands

```bash
# Test DigitalOcean token
doctl auth init -t your-token
doctl account get

# Test database connection
psql "$DATABASE_URL" -c "SELECT 1"

# Test Redis connection
redis-cli -u "$REDIS_URL" ping

# Verify GitHub secrets
gh secret list
```

## Emergency Procedures

### Secret Compromise Response
1. **Immediately rotate** the compromised secret
2. **Audit logs** for unauthorized access
3. **Update** all dependent services
4. **Document** the incident
5. **Review** security procedures

### Recovery Contacts
- GitHub Support: https://support.github.com
- DigitalOcean Support: https://www.digitalocean.com/support
- Security Team: security@guardian.example.com

## Automation Scripts

### Secret Generation Script
```bash
#!/bin/bash
# generate-secrets.sh

echo "Generating Guardian Platform Secrets..."

JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -base64 24)

echo "JWT_SECRET=$JWT_SECRET"
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo "DB_PASSWORD=$DB_PASSWORD"

echo ""
echo "Save these secrets securely!"
```

### Health Check Script
```bash
#!/bin/bash
# check-secrets.sh

echo "Checking secret configuration..."

# Check GitHub secrets
gh secret list | grep -q DIGITALOCEAN_ACCESS_TOKEN && echo "✓ GitHub: DIGITALOCEAN_ACCESS_TOKEN" || echo "✗ Missing: DIGITALOCEAN_ACCESS_TOKEN"

# Check DigitalOcean
doctl auth list &>/dev/null && echo "✓ DigitalOcean: Authentication" || echo "✗ DigitalOcean: Not authenticated"

# Check local env
[ -f .env ] && echo "✓ Local: .env file exists" || echo "✗ Local: .env file missing"
```

---

**Last Updated**: 2025-08-06
**Version**: 1.0.0
**Classification**: CONFIDENTIAL - Internal Use Only