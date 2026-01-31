# Terraform Module: DigitalOcean Managed PostgreSQL Database

This module creates a DigitalOcean Managed PostgreSQL database cluster with support for high availability, connection pooling, read replicas, and VPC private networking.

## Features

- **Managed PostgreSQL cluster** with configurable version, size, and node count
- **Private networking** via VPC integration
- **High availability** with multi-node clusters (1-3 nodes)
- **Connection pooling** (optional) for high-traffic applications
- **Read replicas** (optional) for read scaling
- **Firewall rules** for IP and tag-based access control
- **Automated backups** and maintenance windows
- **SSL/TLS encryption** for connections
- **Comprehensive outputs** including connection strings and credentials

## Usage

### Basic Configuration (Development)

```hcl
module "database" {
  source = "../../modules/database"

  project_name = "restomarket"
  environment  = "dev"

  # Database configuration
  postgres_version = "16"
  node_size        = "db-s-1vcpu-1gb"
  node_count       = 1
  region           = "nyc3"

  # Network configuration
  vpc_id               = module.networking.vpc_id
  allowed_droplet_tags = ["api-server-dev"]

  # Database and user
  database_name = "restomarket"
  database_user = "restomarket_app"
}
```

### Production Configuration with HA

```hcl
module "database" {
  source = "../../modules/database"

  project_name = "restomarket"
  environment  = "production"

  # High availability configuration
  postgres_version = "16"
  node_size        = "db-s-4vcpu-8gb"
  node_count       = 3  # HA cluster
  region           = "nyc3"

  # Network configuration
  vpc_id               = module.networking.vpc_id
  allowed_droplet_tags = ["api-server-production"]

  # Database and user
  database_name = "restomarket"
  database_user = "restomarket_app"

  # Connection pooling (recommended for production)
  enable_connection_pool = true
  connection_pool_mode   = "transaction"
  connection_pool_size   = 50

  # Maintenance window (Sunday 3 AM UTC)
  maintenance_day  = "sunday"
  maintenance_hour = "03:00"

  additional_tags = ["critical", "production"]
}
```

### With Read Replica

```hcl
module "database" {
  source = "../../modules/database"

  project_name = "restomarket"
  environment  = "production"

  postgres_version = "16"
  node_size        = "db-s-4vcpu-8gb"
  node_count       = 2
  region           = "nyc3"

  vpc_id               = module.networking.vpc_id
  allowed_droplet_tags = ["api-server-production"]

  database_name = "restomarket"
  database_user = "restomarket_app"

  # Enable read replica for read scaling
  enable_read_replica = true
  replica_size        = "db-s-2vcpu-4gb"  # Can be smaller than primary
  replica_region      = "sfo3"            # Different region for geo-distribution
}
```

## Input Variables

| Name                     | Description                                            | Type           | Default             | Required |
| ------------------------ | ------------------------------------------------------ | -------------- | ------------------- | -------- |
| `project_name`           | Name of the project (used for resource naming)         | `string`       | `"restomarket"`     | No       |
| `environment`            | Environment name (dev, staging, production)            | `string`       | n/a                 | Yes      |
| `postgres_version`       | PostgreSQL version (12, 13, 14, 15, 16)                | `string`       | `"16"`              | No       |
| `node_size`              | Database node size slug                                | `string`       | `"db-s-1vcpu-1gb"`  | No       |
| `node_count`             | Number of database nodes (1-3)                         | `number`       | `1`                 | No       |
| `region`                 | DigitalOcean region                                    | `string`       | `"nyc3"`            | No       |
| `vpc_id`                 | VPC UUID for private networking                        | `string`       | n/a                 | Yes      |
| `allowed_ip_ranges`      | List of IP ranges (CIDR) allowed to connect            | `list(string)` | `[]`                | No       |
| `allowed_droplet_tags`   | List of droplet tags allowed to connect                | `list(string)` | `[]`                | No       |
| `database_name`          | Name of the application database                       | `string`       | `"restomarket"`     | No       |
| `database_user`          | Name of the application user                           | `string`       | `"restomarket_app"` | No       |
| `maintenance_day`        | Day of week for maintenance                            | `string`       | `"sunday"`          | No       |
| `maintenance_hour`       | Hour of day for maintenance (HH:MM UTC)                | `string`       | `"03:00"`           | No       |
| `enable_connection_pool` | Enable connection pooling                              | `bool`         | `false`             | No       |
| `connection_pool_mode`   | Connection pool mode (transaction, session, statement) | `string`       | `"transaction"`     | No       |
| `connection_pool_size`   | Connection pool size (1-100)                           | `number`       | `20`                | No       |
| `enable_read_replica`    | Enable read replica                                    | `bool`         | `false`             | No       |
| `replica_size`           | Replica node size (defaults to primary size)           | `string`       | `""`                | No       |
| `replica_region`         | Replica region (defaults to primary region)            | `string`       | `""`                | No       |
| `additional_tags`        | Additional tags to apply                               | `list(string)` | `[]`                | No       |

## Outputs

### Primary Outputs

| Name                       | Description                         | Sensitive |
| -------------------------- | ----------------------------------- | --------- |
| `cluster_id`               | Database cluster ID                 | No        |
| `cluster_name`             | Database cluster name               | No        |
| `cluster_host`             | Database hostname (private network) | Yes       |
| `cluster_port`             | Database port                       | No        |
| `cluster_status`           | Database cluster status             | No        |
| `database_name`            | Application database name           | No        |
| `database_user`            | Application database user           | No        |
| `database_password`        | Application database password       | Yes       |
| `connection_string`        | Connection string (private network) | Yes       |
| `connection_string_public` | Connection string (public network)  | Yes       |

