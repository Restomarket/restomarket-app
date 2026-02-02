# DigitalOcean Managed Redis Cluster (now uses Valkey - Redis-compatible)
resource "digitalocean_database_cluster" "redis" {
  name       = "${var.project_name}-${var.environment}-redis"
  engine     = "valkey"
  version    = var.redis_version
  size       = var.node_size
  region     = var.region
  node_count = 1 # Redis clusters are single-node in DigitalOcean

  private_network_uuid = var.vpc_id

  tags = concat(
    [
      "environment:${var.environment}",
      "project:${var.project_name}",
      "service:redis",
      "managed-by:terraform"
    ],
    var.additional_tags
  )

  maintenance_window {
    day  = var.maintenance_window_day
    hour = var.maintenance_window_hour
  }
}

# Firewall rule to allow access from VPC
resource "digitalocean_database_firewall" "redis" {
  count      = var.enable_firewall ? 1 : 0
  cluster_id = digitalocean_database_cluster.redis.id

  # Allow access from VPC CIDR
  dynamic "rule" {
    for_each = var.allowed_vpc_cidrs
    content {
      type  = "ip_addr"
      value = rule.value
    }
  }

  # Allow access from tagged droplets
  dynamic "rule" {
    for_each = var.allowed_droplet_tags
    content {
      type  = "tag"
      value = rule.value
    }
  }
}
