# INTERCONECTARE DATE — 5 TEME
# Partea 1: CLAUDE.MD | Partea 2: Prompturi

# ═══════════════════════════════════════
# PARTEA 1: ADAUGA IN CLAUDE.MD
# ═══════════════════════════════════════

## TEMA 1: PATTERN DROPDOWN CU CAUTARE + CREARE INLINE

Pattern UI global. Component reutilizabil: <SearchableSelect>
- Input text → filtreaza lista live (cautare in name + code)
- Ultimul element: "+ Adauga [entitate] nou"
- Click → mini-modal cu campuri minime (2-3 campuri)
- Salveaza → selecteaza automat entitatea creata → inchide modal
- Se aplica pe TOATE dropdown-urile: companie, contact, furnizor, masina, produs, material, scula

Componenta: src/frontend/src/components/SearchableSelect.jsx
Props: {endpoint, labelField, valueField, createEndpoint, createFields[], placeholder, onChange}

## TEMA 2: CONTACTE PER CONTEXT

### Modificari companies.contacts — adauga coloane:
  - relationship_type VARCHAR(20) CHECK IN ('client_contact','supplier_contact','maintenance_contact','other') NOT NULL
  - context_tags JSONB DEFAULT '[]'
    (ex: ["comenzi_cnc", "comenzi_injectie", "calitate"])
  - department VARCHAR(100)

### companies.contact_assignments (leaga contact de document specific)
  - id UUID PK
  - contact_id UUID FK → companies.contacts
  - entity_type VARCHAR(50) NOT NULL (ex: 'order', 'purchase', 'maintenance_intervention')
  - entity_id UUID NOT NULL
  - role_in_context VARCHAR(100) (ex: "Responsabil comanda", "Contact livrare")
  - assigned_at TIMESTAMPTZ
  - assigned_by UUID
  - INDEX pe (entity_type, entity_id)

### Modificari companies.companies — adauga coloana:
  - company_types JSONB DEFAULT '["client"]'
    (ex: ["client", "supplier"] sau ["supplier", "maintenance_provider"])
    Inlocuieste company_type VARCHAR simplu

### Reguli:
  - O companie poate avea mai multe tipuri simultan
  - Contactele sunt separate per relationship_type
  - La selectie contact pe comanda: filtreaza automat pe companie + relationship_type='client_contact' + context_tags matching
  - La selectie contact pe achizitie: filtreaza pe relationship_type='supplier_contact'
  - Contact assignment se salveaza pe fiecare document (comanda, achizitie, mentenanta)

## TEMA 3: MENTENANTA PLANIFICATA

### maintenance.planned_interventions
  - id UUID PK
  - tenant_id UUID FK, org_unit_id UUID FK
  - machine_id UUID FK → machines.machines NOT NULL
  - intervention_type VARCHAR(50) CHECK IN ('preventive','predictive','upgrade','calibration','inspection')
  - title VARCHAR(255) NOT NULL
  - description TEXT
  - planned_start_date DATE NOT NULL
  - planned_end_date DATE NOT NULL
  - planned_duration_hours NUMERIC(6,2)
  --- Executant:
  - executor_type VARCHAR(20) CHECK IN ('internal','external') NOT NULL
  - executor_company_id UUID FK → companies.companies (daca external)
  - executor_contact_id UUID FK → companies.contacts (daca external)
  - internal_team_notes TEXT (daca internal)
  --- Cost:
  - estimated_cost NUMERIC(12,2)
  - actual_cost NUMERIC(12,2)
  - cost_notes TEXT
  --- Status flow:
  - status VARCHAR(30) CHECK IN ('planned','confirmed','in_progress','completed','cancelled') DEFAULT 'planned'
  - confirmed_at TIMESTAMPTZ
  - confirmed_by UUID
  - started_at TIMESTAMPTZ
  - completed_at TIMESTAMPTZ
  - completed_by UUID
  - completion_notes TEXT
  --- Piese de schimb:
  - parts_used JSONB[]
    (ex: [{"itemId": "uuid", "itemName": "Rulment SKF 6205", "qty": 2, "unitCost": 45}])
  --- Recurenta:
  - is_recurring BOOLEAN DEFAULT false
  - recurrence_rule JSONB
    (ex: {"type": "hours", "interval": 2000} sau {"type": "months", "interval": 6} sau {"type": "cycles", "interval": 50000})
  - next_due_date DATE (calculat automat dupa completare)
  - created_by UUID, created_at TIMESTAMPTZ

