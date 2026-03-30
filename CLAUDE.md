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

## REGULA GIT
Dupa fiecare task finalizat si verificat, ruleaza:
git add .
git commit -m "[descriere task]"
git push origin main

# ═══════════════════════════════════════════
# ADAUGA ACEST BLOC LA SFARSITUL FISIERULUI CLAUDE.md
# ═══════════════════════════════════════════

## RELATII INTRE MODULE

```
COMPANIES (clienti/furnizori)
    │
    ▼
BOM.PRODUCTS (catalog repere, referinta client)
    │
    ├── BOM.OPERATIONS (routing: secventa operatii per produs)
    │       └── leaga la MACHINES (machine_type sau machine_id)
    │
    ├── BOM.MATERIALS (ce materiale intra in produs)
    │       └── leaga la INVENTORY.ITEMS (prin material_name/code)
    │
    └── BOM.ASSEMBLY_COMPONENTS (ce semifabricate compun produsul)
            └── leaga la alte BOM.PRODUCTS

PLANNING.CUSTOMER_DEMANDS (call-offs de la client)
    │
    ▼
PLANNING.MASTER_PLANS (plan saptamanal)
    │
    ▼
PLANNING.DAILY_ALLOCATIONS (reper pe masina pe zi pe tura)
    │
    ├── leaga la MACHINES.MACHINES (machine_id)
    ├── leaga la BOM.PRODUCTS (product_id)
    ├── leaga la PRODUCTION.ORDERS (order_id)
    └── actualizeaza PLANNING.CAPACITY_LOAD (% incarcare masina)

PRODUCTION.ORDERS (comenzi de productie)
    │
    ├── PRODUCTION.REPORTS (piese raportate de operator)
    ├── PRODUCTION.STOPS (opriri masini)
    └── se compara cu PLANNING.DAILY_ALLOCATIONS (planificat vs realizat)

INVENTORY.ITEMS (articole de stoc)
    │
    ├── INVENTORY.STOCK_LEVELS (stoc curent, actualizat la fiecare miscare)
    ├── INVENTORY.MOVEMENTS (jurnal: intrari, iesiri, ajustari)
    ├── INVENTORY.WAREHOUSE_DOCUMENTS (NIR, BC → genereaza movements la confirmare)
    └── INVENTORY.MATERIAL_REQUIREMENTS (calculat din ORDERS + BOM.MATERIALS)
```

## BUSINESS RULES — MODULE NOI

### BOM
- Un produs poate avea mai multe operatii (sequence: 10, 20, 30...)
- Fiecare operatie are un tip de masina necesar (machine_type) — NU o masina fixa
- pieces_per_hour se calculeaza automat: (3600 / cycle_time_seconds) * nr_cavities
- weight_runner_kg = masa culee/runner care se recicleaza (specific injectie plastic)
- cost_per_piece = SUM(material costs) + SUM(operation costs) + overhead %
- Cand se modifica BOM-ul, costul NU se recalculeaza automat — doar la cerere (GET /cost)

### Planning
- Un master_plan acopera o saptamana (luni-duminica) sau o luna
- daily_allocations: un reper pe o masina pe o tura pe o zi = un rand
- Cand se adauga/modifica/sterge o alocare → RECALCULEAZA capacity_load:
  planned_hours = SUM(planned_hours) din toate alocarile pt masina+data
  load_percent = (planned_hours / available_hours) * 100
  available_hours vine din machines.planned_production_minutes / 60 * nr_ture
- Daca load_percent > 100% → masina e SUPRAINCARCATA (avertizare in dashboard)
- customer_demands = cerinte de la client (call-offs), importate din Excel sau manual
- Alocarea NU se face automat — managerul aloca manual repere pe masini

### Inventory
- La creare item → se creeaza automat stock_levels cu qty=0
- Orice miscare (movement) actualizeaza stock_levels in TRANZACTIE:
  - Daca qty finala ar fi negativa → REJECT (stoc insuficient)
  - receipt/production_output/adjustment_plus → qty pozitiv (creste stoc)
  - production_input/shipment/scrap/adjustment_minus → qty negativ (scade stoc)
- Warehouse documents: draft → confirmed
  - La confirmare se creeaza automat movements pentru fiecare linie
  - Un document confirmat NU poate fi modificat
- material_requirements se calculeaza din: orders.target_quantity × bom.materials.qty_per_piece × waste_factor
  - shortage = required - stock_levels.current_qty (daca > 0)

### Companies
- company_type 'both' = e si client si furnizor
- Un contact cu is_primary=true = contactul principal pentru acea companie
- companies se leaga de bom.products prin client_name (nu FK strict)
- companies se leaga de inventory.items prin supplier_name (nu FK strict)

## SEED DATA SPECIFICE (din fisierele Alseca/CPD)

Cand creezi seed pentru module noi, foloseste aceste date reale:

Produse (bom.products):
- A4638840900 FR | RADLAUFABDECKUNG VO LI | FR | Mercedes-Benz | MOPLEN | 0.925 kg | 30/container
- A4638841000 FR | RADLAUFABDECKUNG VO RE | FR | Mercedes-Benz | MOPLEN | 0.911 kg | 30/container
- A4638841300 FR | RADLAUFABDECKUNG HI LI | FR | Mercedes-Benz | MOPLEN | 0.878 kg | 90/container
- A4638841400 FR | RADLAUFABDECKUNG HI RE | FR | Mercedes-Benz | MOPLEN | 0.860 kg | 90/container
- A4638842700 FR | RADLAUFABDECKUNG VO LI AMG | FR | Mercedes-Benz | MOPLEN | 0.920 kg | 30/container

