# Deployment Flow Diagram

## Blue-Green Deployment Strategy

```mermaid
sequenceDiagram
    participant GH as GitHub Actions
    participant GHCR as GitHub Container Registry
    participant DROP as Droplet
    participant BLUE as api-blue Container
    participant GREEN as api-green Container
    participant LB as Load Balancer
    participant HEALTH as /health Endpoint

    Note over GH,HEALTH: Step 1: Build & Push Image

    GH->>GH: Build Docker image
    GH->>GH: Tag with sha-abc1234
    GH->>GHCR: Push image
    GH->>GHCR: docker push ghcr.io/owner/api:sha-abc1234

    Note over GH,HEALTH: Step 2: Deploy to Droplet

    GH->>DROP: SSH deploy.sh sha-abc1234 staging
    DROP->>GHCR: Pull new image
    GHCR-->>DROP: Return image

    Note over DROP,GREEN: Step 3: Determine Current State

    DROP->>DROP: Check running containers
    alt Green is running
        Note over DROP: Deploy to Blue
        DROP->>BLUE: Start api-blue
        BLUE->>BLUE: Wait 10 seconds
    else Blue is running
        Note over DROP: Deploy to Green
        DROP->>GREEN: Start api-green
        GREEN->>GREEN: Wait 10 seconds
    end

    Note over DROP,HEALTH: Step 4: Health Check (60s timeout)

    loop Every 5 seconds
        DROP->>HEALTH: GET /health
        alt Health check passes
            HEALTH-->>DROP: 200 OK
            Note over DROP: Health check passed
        else Health check fails
            HEALTH-->>DROP: Non-200 or timeout
            Note over DROP: Retry...
        end
    end

    alt Health checks pass
        Note over DROP,LB: Step 5: Switch Traffic

        DROP->>GREEN: docker stop api-green (graceful)
        Note over GREEN: SIGTERM sent, 10s grace period
        GREEN-->>DROP: Container stopped

        DROP->>GREEN: docker rm api-green
        Note over DROP: Old container removed

        LB->>BLUE: Route traffic to api-blue
        Note over BLUE,LB: Zero downtime achieved

        DROP->>DROP: Cleanup old images (keep 5)

        DROP-->>GH: ✅ Deployment successful

    else Health checks fail
        Note over DROP,HEALTH: Step 6: Rollback

        DROP->>BLUE: docker stop api-blue
        DROP->>BLUE: docker rm api-blue
        DROP->>GREEN: docker start api-green
        Note over GREEN: Old container restored

        DROP-->>GH: ❌ Deployment failed, rolled back
    end

    Note over GH: Step 7: Notifications

    alt Success
        GH->>GH: Notify Slack (success)
    else Failure
        GH->>GH: Notify Slack (failure + rollback)
    end
```

## Normal Deployment Flow (Success Path)

```mermaid
flowchart TD
    START[Start Deployment] --> PULL[Pull Docker Image<br/>ghcr.io/owner/api:sha-abc1234]

    PULL --> DETECT{Detect Current<br/>Container}

    DETECT -->|api-green running| START_BLUE[Start api-blue<br/>Port 3001<br/>Environment: staging]
    DETECT -->|api-blue running| START_GREEN[Start api-green<br/>Port 3001<br/>Environment: staging]
    DETECT -->|First deployment| START_BLUE

    START_BLUE --> WAIT_BLUE[Wait 10s<br/>Initial startup]
    START_GREEN --> WAIT_GREEN[Wait 10s<br/>Initial startup]

    WAIT_BLUE --> HEALTH_BLUE{Health Check Loop<br/>Max 60s, every 5s}
    WAIT_GREEN --> HEALTH_GREEN{Health Check Loop<br/>Max 60s, every 5s}

    HEALTH_BLUE -->|200 OK| STOP_GREEN[Stop api-green<br/>SIGTERM + 10s grace]
    HEALTH_GREEN -->|200 OK| STOP_BLUE[Stop api-blue<br/>SIGTERM + 10s grace]

    STOP_GREEN --> REMOVE_GREEN[Remove api-green<br/>docker rm]
    STOP_BLUE --> REMOVE_BLUE[Remove api-blue<br/>docker rm]

    REMOVE_GREEN --> CLEANUP[Cleanup Old Images<br/>Keep last 5]
    REMOVE_BLUE --> CLEANUP

    CLEANUP --> VERIFY{Verify<br/>Deployment}

    VERIFY -->|Success| NOTIFY_SUCCESS[✅ Notify Slack<br/>Deployment successful]
    VERIFY -->|Failure| ROLLBACK[Trigger Rollback]

    NOTIFY_SUCCESS --> END[End Deployment]

    style START fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style START_BLUE fill:#50E3C2,stroke:#3AB09E,color:#000
    style START_GREEN fill:#7ED321,stroke:#5FA019,color:#000
    style HEALTH_BLUE fill:#F5A623,stroke:#C77E1A,color:#000
    style HEALTH_GREEN fill:#F5A623,stroke:#C77E1A,color:#000
    style CLEANUP fill:#BD10E0,stroke:#8B0AA8,color:#fff
    style NOTIFY_SUCCESS fill:#7ED321,stroke:#5FA019,color:#000
    style ROLLBACK fill:#D0021B,stroke:#9B0114,color:#fff
    style END fill:#4A90E2,stroke:#2E5C8A,color:#fff
```

