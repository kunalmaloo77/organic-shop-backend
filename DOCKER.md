# Organic Shop Backend - Docker Setup

This document provides instructions for setting up the Organic Shop Backend using Docker.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 22+ (for local development)

## Quick Start

### 1. Environment Setup

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and add your actual credentials for:

- MongoDB passwords
- Redis password
- JWT secret
- AWS S3 credentials
- Google OAuth credentials
- Razorpay credentials

### 2. Start Services

**Production Mode:**

```bash
docker-compose up -d
```

**Development Mode (with hot-reload):**

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### 3. View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f mongodb
docker-compose logs -f redis
```

### 4. Stop Services

```bash
docker-compose down
```

**Stop and remove volumes (⚠️ deletes all data):**

```bash
docker-compose down -v
```

## Docker Commands

### Build and Start

```bash
# Build images
docker-compose build

# Start services in background
docker-compose up -d

# Start services with logs
docker-compose up
```

### Service Management

```bash
# Restart a service
docker-compose restart backend

# Stop a service
docker-compose stop backend

# Start a stopped service
docker-compose start backend

# Remove containers
docker-compose down
```

### Debugging

```bash
# Access backend container shell
docker-compose exec backend sh

# Access MongoDB shell
docker-compose exec mongodb mongosh -u admin -p admin123

# Access Redis CLI
docker-compose exec redis redis-cli -a redis123

# Check service status
docker-compose ps

# View resource usage
docker stats
```

### Database Operations

**MongoDB:**

```bash
# Backup database
docker-compose exec mongodb mongodump --uri="mongodb://admin:admin123@localhost:27017/organic_shop?authSource=admin" --out=/data/backup

# Restore database
docker-compose exec mongodb mongorestore --uri="mongodb://admin:admin123@localhost:27017/organic_shop?authSource=admin" /data/backup
```

**Redis:**

```bash
# Flush all Redis data
docker-compose exec redis redis-cli -a redis123 FLUSHALL

# Check Redis info
docker-compose exec redis redis-cli -a redis123 INFO
```

## Service Ports

- **Backend API**: http://localhost:8080
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379

## Health Checks

- Backend: http://localhost:8080/health
- MongoDB: Built-in health check in docker-compose
- Redis: Built-in health check in docker-compose

## Troubleshooting

### Backend can't connect to MongoDB

- Ensure MongoDB container is healthy: `docker-compose ps`
- Check MongoDB logs: `docker-compose logs mongodb`
- Verify connection string in `.env` uses `mongodb` as hostname (not `localhost`)

### Backend can't connect to Redis

- Ensure Redis container is healthy: `docker-compose ps`
- Check Redis logs: `docker-compose logs redis`
- Verify Redis URL in `.env` uses `redis` as hostname (not `localhost`)

### Port already in use

```bash
# Find process using the port (Windows PowerShell)
Get-NetTCPConnection -LocalPort 3000

# Stop the service or change port in .env
```

### Reset everything

```bash
# Stop and remove all containers, networks, and volumes
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# Start fresh
docker-compose up --build
```
