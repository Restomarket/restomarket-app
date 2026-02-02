# Terraform Module: Redis Cache

This module creates a DigitalOcean Managed Redis cluster for caching and session storage.

## Features

- DigitalOcean Managed Redis (single-node)
- Private networking via VPC
- Configurable Redis version (6, 7)
- Tag-based and IP-based firewall rules
- Configurable node size and region
- Automatic maintenance windows
- Eviction policy configuration

## Usage

### Basic Dev Environment

```hcl
module "redis" {
  source = "../../modules/redis"

  project_name = "restomarket"
  environment  = "dev"
  region       = "nyc3"

  redis_version = "7"
  node_size     = "db-s-1vcpu-1gb"

  vpc_id = module.networking.vpc_id

  allowed_vpc_cidrs     = [module.networking.vpc_ip_range]
  allowed_droplet_tags  = ["api-server-dev"]

  eviction_policy = "allkeys-lru"
}
```

### Staging Environment

```hcl
module "redis" {
  source = "../../modules/redis"

  project_name = "restomarket"
  environment  = "staging"
  region       = "nyc3"

  redis_version = "7"
  node_size     = "db-s-1vcpu-2gb"

  vpc_id = module.networking.vpc_id

  allowed_vpc_cidrs     = [module.networking.vpc_ip_range]
  allowed_droplet_tags  = ["api-server-staging"]

  maintenance_window_day  = "sunday"
  maintenance_window_hour = 3

  eviction_policy = "allkeys-lru"

  additional_tags = ["cost-center:engineering"]
}
```

### Production Environment

```hcl
module "redis" {
  source = "../../modules/redis"

  project_name = "restomarket"
  environment  = "production"
  region       = "nyc1"

  redis_version = "7"
  node_size     = "db-s-2vcpu-4gb"

  vpc_id = module.networking.vpc_id

  allowed_vpc_cidrs     = [module.networking.vpc_ip_range]
  allowed_droplet_tags  = ["api-server-production"]

  maintenance_window_day  = "sunday"
  maintenance_window_hour = 4

  eviction_policy = "allkeys-lru"

  additional_tags = [
    "cost-center:engineering",
    "backup:required"
  ]
}
```

## Inputs

| Name                    | Description                                 | Type         | Default          | Required |
| ----------------------- | ------------------------------------------- | ------------ | ---------------- | -------- |
| project_name            | Name of the project                         | string       | "restomarket"    | no       |
| environment             | Environment name (dev, staging, production) | string       | -                | yes      |
| region                  | DigitalOcean region                         | string       | "nyc3"           | no       |
| redis_version           | Redis version (6, 7)                        | string       | "7"              | no       |
| node_size               | Size of the Redis node                      | string       | "db-s-1vcpu-1gb" | no       |
| vpc_id                  | VPC UUID for private networking             | string       | -                | yes      |
| enable_firewall         | Enable firewall rules                       | bool         | true             | no       |
| allowed_vpc_cidrs       | VPC CIDR blocks allowed to access Redis     | list(string) | []               | no       |
| allowed_droplet_tags    | Droplet tags allowed to access Redis        | list(string) | []               | no       |
| maintenance_window_day  | Day for maintenance window                  | string       | "sunday"         | no       |
| maintenance_window_hour | Hour for maintenance window (UTC)           | number       | 3                | no       |
| additional_tags         | Additional tags for the cluster             | list(string) | []               | no       |
| eviction_policy         | Redis eviction policy                       | string       | "allkeys-lru"    | no       |

## Outputs

| Name                      | Description               | Sensitive |
| ------------------------- | ------------------------- | --------- |
| cluster_id                | Redis cluster ID          | no        |
| cluster_urn               | Redis cluster URN         | no        |
| cluster_name              | Redis cluster name        | no        |
| engine                    | Database engine (redis)   | no        |
| version                   | Redis version             | no        |
| region                    | Deployment region         | no        |
| host                      | Public host               | yes       |
| private_host              | Private host (VPC)        | yes       |
| port                      | Redis port                | no        |
| password                  | Redis password            | yes       |
| user                      | Redis default user        | yes       |
| connection_string_private | Private connection string | yes       |
| connection_string_public  | Public connection string  | yes       |
| redis_uri_private         | Private Redis URI         | yes       |
| redis_uri_public          | Public Redis URI          | yes       |
| firewall_id               | Firewall ID               | no        |
| tags                      | Applied tags              | no        |
| created_at                | Creation timestamp        | no        |
| summary                   | Configuration summary     | yes       |

