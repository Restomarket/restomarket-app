# Staging Environment - Terraform Configuration

Production-like staging environment with high availability, load balancing, and monitoring.

## Overview

This Terraform configuration creates a staging environment that mirrors production architecture:

- **2 API droplets** behind a load balancer for redundancy
- **PostgreSQL cluster** with 2 nodes (HA configuration)
- **Redis cache** for session/caching
- **Load balancer** with SSL termination and health checks
- **VPC networking** for private communication
- **Monitoring alerts** for CPU, memory, disk, and load

**Estimated Monthly Cost:** ~$245 (excluding bandwidth)

## Prerequisites

1. **Terraform** >= 1.0

   ```bash
   # macOS
   brew install terraform

   # Verify installation
   terraform version
   ```

2. **DigitalOcean CLI** (doctl)

   ```bash
   # macOS
   brew install doctl

   # Authenticate
   doctl auth init
   ```

3. **DigitalOcean Account** with:
   - API token with read/write permissions
   - SSH key uploaded to DigitalOcean

4. **Domain Name** (for SSL certificate)
   - Recommended: staging-api.yourdomain.com

## Quick Start

### 1. Initial Setup

```bash
# Navigate to staging directory
cd infrastructure/terraform/environments/staging

# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
vim terraform.tfvars
```

**Required variables in `terraform.tfvars`:**

```hcl
do_token     = "dop_v1_..."  # Your DigitalOcean API token
ssh_key_name = "your-key"    # Your SSH key name

# IMPORTANT: Restrict admin IPs in staging
admin_ips = [
  "1.2.3.4/32",  # Your office IP
]

# Optional: Configure alerts
alert_email_recipients = ["ops@yourcompany.com"]
alert_slack_webhook    = "https://hooks.slack.com/services/..."
```

### 2. Initialize Terraform

```bash
# Initialize providers and modules
terraform init

# Validate configuration
terraform validate

# Format code
terraform fmt -recursive
```

### 3. Plan Infrastructure

```bash
# See what will be created
terraform plan

# Save plan to file for review
terraform plan -out=staging.tfplan

# Review the plan
terraform show staging.tfplan
```

### 4. Deploy Infrastructure

```bash
# Apply the configuration (will prompt for confirmation)
terraform apply

# Or apply saved plan without confirmation
terraform apply staging.tfplan
```

**Deployment time:** 10-15 minutes

### 5. Verify Deployment

```bash
# Get load balancer IP
terraform output load_balancer_ip

# Test health check
LB_IP=$(terraform output -raw load_balancer_ip)
curl http://$LB_IP/health

# Get SSH commands
terraform output ssh_commands

# View complete summary
terraform output environment_summary
```

## Post-Deployment Configuration

### 1. Configure DNS

Add an A record for your staging domain:

```
Type: A
Name: staging-api
Value: <load_balancer_ip>
TTL: 300
```

Verify DNS propagation:

```bash
dig staging-api.yourdomain.com
```

### 2. Configure SSL Certificate

**Option A: Let's Encrypt (Recommended)**

1. Go to DigitalOcean Console → Networking → Certificates
2. Click "Add Certificate" → "Let's Encrypt"
3. Enter your domain: `staging-api.yourdomain.com`
4. Wait for certificate to be issued (~1-2 minutes)

**Option B: Custom Certificate**

1. Upload your certificate via doctl or console
2. Note the certificate name/ID

### 3. Update Terraform with SSL

```hcl
# In terraform.tfvars
ssl_certificate_name = "staging-api-yourdomain-com"
```

```bash
# Re-apply configuration
terraform apply
```

### 4. Test HTTPS

```bash
# Test HTTPS endpoint
curl https://staging-api.yourdomain.com/health

# Verify SSL certificate
openssl s_client -connect staging-api.yourdomain.com:443 -servername staging-api.yourdomain.com
```

### 5. Configure Application Environment Variables

SSH into one of the droplets and configure your application:

```bash
# SSH to first droplet
ssh root@<droplet-ip>

# Create .env file
cd /opt/app
cat > .env <<EOF
NODE_ENV=staging
DATABASE_URL=$(terraform output -raw database_uri)
REDIS_URL=$(terraform output -raw redis_uri)
PORT=3001
EOF

# Deploy your application (see deployment section)
```

## Deployment Procedures

### Deploy API Application

```bash
# SSH to droplet
ssh root@<droplet-ip>

# Pull Docker image
docker pull ghcr.io/your-org/restomarket-api:sha-abc1234

# Update docker-compose.yml with new image tag
cd /opt/app
vim docker-compose.yml  # Update image tag

# Deploy with zero downtime
docker-compose up -d

# Verify health
curl http://localhost:3001/health
```

