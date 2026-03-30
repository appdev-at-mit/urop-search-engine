# ELx UROP Scraper

Playwright-based scraper for MIT ELx UROP listings. Uses saved browser auth
state so you only log in once, then reuses the session for automated runs.

## Setup

```bash
cd elx_scraper
pip install -r requirements.txt
playwright install
```

## Usage

### 1. Save your authenticated session

```bash
python scripts/login_once.py
```

A browser window opens. Log in through MIT auth / Duo / certificates manually.
Once you land on the ELx dashboard, press Enter in the terminal. Your session
is saved to `auth/mit_elx_state.json`.

### 2. Inspect network traffic (find the API)

```bash
python scripts/inspect_network.py
```

Loads ELx with your saved session and prints every XHR/fetch request. Look for
JSON endpoints that return listing data — those are what `scrape_api.py` targets.

### 3. Scrape via API (preferred)

```bash
python scripts/scrape_api.py
```

Captures the JSON endpoint that populates the listings page, parses it, and
exports to `data/urops_raw.json` and `data/urops.csv`.

### 4. Scrape via DOM (fallback)

```bash
python scripts/scrape_dom.py
```

If no clean API endpoint exists, this script scrapes the rendered page using
Playwright locators.

## Re-authenticating

If a script reports you've been logged out (redirect to login page), re-run
`login_once.py` to refresh the state file, then run your scraper again.

## Files

```
elx_scraper/
  auth/
    mit_elx_state.json   ← saved browser state (git-ignored)
  scripts/
    login_once.py         ← manual login + save state
    inspect_network.py    ← log network requests to find APIs
    scrape_api.py         ← scrape JSON endpoint → CSV/JSON
    scrape_dom.py         ← fallback: scrape rendered DOM → CSV/JSON
  data/
    urops_raw.json        ← raw scraped data (git-ignored)
    urops.csv             ← cleaned export (git-ignored)
```

## Rules

- Never store MIT passwords in code.
- Never commit `auth/mit_elx_state.json`.
- Keep request volume low — don't hammer ELx.
- Only scrape what you're authorized to access.
