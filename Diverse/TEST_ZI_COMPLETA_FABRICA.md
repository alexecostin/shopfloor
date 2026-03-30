# TEST CAP-COADA: O ZI IN FABRICA
# Simulez fiecare rol. Notez ce merge, ce nu, ce imbunatatesc.
#
# Da acest fisier lui Claude Code:
# "Citeste acest fisier. Implementeaza TOATE testele ca teste automate.
#  Apoi implementeaza TOATE sugestiile de imbunatatire marcate cu [FIX] si [UX].
#  Ruleaza testele, corecteaza ce nu trece."

# ═══════════════════════════════════════
# SETUP: FABRICA FICTIVA "METALEX SRL"
# ═══════════════════════════════════════

Companie: Metalex SRL (piese metalice CNC + asamblare, 85 angajati)
Tier: Professional (upgrade spre Enterprise in evaluare)
2 locatii: Fabrica Cluj (principala) + Fabrica Sibiu (secundara)

Fabrica Cluj:
  Sectia CNC: CNC-01, CNC-02, CNC-03, CNC-04 (strunguri + freze)
  Sectia Asamblare: ASM-01, ASM-02
  Sectia Debitare: DEB-01 (fierastrau banda)
  Sectia Tratament: TT-01 (cuptor tratament termic)

Fabrica Sibiu:
  Sectia CNC: CNC-S01, CNC-S02
  Sectia Rectificare: RECT-01

Clienti: AutoParts GmbH (Germania), Dacia Mioveni, Continental Timisoara
Furnizori: ArcelorMittal (otel), SKF Romania (rulmenti), Sandvik (scule CNC)

Useri seed:
  admin@metalex.ro / Admin (admin) — scop: tot
  grigore.d@metalex.ro / Grigore Dumitru (director) — scop: ambele fabrici
  ana.p@metalex.ro / Ana Popescu (planner) — scop: ambele fabrici
  mihai.r@metalex.ro / Mihai Radu (shift_leader) — scop: Cluj, Sectia CNC, Tura I
  costin.b@metalex.ro / Costin Barbu (operator) — scop: Cluj, Sectia CNC
  elena.v@metalex.ro / Elena Vasile (operator) — scop: Cluj, Sectia Asamblare
  bogdan.l@metalex.ro / Bogdan Lazarescu (maintenance) — scop: Cluj
  diana.m@metalex.ro / Diana Moldovan (logistics) — scop: Cluj
  radu.s@metalex.ro / Radu Stanescu (shift_leader) — scop: Sibiu, Sectia CNC
  viewer@metalex.ro / Vizitator (viewer) — scop: Cluj

Produse:
  ARBORE-S42: arbore din otel, 4 operatii (debitare → strunjire → frezare → tratament termic)
  FLANSA-F18: flansa, 3 operatii (debitare → strunjire → rectificare)
  MODUL-M22: ansamblu = ARBORE-S42 + FLANSA-F18 + 2× SURUB-M8 → asamblare

Comenzi active:
  CMD-001: 500 buc MODUL-M22 pt AutoParts, deadline 18 aprilie
  CMD-002: 300 buc ARBORE-S42 pt Dacia, deadline 22 aprilie
  CMD-003: 1000 buc FLANSA-F18 pt Continental, deadline 25 aprilie

# ═══════════════════════════════════════
# ORA 05:45 — ADMIN CONFIGUREAZA FABRICA
# ═══════════════════════════════════════

## Rol: Admin (admin@metalex.ro)
## Dispozitiv: Desktop, 1920×1080

### Test A1: Login + prima configurare
- Login → dashboard admin
- VERIFICA: sidebar arata TOATE meniurile (productie, planificare, BOM, stocuri, admin)
- Mergi la Admin → Organizatie → creeaza arborele: Metalex → Cluj (factory) → Sectia CNC (department) → Tura I, II, III

### Test A2: Creeaza masini
- Admin → Masini → Adauga
- Creeaza CNC-01: code "CNC-01", name "CNC Strung Mazak QT-200", type "CNC", org_unit = Sectia CNC, idealCycleTimeSeconds: 45, power_kw: 15
- VERIFICA: masina apare in lista, badge "ACTIVA"
- [TEST] Incearca sa creezi alta masina cu acelasi code "CNC-01" → TREBUIE 409 eroare "Cod duplicat"
- [TEST] Incearca fara code → TREBUIE 400 "Campuri obligatorii"

