# ShopFloor.ro — START AICI
# Ghid definitiv: De la zero la prima endpoint functionala

Citeste TOT inainte sa faci ceva. Apoi executa pas cu pas.

---

## PARTEA 1: INSTALEAZA (o singura data, ~15 minute)

### 1.1 Docker Desktop

WINDOWS:
  1. Deschide browser: https://www.docker.com/products/docker-desktop
  2. Click "Download for Windows"
  3. Ruleaza installerul. Next → Next → Finish
  4. Daca cere restart → restart
  5. Deschide Docker Desktop din Start Menu
  6. Asteapta pana apare "Engine running" (iconita verde jos)

MAC:
  1. https://www.docker.com/products/docker-desktop
  2. Download for Mac
  3. Trage in Applications, deschide
  4. Asteapta "Engine running"

VERIFICARE — deschide PowerShell (Windows) sau Terminal (Mac):
  docker --version
  → Trebuie sa vezi: Docker version 27.x.x (sau mai nou)
  Daca nu vezi → Docker Desktop nu e pornit. Deschide-l.


### 1.2 Node.js

  1. Deschide browser: https://nodejs.org
  2. Click butonul mare verde "LTS" (nu "Current")
  3. Instaleaza. Next → Next → Finish
  4. INCHIDE si REDESCHIDE terminalul (PowerShell/Terminal)

VERIFICARE:
  node --version
  → Trebuie sa vezi: v20.x.x sau v22.x.x
  npm --version
  → Trebuie sa vezi: 10.x.x sau mai nou


### 1.3 Git

WINDOWS:
  1. https://git-scm.com/download/win
  2. Instaleaza cu setarile default

MAC:
  Git vine preinstalat. Daca nu: xcode-select --install

VERIFICARE:
  git --version
  → Trebuie sa vezi: git version 2.x.x


### 1.4 Claude Code

WINDOWS (PowerShell):
  irm https://claude.ai/install.ps1 | iex

MAC/LINUX (Terminal):
  curl -fsSL https://claude.ai/install.sh | bash

Daca nu merge, varianta alternativa:
  npm install -g @anthropic-ai/claude-code

VERIFICARE (inchide si redeschide terminalul intai):
  claude --version
  → Trebuie sa vezi un numar de versiune


### 1.5 Un editor de text

Instaleaza Visual Studio Code: https://code.visualstudio.com
Il vei folosi sa vezi fisierele pe care Claude Code le creeaza.
NU trebuie sa scrii cod in el — doar sa te uiti.

---

## PARTEA 2: CREEAZA PROIECTUL (5 minute)

### 2.1 Creeaza folderul

WINDOWS (PowerShell):
  mkdir C:\Projects\shopfloor
  cd C:\Projects\shopfloor

MAC/LINUX (Terminal):
  mkdir -p ~/Projects/shopfloor
  cd ~/Projects/shopfloor


### 2.2 Initializeaza Git

  git init
  git branch -m main


### 2.3 Creeaza fisierul CLAUDE.md

Acesta e CEL MAI IMPORTANT fisier din proiect.
Claude Code il citeste la fiecare sesiune si se comporta conform lui.

Copiaza fisierul CLAUDE_MD_PRODUCTION.md pe care ti l-am dat,
renumeste-l in CLAUDE.md si pune-l in folderul shopfloor/.

SAU deschide un fisier nou CLAUDE.md si lipeste continutul
din CLAUDE_MD_PRODUCTION.md (descarcat din conversatia noastra).


### 2.4 Creeaza fisierul .gitignore

Creeaza un fisier numit .gitignore (cu punct in fata) cu acest continut:

  node_modules/
  .env
  dist/
  build/
  *.log
  .DS_Store


### 2.5 Verifica structura

  ls -la
  → Trebuie sa vezi:
     CLAUDE.md
     .gitignore
     .git/ (folder ascuns)

Nimic altceva. Claude Code construieste restul.

---

## PARTEA 3: PRIMA SESIUNE CLAUDE CODE (30-45 minute)

### 3.1 Porneste Claude Code

  claude

Prima oara:
  - Se deschide browserul automat
  - Te loghezi cu contul Claude (Pro sau Max)
  - Accepti permisiunile
  - Revii in terminal
  - Vezi promptul Claude Code (>)


### 3.2 PROMPT 1 — Setup proiect

Copiaza si lipeste EXACT acest text:

---INCEPUT PROMPT---
Citeste CLAUDE.md. Acesta e proiectul ShopFloor.ro.

Fa urmatoarele:

1. Creeaza package.json cu:
   - name: shopfloor
   - type: module
   - scripts: start, dev (cu --watch), test (vitest), migrate, seed
   - Dependencies: express, knex, pg, bcrypt, jsonwebtoken, joi, 
     helmet, cors, winston, express-rate-limit, dotenv, pdfkit, 
     exceljs, resend
   - DevDependencies: vitest, supertest, nodemon

2. Creeaza .env.example cu variabilele din CLAUDE.md

