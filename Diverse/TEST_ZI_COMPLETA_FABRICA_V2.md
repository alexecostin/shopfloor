# TEST CAP-COADA v2: O ZI IN FABRICA — COMPLET
# Incorporeaza TOATE modificarile: ture configurabile, lookup generic,
# multi-currency, i18n, timezone, aprobare MBOM, contacte per context,
# mentenanta planificata, cost complet 7 elemente, responsive, tema.
#
# Prompt Claude Code:
# "Citeste acest fisier. Implementeaza TOATE testele ca teste automate
#  in tests/e2e/full-platform-v2.test.js.
#  Ruleaza. Raporteaza. Corecteaza tot ce nu trece. Re-ruleaza pana e 100% verde.
#  Apoi implementeaza TOATE sugestiile [FIX] si [UX]."

# ═══════════════════════════════════════
# SETUP: FABRICA "METALEX SRL"
# ═══════════════════════════════════════

Tenant: Metalex SRL, tier: enterprise, toate modulele active
Default currency: RON
Default language: ro
Available languages: ro, en

Fabrici:
  Fabrica Cluj (timezone: Europe/Bucharest)
    Sectia CNC (4 masini: CNC-01..04)
    Sectia Asamblare (2 masini: ASM-01, ASM-02)
    Sectia Debitare (1 masina: DEB-01)
    Ture Cluj default: L-V 3 ture (06:00-14:00, 14:00-22:00, 22:00-06:00), S 2 ture, D inchis
    Exceptie Sectia Asamblare: L-V 2 ture (fara T3), S 1 tura

  Fabrica Sibiu (timezone: Europe/Bucharest)
    Sectia CNC (2 masini: CNC-S01, CNC-S02)
    Ture Sibiu default: L-V 2 ture (07:00-15:30, 15:30-00:00), S-D inchis

Companii:
  AutoParts GmbH — tip: [client], contacte: Hans Mueller (comenzi_cnc), Maria Schmidt (calitate)
  ArcelorMittal — tip: [furnizor], contacte: Ion Popescu (vanzari_otel), Ana Radu (livrari)
  ServoTech SRL — tip: [furnizor, firma_mentenanta], contacte: Mihai Ionescu (mentenanta)
  Sandvik — tip: [furnizor], contacte: Erik Larsson (scule_cnc)

Useri (parola: Test1234!):
  admin@metalex.ro — Admin — scop: tot
  grigore.d@metalex.ro — Director — scop: Cluj + Sibiu
  ana.p@metalex.ro — Planificator — scop: Cluj + Sibiu
  mihai.r@metalex.ro — Sef Tura — scop: Cluj → Sectia CNC → Tura I
  costin.b@metalex.ro — Operator — scop: Cluj → Sectia CNC
  elena.v@metalex.ro — Operator — scop: Cluj → Sectia Asamblare
  bogdan.l@metalex.ro — Mentenanta — scop: Cluj
  diana.m@metalex.ro — Logistica — scop: Cluj
  viewer@metalex.ro — Viewer — scop: Cluj

Produse MBOM (aprobat, activ):
  ARBORE-S42: debitare(DEB-01,30s) → strunjire(CNC,45s) → frezare(CNC,60s) → tratament(TT,120s)
  FLANSA-F18: debitare(DEB-01,25s) → strunjire(CNC,45s) → rectificare(RECT,40s)
  MODUL-M22: ARBORE-S42 + FLANSA-F18 + 2×SURUB-M8 → asamblare(ASM,90s)

Comenzi active:
  CMD-001: 500 buc MODUL-M22, client AutoParts, contact Hans Mueller, deadline 18 apr, prioritate: ridicat
  CMD-002: 300 buc ARBORE-S42, client Dacia, deadline 22 apr, prioritate: normal
  CMD-003: 1000 buc FLANSA-F18, client Continental, deadline 25 apr, prioritate: normal

# ═══════════════════════════════════════
# FAZA 0: VERIFICARE CONFIGURATIE (Admin)
# Desktop 1920×1080
# ═══════════════════════════════════════

### T0.1 Lookup-uri configurabile
- Login admin → Admin → Setari → Configurare Liste
- VERIFICA: 12 tipuri de lookup vizibile (categorii opriri, motive rebuturi, tipuri masini, etc.)
- Click "Categorii opriri" → vede lista: lipsa_material, defect_utilaj, schimbare_produs, etc.
- Adauga categorie noua: code="lipsa_program_cnc", displayName="Lipsa program CNC", color="#9333EA"
- Salveaza → apare in lista
- [TEST] Login ca operator → la declarare oprire, dropdown contine "Lipsa program CNC"
- Dezactiveaza "Altul" → [TEST] nu mai apare in dropdown operator, dar datele vechi cu "Altul" raman

