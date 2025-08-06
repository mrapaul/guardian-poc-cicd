terraform {
  required_version = ">= 1.0"
  
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

# Variables
variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "nyc3"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "guardian-security"
}

# VPC Configuration
resource "digitalocean_vpc" "guardian_vpc" {
  name        = "${var.project_name}-vpc-${var.environment}"
  region      = var.region
  ip_range    = "10.10.0.0/16"
  description = "Guardian Security Platform VPC for ${var.environment}"
}

# Container Registry
resource "digitalocean_container_registry" "guardian_registry" {
  name                   = var.project_name
  subscription_tier_slug = "basic"
  region                 = var.region
}

resource "digitalocean_container_registry_docker_credentials" "guardian_credentials" {
  registry_name = digitalocean_container_registry.guardian_registry.name
}

# Managed Database
resource "digitalocean_database_cluster" "guardian_db" {
  name       = "${var.project_name}-db-${var.environment}"
  engine     = "pg"
  version    = "15"
  size       = "db-s-1vcpu-1gb"
  region     = var.region
  node_count = 1
  
  private_network_uuid = digitalocean_vpc.guardian_vpc.id
  
  maintenance_window {
    day  = "sunday"
    hour = "02:00:00"
  }
  
  tags = [var.environment, var.project_name]
}

resource "digitalocean_database_db" "guardian_database" {
  cluster_id = digitalocean_database_cluster.guardian_db.id
  name       = "guardian"
}

resource "digitalocean_database_user" "guardian_user" {
  cluster_id = digitalocean_database_cluster.guardian_db.id
  name       = "guardian_app"
}

# Database Firewall Rules
resource "digitalocean_database_firewall" "guardian_db_firewall" {
  cluster_id = digitalocean_database_cluster.guardian_db.id
  
  rule {
    type  = "vpc"
    value = digitalocean_vpc.guardian_vpc.id
  }
}

# Redis Cache (for background jobs)
resource "digitalocean_database_cluster" "guardian_redis" {
  name       = "${var.project_name}-redis-${var.environment}"
  engine     = "redis"
  version    = "7"
  size       = "db-s-1vcpu-1gb"
  region     = var.region
  node_count = 1
  
  private_network_uuid = digitalocean_vpc.guardian_vpc.id
  
  eviction_policy = "allkeys_lru"
  
  tags = [var.environment, var.project_name]
}

# Spaces Object Storage (for file uploads/reports)
resource "digitalocean_spaces_bucket" "guardian_storage" {
  name   = "${var.project_name}-storage-${var.environment}"
  region = var.region
  acl    = "private"
  
  cors_rule {
    allowed_origins = ["https://*.ondigitalocean.app"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_headers = ["*"]
    max_age_seconds = 3600
  }
  
  lifecycle_rule {
    enabled = true
    
    expiration {
      days = 90
    }
  }
  
  versioning {
    enabled = true
  }
}

# Project for resource grouping
resource "digitalocean_project" "guardian_project" {
  name        = "${var.project_name}-${var.environment}"
  description = "Guardian Security Platform - ${var.environment}"
  purpose     = "Web Application"
  environment = var.environment
  
  resources = [
    digitalocean_database_cluster.guardian_db.urn,
    digitalocean_database_cluster.guardian_redis.urn,
    digitalocean_spaces_bucket.guardian_storage.urn
  ]
}

# Outputs
output "vpc_id" {
  value       = digitalocean_vpc.guardian_vpc.id
  description = "VPC ID"
}

output "database_uri" {
  value       = digitalocean_database_cluster.guardian_db.private_uri
  sensitive   = true
  description = "Database connection URI"
}

output "redis_uri" {
  value       = digitalocean_database_cluster.guardian_redis.private_uri
  sensitive   = true
  description = "Redis connection URI"
}

output "registry_endpoint" {
  value       = digitalocean_container_registry.guardian_registry.endpoint
  description = "Container registry endpoint"
}

output "storage_endpoint" {
  value       = "https://${var.region}.digitaloceanspaces.com"
  description = "Object storage endpoint"
}