### Test A3: Creeaza useri cu roluri si scop
- Admin → Utilizatori → Adauga
- Creeaza Costin Barbu: email, parola, rol "Operator", scop: Sectia CNC Cluj, access: "operate"
- VERIFICA: userul apare in lista cu rol + scop afisat
- [TEST] Creeaza user cu email duplicat → TREBUIE eroare

### Test A4: Configureaza tema
- Admin → Setari → Tema
- Upload logo Metalex (imagine PNG)
- Schimba primary_color la albastru (#2563EB)
- VERIFICA: sidebar se schimba instant (preview live)
- Salveaza → refresh pagina → tema persista

### Test A5: Activeaza/dezactiveaza module
- Admin → Module → dezactiveaza "planning"
- VERIFICA: in sidebar DISPARE meniul "Planificare"
- Login ca planner Ana → Planificare nu apare in meniu
- Re-activeaza planning

[PROBLEME GASITE]
- [FIX-A1] Daca adminul creeaza un user dar uita sa-i asigneze scop → userul se logheaza dar nu vede NIMIC (toate query-urile returneaza gol). Solutie: la creare user, OBLIGA selectia a cel putin un scop. Afiseaza warning "Userul nu are acces la nicio locatie".
- [FIX-A2] Cand adminul sterge o unitate organizationala care are masini asociate → ce se intampla cu masinile? Trebuie validare: "Nu poti sterge Sectia CNC — are 4 masini asociate. Muta-le intai."
- [UX-A1] La creare user, ar fi util un buton "Copiaza roluri si scop de la alt user" — cand angajezi un operator nou, ii dai acelasi setup ca operatorul existent.
- [UX-A2] Pagina Admin → Organizatie ar trebui sa arate si CATI useri + masini are fiecare unitate, nu doar arborele gol.

# ═══════════════════════════════════════
# ORA 06:00 — SEFUL DE TURA PREIA TURA
# ═══════════════════════════════════════

## Rol: Sef Tura (mihai.r@metalex.ro)
## Dispozitiv: Tableta 10" (1280×800)

### Test ST1: Login + dashboard tura
- Login pe tableta → sidebar colapsabil (hamburger)
- Dashboard tura se incarca cu date din Tura I, Sectia CNC
- VERIFICA: vede DOAR masini din Sectia CNC (CNC-01 pana la CNC-04)
- VERIFICA: NU vede masini din Sectia Asamblare sau Fabrica Sibiu
- VERIFICA: OEE per masina, opriri active, checklists de completat

### Test ST2: Prezenta tura
- Meniu → Echipa → Prezenta
- VERIFICA: lista operatorilor din Tura I Sectia CNC
- Marcheaza Costin Barbu ca "prezent"
- [TEST] Incearca sa vada operatorii din Tura II → nu ar trebui sa poata (e sef doar pe Tura I)

### Test ST3: Aprobare concediu
- Meniu → Echipa → Concedii
- Costin Barbu a cerut concediu luni-marti saptamana viitoare
- Click "Aproba"
- VERIFICA: apare warning "Costin Barbu e planificat pe CNC-01 luni si marti"
- Aproba cu comentariu "Inlocuit de Andrei"
- VERIFICA: statusul trece la "Aprobat"

### Test ST4: Verifica planul zilei
- Meniu → Productie → Rapoarte tura
- VERIFICA: vede ce ar trebui produs azi per masina per tura (din planning)
- VERIFICA: coloane Planificat / Realizat / Rebuturi — Realizat se actualizeaza cand operatorul raporteaza

[PROBLEME GASITE]
- [FIX-ST1] Dashboard-ul nu arata clar CARE tura e activa acum. Trebuie header mare: "TURA I — 06:00-14:00 — 15 Aprilie 2026" cu font vizibil.
- [FIX-ST2] Daca seful de tura aproba un concediu si operatorul era planificat, NU se trimite automat alerta la planificator. Trebuie: la aprobare concediu care afecteaza planul → notificare automata la rolul planner cu "Operator X nu mai e disponibil in zilele Y, Z".
- [UX-ST1] Seful de tura ar vrea buton rapid "Predare-primire tura": un formular simplu cu note pentru tura urmatoare ("CNC-02 are problema la axul Y, CNC-04 a terminat comanda X"). Tura urmatoare vede notele la login.
- [UX-ST2] Dashboard ar trebui sa arate si CINE lucreaza pe fiecare masina acum (nu doar masina, ci si operatorul alocat).
- [UX-ST3] Buton "Suna operator" — click pe numele operatorului → deschide apel telefonic (tel: link).

# ═══════════════════════════════════════
# ORA 06:15 — OPERATORUL INCEPE LUCRUL
# ═══════════════════════════════════════

## Rol: Operator (costin.b@metalex.ro)
## Dispozitiv: Tableta 8" (800×1280, portrait)

### Test OP1: Login + ecran operator
- Login → ecran operator (OperatorLayout, FARA sidebar)
- VERIFICA: header arata masina selectata + tura curenta
- VERIFICA: 4 butoane mari vizibile fara scroll
- VERIFICA: textele sunt lizibile pe 8" (font minim 16px)

### Test OP2: Selectie masina
- Tap pe dropdown masina in header
- VERIFICA: vede DOAR masini din Sectia CNC (scop)
- Selecteaza CNC-01
- VERIFICA: masina ramane selectata dupa navigare intre ecrane

### Test OP3: Checklist debut serie
- Tap "Checklist"
- VERIFICA: apare checklistul "Debut serie CNC" daca exista comanda noua
- Bifeaza toate punctele: curatenie, nivel ulei, presiune aer, scula OK, prima piesa
- Trimite → confirmare verde
- [TEST] Incearca sa trimiti cu un punct obligatoriu nebicat → TREBUIE eroare

### Test OP4: Raportare productie — flux normal
- Tap "Raporteaza Productie"
- Selecteaza comanda CMD-002 (Arbore S42 pt Dacia)
- Piese bune: tap +10, +10, +10, +5 = 35
- Rebuturi: 2
- Motiv rebut: dropdown → "Uzura scula"
- Trimite → confirmare "35 piese bune, 2 rebuturi — CNC-01"
- [TEST] Trimite cu 0 piese bune → TREBUIE eroare "Minim 1 piesa"

### Test OP5: Raportare productie — flux rapid
- Operatorul produce in loturi. Dupa fiecare lot (la 30 min) raporteaza.
- Raporteaza din nou: 30 piese, 0 rebuturi
- VERIFICA: total pe tura = 65 piese bune, 2 rebuturi

### Test OP6: Declara oprire
- Tap "Oprire masina"
- Selecteaza "Lipsa material"
- VERIFICA: oprirea e inregistrata cu timestamp
- Asteapta 5 minute (simuleaza)
- [TEST] Incearca sa raportezi piese IN TIMP CE oprirea e activa → TREBUIE warning "Masina in oprire. Inchide oprirea inainte de a raporta."

### Test OP7: Inchide oprire
- Bottom bar → Tura mea → vede oprirea activa
- Tap "Inchide oprire" → confirmare, durata calculata automat

### Test OP8: Cerere mentenanta
- Tap "Cerere Mentenanta"
- Selecteaza "Zgomot anormal"
- Adauga descriere: "Zgomot puternic la turatie mare pe axul principal"
- [TEST] Ar fi util sa poata face POZA cu telefonul si sa o ataseze → daca nu exista, e [UX-OP3]
- Trimite → confirmare

### Test OP9: Cerere concediu
- Bottom bar → Concediu
- Cerere noua: 20-21 aprilie, motiv "Personal"
- VERIFICA: status "In asteptare"

### Test OP10: Tura mea
- Bottom bar → Tura mea
- VERIFICA: vede tot ce a raportat azi: piese, opriri, cereri mentenanta
- E un jurnal al turei lui — util si pentru el si pentru seful de tura

[PROBLEME GASITE]
- [FIX-OP1] Cand operatorul selecteaza comanda, dropdown-ul arata TOATE comenzile active pe acea masina. Daca sunt 10 comenzi → dropdown lung. Trebuie: sa arate PRIMA comanda planificata pentru azi (din planning) ca default, restul sub "Alte comenzi".
- [FIX-OP2] Daca oprirea e activa si operatorul inchide aplicatia (tableta adoarme), oprirea ramane deschisa la infinit. Trebuie: la login/resume, daca exista oprire activa → popup "Ai o oprire deschisa de 45 min pe CNC-01. E inca oprita sau ai uitat sa o inchizi?" cu butoane "Inca oprita" / "Inchide acum".
- [FIX-OP3] Dupa raportare, operatorul nu vede cat a produs in total pe comanda azi. Trebuie: dupa confirm, arata mini-rezumat "Azi pe CMD-002: 65/300 piese (21.7%). Ramas: 235 piese."
- [UX-OP1] Buton "Repeta ultimul raport" — daca produce acelasi lucru, sa nu completeze iar tot de la zero. Un tap si trimite aceeasi cantitate.
- [UX-OP2] Timer vizibil pe oprire activa — operatorul sa vada in real-time cat timp e masina oprita (cronometru care ruleaza).
- [UX-OP3] Atasare foto la cerere mentenanta — camera telefonului/tabletei, fa poza, ataseaza.
- [UX-OP4] Sunet/vibratie la confirmare raport — feedback haptic pe tableta cand trimite cu succes.
- [UX-OP5] Mod "hands-free" — operatorul are manusi. Butoanele trebuie sa fie FOARTE mari (minim 64px height pe tableta).

# ═══════════════════════════════════════
# ORA 08:00 — PLANIFICATORUL LUCREAZA
# ═══════════════════════════════════════

## Rol: Planificator (ana.p@metalex.ro)
## Dispozitiv: Desktop 1920×1080, dual monitor

### Test PL1: Dashboard planificare
- Login → Dashboard Planificare
- VERIFICA: vede incarcarea capacitara pe saptamana curenta, pe ambele fabrici (scop: toate)
- VERIFICA: comenzi la risc de intarziere (CMD-001 daca planificarea e stransa)
- VERIFICA: masini supraincarcate (highlight rosu daca load > 100%)

### Test PL2: Editor MBOM
- Meniu → BOM/MBOM → Editor
- Selecteaza MODUL-M22
- VERIFICA: arbore vizual cu: ARBORE-S42 + FLANSA-F18 + SURUB-M8 → Asamblare
- Click pe ARBORE-S42 → vede operatiile: Debitare(10) → Strunjire(20) → Frezare(30) → Tratament(40)
- Modifica timp ciclu pe Strunjire: 45s → 50s
- VERIFICA: MBOM-ul trece de la "Active" la "Draft" (necesita re-aprobare)
- Trimite spre aprobare

### Test PL3: Genereaza plan saptamanal
- Meniu → Planificare → Genereaza plan
- Selecteaza saptamana 16 (14-18 aprilie)
- Configurare prioritati: Deadline 50%, Utilizare masini 30%, Setup 15%, Cost 5%
- Apasa "Genereaza"
- VERIFICA: Gantt apare cu bare pe masini
- VERIFICA: ARBORE-S42 si FLANSA-F18 pentru CMD-001 sunt planificate in paralel
- VERIFICA: Asamblarea MODUL-M22 e planificata DUPA ce ambele piese sunt gata
- VERIFICA: CNC-01 nu e alocat in zilele cand are mentenanta planificata
- VERIFICA: Costin Barbu nu e alocat luni-marti (in concediu aprobat)

### Test PL4: Drag & drop pe Gantt
- Trage comanda de pe CNC-01 pe CNC-02 (miercuri)
- VERIFICA: bara se muta, CNC-02 se recalculeaza
- VERIFICA: daca CNC-02 devine supraincarcata → bara devine rosie + warning text

### Test PL5: Simulare what-if
- Meniu → Planificare → Simulari
- Creeaza: "Ce daca CNC-03 se strica 2 zile?"
- Selecteaza: machines_disabled = CNC-03, perioada = 16-17 aprilie
- Ruleaza simulare
- VERIFICA: comparatie side-by-side cu planul original
- VERIFICA: impact summary arata cate comenzi se intarzie

### Test PL6: CTP
- Meniu → CTP
- Client nou zice: "Vreau 200 buc ARBORE-S42, cat mai repede"
- Selecteaza produs ARBORE-S42, cantitate 200
- Bifa: permite overtime, permite tura extra
- Calculeaza
- VERIFICA: varianta Standard (ex: 10 zile) + varianta Rapida (ex: 7 zile cu overtime)
- VERIFICA: fiecare varianta arata pe ce masini se produce si cand

### Test PL7: Import comenzi
- Meniu → Comenzi → Import
- Upload Excel cu 3 comenzi noi
- VERIFICA: mapping UI apare cu coloanele detectate
- Mapeaza: Part Number → product_reference, Qty → quantity, Due Date → deadline
- VERIFICA: preview cu 3 randuri, toate verzi (valid)
- Confirm import → comenzile apar in lista

[PROBLEME GASITE]
- [FIX-PL1] Gantt-ul pe desktop e greu de citit daca sunt 10+ masini. Trebuie: zoom in/out + scroll orizontal fluid + mini-map (overview mic in colt care arata unde esti).
- [FIX-PL2] Cand planificatorul genereaza planul si nu are MBOM aprobat pentru un produs → eroare criptica. Trebuie mesaj clar: "Produsul MODUL-M22 nu are MBOM aprobat. Aproba MBOM-ul inainte de a genera planul."
- [FIX-PL3] Dupa import comenzi, comenzile noi nu apar automat in planificare. Trebuie: notificare "3 comenzi noi importate. Vrei sa re-generezi planul?"
- [FIX-PL4] CTP nu verifica daca exista stoc de materiale suficient. Poate spune "livrare in 7 zile" dar nu e material. Trebuie: CTP sa arate si "Material OTEL: stoc OK" sau "Material OTEL: necesita reaprovizionare, adauga 3 zile lead time".
- [UX-PL1] Pe Gantt, la hover pe o bara → tooltip cu: produs, cantitate, operator sugerat, setup time, status material. Fara hover, informatia e ascunsa.
- [UX-PL2] Buton "Compara doua saptamani" — planificatorul vrea sa vada saptamana asta vs saptamana trecuta (ce s-a schimbat, ce a ramas in urma).
- [UX-PL3] La generare plan, progres bar vizibil (poate dura cateva secunde pe fabrici mari). Nu doar spinner.
- [UX-PL4] Dupa CTP, buton "Creeaza comanda din aceasta simulare" — sa nu reintroduca manual datele.

# ═══════════════════════════════════════
# ORA 09:00 — DIRECTORUL VERIFICA
# ═══════════════════════════════════════

## Rol: Director (grigore.d@metalex.ro)
## Dispozitiv: Laptop 14", 1920×1080

### Test DIR1: Dashboard executiv
- Login → Dashboard Executiv
- VERIFICA: KPI-uri consolidate pe AMBELE fabrici: OEE mediu, piese produse, comenzi active, alerte
- Click "Fabrica Cluj" → drill-down: KPI-uri doar Cluj
- Click "Sectia CNC" → drill-down: KPI-uri doar CNC
- Click inapoi → revine la consolidat

### Test DIR2: Costuri
- Meniu → Costuri → Per comanda
- Selecteaza CMD-001 (MODUL-M22)
- VERIFICA: cost planificat vs cost real vs estimat final
- VERIFICA: breakdown vizibil (materiale X%, manopera Y%, masini Z%, overhead W%)
- VERIFICA: daca rebuturile sunt mari → "Cauza depasire: rata rebut 4.2% vs target 2%"

### Test DIR3: Profitabilitate
- Meniu → Costuri → Profitabilitate clienti
- VERIFICA: AutoParts GmbH: venituri €X, costuri €Y, marja Z%
- VERIFICA: ordonat dupa marja descrescatoare (cel mai profitabil client sus)

### Test DIR4: Rapoarte export
- Meniu → Rapoarte → P/R/R → Per masina
- Selecteaza saptamana curenta, toate masinile Cluj
- Apasa "Export PDF"
- VERIFICA: se descarca PDF cu tabel Planificat/Realizat/Rebuturi per masina per zi
- VERIFICA: PDF-ul are logo Metalex (din tema configurata), data generarii, nr pagina

### Test DIR5: Alerte
- Meniu → Alerte
- VERIFICA: vede alertele de la toate fabricile
- "Stoc OTEL sub minim" — severity warning
- "CNC-03 zgomot anormal — cerere mentenanta deschisa" — severity critical
- Click pe alerta → navigheaza la detalii

[PROBLEME GASITE]
- [FIX-DIR1] Dashboard-ul executiv nu arata TRENDUL — directorul vrea sa vada "OEE saptamana asta vs saptamana trecuta" dintr-o privire (sagetata sus/jos + procent diferenta). Nu doar valoarea curenta.
- [FIX-DIR2] Profitabilitatea per client nu include costul de mentenanta atribuit comenzii (daca o masina s-a stricat in timpul comenzii clientului). Trebuie: costul mentenantei corective se aloca proportional la comenzile in curs pe masina respectiva.
- [UX-DIR1] Dashboard executiv ar trebui sa aiba un "Morning briefing" — un rezumat text generat automat: "Ieri: 3 comenzi on track, 1 la risc (CMD-001 intarziere 1 zi). OEE mediu 72% (+3% vs saptamana trecuta). 2 alerte noi."
- [UX-DIR2] Graficul de profitabilitate ar trebui sa arate si trendul pe ultimele 3 luni (clientul devine mai profitabil sau mai putin?).
- [UX-DIR3] Buton "Trimite raportul pe email" — directorul primeste PDF-ul pe mail fara sa-l descarce.

# ═══════════════════════════════════════
# ORA 10:00 — MENTENANTA INTERVINE
# ═══════════════════════════════════════

## Rol: Mentenanta (bogdan.l@metalex.ro)
## Dispozitiv: Telefon mobil (375×812, iPhone-size)

### Test MN1: Login pe mobil
- Login → bottom navigation cu 4-5 iconite
- VERIFICA: ecranul e utilizabil pe 375px width
- Dashboard mentenanta: cereri noi (badge rosu), in lucru, planificate

### Test MN2: Preia cerere
- Tab "Interventii" → vede cererea de la Costin (CNC-01, zgomot anormal)
- VERIFICA: vede descrierea + masina + cine a raportat + timestamp
- [TEST] Vede poza atasata? (daca feature-ul exista)
- Tap "Preia" → status "In lucru", assigned_to = Bogdan

### Test MN3: Consulta istoric masina
- Tap pe CNC-01 → profil masina
- VERIFICA: vede istoricul mentenanta (interventii anterioare), ore functionare, ultima revizie

### Test MN4: Consuma piese de schimb
- In timpul interventiei, inlocuieste un rulment
- Meniu → Piese de schimb → cauta "Rulment SKF"
- VERIFICA: stoc curent = 3 buc
- Marcheaza "Folosit 1 buc" → stocul scade la 2
- [TEST] Daca stocul ajunge la minim → alerta automata la Logistica

### Test MN5: Rezolva cerere
- Revine la cerere → "Rezolva"
- Completeaza: "Inlocuit rulment axial SKF 6205. Cauza: uzura normala."
- VERIFICA: status "Finalizat", durata interventie calculata automat
- VERIFICA: masina CNC-01 devine disponibila in planificator

### Test MN6: Verifica mentenanta planificata
- Tab "Planificate" → calendar
- VERIFICA: vede interventiile planificate pe masini (din maintenance.planned_interventions)
- CNC-02 are revizie planificata pe 20 aprilie cu firma externa ServoTech
- VERIFICA: status "Confirmata", cost estimat €800, contact: Mihai Ionescu de la ServoTech

### Test MN7: Scule si matrite
- Tab "Scule" → lista scule pe masini
- VERIFICA: matrita X are 47.000 cicluri din 50.000 → highlight galben "Aproape de limita"
- Tap pe matrita → istoricul complet: mentenante anterioare, pe ce masini a fost

[PROBLEME GASITE]
- [FIX-MN1] Pe mobil (375px), formularul de rezolvare cerere are campuri prea mici. Textarea pentru descriere rezolutie trebuie sa fie min 3 randuri vizibile, font 16px.
- [FIX-MN2] Dupa ce rezolva cererea, nu primeste confirmare vizuala clara. Trebuie: ecran verde full "Interventie finalizata — CNC-01 disponibila" cu buton "Inapoi la lista".
- [FIX-MN3] Cand consuma piesa de schimb din interventie, nu se leaga automat la cererea de mentenanta. Trebuie: consumul sa fie logat PE cerere (parts_used), nu doar ca miscare generica de stoc.
- [UX-MN1] Buton "Scanare QR" pe scula/piesa de schimb — in loc sa caute manual in lista, scaneaza codul de pe eticheta.
- [UX-MN2] La cerere cu prioritate "Critical" → telefonul sa vibreze si sa sune (push notification cu sunet diferit).
- [UX-MN3] Timer vizibil pe cererea "In lucru" — cat timp dureaza interventia in timp real.
- [UX-MN4] Posibilitate de a face foto inainte si dupa interventie — atasate la cerere.

# ═══════════════════════════════════════
# ORA 11:00 — LOGISTICA GESTIONEAZA STOCURI
# ═══════════════════════════════════════

## Rol: Logistica (diana.m@metalex.ro)
## Dispozitiv: Desktop 1920×1080

### Test LG1: Dashboard stocuri
- Login → Dashboard Stocuri
- VERIFICA: alerte sub minim (badge rosu cu numar), valoare totala stoc, miscari azi

### Test LG2: Receptie material
- Meniu → Stocuri → Receptii → NIR Nou
- Furnizor: ArcelorMittal (SearchableSelect cu cautare)
- Contact: Ion Popescu (filtrat pe contactele ArcelorMittal, tag supplier_contact)
- Adauga linii: OTEL-S235 500kg × €1.20/kg, OTEL-42CrMo4 200kg × €2.80/kg
- Salveaza (draft) → Confirma → stocul se actualizeaza automat
- VERIFICA: inventory.stock_levels crescut, movement creat, purchase_history creat

### Test LG3: Necesar materiale
- Meniu → Necesar Materiale → Calcul
- Selecteaza comenzile active (CMD-001, CMD-002, CMD-003)
- Apasa "Calculeaza"
- VERIFICA: lista materiale necesare cu: necesar total, stoc disponibil, deficit
- VERIFICA: "OTEL-S235: necesar 800kg, stoc 500kg, DEFICIT 300kg — comanda la ArcelorMittal, lead time 5 zile"
- [TEST] Buton "Genereaza comanda aprovizionare" → pre-completeaza comanda cu furnizorul primar si cantitatea lipsa

### Test LG4: Trend pret
- Meniu → Furnizori → Selecteaza ArcelorMittal
- Click pe OTEL-S235 → "Trend pret"
- VERIFICA: grafic cu pretul per achizitie in timp (ultimele 6 luni)
- Daca pretul a crescut >10% → warning vizibil

### Test LG5: Import receptie din PDF
- Meniu → Import → Import receptie
- Upload PDF scanat (aviz de la furnizor)
- VERIFICA: OCR extrage datele → mapping UI → preview → confirm
- Stocul se actualizeaza

[PROBLEME GASITE]
- [FIX-LG1] La calcul necesar materiale, nu tine cont de materialele DEJA COMANDATE la furnizor (in tranzit). Trebuie: stoc disponibil = stoc curent + in tranzit — necesar = deficit real.
- [FIX-LG2] Daca furnizorul primar nu are stoc (lead time mare), ar trebui sa sugereze automat furnizorul alternativ cu lead time mai mic.
- [FIX-LG3] La confirmare NIR, daca un articol nu exista in inventory → eroare. Trebuie: optiune de creare articol inline (Tema 1 — SearchableSelect).
- [UX-LG1] Meniu → Stocuri ar trebui sa aiba view "Per locatie" — in ce magazie fizica e stocul (depozit A, depozit B, langa masini).
- [UX-LG2] Buton "Inventar fizic" — logistica face inventarul periodic, introduce cantitatile reale → aplicatia calculeaza diferentele → genereaza ajustari automat.
- [UX-LG3] Dashboard ar trebui sa arate "Materiale care se termina in X zile la ritmul curent de consum" — nu doar alerte statice sub minim, ci predictie dinamica.

# ═══════════════════════════════════════
# ORA 14:00 — SCHIMB DE TURA
# ═══════════════════════════════════════

### Test TURA1: Predare-primire tura
- Sef Tura I (Mihai) completeaza note predare:
  "CNC-02: problema vibratii la turatie mare, monitorizati. CNC-04: comanda CMD-002 in avans cu 20 piese. Oprire 45 min pe CNC-01 pt lipsa material, rezolvata."
- Sef Tura II se logheaza → vede notele de predare → confirma preluare

[PROBLEME GASITE]
- [FIX-TURA1] Nu exista modul de predare-primire tura. TREBUIE CREAT. Un formular simplu cu: note text, status masini la sfarsit de tura, probleme in curs, semnatura digitala.
- [UX-TURA1] Raport automat generat la sfarsit de tura: "Tura I, 15 aprilie: 245 piese produse, 8 rebuturi (3.2%), 45 min downtime, OEE mediu 74%". Se genereaza automat din datele raportate.

# ═══════════════════════════════════════
# ORA 16:00 — VIEWER CONSULTA
# ═══════════════════════════════════════

## Rol: Viewer (viewer@metalex.ro)
## Dispozitiv: Laptop

### Test VW1: Acces read-only
- Login → dashboard general
- VERIFICA: vede datele, dar ZERO butoane de editare/creare/stergere
- Incearca URL direct: /machines/create → redirect sau 403
- VERIFICA: nu poate exporta? (decide: viewer poate exporta PDF read-only sau nu)

[PROBLEME GASITE]
- [FIX-VW1] Viewer-ul nu stie ce date poate vedea si ce nu. Trebuie: in loc de butoane ascunse, arata butoanele dar disabled (gri) cu tooltip "Nu ai permisiunea de a edita".

# ═══════════════════════════════════════
# SFARSIT DE ZI — SUMAR PROBLEME
# ═══════════════════════════════════════

## TOTAL: 14 [FIX] + 19 [UX]

### FIXURI CRITICE (trebuie rezolvate inainte de deploy):
FIX-A1:  User fara scop → obligatoriu la creare
FIX-A2:  Stergere unitate org cu date → validare
FIX-OP1: Comanda default din planning pe dropdown operator
FIX-OP2: Oprire ramasa deschisa la resume app → popup
FIX-OP3: Mini-rezumat dupa raportare (total azi pe comanda)
FIX-ST1: Header tura vizibil clar
FIX-ST2: Aprobare concediu → notifica planificator automat
FIX-PL1: Gantt zoom/scroll pe fabrici mari
FIX-PL2: Mesaj clar cand MBOM nu e aprobat
FIX-PL3: Comenzi noi importate → sugestie re-planificare
FIX-PL4: CTP verifica stoc materiale + lead time
FIX-MN3: Consum piese legat de cerere mentenanta
FIX-LG1: Necesar materiale tine cont de comenzi in tranzit
FIX-TURA1: Modul predare-primire tura

### UX IMPORTANTE (fac produsul mult mai bun):
UX-OP1:  "Repeta ultimul raport" — un tap
UX-OP2:  Timer vizibil pe oprire activa
UX-OP3:  Atasare foto la cerere mentenanta
UX-OP5:  Butoane extra-mari pe tableta (64px+)
UX-ST1:  Formular predare-primire tura
UX-ST2:  Dashboard arata operator alocat per masina
UX-PL1:  Tooltip pe Gantt cu detalii operatie
UX-PL4:  CTP → "Creeaza comanda" direct din simulare
UX-DIR1: "Morning briefing" text generat automat
UX-DIR3: "Trimite raport pe email" buton
UX-MN1:  Scanare QR pe scule
UX-MN2:  Push notification diferentiat pe prioritate
UX-MN4:  Foto inainte/dupa interventie
UX-LG2:  Inventar fizic + calcul diferente automat
UX-LG3:  Predictie "stoc se termina in X zile"
UX-VW1:  Butoane disabled cu tooltip in loc de ascunse

### UX NICE-TO-HAVE (dupa primii clienti):
UX-A1:   "Copiaza roluri de la alt user"
UX-A2:   Numar useri/masini pe fiecare unitate org
UX-ST3:  "Suna operator" link telefon
UX-OP4:  Vibratie/sunet la confirmare
UX-PL2:  Compara doua saptamani
UX-PL3:  Progress bar la generare plan
UX-DIR2: Trend profitabilitate 3 luni
UX-LG1:  View stocuri per locatie fizica
UX-MN3:  Timer pe cerere in lucru