### T0.2 Ture configurabile
- Admin → Setari → Ture
- Selecteaza Fabrica Cluj
- VERIFICA: tab Program Saptamanal arata grid L-D × T1,T2,T3 cu checkbox-uri
- VERIFICA: L-V = T1+T2+T3 bifate, S = T1+T2, D = nimic
- Click "Sectia Asamblare are program diferit" → deschide config separata
- VERIFICA: Asamblare L-V = T1+T2 (fara T3)
- Tab Exceptii → adauga: 1 Mai = inchis (recurring=true), 20 Apr = 3 ture inclusiv S (comanda urgenta)
- Tab Calendar → VERIFICA: 1 Mai rosu (inchis), 20 Apr albastru (exceptie ture extra)
- Selecteaza Fabrica Sibiu → VERIFICA: ture diferite (07:00-15:30, 15:30-00:00)

### T0.3 Moneda
- Admin → Setari → General → Moneda default: RON
- VERIFICA: pe dashboard, sumele apar in RON (ex: "12.450 lei" nu "€12,450")
- Adauga rata EUR→RON = 4.97 pt azi
- [TEST] Comanda CMD-001 are cost in EUR (furnizor german) → raport arata echivalent in RON

### T0.4 Limba
- Click selector limba in header → schimba la English
- VERIFICA: TOATE textele se schimba: "Dashboard" ramane, "Productie" → "Production", "Salveaza" → "Save", "Oprire masina" → "Machine Stop"
- VERIFICA: lookup values arata display_name_en (daca exista)
- Schimba inapoi la Romana

### T0.5 Tema
- Admin → Setari → Tema
- Upload logo Metalex PNG
- Schimba primary_color: #2563EB (albastru)
- Preview live → sidebar se schimba instant
- Salveaza → logout → pagina login arata logo Metalex + culoare albastra
- [TEST] Alt browser/incognito → pagina login arata tema Metalex (din /theme/public)

### T0.6 Template email
- Admin → Setari → Template-uri Email
- Click "Alerta notificare" → vede template cu {{alertTitle}}, {{alertMessage}}, {{machineCode}}
- Modifica subiectul: "⚠️ Metalex Alert: {{alertTitle}}"
- Preview → VERIFICA: variabilele inlocuite cu date dummy
- Salveaza

[FIX-T0.1] Daca adminul schimba moneda din EUR in RON, sumele vechi (introduse in EUR) trebuie convertite la afisare, nu modificate in DB. Afisarea = suma_originala × rata la data tranzactiei.
[FIX-T0.2] La schimbare limba, lookup values fara display_name_en → afiseaza display_name (romana) ca fallback, nu camp gol.

# ═══════════════════════════════════════
# FAZA 1: OPERATOR — TURA I (06:00-14:00)
# Tableta 8" portrait (800×1280)
# ═══════════════════════════════════════

### T1.1 Login + detectie tura automata
- Login costin.b → OperatorLayout (fara sidebar, 4 butoane mari)
- VERIFICA: header arata "Tura I — 06:00-14:00" (din shift config, NU hardcodat)
- VERIFICA: daca login la 05:50 (inainte de tura) → mesaj "Tura I incepe la 06:00"
- VERIFICA: daca login la 14:30 (dupa tura) → arata "Tura II — 14:00-22:00" sau "Intre ture"
- VERIFICA: masina dropdown arata DOAR masini din Sectia CNC (scop)
- Selecteaza CNC-01

### T1.2 Checklist debut serie
- Tap Checklist → checklist "Debut serie CNC"
- VERIFICA: textele sunt in limba configurata (romana default)
- Bifeaza toate punctele → Trimite → confirmare verde
- [TEST] A doua oara pe aceeasi masina+comanda+tura → "Checklist deja completat"

### T1.3 Raportare productie
- Tap "Raporteaza Productie"
- Comanda default: CMD-002 (prima planificata azi pe CNC-01 — din planning, NU hardcodat)
- Piese bune: 35, Rebuturi: 2
- Motiv rebut: dropdown arata motivele din lookup (inclusiv customizate de admin)
- Selecteaza "Cota in afara tolerantei"
- Trimite → mini-rezumat: "Azi pe CMD-002: 35/300 (11.7%). Ramas: 265 piese."
- VERIFICA: sumele in moneda tenantului (daca se afiseaza cost)

