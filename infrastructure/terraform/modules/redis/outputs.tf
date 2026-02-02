# Cluster Outputs
output "cluster_id" {
  description = "The ID of the Redis cluster"
  value       = digitalocean_database_cluster.redis.id
}

output "cluster_urn" {
  description = "The URN of the Redis cluster"
  value       = digitalocean_database_cluster.redis.urn
}

output "cluster_name" {
  description = "The name of the Redis cluster"
  value       = digitalocean_database_cluster.redis.name
}

output "engine" {
  description = "Database engine (redis)"
  value       = digitalocean_database_cluster.redis.engine
}

output "version" {
  description = "Redis version"
  value       = digitalocean_database_cluster.redis.version
}

output "region" {
  description = "Region where the Redis cluster is deployed"
  value       = digitalocean_database_cluster.redis.region
}

# Connection Details
output "host" {
  description = "Redis cluster host"
  value       = digitalocean_database_cluster.redis.host
  sensitive   = true
}

output "private_host" {
  description = "Redis cluster private host (VPC)"
  value       = digitalocean_database_cluster.redis.private_host
  sensitive   = true
}

output "port" {
  description = "Redis cluster port"
  value       = digitalocean_database_cluster.redis.port
}

output "password" {
  description = "Redis cluster password"
  value       = digitalocean_database_cluster.redis.password
  sensitive   = true
}

output "user" {
  description = "Redis default user"
  value       = digitalocean_database_cluster.redis.user
  sensitive   = true
}

# Connection Strings
output "connection_string_private" {
  description = "Redis connection string (private network, recommended)"
  value       = "redis://${digitalocean_database_cluster.redis.user}:${digitalocean_database_cluster.redis.password}@${digitalocean_database_cluster.redis.private_host}:${digitalocean_database_cluster.redis.port}"
  sensitive   = true
}

output "connection_string_public" {
  description = "Redis connection string (public network, for initial setup only)"
  value       = "redis://${digitalocean_database_cluster.redis.user}:${digitalocean_database_cluster.redis.password}@${digitalocean_database_cluster.redis.host}:${digitalocean_database_cluster.redis.port}"
  sensitive   = true
}

# Connection URI for applications
output "redis_uri_private" {
  description = "Redis URI for private network connections (use this in production)"
  value       = "redis://${digitalocean_database_cluster.redis.user}:${digitalocean_database_cluster.redis.password}@${digitalocean_database_cluster.redis.private_host}:${digitalocean_database_cluster.redis.port}/0"
  sensitive   = true
}

output "redis_uri_public" {
  description = "Redis URI for public network connections (for initial setup/testing only)"
  value       = "redis://${digitalocean_database_cluster.redis.user}:${digitalocean_database_cluster.redis.password}@${digitalocean_database_cluster.redis.host}:${digitalocean_database_cluster.redis.port}/0"
  sensitive   = true
}

# Firewall
output "firewall_id" {
  description = "The ID of the Redis firewall (if enabled)"
  value       = var.enable_firewall ? digitalocean_database_firewall.redis[0].id : null
}

# Additional Metadata
output "tags" {
  description = "Tags applied to the Redis cluster"
  value       = digitalocean_database_cluster.redis.tags
}

# Note: created_at is not available in the DigitalOcean provider for database clusters

# Summary Output
output "summary" {
  description = "Summary of the Redis cluster configuration"
  value = {
    name             = digitalocean_database_cluster.redis.name
    version          = digitalocean_database_cluster.redis.version
    region           = digitalocean_database_cluster.redis.region
    size             = digitalocean_database_cluster.redis.size
    private_host     = digitalocean_database_cluster.redis.private_host
    port             = digitalocean_database_cluster.redis.port
    vpc_id           = var.vpc_id
    firewall_enabled = var.enable_firewall
  }
  sensitive = true
}
