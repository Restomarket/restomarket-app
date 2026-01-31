# Staging Environment Variables
# Production-like configuration with HA and redundancy

# ============================================================================
# Provider Configuration
# ============================================================================

variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

# ============================================================================
# General Configuration
# ============================================================================

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "stage"], var.environment)
    error_message = "Environment must be 'staging' or 'stage' for this configuration."
  }
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "restomarket"
}

variable "region" {
  description = "DigitalOcean region for all resources"
  type        = string
  default     = "nyc3"
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default = {
    ManagedBy = "Terraform"
    Purpose   = "Staging"
  }
}

# ============================================================================
# Networking Configuration
# ============================================================================

variable "vpc_ip_range" {
  description = "IP range for VPC in CIDR notation"
  type        = string
  default     = "10.20.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_ip_range, 0))
    error_message = "VPC IP range must be valid CIDR notation."
  }
}

variable "admin_ips" {
  description = "List of admin IP addresses allowed SSH access (restrict in staging)"
  type        = list(string)
  default     = [] # Add your admin IPs here
}

variable "api_port" {
  description = "Port for API service"
  type        = number
  default     = 3002

  validation {
    condition     = var.api_port >= 1024 && var.api_port <= 65535
    error_message = "API port must be between 1024 and 65535."
  }
}

variable "custom_inbound_rules" {
  description = "Custom inbound firewall rules"
  type = list(object({
    protocol         = string
    port_range       = string
    source_addresses = list(string)
  }))
  default = []
}

variable "custom_outbound_rules" {
  description = "Custom outbound firewall rules"
  type = list(object({
    protocol              = string
    port_range            = string
    destination_addresses = list(string)
  }))
  default = []
}

# ============================================================================
# Database Configuration (HA with 2 nodes)
# ============================================================================

variable "db_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "16"

  validation {
    condition     = contains(["12", "13", "14", "15", "16"], var.db_version)
    error_message = "PostgreSQL version must be one of: 12, 13, 14, 15, 16."
  }
}

variable "db_node_size" {
  description = "Database node size (slug)"
  type        = string
  default     = "db-s-2vcpu-4gb" # $60/month - suitable for staging
}

variable "db_node_count" {
  description = "Number of database nodes (2 for HA in staging)"
  type        = number
  default     = 2

  validation {
    condition     = var.db_node_count >= 1 && var.db_node_count <= 3
    error_message = "Database node count must be between 1 and 3."
  }
}

variable "db_name" {
  description = "Name of the database to create"
  type        = string
  default     = "restomarket_staging"
}

variable "db_user" {
  description = "Name of the database user to create"
  type        = string
  default     = "restomarket_app"
}

variable "db_enable_pool" {
  description = "Enable connection pooling"
  type        = bool
  default     = true # Enable in staging to test production config
}

variable "db_pool_mode" {
  description = "Connection pool mode (transaction, session, statement)"
  type        = string
  default     = "transaction"

  validation {
    condition     = contains(["transaction", "session", "statement"], var.db_pool_mode)
    error_message = "Pool mode must be one of: transaction, session, statement."
  }
}

variable "db_pool_size" {
  description = "Connection pool size"
  type        = number
  default     = 25

  validation {
    condition     = var.db_pool_size >= 1 && var.db_pool_size <= 100
    error_message = "Pool size must be between 1 and 100."
  }
}

# ============================================================================
# Redis Configuration
# ============================================================================

variable "redis_version" {
  description = "Redis version"
  type        = string
  default     = "7"

  validation {
    condition     = contains(["6", "7", "8"], var.redis_version)
    error_message = "Redis/Valkey version must be 6, 7, or 8 (Valkey)."
  }
}

variable "redis_node_size" {
  description = "Redis node size (slug)"
  type        = string
  default     = "db-s-2vcpu-4gb" # $60/month - suitable for staging
}