### machines.maintenance_schedules (configurare intervale per masina)
  - id UUID PK
  - machine_id UUID FK → machines.machines
  - schedule_name VARCHAR(255) (ex: "Revizie generala", "Schimb ulei")
  - trigger_type VARCHAR(20) CHECK IN ('hours','months','cycles','whichever_first')
  - interval_hours INTEGER
  - interval_months INTEGER
  - interval_cycles INTEGER
  - last_performed_at TIMESTAMPTZ
  - last_performed_hours NUMERIC(10,2)
  - last_performed_cycles INTEGER
  - next_due_date DATE (calculat)
  - next_due_hours NUMERIC(10,2)
  - next_due_cycles INTEGER
  - auto_create_intervention BOOLEAN DEFAULT true
  - is_active BOOLEAN DEFAULT true

### Reguli mentenanta:
  - Cand status → 'confirmed': masina devine indisponibila in planificator pe perioada planned_start → planned_end
  - Cand status → 'completed': 
    a. actual_cost se adauga la costul de operare masina
    b. parts_used se scad din inventory (creeaza movements automat)
    c. Daca is_recurring: calculeaza next_due_date si creeaza automat urmatoarea interventie planned
    d. Actualizeaza maintenance_schedule (last_performed_at, recalculeaza next_due)
  - Alert (F7): cand next_due_date se apropie (configurable: 7/14/30 zile inainte)

## TEMA 4: FURNIZORI PER ELEMENT

### inventory.item_suppliers (furnizori per articol)
  - id UUID PK
  - item_id UUID FK → inventory.items
  - supplier_company_id UUID FK → companies.companies NOT NULL
  - supplier_contact_id UUID FK → companies.contacts
  - is_primary BOOLEAN DEFAULT false (un singur primary per item)
  - priority INTEGER DEFAULT 1 (1 = primul ales, 2 = alternativ, etc)
  - unit_cost NUMERIC(12,4) NOT NULL
  - currency VARCHAR(3) DEFAULT 'EUR'
  - min_order_qty NUMERIC(12,2)
  - lead_time_days INTEGER
  - last_purchase_date DATE
  - last_purchase_cost NUMERIC(12,4)
  - notes TEXT
  - is_active BOOLEAN DEFAULT true
  - UNIQUE(item_id, supplier_company_id)

### inventory.purchase_history (istoric achizitii)
  - id UUID PK
  - item_id UUID FK → inventory.items
  - supplier_company_id UUID FK → companies.companies
  - supplier_contact_id UUID FK → companies.contacts
  - qty NUMERIC(12,2) NOT NULL
  - unit_cost NUMERIC(12,4) NOT NULL
  - total_cost NUMERIC(12,2)
  - currency VARCHAR(3) DEFAULT 'EUR'
  - invoice_number VARCHAR(100)
  - purchase_date DATE NOT NULL
  - delivery_date DATE
  - lot_number VARCHAR(100)
  - quality_ok BOOLEAN DEFAULT true
  - notes TEXT
  - movement_id UUID FK → inventory.movements (legatura la miscarea de stoc)
  - created_at TIMESTAMPTZ

### Modificari machines.tools — adauga coloane:
  - supplier_company_id UUID FK → companies.companies
  - purchase_cost NUMERIC(12,2)
  - purchase_date DATE
  - invoice_number VARCHAR(100)
  - warranty_until DATE

