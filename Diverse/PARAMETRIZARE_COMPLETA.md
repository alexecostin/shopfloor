# PARAMETRIZARE COMPLETA — ZERO HARDCODARI
# Partea 1: CLAUDE.MD | Partea 2: Prompturi

# ═══════════════════════════════════════
# PARTEA 1: ADAUGA IN CLAUDE.MD
# ═══════════════════════════════════════

## SISTEM LOOKUP GENERIC

Un singur sistem pentru TOATE enum-urile/listele configurabile din aplicatie.
Inlocuieste ORICE enum hardcodat cu lookup din acest tabel.

### system.lookup_definitions (tipuri de lookup)
  - id UUID PK
  - lookup_type VARCHAR(100) UNIQUE NOT NULL
  - display_name VARCHAR(255) NOT NULL
  - display_name_en VARCHAR(255)
  - description TEXT
  - is_system BOOLEAN DEFAULT false (true = nu se sterge)
  - allow_tenant_customization BOOLEAN DEFAULT true
  - metadata_schema JSONB (defineste ce campuri metadata sunt disponibile)
  - created_at TIMESTAMPTZ

### system.lookup_values (valori per tip per tenant)
  - id UUID PK
  - tenant_id UUID FK → system.tenants (null = valoare globala default)
  - lookup_type VARCHAR(100) NOT NULL
  - code VARCHAR(100) NOT NULL
  - display_name VARCHAR(255) NOT NULL
  - display_name_en VARCHAR(255)
  - sort_order INTEGER DEFAULT 0
  - is_default BOOLEAN DEFAULT false
  - is_active BOOLEAN DEFAULT true
  - color VARCHAR(7) (culoare asociata, ex: "#FF4757")
  - icon VARCHAR(50) (icon name)
  - metadata JSONB DEFAULT '{}'
  - created_at TIMESTAMPTZ
  - UNIQUE(tenant_id, lookup_type, code)
  - INDEX pe (tenant_id, lookup_type, is_active)

### Lookup types + seed values:

stop_categories (Categorii opriri):
  metadata: {is_planned: bool}
  Seed: lipsa_material, defect_utilaj, schimbare_produs, reglaj, lipsa_operator,
        pauza, curatenie, lipsa_energie, asteptare_calitate, altul

scrap_reasons (Motive rebuturi):
  Seed: uzura_scula, defect_suprafata, cota_in_afara_tolerantei, material_neconform,
        rugozitate_neconforma, incomplet, defect_vizual, eroare_operator, altul

machine_types (Tipuri masini):
  metadata: {icon: string}
  Seed: cnc_strung, cnc_freza, cnc_router, injectie, presa, asamblare, sudura,
        rectificare, debitare, tratament_termic, vopsire, spalare, banc_test, altul

tool_types (Tipuri scule):
  Seed: matrita, scula_cnc, dispozitiv_fixare, calibru, electrode, cap_frezare,
        placute_amovibile, burghiu, tarod, alezor, freza, cutit_strung, altul

item_categories (Categorii inventar):
  metadata: {tracking_mode: string}
  Seed: materie_prima, semifabricat, produs_finit, componenta_achizitionata,
        consumabil, piesa_schimb, ambalaj, scula, altul

units_of_measure (Unitati de masura):
  metadata: {symbol: string, type: "weight"|"volume"|"length"|"area"|"count"|"other"}
  Seed: buc(count), kg(weight), g(weight), tona(weight), litru(volume), ml(volume),
        m(length), cm(length), mm(length), mp(area), mc(volume), set(count),
        pereche(count), rola(count), palet(count), cutie(count), pachet(count)

leave_types (Tipuri concediu):
  metadata: {paid: bool, requires_document: bool, max_days_per_year: int}
  Seed: concediu_odihna, concediu_medical, formare_profesionala, personal,
        fara_plata, recuperare, delegatie, eveniment_familial, maternitate,
        paternitate, zi_compensatorie, altul

intervention_types (Tipuri interventie mentenanta):
  Seed: preventiva, corectiva, predictiva, calibrare, inspectie, upgrade,
        instalare, mutare, revopsire, dezafectare, altul