### Zero-Downtime Deployment (All Droplets)

Use the deployment script (to be created in Task 22):

```bash
# From your local machine
./infrastructure/scripts/deploy.sh staging sha-abc1234
```

## Infrastructure Maintenance

### Update Terraform Configuration

```bash
# Make changes to variables or configuration
vim terraform.tfvars

# Plan changes
terraform plan

# Apply changes
terraform apply
```

### Scale API Droplets

```hcl
# In terraform.tfvars
api_droplet_count = 3  # Increase from 2 to 3
```

```bash
terraform apply
```

New droplets will be automatically added to the load balancer.

### Upgrade Database/Redis

```hcl
# In terraform.tfvars
db_node_size = "db-s-4vcpu-8gb"  # Upgrade size
```

```bash
terraform apply
```

**Note:** Database upgrades may cause brief downtime (1-2 minutes).

### View Infrastructure State

```bash
# List all resources
terraform state list

# Show specific resource
terraform state show digitalocean_loadbalancer.api

# Get output values
terraform output
terraform output -json

# Get sensitive values
terraform output -raw database_password
terraform output -raw redis_password
```

## Monitoring and Alerts

### View Alerts

```bash
# Via doctl
doctl monitoring alert list --format ID,Type,Description,Value

# In DigitalOcean Console
# Navigate to: Monitoring → Alerts
```

### Alert Types Configured

1. **CPU Usage** > 80% for 5 minutes
2. **Memory Usage** > 85% for 5 minutes
3. **Disk Usage** > 90% for 5 minutes
4. **Load Average** > 3 for 5 minutes

### Configure Slack Notifications

```hcl
# In terraform.tfvars
alert_slack_webhook = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
alert_slack_channel = "#alerts-staging"
```

```bash
terraform apply
```

### View Droplet Metrics

```bash
# Via doctl
doctl monitoring droplet bandwidth <droplet-id>
doctl monitoring droplet cpu <droplet-id>
doctl monitoring droplet memory <droplet-id>

# Via web console
# https://cloud.digitalocean.com/monitoring/droplets
```

## Backup and Recovery

### Database Backups

DigitalOcean automatically backs up managed databases daily.

```bash
# List backups via doctl
doctl databases backup list <database-id>

# Restore from backup (via web console)
# Databases → Select cluster → Backups → Restore
```

### Droplet Backups

Automated backups are enabled for API droplets (if `api_enable_backups = true`).

```bash
# List droplet snapshots
doctl compute droplet-action snapshot <droplet-id> --snapshot-name "manual-backup-$(date +%Y%m%d)"

# Restore from snapshot (via web console)
# Create new droplet from snapshot
# Update terraform.tfvars with new droplet ID
```

### Disaster Recovery

1. **Database failure:** Switch to standby node (automatic with HA)
2. **API droplet failure:** Load balancer automatically routes to healthy droplet
3. **Complete region failure:** Restore in different region from backups

## Security Best Practices

### 1. Restrict SSH Access

```hcl
# In terraform.tfvars
admin_ips = [
  "1.2.3.4/32",  # Office IP only
]
```

**Never use `0.0.0.0/0` in staging/production!**

### 2. Rotate Credentials

```bash
# Database password (via console)
# Databases → Select cluster → Settings → Reset Password

# Update application environment variables
ssh root@<droplet-ip>
vim /opt/app/.env  # Update DATABASE_URL

# Restart application
docker-compose restart
```

### 3. Enable HTTPS Only

```hcl
enable_https_redirect = true  # Redirect HTTP to HTTPS
```

### 4. Review Firewall Rules

```bash
# List firewall rules
doctl compute firewall list
doctl compute firewall get <firewall-id>
```

### 5. Enable Monitoring

```hcl
api_enable_monitoring    = true
enable_monitoring_alerts = true
```

## Troubleshooting

### Issue: Terraform Init Fails

```bash
# Error: Failed to query available provider packages

# Solution: Update DigitalOcean provider
terraform init -upgrade
```

### Issue: SSH Key Not Found

```bash
# Error: ssh_key not found

# Solution: List available keys
doctl compute ssh-key list

# Update terraform.tfvars with correct name
ssh_key_name = "your-actual-key-name"
```

### Issue: Load Balancer Health Checks Failing

```bash
# Check droplet health endpoints
for ip in $(terraform output -json api_public_ips | jq -r '.[]'); do
  echo "Checking $ip..."
  curl http://$ip:3001/health
done

# Check load balancer status
doctl compute load-balancer get $(terraform output -raw load_balancer_id)

# View load balancer logs (via web console)
# Load Balancers → Select LB → Logs
```