Masini:
- INJ-1700TF | Masina Injectie 1700 TF | Injectie | Hala B
- INJ-M1-350TF | Masina Injectie M1 350 TF | Injectie | Hala B
- INJ-M2-350TF | Masina Injectie M2 350 TF | Injectie | Hala B
- INJ-140TF | Masina Injectie 140 TF | Injectie | Hala B
- ASM-01 | Linie Asamblare 1 | Asamblare | Hala C

Operatii tipice (bom.operations):
- Seq 10: Uscare material | drying | 0 min ciclu (pregatire)
- Seq 20: Montaj matrita | mold_change | setup_time: 60-120 min
- Seq 30: Injectie | injection | cycle_time: 51-59 sec | nr_cavities: 1
- Seq 40: Asamblare | assembly | cycle_time: variabil

Materiale (bom.materials):
- MOPLEN EP340K | granule polipropilena | ~1 kg/piesa | furnizor: LyondellBasell
- ZYTEL 70G30HSLR BK099 | granule nylon | furnizor: DuPont
- ARMLEN | granule | furnizor: LyondellBasell
- Eticheta trasabilitate | buc | 1/piesa


# ═══════════════════════════════════════════════════════════
# SHOPFLOOR.RO — SCHEMA COMPLETA FEATURES AVANSATE (F1-F10)
# Adauga INTEGRAL la sfarsitul CLAUDE.md
# ═══════════════════════════════════════════════════════════

## TABELE NOI — Features F1-F10

### F2: Setup Times

machines.setup_defaults
  - id UUID PK
  - machine_id UUID FK → machines.machines
  - default_setup_minutes INTEGER NOT NULL
  - notes TEXT
  - UNIQUE(machine_id)

machines.setup_overrides (exceptii produs-la-produs)
  - id UUID PK
  - machine_id UUID FK → machines.machines
  - from_product_id UUID FK → bom.products (nullable = orice produs anterior)
  - to_product_id UUID FK → bom.products NOT NULL
  - setup_minutes INTEGER NOT NULL
  - notes TEXT
  - UNIQUE(machine_id, from_product_id, to_product_id)

machines.setup_factor_definitions (factori configurabili per fabrica)
  - id UUID PK
  - factory_id UUID (pentru multi-tenant viitor, default null)
  - factor_name VARCHAR(100) NOT NULL (ex: "Schimbare matrita", "Curatare cilindru")
  - applies_to_machine_type VARCHAR(100) (ex: "Injectie", null = toate)
  - default_minutes INTEGER DEFAULT 0
  - sort_order INTEGER DEFAULT 0
  - is_active BOOLEAN DEFAULT true

machines.setup_factor_values (valori per produs-masina-factor)
  - id UUID PK
  - machine_id UUID FK → machines.machines
  - product_id UUID FK → bom.products
  - factor_id UUID FK → machines.setup_factor_definitions
  - minutes INTEGER NOT NULL
  - notes TEXT
  - UNIQUE(machine_id, product_id, factor_id)

### F3: Skill Matrix + Concedii

auth.skill_level_definitions (nivele configurabile per fabrica)
  - id UUID PK
  - level_name VARCHAR(100) NOT NULL (ex: "Expert", "Certificat", "Asistat")
  - level_rank INTEGER NOT NULL (1 = cel mai inalt)
  - color VARCHAR(20) (ex: "#00D4AA")
  - can_work_unsupervised BOOLEAN DEFAULT false
  - is_active BOOLEAN DEFAULT true
  - UNIQUE(level_rank)

auth.operator_skills
  - id UUID PK
  - user_id UUID FK → auth.users
  - machine_id UUID FK → machines.machines
  - skill_level_id UUID FK → auth.skill_level_definitions
  - max_simultaneous_machines INTEGER DEFAULT 1
  - certified_at DATE
  - certified_by UUID
  - expires_at DATE (recertificare)
  - notes TEXT
  - UNIQUE(user_id, machine_id)

auth.operator_shift_patterns (model ture per operator)
  - id UUID PK
  - user_id UUID FK → auth.users
  - pattern_type VARCHAR(20) CHECK IN ('fixed', 'rotating', 'custom')
  - fixed_shift VARCHAR(20) (daca pattern_type = 'fixed': "Tura I")
  - rotation_weeks INTEGER (daca rotating: ciclul in saptamani)
  - rotation_sequence JSONB (ex: ["Tura I", "Tura II", "Tura III"])
  - valid_from DATE
  - valid_to DATE

auth.operator_shift_overrides (exceptii la pattern: zi specifica)
  - id UUID PK
  - user_id UUID FK → auth.users
  - override_date DATE NOT NULL
  - shift VARCHAR(20) NOT NULL
  - notes TEXT

auth.leave_requests (cereri concediu cu aprobare)
  - id UUID PK
  - user_id UUID FK → auth.users
  - leave_type VARCHAR(50) CHECK IN ('vacation', 'sick', 'training', 'personal', 'other')
  - start_date DATE NOT NULL
  - end_date DATE NOT NULL
  - total_days INTEGER
  - reason TEXT
  - status VARCHAR(20) CHECK IN ('pending', 'approved', 'rejected') DEFAULT 'pending'
  - reviewed_by UUID
  - reviewed_at TIMESTAMPTZ
  - reviewer_notes TEXT
  - created_at TIMESTAMPTZ
  - INDEX pe (user_id, start_date, end_date)

### F4: Cascada Semifabricate (adaugari la BOM)

Adauga coloane la bom.operations:
  - output_product_id UUID FK → bom.products (semifabricatul rezultat, nullable)
  - transfer_type VARCHAR(20) CHECK IN ('direct', 'through_stock') DEFAULT 'direct'
  - min_batch_before_next INTEGER (minim piese gata inainte ca operatia urmatoare sa inceapa)

