"""
Refresh the ELx Cognito token without a human copying it out of DevTools.

Replays the saved MIT SSO session (from login_once.py) through a headless
browser, captures the fresh `Authorization: Bearer <jwt>` header the ELx SPA
sends to api.mit.edu/elo-v2, and pushes it to the backend's admin API. This
only works as long as the underlying MIT Touchstone/Duo session in the saved
state is still valid — when it finally expires, re-run login_once.py and
update the ELX_STATE_B64 secret.

Usage:
  python scripts/refresh_token.py

Env vars:
  ELX_STATE_B64   base64-encoded contents of auth/mit_elx_state.json
                  (falls back to that file directly if unset — for local runs)
  ADMIN_SECRET    shared secret for the backend admin API
  BACKEND_URL     e.g. https://miturop.org (default: https://miturop.org)
"""

import base64
import json
import os
import sys
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ELX_URL = "https://elx.mit.edu"
STATE_PATH = Path(__file__).resolve().parent.parent / "auth" / "mit_elx_state.json"
API_HOST = "api.mit.edu/elo-v2"
DEFAULT_BACKEND_URL = "https://miturop.org"


def check_auth(page) -> bool:
    url = page.url.lower()
    login_indicators = ["idp.", "login", "shibboleth", "touchstone", "duo"]
    return not any(indicator in url for indicator in login_indicators)


def load_storage_state() -> dict:
    b64 = os.environ.get("ELX_STATE_B64")
    if b64:
        return json.loads(base64.b64decode(b64))
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text())
    print("No saved auth state. Set ELX_STATE_B64 or run login_once.py first.", file=sys.stderr)
    sys.exit(1)


def capture_token(storage_state: dict) -> str:
    captured = {}

    def on_request(request):
        if "token" in captured or API_HOST not in request.url:
            return
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            captured["token"] = auth.split(" ", 1)[1]

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(storage_state=storage_state)
        page = context.new_page()
        page.on("request", on_request)

        page.goto(ELX_URL, wait_until="networkidle")

        if not check_auth(page):
            browser.close()
            print(
                "Auth expired — saved session redirected to MIT login. "
                "Re-run login_once.py and update the ELX_STATE_B64 secret.",
                file=sys.stderr,
            )
            sys.exit(1)

        page.wait_for_timeout(3000)
        if "token" not in captured:
            page.wait_for_timeout(5000)
        if "token" not in captured:
            page.evaluate("window.location.hash = '#/opportunities'")
            page.wait_for_timeout(3000)
            page.goto(ELX_URL, wait_until="networkidle")
            page.wait_for_timeout(5000)

        browser.close()

    if "token" not in captured:
        print("No elo-v2 request carried a bearer token.", file=sys.stderr)
        sys.exit(1)

    return captured["token"]


def push_token(token: str):
    admin_secret = os.environ.get("ADMIN_SECRET")
    if not admin_secret:
        print("ADMIN_SECRET is not set.", file=sys.stderr)
        sys.exit(1)
    backend_url = os.environ.get("BACKEND_URL", DEFAULT_BACKEND_URL).rstrip("/")

    req = urllib.request.Request(
        f"{backend_url}/api/admin/elx-token",
        data=json.dumps({"token": token}).encode(),
        headers={"Content-Type": "application/json", "x-admin-key": admin_secret},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        print("Token pushed:", resp.read().decode())


def main():
    token = capture_token(load_storage_state())
    push_token(token)


if __name__ == "__main__":
    main()