## Node Size Recommendations

| Environment   | Node Size      | RAM  | vCPUs | Monthly Cost\* |
| ------------- | -------------- | ---- | ----- | -------------- |
| Dev           | db-s-1vcpu-1gb | 1 GB | 1     | $15            |
| Staging       | db-s-1vcpu-2gb | 2 GB | 1     | $30            |
| Production    | db-s-2vcpu-4gb | 4 GB | 2     | $60            |
| Production HA | db-s-4vcpu-8gb | 8 GB | 4     | $120           |

\*Prices are approximate as of 2025 and may vary by region.

## Redis Eviction Policies

| Policy          | Description                              | Use Case                                |
| --------------- | ---------------------------------------- | --------------------------------------- |
| noeviction      | Returns errors when memory limit reached | When all data must be retained          |
| allkeys-lru     | Evicts least recently used keys          | General purpose caching                 |
| allkeys-lfu     | Evicts least frequently used keys        | When access patterns are predictable    |
| volatile-lru    | Evicts LRU keys with TTL set             | When mixing cached and permanent data   |
| volatile-lfu    | Evicts LFU keys with TTL set             | Mixed data with access pattern tracking |
| allkeys-random  | Evicts random keys                       | When all keys are equally important     |
| volatile-random | Evicts random keys with TTL              | Testing or low-importance TTL data      |
| volatile-ttl    | Evicts keys with shortest TTL            | When TTL indicates priority             |

**Recommended:** `allkeys-lru` for most caching scenarios.

## Security Best Practices

### Network Security

1. **Use Private Networking:**
   - Always use `connection_string_private` or `redis_uri_private` in production
   - Restrict public access using firewall rules
   - Access only from VPC CIDR or tagged droplets

2. **Firewall Configuration:**

   ```hcl
   allowed_vpc_cidrs     = ["10.0.0.0/16"]  # VPC CIDR only
   allowed_droplet_tags  = ["api-server"]    # Tag-based access
   ```

3. **Authentication:**
   - Redis password is automatically generated by DigitalOcean
   - Store password in environment variables or secrets manager
   - Rotate password regularly (every 90 days)

### Application Configuration

**Node.js/NestJS Example:**

```typescript
import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URI_PRIVATE, // Use private URI
  socket: {
    tls: true, // Enable TLS for encrypted connections
    rejectUnauthorized: true,
  },
});
```

**Environment Variables:**

```bash
REDIS_URI_PRIVATE=redis://default:password@private-host:25061/0
REDIS_HOST=private-redis-host.db.ondigitalocean.com
REDIS_PORT=25061
REDIS_PASSWORD=generated-password
```

## Firewall Configuration

The module supports two types of firewall rules:

### 1. VPC CIDR-based Rules

Allow access from entire VPC or specific subnets:

```hcl
allowed_vpc_cidrs = [
  "10.0.0.0/16",      # Entire VPC
  "10.0.1.0/24"       # Specific subnet
]
```

### 2. Tag-based Rules

Allow access from droplets with specific tags:

```hcl
allowed_droplet_tags = [
  "api-server-staging",
  "worker-staging",
  "admin-tools"
]
```

**Best Practice:** Use tag-based rules for granular control per service.

## Maintenance Windows

Configure maintenance windows to minimize disruption:

```hcl
maintenance_window_day  = "sunday"   # Day of week
maintenance_window_hour = 3          # Hour in UTC (3 AM UTC)
```

**Recommendations:**

- Schedule during low-traffic hours
- Consider timezone differences
- Plan for 1-2 hour maintenance window

## High Availability

**Note:** DigitalOcean Managed Redis is single-node only. For high availability:

1. **Use Redis Sentinel** (self-managed on droplets)
2. **Use Redis Cluster** (self-managed)
3. **Implement application-level failover** with multiple Redis instances

