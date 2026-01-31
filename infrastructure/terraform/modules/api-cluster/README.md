# API Cluster Terraform Module

This module creates and manages DigitalOcean Droplets for running the API application with Docker and Docker Compose.

## Features

- Creates configurable number of API server droplets
- Automated Docker and Docker Compose installation via user-data
- VPC networking for secure private communication
- SSH key configuration for secure access
- Optional features:
  - Automated backups
  - DigitalOcean monitoring agent
  - Reserved IPs (for environments without load balancer)
  - Data volumes for persistence
  - Custom firewall rules
  - IPv6 support
- Automated security hardening (UFW firewall)
- Deploy user creation for application deployment
- Comprehensive tagging for resource organization

## Usage Examples

### Basic Development Cluster (Single Droplet)

```hcl
module "api_dev" {
  source = "../../modules/api-cluster"

  cluster_name   = "restomarket-dev"
  environment    = "dev"
  region         = "nyc3"
  droplet_count  = 1
  droplet_size   = "s-1vcpu-1gb"
  vpc_id         = module.networking.vpc_id
  ssh_key_names  = ["dev-key"]

  api_port          = 3001
  enable_backups    = false
  enable_monitoring = true
  enable_ipv6       = false
}
```

### Staging Cluster (2 Droplets with Load Balancer)

```hcl
module "api_staging" {
  source = "../../modules/api-cluster"

  cluster_name   = "restomarket-staging"
  environment    = "staging"
  region         = "nyc3"
  droplet_count  = 2
  droplet_size   = "s-2vcpu-2gb"
  vpc_id         = module.networking.vpc_id
  ssh_key_names  = ["staging-key"]

  api_port           = 3001
  enable_backups     = true
  enable_monitoring  = true
  enable_volumes     = true
  volume_size        = 20

  additional_tags = ["staging", "api-cluster"]
}
```

### Production Cluster (High Availability)

```hcl
module "api_production" {
  source = "../../modules/api-cluster"

  cluster_name   = "restomarket-prod"
  environment    = "production"
  region         = "nyc3"
  droplet_count  = 3
  droplet_size   = "s-4vcpu-8gb"
  vpc_id         = module.networking.vpc_id
  ssh_key_names  = ["prod-key-1", "prod-key-2"]

  api_port           = 3001
  enable_backups     = true
  enable_monitoring  = true
  enable_volumes     = true
  volume_size        = 50

  # Custom user data for production monitoring
  custom_user_data = <<-EOT
    # Install additional monitoring tools
    curl -sSL https://example.com/monitoring-agent.sh | bash
  EOT

  additional_tags = ["production", "api-cluster", "critical"]
}
```

### Cluster with Custom Firewall Rules

```hcl
module "api_custom" {
  source = "../../modules/api-cluster"

  cluster_name   = "restomarket-custom"
  environment    = "staging"
  region         = "nyc3"
  droplet_count  = 2
  droplet_size   = "s-2vcpu-2gb"
  vpc_id         = module.networking.vpc_id
  ssh_key_names  = ["custom-key"]

  enable_custom_firewall = true
  custom_inbound_rules = [
    {
      protocol         = "tcp"
      port_range       = "9090"
      source_addresses = ["10.0.0.0/8"]
    }
  ]
}
```

## Requirements

| Name         | Version |
| ------------ | ------- |
| terraform    | >= 1.0  |
| digitalocean | ~> 2.0  |

## Inputs

