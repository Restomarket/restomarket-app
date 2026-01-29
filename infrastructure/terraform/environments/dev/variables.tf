# Development Environment Variables

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
  default     = "dev"

  validation {
    condition     = contains(["dev", "development"], var.environment)
    error_message = "Environment must be 'dev' or 'development' for this configuration."
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
    Purpose   = "Development"
  }
}

# ============================================================================
# Networking Configuration
# ============================================================================

variable "vpc_ip_range" {
  description = "IP range for VPC in CIDR notation"
  type        = string
  default     = "10.10.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_ip_range, 0))
    error_message = "VPC IP range must be valid CIDR notation."
  }
}

variable "admin_ips" {
  description = "List of admin IP addresses allowed SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"] # Allow from anywhere in dev (change for production)
}

variable "api_port" {
  description = "Port for API service"
  type        = number
  default     = 3001

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
# Database Configuration
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
  default     = "db-s-1vcpu-1gb" # $15/month - minimal for dev
}

variable "db_node_count" {
  description = "Number of database nodes (1 for dev, 2+ for HA)"
  type        = number
  default     = 1

  validation {
    condition     = var.db_node_count >= 1 && var.db_node_count <= 3
    error_message = "Database node count must be between 1 and 3."
  }
}

variable "db_name" {
  description = "Name of the database to create"
  type        = string
  default     = "restomarket_dev"
}

variable "db_user" {
  description = "Name of the database user to create"
  type        = string
  default     = "restomarket_app"
}

variable "db_enable_pool" {
  description = "Enable connection pooling"
  type        = bool
  default     = false # Optional for dev to save costs
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
  default     = 10

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
    condition     = contains(["6", "7"], var.redis_version)
    error_message = "Redis version must be either 6 or 7."
  }
}

variable "redis_node_size" {
  description = "Redis node size (slug)"
  type        = string
  default     = "db-s-1vcpu-1gb" # $15/month - minimal for dev
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
# API Droplet Configuration
# ============================================================================

variable "api_droplet_count" {
  description = "Number of API droplets"
  type        = number
  default     = 1 # Single droplet for dev

  validation {
    condition     = var.api_droplet_count >= 1 && var.api_droplet_count <= 10
    error_message = "API droplet count must be between 1 and 10."
  }
}

variable "api_droplet_size" {
  description = "API droplet size (slug)"
  type        = string
  default     = "s-1vcpu-1gb" # $6/month - minimal for dev
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
  default     = false # No backups needed for dev
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

variable "api_custom_user_data" {
  description = "Custom user data script to append to default setup"
  type        = string
  default     = ""
}
