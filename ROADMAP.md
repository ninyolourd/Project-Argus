# Argus — Roadmap

Planned features and ideas beyond the current core (Chrome extension + Node/Express server).

---

## Current State (Done)

- Chrome MV3 extension — screenshot + desktop screen recording
- Console and network log capture
- Shareable report links (hosted on Render, files on Backblaze B2)
- Library page — view, copy, delete all captures
- Drafts page — local recordings pending submission
- Commenter names — extension users get their name prefilled, guests can type theirs
- Description editing — owner-only, read-only for others
- QA distribution via `Argus-Extension.zip`

---

## Phase 1 — Olympus Integration (Web SDK)

> Goal: Add Argus as an app tile in Olympus so users can capture bugs without installing the Chrome extension.

### Argus Web SDK (`argus.js`)

A single script tag that any web app (starting with Olympus) can embed to get full Argus functionality in-browser — no extension required.

```html
<script src="https://project-argus-brw6.onrender.com/sdk/argus.js"></script>
```

**What it provides:**
- Floating trigger button (or programmatic launch)
- Screenshot via `html2canvas`
- Screen recording via `getDisplayMedia` (same API the extension uses)
- Console log capture via `console` monkey-patching
- Network log capture via `fetch` / `XHR` interception
- Same "New Bug Capture" modal UI (`overlay.js` reused)
- Submits to the same server and produces the same shareable report link

**Differences from extension:**
- Screenshots use `html2canvas` — less accurate on cross-origin iframes
- No tab-level isolation (captures the full page, not a cropped selection per tab)
- Website owner must embed the script (doesn't auto-run on every site like the extension)

**Olympus-specific integration:**
- Argus appears as an app card in the Olympus dashboard (alongside Athena)
- SDK auto-identifies the user from the Olympus session (no manual name entry)
- Report links can surface inside Olympus (e.g., in a "Bug Reports" section)

---

## Phase 2 — Quality of Life

- **Search & filter in library** — search by name, filter by date or capture type
- **Bulk delete** — select multiple reports and delete at once
- **Report status tags** — mark a report as Open / In Progress / Resolved
- **Expiry control** — optional auto-delete after N days per report
- **Capture annotations** — draw arrows or highlight areas on a screenshot before submitting

---

## Phase 3 — Collaboration

- **Assignee field** — assign a report to a team member
- **@mentions in comments** — notify teammates via email or Slack
- **Slack / Jira integration** — post report links automatically on submit
- **Team library** — shared view of all reports across the team (not per-user)

---

## Notes

- Greek mythology naming convention in Olympus: Athena, Argus, and others follow the same pattern
- Argus server is on Render free tier — upgrade if traffic grows
- B2 free tier: 10 GB storage, no egress fees
