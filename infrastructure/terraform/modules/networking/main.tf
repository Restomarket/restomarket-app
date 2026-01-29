# DigitalOcean VPC and Networking Module
# This module creates a VPC, firewall rules, and manages network security

terraform {
  required_version = ">= 1.0"
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

# VPC Resource
resource "digitalocean_vpc" "main" {
  name        = var.vpc_name
  region      = var.region
  ip_range    = var.ip_range
  description = var.vpc_description

  # Tags for resource organization
  # Note: DigitalOcean VPCs don't support tags directly, but we document this for future use
}

# Firewall for API Servers
resource "digitalocean_firewall" "api_servers" {
  count = var.enable_firewall ? 1 : 0

  name = "${var.environment}-api-firewall"

  # Tag-based assignment - apply to all droplets with this tag
  tags = var.firewall_droplet_tags

  # Inbound Rules

  # Allow SSH from admin IPs only
  dynamic "inbound_rule" {
    for_each = length(var.admin_ssh_ips) > 0 ? [1] : []
    content {
      protocol         = "tcp"
      port_range       = "22"
      source_addresses = var.admin_ssh_ips
    }
  }

  # Allow HTTP from load balancers
  dynamic "inbound_rule" {
    for_each = var.allow_http_from_load_balancers ? [1] : []
    content {
      protocol                  = "tcp"
      port_range                = "80"
      source_load_balancer_uids = var.load_balancer_uids
    }
  }

  # Allow HTTPS from load balancers
  dynamic "inbound_rule" {
    for_each = var.allow_https_from_load_balancers ? [1] : []
    content {
      protocol                  = "tcp"
      port_range                = "443"
      source_load_balancer_uids = var.load_balancer_uids
    }
  }

  # Allow custom API port from load balancers (e.g., 3001)
  dynamic "inbound_rule" {
    for_each = var.api_port != null ? [1] : []
    content {
      protocol                  = "tcp"
      port_range                = tostring(var.api_port)
      source_load_balancer_uids = var.load_balancer_uids
    }
  }

  # Allow all traffic from within VPC
  inbound_rule {
    protocol         = "tcp"
    port_range       = "1-65535"
    source_addresses = [var.ip_range]
  }

  inbound_rule {
    protocol         = "udp"
    port_range       = "1-65535"
    source_addresses = [var.ip_range]
  }

  inbound_rule {
    protocol         = "icmp"
    source_addresses = [var.ip_range]
  }

  # Additional custom inbound rules
  dynamic "inbound_rule" {
    for_each = var.custom_inbound_rules
    content {
      protocol           = inbound_rule.value.protocol
      port_range         = inbound_rule.value.port_range
      source_addresses   = lookup(inbound_rule.value, "source_addresses", null)
      source_droplet_ids = lookup(inbound_rule.value, "source_droplet_ids", null)
      source_tags        = lookup(inbound_rule.value, "source_tags", null)
    }
  }

  # Outbound Rules

  # Allow all outbound traffic (default secure egress)
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

  # Additional custom outbound rules
  dynamic "outbound_rule" {
    for_each = var.custom_outbound_rules
    content {
      protocol                = outbound_rule.value.protocol
      port_range              = outbound_rule.value.port_range
      destination_addresses   = lookup(outbound_rule.value, "destination_addresses", null)
      destination_droplet_ids = lookup(outbound_rule.value, "destination_droplet_ids", null)
      destination_tags        = lookup(outbound_rule.value, "destination_tags", null)
    }
  }
}

# Firewall for Database Servers
resource "digitalocean_firewall" "database_servers" {
  count = var.enable_database_firewall ? 1 : 0

  name = "${var.environment}-database-firewall"

  # Tag-based assignment
  tags = var.database_firewall_tags

  # Inbound Rules

  # PostgreSQL access from API servers only (within VPC)
  inbound_rule {
    protocol         = "tcp"
    port_range       = "5432"
    source_addresses = [var.ip_range]
  }

  # Outbound Rules

  # Allow responses back to VPC
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = [var.ip_range]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = [var.ip_range]
  }
}
