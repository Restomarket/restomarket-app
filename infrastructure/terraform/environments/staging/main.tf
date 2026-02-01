# Staging Environment Infrastructure Configuration
# This configuration creates a production-like staging environment with HA setup

variable "allow_github_actions_ssh" {
  description = "Allow GitHub Actions IP ranges to SSH for CI/CD deployment. Fetches IPs from api.github.com/meta."
  type        = bool
  default     = true
}

terraform {
  required_version = ">= 1.0"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
    http = {
      source  = "hashicorp/http"
      version = "~> 3.0"
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

# Fetch GitHub Actions IP ranges for CI/CD SSH deployment access
# See: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-githubs-ip-addresses
data "http" "github_meta" {
  count = var.allow_github_actions_ssh ? 1 : 0

  url = "https://api.github.com/meta"

  request_headers = {
    Accept = "application/json"
  }
}

locals {
  # Combine admin IPs with GitHub Actions IPs when CI/CD deployment is enabled
  # This allows GitHub Actions to SSH to droplets for deployment while keeping admin access
  github_actions_ips = var.allow_github_actions_ssh ? try(jsondecode(data.http.github_meta[0].response_body).actions, []) : []
  ssh_allowed_ips    = distinct(concat(var.admin_ips, local.github_actions_ips))
  # DigitalOcean limits 1000 sources per rule - split into chunks
  ssh_allowed_ips_chunks = chunklist(local.ssh_allowed_ips, 1000)
}

# VPC and Networking
module "networking" {
  source = "../../modules/networking"

  vpc_name                 = "${var.project_name}-${var.environment}-${var.region}-vpc"
  environment              = var.environment
  region                   = var.region
  ip_range                 = var.vpc_ip_range
  vpc_description          = "VPC for ${var.project_name} ${var.environment} environment"
  enable_firewall       = false # Will be enabled after droplets are created
  firewall_droplet_tags = ["${var.project_name}-${var.environment}-api"]
  admin_ssh_ips         = var.admin_ips
  api_port              = var.api_port
  custom_inbound_rules  = var.custom_inbound_rules
  custom_outbound_rules = var.custom_outbound_rules
}

# ============================================================================
# PostgreSQL Database (REMOVED - Migrated to Supabase)
# ============================================================================
# Database is now managed by Supabase cloud service (Free tier)
# Connection strings stored in GitHub Secrets:
# - STAGING_DATABASE_URL (pooler, port 6543)
# - STAGING_DATABASE_DIRECT_URL (direct, port 5432)
#
# See: infrastructure/terraform/environments/staging/supabase.tf
# ============================================================================

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
  maintenance_window_hour = var.redis_maintenance_hour
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

  # Enhanced configuration
  timezone    = var.timezone
  alert_email = var.alert_email
  vpc_cidr    = var.vpc_ip_range

  # Dependencies
  depends_on = [
    module.networking,
    module.redis
  ]
}

# Load Balancer with SSL and Health Checks
resource "digitalocean_loadbalancer" "api" {
  name   = "${var.project_name}-${var.environment}-api-lb"
  region = var.region

  # Forward HTTPS traffic to API port on droplets (only if SSL certificate is configured)
  dynamic "forwarding_rule" {
    for_each = var.ssl_certificate_name != "" ? [1] : []
    content {
      entry_protocol   = "https"
      entry_port       = 443
      target_protocol  = "http"
      target_port      = var.api_port
      certificate_name = var.ssl_certificate_name
    }
  }

  # Forward HTTP traffic to API port
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
    path                     = "/v1/health"
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

  # Redirect HTTP to HTTPS (only when SSL certificate is configured)
  redirect_http_to_https = var.ssl_certificate_name != "" && var.enable_https_redirect

  # Enable PROXY protocol for preserving client IPs
  enable_proxy_protocol = var.enable_proxy_protocol

  # Depends on API cluster being created
  depends_on = [module.api_cluster]
}

# DigitalOcean Firewall for API Servers (Defense-in-Depth)
# This provides a second layer of security in addition to UFW on each droplet
# Created after load balancer so we can restrict API port to LB UID only
resource "digitalocean_firewall" "api_servers" {
  name = "${var.project_name}-${var.environment}-api-firewall"

  # Apply to all API droplets via tag
  tags = ["${var.project_name}-${var.environment}-api"]

  # Inbound Rules

  # Allow SSH from admin IPs + GitHub Actions IPs (for CI/CD deployment)
  # When allow_github_actions_ssh=true, fetches IP ranges from api.github.com/meta
  # DigitalOcean limits 1000 sources per rule - use multiple rules if needed
  dynamic "inbound_rule" {
    for_each = local.ssh_allowed_ips_chunks
    content {
      protocol         = "tcp"
      port_range       = "22"
      source_addresses = inbound_rule.value
    }
  }

  # Allow API port (3002) ONLY from load balancer
  inbound_rule {
    protocol                  = "tcp"
    port_range                = tostring(var.api_port)
    source_load_balancer_uids = [digitalocean_loadbalancer.api.id]
  }

  # Allow all traffic from within VPC (for database, Redis, inter-droplet communication)
  inbound_rule {
    protocol         = "tcp"
    port_range       = "1-65535"
    source_addresses = [var.vpc_ip_range]
  }

  inbound_rule {
    protocol         = "udp"
    port_range       = "1-65535"
    source_addresses = [var.vpc_ip_range]
  }

  inbound_rule {
    protocol         = "icmp"
    source_addresses = [var.vpc_ip_range]
  }

  # Outbound Rules - Allow all outbound traffic
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Ensure load balancer exists before creating firewall
  depends_on = [digitalocean_loadbalancer.api]
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
