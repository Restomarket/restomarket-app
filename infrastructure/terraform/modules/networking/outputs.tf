# Networking Module Outputs

# VPC Outputs
output "vpc_id" {
  description = "The ID of the VPC"
  value       = digitalocean_vpc.main.id
}

output "vpc_urn" {
  description = "The URN of the VPC"
  value       = digitalocean_vpc.main.urn
}

output "vpc_name" {
  description = "The name of the VPC"
  value       = digitalocean_vpc.main.name
}

output "vpc_ip_range" {
  description = "The IP range of the VPC"
  value       = digitalocean_vpc.main.ip_range
}

output "vpc_region" {
  description = "The region of the VPC"
  value       = digitalocean_vpc.main.region
}

output "vpc_created_at" {
  description = "The date and time the VPC was created"
  value       = digitalocean_vpc.main.created_at
}

# Firewall Outputs
output "api_firewall_id" {
  description = "The ID of the API servers firewall (empty if disabled)"
  value       = var.enable_firewall ? digitalocean_firewall.api_servers[0].id : null
}

output "api_firewall_name" {
  description = "The name of the API servers firewall (empty if disabled)"
  value       = var.enable_firewall ? digitalocean_firewall.api_servers[0].name : null
}

output "api_firewall_status" {
  description = "The status of the API servers firewall (empty if disabled)"
  value       = var.enable_firewall ? digitalocean_firewall.api_servers[0].status : null
}

# ============================================================================
# Database Firewall Outputs (REMOVED - Migrated to Supabase)
# ============================================================================
# Database firewall outputs removed as database is now managed by Supabase
# ============================================================================

# Convenience Outputs
output "firewall_tags" {
  description = "Tags used for firewall assignment"
  value = {
    api_servers = var.firewall_droplet_tags
  }
}
