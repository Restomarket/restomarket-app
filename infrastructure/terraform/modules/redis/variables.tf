variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "restomarket"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production"
  }
}

variable "region" {
  description = "DigitalOcean region for the Redis cluster"
  type        = string
  default     = "nyc3"
}

variable "redis_version" {
  description = "Redis version"
  type        = string
  default     = "7"

  validation {
    condition     = contains(["6", "7"], var.redis_version)
    error_message = "Redis version must be 6 or 7"
  }
}

variable "node_size" {
  description = "Size of the Redis node (e.g., db-s-1vcpu-1gb, db-s-1vcpu-2gb, db-s-2vcpu-4gb)"
  type        = string
  default     = "db-s-1vcpu-1gb"

  validation {
    condition     = can(regex("^db-s-", var.node_size))
    error_message = "Node size must be a valid DigitalOcean database slug starting with 'db-s-'"
  }
}

variable "vpc_id" {
  description = "VPC UUID for private networking"
  type        = string

  validation {
    condition     = can(regex("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$", var.vpc_id))
    error_message = "VPC ID must be a valid UUID"
  }
}

variable "enable_firewall" {
  description = "Enable firewall rules for the Redis cluster"
  type        = bool
  default     = true
}

variable "allowed_vpc_cidrs" {
  description = "List of VPC CIDR blocks allowed to access Redis"
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for cidr in var.allowed_vpc_cidrs : can(cidrhost(cidr, 0))
    ])
    error_message = "All elements must be valid CIDR blocks"
  }
}

variable "allowed_droplet_tags" {
  description = "List of droplet tags allowed to access Redis"
  type        = list(string)
  default     = []
}

variable "maintenance_window_day" {
  description = "Day of week for maintenance window (monday-sunday)"
  type        = string
  default     = "sunday"

  validation {
    condition = contains(
      ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
      var.maintenance_window_day
    )
    error_message = "Maintenance window day must be a valid day of the week"
  }
}

variable "maintenance_window_hour" {
  description = "Hour for maintenance window (0-23, UTC)"
  type        = number
  default     = 3

  validation {
    condition     = var.maintenance_window_hour >= 0 && var.maintenance_window_hour <= 23
    error_message = "Maintenance window hour must be between 0 and 23"
  }
}

variable "additional_tags" {
  description = "Additional tags to apply to the Redis cluster"
  type        = list(string)
  default     = []
}

variable "eviction_policy" {
  description = "Redis eviction policy (noeviction, allkeys-lru, allkeys-lfu, volatile-lru, volatile-lfu, allkeys-random, volatile-random, volatile-ttl)"
  type        = string
  default     = "allkeys-lru"

  validation {
    condition = contains(
      ["noeviction", "allkeys-lru", "allkeys-lfu", "volatile-lru", "volatile-lfu", "allkeys-random", "volatile-random", "volatile-ttl"],
      var.eviction_policy
    )
    error_message = "Eviction policy must be a valid Redis eviction policy"
  }
}
