"""
Fallback scraper: extract UROP listings from the rendered ELx page
using Playwright locators when no clean JSON API is available.

Uses stable selector strategies in this priority order:
  1. data-testid attributes
  2. ARIA roles and labels
  3. Semantic HTML elements (h2, h3, a[href])
  4. CSS class selectors (last resort)

Run inspect_network.py first to confirm you actually need this.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from playwright.sync_api import sync_playwright, Page, Locator

ELX_URL = "https://elx.mit.edu"
STATE_PATH = Path(__file__).resolve().parent.parent / "auth" / "mit_elx_state.json"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# ── Selector config ──
# Update these after inspecting the actual ELx DOM.
# Use the browser DevTools to find the best selectors for listing cards.
SELECTORS = {
    # The container for a single listing card
    "card": "[data-testid='opportunity-card'], .opportunity-card, article, .listing-card, .card",
    # Fields within a card (relative selectors)
    "title": "h2, h3, [data-testid='title'], .title, .card-title",
    "supervisor": "[data-testid='supervisor'], .supervisor, .faculty, .pi",
    "department": "[data-testid='department'], .department, .dept",
    "location": "[data-testid='location'], .location",
    "tags": "[data-testid='tag'], .tag, .badge, .chip",
    "summary": "[data-testid='description'], .description, .summary, p",
    "link": "a[href]",
}


def check_auth(page: Page) -> bool:
    url = page.url.lower()
    login_indicators = ["idp.", "login", "shibboleth", "touchstone", "duo"]
    return not any(indicator in url for indicator in login_indicators)


def safe_text(locator: Locator) -> str:
    """Get inner text of first match, or empty string if none."""
    try:
        if locator.count() > 0:
            return locator.first.inner_text().strip()
    except Exception:
        pass
    return ""


def safe_all_text(locator: Locator) -> list[str]:
    """Get inner text of all matches."""
    try:
        return [el.inner_text().strip() for el in locator.all() if el.inner_text().strip()]
    except Exception:
        return []


def safe_href(locator: Locator) -> str:
    try:
        if locator.count() > 0:
            return locator.first.get_attribute("href") or ""
    except Exception:
        pass
    return ""


def extract_card(card: Locator) -> dict:
    title = safe_text(card.locator(SELECTORS["title"]))
    link = safe_href(card.locator(SELECTORS["link"]))

    if link and not link.startswith("http"):
        link = f"https://elx.mit.edu{link}"

    return {
        "id": link or title,
        "title": title,
        "lab_or_supervisor": safe_text(card.locator(SELECTORS["supervisor"])),
        "department": safe_text(card.locator(SELECTORS["department"])),
        "location": safe_text(card.locator(SELECTORS["location"])),
        "term": "",
        "tags": ", ".join(safe_all_text(card.locator(SELECTORS["tags"]))),
        "summary": safe_text(card.locator(SELECTORS["summary"])),
        "url": link,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "source": "elx.mit.edu",
    }


def scrape_page(page: Page) -> list[dict]:
    """Extract all listing cards from the current page."""
    cards = page.locator(SELECTORS["card"])
    count = cards.count()
    print(f"  Found {count} cards on this page")

    listings = []
    for i in range(count):
        card = cards.nth(i)
        entry = extract_card(card)
        if entry["title"]:
            listings.append(entry)

    return listings


def main():
    if not STATE_PATH.exists():
        print("No saved auth state. Run login_once.py first.", file=sys.stderr)
        sys.exit(1)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    all_listings: list[dict] = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False)
        context = browser.new_context(storage_state=str(STATE_PATH))
        page = context.new_page()

        print(f"Loading {ELX_URL} ...")
        page.goto(ELX_URL, wait_until="networkidle")

        if not check_auth(page):
            print(
                "Auth expired — redirected to login. "
                "Re-run login_once.py to refresh.",
                file=sys.stderr,
            )
            browser.close()
            sys.exit(1)

        # TODO: navigate to the listings sub-page if needed
        # page.goto("https://elx.mit.edu/opportunities", wait_until="networkidle")

        page.wait_for_timeout(3000)

        page_num = 1
        while True:
            print(f"\n--- Page {page_num} ---")
            listings = scrape_page(page)
            all_listings.extend(listings)

            # Pagination: try clicking a "Next" button
            next_btn = page.locator(
                "button:has-text('Next'), "
                "a:has-text('Next'), "
                "[aria-label='Next page'], "
                "[data-testid='next-page']"
            )

            if next_btn.count() > 0 and next_btn.first.is_enabled():
                next_btn.first.click()
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(1500)
                page_num += 1
            else:
                break

        browser.close()

    # Deduplicate by URL or title
    seen = set()
    unique = []
    for item in all_listings:
        key = item["url"] or item["title"]
        if key and key not in seen:
            seen.add(key)
            unique.append(item)

    print(f"\nScraped {len(all_listings)} total, {len(unique)} unique listings")

    if not unique:
        print("No listings found. Check the SELECTORS config in this script.")
        sys.exit(1)

    raw_path = DATA_DIR / "urops_raw.json"
    with open(raw_path, "w") as f:
        json.dump(unique, f, indent=2)
    print(f"Raw JSON → {raw_path}")

    df = pd.DataFrame(unique)
    csv_path = DATA_DIR / "urops.csv"
    df.to_csv(csv_path, index=False)
    print(f"CSV      → {csv_path}")
    print(f"Columns: {list(df.columns)}")
    print(f"Rows:    {len(df)}")


if __name__ == "__main__":
    main()
