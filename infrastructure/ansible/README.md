# Ansible Configuration Management

This directory contains Ansible playbooks and inventory files for configuring and managing RestoMarket infrastructure.

## Directory Structure

```
ansible/
├── ansible.cfg           # Ansible configuration
├── playbooks/            # Ansible playbooks
│   ├── setup-api.yml    # Initial server setup
│   └── update-api.yml   # API deployment updates
├── inventory/            # Environment inventories
│   ├── dev.yml          # Development environment
│   └── staging.yml      # Staging environment
└── keys/                 # SSH public keys (optional)
    └── *.pub            # Public keys for deploy user
```

## Prerequisites

### 1. Install Ansible

**macOS:**

```bash
brew install ansible
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install ansible
```

**Using pip:**

```bash
pip install ansible
```

### 2. Verify Installation

```bash
ansible --version
# Should show Ansible 2.15+ or higher
```

### 3. SSH Access

Ensure you have SSH access to target servers:

```bash
# Test SSH connection
ssh root@<droplet-ip>

# Or with specific key
ssh -i ~/.ssh/id_rsa root@<droplet-ip>
```

## Playbooks

### setup-api.yml - Initial Server Setup

Configures fresh DigitalOcean droplets with:

- ✅ System updates and security patches
- ✅ Docker CE and Docker Compose installation
- ✅ Deploy user creation (non-root) with Docker group membership
- ✅ UFW firewall configuration
- ✅ SSH hardening (disable root login, password authentication)
- ✅ Fail2ban for brute-force protection
- ✅ Automatic security updates
- ✅ DigitalOcean monitoring agent (optional)
- ✅ Node Exporter for Prometheus (optional)
- ✅ System tuning for production workloads

**Features:**

- **Idempotent**: Safe to run multiple times
- **Modular**: Configure monitoring and exporters via inventory variables
- **Secure**: Follows security best practices
- **Production-ready**: Optimized system parameters

### update-api.yml - API Deployment

Deploys and updates the API application with zero-downtime strategy (to be created in Task 16).

## Usage

### Initial Server Setup

**Development Environment:**

```bash
cd infrastructure/ansible

# 1. Update inventory with actual IPs
vim inventory/dev.yml

# 2. Test connectivity
ansible -i inventory/dev.yml api_servers -m ping

# 3. Run setup playbook (dry run)
ansible-playbook -i inventory/dev.yml playbooks/setup-api.yml --check

# 4. Run setup playbook
ansible-playbook -i inventory/dev.yml playbooks/setup-api.yml

# 5. Verify installation
ansible -i inventory/dev.yml api_servers -m command -a "docker --version"
```

**Staging Environment:**

```bash
# Setup both staging droplets
ansible-playbook -i inventory/staging.yml playbooks/setup-api.yml
```

### Targeting Specific Hosts

```bash
# Single host
ansible-playbook -i inventory/staging.yml playbooks/setup-api.yml --limit api-staging-01

# Multiple hosts
ansible-playbook -i inventory/staging.yml playbooks/setup-api.yml --limit "api-staging-01,api-staging-02"
```

### Playbook Options

```bash
# Dry run (check mode)
ansible-playbook -i inventory/dev.yml playbooks/setup-api.yml --check

# Show differences
ansible-playbook -i inventory/dev.yml playbooks/setup-api.yml --check --diff

# Step-by-step execution
ansible-playbook -i inventory/dev.yml playbooks/setup-api.yml --step

# Start at specific task
ansible-playbook -i inventory/dev.yml playbooks/setup-api.yml --start-at-task="Install Docker Engine"

# Verbose output
ansible-playbook -i inventory/dev.yml playbooks/setup-api.yml -v
ansible-playbook -i inventory/dev.yml playbooks/setup-api.yml -vv   # More verbose
ansible-playbook -i inventory/dev.yml playbooks/setup-api.yml -vvv  # Debug level
```

## Inventory Configuration

### Required Variables

Edit `inventory/dev.yml` or `inventory/staging.yml`:

