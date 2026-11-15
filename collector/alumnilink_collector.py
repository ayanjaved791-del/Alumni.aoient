"""
Saylani AlumniLink Public Profile Collector
=========================================
Discovers publicly accessible alumni profiles from https://alumni.saylaniit.com/
via robots.txt, sitemap.xml, and public feed SSR payloads.

Collects ONLY publicly accessible AlumniLink profile data:
- Full Name
- Username
- Profile Picture URL
- AlumniLink Profile URL
- Total AlumniLink Followers (count only)
- Total AlumniLink Following (count only, optional)
- Verified badge & public role/bio/location

Does NOT scrape Instagram, Facebook, LinkedIn, YouTube, or private pages.
Does NOT bypass authentication, CAPTCHAs, or robots.txt disallow rules.

Supports Playwright browser extraction when available, with a verified
Next.js RSC/HTML HTTP fallback when Playwright is not installed.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Optional
from urllib.robotparser import RobotFileParser

BASE_URL = "https://alumni.saylaniit.com"
USER_AGENT = "SaylaniAlumniLeaderboardBot/1.0 (+https://alumni.saylaniit.com/robots.txt)"


@dataclass
class AlumniProfile:
    username: str
    full_name: str
    profile_url: str
    avatar_url: Optional[str]
    followers: int
    following: Optional[int]
    verified: bool
    role: str
    bio: Optional[str]
    location: Optional[str]
    source: str
    last_updated_at: str


def check_robots_allowed(target_path: str = "/") -> bool:
    rp = RobotFileParser()
    rp.set_url(f"{BASE_URL}/robots.txt")
    try:
        rp.read()
        return rp.can_fetch("*", f"{BASE_URL}{target_path}")
    except Exception:
        return True


def fetch_text(url: str, timeout: int = 15) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def discover_usernames_from_sitemap(limit: Optional[int] = None) -> list[str]:
    from urllib.parse import urlparse

    xml = fetch_text(f"{BASE_URL}/sitemap.xml")
    locs = re.findall(r"<loc>(.*?)</loc>", xml)
    usernames: list[str] = []
    seen: set[str] = set()
    excluded = {"feed", "admin", "login", "register", "jobs", "search", "dashboard", "settings"}
    for loc in locs:
        path_parts = [p for p in urlparse(loc.strip()).path.split("/") if p]
        if len(path_parts) != 1:
            continue
        slug = path_parts[0].strip()
        lower = slug.lower()
        if not slug or lower in excluded or lower in seen:
            continue
        seen.add(lower)
        usernames.append(slug)
        if limit and len(usernames) >= limit:
            break
    return usernames


def discover_usernames_from_feed() -> list[str]:
    html = fetch_text(f"{BASE_URL}/")
    unescaped = html.replace('\\"', '"')
    matches = re.findall(r'"username":"([a-zA-Z0-9_.-]+)"', unescaped)
    seen: set[str] = set()
    out: list[str] = []
    for u in matches:
        key = u.lower()
        if key not in seen:
            seen.add(key)
            out.append(u)
    return out


def parse_profile_from_html(username: str, html: str) -> Optional[AlumniProfile]:
    unescaped = html.replace('\\"', '"').replace("\\\\", "\\")
    pattern = re.compile(r'"username":"' + re.escape(username) + r'"', re.IGNORECASE)
    match = pattern.search(unescaped)

    followers: Optional[int] = None
    following: Optional[int] = None
    full_name = username
    avatar_url: Optional[str] = None
    verified = False
    role = "alumni"
    bio: Optional[str] = None
    location: Optional[str] = None

    if match:
        window_start = max(0, match.start() - 350)
        window_end = min(len(unescaped), match.end() + 5500)
        chunk = unescaped[window_start:window_end]

        name_m = re.search(r'"name":"([^"]*)","username":"' + re.escape(username) + r'"', chunk, re.IGNORECASE)
        if name_m and name_m.group(1).strip():
            full_name = name_m.group(1).strip()

        fol_m = re.search(r'"followers":(\d+)', chunk)
        if fol_m:
            followers = int(fol_m.group(1))

        fing_m = re.search(r'"following":(\d+)', chunk)
        if fing_m:
            following = int(fing_m.group(1))

        av_m = re.search(r'"avatar":"([^"]+)"', chunk)
        if av_m and av_m.group(1) != "$undefined":
            avatar_url = av_m.group(1)

        ver_m = re.search(r'"verified":(true|false)', chunk)
        if ver_m:
            verified = ver_m.group(1) == "true"

        role_m = re.search(r'"role":"([^"]+)"', chunk)
        if role_m:
            role = role_m.group(1)

        loc_m = re.search(r'"location":"([^"]*)"', chunk)
        if loc_m and loc_m.group(1).strip():
            location = loc_m.group(1).strip()

        bio_m = re.search(r'"bio":"([^"]*)"', chunk)
        if bio_m and bio_m.group(1).strip():
            bio = bio_m.group(1).replace("\\n", "\n").strip()[:400]

    # Fallback DOM extraction for rendered follower/following counts
    if followers is None:
        dom_fol = re.search(r'>(\d+)\s*</span>\s*(?:<!--.*?-->)?\s*followers', html, re.IGNORECASE)
        if dom_fol:
            followers = int(dom_fol.group(1))

    if following is None:
        dom_fing = re.search(r'>(\d+)\s*</span>\s*(?:<!--.*?-->)?\s*following', html, re.IGNORECASE)
        if dom_fing:
            following = int(dom_fing.group(1))

    if followers is None:
        return None

    return AlumniProfile(
        username=username,
        full_name=full_name,
        profile_url=f"{BASE_URL}/{username}",
        avatar_url=avatar_url,
        followers=followers,
        following=following,
        verified=verified,
        role=role,
        bio=bio,
        location=location,
        source="verified_scrape",
        last_updated_at=datetime.now(timezone.utc).isoformat(),
    )


def collect_with_playwright(usernames: list[str], delay_sec: float) -> list[AlumniProfile]:
    from playwright.sync_api import sync_playwright  # type: ignore

    results: list[AlumniProfile] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=USER_AGENT)
        page = context.new_page()
        for idx, username in enumerate(usernames):
            if not check_robots_allowed(f"/{username}"):
                continue
            try:
                page.goto(f"{BASE_URL}/{username}", wait_until="domcontentloaded", timeout=20000)
                html = page.content()
                profile = parse_profile_from_html(username, html)
                if profile:
                    results.append(profile)
            except Exception as exc:
                print(f"[warn] Playwright failed for {username}: {exc}", file=sys.stderr)
            if idx < len(usernames) - 1:
                time.sleep(delay_sec)
        browser.close()
    return results


def collect_with_http(usernames: list[str], delay_sec: float) -> list[AlumniProfile]:
    results: list[AlumniProfile] = []
    for idx, username in enumerate(usernames):
        if not check_robots_allowed(f"/{username}"):
            continue
        try:
            html = fetch_text(f"{BASE_URL}/{username}")
            profile = parse_profile_from_html(username, html)
            if profile:
                results.append(profile)
        except urllib.error.HTTPError as exc:
            print(f"[warn] HTTP {exc.code} for {username}", file=sys.stderr)
        except Exception as exc:
            print(f"[warn] Failed {username}: {exc}", file=sys.stderr)
        if idx < len(usernames) - 1:
            time.sleep(delay_sec)
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect public Saylani AlumniLink follower counts.")
    parser.add_argument("--limit", type=int, default=50, help="Maximum sitemap profiles to fetch")
    parser.add_argument("--delay", type=float, default=0.35, help="Polite delay between requests (seconds)")
    parser.add_argument("--out", type=str, default="alumnilink_export.json", help="Output file (.json or .csv)")
    parser.add_argument("--prefer-playwright", action="store_true", help="Use Playwright when installed")
    args = parser.parse_args()

    if not check_robots_allowed("/"):
        print("Robots.txt disallows scraping root path. Aborting.", file=sys.stderr)
        return 1

    feed_users = discover_usernames_from_feed()
    sitemap_users = discover_usernames_from_sitemap(limit=args.limit)

    deduped: list[str] = []
    seen: set[str] = set()
    for u in feed_users + sitemap_users:
        k = u.lower()
        if k not in seen:
            seen.add(k)
            deduped.append(u)

    deduped = deduped[: args.limit]
    print(f"Discovered {len(deduped)} public profiles to extract.")

    use_pw = False
    if args.prefer_playwright:
        try:
            import playwright  # noqa: F401
            use_pw = True
        except ImportError:
            print("Playwright not installed; falling back to verified HTTPS RSC extraction.", file=sys.stderr)

    profiles = collect_with_playwright(deduped, args.delay) if use_pw else collect_with_http(deduped, args.delay)
    profiles.sort(key=lambda p: p.followers, reverse=True)

    if args.out.endswith(".csv"):
        with open(args.out, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "username",
                    "full_name",
                    "followers",
                    "following",
                    "verified",
                    "role",
                    "profile_url",
                    "avatar_url",
                    "location",
                    "source",
                    "last_updated_at",
                ],
            )
            writer.writeheader()
            for p in profiles:
                row = asdict(p)
                row.pop("bio", None)
                writer.writerow(row)
    else:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump([asdict(p) for p in profiles], f, indent=2, ensure_ascii=False)

    print(f"Saved {len(profiles)} verified AlumniLink profiles to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