3. Creeaza docker-compose.yml cu PostgreSQL 16:
   - DB: shopfloor, user: shopfloor, password din .env
   - Port 5432
   - Volume persistent pgdata
   - Healthcheck

4. Creeaza knexfile.js care citeste din .env

5. Creeaza structura de foldere EXACT ca in CLAUDE.md:
   src/server.js, src/config/, src/middleware/, src/modules/, 
   src/services/, src/utils/

6. In src/server.js creeaza Express app cu:
   - helmet, cors, express.json, rate limiter
   - Route /health care returneaza {status: 'ok'}
   - Error handler middleware
   - Winston logger (console + file)
   - Porneste pe PORT din .env (default 3001)

7. Creeaza .env din .env.example cu valori de development

8. Ruleaza: npm install

9. Porneste PostgreSQL: docker compose up -d postgres

10. Verifica: npm run dev — serverul trebuie sa porneasca
    si GET http://localhost:3001/health sa returneze {status: 'ok'}
---SFARSIT PROMPT---

IMPORTANT: Claude Code iti cere confirmare la fiecare comanda.
Citeste ce vrea sa faca si apasa "y" (yes) daca e corect.
Daca vezi ceva ciudat, apasa "n" si intreaba-l ce face.


### 3.3 VERIFICARE CHECKPOINT 1

Dupa ce Claude Code termina, verifica:
  - Ruleaza: npm run dev
  - Deschide alt terminal: curl http://localhost:3001/health
  - Trebuie sa vezi: {"status":"ok"}

DACA MERGE → Commit:
  git add .
  git commit -m "Setup initial: Express + PostgreSQL + structura proiect"

DACA NU MERGE → Spune-i lui Claude Code:
  "Nu merge. Uite eroarea: [lipeste eroarea aici]"
  El va repara.


### 3.4 PROMPT 2 — Middleware-uri

---INCEPUT PROMPT---
Creeaza middleware-urile conform CLAUDE.md:

1. src/middleware/errorHandler.js
   - Prinde toate erorile necaptate
   - Logheaza cu Winston (level error, stack trace, timestamp)
   - Returneaza JSON: {statusCode, error: 'EROARE_CODIFICATA', message: 'Text in romana'}
   - In productie NU trimite stack trace la client

2. src/middleware/auth.js
   - Extrage token din header Authorization: Bearer <token>
   - Verifica cu jsonwebtoken
   - Pune req.user = {userId, email, role, fullName}
   - Functie authorize(roles[]) care verifica daca req.user.role e in lista
   - 401 daca nu e token, 403 daca nu are rolul necesar

3. src/middleware/validate.js
   - Functie validate(schema) care primeste un Joi schema
   - Valideaza req.body si returneaza 400 cu detalii daca e invalid
   - Mesajele de eroare sa fie in romana

4. src/middleware/rateLimiter.js
   - Rate limit global: 100 req/min per IP
   - Rate limit auth: 5 req/min per IP pe rute /auth/login
   - Mesaj de eroare in romana

5. src/middleware/audit.js
   - Logheaza orice POST/PUT/DELETE intr-un tabel audit.audit_log
   - Coloane: id (uuid), user_id, action (POST/PUT/DELETE), 
     resource (ex: /api/v1/machines), resource_id, ip_address,
     details (jsonb cu body-ul cererii), created_at
   - Creeaza o migratie Knex pentru tabelul audit_log

6. Scrie teste unitare cu Vitest pentru:
   - auth middleware (token valid, token invalid, token lipsa, rol gresit)
   - validate middleware (body valid, body invalid)
   - errorHandler (eroare cu statusCode, eroare fara statusCode)

Ruleaza npm test si confirma ca toate testele trec.
---SFARSIT PROMPT---


### 3.5 VERIFICARE CHECKPOINT 2

  npm test
  → Toate testele trec (verde)

DACA DA → Commit:
  git add .
  git commit -m "Middleware-uri: auth, validation, error handling, audit, rate limit"


### 3.6 PROMPT 3 — Migrari baza de date

---INCEPUT PROMPT---
Creeaza Knex migrations. Citeste CLAUDE.md pentru schema completa.
Fa-le pe rand, in ordine:

npx knex migrate:make 001_create_audit_log
npx knex migrate:make 002_create_auth_tables
npx knex migrate:make 003_create_machines_tables
npx knex migrate:make 004_create_production_tables
npx knex migrate:make 005_create_checklists_tables
npx knex migrate:make 006_create_maintenance_tables

Implementeaza fiecare migratie cu createTable si dropTable.
Include TOATE coloanele din CLAUDE.md, cu tipuri corecte,
constraints, indexes, foreign keys.

Include si tabelele lookup:
- production.stop_categories (cu seed-urile in romana)
- production.scrap_reasons (cu seed-urile in romana)

Ruleaza: npx knex migrate:latest
Verifica ca toate tabelele exista cu:
  docker compose exec postgres psql -U shopfloor -d shopfloor -c "\dt *.*"
---SFARSIT PROMPT---


### 3.7 VERIFICARE CHECKPOINT 3