### Reguli furnizori:
  - Fiecare articol (material, consumabil, piesa schimb) are 1+ furnizori cu prioritate
  - Furnizorul primary e cel folosit default la calculul de cost si la sugestii reaprovizionare
  - La fiecare receptie (inventory.movement type='receipt') se creeaza automat purchase_history
  - Trend pret: GET /api/v1/inventory/items/:id/price-trend → grafic cu pret per achizitie in timp
  - Alerta daca pretul creste >10% fata de ultima achizitie

## TEMA 5: MODEL COST COMPLET

### costs.cost_element_definitions (elemente de cost configurabile per tenant)
  - id UUID PK
  - tenant_id UUID FK → system.tenants
  - element_code VARCHAR(50) UNIQUE NOT NULL
  - element_name VARCHAR(255) NOT NULL
  - category VARCHAR(50) CHECK IN ('machine','labor','material','tooling','consumable','energy','overhead','custom')
  - is_active BOOLEAN DEFAULT true (fabrica activeaza/dezactiveaza)
  - calculation_method VARCHAR(50) CHECK IN ('hourly_rate','per_piece','per_kg','percentage','fixed','custom_formula')
  - default_config JSONB
  - sort_order INTEGER

Seed elements default:
  1. machine_hourly | "Cost orar masina" | machine | hourly_rate
  2. labor_hourly | "Cost orar manopera" | labor | hourly_rate
  3. material_direct | "Cost materiale directe" | material | per_kg
  4. tooling_amortization | "Amortizare scule/matrite" | tooling | per_piece
  5. consumables | "Consumabile (ulei, lavete)" | consumable | hourly_rate
  6. energy | "Energie electrica" | energy | hourly_rate
  7. overhead | "Overhead fabrica" | overhead | percentage

### costs.machine_cost_config (cost per masina — simplu sau defalcat)
  - id UUID PK
  - machine_id UUID FK → machines.machines
  - config_mode VARCHAR(20) CHECK IN ('simple','detailed') DEFAULT 'simple'
  --- Simple mode (un singur numar):
  - hourly_rate NUMERIC(10,2) (ex: €25/ora, include tot)
  --- Detailed mode (defalcat):
  - depreciation_hourly NUMERIC(10,2)
  - energy_hourly NUMERIC(10,2)
  - space_hourly NUMERIC(10,2) (chirie/mp alocat masinii)
  - insurance_hourly NUMERIC(10,2)
  - other_hourly NUMERIC(10,2)
  --- Energie:
  - power_kw NUMERIC(8,2) (puterea masinii in kW)
  - energy_price_per_kwh NUMERIC(8,4) (pret curent kWh)
  - valid_from DATE, valid_to DATE
  - UNIQUE(machine_id, valid_from)

### costs.operator_cost_config (cost per operator sau per skill level)
  - id UUID PK
  - tenant_id UUID FK
  - config_type VARCHAR(20) CHECK IN ('per_operator','per_skill_level')
  --- Per operator:
  - user_id UUID FK → auth.users
  --- Per skill level:
  - skill_level_id UUID FK → auth.skill_level_definitions
  --- Rates:
  - hourly_rate NUMERIC(10,2) NOT NULL
  - overtime_rate NUMERIC(10,2)
  - valid_from DATE, valid_to DATE

### costs.overhead_config (overhead configurabil per tenant)
  - id UUID PK
  - tenant_id UUID FK
  - overhead_name VARCHAR(255) (ex: "Administrativ", "Management", "Chirie")
  - overhead_type VARCHAR(20) CHECK IN ('percentage','fixed_monthly','per_piece')
  - value NUMERIC(10,4) (ex: 15 = 15%, sau 5000 = €5000/luna)
  - is_active BOOLEAN DEFAULT true

### Modificari machines.machines — adauga coloana:
  - power_kw NUMERIC(8,2) (puterea electrica in kW)

### Calcul cost complet per piesa (formula):

