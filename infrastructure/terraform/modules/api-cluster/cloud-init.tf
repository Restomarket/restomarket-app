# Enhanced Cloud-Init Configuration for API Droplets
# Includes Docker, CI/CD, security, and monitoring best practices

locals {
  # Enhanced user data script with best practices
  enhanced_user_data = <<-EOT
    #!/bin/bash
    set -euo pipefail

    # ============================================================================
    # Logging Setup
    # ============================================================================
    exec 1> >(tee -a /var/log/cloud-init-custom.log)
    exec 2>&1
    echo "=== Cloud-Init Started at $(date) ==="

    # ============================================================================
    # System Configuration
    # ============================================================================

    # Set timezone
    timedatectl set-timezone ${var.timezone}

    # Configure NTP for time synchronization
    apt-get update
    apt-get install -y chrony
    systemctl enable chrony
    systemctl start chrony

    # Update system packages
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"

    # ============================================================================
    # Security Hardening
    # ============================================================================

    # Install security tools
    apt-get install -y \
      fail2ban \
      unattended-upgrades \
      ufw \
      apt-listchanges

    # Configure automatic security updates
    cat > /etc/apt/apt.conf.d/50unattended-upgrades <<'EOF'
Unattended-Upgrade::Allowed-Origins {
    "$${distro_id}:$${distro_codename}-security";
    "$${distro_id}ESMApps:$${distro_codename}-apps-security";
    "$${distro_id}ESM:$${distro_codename}-infra-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

    # Enable automatic updates
    cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF

    # Configure fail2ban for SSH protection
    cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
destemail = ${var.alert_email}
sendername = Fail2Ban
action = %(action_mwl)s

[sshd]
enabled = true
port = 22
logpath = %(sshd_log)s
maxretry = 3
EOF

    systemctl enable fail2ban
    systemctl start fail2ban

    # SSH hardening
    sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config
    sed -i 's/X11Forwarding yes/X11Forwarding no/' /etc/ssh/sshd_config
    echo "MaxAuthTries 3" >> /etc/ssh/sshd_config
    echo "MaxSessions 2" >> /etc/ssh/sshd_config
    echo "ClientAliveInterval 300" >> /etc/ssh/sshd_config
    echo "ClientAliveCountMax 2" >> /etc/ssh/sshd_config
    systemctl reload sshd

    # ============================================================================
    # Docker Installation and Configuration
    # ============================================================================

    # Install prerequisites
    apt-get install -y \
      apt-transport-https \
      ca-certificates \
      curl \
      gnupg \
      lsb-release \
      software-properties-common \
      jq

    # Install Docker
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Configure Docker daemon with best practices
    mkdir -p /etc/docker
    cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3",
    "labels": "production_status",
    "env": "os,customer"
  },
  "storage-driver": "overlay2",
  "userland-proxy": false,
  "live-restore": true,
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  },
  "metrics-addr": "127.0.0.1:9323",
  "experimental": false,
  "features": {
    "buildkit": true
  }
}
EOF

    # Enable and start Docker
    systemctl enable docker
    systemctl start docker

    # ============================================================================
    # User Configuration
    # ============================================================================

    # Create deploy user with proper permissions
    useradd -m -s /bin/bash -G docker,sudo deploy

    # Setup SSH for deploy user
    mkdir -p /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    touch /home/deploy/.ssh/authorized_keys
    chmod 600 /home/deploy/.ssh/authorized_keys

    # Copy root's authorized keys to deploy user
    if [ -f /root/.ssh/authorized_keys ]; then
      cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
    fi

    chown -R deploy:deploy /home/deploy/.ssh

    # Allow deploy user sudo without password for specific commands
    cat > /etc/sudoers.d/deploy <<'EOF'
deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart docker
deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl status docker
deploy ALL=(ALL) NOPASSWD: /usr/bin/docker system prune
EOF
    chmod 0440 /etc/sudoers.d/deploy

    # ============================================================================
    # Application Directory Setup
    # ============================================================================

    # Create application directories
    mkdir -p /opt/app/{scripts,logs,backups,config}
    mkdir -p /var/log/app

    # Set ownership
    chown -R deploy:deploy /opt/app
    chown -R deploy:deploy /var/log/app

    # ============================================================================
    # GitHub Container Registry Authentication
    # ============================================================================

    # Create Docker config directory for deploy user
    mkdir -p /home/deploy/.docker
    chown deploy:deploy /home/deploy/.docker

    # Note: Actual GHCR token will be set by CI/CD during deployment
    # This just ensures the directory structure exists

    # ============================================================================
    # Monitoring and Health Checks
    # ============================================================================

    # Install monitoring tools
    apt-get install -y \
      htop \
      iotop \
      nethogs \
      sysstat \
      ncdu

    # Enable sysstat for performance monitoring
    sed -i 's/ENABLED="false"/ENABLED="true"/' /etc/default/sysstat
    systemctl enable sysstat
    systemctl start sysstat

    # Install DigitalOcean monitoring agent
    ${var.enable_monitoring ? "curl -sSL https://repos.insights.digitalocean.com/install.sh | bash" : "# Monitoring disabled"}

    # ============================================================================
    # Docker Maintenance
    # ============================================================================

    # Create Docker cleanup cron job (runs daily at 2 AM)
    cat > /etc/cron.d/docker-cleanup <<'EOF'
