# ShopFloor.ro — Architecture & Development Guide

## For Claude Code: Use this document as the primary reference when developing this project.

---

## 1. Vision

ShopFloor.ro is a shop floor digitalization SaaS that replaces paper-based production reporting in Romanian industrial SMEs (50-500 employees). Each customer gets their own hosted instance (single-tenant).

**Core modules (MVP):**
1. **Production Reporting** — Operators report pieces produced, scrap, and reasons per shift/machine/order
2. **OEE Dashboard** — Real-time OEE (Availability × Performance × Quality) per machine, line, shift
3. **Checklists** — Configurable checklists for start-of-shift, quality checks, 5S
4. **Maintenance Requests** — Operators submit requests with photo, maintenance team tracks resolution
5. **Shift Handover** — Digital shift log replacing paper-based handover

**Future modules (post-MVP):**
- Inventory/Stock tracking
- Tool management
- Quality control (SPC, measurement logging)
- Digital work instructions
- Downtime Pareto analysis

---

## 2. Architecture Overview

```
                    ┌─────────────────────┐
                    │    Nginx Reverse     │
                    │       Proxy          │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼──────┐ ┌──────▼───────┐ ┌──────▼──────┐
    │  Frontend       │ │ API Gateway  │ │  Static     │
    │  React SPA      │ │  (Express)   │ │  Assets     │
    │  Port 3000      │ │  Port 4000   │ │             │
    └────────────────┘ └──────┬───────┘ └─────────────┘
                               │
            ┌──────────┬───────┼───────┬──────────┐
            │          │       │       │          │
   ┌────────▼───┐ ┌────▼────┐ │  ┌────▼────┐ ┌───▼────────┐
   │ Production │ │Machines │ │  │Mainten. │ │ Operators  │
   │ Service    │ │Service  │ │  │Service  │ │ Service    │
   │ :4001      │ │:4002    │ │  │:4003    │ │ :4004      │
   └─────┬──────┘ └───┬─────┘ │  └───┬─────┘ └────┬───────┘
         │            │       │      │             │
         └────────────┴───────┼──────┴─────────────┘
                              │
                    ┌─────────▼──────────┐
                    │    PostgreSQL       │
                    │    Database         │
                    │    Port 5432        │
                    └────────────────────┘
```

### Key Decisions:
- **Single-tenant**: One Docker Compose stack per customer. No multi-tenancy complexity.
- **Microservices via Express.js**: Each service owns its own DB schema/tables. Services communicate via HTTP (internal network).
- **Shared PostgreSQL**: One DB instance per customer, each service has its own schema.
- **API Gateway**: Single entry point, routes requests to services, handles auth.
- **Frontend**: React SPA (Vite), communicates only with API Gateway.

---

## 3. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + Vite + Tailwind CSS | Fast, modern, Claude Code excels at it |
| API Gateway | Node.js + Express | Lightweight, routes to services |
| Microservices | Node.js + Express | Same stack, easy to maintain |
| Database | PostgreSQL 16 | Robust, free, excellent for structured data |
| ORM | Knex.js | SQL query builder, migrations, seeds |
| Auth | JWT + bcrypt | Simple, stateless |
| Containerization | Docker + Docker Compose | One compose file per customer instance |
| Reverse Proxy | Nginx | SSL termination, routing |

---

## 4. Database Design

### Schema: `auth`
```sql
CREATE SCHEMA auth;

CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'production_manager', 'shift_leader', 'operator', 'maintenance')),
  badge_number VARCHAR(50),
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Schema: `machines`
```sql
CREATE SCHEMA machines;

CREATE TABLE machines.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,        -- e.g., "CNC-01"
  name VARCHAR(255) NOT NULL,              -- e.g., "CNC Strung #1"
  type VARCHAR(100) NOT NULL,              -- e.g., "CNC", "Injectie", "Presa"
  location VARCHAR(255),                   -- e.g., "Hala A"
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
  metadata JSONB DEFAULT '{}',             -- flexible extra fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE machines.machine_operators (
  machine_id UUID REFERENCES machines.machines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,                   -- references auth.users(id)
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (machine_id, user_id)
);
```

### Schema: `production`
```sql
CREATE SCHEMA production;

