# Network Security Diagram

## Staging Environment Security Architecture

```mermaid
graph TB
    subgraph "Internet Zone"
        ATTACKER[Potential Attackers]
        LEGIT[Legitimate Users]
        ADMIN[Admin/DevOps]
    end

    subgraph "Edge Security"
        LB[Load Balancer<br/>SSL Termination<br/>HTTPS only<br/>Health Check]
    end

    subgraph "DigitalOcean VPC: 10.20.0.0/16"
        subgraph "DMZ Zone - Public IPs"
            FW_LB[Firewall: Load Balancer<br/>In: HTTPS from Internet<br/>Out: HTTP to API droplets]
        end

        subgraph "Application Zone - Private Network"
            FW_API[Firewall: API Servers<br/>In: SSH from admin IPs only<br/>In: HTTP from LB only<br/>In: All from VPC<br/>Out: All to VPC<br/>Out: HTTPS to Internet]

            API1[API Droplet 1<br/>10.20.0.10<br/>UFW enabled<br/>SSH: Key-only<br/>Fail2ban active]

            API2[API Droplet 2<br/>10.20.0.11<br/>UFW enabled<br/>SSH: Key-only<br/>Fail2ban active]
        end

        subgraph "Data Zone - No Public Access"
            FW_DB[Firewall: Database<br/>In: PostgreSQL from VPC only<br/>Out: None]

            FW_REDIS[Firewall: Redis<br/>In: Redis from VPC only<br/>Out: None]

            DB[(PostgreSQL<br/>10.20.0.20<br/>SSL/TLS required<br/>Password auth<br/>VPC only)]

            REDIS[(Redis<br/>10.20.0.21<br/>Password auth<br/>VPC only)]
        end
    end

    ATTACKER -.->|❌ Blocked| LB
    LEGIT -->|✅ HTTPS:443| LB
    ADMIN -->|✅ SSH:22| FW_API

    LB --> FW_LB
    FW_LB -->|HTTP:3001| FW_API

    FW_API --> API1
    FW_API --> API2

    API1 -.->|Private Network| FW_DB
    API2 -.->|Private Network| FW_DB
    API1 -.->|Private Network| FW_REDIS
    API2 -.->|Private Network| FW_REDIS

    FW_DB --> DB
    FW_REDIS --> REDIS

    style ATTACKER fill:#D0021B,stroke:#9B0114,color:#fff
    style FW_LB fill:#F5A623,stroke:#C77E1A,color:#000
    style FW_API fill:#F5A623,stroke:#C77E1A,color:#000
    style FW_DB fill:#D0021B,stroke:#9B0114,color:#fff
    style FW_REDIS fill:#D0021B,stroke:#9B0114,color:#fff
    style LB fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style API1 fill:#7ED321,stroke:#5FA019,color:#000
    style API2 fill:#7ED321,stroke:#5FA019,color:#000
    style DB fill:#BD10E0,stroke:#8B0AA8,color:#fff
    style REDIS fill:#BD10E0,stroke:#8B0AA8,color:#fff
```

## Firewall Rules Detail

```mermaid
graph TB
    subgraph "API Server Firewall Rules"
        API_FW[API Firewall]

        API_IN_SSH[Inbound SSH<br/>Port: 22<br/>From: Admin IPs only<br/>Rate limited: 3/min]
        API_IN_HTTP[Inbound HTTP<br/>Port: 80<br/>From: Load Balancer]
        API_IN_HTTPS[Inbound HTTPS<br/>Port: 443<br/>From: Load Balancer]
        API_IN_API[Inbound API<br/>Port: 3001<br/>From: Load Balancer]
        API_IN_VPC[Inbound All<br/>Protocols: All<br/>From: VPC CIDR]

        API_OUT_VPC[Outbound All<br/>To: VPC CIDR<br/>All protocols]
        API_OUT_INT[Outbound Internet<br/>To: 0.0.0.0/0<br/>HTTP/HTTPS only]

        API_FW --> API_IN_SSH
        API_FW --> API_IN_HTTP
        API_FW --> API_IN_HTTPS
        API_FW --> API_IN_API
        API_FW --> API_IN_VPC
        API_FW --> API_OUT_VPC
        API_FW --> API_OUT_INT
    end

    subgraph "Database Firewall Rules"
        DB_FW[Database Firewall]

        DB_IN_PG[Inbound PostgreSQL<br/>Port: 5432<br/>From: VPC CIDR only]
        DB_OUT_NONE[Outbound: None<br/>All traffic blocked]

        DB_FW --> DB_IN_PG
        DB_FW --> DB_OUT_NONE
    end

    subgraph "Redis Firewall Rules"
        REDIS_FW[Redis Firewall]

        REDIS_IN_PORT[Inbound Redis<br/>Port: 6379<br/>From: VPC CIDR only]
        REDIS_OUT_NONE[Outbound: None<br/>All traffic blocked]

        REDIS_FW --> REDIS_IN_PORT
        REDIS_FW --> REDIS_OUT_NONE
    end

    style API_FW fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style DB_FW fill:#D0021B,stroke:#9B0114,color:#fff
    style REDIS_FW fill:#D0021B,stroke:#9B0114,color:#fff
    style API_IN_SSH fill:#F5A623,stroke:#C77E1A,color:#000
    style DB_OUT_NONE fill:#D0021B,stroke:#9B0114,color:#fff
    style REDIS_OUT_NONE fill:#D0021B,stroke:#9B0114,color:#fff
```

