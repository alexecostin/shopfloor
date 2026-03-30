# MENIURI PER ROL + RESPONSIVE + TEMA CONFIGURABILA
# Partea 1: CLAUDE.MD | Partea 2: Prompturi

# ═══════════════════════════════════════
# PARTEA 1: ADAUGA IN CLAUDE.MD
# ═══════════════════════════════════════

## NAVIGATIE PER ROL

Fiecare rol vede un meniu diferit, organizat pe FLUXUL LUI de lucru.
Meniul se construieste dinamic la login din: roluri user + permisiuni + module active.

### Structura meniu per rol:

OPERATOR (interfata tableta — butoane mari, zero complexitate):
  Header fix: [Masina selectata ▾] [Tura curenta] [Notificari]
  Ecran principal: 4 butoane mari grid 2×2:
    Raporteaza Productie | Oprire Masina
    Cerere Mentenanta | Checklist
  Bottom bar: Acasa | Tura Mea | Concediu | Profil
  FARA sidebar. Full-screen pe tableta/mobil.

SEF TURA:
  Sidebar: Dashboard Tura, Productie (rapoarte/opriri/OEE), Echipa (prezenta/concedii/skills), Mentenanta (cereri tura), Checklists, Rapoarte
  Vede DOAR datele din tura + sectia lui (scope filter)

PLANIFICATOR:
  Sidebar: Dashboard Planificare, Planificare (Gantt/genereaza/simulari/capacitate), CTP, BOM/MBOM (catalog/editor/aprobari/cale critica), Comenzi (active/noi/import), Masini (lista/setup/mentenanta), Rapoarte P/R/R

DIRECTOR:
  Sidebar: Dashboard Executiv (consolidat + drill-down), Costuri & Profitabilitate (comanda/piesa/client/trend), Comenzi, Productie (OEE overview), Alerte, Rapoarte (P/R/R/mentenanta/stocuri/export), Personal (concedii), Companii

MENTENANTA:
  Sidebar: Dashboard Mentenanta, Interventii (noi/in lucru/finalizate/toate), Planificate (calendar/programeaza/firme externe), Scule & Matrite (status/cicluri/mentenanta), Piese de schimb, Rapoarte mentenanta

LOGISTICA:
  Sidebar: Dashboard Stocuri, Stocuri (articole/alerte/receptii/eliberari/miscari), Necesar Materiale (calcul/comenzi), Furnizori (lista/istoric/trend preturi), Import (receptie/comenzi/template-uri), Rapoarte stocuri

VIEWER:
  Sidebar: Dashboards (read-only), Rapoarte (read-only)
  Toate butoanele de editare/creare ascunse.

ADMIN:
  Sidebar: Tot ce vad celelalte roluri + sectiune Administrare (Organizatie/Utilizatori/Roluri/Module/Licenta/Setari)

### Roluri multiple:
  User cu [director, planner] → vede UNIUNEA meniurilor ambelor roluri.
  Elementele duplicate se combina (nu apar de 2 ori).

## RESPONSIVE — 3 LAYOUT-URI

### Desktop (>1024px):
  - Sidebar stanga permanent (240px), expandat cu text + iconite
  - Continut dreapta, full remaining width
  - Header sus: breadcrumb + scope selector (fabrica) + notificari + profil

### Tableta (768-1024px):
  - Sidebar colapsabil: default ascuns, hamburger menu stanga sus
  - Click hamburger → sidebar overlay (peste continut, backdrop)
  - Continut full-width
  - Header: hamburger + logo + scope selector + notificari
  - EXCEPTIE operator: fara sidebar deloc, bottom bar + ecran full

### Mobil (<768px):
  - FARA sidebar
  - Bottom navigation bar fix: 4-5 iconite per rol
    Operator: Acasa | Productie | Mentenanta | Profil
    Sef tura: Dashboard | Productie | Echipa | Rapoarte | Profil
    Director: Dashboard | Costuri | Comenzi | Alerte | Profil
    Mentenanta: Dashboard | Interventii | Scule | Planificate | Profil
    Logistica: Dashboard | Stocuri | Necesar | Import | Profil
  - Continut scrollabil, full-width
  - Header compact: logo + notificari badge

### Breakpoints Tailwind:
  sm: 640px (mobil landscape)
  md: 768px (tableta portrait)
  lg: 1024px (tableta landscape / desktop mic)
  xl: 1280px (desktop)