## Rollback Flow

```mermaid
flowchart TD
    TRIGGER[Rollback Triggered] --> LIST{List Available<br/>Images}

    LIST --> SELECT[Select Previous Version<br/>sha-abc1234 or tag]

    SELECT --> VERIFY_IMG{Image<br/>Exists?}

    VERIFY_IMG -->|No| ERROR_IMG[❌ Error: Image not found]
    VERIFY_IMG -->|Yes| CONFIRM{User<br/>Confirmation}

    CONFIRM -->|No| CANCEL[Cancel Rollback]
    CONFIRM -->|Yes| PULL_OLD[Pull Previous Image]

    PULL_OLD --> DEPLOY_OLD[Deploy with Blue-Green<br/>Same as normal deployment]

    DEPLOY_OLD --> HEALTH_OLD{Health Check}

    HEALTH_OLD -->|Pass| SUCCESS_ROLLBACK[✅ Rollback Successful<br/>Previous version restored]
    HEALTH_OLD -->|Fail| FAIL_ROLLBACK[❌ Rollback Failed<br/>Manual intervention required]

    SUCCESS_ROLLBACK --> NOTIFY_SUCCESS_RB[Notify Team<br/>Rollback successful]
    FAIL_ROLLBACK --> NOTIFY_FAIL_RB[Alert Team<br/>Manual recovery needed]

    style TRIGGER fill:#F5A623,stroke:#C77E1A,color:#000
    style DEPLOY_OLD fill:#BD10E0,stroke:#8B0AA8,color:#fff
    style SUCCESS_ROLLBACK fill:#7ED321,stroke:#5FA019,color:#000
    style FAIL_ROLLBACK fill:#D0021B,stroke:#9B0114,color:#fff
    style ERROR_IMG fill:#D0021B,stroke:#9B0114,color:#fff
```

## Deployment Methods Comparison

```mermaid
graph TB
    subgraph "Method 1: GitHub Actions (Recommended)"
        M1_START[Push to develop/main] --> M1_CI[CI/CD Pipeline<br/>All quality checks]
        M1_CI --> M1_BUILD[Build & Push Image]
        M1_BUILD --> M1_DEPLOY[Auto Deploy via SSH]
        M1_DEPLOY --> M1_HEALTH[Health Check]
        M1_HEALTH -->|Pass| M1_SUCCESS[✅ Success]
        M1_HEALTH -->|Fail| M1_ROLLBACK[Auto Rollback]
    end

    subgraph "Method 2: Manual SSH"
        M2_START[SSH to droplet] --> M2_PULL[Pull image manually]
        M2_PULL --> M2_SCRIPT[Run deploy.sh]
        M2_SCRIPT --> M2_HEALTH[Health Check]
        M2_HEALTH -->|Pass| M2_SUCCESS[✅ Success]
        M2_HEALTH -->|Fail| M2_MANUAL_RB[Manual Rollback]
    end

    subgraph "Method 3: Ansible"
        M3_START[Local Machine] --> M3_PLAYBOOK[ansible-playbook<br/>update-api.yml]
        M3_PLAYBOOK --> M3_TASKS[Ansible Tasks<br/>Pull + Deploy + Health]
        M3_TASKS --> M3_HEALTH[Health Check]
        M3_HEALTH -->|Pass| M3_SUCCESS[✅ Success]
        M3_HEALTH -->|Fail| M3_AUTO_RB[Auto Rollback]
    end

    style M1_SUCCESS fill:#7ED321,stroke:#5FA019,color:#000
    style M2_SUCCESS fill:#7ED321,stroke:#5FA019,color:#000
    style M3_SUCCESS fill:#7ED321,stroke:#5FA019,color:#000
    style M1_ROLLBACK fill:#F5A623,stroke:#C77E1A,color:#000
    style M2_MANUAL_RB fill:#D0021B,stroke:#9B0114,color:#fff
    style M3_AUTO_RB fill:#F5A623,stroke:#C77E1A,color:#000
```

