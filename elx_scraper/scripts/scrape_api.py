"""
Scrape ELx UROP listings via the MIT elo-v2 API.

Endpoints discovered via inspect_network.py:
  - GET https://api.mit.edu/elo-v2/opportunity?       ← main listings
  - GET https://api.mit.edu/elo-v2/opportunity/filters ← filter options
  - GET https://api.mit.edu/elo-v2/lookups             ← lookup tables
  - GET https://api.mit.edu/elo-v2/initialization      ← app config

Usage:
  python scrape_api.py              # scrape and export
  python scrape_api.py --discover   # dump raw JSON sample for field mapping
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from playwright.sync_api import sync_playwright

ELX_URL = "https://elx.mit.edu"
STATE_PATH = Path(__file__).resolve().parent.parent / "auth" / "mit_elx_state.json"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

OPPORTUNITY_API = "api.mit.edu/elo-v2/opportunity"

# Resolved at runtime from the /lookups endpoint
_dept_lookup: dict[str, str] = {}


def check_auth(page) -> bool:
    url = page.url.lower()
    login_indicators = ["idp.", "login", "shibboleth", "touchstone", "duo"]
    return not any(indicator in url for indicator in login_indicators)


def build_dept_lookup(lookups_body: dict) -> dict[str, str]:
    """Map department IDs like 'D_MECHE' to human-readable names."""
    mapping = {}
    for dept in lookups_body.get("departments", []):
        mapping[dept["id"]] = dept["text"]
    return mapping


def extract_fields(raw_item: dict) -> dict:
    """
    Map elo-v2 /opportunity fields to our normalized schema.

    Actual shape per item:
      id, dynamic_id, primary_theme{id,text}, themes[], status{id,text},
      texts{title, tagline, overview}, department{id}, terms[{id,text}],
      location{text, city, state, country, coordinates},
      deadline_date, start_date, end_date, application{status}
    """
    texts = raw_item.get("texts") or {}
    dept = raw_item.get("department") or {}
    location = raw_item.get("location") or {}
    theme = raw_item.get("primary_theme") or {}
    terms = raw_item.get("terms") or []
    item_id = raw_item.get("id", "")

    dept_id = dept.get("id", "")
    dept_name = _dept_lookup.get(dept_id, dept_id)

    return {
        "id": item_id,
        "title": texts.get("title", ""),
        "tagline": texts.get("tagline") or "",
        "description": texts.get("overview", ""),
        "department": dept_name,
        "department_id": dept_id,
        "theme": theme.get("text", ""),
        "terms": ", ".join(t.get("text", "") for t in terms),
        "location": location.get("text", ""),
        "city": location.get("city", ""),
        "status": (raw_item.get("status") or {}).get("text", ""),
        "deadline_date": raw_item.get("deadline_date") or "",
        "start_date": raw_item.get("start_date") or "",
        "end_date": raw_item.get("end_date") or "",
        "url": f"https://elx.mit.edu/opportunity/{item_id}" if item_id else "",
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "source": "elx.mit.edu",
    }


def flatten_if_needed(value):
    """Convert lists/dicts to strings for CSV compatibility."""
    if isinstance(value, (list, dict)):
        return json.dumps(value, default=str)
    return value


def run_browser(discover: bool = False):
    if not STATE_PATH.exists():
        print("No saved auth state. Run login_once.py first.", file=sys.stderr)
        sys.exit(1)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    captured: dict[str, dict] = {}

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(storage_state=str(STATE_PATH))
        page = context.new_page()

        def on_response(response):
            content_type = response.headers.get("content-type", "")
            if "json" not in content_type:
                return
            if OPPORTUNITY_API not in response.url and "elo-v2" not in response.url:
                return
            try:
                body = response.json()
            except Exception:
                return

            label = response.url.split("elo-v2/")[-1].split("?")[0].replace("/", "_") or "opportunity"
            print(f"  Captured [{response.status}]: {response.url[:120]}")
            captured[label] = {
                "url": response.url,
                "status": response.status,
                "body": body,
            }

        page.on("response", on_response)

        print(f"Loading {ELX_URL} (headless)...")
        page.goto(ELX_URL, wait_until="networkidle")

        if not check_auth(page):
            print(
                "Auth expired — redirected to login. "
                "Re-run login_once.py to refresh.",
                file=sys.stderr,
            )
            browser.close()
            sys.exit(1)

        page.wait_for_timeout(3000)

        # The SPA may not fire the /opportunity request on initial load.
        # Wait for it, and if it doesn't appear, try explicit navigation.
        if "opportunity" not in captured:
            print("  Main /opportunity endpoint not yet captured, waiting...")
            page.wait_for_timeout(5000)

        if "opportunity" not in captured:
            print("  Navigating explicitly to trigger opportunity fetch...")
            page.evaluate("window.location.hash = '#/opportunities'")
            page.wait_for_timeout(3000)
            page.goto(ELX_URL, wait_until="networkidle")
            page.wait_for_timeout(5000)

        browser.close()

    return captured


def discover(captured: dict):
    """Dump raw JSON samples so you can see the field names."""
    print("\n" + "=" * 70)
    print("DISCOVERY MODE — raw API response shapes")
    print("=" * 70)

    for label, resp in captured.items():
        print(f"\n--- {label} ({resp['url'][:100]}) ---")
        body = resp["body"]

        if isinstance(body, list):
            print(f"  Array with {len(body)} items")
            if body:
                print("  First item keys:", list(body[0].keys()) if isinstance(body[0], dict) else type(body[0]))
                sample_path = DATA_DIR / f"sample_{label}.json"
                with open(sample_path, "w") as f:
                    json.dump(body[0], f, indent=2, default=str)
                print(f"  Sample saved → {sample_path}")
        elif isinstance(body, dict):
            print(f"  Object with keys: {list(body.keys())}")
            for key, val in body.items():
                if isinstance(val, list):
                    print(f"    .{key}: array[{len(val)}]", end="")
                    if val and isinstance(val[0], dict):
                        print(f" — item keys: {list(val[0].keys())}")
                        sample_path = DATA_DIR / f"sample_{label}_{key}.json"
                        with open(sample_path, "w") as f:
                            json.dump(val[0], f, indent=2, default=str)
                        print(f"      Sample saved → {sample_path}")
                    else:
                        print()
                elif isinstance(val, dict):
                    print(f"    .{key}: object with keys {list(val.keys())}")
                else:
                    preview = str(val)[:80]
                    print(f"    .{key}: {type(val).__name__} = {preview}")

    full_path = DATA_DIR / "api_raw_full.json"
    with open(full_path, "w") as f:
        json.dump({k: v["body"] for k, v in captured.items()}, f, indent=2, default=str)
    print(f"\nFull API dump → {full_path}")
    print("\nCheck the sample files, then run without --discover to export.")


def find_response(captured: dict, *labels: str):
    """Find a captured response — exact match first, then prefix match."""
    for target in labels:
        if target in captured:
            return captured[target]["body"]
    for target in labels:
        for label, resp in captured.items():
            if label.startswith(target) and label == target:
                return resp["body"]
    return None


def export(captured: dict):
    """Parse the opportunity endpoint and export to JSON + CSV."""
    global _dept_lookup

    # Build department ID → name lookup from /lookups
    lookups = find_response(captured, "lookups")
    if lookups and isinstance(lookups, dict):
        _dept_lookup = build_dept_lookup(lookups)
        print(f"Loaded {len(_dept_lookup)} department mappings from /lookups")

    # Find the opportunity listings
    items = find_response(captured, "opportunity")

    if items is None:
        print("Could not find opportunity data in captured responses.")
        print(f"Available: {list(captured.keys())}")
        print("Try running with --discover to inspect the response shape.")
        sys.exit(1)

    # Unwrap if it's a dict wrapper
    if isinstance(items, dict):
        for key in ["data", "results", "items", "opportunities", "records"]:
            if key in items and isinstance(items[key], list):
                items = items[key]
                print(f"Unwrapped .{key} array")
                break
        else:
            items = [items]

    if not isinstance(items, list):
        items = [items]

    print(f"Found {len(items)} listings")

    if not items:
        print("No listings returned.")
        sys.exit(1)

    listings = [extract_fields(item) for item in items]

    for listing in listings:
        for k, v in listing.items():
            listing[k] = flatten_if_needed(v)

    raw_path = DATA_DIR / "urops_raw.json"
    with open(raw_path, "w") as f:
        json.dump(items, f, indent=2, default=str)
    print(f"Raw JSON  → {raw_path}")

    df = pd.DataFrame(listings)
    csv_path = DATA_DIR / "urops.csv"
    df.to_csv(csv_path, index=False)
    print(f"CSV       → {csv_path}")
    print(f"Columns:  {list(df.columns)}")
    print(f"Rows:     {len(df)}")

    # Quick preview
    print(f"\nFirst 3 titles:")
    for _, row in df.head(3).iterrows():
        print(f"  • {row['title'][:80]}")


def main():
    parser = argparse.ArgumentParser(description="Scrape ELx UROP listings")
    parser.add_argument(
        "--discover", action="store_true",
        help="Dump raw API responses to inspect field names",
    )
    args = parser.parse_args()

    captured = run_browser(discover=args.discover)

    if not captured:
        print("\nNo elo-v2 API responses captured.")
        print("Auth may have expired — try re-running login_once.py.")
        sys.exit(1)

    if args.discover:
        discover(captured)
    else:
        export(captured)


if __name__ == "__main__":
    main()