```
cost_masina = SUM per operatie(ore_pe_masina × machine_cost_config.hourly_rate)
  Daca detailed: hourly_rate = depreciation + energy + space + insurance + other
  Daca energy separat: energy = power_kw × ore × energy_price_per_kwh

cost_manopera = SUM per operatie(ore_operator × operator_cost_config.hourly_rate)
  Daca overtime: ore_overtime × overtime_rate

cost_materiale = SUM per material_din_BOM(qty_per_piece × waste_factor × supplier.unit_cost)

cost_scule = SUM per scula_utilizata(tool.purchase_cost / tool.max_cycles)

cost_consumabile = SUM per consumabil(consumption_rate_per_hour × ore_functionare × unit_cost)

cost_energie = SUM per operatie(machine.power_kw × ore × energy_price_per_kwh)
  (doar daca elementul 'energy' e activ si config_mode='detailed')

subtotal = cost_masina + cost_manopera + cost_materiale + cost_scule + cost_consumabile + cost_energie

overhead = subtotal × SUM(overhead_config.value / 100) pt fiecare overhead activ de tip 'percentage'
         + SUM(overhead_config.value / nr_piese_luna) pt fiecare overhead de tip 'fixed_monthly'

COST_TOTAL_PER_PIESA = subtotal + overhead
COST_TOTAL_COMANDA = cost_per_piesa × cantitate
MARJA = (pret_vanzare_per_piesa - cost_per_piesa) / pret_vanzare_per_piesa × 100
```

# ═══════════════════════════════════════
# PARTEA 2: PROMPTURI CLAUDE CODE
# ═══════════════════════════════════════

## PROMPT INTERCONECTARE-1: Contacte per context + Companii update

---INCEPUT PROMPT---
Citeste CLAUDE.MD sectiunile Tema 2 si Tema 4.

1. Migrari:
   - ALTER TABLE companies.companies: inlocuieste company_type VARCHAR cu company_types JSONB DEFAULT '["client"]'
   - ALTER TABLE companies.contacts: adauga relationship_type, context_tags JSONB, department
   - CREATE TABLE companies.contact_assignments
   - CREATE TABLE inventory.item_suppliers
   - CREATE TABLE inventory.purchase_history
   - ALTER TABLE machines.tools: adauga supplier_company_id, purchase_cost, purchase_date, invoice_number, warranty_until

2. Actualizeaza modulul companies (src/modules/companies/):
   - PUT /api/v1/companies/:id — accepta company_types ca array
   - POST /api/v1/companies/:companyId/contacts — accepta relationship_type, context_tags[], department
   - GET /api/v1/companies/:companyId/contacts?relationshipType=&contextTag= — filtrare

3. Endpoint-uri noi contacte per document:
   POST /api/v1/contacts/assign — {contactId, entityType, entityId, roleInContext}
   GET /api/v1/contacts/for/:entityType/:entityId — contactele asignate pe un document

4. Endpoint-uri furnizori per articol:
   GET /api/v1/inventory/items/:itemId/suppliers — lista furnizori cu prioritate
   POST /api/v1/inventory/items/:itemId/suppliers — adauga furnizor
   PUT /api/v1/inventory/items/suppliers/:id — modifica (pret, prioritate, primary)
   DELETE /api/v1/inventory/items/suppliers/:id

5. Istoric achizitii:
   GET /api/v1/inventory/items/:itemId/purchase-history — lista achizitii
   GET /api/v1/inventory/items/:itemId/price-trend — [{date, unitCost, supplierName}] pt grafic
   - La fiecare POST /inventory/movements type='receipt': creeaza automat purchase_history
   - Alerta daca pretul creste >10% fata de ultima achizitie

6. Modifica modulele existente sa lege contactul pe documente:
   - production.orders: adauga client_contact_id
   - maintenance.planned_interventions: executor_contact_id (deja in schema)
   - inventory.warehouse_documents: supplier_contact_id

Teste: CRUD furnizori, purchase history, contact assignment, filtrare contacte per context.
npm test → trec.
---SFARSIT PROMPT---

COMMIT: "Tema 2+4: Contacte per context + furnizori per element + istoric achizitii"

## PROMPT INTERCONECTARE-2: Mentenanta planificata