0 2 * * * deploy /usr/bin/docker system prune -af --filter "until=168h" >> /var/log/docker-cleanup.log 2>&1
EOF
    chmod 0644 /etc/cron.d/docker-cleanup

    # Create log rotation for Docker logs
    cat > /etc/logrotate.d/docker-containers <<'EOF'
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF

    # ============================================================================
    # Firewall Configuration
    # ============================================================================

    # Configure UFW
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing

    # Allow SSH (port 22)
    ufw allow 22/tcp

    # Allow API port ONLY from VPC CIDR (load balancer uses VPC private IPs)
    # This prevents direct internet access to API port on droplet public IP
    ${length(var.vpc_cidr) > 0 ? "ufw allow from ${var.vpc_cidr} to any port ${var.api_port} proto tcp comment 'API port from VPC (LB)'" : ""}

    # Allow Docker daemon (only from localhost)
    ufw allow from 127.0.0.1 to any port 2375 proto tcp

    # Allow internal VPC traffic for database (Redis ports commented when Redis disabled)
    ${length(var.vpc_cidr) > 0 ? "ufw allow from ${var.vpc_cidr} to any port 5432 proto tcp comment 'PostgreSQL from VPC'" : ""}
    ${length(var.vpc_cidr) > 0 ? "ufw allow from ${var.vpc_cidr} to any port 25060 proto tcp comment 'Managed PostgreSQL from VPC'" : ""}
    # ${length(var.vpc_cidr) > 0 ? "ufw allow from ${var.vpc_cidr} to any port 6379 proto tcp comment 'Redis from VPC'" : ""}
    # ${length(var.vpc_cidr) > 0 ? "ufw allow from ${var.vpc_cidr} to any port 25061 proto tcp comment 'Managed Redis from VPC'" : ""}

    # Allow ICMP from VPC (for health checks and diagnostics)
    ${length(var.vpc_cidr) > 0 ? "ufw allow from ${var.vpc_cidr} proto icmp" : ""}

    # Enable firewall
    ufw --force enable

    # ============================================================================
    # System Performance Tuning
    # ============================================================================

    # Configure swap (if not already present)
    if [ ! -f /swapfile ]; then
      # Create 2GB swap
      fallocate -l 2G /swapfile
      chmod 600 /swapfile
      mkswap /swapfile
      swapon /swapfile
      echo '/swapfile none swap sw 0 0' >> /etc/fstab

      # Tune swap usage
      sysctl vm.swappiness=10
      sysctl vm.vfs_cache_pressure=50
      echo 'vm.swappiness=10' >> /etc/sysctl.conf
      echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.conf
    fi

    # Increase file descriptors limit
    cat >> /etc/security/limits.conf <<'EOF'
* soft nofile 65536
* hard nofile 65536
deploy soft nofile 65536
deploy hard nofile 65536
EOF

    # Network performance tuning
    cat >> /etc/sysctl.conf <<'EOF'
# Network performance tuning
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_tw_reuse = 1
EOF
    sysctl -p

    # ============================================================================
    # Health Check Script
    # ============================================================================

    cat > /opt/app/scripts/health-check.sh <<'EOF'
#!/bin/bash
# Health check script for monitoring

set -e

# Check Docker daemon
if ! systemctl is-active --quiet docker; then
    echo "ERROR: Docker is not running"
    exit 1
fi

# Check disk space
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    echo "WARNING: Disk usage is at $${DISK_USAGE}%"
fi

# Check memory
MEM_AVAILABLE=$(free -m | awk 'NR==2{print $7}')
if [ "$MEM_AVAILABLE" -lt 200 ]; then
    echo "WARNING: Available memory is low: $${MEM_AVAILABLE}MB"
fi

echo "Health check passed"
exit 0
EOF
    chmod +x /opt/app/scripts/health-check.sh
    chown deploy:deploy /opt/app/scripts/health-check.sh

    # Add health check to cron (every 5 minutes)
    cat > /etc/cron.d/health-check <<'EOF'
*/5 * * * * deploy /opt/app/scripts/health-check.sh >> /var/log/app/health-check.log 2>&1
EOF
    chmod 0644 /etc/cron.d/health-check

    # ============================================================================
    # Deployment Scripts Setup
    # ============================================================================

    # Create deployment directory structure
    mkdir -p /opt/app/deployments/current
    mkdir -p /opt/app/deployments/previous
    chown -R deploy:deploy /opt/app/deployments

    # Create environment file template
    cat > /opt/app/config/.env.template <<'EOF'
# Application Environment Variables
NODE_ENV=production
APP_PORT=${var.api_port}
LOG_LEVEL=info
API_PREFIX=v1

# Database (set by CI/CD)
DATABASE_URL=

# Redis (set by CI/CD - leave empty when Redis is disabled)
REDIS_URL=

# CORS (set by CI/CD)
CORS_ORIGINS=
EOF
    chown deploy:deploy /opt/app/config/.env.template

    # ============================================================================
    # System Information
    # ============================================================================

    # Create system info file
    cat > /opt/app/system-info.txt <<EOF
Droplet Setup Completed: $(date)
Hostname: $(hostname)
OS: $(lsb_release -ds)
Kernel: $(uname -r)
Docker Version: $(docker --version)
Docker Compose Version: $(docker compose version)
Timezone: $(timedatetime status | grep "Time zone")
EOF

    # ============================================================================
    # Custom User Data
    # ============================================================================
    ${var.custom_user_data}

    # ============================================================================
    # Final Steps
    # ============================================================================

    # Test Docker installation
    docker run --rm hello-world > /var/log/docker-test.log 2>&1

    # Cleanup
    apt-get autoremove -y
    apt-get clean

    echo "=== Cloud-Init Completed Successfully at $(date) ==="
    echo "Setup log: /var/log/cloud-init-custom.log"
    echo "System info: /opt/app/system-info.txt"
  EOT
}
