# TURE CONFIGURABILE
# Partea 1: CLAUDE.MD | Partea 2: Prompt

# ═══════════════════════════════════════
# PARTEA 1: ADAUGA IN CLAUDE.MD
# ═══════════════════════════════════════

## TURE CONFIGURABILE

Turele NU mai sunt hardcodate. Se configureaza per fabrica cu exceptii per sectie.
Inlocuieste ORICE referinta la "Tura I: 06:00-14:00" din cod cu lookup in config.

### shifts.shift_definitions (definitii ture per fabrica/sectie)
  - id UUID PK
  - tenant_id UUID FK → system.tenants
  - org_unit_id UUID FK → org.units NOT NULL (fabrica sau sectie)
  - shift_name VARCHAR(50) NOT NULL (ex: "Tura I", "Schimbul de dimineata", "Morning Shift")
  - shift_code VARCHAR(10) NOT NULL (ex: "T1", "T2", "T3")
  - start_time TIME NOT NULL (ex: '06:00')
  - end_time TIME NOT NULL (ex: '14:00')
  - crosses_midnight BOOLEAN DEFAULT false (true daca end < start, ex: 22:00-06:00)
  - break_minutes INTEGER DEFAULT 30 (pauza masa inclusa)
  - productive_minutes INTEGER GENERATED ALWAYS AS (
      CASE WHEN crosses_midnight 
        THEN (1440 - EXTRACT(EPOCH FROM start_time)/60 + EXTRACT(EPOCH FROM end_time)/60) - break_minutes
        ELSE (EXTRACT(EPOCH FROM end_time)/60 - EXTRACT(EPOCH FROM start_time)/60) - break_minutes
      END
    ) STORED
  - sort_order INTEGER DEFAULT 1
  - is_active BOOLEAN DEFAULT true
  - created_at TIMESTAMPTZ
  - UNIQUE(org_unit_id, shift_code)

### shifts.weekly_schedule (program saptamanal: ce ture ruleaza in ce zi)
  - id UUID PK
  - tenant_id UUID FK
  - org_unit_id UUID FK → org.units (fabrica sau sectie)
  - day_of_week INTEGER NOT NULL CHECK (0-6, 0=Luni, 6=Duminica)
  - shift_definition_id UUID FK → shifts.shift_definitions
  - is_active BOOLEAN DEFAULT true
  - UNIQUE(org_unit_id, day_of_week, shift_definition_id)

  Exemplu Fabrica Cluj:
    org_unit=Cluj, day=0(Luni), shift=T1 ✓
    org_unit=Cluj, day=0(Luni), shift=T2 ✓
    org_unit=Cluj, day=0(Luni), shift=T3 ✓
    org_unit=Cluj, day=5(Sambata), shift=T1 ✓
    org_unit=Cluj, day=5(Sambata), shift=T2 ✓
    (Sambata fara T3, Duminica fara nimic)

  Exceptie Sectia Asamblare:
    org_unit=Asamblare, day=0(Luni), shift=T1 ✓
    org_unit=Asamblare, day=0(Luni), shift=T2 ✓
    (fara T3 pe Asamblare)

### shifts.schedule_exceptions (exceptii pe zile specifice)
  - id UUID PK
  - tenant_id UUID FK
  - org_unit_id UUID FK → org.units
  - exception_date DATE NOT NULL
  - exception_type VARCHAR(30) CHECK IN ('holiday','extra_shift','reduced','custom') NOT NULL
  - name VARCHAR(255) (ex: "1 Mai — Ziua Muncii", "Comanda urgenta AutoParts")
  - active_shifts JSONB
    (ex: [] = inchis complet,
     ["T1"] = doar Tura I,
     ["T1","T2","T3"] = toate turele inclusiv daca nu era programat normal)
  - override_times JSONB (optional: ore diferite in acea zi)
    (ex: [{"shiftCode":"T1","startTime":"07:00","endTime":"15:00"}])
  - is_recurring BOOLEAN DEFAULT false (true = se repeta anual, ex: 1 Mai)
  - created_by UUID
  - created_at TIMESTAMPTZ
  - UNIQUE(org_unit_id, exception_date)

### Reguli ture:

REZOLVARE TURA CURENTA (ce tura e acum):
  1. Ia org_unit_id al userului (din scop)
  2. Cauta shift_definitions pentru org_unit-ul respectiv
  3. Daca nu are (sectia nu are definitii proprii) → urca la parinte (fabrica)
  4. Verifica daca azi e exceptie (schedule_exceptions)
     Daca da → foloseste active_shifts din exceptie
     Daca nu → foloseste weekly_schedule pentru ziua curenta
  5. Din turele active azi, gaseste tura curenta dupa ora: 
     cea a carei start_time <= acum < end_time (sau crosses_midnight logic)
  6. Returneaza: {shiftName, shiftCode, startTime, endTime, productiveMinutes}

