# Output Variables for Database Module

# Database Cluster Outputs
output "cluster_id" {
  description = "Database cluster ID"
  value       = digitalocean_database_cluster.postgres.id
}

output "cluster_urn" {
  description = "Database cluster URN"
  value       = digitalocean_database_cluster.postgres.urn
}

output "cluster_name" {
  description = "Database cluster name"
  value       = digitalocean_database_cluster.postgres.name
}

output "cluster_engine" {
  description = "Database engine"
  value       = digitalocean_database_cluster.postgres.engine
}

output "cluster_version" {
  description = "Database version"
  value       = digitalocean_database_cluster.postgres.version
}

output "cluster_host" {
  description = "Database cluster hostname (private network)"
  value       = digitalocean_database_cluster.postgres.private_host
  sensitive   = true
}

output "cluster_port" {
  description = "Database cluster port"
  value       = digitalocean_database_cluster.postgres.port
}

output "cluster_uri" {
  description = "Database cluster URI (private network)"
  value       = digitalocean_database_cluster.postgres.private_uri
  sensitive   = true
}

output "cluster_id_short" {
  description = "Database cluster ID (last 8 characters)"
  value       = substr(digitalocean_database_cluster.postgres.id, -8, 8)
}

output "cluster_region" {
  description = "Database cluster region"
  value       = digitalocean_database_cluster.postgres.region
}

output "cluster_size" {
  description = "Database node size"
  value       = digitalocean_database_cluster.postgres.size
}

output "cluster_node_count" {
  description = "Number of database nodes"
  value       = digitalocean_database_cluster.postgres.node_count
}

# Database and User Outputs
output "database_name" {
  description = "Application database name"
  value       = digitalocean_database_db.app_database.name
}

output "database_user" {
  description = "Application database user"
  value       = digitalocean_database_user.app_user.name
}

output "database_password" {
  description = "Application database user password"
  value       = digitalocean_database_user.app_user.password
  sensitive   = true
}

# Connection String Outputs
output "connection_string" {
  description = "Database connection string for application (private network)"
  value = format(
    "postgresql://%s:%s@%s:%s/%s?sslmode=require",
    digitalocean_database_user.app_user.name,
    digitalocean_database_user.app_user.password,
    digitalocean_database_cluster.postgres.private_host,
    digitalocean_database_cluster.postgres.port,
    digitalocean_database_db.app_database.name
  )
  sensitive = true
}

output "connection_string_public" {
  description = "Database connection string for external access (public network)"
  value = format(
    "postgresql://%s:%s@%s:%s/%s?sslmode=require",
    digitalocean_database_user.app_user.name,
    digitalocean_database_user.app_user.password,
    digitalocean_database_cluster.postgres.host,
    digitalocean_database_cluster.postgres.port,
    digitalocean_database_db.app_database.name
  )
  sensitive = true
}

# Connection Pool Outputs (conditional)
output "connection_pool_id" {
  description = "Connection pool ID (if enabled)"
  value       = var.enable_connection_pool ? digitalocean_database_connection_pool.app_pool[0].id : null
}

output "connection_pool_name" {
  description = "Connection pool name (if enabled)"
  value       = var.enable_connection_pool ? digitalocean_database_connection_pool.app_pool[0].name : null
}

output "connection_pool_host" {
  description = "Connection pool hostname (private network, if enabled)"
  value       = var.enable_connection_pool ? digitalocean_database_connection_pool.app_pool[0].private_host : null
  sensitive   = true
}

output "connection_pool_uri" {
  description = "Connection pool URI (private network, if enabled)"
  value       = var.enable_connection_pool ? digitalocean_database_connection_pool.app_pool[0].private_uri : null
  sensitive   = true
}

# Read Replica Outputs (conditional)
output "replica_id" {
  description = "Read replica ID (if enabled)"
  value       = var.enable_read_replica ? digitalocean_database_replica.read_replica[0].id : null
}

output "replica_name" {
  description = "Read replica name (if enabled)"
  value       = var.enable_read_replica ? digitalocean_database_replica.read_replica[0].name : null
}

output "replica_host" {
  description = "Read replica hostname (private network, if enabled)"
  value       = var.enable_read_replica ? digitalocean_database_replica.read_replica[0].private_host : null
  sensitive   = true
}

output "replica_uri" {
  description = "Read replica URI (private network, if enabled)"
  value       = var.enable_read_replica ? digitalocean_database_replica.read_replica[0].private_uri : null
  sensitive   = true
}

output "replica_region" {
  description = "Read replica region (if enabled)"
  value       = var.enable_read_replica ? digitalocean_database_replica.read_replica[0].region : null
}

# Firewall Outputs
output "firewall_id" {
  description = "Database firewall ID"
  value       = digitalocean_database_firewall.postgres_firewall.id
}

# Convenience Outputs
output "tags" {
  description = "Tags applied to database cluster"
  value       = digitalocean_database_cluster.postgres.tags
}

output "maintenance_window" {
  description = "Maintenance window configuration"
  value = {
    day  = digitalocean_database_cluster.postgres.maintenance_window[0].day
    hour = digitalocean_database_cluster.postgres.maintenance_window[0].hour
  }
}

# Summary output for easy reference
output "summary" {
  description = "Database cluster summary"
  value = {
    name            = digitalocean_database_cluster.postgres.name
    engine          = "${digitalocean_database_cluster.postgres.engine} ${digitalocean_database_cluster.postgres.version}"
    size            = digitalocean_database_cluster.postgres.size
    node_count      = digitalocean_database_cluster.postgres.node_count
    region          = digitalocean_database_cluster.postgres.region
    database        = digitalocean_database_db.app_database.name
    user            = digitalocean_database_user.app_user.name
    pool_enabled    = var.enable_connection_pool
    replica_enabled = var.enable_read_replica
  }
}