### T1.4 Raportare repetata (buton "Repeta")
- Buton "Repeta ultimul raport" → pre-completeaza: CNC-01, CMD-002, 35 piese, 0 rebuturi
- Modifica doar piesele: 30 → Trimite
- Mini-rezumat: "Azi pe CMD-002: 65/300 (21.7%). Ramas: 235 piese."

### T1.5 Declara oprire
- Tap "Oprire masina"
- Dropdown categorii: din lookup stop_categories (inclusiv "Lipsa program CNC" adaugat de admin)
- Selecteaza "Lipsa material" → oprirea incepe
- VERIFICA: timer vizibil pe ecran (cronometru live: 00:00, 00:01, 00:02...)
- VERIFICA: iconita masina in header devine rosie (oprire activa)
- [TEST] Incearca sa raportezi piese cu oprire activa → warning "Masina in oprire"

### T1.6 Inchide oprire + resume app
- Tap "Inchide oprire" → durata: 8 minute
- VERIFICA: timer se opreste, iconita masina revine la verde
- [SIMULEAZA] Tableta adoarme 20 min → re-deschide app → NU apare popup oprire (a fost inchisa)
- [SIMULEAZA] Declara oprire noua → tableta adoarme → re-deschide → APARE popup "Ai o oprire deschisa de 20 min. Inca oprita sau ai uitat sa inchizi?"

### T1.7 Cerere mentenanta cu foto
- Tap "Cerere Mentenanta"
- Tip problema: dropdown din lookup (nu hardcodat)
- Descriere: "Zgomot puternic la turatie mare"
- Atasare foto: tap camera → fa poza → atasata la cerere
- Trimite → confirmare

### T1.8 Cerere concediu
- Bottom bar → Concediu
- Cerere noua: 20-21 aprilie, tip: dropdown din lookup leave_types (nu hardcodat)
- Selecteaza "Concediu odihna"
- VERIFICA: zile disponibile (daca se trackuieste)
- Trimite → status "In asteptare"

### T1.9 Tura mea (jurnal)
- Bottom bar → Tura mea
- VERIFICA: lista cronologica: checklist, 2 rapoarte, 1 oprire (8 min), 1 cerere mentenanta
- VERIFICA: total azi: 65 piese bune, 2 rebuturi, 8 min downtime

[FIX-T1.1] Butoanele pe tableta 8" trebuie min 64px height. VERIFICA cu Chrome DevTools responsive mode.
[FIX-T1.2] Daca operatorul are roluri multiple [operator, maintenance], layout-ul trebuie sa fie OperatorLayout + tab extra "Mentenanta" in bottom bar. Nu AppLayout.
[UX-T1.1] Haptic feedback (navigator.vibrate(50)) la confirmare raport pe tableta.
[UX-T1.2] Dark mode automat dupa 22:00 (Tura III e noaptea — ecranul luminos deranjeaza).

# ═══════════════════════════════════════
# FAZA 2: SEF TURA — SUPERVIZARE
# Tableta 10" landscape (1280×800)
# ═══════════════════════════════════════

### T2.1 Dashboard tura
- Login mihai.r → sidebar colapsabil (tableta landscape)
- Dashboard arata: DOAR Sectia CNC, DOAR Tura I (scop)
- Header clar: "TURA I — 06:00-14:00 — 17 Aprilie 2026" (ore din shift config)
- VERIFICA: 4 masini CNC cu status live (verde=produce, rosu=oprit, gri=idle)
- Pe fiecare masina: operator alocat (din planning), piese produse azi, OEE

### T2.2 OEE cu ore din config (nu hardcodat)
- CNC-01 OEE: planned_minutes = productive_minutes din shift config Tura I (450 min dupa pauza)
- VERIFICA: OEE availability = (450 - 8 min oprire) / 450 = 98.2%
- VERIFICA: NU 480 min hardcodat, ci din shift_definitions.productive_minutes

### T2.3 Aprobare concediu cu impact
- Meniu → Echipa → Concedii → vede cererea lui Costin (20-21 apr)
- Click Aproba → warning: "Costin Barbu e planificat pe CNC-01 in 20-21 apr. Impactul: 2 operatii neacoperite."
- Aproba cu nota "Inlocuit de Andrei"
- VERIFICA: notificare automata trimisa la Planificator (Ana) — "Operator indisponibil 20-21 apr"
- [TEST] Email trimis la Ana cu template configurabil (subiectul din T0.6)

