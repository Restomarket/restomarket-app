# Input Variables for Database Module

# Project Configuration
variable "project_name" {
  description = "Name of the project (used for resource naming)"
  type        = string
  default     = "restomarket"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

# Database Configuration
variable "postgres_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "16"

  validation {
    condition     = can(regex("^(12|13|14|15|16)$", var.postgres_version))
    error_message = "PostgreSQL version must be 12, 13, 14, 15, or 16."
  }
}

variable "node_size" {
  description = "Database node size (slug). Examples: db-s-1vcpu-1gb, db-s-2vcpu-4gb, db-s-4vcpu-8gb"
  type        = string
  default     = "db-s-1vcpu-1gb"

  validation {
    condition     = can(regex("^db-s-", var.node_size))
    error_message = "Node size must be a valid DigitalOcean database size slug starting with 'db-s-'."
  }
}

variable "node_count" {
  description = "Number of database nodes (1 for dev, 2+ for HA in staging/production)"
  type        = number
  default     = 1

  validation {
    condition     = var.node_count >= 1 && var.node_count <= 3
    error_message = "Node count must be between 1 and 3."
  }
}

variable "region" {
  description = "DigitalOcean region for database cluster"
  type        = string
  default     = "nyc3"

  validation {
    condition     = can(regex("^[a-z]{3}[0-9]$", var.region))
    error_message = "Region must be a valid DigitalOcean region code (e.g., nyc3, sfo3, lon1)."
  }
}

# Network Configuration
variable "vpc_id" {
  description = "VPC UUID for private networking"
  type        = string

  validation {
    condition     = can(regex("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$", var.vpc_id))
    error_message = "VPC ID must be a valid UUID."
  }
}

variable "allowed_ip_ranges" {
  description = "List of IP ranges (CIDR) allowed to connect to the database"
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for cidr in var.allowed_ip_ranges : can(cidrhost(cidr, 0))
    ])
    error_message = "All IP ranges must be valid CIDR notation."
  }
}

variable "allowed_droplet_tags" {
  description = "List of droplet tags allowed to connect to the database"
  type        = list(string)
  default     = []
}

# Database and User Configuration
variable "database_name" {
  description = "Name of the application database to create"
  type        = string
  default     = "restomarket"

  validation {
    condition     = can(regex("^[a-z][a-z0-9_]*$", var.database_name))
    error_message = "Database name must start with a letter and contain only lowercase letters, numbers, and underscores."
  }
}

variable "database_user" {
  description = "Name of the application database user to create"
  type        = string
  default     = "restomarket_app"

  validation {
    condition     = can(regex("^[a-z][a-z0-9_]*$", var.database_user))
    error_message = "Database user must start with a letter and contain only lowercase letters, numbers, and underscores."
  }
}

# Maintenance Window
variable "maintenance_day" {
  description = "Day of week for maintenance window (monday, tuesday, etc.)"
  type        = string
  default     = "sunday"

  validation {
    condition = contains([
      "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
    ], var.maintenance_day)
    error_message = "Maintenance day must be a valid day of the week (lowercase)."
  }
}

variable "maintenance_hour" {
  description = "Hour of day for maintenance window (0-23, UTC)"
  type        = string
  default     = "03:00"

  validation {
    condition     = can(regex("^([0-1][0-9]|2[0-3]):[0-5][0-9]$", var.maintenance_hour))
    error_message = "Maintenance hour must be in HH:MM format (00:00 to 23:59)."
  }
}

# Connection Pool Configuration
variable "enable_connection_pool" {
  description = "Enable connection pooling (recommended for high-traffic apps)"
  type        = bool
  default     = false
}

variable "connection_pool_mode" {
  description = "Connection pool mode (transaction, session, statement)"
  type        = string
  default     = "transaction"

  validation {
    condition     = contains(["transaction", "session", "statement"], var.connection_pool_mode)
    error_message = "Connection pool mode must be transaction, session, or statement."
  }
}

variable "connection_pool_size" {
  description = "Connection pool size (number of connections)"
  type        = number
  default     = 20

  validation {
    condition     = var.connection_pool_size >= 1 && var.connection_pool_size <= 100
    error_message = "Connection pool size must be between 1 and 100."
  }
}

# Read Replica Configuration
variable "enable_read_replica" {
  description = "Enable read replica for read scaling"
  type        = bool
  default     = false
}

variable "replica_size" {
  description = "Database replica node size (defaults to same as primary if not specified)"
  type        = string
  default     = ""
}

variable "replica_region" {
  description = "Region for read replica (defaults to same as primary if not specified)"
  type        = string
  default     = ""
}

# Tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = list(string)
  default     = []
}
