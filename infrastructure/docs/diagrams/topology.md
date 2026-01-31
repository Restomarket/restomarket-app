# Infrastructure Topology Diagram

## Staging Environment Architecture

```mermaid
graph TB
    subgraph "Internet"
        Users[Users/Clients]
        DNS[DNS: staging-api.example.com]
    end

    subgraph "DigitalOcean - VPC 10.20.0.0/16"
        subgraph "Public Zone"
            LB[Load Balancer<br/>HTTPS:443 → 3001<br/>Health Check: /health]
        end

        subgraph "Private Network"
            API1[API Droplet 1<br/>s-2vcpu-4gb<br/>Docker + NestJS<br/>10.20.0.x:3001]
            API2[API Droplet 2<br/>s-2vcpu-4gb<br/>Docker + NestJS<br/>10.20.0.y:3001]

            DB[(PostgreSQL 16<br/>HA: 2 Nodes<br/>db-s-2vcpu-4gb<br/>Connection Pool)]

            REDIS[(Redis 7<br/>1 Node<br/>db-s-2vcpu-4gb<br/>AOF Persistence)]
        end

        subgraph "Monitoring"
            MON[DigitalOcean Monitoring<br/>Alerts: CPU, Memory, Disk, Load]
        end

        subgraph "Firewalls"
            FW_API[API Firewall<br/>SSH: Admin IPs only<br/>HTTP/HTTPS: LB only<br/>VPC: All traffic]
            FW_DB[Database Firewall<br/>PostgreSQL: VPC only]
        end
    end

    subgraph "External Services"
        GHCR[GitHub Container Registry<br/>Docker Images<br/>ghcr.io]
        SLACK[Slack<br/>Notifications]
    end

    Users -->|HTTPS| DNS
    DNS -->|HTTPS| LB
    LB -->|HTTP:3001| API1
    LB -->|HTTP:3001| API2

    API1 -.->|Private Network| DB
    API2 -.->|Private Network| DB
    API1 -.->|Private Network| REDIS
    API2 -.->|Private Network| REDIS

    FW_API -.->|Protects| API1
    FW_API -.->|Protects| API2
    FW_DB -.->|Protects| DB

    MON -.->|Monitors| API1
    MON -.->|Monitors| API2
    MON -.->|Alerts| SLACK

    API1 -->|Pull Images| GHCR
    API2 -->|Pull Images| GHCR

    style LB fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style API1 fill:#7ED321,stroke:#5FA019,color:#000
    style API2 fill:#7ED321,stroke:#5FA019,color:#000
    style DB fill:#F5A623,stroke:#C77E1A,color:#000
    style REDIS fill:#F5A623,stroke:#C77E1A,color:#000
    style MON fill:#BD10E0,stroke:#8B0AA8,color:#fff
    style FW_API fill:#D0021B,stroke:#9B0114,color:#fff
    style FW_DB fill:#D0021B,stroke:#9B0114,color:#fff
```

## Development Environment Architecture

```mermaid
graph TB
    subgraph "Internet"
        DevUsers[Developers]
        DNS_DEV[DNS: dev-api.example.com]
    end

    subgraph "DigitalOcean - VPC 10.10.0.0/16"
        subgraph "Public Zone"
            DEV_API[API Droplet<br/>s-1vcpu-1gb<br/>Docker + NestJS<br/>Port 3001]
        end

        subgraph "Private Network"
            DEV_DB[(PostgreSQL 16<br/>1 Node<br/>db-s-1vcpu-1gb)]

            DEV_REDIS[(Redis 7<br/>1 Node<br/>db-s-1vcpu-1gb)]
        end

        subgraph "Monitoring"
            DEV_MON[DigitalOcean Monitoring<br/>Basic Alerts]
        end

        subgraph "Firewalls"
            DEV_FW_API[API Firewall<br/>SSH: Admin IPs<br/>HTTP/HTTPS: All<br/>VPC: All traffic]
            DEV_FW_DB[Database Firewall<br/>PostgreSQL: VPC only]
        end
    end

    subgraph "External Services"
        GHCR_DEV[GitHub Container Registry<br/>Development Images]
    end

    DevUsers -->|HTTPS| DNS_DEV
    DNS_DEV -->|HTTP:3001| DEV_API

    DEV_API -.->|Private Network| DEV_DB
    DEV_API -.->|Private Network| DEV_REDIS

    DEV_FW_API -.->|Protects| DEV_API
    DEV_FW_DB -.->|Protects| DEV_DB

    DEV_MON -.->|Monitors| DEV_API

    DEV_API -->|Pull Images| GHCR_DEV

    style DEV_API fill:#7ED321,stroke:#5FA019,color:#000
    style DEV_DB fill:#F5A623,stroke:#C77E1A,color:#000
    style DEV_REDIS fill:#F5A623,stroke:#C77E1A,color:#000
    style DEV_MON fill:#BD10E0,stroke:#8B0AA8,color:#fff
    style DEV_FW_API fill:#D0021B,stroke:#9B0114,color:#fff
    style DEV_FW_DB fill:#D0021B,stroke:#9B0114,color:#fff
```

## Resource Costs

### Staging Environment (~$245/month)

- API Droplets: 2 × $24 = $48
- Database (HA): 2 × $60 = $120
- Redis: $60
- Load Balancer: $12
- Backups: ~$10
- Bandwidth: ~$5

### Development Environment (~$36/month)

- API Droplet: $6
- Database: $15
- Redis: $15
- Bandwidth: minimal

## Network Security

- **VPC Isolation**: All services communicate over private network
- **Firewall Rules**:
  - SSH access restricted to admin IPs only
  - API accessible only through load balancer (staging) or direct (dev)
  - Database/Redis accessible only from VPC
- **SSL/TLS**: All external connections encrypted
- **Health Checks**: Automatic unhealthy instance removal
