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

## Automated token refresh (GitHub Actions)

The backend's `node-cron` job (daily, 6 AM UTC) needs a fresh Cognito token,
which normally expires after ~24h. Instead of manually pasting a new one
every day, `scripts/refresh_token.py` replays your saved MIT SSO session
headlessly, captures the token the ELx SPA mints on page load, and pushes it
to the backend via `POST /api/admin/elx-token`. A scheduled workflow
(`.github/workflows/elx-token-refresh.yml`) runs this daily at 05:30 UTC.

This only works as long as the underlying MIT Touchstone/Duo session in your
saved state is still valid (typically weeks) — no more frequent human login
is needed than that.

**One-time setup:**

```bash
python scripts/login_once.py                       # log in through Duo once
base64 -i auth/mit_elx_state.json | pbcopy          # macOS; use base64 -w0 on Linux
gh secret set ELX_STATE_B64                         # paste the clipboard contents
gh secret set ADMIN_SECRET                          # same value as in AWS Secrets Manager
```

## Re-authenticating

If a script reports you've been logged out (redirect to login page), re-run
`login_once.py` to refresh the state file, then run your scraper again. For
the scheduled workflow, also re-run the `base64` + `gh secret set ELX_STATE_B64`
steps above so the new session reaches GitHub Actions. GitHub emails the repo
owner automatically if a scheduled workflow run fails, so you'll be notified
when this happens.

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