## Zero-Downtime Guarantee

```mermaid
timeline
    title Zero-Downtime Deployment Timeline
    section Old Version (Green)
        Serving traffic : 100% traffic
        Health check passing : Load balancer routes traffic
    section New Version (Blue) Startup
        Container starting : 10s initial wait
        Health checks : 5s × 12 attempts = 60s max
        Ready to serve : Health endpoint returns 200
    section Traffic Switch
        Both containers running : Green still serving 100%
        New container validated : Blue passed health checks
        Graceful shutdown : Green receives SIGTERM
        Load balancer updated : Traffic routes to Blue
        Zero requests dropped : Seamless transition
    section New Version (Blue)
        Serving traffic : 100% traffic
        Health check passing : Load balancer routes traffic
```

## Health Check Flow

```mermaid
stateDiagram-v2
    [*] --> Starting: Container started

    Starting --> WaitingStartup: Wait 10 seconds
    WaitingStartup --> FirstCheck: Initial stabilization

    FirstCheck --> HealthCheck: GET /health
    HealthCheck --> CheckResponse: Evaluate response

    CheckResponse --> Healthy: HTTP 200 + valid JSON
    CheckResponse --> Retry: Non-200 or timeout
    CheckResponse --> Unhealthy: Max retries exceeded

    Retry --> HealthCheck: Wait 5s, try again
    Retry --> Unhealthy: After 12 attempts (60s)

    Healthy --> SwitchTraffic: Stop old container
    SwitchTraffic --> [*]: Deployment complete

    Unhealthy --> Rollback: Stop new container
    Rollback --> RestoreOld: Start old container
    RestoreOld --> [*]: Deployment failed
```

## Deployment Artifacts & Logs

```mermaid
graph TD
    subgraph "GitHub Actions"
        WF[Workflow Run] --> LOGS[Workflow Logs<br/>30 days retention]
        WF --> ARTIFACTS[Build Artifacts<br/>7 days retention]
    end

    subgraph "Container Registry"
        GHCR_IMG[Docker Images<br/>ghcr.io/owner/api]
        GHCR_IMG --> TAGS[Tags:<br/>sha-*, branch, latest]
        TAGS --> RETENTION[Retention: 5 most recent]
    end

    subgraph "Droplet"
        DROP_LOGS[Application Logs<br/>/var/log/api.log]
        DROP_LOGS --> ROTATION[Rotation: 10MB × 3]

        DEPLOY_LOGS[Deployment Logs<br/>/var/log/deploy-*.log]
        ROLLBACK_LOGS[Rollback Logs<br/>/var/log/rollback-*.log]
    end

    subgraph "Monitoring"
        MON[DigitalOcean Monitoring<br/>Metrics + Alerts]
        SLACK[Slack Notifications<br/>Success/Failure]
    end

    WF --> DROP_LOGS
    GHCR_IMG --> DROP_LOGS
    DROP_LOGS --> MON
    WF --> SLACK

    style WF fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style GHCR_IMG fill:#BD10E0,stroke:#8B0AA8,color:#fff
    style DROP_LOGS fill:#F5A623,stroke:#C77E1A,color:#000
    style MON fill:#7ED321,stroke:#5FA019,color:#000
```

## Deployment Time Breakdown

| Phase                   | Time           | Cumulative        |
| ----------------------- | -------------- | ----------------- |
| Pull Docker image       | 30-60s         | 0:30-1:00         |
| Start new container     | 10s            | 0:40-1:10         |
| Health checks (typical) | 15-20s         | 1:00-1:30         |
| Stop old container      | 10s            | 1:10-1:40         |
| Cleanup                 | 5-10s          | 1:15-1:50         |
| **Total**               | **~2 minutes** | **Success path**  |
| Rollback (if needed)    | +1-2 minutes   | **Recovery time** |