## TEMA CONFIGURABILA PER TENANT

### system.tenant_theme (tema vizuala per client)
  - id UUID PK
  - tenant_id UUID FK → system.tenants UNIQUE
  - logo_url VARCHAR(500) (URL sau base64)
  - logo_dark_url VARCHAR(500) (versiune pt dark mode)
  - favicon_url VARCHAR(500)
  - primary_color VARCHAR(7) (hex: #00D4AA)
  - secondary_color VARCHAR(7)
  - accent_color VARCHAR(7)
  - danger_color VARCHAR(7) DEFAULT '#FF4757'
  - warning_color VARCHAR(7) DEFAULT '#FFB020'
  - success_color VARCHAR(7) DEFAULT '#00D4AA'
  - sidebar_bg VARCHAR(7)
  - header_bg VARCHAR(7)
  - font_family VARCHAR(100) DEFAULT 'DM Sans'
  - dark_mode_enabled BOOLEAN DEFAULT true
  - company_name_display VARCHAR(255) (ce apare in header)
  - login_background_url VARCHAR(500)
  - custom_css TEXT (CSS aditional, max 5KB)

### Cum se aplica:
  - La login: API returneaza theme-ul tenant-ului
  - Frontend seteaza CSS variables din theme:
    --color-primary: {primary_color}
    --color-sidebar-bg: {sidebar_bg}
    etc.
  - Logo se afiseaza in sidebar header + pagina login
  - Dark mode: toggle in profil user, respecta preferinta OS daca nu e setat

### Reguli tema:
  - Daca tenant nu are tema configurata → tema default ShopFloor (verde accent pe dark)
  - Admin poate configura tema din Administrare → Setari → Tema
  - Preview live inainte de salvare
  - Logo: upload fisier (max 500KB, jpg/png/svg) → salvat in storage

# ═══════════════════════════════════════
# PARTEA 2: PROMPTURI CLAUDE CODE
# ═══════════════════════════════════════

## PROMPT MENIU-1: Restructurare navigatie + responsive layout

---INCEPUT PROMPT---
Citeste CLAUDE.MD sectiunile "NAVIGATIE PER ROL" si "RESPONSIVE — 3 LAYOUT-URI".

Rescrie complet structura de navigatie a frontend-ului.

1. Creeaza src/frontend/src/config/menuConfig.js:

   Exporta functie: getMenuForUser(user)
   - Primeste: user cu roles[], permissions[], activeModules[]
   - Returneaza: array de menu items adaptat rolului

   Structura menu item:
   {
     id: 'production',
     label: 'Productie',
     icon: 'Factory',  // lucide-react icon name
     path: '/production',
     permission: 'production.dashboard.view',
     module: 'production',
     children: [
       {id: 'prod-reports', label: 'Rapoarte', path: '/production/reports', permission: 'production.reports.view_all'},
       {id: 'prod-stops', label: 'Opriri', path: '/production/stops', permission: 'production.stops.create'},
     ]
   }

   Logica:
   - Filtreaza: module activ? + permisiune prezenta?
   - Daca copil nu are permisiune → ascunde copilul
   - Daca parinte nu mai are copii vizibili → ascunde parintele
   - Roluri multiple: UNION din toate meniurile rolurilor

   Defineste meniurile COMPLETE pentru FIECARE rol din CLAUDE.MD:
   operator, shift_leader, planner, director, maintenance, logistics, viewer, admin

2. Creeaza src/frontend/src/layouts/AppLayout.jsx:
   - Detecteaza screen size: useMemo cu window.innerWidth + resize listener
   - Trei moduri: 'desktop' (>1024), 'tablet' (768-1024), 'mobile' (<768)
   
   Desktop: 
     <div className="flex min-h-screen">
       <Sidebar menu={menu} expanded={true} />
       <main className="flex-1 overflow-auto">{children}</main>
     </div>

   Tablet:
     <div className="min-h-screen">
       <Header hamburger onToggleSidebar />
       {sidebarOpen && <SidebarOverlay menu={menu} onClose />}
       <main>{children}</main>
     </div>

   Mobile:
     <div className="min-h-screen pb-16">
       <HeaderCompact />
       <main>{children}</main>
       <BottomNav items={bottomItems} />
     </div>

3. Creeaza src/frontend/src/components/Sidebar.jsx:
   - Logo tenant (din theme) in header
   - Menu items cu iconite lucide-react
   - Items cu children: expandabile (click → toggle submeniu)
   - Item activ: highlight cu primary_color
   - Footer: user name, rol, buton logout
   - Collapsed mode (doar iconite, 64px width) pentru tablet

4. Creeaza src/frontend/src/components/BottomNav.jsx:
   - Fix la bottom, 4-5 items per rol
   - Icon + label mic sub icon
   - Active item: primary_color
   - Badge pe Notificari (numar alerte noi)
   - getBottomNavForRole(roles):
     operator: [{icon: Home, label: 'Acasa', path: '/'}, {icon: Package, label: 'Productie', path: '/operator'}, {icon: Wrench, label: 'Mentenanta', path: '/maintenance/request'}, {icon: User, label: 'Profil', path: '/profile'}]
     shift_leader: [{icon: LayoutDashboard, ...}, {icon: Factory, ...}, {icon: Users, ...}, {icon: FileText, ...}, {icon: User, ...}]
     director: [{icon: LayoutDashboard, ...}, {icon: DollarSign, ...}, {icon: ClipboardList, ...}, {icon: Bell, ...}, {icon: User, ...}]
     etc.

5. Creeaza src/frontend/src/components/Header.jsx:
   Desktop: [Breadcrumb] [ScopeSelector fabrica ▾] [Search] [Notificari 🔔 badge] [User avatar ▾]
   Tablet: [☰ Hamburger] [Logo] [ScopeSelector] [🔔] [Avatar]
   Mobile: [Logo compact] [🔔 badge] [Avatar]

6. OPERATOR LAYOUT SPECIAL:
   Creeaza src/frontend/src/layouts/OperatorLayout.jsx:
   - NU are sidebar
   - Header fix: [Logo] [Masina: CNC-01 ▾] [Tura I] [🔔]
   - Continut: ecran full cu butoane mari (grid 2x2)
   - Bottom bar: 4 tab-uri
   - Toate elementele: min-height 48px (touch-friendly)
   - Font-uri mari: 16px minim
   - Detecteaza rolul operator → foloseste OperatorLayout in loc de AppLayout

7. Actualizeaza App.jsx:
   - Determina layout-ul din user.roles:
     Daca roles include DOAR 'operator' → OperatorLayout
     Altfel → AppLayout
   - Toate rutele existente functioneaza in ambele layout-uri

Toate componentele: Tailwind classes, responsive cu sm:/md:/lg:/xl: prefixes.
Testeaza: resize browser → layout-ul se schimba fluid.
---SFARSIT PROMPT---

COMMIT: "Navigatie per rol + 3 layout-uri responsive + operator layout special"

## PROMPT MENIU-2: Tema configurabila

---INCEPUT PROMPT---
Citeste CLAUDE.MD sectiunea "TEMA CONFIGURABILA PER TENANT".

1. Migrare: CREATE TABLE system.tenant_theme

2. Backend:
   GET /api/v1/admin/theme — tema curenta a tenant-ului
   PUT /api/v1/admin/theme (admin) — salveaza tema
   POST /api/v1/admin/theme/logo (admin) — upload logo (multipart, max 500KB)
   GET /api/v1/theme/public — tema publica (fara autentificare, pt pagina login)
     Returneaza: logo_url, company_name_display, primary_color, login_background_url
     (Se apeleaza INAINTE de login pentru a afisa logo-ul pe pagina de autentificare)

3. Frontend theme system:

   Creeaza src/frontend/src/hooks/useTheme.jsx:
   - La mount: GET /api/v1/theme/public → aplica tema pe pagina login
   - Dupa login: GET /api/v1/admin/theme → aplica tema completa
   - Salveaza tema in localStorage (cache)
   - Seteaza CSS variables pe :root:
     document.documentElement.style.setProperty('--color-primary', theme.primaryColor)
     etc.
   - Dark mode: toggle in profil, respecta prefers-color-scheme daca nu e setat explicit

   Creeaza src/frontend/src/config/defaultTheme.js:
   {
     primaryColor: '#00D4AA',
     secondaryColor: '#4A9EFF',
     accentColor: '#00D4AA',
     dangerColor: '#FF4757',
     warningColor: '#FFB020',
     successColor: '#00D4AA',
     sidebarBg: '#141B22',
     headerBg: '#1C252F',
     fontFamily: 'DM Sans',
     darkModeEnabled: true,
     companyNameDisplay: 'ShopFloor.ro'
   }

4. Pagina Admin → Setari → Tema:
   - Preview live: schimbi culoarea → sidebar-ul se schimba instant
   - Upload logo: drag & drop sau click, preview
   - Color picker per: primary, secondary, sidebar, header
   - Font: dropdown cu 5-6 optiuni (DM Sans, Inter, Roboto, Open Sans, Nunito)
   - Toggle dark mode enabled
   - Buton "Reseteaza la default ShopFloor"
   - Buton "Salveaza"

5. Pagina Login:
   - Afiseaza logo-ul tenant-ului (din /theme/public)
   - Afiseaza company_name_display sub logo
   - Background configurabil (login_background_url sau default gradient)
   - Butonul de login foloseste primary_color

6. Sidebar + Header:
   - Logo din tema (sau "SF" default daca nu e configurat)
   - Culorile sidebar-ului si header-ului din tema
   - Active menu item foloseste primary_color

7. Detectie tenant pe login:
   - Daca aplicatia ruleaza pe subdomain (alseca.shopfloor.ro):
     Extrage slug din subdomain → GET /api/v1/theme/public?slug=alseca → aplica tema
   - Daca ruleaza pe domeniu propriu sau IP: foloseste tema default

Teste vizuale: schimba culorile in admin → verifica ca se aplica pe sidebar, header, butoane.
---SFARSIT PROMPT---

COMMIT: "Tema configurabila per tenant: logo, culori, font, dark mode, pagina login"

## PROMPT MENIU-3: Actualizare toate paginile existente

---INCEPUT PROMPT---
Actualizeaza TOATE paginile existente sa functioneze in noua structura.

1. Fiecare pagina existenta (DashboardPage, OperatorPage, MachinesPage, 
   OrdersPage, MaintenancePage, UsersPage, etc):
   - Inlocuieste layout inline cu componenta din AppLayout/OperatorLayout
   - Adauga responsive classes Tailwind:
     Grid-uri: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
     Sidebar content: p-3 md:p-4 lg:p-6
     Tabele: pe mobil → se transforma in card-uri stivuite (nu tabel cu scroll orizontal)
     Butoane: min-h-[48px] pe touch (md:min-h-0 pe desktop)
     Font: text-sm md:text-base
   - Wrap in PermissionGuard unde e cazul
   - Wrap in ModuleGuard unde e cazul

2. Dashboard-uri per rol:
   - DashboardPage.jsx devine un router care afiseaza dashboard-ul potrivit rolului:
     director → ExecutiveDashboard (KPI consolidat, drill-down, costuri, trend)
     planner → PlanningDashboard (incarcare capacitara, comenzi la risc, Gantt mini)
     shift_leader → ShiftDashboard (OEE tura, opriri, echipa, checklists azi)
     operator → OperatorHome (4 butoane mari — deja exista)
     maintenance → MaintenanceDashboard (cereri noi, planificate, scule aproape limita)
     logistics → InventoryDashboard (alerte stoc, receptii azi, necesar materiale)
     admin/viewer → GeneralDashboard (overview tot)

3. Tabele responsive:
   Creeaza componenta src/frontend/src/components/ResponsiveTable.jsx:
   - Desktop (lg+): tabel normal <table> cu toate coloanele
   - Tablet/mobil (<lg): fiecare rand devine un card:
     <div class="bg-card rounded-lg p-3 mb-2">
       <div class="font-bold">{primary field}</div>
       <div class="text-sm text-muted">{secondary fields}</div>
       <div class="flex gap-2 mt-2">{action buttons}</div>
     </div>
   - Props: columns[], data[], primaryField, actions[]

4. Formulare responsive:
   - Pe desktop: grid cu 2-3 coloane
   - Pe mobil: toate campurile pe o singura coloana, full-width
   - Butoane: pe mobil full-width, pe desktop inline

5. Grafice responsive (Recharts):
   - ResponsiveContainer width="100%" height={isMobile ? 200 : 300}
   - Pe mobil: ascunde labels lungi, roteste labels axa X

Testeaza: resize browser de la 1280px la 375px (iPhone SE).
Fiecare pagina trebuie sa arate bine si sa fie utilizabila pe ORICE dimensiune.
---SFARSIT PROMPT---

COMMIT: "Toate paginile responsive + dashboards per rol + tabele adaptive"