## UFW (Uncomplicated Firewall) on Droplets

```mermaid
graph LR
    subgraph "Host-level Firewall (UFW)"
        UFW[UFW on API Droplet]

        UFW_SSH[SSH: 22/tcp<br/>Rate limit: 3/min<br/>Fail2ban: 3 attempts = 1hr ban]
        UFW_HTTP[HTTP: 80/tcp<br/>From: Load Balancer IP]
        UFW_HTTPS[HTTPS: 443/tcp<br/>From: Load Balancer IP]
        UFW_API[API: 3001/tcp<br/>From: Load Balancer IP]
        UFW_DEFAULT[Default: DENY<br/>All other ports blocked]

        UFW --> UFW_SSH
        UFW --> UFW_HTTP
        UFW --> UFW_HTTPS
        UFW --> UFW_API
        UFW --> UFW_DEFAULT
    end

    subgraph "Fail2ban Protection"
        F2B[Fail2ban Service]
        F2B_SSH[SSH Jail<br/>Max retries: 3<br/>Ban time: 1 hour<br/>Find time: 10 minutes]
        F2B_LOG[Monitor: /var/log/auth.log]

        F2B --> F2B_SSH
        F2B --> F2B_LOG
    end

    UFW_SSH -.->|Triggers on brute force| F2B

    style UFW fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style UFW_DEFAULT fill:#D0021B,stroke:#9B0114,color:#fff
    style F2B fill:#F5A623,stroke:#C77E1A,color:#000
```

## SSH Security Hardening

```mermaid
graph TD
    START[SSH Connection Attempt] --> AUTH{Authentication<br/>Method}

    AUTH -->|Password| REJECT_PWD[❌ Rejected<br/>PasswordAuthentication no]
    AUTH -->|Root login| REJECT_ROOT[❌ Rejected<br/>PermitRootLogin no]
    AUTH -->|SSH Key| VALIDATE_KEY{Valid Key?}

    VALIDATE_KEY -->|No| FAIL_COUNT{Failed<br/>Attempts}
    VALIDATE_KEY -->|Yes| USER{User Exists?}

    FAIL_COUNT -->|< 3| RETRY[Retry allowed]
    FAIL_COUNT -->|>= 3| BAN[🔒 IP Banned 1 hour<br/>Fail2ban]

    USER -->|deploy user| CHECK_SUDO{Needs Sudo?}
    USER -->|Other| REJECT_USER[❌ Rejected<br/>AllowUsers deploy]

    CHECK_SUDO -->|Yes| SUDO_AUTH{Sudo Password}
    CHECK_SUDO -->|No| ALLOW[✅ Shell Access]

    SUDO_AUTH -->|Valid| ALLOW_SUDO[✅ Sudo Access<br/>Docker commands only]
    SUDO_AUTH -->|Invalid| REJECT_SUDO[❌ Denied]

    RETRY --> AUTH

    style REJECT_PWD fill:#D0021B,stroke:#9B0114,color:#fff
    style REJECT_ROOT fill:#D0021B,stroke:#9B0114,color:#fff
    style REJECT_USER fill:#D0021B,stroke:#9B0114,color:#fff
    style REJECT_SUDO fill:#D0021B,stroke:#9B0114,color:#fff
    style BAN fill:#D0021B,stroke:#9B0114,color:#fff
    style ALLOW fill:#7ED321,stroke:#5FA019,color:#000
    style ALLOW_SUDO fill:#7ED321,stroke:#5FA019,color:#000
```

## SSL/TLS Configuration

