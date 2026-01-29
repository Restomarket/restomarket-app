# Development Environment - Terraform Configuration

This directory contains Terraform configuration for the **development** environment of RestoMarket infrastructure on DigitalOcean.

## Overview

The development environment is designed for **cost optimization** and **minimal resource usage** while maintaining the same architecture as staging/production.

### Infrastructure Components

- **VPC**: Private network (10.10.0.0/16) for secure communication
- **PostgreSQL 16**: Single-node managed database ($15/month)
- **Redis 7**: Single-node managed cache ($15/month)
- **API Droplet**: Single Ubuntu 22.04 droplet ($6/month)
- **Firewalls**: Network security for all components
- **Monitoring**: DigitalOcean monitoring agent enabled

**Estimated Monthly Cost**: ~$36/month (excluding bandwidth)

## Prerequisites

### 1. Tools Required

- **Terraform**: >= 1.0 ([Install](https://www.terraform.io/downloads))
- **DigitalOcean CLI** (optional): `doctl` ([Install](https://docs.digitalocean.com/reference/doctl/how-to/install/))
- **SSH Key**: Must be added to DigitalOcean account

### 2. DigitalOcean Setup

1. **Create API Token**:
   - Go to: https://cloud.digitalocean.com/account/api/tokens
   - Click "Generate New Token"
   - Name: "Terraform Dev Environment"
   - Scopes: Read and Write
   - Save the token securely

2. **Add SSH Key** (if not already added):

   ```bash
   # Using doctl
   doctl compute ssh-key import dev-key --public-key-file ~/.ssh/id_rsa.pub

   # Or manually via DigitalOcean console
   # Settings > Security > SSH Keys > Add SSH Key
   ```

3. **Get SSH Key Name**:
   ```bash
   doctl compute ssh-key list
   # Note the "Name" column value
   ```

### 3. Environment Variables

Export your DigitalOcean token (optional, can be set in terraform.tfvars):

```bash
export DIGITALOCEAN_TOKEN="dop_v1_xxxx"
```

## Setup Instructions

### Step 1: Configure Variables

1. Copy the example variables file:

   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

2. Edit `terraform.tfvars` and provide required values:

   ```hcl
   do_token     = "dop_v1_your_actual_token_here"
   ssh_key_name = "your-ssh-key-name"
   ```

3. **(Optional)** Override default values for customization:

   ```hcl
   # Example: Use different region
   region = "sfo3"

   # Example: Use larger droplet
   api_droplet_size = "s-2vcpu-2gb"
   ```

### Step 2: Initialize Terraform

```bash
# Initialize Terraform and download providers
terraform init

# Optional: Verify configuration
terraform validate
```

### Step 3: Review Plan

```bash
# See what will be created (dry run)
terraform plan

# Save plan to file for review
terraform plan -out=tfplan
```

**Review the output carefully!** Ensure:

- Resource counts match expectations (1 droplet, 1 DB, 1 Redis)
- Region is correct
- Costs are acceptable

### Step 4: Apply Configuration

```bash
# Apply the configuration
terraform apply

# Or apply saved plan
terraform apply tfplan
```

This will create:

- 1 VPC
- 2 Firewalls (API + Database)
- 1 PostgreSQL cluster (single node)
- 1 Redis cluster (single node)
- 1 API droplet

**Duration**: 5-10 minutes

## Post-Deployment

### View Outputs

```bash
# View all outputs
terraform output

# View specific output
terraform output api_public_ips

# View sensitive outputs
terraform output database_password
terraform output redis_password

# Get connection strings
terraform output database_uri
terraform output redis_uri

# View summary
terraform output environment_summary

# Get SSH commands
terraform output ssh_commands
```

### Connect to API Droplet

```bash
# SSH to the droplet (replace IP with actual output)
ssh root@<api_public_ip>

# Or use terraform output
ssh root@$(terraform output -raw api_public_ips | jq -r '.[0]')
```

### Test Database Connection

From the API droplet:

```bash
# Install PostgreSQL client
apt-get update && apt-get install -y postgresql-client

# Connect to database (use private host)
PGPASSWORD='<password>' psql -h <private_host> -U restomarket_app -d restomarket_dev
```

### Test Redis Connection

From the API droplet:

```bash
# Install Redis client
apt-get update && apt-get install -y redis-tools

# Connect to Redis (use private host)
redis-cli -h <private_host> -p 6379 -a '<password>' ping
```

## Deploy Application

### Method 1: Manual Deployment

```bash
# SSH to droplet
ssh root@<api_public_ip>

# Clone repository
cd /opt/app
git clone <your-repo-url> .

# Create environment file
cat > .env <<EOF
DATABASE_URL=<database_uri_from_terraform_output>
REDIS_HOST=<redis_host_from_terraform_output>
REDIS_PORT=6379
REDIS_PASSWORD=<redis_password_from_terraform_output>
NODE_ENV=development
EOF

# Pull and run Docker images
docker pull ghcr.io/<owner>/restomarket-api:latest
docker-compose up -d
```

### Method 2: CI/CD Deployment

Configure GitHub Actions secrets:

```bash
# In GitHub Settings > Secrets and variables > Actions

DEV_HOST=<api_public_ip>
DEV_SSH_KEY=<private_ssh_key>
DATABASE_URL=<from_terraform_output>
REDIS_HOST=<from_terraform_output>
REDIS_PASSWORD=<from_terraform_output>
```

Then deploy via GitHub Actions workflow.

## Remote State Backend (Optional)

To enable team collaboration with remote state:

### Step 1: Create Spaces Bucket

```bash
# Using doctl
doctl compute space create restomarket-terraform-state --region nyc3

# Or manually via DigitalOcean console
# Manage > Spaces > Create
```

### Step 2: Generate Spaces Access Keys

```bash
# Using doctl
doctl compute spaces-access list

# Or via console
# Manage > API > Spaces Access Keys > Generate New Key
```

### Step 3: Configure Backend

Uncomment the backend block in `main.tf`:

```hcl
backend "s3" {
  endpoint                    = "nyc3.digitaloceanspaces.com"
  key                         = "terraform/dev/terraform.tfstate"
  bucket                      = "restomarket-terraform-state"
  region                      = "us-east-1"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_region_validation      = true
}
```

### Step 4: Set Credentials

```bash
export AWS_ACCESS_KEY_ID="<spaces_access_key>"
export AWS_SECRET_ACCESS_KEY="<spaces_secret_key>"
```

### Step 5: Migrate State

```bash
terraform init -migrate-state
```

## Updating Infrastructure

### Modify Resources

1. Update variables in `terraform.tfvars`
2. Run plan to preview changes:
   ```bash
   terraform plan
   ```
3. Apply changes:
   ```bash
   terraform apply
   ```

### Add More Droplets

```hcl
# In terraform.tfvars
api_droplet_count = 2
```

Then apply:

```bash
terraform apply
```

### Upgrade Database

```hcl
# In terraform.tfvars
db_node_size = "db-s-2vcpu-2gb"
```

**⚠️ WARNING**: This may cause downtime!

## Maintenance

### View Resource Status

```bash
# List all droplets
doctl compute droplet list

# List all databases
doctl databases list

# View firewall rules
doctl compute firewall list
```

### Monitor Costs

```bash
# View current month costs
doctl balance get

# View project resources
doctl projects resources list <project_id>
```

### Backup Database

```bash
# Backups are automatic for managed databases
# View available backups
doctl databases backups list <database_id>
```

## Troubleshooting

### Issue: "SSH key not found"

**Solution**: Ensure SSH key is added to DigitalOcean:

```bash
doctl compute ssh-key list
doctl compute ssh-key import my-key --public-key-file ~/.ssh/id_rsa.pub
```

### Issue: "Error creating droplet: rate limit exceeded"

**Solution**: Wait a few minutes and try again. DigitalOcean has rate limits.

### Issue: "Database cluster creation timeout"

**Solution**: Database creation can take 5-10 minutes. Be patient. If it fails, run `terraform apply` again.

### Issue: "Cannot connect to database from local machine"

**Solution**: Managed databases are only accessible from:

- Droplets in the same VPC
- Explicitly allowed IP addresses (add via `allowed_ips` variable)

For local testing, add your IP:

```hcl
# In database module call (main.tf)
allowed_ips = ["<your_public_ip>/32"]
```

### Issue: "Terraform state is locked"

**Solution**: Another terraform process is running or crashed. Force unlock:

```bash
terraform force-unlock <lock_id>
```

### Issue: "Module not found"

**Solution**: Run `terraform init` to download modules.

## Destroying Infrastructure

### ⚠️ WARNING

This will **permanently delete** all resources and data. Database backups may be retained.

### Step 1: Review Resources

```bash
terraform plan -destroy
```

### Step 2: Destroy

```bash
terraform destroy
```

Confirm by typing `yes`.

### Step 3: Verify

```bash
# Check DigitalOcean console
# Ensure all resources are deleted

# Or use doctl
doctl compute droplet list
doctl databases list
doctl vpcs list
```

## Security Best Practices

### 1. Restrict SSH Access

In production, restrict `admin_ips`:

```hcl
admin_ips = ["1.2.3.4/32"]  # Your office/home IP
```

### 2. Enable Backups (Production)

```hcl
api_enable_backups = true
```

### 3. Use Read Replicas (Production)

For high availability, add database replicas in `main.tf`.

### 4. Rotate Credentials

- Database password: Rotate every 90 days via DigitalOcean console
- Redis password: Rotate every 90 days via DigitalOcean console
- SSH keys: Rotate annually

### 5. Enable Private Networking

All resources use private networking by default. Never expose database/Redis publicly.

## Cost Optimization Tips

1. **Destroy when not in use**: Run `terraform destroy` when environment not needed
2. **Use smaller sizes**: Default sizes are minimal, but can go smaller if needed
3. **Disable backups**: Backups are disabled by default for dev
4. **Single node databases**: Dev uses single-node (no HA) to save costs
5. **No load balancer**: Single droplet doesn't need a load balancer

## Next Steps

1. **Configure DNS**: Point your domain to `api_public_ip`
2. **Setup SSL**: Use Let's Encrypt or DigitalOcean managed certificates
3. **Deploy Application**: Use CI/CD or manual deployment
4. **Monitor**: Check DigitalOcean monitoring dashboards
5. **Scale**: When ready, move to staging environment

## File Reference

- `main.tf` - Main infrastructure configuration
- `variables.tf` - Variable definitions with validation
- `outputs.tf` - Output values and connection info
- `terraform.tfvars` - Your environment-specific values (gitignored)
- `terraform.tfvars.example` - Example configuration template

## Support

For issues:

1. Check DigitalOcean status page: https://status.digitalocean.com
2. Review Terraform logs: `TF_LOG=DEBUG terraform apply`
3. Contact DigitalOcean support: https://www.digitalocean.com/support
4. Review this repository's issues

## Resources

- [DigitalOcean Terraform Provider](https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs)
- [DigitalOcean API Documentation](https://docs.digitalocean.com/reference/api/)
- [Terraform Best Practices](https://www.terraform.io/docs/cloud/guides/recommended-practices/index.html)
