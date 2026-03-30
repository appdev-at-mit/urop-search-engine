"""
Open a visible browser so you can log in to MIT ELx manually.
After login completes, press Enter in the terminal to save the
authenticated browser state for reuse by the other scripts.
"""

import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ELX_URL = "https://elx.mit.edu"
STATE_PATH = Path(__file__).resolve().parent.parent / "auth" / "mit_elx_state.json"


def main():
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        print(f"Opening {ELX_URL} ...")
        page.goto(ELX_URL, wait_until="networkidle")

        print()
        print("=== Log in through MIT auth / Duo / certificates ===")
        print("Once you see the ELx dashboard, come back here and press Enter.")
        print()
        input("Press Enter to save session state... ")

        context.storage_state(path=str(STATE_PATH))
        print(f"Session saved to {STATE_PATH}")

        browser.close()

    # Verify the file was created
    if STATE_PATH.exists():
        size_kb = STATE_PATH.stat().st_size / 1024
        print(f"State file: {size_kb:.1f} KB — looks good.")
    else:
        print("WARNING: State file was not created.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
