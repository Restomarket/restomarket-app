# API Cluster Module - Output Values

# Droplet outputs
output "droplet_ids" {
  description = "IDs of the created droplets"
  value       = digitalocean_droplet.api[*].id
}

output "droplet_names" {
  description = "Names of the created droplets"
  value       = digitalocean_droplet.api[*].name
}

output "droplet_urns" {
  description = "URNs of the created droplets"
  value       = digitalocean_droplet.api[*].urn
}

# IP addresses
output "public_ipv4_addresses" {
  description = "Public IPv4 addresses of the droplets"
  value       = digitalocean_droplet.api[*].ipv4_address
}

output "private_ipv4_addresses" {
  description = "Private IPv4 addresses of the droplets (VPC)"
  value       = digitalocean_droplet.api[*].ipv4_address_private
}

output "public_ipv6_addresses" {
  description = "Public IPv6 addresses of the droplets (if enabled)"
  value       = digitalocean_droplet.api[*].ipv6_address
}

# Reserved IPs (if enabled)
output "reserved_ip_addresses" {
  description = "Reserved IP addresses (if enabled)"
  value       = var.enable_reserved_ips ? digitalocean_reserved_ip.api[*].ip_address : []
}

output "reserved_ip_urns" {
  description = "Reserved IP URNs (if enabled)"
  value       = var.enable_reserved_ips ? digitalocean_reserved_ip.api[*].urn : []
}

# Volume outputs (if enabled)
output "volume_ids" {
  description = "IDs of the data volumes (if enabled)"
  value       = var.enable_volumes ? digitalocean_volume.api_data[*].id : []
}

output "volume_names" {
  description = "Names of the data volumes (if enabled)"
  value       = var.enable_volumes ? digitalocean_volume.api_data[*].name : []
}

# Firewall outputs (if enabled)
output "custom_firewall_id" {
  description = "ID of the custom firewall (if enabled)"
  value       = var.enable_custom_firewall ? digitalocean_firewall.api_custom[0].id : null
}

output "custom_firewall_name" {
  description = "Name of the custom firewall (if enabled)"
  value       = var.enable_custom_firewall ? digitalocean_firewall.api_custom[0].name : null
}

# Cluster metadata
output "cluster_name" {
  description = "Name of the API cluster"
  value       = var.cluster_name
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "region" {
  description = "Region where droplets are deployed"
  value       = var.region
}

output "droplet_count" {
  description = "Number of droplets in the cluster"
  value       = var.droplet_count
}

output "vpc_id" {
  description = "VPC ID used by the droplets"
  value       = var.vpc_id
}

# Summary output for easy reference
output "summary" {
  description = "Summary of the API cluster configuration"
  value = {
    cluster_name  = var.cluster_name
    environment   = var.environment
    region        = var.region
    droplet_count = var.droplet_count
    droplet_size  = var.droplet_size
    public_ips    = digitalocean_droplet.api[*].ipv4_address
    private_ips   = digitalocean_droplet.api[*].ipv4_address_private
    backups       = var.enable_backups
    monitoring    = var.enable_monitoring
    volumes       = var.enable_volumes
  }
}
