# Argus — Roadmap

Argus is a bug capture mini app with Chrome extension capabilities — screenshot, screen recording, console/network logs, and shareable report links. Planned for integration into Hephaestus as a standalone app tile.

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

## Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Extension** | JavaScript (Chrome MV3) | Background service worker, content scripts, action popup, offscreen document |
| **Extension UI** | HTML + CSS | Shared design tokens via `theme.css`; in-page overlay built as a Shadow DOM web component |
| **Server** | Node.js + Express.js | REST API — report creation, capture streaming, comments, delete |
| **File Storage** | Backblaze B2 | S3-compatible; SDK: `@aws-sdk/client-s3`. Files stored as `reports/<uuid>/capture.png|webm` + `meta.json`. 10 GB free, no egress fees |
| **Data format** | JSON (flat files in B2) | No database — each report is a `meta.json` object stored alongside its capture file |
| **Hosting** | Render (free tier) | Cold start ~30–60 s after 15 min inactivity; deploy via webhook |
| **Local recording storage** | IndexedDB (`argus-recordings`) | Temporary store for recording blobs in the extension before upload |
| **Extension persistence** | `chrome.storage.local` | Username, server URL, report history |
| **Session signals** | `sessionStorage` | Per-tab flags: `argusFromExtension`, `argusIsOwner` |

---

## Bug Log

> All known issues encountered during development — fixed and open.

### Fixed

| # | Issue | Root Cause | Fix |
|---|---|---|---|
| 1 | "Recording not found" error on Drafts page | `SUBMIT_REPORT` used `sender.tab?.id ?? msg.tabId` — when Drafts page sent the message, `sender.tab` was the drafts tab, not the recording's original tab | Swapped priority to `msg.tabId ?? sender.tab?.id` so the explicitly supplied tab ID always wins |
| 2 | Desktop recording modal never shows when starting from Library/Drafts page | Content scripts can't run on `chrome-extension://` pages, so `DESKTOP_RECORDING_READY` was silently dropped | On send failure, fall back to the most recently active http/https tab; inject `overlay.js` + `content.js` first to handle tabs opened before the extension was installed |
| 3 | Modal appears on wrong tab after switching tabs during recording | Modal showed on the correct original tab but the user was now looking at a different tab | Added `chrome.tabs.update(tabId, { active: true })` on successful send so Chrome brings the right tab into focus |
| 4 | Library "Open" link missing `?author=` param if clicked before async resolved | `chrome.storage.local.get` was async; href was set inside `.then()`. Clicking before resolution produced a URL with no author param | Moved username load to `init()` via `Promise.all` alongside report history; href set synchronously in `renderRow()` |
| 5 | Delete blocked on reports created before B2 migration | Old reports had no files in B2; delete route returned 404, preventing the library UI from removing the entry | Return `{ ok: true }` when the report isn't found in B2 — lets the extension clean up local history regardless |
| 6 | Double-injection crash risk when injecting content scripts into tabs that already had them | Re-running `overlay.js` would reassign `window.ArgusOverlay`; re-running `content.js` IIFE would register duplicate event listeners | Added guards: `window.ArgusOverlay = window.ArgusOverlay \|\| (...)` in overlay.js; early return if `window.__argusContentLoaded` is set in content.js |
| 7 | "Commenting as" name not appearing on comments | `author` field was not included in the comment POST body or stored on the server | Added `author` to comment POST, stored in `reports/<id>/meta.json`, and rendered next to timestamp in the report page |
| 8 | Description editable by anyone who opens the report link | No ownership check on the description textarea | `?created=1` / `?owner=1` sets `sessionStorage('argusIsOwner')`; without it the textarea is disabled and Save is hidden |

### Open / Intermittent

| # | Issue | Workaround | Status |
|---|---|---|---|
| 9 | Save prompt sometimes doesn't appear after stopping a desktop recording | Go to Drafts page and save from there | Partially fixed (issues 2 & 3 above) — still occurs in some edge cases; needs more investigation |

---

## Near-term — Bugs & Improvements

> Issues and enhancements on the current extension before moving to the next phase.

### Bug: Save prompt sometimes doesn't appear after recording — ✅ Done (2026-06-19)
Root cause: tab recordings sent `RECORDING_DATA` with no `source`, so the background's notification block (desktop-only) was skipped and the modal was driven solely by the content script's in-tab poll — which is lost if the tab navigates while the video encodes. Fixed by routing both tab and desktop recordings through one `notifyRecordingReady()` in the background that re-injects scripts, sends `RECORDING_READY`, falls back to the most recently used web tab, and only opens Drafts as a last resort. Also fixed a related "Receiving end does not exist" error by injecting content scripts on demand from the popup (covers tabs opened before the extension was reloaded).

### Screenshot annotation — ✅ Done (2026-06-19)
The screenshot preview modal now has a canvas annotator: pen (freehand), arrow, box, and text tools in six colors, with undo and clear-all. Text is placed via an inline input where the user clicks. Annotations are flattened onto the screenshot at full resolution on save.

