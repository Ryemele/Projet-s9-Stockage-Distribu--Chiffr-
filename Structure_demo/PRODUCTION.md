# Production Configuration

## Environment Variables

Required environment variables for production deployment:

```bash
# Server Configuration
NODE_ENV=production
PORT=3000

# Security
JWT_SECRET=<generate-256-bit-random-key>
JWT_EXPIRES_IN=24h
ALLOWED_ORIGINS=https://your-domain.com

# Database (PostgreSQL for production)
DATABASE_URL=postgres://user:password@host:5432/dbname

# Redis (for sessions and caching)
REDIS_URL=redis://host:6379

# Storage Nodes
STORAGE_NODE_1_URL=http://node1:4001
STORAGE_NODE_2_URL=http://node2:4002
STORAGE_NODE_3_URL=http://node3:4003
STORAGE_NODE_4_URL=http://node4:4004
STORAGE_NODE_5_URL=http://node5:4005
STORAGE_NODE_6_URL=http://node6:4006

# Encryption
ENCRYPTION_KEY=<256-bit-key-base64>
HSM_ENDPOINT=https://hsm.your-domain.com

# Monitoring
SENTRY_DSN=https://key@sentry.io/project
PROMETHEUS_ENABLED=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

## Docker Production Config

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  gateway:
    image: secure-storage-gateway:latest
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health/ready"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"
```

## Security Checklist

- [ ] Enable HTTPS with valid certificates (Let's Encrypt)
- [ ] Set secure JWT secret (min 256 bits)
- [ ] Enable rate limiting
- [ ] Configure CORS for production domains only
- [ ] Enable security headers (helmet)
- [ ] Set up WAF (Web Application Firewall)
- [ ] Enable audit logging
- [ ] Set up log rotation
- [ ] Configure backup encryption

## Monitoring Setup

### Prometheus Configuration
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'secure-storage'
    static_configs:
      - targets: ['gateway:3000']
    metrics_path: /health/metrics
```

### Grafana Dashboards
- Request latency (p50, p95, p99)
- Error rate
- Storage node health
- Encryption throughput
- Active connections

## Backup Strategy

1. **Database**: Daily full backup + hourly WAL archiving
2. **Encrypted files**: Replicated across 6 nodes with RS(4,2)
3. **Configuration**: Stored in encrypted secrets manager
4. **Logs**: Retained for 30 days, archived for 1 year