variable "redis_eviction_policy" {
  description = "Redis eviction policy"
  type        = string
  default     = "allkeys-lru"

  validation {
    condition = contains([
      "noeviction",
      "allkeys-lru",
      "allkeys-lfu",
      "allkeys-random",
      "volatile-lru",
      "volatile-lfu",
      "volatile-random",
      "volatile-ttl"
    ], var.redis_eviction_policy)
    error_message = "Invalid Redis eviction policy."
  }
}

variable "redis_maintenance_day" {
  description = "Day of week for maintenance (monday, tuesday, etc.)"
  type        = string
  default     = "sunday"
}

variable "redis_maintenance_hour" {
  description = "Hour of day for maintenance (0-23)"
  type        = string
  default     = "02:00"
}

# ============================================================================
# API Droplet Configuration (2 droplets for redundancy)
# ============================================================================

variable "api_droplet_count" {
  description = "Number of API droplets (2 for redundancy in staging)"
  type        = number
  default     = 2

  validation {
    condition     = var.api_droplet_count >= 1 && var.api_droplet_count <= 10
    error_message = "API droplet count must be between 1 and 10."
  }
}

variable "api_droplet_size" {
  description = "API droplet size (slug)"
  type        = string
  default     = "s-2vcpu-4gb" # $24/month - suitable for staging
}

variable "api_droplet_image" {
  description = "API droplet image"
  type        = string
  default     = "ubuntu-22-04-x64"
}

variable "ssh_key_name" {
  description = "Name of SSH key in DigitalOcean"
  type        = string
}

variable "api_enable_backups" {
  description = "Enable automated backups for API droplets"
  type        = bool
  default     = true # Enable backups in staging
}

variable "api_enable_monitoring" {
  description = "Enable DigitalOcean monitoring agent"
  type        = bool
  default     = true
}

variable "api_enable_ipv6" {
  description = "Enable IPv6 for API droplets"
  type        = bool
  default     = false
}

variable "api_enable_volumes" {
  description = "Enable block storage volumes for API droplets"
  type        = bool
  default     = false
}

variable "api_volume_size" {
  description = "Size of block storage volumes in GB (if enabled)"
  type        = number
  default     = 50

  validation {
    condition     = var.api_volume_size >= 10 && var.api_volume_size <= 16384
    error_message = "Volume size must be between 10 and 16384 GB."
  }
}

variable "api_custom_user_data" {
  description = "Custom user data script to append to default setup"
  type        = string
  default     = ""
}

# ============================================================================
# Load Balancer Configuration
# ============================================================================

variable "ssl_certificate_name" {
  description = "Name of SSL certificate in DigitalOcean (use Let's Encrypt managed cert)"
  type        = string
  default     = "" # Leave empty to skip HTTPS initially, add after domain setup
}

variable "enable_https_redirect" {
  description = "Redirect HTTP to HTTPS"
  type        = bool
  default     = true
}

variable "enable_proxy_protocol" {
  description = "Enable PROXY protocol for preserving client IPs"
  type        = bool
  default     = false
}

# ============================================================================
# Monitoring and Alerting Configuration
# ============================================================================

variable "enable_monitoring_alerts" {
  description = "Enable DigitalOcean monitoring alerts"
  type        = bool
  default     = true
}

variable "alert_email_recipients" {
  description = "List of email addresses for alert notifications"
  type        = list(string)
  default     = []
}

variable "alert_slack_channel" {
  description = "Slack channel for alert notifications"
  type        = string
  default     = "#alerts-staging"
}

variable "alert_slack_webhook" {
  description = "Slack webhook URL for alert notifications"
  type        = string
  default     = ""
  sensitive   = true
}

# ============================================================================
# Droplet Configuration
# ============================================================================

variable "timezone" {
  description = "Timezone for all droplets"
  type        = string
  default     = "UTC"
}

variable "alert_email" {
  description = "Email address for security alerts (fail2ban, etc.)"
  type        = string
  default     = "devops@example.com"
}
