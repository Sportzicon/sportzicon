# pgAdmin 4 - Cloud SQL Management Guide

## Overview

pgAdmin is a free, open-source PostgreSQL admin tool. Perfect for managing your GCP Cloud SQL database.

---

## Installation Options

### Option 1: Local Docker (Recommended - 5 minutes)

```bash
docker run -p 5050:80 \
  --name pgadmin \
  -e PGADMIN_DEFAULT_EMAIL=admin@sportivox.local \
  -e PGADMIN_DEFAULT_PASSWORD=admin123 \
  -d dpage/pgadmin4
```

Access: `http://localhost:5050`

### Option 2: Direct Installation

#### macOS
```bash
brew install pgadmin4
brew services start pgadmin4
```

#### Ubuntu/Debian
```bash
sudo apt install pgadmin4
sudo systemctl start pgadmin4
```

#### Windows
Download from: https://www.pgadmin.org/download/

### Option 3: Cloud - Use pgAdmin Cloud

Visit: https://pgadmin.io/pgadmin-cloud/

---

## Connect pgAdmin to Cloud SQL

### Step 1: Get Cloud SQL Connection Details

```bash
# Get public IP
PUBLIC_IP=$(gcloud sql instances describe sportivox-postgres-prod \
  --format='value(ipAddresses[0].ipAddress)')

# Get connection string
echo "Host: $PUBLIC_IP"
echo "Port: 5432"
echo "Database: sportivox"
echo "Username: sportivox"
echo "Password: (the one you created)"
```

### Step 2: Open pgAdmin

1. Go to: `http://localhost:5050` (if using Docker)
2. Login:
   - Email: `admin@sportivox.local`
   - Password: `admin123`

### Step 3: Register Cloud SQL Server

1. Right-click **Servers** → Select **Register** → **Server**

2. **General Tab:**
   - Name: `Sportivox Cloud SQL`

3. **Connection Tab:**
   - Host name/address: `PUBLIC_IP` (from above)
   - Port: `5432`
   - Maintenance database: `postgres`
   - Username: `sportivox`
   - Password: `YOUR_PASSWORD`
   - Save password?: ✓ Yes

4. **SSL Tab:**
   - SSL mode: `Require` (Cloud SQL requires SSL)

5. Click **Save**

---

## Using pgAdmin

### View Databases

1. **Servers** → **Sportivox Cloud SQL** → **Databases**
2. You should see:
   - `sportivox` (your app database)
   - `postgres` (system database)

### View Tables

1. **Servers** → **Sportivox Cloud SQL** → **Databases** → **sportivox** → **Schemas** → **public** → **Tables**
2. All Prisma tables appear here

### Run SQL Queries

1. **Tools** → **Query Tool**
2. Or right-click database → **Query Tool**

```sql
-- Example: Count users
SELECT COUNT(*) FROM "User";

-- Example: List all tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

### Backup Database

1. Right-click database → **Backup**
2. Choose location to save `.backup` file
3. This is separate from Cloud SQL automated backups

### Restore Database

1. Right-click database → **Restore**
2. Select the `.backup` file
3. Confirm

### Create Users

1. Right-click **Login/Group Roles** → **Create** → **Login/Group Role**
2. Name: `new_user`
3. Password: (set password)
4. Privileges: (assign as needed)

### Create Backups (Additional)

```sql
-- Via query tool
BACKUP DATABASE sportivox TO DISK = '/path/to/backup.bak';
```

---

## Common Tasks

### View User Accounts

```sql
SELECT * FROM pg_user;
```

### Change User Password

```sql
ALTER USER sportivox WITH PASSWORD 'new_password';
```

### View Database Size

```sql
SELECT 
  datname,
  pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database
ORDER BY pg_database_size(datname) DESC;
```

### View Table Sizes

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Active Connections

```sql
SELECT 
  datname,
  count(*) as connections
FROM pg_stat_activity
GROUP BY datname;
```

### Kill Long-Running Queries

```sql
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- Kill a specific query
SELECT pg_terminate_backend(pid);
```

---

## Security Configuration

### Change Default Credentials

**In pgAdmin UI:**

1. Click **admin@sportivox.local** (top right)
2. Select **User Management**
3. Edit user
4. Change password
5. Save

### Use SSL Certificate

Already configured in connection settings:
- SSL mode: `Require`
- pgAdmin validates Cloud SQL SSL certificate

### Create Separate pgAdmin Users

For team members:

1. **Administration** → **User Management**
2. Click **New User**
3. Email: `team@sportivox.local`
4. Password: (set)
5. Role: `User` or `Administrator`

---

## Backup & Recovery Workflow

### Automated Backups (Cloud SQL)

Already running:
```bash
gcloud sql backups list --instance=sportivox-postgres-prod
```

### Manual Backups (pgAdmin)

1. Right-click **sportivox** database
2. Select **Backup**
3. Save location: `/backups/sportivox-$(date +%Y%m%d).backup`
4. Format: `Custom` (allows restore to different versions)

### Restore Backup

```bash
# Via command line
pg_restore --host=$IP --user=sportivox --dbname=sportivox /path/to/backup.backup
```

Or via pgAdmin UI:
1. Right-click database
2. Select **Restore**
3. Choose backup file
4. Confirm

---

## Monitoring with pgAdmin

### Server Statistics

1. Right-click server → **Properties**
2. Click **Statistics** tab
3. View:
   - Connections
   - Transactions
   - Memory usage
   - CPU usage

### Long-Running Queries

```sql
SELECT 
  pid,
  usename,
  query_start,
  query,
  state
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start DESC;
```

### Lock Monitoring

```sql
SELECT 
  l.pid,
  l.usename,
  l.application_name,
  l.state,
  a.query