---INCEPUT PROMPT---
Citeste CLAUDE.MD sectiunea Tema 3.

1. Migrari:
   - CREATE TABLE maintenance.planned_interventions
   - CREATE TABLE machines.maintenance_schedules

2. Implementeaza in src/modules/maintenance/ (extinde modulul existent):

PLANNED INTERVENTIONS:
GET /api/v1/maintenance/planned?machineId=&status=&dateFrom=&dateTo=
POST /api/v1/maintenance/planned (admin+manager+maintenance)
  - Validare: machineId, plannedStartDate, plannedEndDate, executorType
  - Daca executorType='external': executorCompanyId si executorContactId obligatorii
  - Contact selectat din companies (cu SearchableSelect — tag: maintenance_contact)

PUT /api/v1/maintenance/planned/:id/confirm — status 'confirmed'
  - Salvaza confirmed_at, confirmed_by
  - IMPORTANT: creeaza blocare in planificator — masina indisponibila in perioada respectiva
    (insereaza in planning.capacity_load cu available_hours=0 sau creeaza constrangere)

PUT /api/v1/maintenance/planned/:id/start — status 'in_progress'
PUT /api/v1/maintenance/planned/:id/complete — status 'completed'
  - Primeste: actualCost, completionNotes, partsUsed[]
  - Pentru fiecare piesa de schimb din partsUsed:
    Creeaza inventory.movement type='production_input' (scade din stoc)
  - Daca is_recurring: calculeaza next_due_date si creeaza automat urmatoarea interventie
  - Actualizeaza machines.maintenance_schedules (last_performed_at, recalculeaza next_due)

MAINTENANCE SCHEDULES (configurare per masina):
GET /api/v1/machines/:machineId/maintenance-schedules
POST /api/v1/machines/:machineId/maintenance-schedules (admin+manager)
  - Validare: scheduleName, triggerType, interval(s)
  - Daca auto_create_intervention: cand se atinge next_due → creeaza automat planned_intervention cu status 'planned'
PUT /api/v1/machines/maintenance-schedules/:id
DELETE /api/v1/machines/maintenance-schedules/:id

3. Integrare cu planificator:
   - In scheduler.service.js: la pasul de alocare, verifica:
     "Masina X are planned_intervention confirmata in ziua Y?" → daca da, masina indisponibila

4. Integrare cu alerte (F7):
   - Regula noua: 'maintenance_approaching' → alerta cand next_due_date <= today + N zile (configurable)
   - Regula noua: 'maintenance_overdue' → alerta cand next_due_date < today si nu s-a facut

Teste: CRUD interventii planificate, flux complet planned→confirmed→in_progress→completed,
recurenta (dupa completare se creeaza automat urmatoarea), piese de schimb scazute din stoc.
npm test → trec.
---SFARSIT PROMPT---

COMMIT: "Tema 3: Mentenanta planificata cu 4 stadii + recurenta + integrare planning"

## PROMPT INTERCONECTARE-3: Model cost complet

---INCEPUT PROMPT---
Citeste CLAUDE.MD sectiunea Tema 5.

1. Migrari:
   - CREATE TABLE costs.cost_element_definitions
   - CREATE TABLE costs.machine_cost_config
   - CREATE TABLE costs.operator_cost_config
   - CREATE TABLE costs.overhead_config
   - ALTER TABLE machines.machines: adauga power_kw NUMERIC(8,2)
   - SEED: cele 7 elemente de cost default

2. Implementeaza in src/modules/costs/ (extinde modulul existent):

CONFIGURARE ELEMENTE COST:
GET /api/v1/costs/elements — lista elemente (active/inactive)
PUT /api/v1/costs/elements/:id — activeaza/dezactiveaza, modifica

CONFIGURARE COST MASINA:
GET /api/v1/costs/machines/:machineId/config
POST /api/v1/costs/machines/:machineId/config (admin+manager)
  - Body: {configMode: 'simple', hourlyRate: 25}
  - SAU: {configMode: 'detailed', depreciationHourly: 10, energyHourly: 5, spaceHourly: 3, ...}
  - SAU: {configMode: 'detailed', powerKw: 15, energyPricePerKwh: 0.15, ...} (energie calculata)

