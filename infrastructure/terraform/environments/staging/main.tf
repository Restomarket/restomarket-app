# Staging Environment Infrastructure Configuration
# This configuration creates a production-like staging environment with HA setup

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
  #   key                         = "terraform/staging/terraform.tfstate"
  #   bucket                      = "restomarket-terraform-state"
  #   region                      = "us-east-1" # Required but not used by DO Spaces
  #   skip_credentials_validation = true
  #   skip_metadata_api_check     = true
  #   skip_region_validation      = true
  #   workspace_key_prefix        = "env"
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

# PostgreSQL Database (HA with 2 nodes)
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

# API Droplet Cluster (2 droplets for redundancy)
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
  enable_reserved_ips    = false # Using load balancer instead
  enable_volumes         = var.api_enable_volumes
  volume_size            = var.api_volume_size
  enable_custom_firewall = false # Using networking module firewall
  custom_user_data       = var.api_custom_user_data

  # Dependencies
  depends_on = [
    module.networking,
    module.database,
    module.redis
  ]
}

# Load Balancer with SSL and Health Checks
resource "digitalocean_loadbalancer" "api" {
  name   = "${var.project_name}-${var.environment}-api-lb"
  region = var.region

  # Forward HTTPS traffic to API port on droplets
  forwarding_rule {
    entry_protocol  = "https"
    entry_port      = 443
    target_protocol = "http"
    target_port     = var.api_port

    # SSL certificate (use Let's Encrypt managed certificate)
    certificate_name = var.ssl_certificate_name != "" ? var.ssl_certificate_name : null
  }

  # Forward HTTP traffic to HTTPS (redirect)
  forwarding_rule {
    entry_protocol  = "http"
    entry_port      = 80
    target_protocol = "http"
    target_port     = var.api_port
  }

  # Health check configuration
  healthcheck {
    protocol                 = "http"
    port                     = var.api_port
    path                     = "/health"
    check_interval_seconds   = 10
    response_timeout_seconds = 5
    unhealthy_threshold      = 3
    healthy_threshold        = 2
  }

  # Attach API droplets by tag
  droplet_tag = "${var.project_name}-${var.environment}-api"

  # VPC integration
  vpc_uuid = module.networking.vpc_id

  # Sticky sessions disabled (stateless API)
  sticky_sessions {
    type = "none"
  }

  # Redirect HTTP to HTTPS
  redirect_http_to_https = var.enable_https_redirect

  # Enable PROXY protocol for preserving client IPs
  enable_proxy_protocol = var.enable_proxy_protocol

  # Depends on API cluster being created
  depends_on = [module.api_cluster]
}

# DigitalOcean Monitoring Alerts
resource "digitalocean_monitor_alert" "cpu_alert" {
  count = var.enable_monitoring_alerts ? 1 : 0

  alerts {
    email = var.alert_email_recipients
    slack {
      channel = var.alert_slack_channel
      url     = var.alert_slack_webhook
    }
  }

  window      = "5m"
  type        = "v1/insights/droplet/cpu"
  compare     = "GreaterThan"
  value       = 80
  enabled     = true
  entities    = module.api_cluster.droplet_ids
  description = "${var.project_name} ${var.environment} - High CPU usage detected"

  tags = [var.environment, var.project_name, "cpu-alert"]
}

resource "digitalocean_monitor_alert" "memory_alert" {
  count = var.enable_monitoring_alerts ? 1 : 0

  alerts {
    email = var.alert_email_recipients
    slack {
      channel = var.alert_slack_channel
      url     = var.alert_slack_webhook
    }
  }

  window      = "5m"
  type        = "v1/insights/droplet/memory_utilization_percent"
  compare     = "GreaterThan"
  value       = 85
  enabled     = true
  entities    = module.api_cluster.droplet_ids
  description = "${var.project_name} ${var.environment} - High memory usage detected"

  tags = [var.environment, var.project_name, "memory-alert"]
}

resource "digitalocean_monitor_alert" "disk_alert" {
  count = var.enable_monitoring_alerts ? 1 : 0

  alerts {
    email = var.alert_email_recipients
    slack {
      channel = var.alert_slack_channel
      url     = var.alert_slack_webhook
    }
  }

  window      = "5m"
  type        = "v1/insights/droplet/disk_utilization_percent"
  compare     = "GreaterThan"
  value       = 90
  enabled     = true
  entities    = module.api_cluster.droplet_ids
  description = "${var.project_name} ${var.environment} - High disk usage detected"

  tags = [var.environment, var.project_name, "disk-alert"]
}

# Load Balancer Health Check Alert (via droplet health)
resource "digitalocean_monitor_alert" "load_balancer_health" {
  count = var.enable_monitoring_alerts ? 1 : 0

  alerts {
    email = var.alert_email_recipients
    slack {
      channel = var.alert_slack_channel
      url     = var.alert_slack_webhook
    }
  }

  window      = "5m"
  type        = "v1/insights/droplet/load_1"
  compare     = "GreaterThan"
  value       = 3
  enabled     = true
  entities    = module.api_cluster.droplet_ids
  description = "${var.project_name} ${var.environment} - High load average detected"

  tags = [var.environment, var.project_name, "load-alert"]
}