### Connection Pool Outputs (if enabled)

| Name                   | Description              | Sensitive |
| ---------------------- | ------------------------ | --------- |
| `connection_pool_id`   | Connection pool ID       | No        |
| `connection_pool_host` | Connection pool hostname | Yes       |
| `connection_pool_uri`  | Connection pool URI      | Yes       |

### Read Replica Outputs (if enabled)

| Name           | Description           | Sensitive |
| -------------- | --------------------- | --------- |
| `replica_id`   | Read replica ID       | No        |
| `replica_host` | Read replica hostname | Yes       |
| `replica_uri`  | Read replica URI      | Yes       |

### Summary Output

The `summary` output provides a quick overview:

```hcl
output "summary" {
  value = {
    name            = "restomarket-dev-postgres"
    engine          = "pg 16"
    size            = "db-s-1vcpu-1gb"
    node_count      = 1
    region          = "nyc3"
    status          = "online"
    database        = "restomarket"
    user            = "restomarket_app"
    pool_enabled    = false
    replica_enabled = false
  }
}
```

## Node Size Recommendations

### Development

- **Single node**: `db-s-1vcpu-1gb` ($15/month)
- Use for local testing, CI/CD

### Staging

- **2 nodes**: `db-s-1vcpu-2gb` ($30/month each)
- Use for pre-production testing

### Production

- **3 nodes (HA)**: `db-s-4vcpu-8gb` ($240/month each)
- Use for production workloads
- Consider connection pooling

## Connection Pool Modes

- **transaction**: (Recommended) Pool connections per transaction. Balances efficiency and compatibility.
- **session**: Pool connections per session. More compatible but less efficient.
- **statement**: Pool connections per statement. Most efficient but least compatible.

## Firewall Configuration

The module supports two types of firewall rules:

1. **Tag-based** (Recommended): Allow access from droplets with specific tags

   ```hcl
   allowed_droplet_tags = ["api-server-production"]
   ```

2. **IP-based**: Allow access from specific IP ranges
   ```hcl
   allowed_ip_ranges = ["10.0.0.0/16"]
   ```

**Best Practice**: Use tag-based rules for dynamic infrastructure. Use IP-based for static admin access.

## Security Best Practices

1. **Always use private networking** - Never expose database to public internet
2. **Use tag-based firewall rules** - Easier to manage than IP-based rules
3. **Enable SSL/TLS** - Module enforces `sslmode=require` in connection strings
4. **Rotate credentials** - Use Terraform to rotate database passwords every 90 days
5. **Backup verification** - DigitalOcean provides automatic backups, test restoration regularly
6. **Monitoring** - Use DigitalOcean monitoring or integrate with external APM

## Maintenance Windows

- **Default**: Sunday at 3:00 AM UTC
- **Duration**: ~1 hour
- **Impact**: Brief connection interruptions for updates
- **Recommendation**: Schedule during low-traffic periods

## Connection String Usage

### Using Private Connection String (Recommended)

```bash
# For API server running in same VPC
export DATABASE_URL=$(terraform output -raw connection_string)
```

### Using Connection Pool

```bash
# For high-traffic applications
export DATABASE_URL=$(terraform output -raw connection_pool_uri)
```

### Using Read Replica

```bash
# For read-only operations
export DATABASE_READ_URL=$(terraform output -raw replica_uri)
```

## Cost Estimation

| Configuration                    | Monthly Cost |
| -------------------------------- | ------------ |
| Dev (1 node, 1GB)                | ~$15         |
| Staging (2 nodes, 2GB each)      | ~$60         |
| Production (3 nodes, 8GB each)   | ~$720        |
| Production + Replica (3+1 nodes) | ~$960        |

_Prices are approximate and subject to change._

## Troubleshooting

### Database not accessible from droplet

1. Verify droplet has correct tag: `doctl compute droplet get <droplet-id> --format Tags`
2. Check firewall rules: `terraform state show module.database.digitalocean_database_firewall.postgres_firewall`
3. Verify droplet is in same VPC: Compare VPC IDs

### Connection timeout

1. Check cluster status: `terraform output cluster_status`
2. Verify using private network connection (not public)
3. Check droplet security group allows outbound to 5432

### Password not working

1. Use terraform output: `terraform output -raw database_password`
2. Verify user exists: `terraform state show module.database.digitalocean_database_user.app_user`

### High CPU/Memory usage

1. Check query performance with `pg_stat_statements`
2. Consider enabling connection pooling
3. Scale up node size or add read replica

## Examples

See the `environments/` directory for complete examples:

- `environments/dev/` - Single node development setup
- `environments/staging/` - 2-node staging setup with connection pool

## Requirements

| Name         | Version |
| ------------ | ------- |
| terraform    | >= 1.0  |
| digitalocean | ~> 2.0  |

## Resources Created

- `digitalocean_database_cluster.postgres` - PostgreSQL cluster
- `digitalocean_database_db.app_database` - Application database
- `digitalocean_database_user.app_user` - Application user
- `digitalocean_database_firewall.postgres_firewall` - Firewall rules
- `digitalocean_database_connection_pool.app_pool` - Connection pool (optional)
- `digitalocean_database_replica.read_replica` - Read replica (optional)

## Authors

Created by the RestoMarket DevOps team.

## License

This module is part of the RestoMarket infrastructure.
