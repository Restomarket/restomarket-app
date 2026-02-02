# API Cluster Module - DigitalOcean Droplets for API Servers
# This module creates DigitalOcean Droplets for running the API application with Docker

# Data source for SSH keys
data "digitalocean_ssh_keys" "keys" {
  filter {
    key    = "name"
    values = var.ssh_key_names
  }
}

# Note: Enhanced user data is defined in cloud-init.tf

# API Droplets
resource "digitalocean_droplet" "api" {
  count = var.droplet_count

  name   = "${var.cluster_name}-api-${count.index + 1}"
  region = var.region
  size   = var.droplet_size
  image  = var.droplet_image

  # VPC networking
  vpc_uuid = var.vpc_id

  # SSH keys
  ssh_keys = data.digitalocean_ssh_keys.keys.ssh_keys[*].id

  # User data for initial setup (enhanced configuration)
  user_data = local.enhanced_user_data

  # Enable backups if configured
  backups = var.enable_backups

  # Enable monitoring
  monitoring = var.enable_monitoring

  # Enable IPv6
  ipv6 = var.enable_ipv6

  # Tags
  tags = concat(
    [
      var.environment,
      "api-server",
      var.cluster_name
    ],
    var.additional_tags
  )

  # Lifecycle
  lifecycle {
    create_before_destroy = true
    ignore_changes = [
      user_data, # Ignore changes to user_data after creation
    ]
  }
}

# Optional: Reserved IP for each droplet (if load balancer is not used)
resource "digitalocean_reserved_ip" "api" {
  count = var.enable_reserved_ips ? var.droplet_count : 0

  region     = var.region
  droplet_id = digitalocean_droplet.api[count.index].id
}

# Optional: Firewall rule for API droplets (if firewall_id is provided)
# Note: Main firewall rules are managed by the networking module
# This is for additional droplet-specific rules if needed
resource "digitalocean_firewall" "api_custom" {
  count = var.enable_custom_firewall ? 1 : 0

  name = "${var.cluster_name}-api-custom"
  tags = [var.cluster_name]

  # Custom inbound rules
  dynamic "inbound_rule" {
    for_each = var.custom_inbound_rules
    content {
      protocol         = inbound_rule.value.protocol
      port_range       = inbound_rule.value.port_range
      source_addresses = inbound_rule.value.source_addresses
    }
  }

  # Custom outbound rules
  dynamic "outbound_rule" {
    for_each = var.custom_outbound_rules
    content {
      protocol              = outbound_rule.value.protocol
      port_range            = outbound_rule.value.port_range
      destination_addresses = outbound_rule.value.destination_addresses
    }
  }
}

# Volume for each droplet (optional, for data persistence)
resource "digitalocean_volume" "api_data" {
  count = var.enable_volumes ? var.droplet_count : 0

  name                    = "${var.cluster_name}-api-data-${count.index + 1}"
  region                  = var.region
  size                    = var.volume_size
  initial_filesystem_type = "ext4"
  description             = "Data volume for ${var.cluster_name}-api-${count.index + 1}"

  tags = concat(
    [var.environment, "api-data"],
    var.additional_tags
  )
}

# Attach volumes to droplets
resource "digitalocean_volume_attachment" "api_data" {
  count = var.enable_volumes ? var.droplet_count : 0

  droplet_id = digitalocean_droplet.api[count.index].id
  volume_id  = digitalocean_volume.api_data[count.index].id
}