DISPONIBILITATE MASINA (pentru planificator):
  1. Pentru masina M in ziua Z:
  2. Ia org_unit-ul masinii
  3. Rezolva turele active in ziua Z (cu exceptii)
  4. ore_disponibile = SUM(productive_minutes) din turele active / 60
  5. Daca masina are mentenanta planificata in ziua Z → scade orele de mentenanta

IMPACTEAZA (inlocuieste hardcoded):
  - Operator: la login, tura curenta = calculata din config, NU din ora hardcodata
  - Rapoarte: camp "shift" pe production.reports = shift_code din config, nu string liber
  - Dashboard OEE: planned_production_minutes = SUM(productive_minutes) din turele zilei, NU 480 fix
  - Planificator: ore disponibile per masina per zi = din config ture
  - CTP: calcul termen tine cont de zilele lucratoare + ture efective
  - Alerte: "OEE sub 60% pe 3 ture" = pe 3 ture REALE, nu 3 × 8h fixe
  - Predare-primire tura: se genereaza la sfarsitul turei REALE, nu la 14:00 fix

# ═══════════════════════════════════════
# PARTEA 2: PROMPT CLAUDE CODE
# ═══════════════════════════════════════

---INCEPUT PROMPT---
Citeste CLAUDE.MD sectiunea "TURE CONFIGURABILE".

IMPORTANT: Aceasta modificare afecteaza TOATA aplicatia. Turele nu mai sunt hardcodate.

1. MIGRARI:
   - CREATE SCHEMA shifts
   - CREATE TABLE shifts.shift_definitions
   - CREATE TABLE shifts.weekly_schedule
   - CREATE TABLE shifts.schedule_exceptions
   
   SEED pentru tenant demo:
   - 3 ture default: T1 (06:00-14:00), T2 (14:00-22:00), T3 (22:00-06:00, crosses_midnight=true)
   - Weekly schedule: L-V = T1+T2+T3, S = T1+T2, D = nimic
   - Exceptie: 1 Mai = inchis (recurring=true)

2. SERVICIU — src/services/shift.service.js:

   getShiftDefinitions(orgUnitId)
   → Returneaza turele definite pe org_unit. Daca nu exista → urca la parinte recursiv.

   getActiveShiftsForDate(orgUnitId, date)
   → Verifica exceptii pe data respectiva (schedule_exceptions)
   → Daca exceptie → returneaza active_shifts din exceptie
   → Daca nu → returneaza turele din weekly_schedule pt day_of_week
   → Returneaza: [{shiftCode, shiftName, startTime, endTime, productiveMinutes}]

   getCurrentShift(orgUnitId)
   → Apeleaza getActiveShiftsForDate(orgUnitId, today)
   → Din turele active, gaseste cea curenta dupa ora
   → Logica crosses_midnight: daca tura T3 e 22:00-06:00 si ora e 02:00,
     verifica data de ieri pt T3
   → Returneaza: {shiftCode, shiftName, startTime, endTime} sau null daca e in afara programului

   getAvailableHours(machineId, date)
   → Ia org_unit_id al masinii
   → Ia turele active in ziua respectiva
   → SUM(productiveMinutes) / 60 = ore disponibile
   → Scade ore mentenanta planificata daca exista
   → Returneaza: {totalHours, shifts: [...], maintenanceHours}

   getWorkingDaysBetween(orgUnitId, startDate, endDate)
   → Numara zilele in care exista cel putin o tura activa (exclude zilele inchise)
   → Util pentru CTP

   isWorkingDay(orgUnitId, date)
   → true daca exista cel putin o tura activa in acea zi

3. API ENDPOINTS — src/modules/shifts/ cu routes, controller, validation, test:

   DEFINITII TURE:
   GET /api/v1/shifts/definitions?orgUnitId= — lista ture per fabrica/sectie
   POST /api/v1/shifts/definitions (admin+manager)
     Body: {orgUnitId, shiftName, shiftCode, startTime, endTime, breakMinutes}
   PUT /api/v1/shifts/definitions/:id
   DELETE /api/v1/shifts/definitions/:id

   PROGRAM SAPTAMANAL:
   GET /api/v1/shifts/weekly?orgUnitId= — programul complet (7 zile)
     Returneaza: [{dayOfWeek: 0, dayName: "Luni", shifts: [{shiftCode, shiftName, startTime, endTime}]}, ...]
   PUT /api/v1/shifts/weekly (admin+manager)
     Body: {orgUnitId, schedule: [{dayOfWeek: 0, shiftCodes: ["T1","T2","T3"]}, {dayOfWeek: 5, shiftCodes: ["T1","T2"]}, ...]}
     Sterge weekly_schedule existent pt org_unit si recreeaza

   EXCEPTII:
   GET /api/v1/shifts/exceptions?orgUnitId=&year= — lista exceptii
   POST /api/v1/shifts/exceptions (admin+manager)
     Body: {orgUnitId, exceptionDate, exceptionType, name, activeShifts: ["T1"], overrideTimes, isRecurring}
   PUT /api/v1/shifts/exceptions/:id
   DELETE /api/v1/shifts/exceptions/:id

   CALENDAR:
   GET /api/v1/shifts/calendar?orgUnitId=&month=&year=
     Returneaza: per fiecare zi din luna:
     [{date, dayOfWeek, isWorkingDay, isException, exceptionName, 
       shifts: [{shiftCode, shiftName, startTime, endTime, productiveMinutes}],
       totalHours}]
     Util pentru frontend — afiseaza calendar cu zilele colorate (lucratoare/nelucratoare/exceptii)

   UTILITAR:
   GET /api/v1/shifts/current?orgUnitId= — tura curenta (pt operator la login)
   GET /api/v1/shifts/available-hours?machineId=&date= — ore disponibile masina in ziua data

