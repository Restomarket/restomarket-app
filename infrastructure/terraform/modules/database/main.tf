# DigitalOcean Managed PostgreSQL Database Module
# This module creates a managed PostgreSQL database cluster with configurable settings

terraform {
  required_version = ">= 1.0"
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

# PostgreSQL Database Cluster
resource "digitalocean_database_cluster" "postgres" {
  name       = "${var.project_name}-${var.environment}-postgres"
  engine     = "pg"
  version    = var.postgres_version
  size       = var.node_size
  region     = var.region
  node_count = var.node_count

  # Private networking - attach to VPC
  private_network_uuid = var.vpc_id

  # Maintenance window
  maintenance_window {
    day  = var.maintenance_day
    hour = var.maintenance_hour
  }

  # Tags for organization and cost tracking
  tags = concat(
    [
      "${var.project_name}-${var.environment}",
      "environment:${var.environment}",
      "managed-by:terraform",
      "service:database"
    ],
    var.additional_tags
  )
}

# Create application database
resource "digitalocean_database_db" "app_database" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = var.database_name
}

# Create application database user
resource "digitalocean_database_user" "app_user" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = var.database_user
}

# Firewall rule to allow access from specific VPC/droplets
resource "digitalocean_database_firewall" "postgres_firewall" {
  cluster_id = digitalocean_database_cluster.postgres.id

  # Allow access from VPC CIDR (all droplets in VPC)
  dynamic "rule" {
    for_each = var.allowed_ip_ranges
    content {
      type  = "ip_addr"
      value = rule.value
    }
  }

  # Allow access from tagged droplets (recommended)
  dynamic "rule" {
    for_each = var.allowed_droplet_tags
    content {
      type  = "tag"
      value = rule.value
    }
  }
}

# Connection pooler (optional, for high-traffic environments)
resource "digitalocean_database_connection_pool" "app_pool" {
  count      = var.enable_connection_pool ? 1 : 0
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "${var.database_name}_pool"
  mode       = var.connection_pool_mode
  size       = var.connection_pool_size
  db_name    = digitalocean_database_db.app_database.name
  user       = digitalocean_database_user.app_user.name
}

# Database replica (optional, for read scaling)
resource "digitalocean_database_replica" "read_replica" {
  count      = var.enable_read_replica ? 1 : 0
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "${var.project_name}-${var.environment}-postgres-replica"
  size       = var.replica_size != "" ? var.replica_size : var.node_size
  region     = var.replica_region != "" ? var.replica_region : var.region

  tags = concat(
    [
      "${var.project_name}-${var.environment}",
      "environment:${var.environment}",
      "managed-by:terraform",
      "service:database-replica"
    ],
    var.additional_tags
  )
}