bom.operation_dependencies
  - id UUID PK
  - operation_id UUID FK → bom.operations (operatia dependenta)
  - depends_on_operation_id UUID FK → bom.operations (operatia de care depinde)
  - dependency_type VARCHAR(20) CHECK IN ('finish_to_start', 'start_to_start') DEFAULT 'finish_to_start'
  - lag_minutes INTEGER DEFAULT 0 (timp de asteptare intre cele doua)
  - UNIQUE(operation_id, depends_on_operation_id)

### F1: Motor Planificare

planning.scheduling_configs (configurari salvate)
  - id UUID PK
  - name VARCHAR(255) NOT NULL
  - is_default BOOLEAN DEFAULT false
  - priorities JSONB NOT NULL
    (ex: [
      {"criterion": "deadline", "weight": 50, "order": 1},
      {"criterion": "utilization", "weight": 25, "order": 2},
      {"criterion": "setup_minimize", "weight": 15, "order": 3},
      {"criterion": "cost_minimize", "weight": 10, "order": 4}
    ])
  - constraints JSONB
    (ex: {
      "respect_skill_matrix": true,
      "respect_leave": true,
      "respect_maintenance": true,
      "respect_material_stock": true,
      "allow_overtime": false,
      "max_load_percent": 100,
      "planning_granularity": "shift"
    })
  - created_by UUID
  - created_at TIMESTAMPTZ

planning.scheduling_runs (rulari algoritm)
  - id UUID PK
  - name VARCHAR(255)
  - config_id UUID FK → planning.scheduling_configs
  - run_type VARCHAR(20) CHECK IN ('production', 'simulation') DEFAULT 'production'
  - period_start DATE NOT NULL
  - period_end DATE NOT NULL
  - status VARCHAR(20) CHECK IN ('running', 'completed', 'failed', 'applied') DEFAULT 'running'
  - result_summary JSONB
    (ex: {
      "on_time_percent": 92,
      "avg_load_percent": 78,
      "total_setup_minutes": 540,
      "orders_at_risk": 2,
      "unassigned_operations": 0
    })
  - warnings JSONB[] (lista avertizari generate)
  - created_by UUID
  - created_at TIMESTAMPTZ
  - completed_at TIMESTAMPTZ

planning.scheduled_operations (output scheduler — ce se produce unde si cand)
  - id UUID PK
  - run_id UUID FK → planning.scheduling_runs ON DELETE CASCADE
  - order_id UUID FK → production.orders
  - product_id UUID FK → bom.products
  - operation_id UUID FK → bom.operations
  - machine_id UUID FK → machines.machines
  - suggested_operator_id UUID
  - tool_id UUID FK → machines.tools
  - planned_date DATE NOT NULL
  - planned_shift VARCHAR(20)
  - start_time TIME
  - end_time TIME
  - setup_minutes INTEGER DEFAULT 0
  - production_minutes INTEGER
  - planned_qty INTEGER
  - sequence_in_day INTEGER
  - dependency_met BOOLEAN DEFAULT true
  - material_available BOOLEAN DEFAULT true
  - operator_available BOOLEAN DEFAULT true
  - status VARCHAR(20) CHECK IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'conflict') DEFAULT 'scheduled'
  - conflict_reason TEXT
  - INDEX pe (run_id), (machine_id, planned_date), (order_id)

### F5: Simulare What-if

planning.simulations
  - id UUID PK
  - name VARCHAR(255) NOT NULL
  - description TEXT
  - base_run_id UUID FK → planning.scheduling_runs (planul original)
  - simulation_run_id UUID FK → planning.scheduling_runs (rezultatul simularii)
  - constraints_modified JSONB
    (ex: {
      "machines_disabled": ["id-inj01"],
      "orders_added": ["id-cmd-urgent"],
      "operators_absent": ["id-mihai"],
      "priority_override": {...}
    })
  - impact_summary JSONB
    (ex: {
      "orders_delayed": 2,
      "delay_days_total": 3,
      "load_change_avg": +5.2,
      "setup_change_minutes": +120
    })
  - status VARCHAR(20) CHECK IN ('draft', 'computed', 'applied', 'archived')
  - created_by UUID
  - created_at TIMESTAMPTZ

### F6: Cost Real-time

costs.cost_snapshots (calcule periodice per comanda)
  - id UUID PK
  - order_id UUID FK → production.orders
  - snapshot_date DATE
  - snapshot_shift VARCHAR(20)
  - planned_cost JSONB ({material, labor, machine, overhead, total})
  - actual_cost JSONB ({material, labor, machine, overhead, scrap, downtime, overtime, total})
  - variance_percent NUMERIC(8,2)
  - breakdown JSONB
    (ex: {
      "scrap_cost": 120,
      "downtime_cost": 85,
      "overtime_cost": 60,
      "material_variance": 40,
      "causes": ["Rata rebut 4.8% vs 2% target", "45 min oprire neprevazuta"]
    })
  - created_at TIMESTAMPTZ

costs.cost_rates_extended (extinde bom.cost_rates)
  - Adauga la bom.cost_rates:
    - rate_type nou: 'labor_overtime' (cost ora suplimentara)
    - rate_type nou: 'scrap_cost' (cost reprelucrare/pierdere per rebut)

### F7: Alerte Proactive