4. INLOCUIESTE HARDCODED IN TOATA APLICATIA:

   a) src/services/oee.service.js:
      INAINTE: const planned = machine.planned_production_minutes || 480;
      DUPA: const {totalHours} = await shiftService.getAvailableHours(machineId, date);
            const planned = totalHours * 60;

   b) src/modules/production/reports.service.js:
      INAINTE: const shift = getCurrentShift(); // hardcoded 06-14, 14-22, 22-06
      DUPA: const shift = await shiftService.getCurrentShift(req.user.orgUnitId);

   c) src/services/scheduler.service.js (planificator):
      INAINTE: const availableHours = 16; // 2 ture fixe
      DUPA: const {totalHours} = await shiftService.getAvailableHours(machineId, planDate);

   d) src/services/cost.service.js:
      Costul masina per zi = cost_orar × ore din ture active (nu × 16 fix)

   e) CTP (capable-to-promise):
      getWorkingDaysBetween() pentru calcul termen (exclude zilele inchise)

   f) Dashboard OEE:
      Disponibilitate = operating / planned, unde planned = ore ture active

   g) Predare-primire tura:
      Se genereaza la end_time al turei curente din config

   h) Alerte "OEE sub 60% pe 3 ture consecutive":
      3 ture = 3 ture REALE (T1 azi + T3 ieri + T2 ieri), nu 3 × 8h

   CAUTA si INLOCUIESTE fiecare aparitie de:
   - "Tura I", "Tura II", "Tura III" ca string-uri fixe → shift_code din config
   - getCurrentShift() hardcoded → shiftService.getCurrentShift(orgUnitId)
   - 480 (minute) sau 16 (ore) ca valori fixe → shiftService.getAvailableHours()
   - getHours() cu if/else 6-14-22 → lookup in shift_definitions

5. FRONTEND:

   a) Pagina Admin → Setari → Ture:
      - Tab "Definitii ture": CRUD ture per fabrica (tabel editabil: nume, cod, ora start, ora final, pauza)
      - Tab "Program saptamanal": grid 7 coloane (L-D) × N ture, checkbox per celula
        Visual: tura activa = celula colorata, inactiva = gri
      - Tab "Exceptii": calendar cu zilele speciale marcate, CRUD exceptii
        Visual: calendar luna cu: verde = zi lucratoare normala, albastru = exceptie (ture modificate), rosu = inchis
      - Tab "Calendar": vizualizare luna completa cu turele per zi (read-only, generat din config)
      - Dropdown "Fabrica" sus pentru a selecta pentru ce fabrica configurezi
      - Checkbox "Sectia X are program diferit" → deschide config separata pe sectie

   b) Header operator:
      INAINTE: "Tura I" hardcoded din ora
      DUPA: GET /shifts/current → afiseaza shift_name + start-end din config
      Daca e in afara programului → afiseaza "In afara programului de lucru"

   c) Rapoarte si dashboards:
      Tura afisata = shift_name din config, nu string fix

Teste:
  - getActiveShiftsForDate: zi normala (3 ture), sambata (2 ture), duminica (0), exceptie sarbatoare (0), exceptie tura extra (3 inclusiv sambata)
  - getCurrentShift: ora 07:00 → T1, ora 15:00 → T2, ora 23:00 → T3 (crosses_midnight), ora 03:00 → T3 (tot crosses_midnight)
  - getAvailableHours: zi cu 3 ture → ~22.5h (3×8h - 3×30min pauza), zi cu 2 ture → ~15h
  - getWorkingDaysBetween: L-V = 5, L-D cu sambata lucratoare = 6
  - Sectie cu exceptie: Sectia Asamblare luni → 2 ture (nu 3 ca fabrica)
  - OEE cu planned din config (nu 480 fix)
  - Planificator cu ore disponibile din config
npm test → TOATE trec (inclusiv testele vechi care acum folosesc config in loc de hardcoded).
---SFARSIT PROMPT---

COMMIT: "Ture configurabile: definitii, program saptamanal, exceptii, inlocuit hardcoded in toata aplicatia"