CONFIGURARE COST OPERATOR:
GET /api/v1/costs/operators/config
POST /api/v1/costs/operators/config (admin)
  - Body: {configType: 'per_skill_level', rates: [{skillLevelId: ..., hourlyRate: 12, overtimeRate: 18}]}
  - SAU: {configType: 'per_operator', rates: [{userId: ..., hourlyRate: 11, overtimeRate: 16.5}]}

CONFIGURARE OVERHEAD:
GET /api/v1/costs/overhead
POST /api/v1/costs/overhead (admin)
  - {overheadName: "Administrativ", overheadType: "percentage", value: 15}

3. Actualizeaza src/services/cost.service.js — functia calculateOrderCost:

calculatePieceCost(productId, machineId, operatorId):
  Citeste cost_element_definitions active pt tenant
  Pentru fiecare element activ:
    'machine_hourly': machine_cost_config → hourly_rate × ore_per_piesa
    'labor_hourly': operator_cost_config → hourly_rate × ore_per_piesa
    'material_direct': SUM(bom.materials × item_suppliers.unit_cost_primary)
    'tooling_amortization': tool.purchase_cost / tool.max_cycles
    'consumables': SUM(tool.consumption_rate_per_hour × ore × inventory.item_suppliers.unit_cost)
    'energy': machine.power_kw × ore × machine_cost_config.energy_price_per_kwh (daca detailed)
    'overhead': subtotal × SUM(overhead_config.value%) + SUM(fixed_monthly / piese_luna_estimat)
  
  Returneaza: {
    elements: [{code, name, category, value}],
    subtotal, overhead, total,
    perPiece: total,
    perOrder: total × quantity
  }

calculateOrderCostComplete(orderId):
  - Parcurge arborele MBOM recursiv
  - Per fiecare piesa: calculatePieceCost per operatie
  - Sumeaza pe comanda
  - Compara cu pret vanzare → marja
  - Returneaza breakdown detaliat pe toate cele 7 categorii

GET /api/v1/costs/calculate/piece/:productId?machineId=&quantity=
  → cost detaliat per piesa cu toate elementele

GET /api/v1/costs/calculate/order/:orderId
  → cost complet comanda cu breakdown pe categorii + marja

GET /api/v1/costs/calculate/quote?productId=&quantity=&sellingPrice=
  → simulare oferta: cost fabricatie + overhead + marja

4. Dashboard cost (actualizat):
  - Grafic pie chart: distributie cost pe cele 7 categorii
  - Tabel: element | planificat | real | diferenta
  - Marja per comanda: venituri - costuri = profit

Teste: calcul cost cu toate elementele, calcul cu energie dezactivata (element inactiv),
cost simplu vs detailed, marja corecta.
npm test → trec.
---SFARSIT PROMPT---

COMMIT: "Tema 5: Model cost complet — 7 elemente configurabile + marja"

## PROMPT INTERCONECTARE-4: Componenta SearchableSelect + integrare UI

---INCEPUT PROMPT---
Citeste CLAUDE.MD sectiunea Tema 1.

1. Creeaza componenta reutilizabila:
   src/frontend/src/components/SearchableSelect.jsx

   Props:
   - endpoint: string (API URL pentru lista: "/api/v1/companies")
   - searchParam: string (param de cautare: "search")
   - labelField: string (campul afisat: "name")
   - valueField: string (campul valoare: "id")
   - filterParams: object (filtre fixe: {companyTypes: "supplier"})
   - createEndpoint: string (API URL pentru creare: "/api/v1/companies")
   - createFields: array [{name, label, type, required, options}]
   - placeholder: string
   - value: string (valoarea selectata)
   - onChange: function(selectedValue, selectedItem)
   - allowCreate: boolean (default true)

   Functionare:
   - Input text → debounce 300ms → GET endpoint?searchParam=text
   - Afiseaza lista rezultate sub input
   - La sfarsitul listei: "+ Adauga [label] nou" (daca allowCreate)
   - Click "+ Adauga" → mini-modal cu createFields → POST createEndpoint → onChange(newId)
   - Click pe rezultat → onChange(selectedId)
   - Esc sau click outside → inchide lista