alerts.rule_definitions (reguli predefinite + custom)
  - id UUID PK
  - name VARCHAR(255) NOT NULL
  - description TEXT
  - alert_type VARCHAR(50) CHECK IN ('stock_low', 'stock_days_remaining', 'order_at_risk', 'oee_low', 'machine_maintenance_due', 'tool_cycles_high', 'cost_overrun', 'operator_unavailable', 'custom')
  - is_predefined BOOLEAN DEFAULT false
  - condition JSONB NOT NULL
    (ex: {"entity": "inventory.stock_levels", "field": "current_qty", "operator": "<=", "value_field": "inventory.items.min_stock"})
    (ex: {"entity": "production.oee", "field": "oee_percent", "operator": "<", "value": 60, "consecutive_shifts": 3})
  - severity VARCHAR(20) CHECK IN ('info', 'warning', 'critical') DEFAULT 'warning'
  - suggested_actions JSONB[]
    (ex: [{"text": "Plaseaza comanda reaprovizionare", "action_type": "link", "link": "/inventory/reorder"}])
  - is_active BOOLEAN DEFAULT true
  - check_interval_minutes INTEGER DEFAULT 30
  - last_checked_at TIMESTAMPTZ
  - created_by UUID
  - created_at TIMESTAMPTZ

alerts.notification_channels (preferinte notificare per regula)
  - id UUID PK
  - rule_id UUID FK → alerts.rule_definitions
  - channel VARCHAR(20) CHECK IN ('app', 'email', 'push')
  - recipient_type VARCHAR(20) CHECK IN ('role', 'user')
  - recipient_value VARCHAR(255) (rol sau user_id)
  - is_active BOOLEAN DEFAULT true

alerts.alerts (alerte generate)
  - id UUID PK
  - rule_id UUID FK → alerts.rule_definitions
  - alert_type VARCHAR(50)
  - severity VARCHAR(20)
  - title VARCHAR(255) NOT NULL
  - message TEXT NOT NULL
  - entity_type VARCHAR(50) (ex: 'machine', 'order', 'inventory_item')
  - entity_id UUID
  - suggested_actions JSONB[]
  - status VARCHAR(20) CHECK IN ('new', 'seen', 'acknowledged', 'resolved') DEFAULT 'new'
  - seen_by UUID
  - seen_at TIMESTAMPTZ
  - resolved_by UUID
  - resolved_at TIMESTAMPTZ
  - created_at TIMESTAMPTZ
  - INDEX pe (status, severity), (entity_type, entity_id)

### F8: Scule & Consumabile

machines.tools (scule/matrite trackuite)
  - id UUID PK
  - code VARCHAR(100) UNIQUE NOT NULL
  - name VARCHAR(255) NOT NULL
  - tool_type VARCHAR(50) CHECK IN ('mold', 'die', 'cutter', 'fixture', 'gauge', 'jig', 'other')
  - tracking_mode VARCHAR(20) CHECK IN ('tracked', 'consumable') NOT NULL
  - current_machine_id UUID FK → machines.machines (nullable = in magazie)
  - compatible_machine_types JSONB (ex: ["Injectie", "CNC"])
  - linked_product_ids UUID[]
  --- Tracking fields (doar pentru tracking_mode = 'tracked'):
  - max_cycles INTEGER
  - current_cycles INTEGER DEFAULT 0
  - max_hours INTEGER
  - current_hours NUMERIC(10,2) DEFAULT 0
  - maintenance_interval_cycles INTEGER
  - maintenance_interval_hours INTEGER
  - next_maintenance_due DATE
  --- Consumable fields (doar pentru tracking_mode = 'consumable'):
  - inventory_item_id UUID FK → inventory.items (legatura la stoc)
  - consumption_rate_per_hour NUMERIC(10,4) (consum estimat per ora functionare masina)
  - consumption_unit VARCHAR(20)
  --- Common:
  - cost_eur NUMERIC(12,2)
  - supplier VARCHAR(255)
  - status VARCHAR(20) CHECK IN ('active', 'maintenance', 'retired') DEFAULT 'active'
  - notes TEXT
  - created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ

machines.tool_maintenance_log
  - id UUID PK
  - tool_id UUID FK → machines.tools
  - maintenance_type VARCHAR(50) CHECK IN ('preventive', 'corrective', 'inspection', 'replacement')
  - description TEXT
  - cost_eur NUMERIC(12,2)
  - performed_by UUID
  - performed_at TIMESTAMPTZ
  - cycles_at_maintenance INTEGER
  - hours_at_maintenance NUMERIC(10,2)
  - next_maintenance_due DATE
  - notes TEXT

machines.tool_assignments_log (istoric mutari intre masini)
  - id UUID PK
  - tool_id UUID FK → machines.tools
  - from_machine_id UUID (nullable = din magazie)
  - to_machine_id UUID (nullable = in magazie)
  - assigned_by UUID
  - assigned_at TIMESTAMPTZ
  - notes TEXT

### F9: Rapoarte P/R/R

reports.saved_reports (configurari rapoarte salvate)
  - id UUID PK
  - name VARCHAR(255) NOT NULL
  - report_type VARCHAR(50) CHECK IN ('prr_product', 'prr_machine', 'prr_order', 'prr_operator', 'prr_weekly_summary')
  - filters JSONB (ex: {"machine_ids": [...], "date_from": "...", "date_to": "..."})
  - show_trend BOOLEAN DEFAULT true
  - trend_weeks INTEGER DEFAULT 8
  - show_month_comparison BOOLEAN DEFAULT true
  - created_by UUID
  - created_at TIMESTAMPTZ

### F10: Import Inteligent

