# PROMPTURI LIPSA — Module + Features
# Copiaza fiecare prompt in Claude Code cand ajungi la el

---

## MODUL: BOM (Bill of Materials & Costuri)

### Prompt BOM — Migrari

---INCEPUT PROMPT---
Creeaza migrari Knex pentru modulul BOM (Bill of Materials).

Tabele in schema "bom":

1. bom.products
   - id UUID PK, reference VARCHAR(100) UNIQUE NOT NULL,
     name VARCHAR(255) NOT NULL, variant VARCHAR(100),
     client_name VARCHAR(255), client_part_number VARCHAR(100),
     product_type VARCHAR(50) CHECK IN ('raw_material','semi_finished','finished','component') DEFAULT 'finished',
     container_type VARCHAR(100), qty_per_container INTEGER,
     weight_piece_kg NUMERIC(10,4), weight_runner_kg NUMERIC(10,4),
     material_type VARCHAR(100), notes TEXT, is_active BOOLEAN DEFAULT true,
     created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ

2. bom.operations
   - id UUID PK, product_id UUID FK → bom.products ON DELETE CASCADE,
     sequence INTEGER NOT NULL, operation_name VARCHAR(255) NOT NULL,
     operation_type VARCHAR(100), machine_type VARCHAR(100),
     machine_id UUID (optional FK → machines.machines),
     cycle_time_seconds NUMERIC(10,2), nr_cavities INTEGER DEFAULT 1,
     pieces_per_hour NUMERIC(10,2), setup_time_minutes INTEGER DEFAULT 0,
     description TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ,
     UNIQUE(product_id, sequence)

3. bom.materials
   - id UUID PK, product_id UUID FK → bom.products ON DELETE CASCADE,
     material_name VARCHAR(255) NOT NULL, material_code VARCHAR(100),
     material_type VARCHAR(100), qty_per_piece NUMERIC(10,6) NOT NULL,
     unit VARCHAR(20) DEFAULT 'kg', waste_factor NUMERIC(5,3) DEFAULT 1.0,
     supplier VARCHAR(255), notes TEXT, created_at TIMESTAMPTZ

4. bom.assembly_components
   - id UUID PK, parent_product_id UUID FK → bom.products,
     component_product_id UUID FK → bom.products,
     component_reference VARCHAR(100), component_name VARCHAR(255),
     qty_per_parent NUMERIC(10,4) DEFAULT 1, notes TEXT, created_at TIMESTAMPTZ

5. bom.cost_rates
   - id UUID PK, rate_type VARCHAR(50) CHECK IN ('machine_hourly','labor_hourly','overhead','material'),
     reference_id UUID, reference_name VARCHAR(255),
     rate_eur_per_hour NUMERIC(10,2), rate_eur_per_unit NUMERIC(10,4),
     valid_from DATE DEFAULT CURRENT_DATE, valid_to DATE, notes TEXT, created_at TIMESTAMPTZ

Ruleaza: npx knex migrate:latest
Verifica ca tabelele exista.
---SFARSIT PROMPT---


### Prompt BOM — Serviciu complet

---INCEPUT PROMPT---
Implementeaza modulul BOM complet.

Structura:
  src/modules/bom/bom.routes.js
  src/modules/bom/bom.controller.js
  src/modules/bom/bom.service.js
  src/modules/bom/bom.validation.js
  src/modules/bom/bom.test.js

Endpoints:

PRODUCTS:
GET /api/v1/bom/products — paginare, filtrare (type, client, active), cautare (reference+name)
GET /api/v1/bom/products/:id — include operations[], materials[], components[]
POST /api/v1/bom/products (admin+manager) — validare: reference (unic, required), name (required)
PUT /api/v1/bom/products/:id (admin+manager) — update partial

OPERATIONS (routing per produs):
GET /api/v1/bom/products/:productId/operations — ordonate dupa sequence
POST /api/v1/bom/products/:productId/operations (admin+manager)
  - Validare: sequence (required, unic per produs), operationName (required)
  - Daca cycleTimeSeconds si nrCavities sunt date, calculeaza piecesPerHour automat:
    piecesPerHour = (3600 / cycleTimeSeconds) * nrCavities