### T2.4 Predare-primire tura
- La 13:45 (aproape de sfarsitul turei din config):
- Buton "Predare tura" → formular:
  - Note: "CNC-02 vibreaza la turatie mare. CNC-04 in avans pe CMD-002."
  - Status masini (auto-populat): CNC-01 activa, CNC-02 activa cu warning, CNC-03 idle, CNC-04 activa
  - Raport auto-generat: "Tura I, 17 apr: 245 piese, 8 rebuturi (3.2%), 8 min downtime, OEE 78%"
- Salveaza → Sef Tura II vede la login

[FIX-T2.1] Sfarsitul turei (cand apare butonul "Predare tura") = end_time din shift config, NU 14:00 hardcodat.
[FIX-T2.2] Raportul auto-generat trebuie sa foloseasca ore REALE din config (nu 8h fixe per tura).
[UX-T2.1] Push notification la 15 min inainte de sfarsit tura: "Tura I se termina la 14:00. Completeaza predarea."

# ═══════════════════════════════════════
# FAZA 3: PLANIFICATOR — LUCREAZA
# Desktop 1920×1080, dual monitor
# ═══════════════════════════════════════

### T3.1 BOM/MBOM + flux aprobare
- Login ana.p → sidebar cu meniu planificator
- Meniu → BOM/MBOM → Editor → MODUL-M22
- VERIFICA: arbore vizual cu ramuri: ARBORE-S42, FLANSA-F18, SURUB-M8 → Asamblare
- VERIFICA: badge "Activ v1.0" pe MBOM (aprobat)
- Modifica timp ciclu pe Strunjire ARBORE-S42: 45s → 50s
- VERIFICA: badge se schimba instant la "Draft v1.1"
- VERIFICA: planificatorul INCA foloseste v1.0 (last_approved_version)
- Click "Trimite spre aprobare"
- VERIFICA: status → "In asteptare nivel 1 (Sef Sectie)"
- Login ca shift_leader → Notificari → "MBOM MODUL-M22 v1.1 asteapta aprobarea ta"
- Aproba cu comentariu "OK, timp ciclu actualizat corect"
- VERIFICA: daca workflow are 2 nivele → trece la nivel 2 (Director)
- Login director → Aproba
- VERIFICA: MBOM → "Activ v1.1", planificatorul acum foloseste v1.1

### T3.2 Genereaza plan cu ture reale
- Meniu → Planificare → Genereaza plan → saptamana 17 apr
- VERIFICA: algoritmul foloseste ore din shift config:
  - CNC-01 (Sectia CNC): L-V = 3 ture × ~7.5h productive = 22.5h/zi
  - ASM-01 (Sectia Asamblare): L-V = 2 ture × ~7.5h = 15h/zi
  - S pe CNC: 2 ture = 15h. S pe Asamblare: 1 tura = 7.5h
  - Fabrica Sibiu: L-V = 2 ture cu ore diferite (07:00-15:30, 15:30-00:00)
- Apasa Genereaza → Gantt apare
- VERIFICA: barele pe Gantt au durata proportionala cu orele REALE din config
- VERIFICA: Costin Barbu NU e alocat pe 20-21 apr (concediu aprobat)
- VERIFICA: ARBORE-S42 si FLANSA-F18 planificate in paralel pe masini diferite
- VERIFICA: Asamblare MODUL-M22 planificata DUPA ambele piese 100% gata
- VERIFICA: sageti dependenta vizibile pe Gantt

### T3.3 CTP cu verificare stoc + ture
- Client nou: "500 buc ARBORE-S42, cat de repede?"
- Meniu → CTP → mod full → ARBORE-S42 → 500 buc
- Bifa: overtime DA, tura extra DA
- Calculeaza
- VERIFICA: termenul tine cont de ture active (nu 24h/zi ci 22.5h L-V, 15h S, 0 D)
- VERIFICA: daca material insuficient → warning "OTEL-42CrMo4: stoc 200kg, necesar 350kg. Adauga 5 zile lead time furnizor."
- VERIFICA: varianta Standard vs Rapida (cu overtime) au termene diferite
- VERIFICA: sumele in RON (moneda tenant)

### T3.4 CTP mod rapid
- Alt client: "100 piese simple, 3 operatii"
- CTP → mod rapid → introduce manual:
  Debitare (Fierastrau, 30s, setup 10min), Strunjire (CNC, 60s, setup 25min), Frezare (CNC, 45s, setup 20min)
- Calculeaza → VERIFICA: termen realist bazat pe capacitate reala