imports.templates (template-uri mapping salvate)
  - id UUID PK
  - name VARCHAR(255) NOT NULL (ex: "Import comenzi Mercedes")
  - import_type VARCHAR(50) CHECK IN ('orders', 'materials_receipt', 'demands', 'products', 'stock_update')
  - source_type VARCHAR(50) CHECK IN ('excel', 'csv', 'pdf', 'ocr', 'email', 'manual')
  - partner_id UUID FK → companies.companies (client/furnizor asociat)
  - partner_name VARCHAR(255)
  - column_mappings JSONB NOT NULL
    (ex: [
      {"source_column": "Part Number", "target_field": "product_reference", "transform": null},
      {"source_column": "Qty", "target_field": "quantity", "transform": "integer"},
      {"source_column": "Due Date", "target_field": "deadline", "transform": "date_dmy"}
    ])
  - default_values JSONB (campuri pre-completate, ex: {"client_name": "Mercedes-Benz"})
  - skip_rows INTEGER DEFAULT 0 (randuri de header de ignorat)
  - sheet_name VARCHAR(100) (pentru Excel cu mai multe sheet-uri)
  - is_active BOOLEAN DEFAULT true
  - last_used_at TIMESTAMPTZ
  - use_count INTEGER DEFAULT 0
  - created_by UUID
  - created_at TIMESTAMPTZ

imports.import_logs (istoric importuri)
  - id UUID PK
  - template_id UUID FK → imports.templates
  - import_type VARCHAR(50)
  - source_filename VARCHAR(255)
  - source_type VARCHAR(50)
  - status VARCHAR(20) CHECK IN ('processing', 'preview', 'completed', 'failed', 'cancelled') DEFAULT 'processing'
  - total_rows INTEGER
  - imported_rows INTEGER DEFAULT 0
  - skipped_rows INTEGER DEFAULT 0
  - error_rows INTEGER DEFAULT 0
  - errors JSONB[] (ex: [{"row": 3, "field": "product_reference", "error": "Produs negasit", "suggestion": "A4638840900"}])
  - imported_by UUID
  - created_at TIMESTAMPTZ
  - completed_at TIMESTAMPTZ

imports.import_row_details (randuri individuale pt preview/corectie)
  - id UUID PK
  - import_log_id UUID FK → imports.import_logs ON DELETE CASCADE
  - row_number INTEGER
  - raw_data JSONB (datele originale din fisier)
  - mapped_data JSONB (datele dupa mapping)
  - status VARCHAR(20) CHECK IN ('valid', 'warning', 'error', 'imported', 'skipped')
  - validation_errors JSONB[]
  - suggestions JSONB[] (fuzzy match suggestions)
  - manually_corrected BOOLEAN DEFAULT false

imports.email_inbox (pentru import din email)
  - id UUID PK
  - from_address VARCHAR(255)
  - subject VARCHAR(500)
  - received_at TIMESTAMPTZ
  - body_text TEXT
  - attachments JSONB[] (filenames + types)
  - matched_template_id UUID FK → imports.templates
  - processing_status VARCHAR(20) CHECK IN ('received', 'processed', 'failed', 'ignored')
  - import_log_id UUID FK → imports.import_logs
  - created_at TIMESTAMPTZ

## BUSINESS RULES — FEATURES AVANSATE

### F1 Motor Planificare
- Prioritatile sunt configurabile: ordine + pondere % (total = 100%)
- Managerul le seteaza la fiecare rulare (ultima config = default)
- Algoritmul: priority-weighted scoring
  1. Pentru fiecare comanda, calculeaza scor = SUM(criteriu_score × weight / 100)
  2. Criteriu deadline: (1 - zile_ramase / max_zile) × 100 (mai aproape = scor mai mare)
  3. Criteriu utilizare: aloca pe masina cu load cel mai mic
  4. Criteriu setup: preferat masina unde setup = 0 sau minim
  5. Criteriu cost: preferat masina cu cost orar cel mai mic
  6. Sorteaza operatiile dupa scor descrescator → aloca in ordine
- Verifica la fiecare alocare: material disponibil? operator? scula? mentenanta?
- Doua nivele vizualizare: detaliat (ora/tura/zi) + termen lung (capacitate pe saptamani)
- Comanda urgenta: re-ruleaza cu comanda noua → arata diff → manager confirma

### F2 Setup Times
- Nivel 1: machines.setup_defaults → timp fix per masina
- Nivel 2: machines.setup_overrides → exceptii produs-la-produs
- Nivel 3: machines.setup_factor_definitions + values → suma factorilor care se schimba
- Calcul: daca exista override → foloseste override. Altfel → suma factorilor schimbati. Altfel → default masina.
- Motorul sugereaza gruparea produselor cu setup mic, managerul decide

### F3 Skill Matrix + Concedii
- Nivele configurabile per fabrica (auth.skill_level_definitions)
- max_simultaneous_machines per operator (1 = opereaza 1 masina, 3 = supervizeaza 3)
- Ture: fixe (operator_shift_patterns.pattern_type = 'fixed') sau rotative (rotation_sequence)
- Concedii: operator cere → status 'pending' → manager aproba/refuza
- DOAR leave_requests cu status='approved' conteaza in planificare
- La aprobare: daca operatorul e planificat in zilele respective → avertizare manager
- Lipsa operator → sugereaza overtime din alta tura (operator certificat pe masina respectiva)

### F4 Cascada Semifabricate
- bom.operations cu transfer_type: 'direct' (consecutiv) sau 'through_stock' (prin stoc)
- bom.operation_dependencies: finish_to_start (default) sau start_to_start + lag
- Planificatorul calculeaza backward: deadline → data start ultima operatie → ... → data start prima operatie
- La 'through_stock': verifica stocul de semifabricate inainte de a planifica operatia urmatoare
- Gantt afiseaza sageti de dependenta intre barele operatiilor legate

