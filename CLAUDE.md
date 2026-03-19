  ---                                                                                                           
  UROP Search Engine — Architecture Plan
                                                                                                                                                       
  Problem
                                                                                                                                                       
  UROP listings at MIT are fragmented across department websites, professor pages, UROP office listings, lab websites, and mailing lists. Students
  waste time manually hunting and can't easily match their skills to opportunities.

  System Overview

  ┌─────────────┐     ┌─────────────┐     ┌──────────────┐
  │  Crawler /   │────▶│  Backend    │────▶│  Frontend    │
  │  Scraper     │     │  API + DB   │     │  (React)     │
  └─────────────┘     └─────────────┘     └──────────────┘
                            │
                      ┌─────┴──────┐
                      │  Matching  │
                      │  Engine    │
                      └────────────┘

  ---
  1. Data Sources & Crawler

  Target sources:
  - MIT UROP office listings (urop.mit.edu)
  - ELX website (elx.mit.edu)
  - Department-specific opportunity pages (EECS, MechE, Bio, etc.)
  - Individual lab/professor websites
  - Handshake/MIT career portal (if API available)
  - CSAIL, Lincoln Lab, Media Lab opportunity boards

  Crawler design:
  - Python-based (Scrapy or simple httpx + BeautifulSoup) — Python is better suited for scraping than Node
  - Scheduled runs (daily cron) to keep listings fresh
  - Each scraper is a plugin/module per source site, so adding new sources is easy
  - Store raw HTML + extracted structured data
  - Deduplication by fuzzy-matching title + PI name + department

  Extracted fields per listing:

  ┌───────────────┬──────────────────────────────┐
  │     Field     │           Example            │
  ├───────────────┼──────────────────────────────┤
  │ title         │ "ML for Protein Folding"     │
  ├───────────────┼──────────────────────────────┤
  │ professor     │ "Prof. Bonnie Berger"        │
  ├───────────────┼──────────────────────────────┤
  │ department    │ "CSAIL / Math"               │
  ├───────────────┼──────────────────────────────┤
  │ lab           │ "Berger Lab"                 │
  ├───────────────┼──────────────────────────────┤
  │ description   │ Full text                    │
  ├───────────────┼──────────────────────────────┤
  │ requirements  │ "Python, statistics, 6.3900" │
  ├───────────────┼──────────────────────────────┤
  │ pay_or_credit │ "Both"                       │
  ├───────────────┼──────────────────────────────┤
  │ posted_date   │ 2026-02-15                   │
  ├───────────────┼──────────────────────────────┤
  │ source_url    │ Original link                │
  ├───────────────┼──────────────────────────────┤
  │ contact_email │ berger@mit.edu               │
  ├───────────────┼──────────────────────────────┤
  │ is_active     │ true                         │
  └───────────────┴──────────────────────────────┘

  ---
  2. Backend API

  Tech: Node.js + Express (or Fastify) + PostgreSQL

  Why Postgres: full-text search built-in (tsvector), JSON columns for flexible metadata, and pg_trgm for fuzzy matching. Alternatively, SQLite for a
  simpler MVP.

  Core tables:
  - listings — scraped UROP opportunities
  - users — student profiles
  - user_skills / user_interests — normalized tags
  - saved_listings — bookmarks
  - match_scores — precomputed match results (optional cache)

  Key endpoints:
  POST   /auth/login          (MIT Touchstone SSO or email)
  GET    /listings             (search, filter, paginate)
  GET    /listings/:id
  POST   /profile              (create/update user profile)
  POST   /profile/resume       (upload + parse resume)
  GET    /matches              (personalized ranked results)
  POST   /listings/refresh     (admin: trigger crawl)

  ---
  3. Matching Algorithm

  Recommendation: Hybrid approach (better than pure tags)

  Layer 1 — Structured tag matching (fast, interpretable)

  - Extract tags from both listings and user profiles
  - Categories: skills (Python, MATLAB, CAD), fields (ML, neuroscience, robotics), courses (6.3900, 7.014), department
  - Score = weighted Jaccard similarity across categories

  Layer 2 — Semantic similarity (handles the long tail)

  - Use an embedding model (OpenAI text-embedding-3-small or open-source all-MiniLM-L6-v2 via HuggingFace)
  - Embed listing descriptions + user bio/resume text
  - Cosine similarity between user embedding and each listing embedding
  - This catches matches that tags miss (e.g., "I did computational geometry research" matching a listing that says "looking for someone with spatial
  algorithms experience")

  Layer 3 — Filters & boost signals

  - Hard filters: department preference, pay vs. credit, time commitment
  - Boost: recency of listing, professor rating (optional), same department

  Final score:

  score = 0.3 * tag_score + 0.5 * semantic_score + 0.2 * boost_signals

  Why this beats pure tags: Tags alone miss synonym/context matches and require maintaining a huge taxonomy. Pure semantic search lacks
  interpretability. The hybrid gives you both.

  ---
  4. Frontend (React — what you already have)

  Pages:

  ┌───────────────┬──────────────────────────────────────────────┐
  │     Route     │                 Description                  │
  ├───────────────┼──────────────────────────────────────────────┤
  │ /             │ Landing + search bar with filters            │
  ├───────────────┼──────────────────────────────────────────────┤
  │ /listings     │ Browse/search results with cards             │
  ├───────────────┼──────────────────────────────────────────────┤
  │ /listings/:id │ Detail view with "Save" and "I'm interested" │
  ├───────────────┼──────────────────────────────────────────────┤
  │ /profile      │ Edit profile, upload resume, set preferences │
  ├───────────────┼──────────────────────────────────────────────┤
  │ /matches      │ Personalized "For You" feed                  │
  ├───────────────┼──────────────────────────────────────────────┤
  │ /saved        │ Bookmarked listings                          │
  └───────────────┴──────────────────────────────────────────────┘

  Key UI components:
  - SearchBar — keyword + filter chips (department, skills, pay/credit)
  - ListingCard — compact card showing title, prof, dept, match %, tags
  - ListingDetail — full description, requirements, contact info
  - ProfileForm — multi-step: bio, resume upload, class year, skills picker, interests
  - MatchScore — visual indicator (e.g., "92% match") with explainability ("matched on: Python, ML, CSAIL")

  Libraries to add:
  - react-router-dom — routing
  - tailwindcss — styling
  - tanstack/react-query — data fetching
  - react-dropzone — resume upload
  - lucide-react — icons

  ---
  5. Resume Parsing

  When a user uploads a PDF resume:
  1. Extract text (Python pdfplumber or PyMuPDF)
  2. Use an LLM call (Claude API) to extract structured data: skills, courses, research experience, interests
  3. Auto-populate the user's profile tags
  4. User can review and edit the extracted tags

  This is a huge UX win — students don't have to manually enter all their info.

  ---
  6. Implementation Phases

  Phase 1 — MVP (build this first)

  - Set up Postgres schema + seed with manually curated listings (~50)
  - Backend API: listings CRUD, basic search (full-text)
  - Frontend: search page, listing cards, detail view
  - Basic filter by department, keyword search
  - No auth, no matching, no crawler yet

  Phase 2 — Profiles & Matching

  - User auth (MIT email verification or simple email/password)
  - Profile creation with skills/interests picker
  - Tag-based matching (Layer 1)
  - "For You" page showing ranked results

  Phase 3 — Smart Features

  - Resume upload + LLM-powered parsing
  - Semantic embedding matching (Layer 2)
  - Match explainability ("Why this match?")

  Phase 4 — Crawler & Automation

  - Python scrapers for top 3-5 MIT sources
  - Daily cron job to refresh listings
  - Deduplication pipeline
  - Admin dashboard to monitor crawl health

  Phase 5 — Polish

  - Email notifications for new matches
  - Professor-side: claim/post listings
  - Analytics (popular searches, match rates)
  - Mobile responsiveness

  ---
  Key Decisions to Make

  1. Database: Postgres (recommended) vs. SQLite (simpler) vs. Supabase (hosted Postgres + auth for free)
  2. Auth: MIT Touchstone SSO (harder to set up but legit) vs. email/password vs. Supabase Auth
  3. Hosting: Vercel (frontend) + Railway/Fly.io (backend) + Supabase (DB) — all have free tiers
  4. Embedding model: OpenAI API (easy, costs ~$0.001/listing) vs. self-hosted open-source (free, more work)

  Want me to start building Phase 1?