### T3.5 Simulare what-if
- Planificare → Simulari → "CNC-03 in mentenanta 3 zile"
- Ruleaza → comparatie side-by-side
- VERIFICA: impact summary arata comenzi intarziate + cu cate zile
- [TEST] Creeaza al doilea scenariu: "Comanda urgenta 200 buc"
- VERIFICA: poate compara 3 planuri simultam (original + 2 scenarii)

### T3.6 Import comenzi cu mapping
- Comenzi → Import → upload Excel cu 2 comenzi noi
- VERIFICA: mapping UI cu SearchableSelect pe "Client" — cauta "Auto" → apare AutoParts
- Client nou "Festo Romania" nu exista → click "+ Adauga client nou" → mini-modal → salveaza → selectat automat
- Contact: dropdown filtrat pe contactele clientului nou creat (gol) → "+ Adauga contact" → completeaza
- Preview: 2 randuri verzi
- Confirm → comenzile apar cu contact asignat

[FIX-T3.1] Gantt pe dual monitor: trebuie sa se poata detasa intr-o fereastra separata (buton "Deschide Gantt fullscreen").
[FIX-T3.2] CTP cu ture: daca fabrica e inchisa duminica → termenul NU include duminicile. Calculul trebuie sa foloseasca getWorkingDaysBetween.
[FIX-T3.3] Import: daca coloana "Prioritate" din Excel are valoare care nu exista in lookup priority_levels → warning galben + sugestie fuzzy match din lookup.
[UX-T3.1] Gantt: tooltip la hover pe bara arata: produs, cantitate, operator sugerat, setup, status material, scula montata.
[UX-T3.2] CTP: buton "Creeaza comanda din aceasta simulare" → pre-completeaza formular comanda cu datele din CTP.
[UX-T3.3] La generare plan, progress bar cu mesaje: "Calculez dependente... Aloc masini... Verific operatori... Gata!"

# ═══════════════════════════════════════
# FAZA 4: DIRECTOR — OVERVIEW
# Laptop 14"
# ═══════════════════════════════════════

### T4.1 Dashboard executiv consolidat
- Login grigore.d → Dashboard Executiv
- VERIFICA: KPI consolidat pe AMBELE fabrici (Cluj + Sibiu)
- VERIFICA: sume in RON (moneda tenant)
- VERIFICA: trend sageata ↑↓ fata de saptamana trecuta pe fiecare KPI
- VERIFICA: "Morning briefing" text auto-generat: "Ieri: 3 comenzi on track, 1 la risc. OEE mediu 74% (+2%)."
- Click "Fabrica Cluj" → drill-down → KPI doar Cluj
- Click "Sectia CNC" → drill-down → KPI doar CNC
- Click "CNC-01" → drill-down → detalii masina cu OEE, opriri, piese

### T4.2 Costuri cu 7 elemente
- Costuri → Per comanda → CMD-001
- VERIFICA: breakdown pe 7 categorii: masina, manopera, materiale, scule, consumabile, energie, overhead
- VERIFICA: fiecare element arata planificat vs real vs diferenta
- VERIFICA: elementele inactive (dezactivate de admin) NU apar
- VERIFICA: sumele in RON, formatate cu separator configurabil (1.234,56 lei)
- VERIFICA: grafic pie chart cu distributia costului pe categorii
- VERIFICA: marja = (pret vanzare - cost total) / pret vanzare × 100%

### T4.3 Profitabilitate clienti
- Costuri → Profitabilitate clienti
- VERIFICA: AutoParts GmbH: venituri (RON), costuri (RON), marja %
- VERIFICA: costuri includ mentenanta alocata proportional la comenzile clientului
- VERIFICA: trend marja pe ultimele 3 luni (grafic linie)

### T4.4 Raport PDF cu tema
- Rapoarte → P/R/R per masina → saptamana curenta → Export PDF
- VERIFICA: PDF-ul are logo Metalex (din tema), culori tema, data generare
- VERIFICA: tabel cu Planificat/Realizat/Rebuturi pe masini reale
- VERIFICA: ore disponibile per masina = din shift config (nu 8h fixe)
- Buton "Trimite pe email" → email trimis cu template configurabil

### T4.5 Alerte
- Alerte → lista
- VERIFICA: "Stoc OTEL sub minim" → severity din lookup priority_levels (culoare configurata)
- VERIFICA: "CNC-01 cerere mentenanta deschisa" → cu foto atasata de operator
- VERIFICA: sugestii actiune: "Plaseaza comanda la ArcelorMittal" cu link