### F5 Simulare What-if
- Creeaza copie a planului → modifica constrangeri → ruleaza scheduler → compara
- Max 3 simulari paralele (limitare UI, nu tehnica)
- Comparatie side-by-side pe Gantt: plan original | scenariu A | scenariu B
- Impact summary generat automat: comenzi intarziate, load change, setup change
- Simulari salvabile cu nume, redeschidere ulterioara, status 'applied' daca se aplica

### F6 Cost Real-time
- 5 vizualizari: per comanda, per piesa, per masina, per operator, profitabilitate client
- Actualizare: instant la raport productie (trigger) + recalculare completa la cerere
- Breakdown diferente: rebuturi, opriri, overtime, varianta material — grafic stacked bars
- costs.cost_snapshots salveaza periodic pentru istoric si trend

### F7 Alerte Proactive
- Canale: in app (badge), email, push PWA
- Configurabil per regula: ce canal, cui
- Reguli predefinite (stock_low, order_at_risk, oee_low, etc.) + custom
- Fiecare alerta vine cu 1-2 sugestii de actiune (text + link in aplicatie)
- Status alerta: new → seen → acknowledged → resolved
- Check automat la interval configurabil (default 30 min)

### F8 Scule & Consumabile
- tracking_mode 'tracked': cicluri, ore, mentenanta, asignare masina, istoric mutari
- tracking_mode 'consumable': legat la inventory, consum estimat per ora functionare
- Cicluri actualizate automat din rapoarte productie (cand operatorul raporteaza piese pe masina cu scula montata)
- Actualizare manuala disponibila mereu
- Alerta la apropierea de limita cicluri/ore (integrat F7)
- Planificatorul verifica disponibilitatea sculei la alocare (integrat F1)

### F9 Rapoarte P/R/R
- 5 tipuri: per reper, per masina/zi/tura, per comanda, per operator, sumar saptamanal
- Sursa Planificat: planning.daily_allocations sau scheduled_operations
- Sursa Realizat + Rebuturi: production.reports
- Trend: grafic linie pe ultimele 4-8 saptamani
- Comparatie: luna curenta vs luna anterioara
- Export: PDF (raport printabil) + Excel (date brute)
- Configurari salvabile (reports.saved_reports)

### F10 Import Inteligent
- 5 surse: Excel, CSV, PDF editabil, PDF scanat (OCR), email
- Mapping UI: coloana sursa → camp ShopFloor, cu preview live
- Template-uri salvabile per client/furnizor (imports.templates)
- Fuzzy matching: cand codul nu se potriveste exact → sugereaza cel mai probabil match + cere confirmare
- Preview: tabel cu status per rand (verde/galben/rosu) → import doar ce e valid
- OCR: Tesseract sau API extern → extrage text → parseaza structurat → mapping
- Email: adresa dedicata (import@shopfloor.ro) + copy-paste manual
- Istoric importuri cu detalii per rand (imports.import_logs + import_row_details)

---

## MOTOR APROBARE GENERIC (Approval Engine)

Motor reutilizabil pentru orice tip de document care necesita aprobare.
Folosit initial pentru MBOM, extensibil la: planuri productie, comenzi de lucru,
modificari BOM, cereri achizitie, etc.

### Tabele:

**approvals.workflow_definitions** (configurare flux per tip document per tenant)
- id UUID PK
- tenant_id UUID FK → system.tenants
- document_type VARCHAR(50) NOT NULL (ex: 'mbom', 'production_plan', 'work_order', 'purchase_request')
- name VARCHAR(255) NOT NULL (ex: "Aprobare MBOM standard")
- levels INTEGER NOT NULL (1, 2 sau 3)
- level_config JSONB NOT NULL
  (ex: [{"level": 1, "role": "shift_leader", "label": "Sef Sectie", "canSkip": false}, {"level": 2, "role": "director", "label": "Director Productie", "canSkip": false}])
- auto_approve_conditions JSONB (optional)
- is_active BOOLEAN DEFAULT true
- created_at TIMESTAMPTZ
- UNIQUE(tenant_id, document_type)

**approvals.approval_requests** (cereri de aprobare)
- id UUID PK
- tenant_id UUID FK → system.tenants
- workflow_id UUID FK → approvals.workflow_definitions
- document_type VARCHAR(50) NOT NULL
- document_id UUID NOT NULL
- document_reference VARCHAR(255)
- version VARCHAR(20) NOT NULL
- current_level INTEGER DEFAULT 1
- total_levels INTEGER NOT NULL
- status VARCHAR(20) CHECK IN ('pending','approved','rejected','cancelled') DEFAULT 'pending'
- submitted_by UUID FK → auth.users
- submitted_at TIMESTAMPTZ DEFAULT NOW()
- completed_at TIMESTAMPTZ
- final_comment TEXT
- INDEX pe (document_type, document_id), (status), (tenant_id)

**approvals.approval_steps** (decizie per nivel)
- id UUID PK
- request_id UUID FK → approvals.approval_requests ON DELETE CASCADE
- level INTEGER NOT NULL
- level_label VARCHAR(100)
- status VARCHAR(20) CHECK IN ('waiting','approved','rejected','skipped') DEFAULT 'waiting'
- decided_by UUID FK → auth.users
- decided_at TIMESTAMPTZ
- comment TEXT
- required_role VARCHAR(50)
- INDEX pe (request_id, level)

**approvals.document_versions** (istoric versiuni)
- id UUID PK
- tenant_id UUID FK → system.tenants
- document_type VARCHAR(50) NOT NULL
- document_id UUID NOT NULL
- version VARCHAR(20) NOT NULL
- snapshot JSONB NOT NULL (copia completa a documentului)
- changes_from_previous JSONB (diff)
- created_by UUID
- created_at TIMESTAMPTZ
- approval_request_id UUID FK → approvals.approval_requests
- INDEX pe (document_type, document_id)