PUT /api/v1/bom/operations/:id (admin+manager)
DELETE /api/v1/bom/operations/:id (admin)

MATERIALS (BOM per produs):
GET /api/v1/bom/products/:productId/materials
POST /api/v1/bom/products/:productId/materials (admin+manager)
  - Validare: materialName (required), qtyPerPiece (required, pozitiv)
PUT /api/v1/bom/materials/:id (admin+manager)
DELETE /api/v1/bom/materials/:id (admin)

ASSEMBLY COMPONENTS:
GET /api/v1/bom/products/:productId/components
POST /api/v1/bom/products/:productId/components (admin+manager)

COST RATES:
GET /api/v1/bom/cost-rates
POST /api/v1/bom/cost-rates (admin)

COST CALCULATOR:
GET /api/v1/bom/products/:id/cost
  - Calculeaza automat cost per piesa:
    1. Material costs: SUM(qty_per_piece * waste_factor * rate_eur_per_unit) per material
    2. Operation costs: SUM((1/pieces_per_hour) * rate_eur_per_hour) per operatie
    3. Overhead: (material + operation) * overhead_rate (din cost_rates)
    4. Returneaza: {materialCosts[], operationCosts[], summary: {totalMaterial, totalOperation, overhead, totalCostPerPiece}}

Inregistreaza rutele in server.js.
Scrie teste: CRUD products, add operations, cost calculation.
npm test → trec.
---SFARSIT PROMPT---

---

## MODUL: Planning (Planificare Productie)

### Prompt Planning — Migrari

---INCEPUT PROMPT---
Creeaza migrari Knex pentru modulul Planning.

Tabele in schema "planning":

1. planning.master_plans
   - id UUID PK, name VARCHAR(255) NOT NULL, plan_type VARCHAR(20) CHECK IN ('weekly','monthly') DEFAULT 'weekly',
     week_number INTEGER, year INTEGER NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL,
     revision INTEGER DEFAULT 1, status VARCHAR(50) CHECK IN ('draft','active','closed','cancelled') DEFAULT 'draft',
     created_by UUID, notes TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ

2. planning.daily_allocations
   - id UUID PK, master_plan_id UUID FK → planning.master_plans ON DELETE CASCADE,
     plan_date DATE NOT NULL, shift VARCHAR(20) NOT NULL,
     machine_id UUID NOT NULL, product_id UUID, product_reference VARCHAR(100), product_name VARCHAR(255),
     order_id UUID, planned_qty INTEGER DEFAULT 0, realized_qty INTEGER DEFAULT 0, scrap_qty INTEGER DEFAULT 0,
     planned_hours NUMERIC(6,2), status VARCHAR(50) CHECK IN ('planned','in_progress','completed','cancelled') DEFAULT 'planned',
     notes TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
   - INDEX pe (plan_date), (machine_id, plan_date), (master_plan_id)

3. planning.capacity_load
   - id UUID PK, machine_id UUID NOT NULL, plan_date DATE NOT NULL,
     available_hours NUMERIC(6,2) DEFAULT 16, planned_hours NUMERIC(6,2) DEFAULT 0,
     load_percent NUMERIC(5,2) DEFAULT 0, master_plan_id UUID FK,
     updated_at TIMESTAMPTZ, UNIQUE(machine_id, plan_date)

4. planning.customer_demands
   - id UUID PK, client_name VARCHAR(255), product_id UUID, product_reference VARCHAR(100) NOT NULL,
     demand_date DATE NOT NULL, required_qty INTEGER NOT NULL, delivery_date DATE,
     priority VARCHAR(20) CHECK IN ('low','normal','high','urgent') DEFAULT 'normal',
     status VARCHAR(50) CHECK IN ('open','planned','fulfilled','cancelled') DEFAULT 'open',
     imported_at TIMESTAMPTZ, notes TEXT
   - INDEX pe (demand_date), (product_reference)

Ruleaza migrarile.
---SFARSIT PROMPT---


### Prompt Planning — Serviciu complet

---INCEPUT PROMPT---
Implementeaza modulul Planning complet.

Structura: src/modules/planning/ cu routes, controller, service, validation, test.

Endpoints:

MASTER PLANS:
GET /api/v1/planning/master-plans — paginare, filtrare (status, year)
GET /api/v1/planning/master-plans/:id — include allocations[] si capacity[]
POST /api/v1/planning/master-plans (admin+manager)
  - Validare: name (required), startDate (required, date), endDate (required, date, > startDate), year, weekNumber
PUT /api/v1/planning/master-plans/:id — update name, status, revision, notes

DAILY ALLOCATIONS:
GET /api/v1/planning/allocations — filtrare: planId, date, dateFrom, dateTo, machineId, shift
POST /api/v1/planning/allocations (admin+manager)
  - Validare: masterPlanId, planDate, shift, machineId (toate required)
  - Dupa creare: recalculeaza capacity_load pt masina+data
    capacity_load.planned_hours = SUM(planned_hours) din toate alocariie pt masina+data
    capacity_load.load_percent = (planned_hours / available_hours) * 100
POST /api/v1/planning/allocations/bulk (admin+manager)
  - Primeste {masterPlanId, allocations: [{planDate, shift, machineId, productReference, productName, plannedQty, plannedHours}]}
  - Insereaza toate, recalculeaza capacity
PUT /api/v1/planning/allocations/:id — update plannedQty, realizedQty, scrapQty, status
  - Recalculeaza capacity dupa update
DELETE /api/v1/planning/allocations/:id — sterge + recalculeaza capacity

CAPACITY:
GET /api/v1/planning/capacity — filtrare: dateFrom, dateTo, machineId
  - Join cu machines pentru code + name

CUSTOMER DEMANDS:
GET /api/v1/planning/demands — filtrare: status, dateFrom, dateTo, productReference
POST /api/v1/planning/demands (admin+manager)
POST /api/v1/planning/demands/bulk (admin+manager)
  - Primeste {demands: [{clientName, productReference, demandDate, requiredQty, deliveryDate}]}

DASHBOARD:
GET /api/v1/planning/dashboard?weekStart=YYYY-MM-DD
  - Calculeaza pt saptamana data:
    kpis: {avgLoad, overloadedSlots (load > 100%), totalPlanned, totalDemand, coveragePercent}
    capacity: [{machineCode, machineName, planDate, availableHours, plannedHours, loadPercent}]
    productSummary: [{product, planned, realized, scrap}]
    openDemands count

Teste: CRUD master plan, creare alocari, verificare recalculare capacity, bulk import.
npm test → trec.
---SFARSIT PROMPT---

---

## MODUL: Inventory (Stocuri & Necesar Materiale)

### Prompt Inventory — Migrari

---INCEPUT PROMPT---
Creeaza migrari Knex pentru modulul Inventory.

Tabele in schema "inventory":

1. inventory.items
   - id UUID PK, code VARCHAR(100) UNIQUE NOT NULL, name VARCHAR(255) NOT NULL,
     category VARCHAR(50) CHECK IN ('raw_material','semi_finished','finished_good','consumable','packaging','spare_part','tool') NOT NULL,
     unit VARCHAR(20) DEFAULT 'buc', product_id UUID (FK optional → bom.products),
     supplier_name VARCHAR(255), supplier_code VARCHAR(100),
     min_stock NUMERIC(12,2) DEFAULT 0, max_stock NUMERIC(12,2), reorder_qty NUMERIC(12,2),
     lead_time_days INTEGER, location VARCHAR(255), weight_per_unit_kg NUMERIC(10,4),
     cost_per_unit NUMERIC(12,4), is_active BOOLEAN DEFAULT true,
     created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ

2. inventory.stock_levels
   - id UUID PK, item_id UUID FK → inventory.items UNIQUE ON DELETE CASCADE,
     current_qty NUMERIC(12,2) DEFAULT 0, reserved_qty NUMERIC(12,2) DEFAULT 0,
     available_qty NUMERIC(12,2) GENERATED ALWAYS AS (current_qty - reserved_qty) STORED,
     last_movement_at TIMESTAMPTZ, updated_at TIMESTAMPTZ