[FIX-T4.1] Dashboard executiv: daca directorul are acces la 3 fabrici in timezone-uri diferite (Cluj = UTC+2, Sibiu = UTC+2), datele trebuie normalizate la acelasi fus orar pt consolidare.
[UX-T4.1] Export raport: optiune "Programeaza raport saptamanal pe email" — directorul primeste automat luni dimineata.

# ═══════════════════════════════════════
# FAZA 5: MENTENANTA — INTERVENTIE
# Telefon mobil 375×812
# ═══════════════════════════════════════

### T5.1 Login mobil
- Login bogdan.l → bottom nav: Dashboard | Interventii | Scule | Planificate | Profil
- VERIFICA: tot e utilizabil pe 375px (font 16px+, butoane 48px+)
- Dashboard: cereri noi (badge rosu), in lucru, planificate saptamana asta

### T5.2 Preia cerere cu foto
- Tab Interventii → cererea de la Costin (CNC-01, zgomot)
- VERIFICA: vede poza atasata de operator
- VERIFICA: tip problema din lookup (nu hardcodat)
- Tap "Preia" → status "In lucru" → timer incepe

### T5.3 Consuma piesa de schimb
- In timpul interventiei → Piese schimb → cauta "Rulment SKF 6205"
- SearchableSelect: scrie "rulm" → apare "Rulment SKF 6205 — stoc: 3 buc"
- Marcheaza "Folosit 1 buc" → legat de aceasta cerere (parts_used pe interventie)
- VERIFICA: stocul scade la 2
- VERIFICA: daca stocul = min_stock → alerta automata la Logistica
- VERIFICA: purchase_history al rulmentului arata: furnizor SKF Romania, cost 45 RON, ultima achizitie

### T5.4 Rezolva cu foto dupa
- Tap "Rezolva"
- Fa foto dupa reparatie → ataseaza
- Descriere: "Inlocuit rulment axial SKF 6205"
- Cost real: 45 RON (piesa) + 0 (intern)
- Confirma → ecran verde "Interventie finalizata — CNC-01 disponibila"
- Timer: 35 min durata
- VERIFICA: costul se adauga la costul operare CNC-01

### T5.5 Mentenanta planificata
- Tab Planificate → calendar luna
- VERIFICA: CNC-02 are revizie planificata 20 apr cu ServoTech SRL
- Tap → detalii: status "Confirmata", cost estimat 800 RON, contact Mihai Ionescu
- VERIFICA: CNC-02 apare ca indisponibila pe 20 apr in Gantt planificator
- VERIFICA: recurenta: dupa completare, urmatoarea la 2000 ore sau 6 luni

### T5.6 Scule aproape de limita
- Tab Scule → matrita MATR-01: 47.000 / 50.000 cicluri
- VERIFICA: highlight galben "Aproape de limita — 94%"
- VERIFICA: furnizor afisat: Sandvik, cost achizitie: 15.000 RON
- [TEST] Daca operatorul raporteaza 200 piese pe masina cu MATR-01 → cicluri = 47.200
- VERIFICA: incrementare automata a ciclurilor dupa raport productie

[FIX-T5.1] Pe mobil 375px, calendar mentenanta e greu de citit. Alternativa: lista cronologica in loc de calendar grid.
[FIX-T5.2] Consumul de piese de schimb trebuie sa afiseze costul in moneda tenant (RON), nu hardcodat EUR.
[UX-T5.1] Scanare QR pe scula/piesa: camera → scaneaza → identifica automat articolul.
[UX-T5.2] Push notification diferentiata: cerere critica = sunet + vibratie, normala = doar badge.

# ═══════════════════════════════════════
# FAZA 6: LOGISTICA — STOCURI
# Desktop 1920×1080
# ═══════════════════════════════════════

### T6.1 Receptie cu SearchableSelect + contact
- Login diana.m → sidebar logistica
- Stocuri → Receptii → NIR Nou
- Furnizor: SearchableSelect → scrie "Arcel" → apare ArcelorMittal
- Contact: dropdown filtrat → Ion Popescu (tag: vanzari_otel) → selecteaza
- Adauga linie: OTEL-42CrMo4, 500 kg, 2.80 RON/kg (moneda tenant!)
- Confirma → stoc actualizat, purchase_history creat, contact asignat pe NIR
- VERIFICA: GET /inventory/items/:otel_id/price-trend → grafic cu preturile achizitiilor

