# UROP Search Engine

A full-stack search and discovery platform for **MIT Undergraduate Research Opportunities (UROP)**, scraping live listings from [ELx](https://elx.mit.edu) and ranking them against a student's resume. Deployed in production at **[miturop.org](https://miturop.org)**.

---

## Overview

- **Search & filter** hundreds of MIT research opportunities by department, lab, pay/credit type, and opportunity theme.
- **Personalized recommendations** powered by a resume-to-listing matching engine (TF-IDF + LSA).
- **Curated labs directory** of MIT research groups, browsable alongside live listings.
- **Google OAuth** login gated to `@mit.edu` accounts, with profile + PDF resume upload.
- **Automated daily ingestion** from MIT's ELx API via a cron-driven scraper.

---

## Key metrics

| Metric | Value |
|--------|-------|
| Institutions / data sources | **1** (MIT ELx — `api.mit.edu/elo-v2`) |
| Opportunities in sample scrape | **~230** listings |
| Seed listings (dev) | **50** |
| Curated lab records | **73** |
| Resume-matching benchmark set | **100** projects |
| Total application code | **~8,100 LOC** (TS/JS/Python) |
| Frontend | **~2,980 LOC** |
| Backend | **~3,530 LOC** |
| Matching / Relevance engine | **~716 LOC** |
| Python scraper | **~740 LOC** |
| Infrastructure (CDK) | **~146 LOC** |
| TF-IDF max features | **10,000** |
| LSA components | up to **70** |
| Production task size | **0.25 vCPU / 512 MiB** (ECS Fargate) |
| Scrape cadence | daily at **6:00 AM** + on-demand |
| Listing freshness window | listings older than **3 months** auto-deactivated |

---

## Tech stack

### Frontend
- **React 19** + **TypeScript 5.9**
- **Vite 7** build tooling (with React Compiler via Babel plugin)
- **React Router 7** for routing
- **TanStack React Query 5** for data fetching/caching
- **Tailwind CSS 4** for styling
- **lucide-react** for icons

### Backend
- **Node.js 20+** with **Express 5** (ES modules)
- **MongoDB 6** driver (MongoDB Atlas or local)
- **Passport** + **passport-google-oauth20** for Google OAuth 2.0
- **express-session** + **connect-mongo** (sessions persisted in MongoDB)
- **node-cron** for scheduled scraping
- **multer** + **pdf-parse** for resume upload & parsing

### Scraping & matching (Python 3)
- **Playwright** + **pandas** — standalone ELx scraper
- **scikit-learn** — TF-IDF, TruncatedSVD (LSA), cosine similarity
- **pdfplumber** — resume text extraction
- **pymongo** — reads live listings for ranking
- *(Experimental: `sentence-transformers` `all-MiniLM-L6-v2`, not wired into production)*

### Infrastructure
- **Docker** multi-stage build (frontend bundle + backend + Python matcher)
- **AWS CDK** (TypeScript) → **ECS Fargate** + **Application Load Balancer** + **HTTPS** + **Route 53**
- **AWS Secrets Manager** for credentials
- **CloudWatch** logs (1-week retention)
- Domain: **miturop.org** (`us-east-1`)

---

## Architecture

```
urop-search-engine/
├── src/                    # React SPA (Vite + TypeScript)
│   ├── pages/              # Home, Listings, Listing detail, Labs, Lab detail, Admin, Profile
│   ├── components/         # SearchBar, cards, filters, pagination
│   └── lib/                # API client (api.ts), auth context (auth.tsx)
├── backend/src/            # Express API + cron scraper
│   ├── index.js            # Entry point, cron setup, static serving in prod
│   ├── db.js               # MongoDB connection (pool 2–10)
│   ├── routes/             # listings, labs, admin, auth, profile
│   ├── services/           # elx-scraper.js + map-elx-listing.js
│   ├── seed.js             # 50 sample listings
│   └── seed-labs.js        # 73 sample labs
├── elx_scraper/            # Standalone Playwright/Python scraper → urops_raw.json
├── Relevance/              # Resume↔listing ranking (TF-IDF + LSA), metrics
├── infra/                  # AWS CDK (ECS Fargate stack)
└── Dockerfile              # Production image
```

### Data flow

1. **Ingestion (live):** Admin saves an MIT Cognito JWT → `elx-scraper.js` calls the ELx API (`/lookups` + `/opportunity`) → maps fields → upserts into MongoDB by `elx_id`.
2. **Ingestion (offline):** `elx_scraper/scripts/scrape_api.py` → `data/urops_raw.json` → `npm run import-elx`.
3. **Serving:** Frontend queries `/api/listings` and `/api/labs`; MongoDB regex + text-index search (no separate search service).
4. **Personalization:** Profiled users get keyword-scored recommendations; resume ranking spawns the Python TF-IDF + LSA pipeline against active listings.
5. **Production:** A single container serves both the Express API and the static React build.

---

## Prerequisites

- **Node.js** v20+
- **MongoDB Atlas** cluster (or local MongoDB)
- **MIT Kerberos** credentials (to obtain an ELx scraping token)
- **Python 3** (only required for resume ranking / standalone scraper)

---

## Setup

### 1. Install dependencies

```bash
# Frontend (from project root)
npm install

# Backend
cd backend
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root (read by the backend as `../.env`):

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `ADMIN_SECRET` | Yes | `x-admin-key` for admin routes |
| `GOOGLE_CLIENT_ID` | For auth | Google OAuth 2.0 |
| `GOOGLE_CLIENT_SECRET` | For auth | Google OAuth 2.0 |
| `SESSION_SECRET` | Prod | Session cookie signing |
| `PORT` | No (3001) | API port |
| `APP_URL` | No | Frontend URL (CORS + OAuth redirects) |
| `BACKEND_URL` | No | OAuth callback base |
| `MONGODB_DB_NAME` | No | DB name (default `urop_search_engine`) |
| `PYTHON_PATH` | No | Python executable for the resume ranker |
| `NODE_ENV` | Prod | `production` serves `dist/` + secure cookies |

Minimal dev `.env`:

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=<app>
ADMIN_SECRET=<pick-any-secret-string>
```

### 3. Whitelist your IP in MongoDB Atlas

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Select your cluster → **Network Access**
3. **Add IP Address** → your current IP, or `0.0.0.0/0` for dev
4. Wait ~1 minute to propagate

> If skipped, the backend crashes with `ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR`.

---

## Running

Start **two terminals**:

```bash
# Terminal 1 — Backend (Express API on port 3001)
cd backend
npm run dev

# Terminal 2 — Frontend (Vite dev server on port 5173)
npm run dev
```

The frontend proxies `/api` and `/auth` requests to `http://localhost:3001`.

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **Admin panel:** http://localhost:5173/admin

---

## Populating listings from ELx

UROP listings are scraped from MIT's ELx API, which requires a Cognito access token obtained via MIT Touchstone login. Tokens expire after ~24 hours.

### Step 1: Get your ELx token

1. Go to [elx.mit.edu](https://elx.mit.edu) and log in with your MIT credentials
2. Open DevTools (Cmd+Option+I) → **Console**
3. Run:

```javascript
localStorage.getItem(Object.keys(localStorage).find(k => k.includes('accessToken')))
```

4. Copy the output (the long `eyJ...` string, without quotes)

### Step 2: Submit the token via the admin panel

1. Go to http://localhost:5173/admin
2. Enter your `ADMIN_SECRET` and click **Continue**
3. Paste the token and click **Save**
4. Click **Refresh Now** to scrape ELx and populate the database

You should see a result like "Done: 45 new, 0 updated, 45 total listings".

### Alternative: Bookmarklet

The admin panel includes a draggable bookmarklet ("Copy ELx Token"). After logging into ELx, click it to copy the token.

### Automatic refresh

A daily cron job at **6:00 AM** automatically scrapes ELx as long as a valid (non-expired) token is stored. You only need to paste a fresh token every ~24 hours.

---

## Available scripts

| Location | Command | Description |
|----------|---------|-------------|
| Root | `npm run dev` | Start Vite frontend dev server |
| Root | `npm run build` | Type-check + production build |
| Root | `npm run preview` | Preview the production build |
| `backend/` | `npm run dev` | Start backend with file watching |
| `backend/` | `npm run start` | Start backend (production) |
| `backend/` | `npm run seed` | Seed 50 sample listings |
| `backend/` | `npm run seed-labs` | Seed 73 sample labs |
| `backend/` | `npm run import-elx` | Import from `elx_scraper/data/urops_raw.json` (supports `--dry-run`, `--clear`) |

### Standalone Python scraper (optional)

```bash
cd elx_scraper
pip install -r requirements.txt && playwright install
python scripts/login_once.py
python scripts/scrape_api.py
```

---

## API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/listings` | Public | Search / filter / paginate listings |
| GET | `/api/listings/recommended` | Session | Personalized recommendations |
| GET | `/api/listings/departments` | Public | List all departments |
| GET | `/api/listings/labs` | Public | Distinct lab names on listings |
| GET | `/api/listings/:id` | Public | Get a single listing |
| GET | `/api/labs` | Public | Browse the labs directory |
| GET | `/api/labs/recommended` | Session | Recommended labs |
| GET | `/api/labs/filters` | Public | Lab filter options |
| GET | `/api/labs/:id` | Public | Get a single lab |
| GET | `/api/health` | Public | Health check |
| GET / PUT | `/api/profile` | Session | Read / update profile |
| POST / GET | `/api/profile/resume` | Session | Upload / fetch resume (PDF, ≤10 MB) |
| POST | `/api/profile/resume/rank` | Session | Rank listings against resume (TF-IDF + LSA) |
| GET | `/auth/google`, `/auth/google/callback` | OAuth | Google login (`@mit.edu` only) |
| GET | `/auth/me` | Session | Current user |
| POST | `/auth/logout` | Session | Log out |
| POST | `/api/admin/elx-token` | `x-admin-key` | Save a Cognito token |
| POST | `/api/admin/refresh-listings` | `x-admin-key` | Trigger an ELx scrape |
| GET | `/api/admin/scrape-status` | `x-admin-key` | Token status + listing count |
| POST / PUT / DELETE | `/api/admin/labs[/:id]` | `x-admin-key` | Lab CRUD |

---

## Deployment

Production runs on **AWS ECS Fargate** behind an Application Load Balancer, provisioned with **AWS CDK**.

| Aspect | Details |
|--------|---------|
| Compute | ECS Fargate (`ApplicationLoadBalancedFargateService`) |
| Domain | `https://miturop.org` (HTTPS, HTTP→HTTPS redirect, ACM cert) |
| Container | Built from `Dockerfile`, listens on port **3001** |
| Networking | VPC across 2 AZs, public subnets only, 0 NAT gateways (cost-optimized) |
| Task size | 0.25 vCPU / 512 MiB |
| Health check | `GET /api/health` |
| Secrets | AWS Secrets Manager (`urop-search-engine/app`) |
| Logs | CloudWatch, 1-week retention |
| Region | `us-east-1` |

Every push to `main` runs `.github/workflows/deploy.yml`: install + build + lint the frontend, then `cdk deploy` via a GitHub Actions OIDC role (`github-actions-urop-deploy`) scoped to this repo's `main` branch — no long-lived AWS credentials are stored in GitHub. Trigger a deploy manually from the Actions tab (`workflow_dispatch`) if needed.

To deploy from your own machine instead:

```bash
cd infra
npm install
npm run deploy   # cdk deploy (after configuring Secrets Manager)
```

---

## Contributors

- **Nyan Lin Htet** — frontend/backend, production pipeline
- **Alyssa Liu** — UI/UX
- **Neha Sane** — matching algorithm + Google OAuth 2.0