```mermaid
graph LR
    subgraph "Client Connection"
        CLIENT[Client Browser]
    end

    subgraph "Load Balancer"
        LB[DigitalOcean LB]
        LB_SSL[SSL Certificate<br/>Let's Encrypt or Custom<br/>TLS 1.2+]
        LB_REDIRECT[HTTP → HTTPS Redirect]
    end

    subgraph "API Droplets"
        API[API Container]
        API_HTTP[HTTP :3001<br/>Internal only<br/>No SSL overhead]
    end

    subgraph "Database"
        DB[PostgreSQL]
        DB_SSL[SSL/TLS Required<br/>sslmode=require]
    end

    CLIENT -->|HTTPS| LB_REDIRECT
    LB_REDIRECT -->|Redirect 301| LB_SSL
    CLIENT -->|HTTPS| LB_SSL

    LB_SSL -->|HTTP| API_HTTP
    API_HTTP -->|Private Network| DB_SSL

    style LB_SSL fill:#7ED321,stroke:#5FA019,color:#000
    style DB_SSL fill:#7ED321,stroke:#5FA019,color:#000
    style API_HTTP fill:#4A90E2,stroke:#2E5C8A,color:#fff
```

## Security Layers Summary

```mermaid
graph TB
    subgraph "Layer 1: Perimeter"
        L1[Load Balancer<br/>- SSL Termination<br/>- DDoS Protection<br/>- Rate Limiting]
    end

    subgraph "Layer 2: Network"
        L2[VPC + Firewalls<br/>- Private networking<br/>- IP whitelisting<br/>- Port restrictions]
    end

    subgraph "Layer 3: Host"
        L3[UFW + Fail2ban<br/>- Host-level firewall<br/>- Brute force protection<br/>- SSH hardening]
    end

    subgraph "Layer 4: Application"
        L4[API Security<br/>- JWT authentication<br/>- Input validation<br/>- Rate limiting<br/>- CORS policies]
    end

    subgraph "Layer 5: Data"
        L5[Encryption<br/>- TLS in transit<br/>- Encrypted at rest<br/>- Secret management<br/>- Database SSL]
    end

    L1 --> L2
    L2 --> L3
    L3 --> L4
    L4 --> L5

    style L1 fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style L2 fill:#7ED321,stroke:#5FA019,color:#000
    style L3 fill:#F5A623,stroke:#C77E1A,color:#000
    style L4 fill:#BD10E0,stroke:#8B0AA8,color:#fff
    style L5 fill:#50E3C2,stroke:#3AB09E,color:#000
```

## Attack Surface Minimization

| Component     | Public Access  | Authentication | Encryption            | Firewall           |
| ------------- | -------------- | -------------- | --------------------- | ------------------ |
| Load Balancer | ✅ HTTPS only  | N/A            | TLS 1.2+              | DigitalOcean       |
| API Droplets  | ❌ Via LB only | JWT tokens     | TLS to LB             | DigitalOcean + UFW |
| Database      | ❌ VPC only    | Password       | SSL/TLS               | DigitalOcean       |
| Redis         | ❌ VPC only    | Password       | N/A (trusted network) | DigitalOcean       |
| SSH Access    | ⚠️ Admin IPs   | SSH keys       | SSH protocol          | UFW + Fail2ban     |

## Security Monitoring & Alerts

```mermaid
graph TB
    subgraph "Security Events"
        SSH_FAIL[Failed SSH Attempts]
        HTTP_ATTACK[HTTP Attack Patterns]
        RESOURCE_ABUSE[Resource Abuse]
        HEALTH_FAIL[Health Check Failures]
    end

    subgraph "Detection"
        FAIL2BAN[Fail2ban]
        LB_LOGS[LB Access Logs]
        MON[DigitalOcean Monitoring]
        APP_LOGS[Application Logs]
    end

    subgraph "Response"
        AUTO_BAN[Automatic IP Ban]
        ALERT[Alert Notification]
        MANUAL[Manual Investigation]
    end

    SSH_FAIL --> FAIL2BAN
    FAIL2BAN --> AUTO_BAN

    HTTP_ATTACK --> LB_LOGS
    RESOURCE_ABUSE --> MON
    HEALTH_FAIL --> APP_LOGS

    LB_LOGS --> ALERT
    MON --> ALERT
    APP_LOGS --> ALERT

    ALERT --> MANUAL

    style AUTO_BAN fill:#D0021B,stroke:#9B0114,color:#fff
    style ALERT fill:#F5A623,stroke:#C77E1A,color:#000
    style MANUAL fill:#4A90E2,stroke:#2E5C8A,color:#fff
```

## Compliance & Best Practices

- ✅ **Principle of Least Privilege**: Services have minimal required permissions
- ✅ **Defense in Depth**: Multiple security layers
- ✅ **Network Segmentation**: VPC isolates resources
- ✅ **Encryption in Transit**: TLS for all external connections
- ✅ **SSH Hardening**: Key-only, no root, rate limiting
- ✅ **Secret Management**: No secrets in code or containers
- ✅ **Automated Updates**: Security patches applied automatically
- ✅ **Monitoring & Alerting**: Real-time security event detection
- ✅ **Audit Logging**: All access attempts logged
- ✅ **Incident Response**: Documented procedures in runbook