```yaml
all:
  children:
    api_servers:
      hosts:
        api-dev-01:
          ansible_host: YOUR_DROPLET_IP # ← Replace with actual IP
          ansible_user: root
          ansible_ssh_private_key_file: ~/.ssh/id_rsa
          ansible_python_interpreter: /usr/bin/python3

      vars:
        environment: dev
        api_port: 3001
        enable_do_monitoring: true
        enable_node_exporter: false
```

### Optional Variables

You can customize these variables per environment:

| Variable                 | Default  | Description                                 |
| ------------------------ | -------- | ------------------------------------------- |
| `environment`            | -        | Environment name (dev, staging, production) |
| `api_port`               | 3001     | API application port                        |
| `deploy_user`            | deploy   | Non-root user for deployments               |
| `deploy_user_uid`        | 1001     | UID for deploy user                         |
| `app_directory`          | /opt/app | Application directory                       |
| `docker_compose_version` | 2.24.5   | Docker Compose version                      |
| `enable_do_monitoring`   | true     | Install DigitalOcean monitoring agent       |
| `enable_node_exporter`   | false    | Install Prometheus Node Exporter            |
| `node_exporter_version`  | 1.7.0    | Node Exporter version                       |
| `ssh_port`               | 22       | SSH port                                    |
| `fail2ban_enabled`       | true     | Enable Fail2ban                             |

## SSH Key Management

### Adding SSH Keys for Deploy User

1. Create `keys/` directory:

   ```bash
   mkdir -p infrastructure/ansible/keys
   ```

2. Add public keys:

   ```bash
   cp ~/.ssh/id_rsa.pub infrastructure/ansible/keys/admin.pub
   ```

3. The playbook automatically adds all `*.pub` files to the deploy user's `authorized_keys`.

### Using Different SSH Keys

Specify in inventory:

```yaml
hosts:
  api-dev-01:
    ansible_ssh_private_key_file: ~/.ssh/custom_key
```

## Post-Setup Verification

After running `setup-api.yml`, verify the installation:

```bash
# 1. Test SSH as deploy user
ssh deploy@<droplet-ip>

# 2. Verify Docker installation
docker --version
docker-compose --version

# 3. Verify Docker daemon
sudo systemctl status docker

# 4. Verify firewall
sudo ufw status

# 5. Verify Fail2ban
sudo systemctl status fail2ban
sudo fail2ban-client status sshd

# 6. Verify monitoring (if enabled)
sudo systemctl status do-agent  # DigitalOcean
sudo systemctl status node_exporter  # Prometheus

# 7. Test Docker permissions
docker ps  # Should work without sudo
```

## Security Best Practices

### SSH Hardening

The playbook applies these SSH hardening measures:

- ✅ Disable root login
- ✅ Disable password authentication
- ✅ Enable public key authentication only
- ✅ Limit max authentication attempts to 3
- ✅ Set client alive interval to 300s
- ✅ Disable X11 forwarding

### Firewall Rules

Default UFW rules:

- ✅ SSH (22/tcp) - Rate limited
- ✅ HTTP (80/tcp) - Allow
- ✅ HTTPS (443/tcp) - Allow
- ✅ API port (3001/tcp) - Allow (from load balancers only in staging)
- ✅ Default incoming policy: Deny
- ✅ Default outgoing policy: Allow

### Fail2ban Protection

Protects against SSH brute-force attacks:

- Max retries: 3
- Ban time: 3600 seconds (1 hour)
- Find time: 600 seconds (10 minutes)

### Automatic Security Updates

Configured to automatically install security updates:

- Daily package list updates
- Automatic security patches
- Weekly cleanup of old packages
- No automatic reboots (manual control)

## Troubleshooting

### Connection Issues

**Problem:** `Failed to connect to the host via ssh`

**Solutions:**

```bash
# 1. Verify SSH connectivity
ssh -v root@<droplet-ip>

# 2. Check SSH key
ansible -i inventory/dev.yml api_servers -m ping

# 3. Use different key
ansible -i inventory/dev.yml api_servers -m ping --private-key=~/.ssh/other_key

# 4. Disable host key checking (not recommended for production)
export ANSIBLE_HOST_KEY_CHECKING=False
```

