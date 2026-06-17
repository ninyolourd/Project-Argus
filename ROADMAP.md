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

### Bug: Save prompt sometimes doesn't appear after recording
Recording stops but the "New Bug Capture" modal never shows. Workaround is to go to the Drafts page and save from there. Root cause has been partially addressed (content script injection on tabs opened before extension install) but still occurs in some cases.

### Screenshot annotation
Before the "New Bug Capture" modal confirms a save, users should be able to mark up the screenshot — add text labels, highlight areas, draw arrows. Freehand drawing is the minimum; shapes and text on top would be ideal.

### Floating stop widget for desktop recording
The recording-controls window currently opens as a separate Chrome window and can get lost behind other windows or buried in the taskbar. Replace it with a small floating overlay injected into the current page (similar to how Loom's stop button works) so users always know where to click to stop.

---

## Phase 1 — Accounts (Olympus SSO)

> Use Olympus's existing account management — no separate sign-up or login flow in Argus.

- Argus server validates tokens issued by Olympus (need to confirm: JWT, session cookie, OAuth, or custom)
- Extension gets the Olympus token and stores it in `chrome.storage.local`
- `argusUserName` replaced by the Olympus display name from the token
- Report ownership tied to Olympus user ID, not just `?owner=1` URL param
- "Commenting as" field fully auto-filled and disabled for authenticated users

> **Pending:** confirm Olympus auth mechanism and whether a `/me` or token-validation endpoint exists.

---

## Phase 2 — Projects & Folders

> Organise captures by project so teams can separate bugs by app or client.

### Data model

```
User (Olympus account)
└── Projects  (Athena, Olympus Core, Client X…)
    └── Bug Captures  (screenshots, recordings)
```

### What to build

- **Project CRUD** — create, rename, delete projects
- **Link grouping** — library page shows captures grouped under their project; switch projects via sidebar or tab
- **Assign on capture** — extension popup shows a project dropdown before submitting; defaults to last-used project
- **Auto-tagging via SDK** — when `argus.js` is embedded in an app (e.g. Athena), it passes a `projectId` so captures are automatically filed under the right project
- **Shared projects** — invite teammates so everyone sees the same captures
- **Link expiry** — optional per-project or per-capture expiry, max 90 days; expired links return a clear "report no longer available" page

---

## Phase 3 — Web SDK & Olympus Integration

> Add Argus as an app tile in Olympus — no Chrome extension required. Embedding in other apps like Athena is optional and can be done at any point once the SDK exists.

### Primary goal — Argus tile in Olympus

- Argus appears as its own app tile in the Olympus dashboard (alongside Athena)
- Users launch Argus from Olympus and get full capture functionality in-browser
- Auto-identifies the user from the Olympus session — no separate login
- All captures surface in the Argus app and are tied to the logged-in Olympus account

### `argus.js` SDK

A single script tag that powers the Olympus tile and can optionally be embedded in any other app:

```html
<script src="https://project-argus-brw6.onrender.com/sdk/argus.js"
        data-project="my-project">
</script>
```

**What it provides:**
- Floating capture button (or programmatic trigger)
- Screenshot via `html2canvas` + annotation layer
- Screen recording via `getDisplayMedia`
- Console log capture via `console` monkey-patching
- Network log capture via `fetch` / `XHR` interception
- Same "New Bug Capture" modal UI
- `data-project` attribute auto-files captures under the correct project

### Optional — embed in other apps (e.g. Athena)

Once the SDK exists, any internal app can add the script tag to get a capture button directly in their UI. Captures are auto-tagged with the app's project. This is optional and not required for the Olympus tile to work.

---

## Phase 4 — Collaboration & Workflow

- **Request link** — send a link asking a specific user to capture and submit a bug report (similar to Jam.dev's request feature)
- **Status tags** — mark a report as Open / In Progress / Resolved
- **Assignee field** — assign a report to a team member
- **@mentions in comments** — notify teammates via email or Slack
- **Slack / Jira integration** — post report links automatically on submit
- **Bulk actions** — select multiple reports to delete, move, or change status

---

## Notes

- Greek mythology naming convention in Olympus: Athena, Argus — keep the pattern for any new tools
- Argus server is on Render free tier — upgrade if team traffic grows
- B2 free tier: 10 GB storage, no egress fees
- Accounts (Phase 1) unlocks everything else — confirm Olympus auth details before starting
