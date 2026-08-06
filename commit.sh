#!/bin/bash
git add -A && git commit -m "Add persistent auth, event management, acquired date sort, photo UX improvements

Auth:
- Switch from implicit grant to OAuth authorization code flow with refresh tokens
- Client secret entered once per device, stored in localStorage (not in repo)
- Auto-refresh access token before expiry, persistent login across app restarts

Features:
- Acquired Date sort with grouped month/year section headers
- Activity Show All expands full event history table with edit/delete per event
- Photo picker hidden when plant already has a photo (visible in edit mode)
- Photo updates immediately in detail view after upload (stale data fix)

Fixes:
- Acquired date sort now parses dates correctly (was string-comparing month names)
- localStorage for auth persistence (sessionStorage was clearing on app close)

Specs:
- Product and system specs updated to reflect all changes" && git push
