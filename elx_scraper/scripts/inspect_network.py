"""
Load ELx with saved auth and log every XHR/fetch request.

Look for JSON endpoints that return listing data — those are what
scrape_api.py should target. Common patterns to look for:
  - application/json content type
  - URLs containing: search, opportunities, positions, listings, jobs, graphql
"""

import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ELX_URL = "https://elx.mit.edu"
STATE_PATH = Path(__file__).resolve().parent.parent / "auth" / "mit_elx_state.json"

# URL substrings that hint at listing data endpoints
INTERESTING_KEYWORDS = [
    "search", "opportunit", "position", "listing", "job",
    "graphql", "api", "urop", "research", "project",
]


def is_interesting(url: str) -> bool:
    lower = url.lower()
    return any(kw in lower for kw in INTERESTING_KEYWORDS)


def main():
    if not STATE_PATH.exists():
        print("No saved auth state found. Run login_once.py first.", file=sys.stderr)
        sys.exit(1)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False)
        context = browser.new_context(storage_state=str(STATE_PATH))
        page = context.new_page()

        captured = []

        def on_response(response):
            req = response.request
            content_type = response.headers.get("content-type", "")
            entry = {
                "method": req.method,
                "url": req.url,
                "status": response.status,
                "content_type": content_type,
            }

            is_json = "json" in content_type
            interesting = is_interesting(req.url)

            if is_json or interesting:
                marker = "***" if is_json and interesting else "  *"
                print(f"{marker} [{response.status}] {req.method} {req.url}")
                print(f"    Content-Type: {content_type}")
                captured.append(entry)

        page.on("response", on_response)

        print(f"Loading {ELX_URL} with saved auth...")
        print("=" * 70)
        page.goto(ELX_URL, wait_until="networkidle")

        print()
        print("Page loaded. Navigate around ELx to trigger more requests.")
        print("When done, press Enter to see a summary.")
        input()

        print()
        print("=" * 70)
        print(f"Captured {len(captured)} interesting responses:")
        print()
        for i, entry in enumerate(captured, 1):
            print(f"  {i}. [{entry['status']}] {entry['method']} {entry['url']}")
            print(f"     Type: {entry['content_type']}")
            print()

        browser.close()


if __name__ == "__main__":
    main()
