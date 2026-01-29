# Networking Module

This Terraform module creates and manages DigitalOcean VPC and firewall resources for the RestoMarket application.

## Features

- **VPC Creation**: Creates a private VPC with configurable IP range
- **API Server Firewall**: Configurable firewall rules for API droplets
- **Database Firewall**: Isolated firewall for database servers
- **SSH Access Control**: Restrict SSH access to admin IPs only
- **Load Balancer Integration**: Allow traffic from load balancers
- **VPC Internal Traffic**: Allow all traffic within the VPC
- **Custom Rules**: Support for custom inbound/outbound rules

## Usage

### Basic Example

```hcl
module "networking" {
  source = "../../modules/networking"

  vpc_name    = "restomarket-staging-vpc"
  region      = "nyc3"
  ip_range    = "10.10.0.0/16"
  environment = "staging"

  # Firewall configuration
  enable_firewall        = true
  firewall_droplet_tags  = ["api-server", "staging"]

  # Admin SSH access
  admin_ssh_ips = [
    "203.0.113.0/24"  # Office IP range
  ]

  # Load balancer integration
  api_port                         = 3001
  allow_http_from_load_balancers   = true
  allow_https_from_load_balancers  = true
  load_balancer_uids               = []  # Will be populated after LB creation

  # Database firewall
  enable_database_firewall = true
  database_firewall_tags   = ["database", "staging"]
}
```

### Development Environment Example

```hcl
module "networking" {
  source = "../../modules/networking"

  vpc_name    = "restomarket-dev-vpc"
  region      = "nyc3"
  ip_range    = "10.20.0.0/16"
  environment = "dev"

  # Minimal firewall for dev
  enable_firewall        = true
  firewall_droplet_tags  = ["api-server", "dev"]

  # Open SSH for all developers
  admin_ssh_ips = [
    "0.0.0.0/0"  # WARNING: Only for dev! Use specific IPs in staging/prod
  ]

  api_port = 3001
}
```

### With Custom Rules

```hcl
module "networking" {
  source = "../../modules/networking"

  vpc_name    = "restomarket-prod-vpc"
  region      = "nyc3"
  ip_range    = "10.30.0.0/16"
  environment = "production"

  firewall_droplet_tags = ["api-server", "production"]
  admin_ssh_ips         = ["203.0.113.10/32"]  # Single bastion host

  # Custom inbound rules
  custom_inbound_rules = [
    {
      protocol         = "tcp"
      port_range       = "9090"  # Prometheus metrics
      source_addresses = ["10.30.0.0/16"]  # Internal only
    }
  ]
}
```

## Requirements

| Name         | Version |
| ------------ | ------- |
| terraform    | >= 1.0  |
| digitalocean | ~> 2.0  |

## Providers

| Name         | Version |
| ------------ | ------- |
| digitalocean | ~> 2.0  |

## Inputs

### Required

| Name        | Description                            | Type     |
| ----------- | -------------------------------------- | -------- |
| vpc_name    | Name of the VPC                        | `string` |
| region      | DigitalOcean region                    | `string` |
| ip_range    | VPC IP range in CIDR notation          | `string` |
| environment | Environment (dev, staging, production) | `string` |

### Optional

| Name                            | Description                      | Type           | Default                             |
| ------------------------------- | -------------------------------- | -------------- | ----------------------------------- |
| vpc_description                 | VPC description                  | `string`       | `"VPC for RestoMarket application"` |
| enable_firewall                 | Enable API server firewall       | `bool`         | `true`                              |
| firewall_droplet_tags           | Tags for API firewall assignment | `list(string)` | `[]`                                |
| admin_ssh_ips                   | IPs allowed SSH access           | `list(string)` | `[]`                                |
| allow_http_from_load_balancers  | Allow HTTP from LBs              | `bool`         | `true`                              |
| allow_https_from_load_balancers | Allow HTTPS from LBs             | `bool`         | `true`                              |
| load_balancer_uids              | Load balancer UIDs               | `list(string)` | `[]`                                |
| api_port                        | Custom API port                  | `number`       | `null`                              |
| custom_inbound_rules            | Additional inbound rules         | `list(object)` | `[]`                                |
| custom_outbound_rules           | Additional outbound rules        | `list(object)` | `[]`                                |
| enable_database_firewall        | Enable database firewall         | `bool`         | `true`                              |
| database_firewall_tags          | Tags for database firewall       | `list(string)` | `[]`                                |

## Outputs

| Name                     | Description              |
| ------------------------ | ------------------------ |
| vpc_id                   | VPC ID                   |
| vpc_urn                  | VPC URN                  |
| vpc_name                 | VPC name                 |
| vpc_ip_range             | VPC IP range             |
| vpc_region               | VPC region               |
| vpc_created_at           | VPC creation timestamp   |
| api_firewall_id          | API firewall ID          |
| api_firewall_name        | API firewall name        |
| api_firewall_status      | API firewall status      |
| database_firewall_id     | Database firewall ID     |
| database_firewall_name   | Database firewall name   |
| database_firewall_status | Database firewall status |
| firewall_tags            | Firewall tags mapping    |

## Firewall Rules

### API Server Firewall

**Inbound:**

- SSH (22): From admin IPs only
- HTTP (80): From load balancers
- HTTPS (443): From load balancers
- Custom API port (e.g., 3001): From load balancers
- All traffic: From VPC CIDR range

**Outbound:**

- All traffic: To anywhere (allows updates, external APIs, etc.)

### Database Firewall

**Inbound:**

- PostgreSQL (5432): From VPC CIDR range only

**Outbound:**

- All traffic: To VPC CIDR range only

## Security Best Practices

1. **SSH Access**: Always restrict `admin_ssh_ips` to specific IP ranges in staging/production
2. **VPC Isolation**: Use private networking for all internal services
3. **Least Privilege**: Database firewall only allows access from VPC
4. **Load Balancer Integration**: Use `load_balancer_uids` instead of opening ports to 0.0.0.0/0
5. **Tag-Based Assignment**: Use consistent tagging strategy across environments

## IP Range Recommendations

- **Dev**: `10.20.0.0/16` (65,536 IPs)
- **Staging**: `10.10.0.0/16` (65,536 IPs)
- **Production**: `10.30.0.0/16` (65,536 IPs)

Avoid overlapping ranges to enable VPC peering if needed in the future.

## Troubleshooting

### Firewall Not Applying

- Ensure droplets have the correct tags matching `firewall_droplet_tags`
- Check `terraform plan` output for firewall resource changes
- Verify firewall status: `terraform state show module.networking.digitalocean_firewall.api_servers[0]`

### Cannot SSH to Droplet

- Verify your IP is in `admin_ssh_ips`
- Check firewall inbound rules in DigitalOcean console
- Ensure droplet is tagged correctly

### Load Balancer Cannot Reach API

- Add load balancer UID to `load_balancer_uids` after creating LB
- Ensure `api_port` matches your application port
- Run `terraform apply` after adding LB UID

## Examples

See the `environments/dev` and `environments/staging` directories for complete usage examples.

## References

- [DigitalOcean VPC Documentation](https://docs.digitalocean.com/products/networking/vpc/)
- [DigitalOcean Firewall Documentation](https://docs.digitalocean.com/products/networking/firewalls/)
- [Terraform DigitalOcean Provider](https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs)
