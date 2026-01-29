# Development Environment Infrastructure Configuration
# This configuration creates a minimal dev environment with cost optimization

terraform {
  required_version = ">= 1.0"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }

  # Remote state backend configuration
  # Uncomment and configure after creating the backend bucket
  # backend "s3" {
  #   endpoint                    = "nyc3.digitaloceanspaces.com"
  #   key                         = "terraform/dev/terraform.tfstate"
  #   bucket                      = "restomarket-terraform-state"
  #   region                      = "us-east-1" # Required but not used by DO Spaces
  #   skip_credentials_validation = true
  #   skip_metadata_api_check     = true
  #   skip_region_validation      = true
  # }
}

# Provider configuration
provider "digitalocean" {
  token = var.do_token
}

# Data source for SSH keys
data "digitalocean_ssh_key" "default" {
  name = var.ssh_key_name
}

# VPC and Networking
module "networking" {
  source = "../../modules/networking"

  vpc_name                 = "${var.project_name}-${var.environment}-vpc"
  environment              = var.environment
  region                   = var.region
  ip_range                 = var.vpc_ip_range
  vpc_description          = "VPC for ${var.project_name} ${var.environment} environment"
  enable_firewall          = true
  firewall_droplet_tags    = ["${var.project_name}-${var.environment}-api"]
  admin_ssh_ips            = var.admin_ips
  api_port                 = var.api_port
  custom_inbound_rules     = var.custom_inbound_rules
  custom_outbound_rules    = var.custom_outbound_rules
  enable_database_firewall = true
  database_firewall_tags   = ["${var.project_name}-${var.environment}-db"]
}

# PostgreSQL Database
module "database" {
  source = "../../modules/database"

  environment            = var.environment
  project_name           = var.project_name
  region                 = var.region
  postgres_version       = var.db_version
  node_size              = var.db_node_size
  node_count             = var.db_node_count
  database_name          = var.db_name
  database_user          = var.db_user
  vpc_id                 = module.networking.vpc_id
  allowed_ip_ranges      = []
  allowed_droplet_tags   = ["${var.project_name}-${var.environment}-api"]
  enable_connection_pool = var.db_enable_pool
  connection_pool_mode   = var.db_pool_mode
  connection_pool_size   = var.db_pool_size
}

# Redis Cache
module "redis" {
  source = "../../modules/redis"

  environment             = var.environment
  project_name            = var.project_name
  region                  = var.region
  redis_version           = var.redis_version
  node_size               = var.redis_node_size
  vpc_id                  = module.networking.vpc_id
  allowed_droplet_tags    = ["${var.project_name}-${var.environment}-api"]
  enable_firewall         = true
  eviction_policy         = var.redis_eviction_policy
  maintenance_window_day  = var.redis_maintenance_day
  maintenance_window_hour = tonumber(split(":", var.redis_maintenance_hour)[0])
}

# API Droplet Cluster
module "api_cluster" {
  source = "../../modules/api-cluster"

  environment            = var.environment
  region                 = var.region
  cluster_name           = "${var.project_name}-${var.environment}-api"
  droplet_count          = var.api_droplet_count
  droplet_size           = var.api_droplet_size
  droplet_image          = var.api_droplet_image
  ssh_key_names          = [var.ssh_key_name]
  vpc_id                 = module.networking.vpc_id
  api_port               = var.api_port
  enable_backups         = var.api_enable_backups
  enable_monitoring      = var.api_enable_monitoring
  enable_ipv6            = var.api_enable_ipv6
  enable_reserved_ips    = false # No reserved IPs needed for dev
  enable_volumes         = false # No additional volumes for dev
  enable_custom_firewall = false # Using networking module firewall
  custom_user_data       = var.api_custom_user_data

  # Dependencies
  depends_on = [
    module.networking,
    module.database,
    module.redis
  ]
}
