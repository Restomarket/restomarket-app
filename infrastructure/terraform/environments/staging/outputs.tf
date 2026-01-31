# Staging Environment Outputs
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

output "database_pool_uri" {
  description = "Database connection pool URI (if enabled)"
  value       = var.db_enable_pool ? module.database.connection_pool_uri : null
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
# Load Balancer Outputs
# ============================================================================

output "load_balancer_id" {
  description = "Load balancer ID"
  value       = digitalocean_loadbalancer.api.id
}

output "load_balancer_ip" {
  description = "Load balancer public IP address"
  value       = digitalocean_loadbalancer.api.ip
}

output "load_balancer_urn" {
  description = "Load balancer URN"
  value       = digitalocean_loadbalancer.api.urn
}

output "load_balancer_name" {
  description = "Load balancer name"
  value       = digitalocean_loadbalancer.api.name
}

output "load_balancer_status" {
  description = "Load balancer status"
  value       = digitalocean_loadbalancer.api.status
}

# ============================================================================
# Monitoring Alerts Outputs
# ============================================================================

output "cpu_alert_id" {
  description = "CPU alert ID"
  value       = var.enable_monitoring_alerts ? digitalocean_monitor_alert.cpu_alert[0].uuid : null
}

output "memory_alert_id" {
  description = "Memory alert ID"
  value       = var.enable_monitoring_alerts ? digitalocean_monitor_alert.memory_alert[0].uuid : null
}

output "disk_alert_id" {
  description = "Disk alert ID"
  value       = var.enable_monitoring_alerts ? digitalocean_monitor_alert.disk_alert[0].uuid : null
}

output "load_alert_id" {
  description = "Load average alert ID"
  value       = var.enable_monitoring_alerts ? digitalocean_monitor_alert.load_balancer_health[0].uuid : null
}

# ============================================================================
# Summary Output
# ============================================================================

output "environment_summary" {
  description = "Summary of the staging environment"
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
      ha      = var.db_node_count > 1
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
    load_balancer = {
      id     = digitalocean_loadbalancer.api.id
      ip     = digitalocean_loadbalancer.api.ip
      status = digitalocean_loadbalancer.api.status
    }
    monitoring = {
      alerts_enabled = var.enable_monitoring_alerts
      cpu_alert      = var.enable_monitoring_alerts ? digitalocean_monitor_alert.cpu_alert[0].uuid : null
      memory_alert   = var.enable_monitoring_alerts ? digitalocean_monitor_alert.memory_alert[0].uuid : null
      disk_alert     = var.enable_monitoring_alerts ? digitalocean_monitor_alert.disk_alert[0].uuid : null
      load_alert     = var.enable_monitoring_alerts ? digitalocean_monitor_alert.load_balancer_health[0].uuid : null
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

output "load_balancer_url" {
  description = "Load balancer URL (HTTP)"
  value       = "http://${digitalocean_loadbalancer.api.ip}"
}

output "load_balancer_https_url" {
  description = "Load balancer URL (HTTPS) - configure SSL certificate first"
  value       = var.ssl_certificate_name != "" ? "https://${digitalocean_loadbalancer.api.ip}" : "SSL certificate not configured"
}

output "health_check_url" {
  description = "Health check endpoint via load balancer"
  value       = "http://${digitalocean_loadbalancer.api.ip}/v1/health"
}

output "quick_start" {
  description = "Quick start commands for using this infrastructure"
  sensitive   = true
  value       = <<-EOT
    Staging Environment Quick Start:

    1. Access API via Load Balancer:
       ${var.ssl_certificate_name != "" ? "https://${digitalocean_loadbalancer.api.ip}" : "http://${digitalocean_loadbalancer.api.ip}"}

    2. Test Health Check:
       curl ${var.ssl_certificate_name != "" ? "https://${digitalocean_loadbalancer.api.ip}/v1/health" : "http://${digitalocean_loadbalancer.api.ip}/v1/health"}

    3. SSH to API droplets (for maintenance):
       ${length(module.api_cluster.public_ipv4_addresses) > 0 ? "ssh root@${module.api_cluster.public_ipv4_addresses[0]}" : "No droplets available"}

    4. Database connection (use private host from VPC):
       Host: ${module.database.cluster_host}
       Port: ${module.database.cluster_port}
       Database: ${module.database.database_name}
       User: ${module.database.database_user}
       ${var.db_enable_pool ? "Pool URI available via output 'database_pool_uri'" : ""}

    5. Redis connection (use private host from VPC):
       Host: ${module.redis.private_host}
       Port: ${module.redis.port}

    6. To get sensitive values (passwords, connection strings):
       terraform output -json | jq '.database_password.value' -r
       terraform output -json | jq '.redis_password.value' -r
       terraform output database_uri
       terraform output redis_uri

    7. View monitoring alerts:
       doctl monitoring alert list --format ID,Type,Description

    8. View complete summary:
       terraform output environment_summary

    9. DNS Setup (after configuring domain):
       Add A record: staging-api.yourdomain.com -> ${digitalocean_loadbalancer.api.ip}
       Then configure SSL certificate via DigitalOcean console

    10. Monitoring Dashboard:
        https://cloud.digitalocean.com/monitoring/droplets
  EOT
}

# ============================================================================
# Deployment Information
# ============================================================================

output "deployment_notes" {
  description = "Important deployment notes"
  value       = <<-EOT
    Staging Environment Deployment Notes:

    Infrastructure Configuration:
    - ${var.api_droplet_count} API droplets (${var.api_droplet_size})
    - ${var.db_node_count} PostgreSQL nodes (${var.db_node_size}) - ${var.db_node_count > 1 ? "HA enabled" : "Single node"}
    - Redis cache (${var.redis_node_size})
    - Load balancer with health checks
    - ${var.enable_monitoring_alerts ? "Monitoring alerts ENABLED" : "Monitoring alerts DISABLED"}

    Estimated Monthly Cost:
    - API droplets: ~$${var.api_droplet_count * 24}
    - Database: ~$${var.db_node_count * 60}
    - Redis: ~$60
    - Load balancer: ~$12
    - Total: ~$${(var.api_droplet_count * 24) + (var.db_node_count * 60) + 60 + 12}/month (excluding bandwidth)

    Next Steps:
    1. Configure DNS A record for your domain
    2. Set up SSL certificate in DigitalOcean console
    3. Update ssl_certificate_name variable and re-apply
    4. Configure alert email recipients and Slack webhook
    5. Test zero-downtime deployment procedures
    6. Document rollback procedures
  EOT
}
