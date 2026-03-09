# UROP Search Engine — Team Task Board

> **Team size**: 6 members
> **Phase 1 (MVP)**: DONE — backend API (Express + SQLite), frontend (React + Tailwind), 50 seed listings, full-text search, filters
>
> This file tracks Phases 2–5. Update your task status as you go.

---

## Status Key

- [ ] Not started
- [x] Done
- 🔄 In progress
- ⛔ Blocked (note what's blocking you)

---

## Team Roles

| Member | Role | Focus Areas |
|--------|------|-------------|
| **Member 1 (you)** | Project Lead / Frontend Lead | Architecture decisions, code review, frontend polish, integration |
| **Member 2** | Backend Engineer | Auth system, user/profile API, database schema, saved listings |
| **Member 3** | Frontend Engineer | Profile page, matches page, saved page, UI components |
| **Member 4** | ML / Matching Engineer | Tag matching, semantic embeddings, scoring algorithm |
| **Member 5** | Crawler / Data Engineer | Python scrapers, scheduling, dedup pipeline |
| **Member 6** | Full-Stack / AI Integration | Resume parsing, LLM integration, notifications, analytics |

---

## Phase 2 — Profiles & Matching

**Goal**: Users can create accounts, build profiles, and see ranked matches.
**Target**: 2 weeks

### Member 2 — Auth & User Backend

- [ ] **2.1** Migrate database from SQLite to Supabase Postgres (or hosted Postgres)
  - Create migration script to transfer seed data
  - Set up connection pooling
- [ ] **2.2** Design and create user-related tables
  - `users` (id, email, name, class_year, bio, created_at)
  - `user_skills` (user_id, skill_name, category)
  - `user_interests` (user_id, interest)
  - `saved_listings` (user_id, listing_id, saved_at)
- [ ] **2.3** Implement auth endpoints
  - `POST /auth/register` — email + password (MIT email validation)
  - `POST /auth/login` — returns JWT
  - `GET /auth/me` — returns current user from token
  - Add auth middleware for protected routes
- [ ] **2.4** Implement profile endpoints
  - `POST /profile` — create/update user profile
  - `GET /profile` — get current user's profile with skills/interests
  - `POST /profile/skills` — add/remove skills
  - `POST /profile/interests` — add/remove interests
- [ ] **2.5** Implement saved listings endpoints
  - `POST /saved/:listingId` — toggle save
  - `GET /saved` — get user's saved listings

### Member 3 — Profile & Match Frontend

> **Depends on**: Member 2 tasks 2.2–2.5

- [ ] **3.1** Build auth UI
  - Login page (`/login`)
  - Register page (`/register`)
  - Auth context/provider for frontend state
  - Protected route wrapper component
  - Show login/logout in header
- [ ] **3.2** Build profile page (`/profile`)
  - Multi-step form: basic info → skills picker → interests picker
  - Skills picker: searchable tag input with autocomplete (categories: languages, tools, fields, courses)
  - Interests picker: similar tag input for research interests
  - Class year selector
  - Bio text area
- [ ] **3.3** Build saved listings page (`/saved`)
  - Reuse `ListingCard` component
  - Add save/unsave heart button to `ListingCard` and `ListingDetailPage`
  - Empty state when no saved listings
- [ ] **3.4** Build matches page (`/matches`)
  - "For You" feed layout
  - `MatchScore` component showing % match with explanation
  - Skeleton loaders while matching runs
  - Empty state prompting user to complete their profile

### Member 4 — Tag-Based Matching (Layer 1)

> **Depends on**: Member 2 tasks 2.2, 2.4

- [ ] **4.1** Define and build the tag taxonomy
  - Curate master list of skills: programming languages, tools, frameworks
  - Curate master list of fields: ML, robotics, neuroscience, etc.
  - Curate master list of MIT courses: 6.3900, 7.014, 18.03, etc.
  - Store as structured JSON or DB table
- [ ] **4.2** Tag extraction from listings
  - Parse `requirements` field to extract structured tags
  - Parse `description` field for field/topic tags
  - Map extracted text to canonical tag names (e.g., "machine learning" → "ML")
  - Backfill tags for all 50 existing seed listings
- [ ] **4.3** Implement weighted Jaccard similarity scoring
  - `score = 0.4 * skills_overlap + 0.35 * fields_overlap + 0.25 * courses_overlap`
  - Endpoint: `GET /matches` — returns listings ranked by tag score for current user
- [ ] **4.4** Match explainability
  - Return matched tags alongside each score
  - Format: `{ score: 0.85, matched_on: ["Python", "ML", "CSAIL"] }`

---

## Phase 3 — Smart Features

**Goal**: Resume upload auto-populates profiles; semantic search catches matches that tags miss.
**Target**: 2 weeks after Phase 2

### Member 6 — Resume Parsing

- [ ] **6.1** Build resume upload endpoint
  - `POST /profile/resume` — accepts PDF upload (multer)
  - Store file in object storage (Supabase Storage or S3)
  - Size limit: 5MB, PDF only
- [ ] **6.2** Build PDF text extraction service
  - Python microservice using `pdfplumber` or `PyMuPDF`
  - Expose as internal API or call from Node via child process
  - Return raw text from PDF
- [ ] **6.3** LLM-powered structured extraction
  - Send extracted text to Claude API with prompt to extract:
    - Skills (programming languages, tools, frameworks)
    - Courses taken (MIT course numbers)
    - Research experience (topics, labs)
    - Interests
  - Return structured JSON
- [ ] **6.4** Auto-populate profile from resume
  - Merge extracted tags into user's existing profile
  - Frontend: show extracted tags for user review before saving
  - "Edit & confirm" UI before committing to profile

### Member 3 — Resume Upload Frontend

> **Depends on**: Member 6 tasks 6.1–6.4

- [ ] **3.5** Build resume upload component
  - Drag-and-drop zone using `react-dropzone`
  - Upload progress indicator
  - Preview of extracted tags with checkboxes to accept/reject each
  - Integrate into profile page (`/profile`)

### Member 4 — Semantic Matching (Layer 2)

> **Depends on**: Phase 2 matching working

- [ ] **4.5** Set up embedding pipeline
  - Choose model: OpenAI `text-embedding-3-small` or self-hosted `all-MiniLM-L6-v2`
  - Generate embeddings for all listing descriptions
  - Store embeddings in DB (pgvector extension if using Postgres)
- [ ] **4.6** User profile embedding
  - Concatenate user bio + skills + interests into a text block
  - Generate embedding for each user
  - Re-generate on profile update
- [ ] **4.7** Implement cosine similarity matching
  - Compute cosine similarity between user embedding and each listing embedding
  - Combine with tag score: `final = 0.3 * tag + 0.5 * semantic + 0.2 * boost`
  - Boost signals: recency, same department, pay preference match
- [ ] **4.8** Match explanation generation
  - Extend explainability: "Matched because your bio mentions X, and this listing involves Y"
  - Show top 3 reasons per match on the frontend

---

## Phase 4 — Crawler & Automation

**Goal**: Automatically scrape real UROP listings from MIT sources daily.
**Target**: 2 weeks after Phase 3

### Member 5 — Web Scrapers

- [ ] **5.1** Set up Python scraper framework
  - Project structure: `crawler/` directory with `scrapers/`, `pipelines/`, `scheduler/`
  - Base scraper class with common methods (fetch, parse, extract)
  - Shared data model matching the `listings` table schema
  - Requirements file with dependencies (httpx, beautifulsoup4, scrapy)
- [ ] **5.2** Scraper: MIT UROP Office (urop.mit.edu)
  - Scrape active listings
  - Extract: title, professor, department, description, requirements, dates
  - Handle pagination
- [ ] **5.3** Scraper: CSAIL opportunities
  - Scrape CSAIL job/research postings
  - Filter for UROP-relevant listings
- [ ] **5.4** Scraper: MIT departmental pages (EECS, MechE, Bio)
  - At least 2-3 department pages
  - Handle varying page structures per department
- [ ] **5.5** Deduplication pipeline
  - Fuzzy match on title + professor + department
  - Use `thefuzz` (fuzzywuzzy) library
  - Threshold: >85% similarity = duplicate
  - Merge strategy: keep newest, preserve longest description

### Member 5 — Scheduling & Integration

- [ ] **5.6** Daily cron job
  - Use `node-cron` or system crontab
  - Run all scrapers sequentially
  - Log results: new listings, updated, duplicates skipped
- [ ] **5.7** Backend integration
  - `POST /listings/refresh` (admin-only) — trigger manual crawl
  - Crawl results automatically upserted into listings table
- [ ] **5.8** Crawl health monitoring
  - Track per-source: last run, listings found, errors
  - Expose via `GET /admin/crawl-status`

### Member 1 (you) — Admin Dashboard Frontend

- [ ] **1.1** Build admin dashboard (`/admin`)
  - Crawl status per source: last run, count, errors
  - Manual "Refresh" button per source
  - Recent crawl log viewer
  - Protected behind admin auth

---

## Phase 5 — Polish

**Goal**: Notifications, professor-side features, analytics, mobile.
**Target**: 2 weeks after Phase 4

### Member 6 — Notifications

- [ ] **6.5** Email notification system
  - Send email when new listings match user's profile (>70% score)
  - Use SendGrid or Resend API
  - Notification preferences in user settings (on/off, frequency: daily/weekly digest)
- [ ] **6.6** In-app notification feed
  - "New matches" badge in header
  - Simple notification dropdown with recent matches

### Member 2 — Professor-Side Features

- [ ] **2.6** Professor accounts
  - Separate role: `professor` vs `student`
  - Professor can claim existing listings
  - Professor can post new listings directly via form
- [ ] **2.7** Listing management for professors
  - `POST /listings` — create new listing (professor only)
  - `PUT /listings/:id` — update listing
  - `DELETE /listings/:id` — deactivate listing

### Member 1 (you) — Analytics & Mobile

- [ ] **1.2** Analytics dashboard
  - Popular search terms (track in DB)
  - Most viewed listings
  - Match rate stats (how many users >70% match)
  - Simple charts (use recharts or chart.js)
- [ ] **1.3** Mobile responsiveness audit
  - Test all pages on mobile viewports
  - Fix any layout issues
  - Touch-friendly tap targets
  - Mobile navigation (hamburger menu)

### Member 3 — Frontend Polish

- [ ] **3.6** Loading & empty states
  - Skeleton loaders for all pages
  - Animated transitions between pages
  - Error boundaries with friendly retry UI
- [ ] **3.7** Accessibility pass
  - Keyboard navigation for all interactive elements
  - ARIA labels on icons, buttons, form fields
  - Focus management on route changes
  - Screen reader testing

### Member 4 — Matching Polish

- [ ] **4.9** Performance optimization
  - Cache match scores in `match_scores` table
  - Invalidate on profile update or new listings
  - Precompute nightly for active users
- [ ] **4.10** A/B test tag vs semantic weights
  - Implement configurable weights
  - Track click-through rate per match
  - Adjust formula based on user engagement data

---

## Dependency Graph

```
Phase 2:
  Member 2 (auth + DB)  ──→  Member 3 (profile UI)
                          ──→  Member 4 (tag matching)

Phase 3:
  Member 6 (resume parsing)  ──→  Member 3 (upload UI)
  Member 4 (semantic matching, builds on Phase 2 work)

Phase 4:
  Member 5 (scrapers, independent)
  Member 1 (admin dashboard, depends on 5.8)

Phase 5:
  All members work in parallel on polish tasks
```

---

## Getting Started

**Local dev setup** (for all team members):

```bash
# Clone the repo
git clone <repo-url> && cd urop-search-engine

# Frontend
npm install
npm run dev          # → http://localhost:5173

# Backend
cd backend
npm install
npm run seed         # populate DB with 50 listings
npm run dev          # → http://localhost:3001
```

**Current tech stack**:
- Frontend: React 19 + TypeScript + Vite + Tailwind v4 + React Router + TanStack Query + Lucide
- Backend: Express 5 + SQLite (better-sqlite3) with FTS5
- Font: DM Sans | Colors: neutral palette (#1a1a2e primary, #a31f34 accent)

**Conventions**:
- Branch naming: `feature/<phase>-<task>` (e.g., `feature/p2-auth`)
- Commit messages: `feat:`, `fix:`, `refactor:`, `docs:`
- PR into `main`, require 1 review
