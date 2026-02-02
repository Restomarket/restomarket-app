# Terraform Step-by-Step: Requirements and Configuration

This guide walks you through every requirement, where to get each value, and how to run Terraform for **staging** or **dev**.

---

## Part 1: Prerequisites

### 1.1 Accounts and access

| Requirement              | Where / How                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DigitalOcean account** | Sign up at [digitalocean.com](https://www.digitalocean.com). You need a valid payment method for droplets, managed DB, Redis, and (optional) Spaces. |
| **Billing**              | Staging costs ~$245/month; dev ~$50/month. Ensure your account can create resources.                                                                 |

### 1.2 Tools on your machine

| Tool                                       | Purpose                                            | Install                                                                                                                                      |
| ------------------------------------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Terraform**                              | `terraform init`, `plan`, `apply`                  | [terraform.io/downloads](https://www.terraform.io/downloads) — need **>= 1.0**. Check: `terraform version`                                   |
| **doctl** (optional)                       | List SSH keys, verify API token, inspect resources | [docs.digitalocean.com/reference/doctl/how-to/install](https://docs.digitalocean.com/reference/doctl/how-to/install). Check: `doctl version` |
| **AWS CLI** (only if using Spaces backend) | S3-compatible API for DigitalOcean Spaces          | [aws.amazon.com/cli](https://aws.amazon.com/cli). Check: `aws --version`                                                                     |

---

## Part 2: Where to Get Each Required Value

You must set **three required variables** in `terraform.tfvars`: `do_token`, `ssh_key_name`, and (for staging) `admin_ips`.

---

### 2.1 `do_token` (DigitalOcean API token)

**What it is:** A personal access token so Terraform can create and manage resources in your DigitalOcean account.

**Where to get it:**

1. Log in to [cloud.digitalocean.com](https://cloud.digitalocean.com).
2. Go to **API** in the left sidebar (or open [cloud.digitalocean.com/account/api/tokens](https://cloud.digitalocean.com/account/api/tokens)).
3. Under **Tokens/Keys** → **Generate New Token**.
4. Name it (e.g. `terraform-staging`), choose **Read and Write**, then **Generate Token**.
5. **Copy the token immediately** — it looks like `dop_v1_xxxxxxxx...` and is shown only once.

**Verify (optional):**

```bash
doctl auth init
# Paste your token when prompted

doctl account get
# Should print your account email — token works
```

**Use in Terraform:** Put the token in `terraform.tfvars` as `do_token = "dop_v1_..."`. Never commit this file (it’s in `.gitignore`).

---

### 2.2 `ssh_key_name` (SSH key name in DigitalOcean)

**What it is:** The **name** of an SSH key already added to your DigitalOcean account. Terraform uses it so new droplets accept your (or the deploy) SSH key.

**Where to get / set it:**

**Option A – You already have a key in DigitalOcean**

1. Go to [cloud.digitalocean.com/account/security](https://cloud.digitalocean.com/account/security) (or **Settings** → **Security** → **SSH Keys**).
2. Find the key you use for SSH; the **name** is what you see in the list (e.g. `MacBook`, `my-laptop`).

**Option B – List keys with doctl**

```bash
doctl compute ssh-key list
```

Example output:

```
ID          Name           FingerPrint
12345678    my-macbook     aa:bb:cc:dd:...
```

Use the **Name** column (e.g. `my-macbook`) as `ssh_key_name`.

**Option C – Add a new key to DigitalOcean**

1. **Generate a key** (if you don’t have one):
   ```bash
   ssh-keygen -t ed25519 -C "your@email.com" -f ~/.ssh/id_ed25519_do -N ""
   ```
2. **Add the public key** to DigitalOcean:
   - Either in the UI: **Settings** → **Security** → **Add SSH Key** — paste contents of `~/.ssh/id_ed25519_do.pub` and give it a name (e.g. `terraform-deploy`).
   - Or with doctl:
     ```bash
     doctl compute ssh-key import terraform-deploy --public-key-file ~/.ssh/id_ed25519_do.pub
     ```
3. Use that **name** (e.g. `terraform-deploy`) as `ssh_key_name`.

**Use in Terraform:** In `terraform.tfvars`: `ssh_key_name = "your-exact-key-name"`. The name is case-sensitive and must match DigitalOcean exactly.

---

### 2.3 `admin_ips` (IPs allowed to SSH to droplets)

**What it is:** A list of CIDR addresses (e.g. `"1.2.3.4/32"`) that the firewall allows to connect to SSH on the API droplets. Everyone else is blocked.

**Where to get your IP:**

```bash
curl -s ifconfig.me
# or
curl -s icanhazip.com
```

Use that IP with `/32` (single host), e.g. `"203.0.113.50/32"`.

**Recommendations:**

- **Dev:** You can use `["0.0.0.0/0"]` to allow SSH from anywhere (default in dev). Only for non-production.
- **Staging:** Use **your** IP(s) only, e.g. `["203.0.113.50/32"]`. Add office, home, VPN if needed:
  ```hcl
  admin_ips = [
    "203.0.113.50/32",   # Home
    "198.51.100.10/32",  # Office
  ]
  ```

**Use in Terraform:** In `terraform.tfvars`: `admin_ips = ["YOUR_IP/32"]`. For staging, **do not** leave it empty if the variable is required by the module; use at least your IP.

---

## Part 3: Optional – Remote State (Spaces Backend)

By default, Terraform keeps state in a local file. For team use or safety, you can store state in a **DigitalOcean Spaces** bucket (S3-compatible).

### 3.1 When to use it

- You want state in one place (shared or backup).
- You’re okay creating a Spaces bucket and keys.

### 3.2 Create a Spaces bucket and keys

1. In DigitalOcean: **Spaces** → **Create Space**.
2. Choose a region (e.g. `nyc3`), a name (e.g. `restomarket-terraform-state`), then create.
3. **Spaces API keys:** **API** → **Spaces Keys** → **Generate New Key**. Name it (e.g. `terraform-state`), copy **Access Key** and **Secret** once.

### 3.3 Configure AWS CLI for Spaces

Spaces is S3-compatible; the script uses the AWS CLI with a custom endpoint.

**Option A – Environment variables**

```bash
export AWS_ACCESS_KEY_ID="your-spaces-access-key"
export AWS_SECRET_ACCESS_KEY="your-spaces-secret-key"
```

**Option B – `~/.aws/credentials`**

```ini
[default]
aws_access_key_id = your-spaces-access-key
aws_secret_access_key = your-spaces-secret-key
```

### 3.4 Run init-backend.sh

From the **repository root**:

```bash
cd infrastructure/terraform/scripts
chmod +x init-backend.sh

# For staging, bucket name, region (must be a Spaces region: nyc3, sfo3, sgp1, fra1, ams3)
./init-backend.sh staging restomarket-terraform-state nyc3
```

This creates the bucket (if needed), enables versioning, and writes a backend config file under `infrastructure/terraform/environments/staging/backend-config.tfvars`.

### 3.5 Uncomment the backend block in main.tf

When using Spaces, Terraform must use the S3 backend. In your **environment** `main.tf` (e.g. `infrastructure/terraform/environments/staging/main.tf`), uncomment the `backend "s3" { ... }` block inside the `terraform { ... }` block. You can leave the inner values as placeholders; the real values will come from `-backend-config=backend-config.tfvars`.

Example (staging). Use the same `bucket` and `key` that `init-backend.sh` wrote to `backend-config.tfvars` (e.g. `key = "staging/terraform.tfstate"`, `bucket = "restomarket-terraform-state"`):

```hcl
terraform {
  required_version = ">= 1.0"
  required_providers { ... }

  backend "s3" {
    endpoint                    = "nyc3.digitaloceanspaces.com"
    key                         = "staging/terraform.tfstate"
    bucket                      = "restomarket-terraform-state"
    region                      = "us-east-1"
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
  }
}
```

### 3.6 Use the backend when running Terraform

When you run `terraform init` (see Part 5), pass the generated backend config:

```bash
cd infrastructure/terraform/environments/staging
terraform init -backend-config=backend-config.tfvars
```

For **dev**, run `init-backend.sh dev ...` and then use `infrastructure/terraform/environments/dev/backend-config.tfvars` from the dev directory.

---

## Part 4: Configure terraform.tfvars

You configure **one environment per directory**: either **staging** or **dev**.

### 4.1 Choose environment

- **Staging:** production-like, 2 API droplets, HA DB, load balancer, ~$245/month.  
  Directory: `infrastructure/terraform/environments/staging`
- **Dev:** minimal, 1 droplet, single DB node, ~$50/month.  
  Directory: `infrastructure/terraform/environments/dev`

### 4.2 Staging

```bash
cd infrastructure/terraform/environments/staging
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`. **Minimum you must set:**

```hcl
# REQUIRED – replace with your values
do_token      = "dop_v1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
ssh_key_name  = "your-exact-ssh-key-name-from-digitalocean"

# Strongly recommended for staging: restrict SSH to your IP(s)
admin_ips = [
  "YOUR_IP/32",   # from: curl -s ifconfig.me
]
```

Uncomment and fill the same variables if they’re still commented in the example. Leave other blocks (DB, Redis, droplet sizes, etc.) as in the example unless you want to change them. Staging defaults are already set for HA and cost.

### 4.3 Dev

```bash
cd infrastructure/terraform/environments/dev
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`. **Minimum:**

```hcl
do_token     = "dop_v1_xxxxxxxx..."
ssh_key_name = "your-exact-ssh-key-name"
# admin_ips defaults to ["0.0.0.0/0"] in dev; override if you want to restrict
```

Save the file. **Never commit `terraform.tfvars`** (it contains secrets).

---

## Part 5: Run Terraform (init → plan → apply)

All commands are run from the **environment directory** (staging or dev).

### 5.1 Go to the environment directory

**Staging:**

```bash
cd infrastructure/terraform/environments/staging
```

**Dev:**

```bash
cd infrastructure/terraform/environments/dev
```

### 5.2 Initialize Terraform

**Without remote backend (local state):**

```bash
terraform init
```

**With Spaces backend (after running init-backend.sh):**

```bash
terraform init -backend-config=backend-config.tfvars
```

If you had existing local state and want to move it to the backend:

```bash
terraform init -backend-config=backend-config.tfvars -migrate-state
```

You should see “Terraform has been successfully initialized”.

### 5.3 Plan (preview changes)

```bash
terraform plan
```

Review the list of resources to be created (droplets, VPC, DB, Redis, load balancer, etc.). No changes are applied yet.

### 5.4 Apply (create resources)

```bash
terraform apply
```

Terraform will show the plan again and ask for confirmation. Type `yes` and press Enter. Applying can take several minutes.

When it finishes, you’ll see outputs (IPs, DB host, Redis host, etc.).

### 5.5 If something fails

- **“Error: Invalid SSH key”** → `ssh_key_name` must match exactly a key in DigitalOcean (`doctl compute ssh-key list`).
- **“Error: Invalid token”** → Regenerate a token in DigitalOcean and update `do_token`.
- **“Error: Insufficient balance”** → Add payment method or reduce sizes in `terraform.tfvars` (e.g. smaller DB/droplets for testing).

---

## Part 6: Get Outputs for Next Steps

After a successful `apply`, use these for Ansible and GitHub Actions.

### 6.1 Staging

From `infrastructure/terraform/environments/staging`:

```bash
# First API droplet IP – use as STAGING_HOST in GitHub Secrets and Ansible inventory
terraform output -raw api_public_ips | jq -r '.[0]'

# All API droplet IPs (for Ansible if you have multiple hosts)
terraform output -raw api_public_ips | jq -r '.[]'

# Load balancer IP (for health checks / DNS later)
terraform output -raw load_balancer_ip

# Database URI (for app env or GitHub secret DATABASE_URL if needed)
terraform output -raw database_uri

# Redis URI (for app env or GitHub secret REDIS_URL if needed)
terraform output -raw redis_uri
```

### 6.2 Dev

From `infrastructure/terraform/environments/dev`:

```bash
# Single API droplet IP
terraform output -raw api_public_ips | jq -r '.[0]'

# Database and Redis URIs
terraform output -raw database_uri
terraform output -raw redis_uri
```

### 6.3 Summary output (staging)

```bash
terraform output quick_start
terraform output deployment_notes
```

---

## Part 7: Quick Reference Checklist

| Step | Action                                                                                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | DigitalOcean account + API token from [API Tokens](https://cloud.digitalocean.com/account/api/tokens) → `do_token`                                       |
| 2    | Add SSH key in [Security → SSH Keys](https://cloud.digitalocean.com/account/security); note **name** → `ssh_key_name`                                    |
| 3    | Your IP: `curl -s ifconfig.me` → `admin_ips = ["IP/32"]` (staging); dev can use `["0.0.0.0/0"]`                                                          |
| 4    | (Optional) Create Spaces bucket + keys; run `init-backend.sh <env> <bucket> <region>`; use `-backend-config=backend-config.tfvars` with `terraform init` |
| 5    | `cd infrastructure/terraform/environments/staging` (or `dev`)                                                                                            |
| 6    | `cp terraform.tfvars.example terraform.tfvars` and set `do_token`, `ssh_key_name`, `admin_ips`                                                           |
| 7    | `terraform init` (or `terraform init -backend-config=backend-config.tfvars`)                                                                             |
| 8    | `terraform plan` then `terraform apply`                                                                                                                  |
| 9    | Save outputs: first API IP for STAGING_HOST / Ansible; DB/Redis URIs if needed for app or GitHub                                                         |

After this, you can configure Ansible inventory with the droplet IP(s) and run the setup playbook, and add GitHub secrets (e.g. `STAGING_HOST`, `STAGING_USERNAME`, `STAGING_SSH_KEY`) as in [SETUP_AND_FIRST_RUN.md](../../docs/SETUP_AND_FIRST_RUN.md).