FROM pg_stat_activity l
WHERE l.query != '<IDLE>'
ORDER BY l.query_start;
```

---

## Docker Compose Integration

Add to `docker-compose.yml`:

```yaml
pgadmin:
  image: dpage/pgadmin4:latest
  ports:
    - "5050:80"
  environment:
    PGADMIN_DEFAULT_EMAIL: admin@sportivox.local
    PGADMIN_DEFAULT_PASSWORD: admin123
    PGADMIN_CONFIG_ENHANCED_MONITORING_ENABLED: "true"
  volumes:
    - pgadmin_data:/var/lib/pgadmin
  depends_on:
    - postgres  # if postgres is also in docker-compose

volumes:
  pgadmin_data:
```

Then:
```bash
docker-compose up pgadmin
# Access at http://localhost:5050
```

---

## Advanced Features

### Alerts

1. **Tools** → **Alerts**
2. Create alert for:
   - High connection count
   - Slow queries
   - Disk space
   - High CPU

### Reports

1. **Reports** → Create custom reports
2. View:
   - Disk usage
   - Connections
   - Queries
   - Performance

### Query History

1. **Tools** → **Query Tool**
2. View history of previous queries
3. Helpful for reusing complex queries

### Import/Export

**Export data:**
1. Right-click table → **Export**
2. Format: CSV, JSON, SQL
3. Download file

**Import data:**
1. Create target table first
2. Right-click table → **Import**
3. Select CSV/JSON file
4. Map columns
5. Confirm

---

## Troubleshooting

### "Server doesn't accept remote connection"

**Solution:** Cloud SQL requires SSL

In pgAdmin connection:
- SSL mode: `Require` (not Prefer)
- Verify IP whitelisting

### "FATAL: password authentication failed"

**Solution:** Check credentials

```bash
# Verify user exists
gcloud sql users list --instance=sportivox-postgres-prod

# Reset password
gcloud sql users set-password sportivox \
  --instance=sportivox-postgres-prod \
  --password=NEW_PASSWORD
```

### "Could not connect to server: does not compute"

**Solution:** Check Cloud SQL instance is running

```bash
gcloud sql instances describe sportivox-postgres-prod \
  --format='value(state)'
# Should return: RUNNABLE
```

### Slow queries

**Solution:** Check query and indexes

```sql
-- Enable query profiling
EXPLAIN ANALYZE SELECT * FROM "User";

-- Create index if needed
CREATE INDEX idx_user_email ON "User"(email);
```

---

## Best Practices

✅ **Do:**
- Use SSL for all connections
- Change default pgAdmin password
- Keep pgAdmin updated
- Backup before major changes
- Use descriptive names for objects
- Monitor long-running queries
- Set up alerts

❌ **Don't:**
- Share pgAdmin credentials
- Run DELETE without WHERE
- Drop production tables
- Ignore Cloud SQL backups
- Leave pgAdmin open on public internet

---

## Quick Reference

| Task | Steps |
|------|-------|
| View data | Servers → DB → Tables → Data |
| Run query | Tools → Query Tool → SQL |
| Backup DB | Right-click DB → Backup |
| Restore DB | Right-click DB → Restore |
| Create user | Admin → Users → New |
| Change password | User menu → Settings |
| View logs | Tools → Server Log |
| Check size | Query Tool → Run SQL |

---

## Integration with CI/CD

pgAdmin can be part of your development environment:

```bash
# Start locally with docker-compose
docker-compose up -d pgadmin

# Point to Cloud SQL
# Connect in pgAdmin UI
# Monitor from local machine
```

---

## Summary

✅ **Setup:**
- Docker: 5 minutes
- Connect to Cloud SQL: 5 minutes
- Start managing: immediate

✅ **Features:**
- Browse data
- Run queries
- Create backups
- Manage users
- Monitor performance

✅ **Security:**
- SSL encryption
- User authentication
- Role-based access
- Audit logging

**pgAdmin is now your database admin interface!** 🎉

