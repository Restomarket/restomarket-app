# Networking Module Variables

# Core VPC Configuration
variable "vpc_name" {
  description = "Name of the VPC"
  type        = string
}

variable "region" {
  description = "DigitalOcean region for the VPC"
  type        = string
}

variable "ip_range" {
  description = "IP range for the VPC in CIDR notation (e.g., 10.10.0.0/16)"
  type        = string
  validation {
    condition     = can(cidrhost(var.ip_range, 0))
    error_message = "The ip_range must be a valid CIDR block (e.g., 10.10.0.0/16)."
  }
}

variable "vpc_description" {
  description = "Description of the VPC"
  type        = string
  default     = "VPC for RestoMarket application"
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, production)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

# Firewall Configuration
variable "enable_firewall" {
  description = "Enable firewall for API servers"
  type        = bool
  default     = true
}

variable "firewall_droplet_tags" {
  description = "List of tags to apply firewall rules to (e.g., ['api-server', 'staging'])"
  type        = list(string)
  default     = []
}

variable "admin_ssh_ips" {
  description = "List of IP addresses allowed to SSH (CIDR notation, e.g., ['203.0.113.0/24'])"
  type        = list(string)
  default     = []
}

variable "allow_http_from_load_balancers" {
  description = "Allow HTTP traffic from load balancers"
  type        = bool
  default     = true
}

variable "allow_https_from_load_balancers" {
  description = "Allow HTTPS traffic from load balancers"
  type        = bool
  default     = true
}

variable "load_balancer_uids" {
  description = "List of load balancer UIDs to allow traffic from"
  type        = list(string)
  default     = []
}

variable "api_port" {
  description = "Custom API port to allow from load balancers (e.g., 3001)"
  type        = number
  default     = null
}

variable "custom_inbound_rules" {
  description = "Additional custom inbound firewall rules"
  type = list(object({
    protocol           = string
    port_range         = string
    source_addresses   = optional(list(string))
    source_droplet_ids = optional(list(string))
    source_tags        = optional(list(string))
  }))
  default = []
}

variable "custom_outbound_rules" {
  description = "Additional custom outbound firewall rules"
  type = list(object({
    protocol                = string
    port_range              = string
    destination_addresses   = optional(list(string))
    destination_droplet_ids = optional(list(string))
    destination_tags        = optional(list(string))
  }))
  default = []
}

# ============================================================================
# Database Firewall Configuration (REMOVED - Migrated to Supabase)
# ============================================================================
# Database firewall variables removed as database is now managed by Supabase
# Supabase provides built-in security features:
# - Connection pooling with authentication
# - SSL/TLS encryption by default
# - IP allowlisting via Supabase dashboard
# - Row Level Security (RLS) policies
# ============================================================================