### Issue: Database Connection Refused

```bash
# Check database status
doctl databases get $(terraform output -raw database_id)

# Verify firewall rules allow API droplets
doctl databases firewalls list $(terraform output -raw database_id)

# Test connection from droplet
ssh root@<droplet-ip>
pg_isready -h <db-host> -p <db-port>
```

### Issue: High Resource Usage

```bash
# Check droplet metrics
doctl compute droplet get $(terraform output -json api_droplet_ids | jq -r '.[0]')

# SSH to droplet and check processes
ssh root@<droplet-ip>
top
docker stats

# Scale up if needed (in terraform.tfvars)
api_droplet_size = "s-4vcpu-8gb"
terraform apply
```

### Issue: SSL Certificate Not Working

```bash
# Verify certificate is issued
doctl compute certificate list

# Check certificate name matches
terraform output -raw load_balancer_id
doctl compute load-balancer get <lb-id> --format ID,Name,Algorithm,ForwardingRules

# Verify DNS points to load balancer
dig staging-api.yourdomain.com

# Test SSL handshake
openssl s_client -connect staging-api.yourdomain.com:443
```

### Issue: Terraform State Lock

```bash
# Error: Error acquiring the state lock

# Solution: Force unlock (use with caution!)
terraform force-unlock <lock-id>

# Better: Wait for other operations to complete or check for stale locks
```

## Cost Optimization

### 1. Rightsize Resources

Monitor usage and adjust sizes:

```hcl
# If underutilized, downsize
api_droplet_size = "s-1vcpu-2gb"  # From s-2vcpu-4gb
db_node_size     = "db-s-1vcpu-2gb"  # From db-s-2vcpu-4gb
```

### 2. Disable Backups (if not needed)

```hcl
api_enable_backups = false  # Saves ~20% of droplet cost
```

### 3. Use Connection Pooling

Reduces database connections and allows smaller database size:

```hcl
db_enable_pool = true
db_pool_size   = 25
```

### 4. Schedule Downtime

For staging that's not used 24/7:

```bash
# Destroy resources during nights/weekends
terraform destroy -target=module.api_cluster

# Recreate when needed
terraform apply
```

### 5. Monitor Costs

```bash
# View current usage and billing
doctl balance get
doctl invoice list
```

## Remote State Backend

### Configure DigitalOcean Spaces Backend

```bash
# Create Spaces bucket
doctl spaces create restomarket-terraform-state --region nyc3

# Generate access keys
doctl spaces keys create terraform-state-access

# Configure backend (uncomment in main.tf)
```

```hcl
# In main.tf
backend "s3" {
  endpoint                    = "nyc3.digitaloceanspaces.com"
  key                         = "terraform/staging/terraform.tfstate"
  bucket                      = "restomarket-terraform-state"
  region                      = "us-east-1"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_region_validation      = true
}
```

```bash
# Re-initialize with backend
terraform init -migrate-state
```

## Differences from Production

Staging is production-like but with some differences:

| Feature         | Staging         | Production (recommended)    |
| --------------- | --------------- | --------------------------- |
| API Droplets    | 2 × s-2vcpu-4gb | 3-5 × s-4vcpu-8gb           |
| Database        | 2 nodes (HA)    | 3 nodes (HA + read replica) |
| Database Size   | db-s-2vcpu-4gb  | db-s-4vcpu-8gb or larger    |
| Redis           | db-s-2vcpu-4gb  | db-s-4vcpu-8gb              |
| Backups         | Weekly          | Daily + point-in-time       |
| Monitoring      | Basic alerts    | Advanced + APM              |
| SSL Certificate | Let's Encrypt   | Commercial or Let's Encrypt |
| Cost            | ~$245/month     | ~$800-1500/month            |

## Next Steps

1. ✅ Deploy infrastructure
2. ✅ Configure DNS and SSL
3. ⬜ Deploy application
4. ⬜ Test zero-downtime deployment
5. ⬜ Test rollback procedure
6. ⬜ Configure monitoring alerts
7. ⬜ Document runbook procedures
8. ⬜ Load test staging environment

## Related Documentation

- [Development Environment](../dev/README.md)
- [Terraform Modules](../../modules/)
- [Deployment Runbook](../../../docs/deployment-runbook.md)
- [Secrets Management](../../../docs/SECRETS_MANAGEMENT.md)

## Support

For issues or questions:

1. Check this README and troubleshooting section
2. Review DigitalOcean documentation
3. Check Terraform documentation
4. Contact DevOps team
