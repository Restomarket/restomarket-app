# Terraform Scripts

This directory contains utility scripts for managing Terraform infrastructure.

## Available Scripts

### init-backend.sh

Initializes a DigitalOcean Spaces bucket for Terraform remote state storage with versioning enabled.

**Usage:**

```bash
./init-backend.sh <environment> <bucket-name> <region>
```

**Examples:**

```bash
# Development environment
./init-backend.sh dev restomarket-terraform-state nyc3

# Staging environment
./init-backend.sh staging restomarket-terraform-state-staging sfo3

# Production environment
./init-backend.sh production restomarket-terraform-state-prod fra1
```

**Prerequisites:**

- AWS CLI installed (DigitalOcean Spaces uses S3-compatible API)
- DigitalOcean Spaces access key and secret key

**Setup Credentials:**

Option 1 - Environment variables:

```bash
export AWS_ACCESS_KEY_ID='your-spaces-access-key'
export AWS_SECRET_ACCESS_KEY='your-spaces-secret-key'
```

Option 2 - AWS credentials file (`~/.aws/credentials`):

```ini
[default]
aws_access_key_id = your-spaces-access-key
aws_secret_access_key = your-spaces-secret-key
```

**What it does:**

1. Validates inputs and checks prerequisites
2. Creates the Spaces bucket (if it doesn't exist)
3. Enables versioning on the bucket
4. Sets lifecycle policy to delete versions older than 90 days
5. Generates `backend-config.tfvars` in the environment directory

**After running:**

```bash
cd infrastructure/terraform/environments/<environment>
terraform init -backend-config=backend-config.tfvars
```

**Features:**

- Idempotent - safe to run multiple times
- Color-coded output for easy reading
- Comprehensive error checking
- Automatic backend configuration generation
- Versioning enabled for state rollback capability
- Lifecycle policy to clean up old versions

**Supported Regions:**

- `nyc3` - New York 3
- `sfo3` - San Francisco 3
- `sgp1` - Singapore 1
- `fra1` - Frankfurt 1
- `ams3` - Amsterdam 3

## Installing Prerequisites

### AWS CLI

**macOS:**

```bash
brew install awscli
```

**Ubuntu/Debian:**

```bash
sudo apt-get update
sudo apt-get install awscli
```

**Manual installation:**

Follow the official guide: https://aws.amazon.com/cli/

### Verify Installation

```bash
aws --version
```

## Getting DigitalOcean Spaces Keys

1. Log in to DigitalOcean Console
2. Navigate to **API** section in left sidebar
3. Click **Spaces Keys** tab
4. Click **Generate New Key**
5. Give it a name (e.g., "terraform-backend")
6. Copy the **Access Key** and **Secret Key**
7. Store them securely (the secret key is only shown once)

## Security Best Practices

1. **Never commit credentials to git**
   - The `.gitignore` already excludes `backend-config.tfvars`
   - Never hardcode keys in scripts

2. **Use separate buckets per environment**
   - Dev: `restomarket-terraform-state-dev`
   - Staging: `restomarket-terraform-state-staging`
   - Production: `restomarket-terraform-state-prod`

3. **Restrict bucket access**
   - Only team members who manage infrastructure need access
   - Use DigitalOcean Teams to manage permissions

4. **Enable versioning**
   - The script automatically enables versioning
   - This allows state rollback if needed

5. **Backup state files**
   - DigitalOcean Spaces with versioning provides automatic backups
   - Consider periodic exports for disaster recovery

## Troubleshooting

### Error: AWS CLI not found

Install AWS CLI using the instructions above.

### Error: Credentials not found

Set up your credentials using one of the methods described above. Verify with:

```bash
aws configure list
```

### Error: Bucket already exists (owned by someone else)

The bucket name must be globally unique across all DigitalOcean Spaces. Try a different name:

```bash
./init-backend.sh dev restomarket-tf-state-mycompany-dev nyc3
```

### Error: Access denied

Verify your Spaces keys have the correct permissions:

1. Check keys in DigitalOcean Console
2. Regenerate keys if necessary
3. Update credentials in `~/.aws/credentials`

### Error: Endpoint not found

Ensure you're using a valid region (`nyc3`, `sfo3`, `sgp1`, `fra1`, `ams3`).

## State Management

### Viewing Current State

```bash
cd infrastructure/terraform/environments/<environment>
terraform state list
```

### Pulling State Locally

```bash
terraform state pull > terraform.tfstate.backup
```

### Force Unlock (if state is locked)

```bash
terraform force-unlock <lock-id>
```

### Verify Backend Configuration

```bash
terraform show
```

## Migration from Local State

If you have existing local state files, migrate them to remote backend:

```bash
# Run the init-backend.sh script first
./scripts/init-backend.sh dev restomarket-terraform-state nyc3

# Navigate to environment
cd environments/dev

# Initialize with migration
terraform init -backend-config=backend-config.tfvars -migrate-state

# Verify
terraform show
```

## Cost Considerations

DigitalOcean Spaces pricing (as of 2024):

- **Storage**: $5/month for 250 GB (included)
- **Additional storage**: $0.02/GB/month
- **Outbound transfer**: First 1 TB free, then $0.01/GB

Terraform state files are typically very small (<1 MB), so costs are minimal.

**Estimated cost for this project:**

- 3 environments × state files (~1 MB each) = ~3 MB total
- Monthly cost: ~$5 for all environments (minimum Spaces plan)

## Additional Resources

- [DigitalOcean Spaces Documentation](https://docs.digitalocean.com/products/spaces/)
- [Terraform S3 Backend](https://www.terraform.io/docs/language/settings/backends/s3.html)
- [AWS CLI S3 Commands](https://docs.aws.amazon.com/cli/latest/reference/s3/)

## Future Scripts

Additional scripts will be added to this directory:

- `deploy.sh` - Zero-downtime deployment script
- `rollback.sh` - Rollback to previous version
- `cleanup-images.sh` - Docker image retention policy

Check the main README and IMPLEMENTATION_PLAN.md for the latest status.