| Name                   | Description                                        | Type           | Default              | Required |
| ---------------------- | -------------------------------------------------- | -------------- | -------------------- | -------- |
| cluster_name           | Name of the API cluster (used for resource naming) | `string`       | n/a                  | yes      |
| environment            | Environment name (dev, staging, production)        | `string`       | n/a                  | yes      |
| vpc_id                 | VPC ID for private networking                      | `string`       | n/a                  | yes      |
| ssh_key_names          | List of SSH key names to add to droplets           | `list(string)` | n/a                  | yes      |
| region                 | DigitalOcean region for droplets                   | `string`       | `"nyc3"`             | no       |
| droplet_count          | Number of API droplets to create (1-10)            | `number`       | `1`                  | no       |
| droplet_size           | Size of the droplets                               | `string`       | `"s-1vcpu-1gb"`      | no       |
| droplet_image          | Droplet image (OS)                                 | `string`       | `"ubuntu-22-04-x64"` | no       |
| api_port               | Port for the API application                       | `number`       | `3001`               | no       |
| enable_backups         | Enable automated backups for droplets              | `bool`         | `false`              | no       |
| enable_monitoring      | Enable DigitalOcean monitoring agent               | `bool`         | `true`               | no       |
| enable_ipv6            | Enable IPv6 for droplets                           | `bool`         | `false`              | no       |
| enable_reserved_ips    | Enable reserved IPs for each droplet               | `bool`         | `false`              | no       |
| enable_volumes         | Enable data volumes for droplets                   | `bool`         | `false`              | no       |
| volume_size            | Size of data volume in GB (if enabled)             | `number`       | `10`                 | no       |
| enable_custom_firewall | Enable custom firewall rules                       | `bool`         | `false`              | no       |
| custom_inbound_rules   | Custom inbound firewall rules                      | `list(object)` | `[]`                 | no       |
| custom_outbound_rules  | Custom outbound firewall rules                     | `list(object)` | `[]`                 | no       |
| custom_user_data       | Additional custom user data script                 | `string`       | `""`                 | no       |
| additional_tags        | Additional tags to apply to resources              | `list(string)` | `[]`                 | no       |

## Outputs

| Name                   | Description                                  |
| ---------------------- | -------------------------------------------- |
| droplet_ids            | IDs of the created droplets                  |
| droplet_names          | Names of the created droplets                |
| droplet_urns           | URNs of the created droplets                 |
| public_ipv4_addresses  | Public IPv4 addresses of the droplets        |
| private_ipv4_addresses | Private IPv4 addresses of the droplets (VPC) |
| public_ipv6_addresses  | Public IPv6 addresses (if enabled)           |
| reserved_ip_addresses  | Reserved IP addresses (if enabled)           |
| reserved_ip_urns       | Reserved IP URNs (if enabled)                |
| volume_ids             | IDs of data volumes (if enabled)             |
| volume_names           | Names of data volumes (if enabled)           |
| custom_firewall_id     | ID of custom firewall (if enabled)           |
| custom_firewall_name   | Name of custom firewall (if enabled)         |
| cluster_name           | Name of the API cluster                      |
| environment            | Environment name                             |
| region                 | Region where droplets are deployed           |
| droplet_count          | Number of droplets in the cluster            |
| vpc_id                 | VPC ID used by the droplets                  |
| summary                | Summary of the API cluster configuration     |

## Droplet Size Recommendations

| Environment     | Droplet Size | vCPUs | Memory | Use Case                |
| --------------- | ------------ | ----- | ------ | ----------------------- |
| Dev             | s-1vcpu-1gb  | 1     | 1 GB   | Development, testing    |
| Staging         | s-2vcpu-2gb  | 2     | 2 GB   | Pre-production testing  |
| Staging (HA)    | s-2vcpu-4gb  | 2     | 4 GB   | High-traffic staging    |
| Production      | s-4vcpu-8gb  | 4     | 8 GB   | Production workloads    |
| Production (HA) | s-8vcpu-16gb | 8     | 16 GB  | High-traffic production |

## User Data Script

The module automatically installs:

1. **Docker CE** - Latest stable version
2. **Docker Compose** - Latest version
3. **Deploy User** - Non-root user for application deployment
4. **UFW Firewall** - Configured for SSH, HTTP, HTTPS, and API port
5. **Monitoring Agent** - DigitalOcean monitoring (if enabled)

### Installed Packages

- `apt-transport-https`
- `ca-certificates`
- `curl`
- `gnupg`
- `lsb-release`
- `software-properties-common`

### Created Resources

- `/home/deploy` - Deploy user home directory
- `/opt/app` - Application directory
- `/var/log/user-data.log` - Setup completion log

## SSH Access

SSH keys are automatically added from DigitalOcean. To access droplets:

```bash
# SSH as root (for initial setup)
ssh root@<droplet_ip>

# SSH as deploy user (for application deployment)
ssh deploy@<droplet_ip>
```

## Volume Management

If volumes are enabled:

```bash
# Check volume mount
df -h

# Volume is automatically mounted at /mnt/<volume_name>
ls -la /mnt/
```