CREATE TABLE production.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(100) UNIQUE NOT NULL,  -- e.g., "CMD-2026-0451"
  product_name VARCHAR(255) NOT NULL,          -- e.g., "Arbore S42"
  product_code VARCHAR(100),
  machine_id UUID NOT NULL,                    -- references machines.machines(id)
  target_quantity INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE production.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES production.orders(id),
  machine_id UUID NOT NULL,
  operator_id UUID NOT NULL,                   -- references auth.users(id)
  shift VARCHAR(20) NOT NULL,                  -- "Tura I", "Tura II", "Tura III"
  good_pieces INTEGER NOT NULL DEFAULT 0,
  scrap_pieces INTEGER NOT NULL DEFAULT 0,
  scrap_reason VARCHAR(255),
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE TABLE production.stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL,
  operator_id UUID NOT NULL,
  reason VARCHAR(255) NOT NULL,
  category VARCHAR(100),                       -- "Lipsa material", "Defect utilaj", etc.
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,                    -- computed on close
  shift VARCHAR(20),
  notes TEXT
);

CREATE TABLE production.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_name VARCHAR(20) NOT NULL,             -- "Tura I"
  shift_leader_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  notes_incoming TEXT,                         -- notes from previous shift
  notes_outgoing TEXT,                         -- notes for next shift
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'closed'))
);
```

### Schema: `checklists`
```sql
CREATE SCHEMA checklists;

CREATE TABLE checklists.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,                  -- e.g., "Checklist Debut Serie CNC"
  machine_type VARCHAR(100),                   -- applies to machine type, or NULL for all
  items JSONB NOT NULL,                        -- [{id, text, required}]
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE checklists.completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES checklists.templates(id),
  machine_id UUID NOT NULL,
  operator_id UUID NOT NULL,
  shift VARCHAR(20),
  responses JSONB NOT NULL,                    -- [{item_id, checked, value, note}]
  all_ok BOOLEAN NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Schema: `maintenance`
```sql
CREATE SCHEMA maintenance;

CREATE TABLE maintenance.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(50) UNIQUE NOT NULL,  -- auto: "MT-0001"
  machine_id UUID NOT NULL,
  reported_by UUID NOT NULL,                   -- operator
  assigned_to UUID,                            -- maintenance technician
  problem_type VARCHAR(100) NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  photo_url VARCHAR(500),
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);
```

---

## 5. API Routes

### API Gateway (port 4000)
All routes prefixed with `/api/v1`

```
# Auth
POST   /api/v1/auth/login
POST   /api/v1/auth/register          (admin only)
GET    /api/v1/auth/me

# Machines
GET    /api/v1/machines
POST   /api/v1/machines               (admin)
GET    /api/v1/machines/:id
PUT    /api/v1/machines/:id            (admin)
DELETE /api/v1/machines/:id            (admin)

# Production
GET    /api/v1/production/orders
POST   /api/v1/production/orders       (manager)
GET    /api/v1/production/reports
POST   /api/v1/production/reports      (operator)
GET    /api/v1/production/stops
POST   /api/v1/production/stops        (operator)
PUT    /api/v1/production/stops/:id    (close stop)
GET    /api/v1/production/shifts
POST   /api/v1/production/shifts       (shift leader)
PUT    /api/v1/production/shifts/:id   (close shift)
GET    /api/v1/production/dashboard    (OEE, KPIs)

# Checklists
GET    /api/v1/checklists/templates
POST   /api/v1/checklists/templates    (manager)
POST   /api/v1/checklists/complete     (operator)
GET    /api/v1/checklists/completions

# Maintenance
GET    /api/v1/maintenance/requests
POST   /api/v1/maintenance/requests    (operator)
PUT    /api/v1/maintenance/requests/:id (maintenance)
GET    /api/v1/maintenance/dashboard
```

---

## 6. Service Communication

Services communicate via internal HTTP calls over Docker network:
```
api-gateway → http://production-service:4001/internal/...
api-gateway → http://machines-service:4002/internal/...
api-gateway → http://maintenance-service:4003/internal/...
api-gateway → http://auth-service:4004/internal/...
```

Internal routes are NOT exposed externally. Only the API Gateway is public.

---

## 7. Docker Compose (per customer instance)

Each customer gets:
- Their own Docker Compose stack
- Their own PostgreSQL database
- Their own subdomain: `clientname.shopfloor.ro`
- Deployed on a VPS (Hetzner Cloud, ~€15-30/month per instance)