Ruleaza:
  npx knex migrate:status
  → Toate migrarile arata ca executate

Commit:
  git add .
  git commit -m "Migrari DB: auth, machines, production, checklists, maintenance, audit"


---

## PARTEA 4: SESIUNEA 2 — AUTH MODULE (30-45 min)

### 4.1 Deschide Claude Code
  cd C:\Projects\shopfloor   (sau ~/Projects/shopfloor)
  claude


### 4.2 PROMPT 4 — Modulul Auth complet

---INCEPUT PROMPT---
Citeste CLAUDE.md. Implementeaza modulul auth complet.

Structura:
  src/modules/auth/auth.routes.js
  src/modules/auth/auth.controller.js
  src/modules/auth/auth.service.js
  src/modules/auth/auth.validation.js
  src/modules/auth/auth.test.js

Endpoints:
POST /api/v1/auth/login
  - Validare: email (required, valid email), password (required, min 8 chars)
  - Cauta user dupa email, verifica parola cu bcrypt
  - Returneaza JWT cu userId, email, role, fullName
  - Rate limited: max 5 incercari/minut

POST /api/v1/auth/register (doar admin)
  - Validare: email, password (min 8, o majuscula, o cifra), 
    fullName, role (enum), badgeNumber (optional), phone (optional)
  - Hashuieste parola cu bcrypt (10 rounds)
  - Returneaza userul creat (fara password_hash)

GET /api/v1/auth/me (autentificat)
  - Returneaza profilul userului curent

GET /api/v1/auth/users (admin + production_manager)
  - Lista useri cu paginare (page, limit)
  - Filtrare: role, isActive
  - Cautare: search in fullName si email

PUT /api/v1/auth/users/:id (admin)
  - Update: fullName, role, badgeNumber, phone, isActive
  - NU permite schimbarea emailului sau parolei prin acest endpoint

PUT /api/v1/auth/change-password (autentificat)
  - Validare: currentPassword, newPassword (min 8, o majuscula, o cifra)
  - Verifica parola curenta inainte de schimbare

Inregistreaza rutele in server.js.

Creeaza un seed:
  npx knex seed:make 001_admin_user
  Email: admin@shopfloor.local
  Parola: ShopFloor2026!
  Rol: admin
  Ruleaza: npx knex seed:run

Scrie teste:
  - Login corect → 200 + token
  - Login parola gresita → 401
  - Login email inexistent → 401
  - Register fara autentificare → 401
  - Register ca operator (non-admin) → 403
  - Register cu date valide (ca admin) → 201
  - Register email duplicat → 409
  - Me fara token → 401
  - Me cu token valid → 200

Ruleaza: npm test — TOATE testele trec.
Testeaza manual:
  curl -X POST http://localhost:3001/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@shopfloor.local","password":"ShopFloor2026!"}'
---SFARSIT PROMPT---


### 4.3 VERIFICARE CHECKPOINT 4

  npm test → verde
  curl login → primesti token
  Copiaza tokenul, testeaza /me:
    curl http://localhost:3001/api/v1/auth/me \
      -H "Authorization: Bearer TOKENUL_TAU"

MERGE → Commit:
  git add .
  git commit -m "Modul auth complet: login, register, me, users, change-password + teste"


---

## CE URMEAZA

Continui cu aceeasi metoda:
  PROMPT → VERIFICARE → COMMIT

Ordinea modulelor (dupa auth):
  Sesiunea 3: Machines (CRUD + teste)
  Sesiunea 4: Production — Orders + Reports
  Sesiunea 5: Production — Stops + OEE Calculator  
  Sesiunea 6: Production — Dashboard + Shifts
  Sesiunea 7: Maintenance (cereri + assignment)
  Sesiunea 8: Checklists (templates + completare)
  Sesiunea 9: Frontend — Login + Layout + Routing
  Sesiunea 10: Frontend — Dashboard OEE
  Sesiunea 11: Frontend — Operator View
  Sesiunea 12: Frontend — Admin (Machines, Users, Orders)
  Sesiunea 13: Frontend — Maintenance View
  Sesiunea 14: Import Excel
  Sesiunea 15: Export PDF
  Sesiunea 16: Notificari Email
  Sesiunea 17: PWA + Offline
  Sesiunea 18: Deploy pe Hetzner

Fiecare sesiune = 30-60 minute = 1-3 prompturi.
Total: ~18 sesiuni × 45 min = ~13.5 ore de lucru efectiv.
Ritm de 1 sesiune/zi = produs functional in 3-4 saptamani.

---

## REGULI DE AUR

1. NICIODATA nu continua daca testele nu trec.
   Spune-i lui Claude Code eroarea, el repara.

2. COMMIT dupa fiecare checkpoint reusit.
   Daca strici ceva: git checkout . (revine la ultimul commit)

3. O SESIUNE = un modul. Nu amesteca.

4. Daca Claude Code face ceva ce nu intelegi,
   intreaba-l: "Explica-mi ce ai facut si de ce."

5. Daca te blochezi complet, revino in aceasta conversatie
   pe claude.ai si intreaba-ma.
