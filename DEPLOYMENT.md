# Customer Management System - Docker Deployment Guide

## Prerequisites

- Docker Engine 20.10+ 
- Docker Compose v2+
- Minimum 2GB RAM (1GB allocated to Puppeteer for PDF generation)

## Quick Start

1. **Clone and prepare environment**:
   ```bash
   git clone <repository-url>
   cd customer-management-system
   cp .env.example .env
   ```

2. **Configure environment variables** in `.env`:
   ```bash
   # Required: Set secure database password
   DB_PASSWORD=your-secure-password-here
   
   # Required: Set secure session secret (min 32 chars)
   SESSION_SECRET=your-super-secret-session-key-minimum-32-characters
   
   # Required: USPS API credentials for address validation
   USPS_CLIENT_ID=your-usps-client-id
   USPS_CLIENT_SECRET=your-usps-client-secret
   
   # Required: Replit Auth configuration
   CLIENT_ID=your-replit-client-id
   CLIENT_SECRET=your-replit-client-secret
   ```

3. **Deploy the application**:
   ```bash
   docker-compose up -d
   ```

4. **Verify deployment**:
   ```bash
   # Check service status
   docker-compose ps
   
   # View logs
   docker-compose logs -f app
   
   # Test health endpoint
   curl http://localhost:5000/api/health
   ```

## Architecture

- **App Container**: Node.js application with TypeScript, Express, React frontend
- **Database Container**: PostgreSQL 15 with persistent storage
- **Networking**: Internal network for database security (database not exposed to host)
- **Volumes**: Named volumes for database and downloads (better permissions and portability)

## Production Configuration

### Security Hardening

1. **Database Security**:
   - Database is not exposed to host network (port 5432 commented out)
   - Use strong passwords and rotate regularly
   - Consider using Docker secrets in production

2. **Application Security**:
   - Non-root user in container (UID 1001)
   - Read-only root filesystem where possible
   - Minimal Alpine Linux base image

3. **Environment Variables**:
   - Never use default values in production
   - Use external secret management (AWS Secrets Manager, HashiCorp Vault, etc.)
   - Rotate API keys and session secrets regularly

### Performance Optimization

1. **Puppeteer Configuration**:
   - 1GB shared memory allocated for PDF generation
   - Chrome flags optimized for containerized environments
   - Headless mode for efficiency

2. **Resource Limits** (add to docker-compose.yml if needed):
   ```yaml
   deploy:
     resources:
       limits:
         memory: 2G
         cpus: '1.0'
   ```

### Monitoring and Health Checks

- **Application Health**: `/api/health` endpoint
- **Database Health**: PostgreSQL readiness check
- **Logs**: Centralized logging via Docker logging drivers

## Backup and Recovery

### Database Backup
```bash
# Create backup
docker-compose exec db pg_dump -U postgres customer_management > backup.sql

# Restore backup
docker-compose exec -T db psql -U postgres customer_management < backup.sql
```

### Application Data Backup
```bash
# Backup downloads volume
docker run --rm -v customer-management-system_downloads_data:/data -v $(pwd):/backup alpine tar czf /backup/downloads-backup.tar.gz -C /data .

# Restore downloads volume
docker run --rm -v customer-management-system_downloads_data:/data -v $(pwd):/backup alpine tar xzf /backup/downloads-backup.tar.gz -C /data
```

## Troubleshooting

### Common Issues

1. **Puppeteer PDF Generation Fails**:
   ```bash
   # Check shared memory
   docker-compose logs app | grep -i "shm\|chrome\|sandbox"
   
   # Increase shm_size if needed
   shm_size: 2gb
   ```

2. **Database Connection Issues**:
   ```bash
   # Check database logs
   docker-compose logs db
   
   # Verify environment variables
   docker-compose config
   ```

3. **Port Conflicts**:
   ```bash
   # Change port mapping in docker-compose.yml
   ports:
     - "8080:5000"  # Use different host port
   ```

### Maintenance Commands

```bash
# Update application
docker-compose pull
docker-compose up -d --force-recreate

# Clean up
docker-compose down
docker system prune -f

# View resource usage
docker stats

# Scale services (if needed)
docker-compose up -d --scale app=2
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_PASSWORD` | Yes | PostgreSQL database password |
| `SESSION_SECRET` | Yes | Session encryption key (min 32 chars) |
| `USPS_CLIENT_ID` | Yes | USPS API client ID for address validation |
| `USPS_CLIENT_SECRET` | Yes | USPS API client secret |
| `CLIENT_ID` | Yes | Replit Auth client ID |
| `CLIENT_SECRET` | Yes | Replit Auth client secret |
| `ISSUER_URL` | No | OIDC issuer URL (default: https://replit.com) |

## Support

For issues and questions:
1. Check application logs: `docker-compose logs app`
2. Check database logs: `docker-compose logs db`
3. Verify environment configuration: `docker-compose config`
4. Test individual services: `docker-compose up db` then `docker-compose up app`