---

## 8. Development Order

### Phase 1: Foundation (Week 1-2)
1. Set up project structure with shared packages
2. PostgreSQL + Knex migrations for all schemas
3. Auth service (register, login, JWT)
4. API Gateway with routing + auth middleware
5. Machines service (CRUD)

### Phase 2: Core Production (Week 3-4)
6. Production service — orders CRUD
7. Production service — reports (operator reporting)
8. Production service — stops (downtime tracking)
9. Production service — OEE calculation engine
10. Production service — dashboard endpoint

### Phase 3: Checklists & Maintenance (Week 5-6)
11. Checklists service — templates CRUD
12. Checklists service — completion by operator
13. Maintenance service — request CRUD
14. Maintenance service — assignment & resolution flow

### Phase 4: Frontend (Week 7-10)
15. React app scaffolding + routing + auth
16. Admin panel (machines, operators, orders)
17. Operator view (report, checklist, stop, maintenance request)
18. Manager dashboard (OEE, KPIs, shift log)
19. Maintenance view (requests list, take/resolve)
20. PWA configuration (offline-capable)

### Phase 5: Deployment (Week 11-12)
21. Docker Compose configuration
22. Nginx reverse proxy + SSL
23. Deployment scripts (create new customer instance)
24. Seed data for demo instance

---

## 9. Key Business Logic

### OEE Calculation
```
OEE = Availability × Performance × Quality

Availability = (Planned Production Time - Downtime) / Planned Production Time
Performance = (Total Pieces / Operating Time) / Ideal Cycle Time
Quality = Good Pieces / Total Pieces

Where:
- Planned Production Time = shift duration (typically 480 min = 8h)
- Downtime = sum of all stops for the machine in the period
- Total Pieces = good_pieces + scrap_pieces from reports
- Ideal Cycle Time = target pieces per minute (configured per order/product)
- Good Pieces = good_pieces from reports
```

### Shift Logic
- Tura I: 06:00 - 14:00
- Tura II: 14:00 - 22:00
- Tura III: 22:00 - 06:00
- Auto-detect current shift based on time
- Shift leader opens/closes shift

---

## 10. Environment Variables

```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=shopfloor
DB_USER=shopfloor
DB_PASSWORD=<generated>

# Auth
JWT_SECRET=<generated>
JWT_EXPIRY=24h

# Services (internal Docker network)
AUTH_SERVICE_URL=http://auth-service:4004
MACHINES_SERVICE_URL=http://machines-service:4002
PRODUCTION_SERVICE_URL=http://production-service:4001
MAINTENANCE_SERVICE_URL=http://maintenance-service:4003

# App
NODE_ENV=development
API_PORT=4000
FRONTEND_URL=http://localhost:3000
```

---

## 11. Coding Conventions

- **Language**: JavaScript (Node.js), NOT TypeScript (faster development for MVP)
- **Style**: ES modules (import/export), async/await everywhere
- **Error handling**: Express error middleware, consistent JSON error responses
- **Validation**: Joi for request validation
- **Logging**: Winston logger, JSON format
- **Dates**: All in UTC, convert to Romania timezone (Europe/Bucharest) only in frontend
- **IDs**: UUID v4 everywhere
- **Naming**: snake_case for DB columns, camelCase for JS variables, kebab-case for routes

---

## 12. File Structure per Service

```
services/production-service/
├── src/
│   ├── index.js              # Express app entry
│   ├── routes/
│   │   ├── orders.js
│   │   ├── reports.js
│   │   ├── stops.js
│   │   ├── shifts.js
│   │   └── dashboard.js
│   ├── controllers/
│   │   ├── orders.controller.js
│   │   ├── reports.controller.js
│   │   ├── stops.controller.js
│   │   ├── shifts.controller.js
│   │   └── dashboard.controller.js
│   ├── services/
│   │   ├── oee.service.js     # OEE calculation logic
│   │   └── reports.service.js
│   └── validations/
│       └── reports.validation.js
├── migrations/
│   └── 001_create_production_tables.js
├── seeds/
│   └── demo_data.js
├── package.json
└── Dockerfile
```

---

## REGULA GIT
Dupa fiecare task finalizat si verificat, ruleaza:
```bash
git add .
git commit -m "[descriere task]"
git push origin main
```
