# UROP Search Engine

A search engine for MIT UROP (Undergraduate Research Opportunity Program) listings, scraping data from [ELx](https://elx.mit.edu).

## Prerequisites

- **Node.js** v20+
- **MongoDB Atlas** account with a cluster (or local MongoDB)
- **MIT Kerberos** credentials (to log in to ELx and get a scraping token)

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

Create a `.env` file in the project root:

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=<app>
ADMIN_SECRET=<pick-any-secret-string>
```

The backend reads this file from `../.env` relative to the `backend/` directory.

### 3. Whitelist your IP in MongoDB Atlas

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Select your cluster → **Network Access** (left sidebar)
3. Click **Add IP Address**
4. Add your current IP, or use `0.0.0.0/0` to allow all (fine for dev)
5. Wait ~1 minute for it to propagate

> If you skip this step, the backend will crash with `ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR`.

## Running

Start **two terminals**:

```bash
# Terminal 1 — Backend (Express API on port 3001)
cd backend
npm run dev

# Terminal 2 — Frontend (Vite dev server on port 5173)
npm run dev
```

The frontend proxies `/api` requests to `http://localhost:3001`.

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **Admin panel:** http://localhost:5173/admin

## Populating listings from ELx

UROP listings are scraped from MIT's ELx API, which requires a Cognito access token obtained via MIT Touchstone login. Tokens expire after ~24 hours.

### Step 1: Get your ELx token

1. Go to [elx.mit.edu](https://elx.mit.edu) and log in with your MIT credentials
2. Open browser DevTools (Cmd+Option+I) → **Console**
3. Run:

```javascript
localStorage.getItem(Object.keys(localStorage).find(k => k.includes('accessToken')))
```

4. Copy the output (the long `eyJ...` string, without quotes)

### Step 2: Submit the token via the admin panel

1. Go to http://localhost:5173/admin
2. Enter your `ADMIN_SECRET` and click **Continue**
3. Paste the token into the token field and click **Save**
4. Click **Refresh Now** to scrape ELx and populate the database

You should see a success message like "Done: 45 new, 0 updated, 45 total listings".

### Alternative: Bookmarklet

The admin panel includes a draggable bookmarklet ("Copy ELx Token"). Drag it to your bookmarks bar. After logging into ELx, click it to copy the token via a prompt dialog.

### Automatic refresh

The backend runs a daily cron job at 6:00 AM that automatically scrapes ELx — as long as a valid (non-expired) token is stored. You only need to paste a fresh token every ~24 hours.

## Project structure

```
urop-search-engine/
├── src/                    # React frontend (Vite + TypeScript)
│   ├── pages/              # Route-level components
│   │   ├── HomePage.tsx
│   │   ├── ListingsPage.tsx
│   │   ├── ListingDetailPage.tsx
│   │   └── AdminPage.tsx
│   ├── components/         # Shared UI components
│   ├── lib/api.ts          # Frontend API helpers
│   └── types.ts            # Shared TypeScript types
├── backend/                # Express API server
│   └── src/
│       ├── index.js        # Entry point + cron setup
│       ├── db.js           # MongoDB connection
│       ├── routes/
│       │   ├── listings.js # Public listing endpoints
│       │   └── admin.js    # Admin endpoints (token, scrape)
│       └── services/
│           └── elx-scraper.js  # ELx API client + upsert logic
├── elx_scraper/            # Python scraper (alternative to live API)
├── .env                    # Environment variables (not committed)
└── vite.config.ts          # Vite config with API proxy
```

## Available scripts

| Location | Command | Description |
|----------|---------|-------------|
| Root | `npm run dev` | Start Vite frontend dev server |
| Root | `npm run build` | Type-check + production build |
| `backend/` | `npm run dev` | Start backend with file watching |
| `backend/` | `npm run start` | Start backend (production) |
| `backend/` | `npm run import-elx` | Import from local `elx_scraper/data/urops_raw.json` |

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/listings` | Search/filter/paginate listings |
| GET | `/api/listings/:id` | Get a single listing |
| GET | `/api/listings/departments` | List all departments |
| GET | `/api/health` | Health check |
| POST | `/api/admin/elx-token` | Save a Cognito token (requires `x-admin-key`) |
| POST | `/api/admin/refresh-listings` | Trigger ELx scrape (requires `x-admin-key`) |
| GET | `/api/admin/scrape-status` | Token status + listing count (requires `x-admin-key`) |