3. inventory.movements
   - id UUID PK, item_id UUID FK → inventory.items,
     movement_type VARCHAR(50) CHECK IN ('receipt','production_input','production_output','shipment','adjustment_plus','adjustment_minus','scrap','return_supplier','transfer') NOT NULL,
     qty NUMERIC(12,2) NOT NULL (pozitiv=intrare, negativ=iesire),
     reference_type VARCHAR(50), reference_id UUID, reference_number VARCHAR(100),
     lot_number VARCHAR(100), supplier_name VARCHAR(255),
     unit_cost NUMERIC(12,4), total_cost NUMERIC(12,4),
     location VARCHAR(255), performed_by UUID, notes TEXT, created_at TIMESTAMPTZ
   - INDEX pe (item_id, created_at), (movement_type), (reference_id)

4. inventory.material_requirements
   - id UUID PK, order_id UUID, product_reference VARCHAR(100), product_name VARCHAR(255),
     material_code VARCHAR(100), material_name VARCHAR(255),
     required_qty NUMERIC(12,4) NOT NULL, available_qty NUMERIC(12,4), shortage_qty NUMERIC(12,4),
     unit VARCHAR(20), status VARCHAR(50) CHECK IN ('calculated','ordered','received','fulfilled') DEFAULT 'calculated',
     calculated_at TIMESTAMPTZ, plan_date DATE, notes TEXT

5. inventory.warehouse_documents
   - id UUID PK, document_type VARCHAR(50) CHECK IN ('receipt_note','issue_note','transfer_note','return_note') NOT NULL,
     document_number VARCHAR(100) UNIQUE NOT NULL, document_date DATE DEFAULT CURRENT_DATE,
     partner_name VARCHAR(255), status VARCHAR(50) CHECK IN ('draft','confirmed','cancelled') DEFAULT 'draft',
     total_value NUMERIC(12,2), created_by UUID, confirmed_by UUID, confirmed_at TIMESTAMPTZ,
     notes TEXT, created_at TIMESTAMPTZ

6. inventory.warehouse_document_lines
   - id UUID PK, document_id UUID FK → warehouse_documents ON DELETE CASCADE,
     item_id UUID FK → inventory.items, item_code VARCHAR(100), item_name VARCHAR(255),
     qty NUMERIC(12,2) NOT NULL, unit VARCHAR(20), unit_cost NUMERIC(12,4),
     total_cost NUMERIC(12,4), lot_number VARCHAR(100), notes TEXT

Ruleaza migrarile.
---SFARSIT PROMPT---


### Prompt Inventory — Serviciu complet

---INCEPUT PROMPT---
Implementeaza modulul Inventory complet.

Structura: src/modules/inventory/ cu routes, controller, service, validation, test.

Endpoints:

ITEMS:
GET /api/v1/inventory/items — paginare, filtrare (category, search, belowMin=true)
  - Join cu stock_levels pentru current_qty, available_qty
POST /api/v1/inventory/items (admin+manager)
  - La creare: insereaza automat si un rand in stock_levels cu current_qty=0
PUT /api/v1/inventory/items/:id

STOCK LEVELS:
GET /api/v1/inventory/stock-levels — join cu items, ordonate dupa name
GET /api/v1/inventory/alerts
  - belowMin: items unde current_qty <= min_stock
  - aboveMax: items unde current_qty > max_stock
  - Returneaza: {belowMin[], aboveMax[], totalAlerts}

MOVEMENTS:
GET /api/v1/inventory/movements — filtrare: itemId, type, from (date), to (date)
POST /api/v1/inventory/movements (operator+shift_leader+admin+manager)
  - Validare: itemId (required, exista), movementType (required, enum), qty (required, pozitiv)
  - TRANZACTIE DB:
    1. Determina semnul: receipt/production_output/adjustment_plus → pozitiv, restul → negativ
    2. Insereaza movement cu qty semnat
    3. Update stock_levels: current_qty += signed_qty, last_movement_at = now()
    4. DACA current_qty ar deveni negativ → REJECT cu eroare "Stoc insuficient"
  - Audit log

MATERIAL REQUIREMENTS:
GET /api/v1/inventory/material-requirements — filtrare: status, planDate
POST /api/v1/inventory/material-requirements/calculate (admin+manager)
  - Primeste: {orderIds: []} (optional, default = toate comenzile active)
  - Pentru fiecare comanda:
    1. Gaseste produsul BOM dupa product_code sau product_name
    2. Ia materialele din bom.materials
    3. required_qty = target_quantity * qty_per_piece * waste_factor
    4. available_qty = stock_levels.current_qty pt materialul respectiv
    5. shortage_qty = max(required - available, 0)
  - Sterge vechile requirements cu status='calculated'
  - Insereaza noile requirements
  - Returneaza lista cu shortages