2. Inlocuieste TOATE dropdown-urile <select> existente din TOATA aplicatia cu <SearchableSelect>:

   - OrdersPage: selectie client → SearchableSelect endpoint="/companies" filter={companyTypes:"client"}
   - OrdersPage: selectie contact client → SearchableSelect endpoint="/companies/:companyId/contacts" filter={relationshipType:"client_contact"}
   - BOMPage: selectie furnizor material → SearchableSelect endpoint="/companies" filter={companyTypes:"supplier"}
   - MachinesPage: selectie furnizor scula → SearchableSelect endpoint="/companies" filter={companyTypes:"supplier"}
   - MaintenancePage: selectie firma mentenanta → SearchableSelect endpoint="/companies" filter={companyTypes:"maintenance_provider"}
   - InventoryPage: selectie furnizor la receptie → SearchableSelect endpoint="/companies" filter={companyTypes:"supplier"}
   - PlanningPage: selectie produs → SearchableSelect endpoint="/bom/products"
   - OperatorPage: selectie masina → SearchableSelect endpoint="/machines"

3. Creeaza componenta ContactSelector.jsx (specializata):
   - Primeste: companyId (obligatoriu)
   - Filtreaza contactele pe companie + relationship_type + context_tags
   - Permite creare contact inline cu tag-uri
   - Afiseaza: nume + rol + departament + tag-uri

Teste vizuale: dropdown-ul filtreaza, creeaza entitate noua, selecteaza automat.
---SFARSIT PROMPT---

COMMIT: "Tema 1: SearchableSelect + ContactSelector — dropdown-uri inteligente pe toata aplicatia"

## PROMPT INTERCONECTARE-5: Actualizare scenarii test

---INCEPUT PROMPT---
Actualizeaza tests/e2e/full-platform.test.js cu teste noi pentru cele 5 teme:

TEMA 1:
  - POST /companies cu campuri minime (name + companyTypes) → 201
  - Verifica ca apare in GET /companies?search=numeNou

TEMA 2:
  - Creeaza companie cu companyTypes=["client","supplier"]
  - Adauga 2 contacte: uno cu relationship_type='client_contact' + contextTags=["comenzi_cnc"],
    altul cu relationship_type='supplier_contact'
  - Filtreaza: GET /companies/:id/contacts?relationshipType=client_contact → doar primul
  - Asigneaza contact pe comanda: POST /contacts/assign
  - Verifica: GET /contacts/for/order/:orderId → contactul asignat

TEMA 3:
  - Creeaza planned_intervention: masina, firma externa, cost estimat, 15-16 aprilie
  - Confirm → verifica ca planificatorul vede masina indisponibila
  - Complete cu partsUsed → verifica ca stocul scade
  - Daca recurring → verifica ca s-a creat automat urmatoarea interventie

TEMA 4:
  - Adauga 2 furnizori pe un material (primary + alternativ)
  - GET /inventory/items/:id/suppliers → 2 furnizori, primary primul
  - POST /inventory/movements receipt → verifica purchase_history creat automat
  - GET /inventory/items/:id/price-trend → minim 1 punct

TEMA 5:
  - Configureaza cost masina (simple: €25/ora)
  - Configureaza cost operator (per_skill_level: Certificat=€10/ora)
  - GET /costs/calculate/piece/:productId → cost cu toate elementele active
  - Dezactiveaza element 'energy' → recalculeaza → cost mai mic
  - GET /costs/calculate/order/:orderId → cost total + marja

npm test → TOATE trec (inclusiv testele vechi).
---SFARSIT PROMPT---

COMMIT: "Teste E2E actualizate cu cele 5 teme interconectare"
