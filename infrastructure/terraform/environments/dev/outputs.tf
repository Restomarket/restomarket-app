# Development Environment Outputs
# These outputs provide connection information for all infrastructure components

# ============================================================================
# VPC and Networking Outputs
# ============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "vpc_urn" {
  description = "VPC URN"
  value       = module.networking.vpc_urn
}

output "vpc_ip_range" {
  description = "VPC IP range"
  value       = module.networking.vpc_ip_range
}

output "api_firewall_id" {
  description = "API server firewall ID"
  value       = module.networking.api_firewall_id
}

output "db_firewall_id" {
  description = "Database firewall ID"
  value       = module.networking.database_firewall_id
}

# ============================================================================
# Database Outputs
# ============================================================================

output "database_id" {
  description = "Database cluster ID"
  value       = module.database.cluster_id
}

output "database_host" {
  description = "Database host (private network)"
  value       = module.database.cluster_host
  sensitive   = true
}

output "database_port" {
  description = "Database port"
  value       = module.database.cluster_port
}

output "database_name" {
  description = "Database name"
  value       = module.database.database_name
}

output "database_user" {
  description = "Database user"
  value       = module.database.database_user
}

output "database_password" {
  description = "Database password"
  value       = module.database.database_password
  sensitive   = true
}

output "database_connection_string" {
  description = "Database connection string (private network)"
  value       = module.database.connection_string
  sensitive   = true
}

output "database_uri" {
  description = "Complete database URI for application configuration"
  value       = "postgresql://${module.database.database_user}:${module.database.database_password}@${module.database.cluster_host}:${module.database.cluster_port}/${module.database.database_name}?sslmode=require"
  sensitive   = true
}

# ============================================================================
# Redis Outputs
# ============================================================================

output "redis_id" {
  description = "Redis cluster ID"
  value       = module.redis.cluster_id
}

output "redis_host" {
  description = "Redis host (private network)"
  value       = module.redis.private_host
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = module.redis.port
}

output "redis_password" {
  description = "Redis password"
  value       = module.redis.password
  sensitive   = true
}

output "redis_connection_string" {
  description = "Redis connection string (private network)"
  value       = module.redis.connection_string_private
  sensitive   = true
}

output "redis_uri" {
  description = "Complete Redis URI for application configuration"
  value       = module.redis.redis_uri_private
  sensitive   = true
}

# ============================================================================
# API Cluster Outputs
# ============================================================================

output "api_droplet_ids" {
  description = "API droplet IDs"
  value       = module.api_cluster.droplet_ids
}

output "api_droplet_names" {
  description = "API droplet names"
  value       = module.api_cluster.droplet_names
}

output "api_public_ips" {
  description = "API droplet public IP addresses"
  value       = module.api_cluster.public_ipv4_addresses
}

output "api_private_ips" {
  description = "API droplet private IP addresses"
  value       = module.api_cluster.private_ipv4_addresses
}

output "api_ipv6_addresses" {
  description = "API droplet IPv6 addresses (if enabled)"
  value       = module.api_cluster.public_ipv6_addresses
}

# ============================================================================
# Summary Output
# ============================================================================

output "environment_summary" {
  description = "Summary of the development environment"
  value = {
    environment = var.environment
    region      = var.region
    vpc = {
      id       = module.networking.vpc_id
      ip_range = module.networking.vpc_ip_range
    }
    database = {
      id      = module.database.cluster_id
      engine  = module.database.cluster_engine
      version = module.database.cluster_version
      nodes   = var.db_node_count
      size    = var.db_node_size
    }
    redis = {
      id      = module.redis.cluster_id
      engine  = module.redis.engine
      version = module.redis.version
      size    = var.redis_node_size
    }
    api_cluster = {
      count       = var.api_droplet_count
      size        = var.api_droplet_size
      image       = var.api_droplet_image
      public_ips  = module.api_cluster.public_ipv4_addresses
      private_ips = module.api_cluster.private_ipv4_addresses
    }
  }
}

# ============================================================================
# Connection Commands
# ============================================================================

output "ssh_commands" {
  description = "SSH commands to connect to API droplets"
  value = [
    for i, ip in module.api_cluster.public_ipv4_addresses :
    "ssh root@${ip}  # ${module.api_cluster.droplet_names[i]}"
  ]
}

output "quick_start" {
  description = "Quick start commands for using this infrastructure"
  sensitive   = true
  value       = <<-EOT
    Development Environment Quick Start:

    1. SSH to API droplet:
       ${length(module.api_cluster.public_ipv4_addresses) > 0 ? "ssh root@${module.api_cluster.public_ipv4_addresses[0]}" : "No droplets available"}

    2. Database connection (use private host from VPC):
       Host: ${module.database.cluster_host}
       Port: ${module.database.cluster_port}
       Database: ${module.database.database_name}
       User: ${module.database.database_user}

    3. Redis connection (use private host from VPC):
       Host: ${module.redis.private_host}
       Port: ${module.redis.port}

    4. To get sensitive values (passwords, connection strings):
       terraform output -json | jq '.database_password.value' -r
       terraform output -json | jq '.redis_password.value' -r
       terraform output database_uri
       terraform output redis_uri

    5. View complete summary:
       terraform output environment_summary
  EOT
}
