# PingUp — Production Deployment & Operations Runbook

This runbook provides complete operational procedures for deploying, maintaining, and monitoring PingUp in a production public-internet environment.

---

## 1. Production Architecture Overview

```
                                      Internet / Clients
                                              │
                                   ┌──────────▼──────────┐
                                   │   HTTPS / WSS DNS   │
                                   │   (Cloudflare / DNS)│
                                   └──────────┬──────────┘
                                              │
                               ┌──────────────▼──────────────┐
                               │  Nginx Edge Reverse Proxy   │
                               │  (TLS Term, Port 80 / 443)  │
                               └───────┬──────────────┬──────┘
                                       │              │
                       /api, /socket.io│              │ / (Static SPA)
                                       ▼              ▼
                       ┌──────────────────────┐   ┌──────────────────────┐
                       │    PingUp Backend    │   │   PingUp Frontend    │
                       │    (Node.js 20)      │   │    (Nginx Alpine)    │
                       │   Container :5000    │   │    Container :80     │
                       └───────┬──────────┬───┘   └──────────────────────┘
                               │          │
                 ┌─────────────▼──┐    ┌──▼────────────┐
                 │ PostgreSQL 16  │    │    Redis 7    │
                 │ Persistent DB  │    │ Presence & Pub│
                 └────────────────┘    └───────────────┘
                                              ▲
                                              │ UDP/TCP 3478, 5349
                                   ┌──────────┴──────────┐
                                   │ Coturn TURN Relay   │
                                   │ Ports 49152-49170   │
                                   └─────────────────────┘
```

---

## 2. Infrastructure Options & Estimated Monthly Recurring Costs (in INR)

### Option A: Unified Single-VPS Container Architecture (Recommended for Low Maintenance & High Performance)
* **Compute**: 1x Ubuntu 24.04 LTS VPS (2 vCPU, 4GB RAM, 40GB NVMe, 1 Dedicated Public IPv4) via Hetzner Cloud / DigitalOcean / AWS Lightsail.
  - Runs Nginx, Backend, Frontend, PostgreSQL 16, Redis 7, and Coturn on Docker Compose.
  - Cost: **~₹750 to ₹1,100 INR / month** ($9 - $13 USD/mo).
* **Private Media Storage**: Cloudflare R2 (10 GB storage free, zero egress fees) or AWS S3.
  - Cost: **~₹0 to ₹250 INR / month**.
* **Domain & DNS**: Cloudflare DNS (Free tier) with universal SSL.
* **Firebase Phone Authentication**: 10,000 free verifications / month (Firebase Spark plan).
* **Total Estimated Recurring Cost**: **~₹800 to ₹1,350 INR / month**.

### Option B: Fully Managed PaaS Architecture (Railway / Render + Managed DB)
* **Frontend**: Cloudflare Pages / Vercel (Free tier: ₹0).
* **Backend**: Railway / Render Web Service (1 vCPU, 2GB RAM): **~₹1,200 to ₹1,650 INR / month**.
* **Managed Database**: Supabase / Neon / Render Managed PostgreSQL: **~₹1,250 to ₹2,100 INR / month**.
* **Managed Redis**: Upstash Redis (Free tier up to 10k commands/day or ~₹800 INR / month).
* **Coturn TURN Server**: 1 Small Droplet / EC2 instance with public IP: **~₹450 to ₹650 INR / month**.
* **Private Media Storage**: Cloudflare R2 / AWS S3: **~₹250 INR / month**.
* **Total Estimated Recurring Cost**: **~₹3,150 to ₹5,450 INR / month**.

---

## 3. Step-by-Step Deployment Guide (Windows CMD)

### Step 1: Local Verification Before Deployment
```cmd
cd D:\Atti

:: 1. Verify 192 automated unit & integration tests pass 100%
npm test

:: 2. Verify clean production builds
npm run build
```

### Step 2: Prepare Production Environment
1. Copy `.env.production.example` to `.env.production`:
   ```cmd
   copy .env.production.example .env.production
   ```
2. Populate the real production values:
   - Generate strong passwords for `POSTGRES_PASSWORD` and `REDIS_PASSWORD`:
     ```cmd
     powershell -Command "[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))"
     ```
   - Generate Coturn TURN secret:
     ```cmd
     powershell -Command "[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 })).ToLower()"
     ```
   - Generate Web Push VAPID keys:
     ```cmd
     npx web-push generate-vapid-keys
     ```
   - Paste Firebase Admin service account credentials.

### Step 3: Server Provisioning & Docker Deployment
On the target production Ubuntu server (or local Docker test environment):
```bash
# 1. Clone repository or pull main branch
git clone https://github.com/your-org/pingup.git /opt/pingup
cd /opt/pingup

# 2. Place secure .env file (ensure 600 permissions)
chmod 600 .env

# 3. Pull base images and build containers
docker-compose -f docker-compose.prod.yml build

# 4. Start database and redis first
docker-compose -f docker-compose.prod.yml up -d postgres redis

# 5. Wait for database readiness and apply non-destructive Prisma migrations
docker-compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy

# 6. Launch all remaining containers (Backend, Frontend, Coturn, Nginx)
docker-compose -f docker-compose.prod.yml up -d
```

---

## 4. Production Database Backup & Recovery Runbook

### Automated Daily Backup Script (`backup-db.sh`)
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/pingup"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/pingup_backup_$TIMESTAMP.sql.gz"

mkdir -p $BACKUP_DIR

# Dump database through running postgres container
docker exec pingup_postgres pg_dump -U pingup_admin pingup_production | gzip > $FILENAME

# Keep 14 days of backups locally
find $BACKUP_DIR -name "*.sql.gz" -mtime +14 -exec rm {} \;

echo "Backup completed: $FILENAME"
```

### Disaster Recovery / Restore Procedure
```bash
# To restore from a verified backup:
gunzip < /var/backups/pingup/pingup_backup_20261106_120000.sql.gz | docker exec -i pingup_postgres psql -U pingup_admin -d pingup_production
```

---

## 5. Domain, DNS & TLS Certificate Setup

1. **DNS A Records**:
   - `pingup.yourdomain.com` -> `<Server_Public_IPv4>`
   - `turn.yourdomain.com` -> `<Server_Public_IPv4>`
2. **Obtain Free SSL Certificate via Let's Encrypt**:
   ```bash
   certbot certonly --standalone -d pingup.yourdomain.com -d turn.yourdomain.com
   ```
3. **Firebase Console Configuration**:
   - Navigate to Firebase Console > Authentication > Settings > Authorized domains.
   - Add `pingup.yourdomain.com` to the authorized domains list.

---

## 6. Verification Checklist for Go-Live

* [ ] `GET https://pingup.yourdomain.com/health` returns `200 OK`.
* [ ] `GET https://pingup.yourdomain.com/ready` returns `200 OK` (verifies PostgreSQL and Redis connectivity).
* [ ] WebSocket connects with TLS (`wss://pingup.yourdomain.com/socket.io/`).
* [ ] Firebase Phone Auth OTP delivers SMS and authenticates successfully.
* [ ] Private S3 upload issues presigned URL and successfully displays media thumbnail.
* [ ] WebRTC voice and video calls connect across different networks (e.g. mobile 4G/5G vs WiFi).
* [ ] Web Push notification arrives on locked screen when a background message is received.