### Coloane noi pe bom.products:
- approval_status VARCHAR(20) CHECK IN ('draft','pending_approval','active','archived') DEFAULT 'draft'
- current_version VARCHAR(20) DEFAULT '0.1'
- approved_at TIMESTAMPTZ
- approved_by UUID

### Business rules:
- Workflow configurabil per tenant + per document_type (1, 2 sau 3 nivele)
- Submit: document trece in 'pending_approval', se creeaza request + steps, snapshot salvat, notificare L1
- Aprobare nivel: daca mai sunt nivele → next level. Daca ultimul → document 'active'
- Respingere: document revine la 'draft', submitter notificat cu motiv
- Modificare document activ: automat 'draft', versiune incrementata, necesita re-aprobare completa
- DOAR documente 'active' sunt vizibile pentru planificator/CTP/costuri
- Permisiuni: approvals.submit, approvals.approve, approvals.configure
- Extensibil: adauga workflow_definition nou per document_type si leaga document_id

### Scenarii test E2E (Scenariu 15):
SCENARIU 15: Flux aprobare MBOM
- Inginer creeaza MBOM (draft)
- Trimite spre aprobare → status pending, L1 waiting
- Sef sectie aproba L1 → L2 waiting
- Director aproba L2 → MBOM activ
- Planificator vede MBOM-ul in planning
- Inginer modifica MBOM → revine draft v1.1
- Planificator NU mai vede MBOM-ul
- Re-aprobare L1 + L2 → activ din nou v1.1
- Respingere: inginer retrimite → sef respinge → draft cu comentariu

---

## TEMA 1: PATTERN DROPDOWN CU CAUTARE + CREARE INLINE

Pattern UI global. Component reutilizabil: `<SearchableSelect>`
- Input text → filtreaza lista live (cautare in name + code)
- Ultimul element: "+ Adauga [entitate] nou"
- Click → mini-modal cu campuri minime (2-3 campuri)
- Salveaza → selecteaza automat entitatea creata → inchide modal
- Se aplica pe TOATE dropdown-urile: companie, contact, furnizor, masina, produs, material, scula

Componenta: `frontend/src/components/SearchableSelect.jsx`
Props: `{endpoint, labelField, valueField, createEndpoint, createFields[], placeholder, onChange, filterParams, allowCreate}`

## TEMA 2: CONTACTE PER CONTEXT

### Modificari companies.contacts — adauga coloane:
- relationship_type VARCHAR(20) CHECK IN ('client_contact','supplier_contact','maintenance_contact','other') NOT NULL
- context_tags JSONB DEFAULT '[]' (ex: ["comenzi_cnc", "comenzi_injectie", "calitate"])
- department VARCHAR(100)

### companies.contact_assignments (leaga contact de document specific)
- id UUID PK
- contact_id UUID FK → companies.contacts
- entity_type VARCHAR(50) NOT NULL (ex: 'order', 'purchase', 'maintenance_intervention')
- entity_id UUID NOT NULL
- role_in_context VARCHAR(100)
- assigned_at TIMESTAMPTZ, assigned_by UUID
- INDEX pe (entity_type, entity_id)

### Modificari companies.companies:
- company_types JSONB DEFAULT '["client"]' (inlocuieste company_type VARCHAR)
  (ex: ["client", "supplier"] sau ["supplier", "maintenance_provider"])

### Reguli:
- O companie poate avea mai multe tipuri simultan
- Contactele sunt separate per relationship_type
- Contact assignment se salveaza pe fiecare document

## TEMA 3: MENTENANTA PLANIFICATA

### maintenance.planned_interventions
- id UUID PK, tenant_id, org_unit_id, machine_id FK
- intervention_type: 'preventive','predictive','upgrade','calibration','inspection'
- title, description, planned_start_date, planned_end_date, planned_duration_hours
- executor_type: 'internal'|'external', executor_company_id, executor_contact_id, internal_team_notes
- estimated_cost, actual_cost, cost_notes
- status: 'planned'→'confirmed'→'in_progress'→'completed'|'cancelled'
- confirmed_at/by, started_at, completed_at/by, completion_notes
- parts_used JSONB (ex: [{"itemId","itemName","qty","unitCost"}])
- is_recurring BOOLEAN, recurrence_rule JSONB, next_due_date, created_by, created_at

### machines.maintenance_schedules
- machine_id FK, schedule_name, trigger_type: 'hours'|'months'|'cycles'|'whichever_first'
- interval_hours, interval_months, interval_cycles
- last_performed_at, last_performed_hours, last_performed_cycles
- next_due_date, next_due_hours, next_due_cycles
- auto_create_intervention BOOLEAN, is_active BOOLEAN

### Reguli mentenanta:
- confirmed → masina indisponibila in planificator (planning.capacity_load cu available_hours=0)
- completed → actual_cost la cost masina; parts_used scazute din inventory; daca recurring → creeaza urmatoarea interventie
- Alert: maintenance_approaching (N zile inainte), maintenance_overdue (dupa next_due_date)

## TEMA 4: FURNIZORI PER ELEMENT

### inventory.item_suppliers
- item_id FK, supplier_company_id FK, supplier_contact_id FK
- is_primary BOOLEAN, priority INTEGER, unit_cost NUMERIC, currency
- min_order_qty, lead_time_days, last_purchase_date, last_purchase_cost
- notes, is_active, UNIQUE(item_id, supplier_company_id)

### inventory.purchase_history
- item_id FK, supplier_company_id FK, supplier_contact_id FK
- qty, unit_cost, total_cost, currency, invoice_number, purchase_date, delivery_date
- lot_number, quality_ok, notes, movement_id FK → inventory.movements