### T6.2 Furnizori per articol
- Stocuri → OTEL-42CrMo4 → tab Furnizori
- VERIFICA: ArcelorMittal = primar, 2.80 RON/kg, lead time 5 zile
- Adauga furnizor alternativ: ThyssenKrupp, 3.10 RON/kg, lead time 3 zile, prioritate 2
- VERIFICA: lista arata ambii furnizori ordonati dupa prioritate

### T6.3 Necesar materiale cu stoc in tranzit
- Necesar Materiale → Calcul → selecteaza CMD-001, CMD-002, CMD-003
- VERIFICA: lista cu necesar, stoc disponibil, IN TRANZIT (comenzi plasate nelivrate), deficit
- VERIFICA: "OTEL-42CrMo4: necesar 800kg, stoc 500kg, in tranzit 200kg, deficit 100kg"
- Buton "Genereaza comanda" → pre-completeaza: ArcelorMittal (furnizor primar), 100kg, contact Ion Popescu
- [TEST] Daca furnizor primar are lead time mare → sugestie: "ThyssenKrupp livreaza in 3 zile vs 5 zile ArcelorMittal"

### T6.4 Import receptie din PDF scanat
- Import → Upload PDF scanat (aviz furnizor)
- VERIFICA: OCR extrage textul → parsing structurat → mapping UI
- Mapping: coloana "Denumire" → product_reference, "Cant." → quantity
- Preview → randul cu articol necunoscut: galben cu sugestie fuzzy match
- Confirm → stoc actualizat

### T6.5 Predictie consum
- Dashboard → widget "Stoc se termina in X zile"
- VERIFICA: "OTEL-42CrMo4: stoc 500kg, consum mediu 50kg/zi → se termina in ~10 zile"
- VERIFICA: calculul tine cont de comenzile planificate (nu doar media istorica)

[FIX-T6.1] Unitatile de masura pe NIR trebuie din lookup units_of_measure, nu hardcodate.
[FIX-T6.2] Pretul pe NIR trebuie sa accepte moneda diferita de tenant default (import EUR de la furnizor german → converteste la RON in rapoarte).
[UX-T6.1] Buton "Inventar fizic": introduce cantitati reale per articol → calculeaza diferente → genereaza ajustari automate cu motiv "Inventar fizic [data]".

# ═══════════════════════════════════════
# FAZA 7: VIEWER — READ ONLY
# Laptop
# ═══════════════════════════════════════

### T7.1 Acces restrictionat
- Login viewer → sidebar cu dashboards + rapoarte
- VERIFICA: ZERO butoane de creare/editare/stergere
- VERIFICA: butoanele exista dar sunt DISABLED (gri) cu tooltip "Nu ai permisiunea de a edita"
- [TEST] URL direct /machines/create → redirect la dashboard sau 403
- [TEST] API direct POST /machines → 403
- VERIFICA: poate exporta PDF raport (read = permis, write = blocat)

# ═══════════════════════════════════════
# FAZA 8: SCHIMB TURA (14:00)
# ═══════════════════════════════════════

### T8.1 Predare tura automata
- La 13:50 (10 min inainte de end_time Tura I din config):
- Push notification la Sef Tura Mihai: "Tura I se termina la 14:00. Completeaza predarea."
- Mihai deschide "Predare tura" → raport auto-generat cu date din tura
- Salveaza note → Sef Tura II se logheaza → vede notele

### T8.2 Tura II preia
- Login sef tura II → Dashboard arata "Note de la Tura I: CNC-02 vibreaza..."
- VERIFICA: datele pe dashboard sunt DOAR din tura lui (Tura II, de la 14:00)
- Productia lui Costin (Tura I) NU apare in "productia turei mele"

# ═══════════════════════════════════════
# FAZA 9: TESTE RESPONSIVE
# ═══════════════════════════════════════

### T9.1 Desktop → Tableta → Mobil
Pentru FIECARE pagina principala (dashboard, masini, comenzi, stocuri, rapoarte):
- 1920px: sidebar permanent, tabel cu toate coloanele, grafice mari
- 1024px: sidebar colapsabil (hamburger), tabel cu coloane esentiale, grafice medii
- 768px: sidebar overlay, tabele devin carduri stivuite
- 375px: bottom nav, carduri full-width, grafice mici, font 16px+

### T9.2 Operator pe mobil (375px)
- VERIFICA: 4 butoane mari vizibile FARA scroll
- VERIFICA: fiecare buton min 64px height
- VERIFICA: dropdown masina functioneaza pe touch (nu e minuscul)
- VERIFICA: raportare completa fara sa scrollezi orizontal