For production workloads requiring HA, consider self-managed Redis on droplets.

## Cost Optimization

1. **Right-size nodes:**
   - Start small and scale up based on metrics
   - Monitor memory usage and eviction rates

2. **Use appropriate eviction policy:**
   - `allkeys-lru` for caches that can be regenerated
   - `volatile-lru` if some data should never be evicted

3. **Monitor connection count:**
   - Reuse connections in application code
   - Use connection pooling

4. **Consider data TTLs:**
   - Set appropriate TTLs to prevent memory bloat
   - Use `volatile-ttl` eviction policy for TTL-based caching

## Monitoring and Alerts

Key metrics to monitor:

- **Memory Usage:** Should stay below 80%
- **Evicted Keys:** High eviction rate indicates undersized node
- **Connection Count:** Monitor for connection leaks
- **Hit Rate:** Low hit rate may indicate inefficient caching
- **Latency:** Should be < 1ms for VPC connections

**DigitalOcean Monitoring:**

```hcl
# Add monitoring alerts (separate resource)
resource "digitalocean_monitor_alert" "redis_memory" {
  alerts {
    email = ["ops@example.com"]
  }
  window      = "5m"
  type        = "v1/insights/droplet/memory_utilization_percent"
  compare     = "GreaterThan"
  value       = 85
  enabled     = true
  entities    = [digitalocean_database_cluster.redis.id]
  description = "Redis memory usage above 85%"
}
```

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to Redis from application

**Solutions:**

1. Verify VPC configuration: `terraform output -module=redis summary`
2. Check firewall rules allow your droplet's tag or IP
3. Ensure using private host for VPC connections
4. Verify password in environment variables

### High Memory Usage

**Problem:** Redis memory usage consistently high

**Solutions:**

1. Check eviction policy: `volatile-lru` may not evict enough keys
2. Increase node size if eviction rate is high
3. Review TTLs on cached data
4. Audit key usage patterns

### Performance Issues

**Problem:** High latency or slow operations

**Solutions:**

1. Use private networking (lower latency than public)
2. Ensure connections are being reused (not creating new connections per request)
3. Check for large values being stored (consider splitting)
4. Monitor CPU usage and scale up if needed

### Eviction Errors

**Problem:** Application receiving out-of-memory errors

**Solutions:**

1. Change eviction policy from `noeviction` to `allkeys-lru`
2. Increase node size to provide more memory
3. Reduce TTLs to free memory faster
4. Audit application for memory leaks

## Examples

### Using Output Values in Application Configuration

```hcl
# In your Terraform environment config
resource "digitalocean_droplet" "api" {
  # ... other configuration ...

  user_data = templatefile("${path.module}/init.sh", {
    redis_host     = module.redis.private_host
    redis_port     = module.redis.port
    redis_password = module.redis.password
  })
}
```

### Connection String Export

```bash
# Export connection string for use in deployment scripts
export REDIS_URI=$(terraform output -raw -module=redis redis_uri_private)
```

## Migration from Self-Managed Redis

If migrating from self-managed Redis:

1. **Data Migration:**

   ```bash
   # Use redis-cli with --rdb option
   redis-cli --rdb /path/to/dump.rdb

   # Or use BGSAVE and copy RDB file
   redis-cli BGSAVE
   ```

2. **Update Application Configuration:**
   - Replace Redis host/port with managed instance
   - Update connection string format
   - Test connectivity from all application servers

3. **Gradual Cutover:**
   - Run both instances in parallel
   - Monitor application behavior
   - Switch traffic gradually

## Requirements

- Terraform >= 1.0
- DigitalOcean provider >= 2.0
- Valid DigitalOcean API token
- Existing VPC (created by networking module)

## Dependencies

This module depends on:

- Networking module (for VPC)
- Droplets (for tag-based firewall rules)

## Notes

- Redis clusters in DigitalOcean are single-node (no built-in HA)
- For HA requirements, consider self-managed Redis Sentinel or Cluster
- Connection pooling is recommended at the application level
- Use private networking for all production workloads
- Regularly backup data if using Redis for persistence