WAREHOUSE DOCUMENTS:
GET /api/v1/inventory/documents — filtrare: type, status
GET /api/v1/inventory/documents/:id — include lines[]
POST /api/v1/inventory/documents (admin+manager+shift_leader)
  - Genereaza document_number automat: NIR-00001 (receipt), BC-00001 (issue), TR-00001 (transfer)
  - Primeste: {documentType, partnerName, lines: [{itemId, qty, unitCost, lotNumber}], notes}
  - Status: 'draft'
PUT /api/v1/inventory/documents/:id/confirm (admin+manager)
  - TRANZACTIE DB:
    1. Pentru fiecare linie:
       - Determina movement_type din document_type (receipt_note → receipt, issue_note → production_input)
       - Creeaza movement (ca la POST movements)
       - Update stock_levels
    2. Seteaza document status='confirmed', confirmed_by, confirmed_at
  - Audit log

DASHBOARD:
GET /api/v1/inventory/dashboard
  - totalItems, alertsCount (below min), totalStockValue (SUM qty * cost_per_unit), recentMovements (10)

Teste: CRUD items, creare movement + verificare stock update, tranzactie stock insuficient → rollback,
document confirm → movements create, material requirements calculate.
npm test → trec.
---SFARSIT PROMPT---

---

## MODUL: Companies (CRM minimal)

### Prompt Companies — Migrari + Serviciu

---INCEPUT PROMPT---
Creeaza migrari Knex si implementeaza modulul Companies (CRM minimal).

Tabele in schema "companies":

1. companies.companies
   - id UUID PK, name VARCHAR(255) NOT NULL, company_type VARCHAR(50) CHECK IN ('client','supplier','prospect','both') NOT NULL,
     fiscal_code VARCHAR(50), trade_register VARCHAR(50), address TEXT,
     city VARCHAR(100), country VARCHAR(100) DEFAULT 'Romania',
     phone VARCHAR(50), email VARCHAR(255), website VARCHAR(255),
     payment_terms_days INTEGER DEFAULT 30, notes TEXT,
     is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ

2. companies.contacts
   - id UUID PK, company_id UUID FK → companies ON DELETE CASCADE,
     full_name VARCHAR(255) NOT NULL, role VARCHAR(100),
     phone VARCHAR(50), email VARCHAR(255), is_primary BOOLEAN DEFAULT false,
     notes TEXT, created_at TIMESTAMPTZ

Structura: src/modules/companies/ cu routes, controller, service, validation, test.

Endpoints:
GET /api/v1/companies — paginare, filtrare (companyType, active), cautare (name)
GET /api/v1/companies/:id — include contacts[]
POST /api/v1/companies (admin+manager)
PUT /api/v1/companies/:id (admin+manager)
DELETE /api/v1/companies/:id (admin) — soft delete

GET /api/v1/companies/:companyId/contacts
POST /api/v1/companies/:companyId/contacts (admin+manager)
PUT /api/v1/companies/contacts/:id (admin+manager)
DELETE /api/v1/companies/contacts/:id (admin)

Teste: CRUD companii + contacte.
npm test → trec.
---SFARSIT PROMPT---

---

## FEATURE: Import Excel

---INCEPUT PROMPT---
Implementeaza import Excel folosind ExcelJS.

Fisiere:
  src/services/excel.service.js — functii generice de citire/scriere Excel
  src/modules/production/import.routes.js
  src/modules/bom/import.routes.js
  src/modules/planning/import.routes.js

Endpoint-uri:

POST /api/v1/import/machines (admin+manager)
  - Accepta fisier .xlsx (multipart/form-data, foloseste multer)
  - Coloane asteptate: Cod, Denumire, Tip, Locatie, Timp Ciclu (sec)
  - Valideaza fiecare rand, skip-uieste randurile invalide
  - Returneaza: {imported: 5, skipped: 2, errors: [{row: 3, error: "Cod duplicat"}]}