### T9.3 Director pe tableta (1024px)
- VERIFICA: dashboard cu grafice readable
- VERIFICA: drill-down functioneaza cu touch
- VERIFICA: tabelele nu au scroll orizontal (coloane esentiale vizibile)

# ═══════════════════════════════════════
# FAZA 10: TESTE EDGE CASES
# ═══════════════════════════════════════

### T10.1 Tura crosses midnight
- Fabrica cu Tura III: 22:00-06:00 (crosses_midnight=true)
- Login operator la 23:00 → VERIFICA: "Tura III — 22:00-06:00"
- Login operator la 03:00 → VERIFICA: tot "Tura III" (nu Tura I)
- Raport la 03:00 → se salveaza pe data de IERI (cand a inceput tura)

### T10.2 Zi fara ture (duminica, sarbatoare)
- Login duminica → VERIFICA: mesaj "Fabrica inchisa azi" (din shift config, 0 ture active)
- Login 1 Mai → VERIFICA: mesaj "Sarbatoare: Ziua Muncii" (din schedule_exceptions)
- [TEST] Planificatorul nu aloca nimic duminica sau 1 Mai

### T10.3 Fabrica cu o singura tura
- Fabrica Sibiu: 2 ture (07:00-15:30, 15:30-00:00)
- VERIFICA: OEE calculat pe ore reale (nu 24h)
- VERIFICA: CTP cu Sibiu → termen mai lung (mai putine ore/zi)

### T10.4 Module dezactivate
- Admin dezactiveaza "costs_realtime"
- Login director → Costuri nu apare in meniu
- Navigare directa /costs → mesaj "Disponibil in pachetul Enterprise"
- Re-activeaza

### T10.5 Limba engleza end-to-end
- Schimba limba la English
- Parcurge TOATE paginile: dashboard, productie, planificare, stocuri, admin
- VERIFICA: ZERO texte in romana (totul tradus)
- Lookup values: afiseaza display_name_en unde exista, fallback la display_name

# ═══════════════════════════════════════
# RAPORT FINAL
# ═══════════════════════════════════════

La sfarsit, genereaza:

```
═══ SHOPFLOOR.RO — RAPORT TESTE E2E v2 ═══

Total faze: 10
Total teste: XXX

✅ PASSED: XXX
❌ FAILED: XXX
⚠️ WARNINGS: XXX

FAILURES:
1. Faza X, Test Y.Z: [descriere]
   Expected: ...
   Actual: ...
   Cauza probabila: ...

FIXURI DE IMPLEMENTAT: [lista]
UX DE IMPLEMENTAT: [lista]

URMATORUL PAS: Corecteaza failures + implementeaza fixuri + re-ruleaza.
```

# ═══════════════════════════════════════
# SUMAR FIXURI + UX DIN ACEST TEST
# ═══════════════════════════════════════

FIXURI (trebuie rezolvate):
FIX-T0.1: Sumele vechi in EUR afisate cu conversie la RON, nu modificate in DB
FIX-T0.2: Lookup fara traducere en → fallback la display_name, nu camp gol
FIX-T1.1: Butoane operator min 64px pe tableta
FIX-T1.2: Operator cu roluri multiple → OperatorLayout + tab-uri extra
FIX-T2.1: Sfarsitul turei din shift config, nu hardcodat
FIX-T2.2: Raport auto-generat cu ore din config
FIX-T3.1: Gantt detasabil fullscreen
FIX-T3.2: CTP cu getWorkingDaysBetween (exclude zile inchise)
FIX-T3.3: Import: valoare necunoscuta → fuzzy match din lookup
FIX-T4.1: Consolidare fabrici cu timezone-uri diferite
FIX-T5.1: Calendar mentenanta pe mobil → lista cronologica
FIX-T5.2: Cost piese schimb in moneda tenant
FIX-T6.1: Unitati masura pe NIR din lookup
FIX-T6.2: Pret NIR in moneda diferita → conversie in rapoarte

UX IMPROVEMENTS:
UX-T1.1: Haptic feedback la confirmare raport
UX-T1.2: Dark mode automat Tura III (noaptea)
UX-T2.1: Push notification inainte de sfarsit tura
UX-T3.1: Tooltip detaliat pe Gantt la hover
UX-T3.2: CTP → buton "Creeaza comanda"
UX-T3.3: Progress bar la generare plan
UX-T4.1: Raport programat saptamanal pe email
UX-T5.1: Scanare QR pe scule
UX-T5.2: Push diferentiat pe prioritate
UX-T6.1: Inventar fizic + calcul diferente