### Modificari machines.tools:
- supplier_company_id FK, purchase_cost, purchase_date, invoice_number, warranty_until

### Reguli furnizori:
- La receptie (movement type='receipt') → creeaza automat purchase_history
- Alerta daca pretul creste >10% fata de ultima achizitie
- Trend pret: GET /api/v1/inventory/items/:id/price-trend

## TEMA 5: MODEL COST COMPLET

### costs.cost_element_definitions (7 elemente default per tenant)
Elemente: machine_hourly, labor_hourly, material_direct, tooling_amortization, consumables, energy, overhead
- element_code, element_name, category, calculation_method, is_active, default_config, sort_order

### costs.machine_cost_config
- machine_id FK, config_mode: 'simple'|'detailed'
- simple: hourly_rate
- detailed: depreciation_hourly, energy_hourly, space_hourly, insurance_hourly, other_hourly
- power_kw, energy_price_per_kwh, valid_from, valid_to

### costs.operator_cost_config
- config_type: 'per_operator'|'per_skill_level'
- user_id sau skill_level_id, hourly_rate, overtime_rate, valid_from, valid_to

### costs.overhead_config
- overhead_name, overhead_type: 'percentage'|'fixed_monthly'|'per_piece', value, is_active

### machines.machines — adauga: power_kw NUMERIC(8,2)

### Formula calcul cost per piesa:
```
cost_masina = ore × machine_hourly_rate
cost_manopera = ore × operator_hourly_rate
cost_materiale = SUM(qty × waste_factor × supplier.unit_cost)
cost_scule = tool.purchase_cost / tool.max_cycles
cost_consumabile = consumption_rate × ore × unit_cost
cost_energie = machine.power_kw × ore × energy_price_per_kwh (daca detailed)
subtotal = SUM above
overhead = subtotal × SUM(overhead%) + SUM(fixed_monthly / piese_luna)
COST_TOTAL = subtotal + overhead
MARJA = (pret_vanzare - cost) / pret_vanzare × 100
```

---

## NAVIGATIE PER ROL

Meniul se construieste dinamic la login din: roluri user + permisiuni + module active.

### Structura meniu per rol:
- OPERATOR: NU are sidebar. Header fix + grid 2×2 butoane mari + bottom bar (Acasa/Tura Mea/Concediu/Profil). Full-screen tableta/mobil.
- SEF TURA: Dashboard Tura, Productie (rapoarte/opriri/OEE), Echipa, Mentenanta, Checklists, Rapoarte. Vede DOAR datele din tura + sectia lui.
- PLANIFICATOR: Dashboard, Planificare (Gantt/simulari/capacitate), CTP, BOM/MBOM, Comenzi, Masini, Rapoarte P/R/R
- DIRECTOR: Dashboard Executiv, Costuri & Profitabilitate, Comenzi, Productie OEE, Alerte, Rapoarte, Personal, Companii
- MENTENANTA: Dashboard, Interventii, Planificate, Scule & Matrite, Piese schimb, Rapoarte
- LOGISTICA: Dashboard Stocuri, Stocuri, Necesar Materiale, Furnizori, Import, Rapoarte
- VIEWER: Dashboards + Rapoarte read-only, fara butoane editare/creare
- ADMIN: Uniunea tuturor + Administrare (Organizatie/Utilizatori/Roluri/Module/Licenta/Setari)
- Roluri multiple: UNION meniuri, fara duplicate

### Config meniu: `frontend/src/config/menuConfig.js`
Functia `getMenuForUser(user)` — filtreaza pe module active + permisiuni. Structure: `{id, label, icon, path, permission, module, children[]}`

## RESPONSIVE — 3 LAYOUT-URI

- Desktop (>1024px): Sidebar stanga permanent 240px + continut dreapta + header sus
- Tableta (768-1024px): Sidebar colapsabil overlay, hamburger menu. EXCEPTIE operator: fara sidebar.
- Mobil (<768px): FARA sidebar, bottom navigation bar 4-5 iconite per rol, header compact

Bottom nav per rol (mobil):
- operator: Acasa|Productie|Mentenanta|Profil
- shift_leader: Dashboard|Productie|Echipa|Rapoarte|Profil  
- director: Dashboard|Costuri|Comenzi|Alerte|Profil
- maintenance: Dashboard|Interventii|Scule|Planificate|Profil
- logistics: Dashboard|Stocuri|Necesar|Import|Profil

Layout-uri: `AppLayout.jsx` (desktop/tablet/mobile detect) + `OperatorLayout.jsx` (special, fara sidebar, touch-friendly min-48px)

## TEMA CONFIGURABILA PER TENANT

### system.tenant_theme
- tenant_id UNIQUE FK, logo_url, logo_dark_url, favicon_url
- primary_color, secondary_color, accent_color, danger_color #FF4757, warning_color #FFB020, success_color #00D4AA
- sidebar_bg, header_bg, font_family DEFAULT 'DM Sans'
- dark_mode_enabled BOOLEAN, company_name_display, login_background_url, custom_css TEXT

### Aplicare:
- CSS variables pe :root: --color-primary, --color-sidebar-bg, etc.
- Logo in sidebar + pagina login
- GET /api/v1/theme/public (fara auth) pt pagina login → logo + company_name + primary_color
- Tema default: primary #00D4AA, sidebar #141B22, header #1C252F, font DM Sans
- Admin configureaza din Administrare → Setari → Tema (preview live, upload logo, color picker)

### Hook: `useTheme.jsx` — aplica tema din API, localStorage cache, dark mode toggle