### Python Not Found

**Problem:** `/usr/bin/python: not found`

**Solution:** Specify Python 3 in inventory:

```yaml
ansible_python_interpreter: /usr/bin/python3
```

### Permission Denied

**Problem:** `Permission denied (publickey)`

**Solutions:**

```bash
# 1. Ensure SSH agent is running
eval $(ssh-agent)
ssh-add ~/.ssh/id_rsa

# 2. Verify key permissions
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub

# 3. Check authorized_keys on server
ssh root@<droplet-ip> 'cat ~/.ssh/authorized_keys'
```

### Playbook Fails on Task

**Problem:** Playbook stops at specific task

**Solutions:**

```bash
# 1. Run with verbose output
ansible-playbook -i inventory/dev.yml playbooks/setup-api.yml -vvv

# 2. Start at failed task
ansible-playbook -i inventory/dev.yml playbooks/setup-api.yml --start-at-task="Task Name"

# 3. Check syntax
ansible-playbook playbooks/setup-api.yml --syntax-check
```

### Docker Installation Fails

**Problem:** Docker installation errors

**Solutions:**

```bash
# 1. Update APT cache manually
ansible -i inventory/dev.yml api_servers -m apt -a "update_cache=yes" -b

# 2. Check if Docker is already installed
ansible -i inventory/dev.yml api_servers -m command -a "docker --version"

# 3. Manually remove conflicting packages
ansible -i inventory/dev.yml api_servers -m apt -a "name=docker.io,docker,docker-engine state=absent" -b
```

### UFW Firewall Locks Out SSH

**Problem:** Can't connect after enabling UFW

**Prevention:** The playbook allows SSH before enabling UFW. If locked out:

```bash
# Access via DigitalOcean console and run:
sudo ufw disable
sudo ufw allow 22/tcp
sudo ufw enable
```

## Testing Playbooks

### Syntax Check

```bash
ansible-playbook playbooks/setup-api.yml --syntax-check
```

### Dry Run (Check Mode)

```bash
ansible-playbook -i inventory/dev.yml playbooks/setup-api.yml --check
```

### Limit to Test Hosts

Create a test inventory:

```yaml
# inventory/test.yml
all:
  children:
    api_servers:
      hosts:
        api-test-01:
          ansible_host: localhost
          ansible_connection: local
```

### Using Vagrant for Local Testing

```bash
# Install Vagrant
brew install vagrant  # macOS
apt install vagrant   # Ubuntu

# Create test VM
vagrant init ubuntu/focal64
vagrant up

# Test playbook
ansible-playbook -i "127.0.0.1:2222," playbooks/setup-api.yml \
  --private-key=.vagrant/machines/default/virtualbox/private_key \
  -u vagrant
```

## Integration with Terraform

After provisioning infrastructure with Terraform, use Ansible for configuration:

```bash
# 1. Provision with Terraform
cd infrastructure/terraform/environments/dev
terraform apply

# 2. Get droplet IPs from Terraform outputs
terraform output -json api_cluster_public_ips

# 3. Update Ansible inventory with IPs

# 4. Run Ansible playbook
cd ../../../ansible
ansible-playbook -i inventory/dev.yml playbooks/setup-api.yml
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Setup API Servers
  run: |
    cd infrastructure/ansible
    ansible-playbook -i inventory/staging.yml playbooks/setup-api.yml
  env:
    ANSIBLE_HOST_KEY_CHECKING: False
```

## Next Steps

1. ✅ Run `setup-api.yml` to configure servers
2. ⏳ Create and run `update-api.yml` to deploy application (Task 16)
3. ⏳ Configure environment variables on servers
4. ⏳ Verify health checks
5. ⏳ Set up monitoring dashboards

## Additional Resources

- [Ansible Documentation](https://docs.ansible.com/)
- [Ansible Best Practices](https://docs.ansible.com/ansible/latest/user_guide/playbooks_best_practices.html)
- [DigitalOcean + Ansible Tutorial](https://www.digitalocean.com/community/tutorials/how-to-use-ansible-to-automate-initial-server-setup-on-ubuntu-20-04)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