### Floating stop widget for desktop recording — ✅ Done (2026-06-19)
The recording-controls window previously stayed visible as a small bar and could get lost behind other windows or buried in the taskbar. It now minimizes itself once capture starts, and a floating "Stop Recording" pill (the same in-page widget tab recording uses) is injected into the current page. The pill follows the user across tab switches and relays a stop request to the minimized window that owns the MediaRecorder. Chrome's native "Stop sharing" bar remains as a fallback.

---

## Phase 1 — AI-Powered Automated Bug Report Generation

> Automatically generate a structured, readable bug report from the captured screenshot/recording and logs — no manual description needed.

### What it does

When a user completes a capture, an AI model analyzes the available context and generates:
- **Title** — a concise bug report title based on what's visible or what went wrong
- **Description** — a structured summary covering what happened, what was expected, and the likely environment context
- **Steps to reproduce** — inferred from the console/network log sequence
- **Severity suggestion** — Low / Medium / High / Critical based on error signals in the logs

The generated content pre-fills the report fields. Users can edit before saving or accept as-is.

### How it works

- On submit, the server sends the capture metadata + console/network logs to an AI API (e.g. Claude API)
- For screenshots: the image is passed to a vision-capable model to describe what's on screen
- For recordings: the first and last frames are extracted and passed alongside the log data
- The AI response populates the report's title and description fields server-side before the report URL is returned

### Why this first

Automated report generation adds the most value with the least infrastructure dependency — no accounts, no projects, no SDK required. It makes every report better immediately, for all current users.

---

## Phase 2 — Accounts (Hephaestus SSO)

> Use Hephaestus's existing account management — no separate sign-up or login flow in Argus.

- Argus server validates tokens issued by Hephaestus (need to confirm: JWT, session cookie, OAuth, or custom)
- Extension gets the Hephaestus token and stores it in `chrome.storage.local`
- `argusUserName` replaced by the Hephaestus display name from the token
- Report ownership tied to Hephaestus user ID, not just `?owner=1` URL param
- "Commenting as" field fully auto-filled and disabled for authenticated users

> **Pending:** confirm Hephaestus auth mechanism and whether a `/me` or token-validation endpoint exists.

---

## Phase 3 — Projects & Folders

> Organise captures by project so teams can separate bugs by app or client.

### Data model

```
User (Hephaestus account)
└── Projects  (Athena, Hephaestus Core, Client X…)
    └── Bug Captures  (screenshots, recordings)
```

### What to build

- **Project CRUD** — create, rename, delete projects
- **Link grouping** — library page shows captures grouped under their project; switch projects via sidebar or tab
- **Assign on capture** — extension popup shows a project dropdown before submitting; defaults to last-used project
- **Auto-tagging via SDK** — when `argus.js` is embedded in an app, it passes a `projectId` so captures are automatically filed under the right project
- **Shared projects** — invite teammates so everyone sees the same captures
- **Link expiry** — optional per-project or per-capture expiry, max 90 days; expired links return a clear "report no longer available" page

---

## Phase 4 — Mini App & Hephaestus Integration

> Argus evolves from a pure Chrome extension into a mini app with extension capabilities — a full web interface for managing reports, accessible from the Hephaestus dashboard.

### Architecture

- **Web app** (primary) — full Argus UI hosted on the server; login via Hephaestus SSO; accessible from any browser without installing the extension
- **Chrome extension** (companion) — adds capture capabilities (screenshot, recording, logs) to any page; submits to the same backend
- Both share the same reports, projects, and user accounts

### Hephaestus integration

- Argus appears as its own app tile in the Hephaestus dashboard
- Users can manage all reports, projects, and team members from the Argus web app
- The extension is an optional power-user tool for teams who want in-page capture

### `argus.js` SDK (optional embedding)

Any internal app can embed a script tag to get a capture button directly in their UI:

```html
<script src="https://project-argus-brw6.onrender.com/sdk/argus.js"
        data-project="my-project">
</script>
```

Captures are auto-tagged with the app's project. This is optional and independent of the Hephaestus tile.

---

## Phase 5 — Collaboration & Workflow

- **Request link** — send a link asking a specific user to capture and submit a bug report (similar to Jam.dev's request feature)
- **Status tags** — mark a report as Open / In Progress / Resolved
- **Assignee field** — assign a report to a team member
- **@mentions in comments** — notify teammates via email or Slack
- **Slack / Jira integration** — post report links automatically on submit
- **Bulk actions** — select multiple reports to delete, move, or change status

---

## Notes

- Greek mythology naming convention in Hephaestus platform: Athena, Argus — keep the pattern for any new tools
- Argus server is on Render free tier — upgrade if team traffic grows
- B2 free tier: 10 GB storage, no egress fees
- Phase 1 (AI generation) can ship independently — no auth or project infra needed
- Phase 2 (Accounts) unlocks everything from Phase 3 onward
