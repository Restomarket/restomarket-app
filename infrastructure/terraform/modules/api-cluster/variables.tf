# API Cluster Module - Input Variables

variable "cluster_name" {
  description = "Name of the API cluster (used for resource naming)"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.cluster_name))
    error_message = "Cluster name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

variable "region" {
  description = "DigitalOcean region for droplets"
  type        = string
  default     = "nyc3"
}

variable "droplet_count" {
  description = "Number of API droplets to create"
  type        = number
  default     = 1

  validation {
    condition     = var.droplet_count >= 1 && var.droplet_count <= 10
    error_message = "Droplet count must be between 1 and 10."
  }
}

variable "droplet_size" {
  description = "Size of the droplets (e.g., s-1vcpu-1gb, s-2vcpu-2gb)"
  type        = string
  default     = "s-1vcpu-1gb"
}

variable "droplet_image" {
  description = "Droplet image (OS)"
  type        = string
  default     = "ubuntu-22-04-x64"
}

variable "vpc_id" {
  description = "VPC ID for private networking"
  type        = string

  validation {
    condition     = can(regex("^[a-f0-9-]+$", var.vpc_id))
    error_message = "VPC ID must be a valid UUID."
  }
}

variable "ssh_key_names" {
  description = "List of SSH key names to add to droplets"
  type        = list(string)
  default     = []

  validation {
    condition     = length(var.ssh_key_names) > 0
    error_message = "At least one SSH key name must be provided."
  }
}

variable "api_port" {
  description = "Port for the API application"
  type        = number
  default     = 3001

  validation {
    condition     = var.api_port >= 1024 && var.api_port <= 65535
    error_message = "API port must be between 1024 and 65535."
  }
}

variable "enable_backups" {
  description = "Enable automated backups for droplets"
  type        = bool
  default     = false
}

variable "enable_monitoring" {
  description = "Enable DigitalOcean monitoring agent"
  type        = bool
  default     = true
}

variable "enable_ipv6" {
  description = "Enable IPv6 for droplets"
  type        = bool
  default     = false
}

variable "enable_reserved_ips" {
  description = "Enable reserved IPs for each droplet (useful without load balancer)"
  type        = bool
  default     = false
}

variable "enable_volumes" {
  description = "Enable data volumes for droplets"
  type        = bool
  default     = false
}

variable "volume_size" {
  description = "Size of data volume in GB (if enabled)"
  type        = number
  default     = 10

  validation {
    condition     = var.volume_size >= 1 && var.volume_size <= 16384
    error_message = "Volume size must be between 1 and 16384 GB."
  }
}

variable "enable_custom_firewall" {
  description = "Enable custom firewall rules for API droplets"
  type        = bool
  default     = false
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

variable "custom_user_data" {
  description = "Additional custom user data script to append"
  type        = string
  default     = ""
}

variable "additional_tags" {
  description = "Additional tags to apply to resources"
  type        = list(string)
  default     = []
}