priority_levels (Nivele prioritate):
  metadata: {severity_rank: int, color: string, sla_hours: int}
  Seed: scazut(#6B7280,5), normal(#3B82F6,4), ridicat(#F59E0B,3),
        urgent(#EF4444,2), critic(#DC2626,1)

company_types (Tipuri companie):
  Seed: client, furnizor, subcontractor, transportator, firma_mentenanta,
        laborator_testare, consultant, prospect, altul

operation_types (Tipuri operatii BOM):
  Seed: debitare, strunjire, frezare, gaurire, rectificare, sudura, asamblare,
        tratament_termic, vopsire, galvanizare, spalare, inspectie, ambalare,
        transport_intern, altul

order_statuses (Statusuri comenzi):
  metadata: {is_terminal: bool, color: string, allowed_transitions: string[]}
  Seed: draft(→confirmed), confirmed(→materials_ready,in_production),
        materials_ready(→in_production), in_production(→quality_check,completed),
        quality_check(→completed,in_production), completed(→shipped),
        shipped(terminal), cancelled(terminal)

## MONEDA

### system.currencies
  - id UUID PK
  - code VARCHAR(3) UNIQUE NOT NULL (ISO 4217: RON, EUR, USD)
  - name VARCHAR(100) NOT NULL
  - symbol VARCHAR(5) NOT NULL (lei, €, $)
  - decimal_places INTEGER DEFAULT 2
  - is_active BOOLEAN DEFAULT true

### system.exchange_rates
  - id UUID PK
  - from_currency VARCHAR(3) NOT NULL
  - to_currency VARCHAR(3) NOT NULL
  - rate NUMERIC(12,6) NOT NULL
  - valid_date DATE NOT NULL
  - source VARCHAR(50) DEFAULT 'manual' (sau 'bnr_api')
  - created_at TIMESTAMPTZ
  - UNIQUE(from_currency, to_currency, valid_date)

### Reguli moneda:
  - Tenant default currency in system.tenants.settings.defaultCurrency
  - Pe FIECARE tabel cu sume: coloana currency VARCHAR(3) DEFAULT tenant.defaultCurrency
  - Rapoarte consolidate: conversia la moneda tenant-ului folosind exchange_rates
  - Tabele afectate: production.orders, costs.*, inventory.purchase_history,
    maintenance.planned_interventions, machines.tools, bom.cost_rates
  - Frontend: afiseaza simbolul monedei langa suma (nu "€" hardcodat)

## TIMEZONE

### Modificare org.units — adauga coloana:
  - timezone VARCHAR(50) DEFAULT 'Europe/Bucharest'

### Reguli:
  - Fiecare fabrica are propriul timezone
  - Server stocheaza TOTUL in UTC (TIMESTAMPTZ deja face asta)
  - Frontend converteste la afisare: ora locala = UTC + timezone fabrica activa
  - Header operator: ora afisata = ora locala a fabricii, nu ora browserului
  - Rapoarte: mentioneaza timezone-ul in footer

## I18N (INTERNATIONALIZARE)

### system.languages
  - id UUID PK
  - code VARCHAR(10) UNIQUE NOT NULL (ex: 'ro', 'en', 'hu', 'de')
  - name VARCHAR(100) NOT NULL
  - native_name VARCHAR(100) NOT NULL (ex: "Romana", "English")
  - is_active BOOLEAN DEFAULT true
  - is_default BOOLEAN DEFAULT false

Seed: ro (Romana, default), en (English)

### Reguli i18n:
  - Tenant default language in system.tenants.settings.defaultLanguage
  - User language in auth.users.preferred_language (override per user)
  - Frontend: fisiere de traducere /src/i18n/ro.json, /src/i18n/en.json
  - Toate textele UI: t('key') — niciodata string hardcodat
  - API: mesajele de eroare traduse dupa Accept-Language header
  - lookup_values: display_name (limba default) + display_name_en (engleza)
  - Template-uri email: per limba

### Structura fisier traducere (exemplu ro.json):
{
  "common": {
    "save": "Salveaza",
    "cancel": "Anuleaza",
    "delete": "Sterge",
    "search": "Cauta...",
    "loading": "Se incarca...",
    "noData": "Nu exista date",
    "confirm": "Confirma",
    "back": "Inapoi"
  },
  "auth": {
    "login": "Autentificare",
    "email": "Email",
    "password": "Parola",
    "logout": "Deconectare"
  },
  "production": {
    "title": "Productie",
    "reportPieces": "Raporteaza piese",
    "goodPieces": "Piese bune",
    "scrapPieces": "Rebuturi",
    "stop": "Oprire masina",
    "shift": "Tura"
  },
  "dashboard": {
    "title": "Dashboard",
    "oee": "OEE",
    "totalProduced": "Total produs",
    "ordersAtRisk": "Comenzi la risc"
  }
  // ... continua pentru fiecare modul
}

## SETARI TENANT EXTINSE

system.tenants.settings JSONB — structura completa:
{
  "locale": {
    "defaultCurrency": "RON",
    "availableCurrencies": ["RON", "EUR", "USD"],
    "defaultLanguage": "ro",
    "availableLanguages": ["ro", "en"],
    "dateFormat": "DD.MM.YYYY",
    "timeFormat": "HH:mm",
    "numberDecimalSeparator": ",",
    "numberThousandsSeparator": ".",
    "firstDayOfWeek": 1
  },
  "security": {
    "passwordMinLength": 8,
    "passwordRequireUppercase": true,
    "passwordRequireDigit": true,
    "passwordRequireSpecial": false,
    "passwordExpiryDays": 0,
    "sessionTimeoutMinutes": 480,
    "maxLoginAttempts": 5,
    "lockoutMinutes": 15
  },
  "display": {
    "defaultItemsPerPage": 20,
    "dashboardRefreshSeconds": 30,
    "dashboardLayout": "default"
  },
  "production": {
    "oeeFormula": "standard",
    "oeeTarget": 85,
    "scrapTarget": 2,
    "maxApprovalLevels": 5
  },
  "notifications": {
    "emailEnabled": true,
    "pushEnabled": true,
    "digestFrequency": "daily"
  },
  "api": {
    "rateLimitGlobal": 100,
    "rateLimitLogin": 5
  }
}

# ═══════════════════════════════════════
# PARTEA 2: PROMPTURI CLAUDE CODE
# ═══════════════════════════════════════

## PROMPT PARAM-1: Lookup generic + seed-uri

---INCEPUT PROMPT---
Citeste CLAUDE.MD sectiunea "SISTEM LOOKUP GENERIC".

1. Migrari:
   - CREATE TABLE system.lookup_definitions
   - CREATE TABLE system.lookup_values

2. SEED toate lookup_definitions (12 tipuri) si lookup_values (toate seed-urile din CLAUDE.MD)
   cu tenant_id = null (valori globale default).

3. Creeaza src/services/lookup.service.js:

   getValues(tenantId, lookupType, includeInactive=false)
   → Returneaza valorile tenant-ului. Daca tenant nu are valori proprii → returneaza default-urile (tenant_id=null)
   → Ordonat dupa sort_order

   getValue(tenantId, lookupType, code)
   → Returneaza o valoare specifica

   initTenantLookups(tenantId)
   → Copiaza TOATE valorile default (tenant_id=null) ca valori ale tenant-ului nou
   → Se apeleaza la creare tenant

   validateLookupValue(tenantId, lookupType, code)
   → Verifica ca valoarea exista si e activa. Folosit in validari Joi.

4. API endpoints — src/modules/lookups/ cu routes, controller, validation, test:

   GET /api/v1/lookups/:lookupType — lista valori active pt tenant curent
     Query params: ?includeInactive=true, ?search=text
     Returneaza: [{code, displayName, displayNameEn, color, icon, isDefault, metadata}]

   GET /api/v1/lookups — lista TOATE tipurile de lookup disponibile
     Returneaza: [{lookupType, displayName, count}]

   POST /api/v1/lookups/:lookupType (admin)
     Body: {code, displayName, displayNameEn, sortOrder, color, icon, isDefault, metadata}
     Creeaza valoare noua pt tenant curent

   PUT /api/v1/lookups/:lookupType/:code (admin)
     Modifica valoare existenta

   DELETE /api/v1/lookups/:lookupType/:code (admin)
     Soft delete: seteaza is_active=false (nu sterge, poate fi referita in date vechi)

   POST /api/v1/lookups/:lookupType/reset (admin)
     Reseteaza la valorile default (sterge custom, copiaza din tenant_id=null)

5. INLOCUIESTE ENUM-URI IN TOATA APLICATIA:

   INAINTE (validare Joi):
     category: Joi.string().valid('lipsa_material','defect_utilaj','schimbare_produs')
   DUPA:
     category: Joi.string().required()
     (validarea se face in service: await lookupService.validateLookupValue(tenantId, 'stop_categories', value))

   INAINTE (seed/migrare):
     CHECK IN ('vacation','sick','training','personal','other')
   DUPA:
     Sterge CHECK constraint. Valoarea se valideaza in aplicatie din lookup_values.

   Fisiere de modificat — CAUTA si INLOCUIESTE fiecare enum hardcodat:
   - production.stops: category → validare din stop_categories
   - production.reports: scrap_reason → validare din scrap_reasons
   - machines.machines: type → validare din machine_types
   - machines.tools: tool_type → validare din tool_types
   - inventory.items: category → validare din item_categories
   - inventory.items: unit → validare din units_of_measure
   - auth.leave_requests: leave_type → validare din leave_types
   - maintenance.planned_interventions: intervention_type → validare din intervention_types
   - production.orders: status → validare din order_statuses
   - production.orders: priority → validare din priority_levels
   - companies.companies: company_types → validare din company_types
   - bom.operations: operation_type (daca exista) → validare din operation_types
   - alerts.rule_definitions: severity → validare din priority_levels

   ATENTIE: NU sterge coloanele existente. Doar inlocuieste validarea.
   Datele vechi raman valide (seed-urile au aceleasi coduri).

6. Frontend:
   Creeaza hook: src/frontend/src/hooks/useLookup.jsx
     const {values, loading} = useLookup('stop_categories')
     Apeleaza GET /lookups/:type, cache-uieste rezultatul (stale-while-revalidate)

   Inlocuieste FIECARE <select> cu enum hardcodat:
     INAINTE: <option value="lipsa_material">Lipsa material</option>
     DUPA: {values.map(v => <option key={v.code} value={v.code}>{v.displayName}</option>)}

   Pagina Admin → Setari → Configurare Liste:
   - Lista tipuri de lookup (cards cu nume + numar valori)
   - Click pe tip → tabel editabil cu valorile
   - Adauga, modifica, dezactiveaza, reordonare drag & drop
   - Buton "Reseteaza la default"
   - Preview: color picker pe fiecare valoare, icon selector

Teste: getValues cu tenant default, cu tenant custom, validateLookupValue valid/invalid,
  creare valoare noua, dezactivare, reset la default, operator raporteaza cu motiv rebut custom.
npm test → TOATE trec.
---SFARSIT PROMPT---

COMMIT: "Lookup generic: 12 tipuri, 100+ valori seed, zero enum-uri hardcodate"

## PROMPT PARAM-2: Moneda + exchange rates

---INCEPUT PROMPT---
Citeste CLAUDE.MD sectiunea "MONEDA".

1. Migrari:
   - CREATE TABLE system.currencies
   - CREATE TABLE system.exchange_rates
   - ALTER TABLE pe FIECARE tabel cu sume — adauga coloana currency VARCHAR(3):
     production.orders, bom.cost_rates, costs.cost_snapshots, costs.machine_cost_config,
     costs.operator_cost_config, inventory.purchase_history, inventory.item_suppliers,
     maintenance.planned_interventions, machines.tools
   - UPDATE toate randurile existente SET currency = 'EUR' (valoarea curenta)
   - Modifica system.tenants.settings → adauga defaultCurrency

   SEED currencies: RON, EUR, USD, GBP, HUF

2. Serviciu src/services/currency.service.js:
   getExchangeRate(from, to, date) → rata cea mai recenta <= date
   convert(amount, from, to, date) → amount * rate
   formatCurrency(amount, currencyCode) → "1.234,56 lei" sau "€1,234.56"

3. API:
   GET /api/v1/currencies — lista monede active
   GET /api/v1/exchange-rates?from=EUR&to=RON — rate
   POST /api/v1/exchange-rates (admin) — adauga rata
   GET /api/v1/exchange-rates/latest?from=EUR&to=RON — ultima rata

4. Inlocuieste in TOATA aplicatia:
   - cost_eur → cost + currency
   - rate_eur_per_hour → rate_per_hour + currency
   - Rapoarte: converteste toate sumele la moneda tenant-ului
   - Frontend: afiseaza simbolul monedei din config, nu "€" hardcodat

5. Frontend:
   - Pagina Admin → Setari → Moneda: selectie moneda default, rate conversie
   - Formatare sume: respecta numberDecimalSeparator si numberThousandsSeparator din tenant settings

Teste: conversie RON→EUR, formatare corecta, raport cu sume in moneda tenant.
npm test → trec.
---SFARSIT PROMPT---

COMMIT: "Moneda configurabila: multi-currency + exchange rates + formatare"

## PROMPT PARAM-3: Timezone + date format

---INCEPUT PROMPT---
Citeste CLAUDE.MD sectiunile "TIMEZONE" si "SETARI TENANT".

1. Migrari:
   - ALTER TABLE org.units ADD COLUMN timezone VARCHAR(50) DEFAULT 'Europe/Bucharest'
   - ALTER TABLE auth.users ADD COLUMN preferred_language VARCHAR(10) DEFAULT 'ro'
   - ALTER TABLE auth.users ADD COLUMN preferred_timezone VARCHAR(50)
   - Actualizeaza system.tenants.settings cu structura completa din CLAUDE.MD

2. Serviciu src/services/locale.service.js:
   getTimezone(orgUnitId) → timezone-ul fabricii (sau tenant default)
   formatDate(date, tenantSettings) → format dupa dateFormat din settings
   formatNumber(number, tenantSettings) → format dupa decimal/thousands separator
   formatCurrency(amount, currencyCode, tenantSettings) → combina numar + simbol moneda

3. API:
   GET /api/v1/admin/settings — setari complete tenant
   PUT /api/v1/admin/settings (admin) — update setari (merge deep)
   GET /api/v1/admin/settings/timezones — lista timezone-uri disponibile

4. Inlocuieste in aplicatie:
   - Backend: toate raspunsurile cu date → includ timezone info
   - Frontend: toate afisarile de data/ora trec prin formatDate/formatNumber
   - Validare parola: din tenant settings, nu hardcodat

5. Frontend:
   - Pagina Admin → Setari → General:
     Moneda default, format data, format numere, timezone, paginare default
   - Pagina Admin → Setari → Securitate:
     Lungime parola, cerinte, expirare, timeout sesiune, lockout
   - Pagina Profil User:
     Limba preferata, timezone personal (override fabrica)

Teste: formatare data in format US vs RO, numar cu virgula vs punct,
  timezone diferit afiseaza ora corecta.
npm test → trec.
---SFARSIT PROMPT---

COMMIT: "Timezone + locale + setari tenant configurabile"

## PROMPT PARAM-4: i18n (internationalizare)

---INCEPUT PROMPT---
Citeste CLAUDE.MD sectiunea "I18N".

1. Migrare: CREATE TABLE system.languages. Seed: ro + en.

2. Creeaza structura fisiere traducere:
   src/frontend/src/i18n/ro.json — TOATE textele din interfata in romana
   src/frontend/src/i18n/en.json — TOATE textele traduse in engleza

   STRUCTURA per modul (exemplu in CLAUDE.MD). Acopera TOATE textele:
   - common (butoane, actiuni, mesaje generice)
   - auth (login, register, profil)
   - production (rapoarte, opriri, comenzi)
   - machines (CRUD masini, status)
   - planning (Gantt, scheduling, CTP)
   - bom (produse, operatii, MBOM)
   - inventory (stocuri, miscari, NIR)
   - maintenance (cereri, interventii, scule)
   - hr (skills, concedii, ture)
   - costs (dashboard cost, elemente)
   - alerts (notificari, reguli)
   - import (upload, mapping, preview)
   - reports (rapoarte, export)
   - admin (organizatie, roluri, module, setari)
   - errors (mesaje eroare API)

3. Creeaza provider i18n:
   src/frontend/src/providers/I18nProvider.jsx
   - Incarca fisierul de limba la mount (din user.preferred_language sau tenant default)
   - Expune: t(key, params) — returneaza textul tradus
     t('production.goodPieces') → "Piese bune" (ro) sau "Good pieces" (en)
     t('common.itemsFound', {count: 42}) → "42 rezultate gasite"
   - Fallback: daca cheia nu exista in limba curenta → engleza → cheia raw

4. INLOCUIESTE FIECARE TEXT HARDCODAT DIN FRONTEND:
   Cauta TOATE string-urile din componente React si inlocuieste:
   INAINTE: <h1>Dashboard Productie</h1>
   DUPA: <h1>{t('production.dashboard.title')}</h1>

   INAINTE: <button>Salveaza</button>
   DUPA: <button>{t('common.save')}</button>

   INAINTE: placeholder="Cauta..."
   DUPA: placeholder={t('common.search')}

   INAINTE: toast.success("Raport salvat cu succes")
   DUPA: toast.success(t('production.reportSaved'))

   ATENTIE: sunt sute de inlocuiri. Parcurge FIECARE fisier .jsx din src/frontend/src/.

5. Backend mesaje eroare:
   - src/i18n/errors.ro.json + src/i18n/errors.en.json
   - Middleware: citeste Accept-Language header → returneaza mesajele in limba ceruta
   - INAINTE: res.status(400).json({error: "Campuri obligatorii lipsa"})
   - DUPA: res.status(400).json({error: t(req, 'errors.required_fields')})

6. Lookup values bilingv:
   - GET /lookups/:type returneaza display_name (limba curenta) SAU display_name_en
   - Frontend useLookup hook: alege campul potrivit limbii active

7. Frontend:
   - Selector limba in header (dropdown cu steaguri: 🇷🇴 Romana | 🇬🇧 English)
   - La schimbare limba → re-render complet cu noile texte
   - Pagina Admin → Setari → Limbi: activeaza/dezactiveaza limbi disponibile

NOTA: asta e cel mai mare prompt. Poate dura 2-3 ore.
Daca e prea mult intr-o sesiune, imparte in:
  4A: creeaza fisierele i18n + provider + hook (30 min)
  4B: inlocuieste textele din primele 5 module (60 min)
  4C: inlocuieste textele din restul modulelor (60 min)
  4D: backend errors i18n + lookup bilingv (30 min)

npm test → TOATE trec. Verifica vizual: schimba limba la English → toata interfata e in engleza.
---SFARSIT PROMPT---

COMMIT: "i18n complet: ro + en, toate textele, backend + frontend"

## PROMPT PARAM-5: Template-uri email editabile

---INCEPUT PROMPT---
Citeste CLAUDE.MD.

1. Migrare:
   CREATE TABLE system.email_templates
     - id UUID PK
     - tenant_id UUID FK
     - template_type VARCHAR(50) NOT NULL
       (ex: 'welcome', 'password_reset', 'leave_approved', 'leave_rejected',
        'alert_notification', 'maintenance_assigned', 'approval_requested',
        'approval_completed', 'order_imported', 'license_expiring')
     - language VARCHAR(10) DEFAULT 'ro'
     - subject VARCHAR(500) NOT NULL
     - body_html TEXT NOT NULL
     - variables JSONB (variabile disponibile: [{name: "userName", description: "Numele utilizatorului"}])
     - is_active BOOLEAN DEFAULT true
     - UNIQUE(tenant_id, template_type, language)

2. Seed: template-uri default in romana + engleza pentru fiecare tip.
   Variabile in template: {{userName}}, {{machineName}}, {{orderNumber}}, etc.
   Body HTML cu layout simplu (logo tenant, continut, footer).

3. Modifica src/services/email.service.js:
   INAINTE: subject si body hardcodate in cod
   DUPA: incarca template din DB → inlocuieste variabilele → trimite

4. API:
   GET /api/v1/admin/email-templates — lista template-uri
   GET /api/v1/admin/email-templates/:type?language=ro — template specific
   PUT /api/v1/admin/email-templates/:type (admin) — modifica template
   POST /api/v1/admin/email-templates/:type/preview (admin) — preview cu date dummy
   POST /api/v1/admin/email-templates/:type/reset (admin) — reseteaza la default

5. Frontend: Admin → Setari → Template-uri Email
   - Lista template-uri cu preview
   - Editor HTML simplu (textarea cu preview live)
   - Variabile disponibile afisate pe sidebar (click → insereaza in editor)
   - Buton "Trimite email test"

Teste: incarca template, inlocuieste variabile, preview corect, email trimis cu template custom.
npm test → trec.
---SFARSIT PROMPT---

COMMIT: "Template-uri email editabile per tenant + limba"

## PROMPT PARAM-6: Statusuri comenzi configurabile

---INCEPUT PROMPT---
Statusurile comenzilor sunt deja in lookup_values (order_statuses) cu metadata
care defineste tranzitiile permise. Implementeaza logica de state machine.

1. Serviciu src/services/order-status.service.js:
   getStatuses(tenantId) → lista statusuri cu tranzitii
   canTransition(tenantId, fromStatus, toStatus) → true/false
   getNextStatuses(tenantId, currentStatus) → statusurile permise urmatoare

2. Modifica production.orders.service.js:
   La update status: verifica canTransition INAINTE de a salva
   Daca tranzitia nu e permisa → 400 "Nu se poate trece de la X la Y"

3. Frontend:
   Pe pagina comanda, butonul de schimbare status arata DOAR statusurile permise
   (din getNextStatuses). Celelalte sunt ascunse.

   Admin → Setari → Configurare Liste → Statusuri Comenzi:
   - Tabel editabil cu statusuri + allowed_transitions (checkboxuri matrice)
   - Vizualizare flux ca diagram (status A → B → C)

Teste: tranzitie valida OK, tranzitie invalida 400, adauga status custom, 
  flux complet draft→shipped.
npm test → trec.
---SFARSIT PROMPT---

COMMIT: "Statusuri comenzi configurabile cu state machine"