## Reserved IPs

Reserved IPs are useful when:

- Running without a load balancer
- Need static IPs for DNS
- Direct droplet access required

For production with load balancer, reserved IPs are not needed.

## Security Best Practices

1. **Use VPC Networking**: Always deploy droplets in a VPC for private communication
2. **SSH Key Authentication**: Never use password authentication
3. **Restrict SSH Access**: Use the networking module's firewall to restrict SSH to admin IPs only
4. **Enable Monitoring**: Track droplet health and performance
5. **Enable Backups**: For production, enable automated backups
6. **Regular Updates**: User data installs latest packages, but keep droplets updated
7. **Deploy User**: Use the non-root deploy user for application deployment

## Firewall Configuration

The module configures UFW with these rules:

- **SSH (22/tcp)**: Open for initial access
- **HTTP (80/tcp)**: For HTTP traffic
- **HTTPS (443/tcp)**: For HTTPS traffic
- **API Port (3001/tcp)**: Configurable API application port

**Note**: The main firewall rules are managed by the networking module. UFW is an additional layer of security on each droplet.

## Monitoring and Alerting

If monitoring is enabled, the DigitalOcean monitoring agent provides:

- CPU usage metrics
- Memory usage metrics
- Disk usage metrics
- Network traffic metrics
- Process monitoring

Access monitoring in the DigitalOcean dashboard under Monitoring.

## Troubleshooting

### Droplet Not Accessible via SSH

```bash
# Check droplet status
doctl compute droplet list

# Check firewall rules
doctl compute firewall list

# Verify SSH key is added
doctl compute ssh-key list
```

### Docker Not Installed

```bash
# Check user data logs
ssh root@<droplet_ip>
cat /var/log/user-data.log
tail -f /var/log/cloud-init-output.log
```

### Volume Not Mounted

```bash
# Check volume status
doctl compute volume list

# Manual mount
mkdir -p /mnt/<volume_name>
mount -o discard,defaults /dev/disk/by-id/scsi-0DO_Volume_<volume_name> /mnt/<volume_name>
```

### High Memory Usage

```bash
# Check running containers
docker ps
docker stats

# Check system memory
free -h
top
```

## Cost Estimation

| Configuration                 | Monthly Cost (USD) |
| ----------------------------- | ------------------ |
| 1 x s-1vcpu-1gb               | $6                 |
| 2 x s-2vcpu-2gb               | $24                |
| 3 x s-4vcpu-8gb               | $144               |
| Backups (20% of droplet cost) | Additional 20%     |
| Volumes (10GB)                | $1/volume          |

**Example Staging Cost**: 2 droplets ($24) + backups ($4.80) + 2 volumes ($2) = **$30.80/month**

## Resource Tagging

All resources are tagged with:

- Environment (`dev`, `staging`, `production`)
- Service type (`api-server`)
- Cluster name
- Custom tags (if provided)

Tags are useful for:

- Cost allocation
- Resource filtering
- Automation and orchestration
- Compliance and governance

## Integration with Other Modules

This module is designed to work with:

- **Networking Module**: Provides VPC and firewall rules
- **Database Module**: API connects to database via private network
- **Redis Module**: API connects to Redis via private network
- **Load Balancer**: Distributes traffic across droplets (created separately)

## Maintenance Windows

DigitalOcean may perform maintenance on droplets. To minimize impact:

1. Use multiple droplets (droplet_count >= 2)
2. Enable backups
3. Enable monitoring for alerts
4. Use a load balancer for traffic distribution

## Scaling

To scale the cluster:

1. **Vertical Scaling**: Change `droplet_size` and apply
2. **Horizontal Scaling**: Increase `droplet_count` and apply

**Note**: Terraform will create new droplets. Ensure your load balancer is configured to automatically detect new droplets via tags.

## Backup and Recovery

If backups are enabled:

```bash
# List available backups
doctl compute droplet-action list <droplet_id>

# Restore from backup
doctl compute droplet-action restore <droplet_id> <backup_image_id>
```

## Contributing

When modifying this module:

1. Run `terraform fmt` to format code
2. Run `terraform validate` to check syntax
3. Update this README with any new variables or outputs
4. Test in dev environment before production