POST /api/v1/import/products (admin+manager)
  - Coloane: Referinta, Denumire, Varianta, Client, Material, Masa Piesa, Container, Qty/Container
  - Import in bom.products

POST /api/v1/import/demands (admin+manager)
  - Coloane: Referinta Produs, Data Cerere, Cantitate, Data Livrare
  - Import in planning.customer_demands

POST /api/v1/import/planning (admin+manager)
  - Coloane: Data, Tura, Cod Masina, Referinta Produs, Denumire, Cantitate Planificata, Ore Planificate
  - Creeaza sau gaseste master_plan pentru saptamana respectiva
  - Insereaza daily_allocations
  - Recalculeaza capacity_load

GET /api/v1/export/template/:type (machines/products/demands/planning)
  - Genereaza un Excel gol cu headerele corecte — clientul il descarca si il completeaza

Instaleaza multer pentru upload: npm install multer
Creeaza folder uploads/ pentru fisierele temporare.
Teste: import Excel valid, import cu erori, export template.
---SFARSIT PROMPT---

---

## FEATURE: Export PDF

---INCEPUT PROMPT---
Implementeaza export PDF folosind PDFKit.

Fisiere:
  src/services/pdf.service.js — functii generice de generare PDF
  src/modules/production/export.routes.js

Endpoint-uri:

GET /api/v1/export/production-report?date=YYYY-MM-DD&machineId=xxx
  - Genereaza PDF cu:
    Header: "ShopFloor.ro — Raport Productie" + data + tura
    Tabel: Masina | Comanda | Produs | Planificat | Realizat | Rebuturi | OEE
    Footer: Generat la [timestamp]
  - Content-Type: application/pdf
  - Content-Disposition: attachment; filename="raport-productie-2026-03-29.pdf"

GET /api/v1/export/oee-report?dateFrom=...&dateTo=...
  - Raport OEE pe perioada, per masina
  - Include grafic bar chart simplu cu OEE per masina (folosind PDFKit graphics)

GET /api/v1/export/maintenance-report?dateFrom=...&dateTo=...
  - Lista interventii cu: numar, masina, problema, status, durata rezolvare

GET /api/v1/export/inventory-report
  - Lista stocuri cu: cod, denumire, stoc curent, minim, status (OK/ALERTA)

Toate PDF-urile au:
  - Logo ShopFloor.ro (text, nu imagine)
  - Data generarii
  - Numar pagina
  - Font consistent

Teste: generare PDF valid (verifica ca returneaza buffer si content-type corect).
---SFARSIT PROMPT---

---

## FEATURE: Notificari Email

---INCEPUT PROMPT---
Implementeaza notificari email folosind Resend (resend.com).

Fisiere:
  src/services/email.service.js
  src/config/email.js

Configurare:
  .env: RESEND_API_KEY=re_xxxxx, EMAIL_FROM=notificari@shopfloor.ro

src/services/email.service.js:
  - Functie sendEmail({to, subject, html})
  - Functie sendNotification({type, data}) — determina templateul si destinatarii

Notificari automate (trimise din controller-ele existente):

1. Cerere mentenanta noua (priority high/critical)
   → Email la toti userii cu rol "maintenance"
   → Subject: "[URGENT] Cerere mentenanta: {machineCode} — {problemType}"
   → Body: detalii cerere + link catre aplicatie

2. Oprire masina (categorie "Defect utilaj")
   → Email la production_manager
   → Subject: "Oprire masina: {machineCode} — {reason}"

3. Stoc sub minim
   → Email la production_manager
   → Subject: "ALERTA STOC: {itemName} — {currentQty}/{minStock}"

4. OEE sub 60% la sfarsit de tura
   → Email la production_manager
   → Subject: "OEE scazut: {machineCode} — {oee}%"

Adauga in .env.example: RESEND_API_KEY, EMAIL_FROM, NOTIFICATIONS_ENABLED (true/false).
Daca NOTIFICATIONS_ENABLED=false, doar logheaza fara sa trimita (pentru development).

Teste: mock Resend API, verifica ca se apeleaza cu parametrii corecti.
---SFARSIT PROMPT---

---

## FEATURE: PWA + Offline

---INCEPUT PROMPT---
Configureaza frontend-ul React ca PWA cu suport offline.

1. Creeaza public/manifest.json:
   - name: "ShopFloor.ro", short_name: "ShopFloor"
   - theme_color: "#00d4aa", background_color: "#0C1015"
   - display: "standalone", orientation: "portrait"
   - icons: genereaza un SVG simplu cu literele "SF" ca icon 192x192 si 512x512

2. Creeaza src/sw.js (service worker):
   - Cache static assets (HTML, CSS, JS) la install
   - Network-first strategy pentru API calls
   - Daca offline si API call esueaza → returneaza din cache sau
     salveaza in IndexedDB si sincronizeaza cand revine online

3. Offline queue pentru rapoarte productie:
   - Cand operatorul raporteaza piese si nu e internet:
     a. Salveaza raportul in IndexedDB (pending_reports)
     b. Arata confirmare cu badge "Se va sincroniza cand revine internetul"
     c. Cand revine online: trimite toate rapoartele din coada, in ordine
     d. Sterge din IndexedDB dupa confirmare server
   - Acelasi mecanism pentru: stops, maintenance requests

4. In frontend:
   - Indicator vizual online/offline (bara verde/rosie sus)
   - Badge pe butonul de raportare daca sunt rapoarte nesincronizate
   - La reconectare: notificare "X rapoarte sincronizate"

5. Inregistreaza service worker-ul in main.jsx
6. Adauga meta tag-uri PWA in index.html

Testeaza: opreste wifi-ul, raporteaza piese, porneste wifi-ul, verifica sincronizarea.
---SFARSIT PROMPT---

---

## FEATURE: Deploy pe Hetzner

---INCEPUT PROMPT---
Pregateste proiectul pentru deploy pe Hetzner Cloud.

1. Creeaza Dockerfile (production):
   - FROM node:20-alpine
   - COPY package.json + npm ci --production
   - COPY src/
   - USER node (nu root)
   - CMD ["node", "src/server.js"]

2. Creeaza docker-compose.prod.yml:
   - postgres: volume persistent, healthcheck, restart: always
   - app: build din Dockerfile, env_file .env, depends_on postgres, restart: always
   - nginx: image nginx:alpine, volumes cu nginx.conf si certbot, ports 80+443, restart: always

3. Creeaza nginx/nginx.conf:
   - Reverse proxy: / → app:3001
   - SSL cu certificate Let's Encrypt
   - Gzip compression
   - Security headers
   - Rate limiting

4. Creeaza scripts/deploy.sh:
   - Primeste parametru: numele clientului
   - Se conecteaza la server Hetzner via SSH
   - Creeaza folder /opt/shopfloor/{client}
   - Copiaza docker-compose.prod.yml, nginx.conf, .env
   - Genereaza parola DB si JWT secret random
   - Ruleaza docker compose up -d
   - Ruleaza npx knex migrate:latest (in container)
   - Ruleaza npx knex seed:run (admin user)
   - Configureaza SSL cu certbot
   - Printeaza: URL, email admin, parola admin

5. Creeaza scripts/backup.sh:
   - pg_dump zilnic la 03:00 (cron)
   - Comprima cu gzip
   - Pastreaza ultimele 30 backup-uri
   - Sterge cele mai vechi

6. Creeaza scripts/restore.sh:
   - Restaureaza din backup specificat

Toate scripturile cu comentarii clare.
---SFARSIT PROMPT---

---

## ORDINE RECOMANDATA

Dupa ce termini modulele core (auth, machines, production, maintenance, checklists):

Sesiune N+1: BOM migrari
Sesiune N+2: BOM serviciu
Sesiune N+3: Planning migrari
Sesiune N+4: Planning serviciu
Sesiune N+5: Inventory migrari
Sesiune N+6: Inventory serviciu
Sesiune N+7: Companies migrari + serviciu
Sesiune N+8: Frontend — pagini BOM, Planning, Inventory
Sesiune N+9: Import Excel
Sesiune N+10: Export PDF
Sesiune N+11: Notificari Email
Sesiune N+12: PWA + Offline
Sesiune N+13: Deploy pe Hetzner
